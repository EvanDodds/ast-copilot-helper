import { describe, it, expect, vi, beforeEach } from "vitest";
import { BaseParser } from "../parsers/base-parser.js";
import { ParserFactory } from "../parsers/factory.js";
import { TreeSitterGrammarManager } from "../grammar-manager.js";
import { LanguageConfig, ParseResult, ParserRuntime } from "../types.js";

// Mock implementations for testing
class MockRuntime implements ParserRuntime {
  type: "native" | "wasm" = "native";
  available = true;

  async initialize(): Promise<void> {
    // Mock implementation
  }

  async createParser(_language: string): Promise<any> {
    return {
      parse: () => ({
        rootNode: {
          isNamed: true,
          type: "program",
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 1, column: 0 },
          childCount: 0,
          hasError: false,
          isMissing: false,
          child: () => null,
        },
        walk: () => ({
          currentNode: {
            isNamed: true,
            type: "program",
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 1, column: 0 },
            hasError: false,
            isMissing: false,
          },
          gotoFirstChild: () => false,
          gotoNextSibling: () => false,
          gotoParent: () => false,
        }),
      }),
    };
  }
}

class MockParser extends BaseParser {
  constructor(runtime: ParserRuntime) {
    super(runtime);
  }

  protected async getParserForLanguage(config: LanguageConfig): Promise<any> {
    return this.runtime.createParser(config.name);
  }

  protected treeToASTNodes(
    tree: any,
    sourceCode: string,
    filePath: string,
    language: string,
  ) {
    return [
      {
        id: "mock-id",
        type: "program",
        filePath,
        start: { line: 1, column: 1 },
        end: { line: 1, column: sourceCode.length + 1 },
        children: [],
        metadata: {
          language,
          scope: [],
          modifiers: [],
          complexity: 1,
        },
      },
    ];
  }
}

describe("AST Parser Classes", () => {
  let mockRuntime: MockRuntime;
  let grammarManager: TreeSitterGrammarManager;

  beforeEach(() => {
    mockRuntime = new MockRuntime();
    grammarManager = new TreeSitterGrammarManager();

    // Mock the downloadGrammar method to avoid actual downloads
    vi.spyOn(grammarManager, "downloadGrammar").mockResolvedValue(
      "/mock/path/grammar.wasm",
    );
  });

  describe("BaseParser", () => {
    let parser: MockParser;

    beforeEach(() => {
      parser = new MockParser(mockRuntime);
    });

    describe("parseCode", () => {
      it("should parse TypeScript code successfully", async () => {
        const code = "const x = 1;";
        const result = await parser.parseCode(code, "typescript");

        expect(result.language).toBe("typescript");
        expect(result.nodes).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
        expect(result.parseTime).toBeGreaterThan(0);
      });

      it("should handle unsupported language", async () => {
        const code = "const x = 1;";
        const result = await parser.parseCode(code, "unsupported");

        expect(result.language).toBe("unsupported");
        expect(result.nodes).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].type).toBe("runtime");
        expect(result.errors[0].message).toContain("Unsupported language");
      });

      it("should handle empty code", async () => {
        const code = "";
        const result = await parser.parseCode(code, "typescript");

        expect(result.language).toBe("typescript");
        expect(result.nodes).toHaveLength(1); // Mock parser always returns one node
        expect(result.parseTime).toBeGreaterThan(0);
      });
    });

    describe("batchParseFiles", () => {
      it("should handle empty file list", async () => {
        const results = await parser.batchParseFiles([]);
        expect(results.size).toBe(0);
      });

      it("should process multiple files", async () => {
        // This test verifies that the parser handles multiple files, though
        // the exact language detection depends on the language detection module
        const files = ["test1.unknown", "test2.unknown"];
        const results = await parser.batchParseFiles(files);

        expect(results.size).toBe(2);

        for (const [filePath] of results) {
          expect(filePath).toMatch(/test[12]\.unknown$/);
        }
      });

      it("should handle unsupported files", async () => {
        const files = ["test.txt", "data.json"];
        const results = await parser.batchParseFiles(files);

        expect(results.size).toBe(2);

        for (const [_filePath, result] of results) {
          expect(result.language).toBe("");
          expect(result.nodes).toHaveLength(0);
          expect(result.errors).toHaveLength(1);
          expect(result.errors[0].type).toBe("runtime");
        }
      });

      it("should call progress callback", async () => {
        const onProgress = vi.fn();
        const files = ["test.txt"]; // Unsupported file for quick processing

        await parser.batchParseFiles(files, { onProgress });

        expect(onProgress).toHaveBeenCalledWith(1, 1, "test.txt");
      });
    });

    describe("runtime management", () => {
      it("should return runtime information", () => {
        const runtime = parser.getRuntime();
        expect(runtime.type).toBe("native");
        expect(runtime.available).toBe(true);
      });

      it("should dispose cleanly", async () => {
        await expect(parser.dispose()).resolves.toBeUndefined();
      });
    });
  });

  describe("ParserFactory", () => {
    beforeEach(() => {
      // Mock RuntimeDetector to return our mock runtime
      vi.doMock("../runtime-detector.js", () => ({
        RuntimeDetector: {
          getBestRuntime: vi.fn().mockResolvedValue(mockRuntime),
        },
      }));
    });

    it("should get runtime information", async () => {
      const info = await ParserFactory.getRuntimeInfo();

      expect(info).toHaveProperty("native");
      expect(info).toHaveProperty("wasm");
      expect(info).toHaveProperty("recommended");
      expect(["native", "wasm"]).toContain(info.recommended);
    });

    it("should handle errors gracefully", async () => {
      // Mock import to fail
      vi.doMock("tree-sitter", () => {
        throw new Error("Tree-sitter not available");
      });

      const info = await ParserFactory.getRuntimeInfo();
      expect(info.native.available).toBe(false);
      if (info.native.error) {
        expect(info.native.error).toContain("Tree-sitter not available");
      }
    });
  });

  describe("Error Handling", () => {
    let parser: MockParser;

    beforeEach(() => {
      parser = new MockParser(mockRuntime);
    });

    it("should handle parser initialization errors", async () => {
      // Mock getParserForLanguage to throw
      vi.spyOn(parser as any, "getParserForLanguage").mockRejectedValue(
        new Error("Parser init failed"),
      );

      const result = await parser.parseCode("const x = 1;", "typescript");

      expect(result.nodes).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("runtime");
      expect(result.errors[0].message).toContain("Parser init failed");
    });

    it("should handle syntax errors in parsed code", async () => {
      // Mock runtime that returns parser with syntax errors
      const errorRuntime = new MockRuntime();
      errorRuntime.createParser = async () => ({
        parse: () => ({
          rootNode: {
            isNamed: true,
            type: "program",
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 1, column: 0 },
            childCount: 0,
            hasError: true,
            isMissing: false,
            child: () => null,
          },
          walk: () => ({
            currentNode: {
              isNamed: true,
              type: "ERROR",
              startPosition: { row: 0, column: 5 },
              endPosition: { row: 0, column: 10 },
              hasError: true,
              isMissing: false,
            },
            gotoFirstChild: () => false,
            gotoNextSibling: () => false,
            gotoParent: () => false,
          }),
        }),
      });

      const errorParser = new MockParser(errorRuntime);
      const result = await errorParser.parseCode("const x =;", "typescript");

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe("syntax");
    });
  });
});
