import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Tabs,
  Tab,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Divider,
  Spinner,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react';
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Map,
  Upload,
  Download,
  Save,
  FolderOpen,
  RefreshCw,
  FileJson,
  Copy,
  HelpCircle,
} from 'lucide-react';
import { importDataset } from '../services/dataset/datasetService';
import { annotationSampleService } from '../services/dataset';
import { useToast } from '../contexts/ToastContext';

interface Shot {
  id: string;
  shotNumber: string;
  sceneDescription: string;
  shotType: string;
  cameraAngle: string;
  cameraMovement: string;
  duration: number;
  characters: string;
  dialogue: string;
  musicSound: string;
  visualDescription: string;
  notes: string;
}

interface Character {
  id: string;
  name: string;
  nameEn: string;
  role: string;
  personality: string;
  appearance: string;
  costume: string;
  ageRange: string;
  gender: string;
  notes: string;
}

interface Scene {
  id: string;
  sceneNumber: string;
  sceneName: string;
  location: string;
  timeOfDay: string;
  weather: string;
  atmosphere: string;
  lighting: string;
  props: string;
  description: string;
  notes: string;
}

interface AnnotationData {
  storyTitle: string;
  storySummary: string;
  shots: Shot[];
  characters: Character[];
  scenes: Scene[];
}

const shotTypes = [
  { label: '大远景', value: '大远景' },
  { label: '远景', value: '远景' },
  { label: '全景', value: '全景' },
  { label: '中景', value: '中景' },
  { label: '近景', value: '近景' },
  { label: '特写', value: '特写' },
  { label: '大特写', value: '大特写' },
];

const cameraAngles = [
  { label: '平视', value: '平视' },
  { label: '仰视', value: '仰视' },
  { label: '俯视', value: '俯视' },
  { label: '鸟瞰', value: '鸟瞰' },
  { label: '斜角', value: '斜角' },
];

const cameraMovements = [
  { label: '固定', value: '固定' },
  { label: '推', value: '推' },
  { label: '拉', value: '拉' },
  { label: '摇', value: '摇' },
  { label: '移', value: '移' },
  { label: '跟', value: '跟' },
  { label: '升降', value: '升降' },
  { label: '旋转', value: '旋转' },
];

const characterRoles = [
  { label: '主角', value: '主角' },
  { label: '配角', value: '配角' },
  { label: '反派', value: '反派' },
  { label: '客串', value: '客串' },
];

const ageRanges = [
  { label: '儿童', value: '儿童' },
  { label: '少年', value: '少年' },
  { label: '青年', value: '青年' },
  { label: '中年', value: '中年' },
  { label: '老年', value: '老年' },
];

const genders = [
  { label: '男', value: '男' },
  { label: '女', value: '女' },
  { label: '其他', value: '其他' },
];

const timeOfDayOptions = [
  { label: '清晨', value: '清晨' },
  { label: '上午', value: '上午' },
  { label: '中午', value: '中午' },
  { label: '下午', value: '下午' },
  { label: '傍晚', value: '傍晚' },
  { label: '夜晚', value: '夜晚' },
  { label: '深夜', value: '深夜' },
];

const weatherOptions = [
  { label: '晴朗', value: '晴朗' },
  { label: '多云', value: '多云' },
  { label: '阴天', value: '阴天' },
  { label: '小雨', value: '小雨' },
  { label: '大雨', value: '大雨' },
  { label: '雪', value: '雪' },
  { label: '雾', value: '雾' },
  { label: '风', value: '风' },
];

const atmosphereOptions = [
  { label: '温馨', value: '温馨' },
  { label: '紧张', value: '紧张' },
  { label: '恐怖', value: '恐怖' },
  { label: '浪漫', value: '浪漫' },
  { label: '喜剧', value: '喜剧' },
  { label: '动作', value: '动作' },
  { label: '悬疑', value: '悬疑' },
  { label: '悲伤', value: '悲伤' },
];

const AnnotationAssistant: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('story');
  const [loading, setLoading] = useState(false);
  const [importedStories, setImportedStories] = useState<any[]>([]);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isFormatOpen, onOpen: onFormatOpen, onClose: onFormatClose } = useDisclosure();

  const [storyTitle, setStoryTitle] = useState('');
  const [storySummary, setStorySummary] = useState('');

  const [shots, setShots] = useState<Shot[]>([
    {
      id: '1',
      shotNumber: 'S001-01',
      sceneDescription: '',
      shotType: '中景',
      cameraAngle: '平视',
      cameraMovement: '固定',
      duration: 4,
      characters: '',
      dialogue: '',
      musicSound: '',
      visualDescription: '',
      notes: '',
    },
  ]);
  const [currentShotIndex, setCurrentShotIndex] = useState(0);

  const [characters, setCharacters] = useState<Character[]>([
    {
      id: '1',
      name: '',
      nameEn: '',
      role: '主角',
      personality: '',
      appearance: '',
      costume: '',
      ageRange: '青年',
      gender: '男',
      notes: '',
    },
  ]);
  const [currentCharacterIndex, setCurrentCharacterIndex] = useState(0);

  const [scenes, setScenes] = useState<Scene[]>([
    {
      id: '1',
      sceneNumber: 'S001',
      sceneName: '',
      location: '',
      timeOfDay: '白天',
      weather: '晴朗',
      atmosphere: '温馨',
      lighting: '',
      props: '',
      description: '',
      notes: '',
    },
  ]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  const addShot = () => {
    const newShot: Shot = {
      id: String(shots.length + 1),
      shotNumber: `S001-${String(shots.length + 1).padStart(2, '0')}`,
      sceneDescription: '',
      shotType: '中景',
      cameraAngle: '平视',
      cameraMovement: '固定',
      duration: 4,
      characters: '',
      dialogue: '',
      musicSound: '',
      visualDescription: '',
      notes: '',
    };
    setShots([...shots, newShot]);
    setCurrentShotIndex(shots.length);
  };

  const deleteShot = () => {
    if (shots.length <= 1) return;
    const newShots = shots.filter((_, index) => index !== currentShotIndex);
    setShots(newShots);
    setCurrentShotIndex(Math.max(0, currentShotIndex - 1));
  };

  const updateShot = (field: keyof Shot, value: any) => {
    const newShots = [...shots];
    newShots[currentShotIndex] = {
      ...newShots[currentShotIndex],
      [field]: value,
    };
    setShots(newShots);
  };

  const addCharacter = () => {
    const newCharacter: Character = {
      id: String(characters.length + 1),
      name: '',
      nameEn: '',
      role: '主角',
      personality: '',
      appearance: '',
      costume: '',
      ageRange: '青年',
      gender: '男',
      notes: '',
    };
    setCharacters([...characters, newCharacter]);
    setCurrentCharacterIndex(characters.length);
  };

  const deleteCharacter = () => {
    if (characters.length <= 1) return;
    const newCharacters = characters.filter((_, index) => index !== currentCharacterIndex);
    setCharacters(newCharacters);
    setCurrentCharacterIndex(Math.max(0, currentCharacterIndex - 1));
  };

  const updateCharacter = (field: keyof Character, value: any) => {
    const newCharacters = [...characters];
    newCharacters[currentCharacterIndex] = {
      ...newCharacters[currentCharacterIndex],
      [field]: value,
    };
    setCharacters(newCharacters);
  };

  const addScene = () => {
    const newScene: Scene = {
      id: String(scenes.length + 1),
      sceneNumber: `S${String(scenes.length + 1).padStart(3, '0')}`,
      sceneName: '',
      location: '',
      timeOfDay: '白天',
      weather: '晴朗',
      atmosphere: '温馨',
      lighting: '',
      props: '',
      description: '',
      notes: '',
    };
    setScenes([...scenes, newScene]);
    setCurrentSceneIndex(scenes.length);
  };

  const deleteScene = () => {
    if (scenes.length <= 1) return;
    const newScenes = scenes.filter((_, index) => index !== currentSceneIndex);
    setScenes(newScenes);
    setCurrentSceneIndex(Math.max(0, currentSceneIndex - 1));
  };

  const updateScene = (field: keyof Scene, value: any) => {
    const newScenes = [...scenes];
    newScenes[currentSceneIndex] = {
      ...newScenes[currentSceneIndex],
      [field]: value,
    };
    setScenes(newScenes);
  };

  const loadStoryData = (story: any) => {
    setStoryTitle(story.title || '');
    setStorySummary(story.novelText || '');

    if (story.shots && story.shots.length > 0) {
      const convertedShots = story.shots.map((s: any, i: number) => ({
        id: String(i + 1),
        shotNumber: s.shotNumber || String(i + 1).padStart(2, '0'),
        sceneDescription: s.sceneDescription || '',
        shotType: s.shotType || '中景',
        cameraAngle: s.cameraAngle || '平视',
        cameraMovement: s.cameraMovement || '固定',
        duration: s.duration || 4,
        characters: Array.isArray(s.characters) ? s.characters.join(', ') : s.characters || '',
        dialogue: s.dialogue || '',
        musicSound: s.musicSound || '',
        visualDescription: s.visualDescription || '',
        notes: s.notes || '',
      }));
      setShots(convertedShots);
      setCurrentShotIndex(0);
    }

    showToast('故事数据加载成功！', 'success');
  };

  const handleImportDataset = async () => {
    setLoading(true);
    try {
      const stories = await importDataset(5);
      setImportedStories(stories);
      if (stories.length > 0) {
        loadStoryData(stories[0]);
        setSelectedStoryIndex(0);
      }
      showToast(`成功导入 ${stories.length} 个故事！`, 'success');
    } catch (error) {
      showToast('导入数据集失败', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    const data: AnnotationData = {
      storyTitle,
      storySummary,
      shots,
      characters,
      scenes,
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `annotation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast('标注数据已保存！', 'success');
  };

  const handleLoad = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data: AnnotationData = JSON.parse(e.target?.result as string);
        setStoryTitle(data.storyTitle || '');
        setStorySummary(data.storySummary || '');
        setShots(data.shots || []);
        setCharacters(data.characters || []);
        setScenes(data.scenes || []);
        setCurrentShotIndex(0);
        setCurrentCharacterIndex(0);
        setCurrentSceneIndex(0);
        showToast('标注数据加载成功！', 'success');
      } catch (error) {
        showToast('加载文件失败，请检查格式', 'error');
      }
    };
    reader.readAsText(file);
  };

  const currentShot = shots[currentShotIndex];
  const currentCharacter = characters[currentCharacterIndex];
  const currentScene = scenes[currentSceneIndex];

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-1">
        <CardHeader className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">标注助手</h2>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="light"
                startContent={<RefreshCw size={16} />}
                onPress={handleImportDataset}
                isLoading={loading}
              >
                导入示例数据集
              </Button>
              <input
                type="file"
                id="load-file"
                accept=".json"
                className="hidden"
                onChange={handleLoad}
              />
              <Button
                size="sm"
                variant="light"
                startContent={<FolderOpen size={16} />}
                onPress={() => document.getElementById('load-file')?.click()}
              >
                从文件导入
              </Button>
              <Button
                color="primary"
                size="sm"
                startContent={<Save size={16} />}
                onPress={handleSave}
              >
                保存
              </Button>
              <Button
                size="sm"
                variant="light"
                isIconOnly
                onPress={onFormatOpen}
                aria-label="查看导入格式"
              >
                <HelpCircle size={16} />
              </Button>
            </div>
          </div>

          {importedStories.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-slate-500">已导入故事：</span>
              <Button
                size="sm"
                variant="light"
                isDisabled={selectedStoryIndex === 0}
                onPress={() => {
                  const newIndex = selectedStoryIndex - 1;
                  setSelectedStoryIndex(newIndex);
                  loadStoryData(importedStories[newIndex]);
                }}
              >
                <ChevronLeft size={16} />
              </Button>
              <Chip variant="flat">
                {selectedStoryIndex + 1} / {importedStories.length}
              </Chip>
              <Button
                size="sm"
                variant="light"
                isDisabled={selectedStoryIndex === importedStories.length - 1}
                onPress={() => {
                  const newIndex = selectedStoryIndex + 1;
                  setSelectedStoryIndex(newIndex);
                  loadStoryData(importedStories[newIndex]);
                }}
              >
                <ChevronRight size={16} />
              </Button>
              <span className="text-sm ml-2 text-slate-400">
                {importedStories[selectedStoryIndex]?.title}
              </span>
            </div>
          )}
        </CardHeader>
        <CardBody className="p-0">
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={key => setActiveTab(key as string)}
            className="px-6"
          >
            <Tab key="story" title="故事" />
            <Tab key="shots" title="分镜" />
            <Tab key="characters" title="角色" />
            <Tab key="scenes" title="场景" />
          </Tabs>
          <div className="p-6">
            {activeTab === 'story' && (
              <div className="space-y-4">
                <Input
                  label="故事标题"
                  placeholder="输入故事标题"
                  value={storyTitle}
                  onValueChange={setStoryTitle}
                />
                <Textarea
                  label="故事梗概"
                  placeholder="输入故事梗概"
                  minRows={6}
                  value={storySummary}
                  onValueChange={setStorySummary}
                />
              </div>
            )}
            {activeTab === 'shots' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      isDisabled={currentShotIndex === 0}
                      onPress={() => setCurrentShotIndex(currentShotIndex - 1)}
                    >
                      <ChevronLeft size={20} />
                    </Button>
                    <span className="text-sm">
                      分镜 {currentShotIndex + 1} / {shots.length}
                    </span>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      isDisabled={currentShotIndex === shots.length - 1}
                      onPress={() => setCurrentShotIndex(currentShotIndex + 1)}
                    >
                      <ChevronRight size={20} />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      color="primary"
                      size="sm"
                      startContent={<Plus size={16} />}
                      onPress={addShot}
                    >
                      添加分镜
                    </Button>
                    <Button
                      color="danger"
                      size="sm"
                      variant="light"
                      isDisabled={shots.length <= 1}
                      startContent={<Trash2 size={16} />}
                      onPress={deleteShot}
                    >
                      删除
                    </Button>
                  </div>
                </div>

                <Divider />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="分镜号"
                    value={currentShot.shotNumber}
                    onValueChange={value => updateShot('shotNumber', value)}
                  />
                  <Input
                    label="时长（秒）"
                    type="number"
                    value={String(currentShot.duration)}
                    onValueChange={value => updateShot('duration', Number(value))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Select
                    label="景别"
                    selectedKeys={[currentShot.shotType]}
                    onSelectionChange={keys => {
                      const value = Array.from(keys)[0] as string;
                      updateShot('shotType', value);
                    }}
                  >
                    {shotTypes.map(type => (
                      <SelectItem key={type.value}>{type.label}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="拍摄角度"
                    selectedKeys={[currentShot.cameraAngle]}
                    onSelectionChange={keys => {
                      const value = Array.from(keys)[0] as string;
                      updateShot('cameraAngle', value);
                    }}
                  >
                    {cameraAngles.map(angle => (
                      <SelectItem key={angle.value}>{angle.label}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="镜头运动"
                    selectedKeys={[currentShot.cameraMovement]}
                    onSelectionChange={keys => {
                      const value = Array.from(keys)[0] as string;
                      updateShot('cameraMovement', value);
                    }}
                  >
                    {cameraMovements.map(movement => (
                      <SelectItem key={movement.value}>{movement.label}</SelectItem>
                    ))}
                  </Select>
                </div>

                <Textarea
                  label="场景描述"
                  placeholder="描述这个分镜的场景"
                  minRows={2}
                  value={currentShot.sceneDescription}
                  onValueChange={value => updateShot('sceneDescription', value)}
                />

                <Textarea
                  label="画面描述"
                  placeholder="详细描述画面内容"
                  minRows={3}
                  value={currentShot.visualDescription}
                  onValueChange={value => updateShot('visualDescription', value)}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="出场角色"
                    placeholder="列出出场的角色"
                    value={currentShot.characters}
                    onValueChange={value => updateShot('characters', value)}
                  />
                  <Textarea
                    label="对话"
                    placeholder="角色对话内容"
                    minRows={2}
                    value={currentShot.dialogue}
                    onValueChange={value => updateShot('dialogue', value)}
                  />
                </div>

                <Textarea
                  label="音乐/音效"
                  placeholder="描述背景音乐和音效"
                  minRows={2}
                  value={currentShot.musicSound}
                  onValueChange={value => updateShot('musicSound', value)}
                />

                <Textarea
                  label="备注"
                  placeholder="其他备注信息"
                  minRows={2}
                  value={currentShot.notes}
                  onValueChange={value => updateShot('notes', value)}
                />
              </div>
            )}
            {activeTab === 'characters' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      isDisabled={currentCharacterIndex === 0}
                      onPress={() => setCurrentCharacterIndex(currentCharacterIndex - 1)}
                    >
                      <ChevronLeft size={20} />
                    </Button>
                    <span className="text-sm">
                      角色 {currentCharacterIndex + 1} / {characters.length}
                    </span>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      isDisabled={currentCharacterIndex === characters.length - 1}
                      onPress={() => setCurrentCharacterIndex(currentCharacterIndex + 1)}
                    >
                      <ChevronRight size={20} />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      color="primary"
                      size="sm"
                      startContent={<Plus size={16} />}
                      onPress={addCharacter}
                    >
                      添加角色
                    </Button>
                    <Button
                      color="danger"
                      size="sm"
                      variant="light"
                      isDisabled={characters.length <= 1}
                      startContent={<Trash2 size={16} />}
                      onPress={deleteCharacter}
                    >
                      删除
                    </Button>
                  </div>
                </div>

                <Divider />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="角色名（中文）"
                    placeholder="输入角色中文名"
                    value={currentCharacter.name}
                    onValueChange={value => updateCharacter('name', value)}
                  />
                  <Input
                    label="角色名（英文）"
                    placeholder="输入角色英文名"
                    value={currentCharacter.nameEn}
                    onValueChange={value => updateCharacter('nameEn', value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Select
                    label="角色类型"
                    selectedKeys={[currentCharacter.role]}
                    onSelectionChange={keys => {
                      const value = Array.from(keys)[0] as string;
                      updateCharacter('role', value);
                    }}
                  >
                    {characterRoles.map(role => (
                      <SelectItem key={role.value}>{role.label}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="年龄段"
                    selectedKeys={[currentCharacter.ageRange]}
                    onSelectionChange={keys => {
                      const value = Array.from(keys)[0] as string;
                      updateCharacter('ageRange', value);
                    }}
                  >
                    {ageRanges.map(age => (
                      <SelectItem key={age.value}>{age.label}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="性别"
                    selectedKeys={[currentCharacter.gender]}
                    onSelectionChange={keys => {
                      const value = Array.from(keys)[0] as string;
                      updateCharacter('gender', value);
                    }}
                  >
                    {genders.map(gender => (
                      <SelectItem key={gender.value}>{gender.label}</SelectItem>
                    ))}
                  </Select>
                </div>

                <Textarea
                  label="性格描述"
                  placeholder="描述角色的性格特点"
                  minRows={3}
                  value={currentCharacter.personality}
                  onValueChange={value => updateCharacter('personality', value)}
                />

                <Textarea
                  label="外貌描述"
                  placeholder="描述角色的外貌特征"
                  minRows={3}
                  value={currentCharacter.appearance}
                  onValueChange={value => updateCharacter('appearance', value)}
                />

                <Textarea
                  label="服装描述"
                  placeholder="描述角色的典型服装"
                  minRows={2}
                  value={currentCharacter.costume}
                  onValueChange={value => updateCharacter('costume', value)}
                />

                <Textarea
                  label="备注"
                  placeholder="其他角色相关信息"
                  minRows={2}
                  value={currentCharacter.notes}
                  onValueChange={value => updateCharacter('notes', value)}
                />
              </div>
            )}
            {activeTab === 'scenes' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      isDisabled={currentSceneIndex === 0}
                      onPress={() => setCurrentSceneIndex(currentSceneIndex - 1)}
                    >
                      <ChevronLeft size={20} />
                    </Button>
                    <span className="text-sm">
                      场景 {currentSceneIndex + 1} / {scenes.length}
                    </span>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      isDisabled={currentSceneIndex === scenes.length - 1}
                      onPress={() => setCurrentSceneIndex(currentSceneIndex + 1)}
                    >
                      <ChevronRight size={20} />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      color="primary"
                      size="sm"
                      startContent={<Plus size={16} />}
                      onPress={addScene}
                    >
                      添加场景
                    </Button>
                    <Button
                      color="danger"
                      size="sm"
                      variant="light"
                      isDisabled={scenes.length <= 1}
                      startContent={<Trash2 size={16} />}
                      onPress={deleteScene}
                    >
                      删除
                    </Button>
                  </div>
                </div>

                <Divider />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="场景号"
                    value={currentScene.sceneNumber}
                    onValueChange={value => updateScene('sceneNumber', value)}
                  />
                  <Input
                    label="场景名称"
                    placeholder="输入场景名称"
                    value={currentScene.sceneName}
                    onValueChange={value => updateScene('sceneName', value)}
                  />
                  <Input
                    label="地点"
                    placeholder="描述场景地点"
                    value={currentScene.location}
                    onValueChange={value => updateScene('location', value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Select
                    label="时间"
                    selectedKeys={[currentScene.timeOfDay]}
                    onSelectionChange={keys => {
                      const value = Array.from(keys)[0] as string;
                      updateScene('timeOfDay', value);
                    }}
                  >
                    {timeOfDayOptions.map(option => (
                      <SelectItem key={option.value}>{option.label}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="天气"
                    selectedKeys={[currentScene.weather]}
                    onSelectionChange={keys => {
                      const value = Array.from(keys)[0] as string;
                      updateScene('weather', value);
                    }}
                  >
                    {weatherOptions.map(option => (
                      <SelectItem key={option.value}>{option.label}</SelectItem>
                    ))}
                  </Select>
                  <Select
                    label="氛围"
                    selectedKeys={[currentScene.atmosphere]}
                    onSelectionChange={keys => {
                      const value = Array.from(keys)[0] as string;
                      updateScene('atmosphere', value);
                    }}
                  >
                    {atmosphereOptions.map(option => (
                      <SelectItem key={option.value}>{option.label}</SelectItem>
                    ))}
                  </Select>
                </div>

                <Textarea
                  label="灯光描述"
                  placeholder="描述场景的灯光特点"
                  minRows={2}
                  value={currentScene.lighting}
                  onValueChange={value => updateScene('lighting', value)}
                />

                <Textarea
                  label="道具"
                  placeholder="列出场景中的重要道具"
                  minRows={2}
                  value={currentScene.props}
                  onValueChange={value => updateScene('props', value)}
                />

                <Textarea
                  label="场景描述"
                  placeholder="详细描述场景内容"
                  minRows={4}
                  value={currentScene.description}
                  onValueChange={value => updateScene('description', value)}
                />

                <Textarea
                  label="备注"
                  placeholder="其他场景相关信息"
                  minRows={2}
                  value={currentScene.notes}
                  onValueChange={value => updateScene('notes', value)}
                />
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 格式说明Modal */}
      <Modal isOpen={isFormatOpen} onClose={onFormatClose} size="2xl">
        <ModalContent>
          <ModalHeader className="flex items-center justify-between">
            <h3 className="text-lg font-bold">数据导入格式说明</h3>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              {/* 格式说明 */}
              <div>
                <h4 className="font-bold text-sm text-slate-500 mb-3">JSON格式要求</h4>
                <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-4 text-xs font-mono overflow-x-auto">
                  <pre className="text-slate-700 dark:text-slate-300">
                    {`{
  "stories": [
    {
      "title": "故事标题",
      "synopsis": "故事梗概",
      "characters": [
        {
          "name": "角色名",
          "nameEn": "角色英文名",
          "role": "角色（主角/配角）",
          "personality": "性格",
          "appearance": "外貌",
          "costume": "服装",
          "ageRange": "年龄范围",
          "gender": "性别",
          "notes": "备注"
        }
      ],
      "scenes": [
        {
          "sceneNumber": "场景号",
          "sceneName": "场景名",
          "location": "地点",
          "timeOfDay": "时间",
          "weather": "天气",
          "atmosphere": "氛围",
          "lighting": "光影",
          "props": "道具",
          "description": "描述",
          "notes": "备注"
        }
      ],
      "shots": [
        {
          "shotNumber": "分镜号",
          "shotType": "景别",
          "cameraAngle": "拍摄角度",
          "cameraMovement": "镜头运动",
          "lighting": "光影",
          "weather": "天气",
          "mood": "情绪",
          "filmStyle": "影视风格",
          "visualDescription": "画面描述",
          "dialogue": "对话",
          "duration": "时长",
          "notes": "备注"
        }
      ]
    }
  ]
}`}
                  </pre>
                </div>
              </div>

              <Divider />

              {/* 复制按钮 */}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="light"
                  startContent={<Copy size={16} />}
                  onPress={() => {
                    const formatTemplate = JSON.stringify(
                      {
                        stories: [
                          {
                            title: '故事标题',
                            synopsis: '故事梗概',
                            characters: [
                              {
                                name: '角色名',
                                nameEn: '角色英文名',
                                role: '主角',
                                personality: '性格描述',
                                appearance: '外貌描述',
                                costume: '服装描述',
                                ageRange: '年龄范围',
                                gender: '性别',
                                notes: '备注',
                              },
                            ],
                            scenes: [
                              {
                                sceneNumber: 'S001',
                                sceneName: '场景名',
                                location: '地点',
                                timeOfDay: '白天',
                                weather: '晴朗',
                                atmosphere: '氛围',
                                lighting: '光影',
                                props: '道具',
                                description: '描述',
                                notes: '备注',
                              },
                            ],
                            shots: [
                              {
                                shotNumber: 'S001-01',
                                shotType: '中景',
                                cameraAngle: '平视',
                                cameraMovement: '固定',
                                lighting: '自然光',
                                weather: '晴朗',
                                mood: '平静',
                                filmStyle: '电影质感',
                                visualDescription: '画面描述（50-300字）',
                                dialogue: '对话',
                                duration: '5',
                                notes: '备注',
                              },
                            ],
                          },
                        ],
                      },
                      null,
                      2
                    );
                    navigator.clipboard
                      .writeText(formatTemplate)
                      .then(() => {
                        showToast('格式模板已复制到剪贴板！', 'success');
                      })
                      .catch(() => {
                        showToast('复制失败，请手动复制', 'error');
                      });
                  }}
                >
                  复制格式模板
                </Button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onFormatClose}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default AnnotationAssistant;
