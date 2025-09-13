/**
 * Tests for parser types and utilities
 */

import { describe, it, expect } from 'vitest';
import { generateNodeId } from './types.js';

describe('Parser Types', () => {
  describe('generateNodeId', () => {
    it('should generate consistent IDs for same inputs', () => {
      const id1 = generateNodeId('/path/to/file.ts', 10, 5, 'function_declaration');
      const id2 = generateNodeId('/path/to/file.ts', 10, 5, 'function_declaration');
      
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex format
    });

    it('should generate different IDs for different inputs', () => {
      const id1 = generateNodeId('/path/to/file.ts', 10, 5, 'function_declaration');
      const id2 = generateNodeId('/path/to/file.ts', 11, 5, 'function_declaration');
      const id3 = generateNodeId('/path/to/other.ts', 10, 5, 'function_declaration');
      const id4 = generateNodeId('/path/to/file.ts', 10, 5, 'class_declaration');
      
      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id1).not.toBe(id4);
    });

    it('should handle different file paths correctly', () => {
      const windowsPath = 'C:\\Projects\\file.ts';
      const unixPath = '/home/user/file.ts';
      
      const id1 = generateNodeId(windowsPath, 1, 0, 'module');
      const id2 = generateNodeId(unixPath, 1, 0, 'module');
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[a-f0-9]{64}$/);
      expect(id2).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});