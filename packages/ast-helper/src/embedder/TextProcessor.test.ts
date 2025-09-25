/**
 * Tests for CodeTextProcessor - Text Preparation and Processing
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CodeTextProcessor } from "./TextProcessor.js";
import { Annotation } from "./types.js";

describe("CodeTextProcessor - Text Preparation", () => {
  let processor: CodeTextProcessor;

  beforeEach(() => {
    processor = new CodeTextProcessor();
  });

  describe("Text Preparation for Embeddings", () => {
    it("should combine annotation components correctly", () => {
      const annotation: Annotation = {
        nodeId: "test-1",
        signature: "function calculateSum(a: number, b: number): number",
        summary: "Calculates the sum of two numbers",
        sourceSnippet: "function calculateSum(a, b) {\n  return a + b;\n}",
      };

      const result = processor.prepareTextForEmbedding(annotation);

      expect(result).toContain("Signature:");
      expect(result).toContain("Summary:");
      expect(result).toContain("Code:");
      expect(result).toContain("calculateSum");
    });

    it("should handle missing annotation components gracefully", () => {
      const annotation: Annotation = {
        nodeId: "test-2",
        signature: "function test()",
        summary: "",
        sourceSnippet: undefined,
      };

      const result = processor.prepareTextForEmbedding(annotation);

      expect(result).toContain("Signature: test()");
      expect(result).not.toContain("Summary:");
      expect(result).not.toContain("Code:");
    });

    it("should provide fallback content for empty annotations", () => {
      const annotation: Annotation = {
        nodeId: "test-empty",
        signature: "",
        summary: "",
      };

      const result = processor.prepareTextForEmbedding(annotation);

      expect(result).toBe("Node: test-empty");
    });

    it("should handle long code snippets with truncation", () => {
      const longCode =
        "function test() {\n" + '  console.log("test");\n'.repeat(100) + "}";
      const annotation: Annotation = {
        nodeId: "test-long",
        signature: "function test()",
        summary: "Test function",
        sourceSnippet: longCode,
      };

      const result = processor.prepareTextForEmbedding(annotation);

      // Should be truncated but contain key parts
      expect(result.length).toBeLessThan(longCode.length);
      expect(result).toContain("function test()");
    });
  });

  describe("Code-Specific Processing", () => {
    it("should clean function signatures properly", () => {
      const annotation: Annotation = {
        nodeId: "test-sig",
        signature:
          "public async function calculateTotal(items: Item[]): Promise<number>",
        summary: "Test",
      };

      const result = processor.prepareTextForEmbedding(annotation);

      // Should remove access modifiers and simplify types
      expect(result).toContain("Signature:");
      expect(result).toContain("calculateTotal");
      expect(result).not.toContain("public async");
    });

    it("should normalize whitespace while preserving code structure", () => {
      const messyCode = `function    test(  ) {
      
      
        return    true;
        
        
      }`;

      const annotation: Annotation = {
        nodeId: "test-whitespace",
        signature: "function test()",
        summary: "Test",
        sourceSnippet: messyCode,
      };

      const result = processor.prepareTextForEmbedding(annotation);

      expect(result).not.toContain("    "); // No excessive spaces
      expect(result).not.toMatch(/\n\n\n/); // No excessive newlines
      expect(result).toContain("return true"); // Content preserved
    });

    it("should remove comments when configured", () => {
      const codeWithComments = `function test() {
        // This is a comment
        return true; // Another comment
        /* Multi-line
           comment */
      }`;

      const annotation: Annotation = {
        nodeId: "test-comments",
        signature: "function test()",
        summary: "Test",
        sourceSnippet: codeWithComments,
      };

      const result = processor.prepareTextForEmbedding(annotation);

      expect(result).not.toContain("This is a comment");
      expect(result).not.toContain("Another comment");
      expect(result).not.toContain("Multi-line");
      expect(result).toContain("return true");
    });
  });

  describe("Text Validation", () => {
    it("should validate normal text correctly", () => {
      const text = "function test() { return true; }";
      const validation = processor.validateInputText(text);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it("should detect empty text", () => {
      const validation = processor.validateInputText("");

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain("Text is empty");
    });

    it("should detect excessively long text", () => {
      const longText = "a".repeat(3000);
      const validation = processor.validateInputText(longText);

      expect(validation.isValid).toBe(false);
      expect(
        validation.issues.some((issue) =>
          issue.includes("exceeds maximum length"),
        ),
      ).toBe(true);
    });

    it("should detect excessive repetition", () => {
      const repetitiveText =
        "test test test test test test test test test test test test";
      const validation = processor.validateInputText(repetitiveText);

      expect(validation.isValid).toBe(false);
      expect(
        validation.issues.some((issue) =>
          issue.includes("excessive repetition"),
        ),
      ).toBe(true);
    });
  });

  describe("Configuration Management", () => {
    it("should allow configuration updates", () => {
      const initialConfig = processor.getConfig();
      expect(initialConfig.maxTokenLength).toBe(2048);

      processor.updateConfig({ maxTokenLength: 1024 });

      const updatedConfig = processor.getConfig();
      expect(updatedConfig.maxTokenLength).toBe(1024);
    });

    it("should preserve other config values when updating", () => {
      const initialConfig = processor.getConfig();

      processor.updateConfig({ maxTokenLength: 1024 });

      const updatedConfig = processor.getConfig();
      expect(updatedConfig.preserveCodeStructure).toBe(
        initialConfig.preserveCodeStructure,
      );
      expect(updatedConfig.maxSnippetLength).toBe(
        initialConfig.maxSnippetLength,
      );
    });
  });

  describe("Processing Statistics", () => {
    it("should calculate processing statistics", () => {
      const original = "function test() {\n  // Comment\n  return true;\n}";
      const processed = "function test() { return true; }";

      const stats = processor.getProcessingStats(original, processed);

      expect(stats.originalLength).toBe(original.length);
      expect(stats.processedLength).toBe(processed.length);
      expect(stats.compressionRatio).toBeLessThan(1);
      expect(stats.wordCount).toBeGreaterThan(0);
    });
  });
});
