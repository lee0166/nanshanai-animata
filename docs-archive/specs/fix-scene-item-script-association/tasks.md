# Tasks

- [ ] Task 1: 修复 SceneMapping.tsx
  - [ ] SubTask 1.1: 在 interface SceneMappingProps 中添加 scriptId: string
  - [ ] SubTask 1.2: 在 handleCreateScene 函数中添加 scriptId 到 newScene 对象
  - [ ] SubTask 1.3: 从 props 中解构 scriptId

- [ ] Task 2: 修复 ItemMapping.tsx
  - [ ] SubTask 2.1: 在 interface ItemMappingProps 中添加 scriptId: string
  - [ ] SubTask 2.2: 在 handleCreateItem 函数中添加 scriptId 到 newItem 对象
  - [ ] SubTask 2.3: 从 props 中解构 scriptId

- [ ] Task 3: 修复 ScriptParser 父组件
  - [ ] SubTask 3.1: 找到 ScriptParser 父组件（可能是 index.tsx）
  - [ ] SubTask 3.2: 传递 scriptId prop 给 SceneMapping 组件
  - [ ] SubTask 3.3: 传递 scriptId prop 给 ItemMapping 组件

- [ ] Task 4: 测试验证
  - [ ] SubTask 4.1: 从剧本解析页面创建场景，检查是否正确关联剧本
  - [ ] SubTask 4.2: 从剧本解析页面创建物品，检查是否正确关联剧本
  - [ ] SubTask 4.3: 在场景/物品管理页面按剧本筛选，验证新创建资产显示正常

# Task Dependencies

- Task 3 depends on Task 1, Task 2（需要先修复子组件）
- Task 4 depends on Task 3（需要父组件传递 props 后才能测试）
