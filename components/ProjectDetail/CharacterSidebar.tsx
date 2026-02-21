import React, { useEffect, useState } from 'react';
import { Asset, AssetType, CharacterAsset, Script } from '../../types';
import { storageService } from '../../services/storage';
import { useApp } from '../../contexts/context';
import { Input, ScrollShadow, Select, SelectItem } from "@heroui/react";
import { Search, Filter } from 'lucide-react';

interface CharacterSidebarProps {
  projectId: string;
  onSelect: (asset: Asset) => void;
  refreshTrigger: number;
  selectedId?: string;
  // External script filter props
  scriptFilter?: string;
  scripts?: Array<{ id: string; title: string }>;
}

const CharacterSidebar: React.FC<CharacterSidebarProps> = ({ projectId, onSelect, refreshTrigger, selectedId, scriptFilter: externalScriptFilter, scripts: externalScripts }) => {
  const { t } = useApp();
  const [characters, setCharacters] = useState<CharacterAsset[]>([]);
  const [internalScripts, setInternalScripts] = useState<Script[]>([]);
  const [search, setSearch] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});

  // Use external scripts if provided, otherwise internal
  const scripts = externalScripts ? externalScripts.map(s => ({ id: s.id, title: s.title })) as Script[] : internalScripts;
  const selectedScriptId = externalScriptFilter || 'all';

  useEffect(() => {
    // 加载角色
    loadCharacters();
    // 如果没有外部剧本，加载内部剧本
    if (!externalScripts) {
      loadScripts();
    }
  }, [projectId, refreshTrigger, externalScripts]);

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

  const loadScripts = async () => {
    const scriptsData = await storageService.getScripts(projectId);
    setInternalScripts(scriptsData);
  };

  // 获取剧本名称
  const getScriptName = (scriptId?: string) => {
    if (!scriptId) return '未分类';
    if (scripts.length === 0) return '加载中...';
    
    const script = scripts.find(s => s.id === scriptId);
    // 注意：Script 接口使用 title 字段，不是 name 字段
    return script?.title || '未知剧本';
  };

  // 筛选角色
  const filtered = characters.filter(c => {
    // 按名称搜索
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    
    // 按剧本筛选
    let matchesScript = true;
    if (selectedScriptId === 'all') {
      matchesScript = true; // 显示所有
    } else if (selectedScriptId === 'uncategorized') {
      matchesScript = !c.scriptId; // 只显示未分类
    } else {
      matchesScript = c.scriptId === selectedScriptId; // 显示特定剧本
    }
    
    return matchesSearch && matchesScript;
  });

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-[340px]">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">
          {t.project.characterList}
        </h3>

        {/* 搜索框 */}
        <Input
          placeholder={t.common?.search || "Search..."}
          value={search}
          onValueChange={setSearch}
          startContent={<Search className="w-4 h-4 text-slate-400" />}
          size="sm"
          variant="bordered"
          radius="lg"
          classNames={{
             inputWrapper: "bg-slate-50 dark:bg-slate-950 mt-2"
          }}
        />
      </div>
      
      <ScrollShadow className="flex-1 p-3">
        <div className="flex flex-col gap-3">
          {filtered.map(char => {
             const isSelected = selectedId === char.id;
             const scriptName = getScriptName(char.scriptId);
             return (
              <div 
                key={char.id}
                onClick={() => onSelect(char)}
                className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border ${
                  isSelected 
                    ? 'bg-primary/10 dark:bg-slate-800 border-primary' 
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
                      {scriptName} · {char.gender ? t.character.genderOptions[char.gender] : '-'}
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
