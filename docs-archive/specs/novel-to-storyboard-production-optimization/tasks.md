# 小说转分镜脚本生产级优化 - 任务清单 (v3.0)

---

## 实施策略

**总体原则**:

1. 优先集成已有模块，避免重复开发
2. 所有改动通过配置开关控制，支持回滚
3. 不破坏现有功能

**关键发现**:

- 6个高级模块已编写但未集成
- Keyframe资产引用已实现，无需修改
- 核心解析流程已正常工作

---

## Phase 1: 核心模块集成 (P0)

### Task 1: 集成SemanticChunker

**描述**: 将已实现的SemanticChunker模块集成到scriptParser.ts
**预估工时**: 1小时
**风险**: 低
**回滚方式**: 设置 `useSemanticChunking: false`
**状态**: ✅ 已完成

**实施步骤**:

- [x] 1.1 在scriptParser.ts中导入SemanticChunker
- [x] 1.2 添加useSemanticChunking配置项（默认true）
- [x] 1.3 修改chunkText方法，优先使用SemanticChunker
- [x] 1.4 保留原有chunkText逻辑作为fallback（重命名为legacyChunkText）
- [x] 1.5 编写集成测试
- [x] 1.6 验证回滚功能

**修改文件**:

- 修改: `services/scriptParser.ts`

**验收标准**:

- 语义分块正常工作
- 可通过配置切换回原有分块
- 现有功能不受影响

---

### Task 2: 集成ShortDramaRules

**描述**: 将已实现的ShortDramaRules模块集成到分镜生成后进行验证
**预估工时**: 1小时
**风险**: 低
**回滚方式**: 设置 `useDramaRules: false`
**状态**: ✅ 已完成

**实施步骤**:

- [x] 2.1 在scriptParser.ts中导入ShortDramaRules
- [x] 2.2 添加useDramaRules配置项
- [x] 2.3 添加dramaRulesMinScore配置项（默认60）
- [x] 2.4 在generateShots方法中添加验证逻辑
- [x] 2.5 将质量报告添加到ScriptParseState
- [x] 2.6 编写集成测试
- [x] 2.7 验证回滚功能

**修改文件**:

- 修改: `services/scriptParser.ts`
- 修改: `types.ts` (添加QualityReport类型)

**验收标准**:

- 分镜生成后自动验证
- 验证结果可查询
- 黄金3秒规则等核心规则生效

---

## Phase 2: 性能优化 (P1)

### Task 3: 集成MultiLevelCache

**描述**: 将已实现的MultiLevelCache模块集成到LLM调用
**预估工时**: 1小时
**风险**: 低
**回滚方式**: 设置 `useCache: false`
**状态**: ⚠️ 跳过（依赖storageService.getCache/setCache方法不存在）

**说明**: MultiLevelCache模块依赖storageService.getCache/setCache方法，但当前storageService未实现这些方法。需要先在storageService中添加缓存相关方法才能集成。

**实施步骤**:

- [ ] 3.1 在scriptParser.ts中导入MultiLevelCache
- [ ] 3.2 添加useCache配置项
- [ ] 3.3 添加cacheTTL配置项
- [ ] 3.4 在LLM调用前检查缓存
- [ ] 3.5 在LLM调用后写入缓存
- [ ] 3.6 添加缓存命中率统计
- [ ] 3.7 编写集成测试
- [ ] 3.8 验证回滚功能

**修改文件**:

- 修改: `services/scriptParser.ts`

**验收标准**:

- 缓存命中正常工作
- 解析性能提升
- 可通过配置禁用

---

### Task 4: 添加配置系统

**描述**: 创建统一的配置管理，支持持久化
**预估工时**: 0.5小时
**风险**: 低
**回滚方式**: 删除配置即可恢复默认值
**状态**: ✅ 已完成

**实施步骤**:

- [x] 4.1 定义ScriptParserConfig接口
- [x] 4.2 创建DEFAULT_CONFIG默认配置
- [x] 4.3 支持从settings读取配置
- [x] 4.4 支持配置热更新
- [x] 4.5 编写单元测试

**修改文件**:

- 修改: `services/scriptParser.ts`
- 修改: `types.ts` (添加配置类型)

**验收标准**:

- 配置可读取和保存
- 默认值正确
- 配置变更立即生效

---

## Phase 3: 可选增强 (P2)

### Task 5: 集成ParseStateManager

**描述**: 将已实现的ParseStateManager模块集成，支持细粒度断点续传
**预估工时**: 1.5小时
**风险**: 中
**回滚方式**: 设置 `useAdvancedStateManagement: false`

**实施步骤**:

- [ ] 5.1 在scriptParser.ts中导入ParseStateManager
- [ ] 5.2 添加useAdvancedStateManagement配置项
- [ ] 5.3 替换简单的parseState管理
- [ ] 5.4 支持子任务级状态追踪
- [ ] 5.5 编写集成测试
- [ ] 5.6 验证回滚功能

**修改文件**:

- 修改: `services/scriptParser.ts`

**验收标准**:

- 断点续传更精确
- 可追踪子任务状态
- 可通过配置禁用

---

### Task 6: 集成HumanInTheLoop

**描述**: 将已实现的HumanInTheLoop模块集成到关键节点
**预估工时**: 1.5小时
**风险**: 中
**回滚方式**: 设置 `useHumanInTheLoop: false`

**实施步骤**:

- [ ] 6.1 在scriptParser.ts中导入HumanInTheLoop
- [ ] 6.2 添加useHumanInTheLoop配置项
- [ ] 6.3 在元数据提取后添加确认门
- [ ] 6.4 在角色提取后添加确认门
- [ ] 6.5 在场景提取后添加确认门
- [ ] 6.6 前端添加确认UI（可选）
- [ ] 6.7 编写集成测试
- [ ] 6.8 验证回滚功能

**修改文件**:

- 修改: `services/scriptParser.ts`

**验收标准**:

- 确认流程正常工作
- 可通过配置禁用
- 不影响现有流程

---

## Task Dependencies

```
Phase 1 (核心模块集成):
Task 1 (SemanticChunker) ─┐
Task 2 (ShortDramaRules) ─┼─→ 可并行执行

Phase 2 (性能优化):
Task 3 (MultiLevelCache) ─┐
Task 4 (配置系统) ────────┴─→ 可并行执行

Phase 3 (可选增强):
Task 5 (ParseStateManager) ─── 可选
Task 6 (HumanInTheLoop) ───── 可选
```

---

## 回滚验证清单

### Task 1 回滚验证

- [ ] 设置 `useSemanticChunking: false`
- [ ] 验证使用原有固定字符分块
- [ ] 验证解析结果正确

### Task 2 回滚验证

- [ ] 设置 `useDramaRules: false`
- [ ] 验证跳过质量验证
- [ ] 验证分镜正常生成

### Task 3 回滚验证

- [ ] 设置 `useCache: false`
- [ ] 验证每次都调用LLM
- [ ] 验证解析结果正确

### 全量回滚验证

- [ ] 所有开关设置为false
- [ ] 验证恢复到优化前状态
- [ ] 验证现有功能正常

---

## 验收检查清单

### Phase 1 完成后

- [ ] SemanticChunker成功集成
- [ ] ShortDramaRules成功集成
- [ ] 配置开关正常工作
- [ ] 回滚功能正常

### Phase 2 完成后

- [ ] MultiLevelCache成功集成
- [ ] 配置系统正常工作
- [ ] 性能提升可测量

### 全部完成后

- [ ] 分镜质量评分可量化
- [ ] 解析性能提升
- [ ] 所有单元测试通过
- [ ] 现有功能不受影响

---

**文档版本**: v3.0  
**创建日期**: 2026-02-27  
**最后更新**: 2026-02-27  
**特点**: 基于全站代码分析，支持回滚
