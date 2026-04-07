import { parseScript} from 'esprima';
import fs from 'node:fs';
import * as eslintScope from 'eslint-scope';
import { prependString, appendString } from '../utils/constants.mjs';

// const modulesImported
/**
 *
 * @param {string} filePath
 * @returns
 */
export function getASTAndScope(filePath) {
    const mod = fs.readFileSync(filePath);


    const modString = mod.toString();

    const nodeJSCJSModString = prependString + modString + appendString;

    const parseOptions = { ecmaVersion: 7, range: true, sourceType: 'script', comment: true };


    const parsedModAST = parseScript(nodeJSCJSModString, parseOptions);


    // https://eslint.org/docs/latest/extend/scope-manager-interface#fields-1
    // handle cjs ourselves
    const scopeManager = eslintScope.analyze(parsedModAST, { ...parseOptions, nodejsScope: false });
    return { scopeManager, parsedModAST };
}

/**
 *
 * @param {import('eslint').Scope.ScopeManager} scopeManager
 * @returns
 */
export function getSetOfIdentifierReferencesForRequireUses(scopeManager) {
    const requireImportsUsed = scopeManager.scopes[1].set.get('require');

    return new Set(requireImportsUsed.references.map(e => e.identifier));
}

