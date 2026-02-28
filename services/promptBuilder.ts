import { ScriptCharacter, ScriptScene } from '../types';

/**
 * 角色提示词构建器
 * 根据结构化数据智能组装角色生图提示词
 */
export class CharacterPromptBuilder {
  // 临时性物品列表 - 这些物品不应该出现在角色设定图中
  private static readonly TEMPORARY_ITEMS = [
    '文件', '笔记本', '咖啡', '手机', '纸张', '文档', '杯子', 
    '水杯', '笔', '文件夹', '报纸', '杂志', '书本', '包', '袋',
    '食物', '饮料', '零食', '烟', '伞', '钥匙', '钱包'
  ];

  // 脚部关键词 - 用于检测是否已有脚部描述
  private static readonly FOOT_KEYWORDS = ['鞋', '靴', '履', '足', '脚', '袜'];

  /**
   * 构建角色生图提示词
   * @param character 剧本角色数据
   * @returns 纯净的角色设定图提示词
   */
  static build(character: ScriptCharacter): string {
    const parts: string[] = [];
    
    // 1. 基础外貌信息
    const app = character.appearance;
    if (app.face) parts.push(app.face);
    if (app.hair) parts.push(app.hair);
    if (app.clothing) parts.push(app.clothing);
    if (app.build) parts.push(app.build);
    if (app.height) parts.push(app.height);
    
    // 2. 固有物品（过滤临时物品）
    const permanentItems = this.filterPermanentItems(character.signatureItems);
    if (permanentItems.length > 0) {
      parts.push(`随身物品：${permanentItems.join('、')}`);
    }
    
    // 3. 智能补充脚部描述（针对全身图）
    if (!this.hasFootwearDescription(parts)) {
      const footwear = this.inferFootwear(app.clothing);
      if (footwear) parts.push(footwear);
    }
    
    // 4. 组装最终提示词
    let prompt = parts.join('，');
    
    // 5. 添加全身图要求
    prompt += '，全身图，三视图（正面、侧面、背面），纯白背景';
    
    return prompt;
  }

  /**
   * 过滤临时物品，只保留固有物品
   */
  private static filterPermanentItems(items: string[]): string[] {
    if (!items || items.length === 0) return [];
    
    return items.filter(item => {
      const itemLower = item.toLowerCase();
      return !this.TEMPORARY_ITEMS.some(temp => itemLower.includes(temp));
    });
  }

  /**
   * 检查是否已有脚部描述
   */
  private static hasFootwearDescription(parts: string[]): boolean {
    return parts.some(part => 
      this.FOOT_KEYWORDS.some(keyword => part.includes(keyword))
    );
  }

  /**
   * 根据服装风格推断鞋子类型
   */
  private static inferFootwear(clothing?: string): string {
    if (!clothing) return '脚穿与服装搭配的鞋子';
    
    const clothingLower = clothing.toLowerCase();
    
    // 古装/汉服/仙侠
    if (clothingLower.includes('古') || 
        clothingLower.includes('汉') || 
        clothingLower.includes('仙') ||
        clothingLower.includes('侠') ||
        clothingLower.includes('唐') ||
        clothingLower.includes('宋') ||
        clothingLower.includes('明') ||
        clothingLower.includes('清')) {
      return '脚穿传统布靴';
    }
    
    // 西装/职业装
    if (clothingLower.includes('西装') || 
        clothingLower.includes('职业') ||
        clothingLower.includes('正装') ||
        clothingLower.includes('商务')) {
      return '脚穿皮鞋';
    }
    
    // 休闲装
    if (clothingLower.includes('休闲') || 
        clothingLower.includes('运动') ||
        clothingLower.includes('牛仔')) {
      return '脚穿休闲鞋';
    }
    
    // 学生装
    if (clothingLower.includes('校') || 
        clothingLower.includes('学生')) {
      return '脚穿学生鞋';
    }
    
    return '脚穿与服装搭配的鞋子';
  }
}

/**
 * 场景提示词构建器
 * 根据结构化数据智能组装场景生图提示词
 */
export class ScenePromptBuilder {
  // 人物动作关键词 - 用于过滤
  private static readonly ACTION_KEYWORDS = [
    '坐', '站', '走', '跑', '躺', '靠', '拿', '握', '举', '抱',
    '推', '拉', '踢', '跳', '蹲', '趴', '倚', '扶', '摸', '指'
  ];

  /**
   * 构建场景生图提示词
   * @param scene 剧本场景数据
   * @returns 纯净的场景环境提示词
   */
  static build(scene: ScriptScene): string {
    const parts: string[] = [];
    
    // 1. 基础环境描述
    const env = scene.environment;
    if (env.architecture) parts.push(env.architecture);
    
    // 2. 陈设物品（过滤人物相关）
    if (env.furnishings?.length) {
      const cleanFurnishings = this.filterCharacterRelated(env.furnishings);
      if (cleanFurnishings.length > 0) {
        parts.push(`陈设：${cleanFurnishings.join('、')}`);
      }
    }
    
    // 3. 光线和色调
    if (env.lighting) parts.push(env.lighting);
    if (env.colorTone) parts.push(env.colorTone);
    
    // 4. 时间和天气
    if (scene.timeOfDay) parts.push(scene.timeOfDay);
    if (scene.weather) parts.push(scene.weather);
    
    // 5. 过滤人物动作后的描述
    const cleanDescription = this.removeCharacterActions(scene.description);
    if (cleanDescription) parts.push(cleanDescription);
    
    // 6. 组装最终提示词
    let prompt = parts.join('，');
    
    // 7. 添加场景图要求
    prompt += '，场景设定图，无人物，适合作为影视背景';
    
    return prompt;
  }

  /**
   * 过滤与人物相关的陈设描述
   */
  private static filterCharacterRelated(furnishings: string[]): string[] {
    return furnishings.filter(item => {
      const itemLower = item.toLowerCase();
      // 过滤包含人物动作的描述
      return !this.ACTION_KEYWORDS.some(action => itemLower.includes(action));
    });
  }

  /**
   * 移除人物动作描述
   */
  private static removeCharacterActions(description: string): string {
    if (!description) return '';
    
    let cleaned = description;
    
    // 定义人物动作模式
    // 格式：[人名] + [动作] + [内容]
    const actionPatterns = [
      // 匹配：任意文字 + 动作 + 任意文字 + 标点
      /[^，。]*(?:坐|站|走|跑|躺|靠|拿|握|举|抱|推|拉|踢|跳|蹲|趴|倚|扶|摸|指)[^，。]*[，。；]/g,
    ];
    
    // 多次应用过滤，直到没有匹配
    let previous = '';
    let iterations = 0;
    const maxIterations = 10;
    
    do {
      previous = cleaned;
      actionPatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
      });
      iterations++;
    } while (cleaned !== previous && iterations < maxIterations);
    
    // 清理多余的标点
    cleaned = cleaned.replace(/，{2,}/g, '，');
    cleaned = cleaned.replace(/。{2,}/g, '。');
    cleaned = cleaned.replace(/；{2,}/g, '；');
    cleaned = cleaned.replace(/^[，。；\s]+|[，。；\s]+$/g, '');
    
    return cleaned.trim();
  }
}
