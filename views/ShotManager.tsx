import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'react-router-dom';
import {
  Script,
  Shot,
  Keyframe,
  ScriptScene,
  CharacterAsset,
  SceneAsset,
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
  CardHeader,
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
  Tabs,
  Tab,
  Checkbox,
  useDisclosure,
  Spinner,
} from '@heroui/react';
import { DeleteConfirmModal } from '../components/Shared/DeleteConfirmModal';
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
  ChevronDown,
  Video,
  Play,
  Film as FilmIcon,
  Plus,
  Copy,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  GripVertical,
  List,
  Layers,
  Box,
  Sparkles,
} from 'lucide-react';
import { keyframeService, keyframeEngine } from '../services/keyframe';
import { videoGenerationService } from '../services/video';
import { jobQueue } from '../services/queue';
import { aiService } from '../services/aiService';
import { DEFAULT_MODELS } from '../config/models';
import { generateShotNumbers } from '../services/utils/shotNumberGenerator';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 视图模式类型
type ViewMode = 'shotList' | 'keyframeSequence';

// 分镜项组件
interface ShotItemProps {
  shot: Shot;
  isActive: boolean;
  onSelect: (shot: Shot) => void;
  isBatchMode: boolean;
  isSelected: boolean;
  onToggleSelection: (shotId: string) => void;
  expanded: boolean;
  onToggleExpand: (shotId: string) => void;
  imageUrls: Record<string, string>;
  selectedKeyframeIndex: number;
  onSelectKeyframe: (shotId: string, keyframeIndex: number) => void;
}

const ShotItem: React.FC<ShotItemProps> = React.memo(
  ({
    shot,
    isActive,
    onSelect,
    isBatchMode,
    isSelected,
    onToggleSelection,
    expanded,
    onToggleExpand,
    imageUrls,
    selectedKeyframeIndex,
    onSelectKeyframe,
  }) => {
    const contentType = keyframeEngine.detectShotType(shot.description, shot.cameraMovement);
    const hasKeyframes = shot.keyframes && shot.keyframes.length > 0;
    const hasImages = shot.keyframes?.some(
      kf => kf.generatedImages?.length > 0 || kf.generatedImage
    );

    const handleToggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpand(shot.id);
    };

    return (
      <div className="mb-2">
        <motion.div
          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
            isActive
              ? 'bg-content2 border border-primary'
              : isSelected
                ? 'bg-content2/50 border border-primary/50'
                : 'hover:bg-content2/30 border border-transparent'
          }`}
          onClick={() => onSelect(shot)}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          transition={{ type: 'spring', stiffness: 400, damping: 10 }}
        >
          {isBatchMode && (
            <Checkbox
              checked={isSelected}
              onChange={e => {
                e.stopPropagation();
                onToggleSelection(shot.id);
              }}
              className="text-primary border-primary"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-primary">
                {shot.shotNumber || shot.sequence}
              </span>
              <span className="text-xs font-medium text-foreground truncate">
                {shot.sceneName}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1 truncate">
              {shot.description}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">{shot.duration}s</span>
              {hasKeyframes ? (
                <span className="text-xs text-success">
                  ✓ {shot.keyframes.length}关键帧
                </span>
              ) : (
                <span className="text-xs text-slate-400">○ 未拆分</span>
              )}
            </div>
          </div>
          {hasKeyframes && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleToggleExpand}
              aria-label={expanded ? '收起关键帧' : '展开关键帧'}
              className="text-slate-400 hover:text-foreground hover:bg-content2 rounded-lg p-1 w-6 h-6 transition-all duration-200 flex items-center justify-center"
            >
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </Button>
          )}
        </motion.div>

        {expanded && hasKeyframes && (
          <motion.div
            className="ml-4 mt-1 space-y-2"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {shot.keyframes.map((keyframe, index) => {
              const currentImage =
                keyframe.generatedImages?.find(img => img.id === keyframe.currentImageId) ||
                keyframe.generatedImage;
              const imageUrl = currentImage
                ? imageUrls[currentImage.id] || currentImage.path
                : null;

              return (
                <motion.div
                  key={keyframe.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className={`p-2 rounded-md border transition-all duration-200 ${
                    isActive && selectedKeyframeIndex === index
                      ? 'border-primary bg-content2/50'
                      : 'border-content3 hover:border-content4'
                  }`}
                  onClick={() => onSelectKeyframe(shot.id, index)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 rounded overflow-hidden bg-content2 flex items-center justify-center">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={`关键帧 ${keyframe.sequence}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Camera size={16} className="text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-primary">
                          {shot.shotNumber || shot.sequence}-{keyframe.sequence}
                        </span>
                        <span
                          className={`text-xs px-1 py-0.5 rounded ${
                            keyframe.frameType === 'start'
                              ? 'bg-success/20 text-success'
                              : keyframe.frameType === 'end'
                                ? 'bg-primary/20 text-primary'
                                : 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          {keyframe.frameType === 'start'
                            ? '开始'
                            : keyframe.frameType === 'end'
                              ? '结束'
                              : '中间'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {keyframe.description || keyframe.prompt?.substring(0, 20) + '...'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    );
  }
);

// 可排序关键帧按钮组件
const SortableKeyframeButton: React.FC<{
  id: string;
  index: number;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}> = ({ id, index, isSelected, label, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Button
        size="sm"
        color={isSelected ? 'primary' : 'default'}
        variant={isSelected ? 'solid' : 'flat'}
        onPress={onSelect}
        className="flex-1 flex items-center gap-2"
      >
        <GripVertical size={16} className="text-slate-500 cursor-grab" />
        {label}
      </Button>
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

const HistoryItem: React.FC<HistoryItemProps> = React.memo(
  ({ image, isActive, imageUrl, onSelect, onDelete, index }) => {
    return (
      <div
        className={`relative w-16 h-12 rounded-md overflow-hidden cursor-pointer border-2 transition-all duration-200 ${
          isActive ? 'border-primary' : 'border-transparent hover:border-slate-600'
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
          onClick={e => {
            e.stopPropagation();
            onDelete(image.id);
          }}
          title="删除图片"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  }
);

// 历史版本缩略图项组件（带延迟显示删除按钮）
interface HistoryThumbnailProps {
  img: GeneratedImage;
  index: number;
  isCurrent: boolean;
  imageUrl: string;
  onSelect: (imageId: string) => void;
  onDelete: (imageId: string) => void;
}

const HistoryThumbnail: React.FC<HistoryThumbnailProps> = React.memo(
  ({ img, index, isCurrent, imageUrl, onSelect, onDelete }) => {
    const [showDelete, setShowDelete] = React.useState(false);
    const deleteTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = React.useCallback(() => {
      deleteTimerRef.current = setTimeout(() => {
        setShowDelete(true);
      }, 500);
    }, []);

    const handleMouseLeave = React.useCallback(() => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
      }
      setShowDelete(false);
    }, []);

    React.useEffect(() => {
      return () => {
        if (deleteTimerRef.current) {
          clearTimeout(deleteTimerRef.current);
        }
      };
    }, []);

    return (
      <div
        className={`relative flex-shrink-0 w-24 h-16 cursor-pointer rounded-lg overflow-hidden border-2 ${
          isCurrent ? 'border-white' : 'border-transparent hover:border-slate-400'
        }`}
        onClick={e => {
          e.stopPropagation();
          onSelect(img.id);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img src={imageUrl} alt={`历史版本 ${index + 1}`} className="w-full h-full object-cover" />
        <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
          V{index + 1}
        </div>
        <button
          className={`absolute top-0 right-0 w-5 h-5 flex items-center justify-center transition-opacity duration-200 ${
            showDelete ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={e => {
            e.stopPropagation();
            onDelete(img.id);
          }}
          title="删除图片"
        >
          <Trash2 size={12} className="text-white" />
        </button>
      </div>
    );
  }
);

// 角色项组件
interface CharacterItemProps {
  character: string;
  characterAsset?: CharacterAsset;
  imageUrl: string;
}

const CharacterItem: React.FC<CharacterItemProps> = React.memo(
  ({ character, characterAsset, imageUrl }) => {
    return (
      <div className="flex items-center gap-3 p-3 bg-content2 rounded-lg border border-content3">
        <div className="w-9 h-9 rounded-full bg-content3 overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt={character} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-content3 flex items-center justify-center">
              <Users size={18} className="text-slate-400" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">{character}</div>
          <div className="text-xs text-slate-400">
            {characterAsset?.description || '角色'}
          </div>
        </div>
      </div>
    );
  }
);

// 视觉描述组件
interface VisualDescriptionProps {
  visualDescription?: Shot['visualDescription'];
}

const VisualDescription: React.FC<VisualDescriptionProps> = React.memo(({ visualDescription }) => {
  if (!visualDescription) {
    return (
      <div className="bg-content2 rounded-lg p-4 border border-content3">
        <h5 className="text-sm font-medium text-foreground mb-3">视觉描述</h5>
        <div className="p-3 bg-content1 rounded text-slate-400">
          无详细视觉描述信息
        </div>
      </div>
    );
  }

  return (
    <div className="bg-content2 rounded-lg p-4 border border-content3">
      <h5 className="text-sm font-medium text-foreground mb-4">视觉描述</h5>

      <div className="space-y-4">
        {visualDescription.composition && (
          <div className="p-3 bg-content1 rounded">
            <div className="text-sm font-medium text-foreground mb-1">构图</div>
            <div className="text-sm text-foreground">
              {visualDescription.composition}
            </div>
          </div>
        )}

        {visualDescription.lighting && (
          <div className="p-3 bg-content1 rounded">
            <div className="text-sm font-medium text-foreground mb-1">光影</div>
            <div className="text-sm text-foreground">
              {visualDescription.lighting}
            </div>
          </div>
        )}

        {visualDescription.colorPalette && (
          <div className="p-3 bg-content1 rounded">
            <div className="text-sm font-medium text-foreground mb-1">色调</div>
            <div className="text-sm text-foreground">
              {visualDescription.colorPalette}
            </div>
          </div>
        )}

        {visualDescription.characterPositions &&
          visualDescription.characterPositions.length > 0 && (
            <div className="p-3 bg-content1 rounded">
              <div className="text-sm font-medium text-foreground mb-2">
                角色位置
              </div>
              <div className="text-sm text-foreground space-y-2">
                {visualDescription.characterPositions.map((pos, index) => (
                  <div key={index} className="flex flex-col">
                    <span className="font-medium">{pos.characterId}</span>
                    <span className="text-slate-400">
                      {pos.position}，{pos.action}，{pos.expression}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
});

// 场景信息组件
interface SceneInfoProps {
  sceneName: string;
  sceneAsset?: Asset;
  imageUrl: string;
}

const SceneInfo: React.FC<SceneInfoProps> = React.memo(({ sceneName, sceneAsset, imageUrl }) => {
  return (
    <div className="flex items-center gap-3 p-3 bg-content2 rounded-lg border border-content3">
      <div className="w-9 h-9 rounded-md bg-content3 flex items-center justify-center text-success">
        <MapPin size={18} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{sceneName}</div>
        <div className="text-xs text-slate-400">
          {sceneAsset?.description || '场景'}
        </div>
      </div>
    </div>
  );
});

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
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState(-1);
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
  // 生图高级参数
  const [seed, setSeed] = useState<number>(Math.floor(Math.random() * 1000000));
  const [batchCount, setBatchCount] = useState<number>(1);
  const [negativePrompt, setNegativePrompt] = useState<string>(
    '低分辨率，模糊，变形，卡顿，锯齿，过曝，欠曝，色彩失真，人物面部模糊，杂物冗余，非电影感'
  );
  // 参考图管理
  const [references, setReferences] = useState<{
    character?: { id: string; name: string; weight: number };
    scene?: { id: string; name: string; weight: number };
  }>({});
  // 提示词模板
  const promptTemplates = [
    {
      id: 'cinematic',
      name: '电影质感',
      value: 'cinematic lighting, movie still, shot on 35mm film, high quality, detailed',
    },
    {
      id: 'photorealistic',
      name: '高清实拍',
      value: 'photorealistic, raw photo, DSLR, high detail, sharp focus',
    },
    { id: 'anime', name: '日漫风格', value: 'anime style, 2D animation, colorful, vibrant' },
    {
      id: 'gothic',
      name: '暗黑哥特',
      value: 'gothic style, dark atmosphere, dramatic lighting, mysterious',
    },
    { id: 'cyberpunk', name: '赛博朋克', value: 'cyberpunk, neon lights, futuristic, dystopian' },
  ];
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
  // 视图模式
  const [viewMode, setViewMode] = useState<ViewMode>('shotList');
  // 展开状态管理
  const [expandedShots, setExpandedShots] = useState<Set<string>>(new Set());
  // 资产选择器状态
  const [isCharacterSelectorOpen, setIsCharacterSelectorOpen] = useState(false);
  const [isSceneSelectorOpen, setIsSceneSelectorOpen] = useState(false);
  // 项目资产列表
  const [projectAssets, setProjectAssets] = useState<Asset[]>([]);
  // 删除确认弹窗状态
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [imageIdToDelete, setImageIdToDelete] = useState<string | null>(null);

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

  // 加载项目资产
  useEffect(() => {
    const loadAssets = async () => {
      if (!projectId) return;
      try {
        const assets = await storageService.getAssets(projectId);
        setProjectAssets(assets);
      } catch (error) {
        console.error('加载项目资产失败:', error);
      }
    };
    loadAssets();
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
    setSelectedKeyframeIndex(-1);
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

  // 完整的关键帧序列数据结构
  const completeKeyframeSequence = useMemo(() => {
    if (!allShots || allShots.length === 0) return [];

    return allShots.flatMap((shot, shotIndex) => {
      const sequence = [];

      // 添加分镜标题项
      sequence.push({
        type: 'shot-header' as const,
        shotId: shot.id,
        shotNumber: shot.shotNumber || shot.sequence,
        shotName: shot.sceneName,
        shotIndex,
      });

      // 添加关键帧或占位符
      if (shot.keyframes && shot.keyframes.length > 0) {
        // 已拆分的分镜，添加实际关键帧
        shot.keyframes.forEach((keyframe, kfIndex) => {
          sequence.push({
            type: 'keyframe' as const,
            shotId: shot.id,
            keyframeId: keyframe.id,
            keyframeIndex: kfIndex,
            shotIndex,
            keyframe,
            shot,
          });
        });
      } else {
        // 未拆分的分镜，添加占位关键帧
        sequence.push({
          type: 'placeholder' as const,
          shotId: shot.id,
          shotIndex,
          shot,
        });
      }

      return sequence;
    });
  }, [allShots]);

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

  // 当选中关键帧变化时，自动设置参考图
  useEffect(() => {
    if (selectedShot?.keyframes?.[selectedKeyframeIndex]?.references) {
      const kfRefs = selectedShot.keyframes[selectedKeyframeIndex].references;
      setReferences({
        character: kfRefs.character ? { ...kfRefs.character, weight: 1 } : undefined,
        scene: kfRefs.scene ? { ...kfRefs.scene, weight: 1 } : undefined,
      });
    }
  }, [selectedShot, selectedKeyframeIndex]);

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
      setSelectedKeyframeIndex(-1);
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
  const toggleBatchMode = useCallback(() => {
    setIsBatchMode(!isBatchMode);
    setSelectedShots([]);
  }, [isBatchMode]);

  const toggleShotSelection = useCallback((shotId: string) => {
    setSelectedShots(prev => {
      if (prev.includes(shotId)) {
        return prev.filter(id => id !== shotId);
      } else {
        return [...prev, shotId];
      }
    });
  }, []);

  const selectAllShots = useCallback(() => {
    setSelectedShots(allShots.map(shot => shot.id));
  }, [allShots]);

  const clearSelection = useCallback(() => {
    setSelectedShots([]);
  }, []);

  // 展开/折叠处理函数
  const toggleShotExpand = useCallback((shotId: string) => {
    setExpandedShots(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(shotId)) {
        newExpanded.delete(shotId);
      } else {
        newExpanded.add(shotId);
      }
      return newExpanded;
    });
  }, []);

  // 关键帧选择处理函数
  const handleSelectKeyframe = useCallback((shotId: string, keyframeIndex: number) => {
    setSelectedShotId(shotId);
    setSelectedKeyframeIndex(keyframeIndex);
  }, []);

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
          script: currentScript,
          modelConfigId: selectedLLMModel,
          negativePrompt: negativePrompt,
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

      const successCount = Array.from(results.values()).filter(
        keyframes => keyframes.length > 0
      ).length;
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
        negativePrompt: negativePrompt,
        script: currentScript,
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
    if (generationMode === 'reference-to-image') {
      // 优先使用新的参考图管理功能
      if (references.character || references.scene) {
        // 角色参考图
        if (references.character) {
          const characterAsset = filteredAssets.find(
            a => a.type === AssetType.CHARACTER && a.id === references.character.id
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
        if (references.scene) {
          const sceneAsset = filteredAssets.find(
            a => a.type === AssetType.SCENE && a.id === references.scene.id
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
      } else if (kf.references) {
        // 兼容旧的参考图方式
        // 角色参考图
        if (kf.references.character) {
          const characterAsset = filteredAssets.find(
            a =>
              a.type === AssetType.CHARACTER &&
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
            a =>
              a.type === AssetType.SCENE &&
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
      negativePrompt: kf.negativePrompt,
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
  const handleSelectHistoryImage = useCallback(
    (imageId: string) => {
      if (!selectedShot || !selectedShot.keyframes || !currentScript) return;

      const updatedKeyframes = [...selectedShot.keyframes];
      updatedKeyframes[selectedKeyframeIndex] = {
        ...updatedKeyframes[selectedKeyframeIndex],
        currentImageId: imageId,
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
    },
    [selectedShot, selectedKeyframeIndex, allShots, currentScript, scripts]
  );

  // 提示删除图片
  const promptDeleteHistoryImage = useCallback(
    (imageId: string) => {
      setImageIdToDelete(imageId);
      onDeleteOpen();
    },
    [onDeleteOpen]
  );

  // 确认删除图片
  const confirmDeleteHistoryImage = useCallback(() => {
    if (!imageIdToDelete || !selectedShot || !selectedShot.keyframes || !currentScript) {
      onDeleteClose();
      setImageIdToDelete(null);
      return;
    }

    const kf = selectedShot.keyframes[selectedKeyframeIndex];
    if (!kf.generatedImages) {
      onDeleteClose();
      setImageIdToDelete(null);
      return;
    }

    const updatedImages = kf.generatedImages.filter(img => img.id !== imageIdToDelete);
    const newCurrentId =
      updatedImages.length > 0
        ? kf.currentImageId === imageIdToDelete
          ? updatedImages[0].id
          : kf.currentImageId
        : undefined;

    const updatedKeyframes = [...selectedShot.keyframes];
    updatedKeyframes[selectedKeyframeIndex] = {
      ...kf,
      generatedImages: updatedImages,
      currentImageId: newCurrentId,
      generatedImage:
        updatedImages.length > 0 ? updatedImages[updatedImages.length - 1] : undefined,
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

    onDeleteClose();
    setImageIdToDelete(null);
  }, [
    imageIdToDelete,
    selectedShot,
    selectedKeyframeIndex,
    allShots,
    currentScript,
    scripts,
    onDeleteClose,
  ]);

  // 处理关键帧拖拽排序
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!selectedShot || !currentScript) return;

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeIndex = selectedShot.keyframes.findIndex(kf => kf.id === active.id);
      const overIndex = selectedShot.keyframes.findIndex(kf => kf.id === over.id);

      if (activeIndex === -1 || overIndex === -1) return;

      // 重新排序关键帧
      const updatedKeyframes = [...selectedShot.keyframes];
      const [movedKeyframe] = updatedKeyframes.splice(activeIndex, 1);
      updatedKeyframes.splice(overIndex, 0, movedKeyframe);

      // 更新sequence值
      const reorderedKeyframes = updatedKeyframes.map((kf, index) => ({
        ...kf,
        sequence: index + 1,
        frameType: index === 0 ? 'start' : index === updatedKeyframes.length - 1 ? 'end' : 'middle',
      }));

      // 更新shot和script
      const updatedShot = { ...selectedShot, keyframes: reorderedKeyframes };
      const updatedShots = allShots.map(s => (s.id === selectedShot.id ? updatedShot : s));
      const updatedScript = {
        ...currentScript,
        parseState: {
          ...currentScript.parseState,
          shots: updatedShots,
        },
      };

      // 保存到存储
      storageService.saveScript(updatedScript);
      setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));

      // 确保选中的关键帧索引仍然有效
      if (selectedKeyframeIndex >= reorderedKeyframes.length) {
        setSelectedKeyframeIndex(reorderedKeyframes.length - 1);
      }
    },
    [selectedShot, currentScript, allShots, scripts, selectedKeyframeIndex]
  );

  // 处理选择角色资产
  const handleSelectCharacter = useCallback(
    (asset: CharacterAsset) => {
      const currentImage =
        asset.generatedImages?.find(img => img.id === asset.currentImageId) ||
        asset.generatedImages?.[0];
      setReferences(prev => ({
        ...prev,
        character: { id: asset.id, name: asset.name, weight: 1 },
      }));

      // 更新关键帧的references
      if (selectedShot && selectedKeyframeIndex >= 0 && selectedShot.keyframes) {
        const updatedKeyframes = [...selectedShot.keyframes];
        updatedKeyframes[selectedKeyframeIndex] = {
          ...updatedKeyframes[selectedKeyframeIndex],
          references: {
            ...updatedKeyframes[selectedKeyframeIndex].references,
            character: { id: asset.id, name: asset.name },
          },
        };
        const updatedShot = { ...selectedShot, keyframes: updatedKeyframes };
        const updatedShots = allShots.map(s => (s.id === selectedShot.id ? updatedShot : s));
        const updatedScript = {
          ...currentScript,
          parseState: { ...currentScript.parseState, shots: updatedShots },
        };
        storageService.saveScript(updatedScript);
        setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));
      }

      // 更新参考图URL
      if (currentImage?.path) {
        storageService.getAssetUrl(currentImage.path).then(url => {
          if (url) {
            setReferenceImageUrls(prev => ({ ...prev, character: url }));
          }
        });
      }
    },
    [selectedShot, selectedKeyframeIndex, allShots, currentScript, scripts]
  );

  // 处理清除角色选择
  const handleClearCharacter = useCallback(() => {
    setReferences(prev => ({ ...prev, character: undefined }));
    setReferenceImageUrls(prev => ({ ...prev, character: undefined }));

    // 更新关键帧的references
    if (selectedShot && selectedKeyframeIndex >= 0 && selectedShot.keyframes) {
      const updatedKeyframes = [...selectedShot.keyframes];
      const newReferences = { ...updatedKeyframes[selectedKeyframeIndex].references };
      delete newReferences.character;
      updatedKeyframes[selectedKeyframeIndex] = {
        ...updatedKeyframes[selectedKeyframeIndex],
        references: newReferences,
      };
      const updatedShot = { ...selectedShot, keyframes: updatedKeyframes };
      const updatedShots = allShots.map(s => (s.id === selectedShot.id ? updatedShot : s));
      const updatedScript = {
        ...currentScript,
        parseState: { ...currentScript.parseState, shots: updatedShots },
      };
      storageService.saveScript(updatedScript);
      setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));
    }
  }, [selectedShot, selectedKeyframeIndex, allShots, currentScript, scripts]);

  // 处理选择场景资产
  const handleSelectScene = useCallback(
    (asset: SceneAsset) => {
      const currentImage =
        asset.generatedImages?.find(img => img.id === asset.currentImageId) ||
        asset.generatedImages?.[0];
      setReferences(prev => ({
        ...prev,
        scene: { id: asset.id, name: asset.name, weight: 1 },
      }));

      // 更新关键帧的references
      if (selectedShot && selectedKeyframeIndex >= 0 && selectedShot.keyframes) {
        const updatedKeyframes = [...selectedShot.keyframes];
        updatedKeyframes[selectedKeyframeIndex] = {
          ...updatedKeyframes[selectedKeyframeIndex],
          references: {
            ...updatedKeyframes[selectedKeyframeIndex].references,
            scene: { id: asset.id, name: asset.name },
          },
        };
        const updatedShot = { ...selectedShot, keyframes: updatedKeyframes };
        const updatedShots = allShots.map(s => (s.id === selectedShot.id ? updatedShot : s));
        const updatedScript = {
          ...currentScript,
          parseState: { ...currentScript.parseState, shots: updatedShots },
        };
        storageService.saveScript(updatedScript);
        setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));
      }

      // 更新参考图URL
      if (currentImage?.path) {
        storageService.getAssetUrl(currentImage.path).then(url => {
          if (url) {
            setReferenceImageUrls(prev => ({ ...prev, scene: url }));
          }
        });
      }
    },
    [selectedShot, selectedKeyframeIndex, allShots, currentScript, scripts]
  );

  // 处理清除场景选择
  const handleClearScene = useCallback(() => {
    setReferences(prev => ({ ...prev, scene: undefined }));
    setReferenceImageUrls(prev => ({ ...prev, scene: undefined }));

    // 更新关键帧的references
    if (selectedShot && selectedKeyframeIndex >= 0 && selectedShot.keyframes) {
      const updatedKeyframes = [...selectedShot.keyframes];
      const newReferences = { ...updatedKeyframes[selectedKeyframeIndex].references };
      delete newReferences.scene;
      updatedKeyframes[selectedKeyframeIndex] = {
        ...updatedKeyframes[selectedKeyframeIndex],
        references: newReferences,
      };
      const updatedShot = { ...selectedShot, keyframes: updatedKeyframes };
      const updatedShots = allShots.map(s => (s.id === selectedShot.id ? updatedShot : s));
      const updatedScript = {
        ...currentScript,
        parseState: { ...currentScript.parseState, shots: updatedShots },
      };
      storageService.saveScript(updatedScript);
      setScripts(scripts.map(s => (s.id === updatedScript.id ? updatedScript : s)));
    }
  }, [selectedShot, selectedKeyframeIndex, allShots, currentScript, scripts]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-foreground">加载中...</div>
      </div>
    );
  }

  if (!currentScript) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-foreground">暂无剧本数据</div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background text-foreground">
      {/* 左侧分镜列表 */}
      <aside className="w-80 bg-content1 border-r border-content3 flex flex-col overflow-y-auto transition-all duration-300">
        <div className="p-4 border-b border-content3">
          <div className="mb-3">
            <label className="text-xs text-slate-400 block mb-1">选择剧本</label>
            <Select
              aria-label="选择剧本"
              selectedKeys={selectedScriptId ? [selectedScriptId] : []}
              onChange={e => setSelectedScriptId(e.target.value)}
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
              <h2 className="text-sm font-semibold text-foreground">分镜列表</h2>
              <p className="text-xs text-slate-400">共 {allShots.length} 个分镜</p>
            </div>
            <Button
              size="sm"
              variant="flat"
              color={isBatchMode ? 'primary' : 'default'}
              onPress={toggleBatchMode}
              className="text-xs"
            >
              {isBatchMode ? '退出批量' : '批量操作'}
            </Button>
          </div>

          {isBatchMode && (
            <div className="space-y-3 mb-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="bordered"
                  onPress={selectAllShots}
                  className="text-xs py-2"
                >
                  全选
                </Button>
                <Button
                  size="sm"
                  variant="bordered"
                  onPress={clearSelection}
                  className="text-xs py-2"
                >
                  清空
                </Button>
                <Button
                  size="sm"
                  variant="bordered"
                  color="primary"
                  onPress={handleBatchSplitKeyframes}
                  isLoading={isSplittingBatch}
                  className="text-xs py-2"
                  isDisabled={selectedShots.length === 0}
                >
                  批量拆分关键帧
                </Button>
                <Button
                  size="sm"
                  variant="bordered"
                  color="primary"
                  onPress={handleBatchGenerate}
                  isLoading={isGeneratingBatch}
                  className="text-xs py-2"
                  isDisabled={selectedShots.length === 0}
                >
                  批量生成图片
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">共 {allShots.length} 个分镜</span>
                <span className="text-slate-400">已选择 {selectedShots.length}</span>
              </div>
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
                setSelectedKeyframeIndex(-1);
              }}
              isBatchMode={isBatchMode}
              isSelected={selectedShots.includes(shot.id)}
              onToggleSelection={toggleShotSelection}
              expanded={expandedShots.has(shot.id)}
              onToggleExpand={toggleShotExpand}
              imageUrls={imageUrls}
              selectedKeyframeIndex={selectedKeyframeIndex}
              onSelectKeyframe={handleSelectKeyframe}
            />
          ))}
        </div>
      </aside>

      {/* 中央预览区 */}
      <main className="flex-1 flex flex-col bg-background transition-all duration-300 overflow-hidden">
        {/* 顶部信息栏 - 更紧凑 */}
        {selectedShot && (
          <div className="bg-content1 border-b border-content3 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary font-mono">
                      {selectedShot.sequence}
                    </span>
                    <h2 className="text-base font-semibold text-foreground truncate max-w-xs">
                      {selectedShot.sceneName}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                    {selectedShot.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedShot.keyframes ? (
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => handleOpenSplitModal(selectedShot)}
                    isLoading={splittingShotId === selectedShot.id}
                    isDisabled={availableLLMModels.length === 0}
                    className="text-slate-400 hover:text-foreground border border-content3 text-xs"
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
                      className="text-slate-400 hover:text-foreground border border-content3 text-xs"
                    >
                      自动处理
                    </Button>
                    <Button
                      size="sm"
                      color="primary"
                      onPress={() => handleOpenSplitModal(selectedShot)}
                      isLoading={splittingShotId === selectedShot.id}
                      isDisabled={availableLLMModels.length === 0}
                      className="text-xs"
                    >
                      <Scissors size={14} className="mr-1" />
                      拆分
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 预览区域 - 预览区 + 生图面板垂直堆叠 */}
        <div className="flex-1 flex flex-col bg-background relative p-4 overflow-hidden">
          {selectedShot ? (
            <div className="flex-1 flex flex-col overflow-y-auto gap-4">
              {/* 选中关键帧时：预览区 + 历史版本 + 生图面板 */}
              {selectedShot.keyframes &&
              selectedShot.keyframes.length > 0 &&
              selectedKeyframeIndex >= 0 ? (
                <>
                  {/* 关键帧图片预览 */}
                  <div className="flex-shrink-0">
                    <div className="relative w-full max-w-4xl mx-auto group">
                      <div className="aspect-video bg-content2 rounded-lg overflow-hidden relative shadow-lg">
                        {(() => {
                          const kf = selectedShot.keyframes[selectedKeyframeIndex];
                          const currentImage =
                            kf.generatedImages?.find(img => img.id === kf.currentImageId) ||
                            kf.generatedImage;
                          const imageUrl = currentImage
                            ? imageUrls[currentImage.id] || currentImage.path
                            : null;

                          if (currentImage && imageUrl) {
                            return (
                              <div
                                className="w-full h-full cursor-pointer transition-transform duration-300 hover:scale-[1.02]"
                                onClick={() => openPreview([{ src: imageUrl }])}
                              >
                                <img
                                  src={imageUrl}
                                  alt="关键帧预览"
                                  className="w-full h-full object-cover transition-all duration-500"
                                />
                              </div>
                            );
                          } else {
                            return (
                              <div className="w-full h-full flex items-center justify-center bg-content3">
                                <Camera size={40} className="text-slate-400" />
                              </div>
                            );
                          }
                        })()}

                        {/* 关键帧指示器 - 右上角 */}
                        <div className="absolute top-3 right-3 bg-black/80 px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-lg z-10">
                          {selectedShot.shotNumber || selectedShot.sequence}-
                          {selectedKeyframeIndex + 1} / {selectedShot.keyframes.length}
                        </div>

                        {/* 悬浮控制条 - 底部 */}
                        <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                          <div className="flex items-center gap-3">
                            {/* 上一帧按钮 */}
                            <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                              <Button
                                size="sm"
                                variant="light"
                                radius="lg"
                                onPress={() => {
                                  if (selectedKeyframeIndex > 0) {
                                    setSelectedKeyframeIndex(selectedKeyframeIndex - 1);
                                  }
                                }}
                                isDisabled={selectedKeyframeIndex === 0}
                                className="bg-black/50 backdrop-blur-sm border border-white/30 text-white hover:bg-black/70"
                              >
                                <ChevronLeft size={16} />
                                上一帧
                              </Button>
                            </div>

                            {/* 历史版本缩略图 */}
                            <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                              {(() => {
                                const kf = selectedShot.keyframes[selectedKeyframeIndex];
                                const images = kf.generatedImages || [];
                                if (images.length === 0) {
                                  return <div className="text-sm text-white/60">暂无历史版本</div>;
                                }

                                return images.map((img, index) => (
                                  <HistoryThumbnail
                                    key={img.id}
                                    img={img}
                                    index={index}
                                    isCurrent={img.id === kf.currentImageId}
                                    imageUrl={imageUrls[img.id] || img.path}
                                    onSelect={handleSelectHistoryImage}
                                    onDelete={promptDeleteHistoryImage}
                                  />
                                ));
                              })()}
                            </div>

                            <style>{`
                              .scrollbar-hide::-webkit-scrollbar {
                                display: none;
                              }
                              .scrollbar-hide {
                                -ms-overflow-style: none;
                                scrollbar-width: none;
                              }
                            `}</style>

                            {/* 下一帧按钮 */}
                            <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                              <Button
                                size="sm"
                                variant="light"
                                radius="lg"
                                onPress={() => {
                                  if (selectedKeyframeIndex < selectedShot.keyframes.length - 1) {
                                    setSelectedKeyframeIndex(selectedKeyframeIndex + 1);
                                  }
                                }}
                                isDisabled={
                                  selectedKeyframeIndex === selectedShot.keyframes.length - 1
                                }
                                className="bg-black/50 backdrop-blur-sm border border-white/30 text-white hover:bg-black/70"
                              >
                                下一帧
                                <ChevronRight size={16} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 生图功能面板 - 统一容器 */}
                  <div className="flex-shrink-0 pb-4">
                    <div className="bg-content1 rounded-xl border border-content3 p-6 shadow-sm space-y-5 max-w-4xl mx-auto">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Sparkles size={18} className="text-primary" />
                        生图功能
                      </h3>

                      {/* 生图模式 */}
                      <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-2">
                          生图模式
                        </label>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            color={generationMode === 'text-to-image' ? 'primary' : 'default'}
                            variant={generationMode === 'text-to-image' ? 'solid' : 'bordered'}
                            onPress={() => handleGenerationModeChange('text-to-image')}
                            className="flex-1 font-medium py-2 text-sm"
                          >
                            文生图
                          </Button>
                          <Button
                            size="sm"
                            color={generationMode === 'reference-to-image' ? 'primary' : 'default'}
                            variant={generationMode === 'reference-to-image' ? 'solid' : 'bordered'}
                            onPress={() => handleGenerationModeChange('reference-to-image')}
                            className="flex-1 font-medium py-2 text-sm"
                          >
                            图生图
                          </Button>
                        </div>
                      </div>

                      {/* 参考图管理 - 仅在图生图模式显示 */}
                      {generationMode === 'reference-to-image' && (
                        <div className="space-y-4">
                          <label className="text-xs font-semibold text-slate-400 block">
                            参考图管理
                          </label>
                          <div className="bg-content2 rounded-lg border border-content3 p-4">
                            <div className="flex flex-col md:flex-row gap-4">
                              {/* 角色参考图区域 */}
                              <div className="flex-1 flex items-center gap-3">
                                <Users size={16} className="text-primary shrink-0" />
                                <span className="text-xs font-semibold text-slate-400 shrink-0">
                                  角色参考图
                                </span>
                                {references.character ? (
                                  <div className="flex items-center gap-3 flex-1">
                                    <div
                                      className="w-8 h-8 bg-content3 rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                                      onClick={() => {
                                        if (referenceImageUrls.character) {
                                          openPreview(
                                            [
                                              {
                                                src: referenceImageUrls.character,
                                                alt: references.character.name,
                                              },
                                            ],
                                            0
                                          );
                                        }
                                      }}
                                    >
                                      {referenceImageUrls.character ? (
                                        <img
                                          src={referenceImageUrls.character}
                                          alt={references.character.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <Users size={24} className="text-slate-400" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400 truncate flex-1">
                                      {references.character.name}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className="w-8 h-8 bg-content2 rounded border-2 border-dashed border-content3 flex items-center justify-center shrink-0">
                                      <Users size={20} className="text-slate-400" />
                                    </div>
                                    <span className="text-xs text-slate-400 flex-1">
                                      未选择角色
                                    </span>
                                  </div>
                                )}
                                <Button
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                  onPress={() => {
                                    setIsCharacterSelectorOpen(true);
                                  }}
                                  className="text-xs shrink-0"
                                >
                                  {references.character ? '更换' : '选择'}
                                </Button>
                              </div>

                              {/* 分隔线 */}
                              <div className="hidden md:block w-px bg-content3" />

                              {/* 场景参考图区域 */}
                              <div className="flex-1 flex items-center gap-3">
                                <MapPin size={16} className="text-primary shrink-0" />
                                <span className="text-xs font-semibold text-slate-400 shrink-0">
                                  场景参考图
                                </span>
                                {references.scene ? (
                                  <div className="flex items-center gap-3 flex-1">
                                    <div
                                      className="w-8 h-8 bg-content3 rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                                      onClick={() => {
                                        if (referenceImageUrls.scene) {
                                          openPreview(
                                            [
                                              {
                                                src: referenceImageUrls.scene,
                                                alt: references.scene.name,
                                              },
                                            ],
                                            0
                                          );
                                        }
                                      }}
                                    >
                                      {referenceImageUrls.scene ? (
                                        <img
                                          src={referenceImageUrls.scene}
                                          alt={references.scene.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <MapPin size={24} className="text-slate-400" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400 truncate flex-1">
                                      {references.scene.name}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className="w-8 h-8 bg-content2 rounded border-2 border-dashed border-content3 flex items-center justify-center shrink-0">
                                      <MapPin size={20} className="text-slate-400" />
                                    </div>
                                    <span className="text-xs text-slate-400 flex-1">
                                      未选择场景
                                    </span>
                                  </div>
                                )}
                                <Button
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                  onPress={() => {
                                    setIsSceneSelectorOpen(true);
                                  }}
                                  className="text-xs shrink-0"
                                >
                                  {references.scene ? '更换' : '选择'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 正面提示词 */}
                      <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-2">
                          正面提示词
                        </label>
                        <Textarea
                          value={selectedShot.keyframes[selectedKeyframeIndex]?.prompt || ''}
                          onChange={e => handleUpdatePrompt(selectedKeyframeIndex, e.target.value)}
                          className="w-full text-sm border-content3 bg-content1 text-foreground"
                          placeholder="输入生图正面提示词"
                          minRows={3}
                        />
                      </div>

                      {/* 模型选择 + 分辨率/宽高比 */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-400 block mb-2">
                            选择模型
                          </label>
                          <Select
                            aria-label="选择生图模型"
                            selectedKeys={
                              selectedImageModel &&
                              availableImageModels.some(m => m.id === selectedImageModel)
                                ? [selectedImageModel]
                                : []
                            }
                            onChange={e => setSelectedImageModel(e.target.value)}
                            className="w-full"
                            size="sm"
                          >
                            {availableImageModels.map(model => (
                              <SelectItem key={model.id} value={model.id}>
                                {model.name}
                              </SelectItem>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400 block mb-2">
                            分辨率
                          </label>
                          <Select
                            aria-label="选择分辨率"
                            selectedKeys={
                              availableResolutions.includes(selectedResolution)
                                ? [selectedResolution]
                                : []
                            }
                            onChange={e => setSelectedResolution(e.target.value)}
                            className="w-full"
                            size="sm"
                          >
                            {availableResolutions.map(res => (
                              <SelectItem key={res} value={res}>
                                {res}
                              </SelectItem>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400 block mb-2">
                            宽高比
                          </label>
                          <Select
                            aria-label="选择宽高比"
                            selectedKeys={[selectedAspectRatio]}
                            onChange={e => setSelectedAspectRatio(e.target.value)}
                            className="w-full"
                            size="sm"
                          >
                            <SelectItem value="1:1">1:1</SelectItem>
                            <SelectItem value="16:9">16:9</SelectItem>
                            <SelectItem value="9:16">9:16</SelectItem>
                            <SelectItem value="4:3">4:3</SelectItem>
                            <SelectItem value="3:4">3:4</SelectItem>
                          </Select>
                        </div>
                      </div>

                      {/* Seed值 + 批量数量 + 提示词模板 */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-slate-400 block mb-2">
                            Seed值
                          </label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              value={seed}
                              onChange={e => setSeed(Number(e.target.value))}
                              className="w-full text-sm border-content3 bg-content1"
                              placeholder="输入Seed值"
                              size="sm"
                            />
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => setSeed(Math.floor(Math.random() * 1000000))}
                              className="flex-shrink-0"
                            >
                              随机
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400 block mb-2">
                            批量数量
                          </label>
                          <Select
                            aria-label="选择批量生成数量"
                            selectedKeys={[batchCount.toString()]}
                            onChange={e => setBatchCount(Number(e.target.value))}
                            className="w-full"
                            size="sm"
                          >
                            <SelectItem value="1">1张</SelectItem>
                            <SelectItem value="2">2张</SelectItem>
                            <SelectItem value="3">3张</SelectItem>
                            <SelectItem value="4">4张</SelectItem>
                            <SelectItem value="5">5张</SelectItem>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-400 block mb-2">
                            提示词模板
                          </label>
                          <Select
                            aria-label="选择提示词模板"
                            selectedKeys={[]}
                            onChange={e => {
                              const template = promptTemplates.find(t => t.id === e.target.value);
                              if (template) {
                                const currentPrompt =
                                  selectedShot.keyframes[selectedKeyframeIndex]?.prompt || '';
                                const newPrompt = currentPrompt
                                  ? `${currentPrompt}, ${template.value}`
                                  : template.value;
                                handleUpdatePrompt(selectedKeyframeIndex, newPrompt);
                              }
                            }}
                            className="w-full"
                            size="sm"
                          >
                            {promptTemplates.map(template => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </Select>
                        </div>
                      </div>

                      {/* 负向提示词 */}
                      <div>
                        <label className="text-xs font-semibold text-slate-400 block mb-2">
                          负向提示词
                        </label>
                        <Textarea
                          value={negativePrompt}
                          onChange={e => setNegativePrompt(e.target.value)}
                          className="w-full text-sm border-content3 bg-content1 text-foreground"
                          placeholder="输入负向提示词"
                          minRows={2}
                        />
                      </div>

                      {/* 生成按钮 */}
                      <Button
                        color="primary"
                        variant="solid"
                        size="lg"
                        fullWidth
                        onPress={() => handleGenerateImage(selectedKeyframeIndex)}
                        className="font-bold h-12 rounded-xl shadow-xl shadow-primary/20 active:scale-95 transition-all"
                        classNames={{
                          content: 'font-black uppercase tracking-widest text-sm',
                        }}
                        startContent={
                          <Sparkles size={18} className="text-primary-foreground" />
                        }
                      >
                        生成图片
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                /* 未选择关键帧或无关键帧状态 - 分镜核心信息 */
                <div className="flex-1 overflow-auto">
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  >
                    {/* 专业风格分镜核心信息面板 */}
                    <div className="bg-content1 border border-content3 rounded-lg overflow-hidden flex flex-col max-w-4xl mx-auto">
                      {/* 顶部标题栏 */}
                      <div className="bg-content2 border-b border-content3 px-4 py-3 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Film size={18} className="text-primary" />
                          分镜核心信息
                        </h4>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                        </div>
                      </div>

                      {/* 核心信息区域 */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {/* 基本信息行 */}
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className="grid grid-cols-3 gap-3"
                        >
                          {/* 镜号 */}
                          <div className="bg-content2 border border-content3 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              镜号
                            </div>
                            <div className="text-sm font-mono font-semibold text-primary">
                              {selectedShot.shotNumber || selectedShot.sequence}
                            </div>
                          </div>

                          {/* 场景标签 */}
                          <div className="bg-content2 border border-content3 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              场景
                            </div>
                            <div className="text-sm font-medium text-foreground truncate">
                              {selectedShot.sceneName}
                            </div>
                          </div>

                          {/* 时长 */}
                          <div className="bg-content2 border border-content3 rounded-lg p-3">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              时长
                            </div>
                            <div className="text-sm font-mono text-foreground">
                              {selectedShot.duration}s
                            </div>
                          </div>
                        </motion.div>

                        {/* 技术参数行 */}
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: 0.08 }}
                          className="grid grid-cols-4 gap-3"
                        >
                          {/* 景别 */}
                          <div className="bg-content2 border border-content3 rounded-lg p-2.5">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              景别
                            </div>
                            <div className="text-sm font-mono text-foreground">
                              {selectedShot.shotType || '未知'}
                            </div>
                          </div>

                          {/* 拍摄角度 */}
                          <div className="bg-content2 border border-content3 rounded-lg p-2.5">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              角度
                            </div>
                            <div className="text-sm font-mono text-foreground">
                              {selectedShot.cameraAngle || '未知'}
                            </div>
                          </div>

                          {/* 运镜方式 */}
                          <div className="bg-content2 border border-content3 rounded-lg p-2.5">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              运镜
                            </div>
                            <div className="text-sm font-mono text-foreground">
                              {selectedShot.cameraMovement || '未知'}
                            </div>
                          </div>

                          {/* 情绪 */}
                          <div className="bg-content2 border border-content3 rounded-lg p-2.5">
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              情绪
                            </div>
                            <div className="text-sm text-foreground truncate">
                              {selectedShot.mood || '未知'}
                            </div>
                          </div>
                        </motion.div>

                        {/* 分镜描述 */}
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: 0.15 }}
                          className="bg-content2 border border-content3 rounded-lg p-3"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1 h-4 bg-primary rounded" />
                            <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                              分镜描述
                            </h5>
                          </div>
                          <div className="text-sm text-foreground leading-relaxed">
                            {selectedShot.description}
                          </div>
                        </motion.div>

                        {/* 视觉描述和音频信息 - 并排布局 */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* 视觉描述 */}
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: 0.22 }}
                            className="bg-content2 border border-content3 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-1 h-4 bg-primary rounded" />
                              <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                视觉描述
                              </h5>
                            </div>
                            {selectedShot.visualDescription ? (
                              <div className="space-y-2 text-sm">
                                {selectedShot.visualDescription.composition && (
                                  <div className="flex gap-2">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[45px]">
                                      构图:
                                    </span>
                                    <span className="text-foreground">
                                      {selectedShot.visualDescription.composition}
                                    </span>
                                  </div>
                                )}
                                {selectedShot.visualDescription.lighting && (
                                  <div className="flex gap-2">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[45px]">
                                      光影:
                                    </span>
                                    <span className="text-foreground">
                                      {selectedShot.visualDescription.lighting}
                                    </span>
                                  </div>
                                )}
                                {selectedShot.visualDescription.colorPalette && (
                                  <div className="flex gap-2">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[45px]">
                                      色调:
                                    </span>
                                    <span className="text-foreground">
                                      {selectedShot.visualDescription.colorPalette}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-slate-500 dark:text-slate-400 text-sm italic">
                                无详细描述
                              </div>
                            )}
                          </motion.div>

                          {/* 音频信息 */}
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: 0.28 }}
                            className="bg-content2 border border-content3 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-1 h-4 bg-success rounded" />
                              <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                音频信息
                              </h5>
                            </div>
                            <div className="space-y-2 text-sm">
                              {selectedShot.dialogue && (
                                <div className="p-2 bg-content3/50 rounded border border-content3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="w-0.5 h-3 bg-success rounded" />
                                    <span className="text-xs font-medium text-slate-400">
                                      对话
                                    </span>
                                  </div>
                                  <span className="text-slate-400 text-sm line-clamp-2">
                                    {selectedShot.dialogue}
                                  </span>
                                </div>
                              )}
                              {selectedShot.sound && (
                                <div className="p-2 bg-content3/50 rounded border border-content3">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="w-0.5 h-3 bg-success rounded" />
                                    <span className="text-xs font-medium text-slate-400">
                                      音效
                                    </span>
                                  </div>
                                  <span className="text-slate-400 text-sm line-clamp-2">
                                    {selectedShot.sound}
                                  </span>
                                </div>
                              )}
                              {!selectedShot.dialogue &&
                                !selectedShot.sound &&
                                !selectedShot.music && (
                                  <div className="text-slate-500 dark:text-slate-400 text-sm italic">
                                    无音频信息
                                  </div>
                                )}
                            </div>
                          </motion.div>
                        </div>

                        {/* 资产关联和分镜分析 - 并排布局 */}
                        <div className="grid grid-cols-2 gap-3">
                          {/* 资产关联 */}
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: 0.35 }}
                            className="bg-content2 border border-content3 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-1 h-4 bg-purple-500 rounded" />
                              <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                资产关联
                              </h5>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex gap-2">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[55px]">
                                  角色:
                                </span>
                                <span className="text-foreground truncate">
                                  {selectedShot.characters && selectedShot.characters.length > 0
                                    ? selectedShot.characters.join('、')
                                    : '无'}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[55px]">
                                  场景:
                                </span>
                                <span className="text-foreground truncate">
                                  {selectedShot.sceneName}
                                </span>
                              </div>
                              {selectedShot.assets?.propIds &&
                                selectedShot.assets.propIds.length > 0 && (
                                  <div className="flex gap-2">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 min-w-[55px]">
                                      道具:
                                    </span>
                                    <span className="text-foreground truncate">
                                      {selectedShot.assets.propIds.join('、')}
                                    </span>
                                  </div>
                                )}
                            </div>
                          </motion.div>

                          {/* 分镜类型分析 */}
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: 0.42 }}
                            className="bg-content2 border border-content3 rounded-lg p-3"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-1 h-4 bg-yellow-500 rounded" />
                              <h5 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                                分镜分析
                              </h5>
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-content3/50 rounded p-2 border border-content3">
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    分镜类型
                                  </div>
                                  <div className="text-sm font-medium text-foreground">
                                    {(() => {
                                      const analysis = {
                                        type: selectedShot.contentType || 'static',
                                        confidence: 90,
                                        recommendation: {
                                          keyframeCount: 3,
                                          focus: ['动作', '情感', '细节'],
                                          notes:
                                            '建议拆分为开始、中间和结束三个关键帧，捕捉动作的完整过程',
                                        },
                                      };
                                      const getTypeLabel = (type: string) => {
                                        switch (type) {
                                          case 'static':
                                            return '静态分镜';
                                          case 'dynamic-simple':
                                            return '简单动态';
                                          case 'dynamic-complex':
                                            return '复杂动态';
                                          default:
                                            return '未知类型';
                                        }
                                      };
                                      return getTypeLabel(analysis.type);
                                    })()}
                                  </div>
                                </div>
                                <div className="bg-content3/50 rounded p-2 border border-content3">
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    置信度
                                  </div>
                                  <div className="text-sm font-medium text-foreground">90%</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-content3/50 rounded p-2 border border-content3">
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    关键帧数
                                  </div>
                                  <div className="text-sm font-medium text-foreground">3</div>
                                </div>
                                <div className="bg-content3/50 rounded p-2 border border-content3">
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    关注重点
                                  </div>
                                  <div className="text-sm font-medium text-foreground truncate">
                                    动作、情感
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400 text-sm">请选择左侧分镜查看详情</p>
            </div>
          )}
        </div>
      </main>

      {/* 右侧边栏 - 简化后 */}
      <aside className="w-72 bg-content1 border-l border-content3 flex flex-col overflow-y-auto">
        {selectedShot ? (
          <>
            {/* 基本信息 */}
            <div className="p-4 border-b border-content3">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Layers size={16} className="text-primary" />
                分镜信息
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">时长:</span>
                  <span className="font-mono">{selectedShot.duration}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">景别:</span>
                  <span>{selectedShot.shotType || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">机位:</span>
                  <span>{selectedShot.cameraAngle || '-'}</span>
                </div>
                {selectedShot.mood && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">情绪:</span>
                    <span>{selectedShot.mood}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 关联资产 */}
            <div className="p-4 border-b border-content3">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Box size={16} className="text-primary" />
                关联资产
              </h3>
              <div className="space-y-2">
                {/* 关联角色 */}
                {selectedShot.characters && selectedShot.characters.length > 0 && (
                  <div className="space-y-2">
                    {selectedShot.characters.map((character, index) => (
                      <CharacterItem key={index} character={character} imageUrl="" />
                    ))}
                  </div>
                )}

                {/* 关联场景 */}
                <SceneInfo sceneName={selectedShot.sceneName} imageUrl="" />
              </div>
            </div>

            {/* 快捷操作 */}
            <div className="p-4 flex-1">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <List size={16} className="text-success" />
                快捷操作
              </h3>
              <div className="space-y-2">
                {selectedShot.keyframes ? (
                  <Button
                    size="sm"
                    variant="flat"
                    fullWidth
                    onPress={() => handleOpenSplitModal(selectedShot)}
                    isLoading={splittingShotId === selectedShot.id}
                    isDisabled={availableLLMModels.length === 0}
                  >
                    重新拆分关键帧
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="flat"
                      fullWidth
                      onPress={() => handleAutoProcessStaticShot(selectedShot)}
                      isLoading={splittingShotId === selectedShot.id}
                    >
                      自动处理静态分镜
                    </Button>
                    <Button
                      size="sm"
                      color="primary"
                      fullWidth
                      onPress={() => handleOpenSplitModal(selectedShot)}
                      isLoading={splittingShotId === selectedShot.id}
                      isDisabled={availableLLMModels.length === 0}
                      startContent={<Scissors size={14} />}
                    >
                      拆分关键帧
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-slate-400 text-sm text-center">请选择左侧分镜查看详情</p>
          </div>
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

      {/* 角色资产选择器弹窗 */}
      <CharacterSelectorModal
        isOpen={isCharacterSelectorOpen}
        onClose={() => setIsCharacterSelectorOpen(false)}
        assets={projectAssets}
        onSelect={handleSelectCharacter}
        onClear={handleClearCharacter}
        currentId={references.character?.id}
      />

      {/* 场景资产选择器弹窗 */}
      <SceneSelectorModal
        isOpen={isSceneSelectorOpen}
        onClose={() => setIsSceneSelectorOpen(false)}
        assets={projectAssets}
        onSelect={handleSelectScene}
        onClear={handleClearScene}
        currentId={references.scene?.id}
      />

      {/* 删除确认弹窗 */}
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        onConfirm={confirmDeleteHistoryImage}
        showIcon={false}
        size="md"
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
      <ModalContent className="bg-content1 border-content3 text-foreground">
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
                onChange={e => setSelectedLLMModel(e.target.value)}
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
                    onChange={e =>
                      setSplitOptions({ ...splitOptions, includeCameraMovement: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-500 text-orange-500 focus:ring-orange-500"
                  />
                  <label className="text-sm text-slate-700 dark:text-slate-300">包含运镜信息</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={splitOptions.includeCharacterDetails}
                    onChange={e =>
                      setSplitOptions({
                        ...splitOptions,
                        includeCharacterDetails: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-gray-500 text-orange-500 focus:ring-orange-500"
                  />
                  <label className="text-sm text-slate-700 dark:text-slate-300">包含角色细节</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={splitOptions.includeSceneDetails}
                    onChange={e =>
                      setSplitOptions({ ...splitOptions, includeSceneDetails: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-500 text-orange-500 focus:ring-orange-500"
                  />
                  <label className="text-sm text-slate-700 dark:text-slate-300">包含场景细节</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={splitOptions.focusOnAction}
                    onChange={e =>
                      setSplitOptions({ ...splitOptions, focusOnAction: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-500 text-orange-500 focus:ring-orange-500"
                  />
                  <label className="text-sm text-slate-700 dark:text-slate-300">专注于动作</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={splitOptions.focusOnEmotion}
                    onChange={e =>
                      setSplitOptions({ ...splitOptions, focusOnEmotion: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-500 text-orange-500 focus:ring-orange-500"
                  />
                  <label className="text-sm text-slate-700 dark:text-slate-300">
                    专注于情感表达
                  </label>
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
                    onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
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
                    onChange={e => setMaxTokens(parseInt(e.target.value))}
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-sm text-slate-900 dark:text-white"
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

// 角色资产选择器模态框
const CharacterSelectorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  onSelect: (asset: CharacterAsset) => void;
  onClear: () => void;
  currentId?: string;
}> = ({ isOpen, onClose, assets, onSelect, onClear, currentId }) => {
  const characterAssets = assets.filter((a): a is CharacterAsset => a.type === AssetType.CHARACTER);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    const loadImageUrls = async () => {
      const newLoading = new Set<string>();

      for (const asset of characterAssets) {
        const currentImage =
          asset.generatedImages?.find(img => img.id === asset.currentImageId) ||
          asset.generatedImages?.[0];
        if (currentImage?.path && !imageUrls[currentImage.path]) {
          newLoading.add(asset.id);
          try {
            const url = await storageService.getAssetUrl(currentImage.path);
            if (url) {
              setImageUrls(prev => ({ ...prev, [currentImage.path]: url }));
            }
          } catch (e) {
            console.error('加载角色图片失败:', e);
          }
        }
      }

      setLoadingImages(newLoading);
    };

    loadImageUrls();
  }, [isOpen, characterAssets]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} className="w-full max-w-3xl">
      <ModalContent className="bg-content1 border-content3 text-foreground">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <h3>选择角色参考图</h3>
            <Button size="sm" variant="flat" color="danger" onPress={onClear}>
              清除选择
            </Button>
          </div>
        </ModalHeader>
        <ModalBody>
          {characterAssets.length === 0 ? (
            <div className="text-center py-8 text-slate-400">暂无角色资产</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {characterAssets.map(asset => {
                const currentImage =
                  asset.generatedImages?.find(img => img.id === asset.currentImageId) ||
                  asset.generatedImages?.[0];
                const imageUrl = currentImage?.path ? imageUrls[currentImage.path] : undefined;
                const isLoading = loadingImages.has(asset.id);

                return (
                  <div
                    key={asset.id}
                    className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                      currentId === asset.id
                        ? 'border-primary bg-primary/10'
                        : 'border-content3 hover:border-slate-400'
                    }`}
                    onClick={() => {
                      onSelect(asset);
                      onClose();
                    }}
                  >
                    <div className="aspect-square bg-content2 rounded overflow-hidden mb-2">
                      {isLoading ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Spinner size="sm" />
                        </div>
                      ) : imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Users size={32} className="text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium truncate">{asset.name}</div>
                  </div>
                );
              })}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            取消
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

// 场景资产选择器模态框
const SceneSelectorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  assets: Asset[];
  onSelect: (asset: SceneAsset) => void;
  onClear: () => void;
  currentId?: string;
}> = ({ isOpen, onClose, assets, onSelect, onClear, currentId }) => {
  const sceneAssets = assets.filter((a): a is SceneAsset => a.type === AssetType.SCENE);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    const loadImageUrls = async () => {
      const newLoading = new Set<string>();

      for (const asset of sceneAssets) {
        const currentImage =
          asset.generatedImages?.find(img => img.id === asset.currentImageId) ||
          asset.generatedImages?.[0];
        if (currentImage?.path && !imageUrls[currentImage.path]) {
          newLoading.add(asset.id);
          try {
            const url = await storageService.getAssetUrl(currentImage.path);
            if (url) {
              setImageUrls(prev => ({ ...prev, [currentImage.path]: url }));
            }
          } catch (e) {
            console.error('加载场景图片失败:', e);
          }
        }
      }

      setLoadingImages(newLoading);
    };

    loadImageUrls();
  }, [isOpen, sceneAssets]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onClose} className="w-full max-w-3xl">
      <ModalContent className="bg-content1 border-content3 text-foreground">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <h3>选择场景参考图</h3>
            <Button size="sm" variant="flat" color="danger" onPress={onClear}>
              清除选择
            </Button>
          </div>
        </ModalHeader>
        <ModalBody>
          {sceneAssets.length === 0 ? (
            <div className="text-center py-8 text-slate-400">暂无场景资产</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {sceneAssets.map(asset => {
                const currentImage =
                  asset.generatedImages?.find(img => img.id === asset.currentImageId) ||
                  asset.generatedImages?.[0];
                const imageUrl = currentImage?.path ? imageUrls[currentImage.path] : undefined;
                const isLoading = loadingImages.has(asset.id);

                return (
                  <div
                    key={asset.id}
                    className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                      currentId === asset.id
                        ? 'border-primary bg-primary/10'
                        : 'border-content3 hover:border-slate-400'
                    }`}
                    onClick={() => {
                      onSelect(asset);
                      onClose();
                    }}
                  >
                    <div className="aspect-video bg-content2 rounded overflow-hidden mb-2">
                      {isLoading ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Spinner size="sm" />
                        </div>
                      ) : imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MapPin size={32} className="text-slate-400" />
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium truncate">{asset.name}</div>
                  </div>
                );
              })}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            取消
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
