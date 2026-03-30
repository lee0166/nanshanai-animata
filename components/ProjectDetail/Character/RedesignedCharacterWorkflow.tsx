import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardBody,
  Textarea,
  Button,
  Chip,
  Spinner,
  Tabs,
  Tab,
  useDisclosure,
  Switch,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
} from '@heroui/react';
import {
  User,
  Image as ImageIcon,
  Eye,
  Trash2,
  Settings,
  Palette,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  Camera,
  CheckCircle2,
  FileText,
  Music,
  Mic,
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
import { usePreview } from '../../PreviewProvider';
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
import { storageService } from '../../../services/storage';
import { CompactToolbar } from './CompactToolbar';
import { StyleSelector } from '../Shared/StyleSelector';
import { DeleteConfirmModal } from '../../Shared/DeleteConfirmModal';

type WorkflowStage = 1 | 2 | 3;

interface RedesignedCharacterWorkflowProps {
  asset: CharacterAsset;
  onUpdate: (updatedAsset: CharacterAsset, skipSave?: boolean) => void;
  projectId: string;
}

export const RedesignedCharacterWorkflow: React.FC<RedesignedCharacterWorkflowProps> = ({
  asset,
  onUpdate,
  projectId,
}) => {
  const { t, settings } = useApp();
  const { showToast } = useToast();
  const { openPreview } = usePreview();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [imageIdToDelete, setImageIdToDelete] = useState<string | null>(null);

  const [currentStage, setCurrentStage] = useState<WorkflowStage>(1);
  const [selectedFaceImage, setSelectedFaceImage] = useState<GeneratedImage | null>(null);
  const [selectedFullBodyImage, setSelectedFullBodyImage] = useState<GeneratedImage | null>(null);
  const [selectedViewImages, setSelectedViewImages] = useState<
    Record<string, GeneratedImage | null>
  >({});
  const [generating, setGenerating] = useState(false);
  const [isCheckingJobs, setIsCheckingJobs] = useState(true);
  const [activeJobIds, setActiveJobIds] = useState<Set<string>>(new Set());
  const [genUrls, setGenUrls] = useState<Record<string, string>>({});
  const [refUrls, setRefUrls] = useState<Record<string, string>>({});
  const [activeParamTab, setActiveParamTab] = useState<string>('core');
  const previewScrollRef = React.useRef<HTMLDivElement>(null);

  const [stage1Prompt, setStage1Prompt] = useState('');
  const [stage1ModelId, setStage1ModelId] = useState<string>('');
  const [stage1ReferenceImages, setStage1ReferenceImages] = useState<string[]>([]);
  const [stage1AspectRatio, setStage1AspectRatio] = useState<string>('3:4');
  const [stage1Resolution, setStage1Resolution] = useState<string>('2K');
  const [stage1Style, setStage1Style] = useState<string>('');
  const [stage1Count, setStage1Count] = useState<number>(1);
  const [stage1GuidanceScale, setStage1GuidanceScale] = useState<number>(2.5);
  const [stage1ExtraParams, setStage1ExtraParams] = useState<Record<string, any>>({});

  const [stage2Prompt, setStage2Prompt] = useState('');
  const [stage2ModelId, setStage2ModelId] = useState<string>('');
  const [stage2AspectRatio, setStage2AspectRatio] = useState<string>('3:4');
  const [stage2Resolution, setStage2Resolution] = useState<string>('2K');
  const [stage2Style, setStage2Style] = useState<string>('');
  const [stage2Count, setStage2Count] = useState<number>(1);
  const [stage2GuidanceScale, setStage2GuidanceScale] = useState<number>(2.5);
  const [stage2ExtraParams, setStage2ExtraParams] = useState<Record<string, any>>({});

  const [stage3Resolution, setStage3Resolution] = useState<string>('2K');
  const [stage3Style, setStage3Style] = useState<string>('');
  const [stage3GuidanceScale, setStage3GuidanceScale] = useState<number>(2.5);
  const [stage3ExtraParams, setStage3ExtraParams] = useState<Record<string, any>>({});
  const [activeViewTab, setActiveViewTab] = useState<string>('front');
  const [isBatchMode, setIsBatchMode] = useState<boolean>(true);
  const [stage3Prompt, setStage3Prompt] = useState<string>('');
  const {
    isOpen: isBasePromptOpen,
    onOpen: onOpenBasePrompt,
    onClose: onCloseBasePrompt,
  } = useDisclosure();
  const {
    isOpen: isEnhancementOpen,
    onOpen: onOpenEnhancement,
    onClose: onCloseEnhancement,
  } = useDisclosure();

  const viewAngleConfigs: Record<CharacterViewAngle, { label: string; defaultPrompt: string }> = {
    front: {
      label: '正面',
      defaultPrompt: 'front view, facing camera directly',
    },
    side: {
      label: '侧面',
      defaultPrompt: 'side view, profile view, facing left',
    },
    back: {
      label: '背面',
      defaultPrompt: 'back view, from behind, facing away from camera',
    },
    'three-quarter': {
      label: '四分之三侧面',
      defaultPrompt: 'three-quarter view, 45 degree angle',
    },
  };

  // 计算完整提示词（用于显示）
  const fullStage3Prompt = useMemo(() => {
    const basePrompt = asset.prompt || '';
    const viewPrompt =
      stage3Prompt || viewAngleConfigs[activeViewTab as CharacterViewAngle]?.defaultPrompt || '';
    const consistencyPrompt =
      'same character, consistent appearance, maintaining all facial features, hairstyle, and clothing details';

    if (basePrompt) {
      return `${basePrompt}, ${viewPrompt}, ${consistencyPrompt}`;
    }
    return `${viewPrompt}, ${consistencyPrompt}`;
  }, [asset.prompt, stage3Prompt, activeViewTab]);

  // 防抖保存提示词
  useEffect(() => {
    if (currentStage !== 3 || isBatchMode || !stage3Prompt) return;

    const timer = setTimeout(() => {
      const currentSavedPrompt = asset.viewPrompts?.[activeViewTab as CharacterViewAngle];
      if (currentSavedPrompt !== stage3Prompt) {
        const updatedViewPrompts = {
          ...asset.viewPrompts,
          [activeViewTab]: stage3Prompt,
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
  }, [stage3Prompt, activeViewTab, currentStage, isBatchMode]);

  const stages = [
    { id: 1, label: t.character.workflow?.stage1 || '面部', icon: User },
    { id: 2, label: t.character.workflow?.stage2 || '全身', icon: User },
    { id: 3, label: t.character.workflow?.stage3 || '多视角', icon: User },
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
    // 尝试从asset对象中加载之前保存的定稿图片
    let faceImage = null;
    let bodyImage = null;
    const viewImages: Record<string, GeneratedImage | null> = {};

    if (asset.generatedImages) {
      // 查找参考图片（面部特征）
      if (asset.referenceImage) {
        faceImage = asset.referenceImage;
      } else if (asset.generatedImages.length > 0) {
        // 尝试找到第一个面部特征图片
        faceImage =
          asset.generatedImages.find(
            img => img.metadata?.workflowStage === 1 || img.metadata?.stage === 'face'
          ) || null;
      }

      // 查找当前图片（全身设定）
      if (asset.currentImageId) {
        bodyImage = asset.generatedImages.find(img => img.id === asset.currentImageId) || null;
      } else if (asset.generatedImages.length > 0) {
        // 尝试找到第一个全身设定图片
        bodyImage =
          asset.generatedImages.find(
            img => img.metadata?.workflowStage === 2 || img.metadata?.stage === 'full-body'
          ) || null;
      }

      // 查找多视角图片
      viewTabs.forEach(tab => {
        const viewImage =
          asset.generatedImages.find(img => img.metadata?.viewAngle === tab.id) || null;
        if (viewImage) {
          viewImages[tab.id] = viewImage;
        }
      });
    }

    setSelectedFaceImage(faceImage);
    setSelectedFullBodyImage(bodyImage);
    setSelectedViewImages(viewImages);

    const scriptDescription = asset.metadata?.scriptDescription as string | undefined;
    const faceDescription = extractFaceDescription(scriptDescription);
    const fullBodyDescription = extractFullBodyDescription(scriptDescription);
    setStage1Prompt(faceDescription || asset.prompt || '');
    setStage2Prompt(fullBodyDescription || asset.prompt || '');
  }, [asset.id]);

  // 当切换视角时，加载保存的自定义提示词
  useEffect(() => {
    if (currentStage === 3 && !isBatchMode) {
      const savedPrompt = asset.viewPrompts?.[activeViewTab as CharacterViewAngle];
      if (savedPrompt) {
        setStage3Prompt(savedPrompt);
      } else {
        setStage3Prompt(viewAngleConfigs[activeViewTab as CharacterViewAngle].defaultPrompt);
      }
    }
  }, [activeViewTab, isBatchMode, currentStage]);

  useEffect(() => {
    const loadGenUrls = async () => {
      if (!asset.generatedImages) return;

      // 使用 requestAnimationFrame 分批加载，减少强制重排
      await new Promise(resolve => requestAnimationFrame(resolve));

      const urls: Record<string, string> = {};
      const batchSize = 3; // 每批加载 3 张图片

      for (let i = 0; i < asset.generatedImages.length; i += batchSize) {
        const batch = asset.generatedImages.slice(i, i + batchSize);

        for (const img of batch) {
          if (img.path) {
            if (img.path.startsWith('remote:')) {
              urls[img.id] = img.path.substring(7);
            } else {
              urls[img.id] = await storageService.getAssetUrl(img.path);
            }
          }
        }

        // 每批加载后更新一次状态，并等待下一帧
        setGenUrls(prev => ({ ...prev, ...urls }));
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    };
    loadGenUrls();
  }, [asset.generatedImages]);

  useEffect(() => {
    const loadRefUrls = async () => {
      const urls: Record<string, string> = {};
      for (const path of stage1ReferenceImages) {
        if (path) {
          if (path.startsWith('remote:')) {
            urls[path] = path.substring(7);
          } else {
            urls[path] = await storageService.getAssetUrl(path);
          }
        }
      }
      setRefUrls(urls);
    };
    loadRefUrls();
  }, [stage1ReferenceImages]);

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
        scriptDescription,
        stage1AspectRatio,
        settings.language
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
            ...stage1ExtraParams,
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
      const rolePrompt = getFullBodyPrompt(
        stage2Prompt,
        asset.ageGroup || '',
        asset.gender || '',
        settings.language
      );
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
            ...stage2ExtraParams,
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

  const handleStage3SingleGenerate = async () => {
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

    try {
      const result = await assetReuseService.generateCharacterView({
        character: asset,
        viewAngle: activeViewTab as CharacterViewAngle,
        modelConfigId: stage2ModelId,
        modelConfig: model,
        projectId,
        customPrompt: stage3Prompt,
      });

      if (result.success && result.image) {
        const updatedAsset = (await storageService.getAsset(asset.id, projectId)) as CharacterAsset;
        if (updatedAsset) {
          const newViews = await assetReuseService.updateCharacterViews(
            updatedAsset,
            activeViewTab as CharacterViewAngle,
            result.image
          );

          const updated = {
            ...updatedAsset,
            views: newViews,
            generatedImages: [...(updatedAsset.generatedImages || []), result.image],
          };

          onUpdate(updated);
          showToast(
            `${viewAngleConfigs[activeViewTab as CharacterViewAngle].label}生成成功！`,
            'success'
          );
        }
      } else {
        showToast(result.error || '生成失败', 'error');
      }
    } catch (error: any) {
      console.error('[Stage3] Single view generation failed:', error);
      showToast(error.message || '生成失败', 'error');
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
    onUpdate({
      ...asset,
      currentImageId: img.id,
    });
  };

  const promptDeleteImage = (imgId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setImageIdToDelete(imgId);
    onDeleteOpen();
  };

  const confirmDeleteImage = async () => {
    if (!imageIdToDelete) return;

    try {
      const updatedImages = (asset.generatedImages || []).filter(img => img.id !== imageIdToDelete);

      let updatedSelectedFaceImage = selectedFaceImage;
      let updatedSelectedFullBodyImage = selectedFullBodyImage;

      if (selectedFaceImage?.id === imageIdToDelete) {
        updatedSelectedFaceImage = null;
      }
      if (selectedFullBodyImage?.id === imageIdToDelete) {
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
    } finally {
      onDeleteClose();
      setImageIdToDelete(null);
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

  const handlePreviewReferenceImage = (path: string) => {
    const url = refUrls[path] || path;
    openPreview([{ src: url, alt: '参考图' }], 0);
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

  const stage1Images = (asset.generatedImages || []).filter(
    img => img.metadata?.workflowStage === 1 || img.metadata?.stage === 'face'
  );

  const stage2Images = (asset.generatedImages || []).filter(
    img => img.metadata?.workflowStage === 2 || img.metadata?.stage === 'full-body'
  );

  const stage3Images = (asset.generatedImages || []).filter(
    img => img.metadata?.viewAngle || img.metadata?.stage === 'views'
  );

  const getViewImages = (viewAngle: string) => {
    return stage3Images.filter(img => img.metadata?.viewAngle === viewAngle);
  };

  const viewTabs = [
    { id: 'front', label: '正面' },
    { id: 'side', label: '侧面' },
    { id: 'back', label: '背面' },
    { id: 'three-quarter', label: '45°角' },
  ];

  const getCurrentSelectedImage = () => {
    if (currentStage === 1) return selectedFaceImage;
    if (currentStage === 2) return selectedFullBodyImage;
    if (currentStage === 3) return selectedViewImages[activeViewTab] || null;
    return null;
  };

  const getCurrentAllImages = () => {
    if (currentStage === 1) return stage1Images;
    if (currentStage === 2) return stage2Images;
    if (currentStage === 3) return getViewImages(activeViewTab);
    return [];
  };

  const getCurrentPrompt = () => {
    if (currentStage === 1) return stage1Prompt;
    if (currentStage === 2) return stage2Prompt;
    return '';
  };

  const setCurrentPrompt = (value: string) => {
    if (currentStage === 1) setStage1Prompt(value);
    if (currentStage === 2) setStage2Prompt(value);
  };

  const getCurrentStyle = () => {
    if (currentStage === 1) return stage1Style;
    if (currentStage === 2) return stage2Style;
    if (currentStage === 3) return stage3Style;
    return '';
  };

  const setCurrentStyle = (value: string) => {
    if (currentStage === 1) setStage1Style(value);
    if (currentStage === 2) setStage2Style(value);
    if (currentStage === 3) setStage3Style(value);
  };

  const handleCurrentGenerate = () => {
    if (currentStage === 1) handleStage1Generate();
    else if (currentStage === 2) handleStage2Generate();
    else if (currentStage === 3) {
      if (isBatchMode) {
        handleStage3Generate();
      } else {
        handleStage3SingleGenerate();
      }
    }
  };

  useEffect(() => {
    if (!isBatchMode && currentStage === 3) {
      setStage3Prompt(viewAngleConfigs[activeViewTab as CharacterViewAngle].defaultPrompt);
    }
  }, [activeViewTab, isBatchMode, currentStage]);

  const getCurrentModelId = () => {
    if (currentStage === 1) return stage1ModelId;
    return stage2ModelId;
  };

  const setCurrentModelId = (id: string) => {
    if (currentStage === 1) setStage1ModelId(id);
    else setStage2ModelId(id);
  };

  const getCurrentAspectRatio = () => {
    if (currentStage === 1) return stage1AspectRatio;
    return stage2AspectRatio;
  };

  const setCurrentAspectRatio = (ratio: string) => {
    if (currentStage === 1) setStage1AspectRatio(ratio);
    else setStage2AspectRatio(ratio);
  };

  const getCurrentResolution = () => {
    if (currentStage === 1) return stage1Resolution;
    if (currentStage === 2) return stage2Resolution;
    return stage3Resolution;
  };

  const setCurrentResolution = (res: string) => {
    if (currentStage === 1) setStage1Resolution(res);
    else if (currentStage === 2) setStage2Resolution(res);
    else setStage3Resolution(res);
  };

  const getCurrentCount = () => {
    if (currentStage === 1) return stage1Count;
    return stage2Count;
  };

  const setCurrentCount = (count: number) => {
    if (currentStage === 1) setStage1Count(count);
    else setStage2Count(count);
  };

  const getCurrentGuidanceScale = () => {
    if (currentStage === 1) return stage1GuidanceScale;
    if (currentStage === 2) return stage2GuidanceScale;
    return stage3GuidanceScale;
  };

  const setCurrentGuidanceScale = (scale: number) => {
    if (currentStage === 1) setStage1GuidanceScale(scale);
    else if (currentStage === 2) setStage2GuidanceScale(scale);
    else setStage3GuidanceScale(scale);
  };

  const getCurrentExtraParams = () => {
    if (currentStage === 1) return stage1ExtraParams;
    if (currentStage === 2) return stage2ExtraParams;
    return stage3ExtraParams;
  };

  const setCurrentExtraParams = (params: Record<string, any>) => {
    if (currentStage === 1) setStage1ExtraParams(params);
    else if (currentStage === 2) setStage2ExtraParams(params);
    else setStage3ExtraParams(params);
  };

  const handleCurrentSelectImage = (img: GeneratedImage) => {
    if (currentStage === 1) handleSelectFaceImage(img);
    else if (currentStage === 2) handleSelectFullBodyImage(img);
    else if (currentStage === 3) {
      setSelectedViewImages(prev => ({
        ...prev,
        [activeViewTab]: img,
      }));
    }
  };

  const currentAllImages = getCurrentAllImages();
  const currentSelectedImage = getCurrentSelectedImage();

  return (
    <div className="h-full flex bg-background p-3 gap-3 overflow-hidden">
      {/* 左侧：角色信息和参数设置 */}
      <div className="w-[300px] bg-content1 border border-content3 rounded-xl flex flex-col overflow-hidden">
        <div className="p-3 border-b border-content3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm text-foreground truncate">{asset.name}</h3>
              <div className="flex gap-2 mt-1">
                {asset.gender && (
                  <span className="text-xs text-slate-400">
                    {t.character.genderOptions?.[
                      asset.gender as keyof typeof t.character.genderOptions
                    ] || asset.gender}
                  </span>
                )}
                {asset.ageGroup && (
                  <span className="text-xs text-slate-400">
                    {t.character.ageOptions?.[
                      asset.ageGroup as keyof typeof t.character.ageOptions
                    ] || asset.ageGroup}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {stages.map(stage => {
              const isEnabled = isStageEnabled(stage.id as WorkflowStage);
              const isActive = currentStage === stage.id;
              const isCompleted = currentStage > stage.id;

              return (
                <button
                  key={stage.id}
                  onClick={() => isEnabled && setCurrentStage(stage.id as WorkflowStage)}
                  disabled={!isEnabled}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                        ? 'bg-primary/30 text-primary'
                        : isEnabled
                          ? 'bg-content2 text-zinc-500 hover:bg-content3'
                          : 'bg-content2/50 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  {stage.label}
                </button>
              );
            })}
          </div>
        </div>

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
              <CompactToolbar
                modelId={getCurrentModelId()}
                onModelChange={setCurrentModelId}
                aspectRatio={getCurrentAspectRatio()}
                onAspectRatioChange={setCurrentAspectRatio}
                resolution={getCurrentResolution()}
                onResolutionChange={setCurrentResolution}
                count={getCurrentCount()}
                onCountChange={setCurrentCount}
                guidanceScale={getCurrentGuidanceScale()}
                onGuidanceScaleChange={setCurrentGuidanceScale}
                extraParams={getCurrentExtraParams()}
                onExtraParamsChange={setCurrentExtraParams}
                generating={generating}
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
              <StyleSelector
                value={getCurrentStyle()}
                onChange={setCurrentStyle}
                disabled={generating}
              />
            </div>
          </Tab>
        </Tabs>

        <div className="mt-auto p-3 border-t border-content3 relative z-10">
          {currentStage === 3 && (
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
            isLoading={generating}
            onPress={handleCurrentGenerate}
            className="font-bold h-9 rounded-xl shadow-xl shadow-lime-500/30 hover:shadow-lime-500/50 transition-all hover:scale-[1.01]"
            style={{
              background: 'linear-gradient(135deg, #A3E635 0%, #84CC16 100%)',
              color: '#000000',
            }}
            classNames={{
              content: 'text-primary-foreground',
              spinner: 'text-primary-foreground',
            }}
            startContent={!generating && <Sparkles size={16} className="text-primary-foreground" />}
          >
            {generating
              ? t.character?.generating || '生成中...'
              : currentStage === 3
                ? isBatchMode
                  ? '批量生成4个视角'
                  : `生成${viewAngleConfigs[activeViewTab as CharacterViewAngle]?.label || '当前视角'}`
                : t.character.startGeneration || '开始生成'}
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
                  图片资产预览区
                </h4>

                {/* 多视角标签页 - 仅在第3阶段显示 */}
                {currentStage === 3 && (
                  <Tabs
                    selectedKey={activeViewTab}
                    onSelectionChange={setActiveViewTab}
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
                    currentAllImages.map(img => {
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
                                style={{ willChange: 'transform, opacity' }}
                                loading="lazy"
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
                              handleCurrentSelectImage(img);
                            }}
                            aria-label={isSelected ? '取消选择' : '选择图片'}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </button>

                          {/* 右上角删除图标 */}
                          <button
                            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors z-10"
                            onClick={e => promptDeleteImage(img.id, e)}
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
              {currentStage === 3 ? (
                /* 多视角预览 - 显示4个不同角度 */
                <div className="grid grid-cols-2 gap-2 flex-1">
                  {viewTabs.map(tab => {
                    const viewImages = getViewImages(tab.id);
                    const selectedImage = selectedViewImages[tab.id];
                    return (
                      <div
                        key={tab.id}
                        className="aspect-[3/4] bg-content2 rounded-xl border border-content3 overflow-hidden relative"
                      >
                        {selectedImage && genUrls[selectedImage.id] ? (
                          <div
                            onClick={() => handlePreviewImage(selectedImage, viewImages)}
                            className="w-full h-full cursor-pointer hover:opacity-90 transition-opacity"
                          >
                            <img
                              src={genUrls[selectedImage.id]}
                              alt={selectedImage.prompt}
                              className="w-full h-full object-cover"
                              style={{ willChange: 'transform, opacity' }}
                              loading="lazy"
                            />
                            <div className="absolute bottom-1 left-1 right-1 bg-black/50 text-white text-xs text-center p-1 rounded">
                              {tab.label}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center">
                            <p className="text-[10px] text-slate-400">{tab.label}</p>
                            <p className="text-[9px] text-slate-500">未选择</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* 单张图片预览 - 适用于第1、2阶段 */
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
                        style={{ willChange: 'transform, opacity' }}
                        loading="lazy"
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

              {/* 右侧：参考图显示 - 所有阶段都显示 */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">参考图</span>
                <div className="flex gap-2">
                  {(() => {
                    // 确定实际使用的参考图片对象
                    let referenceImageObjects: GeneratedImage[] = [];

                    // 优先使用上一个环节的定稿图片
                    if (currentStage === 2 && selectedFaceImage) {
                      referenceImageObjects = [selectedFaceImage];
                    } else if (currentStage === 3 && selectedFullBodyImage) {
                      referenceImageObjects = [selectedFullBodyImage];
                    }

                    if (referenceImageObjects.length > 0) {
                      return referenceImageObjects.map((img, index) => {
                        // 直接使用图片对象的URL或路径
                        const url =
                          genUrls[img.id] ||
                          (img.path.startsWith('remote:') ? img.path.substring(7) : img.path);
                        return (
                          <div
                            key={img.id}
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
                      });
                    } else {
                      return <div className="text-xs text-slate-400">无参考图</div>;
                    }
                  })()}
                </div>
              </div>
            </div>

            {/* 提示词输入区 */}
            <div className="flex-1 min-w-0">
              {currentStage === 3 && isBatchMode ? (
                <div className="h-full bg-content2 rounded-xl border border-content3 flex items-center justify-center p-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                    批量模式下使用预设视角提示词
                    <br />
                    关闭批量开关可手动编辑提示词
                  </p>
                </div>
              ) : currentStage === 3 ? (
                <div className="h-full flex flex-col gap-2">
                  {/* 完整提示词预览（只读） */}
                  <div className="bg-content2 rounded-lg p-2 border border-content3">
                    <p className="text-[10px] text-slate-400 mb-1">完整提示词预览：</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">
                      {fullStage3Prompt}
                    </p>
                  </div>
                  {/* 视角提示词编辑 */}
                  <Textarea
                    placeholder="视角描述（仅编辑这部分）"
                    value={stage3Prompt}
                    onValueChange={setStage3Prompt}
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
                  value={getCurrentPrompt()}
                  onValueChange={setCurrentPrompt}
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

      {/* 右侧：音频功能模块预留 */}
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
              <h4 className="font-semibold text-sm text-foreground">角色音色生成功能面板</h4>
            </div>
            <div className="flex-1 bg-content2 rounded-xl border border-content3 flex flex-col items-center justify-center">
              <div className="text-center p-6">
                <Mic className="w-10 h-10 mb-4 text-slate-400" />
                <p className="text-xs text-slate-400 mb-2">功能开发中</p>
                <p className="text-[10px] text-slate-500">预留音频功能模块</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        onConfirm={confirmDeleteImage}
      />

      {/* 角色基础描述详情 Modal */}
      <Modal isOpen={isBasePromptOpen} onClose={onCloseBasePrompt} size="lg">
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <span>角色基础描述</span>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="p-2 bg-content2 rounded-lg">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {asset.prompt || '暂无角色描述'}
                  </p>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* 一致性增强详情 Modal */}
      <Modal isOpen={isEnhancementOpen} onClose={onCloseEnhancement} size="lg">
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span>一致性增强</span>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="p-2 bg-content2 rounded-lg">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    same character, consistent appearance, maintaining all facial features,
                    hairstyle, and clothing details
                  </p>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
