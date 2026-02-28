# 🎬 Nanshan AI Animata (南山 AI 短剧版)

> **专为创作者打造的本地优先 (Local-First) AI 视频创作工作台**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.2-purple)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.1-cyan)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)

---

## 📖 项目简介

**Nanshan AI Animata** 是一款开源的 AI 影视资产生成平台，旨在将您的本地电脑转化为专业的数字片场。

它采用 **Local-First（本地优先）** 架构，通过浏览器的 File System Access API 直接读写本地文件，无需上传素材至云端，最大程度保障数据隐私。项目深度集成了 **火山引擎 (Doubao/SeedEdit/HiDream)**、**Vidu** 和 **ModelScope** 等前沿大模型，提供从剧本解析、角色/场景设计到关键帧生成的完整影视制作工作流。

### 🌟 核心亮点

- 🏠 **完全本地运行** - 无需后端服务器，数据存储在本地浏览器
- 🎭 **智能剧本解析** - AI 自动提取角色、场景、分镜，支持断点续传
- 🎨 **多风格角色设计** - 8 种预设风格，支持角色一致性控制
- 🎬 **关键帧工作流** - 分镜自动拆分为关键帧，支持参考图生图
- 🤖 **多 AI 提供商** - 支持火山引擎、Vidu、ModelScope，可自定义模型
- ⚡ **高效任务队列** - 并发控制、失败重试、实时状态监控

---

## ✨ 核心功能

### 📝 剧本管理 (Script Management)

导入小说文本，AI 自动解析角色、场景和分镜，快速构建完整的视觉叙事框架。

- **智能解析引擎** - 基于 LLM 的 4 阶段解析流程（元数据 → 角色 → 场景 → 分镜）
- **语义分块** - 智能识别章节/场景边界，优化长文本处理
- **批量提取** - 单次 API 调用提取所有角色/场景信息
- **断点续传** - 支持从任意阶段恢复解析，避免重复调用
- **多模型支持** - 可配置 DeepSeek、Kimi、Qwen、Doubao 等 LLM 模型

### 🎨 角色设计 (Character Design)

稳定生成具有固定特征的角色立绘，解决 AI 绘画"角色不一致"的痛点。

- **8 种风格预设** - 电影质感、高清实拍、暗黑哥特、赛博朋克、日漫风格、新海诚风、游戏原画
- **批量生成** - 支持并发生成多张方案，快速筛选最佳结果
- **超清画质** - 支持 1K/2K/4K 多种分辨率
- **参考图系统** - 使用已生成角色作为参考，保持角色一致性
- **提示词追踪** - 自动保存生成参数，方便回溯复现

### 🏙️ 场景构建 (Scene Creation)

为故事生成高保真的背景环境，支持多种构图比例。

- **自定义比例** - 支持横屏 (16:9)、竖屏 (9:16)、方形 (1:1) 等 9 种比例
- **风格统一** - 可与角色使用相同的风格参数，确保画面视觉一致性
- **批量生成** - 一次生成多个场景变体供选择

### 📦 物品设计 (Item Design)

生成游戏道具、武器或装饰物，完善世界观细节。

- **类型丰富** - 支持武器、装备、家具、食物等多种类型
- **风格匹配** - 自动适配项目整体美术风格
- **辅助创作** - 生成的物品可作为视频生成的参考素材

### 🎬 分镜管理 (Shot Management)

可视化管理剧本分镜，支持关键帧生成和视频片段制作。

- **分镜列表** - 按场景分组展示，支持拖拽排序
- **关键帧拆分** - 使用 LLM 自动将分镜拆分为多个关键帧
- **参考图管理** - 自动关联角色和场景资产作为参考图
- **生图模式** - 支持文生图和参考图生图两种模式
- **历史图片** - 横向滚动浏览历史生成结果，支持切换和删除

### 🎥 视频生成 (Video Generation)

基于 Vidu 和火山引擎模型，提供电影级的视频生成控制能力。

- **图生视频 (Image-to-Video)**
  - **首帧控制** - 指定视频起始画面，完美衔接静态素材
  - **首尾帧控制** - 同时指定起始和结束画面，精准控制剧情走向
- **文生视频 (Text-to-Video)** - 通过文字描述直接生成动态视频片段
- **运镜控制** - 支持推拉摇移等运镜参数调节

### 📂 智能资产管理 (Asset Management)

像管理本地文件一样管理 AI 资产，告别混乱的素材库。

- **自动归档** - 生成的角色、场景自动分类存入 `assets/` 目录
- **可视化画廊** - 瀑布流式素材浏览，支持快速预览
- **元数据追踪** - 自动保存生成时的提示词和参数
- **批量操作** - 支持批量删除、移动资产

### ⚙️ 灵活的模型配置

支持自定义添加和配置多种 AI 模型，满足不同创作需求。

- **多供应商支持** - 火山引擎、Vidu、ModelScope、OpenAI 等
- **自定义模型** - 可手动添加任意模型 ID，灵活适配最新模型
- **参数配置** - 支持 Temperature、Max Tokens、enable_thinking 等高级参数
- **模型管理** - 支持编辑、删除、启用/禁用模型配置

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      前端应用层 (React 19)                       │
├─────────────────────────────────────────────────────────────────┤
│  Dashboard │ ProjectDetail │ ScriptManager │ ShotManager        │
├─────────────────────────────────────────────────────────────────┤
│                      核心服务层                                  │
│  AIService │ JobQueue │ StorageService │ ScriptParser          │
├─────────────────────────────────────────────────────────────────┤
│                      AI 提供商适配层                             │
│  Volcengine │ Vidu │ ModelScope │ LLMProvider                  │
├─────────────────────────────────────────────────────────────────┤
│                      数据存储层                                  │
│  OPFS (主存储) │ IndexedDB (备用) │ File System API            │
└─────────────────────────────────────────────────────────────────┘
```

### 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [React](https://react.dev/) | 19.2.3 | UI 框架 |
| [TypeScript](https://www.typescriptlang.org/) | 5.8.2 | 类型安全 |
| [Vite](https://vitejs.dev/) | 6.2.0 | 构建工具 |
| [HeroUI](https://www.heroui.com/) | 2.8.7 | 组件库 (基于 React Aria) |
| [Tailwind CSS](https://tailwindcss.com/) | 4.1.18 | 原子化 CSS |
| [Framer Motion](https://www.framer.com/motion/) | 12.23.26 | 动画库 |
| [React Router](https://reactrouter.com/) | 7.11.0 | 路由管理 |
| [Vitest](https://vitest.dev/) | 3.x | 单元测试 |

---

## ⚡ 快速开始

### 环境要求

- **Node.js** v18+
- 现代浏览器 (推荐 Chrome 120+ 或 Edge 120+)
- **注意**: 需要使用支持 File System Access API 的浏览器

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/lee0166/nanshanai-animata.git

# 2. 进入目录
cd nanshanai-animata

# 3. 安装依赖
npm install

# 4. 启动开发服务器
npm run dev
```

启动后访问 `http://localhost:5173` 即可使用。

### 生产构建

```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

---

## 📖 使用指南

### 第一步：配置 AI 引擎

1. 打开 **设置** 页面
2. 添加 AI 提供商:
   - **火山引擎** - 需要 Access Key ID 和 Secret Access Key
   - **Vidu** - 需要 API Key
   - **ModelScope** - 需要 Access Token
3. 选择或添加模型配置
4. 点击 **保存设置**

> **注意**: API 密钥仅存储于浏览器本地，不会上传到任何服务器。

### 第二步：创建项目

1. 在 **首页** 点击 **新建项目**
2. 选择本地文件夹作为项目根目录
3. 输入项目名称和描述
4. 项目数据将自动保存到所选目录的 `assets/` 文件夹

### 第三步：导入剧本（可选）

1. 进入 **剧本管理** 页面
2. 点击 **导入剧本**，选择小说文本文件 (.txt/.docx/.pdf)
3. 选择解析格式（标准剧本/短剧格式）
4. 点击 **开始解析**
5. 等待 AI 完成 4 阶段解析（元数据 → 角色 → 场景 → 分镜）

### 第四步：筹备美术资产

1. 进入 **项目详情** 页面
2. 在 **角色** 标签页生成主要角色立绘
   - 输入角色描述
   - 选择风格模板
   - 点击 **生成**
3. 在 **场景** 标签页生成关键场景背景
4. 在 **物品** 标签页生成重要道具

### 第五步：制作分镜和关键帧

1. 进入 **分镜管理** 页面
2. 选择需要制作的分镜
3. 点击 **拆分关键帧**，AI 自动拆分为多个关键帧
4. 选择关键帧，配置参考图（角色 + 场景）
5. 点击 **生成图片**
6. 在历史图片中选择最满意的结果

### 第六步：生成视频片段

1. 进入 **片段** 标签页
2. 选择生成的关键帧图片作为首帧
3. 输入动作描述
4. 选择视频生成模型
5. 点击 **生成视频**

---

## 🎯 支持的 AI 模型

### 图像生成

| 模型 | 提供商 | 特点 |
|------|--------|------|
| SeedEdit | 火山引擎 | 图像编辑和重绘 |
| HiDream | 火山引擎 | 高质量图像生成 |
| Wanx | ModelScope | 异步图像生成 |

### 视频生成

| 模型 | 提供商 | 特点 |
|------|--------|------|
| Vidu 1.5 | Vidu | 高质量图生视频 |
| 火山视频 | 火山引擎 | 支持首尾帧控制 |

### 文本生成 (LLM)

| 模型 | 提供商 | 用途 |
|------|--------|------|
| Doubao | 火山引擎 | 剧本解析、关键帧拆分 |
| Qwen | ModelScope | 通用文本生成 |
| DeepSeek | 自定义 | 高质量推理 |
| Kimi | 自定义 | 长文本处理 |

---

## 📁 项目结构

```
nanshanai-animata/
├── components/           # React 组件
│   ├── ProjectDetail/   # 项目详情相关组件
│   ├── ScriptParser/    # 剧本解析组件
│   ├── Layout.tsx       # 布局组件
│   └── JobMonitor.tsx   # 任务监控组件
├── views/               # 页面视图
│   ├── Dashboard.tsx    # 项目仪表盘
│   ├── ProjectDetail.tsx # 项目详情
│   ├── ScriptManager.tsx # 剧本管理
│   ├── ShotManager.tsx  # 分镜管理
│   ├── Settings.tsx     # 设置页面
│   └── Tasks.tsx        # 任务列表
├── services/            # 核心服务
│   ├── ai/             # AI 提供商适配
│   │   ├── providers/  # 各提供商实现
│   │   └── ModelRouter.ts # 模型路由
│   ├── parsing/        # 剧本解析引擎
│   ├── keyframe/       # 关键帧服务
│   ├── aiService.ts    # AI 服务调度
│   ├── queue.ts        # 任务队列
│   ├── storage.ts      # 存储服务
│   └── scriptParser.ts # 剧本解析
├── contexts/           # React Context
├── config/             # 配置文件
├── public/             # 静态资源
├── types.ts            # TypeScript 类型定义
└── locales.ts          # 国际化配置
```

---

## 🧪 测试

```bash
# 运行单元测试
npm test

# 运行测试并生成覆盖率报告
npm run coverage
```

测试覆盖要求:
- 服务层函数覆盖率 > 80%
- 组件渲染测试（无报错即可）

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发规范

- 组件使用 PascalCase 命名
- 服务使用 camelCase 命名
- 所有 HeroUI Select 组件必须提供 label 或 aria-label
- 禁止提交包含 API 密钥的代码

### 提交规范

```
feat: 新功能
fix: 修复问题
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建/工具相关
```

---

## 📝 更新日志

### v1.0.0 (2025-02)

- ✨ 初始版本发布
- 🎨 支持 8 种风格预设
- 📝 智能剧本解析引擎
- 🎬 关键帧工作流
- 🤖 多 AI 提供商支持
- ⚡ 任务队列和并发控制

---

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE) 开源。

---

## 🙏 致谢

- [HeroUI](https://www.heroui.com/) - 优秀的 React 组件库
- [火山引擎](https://www.volcengine.com/) - AI 能力支持
- [Vidu](https://www.vidu.com/) - 视频生成支持
- [ModelScope](https://www.modelscope.cn/) - 模型社区支持

---

<p align="center">
  Made with ❤️ by Nanshan AI Team
</p>
