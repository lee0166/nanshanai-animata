/**
 * 视听语言匹配验证器
 * 
 * 验证音效、运镜与画面情绪/叙事目标的匹配度
 * 确保音画一致性和视听语言的合理性
 */

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
}

export class AudioVisualValidator {
  private readonly SOUND_EFFECT_EMOTION_MAP: Record<string, string[]> = {
    '乌鸦啼叫': ['悲凉', '死亡', '不祥', '恐惧', '荒凉', '孤独', '凄凉', '苍凉'],
    '风声': ['空旷', '孤独', '自由', '凄凉', '环境', '氛围', '自然', '苍凉', '辽阔', '空旷', '萧瑟', '环境交代'],
    '魔法音效': ['奇幻', '神秘', '力量', '觉醒', '魔法', '灵力', '能量'],
    '脚步声': ['行走', '奔跑', '逃离', '追踪', '移动', '靠近', '远离'],
    '水声': ['宁静', '流动', '悲伤', '洗涤', '清澈', '潺潺', '河流', '瀑布'],
    '爆炸声': ['冲击', '爆发', '毁灭', '重生', '破坏', '冲击波'],
    '金属碰撞': ['战斗', '紧张', '危险', '对抗', '武器', '刀剑', '交锋'],
    '鸟鸣': ['平静', '生机', '希望', '清晨', '自然', '和谐', '宁静'],
    '雷鸣': ['震撼', '威严', '突变', '力量', '天威', '自然力量'],
    '钟声': ['庄严', '神圣', '警示', '时间', '宗门', '仪式', '庄重'],
    '虎啸': ['威猛', '凶险', '力量', '野兽', '威胁'],
    '龙吟': ['威严', '神秘', '力量', '古老', '传承'],
    '树叶沙沙': ['宁静', '微风', '自然', '平和', '隐秘', '窃窃私语'],
    '火焰燃烧': ['温暖', '危险', '毁灭', '光明', '炼丹', '炼器'],
    '灵气波动': ['灵力', '觉醒', '突破', '能量', '神秘', '奇幻'],
    '剑鸣': ['战斗', '剑意', '锋利', '危险', '对抗', '修仙'],
    '鹤鸣': ['仙家', '神圣', '高远', '清幽', '宗门', '仙境'],
  };
  
  private readonly SCENE_CONTEXT_SOUND_MAP: Record<string, string[]> = {
    '山门': ['风声', '鸟鸣', '鹤鸣', '钟声'],
    '杂役院': ['脚步声', '水声', '火焰燃烧', '鸟鸣'],
    '后山': ['风声', '树叶沙沙', '鸟鸣', '水声', '乌鸦啼叫'],
    '悬崖': ['风声', '乌鸦啼叫', '水声', '雷鸣'],
    '炼丹房': ['火焰燃烧', '魔法音效', '灵气波动'],
    '宗门': ['钟声', '鹤鸣', '风声', '鸟鸣'],
  };
  
  private readonly CAMERA_MOVEMENT_NARRATIVE_MAP: Record<string, string[]> = {
    'push': ['强调', '揭示', '情绪聚焦', '内心活动'],
    'pull': ['拉开距离', '结束', '转场', '环境交代'],
    'pan': ['跟随', '空间关系', '环境探索'],
    'track': ['动作追踪', '移动', '奔跑', '战斗'],
    'static': ['客观观察', '环境交代', '静止', '对峙'],
    'zoom_in': ['聚焦', '情绪爆发', '关键时刻'],
    'zoom_out': ['拉开', '结束', '环境关系'],
    'dolly_in': ['推进', '深入', '情绪聚焦'],
    'dolly_out': ['退出', '拉开', '环境关系'],
  };
  
  validate(shot: any): ValidationResult {
    const warnings: string[] = [];
    
    if (shot.sound && shot.description) {
      const soundMatch = this.validateSoundEffect(shot.sound, shot.description, shot.sceneName);
      if (!soundMatch.isValid) {
        warnings.push(...soundMatch.warnings);
      }
    }
    
    if (shot.cameraMovement && shot.description) {
      const movementMatch = this.validateCameraMovement(shot.cameraMovement, shot.description, shot.dialogue);
      if (!movementMatch.isValid) {
        warnings.push(...movementMatch.warnings);
      }
    }
    
    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }
  
  private validateSoundEffect(sound: string, description: string, sceneName?: string): ValidationResult {
    const warnings: string[] = [];
    
    for (const [soundEffect, emotions] of Object.entries(this.SOUND_EFFECT_EMOTION_MAP)) {
      if (sound.includes(soundEffect)) {
        const descriptionEmotions = this.extractEmotionFromDescription(description);
        const hasMatchingEmotion = emotions.some(emotion => 
          descriptionEmotions.includes(emotion)
        );
        
        // 如果情绪不匹配，但音效符合当前场景的上下文，则降低警告级别
        if (!hasMatchingEmotion) {
          const isContextValid = sceneName && this.isSoundContextValidForScene(soundEffect, sceneName);
          if (!isContextValid) {
            warnings.push(
              `音效"${soundEffect}"的情绪暗示（${emotions.join('、')}）与画面描述的情绪不匹配。` +
              `建议更换音效或调整画面描述。`
            );
          }
        }
      }
    }
    
    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }
  
  private isSoundContextValidForScene(soundEffect: string, sceneName: string): boolean {
    for (const [sceneKeyword, validSounds] of Object.entries(this.SCENE_CONTEXT_SOUND_MAP)) {
      if (sceneName.includes(sceneKeyword)) {
        return validSounds.includes(soundEffect);
      }
    }
    return false;
  }
  
  private validateCameraMovement(movement: string, description: string, dialogue?: string): ValidationResult {
    const warnings: string[] = [];
    
    const hasInnerMonologue = description.includes('内心') || description.includes('想') || description.includes('暗道') || (dialogue && dialogue.length > 5);
    const hasPropFocus = description.includes('玉佩') || description.includes('道具') || description.includes('宝物');
    const hasFaceFocus = description.includes('面部') || description.includes('眼神') || description.includes('表情');
    
    if ((movement === 'push' || movement === 'zoom_in') && hasPropFocus && !hasFaceFocus && hasInnerMonologue) {
      warnings.push(
        `内心独白/台词场景应聚焦角色面部表情，而非道具特写。` +
        `建议改为"面部特写推镜"或"眼神特写推镜"。`
      );
    }
    
    if ((movement === 'track' || movement === 'crane') && (description.includes('对峙') || description.includes('静止') || description.includes('沉默'))) {
      warnings.push(
        `对峙/静止场景适合使用固定镜头或缓慢推镜，不宜使用快速跟拍或升降。` +
        `建议改为"static(静止)"或"push(缓慢推镜)"。`
      );
    }
    
    return {
      isValid: warnings.length === 0,
      warnings,
    };
  }
  
  private extractEmotionFromDescription(description: string): string[] {
    const emotionKeywords: Record<string, string[]> = {
      '悲凉': ['凄凉', '悲伤', '孤独', '落寞', '荒芜'],
      '力量': ['爆发', '强大', '震撼', '冲击'],
      '宁静': ['平静', '安静', '祥和', '宁静'],
      '紧张': ['紧张', '危急', '危险', '紧迫'],
      '奇幻': ['神秘', '奇异', '光芒', '闪烁'],
      '恐惧': ['恐惧', '害怕', '惊恐', '颤抖'],
      '希望': ['希望', '光明', '新生', '觉醒'],
      '愤怒': ['愤怒', '怒吼', '咆哮', '狂暴'],
      '隐忍': ['隐忍', '克制', '咬紧', '攥紧'],
      '坚毅': ['坚毅', '坚定', '果断', '稳定'],
    };
    
    const matched: string[] = [];
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      if (keywords.some(kw => description.includes(kw))) {
        matched.push(emotion);
      }
    }
    
    return matched;
  }
}
