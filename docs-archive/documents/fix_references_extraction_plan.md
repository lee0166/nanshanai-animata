# 修复参考影片/导演提取问题

## 问题分析

### 现象

截图显示视觉风格 Tab 中的"参考风格"部分显示"未明确提及"，没有显示参考影片和导演。

### 根本原因

**1. LLM 响应被截断**

- 视觉风格提取的响应长度：402 characters（过短）
- 响应内容被截断，导致 `references` 字段缺失
- 日志显示：`Response preview: ```json\n{\n  "artDirection": "都市情感电影感"...`（不完整）

**2. 数据结构问题**

- `GlobalContextExtractor.convertToMetadata` 从 `context.visual.references` 获取参考信息
- 但 `references` 是简单的字符串数组，没有区分影片和导演
- 代码通过字符串匹配（是否包含"导演"）来区分，不够准确

### 代码问题定位

**文件**: `services/parsing/GlobalContextExtractor.ts`

**问题1**: Prompt 中的 `references` 字段定义不够明确

```typescript
"references": ["参考影片1", "参考导演1", "参考影片2"]
```

这种格式让 LLM 难以区分影片和导演。

**问题2**: `convertToMetadata` 中的过滤逻辑不够健壮

```typescript
references: {
  films: context.visual.references.filter(r => !r.includes('导演')),
  directors: context.visual.references.filter(r => r.includes('导演')),
  artStyles: [],
}
```

如果 `references` 为空数组，结果也是空的。

## 修复方案

### 方案1：优化 Prompt（推荐）

修改视觉风格提取的 prompt，明确区分 `referenceFilms` 和 `referenceDirectors`：

```typescript
{
  "artDirection": "...",
  "artStyle": "...",
  // ... 其他字段
  "referenceFilms": ["影片1", "影片2"],
  "referenceDirectors": ["导演1", "导演2"]
}
```

### 方案2：增加重试机制

如果响应被截断（长度 < 500 characters），自动重试请求。

### 方案3：优化 convertToMetadata

增加空值检查，确保即使 `references` 为空也不会报错：

```typescript
references: {
  films: context.visual.references?.filter(r => !r.includes('导演')) || [],
  directors: context.visual.references?.filter(r => r.includes('导演')) || [],
  artStyles: [],
}
```

## 实施步骤

1. **修改 GlobalContextExtractor.ts**
   - [ ] 优化视觉风格提取的 prompt
   - [ ] 更新 `extractVisualContext` 方法解析新的字段
   - [ ] 更新 `convertToMetadata` 方法使用新的字段
   - [ ] 增加空值检查

2. **测试验证**
   - [ ] 运行单元测试
   - [ ] 手动测试剧本解析
   - [ ] 验证参考影片/导演正确显示

## 预期结果

- 参考影片和导演正确提取并显示
- 视觉风格 Tab 完整展示所有信息
