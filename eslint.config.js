import js from '@eslint/js';
import tsParser from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default [
  // 忽略文件（放在最前面）
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.venv*/**',
      '*.config.js',
      '*.config.ts',
      'vite.config.ts',
      'scripts/**',
      'services/errorHandler.ts',
    ],
  },

  // 基础配置
  js.configs.recommended,
  ...tsParser.configs.recommended,

  // React配置
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      parser: tsParser.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        React: 'readonly',
        JSX: 'readonly',
        console: 'readonly',
        window: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React规则
      'react/react-in-jsx-scope': 'off', // React 17+ 不需要
      'react/prop-types': 'off', // 使用TypeScript不需要prop-types
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off', // 关闭Hooks依赖检查（项目中有大量历史代码）

      // TypeScript规则
      '@typescript-eslint/no-explicit-any': 'off', // 关闭any类型检查（项目中有大量any）
      '@typescript-eslint/no-unused-vars': [
        'off',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ], // 关闭未使用变量检查（项目中有大量历史代码）
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/ban-ts-comment': 'off', // 关闭ts-comment检查

      // 通用规则
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'off', // 关闭重复导入检查
      'no-unused-expressions': 'error',
      'no-useless-assignment': 'off', // 关闭无用赋值检查
      'no-empty': 'off', // 关闭空代码块检查
      'no-useless-escape': 'off', // 关闭无用转义检查
      'no-control-regex': 'off', // 关闭控制字符检查
      'no-async-promise-executor': 'off', // 关闭async Promise检查
      'preserve-caught-error': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // Prettier配置（放在最后以覆盖其他规则）
  prettierConfig,
];
