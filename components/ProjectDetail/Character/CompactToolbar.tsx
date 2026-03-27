import React from 'react';
import { Select, SelectItem } from '@heroui/react';
import { useApp } from '../../../contexts/context';
import { ModelConfig } from '../../../types';
import { resolveModelConfig, UNIFIED_KEYS } from '../../../services/modelUtils';
import { DynamicModelParameters } from '../Shared/DynamicModelParameters';

interface CompactToolbarProps {
  modelId: string;
  onModelChange: (id: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;
  resolution: string;
  onResolutionChange: (res: string) => void;
  count: number;
  onCountChange: (count: number) => void;
  guidanceScale: number;
  onGuidanceScaleChange: (scale: number) => void;
  extraParams: Record<string, any>;
  onExtraParamsChange: (params: Record<string, any>) => void;
  generating: boolean;
}

export const CompactToolbar: React.FC<CompactToolbarProps> = ({
  modelId,
  onModelChange,
  aspectRatio,
  onAspectRatioChange,
  resolution,
  onResolutionChange,
  count,
  onCountChange,
  guidanceScale,
  onGuidanceScaleChange,
  extraParams,
  onExtraParamsChange,
  generating,
}) => {
  const { t, settings } = useApp();

  const selectedModel = settings.models.find(m => m.id === modelId);
  const staticModel = resolveModelConfig(selectedModel);

  const modelConfig = React.useMemo(() => {
    if (!selectedModel) return staticModel;
    return {
      ...staticModel,
      ...selectedModel,
      parameters: staticModel?.parameters || selectedModel?.parameters,
    };
  }, [selectedModel, staticModel]);

  const handleParamChange = (key: string, value: any) => {
    if (key === UNIFIED_KEYS.ASPECT_RATIO) onAspectRatioChange(value);
    else if (key === UNIFIED_KEYS.RESOLUTION) onResolutionChange(value);
    else if (key === UNIFIED_KEYS.COUNT) onCountChange(Number(value));
    else if (key === UNIFIED_KEYS.GUIDANCE_SCALE) onGuidanceScaleChange(Number(value));
    else onExtraParamsChange(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-1.5">
      <div className="space-y-1">
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">模型</label>
        <Select
          selectedKeys={modelId ? new Set([modelId]) : new Set()}
          onChange={(e) => onModelChange(e.target.value)}
          isDisabled={generating}
          size="sm"
          aria-label={t.aiParams?.model || '模型选择'}
          classNames={{ trigger: 'h-7 text-[11px] min-h-7' }}
        >
          {settings.models
            .filter(m => m.type === 'image' && (m.enabled ?? true))
            .map(model => (
              <SelectItem key={model.id} value={model.id} classNames={{ base: 'text-[11px]' }}>
                {model.name}
              </SelectItem>
            ))}
        </Select>
      </div>

      {modelConfig && (
        <DynamicModelParameters
          modelConfig={modelConfig}
          values={{
            [UNIFIED_KEYS.ASPECT_RATIO]: aspectRatio,
            [UNIFIED_KEYS.RESOLUTION]: resolution,
            [UNIFIED_KEYS.COUNT]: count,
            [UNIFIED_KEYS.GUIDANCE_SCALE]: guidanceScale,
            ...extraParams,
          }}
          onChange={handleParamChange}
          disabled={generating}
        />
      )}
    </div>
  );
};
