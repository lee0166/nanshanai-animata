# 系统性解决方案：角色/场景提示词生成优化

## 问题根源分析

### 当前数据流

```
小说文本
    ↓
ScriptParser (LLM解析)
    ↓
生成 ScriptCharacter.visualPrompt / ScriptScene.visualPrompt
    ↓
CharacterMapping / SceneMapping
    ↓
创建 CharacterAsset / SceneAsset (asset.prompt = visualPrompt)
    ↓
CharacterDetail / SceneDetail 显示和用于生图
```

### 核心问题

1. **角色提示词问题**
   - LLM生成的 `visualPrompt` 包含临时性物品（"手中常抱着文件"）
   - 没有区分"固有特征"vs"临时物品"
   - 缺乏对全身图脚部/鞋子的智能补充

2. **场景提示词问题**
   - LLM生成的 `visualPrompt` 包含人物动作（"江哲坐在办公桌后"）
   - 场景图应该是纯环境，不应有具体人物动作

3. **系统性缺陷**
   - LLM提示词模板（PROMPTS.character/scene）指导不够明确
   - 没有后处理/过滤机制
   - 没有利用结构化数据（appearance, environment等）重新组装提示词

---

## 系统性解决方案架构

### 方案核心思想

**不依赖LLM一次性生成完美提示词，而是：**

1. LLM提取结构化特征数据
2. 系统根据规则智能组装提示词
3. 提供后处理和过滤机制

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                     小说文本解析层                                │
├─────────────────────────────────────────────────────────────────┤
│  LLM提取结构化数据                                                │
│  ├── 角色: appearance {face, hair, clothing, build, height}      │
│  ├──      signatureItems (固有物品: 剑、玉佩等)                   │
│  └── 场景: environment {architecture, furnishings, lighting}     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     提示词组装引擎                                │
├─────────────────────────────────────────────────────────────────┤
│  角色提示词组装器 CharacterPromptBuilder                         │
│  ├── 输入: ScriptCharacter (appearance, signatureItems等)        │
│  ├── 规则1: 只使用appearance字段，排除临时物品                   │
│  ├── 规则2: 全身图智能补充脚部/鞋子描述                          │
│  └── 输出: 纯净的全身角色设定图提示词                             │
│                                                                  │
│  场景提示词组装器 ScenePromptBuilder                             │
│  ├── 输入: ScriptScene (environment, description等)              │
│  ├── 规则1: 只使用environment字段                                │
│  ├── 规则2: 过滤所有人物动作描述                                 │
│  └── 输出: 纯净的场景环境提示词                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     资产创建层                                    │
├─────────────────────────────────────────────────────────────────┤
│  CharacterAsset / SceneAsset                                     │
│  ├── prompt: 由PromptBuilder生成（而非直接使用visualPrompt）     │
│  └── metadata: 保留完整结构化数据                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 具体实施内容

### 1. 修改LLM提示词模板

**当前问题**: visualPrompt字段让LLM自由发挥，容易包含不符合要求的内容

**改进方案**: 弱化visualPrompt，强化结构化字段提取

```typescript
// PROMPTS.character 修改
{
  "appearance": {
    "face": "面容特征：五官、肤色、表情",
    "hair": "发型：长度、颜色、样式",
    "clothing": "服装：风格、颜色、款式",
    "build": "体型：高矮胖瘦",
    "height": "身高"
  },
  "signatureItems": ["随身固有物品，如：剑、玉佩、眼镜等，排除临时物品"],
  "visualPrompt": "【系统字段，无需填写】"
}
```

### 2. 创建PromptBuilder服务

**文件**: `services/promptBuilder.ts`

```typescript
export class CharacterPromptBuilder {
  static build(character: ScriptCharacter): string {
    const parts: string[] = [];

    // 1. 基础外貌
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

    // 3. 智能补充脚部（针对全身图）
    if (!this.hasFootwearDescription(parts)) {
      parts.push(this.inferFootwear(app.clothing));
    }

    return parts.join('，');
  }

  private static filterPermanentItems(items: string[]): string[] {
    const temporaryItems = ['文件', '笔记本', '咖啡', '手机', '纸张', '文档'];
    return items.filter(item => !temporaryItems.some(temp => item.includes(temp)));
  }

  private static hasFootwearDescription(parts: string[]): boolean {
    const footKeywords = ['鞋', '靴', '履', '足', '脚'];
    return parts.some(p => footKeywords.some(k => p.includes(k)));
  }

  private static inferFootwear(clothing?: string): string {
    // 根据服装风格推断鞋子
    if (clothing?.includes('古') || clothing?.includes('汉') || clothing?.includes('仙')) {
      return '脚穿传统布靴';
    }
    if (clothing?.includes('西装') || clothing?.includes('职业')) {
      return '脚穿皮鞋';
    }
    return '脚穿与服装搭配的鞋子';
  }
}

export class ScenePromptBuilder {
  static build(scene: ScriptScene): string {
    const parts: string[] = [];

    // 1. 基础环境描述
    const env = scene.environment;
    if (env.architecture) parts.push(env.architecture);
    if (env.furnishings?.length) {
      parts.push(`陈设：${env.furnishings.join('、')}`);
    }
    if (env.lighting) parts.push(env.lighting);
    if (env.colorTone) parts.push(env.colorTone);

    // 2. 时间和天气
    if (scene.timeOfDay) parts.push(scene.timeOfDay);
    if (scene.weather) parts.push(scene.weather);

    // 3. 过滤人物动作后的描述
    const cleanDescription = this.removeCharacterActions(scene.description);
    if (cleanDescription) parts.push(cleanDescription);

    return parts.join('，');
  }

  private static removeCharacterActions(description: string): string {
    // 移除人物动作描述
    // 例如："江哲坐在办公桌后" → "现代商务办公室"
    const actionPatterns = [/[^，。]+(?:坐|站|走|跑|躺|靠|拿|握|举|抱)[^，。]+[，。]/g];
    let cleaned = description;
    actionPatterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });
    return cleaned.trim();
  }
}
```

### 3. 修改资产创建逻辑

**文件**: `components/ScriptParser/CharacterMapping.tsx` 第67行

```typescript
// 修改前
prompt: scriptChar.visualPrompt || `${scriptChar.name}的角色设定`,

// 修改后
prompt: CharacterPromptBuilder.build(scriptChar),
```

**文件**: `components/ScriptParser/SceneMapping.tsx` 第65行

```typescript
// 修改前
prompt: scriptScene.visualPrompt || `${scriptScene.name}的场景设定`,

// 修改后
prompt: ScenePromptBuilder.build(scriptScene),
```

### 4. 增强结构化数据提取

**文件**: `services/scriptParser.ts` - PROMPTS.character

优化LLM提示词，强化appearance字段的提取质量：

```typescript
character: `
请基于以下剧本内容，分析角色"{characterName}"的外貌特征。

【剧本内容】
{content}

请提取以下外貌信息（只提取外貌，不包含性格、剧情）：
{
  "appearance": {
    "face": "面容：五官特征、肤色、脸型、表情",
    "hair": "发型：长度、颜色、样式（如：乌黑长发及腰）",
    "clothing": "服装：风格、颜色、款式（如：淡蓝色汉服长裙）",
    "build": "体型：高矮胖瘦（如：身材高挑、体型匀称）",
    "height": "身高（如：约165cm）"
  },
  "signatureItems": [
    "随身标志性物品，如：玉佩、长剑、折扇、眼镜等",
    "注意：只提取始终跟随人物的物品，排除临时性物品如文件、咖啡"
  ]
}

重要提示：
1. signatureItems只包含始终跟随人物的标志性物品
2. 临时性物品（文件、笔记本、咖啡杯等）不要包含
3. 如果小说未提及脚部/鞋子，根据服装风格合理推断
4. 所有描述用于AI生成全身角色设定图
`;
```

**文件**: `services/scriptParser.ts` - PROMPTS.scenesBatch

```typescript
scenesBatch: `
...
"environment": {
  "architecture": "建筑风格和环境",
  "furnishings": ["陈设物品列表，不含人物"],
  "lighting": "光线条件",
  "colorTone": "色调氛围"
},
"visualPrompt": "【系统字段，无需填写】"
...
重要提示：
1. 场景描述必须是纯环境，不能包含人物动作
2. 例如：不要说"江哲坐在办公桌后"，而应该说"现代办公室，有办公桌和椅子"
3. 场景图用于生成环境背景，不应有具体人物
`;
```

---

## 实施计划

### 阶段1: 创建PromptBuilder服务

1. 创建 `services/promptBuilder.ts`
2. 实现 CharacterPromptBuilder
3. 实现 ScenePromptBuilder
4. 编写单元测试

### 阶段2: 修改资产创建逻辑

1. 修改 `CharacterMapping.tsx` 使用 PromptBuilder
2. 修改 `SceneMapping.tsx` 使用 PromptBuilder
3. 验证生成的提示词质量

### 阶段3: 优化LLM提示词模板

1. 修改 `PROMPTS.character` 强化结构化提取
2. 修改 `PROMPTS.scenesBatch` 排除人物动作
3. 测试解析质量

### 阶段4: 验证和迭代

1. 用多个剧本测试提示词生成质量
2. 收集反馈并调整规则
3. 完善边缘情况处理

---

## 预期效果

### 角色提示词改进示例

**改进前**:

```
年轻女性约22岁，清秀面容，普通长发自然垂肩，身着简洁的职业实习生装扮，
白色衬衫搭配深色西裤，体型苗条中等身高，手中常抱着文件或笔记本，
整体形象干净利落。
```

**改进后**:

```
年轻女性约22岁，清秀面容，鹅蛋脸，普通长发自然垂肩，
身着简洁的白色衬衫搭配深色西裤职业装，体型苗条中等身高约165cm，
脚穿黑色皮鞋，整体形象干净利落。
```

**改进点**:

- ✅ 移除了"手中常抱着文件或笔记本"（临时物品）
- ✅ 智能补充了"脚穿黑色皮鞋"（全身图完整性）
- ✅ 保留了所有外貌特征

### 场景提示词改进示例

**改进前**:

```
现代商务办公室内景，江哲坐在办公桌后，苏晴站在桌前整理散落的文件。
办公室采用冷色调装修，桌上摆放着笔记本电脑和文件堆，
光线从天花板灯具洒下，营造紧张的工作氛围。
```

**改进后**:

```
现代商务办公室内景，冷色调装修，有办公桌、办公椅、笔记本电脑、文件架，
天花板嵌入式灯具，自然光从落地窗洒入，整体色调偏冷，专业商务氛围。
```

**改进点**:

- ✅ 移除了"江哲坐在...""苏晴站在..."（人物动作）
- ✅ 保留了环境元素（办公桌、灯具、装修）
- ✅ 纯场景描述，适合生成背景图

---

## 总结

这个方案的核心是：**从"让LLM生成提示词"转变为"让LLM提取数据，系统智能组装提示词"**。

这样做的好处：

1. **可控性**: 系统规则明确，不受LLM随机性影响
2. **可维护性**: 规则可调整、可扩展
3. **一致性**: 所有角色/场景遵循统一标准
4. **可优化性**: 可以根据反馈持续改进组装规则
