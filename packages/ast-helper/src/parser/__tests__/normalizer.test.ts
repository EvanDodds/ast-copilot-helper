import { describe, it, expect, beforeEach } from 'vitest';
import { ASTNormalizer, NORMALIZATION_CONFIGS } from '../normalizer.js';
import { ASTNode, NormalizedASTNode } from '../types.js';

describe('AST Normalization System', () => {
  let normalizer: ASTNormalizer;

  beforeEach(() => {
    normalizer = new ASTNormalizer();
  });

  describe('ASTNormalizer', () => {
    describe('node normalization', () => {
      it('should normalize a simple TypeScript function declaration', async () => {
        const mockNode: ASTNode = {
          id: 'test-id',
          type: 'function_declaration',
          filePath: '/test/file.ts',
          start: { line: 1, column: 0 },
          end: { line: 3, column: 1 },
          children: [
            {
              id: 'identifier-id',
              type: 'identifier',
              name: 'testFunction',
              filePath: '/test/file.ts',
              start: { line: 1, column: 9 },
              end: { line: 1, column: 21 },
              children: [],
              metadata: {
                language: 'typescript',
                scope: [],
                modifiers: [],
              },
            }
          ],
          metadata: {
            language: 'typescript',
            scope: [],
            modifiers: ['async'],
          },
        };

        const result = await normalizer.normalize(mockNode, 'typescript', '/test/file.ts');

        expect(result.normalizedType).toBe('function_definition');
        expect(result.originalType).toBe('function_declaration');
        expect(result.language).toBe('typescript');
        expect(result.filePath).toBe('/test/file.ts');
        expect(result.metadata.category).toBe('declaration');
        expect(result.metadata.scopeDepth).toBe(0);
        expect(result.metadata.createsSope).toBe(true);
        expect(result.children).toHaveLength(1);
        expect(result.children[0].metadata.category).toBe('identifier');
      });

      it('should normalize a JavaScript variable declaration', async () => {
        const mockNode: ASTNode = {
          id: 'var-id',
          type: 'const_declaration',
          filePath: '/test/file.js',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 20 },
          children: [],
          metadata: {
            language: 'javascript',
            scope: [],
            modifiers: [],
          },
        };

        const result = await normalizer.normalize(mockNode, 'javascript', '/test/file.js');

        expect(result.normalizedType).toBe('variable_declaration');
        expect(result.originalType).toBe('const_declaration');
        expect(result.metadata.category).toBe('declaration');
      });

      it('should normalize a Python class definition', async () => {
        const mockNode: ASTNode = {
          id: 'class-id',
          type: 'class_definition',
          filePath: '/test/file.py',
          start: { line: 1, column: 0 },
          end: { line: 10, column: 0 },
          children: [],
          metadata: {
            language: 'python',
            scope: [],
            modifiers: [],
          },
        };

        const result = await normalizer.normalize(mockNode, 'python', '/test/file.py');

        expect(result.normalizedType).toBe('class_definition');
        expect(result.originalType).toBe('class_definition');
        expect(result.metadata.category).toBe('declaration');
        expect(result.metadata.createsSope).toBe(true);
      });

      it('should handle ignored node types', async () => {
        const mockNode: ASTNode = {
          id: 'comment-id',
          type: 'comment',
          filePath: '/test/file.ts',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 20 },
          children: [],
          metadata: {
            language: 'typescript',
            scope: [],
            modifiers: [],
          },
        };

        const result = await normalizer.normalize(mockNode, 'typescript', '/test/file.ts');

        expect(result.normalizedType).toBe('ignored');
        expect(result.metadata.category).toBe('other');
        expect(result.children).toHaveLength(0);
      });

      it('should calculate complexity for control flow nodes', async () => {
        const mockNode: ASTNode = {
          id: 'if-id',
          type: 'if_statement',
          filePath: '/test/file.ts',
          start: { line: 1, column: 0 },
          end: { line: 5, column: 1 },
          children: [],
          metadata: {
            language: 'typescript',
            scope: [],
            modifiers: [],
          },
        };

        const result = await normalizer.normalize(mockNode, 'typescript', '/test/file.ts', {
          includeComplexity: true,
        });

        expect(result.metadata.complexity.cyclomatic).toBe(2); // Base 1 + if 1
        expect(result.metadata.complexity.cognitive).toBe(1); // if adds 1
        expect(result.metadata.complexity.nesting).toBe(0);
      });

      it('should handle nested scopes correctly', async () => {
        const innerFunction: ASTNode = {
          id: 'inner-func-id',
          type: 'function_declaration',
          filePath: '/test/file.ts',
          start: { line: 3, column: 2 },
          end: { line: 5, column: 3 },
          children: [],
          metadata: {
            language: 'typescript',
            scope: [],
            modifiers: [],
          },
        };

        const outerFunction: ASTNode = {
          id: 'outer-func-id',
          type: 'function_declaration',
          filePath: '/test/file.ts',
          start: { line: 1, column: 0 },
          end: { line: 6, column: 1 },
          children: [innerFunction],
          metadata: {
            language: 'typescript',
            scope: [],
            modifiers: [],
          },
        };

        const result = await normalizer.normalize(outerFunction, 'typescript', '/test/file.ts');

        expect(result.metadata.scopeDepth).toBe(0);
        expect(result.metadata.createsSope).toBe(true);
        expect(result.children[0].metadata.scopeDepth).toBe(1);
        expect(result.children[0].metadata.createsSope).toBe(true);
        expect(result.children[0].metadata.scopeId).not.toBe(result.metadata.scopeId);
      });
    });

    describe('normalization options', () => {
      const mockNode: ASTNode = {
        id: 'test-id',
        type: 'identifier',
        filePath: '/test/file.ts',
        start: { line: 1, column: 0 },
        end: { line: 1, column: 10 },
        children: [],
        metadata: {
          language: 'typescript',
          scope: [],
          modifiers: [],
        },
      };

      it('should exclude positions when requested', async () => {
        const result = await normalizer.normalize(mockNode, 'typescript', '/test/file.ts', {
          includePositions: false,
        });

        expect(result.position.start).toEqual({ line: 0, column: 0 });
        expect(result.position.end).toEqual({ line: 0, column: 0 });
      });

      it('should exclude original types when requested', async () => {
        const result = await normalizer.normalize(mockNode, 'typescript', '/test/file.ts', {
          preserveOriginalTypes: false,
        });

        expect(result.originalType).toBe('');
      });

      it('should respect maximum depth limit', async () => {
        const deepNode = createDeeplyNestedNode(5);

        await expect(
          normalizer.normalize(deepNode, 'typescript', '/test/file.ts', { maxDepth: 3 })
        ).rejects.toThrow('Maximum normalization depth (3) exceeded');
      });

      it('should disable complexity calculation when requested', async () => {
        const result = await normalizer.normalize(mockNode, 'typescript', '/test/file.ts', {
          includeComplexity: false,
        });

        expect(result.metadata.complexity).toEqual({
          cyclomatic: 0,
          cognitive: 0,
          nesting: 0,
        });
      });
    });

    describe('multiple node normalization', () => {
      it('should normalize an array of nodes', async () => {
        const nodes: ASTNode[] = [
          {
            id: 'func-id',
            type: 'function_declaration',
            filePath: '/test/file.ts',
            start: { line: 1, column: 0 },
            end: { line: 3, column: 1 },
            children: [],
            metadata: { language: 'typescript', scope: [], modifiers: [] },
          },
          {
            id: 'var-id',
            type: 'const_declaration',
            filePath: '/test/file.ts',
            start: { line: 5, column: 0 },
            end: { line: 5, column: 20 },
            children: [],
            metadata: { language: 'typescript', scope: [], modifiers: [] },
          },
        ];

        const results = await normalizer.normalizeNodes(nodes, 'typescript', '/test/file.ts');

        expect(results).toHaveLength(2);
        expect(results[0].normalizedType).toBe('function_definition');
        expect(results[1].normalizedType).toBe('variable_declaration');
      });
    });

    describe('ID generation', () => {
      it('should generate consistent IDs for identical nodes', () => {
        const mockNode: ASTNode = {
          id: 'test-id',
          type: 'function_declaration',
          filePath: '/test/file.ts',
          start: { line: 1, column: 0 },
          end: { line: 3, column: 1 },
          children: [],
          metadata: { language: 'typescript', scope: [], modifiers: [] },
        };

        const id1 = normalizer.generateNodeId(mockNode, 'typescript', '/test/file.ts', 'scope1');
        const id2 = normalizer.generateNodeId(mockNode, 'typescript', '/test/file.ts', 'scope1');

        expect(id1).toBe(id2);
        expect(id1).toMatch(/^[a-f0-9]{16}$/); // 16 character hex string
      });

      it('should generate different IDs for different nodes', () => {
        const node1: ASTNode = {
          id: 'test-id',
          type: 'function_declaration',
          filePath: '/test/file.ts',
          start: { line: 1, column: 0 },
          end: { line: 3, column: 1 },
          children: [],
          metadata: { language: 'typescript', scope: [], modifiers: [] },
        };

        const node2: ASTNode = {
          ...node1,
          type: 'class_declaration',
        };

        const id1 = normalizer.generateNodeId(node1, 'typescript', '/test/file.ts', 'scope1');
        const id2 = normalizer.generateNodeId(node2, 'typescript', '/test/file.ts', 'scope1');

        expect(id1).not.toBe(id2);
      });
    });

    describe('custom configurations', () => {
      it('should use custom normalization configurations', () => {
        const customNormalizer = new ASTNormalizer({
          typescript: {
            nodeTypeMappings: {
              'custom_node': 'special_node',
            },
          },
        });

        expect(customNormalizer['configs'].typescript.nodeTypeMappings['custom_node']).toBe('special_node');
        // Should preserve existing mappings
        expect(customNormalizer['configs'].typescript.nodeTypeMappings['function_declaration']).toBe('function_definition');
      });

      it('should handle unsupported languages with default config', async () => {
        const mockNode: ASTNode = {
          id: 'test-id',
          type: 'unknown_node',
          filePath: '/test/file.unknown',
          start: { line: 1, column: 0 },
          end: { line: 1, column: 10 },
          children: [],
          metadata: { language: 'unknown', scope: [], modifiers: [] },
        };

        const result = await normalizer.normalize(mockNode, 'unknown', '/test/file.unknown');

        expect(result.normalizedType).toBe('unknown_node'); // No mapping, use original
        expect(result.language).toBe('unknown');
        expect(result.metadata.category).toBe('other'); // Default category
      });
    });

    describe('cache management', () => {
      it('should provide cache statistics', () => {
        const stats = normalizer.getCacheStats();

        expect(stats).toHaveProperty('size');
        expect(stats).toHaveProperty('hitRate');
        expect(typeof stats.size).toBe('number');
        expect(typeof stats.hitRate).toBe('number');
      });

      it('should clear cache', () => {
        normalizer.clearCache();

        const stats = normalizer.getCacheStats();
        expect(stats.size).toBe(0);
      });
    });
  });

  describe('NORMALIZATION_CONFIGS', () => {
    it('should have configurations for supported languages', () => {
      expect(NORMALIZATION_CONFIGS).toHaveProperty('typescript');
      expect(NORMALIZATION_CONFIGS).toHaveProperty('javascript');
      expect(NORMALIZATION_CONFIGS).toHaveProperty('python');
    });

    it('should have consistent structure for all language configs', () => {
      for (const [language, config] of Object.entries(NORMALIZATION_CONFIGS)) {
        expect(config).toHaveProperty('nodeTypeMappings');
        expect(config).toHaveProperty('ignoredNodeTypes');
        expect(config).toHaveProperty('identifierTypes');
        expect(config).toHaveProperty('literalTypes');
        expect(config).toHaveProperty('declarationTypes');
        expect(config).toHaveProperty('statementTypes');
        expect(config).toHaveProperty('expressionTypes');
        expect(config).toHaveProperty('scopeBoundaries');

        expect(config.nodeTypeMappings).toBeInstanceOf(Object);
        expect(config.ignoredNodeTypes).toBeInstanceOf(Set);
        expect(config.identifierTypes).toBeInstanceOf(Set);
        expect(config.literalTypes).toBeInstanceOf(Set);
        expect(config.declarationTypes).toBeInstanceOf(Set);
        expect(config.statementTypes).toBeInstanceOf(Set);
        expect(config.expressionTypes).toBeInstanceOf(Set);
        expect(config.scopeBoundaries).toBeInstanceOf(Set);
      }
    });

    it('should map common node types correctly', () => {
      const tsConfig = NORMALIZATION_CONFIGS.typescript;
      
      expect(tsConfig.nodeTypeMappings['function_declaration']).toBe('function_definition');
      expect(tsConfig.nodeTypeMappings['class_declaration']).toBe('class_definition');
      expect(tsConfig.nodeTypeMappings['call_expression']).toBe('function_call');
      
      expect(tsConfig.declarationTypes.has('function_declaration')).toBe(true);
      expect(tsConfig.scopeBoundaries.has('function_declaration')).toBe(true);
      expect(tsConfig.identifierTypes.has('identifier')).toBe(true);
    });
  });
});

// Helper function to create deeply nested nodes for testing
function createDeeplyNestedNode(depth: number): ASTNode {
  if (depth === 0) {
    return {
      id: `leaf-${depth}`,
      type: 'identifier',
      filePath: '/test/file.ts',
      start: { line: depth + 1, column: 0 },
      end: { line: depth + 1, column: 10 },
      children: [],
      metadata: { language: 'typescript', scope: [], modifiers: [] },
    };
  }

  return {
    id: `node-${depth}`,
    type: 'function_declaration',
    filePath: '/test/file.ts',
    start: { line: depth, column: 0 },
    end: { line: depth + 10, column: 1 },
    children: [createDeeplyNestedNode(depth - 1)],
    metadata: { language: 'typescript', scope: [], modifiers: [] },
  };
}