/**
 * DurationBudgetStatusPanel - 时长预算配置状态面板
 *
 * 显示当前配置的有效性、依赖状态和优化建议
 *
 * @module components/DurationBudget/DurationBudgetStatusPanel
 * @version 1.0.0
 */

import React from 'react';
import { Card, CardBody } from '@heroui/react';
import { CheckCircle, AlertCircle, AlertTriangle, Film, Sparkles, Shield } from 'lucide-react';

export interface DurationBudgetConfig {
  platform: string;
  pace: string;
  useDurationBudget: boolean;
  useProductionPrompt: boolean;
  useShotQC: boolean;
}

export interface DurationBudgetStatusPanelProps {
  config: DurationBudgetConfig;
  t: any;
}

export const DurationBudgetStatusPanel: React.FC<DurationBudgetStatusPanelProps> = ({
  config,
  t,
}) => {
  // 计算配置状态
  const getConfigStatus = () => {
    const { useDurationBudget, useProductionPrompt } = config;

    // 基础配置完成检查
    const basicConfigComplete = config.platform && config.pace;

    // 核心功能状态
    let coreFeatureStatus: 'active' | 'inactive' | 'dependency-missing' = 'inactive';
    if (useDurationBudget && useProductionPrompt) {
      coreFeatureStatus = 'active';
    } else if (useDurationBudget && !useProductionPrompt) {
      coreFeatureStatus = 'dependency-missing';
    }

    // 高级功能状态
    const advancedFeatureStatus = config.useShotQC ? 'active' : 'inactive';

    return {
      basicConfigComplete,
      coreFeatureStatus,
      advancedFeatureStatus,
    };
  };

  const status = getConfigStatus();

  // 获取平台显示名称
  const getPlatformName = (platform: string) => {
    const platformMap: Record<string, string> = {
      douyin: '抖音',
      kuaishou: '快手',
      bilibili: 'B站',
      premium: '精品',
    };
    return platformMap[platform] || platform;
  };

  // 获取节奏显示名称
  const getPaceName = (pace: string) => {
    const paceMap: Record<string, string> = {
      fast: '快',
      normal: '中',
      slow: '慢',
    };
    return paceMap[pace] || pace;
  };

  return (
    <Card className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
      <CardBody className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 bg-primary rounded-full" />
          <h3 className="text-[15px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
            {t.settings.durationBudget?.configStatus || '配置状态'}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 基础配置状态 */}
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
            <div
              className={`p-2 rounded-lg ${status.basicConfigComplete ? 'bg-primary/10' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              <Film
                className={`w-5 h-5 ${status.basicConfigComplete ? 'text-primary' : 'text-slate-400'}`}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {t.settings.durationBudget?.basicConfig || '基础配置'}
                </span>
                {status.basicConfigComplete ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {status.basicConfigComplete
                  ? `${getPlatformName(config.platform)} · ${getPaceName(config.pace)}`
                  : t.settings.durationBudget?.basicConfigIncomplete || '请选择平台和节奏'}
              </p>
            </div>
          </div>

          {/* 核心功能状态 */}
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
            <div
              className={`p-2 rounded-lg ${
                status.coreFeatureStatus === 'active'
                  ? 'bg-success/10'
                  : status.coreFeatureStatus === 'dependency-missing'
                    ? 'bg-warning/10'
                    : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <Sparkles
                className={`w-5 h-5 ${
                  status.coreFeatureStatus === 'active'
                    ? 'text-success'
                    : status.coreFeatureStatus === 'dependency-missing'
                      ? 'text-warning'
                      : 'text-slate-400'
                }`}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {t.settings.durationBudget?.coreFeatures || '核心功能'}
                </span>
                {status.coreFeatureStatus === 'active' && (
                  <CheckCircle className="w-4 h-4 text-success" />
                )}
                {status.coreFeatureStatus === 'dependency-missing' && (
                  <AlertTriangle className="w-4 h-4 text-warning" />
                )}
                {status.coreFeatureStatus === 'inactive' && (
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {status.coreFeatureStatus === 'active'
                  ? t.settings.durationBudget?.coreFeatureActive || '已生效'
                  : status.coreFeatureStatus === 'dependency-missing'
                    ? t.settings.durationBudget?.coreFeatureDependencyMissing || '缺少生产级Prompt'
                    : t.settings.durationBudget?.coreFeatureInactive || '未启用'}
              </p>
            </div>
          </div>

          {/* 高级功能状态 */}
          <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
            <div
              className={`p-2 rounded-lg ${status.advancedFeatureStatus === 'active' ? 'bg-warning/10' : 'bg-slate-100 dark:bg-slate-800'}`}
            >
              <Shield
                className={`w-5 h-5 ${status.advancedFeatureStatus === 'active' ? 'text-warning' : 'text-slate-400'}`}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  {t.settings.durationBudget?.advancedFeatures || '高级功能'}
                </span>
                {status.advancedFeatureStatus === 'active' ? (
                  <CheckCircle className="w-4 h-4 text-warning" />
                ) : (
                  <span className="text-xs text-slate-400">{t.common?.optional || '可选'}</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {status.advancedFeatureStatus === 'active'
                  ? t.settings.durationBudget?.shotQCEnabled || '分镜质检已启用'
                  : t.settings.durationBudget?.shotQCDisabled || '分镜质检未启用'}
              </p>
            </div>
          </div>
        </div>

        {/* 配置建议 */}
        {status.coreFeatureStatus === 'dependency-missing' && (
          <div className="mt-4 p-3 bg-warning/10 border border-warning/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning">
                  {t.settings.durationBudget?.dependencyWarning || '配置警告'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {t.settings.durationBudget?.dependencyWarningDesc ||
                    '您已启用"时长预算规划"，但未启用"生产级Prompt"。时长预算约束需要通过生产级Prompt才能生效。建议同时开启两个功能。'}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default DurationBudgetStatusPanel;
