/**
 * 使用 Joern 进行静态可达性分析
 * 替代原有的基础 static-reachability.mjs，提供更强大的 CPG 分析能力
 */

import { JoernClient } from './joern-client.mjs';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync } from 'fs';

const MAX_MERGED_RANGES = 500;

/**
 * 使用 Joern 计算从导出出发的静态可达性
 * @param {string} sourceCode - bundle 源码
 * @returns {Promise<Array>} 应保留的源码区间
 */
export async function computeStaticReachabilityWithJoern(sourceCode) {
  const client = new JoernClient();
  let tempFile = null;
  
  try {
    // 1. 将源码写入临时文件（供 Joern 使用）
    tempFile = join(tmpdir(), `joern-temp-${Date.now()}.js`);
    writeFileSync(tempFile, sourceCode, 'utf-8');
    
    // 2. 查找导出节点和相关的方法（单次 Joern 调用）
    // 使用尽可能稳定的 Joern API（cpg.call / cpg.method），并避免在脚本中使用 try/catch 表达式，
    // 以兼容当前版本的 Joern/Scala 语法。
    const analysisScript = `
      importCode("${tempFile}", "javascript")
      try {
        // 查找所有导出相关的调用（如 module.exports / exports.xxx）
        val exports = cpg.call.name(".*exports.*").l

        // 查找所有方法定义（这些可能被导出或被导出间接调用）
        val methods = cpg.method.l

        // 合并所有相关节点，并限制数量以防图过大
        val allNodes = (exports ++ methods).distinct.take(1000)

        val json = allNodes.map { n =>
          Map(
            "line" -> n.lineNumber.getOrElse(0),
            "column" -> n.columnNumber.getOrElse(0),
            "code" -> n.code
          )
        }.toJson

        // 为了让 Node 端更容易解析，只在这里打印一段带标记的纯 JSON
        println("##JSON_START##")
        println(json)
      } catch {
        case e: Exception => "[]"
      }
    `;
    
    let allNodes = [];
    const result = await client.executeScript(analysisScript, 120000); // 可能抛出异常
    // 从输出中提取我们标记过的 JSON 段
    const marker = '##JSON_START##';
    const markerIndex = result.indexOf(marker);
    if (markerIndex !== -1) {
      const after = result.slice(markerIndex + marker.length).trim();
      // 取标记之后的第一行、且以 '[' 开头的内容作为 JSON
      const lines = after.split('\n').map(l => l.trim()).filter(Boolean);
      const jsonLine = lines.find(l => l.startsWith('['));
      if (jsonLine) {
        allNodes = JSON.parse(jsonLine);
      }
    }
    
    if (allNodes.length === 0) {
      throw new Error('[Joern] No nodes found for static reachability');
    }
    
    // 3. 转换为 Istanbul 兼容的格式
    const allRanges = [];
    
    for (const node of allNodes) {
      if (node.line > 0) {
        allRanges.push({
          start: {
            line: node.line,
            column: node.column || 0
          },
          end: {
            line: node.line,
            column: (node.column || 0) + (node.code?.length || 50)
          }
        });
      }
    }

    // 6. 去重并合并重叠区间
    const merged = mergeRanges(allRanges);
    
    if (merged.length > MAX_MERGED_RANGES) {
      throw new Error(`[Joern] 静态 must-keep 区间数量 (${merged.length}) 超过上限 ${MAX_MERGED_RANGES}`);
    }
    
    return merged;
    
  } catch (error) {
    console.warn('[Joern] Static analysis failed:', error.message);
    // 向上传播，让调用者决定是否回退到纯动态
    throw error;
  } finally {
    // 清理临时文件
    if (tempFile) {
      try {
        unlinkSync(tempFile);
      } catch (e) {
        // 忽略清理错误
      }
    }
  }
}

/**
 * 合并重叠的区间
 * @param {Array} ranges - 源码区间数组
 * @returns {Array} 合并后的区间数组
 */
function mergeRanges(ranges) {
  if (ranges.length === 0) return [];
  
  // 按行号和列号排序
  ranges.sort((a, b) => {
    if (a.start.line !== b.start.line) {
      return a.start.line - b.start.line;
    }
    return a.start.column - b.start.column;
  });
  
  const merged = [];
  let current = { ...ranges[0] };
  
  for (let i = 1; i < ranges.length; i++) {
    const next = ranges[i];
    
    // 检查是否重叠或相邻
    const overlaps = 
      (next.start.line < current.end.line) ||
      (next.start.line === current.end.line && next.start.column <= current.end.column);
    
    if (overlaps) {
      // 合并区间
      current.end = {
        line: Math.max(current.end.line, next.end.line),
        column: Math.max(current.end.column, next.end.column)
      };
    } else {
      // 不重叠，保存当前区间，开始新区间
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  
  return merged;
}

/**
 * 基础可达性分析（回退方案）
 * 使用简单的 AST 解析，只识别导出语句
 * @param {string} sourceCode - 源码
 * @returns {Array} 基础区间数组
 */
async function computeBasicReachability(sourceCode) {
  const ranges = [];
  try {
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    let parse;
    
    try {
      const espree = req('espree');
      parse = (src) => espree.parse(src, { loc: true, ecmaVersion: 'latest' });
    } catch (_) {
      try {
        const esprima = req('esprima');
        parse = (src) => esprima.parseScript(src, { loc: true });
      } catch (_) {
        return ranges;
      }
    }
    
    if (parse) {
      const ast = parse(sourceCode);
      visitExportRanges(ast, ranges);
    }
  } catch (error) {
    console.warn('[Basic] Static analysis failed:', error.message);
  }
  
  return ranges;
}

function visitExportRanges(ast, ranges) {
  if (!ast || !ast.body) return;
  const visit = (node) => {
    if (!node || !node.loc) return;
    if (isExportNode(node)) {
      ranges.push({
        start: { line: node.loc.start.line, column: node.loc.start.column },
        end: { line: node.loc.end.line, column: node.loc.end.column },
      });
    }
    const keys = ['body', 'declarations', 'init', 'argument', 'callee', 'arguments', 'expressions', 'consequent', 'alternate', 'block', 'test', 'left', 'right', 'object', 'property'];
    for (const k of keys) {
      const c = node[k];
      if (Array.isArray(c)) c.forEach(visit);
      else if (c && typeof c === 'object') visit(c);
    }
  };
  for (const st of ast.body) visit(st);
}

function isExportNode(node) {
  if (!node) return false;
  if (node.type === 'ExpressionStatement' && node.expression) {
    const e = node.expression;
    if (e.type === 'AssignmentExpression') {
      const left = e.left;
      if (left.type === 'MemberExpression') {
        const o = left.object?.name;
        const p = left.property?.name;
        if (o === 'module' && p === 'exports') return true;
        if (o === 'exports') return true;
      }
    }
  }
  return false;
}
