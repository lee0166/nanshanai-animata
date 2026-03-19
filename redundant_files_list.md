# 冗余文件清单

## 1. 备份文件

| 文件名 | 路径 | 原因 | 状态 |
|-------|------|------|------|
| `locales_backup.ts` | `d:\kemeng\locales_backup.ts` | 与 `locales.ts` 内容重复，且 `locales.ts` 已更新 | 冗余 |
| `backup.cjs` | `d:\kemeng\scripts\backup.cjs` | 备份脚本，可能与 `backup-system.js` 功能重复 | 可能冗余 |
| `backup-system.js` | `d:\kemeng\scripts\backup-system.js` | 备份脚本，可能与 `backup.cjs` 功能重复 | 可能冗余 |

## 2. 日志文件

未找到任何日志文件

## 3. 其他可能的冗余文件

| 文件名 | 路径 | 原因 | 状态 |
|-------|------|------|------|
| `ITEM_EXTRACTION_OPTIMIZATION_PENDING.md` | `d:\kemeng\ITEM_EXTRACTION_OPTIMIZATION_PENDING.md` | 优化待办文件，可能已完成 | 待确认 |
| `AI影视资产生成平台优化规划.md` | `d:\kemeng\AI影视资产生成平台优化规划.md` | 规划文档，可能已过时 | 待确认 |
| `AI视频资产生成平台优化方案.md` | `d:\kemeng\AI视频资产生成平台优化方案.md` | 优化方案文档，可能已过时 | 待确认 |

## 4. 核心文件检查

- `services/keyframe` 目录下的文件（KeyframeEngine.ts、KeyframeService.ts、VolcengineKeyframeAdapter.ts、index.ts）都是必要的核心文件，无冗余。
- `views/ShotManager.tsx` 是分镜管理页面的核心文件，无冗余。
- `services/utils/shotNumberGenerator.ts` 是分镜编号生成的核心工具，无冗余。

## 清理建议

1. **安全删除**：
   - `locales_backup.ts` - 确认 `locales.ts` 是最新版本后可以删除

2. **谨慎删除**：
   - `backup.cjs` 和 `backup-system.js` - 确认功能重复后可以删除其中一个

3. **保留但归档**：
   - 规划和优化文档 - 可以移至归档目录

## 清理流程

1. 确认 `locales.ts` 是最新版本
2. 检查备份脚本的功能是否重复
3. 执行安全删除
4. 验证项目功能正常
