/**
 * 配置诊断工具
 *
 * 功能：
 * - 一键诊断模型配置问题
 * - 提供修复建议
 * - 生成诊断报告
 * - 批量修复常见问题
 *
 * @author AI Assistant
 * @version 1.0.0
 */

import type { ModelConfig, ModelCapabilities } from '../../../types';
import { modelConfigManager } from './ModelConfigManager';
import { environmentConfigLoader } from './EnvironmentConfigLoader';
import { modelTemplateRegistry } from '../../../config/modelTemplates';

/**
 * 诊断问题级别
 */
export type IssueSeverity = 'error' | 'warning' | 'info';

/**
 * 诊断问题
 */
export interface DiagnosticIssue {
  id: string;
  severity: IssueSeverity;
  field: string;
  message: string;
  code: string;
  configId: string;
  configName: string;
  suggestion?: string;
  autoFixable: boolean;
  fix?: () => Partial<ModelConfig>;
}

/**
 * 诊断报告
 */
export interface DiagnosticReport {
  timestamp: string;
  totalConfigs: number;
  issues: DiagnosticIssue[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    autoFixable: number;
  };
  recommendations: string[];
}

/**
 * 修复结果
 */
export interface FixResult {
  fixed: number;
  failed: number;
  skipped: number;
  details: { issueId: string; success: boolean; error?: string }[];
}

/**
 * Provider特定诊断规则
 */
interface ProviderDiagnosticRule {
  provider: string;
  check: (config: ModelConfig) => DiagnosticIssue[];
}

/**
 * 配置诊断器
 */
export class ConfigDiagnostics {
  private rules: ProviderDiagnosticRule[] = [];

  constructor() {
    this.initializeRules();
  }

  /**
   * 初始化诊断规则
   */
  private initializeRules(): void {
    // 火山方舟诊断规则
    this.rules.push({
      provider: 'volcengine',
      check: config => {
        const issues: DiagnosticIssue[] = [];

        // 检查API地址格式
        if (config.baseUrl && !config.baseUrl.includes('volces.com')) {
          issues.push({
            id: `volc_url_${config.id}`,
            severity: 'warning',
            field: 'baseUrl',
            message: '火山方舟API地址格式可能不正确',
            code: 'VOLC_INVALID_URL',
            configId: config.id,
            configName: config.name,
            suggestion: '火山方舟API地址通常格式为: https://ark.cn-beijing.volces.com/api/v3/',
            autoFixable: false,
          });
        }

        // 检查API密钥格式
        if (config.apiKey && !config.apiKey.startsWith('sk-')) {
          issues.push({
            id: `volc_key_${config.id}`,
            severity: 'warning',
            field: 'apiKey',
            message: '火山方舟API密钥格式可能不正确',
            code: 'VOLC_INVALID_KEY_FORMAT',
            configId: config.id,
            configName: config.name,
            suggestion: '火山方舟API密钥通常以 "sk-" 开头',
            autoFixable: false,
          });
        }

        return issues;
      },
    });

    // 阿里云百炼诊断规则
    this.rules.push({
      provider: 'aliyun',
      check: config => {
        const issues: DiagnosticIssue[] = [];

        // 检查API地址
        if (
          config.baseUrl &&
          !config.baseUrl.includes('aliyun.com') &&
          !config.baseUrl.includes('aliyuncs.com')
        ) {
          issues.push({
            id: `ali_url_${config.id}`,
            severity: 'warning',
            field: 'baseUrl',
            message: '阿里云百炼API地址格式可能不正确',
            code: 'ALI_INVALID_URL',
            configId: config.id,
            configName: config.name,
            suggestion: '阿里云百炼API地址通常包含 aliyun.com 或 aliyuncs.com',
            autoFixable: false,
          });
        }

        return issues;
      },
    });

    // OpenAI诊断规则
    this.rules.push({
      provider: 'openai',
      check: config => {
        const issues: DiagnosticIssue[] = [];

        // 检查是否为第三方兼容服务
        if (config.baseUrl && !config.baseUrl.includes('openai.com')) {
          issues.push({
            id: `openai_third_${config.id}`,
            severity: 'info',
            field: 'baseUrl',
            message: '检测到非官方OpenAI地址，可能是第三方兼容服务',
            code: 'OPENAI_THIRD_PARTY',
            configId: config.id,
            configName: config.name,
            suggestion: '请确保第三方服务完全兼容OpenAI API格式',
            autoFixable: false,
          });
        }

        return issues;
      },
    });

    // 魔搭社区诊断规则
    this.rules.push({
      provider: 'modelscope',
      check: config => {
        const issues: DiagnosticIssue[] = [];

        if (environmentConfigLoader.isProduction()) {
          issues.push({
            id: `ms_prod_${config.id}`,
            severity: 'error',
            field: 'provider',
            message: '生产环境禁止使用魔搭社区API',
            code: 'MS_PROD_FORBIDDEN',
            configId: config.id,
            configName: config.name,
            suggestion: '请迁移到火山方舟、阿里云百炼等商用服务',
            autoFixable: false,
          });
        } else {
          issues.push({
            id: `ms_dev_${config.id}`,
            severity: 'info',
            field: 'provider',
            message: '魔搭社区API仅适合开发测试',
            code: 'MS_DEV_ONLY',
            configId: config.id,
            configName: config.name,
            suggestion: '生产环境请使用商用API服务',
            autoFixable: false,
          });
        }

        return issues;
      },
    });
  }

  /**
   * 诊断单个配置
   */
  diagnoseConfig(config: ModelConfig): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = [];

    // 基础验证
    issues.push(...this.runBasicChecks(config));

    // Provider特定验证
    const providerRule = this.rules.find(r => r.provider === config.provider);
    if (providerRule) {
      issues.push(...providerRule.check(config));
    }

    // 能力配置验证
    issues.push(...this.runCapabilityChecks(config));

    // 参数验证
    issues.push(...this.runParameterChecks(config));

    return issues;
  }

  /**
   * 基础检查
   */
  private runBasicChecks(config: ModelConfig): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = [];

    // 名称检查
    if (!config.name || config.name.trim() === '') {
      issues.push({
        id: `name_empty_${config.id}`,
        severity: 'error',
        field: 'name',
        message: '模型名称不能为空',
        code: 'NAME_EMPTY',
        configId: config.id,
        configName: config.name || '未命名',
        autoFixable: false,
      });
    }

    // 模型ID检查
    if (!config.modelId || config.modelId.trim() === '') {
      issues.push({
        id: `modelid_empty_${config.id}`,
        severity: 'error',
        field: 'modelId',
        message: '模型ID不能为空',
        code: 'MODEL_ID_EMPTY',
        configId: config.id,
        configName: config.name,
        autoFixable: false,
      });
    }

    // Provider检查
    if (!config.provider || config.provider.trim() === '') {
      issues.push({
        id: `provider_empty_${config.id}`,
        severity: 'error',
        field: 'provider',
        message: 'Provider不能为空',
        code: 'PROVIDER_EMPTY',
        configId: config.id,
        configName: config.name,
        autoFixable: false,
      });
    }

    // API密钥检查
    if (!config.apiKey || config.apiKey.trim() === '') {
      issues.push({
        id: `apikey_empty_${config.id}`,
        severity: 'warning',
        field: 'apiKey',
        message: 'API密钥为空',
        code: 'API_KEY_EMPTY',
        configId: config.id,
        configName: config.name,
        suggestion: '请配置API密钥，或确保通过环境变量提供',
        autoFixable: false,
      });
    }

    // BaseUrl检查
    if (!config.baseUrl || config.baseUrl.trim() === '') {
      issues.push({
        id: `baseurl_empty_${config.id}`,
        severity: 'warning',
        field: 'baseUrl',
        message: 'API地址为空',
        code: 'BASE_URL_EMPTY',
        configId: config.id,
        configName: config.name,
        suggestion: '部分Provider需要配置API地址',
        autoFixable: false,
      });
    }

    return issues;
  }

  /**
   * 能力配置检查
   */
  private runCapabilityChecks(config: ModelConfig): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = [];

    if (!config.capabilities) {
      issues.push({
        id: `caps_missing_${config.id}`,
        severity: 'error',
        field: 'capabilities',
        message: '模型能力配置缺失',
        code: 'CAPABILITIES_MISSING',
        configId: config.id,
        configName: config.name,
        autoFixable: true,
        fix: () => ({
          capabilities: this.inferCapabilities(config.type),
        }),
      });
      return issues;
    }

    const caps = config.capabilities;

    // 根据类型检查能力
    switch (config.type) {
      case 'image':
        if (!caps.textToImage && !caps.imageToImage) {
          issues.push({
            id: `caps_no_image_${config.id}`,
            severity: 'warning',
            field: 'capabilities',
            message: '图像模型未启用任何图像生成能力',
            code: 'NO_IMAGE_CAPABILITY',
            configId: config.id,
            configName: config.name,
            suggestion: '建议启用 textToImage 或 imageToImage 能力',
            autoFixable: true,
            fix: () => ({
              capabilities: { ...caps, textToImage: true },
            }),
          });
        }
        break;

      case 'video':
        if (!caps.imageToVideo && !caps.textToVideo) {
          issues.push({
            id: `caps_no_video_${config.id}`,
            severity: 'warning',
            field: 'capabilities',
            message: '视频模型未启用任何视频生成能力',
            code: 'NO_VIDEO_CAPABILITY',
            configId: config.id,
            configName: config.name,
            suggestion: '建议启用 imageToVideo 或 textToVideo 能力',
            autoFixable: true,
            fix: () => ({
              capabilities: { ...caps, imageToVideo: true },
            }),
          });
        }
        break;

      case 'llm':
        if (!caps.textToText) {
          issues.push({
            id: `caps_no_llm_${config.id}`,
            severity: 'warning',
            field: 'capabilities',
            message: 'LLM模型未启用文本生成能力',
            code: 'NO_LLM_CAPABILITY',
            configId: config.id,
            configName: config.name,
            suggestion: '建议启用 textToText 能力',
            autoFixable: true,
            fix: () => ({
              capabilities: { ...caps, textToText: true },
            }),
          });
        }
        break;
    }

    return issues;
  }

  /**
   * 参数检查
   */
  private runParameterChecks(config: ModelConfig): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = [];

    if (!config.parameters) return issues;

    for (const param of config.parameters) {
      // 检查参数名称
      if (!param.name || param.name.trim() === '') {
        issues.push({
          id: `param_name_${config.id}_${Math.random()}`,
          severity: 'error',
          field: 'parameters',
          message: '存在未命名参数',
          code: 'PARAM_NAME_EMPTY',
          configId: config.id,
          configName: config.name,
          autoFixable: false,
        });
      }

      // 数值范围检查
      if (param.type === 'number') {
        if (param.min !== undefined && param.max !== undefined && param.min > param.max) {
          issues.push({
            id: `param_range_${config.id}_${param.name}`,
            severity: 'error',
            field: `parameters.${param.name}`,
            message: `参数 ${param.name} 的最小值大于最大值`,
            code: 'PARAM_RANGE_INVALID',
            configId: config.id,
            configName: config.name,
            suggestion: `交换最小值(${param.min})和最大值(${param.max})`,
            autoFixable: true,
            fix: () => ({
              parameters: config.parameters?.map(p =>
                p.name === param.name ? { ...p, min: param.max, max: param.min } : p
              ),
            }),
          });
        }
      }

      // 选择型参数检查
      if (param.type === 'select' && (!param.options || param.options.length === 0)) {
        issues.push({
          id: `param_options_${config.id}_${param.name}`,
          severity: 'warning',
          field: `parameters.${param.name}`,
          message: `选择型参数 ${param.name} 没有选项`,
          code: 'PARAM_NO_OPTIONS',
          configId: config.id,
          configName: config.name,
          suggestion: '为选择型参数添加选项列表',
          autoFixable: false,
        });
      }
    }

    return issues;
  }

  /**
   * 生成完整诊断报告
   */
  generateReport(configs?: ModelConfig[]): DiagnosticReport {
    const targetConfigs = configs || modelConfigManager.getAllConfigs();
    const allIssues: DiagnosticIssue[] = [];

    for (const config of targetConfigs) {
      allIssues.push(...this.diagnoseConfig(config));
    }

    // 生成建议
    const recommendations = this.generateRecommendations(allIssues);

    return {
      timestamp: new Date().toISOString(),
      totalConfigs: targetConfigs.length,
      issues: allIssues,
      summary: {
        errors: allIssues.filter(i => i.severity === 'error').length,
        warnings: allIssues.filter(i => i.severity === 'warning').length,
        infos: allIssues.filter(i => i.severity === 'info').length,
        autoFixable: allIssues.filter(i => i.autoFixable).length,
      },
      recommendations,
    };
  }

  /**
   * 生成建议
   */
  private generateRecommendations(issues: DiagnosticIssue[]): string[] {
    const recommendations: string[] = [];
    const errorCodes = new Set(issues.map(i => i.code));

    if (errorCodes.has('API_KEY_EMPTY')) {
      recommendations.push('建议为所有模型配置API密钥，或设置对应的环境变量');
    }

    if (errorCodes.has('VOLC_INVALID_URL') || errorCodes.has('ALI_INVALID_URL')) {
      recommendations.push('请检查Provider API地址格式，参考官方文档配置正确的接入点');
    }

    if (errorCodes.has('MS_PROD_FORBIDDEN')) {
      recommendations.push('生产环境请移除魔搭社区配置，迁移到商用API服务');
    }

    if (errorCodes.has('CAPABILITIES_MISSING') || errorCodes.has('NO_IMAGE_CAPABILITY')) {
      recommendations.push('建议为模型配置完整的能力参数，确保功能正常使用');
    }

    if (issues.filter(i => i.severity === 'error').length > 5) {
      recommendations.push('检测到较多配置错误，建议使用模板重新创建配置');
    }

    return recommendations;
  }

  /**
   * 自动修复问题
   */
  autoFix(issueIds?: string[]): FixResult {
    const report = this.generateReport();
    const issuesToFix = issueIds
      ? report.issues.filter(i => issueIds.includes(i.id) && i.autoFixable)
      : report.issues.filter(i => i.autoFixable);

    const result: FixResult = {
      fixed: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };

    for (const issue of issuesToFix) {
      try {
        if (issue.fix) {
          const fix = issue.fix();
          modelConfigManager.updateConfig(issue.configId, fix);
          result.fixed++;
          result.details.push({ issueId: issue.id, success: true });
        } else {
          result.skipped++;
          result.details.push({ issueId: issue.id, success: false, error: '无修复方案' });
        }
      } catch (error) {
        result.failed++;
        result.details.push({
          issueId: issue.id,
          success: false,
          error: error instanceof Error ? error.message : '修复失败',
        });
      }
    }

    return result;
  }

  /**
   * 推断能力配置
   */
  private inferCapabilities(type: string): ModelCapabilities {
    switch (type) {
      case 'image':
        return { textToImage: true, imageToImage: false };
      case 'video':
        return { imageToVideo: true, textToVideo: false };
      case 'llm':
        return { textToText: true };
      default:
        return {};
    }
  }

  /**
   * 导出诊断报告
   */
  exportReport(report: DiagnosticReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * 获取快速修复建议
   */
  getQuickFixSuggestions(configId: string): { issue: DiagnosticIssue; action: string }[] {
    const config = modelConfigManager.getConfig(configId);
    if (!config) return [];

    const issues = this.diagnoseConfig(config);
    return issues
      .filter(i => i.autoFixable)
      .map(i => ({
        issue: i,
        action: this.getFixActionDescription(i),
      }));
  }

  /**
   * 获取修复操作描述
   */
  private getFixActionDescription(issue: DiagnosticIssue): string {
    switch (issue.code) {
      case 'CAPABILITIES_MISSING':
        return '自动推断并补全能力配置';
      case 'NO_IMAGE_CAPABILITY':
        return '启用 textToImage 能力';
      case 'NO_VIDEO_CAPABILITY':
        return '启用 imageToVideo 能力';
      case 'NO_LLM_CAPABILITY':
        return '启用 textToText 能力';
      case 'PARAM_RANGE_INVALID':
        return '交换最小值和最大值';
      default:
        return '自动修复';
    }
  }
}

// 全局单例
export const configDiagnostics = new ConfigDiagnostics();

// 便捷导出
export default configDiagnostics;
