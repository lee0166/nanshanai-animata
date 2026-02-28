import React, { useState, useMemo, useEffect } from 'react';
import { Shot, ScriptScene, FragmentAsset, AssetType, Keyframe, CharacterAsset, Asset } from '../../types';
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
  Button,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  Input,
  Select,
  SelectItem,
  Card,
  CardBody,
  Tabs,
  Tab,
  Badge,
  Progress
} from "@heroui/react";
import { Film, Edit2, Trash2, Plus, Eye, Clock, Users, Camera, Move, Scissors, Image, CheckCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { keyframeService } from '../../services/keyframe';
import { storageService } from '../../services/storage';
import { useApp } from '../../contexts/context';

interface ShotListProps {
  shots: Shot[];
  scenes: ScriptScene[];
  onShotsUpdate: (shots: Shot[]) => void;
  onGenerateFragment?: (shot: Shot) => void;
  projectId: string; // 项目ID，用于查询资产
  scriptId?: string; // 剧本ID，用于过滤当前剧本的资产
  viewMode?: 'list' | 'manager'; // 视图模式：list-剧本管理页面（不显示拆分按钮），manager-分镜管理页面（显示拆分按钮）
  headerAction?: React.ReactNode; // 头部区域额外操作按钮
}

const SHOT_TYPE_LABELS: Record<string, string> = {
  extreme_long: '极远景',
  long: '远景',
  full: '全景',
  medium: '中景',
  close_up: '近景',
  extreme_close_up: '极近景'
};

const CAMERA_MOVEMENT_LABELS: Record<string, string> = {
  static: '固定',
  push: '推',
  pull: '拉',
  pan: '摇',
  tilt: '升降',
  track: '移',
  crane: '升降'
};

export const ShotList: React.FC<ShotListProps> = ({
  shots,
  scenes,
  onShotsUpdate,
  onGenerateFragment,
  projectId,
  scriptId,
  viewMode = 'list',
  headerAction
}) => {
  const { settings } = useApp();
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isKeyframeModalOpen, setIsKeyframeModalOpen] = useState(false);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveDirection, setMoveDirection] = useState<'up' | 'down' | null>(null);
  const [selectedScene, setSelectedScene] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<'table' | 'cards'>('table');
  const [splittingShotId, setSplittingShotId] = useState<string | null>(null);
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState(0);
  const [selectedLLMModel, setSelectedLLMModel] = useState<string>('');
  const [selectedImageModel, setSelectedImageModel] = useState<string>('');
  const [keyframeCount, setKeyframeCount] = useState<number>(3);
  const [projectAssets, setProjectAssets] = useState<{
    characters: CharacterAsset[];
    scenes: Asset[];
  }>({ characters: [], scenes: [] });
  
  // 展开/收起状态


  // 获取用户已配置的模型
  const availableLLMModels = useMemo(() => {
    return settings.models.filter(m => m.type === 'llm');
  }, [settings.models]);

  const availableImageModels = useMemo(() => {
    return settings.models.filter(m => m.type === 'image');
  }, [settings.models]);

  // 加载项目资产（严格按scriptId过滤，只加载当前剧本的资产）
  useEffect(() => {
    const loadProjectAssets = async () => {
      if (!projectId) return;
      try {
        const assets = await storageService.getAssets(projectId);
        // 严格按scriptId过滤：只加载当前剧本的资产
        // 注意：如果scriptId未提供，加载所有资产；如果提供了，只加载匹配的资产
        const filteredAssets = assets.filter(a => {
          if (!scriptId) return true; // 没有scriptId时加载所有（兼容旧代码）
          return a.scriptId === scriptId; // 严格匹配当前剧本
        });
        console.log('[ShotList] 加载资产:', { 
          scriptId, 
          totalAssets: assets.length, 
          filteredAssets: filteredAssets.length,
          scenes: filteredAssets.filter(a => a.type === AssetType.SCENE).map(s => s.name)
        });
        setProjectAssets({
          characters: filteredAssets.filter(a => a.type === AssetType.CHARACTER) as CharacterAsset[],
          scenes: filteredAssets.filter(a => a.type === AssetType.SCENE)
        });
      } catch (error) {
        console.error('加载项目资产失败:', error);
      }
    };
    loadProjectAssets();
  }, [projectId, scriptId]);

  // 根据名称查找角色资产
  const findCharacterByName = (name: string): CharacterAsset | undefined => {
    return projectAssets.characters.find(c => c.name === name);
  };

  // 根据名称查找场景资产
  const findSceneByName = (name: string): Asset | undefined => {
    return projectAssets.scenes.find(s => s.name === name);
  };

  // Filter shots by scene
  const filteredShots = useMemo(() => {
    if (selectedScene === 'all') return shots;
    return shots.filter(s => (s.sceneName || '未分类场景') === selectedScene);
  }, [shots, selectedScene]);

  // 从场景名称提取场景号
  const getSceneNumber = (sceneName: string) => {
    const match = sceneName.match(/场景(\d+)/);
    return match ? match[1] : '1';
  };



  // Group shots by scene
  const shotsByScene = useMemo(() => {
    const grouped: Record<string, Shot[]> = {};
    shots.forEach(shot => {
      // 处理 sceneName 为 undefined 或空字符串的情况
      const sceneName = shot.sceneName || '未分类场景';
      if (!grouped[sceneName]) {
        grouped[sceneName] = [];
      }
      grouped[sceneName].push(shot);
    });
    return grouped;
  }, [shots]);

  // Handle update shot
  const handleUpdateShot = (updated: Shot) => {
    const updatedList = shots.map(s =>
      s.id === updated.id ? updated : s
    );
    onShotsUpdate(updatedList);
    setIsEditModalOpen(false);
  };

  // Handle delete shot
  const handleDeleteShot = (shotId: string) => {
    const updatedList = shots.filter(s => s.id !== shotId);
    onShotsUpdate(updatedList);
    setIsDeleteModalOpen(false);
  };

  // Handle add new shot
  const handleAddShot = (sceneName: string) => {
    const sceneShots = shots.filter(s => s.sceneName === sceneName);
    const maxSequence = Math.max(...sceneShots.map(s => s.sequence), 0);
    
    const newShot: Shot = {
      id: `shot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sequence: maxSequence + 1,
      sceneName,
      shotType: 'medium',
      cameraMovement: 'static',
      description: '',
      duration: 3,
      characters: []
    };
    
    onShotsUpdate([...shots, newShot]);
  };

  // 重新计算所有分镜的sequence编号
  const recalculateSequences = (shotList: Shot[]): Shot[] => {
    // 按场景分组，每组内按当前顺序重新编号
    const grouped: Record<string, Shot[]> = {};
    shotList.forEach(shot => {
      if (!grouped[shot.sceneName]) {
        grouped[shot.sceneName] = [];
      }
      grouped[shot.sceneName].push(shot);
    });

    const updated: Shot[] = [];
    Object.values(grouped).forEach(sceneShots => {
      sceneShots.forEach((shot, index) => {
        updated.push({ ...shot, sequence: index + 1 });
      });
    });

    return updated;
  };

  // Handle move shot up
  const handleMoveUp = (shotId: string) => {
    const index = shots.findIndex(s => s.id === shotId);
    if (index <= 0) return; // 已经在最前面

    const newShots = [...shots];
    // 交换位置
    [newShots[index], newShots[index - 1]] = [newShots[index - 1], newShots[index]];
    
    // 重新计算sequence
    const updatedShots = recalculateSequences(newShots);
    onShotsUpdate(updatedShots);
  };

  // Handle move shot down
  const handleMoveDown = (shotId: string) => {
    const index = shots.findIndex(s => s.id === shotId);
    if (index >= shots.length - 1) return; // 已经在最后面

    const newShots = [...shots];
    // 交换位置
    [newShots[index], newShots[index + 1]] = [newShots[index + 1], newShots[index]];
    
    // 重新计算sequence
    const updatedShots = recalculateSequences(newShots);
    onShotsUpdate(updatedShots);
  };

  // Handle split keyframes
  const handleSplitKeyframes = async (shot: Shot) => {
    setSelectedShot(shot);
    setIsSplitModalOpen(true);
  };

  // Confirm split with selected model
  const confirmSplitKeyframes = async () => {
    if (!selectedShot) return;

    setIsSplitModalOpen(false);
    setSplittingShotId(selectedShot.id);

    try {
      // 根据名称查找角色和场景资产
      const characterAssets = selectedShot.characters
        .map(name => findCharacterByName(name))
        .filter((asset): asset is CharacterAsset => !!asset);

      const sceneAsset = findSceneByName(selectedShot.sceneName);

      const keyframes = await keyframeService.splitKeyframes({
        shot: selectedShot,
        keyframeCount: keyframeCount,
        projectId: projectId,
        characterAssets: characterAssets,
        sceneAsset: sceneAsset,
        modelConfigId: selectedLLMModel // 使用用户选择的模型
      });

      const updatedShot = { ...selectedShot, keyframes };
      handleUpdateShot(updatedShot);
      setSelectedShot(updatedShot);
      setIsKeyframeModalOpen(true);
    } catch (error) {
      console.error('拆分关键帧失败:', error);
    } finally {
      setSplittingShotId(null);
    }
  };

  // Get keyframe status display
  const getKeyframeStatus = (shot: Shot) => {
    if (splittingShotId === shot.id) {
      return { label: '拆分中...', color: 'primary', icon: <Scissors size={14} /> };
    }
    if (shot.keyframes && shot.keyframes.length > 0) {
      const completed = shot.keyframes.filter(kf => kf.status === 'completed').length;
      return { 
        label: `${completed}/${shot.keyframes.length} 已生成`, 
        color: 'success', 
        icon: <CheckCircle size={14} /> 
      };
    }
    return { label: '未拆分', color: 'default', icon: <Scissors size={14} /> };
  };

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return filteredShots.reduce((sum, shot) => sum + (shot.duration || 0), 0);
  }, [filteredShots]);

  // Get shot type color
  const getShotTypeColor = (type: string) => {
    switch (type) {
      case 'extreme_long':
      case 'long': return 'default';
      case 'full': return 'primary';
      case 'medium': return 'secondary';
      case 'close_up':
      case 'extreme_close_up': return 'success';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-bold">分镜列表</h3>
          <p className="text-sm text-default-500">
            共 {filteredShots.length} 个镜头，总时长 {Math.floor(totalDuration / 60)}分{totalDuration % 60}秒
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            aria-label="筛选场景"
            placeholder="筛选场景"
            selectedKeys={new Set([selectedScene])}
            onChange={(e) => setSelectedScene(e.target.value)}
            size="sm"
            className="w-40"
          >
            <SelectItem key="all" value="all">全部场景</SelectItem>
            {scenes.map(scene => (
              <SelectItem key={scene.name} value={scene.name}>
                {scene.name}
              </SelectItem>
            ))}
            {/* 如果有未分类的分镜，显示未分类场景选项 */}
            {shots.some(s => !s.sceneName) && (
              <SelectItem key="未分类场景" value="未分类场景">未分类场景</SelectItem>
            )}
          </Select>
          <Button
            size="sm"
            variant={displayMode === 'table' ? 'solid' : 'flat'}
            onPress={() => setDisplayMode('table')}
          >
            表格
          </Button>
          <Button
            size="sm"
            variant={displayMode === 'cards' ? 'solid' : 'flat'}
            onPress={() => setDisplayMode('cards')}
          >
            卡片
          </Button>
          {headerAction}
        </div>
      </div>

      {/* Table View */}
      {displayMode === 'table' ? (
        <>
          <Table aria-label="分镜列表">
            <TableHeader>
              <TableColumn>序号</TableColumn>
              <TableColumn>场景</TableColumn>
              <TableColumn>景别</TableColumn>
              <TableColumn>运镜</TableColumn>
              <TableColumn>画面描述</TableColumn>
              <TableColumn>角色</TableColumn>
              <TableColumn>时长</TableColumn>
              <TableColumn>操作</TableColumn>
            </TableHeader>
            <TableBody>
              {filteredShots.map((shot, index) => (
                <TableRow key={shot.id}>
                  <TableCell>
                    <span className="font-mono text-sm">{getSceneNumber(shot.sceneName)}-{shot.sequence}</span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="flat">{shot.sceneName}</Chip>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" color={getShotTypeColor(shot.shotType) as any}>
                      {SHOT_TYPE_LABELS[shot.shotType] || shot.shotType}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-default-600">
                      {CAMERA_MOVEMENT_LABELS[shot.cameraMovement] || shot.cameraMovement}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm line-clamp-2 max-w-xs">{shot.description}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {shot.characters?.slice(0, 2).map((char, i) => (
                        <Chip key={i} size="sm" variant="bordered">{char}</Chip>
                      ))}
                      {shot.characters && shot.characters.length > 2 && (
                        <Chip size="sm" variant="bordered">+{shot.characters.length - 2}</Chip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{shot.duration}秒</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {/* 上移按钮 */}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        onPress={() => {
                          setSelectedShot(shot);
                          setMoveDirection('up');
                          setIsMoveModalOpen(true);
                        }}
                        isDisabled={index === 0}
                        title="上移"
                      >
                        <ArrowUp size={14} />
                      </Button>
                      {/* 下移按钮 */}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        onPress={() => {
                          setSelectedShot(shot);
                          setMoveDirection('down');
                          setIsMoveModalOpen(true);
                        }}
                        isDisabled={index === filteredShots.length - 1}
                        title="下移"
                      >
                        <ArrowDown size={14} />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        onPress={() => {
                          setSelectedShot(shot);
                          setIsEditModalOpen(true);
                        }}
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={() => {
                          setSelectedShot(shot);
                          setIsDeleteModalOpen(true);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                      {onGenerateFragment && (
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => onGenerateFragment(shot)}
                        >
                          <Film size={14} />
                        </Button>
                      )}
                      {/* 仅在 manager 模式下显示拆分关键帧按钮 */}
                      {viewMode === 'manager' && (
                        <Button
                          isIconOnly
                          size="sm"
                          variant="flat"
                          color={shot.keyframes ? 'success' : 'primary'}
                          isLoading={splittingShotId === shot.id}
                          onPress={() => shot.keyframes ? setIsKeyframeModalOpen(true) : handleSplitKeyframes(shot)}
                        >
                          <Scissors size={14} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : (
        /* Cards View */
        <>
          <div className="space-y-6">
            {(Object.entries(shotsByScene) as [string, Shot[]][]).map(([sceneName, sceneShots]) => {
              if (selectedScene !== 'all' && selectedScene !== sceneName) return null;

              return (
                <div key={sceneName}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-lg">{sceneName}</h4>
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<Plus size={14} />}
                      onPress={() => handleAddShot(sceneName)}
                    >
                      添加镜头
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sceneShots.map((shot, index) => (
                      <Card key={shot.id}>
                        <CardBody className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge content={`${getSceneNumber(shot.sceneName)}-${shot.sequence}`} color="primary" shape="circle">
                                <Camera size={20} />
                              </Badge>
                              <Chip size="sm" color={getShotTypeColor(shot.shotType) as any}>
                                {SHOT_TYPE_LABELS[shot.shotType] || shot.shotType}
                              </Chip>
                            </div>
                            <div className="flex gap-1">
                              {/* 上移按钮 */}
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => handleMoveUp(shot.id)}
                                isDisabled={index === 0}
                              >
                                <ArrowUp size={14} />
                              </Button>
                              {/* 下移按钮 */}
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => handleMoveDown(shot.id)}
                                isDisabled={index === sceneShots.length - 1}
                              >
                                <ArrowDown size={14} />
                              </Button>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                onPress={() => {
                                  setSelectedShot(shot);
                                  setIsEditModalOpen(true);
                                }}
                              >
                                <Edit2 size={14} />
                              </Button>
                              {onGenerateFragment && (
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                  onPress={() => onGenerateFragment(shot)}
                                >
                                  <Film size={14} />
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          <p className="text-sm text-default-600 mb-3 line-clamp-3">
                            {shot.description}
                          </p>
                          
                          <div className="flex items-center justify-between text-xs text-default-500 mb-2">
                            <div className="flex items-center gap-1">
                              <Move size={14} />
                              <span>{CAMERA_MOVEMENT_LABELS[shot.cameraMovement] || shot.cameraMovement}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock size={14} />
                              <span>{shot.duration}秒</span>
                            </div>
                          </div>
                          
                          {/* 关键帧状态 */}
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-default-200">
                            <Chip 
                              size="sm" 
                              color={getKeyframeStatus(shot).color as any}
                              variant="flat"
                              startContent={getKeyframeStatus(shot).icon}
                            >
                              {getKeyframeStatus(shot).label}
                            </Chip>
                            {/* 仅在 manager 模式下显示拆分关键帧按钮 */}
                            {viewMode === 'manager' && (
                              <Button
                                size="sm"
                                variant="flat"
                                color={shot.keyframes ? 'success' : 'primary'}
                                isLoading={splittingShotId === shot.id}
                                onPress={() => shot.keyframes ? setIsKeyframeModalOpen(true) : handleSplitKeyframes(shot)}
                              >
                                {shot.keyframes ? '查看关键帧' : '拆分关键帧'}
                              </Button>
                            )}
                          </div>
                          
                          {shot.characters && shot.characters.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {shot.characters.map((char, i) => (
                                <Chip key={i} size="sm" variant="bordered">{char}</Chip>
                              ))}
                            </div>
                          )}
                          
                          {shot.dialogue && (
                            <div className="mt-2 p-2 bg-default-100 rounded text-sm italic">
                              "{shot.dialogue}"
                            </div>
                          )}
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} size="2xl">
        <ModalContent>
          {selectedShot && (
            <>
              <ModalHeader>编辑分镜 - {selectedShot.sceneName} #{selectedShot.sequence}</ModalHeader>
              <ModalBody className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    label="序号"
                    type="number"
                    value={String(selectedShot.sequence)}
                    onChange={(e) => setSelectedShot({ ...selectedShot, sequence: parseInt(e.target.value) || 0 })}
                  />
                  <Select
                    label="景别"
                    selectedKeys={new Set([selectedShot.shotType])}
                    onChange={(e) => setSelectedShot({ ...selectedShot, shotType: e.target.value as any })}
                  >
                    {Object.entries(SHOT_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="运镜"
                    selectedKeys={new Set([selectedShot.cameraMovement])}
                    onChange={(e) => setSelectedShot({ ...selectedShot, cameraMovement: e.target.value as any })}
                  >
                    {Object.entries(CAMERA_MOVEMENT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </Select>
                </div>

                <Textarea
                  label="画面描述"
                  value={selectedShot.description}
                  onChange={(e) => setSelectedShot({ ...selectedShot, description: e.target.value })}
                  minRows={3}
                />

                <div className="grid grid-cols-2 gap-4">
                  <Textarea
                    label="台词"
                    value={selectedShot.dialogue || ''}
                    onChange={(e) => setSelectedShot({ ...selectedShot, dialogue: e.target.value })}
                    placeholder="角色的台词（可选）"
                  />
                  <Textarea
                    label="音效"
                    value={selectedShot.sound || ''}
                    onChange={(e) => setSelectedShot({ ...selectedShot, sound: e.target.value })}
                    placeholder="音效描述（可选）"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="时长（秒）"
                    type="number"
                    value={String(selectedShot.duration)}
                    onChange={(e) => setSelectedShot({ ...selectedShot, duration: parseInt(e.target.value) || 0 })}
                  />
                  <Input
                    label="涉及角色（逗号分隔）"
                    value={selectedShot.characters?.join(', ') || ''}
                    onChange={(e) => setSelectedShot({
                      ...selectedShot,
                      characters: e.target.value.split(',').map(c => c.trim()).filter(Boolean)
                    })}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setIsEditModalOpen(false)}>
                  取消
                </Button>
                <Button color="primary" onPress={() => handleUpdateShot(selectedShot)}>
                  保存
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} size="sm">
        <ModalContent>
          <ModalHeader>确认删除</ModalHeader>
          <ModalBody>
            <p>确定要删除这个分镜吗？</p>
            {selectedShot && (
              <p className="text-sm text-default-500 mt-2">
                {selectedShot.sceneName} - 镜头 #{selectedShot.sequence}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsDeleteModalOpen(false)}>
              取消
            </Button>
            <Button 
              color="danger" 
              onPress={() => selectedShot && handleDeleteShot(selectedShot.id)}
            >
              删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Move Confirmation Modal */}
      <Modal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} size="sm">
        <ModalContent>
          <ModalHeader>确认移动</ModalHeader>
          <ModalBody>
            <p>
              确定要将这个分镜{moveDirection === 'up' ? '上移' : '下移'}吗？
            </p>
            {selectedShot && (
              <p className="text-sm text-default-500 mt-2">
                {selectedShot.sceneName} - 镜头 #{selectedShot.sequence}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsMoveModalOpen(false)}>
              取消
            </Button>
            <Button
              color="primary"
              onPress={() => {
                if (selectedShot && moveDirection) {
                  if (moveDirection === 'up') {
                    handleMoveUp(selectedShot.id);
                  } else {
                    handleMoveDown(selectedShot.id);
                  }
                  setIsMoveModalOpen(false);
                }
              }}
            >
              确认
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Keyframe Detail Modal */}
      <Modal isOpen={isKeyframeModalOpen} onClose={() => setIsKeyframeModalOpen(false)} size="3xl">
        <ModalContent>
          {selectedShot && selectedShot.keyframes && (
            <>
              <ModalHeader>
                <div className="flex items-center gap-2">
                  <Scissors size={20} />
                  关键帧详情 - {selectedShot.sceneName} #{selectedShot.sequence}
                </div>
              </ModalHeader>
              <ModalBody className="space-y-4">
                {/* 关键帧切换标签 */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {selectedShot.keyframes.map((kf, idx) => (
                    <Button
                      key={kf.id}
                      size="sm"
                      color={selectedKeyframeIndex === idx ? 'primary' : 'default'}
                      variant={selectedKeyframeIndex === idx ? 'solid' : 'flat'}
                      onPress={() => setSelectedKeyframeIndex(idx)}
                    >
                      关键帧 {idx + 1}
                      <span className="ml-1 text-xs opacity-70">{kf.duration}s</span>
                    </Button>
                  ))}
                </div>

                {/* 当前关键帧详情 */}
                {selectedShot.keyframes[selectedKeyframeIndex] && (
                  <div className="space-y-4">
                    {/* 图片占位区 */}
                    <div className="aspect-video bg-default-100 rounded-lg flex items-center justify-center relative">
                      {selectedShot.keyframes[selectedKeyframeIndex].generatedImage ? (
                        <img 
                          src={selectedShot.keyframes[selectedKeyframeIndex].generatedImage?.path} 
                          alt="关键帧"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="text-center">
                          <Image size={48} className="mx-auto mb-2 text-default-400" />
                          <p className="text-sm text-default-500">关键帧预览图</p>
                          <p className="text-xs text-default-400">（通过提示词生成）</p>
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                        {selectedKeyframeIndex + 1} / {selectedShot.keyframes.length}
                      </div>
                    </div>

                    {/* 静态描述 */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">静态画面描述</label>
                      <p className="text-sm text-default-600 bg-default-100 p-3 rounded">
                        {selectedShot.keyframes[selectedKeyframeIndex].description}
                      </p>
                    </div>

                    {/* 关联资产 */}
                    <div className="grid grid-cols-2 gap-4">
                      {selectedShot.keyframes[selectedKeyframeIndex].references.character && (
                        <div className="bg-default-100 p-3 rounded">
                          <div className="text-xs text-default-500 mb-1">参考角色</div>
                          <div className="flex items-center gap-2">
                            <Users size={16} className="text-primary" />
                            <span className="text-sm">{selectedShot.keyframes[selectedKeyframeIndex].references.character.name}</span>
                            <span className="text-xs text-default-400">({selectedShot.keyframes[selectedKeyframeIndex].references.character.id})</span>
                          </div>
                        </div>
                      )}
                      {selectedShot.keyframes[selectedKeyframeIndex].references.scene && (
                        <div className="bg-default-100 p-3 rounded">
                          <div className="text-xs text-default-500 mb-1">参考场景</div>
                          <div className="flex items-center gap-2">
                            <Camera size={16} className="text-success" />
                            <span className="text-sm">{selectedShot.keyframes[selectedKeyframeIndex].references.scene.name}</span>
                            <span className="text-xs text-default-400">({selectedShot.keyframes[selectedKeyframeIndex].references.scene.id})</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI提示词 */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium">图生图提示词</label>
                        <Button size="sm" variant="flat" onPress={() => {
                          navigator.clipboard.writeText(selectedShot.keyframes![selectedKeyframeIndex].prompt);
                        }}>
                          复制
                        </Button>
                      </div>
                      <Textarea
                        value={selectedShot.keyframes[selectedKeyframeIndex].prompt}
                        onChange={(e) => {
                          const updatedKeyframes = [...selectedShot.keyframes!];
                          updatedKeyframes[selectedKeyframeIndex].prompt = e.target.value;
                          setSelectedShot({ ...selectedShot, keyframes: updatedKeyframes });
                        }}
                        minRows={4}
                      />
                    </div>

                    {/* 选择生图模型 */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">选择生图模型</label>
                      <Select
                        label="生图模型"
                        placeholder={availableImageModels.length > 0 ? "选择用于生成关键帧图片的模型" : "请先在设置中配置生图模型"}
                        selectedKeys={selectedImageModel ? [selectedImageModel] : []}
                        onChange={(e) => setSelectedImageModel(e.target.value)}
                        isDisabled={availableImageModels.length === 0}
                      >
                        {availableImageModels.map(model => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </Select>
                      {availableImageModels.length === 0 ? (
                        <p className="text-xs text-danger mt-1">
                          未配置生图模型，请先在设置中添加模型
                        </p>
                      ) : (
                        <p className="text-xs text-default-500 mt-1">
                          支持多图参考的模型效果更佳
                        </p>
                      )}
                    </div>

                    {/* 生成按钮 */}
                    <div className="flex gap-2">
                      <Button
                        color="primary"
                        className="flex-1"
                        isDisabled={!selectedImageModel}
                        onPress={async () => {
                          if (!selectedImageModel || !selectedShot?.keyframes) return;

                          const kf = selectedShot.keyframes[selectedKeyframeIndex];
                          const characterAsset = kf.references.character
                            ? findCharacterByName(kf.references.character.name)
                            : undefined;
                          const sceneAsset = kf.references.scene
                            ? findSceneByName(kf.references.scene.name)
                            : undefined;

                          try {
                            const updatedKeyframe = await keyframeService.generateKeyframeImage({
                              keyframe: kf,
                              projectId,
                              characterAsset,
                              sceneAsset,
                              modelConfigId: selectedImageModel
                            });
                            // 创建新的keyframes数组以触发React重新渲染
                            const updatedKeyframes = [...selectedShot.keyframes!];
                            updatedKeyframes[selectedKeyframeIndex] = updatedKeyframe;
                            handleUpdateShot({ ...selectedShot, keyframes: updatedKeyframes });
                          } catch (error) {
                            console.error('生成关键帧图片失败:', error);
                          }
                        }}
                      >
                        <Image size={16} className="mr-2" />
                        生成关键帧图片
                      </Button>
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => setIsKeyframeModalOpen(false)}>
                  关闭
                </Button>
                <Button 
                  color="primary" 
                  onPress={() => {
                    handleUpdateShot(selectedShot);
                    setIsKeyframeModalOpen(false);
                  }}
                >
                  保存修改
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Split Keyframe Configuration Modal */}
      <Modal isOpen={isSplitModalOpen} onClose={() => setIsSplitModalOpen(false)} size="md">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Scissors size={20} />
              拆分关键帧配置
            </div>
          </ModalHeader>
          <ModalBody className="space-y-4">
            {selectedShot && (
              <>
                <div className="bg-default-100 p-3 rounded">
                  <div className="text-xs text-default-500 mb-1">当前分镜</div>
                  <div className="text-sm font-medium">{selectedShot.sceneName} - 镜头 #{selectedShot.sequence}</div>
                  <div className="text-xs text-default-600 mt-1 line-clamp-2">{selectedShot.description}</div>
                </div>

                {/* 选择LLM模型 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">选择拆分模型</label>
                  <Select
                    label="LLM模型"
                    placeholder={availableLLMModels.length > 0 ? "选择用于拆分关键帧的模型" : "请先在设置中配置LLM模型"}
                    selectedKeys={selectedLLMModel ? [selectedLLMModel] : []}
                    onChange={(e) => setSelectedLLMModel(e.target.value)}
                    isDisabled={availableLLMModels.length === 0}
                  >
                    {availableLLMModels.map(model => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </Select>
                  {availableLLMModels.length === 0 ? (
                    <p className="text-xs text-danger mt-1">
                      未配置LLM模型，请先在设置中添加模型
                    </p>
                  ) : (
                    <p className="text-xs text-default-500 mt-1">
                      选择不同的模型会影响拆分质量和速度
                    </p>
                  )}
                </div>

                {/* 选择关键帧数量 */}
                <div>
                  <label className="text-sm font-medium mb-2 block">关键帧数量</label>
                  <Select
                    label="数量"
                    selectedKeys={[keyframeCount.toString()]}
                    onChange={(e) => setKeyframeCount(parseInt(e.target.value))}
                  >
                    <SelectItem key="2" value="2">2个关键帧</SelectItem>
                    <SelectItem key="3" value="3">3个关键帧（推荐）</SelectItem>
                    <SelectItem key="4" value="4">4个关键帧</SelectItem>
                    <SelectItem key="5" value="5">5个关键帧</SelectItem>
                  </Select>
                </div>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsSplitModalOpen(false)}>
              取消
            </Button>
            <Button 
              color="primary" 
              isDisabled={!selectedLLMModel}
              onPress={confirmSplitKeyframes}
            >
              开始拆分
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
