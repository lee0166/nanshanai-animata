# 质量报告卡片Tabs集成优化方案

## 问题分析

当前质量报告卡片放在解析状态卡片下方，导致：

1. 页面布局被撑开，影响下方Tabs内容的显示区域
2. 质量报告占据了过多的垂直空间
3. 用户需要滚动才能看到Tabs内容

## 优化方案

将质量报告从独立卡片改为Tabs中的一个标签页，放在"分镜"标签之后。

### 新标签页设计

**位置**：在Tabs中新增一个"质量评估"标签，顺序为：

1. 原文
2. 角色
3. 场景
4. 道具
5. 分镜
6. **质量评估（新增）**

**标签标题**：

```tsx
<Tab
  key="quality"
  title={
    <div className="flex items-center gap-2">
      <Sparkles size={16} />
      <span>质量评估</span>
      {qualityReport && (
        <Chip size="sm" color={getQualityColor(qualityReport.score)} variant="flat">
          {qualityReport.score}分
        </Chip>
      )}
    </div>
  }
>
```

### 内容区域设计

质量评估标签页内包含：

1. **评分概览区**（顶部）- 紧凑设计
   - 左侧：圆形分数徽章（大字体显示总分）
   - 右侧：质量等级文字 + 简短评价
   - **不使用长条进度条**

2. **问题统计区**（横向排列）
   - 严重问题数量卡片
   - 警告数量卡片
   - 提示数量卡片

3. **详细报告区**（下方列表）
   - 严重问题列表（红色）
   - 警告列表（黄色）
   - 改进建议列表（蓝色）

4. **空状态**
   - 尚未解析时显示提示："请先完成剧本解析以查看质量评估"

### 数据结构

复用现有的 `QualityReport` 类型：

```typescript
interface QualityReport {
  score: number;
  violations: RuleViolation[];
  suggestions: string[];
}
```

### 状态管理调整

1. 移除 `showQualityReport` 状态（不再需要控制显示/隐藏）
2. 保留 `qualityReport` 状态用于存储报告数据
3. 质量报告数据在解析完成后自动获取并存储

### UI布局调整

**当前代码位置**：

- 质量报告卡片目前在 `renderParseState()` 函数外部、主return语句中渲染

**调整后**：

- 将质量报告内容移到Tabs内部作为新的Tab
- 删除独立的质量报告卡片渲染代码
- 在ScriptManager的主return语句中移除 `<QualityReportCard />` 的调用

### 样式规范

使用HeroUI组件保持一致性：

- `Card` + `CardBody` 作为内容容器
- `Chip` 显示标签和分数徽章
- **不使用Progress进度条组件**
- `Tabs` + `Tab` 作为导航
- 高度限制：`h-[420px] overflow-y-auto` 与其他Tab保持一致

### 评分展示设计（替代进度条）

```tsx
// 圆形分数展示
<div className="flex items-center gap-4">
  {/* 左侧：圆形分数 */}
  <div
    className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold ${getScoreBgColor(score)}`}
  >
    {score}
  </div>
  {/* 右侧：等级和评价 */}
  <div>
    <div className="text-lg font-medium">{getQualityLabel(score)}</div>
    <div className="text-sm text-default-500">{getQualityDescription(score)}</div>
  </div>
</div>
```

### 图标

使用Lucide React图标：

- `Sparkles` - 质量评估标签图标
- `AlertCircle` - 严重问题
- `AlertTriangle` - 警告
- `Info` - 提示
- `CheckCircle` - 优秀状态

## 实施步骤

1. **修改ScriptManager.tsx**
   - 移除 `showQualityReport` 状态
   - 删除独立的质量报告卡片渲染代码
   - 在Tabs中添加新的"质量评估"Tab
   - 在Tab内容中内联渲染质量报告UI

2. **删除QualityReportCard组件**
   - 直接删除 `components/ScriptParser/QualityReportCard.tsx` 文件
   - 将质量报告UI代码内联到Tab内容中
   - 简化项目结构，避免冗余组件

3. **测试验证**
   - 确认Tabs正常切换
   - 确认质量报告数据正确显示
   - 确认页面布局正常，无撑开问题

## 预期效果

1. 页面布局恢复正常，Tabs区域有固定的显示空间
2. 质量报告作为独立标签页，用户可主动查看
3. 标签上显示分数徽章，一目了然
4. 与其他解析结果（角色、场景等）平级展示，逻辑更清晰
