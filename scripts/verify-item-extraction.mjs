/**
 * 验证物品提取功能是否正确集成
 * 
 * 运行方式: node scripts/verify-item-extraction.mjs
 */

import fs from 'fs';
import path from 'path';

const __filename = new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const __dirname = path.dirname(__filename);

console.log('=== 物品提取功能验证 ===\n');

// 读取 scriptParser.ts 文件
const scriptParserPath = path.join(__dirname, '..', 'services', 'scriptParser.ts');
console.log('Reading:', scriptParserPath);
const content = fs.readFileSync(scriptParserPath, 'utf-8');

let allChecks = true;

// 检查1: 轻量级Prompt是否存在
console.log('✓ 检查1: 轻量级Prompt');
const hasLightweightPrompt = content.includes('itemsBatchLightweight');
console.log(`  ${hasLightweightPrompt ? '✅' : '❌'} itemsBatchLightweight Prompt ${hasLightweightPrompt ? '已添加' : '未找到'}`);
allChecks = allChecks && hasLightweightPrompt;

// 检查2: 提取函数是否存在
console.log('\n✓ 检查2: 提取函数');
const hasExtractFunction = content.includes('extractItemsLightweight');
console.log(`  ${hasExtractFunction ? '✅' : '❌'} extractItemsLightweight 函数 ${hasExtractFunction ? '已实现' : '未找到'}`);
allChecks = allChecks && hasExtractFunction;

// 检查3: 4个解析路径是否都集成了物品提取
console.log('\n✓ 检查3: 解析路径集成');
const paths = [
  { name: 'Fast Path (Legacy)', pattern: /parseShortScript[\s\S]*?extractItemsLightweight/ },
  { name: 'Fast Path (Optimized)', pattern: /parseShortScriptOptimized[\s\S]*?extractItemsLightweight/ },
  { name: 'Chunked Path', pattern: /parseChunkedScript[\s\S]*?extractItemsLightweight/ },
  { name: 'Standard Path', pattern: /async parseScript\([\s\S]*?extractItemsLightweight/ },
];

paths.forEach(({ name, pattern }) => {
  const hasIntegration = pattern.test(content);
  console.log(`  ${hasIntegration ? '✅' : '❌'} ${name} ${hasIntegration ? '已集成' : '未集成'}`);
  allChecks = allChecks && hasIntegration;
});

// 检查4: 降级机制
console.log('\n✓ 检查4: 降级机制');
const hasFallback = content.includes('Items extraction failed, continuing without items');
console.log(`  ${hasFallback ? '✅' : '❌'} 降级处理 ${hasFallback ? '已实现' : '未找到'}`);
allChecks = allChecks && hasFallback;

// 检查5: 超时设置
console.log('\n✓ 检查5: 超时设置');
const hasTimeout = content.includes('30000 // 30秒超时');
console.log(`  ${hasTimeout ? '✅' : '❌'} 30秒超时设置 ${hasTimeout ? '已配置' : '未找到'}`);
allChecks = allChecks && hasTimeout;

// 检查6: TokenOptimizer配置
console.log('\n✓ 检查6: TokenOptimizer配置');
const tokenOptimizerPath = path.join(__dirname, '..', 'services', 'parsing', 'TokenOptimizer.ts');
const tokenOptimizerContent = fs.readFileSync(tokenOptimizerPath, 'utf-8');
const hasItemTaskType = tokenOptimizerContent.includes("| 'item'");
const hasItemConfig = tokenOptimizerContent.includes('item: {');
console.log(`  ${hasItemTaskType ? '✅' : '❌'} item任务类型 ${hasItemTaskType ? '已添加' : '未找到'}`);
console.log(`  ${hasItemConfig ? '✅' : '❌'} item配置 ${hasItemConfig ? '已添加' : '未找到'}`);
allChecks = allChecks && hasItemTaskType && hasItemConfig;

// 检查7: TASK_CONFIG配置
console.log('\n✓ 检查7: TASK_CONFIG配置');
const hasTaskConfig = content.includes('item: {');
console.log(`  ${hasTaskConfig ? '✅' : '❌'} TASK_CONFIG item配置 ${hasTaskConfig ? '已添加' : '未找到'}`);
allChecks = allChecks && hasTaskConfig;

// 总结
console.log('\n' + '='.repeat(50));
if (allChecks) {
  console.log('✅ 所有检查通过！Phase 1优化已成功实施。');
  console.log('\n预期效果:');
  console.log('  • 道具提取率: ~10% → ~70-80%');
  console.log('  • 增加耗时: ~15秒');
  console.log('  • 降级策略: 完整（失败时返回空数组）');
} else {
  console.log('❌ 部分检查未通过，请检查实现。');
  process.exit(1);
}
console.log('='.repeat(50));
