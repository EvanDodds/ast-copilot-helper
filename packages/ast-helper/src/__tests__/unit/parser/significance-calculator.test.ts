/**
 * Tests for SignificanceCalculator
 * 
 * Validates the 5-level hierarchy assignment system and
 * multi-factor significance analysis algorithms.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SignificanceCalculator,
  SignificanceUtils,
  defaultSignificanceCalculator,
  SignificanceConfig,
  SignificanceContext,
  SignificanceFactors,
} from '../../../parser/significance-calculator';
import { ASTNode, NodeType, SignificanceLevel, Position, NodeMetadata } from '../../../parser/ast-schema';

describe('SignificanceCalculator', () => {
  let calculator: SignificanceCalculator;

  beforeEach(() => {
    calculator = new SignificanceCalculator();
    calculator.resetStats();
  });

  // Helper function to create test nodes
  const createTestNode = (
    type: NodeType,
    name?: string,
    options: Partial<ASTNode> = {}
  ): ASTNode => {
    const start: Position = {
      line: 1,
      column: 0,
      offset: 0,
    };

    const end: Position = {
      line: 1,
      column: 10,
      offset: 10,
    };

    const metadata: NodeMetadata = {
      language: 'typescript',
      scope: options.metadata?.scope || [],
      modifiers: options.metadata?.modifiers || [],
      docstring: options.metadata?.docstring || undefined,
      imports: options.metadata?.imports || [],
      exports: options.metadata?.exports || [],
      annotations: options.metadata?.annotations || [],
    };

    return {
      id: 'test-id',
      type,
      name: name || undefined,
      filePath: '/test/file.ts',
      start,
      end,
      parent: undefined,
      children: [],
      metadata,
      significance: SignificanceLevel.LOW, // Will be overridden
      sourceText: options.sourceText || undefined,
      complexity: options.complexity || undefined,
      ...options,
    };
  };

  describe('Basic Significance Calculation', () => {
    it('should calculate significance for a simple function', () => {
      const node = createTestNode(NodeType.FUNCTION, 'testFunction');
      const significance = calculator.calculateSignificance(node);
      
      expect(significance).toBe(SignificanceLevel.HIGH);
    });

    it('should assign CRITICAL significance to files and modules', () => {
      const fileNode = createTestNode(NodeType.FILE, 'test.ts');
      const moduleNode = createTestNode(NodeType.MODULE, 'TestModule');
      
      expect(calculator.calculateSignificance(fileNode)).toBe(SignificanceLevel.CRITICAL);
      expect(calculator.calculateSignificance(moduleNode)).toBe(SignificanceLevel.CRITICAL);
    });

    it('should assign CRITICAL significance to classes and interfaces', () => {
      const classNode = createTestNode(NodeType.CLASS, 'TestClass');
      const interfaceNode = createTestNode(NodeType.INTERFACE, 'ITestInterface');
      
      expect(calculator.calculateSignificance(classNode)).toBe(SignificanceLevel.CRITICAL);
      expect(calculator.calculateSignificance(interfaceNode)).toBe(SignificanceLevel.CRITICAL);
    });

    it('should assign HIGH significance to function-like constructs', () => {
      const functionNode = createTestNode(NodeType.FUNCTION, 'testFunc');
      const methodNode = createTestNode(NodeType.METHOD, 'testMethod');
      const constructorNode = createTestNode(NodeType.CONSTRUCTOR);
      
      expect(calculator.calculateSignificance(functionNode)).toBe(SignificanceLevel.HIGH);
      expect(calculator.calculateSignificance(methodNode)).toBe(SignificanceLevel.HIGH);
      expect(calculator.calculateSignificance(constructorNode)).toBe(SignificanceLevel.HIGH);
    });

    it('should assign MEDIUM significance to type definitions', () => {
      const enumNode = createTestNode(NodeType.ENUM, 'TestEnum');
      const typeAliasNode = createTestNode(NodeType.TYPE_ALIAS, 'TestType');
      const importNode = createTestNode(NodeType.IMPORT);
      
      expect(calculator.calculateSignificance(enumNode)).toBe(SignificanceLevel.MEDIUM);
      expect(calculator.calculateSignificance(typeAliasNode)).toBe(SignificanceLevel.MEDIUM);
      expect(calculator.calculateSignificance(importNode)).toBe(SignificanceLevel.MEDIUM);
    });

    it('should assign LOW significance to simple constructs', () => {
      const variableNode = createTestNode(NodeType.VARIABLE, 'testVar');
      const propertyNode = createTestNode(NodeType.PROPERTY, 'testProp');
      const ifNode = createTestNode(NodeType.IF_STATEMENT);
      
      expect(calculator.calculateSignificance(variableNode)).toBe(SignificanceLevel.LOW);
      expect(calculator.calculateSignificance(propertyNode)).toBe(SignificanceLevel.LOW);
      expect(calculator.calculateSignificance(ifNode)).toBe(SignificanceLevel.LOW);
    });

    it('should assign MINIMAL significance to basic constructs', () => {
      const parameterNode = createTestNode(NodeType.PARAMETER, 'param');
      const commentNode = createTestNode(NodeType.COMMENT);
      const stringNode = createTestNode(NodeType.STRING_LITERAL);
      
      expect(calculator.calculateSignificance(parameterNode)).toBe(SignificanceLevel.MINIMAL);
      expect(calculator.calculateSignificance(commentNode)).toBe(SignificanceLevel.MINIMAL);
      expect(calculator.calculateSignificance(stringNode)).toBe(SignificanceLevel.MINIMAL);
    });
  });

  describe('Complexity Factor Adjustment', () => {
    it('should increase significance for nodes with many children', () => {
      const context: Partial<SignificanceContext> = {
        children: Array(15).fill(null).map((_, i) => 
          createTestNode(NodeType.VARIABLE, `var${i}`)
        ),
      };
      
      const node = createTestNode(NodeType.FUNCTION, 'complexFunction');
      const factors = calculator.calculateSignificanceFactors(node, context);
      
      expect(factors.complexityFactor).toBeGreaterThan(0);
      expect(factors.finalSignificance).toBeGreaterThanOrEqual(SignificanceLevel.HIGH);
    });

    it('should increase significance for high complexity functions', () => {
      const node = createTestNode(NodeType.FUNCTION, 'complexFunction', {
        complexity: 12,
      });
      
      const factors = calculator.calculateSignificanceFactors(node);
      expect(factors.complexityFactor).toBeGreaterThan(0);
    });

    it('should increase significance for long source text', () => {
      const longSourceText = 'function test() {\n' + '  return true;\n'.repeat(30) + '}';
      const node = createTestNode(NodeType.FUNCTION, 'longFunction', {
        sourceText: longSourceText,
      });
      
      const factors = calculator.calculateSignificanceFactors(node);
      expect(factors.complexityFactor).toBeGreaterThan(0);
    });

    it('should increase significance for functions with many parameters', () => {
      const parameters = Array(6).fill(null).map((_, i) => 
        createTestNode(NodeType.PARAMETER, `param${i}`)
      );
      
      const context: Partial<SignificanceContext> = {
        children: parameters,
      };
      
      const node = createTestNode(NodeType.FUNCTION, 'manyParamsFunction');
      const factors = calculator.calculateSignificanceFactors(node, context);
      
      expect(factors.complexityFactor).toBeGreaterThan(0);
    });

    it('should increase significance for classes with many members', () => {
      const members = Array(8).fill(null).map((_, i) => 
        createTestNode(NodeType.METHOD, `method${i}`)
      );
      
      const context: Partial<SignificanceContext> = {
        children: members,
      };
      
      const node = createTestNode(NodeType.CLASS, 'ComplexClass');
      const factors = calculator.calculateSignificanceFactors(node, context);
      
      expect(factors.complexityFactor).toBeGreaterThan(0);
    });
  });

  describe('Scope Factor Adjustment', () => {
    it('should decrease significance for deeply nested nodes', () => {
      const node = createTestNode(NodeType.FUNCTION, 'nestedFunction', {
        metadata: {
          language: 'typescript',
          scope: ['global', 'class', 'method', 'if', 'for', 'if', 'block'],
          modifiers: [],
          imports: [],
          exports: [],
          annotations: [],
        },
      });
      
      const factors = calculator.calculateSignificanceFactors(node);
      expect(factors.scopeFactor).toBeLessThan(0);
    });

    it('should increase significance for top-level nodes', () => {
      const node = createTestNode(NodeType.FUNCTION, 'topLevelFunction', {
        metadata: {
          language: 'typescript',
          scope: [],
          modifiers: [],
          imports: [],
          exports: [],
          annotations: [],
        },
      });
      
      const factors = calculator.calculateSignificanceFactors(node);
      expect(factors.scopeFactor).toBeGreaterThan(0);
    });

    it('should slightly increase significance for shallow scope', () => {
      const node = createTestNode(NodeType.FUNCTION, 'shallowFunction', {
        metadata: {
          language: 'typescript',
          scope: ['global'],
          modifiers: [],
          imports: [],
          exports: [],
          annotations: [],
        },
      });
      
      const factors = calculator.calculateSignificanceFactors(node);
      expect(factors.scopeFactor).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Size Factor Adjustment', () => {
    it('should increase significance for very large nodes', () => {
      const largeSourceText = 'x'.repeat(1500);
      const node = createTestNode(NodeType.CLASS, 'LargeClass', {
        sourceText: largeSourceText,
      });
      
      const factors = calculator.calculateSignificanceFactors(node);
      expect(factors.sizeFactor).toBeGreaterThan(0);
    });

    it('should decrease significance for very small nodes', () => {
      const node = createTestNode(NodeType.VARIABLE, 'x', {
        sourceText: 'x',
      });
      
      const factors = calculator.calculateSignificanceFactors(node);
      expect(factors.sizeFactor).toBeLessThan(0);
    });

    it('should not adjust significantly for medium-sized nodes', () => {
      const node = createTestNode(NodeType.FUNCTION, 'mediumFunction', {
        sourceText: 'function medium() { return 42; }',
      });
      
      const factors = calculator.calculateSignificanceFactors(node);
      expect(factors.sizeFactor).toBeGreaterThanOrEqual(-0.5);
      expect(factors.sizeFactor).toBeLessThanOrEqual(0.5);
    });
  });

  describe('Context Factor Adjustment', () => {
    it('should decrease significance for test files', () => {
      const context: Partial<SignificanceContext> = {
        fileContext: {
          totalNodes: 100,
          totalFunctions: 10,
          totalClasses: 5,
          isMainFile: false,
          isTestFile: true,
          isConfigFile: false,
        },
      };
      
      const node = createTestNode(NodeType.FUNCTION, 'testFunction');
      const factors = calculator.calculateSignificanceFactors(node, context);
      
      expect(factors.contextFactor).toBeLessThan(0);
    });

    it('should increase significance for main files', () => {
      const context: Partial<SignificanceContext> = {
        fileContext: {
          totalNodes: 100,
          totalFunctions: 10,
          totalClasses: 5,
          isMainFile: true,
          isTestFile: false,
          isConfigFile: false,
        },
      };
      
      const node = createTestNode(NodeType.FUNCTION, 'mainFunction');
      const factors = calculator.calculateSignificanceFactors(node, context);
      
      expect(factors.contextFactor).toBeGreaterThan(0);
    });

    it('should increase significance for exported items', () => {
      const node = createTestNode(NodeType.FUNCTION, 'exportedFunction', {
        metadata: {
          language: 'typescript',
          scope: [],
          modifiers: [],
          imports: [],
          exports: ['default'],
          annotations: [],
        },
      });
      
      const factors = calculator.calculateSignificanceFactors(node);
      expect(factors.contextFactor).toBeGreaterThan(0);
    });

    it('should increase significance for documented items', () => {
      const node = createTestNode(NodeType.FUNCTION, 'documentedFunction', {
        metadata: {
          language: 'typescript',
          scope: [],
          modifiers: [],
          imports: [],
          exports: [],
          annotations: [],
          docstring: 'This is a documented function',
        },
      });
      
      const factors = calculator.calculateSignificanceFactors(node);
      expect(factors.contextFactor).toBeGreaterThan(0);
    });

    it('should increase significance for items with many modifiers', () => {
      const node = createTestNode(NodeType.METHOD, 'complexMethod', {
        metadata: {
          language: 'typescript',
          scope: [],
          modifiers: ['public', 'static', 'async'],
          imports: [],
          exports: [],
          annotations: [],
        },
      });
      
      const factors = calculator.calculateSignificanceFactors(node);
      expect(factors.contextFactor).toBeGreaterThan(0);
    });
  });

  describe('Usage Factor Adjustment', () => {
    it('should increase significance for main/primary functions', () => {
      const mainNode = createTestNode(NodeType.FUNCTION, 'main');
      const indexNode = createTestNode(NodeType.FUNCTION, 'indexHandler');
      const initNode = createTestNode(NodeType.FUNCTION, 'initialize');
      
      const mainFactors = calculator.calculateSignificanceFactors(mainNode);
      const indexFactors = calculator.calculateSignificanceFactors(indexNode);
      const initFactors = calculator.calculateSignificanceFactors(initNode);
      
      expect(mainFactors.usageFactor).toBeGreaterThan(0);
      expect(indexFactors.usageFactor).toBeGreaterThan(0);
      expect(initFactors.usageFactor).toBeGreaterThan(0);
    });

    it('should increase significance for API/public functions', () => {
      const apiNode = createTestNode(NodeType.FUNCTION, 'apiHandler');
      const publicNode = createTestNode(NodeType.METHOD, 'publicMethod');
      
      const apiFactors = calculator.calculateSignificanceFactors(apiNode);
      const publicFactors = calculator.calculateSignificanceFactors(publicNode);
      
      expect(apiFactors.usageFactor).toBeGreaterThan(0);
      expect(publicFactors.usageFactor).toBeGreaterThan(0);
    });

    it('should minimize significance for temporary/utility items', () => {
      const tempNode = createTestNode(NodeType.VARIABLE, 'tempVar');
      const utilNode = createTestNode(NodeType.FUNCTION, 'utilityHelper');
      const testNode = createTestNode(NodeType.FUNCTION, 'testHelper');
      
      const tempFactors = calculator.calculateSignificanceFactors(tempNode);
      const utilFactors = calculator.calculateSignificanceFactors(utilNode);
      const testFactors = calculator.calculateSignificanceFactors(testNode);
      
      // Usage factor has a floor of 0, so these should be 0 (minimum)
      expect(tempFactors.usageFactor).toBe(0);
      expect(utilFactors.usageFactor).toBe(0);
      expect(testFactors.usageFactor).toBe(0);
    });
  });

  describe('Batch Processing', () => {
    it('should calculate significance for multiple nodes', () => {
      const nodes = [
        createTestNode(NodeType.CLASS, 'TestClass'),
        createTestNode(NodeType.FUNCTION, 'testFunction'),
        createTestNode(NodeType.VARIABLE, 'testVar'),
        createTestNode(NodeType.COMMENT),
      ];
      
      const significances = calculator.calculateBatch(nodes);
      
      expect(significances).toHaveLength(4);
      expect(significances[0]).toBe(SignificanceLevel.CRITICAL); // Class
      expect(significances[1]).toBe(SignificanceLevel.HIGH); // Function
      expect(significances[2]).toBe(SignificanceLevel.LOW); // Variable
      expect(significances[3]).toBe(SignificanceLevel.MINIMAL); // Comment
    });

    it('should be consistent between single and batch calculations', () => {
      const nodes = [
        createTestNode(NodeType.FUNCTION, 'func1'),
        createTestNode(NodeType.METHOD, 'method1'),
      ];
      
      const singleResults = nodes.map(node => calculator.calculateSignificance(node));
      calculator.resetStats();
      const batchResults = calculator.calculateBatch(nodes);
      
      expect(batchResults).toEqual(singleResults);
    });
  });

  describe('Configuration', () => {
    it('should respect custom configuration', () => {
      const config: Partial<SignificanceConfig> = {
        enableComplexityAdjustment: false,
        minimumSignificance: SignificanceLevel.MEDIUM,
        maximumSignificance: SignificanceLevel.HIGH,
      };
      
      const customCalculator = new SignificanceCalculator(config);
      
      // Test minimum significance
      const commentNode = createTestNode(NodeType.COMMENT);
      const commentSignificance = customCalculator.calculateSignificance(commentNode);
      expect(commentSignificance).toBeGreaterThanOrEqual(SignificanceLevel.MEDIUM);
      
      // Test maximum significance
      const classNode = createTestNode(NodeType.CLASS, 'TestClass');
      const classSignificance = customCalculator.calculateSignificance(classNode);
      expect(classSignificance).toBeLessThanOrEqual(SignificanceLevel.HIGH);
    });

    it('should disable complexity adjustment when configured', () => {
      const config: Partial<SignificanceConfig> = {
        enableComplexityAdjustment: false,
      };
      
      const customCalculator = new SignificanceCalculator(config);
      
      const complexNode = createTestNode(NodeType.FUNCTION, 'complexFunction', {
        complexity: 20,
      });
      
      const context: Partial<SignificanceContext> = {
        children: Array(25).fill(null).map((_, i) => 
          createTestNode(NodeType.VARIABLE, `var${i}`)
        ),
      };
      
      const factors = customCalculator.calculateSignificanceFactors(complexNode, context);
      
      // Complexity factor should still be calculated but not applied
      expect(factors.complexityFactor).toBeGreaterThan(0);
      expect(factors.finalSignificance).toBe(SignificanceLevel.HIGH); // Base significance
    });
  });

  describe('Statistics', () => {
    it('should track calculation statistics', () => {
      const nodes = [
        createTestNode(NodeType.CLASS, 'Class1'),
        createTestNode(NodeType.CLASS, 'Class2'),
        createTestNode(NodeType.FUNCTION, 'func1'),
        createTestNode(NodeType.VARIABLE, 'var1'),
      ];
      
      calculator.calculateBatch(nodes);
      const stats = calculator.getStats();
      
      expect(stats.totalAnalyzed).toBe(4);
      expect(stats.distribution[SignificanceLevel.CRITICAL]).toBe(2); // Classes
      expect(stats.distribution[SignificanceLevel.HIGH]).toBe(1); // Function
      expect(stats.distribution[SignificanceLevel.LOW]).toBe(1); // Variable
      expect(stats.mostCommonLevel).toBe(SignificanceLevel.CRITICAL);
    });

    it('should calculate percentages correctly', () => {
      const nodes = [
        createTestNode(NodeType.CLASS, 'Class1'),
        createTestNode(NodeType.CLASS, 'Class2'),
        createTestNode(NodeType.VARIABLE, 'var1'),
        createTestNode(NodeType.VARIABLE, 'var2'),
      ];
      
      calculator.calculateBatch(nodes);
      const stats = calculator.getStats();
      
      expect(stats.percentageByLevel[SignificanceLevel.CRITICAL]).toBe(50);
      expect(stats.percentageByLevel[SignificanceLevel.LOW]).toBe(50);
      expect(stats.percentageByLevel[SignificanceLevel.HIGH]).toBe(0);
    });

    it('should reset statistics', () => {
      calculator.calculateSignificance(createTestNode(NodeType.CLASS, 'TestClass'));
      
      let stats = calculator.getStats();
      expect(stats.totalAnalyzed).toBe(1);
      
      calculator.resetStats();
      stats = calculator.getStats();
      expect(stats.totalAnalyzed).toBe(0);
      expect(stats.distribution[SignificanceLevel.CRITICAL]).toBe(0);
    });
  });

  describe('Explanation Generation', () => {
    it('should generate meaningful explanations', () => {
      const node = createTestNode(NodeType.FUNCTION, 'complexFunction', {
        complexity: 15,
        sourceText: 'function complexFunction() {\n' + '  return true;\n'.repeat(30) + '}',
      });
      
      const factors = calculator.calculateSignificanceFactors(node);
      
      expect(factors.explanation).toContain('Base: High');
      expect(factors.explanation).toContain('Complexity:');
      expect(factors.explanation).toContain('→');
    });

    it('should include all relevant factors in explanation', () => {
      const node = createTestNode(NodeType.FUNCTION, 'mainFunction', {
        metadata: {
          language: 'typescript',
          scope: [],
          modifiers: ['public', 'static'],
          imports: [],
          exports: ['default'],
          annotations: [],
          docstring: 'Main entry point',
        },
      });
      
      const context: Partial<SignificanceContext> = {
        fileContext: {
          totalNodes: 100,
          totalFunctions: 10,
          totalClasses: 5,
          isMainFile: true,
          isTestFile: false,
          isConfigFile: false,
        },
      };
      
      const factors = calculator.calculateSignificanceFactors(node, context);
      
      expect(factors.explanation).toContain('Context:');
      expect(factors.explanation).toContain('Usage:');
    });
  });
});

describe('SignificanceUtils', () => {
  describe('compareSignificance', () => {
    it('should sort significance levels correctly', () => {
      const levels = [
        SignificanceLevel.LOW,
        SignificanceLevel.CRITICAL,
        SignificanceLevel.MINIMAL,
        SignificanceLevel.HIGH,
        SignificanceLevel.MEDIUM,
      ];
      
      levels.sort(SignificanceUtils.compareSignificance);
      
      expect(levels).toEqual([
        SignificanceLevel.CRITICAL,
        SignificanceLevel.HIGH,
        SignificanceLevel.MEDIUM,
        SignificanceLevel.LOW,
        SignificanceLevel.MINIMAL,
      ]);
    });
  });

  describe('isAboveThreshold', () => {
    it('should correctly identify levels above threshold', () => {
      expect(SignificanceUtils.isAboveThreshold(
        SignificanceLevel.HIGH, 
        SignificanceLevel.MEDIUM
      )).toBe(true);
      
      expect(SignificanceUtils.isAboveThreshold(
        SignificanceLevel.LOW, 
        SignificanceLevel.MEDIUM
      )).toBe(false);
      
      expect(SignificanceUtils.isAboveThreshold(
        SignificanceLevel.MEDIUM, 
        SignificanceLevel.MEDIUM
      )).toBe(true);
    });
  });

  describe('filterBySignificance', () => {
    it('should filter nodes by significance threshold', () => {
      const nodes = [
        { significance: SignificanceLevel.CRITICAL } as ASTNode,
        { significance: SignificanceLevel.HIGH } as ASTNode,
        { significance: SignificanceLevel.MEDIUM } as ASTNode,
        { significance: SignificanceLevel.LOW } as ASTNode,
        { significance: SignificanceLevel.MINIMAL } as ASTNode,
      ];
      
      const filtered = SignificanceUtils.filterBySignificance(nodes, SignificanceLevel.MEDIUM);
      
      expect(filtered).toHaveLength(3);
      expect(filtered.every((node: ASTNode) => node.significance >= SignificanceLevel.MEDIUM)).toBe(true);
    });
  });

  describe('groupBySignificance', () => {
    it('should group nodes by significance level', () => {
      const nodes = [
        { significance: SignificanceLevel.CRITICAL } as ASTNode,
        { significance: SignificanceLevel.HIGH } as ASTNode,
        { significance: SignificanceLevel.HIGH } as ASTNode,
        { significance: SignificanceLevel.LOW } as ASTNode,
      ];
      
      const grouped = SignificanceUtils.groupBySignificance(nodes);
      
      expect(grouped[SignificanceLevel.CRITICAL]).toHaveLength(1);
      expect(grouped[SignificanceLevel.HIGH]).toHaveLength(2);
      expect(grouped[SignificanceLevel.MEDIUM]).toHaveLength(0);
      expect(grouped[SignificanceLevel.LOW]).toHaveLength(1);
      expect(grouped[SignificanceLevel.MINIMAL]).toHaveLength(0);
    });
  });
});

describe('Default Calculator Instance', () => {
  it('should provide a working default instance', () => {
    const node: ASTNode = {
      id: 'test-id',
      type: NodeType.FUNCTION,
      name: 'testFunction',
      filePath: '/test/file.ts',
      start: { line: 1, column: 0 },
      end: { line: 1, column: 10 },
      parent: undefined,
      children: [],
      metadata: {
        language: 'typescript',
        scope: [],
        modifiers: [],
        imports: [],
        exports: [],
        annotations: [],
      },
      significance: SignificanceLevel.LOW,
    };
    
    const significance = defaultSignificanceCalculator.calculateSignificance(node);
    expect(significance).toBe(SignificanceLevel.HIGH);
  });

  it('should maintain state across calls', () => {
    defaultSignificanceCalculator.resetStats();
    
    const node: ASTNode = {
      id: 'test-id',
      type: NodeType.CLASS,
      filePath: '/test/file.ts',
      start: { line: 1, column: 0 },
      end: { line: 1, column: 10 },
      parent: undefined,
      children: [],
      metadata: {
        language: 'typescript',
        scope: [],
        modifiers: [],
        imports: [],
        exports: [],
        annotations: [],
      },
      significance: SignificanceLevel.LOW,
    };
    
    defaultSignificanceCalculator.calculateSignificance(node);
    const stats = defaultSignificanceCalculator.getStats();
    
    expect(stats.totalAnalyzed).toBe(1);
  });
});