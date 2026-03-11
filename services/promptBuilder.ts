import { ScriptCharacter, ScriptScene } from '../types';

/**
 * 角色提示词构建器
 * 根据结构化数据智能组装角色生图提示词
 */
export class CharacterPromptBuilder {
  // 临时性物品列表 - 这些物品不应该出现在角色设定图中
  private static readonly TEMPORARY_ITEMS = [
    '文件',
    '笔记本',
    '咖啡',
    '手机',
    '纸张',
    '文档',
    '杯子',
    '水杯',
    '笔',
    '文件夹',
    '报纸',
    '杂志',
    '书本',
    '包',
    '袋',
    '食物',
    '饮料',
    '零食',
    '烟',
    '伞',
    '钥匙',
    '钱包',
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
    return parts.some(part => this.FOOT_KEYWORDS.some(keyword => part.includes(keyword)));
  }

  /**
   * 根据服装风格推断鞋子类型
   */
  private static inferFootwear(clothing?: string): string {
    if (!clothing) return '脚穿与服装搭配的鞋子';

    const clothingLower = clothing.toLowerCase();

    // 古装/汉服/仙侠
    if (
      clothingLower.includes('古') ||
      clothingLower.includes('汉') ||
      clothingLower.includes('仙') ||
      clothingLower.includes('侠') ||
      clothingLower.includes('唐') ||
      clothingLower.includes('宋') ||
      clothingLower.includes('明') ||
      clothingLower.includes('清')
    ) {
      return '脚穿传统布靴';
    }

    // 西装/职业装
    if (
      clothingLower.includes('西装') ||
      clothingLower.includes('职业') ||
      clothingLower.includes('正装') ||
      clothingLower.includes('商务')
    ) {
      return '脚穿皮鞋';
    }

    // 休闲装
    if (
      clothingLower.includes('休闲') ||
      clothingLower.includes('运动') ||
      clothingLower.includes('牛仔')
    ) {
      return '脚穿休闲鞋';
    }

    // 学生装
    if (clothingLower.includes('校') || clothingLower.includes('学生')) {
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
    '坐',
    '站',
    '走',
    '跑',
    '躺',
    '靠',
    '拿',
    '握',
    '举',
    '抱',
    '推',
    '拉',
    '踢',
    '跳',
    '蹲',
    '趴',
    '倚',
    '扶',
    '摸',
    '指',
    '看',
    '听',
    '说',
    '笑',
    '哭',
    '怒',
    '喜',
    '悲',
    '思',
    '望',
    '打',
    '杀',
    '砍',
    '刺',
    '斩',
    '劈',
    '挡',
    '防',
    '攻',
    '守',
    '追',
    '逃',
    '躲',
    '藏',
    '寻',
    '找',
    '遇',
    '见',
    '会',
    '聚',
  ];

  // 剧情动词关键词 - 用于过滤剧情描述
  private static readonly PLOT_KEYWORDS = [
    '对峙',
    '接受',
    '臣服',
    '效忠',
    '见证',
    '博弈',
    '对决',
    '争吵',
    '谈判',
    '商议',
    '讨论',
    '表白',
    '告别',
    '相遇',
    '重逢',
    '离别',
    '合作',
    '对抗',
    '冲突',
    '和解',
    '妥协',
    '胜利',
    '失败',
    '达成',
    '揭露',
    '发现',
    '揭示',
    '宣布',
    '宣告',
    '庆祝',
    '哀悼',
    '审判',
    '质问',
    '指责',
    '辩护',
    '请求',
    '命令',
    '威胁',
    '利诱',
    '欺骗',
    '背叛',
    '忠诚',
    '陷害',
    '拯救',
    '保护',
    '攻击',
    '防守',
    '进攻',
    '策划',
    '密谋',
    '商议',
    '协商',
    '交流',
    '沟通',
    '争吵',
    '打斗',
    '厮杀',
    '战斗',
    '战争',
    '战役',
    '决战',
    '决胜',
    '较量',
    '比拼',
  ];

  // 剧情句式模式 - 用于过滤包含剧情的句子
  private static readonly PLOT_PATTERNS = [
    /[^，。]*(?:在此|这里|此处)[^，。]*[，。；]/g, // "在此..."句式
    /[^，。]*(?:进行|发生|展开|上演)[^，。]*[，。；]/g, // 剧情发展描述
    /[^，。]*(?:最终|最后|结局|落幕|收场|结束)[^，。]*[，。；]/g, // 结局描述
    /[^，。]*(?:职场|宫廷|江湖|战场|商场|情场)[^，。]*[，。；]/g, // 场景类型+剧情
    /[^，。]*(?:的|之)(?:对峙|博弈|对决|冲突|战争|战斗|较量)[^，。]*[，。；]/g, // "...的对峙"等
    /[^，。]*(?:并|且|又|还)[^，。]*(?:接受|臣服|效忠|见证|参与|经历)[^，。]*[，。；]/g, // 连词+剧情动词
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
    if (env?.architecture) parts.push(env.architecture);

    // 2. 陈设物品（过滤人物相关）
    if (env?.furnishings?.length) {
      const cleanFurnishings = this.filterCharacterRelated(env.furnishings);
      if (cleanFurnishings.length > 0) {
        parts.push(`陈设：${cleanFurnishings.join('、')}`);
      }
    }

    // 3. 光线和色调
    if (env?.lighting) parts.push(env.lighting);
    if (env?.colorTone) parts.push(env.colorTone);

    // 4. 时间和天气
    if (scene.timeOfDay) parts.push(scene.timeOfDay);
    if (scene.weather) parts.push(scene.weather);

    // 5. 多层级过滤描述
    let cleanDescription = scene.description || '';

    // 5.1 过滤人物动作
    cleanDescription = this.removeCharacterActions(cleanDescription);

    // 5.2 过滤剧情描述
    cleanDescription = this.removePlotDescriptions(cleanDescription);

    // 5.3 过滤人名（使用characters数组）
    if (scene.characters?.length) {
      cleanDescription = this.removeCharacterNames(cleanDescription, scene.characters);
    }

    // 5.4 过滤介词引导的人物相关短语
    cleanDescription = this.removeCharacterPhrases(cleanDescription);

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
    // 定义需要过滤的特定模式（而不是简单的关键字包含）
    const filterPatterns = [
      /坐|站|躺|靠|拿|握|举|抱|推|拉|踢|跳|蹲|趴|倚|扶|摸|指.*着|了|过/,
      /对峙|谈判|争吵|商议|讨论|表白|告别|相遇|重逢|离别|合作|对抗|冲突|和解/,
      /进行|发生|展开|上演/,
    ];

    return furnishings.filter(item => {
      // 只过滤明确包含动作描述的陈设，保留普通物品名称
      return !filterPatterns.some(pattern => pattern.test(item));
    });
  }

  /**
   * 移除人物动作描述
   */
  private static removeCharacterActions(description: string): string {
    if (!description) return '';

    let cleaned = description;

    // 定义动作句式模式 - 这些模式更精确地匹配动作描述
    const actionPatterns = [
      // 匹配：人名/代词 + 动作 + 内容
      /[^，。]*(?:坐在|站在|躺在|靠在|拿着|握着|举着|抱着|推着|拉着|踢着|跳着|蹲着|趴着|倚着|扶着|摸着|指着)[^，。]*[，。；]/g,
      /[^，。]*(?:坐下|站起|躺倒|靠近|拿走|握住|举起|抱住|推开|拉开|踢开|跳起|蹲下|趴下|倚靠|扶住|摸出|指向)[^，。]*[，。；]/g,
      /[^，。]*(?:坐在|站在|躺在|靠在|拿着|握着|举着|抱着|推着|拉着|踢着|跳着|蹲着|趴着|倚着|扶着|摸着|指着)[^，。]*$/g,
      // 匹配：动作 + 着/了/过 + 内容
      /[^，。]*(?:坐|站|躺|靠|拿|握|举|抱|推|拉|踢|跳|蹲|趴|倚|扶|摸|指)着[^，。]*[，。；]/g,
      /[^，。]*(?:坐|站|躺|靠|拿|握|举|抱|推|拉|踢|跳|蹲|趴|倚|扶|摸|指)了[^，。]*[，。；]/g,
      /[^，。]*(?:走|跑|来|去|进|出|回|上|下|过)来[^，。]*[，。；]/g,
      /[^，。]*(?:走|跑|来|去|进|出|回|上|下|过)去[^，。]*[，。；]/g,
      // 匹配在末尾的动作描述
      /[^，。]*(?:坐在|站在|躺在|靠在|拿着|握着|举着|抱着|推着|拉着|踢着|跳着|蹲着|趴着|倚着|扶着|摸着|指着)[^，。]*$/g,
      /[^，。]*(?:走|跑|来|去|进|出|回|上|下|过)来[^，。]*$/g,
      /[^，。]*(?:走|跑|来|去|进|出|回|上|下|过)去[^，。]*$/g,
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

    return this.cleanPunctuation(cleaned);
  }

  /**
   * 移除剧情描述
   */
  private static removePlotDescriptions(description: string): string {
    if (!description) return '';

    let cleaned = description;

    // 1. 应用剧情句式过滤
    this.PLOT_PATTERNS.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    // 2. 构建剧情动词正则表达式 - 匹配以标点结尾的句子
    const plotRegex = new RegExp(
      `[^，。]*(?:${this.PLOT_KEYWORDS.join('|')})[^，。]*[，。；]`,
      'g'
    );

    // 3. 构建剧情动词正则表达式 - 匹配在末尾的句子（无标点）
    const plotRegexEnd = new RegExp(`[^，。]*(?:${this.PLOT_KEYWORDS.join('|')})[^，。]*$`, 'g');

    // 多次应用过滤
    let previous = '';
    let iterations = 0;
    const maxIterations = 10;

    do {
      previous = cleaned;
      cleaned = cleaned.replace(plotRegex, '');
      cleaned = cleaned.replace(plotRegexEnd, '');
      iterations++;
    } while (cleaned !== previous && iterations < maxIterations);

    return this.cleanPunctuation(cleaned);
  }

  /**
   * 移除人名及其相关描述
   */
  private static removeCharacterNames(description: string, characters: string[]): string {
    if (!description || !characters.length) return description;

    let cleaned = description;

    characters.forEach(name => {
      if (!name) return;

      // 匹配人名及其后续内容（直到标点）
      // 匹配模式：人名 + 任意字符（非贪婪）+ 标点 或 人名 + 与/和/同/向/对/从/到/为/被/把/将 + 任意字符 + 标点
      const patterns = [
        new RegExp(
          `${name}(?:与|和|同|向|对|从|到|为|被|把|将|在|于|跟|给|让|叫|使|令)[^，。]*[，。；]`,
          'g'
        ),
        new RegExp(`${name}[^，。；]*[，。；]`, 'g'),
        new RegExp(`${name}[^，。；]*$`, 'g'), // 人名在末尾的情况
      ];

      patterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
      });
    });

    return this.cleanPunctuation(cleaned);
  }

  /**
   * 移除介词引导的人物相关短语
   * 处理如"与...对峙"、"向...效忠"等句式
   */
  private static removeCharacterPhrases(description: string): string {
    if (!description) return '';

    let cleaned = description;

    // 构建动态正则表达式
    const plotKeywords = this.PLOT_KEYWORDS.join('|');
    const actionKeywords = this.ACTION_KEYWORDS.join('|');

    // 定义代词和数量词列表
    const pronouns =
      '三人|两人|四人|五人|六人|七人|八人|九人|十人|众人|大家|他们|她们|我们|你们|有人|无人|双方|三方|各方|所有人|几个人|一些人';

    // 匹配"与/向/对/从/被/把/将 + 任意内容 + 剧情动词/动作动词"的句式
    const phrasePatterns = [
      new RegExp(
        `(?:与|向|对|从|被|把|将|跟|给|让|叫)[^，。]*(?:${plotKeywords})[^，。]*[，。；]`,
        'g'
      ),
      new RegExp(
        `(?:与|向|对|从|被|把|将|跟|给|让|叫)[^，。]*(?:${actionKeywords})[^，。]*[，。；]`,
        'g'
      ),
      /(?:进行|发生|展开|上演|经历|参与)[^，。]*[，。；]/g,
      // 匹配"代词/数量词 + 正在/已经/将要 + 剧情动词"的句式，如"三人正在进行激烈的谈判"
      new RegExp(
        `(?:${pronouns})(?:正在|已经|曾经|将要|准备|开始|结束)?[^，。]*(?:${plotKeywords})[^，。]*[，。；]`,
        'g'
      ),
      new RegExp(`(?:${pronouns})[^，。]*(?:${plotKeywords})[^，。]*[，。；]`, 'g'),
      // 匹配"正在/已经/将要 + 剧情动词"的句式
      new RegExp(
        `(?:正在|已经|曾经|将要|准备|开始|结束)[^，。]*(?:${plotKeywords})[^，。]*[，。；]`,
        'g'
      ),
      // 匹配"数量词+人+剧情"的句式
      /\d+人[^，。]*(?:进行|发生|展开|上演|${plotKeywords})[^，。]*[，。；]/g,
    ];

    // 多次应用过滤，直到没有匹配
    let previous = '';
    let iterations = 0;
    const maxIterations = 10;

    do {
      previous = cleaned;
      phrasePatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
      });
      iterations++;
    } while (cleaned !== previous && iterations < maxIterations);

    return this.cleanPunctuation(cleaned);
  }

  /**
   * 清理多余的标点符号
   */
  private static cleanPunctuation(text: string): string {
    let cleaned = text;

    // 清理多余的标点
    cleaned = cleaned.replace(/，{2,}/g, '，');
    cleaned = cleaned.replace(/。{2,}/g, '。');
    cleaned = cleaned.replace(/；{2,}/g, '；');
    cleaned = cleaned.replace(/^[，。；\s]+|[，。；\s]+$/g, '');

    return cleaned.trim();
  }
}
