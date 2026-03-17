import React, { useState } from 'react';
import { ScriptItem, ItemAsset, AssetType, ItemType } from '../../types';
import { storageService } from '../../services/storage';
import { ItemPromptBuilder } from '../../services/promptBuilder';
import { useApp } from '../../contexts/context';
import { useToast } from '../../contexts/ToastContext';
import {
  Card,
  CardBody,
  Button,
  Badge,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Input,
  Chip,
} from '@heroui/react';
import {
  Box,
  Link2,
  Plus,
  Edit2,
  Wand2,
  CheckCircle2,
  Sword,
  FileText,
  Gem,
  Hammer,
  PawPrint,
  HelpCircle,
} from 'lucide-react';

interface ItemMappingProps {
  projectId: string;
  scriptId: string; // 当前剧本ID
  scriptItems: ScriptItem[];
  existingItems: ItemAsset[];
  onItemsUpdate: (items: ScriptItem[]) => void;
  onItemCreated?: () => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  weapon: <Sword size={16} />,
  tool: <Hammer size={16} />,
  jewelry: <Gem size={16} />,
  document: <FileText size={16} />,
  creature: <PawPrint size={16} />,
  animal: <PawPrint size={16} />,
  other: <Box size={16} />,
};

const categoryLabels: Record<string, string> = {
  weapon: '武器',
  tool: '工具',
  jewelry: '饰品',
  document: '文档',
  creature: '生物',
  animal: '动物',
  other: '其他',
};

const categoryToItemType: Record<string, ItemType> = {
  weapon: ItemType.PROP,
  tool: ItemType.PROP,
  jewelry: ItemType.PROP,
  document: ItemType.REFERENCE,
  creature: ItemType.CREATURE,
  animal: ItemType.ANIMAL,
  other: ItemType.PROP,
};

export const ItemMapping: React.FC<ItemMappingProps> = ({
  projectId,
  scriptId,
  scriptItems,
  existingItems,
  onItemsUpdate,
  onItemCreated,
}) => {
  const { t, settings } = useApp();
  const { showToast } = useToast();
  const [selectedItem, setSelectedItem] = useState<ScriptItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Handle mapping script item to existing asset
  const handleMapItem = (scriptItem: ScriptItem, assetId: string) => {
    const updated = scriptItems.map(i =>
      i.name === scriptItem.name ? { ...i, mappedAssetId: assetId || undefined } : i
    );
    onItemsUpdate(updated);
    showToast(assetId ? '已关联现有物品' : '已取消关联', 'success');
  };

  // Handle creating new item asset from script item
  // 纯创建逻辑 - 只创建资产，不更新状态
  const createItemAsset = async (scriptItem: ScriptItem): Promise<string> => {
    const generatedPrompt = ItemPromptBuilder.build(scriptItem);

    const newItem: ItemAsset = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      scriptId, // 关联当前剧本
      type: AssetType.ITEM,
      name: scriptItem.name,
      prompt: generatedPrompt,
      itemType: categoryToItemType[scriptItem.category] || ItemType.PROP,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await storageService.saveAsset(newItem);
    return newItem.id;
  };

  const handleCreateItem = async (scriptItem: ScriptItem) => {
    try {
      // 1. 创建资产（不更新状态）
      const assetId = await createItemAsset(scriptItem);

      // 2. 更新状态
      const updated = scriptItems.map(i =>
        i.name === scriptItem.name ? { ...i, mappedAssetId: assetId } : i
      );
      onItemsUpdate(updated);

      // 3. 通知父组件刷新
      onItemCreated?.();

      showToast(`物品 "${scriptItem.name}" 创建成功`, 'success');
    } catch (error: any) {
      showToast(`创建失败: ${error.message}`, 'error');
    }
  };

  // 批量创建物品 - 彻底修复竞态条件
  const handleBatchCreateItems = async () => {
    const unmapped = scriptItems.filter(i => !i.mappedAssetId);
    if (unmapped.length === 0) {
      showToast('所有道具已关联', 'info');
      return;
    }

    console.log(`[ItemMapping] ========== 开始批量创建物品 ==========`);
    console.log(`[ItemMapping] 待创建物品数量: ${unmapped.length}`);
    console.log(`[ItemMapping] 物品列表: ${unmapped.map(i => i.name).join(', ')}`);

    const createdMappings: { name: string; assetId: string }[] = [];
    const failedItems: string[] = [];
    const startTime = Date.now();

    try {
      // 第一步：串行创建所有资产（不更新状态）
      for (let i = 0; i < unmapped.length; i++) {
        const item = unmapped[i];
        console.log(`[ItemMapping] [${i + 1}/${unmapped.length}] 创建物品: ${item.name}`);
        try {
          const assetId = await createItemAsset(item); // 只创建，不更新状态
          createdMappings.push({ name: item.name, assetId });
          console.log(
            `[ItemMapping] [${i + 1}/${unmapped.length}] 物品 ${item.name} 创建成功，ID: ${assetId}`
          );
        } catch (error) {
          console.error(`[ItemMapping] 创建物品 ${item.name} 失败:`, error);
          failedItems.push(item.name);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[ItemMapping] 批量创建完成，耗时: ${duration}ms`);
      console.log(`[ItemMapping] 成功: ${createdMappings.length}/${unmapped.length}`);
      console.log(`[ItemMapping] 失败: ${failedItems.length}/${unmapped.length}`);

      // 第二步：统一更新所有状态（只更新一次）
      if (createdMappings.length > 0) {
        const updated = scriptItems.map(i => {
          const mapping = createdMappings.find(m => m.name === i.name);
          return mapping ? { ...i, mappedAssetId: mapping.assetId } : i;
        });
        onItemsUpdate(updated); // 关键：只更新一次
        onItemCreated?.();

        if (failedItems.length > 0) {
          showToast(
            `成功创建 ${createdMappings.length} 个道具，${failedItems.length} 个失败`,
            'warning'
          );
        } else {
          showToast(`成功创建 ${createdMappings.length} 个道具`, 'success');
        }
      } else {
        showToast('创建失败，请重试', 'error');
      }
    } catch (error) {
      console.error('[ItemMapping] 批量创建道具失败:', error);
      showToast('批量创建失败', 'error');
    } finally {
      console.log(`[ItemMapping] ========== 批量创建物品结束 ==========`);
    }
  };

  // Handle updating script item details
  const handleUpdateItem = (updated: ScriptItem) => {
    const updatedList = scriptItems.map(i => (i.name === updated.name ? updated : i));
    onItemsUpdate(updatedList);
    setIsEditModalOpen(false);
    showToast('物品信息已更新', 'success');
  };

  // Get mapped asset info
  const getMappedAsset = (assetId?: string): ItemAsset | undefined => {
    if (!assetId) return undefined;
    return existingItems.find(i => i.id === assetId);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">道具映射</h3>
          <p className="text-sm text-default-500">
            共 {scriptItems.length} 个道具， 已关联{' '}
            {scriptItems.filter(i => i.mappedAssetId).length} 个
          </p>
        </div>
        <Button
          color="primary"
          size="sm"
          startContent={<Plus size={16} />}
          onPress={handleBatchCreateItems}
        >
          批量创建未关联道具
        </Button>
      </div>

      {/* Item Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scriptItems.map(item => {
          const mappedAsset = getMappedAsset(item.mappedAssetId);
          const hasImage = mappedAsset?.currentImageId || mappedAsset?.generatedImages?.length;

          return (
            <Card key={item.name} className="relative">
              <CardBody className="p-4">
                {/* Item Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-default-100 flex items-center justify-center">
                    {categoryIcons[item.category] || <Box size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-lg truncate">{item.name}</h4>
                    <div className="flex gap-1 flex-wrap">
                      <Chip size="sm" variant="flat">
                        {categoryLabels[item.category] || '其他'}
                      </Chip>
                      {item.importance === 'major' && (
                        <Chip size="sm" variant="flat" color="warning">
                          重要道具
                        </Chip>
                      )}
                      {mappedAsset && (
                        <Chip
                          size="sm"
                          color="success"
                          variant="flat"
                          startContent={<CheckCircle2 size={12} />}
                        >
                          已关联
                        </Chip>
                      )}
                    </div>
                  </div>
                </div>

                {/* Item Info */}
                <div className="space-y-2 text-sm mb-3">
                  {item.description && (
                    <p className="text-default-600 line-clamp-2">{item.description}</p>
                  )}
                  {item.owner && (
                    <p className="text-default-500 text-xs">
                      <span className="font-medium">所属：</span>
                      {item.owner}
                    </p>
                  )}
                  {item.visualPrompt && (
                    <p className="text-default-500 text-xs line-clamp-2">{item.visualPrompt}</p>
                  )}
                </div>

                {/* Mapping Controls */}
                <div className="space-y-2">
                  <Select
                    aria-label="关联到现有物品"
                    label="关联到现有物品"
                    placeholder="选择现有物品或留空"
                    selectedKeys={item.mappedAssetId ? new Set([item.mappedAssetId]) : new Set()}
                    onChange={e => handleMapItem(item, e.target.value)}
                    size="sm"
                  >
                    <SelectItem key="" value="">
                      不关联
                    </SelectItem>
                    {existingItems.map(asset => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </Select>

                  <div className="flex gap-2">
                    {!item.mappedAssetId && (
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<Plus size={14} />}
                        onPress={() => handleCreateItem(item)}
                        className="flex-1"
                      >
                        创建物品
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<Edit2 size={14} />}
                      onPress={() => {
                        setSelectedItem(item);
                        setIsEditModalOpen(true);
                      }}
                      className="flex-1"
                    >
                      编辑
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} size="2xl">
        <ModalContent>
          {selectedItem && (
            <>
              <ModalHeader>编辑道具 - {selectedItem.name}</ModalHeader>
              <ModalBody className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="道具名称" value={selectedItem.name} isReadOnly />
                  <Select
                    aria-label="分类"
                    label="分类"
                    selectedKeys={new Set([selectedItem.category])}
                    onChange={e =>
                      setSelectedItem({ ...selectedItem, category: e.target.value as any })
                    }
                  >
                    <SelectItem key="weapon" value="weapon">
                      武器
                    </SelectItem>
                    <SelectItem key="tool" value="tool">
                      工具
                    </SelectItem>
                    <SelectItem key="jewelry" value="jewelry">
                      饰品
                    </SelectItem>
                    <SelectItem key="document" value="document">
                      文档
                    </SelectItem>
                    <SelectItem key="creature" value="creature">
                      生物
                    </SelectItem>
                    <SelectItem key="animal" value="animal">
                      动物
                    </SelectItem>
                    <SelectItem key="other" value="other">
                      其他
                    </SelectItem>
                  </Select>
                  <Select
                    aria-label="重要性"
                    label="重要性"
                    selectedKeys={new Set([selectedItem.importance])}
                    onChange={e =>
                      setSelectedItem({ ...selectedItem, importance: e.target.value as any })
                    }
                  >
                    <SelectItem key="major" value="major">
                      重要道具
                    </SelectItem>
                    <SelectItem key="minor" value="minor">
                      次要道具
                    </SelectItem>
                  </Select>
                  <Input
                    label="所属角色"
                    value={selectedItem.owner || ''}
                    onChange={e => setSelectedItem({ ...selectedItem, owner: e.target.value })}
                    placeholder="如有"
                  />
                </div>

                <Textarea
                  label="道具描述"
                  value={selectedItem.description}
                  onChange={e => setSelectedItem({ ...selectedItem, description: e.target.value })}
                  minRows={3}
                />

                <Textarea
                  label="视觉提示词（用于AI生图）"
                  value={selectedItem.visualPrompt}
                  onChange={e => setSelectedItem({ ...selectedItem, visualPrompt: e.target.value })}
                  minRows={3}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setIsEditModalOpen(false)}>
                  取消
                </Button>
                <Button color="primary" onPress={() => handleUpdateItem(selectedItem)}>
                  保存
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};
