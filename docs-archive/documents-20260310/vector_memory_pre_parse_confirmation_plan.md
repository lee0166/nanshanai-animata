# 智能记忆预解析确认优化方案

## 核心问题

长文本解析消耗大量 Token，用户在解析前必须**明确知晓并确认**智能记忆状态，避免不必要的成本。

## 优化原则

1. **解析前强制确认**：用户必须看到当前配置并确认后才能解析
2. **状态实时可见**：配置状态在界面上始终可见
3. **防止误操作**：避免用户无意识下使用高成本配置

## 完整优化方案

### 优化 1：导入小说后显示配置确认弹窗

**触发时机**：用户导入小说后，点击"解析"按钮前

**弹窗内容**：

```
┌─────────────────────────────────────────┐
│           确认解析配置                   │
├─────────────────────────────────────────┤
│                                         │
│ 📄 小说信息：                            │
│    标题：混沌仙途                        │
│    字数：16,189 字（约 1.6 万字）        │
│    预估 Token：~8,000                    │
│                                         │
│ ⚙️ 解析配置：                            │
│    🧠 智能记忆        [开关] 已关闭      │
│    🤖 AI 模型         深度求索 V3        │
│    📊 解析模式        完整解析           │
│                                         │
│ 💡 提示：                                │
│    当前为短文本，标准解析模式即可。      │
│    开启智能记忆可提升角色一致性。        │
│                                         │
│   [取消]              [开始解析]        │
│                                         │
└─────────────────────────────────────────┘
```

**实现逻辑**：

```typescript
// ScriptManager.tsx
const [showParseConfirm, setShowParseConfirm] = useState(false);

// 点击解析按钮时
const handleParseClick = () => {
  // 强制显示配置确认弹窗
  setShowParseConfirm(true);
};

// 用户确认后才执行解析
const handleConfirmParse = () => {
  setShowParseConfirm(false);
  handleParseScript(); // 执行实际解析
};
```

### 优化 2：智能记忆开关实时影响配置提示

**实现**：开关状态变化时，实时更新提示信息

```typescript
// 当智能记忆开关变化时
const handleVectorMemoryToggle = (enabled: boolean) => {
  setUseVectorMemory(enabled);
  vectorMemoryConfig.setEnabled(enabled);

  // 更新提示信息
  if (enabled) {
    setConfigNotice('智能记忆已启用，将使用向量数据库存储语义信息，提升角色一致性');
  } else {
    setConfigNotice('使用标准解析模式');
  }
};
```

### 优化 3：解析结果页显示实际使用的配置

**实现**：在结果页面明确显示本次解析使用的配置

```tsx
// 解析结果页面
<div className="bg-gray-50 rounded-lg p-4 mb-4">
  <div className="flex justify-between items-center mb-2">
    <h3 className="font-medium">本次解析配置</h3>
    <Badge color={useVectorMemory ? 'primary' : 'default'}>
      {useVectorMemory ? '🧠 智能记忆' : '📄 标准模式'}
    </Badge>
  </div>
  <div className="text-sm text-gray-600 space-y-1">
    <div>AI 模型：深度求索 V3</div>
    <div>解析模式：完整解析</div>
    <div>Token 消耗：{tokenUsage.total}</div>
    {useVectorMemory && <div className="text-blue-600">智能记忆：已存储 {vectorCount} 个向量</div>}
  </div>
</div>
```

### 优化 4：重新解析时强制重新确认配置

**实现**：点击"重新解析"时，显示配置确认弹窗

```typescript
const handleReparseClick = () => {
  // 重置为当前配置
  const config = vectorMemoryConfig.getConfig();
  setUseVectorMemory(config.enabled);

  // 显示配置确认弹窗
  setShowParseConfirm(true);
};
```

### 优化 5：长文本特殊提示

**实现**：当字数超过阈值时，给出明确的成本提示

```typescript
const getParseWarning = (wordCount: number, useVectorMemory: boolean) => {
  const warnings = [];

  if (wordCount > 50000) {
    warnings.push({
      type: 'warning',
      message: `检测到长篇小说（${Math.round(wordCount / 10000)}万字），解析将消耗较多 Token`,
    });
  }

  if (wordCount > 50000 && !useVectorMemory) {
    warnings.push({
      type: 'info',
      message: '建议开启智能记忆，可提升长文本角色一致性',
    });
  }

  if (useVectorMemory) {
    warnings.push({
      type: 'info',
      message: '智能记忆需要下载 AI 模型（约 80MB），首次使用请耐心等待',
    });
  }

  return warnings;
};
```

## 实施步骤

### 步骤 1：创建配置确认弹窗组件

**文件**：`components/ParseConfigConfirmModal.tsx`

**功能**：

- 显示小说信息（标题、字数、预估 Token）
- 显示解析配置（智能记忆开关、AI 模型、解析模式）
- 根据字数给出提示建议
- 确认/取消按钮

### 步骤 2：修改 ScriptManager.tsx

**修改点**：

1. 添加 `showParseConfirm` 状态
2. 修改解析按钮点击逻辑，显示确认弹窗
3. 修改重新解析按钮逻辑，显示确认弹窗
4. 在结果页面添加配置摘要显示

### 步骤 3：优化 VectorMemoryToggle 组件

**修改点**：

1. 添加实时提示信息
2. 开关变化时更新提示

### 步骤 4：添加 Token 预估功能

**实现**：

```typescript
const estimateTokenCount = (wordCount: number, useVectorMemory: boolean) => {
  // 中文字符约 0.5-1 Token/字
  const baseTokens = Math.ceil(wordCount * 0.8);

  // 智能记忆会增加约 20% Token 消耗
  const multiplier = useVectorMemory ? 1.2 : 1.0;

  return Math.ceil(baseTokens * multiplier);
};
```

## 用户流程

### 新流程

1. **上传小说**
   - 用户上传小说文件
   - 系统显示字数统计

2. **点击解析**
   - 弹出配置确认弹窗
   - 显示小说信息、预估 Token、当前配置
   - 用户可调整智能记忆开关

3. **确认配置**
   - 用户确认配置无误
   - 点击"开始解析"

4. **解析中**
   - 显示进度
   - 显示当前使用的配置

5. **解析完成**
   - 显示结果
   - 显示实际使用的配置摘要
   - 显示 Token 消耗

6. **重新解析**
   - 点击"重新解析"
   - 再次弹出配置确认弹窗
   - 用户可修改配置

## 预期效果

1. **成本可控**：用户在解析前必须确认配置，避免无意识的高成本操作
2. **体验提升**：配置状态始终可见，用户有完全的控制权
3. **防止误操作**：强制确认机制减少误操作

## 验证清单

- [ ] 导入小说后点击解析，显示配置确认弹窗
- [ ] 弹窗中显示正确的字数和预估 Token
- [ ] 智能记忆开关可实时调整
- [ ] 长文本（>5万字）有特殊提示
- [ ] 确认后才执行解析
- [ ] 解析结果页面显示实际使用的配置
- [ ] 重新解析时再次显示确认弹窗
