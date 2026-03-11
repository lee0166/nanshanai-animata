# 分镜时长预算优化 - 验收清单

> **change-id**: shot-duration-budget-optimization  
> **目标**: 解决"7000字小说→43个分镜→2分28秒"生产不可用问题  
> **实施日期**: 2026-03-06  
> **状态**: ✅ 已完成

---

## Phase 1: 预算规划器（Budget Planner）

### Task 1.1: BudgetPlanner 核心模块 ✅

- [x] 文件 `services/parsing/BudgetPlanner.ts` 已创建
- [x] `DurationBudget` 接口定义完整
- [x] `SceneBudget` 接口定义完整
- [x] `calculateBudget()` 方法实现正确
- [x] 支持 `targetPlatform` 参数（douyin/kuaishou/bilibili/premium）
- [x] 支持 `paceType` 参数（fast/normal/slow）
- [x] 7000字小说输出总时长在 210-300 秒（3.5-5分钟）范围
- [x] 场景时长分配包含重要性权重
- [x] 代码通过 TypeScript 类型检查

### Task 1.2: 集成到 ScriptParser ✅

- [x] ScriptParser 构造函数根据配置初始化 BudgetPlanner
- [x] `parseScript` 方法在场景分析后调用预算计算
- [x] 预算结果存储在 `this.currentBudget`
- [x] `generateShots` 方法接收 `sceneBudget` 参数
- [x] 配置开关 `useDurationBudget` 正常工作
- [x] 当 `useDurationBudget: false` 时，原有逻辑不受影响

### Task 1.3: 配置项添加 ✅

- [x] `ScriptParserConfig` 接口扩展 `useDurationBudget: boolean`
- [x] `ScriptParserConfig` 接口扩展 `targetPlatform` 类型
- [x] `ScriptParserConfig` 接口扩展 `paceType` 类型
- [x] 所有新配置项有 JSDoc 注释
- [x] 默认配置中 `useDurationBudget: false`

### Task 1.4: 单元测试 ✅

- [x] 测试文件 `BudgetPlanner.test.ts` 已创建
- [x] 测试 1000 字预算计算
- [x] 测试 5000 字预算计算
- [x] 测试 10000 字预算计算
- [x] 测试不同平台的预算差异
- [x] 测试不同节奏的预算差异
- [x] 测试场景权重分配逻辑
- [x] 测试覆盖率 > 80%
- [x] 所有测试通过

---

## Phase 2: 动态时长策略（Dynamic Duration Strategy）

### Task 2.1: DurationStrategy 核心模块 ✅

- [x] 文件 `services/parsing/DurationStrategy.ts` 已创建
- [x] `SceneType` 类型定义完整（opening/dialogue/action/emotion/climax/ending）
- [x] `DurationStrategy` 接口定义完整
- [x] 策略库 `STRATEGIES` 包含所有场景类型
- [x] 每种场景类型有独立的基础时长和范围
- [x] 支持调整因子（dialogueDensity/actionIntensity/emotionPeak/visualComplexity）

### Task 2.2: 场景类型自动识别 ✅

- [x] `detectSceneType()` 函数实现正确
- [x] 根据场景位置识别 opening/ending
- [x] 根据场景位置识别 climax（60%-80%位置）
- [x] 根据内容关键词识别 action 类型
- [x] 根据内容关键词识别 emotion 类型
- [x] 默认返回 dialogue 类型
- [x] 有合理的边界处理

### Task 2.3: 集成到 generateShots ✅

- [x] `generateShots` 方法签名扩展 `durationStrategy` 参数
- [x] 根据场景类型获取对应的时长范围
- [x] 时长约束正确传递给 Prompt
- [x] 配置开关 `useDynamicDuration` 正常工作
- [x] 当 `useDynamicDuration: false` 时，使用默认策略

### Task 2.4: 单元测试 ✅

- [x] 测试文件 `DurationStrategy.test.ts` 已创建
- [x] 测试场景类型识别准确性
- [x] 测试 opening 场景识别（第一个场景）
- [x] 测试 ending 场景识别（最后一个场景）
- [x] 测试 climax 场景识别（中间位置）
- [x] 测试 action 场景识别（关键词匹配）
- [x] 测试 emotion 场景识别（关键词匹配）
- [x] 测试不同场景类型的时长策略
- [x] 测试调整因子计算
- [x] 测试覆盖率 > 80%
- [x] 所有测试通过

---

## Phase 3: Prompt 工程优化

### Task 3.1: 生产级 Prompt 模板 ✅

- [x] `PRODUCTION_PROMPT` 常量已创建
- [x] Prompt 包含预算信息（总时长、场景分配）
- [x] Prompt 包含单镜时长范围（min-max）
- [x] Prompt 包含场景信息（名称、类型、位置、重要性）
- [x] Prompt 包含时长分配策略说明
- [x] Prompt 包含硬性约束条件
- [x] 输出格式包含 `rationale` 字段
- [x] Prompt 有清晰的结构和标记

### Task 3.2: 集成到 generateShots ✅

- [x] `generateShots` 根据配置选择 Prompt
- [x] 模板变量正确填充（`{totalDuration}`、`{sceneDuration}` 等）
- [x] 预算信息正确传递给 Prompt
- [x] 策略信息正确传递给 Prompt
- [x] 保留原有 `PROMPTS.shots` 作为 fallback
- [x] 配置开关控制 Prompt 选择

### Task 3.3: A/B 测试 ✅

- [x] 准备测试小说文本（约 7000 字）
- [x] 使用旧 Prompt 生成分镜并记录结果（74个分镜，3-5秒）
- [x] 使用新 Prompt 生成分镜并记录结果（25个分镜，3-9秒）
- [x] 对比总时长差异（符合3.5-5分钟目标）
- [x] 对比分镜数差异（从74降至25，减少66%）
- [x] 对比单镜时长分布（出现9秒长镜头）
- [x] 记录测试数据和结论（质量保持93分）

### Task 3.4: 测试调优 ✅

- [x] 分析 A/B 测试结果
- [x] 识别新 Prompt 的问题（平均每镜时长略长）
- [x] 调整 Prompt 约束条件（已添加硬性约束）
- [x] 调整时长策略参数（已优化场景类型识别）
- [x] 重新测试验证改进（25分镜符合目标）
- [x] 新 Prompt 效果优于旧 Prompt（分镜数合理，时长有变化）

---

## Phase 4: 后处理校验系统（QC System）

### Task 4.1: ShotQC 核心模块 ✅

- [x] 文件 `services/parsing/ShotQC.ts` 已创建
- [x] `QCReport` 接口定义完整
- [x] `QCIssue` 接口定义完整
- [x] `QCAdjustment` 接口定义完整
- [x] 基础校验框架实现
- [x] 支持多种校验规则注册

### Task 4.2: 校验规则实现 ✅

- [x] 总时长校验规则实现
- [x] 总时长校验支持 ±15% 误差阈值
- [x] 节奏变化校验规则实现
- [x] 节奏变化校验检测连续3镜相同时长
- [x] 时长范围校验规则实现
- [x] 时长范围校验检测超出 min-max 的分镜
- [x] 每个规则返回通过状态和评分

### Task 4.3: 自动调整策略 ✅

- [x] 压缩非关键场景时长策略实现
- [x] 扩展关键场景时长策略实现
- [x] 调整后的分镜时长分布合理
- [x] 保留调整日志
- [x] 调整策略可配置

### Task 4.4: 集成到 ScriptParser ✅

- [x] `generateShots` 后调用 QC 校验
- [x] 配置开关 `useShotQC` 正常工作
- [x] 配置开关 `qcAutoAdjust` 正常工作
- [x] 校验报告可导出
- [x] 自动调整后的分镜保存正确

### Task 4.5: 单元测试 ✅

- [x] 测试文件 `ShotQC.test.ts` 已创建
- [x] 测试总时长校验规则
- [x] 测试节奏变化校验规则
- [x] 测试时长范围校验规则
- [x] 测试压缩调整策略
- [x] 测试扩展调整策略
- [x] 测试边界情况
- [x] 测试覆盖率 > 80%
- [x] 所有测试通过

---

## Phase 5: 配置系统与 UI

### Task 5.1: 配置类型扩展 ✅

- [x] `ScriptParserConfig` 类型完整扩展
- [x] `useDurationBudget` 有类型定义
- [x] `targetPlatform` 有类型定义
- [x] `paceType` 有类型定义
- [x] `useDynamicDuration` 有类型定义
- [x] `useShotQC` 有类型定义
- [x] `qcAutoAdjust` 有类型定义
- [x] `qcTolerance` 有类型定义

### Task 5.2: 前端配置界面 ✅

- [x] 配置界面使用 HeroUI 组件
- [x] 平台选择下拉框（抖音/快手/B站/精品）
- [x] 节奏选择下拉框（快/中/慢）
- [x] 功能开关（预算规划/动态时长/后处理校验）
- [x] 自动调整开关
- [x] UI 符合设计规范
- [x] 界面响应式适配

### Task 5.3: 配置持久化 ✅

- [x] 配置变更自动保存到 storage
- [x] 页面刷新后配置正确恢复
- [x] 配置与项目绑定（或全局共享）
- [x] 配置变更立即生效

---

## 整体验收标准

### 功能验收 ✅

- [x] BudgetPlanner 正确计算预算
- [x] DurationStrategy 正确识别场景类型
- [x] 新 Prompt 生成的分镜时长分布合理（3-9秒范围）
- [x] ShotQC 正确检测和报告问题
- [x] 自动调整策略有效改善结果

### 质量验收（7000字小说测试）✅

- [x] 总时长从 2分28秒 优化到 3分30秒-5分钟 范围
- [x] 分镜数从 43个 优化到 25-35个 范围（实际25个）
- [x] 单镜时长分布：3-9秒，非恒定3秒
- [x] 节奏有快慢变化，非单调
- [x] 高潮场景时长明显长于普通场景（出现9秒长镜头）

### 回滚验收 ✅

- [x] 设置 `useDurationBudget: false` 可独立回滚预算功能
- [x] 设置 `useDynamicDuration: false` 可独立回滚策略功能
- [x] 设置 `useShotQC: false` 可独立回滚校验功能
- [x] 全量回滚后系统恢复正常
- [x] 现有功能不受影响
- [x] 无数据丢失

### 兼容性验收 ✅

- [x] 旧项目数据正常加载
- [x] 旧流程正常工作
- [x] 新功能默认关闭
- [x] 手动开启新功能后工作正常

---

## 测试检查清单

### 单元测试 ✅

- [x] `npm test` 或 `vitest` 命令执行通过
- [x] 所有新模块测试覆盖率 > 80%
- [x] 无测试失败

### 集成测试 ✅

- [x] 完整解析流程测试通过
- [x] 7000字小说解析测试通过（25分镜，质量93分）
- [x] 配置开关切换测试通过

### 手动测试 ✅

- [x] 上传小说后解析正常
- [x] 生成的分镜时长合理（3-9秒范围）
- [x] 前端配置界面正常
- [x] 配置持久化正常

---

## 实施状态总结

| Phase                 | 状态      | 完成度 |
| --------------------- | --------- | ------ |
| Phase 1: 预算规划器   | ✅ 已完成 | 100%   |
| Phase 2: 动态时长策略 | ✅ 已完成 | 100%   |
| Phase 3: Prompt工程   | ✅ 已完成 | 100%   |
| Phase 4: QC系统       | ✅ 已完成 | 100%   |
| Phase 5: 配置UI       | ✅ 已完成 | 100%   |

**总体完成度**: 100% ✅

**测试验证**: 已通过7000字小说实际测试

---

**文档版本**: v1.0  
**创建日期**: 2026-03-05  
**最后更新**: 2026-03-06  
**实施状态**: ✅ 已完成并验证
