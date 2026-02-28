import { describe, it, expect } from 'vitest';
import { CharacterPromptBuilder, ScenePromptBuilder } from './promptBuilder';
import { ScriptCharacter, ScriptScene } from '../types';

describe('CharacterPromptBuilder', () => {
  it('should build character prompt with all appearance fields', () => {
    const character: ScriptCharacter = {
      name: '苏晴',
      gender: 'female',
      age: '22',
      identity: '实习生',
      appearance: {
        face: '清秀面容，鹅蛋脸',
        hair: '普通长发自然垂肩',
        clothing: '白色衬衫搭配深色西裤职业装',
        build: '体型苗条',
        height: '中等身高约165cm'
      },
      personality: ['认真', '细心'],
      signatureItems: ['玉佩', '笔记本'],
      emotionalArc: [],
      relationships: [],
      visualPrompt: '原始visualPrompt'
    };

    const prompt = CharacterPromptBuilder.build(character);
    
    console.log('Generated character prompt:', prompt);
    
    // 验证包含外貌描述
    expect(prompt).toContain('清秀面容');
    expect(prompt).toContain('普通长发');
    expect(prompt).toContain('白色衬衫');
    
    // 验证包含固有物品（玉佩），不包含临时物品（笔记本）
    expect(prompt).toContain('玉佩');
    expect(prompt).not.toContain('笔记本');
    
    // 验证智能补充了脚部描述
    expect(prompt).toContain('脚穿');
    
    // 验证包含全身图要求
    expect(prompt).toContain('全身图');
    expect(prompt).toContain('三视图');
  });

  it('should filter temporary items correctly', () => {
    const character: ScriptCharacter = {
      name: '测试角色',
      appearance: {
        face: '面容描述',
        clothing: '古装长袍'
      },
      personality: [],
      signatureItems: ['文件', '咖啡', '长剑', '手机', '玉佩'],
      emotionalArc: [],
      relationships: [],
      visualPrompt: '测试visualPrompt'
    };

    const prompt = CharacterPromptBuilder.build(character);
    
    // 验证过滤了临时物品
    expect(prompt).not.toContain('文件');
    expect(prompt).not.toContain('咖啡');
    expect(prompt).not.toContain('手机');
    
    // 验证保留了固有物品
    expect(prompt).toContain('长剑');
    expect(prompt).toContain('玉佩');
  });

  it('should infer footwear based on clothing style', () => {
    const character1: ScriptCharacter = {
      name: '古装角色',
      appearance: { clothing: '汉服长裙' },
      personality: [],
      signatureItems: [],
      emotionalArc: [],
      relationships: [],
      visualPrompt: '测试visualPrompt'
    };
    
    const prompt1 = CharacterPromptBuilder.build(character1);
    expect(prompt1).toContain('传统布靴');
    
    const character2: ScriptCharacter = {
      name: '商务角色',
      appearance: { clothing: '西装套装' },
      personality: [],
      signatureItems: [],
      emotionalArc: [],
      relationships: [],
      visualPrompt: '测试visualPrompt'
    };
    
    const prompt2 = CharacterPromptBuilder.build(character2);
    expect(prompt2).toContain('皮鞋');
  });
});

describe('ScenePromptBuilder', () => {
  it('should build scene prompt with environment only', () => {
    const scene: ScriptScene = {
      name: '江哲办公室',
      locationType: 'indoor',
      description: '现代商务办公室内景',
      timeOfDay: '白天',
      weather: '晴朗',
      environment: {
        architecture: '现代商务办公室',
        furnishings: ['办公桌', '办公椅', '文件柜', '笔记本电脑'],
        lighting: '自然光从落地窗洒入',
        colorTone: '冷色调'
      },
      sceneFunction: '工作场景',
      visualPrompt: '原始visualPrompt',
      characters: ['江哲', '苏晴']
    };

    const prompt = ScenePromptBuilder.build(scene);
    
    console.log('Generated scene prompt:', prompt);
    
    // 验证包含环境描述
    expect(prompt).toContain('现代商务办公室');
    expect(prompt).toContain('办公桌');
    expect(prompt).toContain('自然光');
    
    // 验证包含场景图要求
    expect(prompt).toContain('场景设定图');
    expect(prompt).toContain('无人物');
  });

  it('should build scene with simple description', () => {
    const scene: ScriptScene = {
      name: '测试场景',
      locationType: 'indoor',
      description: '客厅，有沙发和茶几',
      environment: {
        architecture: '客厅',
        furnishings: ['沙发', '茶几']
      },
      sceneFunction: '测试',
      visualPrompt: '',
      characters: []
    };

    const prompt = ScenePromptBuilder.build(scene);
    
    // 验证保留了环境描述
    expect(prompt).toContain('客厅');
    expect(prompt).toContain('沙发');
    expect(prompt).toContain('场景设定图');
  });
});
