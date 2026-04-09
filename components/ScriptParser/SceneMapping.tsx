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
  Chip,
} from '@heroui/react';
import { MapPin, Link2, Plus, Edit2, Wand2, CheckCircle2, Home, Sun, Cloud } from 'lucide-react';

interface SceneMappingProps {
  projectId: string;
  scriptId: string; // 当前剧本ID
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
  onSceneCreated,
}) => {
  const { t, settings } = useApp();
  const { showToast } = useToast();
  const [selectedScene, setSelectedScene] = useState<ScriptScene | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [isGenerating, setIsGenerating] = useState(false);
  const [creatingScenes, setCreatingScenes] = useState<Set<string>>(new Set());

  // Handle mapping script scene to existing asset
  const handleMapScene = (scriptScene: ScriptScene, assetId: string) => {
    const updated = scriptScenes.map(s =>
      s.name === scriptScene.name ? { ...s, mappedAssetId: assetId || undefined } : s
    );
    onScenesUpdate(updated);
    showToast(assetId ? '已关联现有场景' : '已取消关联', 'success');
  };

  // 纯创建逻辑 - 只创建资产，不更新状态
  const createSceneAsset = async (scriptScene: ScriptScene): Promise<string> => {
    const generatedPrompt = ScenePromptBuilder.build(scriptScene);

    const newScene: SceneAsset = {
      id: `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      scriptId, // 关联当前剧本
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
        visualPrompt: scriptScene.visualPrompt,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await storageService.saveAsset(newScene);
    return newScene.id;
  };

  // Handle creating new scene asset from script scene
  const handleCreateScene = async (scriptScene: ScriptScene) => {
    // 防止重复创建
    if (creatingScenes.has(scriptScene.name) || scriptScene.mappedAssetId) {
      return;
    }

    setCreatingScenes(prev => new Set(prev).add(scriptScene.name));
    try {
      // 1. 创建资产（不更新状态）
      const assetId = await createSceneAsset(scriptScene);

      // 2. 更新状态
      const updated = scriptScenes.map(s =>
        s.name === scriptScene.name ? { ...s, mappedAssetId: assetId } : s
      );

      // 3. 持久化到存储
      await storageService.updateScriptParseState(scriptId, projectId, parseState => ({
        ...parseState,
        scenes: updated,
      }));

      // 4. 更新UI状态
      onScenesUpdate(updated);

      // 5. 通知父组件刷新
      onSceneCreated?.();

      showToast(`场景 "${scriptScene.name}" 创建成功`, 'success');
    } catch (error: any) {
      showToast(`创建失败: ${error.message}`, 'error');
    } finally {
      setCreatingScenes(prev => {
        const next = new Set(prev);
        next.delete(scriptScene.name);
        return next;
      });
    }
  };

  // 批量创建场景 - 彻底修复竞态条件
  const handleBatchCreateScenes = async () => {
    // 过滤掉已关联和正在创建中的场景
    const unmapped = scriptScenes.filter(s => !s.mappedAssetId && !creatingScenes.has(s.name));
    if (unmapped.length === 0) {
      showToast('所有场景已关联', 'info');
      return;
    }

    // 防止重复批量创建
    if (isGenerating) {
      return;
    }

    setIsGenerating(true);
    console.log(`[SceneMapping] ========== 开始批量创建场景 ==========`);
    console.log(`[SceneMapping] 待创建场景数量: ${unmapped.length}`);
    console.log(`[SceneMapping] 场景列表: ${unmapped.map(s => s.name).join(', ')}`);

    const createdMappings: { name: string; assetId: string }[] = [];
    const failedScenes: string[] = [];
    const startTime = Date.now();

    try {
      // 第一步：串行创建所有资产（不更新状态）
      for (let i = 0; i < unmapped.length; i++) {
        const scene = unmapped[i];
        // 双重检查：跳过正在创建中的场景
        if (creatingScenes.has(scene.name)) {
          console.log(`[SceneMapping] 跳过正在创建中的场景: ${scene.name}`);
          continue;
        }
        console.log(`[SceneMapping] [${i + 1}/${unmapped.length}] 创建场景: ${scene.name}`);
        try {
          const assetId = await createSceneAsset(scene); // 只创建，不更新状态
          createdMappings.push({ name: scene.name, assetId });
          console.log(
            `[SceneMapping] [${i + 1}/${unmapped.length}] 场景 ${scene.name} 创建成功，ID: ${assetId}`
          );
        } catch (error) {
          console.error(`[SceneMapping] 创建场景 ${scene.name} 失败:`, error);
          failedScenes.push(scene.name);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[SceneMapping] 批量创建完成，耗时: ${duration}ms`);
      console.log(`[SceneMapping] 成功: ${createdMappings.length}/${unmapped.length}`);
      console.log(`[SceneMapping] 失败: ${failedScenes.length}/${unmapped.length}`);

      // 第二步：统一更新所有状态（只更新一次）
      if (createdMappings.length > 0) {
        const updated = scriptScenes.map(s => {
          const mapping = createdMappings.find(m => m.name === s.name);
          return mapping ? { ...s, mappedAssetId: mapping.assetId } : s;
        });

        // 持久化到存储
        await storageService.updateScriptParseState(scriptId, projectId, parseState => ({
          ...parseState,
          scenes: updated,
        }));

        onScenesUpdate(updated); // 关键：只更新一次
        onSceneCreated?.();

        if (failedScenes.length > 0) {
          showToast(
            `成功创建 ${createdMappings.length} 个场景，${failedScenes.length} 个失败`,
            'warning'
          );
        } else {
          showToast(`成功创建 ${createdMappings.length} 个场景`, 'success');
        }
      } else {
        showToast('创建失败，请重试', 'error');
      }
    } catch (error) {
      console.error('[SceneMapping] 批量创建场景失败:', error);
      showToast('批量创建失败', 'error');
    } finally {
      setIsGenerating(false);
      console.log(`[SceneMapping] ========== 批量创建场景结束 ==========`);
    }
  };

  // Handle updating script scene details
  const handleUpdateScene = (updated: ScriptScene) => {
    const updatedList = scriptScenes.map(s => (s.name === updated.name ? updated : s));
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
      case 'indoor':
        return <Home size={16} />;
      case 'outdoor':
        return <Sun size={16} />;
      default:
        return <MapPin size={16} />;
    }
  };

  // 计算实际显示的视觉提示词
  const getActualVisualPrompt = (scene: ScriptScene): string => {
    // 如果用户已经手动编辑过，使用用户编辑的值
    if (scene.visualPrompt && !scene.visualPrompt.includes('的场景')) {
      return scene.visualPrompt;
    }
    // 否则用 ScenePromptBuilder 生成
    return ScenePromptBuilder.build(scene);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">场景映射</h3>
          <p className="text-sm text-default-500">
            共 {scriptScenes.length} 个场景， 已关联{' '}
            {scriptScenes.filter(s => s.mappedAssetId).length} 个
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
            onPress={handleBatchCreateScenes}
            isLoading={isGenerating}
            isDisabled={isGenerating}
          >
            批量创建
          </Button>
        </div>
      </div>

      {/* Scene Cards Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scriptScenes.map(scene => {
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
                          <Chip variant="flat">
                            {scene.locationType === 'indoor'
                              ? '室内'
                              : scene.locationType === 'outdoor'
                                ? '室外'
                                : '未知'}
                          </Chip>
                        )}
                        {scene.timeOfDay && (
                          <Chip variant="flat" color="warning">
                            {scene.timeOfDay}
                          </Chip>
                        )}
                        {mappedAsset && (
                          <Chip
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

                  {/* Scene Info */}
                  <div className="space-y-2 text-sm mb-3">
                    {scene.description && (
                      <p className="text-default-600 line-clamp-2">{scene.description}</p>
                    )}
                    {scene.environment?.architecture && (
                      <p className="text-default-500 text-xs">
                        <span className="font-medium">建筑：</span>
                        {scene.environment.architecture}
                      </p>
                    )}
                    {scene.characters?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {scene.characters.slice(0, 3).map((char, i) => (
                          <Chip key={i} variant="bordered">
                            {char}
                          </Chip>
                        ))}
                        {scene.characters.length > 3 && (
                          <Chip variant="bordered">+{scene.characters.length - 3}</Chip>
                        )}
                      </div>
                    )}
                    {scene.visualPrompt && (
                      <p className="text-default-500 text-xs line-clamp-2">{scene.visualPrompt}</p>
                    )}
                  </div>

                  {/* Mapping Controls */}
                  <div className="flex gap-2">
                    <Select
                      aria-label="关联场景"
                      placeholder="选择场景"
                      selectedKeys={
                        scene.mappedAssetId &&
                        existingScenes.some(s => s.id === scene.mappedAssetId)
                          ? new Set([scene.mappedAssetId])
                          : new Set()
                      }
                      onChange={e => handleMapScene(scene, e.target.value)}
                      size="sm"
                      className={scene.mappedAssetId ? 'flex-1' : 'w-1/3'}
                    >
                      <SelectItem key="" value="">
                        不关联
                      </SelectItem>
                      {existingScenes.map(asset => (
                        <SelectItem key={asset.id} value={asset.id}>
                          {asset.name}
                        </SelectItem>
                      ))}
                    </Select>

                    {!scene.mappedAssetId && (
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        startContent={<Plus size={14} />}
                        onPress={() => handleCreateScene(scene)}
                        isLoading={creatingScenes.has(scene.name)}
                        isDisabled={creatingScenes.has(scene.name)}
                        className="w-1/3"
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
                      className={scene.mappedAssetId ? 'flex-1' : 'w-1/3'}
                    >
                      编辑
                    </Button>
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
                            <Chip variant="flat">
                              {scene.locationType === 'indoor'
                                ? '室内'
                                : scene.locationType === 'outdoor'
                                  ? '室外'
                                  : '未知'}
                            </Chip>
                          )}
                          {scene.timeOfDay && (
                            <Chip variant="flat" color="warning">
                              {scene.timeOfDay}
                            </Chip>
                          )}
                          {mappedAsset && (
                            <Chip color="success" variant="flat">
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
                            isLoading={creatingScenes.has(scene.name)}
                            isDisabled={creatingScenes.has(scene.name)}
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
                  <Input label="场景名称" value={selectedScene.name} isReadOnly />
                  <Select
                    label="地点类型"
                    selectedKeys={
                      selectedScene.locationType ? new Set([selectedScene.locationType]) : new Set()
                    }
                    onChange={e =>
                      setSelectedScene({ ...selectedScene, locationType: e.target.value as any })
                    }
                  >
                    <SelectItem key="indoor" value="indoor">
                      室内
                    </SelectItem>
                    <SelectItem key="outdoor" value="outdoor">
                      室外
                    </SelectItem>
                    <SelectItem key="unknown" value="unknown">
                      未知
                    </SelectItem>
                  </Select>
                  <Input
                    label="时间段"
                    value={selectedScene.timeOfDay || ''}
                    onChange={e =>
                      setSelectedScene({ ...selectedScene, timeOfDay: e.target.value })
                    }
                    placeholder="如：清晨、正午、黄昏、夜晚"
                  />
                  <Input
                    label="季节"
                    value={selectedScene.season || ''}
                    onChange={e => setSelectedScene({ ...selectedScene, season: e.target.value })}
                  />
                  <Input
                    label="天气"
                    value={selectedScene.weather || ''}
                    onChange={e => setSelectedScene({ ...selectedScene, weather: e.target.value })}
                  />
                </div>

                <Textarea
                  label="场景描述"
                  value={selectedScene.description}
                  onChange={e =>
                    setSelectedScene({ ...selectedScene, description: e.target.value })
                  }
                  minRows={3}
                />

                <Textarea
                  label="环境细节"
                  value={JSON.stringify(selectedScene.environment, null, 2)}
                  onChange={e => {
                    try {
                      const environment = JSON.parse(e.target.value);
                      setSelectedScene({ ...selectedScene, environment });
                    } catch {}
                  }}
                  minRows={4}
                />

                <Textarea
                  label="视觉提示词（用于AI生图）"
                  value={getActualVisualPrompt(selectedScene)}
                  onChange={e =>
                    setSelectedScene({ ...selectedScene, visualPrompt: e.target.value })
                  }
                  minRows={3}
                />

                <Input
                  label="涉及角色（逗号分隔）"
                  value={selectedScene.characters?.join(', ') || ''}
                  onChange={e =>
                    setSelectedScene({
                      ...selectedScene,
                      characters: e.target.value
                        .split(',')
                        .map(c => c.trim())
                        .filter(Boolean),
                    })
                  }
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
