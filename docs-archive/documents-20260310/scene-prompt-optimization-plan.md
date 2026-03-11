# 场景提示词生成优化方案

## 一、问题深度分析

### 1.1 问题现象

从截图中可以看到，"沈若涵办公室"场景的提示词包含了：

```
沈若涵在此与顾衍之进行最终对峙，并接受了陈默的臣服与夏晚的效忠，见证了职场博弈的最终落幕
```

这段描述明显包含**人物动作**和**剧情信息**，不符合场景图应该只描述**环境**的要求。

### 1.2 根本原因

#### 原因1：AI剧本解析阶段的问题

在 `services/scriptParser.ts` 第213-214行的Prompt中：

```
"description": "场景环境描述，不包含人物动作",
```

虽然Prompt要求AI返回纯环境描述，但LLM（大语言模型）**无法完全遵守**这个约束，经常会将剧情描述混入`description`字段。

#### 原因2：`ScenePromptBuilder`过滤逻辑不完善

查看 `services/promptBuilder.ts` 第187-219行的 `removeCharacterActions` 方法：

```typescript
const actionPatterns = [
  // 匹配：任意文字 + 动作 + 任意文字 + 标点
  /[^，。]*(?:坐|站|走|跑|躺|靠|拿|握|举|抱|推|拉|踢|跳|蹲|趴|倚|扶|摸|指)[^，。]*[，。；]/g,
];
```

**问题分析**：

1. **动作关键词不完整**：缺少"对峙"、"接受"、"臣服"、"效忠"、"见证"等剧情动词
2. **正则表达式局限**：只能匹配包含明确动作词的句子，无法识别人名+剧情描述的句式
3. **未过滤人名**：提示词中保留了"沈若涵"、"顾衍之"、"陈默"、"夏晚"等人名

#### 原因3：缺少剧情描述过滤

当前的过滤逻辑只关注"动作"，但剧情描述（如"进行最终对峙"、"职场博弈的最终落幕"）不包含传统意义上的"动作词"，因此无法被过滤。

### 1.3 代码流程梳理

```
剧本解析 (scriptParser.ts)
    ↓
LLM提取场景信息 → ScriptScene.description (包含人物剧情)
    ↓
创建场景资产 (SceneMapping.tsx:61)
    ↓
ScenePromptBuilder.build(scriptScene) (promptBuilder.ts:137)
    ↓
过滤不完全 → 人物剧情残留
    ↓
保存到 SceneAsset.prompt
    ↓
生成图像时直接使用 (SceneDetail.tsx:459)
```

---

## 二、解决方案

### 方案1：增强 `ScenePromptBuilder` 的过滤能力（推荐）

**修改文件**：`services/promptBuilder.ts`

#### 2.1.1 扩展动作关键词列表

```typescript
// 原有关键词
private static readonly ACTION_KEYWORDS = [
  '坐', '站', '走', '跑', '躺', '靠', '拿', '握', '举', '抱',
  '推', '拉', '踢', '跳', '蹲', '趴', '倚', '扶', '摸', '指'
];

// 新增剧情动词
private static readonly PLOT_KEYWORDS = [
  '对峙', '接受', '臣服', '效忠', '见证', '博弈', '对决', '争吵',
  '谈判', '商议', '讨论', '表白', '告别', '相遇', '重逢', '离别',
  '合作', '对抗', '冲突', '和解', '妥协', '胜利', '失败', '达成',
  '揭露', '发现', '揭示', '宣布', '宣告', '庆祝', '哀悼', '审判'
];
```

#### 2.1.2 新增人名检测和过滤

```typescript
// 从characters数组中提取人名，在description中移除
private static removeCharacterNames(description: string, characters: string[]): string {
  let cleaned = description;
  characters.forEach(name => {
    // 移除 "人名 + 在/与/和/同/向/对/从/到/为/被/把/将" 等介词引导的短语
    const patterns = [
      new RegExp(`${name}[^，。]*`, 'g'),  // 人名及其后续内容
    ];
    patterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
  });
  return cleaned;
}
```

#### 2.1.3 新增剧情句式过滤

```typescript
// 过滤包含剧情描述的句子
private static readonly PLOT_PATTERNS = [
  /[^，。]*(?:在此|这里|此处)[^，。]*[，。；]/g,  // "在此..."句式
  /[^，。]*(?:进行|发生|展开|上演)[^，。]*[，。；]/g,  // 剧情发展描述
  /[^，。]*(?:最终|最后|结局|落幕)[^，。]*[，。；]/g,  // 结局描述
  /[^，。]*(?:职场|宫廷|江湖|战场)[^，。]*[，。；]/g,  // 场景类型+剧情
];
```

#### 2.1.4 修改 `build` 方法

```typescript
static build(scene: ScriptScene): string {
  const parts: string[] = [];

  // ... 原有逻辑 ...

  // 5. 过滤人物动作后的描述
  let cleanDescription = this.removeCharacterActions(scene.description);

  // 新增：过滤剧情描述
  cleanDescription = this.removePlotDescriptions(cleanDescription);

  // 新增：过滤人名
  if (scene.characters?.length) {
    cleanDescription = this.removeCharacterNames(cleanDescription, scene.characters);
  }

  if (cleanDescription) parts.push(cleanDescription);

  // ... 原有逻辑 ...
}
```

### 方案2：改进剧本解析Prompt

**修改文件**：`services/scriptParser.ts`

在Prompt中增加更严格的约束和示例：

```
【场景描述要求】
description字段必须满足以下条件：
1. 只描述物理环境（建筑、陈设、光线、色调）
2. 禁止包含任何人物名称
3. 禁止包含任何人物动作（坐、站、走等）
4. 禁止包含任何剧情描述（对峙、谈判、表白等）
5. 禁止包含任何情感或氛围形容词（紧张、浪漫、悲伤等）

错误示例：
- "沈若涵坐在办公桌后处理文件"（包含人名和动作）
- "现代办公室，沈若涵与顾衍之在此进行最终对峙"（包含人名和剧情）
- "宽敞明亮的会议室，见证了职场博弈的最终落幕"（包含剧情描述）

正确示例：
- "现代商务办公室，配备实木办公桌、皮质转椅和落地书架"（纯环境描述）
- "中型会议室，长方形会议桌配12把黑色皮椅，墙面挂有企业标识"（纯环境描述）
```

### 方案3：增加后处理验证（可选增强）

在保存场景资产前，增加提示词质量检查：

```typescript
// 在 SceneMapping.tsx 中
const handleCreateScene = async (scriptScene: ScriptScene) => {
  const generatedPrompt = ScenePromptBuilder.build(scriptScene);

  // 验证提示词质量
  const hasCharacterNames = scriptScene.characters?.some(name => generatedPrompt.includes(name));

  if (hasCharacterNames) {
    console.warn('警告：生成的提示词仍包含人名，需要手动检查');
    // 可以选择显示警告或自动重新生成
  }

  // ... 继续创建场景
};
```

---

## 三、实施步骤

### 步骤1：增强 `ScenePromptBuilder`

- [ ] 扩展 `ACTION_KEYWORDS` 列表
- [ ] 新增 `PLOT_KEYWORDS` 列表
- [ ] 实现 `removePlotDescriptions` 方法
- [ ] 实现 `removeCharacterNames` 方法
- [ ] 更新 `build` 方法调用新的过滤逻辑

### 步骤2：改进剧本解析Prompt

- [ ] 更新 `scenesBatch` Prompt模板
- [ ] 增加更多负面示例
- [ ] 强化约束描述

### 步骤3：测试验证

- [ ] 编写单元测试验证过滤效果
- [ ] 使用实际剧本数据测试
- [ ] 验证生成的提示词不再包含人物剧情

---

## 四、预期效果

优化后，"沈若涵办公室"的提示词应该变为：

```
modern corporate style，陈设：办公桌、皮质办公椅、茶杯、落地窗，
natural sunlight streaming through windows，bright and professional with cool undertones，
afternoon，sunny，鼎盛集团市场部总监办公室，空间宽敞整洁，布置现代简约，
场景设定图，无人物，适合作为影视背景
```

**关键改进点**：

1. ✅ 移除了"沈若涵"、"顾衍之"、"陈默"、"夏晚"等人名
2. ✅ 移除了"对峙"、"接受"、"臣服"、"效忠"、"见证"等剧情动词
3. ✅ 移除了"职场博弈的最终落幕"等剧情描述
4. ✅ 保留了纯环境描述："空间宽敞整洁，布置现代简约"

---

## 五、风险评估

| 风险                     | 可能性 | 影响 | 缓解措施                                  |
| ------------------------ | ------ | ---- | ----------------------------------------- |
| 过度过滤导致环境描述缺失 | 中     | 中   | 保留architecture、furnishings等结构化数据 |
| 人名识别不准确           | 低     | 低   | 结合characters数组精确匹配                |
| 正则表达式性能问题       | 低     | 低   | 限制迭代次数，使用高效正则                |

---

_计划创建时间：2026-02-28_
_基于代码分析自动生成_
