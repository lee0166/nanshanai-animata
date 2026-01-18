
import React, { useEffect, useState, useMemo } from 'react';
import { 
    Modal, 
    ModalContent, 
    ModalHeader, 
    ModalBody, 
    ModalFooter, 
    Button, 
    Card, 
    CardBody,
    Image, 
    Spinner,
    Tabs,
    Tab,
    Skeleton
} from "@heroui/react";
import { storageService, ResourceItem } from '../services/storage';
import { isVideoFile, VIDEO_EXTENSIONS, IMAGE_EXTENSIONS } from '../services/fileUtils';
import { Asset, AssetType, CharacterAsset } from '../types';
import { useApp } from '../contexts/context';
import { useToast } from '../contexts/ToastContext';
import { Upload, Check, Image as ImageIcon, Filter, FileImage, FileVideo, Film, Eye, AlertTriangle } from 'lucide-react';
import { usePreview } from './PreviewProvider';

interface ResourcePickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (selectedPaths: string[]) => void;
    maxSelect?: number;
    projectId: string;
    accept?: string;
}

type ModalityFilter = 'all' | 'image' | 'video';
type SourceFilter = 'all' | 'generated' | 'imported';

const ResourcePicker: React.FC<ResourcePickerProps> = ({ isOpen, onClose, onSelect, maxSelect = 1, projectId, accept }) => {
    const { t } = useApp();
    const { showToast } = useToast();
    const { openPreview } = usePreview();
    const [resources, setResources] = useState<ResourceItem[]>([]);
    const [urls, setUrls] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    const [modalityFilter, setModalityFilter] = useState<ModalityFilter>('all');
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

    const isImageOnly = accept?.startsWith('image/');
    const isVideoOnly = accept?.startsWith('video/');

    useEffect(() => {
        if (isOpen) {
            loadResources();
            setSelectedIds(new Set());
            
            // Set initial modality filter based on accept prop
            if (isImageOnly) {
                setModalityFilter('image');
            } else if (isVideoOnly) {
                setModalityFilter('video');
            } else {
                setModalityFilter('all');
            }
        }
    }, [isOpen, projectId, accept, isImageOnly, isVideoOnly]);

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
                        newUrls[res.id] = await storageService.getAssetUrl(res.path);
                    }
                }
            }
            setUrls(newUrls);
        } catch (error) {
            console.error("Failed to load resources:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        setLoading(true);
        try {
            await storageService.importResource(projectId);
            await loadResources();
        } catch (error) {
            console.error("Import failed:", error);
        } finally {
            setLoading(false);
        }
    };

    const displayAssets = useMemo(() => {
        return resources.filter(res => {
            if (modalityFilter !== 'all' && res.type !== modalityFilter) return false;
            if (sourceFilter !== 'all' && res.source !== sourceFilter) return false;
            return true;
        });
    }, [resources, modalityFilter, sourceFilter]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            if (maxSelect === 1) {
                newSet.clear();
                newSet.add(id);
            } else {
                if (newSet.size < maxSelect) {
                    newSet.add(id);
                }
            }
        }
        setSelectedIds(newSet);
    };

    const handleConfirm = () => {
        const selectedResources = resources.filter(r => selectedIds.has(r.id));
        const paths = selectedResources.map(r => r.path || '').filter(p => p);
        onSelect(paths);
        onClose();
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose}
            size="5xl"
            scrollBehavior="inside"
            backdrop="blur"
            classNames={{
                base: "max-h-[90vh] border border-slate-200 dark:border-slate-800 rounded-[2.5rem]",
                header: "border-b border-slate-100 dark:border-slate-800 p-6",
                body: "p-6",
                footer: "border-t border-slate-100 dark:border-slate-800 p-6"
            }}
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-black uppercase tracking-tight">{t.character.selectReference}</h2>
                        <Button
                            color="primary"
                            variant="shadow"
                            radius="lg"
                            size="sm"
                            startContent={<Upload className="w-4 h-4" />}
                            className="font-bold cursor-pointer h-10 px-6"
                            onPress={handleImport}
                        >
                            {t.project.importFile}
                        </Button>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                        {!isImageOnly && !isVideoOnly && (
                            <Tabs 
                                selectedKey={modalityFilter} 
                                onSelectionChange={(key) => setModalityFilter(key as ModalityFilter)}
                                variant="light"
                                color="primary"
                                size="sm"
                                aria-label={t.project.filterByModality}
                                classNames={{
                                    tabList: "bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800",
                                    cursor: "rounded-lg shadow-sm",
                                    tab: "h-8",
                                    tabContent: "font-bold text-[10px] uppercase tracking-widest"
                                }}
                            >
                                <Tab key="all" title={<div className="flex items-center gap-2"><Filter className="w-3 h-3" /><span>{t.project.filterAll}</span></div>} />
                                <Tab key="image" title={<div className="flex items-center gap-2"><FileImage className="w-3 h-3" /><span>{t.project.filterImages}</span></div>} />
                                <Tab key="video" title={<div className="flex items-center gap-2"><FileVideo className="w-3 h-3" /><span>{t.project.filterVideos}</span></div>} />
                            </Tabs>
                        )}

                        <Tabs 
                            selectedKey={sourceFilter} 
                            onSelectionChange={(key) => setSourceFilter(key as SourceFilter)}
                            variant="light"
                            color="secondary"
                            size="sm"
                            aria-label={t.project.filterBySource}
                            classNames={{
                                tabList: "bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800",
                                cursor: "rounded-lg shadow-sm",
                                tab: "h-8",
                                tabContent: "font-bold text-[10px] uppercase tracking-widest"
                            }}
                        >
                            <Tab key="all" title={<div className="flex items-center gap-2"><Filter className="w-3 h-3" /><span>{t.project.filterAll}</span></div>} />
                            <Tab key="generated" title={t.project.filterGenerated} />
                            <Tab key="imported" title={t.project.filterImported} />
                        </Tabs>
                    </div>
                </ModalHeader>
                <ModalBody>
                    {loading && resources.length === 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {[1,2,3,4,5,6,7,8,9,10].map(i => (
                                <Skeleton key={i} className="rounded-2xl aspect-square" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {displayAssets.map(res => (
                                <div 
                                    key={res.id} 
                                    className="relative aspect-square group cursor-pointer" 
                                    onClick={() => toggleSelection(res.id)}
                                >
                                    <Card 
                                        className={`w-full h-full border-2 transition-all duration-300 ${
                                            selectedIds.has(res.id) 
                                            ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' 
                                            : 'border-transparent dark:bg-slate-900'
                                        }`}
                                        radius="lg"
                                        shadow="sm"
                                    >
                                        <CardBody className="p-0 flex items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-950 relative">
                                            {urls[res.id] ? (
                                                res.type === 'video' ?
                                                <video src={urls[res.id]} className="w-full h-full object-contain pointer-events-none" /> :
                                                <img src={urls[res.id]} alt={res.sourceAssetName || ''} className="w-full h-full object-contain" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-800 gap-1">
                                                    <AlertTriangle className="w-6 h-6 text-warning opacity-50" />
                                                    <span className="text-[8px] font-black uppercase tracking-widest opacity-50">{t.project.missing}</span>
                                                </div>
                                            )}
                                            
                                            {/* Type Badge */}
                                            <div className="absolute top-2 left-2 z-10">
                                                {res.type === 'video' ?
                                                    <div className="bg-black/50 text-white p-1 rounded-full backdrop-blur-sm"><Film className="w-3 h-3" /></div> :
                                                    <div className="bg-black/50 text-white p-1 rounded-full backdrop-blur-sm"><ImageIcon className="w-3 h-3" /></div>
                                                }
                                            </div>
                                        </CardBody>
                                    </Card>
                                    
                                    {selectedIds.has(res.id) && (
                                        <div className="absolute top-2 right-2 z-20 bg-indigo-600 text-white rounded-full p-1.5 shadow-lg scale-110 animate-in zoom-in-50 duration-200">
                                            <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                        </div>
                                    )}
                                    
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none">
                                        <p className="text-[8px] text-white font-black uppercase truncate w-full tracking-tighter">
                                            {res.sourceAssetName || (res.path ? res.path.split('/').pop() : 'Unknown')}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {displayAssets.length === 0 && !loading && (
                                <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400">
                                    <ImageIcon className="w-12 h-12 opacity-20 mb-4" />
                                    <p className="font-black uppercase tracking-[0.2em] text-xs">{t.project.noResources}</p>
                                </div>
                            )}
                        </div>
                    )}
                </ModalBody>
                <ModalFooter className="flex justify-between items-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {selectedIds.size > 0 ? `${t.project.selected}: ${selectedIds.size} / ${maxSelect}` : t.project.selectResource}
                    </p>
                    <div className="flex gap-3">
                        <Button variant="light" onPress={onClose} className="font-bold text-slate-500 rounded-xl">
                            {t.dashboard.cancel}
                        </Button>
                        <Button 
                            color="primary" 
                            variant="shadow"
                            onPress={handleConfirm} 
                            isDisabled={selectedIds.size === 0}
                            className="font-black uppercase tracking-widest text-xs px-8 rounded-xl"
                        >
                            {t.project.confirmSelection}
                        </Button>
                    </div>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default ResourcePicker;
