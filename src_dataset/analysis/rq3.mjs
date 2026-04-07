// What percentage of code does \oursolution{} remove from a client's primary dependencies?

/*
Foreach repo in success.txt
1. load direct dependencies from package.json
2. Ground truth:
    For each direct dependency, get its `sloc --json ../hybrid-candidates-repos/node_modules_backup/node_modules_<repo>/<direct-dep> | jq ".JavaScript.code"` -> total lines of code
3. For webpack:
    For each direct dependency, use esprima, convert to AST, split by keys, filter by repo name to get direct dep files, get lines of code for each file, sum it up
4. For \oursolution{}:
    For each direct dependency, use esprima, convert to AST, split by keys, filter by repo name to get direct dep files, get lines of code for each file, sum it up
5. Compare 2 and 3, 2 and 4
6. Output CSV with repo name, ground truth lines of code, webpack lines of code, \oursolution{} lines of code
*/
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { promisify } from 'util';
import {exec} from 'node:child_process'
import path from 'path';
import esprima from 'esprima';
import {parse} from 'espree'
import esquery from 'esquery'
import { processPromisesBatch } from '../batch.mjs';
import { readdir, writeFile } from 'node:fs/promises';
import {stringify} from 'csv/sync'
import { minify } from 'terser'
const execPromise = promisify(exec);
const HYBRID_CANDIDATES_ROOT = path.resolve('hybrid-candidates-repos');

const repos = await readFile('success.txt', 'utf-8').then(data => data.split('\n').filter(Boolean).filter(e=>!e.startsWith('#')));

const data = await processPromisesBatch(repos,32,processRepo)
// console.log(data);

const csvData = stringify(data.map(e=>e===undefined?{}:e), { header: true });
console.log(csvData)
writeFile('rq3_output.csv', csvData);

/**
 * 
 * @param {string} repo 
 * @returns 
 */
async function processRepo(repo){
    if(!existsSync(path.join(HYBRID_CANDIDATES_ROOT, repo, 'package.json'))) {
        console.log(`Skipping ${repo} as package.json does not exist`);
        return;
    }
    const packageJsonContentString = await readFile(path.join(HYBRID_CANDIDATES_ROOT, repo, 'package.json'), 'utf-8');
    // load direct dep from package.json
    const parsedPackageConfig = JSON.parse(packageJsonContentString);
    const directDeps = parsedPackageConfig?.dependencies??[];
    const directDepsSet = new Set(Object.keys(directDeps));

    // const devDeps = parsedPackageConfig?.devDependencies??[];
    // const devDepsSet = new Set(Object.keys(devDeps));

    // Ground truth
    // For each direct dependency, get its `sloc --json <backup-root>/node_modules_<repo>/<direct-dep> | jq ".JavaScript.code"` -> total lines of code

    const groundTruthLinesOfCode = await getGroundTruthLinesOfCode(repo, directDepsSet);
    
    // console.log(groundTruthLinesOfCode);

    // For webpack:

    if(!existsSync(`output/${repo}`)){
        console.log(`Skipping WEBPACKCOUNT ${repo} as repo does not exist`);
        return;
    }
    // iterate each each dep.bundle.cjs in output/<repo>/
    
    const totalWebpackLOC = await getWebpackLinesOfCode(repo, directDepsSet);
    
    
    // console.log('webpackLinesOfCode', totalWebpackLOC);

    // For \oursolution{}:
    if(!existsSync(`dist/${repo}`)){
        console.log(`Skipping OURSOLUTIONCOUNT ${repo} as it does not exist`);
        return;
    }
    const totalOurSolutionLOC = await getOurSolutionLOC(repo, directDepsSet);
    // console.log(`ourSolutionLinesOfCode`, totalOurSolutionLOC);

    return {
        repo,
        groundTruthLinesOfCode,
        webpackLinesOfCode: totalWebpackLOC,
        ourSolutionLinesOfCode: totalOurSolutionLOC
    }
}

async function getWebpackLinesOfCode(repo, directDepsSet){
    const webpackFiles = (await readdir('output/'+repo)).filter(f => f.endsWith('.bundle.cjs'));


    let webpackLinesOfCode = 0;
    for(const file of webpackFiles){
        const outputFilePath = path.join('output', repo, file);
        const oldContentString = await readFile(outputFilePath, 'utf-8');
        const terserOptimizedPath = await useCachedOptimizedTerserModule(outputFilePath, path.basename(file, '.bundle.cjs'), oldContentString);
        // console.log('terserOptimizedPath', terserOptimizedPath);
        const contentString = await readFile(terserOptimizedPath, 'utf-8');
        //
        /** @type {import('estree').Program} */
        let ast;
        try{
            ast = parse(contentString, { range: true, tolerant: true, comment: true, sourceType: "module", ecmaVersion: 'latest' });
        }catch(e){
            throw e;
        }
        // get all keys
        // console.log(outputFilePath)
        // I want to select all Properties within the object __webpack_modules__
        /** @type {import('estree').Property[]} */
        const moduleList = esquery(ast, 'VariableDeclarator[id.name="__webpack_modules__"] > ObjectExpression > Property');
        // console.log(moduleList);
        for (const module of moduleList) {
            const moduleName = module.key.value ?? module.key.name;
            // console.log(dependencyName)
            // if(moduleName===undefined){console.error('moduleName is undefined', module,module.key.name);throw Error(5);}
            const dependencyName = moduleName.split('/')[4];
            // console.log('dep',dependencyName);
            if(!directDepsSet.has(dependencyName)){
                // console.log(`Skipping module ${moduleName} as it is not a direct dependency`);
                continue;
            }
            const moduleDataRange = module.value.body.range;

            const extractedCode = contentString.slice(moduleDataRange[0] + 1, moduleDataRange[1] - 1);
            // console.log(extractedCode)
            
            // generate a filename for this module
            const tmpFileName = moduleName.replace(/[^a-zA-Z0-9]/g, '_') + '.js';
            // write to /tmp/tmpFileName
            await writeFile(path.join('/tmp', tmpFileName), extractedCode);
            // get lines of code using cloc
            try{
                const {stdout, stderr} = await execPromise(`cloc --json /tmp/${tmpFileName} | jq ".JavaScript.code"`);
                if(stderr){
                    console.warn(`Error while getting cloc for module ${moduleName} in repo ${repo}: ${stderr}`);
                    continue;
                }
                try{
                    const loc = parseInt(stdout.trim());
                    if(isNaN(loc)){//null
                        continue;
                    }
                    webpackLinesOfCode += loc;
                }catch(e){}
            }
            catch(e){
                console.log("something went wrong ",e)
            }

        }
        
    }
    return webpackLinesOfCode;
}
async function getGroundTruthLinesOfCode(repo, directDepsSet){
    let groundTruthLinesOfCode = 0;
    for(const dep of directDepsSet){
        let candidate = null;
        // Prefer new backup location used in this environment
        if(existsSync(`../node_modules_backup/node_modules_${repo}/${dep}`)){
            candidate = `../node_modules_backup/node_modules_${repo}/${dep}`;
        }
        // Fall back to original locations from the paper implementation
        if(candidate==null && existsSync(path.join(HYBRID_CANDIDATES_ROOT, 'node_modules_backup', `node_modules_${repo}`, dep))){
            candidate = path.join(HYBRID_CANDIDATES_ROOT, 'node_modules_backup', `node_modules_${repo}`, dep);
        }
        if(candidate==null && existsSync(path.join(HYBRID_CANDIDATES_ROOT, repo, 'node_modules', dep))){
            candidate = path.join(HYBRID_CANDIDATES_ROOT, repo, 'node_modules', dep);
        }
        if(candidate===null){
            console.warn(`Skipping dep ${dep} in repo ${repo} as it does not exist in node_modules_${repo} or node_modules`);
            continue;
        }
        try{
            const {stdout, stderr} = await execPromise(`cloc --json ${candidate} | jq ".JavaScript.code"`);
            if(stderr){
                console.warn(`Error while getting cloc for dep ${dep} in repo ${repo}: ${stderr}`);
                // continue;
            }
            try{

                const loc = parseInt(stdout.trim());
                if(isNaN(loc)){//null
                    continue;
                }
                groundTruthLinesOfCode += loc;
            }catch(e){}
        }catch(e){
            console.log("something went wrong ",e)
        }
    }
    return groundTruthLinesOfCode;
}

async function getOurSolutionLOC(repo, directDepsSet){
    const ourSolutionDepFolders = (await readdir('dist/'+repo));
    let ourSolutionLinesOfCode = 0;
    for (const folder of ourSolutionDepFolders){
        const indexFilePath = path.join(`dist/${repo}`, folder, 'index.cjs');
        if(!existsSync(indexFilePath)){
            console.warn(`Skipping ${indexFilePath} as it does not exist`);
            continue;
        }
        const contentString = await readFile(indexFilePath, 'utf-8');
        // console.log(indexFilePath);
        
        const ast =parse(contentString, { range: true, tolerant: true, comment: true, sourceType: "module", ecmaVersion: 'latest' });// esprima.parseModule(contentString, { range: true, comment: true, tolerant: true });
        // get all keys
        // I want to select all Properties within the object __webpack_modules__
        /** @type {import('estree').Property[]} */
        const moduleList = esquery(ast, 'VariableDeclarator[id.name="__webpack_modules__"] > ObjectExpression > Property');
        // console.log(moduleList);
        for (const module of moduleList) {
            const moduleName = module.key.value
            const dependencyName = moduleName.split('/')[4];
            // console.log('dep',dependencyName);
            if(!directDepsSet.has(dependencyName)){
                // console.log(`Skipping module ${moduleName} as it is not a direct dependency`);
                continue;
            }
            const moduleDataRange = module.value.body.range;
            
            const extractedCode = contentString.slice(moduleDataRange[0] + 1, moduleDataRange[1] - 1);
            // console.log(extractedCode)
            
            // generate a filename for this module
            const tmpFileName = moduleName.replace(/[^a-zA-Z0-9]/g, '_') + '.js';
            // write to /tmp/tmpFileName
            await writeFile(path.join('/tmp', tmpFileName), extractedCode);
            // get lines of code using cloc
            try{
                const {stdout, stderr} = await execPromise(`cloc --json /tmp/${tmpFileName} | jq ".JavaScript.code"`);
                if(stderr){
                    console.warn(`Error while getting cloc for module ${moduleName} in repo ${repo}: ${stderr}`);
                    continue;
                }
                try{
                    const loc = parseInt(stdout.trim());
                    if(isNaN(loc)){//null
                        continue;
                    }
                    ourSolutionLinesOfCode += loc;
                }catch(e){}
            }
            catch(e){
                console.log("something went wrong ",e)
            }

        }
        

    }
    // console.log('ourSolutionLinesOfCode', ourSolutionLinesOfCode);
    return ourSolutionLinesOfCode;

}


/**
 * duped from rq1
 * @param {string} filePath 
 * @param {string} depName 
 * @param {string} oldContent 
 * @returns 
 */
async function useCachedOptimizedTerserModule(filePath, depName, oldContent) {
    // check if the file exists
    const terserPath = path.join(path.dirname(filePath), `${depName}.optimized.cjs`);
    if (existsSync(terserPath)) {
        // await rm(terserPath);
        return terserPath;
    }
    // console.log('ftp', filePath,terserPath)
    const res = await minify(oldContent,{compress: true, format:{beautify: true}});
    await writeFile(terserPath, res.code);
    // res.code
    console.log(terserPath,'does not exist, creating it now')
    return terserPath
}