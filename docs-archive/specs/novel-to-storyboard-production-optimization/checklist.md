# 小说转分镜脚本生产级优化 - 验收检查清单 (v3.0)

---

## 说明

本检查清单基于全站代码分析，确保：

1. 不破坏现有功能
2. 支持回滚
3. 验证质量提升

---

## Phase 1: 核心模块集成

### Task 1: 集成SemanticChunker

**实施前检查**:

- [ ] 确认 `services/parsing/SemanticChunker.ts` 文件存在
- [ ] 确认 `services/scriptParser.ts` 可修改
- [ ] 确认现有chunkText方法正常工作

**实施后检查**:

- [ ] SemanticChunker已在scriptParser.ts中导入
- [ ] useSemanticChunking配置项已添加
- [ ] chunkText方法优先使用SemanticChunker
- [ ] 原有逻辑已保留为legacyChunkText
- [ ] 集成测试已编写
- [ ] 语义分块正常工作
- [ ] 可通过配置切换回原有分块
- [ ] 现有功能不受影响

**回滚验证**:

- [ ] 设置 `useSemanticChunking: false`
- [ ] 验证使用原有固定字符分块
- [ ] 验证解析结果正确
- [ ] 验证无控制台错误

---

### Task 2: 集成ShortDramaRules

**实施前检查**:

- [ ] 确认 `services/parsing/ShortDramaRules.ts` 文件存在
- [ ] 确认ShortDramaRules.analyzeQuality方法可用
- [ ] 确认现有generateShots方法正常工作

**实施后检查**:

- [ ] ShortDramaRules已在scriptParser.ts中导入
- [ ] useDramaRules配置项已添加
- [ ] dramaRulesMinScore配置项已添加
- [ ] generateShots方法包含验证逻辑
- [ ] 质量报告已添加到ScriptParseState
- [ ] QualityReport类型已定义
- [ ] 集成测试已编写
- [ ] 分镜生成后自动验证
- [ ] 验证结果可查询
- [ ] 黄金3秒规则等核心规则生效

**回滚验证**:

- [ ] 设置 `useDramaRules: false`
- [ ] 验证跳过质量验证
- [ ] 验证分镜正常生成
- [ ] 验证无控制台错误

---

## Phase 2: 性能优化

### Task 3: 集成MultiLevelCache

**实施前检查**:

- [ ] 确认 `services/parsing/MultiLevelCache.ts` 文件存在
- [ ] 确认MultiLevelCache.get/set方法可用
- [ ] 确认现有LLM调用正常工作

**实施后检查**:

- [ ] MultiLevelCache已在scriptParser.ts中导入
- [ ] useCache配置项已添加
- [ ] cacheTTL配置项已添加
- [ ] LLM调用前检查缓存
- [ ] LLM调用后写入缓存
- [ ] 缓存命中率统计已添加
- [ ] 集成测试已编写
- [ ] 缓存命中正常工作
- [ ] 解析性能提升
- [ ] 可通过配置禁用

**回滚验证**:

- [ ] 设置 `useCache: false`
- [ ] 验证每次都调用LLM
- [ ] 验证解析结果正确
- [ ] 验证无控制台错误

---

### Task 4: 添加配置系统

**实施前检查**:

- [ ] 确认settings存储机制可用
- [ ] 确认types.ts可修改

**实施后检查**:

- [ ] ScriptParserConfig接口已定义
- [ ] DEFAULT_CONFIG默认配置已创建
- [ ] 支持从settings读取配置
- [ ] 支持配置热更新
- [ ] 单元测试已编写
- [ ] 配置可读取和保存
- [ ] 默认值正确
- [ ] 配置变更立即生效

---

## Phase 3: 可选增强

### Task 5: 集成ParseStateManager

**实施前检查**:

- [ ] 确认 `services/parsing/ParseStateManager.ts` 文件存在
- [ ] 确认ParseStateManager方法可用

**实施后检查**:

- [ ] ParseStateManager已在scriptParser.ts中导入
- [ ] useAdvancedStateManagement配置项已添加
- [ ] 简单parseState管理已替换
- [ ] 支持子任务级状态追踪
- [ ] 集成测试已编写
- [ ] 断点续传更精确
- [ ] 可追踪子任务状态
- [ ] 可通过配置禁用

**回滚验证**:

- [ ] 设置 `useAdvancedStateManagement: false`
- [ ] 验证使用简单状态管理
- [ ] 验证解析结果正确

---

### Task 6: 集成HumanInTheLoop

**实施前检查**:

- [ ] 确认 `services/parsing/HumanInTheLoop.ts` 文件存在
- [ ] 确认HumanInTheLoop方法可用

**实施后检查**:

- [ ] HumanInTheLoop已在scriptParser.ts中导入
- [ ] useHumanInTheLoop配置项已添加
- [ ] 元数据提取后添加确认门
- [ ] 角色提取后添加确认门
- [ ] 场景提取后添加确认门
- [ ] 前端确认UI已添加（可选）
- [ ] 集成测试已编写
- [ ] 确认流程正常工作
- [ ] 可通过配置禁用
- [ ] 不影响现有流程

**回滚验证**:

- [ ] 设置 `useHumanInTheLoop: false`
- [ ] 验证跳过确认流程
- [ ] 验证解析结果正确

---

## 现有功能保护检查

### 已实现功能（不应被破坏）

**JSON修复**:

- [ ] JSONRepair.repairAndParse正常工作
- [ ] 多级修复策略正常

**资产关联**:

- [ ] Keyframe.references.character.id正常
- [ ] Keyframe.references.scene.id正常
- [ ] 关键帧拆分时资产关联正常

**映射功能**:

- [ ] CharacterMapping.mappedAssetId正常
- [ ] SceneMapping.mappedAssetId正常
- [ ] 前端映射组件正常显示

**核心解析流程**:

- [ ] 元数据提取正常
- [ ] 角色分析正常
- [ ] 场景分析正常
- [ ] 分镜生成正常
- [ ] 关键帧拆分正常
- [ ] 图像生成正常

---

## 全量回滚验证

### 回滚到优化前状态

- [ ] 所有配置开关设置为false
- [ ] useSemanticChunking: false
- [ ] useDramaRules: false
- [ ] useCache: false
- [ ] useAdvancedStateManagement: false
- [ ] useHumanInTheLoop: false

### 验证回滚后功能

- [ ] 小说上传正常
- [ ] 解析流程正常
- [ ] 分镜生成正常
- [ ] 关键帧拆分正常
- [ ] 图像生成正常
- [ ] 无控制台错误
- [ ] 无TypeScript编译错误

---

## 最终验收标准

### 功能验收

- [ ] SemanticChunker成功集成，可通过配置开关
- [ ] ShortDramaRules成功集成，生成质量报告
- [ ] MultiLevelCache成功集成，缓存命中率可统计
- [ ] 配置系统正常工作

### 质量验收

- [ ] 分镜质量评分可量化
- [ ] 解析性能提升可测量
- [ ] 现有功能不受影响
- [ ] 所有单元测试通过

### 回滚验收

- [ ] 每个功能可独立回滚
- [ ] 全量回滚后恢复正常
- [ ] 无数据丢失
- [ ] 无配置残留

---

**文档版本**: v3.0  
**创建日期**: 2026-02-27  
**最后更新**: 2026-02-27  
**特点**: 基于全站代码分析，确保不破坏现有功能
