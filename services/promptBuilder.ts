import { ScriptCharacter, ScriptScene, ScriptItem } from '../types';

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
    '背包',
    '手提袋',
    '购物袋',
    '拉杆箱',
    '行李箱',
    '公文包',
    '电脑包',
    '书包',
    '饭盒',
    '餐盒',
    '外卖',
    '快递',
    '包裹',
    '信封',
    '明信片',
    '贺卡',
    '请帖',
    '邀请函',
    '购物清单',
    '菜单',
    '账单',
    '发票',
    '收据',
    '合同',
    '协议',
    '备忘录',
    '便签',
    '便利贴',
    '草稿纸',
    '笔记本电脑',
    '平板电脑',
    '鼠标',
    '键盘',
    '显示器',
    '耳机',
    '充电器',
    '数据线',
    '充电宝',
    '移动电源',
    '手表',
    '手环',
    '眼镜',
    '墨镜',
    '太阳镜',
    '口罩',
    '围巾',
    '帽子',
    '手套',
    '餐巾纸',
    '纸巾',
    '湿巾',
    '卫生纸',
    '毛巾',
    '浴巾',
    '手帕',
    '卫生纸',
    '牙刷牙膏',
    '剃须刀',
    '化妆品',
    '护肤品',
    '香水',
    '指甲油',
    '口红',
    '粉底',
    '眼影',
    '腮红',
    '睫毛膏',
    '梳子',
    '镜子',
    '吹风机',
    '卷发棒',
    '直发器',
    '剃须刀',
    '指甲刀',
    '剪刀',
    '刀具',
    '叉子',
    '勺子',
    '筷子',
    '碗',
    '盘子',
    '碟子',
    '杯子',
    '茶壶',
    '水壶',
    '水瓶',
    '保温杯',
    '咖啡杯',
    '茶杯',
    '酒杯',
    '酒瓶',
    '饮料瓶',
    '易拉罐',
    '包装盒',
    '礼品盒',
    '首饰盒',
    '化妆盒',
    '工具箱',
    '急救箱',
    '药箱',
    '垃圾桶',
    '扫帚',
    '拖把',
    '吸尘器',
    '洗衣机',
    '烘干机',
    '熨斗',
  ];

  // 标志性物品关键词 - 包含这些词的物品不应被过滤
  private static readonly SIGNATURE_ITEM_KEYWORDS = [
    '祖传',
    '家传',
    '传世',
    '传家',
    '随身',
    '专属',
    '专用',
    '定制',
    '特制',
    '专属',
    '标志性',
    '象征',
    '代表',
    '信物',
    '定情',
    '纪念',
    '珍藏',
    '收藏',
    '心爱',
    '珍爱',
    '宝贝',
    '宝物',
    '神器',
    '法宝',
    '法器',
    '圣器',
    '神器',
    '魔器',
    '灵器',
    '仙器',
    '神剑',
    '魔剑',
    '仙剑',
    '宝刀',
    '宝剑',
    '名剑',
    '名刀',
    '宝弓',
    '神弓',
    '魔弓',
    '玉佩',
    '玉坠',
    '玉镯',
    '玉戒指',
    '玉簪',
    '玉钗',
    '玉冠',
    '玉带',
    '玉印',
    '玉玺',
    '佩剑',
    '佩刀',
    '佩枪',
    '护身符',
    '平安符',
    '灵符',
    '神符',
    '魔符',
    '仙符',
    '符箓',
    '卷轴',
    '秘籍',
    '宝典',
    '经书',
    '道书',
    '佛书',
    '仙书',
    '魔书',
    '神书',
    '天书',
    '戒指',
    '项链',
    '手镯',
    '脚链',
    '耳环',
    '耳钉',
    '胸针',
    '领针',
    '袖扣',
    '腰带',
    '腰牌',
    '令牌',
    '虎符',
    '兵符',
    '印信',
    '印章',
    '图章',
    '玉玺',
    '官印',
    '私印',
    '王冠',
    '皇冠',
    '凤冠',
    '头冠',
    '桂冠',
    '花环',
    '发冠',
    '发髻',
    '头饰',
    '发饰',
    '披风',
    '斗篷',
    '披肩',
    '面纱',
    '面罩',
    '面具',
    '头盔',
    '铠甲',
    '战甲',
    '盔甲',
    '盾牌',
    '护盾',
    '护符',
    '护甲',
    '护腕',
    '护膝',
    '护肘',
    '护肩',
    '护胸',
    '护腿',
    '战靴',
    '神靴',
    '仙靴',
    '魔靴',
    '宝靴',
    '灵靴',
    '圣靴',
    '邪靴',
    '鬼靴',
    '妖靴',
    '法袍',
    '道袍',
    '僧袍',
    '袈裟',
    '法衣',
    '仙衣',
    '神衣',
    '魔衣',
    '妖衣',
    '鬼衣',
    '宝衣',
    '圣衣',
    '邪衣',
    '灵衣',
    '魂衣',
    '魄衣',
    '血衣',
    '尸衣',
    '骨衣',
    '皮衣',
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

    // 1. 优先使用 appearance 字段（结构化数据）
    const app = character.appearance;
    if (app?.face) parts.push(app.face);
    if (app?.hair) parts.push(app.hair);
    if (app?.clothing) parts.push(app.clothing);
    if (app?.build) parts.push(app.build);
    if (app?.height) parts.push(app.height);

    // 2. 如果 appearance 为空，使用 visualPrompt（自然语言描述）
    if (parts.length === 0 && character.visualPrompt) {
      parts.push(character.visualPrompt);
    }

    // 3. 如果仍然为空，使用 description（备用）
    if (parts.length === 0 && character.description) {
      parts.push(character.description);
    }

    // 4. 固有物品（过滤临时物品）
    const permanentItems = this.filterPermanentItems(character.signatureItems);
    if (permanentItems.length > 0) {
      parts.push(`随身物品：${permanentItems.join('、')}`);
    }

    // 5. 智能补充脚部描述（针对全身图）
    if (!this.hasFootwearDescription(parts)) {
      const footwear = this.inferFootwear(app?.clothing);
      if (footwear) parts.push(footwear);
    }

    // 6. 组装最终提示词
    const prompt = parts.join('，');

    return prompt;
  }

  /**
   * 过滤临时物品，只保留固有物品
   */
  private static filterPermanentItems(items: string[]): string[] {
    if (!items || items.length === 0) return [];

    return items.filter(item => {
      const itemLower = item.toLowerCase();

      // 检查是否是标志性物品（包含标志性关键词则保留）
      const isSignatureItem = this.SIGNATURE_ITEM_KEYWORDS.some(keyword =>
        itemLower.includes(keyword.toLowerCase())
      );
      if (isSignatureItem) return true;

      // 检查是否是临时物品（不包含标志性关键词则过滤）
      const isTemporary = this.TEMPORARY_ITEMS.some(temp => itemLower.includes(temp.toLowerCase()));
      return !isTemporary;
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
    if (!clothing) return '脚穿与服装风格匹配的精致鞋子，细节清晰';

    const clothingLower = clothing.toLowerCase();

    // ========== 古装细粒度区分 ==========

    // 仙侠/修仙
    if (clothingLower.includes('仙侠') || clothingLower.includes('修仙')) {
      return '脚穿白色云纹布靴，靴面有精致刺绣，质感轻盈飘逸';
    }

    // 宫廷/贵妃/公主
    if (
      clothingLower.includes('宫廷') ||
      clothingLower.includes('贵妃') ||
      clothingLower.includes('公主') ||
      clothingLower.includes('皇后')
    ) {
      return '脚穿绣花凤履，鞋面绣有凤凰纹样，缀有珍珠装饰，华丽典雅';
    }

    // 武侠/江湖/侠客
    if (
      clothingLower.includes('武侠') ||
      clothingLower.includes('江湖') ||
      clothingLower.includes('侠客') ||
      clothingLower.includes('武士')
    ) {
      return '脚穿黑色快靴，靴筒较高，便于行动，皮质哑光，坚固耐穿';
    }

    // 唐代风格
    if (
      clothingLower.includes('唐') ||
      clothingLower.includes('齐胸') ||
      clothingLower.includes('襦裙')
    ) {
      return '脚穿唐朝云头履，鞋头高耸，鞋面有精美纹样，色彩艳丽';
    }

    // 宋代风格
    if (clothingLower.includes('宋') || clothingLower.includes('褙子')) {
      return '脚穿宋朝圆头履，鞋头圆润，鞋面素雅，端庄大方';
    }

    // 明代风格
    if (clothingLower.includes('明') || clothingLower.includes('马面')) {
      return '脚穿明朝弓鞋，鞋尖上翘，鞋帮有刺绣，精致典雅';
    }

    // 清代风格
    if (
      clothingLower.includes('清') ||
      clothingLower.includes('旗装') ||
      clothingLower.includes('花盆')
    ) {
      return '脚穿清代花盆底鞋，鞋底较高，鞋面绣花，独具特色';
    }

    // 一般古风/汉服
    if (
      clothingLower.includes('古') ||
      clothingLower.includes('汉') ||
      clothingLower.includes('古风') ||
      clothingLower.includes('汉服')
    ) {
      return '脚穿传统布鞋，鞋面素雅，鞋底平整，舒适大方';
    }

    // ========== 现代装细粒度区分 ==========

    // 职业装/OL/西装套裙
    if (
      clothingLower.includes('职业装') ||
      clothingLower.includes('ol') ||
      clothingLower.includes('西装套裙') ||
      clothingLower.includes('商务套裙')
    ) {
      return '脚穿黑色细跟高跟鞋，鞋跟精致，鞋面光滑，尽显职业风范';
    }

    // 西装/正装/商务
    if (
      clothingLower.includes('西装') ||
      clothingLower.includes('正装') ||
      clothingLower.includes('商务')
    ) {
      return '脚穿黑色皮鞋，皮质细腻，鞋型挺括，正式典雅';
    }

    // 运动装/运动休闲
    if (
      clothingLower.includes('运动') ||
      clothingLower.includes('健身') ||
      clothingLower.includes('瑜伽') ||
      clothingLower.includes('跑步')
    ) {
      return '脚穿白色运动鞋，鞋面透气，鞋底厚实，细节清晰，充满活力';
    }

    // 休闲装（非运动）
    if (clothingLower.includes('休闲') && !clothingLower.includes('运动')) {
      return '脚穿休闲皮鞋，皮质柔软，款式简约，舒适百搭';
    }

    // 学生装/校服
    if (
      clothingLower.includes('校') ||
      clothingLower.includes('学生') ||
      clothingLower.includes('校服') ||
      clothingLower.includes('jk')
    ) {
      return '脚穿学生鞋，款式简洁，青春活力，适合校园场景';
    }

    // 礼服/婚纱/晚宴
    if (
      clothingLower.includes('礼服') ||
      clothingLower.includes('婚纱') ||
      clothingLower.includes('晚宴') ||
      clothingLower.includes('舞会')
    ) {
      return '脚穿细跟水晶鞋，鞋面有水钻装饰，光泽亮丽，高贵优雅';
    }

    // ========== 兜底描述（不再空洞，补充细节） ==========
    return '脚穿与服装风格匹配的精致鞋子，材质清晰，细节丰富，贴合整体造型';
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

    // 1. 优先使用 environment 字段（结构化数据）
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

    // 5. 如果 environment 为空，使用 description（过滤后）
    if (!env || Object.keys(env).length === 0) {
      let cleanDescription = scene.description || '';
      cleanDescription = this.removeCharacterActions(cleanDescription);
      cleanDescription = this.removePlotDescriptions(cleanDescription);
      if (cleanDescription) parts.push(cleanDescription);
    }

    // 6. 如果仍然为空，使用 visualPrompt（备用）
    if (parts.length === 0 && scene.visualPrompt) {
      parts.push(scene.visualPrompt);
    }

    // 7. 组装最终提示词
    let prompt = parts.join('，');

    // 8. 添加场景图要求
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

/**
 * 物品提示词构建器
 * 根据结构化数据智能组装物品生图提示词
 */
export class ItemPromptBuilder {
  /**
   * 构建物品生图提示词
   * @param item 剧本物品数据
   * @returns 物品设定图提示词
   */
  static build(item: ScriptItem): string {
    const parts: string[] = [];

    // 1. 基础描述
    if (item.description) {
      parts.push(item.description);
    }

    // 2. 类别特征
    if (item.category) {
      const categoryPrompt = this.getCategoryPrompt(item.category);
      if (categoryPrompt) parts.push(categoryPrompt);
    }

    // 3. 所属角色
    if (item.owner) {
      parts.push(`属于${item.owner}`);
    }

    // 4. 重要性标识
    if (item.importance === 'major') {
      parts.push('重要道具，细节精致');
    }

    // 5. 组装提示词
    let prompt = parts.join('，');

    // 6. 添加拍摄要求
    prompt += '，道具设定图，纯白背景';

    return prompt;
  }

  /**
   * 根据类别生成特征描述
   */
  private static getCategoryPrompt(category: string): string {
    const categoryPrompts: Record<string, string> = {
      weapon: '古代兵器，金属质感，工艺精良',
      tool: '实用工具，功能性强，细节清晰',
      jewelry: '精美饰品，珠宝镶嵌，光泽亮丽',
      document: '古代文书，纸质泛黄，字迹清晰',
      creature: '灵兽宠物，生动可爱，毛发清晰',
      animal: '动物坐骑，体型健壮，毛发蓬松',
      other: '特殊物品，造型独特，细节丰富',
    };

    return categoryPrompts[category] || '';
  }
}
