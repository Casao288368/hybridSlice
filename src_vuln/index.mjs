import { readFile } from "fs/promises";
import { cacheFunctionOutput } from "../src_dataset/cache.mjs";
import { bifurcateArray, getGithubTokenFromEnvironment } from "./lib.mjs";
import { getMinimalParentRepoMap, findSlicedDeps } from "./slicedeps.mjs";
import { basename } from "path";
import setIntersect from 'set.prototype.intersection'
const githubToken = getGithubTokenFromEnvironment();
import {stringify} from 'csv/sync'
import { writeFileSync } from "fs";

const vulnTargets = await findSlicedDeps();

console.log(vulnTargets.size, "sliced deps found");

const res = await cacheFunctionOutput('advisories.json', async () => {

    const affectsArray = [...vulnTargets];
    const part1 = affectsArray.slice(0,500);
    const part2 = affectsArray.slice(500)

    const advisories = [];
    for(const part of [part1,part2]){
        const x = await fetchAdvisoryForAffects(part);
        // console.log(x);
        advisories.push(...x);
    }
    return advisories;
},true, true);

const cveMap = res.map(e=>({
        summary: e.summary,
        source: e.source_code_location,
        severity: e.severity,
        repo_name: basename(e.source_code_location),
        cve: e.cve_id,
        // identifiers: e.identifiers,
        // cvss: e.cvss,
    }));

const [cvesWithASource,emptyMap]= bifurcateArray(cveMap, (e)=>e.source)

/** @typedef {{summary:string,source:string|undefined,severity: string, repo_name: string}} CVEEntrySimple */
// const slicedReposSoFar = await findSlicedDepsSoFar();
/** @type {Map<string,CVEEntrySimple>} */
const vulnerableDependenciesNameCVEMap = new Map();
for(const cveData of cvesWithASource){
    if(!vulnerableDependenciesNameCVEMap.has(cveData.repo_name)) {
        vulnerableDependenciesNameCVEMap.set(cveData.repo_name, []);
    }
    vulnerableDependenciesNameCVEMap.get(cveData.repo_name).push(cveData);
}
const depKeys = ([...vulnerableDependenciesNameCVEMap.keys()])
// console.log(depKeys)
const parentDependencyVulnMapping = await getMinimalParentRepoMap(depKeys);
const vulnerableParentKeys = new Set([...parentDependencyVulnMapping.keys()]);
console.log(vulnerableParentKeys.size, 'repos found with CVE-ridden direct dependencies');



const successRepos = new Set((await readFile('success.txt')).toString().trim().split('\n'));
// console.log("success with ",successRepos.size)
/**
 * @type {Set<string>}
 */
const successfulVulnerableParents = setIntersect(successRepos,vulnerableParentKeys)
// console.log("Anything right now? ",JSON.stringify([...successfulVulnerableParents]))


const parentToDepVulnerabilityMap = new Map([...successfulVulnerableParents].map(e=>
    [e,parentDependencyVulnMapping.get(e).flatMap(f=>vulnerableDependenciesNameCVEMap.get(f)??[])]
))
// console.log(parentToDepVulnerabilityMap)

// flattened
/** @type {[string,CVEEntrySimple][]} */
const flattenedParentToDepVulnerabilityMapEntries = [...parentToDepVulnerabilityMap.entries()].flatMap(([k,vs])=>(vs.map(v=>([k,v]))));

/** @typedef {CVEEntrySimple & {main_repo:string}} CVEDepEntry */
/** @type {CVEDepEntry[]} */
const flattenedParentToDepVulnerabilityList = flattenedParentToDepVulnerabilityMapEntries.map(([k,v])=>({...v,main_repo:k}))

// console.log(flattenedParentToDepVulnerabilityList)

// make csv and write to file using csv library
const op = stringify(flattenedParentToDepVulnerabilityList,{header:true})
writeFileSync('vulnerability_report.csv',op);
// console.log(op)

async function fetchAdvisoryForAffects(affectsArray) {
    const affects = affectsArray.join(',');
    const query = `?ecosystem=npm&affects=${encodeURIComponent(affects)}`;
    // console.log('query',query);
    const res = await fetch('https://api.github.com/advisories' + query,
        {
            headers: {
                Authorization: `Bearer ${githubToken}`,
            }
        }
    );
    const x = await res.json();
    return x;
}

