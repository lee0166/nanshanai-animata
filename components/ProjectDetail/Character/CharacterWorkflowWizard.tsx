import React, { useState, useEffect, useMemo } from 'react';
import {
  Tabs,
  Tab,
  Card,
  CardBody,
  Button,
  Spinner,
  Chip,
  Select,
  SelectItem,
  Slider,
} from '@heroui/react';
import {
  User,
  Camera,
  Layers,
  ChevronRight,
  Check,
  Image as ImageIcon,
  Trash2,
  Eye,
  Sparkles,
  Settings,
} from 'lucide-react';
import {
  CharacterAsset,
  GeneratedImage,
  CharacterViewAngle,
  AssetType,
  JobStatus,
} from '../../../types';
import { useApp } from '../../../contexts/context';
import { useToast } from '../../../contexts/ToastContext';
import { usePreview } from '../../../components/PreviewProvider';
import { jobQueue } from '../../../services/queue';
import { aiService } from '../../../services/aiService';
import {
  getFacePortraitPrompt,
  getFullBodyPrompt,
  getDefaultStylePrompt,
  extractFaceDescription,
  extractFullBodyDescription,
} from '../../../services/prompt';
import { assetReuseService } from '../../../services/asset/AssetReuseService';
import { ImageGenerationPanel } from '../Shared/ImageGenerationPanel';
import { storageService } from '../../../services/storage';
import { DEFAULT_MODELS } from '../../../config/models';
import { resolveModelConfig } from '../../../services/modelUtils';

type WorkflowStage = 1 | 2 | 3;

interface CharacterWorkflowWizardProps {
  asset: CharacterAsset;
  onUpdate: (updatedAsset: CharacterAsset, skipSave?: boolean) => void;
  projectId: string;
}

export const CharacterWorkflowWizard: React.FC<CharacterWorkflowWizardProps> = ({
  asset,
  onUpdate,
  projectId,
}) => {
  const { t, settings } = useApp();
  const { showToast } = useToast();
  const { openPreview } = usePreview();

  const [currentStage, setCurrentStage] = useState<WorkflowStage>(1);
  const [selectedFaceImage, setSelectedFaceImage] = useState<GeneratedImage | null>(null);
  const [selectedFullBodyImage, setSelectedFullBodyImage] = useState<GeneratedImage | null>(null);
  const [generating, setGenerating] = useState(false);
  const [isCheckingJobs, setIsCheckingJobs] = useState(true);
  const [activeJobIds, setActiveJobIds] = useState<Set<string>>(new Set());

  const [stage1Prompt, setStage1Prompt] = useState('');
  const [stage1ModelId, setStage1ModelId] = useState<string>('');
  const [stage1ReferenceImages, setStage1ReferenceImages] = useState<string[]>([]);
  const [stage1AspectRatio, setStage1AspectRatio] = useState<string>('1:1');
  const [stage1Resolution, setStage1Resolution] = useState<string>('2K');
  const [stage1Style, setStage1Style] = useState<string>('');
  const [stage1Count, setStage1Count] = useState<number>(1);
  const [stage1GuidanceScale, setStage1GuidanceScale] = useState<number>(2.5);

  const [stage2Prompt, setStage2Prompt] = useState('');
  const [stage2ModelId, setStage2ModelId] = useState<string>('');
  const [stage2AspectRatio, setStage2AspectRatio] = useState<string>('3:4');
  const [stage2Resolution, setStage2Resolution] = useState<string>('2K');
  const [stage2Style, setStage2Style] = useState<string>('');
  const [stage2Count, setStage2Count] = useState<number>(1);
  const [stage2GuidanceScale, setStage2GuidanceScale] = useState<number>(2.5);

  const [stage3Resolution, setStage3Resolution] = useState<string>('2K');
  const [stage3Style, setStage3Style] = useState<string>('');
  const [stage3GuidanceScale, setStage3GuidanceScale] = useState<number>(2.5);

  const [genUrls, setGenUrls] = useState<Record<string, string>>({});

  const stages = [
    {
      id: 1,
      label: t.character.workflow?.stage1 || '面部特征设计',
      icon: User,
      description: t.character.workflow?.stage1Desc || '生成面部特写，确定面部特征',
    },
    {
      id: 2,
      label: t.character.workflow?.stage2 || '全身设定图',
      icon: Camera,
      description: t.character.workflow?.stage2Desc || '基于面部图生成全身设定',
    },
    {
      id: 3,
      label: t.character.workflow?.stage3 || '多视角生成',
      icon: Layers,
      description: t.character.workflow?.stage3Desc || '生成三视图（正面、侧面、背面）',
    },
  ];

  const getInitialModelId = () => {
    const imageModels = settings.models.filter(m => m.type === 'image' && (m.enabled ?? true));
    return imageModels[0]?.id || '';
  };

  useEffect(() => {
    const initialModelId = getInitialModelId();
    setStage1ModelId(initialModelId);
    setStage2ModelId(initialModelId);
  }, [settings.models]);

  useEffect(() => {
    setCurrentStage(1);
    setSelectedFaceImage(null);
    setSelectedFullBodyImage(null);
    const scriptDescription = asset.metadata?.scriptDescription as string | undefined;
    const faceDescription = extractFaceDescription(scriptDescription);
    const fullBodyDescription = extractFullBodyDescription(scriptDescription);
    setStage1Prompt(faceDescription || asset.prompt || '');
    setStage2Prompt(fullBodyDescription || asset.prompt || '');
  }, [asset.id]);

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
    const unsub = jobQueue.subscribe(async job => {
      if (job.params.assetId === asset.id) {
        if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
          setActiveJobIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(job.id);

            if (newSet.size === 0) {
              setGenerating(false);
            }
            return newSet;
          });

          if (job.status === JobStatus.COMPLETED) {
            try {
              const updatedAsset = (await storageService.getAsset(
                asset.id,
                projectId
              )) as CharacterAsset;

              if (updatedAsset) {
                onUpdate(updatedAsset, true);
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

  const isStageEnabled = (stage: WorkflowStage): boolean => {
    if (stage === 1) return true;
    if (stage === 2) return selectedFaceImage !== null;
    if (stage === 3) return selectedFullBodyImage !== null;
    return false;
  };

  const handleStage1Generate = async () => {
    if (!stage1Prompt || !stage1ModelId) {
      showToast(t.project?.alertFill, 'warning');
      return;
    }

    const model = settings.models.find(m => m.id === stage1ModelId);
    if (!model) {
      showToast(t.errors.modelNotFound, 'error');
      return;
    }

    setGenerating(true);
    showToast(t.project?.generationStarted, 'info');

    try {
      const stylePrompt = getDefaultStylePrompt(stage1Style);
      const scriptDescription = asset.metadata?.scriptDescription as string | undefined;
      const rolePrompt = getFacePortraitPrompt(
        stage1Prompt,
        asset.ageGroup || '',
        asset.gender || '',
        scriptDescription
      );
      const finalPrompt = `${rolePrompt} ${stylePrompt}`;

      const updated = {
        ...asset,
        prompt: stage1Prompt,
        metadata: {
          ...asset.metadata,
          modelConfigId: stage1ModelId,
          referenceImages: stage1ReferenceImages,
          aspectRatio: stage1AspectRatio,
          resolution: stage1Resolution,
        },
      };
      onUpdate(updated);

      const jobs = aiService.createGenerationJobs(
        model,
        {
          projectId,
          prompt: finalPrompt,
          userPrompt: stage1Prompt,
          assetName: asset.name,
          assetType: AssetType.CHARACTER,
          assetId: asset.id,
          referenceImages: stage1ReferenceImages,
          aspectRatio: stage1AspectRatio,
          resolution: stage1Resolution,
          style: stage1Style,
          guidanceScale: stage1GuidanceScale,
          extraParams: {
            stage: 'face',
            workflowStage: 1,
            generateCount: stage1Count,
          },
        },
        stage1Count
      );

      await jobQueue.addJobs(jobs);

      setActiveJobIds(prev => {
        const newSet = new Set(prev);
        jobs.forEach(job => newSet.add(job.id));
        return newSet;
      });
    } catch (error: any) {
      console.error('[Stage1] Failed to add job:', error);
      showToast(error.message || t.errors.failedToStart, 'error');
      setGenerating(false);
    }
  };

  const handleStage2Generate = async () => {
    if (!stage2Prompt || !stage2ModelId || !selectedFaceImage) {
      showToast(t.project?.alertFill, 'warning');
      return;
    }

    const model = settings.models.find(m => m.id === stage2ModelId);
    if (!model) {
      showToast(t.errors.modelNotFound, 'error');
      return;
    }

    setGenerating(true);
    showToast(t.project?.generationStarted, 'info');

    try {
      const stylePrompt = getDefaultStylePrompt(stage2Style);
      const rolePrompt = getFullBodyPrompt(stage2Prompt, asset.ageGroup || '', asset.gender || '');
      const finalPrompt = `${rolePrompt} ${stylePrompt}`;

      const referenceImages = [selectedFaceImage.path];

      const updated = {
        ...asset,
        prompt: stage2Prompt,
        metadata: {
          ...asset.metadata,
          modelConfigId: stage2ModelId,
          referenceImages,
          aspectRatio: stage2AspectRatio,
          resolution: stage2Resolution,
        },
      };
      onUpdate(updated);

      const jobs = aiService.createGenerationJobs(
        model,
        {
          projectId,
          prompt: finalPrompt,
          userPrompt: stage2Prompt,
          assetName: asset.name,
          assetType: AssetType.CHARACTER,
          assetId: asset.id,
          referenceImages,
          aspectRatio: stage2AspectRatio,
          resolution: stage2Resolution,
          style: stage2Style,
          guidanceScale: stage2GuidanceScale,
          extraParams: {
            stage: 'full-body',
            workflowStage: 2,
            parentImageId: selectedFaceImage.id,
            generateCount: stage2Count,
          },
        },
        stage2Count
      );

      await jobQueue.addJobs(jobs);

      setActiveJobIds(prev => {
        const newSet = new Set(prev);
        jobs.forEach(job => newSet.add(job.id));
        return newSet;
      });
    } catch (error: any) {
      console.error('[Stage2] Failed to add job:', error);
      showToast(error.message || t.errors.failedToStart, 'error');
      setGenerating(false);
    }
  };

  const handleStage3Generate = async () => {
    if (!stage2ModelId || !selectedFullBodyImage) {
      showToast('请先选择全身图', 'error');
      return;
    }

    setGenerating(true);

    const model = settings.models.find(m => m.id === stage2ModelId);
    if (!model) {
      showToast(t.errors.modelNotFound, 'error');
      setGenerating(false);
      return;
    }

    const viewAngles: CharacterViewAngle[] = ['front', 'side', 'back', 'three-quarter'];
    let successCount = 0;
    let failCount = 0;

    try {
      for (const viewAngle of viewAngles) {
        const result = await assetReuseService.generateCharacterView({
          character: asset,
          viewAngle,
          modelConfigId: stage2ModelId,
          modelConfig: model,
          projectId,
        });

        if (result.success && result.image) {
          const updatedAsset = (await storageService.getAsset(
            asset.id,
            projectId
          )) as CharacterAsset;
          if (updatedAsset) {
            const newViews = await assetReuseService.updateCharacterViews(
              updatedAsset,
              viewAngle,
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
          console.error(`[Stage3] Failed to generate ${viewAngle} view:`, result.error);
        }
      }

      if (successCount > 0) {
        showToast(
          `批量生成完成！成功: ${successCount}, 失败: ${failCount}`,
          successCount === viewAngles.length ? 'success' : 'warning'
        );
      } else {
        showToast('批量生成失败', 'error');
      }
    } catch (error: any) {
      console.error('[Stage3] Batch generate views failed:', error);
      showToast(error.message || '批量生成失败', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSelectFaceImage = (img: GeneratedImage) => {
    setSelectedFaceImage(img);
    const scriptDescription = asset.metadata?.scriptDescription as string | undefined;
    const fullBodyDescription = extractFullBodyDescription(scriptDescription);
    setStage2Prompt(fullBodyDescription || asset.prompt || '');
    setStage2Style(stage1Style);
    onUpdate({
      ...asset,
      referenceImage: img,
    });
  };

  const handleSelectFullBodyImage = (img: GeneratedImage) => {
    setSelectedFullBodyImage(img);
  };

  const handleDeleteImage = async (imgId: string) => {
    try {
      const updatedImages = (asset.generatedImages || []).filter(img => img.id !== imgId);

      let updatedSelectedFaceImage = selectedFaceImage;
      let updatedSelectedFullBodyImage = selectedFullBodyImage;

      if (selectedFaceImage?.id === imgId) {
        updatedSelectedFaceImage = null;
      }
      if (selectedFullBodyImage?.id === imgId) {
        updatedSelectedFullBodyImage = null;
      }

      setSelectedFaceImage(updatedSelectedFaceImage);
      setSelectedFullBodyImage(updatedSelectedFullBodyImage);

      const updatedAsset = {
        ...asset,
        generatedImages: updatedImages,
        referenceImage: updatedSelectedFaceImage,
      };
      onUpdate(updatedAsset);
      showToast('图片已删除', 'success');
    } catch (error) {
      console.error('删除图片失败:', error);
      showToast('删除图片失败', 'error');
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

  const stage1Images = (asset.generatedImages || []).filter(
    img => img.metadata?.workflowStage === 1 || img.metadata?.stage === 'face'
  );

  const stage2Images = (asset.generatedImages || []).filter(
    img => img.metadata?.workflowStage === 2 || img.metadata?.stage === 'full-body'
  );

  const stage3Images = (asset.generatedImages || []).filter(
    img => img.metadata?.viewAngle || img.metadata?.stage === 'views'
  );

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-slate-200 dark:border-slate-800 p-4">
        <Tabs
          selectedKey={String(currentStage)}
          onSelectionChange={key => {
            const stage = Number(key) as WorkflowStage;
            if (isStageEnabled(stage)) {
              setCurrentStage(stage);
            }
          }}
          classNames={{
            tabList: 'gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg',
            tab: 'data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground transition-colors',
          }}
        >
          {stages.map(stage => (
            <Tab
              key={String(stage.id)}
              isDisabled={!isStageEnabled(stage.id as WorkflowStage)}
              title={
                <div className="flex items-center gap-2">
                  <stage.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{stage.label}</span>
                  {currentStage > stage.id && <Check className="w-3 h-3 text-green-500" />}
                </div>
              }
            />
          ))}
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {currentStage === 1 && (
          <div className="space-y-6">
            <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span className="text-primary">{t.character.workflow?.stage1 || '阶段1：面部特征设计'}</span>
              </h3>
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex flex-col">
                  <span className="text-xs text-primary uppercase tracking-wider font-bold">
                    角色名称
                  </span>
                  <span className="text-sm font-semibold">{asset.name}</span>
                </div>
                {asset.gender && (
                  <div className="flex flex-col">
                    <span className="text-xs text-primary uppercase tracking-wider font-bold">
                      性别
                    </span>
                    <span className="text-sm font-semibold">{asset.gender}</span>
                  </div>
                )}
                {asset.ageGroup && (
                  <div className="flex flex-col">
                    <span className="text-xs text-primary uppercase tracking-wider font-bold">
                      年龄
                    </span>
                    <span className="text-sm font-semibold">{asset.ageGroup}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t.character.workflow?.stage1Desc ||
                  '生成2-3张面部特写候选图，选择最满意的一张作为面部特征锁定。'}
              </p>
            </div>

            <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
              <ImageGenerationPanel
                projectId={projectId}
                prompt={stage1Prompt}
                onPromptChange={setStage1Prompt}
                modelId={stage1ModelId}
                onModelChange={setStage1ModelId}
                referenceImages={stage1ReferenceImages}
                onReferenceImagesChange={setStage1ReferenceImages}
                aspectRatio={stage1AspectRatio}
                onAspectRatioChange={setStage1AspectRatio}
                resolution={stage1Resolution}
                onResolutionChange={setStage1Resolution}
                style={stage1Style}
                onStyleChange={setStage1Style}
                count={stage1Count}
                onCountChange={setStage1Count}
                guidanceScale={stage1GuidanceScale}
                onGuidanceScaleChange={setStage1GuidanceScale}
                generating={generating}
                onGenerate={handleStage1Generate}
              />
            </div>

            {stage1Images.length > 0 && (
              <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
                <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <span className="text-primary">{t.character.workflow?.selectFace || '生成的面部候选图'}</span>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {stage1Images.map(img => (
                    <div
                      key={img.id}
                      className={`relative group cursor-pointer transition-all duration-200 rounded-xl overflow-hidden ${
                        selectedFaceImage?.id === img.id
                          ? 'ring-4 ring-primary shadow-lg scale-[1.02]'
                          : 'ring-2 ring-transparent hover:ring-primary/30 hover:scale-[1.01]'
                      } bg-content2`}
                      onClick={() => handleSelectFaceImage(img)}
                    >
                      <div className="relative">
                        {genUrls[img.id] ? (
                          <img
                            src={genUrls[img.id]}
                            alt={img.prompt}
                            className="w-full aspect-square object-cover"
                          />
                        ) : (
                          <div className="w-full aspect-square bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-slate-400" />
                          </div>
                        )}

                        {selectedFaceImage?.id === img.id && (
                          <div className="absolute top-2 right-2 z-10">
                            <Chip size="sm" className="shadow-lg bg-primary text-primary-foreground">
                              <Check className="w-3 h-3 mr-1" />
                              已选择
                            </Chip>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <Button
                            size="sm"
                            isIconOnly
                            color="default"
                            className="bg-white/90 hover:bg-white shadow-lg"
                            onClick={e => {
                              e.stopPropagation();
                              handlePreviewImage(img, stage1Images);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            isIconOnly
                            color="danger"
                            className="bg-red-500/90 hover:bg-red-500 shadow-lg"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteImage(img.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {currentStage === 2 && (
          <div className="space-y-6">
            <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
              <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                <Camera className="w-4 h-4 text-primary" />
                <span className="text-primary">{t.character.workflow?.stage2 || '阶段2：全身设定图'}</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t.character.workflow?.stage2Desc || '基于选定的面部图，生成全身设定图。'}
              </p>
            </div>

            {selectedFaceImage && (
              <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
                <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <span className="text-primary">{t.character.workflow?.selectFace || '已选择的面部图'}</span>
                </h4>
                <div className="relative w-48 rounded-xl overflow-hidden ring-2 ring-primary shadow-lg">
                  {genUrls[selectedFaceImage.id] ? (
                    <img
                      src={genUrls[selectedFaceImage.id]}
                      alt={selectedFaceImage.prompt}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Chip color="primary" size="sm" className="shadow-lg">
                      <Check className="w-3 h-3 mr-1" />
                      已选择
                    </Chip>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
              <ImageGenerationPanel
                projectId={projectId}
                prompt={stage2Prompt}
                onPromptChange={setStage2Prompt}
                modelId={stage2ModelId}
                onModelChange={setStage2ModelId}
                referenceImages={selectedFaceImage ? [selectedFaceImage.path] : []}
                onReferenceImagesChange={() => {}}
                aspectRatio={stage2AspectRatio}
                onAspectRatioChange={setStage2AspectRatio}
                resolution={stage2Resolution}
                onResolutionChange={setStage2Resolution}
                style={stage2Style}
                onStyleChange={setStage2Style}
                count={stage2Count}
                onCountChange={setStage2Count}
                guidanceScale={stage2GuidanceScale}
                onGuidanceScaleChange={setStage2GuidanceScale}
                generating={generating}
                onGenerate={handleStage2Generate}
              />
            </div>

            {stage2Images.length > 0 && (
              <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
                <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <span className="text-primary">{t.character.workflow?.selectFullBody || '生成的全身图'}</span>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {stage2Images.map(img => (
                    <div
                      key={img.id}
                      className={`relative group cursor-pointer transition-all duration-200 rounded-xl overflow-hidden ${
                        selectedFullBodyImage?.id === img.id
                          ? 'ring-4 ring-primary shadow-lg scale-[1.02]'
                          : 'ring-2 ring-transparent hover:ring-primary/30 hover:scale-[1.01]'
                      } bg-content2`}
                      onClick={() => handleSelectFullBodyImage(img)}
                    >
                      <div className="relative">
                        {genUrls[img.id] ? (
                          <img
                            src={genUrls[img.id]}
                            alt={img.prompt}
                            className="w-full aspect-[3/4] object-cover"
                          />
                        ) : (
                          <div className="w-full aspect-[3/4] bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-slate-400" />
                          </div>
                        )}

                        {selectedFullBodyImage?.id === img.id && (
                          <div className="absolute top-2 right-2 z-10">
                            <Chip size="sm" className="shadow-lg bg-primary text-primary-foreground">
                              <Check className="w-3 h-3 mr-1" />
                              已选择
                            </Chip>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <Button
                            size="sm"
                            isIconOnly
                            color="default"
                            className="bg-white/90 hover:bg-white shadow-lg"
                            onClick={e => {
                              e.stopPropagation();
                              handlePreviewImage(img, stage2Images);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            isIconOnly
                            color="danger"
                            className="bg-red-500/90 hover:bg-red-500 shadow-lg"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteImage(img.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {currentStage === 3 && (
          <div className="space-y-6">
            <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-primary">{t.character.workflow?.stage3 || '阶段3：多视角生成'}</span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {t.character.workflow?.stage3Desc ||
                  '基于全身设定图，生成三视图（正面、侧面、背面、四分之三）。'}
              </p>
            </div>

            {selectedFullBodyImage && (
              <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
                <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" />
                  <span className="text-primary">{t.character.workflow?.selectFullBody || '已选择的全身图'}</span>
                </h4>
                <div className="relative w-48 rounded-xl overflow-hidden ring-2 ring-primary shadow-lg">
                  {genUrls[selectedFullBodyImage.id] ? (
                    <img
                      src={genUrls[selectedFullBodyImage.id]}
                      alt={selectedFullBodyImage.prompt}
                      className="w-full aspect-[3/4] object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-[3/4] bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Chip color="primary" size="sm" className="shadow-lg">
                      <Check className="w-3 h-3 mr-1" />
                      已选择
                    </Chip>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
              <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                <span className="text-primary">生成参数</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-primary uppercase tracking-wider">
                    模型
                  </label>
                  <Select
                    selectedKeys={[stage2ModelId]}
                    onSelectionChange={keys => setStage2ModelId(Array.from(keys)[0] as string)}
                    classNames={{ trigger: 'h-10' }}
                  >
                    {settings.models
                      .filter(m => m.type === 'image' && (m.enabled ?? true))
                      .map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-primary uppercase tracking-wider">
                    分辨率
                  </label>
                  <Select
                    selectedKeys={[stage3Resolution]}
                    onSelectionChange={keys => setStage3Resolution(Array.from(keys)[0] as string)}
                    classNames={{ trigger: 'h-10' }}
                  >
                    <SelectItem key="1K" value="1K">
                      1K (1024x1024)
                    </SelectItem>
                    <SelectItem key="2K" value="2K">
                      2K (1536x1536)
                    </SelectItem>
                    <SelectItem key="4K" value="4K">
                      4K (2048x2048)
                    </SelectItem>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Guidance Scale: {stage3GuidanceScale.toFixed(1)}
                  </label>
                  <Slider
                    value={stage3GuidanceScale}
                    onChange={value => setStage3GuidanceScale(value as number)}
                    minValue={1}
                    maxValue={10}
                    step={0.5}
                  />
                </div>
              </div>
              <div className="mt-6">
                <Button
                  size="lg"
                  fullWidth
                  isLoading={generating}
                  onPress={handleStage3Generate}
                  isDisabled={!selectedFullBodyImage}
                  style={{
                    background: 'linear-gradient(135deg, #A3E635 0%, #84CC16 100%)',
                    color: '#000000',
                  }}
                  className="font-bold shadow-lg shadow-lime-500/20 hover:shadow-lime-500/40 transition-all"
                  startContent={!generating && <Sparkles size={20} />}
                >
                  {generating
                    ? t.character?.generating || '生成中...'
                    : t.character.startGeneration || '生成三视图'}
                </Button>
              </div>
            </div>

            {stage3Images.length > 0 && (
              <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm">
                <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" />
                  <span className="text-primary">生成的多视角图</span>
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stage3Images.map(img => (
                    <div
                      key={img.id}
                      className="relative group cursor-pointer transition-all duration-200 rounded-xl overflow-hidden ring-2 ring-transparent hover:ring-content3 hover:scale-[1.01] bg-content2"
                    >
                      <div className="relative">
                        {genUrls[img.id] ? (
                          <img
                            src={genUrls[img.id]}
                            alt={img.prompt}
                            className="w-full aspect-[3/4] object-cover"
                          />
                        ) : (
                          <div className="w-full aspect-[3/4] bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-slate-400" />
                          </div>
                        )}

                        {img.metadata?.viewAngle && (
                          <div className="absolute top-2 left-2 z-10">
                            <Chip
                              size="sm"
                              className="shadow-lg bg-black/60 text-white border-none"
                            >
                              {img.metadata.viewAngle === 'front'
                                ? '正面'
                                : img.metadata.viewAngle === 'side'
                                  ? '侧面'
                                  : img.metadata.viewAngle === 'back'
                                    ? '背面'
                                    : '四分之三'}
                            </Chip>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                          <Button
                            size="sm"
                            isIconOnly
                            color="default"
                            className="bg-white/90 hover:bg-white shadow-lg"
                            onClick={e => {
                              e.stopPropagation();
                              handlePreviewImage(img, stage3Images);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            isIconOnly
                            color="danger"
                            className="bg-red-500/90 hover:bg-red-500 shadow-lg"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteImage(img.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center">
        <Button
          variant="flat"
          isDisabled={currentStage === 1}
          onPress={() => setCurrentStage(prev => Math.max(1, prev - 1) as WorkflowStage)}
        >
          {t.character.workflow?.prevStep || '上一步'}
        </Button>
        <div className="flex gap-2">
          {currentStage < 3 && isStageEnabled((currentStage + 1) as WorkflowStage) && (
            <Button
              endContent={<ChevronRight className="w-4 h-4" />}
              onPress={() => setCurrentStage(prev => (prev + 1) as WorkflowStage)}
              style={{
                background: 'linear-gradient(135deg, #A3E635 0%, #84CC16 100%)',
                color: '#000000',
              }}
              className="shadow-lg shadow-lime-500/20 hover:shadow-lime-500/40 transition-all"
            >
              {t.character.workflow?.nextStep || '下一步'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
