# master with an input function


REPO_BASE="$2"

if [[ -z "$REPO_BASE" ]]; then
    echo "Usage: $0 <input_function> <repo_base>"
    exit 1
fi
# exit 0;

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
HYBRID_CANDIDATES_ROOT="${PROJECT_ROOT}/hybrid-candidates-repos"
REPO_FOLDER="${HYBRID_CANDIDATES_ROOT}/$REPO_BASE"

fail() {
    echo "Error: $1"
    exit "${2-1}" ## Return a code specified by $2, or 1 by default.
}

if [[ -d "$REPO_FOLDER" ]]; then
    echo ""
else
    fail "Repository folder does not exist: $REPO_FOLDER"
fi

INPUT_FUNCTION="$1"

if [[ -z "$INPUT_FUNCTION" ]]; then
    fail "No input function provided. Usage: $0 <input_function>"
fi

echo "Input function: $INPUT_FUNCTION";

case "$INPUT_FUNCTION" in
    "pre-test")
        pushd "$REPO_FOLDER"
        read -p "Deleting old .node_modules directory?" choice
        if [[ "$choice" == "y" || "$choice" == "Y" ]];
        then
            rm -rf .node_modules node_modules_2
        else
            echo "Skipping deletion of .node_modules"
        fi
        npm i --silent || fail "Failed to install dependencies"
        npm run test
        popd 
        ;;
    "rollback")
        pushd "$REPO_FOLDER"
        # Move .node_modules back to node_modules
        if [[ -d ".node_modules" ]]; then
            echo "Restoring node_modules from .node_modules"
            rm -irf node_modules
            mv .node_modules node_modules
        else
            fail ".node_modules does not exist, cannot rollback"
        fi
        popd
        ;;
    "indeps")
        # Inactivate the repo by moving node_modules to .node_modules
        pushd "$REPO_FOLDER"
        mv node_modules .node_modules
        popd
        ;;
    "stat")
        # Generate dependency statistics
        pushd "$REPO_FOLDER" >> /dev/null
        if [[ ! -d "node_modules" ]]; then
            echo "node_modules directory does not exist"
        else
            echo "node_modules directory exists"
        fi
        if [[ ! -d ".node_modules" ]]; then
            echo ".node_modules directory does not exist"
            else
            echo ".node_modules directory exists"
        fi
        popd >> /dev/null
        ;;
    "cov")
        pushd "$REPO_FOLDER"
        rm -rf .node_modules node_modules_2
        npm i --silent || fail "Failed to install dependencies"
        npm i -D @types/node || fail "Failed to install node types"
        nyc npm run test 
        ;;
    "slice")
        pushd "$REPO_FOLDER"
        rm -rf .node_modules node_modules_2
        npm i --silent || fail "Failed to install dependencies"
        npm i -D @types/node || fail "Failed to install node types"
        
        popd
        node src/index.mjs "$REPO_FOLDER" || fail "Failed to execute src/index.mjs"
        ;;
    "exec")

        ./script-placer.sh "$REPO_FOLDER"
        OVERALL_RESULT=$?
        if [[ $OVERALL_RESULT -ne 0 ]]; then
            fail "script-placer.sh failed with exit code $OVERALL_RESULT"
        else
            echo "script-placer.sh executed successfully."
        fi
        ;;
    "cloc")
        # calculate the deptree stats
        pushd "$REPO_FOLDER"
        if [[ -d ".node_modules" ]]; then
            mv .node_modules node_modules
            popd
            node src_deptree/index.mjs "$REPO_FOLDER" || fail "Failed to execute src_deptree/index.mjs"
            pushd "$REPO_FOLDER"
            mv node_modules .node_modules
        else
            if [[ -d "node_modules" ]]; then
                popd
                node src_deptree/index.mjs "$REPO_FOLDER" || fail "Failed to execute src_deptree/index.mjs"
                pushd "$REPO_FOLDER"
            else
                fail "Neither node_modules nor .node_modules exist, cannot run cloc"
            fi
            fail ".node_modules does not exist, cannot run cloc"
        fi
        popd
        echo "--: PRE :--"
        cloc --json "output/$REPO_BASE" | jq "{nFiles:.JavaScript.nFiles,code:.JavaScript.code}"
        echo "--: POST :--"
        cloc --json "dist/$REPO_BASE" --exclude-ext=json | jq "{nFiles:.JavaScript.nFiles,code:.JavaScript.code}"
        echo "--: DEPS :--"
        echo "Dependencies: " `ls -1 dist/$REPO_BASE | wc -l`
        ;;
    *)
        fail "Unknown function: $INPUT_FUNCTION. Supported functions: pre-test, rollback, indeps, stat, cov, exec, sloc"
        ;;

esac