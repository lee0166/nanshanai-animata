import React, { useState, useEffect } from 'react';
import { ModelConfig } from '../types';
import { DEFAULT_MODELS } from '../config/models';
import { useApp } from '../contexts/context';
import { Save, Plus, Trash2, Monitor, Moon, Sun, FolderOpen, RefreshCcw, CheckCircle, AlertCircle, Globe, Palette, Settings as SettingsIcon, Database, Cpu } from 'lucide-react';
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
  const [selectedProvider, setSelectedProvider] = useState<'vidu' | 'volcengine' | 'other' | ''>('');
  const [selectedBaseModelId, setSelectedBaseModelId] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [selectedType, setSelectedType] = useState<'video' | 'image' | ''>('');
  
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
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                    <Database className="w-5 h-5" />
                    <h2 className="text-xl font-black uppercase tracking-widest">{t.settings.workspace}</h2>
                </div>
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">{t.settings.workspaceDesc}</p>
            </CardHeader>
            <CardBody className="px-8 pb-8 pt-4 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-slate-50 dark:bg-slate-950 rounded-[2rem] border border-slate-100 dark:border-slate-900">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm text-indigo-600 dark:text-indigo-400 border border-slate-100 dark:border-slate-800">
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
                            wrapper: "group-data-[selected=true]:bg-indigo-600"
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
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
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
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
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
                    <Card className="bg-indigo-50/30 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20" shadow="none" radius="lg">
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
                                </Select>
                            </div>

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
                                        setSelectedBaseModelId(''); // Reset model selection
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
                                            {p === 'volcengine' ? 'Volcengine (火山引擎)' : p === 'vidu' ? 'Vidu' : p}
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
                                <Button color="primary" onPress={handleAddModel} className="font-black text-[14px] uppercase tracking-widest px-8 h-11 rounded-xl shadow-lg shadow-indigo-500/30">
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
                        <TableColumn>{t.settings.modelIdOnly}</TableColumn>
                        <TableColumn>API Key</TableColumn>
                        <TableColumn align="end">{t.settings.actions}</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No models configured.">
                        {settings.models.map(model => (
                            <TableRow key={model.id}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${model.type === 'video' ? 'bg-indigo-500' : 'bg-pink-500'}`} />
                                      <span className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{model.name}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Chip 
                                      size="md" 
                                      variant="flat" 
                                      color={model.type === 'video' ? "primary" : "secondary"}
                                      className="font-black text-[13px] uppercase tracking-widest px-3 h-7"
                                    >
                                        {model.type === 'video' ? t.settings.modelTypeVideo : t.settings.modelTypeImage}
                                    </Chip>
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
    </div>
  );
};

export default Settings;
