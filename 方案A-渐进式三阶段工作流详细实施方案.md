# 方案A：渐进式三阶段工作流 - 详细实施方案

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
1. **基于现有参数**：不臆测，使用项目已有的真实参数
2. **复用现有UI/UX**：调用项目已有的UI组件和设计规范
3. **不破坏现有功能**：保持项目其他功能正常运行
4. **统一持久化存储**：符合项目设定的本地文件夹保存逻辑
5. **渐进式改进**：可以分阶段实施，不影响现有流程

---

## 二、现有资产分析

### 2.1 数据结构（types.ts）

#### 2.1.1 CharacterAsset 类型（无需修改）
```typescript
// 已有的类型定义完全够用
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

#### 2.1.2 GeneratedImage 类型（无需修改）
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

#### 2.1.3 扩展建议（在 metadata 中）
在 GeneratedImage.metadata 中添加用途标记：
```typescript
// metadata 结构扩展
{
  // 新增：图片用途标记
  "stage": "face" | "full-body" | "view-front" | "view-side" | "view-back" | "view-three-quarter",
  // 新增：工作流阶段
  "workflowStage": 1 | 2 | 3,
  // 其他现有字段保持不变
}
```

### 2.2 现有UI组件库

#### 2.2.1 HeroUI 组件（完全复用）
- ✅ `Tabs`, `Tab` - 用于阶段导航
- ✅ `Card`, `CardBody`, `CardHeader` - 用于内容展示
- ✅ `Button`, `ButtonGroup` - 用于操作按钮
- ✅ `Input`, `Textarea`, `Select` - 用于参数配置
- ✅ `Spinner`, `Modal` - 用于加载和弹窗
- ✅ `Chip` - 用于状态标记

#### 2.2.2 现有自定义组件（完全复用）
- ✅ `ImageGenerationPanel` - 图片生成面板
- ✅ `StyleSelector` - 风格选择器
- ✅ `DynamicModelParameters` - 动态参数
- ✅ `ResourcePicker` - 资源选择器

#### 2.2.3 图标库（Lucide React）
- ✅ `User`, `UserPlus`, `UserCheck` - 角色相关
- ✅ `Camera`, `Image`, `Layers` - 图片相关
- ✅ `ChevronRight`, `ChevronLeft` - 导航
- ✅ `Check`, `X` - 状态
- ✅ `Wand2` - 生成

### 2.3 存储服务（storage.ts）

#### 2.3.1 文件保存路径（完全复用）
```typescript
// 项目已有的路径结构
`projects/${projectId}/assets/${timestamp}_${random}.${ext}`

// 建议在 metadata 中添加用途标记，但路径保持不变
```

#### 2.3.2 存储方法（完全复用）
- ✅ `saveBinaryFile(filePath, blob)` - 保存二进制文件
- ✅ `getAssetUrl(path)` - 获取资源URL
- ✅ `saveAsset(asset)` - 保存资产数据
- ✅ `getAsset(assetId, projectId)` - 获取资产数据

---

## 三、详细实施方案

### 3.1 类型定义扩展（最小改动）

**文件**：`types.ts`

**改动**：无需修改主类型，只需要在使用时在 metadata 中添加字段

```typescript
// 在 GeneratedImage.metadata 中使用的字段约定（不需要修改类型定义）
interface ImageMetadata extends Record<string, any> {
  // 工作流阶段标记
  stage?: 'face' | 'full-body' | 'view-front' | 'view-side' | 'view-back' | 'view-three-quarter';
  // 工作流阶段序号
  workflowStage?: 1 | 2 | 3;
  // 父图片ID（用于追踪来源）
  parentImageId?: string;
}
```

### 3.2 提示词生成服务扩展

**文件**：`services/prompt.ts`

**新增函数**：
```typescript
/**
 * 阶段1：面部特写图提示词
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
 * 阶段2：全身设定图提示词（基于面部图）
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

### 3.3 新建组件：CharacterWorkflowWizard

**文件**：`components/ProjectDetail/Character/CharacterWorkflowWizard.tsx`

**功能**：三阶段工作流向导组件

```tsx
import React, { useState } from 'react';
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

// 工作流阶段
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
  
  // 阶段配置
  const stages = [
    { id: 1, label: '面部特征设计', icon: User, description: '生成面部特写，确定面部特征' },
    { id: 2, label: '全身设定图', icon: Camera, description: '基于面部图生成全身设定' },
    { id: 3, label: '多视角生成', icon: Layers, description: '生成三视图（正面、侧面、背面）' },
  ];

  // 检查阶段是否可用
  const isStageEnabled = (stage: WorkflowStage): boolean => {
    if (stage === 1) return true;
    if (stage === 2) return selectedFaceImage !== null;
    if (stage === 3) return selectedFullBodyImage !== null;
    return false;
  };

  // 阶段1：面部特征设计处理
  const handleStage1Generate = async (params: any) => {
    // 类似现有 handleGenerate，但使用 getFacePortraitPrompt
    // 生成2-3张候选图
    // 用户选择满意的一张作为 selectedFaceImage
  };

  // 阶段2：全身设定图处理
  const handleStage2Generate = async (params: any) => {
    // 使用 selectedFaceImage 作为参考图
    // 使用 getFullBodyPrompt
    // 生成全身图
  };

  // 阶段3：多视角生成处理
  const handleStage3Generate = async () => {
    // 使用 assetReuseService 生成三视图
    // 基于 selectedFullBodyImage
  };

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
            {/* ImageGenerationPanel 配置为面部模式 */}
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
            {/* 显示选中的面部图 + ImageGenerationPanel */}
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
            {/* 显示选中的全身图 + 多视角生成按钮 */}
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
          <Button
            color="default"
            variant="flat"
            onPress={() => {
              // 切换回传统模式
            }}
          >
            使用传统模式
          </Button>
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

### 3.4 修改 CharacterDetail 组件

**文件**：`components/ProjectDetail/Character/CharacterDetail.tsx`

**改动**：添加工作流模式切换

```tsx
// 在文件顶部添加导入
import { CharacterWorkflowWizard } from './CharacterWorkflowWizard';

// 在组件内部添加状态
const [workflowMode, setWorkflowMode] = useState<'traditional' | 'wizard'>('traditional');

// 在 UI 中添加模式切换
<div className="flex gap-2 mb-4">
  <Button
    color={workflowMode === 'traditional' ? 'primary' : 'default'}
    variant={workflowMode === 'traditional' ? 'solid' : 'flat'}
    onPress={() => setWorkflowMode('traditional')}
  >
    传统模式
  </Button>
  <Button
    color={workflowMode === 'wizard' ? 'primary' : 'default'}
    variant={workflowMode === 'wizard' ? 'solid' : 'flat'}
    onPress={() => setWorkflowMode('wizard')}
  >
    专业模式（三阶段）
  </Button>
</div>

// 根据模式渲染不同内容
{workflowMode === 'traditional' ? (
  // 现有的两栏布局代码保持不变
) : (
  // 新的三阶段工作流
  <CharacterWorkflowWizard 
    asset={asset}
    onUpdate={onUpdate}
    projectId={projectId}
  />
)}
```

### 3.5 新增国际化翻译

**文件**：`locales.ts`

**添加新的翻译键**（在适当位置添加）：
```typescript
// 在 translations.zh 和 translations.en 中都添加
character: {
  // ... 现有翻译
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
}
```

---

## 四、文件修改清单

### 4.1 新增文件
1. `components/ProjectDetail/Character/CharacterWorkflowWizard.tsx` - 三阶段工作流向导组件

### 4.2 修改文件
1. `services/prompt.ts` - 添加面部特写和全身图提示词函数
2. `components/ProjectDetail/Character/CharacterDetail.tsx` - 添加模式切换
3. `locales.ts` - 添加新的翻译键

### 4.3 不修改文件
- ✅ `types.ts` - 不需要修改，通过 metadata 扩展
- ✅ `services/storage.ts` - 完全复用现有存储逻辑
- ✅ 其他所有组件和服务 - 保持不变

---

## 五、持久化存储统一性

### 5.1 图片保存路径
```
保持不变：projects/${projectId}/assets/${timestamp}_${random}.${ext}
```

### 5.2 图片用途标记（通过 metadata）
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

// 阶段3：三视图
{
  "stage": "view-front",  // 或 "view-side", "view-back", "view-three-quarter"
  "workflowStage": 3,
  "parentImageId": "全身图的ID"
}
```

### 5.3 资产数据结构
```typescript
// CharacterAsset 完全保持现有结构
// 所有图片保存在 generatedImages 数组中
// 通过 metadata.stage 字段区分用途
// views 字段仍然用于保存最终的三视图
```

---

## 六、实施步骤

### 阶段1：准备（低风险）
1. ✅ 创建回滚点
2. ✅ 添加新的提示词函数到 `services/prompt.ts`
3. ✅ 添加翻译键到 `locales.ts`

### 阶段2：核心组件（中等风险）
4. ⏳ 创建 `CharacterWorkflowWizard.tsx` 组件
5. ⏳ 实现阶段1：面部特征设计
6. ⏳ 实现阶段2：全身设定图

### 阶段3：完成（中等风险）
7. ⏳ 实现阶段3：多视角生成
8. ⏳ 修改 `CharacterDetail.tsx` 添加模式切换
9. ⏳ 测试完整工作流

---

## 七、回滚方案

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
1. ✅ 完全符合专业游戏/动画行业标准流程
2. ✅ 面部特征优先锁定，一致性最高
3. ✅ 渐进式细化，用户参与度高
4. ✅ 最小改动原则，不破坏现有功能
5. ✅ 完全复用现有UI组件、存储服务、数据结构
6. ✅ 支持双模式切换，用户可以选择传统或专业模式

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
