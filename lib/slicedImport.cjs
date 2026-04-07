// import path from 'node:path';
// import {} from '../src/index.mjs'
// import {createRequire} from 'node:module'
const path = require('node:path')
const {pathToFileURL} = require('node:url')
const {createRequire,findPackageJSON} = require('node:module');


/*
    Base Requirements:
    - Should work in atleast CJS contexts.
 */

/**
 * 
 * @param {string} modulePath 
 */
function slicedImport(modulePath, projectRoot=process.cwd()) {
    const moduleDistPath = process.env.SLICED_DIST_PATH
        || path.resolve(__dirname, '../dist');
    // const executingModuleName = path.basename(path.resolve(modulePath));
    // console.log(requestedModulePath)
    // TODO - use something other than the cwd
    const packageFileLocation = projectRoot?? findPackageJSON(pathToFileURL( require.main.filename))
    if(packageFileLocation===null||packageFileLocation===undefined) {
        throw new Error("Could not find package.json in the current working directory or any of its parent directories. Please provide a valid project root.");
    }
    const dirname = path.basename( path.dirname(packageFileLocation))
    
    const requestedModulePath = path.resolve(moduleDistPath, dirname, 'index.cjs');
    console.log("requesting module",requestedModulePath)
    const x = createRequire(requestedModulePath);
    return x(modulePath);
}
module.exports.slicedImport = slicedImport;
// const x = safeImport('parsejson');
// console.log("x",x);