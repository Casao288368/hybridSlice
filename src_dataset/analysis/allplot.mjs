import dc from 'download-counts' with {type: 'json'}
import ossLicensesSet from 'spdx-license-list/simple.js' 
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import {parse} from 'csv/sync'
import parseLicense from 'spdx-expression-parse'
import { hasAnyActualDependencies, isUnwantedProject } from '../mine.mjs';
import {plot} from 'nodeplotlib'


const repos = Object.keys(dc);
console.log('Original',repos.length)
const sortedRepos = repos.map(e=>dc[e]).sort((a,b)=>{return a-b;}).filter(e=>e>10 && e<100_000);

const xs = new Array(sortedRepos.length).fill(0).map((e,i)=>i);


console.log('Filtered',xs.length);
plot([{x:xs,y:sortedRepos}])