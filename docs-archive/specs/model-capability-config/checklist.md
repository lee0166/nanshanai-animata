# Checklist

## 类型定义

- [ ] ModelCapabilities 接口包含 supportsReferenceImage 字段
- [ ] ModelCapabilities 接口包含 maxReferenceImages 字段
- [ ] ModelConfig 类型正确引用 ModelCapabilities

## 添加模型功能

- [ ] 自定义模型表单显示"支持参考图生图" Switch
- [ ] Switch 可以正常切换
- [ ] 开启后显示"最大参考图数量"输入框
- [ ] 保存后模型数据包含正确的 capabilities

## 编辑模型功能

- [ ] 编辑对话框显示能力编辑选项
- [ ] 可以修改"支持参考图生图"设置
- [ ] 可以修改"最大参考图数量"
- [ ] 保存后更新模型配置

## 模型列表显示

- [ ] 模型列表显示"能力"列
- [ ] 支持参考图的模型显示对应标识（如 Chip）
- [ ] 不支持参考图的模型显示对应标识
- [ ] 视觉区分清晰

## 关键帧生图面板

- [ ] 使用 model.capabilities 进行过滤
- [ ] 文生图模式只显示 supportsReferenceImage: false 的模型
- [ ] 参考图生图模式只显示 supportsReferenceImage: true 的模型
- [ ] 切换模式时模型列表正确更新

## 向后兼容

- [ ] 现有模型可以继续使用
- [ ] 未配置能力的模型默认支持参考图
- [ ] 不影响其他功能
