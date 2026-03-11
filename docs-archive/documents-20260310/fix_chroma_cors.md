# 修复 Chroma DB CORS 跨域问题

## 问题分析

从后端日志可以看到错误：

```
Access to fetch at 'http://localhost:8000/api/v2/heartbeat' from origin 'http://localhost:3000'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**根本原因**：

- 前端项目运行在 `http://localhost:3000`
- Chroma DB 服务运行在 `http://localhost:8000`
- 浏览器安全策略阻止了跨域请求（CORS）

## 解决方案

### 方案 1：配置 Chroma DB 允许 CORS（推荐）

Chroma DB 支持通过环境变量或配置文件启用 CORS。

**步骤**：

1. 停止当前 Chroma DB 服务
2. 使用以下命令重新启动，添加 CORS 配置：
   ```bash
   .venv-chroma\Scripts\activate
   $env:CHROMA_SERVER_CORS_ALLOW_ORIGINS = '["http://localhost:3000"]'
   chroma run --path ./data/chroma_db
   ```

### 方案 2：使用 Vite 代理（开发环境）

配置 Vite 开发服务器代理请求到 Chroma DB。

**步骤**：

1. 修改 `vite.config.ts`，添加代理配置：
   ```typescript
   server: {
     proxy: {
       '/chroma': {
         target: 'http://localhost:8000',
         changeOrigin: true,
         rewrite: (path) => path.replace(/^\/chroma/, '')
       }
     }
   }
   ```
2. 修改项目代码，将 Chroma DB 地址从 `http://localhost:8000` 改为 `/chroma`

### 方案 3：修改 VectorMemoryConfig 使用代理地址

修改代码中的 Chroma DB URL，通过 Vite 代理访问。

**步骤**：

1. 修改 `VectorMemoryConfig.ts` 中的默认 URL：
   ```typescript
   chromaDbUrl: 'http://localhost:8000'; // 改为 Vite 代理地址
   ```

## 推荐实施方案

**采用方案 1**（Chroma DB CORS 配置），因为：

- 最简单直接
- 不需要修改项目代码
- 生产环境也可以沿用相同配置

## 实施步骤

1. 停止当前 Chroma DB 服务（Ctrl+C）
2. 在 PowerShell 中设置环境变量并重启：
   ```powershell
   .venv-chroma\Scripts\activate
   $env:CHROMA_SERVER_CORS_ALLOW_ORIGINS = '["http://localhost:3000", "http://127.0.0.1:3000"]'
   chroma run --path ./data/chroma_db
   ```
3. 刷新浏览器页面，测试智能记忆功能

## 验证

- 浏览器控制台不再出现 CORS 错误
- `VectorMemoryConfig.checkServerStatus()` 返回 `true`
- 智能记忆功能正常工作
