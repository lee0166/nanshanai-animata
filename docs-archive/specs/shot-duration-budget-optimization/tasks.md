# 分镜时长预算优化 - 任务列表

> **change-id**: shot-duration-budget-optimization  
> **目标**: 解决"7000字小说→43个分镜→2分28秒"生产不可用问题  
> **原则**: 不破坏现有功能，通过配置开关控制

---

## Phase 1: 预算规划器（Budget Planner）

### Task 1.1: 创建 BudgetPlanner 核心模块 ✅

**描述**: 创建 `services/parsing/BudgetPlanner.ts` 模块，实现从字数到总时长预算的计算逻辑
**验收标准**:

- [x] 实现 `DurationBudget` 和 `SceneBudget` 接口
- [x] 实现 `calculateBudget()` 方法，支持不同平台和节奏类型
- [x] 7000字小说输出总时长在3-5分钟范围
- [x] 场景时长分配合理（开场/高潮/结尾权重不同）
      **依赖**: 无
      **预计工时**: 2h
      **状态**: 已完成

### Task 1.2: 集成 BudgetPlanner 到 ScriptParser ✅

**描述**: 在 `services/scriptParser.ts` 中集成 BudgetPlanner，在场景分析后、分镜生成前计算预算
**验收标准**:

- [x] ScriptParser 构造函数中初始化 BudgetPlanner（根据配置）
- [x] parseScript 方法中在适当时机调用预算计算
- [x] 预算结果传递给 generateShots 方法
- [x] 配置开关 `useDurationBudget` 控制是否启用
      **依赖**: Task 1.1
      **预计工时**: 1h
      **状态**: 已完成

### Task 1.3: 添加配置项和默认值 ✅

**描述**: 扩展 `ScriptParserConfig` 接口，添加时长预算相关配置项
**验收标准**:

- [x] 添加 `useDurationBudget: boolean`（默认false）
- [x] 添加 `targetPlatform: 'douyin' | 'kuaishou' | 'bilibili' | 'premium'`
- [x] 添加 `paceType: 'fast' | 'normal' | 'slow'`
- [x] 配置项有完整的JSDoc注释
      **依赖**: 无
      **预计工时**: 0.5h
      **状态**: 已完成

### Task 1.4: 编写单元测试 ✅

**描述**: 为 BudgetPlanner 编写完整的单元测试
**验收标准**:

- [x] 测试不同字数（1000/5000/10000字）的预算计算
- [x] 测试不同平台（douyin/bilibili/premium）的差异
- [x] 测试不同节奏（fast/normal/slow）的差异
- [x] 测试场景权重分配逻辑
- [x] 测试覆盖率 > 80%
      **依赖**: Task 1.1
      **预计工时**: 1h
      **状态**: 已完成

---

## Phase 2: 动态时长策略（Dynamic Duration Strategy）

### Task 2.1: 创建 DurationStrategy 核心模块 ✅

**描述**: 创建 `services/parsing/DurationStrategy.ts` 模块，实现场景类型识别和时长策略
**验收标准**:

- [x] 定义 `SceneType` 类型（opening/dialogue/action/emotion/climax/ending）
- [x] 定义 `DurationStrategy` 接口和策略库
- [x] 不同场景类型有不同的基础时长和范围
- [x] 支持调整因子（对话密度、动作强度等）
      **依赖**: 无
      **预计工时**: 2h
      **状态**: 已完成

### Task 2.2: 实现场景类型自动识别 ✅

**描述**: 实现 `detectSceneType()` 函数，根据场景内容和位置自动识别场景类型
**验收标准**:

- [x] 根据场景在故事中的位置识别（开场/高潮/结尾）
- [x] 根据场景内容关键词识别（动作/情感/对话）
- [x] 返回准确的 SceneType
- [x] 有合理的默认 fallback
      **依赖**: Task 2.1
      **预计工时**: 1h
      **状态**: 已完成（已在DurationStrategy.ts中实现）

### Task 2.3: 集成 DurationStrategy 到 generateShots ✅

**描述**: 修改 `generateShots` 方法，使用 DurationStrategy 获取时长约束
**验收标准**:

- [x] generateShots 接收 DurationStrategy 参数
- [x] 根据场景类型获取对应的时长范围
- [x] 将时长约束传递给 Prompt
- [x] 配置开关 `useDynamicDuration` 控制是否启用
      **依赖**: Task 2.1, Task 2.2
      **预计工时**: 1h
      **状态**: 已完成（与Prompt集成一起完成）

### Task 2.4: 编写单元测试 ✅

**描述**: 为 DurationStrategy 编写完整的单元测试
**验收标准**:

- [x] 测试场景类型识别准确性
- [x] 测试不同场景类型的时长策略
- [x] 测试调整因子计算
- [x] 测试覆盖率 > 80%
      **依赖**: Task 2.1, Task 2.2
      **预计工时**: 1h
      **状态**: 已完成

---

## Phase 3: Prompt 工程优化

### Task 3.1: 创建生产级 Prompt 模板 ✅

**描述**: 创建新的生产级 Prompt 模板，包含预算和策略上下文
**验收标准**:

- [x] 创建 `PRODUCTION_PROMPT` 常量
- [x] 包含预算信息（总时长、场景分配、单镜范围）
- [x] 包含场景信息（名称、类型、位置、重要性）
- [x] 包含时长分配策略和硬性约束
- [x] 输出格式包含 rationale 字段说明时长选择理由
      **依赖**: 无
      **预计工时**: 2h
      **状态**: 已完成

### Task 3.2: 集成新 Prompt 到 generateShots ✅

**描述**: 修改 `generateShots` 方法，使用新 Prompt 模板
**验收标准**:

- [x] 根据配置选择使用新/旧 Prompt
- [x] 正确填充 Prompt 中的模板变量
- [x] 预算和策略信息正确传递
- [x] 保留原有 Prompt 作为 fallback
      **依赖**: Task 3.1, Task 1.2, Task 2.3
      **预计工时**: 1h
      **状态**: 已完成

### Task 3.3: A/B 测试对比效果

**描述**: 使用相同小说文本，对比新旧 Prompt 生成的分镜质量
**验收标准**:

- [ ] 准备测试小说文本（7000字左右）
- [ ] 分别使用新旧 Prompt 生成
- [ ] 对比总时长、分镜数、单镜时长分布
- [ ] 记录测试结果数据
      **依赖**: Task 3.2
      **预计工时**: 2h

### Task 3.4: 根据测试结果调优

**描述**: 根据 A/B 测试结果，调整 Prompt 和策略参数
**验收标准**:

- [ ] 分析测试结果，识别问题
- [ ] 调整 Prompt 中的约束条件
- [ ] 调整时长策略参数
- [ ] 重新测试验证改进效果
      **依赖**: Task 3.3
      **预计工时**: 2h

---

## Phase 4: 后处理校验系统（QC System）

### Task 4.1: 创建 ShotQC 核心模块 ✅

**描述**: 创建 `services/parsing/ShotQC.ts` 模块，实现分镜质量校验
**验收标准**:

- [x] 定义 `QCReport`、`QCIssue` 接口
- [x] 实现基础校验框架
- [x] 支持多种校验规则
- [x] 返回详细的校验报告
      **依赖**: 无
      **预计工时**: 2h
      **状态**: 已完成

### Task 4.2: 实现校验规则 ✅

**描述**: 实现具体的校验规则（总时长、节奏变化、时长范围）
**验收标准**:

- [x] 实现总时长校验规则（±15%误差）
- [x] 实现节奏变化校验规则（禁止连续3镜相同时长）
- [x] 实现时长范围校验规则（在min-max范围内）
- [x] 每个规则返回通过状态和评分
      **依赖**: Task 4.1
      **预计工时**: 1h
      **状态**: 已完成

### Task 4.3: 实现自动调整策略 ✅

**描述**: 实现自动调整不符合预算的分镜的策略
**验收标准**:

- [x] 实现压缩非关键场景时长策略
- [x] 实现扩展关键场景时长策略
- [x] 调整后的分镜时长分布合理
- [x] 保留调整日志
      **依赖**: Task 4.2
      **预计工时**: 2h
      **状态**: 已完成

### Task 4.4: 集成 ShotQC 到 ScriptParser ✅

**描述**: 在 `generateShots` 后集成 ShotQC 校验
**验收标准**:

- [x] generateShots 后调用 QC 校验
- [x] 根据配置决定是否自动调整
- [x] 校验报告可导出或显示
- [x] 配置开关 `useShotQC` 和 `qcAutoAdjust` 控制
      **依赖**: Task 4.1, Task 4.2, Task 4.3
      **预计工时**: 1h
      **状态**: 已完成

### Task 4.5: 编写单元测试 ✅

**描述**: 为 ShotQC 编写完整的单元测试
**验收标准**:

- [x] 测试各种校验规则
- [x] 测试自动调整策略
- [x] 测试边界情况
- [x] 测试覆盖率 > 80%
      **依赖**: Task 4.1, Task 4.2, Task 4.3
      **预计工时**: 1h
      **状态**: 已完成

---

## Phase 5: 配置系统与 UI

### Task 5.1: 扩展 ScriptParserConfig 类型 ✅

**描述**: 在类型定义文件中完整扩展配置接口
**验收标准**:

- [x] 所有新配置项有类型定义
- [x] 配置有合理的默认值
- [x] 配置有完整的注释说明
      **依赖**: Task 1.3
      **预计工时**: 0.5h
      **状态**: 已完成

### Task 5.2: 前端添加配置界面 ✅

**描述**: 在设置页面或剧本管理页面添加时长预算配置 UI
**验收标准**:

- [x] 添加平台选择（抖音/快手/B站/精品）
- [x] 添加节奏选择（快/中/慢）
- [x] 添加功能开关（预算规划/动态时长/后处理校验）
- [x] UI 使用 HeroUI 组件，符合设计规范
      **依赖**: Task 5.1
      **预计工时**: 2h
      **状态**: 已完成

### Task 5.3: 配置持久化 ✅

**描述**: 将配置保存到设置存储中
**验收标准**:

- [x] 配置变更自动保存
- [x] 页面刷新后配置不丢失
- [x] 配置与项目绑定或全局共享（根据设计）
      **依赖**: Task 5.2
      **预计工时**: 0.5h
      **状态**: 已完成

---

## 任务依赖关系图

```
Phase 1:
  Task 1.1 → Task 1.2
  Task 1.1 → Task 1.4
  Task 1.3 → Task 1.2

Phase 2:
  Task 2.1 → Task 2.2
  Task 2.1 → Task 2.3
  Task 2.2 → Task 2.3
  Task 2.1 → Task 2.4
  Task 2.2 → Task 2.4

Phase 3:
  Task 3.1 → Task 3.2
  Task 1.2 → Task 3.2  (预算信息)
  Task 2.3 → Task 3.2  (策略信息)
  Task 3.2 → Task 3.3
  Task 3.3 → Task 3.4

Phase 4:
  Task 4.1 → Task 4.2
  Task 4.2 → Task 4.3
  Task 4.1 → Task 4.4
  Task 4.2 → Task 4.4
  Task 4.3 → Task 4.4
  Task 4.1 → Task 4.5
  Task 4.2 → Task 4.5
  Task 4.3 → Task 4.5

Phase 5:
  Task 5.1 → Task 5.2
  Task 5.2 → Task 5.3
```

---

## 实施建议

### 并行执行任务

- Phase 1、Phase 2 可以并行开发（无依赖）
- Phase 3 依赖 Phase 1 和 Phase 2 完成
- Phase 4 可以独立开发，最后集成
- Phase 5 依赖前面的配置定义

### 风险缓解

- 每个 Phase 都有独立的配置开关，可随时回滚
- 建议先完成 Phase 1-3（核心功能），再考虑 Phase 4-5
- A/B 测试是关键，确保新 Prompt 效果优于旧 Prompt

---

**文档版本**: v1.0  
**创建日期**: 2026-03-05
