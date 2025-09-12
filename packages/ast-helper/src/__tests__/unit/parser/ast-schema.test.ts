import { describe, it, expect } from 'vitest';
import {
  NodeType,
  SignificanceLevel,
  Position,
  ASTNode,
  NodeMetadata,
  ProcessingContext,
  isValidPosition,
  isValidASTNode,
  isValidNodeType,
  isValidSignificanceLevel,
  AST_SCHEMA_VERSION,
  AST_CONFIG,
} from '../../../parser/ast-schema';

describe('AST Schema Types', () => {
  describe('NodeType enum', () => {
    it('should contain all required node types', () => {
      expect(NodeType.FILE).toBe('file');
      expect(NodeType.MODULE).toBe('module');
      expect(NodeType.NAMESPACE).toBe('namespace');
      expect(NodeType.CLASS).toBe('class');
      expect(NodeType.INTERFACE).toBe('interface');
      expect(NodeType.ENUM).toBe('enum');
      expect(NodeType.TYPE_ALIAS).toBe('type_alias');
      expect(NodeType.FUNCTION).toBe('function');
      expect(NodeType.METHOD).toBe('method');
      expect(NodeType.CONSTRUCTOR).toBe('constructor');
      expect(NodeType.GETTER).toBe('getter');
      expect(NodeType.SETTER).toBe('setter');
      expect(NodeType.ARROW_FUNCTION).toBe('arrow_function');
      expect(NodeType.VARIABLE).toBe('variable');
      expect(NodeType.PARAMETER).toBe('parameter');
      expect(NodeType.PROPERTY).toBe('property');
      expect(NodeType.FIELD).toBe('field');
      expect(NodeType.IF_STATEMENT).toBe('if_statement');
      expect(NodeType.FOR_LOOP).toBe('for_loop');
      expect(NodeType.WHILE_LOOP).toBe('while_loop');
      expect(NodeType.SWITCH_STATEMENT).toBe('switch_statement');
      expect(NodeType.TRY_CATCH).toBe('try_catch');
      expect(NodeType.IMPORT).toBe('import');
      expect(NodeType.EXPORT).toBe('export');
      expect(NodeType.DECORATOR).toBe('decorator');
      expect(NodeType.COMMENT).toBe('comment');
      expect(NodeType.STRING_LITERAL).toBe('string_literal');
    });

    it('should have at least 25 node types', () => {
      const nodeTypeValues = Object.values(NodeType);
      expect(nodeTypeValues.length).toBeGreaterThanOrEqual(25);
    });
  });

  describe('SignificanceLevel enum', () => {
    it('should have correct numeric values', () => {
      expect(SignificanceLevel.CRITICAL).toBe(5);
      expect(SignificanceLevel.HIGH).toBe(4);
      expect(SignificanceLevel.MEDIUM).toBe(3);
      expect(SignificanceLevel.LOW).toBe(2);
      expect(SignificanceLevel.MINIMAL).toBe(1);
    });

    it('should have ascending order from MINIMAL to CRITICAL', () => {
      expect(SignificanceLevel.MINIMAL).toBeLessThan(SignificanceLevel.LOW);
      expect(SignificanceLevel.LOW).toBeLessThan(SignificanceLevel.MEDIUM);
      expect(SignificanceLevel.MEDIUM).toBeLessThan(SignificanceLevel.HIGH);
      expect(SignificanceLevel.HIGH).toBeLessThan(SignificanceLevel.CRITICAL);
    });
  });

  describe('Position interface', () => {
    it('should accept valid positions', () => {
      const position: Position = {
        line: 1,
        column: 0,
      };
      expect(position.line).toBe(1);
      expect(position.column).toBe(0);
    });

    it('should accept positions with offset', () => {
      const position: Position = {
        line: 5,
        column: 12,
        offset: 100,
      };
      expect(position.line).toBe(5);
      expect(position.column).toBe(12);
      expect(position.offset).toBe(100);
    });
  });

  describe('NodeMetadata interface', () => {
    it('should create valid metadata objects', () => {
      const metadata: NodeMetadata = {
        language: 'typescript',
        scope: ['MyClass'],
        modifiers: ['public', 'static'],
        imports: ['fs', 'path'],
        exports: ['myFunction'],
        docstring: '/** My documentation */',
        annotations: ['@override'],
        languageSpecific: {
          async: true,
          returnType: 'Promise<void>',
        },
      };

      expect(metadata.language).toBe('typescript');
      expect(metadata.scope).toEqual(['MyClass']);
      expect(metadata.modifiers).toEqual(['public', 'static']);
      expect(metadata.imports).toEqual(['fs', 'path']);
      expect(metadata.exports).toEqual(['myFunction']);
      expect(metadata.docstring).toBe('/** My documentation */');
      expect(metadata.annotations).toEqual(['@override']);
      expect(metadata.languageSpecific?.async).toBe(true);
    });
  });

  describe('ASTNode interface', () => {
    const validNode: ASTNode = {
      id: 'a'.repeat(64), // 64-char hex string
      type: NodeType.FUNCTION,
      name: 'myFunction',
      filePath: '/path/to/file.ts',
      start: { line: 1, column: 0 },
      end: { line: 10, column: 1 },
      children: [],
      metadata: {
        language: 'typescript',
        scope: [],
        modifiers: [],
        imports: [],
        exports: [],
        annotations: [],
      },
      significance: SignificanceLevel.HIGH,
    };

    it('should create valid AST nodes', () => {
      expect(validNode.id).toHaveLength(64);
      expect(validNode.type).toBe(NodeType.FUNCTION);
      expect(validNode.name).toBe('myFunction');
      expect(validNode.filePath).toBe('/path/to/file.ts');
      expect(validNode.significance).toBe(SignificanceLevel.HIGH);
    });

    it('should support optional fields', () => {
      const nodeWithOptionals: ASTNode = {
        ...validNode,
        parent: 'parent-id',
        sourceText: 'function myFunction() {}',
        signature: 'myFunction(): void',
        complexity: 5,
      };

      expect(nodeWithOptionals.parent).toBe('parent-id');
      expect(nodeWithOptionals.sourceText).toBe('function myFunction() {}');
      expect(nodeWithOptionals.signature).toBe('myFunction(): void');
      expect(nodeWithOptionals.complexity).toBe(5);
    });
  });

  describe('ProcessingContext interface', () => {
    it('should create valid processing contexts', () => {
      const context: ProcessingContext = {
        filePath: '/path/to/file.ts',
        language: 'typescript',
        sourceText: 'const x = 1;',
        parentScope: ['Module'],
        imports: new Map([['fs', 'fs']]),
        exports: new Set(['myExport']),
      };

      expect(context.filePath).toBe('/path/to/file.ts');
      expect(context.language).toBe('typescript');
      expect(context.sourceText).toBe('const x = 1;');
      expect(context.parentScope).toEqual(['Module']);
      expect(context.imports.get('fs')).toBe('fs');
      expect(context.exports.has('myExport')).toBe(true);
    });
  });

  describe('Type Guards', () => {
    describe('isValidPosition', () => {
      it('should accept valid positions', () => {
        expect(isValidPosition({ line: 1, column: 0 })).toBe(true);
        expect(isValidPosition({ line: 5, column: 12, offset: 100 })).toBe(true);
      });

      it('should reject invalid positions', () => {
        expect(isValidPosition(null)).toBe(false);
        expect(isValidPosition({})).toBe(false);
        expect(isValidPosition({ line: 0, column: 0 })).toBe(false); // line must be >= 1
        expect(isValidPosition({ line: 1, column: -1 })).toBe(false); // column must be >= 0
        expect(isValidPosition({ line: 'invalid', column: 0 })).toBe(false);
      });
    });

    describe('isValidASTNode', () => {
      const validNode: ASTNode = {
        id: 'a'.repeat(64),
        type: NodeType.FUNCTION,
        filePath: '/path/to/file.ts',
        start: { line: 1, column: 0 },
        end: { line: 10, column: 1 },
        children: [],
        metadata: {
          language: 'typescript',
          scope: [],
          modifiers: [],
          imports: [],
          exports: [],
          annotations: [],
        },
        significance: SignificanceLevel.HIGH,
      };

      it('should accept valid nodes', () => {
        expect(isValidASTNode(validNode)).toBe(true);
      });

      it('should reject invalid nodes', () => {
        expect(isValidASTNode(null)).toBe(false);
        expect(isValidASTNode({})).toBe(false);
        expect(isValidASTNode({ ...validNode, id: 'too-short' })).toBe(false);
        expect(isValidASTNode({ ...validNode, type: 'invalid-type' })).toBe(false);
        expect(isValidASTNode({ ...validNode, children: 'not-array' })).toBe(false);
        expect(isValidASTNode({ ...validNode, metadata: null })).toBe(false);
        expect(isValidASTNode({ ...validNode, significance: 99 })).toBe(false);
      });
    });

    describe('isValidNodeType', () => {
      it('should accept valid node types', () => {
        expect(isValidNodeType('function')).toBe(true);
        expect(isValidNodeType('class')).toBe(true);
        expect(isValidNodeType('variable')).toBe(true);
      });

      it('should reject invalid node types', () => {
        expect(isValidNodeType('invalid-type')).toBe(false);
        expect(isValidNodeType('')).toBe(false);
        expect(isValidNodeType('FUNCTION')).toBe(false); // case sensitive
      });
    });

    describe('isValidSignificanceLevel', () => {
      it('should accept valid significance levels', () => {
        expect(isValidSignificanceLevel(1)).toBe(true);
        expect(isValidSignificanceLevel(2)).toBe(true);
        expect(isValidSignificanceLevel(3)).toBe(true);
        expect(isValidSignificanceLevel(4)).toBe(true);
        expect(isValidSignificanceLevel(5)).toBe(true);
      });

      it('should reject invalid significance levels', () => {
        expect(isValidSignificanceLevel(0)).toBe(false);
        expect(isValidSignificanceLevel(6)).toBe(false);
        expect(isValidSignificanceLevel(-1)).toBe(false);
        expect(isValidSignificanceLevel(3.5)).toBe(false);
      });
    });
  });

  describe('Constants', () => {
    it('should have correct schema version', () => {
      expect(AST_SCHEMA_VERSION).toBe('1.0.0');
    });

    it('should have correct configuration values', () => {
      expect(AST_CONFIG.MAX_SOURCE_TEXT_LENGTH).toBe(500);
      expect(AST_CONFIG.HASH_ALGORITHM).toBe('sha256');
      expect(AST_CONFIG.AST_FILE_EXTENSION).toBe('.json');
    });
  });
});