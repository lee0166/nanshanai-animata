import { useState, useEffect, useRef, FC, useMemo } from 'react';
import { FragmentAsset, GeneratedVideo, AssetType, Job, JobStatus, CharacterAsset, ItemAsset, SceneAsset, ItemType } from '../../../types';
import { storageService } from '../../../services/storage';
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
    Modal, 
    ModalContent, 
    ModalHeader, 
    ModalBody, 
    ModalFooter,
    Tabs,
    Tab,
    Accordion,
    AccordionItem,
    Switch
} from "@heroui/react";
import { X, Loader2, Trash2, Film, Image as ImageIcon, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { usePreview } from '../../PreviewProvider';
import { ImageGenerationPanel } from '../Shared/ImageGenerationPanel';
import { StyleSelector } from '../Shared/StyleSelector';
import { DynamicModelParameters } from '../Shared/DynamicModelParameters';
import ResourcePicker from '../../ResourcePicker';
import { getParamOptions, UNIFIED_KEYS, resolveModelConfig, processModelParams } from '../../../services/modelUtils';
import { DEFAULT_MODELS } from '../../../config/models';

interface FragmentDetailProps {
    asset: FragmentAsset;
    onUpdate: (updatedAsset: FragmentAsset) => void;
    projectId: string;
}

// Helper to get assets by type from project
const useProjectAssets = (projectId: string) => {
    const [characters, setCharacters] = useState<CharacterAsset[]>([]);
    const [scenes, setScenes] = useState<SceneAsset[]>([]);
    const [items, setItems] = useState<ItemAsset[]>([]);
    const [effects, setEffects] = useState<ItemAsset[]>([]);
    const [refs, setRefs] = useState<ItemAsset[]>([]);

    useEffect(() => {
        const loadAssets = async () => {
            const assets = await storageService.getAssets(projectId);
            if (assets) {
                setCharacters(assets.filter(a => a.type === AssetType.CHARACTER) as CharacterAsset[]);
                setScenes(assets.filter(a => a.type === AssetType.SCENE) as SceneAsset[]);
                const allItems = assets.filter(a => a.type === AssetType.ITEM) as ItemAsset[];
                setItems(allItems.filter(i => !i.itemType || i.itemType === ItemType.PROP || i.itemType === ItemType.ANIMAL));
                setEffects(allItems.filter(i => i.itemType === ItemType.EFFECT));
                setRefs(allItems.filter(i => i.itemType === ItemType.REFERENCE));
            }
        };
        loadAssets();
    }, [projectId]);

    return { characters, scenes, items, effects, refs };
};

const FragmentDetail: FC<FragmentDetailProps> = ({ asset, onUpdate, projectId }) => {
    const { t, settings } = useApp();
    const { showToast } = useToast();
    const { openPreview } = usePreview();
    const { characters, scenes, items, effects, refs } = useProjectAssets(projectId);
    
    const [generating, setGenerating] = useState(false);
    const [activeJobIds, setActiveJobIds] = useState<Set<string>>(new Set());
    
    // Core State
    const [videoName, setVideoName] = useState(asset.videoName || asset.name || '');
    const [modelId, setModelId] = useState<string>('');

    // Sync videoName when asset changes
    useEffect(() => {
        setVideoName(asset.videoName || asset.name || '');
    }, [asset.id]);

    // Save videoName back to asset when it changes
    useEffect(() => {
        if (videoName !== asset.videoName) {
            onUpdate({ ...asset, videoName });
        }
    }, [videoName]);

    const [generationType, setGenerationType] = useState<'text_to_video' | 'first_last_frame' | 'multi_ref'>('text_to_video');
    const [prompt, setPrompt] = useState(asset.prompt || '');
    const [style, setStyle] = useState<string>('');
    const [duration, setDuration] = useState<number>(5);
    const [ratio, setRatio] = useState<string>('16:9');
    const [resolution, setResolution] = useState<string>('720p');
    const [offPeak, setOffPeak] = useState<boolean>(false);
    const [generateCount, setGenerateCount] = useState<number>(1);
    const [extraParams, setExtraParams] = useState<Record<string, any>>({});

    // Selection State
    const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
    const [selectedRefs, setSelectedRefs] = useState<string[]>([]);
    const [selectedScene, setSelectedScene] = useState<string>('');

    // First/Last Frame State
    const [startImage, setStartImage] = useState<string>('');
    const [endImage, setEndImage] = useState<string>('');
    
    // Image Generation Modal State
    const [imgGenModalOpen, setImgGenModalOpen] = useState(false);
    const [imgGenTarget, setImgGenTarget] = useState<'start' | 'end'>('start');
    const [imgGenPrompt, setImgGenPrompt] = useState('');
    const [imgGenModelId, setImgGenModelId] = useState('');
    const [imgGenLoading, setImgGenLoading] = useState(false);

    // Image Gen Params
    const [imgGenCount, setImgGenCount] = useState<number>(1);
    const [imgGenAspectRatio, setImgGenAspectRatio] = useState<string>('16:9');
    const [imgGenResolution, setImgGenResolution] = useState<string>('');
    const [imgGenStyle, setImgGenStyle] = useState<string>('');
    const [imgGenReferenceImages, setImgGenReferenceImages] = useState<string[]>([]);
    const [imgGenGuidanceScale, setImgGenGuidanceScale] = useState<number>(2.5);

    // Resource Picker State
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerTarget, setPickerTarget] = useState<'start' | 'end'>('start');

    // Delete Video State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [videoToDelete, setVideoToDelete] = useState<GeneratedVideo | null>(null);

    // Sync Params State
    const [syncModalOpen, setSyncModalOpen] = useState(false);
    const [videoToSync, setVideoToSync] = useState<GeneratedVideo | null>(null);

    // Job Names Cache (to show correct name during generation)
    const [jobNames, setJobNames] = useState<Record<string, string>>({});

    // URL Caches
    const [urlCache, setUrlCache] = useState<Record<string, string>>({});

    // Derived state for current model
    const runtimeModel = settings.models.find(m => m.id === modelId) || settings.models.find(m => m.type === 'video');
    
    // Find matching static config to augment missing capabilities if runtime settings are stale
    const staticModel = resolveModelConfig(runtimeModel);
    
    const modelConfig = useMemo(() => {
        if (!runtimeModel) return staticModel;
        let config = {
            ...staticModel,
            ...runtimeModel,
            capabilities: {
                ...staticModel?.capabilities,
                ...runtimeModel?.capabilities,
                supportedResolutions: Array.from(new Set([
                    ...(staticModel?.capabilities?.supportedResolutions || []),
                    ...(runtimeModel?.capabilities?.supportedResolutions || [])
                ])).filter(Boolean),
            },
            parameters: staticModel?.parameters || runtimeModel?.parameters // Prefer static parameters as they contain latest options
        };

        // Apply parameter visibility/hidden rules
        if (config.parameters) {
            const hasStart = !!startImage;
            const hasEnd = !!endImage;
            config = {
                ...config,
                parameters: processModelParams(config.parameters, {
                    generationType: generationType,
                    hasStartImage: hasStart,
                    hasEndImage: hasEnd
                })
            };
        }

        return config;
    }, [runtimeModel, staticModel, generationType, endImage, startImage]);

    // Sync parameters when model changes
    useEffect(() => {
        if (!modelConfig) return;
        
        // Ensure ratio is valid for new model
        const ratioParams = modelConfig.parameters?.find(p => p.name === UNIFIED_KEYS.ASPECT_RATIO);
        if (ratioParams?.options && !ratioParams.options.some(o => o.value === ratio)) {
            setRatio(ratioParams.defaultValue as string || (ratioParams.options[0]?.value as string) || '16:9');
        }

        // Ensure resolution is valid for new model
        const resParams = modelConfig.parameters?.find(p => p.name === UNIFIED_KEYS.RESOLUTION);
        if (resParams?.options && !resParams.options.some(o => o.value === resolution)) {
            setResolution(resParams.defaultValue as string || (resParams.options[0]?.value as string) || '720p');
        }
    }, [modelId, modelConfig]);

    // Task 2: Model list should always be visible. 
    // We NO LONGER filter available models for the list.
    const allVideoModels = settings.models.filter(m => m.type === 'video');

    // Helper to check if a model is valid for current inputs (for disabling generation button or showing warning)
    const isModelCompatibleWithInputs = (m: any) => {
        const hasStart = !!startImage;
        const hasEnd = !!endImage;
        if (hasStart && !m.capabilities?.supportsStartFrame) return false;
        if (hasEnd && !m.capabilities?.supportsEndFrame) return false;
        if (!hasStart && !hasEnd && m.capabilities?.requiresImageInput) return false;
        return true;
    };

    // Helper to check if a generation type is supported by current model
    const isTypeSupported = (type: string) => {
        return modelConfig?.capabilities?.supportedGenerationTypes?.includes(type as any);
    };

    // Auto-switch generation type if current one becomes unsupported
    useEffect(() => {
        if (!modelConfig) return;
        const supported = modelConfig.capabilities?.supportedGenerationTypes || [];
        if (!supported.includes(generationType) && supported.length > 0) {
            setGenerationType(supported[0] as any);
        }
    }, [modelId, modelConfig]); // removed generationType from dependency to avoid loop

    // Initialize
    useEffect(() => {
        // Set initial model if not set
        if (!modelId && allVideoModels.length > 0) {
            setModelId(allVideoModels[0].id);
        }
        
        // Set initial image model for popup
        if (!imgGenModelId) {
             const imgModels = settings.models.filter(m => m.type === 'image');
             if (imgModels.length > 0) {
                 setImgGenModelId(imgModels[0].id);
             }
        }
    }, [settings.models]); 

    // Load URLs for all resources (for the new grid UI)
    useEffect(() => {
        const loadAllResourceUrls = async () => {
            const allResources = [...characters, ...scenes, ...items, ...effects, ...refs];
            const updates: Record<string, string> = {};
            let changed = false;
            
            for (const r of allResources) {
                if (r.filePath && !urlCache[r.filePath] && !updates[r.filePath]) {
                    updates[r.filePath] = await storageService.getAssetUrl(r.filePath);
                    changed = true;
                }
            }
            if (changed) setUrlCache(prev => ({...prev, ...updates}));
        };
        if (characters.length || scenes.length || items.length) {
            loadAllResourceUrls();
        }
    }, [characters, scenes, items, effects, refs]);


    // Update available generation types based on model ID
    useEffect(() => {
        if (!modelConfig) return;

        // Use capabilities from model config to determine supported types
        const supportedTypes = modelConfig.capabilities?.supportedGenerationTypes || [];
        
        // Auto-switch if current type is not supported
        if (!supportedTypes.includes(generationType)) {
            if (supportedTypes.length > 0) setGenerationType(supportedTypes[0] as any);
        }
    }, [modelId, modelConfig]);

    // Load URLs for images and videos
    useEffect(() => {
        const loadUrls = async () => {
            const pathsToLoad = new Set<string>();
            if (startImage) pathsToLoad.add(startImage);
            if (endImage) pathsToLoad.add(endImage);
            asset.videos?.forEach(v => {
                if (v.path) pathsToLoad.add(v.path);
            });
            asset.generatedImages?.forEach(i => {
                if (i.path) pathsToLoad.add(i.path);
            });

            const updates: Record<string, string> = {};
            let changed = false;

            for (const path of pathsToLoad) {
                if (!urlCache[path] && !updates[path]) {
                    const url = await storageService.getAssetUrl(path);
                    updates[path] = url;
                    changed = true;
                }
            }

            if (changed) {
                setUrlCache(prev => ({...prev, ...updates}));
            }
        };
        loadUrls();
    }, [startImage, endImage, asset.videos, asset.generatedImages]);

    // Job Monitoring
    useEffect(() => {
        // Check for active jobs on mount
        const checkActiveJobs = async () => {
            const jobs = await storageService.getJobs();
            const fragmentJobs = jobs.filter(j => 
                j.projectId === projectId && 
                j.params.assetId === asset.id &&
                (j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING)
            );
            
            if (fragmentJobs.length > 0) {
                setActiveJobIds(new Set(fragmentJobs.map(j => j.id)));
                // setGenerating(true); // Don't block UI for background jobs
            }
        };
        checkActiveJobs();

        // Subscribe to job updates
        const unsubscribe = jobQueue.subscribe(async (job) => {
            // Only care about jobs for this asset
            if (job.projectId === projectId && job.params.assetId === asset.id) {
                if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
                    
                    // Update tracking set
                    setActiveJobIds(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(job.id);
                        return newSet;
                    });

                    if (job.status === JobStatus.COMPLETED) {
                        showToast(t.project.generationSuccess, 'success');
                        
                        // Auto-select generated image if it was a start/end frame job
                        if (job.type === 'generate_image' && job.result?.path) {
                             const isStart = job.params.assetName?.includes('_start_frame') || job.params.userPrompt?.includes('start frame');
                             const isEnd = job.params.assetName?.includes('_end_frame') || job.params.userPrompt?.includes('end frame');
                             
                             if (isStart) {
                                 setStartImage(job.result.path);
                                 // Also set generation type to first_last_frame to show it's ready
                                 setGenerationType('first_last_frame');
                             } else if (isEnd) {
                                 setEndImage(job.result.path);
                                 setGenerationType('first_last_frame');
                             }
                        }

                        // The JobQueue service has already updated the asset with the new image.
                        // We just need to reload the latest state from disk.
                        try {
                            // Fetch the final asset
                            const finalAsset = await storageService.getAsset(asset.id, projectId) as FragmentAsset;
                            
                            // Update UI state (skipSave=true)
                            if (finalAsset) {
                                onUpdate(finalAsset, true);
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

        return () => {
            unsubscribe();
        };
    }, [projectId, asset.id]);

    // Helper to build prompt from selections
    const buildFullPrompt = () => {
        let fullPrompt = prompt;
        const labels = t.project.fragment.promptLabels;
        
        // Add resource prompts for Text-to-Video
        if (generationType === 'text_to_video') {
            const charPrompts = selectedCharacters.map(id => characters.find(c => c.id === id)?.prompt).filter(Boolean).join(', ');
            const itemPrompts = selectedItems.map(id => items.find(i => i.id === id)?.prompt).filter(Boolean).join(', ');
            const effectPrompts = selectedEffects.map(id => effects.find(e => e.id === id)?.prompt).filter(Boolean).join(', ');
            const scenePrompt = scenes.find(s => s.id === selectedScene)?.prompt;

            if (charPrompts) fullPrompt += `\n${labels.characters}: ${charPrompts}`;
            if (itemPrompts) fullPrompt += `\n${labels.items}: ${itemPrompts}`;
            if (effectPrompts) fullPrompt += `\n${labels.effects}: ${effectPrompts}`;
            if (scenePrompt) fullPrompt += `\n${labels.scene}: ${scenePrompt}`;
        }
        
        // For Multi-Ref, we append image descriptions
        if (generationType === 'multi_ref') {
            let imageIndex = 1;
            const descriptions: string[] = [];

            // 1. Refs
            if (selectedRefs.length > 0) {
                const indices = selectedRefs.map(() => labels.imageIndex.replace('{index}', String(imageIndex++)));
                descriptions.push(`${indices.join(labels.separator)}${labels.isReference}`);
            }

            // 2. Scene
            if (selectedScene) {
                const scene = scenes.find(s => s.id === selectedScene);
                if (scene) {
                    const indexStr = labels.imageIndex.replace('{index}', String(imageIndex++));
                    descriptions.push(`${indexStr}${labels.isDescription.replace('{name}', scene.name)}`);
                }
            }
            
            // 3. Items
            selectedItems.forEach(id => {
                const item = items.find(i => i.id === id);
                if (item) {
                     const indexStr = labels.imageIndex.replace('{index}', String(imageIndex++));
                     descriptions.push(`${indexStr}${labels.isDescription.replace('{name}', item.name)}`);
                }
            });

             // 4. Effects
            selectedEffects.forEach(id => {
                const effect = effects.find(e => e.id === id);
                if (effect) {
                     const indexStr = labels.imageIndex.replace('{index}', String(imageIndex++));
                     descriptions.push(`${indexStr}${labels.isDescription.replace('{name}', effect.name)}`);
                }
            });

            // 5. Characters
            selectedCharacters.forEach(id => {
                const char = characters.find(c => c.id === id);
                if (char) {
                    const indexStr = labels.imageIndex.replace('{index}', String(imageIndex++));
                    descriptions.push(`${indexStr}${labels.isDescription.replace('{name}', char.name)}`);
                }
            });

            if (descriptions.length > 0) {
                fullPrompt += `\n${descriptions.join(labels.separator)}${labels.period}`;
            }
        }

        return fullPrompt;
    };

    // Collect all selected images for Multi-Ref
    const collectRefImages = async () => {
        const images: string[] = [];
        
        // Helper to get image path from asset
        const getAssetImage = (a: any) => a.filePath; 

        // Order: Refs -> Scene -> Items -> Effects -> Characters
        for (const id of selectedRefs) {
            const r = refs.find(x => x.id === id);
            if (r?.filePath) images.push(r.filePath);
        }
        if (selectedScene) {
            const s = scenes.find(x => x.id === selectedScene);
            if (s?.filePath) images.push(s.filePath);
        }
        for (const id of selectedItems) {
            const i = items.find(x => x.id === id);
            if (i?.filePath) images.push(i.filePath);
        }
        for (const id of selectedEffects) {
            const e = effects.find(x => x.id === id);
            if (e?.filePath) images.push(e.filePath);
        }
        for (const id of selectedCharacters) {
            const c = characters.find(x => x.id === id);
            if (c?.filePath) images.push(c.filePath);
        }
        
        return images;
    };

    const handleParamChange = (key: string, value: any) => {
        if (key === UNIFIED_KEYS.DURATION) setDuration(Number(value));
        else if (key === UNIFIED_KEYS.ASPECT_RATIO) setRatio(String(value));
        else if (key === UNIFIED_KEYS.RESOLUTION) setResolution(String(value));
        else if (key === UNIFIED_KEYS.COUNT) setGenerateCount(Number(value));
        else if (key === UNIFIED_KEYS.OFF_PEAK) setOffPeak(Boolean(value));
        else if (key === UNIFIED_KEYS.STYLE) setStyle(String(value));
        else {
            setExtraParams(prev => ({ ...prev, [key]: value }));
        }
    };

    const handleGenerate = async () => {
        if (!modelConfig) return;
        
        setGenerating(true);
        try {
            const fullPrompt = buildFullPrompt();
            const refImages = await collectRefImages();
            
            // Check limits for multi_ref generation
            if (generationType === 'multi_ref') {
                 const maxImages = modelConfig.capabilities?.maxReferenceImages;
                 if (maxImages && refImages.length > maxImages) {
                     showToast(t.project?.maxImagesExceeded.replace('{max}', String(maxImages)).replace('{count}', String(refImages.length)), 'warning');
                     setGenerating(false);
                     return;
                 }
                 
                 if (refImages.length < 1) {
                     showToast(t.project?.minImagesRequired, 'warning');
                     setGenerating(false);
                     return;
                 }
            }

            // Prepare submission using AIService
            const jobs = aiService.createVideoGenerationJobs(
                modelConfig,
                {
                    projectId,
                    prompt: fullPrompt,
                    userPrompt: prompt,
                    assetName: videoName,
                    assetType: AssetType.VIDEO_SEGMENT,
                    assetId: asset.id,
                    duration,
                    ratio,
                    startImage: (generationType === 'first_last_frame' && modelConfig.capabilities?.supportsStartFrame) ? startImage : undefined,
                    endImage: (generationType === 'first_last_frame' && modelConfig.capabilities?.supportsEndFrame) ? endImage : undefined,
                    referenceImages: generationType === 'multi_ref' ? refImages : undefined,
                    extraParams: {
                        characters: selectedCharacters,
                        items: selectedItems,
                        effects: selectedEffects,
                        refs: selectedRefs,
                        scene: selectedScene,
                        generationType,
                        resolution,
                        off_peak: offPeak,
                        ...extraParams
                    }
                },
                generateCount
            );
            
            await jobQueue.addJobs(jobs);
            
            // Add to active jobs tracking
            setActiveJobIds(prev => {
                const newSet = new Set(prev);
                jobs.forEach(j => newSet.add(j.id));
                return newSet;
            });
            
            // Cache job names
            setJobNames(prev => {
                const next = { ...prev };
                jobs.forEach(j => {
                    next[j.id] = videoName;
                });
                return next;
            });
            
            showToast(t.project.generationStarted, "success");
        } catch (error: any) {
            console.error('[FragmentDetail] Generation failed:', error);
            showToast(error.message || t.errors.videoGenFailed, "error");
        } finally {
            setGenerating(false);
        }
    };

    const handleDeleteVideo = async () => {
        if (!videoToDelete) return;
        
        try {
             // Only remove association, do not delete file
             const updatedVideos = (asset.videos || []).filter(v => v.id !== videoToDelete.id);
             const updatedAsset = { ...asset, videos: updatedVideos };
             onUpdate(updatedAsset);
             
             setDeleteModalOpen(false);
             setVideoToDelete(null);
             showToast(t.common.deleteSuccess, "success");
        } catch (e) {
             showToast(t.errors.deleteFailed, "error");
        }
    };

    const handleSyncParams = (video: GeneratedVideo) => {
        if (!video.params) return;
        
        // Sync params from video to state
        if (video.params.model) setModelId(video.params.model);
        if (video.params.userPrompt) setPrompt(video.params.userPrompt);
        if (video.params.duration) setDuration(video.params.duration);
        if (video.params.ratio) setRatio(video.params.ratio);
        
        const extra = video.params.extraParams || {};
        if (extra.generationType) setGenerationType(extra.generationType);
        if (extra.characters) setSelectedCharacters(extra.characters);
        if (extra.items) setSelectedItems(extra.items);
        if (extra.effects) setSelectedEffects(extra.effects);
        if (extra.refs) setSelectedRefs(extra.refs);
        if (extra.scene) setSelectedScene(extra.scene);
        
        if (extra.resolution) setResolution(extra.resolution);
        if (extra.off_peak !== undefined) setOffPeak(extra.off_peak);
        
        if (video.params.startImage) setStartImage(video.params.startImage);
        if (video.params.endImage) setEndImage(video.params.endImage);
    };

    const handleSyncConfirm = () => {
        if (videoToSync) {
            handleSyncParams(videoToSync);
            setSyncModalOpen(false);
            setVideoToSync(null);
        }
    };

    const openImageGenModal = (target: 'start' | 'end') => {
        setImgGenTarget(target);
        setImgGenPrompt('');
        setImgGenReferenceImages([]);
        setImgGenGuidanceScale(2.5);
        setImgGenModalOpen(true);
    };

    const handleImageGenerate = async () => {
        if (!imgGenPrompt.trim()) {
            showToast(t.project.alertFill, "error");
            return;
        }

        const imgModelConfig = settings.models.find(m => m.id === imgGenModelId);
        if (!imgModelConfig) return;

        setImgGenLoading(true);
        try {
            // 1. Collect all selected resources (Characters, Items, Scenes)
            const selectedResources = [
                ...selectedCharacters.map(id => ({ ...characters.find(c => c.id === id)!, _type: t.project.characters })),
                ...selectedItems.map(id => ({ ...items.find(i => i.id === id)!, _type: t.project.items })),
                ...(selectedScene ? [scenes.find(s => s.id === selectedScene)!].map(s => ({ ...s, _type: t.project.scene })) : [])
            ].filter(r => r && r.id); // Filter out undefined

            // 2. Determine Strategy based on Model Capabilities
            const supportsRefImg = imgModelConfig.capabilities?.supportsReferenceImage;
            const requiresImg = imgModelConfig.capabilities?.requiresImageInput;
            const maxRefs = imgModelConfig.capabilities?.maxReferenceImages || 1;
            const isVidu = imgModelConfig.provider === 'vidu' || imgModelConfig.id.toLowerCase().includes('vidu');

            let finalPrompt = imgGenPrompt;
            if (imgGenStyle) finalPrompt += ` ${imgGenStyle}`;

            const refImages: string[] = [];
            
            // Collect manual reference images first (from ImageGenerationPanel)
            if (imgGenReferenceImages.length > 0) {
                refImages.push(...imgGenReferenceImages);
            }

            // 3. Process Selected Resources
            if (supportsRefImg) {
                // Strategy: Add images to referenceImages list + Append description mapping to prompt
                let resourceDesc = "";
                
                // Vidu max images: Q2 (0-7), Q1 (1-7). Generally capped at 7 or model limit.
                const effectiveMaxRefs = isVidu ? 7 : maxRefs;

                for (let i = 0; i < selectedResources.length; i++) {
                    const res = selectedResources[i];
                    
                    // If we have room for more images, add it
                    if (refImages.length < effectiveMaxRefs && res.filePath) {
                        // Check File Size (10MB limit)
                        const file = await storageService.getFile(res.filePath);
                        if (file && file.size > 10 * 1024 * 1024) {
                            showToast(`${t.errors?.fileTooLarge || 'File too large'}: ${res.name} (>10MB)`, "error");
                            // We stop the whole process if a selected file is invalid, to avoid unexpected results
                            setImgGenLoading(false);
                            return;
                        }

                        if (file) {
                            refImages.push(res.filePath);
                            // 1-based index in prompt (Image 1, Image 2...)
                            const imgIndex = refImages.length; 
                            // Construct description: "图1是[Name]" or "Image 1 is [Name]"
                            // Using generic localization or defaults
                            const prefix = t.project.fragment?.imagePrefix || '图'; 
                            const isWord = t.project.fragment?.isWord || '是';
                            
                            resourceDesc += `\n${prefix}${imgIndex}${isWord}${res.name}`;
                            if (res.prompt) resourceDesc += `, ${res.prompt}`;
                        } else {
                             // File missing, fallback to text only for this resource
                             resourceDesc += `\n${res.name}: ${res.prompt || ''}`;
                        }
                    } else {
                        // No room for image or no file, append text description
                        resourceDesc += `\n${res.name}: ${res.prompt || ''}`;
                    }
                }

                if (resourceDesc) {
                    finalPrompt += `\n${resourceDesc}`;
                }

            } else {
                // Strategy: Text Only (Volcano 3.0 etc)
                // Append "Name: Description"
                const descriptions = selectedResources.map(r => `${r.name}: ${r.prompt || ''}`).join('\n');
                if (descriptions) {
                    finalPrompt += `\n${descriptions}`;
                }
            }

            // 4. Validate Constraints
            if (requiresImg && refImages.length === 0) {
                showToast(t.errors?.imageRequired || "Image input required for this model (min 1 image)", "error");
                setImgGenLoading(false);
                return;
            }

            // 5. Submit Job
            const jobs = aiService.createGenerationJobs(
                imgModelConfig,
                {
                    projectId,
                    prompt: finalPrompt,
                    userPrompt: imgGenPrompt,
                    assetName: `${asset.name}_${imgGenTarget}_frame`,
                    assetType: AssetType.VIDEO_SEGMENT, 
                    assetId: asset.id,
                    referenceImages: refImages.length > 0 ? refImages : undefined,
                    aspectRatio: imgGenAspectRatio,
                    resolution: imgGenResolution,
                    style: imgGenStyle,
                    guidanceScale: imgGenGuidanceScale,
                },
                imgGenCount
            );

            await jobQueue.addJobs(jobs);
            
            // Add to active jobs tracking
            setActiveJobIds(prev => {
                const newSet = new Set(prev);
                jobs.forEach(j => newSet.add(j.id));
                return newSet;
            });

            setGenerating(true);

            showToast(t.project.generationStarted, "success");
            setImgGenModalOpen(false);
            
        } catch (e: any) {
            console.error("Image generation error:", e);
            showToast(e.message || t.errors.imageGenFailed, "error");
        } finally {
            setImgGenLoading(false);
            setGenerating(false);
        }
    };

    // Validation
    const isFormValid = !!modelId && !!prompt.trim() && (
        generationType !== 'first_last_frame' || !!startImage
    );

    return (
        <div className="flex h-full w-full gap-4 p-4">
            {/* Left: Configuration Form */}
            <Card className="w-1/3 min-w-[350px] h-full flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                    <h3 className="text-lg font-bold">{t.project.fragment.configuration}</h3>
                    
                    {/* 0. Name */}
                    <div className="flex flex-col gap-2">
                        <label className="text-slate-300 font-bold text-base ml-1">{t.project.videoName}</label>
                        <Input 
                            placeholder={t.project.videoName}
                            value={videoName}
                            variant="bordered"
                            radius="lg"
                            aria-label={t.project.videoName}
                            onValueChange={setVideoName}
                            classNames={{ 
                                input: "font-bold text-sm",
                                inputWrapper: "border-2 group-data-[focus=true]:border-primary"
                            }}
                        />
                    </div>

                    {/* 1. Model Selection */}
                    <div className="flex flex-col gap-2">
                        <label className="text-slate-300 font-bold text-base ml-1">{t.project.modelLabel}</label>
                        <Select 
                            placeholder={t.project.modelLabel} 
                            selectedKeys={[modelId]} 
                            onChange={(e) => setModelId(e.target.value)}
                            className="w-full"
                            variant="bordered"
                            radius="lg"
                            aria-label={t.project.modelLabel}
                            classNames={{ 
                                value: "font-bold text-sm",
                                trigger: "border-2 data-[focus=true]:border-primary"
                            }}
                        >
                            {allVideoModels.map((model) => (
                                <SelectItem key={model.id} value={model.id} textValue={model.name}>
                                    {model.name}
                                </SelectItem>
                            ))}
                        </Select>
                    </div>

                    {/* 2. Generation Type */}
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-semibold">{t.project.fragment.generationType}</span>
                        <Tabs 
                            selectedKey={generationType} 
                            onSelectionChange={(k) => setGenerationType(k as any)}
                            disabledKeys={['text_to_video', 'first_last_frame', 'multi_ref'].filter(type => !isTypeSupported(type))}
                        >
                            <Tab key="text_to_video" title={t.project.fragment.typeTextToVideo} />
                            <Tab key="first_last_frame" title={t.project.fragment.typeFirstLast} />
                            <Tab key="multi_ref" title={t.project.fragment.typeMultiRef} />
                        </Tabs>
                    </div>

                    {/* 3. Resource Selection */}
                    <div className="flex flex-col gap-3 border-y py-4 border-slate-200 dark:border-slate-800">
                        <span className="text-sm font-semibold">{t.project.fragment.resources}</span>
                        
                        {/* @ts-ignore - HeroUI Accordion type mismatch */}
                        <Accordion selectionMode="multiple" defaultExpandedKeys={["characters"]} motionProps={{}}>
                            {/* Characters */}
                            <AccordionItem key="characters" title={t.project.character} subtitle={`${selectedCharacters.length}/7`}>
                                <div className="grid grid-cols-3 gap-2">
                                    {characters.map(c => {
                                        const isSelected = selectedCharacters.includes(c.id);
                                        return (
                                        <div 
                                            key={c.id} 
                                            className={`relative group cursor-pointer border rounded-lg overflow-hidden transition-all ${isSelected ? 'border-success ring-2 ring-success ring-offset-1' : 'border-default-200 hover:border-default-400'}`}
                                            onClick={() => {
                                                const newSet = new Set(selectedCharacters);
                                                if (newSet.has(c.id)) newSet.delete(c.id);
                                                else if (newSet.size < 7) newSet.add(c.id); 
                                                setSelectedCharacters(Array.from(newSet));
                                            }}
                                        >
                                            <div className="aspect-square w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                                {c.filePath && urlCache[c.filePath] ? (
                                                    <Image src={urlCache[c.filePath]} removeWrapper className="w-full h-full object-contain" radius="none" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={20}/></div>
                                                )}
                                            </div>
                                            <div className="p-1 text-[10px] font-bold text-center truncate bg-white/90 dark:bg-black/90 absolute bottom-0 w-full backdrop-blur-sm z-10">
                                                {c.name}
                                            </div>
                                            {isSelected && (
                                                <div className="absolute top-1 left-1 text-success bg-white rounded-full z-20 shadow-sm">
                                                    <CheckCircle2 size={16} className="text-success fill-white"/>
                                                </div>
                                            )}
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                 <Button isIconOnly size="sm" variant="flat" aria-label={t.common?.preview || "Preview"} className="h-6 w-6 min-w-0 bg-black/50 text-white" onClick={(e: any) => {
                                                     e.stopPropagation(); 
                                                     if(c.filePath && urlCache[c.filePath]) openPreview([{ src: urlCache[c.filePath] }]);
                                                 }}>
                                                     <Eye size={12} />
                                                 </Button>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </AccordionItem>

                            {/* Items */}
                            <AccordionItem key="items" title={t.project.item} subtitle={`${selectedItems.length}/5`}>
                                <div className="grid grid-cols-3 gap-2">
                                    {items.map(i => {
                                        const isSelected = selectedItems.includes(i.id);
                                        return (
                                        <div 
                                            key={i.id} 
                                            className={`relative group cursor-pointer border rounded-lg overflow-hidden transition-all ${isSelected ? 'border-success ring-2 ring-success ring-offset-1' : 'border-default-200 hover:border-default-400'}`}
                                            onClick={() => {
                                                const newSet = new Set(selectedItems);
                                                if (newSet.has(i.id)) newSet.delete(i.id);
                                                else if (newSet.size < 5) newSet.add(i.id);
                                                setSelectedItems(Array.from(newSet));
                                            }}
                                        >
                                            <div className="aspect-square w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                                {i.filePath && urlCache[i.filePath] ? (
                                                    <Image src={urlCache[i.filePath]} removeWrapper className="w-full h-full object-contain" radius="none" />
                                                ) : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={20}/></div>}
                                            </div>
                                            <div className="p-1 text-[10px] font-bold text-center truncate bg-white/90 dark:bg-black/90 absolute bottom-0 w-full backdrop-blur-sm z-10">
                                                {i.name}
                                            </div>
                                            {isSelected && (
                                                <div className="absolute top-1 left-1 text-success bg-white rounded-full z-20 shadow-sm">
                                                    <CheckCircle2 size={16} className="text-success fill-white"/>
                                                </div>
                                            )}
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                 <Button isIconOnly size="sm" variant="flat" aria-label={t.common?.preview || "Preview"} className="h-6 w-6 min-w-0 bg-black/50 text-white" onClick={(e: any) => {
                                                     e.stopPropagation(); 
                                                     if(i.filePath && urlCache[i.filePath]) openPreview([{ src: urlCache[i.filePath] }]);
                                                 }}>
                                                     <Eye size={12} />
                                                 </Button>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </AccordionItem>

                            {/* Scene */}
                            <AccordionItem key="scenes" title={t.project.scene} subtitle={selectedScene ? "1/1" : "0/1"}>
                                <div className="grid grid-cols-3 gap-2">
                                    {scenes.map(s => {
                                        const isSelected = selectedScene === s.id;
                                        return (
                                        <div 
                                            key={s.id} 
                                            className={`relative group cursor-pointer border rounded-lg overflow-hidden transition-all ${isSelected ? 'border-success ring-2 ring-success ring-offset-1' : 'border-default-200 hover:border-default-400'}`}
                                            onClick={() => setSelectedScene(isSelected ? '' : s.id)}
                                        >
                                            <div className="aspect-square w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                                {s.filePath && urlCache[s.filePath] ? (
                                                    <Image src={urlCache[s.filePath]} removeWrapper className="w-full h-full object-contain" radius="none" />
                                                ) : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={20}/></div>}
                                            </div>
                                            <div className="p-1 text-[10px] font-bold text-center truncate bg-white/90 dark:bg-black/90 absolute bottom-0 w-full backdrop-blur-sm z-10">
                                                {s.name}
                                            </div>
                                            {isSelected && (
                                                <div className="absolute top-1 left-1 text-success bg-white rounded-full z-20 shadow-sm">
                                                    <CheckCircle2 size={16} className="text-success fill-white"/>
                                                </div>
                                            )}
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                 <Button isIconOnly size="sm" variant="flat" aria-label={t.common?.preview || "Preview"} className="h-6 w-6 min-w-0 bg-black/50 text-white" onClick={(e: any) => {
                                                     e.stopPropagation(); 
                                                     if(s.filePath && urlCache[s.filePath]) openPreview([{ src: urlCache[s.filePath] }]);
                                                 }}>
                                                     <Eye size={12} />
                                                 </Button>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </AccordionItem>

                            {/* Effects */}
                            <AccordionItem key="effects" title={t.project.fragment.effects} subtitle={`${selectedEffects.length}/2`}>
                                <div className="grid grid-cols-3 gap-2">
                                    {effects.map(e => {
                                        const isSelected = selectedEffects.includes(e.id);
                                        return (
                                        <div 
                                            key={e.id} 
                                            className={`relative group cursor-pointer border rounded-lg overflow-hidden transition-all ${isSelected ? 'border-success ring-2 ring-success ring-offset-1' : 'border-default-200 hover:border-default-400'}`}
                                            onClick={() => {
                                                const newSet = new Set(selectedEffects);
                                                if (newSet.has(e.id)) newSet.delete(e.id);
                                                else if (newSet.size < 2) newSet.add(e.id);
                                                setSelectedEffects(Array.from(newSet));
                                            }}
                                        >
                                            <div className="aspect-square w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                                {e.filePath && urlCache[e.filePath] ? (
                                                    <Image src={urlCache[e.filePath]} removeWrapper className="w-full h-full object-contain" radius="none" />
                                                ) : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={20}/></div>}
                                            </div>
                                            <div className="p-1 text-[10px] font-bold text-center truncate bg-white/90 dark:bg-black/90 absolute bottom-0 w-full backdrop-blur-sm z-10">
                                                {e.name}
                                            </div>
                                            {isSelected && (
                                                <div className="absolute top-1 left-1 text-success bg-white rounded-full z-20 shadow-sm">
                                                    <CheckCircle2 size={16} className="text-success fill-white"/>
                                                </div>
                                            )}
                                             <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                 <Button isIconOnly size="sm" variant="flat" aria-label={t.common?.preview || "Preview"} className="h-6 w-6 min-w-0 bg-black/50 text-white" onClick={(ev) => {
                                                     ev.stopPropagation(); 
                                                     if(e.filePath && urlCache[e.filePath]) openPreview([{ src: urlCache[e.filePath] }]);
                                                 }}>
                                                     <Eye size={12} />
                                                 </Button>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </AccordionItem>

                            {/* Refs */}
                            <AccordionItem key="refs" title={t.project.itemTypes.reference} subtitle={`${selectedRefs.length}/2`}>
                                <div className="grid grid-cols-3 gap-2">
                                    {refs.map(r => {
                                        const isSelected = selectedRefs.includes(r.id);
                                        return (
                                        <div 
                                            key={r.id} 
                                            className={`relative group cursor-pointer border rounded-lg overflow-hidden transition-all ${isSelected ? 'border-success ring-2 ring-success ring-offset-1' : 'border-default-200 hover:border-default-400'}`}
                                            onClick={() => {
                                                const newSet = new Set(selectedRefs);
                                                if (newSet.has(r.id)) newSet.delete(r.id);
                                                else if (newSet.size < 2) newSet.add(r.id);
                                                setSelectedRefs(Array.from(newSet));
                                            }}
                                        >
                                            <div className="aspect-square w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                                                {r.filePath && urlCache[r.filePath] ? (
                                                    <Image src={urlCache[r.filePath]} removeWrapper className="w-full h-full object-contain" radius="none" />
                                                ) : <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={20}/></div>}
                                            </div>
                                            <div className="p-1 text-[10px] font-bold text-center truncate bg-white/90 dark:bg-black/90 absolute bottom-0 w-full backdrop-blur-sm z-10">
                                                {r.name}
                                            </div>
                                            {isSelected && (
                                                <div className="absolute top-1 left-1 text-success bg-white rounded-full z-20 shadow-sm">
                                                    <CheckCircle2 size={16} className="text-success fill-white"/>
                                                </div>
                                            )}
                                             <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                 <Button isIconOnly size="sm" variant="flat" aria-label={t.common?.preview || "Preview"} className="h-6 w-6 min-w-0 bg-black/50 text-white" onClick={(e) => {
                                                     e.stopPropagation(); 
                                                     if(r.filePath && urlCache[r.filePath]) openPreview([{ src: urlCache[r.filePath] }]);
                                                 }}>
                                                     <Eye size={12} />
                                                 </Button>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </AccordionItem>
                        </Accordion>
                    </div>

                    {/* 4. First/Last Frame Inputs (Conditional) */}
                    {generationType === 'first_last_frame' && (
                        <div className="flex gap-2">
                            {/* Start Frame - Always Visible */}
                            <div className="w-1/2 flex flex-col gap-2">
                                <span className="text-xs font-bold block">{t.project.fragment.startImage}</span>
                                <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center relative group overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700">
                                    {startImage ? (
                                        urlCache[startImage] ? (
                                            <>
                                                <Image 
                                                     src={urlCache[startImage]} 
                                                     radius="none"
                                                     className="w-full h-full object-contain bg-black/50"
                                                     classNames={{
                                                         wrapper: "w-full h-full flex items-center justify-center",
                                                         img: "w-full h-full object-contain"
                                                     }}
                                                 />
                                                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <Button isIconOnly size="sm" variant="flat" aria-label={t.common?.preview || "Preview"} className="h-6 w-6 min-w-0 bg-black/50 text-white rounded-full" onPress={() => {
                                                        if(urlCache[startImage]) openPreview([{ src: urlCache[startImage] }]);
                                                    }}>
                                                        <Eye size={12} />
                                                    </Button>
                                                    <Button isIconOnly size="sm" variant="flat" aria-label={t.common?.clear || "Clear"} className="h-6 w-6 min-w-0 bg-danger/80 text-white rounded-full" onPress={() => {
                                                        setStartImage('');
                                                    }}>
                                                        <X size={12} />
                                                    </Button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center w-full h-full text-slate-400">
                                                <AlertTriangle size={20} className="mb-1 text-warning" />
                                                <span className="text-[10px]">{t.errors?.fileNotFound}</span>
                                                <button 
                                                    className="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white cursor-pointer hover:bg-black/70 transition-colors" 
                                                    onClick={(e) => { e.stopPropagation(); setStartImage(''); }}
                                                    aria-label={t.common?.clear || "Clear"}
                                                    type="button"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        )
                                    ) : (
                                        <div className="flex flex-col gap-2 p-2 w-full">
                                            <Button size="sm" color="primary" variant="flat" onPress={() => openImageGenModal('start')}>
                                                {t.project.fragment.generateStartImage}
                                            </Button>
                                            <Button size="sm" variant="bordered" onPress={() => { setPickerTarget('start'); setPickerOpen(true); }}>
                                                {t.project.fragment.selectFromLibrary}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* End Frame - Based on model capabilities */}
                            {modelConfig?.capabilities?.supportsEndFrame && (
                                <div className="w-1/2 flex flex-col gap-2">
                                    <span className="text-xs font-bold block">{t.project.fragment.endImage}</span>
                                    <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center relative group overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700">
                                        {endImage ? (
                                            urlCache[endImage] ? (
                                                <>
                                                    <Image 
                                                         src={urlCache[endImage]} 
                                                         radius="none"
                                                         className="w-full h-full object-contain bg-black/50"
                                                         classNames={{
                                                             wrapper: "w-full h-full flex items-center justify-center",
                                                             img: "w-full h-full object-contain"
                                                         }}
                                                     />
                                                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                        <Button isIconOnly size="sm" variant="flat" aria-label={t.common?.preview || "Preview"} className="h-6 w-6 min-w-0 bg-black/50 text-white rounded-full" onPress={() => {
                                                            if(urlCache[endImage]) openPreview([{ src: urlCache[endImage] }]);
                                                        }}>
                                                            <Eye size={12} />
                                                        </Button>
                                                        <Button isIconOnly size="sm" variant="flat" aria-label={t.common?.clear || "Clear"} className="h-6 w-6 min-w-0 bg-danger/80 text-white rounded-full" onPress={() => {
                                                            setEndImage('');
                                                        }}>
                                                            <X size={12} />
                                                        </Button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center w-full h-full text-slate-400">
                                                    <AlertTriangle size={20} className="mb-1 text-warning" />
                                                    <span className="text-[10px]">{t.errors?.fileNotFound}</span>
                                                    <button 
                                                        className="absolute top-1 right-1 bg-black/50 rounded-full p-1 text-white cursor-pointer hover:bg-black/70 transition-colors" 
                                                        onClick={(e) => { e.stopPropagation(); setEndImage(''); }}
                                                        aria-label={t.common?.clear || "Clear"}
                                                        type="button"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            )
                                        ) : (
                                            <div className="flex flex-col gap-2 p-2 w-full">
                                                <Button size="sm" color="primary" variant="flat" onPress={() => openImageGenModal('end')}>
                                                    {t.project.fragment.generateEndImage}
                                                </Button>
                                                <Button size="sm" variant="bordered" onPress={() => { setPickerTarget('end'); setPickerOpen(true); }}>
                                                    {t.project.fragment.selectFromLibrary}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 5. Prompt */}
                    <div className="flex flex-col gap-2">
                        <label className="text-slate-300 font-bold text-base ml-1">{t.common.prompt}</label>
                        <Textarea 
                            value={prompt} 
                            onValueChange={setPrompt}
                            placeholder={t.project.fragment.videoPromptPlaceholder}
                            minRows={3}
                            variant="bordered"
                            radius="lg"
                            aria-label={t.common.prompt}
                            classNames={{ 
                                input: "font-bold text-sm",
                                inputWrapper: "border-2 group-data-[focus=true]:border-primary"
                            }}
                        />
                    </div>

                    {/* Style Selection */}
                    <StyleSelector 
                        value={style}
                        onChange={setStyle}
                    />

                    <div className="flex flex-col gap-2">
                        <label className="text-slate-300 font-bold text-base ml-1">
                            {t.aiParams.modelParams}
                        </label>
                        
                        <DynamicModelParameters 
                            modelConfig={modelConfig}
                            values={{
                                [UNIFIED_KEYS.DURATION]: duration,
                                [UNIFIED_KEYS.ASPECT_RATIO]: ratio,
                                [UNIFIED_KEYS.RESOLUTION]: resolution,
                                [UNIFIED_KEYS.OFF_PEAK]: offPeak,
                                [UNIFIED_KEYS.COUNT]: generateCount,
                                [UNIFIED_KEYS.STYLE]: style,
                                ...extraParams
                            }}
                            onChange={handleParamChange}
                            disabled={generating}
                        />
                    </div>
                </div>

                {/* Fixed Footer for Generate Button */}
                <div className="p-4 border-t bg-slate-50 dark:bg-slate-900/50">
                    <Button 
                        color="primary" 
                        className="w-full font-bold"
                        size="lg"
                        isLoading={generating}
                        isDisabled={!isFormValid}
                        startContent={!generating && <Film size={20} />}
                        onPress={handleGenerate}
                    >
                        {generating ? t.common.generating : t.project.fragment.submit}
                    </Button>
                </div>
            </Card>

            {/* Right: Result List */}
            <div className="flex-1 h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">{t.project.fragment.results} ({asset.videos?.length || 0})</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {/* Active Jobs Placeholders */}
                     {Array.from(activeJobIds).map(jobId => (
                        <Card key={jobId} className="aspect-video flex items-center justify-center bg-slate-200 dark:bg-slate-800 animate-pulse relative">
                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                <Loader2 className="animate-spin" />
                                <span className="text-xs">{t.common.generating}</span>
                            </div>
                            <div className="absolute bottom-0 left-0 w-full p-2 bg-black/40 text-white">
                                <p className="text-[10px] font-bold truncate">{jobNames[jobId] || asset.videoName || asset.name}</p>
                            </div>
                        </Card>
                    ))}

                    {/* Content */}
                    {asset.videos?.slice().reverse().map((video: GeneratedVideo) => (
                        <Card 
                            key={video.id} 
                            isPressable={false}
                            className="relative group aspect-video bg-black overflow-hidden border-2 border-transparent hover:border-primary/50 transition-colors cursor-pointer"
                            onClick={() => handleSyncParams(video)}
                        >
                            {video.path ? (
                                urlCache[video.path] ? (
                                    <video 
                                        src={urlCache[video.path]} 
                                        className="w-full h-full object-contain cursor-pointer"
                                        onClick={(e) => {
                                            // Sync when clicking play/pause is acceptable as it selects the video
                                            const v = e.currentTarget;
                                            if (v.paused) {
                                                v.play();
                                            } else {
                                                v.pause();
                                            }
                                        }}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center w-full h-full text-slate-500 bg-slate-900/50">
                                        <AlertTriangle size={24} className="mb-2 text-warning" />
                                        <span className="text-[10px]">{t.errors?.fileNotFound}</span>
                                    </div>
                                )
                            ) : (
                                <div className="flex items-center justify-center w-full h-full text-white">
                                    <span className="text-xs">{t.jobs.processing}</span>
                                </div>
                            )}
                            
                            {/* Overlay Top: Buttons */}
                            <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                    isIconOnly 
                                    size="sm" 
                                    variant="solid" 
                                    aria-label={t.common?.preview || "Preview"}
                                    className="bg-black/60 text-white backdrop-blur-md" 
                                    onPress={() => {
                                        const url = urlCache[video.path || ''];
                                        if (url) {
                                            openPreview([{
                                                type: 'video',
                                                width: video.width || 1280,
                                                height: video.height || 720,
                                                sources: [
                                                    {
                                                        src: url,
                                                        type: 'video/mp4',
                                                    },
                                                ],
                                            }] as any);
                                        } else {
                                            showToast(t.errors?.fileNotFound, "error");
                                        }
                                    }}
                                >
                                    <Eye size={14} />
                                </Button>
                                <Button 
                                    isIconOnly 
                                    size="sm" 
                                    variant="solid" 
                                    color="danger" 
                                    aria-label={t.common?.delete || "Delete"}
                                    className="bg-danger/80 text-white backdrop-blur-md" 
                                    onPress={() => { setVideoToDelete(video); setDeleteModalOpen(true); }}
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </div>

                            {/* Overlay Bottom: Info */}
                            {!activeJobIds.has(video.id) && (
                                <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/90 to-transparent text-white">
                                    <p className="text-xs font-bold truncate">{video.name || video.params?.assetName || asset.videoName || asset.name}</p>
                                    <div className="flex justify-between items-center mt-0.5">
                                        <span className="text-[10px] opacity-70">
                                            {(() => {
                                                const d = new Date(video.createdAt);
                                                const year = d.getFullYear();
                                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                                const day = String(d.getDate()).padStart(2, '0');
                                                const hours = String(d.getHours()).padStart(2, '0');
                                                const minutes = String(d.getMinutes()).padStart(2, '0');
                                                const seconds = String(d.getSeconds()).padStart(2, '0');
                                                return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </Card>
                    ))}
                    {(!asset.videos || asset.videos.length === 0) && activeJobIds.size === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400 opacity-50">
                            <Film size={48} className="mb-4" />
                            <p>{t.project.fragment.noResults}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <ResourcePicker 
                isOpen={pickerOpen} 
                onClose={() => setPickerOpen(false)}
                projectId={projectId}
                accept="image/*"
                onSelect={(paths) => {
                    if (paths.length > 0) {
                        if (pickerTarget === 'start') setStartImage(paths[0]);
                        else setEndImage(paths[0]);
                    }
                    setPickerOpen(false);
                }}
            />

            <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{t.common.confirmDeleteTitle}</ModalHeader>
                            <ModalBody>
                                <p>{t.project.resourceManager.confirmDeleteDesc}</p>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>{t.common.cancel}</Button>
                                <Button color="danger" onPress={handleDeleteVideo}>{t.common.delete}</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={syncModalOpen} onClose={() => setSyncModalOpen(false)}>
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>{t.project.fragment.syncParamsTitle}</ModalHeader>
                            <ModalBody>
                                <p>{t.project.fragment.syncParamsDesc}</p>
                            </ModalBody>
                            <ModalFooter>
                                <Button variant="light" onPress={onClose}>{t.common.cancel}</Button>
                                <Button color="primary" onPress={handleSyncConfirm}>{t.project.fragment.syncAction}</Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>

            <Modal isOpen={imgGenModalOpen} onClose={() => setImgGenModalOpen(false)} size="2xl">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader>
                                 {imgGenTarget === 'start' ? t.project.fragment.generateStartImage : t.project.fragment.generateEndImage}
                             </ModalHeader>
                            <ModalBody>
                                <ImageGenerationPanel
                                    projectId={projectId}
                                    prompt={imgGenPrompt}
                                    onPromptChange={setImgGenPrompt}
                                    modelId={imgGenModelId}
                                    onModelChange={setImgGenModelId}
                                    referenceImages={imgGenReferenceImages}
                                    onReferenceImagesChange={setImgGenReferenceImages}
                                    aspectRatio={imgGenAspectRatio}
                                    onAspectRatioChange={setImgGenAspectRatio}
                                    resolution={imgGenResolution}
                                    onResolutionChange={setImgGenResolution}
                                    style={imgGenStyle}
                                    onStyleChange={setImgGenStyle}
                                    count={imgGenCount}
                                    onCountChange={setImgGenCount}
                                    guidanceScale={imgGenGuidanceScale}
                                    onGuidanceScaleChange={setImgGenGuidanceScale}
                                    generating={imgGenLoading}
                                    onGenerate={handleImageGenerate}
                                />
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
};

export default FragmentDetail;
