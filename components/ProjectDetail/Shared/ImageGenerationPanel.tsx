import React, { useEffect, useMemo, useState } from 'react';
import { 
    Button, 
    Textarea, 
    Select, 
    SelectItem,
    Input,
    Slider,
    useDisclosure
} from "@heroui/react";
import { Sparkles, Upload, Trash2 } from 'lucide-react';
import { useApp } from '../../../contexts/context';
import { DEFAULT_MODELS } from '../../../config/models';
import ResourcePicker from '../../ResourcePicker';
import { storageService } from '../../../services/storage';
import { StyleSelector } from './StyleSelector';
import { DynamicModelParameters } from './DynamicModelParameters';
import { resolveModelConfig, UNIFIED_KEYS } from '../../../services/modelUtils';

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
    children
}) => {
    const { t, settings } = useApp();
    const { isOpen: isPickerOpen, onOpen: onPickerOpen, onClose: onPickerClose } = useDisclosure();
    const [refUrls, setRefUrls] = useState<Record<string, string>>({});

    // Derived model config
    const runtimeModel = settings.models.find(m => m.id === modelId) || settings.models.find(m => m.type === 'image');
    const staticModel = resolveModelConfig(runtimeModel);
    
    const modelConfig = useMemo(() => {
        if (!runtimeModel) return staticModel;
        return {
            ...staticModel,
            ...runtimeModel,
            parameters: staticModel?.parameters || runtimeModel?.parameters
        };
    }, [runtimeModel, staticModel]);

    const capabilities = useMemo(() => ({
        ...staticModel?.capabilities,
        ...runtimeModel?.capabilities,
        supportedResolutions: Array.from(new Set([
            ...(staticModel?.capabilities?.supportedResolutions || []),
            ...(runtimeModel?.capabilities?.supportedResolutions || [])
        ])).filter(Boolean),
        minAspectRatio: runtimeModel?.capabilities?.minAspectRatio ?? staticModel?.capabilities?.minAspectRatio,
        maxAspectRatio: runtimeModel?.capabilities?.maxAspectRatio ?? staticModel?.capabilities?.maxAspectRatio,
        maxReferenceImages: runtimeModel?.capabilities?.maxReferenceImages || staticModel?.capabilities?.maxReferenceImages || 1,
    }), [staticModel, runtimeModel]);

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
        <div className="space-y-6">
            {/* Model Selection */}
            <div className="flex flex-col gap-2">
                <label className="text-slate-300 font-bold text-base ml-1">{t.project.modelLabel}</label>
                <Select
                    placeholder={t.project.modelLabel}
                    selectedKeys={modelId ? new Set([modelId]) : new Set([])}
                    onChange={(e) => onModelChange(e.target.value)}
                    variant="bordered"
                    radius="lg"
                    isDisabled={generating}
                    classNames={{ 
                        value: "font-bold text-sm",
                        trigger: "border-2 data-[focus=true]:border-primary"
                    }}
                >
                    {settings.models.filter(m => m.type === 'image').map((model) => (
                        <SelectItem key={model.id} textValue={model.name}>
                            {model.name}
                        </SelectItem>
                    ))}
                </Select>
            </div>

            {/* Extra Fields (Gender/Age etc) */}
            {children}

            {/* Prompt */}
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
                        input: "font-medium text-sm",
                        inputWrapper: "border-2 group-data-[focus=true]:border-primary"
                    }}
                />
            </div>

            {/* Reference Images - Removed as per request, replaced with hint */}
            <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg flex gap-2 items-start">
                <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                    {t.project.fragment?.selectedMaterialsHint}
                </span>
            </div>

            {/* Style Selection */}
            <div className="flex flex-col gap-2">
                <StyleSelector 
                    value={style}
                    onChange={onStyleChange}
                    disabled={generating}
                />
            </div>

            {/* Params Grid */}
            <div className="flex flex-col gap-2">
                <label className="text-sm font-black text-indigo-500/80 dark:text-indigo-400 uppercase tracking-widest mb-2">
                    {t.aiParams.modelParams}
                </label>
                
                <DynamicModelParameters 
                    modelConfig={modelConfig}
                    values={{
                        [UNIFIED_KEYS.ASPECT_RATIO]: aspectRatio,
                        [UNIFIED_KEYS.RESOLUTION]: resolution,
                        [UNIFIED_KEYS.COUNT]: count,
                        [UNIFIED_KEYS.GUIDANCE_SCALE]: guidanceScale,
                        [UNIFIED_KEYS.STYLE]: style,
                        ...extraParams
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
            </div>

            <Button 
                color="primary" 
                size="lg" 
                fullWidth 
                className="font-bold shadow-lg shadow-indigo-500/20"
                startContent={!generating && <Sparkles size={20} />}
                isLoading={generating}
                onPress={onGenerate}
            >
                {generating ? t.character?.generating : t.character?.startGeneration}
            </Button>

            <ResourcePicker 
                isOpen={isPickerOpen} 
                onClose={onPickerClose}
                projectId={projectId}
                accept="image/*"
                maxSelect={(capabilities.maxReferenceImages || 1) - referenceImages.length}
                onSelect={(paths) => {
                    const newRefs = Array.from(new Set([...referenceImages, ...paths]));
                    onReferenceImagesChange(newRefs.slice(0, capabilities.maxReferenceImages || 1));
                    onPickerClose();
                }}
            />
        </div>
    );
};
