# 修复 ScriptManager.tsx 中 t is not defined 错误

## 问题分析

从后端日志中发现错误：

```
ScriptManager.tsx:1164  Uncaught ReferenceError: t is not defined
```

**根本原因**：

- 第57行：`const { settings, isConnected, checkConnection } = useApp();`
- 只解构了 `settings, isConnected, checkConnection`，**没有解构 `t`**
- 第1164行使用了 `t={t}` 传递给 QualityReportCard 组件

## 修复方案

**修改文件**：`views/ScriptManager.tsx`

**修改内容**：

```typescript
// 第57行，添加 t 到解构中
const { settings, isConnected, checkConnection, t } = useApp();
```

## 实施步骤

1. 打开 ScriptManager.tsx
2. 找到第57行
3. 添加 `t` 到 useApp 的解构中
4. 保存文件
5. 刷新页面验证
