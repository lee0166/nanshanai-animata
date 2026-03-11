# AI影视资产生成平台 - 实际可落地方案

> 基于项目深度分析，从轻度优化到复杂功能，分阶段实施的技术路线图

---

## 项目现状总结

### 核心架构

- **技术栈**: React 19 + TypeScript 5 + Vite 6 + HeroUI + TailwindCSS 4
- **AI集成**: Volcengine、Vidu、ModelScope、LLM 4个Provider
- **存储**: IndexedDB + OPFS 双存储，完全本地化
- **任务队列**: 支持并发控制、持久化、崩溃恢复

### 当前痛点（基于代码分析）

| 痛点             | 现状                     | 影响                 |
| ---------------- | ------------------------ | -------------------- |
| **角色一致性**   | 依赖手动选择参考图       | 多图生成时角色差异大 |
| **生成进度**     | 仅显示"生成中"，无进度   | 用户焦虑，体验差     |
| **错误处理**     | 部分错误信息技术化       | 用户难以理解         |
| **参考图管理**   | 无统一图库，重复使用繁琐 | 效率低               |
| **视频生成流程** | 参数同步需手动操作       | 流程繁琐             |
| **剧本解析**     | 对非标准格式支持有限     | 解析失败率高         |

---

## 第一阶段：轻度优化（1-2周）

### 任务1：文本清洗增强（3天）

**问题**: 小说上传后无清洗，格式混乱影响解析

**现状代码**（ScriptManager.tsx:219-232）:

```typescript
const text = await file.text(); // 直接读取，无清洗
setScriptContent(text);
```

**优化方案**:

```typescript
// services/textCleaner.ts
export class TextCleaner {
  static clean(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // 统一换行符
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n') // 合并多余空行
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // 去除控制字符
      .replace(/^\s+|\s+$/g, '') // 去除首尾空白
      .replace(/^(第[一二三四五六七八九十百千万\d]+章[\s\S]*?)(?=\n第|$)/gm, '$1') // 保护章节标题
      .trim();
  }

  // 识别章节结构
  static extractChapters(text: string): Chapter[] {
    const chapterPattern = /^(第[一二三四五六七八九十百千万\d]+章[\s\S]*?)(?=\n第|$)/gm;
    const chapters = [];
    let match;
    while ((match = chapterPattern.exec(text)) !== null) {
      chapters.push({
        title: match[1].split('\n')[0].trim(),
        content: match[1].trim(),
      });
    }
    return chapters;
  }
}
```

**修改点**:

- ScriptManager.tsx: 上传时调用 TextCleaner.clean()
- 新增 services/textCleaner.ts
- 新增章节结构识别，便于后续分段解析

---

### 任务2：生成进度可视化（3天）

**问题**: 任务队列仅显示状态，无进度百分比

**现状**（JobMonitor.tsx）:

- 显示：PENDING / PROCESSING / COMPLETED / FAILED
- 无进度条、无ETA

**优化方案**:

#### 2.1 任务进度追踪

```typescript
// types.ts 扩展 Job 接口
interface Job {
  // ... 现有字段
  progress?: {
    percent: number; // 0-100
    stage: string; // 当前阶段描述
    eta?: number; // 预计剩余时间（秒）
    details?: string; // 详细状态
  };
}
```

#### 2.2 Provider进度回调

```typescript
// services/ai/providers/BaseProvider.ts
abstract class BaseProvider {
  abstract generateImage(
    prompt: string,
    config: ModelConfig,
    onProgress?: (progress: ProgressInfo) => void  // 新增进度回调
  ): Promise<AIResult>;
}

// VolcengineProvider 实现示例
async generateImage(prompt, config, onProgress) {
  // 1. 提交任务
  const taskId = await this.submitTask(prompt, config);

  // 2. 轮询进度
  while (true) {
    const status = await this.queryTask(taskId);
    onProgress?.({
      percent: status.progress,
      stage: status.stage,
      eta: status.eta
    });

    if (status.state === 'SUCCESS') break;
    await delay(1000);
  }
}
```

#### 2.3 UI进度展示

```typescript
// JobMonitor.tsx 增强
<Card>
  <Progress value={job.progress?.percent} size="sm" color="primary" />
  <div className="flex justify-between text-xs text-slate-400 mt-1">
    <span>{job.progress?.stage}</span>
    <span>{job.progress?.eta && `约${formatTime(job.progress.eta)}`}</span>
  </div>
</Card>
```

**修改点**:

- types.ts: 扩展 Job 接口
- BaseProvider.ts: 添加进度回调参数
- 各Provider实现: 添加进度上报
- JobMonitor.tsx: 添加进度条UI
- queue.ts: 进度更新逻辑

---

### 任务3：友好的错误提示（2天）

**问题**: 错误信息技术化，用户难以理解

**现状**: 直接显示API返回的错误或异常堆栈

**优化方案**:

#### 3.1 错误分类与映射

```typescript
// services/errorHandler.ts
export class ErrorHandler {
  private static errorMap: Record<string, UserFriendlyError> = {
    'Rate limit exceeded': {
      title: '请求过于频繁',
      message: 'API调用频率超限，请稍后再试',
      action: '等待30秒后重试',
      severity: 'warning',
    },
    'Invalid API key': {
      title: 'API密钥错误',
      message: '请检查模型配置中的API密钥是否正确',
      action: '前往设置页面检查',
      severity: 'error',
      actionLink: '/settings',
    },
    'Content policy violation': {
      title: '内容不合规',
      message: '生成内容违反平台政策，请修改提示词',
      action: '修改提示词后重试',
      severity: 'warning',
    },
    timeout: {
      title: '生成超时',
      message: '生成任务耗时过长，已自动取消',
      action: '尝试简化提示词或减少批量数量',
      severity: 'warning',
    },
    network_error: {
      title: '网络连接失败',
      message: '无法连接到AI服务，请检查网络',
      action: '检查网络连接后重试',
      severity: 'error',
    },
  };

  static handle(error: Error): UserFriendlyError {
    // 1. 匹配已知错误
    for (const [pattern, mapped] of Object.entries(this.errorMap)) {
      if (error.message.includes(pattern)) {
        return mapped;
      }
    }

    // 2. 未知错误，返回通用提示
    return {
      title: '生成失败',
      message: '遇到未知错误，请稍后重试',
      action: '如果问题持续，请联系支持',
      severity: 'error',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  }
}
```

#### 3.2 Toast消息增强

```typescript
// 使用 HeroUI 的 Toast 组件显示友好错误
toast({
  title: error.title,
  description: error.message,
  action: error.actionLink ? (
    <Button size="sm" onClick={() => navigate(error.actionLink)}>
      {error.action}
    </Button>
  ) : undefined,
  variant: error.severity === 'error' ? 'destructive' : 'default'
});
```

**修改点**:

- 新增 services/errorHandler.ts
- aiService.ts: 捕获错误并转换
- 各组件: 使用友好错误显示

---

## 第二阶段：中度优化（3-4周）

### 任务4：智能参考图推荐（1周）

**问题**: 角色生成时手动选择参考图繁琐，且难以保持一致性

**现状**: 用户需手动从历史图中选择参考图

**优化方案**:

#### 4.1 参考图相似度分析

```typescript
// services/referenceImageRecommender.ts
export class ReferenceImageRecommender {
  // 使用 CLIP 或简单特征提取
  async findSimilarImages(
    targetPrompt: string,
    candidateImages: GeneratedImage[],
    topK: number = 3
  ): Promise<ScoredImage[]> {
    // 1. 提取目标prompt特征
    const targetFeatures = await this.extractFeatures(targetPrompt);

    // 2. 计算与候选图的相似度
    const scored = await Promise.all(
      candidateImages.map(async img => {
        const imgFeatures = await this.extractFeaturesFromPath(img.path);
        const similarity = this.cosineSimilarity(targetFeatures, imgFeatures);
        return { image: img, score: similarity };
      })
    );

    // 3. 返回TopK
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  // 简化的特征提取（基于prompt文本）
  private extractFeatures(prompt: string): Vector {
    // 使用简单的TF-IDF或词嵌入
    const keywords = this.extractKeywords(prompt);
    return this.encodeKeywords(keywords);
  }
}
```

#### 4.2 自动生成参考图链

```typescript
// CharacterDetail.tsx 增强
const generateWithSmartReference = async () => {
  // 1. 获取历史图片
  const historyImages = character.generatedImages || [];

  // 2. 智能推荐参考图
  let referenceImages: string[] = [];
  if (historyImages.length > 0) {
    const recommended = await referenceImageRecommender.findSimilarImages(prompt, historyImages, 2);
    referenceImages = recommended.map(r => r.image.path);
  }

  // 3. 生成时自动使用推荐参考图
  await generate({
    prompt,
    referenceImages,
    // ... 其他参数
  });
};
```

#### 4.3 参考图库管理界面

```typescript
// 新增 ReferenceGallery 组件
<ReferenceGallery
  images={character.generatedImages}
  onSelect={setReferenceImages}
  recommended={recommendedImages}  // 智能推荐的图片高亮显示
  similarityScores={similarityMap} // 显示相似度分数
/>
```

**修改点**:

- 新增 services/referenceImageRecommender.ts
- CharacterDetail.tsx: 集成智能推荐
- 新增 ReferenceGallery 组件

---

### 任务5：批量操作支持（1周）

**问题**: 缺乏批量选择、批量删除等操作

**现状**: 只能单张操作，效率低

**优化方案**:

#### 5.1 批量选择模式

```typescript
// AssetList.tsx 增强
const [selectionMode, setSelectionMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

const toggleSelection = (id: string) => {
  const newSet = new Set(selectedIds);
  if (newSet.has(id)) {
    newSet.delete(id);
  } else {
    newSet.add(id);
  }
  setSelectedIds(newSet);
};

const batchDelete = async () => {
  if (selectedIds.size === 0) return;

  // 确认对话框
  const confirmed = await confirmDialog({
    title: `确认删除 ${selectedIds.size} 项？`,
    message: '此操作不可恢复',
  });

  if (confirmed) {
    await Promise.all(Array.from(selectedIds).map(id => storageService.deleteAsset(id)));
    showToast(`已删除 ${selectedIds.size} 项`, 'success');
    setSelectedIds(new Set());
    setSelectionMode(false);
  }
};
```

#### 5.2 批量生成

```typescript
// 支持批量生成多个角色的场景
const batchGenerate = async (assetIds: string[], sharedPrompt: string) => {
  const jobs = assetIds.map(id => ({
    type: 'generate_image',
    params: {
      assetId: id,
      prompt: sharedPrompt,
      // ... 其他参数
    },
  }));

  // 批量提交到队列
  await Promise.all(jobs.map(job => jobQueue.addJob(job)));
};
```

**修改点**:

- AssetList.tsx: 添加批量选择模式
- 新增批量操作工具栏
- storageService: 添加批量删除方法

---

### 任务6：视频生成流程优化（1周）

**问题**: 首尾帧生成流程繁琐，参数同步需手动操作

**现状**: 需先手动生成首尾帧图片，再选择图片生成视频

**优化方案**:

#### 6.1 一键生成首尾帧+视频

```typescript
// FragmentDetail.tsx 增强
const oneClickGenerateVideo = async () => {
  // 1. 并行生成首尾帧
  const [startFrameJob, endFrameJob] = await Promise.all([
    generateImage(startFramePrompt),
    generateImage(endFramePrompt),
  ]);

  // 2. 等待图片生成完成
  const startFrame = await waitForJob(startFrameJob.id);
  const endFrame = await waitForJob(endFrameJob.id);

  // 3. 自动使用生成的图片生成视频
  const videoJob = await generateVideo({
    prompt: videoPrompt,
    startImage: startFrame.path,
    endImage: endFrame.path,
  });

  return videoJob;
};
```

#### 6.2 视频参数自动同步

```typescript
// 当用户修改了某个角色的图片，自动同步到使用该角色的视频
useEffect(() => {
  if (selectedCharacters.length > 0) {
    // 自动获取选中角色的当前图片作为参考
    const characterImages = selectedCharacters
      .map(id => {
        const char = characters.find(c => c.id === id);
        return char?.currentImageId;
      })
      .filter(Boolean);

    setReferenceImages(characterImages);
  }
}, [selectedCharacters]);
```

**修改点**:

- FragmentDetail.tsx: 添加一键生成流程
- 优化参数同步逻辑

---

## 第三阶段：复杂功能（2-3个月）

### 任务7：角色DNA一致性系统（3周）

**问题**: 角色跨镜头一致性差，需要系统化解决方案

**方案**: 建立角色DNA编码系统

#### 7.1 角色特征提取

```typescript
// services/characterDNA.ts
export class CharacterDNAExtractor {
  async extractFromImage(imagePath: string): Promise<CharacterDNA> {
    // 1. 使用CLIP提取视觉特征
    const visualFeatures = await this.extractVisualFeatures(imagePath);

    // 2. 使用人脸检测提取面部特征
    const faceFeatures = await this.extractFaceFeatures(imagePath);

    // 3. 编码为DNA
    return {
      visualSignature: visualFeatures,
      faceSignature: faceFeatures,
      keyAnchors: this.extractKeyAnchors(faceFeatures),
      createdAt: Date.now(),
    };
  }
}
```

#### 7.2 DNA约束生成

```typescript
// 生成时注入DNA约束
async generateWithDNA(
  prompt: string,
  characterDNA: CharacterDNA,
  referenceImages: string[]
) {
  // 1. 构建DNA约束提示词
  const dnaPrompt = this.buildDNAPrompt(characterDNA);

  // 2. 混合用户prompt和DNA约束
  const finalPrompt = `${prompt} ${dnaPrompt}`;

  // 3. 使用IP-Adapter或类似技术注入DNA
  return await aiService.generateImage({
    prompt: finalPrompt,
    referenceImages: [characterDNA.referenceImage, ...referenceImages],
    // 使用支持风格迁移的模型
    modelConfig: this.selectModelWithStyleTransfer()
  });
}
```

**修改点**:

- 新增 services/characterDNA.ts
- CharacterDetail.tsx: 集成DNA系统
- 数据库: 添加 characterDNA 字段

---

### 任务8：智能剧本解析增强（2周）

**问题**: 当前解析仅提取基本信息，缺乏深度理解

**方案**: 增强解析引擎，提取更多结构化信息

#### 8.1 剧情结构分析

```typescript
// services/scriptParser.ts 增强
interface EnhancedScriptParseResult {
  // ... 现有字段

  storyStructure: {
    acts: Act[];
    turningPoints: TurningPoint[];
    emotionalArc: EmotionalPoint[];
  };

  visualStyle: {
    overallTone: string;
    colorPalette: string[];
    referenceFilms: string[];
    lightingStyle: string;
  };

  characterRelationships: Relationship[];
  sceneTransitions: Transition[];
}
```

#### 8.2 多阶段解析

```typescript
// 分阶段解析，提高准确性
async parseScriptEnhanced(content: string): Promise<EnhancedScriptParseResult> {
  // Stage 1: 基础信息提取
  const metadata = await this.extractMetadata(content);

  // Stage 2: 角色深度分析
  const characters = await this.analyzeCharacters(content, metadata.characters);

  // Stage 3: 场景分析
  const scenes = await this.analyzeScenes(content, metadata.scenes);

  // Stage 4: 剧情结构分析
  const structure = await this.analyzeStructure(content);

  // Stage 5: 视觉风格分析
  const visualStyle = await this.analyzeVisualStyle(content, scenes);

  return { metadata, characters, scenes, structure, visualStyle };
}
```

**修改点**:

- 扩展 scriptParser.ts
- 更新 types.ts 中的解析结果类型
- 更新 UI 展示更多解析信息

---

### 任务9：场景-人物融合引擎（3周）

**问题**: 角色与场景光影不融合，像"贴"上去的

**方案**: 光照分析 + 重光照 + 智能合成

#### 9.1 光照分析

```typescript
// services/lightingAnalysis.ts
export class LightingAnalyzer {
  async analyze(sceneImagePath: string): Promise<LightingInfo> {
    // 1. 使用模型分析场景光照
    const analysis = await aiService.analyzeImage({
      image: sceneImagePath,
      prompt: '分析这张图片的光照条件：主光源方向、色温、阴影方向、环境光颜色',
    });

    // 2. 解析结果为结构化数据
    return this.parseLightingAnalysis(analysis);
  }
}
```

#### 9.2 重光照与合成

```typescript
// services/sceneFusion.ts
export class SceneFusionEngine {
  async fuse(params: FusionParams): Promise<FusedImage> {
    const { characterImage, sceneImage, position } = params;

    // 1. 分析场景光照
    const lighting = await lightingAnalyzer.analyze(sceneImage);

    // 2. 角色重光照
    const relitCharacter = await aiService.relightImage({
      image: characterImage,
      lighting: lighting,
      // 使用IC-Light或类似技术
      model: 'relighting-model',
    });

    // 3. 智能合成
    const composite = await aiService.compositeImages({
      background: sceneImage,
      foreground: relitCharacter,
      position,
      // 自动匹配光影
      matchLighting: true,
      addShadows: true,
      matchColorGrading: true,
    });

    return composite;
  }
}
```

**修改点**:

- 新增 services/lightingAnalysis.ts
- 新增 services/sceneFusion.ts
- SceneDetail.tsx: 添加融合功能

---

### 任务10：中文语境优化（2周）

**问题**: 古风、现代都市等中文场景表现欠佳

**方案**: 建立中文场景知识库

#### 10.1 知识库构建

```typescript
// config/chineseSceneKnowledge.ts
export const chineseSceneKnowledge = {
  ancient: {
    dynasties: ['唐', '宋', '明', '清'],
    architecture: {
      唐: ['斗拱', '歇山顶', '朱漆', '青砖'],
      宋: ['飞檐', '卷棚', '白墙', '黛瓦'],
      // ...
    },
    costumes: {
      唐: ['襦裙', '圆领袍', '披帛'],
      // ...
    },
    colorSymbolism: {
      红: '喜庆、吉祥',
      黄: '皇家、尊贵',
      // ...
    },
  },

  modern: {
    cityTiers: {
      tier1: ['北京', '上海', '深圳', '广州'],
      newTier1: ['杭州', '成都', '武汉', '西安'],
      // ...
    },
    interiorStyles: ['北欧', '日式', '新中式', '工业风'],
    socialSpaces: ['咖啡馆', '火锅店', 'KTV', '剧本杀'],
  },
};
```

#### 10.2 提示词增强

```typescript
// services/promptEnhancer.ts
export class ChinesePromptEnhancer {
  enhance(prompt: string, context: ChineseContext): string {
    // 1. 识别场景类型和朝代
    const { type, dynasty } = this.detectContext(prompt);

    // 2. 加载对应知识
    const knowledge = this.loadKnowledge(type, dynasty);

    // 3. 增强描述
    let enhanced = prompt;

    // 添加建筑特征
    if (knowledge.architecture) {
      enhanced += `，${knowledge.architecture.join('、')}`;
    }

    // 添加色彩约束
    if (knowledge.colorPalette) {
      enhanced += `，色调以${knowledge.colorPalette.join('、')}为主`;
    }

    // 添加风格约束
    enhanced += `，${knowledge.styleDescription}`;

    return enhanced;
  }
}
```

**修改点**:

- 新增 config/chineseSceneKnowledge.ts
- 新增 services/promptEnhancer.ts
- promptBuilder.ts: 集成中文增强

---

## 实施优先级与依赖关系

```
第一阶段（1-2周）
├── 任务1: 文本清洗增强 [独立]
├── 任务2: 生成进度可视化 [依赖: types.ts修改]
└── 任务3: 友好的错误提示 [独立]

第二阶段（3-4周）
├── 任务4: 智能参考图推荐 [依赖: 任务2]
├── 任务5: 批量操作支持 [独立]
└── 任务6: 视频生成流程优化 [独立]

第三阶段（2-3个月）
├── 任务7: 角色DNA系统 [依赖: 任务4]
├── 任务8: 智能剧本解析增强 [依赖: 任务1]
├── 任务9: 场景-人物融合 [依赖: 任务7]
└── 任务10: 中文语境优化 [独立]
```

---

## 预期效果

### 第一阶段后

- ✅ 小说格式问题大幅减少
- ✅ 用户知道生成进度，体验提升
- ✅ 错误提示友好，用户知道如何解决

### 第二阶段后

- ✅ 角色生成一致性显著提升
- ✅ 批量操作效率提升10倍
- ✅ 视频生成流程简化50%

### 第三阶段后

- ✅ 角色跨镜头一致性达到工业级
- ✅ 剧本解析深度提升，自动生成视觉指南
- ✅ 场景-人物融合自然，减少后期工作量
- ✅ 中文场景表现符合国内观众审美

---

## 风险评估

| 风险                       | 可能性 | 影响 | 缓解措施                       |
| -------------------------- | ------ | ---- | ------------------------------ |
| 进度可视化依赖Provider支持 | 中     | 中   | 渐进降级，不支持则显示简单状态 |
| DNA系统技术复杂度高        | 中     | 高   | 先POC验证，使用现有开源方案    |
| 融合引擎需要特定模型       | 中     | 中   | 多模型备选，不支持则跳过       |
| 中文知识库构建耗时         | 高     | 低   | 分阶段构建，先核心后完善       |

---

## 下一步行动建议

### 立即开始（本周）

1. **文本清洗增强** - 影响剧本解析成功率，改动小收益大
2. **错误提示优化** - 提升用户体验，改动小

### 下周开始

3. **生成进度可视化** - 需要修改多个Provider，但用户感知明显

### 后续规划

4. 根据前三个任务的反馈，调整后续任务优先级
5. 对复杂功能（DNA、融合引擎）进行技术预研

---

_规划制定：2026年2月28日_  
_基于项目深度分析_  
_目标：从轻度优化到复杂功能，逐步完善_
