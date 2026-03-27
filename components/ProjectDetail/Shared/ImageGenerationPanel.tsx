import React, { useEffect, useMemo, useState } from 'react';
import { Button, Textarea, Select, SelectItem, Input, Slider, useDisclosure, Spinner } from '@heroui/react';
import { Sparkles, Upload, Trash2 } from 'lucide-react';
import { useApp } from '../../../contexts/context';
import { DEFAULT_MODELS } from '../../../config/models';
import ResourcePicker from '../../ResourcePicker';
import { storageService } from '../../../services/storage';
import { StyleSelector } from './StyleSelector';
import { DynamicModelParameters } from './DynamicModelParameters';
import { resolveModelConfig, UNIFIED_KEYS } from '../../../services/modelUtils';
import { usePreview } from '../../PreviewProvider';

interface ImageGenerationPanelProps {
  projectId: string;
  prompt: string;
  onPromptChange: (v: string) => void;
  onPromptBlur?: () => void;
  modelId: string;
  onModelChange: (v: string) => void;
  referenceImages: string[];
  onReferenceImagesChange: (v: string[]) => void;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
  resolution: string;
  onResolutionChange: (v: string) => void;
  style: string;
  onStyleChange: (v: string) => void;
  count: number;
  onCountChange: (v: number) => void;
  guidanceScale: number;
  onGuidanceScaleChange: (v: number) => void;
  generating: boolean;
  onGenerate: () => void;
  extraParams?: Record<string, any>;
  onParamChange?: (key: string, value: any) => void;
  children?: React.ReactNode; // For extra fields like gender/age
  showPrompt?: boolean; // 是否显示提示词输入
  showStyle?: boolean; // 是否显示风格选择
  showGenerateButton?: boolean; // 是否显示生成按钮
  compact?: boolean; // 是否使用简洁模式
  showReferenceImages?: boolean; // 是否显示参考图区域
}

export const ImageGenerationPanel: React.FC<ImageGenerationPanelProps> = ({
  projectId,
  prompt,
  onPromptChange,
  onPromptBlur,
  modelId,
  onModelChange,
  referenceImages,
  onReferenceImagesChange,
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
  extraParams = {},
  onParamChange,
  children,
  showPrompt = true,
  showStyle = true,
  showGenerateButton = true,
  compact = false,
  showReferenceImages = true,
}) => {
  const { t, settings } = useApp();
  const { openPreview } = usePreview();
  const { isOpen: isPickerOpen, onOpen: onPickerOpen, onClose: onPickerClose } = useDisclosure();
  const [refUrls, setRefUrls] = useState<Record<string, string>>({});

  // Derived model config
  const runtimeModel =
    settings.models.find(m => m.id === modelId) || settings.models.find(m => m.type === 'image');
  const staticModel = resolveModelConfig(runtimeModel);

  const modelConfig = useMemo(() => {
    if (!runtimeModel) return staticModel;
    return {
      ...staticModel,
      ...runtimeModel,
      parameters: staticModel?.parameters || runtimeModel?.parameters,
    };
  }, [runtimeModel, staticModel]);

  const capabilities = useMemo(
    () => ({
      ...staticModel?.capabilities,
      ...runtimeModel?.capabilities,
      supportedResolutions: Array.from(
        new Set([
          ...(staticModel?.capabilities?.supportedResolutions || []),
          ...(runtimeModel?.capabilities?.supportedResolutions || []),
        ])
      ).filter(Boolean),
      minAspectRatio:
        runtimeModel?.capabilities?.minAspectRatio ?? staticModel?.capabilities?.minAspectRatio,
      maxAspectRatio:
        runtimeModel?.capabilities?.maxAspectRatio ?? staticModel?.capabilities?.maxAspectRatio,
      maxReferenceImages:
        runtimeModel?.capabilities?.maxReferenceImages ||
        staticModel?.capabilities?.maxReferenceImages ||
        1,
    }),
    [staticModel, runtimeModel]
  );

  // Load Ref URLs
  useEffect(() => {
    const loadUrls = async () => {
      const urls: Record<string, string> = {};
      for (const path of referenceImages) {
        if (path) urls[path] = await storageService.getAssetUrl(path);
      }
      setRefUrls(urls);
    };
    loadUrls();
  }, [referenceImages]);

  // Auto-correction logic
  const availableResolutions = capabilities.supportedResolutions || ['1K', '2K', '4K'];
  const allAspectRatios = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', '9:21'];
  const availableAspectRatios = allAspectRatios.filter(ratio => {
    if (capabilities.minAspectRatio || capabilities.maxAspectRatio) {
      const [w, h] = ratio.split(':').map(Number);
      const val = w / h;
      if (capabilities.minAspectRatio && val < capabilities.minAspectRatio) return false;
      if (capabilities.maxAspectRatio && val > capabilities.maxAspectRatio) return false;
    }
    return true;
  });

  return (
    <div className={compact ? "space-y-2.5" : "space-y-6"}>
      {/* Model Selection */}
      <div className={compact ? "space-y-1" : "flex flex-col gap-2"}>
        <label className={compact 
          ? "text-[10px] font-semibold text-slate-400 uppercase tracking-wide" 
          : "text-slate-300 font-bold text-base ml-1"
        }>
          {compact ? "模型" : t.project.modelLabel}
        </label>
        <Select
          aria-label={t.project.modelLabel}
          placeholder={t.project.modelLabel}
          selectedKeys={modelId ? new Set([modelId]) : new Set([])}
          onChange={e => onModelChange(e.target.value)}
          variant="bordered"
          radius="lg"
          isDisabled={generating}
          size={compact ? "sm" : "md"}
          classNames={compact ? {
            trigger: 'h-7 text-[11px] min-h-7',
          } : {
            value: 'font-bold text-sm',
            trigger: 'border-2 data-[focus=true]:border-primary',
          }}
        >
          {settings.models
            .filter(m => m.type === 'image' && (m.enabled ?? true))
            .map(model => {
              const supportsRef = model.capabilities?.supportsReferenceImage;
              const requiresRef = model.capabilities?.requiresImageInput;
              return (
                <SelectItem key={model.id} textValue={model.name} classNames={compact ? { base: 'text-[11px]' } : undefined}>
                  {compact ? (
                    model.name
                  ) : (
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      {requiresRef && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
                          需要参考图
                        </span>
                      )}
                      {supportsRef && !requiresRef && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                          支持参考图
                        </span>
                      )}
                      {!supportsRef && (
                        <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                          文生图
                        </span>
                      )}
                    </div>
                  )}
                </SelectItem>
              );
            })}
        </Select>
      </div>

      {/* Extra Fields (Gender/Age etc) */}
      {children}

      {/* Prompt */}
      {showPrompt && (
        <div className="flex flex-col gap-2">
          <label className="text-slate-300 font-bold text-base ml-1">{t.common.prompt}</label>
          <Textarea
            placeholder={t.project.promptPlaceholder}
            value={prompt}
            onValueChange={onPromptChange}
            onBlur={onPromptBlur}
            variant="bordered"
            radius="lg"
            minRows={4}
            isDisabled={generating}
            classNames={{
              input: 'font-medium text-sm',
              inputWrapper: 'border-2 group-data-[focus=true]:border-primary',
            }}
          />
        </div>
      )}

      {/* Reference Images */}
      {showReferenceImages && !compact && (
        <div className="space-y-2">
          <label className="text-slate-300 font-bold text-base ml-1">参考图</label>
          {referenceImages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {referenceImages.map((path, index) => (
                <div
                  key={index}
                  className="relative w-8 h-8 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => {
                    const url = refUrls[path] || path;
                    openPreview([{ src: url, alt: `参考图 ${index + 1}` }], 0);
                  }}
                >
                  {refUrls[path] ? (
                    <img
                      src={refUrls[path]}
                      alt={`参考图 ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border border-content3"
                    />
                  ) : (
                    <div className="w-full h-full bg-content2 rounded-lg border border-content3 flex items-center justify-center">
                      <Spinner size="sm" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg flex gap-2 items-start">
              <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                {t.project.fragment?.selectedMaterialsHint}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Style Selection */}
      {showStyle && !compact && (
        <div className="flex flex-col gap-2">
          <StyleSelector value={style} onChange={onStyleChange} disabled={generating} />
        </div>
      )}

      {/* Params Grid */}
      {!compact && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-black text-primary/80 dark:text-primary-400 uppercase tracking-widest mb-2">
            {t.aiParams.modelParams}
          </label>
        </div>
      )}

      <DynamicModelParameters
        modelConfig={modelConfig}
        values={{
          [UNIFIED_KEYS.ASPECT_RATIO]: aspectRatio,
          [UNIFIED_KEYS.RESOLUTION]: resolution,
          [UNIFIED_KEYS.COUNT]: count,
          [UNIFIED_KEYS.GUIDANCE_SCALE]: guidanceScale,
          [UNIFIED_KEYS.STYLE]: style,
          ...extraParams,
        }}
        onChange={(key, value) => {
          if (key === UNIFIED_KEYS.ASPECT_RATIO) onAspectRatioChange(value);
          else if (key === UNIFIED_KEYS.RESOLUTION) onResolutionChange(value);
          else if (key === UNIFIED_KEYS.COUNT) onCountChange(value);
          else if (key === UNIFIED_KEYS.GUIDANCE_SCALE) onGuidanceScaleChange(value);
          else if (key === UNIFIED_KEYS.STYLE) onStyleChange(value);
          else if (onParamChange) onParamChange(key, value);
        }}
        disabled={generating}
      />

      {showGenerateButton && (
        <Button
          color="default"
          variant="solid"
          size="lg"
          fullWidth
          isLoading={generating}
          onPress={onGenerate}
          className="font-bold h-12 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100 shadow-xl shadow-slate-500/20 dark:shadow-slate-900/20 active:scale-95 transition-all"
          classNames={{
            base: 'bg-slate-200 hover:bg-slate-300 text-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-100',
            content: 'text-slate-900 dark:text-slate-100 font-black uppercase tracking-widest text-sm',
            spinner: 'text-slate-900 dark:text-slate-100',
          }}
          startContent={!generating && <Sparkles size={18} className="text-slate-900 dark:text-slate-100" />}
        >
          {generating ? (t.character?.generating || '生成中...') : (t.project?.generate || '生成图片')}
        </Button>
      )}

      <ResourcePicker
        isOpen={isPickerOpen}
        onClose={onPickerClose}
        projectId={projectId}
        accept="image/*"
        maxSelect={(capabilities.maxReferenceImages || 1) - referenceImages.length}
        onSelect={paths => {
          const newRefs = Array.from(new Set([...referenceImages, ...paths]));
          onReferenceImagesChange(newRefs.slice(0, capabilities.maxReferenceImages || 1));
          onPickerClose();
        }}
      />
    </div>
  );
};
