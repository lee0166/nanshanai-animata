import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Script, Shot, ScriptScene, CharacterAsset, Asset, AssetType, ModelConfig, GeneratedImage } from '../types';
import { storageService } from '../services/storage';
import { useApp } from '../contexts/context';
import { useToast } from '../contexts/ToastContext';
import { usePreview } from '../components/PreviewProvider';
import { Card, CardBody, Button, Chip, Badge, Progress, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Select, SelectItem } from "@heroui/react";
import { Camera, Film, Clock, Users, MapPin, Scissors, AlertCircle, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { keyframeService } from '../services/keyframe';
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
                  isSelected ? 'border-blue-500' : 'border-transparent hover:border-slate-300'
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
  const [generatingKeyframeId, setGeneratingKeyframeId] = useState<string | null>(null);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [selectedLLMModel, setSelectedLLMModel] = useState<string>('');
  const [keyframeCount, setKeyframeCount] = useState<number>(3);
  const [selectedShotForSplit, setSelectedShotForSplit] = useState<Shot | null>(null);
  const [selectedImageModel, setSelectedImageModel] = useState<string>('');
  const [selectedResolution, setSelectedResolution] = useState<string>('1K');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('16:9');
  
  // 存储图片URL的缓存
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

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

  // 当前选中的剧本
  const currentScript = useMemo(() => {
    return scripts.find(s => s.id === selectedScriptId);
  }, [scripts, selectedScriptId]);

  // 所有分镜
  const allShots = useMemo(() => {
    return currentScript?.parseState?.shots || [];
  }, [currentScript]);

  // 加载图片URL
  useEffect(() => {
    const loadImageUrls = async () => {
      const urls: Record<string, string> = {};
      
      // 遍历所有分镜和关键帧
      allShots.forEach(shot => {
        shot.keyframes?.forEach(kf => {
          // 处理 generatedImages
          if (kf.generatedImages) {
            kf.generatedImages.forEach(img => {
              if (img.path) {
                // 如果是远程URL，直接使用
                if (img.path.startsWith('http://') || img.path.startsWith('https://')) {
                  urls[img.id] = img.path;
                } else {
                  // 本地路径，需要获取可访问的URL
                  storageService.getAssetUrl(img.path).then(url => {
                    setImageUrls(prev => ({ ...prev, [img.id]: url }));
                  });
                }
              }
            });
          }
          // 处理旧的 generatedImage
          if (kf.generatedImage?.path) {
            const img = kf.generatedImage;
            if (img.path.startsWith('http://') || img.path.startsWith('https://')) {
              urls[img.id] = img.path;
            } else {
              storageService.getAssetUrl(img.path).then(url => {
                setImageUrls(prev => ({ ...prev, [img.id]: url }));
              });
            }
          }
        });
      });
      
      setImageUrls(urls);
    };
    
    if (allShots.length > 0) {
      loadImageUrls();
    }
  }, [allShots]);

  // 当前选中的分镜
  const selectedShot = useMemo(() => {
    return allShots.find(s => s.id === selectedShotId);
  }, [allShots, selectedShotId]);

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
      const keyframes = await keyframeService.splitKeyframes({
        shot: selectedShotForSplit,
        keyframeCount: keyframeCount,
        projectId,
        modelConfigId: selectedLLMModel
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

    setGeneratingKeyframeId(kf.id);
    try {
      // 获取项目资产作为参考
      const assets = await storageService.getAssets(projectId);
      const characterAsset = kf.references?.character 
        ? assets.find(a => a.type === AssetType.CHARACTER && a.name === kf.references.character.name) as CharacterAsset
        : undefined;
      const sceneAsset = kf.references?.scene
        ? assets.find(a => a.type === AssetType.SCENE && a.name === kf.references.scene.name)
        : undefined;

      console.log('[ShotManager] 开始生成图片，modelConfigId:', selectedImageModel, 'size:', calculateSize);
      const updatedKeyframe = await keyframeService.generateKeyframeImage({
        keyframe: kf,
        projectId,
        characterAsset,
        sceneAsset,
        modelConfigId: selectedImageModel,
        size: calculateSize
      });
      console.log('[ShotManager] 生图完成，返回的 keyframe:', updatedKeyframe);
      console.log('[ShotManager] generatedImage:', updatedKeyframe.generatedImage);

      // 更新分镜数据
      const updatedKeyframes = [...(selectedShot.keyframes || [])];
      updatedKeyframes[keyframeIndex] = updatedKeyframe;
      const updatedShot = { ...selectedShot, keyframes: updatedKeyframes };
      
      // 更新剧本
      const updatedShots = allShots.map(s => s.id === selectedShot.id ? updatedShot : s);
      const updatedScript = {
        ...currentScript,
        parseState: {
          ...currentScript.parseState,
          shots: updatedShots
        }
      };
      
      console.log('[ShotManager] 保存剧本...');
      await storageService.saveScript(updatedScript);
      console.log('[ShotManager] 剧本保存成功');
      
      console.log('[ShotManager] 更新 scripts 状态...');
      setScripts(scripts.map(s => s.id === updatedScript.id ? updatedScript : s));
      console.log('[ShotManager] scripts 状态已更新');
      
      showToast('图片生成成功', 'success');
    } catch (error) {
      console.error('生成图片失败:', error);
      showToast('生成图片失败', 'error');
    } finally {
      setGeneratingKeyframeId(null);
    }
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
                }}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedShotId === shot.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
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
                        onPress={() => setSelectedKeyframeIndex(idx)}
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
                                    <Users size={16} className="text-blue-500" />
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
                                className="w-full h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 resize-none focus:outline-none focus:border-blue-500"
                              />

                              {/* 选择生图模型 */}
                              <div className="mt-3">
                                <label className="text-xs text-slate-500 mb-1 block">选择生图模型</label>
                                <Select
                                  aria-label="选择生图模型"
                                  placeholder={availableImageModels.length > 0 ? "选择用于生成图片的模型" : "请先在设置中配置生图模型"}
                                  selectedKeys={selectedImageModel ? [selectedImageModel] : []}
                                  onChange={(e) => setSelectedImageModel(e.target.value)}
                                  isDisabled={availableImageModels.length === 0}
                                  size="sm"
                                  className="w-full"
                                >
                                  {availableImageModels.map(model => (
                                    <SelectItem key={model.id} value={model.id}>
                                      {model.name}
                                    </SelectItem>
                                  ))}
                                </Select>
                                {availableImageModels.length === 0 && (
                                  <p className="text-xs text-danger mt-1">
                                    未配置生图模型，请先在设置中添加模型
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
                                  isDisabled={availableImageModels.length === 0 || !selectedImageModel}
                                  isLoading={generatingKeyframeId === selectedShot.keyframes[selectedKeyframeIndex].id}
                                  onPress={() => handleGenerateImage(selectedKeyframeIndex)}
                                >
                                  <Camera size={16} className="mr-2" />
                                  生成图片
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
