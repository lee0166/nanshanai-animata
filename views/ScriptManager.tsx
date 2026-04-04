import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Script,
  ScriptParseState,
  ScriptCharacter,
  ScriptScene,
  ScriptItem,
  Shot,
  CharacterAsset,
  SceneAsset,
  FragmentAsset,
  ItemAsset,
  AssetType,
  ModelConfig,
  CreativeIntent,
  ParseStage,
} from '../types';
import { storageService } from '../services/storage';
import {
  createScriptParser,
  ParseProgressCallback,
  ScriptParserConfig,
} from '../services/scriptParser';
import { useApp } from '../contexts/context';
import { useToast } from '../contexts/ToastContext';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { CharacterMapping } from '../components/ScriptParser/CharacterMapping';
import { SceneMapping } from '../components/ScriptParser/SceneMapping';
import { ItemMapping } from '../components/ScriptParser/ItemMapping';
import { ShotList } from '../components/ScriptParser/ShotList';
import { ScriptParseProgress } from '../components/ScriptParser/ScriptParseProgress';
import { QualityReport } from '../services/scriptParser';
import { DetailedQualityReport } from '../services/parsing/QualityAnalyzer';
import QualityReportCard from '../components/ScriptParser/QualityReportCard';
import { CreativeIntentModal } from '../components/CreativeIntentModal';
import TextCleaner from '../services/textCleaner';
import PerformanceReportCard from '../components/ScriptParser/PerformanceReportCard';
import { PerformanceReport as PerformanceReportType } from '../services/parsing/PerformanceMonitor';
import { DeleteConfirmModal } from '../components/Shared/DeleteConfirmModal';
import EpisodePlanViewer from '../components/ScriptParser/EpisodePlanViewer';
import CoherenceReportViewer from '../components/ScriptParser/CoherenceReportViewer';

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
  Switch,
  useDisclosure,
  Tooltip,
} from '@heroui/react';
import {
  FileText,
  Upload,
  Play,
  RotateCcw,
  Users,
  MapPin,
  Film,
  CheckCircle2,
  AlertCircle,
  Box,
  Trash2,
  Sparkles,
  Clock,
  Clapperboard,
  Award,
  Eye,
  Loader2,
  Music,
  Activity,
  Camera,
  User,
  Map,
  Library,
  BarChart3,
  Target,
  Info,
} from 'lucide-react';

interface ScriptManagerProps {
  projectId?: string;
  initialTab?: 'scripts' | 'shots';
  onScriptsUpdate?: () => void;
}

const ScriptManager: React.FC<ScriptManagerProps> = ({
  projectId: propProjectId,
  onScriptsUpdate,
  initialTab = 'scripts',
}) => {
  const { projectId: urlProjectId } = useParams<{ projectId: string }>();
  const projectId = propProjectId || urlProjectId;
  const navigate = useNavigate();
  const { settings, isConnected, checkConnection, t } = useApp();
  const { showToast } = useToast();

  const [scripts, setScripts] = useState<Script[]>([]);
  const [currentScript, setCurrentScript] = useState<Script | null>(null);
  const scriptsLoadedRef = useRef(false);
  const assetsLoadedRef = useRef(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseStage, setParseStage] = useState<string>('');
  const [parseStageKey, setParseStageKey] = useState<ParseStage>('idle');
  const [parseStageProgress, setParseStageProgress] = useState(0);
  const [activeParseButton, setActiveParseButton] = useState<string | null>(null);
  const [parseDetails, setParseDetails] = useState<{
    currentScene?: number;
    totalScenes?: number;
    currentBatch?: number;
    totalBatches?: number;
    elapsedTime?: number;
    estimatedRemainingTime?: number;
    subTaskInfo?: {
      current: number;
      total: number;
      currentName?: string;
    };
  }>({});

  // 使用ref保存最新状态，解决闭包陷阱
  const parseProgressRef = useRef(parseProgress);
  const parseStageProgressRef = useRef(parseStageProgress);

  // 同步状态到ref
  useEffect(() => {
    parseProgressRef.current = parseProgress;
    parseStageProgressRef.current = parseStageProgress;
  }, [parseProgress, parseStageProgress]);

  // 后台解析状态追踪
  const [isBackgroundParsing, setIsBackgroundParsing] = useState(false);

  // 2.0: 模型选择状态
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  // Quality report state
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);

  // Performance report state
  const [performanceReport, setPerformanceReport] = useState<PerformanceReportType | null>(null);

  // Delete confirmation modal
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [scriptToDelete, setScriptToDelete] = useState<Script | null>(null);
  const [deleteStats, setDeleteStats] = useState<{
    characters: number;
    scenes: number;
    items: number;
    shots: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Script content for upload
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptContent, setScriptContent] = useState('');
  const [scriptWordCount, setScriptWordCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [currentView, setCurrentView] = useState<'original' | 'cleaned'>('original');

  // Creative Intent Modal - 新的创作意图确认
  const [showCreativeIntent, setShowCreativeIntent] = useState(false);
  const [creativeIntent, setCreativeIntent] = useState<CreativeIntent>({
    filmStyle: 'film',
    narrativeFocus: {
      protagonistArc: true,
      emotionalCore: true,
      worldBuilding: false,
      visualSpectacle: true,
      thematicDepth: false,
    },
    emotionalTone: {
      primary: 'inspiring',
      intensity: 7,
    },
    visualReferences: [],
    creativeNotes: '',
    targetPlatforms: [],
  });

  // Existing assets for mapping
  const [existingCharacters, setExistingCharacters] = useState<CharacterAsset[]>([]);
  const [existingScenes, setExistingScenes] = useState<SceneAsset[]>([]);
  const [existingItems, setExistingItems] = useState<ItemAsset[]>([]);
  const [existingFragments, setExistingFragments] = useState<FragmentAsset[]>([]);

  // Refs
  const parserRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load scripts on mount
  useEffect(() => {
    if (projectId) {
      loadScripts();
      loadExistingAssets();
    }
  }, [projectId]);

  // Track scripts state changes
  // useEffect(() => {
  //   console.log('[ScriptManager] scripts state changed:', scripts.length, 'scripts');
  //   console.log(
  //     '[ScriptManager] scripts array:',
  //     scripts.map(s => ({ id: s.id, title: s.title }))
  //   );
  // }, [scripts]);

  // =============== 专门调试parseProgress变化！===============
  // useEffect(() => {
  //   console.log('[ScriptManager] ========== parseProgress STATE CHANGED ==========');
  //   console.log('[ScriptManager] parseProgress:', parseProgress);
  //   console.log('[ScriptManager] parseStageProgress:', parseStageProgress);
  // }, [parseProgress, parseStageProgress]);

  // Update quality report when script changes
  useEffect(() => {
    if (currentScript?.parseState?.stage === 'completed') {
      // console.log('[ScriptManager] ========== useEffect: currentScript changed ==========');
      // console.log('[ScriptManager] currentScript exists:', !!currentScript);
      // console.log('[ScriptManager] parseState exists:', !!currentScript?.parseState);
      // console.log(
      //   '[ScriptManager] qualityReport exists:',
      //   !!currentScript?.parseState?.qualityReport
      // );

      if (currentScript.parseState.qualityReport) {
        setQualityReport(currentScript.parseState.qualityReport);
        // console.log('[ScriptManager] Restoring quality report:', {
        //   score: currentScript.parseState.qualityReport.score,
        //   violationsCount: currentScript.parseState.qualityReport.violations?.length,
        //   suggestionsCount: currentScript.parseState.qualityReport.suggestions?.length,
        //   type: typeof currentScript.parseState.qualityReport,
        // });
        // console.log('[ScriptManager] ========== Quality Report Restored ==========');
      } else {
        setQualityReport(null);
        // console.log('[ScriptManager] No quality report in parseState, setting to null');
      }

      // Restore performance report
      // console.log(
      //   '[ScriptManager] performanceReport exists:',
      //   !!currentScript?.parseState?.performanceReport
      // );

      if (currentScript.parseState.performanceReport) {
        setPerformanceReport(currentScript.parseState.performanceReport);
        // console.log('[ScriptManager] Restoring performance report:', {
        //   totalDuration: currentScript.parseState.performanceReport.totalDuration,
        //   apiCallCount: currentScript.parseState.performanceReport.apiCallCount,
        //   type: typeof currentScript.parseState.performanceReport,
        // });
        // console.log('[ScriptManager] ========== Performance Report Restored ==========');
      } else {
        setPerformanceReport(null);
        // console.log('[ScriptManager] No performance report in parseState, setting to null');
      }
    } else {
      setQualityReport(null);
      setPerformanceReport(null);
    }
  }, [currentScript]);

  // 去重辅助函数 - 保留最新版本
  const deduplicateScripts = (scripts: Script[]): Script[] => {
    // 按updatedAt降序排序（最新的在前）
    const sortedScripts = [...scripts].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const seen: Record<string, boolean> = {};
    const result: Script[] = [];
    for (const script of sortedScripts) {
      if (!seen[script.id]) {
        seen[script.id] = true;
        result.push(script);
      }
    }
    return result;
  };

  const loadScripts = async () => {
    if (!projectId) {
      return;
    }

    if (scriptsLoadedRef.current) {
      return;
    }

    scriptsLoadedRef.current = true;

    const connected = await checkConnection();
    if (!connected) {
      scriptsLoadedRef.current = false;
      return;
    }

    try {
      const loadedScripts = await storageService.getScripts(projectId);
      const deduplicatedScripts = deduplicateScripts(loadedScripts);
      setScripts(deduplicatedScripts);
      if (deduplicatedScripts.length > 0 && !currentScript) {
        setCurrentScript(deduplicatedScripts[0]);
      }
    } catch (error) {
      console.error('[ScriptManager] Failed to load scripts:', error);
      showToast('加载剧本失败', 'error');
      scriptsLoadedRef.current = false;
    }
  };

  const loadExistingAssets = async () => {
    if (!projectId) return;

    if (assetsLoadedRef.current) {
      return;
    }

    assetsLoadedRef.current = true;

    const connected = await checkConnection();
    if (!connected) {
      assetsLoadedRef.current = false;
      return;
    }

    try {
      const assets = await storageService.getAssets(projectId);
      setExistingCharacters(assets.filter(a => a.type === AssetType.CHARACTER) as CharacterAsset[]);
      setExistingScenes(assets.filter(a => a.type === AssetType.SCENE) as SceneAsset[]);
      setExistingItems(assets.filter(a => a.type === AssetType.ITEM) as ItemAsset[]);
      setExistingFragments(
        assets.filter(a => a.type === AssetType.VIDEO_SEGMENT) as FragmentAsset[]
      );
    } catch (error) {
      console.error('[ScriptManager] Failed to load existing assets:', error);
      assetsLoadedRef.current = false;
    }
  };

  // 处理角色映射更新
  const handleCharactersUpdate = (updatedCharacters: ScriptCharacter[]) => {
    if (!currentScript) return;
    setCurrentScript({
      ...currentScript,
      parseState: {
        ...currentScript.parseState,
        characters: updatedCharacters,
      },
    });
  };

  // 处理场景映射更新
  const handleScenesUpdate = (updatedScenes: ScriptScene[]) => {
    if (!currentScript) return;
    setCurrentScript({
      ...currentScript,
      parseState: {
        ...currentScript.parseState,
        scenes: updatedScenes,
      },
    });
  };

  // 处理物品映射更新
  const handleItemsUpdate = (updatedItems: ScriptItem[]) => {
    if (!currentScript) return;
    setCurrentScript({
      ...currentScript,
      parseState: {
        ...currentScript.parseState,
        items: updatedItems,
      },
    });
  };

  // 2.0: 文件上传处理 - 支持多种文档格式
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // 支持的文件扩展名
      const supportedExtensions = ['.txt', '.md', '.markdown', '.docx', '.pdf'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (!supportedExtensions.includes(fileExtension)) {
        showToast(
          `不支持的文件格式: ${fileExtension}。请上传 .txt, .md, .docx 或 .pdf 格式`,
          'error'
        );
        return;
      }

      // 检查文件大小（最大50MB）
      if (file.size > 50 * 1024 * 1024) {
        showToast('文件大小超过50MB限制', 'error');
        return;
      }

      try {
        let content = '';

        if (fileExtension === '.docx') {
          // 解析 Word 文档
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          content = result.value;
        } else if (fileExtension === '.pdf') {
          // 解析 PDF 文档
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            text += textContent.items.map((item: any) => item.str).join(' ') + '\n';
          }
          content = text;
        } else {
          // 文本文件直接读取
          content = await file.text();
        }

        // 自动设置标题（使用文件名，去掉扩展名）
        const fileName = file.name.substring(0, file.name.lastIndexOf('.'));
        setScriptTitle(fileName);
        setScriptContent(content);
        // 计算字数
        const trimmed = content.trim();
        const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishWords = (trimmed.match(/[a-zA-Z]+/g) || []).length;
        const numbers = (trimmed.match(/\d+/g) || []).length;
        const wordCount = chineseChars + englishWords + numbers;
        showToast(`文件 "${file.name}" 读取成功（${wordCount.toLocaleString()} 字）`, 'success');
      } catch (error) {
        console.error('[ScriptManager] Failed to read file:', error);
        showToast('文件读取失败', 'error');
      }

      // 清空input，允许重复选择同一文件
      event.target.value = '';
    },
    [showToast]
  );

  const handleUploadScript = async () => {
    if (!scriptTitle.trim() || !scriptContent.trim()) {
      showToast('请输入标题和内容', 'error');
      return;
    }

    if (!projectId) {
      showToast('未选择项目', 'error');
      return;
    }

    // 2.0: 检查存储连接状态
    const connected = await checkConnection();
    if (!connected) {
      showToast('请先连接工作区', 'error');
      return;
    }

    try {
      // 使用 TextCleaner 清洗文本
      const cleanedContent = TextCleaner.clean(scriptContent);

      const newScript: Script = {
        id: `script_${Date.now()}`,
        projectId,
        title: scriptTitle.trim(),
        originalContent: scriptContent.trim(),
        content: cleanedContent,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        parseState: {
          stage: 'idle',
          progress: 0,
        },
      };

      await storageService.saveScript(newScript);

      // 重新加载脚本列表以确保状态一致性
      scriptsLoadedRef.current = false;
      await loadScripts();

      setCurrentScript(newScript);
      setIsUploadModalOpen(false);
      setScriptTitle('');
      setScriptContent('');
      showToast('剧本上传成功', 'success');
      // 通知父组件更新剧本列表
      onScriptsUpdate?.();
    } catch (error) {
      console.error('[ScriptManager] Failed to upload script:', error);
      showToast('上传剧本失败', 'error');
    }
  };

  // 2.0版本：打开创作意图确认弹窗
  const handleStartParse = () => {
    if (!currentScript) {
      showToast('请先选择剧本', 'error');
      return;
    }

    const selectedModel = getSelectedModel();
    if (!selectedModel) {
      showToast('请在设置中配置LLM模型', 'error');
      return;
    }

    // 打开创作意图确认弹窗，替代旧的ParseConfigConfirmModal
    setShowCreativeIntent(true);
  };

  // 2.0版本：用户确认创作意图后开始解析
  const handleParseWithIntent = async () => {
    setShowCreativeIntent(false);
    await handleParseScript();
  };

  const handleParseScript = async (resumeFromState?: ScriptParseState) => {
    if (!currentScript || !projectId) {
      showToast('Please select a script first', 'error');
      return;
    }

    const selectedModel = getSelectedModel();
    if (!selectedModel) {
      showToast('Please configure LLM model in settings', 'error');
      return;
    }

    // Check if model has API key
    if (!selectedModel.apiKey) {
      showToast('所选模型缺少API密钥，请在设置中配置', 'error');
      return;
    }

    setIsParsing(true);
    if (!resumeFromState) {
      setParseProgress(0);
      setParseStage('正在初始化...');
    } else {
      setParseProgress(resumeFromState.progress || 0);
      setParseStage(`从 ${resumeFromState.stage} 阶段恢复...`);
    }
    setActiveParseButton('full');

    try {
      // Create parser with v2.0 config - 移除所有基于字数的旧配置
      const parserConfig: ScriptParserConfig = {
        useSemanticChunking: true,
        useDramaRules: true,
        dramaRulesMinScore: 60,
        useCache: true,
        cacheTTL: 3600000,
        enableIterativeRefinement: true,
        iterativeRefinementConfig: {
          maxIterations: 3,
          targetQualityScore: 85,
          minImprovementThreshold: 2,
          autoApplySafeRefinements: true,
          confidenceThreshold: 0.7,
          verboseLogging: true,
        },
        // 2.0: 使用创作意图替代旧的durationBudgetConfig
        creativeIntent: creativeIntent,
        // 2.0: 启用BudgetPlanner，使用情节密度时长计算
        useDurationBudget: true,
        useDynamicDuration: false,
        useProductionPrompt: true, // 默认启用专业Prompt
        useShotQC: false, // 2.0: 移除基于字数的质检
        qcAutoAdjust: false,
        qcTolerance: 0.15,
      };

      const parser = createScriptParser(
        selectedModel.apiKey,
        selectedModel.apiUrl,
        selectedModel.modelId,
        selectedModel.provider,
        parserConfig
      );
      parserRef.current = parser;
      console.log('[ScriptManager] v2.0 Parser config:', parserConfig);

      // 2.0: 添加解析超时检测
      const parseStartTime = Date.now();
      const TIMEOUT_WARNING = 60000; // 60 秒后显示警告
      const LONG_WAIT_WARNING = 90000; // 90 秒后显示特殊等待提示
      let longWaitWarningShown = false;

      const onProgress: ParseProgressCallback = (stage, progress, message, details) => {
        // console.log(`[ScriptManager] ============== onProgress CALLED ==============`);
        // console.log(`[ScriptManager] stage=${stage}, progress=${progress}%, message=${message}`);
        // console.log(`[ScriptManager] details:`, details);
        // console.log(
        //   `[ScriptManager] BEFORE state - parseProgress: ${parseProgressRef.current}, parseStageProgress: ${parseStageProgressRef.current}`
        // );

        setParseProgress(progress);
        setParseStageKey(stage);
        // console.log(`[ScriptManager] Called setParseProgress(${progress})`);
        // console.log(`[ScriptManager] Called setParseStageKey(${stage})`);

        // Calculate stage progress from details if available
        // Priority 1: Use currentStageProgress if provided (most accurate)
        // Priority 2: Calculate from completed/pending stages
        // Priority 3: Estimate from overall progress within stage range
        let stageProg = 0;

        if (details?.currentStageProgress !== undefined) {
          // 移除 > 0 的限制！即使 0% 也要用！
          stageProg = details.currentStageProgress;
          // console.log(`[ScriptManager] Using provided currentStageProgress: ${stageProg}%`);
        } else if (details?.completedStages?.length || details?.pendingStages?.length) {
          // Calculate from stage completion status
          const completed = details.completedStages?.length || 0;
          const pending = details.pendingStages?.length || 0;
          const total = completed + pending + 1; // +1 for current stage
          stageProg = Math.round((completed / total) * 100);
          // console.log(`[ScriptManager] Calculated stageProg from completed/pending: ${stageProg}%`);
        } else {
          // Fallback: estimate based on overall progress within stage
          // Map overall progress (70-95) to stage progress (0-100) for shots stage
          if (stage === 'shots' && progress >= 70 && progress <= 95) {
            stageProg = Math.round(((progress - 70) / 25) * 100);
          } else if (stage === 'characters' && progress >= 25 && progress <= 35) {
            stageProg = Math.round(((progress - 25) / 10) * 100);
          } else if (stage === 'scenes' && progress >= 35 && progress <= 70) {
            stageProg = Math.round(((progress - 35) / 35) * 100);
          } else if (stage === 'metadata' && progress >= 10 && progress <= 20) {
            stageProg = Math.round(((progress - 10) / 10) * 100);
          } else {
            // 如果都不匹配，至少给一个基于时间的模拟进度
            stageProg = Math.min(95, Math.round((Date.now() - parseStartTime) / 1000));
            // console.log(`[ScriptManager] Using time-based fallback stageProg: ${stageProg}%`);
          }
          // console.log(`[ScriptManager] Calculated stageProg from fallback: ${stageProg}%`);
        }

        // console.log(`[ScriptManager] FINAL stageProg: ${stageProg}%`);
        // console.log(`[ScriptManager] Calling setParseStageProgress(${stageProg}%)`);
        setParseStageProgress(stageProg);
        // console.log(`[ScriptManager] ========== setParseStageProgress called ==========`);

        const stageNames: Record<string, string> = {
          metadata: '正在分析创作意图...',
          characters: '正在设计角色...',
          scenes: '正在规划场景...',
          shots: '正在创建分镜列表...',
          completed: '解析完成',
          error: '解析错误',
        };

        const baseMessage = message || stageNames[stage] || stage;
        const elapsed = Date.now() - parseStartTime;
        const elapsedSec = Math.floor(elapsed / 1000);

        let estimatedRemainingTime: number | undefined;
        if (progress > 0 && progress < 100) {
          const remainingProgress = 100 - progress;
          estimatedRemainingTime = Math.floor(((elapsed / progress) * remainingProgress) / 1000);
        }

        // Extract subTaskInfo from details if available
        const subTaskInfo = details?.subTaskInfo;

        setParseDetails({
          ...details,
          elapsedTime: elapsed,
          estimatedRemainingTime,
          subTaskInfo,
        });

        let displayMessage = baseMessage;

        if (stage === 'shots' && details?.totalScenes) {
          const sceneInfo = details.currentScene
            ? `场景 ${details.currentScene}/${details.totalScenes}`
            : `共 ${details.totalScenes} 个场景`;
          const batchInfo =
            details.currentBatch && details.totalBatches
              ? `，批次 ${details.currentBatch}/${details.totalBatches}`
              : '';
          displayMessage = `${baseMessage} (${sceneInfo}${batchInfo})`;
        }

        if (elapsed > 30000 && stage !== 'completed' && stage !== 'error') {
          let timeInfo = `已耗时${elapsedSec}秒`;
          if (estimatedRemainingTime && estimatedRemainingTime > 0) {
            const mins = Math.floor(estimatedRemainingTime / 60);
            const secs = estimatedRemainingTime % 60;
            if (mins > 0) {
              timeInfo += `，预计还需${mins}分${secs}秒`;
            } else {
              timeInfo += `，预计还需${secs}秒`;
            }
          }
          setParseStage(`${displayMessage} (${timeInfo}，模型响应较慢，请耐心等待...)`);
        } else {
          setParseStage(displayMessage);
        }

        // 90 秒后显示特殊等待提示（降低用户焦虑）
        if (
          elapsed > LONG_WAIT_WARNING &&
          !longWaitWarningShown &&
          stage !== 'completed' &&
          stage !== 'error'
        ) {
          showToast('正在处理大量数据，请稍候...（预计还需几分钟）', 'info');
          longWaitWarningShown = true;
        }
      };

      const parseState = await parser.parseScript(
        currentScript.id,
        projectId,
        currentScript.originalContent || currentScript.content,
        onProgress,
        resumeFromState
      );

      // Note: Removed isMountedRef check to fix React StrictMode issues
      const updatedScript = {
        ...currentScript,
        parseState,
        // 更新content为最新的原始内容，确保重新分析时使用正确的数据源
        content: currentScript.originalContent || currentScript.content,
      };
      setCurrentScript(updatedScript);

      if (parseState.stage === 'completed') {
        showToast('剧本分析完成', 'success');

        console.log('[ScriptManager] ========== Getting Quality Report ==========');
        const report = parser.getQualityReport();
        console.log('[ScriptManager] Report from parser:', {
          exists: !!report,
          score: report?.score,
          type: typeof report,
          hasViolations: report?.violations ? report.violations.length > 0 : false,
          hasSuggestions: report?.suggestions ? report.suggestions.length > 0 : false,
        });

        if (report) {
          setQualityReport(report);
          console.log('[ScriptManager] ========== Quality Report Set to State ==========');
        } else {
          console.warn('[ScriptManager] No quality report received from parser!');
        }

        // Get performance report
        console.log('[ScriptManager] ========== Getting Performance Report ==========');
        const perfReport = parser.getPerformanceReport();
        console.log('[ScriptManager] Performance report from parser:', {
          exists: !!perfReport,
          totalDuration: perfReport?.totalDuration,
          apiCallCount: perfReport?.apiCallCount,
          hasTokenEfficiency: !!perfReport?.tokenEfficiency,
          hasPercentiles: !!perfReport?.percentiles,
        });

        if (perfReport) {
          setPerformanceReport(perfReport);
          console.log('[ScriptManager] ========== Performance Report Set to State ==========');
        } else {
          console.warn('[ScriptManager] No performance report received from parser!');
        }

        // 保存更新后的脚本，确保重新分析的结果被持久化
        try {
          await storageService.saveScript(updatedScript);
          console.log('[ScriptManager] Script saved after reanalysis');
        } catch (error) {
          console.error('[ScriptManager] Failed to save script after reanalysis:', error);
          showToast('保存分析结果失败', 'error');
        }
      } else if (parseState.stage === 'error') {
        showToast(`解析失败: ${parseState.error}`, 'error');
      }
    } catch (error: any) {
      // Note: Removed isMountedRef check to fix React StrictMode issues
      console.error('[ScriptManager] Parse error:', error);

      // 处理API速率限制错误
      if (
        error.message?.includes('429') ||
        error.message?.includes('Too Many Requests') ||
        error.message?.includes('速率限制')
      ) {
        showToast('API请求过于频繁，请稍后再试（建议等待30秒）', 'error');
      } else if (error.name === 'AbortError') {
        showToast('解析已取消', 'info');
      } else {
        showToast(`解析失败: ${error.message || '未知错误'}`, 'error');
      }
    } finally {
      // Note: Removed isMountedRef check to fix React StrictMode issues
      setIsParsing(false);
      setIsBackgroundParsing(false);
      setActiveParseButton(null);
    }
  };

  const handleDeleteScript = async () => {
    if (!scriptToDelete || !projectId) return;

    setIsDeleting(true);
    try {
      await storageService.deleteScript(scriptToDelete.id, projectId);
      const updatedScripts = scripts.filter(s => s.id !== scriptToDelete.id);
      setScripts(updatedScripts);

      if (currentScript?.id === scriptToDelete.id) {
        setCurrentScript(updatedScripts.length > 0 ? updatedScripts[0] : null);
      }

      onDeleteClose();
      setScriptToDelete(null);
      showToast('Script deleted successfully', 'success');
    } catch (error) {
      console.error('[ScriptManager] Failed to delete script:', error);
      showToast('删除剧本失败', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteScript = (script: Script) => {
    setScriptToDelete(script);
    const stats = {
      characters: script.parseState?.characters?.length || 0,
      scenes: script.parseState?.scenes?.length || 0,
      items: script.parseState?.items?.length || 0,
      shots: script.parseState?.shots?.length || 0,
    };
    setDeleteStats(stats);
    onDeleteOpen();
  };

  // 2.0: 获取可用的LLM模型列表
  const getAvailableModels = useCallback((): ModelConfig[] => {
    return settings.models.filter(m => m.type === 'llm' && m.apiKey && (m.enabled ?? true));
  }, [settings.models]);

  // 2.0: 获取选中的模型（支持用户选择）
  const getSelectedModel = useCallback(
    (needApiKey: boolean = true): ModelConfig | null => {
      const llmModels = getAvailableModels();
      if (llmModels.length === 0) return null;

      // 如果用户选择了特定模型，使用它
      if (selectedModelId) {
        const selected = llmModels.find(m => m.id === selectedModelId);
        if (selected) return selected;
      }

      // 否则使用第一个可用的模型
      return llmModels[0];
    },
    [getAvailableModels, selectedModelId]
  );

  // Update word count when content changes
  useEffect(() => {
    if (scriptContent) {
      // 计算字数（中文字符 + 英文单词 + 数字）
      const trimmed = scriptContent.trim();
      if (trimmed) {
        // Count Chinese characters
        const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;
        // Count English words (sequences of letters)
        const englishWords = (trimmed.match(/[a-zA-Z]+/g) || []).length;
        // Count numbers as words
        const numbers = (trimmed.match(/\d+/g) || []).length;
        const wordCount = chineseChars + englishWords + numbers;
        setScriptWordCount(wordCount);
      } else {
        setScriptWordCount(0);
      }
    } else {
      setScriptWordCount(0);
    }
  }, [scriptContent]);

  // Update edited content when current script changes
  useEffect(() => {
    if (currentScript) {
      setEditedContent(currentScript.originalContent || currentScript.content);
    }
  }, [currentScript]);

  // Render
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-content3 bg-content1">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <FileText className="w-5 h-5 text-foreground/70" />
            剧本管理
          </h2>
          {scripts.length > 0 && (
            <Chip size="sm" variant="flat" className="text-foreground/70">
              {scripts.length} 个剧本
            </Chip>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            color="primary"
            startContent={<Upload className="w-4 h-4" />}
            onPress={() => setIsUploadModalOpen(true)}
          >
            上传剧本
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Script List Sidebar */}
        <div className="w-64 border-r border-content3 overflow-y-auto">
          {scripts.length === 0 ? (
            <div className="p-4 text-center text-foreground/50">
              <p>暂无剧本</p>
              <p className="text-sm">上传剧本开始使用</p>
            </div>
          ) : (
            <div className="divide-y divide-content3">
              {scripts.map(script => (
                <div
                  key={script.id}
                  className={`p-4 cursor-pointer hover:bg-content2 transition-all duration-200 border-l-4 ${
                    currentScript?.id === script.id
                      ? 'bg-primary/10 border-primary'
                      : 'border-transparent'
                  }`}
                  onClick={() => setCurrentScript(script)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{script.title}</p>
                      <p className="text-xs text-foreground/50">
                        {new Date(script.createdAt).toLocaleDateString()}
                      </p>
                      {script.parseState?.stage === 'completed' && (
                        <Chip size="sm" color="default" variant="flat" className="mt-1">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          解析完成
                        </Chip>
                      )}
                    </div>
                    <Tooltip content="删除剧本" delay={300}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="default"
                        aria-label="删除剧本"
                        onPress={() => confirmDeleteScript(script)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Script Detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!currentScript ? (
            <div className="flex flex-col items-center justify-center h-full text-foreground/50">
              <FileText className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">选择剧本查看详情</p>
              <p className="text-sm">或上传新剧本</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Script Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{currentScript.title}</h3>
                  <p className="text-foreground/50 mt-1">
                    {(() => {
                      const trimmed = currentScript.content.trim();
                      const chineseChars = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;
                      const englishWords = (trimmed.match(/[a-zA-Z]+/g) || []).length;
                      const numbers = (trimmed.match(/\d+/g) || []).length;
                      return chineseChars + englishWords + numbers;
                    })().toLocaleString()}{' '}
                    字
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* 2.0: 模型选择下拉框 */}
                  {getAvailableModels().length > 0 && (
                    <Select
                      size="sm"
                      aria-label="选择模型"
                      placeholder="选择模型"
                      selectedKeys={selectedModelId ? [selectedModelId] : []}
                      onChange={e => setSelectedModelId(e.target.value)}
                      className="w-48"
                      isDisabled={isParsing}
                    >
                      {getAvailableModels().map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </Select>
                  )}
                  {currentScript.parseState?.stage !== 'completed' &&
                    currentScript.parseState?.stage !== 'error' &&
                    (currentScript.parseState?.stage !== 'idle' ||
                      currentScript.parseState?.metadata ||
                      currentScript.parseState?.characters?.length ||
                      currentScript.parseState?.scenes?.length) && (
                      <Button
                        color="secondary"
                        startContent={<RotateCcw className="w-4 h-4" />}
                        isLoading={isParsing && activeParseButton === 'full'}
                        onPress={() => handleParseScript(currentScript.parseState)}
                      >
                        {isParsing ? '解析中...' : '继续解析'}
                      </Button>
                    )}
                  {currentScript.parseState?.stage !== 'completed' && (
                    <Button
                      color="primary"
                      startContent={isParsing ? undefined : <Play className="w-4 h-4" />}
                      isLoading={isParsing && activeParseButton === 'full'}
                      onPress={handleStartParse}
                      isDisabled={isParsing}
                    >
                      {isParsing ? '解析中...' : '开始分析'}
                    </Button>
                  )}
                  {currentScript.parseState?.stage === 'completed' && (
                    <Button
                      color="primary"
                      variant="flat"
                      startContent={<RotateCcw className="w-4 h-4" />}
                      onPress={handleStartParse}
                    >
                      重新分析
                    </Button>
                  )}
                </div>
              </div>

              {/* Parse Progress */}
              {/* New Enhanced Progress Component */}
              <ScriptParseProgress
                isOpen={isParsing}
                currentStage={parseStageKey}
                progress={parseProgress}
                stageProgress={parseStageProgress}
                message={parseStage}
                elapsedTime={parseDetails.elapsedTime}
                estimatedRemainingTime={parseDetails.estimatedRemainingTime}
                subTaskInfo={parseDetails.subTaskInfo}
                canCancel={true}
                onCancel={() => {
                  if (parserRef.current) {
                    parserRef.current.cancel();
                  }
                  setIsParsing(false);
                  showToast('解析已取消', 'warning');
                }}
                onBackground={() => {
                  // 隐藏解析弹窗，但保持解析在后台运行
                  setIsParsing(false);
                  setIsBackgroundParsing(true);
                  showToast('解析将在后台继续运行，点击悬浮按钮可查看进度', 'info');
                }}
              />

              {/* Parse Results Tabs */}
              {currentScript.parseState?.stage === 'completed' && (
                <Tabs aria-label="Parse Results">
                  {/* Overview Tab - 2.0: 导演工作台概览 */}
                  <Tab
                    key="overview"
                    title={
                      <div className="flex items-center gap-2">
                        <Clapperboard size={16} />
                        <span>导演工作台</span>
                      </div>
                    }
                  >
                    <div className="h-[calc(100vh-24rem)] min-h-[600px]">
                      <Card className="flex flex-col h-full">
                        <CardBody className="flex-1 flex flex-col gap-4 p-4">
                          {/* 第一行：故事概览 + 情绪曲线 */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: 0.4 }}
                              className="h-full"
                            >
                              <StoryOverviewCard
                                metadata={currentScript.parseState.metadata}
                                t={{}}
                              />
                            </motion.div>
                            {currentScript.parseState.metadata?.emotionalArc && (
                              <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4, delay: 0.45 }}
                                className="h-full"
                              >
                                <EmotionalArcChart
                                  emotionalArc={currentScript.parseState.metadata.emotionalArc}
                                  t={t}
                                />
                              </motion.div>
                            )}
                          </div>

                          {/* 第二行：视觉风格 + 故事结构 */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: 0.5 }}
                              className="h-full"
                            >
                              <VisualStyleCard
                                metadata={currentScript.parseState.metadata}
                                t={{}}
                              />
                            </motion.div>
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: 0.55 }}
                              className="h-full"
                            >
                              <StoryStructureDiagram
                                storyStructure={currentScript.parseState.metadata.storyStructure}
                                t={t}
                              />
                            </motion.div>
                          </div>
                        </CardBody>
                      </Card>
                    </div>
                  </Tab>

                  {/* Original Text Tab */}
                  <Tab
                    key="original-text"
                    title={
                      <div className="flex items-center gap-2">
                        <FileText size={16} />
                        <span>原文</span>
                      </div>
                    }
                  >
                    <Card>
                      <CardBody className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div className="flex gap-2">
                            <Button
                              variant={currentView === 'original' ? 'solid' : 'light'}
                              size="sm"
                              onPress={() => setCurrentView('original')}
                            >
                              原始原文
                            </Button>
                            <Button
                              variant={currentView === 'cleaned' ? 'solid' : 'light'}
                              size="sm"
                              onPress={() => setCurrentView('cleaned')}
                            >
                              清洗后原文
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            {currentView === 'original' && (
                              <Button variant="light" size="sm" onPress={() => setIsEditing(true)}>
                                编辑
                              </Button>
                            )}
                            {isEditing && (
                              <>
                                <Button
                                  variant="light"
                                  size="sm"
                                  onPress={() => {
                                    setIsEditing(false);
                                    setEditedContent(
                                      currentScript.originalContent || currentScript.content
                                    );
                                  }}
                                >
                                  取消
                                </Button>
                                <Button
                                  color="primary"
                                  size="sm"
                                  onPress={async () => {
                                    // 保存编辑后的内容，只修改原始原文
                                    const updatedScript = {
                                      ...currentScript,
                                      originalContent: editedContent,
                                      updatedAt: Date.now(),
                                    };
                                    setCurrentScript(updatedScript);
                                    // 保存到后端存储
                                    try {
                                      await storageService.saveScript(updatedScript);
                                      showToast('原文已保存', 'success');
                                    } catch (error) {
                                      console.error(
                                        '[ScriptManager] Failed to save script:',
                                        error
                                      );
                                      showToast('保存失败，请重试', 'error');
                                    }
                                    setIsEditing(false);
                                  }}
                                >
                                  保存
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="border border-content3 rounded-lg p-4 bg-content1 h-96 overflow-auto">
                            <textarea
                              value={editedContent}
                              onChange={e => setEditedContent(e.target.value)}
                              className="w-full h-full p-2 border-none outline-none resize-none text-sm"
                              placeholder="请编辑原文内容..."
                            />
                          </div>
                        ) : (
                          <div className="border border-content3 rounded-lg p-4 bg-content2 h-96 overflow-auto">
                            <pre className="whitespace-pre-wrap text-sm">
                              {currentView === 'original'
                                ? currentScript.originalContent || currentScript.content
                                : currentScript.content}
                            </pre>
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  </Tab>

                  {/* Characters Tab */}
                  <Tab
                    key="characters"
                    title={
                      <div className="flex items-center gap-2">
                        <Users size={16} />
                        <span>角色</span>
                        {currentScript.parseState.characters && (
                          <Chip size="sm">{currentScript.parseState.characters.length}</Chip>
                        )}
                      </div>
                    }
                  >
                    <CharacterMapping
                      scriptId={currentScript.id}
                      scriptCharacters={currentScript.parseState.characters || []}
                      existingCharacters={existingCharacters}
                      projectId={projectId!}
                      onCharactersUpdate={handleCharactersUpdate}
                      onCharacterCreated={loadExistingAssets}
                    />
                  </Tab>

                  {/* Scenes Tab */}
                  <Tab
                    key="scenes"
                    title={
                      <div className="flex items-center gap-2">
                        <MapPin size={16} />
                        <span>场景</span>
                        {currentScript.parseState.scenes && (
                          <Chip size="sm">{currentScript.parseState.scenes.length}</Chip>
                        )}
                      </div>
                    }
                  >
                    <SceneMapping
                      scriptId={currentScript.id}
                      scriptScenes={currentScript.parseState.scenes || []}
                      existingScenes={existingScenes}
                      projectId={projectId!}
                      onScenesUpdate={handleScenesUpdate}
                      onSceneCreated={loadExistingAssets}
                    />
                  </Tab>

                  {/* Items Tab */}
                  <Tab
                    key="items"
                    title={
                      <div className="flex items-center gap-2">
                        <Box size={16} />
                        <span>物品</span>
                        {currentScript.parseState.items && (
                          <Chip size="sm">{currentScript.parseState.items.length}</Chip>
                        )}
                      </div>
                    }
                  >
                    <ItemMapping
                      scriptId={currentScript.id}
                      scriptItems={currentScript.parseState.items || []}
                      existingItems={existingItems}
                      projectId={projectId!}
                      onItemsUpdate={handleItemsUpdate}
                      onItemCreated={loadExistingAssets}
                    />
                  </Tab>

                  {/* Episode Plan Tab - 新增：分集方案 */}
                  {currentScript.parseState?.episodePlan && (
                    <Tab
                      key="episode-plan"
                      title={
                        <div className="flex items-center gap-2">
                          <Library size={16} />
                          <span>分集方案</span>
                          <Chip size="sm">
                            {currentScript.parseState.episodePlan.totalEpisodes}
                          </Chip>
                        </div>
                      }
                    >
                      <EpisodePlanViewer
                        episodePlan={currentScript.parseState.episodePlan}
                        t={{}}
                      />
                    </Tab>
                  )}

                  {/* Shots Tab */}
                  <Tab
                    key="shots"
                    title={
                      <div className="flex items-center gap-2">
                        <Film size={16} />
                        <span>分镜</span>
                        {currentScript.parseState.shots && (
                          <Chip size="sm">{currentScript.parseState.shots.length}</Chip>
                        )}
                      </div>
                    }
                  >
                    <ShotList
                      shots={currentScript.parseState.shots || []}
                      scenes={currentScript.parseState.scenes || []}
                      scriptId={currentScript.id}
                      projectId={projectId!}
                      onShotsUpdate={() => {}}
                      viewMode="list"
                    />
                  </Tab>

                  {/* Sound Design Tab */}
                  <Tab
                    key="sound-design"
                    title={
                      <div className="flex items-center gap-2">
                        <Music size={16} />
                        <span>声音设计</span>
                      </div>
                    }
                  >
                    <SoundDesignTab
                      metadata={currentScript.parseState.metadata || {}}
                      shots={currentScript.parseState.shots || []}
                    />
                  </Tab>

                  {/* Quality Report Tab */}
                  {qualityReport && (
                    <Tab
                      key="quality"
                      title={
                        <div className="flex items-center gap-2">
                          <AlertCircle size={16} />
                          <span>质量</span>
                          <Tooltip content="剧本解析质量评分（0-100）" delay={300}>
                            <Chip
                              size="sm"
                              color={
                                qualityReport.score >= 80
                                  ? 'success'
                                  : qualityReport.score >= 60
                                    ? 'warning'
                                    : 'danger'
                              }
                            >
                              {qualityReport.score}
                            </Chip>
                          </Tooltip>
                        </div>
                      }
                    >
                      {/* 功能说明 */}
                      <div className="mb-4 p-3 bg-content2 rounded-lg border border-content3">
                        <div className="flex items-start gap-3">
                          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm text-slate-300">
                              <strong>解析质量</strong>
                              ：检查解析结果的完整性、准确性、一致性（角色、场景、物品完整性）
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                              <strong>连贯性检查</strong>
                              ：检查剧情和镜头的连贯性、视觉质量、叙事节奏
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 质量Tab内部子Tab */}
                      <Tabs classNames={{ tabList: 'gap-2' }}>
                        {/* 解析质量子Tab */}
                        <Tab
                          key="parseQuality"
                          title={
                            <div className="flex items-center gap-2">
                              <BarChart3 size={16} />
                              <span>解析质量</span>
                            </div>
                          }
                        >
                          <div className="pt-4">
                            <QualityReportCard
                              report={qualityReport}
                              performanceReport={performanceReport}
                              t={t}
                            />
                          </div>
                        </Tab>

                        {/* 连贯性检查子Tab - 仅当coherenceReport存在时显示 */}
                        {currentScript.parseState?.coherenceReport && (
                          <Tab
                            key="coherence"
                            title={
                              <div className="flex items-center gap-2">
                                <Target size={16} />
                                <span>连贯性检查</span>
                                <Tooltip content="剧情和镜头连贯性检查" delay={300}>
                                  <Chip
                                    size="sm"
                                    color={
                                      currentScript.parseState.coherenceReport.qualityScore
                                        .overall >= 80
                                        ? 'success'
                                        : currentScript.parseState.coherenceReport.qualityScore
                                              .overall >= 60
                                          ? 'warning'
                                          : 'danger'
                                    }
                                  >
                                    {currentScript.parseState.coherenceReport.qualityScore.overall}
                                  </Chip>
                                </Tooltip>
                              </div>
                            }
                          >
                            <div className="pt-4">
                              <CoherenceReportViewer
                                report={currentScript.parseState.coherenceReport}
                                t={t}
                              />
                            </div>
                          </Tab>
                        )}
                      </Tabs>
                    </Tab>
                  )}
                </Tabs>
              )}

              {/* 原始内容 */}
              {!isParsing && currentScript.parseState?.stage !== 'completed' && (
                <Card>
                  <CardBody>
                    <h4 className="font-medium mb-3">剧本内容</h4>
                    <div className="bg-content2 p-4 rounded-lg max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm">
                        {currentScript.originalContent || currentScript.content}
                      </pre>
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} size="2xl">
        <ModalContent>
          <ModalHeader>上传剧本</ModalHeader>
          <ModalBody className="space-y-4">
            {/* 2.0: 文件上传区域 */}
            <Card className="border-2 border-dashed border-content3 relative overflow-hidden">
              <CardBody className="text-center py-6">
                <Upload className="w-8 h-8 mx-auto mb-2 text-foreground/40" />
                <p className="text-sm text-foreground/60 mb-2">点击或拖拽文件到此处上传</p>
                <p className="text-xs text-foreground/50">
                  支持 .txt, .md, .docx, .pdf 格式（最大50MB）
                </p>
                <input
                  type="file"
                  accept=".txt,.md,.markdown,.docx,.pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </CardBody>
            </Card>

            <Divider />

            <Input
              label="剧本标题"
              placeholder="请输入剧本标题"
              value={scriptTitle}
              onChange={e => setScriptTitle(e.target.value)}
            />
            <Textarea
              label="剧本内容"
              placeholder="请粘贴小说或剧本内容，或通过上方上传文件..."
              value={scriptContent}
              onChange={e => setScriptContent(e.target.value)}
              minRows={10}
              maxRows={20}
            />
            {scriptWordCount > 0 && (
              <p className="text-sm text-foreground/50">{scriptWordCount.toLocaleString()} 字</p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsUploadModalOpen(false)}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={handleUploadScript}
              isDisabled={!scriptTitle.trim() || !scriptContent.trim()}
            >
              上传
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        onConfirm={handleDeleteScript}
        title="确认删除"
        itemName={scriptToDelete?.title}
        description={
          deleteStats
            ? `这将同时删除 ${deleteStats.characters} 个角色、${deleteStats.scenes} 个场景、${deleteStats.items} 个物品和 ${deleteStats.shots} 个分镜。`
            : undefined
        }
        isLoading={isDeleting}
        size="md"
      />

      {/* 2.0: Creative Intent Modal - 替代旧的ParseConfigConfirmModal */}
      <CreativeIntentModal
        isOpen={showCreativeIntent}
        onClose={() => setShowCreativeIntent(false)}
        onConfirm={handleParseWithIntent}
        scriptTitle={currentScript?.title || ''}
        creativeIntent={creativeIntent}
        onIntentChange={setCreativeIntent}
      />

      {/* 后台解析指示器 */}
      {isBackgroundParsing && !isParsing && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Button
            color="primary"
            className="shadow-lg hover:shadow-xl transition-shadow"
            startContent={<Loader2 className="w-4 h-4 animate-spin" />}
            endContent={<Eye className="w-4 h-4" />}
            onPress={() => {
              setIsParsing(true);
              setIsBackgroundParsing(false);
            }}
          >
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">解析进行中</span>
              <span className="text-xs opacity-80">{Math.round(parseProgress)}% - 点击查看</span>
            </div>
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default ScriptManager;
