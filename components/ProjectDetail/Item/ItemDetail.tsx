import React, { useState, useEffect } from 'react';
import { ItemAsset, GeneratedImage, AssetType, Job, JobStatus, ItemType } from '../../../types';
import { DEFAULT_MODELS } from '../../../config/models';
import { UNIFIED_KEYS, resolveModelConfig } from '../../../services/modelUtils';
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
  Button,
  Card,
  useDisclosure,
  Modal,
  ModalContent,
  ModalBody,
  Chip,
  Tabs,
  Tab,
} from '@heroui/react';
import {
  Plus,
  X,
  Check,
  Image as ImageIcon,
  Trash2,
  Eye,
  Wand2,
  Layers,
  Box,
} from 'lucide-react';
import {
  getItemImagePrompt,
  getDefaultStylePrompt,
} from '../../../services/prompt';
import ResourcePicker from '../../ResourcePicker';
import { usePreview } from '../../PreviewProvider';
import { ImageGenerationPanel } from '../Shared/ImageGenerationPanel';

interface ItemDetailProps {
  asset: ItemAsset;
  onUpdate: (updatedAsset: ItemAsset) => void;
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

  const [refUrls, setRefUrls] = useState<Record<string, string>>({});
  const [genUrls, setGenUrls] = useState<Record<string, string>>({});

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
          console.log(
            `[ItemDetail] Found ${activeJobs.length} active jobs for asset ${asset.id}`
          );
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

  return (
    <div className="h-full flex flex-row w-full overflow-hidden">
      {/* 左侧：基础信息、Tabs、生图参数设置，宽度约500px */}
      <div className="w-[500px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto p-4 border-r border-slate-200 dark:border-slate-800">
        {/* 基础信息卡片 */}
        <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <Box className="w-4 h-4 text-primary" />
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

            <div className="flex flex-col gap-2">
              <label className="text-slate-700 dark:text-slate-300 font-bold text-sm">
                {t.project.itemTypeLabel}
              </label>
              <Select
                aria-label={t.project.itemTypeLabel}
                placeholder={t.project.selectType}
                selectedKeys={[itemType]}
                onChange={e => handleItemTypeChange(e.target.value)}
                className="w-full"
                variant="bordered"
                radius="lg"
                isDisabled={generating || isCheckingJobs}
                classNames={{
                  value: 'font-bold text-sm',
                  trigger: 'border-2 data-[focus=true]:border-primary',
                }}
              >
                {Object.entries(t.project.itemTypes || {}).map(([key, label]) => (
                  <SelectItem key={key} value={key} textValue={label as string}>
                    {label as string}
                  </SelectItem>
                ))}
              </Select>
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
              key="multi" 
              title={
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  <span className="text-sm font-medium">多图生成</span>
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

            {activeTab === 'multi' && (
              <div className="flex flex-col gap-4">
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧：预览区和生成结果展示（弹性宽度） */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {activeTab === 'single' ? '生成结果' : '多图生成结果'}
          </h3>
          <div className="px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800/50 text-xs font-bold text-slate-600 dark:text-slate-300">
            图片 ({asset.generatedImages?.length || 0})
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                      className={`aspect-square border-2 transition-all duration-200 ${isSelected ? 'border-primary shadow-xl scale-[1.02]' : 'border-transparent hover:border-primary/50 hover:shadow-lg'}`}
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
                          aria-label="预览道具"
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
                          aria-label="删除道具"
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

      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} size="sm">
        <ModalContent>
          <ModalBody className="py-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{t.common.confirmDeleteTitle}</h3>
                <p className="text-sm text-default-500 mt-1">{t.common.confirmDeleteImageDesc}</p>
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

export default ItemDetail;
