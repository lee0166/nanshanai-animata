# Checklist

## 代码修复

- [ ] SceneMappingProps interface 包含 scriptId: string
- [ ] SceneMapping 组件从 props 解构 scriptId
- [ ] handleCreateScene 函数传入 scriptId 到 newScene
- [ ] ItemMappingProps interface 包含 scriptId: string
- [ ] ItemMapping 组件从 props 解构 scriptId
- [ ] handleCreateItem 函数传入 scriptId 到 newItem
- [ ] ScriptParser 父组件传递 scriptId 给 SceneMapping
- [ ] ScriptParser 父组件传递 scriptId 给 ItemMapping

## 功能验证

- [ ] 从剧本解析页面创建场景，scene.scriptId 正确保存
- [ ] 从剧本解析页面创建物品，item.scriptId 正确保存
- [ ] 场景管理页面按剧本筛选显示正确
- [ ] 物品管理页面按剧本筛选显示正确
- [ ] 老场景/物品（无 scriptId）在"未分类"中显示
