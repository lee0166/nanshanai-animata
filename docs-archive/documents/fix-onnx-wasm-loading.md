# 修复 ONNX Runtime WASM 文件加载问题

## 问题描述

`@xenova/transformers` 库在浏览器环境中加载模型时，需要从 CDN 下载 WebAssembly 运行时文件：

- `https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/ort-wasm-simd.wasm`

由于网络问题，CDN 下载超时，导致模型加载失败。

## 解决方案

将 ONNX Runtime 的 WASM 文件下载到本地，配置库使用本地文件。

## 实施步骤

### 步骤 1：下载 ONNX Runtime WASM 文件

从 CDN 下载以下文件到 `public/ort-wasm/` 目录：

- `ort-wasm-simd.wasm`
- `ort-wasm.wasm`（备用）

### 步骤 2：配置 Transformers.js 使用本地 WASM

修改 `EmbeddingService.ts`，配置 `env.backends.onnx.wasm` 使用本地路径：

```typescript
if (typeof window !== 'undefined') {
  // 配置 WASM 文件路径
  env.backends.onnx.wasm.wasmPaths = '/ort-wasm/';
  // ... 其他配置
}
```

### 步骤 3：更新下载脚本

修改 `download-model.js`，添加 WASM 文件下载逻辑：

- 下载 ONNX Runtime WASM 文件
- 保存到 `public/ort-wasm/` 目录

### 步骤 4：测试验证

1. 清除浏览器缓存
2. 重新启动项目
3. 开启智能记忆
4. 验证模型加载成功

## 文件修改清单

- [ ] `services/parsing/EmbeddingService.ts` - 添加 WASM 路径配置
- [ ] `scripts/download-model.js` - 添加 WASM 文件下载
- [ ] `public/ort-wasm/` - 新建目录，存放 WASM 文件

## 预期结果

模型加载时不再依赖外部 CDN，所有文件从本地加载，避免网络问题导致的加载失败。
