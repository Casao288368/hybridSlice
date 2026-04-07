#!/bin/bash
set -x
# This script processes a given repository by replacing its node_modules with the ones from the dist folder.
# The dist folder is expected to contain the base folder name of the repository, then inside that will be sliced dependencies.
# Usage: ./run-tests-swapped.sh <repo_location>

fail() {
    echo "Error: $1"
    exit "${2-1}" ## Return a code specified by $2, or 1 by default.
}

# Resolve project root (sliceImport) and related paths
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST_ROOT="${PROJECT_ROOT}/dist"

REPO_FOLDER="$1"
REPO_BASE=$(basename "$REPO_FOLDER")
if [[ -z "$REPO_FOLDER" ]]; then
    echo "Usage: $0 <repo_location>"
    exit 1
fi

pushd "$REPO_FOLDER"

if [[ -d "node_modules" ]]; then
    echo "node_modules directory already exists, renaming to node_modules_2"
    mv node_modules node_modules_2
else
    echo "No node_modules directory found, proceeding with the script"
fi

NODE_PATH="${DIST_ROOT}/${REPO_BASE}:$(pwd)/node_modules_2" npm run test
POST_TEST_RESULT=$?

if [[ $POST_TEST_RESULT -eq 0 ]]; then
    echo "Successfully processed $REPO_BASE"
else
    echo "Post test failed for $REPO_BASE"
fi
popd

