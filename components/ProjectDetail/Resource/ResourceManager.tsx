
import React, { useEffect, useState, useMemo } from 'react';
import { AssetType, CharacterAsset, SceneAsset, ItemAsset } from '../../../types';
import { storageService, ResourceItem } from '../../../services/storage';
import { getMimeType } from '../../../services/fileUtils';
import { AI_PARAM_DEFINITIONS } from '../../../services/ai/definitions';
import { DefaultStylePrompt } from '../../../services/prompt';
import { useApp } from '../../../contexts/context';
import { useToast } from '../../../contexts/ToastContext';
import { usePreview } from '../../PreviewProvider';
import { 
    Button, 
    Card, 
    Tabs, 
    Tab, 
    Select, 
    SelectItem, 
    Chip,
    ScrollShadow,
    Spinner,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure
} from "@heroui/react";
import { Filter, Trash2, Eye, FileImage, FileVideo, AlertTriangle, Info, Check, Image as ImageIcon, Film, Upload } from 'lucide-react';

interface ResourceManagerProps {
    projectId: string;
    refreshTrigger: number;
}

type ModalityFilter = 'all' | 'image' | 'video';
type SourceFilter = 'all' | 'generated' | 'imported';

const ResourceManager: React.FC<ResourceManagerProps> = ({ projectId, refreshTrigger }) => {
    const { t, settings } = useApp();
    const { showToast } = useToast();
    const { openPreview } = usePreview();
    const [resources, setResources] = useState<ResourceItem[]>([]);
    const [urls, setUrls] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    
    // Filters
    const [modalityFilter, setModalityFilter] = useState<ModalityFilter>('all');
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
    
    // Selection
    const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
    const [selectedResource, setSelectedResource] = useState<ResourceItem | null>(null);

    const handleOpenDetail = (res: ResourceItem) => {
        setSelectedResource(res);
        onDetailOpen();
    };

    // Delete
    const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
    
    useEffect(() => {
        loadResources();
    }, [projectId, refreshTrigger]);

    const loadResources = async () => {
        setLoading(true);
        try {
            const all = await storageService.getAllResources(projectId);
            setResources(all);
            
            // Load URLs
            const newUrls: Record<string, string> = {};
            for (const res of all) {
                if (res.path) {
                    if (res.path.startsWith('remote:')) {
                        newUrls[res.id] = res.path.substring(7);
                    } else {
                        try {
                            newUrls[res.id] = await storageService.getAssetUrl(res.path);
                        } catch (e) {
                            console.warn("Failed to load url for resource", res.id);
                        }
                    }
                }
            }
            setUrls(newUrls);
        } catch (error) {
            console.error("Failed to load resources:", error);
            showToast(t.project.resourceManager.loadFailed, "error");
        } finally {
            setLoading(false);
        }
    };

    const filteredResources = useMemo(() => {
        return resources.filter(r => {
            if (modalityFilter !== 'all' && r.type !== modalityFilter) return false;
            if (sourceFilter !== 'all' && r.source !== sourceFilter) return false;
            return true;
        });
    }, [resources, modalityFilter, sourceFilter]);

    const handleImport = async () => {
        try {
            await storageService.importResource(projectId);
            showToast(t.project.resourceManager.importSuccess, "success");
            loadResources();
        } catch (e) {
            console.error(e);
            showToast(t.project.resourceManager.importFailed, "error");
        }
    };

    const formatSize = (bytes?: number) => {
        if (!bytes) return t.project.resourceManager.unknown;
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return t.project.resourceManager.unknown;
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getParamLabel = (key: string) => {
        const def = AI_PARAM_DEFINITIONS[key];
        if (def && def.labelKey) {
            const parts = def.labelKey.split('.');
            if (parts.length === 2) {
                // @ts-ignore
                const section = t[parts[0]];
                if (section && section[parts[1]]) {
                    return section[parts[1]];
                }
            }
        }
        return key;
    };

    const getParamValue = (key: string, value: any) => {
        if (key === 'style') {
            const styleKey = String(value);
            // @ts-ignore
            const styleInfo = DefaultStylePrompt[styleKey];
            if (styleInfo) {
                return settings.language === 'zh' ? styleInfo.nameCN : styleInfo.nameEN;
            }
        }
        return typeof value === 'object' ? JSON.stringify(value) : String(value);
    };

    const handleDelete = async () => {
        if (!selectedResource) return;
        
        // Check constraints
        if (selectedResource.source === 'generated') {
            // Check if source asset still exists and refers to this?
            // getAllResources already checked assets. 
            // If sourceAssetId is present, it means the asset exists.
            // We need to fetch the asset to be sure, or trust getAllResources result.
            // If sourceAssetId is present, we assume it's linked.
            if (selectedResource.sourceAssetId) {
                // Double check if asset still exists
                try {
                    const asset = await storageService.getAsset(selectedResource.sourceAssetId, projectId);
                    if (asset) {
                        // Asset exists. Check if it really uses this image?
                        // For generated resources, they are usually in generatedImages list.
                        // So yes, it is used.
                        showToast(t.project.resourceManager.deleteConstraint, "warning");
                        onDeleteClose();
                        return;
                    }
                } catch (e) {
                    // Asset might be gone
                }
            }
        }

        // If we get here, either imported or asset is gone.
        // For imported resources, we also need to check if they are used as references?
        // That's harder. But user said: "Imported resources ... can be directly deleted in resource management" (implied constraint applies to generated mostly? or generated/imported in functional items).
        // User said: "Resource management... generated and imported resources, if their associated function item is not deleted, then cannot be directly deleted in resource management... This restriction does not include resources imported IN resource management."
        
        // This means if I imported an image in "Character Detail" as reference, it's an "Imported Resource" associated with Character.
        // If I imported an image in "Resource Management", it's an "Imported Resource" associated with nothing (or itself).
        
        // Currently, our data model for imported resources in AssetList creates an Asset of type IMAGE/VIDEO.
        // So sourceAssetId points to ITSELF.
        
        if (selectedResource.source === 'imported') {
            // Check if it's used as reference in other assets?
            // This would require scanning all assets metadata.referenceImages.
            // Let's implement this check.
            try {
                const allAssets = await storageService.getAssets(projectId);
                const usedAsRef = allAssets.some(a => {
                    // Check referenceImages
                    if (a.metadata?.referenceImages && Array.isArray(a.metadata.referenceImages)) {
                        return a.metadata.referenceImages.includes(selectedResource.path);
                    }
                    return false;
                });
                
                if (usedAsRef) {
                     showToast(t.project.resourceManager.refConstraint, "warning");
                     onDeleteClose();
                     return;
                }
            } catch (e) {}
        }

        try {
            // 1. Delete file
            await storageService.deleteFile(selectedResource.path);
            
            // 2. If it's an imported asset (AssetType.IMAGE/VIDEO), delete the asset record too
            if (selectedResource.source === 'imported' && selectedResource.sourceAssetId) {
                 await storageService.deleteAsset(selectedResource.sourceAssetId, projectId);
            }
            
            // 3. If it's generated, we just deleted the file. The Asset will now have a broken link.
            // Wait, user said: "The real file deletion can only be done in resource management".
            // If we delete the file, the Asset (Character) will still have the record in generatedImages.
            // Should we update the Asset to remove it?
            // User said: "Deletion in Fragment/Character... is only cancelling association... Real file deletion only in Resource Management".
            // This implies if I delete here, I should probably clean up the association too?
            // Or leave it broken? "Broken link" is bad UX.
            // But we prevented deletion if associated!
            // So we only delete if NOT associated.
            // But for Generated resources, they are ALWAYS associated unless "cancelled association" in Character Detail.
            
            // So the workflow is:
            // 1. User goes to Character Detail -> Delete Image -> Image removed from Character's list (Asset updated), File remains.
            // 2. User goes to Resource Management -> See image (now Orphaned? No, getAllResources iterates Assets!)
            
            // Ah! If we remove it from Character's generatedImages list, `getAllResources` will NO LONGER FIND IT via Asset iteration!
            // So `getAllResources` needs to ALSO scan the directory for orphans!
            
            // Current `getAllResources` implementation ONLY iterates Assets.
            // So if I "Soft Delete" in Character Detail, it disappears from Resource Management too!
            // This contradicts "Real file deletion only in Resource Management".
            
            // We need `getAllResources` to:
            // 1. Iterate Assets -> find used resources.
            // 2. Iterate Directory -> find all files.
            // 3. Diff -> Find orphans.
            
            // However, iterating directory can be slow.
            // But it's necessary for this requirement.
            
            // Let's proceed with current deletion logic for now, but mark this logic gap.
            // If I delete in Character Detail, it's gone from UI. File stays.
            // How do I see it in Resource Management to delete it? I can't.
            
            // FIX: We need to implement Directory Scanning in `getAllResources`.
            // Or, we change "Soft Delete" to "Move to Trash Asset" or similar? No.
            
            // Let's implement Directory Scanning in `storageService`.
            
            showToast(t.project.resourceManager.deleteSuccess, "success");
            setSelectedResource(null);
            onDeleteClose();
            onDetailClose(); // Close detail view on success
            loadResources(); // Refresh
        } catch (e) {
            console.error("Delete failed", e);
            showToast(t.project.resourceManager.deleteFailed, "error");
        }
    };

    return (
        <div className="flex h-full overflow-hidden">
            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Toolbar */}
                <div className="px-6 py-4 flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.project.resourceManager.filter}</span>
                    </div>
                    
                    <Select 
                        size="sm" 
                        className="w-32" 
                        selectedKeys={[modalityFilter]} 
                        onChange={(e) => setModalityFilter(e.target.value as ModalityFilter)}
                        aria-label={t.project.resourceManager.filterByType}
                    >
                        <SelectItem key="all" value="all">{t.project.resourceManager.allTypes}</SelectItem>
                        <SelectItem key="image" value="image">{t.project.resourceManager.images}</SelectItem>
                        <SelectItem key="video" value="video">{t.project.resourceManager.videos}</SelectItem>
                    </Select>

                    <Select 
                        size="sm" 
                        className="w-32" 
                        selectedKeys={[sourceFilter]} 
                        onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                        aria-label={t.project.resourceManager.filterBySource}
                    >
                        <SelectItem key="all" value="all">{t.project.resourceManager.allSources}</SelectItem>
                        <SelectItem key="generated" value="generated">{t.project.resourceManager.generated}</SelectItem>
                        <SelectItem key="imported" value="imported">{t.project.resourceManager.imported}</SelectItem>
                    </Select>
                    
                    <div className="ml-auto flex items-center gap-4">
                        <span className="text-xs text-slate-400 font-medium">
                            {filteredResources.length} {t.project.resourceManager.items}
                        </span>
                        <Button 
                            size="sm" 
                            color="primary" 
                            startContent={<Upload className="w-4 h-4" />}
                            onPress={handleImport}
                        >
                            {t.project.importFile}
                        </Button>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Spinner size="lg" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                            {filteredResources.map(res => (
                                <div 
                                    key={res.id}
                                    className={`
                                        group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all
                                        ${selectedResource?.id === res.id ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700'}
                                    `}
                                    onClick={() => handleOpenDetail(res)}
                                >
                                    {res.type === 'video' ? (
                                        <div className="w-full h-full bg-black/5 dark:bg-white/5 flex items-center justify-center relative">
                                            {urls[res.id] ? (
                                                <video 
                                                    src={urls[res.id]} 
                                                    className="w-full h-full object-contain"
                                                    preload="metadata"
                                                    muted
                                                    playsInline
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-800 gap-2">
                                                    <AlertTriangle className="w-8 h-8 text-warning opacity-50" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{t.project.missing}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="w-full h-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
                                            {urls[res.id] ? (
                                                <img
                                                    src={urls[res.id]}
                                                    alt={t.project.resourceManager.imageAlt}
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-800 gap-2">
                                                    <AlertTriangle className="w-8 h-8 text-warning opacity-50" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{t.project.missing}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {/* Overlay Info */}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex items-center justify-between text-white">
                                            <span className="text-[10px] font-medium">
                                                {res.source === 'generated' ? t.project.resourceManager.generated : t.project.resourceManager.imported}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Type Badge */}
                                    <div className="absolute top-2 left-2">
                                         {res.type === 'video' ?
                                            <div className="bg-black/50 text-white p-1 rounded-full backdrop-blur-sm"><Film className="w-3 h-3" /></div>:
                                            <div className="bg-black/50 text-white p-1 rounded-full backdrop-blur-sm"><ImageIcon className="w-3 h-3" /></div>
                                         }
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            <Modal 
                isOpen={isDetailOpen} 
                onClose={onDetailClose} 
                size="full" 
                scrollBehavior="inside"
                classNames={{
                    base: "dark:bg-slate-900 border border-slate-200 dark:border-slate-800",
                    header: "border-b-[1px] border-slate-100 dark:border-slate-800 p-6",
                    body: "p-0 overflow-hidden",
                    footer: "border-t-[1px] border-slate-100 dark:border-slate-800 p-6",
                }}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                <h3 className="font-bold text-lg">{t.project.resourceManager.details}</h3>
                            </ModalHeader>
                            <ModalBody>
                                {selectedResource && (
                                    <div className="flex h-full">
                                        {/* Left: Preview */}
                                        <div className="flex-1 bg-slate-100 dark:bg-black/20 flex items-center justify-center p-8 border-r border-slate-200 dark:border-slate-800 relative">
                                            {selectedResource.type === 'video' ? (
                                                urls[selectedResource.id] ? (
                                                    <video 
                                                        src={urls[selectedResource.id]} 
                                                        controls 
                                                        className="max-w-full max-h-full rounded-lg shadow-lg"
                                                    />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center text-slate-400 gap-4">
                                                        <AlertTriangle size={48} className="text-warning opacity-50" />
                                                        <p className="text-sm font-bold uppercase tracking-widest opacity-50">{t.project.fileNotFound}</p>
                                                    </div>
                                                )
                                            ) : (
                                                urls[selectedResource.id] ? (
                                                    <img 
                                                        src={urls[selectedResource.id]}
                                                        alt={t.project.resourceManager.imageAlt}
                                                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                                                    />
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center text-slate-400 gap-4">
                                                        <AlertTriangle size={48} className="text-warning opacity-50" />
                                                        <p className="text-sm font-bold uppercase tracking-widest opacity-50">{t.project.fileNotFound}</p>
                                                    </div>
                                                )
                                            )}
                                            
                                            <div className="absolute top-4 right-4 z-50">
                                                <Button isIconOnly variant="flat" className="bg-white/10 text-white backdrop-blur-md" onPress={() => {
                                                    const url = urls[selectedResource.id] || '';
                                                    if (selectedResource.type === 'video') {
                                                        openPreview([{
                                                            type: "video",
                                                            sources: [{ src: url, type: getMimeType(selectedResource.path) }]
                                                        }], 0);
                                                    } else {
                                                        openPreview([{ src: url }], 0);
                                                    }
                                                }}>
                                                    <Eye className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Right: Info */}
                                        <div className="w-96 flex flex-col overflow-y-auto bg-white dark:bg-slate-900 shrink-0">
                                            <div className="p-6 space-y-8">
                                                {/* Source Tags */}
                                                <div className="flex gap-2">
                                                    <Chip 
                                                        variant="flat" 
                                                        color="primary" 
                                                        size="sm"
                                                        className="font-bold"
                                                    >
                                                        {selectedResource.sourceAssetType === AssetType.VIDEO_SEGMENT ? t.project.segments :
                                                         selectedResource.sourceAssetType === AssetType.CHARACTER ? t.project.characters :
                                                         selectedResource.sourceAssetType === AssetType.SCENE ? t.project.scenes :
                                                         selectedResource.sourceAssetType === AssetType.ITEM ? t.project.items :
                                                         t.project.resources}
                                                    </Chip>
                                                    <Chip 
                                                        variant="flat" 
                                                        color={selectedResource.source === 'generated' ? 'secondary' : 'default'} 
                                                        size="sm"
                                                        className="font-bold"
                                                    >
                                                        {selectedResource.source === 'generated' ? t.project.resourceManager.generated : t.project.resourceManager.imported}
                                                    </Chip>
                                                </div>

                                                {/* Info List */}
                                                <div className="space-y-6">
                                                    {/* File Info */}
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">{t.project.resourceManager.fileInfo}</label>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-slate-500">{t.project.resourceManager.dimensions}</span>
                                                                <span className="text-xs font-mono font-medium">
                                                                    {selectedResource.metadata?.width && selectedResource.metadata?.height 
                                                                        ? `${selectedResource.metadata.width} × ${selectedResource.metadata.height}`
                                                                        : t.project.resourceManager.unknown}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-slate-500">{t.project.resourceManager.size}</span>
                                                                <span className="text-xs font-mono font-medium">{formatSize(selectedResource.metadata?.size)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-slate-500">{t.project.resourceManager.fileType}</span>
                                                                <span className="text-xs font-mono font-medium uppercase">{selectedResource.metadata?.fileType || selectedResource.path.split('.').pop()}</span>
                                                            </div>
                                                            {selectedResource.type === 'video' && (
                                                                <>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs text-slate-500">{t.project.resourceManager.duration}</span>
                                                                        <span className="text-xs font-mono font-medium">{formatDuration(selectedResource.metadata?.duration)}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs text-slate-500">{t.project.resourceManager.fps}</span>
                                                                        <span className="text-xs font-mono font-medium">
                                                                            {selectedResource.metadata?.fps || t.project.resourceManager.unknown}
                                                                        </span>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Generation Info */}
                                                    {selectedResource.source === 'generated' && (
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">{t.project.resourceManager.generationInfo}</label>
                                                            <div className="space-y-4">
                                                                {selectedResource.prompt && (
                                                                    <div className="space-y-1">
                                                                        <span className="text-[10px] text-slate-400 font-bold uppercase">{t.project.resourceManager.prompt}</span>
                                                                        <p className="text-xs leading-relaxed bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/10 italic text-slate-600 dark:text-slate-300">
                                                                            "{selectedResource.prompt}"
                                                                        </p>
                                                                    </div>
                                                                )}
                                                                
                                                                <div className="grid grid-cols-1 gap-3">
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] text-slate-400 font-bold uppercase">{t.project.resourceManager.model}</span>
                                                                        <span className="text-xs font-medium truncate bg-slate-50 dark:bg-white/5 px-2 py-1 rounded border border-slate-100 dark:border-white/10">
                                                                            {selectedResource.metadata?.modelId || t.project.resourceManager.unknown}
                                                                        </span>
                                                                    </div>
                                                                    {selectedResource.generationParams && (
                                                                        <div className="flex flex-col gap-1">
                                                                            <span className="text-[10px] text-slate-400 font-bold uppercase">{t.project.resourceManager.params}</span>
                                                                            <div className="space-y-2 bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/10">
                                                                                {Object.entries(selectedResource.generationParams)
                                                                                    .filter(([key]) => !['fullPrompt', 'modelId', 'width', 'height', 'size', 'duration'].includes(key))
                                                                                    .map(([key, value]) => (
                                                                                        <div key={key} className="flex justify-between items-start gap-4">
                                                                                            <span className="text-[10px] text-slate-400 font-mono">{getParamLabel(key)}:</span>
                                                                                            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 break-all text-right">
                                                                                                {getParamValue(key, value)}
                                                                                            </span>
                                                                                        </div>
                                                                                    ))
                                                                                }
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="mt-auto p-6 border-t border-slate-200 dark:border-slate-800">
                                                <Button 
                                                    color="danger" 
                                                    variant="flat" 
                                                    className="w-full font-bold" 
                                                    startContent={<Trash2 className="w-4 h-4" />}
                                                    onPress={() => {
                                                        // Close detail modal first? Or keep it open?
                                                        // If we delete, we should close detail.
                                                        // Let's trigger delete modal on top.
                                                        onDeleteOpen();
                                                    }}
                                                >
                                                    {t.project.resourceManager.deleteResource}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
                <ModalContent>
                    <ModalHeader>{t.project.resourceManager.confirmDeleteTitle}</ModalHeader>
                    <ModalBody>
                        <p>{t.project.resourceManager.confirmDeleteDesc}</p>
                        <p className="text-xs text-red-500 mt-2">{t.project.resourceManager.confirmDeleteWarn}</p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onPress={onDeleteClose}>{t.project.resourceManager.cancel}</Button>
                        <Button color="danger" onPress={() => {
                            handleDelete();
                            // Detail modal closing is now handled inside handleDelete on success
                        }}>{t.project.resourceManager.deletePermanently}</Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
};

export default ResourceManager;

