// How many transitive dependencies does \oursolution{} remove?


/*

Foreach repo in success.txt
1. load direct dependencies from package.json
2. Get ground truth -> number of packages in node_modules_backup
3. load all keys from 'output/<repo_name>/ -> Webpack
4. load all keys from 'dist/<repo_name>/ -> \oursolution{}

*/

import fs, { existsSync } from 'fs';
import { readFile, rm, writeFile } from 'fs/promises';
import path from 'path';
import { processPromisesBatch } from '../batch.mjs';
import { stringify } from 'csv/sync';
import {minify} from 'terser'
const HYBRID_CANDIDATES_ROOT = path.resolve('hybrid-candidates-repos');
const repos = await readFile('success.txt', 'utf-8').then(data => data.split('\n').filter(Boolean).filter(e=>!e.startsWith('#')));

// const repo = repos[2];

const res = await processPromisesBatch(repos,10,processRepo);
// const x = await processRepo('glob-parent')
// console.log(x)
// res.map(e=>e===undefined?{}:e);

await writeFile('rq1_output.csv', stringify(res.map((e,i)=>e===undefined?{repo:repos[i]}:e), { header: true }));

// const transitiveDepsReduced = res.filter(e => e !== undefined && e.ourSolutionTransitiveDeps < e.webpackTransitiveDeps);
// console.log(transitiveDepsReduced.length, 'out of', res.filter(e => e !== undefined).length);

async function processRepo(repo){

    
    if(!existsSync(path.join(HYBRID_CANDIDATES_ROOT, repo, 'package.json'))) {
        console.log(`Skipping MAINREPO ${repo} as package.json does not exist`);
        return;
    }
    const parsedPackageConfig = JSON.parse(fs.readFileSync(path.join(HYBRID_CANDIDATES_ROOT, repo, 'package.json'), 'utf-8'));
    // 1. load direct dependencies from package.json
    const directDeps = parsedPackageConfig?.dependencies??[];
    const directDepsSet = new Set(Object.keys(directDeps));

    const devDeps = parsedPackageConfig?.devDependencies??[];
    const devDepsSet = new Set(Object.keys(devDeps));



    // if(!existsSync(`../candidates-repos/node_modules_backup/node_modules_${repo}`)){
    //     console.log(`Skipping NODEBACKUP ${repo} as node_modules_backup does not exist`);
    //     if(existsSync(`../candidate-repos/${repo}/.node_modules`)){
    //         console.log(`However, .node_modules exists for ${repo}, so counting it as success`);
    //     }
    //     if(existsSync(`../candidate-repos/${repo}/node_modules_2`)){
    //         console.log(`However, .node_modules exists for ${repo}, so counting it as success`);
    //     }

    //     return;
    // }
    let backupPlace = null;
    const candidates = [
        // New default backup location used in this environment
        `../node_modules_backup/node_modules_${repo}`,
        // Original locations used in the paper/old scripts
        path.join(HYBRID_CANDIDATES_ROOT, 'node_modules_backup', `node_modules_${repo}`),
        path.join(HYBRID_CANDIDATES_ROOT, repo, 'node_modules_2'),
        path.join(HYBRID_CANDIDATES_ROOT, repo, '.node_modules'),
        path.join(HYBRID_CANDIDATES_ROOT, repo, 'node_modules')
    ]
    // console.log(candidates)
    for(const candidate of candidates){
        // console.log('Checking',candidate)
        if(existsSync(candidate)){
            // if(candidate!==candidates[0]){
            //     // console.log(`Warning: Using ${candidate} for ${repo}, this may not be a backup folder`);
            // }
            backupPlace = candidate;
            break;
        }
    }    
    if(backupPlace === null){
        console.log(`Skipping NODEBACKUP ${repo} as node_modules_backup does not exist`);
        return;
    }
    // console.log('selected',backupPlace)
    // 2. Get ground truth -> number of packages in node_modules_backup
    const allDeps = fs.readdirSync(backupPlace);
    const allDepsSet = new Set(allDeps);
    // console.log(allDepsSet)


    const groundTruthNumberOfTransitiveDeps = allDepsSet.size - directDepsSet.size - devDepsSet.size;
    // console.log(`Ground truth number of transitive dependencies for ${repo} is ${groundTruthNumberOfTransitiveDeps}`);
    // 3. load all keys from 'output/<repo_name>/ -> Webpack
    // first ensure it exists (use local output folder in this environment)
    if(!existsSync(`output/${repo}`)){
        // console.log(`Skipping ${repo} as WEBPACK does not exist`);
        return;
    }


    // then read all files in the directory, filter for only js files, this will give us the files we need to read
    const webpackTransitiveDeps = await extractTransitiveDependenciesFromWebPack(repo);
    // console.log(webpackTransitiveDeps)

    // 4. load all keys from 'dist/<repo_name>/ -> \oursolution{}
    if(!existsSync(`dist/${repo}`)){
        console.log(`Skipping ${repo} as dist does not exist`);
        return {
            repo,
            groundTruthNumberOfTransitiveDeps,
            // webpacklocation: `output/${repo}`,
            // ourSolutionLocation: `dist/${repo}`,
            
            webpackTransitiveDeps: webpackTransitiveDeps.size,
            ourSolutionTransitiveDeps: null
        }
    }

    const finalTransitiveDepsOurSolution = await retrieveTransitiveDepsFromRepoFromSliced(repo);

    // one final pass - removal all direct dependencies from both sets
    for(const d of directDepsSet){
        webpackTransitiveDeps.delete(d);
        finalTransitiveDepsOurSolution.delete(d);
    }

    // console.log(`For repo ${repo}:`);
    // // console.log(`\tGround truth number of transitive dependencies is ${groundTruthNumberOfTransitiveDeps}`);
    // console.log(`\tWebpack found ${webpackTransitiveDeps.size} transitive dependencies`);
    // console.log(`\tOur solution found ${finalTransitiveDepsOurSolution.size} transitive dependencies`);
    return {
        repo,
        groundTruthNumberOfTransitiveDeps,
        webpacklocation: `output/${repo}`,
        ourSolutionLocation: `dist/${repo}`,
        
        webpackTransitiveDeps: webpackTransitiveDeps.size,
        ourSolutionTransitiveDeps: finalTransitiveDepsOurSolution.size
    }



}
async function retrieveTransitiveDepsFromRepoFromSliced(repo) {
    const ourSolutionDepFolders = fs.readdirSync(`dist/${repo}`);
    const finalTransitiveDepsOurSolution = new Set();
    // now do the same as above, but instead, read the file dist/<repo>/index.cjs
    for (const folder of ourSolutionDepFolders) {
        const indexFilePath = path.join(`dist/${repo}`, folder, 'index.cjs');
        if (!existsSync(indexFilePath)) {
            console.warn(`Skipping ${indexFilePath} as it does not exist`);
            continue;
        }
        const content = await readFile(indexFilePath, 'utf-8');
        // all `require("../hybrid-candidates-repos/<repo>/..."` followed by anything that is not a quote or a space  should be recorded - this is a dependency file
        // conditions:
        // 1. "../hybrid-candidates-repos/object-copy/node_modules/function-bind/implementation.js": () => {}, -> REJECT
        // 2. "../hybrid-candidates-repos/glob-parent/node_modules/is-extglob/index.js": (m... -> ACCEPT
        // Accept only if the path contains 'node_modules' after the repo name and does not end with ': () => {},'
        const regex = / "\.\.\/(?:hybrid-)?candidates-repos\/[^/]+\/node_modules\/[^" ]+/g;
        // const regex = /"\.\.\/hybrid-candidates-repos\/[^" ]+/g;
        let matches = content.match(regex) ?? [];
        // Filter out matches that end with ': () => {},'
        matches = matches.filter(m => {
            const idx = content.indexOf(m);
            if (idx === -1) return false;
            const after = content.slice(idx + m.length, idx + m.length + 13);
            // console.log(JSON.stringify(after), after !== '": () => {},\n',m)
            return after !== '": () => {},\n';
        });
        // if(!matches) continue;
        // console.log('m',matches);
        const cleanedTransitiveDependencies = matches.map(m => m.slice(2).split('/')[4]).filter(e => e !== folder);
        // out of ../candidates-repos/<repo>/... part, retain only the repo
        cleanedTransitiveDependencies.forEach(d => finalTransitiveDepsOurSolution.add(d));
        // const usedInModule = new Set(cleanedMatches);
        // console.log(usedInModule);
        
    }
    return finalTransitiveDepsOurSolution;
}

async function extractTransitiveDependenciesFromWebPack(repo) {
    const webpackFiles = fs.readdirSync(`output/${repo}`).filter(f => f.endsWith('.bundle.cjs'));
    // read the files, extract all the keys of 
    // console.log(webpackFiles);
    const finalTransitiveDeps = new Set();
    for (const file of webpackFiles) {
        const filePath = path.join(`output/${repo}`, file);
        // strip the .bundle.cjs from the file name
        const mainDependencyName = file.replace('.bundle.cjs', '');

        const oldContent = await readFile(filePath, 'utf-8');
        const newFilePath = await useCachedOptimizedTerserModule(filePath,mainDependencyName, oldContent)

        const content = await readFile(newFilePath, 'utf-8');
        // all `require("../hybrid-candidates-repos/<repo>/..."` followed by anything that is not a quote or a space  should be recorded - this is a dependency file
        const regex = /"\.\.\/(?:hybrid-)?candidates-repos\/[^" ]+/g;
        const matches = content.match(regex) ?? [];
        // if(!matches) continue;
        // console.log(matches);
        const cleanedTransitiveDependencies = matches.map(m => m.slice(1).split('/')[4]).filter(e => e !== mainDependencyName);
        // out of ../candidates-repos/<repo>/... part, retain only the repo
        cleanedTransitiveDependencies.forEach(d => finalTransitiveDeps.add(d));
        // const usedInModule = new Set(cleanedMatches);
        // console.log(usedInModule);
    }
    return finalTransitiveDeps
}

/**
 * 
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