import { assert, expect } from "chai";
import { matchFilterList } from "../src_dataset/FILTER_LIST.mjs";

describe('Filter List', function (){
    it('should not match URL in filter list',function(){
        const repoUrls = ["",
            "https://github.com/babel/babel/tree/master/packages",
            "https://github.com/babel/babel/tree/master/",
            "https://github.com/substact/node-x256"
        ];
        const result = repoUrls.map(e=> matchFilterList(e));
        result.forEach((e,i)=>{
            assert.isFalse(e, `Expected ${repoUrls[i]} to not match filter list`);
        })
    })

    it('should not match old URL filter list',function(){
        const OLD_FILTER_LIST = [
            "https://gitlab.com/contexttesting/zoroaster.git",
            "https://github.com/Eternity-Bots",
            "https://github.com/node-x-extras/x-path",
            "https://github.com/substack/node-x256",
            "https://github.com/substack/node-wordwrap",
            "https://github.com/zkochan/packages/blob/main/which-pm-runs",
            "https://github.com/webpack-contrib/webpack-addons",
            "https://github.com/zznoillusion1026/MyImage",
            "https://codehub.devcloud.huaweicloud.com/jsztxm00001/zzb-vue-ui.git",
            "https://github.com/DZSF",
            "https://github.com/chuzhixin/zx-count",
            "https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.stat",
            "https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.scandir",
            "https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.walk",
            "https://github.com/nodelib/nodelib/tree/master/packages/fs/fs.macchiato",
            "https://github.com/substack/text-table",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-object-rest-spread",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-optional-catch-binding",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-async-generators",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-optional-chaining",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-json-strings",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-nullish-coalescing-operator",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-bigint",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-dynamic-import",
            "https://github.com/substack/node-commondir",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-export-namespace-from",
            "https://github.com/substack/https-browserify",
            "https://github.com/babel/babel/tree/master/packages/babel-runtime",
            "https://github.com/paulmillr/async-each",
            "https://github.com/yarnpkg/yarn/blob/master/packages",
            "https://github.com/substack/semver-compare",
            "https://github.com/substack/node-archy",
            "https://github.com/substack/github-from-package",
            "https://github.com/babel/babel/tree/master/packages/babel-core",
            "https://github.com/babel/babel/tree/master/packages/babel-code-frame",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-trailing-function-commas",
            "https://github.com/emotion-js/emotion/tree/master/packages/stylis",
            "https://github.com/babel/babel/tree/master/packages/babel-types",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-syntax-jsx",
            "https://github.com/babel/babel/tree/master/packages/babel-messages",
            "https://github.com/substack/node-chainsaw",
            "https://github.com/substack/node-buffers",
            "https://github.com/babel/babel/tree/master/packages/babel-traverse",
            "https://github.com/substack/node-binary",
            "https://github.com/substack/stream-combiner2",
            "https://github.com/kogosoftwarellc/open-api/tree/master/packages/openapi-types",
            "https://github.com/babel/babel/tree/master/packages/babel-template",
            "https://github.com/substack/node-optimist",
            "https://github.com/thenativeweb/boolean",
            "https://github.com/zkochan/packages/tree/master/read-yaml-file",
            "https://github.com/babel/babel/tree/master/packages/babel-generator",
            "https://github.com/johnotander/rgba-regex",
            "https://github.com/adobe/react-spectrum/tree/main/packages/@internationalized/date",
            "https://github.com/pnpm/pnpm/blob/main/packages",
            "https://github.com/jhermsmeier/node-scuid",
            "https://github.com/emotion-js/emotion/tree/master/packages/babel-plugin-emotion",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-transform-es2015-modules-commonjs",
            "https://github.com/babel/babel/tree/master/packages/babel-plugin-transform-strict-mode",
            "https://github.com/babel/babel/tree/master/packages/babel-register",
            "https://github.com/babel/babel/tree/master/packages/babel-helpers",
            "https://github.com/emotion-js/emotion/tree/master/removed-packages/core",
            "https://github.com/babel/babel/tree/master/packages/babel-helper-get-function-arity",
            "https://github.com/babel/babel/tree/master/packages/babel-helper-function-name",
            "https://github.com/babel/babel/tree/master/packages/*"
        ];
        const result = OLD_FILTER_LIST.map(e=> matchFilterList(e));
        result.forEach((e,i)=>{
            assert.isTrue(e, `Expected ${OLD_FILTER_LIST[i]} to not match filter list`);
        })
    })


    it('should match URL in filter list',function(){
        const repoUrl = ["https://github.com/babel/babel/tree/master/packages/babel-helpers"];
        const result = matchFilterList(repoUrl);
        assert.isTrue(result);
    })

    it('should match URL in filter list',function(){
        const repoUrls = ["https://github.com/babel/babel/tree/master/packages/babel-helper",
            "https://github.com/babel/babel/tree/master/packages/babel-helper",
            "https://github.com/babel/babel/tree/master/packages/something"
        ];
        const result = repoUrls.map(e=> matchFilterList(e));
        assert.isTrue(result.every(e=>e));
    })
});