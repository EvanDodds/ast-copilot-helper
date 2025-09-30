import { describe, it, expect, vi } from "vitest";

// Import from source TypeScript files
import { ConfigurationError, GitError } from "../../errors/types.js";
import { GitErrors } from "../../errors/factories.js";
import { withRetry } from "../../errors/utils.js";

describe("Error Handling Framework - Simple Tests", () => {
  describe("Basic Error Creation", () => {
    it("should create ConfigurationError", () => {
      const error = new ConfigurationError("Config invalid", { key: "test" });
      expect(error.name).toBe("ConfigurationError");
      expect(error.message).toBe("Config invalid");
      expect(error.context.key).toBe("test");
    });

    it("should create GitError", () => {
      const error = new GitError("Git command failed");
      expect(error.name).toBe("GitError");
      expect(error.message).toBe("Git command failed");
    });
  });

  describe("Error Factories", () => {
    it("should create git command failed error", () => {
      if (GitErrors && GitErrors.commandFailed) {
        const error = GitErrors.commandFailed(
          "status",
          1,
          "fatal error",
          "/repo",
        );
        expect(error.message).toContain("Git command failed");
      } else {
        expect.fail("GitErrors.commandFailed not available");
      }
    });
  });

  describe("Error Utils", () => {
    it("should retry function on failure", async () => {
      let attempts = 0;
      const fn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error("network timeout fail"); // Use error message that triggers retry
        }
        return "success";
      });

      if (withRetry) {
        const result = await withRetry(fn, { maxRetries: 2, initialDelay: 10 });
        expect(result).toBe("success");
        expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
      } else {
        expect.fail("withRetry not available");
      }
    });
  });
});
