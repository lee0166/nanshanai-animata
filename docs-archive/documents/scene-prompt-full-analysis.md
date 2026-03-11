# 场景提示词全链路深度分析与优化方案

## 问题确认

用户反馈：场景管理页面中，选择不同场景时，提示词与场景应该有的提示词出入太大。

**截图证据**：

- 场景"书桌/卧室"的提示词包含了"女孩在书桌前疲惫工作，小奶猫蜷缩在她手边"
- 场景"厨房"的提示词包含了"女孩正在灶台前煮面，小奶猫蹲在脚边"

**核心问题**：场景提示词包含了角色和动作，这是错误的。

---

## 全链路分析

### 链路1：小说解析阶段（scriptParser.ts）

**解析流程**：

```
小说文本 → LLM解析 → 提取场景信息 → 生成Scene对象
```

**关键代码位置**：`services/scriptParser.ts` 第154-180行

**解析Prompt（scenesBatch）**：

```typescript
"visualPrompt": "用于AI生图的场景环境描述：时间、地点类型、光线、环境细节、色调、氛围。必须排除：任何角色或生物、动态动作或事件、分镜式画面描述、故事情节相关的临时元素。示例：深秋傍晚，昏暗的居民楼道，墙面斑驳，地面散落几片枯叶，光线昏黄，氛围清冷，写实风格。50字以内"
```

**重要约束**：

- ✅ "必须排除：任何角色或生物"
- ✅ "禁止包含：角色、生物、动态事件、分镜描述、剧情元素"

**结论**：解析阶段的Prompt设计是正确的，明确要求不包含角色和动作。

---

### 链路2：数据存储阶段（types.ts）

**Scene类型定义**：`types.ts` 第196-209行

```typescript
export interface Scene {
  id: string;
  name: string; // 场景名称
  description: string; // 场景描述
  visualPrompt?: string; // 场景视觉提示词（用于AI生图）
  characters: string[]; // 场景中出现的角色
  // ... 其他字段
}
```

**结论**：数据结构支持存储visualPrompt，设计合理。

---

### 链路3：场景生成阶段（SceneDetail.tsx）

**组件位置**：`components/ProjectDetail/Scene/SceneDetail.tsx`

**关键代码**（第56行）：

```typescript
const [prompt, setPrompt] = useState(asset.prompt || '');
```

**问题发现**：

- 使用的是 `asset.prompt`，而不是 `asset.visualPrompt`
- 这是两个不同的字段！

**字段区别**：

- `asset.prompt`：用户手动输入或默认生成的提示词
- `asset.visualPrompt`：小说解析时生成的场景视觉提示词（正确的）

---

### 链路4：提示词构建阶段（prompt.ts）

**文件位置**：`services/prompt.ts` 第100-105行

```typescript
export const getSceneImagePrompt = (userPrompt: string) => {
  return `
    生成一张高质量的场景设定图。
    场景描述：${userPrompt}
    `;
};
```

**问题发现**：

- 这个函数直接使用用户输入的userPrompt
- 没有使用从小说解析得到的visualPrompt

---

## 根本原因总结

### 问题1：字段使用错误（核心问题）

**现状**：

- 场景管理页面显示和编辑的是 `asset.prompt` 字段
- 但小说解析生成的是 `asset.visualPrompt` 字段
- 两个字段没有关联，导致解析结果没有被使用

**证据**：

```typescript
// SceneDetail.tsx 第56行
const [prompt, setPrompt] = useState(asset.prompt || '');
// 应该使用 asset.visualPrompt
```

### 问题2：初始化逻辑缺失

**现状**：

- 创建场景时，没有将visualPrompt复制到prompt字段
- 或者没有直接使用visualPrompt字段

### 问题3：用户编辑覆盖

**现状**：

- 即使初始有正确的visualPrompt，用户编辑后保存到prompt字段
- 下次加载时读取的是prompt，而不是visualPrompt

---

## 优化方案

### 方案A：统一使用visualPrompt字段（推荐）

**修改内容**：

1. **修改 SceneDetail.tsx**
   - 第56行：改为使用 `asset.visualPrompt`
   - 所有保存操作保存到 `visualPrompt` 字段

2. **修改场景创建逻辑**
   - 在scriptParser.ts中，确保visualPrompt正确保存

3. **修改数据迁移**
   - 将现有的prompt字段数据迁移到visualPrompt

**优点**：

- 符合原始设计意图
- 字段语义清晰

**缺点**：

- 需要修改多个地方
- 需要数据迁移

---

### 方案B：初始化时复制visualPrompt到prompt（最小改动）

**修改内容**：

1. **修改 SceneDetail.tsx 初始化逻辑**
   - 如果 `asset.prompt` 为空，使用 `asset.visualPrompt` 作为默认值

**代码修改**（第56行附近）：

```typescript
// 修改前
const [prompt, setPrompt] = useState(asset.prompt || '');

// 修改后
const [prompt, setPrompt] = useState(asset.prompt || asset.visualPrompt || '');
```

2. **修改 scriptParser.ts 场景创建逻辑**
   - 创建场景时，将visualPrompt同时赋值给prompt字段

**代码修改**（第154-180行附近）：

```typescript
// 创建场景对象时
const scene: Scene = {
  ...
  visualPrompt: parsed.visualPrompt,
  prompt: parsed.visualPrompt, // 同时赋值给prompt
  ...
};
```

**优点**：

- 改动最小
- 向后兼容
- 不需要数据迁移

**缺点**：

- 字段有些冗余

---

### 方案C：增加提示词生成/优化功能（增强版）

**修改内容**：

在方案B的基础上，增加：

1. **增加"重新生成提示词"按钮**
   - 根据场景名称和描述，调用LLM重新生成纯净的visualPrompt

2. **增加提示词审核机制**
   - 检查是否包含角色名称或动作动词
   - 提示用户修改

3. **增加提示词模板**
   - 提供常见场景类型的模板

---

## 推荐实施方案

### 阶段1：立即修复（方案B）

**目标**：让现有的visualPrompt能够被正确使用

**修改文件**：

1. `components/ProjectDetail/Scene/SceneDetail.tsx`（第56行）
2. `services/scriptParser.ts`（场景创建逻辑）

**预期效果**：

- 新解析的场景会自动有正确的提示词
- 现有场景如果visualPrompt有值，会显示在prompt字段

### 阶段2：增强功能（方案C）

**目标**：提供更好的用户体验

**功能**：

- 重新生成提示词
- 提示词审核
- 模板选择

---

## 验证方法

### 测试步骤

1. **测试新场景**
   - 上传新小说
   - 解析完成后，检查场景的visualPrompt是否纯净（无角色、无动作）
   - 进入场景管理页面，查看提示词是否正确显示

2. **测试现有场景**
   - 打开已有场景
   - 如果之前有visualPrompt，应该自动显示在提示词框中

3. **测试编辑保存**
   - 修改提示词
   - 保存后重新加载
   - 确认修改已保存

---

## 总结

**核心问题**：场景管理页面使用的是`prompt`字段，但小说解析生成的是`visualPrompt`字段，两者没有关联。

**根本原因**：字段设计时考虑了区分，但实现时没有打通。

**解决方案**：方案B（最小改动）- 在初始化时将visualPrompt作为prompt的默认值。

**预期效果**：场景提示词将显示从小说解析生成的纯净环境描述，不再包含角色和动作。
