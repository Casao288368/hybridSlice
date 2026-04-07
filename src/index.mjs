

import { readFileSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { Project } from 'ts-morph';
import { getSliceWithJoern } from './joernSlice.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getImportCallsAndArgumentTypes, isNodeModule, isRelativeModule, logCallList } from './tsCalls.mjs';
import { wpCompress } from './bundle/index.mjs';
import { LibraryTypesRecorder } from './libcalls.mjs';
import { withTimeout } from './timeout.mjs';
/**
 * 
 * @param {ReturnType<LibraryTypesRecorder['generateAllArgumentsForRecordedCalls']>} calls 
 * @param {string} folderPath
 * @param {string} rootModule
 */
const WP_COMPRESS_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export async function sliceAndWriteCalls(calls, folderPath, rootModule) {
    const writePromises = [];

    for (const [moduleName, callBox] of calls) {
        if (isRelativeModule(moduleName) || isNodeModule(moduleName)) { // not relative module
            // console.warn(`Skipping module ${moduleName} - relative or inbuilt Node.js module`);
            continue;
        }
        console.log(`Slicing module ${moduleName} - ${callBox.size} calls`);

        try {
            console.log("[wp] Compressing module", moduleName);
            const relatedModuleNamePath = await withTimeout(
                wpCompress(moduleName, folderPath),
                WP_COMPRESS_TIMEOUT_MS,
                `wpCompress(${moduleName}) in ${folderPath}`
            );
            const fileSource = readFileSync(relatedModuleNamePath).toString('utf-8');

            const { slicedCode } = await getSliceWithJoern(
                fileSource,
                (moduleExports) => {
                    return [...callBox.entries()].flatMap(([methodName, methodArgsList]) => {
                        const methodNameNormed = methodName.substring(1);
                        return methodArgsList.map(methodArgsList => {
                            const methodObj = (methodNameNormed === '') ? moduleExports : moduleExports[methodNameNormed];
                            if (methodObj === undefined) {
                                console.warn(`Method ${methodNameNormed} not found in module ${moduleName}`);
                                return;
                            }
                            try {
                                methodObj.apply(moduleExports[methodNameNormed], methodArgsList);
                            } catch (e) {
                                console.warn(`Error calling method ${methodNameNormed} with args ${methodArgsList} in module ${moduleName}`, e);
                                return;
                            }
                        });
                    });
                },
                relatedModuleNamePath
            );

            const writePath = path.resolve('./dist', rootModule, moduleName, 'index.cjs');
            if (writePath === moduleName) {
                throw Error("Unexpected Directory rewrite. Not allowed.");
            }
            const { packageJsonFilePath, packageJsonFileContentsString } = createPackageJsonForModule(moduleName, writePath);

            mkdirSync(path.dirname(writePath), { recursive: true });
            console.log(`Writing module '${moduleName}' to '${writePath}'`);

            writePromises.push(
                writeFile(packageJsonFilePath, packageJsonFileContentsString),
                writeFile(writePath, slicedCode)
            );
        } catch (e) {
            console.warn(`Skipping module ${moduleName} due to slicing/compression error`, e);
            continue;
        }

    }

    Promise.all(writePromises).then(p => {
        // console.log("write finished");
    }).catch(console.log);
}

function createPackageJsonForModule(moduleName, writePath) {
    const packageJsonFileContents = {
        "name": moduleName,
        "version": "1.0.0",
        "main": "index.cjs",
        "scripts": {
            "test": "echo \"Error: no test specified\" && exit 1"
        },
        "author": "",
        "license": "ISC",
        "description": ""
    };
    const packageJsonFileContentsString = JSON.stringify(packageJsonFileContents, null, 2);
    const packageJsonFilePath = path.resolve(path.dirname(writePath), 'package.json');
    return { packageJsonFilePath, packageJsonFileContentsString };
}

// is-glob WORKED
/**
 * 
 * @param {string} filePath 
 */
function driver(folderPath = './test_src') {
    // const FILE_PATH = './test_src/index.cjs';

    const project = new Project({ compilerOptions: { allowJs: true, checkJs: false, } });

    const scriptGlobs = constructJavascriptGlobInFolder(folderPath)
    project.addSourceFilesAtPaths(scriptGlobs);
    const sourceFiles = project.getSourceFiles()

    const libraryTypesRecorder = new LibraryTypesRecorder(project.getTypeChecker());
    // const project = tsc.createProgram([FILE_PATH],);
    const checker = project.getTypeChecker();
    console.log(`Source files found: ${sourceFiles.length}`);
    for (const sourceFile of sourceFiles) {
        const filePath = sourceFile.getFilePath();
        console.log(`[analyzer] Processing file: ${filePath}`);
        
        const importDecls = sourceFile.getImportStringLiterals()
        // foreach library, get a list of import calls
        
        getImportCallsAndArgumentTypes(importDecls, checker, filePath,libraryTypesRecorder);
    }

    const callMap = libraryTypesRecorder.generateAllArgumentsForRecordedCalls();

    const moduleBaseName = path.basename(folderPath);
    // logCallList(callMap, folderPath);
    sliceAndWriteCalls(callMap, folderPath,moduleBaseName).then(() => {
        console.log("Slicing and writing calls done");
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const run = () => {
        try {
            if (process.argv.length > 2 && process.argv[2] !== '') {
                console.log(`[SafeImport] started ${process.argv[2]}`);
                driver(process.argv[2]);
            } else {
                console.log('[SafeImport] started');
                driver();
            }
        } catch (e) {
            // 保证单个仓库的分析/切片异常（如 ts-morph 的 RangeError）
            // 不会让整个批处理崩溃。这里记录错误并以 0 退出，
            // 由上层脚本决定如何标记该仓库的失败类型。
            console.warn('[HybridSlice] driver failed, skipping repository due to analyzer error', e);
            process.exit(0);
        }
    };
    run();
}


/**
 * 
 * @param {string} folderPath 
 * @returns {string[]}
 */
function constructJavascriptGlobInFolder(folderPath) {
    return [
        ["**/*.js", true],
        ["**/*.mjs", true],
        ["**/*.cjs", true],
        ["**/*.d.ts", false],
        ["**/*.ts", true],
        ["**/node_modules/**", false],
        ["**/dist/**", false],
        ["**/build/**", false],
        ["**/out/**", false],
        ["**/coverage/**", false],
        ["**/test/**", false],
        ["**/tests/**", false],
        ["**/__tests__/**", false],
        ["**/__mocks__/**", false],
        ["**/test.js", false],
        ["**/tests.js", false],
    ].map(glob => {
        const prefix = glob[1] ? '' : '!';
        return prefix+path.resolve(folderPath, glob[0])});
}

