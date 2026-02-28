import React, { useState } from 'react';
import { ScriptScene, SceneAsset, AssetType } from '../../types';
import { storageService } from '../../services/storage';
import { useApp } from '../../contexts/context';
import { useToast } from '../../contexts/ToastContext';
import { ScenePromptBuilder } from '../../services/promptBuilder';
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
import { MapPin, Link2, Plus, Edit2, Wand2, CheckCircle2, Home, Sun, Cloud } from 'lucide-react';

interface SceneMappingProps {
  projectId: string;
  scriptId: string;  // 当前剧本ID
  scriptScenes: ScriptScene[];
  existingScenes: SceneAsset[];
  onScenesUpdate: (scenes: ScriptScene[]) => void;
  onSceneCreated?: () => void;
}

export const SceneMapping: React.FC<SceneMappingProps> = ({
  projectId,
  scriptId,
  scriptScenes,
  existingScenes,
  onScenesUpdate,
  onSceneCreated
}) => {
  const { t, settings } = useApp();
  const { showToast } = useToast();
  const [selectedScene, setSelectedScene] = useState<ScriptScene | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

  // Handle mapping script scene to existing asset
  const handleMapScene = (scriptScene: ScriptScene, assetId: string) => {
    const updated = scriptScenes.map(s =>
      s.name === scriptScene.name ? { ...s, mappedAssetId: assetId || undefined } : s
    );
    onScenesUpdate(updated);
    showToast(assetId ? '已关联现有场景' : '已取消关联', 'success');
  };

  // Handle creating new scene asset from script scene
  const handleCreateScene = async (scriptScene: ScriptScene) => {
    try {
      // 使用PromptBuilder生成纯净的提示词
      const generatedPrompt = ScenePromptBuilder.build(scriptScene);
      
      const newScene: SceneAsset = {
        id: `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        projectId,
        scriptId,  // 关联当前剧本
        type: AssetType.SCENE,
        name: scriptScene.name,
        prompt: generatedPrompt,
        metadata: {
          locationType: scriptScene.locationType,
          timeOfDay: scriptScene.timeOfDay,
          season: scriptScene.season,
          weather: scriptScene.weather,
          environment: scriptScene.environment,
          sceneFunction: scriptScene.sceneFunction,
          characters: scriptScene.characters,
          visualPrompt: scriptScene.visualPrompt // 保留原始visualPrompt作为参考
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await storageService.saveAsset(newScene);

      // Update mapping
      const updated = scriptScenes.map(s =>
        s.name === scriptScene.name ? { ...s, mappedAssetId: newScene.id } : s
      );
      onScenesUpdate(updated);

      // Notify parent to refresh existing scenes list
      onSceneCreated?.();

      showToast(`场景 "${scriptScene.name}" 创建成功`, 'success');
    } catch (error: any) {
      showToast(`创建失败: ${error.message}`, 'error');
    }
  };

  // Handle updating script scene details
  const handleUpdateScene = (updated: ScriptScene) => {
    const updatedList = scriptScenes.map(s =>
      s.name === updated.name ? updated : s
    );
    onScenesUpdate(updatedList);
    setIsEditModalOpen(false);
    showToast('场景信息已更新', 'success');
  };

  // Get mapped asset info
  const getMappedAsset = (assetId?: string): SceneAsset | undefined => {
    if (!assetId) return undefined;
    return existingScenes.find(s => s.id === assetId);
  };

  // Get location type icon
  const getLocationIcon = (type?: string) => {
    switch (type) {
      case 'indoor': return <Home size={16} />;
      case 'outdoor': return <Sun size={16} />;
      default: return <MapPin size={16} />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">场景映射</h3>
          <p className="text-sm text-default-500">
            共 {scriptScenes.length} 个场景，
            已关联 {scriptScenes.filter(s => s.mappedAssetId).length} 个
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={viewMode === 'grid' ? 'solid' : 'flat'}
            onPress={() => setViewMode('grid')}
          >
            网格
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'timeline' ? 'solid' : 'flat'}
            onPress={() => setViewMode('timeline')}
          >
            时间线
          </Button>
          <Button
            color="primary"
            size="sm"
            startContent={<Plus size={16} />}
            onPress={() => {
              const unmapped = scriptScenes.filter(s => !s.mappedAssetId);
              if (unmapped.length === 0) {
                showToast('所有场景已关联', 'info');
                return;
              }
              Promise.all(unmapped.map(s => handleCreateScene(s)));
            }}
          >
            批量创建
          </Button>
        </div>
      </div>

      {/* Scene Cards Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scriptScenes.map((scene) => {
            const mappedAsset = getMappedAsset(scene.mappedAssetId);
            const hasImage = mappedAsset?.currentImageId || mappedAsset?.generatedImages?.length;

            return (
              <Card key={scene.name} className="relative">
                <CardBody className="p-4">
                  {/* Scene Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-full bg-default-100 flex items-center justify-center">
                      {getLocationIcon(scene.locationType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-lg truncate">{scene.name}</h4>
                      <div className="flex gap-1 flex-wrap">
                        {scene.locationType && (
                          <Chip size="sm" variant="flat">
                            {scene.locationType === 'indoor' ? '室内' : scene.locationType === 'outdoor' ? '室外' : '未知'}
                          </Chip>
                        )}
                        {scene.timeOfDay && (
                          <Chip size="sm" variant="flat" color="warning">
                            {scene.timeOfDay}
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

                  {/* Scene Info */}
                  <div className="space-y-2 text-sm mb-3">
                    {scene.description && (
                      <p className="text-default-600 line-clamp-2">
                        {scene.description}
                      </p>
                    )}
                    {scene.environment?.architecture && (
                      <p className="text-default-500 text-xs">
                        <span className="font-medium">建筑：</span>{scene.environment.architecture}
                      </p>
                    )}
                    {scene.characters?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {scene.characters.slice(0, 3).map((char, i) => (
                          <Chip key={i} size="sm" variant="bordered">{char}</Chip>
                        ))}
                        {scene.characters.length > 3 && (
                          <Chip size="sm" variant="bordered">+{scene.characters.length - 3}</Chip>
                        )}
                      </div>
                    )}
                    {scene.visualPrompt && (
                      <p className="text-default-500 text-xs line-clamp-2">
                        {scene.visualPrompt}
                      </p>
                    )}
                  </div>

                  {/* Mapping Controls */}
                  <div className="space-y-2">
                    <Select
                      label="关联到现有场景"
                      placeholder="选择现有场景或留空"
                      selectedKeys={scene.mappedAssetId ? new Set([scene.mappedAssetId]) : new Set()}
                      onChange={(e) => handleMapScene(scene, e.target.value)}
                      size="sm"
                    >
                      <SelectItem key="" value="">不关联</SelectItem>
                      {existingScenes.map(asset => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.name}
                        </SelectItem>
                      ))}
                    </Select>

                    <div className="flex gap-2">
                      {!scene.mappedAssetId && (
                        <Button
                          size="sm"
                          color="primary"
                          variant="flat"
                          startContent={<Plus size={14} />}
                          onPress={() => handleCreateScene(scene)}
                          className="flex-1"
                        >
                          创建场景
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="flat"
                        startContent={<Edit2 size={14} />}
                        onPress={() => {
                          setSelectedScene(scene);
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
      ) : (
        /* Timeline View */
        <div className="space-y-4">
          {scriptScenes.map((scene, index) => {
            const mappedAsset = getMappedAsset(scene.mappedAssetId);
            return (
              <div key={scene.name} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold">
                    {index + 1}
                  </div>
                  {index < scriptScenes.length - 1 && (
                    <div className="w-0.5 h-full bg-default-200 my-2" />
                  )}
                </div>
                <Card className="flex-1">
                  <CardBody className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-lg">{scene.name}</h4>
                        <div className="flex gap-2 mt-1">
                          {scene.locationType && (
                            <Chip size="sm" variant="flat">
                              {scene.locationType === 'indoor' ? '室内' : scene.locationType === 'outdoor' ? '室外' : '未知'}
                            </Chip>
                          )}
                          {scene.timeOfDay && (
                            <Chip size="sm" variant="flat" color="warning">
                              {scene.timeOfDay}
                            </Chip>
                          )}
                          {mappedAsset && (
                            <Chip size="sm" color="success" variant="flat">
                              已关联
                            </Chip>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!scene.mappedAssetId && (
                          <Button
                            size="sm"
                            color="primary"
                            variant="flat"
                            startContent={<Plus size={14} />}
                            onPress={() => handleCreateScene(scene)}
                          >
                            创建
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="flat"
                          startContent={<Edit2 size={14} />}
                          onPress={() => {
                            setSelectedScene(scene);
                            setIsEditModalOpen(true);
                          }}
                        >
                          编辑
                        </Button>
                      </div>
                    </div>
                    <p className="text-default-600 text-sm mt-2 line-clamp-2">
                      {scene.description}
                    </p>
                  </CardBody>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} size="2xl">
        <ModalContent>
          {selectedScene && (
            <>
              <ModalHeader>编辑场景 - {selectedScene.name}</ModalHeader>
              <ModalBody className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="场景名称"
                    value={selectedScene.name}
                    isReadOnly
                  />
                  <Select
                    label="地点类型"
                    selectedKeys={selectedScene.locationType ? new Set([selectedScene.locationType]) : new Set()}
                    onChange={(e) => setSelectedScene({ ...selectedScene, locationType: e.target.value as any })}
                  >
                    <SelectItem key="indoor" value="indoor">室内</SelectItem>
                    <SelectItem key="outdoor" value="outdoor">室外</SelectItem>
                    <SelectItem key="unknown" value="unknown">未知</SelectItem>
                  </Select>
                  <Input
                    label="时间段"
                    value={selectedScene.timeOfDay || ''}
                    onChange={(e) => setSelectedScene({ ...selectedScene, timeOfDay: e.target.value })}
                    placeholder="如：清晨、正午、黄昏、夜晚"
                  />
                  <Input
                    label="季节"
                    value={selectedScene.season || ''}
                    onChange={(e) => setSelectedScene({ ...selectedScene, season: e.target.value })}
                  />
                  <Input
                    label="天气"
                    value={selectedScene.weather || ''}
                    onChange={(e) => setSelectedScene({ ...selectedScene, weather: e.target.value })}
                  />
                </div>

                <Textarea
                  label="场景描述"
                  value={selectedScene.description}
                  onChange={(e) => setSelectedScene({ ...selectedScene, description: e.target.value })}
                  minRows={3}
                />

                <Textarea
                  label="环境细节"
                  value={JSON.stringify(selectedScene.environment, null, 2)}
                  onChange={(e) => {
                    try {
                      const environment = JSON.parse(e.target.value);
                      setSelectedScene({ ...selectedScene, environment });
                    } catch { }
                  }}
                  minRows={4}
                />

                <Textarea
                  label="视觉提示词（用于AI生图）"
                  value={selectedScene.visualPrompt || ''}
                  onChange={(e) => setSelectedScene({ ...selectedScene, visualPrompt: e.target.value })}
                  minRows={3}
                />

                <Input
                  label="涉及角色（逗号分隔）"
                  value={selectedScene.characters?.join(', ') || ''}
                  onChange={(e) => setSelectedScene({
                    ...selectedScene,
                    characters: e.target.value.split(',').map(c => c.trim()).filter(Boolean)
                  })}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setIsEditModalOpen(false)}>
                  取消
                </Button>
                <Button color="primary" onPress={() => handleUpdateScene(selectedScene)}>
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
