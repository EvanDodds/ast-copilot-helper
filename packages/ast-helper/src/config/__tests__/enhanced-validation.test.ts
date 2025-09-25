/**
 * Comprehensive tests for enhanced configuration validation
 * Tests edge cases, error reporting, and user-friendly messages
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EnhancedConfigValidator,
  type ValidationError,
} from "../enhanced-validator.js";
import { validateConfig, validateConfigDetailed } from "../defaults.js";
import type { PartialConfig } from "../../types.js";

describe("Enhanced Configuration Validation", () => {
  let validator: EnhancedConfigValidator;

  beforeEach(() => {
    validator = new EnhancedConfigValidator();
  });

  describe("Basic Validation", () => {
    it("should validate a minimal valid configuration", () => {
      const config: PartialConfig = {
        parseGlob: ["*.ts"],
        topK: 10,
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.cleanedConfig).toBeDefined();
    });

    it("should handle empty configuration gracefully", () => {
      const config: PartialConfig = {};

      const result = validator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should clean and normalize string values", () => {
      const config: PartialConfig = {
        parseGlob: ["  *.ts  ", "*.js", ""],
        modelHost: "  https://example.com/models  ",
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.cleanedConfig?.parseGlob).toEqual(["*.ts", "*.js"]);
      expect(result.cleanedConfig?.modelHost).toBe(
        "https://example.com/models",
      );
    });
  });

  describe("Error Reporting", () => {
    it("should provide detailed error messages for invalid types", () => {
      const config: PartialConfig = {
        parseGlob: "not-an-array" as any,
        topK: "not-a-number" as any,
        enableTelemetry: "maybe" as any,
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);

      const parseGlobError = result.errors.find((e) => e.path === "parseGlob");
      expect(parseGlobError?.message).toContain("must be an array");
      expect(parseGlobError?.suggestion).toBeDefined();

      const topKError = result.errors.find((e) => e.path === "topK");
      expect(topKError?.message).toContain("must be a valid number");

      const telemetryError = result.errors.find(
        (e) => e.path === "enableTelemetry",
      );
      expect(telemetryError?.message).toContain("must be a boolean");
    });

    it("should validate numeric ranges with helpful messages", () => {
      const config: PartialConfig = {
        topK: -5,
        snippetLines: 500,
        concurrency: 100,
        indexParams: {
          efConstruction: 1000,
          M: 1,
        },
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(false);

      const topKError = result.errors.find((e) => e.path === "topK");
      expect(topKError?.message).toContain("must be between 1 and 1000");

      const efError = result.errors.find(
        (e) => e.path === "indexParams.efConstruction",
      );
      expect(efError?.message).toContain("must be between 16 and 800");

      const mError = result.errors.find((e) => e.path === "indexParams.M");
      expect(mError?.message).toContain("must be between 4 and 64");
    });

    it("should validate URL format with protocol requirements", () => {
      const config: PartialConfig = {
        modelHost: "invalid-url",
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(false);

      const urlError = result.errors.find((e) => e.path === "modelHost");
      expect(urlError?.message).toContain("must be a valid URL");
      expect(urlError?.suggestion).toContain("protocol");
      expect(urlError?.example).toBeDefined();
    });

    it("should validate array contents with specific error messages", () => {
      const config: PartialConfig = {
        parseGlob: [123, "", null, "valid.ts"] as any,
        fileWatching: {
          watchPaths: [],
        },
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(false);

      // parseGlob should pass validation now (we filter out invalid items during cleaning)
      // but fileWatching.watchPaths should fail because it needs at least 1 valid path
      const watchPathsError = result.errors.find(
        (e) => e.path === "fileWatching.watchPaths",
      );
      expect(watchPathsError?.message).toContain(
        "must contain at least 1 valid",
      );
    });
  });

  describe("Nested Object Validation", () => {
    it("should validate deeply nested configuration objects", () => {
      const config: PartialConfig = {
        embeddings: {
          model: "codebert-base",
          batchSize: 64,
          textProcessing: {
            maxTokenLength: 50000,
            preserveCodeStructure: true,
            maxSnippetLength: -100, // Invalid
          },
        },
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(false);

      const snippetError = result.errors.find(
        (e) => e.path === "embeddings.textProcessing.maxSnippetLength",
      );
      expect(snippetError?.message).toContain("must be between 50 and 10000");
    });

    it("should validate file watching configuration comprehensively", () => {
      const config: PartialConfig = {
        fileWatching: {
          watchPaths: ["src/", "lib/"],
          includePatterns: ["*.ts", "*.js"],
          excludePatterns: ["node_modules/**"],
          debounceMs: 15000, // Too high
          batchSize: "invalid" as any,
          enableRecursive: "yes" as any,
          followSymlinks: 0 as any,
        },
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(false); // Should fail due to debounceMs and batchSize

      const debounceError = result.errors.find(
        (e) => e.path === "fileWatching.debounceMs",
      );
      expect(debounceError?.message).toContain("must be between 0 and 10000");

      const batchError = result.errors.find(
        (e) => e.path === "fileWatching.batchSize",
      );
      expect(batchError?.message).toContain("must be a valid number");

      // Even though validation fails overall, valid boolean coercion should still work
      // Let's test with a separate valid configuration
      const validConfig: PartialConfig = {
        fileWatching: {
          watchPaths: ["src/"],
          enableRecursive: "yes" as any,
          followSymlinks: 0 as any,
        },
      };

      const validResult = validator.validate(validConfig);
      expect(validResult.valid).toBe(true);
      expect(validResult.cleanedConfig?.fileWatching?.enableRecursive).toBe(
        true,
      );
      expect(validResult.cleanedConfig?.fileWatching?.followSymlinks).toBe(
        false,
      );
    });
  });

  describe("Warning Generation", () => {
    it("should generate warnings for unknown properties", () => {
      const config: PartialConfig = {
        parseGlob: ["*.ts"],
        unknownProperty: "should-warn",
        nested: {
          validProp: "ok",
          invalidProp: "warn",
        },
      } as any;

      const result = validator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);

      const unknownWarning = result.warnings.find(
        (w) => w.path === "unknownProperty",
      );
      expect(unknownWarning?.message).toContain(
        "Unknown configuration property",
      );
    });
  });

  describe("Boolean Value Handling", () => {
    it("should handle various boolean representations", () => {
      const config: PartialConfig = {
        enableTelemetry: "true",
        verbose: 1,
        debug: "yes",
        jsonLogs: "false",
        model: {
          showProgress: 0,
        },
      } as any;

      const result = validator.validate(config);
      expect(result.valid).toBe(true);
      expect(result.cleanedConfig?.enableTelemetry).toBe(true);
      expect(result.cleanedConfig?.verbose).toBe(true);
      expect(result.cleanedConfig?.debug).toBe(true);
      expect(result.cleanedConfig?.jsonLogs).toBe(false);
      expect(result.cleanedConfig?.model?.showProgress).toBe(false);
    });
  });

  describe("Memory Size Validation", () => {
    it("should validate memory limits with appropriate ranges", () => {
      const config: PartialConfig = {
        embeddings: {
          model: "test",
          modelPath: "./models",
          batchSize: 32,
          maxConcurrency: 4,
          memoryLimit: 50, // Too low
          showProgress: true,
          enableConfidenceScoring: false,
        },
      };

      const result = validator.validate(config);
      expect(result.valid).toBe(false);

      const memoryError = result.errors.find(
        (e) => e.path === "embeddings.memoryLimit",
      );
      expect(memoryError?.message).toContain("too small");
      expect(memoryError?.message).toContain("minimum: 128MB");
    });
  });

  describe("Integration with defaults", () => {
    it("should integrate with validateConfig function", () => {
      const config: PartialConfig = {
        parseGlob: ["*.ts"],
        topK: 15,
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it("should throw detailed errors via validateConfig", () => {
      const config: PartialConfig = {
        parseGlob: "invalid" as any,
        topK: -5,
      };

      expect(() => validateConfig(config)).toThrow(
        /Configuration validation failed/,
      );
    });

    it("should provide detailed results via validateConfigDetailed", () => {
      const config: PartialConfig = {
        topK: 2000,
        unknownProp: "test",
      } as any;

      const result = validateConfigDetailed(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Error Formatting", () => {
    it("should format validation errors into human-readable reports", () => {
      const config: PartialConfig = {
        parseGlob: "invalid" as any,
        topK: -5,
        modelHost: "not-a-url",
      };

      const result = validator.validate(config);
      const formatted = EnhancedConfigValidator.formatErrors(result);

      expect(formatted).toContain("Configuration validation failed");
      expect(formatted).toContain("parseGlob: parseGlob must be an array");
      expect(formatted).toContain("💡"); // Suggestion symbol
      expect(formatted).toContain("📋"); // Example symbol
    });

    it("should format successful validation with warnings", () => {
      const config: PartialConfig = {
        parseGlob: ["*.ts"],
        unknownProp: "test",
      } as any;

      const result = validator.validate(config);
      const formatted = EnhancedConfigValidator.formatErrors(result);

      expect(formatted).toContain("✅ Configuration is valid");
      expect(formatted).toContain("Warnings");
      expect(formatted).toContain("Unknown configuration property");
    });
  });
});
