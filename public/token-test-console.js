// Token 限制管理系统 - 浏览器控制台测试脚本
// 使用方法：
// 1. 打开浏览器开发者工具 (F12)
// 2. 切换到 Console 面板
// 3. 复制粘贴以下代码并回车执行

(async function runTokenLimitTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Token 限制管理系统 - 单元测试                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      passed++;
      console.log(`✅ PASS: ${message}`);
    } else {
      failed++;
      console.error(`❌ FAIL: ${message}`);
    }
  }

  try {
    // 动态导入模块
    console.log('\n📦 正在加载 ModelCapabilityManager 模块...');
    const module = await import('/src/services/ai/core/ModelCapabilityManager.ts');
    const { getModelLimits, calculateEffectiveMaxTokens, validateTokenConfig, MODEL_LIMITS } =
      module;
    console.log('✅ 模块加载成功\n');

    console.log('📋 开始执行测试...\n');

    // ========== Test 1: getModelLimits - 已知模型 ==========
    console.log('----------------------------------------');
    console.log('Test 1: getModelLimits - 已知模型 (doubao-lite-32k)');
    console.log('----------------------------------------');
    const limits1 = getModelLimits('doubao-lite-32k');
    console.log('结果:', limits1);
    assert(limits1?.maxTokens === 4096, '豆包 lite 32k 应该限制 4096 tokens');
    assert(limits1?.provider === 'volcengine', '豆包 lite 32k provider 应该是 volcengine');
    assert(limits1?.maxInputTokens === 32768, '豆包 lite 32k 输入限制应该是 32768');

    // ========== Test 2: getModelLimits - 模糊匹配 ==========
    console.log('\n----------------------------------------');
    console.log('Test 2: getModelLimits - 模糊匹配');
    console.log('----------------------------------------');
    const limits2 = getModelLimits('doubao-lite-32k-character-250228');
    console.log('getModelLimits("doubao-lite-32k-character-250228"):', limits2);
    assert(
      limits2?.maxTokens === 4096,
      '带版本号的模型应该匹配到 doubao-lite-32k 并限制 4096 tokens'
    );

    const limits3 = getModelLimits('doubao-lite-4k-240515');
    console.log('getModelLimits("doubao-lite-4k-240515"):', limits3);
    assert(limits3?.maxTokens === 4096, 'doubao-lite-4k-240515 应该限制 4096 tokens');

    // ========== Test 3: calculateEffectiveMaxTokens - 超出限制 ==========
    console.log('\n----------------------------------------');
    console.log('Test 3: calculateEffectiveMaxTokens - 超出限制');
    console.log('----------------------------------------');
    const result1 = calculateEffectiveMaxTokens('doubao-lite-32k', 5000);
    console.log('calculateEffectiveMaxTokens("doubao-lite-32k", 5000):', result1);
    assert(result1.effectiveTokens === 4096, '请求 5000 tokens 应该被限制到 4096');
    assert(result1.wasLimited === true, '应该标记为受限 (wasLimited: true)');
    assert(result1.modelFound === true, '应该找到模型 (modelFound: true)');
    assert(result1.maxAllowed === 4096, 'maxAllowed 应该是 4096');

    // ========== Test 4: calculateEffectiveMaxTokens - 未超出限制 ==========
    console.log('\n----------------------------------------');
    console.log('Test 4: calculateEffectiveMaxTokens - 未超出限制');
    console.log('----------------------------------------');
    const result2 = calculateEffectiveMaxTokens('deepseek-v3', 5000);
    console.log('calculateEffectiveMaxTokens("deepseek-v3", 5000):', result2);
    assert(result2.effectiveTokens === 5000, '请求 5000 tokens 应该保持 5000');
    assert(result2.wasLimited === false, '不应该受限 (wasLimited: false)');
    assert(result2.modelFound === true, '应该找到模型 (modelFound: true)');
    assert(result2.maxAllowed === 8192, 'maxAllowed 应该是 8192');

    // ========== Test 5: validateTokenConfig - 有效配置 ==========
    console.log('\n----------------------------------------');
    console.log('Test 5: validateTokenConfig - 有效配置');
    console.log('----------------------------------------');
    const valid = validateTokenConfig('doubao-lite-32k', 3000);
    console.log('validateTokenConfig("doubao-lite-32k", 3000):', valid);
    assert(valid.valid === true, '3000 tokens 应该有效 (valid: true)');
    assert(valid.maxAllowed === 4096, 'maxAllowed 应该是 4096');

    // ========== Test 6: validateTokenConfig - 无效配置 ==========
    console.log('\n----------------------------------------');
    console.log('Test 6: validateTokenConfig - 无效配置');
    console.log('----------------------------------------');
    const invalid = validateTokenConfig('doubao-lite-32k', 6000);
    console.log('validateTokenConfig("doubao-lite-32k", 6000):', invalid);
    assert(invalid.valid === false, '6000 tokens 应该无效 (valid: false)');
    assert(invalid.error !== undefined, '应该返回错误信息');
    assert(invalid.suggestion !== undefined, '应该提供建议信息');
    assert(invalid.maxAllowed === 4096, 'maxAllowed 应该是 4096');

    // ========== Test 7: 未知模型处理 ==========
    console.log('\n----------------------------------------');
    console.log('Test 7: 未知模型处理');
    console.log('----------------------------------------');
    const unknownLimits = getModelLimits('unknown-model-xyz');
    console.log('getModelLimits("unknown-model-xyz"):', unknownLimits);
    assert(unknownLimits === undefined, '未知模型应该返回 undefined');

    const unknownResult = calculateEffectiveMaxTokens('unknown-model-xyz', 5000);
    console.log('calculateEffectiveMaxTokens("unknown-model-xyz", 5000):', unknownResult);
    assert(unknownResult.effectiveTokens === 5000, '未知模型应该使用请求的 tokens');
    assert(unknownResult.wasLimited === false, '未知模型不应该受限');
    assert(unknownResult.modelFound === false, '应该标记为未找到模型 (modelFound: false)');

    const unknownValidation = validateTokenConfig('unknown-model-xyz', 5000);
    console.log('validateTokenConfig("unknown-model-xyz", 5000):', unknownValidation);
    assert(unknownValidation.valid === true, '未知模型应该返回 valid: true');
    assert(unknownValidation.suggestion !== undefined, '应该提供建议信息');

    // ========== Test 8: 图像/视频生成模型 (maxTokens = 0) ==========
    console.log('\n----------------------------------------');
    console.log('Test 8: 图像/视频生成模型 (maxTokens = 0)');
    console.log('----------------------------------------');
    const imageModel = getModelLimits('seedream-4.0');
    console.log('getModelLimits("seedream-4.0"):', imageModel);
    assert(imageModel?.maxTokens === 0, '图像生成模型 maxTokens 应该是 0');

    const imageResult = calculateEffectiveMaxTokens('seedream-4.0', 1000);
    console.log('calculateEffectiveMaxTokens("seedream-4.0", 1000):', imageResult);
    assert(imageResult.effectiveTokens === 1000, '图像模型应该使用请求的 tokens');
    assert(imageResult.wasLimited === false, '图像模型不应该受限');

    // ========== Test 9: Provider + ModelId 组合匹配 ==========
    console.log('\n----------------------------------------');
    console.log('Test 9: Provider + ModelId 组合匹配');
    console.log('----------------------------------------');
    const withProvider = getModelLimits('doubao-lite-32k', 'volcengine');
    console.log('getModelLimits("doubao-lite-32k", "volcengine"):', withProvider);
    assert(withProvider?.maxTokens === 4096, '带 provider 应该正确匹配');

    // ========== Test 10: MODEL_LIMITS 常量检查 ==========
    console.log('\n----------------------------------------');
    console.log('Test 10: MODEL_LIMITS 常量检查');
    console.log('----------------------------------------');
    console.log('MODEL_LIMITS 长度:', MODEL_LIMITS.length);
    assert(MODEL_LIMITS.length > 0, 'MODEL_LIMITS 应该包含配置');
    assert(
      MODEL_LIMITS.some(m => m.modelId === 'doubao-lite-32k'),
      '应该包含 doubao-lite-32k'
    );
    assert(
      MODEL_LIMITS.some(m => m.modelId === 'deepseek-v3'),
      '应该包含 deepseek-v3'
    );

    // ========== 测试报告 ==========
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     测试报告                                               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(`\n📊 总计: ${passed + failed} 个测试`);
    console.log(`✅ 通过: ${passed} 个`);
    console.log(`❌ 失败: ${failed} 个`);

    if (failed === 0) {
      console.log('\n🎉 所有测试通过！Token 限制管理系统工作正常。');
    } else {
      console.log(`\n⚠️ 有 ${failed} 个测试失败，请检查实现。`);
    }

    return { passed, failed, total: passed + failed };
  } catch (error) {
    console.error('\n❌ 测试执行异常:', error);
    console.error('堆栈:', error.stack);
    return { passed: 0, failed: 1, total: 1, error: error.message };
  }
})();
