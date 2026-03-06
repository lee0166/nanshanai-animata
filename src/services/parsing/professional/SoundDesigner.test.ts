/**
 * SoundDesigner 单元测试
 */

import { describe, it, expect } from 'vitest';
import { SoundDesigner } from './SoundDesigner';
import type { ScriptMetadata, Shot } from '../../../../types';

const soundDesigner = new SoundDesigner();

describe('SoundDesigner', () => {
  // 创建测试用的 metadata
  const createMockMetadata = (overrides?: Partial<ScriptMetadata>): ScriptMetadata => ({
    title: '测试剧本',
    wordCount: 5000,
    estimatedDuration: '25分钟',
    characterCount: 3,
    characterNames: ['张三', '李四', '王五'],
    sceneCount: 5,
    sceneNames: ['客厅', '街道', '办公室'],
    chapterCount: 3,
    genre: '都市',
    tone: '正剧',
    emotionalArc: [
      { plotPoint: '开场', emotion: '平静', intensity: 3, colorTone: '明亮', percentage: 0 },
      { plotPoint: '冲突开始', emotion: '紧张', intensity: 6, colorTone: '阴暗', percentage: 25 },
      { plotPoint: '中点转折', emotion: '焦虑', intensity: 8, colorTone: '冷色', percentage: 50 },
      { plotPoint: '高潮', emotion: '激动', intensity: 10, colorTone: '鲜艳', percentage: 75 },
      { plotPoint: '结局', emotion: '喜悦', intensity: 5, colorTone: '温暖', percentage: 100 },
    ],
    visualStyle: {
      artDirection: '写实电影感',
      artStyle: '现代',
      artStyleDescription: '现代都市风格',
      colorPalette: ['蓝色', '灰色', '白色'],
      colorMood: '冷峻压抑',
      cinematography: '电影感构图',
      lightingStyle: '戏剧光',
    },
    ...overrides,
  });

  // 创建测试用的 shots
  const createMockShots = (): Shot[] => [
    { id: '1', sequence: 1, sceneName: '客厅', shotType: 'medium', cameraMovement: 'static', description: '开场', sound: '雨声', duration: 3, characters: ['张三'] },
    { id: '2', sequence: 2, sceneName: '客厅', shotType: 'close_up', cameraMovement: 'push', description: '特写', sound: '紧张配乐', duration: 2, characters: ['张三'] },
    { id: '3', sequence: 3, sceneName: '街道', shotType: 'long', cameraMovement: 'pan', description: '街景', sound: '城市环境音', duration: 5, characters: ['李四'] },
    { id: '4', sequence: 4, sceneName: '办公室', shotType: 'medium', cameraMovement: 'static', description: '对话', sound: '电话铃声', duration: 4, characters: ['张三', '王五'] },
  ];

  describe('analyze', () => {
    it('应该正确分析声音设计', () => {
      const metadata = createMockMetadata();
      const shots = createMockShots();

      const result = soundDesigner.analyze(metadata, shots);

      // 验证返回结构
      expect(result).toHaveProperty('emotionalMusicMap');
      expect(result).toHaveProperty('soundPalette');
      expect(result).toHaveProperty('overallSoundscape');
      expect(result).toHaveProperty('statistics');

      // 验证情绪音乐映射
      expect(result.emotionalMusicMap).toHaveLength(5);
      expect(result.emotionalMusicMap[0]).toHaveProperty('plotPoint');
      expect(result.emotionalMusicMap[0]).toHaveProperty('emotion');
      expect(result.emotionalMusicMap[0]).toHaveProperty('suggestedMusic');

      // 验证声音调色板
      expect(result.soundPalette).toHaveProperty('ambientSounds');
      expect(result.soundPalette).toHaveProperty('effectSounds');
      expect(result.soundPalette).toHaveProperty('musicThemes');

      // 验证整体音景
      expect(result.overallSoundscape).toHaveProperty('dominantMood');
      expect(result.overallSoundscape).toHaveProperty('backgroundTone');
      expect(result.overallSoundscape).toHaveProperty('dynamicRange');

      // 验证统计信息
      expect(result.statistics.totalShots).toBe(4);
      expect(result.statistics.shotsWithSound).toBe(4);
    });

    it('应该正确处理空 shots 数组', () => {
      const metadata = createMockMetadata();
      const result = soundDesigner.analyze(metadata, []);

      expect(result.statistics.totalShots).toBe(0);
      expect(result.statistics.shotsWithSound).toBe(0);
      expect(result.soundPalette.ambientSounds).toHaveLength(0);
      expect(result.soundPalette.effectSounds).toHaveLength(0);
      expect(result.soundPalette.musicThemes).toHaveLength(0);
    });

    it('应该正确处理空 emotionalArc', () => {
      const metadata = createMockMetadata({ emotionalArc: [] });
      const shots = createMockShots();

      const result = soundDesigner.analyze(metadata, shots);

      expect(result.emotionalMusicMap).toHaveLength(0);
      expect(result.overallSoundscape.dominantMood).toBe('中性');
    });

    it('应该正确分类声音类型', () => {
      const metadata = createMockMetadata();
      const shots: Shot[] = [
        { id: '1', sequence: 1, sceneName: '测试', shotType: 'medium', cameraMovement: 'static', description: '测试', sound: '雨声', duration: 3, characters: [] },
        { id: '2', sequence: 2, sceneName: '测试', shotType: 'medium', cameraMovement: 'static', description: '测试', sound: '电话铃声', duration: 3, characters: [] },
        { id: '3', sequence: 3, sceneName: '测试', shotType: 'medium', cameraMovement: 'static', description: '测试', sound: '紧张配乐', duration: 3, characters: [] },
      ];

      const result = soundDesigner.analyze(metadata, shots);

      // 雨声应该被分类为环境音
      expect(result.soundPalette.ambientSounds).toContain('雨声');
      // 电话铃声应该被分类为音效
      expect(result.soundPalette.effectSounds).toContain('电话铃声');
      // 紧张配乐应该被分类为音乐主题
      expect(result.soundPalette.musicThemes).toContain('紧张配乐');
    });

    it('应该根据情绪推荐合适的音乐', () => {
      const metadata = createMockMetadata({
        emotionalArc: [
          { plotPoint: '悲伤场景', emotion: '悲伤', intensity: 8, colorTone: '阴暗', percentage: 50 },
          { plotPoint: '喜悦场景', emotion: '喜悦', intensity: 7, colorTone: '明亮', percentage: 100 },
        ],
      });

      const result = soundDesigner.analyze(metadata, []);

      // 悲伤情绪应该有忧郁的音乐推荐
      const sadMusic = result.emotionalMusicMap[0].suggestedMusic;
      expect(['大提琴独奏', '忧郁钢琴', '弦乐慢板', '哀婉笛声']).toContain(sadMusic);

      // 喜悦情绪应该有欢快的音乐推荐
      const happyMusic = result.emotionalMusicMap[1].suggestedMusic;
      expect(['轻快钢琴', '明亮弦乐', '欢快节奏', '民谣吉他', '爵士乐']).toContain(happyMusic);
    });

    it('应该正确计算动态范围', () => {
      const metadata = createMockMetadata({
        emotionalArc: [
          { plotPoint: '低强度', emotion: '平静', intensity: 1, colorTone: '明亮', percentage: 0 },
          { plotPoint: '高强度', emotion: '激动', intensity: 10, colorTone: '鲜艳', percentage: 100 },
        ],
      });

      const result = soundDesigner.analyze(metadata, []);

      // 强度范围 1-10，应该返回极宽动态范围
      expect(result.overallSoundscape.dynamicRange).toContain('极宽');
    });
  });
});
