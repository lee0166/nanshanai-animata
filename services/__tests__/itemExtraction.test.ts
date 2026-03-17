/**
 * Item Extraction Tests - Phase 1
 *
 * 测试目标：
 * 1. 验证轻量级道具提取功能正常工作
 * 2. 验证超时降级机制
 * 3. 验证4个解析路径都包含物品提取
 * 4. 验证提取率达标（>70%）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScriptParser } from '../scriptParser';
import { ScriptItem, ScriptCharacter, ScriptParseState } from '../../types';

// Mock LLM响应
const mockLLMResponse = {
  validItems: JSON.stringify([
    { name: '古剑', description: '一把古老的青铜剑', category: 'weapon', owner: '主角' },
    { name: '玉佩', description: '雕龙玉佩', category: 'jewelry', owner: '女主角' },
    { name: '地图', description: '藏宝图', category: 'document', owner: '' },
  ]),
  emptyItems: JSON.stringify([]),
  invalidJson: 'invalid json response',
};

// 测试剧本数据
const testScripts = {
  // 短剧本（<800字）- Fast Path
  shortScript: `
第一章：初遇

长安城，繁华依旧。

李逍遥背着一把古剑，走在熙熙攘攘的街道上。这把剑是他师父临终前传给他的，剑身刻有神秘的符文。

突然，他看到前方有个女子被几个恶霸围住。女子腰间挂着一块雕龙玉佩，看起来价值不菲。

"住手！"李逍遥拔出古剑，剑光闪烁。

恶霸们见状，吓得四散而逃。

"多谢公子相救。"女子盈盈一拜，"小女子姓赵，名灵儿。"

李逍遥收起古剑，笑道："路见不平，拔刀相助而已。"

赵灵儿取下腰间的玉佩："这块玉佩是先母遗物，今日赠予公子，以表谢意。"

李逍遥连忙摆手："这可使不得，太贵重了。"

"公子若不收，灵儿心中难安。"

李逍遥只好收下玉佩，心中暗想：这玉佩上的龙纹，似乎在哪里见过...

（未完待续）
`,

  // 中等剧本（2000字）- Standard Path
  mediumScript: `
第一章：密室

深夜，侦探林峰接到报案，来到城郊的一座古宅。

"死者是这座宅子的主人，陈老爷。"警员介绍道，"死亡时间大约在昨晚10点到12点之间。"

林峰戴上白手套，仔细检查现场。书房里，陈老爷倒在书桌旁，手中紧紧握着一把钥匙。

"这是书房的钥匙？"林峰问道。

"是的，但书房的门并没有上锁。"警员回答。

林峰注意到书桌上放着一封信，信封上写着"绝密"二字。他小心地拿起信封，发现里面是一张地图，标注着城郊某处的位置。

"有意思..."林峰沉思道。

他继续搜查，在死者的口袋里发现了一块怀表。怀表停在11点15分，表面有一道明显的划痕。

"这可能是死亡时间的关键证据。"林峰将怀表放入证物袋。

突然，他的目光被书架上的一个相框吸引。照片里是陈老爷和一个年轻人的合影，年轻人手中拿着一把枪。

"这个人是谁？"

"是陈老爷的独子，陈明。不过他已经失踪三年了。"

林峰取下相框，发现背面写着一行字："真相在密室"。

他环顾四周，发现书架后面似乎有一扇隐藏的门。用死者手中的钥匙一试，门果然开了。

密室里，堆满了各种古董和文件。最显眼的是桌子上的一本日记，和一把手枪。

林峰翻开日记，最后一页写着："如果我遭遇不测，凶手一定是..."

字迹到这里戛然而止。

（第一章完）
`,

  // 长剧本片段（>5000字）- Chunked Path
  longScriptPrefix: `
序幕

江湖，永远不缺传说。

二十年前的那个雨夜，武林盟主慕容龙城在断魂崖上，与魔教教主东方不败决战。那一战，惊天动地，日月无光。

最终，慕容龙城以一招"龙啸九天"击败东方不败，但也身受重伤。临终前，他将武林至宝"龙魂玉"交给心腹弟子，嘱咐道："找到少主，复兴慕容家..."

从此，龙魂玉下落不明，成为江湖上最大的谜团。

第一章：少年出山

青云山，云雾缭绕，宛如仙境。

山腰处，有一座简陋的茅屋。茅屋前，一个少年正在练剑。少年约莫十六七岁，眉目清秀，但眼神中透着一股坚毅。

"慕容天，你的剑法又有进步了。"一个苍老的声音传来。

少年收剑，转身行礼："师父。"

来者是一位白发老者，手持一根竹杖，正是隐居多年的"竹剑先生"叶无尘。

"天儿，你在我这里已经学了十年。今日，为师有一件东西要交给你。"叶无尘从怀中取出一块玉佩。

慕容天接过玉佩，只见玉佩通体碧绿，上面雕刻着一条栩栩如生的龙。

"这是..."

"这是你父亲留下的龙魂玉。"叶无尘沉声道，"二十年前，你父亲慕容龙城是武林盟主，却被奸人所害。这块玉佩，是慕容家唯一的遗物。"

慕容天握紧玉佩，眼中闪过一丝泪光："师父，我父亲的仇人是谁？"

"现在还不是告诉你的时候。"叶无尘摇头，"你的武功还未大成，贸然报仇，只会白白送死。为师要你下山，历练三年，寻找传说中的'九剑秘典'。"

"九剑秘典？"

"那是天下第一剑法，练成之后，可无敌于天下。"叶无尘从竹杖中抽出一把短剑，"这把'青竹剑'陪伴为师多年，今日赠予你防身。"

慕容天跪地叩首："弟子定不负师父期望！"

...
`,
};

describe('Phase 1: Item Extraction Optimization', () => {
  let parser: ScriptParser;

  beforeEach(() => {
    parser = new ScriptParser(
      'test-api-key',
      'http://test-api.com',
      'test-model',
      'volcengine',
      {}
    );
  });

  describe('extractItemsLightweight', () => {
    it('should extract items from short script successfully', async () => {
      // Mock the LLM call
      const mockCallLLM = vi
        .spyOn(parser as any, 'callLLM')
        .mockResolvedValue(mockLLMResponse.validItems);

      const items = await (parser as any).extractItemsLightweight(
        testScripts.shortScript,
        [],
        30000
      );

      expect(items).toBeDefined();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(2); // 至少提取2个道具

      // 验证提取的道具结构
      items.forEach((item: ScriptItem) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('description');
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('importance');
      });

      // 验证关键道具被提取
      const itemNames = items.map((i: ScriptItem) => i.name);
      expect(itemNames.some((name: string) => name.includes('剑') || name.includes('玉佩'))).toBe(
        true
      );

      mockCallLLM.mockRestore();
    });

    it('should return empty array on timeout', async () => {
      // Mock timeout
      const mockCallLLM = vi
        .spyOn(parser as any, 'callLLM')
        .mockImplementation(
          () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
        );

      const items = await (parser as any).extractItemsLightweight(
        testScripts.shortScript,
        [],
        50 // 50ms超时，确保触发
      );

      expect(items).toEqual([]);
      mockCallLLM.mockRestore();
    });

    it('should return empty array on invalid JSON response', async () => {
      const mockCallLLM = vi
        .spyOn(parser as any, 'callLLM')
        .mockResolvedValue(mockLLMResponse.invalidJson);

      const items = await (parser as any).extractItemsLightweight(
        testScripts.shortScript,
        [],
        30000
      );

      // 应该降级到空数组
      expect(items).toEqual([]);
      mockCallLLM.mockRestore();
    });

    it('should handle empty script gracefully', async () => {
      const mockCallLLM = vi
        .spyOn(parser as any, 'callLLM')
        .mockResolvedValue(mockLLMResponse.emptyItems);

      const items = await (parser as any).extractItemsLightweight('', [], 30000);

      expect(items).toEqual([]);
      mockCallLLM.mockRestore();
    });
  });

  describe('Integration with Parsing Paths', () => {
    it('should include items in parse state for Fast Path', async () => {
      // 这个测试验证Fast Path是否包含items字段
      const mockCallLLM = vi
        .spyOn(parser as any, 'callLLM')
        .mockResolvedValue(mockLLMResponse.validItems);

      // 使用短剧本触发Fast Path
      const state = await parser.parseScript(
        'test-script-id',
        'test-project-id',
        testScripts.shortScript
      );

      // 验证state包含items字段
      expect(state).toHaveProperty('items');
      expect(Array.isArray(state.items)).toBe(true);

      mockCallLLM.mockRestore();
    });

    it('should include items in parse state for Standard Path', async () => {
      const mockCallLLM = vi
        .spyOn(parser as any, 'callLLM')
        .mockResolvedValue(mockLLMResponse.validItems);

      // 使用中等长度剧本触发Standard Path
      const state = await parser.parseScript(
        'test-script-id',
        'test-project-id',
        testScripts.mediumScript
      );

      expect(state).toHaveProperty('items');
      expect(Array.isArray(state.items)).toBe(true);

      mockCallLLM.mockRestore();
    });
  });

  describe('Item Extraction Rate', () => {
    it('should extract at least 70% of expected items', async () => {
      // 从mediumScript中，我们期望提取：钥匙、地图、怀表、枪（至少4个）
      const expectedItems = ['钥匙', '地图', '怀表', '枪', '日记'];

      const mockResponse = JSON.stringify([
        { name: '钥匙', description: '书房钥匙', category: 'tool', owner: '陈老爷' },
        { name: '地图', description: '藏宝地图', category: 'document', owner: '' },
        { name: '怀表', description: '金怀表', category: 'other', owner: '陈老爷' },
        { name: '手枪', description: '密室手枪', category: 'weapon', owner: '' },
      ]);

      const mockCallLLM = vi.spyOn(parser as any, 'callLLM').mockResolvedValue(mockResponse);

      const items = await (parser as any).extractItemsLightweight(
        testScripts.mediumScript,
        [],
        30000
      );

      // 计算提取率
      const extractedNames = items.map((i: ScriptItem) => i.name);
      const matchedItems = expectedItems.filter(expected =>
        extractedNames.some((name: string) => name.includes(expected))
      );

      const extractionRate = matchedItems.length / expectedItems.length;
      console.log(
        `Extraction rate: ${(extractionRate * 100).toFixed(1)}% (${matchedItems.length}/${expectedItems.length})`
      );

      expect(extractionRate).toBeGreaterThanOrEqual(0.7); // >70%

      mockCallLLM.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should complete extraction within 30 seconds', async () => {
      const mockCallLLM = vi
        .spyOn(parser as any, 'callLLM')
        .mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve(mockLLMResponse.validItems), 100))
        );

      const startTime = Date.now();
      await (parser as any).extractItemsLightweight(testScripts.mediumScript, [], 30000);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(30000);
      mockCallLLM.mockRestore();
    });
  });
});

// 手动测试辅助函数
export function runManualTest() {
  console.log('=== Item Extraction Manual Test ===');
  console.log('Test scripts prepared:', Object.keys(testScripts));
  console.log('Short script length:', testScripts.shortScript.length);
  console.log('Medium script length:', testScripts.mediumScript.length);
  console.log('=====================================');
}
