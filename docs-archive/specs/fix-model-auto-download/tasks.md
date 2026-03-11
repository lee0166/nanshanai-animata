# Tasks

- [ ] Task 1: 创建模型预下载脚本
  - [ ] SubTask 1.1: 创建 `scripts/download-model.js` 脚本
  - [ ] SubTask 1.2: 实现从 ModelScope 下载模型文件
  - [ ] SubTask 1.3: 将模型文件保存到 `./data/models/Xenova/all-MiniLM-L6-v2/`
  - [ ] SubTask 1.4: 添加 package.json script 命令 `download-model`

- [ ] Task 2: 修改 EmbeddingService.ts 移除浏览器环境配置
  - [ ] SubTask 2.1: 移除浏览器环境的 `env.remoteHost` 配置
  - [ ] SubTask 2.2: 保留 Node.js 环境的 ModelScope 配置
  - [ ] SubTask 2.3: 修改 `initialize()` 方法优先检查本地缓存
  - [ ] SubTask 2.4: 本地模型不存在时快速失败并显示友好提示

- [ ] Task 3: 修改 ModelDownloadProgress 组件
  - [ ] SubTask 3.1: 检测到本地模型不存在时立即显示下载失败提示
  - [ ] SubTask 3.2: 提供手动下载指引（运行预下载脚本）
  - [ ] SubTask 3.3: 提供"使用标准模式"选项

- [ ] Task 4: 更新项目文档
  - [ ] SubTask 4.1: 在 README.md 中添加智能记忆功能说明
  - [ ] SubTask 4.2: 添加模型预下载步骤说明
  - [ ] SubTask 4.3: 添加模型文件大小提示（约80MB）
  - [ ] SubTask 4.4: 添加部署检查清单

- [ ] Task 5: 测试验证
  - [ ] SubTask 5.1: 运行预下载脚本，确认模型下载成功
  - [ ] SubTask 5.2: 刷新页面，开启智能记忆，确认使用本地模型
  - [ ] SubTask 5.3: 删除本地模型，确认显示下载失败提示
  - [ ] SubTask 5.4: 验证文档提示信息清晰易懂

# Task Dependencies

- Task 2 depends on Task 1（需要了解预下载脚本的路径）
- Task 3 depends on Task 2（需要了解 EmbeddingService 的新行为）
- Task 4 depends on Task 1（需要了解预下载脚本的使用方式）
- Task 5 depends on Task 3, Task 4（需要完整功能和文档实现后才能测试）
