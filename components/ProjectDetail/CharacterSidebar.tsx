import React, { useEffect, useState } from 'react';
import { Asset, AssetType, CharacterAsset } from '../../types';
import { storageService } from '../../services/storage';
import { useApp } from '../../contexts/context';
import { Input, ScrollShadow } from "@heroui/react";
import { Search } from 'lucide-react';

interface CharacterSidebarProps {
  projectId: string;
  onSelect: (asset: Asset) => void;
  refreshTrigger: number;
  selectedId?: string;
}

const CharacterSidebar: React.FC<CharacterSidebarProps> = ({ projectId, onSelect, refreshTrigger, selectedId }) => {
  const { t } = useApp();
  const [characters, setCharacters] = useState<CharacterAsset[]>([]);
  const [search, setSearch] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    loadCharacters();
  }, [projectId, refreshTrigger]);

  const loadCharacters = async () => {
    const assets = await storageService.getAssets(projectId);
    const chars = assets.filter(a => a.type === AssetType.CHARACTER) as CharacterAsset[];
    chars.sort((a, b) => b.createdAt - a.createdAt);
    setCharacters(chars);

    // Load URLs
    const newUrls: Record<string, string> = {};
    for (const char of chars) {
      if (char.filePath) {
         if (char.filePath.startsWith('remote:')) {
            newUrls[char.id] = char.filePath.substring(7);
         } else {
            newUrls[char.id] = await storageService.getAssetUrl(char.filePath);
         }
      }
    }
    setUrls(newUrls);
  };

  const filtered = characters.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-[340px]">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">
          {t.project.characterList}
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
          {filtered.map(char => {
             const isSelected = selectedId === char.id;
             return (
              <div 
                key={char.id}
                onClick={() => onSelect(char)}
                className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border ${
                  isSelected 
                    ? 'bg-indigo-50 dark:bg-slate-800 border-indigo-500' 
                    : 'bg-slate-50 dark:bg-slate-900/50 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                }`}
              >
                <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex-none border-2 border-white dark:border-slate-700 shadow-sm">
                   {urls[char.id] ? (
                      <img src={urls[char.id]} className="w-full h-full object-cover" alt={char.name} />
                   ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">?</div>
                   )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                   <div className="font-bold text-base text-slate-900 dark:text-white truncate">
                      {char.name}
                   </div>
                   <div className="text-xs text-slate-500 dark:text-slate-400 truncate w-full font-medium">
                      {char.prompt || (char.gender ? t.character.genderOptions[char.gender] : '-')}
                   </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
             <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                No characters found
             </div>
          )}
        </div>
      </ScrollShadow>
    </div>
  );
};

export default CharacterSidebar;
