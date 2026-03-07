/**
 * ParseConfigConfirmModal - 解析配置确认弹窗
 * 
 * 在解析前显示配置信息，让用户确认后再执行解析
 * 避免无意识的高成本操作
 * 
 * V2.0 更新：添加时长预算配置推荐
 * - 集成平台模板快速选择
 * - 集成智能配置引擎
 * - 显示当前配置 vs 推荐配置对比
 * 
 * @module components/ParseConfigConfirmModal
 * @version 2.0.0
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Badge,
  Tooltip,
  Card,
  CardBody,
  Switch
} from '@heroui/react';
import { FileText, Coins, AlertTriangle, Info, Lightbulb, CheckCircle, Smartphone, Video, Monitor, Film, Clock, Sparkles, Shield } from 'lucide-react';

// 平台模板配置
interface PlatformTemplate {
  id: string;
  name: string;
  icon: React.ReactNode;
  config: {
    platform: string;
    pace: string;
    useDurationBudget: boolean;
    useProductionPrompt: boolean;
    useShotQC: boolean;
  };
  estimatedDuration: string;
  recommendedShots: string;
}

// 智能推荐配置
interface SmartRecommendation {
  mode: 'lightweight' | 'professional' | 'advanced';
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
}

interface ParseConfigConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  scriptTitle: string;
  wordCount: number;
  modelName: string;
  parseMode: string;
  // 新增：时长预算配置
  durationBudgetConfig?: {
    platform: string;
    pace: string;
    useDurationBudget: boolean;
    useProductionPrompt: boolean;
    useShotQC: boolean;
  };
  // 新增：配置变更回调
  onConfigChange?: (config: any) => void;
}

export const ParseConfigConfirmModal: React.FC<ParseConfigConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  scriptTitle,
  wordCount,
  modelName,
  parseMode,
  durationBudgetConfig: externalConfig,
  onConfigChange
}) => {
  // 本地配置状态（如果外部没有提供）
  const [localConfig, setLocalConfig] = useState({
    platform: 'douyin',
    pace: 'normal',
    useDurationBudget: false,
    useProductionPrompt: false,
    useShotQC: false,
  });

  // 使用外部配置或本地配置
  const config = externalConfig || localConfig;
  const setConfig = externalConfig && onConfigChange 
    ? (newConfig: any) => onConfigChange(newConfig)
    : setLocalConfig;

  // 重置配置当弹窗打开时
  useEffect(() => {
    if (isOpen && externalConfig) {
      setLocalConfig(externalConfig);
    }
  }, [isOpen, externalConfig]);

  // 预估 Token 数量
  const estimateTokenCount = (wordCount: number) => {
    // 中文字符约 0.5-1 Token/字
    return Math.ceil(wordCount * 0.8);
  };

  const estimatedTokens = estimateTokenCount(wordCount);
  const isLongText = wordCount > 50000;

  // 平台模板定义
  const platformTemplates: PlatformTemplate[] = [
    {
      id: 'douyin',
      name: '抖音短剧',
      icon: <Smartphone className="w-4 h-4" />,
      config: {
        platform: 'douyin',
        pace: 'fast',
        useDurationBudget: true,
        useProductionPrompt: true,
        useShotQC: false,
      },
      estimatedDuration: '3-5分钟',
      recommendedShots: '25-35个',
    },
    {
      id: 'kuaishou',
      name: '快手短剧',
      icon: <Video className="w-4 h-4" />,
      config: {
        platform: 'kuaishou',
        pace: 'normal',
        useDurationBudget: true,
        useProductionPrompt: true,
        useShotQC: false,
      },
      estimatedDuration: '4-6分钟',
      recommendedShots: '30-40个',
    },
    {
      id: 'bilibili',
      name: 'B站视频',
      icon: <Monitor className="w-4 h-4" />,
      config: {
        platform: 'bilibili',
        pace: 'normal',
        useDurationBudget: true,
        useProductionPrompt: true,
        useShotQC: true,
      },
      estimatedDuration: '5-10分钟',
      recommendedShots: '40-60个',
    },
    {
      id: 'premium',
      name: '精品短剧',
      icon: <Film className="w-4 h-4" />,
      config: {
        platform: 'premium',
        pace: 'slow',
        useDurationBudget: true,
        useProductionPrompt: true,
        useShotQC: true,
      },
      estimatedDuration: '8-15分钟',
      recommendedShots: '60-90个',
    },
  ];

  // 生成智能推荐
  const generateSmartRecommendation = (): SmartRecommendation => {
    if (wordCount < 3000) {
      return {
        mode: 'lightweight',
        recommendedConfig: {
          platform: 'douyin',
          pace: 'fast',
          useDurationBudget: false,
          useProductionPrompt: false,
          useShotQC: false,
        },
        estimatedDuration: '1-2分钟',
        recommendedShots: '10-15个',
        reason: '短文本（<3000字）生成视频时长较短，使用标准配置即可',
      };
    } else if (wordCount <= 8000) {
      return {
        mode: 'professional',
        recommendedConfig: {
          platform: 'douyin',
          pace: 'fast',
          useDurationBudget: true,
          useProductionPrompt: true,
          useShotQC: false,
        },
        estimatedDuration: '3-5分钟',
        recommendedShots: '25-35个',
        reason: '中篇文本（3000-8000字）建议开启时长预算规划，确保内容符合平台规范',
      };
    } else {
      return {
        mode: 'advanced',
        recommendedConfig: {
          platform: 'bilibili',
          pace: 'normal',
          useDurationBudget: true,
          useProductionPrompt: true,
          useShotQC: true,
        },
        estimatedDuration: '8-12分钟',
        recommendedShots: '50-70个',
        reason: '长篇文本（>8000字）需要严格的时长预算规划，建议选择B站平台',
      };
    }
  };

  const smartRecommendation = generateSmartRecommendation();

  // 检查当前配置是否与推荐配置一致
  const isConfigMatchingRecommendation = () => {
    return (
      config.platform === smartRecommendation.recommendedConfig.platform &&
      config.pace === smartRecommendation.recommendedConfig.pace &&
      config.useDurationBudget === smartRecommendation.recommendedConfig.useDurationBudget &&
      config.useProductionPrompt === smartRecommendation.recommendedConfig.useProductionPrompt &&
      config.useShotQC === smartRecommendation.recommendedConfig.useShotQC
    );
  };

  // 应用平台模板
  const applyTemplate = (template: PlatformTemplate) => {
    setConfig(template.config);
  };

  // 应用智能推荐
  const applySmartRecommendation = () => {
    setConfig(smartRecommendation.recommendedConfig);
  };

  // 切换开关
  const toggleSwitch = (key: string, value: boolean) => {
    if (key === 'useDurationBudget' && value) {
      // 开启时长预算时，自动开启生产级Prompt
      setConfig({
        ...config,
        useDurationBudget: true,
        useProductionPrompt: true,
      });
    } else if (key === 'useProductionPrompt' && !value && config.useDurationBudget) {
      // 关闭生产级Prompt时，如果时长预算已开启，同时关闭时长预算
      setConfig({
        ...config,
        useProductionPrompt: false,
        useDurationBudget: false,
      });
    } else {
      setConfig({
        ...config,
        [key]: value,
      });
    }
  };

  // 获取提示信息
  const getWarnings = () => {
    const warnings = [];

    if (isLongText) {
      warnings.push({
        type: 'warning' as const,
        icon: AlertTriangle,
        message: `检测到长篇小说（${Math.round(wordCount / 10000)}万字），解析将消耗较多 Token`
      });
    }

    // 检查配置是否适合当前文本
    if (wordCount >= 3000 && !config.useDurationBudget) {
      warnings.push({
        type: 'info' as const,
        icon: Info,
        message: '当前文本较长，建议开启时长预算规划以获得更好的效果'
      });
    }

    return warnings;
  };

  const warnings = getWarnings();

  // 获取平台显示名称
  const getPlatformName = (platform: string) => {
    const platformNames: Record<string, string> = {
      'douyin': '抖音',
      'kuaishou': '快手',
      'bilibili': 'B站',
      'premium': '精品',
    };
    return platformNames[platform] || platform;
  };

  // 获取节奏显示名称
  const getPaceName = (pace: string) => {
    const paceNames: Record<string, string> = {
      'fast': '快',
      'normal': '中',
      'slow': '慢',
    };
    return paceNames[pace] || pace;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            确认解析配置
          </div>
        </ModalHeader>

        <ModalBody className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 小说信息 */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">
              📄 小说信息
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">标题：</span>
                <span className="font-medium truncate max-w-[200px]">{scriptTitle || '未命名'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">字数：</span>
                <span className="font-medium">{wordCount.toLocaleString()} 字（约 {(wordCount / 10000).toFixed(1)} 万字）</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">预估 Token：</span>
                <Tooltip content="基于字数估算">
                  <span className="font-medium text-primary">~{estimatedTokens.toLocaleString()}</span>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* 智能配置推荐 */}
          {!isConfigMatchingRecommendation() && (
            <Card className="border border-primary/30 bg-primary/5 dark:bg-primary/10">
              <CardBody className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary rounded-lg">
                    <Lightbulb className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[15px] font-bold text-slate-900 dark:text-white">
                      💡 智能配置推荐
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      基于您的文本（{wordCount.toLocaleString()}字），系统推荐以下配置：
                    </p>

                    <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
                          {smartRecommendation.mode === 'lightweight' ? '轻量级模式' : 
                           smartRecommendation.mode === 'professional' ? '专业模式' : '高级模式'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">平台：</span>
                          <span className="font-medium">{getPlatformName(smartRecommendation.recommendedConfig.platform)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">节奏：</span>
                          <span className="font-medium">{getPaceName(smartRecommendation.recommendedConfig.pace)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">时长预算：</span>
                          <span className="font-medium">
                            {smartRecommendation.recommendedConfig.useDurationBudget ? '✅ 开启' : '❌ 关闭'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">生产级Prompt：</span>
                          <span className="font-medium">
                            {smartRecommendation.recommendedConfig.useProductionPrompt ? '✅ 开启' : '❌ 关闭'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>⏱️ 预计时长：{smartRecommendation.estimatedDuration}</span>
                          <span>🎬 推荐分镜：{smartRecommendation.recommendedShots}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mt-3">
                      💡 {smartRecommendation.reason}
                    </p>

                    <Button
                      size="sm"
                      color="primary"
                      onPress={applySmartRecommendation}
                      startContent={<CheckCircle className="w-4 h-4" />}
                      className="mt-3"
                    >
                      应用推荐配置
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* 平台模板快速选择 */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">
              🚀 平台模板快速选择
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {platformTemplates.map((template) => (
                <Button
                  key={template.id}
                  variant="flat"
                  className={`h-auto py-3 px-4 justify-start ${
                    config.platform === template.config.platform &&
                    config.pace === template.config.pace &&
                    config.useDurationBudget === template.config.useDurationBudget
                      ? 'bg-primary/20 border-primary'
                      : ''
                  }`}
                  onPress={() => applyTemplate(template)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {template.icon}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-gray-500">
                        {template.estimatedDuration} · {template.recommendedShots}
                      </div>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* 当前配置状态 */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm text-gray-600 dark:text-gray-400">
              ⚙️ 当前时长预算配置
            </h4>

            {/* 基础配置 */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">目标平台</span>
                <Badge variant="flat" size="sm">{getPlatformName(config.platform)}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">节奏</span>
                <Badge variant="flat" size="sm">{getPaceName(config.pace)}</Badge>
              </div>
            </div>

            {/* 功能开关 */}
            <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              {/* 时长预算 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm">启用时长预算规划</span>
                </div>
                <Switch
                  isSelected={config.useDurationBudget}
                  onValueChange={(val) => toggleSwitch('useDurationBudget', val)}
                  size="sm"
                />
              </div>

              {/* 生产级Prompt */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-success" />
                  <span className="text-sm">启用生产级Prompt</span>
                  {config.useDurationBudget && !config.useProductionPrompt && (
                    <span className="text-xs text-warning">（建议开启）</span>
                  )}
                </div>
                <Switch
                  isSelected={config.useProductionPrompt}
                  onValueChange={(val) => toggleSwitch('useProductionPrompt', val)}
                  size="sm"
                />
              </div>

              {/* 分镜质检 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-warning" />
                  <span className="text-sm">启用分镜质检</span>
                </div>
                <Switch
                  isSelected={config.useShotQC}
                  onValueChange={(val) => toggleSwitch('useShotQC', val)}
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* 提示信息 */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.map((warning, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                    warning.type === 'warning'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                      : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}
                >
                  <warning.icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* 配置说明 */}
          <div className="text-xs text-gray-500 text-center">
            <span>
              {config.useDurationBudget 
                ? `已启用时长预算规划，预计生成 ${smartRecommendation.estimatedDuration} 视频`
                : '使用标准解析模式，不启用时长预算规划'
              }
            </span>
          </div>
        </ModalBody>

        <ModalFooter className="flex justify-end gap-3">
          <Button variant="flat" onPress={onClose}>
            取消
          </Button>
          <Button color="primary" onPress={onConfirm}>
            开始解析
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ParseConfigConfirmModal;
