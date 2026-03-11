# 同步项目更新到 GitHub 仓库计划

## 当前状态检查

### 本地提交状态

需要检查本地是否有未推送的提交：

- 剧本页面滚动修复
- 视觉提示词优化
- README 更新

### 同步前准备

1. **检查网络连接** - 确保能访问 GitHub
2. **检查远程仓库状态** - 获取最新远程提交
3. **处理可能的冲突** - 如有冲突需要合并

## 同步步骤

### 步骤一：检查本地提交状态

```bash
git status
git log --oneline -10
```

### 步骤二：获取远程更新

```bash
git fetch origin
```

### 步骤三：检查是否有冲突

```bash
git log --oneline --left-right --graph origin/master..HEAD
```

### 步骤四：推送本地提交到 GitHub

```bash
git push origin master
```

### 步骤五：验证同步结果

```bash
git log --oneline --decorate -5
git status
```

## 预期推送的提交

根据之前的操作，可能需要推送的提交包括：

1. 剧本页面滚动修复（SceneMapping, CharacterMapping, ItemMapping, ScriptManager）
2. 视觉提示词优化（scriptParser.ts）
3. README 更新（README.md）
4. 其他之前的修改

## 回滚准备

如果推送过程中出现问题：

```bash
# 查看本地提交历史，找到需要回滚的提交
git log --oneline

# 如果需要回滚到某个提交
git reset --soft HEAD~1  # 回滚最近一次提交，保留修改
# 或
git reset --hard <commit-hash>  # 回滚到指定提交
```

## 验证清单

- [ ] 本地提交已完整
- [ ] 网络连接正常
- [ ] 远程仓库可访问
- [ ] 推送成功无冲突
- [ ] GitHub 仓库显示最新提交
