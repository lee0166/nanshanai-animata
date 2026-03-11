# 开发规范指南

## 📋 项目概述

本项目是一个基于 React + TypeScript + Vite 的现代化前端应用，使用 HeroUI 组件库和 Tailwind CSS 进行样式设计。

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 📁 项目结构

```
├── components/          # React 组件
│   ├── __tests__/      # 组件测试
│   ├── ProjectDetail/  # 项目详情相关组件
│   └── ...
├── views/              # 页面视图
├── services/           # 业务逻辑服务
│   ├── __tests__/      # 服务测试
│   └── ...
├── contexts/           # React Context
├── types/              # TypeScript 类型定义
├── hooks/              # 自定义 Hooks
├── utils/              # 工具函数
├── test/               # 测试配置
├── .trae/              # AI 命令配置
│   ├── commands/       # 自然语言命令
│   └── rules/          # 项目规则
└── dist/               # 构建输出
```

## 📝 代码规范

### TypeScript 规范

#### 类型定义

```typescript
// ✅ 好的做法
interface User {
  id: string;
  name: string;
  email: string;
}

const getUser = (id: string): Promise<User> => {
  // ...
};

// ❌ 避免使用 any
const getUser = (id: any): any => {
  // ...
};
```

#### 函数定义

```typescript
// ✅ 使用箭头函数
const handleClick = (event: React.MouseEvent) => {
  // ...
};

// ✅ 使用函数声明
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
```

### React 规范

#### 组件定义

```typescript
// ✅ 使用函数组件
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  disabled = false
}) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};
```

#### Hooks 使用

```typescript
// ✅ 在组件顶部使用 Hooks
const Component: React.FC = () => {
  const [state, setState] = useState<string>('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 副作用逻辑
  }, [dependency]);

  return <div>Component</div>;
};

// ❌ 不要在条件语句中使用 Hooks
if (condition) {
  const [state, setState] = useState(''); // 错误！
}
```

### 样式规范

#### Tailwind CSS

```tsx
// ✅ 使用 Tailwind 类名
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  Content
</div>

// ✅ 条件类名
<div className={cn(
  "base-classes",
  isActive && "active-classes",
  isDisabled && "disabled-classes"
)}>
  Content
</div>
```

## 🧪 测试规范

### 单元测试

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('should render with label', () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button label="Click" onClick={handleClick} />);
    screen.getByText('Click').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### 测试文件位置

- 组件测试: `components/__tests__/ComponentName.test.tsx`
- 服务测试: `services/__tests__/serviceName.test.ts`
- Hook测试: `hooks/__tests__/useHookName.test.ts`

## 🎯 开发工作流

### 1. 代码提交前检查

```bash
# 运行所有检查
npm run lint
npm run type-check
npm test
```

### 2. 自然语言命令

在对话框中输入以下命令快速执行：

- `自动修复代码` - 自动修复ESLint问题
- `检查代码` - 检查代码规范
- `格式化代码` - 格式化代码
- `类型检查` - TypeScript类型检查
- `运行测试` - 运行单元测试

### 3. 提交规范

```bash
# 建议提交信息格式
type(scope): description

# 示例
feat(auth): add login functionality
fix(api): resolve data fetching issue
docs(readme): update installation guide
```

## 🔧 常用工具

### VS Code 插件推荐

- ESLint
- Prettier
- TypeScript Importer
- Tailwind CSS IntelliSense
- Vitest

### 调试技巧

```typescript
// 使用 console.log 调试
console.log('[ComponentName] state:', state);

// 使用 debugger
const handleClick = () => {
  debugger; // 在此处设置断点
  // ...
};
```

## 📚 最佳实践

### 性能优化

1. **使用 React.lazy 进行代码分割**

   ```typescript
   const Dashboard = lazy(() => import('./views/Dashboard'));
   ```

2. **使用 useMemo 缓存计算结果**

   ```typescript
   const filteredItems = useMemo(() => {
     return items.filter(item => item.active);
   }, [items]);
   ```

3. **使用 useCallback 缓存回调函数**
   ```typescript
   const handleClick = useCallback(() => {
     // ...
   }, [dependency]);
   ```

### 错误处理

```typescript
// ✅ 使用 try-catch
try {
  const data = await fetchData();
  setData(data);
} catch (error) {
  console.error('Failed to fetch data:', error);
  showToast('获取数据失败', 'error');
}

// ✅ 使用错误边界
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong.</div>;
    }
    return this.props.children;
  }
}
```

### 状态管理

```typescript
// ✅ 使用 Context 进行全局状态管理
const AppContext = createContext<AppState | null>(null);

export const AppProvider: React.FC = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// ✅ 使用自定义 Hook 访问 Context
export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
```

## 🐛 常见问题

### Q: TypeScript 编译错误

**A**: 运行 `npm run type-check` 查看错误信息，根据提示修复类型问题。

### Q: ESLint 错误

**A**: 运行 `npm run lint:fix` 自动修复大部分问题，剩余问题手动修复。

### Q: 测试失败

**A**: 运行 `npm test -- --run` 查看详细错误信息，检查测试用例和组件实现。

### Q: 构建失败

**A**: 检查是否有 TypeScript 错误或 ESLint 错误，确保所有检查通过后再构建。

## 📞 需要帮助？

1. 查看项目文档：`PROJECT_OPTIMIZATION_REPORT.md`
2. 查看类型定义：`types.ts`
3. 查看示例代码：`components/__tests__/`
4. 使用自然语言命令获取帮助

---

_最后更新: 2026-03-10_
