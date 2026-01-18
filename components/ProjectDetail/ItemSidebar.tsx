import React, { useEffect, useState, useMemo } from 'react';
import { Asset, AssetType, ItemAsset } from '../../types';
import { storageService } from '../../services/storage';
import { useApp } from '../../contexts/context';
import { Input, ScrollShadow, Chip } from "@heroui/react";
import { Search } from 'lucide-react';

interface ItemSidebarProps {
  projectId: string;
  onSelect: (asset: Asset) => void;
  refreshTrigger: number;
  selectedId?: string;
  filterType?: string; // New prop for filtering
}

const ItemSidebar: React.FC<ItemSidebarProps> = ({ projectId, onSelect, refreshTrigger, selectedId, filterType = 'all' }) => {
  const { t } = useApp();
  const [items, setItems] = useState<ItemAsset[]>([]);
  const [search, setSearch] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    loadItems();
  }, [projectId, refreshTrigger]);

  const loadItems = async () => {
    const assets = await storageService.getAssets(projectId);
    const itemAssets = assets.filter(a => a.type === AssetType.ITEM) as ItemAsset[];
    itemAssets.sort((a, b) => b.createdAt - a.createdAt);
    setItems(itemAssets);

    // Load URLs
    const newUrls: Record<string, string> = {};
    for (const item of itemAssets) {
      if (item.filePath) {
         if (item.filePath.startsWith('remote:')) {
            newUrls[item.id] = item.filePath.substring(7);
         } else {
            newUrls[item.id] = await storageService.getAssetUrl(item.filePath);
         }
      }
    }
    setUrls(newUrls);
  };

  const filtered = useMemo(() => {
    let result = items;
    
    // 1. Filter by Search
    if (search) {
        result = result.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    }

    // 2. Filter by Type (from props)
    if (filterType !== 'all') {
        result = result.filter(s => s.itemType === filterType);
    }

    return result;
  }, [items, search, filterType]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-[340px] order-last">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4">
          {t.project.itemList}
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
          {filtered.map(item => {
             const isSelected = selectedId === item.id;
             const typeLabel = t.project.itemTypes?.[item.itemType] || item.itemType;
             
             return (
              <div 
                key={item.id}
                onClick={() => onSelect(item)}
                className={`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all border ${
                  isSelected 
                    ? 'bg-indigo-50 dark:bg-slate-800 border-indigo-500' 
                    : 'bg-slate-50 dark:bg-slate-800/30 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex-none border-2 border-white dark:border-slate-700 shadow-sm">
                   {urls[item.id] ? (
                      <img src={urls[item.id]} className="w-full h-full object-cover" alt={item.name} />
                   ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">?</div>
                   )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                   <div className={`font-bold text-base truncate ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}`}>
                      {item.name}
                   </div>
                   <div className="flex flex-col gap-1">
                       <div className="flex items-center gap-2">
                           <Chip size="sm" variant="flat" className="h-5 text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                               {typeLabel}
                           </Chip>
                       </div>
                       {item.prompt && (
                          <div className="text-[12px] text-slate-400 truncate w-full" title={item.prompt}>
                              {item.prompt}
                          </div>
                       )}
                   </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
             <div className="p-8 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                No items found
             </div>
          )}
        </div>
      </ScrollShadow>
    </div>
  );
};

export default ItemSidebar;
