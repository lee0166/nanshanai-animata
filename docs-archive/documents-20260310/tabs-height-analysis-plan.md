# Tabs容器高度不统一问题分析与解决方案

## 问题现象

- 原文Tab：内容超出页面，无法滚动查看完整内容
- 分镜Tab：高度正常（420px），可以滚动
- 角色、场景、道具、质量评估Tab：需要检查高度是否统一

## 根本原因分析

通过代码检查，发现各Tab的高度设置不一致：

### 1. 原文Tab（key="source"）

**位置**: views/ScriptManager.tsx 第862行

```tsx
<div className="max-h-[600px] overflow-y-auto">
  <pre className="whitespace-pre-wrap font-mono text-sm text-default-700">
    {currentScript.content}
  </pre>
</div>
```

**问题**:

- 外层CardBody没有设置固定高度
- 内层div使用`max-h-[600px]`而不是固定高度
- 没有统一的容器高度控制

### 2. 角色Tab（key="characters"）

**位置**: views/ScriptManager.tsx 第883行

```tsx
<Card>
  <CardBody className="h-[420px] overflow-y-auto">
    <CharacterMapping ... />
  </CardBody>
</Card>
```

**状态**: ✅ 高度正确（420px）

### 3. 场景Tab（key="scenes"）

**位置**: views/ScriptManager.tsx 第906行

```tsx
<Card>
  <CardBody className="h-[420px] overflow-y-auto">
    <SceneMapping ... />
  </CardBody>
</Card>
```

**状态**: ✅ 高度正确（420px）

### 4. 道具Tab（key="items"）

**位置**: views/ScriptManager.tsx 第929行

```tsx
<Card>
  <CardBody className="h-[420px] overflow-y-auto">
    <ItemMapping ... />
  </CardBody>
</Card>
```

**状态**: ✅ 高度正确（420px）

### 5. 分镜Tab（key="shots"）

**位置**: views/ScriptManager.tsx 第952行

```tsx
<Card>
  <CardBody className="h-[420px] overflow-y-auto">
    <ShotList ... />
  </CardBody>
</Card>
```

**状态**: ✅ 高度正确（420px）

### 6. 质量评估Tab（key="quality"）

**位置**: views/ScriptManager.tsx 第995行

```tsx
<Card>
  <CardBody className="h-[420px] overflow-y-auto">
    {qualityReport ? (...) : (...)}
  </CardBody>
</Card>
```

**状态**: ✅ 高度正确（420px）

## 问题总结

**只有"原文"Tab的高度设置与其他Tab不一致**:

| Tab      | 高度设置                 | 状态    |
| -------- | ------------------------ | ------- |
| 原文     | max-h-[600px]（内层div） | ❌ 问题 |
| 角色     | h-[420px]（CardBody）    | ✅ 正常 |
| 场景     | h-[420px]（CardBody）    | ✅ 正常 |
| 道具     | h-[420px]（CardBody）    | ✅ 正常 |
| 分镜     | h-[420px]（CardBody）    | ✅ 正常 |
| 质量评估 | h-[420px]（CardBody）    | ✅ 正常 |

## 根本原因

1. **原文Tab缺少CardBody高度限制**: 其他Tab都在`<CardBody>`上设置了`h-[420px] overflow-y-auto`，但原文Tab的CardBody没有设置高度
2. **max-h-[600px]不够准确**: 即使设置了max-h，也可能因为外层容器没有约束而导致高度计算问题
3. **结构不一致**: 原文Tab内部有一个提示div + 内容div，结构与其他Tab不同

## 解决方案

### 方案：统一所有Tab的高度设置

将原文Tab的结构修改为与其他Tab一致：

```tsx
<Tab key="source" ...>
  <Card>
    <CardBody className="h-[420px] overflow-y-auto">
      {currentScript.parseState.stage !== 'completed' && (
        <div className="mb-4 p-3 bg-primary-50 border border-primary-200 rounded-lg">
          {/* 提示内容 */}
        </div>
      )}
      <pre className="whitespace-pre-wrap font-mono text-sm text-default-700">
        {currentScript.content}
      </pre>
    </CardBody>
  </Card>
</Tab>
```

**修改点**:

1. 给`<CardBody>`添加`className="h-[420px] overflow-y-auto"`
2. 移除内层div的`max-h-[600px] overflow-y-auto`
3. 保持提示div和内容pre的结构

## 实施步骤

1. 修改views/ScriptManager.tsx第851-867行
2. 统一使用`h-[420px] overflow-y-auto`作为所有Tab的容器高度
3. 验证所有Tab的高度一致性

## 预期效果

- 所有6个Tab（原文、角色、场景、道具、分镜、质量评估）的容器高度统一为420px
- 内容超出时都可以滚动查看
- 页面布局整齐一致
