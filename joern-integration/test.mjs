/**
 * Joern 集成测试脚本
 * 用于验证 Joern 集成是否正常工作
 */

import { computeStaticReachability, checkJoernAvailable } from './index.mjs';

async function testJoernIntegration() {
  console.log('='.repeat(60));
  console.log('Joern 集成测试');
  console.log('='.repeat(60));
  
  // 1. 检查 Joern 是否可用
  console.log('\n[1] 检查 Joern 可用性...');
  const available = await checkJoernAvailable();
  if (!available) {
    console.error('❌ Joern 不可用，请检查安装');
    process.exit(1);
  }
  console.log('✅ Joern 可用');
  
  // 2. 测试简单的 JavaScript 代码
  console.log('\n[2] 测试简单代码分析...');
  const simpleCode = `
    function hello() {
      return "world";
    }
    
    module.exports = {
      hello: hello,
      greet: function(name) {
        return "Hello, " + name;
      }
    };
  `;
  
  try {
    const ranges = await computeStaticReachability(simpleCode);
    console.log(`✅ 分析成功，找到 ${ranges.length} 个应保留的区间`);
    if (ranges.length > 0) {
      console.log('前 3 个区间:');
      ranges.slice(0, 3).forEach((range, i) => {
        console.log(`  ${i + 1}. 行 ${range.start.line}:${range.start.column} - ${range.end.line}:${range.end.column}`);
      });
    }
  } catch (error) {
    console.error('❌ 分析失败:', error.message);
    process.exit(1);
  }
  
  // 3. 测试更复杂的代码
  console.log('\n[3] 测试复杂代码分析...');
  const complexCode = `
    const utils = {
      add: (a, b) => a + b,
      multiply: (a, b) => a * b
    };
    
    function calculate(operation, x, y) {
      return utils[operation](x, y);
    }
    
    module.exports = {
      utils: utils,
      calculate: calculate,
      version: "1.0.0"
    };
  `;
  
  try {
    const ranges = await computeStaticReachability(complexCode);
    console.log(`✅ 分析成功，找到 ${ranges.length} 个应保留的区间`);
  } catch (error) {
    console.error('❌ 分析失败:', error.message);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 所有测试通过！');
  console.log('='.repeat(60));
}

// 运行测试
testJoernIntegration().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
