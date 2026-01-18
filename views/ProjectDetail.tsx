import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Project, AssetType, Job, JobStatus, Asset, CharacterAsset, GeneratedImage, FragmentAsset, ItemType } from '../types';
import { storageService } from '../services/storage';
import { jobQueue } from '../services/queue';
import { useApp } from '../contexts/context';
import AssetList from '../components/AssetList';
import DetailView from '../components/ProjectDetail/DetailView';
import ResourceManager from '../components/ProjectDetail/Resource/ResourceManager';
import CharacterSidebar from '../components/ProjectDetail/CharacterSidebar';
import FragmentSidebar from '../components/ProjectDetail/FragmentSidebar';
import SceneSidebar from '@/components/ProjectDetail/SceneSidebar';
import ItemSidebar from '@/components/ProjectDetail/ItemSidebar';
import { GenerationParams } from '../components/ProjectDetail/GenerationForm';
import { Sparkles, Send, ChevronLeft, ArrowRight, Play, X, Plus } from 'lucide-react';
import { 
  Button, 
  Input, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  useDisclosure,
  Spinner
} from "@heroui/react";

import { useToast } from '../contexts/ToastContext';

import FragmentDetail from '../components/ProjectDetail/Fragment/FragmentDetail';

interface ProjectDetailProps {
  activeTab: AssetType;
  setActiveTab: (tab: AssetType) => void;
  onProjectLoaded?: (project: Project | null) => void;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ activeTab, setActiveTab, onProjectLoaded }) => {
  const { id } = useParams<{ id: string }>();
  const { settings, t } = useApp();
  const { showToast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // UI State
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [highlightedAssetId, setHighlightedAssetId] = useState<string>('');
  const [itemTypeFilter, setItemTypeFilter] = useState<string>('all');
  const { isOpen: isAddOpen, onOpen: onAddOpen, onClose: onAddClose } = useDisclosure();
  
  // Creation/Edit State
  const [assetName, setAssetName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadProject();
  }, [id]);

  useEffect(() => {
    if (onProjectLoaded && project) {
        onProjectLoaded(project);
    }
  }, [project, onProjectLoaded]);

  useEffect(() => {
    const type = activeTab === AssetType.VIDEO_SEGMENT ? 'video' : 'image';
    const models = settings.models.filter(m => m.type === type);
    if (models.length > 0) {
        setSelectedModelId(models[0].id);
    } else {
        setSelectedModelId('');
    }
    setSelectedAsset(null);
    setItemTypeFilter('all');
  }, [activeTab, settings.models]);

  useEffect(() => {
    if (selectedAsset) {
        setPrompt(selectedAsset.prompt || '');
        
        // Sync model ID if available in metadata
        const savedModelId = selectedAsset.metadata?.modelConfigId || selectedAsset.metadata?.modelId;
        if (savedModelId) {
            // Check if it's a valid ID in our current settings
            if (settings.models.some(m => m.id === savedModelId)) {
                setSelectedModelId(savedModelId);
            } else {
                // Try to find by modelId (API string) for legacy support
                const matched = settings.models.find(m => m.modelId === savedModelId);
                if (matched) {
                    setSelectedModelId(matched.id);
                }
            }
        }

        // NEW: Check for active jobs for this asset
        const checkActiveJob = async () => {
             const jobs = await storageService.getJobs();
             const activeJob = jobs.find(j => 
                 j.params.assetId === selectedAsset.id && 
                 (j.status === JobStatus.PENDING || j.status === JobStatus.PROCESSING)
             );
             if (activeJob) {
                 console.log(`[ProjectDetail] Found active job for asset ${selectedAsset.id}`);
                 setGenerating(true);
             } else {
                 setGenerating(false);
             }
        };
        checkActiveJob();
    }
  }, [selectedAsset, settings.models]);

  useEffect(() => {
    const unsub = jobQueue.subscribe((job) => {
        if (job.projectId !== id) return;

        console.log(`[ProjectDetail] Job update: ${job.id} Status: ${job.status}`);

        if (job.status === JobStatus.COMPLETED) {
            handleJobComplete(job);
        } else if (job.status === JobStatus.FAILED) {
            setGenerating(false);
            showToast(`${t.errors.generationFailed}: ${job.error || t.errors.unknownError}`, 'error');
            console.error(`[ProjectDetail] Job failed:`, job.error);
        }
    });
    return () => unsub();
  }, [id]);

  const loadProject = async () => {
    if (!id) return;
    const projects = await storageService.getProjects();
    const p = projects.find(proj => proj.id === id);
    setProject(p || null);
  };

  const handleJobComplete = async (job: Job) => {
    // We don't need to update asset here because queue.ts handles it.
    // Just refresh the view and show toast.
    
    // If the currently selected asset is the one that was updated, we might want to reload it?
    // But setRefreshTrigger should handle the list. 
    // DetailView might need a way to know.
    // Actually, DetailView (CharacterDetail) subscribes to queue itself and handles reload.
    
    // So here we primarily handle the global list refresh.
    if (job.projectId === id) {
        setRefreshTrigger(prev => prev + 1);
    }

    // Check if we need to update the currently selected asset (for fallback views)
    // The specialized views (Character, Scene, Item, Fragment) handle this themselves via internal subscriptions
    // to avoid race conditions and duplicate updates.
    const specializedTypes = [AssetType.CHARACTER, AssetType.SCENE, AssetType.ITEM, AssetType.VIDEO_SEGMENT];
    
    if (selectedAsset && job.params.assetId === selectedAsset.id) {
         if (!specializedTypes.includes(selectedAsset.type)) {
             // This is a fallback view asset (e.g. IMAGE, VIDEO)
             // We need to atomic update and refresh it to prevent overwrite issues
             try {
                await storageService.updateAsset(selectedAsset.id, id, async (current) => {
                    return current; // Queue already added the file, just need to ensure we have latest version to return
                });
                const latest = await storageService.getAsset(selectedAsset.id, id);
                if (latest) {
                    setSelectedAsset(latest);
                    showToast(t.project.generationSuccess, 'success');
                }
             } catch (e) {
                 console.error("Failed to update asset in fallback view:", e);
             }
         }
    }

    setGenerating(false);
    // showToast(t.project.generationSuccess, 'success'); // Handled by Detail components to avoid duplicates
  };

  const handleCreateEmptyAsset = async () => {
    if (!id || !assetName) return;

    const newAsset: Asset = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
      projectId: id,
      type: activeTab,
      name: assetName,
      prompt: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // If we are creating an item and a specific filter is selected, apply it
    if (activeTab === AssetType.ITEM) {
        if (itemTypeFilter !== 'all') {
            (newAsset as any).itemType = itemTypeFilter;
        } else {
            (newAsset as any).itemType = ItemType.PROP;
        }
    }

    await storageService.saveAsset(newAsset);
    setAssetName('');
    onAddClose();
    setRefreshTrigger(prev => prev + 1);
    setSelectedAsset(newAsset);
    // Use specific type name if available
    const typeName = t.project[activeTab as keyof typeof t.project] || t.project.asset;
    showToast(`${t.project.create} ${typeName}`, 'success');
  };

  const handleGenerate = async (genParams: GenerationParams) => {
    if (!id || !selectedAsset) return;

    console.log(`[ProjectDetail] Starting generation for asset: ${selectedAsset.id}`, genParams);

    const model = settings.models.find(m => m.id === selectedModelId);
    if (!model) {
        showToast(t.settings?.noApiKey || t.errors.unknownError, 'error');
        return;
    }

    setGenerating(true);
    showToast(t.project.generationStarted, 'info');

    const isVideo = activeTab === AssetType.VIDEO_SEGMENT;
    const jobType = isVideo ? 'generate_video' : 'generate_image';

    try {
        const job: Job = {
            id: crypto.randomUUID(),
            projectId: id,
            type: jobType,
            status: JobStatus.PENDING,
            params: {
                prompt: genParams.prompt,
                model: selectedModelId, // configuration ID (e.g., volc-img-1)
                assetId: selectedAsset.id,
                assetName: selectedAsset.name,
                assetType: selectedAsset.type,
                referenceImages: genParams.referenceImages,
                startImage: genParams.startImage,
                endImage: genParams.endImage
            },
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        console.log(`[ProjectDetail] Submitting job: ${job.id}`);
        await jobQueue.addJob(job);
    } catch (error: any) {
        console.error('[ProjectDetail] Failed to add job:', error);
        showToast(error.message || t.errors.generationFailed, 'error');
        setGenerating(false);
    }
  };

  if (!project) return (
    <div className="flex items-center justify-center h-full">
      <Spinner size="lg" color="primary" />
    </div>
  );

  const filteredModels = settings.models.filter(m => 
    activeTab === AssetType.VIDEO_SEGMENT ? m.type === 'video' : m.type === 'image'
  );

  const activeTabSingular = t.project[activeTab as keyof typeof t.project] || activeTab;
  const activeTabPlural = activeTab === AssetType.RESOURCES 
    ? t.project.resources 
    : activeTab === AssetType.VIDEO_SEGMENT
    ? t.project.segments
    : (t.project[(activeTab + 's') as keyof typeof t.project] || t.project.assets);

  const handleAssetUpdate = async (updatedAsset: Asset, skipSave: boolean = false) => {
    if (!skipSave) {
        // Prevent duplicate names check (optional, but good to keep if needed)
        // However, updateAsset is atomic, checking outside might be slightly stale but acceptable for names
        const assets = await storageService.getAssets(id || '');
        const exists = assets.some(a => a.type === updatedAsset.type && a.name === updatedAsset.name && a.id !== updatedAsset.id);
        if (exists) {
            showToast(t.errors?.duplicateName || 'Name already exists', 'error');
            return;
        }

        // Use atomic update to merge UI changes with potential background updates (e.g. new images)
        await storageService.updateAsset(updatedAsset.id, id || '', async (currentOnDisk) => {
             // Merge strategy:
             // 1. Keep UI changes for scalar fields (name, prompt, metadata settings)
             // 2. Be careful with lists like generatedImages/videos that Queue appends to
             
             const merged = { ...currentOnDisk, ...updatedAsset };
             
             // Restore generated lists from disk if they have more items (Queue appended something)
             // This is a heuristic: Queue only appends. UI only appends (or deletes).
             // If UI deletes, we trust UI. If Queue appends, we trust Queue.
             // Conflict: UI deletes item A, Queue appends item B.
             // If we use disk list, we lose UI deletion. If we use UI list, we lose Queue append.
             
             // Safer approach: 
             // Trust UI for everything EXCEPT if we suspect a background update happened that UI missed.
             // But UI should have reloaded if it caught the event.
             // The user issue is: UI has old list, Queue wrote new list, UI saves old list -> New items lost.
             
             const diskImages = (currentOnDisk as CharacterAsset).generatedImages || [];
             const uiImages = (updatedAsset as CharacterAsset).generatedImages || [];
             
             // If disk has MORE images than UI, it means Queue added some that UI doesn't know about yet.
             // We should preserve them.
             // But what if UI deleted some? 
             // If UI deleted, uiImages.length < diskImages.length could be valid.
             // But usually deletions are explicit actions that also use onUpdate.
             
             // Let's look at the IDs.
             const uiIds = new Set(uiImages.map(i => i.id));
             const diskIds = new Set(diskImages.map(i => i.id));
             
             // Find images on disk that are NOT in UI
             const newOnDisk = diskImages.filter(i => !uiIds.has(i.id));
             
             if (newOnDisk.length > 0) {
                 console.log(`[ProjectDetail] Detected ${newOnDisk.length} new images on disk during save. Merging...`);
                 
                 // HEURISTIC: Only resurrect images that are VERY RECENT (e.g. created in last 2 minutes).
                 // This protects against "Overwrite due to stale UI" (which happens during generation).
                 // It allows "Explicit Deletion" (which usually happens on older images, or at least we accept the risk for very new ones).
                 // If we don't do this, explicit deletions of old images will fail (they will be resurrected).
                 
                 const RECENT_THRESHOLD = 2 * 60 * 1000; // 2 minutes
                 const now = Date.now();
                 
                 const imagesToRescue = newOnDisk.filter(img => (now - (img.createdAt || 0)) < RECENT_THRESHOLD);
                 
                 if (imagesToRescue.length > 0) {
                     console.log(`[ProjectDetail] Rescuing ${imagesToRescue.length} recent images that were missing in UI.`);
                     (merged as CharacterAsset).generatedImages = [
                         ...uiImages,
                         ...imagesToRescue
                     ].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); // Keep chronological order
                 }
             }
             
             // Same for videos
             const diskVideos = (currentOnDisk as FragmentAsset).videos || [];
             const uiVideos = (updatedAsset as FragmentAsset).videos || [];
             const uiVideoIds = new Set(uiVideos.map(v => v.id));
             const newVideosOnDisk = diskVideos.filter(v => !uiVideoIds.has(v.id));
             
             if (newVideosOnDisk.length > 0) {
                  const RECENT_THRESHOLD = 2 * 60 * 1000;
                  const now = Date.now();
                  const videosToRescue = newVideosOnDisk.filter(v => (now - (v.createdAt || 0)) < RECENT_THRESHOLD);
                  
                  if (videosToRescue.length > 0) {
                      console.log(`[ProjectDetail] Rescuing ${videosToRescue.length} recent videos that were missing in UI.`);
                       (merged as FragmentAsset).videos = [
                           ...uiVideos, 
                           ...videosToRescue
                       ].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
                  }
             }
             
             return merged;
        });
    }
    setSelectedAsset(updatedAsset);
    setRefreshTrigger(prev => prev + 1);
  };

  // DETAIL VIEW
  if (selectedAsset) {
    return (
        <DetailView 
            selectedAsset={selectedAsset}
            setSelectedAsset={setSelectedAsset}
            activeTab={activeTab}
            activeTabPlural={activeTabPlural}
            handleAssetUpdate={handleAssetUpdate}
            projectId={id || ''}
            prompt={prompt}
            setPrompt={setPrompt}
            selectedModelId={selectedModelId}
            setSelectedModelId={setSelectedModelId}
            generating={generating}
            onGenerate={handleGenerate}
            models={filteredModels}
            t={t}
        />
    );
  }

  // RESOURCE MANAGER VIEW
  if (activeTab === AssetType.RESOURCES) {
      return (
          <div className="h-full bg-slate-50 dark:bg-slate-950">
             <ResourceManager 
                 projectId={id || ''} 
                 refreshTrigger={refreshTrigger} 
             />
            {activeTab === AssetType.ITEM && (
          <ItemSidebar 
            projectId={id || ''}
            onSelect={(asset) => setHighlightedAssetId(asset.id)}
            refreshTrigger={refreshTrigger}
            selectedId={highlightedAssetId}
            filterType={itemTypeFilter}
          />
        )}
      </div>
      );
  }

  // LIST VIEW
  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      
      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 md:px-10 py-10">
          <div className="max-w-[1600px] mx-auto">
            <AssetList 
              projectId={id || ''} 
              type={activeTab} 
              refreshTrigger={refreshTrigger}
              onSelect={setSelectedAsset}
              onAdd={onAddOpen}
              highlightedAssetId={highlightedAssetId}
              itemTypeFilter={itemTypeFilter}
              onItemTypeFilterChange={setItemTypeFilter}
              onDelete={() => setRefreshTrigger(prev => prev + 1)}
            />
          </div>
        </div>

        {activeTab === AssetType.ITEM && (
          <ItemSidebar 
            projectId={id || ''}
            onSelect={(asset) => setHighlightedAssetId(asset.id)}
            refreshTrigger={refreshTrigger}
            selectedId={highlightedAssetId}
            filterType={itemTypeFilter}
          />
        )}

        {activeTab === AssetType.CHARACTER && (
          <CharacterSidebar 
            projectId={id || ''}
            onSelect={(asset) => setHighlightedAssetId(asset.id)}
            refreshTrigger={refreshTrigger}
            selectedId={highlightedAssetId}
          />
        )}

        {activeTab === AssetType.VIDEO_SEGMENT && (
          <FragmentSidebar 
            projectId={id || ''}
            onSelect={(asset) => setHighlightedAssetId(asset.id)}
            refreshTrigger={refreshTrigger}
            selectedId={highlightedAssetId}
          />
        )}

        {activeTab === AssetType.SCENE && (
          <SceneSidebar 
            projectId={id || ''}
            onSelect={(asset) => setHighlightedAssetId(asset.id)}
            refreshTrigger={refreshTrigger}
            selectedId={highlightedAssetId}
          />
        )}
      </div>

      {/* ADD ASSET MODAL */}
      <Modal 
        isOpen={isAddOpen} 
        onClose={onAddClose}
        placement="center"
        backdrop="blur"
        size="md"
        radius="lg"
        classNames={{
          base: "dark:bg-slate-900 border border-slate-200 dark:border-slate-800",
          header: "border-b-[1px] border-slate-100 dark:border-slate-800 p-6",
          body: "p-8",
          footer: "border-t-[1px] border-slate-100 dark:border-slate-800 p-6",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {t.project.createTitle.replace('{type}', activeTabSingular)}
                </h2>
              </ModalHeader>
              <ModalBody>
                <Input
                  label={t.project.nameLabel}
                  placeholder={t.project.namePlaceholder.replace('{type}', activeTabSingular)}
                  labelPlacement="outside"
                  variant="bordered"
                  radius="lg"
                  size="lg"
                  autoFocus
                  value={assetName}
                  onValueChange={setAssetName}
                  classNames={{
                    label: "font-black text-[14px] uppercase tracking-widest text-slate-400 mb-2",
                    input: "text-sm",
                    inputWrapper: "border-2 group-data-[focus=true]:border-indigo-500"
                  }}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} className="font-bold text-slate-500">
                  {t.dashboard.cancel}
                </Button>
                <Button 
                  color="primary" 
                  onPress={handleCreateEmptyAsset}
                  className="font-black uppercase tracking-widest text-xs px-8"
                  radius="lg"
                >
                  {t.dashboard.create}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default ProjectDetail;