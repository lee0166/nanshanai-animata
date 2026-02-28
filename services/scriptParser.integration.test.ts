import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScriptParser } from './scriptParser';

vi.mock('./storage', () => ({
  storageService: {
    updateScriptParseState: vi.fn().mockResolvedValue(undefined),
    getScript: vi.fn().mockResolvedValue(null),
  },
}));

describe('ScriptParser Integration', () => {
  const apiKey = 'test-api-key';

  describe('Quality Report Generation', () => {
    it('should generate quality report when drama rules enabled', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useDramaRules: true
      });
      expect((parser as any).dramaRules).not.toBeNull();
    });

    it('should not generate quality report when drama rules disabled', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useDramaRules: false
      });
      expect((parser as any).dramaRules).toBeNull();
      expect(parser.getQualityReport()).toBeNull();
    });

    it('should store quality report after validation', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useDramaRules: true
      });
      (parser as any).currentScenes = [{ name: '场景1', characters: ['角色1'], description: '描述' }];
      (parser as any).currentCharacters = ['角色1'];
      (parser as any).validateShotsQuality([], '测试场景');
      const report = parser.getQualityReport();
      expect(report).toBeDefined();
      expect(report?.score).toBeDefined();
    });
  });

  describe('Semantic Chunking Integration', () => {
    it('should use semantic chunking when enabled', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useSemanticChunking: true
      });
      expect((parser as any).semanticChunker).not.toBeNull();
    });

    it('should use legacy chunking when disabled', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useSemanticChunking: false
      });
      expect((parser as any).semanticChunker).toBeNull();
    });

    it('should call semanticChunkText when enabled', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useSemanticChunking: true
      });
      const text = '第一章\n\n内容\n\n第二章\n\n内容';
      const chunks = (parser as any).chunkText(text);
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should call legacyChunkText when disabled', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useSemanticChunking: false
      });
      const text = '段落1\n\n段落2\n\n段落3';
      const chunks = (parser as any).chunkText(text);
      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Configuration Hot Update', () => {
    it('should switch from semantic to legacy chunking', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useSemanticChunking: true
      });
      expect((parser as any).semanticChunker).not.toBeNull();
      
      parser.updateConfig({ useSemanticChunking: false });
      expect((parser as any).semanticChunker).toBeNull();
    });

    it('should switch from legacy to semantic chunking', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useSemanticChunking: false
      });
      expect((parser as any).semanticChunker).toBeNull();
      
      parser.updateConfig({ useSemanticChunking: true });
      expect((parser as any).semanticChunker).not.toBeNull();
    });

    it('should switch from drama rules enabled to disabled', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useDramaRules: true
      });
      expect((parser as any).dramaRules).not.toBeNull();
      
      parser.updateConfig({ useDramaRules: false });
      expect((parser as any).dramaRules).toBeNull();
    });

    it('should switch from drama rules disabled to enabled', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useDramaRules: false
      });
      expect((parser as any).dramaRules).toBeNull();
      
      parser.updateConfig({ useDramaRules: true });
      expect((parser as any).dramaRules).not.toBeNull();
    });
  });

  describe('Rollback Verification', () => {
    it('should behave like original when all features disabled', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useSemanticChunking: false,
        useDramaRules: false,
        useCache: false
      });
      
      expect((parser as any).semanticChunker).toBeNull();
      expect((parser as any).dramaRules).toBeNull();
      expect((parser as any).multiLevelCache).toBeNull();
      expect(parser.getQualityReport()).toBeNull();
    });

    it('should restore original behavior after disabling features', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useSemanticChunking: true,
        useDramaRules: true
      });
      
      parser.updateConfig({
        useSemanticChunking: false,
        useDramaRules: false
      });
      
      expect((parser as any).semanticChunker).toBeNull();
      expect((parser as any).dramaRules).toBeNull();
    });
  });
});
