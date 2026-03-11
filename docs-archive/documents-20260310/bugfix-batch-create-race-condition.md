# 批量创建竞态条件 Bug 修复方案

## 问题描述

**现象**：批量创建角色/场景/物品后，只有最后一个创建的资产显示"已关联"，其他的仍然显示"创建"按钮，可以二次创建。

**根本原因**：`Promise.all` 并发执行多个创建操作时，每个操作都会调用 `onCharactersUpdate(updated)`，但 `updated` 都是基于**旧的** `scriptCharacters` 状态计算的，导致后面的更新覆盖前面的更新。

## 代码分析

### 当前有问题的代码（CharacterMapping.tsx）

```typescript
// 批量创建
Promise.all(unmapped.map(c => handleCreateCharacter(c)));

// handleCreateCharacter 内部
const handleCreateCharacter = async (scriptChar: ScriptCharacter) => {
  // ... 创建资产 ...

  // 问题：这里的 scriptCharacters 是闭包中的旧值
  const updated = scriptCharacters.map(c =>
    c.name === scriptChar.name ? { ...c, mappedAssetId: newCharacter.id } : c
  );
  onCharactersUpdate(updated); // 后面的调用会覆盖前面的
};
```

### 时序问题演示

假设要创建角色A、B、C：

```
时间线：
T0: scriptCharacters = [A, B, C] (都没有 mappedAssetId)

T1: 开始创建A
    updatedA = [A(mapped), B, C]
    onCharactersUpdate(updatedA)

T2: 开始创建B (此时 scriptCharacters 还是 [A, B, C])
    updatedB = [A, B(mapped), C]
    onCharactersUpdate(updatedB)  // 覆盖了A的更新！

T3: 开始创建C (此时 scriptCharacters 还是 [A, B, C])
    updatedC = [A, B, C(mapped)]
    onCharactersUpdate(updatedC)  // 覆盖了A和B的更新！

最终结果：只有C有 mappedAssetId，A和B的更新丢失了
```

## 修复方案

### 方案1：批量创建完成后统一更新（推荐）

修改批量创建逻辑，收集所有创建结果后一次性更新：

```typescript
// 修改批量创建按钮的 onPress
onPress={async () => {
  const unmapped = scriptCharacters.filter(c => !c.mappedAssetId);
  if (unmapped.length === 0) {
    showToast('所有角色已关联', 'info');
    return;
  }

  // 串行创建，避免竞态条件
  const createdMappings: { name: string; assetId: string }[] = [];

  for (const char of unmapped) {
    try {
      const assetId = await createCharacterAsset(char); // 只创建，不更新状态
      createdMappings.push({ name: char.name, assetId });
    } catch (error) {
      console.error(`创建角色 ${char.name} 失败:`, error);
    }
  }

  // 一次性更新所有状态
  const updated = scriptCharacters.map(c => {
    const mapping = createdMappings.find(m => m.name === c.name);
    return mapping ? { ...c, mappedAssetId: mapping.assetId } : c;
  });

  onCharactersUpdate(updated);
  showToast(`成功创建 ${createdMappings.length} 个角色`, 'success');
}}
```

### 方案2：使用函数式更新

如果必须并行创建，可以使用函数式更新确保基于最新状态：

```typescript
// 修改 onCharactersUpdate 调用方式
// 父组件需要提供函数式更新支持
onCharactersUpdate(prev => {
  return prev.map(c => (c.name === scriptChar.name ? { ...c, mappedAssetId: newCharacter.id } : c));
});
```

但这需要修改父组件的接口，影响范围较大。

### 方案3：使用 ref 保存最新状态

在组件内部使用 ref 来跟踪最新的 scriptCharacters：

```typescript
const charactersRef = useRef(scriptCharacters);
charactersRef.current = scriptCharacters;

const handleCreateCharacter = async (scriptChar: ScriptCharacter) => {
  // ... 创建资产 ...

  // 使用 ref 获取最新状态
  const updated = charactersRef.current.map(c =>
    c.name === scriptChar.name ? { ...c, mappedAssetId: newCharacter.id } : c
  );
  onCharactersUpdate(updated);
};
```

## 实施计划

### 需要修改的文件

1. **CharacterMapping.tsx**
   - 修改批量创建按钮逻辑
   - 提取创建逻辑为独立函数

2. **SceneMapping.tsx**
   - 同上

3. **ItemMapping.tsx**
   - 同上

### 实施步骤

1. 创建新的批量创建函数 `handleBatchCreate`
2. 修改 `handleCreateCharacter`，添加 `skipStateUpdate` 参数
3. 创建独立的资产创建函数 `createCharacterAsset`
4. 更新批量创建按钮的 onPress
5. 测试验证

## 预期效果

修复后：

- 批量创建所有角色后，所有角色的"创建"按钮都应该消失
- 所有角色都显示"已关联" Chip
- 不会重复创建

## 风险评估

| 风险         | 可能性 | 影响 | 缓解措施               |
| ------------ | ------ | ---- | ---------------------- |
| 串行创建变慢 | 中     | 低   | 添加加载状态提示用户   |
| 部分创建失败 | 低     | 中   | 错误处理，继续创建其他 |
| 状态更新延迟 | 低     | 低   | 一次性更新，性能更好   |

---

_分析时间：2026-02-28_
_问题：批量创建竞态条件_
