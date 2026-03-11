# 提交信息规范指南

## 🎯 概述

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范来规范提交信息，配合 Husky 和 commitlint 进行自动检查。

## 📝 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 格式说明

- **type** (必需): 提交类型
- **scope** (可选): 影响范围
- **subject** (必需): 简短描述
- **body** (可选): 详细描述
- **footer** (可选): 破坏性变更或关闭 Issue

## 🏷️ 提交类型

| 类型       | 说明                                  | 示例                                        |
| ---------- | ------------------------------------- | ------------------------------------------- |
| `feat`     | 新功能                                | `feat(auth): add login functionality`       |
| `fix`      | 修复bug                               | `fix(api): resolve data fetching issue`     |
| `docs`     | 文档更新                              | `docs(readme): update installation guide`   |
| `style`    | 代码格式（不影响代码运行）            | `style: format code with prettier`          |
| `refactor` | 重构（既不是新增功能，也不是修改bug） | `refactor(utils): simplify date formatting` |
| `test`     | 增加测试                              | `test(auth): add login unit tests`          |
| `chore`    | 构建过程或辅助工具的变动              | `chore(deps): update dependencies`          |
| `ci`       | CI配置                                | `ci(github): add github actions`            |
| `build`    | 构建系统或外部依赖的变动              | `build(vite): optimize build config`        |
| `perf`     | 性能优化                              | `perf(api): cache api responses`            |
| `revert`   | 回滚                                  | `revert: revert "feat(auth): add login"`    |

## 💡 提交示例

### 简单提交

```bash
git commit -m "feat(auth): add login functionality"
```

### 带范围的提交

```bash
git commit -m "fix(api): resolve data fetching issue"
```

### 带详细描述的提交

```bash
git commit -m "feat(auth): add login functionality

- Add login form component
- Implement JWT token storage
- Add authentication guard

Closes #123"
```

## ⚙️ Git Hooks

### pre-commit

在提交前自动运行：

- ESLint 自动修复
- Prettier 格式化

### commit-msg

在提交时检查提交信息格式，如果不符合规范会拒绝提交。

## 🚨 常见错误

### ❌ 错误的提交信息

```bash
git commit -m "update code"           # 缺少类型
git commit -m "feat:"                 # 缺少描述
git commit -m "feat: Update Code"     # 描述首字母大写
git commit -m "feature: add login"    # 错误的类型
```

### ✅ 正确的提交信息

```bash
git commit -m "feat: add login functionality"
git commit -m "fix(api): resolve data fetching issue"
git commit -m "docs: update readme"
```

## 🔧 绕过检查（不推荐）

在紧急情况下，可以使用 `--no-verify` 绕过检查：

```bash
git commit -m "紧急修复" --no-verify
```

**注意**: 这不会运行 pre-commit 和 commit-msg 钩子，请谨慎使用。

## 📚 相关文档

- [Conventional Commits](https://www.conventionalcommits.org/)
- [commitlint 文档](https://commitlint.js.org/)
- [Husky 文档](https://typicode.github.io/husky/)

---

_配置时间: 2026-03-10_
