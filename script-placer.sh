#!/bin/bash

# This script processes a given repository by replacing its node_modules with the ones from the dist folder.
# The dist folder is expected to contain the base folder name of the repository, then inside that will be sliced dependencies.
# Usage: ./script-placer.sh <repo_location>
set -x
fail() {
    echo "Error: $1"
    exit "${2-1}" ## Return a code specified by $2, or 1 by default.
}

# Resolve project root (sliceImport) and related paths
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST_ROOT="${PROJECT_ROOT}/dist"
BACKUP_ROOT="${PROJECT_ROOT}/../node_modules_backup"
HYBRID_CANDIDATES_ROOT="${PROJECT_ROOT}/hybrid-candidates-repos"
# Keep coverage outputs under the hybrid-sliceImport project, consistent with /root/sliceImport
COVERAGE_ROOT="${PROJECT_ROOT}/coverage"

REPO_FOLDER="$1"
REPO_BASE=$(basename "$REPO_FOLDER")
if [[ -z "$REPO_FOLDER" ]]; then
    echo "Usage: $0 <repo_location>"
    exit 1
fi

pushd "$REPO_FOLDER"
# Ensure a clean working state before install. Previous runs may leave
# node_modules/.bin symlinks or partial installs that make npm i unstable.
rm -rf node_modules .node_modules node_modules_2
# 安装依赖失败时，仅记录结果并跳过该仓库，避免打断整个批处理。
if ! npm i; then
    mkdir -p "${COVERAGE_ROOT}/results"
    echo "$REPO_FOLDER" >> "${COVERAGE_ROOT}/results/install-failed.txt"
    echo "npm install failed for $REPO_FOLDER, skipping this repository"
    popd
    exit 0
fi
rm -rf .node_modules node_modules_2 "${BACKUP_ROOT}/node_modules_${REPO_BASE}"
mkdir -p "${COVERAGE_ROOT}/results"
timeout 5m npm run test >> "${COVERAGE_ROOT}/${REPO_BASE}-pre.json"
if [[ $? -ne 0 ]]; then
    echo "Tests failed in $REPO_FOLDER"
    echo "$REPO_FOLDER" >> "${COVERAGE_ROOT}/results/pre-failed.txt"
fi
popd

echo "Processing repository at: $REPO_FOLDER"

timeout 10m node "${PROJECT_ROOT}/src/index.mjs" "$REPO_FOLDER"
PRE_TEST_RESULT=$?
# 如果切片/压缩阶段出错，仅记录并跳过该仓库的 post 测试，
# 而不是让整个批处理脚本直接退出。
if [[ $PRE_TEST_RESULT -ne 0 ]]; then
    mkdir -p "${COVERAGE_ROOT}/results"
    echo "$REPO_FOLDER" >> "${COVERAGE_ROOT}/results/slicing-failed.txt"
    echo "Slicing/compression failed for $REPO_FOLDER (exit code $PRE_TEST_RESULT)"
    exit 0
fi

pushd "$REPO_FOLDER"
mv node_modules "${BACKUP_ROOT}/node_modules_${REPO_BASE}"
# Keep test binaries accessible after swapping node_modules.
# Many repos invoke node_modules/.bin/* in npm scripts; without this bridge,
# post-test fails before sliced deps are actually exercised.
mkdir -p node_modules
ln -sfn "${BACKUP_ROOT}/node_modules_${REPO_BASE}/.bin" node_modules/.bin

# NODE_PATH should point to sliced dist and backed-up original node_modules
NODE_PATH="${DIST_ROOT}/${REPO_BASE}:${BACKUP_ROOT}/node_modules_${REPO_BASE}" timeout 5m npm run test >> "${COVERAGE_ROOT}/${REPO_BASE}-post.json"
POST_TEST_RESULT=$?

# if post test is true, or both are false, then we can proceed
if [[ $POST_TEST_RESULT -ne 0 && $PRE_TEST_RESULT -ne 0 ]]; then
    echo "$REPO_FOLDER" >> "${COVERAGE_ROOT}/results/failed.txt"
fi
if [[ $POST_TEST_RESULT -eq 0 ]]; then
    touch "${COVERAGE_ROOT}/results/success.txt"
    if ! awk -v repo="$REPO_BASE" '$0==repo {found=1} END {exit found?0:1}' "${COVERAGE_ROOT}/results/success.txt"; then
        echo "$REPO_BASE" >> "${COVERAGE_ROOT}/results/success.txt"
    fi
    echo "Successfully processed $REPO_BASE"
fi
popd

