import React, { useEffect, useState } from 'react';
import { Asset, AssetType, FragmentAsset } from '../../types';
import { storageService } from '../../services/storage';
import { useApp } from '../../contexts/context';
import { Input, ScrollShadow } from "@heroui/react";
import { Search } from 'lucide-react';

interface FragmentSidebarProps {
  projectId: string;
  onSelect: (asset: Asset) => void;
  refreshTrigger: number;
  selectedId?: string;
}

const FragmentSidebar: React.FC<FragmentSidebarProps> = ({ projectId, onSelect, refreshTrigger, selectedId }) => {
  const { t } = useApp();
  const [fragments, setFragments] = useState<FragmentAsset[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadFragments();
  }, [projectId, refreshTrigger]);

  const loadFragments = async () => {
    const assets = await storageService.getAssets(projectId);
    const frags = assets.filter(a => a.type === AssetType.VIDEO_SEGMENT) as FragmentAsset[];
    frags.sort((a, b) => b.createdAt - a.createdAt);
    setFragments(frags);
  };

  const filtered = fragments.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-[300px]">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">
          {t.project.fragmentList}
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
        <div className="flex flex-col gap-2">
          {filtered.map(frag => {
             const isSelected = selectedId === frag.id;
             return (
              <div 
                key={frag.id}
                onClick={() => onSelect(frag)}
                className={`group flex flex-col gap-1 p-3 rounded-xl cursor-pointer transition-all border ${
                  isSelected 
                    ? 'bg-indigo-50 dark:bg-slate-800 border-indigo-500 shadow-sm' 
                    : 'bg-slate-50 dark:bg-slate-800/30 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                 <div className={`font-bold text-base truncate ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                    {frag.name}
                 </div>
                 <div className="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 text-wrap leading-relaxed">
                    {frag.prompt || new Date(frag.createdAt).toLocaleString()}
                 </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
             <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                No fragments found
             </div>
          )}
        </div>
      </ScrollShadow>
    </div>
  );
};

export default FragmentSidebar;
