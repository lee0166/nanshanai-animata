import React, { useState, useEffect, useRef } from 'react';
import { 
  Button, 
  Textarea, 
  Select, 
  SelectItem,
  Card,
  Chip,
  Slider
} from "@heroui/react";
import { Sparkles, ArrowRight, Upload, Image as ImageIcon, Film } from 'lucide-react';
import { ModelConfig } from '../../types';
import { DEFAULT_MODELS } from '../../config/models';
import { resolveModelConfig, UNIFIED_KEYS } from '../../services/modelUtils';
import { DynamicModelParameters } from './Shared/DynamicModelParameters';

export interface GenerationParams {
    prompt: string;
    modelId: string;
    referenceImages?: string[]; // Base64 strings
    startImage?: string; // Base64 string
    endImage?: string; // Base64 string
    aspectRatio?: string;
    resolution?: string;
    count?: number;
    guidanceScale?: number;
    extraParams?: Record<string, any>;
}

interface GenerationFormProps {
    prompt: string;
    setPrompt: (s: string) => void;
    selectedModelId: string;
    setSelectedModelId: (s: string) => void;
    generating: boolean;
    onGenerate: (params: GenerationParams) => void;
    models: ModelConfig[];
    t: any;
}

const GenerationForm: React.FC<GenerationFormProps> = ({
    prompt,
    setPrompt,
    selectedModelId,
    setSelectedModelId,
    generating,
    onGenerate,
    models,
    t
}) => {
    // Local state for dynamic inputs
    const [referenceImages, setReferenceImages] = useState<string[]>([]);
    const [startImage, setStartImage] = useState<string>('');
    const [endImage, setEndImage] = useState<string>('');
    
    // New parameters state
    const [aspectRatio, setAspectRatio] = useState<string>('1:1');
    const [resolution, setResolution] = useState<string>('2K');
    const [count, setCount] = useState<number>(1);
    const [guidanceScale, setGuidanceScale] = useState<number>(2.5); // Default for seededit usually
    const [extraParams, setExtraParams] = useState<Record<string, any>>({});

    // File input refs
    const refInputRef = useRef<HTMLInputElement>(null);
    const startInputRef = useRef<HTMLInputElement>(null);
    const endInputRef = useRef<HTMLInputElement>(null);

    const selectedModel = models.find(m => m.id === selectedModelId);
    // Find matching static config to augment missing capabilities if runtime settings are stale
    const staticModel = resolveModelConfig(selectedModel);
    
    const modelConfig = React.useMemo(() => {
        if (!selectedModel) return staticModel;
        return {
            ...staticModel,
            ...selectedModel,
            parameters: staticModel?.parameters || selectedModel?.parameters
        };
    }, [selectedModel, staticModel]);

    const capabilities = {
        ...staticModel?.capabilities, 
        ...selectedModel?.capabilities,
        supportedResolutions: (selectedModel?.capabilities?.supportedResolutions && selectedModel.capabilities.supportedResolutions.length > 0)
            ? selectedModel.capabilities.supportedResolutions 
            : staticModel?.capabilities?.supportedResolutions,
        minPixels: selectedModel?.capabilities?.minPixels ?? staticModel?.capabilities?.minPixels,
        maxPixels: selectedModel?.capabilities?.maxPixels ?? staticModel?.capabilities?.maxPixels,
        minAspectRatio: selectedModel?.capabilities?.minAspectRatio ?? staticModel?.capabilities?.minAspectRatio,
        maxAspectRatio: selectedModel?.capabilities?.maxAspectRatio ?? staticModel?.capabilities?.maxAspectRatio,
    };

    const isImageModel = selectedModel?.type === 'image';
    const isVideoModel = selectedModel?.type === 'video';
    
    // Specific model checks
    const isSeedEdit = selectedModel?.modelId?.includes('seededit');
    const maxBatchSize = capabilities.maxBatchSize || 1;

    // Dynamic Options
    const availableResolutions = capabilities.supportedResolutions || ['2K', '4K'];
    
    const allAspectRatios = [
        '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'
    ];
    const availableAspectRatios = allAspectRatios.filter(ratio => {
        if (capabilities.minAspectRatio || capabilities.maxAspectRatio) {
            const [w, h] = ratio.split(':').map(Number);
            const val = w / h;
            if (capabilities.minAspectRatio && val < capabilities.minAspectRatio) return false;
            if (capabilities.maxAspectRatio && val > capabilities.maxAspectRatio) return false;
        }
        return true;
    });

    // Reset params when model changes
    useEffect(() => {
        if (generating || !selectedModelId) return;

        // Check Resolution
        if (isImageModel) {
             if (!availableResolutions.includes(resolution)) {
                 const defaultRes = capabilities.defaultResolution || availableResolutions[0];
                 if (defaultRes) setResolution(defaultRes);
             }
        }

        // Check Aspect Ratio
        if (isImageModel && !availableAspectRatios.includes(aspectRatio)) {
             const defaultRatio = '1:1';
             if (availableAspectRatios.includes(defaultRatio)) {
                 setAspectRatio(defaultRatio);
             } else if (availableAspectRatios.length > 0) {
                 setAspectRatio(availableAspectRatios[0]);
             }
        }
    }, [selectedModelId, capabilities, generating, isImageModel]);

    const handleParamChange = (key: string, value: any) => {
        if (key === UNIFIED_KEYS.ASPECT_RATIO) setAspectRatio(value);
        else if (key === UNIFIED_KEYS.RESOLUTION) setResolution(value);
        else if (key === UNIFIED_KEYS.COUNT) setCount(Number(value));
        else if (key === UNIFIED_KEYS.GUIDANCE_SCALE) setGuidanceScale(Number(value));
        else setExtraParams(prev => ({ ...prev, [key]: value }));
    };

    // Helper to read file as Base64
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'ref' | 'start' | 'end') => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const readFile = (file: File): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    // Extract base64 part
                    const result = reader.result as string;
                    resolve(result);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        };

        try {
            if (type === 'ref') {
                const newImages: string[] = [];
                // Check max limit
                const max = capabilities.maxReferenceImages || 1;
                const currentLen = referenceImages.length;
                const remaining = max - currentLen;
                
                for (let i = 0; i < Math.min(files.length, remaining); i++) {
                    const b64 = await readFile(files[i]);
                    newImages.push(b64);
                }
                setReferenceImages(prev => [...prev, ...newImages]);
            } else if (type === 'start') {
                const b64 = await readFile(files[0]);
                setStartImage(b64);
            } else if (type === 'end') {
                const b64 = await readFile(files[0]);
                setEndImage(b64);
            }
        } catch (error) {
            console.error("Error reading file:", error);
        }
        
        // Reset input
        if (e.target) e.target.value = '';
    };

    const handleGenerateClick = () => {
        console.log(`[GenerationForm] Generate clicked. Prompt: ${prompt}, Model: ${selectedModelId}`);
        onGenerate({
            prompt,
            modelId: selectedModelId,
            referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
            startImage: startImage || undefined,
            endImage: endImage || undefined,
            aspectRatio: isImageModel ? aspectRatio : undefined,
            resolution: isImageModel ? resolution : undefined,
            count: maxBatchSize > 1 ? count : 1,
            guidanceScale: isSeedEdit ? guidanceScale : undefined,
            extraParams
        });
    };

    const removeRefImage = (index: number) => {
        setReferenceImages(prev => prev.filter((_, i) => i !== index));
    };

    const aspectRatios = [
        '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9', '9:21'
    ];

    return (
        <Card className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 border-none shadow-xl flex-1 flex flex-col h-full">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="font-black text-2xl uppercase tracking-tight">{t.project.generate}</h3>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {/* Prompt Input */}
                <Textarea 
                    label={t.project.promptPlaceholder}
                    placeholder={t.project.promptPlaceholder}
                    labelPlacement="outside"
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    minRows={6}
                    className="font-medium"
                    value={prompt}
                    onValueChange={setPrompt}
                    isDisabled={generating}
                    classNames={{
                        label: "font-black text-[10px] uppercase tracking-widest text-slate-400 mb-3",
                        input: "text-base leading-relaxed",
                        inputWrapper: "border-2 group-data-[focus=true]:border-indigo-500 p-6"
                    }}
                />

                {/* Model Selection */}
                <Select
                    label={t.project.modelLabel}
                    labelPlacement="outside"
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    selectedKeys={new Set(selectedModelId ? [selectedModelId] : [])}
                    onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0] as string;
                        setSelectedModelId(selected);
                        // Reset dynamic inputs when model changes
                        setReferenceImages([]);
                        setStartImage('');
                        setEndImage('');
                        setCount(1);
                        setGuidanceScale(2.5); // Reset to default
                    }}
                    isDisabled={generating}
                    classNames={{
                        label: "font-black text-[10px] uppercase tracking-widest text-slate-400 mb-3",
                        trigger: "border-2 group-data-[focus=true]:border-indigo-500 h-14",
                        value: "font-bold text-indigo-600 dark:text-indigo-400"
                    }}
                >
                    {models.map(m => (
                        <SelectItem key={m.id} value={m.id} textValue={m.name}>
                            {m.name}
                        </SelectItem>
                    ))}
                </Select>

                {/* Dynamic Inputs based on Capabilities */}
                {selectedModel && (
                    <div className="space-y-6 pt-2">
                        {/* Reference Images */}
                        {capabilities.supportsReferenceImage && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="font-black text-[10px] uppercase tracking-widest text-slate-400">
                                        {t.character.referenceImages} ({referenceImages.length}/{capabilities.maxReferenceImages || 1})
                                    </label>
                                    <Button 
                                        size="sm" 
                                        variant="flat" 
                                        isIconOnly
                                        isDisabled={generating || referenceImages.length >= (capabilities.maxReferenceImages || 1)}
                                        onPress={() => refInputRef.current?.click()}
                                    >
                                        <Upload className="w-4 h-4" />
                                    </Button>
                                    <input 
                                        type="file" 
                                        hidden 
                                        ref={refInputRef} 
                                        accept="image/*" 
                                        multiple 
                                        onChange={(e) => handleFileSelect(e, 'ref')}
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {referenceImages.map((img, idx) => (
                                        <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 group">
                                            <img src={img} className="w-full h-full object-cover" alt="ref" />
                                            <button 
                                                className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white"
                                                onClick={() => removeRefImage(idx)}
                                            >
                                                x
                                            </button>
                                        </div>
                                    ))}
                                    {referenceImages.length === 0 && (
                                        <div className="text-xs text-slate-400 italic">{t.aiParams.noReferenceImages}</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Unified Dynamic Parameters */}
                        <DynamicModelParameters 
                            modelConfig={modelConfig}
                            values={{
                                [UNIFIED_KEYS.ASPECT_RATIO]: aspectRatio,
                                [UNIFIED_KEYS.RESOLUTION]: resolution,
                                [UNIFIED_KEYS.COUNT]: count,
                                [UNIFIED_KEYS.GUIDANCE_SCALE]: guidanceScale,
                                ...extraParams
                            }}
                            onChange={handleParamChange}
                            disabled={generating}
                        />

                        {/* Start/End Frames for Video */}
                        {isVideoModel && (
                            <div className="grid grid-cols-2 gap-4">
                                {capabilities.supportsStartFrame && (
                                    <div className="space-y-2">
                                        <label className="font-black text-[10px] uppercase tracking-widest text-slate-400">{t.aiParams.startFrame}</label>
                                        <div 
                                            className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden relative"
                                            onClick={() => startInputRef.current?.click()}
                                        >
                                            {startImage ? (
                                                <img src={startImage} className="w-full h-full object-cover" alt="Start" />
                                            ) : (
                                                <ImageIcon className="w-6 h-6 text-slate-400" />
                                            )}
                                            <input type="file" hidden ref={startInputRef} accept="image/*" onChange={(e) => handleFileSelect(e, 'start')} />
                                            {startImage && (
                                                <button 
                                                    className="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white"
                                                    onClick={(e) => { e.stopPropagation(); setStartImage(''); }}
                                                >
                                                    x
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                {capabilities.supportsEndFrame && (
                                    <div className="space-y-2">
                                        <label className="font-black text-[10px] uppercase tracking-widest text-slate-400">{t.aiParams.endFrame}</label>
                                        <div 
                                            className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity border-2 border-dashed border-slate-300 dark:border-slate-700 overflow-hidden relative"
                                            onClick={() => endInputRef.current?.click()}
                                        >
                                            {endImage ? (
                                                <img src={endImage} className="w-full h-full object-cover" alt="End" />
                                            ) : (
                                                <ImageIcon className="w-6 h-6 text-slate-400" />
                                            )}
                                            <input type="file" hidden ref={endInputRef} accept="image/*" onChange={(e) => handleFileSelect(e, 'end')} />
                                            {endImage && (
                                                <button 
                                                    className="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white"
                                                    onClick={(e) => { e.stopPropagation(); setEndImage(''); }}
                                                >
                                                    x
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* Validation Errors */}
                        {capabilities.requiresImageInput && referenceImages.length === 0 && (
                             <p className="text-xs text-red-500 font-bold">{t.aiParams.requiresImageInput}</p>
                        )}
                    </div>
                )}
            </div>

            <div className="mt-8">
                <Button 
                    color="primary"
                    size="lg"
                    radius="full"
                    onPress={handleGenerateClick}
                    isLoading={generating}
                    disabled={generating || !selectedModelId || (capabilities.requiresImageInput && referenceImages.length === 0)}
                    className="w-full h-16 font-black uppercase tracking-widest text-sm shadow-xl shadow-indigo-500/30 active:scale-95 transition-all"
                    endContent={!generating && <ArrowRight className="w-5 h-5" />}
                >
                    {generating ? t.project.queued : t.project.generate}
                </Button>
            </div>
        </Card>
    );
};

export default GenerationForm;