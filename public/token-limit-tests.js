/**
 * Token 限制管理系统 - 浏览器控制台测试
 * 在浏览器控制台运行这些测试来验证功能
 */

// 测试配置
const TEST_CONFIG = {
  verbose: true,
  stopOnFail: false
};

// 测试结果统计
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  errors: []
};

// 简单的断言函数
function assert(condition, message) {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    if (TEST_CONFIG.verbose) {
      console.log(`✅ PASS: ${message}`);
    }
  } else {
    testResults.failed++;
    testResults.errors.push(message);
    console.error(`❌ FAIL: ${message}`);
    if (TEST_CONFIG.stopOnFail) {
      throw new Error(`Test failed: ${message}`);
    }
  }
}

// 测试 1: getModelLimits - 已知模型（豆包 lite 32k）
function testGetModelLimitsKnownModel() {
  console.log('\n📋 Test 1: getModelLimits - 已知模型');
  console.log('----------------------------------------');

  try {
    // 需要动态导入模块
    const { getModelLimits } = window.ModelCapabilityManager || {};

    if (!getModelLimits) {
      console.warn('⚠️ ModelCapabilityManager 未挂载到 window，尝试动态导入...');
      // 尝试从模块导入
      import('/services/ai/core/ModelCapabilityManager.ts')
        .then(module => {
          const limits1 = module.getModelLimits('doubao-lite-32k');
          console.log('getModelLimits("doubao-lite-32k"):', limits1);
          assert(limits1?.maxTokens === 4096, '豆包 lite 32k 应该限制 4096 tokens');
          assert(limits1?.provider === 'volcengine', '豆包 lite 32k provider 应该是 volcengine');
        })
        .catch(err => {
          console.error('导入失败:', err);
          assert(false, '无法导入 ModelCapabilityManager 模块');
        });
      return;
    }

    const limits1 = getModelLimits('doubao-lite-32k');
    console.log('getModelLimits("doubao-lite-32k"):', limits1);
    assert(limits1?.maxTokens === 4096, '豆包 lite 32k 应该限制 4096 tokens');
    assert(limits1?.provider === 'volcengine', '豆包 lite 32k provider 应该是 volcengine');
  } catch (error) {
    assert(false, `Test 1 异常: ${error.message}`);
  }
}

// 测试 2: getModelLimits - 模糊匹配
function testGetModelLimitsFuzzyMatch() {
  console.log('\n📋 Test 2: getModelLimits - 模糊匹配');
  console.log('----------------------------------------');

  try {
    const { getModelLimits } = window.ModelCapabilityManager || {};

    if (!getModelLimits) {
      console.warn('⚠️ ModelCapabilityManager 未挂载到 window');
      return;
    }

    // 测试带版本号的模型ID
    const limits2 = getModelLimits('doubao-lite-32k-character-250228');
    console.log('getModelLimits("doubao-lite-32k-character-250228"):', limits2);
    assert(limits2?.maxTokens === 4096, '应该匹配到 doubao-lite-32k 并限制 4096 tokens');

    // 测试另一个变体
    const limits3 = getModelLimits('doubao-lite-4k-240515');
    console.log('getModelLimits("doubao-lite-4k-240515"):', limits3);
    assert(limits3?.maxTokens === 4096, 'doubao-lite-4k-240515 应该限制 4096 tokens');
  } catch (error) {
    assert(false, `Test 2 异常: ${error.message}`);
  }
}

// 测试 3: calculateEffectiveMaxTokens - 超出限制
function testCalculateEffectiveMaxTokensExceed() {
  console.log('\n📋 Test 3: calculateEffectiveMaxTokens - 超出限制');
  console.log('----------------------------------------');

  try {
    const { calculateEffectiveMaxTokens } = window.ModelCapabilityManager || {};

    if (!calculateEffectiveMaxTokens) {
      console.warn('⚠️ ModelCapabilityManager 未挂载到 window');
      return;
    }

    const result1 = calculateEffectiveMaxTokens('doubao-lite-32k', 5000);
    console.log('calculateEffectiveMaxTokens("doubao-lite-32k", 5000):', result1);
    assert(result1.effectiveTokens === 4096, '应该限制到 4096');
    assert(result1.wasLimited === true, '应该标记为受限');
    assert(result1.modelFound === true, '应该找到模型');
    assert(result1.maxAllowed === 4096, 'maxAllowed 应该是 4096');
  } catch (error) {
    assert(false, `Test 3 异常: ${error.message}`);
  }
}

// 测试 4: calculateEffectiveMaxTokens - 未超出限制
function testCalculateEffectiveMaxTokensWithinLimit() {
  console.log('\n📋 Test 4: calculateEffectiveMaxTokens - 未超出限制');
  console.log('----------------------------------------');

  try {
    const { calculateEffectiveMaxTokens } = window.ModelCapabilityManager || {};

    if (!calculateEffectiveMaxTokens) {
      console.warn('⚠️ ModelCapabilityManager 未挂载到 window');
      return;
    }

    const result2 = calculateEffectiveMaxTokens('deepseek-v3', 5000);
    console.log('calculateEffectiveMaxTokens("deepseek-v3", 5000):', result2);
    assert(result2.effectiveTokens === 5000, '应该保持 5000');
    assert(result2.wasLimited === false, '不应该受限');
    assert(result2.modelFound === true, '应该找到模型');
    assert(result2.maxAllowed === 8192, 'maxAllowed 应该是 8192');
  } catch (error) {
    assert(false, `Test 4 异常: ${error.message}`);
  }
}

// 测试 5: validateTokenConfig - 有效配置
function testValidateTokenConfigValid() {
  console.log('\n📋 Test 5: validateTokenConfig - 有效配置');
  console.log('----------------------------------------');

  try {
    const { validateTokenConfig } = window.ModelCapabilityManager || {};

    if (!validateTokenConfig) {
      console.warn('⚠️ ModelCapabilityManager 未挂载到 window');
      return;
    }

    const valid = validateTokenConfig('doubao-lite-32k', 3000);
    console.log('validateTokenConfig("doubao-lite-32k", 3000):', valid);
    assert(valid.valid === true, '3000 tokens 应该有效');
    assert(valid.maxAllowed === 4096, 'maxAllowed 应该是 4096');
  } catch (error) {
    assert(false, `Test 5 异常: ${error.message}`);
  }
}

// 测试 6: validateTokenConfig - 无效配置
function testValidateTokenConfigInvalid() {
  console.log('\n📋 Test 6: validateTokenConfig - 无效配置');
  console.log('----------------------------------------');

  try {
    const { validateTokenConfig } = window.ModelCapabilityManager || {};

    if (!validateTokenConfig) {
      console.warn('⚠️ ModelCapabilityManager 未挂载到 window');
      return;
    }

    const invalid = validateTokenConfig('doubao-lite-32k', 6000);
    console.log('validateTokenConfig("doubao-lite-32k", 6000):', invalid);
    assert(invalid.valid === false, '6000 tokens 应该无效');
    assert(invalid.error !== undefined, '应该返回错误信息');
    assert(invalid.maxAllowed === 4096, 'maxAllowed 应该是 4096');
  } catch (error) {
    assert(false, `Test 6 异常: ${error.message}`);
  }
}

// 测试 7: 未知模型
function testUnknownModel() {
  console.log('\n📋 Test 7: 未知模型处理');
  console.log('----------------------------------------');

  try {
    const { getModelLimits, calculateEffectiveMaxTokens, validateTokenConfig } = window.ModelCapabilityManager || {};

    if (!getModelLimits) {
      console.warn('⚠️ ModelCapabilityManager 未挂载到 window');
      return;
    }

    // 测试未知模型
    const limits = getModelLimits('unknown-model-xyz');
    console.log('getModelLimits("unknown-model-xyz"):', limits);
    assert(limits === undefined, '未知模型应该返回 undefined');

    const result = calculateEffectiveMaxTokens('unknown-model-xyz', 5000);
    console.log('calculateEffectiveMaxTokens("unknown-model-xyz", 5000):', result);
    assert(result.effectiveTokens === 5000, '未知模型应该使用请求的 tokens');
    assert(result.wasLimited === false, '未知模型不应该受限');
    assert(result.modelFound === false, '应该标记为未找到模型');

    const validation = validateTokenConfig('unknown-model-xyz', 5000);
    console.log('validateTokenConfig("unknown-model-xyz", 5000):', validation);
    assert(validation.valid === true, '未知模型应该返回 valid: true');
    assert(validation.suggestion !== undefined, '应该提供建议信息');
  } catch (error) {
    assert(false, `Test 7 异常: ${error.message}`);
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Token 限制管理系统 - 单元测试                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // 重置结果
  testResults = { passed: 0, failed: 0, total: 0, errors: [] };

  // 尝试动态导入模块
  try {
    console.log('\n📦 正在加载 ModelCapabilityManager 模块...');
    const module = await import('/src/services/ai/core/ModelCapabilityManager.ts');
    window.ModelCapabilityManager = module;
    console.log('✅ 模块加载成功');
  } catch (err) {
    console.warn('⚠️ 无法直接导入 TypeScript 模块，请确保在 Vite 开发环境中运行');
    console.warn('错误:', err.message);
  }

  // 运行测试
  testGetModelLimitsKnownModel();
  testGetModelLimitsFuzzyMatch();
  testCalculateEffectiveMaxTokensExceed();
  testCalculateEffectiveMaxTokensWithinLimit();
  testValidateTokenConfigValid();
  testValidateTokenConfigInvalid();
  testUnknownModel();

  // 输出测试报告
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     测试报告                                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📊 总计: ${testResults.total} 个测试`);
  console.log(`✅ 通过: ${testResults.passed} 个`);
  console.log(`❌ 失败: ${testResults.failed} 个`);

  if (testResults.failed > 0) {
    console.log('\n❌ 失败的测试:');
    testResults.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  } else {
    console.log('\n🎉 所有测试通过！');
  }

  return testResults;
}

// 挂载到 window
window.TokenLimitTests = {
  runAllTests,
  testGetModelLimitsKnownModel,
  testGetModelLimitsFuzzyMatch,
  testCalculateEffectiveMaxTokensExceed,
  testCalculateEffectiveMaxTokensWithinLimit,
  testValidateTokenConfigValid,
  testValidateTokenConfigInvalid,
  testUnknownModel
};

console.log('✅ Token 限制测试脚本已加载');
console.log('运行测试请执行: window.TokenLimitTests.runAllTests()');
