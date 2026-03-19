// 批量音频操作性能测试脚本
import { performance } from 'node:perf_hooks';
import { audioService } from '../services/audio.js';

// 测试配置
const TEST_CONFIG = {
  batchSizes: [10, 20, 50], // 测试不同批量大小
  iterations: 3, // 每个批量大小测试的迭代次数
  projectId: 'test-project',
  modelConfigId: 'aliyun-tts-1',
};

// 生成测试数据
const generateTestData = (count, type) => {
  const testData = [];
  for (let i = 0; i < count; i++) {
    if (type === 'dialogue') {
      testData.push(`这是测试对话 ${i + 1}，用于测试批量音频生成的性能和稳定性。`);
    } else if (type === 'sound') {
      testData.push(`测试音效 ${i + 1}，模拟环境声音效果。`);
    } else {
      testData.push(`测试音乐 ${i + 1}，轻松愉快的背景音乐。`);
    }
  }
  return testData;
};

// 测试批量音频生成性能
const testBatchAudioGeneration = async (batchSize, audioType) => {
  console.log(`\n测试批量${audioType === 'dialogue' ? '对话' : audioType === 'sound' ? '音效' : '音乐'}生成，批量大小: ${batchSize}`);
  
  const testData = generateTestData(batchSize, audioType);
  const options = {
    modelConfigId: TEST_CONFIG.modelConfigId,
    projectId: TEST_CONFIG.projectId,
  };
  
  let totalTime = 0;
  
  for (let i = 0; i < TEST_CONFIG.iterations; i++) {
    console.log(`  迭代 ${i + 1}/${TEST_CONFIG.iterations}`);
    
    const start = performance.now();
    try {
      let results;
      if (audioType === 'dialogue') {
        results = await audioService.batchGenerateSpeech(testData, options);
      } else if (audioType === 'sound') {
        results = await audioService.batchGenerateSound(testData, options);
      } else {
        results = await audioService.batchGenerateMusic(testData, options);
      }
      
      const end = performance.now();
      const duration = end - start;
      totalTime += duration;
      
      console.log(`    完成时间: ${duration.toFixed(2)}ms`);
      console.log(`    生成数量: ${results.length}`);
      console.log(`    平均每音频时间: ${(duration / results.length).toFixed(2)}ms`);
    } catch (error) {
      console.error(`    测试失败: ${error.message}`);
    }
  }
  
  const averageTime = totalTime / TEST_CONFIG.iterations;
  console.log(`  平均完成时间: ${averageTime.toFixed(2)}ms`);
  console.log(`  平均每音频时间: ${(averageTime / batchSize).toFixed(2)}ms`);
  
  return averageTime;
};

// 测试批量音频预览性能
const testBatchAudioPreview = async (batchSize) => {
  console.log(`\n测试批量音频预览，批量大小: ${batchSize}`);
  
  // 先生成测试音频
  const testData = generateTestData(batchSize, 'dialogue');
  const options = {
    modelConfigId: TEST_CONFIG.modelConfigId,
    projectId: TEST_CONFIG.projectId,
  };
  
  console.log('  生成测试音频...');
  const audios = await audioService.batchGenerateSpeech(testData, options);
  console.log(`  生成完成，共 ${audios.length} 个音频`);
  
  // 测试批量预览
  let totalTime = 0;
  
  for (let i = 0; i < TEST_CONFIG.iterations; i++) {
    console.log(`  迭代 ${i + 1}/${TEST_CONFIG.iterations}`);
    
    const start = performance.now();
    try {
      const previewUrls = await Promise.all(
        audios.map(audio => audioService.getAudioUrl(audio.path))
      );
      
      const end = performance.now();
      const duration = end - start;
      totalTime += duration;
      
      console.log(`    完成时间: ${duration.toFixed(2)}ms`);
      console.log(`    预览URL数量: ${previewUrls.length}`);
      console.log(`    平均每音频时间: ${(duration / previewUrls.length).toFixed(2)}ms`);
    } catch (error) {
      console.error(`    测试失败: ${error.message}`);
    }
  }
  
  const averageTime = totalTime / TEST_CONFIG.iterations;
  console.log(`  平均完成时间: ${averageTime.toFixed(2)}ms`);
  console.log(`  平均每音频时间: ${(averageTime / batchSize).toFixed(2)}ms`);
  
  return averageTime;
};

// 主测试函数
const runTests = async () => {
  console.log('开始批量音频操作性能测试');
  console.log('==================================');
  
  // 测试批量音频生成
  for (const batchSize of TEST_CONFIG.batchSizes) {
    await testBatchAudioGeneration(batchSize, 'dialogue');
    await testBatchAudioGeneration(batchSize, 'sound');
    await testBatchAudioGeneration(batchSize, 'music');
  }
  
  // 测试批量音频预览
  for (const batchSize of TEST_CONFIG.batchSizes) {
    await testBatchAudioPreview(batchSize);
  }
  
  console.log('==================================');
  console.log('批量音频操作性能测试完成');
};

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };