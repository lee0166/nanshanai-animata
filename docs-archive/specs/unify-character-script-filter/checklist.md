# Checklist

## 功能实现

- [x] ProjectDetail.tsx 管理 `characterScriptFilter` 状态
- [x] ProjectDetail.tsx 加载剧本列表
- [x] AssetList.tsx 显示剧本筛选器（只在角色页面）
- [x] AssetList.tsx 按剧本筛选角色卡片
- [x] CharacterSidebar.tsx 使用外部筛选状态
- [x] 左右两侧筛选同步

## UI/UX

- [x] 筛选器位置在"角色管理"标题旁
- [x] 筛选器选项正确（全部/未分类/各剧本）
- [x] 不影响其他资产类型页面布局
- [x] 筛选器样式与现有UI一致

## 测试验证

- [x] 选择剧本后左侧卡片正确过滤
- [x] 选择剧本后右侧列表同步更新
- [x] "全部剧本"显示所有角色
- [x] "未分类"只显示无剧本角色
- [x] 场景/物品页面不受影响
- [x] 页面刷新后筛选状态保持
