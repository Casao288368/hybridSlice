import dc from 'download-counts' with {type: 'json'}
import ossLicensesSet from 'spdx-license-list/simple.js' 
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {parse} from 'csv/sync'
import parseLicense from 'spdx-expression-parse'
import { hasAnyActualDependencies, isUnwantedProject } from '../mine.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_REPOS_ROOT = resolve(__dirname, '../../cache-repos/repos');
// const keys = Object.keys(dc);
// /** @type {number[]} */
// let vals = keys.map(e=>dc[e]);

// vals = vals.filter(e=>e>1);
// vals.sort((a,b)=>(a-b));
// console.log("sorted")
// const plotKeys = vals.map((e,i)=>(i));
// // const logVals = vals.map(e=>(Math.log10(e)));

// const trace = {
//   x: plotKeys,
//   y: vals,
//   type: 'scatter',
// };


// plot([trace]);
const repos = await readFile('./minableRepositories3.csv','utf-8');
const parsed = parse(repos);

console.log("CSV Files",parsed.length);
const vals = parsed.map(e=>e[0]).filter(e=>(!e.startsWith("#"))).filter(e=>existsSync(resolve(CACHE_REPOS_ROOT, e, 'package.json')));
console.log("Exists list",vals.length);

// await licensesForRepoList(vals);

console.log('---- BREAK ----')
// const successfulRepos = await readFile('./success.txt','utf-8');
// // const successfulRepos = await readFile('../candidates-repos/coverage/success.txt','utf-8');
// const successfulReposList = successfulRepos.split('\n').filter(e=>(e.trim())).filter(e=>(!e.startsWith("#"))).filter(e=>existsSync(resolve(CACHE_REPOS_ROOT, e, 'package.json')));
const [licenseKeys,licenses] = await licensesForRepoList(vals, false);

function matchesOSSLicense(e) {
        let matches = false;
        try {
            parseLicense(e);
            matches = true;
        }
        catch { }
        return matches;
    }
const matches = licenseKeys.map(matchesOSSLicense) // true
// console.log(matches)

const matchesZipped = licenseKeys.map((e,i)=>[e,matches[i]])
// console.log(matchesZipped)

// console.log(licenseKeys)
const totalCount = (licenseKeys)
                    .map((e,i)=>((matchesZipped[i][1])?licenses[e].length:0))
                    .reduce((a,b)=>(a+b),0);
console.log(totalCount)
/**
 * 
 * @param {string[]} vals 
 * @param {boolean} fullPrint
 */
async function licensesForRepoList(vals, fullPrint = false) {
    const reposContents = await Promise.all(vals.map(e => readFile(resolve(CACHE_REPOS_ROOT, e, 'package.json'), 'utf-8')));
    const repoZip = reposContents.map((e, i) => [vals[i], e]);
    const licenses = repoZip.map(([name,packageJson]) => ([name,JSON.parse(packageJson)])).filter(e => !e[0].startsWith("@types/")).filter(e => !e[0].startsWith("@webassemblyjs/")).filter(([name,packageJson])=>(hasAnyActualDependencies(packageJson,name))).filter(e=>!isUnwantedProject(e[1])).map(([name,packageJson])=>([name,packageJson.license])).reduce((acc, [name,license]) => {
        if (license in acc) {
            acc[license].push(name) ;
        } else {
            acc[license] = [name];
        }
        return acc;
    }, {});
    
    if(fullPrint){
        // console.log(licenses);
    }else{
        // Object.keys(licenses).forEach(license => {
        //     console.log(license, licenses[license].length);
        // });
    }
    return [Object.keys(licenses),licenses];
}
// // console.log(reposContents.length)
// // console.log(reposContents[0])
