import React, { useState, useEffect, useRef } from 'react';
import { SceneAsset, GeneratedImage, AssetType, Job, JobStatus, SceneViewType } from '../../../types';
import { DEFAULT_MODELS } from '../../../config/models';
import { resolveModelConfig } from '../../../services/modelUtils';
import { storageService } from '../../../services/storage';
import { isVideoFile, getMimeType } from '../../../services/fileUtils';
import { useApp } from '../../../contexts/context';
import { useToast } from '../../../contexts/ToastContext';
import { jobQueue } from '../../../services/queue';
import { aiService } from '../../../services/aiService';
import { assetReuseService } from '../../../services/asset/AssetReuseService';
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
  Badge,
  Tabs,
  Tab,
  Slider,
  Chip,
} from '@heroui/react';
import { DeleteConfirmModal } from '../../Shared/DeleteConfirmModal';
import {
  Plus,
  X,
  Maximize2,
  Check,
  RefreshCw,
  Image as ImageIcon,
  Trash2,
  Upload,
  Eye,
  Wand2,
  Map,
  Layers,
  Camera,
  ZoomIn,
  Move,
  Info,
} from 'lucide-react';
import {
  getSceneImagePrompt,
  getDefaultStylePrompt,
  DefaultStylePrompt,
} from '../../../services/prompt';
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
  const [activeTab, setActiveTab] = useState<string>('single');
  const [generatingViews, setGeneratingViews] = useState<Set<SceneViewType>>(new Set());
  const [batchGenerating, setBatchGenerating] = useState(false);

  const [name, setName] = useState(asset.name);

  const [prompt, setPrompt] = useState(asset.prompt || '');
  const [referenceImages, setReferenceImages] = useState<string[]>(
    asset.metadata?.referenceImages || []
  );
  const [aspectRatio, setAspectRatio] = useState<string>(asset.metadata?.aspectRatio || '16:9');
  const [resolution, setResolution] = useState<string>(asset.metadata?.resolution || '2K');
  const [style, setStyle] = useState<string>('');
  const [generateCount, setGenerateCount] = useState<number>(1);
  const [guidanceScale, setGuidanceScale] = useState<number>(2.5);

  const [refUrls, setRefUrls] = useState<Record<string, string>>({});
  const [genUrls, setGenUrls] = useState<Record<string, string>>({});
  const [viewUrls, setViewUrls] = useState<Record<string, string>>({});

  const getInitialModelId = () => {
    const savedId = asset.metadata?.modelId;
    if (!savedId) return '';

    if (settings.models.some(m => m.id === savedId)) return savedId;

    const matched = settings.models.find(m => m.modelId === savedId);
    if (matched) return matched.id;

    return '';
  };

  const [modelId, setModelId] = useState(getInitialModelId());

  const runtimeModel =
    settings.models.find(m => m.id === modelId) ||
    settings.models.find(m => m.type === 'image') ||
    settings.models[0];

  const staticModel = resolveModelConfig(runtimeModel);

  const capabilities = {
    ...staticModel?.capabilities,
    ...runtimeModel?.capabilities,
    supportedResolutions: Array.from(
      new Set([
        ...(staticModel?.capabilities?.supportedResolutions || []),
        ...(runtimeModel?.capabilities?.supportedResolutions || []),
      ])
    ).filter(Boolean),
    minPixels: runtimeModel?.capabilities?.minPixels ?? staticModel?.capabilities?.minPixels,
    maxPixels: runtimeModel?.capabilities?.maxPixels ?? staticModel?.capabilities?.maxPixels,
    minAspectRatio:
      runtimeModel?.capabilities?.minAspectRatio ?? staticModel?.capabilities?.minAspectRatio,
    maxAspectRatio:
      runtimeModel?.capabilities?.maxAspectRatio ?? staticModel?.capabilities?.maxAspectRatio,
  };

  const availableResolutions = capabilities.supportedResolutions || ['2K', '4K'];

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

  useEffect(() => {
    if (generating || isCheckingJobs) return;

    let needsUpdate = false;
    let newRes = resolution;
    let newRatio = aspectRatio;

    if (!availableResolutions.includes(resolution)) {
      const defaultRes = capabilities.defaultResolution || availableResolutions[0];
      if (defaultRes) {
        newRes = defaultRes;
        needsUpdate = true;
      }
    }

    if (!availableAspectRatios.includes(aspectRatio)) {
      const defaultRatio = '16:9';
      if (availableAspectRatios.includes(defaultRatio)) {
        newRatio = defaultRatio;
        needsUpdate = true;
      } else if (availableAspectRatios.length > 0) {
        newRatio = availableAspectRatios[0];
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      console.log(
        `[SceneDetail] Auto-correcting params for model ${modelId}: Res ${resolution}->${newRes}, Ratio ${aspectRatio}->${newRatio}`
      );
      setResolution(newRes);
      setAspectRatio(newRatio);
      onUpdate({
        ...asset,
        metadata: {
          ...asset.metadata,
          resolution: newRes,
          aspectRatio: newRatio,
        },
      });
    }
  }, [modelId, capabilities, generating, isCheckingJobs]);

  const { isOpen: isPickerOpen, onOpen: onPickerOpen, onClose: onPickerClose } = useDisclosure();
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
      const newImages = asset.generatedImages.filter(i => i.id !== imageToDelete.id);

      const updated = {
        ...asset,
        generatedImages: newImages,
      };

      if (asset.currentImageId === imageToDelete.id) {
        updated.currentImageId = undefined;
        updated.filePath = undefined;
        if (newImages.length > 0) {
          const last = newImages[newImages.length - 1];
          updated.currentImageId = last.id;
          updated.filePath = last.path;

          if (last.metadata?.style) setStyle(last.metadata.style);
          if (last.metadata?.generateCount) setGenerateCount(last.metadata.generateCount);
        }
      }

      onUpdate(updated);
      showToast(t.common?.deleteSuccess || 'Image deleted', 'success');
    } catch (error) {
      console.error('Error deleting image:', error);
      showToast(t.errors?.unknownError || 'Failed to delete image', 'error');
    } finally {
      onDeleteClose();
      setImageToDelete(null);
    }
  };

  useEffect(() => {
    setGenerating(false);
    setName(asset.name);
    setPrompt(asset.prompt || '');

    let initialModelConfigId = asset.metadata?.modelConfigId || asset.metadata?.modelId;
    const imageModels = settings.models.filter(m => m.type === 'image' && (m.enabled ?? true));

    if (initialModelConfigId && !settings.models.some(m => m.id === initialModelConfigId)) {
      initialModelConfigId = imageModels[0]?.id || '';
    } else if (!initialModelConfigId) {
      initialModelConfigId = imageModels[0]?.id || '';
    }

    setModelId(initialModelConfigId);
    setReferenceImages(asset.metadata?.referenceImages || []);
    setAspectRatio(asset.metadata?.aspectRatio || '16:9');
    setResolution(asset.metadata?.resolution || '2K');
    setGuidanceScale(2.5);

    const checkActiveJob = async () => {
      setIsCheckingJobs(true);
      try {
        const jobs = await storageService.getJobs();
        const activeJobs = jobs.filter(
          j =>
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
        console.error('Error checking jobs:', e);
      } finally {
        setIsCheckingJobs(false);
      }
    };
    checkActiveJob();
  }, [asset.id, settings.models]);

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

  useEffect(() => {
    const unsub = jobQueue.subscribe(async job => {
      if (job.params.assetId === asset.id) {
        if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
          console.log(`[SceneDetail] Job ${job.id} finished with status: ${job.status}`);

          setActiveJobIds(prev => {
            if (!prev.has(job.id)) return prev;

            const newSet = new Set(prev);
            newSet.delete(job.id);

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
            try {
              const updatedAsset = (await storageService.getAsset(
                asset.id,
                projectId
              )) as SceneAsset;
              console.log(
                `[SceneDetail] Reloaded asset ${asset.id}. Generated images count: ${updatedAsset?.generatedImages?.length || 0}`
              );

              if (updatedAsset) {
                onUpdate(updatedAsset, true);

                if (updatedAsset.generatedImages && updatedAsset.generatedImages.length > 0) {
                  const latestImg =
                    updatedAsset.generatedImages[updatedAsset.generatedImages.length - 1];

                  setPrompt(latestImg.userPrompt || latestImg.prompt);
                  setReferenceImages(latestImg.referenceImages || []);
                  setAspectRatio(latestImg.metadata?.aspectRatio || '16:9');
                  setResolution(latestImg.metadata?.resolution || '2K');

                  if (latestImg.metadata?.style) setStyle(latestImg.metadata.style);
                  if (latestImg.metadata?.generateCount)
                    setGenerateCount(latestImg.metadata.generateCount);

                  if (
                    latestImg.modelConfigId &&
                    settings.models.some(m => m.id === latestImg.modelConfigId)
                  ) {
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
              console.error('Failed to reload asset after generation:', e);
            }
          } else if (job.status === JobStatus.FAILED) {
            showToast(job.error || t.errors.generationFailed, 'error');
          }
        }
      }
    });
    return () => unsub();
  }, [asset.id, settings.models]);

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

  useEffect(() => {
    const loadViewUrls = async () => {
      const urls: Record<string, string> = {};
      if (asset.views) {
        const views = [
          asset.views.panorama,
          asset.views.wide,
          ...(asset.views.detail || []),
          asset.views.aerial
        ];
        for (const view of views) {
          if (view?.path) {
            if (view.path.startsWith('remote:')) {
              urls[view.id] = view.path.substring(7);
            } else {
              urls[view.id] = await storageService.getAssetUrl(view.path);
            }
          }
        }
      }
      setViewUrls(urls);
    };
    loadViewUrls();
  }, [asset.views]);

  const handleSaveInfo = () => {
    if (name !== asset.name) {
      const updated = { ...asset, name };
      onUpdate(updated);
    }
  };

  const handleReferenceSelect = (paths: string[]) => {
    const newRefs = Array.from(new Set([...referenceImages, ...paths]));
    setReferenceImages(newRefs);
    const updated = {
      ...asset,
      metadata: {
        ...asset.metadata,
        referenceImages: newRefs,
        modelId,
      },
      prompt,
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
        referenceImages: newRefs,
      },
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
        modelId: val,
      },
    };
    onUpdate(updated);
  };

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

    const stylePrompt = getDefaultStylePrompt(style);
    const scenePrompt = getSceneImagePrompt(prompt);
    const finalPrompt = `${scenePrompt} ${stylePrompt}`;

    const updated = {
      ...asset,
      prompt,
      metadata: {
        ...asset.metadata,
        modelConfigId: modelId,
        referenceImages,
        aspectRatio,
        resolution,
      },
    };
    onUpdate(updated);

    try {
      console.log(
        `[SceneDetail] Submitting generation job for asset: ${asset.id} with count: ${generateCount}`
      );

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
          guidanceScale,
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

  const handleSelectImage = (img: GeneratedImage) => {
    if (asset.currentImageId === img.id) {
      const updated = { ...asset, currentImageId: undefined, filePath: undefined };
      onUpdate(updated);
    } else {
      setPrompt(img.userPrompt || img.prompt);

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
        filePath: img.path,
        prompt: img.userPrompt || img.prompt,
        metadata: {
          ...asset.metadata,
          modelId: targetModelId,
          referenceImages: img.referenceImages,
          aspectRatio: img.metadata?.aspectRatio || '16:9',
          resolution: img.metadata?.resolution || '2K',
        },
      };
      onUpdate(updated);
    }
  };

  const handleGenerateView = async (viewType: SceneViewType) => {
    if (!modelId) {
      showToast(t.project?.alertFill, 'warning');
      return;
    }

    setGeneratingViews(prev => new Set([...prev, viewType]));
    showToast(`开始生成${getViewLabel(viewType)}视图...`, 'info');

    try {
      const result = await assetReuseService.generateSceneView({
        scene: asset,
        viewType,
        modelConfigId: modelId,
        modelConfig: runtimeModel,
        projectId,
      });

      if (result.success && result.image) {
        const updatedAsset = (await storageService.getAsset(asset.id, projectId)) as SceneAsset;
        if (updatedAsset) {
          const newViews = await assetReuseService.updateSceneViews(
            updatedAsset,
            viewType,
            result.image
          );
          
          const updated = {
            ...updatedAsset,
            views: newViews,
            generatedImages: [
              ...(updatedAsset.generatedImages || []),
              result.image
            ]
          };
          
          onUpdate(updated);
          showToast(`${getViewLabel(viewType)}视图生成成功!`, 'success');
        }
      } else {
        showToast(result.error || '生成失败', 'error');
      }
    } catch (error: any) {
      console.error('[SceneDetail] Failed to generate view:', error);
      showToast(error.message || '生成失败', 'error');
    } finally {
      setGeneratingViews(prev => {
        const newSet = new Set(prev);
        newSet.delete(viewType);
        return newSet;
      });
    }
  };

  const handleDeleteView = (viewType: SceneViewType, index?: number) => {
    if (!asset.views) return;
    
    const newViews = { ...asset.views };
    
    if (viewType === 'detail' && index !== undefined && newViews.detail) {
      newViews.detail = newViews.detail.filter((_, i) => i !== index);
    } else {
      delete newViews[viewType];
    }
    
    const hasViews = Object.keys(newViews).some(key => {
      if (key === 'detail') return (newViews.detail?.length || 0) > 0;
      return newViews[key as keyof typeof newViews] !== undefined;
    });
    
    const updated = {
      ...asset,
      views: hasViews ? newViews : undefined
    };
    
    onUpdate(updated);
    showToast(`${getViewLabel(viewType)}视图已删除`, 'success');
  };

  const handleSetViewAsCurrent = (viewType: SceneViewType, index?: number) => {
    let viewImage: GeneratedImage | undefined;
    
    if (viewType === 'detail' && index !== undefined && asset.views?.detail) {
      viewImage = asset.views.detail[index];
    } else {
      viewImage = asset.views?.[viewType] as GeneratedImage | undefined;
    }
    
    if (!viewImage) return;
    
    const updated = {
      ...asset,
      currentImageId: viewImage.id,
      filePath: viewImage.path
    };
    
    onUpdate(updated);
    showToast(`已将${getViewLabel(viewType)}视图设为当前`, 'success');
  };

  const getViewLabel = (viewType: SceneViewType): string => {
    const labels: Record<SceneViewType, string> = {
      panorama: '全景',
      wide: '广角',
      detail: '细节',
      aerial: '鸟瞰'
    };
    return labels[viewType];
  };

  const getViewIcon = (viewType: SceneViewType) => {
    switch (viewType) {
      case 'panorama':
        return <Move className="w-5 h-5" />;
      case 'wide':
        return <Map className="w-5 h-5" />;
      case 'detail':
        return <ZoomIn className="w-5 h-5" />;
      case 'aerial':
        return <Camera className="w-5 h-5" />;
    }
  };

  const viewTypes: SceneViewType[] = ['panorama', 'wide', 'detail', 'aerial'];

  const calculateViewCount = (): number => {
    if (!asset.views) return 0;
    let count = 0;
    if (asset.views.panorama) count++;
    if (asset.views.wide) count++;
    count += (asset.views.detail?.length || 0);
    if (asset.views.aerial) count++;
    return count;
  };

  const handleBatchGenerateViews = async () => {
    if (!modelId) {
      showToast(t.project?.alertFill, 'warning');
      return;
    }

    const missingViews = viewTypes.filter(type => {
      if (type === 'detail') {
        return !asset.views?.detail || asset.views.detail.length === 0;
      }
      return !asset.views?.[type];
    });
    
    if (missingViews.length === 0) {
      showToast('所有视角都已生成', 'info');
      return;
    }

    setBatchGenerating(true);
    showToast(`开始批量生成 ${missingViews.length} 个视角...`, 'info');

    let successCount = 0;
    let failCount = 0;

    try {
      for (const viewType of missingViews) {
        setGeneratingViews(prev => new Set([...prev, viewType]));
        
        try {
          const result = await assetReuseService.generateSceneView({
            scene: asset,
            viewType,
            modelConfigId: modelId,
            modelConfig: runtimeModel,
            projectId,
          });

          if (result.success && result.image) {
            const updatedAsset = (await storageService.getAsset(asset.id, projectId)) as SceneAsset;
            if (updatedAsset) {
              const newViews = await assetReuseService.updateSceneViews(
                updatedAsset,
                viewType,
                result.image
              );
              
              const updated = {
                ...updatedAsset,
                views: newViews,
                generatedImages: [
                  ...(updatedAsset.generatedImages || []),
                  result.image
                ]
              };
              
              onUpdate(updated);
              successCount++;
            }
          } else {
            failCount++;
            console.error(`[SceneDetail] Failed to generate ${viewType} view:`, result.error);
          }
        } catch (error) {
          failCount++;
          console.error(`[SceneDetail] Error generating ${viewType} view:`, error);
        } finally {
          setGeneratingViews(prev => {
            const newSet = new Set(prev);
            newSet.delete(viewType);
            return newSet;
          });
        }
      }

      if (successCount > 0) {
        showToast(`批量生成完成！成功: ${successCount}, 失败: ${failCount}`, successCount === missingViews.length ? 'success' : 'warning');
      } else {
        showToast('批量生成失败', 'error');
      }
    } catch (error: any) {
      console.error('[SceneDetail] Batch generate views failed:', error);
      showToast(error.message || '批量生成失败', 'error');
    } finally {
      setBatchGenerating(false);
    }
  };

  return (
    <div className="h-full flex flex-row w-full overflow-hidden">
      {/* 左侧：基础信息、Tabs、生图参数设置，宽度约500px */}
      <div className="w-[500px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto p-4 border-r border-slate-200 dark:border-slate-800">
        {/* 基础信息卡片 */}
        <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <Map className="w-4 h-4 text-primary" />
            {t.project.basicInfo}
          </h3>
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-slate-700 dark:text-slate-300 font-bold text-sm">{t.project.nameLabel}</label>
              <Input
                placeholder={t.project.nameLabel}
                value={name}
                onValueChange={val => setName(val)}
                onBlur={handleSaveInfo}
                className="w-full"
                variant="bordered"
                radius="lg"
                isDisabled={generating || isCheckingJobs}
                classNames={{
                  input: 'font-bold text-sm',
                  inputWrapper: 'border-2 group-data-[focus=true]:border-primary',
                }}
              />
            </div>
          </div>
        </div>

        {/* Tabs和生图参数设置 */}
        <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm flex-1 flex flex-col">
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={key => setActiveTab(String(key))}
            className="w-full"
            classNames={{
              tabList: 'gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg',
              tab: 'data-[selected=true]:bg-white dark:data-[selected=true]:bg-slate-700 transition-colors duration-200',
              cursor: 'pointer'
            }}
          >
            <Tab 
              key="single" 
              title={
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">参考图生图</span>
                </div>
              }
            />
            <Tab 
              key="views" 
              title={
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  <span className="text-sm font-medium">多视角图生成</span>
                </div>
              }
            />
          </Tabs>

          <div className="flex-1 overflow-y-auto pt-4">
            {activeTab === 'single' && (
              <ImageGenerationPanel
                projectId={projectId}
                prompt={prompt}
                onPromptChange={handlePromptChange}
                onPromptBlur={handlePromptBlur}
                modelId={modelId}
                onModelChange={handleModelChange}
                referenceImages={referenceImages}
                onReferenceImagesChange={newRefs => {
                  setReferenceImages(newRefs);
                  onUpdate({
                    ...asset,
                    metadata: { ...asset.metadata, referenceImages: newRefs },
                  });
                }}
                aspectRatio={aspectRatio}
                onAspectRatioChange={val => {
                  setAspectRatio(val);
                  onUpdate({
                    ...asset,
                    metadata: { ...asset.metadata, aspectRatio: val },
                  });
                }}
                resolution={resolution}
                onResolutionChange={val => {
                  setResolution(val);
                  onUpdate({
                    ...asset,
                    metadata: { ...asset.metadata, resolution: val },
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
            )}

            {activeTab === 'views' && (
              <div className="flex flex-col gap-4">
                <Card className="p-4 border-2 border-primary/20 bg-primary/5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Info className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                        多视角图生成设置
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        您正在使用的模型将同时用于多视角图生成。请确保选择支持图生图的模型。
                      </p>
                    </div>
                  </div>
                </Card>

                <div className="flex flex-col gap-3">
                  <label className="text-slate-700 dark:text-slate-300 font-bold text-sm">
                    选择模型
                  </label>
                  <Select
                    aria-label="选择多视角图生成模型"
                    placeholder="选择模型"
                    selectedKeys={[modelId]}
                    onChange={e => handleModelChange(e.target.value)}
                    className="w-full"
                    variant="bordered"
                    radius="lg"
                    isDisabled={generating || isCheckingJobs}
                    classNames={{
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
                          <SelectItem key={model.id} textValue={model.name}>
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
                          </SelectItem>
                        );
                      })}
                  </Select>
                </div>

                <div className="pt-2">
                  <Button
                    fullWidth
                    color="primary"
                    size="md"
                    isLoading={batchGenerating}
                    isDisabled={!modelId || viewTypes.filter(type => {
                      if (type === 'detail') {
                        return !asset.views?.detail || asset.views.detail.length === 0;
                      }
                      return !asset.views?.[type];
                    }).length === 0}
                    className="cursor-pointer transition-colors duration-200"
                    onPress={handleBatchGenerateViews}
                    startContent={!batchGenerating && <Wand2 className="w-5 h-5" />}
                  >
                    {batchGenerating ? '批量生成中...' : '一键生成全部视角'}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  {viewTypes.map(viewType => {
                    const isDetail = viewType === 'detail';
                    const detailImages = isDetail ? (asset.views?.detail || []) : [];
                    const hasView = isDetail ? detailImages.length > 0 : !!asset.views?.[viewType];
                    const isGenerating = generatingViews.has(viewType);
                    
                    return (
                      <Card
                        key={viewType}
                        className="border border-slate-200 dark:border-slate-700 overflow-hidden"
                      >
                        <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                              {getViewIcon(viewType)}
                            </div>
                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                              {getViewLabel(viewType)}
                            </span>
                            {hasView && (
                              <Chip size="sm" color="success" variant="flat">
                                {isDetail ? `${detailImages.length}张` : '已生成'}
                              </Chip>
                            )}
                          </div>
                        </div>
                        <div className="p-3">
                          <Button
                            fullWidth
                            size="sm"
                            color={hasView ? 'secondary' : 'primary'}
                            variant={hasView ? 'flat' : 'solid'}
                            isLoading={isGenerating}
                            isDisabled={!modelId}
                            onPress={() => hasView ? (isDetail ? handleGenerateView(viewType) : handleSetViewAsCurrent(viewType)) : handleGenerateView(viewType)}
                            startContent={!isGenerating && (hasView ? (isDetail ? <Plus className="w-4 h-4" /> : <Check className="w-4 h-4" />) : <Wand2 className="w-4 h-4" />)}
                          >
                            {isGenerating ? '生成中...' : (hasView ? (isDetail ? '添加细节图' : '设为当前') : '生成视角')}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧：预览区和生成结果展示（弹性宽度） */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {activeTab === 'single' ? '生成结果' : '多视角图预览'}
          </h3>
          <div className="px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800/50 text-xs font-bold text-slate-600 dark:text-slate-300">
            {activeTab === 'single' 
              ? `图片 (${asset.generatedImages?.length || 0})`
              : `视图 (${calculateViewCount()}/4+)`
            }
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'single' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {asset.generatedImages
                ?.slice()
                .reverse()
                .map(img => {
                  const isSelected = asset.currentImageId === img.id;
                  const url =
                    genUrls[img.id] ||
                    (img.path.startsWith('remote:') ? img.path.substring(7) : undefined);

                  if (!url) return null;

                  return (
                    <div
                      key={img.id}
                      className="relative group cursor-pointer"
                      onClick={() => handleSelectImage(img)}
                    >
                      <Card
                        className={`aspect-[16/9] border-2 transition-all duration-200 ${isSelected ? 'border-primary shadow-xl scale-[1.02]' : 'border-transparent hover:border-primary/50 hover:shadow-lg'}`}
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
                          <div className="absolute top-2 left-2 z-20 bg-primary text-white rounded-full p-1.5 shadow-md ring-2 ring-white dark:ring-slate-900">
                            <Check className="w-3 h-3" />
                          </div>
                        )}

                        <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-2 translate-y-[-10px] group-hover:translate-y-0">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            aria-label="预览场景"
                            className="bg-black/60 text-white hover:bg-black/80 backdrop-blur-md rounded-full w-8 h-8 cursor-pointer transition-colors duration-200"
                            onClick={e => {
                              e.stopPropagation();
                              if (!asset.generatedImages) return;

                              const validItems = asset.generatedImages.filter(i => {
                                const u =
                                  genUrls[i.id] ||
                                  (i.path.startsWith('remote:') ? i.path.substring(7) : undefined);
                                return !!u;
                              });

                              const slides = validItems.map(i => {
                                const u =
                                  genUrls[i.id] ||
                                  (i.path.startsWith('remote:') ? i.path.substring(7) : '');
                                const isVideo = isVideoFile(i.path);
                                if (isVideo) {
                                  return {
                                    type: 'video' as const,
                                    sources: [{ src: u, type: getMimeType(i.path) }],
                                  };
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
                            aria-label="删除场景"
                            className="bg-red-500/80 text-white hover:bg-red-600 backdrop-blur-md rounded-full w-8 h-8 cursor-pointer transition-colors duration-200"
                            onClick={e => promptDeleteImage(img, e)}
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
                  <span className="uppercase tracking-widest text-xs font-black opacity-50">
                    {t.project?.noGenerations || 'No generations yet'}
                  </span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'views' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {viewTypes.map(viewType => {
                const isDetail = viewType === 'detail';
                
                if (isDetail) {
                  const detailImages = asset.views?.detail || [];
                  const isGenerating = generatingViews.has(viewType);
                  
                  return (
                    <Card
                      key={viewType}
                      className="border-2 border-content3 dark:border-content3 transition-all duration-200"
                      radius="lg"
                      shadow="sm"
                    >
                      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary">
                            {getViewIcon(viewType)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-foreground">
                              {getViewLabel(viewType)}视图
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {detailImages.length > 0 ? `${detailImages.length}张图片` : '待生成'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          {detailImages.map((img, index) => {
                            const url = viewUrls[img.id] || 
                              (img.path.startsWith('remote:') ? img.path.substring(7) : undefined);
                            const isCurrent = img.id === asset.currentImageId;

                            return (
                              <Card
                                key={img.id}
                                className={`aspect-[16/9] border-2 transition-all duration-200 cursor-pointer ${isCurrent ? 'border-primary' : 'border-transparent hover:border-primary/50'}`}
                                radius="lg"
                                shadow="sm"
                              >
                                {url ? (
                                  <div className="w-full h-full overflow-hidden">
                                    <img
                                      src={url}
                                      alt={`${getViewLabel(viewType)}视图 ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-950">
                                    <Spinner size="sm" />
                                  </div>
                                )}
                                {isCurrent && (
                                  <div className="absolute top-1 left-1 z-10 bg-primary text-white rounded-full p-1">
                                    <Check className="w-2 h-2" />
                                  </div>
                                )}
                                <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-1">
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    className="bg-black/60 text-white rounded-full w-6 h-6 min-w-6"
                                    onPress={() => handleSetViewAsCurrent(viewType, index)}
                                  >
                                    <Check className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="flat"
                                    className="bg-red-500/80 text-white rounded-full w-6 h-6 min-w-6"
                                    onPress={() => handleDeleteView(viewType, index)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                        
                        <Button
                          fullWidth
                          color="primary"
                          size="sm"
                          isLoading={isGenerating}
                          isDisabled={!modelId}
                          className="cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary"
                          onPress={() => handleGenerateView(viewType)}
                          startContent={!isGenerating && <Plus className="w-4 h-4" />}
                        >
                          {isGenerating ? '生成中...' : '添加细节图'}
                        </Button>
                      </div>
                    </Card>
                  );
                }

                const viewImage = asset.views?.[viewType] as GeneratedImage | undefined;
                const isGenerating = generatingViews.has(viewType);
                const isCurrent = viewImage?.id === asset.currentImageId;
                const url = viewImage ? (
                  viewUrls[viewImage.id] ||
                  (viewImage.path.startsWith('remote:') ? viewImage.path.substring(7) : undefined)
                ) : undefined;

                return (
                  <Card
                    key={viewType}
                    className={`border-2 transition-all duration-200 ${isCurrent ? 'border-primary shadow-xl' : 'border-content3 dark:border-content3'}`}
                    radius="lg"
                    shadow="sm"
                  >
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary">
                          {getViewIcon(viewType)}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-foreground">
                            {getViewLabel(viewType)}视图
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {viewImage ? '已生成' : '待生成'}
                          </p>
                        </div>
                      </div>
                      {isCurrent && (
                        <Chip color="primary" size="sm" variant="flat">
                          当前主图
                        </Chip>
                      )}
                    </div>

                    <div className="p-4">
                      <div className="aspect-video bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden mb-4">
                        {url ? (
                          <img
                            src={url}
                            alt={`${getViewLabel(viewType)}视图`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                            <Camera className="w-12 h-12 mb-2 opacity-50" />
                            <span className="text-sm">暂无视图</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {!viewImage ? (
                          <Button
                            fullWidth
                            color="primary"
                            size="sm"
                            isLoading={isGenerating}
                            isDisabled={!modelId}
                            className="cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary"
                            onPress={() => handleGenerateView(viewType)}
                            startContent={!isGenerating && <Wand2 className="w-4 h-4" />}
                          >
                            {isGenerating ? '生成中...' : '生成视图'}
                          </Button>
                        ) : (
                          <>
                            <Button
                              fullWidth
                              color="success"
                              size="sm"
                              isDisabled={isCurrent}
                              className="cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary"
                              onPress={() => handleSetViewAsCurrent(viewType)}
                              startContent={<Check className="w-4 h-4" />}
                            >
                              {isCurrent ? '已设为当前' : '设为当前'}
                            </Button>
                            <Button
                              isIconOnly
                              color="danger"
                              size="sm"
                              variant="flat"
                              className="cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary"
                              aria-label="删除视图"
                              onPress={() => handleDeleteView(viewType)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ResourcePicker
        isOpen={isPickerOpen}
        onClose={onPickerClose}
        onSelect={handleReferenceSelect}
        maxSelect={5}
        projectId={projectId}
        accept="image/*"
      />

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        onConfirm={confirmDeleteImage}
      />
    </div>
  );
};

export default SceneDetail;
