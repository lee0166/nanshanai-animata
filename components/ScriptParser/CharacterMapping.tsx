import React, { useState, useEffect } from 'react';
import { ScriptCharacter, CharacterAsset, AssetType } from '../../types';
import { storageService } from '../../services/storage';
import { useApp } from '../../contexts/context';
import { useToast } from '../../contexts/ToastContext';
import {
  Card,
  CardBody,
  Button,
  Avatar,
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
import { User, Link2, Plus, Edit2, Wand2, CheckCircle2 } from 'lucide-react';
import { ImageGenerationPanel } from '../ProjectDetail/Shared/ImageGenerationPanel';

interface CharacterMappingProps {
  projectId: string;
  scriptCharacters: ScriptCharacter[];
  existingCharacters: CharacterAsset[];
  onCharactersUpdate: (characters: ScriptCharacter[]) => void;
  onCharacterCreated?: () => void;
}

export const CharacterMapping: React.FC<CharacterMappingProps> = ({
  projectId,
  scriptCharacters,
  existingCharacters,
  onCharactersUpdate,
  onCharacterCreated
}) => {
  const { t, settings } = useApp();
  const { showToast } = useToast();
  const [selectedCharacter, setSelectedCharacter] = useState<ScriptCharacter | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Handle mapping script character to existing asset
  const handleMapCharacter = (scriptChar: ScriptCharacter, assetId: string) => {
    const updated = scriptCharacters.map(c =>
      c.name === scriptChar.name ? { ...c, mappedAssetId: assetId || undefined } : c
    );
    onCharactersUpdate(updated);
    showToast(assetId ? '已关联现有角色' : '已取消关联', 'success');
  };

  // Handle creating new character asset from script character
  const handleCreateCharacter = async (scriptChar: ScriptCharacter) => {
    try {
      const newCharacter: CharacterAsset = {
        id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        type: AssetType.CHARACTER,
        name: scriptChar.name,
        prompt: scriptChar.visualPrompt || `${scriptChar.name}的角色设定`,
        gender: (scriptChar.gender === 'male' || scriptChar.gender === 'female') ? scriptChar.gender : 'unlimited',
        ageGroup: mapAgeToGroup(scriptChar.age),
        metadata: {
          scriptDescription: JSON.stringify(scriptChar.appearance),
          personality: scriptChar.personality,
          signatureItems: scriptChar.signatureItems,
          emotionalArc: scriptChar.emotionalArc,
          relationships: scriptChar.relationships
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await storageService.saveAsset(newCharacter);

      // Update mapping
      const updated = scriptCharacters.map(c =>
        c.name === scriptChar.name ? { ...c, mappedAssetId: newCharacter.id } : c
      );
      onCharactersUpdate(updated);

      // Notify parent to refresh existing characters list
      onCharacterCreated?.();

      showToast(`角色 "${scriptChar.name}" 创建成功`, 'success');
    } catch (error: any) {
      showToast(`创建失败: ${error.message}`, 'error');
    }
  };

  // Handle updating script character details
  const handleUpdateCharacter = (updated: ScriptCharacter) => {
    const updatedList = scriptCharacters.map(c =>
      c.name === updated.name ? updated : c
    );
    onCharactersUpdate(updatedList);
    setIsEditModalOpen(false);
    showToast('角色信息已更新', 'success');
  };

  // Generate character image
  const handleGenerateImage = async (scriptChar: ScriptCharacter) => {
    if (!scriptChar.mappedAssetId) {
      showToast('请先创建或关联角色', 'warning');
      return;
    }

    setIsGenerating(true);
    try {
      const asset = await storageService.getAsset(scriptChar.mappedAssetId, projectId) as CharacterAsset;
      if (!asset) {
        showToast('角色资源不存在', 'error');
        return;
      }

      // Open character detail for generation
      // This would typically navigate to CharacterDetail or open a modal
      showToast('请在角色详情页生成图像', 'info');
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Get mapped asset info
  const getMappedAsset = (assetId?: string): CharacterAsset | undefined => {
    if (!assetId) return undefined;
    return existingCharacters.find(c => c.id === assetId);
  };

  // Helper to map age string to age group
  // Supports: "18", "18岁", "十八岁", "young", etc.
  const mapAgeToGroup = (age?: string): CharacterAsset['ageGroup'] => {
    if (!age) return 'unknown';

    // Remove common suffixes and whitespace
    const cleanAge = age.replace(/[岁\s]/g, '').trim();

    // Try to parse as number first
    let ageNum = parseInt(cleanAge);

    // If not a number, try to convert Chinese numbers
    if (isNaN(ageNum)) {
      const chineseNumbers: Record<string, number> = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
        '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
        '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
        '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
        '三十': 30, '四十': 40, '五十': 50, '六十': 60, '七十': 70,
        '八十': 80, '九十': 90
      };

      // Try exact match first
      if (chineseNumbers[cleanAge]) {
        ageNum = chineseNumbers[cleanAge];
      } else {
        // Try to parse combined Chinese numbers (e.g., "二十五" -> 25)
        const match = cleanAge.match(/^(十?)([一二三四五六七八九]?)(十?)([一二三四五六七八九]?)$/);
        if (match) {
          let num = 0;
          if (match[1]) num += 10; // 十 prefix
          if (match[2]) num += chineseNumbers[match[2]] || 0; // first digit
          if (match[3] && !match[1]) num += 10; // 十 suffix (like 二十)
          if (match[3] && match[1]) num *= 10; //  prefix (like 十一)
          if (match[4]) num += chineseNumbers[match[4]] || 0; // second digit
          if (num > 0) ageNum = num;
        }
      }
    }

    // Try keyword matching for non-numeric descriptions
    const lowerAge = age.toLowerCase();
    if (lowerAge.includes('child') || lowerAge.includes('kid') || lowerAge.includes('少年')) {
      return 'childhood';
    }
    if (lowerAge.includes('young') || lowerAge.includes('youth') || lowerAge.includes('青年')) {
      return 'youth';
    }
    if (lowerAge.includes('middle') || lowerAge.includes('中年')) {
      return 'middle_aged';
    }
    if (lowerAge.includes('old') || lowerAge.includes('elder') || lowerAge.includes('老年')) {
      return 'elderly';
    }

    // If still not a number, return unknown
    if (isNaN(ageNum)) return 'unknown';

    // Map age number to group
    if (ageNum < 13) return 'childhood';
    if (ageNum < 30) return 'youth';
    if (ageNum < 50) return 'middle_aged';
    return 'elderly';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">角色映射</h3>
          <p className="text-sm text-default-500">
            共 {scriptCharacters.length} 个角色，
            已关联 {scriptCharacters.filter(c => c.mappedAssetId).length} 个
          </p>
        </div>
        <Button
          color="primary"
          size="sm"
          startContent={<Plus size={16} />}
          onPress={() => {
            // Batch create all unmapped characters
            const unmapped = scriptCharacters.filter(c => !c.mappedAssetId);
            if (unmapped.length === 0) {
              showToast('所有角色已关联', 'info');
              return;
            }
            Promise.all(unmapped.map(c => handleCreateCharacter(c)));
          }}
        >
          批量创建未关联角色
        </Button>
      </div>

      {/* Character Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scriptCharacters.map((char) => {
          const mappedAsset = getMappedAsset(char.mappedAssetId);
          const hasImage = mappedAsset?.currentImageId || mappedAsset?.generatedImages?.length;

          return (
            <Card key={char.name} className="relative">
              <CardBody className="p-4">
                {/* Character Header */}
                <div className="flex items-start gap-3 mb-3">
                  <Avatar
                    src={hasImage ? undefined : undefined}
                    fallback={<User size={24} />}
                    className="w-12 h-12"
                    showFallback
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-lg truncate">{char.name}</h4>
                    <div className="flex gap-1 flex-wrap">
                      {char.gender && (
                        <Chip size="sm" variant="flat">
                          {char.gender === 'male' ? '男' : char.gender === 'female' ? '女' : '未知'}
                        </Chip>
                      )}
                      {char.age && (
                        <Chip size="sm" variant="flat" color="secondary">
                          {char.age}
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

                {/* Character Info */}
                <div className="space-y-2 text-sm mb-3">
                  {char.identity && (
                    <p className="text-default-600">
                      <span className="font-medium">身份：</span>{char.identity}
                    </p>
                  )}
                  {char.personality?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {char.personality.slice(0, 3).map((p, i) => (
                        <Chip key={i} size="sm" variant="bordered">{p}</Chip>
                      ))}
                    </div>
                  )}
                  {char.visualPrompt && (
                    <p className="text-default-500 text-xs line-clamp-2">
                      {char.visualPrompt}
                    </p>
                  )}
                </div>

                {/* Mapping Controls */}
                <div className="space-y-2">
                  <Select
                    label="关联到现有角色"
                    placeholder="选择现有角色或留空"
                    selectedKeys={char.mappedAssetId ? new Set([char.mappedAssetId]) : new Set()}
                    onChange={(e) => handleMapCharacter(char, e.target.value)}
                    size="sm"
                  >
                    <SelectItem key="" value="">不关联</SelectItem>
                    {existingCharacters.map(asset => (
                      <SelectItem key={asset.id} value={asset.id}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </Select>

                  <div className="flex gap-2">
                    {!char.mappedAssetId && (
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<Plus size={14} />}
                        onPress={() => handleCreateCharacter(char)}
                        className="flex-1"
                      >
                        创建角色
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<Edit2 size={14} />}
                      onPress={() => {
                        setSelectedCharacter(char);
                        setIsEditModalOpen(true);
                      }}
                      className="flex-1"
                    >
                      编辑
                    </Button>
                    {char.mappedAssetId && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="secondary"
                        startContent={<Wand2 size={14} />}
                        onPress={() => handleGenerateImage(char)}
                        isLoading={isGenerating}
                      >
                        生图
                      </Button>
                    )}
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
          {selectedCharacter && (
            <>
              <ModalHeader>编辑角色 - {selectedCharacter.name}</ModalHeader>
              <ModalBody className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="姓名"
                    value={selectedCharacter.name}
                    isReadOnly
                  />
                  <Input
                    label="年龄"
                    value={selectedCharacter.age || ''}
                    onChange={(e) => setSelectedCharacter({ ...selectedCharacter, age: e.target.value })}
                  />
                  <Select
                    label="性别"
                    selectedKeys={selectedCharacter.gender ? new Set([selectedCharacter.gender]) : new Set()}
                    onChange={(e) => setSelectedCharacter({ ...selectedCharacter, gender: e.target.value as any })}
                  >
                    <SelectItem key="male" value="male">男</SelectItem>
                    <SelectItem key="female" value="female">女</SelectItem>
                    <SelectItem key="unknown" value="unknown">未知</SelectItem>
                  </Select>
                  <Input
                    label="身份"
                    value={selectedCharacter.identity || ''}
                    onChange={(e) => setSelectedCharacter({ ...selectedCharacter, identity: e.target.value })}
                  />
                </div>

                <Textarea
                  label="外貌描述"
                  value={JSON.stringify(selectedCharacter.appearance, null, 2)}
                  onChange={(e) => {
                    try {
                      const appearance = JSON.parse(e.target.value);
                      setSelectedCharacter({ ...selectedCharacter, appearance });
                    } catch { }
                  }}
                  minRows={4}
                />

                <Textarea
                  label="性格特征（逗号分隔）"
                  value={selectedCharacter.personality?.join(', ') || ''}
                  onChange={(e) => setSelectedCharacter({
                    ...selectedCharacter,
                    personality: e.target.value.split(',').map(p => p.trim()).filter(Boolean)
                  })}
                />

                <Textarea
                  label="视觉提示词（用于AI生图）"
                  value={selectedCharacter.visualPrompt || ''}
                  onChange={(e) => setSelectedCharacter({ ...selectedCharacter, visualPrompt: e.target.value })}
                  minRows={3}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setIsEditModalOpen(false)}>
                  取消
                </Button>
                <Button color="primary" onPress={() => handleUpdateCharacter(selectedCharacter)}>
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
