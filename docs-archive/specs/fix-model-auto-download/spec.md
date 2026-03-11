# 修复模型自动下载问题 Spec

## Why

`@xenova/transformers` 库在浏览器环境中无法通过 `env.remoteHost` 配置修改模型下载源，导致模型下载总是失败。用户开启智能记忆功能后，模型无法自动下载，影响用户体验。

## What Changes

- **BREAKING**: 移除浏览器环境中的 `env.remoteHost` 配置（不生效）
- 添加本地模型缓存检测机制
- 实现模型预下载脚本（Node.js 环境）
- 修改 EmbeddingService 优先使用本地缓存模型
- 添加模型下载失败时的友好降级处理

## Impact

- Affected specs: 智能记忆功能、VectorMemory、EmbeddingService
- Affected code: EmbeddingService.ts, vite.config.ts, package.json

## ADDED Requirements

### Requirement: 本地模型缓存优先

The system SHALL 优先使用本地缓存的模型文件，避免浏览器环境中下载失败。

#### Scenario: 本地模型存在

- **GIVEN** 本地缓存目录存在模型文件
- **WHEN** 用户开启智能记忆功能
- **THEN** 直接使用本地模型，无需下载

#### Scenario: 本地模型不存在

- **GIVEN** 本地缓存目录不存在模型文件
- **WHEN** 用户开启智能记忆功能
- **THEN** 显示模型下载失败提示，提供手动下载指引
- **AND** 允许用户使用标准模式继续

### Requirement: 模型预下载脚本

The system SHALL 提供 Node.js 脚本用于预下载模型文件到本地缓存。

#### Scenario: 开发环境初始化

- **GIVEN** 开发者运行预下载脚本
- **WHEN** 脚本执行成功
- **THEN** 模型文件下载到 `./data/models` 目录
- **AND** 浏览器环境可以直接使用本地模型

### Requirement: 浏览器环境配置移除

The system SHALL 移除浏览器环境中不生效的 `env.remoteHost` 配置。

#### Scenario: 浏览器环境初始化

- **GIVEN** 代码在浏览器环境运行
- **WHEN** EmbeddingService 初始化
- **THEN** 不设置 `env.remoteHost`（避免配置不生效的问题）
- **AND** 依赖本地缓存或显示下载失败提示

## MODIFIED Requirements

### Requirement: EmbeddingService 初始化逻辑

**Current**: 尝试通过 `env.remoteHost` 配置下载模型
**Modified**:

- 优先检查本地缓存
- 本地不存在时显示下载失败提示
- 提供手动下载指引

## REMOVED Requirements

### Requirement: 浏览器环境 ModelScope 镜像配置

**Reason**: `@xenova/transformers` 的 `env.remoteHost` 在浏览器环境中不生效
**Migration**: 使用本地模型缓存或预下载脚本

## ADDED Requirements

### Requirement: 用户文档提示

The system SHALL 在项目说明文档中明确提示用户关于模型预下载的要求。

#### Scenario: 开发者首次部署

- **GIVEN** 开发者阅读项目 README
- **WHEN** 看到智能记忆功能相关说明
- **THEN** 明确知晓需要预下载模型文件
- **AND** 了解运行 `npm run download-model` 命令

#### Scenario: 终端用户首次使用

- **GIVEN** 终端用户访问项目文档
- **WHEN** 查看部署指南
- **THEN** 看到模型文件大小（约80MB）的提示
- **AND** 了解智能记忆功能的依赖要求

#### Scenario: 模型缺失时的界面提示

- **GIVEN** 用户开启智能记忆功能但本地模型不存在
- **WHEN** 界面显示下载失败提示
- **THEN** 提示信息包含明确的解决步骤
- **AND** 提供文档链接或命令示例
