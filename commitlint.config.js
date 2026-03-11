module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // 新功能
        'fix', // 修复bug
        'docs', // 文档更新
        'style', // 代码格式
        'refactor', // 重构
        'test', // 测试
        'chore', // 构建/工具
        'ci', // CI配置
        'build', // 构建系统
        'perf', // 性能优化
        'revert', // 回滚
      ],
    ],
    'subject-full-stop': [0, 'never'],
    'subject-case': [0, 'never'],
  },
};
