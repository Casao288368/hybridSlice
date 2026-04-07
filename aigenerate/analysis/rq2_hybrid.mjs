
// rq2
// iterate through success.txt, and gather tree stats and cloc stats

import { readFile ,writeFile, rename} from "fs/promises";
import {promisify} from 'node:util'
import { exec } from 'node:child_process';
import { processPromisesBatch } from "../batch.mjs";
import { cacheFunctionOutput } from "../cache.mjs";
import {stringify} from 'csv/sync'
// import {  existsSync, } from "node:fs";
// import { getTreeStatsOfProject } from "../../src_deptree/index.mjs";
const execP = promisify(exec);


const text = (await readFile('success.txt')).toString();

const repos = text.trim().split('\n');

const repoCountsCached = await cacheFunctionOutput('repoClocCounts.json',async ()=>{
    const repoCounts = await processPromisesBatch(repos,64,getData);
    return repoCounts;
},true, true);
// console.log(repoCountsCached)

// console.log(x)
const vals = repoCountsCached.map((v,i)=>{
    return [repos[i],v?.baseline?.code,v?.webpack?.code,v?.slicejs?.code]
})


const valsString = stringify(vals,{header:true,columns:['repo','baselineLines','webpackLines','slicejsLines']})




// console.log(valsString)
await writeFile('success_cloc_stats.csv',valsString)

/**
 * Run cloc --json on the repo, and return the json parsed.
 * @param {string} repo 
 */
async function getData(repo){
    const baseline = execP(`cloc --json output/${repo} --exclude-ext=optimized.cjs | jq "{nFiles:.JavaScript.nFiles,code:.JavaScript.code}"`)
    // this is webpacked code
    const e1Promise = execP(`cloc --json output/${repo} --exclude-ext=bundle.cjs | jq "{nFiles:.JavaScript.nFiles,code:.JavaScript.code}"`)
    // this is sliced code
    const e2Promise = execP(`cloc --json dist/${repo} | jq "{nFiles:.JavaScript.nFiles,code:.JavaScript.code}"`)
    // const e3Promise = verifyTreeStats(repo);
    const [{stdout: webpackStdout},{ stdout:slicejsStdPost },{stdout:baselineStdOut}] = await Promise.all([e1Promise,e2Promise, baseline]);
    // console.log("haha",repo)
    /** @typedef {{nFiles:number|null,code:number|null}} CodeInfo */
    /** @type {CodeInfo} */
    const webpackObj = JSON.parse(webpackStdout);
    /** @type {CodeInfo} */
    const slicejsObj = JSON.parse(slicejsStdPost);
    /** @type {CodeInfo} */
    const baselineObj = JSON.parse(baselineStdOut);

    if(webpackObj.code===null && slicejsObj.code!==null){
        console.error("BRO WHAT",repo);
    }
    return {repoName: repo,webpack:webpackObj,slicejs:slicejsObj,baseline:baselineObj};
}
