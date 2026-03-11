# 质量评分前端无数据显示问题 - 深度排查计划

## 问题描述

质量评分在剧本解析后，前端质量评估Tab总是显示"暂无质量评估数据"，没有显示实际的评分数据。

## 已发现的关键线索

### 1. 类型不匹配问题 ⚠️

**ScriptManager导入的QualityReport** (line 13):

```typescript
import { QualityReport } from '../services/scriptParser';
```

**services/scriptParser导出的QualityReport**:

- 实际是从`./parsing/QualityAnalyzer`导入的`DetailedQualityReport`

**types.ts中定义的QualityReport**:

```typescript
export interface QualityReport {
  score: number;
  violations: RuleViolation[];
  suggestions: string[];
}
```

**问题**: `DetailedQualityReport` ≠ `QualityReport`，存在类型不匹配！

### 2. 数据流分析

**数据产生** (`scriptParser.ts`):

1. `parseScript()`方法在completed阶段生成质量报告 (line 2350-2372)
2. 质量报告保存到`state.qualityReport` (line 2370)
3. 返回的`parseState`包含`qualityReport`

**数据消费** (`ScriptManager.tsx`):

1. `handleParseScript()`获取报告 (line 499-503)
2. `setQualityReport(report)`设置状态
3. useEffect监听`currentScript`变化恢复报告 (line 120-127)

### 3. 可能的问题点

| 问题点                              | 可能性 | 说明                                   |
| ----------------------------------- | ------ | -------------------------------------- |
| 类型不匹配导致数据丢失              | 高     | DetailedQualityReport vs QualityReport |
| qualityReport未正确保存到parseState | 中     | 需要验证保存逻辑                       |
| 前端状态更新问题                    | 中     | useEffect依赖或时机问题                |
| 数据存储/读取问题                   | 低     | storageService保存/读取                |

---

## 排查步骤

### Phase 1: 验证类型定义一致性（15分钟）

**目标**: 确认类型定义是否匹配

**步骤**:

1. 检查`types.ts`中的`QualityReport`定义
2. 检查`services/parsing/QualityAnalyzer.ts`中的`DetailedQualityReport`定义
3. 检查`services/scriptParser.ts`中导出的类型
4. 检查`ScriptManager.tsx`中导入的类型

**验证方法**:

```typescript
// 检查类型兼容性
const test: QualityReport = {} as DetailedQualityReport; // 是否报错？
```

**预期结果**:

- 如果类型不兼容，需要统一类型定义
- 如果类型兼容，继续Phase 2

---

### Phase 2: 添加详细日志追踪（20分钟）

**目标**: 追踪数据从生成到显示的完整流程

**步骤**:

1. 在`scriptParser.ts`的`parseScript()`方法中添加日志:
   - 质量报告生成时 (line 2360)
   - 保存到state时 (line 2370)
   - 返回state前 (line 2379)

2. 在`ScriptManager.tsx`中添加日志:
   - `handleParseScript()`中获取报告时 (line 499)
   - useEffect恢复报告时 (line 121)
   - 渲染质量评估Tab时 (line 1128)

**日志内容**:

```typescript
console.log('[ScriptParser] Quality report generated:', {
  score: finalReport.score,
  hasViolations: finalReport.violations.length > 0,
  hasSuggestions: finalReport.suggestions.length > 0,
  type: typeof finalReport,
});

console.log('[ScriptManager] Quality report received:', {
  score: report?.score,
  isNull: report === null,
  type: typeof report,
});
```

**预期结果**:

- 确定数据在哪个环节丢失

---

### Phase 3: 验证数据存储/读取（15分钟）

**目标**: 确认数据是否正确保存到storage

**步骤**:

1. 在`storage.ts`中添加日志，追踪script的保存和读取
2. 检查保存的script对象中是否包含qualityReport
3. 检查读取的script对象中qualityReport是否存在

**验证方法**:

```typescript
// 在storageService.saveScript和getScript中添加日志
console.log('[Storage] Saving script with qualityReport:', script.parseState?.qualityReport);
console.log('[Storage] Loaded script with qualityReport:', script.parseState?.qualityReport);
```

**预期结果**:

- 确定数据是否在存储层丢失

---

### Phase 4: 检查前端渲染逻辑（15分钟）

**目标**: 确认前端渲染逻辑是否正确

**步骤**:

1. 检查`ScriptManager.tsx`中qualityReport状态的初始化
2. 检查useEffect的依赖项是否正确
3. 检查条件渲染逻辑 (line 1128)

**关键检查点**:

```typescript
// 检查状态初始化
const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);

// 检查useEffect依赖
useEffect(() => {
  if (currentScript?.parseState?.qualityReport) {
    setQualityReport(currentScript.parseState.qualityReport);
  }
}, [currentScript]); // 依赖是否正确？

// 检查渲染条件
{qualityReport ? ( /* 显示报告 */ ) : ( /* 显示空状态 */ )}
```

**预期结果**:

- 确定前端渲染逻辑是否有问题

---

### Phase 5: 修复问题（30分钟）

根据Phase 1-4的发现，修复具体问题:

**可能的修复方案**:

#### 方案A: 统一类型定义

如果类型不匹配，统一使用`QualityReport`或`DetailedQualityReport`:

```typescript
// 在types.ts中更新QualityReport定义
export interface QualityReport {
  score: number;
  violations: RuleViolation[];
  suggestions: string[];
  // 添加可选字段以兼容DetailedQualityReport
  dimensionScores?: DimensionScore[];
  overallGrade?: string;
  confidence?: number;
  statistics?: QualityStatistics;
  recommendations?: string[];
  stage?: string;
}
```

#### 方案B: 修复数据保存逻辑

如果数据未正确保存，修复保存逻辑:

```typescript
// 确保qualityReport正确保存到state
if (this.qualityReport) {
  state.qualityReport = this.qualityReport;
  console.log('[ScriptParser] Quality report saved:', state.qualityReport);
}
```

#### 方案C: 修复前端状态管理

如果前端状态管理有问题，修复useEffect逻辑:

```typescript
useEffect(() => {
  console.log('[ScriptManager] currentScript changed:', currentScript?.parseState);
  if (currentScript?.parseState?.qualityReport) {
    setQualityReport(currentScript.parseState.qualityReport);
    console.log('[ScriptManager] Quality report restored');
  } else {
    setQualityReport(null);
    console.log('[ScriptManager] No quality report found');
  }
}, [currentScript]);
```

---

## 验证方案

### 测试步骤

1. 重新上传剧本
2. 执行完整解析
3. 检查控制台日志
4. 查看质量评估Tab是否显示数据

### 预期结果

- 质量评估Tab显示实际评分数据
- 显示分数、违规项、建议等信息

---

## 时间估算

| Phase             | 预计时间    | 优先级 |
| ----------------- | ----------- | ------ |
| Phase 1: 类型验证 | 15分钟      | 高     |
| Phase 2: 日志追踪 | 20分钟      | 高     |
| Phase 3: 存储验证 | 15分钟      | 中     |
| Phase 4: 渲染检查 | 15分钟      | 中     |
| Phase 5: 修复实施 | 30分钟      | 高     |
| **总计**          | **约2小时** | -      |

---

## 风险与回滚

**风险**:

- 类型修改可能影响其他组件
- 数据格式变更可能导致旧数据不兼容

**回滚方案**:

- 保留原始类型定义备份
- 添加类型兼容性转换逻辑

---

**计划制定时间**: 2026-03-04
**计划版本**: v1.0
**制定依据**: 基于代码深度分析和类型检查
