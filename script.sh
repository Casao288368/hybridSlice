#!/bin/bash
# run slicer
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
CACHE_REPOS_ROOT="${PROJECT_ROOT}/cache-repos/repos"
HYBRID_CANDIDATES_ROOT="${PROJECT_ROOT}/hybrid-candidates-repos"
IGNORE_REPOS=(
    "source-map-support" "jsdom" "eslint-utils" "polished" "webpack-bundle-analyzer" "jscodeshift" "chromium-bidi" "react-popper" "react-dropzone" "babel-plugin-styled-components" "unicode-trie" "relay-runtime" "react-element-to-jsx-string" "inline-style-prefixer" "karma" "cfb" "serve-handler" "rxjs" "d3-array" "lie" "@cspotcode/source-map-support" "d3-shape" "pac-resolver" "ts-loader" "pgpass" "less" "d3-geo" "rollup-plugin-terser" "seek-bzip" "brotli" "d3-contour" "nearley" "zig" "liftoff" "tslint" "react-syntax-highlighter" "xml-js" "web3-utils" "react-focus-lock" "clipboard" "css-vendor" "fontkit" "append-buffer" "react-color" "aws-cdk-lib" "jest-serializer-html" "fontkit" "@aws-cdk/core" "svg2ttf" "ttf2woff" "eslint-plugin-sort-keys-fix" "react-places-autocomplete" "moddle" "docsify" "moddle-xml" "openapi-to-postmanv2" "bpmn-moddle" "espower" "random-useragent" "jsdom" "preact-compat" "react-cytoscapejs" "enzyme-async-helpers" "@foliojs-fork/fontkit" "@pdf-lib/fontkit" "@applitools/jsdom" "jsdoc-babel" "coinstring" "@lezer/css" "bpmn-js-properties-panel" "https-localhost" "waterline-schema" "ruby" "@koa/ejs" "react-calendar-heatmap" "gulp-file-include" "selection-ranges" "react-photo-gallery" "textract" "events-light" "line-numbers" "sinon"
    "react-intl-redux" "mr-dep-walk" "postcss-prettify" "textcomplete" 
    "winston-graylog2" "react-native-svg-asset-plugin" "@cap-js/openapi" "@wesleytodd/openapi" "require-hacker" "storybook-addon-specifications" "animated-number-react" "dmn-js-properties-panel" "benchpressjs"
    "angular-google-maps" "enzyme-async-helpers"
    ) 
# set -e 


function fail {
    printf '%s\n' "$1" >&2 ## Send message to stderr.
    exit "${2-1}" ## Return a code specified by $2, or 1 by default.
}

# rm -rf candidates
mkdir -p candidates
rm -iv processed.log current.log success.txt
N=0;

# Read the minableRepositories2.csv file (rows of repo,test script). Read the repo and copy it from the `cache` folder`
while IFS=, read -r repo test_script; do

    echo "$N"
    if (( N % 2 == 0 )); then
        N=$((N + 1))
        continue  # Skip the rest of the loop if N is divisible by 2
    fi
    N=$((N+1))
    # Check if the repo is not empty
    if [[ -n "$repo" ]]; then

        # If the repo belongs to a given list, ignore it
        if [[ "${IGNORE_REPOS[@]}" =~ "${repo}" ]]; then
            echo "Ignoring repository: $repo"
            repo_name=$(basename "$repo" .git)
            echo "Cleaning unused $repo_name"
            rm -rf "${HYBRID_CANDIDATES_ROOT}/$repo_name"
            continue
            else
                echo "Processing repository: $repo"
        fi    
        # Extract the repo name from the URL
        repo_name=$(basename "$repo" .git)
        
        # Check if the repo directory exists in the cache folder
        if [[ -d "${CACHE_REPOS_ROOT}/$repo_name" ]]; then
            echo "Processing repository: $repo_name"
            echo "Processing repository: $repo_name" >> current.log
            # Change to the repository directory
            if [[ -d "${HYBRID_CANDIDATES_ROOT}/$repo_name" ]]; then
                echo "Repository $repo_name already exists in candidates, skipping..."
                if [[ -f "${HYBRID_CANDIDATES_ROOT}/$repo_name/.done" ]]; then
                    echo "Skipping $repo_name as it has already been processed."
                    continue
                    else
                        echo "Processing $repo_name again as .done file is missing. Run it again."
                        rm -rf "${HYBRID_CANDIDATES_ROOT}/$repo_name"
                fi
                # Uncomment the next line if you want to remove the existing directory
                # rm -rf "../hybrid-candidates-repos/$repo_name"
            else 
                cp -r "${CACHE_REPOS_ROOT}/$repo_name" "${HYBRID_CANDIDATES_ROOT}/$repo_name" || exit
                pushd "${HYBRID_CANDIDATES_ROOT}/$repo_name" > /dev/null || fail "Failed to pushd"
                npm install --silent
                NPMI_RESULT=$?
                popd > /dev/null || fail "Failed to popd"
                
                if [[ $NPMI_RESULT -ne 0 ]]; then
                    echo "npm install failed for $repo_name, skipping..."
                    touch "${HYBRID_CANDIDATES_ROOT}/$repo_name/.done"
                    rm -rf "${HYBRID_CANDIDATES_ROOT}/$repo_name/node_modules"
                    echo "$repo_name" >> "failed-install.txt"
                    continue
                fi

                timeout 5m node src/index.mjs "${HYBRID_CANDIDATES_ROOT}/$repo_name"  >> processed.log  2>&1    
                RESULT=$?
                echo "--Separator-- $repo_name" >> processed.log
                touch "${HYBRID_CANDIDATES_ROOT}/$repo_name/.done"
                if [[ $RESULT -ne 0 ]]; then
                    rm -rf "${HYBRID_CANDIDATES_ROOT}/$repo_name/node_modules"
                    echo "Error processing repository: $repo_name"
                    # exit $RESULT
                else
                    echo "$repo_name">> "success.txt"
                fi
            fi
            # Change back to the original directory
        else
            echo "Repository $repo_name not found in cache" || exit 1
        fi
    else
        echo "Skipping empty repository entry $repo";
    fi
done < minableRepositories2.csv