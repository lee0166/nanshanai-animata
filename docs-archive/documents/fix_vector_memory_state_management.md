# 智能记忆开关状态管理修复方案

## 问题总结

### 核心问题

1. **状态初始化问题**：`useVectorMemory` 默认 `false`，未从配置读取
2. **自动检测覆盖用户选择**：导入小说时 `shouldEnable` 强制覆盖用户手动选择
3. **URL 硬编码问题**：使用 `http://localhost:8000` 而非 `/chroma` 代理
4. **状态不同步**：`VectorMemoryToggle` 与 `ScriptManager` 状态不一致
5. **状态不可见**：解析完成后无法查看智能记忆是否开启

## 修复方案

### 修复 1：初始化时从配置读取状态

**文件**：`views/ScriptManager.tsx`

**修改位置**：第 88 行

**修改内容**：

```typescript
// 修改前
const [useVectorMemory, setUseVectorMemory] = useState(false);

// 修改后
const [useVectorMemory, setUseVectorMemory] = useState(() => {
  // 从配置读取初始状态，尊重用户手动选择
  return vectorMemoryConfig.getConfig().enabled;
});
```

### 修复 2：自动检测不覆盖用户手动选择

**文件**：`views/ScriptManager.tsx`

**修改位置**：第 279-280 行（`handleTextImport` 函数）和第 1321-1322 行

**修改内容**：

```typescript
// 修改前
const shouldEnable = vectorMemoryConfig.shouldEnable(wordCount);
setUseVectorMemory(shouldEnable);

// 修改后
const config = vectorMemoryConfig.getConfig();
// 只有用户未手动开启时，才根据字数自动检测
if (!config.enabled) {
  const shouldEnable = vectorMemoryConfig.shouldEnable(wordCount);
  setUseVectorMemory(shouldEnable);
  // 同时更新配置
  if (shouldEnable) {
    vectorMemoryConfig.setEnabled(true);
  }
}
// 如果用户已手动开启，保持开启状态，不做任何操作
```

### 修复 3：使用 `/chroma` 代理 URL

**文件**：`views/ScriptManager.tsx`

**修改位置**：第 397-399 行 和 495-497 行

**修改内容**：

```typescript
// 修改前
vectorMemoryConfig: useVectorMemory
  ? {
      autoEnableThreshold: 50000,
      chromaDbUrl: 'http://localhost:8000',
      collectionName: 'script_memory',
    }
  : undefined;

// 修改后
vectorMemoryConfig: useVectorMemory
  ? {
      autoEnableThreshold: 50000,
      chromaDbUrl: '/chroma', // 使用 Vite 代理，避免 CORS
      collectionName: 'script_memory',
    }
  : undefined;
```

### 修复 4：同步开关状态到 ScriptManager

**文件**：`views/ScriptManager.tsx`

**修改位置**：`VectorMemoryToggle` 组件调用处

**修改内容**：

```typescript
// 确保 onToggle 回调正确更新状态
<VectorMemoryToggle
  wordCount={scriptWordCount}
  onToggle={(enabled) => {
    setUseVectorMemory(enabled);
    // 同时更新配置
    vectorMemoryConfig.setEnabled(enabled);
  }}
/>
```

### 修复 5：解析结果页面显示智能记忆状态

**文件**：`views/ScriptManager.tsx` 或相关结果展示组件

**修改位置**：解析完成后的结果展示区域

**修改内容**：

```typescript
// 在解析结果页面添加智能记忆状态标识
<div className="flex items-center gap-2 text-sm text-gray-600">
  {useVectorMemory ? (
    <>
      <Brain className="w-4 h-4 text-blue-500" />
      <span className="text-blue-600">智能记忆已启用</span>
    </>
  ) : (
    <>
      <Brain className="w-4 h-4 text-gray-400" />
      <span className="text-gray-400">智能记忆未启用</span>
    </>
  )}
</div>
```

### 修复 6：重新解析时显示当前配置

**文件**：`views/ScriptManager.tsx`

**修改位置**：重新解析按钮的处理逻辑

**修改内容**：

```typescript
// 在点击重新解析前，显示当前配置确认
const handleReparse = () => {
  // 显示当前配置
  const config = vectorMemoryConfig.getConfig();
  showToast(`重新解析将使用${config.enabled ? '智能记忆' : '标准'}模式`, 'info');

  // 执行重新解析
  // ...
};
```

或者添加一个配置确认弹窗：

```typescript
// 重新解析前显示配置确认弹窗
const [showReparseConfirm, setShowReparseConfirm] = useState(false);

// 在重新解析按钮点击时
onClick={() => setShowReparseConfirm(true)}

// 弹窗内容显示当前配置
<Modal>
  <ModalHeader>确认重新解析</ModalHeader>
  <ModalBody>
    <div>当前解析模式：{useVectorMemory ? '智能记忆' : '标准'}</div>
    <div>小说字数：{scriptWordCount}</div>
    <VectorMemoryToggle
      wordCount={scriptWordCount}
      onToggle={setUseVectorMemory}
    />
  </ModalBody>
  <ModalFooter>
    <Button onClick={() => setShowReparseConfirm(false)}>取消</Button>
    <Button onClick={handleParseScript}>开始解析</Button>
  </ModalFooter>
</Modal>
```

## 实施顺序

1. **修复 3**（URL 硬编码）- 最高优先级，影响功能可用性
2. **修复 1**（初始化状态）- 高优先级，影响状态一致性
3. **修复 2**（不覆盖用户选择）- 高优先级，影响用户体验
4. **修复 4**（状态同步）- 中优先级，确保开关正常工作
5. **修复 5**（状态展示）- 中优先级，提升用户体验
6. **修复 6**（重新解析确认）- 低优先级，可选优化

## 验证步骤

1. 开启智能记忆开关
2. 导入小说（< 5万字）
3. 确认开关保持开启状态
4. 一键解析
5. 查看控制台日志，确认 `Vector memory enabled`
6. 解析完成后，查看结果页面显示智能记忆状态
7. 点击重新解析，确认显示当前配置

## 预期结果

- 用户开启智能记忆后，状态会被正确保存和恢复
- 导入小说时不会覆盖用户的手动选择
- ChromaDB 通过 `/chroma` 代理正确连接
- 解析结果页面显示智能记忆开启状态
- 重新解析时用户可以确认或修改配置
