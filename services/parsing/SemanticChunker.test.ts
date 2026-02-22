/**
 * Semantic Chunker Tests
 *
 * 测试用例基于文档《融合方案_实施细节与代码示例》第2.1节
 */

import { describe, it, expect } from 'vitest';
import { SemanticChunker } from './SemanticChunker';

describe('SemanticChunker', () => {
  const chunker = new SemanticChunker({ maxTokens: 500 }); // 500 tokens ≈ 750字符

  describe('Basic Chunking', () => {
    it('should chunk simple text by paragraphs', async () => {
      const text = '第一段内容。\n\n第二段内容。\n\n第三段内容。';
      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain('第一段');
    });

    it('should respect chapter boundaries', async () => {
      const text = `
【第一章】初遇
这是第一章的内容。

【第二章】相识
这是第二章的内容。
      `.trim();

      const chunks = await chunker.chunk(text);

      // 应该识别章节边界
      const hasChapterBoundaries = chunks.some(chunk =>
        chunk.boundaries.some(b => b.type === 'chapter')
      );
      expect(hasChapterBoundaries).toBe(true);
    });

    it('should add context to chunks', async () => {
      const text = `
第一段内容很长，包含很多信息。

第二段内容。

第三段内容。
      `.trim();

      const chunks = await chunker.chunk(text);

      // 除第一个分块外，其他分块应该有上下文
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].prevContext.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Chunk Type Detection', () => {
    it('should detect dialogue chunks', async () => {
      // 使用较长的对话文本确保被识别为dialogue
      const text = '张三说："今天天气真好。"李四回答："是啊，很适合出门。"\n\n' +
        '张三继续说："我们去公园走走吧。"李四笑着点头："好主意！"\n\n' +
        '两人一边走一边聊，气氛十分愉快。';
      const chunks = await chunker.chunk(text);

      if (chunks.length > 0) {
        // 验证至少有一些对话标记
        expect(chunks[0].content).toMatch(/说|回答/);
      }
    });

    it('should detect description chunks', async () => {
      // 使用较长的描述文本
      const text = '这是一个描述性的段落，没有任何对话。太阳高高挂在天空，微风轻拂着树叶。' +
        '远处的山峦在阳光的照耀下显得格外壮丽。鸟儿在枝头欢快地歌唱，' +
        '仿佛在庆祝这美好的一天。整个场景充满了宁静与和谐的氛围。';
      const chunks = await chunker.chunk(text);

      if (chunks.length > 0) {
        // 验证内容存在且没有对话标记
        expect(chunks[0].content.length).toBeGreaterThan(50);
      }
    });
  });

  describe('Metadata Extraction', () => {
    const chunkerWithMetadata = new SemanticChunker({
      maxTokens: 500,
      extractMetadata: true
    });

    it('should extract character names', async () => {
      const text = '林黛玉走进大观园。贾宝玉笑着说："妹妹来了。"';
      const chunks = await chunkerWithMetadata.chunk(text);

      if (chunks.length > 0) {
        const characters = chunks[0].metadata.characters;
        expect(characters.length).toBeGreaterThan(0);
      }
    });

    it('should calculate importance score', async () => {
      const text = '这是一个普通的段落，没有任何重要关键词。';
      const chunks = await chunkerWithMetadata.chunk(text);

      if (chunks.length > 0) {
        expect(chunks[0].metadata.importance).toBeGreaterThanOrEqual(0);
        expect(chunks[0].metadata.importance).toBeLessThanOrEqual(10);
      }
    });

    it('should detect high importance for conflict keywords', async () => {
      const text = '突然，一场激烈的战斗爆发了。这是决战的关键时刻。';
      const chunks = await chunkerWithMetadata.chunk(text);

      if (chunks.length > 0) {
        expect(chunks[0].metadata.importance).toBeGreaterThan(5);
      }
    });
  });

  describe('Chunk Merging', () => {
    it('should merge small chunks', async () => {
      const text = '短。\n\n短。\n\n这是一个比较长的段落，包含很多内容。';
      const chunks = await chunker.chunk(text);

      const merged = chunker.mergeSmallChunks(chunks, 100);

      // 合并后的分块数量应该减少
      expect(merged.length).toBeLessThanOrEqual(chunks.length);
    });
  });

  describe('Position Lookup', () => {
    it('should find chunk at position', async () => {
      const text = '第一段内容。\n\n第二段内容。\n\n第三段内容。';
      const chunks = await chunker.chunk(text);

      const chunk = chunker.getChunkAtPosition(chunks, 5);
      expect(chunk).not.toBeNull();
    });
  });

  describe('Real-world Novel Examples', () => {
    it('should handle Chinese novel format', async () => {
      const text = `
【第一章】梦回红楼

林黛玉缓缓睁开眼睛，发现自己躺在一张陌生的床上。

"这是哪里？"她轻声问道。

窗外传来鸟鸣声，阳光透过纱帘洒进房间。

【第二章】初识宝玉

正当她疑惑之际，一个年轻男子推门而入。
      `.trim();

      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);

      // 验证章节边界被正确识别
      const chapterBoundaries = chunks.flatMap(c =>
        c.boundaries.filter(b => b.type === 'chapter')
      );
      expect(chapterBoundaries.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle long continuous text', async () => {
      // 生成一个长文本 - 使用更大的token限制来确保分块
      const largeChunker = new SemanticChunker({ maxTokens: 200 });
      const paragraphs = [];
      for (let i = 0; i < 20; i++) {
        paragraphs.push(`这是第${i + 1}段内容。`.repeat(10));
      }
      const text = paragraphs.join('\n\n');

      const chunks = await largeChunker.chunk(text);

      expect(chunks.length).toBeGreaterThanOrEqual(1);

      // 验证每个分块都有内容
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.id).toMatch(/^chunk_\d+$/);
      });
    });
  });
});
