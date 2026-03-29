import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { videoGenerationService } from '../services/video/VideoGenerationService';
import { audioService, SoundEffect, MusicTrack } from '../services/audio';
import {
  Keyframe,
  GeneratedVideo,
  GeneratedAudio,
  ModelConfig,
  JobStatus,
  AssetType,
} from '../types';
import { storageService } from '../services/storage';
import AudioLibrary from '../components/AudioLibrary/AudioLibrary';

interface GenerationTask {
  id: string;
  type: 'video' | 'audio';
  status: JobStatus;
  params: any;
  result?: any;
  error?: string;
  progress?: number;
}

interface AudioGenerationParams {
  videoId: string;
  type: 'dialogue' | 'sound' | 'music';
  prompt: string;
  modelConfigId: string;
  projectId: string;
  options?: any;
}

interface VideoAudioManagerProps {
  projectId?: string;
}

const VideoAudioManager: React.FC<VideoAudioManagerProps> = ({ projectId: propProjectId }) => {
  const { projectId: paramProjectId } = useParams<{ projectId: string }>();
  const projectId = propProjectId || paramProjectId;
  const navigate = useNavigate();

  // 状态管理
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [audios, setAudios] = useState<GeneratedAudio[]>([]);
  const [generationTasks, setGenerationTasks] = useState<GenerationTask[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<GeneratedAudio | null>(null);
  const [selectedAudios, setSelectedAudios] = useState<GeneratedAudio[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isBatchPreviewing, setIsBatchPreviewing] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string>('');
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string>('');
  const [batchPreviewUrls, setBatchPreviewUrls] = useState<string[]>([]);
  const [currentBatchPreviewIndex, setCurrentBatchPreviewIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState<string>('');
  const [audioPrompt, setAudioPrompt] = useState<string>('');
  const [audioType, setAudioType] = useState<'dialogue' | 'sound' | 'music'>('sound');
  const [modelConfigId, setModelConfigId] = useState<string>('');
  const [modelConfigs, setModelConfigs] = useState<ModelConfig[]>([]);
  // 音频库状态
  const [showAudioLibrary, setShowAudioLibrary] = useState(false);
  const [libraryAudio, setLibraryAudio] = useState<SoundEffect | MusicTrack | null>(null);

  // 引用
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // 加载模型配置
  useEffect(() => {
    const loadModelConfigs = async () => {
      // 这里应该从设置中加载模型配置
      // 暂时使用模拟数据
      const configs: ModelConfig[] = [
        {
          id: 'volc-video-1',
          name: '火山视频生成',
          provider: 'volcengine',
          modelId: 'doubao-seedream-4-5-251128',
          type: 'video',
          capabilities: {
            supportsImageInput: true,
            supportsVideoInput: false,
            supportsAudioGeneration: false,
            supportsReferenceImage: true,
            supportsStartFrame: true,
            supportsEndFrame: true,
            supportedGenerationTypes: ['text_to_video', 'first_last_frame', 'multi_ref'],
            maxReferenceImages: 2,
            maxBatchSize: 1,
            appendCountToPrompt: false,
            requiresImageInput: true,
            supportedResolutions: ['720p', '1080p'],
            defaultResolution: '1080p',
            minPixels: 1280 * 720,
            maxPixels: 1920 * 1080,
            minAspectRatio: 0.5625,
            maxAspectRatio: 1.7778,
            supportedAspectRatios: ['16:9', '9:16'],
          },
          parameters: [],
          isDefault: true,
        },
        {
          id: 'aliyun-tts-1',
          name: '阿里云语音合成',
          provider: 'aliyun-tts',
          modelId: 'xiaqing',
          type: 'llm',
          capabilities: {
            supportsImageInput: false,
            supportsVideoInput: false,
            supportsAudioGeneration: true,
            supportsReferenceImage: false,
            supportsStartFrame: false,
            supportsEndFrame: false,
            supportedGenerationTypes: [],
            maxReferenceImages: 0,
            maxBatchSize: 1,
            appendCountToPrompt: false,
            requiresImageInput: false,
          },
          parameters: [],
          isDefault: true,
        },
      ];
      setModelConfigs(configs);
      if (configs.length > 0) {
        setModelConfigId(configs[0].id);
      }
    };
    loadModelConfigs();
  }, []);

  // 加载项目的视频和音频资产
  useEffect(() => {
    if (!projectId) return;

    const loadAssets = async () => {
      try {
        // 这里应该从存储服务加载视频和音频资产
        // 暂时使用模拟数据
        const mockVideos: GeneratedVideo[] = [
          {
            id: 'video-1',
            name: '测试视频1',
            path: 'projects/test/video1.mp4',
            prompt: '一个人在海滩上散步',
            modelConfigId: 'volc-video-1',
            modelId: 'doubao-seedream-4-5-251128',
            createdAt: Date.now() - 3600000,
            duration: 5,
            width: 1920,
            height: 1080,
          },
        ];
        const mockAudios: GeneratedAudio[] = [
          {
            id: 'audio-1',
            name: '测试音效1',
            path: 'projects/test/audio1.mp3',
            prompt: '海浪声',
            modelConfigId: 'aliyun-tts-1',
            modelId: 'xiaqing',
            createdAt: Date.now() - 1800000,
            duration: 10,
            type: 'sound',
          },
        ];
        setVideos(mockVideos);
        setAudios(mockAudios);
      } catch (error) {
        console.error('加载资产失败:', error);
      }
    };
    loadAssets();
  }, [projectId]);

  // 生成视频
  const generateVideo = async () => {
    if (!projectId || !videoPrompt || keyframes.length === 0) {
      alert('请输入视频提示词并添加关键帧');
      return;
    }

    setIsGenerating(true);

    const taskId = `task-${Date.now()}`;
    setGenerationTasks(prev => [
      ...prev,
      {
        id: taskId,
        type: 'video',
        status: JobStatus.PROCESSING,
        params: { keyframes, prompt: videoPrompt, modelConfigId, projectId },
        progress: 0,
      },
    ]);

    try {
      const result = await videoGenerationService.generateVideo({
        keyframes,
        prompt: videoPrompt,
        modelConfigId,
        projectId,
      });

      if (result.success && result.localPath) {
        const newVideo: GeneratedVideo = {
          id: `video-${Date.now()}`,
          name: `视频-${Date.now()}`,
          path: result.localPath,
          prompt: videoPrompt,
          modelConfigId,
          modelId: modelConfigs.find(c => c.id === modelConfigId)?.modelId || '',
          createdAt: Date.now(),
          duration: 5, // 暂时使用默认值
        };

        setVideos(prev => [...prev, newVideo]);
        setGenerationTasks(prev =>
          prev.map(task =>
            task.id === taskId ? { ...task, status: JobStatus.COMPLETED, result: newVideo } : task
          )
        );
      } else {
        setGenerationTasks(prev =>
          prev.map(task =>
            task.id === taskId ? { ...task, status: JobStatus.FAILED, error: result.error } : task
          )
        );
      }
    } catch (error) {
      setGenerationTasks(prev =>
        prev.map(task =>
          task.id === taskId ? { ...task, status: JobStatus.FAILED, error: String(error) } : task
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // 基于视频生成音频
  const generateAudioFromVideo = async (videoId: string) => {
    if (!projectId || !audioPrompt) {
      alert('请输入音频提示词');
      return;
    }

    setIsGenerating(true);

    const taskId = `task-${Date.now()}`;
    setGenerationTasks(prev => [
      ...prev,
      {
        id: taskId,
        type: 'audio',
        status: JobStatus.PROCESSING,
        params: { videoId, type: audioType, prompt: audioPrompt, modelConfigId, projectId },
        progress: 0,
      },
    ]);

    try {
      let audio: GeneratedAudio;

      if (audioType === 'dialogue') {
        audio = await audioService.generateSpeech(audioPrompt, {
          modelConfigId,
          projectId,
        });
      } else if (audioType === 'sound') {
        audio = await audioService.generateSound(audioPrompt, {
          modelConfigId,
          projectId,
        });
      } else {
        audio = await audioService.generateMusic(audioPrompt, {
          modelConfigId,
          projectId,
        });
      }

      setAudios(prev => [...prev, audio]);
      setGenerationTasks(prev =>
        prev.map(task =>
          task.id === taskId ? { ...task, status: JobStatus.COMPLETED, result: audio } : task
        )
      );
    } catch (error) {
      setGenerationTasks(prev =>
        prev.map(task =>
          task.id === taskId ? { ...task, status: JobStatus.FAILED, error: String(error) } : task
        )
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // 批量生成相关状态
  const [batchTexts, setBatchTexts] = useState<string>('');
  const [batchAudioType, setBatchAudioType] = useState<'dialogue' | 'sound' | 'music'>('dialogue');
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  // 批量生成音视频
  const batchGenerate = async () => {
    if (!projectId || !batchTexts) {
      alert('请输入批量生成的文本内容');
      return;
    }

    setIsBatchGenerating(true);
    setBatchProgress(0);

    try {
      // 解析批量文本，按行分割
      const texts = batchTexts.split('\n').filter(text => text.trim() !== '');
      if (texts.length === 0) {
        alert('请输入有效的文本内容');
        setIsBatchGenerating(false);
        return;
      }

      const taskId = `batch-task-${Date.now()}`;
      setGenerationTasks(prev => [
        ...prev,
        {
          id: taskId,
          type: 'audio',
          status: JobStatus.PROCESSING,
          params: { type: batchAudioType, texts: texts.length, modelConfigId, projectId },
          progress: 0,
        },
      ]);

      const batchResults: GeneratedAudio[] = [];
      const concurrencyLimit = 3; // 降低并发数以避免网络拥塞
      const totalTexts = texts.length;

      // 分批次处理，每批限制并发数
      for (let i = 0; i < totalTexts; i += concurrencyLimit) {
        const batch = texts.slice(i, i + concurrencyLimit);
        const batchStart = i;

        // 并行处理当前批次
        const batchPromises = batch.map((text, batchIndex) => {
          let generatePromise: Promise<GeneratedAudio>;

          if (batchAudioType === 'dialogue') {
            generatePromise = audioService.generateSpeech(text, {
              modelConfigId,
              projectId,
            });
          } else if (batchAudioType === 'sound') {
            generatePromise = audioService.generateSound(text, {
              modelConfigId,
              projectId,
            });
          } else {
            generatePromise = audioService.generateMusic(text, {
              modelConfigId,
              projectId,
            });
          }

          return generatePromise.then(audio => {
            // 实时更新进度
            const completed = batchStart + batchIndex + 1;
            const progress = Math.round((completed / totalTexts) * 100);
            setBatchProgress(progress);

            // 更新任务状态
            setGenerationTasks(prev =>
              prev.map(task => (task.id === taskId ? { ...task, progress } : task))
            );

            return audio;
          });
        });

        const batchAudioResults = await Promise.all(batchPromises);
        batchResults.push(...batchAudioResults);
      }

      // 更新音频列表
      setAudios(prev => [...prev, ...batchResults]);

      // 更新任务状态
      setGenerationTasks(prev =>
        prev.map(task =>
          task.id === taskId
            ? {
                ...task,
                status: JobStatus.COMPLETED,
                result: { count: batchResults.length },
              }
            : task
        )
      );

      alert(`批量生成完成，共生成 ${batchResults.length} 个音频`);
    } catch (error) {
      console.error('批量生成失败:', error);
      alert(`批量生成失败: ${(error as Error).message || '未知错误'}`);
    } finally {
      setIsBatchGenerating(false);
      setBatchProgress(0);
    }
  };

  // 状态管理
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  // 预加载音频
  const preloadAudio = async (audio: GeneratedAudio) => {
    try {
      const audioUrl = await storageService.getAssetUrl(audio.path);
      const audioElement = new Audio(audioUrl);
      audioElement.load();
    } catch (error) {
      console.error('预加载音频失败:', error);
    }
  };

  // 切换音频选择状态
  const toggleAudioSelection = (audio: GeneratedAudio) => {
    setSelectedAudios(prev => {
      if (prev.some(a => a.id === audio.id)) {
        return prev.filter(a => a.id !== audio.id);
      } else {
        return [...prev, audio];
      }
    });
  };

  // 批量预览音频
  const batchPreviewAudios = async () => {
    if (selectedAudios.length === 0) {
      alert('请选择要预览的音频');
      return;
    }

    setIsBatchPreviewing(true);

    try {
      // 并行加载所有音频URL
      const urls = await Promise.all(
        selectedAudios.map(audio => storageService.getAssetUrl(audio.path))
      );

      setBatchPreviewUrls(urls);
      setCurrentBatchPreviewIndex(0);
    } catch (error) {
      console.error('批量预览失败:', error);
      alert('批量预览失败，请重试');
    } finally {
      setIsBatchPreviewing(false);
    }
  };

  // 播放下一个音频
  const playNextAudio = () => {
    if (currentBatchPreviewIndex < batchPreviewUrls.length - 1) {
      setCurrentBatchPreviewIndex(prev => prev + 1);
    }
  };

  // 播放上一个音频
  const playPreviousAudio = () => {
    if (currentBatchPreviewIndex > 0) {
      setCurrentBatchPreviewIndex(prev => prev - 1);
    }
  };

  // 处理从音频库选择音频
  const handleSelectLibraryAudio = async (audio: SoundEffect | MusicTrack) => {
    setLibraryAudio(audio);
    setShowAudioLibrary(false);

    // 创建GeneratedAudio对象
    const newAudio: GeneratedAudio = {
      id: `audio-${Date.now()}`,
      name: audio.name,
      path: audio.path,
      prompt: 'description' in audio ? audio.description : audio.mood || '',
      modelConfigId: modelConfigId,
      modelId: 'library',
      createdAt: Date.now(),
      duration: audio.duration,
      type: 'category' in audio ? 'sound' : 'music',
    };

    setAudios(prev => [...prev, newAudio]);
    setSelectedAudio(newAudio);
  };

  // 同步预览音视频
  const syncPreview = async (video: GeneratedVideo, audio: GeneratedAudio) => {
    try {
      setLoadingPreview(true);
      setPreviewProgress(0);

      // 并行加载音视频
      const [videoUrl, audioUrl] = await Promise.all([
        new Promise<string>(resolve => {
          storageService.getAssetUrl(video.path).then(url => {
            setPreviewProgress(50);
            resolve(url);
          });
        }),
        new Promise<string>(resolve => {
          storageService.getAssetUrl(audio.path).then(url => {
            setPreviewProgress(100);
            resolve(url);
          });
        }),
      ]);

      setPreviewVideoUrl(videoUrl);
      setPreviewAudioUrl(audioUrl);
      setIsPreviewing(true);

      // 等待预览元素加载完成后同步播放
      setTimeout(() => {
        if (videoRef.current && audioRef.current) {
          videoRef.current.currentTime = 0;
          audioRef.current.currentTime = 0;
          videoRef.current.play();
          audioRef.current.play();
        }
        setLoadingPreview(false);
      }, 100);
    } catch (error) {
      console.error('预览失败:', error);
      setLoadingPreview(false);
    }
  };

  // 添加关键帧
  const addKeyframe = () => {
    const newKeyframe: Keyframe = {
      id: `keyframe-${Date.now()}`,
      sequence: keyframes.length + 1,
      frameType: keyframes.length === 0 ? 'start' : keyframes.length === 1 ? 'end' : 'middle',
      description: `关键帧 ${keyframes.length + 1}`,
      prompt: `关键帧 ${keyframes.length + 1} 描述`,
      duration: 2,
      references: {},
      status: 'pending',
    };
    setKeyframes(prev => [...prev, newKeyframe]);
  };

  // 渲染任务状态
  const renderTaskStatus = (status: JobStatus) => {
    switch (status) {
      case JobStatus.PENDING:
        return <span className="text-yellow-500">等待中</span>;
      case JobStatus.PROCESSING:
        return <span className="text-blue-500">处理中</span>;
      case JobStatus.COMPLETED:
        return <span className="text-green-500">已完成</span>;
      case JobStatus.FAILED:
        return <span className="text-red-500">失败</span>;
      default:
        return <span className="text-gray-500">未知</span>;
    }
  };

  return (
    <div className="container mx-auto p-4 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">音视频管理</h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-md transition-colors"
        >
          返回
        </button>
      </div>

      {/* 生成控制区 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* 视频生成 */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">视频生成</h2>

          <div className="mb-4">
            <label className="block mb-2 text-slate-700 dark:text-slate-300">视频提示词</label>
            <textarea
              value={videoPrompt}
              onChange={e => setVideoPrompt(e.target.value)}
              className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md"
              rows={3}
              placeholder="请输入视频描述..."
            />
          </div>

          <div className="mb-4">
            <label className="block mb-2 text-slate-700 dark:text-slate-300">模型配置</label>
            <select
              value={modelConfigId}
              onChange={e => setModelConfigId(e.target.value)}
              className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md"
            >
              {modelConfigs
                .filter(config => config.type === 'video')
                .map(config => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="mb-4">
            <h3 className="font-medium mb-2 text-slate-700 dark:text-slate-300">关键帧</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {keyframes.map(keyframe => (
                <div
                  key={keyframe.id}
                  className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md text-slate-900 dark:text-white"
                >
                  {keyframe.frameType} 帧
                </div>
              ))}
            </div>
            <button
              onClick={addKeyframe}
              className="px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
            >
              添加关键帧
            </button>
          </div>

          <button
            onClick={generateVideo}
            disabled={isGenerating}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-colors"
          >
            {isGenerating ? '生成中...' : '生成视频'}
          </button>
        </div>

        {/* 音频生成 */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">音频生成</h2>

          <div className="mb-4">
            <label className="block mb-2 text-slate-700 dark:text-slate-300">音频类型</label>
            <select
              value={audioType}
              onChange={e => setAudioType(e.target.value as 'dialogue' | 'sound' | 'music')}
              className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md"
            >
              <option value="dialogue">对话</option>
              <option value="sound">音效</option>
              <option value="music">音乐</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block mb-2 text-slate-700 dark:text-slate-300">音频提示词</label>
            <textarea
              value={audioPrompt}
              onChange={e => setAudioPrompt(e.target.value)}
              className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md"
              rows={3}
              placeholder="请输入音频描述..."
            />
          </div>

          <div className="mb-4">
            <label className="block mb-2 text-slate-700 dark:text-slate-300">模型配置</label>
            <select
              value={modelConfigId}
              onChange={e => setModelConfigId(e.target.value)}
              className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md"
            >
              {modelConfigs
                .filter(config => config.capabilities.supportsAudioGeneration)
                .map(config => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => selectedVideo && generateAudioFromVideo(selectedVideo.id)}
              disabled={isGenerating || !selectedVideo}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-colors"
            >
              {isGenerating ? '生成中...' : '基于视频生成音频'}
            </button>
            <button
              onClick={() => setShowAudioLibrary(!showAudioLibrary)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors"
            >
              音频库
            </button>
          </div>
        </div>
      </div>

      {/* 批量生成区域 */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-800 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">批量音频生成</h2>
        <div className="mb-4">
          <label className="block mb-2 text-slate-700 dark:text-slate-300">音频类型</label>
          <select
            value={batchAudioType}
            onChange={e => setBatchAudioType(e.target.value as 'dialogue' | 'sound' | 'music')}
            className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md"
          >
            <option value="dialogue">对话</option>
            <option value="sound">音效</option>
            <option value="music">音乐</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="block mb-2 text-slate-700 dark:text-slate-300">
            批量文本（每行一个）
          </label>
          <textarea
            value={batchTexts}
            onChange={e => setBatchTexts(e.target.value)}
            className="w-full p-2 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md"
            rows={6}
            placeholder="请输入批量生成的文本，每行一个..."
          />
        </div>
        {isBatchGenerating && (
          <div className="w-full mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm text-slate-500 dark:text-slate-400">批量生成中...</span>
              <span className="text-sm text-slate-500 dark:text-slate-400">{batchProgress}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5">
              <div
                className="bg-orange-600 h-2.5 rounded-full"
                style={{ width: `${batchProgress}%` }}
              ></div>
            </div>
          </div>
        )}
        <button
          onClick={batchGenerate}
          disabled={isBatchGenerating}
          className="px-6 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-colors"
        >
          {isBatchGenerating ? '生成中...' : '批量生成音频'}
        </button>
      </div>

      {/* 资产列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* 视频列表 */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">视频资产</h2>
          <div className="space-y-4">
            {videos.map(video => (
              <div
                key={video.id}
                className={`p-3 border rounded-md cursor-pointer ${selectedVideo?.id === video.id ? 'border-primary bg-primary/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}
                onClick={() => setSelectedVideo(video)}
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-slate-900 dark:text-white">
                    {video.name || `视频 ${video.id}`}
                  </h3>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {video.duration}秒
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{video.prompt}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedVideo(video);
                    }}
                    className="px-2 py-1 text-xs bg-primary/20 text-primary rounded"
                  >
                    选择
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 音频列表 */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">音频资产</h2>
            {selectedAudios.length > 0 && (
              <button
                onClick={batchPreviewAudios}
                disabled={isBatchPreviewing}
                className="px-4 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-colors"
              >
                {isBatchPreviewing ? '加载中...' : `批量预览 (${selectedAudios.length})`}
              </button>
            )}
          </div>
          <div className="space-y-4">
            {audios.map(audio => (
              <div
                key={audio.id}
                className={`p-3 border rounded-md cursor-pointer ${selectedAudio?.id === audio.id ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}
                onClick={() => setSelectedAudio(audio)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedAudios.some(a => a.id === audio.id)}
                      onChange={e => {
                        e.stopPropagation();
                        toggleAudioSelection(audio);
                      }}
                      className="cursor-pointer"
                    />
                    <h3 className="font-medium text-slate-900 dark:text-white">
                      {audio.name || `音频 ${audio.id}`}
                    </h3>
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {audio.duration}秒
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{audio.prompt}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedAudio(audio);
                    }}
                    className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded"
                  >
                    选择
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      preloadAudio(audio);
                    }}
                    className="px-2 py-1 text-xs bg-primary/20 text-primary rounded"
                  >
                    预加载
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 同步预览 */}
      {selectedVideo && selectedAudio && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-800 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">
            音视频同步预览
          </h2>
          <div className="flex flex-col items-center">
            <div className="mb-4">
              <video
                ref={videoRef}
                src={previewVideoUrl}
                width="640"
                height="360"
                controls
                className="border border-slate-300 dark:border-slate-700 rounded-md"
              />
            </div>
            <div className="mb-4">
              <audio ref={audioRef} src={previewAudioUrl} controls className="w-full" />
            </div>
            {loadingPreview && (
              <div className="w-full max-w-md mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-slate-500 dark:text-slate-400">加载中...</span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {previewProgress}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full"
                    style={{ width: `${previewProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
            <button
              onClick={() => syncPreview(selectedVideo, selectedAudio)}
              disabled={loadingPreview}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/80 disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-colors"
            >
              {loadingPreview ? '加载中...' : '同步播放'}
            </button>
          </div>
        </div>
      )}

      {/* 批量音频预览 */}
      {selectedAudios.length > 0 && batchPreviewUrls.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-800 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">
            批量音频预览
          </h2>
          <div className="flex flex-col items-center">
            <div className="mb-4 w-full max-w-md">
              <audio src={batchPreviewUrls[currentBatchPreviewIndex]} controls className="w-full" />
            </div>
            <div className="mb-4 text-center">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {currentBatchPreviewIndex + 1} / {batchPreviewUrls.length}
              </span>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {selectedAudios[currentBatchPreviewIndex]?.prompt || ''}
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={playPreviousAudio}
                disabled={currentBatchPreviewIndex === 0}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md hover:bg-slate-300 dark:hover:bg-slate-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-colors"
              >
                上一个
              </button>
              <button
                onClick={playNextAudio}
                disabled={currentBatchPreviewIndex === batchPreviewUrls.length - 1}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md hover:bg-slate-300 dark:hover:bg-slate-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 transition-colors"
              >
                下一个
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 任务状态 */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow border border-slate-200 dark:border-slate-800">
        <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">任务状态</h2>
        <div className="space-y-2">
          {generationTasks.map(task => (
            <div
              key={task.id}
              className="p-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-md"
            >
              <div className="flex justify-between items-center">
                <span className="font-medium text-slate-900 dark:text-white">
                  {task.type === 'video' ? '视频生成' : '音频生成'}
                </span>
                {renderTaskStatus(task.status)}
              </div>
              {task.error && <p className="text-sm text-red-500 mt-1">{task.error}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* 音频库 */}
      {showAudioLibrary && (
        <div className="mt-8">
          <AudioLibrary onSelectAudio={handleSelectLibraryAudio} projectId={projectId || ''} />
        </div>
      )}
    </div>
  );
};

export default VideoAudioManager;
