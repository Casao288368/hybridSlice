#!/usr/bin/env bash

# 拆分版候选仓库准备脚本：
# 实现原版 script.sh 中的 1–4 步逻辑（准备 candidates-repos），不执行切片。
#
# 1）从指定的 minableRepositories2.csv 读取 repo,test_script；
# 2）按 IGNORE_REPOS 过滤不需要的仓库，并做 1/2 采样（只保留奇数行）；
# 3）从 ../cache-repos/repos/<repo_name> 拷贝到 ../candidates-repos/<repo_name>；
# 4）在 candidates-repos 中执行 npm install，并记录失败仓库到 failed-install.txt。

set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE_REPOS_ROOT="${PROJECT_ROOT}/cache-repos/repos"
HYBRID_CANDIDATES_ROOT="${PROJECT_ROOT}/hybrid-candidates-repos"

IGNORE_REPOS=(
    "source-map-support" "jsdom" "eslint-utils" "polished" "webpack-bundle-analyzer" "jscodeshift" "chromium-bidi" "react-popper" "react-dropzone" "babel-plugin-styled-components" "unicode-trie" "relay-runtime" "react-element-to-jsx-string" "inline-style-prefixer" "karma" "cfb" "serve-handler" "rxjs" "d3-array" "lie" "@cspotcode/source-map-support" "d3-shape" "pac-resolver" "ts-loader" "pgpass" "less" "d3-geo" "rollup-plugin-terser" "seek-bzip" "brotli" "d3-contour" "nearley" "zig" "liftoff" "tslint" "react-syntax-highlighter" "xml-js" "web3-utils" "react-focus-lock" "clipboard" "css-vendor" "fontkit" "append-buffer" "react-color" "aws-cdk-lib" "jest-serializer-html" "fontkit" "@aws-cdk/core" "svg2ttf" "ttf2woff" "eslint-plugin-sort-keys-fix" "react-places-autocomplete" "moddle" "docsify" "moddle-xml" "openapi-to-postmanv2" "bpmn-moddle" "espower" "random-useragent" "jsdom" "preact-compat" "react-cytoscapejs" "enzyme-async-helpers" "@foliojs-fork/fontkit" "@pdf-lib/fontkit" "@applitools/jsdom" "jsdoc-babel" "coinstring" "@lezer/css" "bpmn-js-properties-panel" "https-localhost" "waterline-schema" "ruby" "@koa/ejs" "react-calendar-heatmap" "gulp-file-include" "selection-ranges" "react-photo-gallery" "textract" "events-light" "line-numbers" "sinon"
    "react-intl-redux" "mr-dep-walk" "postcss-prettify" "textcomplete" 
    "winston-graylog2" "react-native-svg-asset-plugin" "@cap-js/openapi" "@wesleytodd/openapi" "require-hacker" "storybook-addon-specifications" "animated-number-react" "dmn-js-properties-panel" "benchpressjs"
    "angular-google-maps" "enzyme-async-helpers"
)

function fail {
    printf '%s\n' "$1" >&2
    exit "${2-1}"
}

mkdir -p candidates
mkdir -p "${HYBRID_CANDIDATES_ROOT}"

rm -f processed.log current.log success.txt || true
N=0
SUCCESS_COUNT=0
TARGET_SUCCESS=200

CSV_PATH="/root/hybrid-sliceImport/minableRepositories2.csv"

while IFS=, read -r repo test_script; do

    # repo 为空则跳过
    if [[ -z "$repo" ]]; then
        echo "Skipping empty repository entry."
        continue
    fi

    # 黑名单过滤
    if [[ "${IGNORE_REPOS[@]}" =~ "${repo}" ]]; then
        echo "Ignoring repository (in IGNORE_REPOS): $repo"
        repo_name=$(basename "$repo" .git)
        echo "Cleaning unused $repo_name from candidates-repos"
        rm -rf "${HYBRID_CANDIDATES_ROOT}/$repo_name"
        continue
    fi

    repo_name=$(basename "$repo" .git)

    # 检查缓存中是否存在
    if [[ ! -d "${CACHE_REPOS_ROOT}/$repo_name" ]]; then
        echo "Repository $repo_name not found in cache"
        continue
    fi

    # 若已达到目标成功数，则停止
    if (( SUCCESS_COUNT >= TARGET_SUCCESS )); then
        echo "Reached TARGET_SUCCESS=${TARGET_SUCCESS}, stopping."
        break
    fi

    echo "Processing repository (prepare only): $repo_name"

    # 若 candidates-repos 中已存在且有 .done，则跳过
    if [[ -d "${HYBRID_CANDIDATES_ROOT}/$repo_name" ]]; then
        if [[ -f "${HYBRID_CANDIDATES_ROOT}/$repo_name/.done" ]]; then
            echo "Repository $repo_name already marked as .done, skipping."
            continue
        else
            echo "Repository $repo_name exists without .done, removing and reprocessing."
            rm -rf "${HYBRID_CANDIDATES_ROOT}/$repo_name"
        fi
    fi

    # 从 cache-repos 拷贝到 hybrid-candidates-repos
    cp -r "${CACHE_REPOS_ROOT}/$repo_name" "${HYBRID_CANDIDATES_ROOT}/$repo_name" || exit 1

    # 在 hybrid-candidates-repos 中安装依赖（超时视为失败；超时后强制终止 npm install；安装失败则跳过该仓库）
    NPMI_TIMEOUT=300
    NPMI_KILL_AFTER=10
    pushd "${HYBRID_CANDIDATES_ROOT}/$repo_name" > /dev/null || fail "Failed to pushd"
    if timeout -k "${NPMI_KILL_AFTER}s" "${NPMI_TIMEOUT}s" npm install --silent; then
        NPMI_RESULT=0
    else
        NPMI_RESULT=$?
    fi
    popd > /dev/null || fail "Failed to popd"

    if [[ $NPMI_RESULT -ne 0 ]]; then
        if [[ $NPMI_RESULT -eq 124 || $NPMI_RESULT -eq 137 ]]; then
            echo "npm install timed out (${NPMI_TIMEOUT}s, kill after ${NPMI_KILL_AFTER}s) for $repo_name, marking as failed and removing directory."
        else
            echo "npm install failed (exit=${NPMI_RESULT}) for $repo_name, marking as failed and removing directory."
        fi
        rm -rf "${HYBRID_CANDIDATES_ROOT}/$repo_name"
        echo "$repo_name" >> "failed-install.txt"
        continue
    fi

    touch "${HYBRID_CANDIDATES_ROOT}/$repo_name/.done"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    echo "Successfully prepared $repo_name (SUCCESS_COUNT=${SUCCESS_COUNT})"

done < "$CSV_PATH"


