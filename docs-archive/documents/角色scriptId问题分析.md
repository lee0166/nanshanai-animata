# 角色 scriptId 问题分析

## 日志分析结果

### 创建角色时（正确）

```
CharacterMapping.tsx:81 [CharacterMapping] 创建角色: {name: '柳唯', scriptId: 'script_1771159033945_3evyhc020'}
CharacterMapping.tsx:81 [CharacterMapping] 创建角色: {name: '李叔叔', scriptId: 'script_1771159033945_3evyhc020'}
```

**结论**：创建角色时 `scriptId` 正确保存了！

### 加载角色时（需要验证）

```
CharacterSidebar.tsx:35 [CharacterSidebar] 加载的角色: (4) [{…}, {…}, {…}, {…}]
```

**问题**：日志没有展开，看不到 `scriptId` 是否真的加载了

## 可能的问题

### 问题1：storageService.getAssets 没有返回 scriptId

- 存储服务可能在序列化/反序列化时丢失了 `scriptId` 字段
- 需要检查 `storage.ts` 的 `getAssets` 方法

### 问题2：类型定义问题

- `Asset` 接口有 `scriptId`，但 `CharacterAsset` 可能没有正确继承
- 需要检查类型定义

### 问题3：加载时数据被过滤

- 可能在某个地方过滤掉了 `scriptId` 字段

## 验证方案

需要修改调试代码，强制展开显示 `scriptId`：

```typescript
console.log(
  '[CharacterSidebar] 加载的角色:',
  chars.map(c => ({
    name: c.name,
    scriptId: c.scriptId,
    hasScriptId: 'scriptId' in c,
  }))
);
```

或者使用 `JSON.stringify`：

```typescript
console.log(
  '[CharacterSidebar] 加载的角色:',
  JSON.stringify(
    chars.map(c => ({
      name: c.name,
      scriptId: c.scriptId,
    })),
    null,
    2
  )
);
```

## 下一步

1. 修改调试代码，强制显示 `scriptId`
2. 刷新页面查看详细日志
3. 如果 `scriptId` 确实没有加载，检查 storage.ts
