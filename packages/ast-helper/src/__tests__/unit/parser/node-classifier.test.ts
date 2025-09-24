import { describe, it, expect, beforeEach } from "vitest";
import {
  NodeClassifier,
  ClassificationUtils,
  RawNodeData,
  ClassificationResult,
  LanguageMapping,
  defaultNodeClassifier,
} from "../../../parser/node-classifier";
import { NodeType } from "../../../parser/ast-schema";

describe("Node Classifier", () => {
  let classifier: NodeClassifier;

  beforeEach(() => {
    classifier = new NodeClassifier();
    classifier.resetStats();
  });

  describe("TypeScript Classification", () => {
    const createTSNode = (
      type: string,
      name?: string,
      parent?: RawNodeData,
    ): RawNodeData => ({
      type,
      name,
      language: "typescript",
      parent,
    });

    it("should classify TypeScript classes correctly", () => {
      const node = createTSNode("class_declaration", "MyClass");
      const result = classifier.classifyNode(node);

      expect(result.nodeType).toBe(NodeType.CLASS);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reason).toContain("Direct mapping");
    });

    it("should classify TypeScript functions correctly", () => {
      const node = createTSNode("function_declaration", "myFunction");
      const result = classifier.classifyNode(node);

      expect(result.nodeType).toBe(NodeType.FUNCTION);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should classify TypeScript methods correctly", () => {
      const node = createTSNode("method_definition", "myMethod");
      const result = classifier.classifyNode(node);

      expect(result.nodeType).toBe(NodeType.METHOD);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should classify TypeScript interfaces correctly", () => {
      const node = createTSNode("interface_declaration", "MyInterface");
      const result = classifier.classifyNode(node);

      expect(result.nodeType).toBe(NodeType.INTERFACE);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should classify TypeScript variables correctly", () => {
      const node = createTSNode("variable_declarator", "myVar");
      const result = classifier.classifyNode(node);

      expect(result.nodeType).toBe(NodeType.VARIABLE);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should classify TypeScript control flow correctly", () => {
      const ifNode = createTSNode("if_statement");
      const forNode = createTSNode("for_statement");
      const whileNode = createTSNode("while_statement");

      expect(classifier.classifyNode(ifNode).nodeType).toBe(
        NodeType.IF_STATEMENT,
      );
      expect(classifier.classifyNode(forNode).nodeType).toBe(NodeType.FOR_LOOP);
      expect(classifier.classifyNode(whileNode).nodeType).toBe(
        NodeType.WHILE_LOOP,
      );
    });

    it("should classify TypeScript imports/exports correctly", () => {
      const importNode = createTSNode("import_declaration");
      const exportNode = createTSNode("export_declaration");

      expect(classifier.classifyNode(importNode).nodeType).toBe(
        NodeType.IMPORT,
      );
      expect(classifier.classifyNode(exportNode).nodeType).toBe(
        NodeType.EXPORT,
      );
    });

    it("should handle context-aware classification", () => {
      const classParent = createTSNode("class_declaration", "MyClass");
      const identifierNode = createTSNode(
        "identifier",
        "className",
        classParent,
      );

      const result = classifier.classifyNode(identifierNode, {
        parent: classParent,
      });

      expect(result.nodeType).toBe(NodeType.CLASS);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.reason).toContain("Context rule");
    });
  });

  describe("JavaScript Classification", () => {
    const createJSNode = (type: string, name?: string): RawNodeData => ({
      type,
      name,
      language: "javascript",
    });

    it("should classify JavaScript classes correctly", () => {
      const node = createJSNode("class_declaration", "MyClass");
      const result = classifier.classifyNode(node);

      expect(result.nodeType).toBe(NodeType.CLASS);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should classify JavaScript functions correctly", () => {
      const funcDecl = createJSNode("function_declaration", "myFunction");
      const funcExpr = createJSNode("function_expression");
      const arrowFunc = createJSNode("arrow_function");

      expect(classifier.classifyNode(funcDecl).nodeType).toBe(
        NodeType.FUNCTION,
      );
      expect(classifier.classifyNode(funcExpr).nodeType).toBe(
        NodeType.FUNCTION,
      );
      expect(classifier.classifyNode(arrowFunc).nodeType).toBe(
        NodeType.ARROW_FUNCTION,
      );
    });

    it("should classify JavaScript variables correctly", () => {
      const node = createJSNode("variable_declarator", "myVar");
      const result = classifier.classifyNode(node);

      expect(result.nodeType).toBe(NodeType.VARIABLE);
    });
  });

  describe("Python Classification", () => {
    const createPyNode = (
      type: string,
      name?: string,
      parent?: RawNodeData,
    ): RawNodeData => ({
      type,
      name,
      language: "python",
      parent,
    });

    it("should classify Python classes correctly", () => {
      const node = createPyNode("class_definition", "MyClass");
      const result = classifier.classifyNode(node);

      expect(result.nodeType).toBe(NodeType.CLASS);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it("should classify Python functions correctly", () => {
      const funcNode = createPyNode("function_definition", "my_function");
      const lambdaNode = createPyNode("lambda");

      expect(classifier.classifyNode(funcNode).nodeType).toBe(
        NodeType.FUNCTION,
      );
      expect(classifier.classifyNode(lambdaNode).nodeType).toBe(
        NodeType.ARROW_FUNCTION,
      );
    });

    it("should classify Python control flow correctly", () => {
      const ifNode = createPyNode("if_statement");
      const forNode = createPyNode("for_statement");
      const whileNode = createPyNode("while_statement");
      const withNode = createPyNode("with_statement");
      const tryNode = createPyNode("try_statement");

      expect(classifier.classifyNode(ifNode).nodeType).toBe(
        NodeType.IF_STATEMENT,
      );
      expect(classifier.classifyNode(forNode).nodeType).toBe(NodeType.FOR_LOOP);
      expect(classifier.classifyNode(whileNode).nodeType).toBe(
        NodeType.WHILE_LOOP,
      );
      expect(classifier.classifyNode(withNode).nodeType).toBe(
        NodeType.TRY_CATCH,
      );
      expect(classifier.classifyNode(tryNode).nodeType).toBe(
        NodeType.TRY_CATCH,
      );
    });

    it("should handle Python context rules", () => {
      const funcParent = createPyNode("function_definition", "my_function");
      const identifierNode = createPyNode(
        "identifier",
        "func_name",
        funcParent,
      );

      const result = classifier.classifyNode(identifierNode, {
        parent: funcParent,
      });

      expect(result.nodeType).toBe(NodeType.FUNCTION);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it("should classify Python class attributes", () => {
      const classParent = createPyNode("class_definition", "MyClass");
      const assignmentNode = createPyNode(
        "assignment",
        "attribute",
        classParent,
      );

      const result = classifier.classifyNode(assignmentNode, {
        parent: classParent,
      });

      expect(result.nodeType).toBe(NodeType.FIELD);
      expect(result.reason).toContain("Class attribute assignment");
    });
  });

  describe("Pattern Matching", () => {
    it("should use pattern matching for unknown specific types", () => {
      const node: RawNodeData = {
        type: "some_function_type",
        language: "typescript",
      };

      const result = classifier.classifyNode(node);

      expect(result.nodeType).toBe(NodeType.FUNCTION);
      expect(result.confidence).toBe(0.7);
      expect(result.reason).toContain("Pattern match");
    });

    it("should prioritize higher priority patterns", () => {
      const node: RawNodeData = {
        type: "custom_method_definition",
        language: "typescript",
      };

      const result = classifier.classifyNode(node);

      // Should match method pattern over function pattern due to specificity
      expect(result.nodeType).toBe(NodeType.METHOD);
    });
  });

  describe("Fallback Behavior", () => {
    it("should use fallback for completely unknown types", () => {
      const node: RawNodeData = {
        type: "completely_unknown_type",
        language: "typescript",
      };

      const result = classifier.classifyNode(node);

      expect(result.nodeType).toBe(NodeType.VARIABLE); // TypeScript default fallback
      expect(result.confidence).toBe(0.5);
      expect(result.reason).toContain("Fallback");
    });

    it("should handle unknown languages gracefully", () => {
      const node: RawNodeData = {
        type: "some_type",
        language: "unknown_language",
      };

      const result = classifier.classifyNode(node);

      expect(result.nodeType).toBe(NodeType.VARIABLE); // Default fallback
      expect(result.confidence).toBe(0.5);
    });
  });

  describe("Batch Classification", () => {
    it("should classify multiple nodes correctly", () => {
      const nodes: RawNodeData[] = [
        { type: "class_declaration", language: "typescript", name: "Class1" },
        { type: "function_declaration", language: "typescript", name: "func1" },
        { type: "variable_declarator", language: "typescript", name: "var1" },
      ];

      const results = classifier.classifyBatch(nodes);

      expect(results).toHaveLength(3);
      expect(results[0].nodeType).toBe(NodeType.CLASS);
      expect(results[1].nodeType).toBe(NodeType.FUNCTION);
      expect(results[2].nodeType).toBe(NodeType.VARIABLE);
    });

    it("should maintain classification order in batch", () => {
      const nodes: RawNodeData[] = [
        { type: "if_statement", language: "python" },
        { type: "for_statement", language: "python" },
        { type: "while_statement", language: "python" },
      ];

      const results = classifier.classifyBatch(nodes);

      expect(results[0].nodeType).toBe(NodeType.IF_STATEMENT);
      expect(results[1].nodeType).toBe(NodeType.FOR_LOOP);
      expect(results[2].nodeType).toBe(NodeType.WHILE_LOOP);
    });
  });

  describe("Language Support", () => {
    it("should list supported languages", () => {
      const languages = classifier.getSupportedLanguages();

      expect(languages).toContain("typescript");
      expect(languages).toContain("javascript");
      expect(languages).toContain("python");
      expect(languages.length).toBeGreaterThanOrEqual(3);
    });

    it("should allow adding new language mappings", () => {
      const newMapping: LanguageMapping = {
        directMappings: {
          custom_function: NodeType.FUNCTION,
          custom_class: NodeType.CLASS,
        },
        patternMappings: [],
        contextRules: [],
        defaultFallback: NodeType.VARIABLE,
      };

      classifier.addLanguageMapping("custom-lang", newMapping);

      const languages = classifier.getSupportedLanguages();
      expect(languages).toContain("custom-lang");

      // Test the new mapping
      const node: RawNodeData = {
        type: "custom_function",
        language: "custom-lang",
      };

      const result = classifier.classifyNode(node);
      expect(result.nodeType).toBe(NodeType.FUNCTION);
    });
  });

  describe("Statistics Tracking", () => {
    it("should track classification statistics", () => {
      const nodes: RawNodeData[] = [
        { type: "class_declaration", language: "typescript" },
        { type: "function_declaration", language: "typescript" },
        { type: "class_definition", language: "python" },
      ];

      nodes.forEach((node) => classifier.classifyNode(node));

      const stats = classifier.getStats();

      expect(stats.totalClassified).toBe(3);
      expect(stats.byLanguage.typescript).toBe(2);
      expect(stats.byLanguage.python).toBe(1);
      expect(stats.byNodeType.class).toBe(2);
      expect(stats.byNodeType.function).toBe(1);
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });

    it("should reset statistics correctly", () => {
      const node: RawNodeData = {
        type: "class_declaration",
        language: "typescript",
      };
      classifier.classifyNode(node);

      classifier.resetStats();
      const stats = classifier.getStats();

      expect(stats.totalClassified).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(Object.keys(stats.byLanguage)).toHaveLength(0);
    });

    it("should track fallback usage", () => {
      const unknownNode: RawNodeData = {
        type: "completely_unknown",
        language: "typescript",
      };

      classifier.classifyNode(unknownNode);
      const stats = classifier.getStats();

      expect(stats.fallbackUsage).toBe(1);
    });
  });

  describe("Accuracy Validation", () => {
    it("should validate classification accuracy", () => {
      const testData = [
        {
          node: { type: "class_declaration", language: "typescript" },
          expected: NodeType.CLASS,
        },
        {
          node: { type: "function_declaration", language: "typescript" },
          expected: NodeType.FUNCTION,
        },
        {
          node: { type: "variable_declarator", language: "typescript" },
          expected: NodeType.VARIABLE,
        },
        {
          node: { type: "unknown_type", language: "typescript" },
          expected: NodeType.VARIABLE,
        }, // This should be wrong
      ];

      const accuracy = classifier.validateAccuracy(testData);

      expect(accuracy.total).toBe(4);
      expect(accuracy.correct).toBeGreaterThan(2); // At least 3/4 should be correct
      expect(accuracy.percentage).toBeGreaterThan(50);
    });
  });

  describe("Error Handling", () => {
    it("should handle classification errors gracefully", () => {
      // Create a node that might cause issues
      const problematicNode: RawNodeData = {
        type: "error_prone_type",
        language: "typescript",
        properties: undefined, // This could cause issues in some scenarios
      };

      const result = classifier.classifyNode(problematicNode);

      // Should still return a valid result (fallback)
      expect(result.nodeType).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reason).toBeDefined();
    });
  });

  describe("ClassificationUtils", () => {
    describe("isContainerType", () => {
      it("should identify container types correctly", () => {
        expect(ClassificationUtils.isContainerType(NodeType.FILE)).toBe(true);
        expect(ClassificationUtils.isContainerType(NodeType.CLASS)).toBe(true);
        expect(ClassificationUtils.isContainerType(NodeType.FUNCTION)).toBe(
          true,
        );
        expect(ClassificationUtils.isContainerType(NodeType.IF_STATEMENT)).toBe(
          true,
        );

        expect(ClassificationUtils.isContainerType(NodeType.VARIABLE)).toBe(
          false,
        );
        expect(ClassificationUtils.isContainerType(NodeType.PARAMETER)).toBe(
          false,
        );
        expect(
          ClassificationUtils.isContainerType(NodeType.STRING_LITERAL),
        ).toBe(false);
      });
    });

    describe("isDeclarationType", () => {
      it("should identify declaration types correctly", () => {
        expect(ClassificationUtils.isDeclarationType(NodeType.CLASS)).toBe(
          true,
        );
        expect(ClassificationUtils.isDeclarationType(NodeType.FUNCTION)).toBe(
          true,
        );
        expect(ClassificationUtils.isDeclarationType(NodeType.VARIABLE)).toBe(
          true,
        );
        expect(ClassificationUtils.isDeclarationType(NodeType.INTERFACE)).toBe(
          true,
        );

        expect(
          ClassificationUtils.isDeclarationType(NodeType.IF_STATEMENT),
        ).toBe(false);
        expect(ClassificationUtils.isDeclarationType(NodeType.COMMENT)).toBe(
          false,
        );
        expect(
          ClassificationUtils.isDeclarationType(NodeType.STRING_LITERAL),
        ).toBe(false);
      });
    });

    describe("getHierarchyLevel", () => {
      it("should return correct hierarchy levels", () => {
        expect(ClassificationUtils.getHierarchyLevel(NodeType.FILE)).toBe(0);
        expect(ClassificationUtils.getHierarchyLevel(NodeType.MODULE)).toBe(1);
        expect(ClassificationUtils.getHierarchyLevel(NodeType.CLASS)).toBe(3);
        expect(ClassificationUtils.getHierarchyLevel(NodeType.FUNCTION)).toBe(
          4,
        );
        expect(ClassificationUtils.getHierarchyLevel(NodeType.VARIABLE)).toBe(
          6,
        );
        expect(ClassificationUtils.getHierarchyLevel(NodeType.PARAMETER)).toBe(
          7,
        );

        // Test default level for unmapped types
        expect(ClassificationUtils.getHierarchyLevel(NodeType.COMMENT)).toBe(8);
      });
    });
  });

  describe("Default Instance", () => {
    it("should provide default singleton instance", () => {
      expect(defaultNodeClassifier).toBeDefined();
      expect(defaultNodeClassifier instanceof NodeClassifier).toBe(true);
    });

    it("should classify nodes correctly with default instance", () => {
      const node: RawNodeData = {
        type: "class_declaration",
        language: "typescript",
        name: "MyClass",
      };

      const result = defaultNodeClassifier.classifyNode(node);

      expect(result.nodeType).toBe(NodeType.CLASS);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe("Advanced Features", () => {
    it("should provide alternative classifications", () => {
      const node: RawNodeData = {
        type: "custom_function_like_thing",
        language: "typescript",
      };

      const result = classifier.classifyNode(node);

      // This node type should match function pattern and get classified as function
      expect(result.nodeType).toBe(NodeType.FUNCTION);
      expect(result.confidence).toBe(0.7); // Pattern match confidence
      expect(result.reason).toContain("Pattern match");

      // Check that the result has the expected structure
      expect(result.alternatives).toBeDefined();
    });

    it("should maintain confidence scores over time", () => {
      // Classify many nodes to test rolling average
      for (let i = 0; i < 100; i++) {
        const node: RawNodeData = {
          type: i % 2 === 0 ? "class_declaration" : "function_declaration",
          language: "typescript",
        };
        classifier.classifyNode(node);
      }

      const stats = classifier.getStats();
      expect(stats.averageConfidence).toBeGreaterThan(0.8); // Should be high for known types
      expect(stats.totalClassified).toBe(100);
    });
  });
});
