# WelcomeView 光线扫过动画实现计划

## 需求

- 在欢迎页面使用项目图标 `/icon.png` 替换原有的 Sparkles 图标
- 添加单纯的光线扫过效果
- 动画循环时间：6秒

## 实现方案

### 1. 修改文件

**目标文件**: `d:\kemeng\components\WelcomeView.tsx`

### 2. 具体修改内容

#### 2.1 替换图标部分

将原来的：

```tsx
<div className="mb-12 mt-20 p-8 bg-primary/10 rounded-[3rem] animate-pulse">
  <Sparkles className="w-20 h-20 text-primary" />
</div>
```

替换为：

```tsx
<div className="mb-12 mt-20 p-8 bg-primary/10 rounded-[3rem] relative overflow-hidden">
  <div className="absolute inset-0 animate-[shimmer_6s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12"></div>
  <img src="/icon.png" className="w-20 h-20 object-contain relative z-10" alt="Logo" />
</div>
```

#### 2.2 可选：移除未使用的 Sparkles 导入

如果 Sparkles 图标只在被替换的位置使用，可以同时移除导入语句中的 `Sparkles`。

### 3. 动画说明

- **动画类型**: 光线从左到右扫过
- **持续时间**: 6秒（用户指定）
- **循环**: 无限循环
- **效果**: 半透明白色光线以倾斜角度划过图标
- **使用 Tailwind 内置动画**: 通过 `animate-[shimmer_6s_infinite]` 使用任意值语法，无需修改 tailwind.config.js

### 4. 视觉效果

- 外层保持原有的圆角背景（`rounded-[3rem]`）
- 添加相对定位容器（`relative`）
- 光线层绝对定位覆盖整个区域（`absolute inset-0`）
- 图标在光线层之上（`relative z-10`）
- 防止光线溢出（`overflow-hidden`）

## 验证步骤

1. 保存文件后，开发服务器会自动热更新
2. 查看欢迎页面图标是否有光线扫过效果
3. 确认动画循环周期为6秒
