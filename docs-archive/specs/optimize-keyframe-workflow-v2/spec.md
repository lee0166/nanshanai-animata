# 分镜关键帧拆分优化 Spec V2（基于现状的最小化方案）

## Why

当前 `KeyframeEngine` 的提示词过于简单，导致：

1. LLM自由发挥，关键帧缺乏影视叙事逻辑
2. 运镜信息（推/拉/摇/移）没有被有效利用
3. 生成的关键帧之间缺乏连贯性

## What Changes（最小化修改）

### 核心修改点

只修改 **一个文件**：`services/keyframe/KeyframeEngine.ts`

修改 **一个方法**：`buildSplitPrompt()`

### 修改内容

1. **增强提示词模板** - 在原有提示词基础上，根据 `cameraMovement` 添加特定指导
2. **增加叙事结构指导** - 明确关键帧的叙事功能（起点/顶点/终点）
3. **增加连贯性约束** - 要求关键帧之间保持角色姿态的渐进变化

### 保持不变的参数

- ✅ `KeyframeSplitParams` 接口不变
- ✅ `KeyframeSplitResult` 接口不变
- ✅ `splitKeyframes()` 方法签名不变
- ✅ `parseKeyframesFromResponse()` 方法不变
- ✅ `generateDefaultKeyframes()` 方法不变
- ✅ 前端 ShotList.tsx 不变
- ✅ 前端 ShotManager.tsx 不变
- ✅ types.ts 中 Shot/Keyframe 类型不变

## ADDED Requirements

### Requirement: 运镜感知提示词

The system SHALL generate different prompts based on cameraMovement type.

#### Scenario: 固定镜头（static）

- **GIVEN** shot.cameraMovement = 'static'
- **WHEN** 构建提示词时
- **THEN** 应该强调角色动作的变化，保持画面构图稳定

#### Scenario: 推镜头（push）

- **GIVEN** shot.cameraMovement = 'push'
- **WHEN** 构建提示词时
- **THEN** 应该强调景别从大到小的变化（远景→中景→特写）

#### Scenario: 拉镜头（pull）

- **GIVEN** shot.cameraMovement = 'pull'
- **WHEN** 构建提示词时
- **THEN** 应该强调景别从小到大的变化（特写→中景→远景）

#### Scenario: 摇镜头（pan）

- **GIVEN** shot.cameraMovement = 'pan'
- **WHEN** 构建提示词时
- **THEN** 应该强调画面内容的水平移动

#### Scenario: 移镜头（track）

- **GIVEN** shot.cameraMovement = 'track'
- **WHEN** 构建提示词时
- **THEN** 应该强调空间位置的变化

### Requirement: 叙事结构指导

The system SHALL guide LLM to generate keyframes with narrative structure.

#### Scenario: 3个关键帧

- **GIVEN** keyframeCount = 3
- **WHEN** 构建提示词时
- **THEN** 应该指导生成：动作起点（40%时长）→ 动作顶点/转折（30%时长）→ 动作终点（30%时长）

#### Scenario: 4个关键帧

- **GIVEN** keyframeCount = 4
- **WHEN** 构建提示词时
- **THEN** 应该指导生成：起点（30%）→ 发展（25%）→ 顶点（25%）→ 终点（20%）

### Requirement: 连贯性约束

The system SHALL require gradual pose changes between keyframes.

#### Scenario: 姿态连贯

- **GIVEN** 生成多个关键帧
- **WHEN** 构建提示词时
- **THEN** 应该要求：相邻关键帧的角色姿态变化应该是渐进的，避免大幅度跳跃

## MODIFIED Requirements

### Requirement: 关键帧拆分提示词构建

**原实现**（第52-101行）：

```typescript
private buildSplitPrompt(params: KeyframeSplitParams): string {
  // 简单的字符串拼接
  return `你是一位专业的电影分镜师...
【分镜信息】
- 场景：${sceneDesc}
- 景别：${shot.shotType}
- 运镜：${shot.cameraMovement}
...`;
}
```

**修改后**：

```typescript
private buildSplitPrompt(params: KeyframeSplitParams): string {
  // 1. 根据 cameraMovement 获取特定指导
  const movementGuidance = this.getMovementGuidance(shot.cameraMovement);

  // 2. 根据 keyframeCount 获取叙事结构指导
  const narrativeStructure = this.getNarrativeStructure(keyframeCount, shot.duration);

  // 3. 构建增强版提示词
  return `你是一位专业的电影分镜师...

【运镜指导】
${movementGuidance}

【叙事结构】
${narrativeStructure}

【连贯性要求】
相邻关键帧的角色姿态变化应该是渐进的...

【分镜信息】
...`;
}
```

## 新增方法（私有方法，不暴露接口）

### getMovementGuidance()

```typescript
private getMovementGuidance(movement: CameraMovement): string {
  const guidanceMap: Record<CameraMovement, string> = {
    static: '固定镜头：关键帧应该体现角色动作的变化，保持画面构图稳定。',
    push: '推镜头：关键帧应该体现景别从大到小的变化。第1帧用较大景别（能看到角色全身），第2帧中等景别（腰部以上），第3帧特写（脸部表情）。',
    pull: '拉镜头：关键帧应该体现景别从小到大的变化。第1帧特写（脸部表情），第2帧中等景别（腰部以上），第3帧较大景别（能看到角色全身）。',
    pan: '摇镜头：关键帧应该体现画面内容的水平移动。第1帧画面左侧内容，第2帧画面中央内容，第3帧画面右侧内容。',
    tilt: '升降镜头：关键帧应该体现画面内容的垂直移动。',
    track: '移镜头：关键帧应该体现空间位置的变化。第1帧角色在画面一侧，第2帧角色在画面中央，第3帧角色在画面另一侧。',
    crane: '升降镜头：关键帧应该体现大范围的视角变化。'
  };

  return guidanceMap[movement] || guidanceMap.static;
}
```

### getNarrativeStructure()

```typescript
private getNarrativeStructure(count: number, duration: number): string {
  if (count === 2) {
    return `生成2个关键帧：
- 第1帧（动作起点）：${Math.ceil(duration * 0.5)}秒，建立初始姿态
- 第2帧（动作终点）：${Math.ceil(duration * 0.5)}秒，展示最终姿态`;
  }

  if (count === 3) {
    return `生成3个关键帧：
- 第1帧（动作起点）：${Math.ceil(duration * 0.4)}秒，建立初始姿态
- 第2帧（动作顶点/转折）：${Math.ceil(duration * 0.3)}秒，展示最激烈的瞬间或转折点
- 第3帧（动作终点）：${Math.ceil(duration * 0.3)}秒，展示最终稳定姿态`;
  }

  if (count === 4) {
    return `生成4个关键帧：
- 第1帧（动作起点）：${Math.ceil(duration * 0.3)}秒，建立初始姿态
- 第2帧（动作发展）：${Math.ceil(duration * 0.25)}秒，展示动作发展
- 第3帧（动作顶点）：${Math.ceil(duration * 0.25)}秒，展示最激烈的瞬间
- 第4帧（动作终点）：${Math.ceil(duration * 0.2)}秒，展示最终稳定姿态`;
  }

  return '';
}
```

## 技术实现细节

### 修改范围

只修改 `services/keyframe/KeyframeEngine.ts` 文件：

1. **新增** `getMovementGuidance()` 私有方法（约20行）
2. **新增** `getNarrativeStructure()` 私有方法（约25行）
3. **修改** `buildSplitPrompt()` 方法（约30行修改）

**总修改量**：约75行代码

### 向后兼容性

- ✅ 所有接口不变
- ✅ 所有类型不变
- ✅ 前端代码无需修改
- ✅ 原有功能不受影响
- ✅ 如果新提示词效果不佳，可以回退到旧版本

### 回退方案

如果优化后的效果不理想，只需恢复 `buildSplitPrompt()` 方法的原始实现即可。

## 预期效果

### 优化前

```
提示词：你是一位专业的电影分镜师...
【分镜信息】
- 运镜：push
...
【拆分要求】
1. 按动作时间线排序（起始→过渡→结束）
```

**问题**：LLM不知道"推镜头"意味着什么，可能生成3张同一景别的图。

### 优化后

```
提示词：你是一位专业的电影分镜师...

【运镜指导】
推镜头：关键帧应该体现景别从大到小的变化。第1帧用较大景别（能看到角色全身），第2帧中等景别（腰部以上），第3帧特写（脸部表情）。

【叙事结构】
生成3个关键帧：
- 第1帧（动作起点）：2秒，建立初始姿态
- 第2帧（动作顶点/转折）：1.5秒，展示最激烈的瞬间或转折点
- 第3帧（动作终点）：1.5秒，展示最终稳定姿态

【连贯性要求】
相邻关键帧的角色姿态变化应该是渐进的...

【分镜信息】
- 运镜：push
...
```

**效果**：LLM明确知道要生成"远景→中景→特写"的推镜头效果。

## 验收标准

### 功能验证

- [ ] 固定镜头提示词包含"保持画面构图稳定"
- [ ] 推镜头提示词包含"景别从大到小"
- [ ] 拉镜头提示词包含"景别从小到大"
- [ ] 3个关键帧的提示词包含"动作起点/顶点/终点"
- [ ] 4个关键帧的提示词包含"动作起点/发展/顶点/终点"

### 兼容性验证

- [ ] KeyframeEngine 接口不变
- [ ] 原有测试用例通过
- [ ] 前端无需修改

### 效果验证

- [ ] 推镜头生成的关键帧体现景别变化
- [ ] 关键帧之间有叙事逻辑（起点→顶点→终点）
