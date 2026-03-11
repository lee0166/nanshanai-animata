# Tasks

- [x] Task 1: 在 ProjectDetail.tsx 添加角色剧本筛选状态
  - [x] SubTask 1.1: 添加 `characterScriptFilter` 状态
  - [x] SubTask 1.2: 加载剧本列表供筛选器使用
  - [x] SubTask 1.3: 将筛选状态和剧本列表传递给子组件

- [x] Task 2: 修改 AssetList.tsx 添加剧本筛选功能
  - [x] SubTask 2.1: 接收 `scriptFilter` 和 `scripts` props
  - [x] SubTask 2.2: 在头部添加剧本筛选器UI
  - [x] SubTask 2.3: 实现按剧本筛选角色的逻辑
  - [x] SubTask 2.4: 只在角色类型时显示筛选器

- [x] Task 3: 修改 CharacterSidebar.tsx 使用外部筛选状态
  - [x] SubTask 3.1: 接收 `externalScriptFilter` 和 `scripts` props
  - [x] SubTask 3.2: 移除内部的筛选器和剧本加载逻辑
  - [x] SubTask 3.3: 使用外部传入的筛选状态过滤角色

- [x] Task 4: 测试验证
  - [x] SubTask 4.1: 测试筛选器在角色管理页面显示
  - [x] SubTask 4.2: 测试左侧卡片区域按剧本筛选
  - [x] SubTask 4.3: 测试右侧列表同步更新
  - [x] SubTask 4.4: 测试其他资产类型不受影响

# Task Dependencies

- Task 2 depends on Task 1（需要先有筛选状态）
- Task 3 depends on Task 1（需要使用外部筛选状态）
- Task 4 depends on Task 2, Task 3（需要功能完成后测试）
