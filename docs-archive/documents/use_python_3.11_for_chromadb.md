# 使用 Python 3.11 运行 Chroma DB 计划

## 目标

安装并配置 Python 3.11，成功启动 Chroma DB 服务，完成项目全链路解析流程测试。

## 背景

- 当前系统 Python 版本：3.14（不兼容 Chroma DB）
- Chroma DB 兼容版本：Python 3.10 - 3.11
- 项目使用 Node.js/React，Python 仅用于 Chroma DB 服务

## 实施步骤

### 步骤 1：下载并安装 Python 3.11

1. 从 Python 官网下载 Python 3.11.x Windows 安装包
2. 运行安装程序，选择：
   - ✅ Add Python 3.11 to PATH（添加到环境变量）
   - ✅ Install for all users
   - 安装路径建议：`C:\Python311`
3. 验证安装：`py -3.11 --version`

### 步骤 2：创建 Python 3.11 虚拟环境

1. 在项目目录下创建虚拟环境：
   ```bash
   py -3.11 -m venv .venv-chroma
   ```
2. 激活虚拟环境：
   ```bash
   .venv-chroma\Scripts\activate
   ```

### 步骤 3：安装 Chroma DB

1. 在激活的虚拟环境中安装：
   ```bash
   pip install chromadb
   ```
2. 验证安装：
   ```bash
   python -c "import chromadb; print(chromadb.__version__)"
   ```

### 步骤 4：启动 Chroma DB 服务

1. 创建数据目录：
   ```bash
   mkdir -p ./data/chroma_db
   ```
2. 启动服务：
   ```bash
   chroma run --path ./data/chroma_db
   ```
3. 验证服务运行：
   ```bash
   curl http://localhost:8000/api/v1/heartbeat
   ```

### 步骤 5：运行项目测试

1. 保持 Chroma DB 服务运行
2. 在新的终端窗口中运行项目测试：
   ```bash
   npm test -- services/VectorMemory.test.ts --run
   npm test -- services/scriptParser.vector.test.ts --run
   ```

### 步骤 6：验证全链路解析

1. 启动项目开发服务器：`npm run dev`
2. 在浏览器中访问项目
3. 测试剧本解析功能，验证 VectorMemory 是否正常工作

## 风险与注意事项

### 风险

- Python 3.11 与系统现有 Python 3.14 共存，不会冲突
- Chroma DB 数据存储在 `./data/chroma_db`，与项目其他部分隔离

### 注意事项

- 每次使用 Chroma DB 前需要激活虚拟环境
- Chroma DB 服务需要保持运行状态
- 项目代码无需修改，通过 HTTP 接口连接 Chroma DB

## 回滚方案

如需卸载 Python 3.11：

1. Windows 设置 → 应用 → 卸载 Python 3.11
2. 删除项目目录下的 `.venv-chroma` 文件夹
3. 删除 `./data/chroma_db` 数据目录

## 预期结果

- ✅ Python 3.11 成功安装
- ✅ Chroma DB 服务正常启动
- ✅ VectorMemory 测试通过
- ✅ 项目全链路解析流程正常工作
