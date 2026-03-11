# 场景和物品图片上传功能实现计划

## 需求理解

### 背景

- 角色管理中的图片上传功能已实现并测试通过
- 需要在场景管理和物品管理中新增相同功能

### 目标

在以下组件中添加上传本地图片的功能：

1. **SceneDetail.tsx** - 场景详情页
2. **ItemDetail.tsx** - 物品详情页

### 功能要求

- 上传按钮位置：与角色管理一致，在"生成结果"标题右侧
- 展示方式：上传后的图片与AI生成图片一样展示
- 交互体验：与角色管理保持一致

---

## 实现方案

### 方案：复用角色管理的实现模式

参照 `CharacterDetail.tsx` 的实现，在 `SceneDetail.tsx` 和 `ItemDetail.tsx` 中添加相同的上传功能。

### 具体修改

#### 1. SceneDetail.tsx

**添加上传按钮**（在"生成结果"标题栏）：

```tsx
<div className="flex items-center gap-3">
  <Button
    size="sm"
    variant="flat"
    startContent={<Upload size={16} />}
    onPress={handleUploadImage}
    isDisabled={generating || isCheckingJobs}
  >
    上传图片
  </Button>
  <div className="px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800/50 text-xs font-bold text-slate-600 dark:text-slate-300">
    图片 ({asset.generatedImages?.length || 0})
  </div>
</div>
```

**实现 handleUploadImage 方法**：

```typescript
const handleUploadImage = async () => {
  if (!projectId) {
    showToast(t.errors.projectIdMissing, 'error');
    return;
  }

  try {
    // 1. 打开文件选择器
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Images',
          accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'] },
        },
      ],
      multiple: false,
    });

    const file = await fileHandle.getFile();

    // 2. 获取图片尺寸
    const bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;
    bitmap.close();

    // 3. 生成文件名和路径
    const ext = file.name.split('.').pop() || 'png';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const newFileName = `${timestamp}_${random}.${ext}`;
    const targetPath = `scenes/${newFileName}`; // 注意：scenes/ 目录

    // 4. 保存文件
    await storageService.saveBinaryFile(targetPath, file);

    // 5. 创建 GeneratedImage 对象
    const newImage: GeneratedImage = {
      id: crypto.randomUUID(),
      path: targetPath,
      prompt: 'User uploaded image',
      userPrompt: prompt,
      modelId: 'user-upload',
      modelConfigId: modelId,
      width,
      height,
      size: file.size,
      createdAt: Date.now(),
      metadata: {
        style,
        aspectRatio,
        resolution,
        generateCount: 1,
        guidanceScale,
        referenceImages,
      },
    };

    // 6. 更新 asset
    const updatedImages = [...(asset.generatedImages || []), newImage];
    const updated = {
      ...asset,
      generatedImages: updatedImages,
      currentImageId: newImage.id,
      filePath: newImage.path,
    };

    onUpdate(updated);
    showToast('图片上传成功', 'success');
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return;
    }
    console.error('Upload image failed:', error);
    showToast(error.message || '上传失败', 'error');
  }
};
```

#### 2. ItemDetail.tsx

与 SceneDetail.tsx 类似，只需将保存路径改为 `items/` 目录：

```typescript
const targetPath = `items/${newFileName}`; // 注意：items/ 目录
```

---

## 文件定位

| 文件                                             | 说明       |
| ------------------------------------------------ | ---------- |
| `components/ProjectDetail/Scene/SceneDetail.tsx` | 场景详情页 |
| `components/ProjectDetail/Item/ItemDetail.tsx`   | 物品详情页 |

---

## 调研确认

在实施前需要确认：

1. SceneDetail.tsx 和 ItemDetail.tsx 是否存在
2. 它们的组件结构是否与 CharacterDetail.tsx 类似
3. 是否已有 generatedImages 字段

## 实施步骤

1. **确认文件结构** - 查看 SceneDetail.tsx 和 ItemDetail.tsx
2. **修改 SceneDetail.tsx** - 添加上传按钮和方法
3. **修改 ItemDetail.tsx** - 添加上传按钮和方法
4. **验证测试** - 测试上传功能
