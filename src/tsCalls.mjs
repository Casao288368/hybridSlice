// @ts-check
import path from 'path';
import tsm, { Identifier, ImportSpecifier, StringLiteral, SyntaxKind, ts, } from 'ts-morph';
import { LibraryTypesRecorder } from './libcalls.mjs';
import {builtinModules} from 'node:module'

/**
 * 
 * @param {tsm.StringLiteral[]} importDecls
 * @param {tsm.TypeChecker} checker
 * @param {string} mainFilePath Main file path for the script being analyzed
 * @param {LibraryTypesRecorder} libraryTypesRecorder recorder to use for library calls
 * @returns {LibraryTypesRecorder} instance of recorded library calls
 * 
 */
export function getImportCallsAndArgumentTypes(importDecls, checker, mainFilePath, libraryTypesRecorder) {
    // const libraryTypesRecorder = new LibraryTypesRecorder(checker);
    for (const importStringDecl of importDecls) {

        // console.log(importStringDecl);
        const importDecl = importStringDecl.getFirstAncestor();
        const packageName = importStringDecl.getLiteralValue();
        if(isNodeModule(packageName)) {
            // just skip node module scanning.
            continue;
        }
        if (importDecl === undefined) {
            console.error("Import declaration is undefined for", importStringDecl.getText());
            continue;
        }
        if (importDecl.isKind(SyntaxKind.CallExpression)) {
            // the declaration is callExpression. Verify its based an identifier aliasing import or require
            const importExpr = importDecl.getExpression();
            const type = checker.getTypeAtLocation(importExpr);
            // console.log("Type of import expression", checker.getTypeText(type));
            // console.log(importExpr);
            if (importExpr.isKind(SyntaxKind.Identifier)) {
                // import is a require or import
                const importName = importExpr.getText();
                const importId = importExpr;

                // check if the require is from node
                if (importName === 'require') {
                    const importSymbol = importId.getType().getSymbol();
                    if (importSymbol === undefined) {
                        console.error("Import identifier has no symbol", importId.getText());
                    } else {
                        const importSymbolFullyQualifiedName = checker.getFullyQualifiedName(importSymbol);
                        if (importSymbolFullyQualifiedName !== 'global.NodeJS.Require') {
                            console.warn("Found require call but not from NodeJS global require");
                        }
                    }


                    // console.log("Found require/import call", importExpr);
                    // extract the variables imported from the callexpression
                    // const importArgs = importDecl.getArguments();

                    const parent = importDecl.getParent();
                    if(!parent?.isKind(SyntaxKind.VariableDeclaration)) {
                        console.log("Parent of import call", parent?.getKindName(), parent?.getText());
                        // Check to see if there is a declaration of type:
                        // const x = require('something').x;
                        // or else, drop it. 
                        if(parent?.isKind(SyntaxKind.PropertyAccessExpression)){
                            // this is a property access expression
                            const propAccessExpr = parent;
                            const propAccessName = propAccessExpr.getName();
                            const propAccessNameNode = propAccessExpr.getNameNode();

                            if (propAccessNameNode.isKind(SyntaxKind.Identifier)) {
                                // assert that the parent of the property access is a variable declaration
                                const parentVarDecl = propAccessExpr.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
                                if (parentVarDecl !== undefined) {
                                    // this is a variable declaration
                                    const varName = parentVarDecl.getName();
                                    if (varName === propAccessName) {
                                        const varNameNode = parentVarDecl.getNameNode();
                                        if(varNameNode.isKind(SyntaxKind.Identifier)) {
                                            recordImportedIdentifierUsage(checker, varNameNode, mainFilePath, libraryTypesRecorder, importStringDecl);
                                        }
                                    }else{
                                        console.warn("Variable name does not match property access name", varName, propAccessName);
                                    }
                                }
                                    // console.error("Property access expression is not a variable declaration", propAccessExpr.getText());
                                // this is a property access expression with identifier
                            }else{
                                console.log("Property access name", propAccessName);
                            }
                            
                        }

                    }
                    if (parent?.isKind(SyntaxKind.VariableDeclaration)) {
                        // this is a variable declaration
                        const varDecl = parent;
                        const varName = varDecl.getName();
                        const varDecls = varDecl.getNameNode();
                        // default import
                        if( varDecls.isKind(SyntaxKind.Identifier)) {
                            // this is like a namespace import. this is not a default import because default imports in require are indicated by `.default`
                            recordNamespaceImportIdentifierUsage(checker, varDecls, mainFilePath, libraryTypesRecorder, importStringDecl);
                        }else if(varDecls.isKind(SyntaxKind.ObjectBindingPattern)) {
                            const destructuredElements = varDecls.getElements();
                            for (const destructuredElement of destructuredElements) {
                                const destructuredElementName = destructuredElement.getNameNode();
                                if (destructuredElementName.isKind(SyntaxKind.Identifier)) {
                                    recordImportedIdentifierUsage(checker, destructuredElementName, mainFilePath, libraryTypesRecorder, importStringDecl);
                                } else if (destructuredElementName.isKind(SyntaxKind.ObjectBindingPattern)) {
                                    // TODO handle object binding pattern
                                    console.warn("Nested binding pattern not handled yet", destructuredElementName.getText());
                                } else {
                                    console.error("Unexpected destructured element", destructuredElementName.getText());
                                    // console.log("Variable name", varName);
                                }
                            }
                        }
                        // check if declaration is identifier or object pattern
                    }
                }
            }


        } else if (importDecl.isKind(SyntaxKind.ImportDeclaration)) {// import {x,z} from 'module'; 
            // console.log("Found import declaration", importDecl.getPos());
            // console.log("Named imports", importDecl.getNamedImports().length);
            const namedImports = importDecl.getNamedImports();

            for (const namedImport of namedImports) {
                // TODO handle aliases
                handleImportForGivenImport(checker, importStringDecl,namedImport, mainFilePath, libraryTypesRecorder);

            }
            const defaultImportIdentifier = importDecl.getDefaultImport();
            // console.log("Default import",defaultImportIdentifier);
            if( defaultImportIdentifier !== undefined) {
                recordImportedIdentifierUsage(checker, defaultImportIdentifier, mainFilePath, libraryTypesRecorder, importStringDecl, true);
            }

            const namespaceImportIdentifier = importDecl.getNamespaceImport();
            // console.log("Namespace import",namespaceImportIdentifier);
            if( namespaceImportIdentifier !== undefined) {
                recordNamespaceImportIdentifierUsage(checker, namespaceImportIdentifier, mainFilePath, libraryTypesRecorder, importStringDecl);
            }
            
            // recordImportedIdentifierUsage(defaultImportIdentifier, mainFilePath, libraryCallsRecorder, importStringDecl, true);

            console.log("STOP");

        } else {
            console.error("Unexpected import specifier", SyntaxKind[importDecl.getKind()]);
        }
        const importThing = importStringDecl.getParent()

    }
    // throw Error("Not implemented yet");
    return libraryTypesRecorder;
}

/**
 * 
 * @param {tsm.TypeChecker} checker
 * @param {tsm.StringLiteral} importStringLiteral
 * @param {ImportSpecifier} namedImport 
 * @param {string} mainFilePath 
 * @param {LibraryTypesRecorder} libraryCallsRecorder
 */
function handleImportForGivenImport(checker, importStringLiteral,namedImport, mainFilePath, libraryCallsRecorder) {
    const aliasNode = namedImport.getAliasNode();
    if (aliasNode !== undefined) {
        console.error("Unhandled named import alias", aliasNode.getText());

    }
    // console.log("Named import", namedImport.getNameNode().getText());
    const importNode = namedImport.getNameNode();
    if (importNode.isKind(SyntaxKind.StringLiteral)) {
        throw Error("Unexpected string literal import node. Expected identifier");
    }

    recordImportedIdentifierUsage(checker, importNode, mainFilePath, libraryCallsRecorder, importStringLiteral);
}
/**
 * 
 * @param {tsm.TypeChecker} checker
 * @param {Identifier} importNode 
 * @param {string} mainFilePath 
 * @param {LibraryTypesRecorder} libraryCallsRecorder 
 * @param {StringLiteral} importStringLiteral 
 */
function recordNamespaceImportIdentifierUsage(checker, importNode, mainFilePath, libraryCallsRecorder, importStringLiteral) {
    const importRefs = importNode.findReferences();
    for (const importRef of importRefs) {
        const referenceSourceFile = importRef.getDefinition().getSourceFile();
        const comparePath = path.relative(mainFilePath, referenceSourceFile.getFilePath());
        if (comparePath !== '') {
            // console.warn("Skipping import reference from other file", referenceSourceFile.getFilePath());
            continue;
        }
        // const filePath = referenceSourceFile.getFilePath();
        // console.log("Refset for import",filePath);
        for (const ref of importRef.getReferences()) {
            if (ref.isDefinition()) {
                continue;
            }
            // console.log("I am ",ref.isDefinition());
            const callExpression = ref.getNode().getFirstAncestorByKind(SyntaxKind.CallExpression);
            

            /**
             * @type {`.${string}`} 
             */
            let getImportSection;

            if(callExpression?.getExpression().getDescendantsOfKind(SyntaxKind.Identifier).some(id=>id===ref.getNode())){
                // asserted that the call expression is using the importNode
                if(callExpression.getExpression().isKind(SyntaxKind.PropertyAccessExpression)){
                    // console.log("Used a submethod of import", ref.getNode().getText(),callExpression.getExpression().getText());
                    // ref.getNode().getText();
                    const expressionImportSection = callExpression.getExpression().getText().split('.');
                    expressionImportSection.shift();
                    getImportSection = '.'+expressionImportSection.join('.');
                }else{
                    console.warn("Call expression is not using the import node as property access", ref.getNode().getText());

                    continue;
                }
            }else if(callExpression?.getExpression().isKind(SyntaxKind.Identifier)) {
                // the call expression is using the import node as identifier
                getImportSection = '.'

            }else {
                console.warn("Call expression is not using the import node", callExpression?.getText());
                continue;
            }
            const callExpressionArguments = callExpression?.getArguments();
            if (callExpressionArguments === undefined || !Array.isArray( callExpressionArguments)) {
                console.warn("No call expressions found for import reference", ref.getNode().getText());
                continue;
            }

            const callArguments = callExpressionArguments.map((arg,i) => {
                const callExpressionArg = arg.getType();
                if(callExpressionArg.isAny()){
                    const funcCall = callExpression.getExpression();
                    const funcType = checker.getTypeAtLocation(funcCall);
                    const paramType = checker.getTypeAtLocation(funcCall)?.getCallSignatures()[0]?.getParameters()[i]
                    if(paramType !== undefined){

                        const paramArgType = checker.getTypeOfSymbolAtLocation(paramType,funcCall);
                        if(!paramArgType.isAny()){
                            // console.log("[analyzer] Using scoped argument", paramArgType.getText(), "for argument", i, "of call", funcCall.getText());
                            return paramArgType;
                        }
                    }
                }
                return callExpressionArg;
            });
            // for(const argument of callExpressionArguments){
            //     console.log(`Arg ${idx} is ${arg.getText()}, type is ${arg.getType()}`);
            // }
            // console.log("Noted call for namespace import", importStringLiteral.getLiteralValue(), getImportSection, callExpressionArguments.map(arg => arg.getType().getText()));
            libraryCallsRecorder.pushToMap(importStringLiteral.getLiteralValue(), getImportSection, callArguments);

        }
    }
}
/**
 * 
 * @param {tsm.TypeChecker} checker
 * @param {Identifier} importNode 
 * @param {string} mainFilePath 
 * @param {LibraryTypesRecorder} libraryCallsRecorder 
 * @param {StringLiteral} importStringLiteral 
 * @param {boolean} [isDefaultImport=false]
 */
function recordImportedIdentifierUsage(checker, importNode, mainFilePath, libraryCallsRecorder, importStringLiteral, isDefaultImport = false) {
    const importRefs = importNode.findReferences();
    for (const importRef of importRefs) {
        const referenceSourceFile = importRef.getDefinition().getSourceFile();
        const comparePath = path.relative(mainFilePath, referenceSourceFile.getFilePath());
        if (comparePath !== '') {
            // console.warn("Skipping import reference from other file", referenceSourceFile.getFilePath());
            continue;
        }
        // const filePath = referenceSourceFile.getFilePath();
        // console.log("Refset for import",filePath);
        for (const ref of importRef.getReferences()) {
            if (ref.isDefinition()) {
                continue;
            }
            // console.log("I am ",ref.isDefinition());
            const callExpression = ref.getNode().getFirstAncestorByKind(SyntaxKind.CallExpression);

            const callExpressionArguments = callExpression?.getArguments();
            if (callExpressionArguments === undefined || callExpressionArguments.length === 0) {
                console.warn("No call expressions found for import reference", ref.getNode().getText());
                continue;
            }

            // for(const argument of callExpressionArguments){
            //     console.log(`Arg ${idx} is ${arg.getText()}, type is ${arg.getType()}`);
            // }
            const getImportSection = '.' + (isDefaultImport? 'default':importNode.getText());
            libraryCallsRecorder.pushToMap(importStringLiteral.getLiteralValue(), getImportSection, callExpressionArguments.map(arg => arg.getType()));

        }
    }
}
/**
 * 
 * @param {*} calls 
 * @param {string} fileName 
 */
export function logCallList(calls,fileName) {
    console.log(`--- [Call Log List: ${fileName}] ---`)
    console.log(`[Call Log] Call List for ${calls.size} modules`);
    for (const [moduleName, callBoxes] of calls.entries()) {
        if (isRelativeModule(moduleName) || isNodeModule(moduleName)) {
            console.log(`Local/sys Module "${moduleName}" - System module. FIXME skipping`);
        } else {
            console.log('Library Module', moduleName, callBoxes);
        }
    }
    console.log(`Call List`, calls);
    console.log(`--- [Call Log End List: ${fileName}] ---`);

}
export function isRelativeModule(moduleName) {
    return moduleName.startsWith('.');
}
/**
 * True if an inbuilt Node.js module.
 * @param {string} moduleName
 * @returns
 */
export function isNodeModule(moduleName) {
    if (builtinModules.includes(moduleName) ) return true;
    if (moduleName.startsWith('node:')) {
        return builtinModules.includes(moduleName.substring(5));// strip node: prefix
    }
    // const nodeModules = ['fs', 'fs/promises', 'path', 'http', 'https', 'os', 'crypto','assert'];
    // return nodeModules.includes(moduleName);
}

