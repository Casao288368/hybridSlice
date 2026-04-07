import assert from "assert";

/**
 * Bifurcate an array into two arrays based on a predicate function.
 * @template T
 * @param {T[]} arr 
 * @param {(T)=>boolean} predicate 
 * @returns {[T[], T[]]}
 */
export function bifurcateArray(arr, predicate) {
    const truthy = [];
    const falsy = [];
    for (const item of arr) {
        if (predicate(item)) {
            truthy.push(item);
        } else {
            falsy.push(item);
        }
    }
    return [truthy, falsy];
}
export function getGithubTokenFromEnvironment() {
    assert(process.env.GITHUB_TOKEN, "No token :(");
    const githubToken = process.env.GITHUB_TOKEN;
    return githubToken;
}
