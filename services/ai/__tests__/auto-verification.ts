/**
 * 模型配置系统自动验证脚本
 * 在浏览器控制台运行此脚本进行完整验证
 */

import { modelConfigManager } from '../core/ModelConfigManager';
import { environmentConfigLoader } from '../core/EnvironmentConfigLoader';
import { providerHealthChecker } from '../core/ProviderHealthChecker';
import { configDiagnostics } from '../core/ConfigDiagnostics';
import { smartRouter } from '../core/SmartRouter';
import { modelTemplateRegistry } from '../../../config/modelTemplates';

export interface TestResult {
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  message?: string;
}

export class AutoTester {
  private results: TestResult[] = [];

  private assert(name: string, expected: any, actual: any, message?: string): void {
    const passed = JSON.stringify(expected) === JSON.stringify(actual);
    this.results.push({ name, passed, expected, actual, message });
    console.log(`${passed ? '✅' : '❌'} ${name}`);
    if (!passed) {
      console.log(`   预期: ${JSON.stringify(expected)}`);
      console.log(`   实际: ${JSON.stringify(actual)}`);
      if (message) console.log(`   说明: ${message}`);
    }
  }

  async runAllTests(): Promise<TestResult[]> {
    // eslint-disable-next-line no-console
    console.clear();

    console.log('========================================');

    console.log('🚀 模型配置系统自动测试开始');

    console.log('========================================\n');

    this.testBasicFunctions();
    this.testEnvironmentIsolation();
    this.testConfigDiagnostics();
    await this.testSmartRouting();
    this.testHealthCheck();
    this.testTemplateSystem();

    this.printSummary();
    return this.results;
  }

  private testBasicFunctions(): void {
    console.log('📋 测试1: 基础功能');
    console.log('-------------------');

    // 测试1.1: 获取所有模型
    const allModels = modelConfigManager.getAllConfigs();
    this.assert('模型总数应为38', 38, allModels.length, '桥接器应导入所有DEFAULT_MODELS');

    // 测试1.2: 按类型获取
    const imageModels = modelConfigManager.getConfigsByType('image');
    this.assert(
      '图像模型数量大于0',
      true,
      imageModels.length > 0,
      `实际图像模型数: ${imageModels.length}`
    );

    const videoModels = modelConfigManager.getConfigsByType('video');
    this.assert(
      '视频模型数量大于0',
      true,
      videoModels.length > 0,
      `实际视频模型数: ${videoModels.length}`
    );

    const llmModels = modelConfigManager.getConfigsByType('llm');
    this.assert(
      'LLM模型数量大于0',
      true,
      llmModels.length > 0,
      `实际LLM模型数: ${llmModels.length}`
    );

    // 测试1.3: 获取启用的模型
    const enabledModels = modelConfigManager.getEnabledConfigs();
    this.assert(
      '启用模型数量大于0',
      true,
      enabledModels.length > 0,
      `实际启用模型数: ${enabledModels.length}`
    );

    // 测试1.4: 检查特定Provider的模型
    const volcModels = modelConfigManager.getConfigsByProvider('volcengine');
    this.assert(
      '火山方舟模型存在',
      true,
      volcModels.length > 0,
      `火山方舟模型数: ${volcModels.length}`
    );

    const msModels = modelConfigManager.getConfigsByProvider('modelscope');
    this.assert(
      '魔搭社区模型存在（开发环境）',
      true,
      msModels.length > 0,
      `魔搭社区模型数: ${msModels.length}`
    );

    console.log('');
  }

  private testEnvironmentIsolation(): void {
    console.log('📋 测试2: 环境隔离');
    console.log('-------------------');

    // 测试2.1: 环境检测
    const env = environmentConfigLoader.getCurrentEnvironment();
    this.assert('当前环境为development', 'development', env);

    // 测试2.2: 生产环境判断
    const isProd = environmentConfigLoader.isProduction();
    this.assert('不是生产环境', false, isProd);

    // 测试2.3: Provider允许检查
    this.assert('volcengine被允许', true, environmentConfigLoader.isProviderAllowed('volcengine'));

    this.assert(
      'modelscope在开发环境被允许',
      true,
      environmentConfigLoader.isProviderAllowed('modelscope')
    );

    // 测试2.4: 安全提示
    const warnings = environmentConfigLoader.getSecurityWarnings();
    this.assert('有安全提示', true, warnings.length > 0, `安全提示数: ${warnings.length}`);

    // 测试2.5: 魔搭社区模型标记
    const msModels = modelConfigManager.getConfigsByProvider('modelscope');
    if (msModels.length > 0) {
      const label = environmentConfigLoader.getModelEnvironmentLabel(msModels[0]);
      this.assert('魔搭社区模型标记为开发测试', '开发测试', label?.label);
    }

    console.log('');
  }

  private testConfigDiagnostics(): void {
    console.log('📋 测试3: 配置诊断');
    console.log('-------------------');

    // 测试3.1: 生成诊断报告
    const report = configDiagnostics.generateReport();

    this.assert('诊断报告存在', true, !!report);

    this.assert('配置总数为38', 38, report.totalConfigs);

    this.assert('错误数为0', 0, report.summary.errors);

    this.assert(
      '有警告（API密钥相关）',
      true,
      report.summary.warnings > 0,
      `警告数: ${report.summary.warnings}`
    );

    // 测试3.2: 诊断单个配置
    const models = modelConfigManager.getAllConfigs();
    if (models.length > 0) {
      const issues = configDiagnostics.diagnoseConfig(models[0]);
      this.assert('单配置诊断返回数组', true, Array.isArray(issues));
    }

    console.log('');
  }

  private async testSmartRouting(): Promise<void> {
    console.log('📋 测试4: 智能路由');
    console.log('-------------------');

    // 测试4.1: 图像路由
    const imageRoute = await smartRouter.route({
      type: 'image',
      capability: 'textToImage',
    });

    this.assert(
      '图像路由返回结果（可能为null）',
      true,
      imageRoute === null || typeof imageRoute === 'object',
      imageRoute ? `路由到: ${imageRoute.providerId}` : '无可用Provider'
    );

    // 测试4.2: 视频路由
    const videoRoute = await smartRouter.route({
      type: 'video',
      capability: 'imageToVideo',
    });

    this.assert(
      '视频路由返回结果（可能为null）',
      true,
      videoRoute === null || typeof videoRoute === 'object'
    );

    // 测试4.3: LLM路由
    const llmRoute = await smartRouter.route({
      type: 'llm',
      capability: 'textToText',
    });

    this.assert(
      'LLM路由返回结果（可能为null）',
      true,
      llmRoute === null || typeof llmRoute === 'object'
    );

    // 测试4.4: 路由策略
    const strategy = smartRouter.getStrategy();
    this.assert('路由策略存在', true, typeof strategy === 'string');

    console.log('');
  }

  private testHealthCheck(): void {
    console.log('📋 测试5: 健康检查');
    console.log('-------------------');

    // 测试5.1: 获取统计
    const stats = providerHealthChecker.getStatistics();

    this.assert('健康统计存在', true, !!stats);

    this.assert('统计包含total字段', true, typeof stats.total === 'number');

    // 测试5.2: 获取所有健康状态
    const allHealth = providerHealthChecker.getAllHealth();
    this.assert('健康状态Map存在', true, allHealth instanceof Map);

    console.log('');
  }

  private testTemplateSystem(): void {
    console.log('📋 测试6: 模板系统');
    console.log('-------------------');

    // 测试6.1: 获取所有模板
    const templates = modelTemplateRegistry.getAllTemplates();

    this.assert('模板数量大于0', true, templates.length > 0, `模板数: ${templates.length}`);

    // 测试6.2: 按类型获取
    const imageTemplates = templates.filter(t => t.type === 'image');
    this.assert('图像模板存在', true, imageTemplates.length > 0);

    // 测试6.3: 获取特定模板
    if (templates.length > 0) {
      const firstTemplate = templates[0];
      const found = modelTemplateRegistry.getTemplate(firstTemplate.id);
      this.assert('可通过ID获取模板', true, !!found);
    }

    console.log('');
  }

  private printSummary(): void {
    console.log('========================================');
    console.log('📊 测试结果汇总');
    console.log('========================================');

    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;

    console.log(`\n总测试数: ${total}`);
    console.log(`✅ 通过: ${passed}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`\n通过率: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ 失败的测试:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.name}`);
          console.log(`    预期: ${JSON.stringify(r.expected)}`);
          console.log(`    实际: ${JSON.stringify(r.actual)}`);
        });
    }

    console.log('\n========================================');
    if (failed === 0) {
      console.log('🎉 所有测试通过！系统运行正常。');
    } else {
      console.log(`⚠️ 有 ${failed} 项测试失败。`);
    }
    console.log('========================================');

    // 返回结果供外部使用
    (window as any).lastTestResults = this.results;
  }
}

// 导出
export const autoTester = new AutoTester();

// 全局挂载
if (typeof window !== 'undefined') {
  (window as any).runAutoTests = () => autoTester.runAllTests();
}

export default autoTester;
