# 修复容器挤压问题

## 问题根源（代码层面确认）

### 1. ModalBody高度限制（第336行）

```typescript
<ModalBody className="space-y-4 max-h-[70vh] overflow-y-auto">
```

- `max-h-[70vh]`: 最大高度为视口高度的70%
- `overflow-y-auto`: 内容超出时显示滚动条

### 2. 警告信息区域（第533-550行）

```typescript
{warnings.length > 0 && (
  <div className="space-y-2">
    {warnings.map((warning, index) => (
      <div className="...">{warning.message}</div>
    ))}
  </div>
)}
```

**长文本（7000字）时：**

- `wordCount >= 3000 && !config.useDurationBudget` 为 true
- 渲染警告信息："当前文本较长，建议开启时长预算规划以获得更好的效果"
- 增加内容高度，触发滚动条
- 智能推荐卡片被挤压

**短文本（339字）时：**

- `wordCount >= 3000` 为 false
- 不渲染警告信息
- 内容高度较小，不触发滚动条
- 智能推荐卡片显示正常

## 修复方案

### 方案1：增加ModalBody高度限制（推荐）

将 `max-h-[70vh]` 改为 `max-h-[80vh]` 或 `max-h-[85vh]`，给内容更多空间。

### 方案2：优化内容布局

- 将警告信息区域移到智能推荐卡片上方
- 或者将警告信息合并到智能推荐卡片中

### 方案3：使用更紧凑的布局

- 减少各区域之间的间距
- 使用更小的字体
- 折叠部分不重要的信息

## 建议实施方案

**采用方案1 + 方案3的组合：**

1. 增加ModalBody高度到 `max-h-[85vh]`
2. 优化智能推荐卡片的布局，使其更紧凑
3. 确保在滚动时，智能推荐卡片不会被挤压

## 具体修改

### 修改1：ModalBody高度

```typescript
// 第336行
<ModalBody className="space-y-4 max-h-[85vh] overflow-y-auto">
```

### 修改2：优化智能推荐卡片布局

- 减少内边距
- 使用更紧凑的网格布局
- 确保关键信息（模式、平台、节奏）突出显示

### 修改3：调整内容顺序

将警告信息区域放在智能推荐卡片下方，避免挤压推荐卡片。
