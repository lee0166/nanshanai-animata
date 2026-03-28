# 方案A：渐进式三阶段工作流 - 详细实施方案（基于真实参数）

**日期**：2026年3月23日
**项目**：Kmeng AI Animata
**方案**：渐进式三阶段角色设计工作流

---

## 一、方案概述

### 1.1 核心目标
实现专业游戏/动画行业标准的角色设计工作流：
```
阶段1：面部特征设计 → 阶段2：全身设定图 → 阶段3：多视角三视图
```

### 1.2 设计原则
1. **基于现有真实参数**：完全使用项目已有的真实参数，不臆测
2. **复用现有UI/UX**：调用项目已有的UI组件和设计规范
3. **不破坏现有功能**：保持项目其他功能正常运行
4. **统一持久化存储**：完全符合项目设定的本地文件夹保存逻辑
5. **渐进式改进**：可以分阶段实施，不影响现有流程

---

## 二、现有资产真实参数分析

### 2.1 数据结构（types.ts）- 完全无需修改

#### 2.1.1 CharacterAsset 类型（真实存在，完全复用）
```typescript
// 项目已有的类型定义完全够用
interface CharacterAsset extends Asset {
  gender?: 'male' | 'female' | 'unlimited';
  ageGroup?: 'childhood' | 'youth' | 'middle_aged' | 'elderly' | 'unknown';
  generatedImages?: GeneratedImage[];      // ✅ 用于保存所有阶段生成的图片
  currentImageId?: string;                  // ✅ 用于当前选中的图片
  views?: CharacterViews;                   // ✅ 用于保存三视图
  currentViewAngle?: CharacterViewAngle;
  referenceImage?: GeneratedImage;          // ✅ 可以用于保存选定的面部图
}
```

#### 2.1.2 GeneratedImage 类型（真实存在，完全复用）
```typescript
interface GeneratedImage {
  id: string;
  path: string;
  prompt: string;
  userPrompt?: string;
  modelConfigId: string;
  modelId: string;
  referenceImages: string[];
  metadata?: Record<string, any>;  // ✅ 可以用于存储图片用途标记
  createdAt: number;
  width?: number;
  height?: number;
}
```

#### 2.1.3 扩展约定（在 metadata 中，无需修改类型）
在 GeneratedImage.metadata 中添加用途标记（完全基于现有结构）：
```typescript
// metadata 结构扩展约定（无需修改types.ts）
{
  // 新增：图片用途标记
  "stage": "face" | "full-body" | "view-front" | "view-side" | "view-back" | "view-three-quarter",
  // 新增：工作流阶段
  "workflowStage": 1 | 2 | 3,
  // 新增：父图片ID（用于追踪来源）
  "parentImageId": "string",
  // 其他现有字段保持不变
}
```

### 2.2 现有UI组件库（真实存在，完全复用）

#### 2.2.1 HeroUI 组件（项目已使用）
- ✅ `Tabs`, `Tab` - 用于阶段导航（CharacterDetail.tsx:21已导入）
- ✅ `Card`, `CardBody`, `CardHeader` - 用于内容展示（CharacterDetail.tsx:16已导入）
- ✅ `Button`, `ButtonGroup` - 用于操作按钮（CharacterDetail.tsx:15已导入）
- ✅ `Input`, `Textarea`, `Select` - 用于参数配置（CharacterDetail.tsx:12-14已导入）
- ✅ `Spinner`, `Modal` - 用于加载和弹窗（CharacterDetail.tsx:17-20已导入）
- ✅ `Chip` - 用于状态标记（CharacterDetail.tsx:23已导入）

#### 2.2.2 现有自定义组件（项目已存在，完全复用）
- ✅ `ImageGenerationPanel` - 图片生成面板（CharacterDetail.tsx:42已导入）
- ✅ `StyleSelector` - 风格选择器（ImageGenerationPanel.tsx:8已导入）
- ✅ `DynamicModelParameters` - 动态参数（ImageGenerationPanel.tsx:9已导入）
- ✅ `ResourcePicker` - 资源选择器（CharacterDetail.tsx:40已导入）

#### 2.2.3 图标库（Lucide React，项目已使用）
- ✅ `User`, `UserPlus`, `UserCheck` - 角色相关（CharacterDetail.tsx:34已导入User）
- ✅ `Camera`, `Image`, `Layers` - 图片相关（CharacterDetail.tsx:35-36已导入）
- ✅ `ChevronRight`, `ChevronLeft` - 导航
- ✅ `Check`, `X` - 状态（CharacterDetail.tsx:28-29已导入）
- ✅ `Wand2` - 生成（CharacterDetail.tsx:33已导入）

### 2.3 存储服务（真实存在，完全复用）

#### 2.3.1 文件保存路径（真实存在，完全复用）
```typescript
// 项目已有的路径结构（storage.ts）
`projects/${projectId}/assets/${timestamp}_${random}.${ext}`

// 保持不变，只在 metadata 中添加用途标记
```

#### 2.3.2 存储方法（真实存在，完全复用）
- ✅ `saveBinaryFile(filePath, blob)` - 保存二进制文件（storage.ts）
- ✅ `getAssetUrl(path)` - 获取资源URL（CharacterDetail.tsx:4已导入storageService）
- ✅ `saveAsset(asset)` - 保存资产数据（storage.ts）
- ✅ `getAsset(assetId, projectId)` - 获取资产数据（storage.ts）

### 2.4 现有真实参数配置

#### 2.4.1 已有的宽高比选项（真实存在）
```typescript
// CharacterDetail.tsx:121
const allAspectRatios = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', '9:21'];
```

#### 2.4.2 已有的分辨率选项（真实存在）
```typescript
// CharacterDetail.tsx:119
const availableResolutions = capabilities.supportedResolutions || ['1K', '2K', '4K'];
```

#### 2.4.3 已有的风格选项（真实存在）
```typescript
// prompt.ts:1-44
export const DefaultStylePrompt = {
  movie: { nameCN: '电影质感', prompt: 'cinematic lighting, movie still, shot on 35mm...' },
  photorealistic: { nameCN: '高清实拍', prompt: 'photorealistic, raw photo, DSLR...' },
  gothic: { nameCN: '暗黑哥特', prompt: 'gothic style, dark atmosphere...' },
  cyberpunk: { nameCN: '赛博朋克', prompt: 'cyberpunk, neon lights, futuristic...' },
  anime: { nameCN: '日漫风格', prompt: 'anime style, 2D animation...' },
  shinkai: { nameCN: '新海诚风', prompt: 'Makoto Shinkai style, beautiful sky...' },
  game: { nameCN: '游戏原画', prompt: 'game cg, splash art...' },
};
```

---

## 三、详细实施方案（基于真实参数）

### 3.1 提示词生成服务扩展

**文件**：`services/prompt.ts`（真实存在）

**新增函数**（基于现有getRoleImagePrompt的结构）：
```typescript
/**
 * 阶段1：面部特写图提示词（基于真实参数）
 */
export const getFacePortraitPrompt = (userPrompt: string, age: string, gender: string) => {
  let details = '';
  if (age && age !== 'unknown' && age !== '不详' && age !== 'unknown') {
    details += `角色年龄段: ${age}\n    `;
  }
  if (gender && gender !== 'unlimited' && gender !== '不限' && gender !== 'unlimited') {
    details += `性别: ${gender}\n    `;
  }

  return `
    生成一张高质量的人物面部特写头像。
    ${details}角色特征: ${userPrompt} 
    画面要求：
    头像特写，focus on face, detailed facial features, clear portrait, professional character design.
    画面风格清晰、锐利，光照均匀。
    `;
};

/**
 * 阶段2：全身设定图提示词（基于真实参数）
 */
export const getFullBodyPrompt = (userPrompt: string, age: string, gender: string) => {
  let details = '';
  if (age && age !== 'unknown' && age !== '不详' && age !== 'unknown') {
    details += `角色年龄段: ${age}\n    `;
  }
  if (gender && gender !== 'unlimited' && gender !== '不限' && gender !== 'unlimited') {
    details += `性别: ${gender}\n    `;
  }

  return `
    生成一张高质量的人物全身设定图。
    ${details}角色特征: ${userPrompt} 
    画面要求：
    full body shot, standing pose, character design sheet, professional concept art.
    画面风格清晰、锐利，光照均匀。
    `;
};
```

### 3.2 新建组件：CharacterWorkflowWizard

**文件**：`components/ProjectDetail/Character/CharacterWorkflowWizard.tsx`（新建）

**功能**：三阶段工作流向导组件（完全基于现有组件和参数）

```tsx
import React, { useState, useEffect } from 'react';
import { Tabs, Tab, Card, Button, Spinner, Chip } from '@heroui/react';
import { User, Camera, Layers, ChevronRight, Check } from 'lucide-react';
import { CharacterAsset, GeneratedImage, CharacterViewAngle } from '../../../types';
import { useApp } from '../../../contexts/context';
import { useToast } from '../../../contexts/ToastContext';
import { jobQueue } from '../../../services/queue';
import { aiService } from '../../../services/aiService';
import { getFacePortraitPrompt, getFullBodyPrompt, getDefaultStylePrompt } from '../../../services/prompt';
import { assetReuseService } from '../../../services/asset/AssetReuseService';
import { ImageGenerationPanel } from '../Shared/ImageGenerationPanel';
import { storageService } from '../../../services/storage';

// 工作流阶段（基于真实参数）
type WorkflowStage = 1 | 2 | 3;

interface CharacterWorkflowWizardProps {
  asset: CharacterAsset;
  onUpdate: (updatedAsset: CharacterAsset) => void;
  projectId: string;
}

export const CharacterWorkflowWizard: React.FC<CharacterWorkflowWizardProps> = ({
  asset,
  onUpdate,
  projectId
}) => {
  const { t, settings } = useApp();
  const { showToast } = useToast();
  
  // 当前阶段
  const [currentStage, setCurrentStage] = useState<WorkflowStage>(1);
  // 各阶段选中的图片
  const [selectedFaceImage, setSelectedFaceImage] = useState<GeneratedImage | null>(null);
  const [selectedFullBodyImage, setSelectedFullBodyImage] = useState<GeneratedImage | null>(null);
  // 生成状态
  const [generating, setGenerating] = useState(false);
  
  // 阶段1参数（基于真实参数）
  const [stage1Prompt, setStage1Prompt] = useState(asset.prompt || '');
  const [stage1ModelId, setStage1ModelId] = useState<string>('');
  const [stage1ReferenceImages, setStage1ReferenceImages] = useState<string[]>([]);
  const [stage1AspectRatio, setStage1AspectRatio] = useState<string>('1:1'); // 头像推荐1:1
  const [stage1Resolution, setStage1Resolution] = useState<string>('2K');
  const [stage1Style, setStage1Style] = useState<string>('');
  const [stage1Count, setStage1Count] = useState<number>(2); // 生成2-3张候选
  const [stage1GuidanceScale, setStage1GuidanceScale] = useState<number>(2.5);
  
  // 阶段2参数（基于真实参数）
  const [stage2Prompt, setStage2Prompt] = useState(asset.prompt || '');
  const [stage2ModelId, setStage2ModelId] = useState<string>('');
  const [stage2AspectRatio, setStage2AspectRatio] = useState<string>('3:4'); // 全身推荐3:4
  const [stage2Resolution, setStage2Resolution] = useState<string>('2K');
  const [stage2Style, setStage2Style] = useState<string>('');
  const [stage2Count, setStage2Count] = useState<number>(1);
  const [stage2GuidanceScale, setStage2GuidanceScale] = useState<number>(2.5);
  
  // 阶段配置
  const stages = [
    { id: 1, label: '面部特征设计', icon: User, description: '生成面部特写，确定面部特征' },
    { id: 2, label: '全身设定图', icon: Camera, description: '基于面部图生成全身设定' },
    { id: 3, label: '多视角生成', icon: Layers, description: '生成三视图（正面、侧面、背面）' },
  ];

  // 初始化模型ID（基于真实逻辑）
  useEffect(() => {
    const imageModels = settings.models.filter(m => m.type === 'image' && (m.enabled ?? true));
    const initialModelId = imageModels[0]?.id || '';
    setStage1ModelId(initialModelId);
    setStage2ModelId(initialModelId);
  }, [settings.models]);

  // 检查阶段是否可用
  const isStageEnabled = (stage: WorkflowStage): boolean => {
    if (stage === 1) return true;
    if (stage === 2) return selectedFaceImage !== null;
    if (stage === 3) return selectedFullBodyImage !== null;
    return false;
  };

  // 阶段1：面部特征设计处理
  const handleStage1Generate = async () => {
    if (!stage1ModelId) {
      showToast(t.errors.modelNotFound, 'error');
      return;
    }

    setGenerating(true);
    try {
      const finalPrompt = getFacePortraitPrompt(stage1Prompt, asset.ageGroup || '', asset.gender || '');
      const stylePrompt = getDefaultStylePrompt(stage1Style);
      const fullPrompt = stylePrompt ? `${finalPrompt}\n${stylePrompt}` : finalPrompt;

      const runtimeModel = settings.models.find(m => m.id === stage1ModelId);
      
      // 生成多张候选图
      for (let i = 0; i < stage1Count; i++) {
        const job = await aiService.generateImage(
          projectId,
          asset.id,
          fullPrompt,
          stage1Prompt,
          runtimeModel?.modelId || '',
          stage1ModelId,
          stage1ReferenceImages,
          stage1AspectRatio,
          stage1Resolution,
          stage1GuidanceScale,
          {
            style: stage1Style,
            stage: 'face',
            workflowStage: 1,
            generateCount: stage1Count,
          }
        );
      }
      
      showToast(t.project.generationStarted, 'info');
    } catch (error) {
      console.error('Stage 1 generation failed:', error);
      showToast(t.errors.generationFailed, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // 阶段2：全身设定图处理
  const handleStage2Generate = async () => {
    if (!stage2ModelId || !selectedFaceImage) {
      showToast(t.errors.modelNotFound, 'error');
      return;
    }

    setGenerating(true);
    try {
      const finalPrompt = getFullBodyPrompt(stage2Prompt, asset.ageGroup || '', asset.gender || '');
      const stylePrompt = getDefaultStylePrompt(stage2Style);
      const fullPrompt = stylePrompt ? `${finalPrompt}\n${stylePrompt}` : finalPrompt;

      const runtimeModel = settings.models.find(m => m.id === stage2ModelId);
      
      // 使用面部图作为参考图
      const referenceImages = [selectedFaceImage.path];
      
      const job = await aiService.generateImage(
        projectId,
        asset.id,
        fullPrompt,
        stage2Prompt,
        runtimeModel?.modelId || '',
        stage2ModelId,
        referenceImages,
        stage2AspectRatio,
        stage2Resolution,
        stage2GuidanceScale,
        {
          style: stage2Style,
          stage: 'full-body',
          workflowStage: 2,
          parentImageId: selectedFaceImage.id,
        }
      );
      
      showToast(t.project.generationStarted, 'info');
    } catch (error) {
      console.error('Stage 2 generation failed:', error);
      showToast(t.errors.generationFailed, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // 阶段3：多视角生成处理
  const handleStage3Generate = async () => {
    if (!selectedFullBodyImage) {
      showToast('请先选择全身图', 'error');
      return;
    }

    setGenerating(true);
    try {
      // 使用现有的assetReuseService生成三视图
      await assetReuseService.generateCharacterViews(
        asset,
        selectedFullBodyImage,
        projectId,
        onUpdate
      );
      
      showToast(t.project.generationStarted, 'info');
    } catch (error) {
      console.error('Stage 3 generation failed:', error);
      showToast(t.errors.generationFailed, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // 选择图片
  const handleSelectFaceImage = (image: GeneratedImage) => {
    setSelectedFaceImage(image);
    onUpdate({
      ...asset,
      referenceImage: image,
    });
  };

  const handleSelectFullBodyImage = (image: GeneratedImage) => {
    setSelectedFullBodyImage(image);
  };

  // 过滤各阶段的图片
  const stage1Images = (asset.generatedImages || []).filter(
    img => img.metadata?.workflowStage === 1 || img.metadata?.stage === 'face'
  );

  const stage2Images = (asset.generatedImages || []).filter(
    img => img.metadata?.workflowStage === 2 || img.metadata?.stage === 'full-body'
  );

  return (
    <div className="h-full flex flex-col">
      {/* 顶部阶段导航 */}
      <div className="border-b border-slate-200 dark:border-slate-800 p-4">
        <Tabs 
          selectedKey={String(currentStage)}
          onSelectionChange={(key) => {
            const stage = Number(key) as WorkflowStage;
            if (isStageEnabled(stage)) {
              setCurrentStage(stage);
            }
          }}
          classNames={{
            tabList: 'gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg',
            tab: 'data-[selected=true]:bg-white dark:data-[selected=true]:bg-slate-700 transition-colors',
          }}
        >
          {stages.map((stage) => (
            <Tab 
              key={String(stage.id)}
              isDisabled={!isStageEnabled(stage.id as WorkflowStage)}
              title={
                <div className="flex items-center gap-2">
                  <stage.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{stage.label}</span>
                  {currentStage > stage.id && (
                    <Check className="w-3 h-3 text-green-500" />
                  )}
                </div>
              }
            />
          ))}
        </Tabs>
      </div>

      {/* 阶段内容区 */}
      <div className="flex-1 overflow-auto p-4">
        {/* 阶段1内容 */}
        {currentStage === 1 && (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl">
              <h3 className="font-bold text-sm mb-2">阶段1：面部特征设计</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                生成2-3张面部特写候选图，选择最满意的一张作为面部特征锁定。
              </p>
            </div>
            
            {/* 使用现有的ImageGenerationPanel */}
            <ImageGenerationPanel
              projectId={projectId}
              prompt={stage1Prompt}
              onPromptChange={setStage1Prompt}
              modelId={stage1ModelId}
              onModelChange={setStage1ModelId}
              referenceImages={stage1ReferenceImages}
              onReferenceImagesChange={setStage1ReferenceImages}
              aspectRatio={stage1AspectRatio}
              onAspectRatioChange={setStage1AspectRatio}
              resolution={stage1Resolution}
              onResolutionChange={setStage1Resolution}
              style={stage1Style}
              onStyleChange={setStage1Style}
              count={stage1Count}
              onCountChange={setStage1Count}
              guidanceScale={stage1GuidanceScale}
              onGuidanceScaleChange={setStage1GuidanceScale}
              generating={generating}
              onGenerate={handleStage1Generate}
            >
              {/* 性别和年龄字段（基于现有组件） */}
            </ImageGenerationPanel>

            {/* 阶段1生成的图片 */}
            {stage1Images.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">生成的面部候选图</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {stage1Images.map((img) => (
                    <Card 
                      key={img.id}
                      className={`cursor-pointer transition-all ${selectedFaceImage?.id === img.id ? 'ring-2 ring-primary' : ''}`}
                      onPress={() => handleSelectFaceImage(img)}
                    >
                      {/* 图片预览内容 */}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 阶段2内容 */}
        {currentStage === 2 && (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl">
              <h3 className="font-bold text-sm mb-2">阶段2：全身设定图</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                基于选定的面部图，生成全身设定图。
              </p>
            </div>
            
            {/* 显示选中的面部图 */}
            {selectedFaceImage && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">已选择的面部图</h4>
                <Card className="w-48">
                  {/* 面部图预览 */}
                </Card>
              </div>
            )}

            {/* ImageGenerationPanel配置为全身模式 */}
            <ImageGenerationPanel
              projectId={projectId}
              prompt={stage2Prompt}
              onPromptChange={setStage2Prompt}
              modelId={stage2ModelId}
              onModelChange={setStage2ModelId}
              referenceImages={selectedFaceImage ? [selectedFaceImage.path] : []}
              onReferenceImagesChange={() => {}} // 禁用，固定使用面部图
              aspectRatio={stage2AspectRatio}
              onAspectRatioChange={setStage2AspectRatio}
              resolution={stage2Resolution}
              onResolutionChange={setStage2Resolution}
              style={stage2Style}
              onStyleChange={setStage2Style}
              count={stage2Count}
              onCountChange={setStage2Count}
              guidanceScale={stage2GuidanceScale}
              onGuidanceScaleChange={setStage2GuidanceScale}
              generating={generating}
              onGenerate={handleStage2Generate}
            />

            {/* 阶段2生成的图片 */}
            {stage2Images.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">生成的全身图</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {stage2Images.map((img) => (
                    <Card 
                      key={img.id}
                      className={`cursor-pointer transition-all ${selectedFullBodyImage?.id === img.id ? 'ring-2 ring-primary' : ''}`}
                      onPress={() => handleSelectFullBodyImage(img)}
                    >
                      {/* 图片预览内容 */}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 阶段3内容 */}
        {currentStage === 3 && (
          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl">
              <h3 className="font-bold text-sm mb-2">阶段3：多视角生成</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                基于全身设定图，生成三视图（正面、侧面、背面、四分之三）。
              </p>
            </div>
            
            {/* 显示选中的全身图 */}
            {selectedFullBodyImage && (
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">已选择的全身图</h4>
                <Card className="w-48">
                  {/* 全身图预览 */}
                </Card>
              </div>
            )}

            {/* 多视角生成按钮 */}
            <Button
              color="primary"
              isLoading={generating}
              onPress={handleStage3Generate}
              isDisabled={!selectedFullBodyImage}
            >
              生成三视图
            </Button>

            {/* 现有的三视图展示 */}
            {asset.views && (
              <div className="mt-4">
                {/* 复用现有的三视图展示逻辑 */}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center">
        <Button
          variant="flat"
          isDisabled={currentStage === 1}
          onPress={() => setCurrentStage(prev => Math.max(1, prev - 1) as WorkflowStage)}
        >
          上一步
        </Button>
        <div className="flex gap-2">
          {currentStage < 3 && isStageEnabled(currentStage + 1 as WorkflowStage) && (
            <Button
              color="primary"
              endContent={<ChevronRight className="w-4 h-4" />}
              onPress={() => setCurrentStage(prev => prev + 1 as WorkflowStage)}
            >
              下一步
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
```

### 3.3 修改 CharacterDetail 组件（基于真实代码）

**文件**：`components/ProjectDetail/Character/CharacterDetail.tsx`（真实存在）

**改动**：添加工作流模式切换（最小改动）

```tsx
// 在文件顶部添加导入（第43行后）
import { CharacterWorkflowWizard } from './CharacterWorkflowWizard';

// 在组件内部添加状态（第59行后）
const [workflowMode, setWorkflowMode] = useState<'traditional' | 'wizard'>('traditional');

// 在UI中添加模式切换（找到合适位置，比如activeTab附近）
<div className="flex gap-2 mb-4">
  <Button
    color={workflowMode === 'traditional' ? 'primary' : 'default'}
    variant={workflowMode === 'traditional' ? 'solid' : 'flat'}
    onPress={() => setWorkflowMode('traditional')}
    size="sm"
  >
    传统模式
  </Button>
  <Button
    color={workflowMode === 'wizard' ? 'primary' : 'default'}
    variant={workflowMode === 'wizard' ? 'solid' : 'flat'}
    onPress={() => setWorkflowMode('wizard')}
    size="sm"
  >
    专业模式（三阶段）
  </Button>
</div>

// 根据模式渲染不同内容（找到现有的两栏布局代码，包裹在条件判断中）
{workflowMode === 'traditional' ? (
  // 现有的两栏布局代码保持不变
  <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden">
    {/* 左侧：生成面板 */}
    <div className="w-full lg:w-1/2 flex flex-col gap-4 overflow-auto">
      {/* 现有的生成面板代码 */}
    </div>
    
    {/* 右侧：预览区 */}
    <div className="w-full lg:w-1/2 flex flex-col gap-4 overflow-hidden">
      {/* 现有的预览区代码 */}
    </div>
  </div>
) : (
  // 新的三阶段工作流
  <CharacterWorkflowWizard 
    asset={asset}
    onUpdate={onUpdate}
    projectId={projectId}
  />
)}
```

### 3.4 新增国际化翻译（基于真实结构）

**文件**：`locales.ts`（真实存在）

**添加新的翻译键**（在character部分添加，基于现有结构）：

```typescript
// 在 translations.en.character 中添加（第481行后）
workflowMode: {
  traditional: 'Traditional Mode',
  wizard: 'Professional Mode (3-Stage)',
},
workflow: {
  stage1: 'Face Design',
  stage2: 'Full Body Design',
  stage3: 'Multi-View Generation',
  stage1Desc: 'Generate 2-3 face close-up candidates, select the best one',
  stage2Desc: 'Generate full body design based on selected face',
  stage3Desc: 'Generate multi-view views based on full body',
  selectFace: 'Select Face Image',
  selectFullBody: 'Select Full Body Image',
  nextStep: 'Next',
  prevStep: 'Previous',
  useTraditional: 'Use Traditional Mode',
},

// 在 translations.zh.character 中添加（第1005行后）
workflowMode: {
  traditional: '传统模式',
  wizard: '专业模式（三阶段）',
},
workflow: {
  stage1: '面部特征设计',
  stage2: '全身设定图',
  stage3: '多视角生成',
  stage1Desc: '生成2-3张面部特写候选图，选择最满意的一张',
  stage2Desc: '基于选定的面部图，生成全身设定图',
  stage3Desc: '基于全身设定图，生成三视图',
  selectFace: '选择面部图',
  selectFullBody: '选择全身图',
  nextStep: '下一步',
  prevStep: '上一步',
  useTraditional: '使用传统模式',
},
```

---

## 四、文件修改清单（基于真实文件）

### 4.1 新增文件
1. `components/ProjectDetail/Character/CharacterWorkflowWizard.tsx` - 三阶段工作流向导组件

### 4.2 修改文件
1. `services/prompt.ts` - 添加面部特写和全身图提示词函数（基于现有getRoleImagePrompt结构）
2. `components/ProjectDetail/Character/CharacterDetail.tsx` - 添加模式切换（最小改动，不破坏现有逻辑）
3. `locales.ts` - 添加新的翻译键（基于现有character部分结构）

### 4.3 不修改文件（完全保持原样）
- ✅ `types.ts` - 不需要修改，通过 metadata 扩展
- ✅ `services/storage.ts` - 完全复用现有存储逻辑
- ✅ `services/aiService.ts` - 完全复用现有AI服务
- ✅ `services/queue.ts` - 完全复用现有任务队列
- ✅ `services/asset/AssetReuseService.ts` - 完全复用现有多视角生成服务
- ✅ `components/ProjectDetail/Shared/ImageGenerationPanel.tsx` - 完全复用
- ✅ `components/ProjectDetail/Shared/StyleSelector.tsx` - 完全复用
- ✅ `components/ProjectDetail/Shared/DynamicModelParameters.tsx` - 完全复用
- ✅ 其他所有组件和服务 - 保持不变

---

## 五、持久化存储统一性（完全基于现有逻辑）

### 5.1 图片保存路径（完全不变）
```
保持不变：projects/${projectId}/assets/${timestamp}_${random}.${ext}
```

### 5.2 图片用途标记（通过 metadata，完全基于现有结构）
```typescript
// 阶段1：面部图
{
  "stage": "face",
  "workflowStage": 1
}

// 阶段2：全身图
{
  "stage": "full-body", 
  "workflowStage": 2,
  "parentImageId": "面部图的ID"
}

// 阶段3：三视图（完全复用现有views结构）
{
  "stage": "view-front",  // 或 "view-side", "view-back", "view-three-quarter"
  "workflowStage": 3,
  "parentImageId": "全身图的ID"
}
```

### 5.3 资产数据结构（完全保持现有结构）
```typescript
// CharacterAsset 完全保持现有结构
// 所有图片保存在 generatedImages 数组中
// 通过 metadata.stage 字段区分用途
// views 字段仍然用于保存最终的三视图（完全复用现有逻辑）
```

---

## 六、实施步骤（最小风险）

### 阶段1：准备（低风险）
1. ✅ 创建回滚点
2. ⏳ 添加新的提示词函数到 `services/prompt.ts`
3. ⏳ 添加翻译键到 `locales.ts`

### 阶段2：核心组件（中等风险）
4. ⏳ 创建 `CharacterWorkflowWizard.tsx` 组件
5. ⏳ 实现阶段1：面部特征设计
6. ⏳ 实现阶段2：全身设定图

### 阶段3：完成（中等风险）
7. ⏳ 实现阶段3：多视角生成
8. ⏳ 修改 `CharacterDetail.tsx` 添加模式切换
9. ⏳ 测试完整工作流

---

## 七、回滚方案（安全保障）

### 7.1 Git 回滚
```bash
# 如果使用了 git commit 作为回滚点
git reset --hard HEAD~1

# 如果使用了 git stash
git stash pop
```

### 7.2 功能回滚
只需要在 `CharacterDetail.tsx` 中：
1. 移除模式切换代码
2. 恢复原来的两栏布局
3. 删除新增的组件文件

---

## 八、总结

### 8.1 方案优势
1. ✅ 完全基于项目真实参数，不臆测
2. ✅ 完全符合专业游戏/动画行业标准流程
3. ✅ 面部特征优先锁定，一致性最高
4. ✅ 渐进式细化，用户参与度高
5. ✅ 最小改动原则，不破坏现有功能
6. ✅ 完全复用现有UI组件、存储服务、数据结构
7. ✅ 支持双模式切换，用户可以选择传统或专业模式
8. ✅ 持久化存储完全统一，符合项目现有逻辑

### 8.2 风险控制
1. ⚠️ 新增代码较多，需要充分测试
2. ⚠️ 用户需要学习新的工作流
3. ⚠️ 生成时间较长（三个阶段）

### 8.3 兼容性保证
1. ✅ 传统模式完全保留
2. ✅ 数据结构完全兼容
3. ✅ 存储格式完全统一
4. ✅ 可以随时切换回传统模式

---

**方案制定完成日期**：2026年3月23日
**方案状态**：等待用户确认和回滚点设置
