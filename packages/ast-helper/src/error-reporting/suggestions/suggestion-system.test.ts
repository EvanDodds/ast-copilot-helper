/**
 * Tests for the error reporting suggestion system
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SuggestionEngine } from "../suggestions/suggestion-engine.js";
import { PatternBasedSuggestionGenerator } from "../suggestions/pattern-generator.js";
import { StaticAnalysisGenerator } from "../suggestions/static-analysis-generator.js";
import type { SuggestionContext } from "../suggestions/types.js";

describe("SuggestionEngine", () => {
  let engine: SuggestionEngine;
  let mockContext: SuggestionContext;

  beforeEach(() => {
    engine = new SuggestionEngine({
      maxSuggestions: 5,
      minConfidenceThreshold: 0.3,
      enableCaching: true,
      enableMLIntegration: false,
      enableCommunityData: false,
    });

    mockContext = {
      error: {
        message: 'Cannot find module "nonexistent-package"',
        type: "MODULE_NOT_FOUND",
        category: "dependency-error",
      },
      environment: {
        nodeVersion: "18.17.0",
        platform: "linux",
        projectType: "node",
        dependencies: {
          express: "^4.18.0",
          typescript: "^5.0.0",
        },
      },
      codebase: {
        languages: ["typescript", "javascript"],
        frameworks: ["express"],
        currentFile: "src/index.ts",
        recentChanges: [
          {
            file: "src/index.ts",
            type: "modified",
            timestamp: new Date().toISOString(),
          },
        ],
      },
      history: {
        similarErrors: 0,
        recentPatterns: [],
      },
      user: {
        experienceLevel: "intermediate",
        preferences: {
          automated: true,
          detailed: false,
          conservative: false,
        },
      },
    };
  });

  describe("initialization", () => {
    it("should initialize with default generators", () => {
      const metrics = engine.getGeneratorMetrics();
      expect(metrics.length).toBeGreaterThan(0);

      const generatorNames = metrics.map((m) => m.generatorName);
      expect(generatorNames).toContain("pattern-based");
      expect(generatorNames).toContain("static-analysis");
    });

    it("should allow custom configuration", () => {
      const customEngine = new SuggestionEngine({
        maxSuggestions: 15,
        minConfidenceThreshold: 0.5,
        enableCaching: false,
      });

      const config = customEngine.getConfiguration();
      expect(config.maxSuggestions).toBe(15);
      expect(config.minConfidenceThreshold).toBe(0.5);
      expect(config.enableCaching).toBe(false);
    });
  });

  describe("generator management", () => {
    it("should add and remove generators", () => {
      const initialCount = engine.getGeneratorMetrics().length;

      const customGenerator = new StaticAnalysisGenerator();
      engine.addGenerator(customGenerator);

      // Since it's the same name, it replaces the existing one, so count stays the same
      expect(engine.getGeneratorMetrics().length).toBe(initialCount);

      const removed = engine.removeGenerator(customGenerator.name);
      expect(removed).toBe(true);
      expect(engine.getGeneratorMetrics().length).toBe(initialCount - 1);
    });

    it("should handle removing non-existent generators", () => {
      const removed = engine.removeGenerator("non-existent");
      expect(removed).toBe(false);
    });
  });

  describe("suggestion generation", () => {
    it("should generate suggestions for module not found error", async () => {
      const result = await engine.generateSuggestions(mockContext);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.totalProcessingTime).toBeGreaterThanOrEqual(0);
      expect(result.generatorsUsed.length).toBeGreaterThan(0);
      expect(result.cacheHit).toBe(false);

      // Should have suggestions related to missing module
      const suggestionTitles = result.suggestions.map((s) =>
        s.title.toLowerCase(),
      );
      const hasModuleRelatedSuggestion = suggestionTitles.some(
        (title) =>
          title.includes("module") ||
          title.includes("install") ||
          title.includes("package"),
      );
      expect(hasModuleRelatedSuggestion).toBe(true);
    });

    it("should cache results when caching is enabled", async () => {
      const result1 = await engine.generateSuggestions(mockContext);
      const result2 = await engine.generateSuggestions(mockContext);

      expect(result1.cacheHit).toBe(false);
      expect(result2.cacheHit).toBe(true);
      expect(result2.suggestions.length).toBe(result1.suggestions.length);
    });

    it("should respect confidence threshold", async () => {
      const strictEngine = new SuggestionEngine({
        minConfidenceThreshold: 0.9, // Very high threshold
      });

      const result = await strictEngine.generateSuggestions(mockContext);

      // With very high threshold, might have fewer or no suggestions
      result.suggestions.forEach((suggestion) => {
        expect(suggestion.relevanceScore).toBeGreaterThanOrEqual(0.9);
      });
    });

    it("should limit number of suggestions", async () => {
      const limitedEngine = new SuggestionEngine({
        maxSuggestions: 3,
      });

      const result = await limitedEngine.generateSuggestions(mockContext);
      expect(result.suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe("error handling", () => {
    it("should handle context without current file", async () => {
      const contextWithoutFile = {
        ...mockContext,
        codebase: {
          ...mockContext.codebase,
          currentFile: undefined,
        },
      };

      const result = await engine.generateSuggestions(contextWithoutFile);
      expect(result.error).toBeUndefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it("should handle empty error message", async () => {
      const contextWithEmptyError = {
        ...mockContext,
        error: {
          ...mockContext.error,
          message: "",
        },
      };

      const result = await engine.generateSuggestions(contextWithEmptyError);
      expect(result.error).toBeUndefined();
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe("metrics and statistics", () => {
    it("should track generator metrics", async () => {
      await engine.generateSuggestions(mockContext);

      const metrics = engine.getGeneratorMetrics();
      expect(metrics.length).toBeGreaterThan(0);

      const updatedMetrics = metrics.filter((m) => m.totalCalls > 0);
      expect(updatedMetrics.length).toBeGreaterThan(0);

      updatedMetrics.forEach((metric) => {
        expect(metric.totalCalls).toBeGreaterThan(0);
        expect(metric.averageProcessingTime).toBeGreaterThanOrEqual(0);
        expect(typeof metric.lastUsed).toBe("string");
      });
    });

    it("should provide engine statistics", async () => {
      await engine.generateSuggestions(mockContext);

      const stats = engine.getEngineStats();
      expect(stats.totalSuggestions).toBeGreaterThanOrEqual(0);
      expect(stats.generatorCount).toBeGreaterThan(0);
      expect(stats.averageResponseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("configuration updates", () => {
    it("should update configuration", () => {
      const newConfig = {
        maxSuggestions: 20,
        enableMLIntegration: true,
      };

      engine.updateConfiguration(newConfig);

      const config = engine.getConfiguration();
      expect(config.maxSuggestions).toBe(20);
      expect(config.enableMLIntegration).toBe(true);
    });
  });

  describe("cache management", () => {
    it("should clear cache", async () => {
      await engine.generateSuggestions(mockContext);

      engine.clearCache();

      const result = await engine.generateSuggestions(mockContext);
      expect(result.cacheHit).toBe(false);
    });

    it("should provide cache statistics", () => {
      const stats = engine.getCacheStats();
      expect(typeof stats.size).toBe("number");
      expect(typeof stats.hitRate).toBe("number");
      expect(typeof stats.totalEntries).toBe("number");
    });
  });

  describe("feedback recording", () => {
    it("should record suggestion feedback", () => {
      const suggestionId = "test-suggestion-123";
      const feedback = {
        helpful: true,
        applied: true,
        successful: true,
        timeToResolve: 120000, // 2 minutes
        userRating: 5,
        comments: "This suggestion solved my problem quickly",
      };

      // Should not throw
      expect(() => {
        engine.recordFeedback(suggestionId, feedback);
      }).not.toThrow();
    });
  });
});

describe("PatternBasedSuggestionGenerator", () => {
  let generator: PatternBasedSuggestionGenerator;
  let mockContext: SuggestionContext;

  beforeEach(() => {
    generator = new PatternBasedSuggestionGenerator();

    mockContext = {
      error: {
        message: 'Cannot find module "test-package"',
        type: "MODULE_NOT_FOUND",
        category: "dependency-error",
      },
      environment: {
        nodeVersion: "18.17.0",
        platform: "linux",
      },
      codebase: {
        languages: ["javascript"],
      },
      history: {
        similarErrors: 0,
        recentPatterns: [],
      },
      user: {
        experienceLevel: "beginner",
      },
    };
  });

  describe("pattern matching", () => {
    it("should handle module not found errors", async () => {
      const canHandle = await generator.canHandle(mockContext);
      expect(canHandle).toBe(true);

      const suggestions = await generator.generateSuggestions(mockContext);
      expect(suggestions.length).toBeGreaterThan(0);

      const installSuggestion = suggestions.find((s) =>
        s.title.toLowerCase().includes("install"),
      );
      expect(installSuggestion).toBeDefined();
      expect(installSuggestion!.type).toBe("dependency");
    });

    it("should handle null property access errors", async () => {
      const nullContext = {
        ...mockContext,
        error: {
          message: 'Cannot read property "length" of null',
          type: "RUNTIME_ERROR",
          category: "null-reference-error",
        },
      };

      const suggestions = await generator.generateSuggestions(nullContext);
      expect(suggestions.length).toBeGreaterThan(0);

      const nullCheckSuggestion = suggestions.find(
        (s) =>
          s.title.toLowerCase().includes("null") ||
          s.title.toLowerCase().includes("check"),
      );
      expect(nullCheckSuggestion).toBeDefined();
    });

    it("should handle ES module import errors", async () => {
      const esmContext = {
        ...mockContext,
        error: {
          message: "require() of ES modules is not supported",
          type: "MODULE_ERROR",
          category: "module-system-error",
        },
      };

      const suggestions = await generator.generateSuggestions(esmContext);
      expect(suggestions.length).toBeGreaterThan(0);

      const importSuggestion = suggestions.find(
        (s) =>
          s.title.toLowerCase().includes("import") ||
          s.title.toLowerCase().includes("convert"),
      );
      expect(importSuggestion).toBeDefined();
    });
  });

  describe("confidence scoring", () => {
    it("should provide confidence scores", async () => {
      const confidence = await generator.getConfidenceScore(mockContext);
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it("should return higher confidence for well-known patterns", async () => {
      const wellKnownContext = {
        ...mockContext,
        error: {
          message: 'Cannot find module "express"',
          type: "MODULE_NOT_FOUND",
          category: "dependency-error",
        },
      };

      const confidence = await generator.getConfidenceScore(wellKnownContext);
      expect(confidence).toBeGreaterThan(0.5);
    });
  });

  describe("pattern statistics", () => {
    it("should track pattern statistics", () => {
      const initialStats = generator.getPatternStats();
      expect(Array.isArray(initialStats)).toBe(true);

      generator.updatePatternStats("module-not-found", true);

      const updatedStats = generator.getPatternStats();
      const modulePattern = updatedStats.find(
        (s) => s.id === "module-not-found",
      );
      expect(modulePattern?.matchCount).toBeGreaterThan(0);
    });
  });
});

describe("StaticAnalysisGenerator", () => {
  let generator: StaticAnalysisGenerator;
  let mockContext: SuggestionContext;

  beforeEach(() => {
    generator = new StaticAnalysisGenerator();

    mockContext = {
      error: {
        message: "ReferenceError: myVariable is not defined",
        stack: "ReferenceError: myVariable is not defined\n    at test.js:5:1",
        type: "REFERENCE_ERROR",
        category: "reference-error",
      },
      environment: {
        nodeVersion: "18.17.0",
        platform: "linux",
      },
      codebase: {
        languages: ["javascript"],
        currentFile: "test.js",
      },
      history: {
        similarErrors: 0,
        recentPatterns: [],
      },
      user: {
        experienceLevel: "intermediate",
      },
    };
  });

  describe("error analysis", () => {
    it("should analyze reference errors", async () => {
      const canHandle = await generator.canHandle(mockContext);
      expect(canHandle).toBe(true);

      const suggestions = await generator.generateSuggestions(mockContext);
      expect(suggestions.length).toBeGreaterThan(0);

      const variableSuggestion = suggestions.find(
        (s) =>
          s.title.toLowerCase().includes("variable") ||
          s.title.toLowerCase().includes("declare"),
      );
      expect(variableSuggestion).toBeDefined();
    });

    it("should analyze TypeScript property errors", async () => {
      const tsContext = {
        ...mockContext,
        error: {
          message: 'Property "nonExistent" does not exist on type "User"',
          type: "TYPE_ERROR",
          category: "typescript-error",
        },
        codebase: {
          languages: ["typescript"],
          currentFile: "user.ts",
        },
      };

      const suggestions = await generator.generateSuggestions(tsContext);
      expect(suggestions.length).toBeGreaterThan(0);

      const propertySuggestion = suggestions.find((s) =>
        s.title.toLowerCase().includes("property"),
      );
      expect(propertySuggestion).toBeDefined();
    });

    it("should analyze syntax errors", async () => {
      const syntaxContext = {
        ...mockContext,
        error: {
          message: "Unexpected token }",
          type: "SYNTAX_ERROR",
          category: "syntax-error",
        },
      };

      const suggestions = await generator.generateSuggestions(syntaxContext);
      expect(suggestions.length).toBeGreaterThan(0);

      const syntaxSuggestion = suggestions.find(
        (s) =>
          s.title.toLowerCase().includes("syntax") ||
          s.title.toLowerCase().includes("token"),
      );
      expect(syntaxSuggestion).toBeDefined();
    });
  });

  describe("confidence assessment", () => {
    it("should provide appropriate confidence levels", async () => {
      const confidence = await generator.getConfidenceScore(mockContext);
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it("should have lower confidence without stack trace", async () => {
      const noStackContext = {
        ...mockContext,
        error: {
          ...mockContext.error,
          stack: undefined,
        },
      };

      const confidence = await generator.getConfidenceScore(noStackContext);
      expect(confidence).toBeLessThan(0.5);
    });
  });
});
