# 剧本管理页面"原文"显示分析

## 问题

小说上传后，大模型解析完，剧本管理页面显示的"原文"是：

- 上传后的原始文本？
- 还是经过清洗/解析后的文本？

## 分析结果

### 答案：显示的是**清洗后的文本**，不是原始文本

---

## 详细分析

### 1. 数据流追踪

```
用户上传文件
    ↓
file.text() 读取原始文本
    ↓
TextCleaner.process(rawText) ← 关键：这里进行了清洗
    ↓
cleanResult.cleanedText → scriptContent
    ↓
保存到 script.content
    ↓
页面显示 script.content
```

### 2. 关键代码位置

**ScriptManager.tsx 第221-256行**（上传处理）：

```typescript
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const rawText = await file.text(); // 1. 读取原始文本

    // 2. 检测文本编码问题
    const issues = TextCleaner.detectEncodingIssues(rawText);

    // 3. 清洗文本（关键步骤）
    const cleanResult = TextCleaner.process(rawText);

    // 4. 保存的是清洗后的文本
    setScriptContent(cleanResult.cleanedText);
  } catch (error: any) {
    showToast(`读取文件失败: ${error.message}`, 'error');
  }
};
```

### 3. 清洗操作内容

**TextCleaner.ts** 执行的清洗：

- ✅ 统一换行符（`\r\n`、\r`→`\n`）
- ✅ 去除控制字符
- ✅ 合并多余空行（3+个换行合并为2个）
- ✅ 去除行首行尾空白
- ✅ 统一空格（多个空格合并为1个）
- ✅ 去除全文首尾空白

### 4. 剧本管理页面显示

**ScriptManager.tsx 第886行**：

```tsx
<pre className="whitespace-pre-wrap font-mono text-sm text-default-700">
  {currentScript.content} ← 显示的是清洗后的 content
</pre>
```

### 5. Script 类型定义

**types.ts 第236-244行**：

```typescript
export interface Script {
  id: string;
  projectId: string;
  title: string;
  content: string; // ← 只有这个字段，没有 rawContent
  parseState: ScriptParseState;
  createdAt: number;
  updatedAt: number;
}
```

**关键发现**：Script 类型中**没有 `rawContent` 字段**，系统不会保留原始未清洗的文本。

---

## 结论

| 问题                           | 答案             |
| ------------------------------ | ---------------- |
| 剧本管理页面显示的是哪个版本？ | **清洗后的版本** |
| 原始上传的文本是否被保留？     | **否**           |
| 是否有原始文本备份？           | **否**           |
| 用户能否查看原始文本？         | **不能**         |

---

## 是否需要修改？

**当前行为**：用户上传的原始文本经过清洗后保存，原始文本不保留。

**如果需要保留原始文本**，需要：

1. 在 Script 类型中添加 `rawContent` 字段
2. 修改上传逻辑，同时保存原始文本和清洗后的文本
3. 在剧本管理页面提供切换查看功能

**建议**：

- 如果清洗操作对用户透明且无害（如只是统一换行符），当前行为可以接受
- 如果用户需要查看原始格式（如保留原始空行、特殊字符等），建议添加原始文本查看功能

---

_分析时间：2026-02-28_
