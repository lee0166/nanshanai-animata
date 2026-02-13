import React, { useState, useMemo } from 'react';
import { Shot, ScriptCharacter, ScriptScene, FragmentAsset, AssetType, CharacterAsset, SceneAsset } from '../../types';
import { storageService } from '../../services/storage';
import { useApp } from '../../contexts/context';
import { useToast } from '../../contexts/ToastContext';
import { aiService } from '../../services/aiService';
import { jobQueue } from '../../services/queue';
import {
  Card,
  CardBody,
  Button,
  Chip,
  Progress,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Select,
  SelectItem,
  Checkbox,
  Divider
} from "@heroui/react";
import { Film, Play, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface ShotToFragmentProps {
  projectId: string;
  shots: Shot[];
  scriptCharacters: ScriptCharacter[];
  scriptScenes: ScriptScene[];
  existingCharacters: CharacterAsset[];
  existingScenes: SceneAsset[];
  onFragmentsCreated?: (fragments: FragmentAsset[]) => void;
}

export const ShotToFragment: React.FC<ShotToFragmentProps> = ({
  projectId,
  shots,
  scriptCharacters,
  scriptScenes,
  existingCharacters,
  existingScenes,
  onFragmentsCreated
}) => {
  const { t, settings } = useApp();
  const { showToast } = useToast();
  const [selectedShots, setSelectedShots] = useState<Set<string>>(new Set());
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [videoModelId, setVideoModelId] = useState<string>('');

  // Get video models
  const videoModels = useMemo(() => {
    return settings.models.filter(m => m.type === 'video');
  }, [settings.models]);

  // Set default video model
  React.useEffect(() => {
    if (videoModels.length > 0 && !videoModelId) {
      setVideoModelId(videoModels[0].id);
    }
  }, [videoModels, videoModelId]);

  // Toggle shot selection
  const toggleShotSelection = (shotId: string) => {
    const newSet = new Set(selectedShots);
    if (newSet.has(shotId)) {
      newSet.delete(shotId);
    } else {
      newSet.add(shotId);
    }
    setSelectedShots(newSet);
  };

  // Select all shots
  const selectAllShots = () => {
    if (selectedShots.size === shots.length) {
      setSelectedShots(new Set());
    } else {
      setSelectedShots(new Set(shots.map(s => s.id)));
    }
  };

  // Get character ID from script character name
  const getCharacterId = (characterName: string): string | undefined => {
    const scriptChar = scriptCharacters.find(c => c.name === characterName);
    if (scriptChar?.mappedAssetId) {
      return scriptChar.mappedAssetId;
    }
    // Try to find by name in existing characters
    const existingChar = existingCharacters.find(c => c.name === characterName);
    return existingChar?.id;
  };

  // Get scene ID from script scene name
  const getSceneId = (sceneName: string): string | undefined => {
    const scriptScene = scriptScenes.find(s => s.name === sceneName);
    if (scriptScene?.mappedAssetId) {
      return scriptScene.mappedAssetId;
    }
    // Try to find by name in existing scenes
    const existingScene = existingScenes.find(s => s.name === sceneName);
    return existingScene?.id;
  };

  // Map shot type to aspect ratio
  const mapShotTypeToRatio = (shotType: string): string => {
    switch (shotType) {
      case 'extreme_long':
      case 'long':
        return '16:9';
      case 'full':
        return '16:9';
      case 'medium':
        return '16:9';
      case 'close_up':
      case 'extreme_close_up':
        return '9:16';
      default:
        return '16:9';
    }
  };

  // Convert shots to fragments
  const convertToFragments = async () => {
    if (selectedShots.size === 0) {
      showToast('请至少选择一个分镜', 'warning');
      return;
    }

    if (!videoModelId) {
      showToast('请选择视频生成模型', 'warning');
      return;
    }

    setIsConverting(true);
    setProgress(0);
    setShowConfirmModal(false);

    const selectedShotsList = shots.filter(s => selectedShots.has(s.id));
    const createdFragments: FragmentAsset[] = [];

    try {
      for (let i = 0; i < selectedShotsList.length; i++) {
        const shot = selectedShotsList[i];
        setProgress(Math.round((i / selectedShotsList.length) * 100));

        // Get character IDs
        const characterIds = shot.characters
          ?.map(name => getCharacterId(name))
          .filter((id): id is string => !!id) || [];

        // Get scene ID
        const sceneId = getSceneId(shot.sceneName);

        // Create fragment asset
        const fragment: FragmentAsset = {
          id: `fragment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          projectId,
          type: AssetType.VIDEO_SEGMENT,
          name: `${shot.sceneName}_${shot.sequence}`,
          prompt: shot.description,
          metadata: {
            selectedCharacters: characterIds,
            selectedScene: sceneId,
            duration: shot.duration,
            ratio: mapShotTypeToRatio(shot.shotType),
            shotType: shot.shotType,
            cameraMovement: shot.cameraMovement,
            dialogue: shot.dialogue,
            sound: shot.sound,
            modelId: videoModelId
          },
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await storageService.saveAsset(fragment);
        createdFragments.push(fragment);

        // Update shot's mapped fragment ID
        shot.mappedFragmentId = fragment.id;
      }

      setProgress(100);
      showToast(`成功创建 ${createdFragments.length} 个视频片段`, 'success');
      onFragmentsCreated?.(createdFragments);
      setSelectedShots(new Set());
    } catch (error: any) {
      showToast(`创建失败: ${error.message}`, 'error');
    } finally {
      setIsConverting(false);
    }
  };

  // Generate videos for fragments
  const generateVideos = async () => {
    if (selectedShots.size === 0) {
      showToast('请至少选择一个分镜', 'warning');
      return;
    }

    if (!videoModelId) {
      showToast('请选择视频生成模型', 'warning');
      return;
    }

    const model = settings.models.find(m => m.id === videoModelId);
    if (!model) {
      showToast('所选模型不存在', 'error');
      return;
    }

    setIsConverting(true);
    setProgress(0);

    const selectedShotsList = shots.filter(s => selectedShots.has(s.id));

    try {
      for (let i = 0; i < selectedShotsList.length; i++) {
        const shot = selectedShotsList[i];
        setProgress(Math.round((i / selectedShotsList.length) * 100));

        // Get character IDs
        const characterIds = shot.characters
          ?.map(name => getCharacterId(name))
          .filter((id): id is string => !!id) || [];

        // Get scene ID
        const sceneId = getSceneId(shot.sceneName);

        // Get reference images
        const refImages: string[] = [];
        
        // Add character images
        for (const charId of characterIds) {
          const char = existingCharacters.find(c => c.id === charId);
          if (char?.filePath) {
            refImages.push(char.filePath);
          }
        }

        // Add scene image
        if (sceneId) {
          const scene = existingScenes.find(s => s.id === sceneId);
          if (scene?.filePath) {
            refImages.push(scene.filePath);
          }
        }

        // Create generation job
        const jobs = aiService.createVideoGenerationJobs(
          model,
          {
            projectId,
            prompt: shot.description,
            userPrompt: shot.description,
            assetName: `${shot.sceneName}_${shot.sequence}`,
            assetType: AssetType.VIDEO_SEGMENT,
            assetId: `temp_${shot.id}`,
            duration: shot.duration,
            ratio: mapShotTypeToRatio(shot.shotType),
            referenceImages: refImages.length > 0 ? refImages : undefined,
            extraParams: {
              shotType: shot.shotType,
              cameraMovement: shot.cameraMovement,
              dialogue: shot.dialogue,
              sound: shot.sound
            }
          },
          1
        );

        await jobQueue.addJobs(jobs);
      }

      setProgress(100);
      showToast(`已提交 ${selectedShotsList.length} 个视频生成任务`, 'success');
      setSelectedShots(new Set());
    } catch (error: any) {
      showToast(`生成失败: ${error.message}`, 'error');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold">分镜转片段</h3>
          <p className="text-sm text-default-500">
            已选择 {selectedShots.size} 个分镜
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            label="视频模型"
            selectedKeys={videoModelId ? new Set([videoModelId]) : new Set()}
            onChange={(e) => setVideoModelId(e.target.value)}
            size="sm"
            className="w-48"
          >
            {videoModels.map(model => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </Select>
          <Button
            size="sm"
            variant="flat"
            onPress={selectAllShots}
          >
            {selectedShots.size === shots.length ? '取消全选' : '全选'}
          </Button>
        </div>
      </div>

      {/* Shot Selection Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {shots.map((shot) => (
          <Card
            key={shot.id}
            className={`cursor-pointer transition-all ${
              selectedShots.has(shot.id) ? 'ring-2 ring-primary' : ''
            }`}
            onPress={() => toggleShotSelection(shot.id)}
            isPressable
          >
            <CardBody className="p-3">
              <div className="flex items-start gap-2">
                <Checkbox isSelected={selectedShots.has(shot.id)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-sm">#{shot.sequence}</span>
                    <Chip size="sm" variant="flat">{shot.sceneName}</Chip>
                  </div>
                  <p className="text-xs text-default-600 line-clamp-2 mt-1">
                    {shot.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-default-500">
                    <span>{shot.duration}秒</span>
                    {shot.mappedFragmentId && (
                      <CheckCircle2 size={12} className="text-success" />
                    )}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          color="primary"
          startContent={<Film size={18} />}
          onPress={() => setShowConfirmModal(true)}
          isDisabled={selectedShots.size === 0 || isConverting}
          className="flex-1"
        >
          创建片段
        </Button>
        <Button
          color="secondary"
          startContent={<Play size={18} />}
          onPress={generateVideos}
          isDisabled={selectedShots.size === 0 || isConverting}
          className="flex-1"
        >
          直接生成视频
        </Button>
      </div>

      {/* Progress */}
      {isConverting && (
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-center text-default-500">
            正在处理... {progress}%
          </p>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)}>
        <ModalContent>
          <ModalHeader>确认创建片段</ModalHeader>
          <ModalBody>
            <p>即将创建 {selectedShots.size} 个视频片段</p>
            <div className="mt-4 space-y-2">
              <p className="text-sm text-default-500">创建后将：</p>
              <ul className="text-sm text-default-500 list-disc list-inside">
                <li>生成对应的 FragmentAsset</li>
                <li>自动关联角色和场景</li>
                <li>设置画幅比例和时长</li>
              </ul>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setShowConfirmModal(false)}>
              取消
            </Button>
            <Button color="primary" onPress={convertToFragments}>
              确认创建
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
