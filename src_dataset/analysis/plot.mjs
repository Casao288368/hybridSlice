import dc from 'download-counts' with {type: 'json'}
import ossLicensesSet from 'spdx-license-list/simple.js' 
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {parse} from 'csv/sync'
import parseLicense from 'spdx-expression-parse'
import { hasAnyActualDependencies, isUnwantedProject } from '../mine.mjs';
import {plot} from 'nodeplotlib'

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_REPOS_ROOT = resolve(__dirname, '../../cache-repos/repos');


const repos = await readFile('./minableRepositories3.csv','utf-8');
const parsed = parse(repos);
console.log("CSV Files",parsed.length);
const vals = parsed.map(e=>e[0]).filter(e=>(!e.startsWith("#"))).filter(e=>existsSync(resolve(CACHE_REPOS_ROOT, e, 'package.json')));

console.log("Exists list",vals.length);

const reposContents = await Promise.all(vals.map(e => readFile(resolve(CACHE_REPOS_ROOT, e, 'package.json'), 'utf-8')));
const repoZip = reposContents.map((e, i) => [vals[i], e]);


const packages = repoZip
                    .map(([name,packageJson]) => ([name,JSON.parse(packageJson)]))
                    .filter(e => !e[0].startsWith("@types/"))
                    .filter(e => !e[0].startsWith("@webassemblyjs/"))
                    .filter(([name,packageJson])=>(hasAnyActualDependencies(packageJson,name)))
                    .filter(e=>!isUnwantedProject(e[1]))
                    .map(e=>dc[e[0]])
                    ;

console.log(packages.length);

const trace = {
  x: packages.map((e,i)=>i),
  y: packages,
  type: 'scatter',
};

plot([trace]);