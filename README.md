# NS AI Animata

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.2.3-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1.18-cyan.svg)](https://tailwindcss.com/)
[![HeroUI](https://img.shields.io/badge/HeroUI-2.8.7-green.svg)](https://www.heroui.com/)

## 项目简介

**NS AI Animata** 是一款本地优先（Local-First）的 AI 影视资产生成平台，旨在将您的本地电脑转化为专业的数字片场。

- 🏠 **完全本地运行** - 无需后端服务器，数据存储在本地文件系统
- 🎭 **智能剧本解析** - AI 自动提取角色、场景、分镜，支持进度追踪和后台运行
- 🎨 **多风格角色设计** - 8 种预设风格，支持角色一致性控制
- 🎬 **关键帧工作流** - 分镜自动拆分为关键帧，支持参考图生图
- 🤖 **多 AI 提供商** - 支持火山引擎、Vidu、ModelScope，可自定义模型
- ⚡ **高效任务队列** - 并发控制、失败重试、实时状态监控

## 全栈技术架构

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.2.3 | UI 框架 |
| TypeScript | 5.8.2 | 类型安全 |
| Vite | 6.2.0 | 构建工具 |
| HeroUI | 2.8.7 | 组件库（基于 React Aria） |
| Tailwind CSS | 4.1.18 | 原子化 CSS |
| Framer Motion | 12.23.26 | 动画库 |
| React Router DOM | 7.11.0 | 路由管理 |
| Lucide React | 0.562.0 | 图标库 |
| Zod | 3.25.76 | 运行时类型校验 |
| Yet Another React Lightbox | 3.28.0 | 图像预览 |
| @dnd-kit | 6.3.1+ | 拖拽排序 |

### AI/ML 集成

| 技术 | 版本 | 用途 |
|------|------|------|
| @xenova/transformers | 2.17.2 | 本地文本嵌入 |
| ChromaDB | 3.3.1 | 向量数据库 |
| @chroma-core/default-embed | 0.1.9 | 嵌入模型 |

### 文档处理

| 技术 | 版本 | 用途 |
|------|------|------|
| mammoth | 1.11.0 | Word 文档解析 |
| pdfjs-dist | 5.5.207 | PDF 文档解析 |

### 测试工具

| 技术 | 版本 | 用途 |
|------|------|------|
| Vitest | 4.0.18 | 单元测试框架 |
| @testing-library/react | 16.3.2 | React 测试库 |
| @testing-library/jest-dom | 6.9.1 | DOM 匹配器 |
| jsdom | 28.0.0 | 浏览器环境模拟 |

### 开发工具

| 技术 | 版本 | 用途 |
|------|------|------|
| ESLint | 10.0.3 | 代码检查 |
| Prettier | 3.8.1 | 代码格式化 |
| Husky | 9.1.7 | Git hooks |
| Commitlint | 20.4.3 | 提交信息校验 |
| lint-staged | 16.3.3 | Git 暂存区检查 |

## 核心架构设计

### Local-First 架构

项目采用完全本地优先的架构设计：

```
┌─────────────────────────────────────────────────────────┐
│                    浏览器 (Chrome/Edge)                  │
│  ┌─────────────────────────────────────────────────────┐│
│  │              React 单页应用 (SPA)                    ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐          ││
│  │  │   视图层  │ │  组件层   │ │  服务层   │          ││
│  │  └──────────┘ └──────────┘ └──────────┘          ││
│  └─────────────────────────────────────────────────────┘│
│         ↓                        ↓                       │
│  File System Access API  Web APIs (LocalStorage)       │
└─────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────┐
                    │   本地文件系统   │
                    │  - projects/    │
                    │  - assets/      │
                    │  - scripts/     │
                    └─────────────────┘
```

### 微服务架构（前端服务层）

项目在前端实现了完整的服务化架构：

```
services/
├── ai/                          # AI 服务模块
│   ├── providers/               # AI 提供商适配器
│   │   ├── VolcengineProvider.ts
│   │   ├── ViduProvider.ts
│   │   ├── ModelscopeProvider.ts
│   │   ├── LLMProvider.ts
│   │   └── AliyunVideoProvider.ts
│   ├── core/                    # 核心服务
│   │   ├── SmartRouter.ts       # 智能路由
│   │   ├── ModelConfigManager.ts # 模型配置管理
│   │   ├── ProviderHealthChecker.ts # 健康检查
│   │   └── ModelCapabilityManager.ts # 能力管理
│   ├── plugins/                 # 插件系统
│   └── adapters/                # 协议适配器
├── parsing/                     # 剧本解析引擎
│   ├── GlobalContextExtractor.ts # 全局上下文提取
│   ├── IntelligentShotGenerator.ts # 智能分镜生成
│   ├── QualityEvaluator.ts      # 质量评估
│   ├── IterativeRefinementEngine.ts # 迭代优化引擎
│   ├── ConsistencyChecker.ts    # 一致性检查
│   └── ... (20+ 解析服务)
├── keyframe/                    # 关键帧服务
├── video/                       # 视频生成服务
├── asset/                       # 资产管理服务
├── cache/                       # 多层缓存系统
└── queue.ts                     # 任务队列系统
```

### 剧本解析引擎架构

```
Phase 1: 故事核心层 (Story Core)
  ├─ ScriptMetadata 提取
  ├─ StoryStructure (三幕式/英雄之旅)
  ├─ VisualStyle (视觉风格)
  ├─ EraContext (时代背景)
  ├─ EmotionalArc (情绪曲线)
  └─ ConsistencyRules (一致性规则)

Phase 2: 角色层 (Characters)
  ├─ Character 提取
  ├─ Appearance (外观描述)
  ├─ Personality (性格特征)
  └─ Relationships (角色关系)

Phase 3: 场景层 (Scenes)
  ├─ Scene 提取
  ├─ Location (地点)
  ├─ Environment (环境描述)
  └─ KeyElements (关键元素)

Phase 4: 物品层 (Items)
  ├─ Item 提取
  ├─ Category (分类)
  └─ VisualPrompt (视觉提示)

Phase 5: 分镜层 (Shots)
  ├─ Shot 生成
  ├─ ShotType (景别)
  ├─ CameraMovement (运镜)
  ├─ Keyframes (关键帧拆分)
  └─ AssetMapping (资产关联)
```

### 项目目录结构

```
NSAnimata/
├── components/                  # React 组件
│   ├── AudioLibrary/           # 音频库组件
│   ├── ProjectDetail/          # 项目详情相关组件
│   │   ├── Character/          # 角色详情
│   │   ├── Scene/              # 场景详情
│   │   ├── Item/               # 物品详情
│   │   ├── Fragment/           # 片段详情
│   │   ├── Resource/           # 资源管理
│   │   └── Shared/             # 共享组件
│   ├── ScriptParser/           # 剧本解析组件
│   ├── ScriptAnalysis/         # 剧本分析组件
│   ├── DurationBudget/         # 时长预算组件
│   ├── Layout.tsx              # 布局组件
│   ├── JobMonitor.tsx          # 任务监控组件
│   └── ...
├── views/                       # 页面视图
│   ├── Dashboard.tsx            # 项目仪表盘
│   ├── ProjectDetail.tsx        # 项目详情
│   ├── ScriptManager.tsx        # 剧本管理
│   ├── ShotManager.tsx          # 分镜管理
│   ├── TimelineEditor.tsx       # 时间线编辑器
│   ├── VideoAudioManager.tsx    # 音视频管理
│   ├── Tasks.tsx                # 任务管理
│   └── Settings.tsx             # 设置页面
├── services/                    # 核心服务
│   ├── ai/                      # AI 提供商适配
│   │   ├── providers/           # 各提供商实现
│   │   ├── core/                # 核心适配器
│   │   └── types.ts
│   ├── parsing/                 # 剧本解析引擎
│   │   ├── quality/             # 质量评估
│   │   ├── refinement/          # 优化引擎
│   │   ├── consistency/         # 一致性检查
│   │   └── __tests__/           # 单元测试
│   ├── keyframe/                # 关键帧服务
│   ├── video/                   # 视频服务
│   ├── cache/                   # 多层缓存系统
│   ├── editing/                 # 编辑服务
│   ├── asset/                   # 资产管理
│   └── ...
├── src/                         # 额外源码目录
│   ├── components/
│   └── services/
├── config/                      # 配置文件
│   ├── models.ts                # 模型配置
│   ├── modelTemplates.ts        # 模型模板
│   └── quality-rules.json       # 质量规则
├── contexts/                    # React Context
├── utils/                       # 工具函数
├── scripts/                     # 构建和工具脚本
├── public/                      # 静态资源
│   ├── models/                  # 预训练模型
│   ├── ort-wasm/                # ONNX Runtime WASM
│   └── styles/                  # 风格预览图
├── types.ts                     # 类型定义
├── locales.ts                   # 国际化翻译
├── index.tsx                    # 应用入口
├── App.tsx                      # 根组件
├── vite.config.ts               # Vite 配置
├── tailwind.config.js           # Tailwind CSS 配置
├── tsconfig.json                # TypeScript 配置
├── .husky/                      # Git hooks
├── .trae/                       # Trae IDE 配置
│   └── rules/                   # 项目规则
└── package.json                 # 项目配置
```

## 核心功能模块

### 1. 剧本管理

- ✅ 支持 TXT / DOCX / PDF 多种格式导入
- ✅ 基于 LLM 的多阶段智能解析（元数据 → 角色 → 场景 → 物品 → 分镜）
- ✅ 语义分块，智能识别章节/场景边界
- ✅ 实时进度追踪，支持后台运行和恢复查看
- ✅ 智能时间预估，消除等待焦虑
- ✅ 质量评估报告生成
- ✅ 情感弧线可视化
- ✅ 故事结构分析（三幕式/英雄之旅）
- ✅ 视觉风格自动识别

### 2. 角色设计

- ✅ 8 种预设风格（电影质感、高清实拍、暗黑哥特、赛博朋克、日漫风格、新海诚风、游戏原画）
- ✅ 批量生成多张方案
- ✅ 支持 1K/2K/4K 多种分辨率
- ✅ 参考图系统，保持角色一致性
- ✅ 提示词和参数自动保存
- ✅ 三视图支持（正面/侧面/背面/四分之三）
- ✅ 角色一致性规则引擎

### 3. 场景构建

- ✅ 支持 9 种构图比例（1:1 / 16:9 / 9:16 / 4:3 / 3:4 / 3:2 / 2:3 / 21:9 / 9:21）
- ✅ 风格统一，与角色视觉保持一致
- ✅ 批量生成多个场景变体
- ✅ 多视角支持（全景/广角/细节/鸟瞰）
- ✅ 场景关键元素提取

### 4. 物品设计

- ✅ 支持武器、装备、家具、食物等多种类型
- ✅ 自动适配项目整体美术风格
- ✅ 生成的物品可作为视频生成参考素材

### 5. 分镜管理

- ✅ 分镜列表按场景分组展示，支持拖拽排序
- ✅ LLM 自动将分镜拆分为多个关键帧
- ✅ 自动关联角色和场景资产作为参考图
- ✅ 文生图和参考图生图两种模式
- ✅ 历史图片横向滚动浏览，支持切换和删除
- ✅ 一键将分镜转换为视频片段
- ✅ 影视级景别标准（大远景/远景/全景/中景/近景/特写）
- ✅ 影视级运镜技巧（推/拉/摇/升降/跟/crane/变焦）

### 6. 视频生成

- ✅ 图生视频（Image-to-Video）支持首帧和首尾帧控制
- ✅ 文生视频（Text-to-Video）
- ✅ 运镜参数调节（推拉摇移）
- ✅ 集成 Vidu 和火山引擎视频模型
- ✅ 关键帧工作流（2-3 关键帧）

### 7. 音频管理

- ✅ 音频库分类管理
- ✅ 搜索和预览功能
- ✅ 音视频同步预览
- ✅ 批量音频生成
- ✅ 对话/音效/音乐分类

### 8. 时长预算

- ✅ 内置抖音、快手、YouTube Shorts 等平台模板
- ✅ 基于字数、场景复杂度智能估算时长
- ✅ 可视化分镜依赖图谱
- ✅ 自定义时长规则配置

### 9. 剧本分析

- ✅ 故事结构图（三幕结构、情节点分布）
- ✅ 情感弧线可视化
- ✅ 视觉风格自动识别
- ✅ 故事核心要素摘要

### 10. 智能资产管理

- ✅ 自动归档到 assets/ 目录
- ✅ 可视化画廊浏览
- ✅ 元数据追踪（提示词、参数）
- ✅ 批量操作（删除、移动）
- ✅ 资源选择器

### 11. 模型配置

- ✅ 多 AI 提供商支持（火山引擎、Vidu、ModelScope、OpenAI）
- ✅ 自定义添加任意模型 ID
- ✅ 高级参数配置（Temperature、Max Tokens、enable_thinking）
- ✅ 模型分组展示（视频/图像/文本/音频）
- ✅ 批量管理模型配置
- ✅ 自动检测模型能力
- ✅ 智能任务路由
- ✅ 插件化架构，支持自定义提供商

### 12. 性能优化

- ✅ Token 优化器，节省约 80% Token 消耗
- ✅ 多层缓存系统
- ✅ 智能超时管理
- ✅ 动态批量大小
- ✅ 分级日志系统
- ✅ 熔断机制
- ✅ 语义向量缓存
- ✅ 进度动画优化

## 环境准备

### 系统要求

- **Node.js**: v18+
- **操作系统**: Windows / macOS / Linux
- **浏览器**: Chrome 120+ / Edge 120+（需要支持 File System Access API）

### 本地一键启动

```bash
# 1. 克隆项目
git clone https://github.com/lee0166/nanshanai-animata.git
cd nanshanai-animata

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

启动后访问 `http://localhost:3000` 即可使用。

### 可选：下载本地模型

```bash
# 下载预训练模型和 WASM 文件
npm run download-model
```

## 快速开始使用指南

### 1. 首次启动 - 连接工作区

1. 启动应用后，会看到欢迎页面
2. 点击 **"打开本地文件夹"** 按钮
3. 选择一个空文件夹作为您的工作区（所有项目和资产将存储在这里）
4. 授权浏览器访问该文件夹

### 2. 创建新项目

1. 在仪表盘页面点击 **"新建项目"**
2. 输入项目名称和描述
3. 点击 **"创建"** 完成项目创建

### 3. 导入剧本

1. 进入项目详情页，点击左侧 **"剧本"** 标签
2. 点击 **"导入剧本"** 按钮
3. 选择您的剧本文件（支持 TXT / DOCX / PDF 格式）
4. 或直接在编辑器中粘贴剧本内容

### 4. 智能解析剧本

1. 导入剧本后，点击 **"开始解析"**
2. 系统会自动执行以下步骤：
   - **阶段 1**: 提取故事元数据（标题、字数、角色列表等）
   - **阶段 2**: 识别并提取角色信息
   - **阶段 3**: 提取场景描述
   - **阶段 4**: 识别关键物品
   - **阶段 5**: 生成分镜列表
3. 解析过程中可以看到实时进度条
4. 解析完成后会生成质量评估报告

### 5. 生成角色设计

1. 点击左侧 **"角色"** 标签
2. 选择一个解析出的角色，或点击 **"新建角色"**
3. 填写角色名称和描述
4. 选择美术风格（8 种预设风格可选）
5. 配置生成参数（分辨率、数量等）
6. 点击 **"生成"** 按钮
7. 在历史记录中浏览生成的图片，选择满意的一张设为当前

### 6. 生成场景设计

1. 点击左侧 **"场景"** 标签
2. 选择或创建场景
3. 配置风格和参数（与角色生成类似）
4. 点击 **"生成"** 创建场景图

### 7. 分镜管理与关键帧生成

1. 点击左侧 **"分镜"** 标签，或进入 **"分镜管理"** 页面
2. 查看按场景分组的分镜列表
3. 点击某个分镜进入详情
4. 系统会自动将分镜拆分为 2-3 个关键帧
5. 为每个关键帧生成图片：
   - 可以使用文生图模式
   - 也可以关联已生成的角色/场景作为参考图
6. 历史图片可以横向滚动浏览和切换

### 8. 视频生成

1. 在分镜详情页，关键帧图片生成完成后
2. 点击 **"生成视频"** 按钮
3. 配置视频参数：
   - 选择视频模型
   - 设置运镜方式（推/拉/摇/移等）
   - 配置时长
4. 点击开始生成
5. 视频生成任务会在后台队列中运行

### 9. 模型配置

1. 点击右上角设置图标进入 **"设置"** 页面
2. 在 **"模型配置"** 部分：
   - 添加新的模型提供商
   - 配置 API 密钥
   - 设置默认模型
   - 调整高级参数（Temperature、Max Tokens 等）
3. 支持的提供商：
   - 火山引擎（Doubao、SeedEdit、HiDream）
   - Vidu
   - ModelScope
   - OpenAI 协议兼容的自定义模型

### 10. 任务监控

1. 右下角的 **"任务监控"** 面板会显示所有后台任务
2. 可以查看任务状态（等待中/处理中/已完成/失败）
3. 支持展开/折叠/最小化三种视图模式
4. 所有任务完成后会自动最小化

## 开发指南

### 代码检查命令

```bash
# 检查代码
npm run lint

# 自动修复代码
npm run lint:fix

# 格式化代码
npm run format

# 检查代码格式
npm run format:check

# 类型检查
npm run type-check

# 运行测试
npm run test

# 运行测试（带 UI）
npm run test:ui

# 测试覆盖率
npm run test:coverage
```

### 构建生产版本

```bash
# 执行类型检查并构建
npm run build

# 预览构建结果
npm run preview
```

### 部署静态文件

构建产物位于 `dist/` 目录，可部署到任何静态文件托管服务：

- **Vercel**: `vercel`
- **Netlify**: 直接上传 dist 目录
- **Nginx**: 配置静态文件服务
- **GitHub Pages**: 使用 gh-pages 工具

### 环境变量

如需配置环境变量，创建 `.env` 文件：

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

## 开发规范

### 组件开发规范

- 组件使用 PascalCase 命名
- 服务使用 camelCase 命名
- 所有 HeroUI Select 组件必须提供 label 或 aria-label
- 禁止提交包含 API 密钥的代码
- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码

### Git 提交规范

```
feat: 新功能
fix: 修复问题
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

### 文件命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase.tsx | CharacterDetail.tsx |
| 服务 | camelCase.ts | scriptParser.ts |
| 测试 | *.test.tsx | AssetPreview.test.tsx |
| 配置文件 | camelCase.config.ts | model.config.ts |

## 常见问题

### Q: 为什么需要选择本地文件夹？

A: NS AI Animata 采用 Local-First 架构，通过 File System Access API 直接读写本地文件，确保您的所有数据（包括项目文件、生成的资产、API 密钥）都存储在本地，不会上传到任何云端服务器，最大程度保障数据隐私。

### Q: 支持哪些 AI 提供商？

A: 目前已集成火山引擎（Doubao/SeedEdit/HiDream）、Vidu、ModelScope、阿里云视频等。同时支持 OpenAI 协议兼容的自定义模型。

### Q: API 密钥安全吗？

A: API 密钥仅存储在您的浏览器本地存储（LocalStorage）中，不会被上传到任何服务器。您可以随时在设置页面删除密钥。

### Q: 如何贡献模型配置？

A: 在设置页面的模型配置部分，您可以添加、编辑、删除任意模型配置。配置会保存在本地，也可以导出分享。

### Q: 支持哪些浏览器？

A: 推荐使用 Chrome 120+ 或 Edge 120+，因为需要 File System Access API 支持。Firefox 和 Safari 目前不支持该 API。

## 开源协议

本项目采用 [MIT 协议](LICENSE) 开源。

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 安全点管理

项目内置安全点管理功能：

```bash
# 创建安全点（Git 提交 + 文件备份）
npm run safe-point

# 回退到上一个安全点
npm run rollback

# 创建备份
npm run backup

# 查看备份列表
npm run backup:list
```

## 致谢

感谢所有为这个项目做出贡献的开发者！

---

<p align="center">
  Made with ❤️ by NS/Kmeng AI Team
</p>
