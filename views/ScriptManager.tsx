import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { QualityReport } from '../services/scriptParser';
import { DetailedQualityReport } from '../services/parsing/QualityAnalyzer';
import QualityReportCard from '../components/ScriptParser/QualityReportCard';
import { CreativeIntentModal } from '../components/CreativeIntentModal';

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
} from 'lucide-react';

interface ScriptManagerProps {
  projectId?: string;
  initialTab?: 'scripts' | 'shots';
}

const ScriptManager: React.FC<ScriptManagerProps> = ({
  projectId: propProjectId,
  initialTab = 'scripts',
}) => {
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
  const [activeParseButton, setActiveParseButton] = useState<string | null>(null);
  const [parseDetails, setParseDetails] = useState<{
    currentScene?: number;
    totalScenes?: number;
    currentBatch?: number;
    totalBatches?: number;
    elapsedTime?: number;
    estimatedRemainingTime?: number;
  }>({});

  // 2.0: 模型选择状态
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  // Quality report state
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);

  // Delete confirmation modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
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
  useEffect(() => {
    console.log('[ScriptManager] scripts state changed:', scripts.length, 'scripts');
    console.log(
      '[ScriptManager] scripts array:',
      scripts.map(s => ({ id: s.id, title: s.title }))
    );
  }, [scripts]);

  // Update quality report when script changes
  useEffect(() => {
    if (currentScript?.parseState?.stage === 'completed') {
      console.log('[ScriptManager] ========== useEffect: currentScript changed ==========');
      console.log('[ScriptManager] currentScript exists:', !!currentScript);
      console.log('[ScriptManager] parseState exists:', !!currentScript?.parseState);
      console.log(
        '[ScriptManager] qualityReport exists:',
        !!currentScript?.parseState?.qualityReport
      );

      if (currentScript.parseState.qualityReport) {
        setQualityReport(currentScript.parseState.qualityReport);
        console.log('[ScriptManager] Restoring quality report:', {
          score: currentScript.parseState.qualityReport.score,
          violationsCount: currentScript.parseState.qualityReport.violations?.length,
          suggestionsCount: currentScript.parseState.qualityReport.suggestions?.length,
          type: typeof currentScript.parseState.qualityReport,
        });
        console.log('[ScriptManager] ========== Quality Report Restored ==========');
      } else {
        setQualityReport(null);
        console.log('[ScriptManager] No quality report in parseState, setting to null');
      }
    } else {
      setQualityReport(null);
    }
  }, [currentScript]);

  const loadScripts = async () => {
    console.log('[ScriptManager] loadScripts called, projectId:', projectId);
    if (!projectId) {
      console.log('[ScriptManager] No projectId, skipping');
      return;
    }

    // 2.0: 检查存储连接状态
    const connected = await checkConnection();
    console.log('[ScriptManager] Connection check:', connected);
    if (!connected) {
      console.log('[ScriptManager] Not connected, skipping loadScripts');
      return;
    }

    try {
      console.log('[ScriptManager] Calling storageService.getScripts...');
      const loadedScripts = await storageService.getScripts(projectId);
      console.log('[ScriptManager] Loaded scripts:', loadedScripts.length);
      // 2.0: 移除isMountedRef检查，避免React严格模式导致的问题
      console.log('[ScriptManager] Calling setScripts with', loadedScripts.length, 'scripts');
      setScripts(loadedScripts);
      if (loadedScripts.length > 0 && !currentScript) {
        console.log('[ScriptManager] Setting currentScript to first script:', loadedScripts[0].id);
        setCurrentScript(loadedScripts[0]);
      }
    } catch (error) {
      console.error('[ScriptManager] Failed to load scripts:', error);
      showToast('加载剧本失败', 'error');
    }
  };

  const loadExistingAssets = async () => {
    if (!projectId) return;

    // 2.0: 检查存储连接状态
    const connected = await checkConnection();
    if (!connected) {
      console.log('[ScriptManager] Not connected, skipping loadExistingAssets');
      return;
    }

    try {
      const assets = await storageService.getAssets(projectId);
      // Note: Removed isMountedRef check to fix React StrictMode issues
      setExistingCharacters(assets.filter(a => a.type === AssetType.CHARACTER) as CharacterAsset[]);
      setExistingScenes(assets.filter(a => a.type === AssetType.SCENE) as SceneAsset[]);
      setExistingItems(assets.filter(a => a.type === AssetType.ITEM) as ItemAsset[]);
      setExistingFragments(
        assets.filter(a => a.type === AssetType.VIDEO_SEGMENT) as FragmentAsset[]
      );
    } catch (error) {
      console.error('[ScriptManager] Failed to load existing assets:', error);
    }
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
        showToast(
          `文件 "${file.name}" 读取成功（${content.length.toLocaleString()} 字符）`,
          'success'
        );
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
      const newScript: Script = {
        id: `script_${Date.now()}`,
        projectId,
        title: scriptTitle.trim(),
        content: scriptContent.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        parseState: {
          stage: 'idle',
          progress: 0,
        },
      };

      await storageService.saveScript(newScript);
      setScripts([...scripts, newScript]);
      setCurrentScript(newScript);
      setIsUploadModalOpen(false);
      setScriptTitle('');
      setScriptContent('');
      showToast('剧本上传成功', 'success');
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
        // 2.0: 移除所有基于字数的配置
        useDurationBudget: false,
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
      const TIMEOUT_WARNING = 60000; // 60秒后显示警告
      const timeoutWarningShown = false;

      const onProgress: ParseProgressCallback = (stage, progress, message, details) => {
        // Note: Removed isMountedRef check to fix progress not updating in React StrictMode
        // StrictMode causes double mounting/unmounting which breaks the ref
        setParseProgress(progress);
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
          estimatedRemainingTime = Math.floor((elapsed / progress) * remainingProgress / 1000);
        }

        setParseDetails({
          ...details,
          elapsedTime: elapsed,
          estimatedRemainingTime
        });

        let displayMessage = baseMessage;

        if (stage === 'shots' && details?.totalScenes) {
          const sceneInfo = details.currentScene 
            ? `场景 ${details.currentScene}/${details.totalScenes}` 
            : `共 ${details.totalScenes} 个场景`;
          const batchInfo = details.currentBatch && details.totalBatches 
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
      };

      const parseState = await parser.parseScript(
        currentScript.id,
        projectId,
        currentScript.content,
        onProgress,
        resumeFromState
      );

      // Note: Removed isMountedRef check to fix React StrictMode issues
      const updatedScript = { ...currentScript, parseState };
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

      setIsDeleteModalOpen(false);
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
    setIsDeleteModalOpen(true);
  };

  // 2.0: 获取可用的LLM模型列表
  const getAvailableModels = useCallback((): ModelConfig[] => {
    return settings.models.filter(m => m.type === 'llm' && m.apiKey);
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
      // 2.0: 简单的字数统计，不再依赖TextCleaner.getTextStats
      const charCount = scriptContent.length;
      setScriptWordCount(charCount);
    } else {
      setScriptWordCount(0);
    }
  }, [scriptContent]);

  // Render
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            剧本管理
          </h2>
          {scripts.length > 0 && (
            <Chip size="sm" variant="flat">
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
        <div className="w-64 border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
          {scripts.length === 0 ? (
            <div className="p-4 text-center text-slate-500">
              <p>暂无剧本</p>
              <p className="text-sm">上传剧本开始使用</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {scripts.map(script => (
                <div
                  key={script.id}
                  className={`p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                    currentScript?.id === script.id ? 'bg-slate-100 dark:bg-slate-800' : ''
                  }`}
                  onClick={() => setCurrentScript(script)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{script.title}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(script.createdAt).toLocaleDateString()}
                      </p>
                      {script.parseState?.stage === 'completed' && (
                        <Chip size="sm" color="success" variant="flat" className="mt-1">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          已解析
                        </Chip>
                      )}
                    </div>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => confirmDeleteScript(script)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Script Detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!currentScript ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
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
                  <p className="text-slate-500 mt-1">
                    {currentScript.content.length.toLocaleString()} 字符
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* 2.0: 模型选择下拉框 */}
                  {getAvailableModels().length > 0 && (
                    <Select
                      size="sm"
                      label="选择模型"
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
                    (currentScript.parseState?.metadata || 
                     currentScript.parseState?.characters?.length || 
                     currentScript.parseState?.scenes?.length)) && (
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
              {isParsing && (
                <Card>
                  <CardBody className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{parseStage}</span>
                      <span className="text-sm text-slate-500">{parseProgress}%</span>
                    </div>
                    
                    <Progress 
                      value={parseProgress} 
                      className="w-full"
                      aria-label={`解析进度: ${parseProgress}%`}
                    />
                    
                    {/* Detailed Progress Info */}
                    {(parseDetails.currentScene || parseDetails.totalScenes || parseDetails.estimatedRemainingTime) && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        {parseDetails.totalScenes && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <MapPin className="w-3 h-3" />
                            <span>
                              {parseDetails.currentScene || 0}/{parseDetails.totalScenes} 场景
                            </span>
                          </div>
                        )}
                        
                        {parseDetails.totalBatches && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <Box className="w-3 h-3" />
                            <span>
                              {parseDetails.currentBatch || 0}/{parseDetails.totalBatches} 批次
                            </span>
                          </div>
                        )}
                        
                        {parseDetails.estimatedRemainingTime && parseDetails.estimatedRemainingTime > 0 && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>
                              预计还需 {Math.floor(parseDetails.estimatedRemainingTime / 60)}分{parseDetails.estimatedRemainingTime % 60}秒
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardBody>
                </Card>
              )}

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
                    <Card>
                      <CardBody className="space-y-6">
                        {/* 2.0: 项目概览 - 移除分镜数量预估，显示实际解析结果 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <Card className="bg-primary/5">
                            <CardBody className="text-center">
                              <p className="text-2xl font-bold text-primary">
                                {currentScript.parseState.plotAnalysis?.plotPoints?.length ||
                                  currentScript.parseState.shots?.length ||
                                  0}
                              </p>
                              <p className="text-sm text-slate-500">情节点</p>
                            </CardBody>
                          </Card>
                          <Card className="bg-secondary/5">
                            <CardBody className="text-center">
                              <p className="text-2xl font-bold text-secondary">
                                {currentScript.parseState.shots?.length || 0}
                              </p>
                              <p className="text-sm text-slate-500">生成分镜</p>
                            </CardBody>
                          </Card>
                          <Card className="bg-success/5">
                            <CardBody className="text-center">
                              <p className="text-2xl font-bold text-success">
                                {currentScript.parseState.characters?.length || 0}
                              </p>
                              <p className="text-sm text-slate-500">角色</p>
                            </CardBody>
                          </Card>
                          <Card className="bg-warning/5">
                            <CardBody className="text-center">
                              <p className="text-2xl font-bold text-warning">
                                {currentScript.parseState.scenes?.length || 0}
                              </p>
                              <p className="text-sm text-slate-500">场景</p>
                            </CardBody>
                          </Card>
                        </div>

                        {/* Story Overview & Visual Style */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <StoryOverviewCard metadata={currentScript.parseState.metadata} t={{}} />
                          <VisualStyleCard metadata={currentScript.parseState.metadata} t={{}} />
                        </div>

                        {/* Emotional Arc */}
                        {currentScript.parseState.metadata?.emotionalArc && (
                          <EmotionalArcChart
                            emotionalArc={currentScript.parseState.metadata.emotionalArc}
                          />
                        )}

                        {/* Story Structure */}
                        {currentScript.parseState.metadata?.storyStructure && (
                          <StoryStructureDiagram
                            structure={currentScript.parseState.metadata.storyStructure}
                          />
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
                      onCharactersUpdate={() => {}}
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
                      onScenesUpdate={() => {}}
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
                      onItemsUpdate={() => {}}
                      onItemCreated={loadExistingAssets}
                    />
                  </Tab>

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

                  {/* Quality Report Tab */}
                  {qualityReport && (
                    <Tab
                      key="quality"
                      title={
                        <div className="flex items-center gap-2">
                          <AlertCircle size={16} />
                          <span>质量</span>
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
                        </div>
                      }
                    >
                      <QualityReportCard report={qualityReport} />
                    </Tab>
                  )}
                </Tabs>
              )}

              {/* 原始内容 */}
              {!isParsing && currentScript.parseState?.stage !== 'completed' && (
                <Card>
                  <CardBody>
                    <h4 className="font-medium mb-3">剧本内容</h4>
                    <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-lg max-h-96 overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm">{currentScript.content}</pre>
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
            <Card className="border-2 border-dashed border-slate-300 dark:border-slate-600 relative overflow-hidden">
              <CardBody className="text-center py-6">
                <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                  点击或拖拽文件到此处上传
                </p>
                <p className="text-xs text-slate-500">
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
              <p className="text-sm text-slate-500">{scriptWordCount.toLocaleString()} 字符</p>
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
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
        <ModalContent>
          <ModalHeader>确认删除</ModalHeader>
          <ModalBody>
            <p>确定要删除 &quot;{scriptToDelete?.title}&quot; 吗？</p>
            {deleteStats && (
              <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  这将同时删除 {deleteStats.characters} 个角色、{deleteStats.scenes} 个场景、
                  {deleteStats.items} 个物品和 {deleteStats.shots} 个分镜。
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsDeleteModalOpen(false)}>
              取消
            </Button>
            <Button color="danger" onPress={handleDeleteScript} isLoading={isDeleting}>
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 2.0: Creative Intent Modal - 替代旧的ParseConfigConfirmModal */}
      <CreativeIntentModal
        isOpen={showCreativeIntent}
        onClose={() => setShowCreativeIntent(false)}
        onConfirm={handleParseWithIntent}
        scriptTitle={currentScript?.title || ''}
        creativeIntent={creativeIntent}
        onIntentChange={setCreativeIntent}
      />
    </div>
  );
};

export default ScriptManager;
