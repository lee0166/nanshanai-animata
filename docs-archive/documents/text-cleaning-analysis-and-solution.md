# 文本清洗问题深度分析与解决方案

## 一、问题确认

### 1.1 从控制台日志分析

**关键发现**：

```
[ScriptManager] Text cleaned: Object
```

**问题**：

- 日志显示清洗被调用，但发送给LLM的prompt中仍然包含特殊字符
- 原文：`阳光穿过初夏///的薄 雾洒在@￥%&花园的木椅上`
- 发送给LLM的内容：`阳光穿过初夏///的薄 雾洒在@￥%&花园的木椅上`（未清洗）

**结论**：清洗在文件上传时被调用，但**清洗后的文本没有被正确保存到数据库**。

### 1.2 "原文"标签显示内容确认

**代码位置**：`views/ScriptManager.tsx:899-901`

```tsx
<pre className="whitespace-pre-wrap font-mono text-sm text-default-700">
  {currentScript.content}
</pre>
```

**确认**：

- `currentScript.content` 是**存储在数据库中的剧本内容**
- 根据代码逻辑，这应该是**清洗后的文本**
- 但页面显示的是**原始未清洗文本**

**数据流分析**：

```
文件上传
  ↓
TextCleaner.process(rawText) → 清洗后的文本
  ↓
setScriptContent(cleanedText) → 保存到 state
  ↓
用户点击"导入"
  ↓
handleCreateScript() → content: scriptContent → 保存到数据库
  ↓
页面显示 currentScript.content
```

**问题定位**：

1. 清洗在文件上传时执行（`handleFileUpload`）
2. 清洗后的文本保存到 `scriptContent` state
3. 用户点击"导入"时，`handleCreateScript` 将 `scriptContent` 保存到数据库
4. **但如果用户没有点击"导入"，或者导入时使用的是原始文本，就会出问题**

### 1.3 根本原因

**问题1**：清洗后的文本没有被正确传递到数据库保存流程
**问题2**：`TextCleaner.clean()` 方法虽然代码正确，但浏览器可能加载的是旧版本
**问题3**：需要确认 `scriptContent` state 在保存时是否真的是清洗后的内容

---

## 二、解决方案

### 方案1：强制刷新浏览器（临时方案）

**操作**：

1. 按 `Ctrl+F5` 强制刷新页面（清除缓存）
2. 重新上传测试文件
3. 观察控制台日志

**预期效果**：

- 如果问题是浏览器缓存，此方案可以解决

---

### 方案2：在保存时再次清洗（保险方案）

**修改位置**：`views/ScriptManager.tsx` 的 `handleCreateScript` 方法

**修改内容**：

```typescript
const handleCreateScript = async () => {
  if (!scriptTitle || !scriptContent) {
    showToast('请填写标题和内容', 'warning');
    return;
  }

  try {
    // 确保文本已清洗（再次清洗以防万一）
    const cleanResult = TextCleaner.process(scriptContent);
    const finalContent = cleanResult.cleanedText;

    console.log('[ScriptManager] Creating script with cleaned content:', {
      originalLength: scriptContent.length,
      cleanedLength: finalContent.length,
      removedChars: scriptContent.length - finalContent.length,
    });

    const newScript: Script = {
      id: `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId: effectiveProjectId,
      title: scriptTitle,
      content: finalContent, // 使用清洗后的内容
      parseState: {
        stage: 'idle',
        progress: 0,
      },
    };

    await storageService.saveScript(newScript);

    // 刷新剧本列表
    await loadScripts();

    setCurrentScript(newScript);
    setIsUploadModalOpen(false);
    setScriptTitle('');
    setScriptContent('');
    showToast('剧本导入成功', 'success');
  } catch (error: any) {
    showToast(`保存失败: ${error.message}`, 'error');
  }
};
```

**预期效果**：

- 无论上传时是否清洗，保存时都会再次清洗
- 确保存入数据库的一定是清洗后的文本

---

### 方案3：添加调试日志（诊断方案）

**修改位置**：`views/ScriptManager.tsx`

**添加日志**：

```typescript
// 在 handleFileUpload 中
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const rawText = await file.text();

    console.log('[ScriptManager] Raw text sample:', rawText.substring(0, 100));

    // 检测文本编码问题
    const issues = TextCleaner.detectEncodingIssues(rawText);
    if (issues.length > 0) {
      console.log('[ScriptManager] Detected encoding issues:', issues);
    }

    // 清洗文本
    const cleanResult = TextCleaner.process(rawText);
    console.log('[ScriptManager] Clean result:', {
      originalLength: cleanResult.stats.originalLength,
      cleanedLength: cleanResult.stats.cleanedLength,
      removedChars: cleanResult.stats.removedChars,
      appliedRules: cleanResult.stats.appliedRules,
      sample: cleanResult.cleanedText.substring(0, 100),
    });

    setScriptContent(cleanResult.cleanedText);

    // 立即验证 state 是否更新
    setTimeout(() => {
      console.log('[ScriptManager] Verified scriptContent:', scriptContent.substring(0, 100));
    }, 0);

    // ... 其他代码
  } catch (error: any) {
    showToast(`读取文件失败: ${error.message}`, 'error');
  }
};

// 在 handleCreateScript 中
const handleCreateScript = async () => {
  console.log(
    '[ScriptManager] Creating script, scriptContent sample:',
    scriptContent.substring(0, 100)
  );

  // ... 其他代码
};
```

**预期效果**：

- 通过日志确认每个步骤的数据状态
- 定位问题具体出现在哪个环节

---

### 方案4：验证 TextCleaner 是否加载最新版本

**修改位置**：`services/textCleaner.ts`

**添加版本标识**：

```typescript
/**
 * 文本清洗服务
 * 版本: 2.0 - 2026-03-01
 * 更新: 新增11条清洗规则，支持行内特殊字符和乱码字符清除
 */

export class TextCleaner {
  static readonly VERSION = '2.0';
  static readonly LAST_UPDATED = '2026-03-01';

  // 在 clean 方法开头添加日志
  static clean(text: string, options: CleanOptions = {}): string {
    console.log(`[TextCleaner v${this.VERSION}] Starting clean, input length:`, text.length);

    // ... 原有代码

    const rules = options.customRules || DEFAULT_CLEANING_RULES;
    console.log(`[TextCleaner v${this.VERSION}] Applying ${rules.length} rules`);

    // ... 原有代码

    console.log(`[TextCleaner v${this.VERSION}] Clean complete, output length:`, cleaned.length);
    return cleaned;
  }
}
```

**预期效果**：

- 通过版本号确认浏览器加载的是最新代码
- 通过日志确认清洗规则数量

---

## 三、推荐执行顺序

### 第一步：验证版本（5分钟）

1. 添加版本标识到 `textCleaner.ts`
2. 刷新浏览器
3. 查看控制台是否显示 `TextCleaner v2.0`
4. **如果显示旧版本**，说明是缓存问题，执行强制刷新

### 第二步：添加调试日志（10分钟）

1. 在 `handleFileUpload` 和 `handleCreateScript` 中添加详细日志
2. 重新上传文件
3. 观察日志输出，确认数据流
4. **根据日志定位具体问题**

### 第三步：实施保险方案（10分钟）

1. 在 `handleCreateScript` 中添加再次清洗逻辑
2. 确保保存到数据库的一定是清洗后的内容
3. 测试验证

---

## 四、预期达到的效果

### 效果1：原文标签显示清洗后的文本

```
清洗前：阳光穿过初夏///的薄 雾洒在@￥%&花园的木椅上
清洗后：阳光穿过初夏的薄 雾洒在花园的木椅上
```

### 效果2：发送给LLM的prompt是清洗后的文本

```
【剧本内容】
阳光穿过初夏的薄
雾洒在花园的木椅上，柳唯穿着亮黄色蓬蓬裙从花园后门推门进来...
```

### 效果3：控制台日志显示清洗统计

```
[ScriptManager] Text cleaned: {
  originalLength: 91,
  cleanedLength: 68,
  removedChars: 23,
  appliedRules: ['inline_separator', 'garbled_chars', 'isolated_special_chars']
}
```

---

## 五、检查清单

- [ ] 浏览器控制台显示 `TextCleaner v2.0`
- [ ] 上传文件后控制台显示清洗统计
- [ ] "原文"标签显示清洗后的文本（无特殊字符）
- [ ] 发送给LLM的prompt是清洗后的文本
- [ ] 所有41个测试用例通过

---

_文档创建时间：2026-03-01_
_问题状态：待验证_
