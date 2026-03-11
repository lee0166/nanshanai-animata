# 小说解析流程优化 v2.0 - 分阶段实施计划

---

## 实施策略

**总体原则**: 分阶段实施，每阶段1-2小时，可独立测试验证，风险可控。

**用户交互方式**:

- 每个模块完成后，我会报告：
  1. 修改了哪些文件
  2. 新增/修改了多少行代码
  3. 是否改变现有接口
  4. 如何测试
  5. 如何回退
- 您回复 **"继续下一个"** 或 **"先测试这个"**

---

## Phase 1: 基础架构（1-2小时，立即可做）

### Module 1: JSON修复模块 (0.5小时)

**描述**: 实现AI返回JSON的自动修复，提升解析成功率
**优先级**: P0
**风险**: 极低
**依赖**: 无

**实施步骤**:

1. 新建 `services/JSONRepair.ts`
2. 实现常见JSON错误检测与修复
3. 集成到 `scriptParser.ts` 的解析流程中

**修改文件**:

- 新增: `services/JSONRepair.ts` (~100行)
- 修改: `services/scriptParser.ts` (~10行，集成调用)

**向后兼容**: 是，纯新增模块

**回退方案**: 直接删除JSONRepair调用，恢复原有解析逻辑

**测试方法**:

```bash
npm test -- JSONRepair
```

---

### Module 2: 语义分块模块 (0.5小时)

**描述**: 增强现有分块逻辑，支持语义边界识别
**优先级**: P0
**风险**: 低
**依赖**: Module 1 (可选)

**实施步骤**:

1. 在 `services/scriptParser.ts` 中新增 `semanticChunk` 方法
2. 实现章节/段落/句子边界识别
3. 添加分块元数据提取(角色、场景提示、重要性)
4. 修改现有 `chunkText` 方法，优先使用语义分块

**修改文件**:

- 修改: `services/scriptParser.ts` (~150行新增)
- 修改: `types.ts` (~30行新增类型定义)

**向后兼容**: 是，保留原有 `chunkText` 作为fallback

**回退方案**: 切换回原有 `chunkText` 方法

**测试方法**:

```bash
npm test -- semanticChunk
# 或使用示例小说测试分块效果
```

---

### Module 3: 模型路由 (0.5小时)

**描述**: 按任务类型自动选择最优模型，降低成本
**优先级**: P0
**风险**: 低
**依赖**: 无

**实施步骤**:

1. 新建 `services/ModelRouter.ts`
2. 定义任务类型到模型的映射策略
3. 实现降级策略(主模型失败时切换备用)
4. 修改 `scriptParser.ts`，使用ModelRouter替代直接调用

**修改文件**:

- 新增: `services/ModelRouter.ts` (~200行)
- 修改: `services/scriptParser.ts` (~30行，替换调用方式)

**向后兼容**: 是，CONFIG.defaultModel 作为fallback

**回退方案**: 使用CONFIG.defaultModel直接调用

**测试方法**:

```bash
npm test -- ModelRouter
```

**预期效果**: 实体提取任务成本降低 40%+

---

### Module 4: 子任务级状态管理 (0.5小时)

**描述**: 实现细粒度状态追踪，支持精准断点续传
**优先级**: P0
**风险**: 低
**依赖**: 无

**实施步骤**:

1. 扩展 `types.ts` 中的 `ScriptParseState` 接口
2. 新增 `SubTaskState` 类型定义
3. 修改 `scriptParser.ts`，实现子任务级状态管理
4. 新增 `resume` 方法支持断点续传

**修改文件**:

- 修改: `types.ts` (~50行新增)
- 修改: `services/scriptParser.ts` (~200行新增)

**向后兼容**: 是，subTasks字段为可选

**回退方案**: 忽略subTasks字段，使用原有阶段级逻辑

**测试方法**:

```bash
npm test -- ResumableParser
# 测试断点续传功能
```

---

## Phase 2: 效率优化（1-2小时，可选）

### Module 5: 多级缓存系统 (1小时)

**描述**: 使用IndexedDB实现三级缓存，降低重复解析成本
**优先级**: P1
**风险**: 低
**依赖**: 无

**实施步骤**:

1. 新建 `services/MultiLevelCache.ts`
2. 实现L1全文级缓存(内存)
3. 实现L2实体级缓存(IndexedDB)
4. 实现L3资产映射缓存(IndexedDB)
5. 集成到 `scriptParser.ts`

**修改文件**:

- 新增: `services/MultiLevelCache.ts` (~250行)
- 修改: `services/scriptParser.ts` (~50行，集成调用)

**向后兼容**: 是，缓存miss时走正常流程

**回退方案**: 禁用缓存功能

**测试方法**:

```bash
npm test -- MultiLevelCache
```

**预期效果**: 缓存命中率 > 60%，重复解析成本为零

---

### Module 6: RAG检索系统 (1小时)

**描述**: 集成ChromaDB，实现基于语义的分块检索
**优先级**: P1
**风险**: 中
**依赖**: Module 2 (语义分块)

**前置条件**:

- 确认可以安装 `chromadb` 依赖
- 确认可以接受增加的打包体积

**实施步骤**:

1. 安装依赖: `npm install chromadb`
2. 新建 `services/RAGRetriever.ts`
3. 实现Embedding生成与存储
4. 实现角色/场景相关片段检索
5. 集成到 `scriptParser.ts`

**修改文件**:

- 新增: `services/RAGRetriever.ts` (~300行)
- 修改: `package.json` (新增依赖)
- 修改: `services/scriptParser.ts` (~100行，集成调用)

**向后兼容**: 否，需要新增依赖

**回退方案**: 通过配置关闭RAG，使用全文解析

**测试方法**:

```bash
npm test -- RAGRetriever
```

**预期效果**: 解析质量提升，Token消耗降低 30%+

---

## Phase 3: 业务优化（需确认需求）

### 待确认问题

在实施Phase 3之前，请确认以下问题：

1. **短剧规则引擎**
   - 当前系统是否专门用于短剧制作？
   - 是否需要强制黄金3秒规则？
   - 是否需要单集时长限制(60-180秒)？

2. **人工确认流程**
   - 是否需要导演确认角色/场景设定？
   - 确认流程的UI设计需求？
   - 确认后锁定机制的具体要求？

3. **资产相似度匹配**
   - 是否需要自动推荐相似资产？
   - 相似度阈值设置要求？

### Module 7: 短剧规则引擎 (待定)

**描述**: 实现短剧分镜规则验证与自动修复
**优先级**: P2
**风险**: 高(需确认需求)
**依赖**: 确认业务需求

**实施步骤**:

1. 新建 `services/ShortDramaRulesEngine.ts`
2. 实现黄金3秒规则验证
3. 实现单集结构验证
4. 实现自动修复功能

---

### Module 8: 人工确认UI (待定)

**描述**: 实现导演确认角色/场景设定的界面
**优先级**: P2
**风险**: 高(需设计)
**依赖**: 确认UI设计

**实施步骤**:

1. 新建 `components/ScriptParser/StoryBibleConfirmation.tsx`
2. 实现角色确认界面
3. 实现场景确认界面
4. 实现锁定机制

---

## 实施检查点

### Phase 1 完成后检查

请确认以下问题：

```
1. 这个阶段修改了哪些文件？
   - services/JSONRepair.ts (新增)
   - services/ModelRouter.ts (新增)
   - services/scriptParser.ts (修改)
   - types.ts (修改)

2. 新增了多少行代码？
   - 约 800-1000 行

3. 有没有改变现有的接口？
   - 没有破坏性变更，都是向后兼容的扩展

4. 如何测试这个功能？
   - 运行: npm test
   - 使用示例小说测试解析流程

5. 如果出问题怎么回退？
   - JSON修复: 删除调用
   - 语义分块: 切换回chunkText
   - 模型路由: 使用CONFIG.defaultModel
   - 状态管理: 忽略subTasks字段
```

### Phase 2 前置确认

```
是否可以安装 chromadb 依赖？(y/n)
是否可以接受增加的打包体积？(y/n)
是否需要RAG检索功能？(y/n)
```

---

## 验收检查清单

### Phase 1 验收

- [ ] JSON修复成功率 > 95%
- [ ] 语义分块章节识别准确率 > 90%
- [ ] 模型路由正确选择模型
- [ ] 子任务级状态管理正常工作
- [ ] 断点续传功能正常
- [ ] 所有单元测试通过

### Phase 2 验收

- [ ] 缓存命中率 > 60%
- [ ] RAG检索响应时间 < 500ms
- [ ] 解析成本降低 40%+

### Phase 3 验收

- [ ] 短剧规则引擎符合业务需求
- [ ] 人工确认UI流程顺畅
- [ ] 资产推荐准确率 > 70%

---

**文档版本**: v2.0  
**最后更新**: 2026-02-21
