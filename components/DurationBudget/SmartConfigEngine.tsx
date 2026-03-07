/**
 * SmartConfigEngine - 智能配置引擎
 *
 * 基于小说字数和目标平台，智能推荐最优配置
 *
 * @module components/DurationBudget/SmartConfigEngine
 * @version 1.0.0
 */

import React from 'react';
import { Card, CardBody, Button } from '@heroui/react';
import { Lightbulb, CheckCircle, X } from 'lucide-react';

export interface SmartRecommendation {
  novelLength: number;
  lengthCategory: 'short' | 'medium' | 'long';
  recommendedConfig: {
    platform: string;
    pace: string;
    useDurationBudget: boolean;
    useProductionPrompt: boolean;
    useShotQC: boolean;
  };
  estimatedDuration: string;
  recommendedShots: string;
  reason: string;
  mode: 'lightweight' | 'professional' | 'advanced';
}

export interface SmartConfigEngineProps {
  novelLength: number;
  currentConfig: {
    platform: string;
    pace: string;
    useDurationBudget: boolean;
    useProductionPrompt: boolean;
    useShotQC: boolean;
  };
  onApplyRecommendation: (recommendation: SmartRecommendation) => void;
  onDismiss: () => void;
  t: any;
}

export const SmartConfigEngine: React.FC<SmartConfigEngineProps> = ({
  novelLength,
  currentConfig,
  onApplyRecommendation,
  onDismiss,
  t
}) => {
  // 生成智能推荐
  const generateRecommendation = (): SmartRecommendation => {
    let lengthCategory: 'short' | 'medium' | 'long';
    let mode: 'lightweight' | 'professional' | 'advanced';
    let recommendedConfig: SmartRecommendation['recommendedConfig'];
    let estimatedDuration: string;
    let recommendedShots: string;
    let reason: string;

    if (novelLength < 3000) {
      // 短文本
      lengthCategory = 'short';
      mode = 'lightweight';
      recommendedConfig = {
        platform: 'douyin',
        pace: 'fast',
        useDurationBudget: false,
        useProductionPrompt: false,
        useShotQC: false,
      };
      estimatedDuration = '1-2分钟';
      recommendedShots = '10-15个';
      reason = t.settings.durationBudget?.shortTextReason || 
        '短文本（<3000字）生成视频时长通常在1-2分钟，不需要复杂的时长预算规划。使用标准Prompt即可获得良好的生成效果。';
    } else if (novelLength <= 8000) {
      // 中文本
      lengthCategory = 'medium';
      mode = 'professional';
      recommendedConfig = {
        platform: 'douyin',
        pace: 'fast',
        useDurationBudget: true,
        useProductionPrompt: true,
        useShotQC: false,
      };
      estimatedDuration = '3-5分钟';
      recommendedShots = '25-35个';
      reason = t.settings.durationBudget?.mediumTextReason || 
        '中篇文本（3000-8000字）生成视频时长通常在3-5分钟，需要时长预算规划来确保内容符合平台规范。';
    } else {
      // 长文本
      lengthCategory = 'long';
      mode = 'advanced';
      recommendedConfig = {
        platform: 'bilibili',
        pace: 'normal',
        useDurationBudget: true,
        useProductionPrompt: true,
        useShotQC: true,
      };
      estimatedDuration = '8-12分钟';
      recommendedShots = '50-70个';
      reason = t.settings.durationBudget?.longTextReason || 
        '长篇文本（>8000字）需要分块解析和严格的时长预算规划。建议选择B站平台（支持更长视频）或精品模式。';
    }

    return {
      novelLength,
      lengthCategory,
      recommendedConfig,
      estimatedDuration,
      recommendedShots,
      reason,
      mode,
    };
  };

  const recommendation = generateRecommendation();

  // 检查当前配置是否与推荐配置一致
  const isConfigMatching = () => {
    return (
      currentConfig.platform === recommendation.recommendedConfig.platform &&
      currentConfig.pace === recommendation.recommendedConfig.pace &&
      currentConfig.useDurationBudget === recommendation.recommendedConfig.useDurationBudget &&
      currentConfig.useProductionPrompt === recommendation.recommendedConfig.useProductionPrompt &&
      currentConfig.useShotQC === recommendation.recommendedConfig.useShotQC
    );
  };

  // 如果配置已经匹配，不显示推荐
  if (isConfigMatching()) {
    return null;
  }

  const getModeName = (mode: string) => {
    const modeNames: Record<string, string> = {
      'lightweight': t.settings.durationBudget?.lightweightMode || '轻量级模式',
      'professional': t.settings.durationBudget?.professionalMode || '专业模式',
      'advanced': t.settings.durationBudget?.advancedMode || '高级模式',
    };
    return modeNames[mode] || mode;
  };

  const getPlatformName = (platform: string) => {
    const platformNames: Record<string, string> = {
      'douyin': '抖音',
      'kuaishou': '快手',
      'bilibili': 'B站',
      'premium': '精品',
    };
    return platformNames[platform] || platform;
  };

  const getPaceName = (pace: string) => {
    const paceNames: Record<string, string> = {
      'fast': '快',
      'normal': '中',
      'slow': '慢',
    };
    return paceNames[pace] || pace;
  };

  return (
    <Card className="border border-primary/30 bg-primary/5 dark:bg-primary/10">
      <CardBody className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary rounded-lg">
            <Lightbulb className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-[15px] font-bold text-slate-900 dark:text-white">
                {t.settings.durationBudget?.smartRecommendation || '智能配置推荐'}
              </h4>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={onDismiss}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {t.settings.durationBudget?.basedOnWordCount?.replace('{count}', novelLength.toString()) || 
                `基于您的文本（${novelLength}字），系统推荐以下配置：`}
            </p>

            <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
                  {getModeName(recommendation.mode)}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{t.settings.durationBudget?.platformLabel || '平台'}:</span>
                  <span className="font-medium">{getPlatformName(recommendation.recommendedConfig.platform)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{t.settings.durationBudget?.paceLabel || '节奏'}:</span>
                  <span className="font-medium">{getPaceName(recommendation.recommendedConfig.pace)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{t.settings.durationBudget?.durationBudget || '时长预算'}:</span>
                  <span className="font-medium">
                    {recommendation.recommendedConfig.useDurationBudget ? '✅' : '❌'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{t.settings.durationBudget?.productionPrompt || '生产级Prompt'}:</span>
                  <span className="font-medium">
                    {recommendation.recommendedConfig.useProductionPrompt ? '✅' : '❌'}
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>⏱️ {t.settings.durationBudget?.estimatedDuration || '预计时长'}: {recommendation.estimatedDuration}</span>
                  <span>🎬 {t.settings.durationBudget?.recommendedShots || '推荐分镜'}: {recommendation.recommendedShots}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-3">
              💡 {recommendation.reason}
            </p>

            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                color="primary"
                onPress={() => onApplyRecommendation(recommendation)}
                startContent={<CheckCircle className="w-4 h-4" />}
              >
                {t.settings.durationBudget?.applyRecommendation || '应用推荐配置'}
              </Button>
              <Button
                size="sm"
                variant="light"
                onPress={onDismiss}
              >
                {t.common?.dismiss || '忽略'}
              </Button>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default SmartConfigEngine;
