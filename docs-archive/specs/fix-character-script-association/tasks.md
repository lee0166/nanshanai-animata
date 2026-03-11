# Tasks

- [ ] Task 1: 深度排查角色剧本关联显示问题
  - [ ] SubTask 1.1: 检查剧本列表是否正确加载
  - [ ] SubTask 1.2: 检查 scripts.find() 匹配逻辑
  - [ ] SubTask 1.3: 检查 ID 类型是否匹配
  - [ ] SubTask 1.4: 检查 React 渲染时机

- [ ] Task 2: 修复显示问题
  - [ ] SubTask 2.1: 根据排查结果修复代码
  - [ ] SubTask 2.2: 确保角色正确显示剧本名称
  - [ ] SubTask 2.3: 确保剧本筛选器正常工作

- [ ] Task 3: 测试验证
  - [ ] SubTask 3.1: 测试新创建角色显示剧本名称
  - [ ] SubTask 3.2: 测试剧本筛选器筛选角色
  - [ ] SubTask 3.3: 测试老角色显示"未分类"

# Task Dependencies

- Task 2 depends on Task 1（需要先排查出问题根因）
- Task 3 depends on Task 2（需要修复完成后测试）
