import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Script, Shot, ScriptScene, CharacterAsset, Asset, AssetType, ModelConfig, GeneratedImage, Job, JobStatus } from '../types';
import { storageService } from '../services/storage';
import { useApp } from '../contexts/context';
import { useToast } from '../contexts/ToastContext';
import { usePreview } from '../components/PreviewProvider';
import { Card, CardBody, Button, Chip, Badge, Progress, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem } from "@heroui/react";
import { Camera, Film, Clock, Users, MapPin, Scissors, AlertCircle, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { keyframeService } from '../services/keyframe';
import { jobQueue } from '../services/queue';
import { aiService } from '../services/aiService';
import { DEFAULT_MODELS } from '../config/models';

// 缩略图滚动组件
interface ThumbnailScrollerProps {
  images: GeneratedImage[];
  currentImageId?: string;
  imageUrls: Record<string, string>;
  onSelect: (imageId: string) => void;
  onDelete: (imageId: string) => void;
}

const ThumbnailScroller: React.FC<ThumbnailScrollerProps> = ({
  images, currentImageId, imageUrls, onSelect, onDelete
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  
  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
    }
  };
  
  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      return () => container.removeEventListener('scroll', checkScroll);
    }
  }, [images.length]);
  
  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };
  
  if (!images || images.length === 0) return null;
  
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-slate-500">历史生成记录 ({images.length})</div>
      </div>
      <div className="relative flex items-center">
        {/* 左滑动按钮 */}
        {canScrollLeft && (
          <button
            className="absolute left-0 z-10 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            onClick={() => scroll('left')}
          >
            <ChevronLeft size={14} />
          </button>
        )}
        
        <div 
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1 mx-7"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {images.map((img, idx) => {
            const isSelected = img.id === currentImageId;
            const imgUrl = imageUrls[img.id] || img.path;
            return (
              <div 
                key={img.id} 
                className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 group ${
                  isSelected ? 'border-primary' : 'border-transparent hover:border-slate-300'
                }`}
                onClick={() => onSelect(img.id)}
              >
                <img
                  src={imgUrl}
                  alt={`生成图片 ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* 删除按钮 */}
                <button
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(img.id);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
        
        {/* 右滑动按钮 */}
        {canScrollRight && (
          <button
            className="absolute right-0 z-10 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            onClick={() => scroll('right')}
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

// 分镜状态标签
const getStatusBadge = (shot: Shot) => {
  if (shot.keyframes && shot.keyframes.length > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-400">
        <span className="w-2 h-2 rounded-full bg-green-500"></span>
        {shot.keyframes.length}个关键帧
      </span>
    );
  }
  return <span className="text-xs text-slate-500">未拆分</span>;
};

// 景别标签映射
const SHOT_TYPE_LABELS: Record<string, string> = {
  extreme_long: '极远景',
  long: '远景',
  full: '全景',
  medium: '中景',
  close_up: '近景',
  extreme_close_up: '特写',
};

interface ShotManagerProps {
  projectId?: string;
  setActiveTab?: (tab: AssetType) => void;
}

export const ShotManager: React.FC<ShotManagerProps> = ({ projectId: propProjectId, setActiveTab }) => {
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const projectId = propProjectId || urlProjectId;
  const { settings } = useApp();
  const { showToast } = useToast();
  const { openPreview } = usePreview();

  // 设置当前活动标签为分镜管理
  useEffect(() => {
    setActiveTab?.(AssetType.SHOT);
  }, [setActiveTab]);

  // 从场景名称提取场景号
  const getSceneNumber = (sceneName: string) => {
    const match = sceneName.match(/场景(\d+)/);
    return match ? match[1] : '1';
  };

  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');
  const [selectedShotId, setSelectedShotId] = useState<string>('');
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [splittingShotId, setSplittingShotId] = useState<string | null>(null);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [selectedLLMModel, setSelectedLLMModel] = useState<string>('');
  const [keyframeCount, setKeyframeCount] = useState<number>(3);
  const [selectedShotForSplit, setSelectedShotForSplit] = useState<Shot | null>(null);
  const [selectedImageModel, setSelectedImageModel] = useState<string>('');
  const [selectedResolution, setSelectedResolution] = useState<string>('1K');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('16:9');
  
  // 生图模式状态：'text-to-image' | 'reference-to-image'
  const [generationMode, setGenerationMode] = useState<'text-to-image' | 'reference-to-image'>('reference-to-image');
  
  // 存储图片URL的缓存
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  
  // 当前关键帧的参考图覆盖（用于删除参考图功能）
  const [referenceImageOverride, setReferenceImageOverride] = useState<{
    character?: boolean;
    scene?: boolean;
  }>({});

  // 参考图缩略图URL缓存
  const [referenceImageUrls, setReferenceImageUrls] = useState<{
    character?: string;
    scene?: string;
  }>({});

  // 获取当前选择的模型配置
  const selectedModelConfig = useMemo(() => {
    if (!selectedImageModel) return undefined;
    const runtimeModel = settings.models.find(m => m.id === selectedImageModel);
    const staticModel = DEFAULT_MODELS.find(m => m.id === selectedImageModel || m.modelId === runtimeModel?.modelId);
    // 合并 runtimeModel 和 staticModel，确保 provider 字段正确
    if (runtimeModel && staticModel) {
      return { ...staticModel, ...runtimeModel, provider: staticModel.provider };
    }
    return runtimeModel || staticModel;
  }, [selectedImageModel, settings.models]);

  // 计算当前模型支持的尺寸
  const availableResolutions = useMemo(() => {
    if (!selectedModelConfig) return ['1K', '2K', '4K'];
    const supported = selectedModelConfig.capabilities?.supportedResolutions;
    if (supported && supported.length > 0) return supported;
    return ['1K', '2K', '4K'];
  }, [selectedModelConfig]);

  // 当模型变化时，自动校正尺寸选择
  useEffect(() => {
    if (selectedModelConfig && selectedResolution) {
      const supported = selectedModelConfig.capabilities?.supportedResolutions || ['1K', '2K', '4K'];
      if (!supported.includes(selectedResolution)) {
        // 如果当前尺寸不被支持，切换到默认尺寸
        const defaultRes = selectedModelConfig.capabilities?.defaultResolution || supported[0] || '1K';
        setSelectedResolution(defaultRes);
      }
    }
  }, [selectedModelConfig, selectedResolution]);

  // 判断是否为火山模型
  const isVolcengineModel = useMemo(() => {
    return selectedModelConfig?.provider === 'volcengine';
  }, [selectedModelConfig]);

  // 处理生图模式切换
  const handleGenerationModeChange = (mode: 'text-to-image' | 'reference-to-image') => {
    setGenerationMode(mode);
    setReferenceImageOverride({}); // 重置参考图覆盖
    
    // 切换模式后，自动选择第一个可用模型
    const imageModels = settings.models.filter(m => m.type === 'image');
    const filtered = imageModels.filter(model => {
      // 优先使用模型配置中的 capabilities
      const supportsRef = model.capabilities?.supportsReferenceImage ?? true;
      return mode === 'reference-to-image' ? supportsRef : !supportsRef;
    });
    
    if (filtered.length > 0) {
      setSelectedImageModel(filtered[0].id);
    } else {
      setSelectedImageModel('');
    }
  };

  // 处理删除参考图
  const handleRemoveReferenceImage = (type: 'character' | 'scene') => {
    setReferenceImageOverride(prev => ({
      ...prev,
      [type]: true // 标记为已删除
    }));
  };

  // 恢复参考图
  const handleRestoreReferenceImage = (type: 'character' | 'scene') => {
    setReferenceImageOverride(prev => ({
      ...prev,
      [type]: false // 取消删除标记
    }));
  };

  // 计算最终的 size 参数
  const calculateSize = useMemo(() => {
    if (isVolcengineModel) {
      // 火山模型：使用官方推荐的尺寸映射表
      // 参考火山文档：https://www.volcengine.com/docs/82379/1541523
      const volcengineSizeMap: Record<string, Record<string, string>> = {
        '1K': {
          '1:1': '1024x1024',
          '4:3': '864x1152',
          '3:4': '1152x864',
          '16:9': '1280x720',
          '9:16': '720x1280',
          '3:2': '832x1248',
          '2:3': '1248x832',
          '21:9': '1512x648'
        },
        '2K': {
          '1:1': '2048x2048',
          '4:3': '2304x1728',
          '3:4': '1728x2304',
          '16:9': '2560x1440',
          '9:16': '1440x2560',
          '3:2': '2496x1664',
          '2:3': '1664x2496',
          '21:9': '3024x1296'
        },
        '4K': {
          '1:1': '4096x4096',
          '3:4': '3520x4704',
          '4:3': '4704x3520',
          '16:9': '5504x3040',
          '9:16': '3040x5504',
          '2:3': '3328x4992',
          '3:2': '4992x3328',
          '21:9': '6240x2656'
        }
      };
      const resolutionMap = volcengineSizeMap[selectedResolution] || volcengineSizeMap['1K'];
      return resolutionMap[selectedAspectRatio] || resolutionMap['16:9'] || '1280x720';
    } else {
      // 魔搭模型：直接使用宽高比对应的像素值
      const modelscopeSizeMap: Record<string, string> = {
        '1:1': '1024x1024',
        '4:3': '1152x864',
        '3:4': '864x1152',
        '16:9': '1280x720',
        '9:16': '720x1280',
        '3:2': '1248x832',
        '2:3': '832x1248',
        '21:9': '1512x648'
      };
      return modelscopeSizeMap[selectedAspectRatio] || '1280x720';
    }
  }, [isVolcengineModel, selectedResolution, selectedAspectRatio]);

  // 加载剧本数据
  useEffect(() => {
    const loadScripts = async () => {
      if (!projectId) {
        setIsLoading(false);
        return;
      }
      try {
        const data = await storageService.getScripts(projectId);
        setScripts(data);
        if (data.length > 0 && !selectedScriptId) {
          setSelectedScriptId(data[0].id);
        }
      } catch (error) {
        console.error('加载剧本失败:', error);
        showToast('加载剧本失败', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    loadScripts();
  }, [projectId]);

  // 订阅任务队列更新
  useEffect(() => {
    if (!projectId) return;

    const unsubscribe = jobQueue.subscribe(async (job: Job) => {
      // 只处理关键帧生图任务
      if (job.type !== 'generate_keyframe_image') return;

      // 检查是否属于当前项目的任务
      if (job.projectId !== projectId) return;

      // 检查任务是否完成或失败
      if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
        // 重新加载脚本数据
        const updatedScripts = await storageService.getScripts(projectId);
        setScripts(updatedScripts);

        // 显示提示
        if (job.status === JobStatus.COMPLETED) {
          showToast('关键帧图片生成成功', 'success');
        } else {
          showToast(`生成失败: ${job.error || '未知错误'}`, 'error');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [projectId]);

  // 当前选中的剧本
  const currentScript = useMemo(() => {
    return scripts.find(s => s.id === selectedScriptId);
  }, [scripts, selectedScriptId]);

  // 所有分镜
  const allShots = useMemo(() => {
    return currentScript?.parseState?.shots || [];
  }, [currentScript]);

  // 提取所有图片的唯一标识（id + path）
  const getImageIdentifiers = (shots: Shot[]): string[] => {
    const identifiers: string[] = [];
    shots.forEach(shot => {
      shot.keyframes?.forEach(kf => {
        if (kf.generatedImages) {
          kf.generatedImages.forEach(img => {
            if (img.path) {
              identifiers.push(`${img.id}:${img.path}`);
            }
          });
        }
        if (kf.generatedImage?.path) {
          identifiers.push(`${kf.generatedImage.id}:${kf.generatedImage.path}`);
        }
      });
    });
    return identifiers.sort();
  };

  // 使用图片标识作为依赖
  const imageIdentifiers = useMemo(() => getImageIdentifiers(allShots), [allShots]);

  // 加载图片URL - 增量加载，不清空现有URL
  useEffect(() => {
    const loadImageUrls = async () => {
      const imagesToLoad: { id: string; path: string }[] = [];

      allShots.forEach(shot => {
        shot.keyframes?.forEach(kf => {
          // 处理 generatedImages
          if (kf.generatedImages) {
            kf.generatedImages.forEach(img => {
              if (img.path && !imageUrls[img.id]) {
                // 只加载还没有 URL 的图片
                if (img.path.startsWith('http://') || img.path.startsWith('https://')) {
                  // 远程 URL 直接设置
                  setImageUrls(prev => ({ ...prev, [img.id]: img.path }));
                } else {
                  imagesToLoad.push({ id: img.id, path: img.path });
                }
              }
            });
          }
          // 处理旧的 generatedImage
          if (kf.generatedImage?.path && !imageUrls[kf.generatedImage.id]) {
            const img = kf.generatedImage;
            if (img.path.startsWith('http://') || img.path.startsWith('https://')) {
              setImageUrls(prev => ({ ...prev, [img.id]: img.path }));
            } else {
              imagesToLoad.push({ id: img.id, path: img.path });
            }
          }
        });
      });

      // 异步加载本地图片 URL
      imagesToLoad.forEach(({ id, path }) => {
        storageService.getAssetUrl(path).then(url => {
          setImageUrls(prev => ({ ...prev, [id]: url }));
        });
      });
    };

    if (allShots.length > 0) {
      loadImageUrls();
    }
    // 依赖改为 imageIdentifiers，只有图片列表真正变化时才触发
  }, [imageIdentifiers]);

  // 当前选中的分镜
  const selectedShot = useMemo(() => {
    return allShots.find(s => s.id === selectedShotId);
  }, [allShots, selectedShotId]);

  // 加载参考图缩略图URL
  useEffect(() => {
    const loadReferenceImageUrls = async () => {
      if (!selectedShot?.keyframes?.[selectedKeyframeIndex]?.references) {
        setReferenceImageUrls({});
        return;
      }

      const refs = selectedShot.keyframes[selectedKeyframeIndex].references;
      const urls: { character?: string; scene?: string } = {};

      // 加载角色图URL
      if (refs?.character?.id) {
        try {
          const assets = await storageService.getAssets(projectId);
          const charAsset = assets.find(a => a.type === AssetType.CHARACTER && a.id === refs.character!.id);
          if (charAsset?.filePath) {
            urls.character = await storageService.getAssetUrl(charAsset.filePath);
          }
        } catch (e) {
          console.error('加载角色缩略图失败:', e);
        }
      }

      // 加载场景图URL
      if (refs?.scene?.id) {
        try {
          const assets = await storageService.getAssets(projectId);
          const sceneAsset = assets.find(a => a.type === AssetType.SCENE && a.id === refs.scene!.id);
          if (sceneAsset?.filePath) {
            urls.scene = await storageService.getAssetUrl(sceneAsset.filePath);
          }
        } catch (e) {
          console.error('加载场景缩略图失败:', e);
        }
      }

      setReferenceImageUrls(urls);
    };

    loadReferenceImageUrls();
  }, [selectedShot, selectedKeyframeIndex, projectId]);

  // 默认选中第一个分镜
  useEffect(() => {
    if (allShots.length > 0 && !selectedShotId) {
      setSelectedShotId(allShots[0].id);
    }
  }, [allShots]);

  // 获取用户配置的模型
  const availableLLMModels = useMemo(() => {
    return settings.models.filter(m => m.type === 'llm');
  }, [settings.models]);

  const availableImageModels = useMemo(() => {
    return settings.models.filter(m => m.type === 'image');
  }, [settings.models]);

  // 获取模型能力的辅助函数
  const getModelCapabilities = useMemo(() => {
    return (model: ModelConfig) => {
      // 优先使用模型配置中的 capabilities（用户自定义配置）
      if (model.capabilities && typeof model.capabilities.supportsReferenceImage === 'boolean') {
        return {
          supportsReferenceImage: model.capabilities.supportsReferenceImage,
          maxReferenceImages: model.capabilities.maxReferenceImages ?? 5
        };
      }
      
      // 如果模型没有配置 capabilities，尝试从 DEFAULT_MODELS 查找
      let defaultModel = DEFAULT_MODELS.find(m => m.modelId === model.modelId);
      if (!defaultModel) {
        defaultModel = DEFAULT_MODELS.find(m => m.id === model.id);
      }
      if (!defaultModel) {
        defaultModel = DEFAULT_MODELS.find(m => 
          m.provider === model.provider && m.type === model.type
        );
      }
      
      // 返回能力配置，如果找不到则默认支持参考图（为了兼容性）
      return {
        supportsReferenceImage: defaultModel?.capabilities?.supportsReferenceImage ?? true,
        maxReferenceImages: defaultModel?.capabilities?.maxReferenceImages ?? 5
      };
    };
  }, []);

  // 根据生图模式过滤可用模型
  const filteredImageModels = useMemo(() => {
    return availableImageModels.filter(model => {
      const capabilities = getModelCapabilities(model);
      const supportsRef = capabilities.supportsReferenceImage ?? true;
      
      if (generationMode === 'reference-to-image') {
        return supportsRef; // 参考图模式：只显示支持参考图的模型
      } else {
        return !supportsRef; // 文生图模式：只显示不支持参考图的模型
      }
    });
  }, [availableImageModels, generationMode, getModelCapabilities]);

  // 打开拆分关键帧弹窗
  const handleOpenSplitModal = (shot: Shot) => {
    if (!projectId || !currentScript) return;
    
    if (availableLLMModels.length === 0) {
      showToast('请先在设置中配置LLM模型', 'error');
      return;
    }

    setSelectedShotForSplit(shot);
    setSelectedLLMModel('');
    setKeyframeCount(3);
    setIsSplitModalOpen(true);
  };

  // 确认拆分关键帧
  const confirmSplitKeyframes = async () => {
    console.log('[ShotManager] 开始拆分关键帧...');
    console.log('[ShotManager] projectId:', projectId);
    console.log('[ShotManager] currentScript:', currentScript?.id);
    console.log('[ShotManager] selectedShotForSplit:', selectedShotForSplit?.id);
    console.log('[ShotManager] selectedLLMModel:', selectedLLMModel);

    if (!projectId || !currentScript || !selectedShotForSplit || !selectedLLMModel) {
      console.error('[ShotManager] 缺少必要参数:', { projectId, currentScript: !!currentScript, selectedShotForSplit: !!selectedShotForSplit, selectedLLMModel });
      showToast('缺少必要参数，请检查选择', 'error');
      return;
    }

    // 验证模型配置
    const selectedModel = availableLLMModels.find(m => m.id === selectedLLMModel);
    console.log('[ShotManager] 选择的模型配置:', selectedModel);
    if (!selectedModel) {
      console.error('[ShotManager] 找不到模型配置:', selectedLLMModel);
      showToast('找不到模型配置，请重新选择模型', 'error');
      return;
    }
    if (!selectedModel.apiKey) {
      console.error('[ShotManager] 模型未配置 API Key:', selectedModel.id);
      showToast('模型未配置 API Key，请在设置中配置', 'error');
      return;
    }
    if (!selectedModel.modelId) {
      console.error('[ShotManager] 模型未配置 modelId:', selectedModel.id);
      showToast('模型配置不完整，请在设置中检查', 'error');
      return;
    }

    setIsSplitModalOpen(false);
    setSplittingShotId(selectedShotForSplit.id);
    
    try {
      console.log('[ShotManager] 调用 keyframeService.splitKeyframes...');
      
      // 获取角色和场景资产用于关键帧拆分
      const assets = await storageService.getAssets(projectId);
      const characterAssets = selectedShotForSplit.characters
        ?.map(charName => assets.find(a => a.type === AssetType.CHARACTER && a.name === charName))
        .filter((a): a is CharacterAsset => !!a) || [];
      const sceneAsset = assets.find(a => a.type === AssetType.SCENE && a.name === selectedShotForSplit.sceneName);
      
      console.log('[ShotManager] 拆分关键帧时找到的角色资产:', characterAssets.map(c => ({ id: c.id, name: c.name })));
      console.log('[ShotManager] 拆分关键帧时找到的场景资产:', sceneAsset ? { id: sceneAsset.id, name: sceneAsset.name } : null);
      
      const keyframes = await keyframeService.splitKeyframes({
        shot: selectedShotForSplit,
        keyframeCount: keyframeCount,
        projectId,
        modelConfigId: selectedLLMModel,
        characterAssets: characterAssets.length > 0 ? characterAssets : undefined,
        sceneAsset: sceneAsset
      });
      console.log('[ShotManager] 拆分成功，关键帧数量:', keyframes.length);

      // 更新shot的keyframes
      const updatedShot = { ...selectedShotForSplit, keyframes };

      // 更新剧本数据
      const updatedShots = allShots.map(s => s.id === selectedShotForSplit.id ? updatedShot : s);
      const updatedScript = {
        ...currentScript,
        parseState: {
          ...currentScript.parseState,
          shots: updatedShots
        }
      };
      
      await storageService.saveScript(updatedScript);
      setScripts(scripts.map(s => s.id === updatedScript.id ? updatedScript : s));
      showToast('关键帧拆分成功', 'success');
    } catch (error: any) {
      console.error('[ShotManager] 拆分关键帧失败:', error);
      console.error('[ShotManager] 错误详情:', error.message, error.stack);
      showToast(`拆分关键帧失败: ${error.message || '未知错误'}`, 'error');
    } finally {
      setSplittingShotId(null);
      setSelectedShotForSplit(null);
    }
  };

  // 生成关键帧图片
  const handleGenerateImage = async (keyframeIndex: number) => {
    if (!projectId || !selectedShot || !currentScript) return;

    if (availableImageModels.length === 0) {
      showToast('请先在设置中配置生图模型', 'error');
      return;
    }

    if (!selectedImageModel) {
      showToast('请先选择生图模型', 'error');
      return;
    }

    const kf = selectedShot.keyframes?.[keyframeIndex];
    if (!kf) return;

    // 立即设置 keyframe 状态为 generating
    const updatedKeyframes = [...(selectedShot.keyframes || [])];
    updatedKeyframes[keyframeIndex] = { ...kf, status: 'generating' };
    const updatedShot = { ...selectedShot, keyframes: updatedKeyframes };
    const updatedShots = allShots.map(s => s.id === selectedShot.id ? updatedShot : s);
    const updatedScript = {
      ...currentScript,
      parseState: {
        ...currentScript.parseState,
        shots: updatedShots
      }
    };
    await storageService.saveScript(updatedScript);
    setScripts(scripts.map(s => s.id === updatedScript.id ? updatedScript : s));

    // 获取参考图
    const assets = await storageService.getAssets(projectId);
    
    // 诊断日志：打印 references 信息
    console.log('[ShotManager] kf.references:', JSON.stringify(kf.references, null, 2));
    console.log('[ShotManager] 所有角色资产:', assets.filter(a => a.type === AssetType.CHARACTER).map(a => ({ id: a.id, name: a.name })));
    console.log('[ShotManager] 所有场景资产:', assets.filter(a => a.type === AssetType.SCENE).map(a => ({ id: a.id, name: a.name })));
    
    // 首先尝试用 name 查找，如果失败则尝试用 id 查找
    let characterAsset: CharacterAsset | undefined;
    if (kf.references?.character) {
      // 先用 name 查找
      characterAsset = assets.find(a => a.type === AssetType.CHARACTER && a.name === kf.references.character.name) as CharacterAsset;
      // 如果失败，用 id 查找
      if (!characterAsset && kf.references.character.id) {
        characterAsset = assets.find(a => a.type === AssetType.CHARACTER && a.id === kf.references.character.id) as CharacterAsset;
        console.log('[ShotManager] 用 id 查找角色资产:', !!characterAsset);
      }
    }
    
    let sceneAsset: Asset | undefined;
    if (kf.references?.scene) {
      // 先用 name 查找
      sceneAsset = assets.find(a => a.type === AssetType.SCENE && a.name === kf.references.scene.name);
      // 如果失败，用 id 查找
      if (!sceneAsset && kf.references.scene.id) {
        sceneAsset = assets.find(a => a.type === AssetType.SCENE && a.id === kf.references.scene.id);
        console.log('[ShotManager] 用 id 查找场景资产:', !!sceneAsset);
      }
    }

    console.log('[ShotManager] characterAsset found:', !!characterAsset);
    console.log('[ShotManager] sceneAsset found:', !!sceneAsset);

    // 准备参考图 base64
    const referenceImages: string[] = [];

    const imageToBase64 = async (filePath: string): Promise<string> => {
      const file = await storageService.getFile(filePath);
      if (!file) throw new Error(`文件不存在: ${filePath}`);
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);
      const ext = filePath.split('.').pop()?.toLowerCase() || 'png';
      return `data:image/${ext};base64,${base64}`;
    };

    // 根据生图模式和用户覆盖设置决定是否使用参考图
    const useCharacterRef = generationMode === 'reference-to-image' && !referenceImageOverride.character && characterAsset?.currentImageId;
    const useSceneRef = generationMode === 'reference-to-image' && !referenceImageOverride.scene && sceneAsset?.filePath;

    if (useCharacterRef) {
      const charImage = characterAsset.generatedImages?.find(img => img.id === characterAsset.currentImageId);
      if (charImage?.path) {
        try {
          const base64 = await imageToBase64(charImage.path);
          referenceImages.push(base64);
          console.log('[ShotManager] 已添加角色参考图');
        } catch (e) {
          console.error('读取角色图失败:', e);
        }
      }
    }

    if (useSceneRef) {
      try {
        const base64 = await imageToBase64(sceneAsset.filePath);
        referenceImages.push(base64);
        console.log('[ShotManager] 已添加场景参考图');
      } catch (e) {
        console.error('读取场景图失败:', e);
      }
    }
    
    console.log('[ShotManager] 生图模式:', generationMode);
    console.log('[ShotManager] 参考图覆盖设置:', referenceImageOverride);

    console.log('[ShotManager] referenceImages count:', referenceImages.length);
    if (referenceImages.length > 0) {
      console.log('[ShotManager] first image preview:', referenceImages[0].substring(0, 50));
    }
    console.log('[ShotManager] full referenceImages:', referenceImages);

    // 创建并提交任务
    const job = aiService.createKeyframeGenerationJob({
      projectId,
      scriptId: currentScript.id,
      shotId: selectedShot.id,
      keyframeId: kf.id,
      prompt: kf.prompt,
      userPrompt: kf.description,
      assetName: `${selectedShot.sceneName}-镜头${selectedShot.sequence}-关键帧${kf.sequence}`,
      modelConfigId: selectedImageModel,
      referenceImages,
      resolution: calculateSize,
      aspectRatio: selectedAspectRatio
    });

    await jobQueue.addJob(job);
    showToast('关键帧生图任务已添加到队列', 'success');
  };

  // 更新提示词
  const handleUpdatePrompt = (keyframeIndex: number, newPrompt: string) => {
    if (!selectedShot || !currentScript || !projectId) return;
    
    const updatedKeyframes = [...(selectedShot.keyframes || [])];
    updatedKeyframes[keyframeIndex] = {
      ...updatedKeyframes[keyframeIndex],
      prompt: newPrompt
    };
    
    const updatedShot = { ...selectedShot, keyframes: updatedKeyframes };
    const updatedShots = allShots.map(s => s.id === selectedShot.id ? updatedShot : s);
    const updatedScript = {
      ...currentScript,
      parseState: {
        ...currentScript.parseState,
        shots: updatedShots
      }
    };
    
    storageService.saveScript(updatedScript);
    setScripts(scripts.map(s => s.id === updatedScript.id ? updatedScript : s));
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Progress size="sm" isIndeterminate aria-label="加载中..." />
      </div>
    );
  }

  if (!currentScript) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card>
          <CardBody className="py-12 text-center">
            <Film size={48} className="mx-auto text-default-300 mb-4" />
            <p className="text-default-500">暂无剧本数据</p>
            <p className="text-xs text-default-400 mt-2">请先在剧本管理中导入并解析剧本</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* 头部 */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              分镜管理
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {currentScript.title} · 共 {allShots.length} 个分镜
            </p>
          </div>
          {scripts.length > 1 && (
            <select
              value={selectedScriptId}
              onChange={(e) => setSelectedScriptId(e.target.value)}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm"
            >
              {scripts.map(script => (
                <option key={script.id} value={script.id}>{script.title}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：分镜列表 */}
        <aside className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">分镜列表</h2>
            <div className="flex gap-3 text-xs mt-2">
              <span className="flex items-center gap-1 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>已拆分
              </span>
              <span className="flex items-center gap-1 text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-400"></span>未拆分
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {allShots.map((shot) => (
              <div
                key={shot.id}
                onClick={() => {
                  setSelectedShotId(shot.id);
                  setSelectedKeyframeIndex(0);
                  setReferenceImageOverride({}); // 切换分镜时重置参考图覆盖
                }}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedShotId === shot.id
                    ? 'border-primary bg-primary/10 dark:bg-primary/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">
                      {getSceneNumber(shot.sceneName)}-{shot.sequence}
                    </span>
                    <Chip size="sm" variant="flat">
                      {SHOT_TYPE_LABELS[shot.shotType] || shot.shotType}
                    </Chip>
                  </div>
                  {getStatusBadge(shot)}
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 mb-2">
                  {shot.description}
                </p>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {shot.duration}s
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {shot.characters?.join(', ') || '无角色'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* 右侧：关键帧详情 */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6">
          {selectedShot ? (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* 分镜信息卡片 */}
              <Card>
                <CardBody className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                        {String(selectedShot.sequence).padStart(3, '0')}
                      </span>
                      <div>
                        <h2 className="font-semibold text-slate-900 dark:text-white">
                          {selectedShot.sceneName}
                        </h2>
                        <p className="text-sm text-slate-500">{selectedShot.description}</p>
                      </div>
                    </div>
                    {selectedShot.keyframes ? (
                      <div className="flex items-center gap-2">
                        <Chip color="success" variant="flat">
                          <span className="flex items-center gap-1">
                            <Scissors size={14} />
                            已拆分
                          </span>
                        </Chip>
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => handleOpenSplitModal(selectedShot)}
                          isLoading={splittingShotId === selectedShot.id}
                        >
                          重新拆分
                        </Button>
                      </div>
                    ) : (
                      <Button
                        color="primary"
                        size="sm"
                        onPress={() => handleOpenSplitModal(selectedShot)}
                        isLoading={splittingShotId === selectedShot.id}
                        isDisabled={availableLLMModels.length === 0}
                      >
                        <Scissors size={16} className="mr-1" />
                        拆分关键帧
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Camera size={14} />
                      {SHOT_TYPE_LABELS[selectedShot.shotType] || selectedShot.shotType}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {selectedShot.duration}秒
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {selectedShot.sceneName}
                    </span>
                  </div>
                </CardBody>
              </Card>

              {/* 关键帧内容 */}
              {selectedShot.keyframes && selectedShot.keyframes.length > 0 ? (
                <>
                  {/* 关键帧切换标签 */}
                  <div className="flex items-center gap-2">
                    {selectedShot.keyframes.map((kf, idx) => (
                      <Button
                        key={kf.id}
                        size="sm"
                        color={selectedKeyframeIndex === idx ? 'primary' : 'default'}
                        variant={selectedKeyframeIndex === idx ? 'solid' : 'flat'}
                        onPress={() => {
                          setSelectedKeyframeIndex(idx);
                          setReferenceImageOverride({}); // 切换关键帧时重置参考图覆盖
                        }}
                      >
                        关键帧 {idx + 1}
                        <span className="text-xs opacity-70 ml-1">{kf.duration}s</span>
                      </Button>
                    ))}
                  </div>

                  {/* 当前关键帧详情 */}
                  {selectedShot.keyframes[selectedKeyframeIndex] && (
                    <Card>
                      <CardBody className="p-6">
                        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(400px,0.8fr)] gap-6">
                          {/* 左侧：图片和描述 */}
                          <div className="space-y-4">
                            {/* 图片预览区 - 显示当前选中的图片 */}
                            {(() => {
                              const kf = selectedShot.keyframes[selectedKeyframeIndex];
                              const currentImage = kf.generatedImages?.find(img => img.id === kf.currentImageId) || 
                                                   kf.generatedImage;
                              // 获取图片URL（优先使用缓存的URL）
                              const imageUrl = currentImage ? (imageUrls[currentImage.id] || currentImage.path) : null;
                              
                              return (
                                <div 
                                  className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden cursor-pointer group"
                                  onClick={() => {
                                    if (kf.generatedImages && kf.generatedImages.length > 0) {
                                      const slides = kf.generatedImages.map(img => ({ src: imageUrls[img.id] || img.path }));
                                      const currentIdx = kf.generatedImages.findIndex(img => img.id === kf.currentImageId);
                                      openPreview(slides, currentIdx >= 0 ? currentIdx : 0);
                                    } else if (currentImage) {
                                      openPreview([{ src: imageUrls[currentImage.id] || currentImage.path }]);
                                    }
                                  }}
                                >
                                  {currentImage && imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt="关键帧"
                                      className="w-full h-full object-cover rounded-lg"
                                    />
                                  ) : (
                                    <div className="text-center">
                                      <Camera size={48} className="mx-auto mb-2 text-slate-400" />
                                      <p className="text-sm text-slate-500">关键帧预览图</p>
                                      <p className="text-xs text-slate-400 mt-1">（通过提示词生成）</p>
                                    </div>
                                  )}
                                  <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                                    {selectedKeyframeIndex + 1} / {selectedShot.keyframes.length}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* 历史图片横向滚动 */}
                            {(() => {
                              const kf = selectedShot.keyframes[selectedKeyframeIndex];
                              const hasImages = kf.generatedImages && kf.generatedImages.length > 0;
                              
                              if (!hasImages) return null;
                              
                              const handleDeleteImage = (imgId: string) => {
                                if (!confirm('确定要删除这张图片吗？')) return;
                                
                                const updatedImages = kf.generatedImages!.filter(img => img.id !== imgId);
                                const newCurrentId = updatedImages.length > 0 
                                  ? (kf.currentImageId === imgId ? updatedImages[0].id : kf.currentImageId)
                                  : undefined;
                                
                                const updatedKeyframes = [...selectedShot.keyframes!];
                                updatedKeyframes[selectedKeyframeIndex] = {
                                  ...kf,
                                  generatedImages: updatedImages,
                                  currentImageId: newCurrentId,
                                  generatedImage: updatedImages.length > 0 ? updatedImages[updatedImages.length - 1] : undefined
                                };
                                const updatedShot = { ...selectedShot, keyframes: updatedKeyframes };
                                const updatedShots = allShots.map(s => s.id === selectedShot.id ? updatedShot : s);
                                const updatedScript = {
                                  ...currentScript!,
                                  parseState: {
                                    ...currentScript!.parseState,
                                    shots: updatedShots
                                  }
                                };
                                storageService.saveScript(updatedScript);
                                setScripts(scripts.map(s => s.id === updatedScript.id ? updatedScript : s));
                              };
                              
                              const handleSelectImage = (imgId: string) => {
                                const updatedKeyframes = [...selectedShot.keyframes!];
                                updatedKeyframes[selectedKeyframeIndex] = {
                                  ...kf,
                                  currentImageId: imgId
                                };
                                const updatedShot = { ...selectedShot, keyframes: updatedKeyframes };
                                const updatedShots = allShots.map(s => s.id === selectedShot.id ? updatedShot : s);
                                const updatedScript = {
                                  ...currentScript!,
                                  parseState: {
                                    ...currentScript!.parseState,
                                    shots: updatedShots
                                  }
                                };
                                storageService.saveScript(updatedScript);
                                setScripts(scripts.map(s => s.id === updatedScript.id ? updatedScript : s));
                              };
                              
                              return (
                                <ThumbnailScroller
                                  images={kf.generatedImages!}
                                  currentImageId={kf.currentImageId}
                                  imageUrls={imageUrls}
                                  onSelect={handleSelectImage}
                                  onDelete={handleDeleteImage}
                                />
                              );
                            })()}

                            {/* 静态描述 */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                              <div className="text-xs text-slate-500 mb-1">静态画面描述</div>
                              <p className="text-sm text-slate-700 dark:text-slate-300">
                                {selectedShot.keyframes[selectedKeyframeIndex].description}
                              </p>
                            </div>
                          </div>

                          {/* 右侧：提示词和操作 */}
                          <div className="space-y-4">
                            {/* 关联资产 */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                              <div className="text-xs text-slate-500 mb-2">关联资产</div>
                              <div className="space-y-2">
                                {selectedShot.characters?.map((char, i) => (
                                  <div key={i} className="flex items-center gap-2 text-sm">
                                    <Users size={16} className="text-primary" />
                                    <span className="text-slate-700 dark:text-slate-300">{char}</span>
                                  </div>
                                ))}
                                <div className="flex items-center gap-2 text-sm">
                                  <MapPin size={16} className="text-green-500" />
                                  <span className="text-slate-700 dark:text-slate-300">{selectedShot.sceneName}</span>
                                </div>
                              </div>
                            </div>

                            {/* AI提示词 */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-xs text-slate-500">图生图提示词</div>
                                <Button
                                  size="sm"
                                  variant="flat"
                                  onPress={() => {
                                    navigator.clipboard.writeText(
                                      selectedShot.keyframes![selectedKeyframeIndex].prompt
                                    );
                                    showToast('提示词已复制', 'success');
                                  }}
                                >
                                  复制
                                </Button>
                              </div>
                              <textarea
                                value={selectedShot.keyframes[selectedKeyframeIndex].prompt}
                                onChange={(e) => handleUpdatePrompt(selectedKeyframeIndex, e.target.value)}
                                className="w-full h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 resize-none focus:outline-none focus:border-primary"
                              />

                              {/* 生图模式切换标签 */}
                              <div className="mt-3">
                                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                                  <button
                                    className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
                                      generationMode === 'text-to-image'
                                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                    onClick={() => handleGenerationModeChange('text-to-image')}
                                  >
                                    文生图
                                  </button>
                                  <button
                                    className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all ${
                                      generationMode === 'reference-to-image'
                                        ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                                    onClick={() => handleGenerationModeChange('reference-to-image')}
                                  >
                                    参考图生图
                                  </button>
                                </div>
                              </div>

                              {/* 参考图管理区域（仅在参考图生图模式显示） */}
                              {generationMode === 'reference-to-image' && selectedShot.keyframes[selectedKeyframeIndex].references && (
                                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                  <div className="text-xs text-slate-500 mb-2">参考图</div>
                                  <div className="flex gap-3">
                                    {/* 角色参考图 */}
                                    {selectedShot.keyframes[selectedKeyframeIndex].references.character && !referenceImageOverride.character && (
                                      <div className="relative group">
                                        <div className="w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                                          {referenceImageUrls.character ? (
                                            <img 
                                              src={referenceImageUrls.character} 
                                              alt={selectedShot.keyframes[selectedKeyframeIndex].references.character.name}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <span className="text-xs text-slate-500">角色</span>
                                          )}
                                        </div>
                                        <button
                                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() => handleRemoveReferenceImage('character')}
                                          title="删除角色参考图"
                                        >
                                          ×
                                        </button>
                                        <div className="text-xs text-slate-500 mt-1 text-center truncate w-16">
                                          {selectedShot.keyframes[selectedKeyframeIndex].references.character.name}
                                        </div>
                                      </div>
                                    )}
                                    {referenceImageOverride.character && (
                                      <div className="relative">
                                        <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                                          <span className="text-xs text-slate-400">已删除</span>
                                        </div>
                                        <button
                                          className="mt-1 text-xs text-primary hover:text-primary-700"
                                          onClick={() => handleRestoreReferenceImage('character')}
                                        >
                                          恢复
                                        </button>
                                      </div>
                                    )}

                                    {/* 场景参考图 */}
                                    {selectedShot.keyframes[selectedKeyframeIndex].references.scene && !referenceImageOverride.scene && (
                                      <div className="relative group">
                                        <div className="w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                                          {referenceImageUrls.scene ? (
                                            <img 
                                              src={referenceImageUrls.scene} 
                                              alt={selectedShot.keyframes[selectedKeyframeIndex].references.scene.name}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <span className="text-xs text-slate-500">场景</span>
                                          )}
                                        </div>
                                        <button
                                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() => handleRemoveReferenceImage('scene')}
                                          title="删除场景参考图"
                                        >
                                          ×
                                        </button>
                                        <div className="text-xs text-slate-500 mt-1 text-center truncate w-16">
                                          {selectedShot.keyframes[selectedKeyframeIndex].references.scene.name}
                                        </div>
                                      </div>
                                    )}
                                    {referenceImageOverride.scene && (
                                      <div className="relative">
                                        <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                                          <span className="text-xs text-slate-400">已删除</span>
                                        </div>
                                        <button
                                          className="mt-1 text-xs text-primary hover:text-primary-700"
                                          onClick={() => handleRestoreReferenceImage('scene')}
                                        >
                                          恢复
                                        </button>
                                      </div>
                                    )}

                                    {/* 无参考图提示 */}
                                    {!selectedShot.keyframes[selectedKeyframeIndex].references.character &&
                                     !selectedShot.keyframes[selectedKeyframeIndex].references.scene && (
                                      <div className="text-xs text-slate-400 py-2">
                                        该关键帧未关联角色或场景
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* 选择生图模型 */}
                              <div className="mt-3">
                                <label className="text-xs text-slate-500 mb-1 block">
                                  选择生图模型
                                  {generationMode === 'reference-to-image' && (
                                    <span className="text-primary ml-1">(支持参考图)</span>
                                  )}
                                  {generationMode === 'text-to-image' && (
                                    <span className="text-green-500 ml-1">(文生图)</span>
                                  )}
                                </label>
                                <Select
                                  aria-label="选择生图模型"
                                  placeholder={filteredImageModels.length > 0 ? "选择用于生成图片的模型" : "请先在设置中配置生图模型"}
                                  selectedKeys={selectedImageModel ? [selectedImageModel] : []}
                                  onChange={(e) => setSelectedImageModel(e.target.value)}
                                  isDisabled={filteredImageModels.length === 0}
                                  size="sm"
                                  className="w-full"
                                >
                                  {filteredImageModels.map(model => (
                                    <SelectItem key={model.id} value={model.id}>
                                      {model.name}
                                    </SelectItem>
                                  ))}
                                </Select>
                                {filteredImageModels.length === 0 && (
                                  <p className="text-xs text-danger mt-1">
                                    {generationMode === 'reference-to-image'
                                      ? '未配置支持参考图的生图模型，请先在设置中添加'
                                      : '未配置文生图模型，请先在设置中添加'}
                                  </p>
                                )}
                              </div>

                              {/* 火山模型：分辨率选择 */}
                              {isVolcengineModel && (
                                <div className="mt-3">
                                  <label className="text-xs text-slate-500 mb-1 block">分辨率</label>
                                  <Select
                                    aria-label="选择分辨率"
                                    placeholder="选择分辨率"
                                    selectedKeys={[selectedResolution]}
                                    onChange={(e) => setSelectedResolution(e.target.value)}
                                    size="sm"
                                    className="w-full"
                                  >
                                    <SelectItem key="1K" value="1K">1K</SelectItem>
                                    <SelectItem key="2K" value="2K">2K</SelectItem>
                                    <SelectItem key="4K" value="4K">4K</SelectItem>
                                  </Select>
                                </div>
                              )}

                              {/* 宽高比选择（火山和魔搭都显示） */}
                              <div className="mt-3">
                                <label className="text-xs text-slate-500 mb-1 block">宽高比</label>
                                <Select
                                  aria-label="选择宽高比"
                                  placeholder="选择宽高比"
                                  selectedKeys={[selectedAspectRatio]}
                                  onChange={(e) => setSelectedAspectRatio(e.target.value)}
                                  size="sm"
                                  className="w-full"
                                >
                                  <SelectItem key="1:1" value="1:1">1:1</SelectItem>
                                  <SelectItem key="4:3" value="4:3">4:3</SelectItem>
                                  <SelectItem key="3:4" value="3:4">3:4</SelectItem>
                                  <SelectItem key="16:9" value="16:9">16:9</SelectItem>
                                  <SelectItem key="9:16" value="9:16">9:16</SelectItem>
                                  <SelectItem key="3:2" value="3:2">3:2</SelectItem>
                                  <SelectItem key="2:3" value="2:3">2:3</SelectItem>
                                  <SelectItem key="21:9" value="21:9">21:9</SelectItem>
                                </Select>
                                <p className="text-xs text-slate-400 mt-1">
                                  输出尺寸: {calculateSize}
                                </p>
                              </div>

                              <div className="flex gap-2 mt-3">
                                <Button
                                  color="primary"
                                  className="flex-1"
                                  isDisabled={filteredImageModels.length === 0 || !selectedImageModel}
                                  isLoading={selectedShot.keyframes[selectedKeyframeIndex].status === 'generating'}
                                  onPress={() => handleGenerateImage(selectedKeyframeIndex)}
                                >
                                  <Camera size={16} className="mr-2" />
                                  {generationMode === 'reference-to-image' ? '参考图生图' : '文生图'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  )}
                </>
              ) : (
                /* 未拆分状态 */
                <Card>
                  <CardBody className="p-12 text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Scissors size={32} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                      该分镜尚未拆分关键帧
                    </h3>
                    <p className="text-slate-500 mb-6 max-w-md mx-auto">
                      使用AI大模型将此分镜的动态描述拆分为2-4个连贯的静态关键帧，并生成对应的图生图提示词
                    </p>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 mb-6 text-left max-w-lg mx-auto">
                      <div className="text-xs text-slate-500 mb-1">分镜描述</div>
                      <div className="text-sm text-slate-700 dark:text-slate-300">{selectedShot.description}</div>
                      <div className="mt-3 flex gap-4 text-xs">
                        <span className="text-slate-500">角色：{selectedShot.characters?.join(', ') || '无'}</span>
                        <span className="text-slate-500">场景：{selectedShot.sceneName}</span>
                      </div>
                    </div>
                    {availableLLMModels.length === 0 ? (
                      <div className="text-center">
                        <AlertCircle size={24} className="mx-auto text-warning mb-2" />
                        <p className="text-sm text-warning">未配置LLM模型，请先在设置中添加</p>
                      </div>
                    ) : (
                      <Button
                        color="primary"
                        size="lg"
                        onPress={() => handleOpenSplitModal(selectedShot)}
                        isLoading={splittingShotId === selectedShot.id}
                      >
                        <Scissors size={18} className="mr-2" />
                        拆分关键帧
                      </Button>
                    )}
                  </CardBody>
                </Card>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-slate-500">请选择左侧分镜查看详情</p>
            </div>
          )}
        </main>
      </div>

      {/* 拆分关键帧弹窗 */}
      <Modal isOpen={isSplitModalOpen} onClose={() => setIsSplitModalOpen(false)} size="sm">
        <ModalContent>
          <ModalHeader>拆分关键帧</ModalHeader>
          <ModalBody>
            {selectedShotForSplit && (
              <>
                <div className="mb-4">
                  <p className="text-sm font-medium">{selectedShotForSplit.sceneName}</p>
                  <p className="text-xs text-default-500">镜头 #{selectedShotForSplit.sequence}</p>
                </div>

                {/* 选择LLM模型 */}
                <div className="mb-4">
                  <label className="text-sm font-medium mb-2 block">选择拆分模型</label>
                  <Select
                    aria-label="选择LLM模型"
                    label="LLM模型"
                    placeholder={availableLLMModels.length > 0 ? "选择用于拆分关键帧的模型" : "请先在设置中配置LLM模型"}
                    selectedKeys={selectedLLMModel ? [selectedLLMModel] : []}
                    onChange={(e) => setSelectedLLMModel(e.target.value)}
                    isDisabled={availableLLMModels.length === 0}
                  >
                    {availableLLMModels.map(model => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </Select>
                  {availableLLMModels.length === 0 ? (
                    <p className="text-xs text-danger mt-1">
                      未配置LLM模型，请先在设置中添加模型
                    </p>
                  ) : (
                    <p className="text-xs text-default-500 mt-1">
                      选择不同的模型会影响拆分质量和速度
                    </p>
                  )}
                </div>

                {/* 选择关键帧数量 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">关键帧数量</label>
                  <Select
                    label="数量"
                    selectedKeys={[keyframeCount.toString()]}
                    onChange={(e) => setKeyframeCount(parseInt(e.target.value))}
                  >
                    <SelectItem key="2" value="2">2个关键帧</SelectItem>
                    <SelectItem key="3" value="3">3个关键帧（推荐）</SelectItem>
                    <SelectItem key="4" value="4">4个关键帧</SelectItem>
                    <SelectItem key="5" value="5">5个关键帧</SelectItem>
                  </Select>
                </div>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsSplitModalOpen(false)}>
              取消
            </Button>
            <Button
              color="primary"
              isDisabled={!selectedLLMModel}
              onPress={confirmSplitKeyframes}
            >
              开始拆分
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default ShotManager;
