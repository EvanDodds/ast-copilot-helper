/**
 * Node Serializer Tests
 *
 * Comprehensive test suite for AST node serialization/deserialization functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  NodeSerializer,
  SerializationUtils,
  SerializationValidationError,
  SchemaMigrationError,
  DEFAULT_SERIALIZATION_CONFIG,
  CURRENT_SCHEMA_VERSION,
  SerializedASTNode,
  SerializedFile,
  SerializationConfig,
  defaultSerializer,
} from "../node-serializer";
import {
  ASTNode,
  NodeType,
  SignificanceLevel,
  Position,
  NodeMetadata,
} from "../ast-schema";

describe("NodeSerializer", () => {
  let serializer: NodeSerializer;
  let tempDir: string;

  // Sample data for tests
  const sampleMetadata: NodeMetadata = {
    language: "typescript",
    scope: ["file", "function", "testFunction"],
    modifiers: ["async", "export"],
    imports: ["fs", "path"],
    exports: ["testFunction"],
    docstring: "A test function for unit testing",
    annotations: ["@deprecated", "@async"],
    languageSpecific: {
      generics: ["T", "U"],
      isAsync: true,
      hasTypeAnnotations: true,
    },
  };

  const samplePosition: Position = {
    line: 5,
    column: 10,
  };

  const sampleNode: ASTNode = {
    id: "test-node-1",
    type: NodeType.FUNCTION,
    name: "testFunction",
    filePath: "/test/file.ts",
    start: samplePosition,
    end: { line: 10, column: 20 },
    parent: "parent-node-1",
    children: ["child-1", "child-2"],
    metadata: sampleMetadata,
    sourceText:
      "async function testFunction(param1: string, param2: number): Promise<void> { ... }",
    signature: "testFunction(param1: string, param2: number): Promise<void>",
    significance: SignificanceLevel.HIGH,
    complexity: 3,
  };

  const sampleRootNode: ASTNode = {
    id: "root-node",
    type: NodeType.FILE,
    name: "test-file.ts",
    filePath: "/test/file.ts",
    start: { line: 1, column: 0 },
    end: { line: 100, column: 0 },
    children: ["test-node-1", "test-node-2"],
    metadata: {
      language: "typescript",
      scope: ["file"],
      modifiers: [],
      imports: [],
      exports: [],
      docstring: "A test TypeScript file",
      annotations: [],
      languageSpecific: {
        hasTypeAnnotations: true,
      },
    },
    significance: SignificanceLevel.MEDIUM,
  };

  beforeEach(() => {
    serializer = new NodeSerializer();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "serializer-test-"));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("constructor", () => {
    it("should use default configuration when no config provided", () => {
      const defaultSerializer = new NodeSerializer();
      expect(defaultSerializer.getConfig()).toEqual(
        DEFAULT_SERIALIZATION_CONFIG,
      );
    });

    it("should merge provided config with defaults", () => {
      const customConfig: Partial<SerializationConfig> = {
        prettyPrint: true,
        includeSourceText: false,
      };
      const customSerializer = new NodeSerializer(customConfig);
      const config = customSerializer.getConfig();

      expect(config.prettyPrint).toBe(true);
      expect(config.includeSourceText).toBe(false);
      expect(config.includeMetadata).toBe(
        DEFAULT_SERIALIZATION_CONFIG.includeMetadata,
      );
    });
  });

  describe("serializeNode", () => {
    it("should serialize a complete node with all properties", () => {
      const serialized = serializer.serializeNode(sampleNode);

      expect(serialized).toMatchObject({
        $schema: CURRENT_SCHEMA_VERSION,
        id: sampleNode.id,
        type: sampleNode.type,
        name: sampleNode.name,
        filePath: sampleNode.filePath,
        start: sampleNode.start,
        end: sampleNode.end,
        parent: sampleNode.parent,
        children: sampleNode.children,
        metadata: sampleNode.metadata,
        sourceText: sampleNode.sourceText,
        signature: sampleNode.signature,
        significance: sampleNode.significance,
        complexity: sampleNode.complexity,
      });
      expect(serialized.serializedAt).toBeDefined();
      expect(new Date(serialized.serializedAt)).toBeInstanceOf(Date);
    });

    it("should serialize minimal node without optional properties", () => {
      const minimalNode: ASTNode = {
        id: "minimal-node",
        type: NodeType.VARIABLE,
        filePath: "/test/minimal.ts",
        start: { line: 1, column: 0 },
        end: { line: 1, column: 10 },
        children: [],
        metadata: {
          language: "typescript",
          scope: ["file", "variable"],
          modifiers: [],
          imports: [],
          exports: [],
          annotations: [],
        },
        significance: SignificanceLevel.MINIMAL,
      };

      const serialized = serializer.serializeNode(minimalNode);

      expect(serialized.id).toBe(minimalNode.id);
      expect(serialized.type).toBe(minimalNode.type);
      expect(serialized.name).toBeUndefined();
      expect(serialized.parent).toBeUndefined();
      expect(serialized.sourceText).toBeUndefined();
      expect(serialized.signature).toBeUndefined();
      expect(serialized.complexity).toBeUndefined();
    });

    it("should exclude sourceText when includeSourceText is false", () => {
      const configuredSerializer = new NodeSerializer({
        includeSourceText: false,
      });
      const serialized = configuredSerializer.serializeNode(sampleNode);

      expect(serialized.sourceText).toBeUndefined();
    });

    it("should validate node when validateOnSerialize is true", () => {
      const invalidNode = { ...sampleNode, id: "" } as ASTNode;

      expect(() => {
        serializer.serializeNode(invalidNode);
      }).toThrow(SerializationValidationError);
    });

    it("should skip validation when validateOnSerialize is false", () => {
      const nonValidatingSerializer = new NodeSerializer({
        validateOnSerialize: false,
      });
      const invalidNode = { ...sampleNode, id: "" } as ASTNode;

      expect(() => {
        nonValidatingSerializer.serializeNode(invalidNode);
      }).not.toThrow();
    });
  });

  describe("serializeFile", () => {
    it("should serialize multiple nodes with file metadata", () => {
      // Create a child node and a root that properly references it
      const childNode: ASTNode = {
        ...sampleNode,
        id: "child-node-not-root",
        parent: "root-node",
      };

      const rootWithChild: ASTNode = {
        ...sampleRootNode,
        children: ["child-node-not-root"], // Reference the child
      };

      const nodes = [rootWithChild, childNode];
      const serialized = serializer.serializeFile(
        nodes,
        "/test/file.ts",
        "typescript",
        "hash123",
      );

      expect(serialized).toMatchObject({
        $schema: CURRENT_SCHEMA_VERSION,
        filePath: "/test/file.ts",
        language: "typescript",
      });
      expect(serialized.nodes).toHaveLength(2);
      // nodeCount counts the root and its children recursively
      expect(serialized.metadata.nodeCount).toBe(2);
      expect(serialized.metadata.fileHash).toBe("hash123");
      expect(serialized.metadata.stats.totalNodes).toBe(2);
    });

    it("should calculate correct statistics", () => {
      const nodes = [
        {
          ...sampleNode,
          significance: SignificanceLevel.HIGH,
          type: NodeType.FUNCTION,
        },
        {
          ...sampleNode,
          id: "node2",
          significance: SignificanceLevel.MEDIUM,
          type: NodeType.CLASS,
        },
      ];

      const serialized = serializer.serializeFile(
        nodes,
        "/test/file.ts",
        "typescript",
      );

      expect(serialized.metadata.stats.totalNodes).toBe(2);
      expect(
        serialized.metadata.stats.significanceLevels[
          SignificanceLevel.HIGH.toString()
        ],
      ).toBe(1);
      expect(
        serialized.metadata.stats.significanceLevels[
          SignificanceLevel.MEDIUM.toString()
        ],
      ).toBe(1);
      expect(serialized.metadata.stats.nodeTypes[NodeType.FUNCTION]).toBe(1);
      expect(serialized.metadata.stats.nodeTypes[NodeType.CLASS]).toBe(1);
    });
  });

  describe("deserializeNode", () => {
    it("should deserialize a complete serialized node", () => {
      const serialized = serializer.serializeNode(sampleNode);
      const deserialized = serializer.deserializeNode(serialized);

      expect(deserialized).toMatchObject({
        id: sampleNode.id,
        type: sampleNode.type,
        name: sampleNode.name,
        filePath: sampleNode.filePath,
        start: sampleNode.start,
        end: sampleNode.end,
        parent: sampleNode.parent,
        children: sampleNode.children,
        metadata: sampleNode.metadata,
        sourceText: sampleNode.sourceText,
        signature: sampleNode.signature,
        significance: sampleNode.significance,
        complexity: sampleNode.complexity,
      });
    });

    it("should deserialize minimal serialized node", () => {
      const serializedMinimal: SerializedASTNode = {
        $schema: CURRENT_SCHEMA_VERSION,
        id: "minimal",
        type: NodeType.VARIABLE,
        filePath: "/test/minimal.ts",
        start: { line: 1, column: 0 },
        end: { line: 1, column: 10 },
        children: [],
        metadata: {
          language: "typescript",
          scope: ["file", "variable"],
          modifiers: [],
          imports: [],
          exports: [],
          annotations: [],
        },
        significance: SignificanceLevel.MINIMAL,
        serializedAt: new Date().toISOString(),
      };

      const deserialized = serializer.deserializeNode(serializedMinimal);

      expect(deserialized.id).toBe("minimal");
      expect(deserialized.type).toBe(NodeType.VARIABLE);
      expect(deserialized.name).toBeUndefined();
      expect(deserialized.parent).toBeUndefined();
    });

    it("should validate serialized data when validateOnDeserialize is true", () => {
      const invalidSerialized = {
        ...serializer.serializeNode(sampleNode),
        id: "", // Invalid ID
      };

      expect(() => {
        serializer.deserializeNode(invalidSerialized);
      }).toThrow(SerializationValidationError);
    });
  });

  describe("deserializeFile", () => {
    it("should deserialize a complete file structure", () => {
      const nodes = [sampleRootNode, sampleNode];
      const serialized = serializer.serializeFile(
        nodes,
        "/test/file.ts",
        "typescript",
      );
      const deserialized = serializer.deserializeFile(serialized);

      expect(deserialized.filePath).toBe("/test/file.ts");
      expect(deserialized.language).toBe("typescript");
      expect(deserialized.nodes).toHaveLength(2);
      expect(deserialized.metadata).toBeDefined();
    });
  });

  describe("file operations", () => {
    it("should save and load serialized data to/from file", async () => {
      const nodes = [sampleRootNode, sampleNode];
      const outputPath = path.join(tempDir, "test-output.json");

      // Save to file
      await serializer.saveToFile(
        nodes,
        "/test/file.ts",
        outputPath,
        "typescript",
        "hash123",
      );

      expect(fs.existsSync(outputPath)).toBe(true);

      // Load from file
      const loaded = await serializer.loadFromFile(outputPath);

      expect(loaded.filePath).toBe("/test/file.ts");
      expect(loaded.language).toBe("typescript");
      expect(loaded.nodes).toHaveLength(2);
      expect(loaded.metadata.fileHash).toBe("hash123");
    });

    it("should create output directory if it does not exist", async () => {
      const nestedDir = path.join(tempDir, "nested", "deep", "directory");
      const outputPath = path.join(nestedDir, "test-output.json");

      await serializer.saveToFile(
        [sampleNode],
        "/test/file.ts",
        outputPath,
        "typescript",
      );

      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it("should handle pretty print configuration", async () => {
      const prettySerializer = new NodeSerializer({ prettyPrint: true });
      const outputPath = path.join(tempDir, "pretty-output.json");

      await prettySerializer.saveToFile(
        [sampleNode],
        "/test/file.ts",
        outputPath,
        "typescript",
      );

      const content = fs.readFileSync(outputPath, "utf8");
      expect(content).toContain("\n"); // Pretty printed JSON should have newlines
      expect(content).toContain("  "); // Should have indentation
    });
  });

  describe("round-trip validation", () => {
    it("should validate successful round-trip serialization", () => {
      const serialized = serializer.serializeNode(sampleNode);
      const deserialized = serializer.deserializeNode(serialized);

      const isValid = serializer.validateRoundTrip(
        sampleNode,
        serialized,
        deserialized,
      );
      expect(isValid).toBe(true);
    });

    it("should detect round-trip failures for modified data", () => {
      const serialized = serializer.serializeNode(sampleNode);
      const deserialized = serializer.deserializeNode(serialized);

      // Modify deserialized data
      deserialized.name = "different-name";

      const isValid = serializer.validateRoundTrip(
        sampleNode,
        serialized,
        deserialized,
      );
      expect(isValid).toBe(false);
    });

    it("should validate positions correctly", () => {
      const nodeWithDifferentEnd = { ...sampleNode };
      const serialized = serializer.serializeNode(sampleNode);
      const deserialized = serializer.deserializeNode(serialized);

      // Modify end position
      deserialized.end = { line: 999, column: 999 };

      const isValid = serializer.validateRoundTrip(
        nodeWithDifferentEnd,
        serialized,
        deserialized,
      );
      expect(isValid).toBe(false);
    });

    it("should validate children arrays correctly", () => {
      const serialized = serializer.serializeNode(sampleNode);
      const deserialized = serializer.deserializeNode(serialized);

      // Modify children
      deserialized.children = ["different-child"];

      const isValid = serializer.validateRoundTrip(
        sampleNode,
        serialized,
        deserialized,
      );
      expect(isValid).toBe(false);
    });
  });

  describe("configuration management", () => {
    it("should update configuration correctly", () => {
      const initialConfig = serializer.getConfig();
      const newConfig: Partial<SerializationConfig> = {
        prettyPrint: true,
        includeSourceText: false,
      };

      serializer.updateConfig(newConfig);
      const updatedConfig = serializer.getConfig();

      expect(updatedConfig.prettyPrint).toBe(true);
      expect(updatedConfig.includeSourceText).toBe(false);
      expect(updatedConfig.includeMetadata).toBe(initialConfig.includeMetadata);
    });

    it("should return immutable configuration copy", () => {
      const config = serializer.getConfig();
      config.prettyPrint = true;

      const freshConfig = serializer.getConfig();
      expect(freshConfig.prettyPrint).toBe(
        DEFAULT_SERIALIZATION_CONFIG.prettyPrint,
      );
    });
  });

  describe("statistics and analysis", () => {
    it("should calculate serialization statistics", () => {
      const nodes = [
        {
          ...sampleNode,
          type: NodeType.FUNCTION,
          significance: SignificanceLevel.HIGH,
        },
        {
          ...sampleNode,
          id: "node2",
          type: NodeType.CLASS,
          significance: SignificanceLevel.MEDIUM,
        },
        {
          ...sampleNode,
          id: "node3",
          type: NodeType.FUNCTION,
          significance: SignificanceLevel.LOW,
        },
      ];

      const stats = serializer.getSerializationStats(nodes);

      expect(stats.totalNodes).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.typeDistribution[NodeType.FUNCTION]).toBe(2);
      expect(stats.typeDistribution[NodeType.CLASS]).toBe(1);
      expect(
        stats.significanceDistribution[SignificanceLevel.HIGH.toString()],
      ).toBe(1);
      expect(
        stats.significanceDistribution[SignificanceLevel.MEDIUM.toString()],
      ).toBe(1);
      expect(
        stats.significanceDistribution[SignificanceLevel.LOW.toString()],
      ).toBe(1);
    });

    it("should handle empty node list", () => {
      const stats = serializer.getSerializationStats([]);

      expect(stats.totalNodes).toBe(0);
      expect(stats.averageDepth).toBe(0);
      expect(stats.maxDepth).toBe(0);
      expect(Object.keys(stats.typeDistribution)).toHaveLength(0);
    });
  });

  describe("validation", () => {
    it("should validate valid ASTNode", () => {
      expect(() => {
        (serializer as any).validateASTNode(sampleNode);
      }).not.toThrow();
    });

    it("should throw for missing required fields", () => {
      const invalidNode = { ...sampleNode, id: "" };

      expect(() => {
        (serializer as any).validateASTNode(invalidNode);
      }).toThrow(SerializationValidationError);
    });

    it("should validate position structure", () => {
      const invalidPositionNode = {
        ...sampleNode,
        start: { line: -1, column: 0 } as Position,
      };

      expect(() => {
        (serializer as any).validateASTNode(invalidPositionNode);
      }).toThrow(SerializationValidationError);
    });

    it("should validate significance level", () => {
      const invalidSignificanceNode = {
        ...sampleNode,
        significance: "invalid" as any,
      };

      expect(() => {
        (serializer as any).validateASTNode(invalidSignificanceNode);
      }).toThrow(SerializationValidationError);
    });
  });

  describe("schema migration", () => {
    it("should handle current schema version without migration", () => {
      const serialized = serializer.serializeNode(sampleNode);
      const migrated = (serializer as any).migrateSchema(serialized);

      expect(migrated).toBe(serialized); // Should be same object
    });

    it("should throw error for unsupported schema versions", () => {
      const unsupportedSerialized = {
        ...serializer.serializeNode(sampleNode),
        $schema: "999.0.0",
      };

      expect(() => {
        (serializer as any).migrateSchema(unsupportedSerialized);
      }).toThrow(SchemaMigrationError);
    });
  });

  describe("error handling", () => {
    it("should handle malformed JSON files gracefully", async () => {
      const malformedPath = path.join(tempDir, "malformed.json");
      fs.writeFileSync(malformedPath, "{ invalid json }");

      await expect(serializer.loadFromFile(malformedPath)).rejects.toThrow();
    });

    it("should handle non-existent input files", async () => {
      const nonExistentPath = path.join(tempDir, "does-not-exist.json");

      await expect(serializer.loadFromFile(nonExistentPath)).rejects.toThrow();
    });
  });
});

describe("SerializationUtils", () => {
  describe("preset serializers", () => {
    it("should create minimal serializer with correct configuration", () => {
      const minimalSerializer = SerializationUtils.createMinimalSerializer();
      const config = minimalSerializer.getConfig();

      expect(config.includeMetadata).toBe(false);
      expect(config.includeSourceText).toBe(false);
      expect(config.prettyPrint).toBe(false);
      expect(config.validateOnSerialize).toBe(false);
      expect(config.validateOnDeserialize).toBe(false);
    });

    it("should create validating serializer with correct configuration", () => {
      const validatingSerializer =
        SerializationUtils.createValidatingSerializer();
      const config = validatingSerializer.getConfig();

      expect(config.includeMetadata).toBe(true);
      expect(config.includeSourceText).toBe(true);
      expect(config.prettyPrint).toBe(true);
      expect(config.validateOnSerialize).toBe(true);
      expect(config.validateOnDeserialize).toBe(true);
    });

    it("should create debug serializer with correct configuration", () => {
      const debugSerializer = SerializationUtils.createDebugSerializer();
      const config = debugSerializer.getConfig();

      expect(config.includeMetadata).toBe(true);
      expect(config.includeSourceText).toBe(true);
      expect(config.prettyPrint).toBe(true);
      expect(config.validateOnSerialize).toBe(true);
      expect(config.validateOnDeserialize).toBe(true);
    });
  });

  describe("utility functions", () => {
    const sampleNode: ASTNode = {
      id: "test",
      type: NodeType.FUNCTION,
      filePath: "/test.ts",
      start: { line: 1, column: 0 },
      end: { line: 5, column: 10 },
      children: [],
      metadata: {
        language: "typescript",
        scope: ["file", "function"],
        modifiers: [],
        imports: [],
        exports: [],
        docstring: "Test function",
        annotations: [],
      },
      significance: SignificanceLevel.MEDIUM,
      name: "testFunction",
      sourceText: "function testFunction() { return 42; }",
    };

    it("should estimate serialized size", () => {
      const nodes = [sampleNode];
      const estimatedSize = SerializationUtils.estimateSerializedSize(nodes);

      expect(estimatedSize).toBeGreaterThan(0);
      expect(typeof estimatedSize).toBe("number");
    });

    it("should calculate compression ratio", () => {
      const original = "a".repeat(1000);
      const compressed = "a".repeat(100);

      const ratio = SerializationUtils.calculateCompressionRatio(
        original,
        compressed,
      );

      expect(ratio).toBe(0.9); // 90% compression
    });

    it("should handle zero-length strings in compression ratio", () => {
      const original = "";
      const compressed = "";

      const ratio = SerializationUtils.calculateCompressionRatio(
        original,
        compressed,
      );

      expect(ratio).toBe(0); // No compression possible
    });
  });
});

describe("defaultSerializer", () => {
  it("should be properly initialized", () => {
    expect(defaultSerializer).toBeDefined();
    expect(defaultSerializer.getConfig()).toEqual(DEFAULT_SERIALIZATION_CONFIG);
  });

  it("should be reusable across calls", () => {
    const sampleNode: ASTNode = {
      id: "test",
      type: NodeType.VARIABLE,
      filePath: "/test.ts",
      start: { line: 1, column: 0 },
      end: { line: 1, column: 10 },
      children: [],
      metadata: {
        language: "typescript",
        scope: ["file", "variable"],
        modifiers: [],
        imports: [],
        exports: [],
        annotations: [],
      },
      significance: SignificanceLevel.MINIMAL,
    };

    const serialized1 = defaultSerializer.serializeNode(sampleNode);
    const serialized2 = defaultSerializer.serializeNode({
      ...sampleNode,
      id: "test2",
    });

    expect(serialized1.id).toBe("test");
    expect(serialized2.id).toBe("test2");
  });
});
