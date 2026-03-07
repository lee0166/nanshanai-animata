import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Script, ScriptParseState, ScriptCharacter, ScriptScene, ScriptItem, Shot, CharacterAsset, SceneAsset, FragmentAsset, ItemAsset, AssetType, ModelConfig } from '../types';
import { storageService } from '../services/storage';
import { createScriptParser, ParseProgressCallback, ScriptParserConfig } from '../services/scriptParser';
import { TextCleaner } from '../services/textCleaner';
import { useApp } from '../contexts/context';
import { useToast } from '../contexts/ToastContext';
import { CharacterMapping } from '../components/ScriptParser/CharacterMapping';
import { SceneMapping } from '../components/ScriptParser/SceneMapping';
import { ItemMapping } from '../components/ScriptParser/ItemMapping';
import { ShotList } from '../components/ScriptParser/ShotList';
import { QualityReport } from '../services/scriptParser';
import type { RuleViolation } from '../services/parsing/ShortDramaRules';
import { DetailedQualityReport } from '../services/parsing/QualityAnalyzer';
import QualityReportCard from '../components/ScriptParser/QualityReportCard';
import { VectorMemoryToggle } from '../components/VectorMemoryToggle';
import { vectorMemoryConfig } from '../services/parsing/VectorMemoryConfig';
import { ParseConfigConfirmModal } from '../components/ParseConfigConfirmModal';
import { ModelDownloadProgress } from '../components/ModelDownloadProgress';
import { EmbeddingService } from '../services/parsing/EmbeddingService';

// Professional Analysis Components
import { SoundDesignTab } from '../src/components/ScriptParser/SoundDesignTab';
import { StructureDetailTab } from '../src/components/ScriptParser/StructureDetailTab';

// Script Analysis Components
import { StoryOverviewCard } from '../components/ScriptAnalysis/StoryOverviewCard';
import { VisualStyleCard } from '../components/ScriptAnalysis/VisualStyleCard';
import { EmotionalArcChart } from '../components/ScriptAnalysis/EmotionalArcChart';
import { StoryStructureDiagram } from '../components/ScriptAnalysis/StoryStructureDiagram';
import {
  Button,
  Card,
  CardBody,
  Tabs,
  Tab,
  Progress,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Input,
  Select,
  SelectItem,
  Divider,
  Badge,
  Switch
} from "@heroui/react";
import { FileText, Upload, Play, RotateCcw, Users, MapPin, Film, CheckCircle2, AlertCircle, Brain, Box, Trash2, Sparkles, AlertTriangle, Info, BookOpen, Layout, Palette, Music } from 'lucide-react';

interface ScriptManagerProps {
  projectId?: string;
  initialTab?: 'scripts' | 'shots';
}

const ScriptManager: React.FC<ScriptManagerProps> = ({ projectId: propProjectId, initialTab = 'scripts' }) => {
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const projectId = propProjectId || urlProjectId;
  const navigate = useNavigate();
  const { settings, isConnected, checkConnection, t } = useApp();
  const { showToast } = useToast();

  const [scripts, setScripts] = useState<Script[]>([]);
  const [currentScript, setCurrentScript] = useState<Script | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStage, setParseStage] = useState<string>('');
  const [activeParseButton, setActiveParseButton] = useState<string | null>(null); // Track which button is loading

  // Quality report state
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);

  // Delete confirmation modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [scriptToDelete, setScriptToDelete] = useState<Script | null>(null);
  const [deleteStats, setDeleteStats] = useState<{ characters: number; scenes: number; items: number; shots: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Note: Step-by-step parsing has been removed in v2
  // All parsing now goes through handleParseScript with automatic strategy selection

  // Script content for upload
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptContent, setScriptContent] = useState('');
  const [scriptWordCount, setScriptWordCount] = useState(0); // 字数统计
  const [useVectorMemory, setUseVectorMemory] = useState(() => {
    // 从配置读取初始状态，尊重用户手动选择
    return vectorMemoryConfig.getConfig().enabled;
  }); // 智能记忆开关

  // Parse config confirmation modal
  const [showParseConfirm, setShowParseConfirm] = useState(false);

  // Model download modal
  const [showModelDownloadModal, setShowModelDownloadModal] = useState(false);
  const [modelDownloadState, setModelDownloadState] = useState({
    status: 'idle' as 'idle' | 'downloading' | 'success' | 'error',
    progress: 0,
    retryCount: 0
  });
  const [embeddingService] = useState(() => new EmbeddingService());

  // Existing assets for mapping
  const [existingCharacters, setExistingCharacters] = useState<CharacterAsset[]>([]);
  const [existingScenes, setExistingScenes] = useState<SceneAsset[]>([]);
  const [existingItems, setExistingItems] = useState<ItemAsset[]>([]);
  const [existingFragments, setExistingFragments] = useState<FragmentAsset[]>([]);

  // LLM Model selection
  const [llmModels, setLlmModels] = useState<ModelConfig[]>([]);
  const [selectedLlmModelId, setSelectedLlmModelId] = useState<string>('');

  // Refs for cleanup
  const parserRef = useRef<ReturnType<typeof createScriptParser> | null>(null);
  const isMountedRef = useRef(true);

  // Check if in standalone mode (no projectId)
  const isStandaloneMode = !projectId;

  // Load scripts and assets
  useEffect(() => {
    isMountedRef.current = true;

    loadScripts();
    loadExistingAssets();
    loadLlmModels();

    return () => {
      isMountedRef.current = false;
      // Cancel ongoing parsing
      if (parserRef.current) {
        parserRef.current.cancel();
        parserRef.current = null;
      }
    };
  }, [projectId]);

  // Restore quality report from parseState when currentScript changes
  useEffect(() => {
    console.log('[ScriptManager] ========== useEffect: currentScript changed ==========');
    console.log('[ScriptManager] currentScript exists:', !!currentScript);
    console.log('[ScriptManager] parseState exists:', !!currentScript?.parseState);
    console.log('[ScriptManager] qualityReport exists:', !!currentScript?.parseState?.qualityReport);

    if (currentScript?.parseState?.qualityReport) {
      const report = currentScript.parseState.qualityReport;
      console.log('[ScriptManager] Restoring quality report:', {
        score: report.score,
        violationsCount: report.violations?.length,
        suggestionsCount: report.suggestions?.length,
        type: typeof report
      });
      setQualityReport(report);
      console.log('[ScriptManager] ========== Quality Report Restored ==========');
    } else {
      console.log('[ScriptManager] No quality report in parseState, setting to null');
      setQualityReport(null);
    }
  }, [currentScript]);

  // Load LLM models from settings (same mechanism as image/video models)
  const loadLlmModels = () => {
    const models = settings.models.filter(m => m.type === 'llm');
    setLlmModels(models);
    // Set default model if available and none selected
    if (models.length > 0 && !selectedLlmModelId) {
      const defaultModel = models.find(m => m.isDefault) || models[0];
      setSelectedLlmModelId(defaultModel.id);
    }
  };

  const loadScripts = async () => {
    try {
      let data: Script[];
      if (projectId) {
        data = await storageService.getScripts(projectId);
      } else {
        // Standalone mode: load all scripts
        data = await storageService.getAllScripts();
      }
      setScripts(data);
      if (data.length > 0 && !currentScript) {
        setCurrentScript(data[0]);
      }
    } catch (error) {
      console.error('Failed to load scripts:', error);
      setScripts([]);
    }
  };

  const loadExistingAssets = async () => {
    if (!projectId) {
      // Standalone mode: no project assets
      setExistingCharacters([]);
      setExistingScenes([]);
      setExistingItems([]);
      setExistingFragments([]);
      return;
    }
    try {
      const assets = await storageService.getAssets(projectId);
      setExistingCharacters(assets.filter(a => a.type === AssetType.CHARACTER) as CharacterAsset[]);
      setExistingScenes(assets.filter(a => a.type === AssetType.SCENE) as SceneAsset[]);
      setExistingItems(assets.filter(a => a.type === AssetType.ITEM) as ItemAsset[]);
      setExistingFragments(assets.filter(a => a.type === AssetType.VIDEO_SEGMENT) as FragmentAsset[]);
    } catch (error) {
      console.error('Failed to load assets:', error);
      setExistingCharacters([]);
      setExistingScenes([]);
      setExistingItems([]);
      setExistingFragments([]);
    }
  };

  // Handle delete script
  const handleDeleteScript = async () => {
    if (!scriptToDelete || !projectId) return;

    setIsDeleting(true);
    try {
      const stats = await storageService.deleteScript(scriptToDelete.id, projectId);
      // Remove from list
      const updatedScripts = scripts.filter(s => s.id !== scriptToDelete.id);
      setScripts(updatedScripts);
      // If deleted current script, select another or null
      if (currentScript?.id === scriptToDelete.id) {
        setCurrentScript(updatedScripts.length > 0 ? updatedScripts[0] : null);
      }
      showToast(`剧本删除成功，同时删除了 ${stats.characters} 个角色、${stats.scenes} 个场景、${stats.items} 个物品`, 'success');
    } catch (error: any) {
      showToast(`删除失败: ${error.message}`, 'error');
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setScriptToDelete(null);
      setDeleteStats(null);
    }
  };

  // Open delete confirmation modal
  const openDeleteModal = async (script: Script) => {
    setScriptToDelete(script);
    setIsDeleteModalOpen(true);
    // 获取关联资源统计
    try {
      const assets = await storageService.getAssets(projectId!);
      const relatedAssets = assets.filter(a => a.scriptId === script.id);
      // 计算分镜数量（从剧本的 parseState 中读取）
      const shotCount = script.parseState?.shots?.length || 0;
      setDeleteStats({
        characters: relatedAssets.filter(a => a.type === AssetType.CHARACTER).length,
        scenes: relatedAssets.filter(a => a.type === AssetType.SCENE).length,
        items: relatedAssets.filter(a => a.type === AssetType.ITEM).length,
        shots: shotCount
      });
    } catch (error) {
      console.error('Failed to get delete stats:', error);
      setDeleteStats({ characters: 0, scenes: 0, items: 0, shots: 0 });
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawText = await file.text();
      
      // 检测文本编码问题
      const issues = TextCleaner.detectEncodingIssues(rawText);
      if (issues.length > 0) {
        console.log('[ScriptManager] Detected encoding issues:', issues);
      }
      
      // 清洗文本
      const cleanResult = TextCleaner.process(rawText);
      console.log('[ScriptManager] Text cleaned:', {
        originalLength: cleanResult.stats.originalLength,
        cleanedLength: cleanResult.stats.cleanedLength,
        removedChars: cleanResult.stats.removedChars,
        chapterCount: cleanResult.stats.chapterCount
      });
      
      setScriptContent(cleanResult.cleanedText);
      
      // 统计字数
      const wordCount = cleanResult.cleanedText.length;
      setScriptWordCount(wordCount);
      
      // 自动检测是否需要启用智能记忆
      // 只有用户未手动开启时，才根据字数自动检测
      const config = vectorMemoryConfig.getConfig();
      if (!config.enabled) {
        const shouldEnable = vectorMemoryConfig.shouldEnable(wordCount);
        setUseVectorMemory(shouldEnable);
        // 同时更新配置
        if (shouldEnable) {
          vectorMemoryConfig.setEnabled(true);
        }
      }
      // 如果用户已手动开启，保持开启状态，不做任何操作
      
      // 如果有多个章节，显示提示
      if (cleanResult.chapters.length > 1) {
        showToast(`检测到 ${cleanResult.chapters.length} 个章节`, 'info');
      }
      
      // Try to extract title from filename
      const title = file.name.replace(/\.[^/.]+$/, '');
      setScriptTitle(title);
    } catch (error: any) {
      showToast(`读取文件失败: ${error.message}`, 'error');
    }
  };

  // Create new script
  const handleCreateScript = async () => {
    if (!scriptTitle || !scriptContent) {
      showToast('请填写标题和内容', 'warning');
      return;
    }

    // Check file system connection
    const connected = await checkConnection();
    if (!connected) {
      showToast('文件系统未连接，请先选择工作目录', 'error');
      return;
    }

    // In standalone mode, use a default project ID
    const effectiveProjectId = projectId || 'standalone';

    const newScript: Script = {
      id: `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId: effectiveProjectId,
      title: scriptTitle,
      content: scriptContent,
      parseState: {
        stage: 'idle',
        progress: 0
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      await storageService.saveScript(newScript);
      setScripts([...scripts, newScript]);
      setCurrentScript(newScript);
      setIsUploadModalOpen(false);
      setScriptTitle('');
      setScriptContent('');
      showToast('剧本导入成功', 'success');
    } catch (error: any) {
      showToast(`保存失败: ${error.message}`, 'error');
    }
  };

  // Get selected LLM model config
  const getSelectedModel = (showError: boolean = true) => {
    const selectedModel = llmModels.find(m => m.id === selectedLlmModelId);
    if (!selectedModel) {
      if (showError) {
        showToast('请先在设置中配置并选择LLM模型', 'error');
      }
      return null;
    }
    if (!selectedModel.apiKey) {
      if (showError) {
        showToast('所选LLM模型未配置API密钥', 'error');
      }
      return null;
    }
    return selectedModel;
  };

  // Note: handleParseStage has been removed in v2
  // All parsing now goes through handleParseScript with automatic strategy selection

  // Parse script (full auto-parsing)
  const handleParseScript = async () => {
    if (!currentScript || !projectId) return;

    const selectedModel = getSelectedModel();
    if (!selectedModel) return;

    setActiveParseButton('full');
    setIsParsing(true);
    setParseProgress(0);
    setParseStage('准备解析...');

    try {
      // Create parser with model config and store ref for cleanup
      const parserConfig: Partial<ScriptParserConfig> = {
        useSemanticChunking: true,
        useDramaRules: true,
        dramaRulesMinScore: 60,
        useCache: true,
        cacheTTL: 3600000,
        enableVectorMemory: useVectorMemory,
        vectorMemoryConfig: useVectorMemory ? {
          autoEnableThreshold: 50000,
          chromaDbUrl: '/chroma',  // 使用 Vite 代理，避免 CORS
          collectionName: 'script_memory'
        } : undefined,
        // ✅ 启用迭代优化引擎
        enableIterativeRefinement: true,
        iterativeRefinementConfig: {
          maxIterations: 3,
          targetQualityScore: 85,
          minImprovementThreshold: 2,
          autoApplySafeRefinements: true,
          confidenceThreshold: 0.7,
          verboseLogging: true
        },
        // ✅ 启用时长预算规划（从设置中读取）
        useDurationBudget: settings.durationBudget?.useDurationBudget ?? false,
        targetPlatform: settings.durationBudget?.platform || 'douyin',
        paceType: settings.durationBudget?.pace || 'normal',
        useDynamicDuration: settings.durationBudget?.useDynamicDuration ?? false,
        useProductionPrompt: settings.durationBudget?.useProductionPrompt ?? false,
        useShotQC: settings.durationBudget?.useShotQC ?? false,
        qcAutoAdjust: settings.durationBudget?.qcAutoAdjust ?? false,
        qcTolerance: 0.15
      };
      const parser = createScriptParser(
        selectedModel.apiKey,
        selectedModel.apiUrl,
        selectedModel.modelId,
        selectedModel.provider,
        parserConfig
      );
      parserRef.current = parser;
      console.log('[ScriptManager] 完整解析模式，ScriptParser配置:', parserConfig);

      const onProgress: ParseProgressCallback = (stage, progress, message) => {
        // Check if component is still mounted before updating state
        if (!isMountedRef.current) return;

        setParseProgress(progress);
        const stageNames: Record<string, string> = {
          metadata: '提取元数据',
          characters: '分析角色',
          scenes: '分析场景',
          shots: '生成分镜',
          completed: '解析完成',
          error: '解析出错'
        };
        setParseStage(message || stageNames[stage] || stage);
      };

      const parseState = await parser.parseScript(
        currentScript.id,
        projectId,
        currentScript.content,
        onProgress
      );

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      // Update current script with parse state
      const updatedScript = { ...currentScript, parseState };
      setCurrentScript(updatedScript);

      if (parseState.stage === 'completed') {
        showToast('剧本解析完成', 'success');

        // Get quality report from parser
        console.log('[ScriptManager] ========== Getting Quality Report ==========');
        const report = parser.getQualityReport();
        console.log('[ScriptManager] Report from parser:', {
          exists: !!report,
          score: report?.score,
          type: typeof report,
          hasViolations: report?.violations ? report.violations.length > 0 : false,
          hasSuggestions: report?.suggestions ? report.suggestions.length > 0 : false
        });

        if (report) {
          setQualityReport(report);
          console.log('[ScriptManager] ========== Quality Report Set to State ==========');
        } else {
          console.warn('[ScriptManager] No quality report received from parser!');
        }
      } else if (parseState.stage === 'error') {
        showToast(`解析失败: ${parseState.error}`, 'error');
      }
    } catch (error: any) {
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) return;

      // Don't show error if parsing was cancelled
      if (error.name === 'AbortError') {
        showToast('解析已取消', 'info');
      } else {
        showToast(`解析失败: ${error.message}`, 'error');
      }
    } finally {
      // Check if component is still mounted before updating state
      if (isMountedRef.current) {
        setIsParsing(false);
        setActiveParseButton(null);
      }
      parserRef.current = null;
    }
  };

  // Update parse state
  const handleUpdateParseState = async (updates: Partial<ScriptParseState>) => {
    if (!currentScript || !projectId) return;

    const updatedState = { ...currentScript.parseState, ...updates };
    await storageService.updateScriptParseState(
      currentScript.id,
      projectId,
      () => updatedState
    );

    setCurrentScript({ ...currentScript, parseState: updatedState });
  };

  // Get parse status color
  const getParseStatusColor = (stage: string) => {
    switch (stage) {
      case 'completed': return 'success';
      case 'error': return 'danger';
      case 'idle': return 'default';
      default: return 'primary';
    }
  };

  // Render parse state info
  const renderParseState = () => {
    if (!currentScript) return null;
    const { parseState } = currentScript;

    // Determine which steps are available based on current stage
    const canParseMetadata = parseState.stage === 'idle' || parseState.stage === 'completed' || parseState.stage === 'error';
    const canParseCharacters = parseState.stage === 'idle' || parseState.stage === 'metadata' || parseState.stage === 'completed' || parseState.stage === 'error' || (parseState.stage === 'characters' && parseState.metadata);
    const canParseScenes = parseState.stage === 'idle' || parseState.stage === 'metadata' || parseState.stage === 'characters' || parseState.stage === 'completed' || parseState.stage === 'error' || (parseState.stage === 'scenes' && parseState.characters);
    const canParseShots = parseState.stage === 'idle' || parseState.stage === 'metadata' || parseState.stage === 'characters' || parseState.stage === 'scenes' || parseState.stage === 'completed' || parseState.stage === 'error';

    // Calculate step-by-step progress
    const getStepProgress = () => {
      const steps = [
        { key: 'metadata', label: '元数据', hasData: !!parseState.metadata },
        { key: 'characters', label: '角色', hasData: !!parseState.characters },
        { key: 'scenes', label: '场景', hasData: !!parseState.scenes },
        { key: 'shots', label: '分镜', hasData: !!parseState.shots }
      ];
      
      const completedCount = steps.filter(s => s.hasData).length;
      const nextStep = steps.find(s => !s.hasData);
      
      return {
        steps,
        completedCount,
        totalSteps: steps.length,
        nextStep,
        isComplete: completedCount === steps.length
      };
    };

    const stepProgress = getStepProgress();

    // Get main button text and icon based on stage
    const getMainButtonConfig = () => {
      switch (parseState.stage) {
        case 'idle':
          return { text: '一键解析', icon: <Play size={16} />, color: 'primary' as const };
        case 'completed':
        case 'error':
          return { text: '重新解析', icon: <RotateCcw size={16} />, variant: 'flat' as const };
        default:
          return { text: '继续解析', icon: <Play size={16} />, color: 'primary' as const };
      }
    };

    const mainButton = getMainButtonConfig();

    return (
      <Card className="mb-4">
        <CardBody>
          {/* Header: Status + Model Selection + Main Action */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-bold">解析状态</h3>
              <Chip color={getParseStatusColor(parseState.stage) as any} size="sm">
                {parseState.stage === 'idle' && '未开始'}
                {parseState.stage === 'metadata' && '提取元数据'}
                {parseState.stage === 'characters' && '分析角色'}
                {parseState.stage === 'scenes' && '分析场景'}
                {parseState.stage === 'shots' && '生成分镜'}
                {parseState.stage === 'completed' && '已完成'}
                {parseState.stage === 'error' && '出错'}
              </Chip>
            </div>
            <div className="flex items-center gap-2">
              {/* Model Selection - Always visible */}
              {llmModels.length > 0 ? (
                <Select
                  label=""
                  aria-label="选择解析模型"
                  placeholder="选择模型"
                  selectedKeys={selectedLlmModelId ? new Set([selectedLlmModelId]) : new Set()}
                  onChange={(e) => setSelectedLlmModelId(e.target.value)}
                  size="sm"
                  className="w-36"
                  isDisabled={isParsing}
                >
                  {llmModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </Select>
              ) : (
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  onPress={() => navigate('/settings')}
                >
                  配置模型
                </Button>
              )}

              {/* Main Action Button */}
              <Button
                size="sm"
                {...('color' in mainButton ? { color: mainButton.color } : { variant: mainButton.variant })}
                startContent={mainButton.icon}
                onPress={() => setShowParseConfirm(true)}
                isLoading={activeParseButton === 'full'}
                isDisabled={isParsing || llmModels.length === 0}
              >
                {mainButton.text}
              </Button>
            </div>
          </div>

          {/* Progress Bar - Show when parsing */}
          {isParsing && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-3">
                <Progress value={parseProgress} className="flex-1" aria-label="解析进度" />
                <span className="text-sm font-medium min-w-[3rem] text-right">{parseProgress.toFixed(2)}%</span>
              </div>
              <p className="text-sm text-center text-default-500">{parseStage}</p>
            </div>
          )}

          {/* Note: Step-by-step parsing UI has been removed in v2 */}

          {/* Completion Stats */}
          {parseState.stage === 'completed' && (
            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-default-200">
              <div className="text-center">
                <p className="text-2xl font-bold">{parseState.metadata?.characterCount || 0}</p>
                <p className="text-sm text-default-500">角色</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{parseState.metadata?.sceneCount || 0}</p>
                <p className="text-sm text-default-500">场景</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{parseState.shots?.length || 0}</p>
                <p className="text-sm text-default-500">分镜</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {Math.floor((parseState.shots?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0) / 60)}分
                  {(parseState.shots?.reduce((sum, s) => sum + (s.duration || 0), 0) || 0) % 60}秒
                </p>
                <p className="text-sm text-default-500">总时长</p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* File System Connection Warning */}
      {!isConnected && (
        <Card className="bg-warning-50 border-warning-200">
          <CardBody className="flex flex-row items-center gap-4">
            <AlertCircle className="text-warning-500" size={24} />
            <div className="flex-1">
              <p className="font-medium text-warning-700">文件系统未连接</p>
              <p className="text-sm text-warning-600">请先返回项目页面选择工作目录，才能使用剧本管理功能</p>
            </div>
            <Button
              color="warning"
              variant="flat"
              onPress={() => navigate(`/project/${projectId}`)}
            >
              返回项目
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">剧本管理</h1>
          <p className="text-default-500">导入剧本，自动解析角色、场景和分镜</p>
        </div>
        <div className="flex gap-2">
          <Select
            aria-label="选择剧本"
            placeholder="选择剧本"
            selectedKeys={currentScript ? new Set([currentScript.id]) : new Set()}
            onChange={(e) => {
              const script = scripts.find(s => s.id === e.target.value);
              setCurrentScript(script || null);
            }}
            className="w-64"
            isDisabled={!isConnected}
          >
            {scripts.map(script => (
              <SelectItem key={script.id} value={script.id}>
                {script.title}
              </SelectItem>
            ))}
          </Select>
          {currentScript && (
            <Button
              color="danger"
              variant="flat"
              startContent={<Trash2 size={18} />}
              onPress={() => openDeleteModal(currentScript)}
              isDisabled={!isConnected}
            >
              删除
            </Button>
          )}
          <Button
            color="primary"
            startContent={<Upload size={18} />}
            onPress={() => setIsUploadModalOpen(true)}
            isDisabled={!isConnected}
          >
            导入剧本
          </Button>
        </div>
      </div>

      {currentScript ? (
        <>
          {/* Parse State */}
          {renderParseState()}

          {/* Shot Manager View - 独立分镜管理视图 */}
          {initialTab === 'shots' && currentScript.parseState.stage === 'completed' ? (
            <div className="h-[calc(100vh-280px)] flex gap-4">
              {/* 左侧：分镜列表 */}
              <div className="w-80 flex-shrink-0">
                <ShotList
                  shots={currentScript.parseState.shots || []}
                  scenes={currentScript.parseState.scenes || []}
                  onShotsUpdate={(shots) => handleUpdateParseState({ shots })}
                  projectId={projectId || ''}
                  scriptId={currentScript.id}  // 传递当前剧本ID
                  viewMode="manager"
                />
              </div>
              {/* 右侧：关键帧详情 - 由ShotList内部管理 */}
            </div>
          ) : (
            /* Tabs - 剧本解析视图 */
            <Tabs aria-label="剧本解析结果">
              <Tab
                key="source"
                title={
                  <div className="flex items-center gap-2">
                    <FileText size={16} />
                    <span>原文</span>
                  </div>
                }
              >
                <Card>
                  <CardBody className="h-[420px] overflow-y-auto">
                    {currentScript.parseState.stage !== 'completed' && (
                      <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">💡</span>
                          <span className="text-sm font-medium text-primary-700">
                            提示：解析完成后可查看角色、场景等分析结果
                          </span>
                        </div>
                      </div>
                    )}
                    <pre className="whitespace-pre-wrap font-mono text-sm text-default-700">
                      {currentScript.content}
                    </pre>
                  </CardBody>
                </Card>
              </Tab>

              {/* Overview Tab - 剧本概览 */}
              {currentScript.parseState.stage === 'completed' && currentScript.parseState.metadata && (
                <Tab
                  key="overview"
                  title={
                    <div className="flex items-center gap-2">
                      <BookOpen size={16} />
                      <span>概览</span>
                    </div>
                  }
                >
                  <Card>
                    <CardBody className="h-[420px] overflow-y-auto">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Story Overview */}
                        <StoryOverviewCard
                          metadata={currentScript.parseState.metadata}
                          t={{}}
                        />
                        
                        {/* Visual Style */}
                        <VisualStyleCard
                          metadata={currentScript.parseState.metadata}
                          t={{}}
                        />
                        
                        {/* Emotional Arc - Full Width */}
                        <div className="lg:col-span-2">
                          <EmotionalArcChart
                            emotionalArc={currentScript.parseState.metadata.emotionalArc}
                            overallMood={currentScript.parseState.metadata.overallMood}
                            t={{}}
                          />
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </Tab>
              )}

              {/* Structure Tab - 故事结构 */}
              {currentScript.parseState.stage === 'completed' && currentScript.parseState.metadata?.storyStructure && (
                <Tab
                  key="structure"
                  title={
                    <div className="flex items-center gap-2">
                      <Layout size={16} />
                      <span>结构</span>
                    </div>
                  }
                >
                  <Card>
                    <CardBody className="h-[420px] overflow-y-auto">
                      <StoryStructureDiagram
                        storyStructure={currentScript.parseState.metadata.storyStructure}
                        t={{}}
                      />
                    </CardBody>
                  </Card>
                </Tab>
              )}

              {/* Visual Tab - 视觉风格详情 */}
              {currentScript.parseState.stage === 'completed' && currentScript.parseState.metadata?.visualStyle && (
                <Tab
                  key="visual"
                  title={
                    <div className="flex items-center gap-2">
                      <Palette size={16} />
                      <span>视觉</span>
                    </div>
                  }
                >
                  <Card>
                    <CardBody className="h-[420px] overflow-y-auto">
                      <VisualStyleCard
                        metadata={currentScript.parseState.metadata}
                        t={{}}
                      />
                    </CardBody>
                  </Card>
                </Tab>
              )}

              {/* Sound Design Tab - 声音设计分析 */}
              {currentScript.parseState.stage === 'completed' && currentScript.parseState.metadata?.emotionalArc && (
                <Tab
                  key="sound"
                  title={
                    <div className="flex items-center gap-2">
                      <Music size={16} />
                      <span>声音</span>
                    </div>
                  }
                >
                  <Card>
                    <CardBody className="h-[420px] overflow-y-auto">
                      <SoundDesignTab
                        metadata={currentScript.parseState.metadata}
                        shots={currentScript.parseState.shots || []}
                      />
                    </CardBody>
                  </Card>
                </Tab>
              )}

              {/* Structure Detail Tab - 剧本结构详细分析 */}
              {currentScript.parseState.stage === 'completed' && currentScript.parseState.metadata?.storyStructure && (
                <Tab
                  key="structure-detail"
                  title={
                    <div className="flex items-center gap-2">
                      <Layout size={16} />
                      <span>结构分析</span>
                    </div>
                  }
                >
                  <Card>
                    <CardBody className="h-[420px] overflow-y-auto">
                      <StructureDetailTab
                        metadata={currentScript.parseState.metadata}
                      />
                    </CardBody>
                  </Card>
                </Tab>
              )}

              {currentScript.parseState.stage === 'completed' && (
                <>
                  <Tab
                    key="characters"
                    title={
                      <div className="flex items-center gap-2">
                        <Users size={16} />
                        <span>角色 ({currentScript.parseState.characters?.length || 0})</span>
                      </div>
                    }
                  >
                    <Card>
                      <CardBody className="h-[420px] overflow-y-auto">
                        <CharacterMapping
                          projectId={projectId!}
                          scriptId={currentScript.id}
                          scriptCharacters={currentScript.parseState.characters || []}
                          existingCharacters={existingCharacters}
                          onCharactersUpdate={(characters) => handleUpdateParseState({ characters })}
                          onCharacterCreated={loadExistingAssets}
                        />
                      </CardBody>
                    </Card>
                  </Tab>

                  <Tab
                    key="scenes"
                    title={
                      <div className="flex items-center gap-2">
                        <MapPin size={16} />
                        <span>场景 ({currentScript.parseState.scenes?.length || 0})</span>
                      </div>
                    }
                  >
                    <Card>
                      <CardBody className="h-[420px] overflow-y-auto">
                        <SceneMapping
                          projectId={projectId!}
                          scriptId={currentScript.id}
                          scriptScenes={currentScript.parseState.scenes || []}
                          existingScenes={existingScenes}
                          onScenesUpdate={(scenes) => handleUpdateParseState({ scenes })}
                          onSceneCreated={loadExistingAssets}
                        />
                      </CardBody>
                    </Card>
                  </Tab>

                  <Tab
                    key="items"
                    title={
                      <div className="flex items-center gap-2">
                        <Box size={16} />
                        <span>道具 ({currentScript.parseState.items?.length || 0})</span>
                      </div>
                    }
                  >
                    <Card>
                      <CardBody className="h-[420px] overflow-y-auto">
                        <ItemMapping
                          projectId={projectId!}
                          scriptId={currentScript.id}
                          scriptItems={currentScript.parseState.items || []}
                          existingItems={existingItems}
                          onItemsUpdate={(items) => handleUpdateParseState({ items })}
                          onItemCreated={loadExistingAssets}
                        />
                      </CardBody>
                    </Card>
                  </Tab>

                  <Tab
                    key="shots"
                    title={
                      <div className="flex items-center gap-2">
                        <Film size={16} />
                        <span>分镜 ({currentScript.parseState.shots?.length || 0})</span>
                      </div>
                    }
                  >
                    <Card>
                      <CardBody className="h-[420px] overflow-y-auto">
                        <ShotList
                          shots={currentScript.parseState.shots || []}
                          scenes={currentScript.parseState.scenes || []}
                          onShotsUpdate={(shots) => handleUpdateParseState({ shots })}
                          projectId={projectId || ''}
                          scriptId={currentScript.id}  // 传递当前剧本ID
                          viewMode="list"
                          headerAction={
                            <Button
                              color="primary"
                              variant="flat"
                              size="sm"
                              startContent={<Film size={16} />}
                              onPress={() => navigate(`/project/${projectId}/shots`)}
                            >
                              打开分镜管理
                            </Button>
                          }
                        />
                      </CardBody>
                    </Card>
                  </Tab>

                  {/* Quality Assessment Tab */}
                  <Tab
                    key="quality"
                    title={
                      <div className="flex items-center gap-2">
                        <Sparkles size={16} />
                        <span>质量评估</span>
                        {qualityReport && (
                          <Chip
                            size="sm"
                            color={qualityReport.score >= 80 ? 'success' : qualityReport.score >= 60 ? 'primary' : qualityReport.score >= 40 ? 'warning' : 'danger'}
                            variant="flat"
                          >
                            {qualityReport.score}分
                          </Chip>
                        )}
                      </div>
                    }
                  >
                    <Card>
                      <CardBody className="h-[420px] overflow-y-auto">
                        {qualityReport ? (
                          <QualityReportCard
                            report={qualityReport as unknown as DetailedQualityReport}
                            t={t}
                          />
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center">
                            <Sparkles size={48} className="text-default-300 mb-4" />
                            <p className="text-default-500 mb-2">暂无质量评估数据</p>
                            <p className="text-default-400 text-sm">请先完成剧本解析以查看质量评估</p>
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  </Tab>
                </>
              )}
            </Tabs>
          )}
        </>
      ) : (
        <Card>
          <CardBody className="py-12 text-center">
            <FileText size={48} className="mx-auto text-default-300 mb-4" />
            <p className="text-default-500">暂无剧本，请先导入</p>
            <Button
              color="primary"
              className="mt-4"
              startContent={<Upload size={18} />}
              onPress={() => setIsUploadModalOpen(true)}
            >
              导入剧本
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Upload Modal */}
      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>导入剧本</ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="剧本标题"
              placeholder="输入剧本标题"
              value={scriptTitle}
              onChange={(e) => setScriptTitle(e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium mb-2">上传文件（可选）</label>
              <input
                type="file"
                accept=".txt,.md,.docx"
                onChange={handleFileUpload}
                className="block w-full text-sm text-default-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary-50 file:text-primary-700
                  hover:file:bg-primary-100"
              />
            </div>

            <Textarea
              label="剧本内容"
              placeholder="粘贴剧本内容或上传文件..."
              value={scriptContent}
              onChange={(e) => {
                const newContent = e.target.value;
                setScriptContent(newContent);
                // 实时更新字数统计
                const newWordCount = newContent.length;
                setScriptWordCount(newWordCount);
                // 重新检测
                const shouldEnable = vectorMemoryConfig.shouldEnable(newWordCount);
                setUseVectorMemory(shouldEnable);
              }}
              minRows={10}
            />

            {/* 智能记忆开关 - 始终显示 */}
            <VectorMemoryToggle
              wordCount={scriptWordCount}
              onToggle={async (enabled) => {
                if (enabled) {
                  // 开启智能记忆，显示下载弹窗
                  setShowModelDownloadModal(true);
                  
                  // 订阅下载进度
                  const unsubscribe = embeddingService.onDownloadProgress((state) => {
                    setModelDownloadState(state);
                  });

                  try {
                    // 尝试初始化（会自动下载模型）
                    await embeddingService.initialize();
                    
                    // 下载成功
                    setUseVectorMemory(true);
                    vectorMemoryConfig.setEnabled(true);
                    
                    // 延迟关闭弹窗
                    setTimeout(() => {
                      setShowModelDownloadModal(false);
                    }, 1500);
                  } catch (error) {
                    console.error('[ScriptManager] Model download failed:', error);
                  } finally {
                    unsubscribe();
                  }
                } else {
                  // 关闭智能记忆
                  setUseVectorMemory(false);
                  vectorMemoryConfig.setEnabled(false);
                }
              }}
              showAutoDetect={true}
            />

            <div className="text-sm text-default-500">
              <p>支持格式：</p>
              <ul className="list-disc list-inside">
                <li>纯文本 (.txt)</li>
                <li>Markdown (.md)</li>
                <li>Word文档 (.docx)</li>
              </ul>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsUploadModalOpen(false)}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleCreateScript}
              isDisabled={!scriptTitle || !scriptContent}
            >
              导入
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
        <ModalContent>
          <ModalHeader className="text-danger">确认删除剧本</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p className="text-default-600">
                确定要删除剧本《<span className="font-semibold">{scriptToDelete?.title}</span>》吗？
              </p>

              <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
                <p className="text-danger-700 font-medium mb-2">⚠️ 警告：此操作将同时删除以下关联资源</p>
                {deleteStats ? (
                  <ul className="text-danger-600 space-y-1">
                    <li>• {deleteStats.characters} 个角色</li>
                    <li>• {deleteStats.scenes} 个场景</li>
                    <li>• {deleteStats.items} 个物品</li>
                    <li>• {deleteStats.shots} 个分镜</li>
                  </ul>
                ) : (
                  <p className="text-danger-600">正在统计关联资源...</p>
                )}
              </div>

              <p className="text-sm text-default-500">
                此操作不可恢复，删除后的资源将无法找回。
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsDeleteModalOpen(false)} isDisabled={isDeleting}>
              取消
            </Button>
            <Button color="danger" onPress={handleDeleteScript} isLoading={isDeleting}>
              确认删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Parse Config Confirmation Modal */}
      <ParseConfigConfirmModal
        isOpen={showParseConfirm}
        onClose={() => setShowParseConfirm(false)}
        onConfirm={() => {
          setShowParseConfirm(false);
          handleParseScript();
        }}
        scriptTitle={currentScript?.title || scriptTitle}
        wordCount={scriptWordCount || currentScript?.content?.length || 0}
        useVectorMemory={useVectorMemory}
        onVectorMemoryToggle={(enabled) => {
          setUseVectorMemory(enabled);
          vectorMemoryConfig.setEnabled(enabled);
        }}
        modelName={getSelectedModel(false)?.name || '深度求索 V3'}
        parseMode="完整解析"
      />

      {/* Model Download Progress Modal */}
      <ModelDownloadProgress
        isOpen={showModelDownloadModal}
        downloadState={modelDownloadState}
        onRetry={async () => {
          const unsubscribe = embeddingService.onDownloadProgress((state) => {
            setModelDownloadState(state);
          });

          try {
            await embeddingService.retryDownload();
            setUseVectorMemory(true);
            vectorMemoryConfig.setEnabled(true);
            setTimeout(() => {
              setShowModelDownloadModal(false);
            }, 1500);
          } catch (error) {
            console.error('[ScriptManager] Model retry failed:', error);
          } finally {
            unsubscribe();
          }
        }}
        onCancel={() => {
          setShowModelDownloadModal(false);
          setUseVectorMemory(false);
          vectorMemoryConfig.setEnabled(false);
        }}
        onUseStandardMode={() => {
          setShowModelDownloadModal(false);
          setUseVectorMemory(false);
          vectorMemoryConfig.setEnabled(false);
        }}
        manualGuide={embeddingService.getManualDownloadGuide()}
      />
    </div>
  );
};

export default ScriptManager;
