import React, { useState, useEffect } from 'react';
import { ModelConfig, ModelCapabilities } from '../types';
import { DEFAULT_MODELS, COMMON_VOLC_VIDEO_PARAMS, COMMON_IMAGE_PARAMS } from '../config/models';
import { useApp } from '../contexts/context';
import { useToast } from '../contexts/ToastContext';
import {
  Save,
  Plus,
  Trash2,
  Monitor,
  Moon,
  Sun,
  FolderOpen,
  RefreshCcw,
  CheckCircle,
  AlertCircle,
  Globe,
  Palette,
  Settings as SettingsIcon,
  Database,
  Cpu,
  Pencil,
  Clock,
  Film,
  Sparkles,
  Shield,
  Zap,
  Search,
  Eye,
  EyeOff,
  X,
  Settings2,
} from 'lucide-react';
import { storageService } from '../services/storage';
import { QualityRulesEditor } from '../components/Settings/QualityRulesEditor';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Switch,
  Slider,
  Tabs,
  Tab,
  Input,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Divider,
  ButtonGroup,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react';
import { providerAliasMapper } from '../services/ai/core/ProviderAliasMapper';

const Settings: React.FC = () => {
  const {
    settings,
    updateSettings,
    t,
    workspaceName,
    reloadSettings,
    isConnected,
    checkConnection,
    resetWorkspace,
  } = useApp();
  const { showToast } = useToast();
  const [saved, setSaved] = useState(false);
  const [opfsSupported, setOpfsSupported] = useState(false);
  const { isOpen: isConfirmOpen, onOpen: onConfirmOpen, onClose: onConfirmClose } = useDisclosure();
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'name' | 'type' | 'recent'>('name');
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, boolean>>({});
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [activeNav, setActiveNav] = useState<'general' | 'duration' | 'models' | 'quality'>('general');

  // Duration Budget Configuration State
  const [durationBudgetConfig, setDurationBudgetConfig] = useState({
    platform: settings.durationBudget?.platform || 'douyin',
    pace: settings.durationBudget?.pace || 'normal',
    useDurationBudget: settings.durationBudget?.useDurationBudget ?? false,
    useProductionPrompt: settings.durationBudget?.useProductionPrompt ?? false,
    useShotQC: settings.durationBudget?.useShotQC ?? false,
  });

  // Sync durationBudgetConfig when settings change (e.g., after loading from storage)
  useEffect(() => {
    if (settings.durationBudget) {
      console.log(
        '[Settings] Syncing durationBudgetConfig from settings:',
        settings.durationBudget
      );
      setDurationBudgetConfig({
        platform: settings.durationBudget.platform || 'douyin',
        pace: settings.durationBudget.pace || 'normal',
        useDurationBudget: settings.durationBudget.useDurationBudget ?? false,
        useProductionPrompt: settings.durationBudget.useProductionPrompt ?? false,
        useShotQC: settings.durationBudget.useShotQC ?? false,
      });
    }
  }, [settings.durationBudget]);

  // Debug: log durationBudgetConfig changes
  useEffect(() => {
    console.log('[Settings] durationBudgetConfig updated:', durationBudgetConfig);
  }, [durationBudgetConfig]);

  // Edit model state
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    modelId: '',
    apiKey: '',
    apiUrl: '',
    temperature: 0.3,
    maxTokens: 4000,
    costPer1KInput: undefined as number | undefined,
    costPer1KOutput: undefined as number | undefined,
  });

  useEffect(() => {
    storageService.isOpfsSupported().then(setOpfsSupported);
  }, []);

  const handleSandboxToggle = async (enabled: boolean) => {
    if (enabled) {
      // Switching to Sandbox
      const success = await storageService.switchToSandbox();
      if (success) {
        localStorage.setItem('avss_use_sandbox', 'true');
        await updateSettings({ ...settings, useSandbox: true });
        await reloadSettings();
      }
    } else {
      // Switching back to Local Folder
      localStorage.removeItem('avss_use_sandbox');
      // Directly trigger reset and picker without waiting for settings update to trigger a reload
      await resetWorkspace();
    }
  };

  const handleSwitchWorkspace = async () => {
    const success = await storageService.connect(true);
    if (success) {
      // Force full reload
      window.location.href = '/';
    }
  };

  // New Model Form State
  const [showAdd, setShowAdd] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<
    'vidu' | 'volcengine' | 'modelscope' | 'openai' | 'aliyun' | 'other' | ''
  >('');
  const [selectedBaseModelId, setSelectedBaseModelId] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [selectedType, setSelectedType] = useState<'video' | 'image' | 'llm' | ''>('');

  // Custom Model State
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModel, setCustomModel] = useState({
    provider: 'modelscope',
    modelId: '',
    apiUrl: '',
    // LLM specific params
    temperature: 0.3,
    maxTokens: 32000,
    enableThinking: false,
    // Image generation specific params
    supportsReferenceImage: true, // 默认支持参考图生图
    maxReferenceImages: 5,
    // 价格配置（可选）
    costPer1KInput: undefined as number | undefined,
    costPer1KOutput: undefined as number | undefined,
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Get available providers based on type
  const availableProviders = React.useMemo(() => {
    if (!selectedType) return [];
    const providers = new Set(
      DEFAULT_MODELS.filter((m: ModelConfig) => m.type === selectedType).map(
        (m: ModelConfig) => m.provider
      )
    );
    return Array.from(providers);
  }, [selectedType]);

  // Get available models based on provider and type
  const availableBaseModels = React.useMemo(() => {
    // 过滤出该 Provider 和 Type 下的基础模型，且过滤掉已经添加过的模型（基于 templateId 或 id）
    const addedTemplateIds = new Set(settings.models.map(m => m.templateId || m.id));
    return DEFAULT_MODELS.filter(
      (m: ModelConfig) =>
        m.provider === selectedProvider && m.type === selectedType && !addedTemplateIds.has(m.id)
    );
  }, [selectedProvider, selectedType, settings.models]);

  // Filter and sort models
  const filteredModels = React.useMemo(() => {
    let models = [...settings.models];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      models = models.filter(
        m => m.name.toLowerCase().includes(query) || m.modelId.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (selectedTypes.length > 0) {
      models = models.filter(m => selectedTypes.includes(m.type));
    }

    // Provider filter
    if (selectedProviders.length > 0) {
      models = models.filter(m => selectedProviders.includes(m.provider));
    }

    // Sort
    switch (sortBy) {
      case 'name':
        models.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'type':
        models.sort((a, b) => a.type.localeCompare(b.type));
        break;
      case 'recent':
        break;
    }

    return models;
  }, [settings.models, searchQuery, selectedTypes, selectedProviders, sortBy]);

  // Get unique providers from existing models
  const existingProviders = React.useMemo(() => {
    const providers = new Set(settings.models.map(m => m.provider));
    return Array.from(providers);
  }, [settings.models]);

  // Toggle API Key visibility
  const toggleApiKeyVisibility = (modelId: string) => {
    setVisibleApiKeys(prev => ({
      ...prev,
      [modelId]: !prev[modelId],
    }));
  };

  const handleAddModel = () => {
    if (!newModelName || !selectedBaseModelId) return;

    if (!isConnected) {
      showToast(t.settings.disconnected + ': ' + t.settings.workspaceDesc, 'error');
      return;
    }

    const baseModel = DEFAULT_MODELS.find((m: ModelConfig) => m.id === selectedBaseModelId);

    if (!baseModel) return;

    const newConfig: ModelConfig = {
      ...baseModel, // Copy base config (modelId, type, capabilities, provider)
      id:
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 11),
      templateId: baseModel.id, // Link to template
      name: newModelName,
      apiKey: newApiKey, // User provided key
      isDefault: false,
      enabled: true,
    };

    const updatedModels = [...settings.models, newConfig];
    updateSettings({ ...settings, models: updatedModels });

    // Reset form
    setNewModelName('');
    setSelectedBaseModelId('');
    setNewApiKey('');
    setSelectedType('');
    setSelectedProvider('');
    setShowAdd(false);
    setIsCustomModel(false);
    setCustomModel({
      provider: 'modelscope',
      modelId: '',
      apiUrl: '',
      temperature: 0.3,
      maxTokens: 32000,
      enableThinking: false,
      supportsReferenceImage: true,
      maxReferenceImages: 5,
    });
  };

  // Handle adding custom model
  const handleAddCustomModel = async () => {
    if (!newModelName || !customModel.modelId) {
      showToast('请填写模型名称和Model ID', 'error');
      return;
    }

    if (!isConnected) {
      showToast(t.settings.disconnected + ': ' + t.settings.workspaceDesc, 'error');
      return;
    }

    // Build LLM parameters
    const llmParams =
      selectedType === 'llm'
        ? [
            {
              name: 'temperature',
              label: 'Temperature',
              type: 'number' as const,
              defaultValue: customModel.temperature,
              min: 0,
              max: 2,
              step: 0.1,
            },
            {
              name: 'maxTokens',
              label: 'Max Tokens',
              type: 'number' as const,
              defaultValue: customModel.maxTokens,
              min: 100,
              max: 128000,
              step: 100,
            },
          ]
        : [];

    // Build providerOptions for LLM
    const providerOptions =
      selectedType === 'llm'
        ? {
            enableThinking: customModel.enableThinking,
          }
        : undefined;

    // Build capabilities based on model type
    let capabilities: ModelCapabilities = {};
    if (selectedType === 'llm') {
      capabilities = {
        maxContextLength: 128000,
        supportsStreaming: true,
      };
    } else if (selectedType === 'image') {
      capabilities = {
        maxBatchSize: 1,
        supportsReferenceImage: customModel.supportsReferenceImage,
        maxReferenceImages: customModel.supportsReferenceImage
          ? customModel.maxReferenceImages
          : undefined,
      };
    } else if (selectedType === 'video') {
      capabilities = {
        maxBatchSize: 1,
        supportsReferenceImage: false,
      };
    }

    const newConfig: ModelConfig = {
      id:
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 11),
      name: newModelName,
      provider: customModel.provider,
      modelId: customModel.modelId,
      type: selectedType as 'image' | 'video' | 'llm',
      capabilities,
      parameters:
        selectedType === 'image'
          ? COMMON_IMAGE_PARAMS
          : selectedType === 'video'
            ? COMMON_VOLC_VIDEO_PARAMS
            : llmParams,
      apiUrl: customModel.apiUrl || undefined,
      apiKey: newApiKey,
      isDefault: false,
      enabled: true,
      providerOptions,
      // 价格配置（仅LLM模型）
      ...(selectedType === 'llm' && {
        costPer1KInput: customModel.costPer1KInput,
        costPer1KOutput: customModel.costPer1KOutput,
      }),
    };

    const updatedModels = [...settings.models, newConfig];
    updateSettings({ ...settings, models: updatedModels });

    // Reset form
    setNewModelName('');
    setSelectedBaseModelId('');
    setNewApiKey('');
    setSelectedType('');
    setSelectedProvider('');
    setShowAdd(false);
    setIsCustomModel(false);
    setShowAdvancedOptions(false);
    setCustomModel({
      provider: 'modelscope',
      modelId: '',
      apiUrl: '',
      temperature: 0.3,
      maxTokens: 32000,
      enableThinking: false,
      supportsReferenceImage: true,
      maxReferenceImages: 5,
    });
  };

  const toggleModelEnabled = (modelId: string) => {
    const updatedModels = settings.models.map(m =>
      m.id === modelId ? { ...m, enabled: !(m.enabled ?? true) } : m
    );
    updateSettings({ ...settings, models: updatedModels });
  };

  const toggleModelSelection = (modelId: string) => {
    setSelectedModelIds(prev =>
      prev.includes(modelId) ? prev.filter(id => id !== modelId) : [...prev, modelId]
    );
  };

  const batchUpdateModels = (enabled: boolean) => {
    const updatedModels = settings.models.map(m =>
      selectedModelIds.includes(m.id) ? { ...m, enabled } : m
    );
    updateSettings({ ...settings, models: updatedModels });
    setSelectedModelIds([]);
  };

  const batchEnable = () => batchUpdateModels(true);
  const batchDisable = () => batchUpdateModels(false);

  const handleRemoveModel = (id: string) => {
    setModelToDelete(id);
    onConfirmOpen();
  };

  const confirmDeleteModel = () => {
    if (!modelToDelete) return;
    const updatedModels = settings.models.filter(m => m.id !== modelToDelete);
    updateSettings({ ...settings, models: updatedModels });
    setModelToDelete(null);
    onConfirmClose();
  };

  // Handle edit model
  const handleEditModel = (model: ModelConfig) => {
    setEditingModel(model);
    setEditFormData({
      name: model.name,
      modelId: model.modelId || '',
      apiKey: model.apiKey || '',
      apiUrl: model.apiUrl || '',
      temperature: model.parameters?.find(p => p.name === 'temperature')?.defaultValue ?? 0.3,
      maxTokens: model.parameters?.find(p => p.name === 'maxTokens')?.defaultValue ?? 4000,
      // 价格配置
      costPer1KInput: model.costPer1KInput,
      costPer1KOutput: model.costPer1KOutput,
    });
    onEditOpen();
  };

  const handleSaveEdit = () => {
    if (!editingModel) return;

    if (!isConnected) {
      showToast(t.settings.disconnected + ': ' + t.settings.workspaceDesc, 'error');
      return;
    }

    const updatedModels = settings.models.map(m => {
      if (m.id === editingModel.id) {
        // Update parameters
        const updatedParameters = m.parameters.map(p => {
          if (p.name === 'temperature') {
            return { ...p, defaultValue: editFormData.temperature };
          }
          if (p.name === 'maxTokens') {
            return { ...p, defaultValue: editFormData.maxTokens };
          }
          return p;
        });

        return {
          ...m,
          name: editFormData.name,
          modelId: editFormData.modelId,
          apiKey: editFormData.apiKey,
          apiUrl: editFormData.apiUrl || undefined,
          parameters: updatedParameters,
          // 价格配置
          costPer1KInput: editFormData.costPer1KInput,
          costPer1KOutput: editFormData.costPer1KOutput,
        };
      }
      return m;
    });

    updateSettings({ ...settings, models: updatedModels });
    onEditClose();
    setEditingModel(null);
    showToast('模型配置已更新', 'success');
  };

  const truncatePath = (path: string, maxLength = 30) => {
    if (!path) return 'Not Selected';
    if (path.length <= maxLength) return path;
    const half = Math.floor((maxLength - 3) / 2);
    return `${path.substring(0, half)}...${path.substring(path.length - half)}`;
  };

  const handleSave = async () => {
    // Validate
    if (settings.pollingInterval < 1000) {
      showToast(t.settings?.intervalError || 'Polling interval must be at least 1 second', 'error');
      return;
    }

    // Ensure maxConcurrentJobs is within bounds (1-30)
    const maxJobs = Math.max(1, Math.min(30, settings.maxConcurrentJobs || 3));

    // Ensure durationBudgetConfig has valid values
    const configToSave = {
      ...durationBudgetConfig,
      platform: durationBudgetConfig.platform || 'douyin',
      pace: durationBudgetConfig.pace || 'normal',
    };

    console.log('[Settings] Saving duration budget config:', configToSave);

    await updateSettings({
      ...settings,
      maxConcurrentJobs: maxJobs,
      durationBudget: configToSave,
    });

    // Update local state to ensure consistency
    setDurationBudgetConfig(configToSave);

    console.log('[Settings] Settings saved successfully');
    showToast(t.settings?.saved || '设置已保存', 'success');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Update duration budget config helper
  const updateDurationBudget = (key: string, value: any) => {
    setDurationBudgetConfig(prev => ({ ...prev, [key]: value }));
  };

  // Handle duration budget toggle with dependency check
  const handleDurationBudgetToggle = (val: boolean) => {
    if (val) {
      // 开启时长预算时，自动开启生产级Prompt
      setDurationBudgetConfig(prev => ({
        ...prev,
        useDurationBudget: true,
        useProductionPrompt: true,
      }));
      showToast(
        t.settings.durationBudget?.autoEnabledProductionPrompt || '已自动开启生产级Prompt',
        'success'
      );
    } else {
      setDurationBudgetConfig(prev => ({
        ...prev,
        useDurationBudget: false,
      }));
    }
  };

  // Handle production prompt toggle with dependency warning
  const handleProductionPromptToggle = (val: boolean) => {
    if (!val && durationBudgetConfig.useDurationBudget) {
      // 关闭生产级Prompt时，如果时长预算已开启，显示警告
      const confirmClose = window.confirm(
        t.settings.durationBudget?.closeProductionPromptWarning ||
          '关闭"生产级Prompt"将导致"时长预算规划"失效，因为时长预算约束需要通过生产级Prompt才能生效。\n\n请选择：\n• 确定 - 同时关闭时长预算（推荐）\n• 取消 - 仅关闭生产级Prompt（时长预算将失效）'
      );

      if (confirmClose) {
        // 同时关闭时长预算
        setDurationBudgetConfig(prev => ({
          ...prev,
          useProductionPrompt: false,
          useDurationBudget: false,
        }));
        showToast(
          t.settings.durationBudget?.bothDisabled || '已同时关闭时长预算和生产级Prompt',
          'info'
        );
      } else {
        // 仅关闭生产级Prompt
        setDurationBudgetConfig(prev => ({
          ...prev,
          useProductionPrompt: false,
        }));
        showToast(
          t.settings.durationBudget?.productionPromptDisabledOnly ||
            '已关闭生产级Prompt，时长预算将失效',
          'warning'
        );
      }
    } else {
      setDurationBudgetConfig(prev => ({
        ...prev,
        useProductionPrompt: val,
      }));
    }
  };

  const navItems = [
    { id: 'general', label: '通用设置', icon: SettingsIcon },
    { id: 'duration', label: '时长预算', icon: Clock },
    { id: 'models', label: '模型管理', icon: Cpu },
    { id: 'quality', label: '质量评估', icon: Settings2 },
  ];

  const renderGeneral = () => (
    <>
      <Card
        className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
        radius="lg"
      >
        <CardHeader className="px-6 pt-6 pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-2 text-primary">
              <Database className="w-5 h-5" />
              <h2 className="text-xl font-black uppercase tracking-widest">{t.settings.workspace}</h2>
            </div>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">
              {t.settings.workspaceDesc}
            </p>
          </div>
          <Button
            onPress={handleSave}
            color="primary"
            variant="shadow"
            startContent={saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            className="font-black text-[14px] uppercase tracking-widest h-11 px-6 rounded-xl"
          >
            {saved ? t.common?.saved || '已保存' : t.common?.save || '保存'}
          </Button>
        </CardHeader>
        <CardBody className="px-4 pb-4 pt-3 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-900">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm text-primary border border-slate-100 dark:border-slate-800">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                  {t.settings.currentWorkspace}
                </p>
                <p
                  className="text-base font-black text-slate-900 dark:text-white tracking-tight"
                  title={workspaceName}
                >
                  {settings.useSandbox
                    ? t.settings.sandboxStorage
                    : truncatePath(workspaceName, 40)}
                </p>
                <div className="flex items-center mt-1">
                  <Chip
                    variant="flat"
                    color={isConnected ? 'success' : 'danger'}
                    size="sm"
                    className="font-black text-[8px] uppercase tracking-widest h-5"
                    startContent={
                      <div
                        className={`w-1 h-1 rounded-full mx-0.5 ${isConnected ? 'bg-success animate-pulse' : 'bg-danger'}`}
                      />
                    }
                  >
                    {isConnected ? t.settings.connected : t.settings.disconnected}
                  </Chip>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!settings.useSandbox &&
                (isConnected ? (
                  <>
                    <Button
                      variant="flat"
                      onPress={handleSwitchWorkspace}
                      startContent={<RefreshCcw className="w-3.5 h-3.5" />}
                      className="font-black text-[12px] uppercase tracking-widest h-9 px-4 rounded-xl"
                      size="sm"
                    >
                      {t.settings.switchWorkspace}
                    </Button>
                    <Button
                      color="danger"
                      variant="flat"
                      onPress={async () => {
                        await storageService.disconnect();
                        window.location.reload();
                      }}
                      startContent={<Trash2 className="w-3.5 h-3.5" />}
                      className="font-black text-[12px] uppercase tracking-widest h-9 px-4 rounded-xl"
                      size="sm"
                    >
                      {t.settings.resetWorkspace}
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      color="primary"
                      variant="shadow"
                      onPress={() => handleSandboxToggle(true)}
                      startContent={<RefreshCcw className="w-3.5 h-3.5" />}
                      className="font-black text-[12px] uppercase tracking-widest h-9 px-4 rounded-xl"
                      size="sm"
                    >
                      {t.settings.sandboxMode}
                    </Button>
                    <Button
                      variant="flat"
                      onPress={handleSwitchWorkspace}
                      startContent={<FolderOpen className="w-3.5 h-3.5" />}
                      className="font-black text-[12px] uppercase tracking-widest h-9 px-4 rounded-xl"
                      size="sm"
                    >
                      {t.settings.switchWorkspace}
                    </Button>
                  </div>
                ))}
            </div>
          </div>

          <Divider className="opacity-50" />

          {opfsSupported && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <label className="block text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1">
                  {t.settings.sandboxMode}
                </label>
                <p className="text-[11px] text-slate-400 font-medium">{t.settings.sandboxHelp}</p>
              </div>
              <Switch
                isSelected={settings.useSandbox}
                onValueChange={handleSandboxToggle}
                color="primary"
                size="md"
                classNames={{
                  wrapper: 'group-data-[selected=true]:bg-primary',
                }}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium">{t.settings.pollingInterval}</label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={Math.round(settings.pollingInterval / 1000).toString()}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) {
                      updateSettings({ ...settings, pollingInterval: val * 1000 });
                    }
                  }}
                  className="max-w-[140px]"
                  size="sm"
                  variant="bordered"
                  endContent={
                    <div className="pointer-events-none flex items-center">
                      <span className="text-default-400 text-xs">s</span>
                    </div>
                  }
                  aria-label="Polling Interval Input"
                />
              </div>
              <p className="text-[11px] text-default-400">{t.settings.pollingHelp}</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium">{t.settings?.maxConcurrentJobs}</label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={(settings.maxConcurrentJobs || 3).toString()}
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) {
                      updateSettings({ ...settings, maxConcurrentJobs: val });
                    }
                  }}
                  className="max-w-[140px]"
                  size="sm"
                  variant="bordered"
                  aria-label="Max Concurrent Jobs Input"
                />
              </div>
              <p className="text-[11px] text-default-400">{t.settings?.maxConcurrentJobsDesc}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card
        className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
        radius="lg"
      >
        <CardHeader className="px-6 pt-6 pb-3 flex flex-col items-start gap-1">
          <div className="flex items-center gap-2 text-primary">
            <Palette className="w-5 h-5" />
            <h2 className="text-xl font-black uppercase tracking-widest">
              {t.settings.appearance}
            </h2>
          </div>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">
            {t.settings.appearanceDesc}
          </p>
        </CardHeader>
        <CardBody className="px-4 pb-4 pt-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <label className="block text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                {t.settings.theme}
              </label>
              <Tabs
                selectedKey={settings.theme}
                onSelectionChange={key => updateSettings({ ...settings, theme: key as any })}
                variant="light"
                color="primary"
                aria-label="Theme Selection"
                classNames={{
                  tabList: 'bg-slate-100 dark:bg-slate-950 p-1 rounded-xl',
                  cursor: 'rounded-lg shadow-sm',
                  tab: 'h-9',
                  tabContent: 'font-black text-[12px] uppercase tracking-widest',
                }}
                fullWidth
              >
                <Tab
                  key="light"
                  title={
                    <div className="flex items-center gap-2">
                      <Sun className="w-3.5 h-3.5" />
                      <span>{t.settings.light}</span>
                    </div>
                  }
                />
                <Tab
                  key="dark"
                  title={
                    <div className="flex items-center gap-2">
                      <Moon className="w-3.5 h-3.5" />
                      <span>{t.settings.dark}</span>
                    </div>
                  }
                />
                <Tab
                  key="system"
                  title={
                    <div className="flex items-center gap-2">
                      <Monitor className="w-3.5 h-3.5" />
                      <span>{t.settings.system}</span>
                    </div>
                  }
                />
              </Tabs>
            </div>

            <div className="space-y-3">
              <label className="block text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                {t.settings.language}
              </label>
              <Tabs
                selectedKey={settings.language}
                onSelectionChange={key => updateSettings({ ...settings, language: key as any })}
                variant="light"
                color="primary"
                aria-label="Language Selection"
                classNames={{
                  tabList: 'bg-slate-100 dark:bg-slate-950 p-1 rounded-xl',
                  cursor: 'rounded-lg shadow-sm',
                  tab: 'h-9',
                  tabContent: 'font-black text-[12px] uppercase tracking-widest',
                }}
                fullWidth
              >
                <Tab
                  key="en"
                  title={
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5" />
                      <span>English</span>
                    </div>
                  }
                />
                <Tab
                  key="zh"
                  title={
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5" />
                      <span>简体中文</span>
                    </div>
                  }
                />
              </Tabs>
            </div>
          </div>
        </CardBody>
      </Card>
    </>
  );

  const renderDuration = () => (
    <Card
      className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
      radius="lg"
    >
      <CardHeader className="px-6 pt-6 pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2 text-primary">
            <Clock className="w-5 h-5" />
            <h2 className="text-xl font-black uppercase tracking-widest">
              {t.settings.durationBudget?.title || '时长预算配置'}
            </h2>
          </div>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">
            {t.settings.durationBudget?.desc || '配置剧本解析和分镜生成的时长预算规划'}
          </p>
        </div>
        <Button
          onPress={handleSave}
          color="primary"
          variant="shadow"
          startContent={saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          className="font-black text-[14px] uppercase tracking-widest h-11 px-6 rounded-xl"
        >
          {saved ? t.common?.saved || '已保存' : t.common?.save || '保存'}
        </Button>
      </CardHeader>
      <CardBody className="px-4 pb-4 pt-3 space-y-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h3 className="text-[15px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
              {t.settings.durationBudget?.basicConfig || '基础配置'}
              <span className="text-xs text-slate-400 ml-2 font-medium normal-case">
                {t.settings.durationBudget?.required || '必须'}
              </span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
            <Select
              label={t.settings.durationBudget?.platformLabel || '目标平台'}
              labelPlacement="outside"
              placeholder={t.settings.durationBudget?.platformPlaceholder || '选择发布平台'}
              selectedKeys={[durationBudgetConfig.platform]}
              onSelectionChange={keys => {
                const val = Array.from(keys)[0] as string;
                updateDurationBudget('platform', val);
              }}
              variant="bordered"
              radius="lg"
              size="md"
              classNames={{
                label: 'font-black uppercase tracking-widest text-[13px] mb-1 text-slate-500',
                value: 'font-medium text-[13px]',
              }}
              startContent={<Film className="w-3.5 h-3.5 text-default-400" />}
            >
              <SelectItem key="douyin" value="douyin">
                {t.settings.durationBudget?.platformDouyin || '抖音'}
              </SelectItem>
              <SelectItem key="kuaishou" value="kuaishou">
                {t.settings.durationBudget?.platformKuaishou || '快手'}
              </SelectItem>
              <SelectItem key="bilibili" value="bilibili">
                {t.settings.durationBudget?.platformBilibili || 'B站'}
              </SelectItem>
              <SelectItem key="premium" value="premium">
                {t.settings.durationBudget?.platformPremium || '精品'}
              </SelectItem>
            </Select>

            <Select
              label={t.settings.durationBudget?.paceLabel || '节奏选择'}
              labelPlacement="outside"
              placeholder={t.settings.durationBudget?.pacePlaceholder || '选择视频节奏'}
              selectedKeys={[durationBudgetConfig.pace]}
              onSelectionChange={keys => {
                const val = Array.from(keys)[0] as string;
                updateDurationBudget('pace', val);
              }}
              variant="bordered"
              radius="lg"
              size="md"
              classNames={{
                label: 'font-black uppercase tracking-widest text-[13px] mb-1 text-slate-500',
                value: 'font-medium text-[13px]',
              }}
              startContent={<Zap className="w-3.5 h-3.5 text-default-400" />}
            >
              <SelectItem key="fast" value="fast">
                {t.settings.durationBudget?.paceFast || '快'}
              </SelectItem>
              <SelectItem key="normal" value="normal">
                {t.settings.durationBudget?.paceNormal || '中'}
              </SelectItem>
              <SelectItem key="slow" value="slow">
                {t.settings.durationBudget?.paceSlow || '慢'}
              </SelectItem>
            </Select>
          </div>
        </div>

        <Divider className="opacity-50" />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-success rounded-full" />
            <h3 className="text-[15px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
              {t.settings.durationBudget?.coreFeatures || '核心功能'}
              <span className="text-xs text-slate-400 ml-2 font-medium normal-case">
                {t.settings.durationBudget?.linked || '联动'}
              </span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-3">
            <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <label className="block text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                    {t.settings.durationBudget?.useDurationBudget || '启用时长预算规划'}
                  </label>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {t.settings.durationBudget?.useDurationBudgetDesc ||
                      '根据平台要求自动规划分镜时长'}
                  </p>
                </div>
              </div>
              <Switch
                isSelected={durationBudgetConfig.useDurationBudget}
                onValueChange={val => handleDurationBudgetToggle(val)}
                color="primary"
                size="md"
                classNames={{
                  wrapper: 'group-data-[selected=true]:bg-primary',
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <Sparkles className="w-4 h-4 text-success" />
                </div>
                <div>
                  <label className="block text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                    {t.settings.durationBudget?.useProductionPrompt || '启用生产级Prompt'}
                  </label>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {t.settings.durationBudget?.useProductionPromptDesc || '使用更专业的提示词模板'}
                  </p>
                </div>
              </div>
              <Switch
                isSelected={durationBudgetConfig.useProductionPrompt}
                onValueChange={val => handleProductionPromptToggle(val)}
                color="success"
                size="md"
                classNames={{
                  wrapper: 'group-data-[selected=true]:bg-success',
                }}
              />
            </div>
          </div>
        </div>

        <Divider className="opacity-50" />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-warning rounded-full" />
            <h3 className="text-[15px] font-black uppercase tracking-widest text-slate-900 dark:text-white">
              {t.settings.durationBudget?.advancedFeatures || '高级功能'}
              <span className="text-xs text-slate-400 ml-2 font-medium normal-case">
                {t.settings.durationBudget?.optional || '可选'}
              </span>
            </h3>
          </div>

          <div className="pl-3">
            <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-900">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Shield className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <label className="block text-[13px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                    {t.settings.durationBudget?.useShotQC || '启用分镜质检'}
                  </label>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {t.settings.durationBudget?.useShotQCDesc || '自动检查分镜质量和时长'}
                  </p>
                </div>
              </div>
              <Switch
                isSelected={durationBudgetConfig.useShotQC}
                onValueChange={val => updateDurationBudget('useShotQC', val)}
                color="warning"
                size="md"
                classNames={{
                  wrapper: 'group-data-[selected=true]:bg-warning',
                }}
              />
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );

  const renderModels = () => (
    <Card
      className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
      radius="lg"
    >
      <CardHeader className="px-6 pt-6 pb-3 flex justify-between items-end">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-2 text-primary">
            <Cpu className="w-5 h-5" />
            <h2 className="text-xl font-black uppercase tracking-widest">
              {t.settings.modelConfigTitle}
            </h2>
          </div>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">
            {t.settings.modelConfigDesc}
          </p>
        </div>
        <Button
          onPress={() => setShowAdd(!showAdd)}
          color="primary"
          variant="shadow"
          startContent={<Plus className="w-5 h-5" />}
          className="font-black text-[14px] uppercase tracking-widest h-11 px-6 rounded-xl"
        >
          {t.settings.addModel}
        </Button>
      </CardHeader>
      <CardBody className="px-4 pb-4 pt-3 space-y-4">
        {settings.models.length > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800">
            {selectedModelIds.length > 0 && (
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                <span className="text-[11px] text-slate-500">
                  已选择 {selectedModelIds.length} 个模型
                </span>
                <Button
                  size="sm"
                  variant="flat"
                  color="success"
                  onPress={batchEnable}
                  className="h-6 text-[10px]"
                >
                  全部启用
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="secondary"
                  onPress={batchDisable}
                  className="h-6 text-[10px]"
                >
                  全部禁用
                </Button>
                <Button
                  size="sm"
                  variant="light"
                  onPress={() => setSelectedModelIds([])}
                  className="h-6 text-[10px]"
                >
                  清除选择
                </Button>
              </div>
            )}
            <div className="flex flex-col md:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="搜索模型名称或 Model ID..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  size="sm"
                  variant="bordered"
                  radius="lg"
                  classNames={{
                    input: 'pl-10 text-sm',
                    label: 'text-sm font-medium text-slate-700 dark:text-slate-300',
                  }}
                />
              </div>
              <Select
                placeholder="类型筛选"
                selectedKeys={selectedTypes}
                onSelectionChange={keys => setSelectedTypes(Array.from(keys) as string[])}
                size="sm"
                variant="bordered"
                radius="lg"
                className="w-full md:w-40"
                selectionMode="multiple"
                classNames={{
                  label: 'text-sm font-medium text-slate-700 dark:text-slate-300',
                }}
              >
                <SelectItem key="image" value="image">
                  图像生成
                </SelectItem>
                <SelectItem key="video" value="video">
                  视频生成
                </SelectItem>
                <SelectItem key="llm" value="llm">
                  文本解析
                </SelectItem>
              </Select>
              {existingProviders.length > 0 && (
                <Select
                  placeholder="提供商筛选"
                  selectedKeys={selectedProviders}
                  onSelectionChange={keys => setSelectedProviders(Array.from(keys) as string[])}
                  size="sm"
                  variant="bordered"
                  radius="lg"
                  className="w-full md:w-40"
                  selectionMode="multiple"
                  classNames={{
                    label: 'text-sm font-medium text-slate-700 dark:text-slate-300',
                  }}
                >
                  {existingProviders.map(provider => (
                    <SelectItem key={provider} value={provider}>
                      {provider === 'volcengine'
                        ? '火山引擎'
                        : provider === 'vidu'
                          ? 'Vidu'
                          : provider === 'openai'
                            ? 'OpenAI'
                            : provider === 'aliyun'
                              ? '阿里云'
                              : provider === 'modelscope'
                                ? '魔搭社区'
                                : provider}
                    </SelectItem>
                  ))}
                </Select>
              )}
              <Select
                placeholder="排序方式"
                selectedKeys={[sortBy]}
                onSelectionChange={keys =>
                  setSortBy(Array.from(keys)[0] as 'name' | 'type' | 'recent')
                }
                size="sm"
                variant="bordered"
                radius="lg"
                className="w-full md:w-36"
                classNames={{
                  label: 'text-sm font-medium text-slate-700 dark:text-slate-300',
                }}
              >
                <SelectItem key="name" value="name">
                  按名称
                </SelectItem>
                <SelectItem key="type" value="type">
                  按类型
                </SelectItem>
                <SelectItem key="recent" value="recent">
                  最近添加
                </SelectItem>
              </Select>
              {(searchQuery || selectedTypes.length > 0 || selectedProviders.length > 0) && (
                <Button
                  variant="light"
                  size="sm"
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedTypes([]);
                    setSelectedProviders([]);
                  }}
                  startContent={<X className="w-4 h-4" />}
                  className="text-slate-500"
                >
                  清除
                </Button>
              )}
            </div>
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              显示{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {filteredModels.length}
              </span>{' '}
              个模型
              {filteredModels.length !== settings.models.length && (
                <span>（共 {settings.models.length} 个）</span>
              )}
            </div>
          </div>
        )}

        {showAdd && (
          <Card
            className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800"
            shadow="none"
            radius="lg"
          >
            <CardBody className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label={t.settings.modelName}
                  labelPlacement="outside"
                  placeholder="My Custom Model Config"
                  value={newModelName}
                  onValueChange={setNewModelName}
                  variant="bordered"
                  radius="lg"
                  size="lg"
                  classNames={{
                    label: 'text-sm font-medium text-slate-700 dark:text-slate-300 mb-2',
                    input: 'text-[15px]',
                  }}
                />
                <Select
                  label={t.settings.modelType}
                  labelPlacement="outside"
                  placeholder="Select type"
                  selectedKeys={selectedType ? [selectedType] : []}
                  onSelectionChange={keys => {
                    const val = Array.from(keys)[0] as any;
                    setSelectedType(val);
                    setSelectedProvider('');
                    setSelectedBaseModelId('');
                  }}
                  variant="bordered"
                  radius="lg"
                  size="lg"
                  classNames={{
                    label: 'text-sm font-medium text-slate-700 dark:text-slate-300 mb-2',
                    value: 'text-[15px]',
                  }}
                >
                  <SelectItem key="image" value="image">
                    {t.settings.modelTypeImage}
                  </SelectItem>
                  <SelectItem key="video" value="video">
                    {t.settings.modelTypeVideo}
                  </SelectItem>
                  <SelectItem key="llm" value="llm">
                    文本解析 (LLM)
                  </SelectItem>
                </Select>
              </div>

              {selectedProvider === 'custom' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <Select
                      label={t.settings.modelConfig?.apiProtocolType || 'API协议类型'}
                      labelPlacement="outside"
                      placeholder={
                        t.settings.modelConfig?.selectApiProtocolPlaceholder || '选择 API 协议类型'
                      }
                      selectedKeys={customModel.provider ? [customModel.provider] : []}
                      onSelectionChange={keys => {
                        const val = Array.from(keys)[0] as string;
                        if (val) {
                          setCustomModel({ ...customModel, provider: val });
                        }
                      }}
                      variant="bordered"
                      radius="lg"
                      size="lg"
                      classNames={{
                        label: 'text-sm font-medium text-slate-700 dark:text-slate-300 mb-2',
                        value: 'text-[15px]',
                      }}
                    >
                      {providerAliasMapper.getSupportedAliases().map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </Select>
                    <Input
                      label={t.settings.modelIdOnly}
                      labelPlacement="outside"
                      placeholder={t.settings.modelConfig?.modelIdPlaceholder}
                      value={customModel.modelId}
                      onValueChange={v => setCustomModel({ ...customModel, modelId: v })}
                      variant="bordered"
                      radius="lg"
                      size="lg"
                      classNames={{
                        label:
                          'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                        input: 'font-medium text-[15px]',
                      }}
                    />
                    <Input
                      label={t.settings.modelConfig?.apiUrlLabel}
                      labelPlacement="outside"
                      placeholder={t.settings.modelConfig?.apiUrlPlaceholder}
                      value={customModel.apiUrl}
                      onValueChange={v => setCustomModel({ ...customModel, apiUrl: v })}
                      variant="bordered"
                      radius="lg"
                      size="lg"
                      classNames={{
                        label:
                          'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                        input: 'font-medium text-[15px]',
                      }}
                    />
                  </div>

                  {selectedType === 'llm' && (
                    <div className="space-y-4">
                      <div
                        className="flex items-center gap-2 cursor-pointer text-primary"
                        onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                      >
                        <span className="font-black uppercase tracking-widest text-[13px]">
                          {showAdvancedOptions ? '▼' : '▶'}{' '}
                          {t.settings.modelConfig?.advancedOptions}
                        </span>
                        <span className="text-xs text-slate-400">
                          {t.settings.modelConfig?.advancedOptionsDesc}
                        </span>
                      </div>

                      {showAdvancedOptions && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-primary/10 dark:bg-primary/20 rounded-xl">
                          <Input
                            label={t.settings.modelConfig?.temperature}
                            labelPlacement="outside"
                            type="number"
                            placeholder="0.3"
                            value={customModel.temperature.toString()}
                            onValueChange={v =>
                              setCustomModel({
                                ...customModel,
                                temperature: parseFloat(v) || 0.3,
                              })
                            }
                            variant="bordered"
                            radius="lg"
                            size="lg"
                            classNames={{
                              label:
                                'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                              input: 'font-medium text-[15px]',
                            }}
                          />
                          <Input
                            label={t.settings.modelConfig?.maxTokens}
                            labelPlacement="outside"
                            type="number"
                            placeholder="32000"
                            value={customModel.maxTokens.toString()}
                            onValueChange={v =>
                              setCustomModel({
                                ...customModel,
                                maxTokens: parseInt(v) || 32000,
                              })
                            }
                            variant="bordered"
                            radius="lg"
                            size="lg"
                            classNames={{
                              label:
                                'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                              input: 'font-medium text-[15px]',
                            }}
                          />
                          <div className="flex items-center gap-4 pt-6">
                            <Switch
                              isSelected={customModel.enableThinking}
                              onValueChange={v =>
                                setCustomModel({ ...customModel, enableThinking: v })
                              }
                              size="lg"
                              color="secondary"
                            />
                            <div className="flex flex-col">
                              <span className="font-black uppercase tracking-widest text-[13px] text-slate-500">
                                {t.settings.modelConfig?.enableThinking}
                              </span>
                              <span className="text-xs text-slate-400">
                                {t.settings.modelConfig?.enableThinkingDesc}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {showAdvancedOptions && (
                        <div className="mt-4 pt-4 border-t border-primary/20">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="font-black uppercase tracking-widest text-[13px] text-slate-500">
                              {t.settings.modelConfig?.priceConfig}
                            </span>
                            <span className="text-xs text-slate-400">
                              {t.settings.modelConfig?.priceConfigDesc}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-primary/10 dark:bg-primary/20 rounded-xl">
                            <Input
                              label={t.settings.modelConfig?.costPer1KInput}
                              labelPlacement="outside"
                              type="number"
                              placeholder="0.01"
                              step="0.001"
                              min={0}
                              value={customModel.costPer1KInput?.toString() || ''}
                              onValueChange={v =>
                                setCustomModel({
                                  ...customModel,
                                  costPer1KInput: v ? parseFloat(v) : undefined,
                                })
                              }
                              variant="bordered"
                              radius="lg"
                              size="lg"
                              classNames={{
                                label:
                                  'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                                input: 'font-medium text-[15px]',
                              }}
                            />
                            <Input
                              label={t.settings.modelConfig?.costPer1KOutput}
                              labelPlacement="outside"
                              type="number"
                              placeholder="0.03"
                              step="0.001"
                              min={0}
                              value={customModel.costPer1KOutput?.toString() || ''}
                              onValueChange={v =>
                                setCustomModel({
                                  ...customModel,
                                  costPer1KOutput: v ? parseFloat(v) : undefined,
                                })
                              }
                              variant="bordered"
                              radius="lg"
                              size="lg"
                              classNames={{
                                label:
                                  'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                                input: 'font-medium text-[15px]',
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedType === 'image' && (
                    <div className="space-y-4 p-6 bg-primary/10 dark:bg-primary/20 rounded-xl">
                      <div className="flex items-center gap-4">
                        <Switch
                          isSelected={customModel.supportsReferenceImage}
                          onValueChange={v =>
                            setCustomModel({ ...customModel, supportsReferenceImage: v })
                          }
                          size="lg"
                          color="secondary"
                        />
                        <div className="flex flex-col">
                          <span className="font-black uppercase tracking-widest text-[15px] text-slate-500">
                            {t.settings.modelConfig?.supportsReferenceImage}
                          </span>
                          <span className="text-xs text-slate-400">
                            {t.settings.modelConfig?.supportsReferenceImageDesc}
                          </span>
                        </div>
                      </div>

                      {customModel.supportsReferenceImage && (
                        <div className="pl-14">
                          <Input
                            label={t.settings.modelConfig?.maxReferenceImages}
                            labelPlacement="outside"
                            type="number"
                            placeholder="5"
                            value={customModel.maxReferenceImages.toString()}
                            onValueChange={v =>
                              setCustomModel({
                                ...customModel,
                                maxReferenceImages: parseInt(v) || 5,
                              })
                            }
                            variant="bordered"
                            radius="lg"
                            size="lg"
                            classNames={{
                              label:
                                'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                              input: 'font-medium text-[15px] w-32',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedProvider && selectedProvider !== 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Select
                    label={t.settings.provider}
                    labelPlacement="outside"
                    placeholder="Select provider"
                    isDisabled={!selectedType}
                    selectedKeys={selectedProvider ? [selectedProvider] : []}
                    onSelectionChange={keys => {
                      const val = Array.from(keys)[0] as any;
                      setSelectedProvider(val);
                      setSelectedBaseModelId('');
                    }}
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    classNames={{
                      label: 'text-sm font-medium text-slate-700 dark:text-slate-300 mb-2',
                      value: 'text-[15px]',
                    }}
                  >
                    <SelectItem key="custom" value="custom">
                      {t.settings.modelConfig?.providers?.custom || '自定义...'}
                    </SelectItem>
                    {availableProviders.map(p => (
                      <SelectItem key={p} value={p}>
                        {p === 'volcengine'
                          ? 'Volcengine (火山引擎)'
                          : p === 'vidu'
                            ? 'Vidu'
                            : p === 'openai'
                              ? 'OpenAI'
                              : p === 'aliyun-qianwen'
                                ? '阿里云通义千问'
                                : p === 'aliyun-qianwen-video'
                                  ? '阿里云通义万相'
                                  : p === 'aliyun-bailian'
                                    ? '阿里云百炼'
                                    : p === 'modelscope'
                                      ? '魔搭社区'
                                      : p}
                      </SelectItem>
                    ))}
                  </Select>

                  <Select
                    label={t.settings.baseModel}
                    labelPlacement="outside"
                    placeholder="Select a model"
                    isDisabled={!selectedProvider}
                    selectedKeys={selectedBaseModelId ? [selectedBaseModelId] : []}
                    onSelectionChange={keys => {
                      const val = Array.from(keys)[0] as string;
                      setSelectedBaseModelId(val);
                      if (!newModelName && val) {
                        const m = DEFAULT_MODELS.find((x: any) => x.id === val);
                        if (m) setNewModelName(m.name);
                      }
                    }}
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    classNames={{
                      label: 'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                      value: 'font-medium text-[15px]',
                    }}
                  >
                    {availableBaseModels.map((m: any) => (
                      <SelectItem key={m.id} value={m.id} textValue={m.name}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1">
                <Input
                  label={t.settings.apiKey}
                  labelPlacement="outside"
                  placeholder="Enter API Key for this model"
                  value={newApiKey}
                  onValueChange={setNewApiKey}
                  type="password"
                  variant="bordered"
                  radius="lg"
                  size="lg"
                  classNames={{
                    label: 'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                    input: 'font-medium text-[15px]',
                  }}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="light"
                  onPress={() => setShowAdd(false)}
                  className="font-black text-[14px] uppercase tracking-widest px-6 h-11 rounded-xl"
                >
                  {t.dashboard.cancel}
                </Button>
                <Button
                  color="primary"
                  onPress={selectedProvider === 'custom' ? handleAddCustomModel : handleAddModel}
                  isDisabled={
                    !selectedType ||
                    (selectedProvider === 'custom' ? !customModel.modelId : !selectedBaseModelId)
                  }
                  className="font-black text-[14px] uppercase tracking-widest px-8 h-11 rounded-xl shadow-lg shadow-primary/30"
                >
                  {t.settings.add}
                </Button>
              </div>
            </CardBody>
          </Card>
        )}

        <Table
          aria-label="Model configurations"
          variant="simple"
          classNames={{
            base: 'overflow-hidden',
            th: 'bg-transparent text-slate-400 font-black text-xs uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 py-3 px-4',
            td: 'py-3 px-4 font-medium text-sm text-slate-600 dark:text-slate-300',
            tr: 'border-b border-slate-50 dark:border-slate-900/50 last:border-0 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.1)] transition-all duration-200 cursor-pointer',
          }}
        >
          <TableHeader>
            <TableColumn width={40}>
              <input
                type="checkbox"
                checked={
                  selectedModelIds.length === filteredModels.length && filteredModels.length > 0
                }
                onChange={e => {
                  if (e.target.checked) {
                    setSelectedModelIds(filteredModels.map(m => m.id));
                  } else {
                    setSelectedModelIds([]);
                  }
                }}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
              />
            </TableColumn>
            <TableColumn width={80}>状态</TableColumn>
            <TableColumn>{t.settings.modelName}</TableColumn>
            <TableColumn>{t.settings.modelType}</TableColumn>
            <TableColumn>能力</TableColumn>
            <TableColumn>价格 ($/1K)</TableColumn>
            <TableColumn>{t.settings.modelIdOnly}</TableColumn>
            <TableColumn>API Key</TableColumn>
            <TableColumn align="end">{t.settings.actions}</TableColumn>
          </TableHeader>
          <TableBody
            emptyContent={
              filteredModels.length === 0 && settings.models.length > 0
                ? '没有找到匹配的模型'
                : 'No models configured.'
            }
          >
            {filteredModels.map(model => (
              <TableRow key={model.id}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedModelIds.includes(model.id)}
                    onChange={() => toggleModelSelection(model.id)}
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    isSelected={model.enabled ?? true}
                    onValueChange={() => toggleModelEnabled(model.id)}
                    size="sm"
                    color={(model.enabled ?? true) ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${model.type === 'video' ? 'bg-primary' : 'bg-pink-500'}`}
                    />
                    <span className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {model.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color="secondary"
                    className="font-medium text-[11px] uppercase tracking-wide px-2.5 h-6"
                  >
                    {model.type === 'video'
                      ? t.settings.modelTypeVideo
                      : model.type === 'llm'
                        ? '文本解析'
                        : t.settings.modelTypeImage}
                  </Chip>
                </TableCell>
                <TableCell>
                  {model.type === 'image' && (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="default"
                      className="font-medium text-[11px] uppercase tracking-wide px-2.5 h-6"
                    >
                      {model.capabilities?.supportsReferenceImage ? '支持参考图' : '文生图'}
                    </Chip>
                  )}
                  {model.type === 'video' && (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="default"
                      className="font-medium text-[11px] uppercase tracking-wide px-2.5 h-6"
                    >
                      视频生成
                    </Chip>
                  )}
                  {model.type === 'llm' && (
                    <Chip
                      size="sm"
                      variant="flat"
                      color="default"
                      className="font-medium text-[11px] uppercase tracking-wide px-2.5 h-6"
                    >
                      文本解析
                    </Chip>
                  )}
                </TableCell>
                <TableCell>
                  {model.type === 'llm' && (
                    <div className="text-xs text-slate-500">
                      {model.costPer1KInput !== undefined || model.costPer1KOutput !== undefined ? (
                        <div className="flex flex-col gap-1">
                          {model.costPer1KInput !== undefined && (
                            <span>输入: ${model.costPer1KInput.toFixed(3)}</span>
                          )}
                          {model.costPer1KOutput !== undefined && (
                            <span>输出: ${model.costPer1KOutput.toFixed(3)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">使用默认价格</span>
                      )}
                    </div>
                  )}
                  {model.type !== 'llm' && <span className="text-slate-400 text-xs">-</span>}
                </TableCell>
                <TableCell>
                  <Input
                    size="md"
                    variant="bordered"
                    value={model.modelId}
                    isReadOnly
                    className="max-w-[300px]"
                    classNames={{
                      input: 'text-[14px] font-mono',
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 max-w-[320px]">
                    <Input
                      size="md"
                      variant="bordered"
                      type={visibleApiKeys[model.id] ? 'text' : 'password'}
                      value={model.apiKey}
                      onValueChange={val => {
                        const updatedModels = settings.models.map(m =>
                          m.id === model.id ? { ...m, apiKey: val } : m
                        );
                        updateSettings({ ...settings, models: updatedModels });
                      }}
                      className="flex-1"
                      classNames={{
                        input: 'text-[14px]',
                      }}
                    />
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={() => toggleApiKeyVisibility(model.id)}
                      className="text-slate-400 hover:text-slate-600"
                      aria-label={visibleApiKeys[model.id] ? '隐藏 API Key' : '显示 API Key'}
                    >
                      {visibleApiKeys[model.id] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      isIconOnly
                      color="primary"
                      variant="light"
                      size="sm"
                      onPress={() => handleEditModel(model)}
                      className="opacity-40 hover:opacity-100 transition-opacity"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      isIconOnly
                      color="danger"
                      variant="light"
                      size="sm"
                      onPress={() => handleRemoveModel(model.id)}
                      className="opacity-40 hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#050505]">
      {/* Sidebar Navigation */}
      <div className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-2 mb-8">
          <h1 className="text-2xl font-black text-white tracking-tighter uppercase">
            {t.settings.title}
          </h1>
          <p className="text-slate-400 font-medium text-sm">{t.settings.subtitle}</p>
        </div>

        <nav className="space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-white shadow-lg'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-black text-sm uppercase tracking-widest">{item.label}</span>
              </button>
            );
          })}
        </nav>


      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 pb-20">
        {activeNav === 'general' && renderGeneral()}
        {activeNav === 'duration' && renderDuration()}
        {activeNav === 'models' && renderModels()}
        {activeNav === 'quality' && <QualityRulesEditor t={t} />}
      </div>

      {/* Modals */}
      <Modal isOpen={isConfirmOpen} onClose={onConfirmClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            {t.settings.confirmRemoveModelTitle}
          </ModalHeader>
          <ModalBody>
            <p>{t.settings.confirmRemoveModelDesc}</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onConfirmClose}>
              {t.dashboard.cancel}
            </Button>
            <Button color="danger" onPress={confirmDeleteModel}>
              {t.common.delete}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Model Modal */}
      <Modal isOpen={isEditOpen} onClose={onEditClose} size="lg">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-xl font-bold">编辑模型配置</span>
            <span className="text-sm text-slate-400">{editingModel?.name}</span>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label={t.settings.modelName}
              labelPlacement="outside"
              placeholder={t.settings.modelConfig?.customModelPlaceholder}
              value={editFormData.name}
              onValueChange={val => setEditFormData({ ...editFormData, name: val })}
              variant="bordered"
              radius="lg"
              size="lg"
              classNames={{
                label: 'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                input: 'font-medium text-[15px]',
              }}
            />
            <Input
              label={t.settings.modelIdOnly}
              labelPlacement="outside"
              placeholder={t.settings.modelConfig?.modelIdPlaceholder}
              value={editFormData.modelId}
              onValueChange={val => setEditFormData({ ...editFormData, modelId: val })}
              variant="bordered"
              radius="lg"
              size="lg"
              description="修改Model ID将改变实际调用的模型，请确保ID正确"
              classNames={{
                label: 'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                input: 'font-medium text-[15px]',
                description: 'text-xs text-amber-500 mt-1',
              }}
            />
            <Input
              label={t.settings.apiKey}
              labelPlacement="outside"
              placeholder="Enter API Key for this model"
              type="password"
              value={editFormData.apiKey}
              onValueChange={val => setEditFormData({ ...editFormData, apiKey: val })}
              variant="bordered"
              radius="lg"
              size="lg"
              classNames={{
                label: 'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                input: 'font-medium text-[15px]',
              }}
            />
            <Input
              label={t.settings.modelConfig?.apiUrlLabel}
              labelPlacement="outside"
              placeholder={t.settings.modelConfig?.apiUrlPlaceholder}
              value={editFormData.apiUrl}
              onValueChange={val => setEditFormData({ ...editFormData, apiUrl: val })}
              variant="bordered"
              radius="lg"
              size="lg"
              classNames={{
                label: 'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                input: 'font-medium text-[15px]',
              }}
            />
            {editingModel?.type === 'llm' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t.settings.modelConfig?.temperature}
                    labelPlacement="outside"
                    type="number"
                    placeholder="0.3"
                    value={editFormData.temperature.toString()}
                    onValueChange={val =>
                      setEditFormData({ ...editFormData, temperature: parseFloat(val) || 0.3 })
                    }
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    min={0}
                    max={2}
                    step={0.1}
                    classNames={{
                      label: 'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                      input: 'font-medium text-[15px]',
                    }}
                  />
                  <Input
                    label={t.settings.modelConfig?.maxTokens}
                    labelPlacement="outside"
                    type="number"
                    placeholder="4000"
                    value={editFormData.maxTokens.toString()}
                    onValueChange={val =>
                      setEditFormData({ ...editFormData, maxTokens: parseInt(val) || 4000 })
                    }
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    min={100}
                    max={128000}
                    step={100}
                    classNames={{
                      label: 'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                      input: 'font-medium text-[15px]',
                    }}
                  />
                </div>

                {/* 价格配置 */}
                <div className="mt-4 pt-4 border-t border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-black uppercase tracking-widest text-[13px] text-slate-500">
                      {t.settings.modelConfig?.priceConfig}
                    </span>
                    <span className="text-xs text-slate-400">
                      {t.settings.modelConfig?.priceConfigDesc}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label={t.settings.modelConfig?.costPer1KInput}
                      labelPlacement="outside"
                      type="number"
                      placeholder="0.01"
                      step="0.001"
                      min={0}
                      value={editFormData.costPer1KInput?.toString() || ''}
                      onValueChange={val =>
                        setEditFormData({
                          ...editFormData,
                          costPer1KInput: val ? parseFloat(val) : undefined,
                        })
                      }
                      variant="bordered"
                      radius="lg"
                      size="lg"
                      classNames={{
                        label:
                          'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                        input: 'font-medium text-[15px]',
                      }}
                    />
                    <Input
                      label={t.settings.modelConfig?.costPer1KOutput}
                      labelPlacement="outside"
                      type="number"
                      placeholder="0.03"
                      step="0.001"
                      min={0}
                      value={editFormData.costPer1KOutput?.toString() || ''}
                      onValueChange={val =>
                        setEditFormData({
                          ...editFormData,
                          costPer1KOutput: val ? parseFloat(val) : undefined,
                        })
                      }
                      variant="bordered"
                      radius="lg"
                      size="lg"
                      classNames={{
                        label:
                          'font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500',
                        input: 'font-medium text-[15px]',
                      }}
                    />
                  </div>
                </div>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onEditClose}>
              {t.dashboard.cancel}
            </Button>
            <Button color="primary" onPress={handleSaveEdit}>
              {t.common.save}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Settings;
