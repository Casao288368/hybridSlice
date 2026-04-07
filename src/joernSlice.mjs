import fs from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import * as babel from 'babel-core';
import { programVisitor as getInstrumentVisitor } from 'istanbul-lib-instrument';
import template from 'babel-template';
import plugin from 'babel-plugin-transform-object-rest-spread';
import sliceCode from 'slice-js/src/slice-code/index.js';
import transformCoverage from 'slice-js/src/slice-code/transform-coverage.js';
import { computeStaticReachability } from '/root/joern-integration/index.mjs';

const coverageVariable = '____sliceCoverage____';

/**
 * Hybrid 版本的切片入口：与 slice-js 的 getSliceAndInfoSync 行为等价，
 * 但在传递 coverage 给 sliceCode 之前，允许基于 Joern 的静态分析结果
 * 对 coverage 进行“must-keep”增强。
 */
export async function getSliceWithJoern(sourceCode, testerSync, actualFilepath) {
  const tempFilename = `./temp-sliced.${Date.now()}${Math.floor(Math.random() * 1e9)}.js`;
  const mod = getInstrumentedModuleFromString(
    tempFilename,
    sourceCode,
    actualFilepath,
  );

  const originalResult = testerSync(mod);

  // 原始 coverage 数据由 Istanbul 插桩 + testerSync 填充
  const coverageRoot = mod[coverageVariable] || {};
  let coverageData = coverageRoot[tempFilename];

  // 基于 Joern 结果增强 coverage（如果 Joern 不可用或失败，则退回原 coverage）
  coverageData = await augmentCoverageWithJoern(coverageData, actualFilepath);

  let slicedCode;
  let filteredCoverage;
  try {
    slicedCode = sliceCode(sourceCode, coverageData);
    filteredCoverage = transformCoverage(coverageData);
  } catch (e) {
    // 如果 slice-js 在处理某些库（如 chokidar）时生成了无法被 Babylon 解析的代码
    //（例如 `const event;`），会抛出 SyntaxError。这里吞掉这类错误，
    // 回退为“不切片”的原始源码，以免打断整个仓库批处理。
    console.warn(
      '[HybridSlice] slice-js failed on file, fallback to original source.',
      actualFilepath,
      e,
    );
    slicedCode = sourceCode;
    try {
      filteredCoverage = transformCoverage(coverageData);
    } catch {
      filteredCoverage = undefined;
    }
  }

  return {
    mod,
    originalResult,
    slicedCode,
    filteredCoverage,
  };
}

async function augmentCoverageWithJoern(coverageData, actualFilepath) {
  if (!coverageData || !actualFilepath) {
    return coverageData;
  }

  let sourceCode;
  try {
    sourceCode = fs.readFileSync(actualFilepath, 'utf-8');
  } catch {
    return coverageData;
  }

  let ranges = [];
  try {
    // 通过 Joern 计算静态可达的 must-keep 区间
    ranges = await computeStaticReachability(sourceCode);
  } catch {
    // Joern 不可用或分析失败时，直接退回原 coverage
    return coverageData;
  }

  if (!Array.isArray(ranges) || ranges.length === 0) {
    return coverageData;
  }

  // 将 Joern 返回的区间映射到 Istanbul coverage 的 statementMap / fnMap
  try {
    const inRange = (loc) => {
      if (!loc || !loc.start || !loc.end) return false;
      const line = loc.start.line;
      const col = loc.start.column ?? 0;
      return ranges.some(r => {
        if (!r.start || !r.end) return false;
        const sLine = r.start.line;
        const sCol = r.start.column ?? 0;
        const eLine = r.end.line;
        const eCol = r.end.column ?? Number.MAX_SAFE_INTEGER;
        if (line < sLine || line > eLine) return false;
        if (line === sLine && col < sCol) return false;
        if (line === eLine && col > eCol) return false;
        return true;
      });
    };

    // 语句级别
    if (coverageData.statementMap && coverageData.s) {
      for (const [id, loc] of Object.entries(coverageData.statementMap)) {
        if (inRange(loc)) {
          coverageData.s[id] = Math.max(coverageData.s[id] || 0, 1);
        }
      }
    }

    // 函数级别
    if (coverageData.fnMap && coverageData.f) {
      for (const [id, fn] of Object.entries(coverageData.fnMap)) {
        if (inRange(fn.loc)) {
          coverageData.f[id] = Math.max(coverageData.f[id] || 0, 1);
        }
      }
    }
  } catch {
    // 出现任何问题时，不阻断切片，直接使用原 coverageData
    return coverageData;
  }

  return coverageData;
}

function getInstrumentedModuleFromString(filename, sourceCode, actualFilepath) {
  // 与 slice-js 中逻辑一致：先把我们自己的 pragma 替换掉，防止和 Istanbul 冲突
  const sourceCodeWithoutIstanbulPragma = sourceCode
    .replace(/istanbul/g, 'ignore-istanbul-ignore')
    .replace(/slice-js-coverage-ignore/g, 'istanbul');

  const { code } = babel.transform(sourceCodeWithoutIstanbulPragma, {
    filename,
    babelrc: false,
    only: filename,
    presets: ['node6', 'stage-2'],
    plugins: [plugin, instrumenter],
  });

  return requireFromString(code, actualFilepath || filename);
}

// 复制自 slice-js：requireFromString + instrumenter。
function requireFromString(code, filepath) {
  const m = new Module(filepath, null);
  m.filename = filepath;
  m.paths = Module._nodeModulePaths(path.dirname(filepath));
  m._compile(code, filepath);
  return m.exports;
}

function instrumenter({ types: t }) {
  return {
    visitor: {
      Program: {
        enter(...args) {
          this.__dv__ = getInstrumentVisitor(t, this.file.opts.filename, {
            coverageVariable,
          });
          this.__dv__.enter(...args);
        },
        exit(...args) {
          this.__dv__.exit(...args);
          // expose coverage as part of the module
          const newNode = template(
            `module.exports.${coverageVariable} = global.${coverageVariable};`,
          )();
          args[0].node.body.push(newNode);
        },
      },
    },
  };
}

