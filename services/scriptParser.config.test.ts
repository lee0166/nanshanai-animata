import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScriptParser, ScriptParserConfig } from './scriptParser';

vi.mock('./storage', () => ({
  storageService: {
    updateScriptParseState: vi.fn().mockResolvedValue(undefined),
    getScript: vi.fn().mockResolvedValue(null),
  },
}));

describe('ScriptParser Configuration', () => {
  const apiKey = 'test-api-key';

  describe('Default Configuration', () => {
    it('should have correct default values', () => {
      const parser = new ScriptParser(apiKey);
      const config = parser.getConfig();
      expect(config.useSemanticChunking).toBe(true);
      expect(config.useDramaRules).toBe(true);
      expect(config.dramaRulesMinScore).toBe(60);
    });
  });

  describe('constructor', () => {
    it('should use default config when not provided', () => {
      const parser = new ScriptParser(apiKey);
      const config = parser.getConfig();
      expect(config.useSemanticChunking).toBe(true);
      expect(config.useDramaRules).toBe(true);
      expect(config.dramaRulesMinScore).toBe(60);
    });

    it('should override default config with custom config', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useSemanticChunking: false,
        dramaRulesMinScore: 80
      });
      const config = parser.getConfig();
      expect(config.useSemanticChunking).toBe(false);
      expect(config.useDramaRules).toBe(true);
      expect(config.dramaRulesMinScore).toBe(80);
    });

    it('should initialize SemanticChunker when useSemanticChunking is true', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useSemanticChunking: true
      });
      expect((parser as any).semanticChunker).not.toBeNull();
    });

    it('should not initialize SemanticChunker when useSemanticChunking is false', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useSemanticChunking: false
      });
      expect((parser as any).semanticChunker).toBeNull();
    });

    it('should initialize ShortDramaRules when useDramaRules is true', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useDramaRules: true
      });
      expect((parser as any).dramaRules).not.toBeNull();
    });

    it('should not initialize ShortDramaRules when useDramaRules is false', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useDramaRules: false
      });
      expect((parser as any).dramaRules).toBeNull();
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the config', () => {
      const parser = new ScriptParser(apiKey);
      const config1 = parser.getConfig();
      const config2 = parser.getConfig();
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('updateConfig', () => {
    it('should update config dynamically', () => {
      const parser = new ScriptParser(apiKey);
      parser.updateConfig({ useSemanticChunking: false });
      expect(parser.getConfig().useSemanticChunking).toBe(false);
    });

    it('should initialize SemanticChunker when enabling', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useSemanticChunking: false
      });
      expect((parser as any).semanticChunker).toBeNull();
      parser.updateConfig({ useSemanticChunking: true });
      expect((parser as any).semanticChunker).not.toBeNull();
    });

    it('should destroy SemanticChunker when disabling', () => {
      const parser = new ScriptParser(apiKey);
      expect((parser as any).semanticChunker).not.toBeNull();
      parser.updateConfig({ useSemanticChunking: false });
      expect((parser as any).semanticChunker).toBeNull();
    });

    it('should initialize ShortDramaRules when enabling', () => {
      const parser = new ScriptParser(apiKey, undefined, undefined, {
        useDramaRules: false
      });
      expect((parser as any).dramaRules).toBeNull();
      parser.updateConfig({ useDramaRules: true });
      expect((parser as any).dramaRules).not.toBeNull();
    });

    it('should destroy ShortDramaRules when disabling', () => {
      const parser = new ScriptParser(apiKey);
      expect((parser as any).dramaRules).not.toBeNull();
      parser.updateConfig({ useDramaRules: false });
      expect((parser as any).dramaRules).toBeNull();
    });
  });

  describe('getQualityReport', () => {
    it('should return null initially', () => {
      const parser = new ScriptParser(apiKey);
      expect(parser.getQualityReport()).toBeNull();
    });
  });
});
