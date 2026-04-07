import { existsSync, } from 'fs'
import { lstat, readFile,rm, appendFile } from 'fs/promises'
import git from 'git-client'
import { resolve, dirname } from 'path'
import { fileURLToPath } from "url";
import int from 'set.prototype.intersection';
import { matchFilterList } from './FILTER_LIST.mjs';
import npmapi from 'npm-api'
import { cacheFunctionOutput } from './cache.mjs';
import parseLicense from 'spdx-expression-parse'

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_REPOS_ROOT = resolve(__dirname, '../cache-repos/repos');
/**
 * 
 * @param {[string,string,number]} param0 
 * @returns {Promise<[string,string|null]>} second argument is null if ineligible for slicing
 */
export async function cloneRepoAndCheck([repoName, repoGitUrl, downloadCount]) {
    const repoPath = resolve(CACHE_REPOS_ROOT, repoName)

    if (filterRepo(repoGitUrl)) {
        // console.log("[git] ignoring ", repoName)
        return [repoName, null]
    };
    // console.log('[git] fetching',repoName, repoGitUrl);
    let api = new npmapi();
    const repo = api.repo(repoName);

    let packageJSONContentsString = null;

    try{
        packageJSONContentsString = await cacheFunctionOutput(`cache-repo-package-json-${repoName.replaceAll('/',"_sl_")}.json`,async ()=>{
            // console.log(`[npm] fetching package.json for ${repoName} from npm`);
            const packageJson = await repo.package();
            return JSON.stringify(packageJson);
        },true);
        // console.log("[git] fetched package.json for", repoName);
    }catch(e){
        throw new Error(`Failed to fetch package.json for ${repoName} from npm: ${e.message}, gitrepoUrl ${repoGitUrl}`);
    }

    if (packageJSONContentsString === undefined || packageJSONContentsString === null) {
        throw new Error(`Failed to fetch package.json for ${repoName} from npm`);
    // console.log("[git] checking", repoName, "for dependencies at ", packageFile);
    // const packageJSONContentsString = (await readFile(packageFile)).toString()
    }

    // console.log(packageJSONContentsString);
    const packageJSONContents = JSON.parse(packageJSONContentsString)
    // console.log(repoName, packageJSONContents.license)
    if (!hasAnyActualDependencies(packageJSONContents, repoName)) {
        // console.log("[git] skipping", repoName, "has no dependencies");
        await removeUnnecessaryClone(repoPath);
        // console.log("Cleaned up ", repoPath);
        return [repoName, null];
    }

    if(isUnwantedProject(packageJSONContents)) {
        await removeUnnecessaryClone(repoPath);
        // console.warn("[git] Ignoring ", repoName, "because it is a typescript project.");
        // console.log("Cleaned up ", repoPath);
        return [repoName, null];
    }

    const hasDependencies = checkTestingDependencies(packageJSONContents, repoName);
    if (hasDependencies) {
        const gotCloned = await cacheCloneIdempotently(repoPath, repoName, repoGitUrl);
        if (!gotCloned) {
            console.warn("[git] Failed to clone ", repoName, "at", repoGitUrl);
            return [repoName, null];
        }

        const tsConfigFileLocation = resolve(repoPath, 'tsconfig.json');
        const tsConfigFileExists = existsSync(tsConfigFileLocation);
        if (tsConfigFileExists){
            // console.warn("[git] Ignoring ", repoName, "because it has a tsconfig.json file.");
            return [repoName, null];
        }
        const packageFile = resolve(repoPath, 'package.json')
        if (!existsSync(packageFile)){
            // console.warn("[git] Unexpected package.json not found in", repoName, "at", packageFile);
            return [repoName, null];}

        // finally, return the test script if it exists
        return [repoName, ((packageJSONContents?.scripts?.test))]
    }
    else{
        await removeUnnecessaryClone(repoPath);

        return [repoName, null]
    }
}
/**
 * Filter by packages
 * @param {string} packageName
 */
function filterPackage(packageName){
    return packageName.startsWith('typescript') || packageName.startsWith('node-gyp')
}



function matchesOSSLicense(e) {
        let matches = false;
        try {
            parseLicense(e);
            matches = true;
        }
        catch { }
        return matches;
}
export function isUnwantedProject(packageJSONContents) {
    // Is typescript project?
    if (packageJSONContents.devDependencies !== undefined) {
        if (Object.keys(packageJSONContents.devDependencies).some(filterPackage)) {
            return true;
        }
        if (packageJSONContents.dependencies !== undefined && Object.keys(packageJSONContents.dependencies).some(filterPackage)) {
            return true;
        }
    }

    if(packageJSONContents.license === undefined || packageJSONContents.license === null || packageJSONContents.license === ""){
        // console.log("Undefined License")
        return true;
    }
    if(!matchesOSSLicense(packageJSONContents.license)){
        // console.log("Non OSS license", packageJSONContents.license)
        return true;
    }
    return false;
}
async function removeUnnecessaryClone(repoPath) {
    if(existsSync(repoPath)){
         console.log("[git] unnecessary clone, removing", repoPath) ;
        //  while(true){}
        await rm(repoPath, { recursive: true, force: true });
    }
}

function filterRepo(repoGitUrl) {
    return matchFilterList(repoGitUrl);
}

export function hasAnyActualDependencies(packageJSONContents, repoName) {
    if (packageJSONContents.dependencies !== undefined && Object.keys(packageJSONContents.dependencies).length > 0) {
        return true;
    }
    return false;
}

function checkTestingDependencies(packageJSONContents, repoName) {
    const testingLibraries = new Set(['mocha','jest']);
    const dependencies = new Set();
    if (packageJSONContents.dependencies !== undefined) {
        for (const dep of Object.keys(packageJSONContents.dependencies)) {
            dependencies.add(dep)
        }
    }
    if (packageJSONContents.devDependencies !== undefined) {
        for (const dep of Object.keys(packageJSONContents.devDependencies)) {
            dependencies.add(dep)
        }
    }

    // console.log(dependencies)
    /**
     * @type {Set}
     */
    const x = int(testingLibraries, dependencies);
    // console.log(`join`, x)
    return x.size > 0;

}

async function cacheCloneIdempotently(repoPath, repoName, repoGitUrl) {
    if (existsSync(repoPath)) {
        const isDir = (await lstat(repoPath)).isDirectory()
        if (!isDir) {
            throw new Error(repoName, " is mangled. delete directory and re-clone.")
        }
        const gitPath = resolve(repoPath,'.git')
        if(existsSync(gitPath)){
            // console.log('[git] useless .git at '+gitPath+', cleaning up');
            await rm(gitPath,{recursive:true});
        }
        return true;
    } else {
        // console.log("[git] cloning", repoGitUrl);
        try{
            await git.clone(repoGitUrl, repoPath, { 'single-branch': true, depth: 1 })
            const gitPath = resolve(repoPath,'.git')
            if(existsSync(gitPath)){
                // console.log('[git] useless .git at '+gitPath+', cleaning up');
                await rm(gitPath,{recursive:true});
            }
            return true;
        }catch(e){
            // console.log(e.message)
            await appendFile('ignores.txt',repoGitUrl+'\n')
            return false;
        }
    }
}
