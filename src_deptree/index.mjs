import { existsSync } from 'node:fs';
import {asyncApi as npm, formats} from 'oubliette'

const {jsonFormat:format} = formats;

/**
 * Get the dependency tree of a project located at projectPath
 * @param {string} projectPath 
 */
async function getDepTree(projectPath){
    assertFolderExists(projectPath);
    const npmv = npm({format})
    const output = await npmv.ls({all:true,json:true,prefix:projectPath});
    // console.log(output)
    return output;
}

/**
 * 
 * @param {Promise<void>} projectPath 
 */
async function assertFolderExists(projectPath) {
    if(existsSync(projectPath)){
        return;
    }
    throw new Error(`Folder ${projectPath} does not exist`);
}

function getTreeDepth(tree){
    if(!tree) return 0;
    if(!tree.dependencies || Object.keys(tree.dependencies).length === 0){
        return 1;
    }
    let maxDepth = 0;
    for(const depName in tree.dependencies){
        const dep = tree.dependencies[depName];
        const depDepth = getTreeDepth(dep);
        if(depDepth > maxDepth){
            maxDepth = depDepth;
        }
    }
    return maxDepth + 1;
}

/**
 * Get the maximum number of elements at any level in the tree.
 * E.g. if the tree has 3 dependencies at level 1, and 5 dependencies at level 2, the max width is 5.
 * E.g. if the tree has 1 dependency at level 1, and 25 dependencies at level 2, the max width is 25.
 * E.g. if the tree is null or undefined, the max width is 0.
 * E.g. if the tree has no dependencies, the max width is 1 (itself).
 * @param {*} tree 
 */
function getTreeMaxWidth(tree){
    if(!tree) return 0;
    let maxWidth = 0;
    const queue = [tree];
    while(queue.length > 0){
        const levelSize = queue.length;
        // console.log("Level size:", levelSize);
        if(levelSize > maxWidth){
            maxWidth = levelSize;
        }
        for(let i=0; i<levelSize; i++){
            const node = queue.shift();
            if(node.dependencies){
                for(const depName in node.dependencies){
                    const dep = node.dependencies[depName];
                    queue.push(dep);
                }
            }
        }
    }
    return maxWidth;
}

/**
 * Main entry point.
 * One argument - the path to the root directory of the project.
 * The script get the npm dependencies from npm package and generate a dependency tree.
 * 
 */
async function main(){
    const args = process.argv.slice(2);
    if(args.length !== 1){
        console.error("Please provide exactly one argument - the path to the root directory of the project.");
        process.exit(1);
    }
    const projectPath = args[0];
    const { depth, width } = await getTreeStatsOfProject(projectPath);
    console.log("Depth of the tree:", depth);
    console.log("Width of the tree:", width);

}

/**
 * 
 * @param {string} projectPath 
 * @returns 
 */
export async function getTreeStatsOfProject(projectPath) {
    const tree = await getDepTree(projectPath);
    const depth = getTreeDepth(tree);
    const width = getTreeMaxWidth(tree);
    return { depth, width };
}

if (process.argv[1] === import.meta.filename) {
    main().catch(console.error.bind(console))
}else{
    // module has been imported
    // nothing to do
}