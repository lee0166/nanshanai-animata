
import React, { useEffect, useState, useMemo } from 'react';
import { Asset, AssetType, CharacterAsset, ItemAsset, ItemType } from '../types';
import { storageService } from '../services/storage';
import { isVideoFile, VIDEO_EXTENSIONS, IMAGE_EXTENSIONS } from '../services/fileUtils';
import { Trash2, Image as ImageIcon, Film, Plus, Filter, Upload, FileVideo, FileImage, AlertTriangle, Pencil } from 'lucide-react';
import { useApp } from '../contexts/context';
import { useToast } from '../contexts/ToastContext';
import { 
  Button, 
  Card, 
  CardBody, 
  CardFooter, 
  Tabs, 
  Tab, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter, 
  useDisclosure,
  Chip,
  Skeleton,
  Input,
  Select,
  SelectItem
} from "@heroui/react";

interface AssetListProps {
  projectId: string;
  type: AssetType;
  refreshTrigger: number;
  onSelect?: (asset: Asset) => void;
  onAdd?: () => void;
  highlightedAssetId?: string;
  itemTypeFilter?: string;
  onItemTypeFilterChange?: (filter: string) => void;
  onDelete?: () => void;
}

type ModalityFilter = 'all' | 'image' | 'video';
type SourceFilter = 'all' | 'generated' | 'imported';

const AssetList: React.FC<AssetListProps> = ({ 
  projectId, 
  type, 
  refreshTrigger, 
  onSelect, 
  onAdd, 
  highlightedAssetId,
  itemTypeFilter: externalItemTypeFilter,
  onItemTypeFilterChange,
  onDelete
}) => {
  const { t } = useApp();
  const { showToast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [modalityFilter, setModalityFilter] = useState<ModalityFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  
  // Internal state for item type filter if not provided externally
  const [internalItemTypeFilter, setInternalItemTypeFilter] = useState<string>('all');
  
  // Use external filter if provided, otherwise internal
  const itemTypeFilter = externalItemTypeFilter !== undefined ? externalItemTypeFilter : internalItemTypeFilter;
  const setItemTypeFilter = (val: string) => {
    if (onItemTypeFilterChange) {
      onItemTypeFilterChange(val);
    } else {
      setInternalItemTypeFilter(val);
    }
  };
  
  // Refs for scrolling
  const assetRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (highlightedAssetId && assetRefs.current[highlightedAssetId]) {
      assetRefs.current[highlightedAssetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedAssetId]);

  const {isOpen: isDeleteOpen, onOpen: onDeleteOpen, onOpenChange: onDeleteOpenChange} = useDisclosure();
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);

  // Edit Modal Disclosure
  const {isOpen: isEditOpen, onOpen: onEditOpen, onOpenChange: onEditOpenChange} = useDisclosure();
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadAssets();
    setModalityFilter('all');
    setSourceFilter('all');
  }, [projectId, type, refreshTrigger]);

  const loadAssets = async () => {
    setLoading(true);
    try {
        const all = await storageService.getAssets(projectId);
        
        // Primary Filter: By tab type
        let filtered: Asset[] = [];
        if (type === AssetType.RESOURCES) {
             filtered = all.filter(a => {
                if (a.type === AssetType.IMAGE || a.type === AssetType.VIDEO) return true;
                // Legacy support for older imports
                if (a.type === AssetType.CHARACTER) {
                    const c = a as CharacterAsset;
                    if (c.category) return true; 
                    if (!c.gender && !c.ageGroup) return true;
                    return false;
                }
                if (a.type === AssetType.VIDEO_SEGMENT) {
                    if (a.category) return true;
                    if (!(a as any).script) return true;
                    return false;
                }
                return false;
             });
        } else {
             filtered = all.filter(a => a.type === type);
        }
        
        // Sort by creation date (newest first)
        filtered.sort((a, b) => b.createdAt - a.createdAt);

        // Load local URLs for visible items
        const newUrls: Record<string, string> = {};
        for (const asset of filtered) {
          let effectivePath = asset.filePath;
          
          // For Video Segments (Fragments), prioritize the latest generated video
          if (asset.type === AssetType.VIDEO_SEGMENT) {
              const fragment = asset as any;
              if (fragment.videos && fragment.videos.length > 0) {
                  // Sort by createdAt desc to get the latest
                  const sorted = [...fragment.videos].sort((a: any, b: any) => b.createdAt - a.createdAt);
                  if (sorted[0].path) {
                      effectivePath = sorted[0].path;
                  }
              }
          }

          if (effectivePath) {
             if (effectivePath.startsWith('remote:')) {
                newUrls[asset.id] = effectivePath.substring(7);
             } else {
                newUrls[asset.id] = await storageService.getAssetUrl(effectivePath);
             }
          }
        }
        
        setAssets(filtered);
        setUrls(newUrls);
    } catch (error) {
        console.error("Failed to load assets:", error);
    } finally {
        setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    
    if (!isVideo && !isImage) {
      showToast(t.project.invalidFileType, 'error');
      return;
    }

    // Generate path based on asset type and rules
    // Rule: imported/{type}/{timestamp}_{random}.ext
    const ext = file.name.split('.').pop() || '';
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    
    let subDir = 'resources';
    if (type === AssetType.CHARACTER) subDir = 'character';
    else if (type === AssetType.SCENE) subDir = 'scene';
    else if (type === AssetType.ITEM) subDir = 'item';
    else if (type === AssetType.VIDEO_SEGMENT) subDir = 'video_segment';
    
    const filePath = `imported/${subDir}/${uniqueName}`;
    
    await storageService.saveBinaryFile(filePath, file);

    const newAsset: Asset = {
      id: crypto.randomUUID(),
      projectId,
      type: isVideo ? AssetType.VIDEO : AssetType.IMAGE,
      category: 'imported',
      name: file.name,
      prompt: t.project.filterImported,
      filePath: filePath,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await storageService.saveAsset(newAsset);
    loadAssets();
  };

  const handleRequestEdit = (e: any, asset: Asset) => {
    // e.stopPropagation() handled by Button onPress? No, usually native event needed or use onPress logic.
    // But HeroUI onPress doesn't pass native event directly sometimes.
    // We wrap it.
    setAssetToEdit(asset);
    setEditName(asset.name);
    onEditOpen();
  };

  const confirmEdit = async () => {
    if (!assetToEdit || !editName.trim()) return;
    try {
        const updated = { ...assetToEdit, name: editName, updatedAt: Date.now() };
        await storageService.saveAsset(updated);
        await loadAssets();
        onEditOpenChange();
    } catch (e: any) {
        console.error(e);
        showToast(e.message || t.errors.unknownError, 'error');
    }
  };

  const onRequestDelete = async (e: React.MouseEvent | any, id: string, path?: string) => {
    if(e && e.stopPropagation) e.stopPropagation();
    if(e && e.preventDefault) e.preventDefault();

    // Check associations if it's a resource
    if (type === AssetType.RESOURCES && path) {
        const allAssets = await storageService.getAssets(projectId);
        const associated = [];

        for (const asset of allAssets) {
            // Skip the asset being deleted and other resources (only check usage in characters, scenes, etc.)
            if (asset.id === id) continue;
            if (asset.type === AssetType.IMAGE || asset.type === AssetType.VIDEO) continue;
            
            // Check main file path
            if (asset.filePath === path) {
                associated.push(`${t.project[asset.type as keyof typeof t.project] || asset.type}: ${asset.name}`);
                continue;
            }

            // Check metadata reference images
            if (asset.metadata?.referenceImages && Array.isArray(asset.metadata.referenceImages)) {
                if (asset.metadata.referenceImages.includes(path)) {
                    associated.push(`${t.project[asset.type as keyof typeof t.project] || asset.type}: ${asset.name}`);
                    continue;
                }
            }

            // Check generated images (for characters)
            if (asset.type === AssetType.CHARACTER) {
                const char = asset as CharacterAsset;
                if (char.generatedImages?.some(img => img.path === path)) {
                     associated.push(`${t.project[asset.type as keyof typeof t.project] || asset.type}: ${asset.name}`);
                     continue;
                }
            }
        }

        if (associated.length > 0) {
            const msg = `${t.project.resourceUsedBy}:\n${associated.slice(0, 5).join('\n')}${associated.length > 5 ? '\n...' : ''}\n\n${t.project.deleteInFunction}`;
            showToast(msg, 'warning'); // Toast supports multiline? Usually not great, but better than alert. Or use specific modal?
            // Actually, for long content, a modal is better, but showToast is requested.
            // Let's assume showToast can handle it or just show summary.
            return;
        }
    }

    setAssetToDelete(id);
    onDeleteOpen();
  };

  const confirmDelete = async () => {
    if (!assetToDelete) return;
    try {
      await storageService.deleteAsset(assetToDelete, projectId);
      await loadAssets();
      if (onDelete) onDelete();
    } catch (error) {
      console.error("Failed to delete asset:", error);
    } finally {
      setAssetToDelete(null);
    }
  };

  const isResources = type === AssetType.RESOURCES;

  // Filters: By modality and source (UI driven)
  const displayAssets = useMemo(() => {
    let result = assets;

    if (modalityFilter !== 'all') {
      result = result.filter(asset => {
        const isVideo = asset.type === AssetType.VIDEO || 
                        asset.type === AssetType.VIDEO_SEGMENT || 
                        isVideoFile(asset.filePath);
        if (modalityFilter === 'video') return isVideo;
        if (modalityFilter === 'image') return !isVideo;
        return true;
      });
    }

    if (sourceFilter !== 'all') {
      result = result.filter(asset => {
        // If category is missing, treat as imported (legacy behavior)
        const category = asset.category || 'imported';
        return category === sourceFilter;
      });
    }

    if (type === AssetType.ITEM && itemTypeFilter !== 'all') {
        result = result.filter(asset => {
            const item = asset as ItemAsset;
            return item.itemType === itemTypeFilter;
        });
    }

    return result;
  }, [assets, modalityFilter, sourceFilter, itemTypeFilter, type]);

  if (loading && assets.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-20">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="aspect-[4/5] space-y-5 p-4" radius="lg">
            <Skeleton className="rounded-xl">
              <div className="h-48 rounded-xl bg-default-300"></div>
            </Skeleton>
            <div className="space-y-3">
              <Skeleton className="w-3/5 rounded-lg">
                <div className="h-3 w-3/5 rounded-lg bg-default-200"></div>
              </Skeleton>
              <Skeleton className="w-4/5 rounded-lg">
                <div className="h-3 w-4/5 rounded-lg bg-default-200"></div>
              </Skeleton>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      {/* Filtering Header for Items Tab */}
      {type === AssetType.ITEM && (
        <div className="flex flex-col sm:flex-row items-center justify-start gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
           <div className="flex items-center gap-2 ml-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{t.project.itemTypeLabel}</span>
           </div>
           <Select
                placeholder={t.project.filterAll}
                selectedKeys={[itemTypeFilter]}
                onChange={(e) => setItemTypeFilter(e.target.value)}
                className="w-48"
                variant="bordered"
                radius="lg"
                size="sm"
                classNames={{
                    value: "font-bold text-xs",
                    trigger: "border-slate-300 dark:border-slate-700 h-9 min-h-unit-8"
                }}
           >
                <SelectItem key="all" value="all" textValue={t.project.filterAll}>
                    {t.project.filterAll}
                </SelectItem>
                {Object.entries(t.project.itemTypes || {}).map(([key, label]) => (
                    <SelectItem key={key} value={key} textValue={label as string}>
                        {label as string}
                    </SelectItem>
                ))}
           </Select>
        </div>
      )}

      {/* Filtering Header for Resources Tab */}
      {isResources && (
        <div className="flex flex-col sm:flex-row items-center justify-start gap-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-4 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto">
          <Tabs 
            selectedKey={modalityFilter} 
            onSelectionChange={(key) => setModalityFilter(key as ModalityFilter)}
            variant="light"
            color="primary"
            aria-label={t.project.filterByModality}
            classNames={{
              tabList: "bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800",
              cursor: "rounded-xl shadow-sm",
              tab: "h-9",
              tabContent: "font-bold text-xs"
            }}
          >
            <Tab 
              key="all" 
              title={
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5" />
                  <span>{t.project.filterAll}</span>
                </div>
              } 
            />
            <Tab 
              key="image" 
              title={
                <div className="flex items-center gap-2">
                  <FileImage className="w-3.5 h-3.5" />
                  <span>{t.project.filterImages}</span>
                </div>
              } 
            />
            <Tab 
              key="video" 
              title={
                <div className="flex items-center gap-2">
                  <FileVideo className="w-3.5 h-3.5" />
                  <span>{t.project.filterVideos}</span>
                </div>
              } 
            />
          </Tabs>

          <Tabs 
            selectedKey={sourceFilter} 
            onSelectionChange={(key) => setSourceFilter(key as SourceFilter)}
            variant="light"
            color="secondary"
            aria-label={t.project.filterBySource}
            classNames={{
              tabList: "bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800",
              cursor: "rounded-xl shadow-sm",
              tab: "h-9",
              tabContent: "font-bold text-xs"
            }}
          >
            <Tab 
              key="all" 
              title={
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5" />
                  <span>{t.project.filterAll}</span>
                </div>
              } 
            />
            <Tab 
              key="generated" 
              title={t.project.filterGenerated} 
            />
            <Tab 
              key="imported" 
              title={t.project.filterImported} 
            />
          </Tabs>

          <Button
            as="label"
            color="primary"
            variant="shadow"
            radius="lg"
            startContent={<Upload className="w-4 h-4" />}
            className="font-bold text-xs cursor-pointer px-6 h-11"
          >
            {t.project.importFile}
            <input 
              type="file" 
              className="hidden" 
              accept={[
                ...IMAGE_EXTENSIONS.map(e => '.' + e),
                ...VIDEO_EXTENSIONS.map(e => '.' + e)
              ].join(',')} 
              onChange={handleImport} 
            />
          </Button>
        </div>
      )}

      {displayAssets.length === 0 && !loading && isResources ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem]">
          <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-full mb-6">
            <ImageIcon className="w-12 h-12 opacity-20" />
          </div>
          <p className="font-black uppercase tracking-[0.3em] text-[10px]">{t.project.noResources}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-20">
          
          {/* Add New Card - FIRST ITEM */}
          {!isResources && onAdd && (
            <Card
              isPressable
              onPress={onAdd}
              className="bg-slate-50/50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 aspect-[3/4] w-full group hover:border-indigo-500/50 hover:bg-white dark:hover:bg-slate-900 transition-all duration-300"
              radius="lg"
              shadow="none"
            >
              <CardBody className="flex flex-col items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-xl group-hover:shadow-indigo-500/30 transition-all duration-500">
                  <Plus className="w-7 h-7" />
                </div>
                <span className="text-[13px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em] group-hover:text-indigo-600 transition-colors">
                  {t.project.create}
                </span>
              </CardBody>
            </Card>
          )}

          {displayAssets.map((asset) => (
            <div
              key={asset.id}
              ref={el => assetRefs.current[asset.id] = el}
              onClick={() => onSelect?.(asset)}
              className="cursor-pointer w-full"
            >
            <Card 
              className={`group border bg-white dark:bg-slate-900 shadow-sm hover:scale-[1.02] transition-all duration-300 aspect-[3/4] w-full ${
                highlightedAssetId === asset.id 
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
                  : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/50'
              }`}
              radius="lg"
            >
              <CardBody className="p-0 flex-none aspect-square relative overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                {urls[asset.id] ? (
                  (asset.type === AssetType.VIDEO || asset.type === AssetType.VIDEO_SEGMENT || isVideoFile(asset.filePath)) ?
                  <video src={urls[asset.id]} className="w-full h-full object-contain pointer-events-none" /> :
                  <img src={urls[asset.id]} alt={asset.name} className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-800 gap-2">
                    {asset.filePath && urls[asset.id] === '' ? (
                      <>
                        <AlertTriangle className="w-10 h-10 text-warning opacity-50" />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{t.project.missing}</span>
                      </>
                    ) : (
                      asset.type === AssetType.VIDEO_SEGMENT ? <Film className="w-12 h-12"/> : <ImageIcon className="w-12 h-12" />
                    )}
                  </div>
                )}
                
                <div
                  className="absolute top-3 right-3 z-50 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 flex gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                    {/* Edit Button for Video Segments */}
                    {asset.type === AssetType.VIDEO_SEGMENT && (
                        <Button
                          isIconOnly
                          color="primary"
                          variant="shadow"
                          size="sm"
                          onPress={(e) => handleRequestEdit(e, asset)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                    )}

                    <Button
                      isIconOnly
                      color="danger"
                      variant="shadow"
                      size="sm"
                      onPress={(e) => onRequestDelete(e, asset.id, asset.filePath)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
              </CardBody>
              <CardFooter className="flex-1 flex flex-col justify-start items-start p-4 gap-3 overflow-hidden">
                <h3 className="font-bold text-[18px] truncate w-full text-slate-800 dark:text-slate-100" title={asset.name}>
                  {asset.name}
                </h3>
                <p className="text-[12px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest truncate w-full mt-1">
                  {asset.type === AssetType.CHARACTER ? (
                    (() => {
                        const char = asset as CharacterAsset;
                        const genderText = char.gender ? t.character.genderOptions[char.gender] : '-';
                        const ageText = char.ageGroup ? t.character.ageOptions[char.ageGroup] : '-';
                        return `${genderText} • ${ageText}`;
                    })()
                  ) : asset.type === AssetType.VIDEO_SEGMENT ? (
                      new Date(asset.createdAt).toLocaleString()
                  ) : (
                    asset.prompt || t.project.noPrompt
                  )}
                </p>
              </CardFooter>
            </Card>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* DELETE CONFIRMATION MODAL */}
    <Modal 
      isOpen={isDeleteOpen} 
      onOpenChange={onDeleteOpenChange}
      placement="center"
      backdrop="blur"
      size="sm"
      classNames={{
        base: "border border-slate-200 dark:border-slate-800 rounded-[2.5rem]",
        header: "border-b-0",
        footer: "border-t-0 px-6 pb-6"
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 items-center pt-8">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-2">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                {t.project.deleteConfirmTitle}
              </h3>
            </ModalHeader>
            <ModalBody className="text-center px-8 pb-4">
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                {t.project.confirmDelete}
              </p>
            </ModalBody>
            <ModalFooter className="flex gap-3">
              <Button 
                variant="light" 
                onPress={onClose}
                className="flex-1 font-bold text-slate-500 h-12 rounded-2xl"
              >
                {t.dashboard.cancel}
              </Button>
              <Button 
                color="danger" 
                variant="shadow"
                onPress={() => {
                  confirmDelete();
                  onClose();
                }}
                className="flex-1 font-bold h-12 rounded-2xl"
              >
                {t.project.deleteConfirmAction}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
    {/* EDIT MODAL */}
    <Modal
        isOpen={isEditOpen}
        onOpenChange={onEditOpenChange}
        placement="center"
        backdrop="blur"
    >
        <ModalContent>
            {(onClose) => (
                <>
                    <ModalHeader className="flex flex-col gap-1">
                        {t.project.edit}
                    </ModalHeader>
                    <ModalBody>
                        <Input
                            label={t.project.nameLabel}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            variant="bordered"
                            autoFocus
                        />
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onClose}>
                            {t.common.cancel}
                        </Button>
                        <Button color="primary" onPress={confirmEdit}>
                            {t.common.confirm}
                        </Button>
                    </ModalFooter>
                </>
            )}
        </ModalContent>
    </Modal>
    </>
  );
};

export default AssetList;
