/**
 * 模型配置系统自动验证脚本
 * 在浏览器控制台中运行此脚本进行完整验证
 */

import { modelConfigManager } from '../core/ModelConfigManager';
import { environmentConfigLoader } from '../core/EnvironmentConfigLoader';
import { providerHealthChecker } from '../core/ProviderHealthChecker';
import { configDiagnostics } from '../core/ConfigDiagnostics';
import { smartRouter } from '../core/SmartRouter';
import { modelTemplateRegistry } from '../../../config/modelTemplates';

export interface VerificationResult {
  step: string;
  passed: boolean;
  details: any;
  errors?: string[];
}

export class ModelConfigVerifier {
  private results: VerificationResult[] = [];

  async runAllVerifications(): Promise<VerificationResult[]> {
    console.log('========================================');
    console.log('🚀 开始模型配置系统验证');
    console.log('========================================\n');

    // 步骤1: 基础功能验证
    await this.verifyBasicFunctions();

    // 步骤2: 环境隔离验证
    await this.verifyEnvironmentIsolation();

    // 步骤3: 配置诊断验证
    await this.verifyConfigDiagnostics();

    // 步骤4: 智能路由验证
    await this.verifySmartRouting();

    // 步骤5: Provider健康检查验证
    await this.verifyHealthCheck();

    // 步骤6: 模板系统验证
    await this.verifyTemplateSystem();

    // 汇总结果
    this.printSummary();

    return this.results;
  }

  private async verifyBasicFunctions(): Promise<void> {
    console.log('📋 步骤1: 基础功能验证');
    console.log('------------------------');

    const errors: string[] = [];
    const details: any = {};

    try {
      // 验证模型配置管理器
      const allModels = modelConfigManager.getAllConfigs();
      details.totalModels = allModels.length;
      console.log(`  ✓ 模型总数: ${allModels.length}`);

      if (allModels.length === 0) {
        errors.push('模型列表为空');
      }

      // 按类型统计
      const imageModels = modelConfigManager.getConfigsByType('image');
      const videoModels = modelConfigManager.getConfigsByType('video');
      const llmModels = modelConfigManager.getConfigsByType('llm');

      details.imageModels = imageModels.length;
      details.videoModels = videoModels.length;
      details.llmModels = llmModels.length;

      console.log(`  ✓ 图像模型: ${imageModels.length}`);
      console.log(`  ✓ 视频模型: ${videoModels.length}`);
      console.log(`  ✓ LLM模型: ${llmModels.length}`);

      // 验证启用的模型
      const enabledModels = modelConfigManager.getEnabledConfigs();
      details.enabledModels = enabledModels.length;
      console.log(`  ✓ 启用模型: ${enabledModels.length}`);
    } catch (error) {
      errors.push(`基础功能验证失败: ${error}`);
    }

    const passed = errors.length === 0;
    this.results.push({ step: '基础功能验证', passed, details, errors });
    console.log(passed ? '  ✅ 通过\n' : '  ❌ 失败\n');
  }

  private async verifyEnvironmentIsolation(): Promise<void> {
    console.log('📋 步骤2: 环境隔离验证');
    console.log('------------------------');

    const errors: string[] = [];
    const details: any = {};

    try {
      // 验证环境检测
      const environment = environmentConfigLoader.getCurrentEnvironment();
      details.environment = environment;
      console.log(`  ✓ 当前环境: ${environment}`);

      // 验证是否为生产环境
      const isProd = environmentConfigLoader.isProduction();
      details.isProduction = isProd;
      console.log(`  ✓ 是否生产环境: ${isProd}`);

      // 验证安全提示
      const warnings = environmentConfigLoader.getSecurityWarnings();
      details.securityWarnings = warnings.length;
      console.log(`  ✓ 安全提示数量: ${warnings.length}`);
      warnings.forEach((w, i) => console.log(`    ${i + 1}. ${w}`));

      // 验证魔搭社区模型标记
      const allModels = modelConfigManager.getAllConfigs();
      const msModels = allModels.filter(m => m.provider === 'modelscope');
      details.msModelsCount = msModels.length;

      if (msModels.length > 0) {
        const label = environmentConfigLoader.getModelEnvironmentLabel(msModels[0]);
        details.msModelLabel = label;
        console.log(`  ✓ 魔搭社区模型数量: ${msModels.length}`);
        console.log(`  ✓ 魔搭社区模型标签: ${label?.label || '无'}`);

        if (label?.label !== '开发测试') {
          errors.push('魔搭社区模型未被正确标记为开发测试');
        }
      }
    } catch (error) {
      errors.push(`环境隔离验证失败: ${error}`);
    }

    const passed = errors.length === 0;
    this.results.push({ step: '环境隔离验证', passed, details, errors });
    console.log(passed ? '  ✅ 通过\n' : '  ❌ 失败\n');
  }

  private async verifyConfigDiagnostics(): Promise<void> {
    console.log('📋 步骤3: 配置诊断验证');
    console.log('------------------------');

    const errors: string[] = [];
    const details: any = {};

    try {
      // 生成诊断报告
      const report = configDiagnostics.generateReport();

      details.totalConfigs = report.totalConfigs;
      details.errors = report.summary.errors;
      details.warnings = report.summary.warnings;
      details.infos = report.summary.infos;
      details.autoFixable = report.summary.autoFixable;

      console.log(`  ✓ 配置总数: ${report.totalConfigs}`);
      console.log(`  ✓ 错误数: ${report.summary.errors}`);
      console.log(`  ✓ 警告数: ${report.summary.warnings}`);
      console.log(`  ✓ 信息数: ${report.summary.infos}`);
      console.log(`  ✓ 可自动修复: ${report.summary.autoFixable}`);

      // 显示建议
      if (report.recommendations.length > 0) {
        console.log('  ✓ 建议:');
        report.recommendations.forEach((r, i) => console.log(`    ${i + 1}. ${r}`));
      }

      // 检查是否有严重错误
      if (report.summary.errors > 5) {
        errors.push(`发现 ${report.summary.errors} 个错误，需要检查`);
      }
    } catch (error) {
      errors.push(`配置诊断验证失败: ${error}`);
    }

    const passed = errors.length === 0;
    this.results.push({ step: '配置诊断验证', passed, details, errors });
    console.log(passed ? '  ✅ 通过\n' : '  ❌ 失败\n');
  }

  private async verifySmartRouting(): Promise<void> {
    console.log('📋 步骤4: 智能路由验证');
    console.log('------------------------');

    const errors: string[] = [];
    const details: any = {};

    try {
      // 测试图像路由
      const imageRoute = await smartRouter.route({
        type: 'image',
        capability: 'textToImage',
      });

      if (imageRoute) {
        details.imageRoute = {
          providerId: imageRoute.providerId,
          strategy: imageRoute.strategy,
          reason: imageRoute.reason,
        };
        console.log(`  ✓ 图像路由: ${imageRoute.providerId} (${imageRoute.strategy})`);
      } else {
        errors.push('图像路由失败：无可用Provider');
      }

      // 测试视频路由
      const videoRoute = await smartRouter.route({
        type: 'video',
        capability: 'imageToVideo',
      });

      if (videoRoute) {
        details.videoRoute = {
          providerId: videoRoute.providerId,
          strategy: videoRoute.strategy,
          reason: videoRoute.reason,
        };
        console.log(`  ✓ 视频路由: ${videoRoute.providerId} (${videoRoute.strategy})`);
      } else {
        console.log('  ⚠️ 视频路由: 无可用Provider（可能正常，如果没有视频模型）');
      }

      // 测试LLM路由
      const llmRoute = await smartRouter.route({
        type: 'llm',
        capability: 'textToText',
      });

      if (llmRoute) {
        details.llmRoute = {
          providerId: llmRoute.providerId,
          strategy: llmRoute.strategy,
          reason: llmRoute.reason,
        };
        console.log(`  ✓ LLM路由: ${llmRoute.providerId} (${llmRoute.strategy})`);
      } else {
        console.log('  ⚠️ LLM路由: 无可用Provider（可能正常，如果没有LLM模型）');
      }
    } catch (error) {
      errors.push(`智能路由验证失败: ${error}`);
    }

    const passed = errors.length === 0 && details.imageRoute;
    this.results.push({ step: '智能路由验证', passed, details, errors });
    console.log(passed ? '  ✅ 通过\n' : '  ❌ 失败\n');
  }

  private async verifyHealthCheck(): Promise<void> {
    console.log('📋 步骤5: Provider健康检查验证');
    console.log('------------------------');

    const errors: string[] = [];
    const details: any = {};

    try {
      // 获取健康统计
      const stats = providerHealthChecker.getStatistics();

      details.total = stats.total;
      details.healthy = stats.healthy;
      details.degraded = stats.degraded;
      details.unhealthy = stats.unhealthy;
      details.unknown = stats.unknown;

      console.log(`  ✓ Provider总数: ${stats.total}`);
      console.log(`  ✓ 健康: ${stats.healthy}`);
      console.log(`  ✓ 降级: ${stats.degraded}`);
      console.log(`  ✓ 不健康: ${stats.unhealthy}`);
      console.log(`  ✓ 未知: ${stats.unknown}`);

      // 获取所有健康状态
      const allHealth = providerHealthChecker.getAllHealth();
      details.providers = Array.from(allHealth.keys());

      console.log('  ✓ Provider列表:');
      allHealth.forEach((health, id) => {
        console.log(`    - ${id}: ${health.overallStatus}`);
      });
    } catch (error) {
      errors.push(`健康检查验证失败: ${error}`);
    }

    const passed = errors.length === 0;
    this.results.push({ step: 'Provider健康检查验证', passed, details, errors });
    console.log(passed ? '  ✅ 通过\n' : '  ❌ 失败\n');
  }

  private async verifyTemplateSystem(): Promise<void> {
    console.log('📋 步骤6: 模板系统验证');
    console.log('------------------------');

    const errors: string[] = [];
    const details: any = {};

    try {
      // 获取所有模板
      const templates = modelTemplateRegistry.getAllTemplates();

      details.totalTemplates = templates.length;
      console.log(`  ✓ 模板总数: ${templates.length}`);

      // 按类型统计
      const imageTemplates = templates.filter(t => t.type === 'image');
      const videoTemplates = templates.filter(t => t.type === 'video');
      const llmTemplates = templates.filter(t => t.type === 'llm');

      details.imageTemplates = imageTemplates.length;
      details.videoTemplates = videoTemplates.length;
      details.llmTemplates = llmTemplates.length;

      console.log(`  ✓ 图像模板: ${imageTemplates.length}`);
      console.log(`  ✓ 视频模板: ${videoTemplates.length}`);
      console.log(`  ✓ LLM模板: ${llmTemplates.length}`);

      // 列出所有模板
      console.log('  ✓ 模板列表:');
      templates.forEach((t, i) => {
        console.log(`    ${i + 1}. ${t.name} (${t.type})`);
      });

      if (templates.length === 0) {
        errors.push('模板列表为空');
      }
    } catch (error) {
      errors.push(`模板系统验证失败: ${error}`);
    }

    const passed = errors.length === 0;
    this.results.push({ step: '模板系统验证', passed, details, errors });
    console.log(passed ? '  ✅ 通过\n' : '  ❌ 失败\n');
  }

  private printSummary(): void {
    console.log('========================================');
    console.log('📊 验证结果汇总');
    console.log('========================================');

    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;

    console.log(`\n总测试数: ${total}`);
    console.log(`✅ 通过: ${passed}`);
    console.log(`❌ 失败: ${failed}`);
    console.log(`\n通过率: ${((passed / total) * 100).toFixed(1)}%\n`);

    // 显示详细结果
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${index + 1}. ${result.step}`);

      if (!result.passed && result.errors) {
        result.errors.forEach(e => console.log(`   错误: ${e}`));
      }
    });

    console.log('\n========================================');
    if (failed === 0) {
      console.log('🎉 所有验证通过！系统运行正常。');
    } else {
      console.log(`⚠️ 有 ${failed} 项验证失败，请检查上述错误。`);
    }
    console.log('========================================');
  }
}

// 导出单例
export const verifier = new ModelConfigVerifier();

// 便捷函数
export async function runVerification(): Promise<VerificationResult[]> {
  return verifier.runAllVerifications();
}

export default verifier;
