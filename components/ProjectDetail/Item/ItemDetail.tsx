import React, { useState, useEffect, useRef } from 'react';
import {
  ItemAsset,
  GeneratedImage,
  AssetType,
  Job,
  JobStatus,
  ItemType,
  ItemViewType,
} from '../../../types';
import { DEFAULT_MODELS } from '../../../config/models';
import { UNIFIED_KEYS, resolveModelConfig } from '../../../services/modelUtils';
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
  CardBody,
  Spinner,
  useDisclosure,
  Tabs,
  Tab,
  Chip,
  ScrollShadow,
  Switch,
} from '@heroui/react';
import { DeleteConfirmModal } from '../../Shared/DeleteConfirmModal';
import {
  Plus,
  X,
  Check,
  Image as ImageIcon,
  Trash2,
  Eye,
  Wand2,
  Box,
  Layers,
  Camera,
  ChevronLeft,
  ChevronRight,
  Settings,
  Palette,
  Sparkles,
  CheckCircle2,
  FileText,
  Music,
  Mic,
  Info,
} from 'lucide-react';
import { getItemImagePrompt, getDefaultStylePrompt } from '../../../services/prompt';
import ResourcePicker from '../../ResourcePicker';
import { usePreview } from '../../PreviewProvider';
import { ImageGenerationPanel } from '../Shared/ImageGenerationPanel';
import { StyleSelector } from '../Shared/StyleSelector';
import { CompactToolbar } from '../Character/CompactToolbar';

interface ItemDetailProps {
  asset: ItemAsset;
  onUpdate: (updatedAsset: ItemAsset, skipSave?: boolean) => void;
  projectId: string;
}

const ItemDetail: React.FC<ItemDetailProps> = ({ asset, onUpdate, projectId }) => {
  const { t, settings } = useApp();
  const { showToast } = useToast();
  const { openPreview } = usePreview();
  const [generating, setGenerating] = useState(false);
  const [isCheckingJobs, setIsCheckingJobs] = useState(true);
  const [activeJobIds, setActiveJobIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('single');
  const [activeParamTab, setActiveParamTab] = useState<string>('core');
  const [activeViewTab, setActiveViewTab] = useState<ItemViewType>('front');
  const [generatingViews, setGeneratingViews] = useState<Set<ItemViewType>>(new Set());
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState<boolean>(true);
  const [viewPrompt, setViewPrompt] = useState<string>('');
  const previewScrollRef = React.useRef<HTMLDivElement>(null);

  const [name, setName] = useState(asset.name);
  const [itemType, setItemType] = useState<ItemType>(asset.itemType || ItemType.PROP);

  const [prompt, setPrompt] = useState(asset.prompt || '');
  const [referenceImages, setReferenceImages] = useState<string[]>(
    asset.metadata?.referenceImages || []
  );
  const [aspectRatio, setAspectRatio] = useState<string>(asset.metadata?.aspectRatio || '1:1');
  const [resolution, setResolution] = useState<string>(asset.metadata?.resolution || '2K');
  const [style, setStyle] = useState<string>('');
  const [generateCount, setGenerateCount] = useState<number>(1);
  const [guidanceScale, setGuidanceScale] = useState<number>(2.5);
  const [extraParams, setExtraParams] = useState<Record<string, any>>({});

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
      const defaultRatio = '1:1';
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
        `[ItemDetail] Auto-correcting params for model ${modelId}: Res ${resolution}->${newRes}, Ratio ${aspectRatio}->${newRatio}`
      );
      setResolution(newRes);
      setAspectRatio(newRatio);
      onUpdate(
        {
          ...asset,
          metadata: {
            ...asset.metadata,
            resolution: newRes,
            aspectRatio: newRatio,
          },
        },
        true
      );
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

      onUpdate(updated, true);
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
    setItemType(asset.itemType || ItemType.PROP);
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
    setAspectRatio(asset.metadata?.aspectRatio || '1:1');

    const cachedRes = asset.metadata?.resolution;
    const safeResolution =
      cachedRes && availableResolutions.includes(cachedRes)
        ? cachedRes
        : capabilities.defaultResolution || availableResolutions[0];
    setResolution(safeResolution);

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
          console.log(`[ItemDetail] Found ${activeJobs.length} active jobs for asset ${asset.id}`);
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
          console.log(`[ItemDetail] Job ${job.id} finished with status: ${job.status}`);

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
              )) as ItemAsset;
              console.log(
                `[ItemDetail] Reloaded asset ${asset.id}. Generated images count: ${updatedAsset?.generatedImages?.length || 0}`
              );

              if (updatedAsset) {
                onUpdate(updatedAsset, true);

                if (updatedAsset.generatedImages && updatedAsset.generatedImages.length > 0) {
                  const latestImg =
                    updatedAsset.generatedImages[updatedAsset.generatedImages.length - 1];

                  setPrompt(latestImg.userPrompt || latestImg.prompt);
                  setReferenceImages(latestImg.referenceImages || []);
                  setAspectRatio(latestImg.metadata?.aspectRatio || '1:1');
                  setResolution(latestImg.metadata?.resolution || '2K');

                  if (latestImg.metadata?.style) setStyle(latestImg.metadata.style);
                  if (latestImg.metadata?.generateCount)
                    setGenerateCount(latestImg.metadata.generateCount);

                  let targetModelId = '';
                  if (
                    latestImg.modelConfigId &&
                    settings.models.some(m => m.id === latestImg.modelConfigId)
                  ) {
                    targetModelId = latestImg.modelConfigId;
                  } else {
                    targetModelId = latestImg.modelId;
                    if (!settings.models.some(m => m.id === targetModelId)) {
                      const matched = settings.models.find(m => m.modelId === targetModelId);
                      if (matched) targetModelId = matched.id;
                    }
                  }
                  setModelId(targetModelId);
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
          asset.views.front,
          asset.views.side,
          asset.views.top,
          asset.views.threeQuarter,
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

  useEffect(() => {
    if (activeTab === 'views' && !isBatchMode) {
      const savedPrompt = asset.viewPrompts?.[activeViewTab];
      if (savedPrompt) {
        setViewPrompt(savedPrompt);
      } else {
        setViewPrompt(getViewPrompt(activeViewTab));
      }
    }
  }, [activeViewTab, isBatchMode, activeTab]);

  useEffect(() => {
    if (activeTab !== 'views' || isBatchMode || !viewPrompt) return;

    const timer = setTimeout(() => {
      const currentSavedPrompt = asset.viewPrompts?.[activeViewTab];
      if (currentSavedPrompt !== viewPrompt) {
        const updatedViewPrompts = {
          ...asset.viewPrompts,
          [activeViewTab]: viewPrompt,
        };
        onUpdate(
          {
            ...asset,
            viewPrompts: updatedViewPrompts,
          },
          true
        );
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [viewPrompt, activeViewTab, activeTab, isBatchMode]);

  const handleSaveInfo = () => {
    if (name !== asset.name || itemType !== asset.itemType) {
      const updated = { ...asset, name, itemType };
      onUpdate(updated);
    }
  };

  const handleItemTypeChange = (val: string) => {
    const type = val as ItemType;
    setItemType(type);
    const updated = { ...asset, itemType: type };
    onUpdate(updated);
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
    onUpdate(updated, true);
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
    onUpdate(updated, true);
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
    const itemTypeLabel = t.project.itemTypes?.[itemType] || itemType;

    const itemPrompt = getItemImagePrompt(prompt, itemTypeLabel);
    const finalPrompt = `${itemPrompt} ${stylePrompt}`;

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
      const capabilities = model.capabilities || {};
      const maxBatchSize = capabilities.maxBatchSize || 4;
      console.log(
        `[ItemDetail] Submitting generation job for asset: ${asset.id} with count: ${generateCount}. MaxBatchSize: ${maxBatchSize}`
      );

      const isSeedEdit = model.modelId.includes('seededit');

      const jobsToCreate: { count: number }[] = [];
      let remaining = generateCount;
      while (remaining > 0) {
        const currentBatch = Math.min(remaining, maxBatchSize);
        jobsToCreate.push({ count: currentBatch });
        remaining -= currentBatch;
      }

      const newJobIds: string[] = [];

      for (const batch of jobsToCreate) {
        const job: any = {
          id: crypto.randomUUID(),
          projectId: projectId,
          type: 'generate_image',
          status: JobStatus.PENDING,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          params: {
            prompt: finalPrompt,
            userPrompt: prompt,
            model: modelId,
            modelConfigId: modelId,
            modelId: model.modelId,
            assetName: asset.name,
            assetType: AssetType.ITEM,
            assetId: asset.id,
            projectId: projectId,
            referenceImages: referenceImages,
            aspectRatio: aspectRatio,
            resolution: resolution,
            generateCount: batch.count,
            style: style,
            guidanceScale: isSeedEdit ? guidanceScale : undefined,
          },
        };

        await jobQueue.addJob(job);
        console.log(`[ItemDetail] Added job ${job.id} with count ${batch.count}`);
        newJobIds.push(job.id);
      }

      setActiveJobIds(prev => {
        const newSet = new Set(prev);
        newJobIds.forEach(id => newSet.add(id));
        return newSet;
      });
    } catch (error: any) {
      console.error('[ItemDetail] Failed to add job:', error);
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
      setAspectRatio(img.metadata?.aspectRatio || '1:1');
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
          aspectRatio: img.metadata?.aspectRatio || '1:1',
          resolution: img.metadata?.resolution || '2K',
        },
      };
      onUpdate(updated);
    }
  };

  const handleGenerateView = async (viewType: ItemViewType) => {
    if (!modelId) {
      showToast(t.project?.alertFill, 'warning');
      return;
    }

    setGeneratingViews(prev => new Set([...prev, viewType]));
    showToast(`开始生成${getViewLabel(viewType)}视图...`, 'info');

    try {
      const result = await assetReuseService.generateItemView({
        item: asset,
        viewType,
        modelConfigId: modelId,
        modelConfig: runtimeModel,
        projectId,
      });

      if (result.success && result.image) {
        const updatedAsset = (await storageService.getAsset(asset.id, projectId)) as ItemAsset;
        if (updatedAsset) {
          const newViews = await assetReuseService.updateItemViews(
            updatedAsset,
            viewType,
            result.image
          );

          const updated = {
            ...updatedAsset,
            views: newViews,
            generatedImages: [...(updatedAsset.generatedImages || []), result.image],
          };

          onUpdate(updated);
          showToast(`${getViewLabel(viewType)}视图生成成功!`, 'success');
        }
      } else {
        showToast(result.error || '生成失败', 'error');
      }
    } catch (error: any) {
      console.error('[ItemDetail] Failed to generate view:', error);
      showToast(error.message || '生成失败', 'error');
    } finally {
      setGeneratingViews(prev => {
        const newSet = new Set(prev);
        newSet.delete(viewType);
        return newSet;
      });
    }
  };

  const handleDeleteView = (viewType: ItemViewType) => {
    if (!asset.views) return;

    const newViews = { ...asset.views };
    delete newViews[viewType];

    const hasViews = Object.keys(newViews).some(
      key => newViews[key as keyof typeof newViews] !== undefined
    );

    const updated = {
      ...asset,
      views: hasViews ? newViews : undefined,
    };

    onUpdate(updated);
    showToast(`${getViewLabel(viewType)}视图已删除`, 'success');
  };

  const handleSetViewAsCurrent = (viewType: ItemViewType) => {
    const viewImage = asset.views?.[viewType];

    if (!viewImage) return;

    const updated = {
      ...asset,
      currentImageId: viewImage.id,
      filePath: viewImage.path,
    };

    onUpdate(updated);
    showToast(`已将${getViewLabel(viewType)}视图设为当前`, 'success');
  };

  const handleBatchGenerateViews = async () => {
    if (!modelId) {
      showToast(t.project?.alertFill, 'warning');
      return;
    }

    const missingViews = viewTypes.filter(type => !asset.views?.[type]);

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
          const result = await assetReuseService.generateItemView({
            item: asset,
            viewType,
            modelConfigId: modelId,
            modelConfig: runtimeModel,
            projectId,
          });

          if (result.success && result.image) {
            const updatedAsset = (await storageService.getAsset(asset.id, projectId)) as ItemAsset;
            if (updatedAsset) {
              const newViews = await assetReuseService.updateItemViews(
                updatedAsset,
                viewType,
                result.image
              );

              const updated = {
                ...updatedAsset,
                views: newViews,
                generatedImages: [...(updatedAsset.generatedImages || []), result.image],
              };

              onUpdate(updated);
              successCount++;
            }
          } else {
            failCount++;
            console.error(`[ItemDetail] Failed to generate ${viewType} view:`, result.error);
          }
        } catch (error) {
          failCount++;
          console.error(`[ItemDetail] Error generating ${viewType} view:`, error);
        } finally {
          setGeneratingViews(prev => {
            const newSet = new Set(prev);
            newSet.delete(viewType);
            return newSet;
          });
        }
      }

      if (successCount > 0) {
        showToast(
          `批量生成完成！成功: ${successCount}, 失败: ${failCount}`,
          successCount === missingViews.length ? 'success' : 'warning'
        );
      } else {
        showToast('批量生成失败', 'error');
      }
    } catch (error: any) {
      console.error('[ItemDetail] Batch generate views failed:', error);
      showToast(error.message || '批量生成失败', 'error');
    } finally {
      setBatchGenerating(false);
    }
  };

  const handleScrollLeft = () => {
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollBy({ left: -220, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollBy({ left: 220, behavior: 'smooth' });
    }
  };

  const handlePreviewImage = (img: GeneratedImage, allImages: GeneratedImage[]) => {
    const slides = allImages.map(image => ({
      src:
        genUrls[image.id] ||
        (image.path.startsWith('remote:') ? image.path.substring(7) : image.path),
      alt: image.prompt,
    }));
    const currentIndex = allImages.findIndex(i => i.id === img.id);
    openPreview(slides, currentIndex);
  };

  const getViewLabel = (viewType: ItemViewType): string => {
    const labels: Record<ItemViewType, string> = {
      front: '正面',
      side: '侧面',
      top: '顶面',
      'three-quarter': '四分之三',
    };
    return labels[viewType];
  };

  const getViewPrompt = (viewType: ItemViewType): string => {
    const viewPrompts: Record<ItemViewType, string> = {
      front: 'front view, facing camera directly, full view of the item',
      side: 'side view, profile view, full view from the side',
      top: "top view, bird's-eye view, looking down from above",
      'three-quarter': 'three-quarter view, 45 degree angle, showing front and side',
    };
    return viewPrompts[viewType];
  };

  const fullViewPrompt = React.useMemo(() => {
    const basePrompt = asset.prompt || '';
    const viewPromptValue = viewPrompt || getViewPrompt(activeViewTab) || '';
    const consistencyPrompt =
      'same item, consistent appearance, maintaining all shape, color, and material details';

    if (basePrompt) {
      return `${basePrompt}, ${viewPromptValue}, ${consistencyPrompt}`;
    }
    return `${viewPromptValue}, ${consistencyPrompt}`;
  }, [asset.prompt, viewPrompt, activeViewTab]);

  const getViewIcon = (viewType: ItemViewType) => {
    switch (viewType) {
      case 'front':
        return <Box className="w-5 h-5" />;
      case 'side':
        return <Layers className="w-5 h-5" />;
      case 'top':
        return <Camera className="w-5 h-5" />;
      case 'three-quarter':
        return <ImageIcon className="w-5 h-5" />;
    }
  };

  const viewTypes: ItemViewType[] = ['front', 'side', 'top', 'three-quarter'];

  const viewTabs = [
    { id: 'front' as ItemViewType, label: '正面' },
    { id: 'side' as ItemViewType, label: '侧面' },
    { id: 'top' as ItemViewType, label: '顶面' },
    { id: 'three-quarter' as ItemViewType, label: '四分之三' },
  ];

  const calculateViewCount = (): number => {
    if (!asset.views) return 0;
    let count = 0;
    if (asset.views.front) count++;
    if (asset.views.side) count++;
    if (asset.views.top) count++;
    if (asset.views.threeQuarter) count++;
    return count;
  };

  const currentAllImages =
    activeTab === 'single'
      ? asset.generatedImages || []
      : (() => {
          const viewImages: GeneratedImage[] = [];
          if (asset.views) {
            if (asset.views.front) viewImages.push(asset.views.front);
            if (asset.views.side) viewImages.push(asset.views.side);
            if (asset.views.top) viewImages.push(asset.views.top);
            if (asset.views.threeQuarter) viewImages.push(asset.views.threeQuarter);
          }
          return viewImages;
        })();
  const currentSelectedImage = asset.currentImageId
    ? (asset.generatedImages || []).find(img => img.id === asset.currentImageId)
    : null;

  const tabs = [
    { id: 'single', label: '单图', icon: Box },
    { id: 'views', label: '多视角', icon: Layers },
  ];

  return (
    <div className="h-full flex bg-background p-3 gap-3 overflow-hidden">
      {/* 左侧：物品信息和参数设置 */}
      <div className="w-[300px] bg-content1 border border-content3 rounded-xl flex flex-col overflow-hidden">
        <div className="p-3 border-b border-content3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Box className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-foreground truncate">{asset.name}</h3>
            </div>
          </div>

          <div className="flex gap-2">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-content2 text-zinc-500 hover:bg-content3'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'single' && (
          <Tabs
            selectedKey={activeParamTab}
            onSelectionChange={setActiveParamTab}
            size="sm"
            classNames={{
              tabList: 'gap-2 p-1.5',
              tab: 'h-8 min-h-8 px-4 text-xs',
              cursor: 'rounded-xl',
            }}
          >
            <Tab
              key="core"
              title={
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  <span>参数</span>
                </div>
              }
            >
              <div className="p-3 space-y-2">
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
                    onUpdate(
                      {
                        ...asset,
                        metadata: { ...asset.metadata, referenceImages: newRefs },
                      },
                      true
                    );
                  }}
                  aspectRatio={aspectRatio}
                  onAspectRatioChange={val => {
                    setAspectRatio(val);
                    onUpdate(
                      {
                        ...asset,
                        metadata: { ...asset.metadata, aspectRatio: val },
                      },
                      true
                    );
                  }}
                  resolution={resolution}
                  onResolutionChange={val => {
                    setResolution(val);
                    onUpdate(
                      {
                        ...asset,
                        metadata: { ...asset.metadata, resolution: val },
                      },
                      true
                    );
                  }}
                  style={style}
                  onStyleChange={setStyle}
                  count={generateCount}
                  onCountChange={setGenerateCount}
                  guidanceScale={guidanceScale}
                  onGuidanceScaleChange={setGuidanceScale}
                  generating={generating || isCheckingJobs}
                  onGenerate={handleGenerate}
                  showPrompt={false}
                  showStyle={false}
                  showGenerateButton={false}
                  compact={true}
                  showReferenceImages={false}
                />
              </div>
            </Tab>
            <Tab
              key="style"
              title={
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  <span>风格</span>
                </div>
              }
            >
              <div className="p-3">
                <StyleSelector value={style} onChange={setStyle} disabled={generating} />
              </div>
            </Tab>
          </Tabs>
        )}

        {activeTab === 'views' && (
          <>
            <Tabs
              selectedKey={activeParamTab}
              onSelectionChange={setActiveParamTab}
              size="sm"
              classNames={{
                tabList: 'gap-2 p-2',
                tab: 'h-8 min-h-8 px-4 text-xs',
                cursor: 'rounded-xl',
              }}
            >
              <Tab
                key="core"
                title={
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <span>参数</span>
                  </div>
                }
              >
                <div className="p-3 space-y-2">
                  <CompactToolbar
                    modelId={modelId}
                    onModelChange={handleModelChange}
                    aspectRatio={aspectRatio}
                    onAspectRatioChange={val => {
                      setAspectRatio(val);
                      onUpdate(
                        {
                          ...asset,
                          metadata: { ...asset.metadata, aspectRatio: val },
                        },
                        true
                      );
                    }}
                    resolution={resolution}
                    onResolutionChange={val => {
                      setResolution(val);
                      onUpdate(
                        {
                          ...asset,
                          metadata: { ...asset.metadata, resolution: val },
                        },
                        true
                      );
                    }}
                    count={generateCount}
                    onCountChange={setGenerateCount}
                    guidanceScale={guidanceScale}
                    onGuidanceScaleChange={setGuidanceScale}
                    extraParams={extraParams}
                    onExtraParamsChange={setExtraParams}
                    generating={generating || isCheckingJobs}
                  />
                </div>
              </Tab>
              <Tab
                key="style"
                title={
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    <span>风格</span>
                  </div>
                }
              >
                <div className="p-3">
                  <StyleSelector value={style} onChange={setStyle} disabled={generating} />
                </div>
              </Tab>
            </Tabs>
          </>
        )}

        <div className="mt-auto p-3 border-t border-content3 relative z-10">
          {activeTab === 'views' && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                批量模式
              </span>
              <Switch
                isSelected={isBatchMode}
                onValueChange={setIsBatchMode}
                size="sm"
                isDisabled={generating}
              />
            </div>
          )}
          <Button
            color="default"
            variant="solid"
            size="sm"
            fullWidth
            isLoading={activeTab === 'single' ? generating : batchGenerating}
            onPress={
              activeTab === 'single'
                ? handleGenerate
                : isBatchMode
                  ? handleBatchGenerateViews
                  : () => handleGenerateView(activeViewTab)
            }
            className="font-bold h-9 rounded-xl shadow-xl shadow-lime-500/30 hover:shadow-lime-500/50 transition-all hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, #A3E635 0%, #84CC16 100%)',
              color: '#000000',
            }}
            classNames={{
              content: 'text-primary-foreground',
              spinner: 'text-primary-foreground',
            }}
            startContent={
              !generating &&
              !batchGenerating && (
                <Sparkles size={16} className="text-primary-foreground" />
              )
            }
          >
            {activeTab === 'single'
              ? generating
                ? '生成中...'
                : '开始生成'
              : batchGenerating
                ? '批量生成中...'
                : isBatchMode
                  ? '批量生成全部视角'
                  : `生成${getViewLabel(activeViewTab)}`}
          </Button>
        </div>
      </div>

      {/* 中间：预览区域 */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* 图片资产预览区和定稿选定预览区 */}
        <div className="flex gap-4">
          {/* 图片资产预览区 */}
          <Card className="bg-content1 border border-content3 flex-1 overflow-hidden" radius="lg">
            <CardBody className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" />
                  {activeTab === 'single' ? '图片资产预览区' : '多视角图预览'}
                </h4>

                {activeTab === 'views' && (
                  <Tabs
                    selectedKey={activeViewTab}
                    onSelectionChange={key => setActiveViewTab(key as ItemViewType)}
                    size="sm"
                    classNames={{
                      tabList: 'gap-1',
                      tab: 'h-6 min-h-6 px-3 text-xs',
                      cursor: 'rounded-lg',
                    }}
                  >
                    {viewTabs.map(tab => (
                      <Tab key={tab.id} title={tab.label} />
                    ))}
                  </Tabs>
                )}
              </div>
              <div className="relative">
                {/* 左侧滚动按钮 */}
                <button
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center z-20 hover:bg-black/70 transition-colors"
                  onClick={handleScrollLeft}
                  aria-label="向左滚动"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* 右侧滚动按钮 */}
                <button
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center z-20 hover:bg-black/70 transition-colors"
                  onClick={handleScrollRight}
                  aria-label="向右滚动"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div
                  ref={previewScrollRef}
                  className="flex gap-4 overflow-x-hidden pb-2"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {currentAllImages.length === 0 ? (
                    <div className="min-w-[200px] aspect-square bg-content2 rounded-xl border border-dashed border-content3 flex items-center justify-center">
                      <span className="text-sm text-slate-500">暂无图片</span>
                    </div>
                  ) : (
                    (activeTab === 'single'
                      ? currentAllImages.slice().reverse()
                      : currentAllImages
                    ).map(img => {
                      const isSelected = currentSelectedImage?.id === img.id;
                      return (
                        <div
                          key={img.id}
                          className={`min-w-[200px] max-w-[200px] aspect-square rounded-xl overflow-hidden cursor-pointer relative group transition-all border border-content3 hover:border-primary/50`}
                        >
                          <div
                            className="w-full h-full overflow-hidden"
                            onClick={() => handlePreviewImage(img, currentAllImages)}
                          >
                            {genUrls[img.id] ? (
                              <img
                                src={genUrls[img.id]}
                                alt={img.prompt}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-content3 flex items-center justify-center">
                                <Spinner size="sm" />
                              </div>
                            )}
                          </div>

                          {/* 左上角选择框 */}
                          <button
                            className={`absolute top-2 left-2 z-10 w-5 h-5 border-2 flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary'
                                : 'border-slate-200 dark:border-slate-700 bg-black/30 dark:bg-white/10'
                            }`}
                            onClick={e => {
                              e.stopPropagation();
                              handleSelectImage(img);
                            }}
                            aria-label={isSelected ? '取消选择' : '选择图片'}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </button>

                          {/* 右上角删除图标 */}
                          <button
                            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors z-10"
                            onClick={e => promptDeleteImage(img, e)}
                            aria-label="删除图片"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* 定稿预览区 */}
          <Card
            className="bg-content1 border border-content3 w-[200px] overflow-hidden"
            radius="lg"
          >
            <CardBody className="p-3 h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  定稿预览区
                </h4>
              </div>
              {activeTab === 'views' ? (
                /* 多视角预览 - 显示4个视角 */
                <div className="grid grid-cols-2 gap-2 flex-1">
                  {viewTabs.map(tab => {
                    const viewImage = asset.views?.[tab.id];
                    return (
                      <div
                        key={tab.id}
                        className="aspect-[3/4] bg-content2 rounded-xl border border-content3 overflow-hidden relative"
                      >
                        {viewImage && viewUrls[viewImage.id] ? (
                          <div
                            onClick={() => {
                              setActiveViewTab(tab.id);
                              if (viewImage) {
                                handlePreviewImage(viewImage, [viewImage]);
                              }
                            }}
                            className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                          >
                            <img
                              src={viewUrls[viewImage.id]}
                              alt={getViewLabel(tab.id)}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-1 left-1 right-1 bg-black/50 text-white text-xs text-center p-1 rounded">
                              {tab.label}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center">
                            <p className="text-[10px] text-slate-400">{tab.label}</p>
                            <p className="text-[9px] text-slate-500">未生成</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="aspect-[3/4] bg-content2 rounded-xl border border-content3 overflow-hidden relative flex-1">
                  {currentSelectedImage && genUrls[currentSelectedImage.id] ? (
                    <div
                      onClick={() =>
                        handlePreviewImage(currentSelectedImage, [currentSelectedImage])
                      }
                      className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                    >
                      <img
                        src={genUrls[currentSelectedImage.id]}
                        alt={currentSelectedImage.prompt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-slate-500 mb-1" />
                      <p className="text-xs text-slate-400">请从左侧选择图片</p>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* 生成提示词区域 */}
        <Card
          className="bg-content1 border border-content3 flex-1 flex flex-col overflow-hidden"
          radius="lg"
        >
          <CardBody className="p-4 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <h4 className="font-semibold text-sm text-foreground">生成提示词</h4>
              </div>

              {/* 右侧：参考图显示 - 多视角模式优先显示定稿图片 */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">参考图</span>
                <div className="flex gap-2">
                  {(() => {
                    if (activeTab === 'views' && currentSelectedImage) {
                      const url =
                        genUrls[currentSelectedImage.id] ||
                        (currentSelectedImage.path.startsWith('remote:')
                          ? currentSelectedImage.path.substring(7)
                          : currentSelectedImage.path);
                      return (
                        <div
                          key={currentSelectedImage.id}
                          className="relative w-10 h-10 cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            openPreview([{ src: url, alt: '参考图 1' }], 0);
                          }}
                        >
                          {url ? (
                            <img
                              src={url}
                              alt="参考图 1"
                              className="w-full h-full object-cover rounded-lg border border-content3"
                            />
                          ) : (
                            <div className="w-full h-full bg-content2 rounded-lg border border-content3 flex items-center justify-center">
                              <Spinner size="sm" />
                            </div>
                          )}
                        </div>
                      );
                    } else if (referenceImages.length > 0) {
                      return (
                        <div className="flex gap-2">
                          {referenceImages.slice(0, 3).map((path, index) => {
                            const url = refUrls[path] || path;
                            return (
                              <div
                                key={path}
                                className="relative w-10 h-10 cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => {
                                  openPreview([{ src: url, alt: `参考图 ${index + 1}` }], 0);
                                }}
                              >
                                {url ? (
                                  <img
                                    src={url}
                                    alt={`参考图 ${index + 1}`}
                                    className="w-full h-full object-cover rounded-lg border border-content3"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-content2 rounded-lg border border-content3 flex items-center justify-center">
                                    <Spinner size="sm" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {referenceImages.length > 3 && (
                            <div className="w-10 h-10 bg-content2 rounded-lg border border-content3 flex items-center justify-center">
                              <span className="text-xs text-slate-400">
                                +{referenceImages.length - 3}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      return <div className="text-xs text-slate-400">无参考图</div>;
                    }
                  })()}
                </div>
              </div>
            </div>

            {/* 提示词输入区 */}
            <div className="flex-1 min-w-0">
              {activeTab === 'views' && isBatchMode ? (
                <div className="h-full bg-content2 rounded-xl border border-content3 flex items-center justify-center p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    批量模式下使用预设视角提示词
                    <br />
                    关闭批量开关可手动编辑提示词
                  </p>
                </div>
              ) : activeTab === 'views' ? (
                <div className="h-full flex flex-col gap-2">
                  <div className="bg-content2 rounded-lg p-2 border border-content3">
                    <p className="text-[10px] text-slate-400 mb-1">完整提示词预览：</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{fullViewPrompt}</p>
                  </div>
                  <Textarea
                    placeholder="视角描述（仅编辑这部分）"
                    value={viewPrompt}
                    onValueChange={setViewPrompt}
                    variant="bordered"
                    radius="lg"
                    minRows={4}
                    maxRows={6}
                    isDisabled={generating}
                    classNames={{
                      input: 'font-medium text-xs leading-relaxed',
                      inputWrapper: 'border border-content3 group-data-[focus=true]:border-primary',
                    }}
                    className="flex-1"
                  />
                </div>
              ) : (
                <Textarea
                  placeholder={t.project.promptPlaceholder}
                  value={prompt}
                  onValueChange={setPrompt}
                  onBlur={handlePromptBlur}
                  variant="bordered"
                  radius="lg"
                  minRows={6}
                  maxRows={8}
                  isDisabled={generating}
                  classNames={{
                    input: 'font-medium text-xs leading-relaxed',
                    inputWrapper: 'border border-content3 group-data-[focus=true]:border-primary',
                  }}
                  className="h-full"
                />
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 右侧：预留功能模块 */}
      <div className="w-[320px] flex flex-col overflow-hidden">
        <Card
          className="bg-content1 border border-content3 flex-1 flex flex-col overflow-hidden"
          radius="lg"
        >
          <CardBody className="p-4 flex flex-col h-full overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
                <Music className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold text-sm text-foreground">物品音效生成功能面板</h4>
            </div>
            <div className="flex-1 bg-content2 rounded-xl border border-content3 flex flex-col items-center justify-center">
              <div className="text-center p-6">
                <Mic className="w-10 h-10 mb-4 text-slate-400" />
                <p className="text-xs text-slate-400 mb-2">功能开发中</p>
                <p className="text-[10px] text-slate-500">预留音效功能模块</p>
              </div>
            </div>
          </CardBody>
        </Card>
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

export default ItemDetail;
