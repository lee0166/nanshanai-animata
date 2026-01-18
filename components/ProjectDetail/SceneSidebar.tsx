import React, { useEffect, useState } from 'react';
import { Asset, AssetType, SceneAsset } from '../../types';
import { storageService } from '../../services/storage';
import { useApp } from '../../contexts/context';
import { Input, ScrollShadow } from "@heroui/react";
import { Search } from 'lucide-react';

interface SceneSidebarProps {
  projectId: string;
  onSelect: (asset: Asset) => void;
  refreshTrigger: number;
  selectedId?: string;
}

const SceneSidebar: React.FC<SceneSidebarProps> = ({ projectId, onSelect, refreshTrigger, selectedId }) => {
  const { t } = useApp();
  const [scenes, setScenes] = useState<SceneAsset[]>([]);
  const [search, setSearch] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    loadScenes();
  }, [projectId, refreshTrigger]);

  const loadScenes = async () => {
    const assets = await storageService.getAssets(projectId);
    const sceneAssets = assets.filter(a => a.type === AssetType.SCENE) as SceneAsset[];
    sceneAssets.sort((a, b) => b.createdAt - a.createdAt);
    setScenes(sceneAssets);

    // Load URLs
    const newUrls: Record<string, string> = {};
    for (const scene of sceneAssets) {
      if (scene.filePath) {
         if (scene.filePath.startsWith('remote:')) {
            newUrls[scene.id] = scene.filePath.substring(7);
         } else {
            newUrls[scene.id] = await storageService.getAssetUrl(scene.filePath);
         }
      }
    }
    setUrls(newUrls);
  };

  const filtered = scenes.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-[340px]">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">
          {t.project.sceneList}
        </h3>
        <Input
          placeholder={t.common?.search || "Search..."}
          value={search}
          onValueChange={setSearch}
          startContent={<Search className="w-4 h-4 text-slate-400" />}
          size="sm"
          variant="bordered"
          radius="lg"
          classNames={{
             inputWrapper: "bg-slate-50 dark:bg-slate-950"
          }}
        />
      </div>
      
      <ScrollShadow className="flex-1 p-3">
        <div className="flex flex-col gap-3">
          {filtered.map(scene => {
             const isSelected = selectedId === scene.id;
             return (
              <div 
                key={scene.id}
                onClick={() => onSelect(scene)}
                className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border ${
                  isSelected 
                    ? 'bg-indigo-50 dark:bg-slate-800 border-indigo-500' 
                    : 'bg-slate-50 dark:bg-slate-800/30 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex-none border-2 border-white dark:border-slate-700 shadow-sm">
                   {urls[scene.id] ? (
                      <img src={urls[scene.id]} className="w-full h-full object-cover" alt={scene.name} />
                   ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">?</div>
                   )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                   <div className={`font-bold text-base truncate ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                      {scene.name}
                   </div>
                   <div className="text-xs text-slate-500 dark:text-slate-400 truncate w-full font-medium">
                      {scene.prompt || '-'}
                   </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
             <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                No scenes found
             </div>
          )}
        </div>
      </ScrollShadow>
    </div>
  );
};

export default SceneSidebar;
