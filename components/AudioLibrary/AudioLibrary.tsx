import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Button,
  Input,
  Tabs,
  Tab,
  Chip,
  Divider,
  Spinner,
} from '@heroui/react';
import {
  Music,
  Volume2,
  Search,
  Plus,
  Trash2,
  Tag,
  Filter,
} from 'lucide-react';
import { audioService, SoundEffect, MusicTrack } from '../../services/audio';
import { useToast } from '../../contexts/ToastContext';

interface AudioLibraryProps {
  onSelectAudio: (audio: SoundEffect | MusicTrack) => void;
  projectId: string;
}

export const AudioLibrary: React.FC<AudioLibraryProps> = ({ onSelectAudio, projectId }) => {
  const [activeTab, setActiveTab] = useState<'sound' | 'music'>('sound');
  const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([]);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<SoundEffect | MusicTrack | null>(null);
  const { showToast } = useToast();

  // 加载音效和音乐库
  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'sound') {
        const effects = await audioService.getSoundEffectsLibrary();
        setSoundEffects(effects);
      } else {
        const tracks = await audioService.getMusicLibrary();
        setMusicTracks(tracks);
      }
    } catch (error) {
      console.error('加载音频库失败:', error);
      showToast('加载音频库失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 搜索音频
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadLibrary();
      return;
    }

    setIsLoading(true);
    try {
      if (activeTab === 'sound') {
        const results = await audioService.searchSoundEffects(searchQuery);
        setSoundEffects(results);
      } else {
        const results = await audioService.searchMusic(searchQuery);
        setMusicTracks(results);
      }
    } catch (error) {
      console.error('搜索音频失败:', error);
      showToast('搜索音频失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 获取分类列表
  const getCategories = () => {
    if (activeTab === 'sound') {
      const categories = new Set(soundEffects.map(effect => effect.category));
      return ['all', ...Array.from(categories)];
    } else {
      const genres = new Set(musicTracks.map(track => track.genre));
      return ['all', ...Array.from(genres)];
    }
  };

  // 过滤音频
  const filteredAudio = () => {
    if (activeTab === 'sound') {
      let filtered = soundEffects;
      if (selectedCategory !== 'all') {
        filtered = filtered.filter(effect => effect.category === selectedCategory);
      }
      return filtered;
    } else {
      let filtered = musicTracks;
      if (selectedCategory !== 'all') {
        filtered = filtered.filter(track => track.genre === selectedCategory);
      }
      return filtered;
    }
  };

  // 处理音频选择
  const handleAudioSelect = (audio: SoundEffect | MusicTrack) => {
    setSelectedAudio(audio);
    onSelectAudio(audio);
  };

  // 处理音频删除
  const handleAudioDelete = async (audio: SoundEffect | MusicTrack) => {
    if (window.confirm(`确定要删除 ${audio.name} 吗？`)) {
      try {
        await audioService.removeFromLibrary(audio.id);
        showToast('音频已删除', 'success');
        loadLibrary();
      } catch (error) {
        console.error('删除音频失败:', error);
        showToast('删除音频失败', 'error');
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">音频库</h3>
            <Button
              size="sm"
              startContent={<Plus size={16} />}
              onPress={() => showToast('添加音频功能开发中', 'info')}
            >
              添加音频
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <Tabs
            aria-label="音频类型"
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as 'sound' | 'music')}
          >
            <Tab key="sound" title="音效" />
            <Tab key="music" title="音乐" />
          </Tabs>

          <Divider className="my-4" />

          {/* 搜索和过滤 */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 text-gray-500" size={16} />
              <Input
                placeholder="搜索音频..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onPressEnter={handleSearch}
                className="pl-8"
              />
            </div>
            <Button
              size="sm"
              startContent={<Search size={16} />}
              onPress={handleSearch}
            >
              搜索
            </Button>
          </div>

          {/* 分类过滤 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {getCategories().map((category) => (
              <Chip
                key={category}
                selected={selectedCategory === category}
                onPress={() => setSelectedCategory(category)}
                variant={selectedCategory === category ? 'solid' : 'flat'}
              >
                {category === 'all' ? '全部' : category}
              </Chip>
            ))}
          </div>

          {/* 音频列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAudio().map((audio) => (
                <Card
                  key={audio.id}
                  isPressable
                  onPress={() => handleAudioSelect(audio)}
                  className={`cursor-pointer ${selectedAudio?.id === audio.id ? 'ring-2 ring-primary' : ''}`}
                >
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {activeTab === 'sound' ? (
                          <Volume2 size={20} className="text-primary" />
                        ) : (
                          <Music size={20} className="text-primary" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium">{audio.name}</h4>
                        <p className="text-sm text-gray-500">
                          {activeTab === 'sound' ? audio.category : audio.genre}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {audio.description || (activeTab === 'music' ? audio.mood : '')}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{audio.duration}秒</span>
                      <Button
                        isIconOnly
                        size="sm"
                        color="danger"
                        onPress={(e) => {
                          // e.stopPropagation();
                          handleAudioDelete(audio);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {audio.tags.map((tag) => (
                        <Chip key={tag} size="sm" variant="flat" className="text-xs">
                          {tag}
                        </Chip>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && filteredAudio().length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>没有找到音频</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default AudioLibrary;