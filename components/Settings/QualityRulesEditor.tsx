/**
 * 质量评估规则编辑器
 *
 * 提供可视化界面编辑质量评估的权重和阈值配置
 * 采用Tab切换设计，与模型管理页面保持一致
 * 优化版：紧凑、高级、精致
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Slider,
  Input,
  Chip,
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
} from 'lucide-react';
import type { QualityRulesConfig, WeightConfig, ThresholdConfig } from '../../services/parsing/QualityRulesConfig';
import { DEFAULT_QUALITY_RULES } from '../../services/parsing/QualityRulesConfig';
import { getQualityRulesLoader } from '../../services/parsing/QualityRulesLoader';

interface QualityRulesEditorProps {
  t: any;
}

// 维度配置 - 包含图标颜色
const dimensionConfig: Record<string, { name: string; color: string; desc: string }> = {
  narrativeLogic: { name: '叙事逻辑', color: '#f97316', desc: '故事通顺度' },
  dramatic: { name: '戏剧性', color: '#ef4444', desc: '吸引力张力' },
  completeness: { name: '完整性', color: '#22c55e', desc: '信息齐全度' },
  accuracy: { name: '准确性', color: '#3b82f6', desc: '数据格式正确' },
  consistency: { name: '一致性', color: '#a855f7', desc: '逻辑自洽性' },
  usability: { name: '可用性', color: '#06b6d4', desc: '生成友好度' },
  spatialTemporal: { name: '时空逻辑', color: '#f59e0b', desc: '视听语言' },
};

// 阈值名称映射
const thresholdNames: Record<string, string> = {
  characterDescriptionLength: '角色描述最小字数',
  sceneDescriptionLength: '场景描述最小字数',
  minShotsPerScene: '每场景最少分镜',
  maxShotsPerScene: '每场景最多分镜',
  minShotsTotal: '总分镜数最小值',
  shotDurationMin: '分镜最短时长(秒)',
  shotDurationMax: '分镜最长时长(秒)',
  narrativeLogicCollapseThreshold: '叙事崩溃阈值',
  completenessMaxWhenNarrativeCollapsed: '叙事崩溃时完整性上限',
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
        <div className="text-slate-400">加载中...</div>
      </div>
    );
  }

  return (
    <Card className="border border-slate-800 bg-[#0a0a0a] overflow-hidden" radius="lg">
      {/* Header - 极简风格 */}
      <CardHeader className="px-6 py-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
            <Settings2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">质量评估规则</h2>
            <p className="text-xs text-slate-500">
              v{config.version} · {config.lastUpdated}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <input type="file" accept=".json" onChange={handleImport} className="hidden" id="import-config" />
          <label htmlFor="import-config">
            <Button as="span" variant="light" size="sm" className="text-slate-400 hover:text-white">
              <Upload className="w-4 h-4" />
            </Button>
          </label>
          <Button variant="light" size="sm" onPress={handleExport} className="text-slate-400 hover:text-white">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="light" size="sm" color="danger" onPress={handleReset} className="text-slate-400 hover:text-danger">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            onPress={handleSave}
            color={saveStatus === 'saved' ? 'success' : 'primary'}
            variant={saveStatus === 'saved' ? 'flat' : 'solid'}
            size="sm"
            isLoading={saveStatus === 'saving'}
            isDisabled={!hasChanges || Math.abs(weightSum - 1.0) > 0.01}
            className="font-medium"
          >
            {saveStatus === 'saved' ? <CheckCircle className="w-4 h-4" /> : '保存'}
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
            tabList: 'px-6 py-2 gap-1 border-b border-slate-800 bg-transparent',
            tab: 'px-4 py-2 text-sm font-medium text-slate-500 data-[selected=true]:text-white data-[selected=true]:bg-slate-800 rounded-lg',
            cursor: 'hidden',
            panel: 'p-6',
          }}
        >
          {/* 权重配置 Tab - 紧凑网格 */}
          <Tab
            key="weights"
            title={
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                <span>权重</span>
                <span className={`text-xs ${Math.abs(weightSum - 1.0) < 0.01 ? 'text-success' : 'text-warning'}`}>
                  {(weightSum * 100).toFixed(0)}%
                </span>
              </div>
            }
          >
            <div className="space-y-3">
              {(Object.entries(config.weights) as [string, WeightConfig][]).map(([key, weight]) => {
                const dim = dimensionConfig[key];
                return (
                  <div key={key} className="group flex items-center gap-4 p-3 rounded-xl bg-slate-900/50 hover:bg-slate-800/50 transition-colors">
                    {/* 左侧：图标+名称 */}
                    <div className="flex items-center gap-3 w-32 flex-shrink-0">
                      <div 
                        className="w-2 h-8 rounded-full" 
                        style={{ backgroundColor: dim?.color || '#666' }}
                      />
                      <div>
                        <div className="text-sm font-medium text-white">{dim?.name || key}</div>
                        <div className="text-[10px] text-slate-500">{dim?.desc}</div>
                      </div>
                    </div>

                    {/* 中间：滑块 */}
                    <div className="flex-1 min-w-0">
                      <Slider
                        value={weight.value}
                        onChange={v => handleWeightChange(key, v as number)}
                        minValue={weight.range[0]}
                        maxValue={weight.range[1]}
                        step={0.01}
                        size="sm"
                        color="primary"
                        classNames={{
                          track: 'h-1.5 bg-slate-700',
                          filler: 'bg-gradient-to-r from-primary/50 to-primary',
                          thumb: 'w-4 h-4 bg-white border-2 border-primary',
                        }}
                      />
                    </div>

                    {/* 右侧：数值 */}
                    <div className="flex items-center gap-2 w-24 flex-shrink-0 justify-end">
                      <span className="text-lg font-bold text-white">{(weight.value * 100).toFixed(0)}</span>
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Tab>

          {/* 阈值配置 Tab - 紧凑列表 */}
          <Tab
            key="thresholds"
            title={
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                <span>阈值</span>
                <span className="text-xs text-slate-500">{Object.keys(config.thresholds).length}</span>
              </div>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(Object.entries(config.thresholds) as [string, ThresholdConfig][]).map(([key, threshold]) => (
                <div key={key} className="p-4 rounded-xl bg-slate-900/50 hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white truncate" title={thresholdNames[key] || key}>
                      {thresholdNames[key] || key}
                    </span>
                    <Tooltip content={threshold.rationale}>
                      <Info className="w-3.5 h-3.5 text-slate-600 hover:text-slate-400 cursor-help" />
                    </Tooltip>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={threshold.value.toString()}
                      onChange={e => handleThresholdChange(key, parseInt(e.target.value) || 0)}
                      min={threshold.range[0]}
                      max={threshold.range[1]}
                      classNames={{
                        input: 'text-center font-bold text-white',
                        inputWrapper: 'bg-slate-800 border-slate-700 h-9 w-16',
                      }}
                      size="sm"
                    />
                    <div className="flex-1">
                      <Slider
                        value={threshold.value}
                        onChange={v => handleThresholdChange(key, v as number)}
                        minValue={threshold.range[0]}
                        maxValue={threshold.range[1]}
                        step={1}
                        size="sm"
                        color="secondary"
                        classNames={{
                          track: 'h-1 bg-slate-700',
                          filler: 'bg-secondary',
                          thumb: 'w-3 h-3 bg-white',
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-2 text-[10px] text-slate-600">
                    <span>{threshold.range[0]}</span>
                    <span>{threshold.range[1]}</span>
                  </div>
                </div>
              ))}
            </div>
          </Tab>
        </Tabs>
      </CardBody>
    </Card>
  );
};

export default QualityRulesEditor;
