import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Script, ScriptParseState, ScriptCharacter, ScriptScene, ScriptItem, Shot, CharacterAsset, SceneAsset, FragmentAsset, ItemAsset, AssetType, ModelConfig, CreativeIntent } from '../types';
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
  Switch
} from "@heroui/react";
import { FileText, Upload, Play, RotateCcw, Users, MapPin, Film, CheckCircle2, AlertCircle, Brain, Box, Trash2, Sparkles, AlertTriangle, Info, BookOpen, Layout, Palette, Music, Clock, Clapperboard } from 'lucide-react';

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
  const [activeParseButton, setActiveParseButton] = useState<string | null>(null);

  // Quality report state
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);

  // Delete confirmation modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [scriptToDelete, setScriptToDelete] = useState<Script | null>(null);
  const [deleteStats, setDeleteStats] = useState<{ characters: number; scenes: number; items: number; shots: number } | null>(null);
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
      thematicDepth: false
    },
    emotionalTone: {
      primary: 'inspiring',
      intensity: 7
    },
    visualReferences: [],
    creativeNotes: '',
    targetPlatforms: []
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

  // Update quality report when script changes
  useEffect(() => {
    if (currentScript?.parseState?.stage === 'completed') {
      console.log('[ScriptManager] ========== useEffect: currentScript changed ==========');
      console.log('[ScriptManager] currentScript exists:', !!currentScript);
      console.log('[ScriptManager] parseState exists:', !!currentScript?.parseState);
      console.log('[ScriptManager] qualityReport exists:', !!currentScript?.parseState?.qualityReport);

      if (currentScript.parseState.qualityReport) {
        setQualityReport(currentScript.parseState.qualityReport);
        console.log('[ScriptManager] Restoring quality report:', {
          score: currentScript.parseState.qualityReport.score,
          violationsCount: currentScript.parseState.qualityReport.violations?.length,
          suggestionsCount: currentScript.parseState.qualityReport.suggestions?.length,
          type: typeof currentScript.parseState.qualityReport
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
    if (!projectId) return;
    
    // 2.0: 检查存储连接状态
    const connected = await checkConnection();
    if (!connected) {
      console.log('[ScriptManager] Not connected, skipping loadScripts');
      return;
    }
    
    try {
      const loadedScripts = await storageService.getScripts(projectId);
      if (isMountedRef.current) {
        setScripts(loadedScripts);
        if (loadedScripts.length > 0 && !currentScript) {
          setCurrentScript(loadedScripts[0]);
        }
      }
    } catch (error) {
      console.error('[ScriptManager] Failed to load scripts:', error);
      showToast('Failed to load scripts', 'error');
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
      if (isMountedRef.current) {
        setExistingCharacters(assets.filter(a => a.type === AssetType.CHARACTER) as CharacterAsset[]);
        setExistingScenes(assets.filter(a => a.type === AssetType.SCENE) as SceneAsset[]);
        setExistingItems(assets.filter(a => a.type === AssetType.ITEM) as ItemAsset[]);
        setExistingFragments(assets.filter(a => a.type === AssetType.VIDEO_SEGMENT) as FragmentAsset[]);
      }
    } catch (error) {
      console.error('[ScriptManager] Failed to load existing assets:', error);
    }
  };

  const handleUploadScript = async () => {
    if (!scriptTitle.trim() || !scriptContent.trim()) {
      showToast('Please enter both title and content', 'error');
      return;
    }

    if (!projectId) {
      showToast('No project selected', 'error');
      return;
    }

    // 2.0: 检查存储连接状态
    const connected = await checkConnection();
    if (!connected) {
      showToast('Please connect to a workspace first', 'error');
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
          progress: 0
        }
      };

      await storageService.saveScript(newScript);
      setScripts([...scripts, newScript]);
      setCurrentScript(newScript);
      setIsUploadModalOpen(false);
      setScriptTitle('');
      setScriptContent('');
      showToast('Script uploaded successfully', 'success');
    } catch (error) {
      console.error('[ScriptManager] Failed to upload script:', error);
      showToast('Failed to upload script', 'error');
    }
  };

  // 2.0版本：打开创作意图确认弹窗
  const handleStartParse = () => {
    if (!currentScript) {
      showToast('Please select a script first', 'error');
      return;
    }

    const selectedModel = getSelectedModel();
    if (!selectedModel) {
      showToast('Please configure LLM model in settings', 'error');
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

  const handleParseScript = async () => {
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
      showToast('Selected model is missing API key. Please configure in settings.', 'error');
      return;
    }

    setIsParsing(true);
    setParseProgress(0);
    setParseStage('Initializing...');
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
          verboseLogging: true
        },
        // 2.0: 使用创作意图替代旧的durationBudgetConfig
        creativeIntent: creativeIntent,
        // 2.0: 移除所有基于字数的配置
        useDurationBudget: false,
        useDynamicDuration: false,
        useProductionPrompt: true, // 默认启用专业Prompt
        useShotQC: false, // 2.0: 移除基于字数的质检
        qcAutoAdjust: false,
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
      console.log('[ScriptManager] v2.0 Parser config:', parserConfig);

      const onProgress: ParseProgressCallback = (stage, progress, message) => {
        if (!isMountedRef.current) return;
        setParseProgress(progress);
        const stageNames: Record<string, string> = {
          metadata: 'Analyzing creative intent...',
          characters: 'Designing characters...',
          scenes: 'Planning scenes...',
          shots: 'Creating shot list...',
          completed: 'Parse completed',
          error: 'Parse error'
        };
        setParseStage(message || stageNames[stage] || stage);
      };

      const parseState = await parser.parseScript(
        currentScript.id,
        projectId,
        currentScript.content,
        onProgress
      );

      if (!isMountedRef.current) return;

      const updatedScript = { ...currentScript, parseState };
      setCurrentScript(updatedScript);

      if (parseState.stage === 'completed') {
        showToast('Script analysis completed', 'success');

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
        showToast(`Parse failed: ${parseState.error}`, 'error');
      }
    } catch (error: any) {
      if (!isMountedRef.current) return;

      if (error.name === 'AbortError') {
        showToast('Parse cancelled', 'info');
      } else {
        showToast(`Parse failed: ${error.message}`, 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsParsing(false);
        setActiveParseButton(null);
      }
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
      showToast('Failed to delete script', 'error');
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
      shots: script.parseState?.shots?.length || 0
    };
    setDeleteStats(stats);
    setIsDeleteModalOpen(true);
  };

  const getSelectedModel = (needApiKey: boolean = true): ModelConfig | null => {
    const llmModels = settings.models.filter(m => m.type === 'llm');
    if (llmModels.length === 0) return null;

    const model = llmModels[0];
    if (needApiKey && !model.apiKey) return null;
    return model;
  };

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
            Script Management
          </h2>
          {scripts.length > 0 && (
            <Chip size="sm" variant="flat">{scripts.length} scripts</Chip>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            color="primary"
            startContent={<Upload className="w-4 h-4" />}
            onPress={() => setIsUploadModalOpen(true)}
          >
            Upload Script
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Script List Sidebar */}
        <div className="w-64 border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
          {scripts.length === 0 ? (
            <div className="p-4 text-center text-slate-500">
              <p>No scripts yet</p>
              <p className="text-sm">Upload a script to get started</p>
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
                          Parsed
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
              <p className="text-lg">Select a script to view details</p>
              <p className="text-sm">or upload a new script</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Script Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{currentScript.title}</h3>
                  <p className="text-slate-500 mt-1">
                    {currentScript.content.length.toLocaleString()} characters
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {currentScript.parseState?.stage !== 'completed' && (
                    <Button
                      color="primary"
                      startContent={isParsing ? undefined : <Play className="w-4 h-4" />}
                      isLoading={isParsing && activeParseButton === 'full'}
                      onPress={handleStartParse}
                    >
                      {isParsing ? 'Parsing...' : 'Start Analysis'}
                    </Button>
                  )}
                  {currentScript.parseState?.stage === 'completed' && (
                    <Button
                      variant="flat"
                      startContent={<RotateCcw className="w-4 h-4" />}
                      onPress={handleStartParse}
                    >
                      Re-analyze
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
                    <Progress value={parseProgress} className="w-full" />
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
                        <span>Director's Workbench</span>
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
                                {currentScript.parseState.plotAnalysis?.plotPoints?.length || currentScript.parseState.shots?.length || 0}
                              </p>
                              <p className="text-sm text-slate-500">Plot Points</p>
                            </CardBody>
                          </Card>
                          <Card className="bg-secondary/5">
                            <CardBody className="text-center">
                              <p className="text-2xl font-bold text-secondary">
                                {currentScript.parseState.shots?.length || 0}
                              </p>
                              <p className="text-sm text-slate-500">Shots Generated</p>
                            </CardBody>
                          </Card>
                          <Card className="bg-success/5">
                            <CardBody className="text-center">
                              <p className="text-2xl font-bold text-success">
                                {currentScript.parseState.characters?.length || 0}
                              </p>
                              <p className="text-sm text-slate-500">Characters</p>
                            </CardBody>
                          </Card>
                          <Card className="bg-warning/5">
                            <CardBody className="text-center">
                              <p className="text-2xl font-bold text-warning">
                                {currentScript.parseState.scenes?.length || 0}
                              </p>
                              <p className="text-sm text-slate-500">Scenes</p>
                            </CardBody>
                          </Card>
                        </div>

                        {/* Story Overview & Visual Style */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          <StoryOverviewCard
                            metadata={currentScript.parseState.metadata}
                            t={{}}
                          />
                          <VisualStyleCard
                            metadata={currentScript.parseState.metadata}
                            t={{}}
                          />
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
                        <span>Characters</span>
                        {currentScript.parseState.characters && (
                          <Chip size="sm">{currentScript.parseState.characters.length}</Chip>
                        )}
                      </div>
                    }
                  >
                    <CharacterMapping
                      characters={currentScript.parseState.characters || []}
                      existingCharacters={existingCharacters}
                      projectId={projectId!}
                      onAssetsChanged={loadExistingAssets}
                    />
                  </Tab>

                  {/* Scenes Tab */}
                  <Tab
                    key="scenes"
                    title={
                      <div className="flex items-center gap-2">
                        <MapPin size={16} />
                        <span>Scenes</span>
                        {currentScript.parseState.scenes && (
                          <Chip size="sm">{currentScript.parseState.scenes.length}</Chip>
                        )}
                      </div>
                    }
                  >
                    <SceneMapping
                      scenes={currentScript.parseState.scenes || []}
                      existingScenes={existingScenes}
                      projectId={projectId!}
                      onAssetsChanged={loadExistingAssets}
                    />
                  </Tab>

                  {/* Items Tab */}
                  <Tab
                    key="items"
                    title={
                      <div className="flex items-center gap-2">
                        <Box size={16} />
                        <span>Items</span>
                        {currentScript.parseState.items && (
                          <Chip size="sm">{currentScript.parseState.items.length}</Chip>
                        )}
                      </div>
                    }
                  >
                    <ItemMapping
                      items={currentScript.parseState.items || []}
                      existingItems={existingItems}
                      projectId={projectId!}
                      onAssetsChanged={loadExistingAssets}
                    />
                  </Tab>

                  {/* Shots Tab */}
                  <Tab
                    key="shots"
                    title={
                      <div className="flex items-center gap-2">
                        <Film size={16} />
                        <span>Shots</span>
                        {currentScript.parseState.shots && (
                          <Chip size="sm">{currentScript.parseState.shots.length}</Chip>
                        )}
                      </div>
                    }
                  >
                    <ShotList
                      shots={currentScript.parseState.shots || []}
                      scriptId={currentScript.id}
                      projectId={projectId!}
                    />
                  </Tab>

                  {/* Quality Report Tab */}
                  {qualityReport && (
                    <Tab
                      key="quality"
                      title={
                        <div className="flex items-center gap-2">
                          <AlertCircle size={16} />
                          <span>Quality</span>
                          <Chip size="sm" color={qualityReport.score >= 80 ? 'success' : qualityReport.score >= 60 ? 'warning' : 'danger'}>
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

              {/* Raw Content */}
              {!isParsing && currentScript.parseState?.stage !== 'completed' && (
                <Card>
                  <CardBody>
                    <h4 className="font-medium mb-3">Script Content</h4>
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
          <ModalHeader>Upload Script</ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="Script Title"
              placeholder="Enter script title"
              value={scriptTitle}
              onChange={(e) => setScriptTitle(e.target.value)}
            />
            <Textarea
              label="Script Content"
              placeholder="Paste your script content here..."
              value={scriptContent}
              onChange={(e) => setScriptContent(e.target.value)}
              minRows={10}
              maxRows={20}
            />
            {scriptWordCount > 0 && (
              <p className="text-sm text-slate-500">
                {scriptWordCount.toLocaleString()} characters
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              color="primary" 
              onPress={handleUploadScript}
              isDisabled={!scriptTitle.trim() || !scriptContent.trim()}
            >
              Upload
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
        <ModalContent>
          <ModalHeader>Confirm Delete</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to delete &quot;{scriptToDelete?.title}&quot;?</p>
            {deleteStats && (
              <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  This will also delete {deleteStats.characters} characters, {deleteStats.scenes} scenes, {deleteStats.items} items, and {deleteStats.shots} shots.
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button color="danger" onPress={handleDeleteScript} isLoading={isDeleting}>
              Delete
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
