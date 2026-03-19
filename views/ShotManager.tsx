import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Script,
  Shot,
  Keyframe,
  ScriptScene,
  CharacterAsset,
  Asset,
  AssetType,
  ModelConfig,
  GeneratedImage,
  Job,
  JobStatus,
} from '../types';
import { storageService } from '../services/storage';
import { useApp } from '../contexts/context';
import { useToast } from '../contexts/ToastContext';
import { usePreview } from '../components/PreviewProvider';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Badge,
  Progress,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Input,
  Textarea,
} from '@heroui/react';
import {
  Camera,
  Film,
  Clock,
  Users,
  MapPin,
  Scissors,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Video,
  Play,
  Film as FilmIcon,
  Plus,
  Copy,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { keyframeService, keyframeEngine } from '../services/keyframe';
import { videoGenerationService } from '../services/video';
import { jobQueue } from '../services/queue';
import { aiService } from '../services/aiService';
import { DEFAULT_MODELS } from '../config/models';
import { generateShotNumbers } from '../services/utils/shotNumberGenerator';

// 分镜项组件
interface ShotItemProps {
  shot: Shot;
  isActive: boolean;
  onSelect: (shot: Shot) => void;
  isBatchMode: boolean;
  isSelected: boolean;
  onToggleSelection: (shotId: string) => void;
}

const ShotItem: React.FC<ShotItemProps> = ({ 
  shot, 
  isActive, 
  onSelect, 
  isBatchMode, 
  isSelected, 
  onToggleSelection 
}) => {
  const contentType = keyframeEngine.detectShotType(shot.description, shot.cameraMovement);
  const hasKeyframes = shot.keyframes && shot.keyframes.length > 0;
  const hasImages = shot.keyframes?.some(kf => 
    kf.generatedImages?.length > 0 || kf.generatedImage
  );

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
        isActive 
          ? 'bg-slate-800 border border-orange-500' 
          : isSelected 
          ? 'bg-slate-800/50 border border-orange-500/50' 
          : 'hover:bg-slate-800/30 border border-transparent'
      }`}
      onClick={() => onSelect(shot)}
    >
      {isBatchMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection(shot.id);
          }}
          className="w-4 h-4 rounded border-gray-500 text-orange-500 focus:ring-orange-500"
        />
      )}
      <div className="w-12 h-9 rounded-md bg-slate-700 overflow-hidden flex-shrink-0">
        {hasImages ? (
          <div className="w-full h-full bg-slate-600 flex items-center justify-center">
            <ImageIcon size={16} className="text-slate-400" />
          </div>
        ) : (
          <div className="w-full h-full bg-slate-700 flex items-center justify-center">
            <Camera size={16} className="text-slate-500" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-orange-500">
            {shot.shotNumber || shot.sequence}
          </span>
          <span className="text-xs font-medium text-slate-300 truncate">
            {shot.sceneName}
          </span>
        </div>
        <div className="text-xs text-slate-400 mt-1 truncate">
          {shot.description}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-slate-500">
            {shot.duration}s
          </span>
          {hasKeyframes ? (
            <span className="text-xs text-green-400">
              ✓ {shot.keyframes.length}关键帧
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              ○ 未拆分
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// 历史图片项组件
interface HistoryItemProps {
  image: GeneratedImage;
  isActive: boolean;
  imageUrl: string;
  onSelect: (imageId: string) => void;
  onDelete: (imageId: string) => void;
  index: number;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ 
  image, 
  isActive, 
  imageUrl, 
  onSelect, 
  onDelete, 
  index 
}) => {
  return (
    <div
      className={`relative w-16 h-12 rounded-md overflow-hidden cursor-pointer border-2 transition-all duration-200 ${
        isActive ? 'border-orange-500' : 'border-transparent hover:border-slate-600'
      }`}
      onClick={() => onSelect(image.id)}
    >
      <img 
        src={imageUrl || image.path} 
        alt={`历史图片 ${index + 1}`} 
        className="w-full h-full object-cover"
      />
      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
        V{index + 1}
      </div>
      <button
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(image.id);
        }}
        title="删除图片"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};

// 角色项组件
interface CharacterItemProps {
  character: string;
  characterAsset?: CharacterAsset;
  imageUrl: string;
}

const CharacterItem: React.FC<CharacterItemProps> = ({ 
  character, 
  characterAsset, 
  imageUrl 
}) => {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
      <div className="w-9 h-9 rounded-full bg-slate-700 overflow-hidden">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={character} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-slate-700 flex items-center justify-center">
            <Users size={18} className="text-slate-500" />
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-white">
          {character}
        </div>
        <div className="text-xs text-slate-400">
          {characterAsset?.description || '角色'}
        </div>
      </div>
    </div>
  );
};

// 场景信息组件
interface SceneInfoProps {
  sceneName: string;
  sceneAsset?: Asset;
  imageUrl: string;
}

const SceneInfo: React.FC<SceneInfoProps> = ({ 
  sceneName, 
  sceneAsset, 
  imageUrl 
}) => {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
      <div className="w-9 h-9 rounded-md bg-slate-700 flex items-center justify-center text-green-400">
        <MapPin size={18} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-white">
          {sceneName}
        </div>
        <div className="text-xs text-slate-400">
          {sceneAsset?.description || '场景'}
        </div>
      </div>
    </div>
  );
};

interface ShotManagerProps {
  projectId?: string;
  setActiveTab?: (tab: AssetType) => void;
}

export const ShotManager: React.FC<ShotManagerProps> = ({
  projectId: propProjectId,
  setActiveTab,
}) => {
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const projectId = propProjectId || urlProjectId;
  const { settings } = useApp();
  const { showToast } = useToast();
  const { openPreview } = usePreview();

  // 设置当前活动标签为分镜管理
  useEffect(() => {
    setActiveTab?.(AssetType.SHOT);
  }, [setActiveTab]);

  // 状态管理
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
  const [splitOptions, setSplitOptions] = useState({
    includeCameraMovement: true,
    includeCharacterDetails: true,
    includeSceneDetails: true,
    focusOnAction: false,
    focusOnEmotion: false,
  });
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(2000);
  const [selectedImageModel, setSelectedImageModel] = useState<string>('');
  const [selectedResolution, setSelectedResolution] = useState<string>('1K');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('16:9');
  // 批量操作状态
  const [selectedShots, setSelectedShots] = useState<string[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0 });
  const [isSplittingBatch, setIsSplittingBatch] = useState(false);
  const [batchSplitProgress, setBatchSplitProgress] = useState({ completed: 0, total: 0 });
  // 生图模式状态
  const [generationMode, setGenerationMode] = useState<'text-to-image' | 'reference-to-image'>(
    'reference-to-image'
  );
  // 存储图片URL的缓存
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  // 参考图缩略图URL缓存
  const [referenceImageUrls, setReferenceImageUrls] = useState<{
    character?: string;
    scene?: string;
  }>({});
  // 视频生成相关状态
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>('');
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // 获取当前选择的模型配置
  const selectedModelConfig = useMemo(() => {
    if (!selectedImageModel) return undefined;
    const runtimeModel = settings.models.find(m => m.id === selectedImageModel);
    const staticModel = DEFAULT_MODELS.find(
      m => m.id === selectedImageModel || m.modelId === runtimeModel?.modelId
    );
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
      const supported = selectedModelConfig.capabilities?.supportedResolutions || [
        '1K',
        '2K',
        '4K',
      ];
      if (!supported.includes(selectedResolution)) {
        const defaultRes =
          selectedModelConfig.capabilities?.defaultResolution || supported[0] || '1K';
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

    // 切换模式后，自动选择第一个可用模型
    const imageModels = settings.models.filter(m => m.type === 'image' && (m.enabled ?? true));
    const filtered = imageModels.filter(model => {
      const supportsRef = model.capabilities?.supportsReferenceImage ?? true;
      return mode === 'reference-to-image' ? supportsRef : !supportsRef;
    });

    if (filtered.length > 0) {
      setSelectedImageModel(filtered[0].id);
    } else {
      setSelectedImageModel('');
    }
  };

  // 计算最终的 size 参数
  const calculateSize = useMemo(() => {
    if (isVolcengineModel) {
      const volcengineSizeMap: Record<string, Record<string, string>> = {
        '1K': {
          '1:1': '1024x1024',
          '4:3': '864x1152',
          '3:4': '1152x864',
          '16:9': '1280x720',
          '9:16': '720x1280',
          '3:2': '832x1248',
          '2:3': '1248x832',
          '21:9': '1512x648',
        },
        '2K': {
          '1:1': '2048x2048',
          '4:3': '2304x1728',
          '3:4': '1728x2304',
          '16:9': '2560x1440',
          '9:16': '1440x2560',
          '3:2': '2496x1664',
          '2:3': '1664x2496',
          '21:9': '3024x1296',
        },
        '4K': {
          '1:1': '4096x4096',
          '3:4': '3520x4704',
          '4:3': '4704x3520',
          '16:9': '5504x3040',
          '9:16': '3040x5504',
          '2:3': '3328x4992',
          '3:2': '4992x3328',
          '21:9': '6240x2656',
        },
      };
      const resolutionMap = volcengineSizeMap[selectedResolution] || volcengineSizeMap['1K'];
      return resolutionMap[selectedAspectRatio] || resolutionMap['16:9'] || '1280x720';
    } else {
      const modelscopeSizeMap: Record<string, string> = {
        '1:1': '1024x1024',
        '4:3': '1152x864',
        '3:4': '864x1152',
        '16:9': '1280x720',
        '9:16': '720x1280',
        '3:2': '1248x832',
        '2:3': '832x1248',
        '21:9': '1512x648',
      };
      return modelscopeSizeMap[selectedAspectRatio] || '1280x720';
    }
  }, [isVolcengineModel, selectedResolution, selectedAspectRatio]);

  // 加载剧本数据
  useEffect(() => {
    const loadScripts = async () => {
      console.log('开始加载剧本数据');
      console.log('当前projectId:', projectId);
      if (!projectId) {
        console.log('projectId为空，跳过加载');
        setIsLoading(false);
        return;
      }
      try {
        console.log('调用storageService.getScripts获取剧本数据');
        const data = await storageService.getScripts(projectId);
        console.log('获取到的剧本数据:', data);
        console.log('剧本数量:', data.length);
        setScripts(data);
        if (data.length > 0) {
          console.log('设置默认选中的剧本:', data[0].id, data[0].title);
          setSelectedScriptId(data[0].id);
          setSelectedShotId('');
        } else {
          console.log('没有找到剧本数据');
        }
      } catch (error) {
        console.error('加载剧本失败:', error);
        showToast('加载剧本失败', 'error');
      } finally {
        setIsLoading(false);
        console.log('剧本加载完成');
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

  // 当剧本变化时重置分镜选择
  useEffect(() => {
    setSelectedShotId('');
    setSelectedKeyframeIndex(0);
  }, [selectedScriptId]);

  // 当前选中的剧本
  const currentScript = useMemo(() => {
    return scripts.find(s => s.id === selectedScriptId);
  }, [scripts, selectedScriptId]);

  // 所有分镜
  const allShots = useMemo(() => {
    const shots = currentScript?.parseState?.shots || [];
    return generateShotNumbers(shots);
  }, [currentScript]);

  // 提取所有图片的唯一标识
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

  // 加载图片URL - 增量加载
  useEffect(() => {
    const loadImageUrls = async () => {
      const imagesToLoad: { id: string; path: string }[] = [];

      allShots.forEach(shot => {
        shot.keyframes?.forEach(kf => {
          // 处理 generatedImages
          if (kf.generatedImages) {
            kf.generatedImages.forEach(img => {
              if (img.path && !imageUrls[img.id]) {
                if (img.path.startsWith('http://') || img.path.startsWith('https://')) {
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
          const charAsset = assets.find(
            a => a.type === AssetType.CHARACTER && a.id === refs.character!.id
          );
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
          const sceneAsset = assets.find(
            a => a.type === AssetType.SCENE && a.id === refs.scene!.id
          );
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
    return settings.models.filter(m => m.type === 'llm' && (m.enabled ?? true));
  }, [settings.models]);

  const availableImageModels = useMemo(() => {
    return settings.models.filter(m => m.type === 'image' && (m.enabled ?? true));
  }, [settings.models]);

  const availableVideoModels = useMemo(() => {
    return settings.models.filter(m => m.type === 'video' && (m.enabled ?? true));
  }, [settings.models]);

  // 打开拆分关键帧弹窗
  const handleOpenSplitModal = (shot: Shot) => {
    if (!projectId || !currentScript) return;

    if (availableLLMModels.length === 0) {
      showToast('请先在设置中配置LLM模型', 'error');
      return;
    }

    setSelectedShotForSplit(shot);
    setSelectedLLMModel(availableLLMModels[0].id);
    setKeyframeCount(3);
    setIsSplitModalOpen(true);
  };

  // 自动处理静态分镜
  const handleAutoProcessStaticShot = async (shot: Shot) => {
    if (!projectId || !currentScript) return;

    try {
      // 调用自动处理静态分镜服务
      const keyframes = await keyframeService.autoProcessStaticShot(shot, projectId);
      
      if (keyframes.length === 0) {
        showToast('该分镜不是静态分镜，无法自动处理', 'info');
        return;
      }

      // 更新shot的keyframes
      const updatedShot = { ...shot, keyframes };

      // 更新剧本数据
      const updatedShots = allShots.map(s => (s.id === shot.id ? updatedShot : s));
      const updatedScript = {
        ...currentScript,
        parseState: {
          ...currentScript.parseState,
          shots: updatedShots,
        },
      };

      await storageService.saveScript(updatedScript);
      setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));
      showToast('静态分镜自动处理成功', 'success');
    } catch (error: any) {
      console.error('[ShotManager] 自动处理静态分镜失败:', error);
      showToast(`自动处理失败: ${error.message || '未知错误'}`, 'error');
    }
  };

  // 批量操作处理函数
  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    setSelectedShots([]);
  };

  const toggleShotSelection = (shotId: string) => {
    setSelectedShots(prev => {
      if (prev.includes(shotId)) {
        return prev.filter(id => id !== shotId);
      } else {
        return [...prev, shotId];
      }
    });
  };

  const selectAllShots = () => {
    setSelectedShots(allShots.map(shot => shot.id));
  };

  const clearSelection = () => {
    setSelectedShots([]);
  };

  // 批量拆分关键帧
  const handleBatchSplitKeyframes = async () => {
    if (!projectId || !currentScript) return;
    if (selectedShots.length === 0) {
      showToast('请先选择要拆分的分镜', 'error');
      return;
    }
    if (!selectedLLMModel) {
      showToast('请先选择LLM模型', 'error');
      return;
    }

    setIsSplittingBatch(true);
    setBatchSplitProgress({ completed: 0, total: selectedShots.length });
    showToast(`开始批量拆分 ${selectedShots.length} 个分镜的关键帧`, 'info');

    try {
      // 获取选中的分镜
      const selectedShotsData = allShots.filter(shot => selectedShots.includes(shot.id));
      
      // 批量拆分关键帧
      const results = await keyframeService.batchSplitKeyframes(
        {
          shots: selectedShotsData,
          keyframeCount: keyframeCount,
          projectId,
          modelConfigId: selectedLLMModel,
        },
        (completed, total) => {
          setBatchSplitProgress({ completed, total });
        }
      );

      // 更新剧本数据
      const updatedShots = allShots.map(shot => {
        const keyframes = results.get(shot.id);
        if (keyframes) {
          return { ...shot, keyframes };
        }
        return shot;
      });

      const updatedScript = {
        ...currentScript,
        parseState: {
          ...currentScript.parseState,
          shots: updatedShots,
        },
      };

      await storageService.saveScript(updatedScript);
      setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));
      
      const successCount = Array.from(results.values()).filter(keyframes => keyframes.length > 0).length;
      showToast(`批量拆分完成，成功 ${successCount}/${selectedShots.length} 个分镜`, 'success');
    } catch (error: any) {
      console.error('[ShotManager] 批量拆分关键帧失败:', error);
      showToast(`批量拆分关键帧失败: ${error.message || '未知错误'}`, 'error');
    } finally {
      setIsSplittingBatch(false);
    }
  };

  // 批量生成关键帧图片
  const handleBatchGenerate = async () => {
    if (!projectId || !currentScript) return;
    if (selectedShots.length === 0) {
      showToast('请先选择要生成的分镜', 'error');
      return;
    }
    if (!selectedImageModel) {
      showToast('请先选择生图模型', 'error');
      return;
    }

    setIsGeneratingBatch(true);
    setBatchProgress({ completed: 0, total: selectedShots.length });
    showToast(`开始批量生成 ${selectedShots.length} 个分镜的关键帧图片`, 'info');

    try {
      // 获取选中的分镜
      const selectedShotsData = allShots.filter(shot => selectedShots.includes(shot.id));
      
      // 收集所有关键帧
      const allKeyframes: Keyframe[] = [];
      selectedShotsData.forEach(shot => {
        if (shot.keyframes) {
          allKeyframes.push(...shot.keyframes);
        }
      });

      if (allKeyframes.length === 0) {
        showToast('选中的分镜没有关键帧', 'error');
        setIsGeneratingBatch(false);
        return;
      }

      // 批量生成图片
      const results = await keyframeService.batchGenerateImages(
        allKeyframes,
        {
          projectId,
          modelConfigId: selectedImageModel,
          size: selectedResolution,
        },
        (completed, total) => {
          setBatchProgress({ completed, total });
        }
      );

      // 更新剧本数据
      const updatedShots = allShots.map(shot => {
        if (selectedShots.includes(shot.id) && shot.keyframes) {
          const updatedKeyframes = shot.keyframes.map(kf => {
            const result = results.find(r => r.id === kf.id);
            return result || kf;
          });
          return { ...shot, keyframes: updatedKeyframes };
        }
        return shot;
      });

      const updatedScript = {
        ...currentScript,
        parseState: {
          ...currentScript.parseState,
          shots: updatedShots,
        },
      };

      await storageService.saveScript(updatedScript);
      setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));
      
      const successCount = results.filter(r => r.status === 'completed').length;
      const failedCount = results.filter(r => r.status === 'failed').length;
      
      showToast(`批量生成完成：成功 ${successCount} 个，失败 ${failedCount} 个`, 'success');
    } catch (error: any) {
      console.error('[ShotManager] 批量生成失败:', error);
      showToast(`批量生成失败: ${error.message || '未知错误'}`, 'error');
    } finally {
      setIsGeneratingBatch(false);
      setBatchProgress({ completed: 0, total: 0 });
    }
  };

  // 确认拆分关键帧
  const confirmSplitKeyframes = async () => {
    if (!projectId || !currentScript || !selectedShotForSplit || !selectedLLMModel) {
      showToast('缺少必要参数，请检查选择', 'error');
      return;
    }

    // 验证模型配置
    const selectedModel = availableLLMModels.find(m => m.id === selectedLLMModel);
    if (!selectedModel) {
      showToast('找不到模型配置，请重新选择模型', 'error');
      return;
    }
    if (!selectedModel.apiKey) {
      showToast('模型未配置 API Key，请在设置中配置', 'error');
      return;
    }
    if (!selectedModel.modelId) {
      showToast('模型配置不完整，请在设置中检查', 'error');
      return;
    }

    setIsSplitModalOpen(false);
    setSplittingShotId(selectedShotForSplit.id);

    try {
      // 获取角色和场景资产用于关键帧拆分
      const assets = await storageService.getAssets(projectId);
      const currentScriptId = currentScript.id;
      const filteredAssets = assets.filter(a => a.scriptId === currentScriptId);

      const characterAssets =
        selectedShotForSplit.characters
          ?.map(charName =>
            filteredAssets.find(a => a.type === AssetType.CHARACTER && a.name === charName)
          )
          .filter((a): a is CharacterAsset => !!a) || [];
      const sceneAsset = filteredAssets.find(
        a => a.type === AssetType.SCENE && a.name === selectedShotForSplit.sceneName
      );

      const keyframes = await keyframeService.splitKeyframes({
        shot: selectedShotForSplit,
        keyframeCount: keyframeCount,
        projectId,
        modelConfigId: selectedLLMModel,
        characterAssets: characterAssets.length > 0 ? characterAssets : undefined,
        sceneAsset: sceneAsset,
        splitOptions: splitOptions,
        temperature: temperature,
        maxTokens: maxTokens,
      });

      // 更新shot的keyframes
      const updatedShot = { ...selectedShotForSplit, keyframes };

      // 更新剧本数据
      const updatedShots = allShots.map(s => (s.id === selectedShotForSplit.id ? updatedShot : s));
      const updatedScript = {
        ...currentScript,
        parseState: {
          ...currentScript.parseState,
          shots: updatedShots,
        },
      };

      await storageService.saveScript(updatedScript);
      setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));
      showToast('关键帧拆分成功', 'success');
    } catch (error: any) {
      console.error('[ShotManager] 拆分关键帧失败:', error);
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
    const updatedShots = allShots.map(s => (s.id === selectedShot.id ? updatedShot : s));
    const updatedScript = {
      ...currentScript,
      parseState: {
        ...currentScript.parseState,
        shots: updatedShots,
      },
    };
    await storageService.saveScript(updatedScript);
    setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));

    // 获取参考图
    const assets = await storageService.getAssets(projectId);
    const currentScriptId = currentScript.id;
    const filteredAssets = assets.filter(a => a.scriptId === currentScriptId);

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

    // 构建参考图
    if (generationMode === 'reference-to-image' && kf.references) {
      // 角色参考图
      if (kf.references.character) {
        const characterAsset = filteredAssets.find(
          a => a.type === AssetType.CHARACTER && 
          (a.id === kf.references.character.id || a.name === kf.references.character.name)
        ) as CharacterAsset;
        if (characterAsset?.currentImageId) {
          const charImage = characterAsset.generatedImages?.find(
            img => img.id === characterAsset.currentImageId
          );
          if (charImage?.path) {
            try {
              const base64 = await imageToBase64(charImage.path);
              referenceImages.push(base64);
            } catch (e) {
              console.error('读取角色图失败:', e);
            }
          }
        }
      }

      // 场景参考图
      if (kf.references.scene) {
        const sceneAsset = filteredAssets.find(
          a => a.type === AssetType.SCENE && 
          (a.id === kf.references.scene.id || a.name === kf.references.scene.name)
        );
        if (sceneAsset?.filePath) {
          try {
            const base64 = await imageToBase64(sceneAsset.filePath);
            referenceImages.push(base64);
          } catch (e) {
            console.error('读取场景图失败:', e);
          }
        }
      }
    }

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
      aspectRatio: selectedAspectRatio,
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
      prompt: newPrompt,
    };

    const updatedShot = { ...selectedShot, keyframes: updatedKeyframes };
    const updatedShots = allShots.map(s => (s.id === selectedShot.id ? updatedShot : s));
    const updatedScript = {
      ...currentScript,
      parseState: {
        ...currentScript.parseState,
        shots: updatedShots,
      },
    };

    storageService.saveScript(updatedScript);
    setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));
  };

  // 生成视频
  const handleGenerateVideo = async () => {
    if (!projectId || !selectedShot || !currentScript) return;

    if (availableVideoModels.length === 0) {
      showToast('请先在设置中配置视频生成模型', 'error');
      return;
    }

    if (!selectedVideoModel) {
      showToast('请先选择视频生成模型', 'error');
      return;
    }

    const keyframes = selectedShot.keyframes;
    if (!keyframes || keyframes.length === 0) {
      showToast('请先生成关键帧图片', 'error');
      return;
    }

    // 检查是否所有关键帧都有图片
    const hasAllImages = keyframes.every(kf => kf.generatedImages && kf.generatedImages.length > 0);
    if (!hasAllImages) {
      showToast('请为所有关键帧生成图片后再生成视频', 'error');
      return;
    }

    setIsGeneratingVideo(true);
    showToast('开始生成视频，请稍候...', 'info');

    try {
      // 构建视频生成提示词
      const videoPrompt = selectedShot.description;

      const result = await videoGenerationService.generateVideo({
        keyframes,
        prompt: videoPrompt,
        modelConfigId: selectedVideoModel,
        projectId,
        duration: videoGenerationService.getRecommendedDuration(selectedShot.contentType),
      });

      if (result.success && result.localPath) {
        // 更新shot的videoUrl
        const updatedShot = { ...selectedShot, generatedVideo: result.localPath };
        const updatedShots = allShots.map(s => (s.id === selectedShot.id ? updatedShot : s));
        const updatedScript = {
          ...currentScript,
          parseState: {
            ...currentScript.parseState,
            shots: updatedShots,
          },
        };
        await storageService.saveScript(updatedScript);
        setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));
        setVideoUrl(result.localPath);
        showToast('视频生成成功', 'success');
      } else {
        showToast(`视频生成失败: ${result.error || '未知错误'}`, 'error');
      }
    } catch (error: any) {
      console.error('[ShotManager] 视频生成失败:', error);
      showToast(`视频生成失败: ${error.message || '未知错误'}`, 'error');
    } finally {
      setIsGeneratingVideo(false);
    }
  };



  // 处理历史图片选择
  const handleSelectHistoryImage = (imageId: string) => {
    if (!selectedShot || !selectedShot.keyframes) return;

    const updatedKeyframes = [...selectedShot.keyframes];
    updatedKeyframes[selectedKeyframeIndex] = {
      ...updatedKeyframes[selectedKeyframeIndex],
      currentImageId: imageId,
    };

    const updatedShot = { ...selectedShot, keyframes: updatedKeyframes };
    const updatedShots = allShots.map(s => (s.id === selectedShot.id ? updatedShot : s));
    const updatedScript = {
      ...currentScript!,
      parseState: {
        ...currentScript!.parseState,
        shots: updatedShots,
      },
    };

    storageService.saveScript(updatedScript);
    setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));
  };

  // 处理历史图片删除
  const handleDeleteHistoryImage = (imageId: string) => {
    if (!selectedShot || !selectedShot.keyframes) return;

    if (!confirm('确定要删除这张图片吗？')) return;

    const kf = selectedShot.keyframes[selectedKeyframeIndex];
    if (!kf.generatedImages) return;

    const updatedImages = kf.generatedImages.filter(img => img.id !== imageId);
    const newCurrentId = updatedImages.length > 0
      ? kf.currentImageId === imageId
        ? updatedImages[0].id
        : kf.currentImageId
      : undefined;

    const updatedKeyframes = [...selectedShot.keyframes];
    updatedKeyframes[selectedKeyframeIndex] = {
      ...kf,
      generatedImages: updatedImages,
      currentImageId: newCurrentId,
      generatedImage: updatedImages.length > 0 ? updatedImages[updatedImages.length - 1] : undefined,
    };

    const updatedShot = { ...selectedShot, keyframes: updatedKeyframes };
    const updatedShots = allShots.map(s => (s.id === selectedShot.id ? updatedShot : s));
    const updatedScript = {
      ...currentScript!,
      parseState: {
        ...currentScript!.parseState,
        shots: updatedShots,
      },
    };

    storageService.saveScript(updatedScript);
    setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-white">加载中...</div>
      </div>
    );
  }

  if (!currentScript) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-white">暂无剧本数据</div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-950 text-white">
      {/* 左侧分镜列表 */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800">
          <div className="mb-3">
            <label className="text-xs text-slate-400 block mb-1">选择剧本</label>
            <Select
              aria-label="选择剧本"
              selectedKeys={selectedScriptId ? [selectedScriptId] : []}
              onChange={(e) => setSelectedScriptId(e.target.value)}
              className="w-full"
            >
              {scripts.map(script => (
                <SelectItem key={script.id} value={script.id} textValue={script.title}>
                  {script.title}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-white">分镜列表</h2>
              <p className="text-xs text-slate-400">
                共 {allShots.length} 个分镜
              </p>
            </div>
            <Button
              size="sm"
              variant="flat"
              color={isBatchMode ? "primary" : "default"}
              onPress={toggleBatchMode}
              className="text-xs"
            >
              {isBatchMode ? '退出批量' : '批量操作'}
            </Button>
          </div>
          
          {isBatchMode && (
            <div className="flex gap-2 text-xs mb-3 flex-wrap">
              <Button
                size="sm"
                variant="flat"
                onPress={selectAllShots}
                className="text-xs"
              >
                全选
              </Button>
              <Button
                size="sm"
                variant="flat"
                onPress={clearSelection}
                className="text-xs"
              >
                清空
              </Button>
              <Button
                size="sm"
                color="primary"
                onPress={handleBatchSplitKeyframes}
                isLoading={isSplittingBatch}
                className="text-xs"
                isDisabled={selectedShots.length === 0}
              >
                批量拆分关键帧
              </Button>
              <Button
                size="sm"
                color="primary"
                onPress={handleBatchGenerate}
                isLoading={isGeneratingBatch}
                className="text-xs"
                isDisabled={selectedShots.length === 0}
              >
                批量生成图片
              </Button>
              <span className="flex items-center gap-1 text-slate-400 text-xs ml-auto">
                已选择 {selectedShots.length}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {allShots.map(shot => (
            <ShotItem
              key={shot.id}
              shot={shot}
              isActive={selectedShotId === shot.id}
              onSelect={() => {
                setSelectedShotId(shot.id);
                setSelectedKeyframeIndex(0);
              }}
              isBatchMode={isBatchMode}
              isSelected={selectedShots.includes(shot.id)}
              onToggleSelection={toggleShotSelection}
            />
          ))}
        </div>
      </aside>

      {/* 中央预览区 */}
      <main className="flex-1 flex flex-col bg-slate-950">
        {/* 顶部信息栏 */}
        {selectedShot && (
          <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-orange-500 font-mono">
                      {selectedShot.sequence}
                    </span>
                    <h2 className="text-lg font-semibold text-white">
                      {selectedShot.sceneName}
                    </h2>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    {selectedShot.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selectedShot.keyframes ? (
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => handleOpenSplitModal(selectedShot)}
                    isLoading={splittingShotId === selectedShot.id}
                    isDisabled={availableLLMModels.length === 0}
                    className="text-slate-300 hover:text-white border border-slate-700"
                  >
                    重新拆分
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => handleAutoProcessStaticShot(selectedShot)}
                      isLoading={splittingShotId === selectedShot.id}
                      className="text-slate-300 hover:text-white border border-slate-700"
                    >
                      自动处理静态分镜
                    </Button>
                    <Button
                      size="sm"
                      color="primary"
                      onPress={() => handleOpenSplitModal(selectedShot)}
                      isLoading={splittingShotId === selectedShot.id}
                      isDisabled={availableLLMModels.length === 0}
                    >
                      <Scissors size={16} className="mr-1" />
                      拆分关键帧
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 预览区域 */}
        <div className="flex-1 flex items-center justify-center p-4 bg-slate-950 relative">
          {selectedShot ? (
            selectedShot.keyframes && selectedShot.keyframes.length > 0 ? (
              <div className="w-full max-w-5xl mx-auto">
                <div className="relative">
                  {/* 关键帧图片预览 */}
                  <div className="aspect-video bg-slate-900 rounded-lg overflow-hidden relative">
                    {(() => {
                      const kf = selectedShot.keyframes[selectedKeyframeIndex];
                      const currentImage = kf.generatedImages?.find(img => img.id === kf.currentImageId) || kf.generatedImage;
                      const imageUrl = currentImage ? imageUrls[currentImage.id] || currentImage.path : null;

                      if (currentImage && imageUrl) {
                        return (
                          <img
                            src={imageUrl}
                            alt="关键帧预览"
                            className="w-full h-full object-cover"
                          />
                        );
                      } else {
                        return (
                          <div className="w-full h-full flex items-center justify-center bg-slate-800">
                            <Camera size={48} className="text-slate-600" />
                          </div>
                        );
                      }
                    })()}
                    
                    {/* 关键帧指示器 */}
                    <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                      关键帧 {selectedKeyframeIndex + 1} / {selectedShot.keyframes.length}
                    </div>
                    

                  </div>
                  
                  {/* 关键帧切换标签 */}
                  <div className="flex gap-2 mt-4">
                    {selectedShot.keyframes.map((kf, idx) => (
                      <Button
                        key={kf.id}
                        size="sm"
                        color={selectedKeyframeIndex === idx ? "primary" : "default"}
                        variant={selectedKeyframeIndex === idx ? "solid" : "flat"}
                        onPress={() => setSelectedKeyframeIndex(idx)}
                        className="flex-1"
                      >
                        关键帧 {idx + 1}
                      </Button>
                    ))}
                  </div>
                </div>


              </div>
            ) : (
              /* 未拆分状态 */
              <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-800 flex items-center justify-center">
                  <Scissors size={32} className="text-slate-500" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  该分镜尚未拆分关键帧
                </h3>
                <p className="text-slate-400 mb-6">
                  使用AI大模型将此分镜的动态描述拆分为2-4个连贯的静态关键帧，并生成对应的图生图提示词
                </p>
                <div className="bg-slate-800 rounded-lg p-4 mb-6 text-left">
                  <div className="text-sm text-slate-500 mb-2">分镜描述</div>
                  <div className="text-sm text-slate-300">
                    {selectedShot.description}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="text-center">
              <p className="text-slate-400">请选择左侧分镜查看详情</p>
            </div>
          )}
        </div>

        {/* 底部历史栏 */}
        {selectedShot && selectedShot.keyframes && selectedShot.keyframes.length > 0 && (
          <div className="bg-slate-900 border-t border-slate-800 px-6 py-4">
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-400">历史版本</span>
              <div className="flex-1 overflow-x-auto flex gap-2 pb-2">
                {(() => {
                  const kf = selectedShot.keyframes[selectedKeyframeIndex];
                  const images = kf.generatedImages || [];
                  
                  if (images.length === 0) {
                    return (
                      <div className="text-xs text-slate-500">暂无历史图片</div>
                    );
                  }
                  
                  return images.map((img, index) => (
                    <HistoryItem
                      key={img.id}
                      image={img}
                      isActive={img.id === kf.currentImageId}
                      imageUrl={imageUrls[img.id] || img.path}
                      onSelect={handleSelectHistoryImage}
                      onDelete={handleDeleteHistoryImage}
                      index={index}
                    />
                  ));
                })()}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 右侧控制面板 */}
      <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col overflow-y-auto">
        {selectedShot && (
          <>
            {/* 基本信息 */}
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white mb-3">基本信息</h3>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">时长:</span>
                  <span>{selectedShot.duration}秒</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">景别:</span>
                  <span>{selectedShot.shotType || '未知'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">机位:</span>
                  <span>{selectedShot.cameraAngle || '未知'}</span>
                </div>
                {selectedShot.mood && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">情绪:</span>
                    <span>{selectedShot.mood}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 关联角色和场景 */}
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white mb-3">关联资产</h3>
              <div className="flex gap-4">
                {/* 关联角色 */}
                {selectedShot.characters && selectedShot.characters.length > 0 && (
                  <div className="flex-1">
                    <h4 className="text-xs text-slate-400 mb-2">角色</h4>
                    <div className="space-y-3">
                      {selectedShot.characters.map((character, index) => (
                        <CharacterItem
                          key={index}
                          character={character}
                          imageUrl=""
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* 关联场景 */}
                <div className="flex-1">
                  <h4 className="text-xs text-slate-400 mb-2">场景</h4>
                  <SceneInfo
                    sceneName={selectedShot.sceneName}
                    imageUrl=""
                  />
                </div>
              </div>
            </div>



            {/* 生图功能 */}
            {selectedShot.keyframes && selectedShot.keyframes.length > 0 && (
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-3">生图功能</h3>
                <div className="bg-slate-800 rounded-lg p-3 space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">生图模式</label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        color={generationMode === 'text-to-image' ? "primary" : "default"}
                        variant={generationMode === 'text-to-image' ? "solid" : "flat"}
                        onPress={() => handleGenerationModeChange('text-to-image')}
                        className="flex-1"
                      >
                        文生图
                      </Button>
                      <Button
                        size="sm"
                        color={generationMode === 'reference-to-image' ? "primary" : "default"}
                        variant={generationMode === 'reference-to-image' ? "solid" : "flat"}
                        onPress={() => handleGenerationModeChange('reference-to-image')}
                        className="flex-1"
                      >
                        图生图
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">提示词</label>
                    <Textarea
                      value={selectedShot.keyframes[selectedKeyframeIndex]?.prompt || ''}
                      onChange={(e) => handleUpdatePrompt(selectedKeyframeIndex, e.target.value)}
                      className="w-full text-xs h-24 resize-none"
                      placeholder="输入生图提示词"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">选择模型</label>
                    <Select
                      aria-label="选择生图模型"
                      selectedKeys={selectedImageModel ? [selectedImageModel] : []}
                      onChange={(e) => setSelectedImageModel(e.target.value)}
                      className="w-full"
                    >
                      {availableImageModels.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">分辨率</label>
                    <Select
                      aria-label="选择分辨率"
                      selectedKeys={[selectedResolution]}
                      onChange={(e) => setSelectedResolution(e.target.value)}
                      className="w-full"
                    >
                      {availableResolutions.map(res => (
                        <SelectItem key={res} value={res}>
                          {res}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">宽高比</label>
                    <Select
                      aria-label="选择宽高比"
                      selectedKeys={[selectedAspectRatio]}
                      onChange={(e) => setSelectedAspectRatio(e.target.value)}
                      className="w-full"
                    >
                      <SelectItem value="1:1">1:1</SelectItem>
                      <SelectItem value="16:9">16:9</SelectItem>
                      <SelectItem value="9:16">9:16</SelectItem>
                      <SelectItem value="4:3">4:3</SelectItem>
                      <SelectItem value="3:4">3:4</SelectItem>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    color="primary"
                    onPress={() => handleGenerateImage(selectedKeyframeIndex)}
                    className="w-full"
                  >
                    生成图片
                  </Button>
                </div>
              </div>
            )}

            {/* 视频生成 */}
            {selectedShot.keyframes && selectedShot.keyframes.length > 0 && (
              <div className="p-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-white mb-3">视频生成</h3>
                <div className="bg-slate-800 rounded-lg p-3">
                  <div className="mb-3">
                    <label className="text-xs text-slate-400 block mb-1">选择模型</label>
                    <Select
                      aria-label="选择视频生成模型"
                      selectedKeys={selectedVideoModel ? [selectedVideoModel] : []}
                      onChange={(e) => setSelectedVideoModel(e.target.value)}
                      className="w-full"
                    >
                      {availableVideoModels.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    color="primary"
                    onPress={handleGenerateVideo}
                    isLoading={isGeneratingVideo}
                    isDisabled={!selectedVideoModel}
                    className="w-full"
                  >
                    生成视频
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </aside>

      {/* 拆分关键帧弹窗 */}
      <SplitKeyframeModal
        isOpen={isSplitModalOpen}
        onClose={() => setIsSplitModalOpen(false)}
        onConfirm={confirmSplitKeyframes}
        isLoading={!!splittingShotId}
        keyframeCount={keyframeCount}
        setKeyframeCount={setKeyframeCount}
        selectedLLMModel={selectedLLMModel}
        setSelectedLLMModel={setSelectedLLMModel}
        availableLLMModels={availableLLMModels}
        splitOptions={splitOptions}
        setSplitOptions={setSplitOptions}
        temperature={temperature}
        setTemperature={setTemperature}
        maxTokens={maxTokens}
        setMaxTokens={setMaxTokens}
      />
    </div>
  );
};

// 拆分关键帧弹窗
const SplitKeyframeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  keyframeCount: number;
  setKeyframeCount: (count: number) => void;
  selectedLLMModel: string;
  setSelectedLLMModel: (modelId: string) => void;
  availableLLMModels: ModelConfig[];
  splitOptions: {
    includeCameraMovement: boolean;
    includeCharacterDetails: boolean;
    includeSceneDetails: boolean;
    focusOnAction: boolean;
    focusOnEmotion: boolean;
  };
  setSplitOptions: (options: any) => void;
  temperature: number;
  setTemperature: (temp: number) => void;
  maxTokens: number;
  setMaxTokens: (tokens: number) => void;
}> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  keyframeCount,
  setKeyframeCount,
  selectedLLMModel,
  setSelectedLLMModel,
  availableLLMModels,
  splitOptions,
  setSplitOptions,
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens,
}) => {
  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} className="w-full max-w-2xl">
      <ModalContent className="bg-slate-900 border-slate-800 text-white">
        <ModalHeader>
          <h3>拆分关键帧</h3>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-6">
            <div>
              <label className="text-sm text-slate-400 block mb-1">选择LLM模型</label>
              <Select
                aria-label="选择LLM模型"
                selectedKeys={selectedLLMModel ? [selectedLLMModel] : []}
                onChange={(e) => setSelectedLLMModel(e.target.value)}
                className="w-full"
              >
                {availableLLMModels.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </Select>
            </div>
            
            <div>
              <label className="text-sm text-slate-400 block mb-1">关键帧数量</label>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setKeyframeCount(Math.max(2, keyframeCount - 1))}
                  isDisabled={keyframeCount <= 2}
                >
                  -
                </Button>
                <span className="text-sm">{keyframeCount}</span>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setKeyframeCount(Math.min(4, keyframeCount + 1))}
                  isDisabled={keyframeCount >= 4}
                >
                  +
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-1">推荐2-4个关键帧</p>
            </div>
            
            <div>
              <label className="text-sm text-slate-400 block mb-2">拆分选项</label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={splitOptions.includeCameraMovement}
                    onChange={(e) => setSplitOptions({ ...splitOptions, includeCameraMovement: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-500 text-orange-500 focus:ring-orange-500"
                  />
                  <label className="text-sm text-slate-300">包含运镜信息</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={splitOptions.includeCharacterDetails}
                    onChange={(e) => setSplitOptions({ ...splitOptions, includeCharacterDetails: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-500 text-orange-500 focus:ring-orange-500"
                  />
                  <label className="text-sm text-slate-300">包含角色细节</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={splitOptions.includeSceneDetails}
                    onChange={(e) => setSplitOptions({ ...splitOptions, includeSceneDetails: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-500 text-orange-500 focus:ring-orange-500"
                  />
                  <label className="text-sm text-slate-300">包含场景细节</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={splitOptions.focusOnAction}
                    onChange={(e) => setSplitOptions({ ...splitOptions, focusOnAction: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-500 text-orange-500 focus:ring-orange-500"
                  />
                  <label className="text-sm text-slate-300">专注于动作</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={splitOptions.focusOnEmotion}
                    onChange={(e) => setSplitOptions({ ...splitOptions, focusOnEmotion: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-500 text-orange-500 focus:ring-orange-500"
                  />
                  <label className="text-sm text-slate-300">专注于情感表达</label>
                </div>
              </div>
            </div>
            
            <div>
              <label className="text-sm text-slate-400 block mb-2">LLM生成参数</label>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-slate-400 block mb-1">温度 (0.1-1.0)</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>0.1</span>
                    <span>{temperature.toFixed(1)}</span>
                    <span>1.0</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-400 block mb-1">最大 tokens</label>
                  <input
                    type="number"
                    min="1000"
                    max="5000"
                    step="500"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">控制生成文本的长度</p>
                </div>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={isLoading}>
            取消
          </Button>
          <Button
            color="primary"
            onPress={onConfirm}
            isLoading={isLoading}
            isDisabled={!selectedLLMModel}
          >
            确认拆分
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
