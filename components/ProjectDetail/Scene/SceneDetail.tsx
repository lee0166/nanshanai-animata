
import React, { useState, useEffect, useRef } from 'react';
import { SceneAsset, GeneratedImage, AssetType, Job, JobStatus } from '../../../types';
import { DEFAULT_MODELS } from '../../../config/models';
import { resolveModelConfig } from '../../../services/modelUtils';
import { storageService } from '../../../services/storage';
import { isVideoFile, getMimeType } from '../../../services/fileUtils';
import { useApp } from '../../../contexts/context';
import { useToast } from '../../../contexts/ToastContext';
import { jobQueue } from '../../../services/queue';
import { aiService } from '../../../services/aiService';
import { 
    Input, 
    Select, 
    SelectItem, 
    Textarea, 
    Button, 
    Card, 
    Image, 
    ScrollShadow, 
    Tooltip, 
    Spinner,
    useDisclosure,
    Modal,
    ModalContent,
    ModalBody,
    Badge,
    Tabs,
    Tab,
    Slider
} from "@heroui/react";
import { Plus, X, Maximize2, Check, RefreshCw, Image as ImageIcon, Trash2, Upload, Eye, Wand2 } from 'lucide-react';
import { getSceneImagePrompt, getDefaultStylePrompt, DefaultStylePrompt } from '../../../services/prompt';
import ResourcePicker from '../../ResourcePicker';
import { usePreview } from '../../PreviewProvider';
import { ImageGenerationPanel } from '../Shared/ImageGenerationPanel';

interface SceneDetailProps {
    asset: SceneAsset;
    onUpdate: (updatedAsset: SceneAsset) => void;
    projectId: string;
}

const SceneDetail: React.FC<SceneDetailProps> = ({ asset, onUpdate, projectId }) => {
    const { t, settings } = useApp();
    const { showToast } = useToast();
    const { openPreview } = usePreview();
    const [generating, setGenerating] = useState(false);
    const [isCheckingJobs, setIsCheckingJobs] = useState(true);
    const [activeJobIds, setActiveJobIds] = useState<Set<string>>(new Set());
    
    // Local state for inputs (to support auto-save on blur)
    const [name, setName] = useState(asset.name);
    
    // Operation Area State
    const [prompt, setPrompt] = useState(asset.prompt || '');
    const [referenceImages, setReferenceImages] = useState<string[]>(asset.metadata?.referenceImages || []);
    const [aspectRatio, setAspectRatio] = useState<string>(asset.metadata?.aspectRatio || '16:9');
    const [resolution, setResolution] = useState<string>(asset.metadata?.resolution || '2K');
    const [style, setStyle] = useState<string>('');
    const [generateCount, setGenerateCount] = useState<number>(1);
    const [guidanceScale, setGuidanceScale] = useState<number>(2.5); // Default for seededit

    // URL Caches
    const [refUrls, setRefUrls] = useState<Record<string, string>>({});
    const [genUrls, setGenUrls] = useState<Record<string, string>>({});

    // Resolve initial model ID to a valid config ID if possible
    const getInitialModelId = () => {
        const savedId = asset.metadata?.modelId;
        if (!savedId) return '';
        
        // Check if it's already a valid config ID
        if (settings.models.some(m => m.id === savedId)) return savedId;
        
        // Check if it's a legacy modelId string
        const matched = settings.models.find(m => m.modelId === savedId);
        if (matched) return matched.id;
        
        return '';
    };

    const [modelId, setModelId] = useState(getInitialModelId());
    
    // Derived state for current model
    const runtimeModel = settings.models.find(m => m.id === modelId) || settings.models.find(m => m.type === 'image') || settings.models[0];
    
    // Find matching static config to augment missing capabilities if runtime settings are stale
    const staticModel = resolveModelConfig(runtimeModel);
    
    const capabilities = {
        ...staticModel?.capabilities, // Base with static (contains new fields)
        ...runtimeModel?.capabilities, // Override with runtime (if updated)
        // Ensure array fields include new options from static config
        supportedResolutions: Array.from(new Set([
            ...(staticModel?.capabilities?.supportedResolutions || []),
            ...(runtimeModel?.capabilities?.supportedResolutions || [])
        ])).filter(Boolean),
        // Also ensure pixel limits are taken from static if missing in runtime
        minPixels: runtimeModel?.capabilities?.minPixels ?? staticModel?.capabilities?.minPixels,
        maxPixels: runtimeModel?.capabilities?.maxPixels ?? staticModel?.capabilities?.maxPixels,
        minAspectRatio: runtimeModel?.capabilities?.minAspectRatio ?? staticModel?.capabilities?.minAspectRatio,
        maxAspectRatio: runtimeModel?.capabilities?.maxAspectRatio ?? staticModel?.capabilities?.maxAspectRatio,
    };

    // Dynamic Options based on capabilities
    const availableResolutions = capabilities.supportedResolutions || ['2K', '4K'];
    
    // Filter aspect ratios if constrained
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

    // Reset params when model changes if current selection is invalid
    useEffect(() => {
        // Only auto-correct if not generating to avoid state jumps during process
        if (generating || isCheckingJobs) return;

        let needsUpdate = false;
        let newRes = resolution;
        let newRatio = aspectRatio;

        // Check Resolution
        if (!availableResolutions.includes(resolution)) {
            const defaultRes = capabilities.defaultResolution || availableResolutions[0];
            if (defaultRes) {
                newRes = defaultRes;
                needsUpdate = true;
            }
        }

        // Check Aspect Ratio
        if (!availableAspectRatios.includes(aspectRatio)) {
            const defaultRatio = '16:9'; // Default for scenes is typically wide
            if (availableAspectRatios.includes(defaultRatio)) {
                newRatio = defaultRatio;
                needsUpdate = true;
            } else if (availableAspectRatios.length > 0) {
                newRatio = availableAspectRatios[0];
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            console.log(`[SceneDetail] Auto-correcting params for model ${modelId}: Res ${resolution}->${newRes}, Ratio ${aspectRatio}->${newRatio}`);
            setResolution(newRes);
            setAspectRatio(newRatio);
            // Update metadata to persist correction
            onUpdate({
                ...asset,
                metadata: {
                    ...asset.metadata,
                    resolution: newRes,
                    aspectRatio: newRatio
                }
            });
        }
    }, [modelId, capabilities, generating, isCheckingJobs]); // Re-run when model (capabilities) changes

    // Resources Picker
    const { isOpen: isPickerOpen, onOpen: onPickerOpen, onClose: onPickerClose } = useDisclosure();
    
    // Delete Confirmation
    const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
    const [imageToDelete, setImageToDelete] = useState<GeneratedImage | null>(null);

    const promptDeleteImage = (img: GeneratedImage, e: React.MouseEvent) => {
        e.stopPropagation();
        setImageToDelete(img);
        onDeleteOpen();
    };

    const confirmDeleteImage = async () => {
        if (!imageToDelete || !asset.generatedImages) return;

        try {
            // SOFT DELETE: Only remove reference from asset, do NOT delete file
            // File management is handled in Resource Manager

            const newImages = asset.generatedImages.filter(i => i.id !== imageToDelete.id);
            
            let updated = { 
                ...asset, 
                generatedImages: newImages 
            };

            // If we deleted the current image, deselect or select another
            if (asset.currentImageId === imageToDelete.id) {
                updated.currentImageId = undefined;
                updated.filePath = undefined;
                // Optionally select the last one?
                if (newImages.length > 0) {
                    const last = newImages[newImages.length - 1];
                    updated.currentImageId = last.id;
                    updated.filePath = last.path;
                    
                    // Also update display params to match new selection
                    if (last.metadata?.style) setStyle(last.metadata.style);
                    if (last.metadata?.generateCount) setGenerateCount(last.metadata.generateCount);
                }
            }

            onUpdate(updated);
            showToast(t.common?.deleteSuccess || 'Image deleted', 'success');
        } catch (error) {
            console.error("Error deleting image:", error);
            showToast(t.errors?.unknownError || 'Failed to delete image', 'error');
        } finally {
            onDeleteClose();
            setImageToDelete(null);
        }
    };

    // Initialize state from asset
    useEffect(() => {
        setGenerating(false);
        setName(asset.name);
        setPrompt(asset.prompt || '');
        
        let initialModelConfigId = asset.metadata?.modelConfigId || asset.metadata?.modelId;
        const imageModels = settings.models.filter(m => m.type === 'image');
        
        if (initialModelConfigId && !settings.models.some(m => m.id === initialModelConfigId)) {
             initialModelConfigId = imageModels[0]?.id || '';
        } else if (!initialModelConfigId) {
            initialModelConfigId = imageModels[0]?.id || '';
        }
        
        setModelId(initialModelConfigId);
        setReferenceImages(asset.metadata?.referenceImages || []);
        setAspectRatio(asset.metadata?.aspectRatio || '16:9');
        setResolution(asset.metadata?.resolution || '2K');
        setGuidanceScale(2.5); // Reset guidance scale on load

        // Check for active job on mount
        const checkActiveJob = async () => {
            setIsCheckingJobs(true);
            try {
                const jobs = await storageService.getJobs();
                const activeJobs = jobs.filter(j => 
                    j.params.assetId === asset.id && 
                    (j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING)
                );
                
                if (activeJobs.length > 0) {
                    console.log(`[SceneDetail] Found ${activeJobs.length} active jobs for asset ${asset.id}`);
                    setGenerating(true);
                    setActiveJobIds(new Set(activeJobs.map(j => j.id)));
                } else {
                    setGenerating(false);
                    setActiveJobIds(new Set());
                }
            } catch (e) {
                console.error("Error checking jobs:", e);
            } finally {
                setIsCheckingJobs(false);
            }
        };
        checkActiveJob();
    }, [asset.id, settings.models]);

    // Load URLs for reference images
    useEffect(() => {
        const loadRefUrls = async () => {
            const urls: Record<string, string> = {};
            for (const path of referenceImages) {
                if (path) {
                    urls[path] = await storageService.getAssetUrl(path);
                }
            }
            setRefUrls(urls);
        };
        loadRefUrls();
    }, [referenceImages]);

    // Subscribe to job queue to handle completion/failure
    useEffect(() => {
        const unsub = jobQueue.subscribe(async (job) => {
            // Only care about jobs for this asset
            if (job.params.assetId === asset.id) {
                if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
                    console.log(`[SceneDetail] Job ${job.id} finished with status: ${job.status}`);
                    
                    // Update tracking set
                    setActiveJobIds(prev => {
                        if (!prev.has(job.id)) return prev;

                        const newSet = new Set(prev);
                        newSet.delete(job.id);
                        
                        // Update generating state based on remaining jobs
                        if (newSet.size === 0) {
                            setGenerating(false);
                            if (job.status === JobStatus.COMPLETED) {
                                setTimeout(() => {
                                    showToast(t.project?.generationSuccess || 'Generation completed', 'success');
                                }, 0);
                            }
                        }
                        return newSet;
                    });

                    if (job.status === JobStatus.COMPLETED) {
                        // The JobQueue service has already updated the asset with the new image.
                        // We just need to reload the latest state from disk.
                        try {
                            const updatedAsset = await storageService.getAsset(asset.id, projectId) as SceneAsset;
                            console.log(`[SceneDetail] Reloaded asset ${asset.id}. Generated images count: ${updatedAsset?.generatedImages?.length || 0}`);
                            
                            if (updatedAsset) {
                                onUpdate(updatedAsset, true);

                                if (updatedAsset.generatedImages && updatedAsset.generatedImages.length > 0) {
                                    // Select the latest image (last one in the list)
                                    const latestImg = updatedAsset.generatedImages[updatedAsset.generatedImages.length - 1];
                                    
                                    // Also ensure local state matches
                                    setPrompt(latestImg.userPrompt || latestImg.prompt);
                                    setReferenceImages(latestImg.referenceImages || []);
                                    setAspectRatio(latestImg.metadata?.aspectRatio || '16:9');
                                    setResolution(latestImg.metadata?.resolution || '2K');
                                    
                                    if (latestImg.metadata?.style) setStyle(latestImg.metadata.style);
                                    if (latestImg.metadata?.generateCount) setGenerateCount(latestImg.metadata.generateCount);
                                    
                                    // Map modelId
                                    if (latestImg.modelConfigId && settings.models.some(m => m.id === latestImg.modelConfigId)) {
                                        setModelId(latestImg.modelConfigId);
                                    } else {
                                        let targetModelId = latestImg.modelId;
                                        if (!settings.models.some(m => m.id === targetModelId)) {
                                            const matched = settings.models.find(m => m.modelId === targetModelId);
                                            if (matched) targetModelId = matched.id;
                                        }
                                        setModelId(targetModelId);
                                    }
                                }
                            }
                        } catch (e) {
                            console.error("Failed to reload asset after generation:", e);
                        }
                    } else if (job.status === JobStatus.FAILED) {
                        showToast(job.error || t.errors.generationFailed, 'error');
                    }
                }
            }
        });
        return () => unsub();
    }, [asset.id, settings.models]); 

    // Load URLs for generated images
    useEffect(() => {
        const loadGenUrls = async () => {
            if (!asset.generatedImages) return;
            const urls: Record<string, string> = {};
            for (const img of asset.generatedImages) {
                if (img.path) {
                    if (img.path.startsWith('remote:')) {
                        urls[img.id] = img.path.substring(7);
                    } else {
                        urls[img.id] = await storageService.getAssetUrl(img.path);
                    }
                }
            }
            setGenUrls(urls);
        };
        loadGenUrls();
    }, [asset.generatedImages]);

    // Auto-save handlers
    const handleSaveInfo = () => {
        if (name !== asset.name) {
            const updated = { ...asset, name };
            onUpdate(updated);
        }
    };

    // Operation Area Handlers
    const handleReferenceSelect = (paths: string[]) => {
        const newRefs = Array.from(new Set([...referenceImages, ...paths]));
        setReferenceImages(newRefs);
        const updated = {
            ...asset,
            metadata: {
                ...asset.metadata,
                referenceImages: newRefs,
                modelId
            },
            prompt
        };
        onUpdate(updated);
    };

    const removeReference = (path: string) => {
        const newRefs = referenceImages.filter(p => p !== path);
        setReferenceImages(newRefs);
        const updated = {
            ...asset,
            metadata: {
                ...asset.metadata,
                referenceImages: newRefs
            }
        };
        onUpdate(updated);
    };

    const handlePromptChange = (val: string) => {
        setPrompt(val);
    };

    const handlePromptBlur = () => {
         const updated = { ...asset, prompt };
         onUpdate(updated);
    };

    const handleModelChange = (val: string) => {
        setModelId(val);
        const updated = {
            ...asset,
            metadata: {
                ...asset.metadata,
                modelId: val
            }
        };
        onUpdate(updated);
    };

    // Generation
    const handleGenerate = async () => {
        if (!prompt || !modelId) {
            showToast(t.project?.alertFill, 'warning');
            return;
        }

        if (!projectId) {
            showToast(t.errors.projectIdMissing, 'error');
            return;
        }

        const model = settings.models.find(m => m.id === modelId);
        if (!model) {
            showToast(t.errors.modelNotFound, 'error');
            return;
        }

        setGenerating(true);
        showToast(t.project?.generationStarted, 'info');

        // Apply prompt template for scene generation
        const stylePrompt = getDefaultStylePrompt(style);
        
        const scenePrompt = getSceneImagePrompt(prompt);
        const finalPrompt = `${scenePrompt} ${stylePrompt}`;

        // Save metadata when generating to persist current selection
        const updated = {
            ...asset,
            prompt,
            metadata: {
                ...asset.metadata,
                modelConfigId: modelId,
                referenceImages,
                aspectRatio,
                resolution
            }
        };
        onUpdate(updated);
        
        try {
            console.log(`[SceneDetail] Submitting generation job for asset: ${asset.id} with count: ${generateCount}`);

            const jobs = aiService.createGenerationJobs(
                model,
                {
                    projectId,
                    prompt: finalPrompt,
                    userPrompt: prompt,
                    assetName: asset.name,
                    assetType: AssetType.SCENE,
                    assetId: asset.id,
                    referenceImages,
                    aspectRatio,
                    resolution,
                    style,
                    guidanceScale
                },
                generateCount
            );

            await jobQueue.addJobs(jobs);
            console.log(`[SceneDetail] Added ${jobs.length} jobs`);

            setActiveJobIds(prev => {
                const newSet = new Set(prev);
                jobs.forEach(job => newSet.add(job.id));
                return newSet;
            });
        } catch (error: any) {
            console.error('[SceneDetail] Failed to add job:', error);
            showToast(error.message || t.errors.failedToStart, 'error');
            setGenerating(false);
        }
    };

    // Image List Actions
    const handleSelectImage = (img: GeneratedImage) => {
        // Toggle selection
        if (asset.currentImageId === img.id) {
            // Deselect
            const updated = { ...asset, currentImageId: undefined, filePath: undefined };
            onUpdate(updated);
        } else {
            // Select
            // Update asset prompt/model/refs to match this image
            setPrompt(img.userPrompt || img.prompt);
            
            // Map modelId
            let targetModelId = '';
            if (img.modelConfigId && settings.models.some(m => m.id === img.modelConfigId)) {
                targetModelId = img.modelConfigId;
            } else {
                targetModelId = img.modelId;
                if (!settings.models.some(m => m.id === targetModelId)) {
                    const matched = settings.models.find(m => m.modelId === targetModelId);
                    if (matched) targetModelId = matched.id;
                }
            }
            setModelId(targetModelId);

            setReferenceImages(img.referenceImages || []);
            setAspectRatio(img.metadata?.aspectRatio || '16:9');
            setResolution(img.metadata?.resolution || '2K');
            setStyle(img.metadata?.style || '');
            setGenerateCount(img.metadata?.generateCount || 1);
            if (img.metadata?.guidanceScale) {
                setGuidanceScale(img.metadata.guidanceScale);
            }
            
            const updated = { 
                ...asset, 
                currentImageId: img.id,
                filePath: img.path, // Set as main asset image
                prompt: img.userPrompt || img.prompt,
                metadata: {
                    ...asset.metadata,
                    modelId: targetModelId,
                    referenceImages: img.referenceImages,
                    aspectRatio: img.metadata?.aspectRatio || '16:9',
                    resolution: img.metadata?.resolution || '2K'
                }
            };
            onUpdate(updated);
        }
    };

    return (
        <div className="h-full flex flex-row gap-8 w-full overflow-hidden">
            {/* Left Column - Information & Operations */}
            <div className="w-[520px] flex-shrink-0 flex flex-col gap-8 overflow-y-auto pr-2 pb-10">
                {/* 1. Basic Information */}
                <div className="flex flex-col gap-6">
                    <h3 className="text-sm font-black text-indigo-500/80 dark:text-indigo-400 uppercase tracking-widest mb-2">{t.project.basicInfo}</h3>
                    <div className="flex flex-col gap-2">
                        <label className="text-slate-300 font-bold text-base ml-1">{t.project.nameLabel}</label>
                        <Input 
                            placeholder={t.project.nameLabel}
                            value={name}
                            onValueChange={(val) => setName(val)}
                            onBlur={handleSaveInfo}
                            className="w-full"
                            variant="bordered"
                            radius="lg"
                            isDisabled={generating || isCheckingJobs}
                            classNames={{ 
                                input: "font-bold text-sm",
                                inputWrapper: "border-2 group-data-[focus=true]:border-primary"
                            }}
                        />
                    </div>
                </div>

                {/* 2. Generation Panel */}
                <div className="flex flex-col gap-4">
                     <h3 className="text-sm font-black text-indigo-500/80 dark:text-indigo-400 uppercase tracking-widest mb-2">{t.project.generationSettings}</h3>
                     <ImageGenerationPanel
                        projectId={projectId}
                        prompt={prompt}
                        onPromptChange={handlePromptChange}
                        onPromptBlur={handlePromptBlur}
                        modelId={modelId}
                        onModelChange={handleModelChange}
                        referenceImages={referenceImages}
                        onReferenceImagesChange={(newRefs) => {
                            setReferenceImages(newRefs);
                            onUpdate({
                                ...asset,
                                metadata: { ...asset.metadata, referenceImages: newRefs }
                            });
                        }}
                        aspectRatio={aspectRatio}
                        onAspectRatioChange={(val) => {
                            setAspectRatio(val);
                            onUpdate({
                                ...asset,
                                metadata: { ...asset.metadata, aspectRatio: val }
                            });
                        }}
                        resolution={resolution}
                        onResolutionChange={(val) => {
                            setResolution(val);
                            onUpdate({
                                ...asset,
                                metadata: { ...asset.metadata, resolution: val }
                            });
                        }}
                        style={style}
                        onStyleChange={setStyle}
                        count={generateCount}
                        onCountChange={setGenerateCount}
                        guidanceScale={guidanceScale}
                        onGuidanceScaleChange={setGuidanceScale}
                        generating={generating || isCheckingJobs}
                        onGenerate={handleGenerate}
                    />
                </div>
            </div>

            {/* Right Column - Generated Images Grid */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                     <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">生成结果</h3>
                     <div className="px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800/50 text-xs font-bold text-slate-600 dark:text-slate-300">
                        图片 ({asset.generatedImages?.length || 0})
                     </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {asset.generatedImages?.slice().reverse().map((img) => {
                            const isSelected = asset.currentImageId === img.id;
                            const url = genUrls[img.id] || (img.path.startsWith('remote:') ? img.path.substring(7) : undefined);
                            
                            if (!url) return null;

                            return (
                                <div key={img.id} className="relative group cursor-pointer" onClick={() => handleSelectImage(img)}>
                                    <Card 
                                        className={`aspect-[16/9] border-2 transition-all duration-300 ${isSelected ? 'border-indigo-600 shadow-xl scale-[1.02]' : 'border-transparent hover:border-indigo-500/50 hover:shadow-lg'}`}
                                        radius="lg"
                                        shadow="sm"
                                    >
                                        <div className="w-full h-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
                                            <img
                                                src={url}
                                                alt="Generated"
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                        </div>
                                        
                                        {isSelected && (
                                            <div className="absolute top-2 left-2 z-20 bg-indigo-600 text-white rounded-full p-1.5 shadow-md ring-2 ring-white dark:ring-slate-900">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}

                                        <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-2 translate-y-[-10px] group-hover:translate-y-0">
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="flat"
                                                className="bg-black/60 text-white hover:bg-black/80 backdrop-blur-md rounded-full w-8 h-8"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (!asset.generatedImages) return;
                                                    
                                                    const validItems = asset.generatedImages.filter(i => {
                                                        const u = genUrls[i.id] || (i.path.startsWith('remote:') ? i.path.substring(7) : undefined);
                                                        return !!u;
                                                    });

                                                    const slides = validItems.map(i => {
                                                        const u = genUrls[i.id] || (i.path.startsWith('remote:') ? i.path.substring(7) : '');
                                                        const isVideo = isVideoFile(i.path);
                                                        if (isVideo) {
                                                            return { type: "video" as const, sources: [{ src: u, type: getMimeType(i.path) }] };
                                                        }
                                                        return { src: u };
                                                    });
                                                    
                                                    const idx = validItems.findIndex(i => i.id === img.id);
                                                    openPreview(slides, idx >= 0 ? idx : 0);
                                                }}
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="flat"
                                                className="bg-red-500/80 text-white hover:bg-red-600 backdrop-blur-md rounded-full w-8 h-8"
                                                onClick={(e) => promptDeleteImage(img, e)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </Card>
                                </div>
                            );
                        })}
                        
                        {(!asset.generatedImages || asset.generatedImages.length === 0) && (
                            <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                                    <ImageIcon className="w-8 h-8 opacity-50" />
                                </div>
                                <span className="uppercase tracking-widest text-xs font-black opacity-50">{t.project?.noGenerations || 'No generations yet'}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Resource Picker Modal */}
            <ResourcePicker 
                isOpen={isPickerOpen} 
                onClose={onPickerClose} 
                onSelect={handleReferenceSelect} 
                maxSelect={5} 
                projectId={projectId}
                accept="image/*"
            />

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} size="sm">
                <ModalContent>
                    <ModalBody className="py-6">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">{t.common.confirmDeleteTitle}</h3>
                                <p className="text-sm text-default-500 mt-1">
                                    {t.common.confirmDeleteImageDesc}
                                </p>
                            </div>
                            <div className="flex gap-3 w-full mt-2">
                                <Button fullWidth variant="flat" onPress={onDeleteClose}>
                                    {t.common.cancel}
                                </Button>
                                <Button fullWidth color="danger" onPress={confirmDeleteImage}>
                                    {t.common.delete}
                                </Button>
                            </div>
                        </div>
                    </ModalBody>
                </ModalContent>
            </Modal>
        </div>
    );

};

export default SceneDetail;
