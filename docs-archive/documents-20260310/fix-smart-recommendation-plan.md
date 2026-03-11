# 修复智能配置推荐显示异常计划

## 问题分析

从截图可以看出：

1. **智能配置推荐区域没有显示** - 因为339字的短文本推荐配置是"轻量级模式"（不启用任何功能）
2. **当前配置已经和推荐配置一致**，所以`isConfigMatchingRecommendation()`返回true，导致推荐区域被隐藏
3. **平台模板快速选择显示正常**

## 问题根源

代码逻辑：

```typescript
{!isConfigMatchingRecommendation() && (
  <Card className="border border-primary/30 bg-primary/5 dark:bg-primary/10">
    {/* 智能配置推荐内容 */}
  </Card>
)}
```

当文本<3000字时，推荐配置是：

- useDurationBudget: false
- useProductionPrompt: false
- useShotQC: false

如果当前配置也是全部关闭，则`isConfigMatchingRecommendation()`返回true，推荐区域不显示。

## 修复方案

### 方案A：始终显示智能推荐（推荐）

修改条件，让智能推荐区域始终显示，但改变样式：

- 如果配置已匹配：显示"当前配置已是最优"提示
- 如果配置不匹配：显示"推荐配置"提示

### 方案B：为短文本添加特殊提示

即使配置匹配，也显示一个简化的提示卡片，说明为什么不需要开启这些功能。

### 方案C：修改推荐逻辑

对于短文本，也推荐开启某些功能（如useProductionPrompt），确保推荐区域始终显示。

## 建议采用方案A

原因：

1. 用户需要知道"为什么不需要开启这些功能"
2. 保持一致性，无论文本长短都显示配置建议
3. 提供透明度，让用户理解系统推荐逻辑

## 实施步骤

1. 修改`ParseConfigConfirmModal.tsx`
   - 移除`isConfigMatchingRecommendation()`的条件判断
   - 添加配置匹配状态显示
   - 为匹配状态添加绿色勾选标记

2. 测试验证
   - 短文本（<3000字）：显示轻量级模式推荐
   - 中文本（3000-8000字）：显示专业模式推荐
   - 长文本（>8000字）：显示高级模式推荐

3. 检查设置页面
   - 确认所有优化功能都在
   - 确认配置组架构正常
   - 确认依赖关系可视化正常
