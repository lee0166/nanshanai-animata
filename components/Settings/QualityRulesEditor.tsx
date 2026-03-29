/**
 * 质量评估规则编辑器
 *
 * 提供可视化界面编辑质量评估的权重和阈值配置
 * 采用Tab切换设计，支持深色/浅色主题
 * 优化版：图标统一、按钮直观、主题适配
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Slider,
  Input,
  Tooltip,
  Tabs,
  Tab,
} from '@heroui/react';
import {
  Settings2,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  Info,
  CheckCircle,
  SlidersHorizontal,
  Gauge,
  User,
  MapPin,
  Camera,
  Film,
  BarChart3,
  Timer,
  Clock,
  AlertOctagon,
  TrendingDown,
} from 'lucide-react';
import type {
  QualityRulesConfig,
  WeightConfig,
  ThresholdConfig,
} from '../../services/parsing/QualityRulesConfig';
import { DEFAULT_QUALITY_RULES } from '../../services/parsing/QualityRulesConfig';
import { getQualityRulesLoader } from '../../services/parsing/QualityRulesLoader';

interface QualityRulesEditorProps {
  t: any;
}

// 维度配置 - 主题适配的颜色
const dimensionConfig: Record<
  string,
  { name: string; color: string; lightColor: string; desc: string }
> = {
  narrativeLogic: {
    name: '叙事逻辑',
    color: '#f97316',
    lightColor: '#ea580c',
    desc: '故事通顺度',
  },
  dramatic: {
    name: '戏剧性',
    color: '#ef4444',
    lightColor: '#dc2626',
    desc: '吸引力张力',
  },
  completeness: {
    name: '完整性',
    color: '#22c55e',
    lightColor: '#16a34a',
    desc: '信息齐全度',
  },
  accuracy: {
    name: '准确性',
    color: '#3b82f6',
    lightColor: '#2563eb',
    desc: '数据格式正确',
  },
  consistency: {
    name: '一致性',
    color: '#a855f7',
    lightColor: '#9333ea',
    desc: '逻辑自洽性',
  },
  usability: {
    name: '可用性',
    color: '#06b6d4',
    lightColor: '#0891b2',
    desc: '生成友好度',
  },
  spatialTemporal: {
    name: '时空逻辑',
    color: '#f59e0b',
    lightColor: '#d97706',
    desc: '视听语言',
  },
};

// 阈值配置 - 使用Lucide图标，主题适配
const thresholdConfig: Record<string, { name: string; icon: React.ElementType; desc: string }> = {
  characterDescriptionLength: {
    name: '角色描述最小字数',
    icon: User,
    desc: '角色生成所需最少信息',
  },
  sceneDescriptionLength: { name: '场景描述最小字数', icon: MapPin, desc: '场景环境氛围描述' },
  minShotsPerScene: { name: '每场景最少分镜', icon: Camera, desc: '基本叙事镜头覆盖' },
  maxShotsPerScene: { name: '每场景最多分镜', icon: Film, desc: '防止节奏拖沓' },
  minShotsTotal: { name: '总分镜数最小值', icon: BarChart3, desc: '短剧基本叙事需求' },
  shotDurationMin: { name: '分镜最短时长', icon: Timer, desc: '观众感知下限(秒)' },
  shotDurationMax: { name: '分镜最长时长', icon: Clock, desc: '避免拖沓上限(秒)' },
  narrativeLogicCollapseThreshold: {
    name: '叙事崩溃阈值',
    icon: AlertOctagon,
    desc: '严重问题判定线',
  },
  completenessMaxWhenNarrativeCollapsed: {
    name: '叙事崩溃时完整性上限',
    icon: TrendingDown,
    desc: '一致性保护机制',
  },
};

export const QualityRulesEditor: React.FC<QualityRulesEditorProps> = ({ t }) => {
  const [config, setConfig] = useState<QualityRulesConfig>(DEFAULT_QUALITY_RULES);
  const [originalConfig, setOriginalConfig] = useState<QualityRulesConfig>(DEFAULT_QUALITY_RULES);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [weightSum, setWeightSum] = useState(1.0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'weights' | 'thresholds'>('weights');

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const loader = getQualityRulesLoader();
        const currentConfig = await loader.getConfig();
        setConfig(currentConfig);
        setOriginalConfig(currentConfig);
        calculateWeightSum(currentConfig);
      } catch (error) {
        console.error('Failed to load quality rules config:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  // 计算权重总和
  const calculateWeightSum = useCallback((cfg: QualityRulesConfig) => {
    const sum = Object.values(cfg.weights).reduce((acc, w) => acc + w.value, 0);
    setWeightSum(sum);
  }, []);

  // 检查是否有变更
  useEffect(() => {
    const changed = JSON.stringify(config) !== JSON.stringify(originalConfig);
    setHasChanges(changed);
  }, [config, originalConfig]);

  // 更新权重
  const handleWeightChange = (dimension: string, value: number) => {
    setConfig(prev => ({
      ...prev,
      weights: {
        ...prev.weights,
        [dimension]: {
          ...prev.weights[dimension],
          value: Math.round(value * 100) / 100,
        },
      },
    }));
    calculateWeightSum({
      ...config,
      weights: {
        ...config.weights,
        [dimension]: {
          ...config.weights[dimension],
          value: Math.round(value * 100) / 100,
        },
      },
    });
    setSaveStatus('idle');
  };

  // 更新阈值
  const handleThresholdChange = (key: string, value: number) => {
    setConfig(prev => ({
      ...prev,
      thresholds: {
        ...prev.thresholds,
        [key]: {
          ...prev.thresholds[key],
          value: Math.round(value),
        },
      },
    }));
    setSaveStatus('idle');
  };

  // 保存配置
  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const loader = getQualityRulesLoader();
      await loader.updateConfig(config);
      setOriginalConfig(config);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveStatus('error');
    }
  };

  // 恢复默认
  const handleReset = async () => {
    if (confirm('确定要恢复默认配置吗？所有自定义设置将丢失。')) {
      const loader = getQualityRulesLoader();
      await loader.resetToDefault();
      const defaultConfig = { ...DEFAULT_QUALITY_RULES };
      setConfig(defaultConfig);
      setOriginalConfig(defaultConfig);
      calculateWeightSum(defaultConfig);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  // 导出配置
  const handleExport = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `quality-rules-${config.version}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // 导入配置
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const imported = JSON.parse(e.target?.result as string) as QualityRulesConfig;
        if (!imported.version || !imported.weights || !imported.thresholds) {
          alert('无效的配置文件格式');
          return;
        }
        setConfig(imported);
        calculateWeightSum(imported);
        setSaveStatus('idle');
      } catch (error) {
        alert('导入失败：' + (error as Error).message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-default-400">加载中...</div>
      </div>
    );
  }

  return (
    <Card
      className="border border-default-200 bg-content1 overflow-hidden shadow-sm"
      radius="lg"
    >
      {/* Header - 优化按钮设计 */}
      <CardHeader className="px-6 py-4 border-b border-default-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-default-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
            <Settings2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">质量评估规则</h2>
            <p className="text-xs text-default-500">
              v{config.version} · {config.lastUpdated}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            id="import-config"
          />
          <label htmlFor="import-config">
            <Button
              as="span"
              variant="flat"
              size="sm"
              startContent={<Upload className="w-4 h-4" />}
              className="text-default-700"
            >
              导入
            </Button>
          </label>
          <Button
            variant="flat"
            size="sm"
            startContent={<Download className="w-4 h-4" />}
            onPress={handleExport}
            className="text-slate-700 dark:text-slate-300"
          >
            导出
          </Button>
          <Button
            variant="flat"
            size="sm"
            startContent={<RotateCcw className="w-4 h-4" />}
            onPress={handleReset}
            className="text-slate-700 dark:text-slate-300"
          >
            重置
          </Button>
          <Button
            onPress={handleSave}
            color={saveStatus === 'saved' ? 'success' : 'primary'}
            variant={saveStatus === 'saved' ? 'flat' : 'solid'}
            size="sm"
            startContent={saveStatus === 'saved' ? <CheckCircle className="w-4 h-4" /> : undefined}
            isLoading={saveStatus === 'saving'}
            isDisabled={!hasChanges || Math.abs(weightSum - 1.0) > 0.01}
            className="font-medium"
          >
            {saveStatus === 'saved' ? '已保存' : '保存'}
          </Button>
        </div>
      </CardHeader>

      {/* 权重警告 */}
      {Math.abs(weightSum - 1.0) > 0.01 && (
        <div className="px-6 py-2 bg-warning/10 border-b border-warning/20">
          <div className="flex items-center gap-2 text-warning text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>权重总和 {(weightSum * 100).toFixed(0)}%，需调整为100%</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <CardBody className="p-0">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={key => setActiveTab(key as 'weights' | 'thresholds')}
          variant="light"
          classNames={{
            tabList:
              'px-6 py-2 gap-1 border-b border-default-200 bg-transparent',
            tab: 'px-4 py-2 text-sm font-medium text-default-600 data-[selected=true]:text-foreground data-[selected=true]:bg-default-100 rounded-lg transition-colors',
            cursor: 'hidden',
            panel: 'p-6',
          }}
        >
          {/* 权重配置 Tab */}
          <Tab
            key="weights"
            title={
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                <span>维度权重</span>
                <span
                  className={`text-xs ${Math.abs(weightSum - 1.0) < 0.01 ? 'text-success' : 'text-warning'}`}
                >
                  {(weightSum * 100).toFixed(0)}%
                </span>
              </div>
            }
          >
            <div className="space-y-2">
              {(Object.entries(config.weights) as [string, WeightConfig][]).map(([key, weight]) => {
                const dim = dimensionConfig[key];
                return (
                  <div
                    key={key}
                    className="group flex items-center gap-4 p-3 rounded-xl bg-default-100 hover:bg-default-200 transition-colors"
                  >
                    {/* 左侧：彩色标识条+名称 */}
                    <div className="flex items-center gap-3 w-36 flex-shrink-0">
                      <div
                        className="w-1.5 h-10 rounded-full"
                        style={{ backgroundColor: dim?.color || '#666' }}
                      />
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {dim?.name || key}
                        </div>
                        <div className="text-[10px] text-default-500">
                          {dim?.desc}
                        </div>
                      </div>
                    </div>

                    {/* 中间：滑块 */}
                    <div className="flex-1 min-w-0 px-2">
                      <Slider
                        value={weight.value}
                        onChange={v => handleWeightChange(key, v as number)}
                        minValue={weight.range[0]}
                        maxValue={weight.range[1]}
                        step={0.01}
                        size="sm"
                        color="primary"
                        classNames={{
                          track: 'h-2 bg-default-300 rounded-full',
                          filler: 'bg-gradient-to-r from-primary/60 to-primary rounded-full',
                          thumb:
                            'w-5 h-5 bg-white border-2 border-primary shadow-md',
                        }}
                      />
                    </div>

                    {/* 右侧：数值 */}
                    <div className="flex items-center gap-1 w-16 flex-shrink-0 justify-end">
                      <span className="text-xl font-bold text-foreground">
                        {(weight.value * 100).toFixed(0)}
                      </span>
                      <span className="text-xs text-default-500">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Tab>

          {/* 阈值配置 Tab - 使用Lucide图标 */}
          <Tab
            key="thresholds"
            title={
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                <span>阈值配置</span>
                <span className="text-xs text-default-500">
                  {Object.keys(config.thresholds).length}
                </span>
              </div>
            }
          >
            <div className="space-y-2">
              {(Object.entries(config.thresholds) as [string, ThresholdConfig][]).map(
                ([key, threshold]) => {
                  const thresh = thresholdConfig[key];
                  const IconComponent = thresh?.icon || Settings2;
                  return (
                    <div
                      key={key}
                      className="group flex items-center gap-4 p-3 rounded-xl bg-default-100 hover:bg-default-200 transition-colors"
                    >
                      {/* 左侧：Lucide图标+名称 */}
                      <div className="flex items-center gap-3 w-44 flex-shrink-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <IconComponent className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div
                            className="text-sm font-semibold text-foreground truncate"
                            title={thresh?.name || key}
                          >
                            {thresh?.name || key}
                          </div>
                          <Tooltip content={threshold.rationale}>
                            <div className="text-[10px] text-default-500 cursor-help flex items-center gap-1">
                              {thresh?.desc || threshold.description}
                              <Info className="w-3 h-3" />
                            </div>
                          </Tooltip>
                        </div>
                      </div>

                      {/* 中间：滑块 */}
                      <div className="flex-1 min-w-0 px-2">
                        <Slider
                          value={threshold.value}
                          onChange={v => handleThresholdChange(key, v as number)}
                          minValue={threshold.range[0]}
                          maxValue={threshold.range[1]}
                          step={1}
                          size="sm"
                          color="secondary"
                          classNames={{
                            track: 'h-2 bg-default-300 rounded-full',
                            filler:
                              'bg-gradient-to-r from-blue-400 to-blue-600 rounded-full',
                            thumb:
                              'w-5 h-5 bg-white border-2 border-blue-500 shadow-md',
                          }}
                        />
                      </div>

                      {/* 右侧：数值输入 */}
                      <div className="flex items-center gap-2 w-20 flex-shrink-0 justify-end">
                        <Input
                          type="number"
                          value={threshold.value.toString()}
                          onChange={e => handleThresholdChange(key, parseInt(e.target.value) || 0)}
                          min={threshold.range[0]}
                          max={threshold.range[1]}
                          classNames={{
                            input: 'text-center font-bold text-foreground',
                            inputWrapper:
                              'bg-default-50 border-default-300 h-9 w-16',
                          }}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </Tab>
        </Tabs>
      </CardBody>
    </Card>
  );
};

export default QualityRulesEditor;
