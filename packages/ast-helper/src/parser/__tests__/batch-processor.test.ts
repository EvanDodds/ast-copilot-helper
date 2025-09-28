import { describe, it, expect, beforeEach, vi } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { BatchProcessor, BatchProcessingOptions } from "../batch-processor.js";
import { BaseParser } from "../parsers/base-parser.js";
import { ParseResult, ASTNode, ParserRuntime } from "../types.js";

// Mock ParserRuntime for testing
class MockParserRuntime implements ParserRuntime {
  type: "native" | "wasm" = "native";
  available = true;

  async initialize(): Promise<void> {
    // Mock initialization
  }

  async createParser(): Promise<any> {
    return {}; // Mock parser
  }
}

// Mock implementation of BaseParser for testing
class MockParser extends BaseParser {
  private mockResults = new Map<string, ParseResult>();
  private shouldThrowError = false;
  private parseDelay = 0;

  constructor() {
    super(new MockParserRuntime());
  }

  setMockResult(filePath: string, result: ParseResult): void {
    this.mockResults.set(filePath, result);
  }

  setShouldThrowError(shouldThrow: boolean): void {
    this.shouldThrowError = shouldThrow;
  }

  setParseDelay(delay: number): void {
    this.parseDelay = delay;
  }

  async parseFile(filePath: string): Promise<ParseResult> {
    if (this.parseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.parseDelay));
    }

    if (this.shouldThrowError) {
      throw new Error(`Mock error for ${filePath}`);
    }

    const result = this.mockResults.get(filePath);
    if (!result) {
      return this.createDefaultResult(filePath);
    }

    return result;
  }

  protected async getParserForLanguage(): Promise<any> {
    return {}; // Mock parser
  }

  protected treeToASTNodes(): ASTNode[] {
    return []; // Mock implementation
  }

  private createDefaultResult(filePath: string): ParseResult {
    const nodes: ASTNode[] = [
      {
        id: "mock-node",
        type: "mock_type",
        filePath,
        start: { line: 1, column: 0 },
        end: { line: 1, column: 10 },
        children: [],
        metadata: {
          language: "typescript",
          scope: [],
          modifiers: [],
        },
      },
    ];

    return {
      nodes,
      errors: [],
      language: "typescript",
      parseTime: 10,
    };
  }
}

// Mock fs module
vi.mock("fs/promises", () => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}));

describe("Batch Processing System", () => {
  let mockParser: MockParser;
  let batchProcessor: BatchProcessor;

  beforeEach(() => {
    mockParser = new MockParser();
    batchProcessor = new BatchProcessor(mockParser);
    vi.clearAllMocks();
  });

  describe("BatchProcessor", () => {
    describe("basic batch processing", () => {
      it("should process multiple files successfully", async () => {
        const files = ["/test/file1.ts", "/test/file2.js", "/test/file3.py"];

        // Mock file stats
        (fs.stat as any).mockResolvedValue({ size: 1024 });

        const result = await batchProcessor.processBatch(files, {
          concurrency: 2,
          continueOnError: true,
        });

        expect(result.summary.totalFiles).toBe(3);
        expect(result.summary.successful).toBe(3);
        expect(result.summary.failed).toBe(0);
        expect(result.summary.skipped).toBe(0);
        expect(result.results.size).toBe(3);
      });

      it("should handle parse errors gracefully when continueOnError is true", async () => {
        const files = ["/test/good.ts", "/test/bad.ts"];

        // Set up one good result and one error
        mockParser.setMockResult("/test/good.ts", {
          nodes: [
            {
              id: "1",
              type: "test",
              filePath: "/test/good.ts",
              start: { line: 1, column: 0 },
              end: { line: 1, column: 5 },
              children: [],
              metadata: { language: "typescript", scope: [], modifiers: [] },
            },
          ],
          errors: [],
          language: "typescript",
          parseTime: 10,
        });

        // Mock file operations
        (fs.stat as any).mockResolvedValue({ size: 1024 });

        let callCount = 0;
        mockParser.parseFile = vi
          .fn()
          .mockImplementation((filePath: string) => {
            callCount++;
            if (filePath.includes("bad")) {
              throw new Error("Parse failed");
            }
            return mockParser["createDefaultResult"](filePath);
          });

        const result = await batchProcessor.processBatch(files, {
          continueOnError: true,
        });

        expect(result.summary.successful).toBe(1); // First file succeeds, second fails due to mock setup
        expect(result.summary.failed).toBe(1);
        expect(result.results.size).toBe(2);
      });

      it("should fail fast when continueOnError is false", async () => {
        const files = ["/test/good.ts", "/test/bad.ts"];

        (fs.stat as any).mockResolvedValue({ size: 1024 });
        mockParser.setShouldThrowError(true);

        await expect(
          batchProcessor.processBatch(files, { continueOnError: false }),
        ).rejects.toThrow();
      });

      it("should respect concurrency limits", async () => {
        const files = Array.from({ length: 10 }, (_, i) => `/test/file${i}.ts`);
        let concurrentCount = 0;
        let maxConcurrent = 0;

        (fs.stat as any).mockResolvedValue({ size: 1024 });

        mockParser.parseFile = vi.fn().mockImplementation(async () => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);

          await new Promise((resolve) => setTimeout(resolve, 50));

          concurrentCount--;
          return mockParser["createDefaultResult"]("test");
        });

        await batchProcessor.processBatch(files, { concurrency: 3 });

        expect(maxConcurrent).toBeLessThanOrEqual(3);
      });
    });

    describe("file validation and filtering", () => {
      it("should skip unsupported file types", async () => {
        const files = [
          "/test/supported.ts",
          "/test/unsupported.xyz",
          "/test/also-unsupported.unknown",
        ];

        (fs.stat as any).mockResolvedValue({ size: 1024 });

        const result = await batchProcessor.processBatch(files);

        expect(result.summary.totalFiles).toBe(3);
        expect(result.summary.successful).toBe(1); // Only .ts file
        expect(result.summary.skipped).toBe(2); // Two unsupported files

        // Check that unsupported files have appropriate error messages
        const unsupportedResult = result.results.get(
          path.resolve("/test/unsupported.xyz"),
        );
        expect(unsupportedResult?.errors[0]?.message).toContain(
          "Unsupported file type",
        );
      });

      it("should skip oversized files", async () => {
        const files = ["/test/small.ts", "/test/large.ts"];

        (fs.stat as any).mockImplementation((filePath: string) => {
          if (filePath.includes("large")) {
            return Promise.resolve({ size: 11 * 1024 * 1024 }); // 11MB
          }
          return Promise.resolve({ size: 1024 }); // 1KB
        });

        const result = await batchProcessor.processBatch(files, {
          maxFileSizeMB: 10,
        });

        expect(result.summary.successful).toBe(1); // Only small file
        expect(result.summary.skipped).toBe(1); // Large file skipped

        const largeFileResult = result.results.get(
          path.resolve("/test/large.ts"),
        );
        expect(largeFileResult?.errors[0]?.message).toContain("File too large");
      });

      it("should handle missing files gracefully", async () => {
        const files = ["/test/exists.ts", "/test/missing.ts"];

        (fs.stat as any).mockImplementation((filePath: string) => {
          if (filePath.includes("missing")) {
            return Promise.reject(new Error("ENOENT"));
          }
          return Promise.resolve({ size: 1024 });
        });

        const result = await batchProcessor.processBatch(files);

        expect(result.summary.successful).toBe(1);
        expect(result.summary.skipped).toBe(1); // Missing file treated as unsupported
      });
    });

    describe("timeout handling", () => {
      it("should timeout long-running parse operations", async () => {
        const files = ["/test/slow.ts"];

        (fs.stat as any).mockResolvedValue({ size: 1024 });
        mockParser.setParseDelay(200); // 200ms delay

        const result = await batchProcessor.processBatch(files, {
          parseTimeoutMs: 100, // 100ms timeout
        });

        expect(result.summary.failed).toBe(1);
        const timeoutResult = result.results.get(path.resolve("/test/slow.ts"));
        expect(timeoutResult?.errors[0]?.message).toContain("Parse timeout");
      });
    });

    describe("progress reporting", () => {
      it("should emit progress events", async () => {
        const files = ["/test/file1.ts", "/test/file2.ts"];
        const progressEvents: any[] = [];

        (fs.stat as any).mockResolvedValue({ size: 1024 });

        batchProcessor.on("progress", (progress) => {
          progressEvents.push(progress);
        });

        await batchProcessor.processBatch(files, { concurrency: 1 });

        expect(progressEvents.length).toBeGreaterThan(0);
        expect(progressEvents[0]).toHaveProperty("completed");
        expect(progressEvents[0]).toHaveProperty("total");
        expect(progressEvents[0]).toHaveProperty("currentFile");
        expect(progressEvents[0]).toHaveProperty("rate");
        expect(progressEvents[0]).toHaveProperty("memoryUsageMB");
      });
    });

    describe("caching", () => {
      it("should cache results when enabled", async () => {
        const files = ["/test/cached.ts"];

        (fs.stat as any).mockResolvedValue({ size: 1024 });
        (fs.readFile as any).mockResolvedValue("const x = 1;");

        let parseCallCount = 0;
        mockParser.parseFile = vi.fn().mockImplementation(() => {
          parseCallCount++;
          return mockParser["createDefaultResult"]("/test/cached.ts");
        });

        // First run
        await batchProcessor.processBatch(files, {
          enableCache: true,
          includeContentHashes: true,
        });
        expect(parseCallCount).toBe(1);

        // Second run should use cache
        await batchProcessor.processBatch(files, {
          enableCache: true,
          includeContentHashes: true,
        });
        expect(parseCallCount).toBe(1); // No additional parse calls
      });

      it("should invalidate cache when content changes", async () => {
        const files = ["/test/changed.ts"];

        (fs.stat as any).mockResolvedValue({ size: 1024 });

        let readFileCallCount = 0;
        (fs.readFile as any).mockImplementation(() => {
          readFileCallCount++;
          return readFileCallCount === 1 ? "const x = 1;" : "const y = 2;";
        });

        let parseCallCount = 0;
        mockParser.parseFile = vi.fn().mockImplementation(() => {
          parseCallCount++;
          return mockParser["createDefaultResult"]("/test/changed.ts");
        });

        // First run
        await batchProcessor.processBatch(files, {
          enableCache: true,
          includeContentHashes: true,
        });
        expect(parseCallCount).toBe(1);

        // Second run with different content should re-parse
        await batchProcessor.processBatch(files, {
          enableCache: true,
          includeContentHashes: true,
        });
        expect(parseCallCount).toBe(2);
      });
    });

    describe("memory management", () => {
      it("should provide memory usage statistics", async () => {
        const files = ["/test/memory-test.ts"];

        (fs.stat as any).mockResolvedValue({ size: 1024 });

        const result = await batchProcessor.processBatch(files, {
          enableMetrics: true,
        });

        expect(result.metrics).toBeDefined();
        expect(result.summary.memoryStats).toHaveProperty("peakUsageMB");
        expect(result.summary.memoryStats).toHaveProperty("avgUsageMB");
        expect(result.summary.memoryStats).toHaveProperty("gcRuns");
      });
    });

    describe("error aggregation", () => {
      it("should aggregate similar errors", async () => {
        const files = ["/test/error1.ts", "/test/error2.ts", "/test/error3.ts"];

        (fs.stat as any).mockResolvedValue({ size: 1024 });

        // Set up results with similar errors using resolved paths
        files.forEach((file) => {
          const resolvedPath = path.resolve(file);
          mockParser.setMockResult(resolvedPath, {
            nodes: [],
            errors: [
              {
                type: "syntax",
                message: "Expected semicolon",
                position: { line: 1, column: 0 },
                context: "test",
              },
            ],
            language: "typescript",
            parseTime: 10,
          });
        });

        const result = await batchProcessor.processBatch(files);

        expect(result.errorSummary.has("syntax")).toBe(true);
        const syntaxErrors = result.errorSummary.get("syntax")!;
        expect(syntaxErrors).toHaveLength(1); // One unique error message
        expect(syntaxErrors[0].count).toBe(3); // Occurred 3 times
        expect(syntaxErrors[0].sampleFiles).toHaveLength(3);
      });
    });

    describe("performance metrics", () => {
      it("should generate comprehensive performance metrics", async () => {
        const files = ["/test/perf1.ts", "/test/perf2.js", "/test/perf3.py"];

        (fs.stat as any).mockResolvedValue({ size: 1024 });

        const result = await batchProcessor.processBatch(files, {
          enableMetrics: true,
        });

        expect(result.metrics).toBeDefined();
        expect(result.metrics!.parseTimeDistribution).toHaveProperty("min");
        expect(result.metrics!.parseTimeDistribution).toHaveProperty("max");
        expect(result.metrics!.parseTimeDistribution).toHaveProperty("avg");
        expect(result.metrics!.parseTimeDistribution).toHaveProperty("p50");
        expect(result.metrics!.parseTimeDistribution).toHaveProperty("p95");
        expect(result.metrics!.parseTimeDistribution).toHaveProperty("p99");
        expect(result.metrics!.languageStats).toBeInstanceOf(Map);
        expect(result.metrics!.rateHistory).toBeInstanceOf(Array);
        expect(result.metrics!.memoryHistory).toBeInstanceOf(Array);
      });

      it("should track language-specific statistics", async () => {
        const files = ["/test/file.ts", "/test/file.js", "/test/file.py"];

        (fs.stat as any).mockResolvedValue({ size: 1024 });

        // Set up different results for different languages
        mockParser.setMockResult(path.resolve("/test/file.ts"), {
          nodes: [
            {
              id: "1",
              type: "test",
              filePath: "/test/file.ts",
              start: { line: 1, column: 0 },
              end: { line: 1, column: 5 },
              children: [],
              metadata: { language: "typescript", scope: [], modifiers: [] },
            },
          ],
          errors: [],
          language: "typescript",
          parseTime: 10,
        });

        mockParser.setMockResult(path.resolve("/test/file.js"), {
          nodes: [
            {
              id: "1",
              type: "test",
              filePath: "/test/file.js",
              start: { line: 1, column: 0 },
              end: { line: 1, column: 5 },
              children: [],
              metadata: { language: "javascript", scope: [], modifiers: [] },
            },
          ],
          errors: [],
          language: "javascript",
          parseTime: 15,
        });

        const result = await batchProcessor.processBatch(files, {
          enableMetrics: true,
        });

        expect(result.metrics!.languageStats.has("typescript")).toBe(true);
        expect(result.metrics!.languageStats.has("javascript")).toBe(true);

        const tsStats = result.metrics!.languageStats.get("typescript")!;
        expect(tsStats.fileCount).toBeGreaterThanOrEqual(1);
        expect(tsStats.totalNodes).toBeGreaterThanOrEqual(1);
        expect(tsStats.avgParseTime).toBeGreaterThan(0);
      });
    });

    describe("cache management", () => {
      it("should provide cache statistics", () => {
        const stats = batchProcessor.getCacheStats();

        expect(stats).toHaveProperty("size");
        expect(stats).toHaveProperty("hitRate");
        expect(typeof stats.size).toBe("number");
        expect(typeof stats.hitRate).toBe("number");
      });

      it("should clear cache", () => {
        batchProcessor.clearCache();

        const stats = batchProcessor.getCacheStats();
        expect(stats.size).toBe(0);
      });
    });

    describe("options merging", () => {
      it("should use default options when none provided", async () => {
        const files = ["/test/defaults.ts"];

        (fs.stat as any).mockResolvedValue({ size: 1024 });

        const result = await batchProcessor.processBatch(files);

        // Verify defaults are applied by checking behavior
        expect(result.summary.totalFiles).toBe(1);
        expect(result.metrics).toBeDefined(); // enableMetrics defaults to true
      });

      it("should merge custom options with defaults", async () => {
        const files = ["/test/custom.ts"];

        (fs.stat as any).mockResolvedValue({ size: 1024 });

        const result = await batchProcessor.processBatch(files, {
          concurrency: 1,
          enableMetrics: false,
        });

        expect(result.metrics).toBeUndefined(); // Custom option applied
      });
    });
  });
});
