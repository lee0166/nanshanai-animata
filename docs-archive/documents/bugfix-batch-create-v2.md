# 批量创建竞态条件 Bug 修复方案 V2

## 问题分析

**用户反馈**：修复后问题依旧存在，批量创建后仍然只有最后一个角色的创建按钮消失。

**根本原因**：我的修复没有解决根本问题。

在 `handleBatchCreateCharacters` 中：

```typescript
for (const char of unmapped) {
  const assetId = await handleCreateCharacter(char); // 这里已经更新了状态！
  // ...
}
```

`handleCreateCharacter` 内部调用了 `onCharactersUpdate(updated)`，这意味着：

1. 第一个角色创建完成 → 更新状态 → 组件重新渲染
2. 第二个角色创建完成 → 但 `scriptCharacters` 可能还是旧的（闭包问题）
3. 结果：后面的更新覆盖了前面的

## 正确的修复方案

### 方案：分离创建逻辑和状态更新

**核心思想**：

1. 提取纯创建逻辑（只创建资产，不更新状态）
2. 批量创建时只调用纯创建逻辑
3. 批量创建完成后，统一更新所有状态

### 代码实现

```typescript
// 1. 纯创建逻辑（不更新状态）
const createCharacterAsset = async (scriptChar: ScriptCharacter): Promise<string> => {
  const generatedPrompt = CharacterPromptBuilder.build(scriptChar);

  const newCharacter: CharacterAsset = {
    id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    projectId,
    scriptId,
    type: AssetType.CHARACTER,
    name: scriptChar.name,
    prompt: generatedPrompt,
    gender:
      scriptChar.gender === 'male' || scriptChar.gender === 'female'
        ? scriptChar.gender
        : 'unlimited',
    ageGroup: mapAgeToGroup(scriptChar.age),
    metadata: {
      scriptDescription: JSON.stringify(scriptChar.appearance),
      personality: scriptChar.personality,
      signatureItems: scriptChar.signatureItems,
      emotionalArc: scriptChar.emotionalArc,
      relationships: scriptChar.relationships,
      visualPrompt: scriptChar.visualPrompt,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await storageService.saveAsset(newCharacter);
  return newCharacter.id; // 只返回ID，不更新状态
};

// 2. 单个创建（使用纯创建逻辑 + 更新状态）
const handleCreateCharacter = async (scriptChar: ScriptCharacter) => {
  try {
    const assetId = await createCharacterAsset(scriptChar);

    // 更新状态
    const updated = scriptCharacters.map(c =>
      c.name === scriptChar.name ? { ...c, mappedAssetId: assetId } : c
    );
    onCharactersUpdate(updated);
    onCharacterCreated?.();

    showToast(`角色 "${scriptChar.name}" 创建成功`, 'success');
  } catch (error: any) {
    showToast(`创建失败: ${error.message}`, 'error');
  }
};

// 3. 批量创建（使用纯创建逻辑 + 统一更新状态）
const handleBatchCreateCharacters = async () => {
  const unmapped = scriptCharacters.filter(c => !c.mappedAssetId);
  if (unmapped.length === 0) {
    showToast('所有角色已关联', 'info');
    return;
  }

  setIsGenerating(true);
  const createdMappings: { name: string; assetId: string }[] = [];
  const failedCharacters: string[] = [];

  try {
    // 串行创建资产（不更新状态）
    for (const char of unmapped) {
      try {
        const assetId = await createCharacterAsset(char); // 只创建，不更新状态
        createdMappings.push({ name: char.name, assetId });
      } catch (error) {
        console.error(`[CharacterMapping] 创建角色 ${char.name} 失败:`, error);
        failedCharacters.push(char.name);
      }
    }

    // 统一更新所有状态（一次性）
    if (createdMappings.length > 0) {
      const updated = scriptCharacters.map(c => {
        const mapping = createdMappings.find(m => m.name === c.name);
        return mapping ? { ...c, mappedAssetId: mapping.assetId } : c;
      });
      onCharactersUpdate(updated); // 只更新一次
      onCharacterCreated?.();

      if (failedCharacters.length > 0) {
        showToast(
          `成功创建 ${createdMappings.length} 个角色，${failedCharacters.length} 个失败`,
          'warning'
        );
      } else {
        showToast(`成功创建 ${createdMappings.length} 个角色`, 'success');
      }
    } else {
      showToast('创建失败，请重试', 'error');
    }
  } finally {
    setIsGenerating(false);
  }
};
```

## 关键区别

| 方面         | 之前的修复                    | 正确的修复                   |
| ------------ | ----------------------------- | ---------------------------- |
| 批量创建调用 | `handleCreateCharacter(char)` | `createCharacterAsset(char)` |
| 状态更新次数 | 每个角色都更新                | 只更新一次                   |
| 竞态条件     | 仍然存在                      | 彻底解决                     |

## 实施计划

### 需要修改的文件

1. **CharacterMapping.tsx**
   - 提取 `createCharacterAsset` 函数
   - 修改 `handleCreateCharacter` 使用新函数
   - 修改 `handleBatchCreateCharacters` 使用新函数

2. **SceneMapping.tsx**
   - 同上

3. **ItemMapping.tsx**
   - 同上

## 验证方法

修复后，在浏览器控制台查看：

1. 点击批量创建
2. 观察 `onCharactersUpdate` 被调用的次数（应该只调用一次）
3. 所有角色的创建按钮都应该消失

---

_分析时间：2026-02-28_
_问题：批量创建竞态条件 V2_
