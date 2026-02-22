import React, { useState, useEffect } from 'react';
import { ModelConfig, ModelCapabilities } from '../types';
import { DEFAULT_MODELS, COMMON_VOLC_VIDEO_PARAMS, COMMON_IMAGE_PARAMS } from '../config/models';
import { useApp } from '../contexts/context';
import { Save, Plus, Trash2, Monitor, Moon, Sun, FolderOpen, RefreshCcw, CheckCircle, AlertCircle, Globe, Palette, Settings as SettingsIcon, Database, Cpu, Pencil } from 'lucide-react';
import { storageService } from '../services/storage';
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
  useDisclosure
} from "@heroui/react";

const Settings: React.FC = () => {
  const { settings, updateSettings, t, workspaceName, reloadSettings, isConnected, checkConnection, resetWorkspace, showToast } = useApp();
  const [saved, setSaved] = useState(false);
  const [opfsSupported, setOpfsSupported] = useState(false);
  const { isOpen: isConfirmOpen, onOpen: onConfirmOpen, onClose: onConfirmClose } = useDisclosure();
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);
  
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
  const [selectedProvider, setSelectedProvider] = useState<'vidu' | 'volcengine' | 'modelscope' | 'openai' | 'aliyun' | 'other' | ''>('');
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
      DEFAULT_MODELS
        .filter((m: ModelConfig) => m.type === selectedType)
        .map((m: ModelConfig) => m.provider)
    );
    return Array.from(providers);
  }, [selectedType]);
  
  // Get available models based on provider and type
  const availableBaseModels = React.useMemo(() => {
    // 过滤出该 Provider 和 Type 下的基础模型，且过滤掉已经添加过的模型（基于 templateId 或 id）
    const addedTemplateIds = new Set(settings.models.map(m => m.templateId || m.id));
    return DEFAULT_MODELS.filter((m: ModelConfig) => 
      m.provider === selectedProvider && 
      m.type === selectedType &&
      !addedTemplateIds.has(m.id)
    );
  }, [selectedProvider, selectedType, settings.models]);

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
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      templateId: baseModel.id, // Link to template
      name: newModelName,
      apiKey: newApiKey, // User provided key
      isDefault: false
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
    setCustomModel({ provider: 'modelscope', modelId: '', apiUrl: '', temperature: 0.3, maxTokens: 32000, enableThinking: false, supportsReferenceImage: true, maxReferenceImages: 5 });
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
    const llmParams = selectedType === 'llm' ? [
      {
        name: "temperature",
        label: "Temperature",
        type: "number" as const,
        defaultValue: customModel.temperature,
        min: 0,
        max: 2,
        step: 0.1,
      },
      {
        name: "maxTokens",
        label: "Max Tokens",
        type: "number" as const,
        defaultValue: customModel.maxTokens,
        min: 100,
        max: 128000,
        step: 100,
      },
    ] : [];

    // Build providerOptions for LLM
    const providerOptions = selectedType === 'llm' ? {
      enableThinking: customModel.enableThinking
    } : undefined;

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
        maxReferenceImages: customModel.supportsReferenceImage ? customModel.maxReferenceImages : undefined,
      };
    } else if (selectedType === 'video') {
      capabilities = {
        maxBatchSize: 1,
        supportsReferenceImage: false,
      };
    }

    const newConfig: ModelConfig = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      name: newModelName,
      provider: customModel.provider,
      modelId: customModel.modelId,
      type: selectedType as 'image' | 'video' | 'llm',
      capabilities,
      parameters: selectedType === 'image' ? COMMON_IMAGE_PARAMS : selectedType === 'video' ? COMMON_VOLC_VIDEO_PARAMS : llmParams,
      apiUrl: customModel.apiUrl || undefined,
      apiKey: newApiKey,
      isDefault: false,
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
    setCustomModel({ provider: 'modelscope', modelId: '', apiUrl: '', temperature: 0.3, maxTokens: 32000, enableThinking: false, supportsReferenceImage: true, maxReferenceImages: 5 });
  };

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
    
    await updateSettings({
        ...settings,
        maxConcurrentJobs: maxJobs
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-full overflow-y-auto p-6 md:p-10 max-w-[1600px] mx-auto space-y-12 pb-32">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">
          {t.settings.title}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">{t.settings.subtitle}</p>
      </div>
      
      <div className="space-y-10">

        {/* Workspace Section */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden" radius="lg">
            <CardHeader className="px-8 pt-8 pb-4 flex flex-col items-start gap-1">
                <div className="flex items-center gap-2 text-primary">
                    <Database className="w-5 h-5" />
                    <h2 className="text-xl font-black uppercase tracking-widest">{t.settings.workspace}</h2>
                </div>
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">{t.settings.workspaceDesc}</p>
            </CardHeader>
            <CardBody className="px-8 pb-8 pt-4 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-slate-50 dark:bg-slate-950 rounded-[2rem] border border-slate-100 dark:border-slate-900">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm text-primary border border-slate-100 dark:border-slate-800">
                            <FolderOpen className="w-7 h-7" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{t.settings.currentWorkspace}</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white tracking-tight" title={workspaceName}>
                                {settings.useSandbox ? t.settings.sandboxStorage : truncatePath(workspaceName, 40)}
                            </p>
                            <div className="flex items-center mt-2">
                                <Chip 
                                  variant="flat" 
                                  color={isConnected ? "success" : "danger"} 
                                  size="sm"
                                  className="font-black text-[9px] uppercase tracking-widest h-6"
                                  startContent={<div className={`w-1.5 h-1.5 rounded-full mx-1 ${isConnected ? 'bg-success animate-pulse' : 'bg-danger'}`} />}
                                >
                                  {isConnected ? t.settings.connected : t.settings.disconnected}
                                </Chip>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {!settings.useSandbox && (
                            isConnected ? (
                                <>
                                    <Button 
                                        variant="flat"
                                        onPress={handleSwitchWorkspace}
                                        startContent={<RefreshCcw className="w-4 h-4" />}
                                        className="font-black text-[14px] uppercase tracking-widest h-11 px-6 rounded-2xl"
                                    >
                                        {t.settings.switchWorkspace}
                                    </Button>
                                    <Button 
                                        color="danger"
                                        variant="flat"
                                        onPress={async () => {
                                            await storageService.disconnect();
                                            // Force reload to clear any in-memory state
                                            window.location.reload();
                                        }}
                                        startContent={<Trash2 className="w-4 h-4" />}
                                        className="font-black text-[14px] uppercase tracking-widest h-11 px-6 rounded-2xl"
                                    >
                                        {t.settings.resetWorkspace}
                                    </Button>
                                </>
                            ) : (
                                <div className="flex gap-3">
                                    <Button 
                                        color="primary"
                                        variant="shadow"
                                        onPress={() => handleSandboxToggle(true)}
                                        startContent={<RefreshCcw className="w-4 h-4" />}
                                        className="font-black text-[14px] uppercase tracking-widest h-11 px-6 rounded-2xl"
                                    >
                                        {t.settings.sandboxMode}
                                    </Button>
                                    <Button 
                                        variant="flat"
                                        onPress={handleSwitchWorkspace}
                                        startContent={<FolderOpen className="w-4 h-4" />}
                                        className="font-black text-[14px] uppercase tracking-widest h-11 px-6 rounded-2xl"
                                    >
                                        {t.settings.switchWorkspace}
                                    </Button>
                                </div>
                            )
                        )}
                    </div>
                </div>

                <Divider className="opacity-50" />

                {/* Sandbox Mode Toggle */}
                {opfsSupported && (
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex-1">
                            <label className="block text-[15px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1">
                                {t.settings.sandboxMode}
                            </label>
                            <p className="text-[13px] text-slate-400 font-medium">
                                {t.settings.sandboxHelp}
                            </p>
                        </div>
                        <Switch
                          isSelected={settings.useSandbox}
                          onValueChange={handleSandboxToggle}
                          color="primary"
                          size="lg"
                          classNames={{
                            wrapper: "group-data-[selected=true]:bg-primary"
                          }}
                        />
                    </div>
                )}

                <div className="flex flex-col gap-2">
                  <label className="text-[15px] font-medium">{t.settings.pollingInterval}</label>
                  <div className="flex items-center gap-4">
                    <Input
                        type="number"
                        min={1}
                        max={30}
                        value={(Math.round(settings.pollingInterval / 1000)).toString()}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                                updateSettings({...settings, pollingInterval: val * 1000});
                            }
                        }}
                        className="max-w-xs"
                        size="sm"
                        variant="bordered"
                        endContent={
                          <div className="pointer-events-none flex items-center">
                            <span className="text-default-400 text-small">s</span>
                          </div>
                        }
                        aria-label="Polling Interval Input"
                    />
                  </div>
                  <p className="text-[13px] text-default-400">
                    {t.settings.pollingHelp}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[15px] font-medium">{t.settings?.maxConcurrentJobs}</label>
                  <div className="flex items-center gap-4">
                    <Input
                        type="number"
                        min={1}
                        max={30}
                        value={(settings.maxConcurrentJobs || 3).toString()}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                                updateSettings({...settings, maxConcurrentJobs: val});
                            }
                        }}
                        className="max-w-xs"
                        size="sm"
                        variant="bordered"
                        aria-label="Max Concurrent Jobs Input"
                    />
                  </div>
                  <p className="text-[13px] text-default-400">
                    {t.settings?.maxConcurrentJobsDesc}
                  </p>
                </div>
            </CardBody>
        </Card>
        
        {/* Appearance Section */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden" radius="lg">
            <CardHeader className="px-8 pt-8 pb-4 flex flex-col items-start gap-1">
                <div className="flex items-center gap-2 text-primary">
                    <Palette className="w-5 h-5" />
                    <h2 className="text-xl font-black uppercase tracking-widest">{t.settings.appearance}</h2>
                </div>
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">{t.settings.appearanceDesc}</p>
            </CardHeader>
            <CardBody className="px-8 pb-8 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-4">
                        <label className="block text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{t.settings.theme}</label>
                        <Tabs 
                          selectedKey={settings.theme} 
                          onSelectionChange={(key) => updateSettings({...settings, theme: key as any})}
                          variant="light"
                          color="primary"
                          aria-label="Theme Selection"
                          classNames={{
                            tabList: "bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl",
                            cursor: "rounded-xl shadow-sm",
                            tab: "h-11",
                            tabContent: "font-black text-[14px] uppercase tracking-widest"
                          }}
                          fullWidth
                        >
                            <Tab 
                              key="light" 
                              title={
                                <div className="flex items-center gap-2">
                                  <Sun className="w-4 h-4" />
                                  <span>{t.settings.light}</span>
                                </div>
                              } 
                            />
                            <Tab 
                              key="dark" 
                              title={
                                <div className="flex items-center gap-2">
                                  <Moon className="w-4 h-4" />
                                  <span>{t.settings.dark}</span>
                                </div>
                              } 
                            />
                            <Tab 
                              key="system" 
                              title={
                                <div className="flex items-center gap-2">
                                  <Monitor className="w-4 h-4" />
                                  <span>{t.settings.system}</span>
                                </div>
                              } 
                            />
                        </Tabs>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{t.settings.language}</label>
                        <Tabs 
                          selectedKey={settings.language} 
                          onSelectionChange={(key) => updateSettings({...settings, language: key as any})}
                          variant="light"
                          color="primary"
                          aria-label="Language Selection"
                          classNames={{
                            tabList: "bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl",
                            cursor: "rounded-xl shadow-sm",
                            tab: "h-11",
                            tabContent: "font-black text-[14px] uppercase tracking-widest"
                          }}
                          fullWidth
                        >
                            <Tab 
                              key="en" 
                              title={
                                <div className="flex items-center gap-2">
                                  <Globe className="w-4 h-4" />
                                  <span>English</span>
                                </div>
                              } 
                            />
                            <Tab 
                              key="zh" 
                              title={
                                <div className="flex items-center gap-2">
                                  <Globe className="w-4 h-4" />
                                  <span>简体中文</span>
                                </div>
                              } 
                            />
                        </Tabs>
                    </div>
                </div>
            </CardBody>
        </Card>

        {/* Model Management Section */}
        <Card className="border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden" radius="lg">
            <CardHeader className="px-8 pt-8 pb-4 flex justify-between items-end">
                <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2 text-primary">
                        <Cpu className="w-5 h-5" />
                        <h2 className="text-xl font-black uppercase tracking-widest">{t.settings.modelConfig}</h2>
                    </div>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">{t.settings.modelConfigDesc}</p>
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
            <CardBody className="px-8 pb-8 pt-4 space-y-8">
                {/* Add Model Form */}
                {showAdd && (
                    <Card className="bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30" shadow="none" radius="lg">
                        <CardBody className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                                      label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                      input: "font-medium text-[15px]"
                                    }}
                                />
                                <Select 
                                    label={t.settings.modelType}
                                    labelPlacement="outside"
                                    placeholder="Select type"
                                    selectedKeys={selectedType ? [selectedType] : []}
                                    onSelectionChange={(keys) => {
                                        const val = Array.from(keys)[0] as any;
                                        setSelectedType(val);
                                        setSelectedProvider('');
                                        setSelectedBaseModelId('');
                                    }}
                                    variant="bordered"
                                    radius="lg"
                                    size="lg"
                                    classNames={{
                                      label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                      value: "font-medium text-[15px]"
                                    }}
                                >
                                    <SelectItem key="image" value="image">{t.settings.modelTypeImage}</SelectItem>
                                    <SelectItem key="video" value="video">{t.settings.modelTypeVideo}</SelectItem>
                                    <SelectItem key="llm" value="llm">文本解析 (LLM)</SelectItem>
                                </Select>
                            </div>
                            
                            {/* Custom Model Toggle */}
                            <div className="flex items-center gap-4 pt-4 pb-2">
                                <Switch
                                    isSelected={isCustomModel}
                                    onValueChange={setIsCustomModel}
                                    size="lg"
                                    color="secondary"
                                />
                                <div className="flex flex-col">
                                    <span className="font-black uppercase tracking-widest text-[15px] text-slate-500">自定义模型</span>
                                    <span className="text-xs text-slate-400">添加任意模型，不受预设列表限制</span>
                                </div>
                            </div>
                            
                            {/* Custom Model Form */}
                            {isCustomModel && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-primary/10 dark:bg-primary/20 rounded-xl">
                                        <Input 
                                            label="Provider"
                                            labelPlacement="outside"
                                            placeholder="e.g., modelscope, openai, volcengine"
                                            value={customModel.provider}
                                            onValueChange={v => setCustomModel({...customModel, provider: v})}
                                            variant="bordered"
                                            radius="lg"
                                            size="lg"
                                            classNames={{
                                              label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                              input: "font-medium text-[15px]"
                                            }}
                                        />
                                        <Input 
                                            label="Model ID"
                                            labelPlacement="outside"
                                            placeholder="e.g., deepseek-v3-1-terminus"
                                            value={customModel.modelId}
                                            onValueChange={v => setCustomModel({...customModel, modelId: v})}
                                            variant="bordered"
                                            radius="lg"
                                            size="lg"
                                            classNames={{
                                              label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                              input: "font-medium text-[15px]"
                                            }}
                                        />
                                        <Input 
                                            label="API URL (可选)"
                                            labelPlacement="outside"
                                            placeholder="e.g., https://ark.cn-beijing.volces.com/api/v3"
                                            value={customModel.apiUrl}
                                            onValueChange={v => setCustomModel({...customModel, apiUrl: v})}
                                            variant="bordered"
                                            radius="lg"
                                            size="lg"
                                            classNames={{
                                              label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                              input: "font-medium text-[15px]"
                                            }}
                                        />
                                    </div>
                                    
                                    {/* Advanced Options Toggle for LLM */}
                                    {selectedType === 'llm' && (
                                        <div className="space-y-4">
                                            <div 
                                                className="flex items-center gap-2 cursor-pointer text-primary"
                                                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                                            >
                                                <span className="font-black uppercase tracking-widest text-[13px]">
                                                    {showAdvancedOptions ? '▼' : '▶'} 高级选项
                                                </span>
                                                <span className="text-xs text-slate-400">配置温度、Token限制等参数</span>
                                            </div>
                                            
                                            {showAdvancedOptions && (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-primary/10 dark:bg-primary/20 rounded-xl">
                                                    <Input 
                                                        label="Temperature"
                                                        labelPlacement="outside"
                                                        type="number"
                                                        placeholder="0.3"
                                                        value={customModel.temperature.toString()}
                                                        onValueChange={v => setCustomModel({...customModel, temperature: parseFloat(v) || 0.3})}
                                                        variant="bordered"
                                                        radius="lg"
                                                        size="lg"
                                                        classNames={{
                                                          label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                                          input: "font-medium text-[15px]"
                                                        }}
                                                    />
                                                    <Input 
                                                        label="Max Tokens"
                                                        labelPlacement="outside"
                                                        type="number"
                                                        placeholder="32000"
                                                        value={customModel.maxTokens.toString()}
                                                        onValueChange={v => setCustomModel({...customModel, maxTokens: parseInt(v) || 32000})}
                                                        variant="bordered"
                                                        radius="lg"
                                                        size="lg"
                                                        classNames={{
                                                          label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                                          input: "font-medium text-[15px]"
                                                        }}
                                                    />
                                                    <div className="flex items-center gap-4 pt-6">
                                                        <Switch
                                                            isSelected={customModel.enableThinking}
                                                            onValueChange={v => setCustomModel({...customModel, enableThinking: v})}
                                                            size="lg"
                                                            color="secondary"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="font-black uppercase tracking-widest text-[13px] text-slate-500">启用思考</span>
                                                            <span className="text-xs text-slate-400">enable_thinking</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* 价格配置 */}
                                            {showAdvancedOptions && (
                                                <div className="mt-4 pt-4 border-t border-primary/20">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <span className="font-black uppercase tracking-widest text-[13px] text-slate-500">价格配置（可选）</span>
                                                        <span className="text-xs text-slate-400">用于成本估算，不配置则使用默认值</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-primary/10 dark:bg-primary/20 rounded-xl">
                                                        <Input 
                                                            label="输入价格 ($/1K tokens)"
                                                            labelPlacement="outside"
                                                            type="number"
                                                            placeholder="0.01"
                                                            step="0.001"
                                                            min={0}
                                                            value={customModel.costPer1KInput?.toString() || ''}
                                                            onValueChange={v => setCustomModel({...customModel, costPer1KInput: v ? parseFloat(v) : undefined})}
                                                            variant="bordered"
                                                            radius="lg"
                                                            size="lg"
                                                            classNames={{
                                                              label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                                              input: "font-medium text-[15px]"
                                                            }}
                                                        />
                                                        <Input 
                                                            label="输出价格 ($/1K tokens)"
                                                            labelPlacement="outside"
                                                            type="number"
                                                            placeholder="0.03"
                                                            step="0.001"
                                                            min={0}
                                                            value={customModel.costPer1KOutput?.toString() || ''}
                                                            onValueChange={v => setCustomModel({...customModel, costPer1KOutput: v ? parseFloat(v) : undefined})}
                                                            variant="bordered"
                                                            radius="lg"
                                                            size="lg"
                                                            classNames={{
                                                              label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                                              input: "font-medium text-[15px]"
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Image Generation Capabilities */}
                                    {selectedType === 'image' && (
                                        <div className="space-y-4 p-6 bg-primary/10 dark:bg-primary/20 rounded-xl">
                                            <div className="flex items-center gap-4">
                                                <Switch
                                                    isSelected={customModel.supportsReferenceImage}
                                                    onValueChange={v => setCustomModel({...customModel, supportsReferenceImage: v})}
                                                    size="lg"
                                                    color="secondary"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="font-black uppercase tracking-widest text-[15px] text-slate-500">支持参考图生图</span>
                                                    <span className="text-xs text-slate-400">该模型是否支持使用参考图片生成</span>
                                                </div>
                                            </div>
                                            
                                            {customModel.supportsReferenceImage && (
                                                <div className="pl-14">
                                                    <Input 
                                                        label="最大参考图数量"
                                                        labelPlacement="outside"
                                                        type="number"
                                                        placeholder="5"
                                                        value={customModel.maxReferenceImages.toString()}
                                                        onValueChange={v => setCustomModel({...customModel, maxReferenceImages: parseInt(v) || 5})}
                                                        variant="bordered"
                                                        radius="lg"
                                                        size="lg"
                                                        classNames={{
                                                          label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                                          input: "font-medium text-[15px] w-32"
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Provider Selection (hidden when custom) */}
                            {!isCustomModel && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <Select 
                                    label={t.settings.provider}
                                    labelPlacement="outside"
                                    placeholder="Select provider"
                                    isDisabled={!selectedType}
                                    selectedKeys={selectedProvider ? [selectedProvider] : []}
                                    onSelectionChange={(keys) => {
                                        const val = Array.from(keys)[0] as any;
                                        setSelectedProvider(val);
                                        setSelectedBaseModelId('');
                                    }}
                                    variant="bordered"
                                    radius="lg"
                                    size="lg"
                                    classNames={{
                                      label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                      value: "font-medium text-[15px]"
                                    }}
                                >
                                    {availableProviders.map((p) => (
                                        <SelectItem key={p} value={p}>
                                            {p === 'volcengine' ? 'Volcengine (火山引擎)' : 
                                             p === 'vidu' ? 'Vidu' : 
                                             p === 'openai' ? 'OpenAI' :
                                             p === 'aliyun' ? '阿里云 (通义千问)' :
                                             p === 'modelscope' ? '魔搭社区' : p}
                                        </SelectItem>
                                    ))}
                                </Select>

                                <Select 
                                    label={t.settings.baseModel}
                                    labelPlacement="outside"
                                    placeholder="Select a model"
                                    isDisabled={!selectedProvider}
                                    selectedKeys={selectedBaseModelId ? [selectedBaseModelId] : []}
                                    onSelectionChange={(keys) => {
                                        const val = Array.from(keys)[0] as string;
                                        setSelectedBaseModelId(val);
                                        // Auto-fill name if empty
                                        if (!newModelName && val) {
                                            const m = DEFAULT_MODELS.find((x: any) => x.id === val);
                                            if (m) setNewModelName(m.name);
                                        }
                                    }}
                                    variant="bordered"
                                    radius="lg"
                                    size="lg"
                                    classNames={{
                                      label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                      value: "font-medium text-[15px]"
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
                                      label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                                      input: "font-medium text-[15px]"
                                    }}
                                />
                            </div>
                            
                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="light" onPress={() => setShowAdd(false)} className="font-black text-[14px] uppercase tracking-widest px-6 h-11 rounded-xl">
                                    {t.dashboard.cancel}
                                </Button>
                                <Button 
                                    color="primary" 
                                    onPress={isCustomModel ? handleAddCustomModel : handleAddModel} 
                                    isDisabled={!selectedType || (isCustomModel ? !customModel.modelId : !selectedBaseModelId)}
                                    className="font-black text-[14px] uppercase tracking-widest px-8 h-11 rounded-xl shadow-lg shadow-primary/30"
                                >
                                    {t.settings.add}
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                )}

                {/* List */}
                <Table 
                  aria-label="Model configurations"
                  variant="simple"
                  classNames={{
                    base: "overflow-hidden",
                    th: "bg-transparent text-slate-400 font-black text-xs uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 py-4 px-4",
                    td: "py-4 px-4 font-medium text-sm text-slate-600 dark:text-slate-300",
                    tr: "border-b border-slate-50 dark:border-slate-900/50 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                  }}
                >
                    <TableHeader>
                        <TableColumn>{t.settings.modelName}</TableColumn>
                        <TableColumn>{t.settings.modelType}</TableColumn>
                        <TableColumn>能力</TableColumn>
                        <TableColumn>价格 ($/1K)</TableColumn>
                        <TableColumn>{t.settings.modelIdOnly}</TableColumn>
                        <TableColumn>API Key</TableColumn>
                        <TableColumn align="end">{t.settings.actions}</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No models configured.">
                        {settings.models.map(model => (
                            <TableRow key={model.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${model.type === 'video' ? 'bg-primary' : 'bg-pink-500'}`} />
                                      <span className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{model.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                      size="md"
                                      variant="flat"
                                      color={model.type === 'video' ? "primary" : model.type === 'llm' ? "success" : "secondary"}
                                      className="font-black text-[13px] uppercase tracking-widest px-3 h-7"
                                    >
                                        {model.type === 'video' ? t.settings.modelTypeVideo : model.type === 'llm' ? '文本解析' : t.settings.modelTypeImage}
                                    </Chip>
                                </TableCell>
                                <TableCell>
                                    {model.type === 'image' && (
                                        <Chip
                                            size="md"
                                            variant="flat"
                                            color={model.capabilities?.supportsReferenceImage ? "success" : "default"}
                                            className="font-black text-[12px] uppercase tracking-widest px-3 h-7"
                                        >
                                            {model.capabilities?.supportsReferenceImage ? '支持参考图' : '文生图'}
                                        </Chip>
                                    )}
                                    {model.type === 'video' && (
                                        <Chip
                                            size="md"
                                            variant="flat"
                                            color="primary"
                                            className="font-black text-[12px] uppercase tracking-widest px-3 h-7"
                                        >
                                            视频生成
                                        </Chip>
                                    )}
                                    {model.type === 'llm' && (
                                        <Chip
                                            size="md"
                                            variant="flat"
                                            color="success"
                                            className="font-black text-[12px] uppercase tracking-widest px-3 h-7"
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
                                    {model.type !== 'llm' && (
                                        <span className="text-slate-400 text-xs">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Input
                                        size="md"
                                        variant="bordered"
                                        value={model.modelId}
                                        isReadOnly
                                        className="max-w-[300px]"
                                        classNames={{
                                            input: "text-[14px] font-mono",
                                        }}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Input
                                        size="md"
                                        variant="bordered"
                                        type="password"
                                        value={model.apiKey}
                                        onValueChange={(val) => {
                                            const updatedModels = settings.models.map(m => 
                                                m.id === model.id ? { ...m, apiKey: val } : m
                                            );
                                            updateSettings({ ...settings, models: updatedModels });
                                        }}
                                        className="max-w-[300px]"
                                        classNames={{
                                            input: "text-[14px]",
                                        }}
                                    />
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
      </div>

      <Modal isOpen={isConfirmOpen} onClose={onConfirmClose}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">{t.settings.confirmRemoveModelTitle}</ModalHeader>
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
              label="模型名称"
              labelPlacement="outside"
              placeholder="输入模型名称"
              value={editFormData.name}
              onValueChange={(val) => setEditFormData({ ...editFormData, name: val })}
              variant="bordered"
              radius="lg"
              size="lg"
              classNames={{
                label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                input: "font-medium text-[15px]"
              }}
            />
            <Input
              label="Model ID"
              labelPlacement="outside"
              placeholder="输入模型ID，如：Qwen/Qwen3-8B"
              value={editFormData.modelId}
              onValueChange={(val) => setEditFormData({ ...editFormData, modelId: val })}
              variant="bordered"
              radius="lg"
              size="lg"
              description="修改Model ID将改变实际调用的模型，请确保ID正确"
              classNames={{
                label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                input: "font-medium text-[15px]",
                description: "text-xs text-amber-500 mt-1"
              }}
            />
            <Input
              label="API Key"
              labelPlacement="outside"
              placeholder="输入API Key"
              type="password"
              value={editFormData.apiKey}
              onValueChange={(val) => setEditFormData({ ...editFormData, apiKey: val })}
              variant="bordered"
              radius="lg"
              size="lg"
              classNames={{
                label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                input: "font-medium text-[15px]"
              }}
            />
            <Input
              label="API URL (可选)"
              labelPlacement="outside"
              placeholder="https://api.example.com/v1"
              value={editFormData.apiUrl}
              onValueChange={(val) => setEditFormData({ ...editFormData, apiUrl: val })}
              variant="bordered"
              radius="lg"
              size="lg"
              classNames={{
                label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                input: "font-medium text-[15px]"
              }}
            />
            {editingModel?.type === 'llm' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Temperature"
                    labelPlacement="outside"
                    type="number"
                    placeholder="0.3"
                    value={editFormData.temperature.toString()}
                    onValueChange={(val) => setEditFormData({ ...editFormData, temperature: parseFloat(val) || 0.3 })}
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    min={0}
                    max={2}
                    step={0.1}
                    classNames={{
                      label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                      input: "font-medium text-[15px]"
                    }}
                  />
                  <Input
                    label="Max Tokens"
                    labelPlacement="outside"
                    type="number"
                    placeholder="4000"
                    value={editFormData.maxTokens.toString()}
                    onValueChange={(val) => setEditFormData({ ...editFormData, maxTokens: parseInt(val) || 4000 })}
                    variant="bordered"
                    radius="lg"
                    size="lg"
                    min={100}
                    max={128000}
                    step={100}
                    classNames={{
                      label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                      input: "font-medium text-[15px]"
                    }}
                  />
                </div>
                
                {/* 价格配置 */}
                <div className="mt-4 pt-4 border-t border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-black uppercase tracking-widest text-[13px] text-slate-500">价格配置（可选）</span>
                    <span className="text-xs text-slate-400">用于成本估算</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="输入价格 ($/1K tokens)"
                      labelPlacement="outside"
                      type="number"
                      placeholder="0.01"
                      step="0.001"
                      min={0}
                      value={editFormData.costPer1KInput?.toString() || ''}
                      onValueChange={(val) => setEditFormData({ ...editFormData, costPer1KInput: val ? parseFloat(val) : undefined })}
                      variant="bordered"
                      radius="lg"
                      size="lg"
                      classNames={{
                        label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                        input: "font-medium text-[15px]"
                      }}
                    />
                    <Input
                      label="输出价格 ($/1K tokens)"
                      labelPlacement="outside"
                      type="number"
                      placeholder="0.03"
                      step="0.001"
                      min={0}
                      value={editFormData.costPer1KOutput?.toString() || ''}
                      onValueChange={(val) => setEditFormData({ ...editFormData, costPer1KOutput: val ? parseFloat(val) : undefined })}
                      variant="bordered"
                      radius="lg"
                      size="lg"
                      classNames={{
                        label: "font-black uppercase tracking-widest text-[15px] mb-2 text-slate-500",
                        input: "font-medium text-[15px]"
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
