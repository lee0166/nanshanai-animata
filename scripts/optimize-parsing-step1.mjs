#!/usr/bin/env node

/**
 * 小说解析优化 - 第一阶段启动脚本
 * 用途：一键安装依赖并创建基础文件结构
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('==============================================');
console.log('  小说解析优化 - 第一阶段');
console.log('  目标：集成结构化输出');
console.log('==============================================\n');

// 步骤1：检查当前目录
console.log('[1/5] 检查项目目录...');
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ 错误：请在项目根目录运行此脚本');
  process.exit(1);
}
console.log('✅ 项目目录确认\n');

// 步骤2：安装Zod
console.log('[2/5] 安装 Zod 依赖...');
try {
  execSync('npm install zod', { stdio: 'inherit' });
  console.log('✅ Zod 安装成功\n');
} catch (e) {
  console.error('❌ Zod 安装失败:', e.message);
  process.exit(1);
}

// 步骤3：创建 ParsingSchemas.ts 基础结构
console.log('[3/5] 创建 ParsingSchemas.ts 文件...');
const schemasDir = path.join(process.cwd(), 'services', 'parsing');
if (!fs.existsSync(schemasDir)) {
  fs.mkdirSync(schemasDir, { recursive: true });
}

const schemasPath = path.join(schemasDir, 'ParsingSchemas.ts');
if (!fs.existsSync(schemasPath)) {
  const schemasContent = `/**
 * Parsing Schemas - 小说解析Schema定义
 * 使用Zod进行类型安全的结构化输出
 */

import { z } from 'zod';

// ==========================================
// Schema 1: 元数据提取
// ==========================================
export const ScriptMetadataSchema = z.object({
  title: z.string().min(1),
  wordCount: z.number().int().min(0),
  estimatedDuration: z.string(),
  characterCount: z.number().int().min(0),
  characterNames: z.array(z.string().min(1)),
  sceneCount: z.number().int().min(0),
  sceneNames: z.array(z.string().min(1)),
  chapterCount: z.number().int().min(0),
  genre: z.string(),
  tone: z.string(),
});

// ==========================================
// TypeScript类型导出
// ==========================================
export type ScriptMetadata = z.infer<typeof ScriptMetadataSchema>;

console.log('[ParsingSchemas] 文件已创建 - 请参考执行计划文档继续完善');
`;
  fs.writeFileSync(schemasPath, schemasContent, 'utf-8');
  console.log('✅ ParsingSchemas.ts 创建成功\n');
} else {
  console.log('ℹ️  ParsingSchemas.ts 已存在，跳过创建\n');
}

// 步骤4：创建测试文件基础结构
console.log('[4/5] 创建测试文件...');
const testPath = path.join(schemasDir, 'ParsingSchemas.test.ts');
if (!fs.existsSync(testPath)) {
  const testContent = `/**
 * ParsingSchemas 测试
 */

import { describe, it, expect } from 'vitest';
import { ScriptMetadataSchema } from './ParsingSchemas';

describe('ParsingSchemas', () => {
  describe('ScriptMetadataSchema', () => {
    it('should validate valid metadata', () => {
      const result = ScriptMetadataSchema.safeParse({
        title: '测试小说',
        wordCount: 10000,
        estimatedDuration: '10分钟',
        characterCount: 5,
        characterNames: ['张三', '李四'],
        sceneCount: 8,
        sceneNames: ['客厅', '书房'],
        chapterCount: 3,
        genre: '都市',
        tone: '正剧',
      });
      expect(result.success).toBe(true);
    });
  });
});
`;
  fs.writeFileSync(testPath, testContent, 'utf-8');
  console.log('✅ 测试文件创建成功\n');
} else {
  console.log('ℹ️  测试文件已存在，跳过创建\n');
}

// 步骤5：完成提示
console.log('[5/5] 初始化完成！\n');
console.log('==============================================');
console.log('  接下来请按以下步骤操作：');
console.log('==============================================');
console.log('1. 查看完整执行计划:');
console.log('   小说解析优化执行计划-第一阶段.md');
console.log('');
console.log('2. 继续完善 ParsingSchemas.ts');
console.log('   (参考执行计划文档中的完整Schema定义)');
console.log('');
console.log('3. 修改 LLMProvider.ts 添加 generateStructured 方法');
console.log('');
console.log('4. 运行测试验证:');
console.log('   npm test');
console.log('');
console.log('5. 启动开发服务器:');
console.log('   npm run dev');
console.log('==============================================\n');
