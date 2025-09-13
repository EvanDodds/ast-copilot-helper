/**
 * Tests for MetadataExtractor
 * 
 * Validates metadata extraction for scope chains, modifiers, imports/exports,
 * documentation, and language-specific annotations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MetadataExtractor,
  MetadataUtils,
  defaultMetadataExtractor,
  ExtractionContext,
  ImportInfo,
  ExportInfo,
  RawASTNode,
} from '../../../parser/metadata-extractor';
import { NodeMetadata, Position } from '../../../parser/ast-schema';

describe('MetadataExtractor', () => {
  let extractor: MetadataExtractor;

  beforeEach(() => {
    extractor = new MetadataExtractor();
  });

  // Helper function to create mock raw AST nodes
  const createMockNode = (
    type: string,
    text: string,
    options: Partial<RawASTNode> = {}
  ): RawASTNode => {
    const base: RawASTNode = {
      type,
      text,
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 0, column: text.length },
      children: [],
      namedChildren: [],
      fieldName: options.fieldName,
      ...options,
    };
    
    // If this node should have a name, automatically create an identifier child
    if (!base.children?.length && !base.namedChildren?.length) {
      const nameTypes = ['function', 'method', 'class', 'interface', 'variable'];
      if (nameTypes.some(t => type.includes(t))) {
        const identifierName = text.includes(' ') ? text.split(' ').pop() || text : text;
        const identifierNode: RawASTNode = {
          type: 'identifier',
          text: identifierName,
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 0, column: identifierName.length },
          children: [],
          namedChildren: [],
          fieldName: 'name'
        };
        base.children = [identifierNode];
        base.namedChildren = [identifierNode];
      }
    }
    
    return base;
  };

  // Helper function to create extraction context
  const createContext = (
    language: string,
    sourceText: string = '',
    options: Partial<ExtractionContext> = {}
  ): ExtractionContext => {
    return {
      filePath: '/test/file.ts',
      language,
      sourceText,
      scopeStack: options.scopeStack || [],
      fileImports: options.fileImports || new Map(),
      fileExports: options.fileExports || new Set(),
      ...options,
    };
  };

  describe('Basic Metadata Extraction', () => {
    it('should extract basic metadata structure', () => {
      const node = createMockNode('function', 'test');
      const context = createContext('typescript');
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata).toHaveProperty('language', 'typescript');
      expect(metadata).toHaveProperty('scope');
      expect(metadata).toHaveProperty('modifiers');
      expect(metadata).toHaveProperty('imports');
      expect(metadata).toHaveProperty('exports');
      expect(metadata).toHaveProperty('annotations');
    });

    it('should respect configuration settings', () => {
      const customExtractor = new MetadataExtractor({
        extractModifiers: false,
        extractDocumentation: false,
      });
      
      const node = createMockNode('function', 'test');
      const context = createContext('typescript');
      
      const metadata = customExtractor.extractMetadata(node, context);
      
      expect(metadata.modifiers).toHaveLength(0);
      expect(metadata.docstring).toBeUndefined();
    });

    it('should handle different languages', () => {
      const node = createMockNode('function', 'test');
      
      const tsMetadata = extractor.extractMetadata(node, createContext('typescript'));
      const pyMetadata = extractor.extractMetadata(node, createContext('python'));
      const javaMetadata = extractor.extractMetadata(node, createContext('java'));
      
      expect(tsMetadata.language).toBe('typescript');
      expect(pyMetadata.language).toBe('python');
      expect(javaMetadata.language).toBe('java');
    });
  });

  describe('Scope Extraction', () => {
    it('should extract scope chain from context', () => {
      const node = createMockNode('method', 'testMethod');
      const context = createContext('typescript', '', {
        scopeStack: ['global', 'TestClass'],
      });
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.scope).toEqual(['global', 'TestClass', 'testMethod']);
    });

    it('should handle nodes without names', () => {
      const node = createMockNode('if_statement', 'if (true) {}');
      const context = createContext('typescript', '', {
        scopeStack: ['global', 'function'],
      });
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.scope).toEqual(['global', 'function', 'if_statement']);
    });

    it('should handle empty scope stack', () => {
      const node = createMockNode('class', 'TestClass');
      const context = createContext('typescript');
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.scope).toEqual(['TestClass']);
    });
  });

  describe('Modifier Extraction', () => {
    describe('TypeScript/JavaScript Modifiers', () => {
      it('should extract access modifiers', () => {
        const node = createMockNode('method', 'public static testMethod', {
          children: [
            createMockNode('public', 'public'),
            createMockNode('static', 'static'),
            createMockNode('identifier', 'testMethod'),
          ],
        });
        const context = createContext('typescript');
        
        const metadata = extractor.extractMetadata(node, context);
        
        expect(metadata.modifiers).toContain('public');
        expect(metadata.modifiers).toContain('static');
      });

      it('should extract async modifier', () => {
        const node = createMockNode('function', 'async function test', {
          children: [
            createMockNode('async', 'async'),
            createMockNode('identifier', 'test'),
          ],
        });
        const context = createContext('javascript');
        
        const metadata = extractor.extractMetadata(node, context);
        
        expect(metadata.modifiers).toContain('async');
      });
    });

    describe('Python Modifiers', () => {
      it('should identify private methods by naming convention', () => {
        const node = createMockNode('function_definition', '_private_method');
        const context = createContext('python');
        
        const metadata = extractor.extractMetadata(node, context);
        
        expect(metadata.modifiers).toContain('private');
      });

      it('should identify magic methods', () => {
        const node = createMockNode('function_definition', '__init__');
        const context = createContext('python');
        
        const metadata = extractor.extractMetadata(node, context);
        
        expect(metadata.modifiers).toContain('magic');
      });
    });

    describe('Java Modifiers', () => {
      it('should extract Java access modifiers', () => {
        const node = createMockNode('method_declaration', 'public final void test', {
          children: [
            createMockNode('keyword', 'public'),
            createMockNode('keyword', 'final'),
            createMockNode('identifier', 'test'),
          ],
        });
        const context = createContext('java');
        
        const metadata = extractor.extractMetadata(node, context);
        
        expect(metadata.modifiers).toContain('public');
        expect(metadata.modifiers).toContain('final');
      });
    });
  });

  describe('Import/Export Extraction', () => {
    it('should extract imports referenced by node identifiers', () => {
      const importInfo: ImportInfo = {
        type: 'named',
        imported: 'Component',
        local: 'Component',
        source: 'react',
        position: { line: 1, column: 0 },
      };
      
      const fileImports = new Map([['Component', importInfo]]);
      
      const node = createMockNode('jsx_element', '<Component />', {
        children: [createMockNode('identifier', 'Component')],
      });
      const context = createContext('typescript', '', { fileImports });
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.imports).toContain('Component');
    });

    it('should extract exports for exported nodes', () => {
      const exportInfo: ExportInfo = {
        type: 'named',
        name: 'TestFunction',
        position: { line: 1, column: 0 },
      };
      
      const fileExports = new Set([exportInfo]);
      
      const node = createMockNode('function', 'TestFunction');
      const context = createContext('typescript', '', { fileExports });
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.exports).toContain('TestFunction');
    });

    it('should handle default exports', () => {
      const exportInfo: ExportInfo = {
        type: 'default',
        position: { line: 1, column: 0 },
      };
      
      const fileExports = new Set([exportInfo]);
      
      const node = createMockNode('function', 'DefaultFunction');
      const context = createContext('typescript', '', { fileExports });
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.exports).toContain('default');
    });
  });

  describe('Documentation Extraction', () => {
    it('should extract single-line comments', () => {
      const sourceText = `// This is a test function
function test() {}`;
      
      const node = createMockNode('function', 'test', {
        startPosition: { row: 1, column: 0 },
      });
      const context = createContext('typescript', sourceText);
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.docstring).toBe('This is a test function');
    });

    it('should extract multi-line comments', () => {
      const sourceText = `// First line
// Second line
// Third line
function test() {}`;
      
      const node = createMockNode('function', 'test', {
        startPosition: { row: 3, column: 0 },
      });
      const context = createContext('typescript', sourceText);
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.docstring).toBe('First line Second line Third line');
    });

    it('should extract Python docstrings', () => {
      const sourceText = `# This is a Python function
def test():
    pass`;
      
      const node = createMockNode('function_definition', 'test', {
        startPosition: { row: 1, column: 0 },
      });
      const context = createContext('python', sourceText);
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.docstring).toBe('This is a Python function');
    });

    it('should handle missing documentation', () => {
      const sourceText = `function test() {}`;
      
      const node = createMockNode('function', 'test', {
        startPosition: { row: 0, column: 0 },
      });
      const context = createContext('typescript', sourceText);
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.docstring).toBeUndefined();
    });

    it('should truncate long documentation', () => {
      const longComment = '// ' + 'x'.repeat(2500);
      const sourceText = `${longComment}
function test() {}`;
      
      const extractor = new MetadataExtractor({
        maxDocumentationLength: 100,
      });
      
      const node = createMockNode('function', 'test', {
        startPosition: { row: 1, column: 0 },
      });
      const context = createContext('typescript', sourceText);
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.docstring).toBeDefined();
      expect(metadata.docstring!.length).toBeLessThanOrEqual(104); // 100 + '...'
    });
  });

  describe('Annotation Extraction', () => {
    it('should extract TypeScript decorators', () => {
      const node = createMockNode('method', '@override testMethod', {
        children: [
          createMockNode('decorator', '@override'),
          createMockNode('identifier', 'testMethod'),
        ],
      });
      const context = createContext('typescript');
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.annotations).toContain('@override');
    });

    it('should extract Python decorators', () => {
      const node = createMockNode('function_definition', '@property def test', {
        parent: createMockNode('decorated_definition', '', {
          children: [
            createMockNode('decorator', '@property'),
            createMockNode('function_definition', 'def test'),
          ],
        }),
      });
      const context = createContext('python');
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.annotations).toContain('@property');
    });

    it('should extract Java annotations', () => {
      const node = createMockNode('method_declaration', '@Override public void test', {
        children: [
          createMockNode('annotation', '@Override'),
          createMockNode('keyword', 'public'),
          createMockNode('identifier', 'test'),
        ],
      });
      const context = createContext('java');
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.annotations).toContain('@Override');
    });
  });

  describe('Language-Specific Features', () => {
    describe('TypeScript Specific', () => {
      it('should extract type annotations', () => {
        const node = createMockNode('function', 'test(): string', {
          children: [
            createMockNode('identifier', 'test'),
            createMockNode('type_annotation', ': string', { fieldName: 'type' }),
          ],
        });
        const context = createContext('typescript');
        
        const metadata = extractor.extractMetadata(node, context);
        
        expect(metadata.languageSpecific?.typeAnnotation).toBe(': string');
      });

      it('should extract generic parameters', () => {
        const node = createMockNode('function', 'test<T>', {
          children: [
            createMockNode('identifier', 'test'),
            createMockNode('type_parameters', '<T>', {
              children: [createMockNode('type_parameter', 'T')],
            }),
          ],
        });
        const context = createContext('typescript');
        
        const metadata = extractor.extractMetadata(node, context);
        
        expect(metadata.languageSpecific?.generics).toContain('T');
      });

      it('should extract interface implementations', () => {
        const node = createMockNode('class_declaration', 'class Test implements ITest', {
          children: [
            createMockNode('identifier', 'Test'),
            createMockNode('class_heritage', 'implements ITest', {
              fieldName: 'implements',
              children: [createMockNode('identifier', 'ITest')],
            }),
          ],
        });
        const context = createContext('typescript');
        
        const metadata = extractor.extractMetadata(node, context);
        
        expect(metadata.languageSpecific?.implements).toContain('ITest');
      });
    });

    describe('Python Specific', () => {
      it('should extract type hints', () => {
        const node = createMockNode('function_definition', 'def test() -> str', {
          children: [
            createMockNode('identifier', 'test'),
            createMockNode('type', 'str', { fieldName: 'return_type' }),
          ],
        });
        const context = createContext('python');
        
        const metadata = extractor.extractMetadata(node, context);
        
        expect(metadata.languageSpecific?.typeHint).toBe('str');
      });

      it('should extract base classes', () => {
        const node = createMockNode('class_definition', 'class Test(Base)', {
          children: [
            createMockNode('identifier', 'Test'),
            createMockNode('argument_list', '(Base)', {
              fieldName: 'superclasses',
              children: [createMockNode('identifier', 'Base')],
            }),
          ],
        });
        const context = createContext('python');
        
        const metadata = extractor.extractMetadata(node, context);
        
        expect(metadata.languageSpecific?.baseClasses).toContain('Base');
      });
    });

    describe('Java Specific', () => {
      it('should extract Java generic parameters', () => {
        const node = createMockNode('method_declaration', 'public <T> void test', {
          children: [
            createMockNode('type_parameters', '<T>', {
              children: [createMockNode('type_parameter', 'T')],
            }),
            createMockNode('identifier', 'test'),
          ],
        });
        const context = createContext('java');
        
        const metadata = extractor.extractMetadata(node, context);
        
        expect(metadata.languageSpecific?.generics).toContain('T');
      });

      it('should extract Java interface implementations', () => {
        const node = createMockNode('class_declaration', 'class Test implements ITest', {
          children: [
            createMockNode('identifier', 'Test'),
            createMockNode('interfaces', 'implements ITest', {
              fieldName: 'interfaces',
              children: [createMockNode('type_identifier', 'ITest')],
            }),
          ],
        });
        const context = createContext('java');
        
        const metadata = extractor.extractMetadata(node, context);
        
        expect(metadata.languageSpecific?.implements).toContain('ITest');
      });
    });
  });

  describe('Node Name Extraction', () => {
    it('should extract name from identifier child', () => {
      const node = createMockNode('function', 'test');
      const context = createContext('typescript');
      
      const metadata = extractor.extractMetadata(node, context);
      
      // We can verify this by checking if the name was used in scope
      expect(metadata.scope).toContain('test');
    });

    it('should extract name from field name', () => {
      const node = createMockNode('function', 'function test', {
        children: [createMockNode('identifier', 'test', { fieldName: 'name' })],
      });
      const context = createContext('typescript');
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.scope).toContain('test');
    });

    it('should handle unnamed nodes', () => {
      const node = createMockNode('if_statement', 'if (true) {}');
      const context = createContext('typescript');
      
      const metadata = extractor.extractMetadata(node, context);
      
      expect(metadata.scope).toContain('if_statement');
    });
  });
});

describe('MetadataUtils', () => {
  describe('Context Creation', () => {
    it('should create basic context', () => {
      const context = MetadataUtils.createContext(
        '/test/file.ts',
        'typescript',
        'function test() {}'
      );
      
      expect(context.filePath).toBe('/test/file.ts');
      expect(context.language).toBe('typescript');
      expect(context.sourceText).toBe('function test() {}');
      expect(context.scopeStack).toEqual([]);
      expect(context.fileImports).toBeInstanceOf(Map);
      expect(context.fileExports).toBeInstanceOf(Set);
    });

    it('should create context with scope stack', () => {
      const context = MetadataUtils.createContext(
        '/test/file.ts',
        'typescript',
        'function test() {}',
        ['global', 'class']
      );
      
      expect(context.scopeStack).toEqual(['global', 'class']);
    });
  });

  describe('Import Parsing', () => {
    describe('TypeScript/JavaScript Imports', () => {
      it('should parse named imports', () => {
        const sourceText = `import { Component } from 'react';
function test() {}`;
        
        const imports = MetadataUtils.parseImports(sourceText, 'typescript');
        
        const componentImport = imports.get('Component');
        expect(componentImport).toBeDefined();
        expect(componentImport!.type).toBe('named');
        expect(componentImport!.imported).toBe('Component');
        expect(componentImport!.source).toBe('react');
      });

      it('should parse default imports', () => {
        const sourceText = `import React from 'react';
function test() {}`;
        
        const imports = MetadataUtils.parseImports(sourceText, 'typescript');
        
        const reactImport = imports.get('React');
        expect(reactImport).toBeDefined();
        expect(reactImport!.type).toBe('default');
        expect(reactImport!.local).toBe('React');
        expect(reactImport!.source).toBe('react');
      });

      it('should handle multiple imports', () => {
        const sourceText = `import React from 'react';
import { Component, useState } from 'react';
function test() {}`;
        
        const imports = MetadataUtils.parseImports(sourceText, 'typescript');
        
        expect(imports.size).toBeGreaterThanOrEqual(2);
        expect(imports.has('React')).toBe(true);
        expect(imports.has('Component')).toBe(true);
      });
    });

    describe('Python Imports', () => {
      it('should parse from imports', () => {
        const sourceText = `from os import path
def test():
    pass`;
        
        const imports = MetadataUtils.parseImports(sourceText, 'python');
        
        const pathImport = imports.get('path');
        expect(pathImport).toBeDefined();
        expect(pathImport!.type).toBe('named');
        expect(pathImport!.imported).toBe('path');
        expect(pathImport!.source).toBe('os');
      });

      it('should parse module imports', () => {
        const sourceText = `import json
def test():
    pass`;
        
        const imports = MetadataUtils.parseImports(sourceText, 'python');
        
        const jsonImport = imports.get('json');
        expect(jsonImport).toBeDefined();
        expect(jsonImport!.type).toBe('namespace');
        expect(jsonImport!.imported).toBe('json');
        expect(jsonImport!.source).toBe('json');
      });
    });
  });

  describe('Export Parsing', () => {
    describe('TypeScript/JavaScript Exports', () => {
      it('should parse default exports', () => {
        const sourceText = `function test() {}
export default test;`;
        
        const exports = MetadataUtils.parseExports(sourceText, 'typescript');
        
        const exportArray = Array.from(exports);
        expect(exportArray.some(exp => exp.type === 'default')).toBe(true);
      });

      it('should parse named exports', () => {
        const sourceText = `function test() {}
export { test };`;
        
        const exports = MetadataUtils.parseExports(sourceText, 'typescript');
        
        const exportArray = Array.from(exports);
        expect(exportArray.some(exp => exp.name === 'test')).toBe(true);
      });
    });

    describe('Python Exports', () => {
      it('should parse __all__ declarations', () => {
        const sourceText = `def test():
    pass
    
__all__ = ['test']`;
        
        const exports = MetadataUtils.parseExports(sourceText, 'python');
        
        const exportArray = Array.from(exports);
        expect(exportArray.some(exp => exp.name === '__all__')).toBe(true);
      });
    });
  });
});

describe('Default MetadataExtractor Instance', () => {
  it('should provide a working default instance', () => {
    const node = createMockNode('function', 'test');
    const context = createContext('typescript');
    
    const metadata = defaultMetadataExtractor.extractMetadata(node, context);
    
    expect(metadata).toBeDefined();
    expect(metadata.language).toBe('typescript');
  });

  it('should use default configuration', () => {
    const node = createMockNode('function', 'public static test', {
      children: [
        createMockNode('public', 'public'),
        createMockNode('static', 'static'),
        createMockNode('identifier', 'test'),
      ],
    });
    const context = createContext('typescript');
    
    const metadata = defaultMetadataExtractor.extractMetadata(node, context);
    
    expect(metadata.modifiers).toContain('public');
    expect(metadata.modifiers).toContain('static');
  });

  // Helper function to create mock nodes (moved inside describe for access)
  function createMockNode(
    type: string,
    text: string = '',
    options: Partial<RawASTNode> = {}
  ): RawASTNode {
    const base: RawASTNode = {
      type,
      text,
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 0, column: text.length },
      children: options.children || [],
      namedChildren: options.namedChildren || [],
      fieldName: options.fieldName,
      ...options,
    };
    
    // If this node should have a name, automatically create an identifier child
    if (!base.children?.length && !base.namedChildren?.length) {
      const nameTypes = ['function', 'method', 'class', 'interface', 'variable'];
      if (nameTypes.some(t => type.includes(t))) {
        const identifierName = text.includes(' ') ? text.split(' ').pop() || text : text;
        const identifierNode: RawASTNode = {
          type: 'identifier',
          text: identifierName,
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 0, column: identifierName.length },
          children: [],
          namedChildren: [],
          fieldName: 'name'
        };
        base.children = [identifierNode, ...base.children];
        base.namedChildren = [identifierNode, ...base.namedChildren];
      }
    }
    
    return base;
  }

  function createContext(
    language: string,
    sourceText: string = '',
    options: Partial<ExtractionContext> = {}
  ): ExtractionContext {
    return {
      filePath: '/test/file.ts',
      language,
      sourceText,
      scopeStack: options.scopeStack || [],
      fileImports: options.fileImports || new Map(),
      fileExports: options.fileExports || new Set(),
      ...options,
    };
  }
});