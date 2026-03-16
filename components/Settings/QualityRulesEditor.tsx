/**
 * 质量评估规则编辑器
 *
 * 提供可视化界面编辑质量评估的权重和阈值配置
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Slider,
  Input,
  Divider,
  Chip,
  Tooltip,
  Accordion,
  AccordionItem,
} from '@heroui/react';
import {
  Settings2,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  Info,
  CheckCircle,
} from 'lucide-react';
import type { QualityRulesConfig, WeightConfig, ThresholdConfig } from '../../services/parsing/QualityRulesConfig';
import { DEFAULT_QUALITY_RULES } from '../../services/parsing/QualityRulesConfig';
import { getQualityRulesLoader } from '../../services/parsing/QualityRulesLoader';

interface QualityRulesEditorProps {
  t: any;
}

// 维度名称映射
const dimensionNames: Record<string, string> = {
  narrativeLogic: '叙事逻辑',
  dramatic: '戏剧性',
  completeness: '完整性',
  accuracy: '准确性',
  consistency: '一致性',
  usability: '可用性',
  spatialTemporal: '时空逻辑',
};

// 阈值名称映射
const thresholdNames: Record<string, string> = {
  characterDescriptionLength: '角色描述最小字数',
  sceneDescriptionLength: '场景描述最小字数',
  minShotsPerScene: '每场景最少分镜数',
  maxShotsPerScene: '每场景最多分镜数',
  minShotsTotal: '总分镜数最小值',
  shotDurationMin: '分镜最短时长（秒）',
  shotDurationMax: '分镜最长时长（秒）',
  narrativeLogicCollapseThreshold: '叙事逻辑崩溃阈值',
  completenessMaxWhenNarrativeCollapsed: '叙事崩溃时完整性最高分',
};

export const QualityRulesEditor: React.FC<QualityRulesEditorProps> = ({ t }) => {
  const [config, setConfig] = useState<QualityRulesConfig>(DEFAULT_QUALITY_RULES);
  const [originalConfig, setOriginalConfig] = useState<QualityRulesConfig>(DEFAULT_QUALITY_RULES);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [weightSum, setWeightSum] = useState(1.0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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
        // 验证配置
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
    event.target.value = ''; // Reset input
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部信息 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            质量评估规则
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            版本: {config.version} | 最后更新: {config.lastUpdated}
          </p>
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
              className="cursor-pointer"
            >
              导入
            </Button>
          </label>
          <Button
            variant="flat"
            size="sm"
            startContent={<Download className="w-4 h-4" />}
            onPress={handleExport}
          >
            导出
          </Button>
          <Button
            variant="flat"
            size="sm"
            color="warning"
            startContent={<RotateCcw className="w-4 h-4" />}
            onPress={handleReset}
          >
            恢复默认
          </Button>
        </div>
      </div>

      {/* 权重总和警告 */}
      {Math.abs(weightSum - 1.0) > 0.01 && (
        <Card className="border-warning bg-warning-50">
          <CardBody className="flex flex-row items-center gap-3 py-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
            <div className="text-sm text-warning-700">
              <span className="font-medium">权重总和异常：</span>
              当前总和为 {(weightSum * 100).toFixed(0)}%，建议调整为100%以保证评分准确性
            </div>
          </CardBody>
        </Card>
      )}

      {/* 权重配置 */}
      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader className="px-6 pt-6 pb-3">
          <div className="flex items-center justify-between w-full">
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest text-white">
                维度权重配置
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                调整各维度在综合评分中的占比，总和应为100%
              </p>
            </div>
            <Chip
              color={Math.abs(weightSum - 1.0) < 0.01 ? 'success' : 'warning'}
              variant="flat"
              size="lg"
            >
              总和: {(weightSum * 100).toFixed(0)}%
            </Chip>
          </div>
        </CardHeader>
        <CardBody className="px-6 pb-6 space-y-6">
          {(Object.entries(config.weights) as [string, WeightConfig][]).map(([key, weight]) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">
                    {dimensionNames[key] || key}
                  </span>
                  <Tooltip content={weight.rationale}>
                    <Info className="w-4 h-4 text-slate-500 cursor-help" />
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <Chip size="sm" variant="flat" color="primary">
                    {(weight.value * 100).toFixed(0)}%
                  </Chip>
                  <span className="text-xs text-slate-500">
                    ({(weight.range[0] * 100).toFixed(0)}% - {(weight.range[1] * 100).toFixed(0)}%)
                  </span>
                </div>
              </div>
              <Slider
                value={weight.value}
                onChange={v => handleWeightChange(key, v as number)}
                minValue={weight.range[0]}
                maxValue={weight.range[1]}
                step={0.01}
                size="md"
                color="primary"
                showTooltip
                tooltipValueFormatOptions={{ style: 'percent' }}
              />
              <p className="text-xs text-slate-500">{weight.description}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* 阈值配置 */}
      <Card className="border border-slate-200 dark:border-slate-800">
        <CardHeader className="px-6 pt-6 pb-3">
          <div>
            <h3 className="text-lg font-black uppercase tracking-widest text-white">
              阈值配置
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              设置质量评估的各项阈值标准
            </p>
          </div>
        </CardHeader>
        <CardBody className="px-6 pb-6">
          <Accordion variant="splitted" motionProps={{}}>
            <AccordionItem
              key="thresholds"
              textValue="阈值配置"
              title={
                <span className="font-medium text-white">
                  展开阈值配置 ({Object.keys(config.thresholds).length} 项)
                </span>
              }
            >
              <div className="space-y-4 pt-4">
                {(Object.entries(config.thresholds) as [string, ThresholdConfig][]).map(([key, threshold]) => (
                  <div key={key} className="flex items-start gap-4 p-4 bg-slate-900 rounded-xl">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-white">
                          {thresholdNames[key] || key}
                        </span>
                        <Tooltip content={threshold.rationale}>
                          <Info className="w-4 h-4 text-slate-500 cursor-help" />
                        </Tooltip>
                      </div>
                      <p className="text-xs text-slate-400 mb-3">{threshold.description}</p>
                      <div className="flex items-center gap-4">
                        <Input
                          type="number"
                          value={threshold.value.toString()}
                          onChange={e =>
                            handleThresholdChange(key, parseInt(e.target.value) || 0)
                          }
                          min={threshold.range[0]}
                          max={threshold.range[1]}
                          className="w-24"
                          size="sm"
                        />
                        <Slider
                          value={threshold.value}
                          onChange={v => handleThresholdChange(key, v as number)}
                          minValue={threshold.range[0]}
                          maxValue={threshold.range[1]}
                          step={1}
                          className="flex-1"
                          size="sm"
                          color="secondary"
                        />
                        <span className="text-xs text-slate-500 w-24 text-right">
                          {threshold.range[0]} - {threshold.range[1]}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionItem>
          </Accordion>
        </CardBody>
      </Card>

      {/* 保存按钮 - 添加底部间距确保可见 */}
      <div className="flex justify-end gap-3 pb-20">
        {hasChanges && (
          <span className="text-sm text-slate-400 self-center">有未保存的更改</span>
        )}
        <Button
          color={saveStatus === 'saved' ? 'success' : saveStatus === 'error' ? 'danger' : 'primary'}
          variant="shadow"
          size="lg"
          isLoading={saveStatus === 'saving'}
          startContent={
            saveStatus === 'saved' ? (
              <CheckCircle className="w-5 h-5" />
            ) : saveStatus === 'error' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <Settings2 className="w-5 h-5" />
            )
          }
          onPress={handleSave}
          isDisabled={!hasChanges || Math.abs(weightSum - 1.0) > 0.01}
          className="font-black uppercase tracking-widest"
        >
          {saveStatus === 'saved'
            ? '已保存'
            : saveStatus === 'error'
              ? '保存失败'
              : saveStatus === 'saving'
                ? '保存中...'
                : '保存配置'}
        </Button>
      </div>
    </div>
  );
};

export default QualityRulesEditor;
