import { Project } from 'ts-morph';
import path from 'node:path';
import { sliceAndWriteCalls } from '../src/index.mjs';
import { getImportCallsAndArgumentTypes } from '../src/tsCalls.mjs';
import { LibraryTypesRecorder } from '../src/libcalls.mjs';

function constructJavascriptGlobInFolder(folderPath) {
  return [
    ['**/*.js', true],
    ['**/*.mjs', true],
    ['**/*.cjs', true],
    ['**/*.d.ts', false],
    ['**/*.ts', true],
    ['**/node_modules/**', false],
    ['**/dist/**', false],
    ['**/build/**', false],
    ['**/out/**', false],
    ['**/coverage/**', false],
    ['**/test/**', false],
    ['**/tests/**', false],
    ['**/__tests__/**', false],
    ['**/__mocks__/**', false],
    ['**/test.js', false],
    ['**/tests.js', false],
  ].map(([glob, include]) => {
    const prefix = include ? '' : '!';
    return prefix + path.resolve(folderPath, glob);
  });
}

async function main() {
  const folderPath = process.argv[2];
  if (!folderPath) {
    console.error('Usage: node aigenerate/run-slicer.mjs <project_path>');
    process.exit(1);
  }

  console.log('[SafeImport] started', folderPath);

  const project = new Project({ compilerOptions: { allowJs: true, checkJs: false } });
  project.addSourceFilesAtPaths(constructJavascriptGlobInFolder(folderPath));

  const sourceFiles = project.getSourceFiles();
  const checker = project.getTypeChecker();
  const libraryTypesRecorder = new LibraryTypesRecorder(checker);

  console.log(`Source files found: ${sourceFiles.length}`);
  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();
    console.log(`[analyzer] Processing file: ${filePath}`);
    const importDecls = sourceFile.getImportStringLiterals();
    getImportCallsAndArgumentTypes(importDecls, checker, filePath, libraryTypesRecorder);
  }

  const callMap = libraryTypesRecorder.generateAllArgumentsForRecordedCalls();
  const moduleBaseName = path.basename(folderPath);
  await sliceAndWriteCalls(callMap, folderPath, moduleBaseName);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

