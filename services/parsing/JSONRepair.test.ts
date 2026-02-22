/**
 * JSON Repair Utility Tests
 * 
 * 测试用例基于文档《融合方案_实施细节与代码示例》第4.4节
 */

import { describe, it, expect } from 'vitest';
import { JSONRepair } from './JSONRepair';

describe('JSONRepair', () => {
  describe('Basic JSON Parsing', () => {
    it('should parse valid JSON without repairs', () => {
      const json = '{"name": "test", "value": 123}';
      const result = JSONRepair.repairAndParse(json);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: 123 });
      expect(result.repairAttempts).toHaveLength(0);
    });

    it('should parse valid JSON array', () => {
      const json = '[{"name": "a"}, {"name": "b"}]';
      const result = JSONRepair.repairAndParse(json);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('Code Block Extraction', () => {
    it('should extract JSON from markdown code block', () => {
      const response = '```json\n{"name": "test"}\n```';
      const result = JSONRepair.repairAndParse(response);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test' });
      expect(result.repairAttempts).toContain('extracted_from_code_block');
    });

    it('should extract JSON from code block without language tag', () => {
      const response = '```\n{"name": "test"}\n```';
      const result = JSONRepair.repairAndParse(response);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test' });
    });
  });

  describe('Common Error Fixes', () => {
    it('should fix trailing commas', () => {
      const json = '{"name": "test", "value": 123,}';
      const result = JSONRepair.repairAndParse(json);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: 123 });
      expect(result.repairAttempts).toContain('fixed_common_errors');
    });

    it('should fix single quotes as key quotes', () => {
      const json = "{'name': 'test', 'value': 123}";
      const result = JSONRepair.repairAndParse(json);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: 123 });
    });

    it('should fix unquoted keys', () => {
      const json = '{name: "test", value: 123}';
      const result = JSONRepair.repairAndParse(json);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: 123 });
    });

    it('should fix Chinese quotes', () => {
      const json = '{"name": "测试"}';
      const result = JSONRepair.repairAndParse(json);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: '测试' });
    });
  });

  describe('Complex Repair Scenarios', () => {
    it('should handle multiple errors at once', () => {
      const json = '{\'name\': "test", "items": [1, 2, 3,],}';
      const result = JSONRepair.repairAndParse(json);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', items: [1, 2, 3] });
    });

    it('should fix missing commas between objects', () => {
      const json = '[{"a": 1}{"b": 2}]';
      const result = JSONRepair.repairAndParse(json);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual([{ a: 1 }, { b: 2 }]);
    });

    it('should handle undefined values', () => {
      const json = '{"name": "test", "value": undefined}';
      const result = JSONRepair.repairAndParse(json);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'test', value: null });
    });
  });

  describe('Structure Validation', () => {
    it('should validate required fields', () => {
      const data = { name: 'test', value: 123 };
      const validation = JSONRepair.validateStructure<typeof data>(
        data, 
        ['name', 'value', 'missing']
      );
      
      expect(validation.valid).toBe(false);
      expect(validation.missingFields).toContain('missing');
    });

    it('should pass validation when all fields present', () => {
      const data = { name: 'test', value: 123 };
      const validation = JSONRepair.validateStructure<typeof data>(
        data, 
        ['name', 'value']
      );
      
      expect(validation.valid).toBe(true);
      expect(validation.missingFields).toHaveLength(0);
    });
  });

  describe('Real-world LLM Response Examples', () => {
    it('should handle LLM response with explanation text', () => {
      const response = `Here is the JSON data:
      
\`\`\`json
{
  "characters": [
    {"name": "Alice", "age": "25"},
    {"name": "Bob", "age": "30"}
  ]
}
\`\`\`

Hope this helps!`;
      
      const result = JSONRepair.repairAndParse(response);
      
      expect(result.success).toBe(true);
      expect(result.data.characters).toHaveLength(2);
    });

    it('should handle malformed JSON from LLM', () => {
      const response = '{"name": "test", "items": [1, 2, 3,], "nested": {"a": 1,}}';
      const result = JSONRepair.repairAndParse(response);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'test',
        items: [1, 2, 3],
        nested: { a: 1 }
      });
    });
  });
});
