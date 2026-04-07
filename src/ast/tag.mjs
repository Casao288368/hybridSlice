export function tagASTNode(importVariableReference, _variableName, moduleImportedName) {
    importVariableReference.identifier.tag = "ref:variable:" + _variableName + "_module_" + moduleImportedName;
}

export function untagASTNode(importVariableReference, _variableName, moduleImportedName) {
    delete importVariableReference.identifier.tag 
}

export function getTagKey(){
    return 'tag';
}