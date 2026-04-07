import wp from 'webpack';
import path from 'node:path'
import {createRequire,builtinModules} from 'node:module'
import { mkdirSync } from 'node:fs';

/**
 * 
 * @param {string} l library name
 * @param {string} moduleLocation module location
 * @param {string} outputPath 
 * @returns the compressed file path
 */
export function wpCompress(l, moduleLocation,outputPath = path.resolve('./output/')) {
    const basePackage = path.basename(path.resolve(moduleLocation));
    const finalOutputPath = path.resolve(outputPath, basePackage);
    mkdirSync(finalOutputPath, { recursive: true });
    return new Promise((resolve, reject) => {
    
    const libraryLocation = extractFunctionForModule(l, moduleLocation);
    // console.log(libraryLocation);
    const outputFile = l + '.bundle.cjs';
    console.log(`[WebPack] Compressing ${l} in ${moduleLocation} to ${path.join(finalOutputPath, outputFile)}`);
    const moduleFallbackMap = builtinModules.reduce((prev, current) => {
        prev[current] = current;
        return prev;
    }, {});
    wp({
        entry: libraryLocation,
        mode: 'production',
        optimization: {
            mangleExports: false,
            avoidEntryIife: true,
            minimize: false,
            moduleIds: 'named',
            concatenateModules: true,

        },
        resolve:{
            modules: [path.join(moduleLocation,'./node_modules')],
            // fallback:moduleFallbackMap
        },
        externals:moduleFallbackMap,
        output: {
            path: finalOutputPath,
            filename: outputFile,
            clean: false,
            iife: false,
            library: {
                type: 'commonjs2',
                // name: l
            }
            // module: true
        },
    }, (err, stats) => {
        if (err || stats.hasErrors()) {
            console.error(`[WebPack] Error encountered`);
            // console.log(`[WebPack]`,stats?.toJson().errors);
            reject(err || stats);
        }else{
            resolve(path.resolve(finalOutputPath, outputFile));
        }
    });
});
}
function extractFunctionForModule(l, moduleLocation) {
    const moduleLocationPath = path.resolve(moduleLocation,'package.json');
    const require = createRequire(moduleLocationPath);
    const resolved = require.resolve(l)
    return resolved;
}

