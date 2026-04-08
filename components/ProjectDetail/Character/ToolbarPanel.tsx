import React, { useState } from 'react';
import { Select, SelectItem, Slider, Button, Accordion, AccordionItem, Chip } from '@heroui/react';
import { Settings, Palette, Check, Lock } from 'lucide-react';
import { useApp } from '../../../contexts/context';
import { StyleSelector } from '../Shared/StyleSelector';

type WorkflowStage = 1 | 2 | 3;

interface ToolbarPanelProps {
  currentStage: WorkflowStage;
  onStageChange: (stage: WorkflowStage) => void;
  modelId: string;
  onModelChange: (id: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;
  resolution: string;
  onResolutionChange: (res: string) => void;
  style: string;
  onStyleChange: (style: string) => void;
  count: number;
  onCountChange: (count: number) => void;
  guidanceScale: number;
  onGuidanceScaleChange: (scale: number) => void;
  generating: boolean;
  onGenerate: () => void;
  selectedFaceImage: any;
  selectedFullBodyImage: any;
  stages: any[];
}

export const ToolbarPanel: React.FC<ToolbarPanelProps> = ({
  currentStage,
  onStageChange,
  modelId,
  onModelChange,
  aspectRatio,
  onAspectRatioChange,
  resolution,
  onResolutionChange,
  style,
  onStyleChange,
  count,
  onCountChange,
  guidanceScale,
  onGuidanceScaleChange,
  generating,
  onGenerate,
  selectedFaceImage,
  selectedFullBodyImage,
  stages,
}) => {
  const { t, settings } = useApp();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(['core']));

  const isStageEnabled = (stage: WorkflowStage): boolean => {
    if (stage === 1) return true;
    if (stage === 2) return selectedFaceImage !== null;
    if (stage === 3) return selectedFullBodyImage !== null;
    return false;
  };

  const handleAccordionChange = (keys: Set<string>) => {
    setExpandedKeys(keys);
  };

  return (
    <div className="w-[320px] h-full bg-content1 border-r border-content3 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-content3">
        <h3 className="font-bold text-sm text-foreground">工作流</h3>
      </div>

      <div className="p-3 border-b border-content3">
        <div className="space-y-1.5">
          {stages.map(stage => {
            const isEnabled = isStageEnabled(stage.id as WorkflowStage);
            const isActive = currentStage === stage.id;
            const isCompleted = currentStage > stage.id;

            return (
              <button
                key={stage.id}
                onClick={() => isEnabled && onStageChange(stage.id as WorkflowStage)}
                disabled={!isEnabled}
                className={`w-full text-left p-2.5 rounded-lg transition-all duration-150 border ${
                  isActive
                    ? 'bg-primary/10 border-primary'
                    : isCompleted
                      ? 'bg-content2 border-content3 hover:bg-content3'
                      : isEnabled
                        ? 'bg-content2 border-transparent hover:border-content3 hover:bg-content3'
                        : 'bg-content2/50 border-transparent opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-1.5 rounded-md ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : isCompleted
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-content3 text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : isEnabled ? (
                      <stage.icon className="w-3.5 h-3.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-medium text-xs ${isActive ? 'text-primary' : 'text-foreground'}`}
                      >
                        {stage.label}
                      </span>
                      {isCompleted && (
                        <Chip color="success" className="h-3 min-w-3 p-0 text-[10px]">
                          ✓
                        </Chip>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-0">
        <Accordion
          selectedKeys={expandedKeys}
          onSelectionChange={handleAccordionChange as any}
          variant="splitted"
          motionProps={{}}
        >
          <AccordionItem
            key="core"
            aria-label="核心参数"
            title={
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="font-semibold text-sm">核心参数</span>
              </div>
            }
            classNames={{
              title: 'py-1.5',
              content: 'pt-0 pb-3',
            }}
            motionProps={{}}
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  模型
                </label>
                <Select
                  selectedKeys={modelId ? new Set([modelId]) : new Set()}
                  onChange={e => onModelChange(e.target.value)}
                  isDisabled={generating}
                  size="sm"
                  classNames={{ trigger: 'h-8 text-xs' }}
                >
                  {settings.models
                    .filter(m => m.type === 'image' && (m.enabled ?? true))
                    .map(model => (
                      <SelectItem key={model.id} value={model.id} classNames={{ base: 'text-xs' }}>
                        {model.name}
                      </SelectItem>
                    ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    分辨率
                  </label>
                  <Select
                    selectedKeys={new Set([resolution])}
                    onChange={e => onResolutionChange(e.target.value)}
                    isDisabled={generating}
                    size="sm"
                    classNames={{ trigger: 'h-8 text-xs' }}
                  >
                    <SelectItem key="1K" value="1K" classNames={{ base: 'text-xs' }}>
                      1K
                    </SelectItem>
                    <SelectItem key="2K" value="2K" classNames={{ base: 'text-xs' }}>
                      2K
                    </SelectItem>
                    <SelectItem key="4K" value="4K" classNames={{ base: 'text-xs' }}>
                      4K
                    </SelectItem>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    比例
                  </label>
                  <Select
                    selectedKeys={new Set([aspectRatio])}
                    onChange={e => onAspectRatioChange(e.target.value)}
                    isDisabled={generating}
                    size="sm"
                    classNames={{ trigger: 'h-8 text-xs' }}
                  >
                    <SelectItem key="1:1" value="1:1" classNames={{ base: 'text-xs' }}>
                      1:1
                    </SelectItem>
                    <SelectItem key="3:4" value="3:4" classNames={{ base: 'text-xs' }}>
                      3:4
                    </SelectItem>
                    <SelectItem key="16:9" value="16:9" classNames={{ base: 'text-xs' }}>
                      16:9
                    </SelectItem>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  数量: {count}
                </label>
                <Slider
                  value={count}
                  onChange={v => onCountChange(v as number)}
                  minValue={1}
                  maxValue={4}
                  step={1}
                  size="sm"
                  isDisabled={generating}
                  classNames={{ track: 'h-1.5', thumb: 'w-4 h-4' }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Guidance: {guidanceScale.toFixed(1)}
                </label>
                <Slider
                  value={guidanceScale}
                  onChange={v => onGuidanceScaleChange(v as number)}
                  minValue={1}
                  maxValue={10}
                  step={0.5}
                  size="sm"
                  isDisabled={generating}
                  classNames={{ track: 'h-1.5', thumb: 'w-4 h-4' }}
                />
              </div>
            </div>
          </AccordionItem>

          <AccordionItem
            key="style"
            aria-label="艺术风格"
            title={
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                <span className="font-semibold text-sm">艺术风格</span>
              </div>
            }
            classNames={{
              title: 'py-1.5',
              content: 'pt-0 pb-3',
            }}
            motionProps={{}}
          >
            <StyleSelector value={style} onChange={onStyleChange} disabled={generating} />
          </AccordionItem>
        </Accordion>
      </div>

      <div className="p-3 border-t border-content3">
        <Button
          color="primary"
          size="md"
          fullWidth
          isLoading={generating}
          onPress={onGenerate}
          className="font-bold shadow-md shadow-primary/20 h-10 text-sm"
          startContent={!generating && <Settings size={16} />}
        >
          {generating
            ? t.character?.generating || '生成中...'
            : t.character.startGeneration || '开始生成'}
        </Button>
      </div>
    </div>
  );
};
