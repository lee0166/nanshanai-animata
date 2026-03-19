import { GeneratedAudio, Shot, ModelConfig } from '../types';
import { storageService } from './storage';

// 音频服务接口
export interface AudioService {
  generateSpeech(text: string, options: SpeechOptions): Promise<GeneratedAudio>;
  generateSound(sceneDescription: string, options: SoundOptions): Promise<GeneratedAudio>;
  generateMusic(mood: string, options: MusicOptions): Promise<GeneratedAudio>;
  previewAudio(audioId: string): Promise<string>;
  getAudioUrl(path: string): Promise<string>;
  batchGenerateSpeech(texts: string[], options: SpeechOptions): Promise<GeneratedAudio[]>;
  batchGenerateSound(sceneDescriptions: string[], options: SoundOptions): Promise<GeneratedAudio[]>;
  batchGenerateMusic(moods: string[], options: MusicOptions): Promise<GeneratedAudio[]>;
  // 音效音乐库管理
  getSoundEffectsLibrary(): Promise<SoundEffect[]>;
  getMusicLibrary(): Promise<MusicTrack[]>;
  searchSoundEffects(query: string): Promise<SoundEffect[]>;
  searchMusic(query: string): Promise<MusicTrack[]>;
  addToLibrary(audio: GeneratedAudio): Promise<void>;
  removeFromLibrary(audioId: string): Promise<void>;
  categorizeAudio(audioId: string, category: string): Promise<void>;
}

// 语音生成选项
export interface SpeechOptions {
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  modelConfigId: string;
  projectId: string;
}

// 音效生成选项
export interface SoundOptions {
  type?: 'ambient' | 'effect' | ' Foley';
  intensity?: number;
  duration?: number;
  modelConfigId: string;
  projectId: string;
}

// 音乐生成选项
export interface MusicOptions {
  genre?: string;
  mood?: string;
  duration?: number;
  modelConfigId: string;
  projectId: string;
}

// 音效类型
export interface SoundEffect {
  id: string;
  name: string;
  path: string;
  category: string;
  description: string;
  duration: number;
  createdAt: number;
  tags: string[];
}

// 音乐类型
export interface MusicTrack {
  id: string;
  name: string;
  path: string;
  genre: string;
  mood: string;
  duration: number;
  createdAt: number;
  tags: string[];
}

// 音频缓存项
interface AudioCacheItem {
  audio: GeneratedAudio;
  timestamp: number;
  usedCount: number; // 使用次数，用于LRU缓存
}

// 获取模型配置
const getModelConfig = (modelConfigId: string): ModelConfig | undefined => {
  // 这里应该从配置中获取模型配置
  // 暂时返回undefined，实际实现中应该从settings或其他配置源获取
  return undefined;
};

// 阿里云TTS服务
class AliyunTTS {
  async generateSpeech(text: string, options: any, apiKey: string, apiSecret: string): Promise<Buffer> {
    // 实现阿里云TTS API调用
    // 这里需要使用阿里云SDK或直接调用API
    // 暂时返回模拟数据
    console.log('阿里云TTS调用:', text, options, apiKey, apiSecret);
    return Buffer.from('模拟音频数据');
  }
}

// 百度AI语音服务
class BaiduTTS {
  async generateSpeech(text: string, options: any, apiKey: string, secretKey: string): Promise<Buffer> {
    // 实现百度AI语音API调用
    // 这里需要使用百度AI SDK或直接调用API
    // 暂时返回模拟数据
    console.log('百度AI语音调用:', text, options, apiKey, secretKey);
    return Buffer.from('模拟音频数据');
  }
}

// 音频服务实现
export class AudioServiceImpl implements AudioService {
  private aliyunTTS = new AliyunTTS();
  private baiduTTS = new BaiduTTS();
  private audioCache: Map<string, AudioCacheItem> = new Map();
  private cacheTTL = 24 * 60 * 60 * 1000; // 缓存有效期：24小时
  private maxCacheSize = 100; // 最大缓存大小

  // 生成缓存键
  private generateCacheKey(type: string, prompt: string, options: any): string {
    const keyParts = [
      type,
      prompt,
      JSON.stringify(options)
    ];
    return keyParts.join('_');
  }

  // 清理过期缓存和超出大小的缓存
  private cleanupCache(): void {
    const now = Date.now();
    const items = Array.from(this.audioCache.entries());
    
    // 清理过期项
    for (const [key, item] of items) {
      if (now - item.timestamp > this.cacheTTL) {
        this.audioCache.delete(key);
      }
    }
    
    // 如果超出最大缓存大小，按照使用次数和时间清理
    if (this.audioCache.size > this.maxCacheSize) {
      const sortedItems = Array.from(this.audioCache.entries())
        .sort((a, b) => {
          // 优先按使用次数排序，其次按时间排序
          if (a[1].usedCount !== b[1].usedCount) {
            return a[1].usedCount - b[1].usedCount;
          }
          return a[1].timestamp - b[1].timestamp;
        });
      
      // 清理多余的项
      const itemsToRemove = sortedItems.slice(0, this.audioCache.size - this.maxCacheSize);
      for (const [key] of itemsToRemove) {
        this.audioCache.delete(key);
      }
    }
  }

  // 保存到缓存
  private saveToCache(key: string, audio: GeneratedAudio): void {
    this.cleanupCache();
    this.audioCache.set(key, {
      audio,
      timestamp: Date.now(),
      usedCount: 1
    });
  }

  // 从缓存获取
  private getFromCache(key: string): GeneratedAudio | null {
    this.cleanupCache();
    const item = this.audioCache.get(key);
    if (item) {
      // 更新使用次数和时间
      item.usedCount++;
      item.timestamp = Date.now();
      this.audioCache.set(key, item);
      return item.audio;
    }
    return null;
  }

  async generateSpeech(text: string, options: SpeechOptions): Promise<GeneratedAudio> {
    // 生成缓存键
    const cacheKey = this.generateCacheKey('speech', text, options);
    
    // 检查缓存
    const cachedAudio = this.getFromCache(cacheKey);
    if (cachedAudio) {
      console.log('从缓存获取语音:', text);
      return cachedAudio;
    }

    console.log('生成语音:', text, options);
    
    // 获取模型配置
    const modelConfig = getModelConfig(options.modelConfigId);
    if (!modelConfig) {
      throw new Error('模型配置不存在');
    }

    // 生成音频文件路径
    const audioId = `speech_${Date.now()}`;
    const audioPath = `audio/${options.projectId}/${audioId}.mp3`;
    
    let audioBuffer: Buffer;

    // 根据提供商调用不同的TTS服务
    if (modelConfig.provider === 'aliyun-tts') {
      // 调用阿里云TTS
      audioBuffer = await this.aliyunTTS.generateSpeech(
        text,
        {
          voice: options.voice || modelConfig.parameters?.find(p => p.name === 'voice')?.defaultValue || 'xiaqing',
          speed: options.speed || modelConfig.parameters?.find(p => p.name === 'speed')?.defaultValue || 1.0,
          pitch: options.pitch || modelConfig.parameters?.find(p => p.name === 'pitch')?.defaultValue || 1.0,
          volume: options.volume || modelConfig.parameters?.find(p => p.name === 'volume')?.defaultValue || 1.0,
        },
        modelConfig.apiKey || '',
        (modelConfig as any).apiSecret || ''
      );
    } else if (modelConfig.provider === 'baidu-tts') {
      // 调用百度AI语音
      audioBuffer = await this.baiduTTS.generateSpeech(
        text,
        {
          voice: options.voice || modelConfig.parameters?.find(p => p.name === 'voice')?.defaultValue || '1',
          speed: options.speed || modelConfig.parameters?.find(p => p.name === 'speed')?.defaultValue || 5,
          pitch: options.pitch || modelConfig.parameters?.find(p => p.name === 'pitch')?.defaultValue || 5,
          volume: options.volume || modelConfig.parameters?.find(p => p.name === 'volume')?.defaultValue || 5,
        },
        modelConfig.apiKey || '',
        (modelConfig as any).apiSecret || ''
      );
    } else {
      // 模拟实现
      audioBuffer = Buffer.from('模拟音频数据');
    }

    // 保存音频文件
    // 实际实现中，这里应该将audioBuffer保存到storageService
    
    // 保存音频信息
    const audio: GeneratedAudio = {
      id: audioId,
      path: audioPath,
      prompt: text,
      modelConfigId: options.modelConfigId,
      modelId: modelConfig.modelId,
      createdAt: Date.now(),
      duration: text.length / 10, // 估算时长
      type: 'dialogue'
    };
    
    // 保存到缓存
    this.saveToCache(cacheKey, audio);
    
    return audio;
  }

  async generateSound(sceneDescription: string, options: SoundOptions): Promise<GeneratedAudio> {
    // 生成缓存键
    const cacheKey = this.generateCacheKey('sound', sceneDescription, options);
    
    // 检查缓存
    const cachedAudio = this.getFromCache(cacheKey);
    if (cachedAudio) {
      console.log('从缓存获取音效:', sceneDescription);
      return cachedAudio;
    }

    // 模拟实现，实际应调用音频生成服务
    console.log('生成音效:', sceneDescription, options);
    
    const audioId = `sound_${Date.now()}`;
    const audioPath = `audio/${options.projectId}/${audioId}.mp3`;
    
    const audio: GeneratedAudio = {
      id: audioId,
      path: audioPath,
      prompt: sceneDescription,
      modelConfigId: options.modelConfigId,
      modelId: 'mock-sound-model',
      createdAt: Date.now(),
      duration: options.duration || 5,
      type: 'sound'
    };
    
    // 保存到缓存
    this.saveToCache(cacheKey, audio);
    
    return audio;
  }

  async generateMusic(mood: string, options: MusicOptions): Promise<GeneratedAudio> {
    // 生成缓存键
    const cacheKey = this.generateCacheKey('music', mood, options);
    
    // 检查缓存
    const cachedAudio = this.getFromCache(cacheKey);
    if (cachedAudio) {
      console.log('从缓存获取音乐:', mood);
      return cachedAudio;
    }

    // 模拟实现，实际应调用音乐生成服务
    console.log('生成音乐:', mood, options);
    
    const audioId = `music_${Date.now()}`;
    const audioPath = `audio/${options.projectId}/${audioId}.mp3`;
    
    const audio: GeneratedAudio = {
      id: audioId,
      path: audioPath,
      prompt: mood,
      modelConfigId: options.modelConfigId,
      modelId: 'mock-music-model',
      createdAt: Date.now(),
      duration: options.duration || 10,
      type: 'music'
    };
    
    // 保存到缓存
    this.saveToCache(cacheKey, audio);
    
    return audio;
  }

  async batchGenerateSpeech(texts: string[], options: SpeechOptions): Promise<GeneratedAudio[]> {
    console.log('批量生成语音:', texts.length, '条');
    
    // 并行处理，限制并发数为5
    const concurrencyLimit = 5;
    const results: GeneratedAudio[] = [];
    
    for (let i = 0; i < texts.length; i += concurrencyLimit) {
      const batch = texts.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(text => this.generateSpeech(text, options))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  async batchGenerateSound(sceneDescriptions: string[], options: SoundOptions): Promise<GeneratedAudio[]> {
    console.log('批量生成音效:', sceneDescriptions.length, '条');
    
    // 并行处理，限制并发数为5
    const concurrencyLimit = 5;
    const results: GeneratedAudio[] = [];
    
    for (let i = 0; i < sceneDescriptions.length; i += concurrencyLimit) {
      const batch = sceneDescriptions.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(description => this.generateSound(description, options))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  async batchGenerateMusic(moods: string[], options: MusicOptions): Promise<GeneratedAudio[]> {
    console.log('批量生成音乐:', moods.length, '条');
    
    // 并行处理，限制并发数为5
    const concurrencyLimit = 5;
    const results: GeneratedAudio[] = [];
    
    for (let i = 0; i < moods.length; i += concurrencyLimit) {
      const batch = moods.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(mood => this.generateMusic(mood, options))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  async previewAudio(audioId: string): Promise<string> {
    // 模拟实现，返回音频预览URL
    return `http://localhost:3000/api/preview/audio/${audioId}`;
  }

  async getAudioUrl(path: string): Promise<string> {
    // 使用存储服务获取音频URL
    return storageService.getAssetUrl(path);
  }

  // 音效音乐库管理
  async getSoundEffectsLibrary(): Promise<SoundEffect[]> {
    // 从存储服务获取音效库
    // 暂时返回模拟数据
    return [
      {
        id: 'sound-1',
        name: '海浪声',
        path: 'library/sounds/waves.mp3',
        category: '自然',
        description: '轻柔的海浪声',
        duration: 10,
        createdAt: Date.now() - 86400000,
        tags: ['自然', '海浪', '宁静']
      },
      {
        id: 'sound-2',
        name: '雨声',
        path: 'library/sounds/rain.mp3',
        category: '自然',
        description: '舒缓的雨声',
        duration: 15,
        createdAt: Date.now() - 172800000,
        tags: ['自然', '雨声', '舒缓']
      },
      {
        id: 'sound-3',
        name: '脚步声',
        path: 'library/sounds/footsteps.mp3',
        category: '环境',
        description: '走廊脚步声',
        duration: 5,
        createdAt: Date.now() - 259200000,
        tags: ['环境', '脚步', '室内']
      }
    ];
  }

  async getMusicLibrary(): Promise<MusicTrack[]> {
    // 从存储服务获取音乐库
    // 暂时返回模拟数据
    return [
      {
        id: 'music-1',
        name: '舒缓背景音乐',
        path: 'library/music/ambient.mp3',
        genre: ' ambient',
        mood: '舒缓',
        duration: 30,
        createdAt: Date.now() - 86400000,
        tags: ['舒缓', '背景', ' ambient']
      },
      {
        id: 'music-2',
        name: '紧张悬疑音乐',
        path: 'library/music/suspense.mp3',
        genre: '悬疑',
        mood: '紧张',
        duration: 25,
        createdAt: Date.now() - 172800000,
        tags: ['紧张', '悬疑', '戏剧']
      },
      {
        id: 'music-3',
        name: '欢快背景音乐',
        path: 'library/music/happy.mp3',
        genre: '流行',
        mood: '欢快',
        duration: 20,
        createdAt: Date.now() - 259200000,
        tags: ['欢快', '背景', '流行']
      }
    ];
  }

  async searchSoundEffects(query: string): Promise<SoundEffect[]> {
    // 搜索音效
    const library = await this.getSoundEffectsLibrary();
    return library.filter(sound => 
      sound.name.toLowerCase().includes(query.toLowerCase()) ||
      sound.description.toLowerCase().includes(query.toLowerCase()) ||
      sound.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );
  }

  async searchMusic(query: string): Promise<MusicTrack[]> {
    // 搜索音乐
    const library = await this.getMusicLibrary();
    return library.filter(music => 
      music.name.toLowerCase().includes(query.toLowerCase()) ||
      music.genre.toLowerCase().includes(query.toLowerCase()) ||
      music.mood.toLowerCase().includes(query.toLowerCase()) ||
      music.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
    );
  }

  async addToLibrary(audio: GeneratedAudio): Promise<void> {
    // 将音频添加到库
    console.log('添加到库:', audio.id, audio.type);
    // 实际实现中，应该将音频信息保存到存储服务
  }

  async removeFromLibrary(audioId: string): Promise<void> {
    // 从库中移除音频
    console.log('从库中移除:', audioId);
    // 实际实现中，应该从存储服务中删除音频信息
  }

  async categorizeAudio(audioId: string, category: string): Promise<void> {
    // 对音频进行分类
    console.log('分类音频:', audioId, category);
    // 实际实现中，应该更新存储服务中的音频分类信息
  }
}

// 导出音频服务实例
export const audioService = new AudioServiceImpl();

// 导出默认服务
export default audioService;