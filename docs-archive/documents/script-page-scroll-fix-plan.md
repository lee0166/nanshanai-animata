# 剧本页面滚动问题修复计划

## 问题分析

### 用户反馈

1. **分镜表**（50个分镜）：
   - ✅ 能够完全显示所有内容
   - ✅ 滚动到底能看到完整内容
   - ✅ 容器边缘在页面底端清晰可见

2. **场景标签页**（4个场景）：
   - ❌ 容器似乎还有一部分未显示
   - ❌ 内容被截断，无法看到完整内容

### 根本原因

**分镜表的实现方式**（能正常工作）：

```tsx
<Tab key="shots">
  <Card>
    <CardBody className="h-[420px] overflow-y-auto">
      <ShotList ... />
    </CardBody>
  </Card>
</Tab>
```

**场景/角色/道具的实现方式**（有问题）：

```tsx
<Tab key="scenes">
  <SceneMapping ... />  {/* 直接是组件，没有 Card 包裹 */}
</Tab>
```

**关键区别**：

- 分镜表使用了 `<Card>` 和 `<CardBody>` 包裹，CardBody 有 `h-[420px] overflow-y-auto`
- 场景/角色/道具直接是 Mapping 组件，没有 Card 包裹

## 修复方案

### 方案：参照分镜表，添加 Card 包裹

在 `ScriptManager.tsx` 中，为角色、场景、道具标签页添加与分镜表相同的 Card 结构。

### 具体修改

#### ScriptManager.tsx

**角色标签页修改**：

```tsx
<Tab key="characters" ...>
  <Card>
    <CardBody className="h-[420px] overflow-y-auto">
      <CharacterMapping ... />
    </CardBody>
  </Card>
</Tab>
```

**场景标签页修改**：

```tsx
<Tab key="scenes" ...>
  <Card>
    <CardBody className="h-[420px] overflow-y-auto">
      <SceneMapping ... />
    </CardBody>
  </Card>
</Tab>
```

**道具标签页修改**：

```tsx
<Tab key="items" ...>
  <Card>
    <CardBody className="h-[420px] overflow-y-auto">
      <ItemMapping ... />
    </CardBody>
  </Card>
</Tab>
```

### 同时需要回滚之前的修复

之前修改了 `SceneMapping.tsx`、`CharacterMapping.tsx`、`ItemMapping.tsx`，添加了 `h-[420px] overflow-y-auto` 容器。现在需要在 ScriptManager.tsx 中添加 Card 包裹，同时移除 Mapping 组件内部的滚动容器（避免双重滚动）。

## 验证标准

1. **场景标签页**（4个场景）：
   - ✅ 容器边缘在页面底端清晰可见
   - ✅ 所有场景卡片完整显示
   - ✅ 鼠标滚动可查看完整内容

2. **角色标签页**：
   - ✅ 无论角色数量多少，容器都能自适应
   - ✅ 滚动功能正常

3. **道具标签页**：
   - ✅ 无论道具数量多少，容器都能自适应
   - ✅ 滚动功能正常

4. **分镜表**：
   - ✅ 保持原有正常显示效果

## 预期效果

- 所有标签页（原文、角色、场景、道具、分镜）的容器都能完整适配不同数量的内容
- 容器边缘在页面底端清晰可见
- 通过鼠标滚动可以查看完整内容
