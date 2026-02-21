import React, { useState } from 'react';
import { ScriptItem, ItemAsset, AssetType, ItemType } from '../../types';
import { storageService } from '../../services/storage';
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
  Chip
} from "@heroui/react";
import { Box, Link2, Plus, Edit2, Wand2, CheckCircle2, Sword, FileText, Gem, Hammer, PawPrint, HelpCircle } from 'lucide-react';

interface ItemMappingProps {
  projectId: string;
  scriptId: string;  // 当前剧本ID
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
  other: <Box size={16} />
};

const categoryLabels: Record<string, string> = {
  weapon: '武器',
  tool: '工具',
  jewelry: '饰品',
  document: '文档',
  creature: '生物',
  animal: '动物',
  other: '其他'
};

const categoryToItemType: Record<string, ItemType> = {
  weapon: ItemType.PROP,
  tool: ItemType.PROP,
  jewelry: ItemType.PROP,
  document: ItemType.REFERENCE,
  creature: ItemType.CREATURE,
  animal: ItemType.ANIMAL,
  other: ItemType.PROP
};

export const ItemMapping: React.FC<ItemMappingProps> = ({
  projectId,
  scriptId,
  scriptItems,
  existingItems,
  onItemsUpdate,
  onItemCreated
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
  const handleCreateItem = async (scriptItem: ScriptItem) => {
    try {
      const newItem: ItemAsset = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        scriptId,  // 关联当前剧本
        type: AssetType.ITEM,
        name: scriptItem.name,
        prompt: scriptItem.visualPrompt || `${scriptItem.name}的物品设定`,
        itemType: categoryToItemType[scriptItem.category] || ItemType.PROP,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await storageService.saveAsset(newItem);

      // Update mapping
      const updated = scriptItems.map(i =>
        i.name === scriptItem.name ? { ...i, mappedAssetId: newItem.id } : i
      );
      onItemsUpdate(updated);

      // Notify parent to refresh existing items list
      onItemCreated?.();

      showToast(`物品 "${scriptItem.name}" 创建成功`, 'success');
    } catch (error: any) {
      showToast(`创建失败: ${error.message}`, 'error');
    }
  };

  // Handle updating script item details
  const handleUpdateItem = (updated: ScriptItem) => {
    const updatedList = scriptItems.map(i =>
      i.name === updated.name ? updated : i
    );
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
            共 {scriptItems.length} 个道具，
            已关联 {scriptItems.filter(i => i.mappedAssetId).length} 个
          </p>
        </div>
        <Button
          color="primary"
          size="sm"
          startContent={<Plus size={16} />}
          onPress={() => {
            const unmapped = scriptItems.filter(i => !i.mappedAssetId);
            if (unmapped.length === 0) {
              showToast('所有道具已关联', 'info');
              return;
            }
            Promise.all(unmapped.map(i => handleCreateItem(i)));
          }}
        >
          批量创建未关联道具
        </Button>
      </div>

      {/* Item Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scriptItems.map((item) => {
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
                        <Chip size="sm" color="success" variant="flat" startContent={<CheckCircle2 size={12} />}>
                          已关联
                        </Chip>
                      )}
                    </div>
                  </div>
                </div>

                {/* Item Info */}
                <div className="space-y-2 text-sm mb-3">
                  {item.description && (
                    <p className="text-default-600 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  {item.owner && (
                    <p className="text-default-500 text-xs">
                      <span className="font-medium">所属：</span>{item.owner}
                    </p>
                  )}
                  {item.visualPrompt && (
                    <p className="text-default-500 text-xs line-clamp-2">
                      {item.visualPrompt}
                    </p>
                  )}
                </div>

                {/* Mapping Controls */}
                <div className="space-y-2">
                  <Select
                    label="关联到现有物品"
                    placeholder="选择现有物品或留空"
                    selectedKeys={item.mappedAssetId ? new Set([item.mappedAssetId]) : new Set()}
                    onChange={(e) => handleMapItem(item, e.target.value)}
                    size="sm"
                  >
                    <SelectItem key="" value="">不关联</SelectItem>
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
                  <Input
                    label="道具名称"
                    value={selectedItem.name}
                    isReadOnly
                  />
                  <Select
                    label="分类"
                    selectedKeys={new Set([selectedItem.category])}
                    onChange={(e) => setSelectedItem({ ...selectedItem, category: e.target.value as any })}
                  >
                    <SelectItem key="weapon" value="weapon">武器</SelectItem>
                    <SelectItem key="tool" value="tool">工具</SelectItem>
                    <SelectItem key="jewelry" value="jewelry">饰品</SelectItem>
                    <SelectItem key="document" value="document">文档</SelectItem>
                    <SelectItem key="creature" value="creature">生物</SelectItem>
                    <SelectItem key="animal" value="animal">动物</SelectItem>
                    <SelectItem key="other" value="other">其他</SelectItem>
                  </Select>
                  <Select
                    label="重要性"
                    selectedKeys={new Set([selectedItem.importance])}
                    onChange={(e) => setSelectedItem({ ...selectedItem, importance: e.target.value as any })}
                  >
                    <SelectItem key="major" value="major">重要道具</SelectItem>
                    <SelectItem key="minor" value="minor">次要道具</SelectItem>
                  </Select>
                  <Input
                    label="所属角色"
                    value={selectedItem.owner || ''}
                    onChange={(e) => setSelectedItem({ ...selectedItem, owner: e.target.value })}
                    placeholder="如有"
                  />
                </div>

                <Textarea
                  label="道具描述"
                  value={selectedItem.description}
                  onChange={(e) => setSelectedItem({ ...selectedItem, description: e.target.value })}
                  minRows={3}
                />

                <Textarea
                  label="视觉提示词（用于AI生图）"
                  value={selectedItem.visualPrompt}
                  onChange={(e) => setSelectedItem({ ...selectedItem, visualPrompt: e.target.value })}
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
