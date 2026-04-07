/**
 * Joern 客户端封装
 * 通过子进程与 Joern 交互，执行 CPG 查询和分析
 */

import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, readFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

export class JoernClient {
  constructor(joernPath = 'joern') {
    this.joernPath = joernPath;
    this.tempDir = tmpdir();
    this.workspaceDir = join(this.tempDir, 'joern-workspace');
    
    // 确保工作空间目录存在
    try {
      mkdirSync(this.workspaceDir, { recursive: true });
    } catch (e) {
      // 目录可能已存在
    }
  }

  /**
   * 导入代码并构建 CPG
   * @param {string} sourceCode - JavaScript 源码
   * @param {string} filename - 临时文件名
   * @returns {Promise<{workspacePath: string, tempFile: string}>}
   */
  async importCode(sourceCode, filename = 'temp.js') {
    const tempFile = join(this.tempDir, filename);
    writeFileSync(tempFile, sourceCode, 'utf-8');
    
    // 使用新的 API，不调用 workspace.save()
    const script = `
      importCode("${tempFile}", "javascript")
      println(workspace.getPath)
    `;
    
    const result = await this.executeScript(script);
    // 从输出中提取工作空间路径
    const lines = result.trim().split('\n');
    let workspacePath = null;
    
    // 查找包含路径的行
    for (const line of lines) {
      if (line.includes('/workspace/') || line.includes('/opt/workspace/')) {
        workspacePath = line.trim();
        break;
      }
    }
    
    // 如果没找到，使用默认路径
    if (!workspacePath) {
      // Joern 默认工作空间在 /opt/workspace/，项目名通常是文件名
      const projectName = filename.replace(/\.js$/, '').replace(/[^a-zA-Z0-9]/g, '_');
      workspacePath = `/opt/workspace/${projectName}`;
    }
    
    return { workspacePath, tempFile };
  }

  /**
   * 执行 Joern 脚本
   * @param {string} script - Joern Query Language 脚本
   * @param {number} timeout - 超时时间（毫秒），默认 60 秒
   * @returns {Promise<string>} 执行结果
   */
  async executeScript(script, timeout = 60000) {
    return new Promise((resolve, reject) => {
      const scriptFile = join(this.tempDir, `joern-script-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.sc`);
      
      try {
        writeFileSync(scriptFile, script, 'utf-8');
      } catch (err) {
        reject(new Error(`Failed to write script file: ${err.message}`));
        return;
      }

      const joern = spawn(this.joernPath, ['--script', scriptFile], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, JAVA_OPTS: process.env.JAVA_OPTS || '-Xmx4g' }
      });

      let stdout = '';
      let stderr = '';
      let timeoutId = null;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        try {
          unlinkSync(scriptFile);
        } catch (e) {
          // 忽略清理错误
        }
      };

      timeoutId = setTimeout(() => {
        joern.kill('SIGTERM');
        cleanup();
        reject(new Error(`Joern script execution timeout after ${timeout}ms`));
      }, timeout);

      joern.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      joern.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      joern.on('close', (code) => {
        cleanup();
        if (code !== 0 && code !== null) {
          reject(new Error(`Joern failed with code ${code}: ${stderr || stdout}`));
        } else {
          resolve(stdout);
        }
      });

      joern.on('error', (err) => {
        cleanup();
        reject(new Error(`Failed to start Joern: ${err.message}. Make sure Joern is installed and in PATH.`));
      });
    });
  }

  /**
   * 查询导出节点
   * 注意：此方法在 importCode 之后直接调用，不需要 workspace.open
   * @param {string} workspacePath - CPG 工作空间路径（保留用于未来扩展）
   * @returns {Promise<Array>} 导出节点信息
   */
  async findExports(workspacePath = null) {
    const script = `
      try {
        val exports = cpg.call.name(".*exports.*").l
        exports.map { n =>
          Map(
            "name" -> n.name,
            "line" -> n.lineNumber.getOrElse(0),
            "column" -> n.columnNumber.getOrElse(0),
            "code" -> n.code
          )
        }.toJson
      } catch {
        case e: Exception => "[]"
      }
    `;
    
    try {
      const result = await this.executeScript(script);
      // 提取 JSON 部分
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.warn('[Joern] Failed to find exports:', error.message);
      return [];
    }
  }

  /**
   * 从导出节点出发做前向可达性分析
   * 注意：此方法在 importCode 之后直接调用，不需要 workspace.open
   * @param {string} workspacePath - CPG 工作空间路径（保留用于未来扩展）
   * @param {number} exportLine - 导出语句行号（可选，如果不提供则分析所有导出）
   * @returns {Promise<Array>} 可达语句的位置信息
   */
  async computeReachability(workspacePath = null, exportLine = null) {
    let sourceFilter = '';
    if (exportLine !== null) {
      sourceFilter = `.line(${exportLine})`;
    }
    
    const script = `
      try {
        val sources = cpg.call.name(".*exports.*")${sourceFilter}.l
        val allReachable = sources.flatMap { source =>
          source.reachableByFlows(cpg.ast.isCall).l
        }.distinct
        
        allReachable.map { n =>
          Map(
            "line" -> n.lineNumber.getOrElse(0),
            "column" -> n.columnNumber.getOrElse(0),
            "code" -> n.code,
            "name" -> n.name
          )
        }.toJson
      } catch {
        case e: Exception => "[]"
      }
    `;
    
    try {
      const result = await this.executeScript(script);
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.warn('[Joern] Failed to compute reachability:', error.message);
      return [];
    }
  }

  /**
   * 获取所有方法节点（用于调试）
   * 注意：此方法在 importCode 之后直接调用，不需要 workspace.open
   * @param {string} workspacePath - CPG 工作空间路径（保留用于未来扩展）
   * @returns {Promise<Array>} 方法节点信息
   */
  async getAllMethods(workspacePath = null) {
    const script = `
      try {
        cpg.method.name.l.map { n =>
          Map(
            "name" -> n.name,
            "line" -> n.lineNumber.getOrElse(0),
            "column" -> n.columnNumber.getOrElse(0),
            "code" -> n.code
          )
        }.toJson
      } catch {
        case e: Exception => "[]"
      }
    `;
    
    try {
      const result = await this.executeScript(script);
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.warn('[Joern] Failed to get methods:', error.message);
      return [];
    }
  }
}
