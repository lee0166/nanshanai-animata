import { describe, it, expect } from 'vitest';
import { TextCleaner } from './textCleaner';

describe('TextCleaner', () => {
  describe('clean', () => {
    it('should unify line endings', () => {
      const input = 'Line 1\r\nLine 2\rLine 3\n';
      const result = TextCleaner.clean(input);
      expect(result).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should remove control characters', () => {
      const input = 'Hello\x00World\x01Test';
      const result = TextCleaner.clean(input);
      expect(result).toBe('HelloWorldTest');
    });

    it('should merge excessive blank lines', () => {
      const input = 'Line 1\n\n\n\nLine 2';
      const result = TextCleaner.clean(input);
      expect(result).toBe('Line 1\n\nLine 2');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = TextCleaner.clean(input);
      expect(result).toBe('Hello World');
    });

    it('should unify multiple spaces', () => {
      const input = 'Hello    World    Test';
      const result = TextCleaner.clean(input);
      expect(result).toBe('Hello World Test');
    });

    it('should handle empty input', () => {
      expect(TextCleaner.clean('')).toBe('');
      expect(TextCleaner.clean(null as any)).toBe('');
      expect(TextCleaner.clean(undefined as any)).toBe('');
    });
  });

  describe('extractChapters', () => {
    it('should extract Chinese chapters', () => {
      const input = '第一章 开始\n内容1\n\n第二章 发展\n内容2';
      const chapters = TextCleaner.extractChapters(input);
      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe('第一章 开始');
      expect(chapters[0].content).toBe('内容1');
      expect(chapters[1].title).toBe('第二章 发展');
    });

    it('should extract English chapters', () => {
      const input = 'Chapter 1: Beginning\nContent 1\n\nChapter 2: Development\nContent 2';
      const chapters = TextCleaner.extractChapters(input);
      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe('Chapter 1: Beginning');
    });

    it('should handle text without chapters', () => {
      const input = 'Just some text\nwithout chapters';
      const chapters = TextCleaner.extractChapters(input);
      expect(chapters).toHaveLength(1);
      expect(chapters[0].title).toBe('全文');
      expect(chapters[0].content).toBe(input);
    });
  });

  describe('process', () => {
    it('should return complete clean result', () => {
      const input = '第一章\n内容\n\n\n第二章\n内容';
      const result = TextCleaner.process(input);
      
      expect(result.cleanedText).toBeDefined();
      expect(result.chapters).toHaveLength(2);
      expect(result.stats.originalLength).toBe(input.length);
      expect(result.stats.chapterCount).toBe(2);
    });
  });

  describe('smartChunk', () => {
    it('should chunk text by max size', () => {
      const input = 'Para 1\n\nPara 2\n\nPara 3';
      const chunks = TextCleaner.smartChunk(input, 20);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('detectEncodingIssues', () => {
    it('should detect garbled characters', () => {
      const input = 'Hello\uFFFDWorld';
      const issues = TextCleaner.detectEncodingIssues(input);
      expect(issues).toContain('包含乱码字符');
    });

    it('should detect mixed line endings', () => {
      const input = 'Line 1\r\nLine 2\nLine 3\r';
      const issues = TextCleaner.detectEncodingIssues(input);
      expect(issues).toContain('混合使用多种换行符');
    });

    it('should detect trailing spaces', () => {
      const input = 'Line 1   \nLine 2';
      const issues = TextCleaner.detectEncodingIssues(input);
      expect(issues).toContain('存在行尾空格');
    });
  });
});
