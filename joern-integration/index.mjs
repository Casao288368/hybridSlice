/**
 * Joern 集成模块主入口
 * 提供统一的接口用于在项目中使用 Joern 进行静态分析
 */

import { computeStaticReachabilityWithJoern } from './reachability.mjs';
import { JoernClient } from './joern-client.mjs';

/**
 * 使用 Joern 进行静态可达性分析
 * @param {string} sourceCode - bundle 源码
 * @returns {Promise<Array>} 应保留的源码区间
 */
export async function computeStaticReachability(sourceCode) {
  return await computeStaticReachabilityWithJoern(sourceCode);
}

/**
 * 检查 Joern 是否可用
 * @returns {Promise<boolean>}
 */
export async function checkJoernAvailable() {
  try {
    // 检查 joern 命令是否存在
    const { execSync } = await import('child_process');
    execSync('which joern', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 获取 Joern 客户端实例（用于高级用法）
 * @returns {JoernClient}
 */
export function createJoernClient() {
  return new JoernClient();
}

// 导出客户端类供高级用户使用
export { JoernClient } from './joern-client.mjs';
