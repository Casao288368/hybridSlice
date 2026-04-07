import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 
 * @template T
 * @param {string} fileName 
 * @param {()=>Promise<T>} asyncCallback 
 * @param {boolean} silent
 * @param {boolean} passthrough If true, store in cache and always call the function
 * @returns {Promise<T>}
 */
export async function cacheFunctionOutput(fileName, asyncCallback, silent=false,passthrough=false) {
    const fileLoc = resolve(__dirname, '../cache-repos', fileName);
    if (!passthrough && existsSync(fileLoc)) {
        !silent && console.log("[cacher] Using cached ", fileLoc);
        const fileContents = (await readFile(fileLoc)).toString();
        return JSON.parse(fileContents);
    } else {
        !silent && console.log("[cacher] cache miss")
        const returnRes = await asyncCallback();
        const fileContents = JSON.stringify(returnRes);
        await writeFile(fileLoc,fileContents);
        !silent && console.log("[cacher] saved ",fileLoc)
        return returnRes;
    }
}