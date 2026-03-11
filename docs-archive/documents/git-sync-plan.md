# Git 同步计划 - 本地项目推送到 GitHub

## 当前状况分析

### 项目结构

- **项目路径**: `d:\kemeng`
- **Git 仓库**: 已初始化
- **当前 .gitignore**: 基础配置，需要增强

### 需要排除的文件类型

#### 1. 隐私/敏感文件

| 文件                       | 原因                   | 操作     |
| -------------------------- | ---------------------- | -------- |
| `.env`                     | 包含本地环境变量和路径 | 已排除 ✓ |
| `settings-instruction.txt` | 可能包含敏感配置说明   | 建议排除 |
| `metadata.json`            | 本地元数据             | 建议排除 |

#### 2. 开发辅助文件

| 文件                                      | 原因          | 操作     |
| ----------------------------------------- | ------------- | -------- |
| `ANALYSIS_REPORT.md`                      | AI 分析报告   | 建议排除 |
| `commit-msg.txt`                          | 临时提交信息  | 建议排除 |
| `commit.sh`                               | 提交脚本      | 建议排除 |
| `start-dev.ps1`                           | 本地开发脚本  | 建议排除 |
| `liucheng.html`                           | 流程图文件    | 建议排除 |
| `控制台日志.txt`                          | 调试日志      | 建议排除 |
| `CLAUDE.md`                               | AI 对话记录   | 建议排除 |
| `CHARACTER_GENERATION_GUIDE.md`           | 开发文档      | 建议排除 |
| `IMAGE_MODEL_PARAMS_GUIDE.md`             | 开发文档      | 建议排除 |
| `VIDEO_MODEL_PARAMS_GUIDE.md`             | 开发文档      | 建议排除 |
| `小说解析流程文档.md`                     | 开发文档      | 建议排除 |
| `小说转短剧解析系统_融合优化方案_v2.0.md` | 开发文档      | 建议排除 |
| `融合方案_实施细节与代码示例 (1).md`      | 开发文档      | 建议排除 |
| `docs/` 目录                              | 开发文档目录  | 建议排除 |
| `.trae/` 目录                             | AI 配置和规则 | 已排除 ✓ |
| `dev/` 目录                               | 开发目录      | 已排除 ✓ |

#### 3. 备份文件

| 文件                  | 原因     | 操作     |
| --------------------- | -------- | -------- |
| `ShotList.tsx.backup` | 备份文件 | 建议排除 |

---

## 执行步骤

### 第一步：更新 .gitignore

更新 `.gitignore` 文件，添加开发辅助文件和隐私文件的排除规则。

### 第二步：配置 Git 用户信息（如未配置）

```bash
git config --global user.name "你的用户名"
git config --global user.email "你的邮箱"
```

### 第三步：检查当前 Git 状态

```bash
git status
git branch -a
git remote -v
```

### 第四步：添加文件到暂存区

```bash
# 添加所有文件（.gitignore 中的文件会被自动排除）
git add .
```

### 第五步：提交更改

```bash
git commit -m "feat: 同步本地完整项目到 GitHub

- 更新 .gitignore 排除开发辅助文件和隐私文件
- 同步所有核心源代码
- 同步配置文件和公共资源"
```

### 第六步：推送到 GitHub

```bash
# 推送到 main 分支
git push origin main

# 如果遇到分支名不同（如 master）
git push origin master
```

---

## SSH 密钥配置（推荐）

### 为什么使用 SSH？

- ✅ 无需每次输入用户名密码
- ✅ 更安全的认证方式
- ✅ 避免 HTTPS 的认证问题

### 配置步骤

#### 1. 检查现有 SSH 密钥

```bash
ls ~/.ssh/
```

#### 2. 生成新的 SSH 密钥（如果没有）

```bash
ssh-keygen -t ed25519 -C "你的邮箱@example.com"
```

按回车使用默认路径，可以设置密码或直接回车跳过。

#### 3. 添加 SSH 密钥到 SSH 代理

```bash
# 启动 SSH 代理
eval "$(ssh-agent -s)"

# 添加私钥
ssh-add ~/.ssh/id_ed25519
```

#### 4. 复制公钥到 GitHub

```bash
# 复制公钥内容
cat ~/.ssh/id_ed25519.pub
```

然后：

1. 登录 GitHub
2. 点击右上角头像 → Settings
3. 左侧 SSH and GPG keys → New SSH key
4. 粘贴公钥内容，保存

#### 5. 测试连接

```bash
ssh -T git@github.com
```

#### 6. 修改远程仓库地址为 SSH

```bash
git remote set-url origin git@github.com:用户名/仓库名.git
```

---

## 推送失败常见问题

### 问题 1：权限拒绝

```
fatal: unable to access 'https://github.com/...': The requested URL returned error: 403
```

**解决**: 使用 SSH 方式或检查 GitHub 权限

### 问题 2：分支冲突

```
error: failed to push some refs to '...'
```

**解决**:

```bash
git pull origin main --rebase
git push origin main
```

### 问题 3：大文件推送慢

```
remote: Resolving deltas: 100% ...
```

**解决**: 检查是否有大文件未排除（如视频、大型图片）

---

## 需要确认的问题

### 1. GitHub 仓库信息

- 仓库 URL: `https://github.com/用户名/仓库名.git`
- 当前远程仓库配置是否正确？

### 2. 隐私文件确认

以下文件是否包含敏感信息，需要排除？

- [ ] `settings-instruction.txt`
- [ ] `metadata.json`

### 3. 开发文档确认

以下开发文档是否需要推送到 GitHub？

- [ ] `CHARACTER_GENERATION_GUIDE.md`
- [ ] `IMAGE_MODEL_PARAMS_GUIDE.md`
- [ ] `VIDEO_MODEL_PARAMS_GUIDE.md`
- [ ] `docs/` 目录下的文件

---

## 下一步操作

请确认以下信息，我将帮你执行同步：

1. **GitHub 仓库地址**是什么？（用于确认远程配置）
2. **settings-instruction.txt 和 metadata.json** 是否包含敏感信息？
3. **开发文档**是否需要推送到 GitHub？
4. **SSH 密钥**是否已配置？（如果没有，我可以指导你配置）

确认后，我将立即执行同步操作。
