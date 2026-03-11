# 修复智能配置推荐显示问题

## 问题确认

从截图可以看出：

**长文本（7033字）- 第一张图：**

- ✅ 智能配置推荐显示正常（完整的橙色卡片）
- ✅ 平台模板快速选择显示正常
- ✅ 当前配置区域显示正常

**短文本（339字）- 第二张图：**

- ❌ 智能配置推荐显示异常（只显示了一个橙色的"应用推荐配置"按钮，没有完整卡片内容）
- ✅ 平台模板快速选择显示正常
- ✅ 当前配置区域显示正常

## 问题根源

代码逻辑（第361行）：

```typescript
{!isConfigMatchingRecommendation() && (
  <Card className="border border-primary/30 bg-primary/5 dark:bg-primary/10">
    {/* 智能配置推荐内容 */}
  </Card>
)}
```

**短文本场景：**

- 推荐配置：全部关闭（轻量级模式）
- 当前配置：全部关闭
- `isConfigMatchingRecommendation()` 返回 true
- 条件 `!isConfigMatchingRecommendation()` 为 false
- 智能推荐卡片**不显示**

**但截图中显示了一个橙色的按钮**，这说明：

1. 要么卡片部分渲染了（样式问题）
2. 要么有其他逻辑导致按钮显示

## 修复方案

**方案：让智能推荐卡片始终显示**

修改逻辑：

1. 移除 `!isConfigMatchingRecommendation()` 条件
2. 始终显示智能推荐卡片
3. 根据匹配状态改变卡片样式和内容：
   - **配置不匹配**：显示"💡 智能配置推荐" + "应用推荐配置"按钮（橙色卡片）
   - **配置已匹配**：显示"✅ 当前配置已是最优"（绿色卡片）

## 实施步骤

1. 修改 `ParseConfigConfirmModal.tsx` 第361-432行
2. 移除条件判断，始终渲染智能推荐卡片
3. 根据 `isConfigMatchingRecommendation()` 改变卡片样式
4. 测试验证短文本和长文本场景
