import React from 'react';
import { 
  Button, 
  Card,
  Breadcrumbs,
  BreadcrumbItem,
} from "@heroui/react";
import { ChevronLeft, Sparkles } from 'lucide-react';
import { Asset, AssetType, ModelConfig } from '../../types';
import AssetPreview from './AssetPreview';
import GenerationForm, { GenerationParams } from './GenerationForm';
import CharacterDetail from './Character/CharacterDetail';
import ItemDetail from './Item/ItemDetail';
import SceneDetail from './Scene/SceneDetail';
import ResourceManager from './Resource/ResourceManager';

import FragmentDetail from './Fragment/FragmentDetail';

interface DetailViewProps {
    selectedAsset: Asset;
    setSelectedAsset: (a: Asset | null) => void;
    activeTab: AssetType;
    activeTabPlural: string;
    handleAssetUpdate: (a: Asset, skipSave?: boolean) => Promise<void>;
    projectId: string;
    prompt: string;
    setPrompt: (s: string) => void;
    selectedModelId: string;
    setSelectedModelId: (s: string) => void;
    generating: boolean;
    onGenerate: (params: GenerationParams) => void;
    models: ModelConfig[];
    t: any;
}

const DetailView: React.FC<DetailViewProps> = ({
    selectedAsset,
    setSelectedAsset,
    activeTab,
    activeTabPlural,
    handleAssetUpdate,
    projectId,
    prompt,
    setPrompt,
    selectedModelId,
    setSelectedModelId,
    generating,
    onGenerate,
    models,
    t
}) => {
    return (
        <div className="h-full overflow-hidden bg-slate-50 dark:bg-slate-950 p-6 md:p-10">
            <div className="w-full max-w-[1600px] mx-auto h-full flex flex-col min-h-0">
                <div className="flex items-center gap-4 mb-10 shrink-0">
                    <Button
                        isIconOnly
                        variant="flat"
                        radius="lg"
                        onPress={() => setSelectedAsset(null)}
                        className="bg-white dark:bg-slate-900 shadow-sm"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-none mb-2">{selectedAsset.name}</h2>
                        <Breadcrumbs size="sm" color="primary" variant="light">
                            <BreadcrumbItem>{activeTabPlural}</BreadcrumbItem>
                        </Breadcrumbs>
                    </div>
                </div>

                <div className="flex-1 min-h-0">
                    {activeTab === AssetType.CHARACTER ? (
                        <CharacterDetail 
                            asset={selectedAsset as any} 
                            onUpdate={handleAssetUpdate} 
                            projectId={projectId || ''} 
                        />
                    ) : activeTab === AssetType.ITEM ? (
                        <ItemDetail 
                            asset={selectedAsset as any} 
                            onUpdate={handleAssetUpdate} 
                            projectId={projectId || ''} 
                        />
                    ) : activeTab === AssetType.SCENE ? (
                        <SceneDetail 
                            asset={selectedAsset as any} 
                            onUpdate={handleAssetUpdate} 
                            projectId={projectId || ''} 
                        />
                    ) : activeTab === AssetType.VIDEO_SEGMENT ? (
                        <FragmentDetail 
                            asset={selectedAsset as any} 
                            onUpdate={handleAssetUpdate} 
                            projectId={projectId || ''} 
                        />
                    ) : activeTab === AssetType.RESOURCES ? (
                        <ResourceManager 
                            projectId={projectId || ''}
                            refreshTrigger={0}
                        />
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 h-full">
                            <div className="space-y-6 flex flex-col h-full overflow-hidden">
                                <Card className="flex-1 border-none bg-slate-200 dark:bg-slate-900 overflow-hidden flex items-center justify-center relative shadow-inner rounded-[3rem]">
                                    {selectedAsset.filePath ? (
                                        <AssetPreview path={selectedAsset.filePath} t={t} />
                                    ) : (
                                        <div className="flex flex-col items-center gap-6 text-slate-400 dark:text-slate-700">
                                            <div className="p-8 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse">
                                                <Sparkles className="w-16 h-16" />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-[0.4em] opacity-50">{t.project.pendingGeneration}</span>
                                        </div>
                                    )}
                                </Card>

                                {selectedAsset.prompt && (
                                    <Card className="bg-white dark:bg-slate-900/50 p-8 rounded-[2rem] border-none shadow-sm shrink-0">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block">{t.project.lastPromptUsed}</label>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed italic font-medium">"{selectedAsset.prompt}"</p>
                                    </Card>
                                )}
                            </div>

                            <div className="flex flex-col h-full overflow-hidden">
                                <GenerationForm 
                                    prompt={prompt}
                                    setPrompt={setPrompt}
                                    selectedModelId={selectedModelId}
                                    setSelectedModelId={setSelectedModelId}
                                    generating={generating}
                                    onGenerate={onGenerate}
                                    models={models}
                                    t={t}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DetailView;
