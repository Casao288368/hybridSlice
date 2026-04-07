// @ts-check
import { writeFile,open } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 
 * @template T
 * @template U
 * @param {T[]} items 
 * @param {number} limit 
 * @param {(T)=>Promise<U>} asyncCallback 
 * @param {boolean} writeLogs
 * @returns {Promise<U[]>}
 */
export async function processPromisesBatch(
    items,
    limit,
    asyncCallback,
    writeLogs= false
) {
    const results = [];
    const fileHandle = await open(resolve(__dirname, "../cache-repos/progress.txt"),"w+");
    for (let start = 0; start < items.length; start += limit) {
        const end = start + limit > items.length ? items.length : start + limit;

        const slicedResults = await Promise.all(items.slice(start, end).map(asyncCallback));

        // console.log(`[batch] finished batch [${start},${end})`)
        results.push(...slicedResults);
        if(writeLogs){
            await writeFile(fileHandle,transformRes(slicedResults),{flush:true});
        }
    }
    fileHandle.close();

    return results;
}


/**
 * @template T
 * @param {Array<T>} results 
 * @returns {string}
 */
function transformRes(results){
    let str = ""
    for(const x of results){
        str += JSON.stringify(x)+'\n';
    }
    return str;
}