/**
 * Unit tests for error handling system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  ConfigurationError,
  GitError,
  GlobError,
  PathError,
  FileSystemError,
  ErrorRecoveryStrategy,
  isAstError,
} from "../../errors/types.js";
import {
  GitErrors,
  GlobErrors,
  PathErrors,
  FileSystemErrors,
} from "../../errors/factories.js";
import {
  withRetry,
  CircuitBreaker,
  AggregateError,
  executeWithErrorCollection,
} from "../../errors/utils.js";

describe("Error Types", () => {
  describe("ConfigurationError", () => {
    it("should create error with message and context", () => {
      const error = new ConfigurationError("Test error", { operation: "test" });

      expect(error.message).toBe("Test error");
      expect(error.name).toBe("ConfigurationError");
      expect(error.code).toBe("CONFIGURATION_ERROR");
      expect(error.context).toEqual({ operation: "test" });
      expect(error.suggestions).toEqual([]);
      expect(error.isAstError).toBe(true);
    });

    it("should support suggestions", () => {
      const error = new ConfigurationError(
        "Test error",
        { operation: "test" },
        ["Try again", "Check input"],
      );

      expect(error.suggestions).toEqual(["Try again", "Check input"]);
    });

    it("should be an instanceof Error", () => {
      const error = new ConfigurationError("Test error");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(isAstError(error)).toBe(true);
    });
  });

  describe("Specialized Error Types", () => {
    it("should create GitError with correct type", () => {
      const error = new GitError("Git failed", { command: "status" });
      expect(error).toBeInstanceOf(GitError);
      expect(error.name).toBe("GitError");
      expect(error.code).toBe("GIT_ERROR");
    });

    it("should create GlobError with correct type", () => {
      const error = new GlobError("Pattern failed", { pattern: "*.js" });
      expect(error).toBeInstanceOf(GlobError);
      expect(error.name).toBe("GlobError");
      expect(error.code).toBe("GLOB_ERROR");
    });

    it("should create PathError with correct type", () => {
      const error = new PathError("Path invalid", { path: "/invalid" });
      expect(error).toBeInstanceOf(PathError);
      expect(error.name).toBe("PathError");
      expect(error.code).toBe("PATH_ERROR");
    });

    it("should create FileSystemError with correct type", () => {
      const error = new FileSystemError("File not found", { path: "/missing" });
      expect(error).toBeInstanceOf(FileSystemError);
      expect(error.name).toBe("FileSystemError");
      expect(error.code).toBe("FILESYSTEM_ERROR");
    });
  });

  describe("isAstError type guard", () => {
    it("should identify AST errors", () => {
      const astError = new GitError("Git error");
      const regularError = new Error("Regular error");

      expect(isAstError(astError)).toBe(true);
      expect(isAstError(regularError)).toBe(false);
    });
  });

  describe("Error recovery strategies", () => {
    it("should define all recovery strategies", () => {
      expect(ErrorRecoveryStrategy.RETRY).toBe("retry");
      expect(ErrorRecoveryStrategy.IGNORE).toBe("ignore");
      expect(ErrorRecoveryStrategy.FALLBACK).toBe("fallback");
      expect(ErrorRecoveryStrategy.FAIL_FAST).toBe("fail_fast");
      expect(ErrorRecoveryStrategy.PROMPT_USER).toBe("prompt_user");
    });
  });
});

describe("Error Factories", () => {
  describe("GitErrors", () => {
    it("should create repository not found error", () => {
      const error = GitErrors.repositoryNotFound("/path");
      expect(error).toBeInstanceOf(GitError);
      expect(error.message).toContain("Git repository not found");
      expect(error.context.path).toBe("/path");
      expect(error.suggestions.length).toBeGreaterThan(0);
    });

    it("should create command failed error", () => {
      const error = GitErrors.commandFailed(
        "status",
        1,
        "fatal error",
        "/repo",
      );
      expect(error.message).toContain("Git command failed");
      expect(error.context.command).toBe("status");
      expect(error.context.exitCode).toBe(1);
      expect(error.context.stderr).toBe("fatal error");
      expect(error.context.cwd).toBe("/repo");
    });

    it("should create permission denied error", () => {
      const error = GitErrors.permissionDenied("read", "/repo");
      expect(error.message).toContain("Permission denied");
      expect(error.context.operation).toBe("read");
    });
  });

  describe("GlobErrors", () => {
    it("should create invalid pattern error", () => {
      const error = GlobErrors.invalidPattern("**[", "unclosed bracket");
      expect(error).toBeInstanceOf(GlobError);
      expect(error.message).toContain("Invalid glob pattern");
      expect(error.context.pattern).toBe("**[");
      expect(error.context.reason).toBe("unclosed bracket");
    });

    it("should create compilation failed error", () => {
      const error = GlobErrors.compilationFailed("*.{js", "unclosed brace");
      expect(error.message).toContain("compilation failed");
      expect(error.context.pattern).toBe("*.{js");
    });

    it("should create expansion timeout error", () => {
      const error = GlobErrors.expansionTimeout(["**/*"], 5000);
      expect(error.message).toContain("timeout");
      expect(error.context.timeoutMs).toBe(5000);
    });

    it("should create too many matches error", () => {
      const error = GlobErrors.tooManyMatches(["*.js"], 10000, 1000);
      expect(error.message).toContain("too many files");
      expect(error.context.matchCount).toBe(10000);
      expect(error.context.maxFiles).toBe(1000);
    });

    it("should create expansion failed error", () => {
      const error = GlobErrors.expansionFailed(["*.js"], "disk error");
      expect(error.message).toContain("expansion failed");
      expect(error.context.patterns).toEqual(["*.js"]);
      expect(error.context.error).toBe("disk error");
    });
  });

  describe("FileSystemErrors", () => {
    it("should create not found error", () => {
      const error = FileSystemErrors.notFound("/missing", "read");
      expect(error).toBeInstanceOf(FileSystemError);
      expect(error.message).toContain("not found");
      expect(error.context.path).toBe("/missing");
      expect(error.context.operation).toBe("read");
    });

    it("should create permission denied error", () => {
      const error = FileSystemErrors.permissionDenied("/protected", "write");
      expect(error.message).toContain("Permission denied");
      expect(error.context.operation).toBe("write");
    });

    it("should create disk space exceeded error", () => {
      const error = FileSystemErrors.diskSpaceExceeded("/full");
      expect(error.message).toContain("disk space");
      expect(error.context.path).toBe("/full");
    });
  });

  describe("PathErrors", () => {
    it("should create invalid format error", () => {
      const error = PathErrors.invalidFormat("\\invalid", "Invalid characters");
      expect(error).toBeInstanceOf(PathError);
      expect(error.message).toContain("Invalid path format");
      expect(error.context.path).toBe("\\invalid");
      expect(error.context.reason).toBe("Invalid characters");
    });

    it("should create resolution failed error", () => {
      const error = PathErrors.resolutionFailed("./missing", "/base", "ENOENT");
      expect(error.message).toContain("Path resolution failed");
      expect(error.context.path).toBe("./missing");
      expect(error.context.basePath).toBe("/base");
      expect(error.context.error).toBe("ENOENT");
    });

    it("should create path too long error", () => {
      const longPath = "a".repeat(300);
      const error = PathErrors.pathTooLong(longPath, 260);
      expect(error.message).toContain("too long");
      expect(error.context.maxLength).toBe(260);
    });
  });
});

describe("Error Utilities", () => {
  describe("withRetry", () => {
    it("should succeed on first try", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await withRetry(fn);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and eventually succeed", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");

      const result = await withRetry(fn, {
        maxRetries: 3,
        initialDelay: 10,
        shouldRetry: () => true, // Always retry for test
      });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("should fail after max retries", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("always fails"));

      await expect(
        withRetry(fn, {
          maxRetries: 2,
          initialDelay: 10,
          shouldRetry: () => true, // Always retry for test
        }),
      ).rejects.toThrow("always fails");
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("should apply exponential backoff", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"));
      const startTime = Date.now();

      try {
        await withRetry(fn, {
          maxRetries: 2,
          initialDelay: 100,
          backoffMultiplier: 2,
          shouldRetry: () => true, // Always retry for test
        });
      } catch {
        // Expected to fail
      }

      const duration = Date.now() - startTime;
      // Should take at least 100ms + 200ms = 300ms with exponential backoff
      expect(duration).toBeGreaterThan(250); // Allow for some timing variance
    });
  });

  describe("CircuitBreaker", () => {
    let circuitBreaker: CircuitBreaker<[string], string>;

    beforeEach(() => {
      const testOperation = async (input: string): Promise<string> => {
        if (input === "fail") throw new Error("Operation failed");
        return `result: ${input}`;
      };

      circuitBreaker = new CircuitBreaker(testOperation, {
        failureThreshold: 3,
        timeoutMs: 1000,
        resetTimeoutMs: 100,
      });
    });

    it("should execute function normally when closed", async () => {
      const result = await circuitBreaker.execute("success");
      expect(result).toBe("result: success");
    });

    it("should open circuit after failure threshold", async () => {
      // Cause 3 failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute("fail");
        } catch {
          // Expected failures
        }
      }

      // Circuit should now be open - next call should fail immediately
      await expect(circuitBreaker.execute("test")).rejects.toThrow(
        "Circuit breaker is open",
      );
    });

    it("should allow half-open state after reset timeout", async () => {
      // Open the circuit with failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute("fail");
        } catch {
          // Expected failures
        }
      }

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should now allow one test call (half-open)
      const result = await circuitBreaker.execute("success");
      expect(result).toBe("result: success");
    });
  });

  describe("AggregateError", () => {
    it("should collect multiple errors", () => {
      const errors = [
        new Error("Error 1"),
        new Error("Error 2"),
        new Error("Error 3"),
      ];

      const aggregate = new AggregateError(
        errors,
        "Multiple failures occurred",
      );

      expect(aggregate.message).toBe("Multiple failures occurred");
      expect(aggregate.errors).toEqual(errors);
      expect(aggregate.errors).toHaveLength(3);
    });

    it("should format message with error count", () => {
      const errors = [new Error("Test")];
      const aggregate = new AggregateError(errors);

      expect(aggregate.message).toContain("1 error");
    });
  });

  describe("executeWithErrorCollection", () => {
    it("should collect all results when all succeed", async () => {
      const tasks = [
        async () => "result1",
        async () => "result2",
        async () => "result3",
      ];

      const { results, errors } = await executeWithErrorCollection(tasks);

      expect(results).toEqual(["result1", "result2", "result3"]);
      expect(errors).toEqual([]);
    });

    it("should collect errors when some fail", async () => {
      const error1 = new Error("fail1");
      const error3 = new Error("fail3");

      const tasks = [
        async () => {
          throw error1;
        },
        async () => "result2",
        async () => {
          throw error3;
        },
      ];

      const { results, errors } = await executeWithErrorCollection(tasks, {
        continueOnError: true,
      });

      expect(results).toEqual([undefined, "result2", undefined]);
      expect(errors).toEqual([error1, error3]);
    });

    it("should stop on first error when continueOnError is false", async () => {
      const error1 = new Error("fail1");

      const tasks = [
        async () => {
          throw error1;
        },
        async () => "result2",
        async () => "result3",
      ];

      await expect(
        executeWithErrorCollection(tasks, { continueOnError: false }),
      ).rejects.toThrow("fail1");
    });

    it("should limit concurrency", async () => {
      const execTimes: number[] = [];
      const tasks = Array.from({ length: 6 }, (_, i) => async () => {
        execTimes.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 50));
        return `result${i}`;
      });

      const start = Date.now();
      const { results } = await executeWithErrorCollection(tasks, {
        maxConcurrency: 2,
      });
      const duration = Date.now() - start;

      expect(results).toHaveLength(6);
      // With max concurrency 2 and 6 tasks taking 50ms each,
      // should take at least 150ms (3 batches of 2)
      expect(duration).toBeGreaterThan(140);
    });
  });
});
