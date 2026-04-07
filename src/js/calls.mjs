import assert from 'assert';

/**
 *
 * @param {Scope.Definition} requireUsingReference
 * @returns {string}
 */
export function getModuleNameFromRequireAssignDeclaration(requireUsingReference) {
    assert(requireUsingReference.node.init.arguments.length === 1);
    const moduleImported = requireUsingReference.node.init?.arguments?.[0]?.value ?? null;
    assert(moduleImported !== null, "Module has to exist");

    return moduleImported;
}

