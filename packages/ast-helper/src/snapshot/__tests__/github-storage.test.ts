import { describe, it, expect } from "vitest";
import { GitHubStorage } from "../github-storage.js";
import type { GitHubStorageConfig } from "../types.js";

/**
 * GitHub Storage Tests
 *
 * These tests verify the GitHubStorage remote backend.
 * Note: Full integration tests with mocked GitHub API are in integration.test.ts
 */
describe("GitHubStorage", () => {
  describe("constructor", () => {
    it("should create instance with valid config", () => {
      const config: GitHubStorageConfig = {
        owner: "test-owner",
        repo: "test-repo",
        token: "ghp_fake_token_for_testing",
      };

      const storage = new GitHubStorage(config);
      expect(storage).toBeInstanceOf(GitHubStorage);
    });

    it("should accept optional releaseTag", () => {
      const config: GitHubStorageConfig = {
        owner: "test-owner",
        repo: "test-repo",
        token: "ghp_fake_token",
        releaseTag: "custom-snapshots",
      };

      const storage = new GitHubStorage(config);
      expect(storage).toBeInstanceOf(GitHubStorage);
    });

    it("should accept createRelease option", () => {
      const config: GitHubStorageConfig = {
        owner: "test-owner",
        repo: "test-repo",
        token: "ghp_fake_token",
        createRelease: true,
      };

      const storage = new GitHubStorage(config);
      expect(storage).toBeInstanceOf(GitHubStorage);
    });
  });

  describe("validation", () => {
    it("should require owner", () => {
      expect(() => {
        new GitHubStorage({
          repo: "test-repo",
          token: "ghp_fake_token",
        } as GitHubStorageConfig);
      }).toThrow();
    });

    it("should require repo", () => {
      expect(() => {
        new GitHubStorage({
          owner: "test-owner",
          token: "ghp_fake_token",
        } as GitHubStorageConfig);
      }).toThrow();
    });

    it("should require token", () => {
      expect(() => {
        new GitHubStorage({
          owner: "test-owner",
          repo: "test-repo",
        } as GitHubStorageConfig);
      }).toThrow();
    });

    it("should accept valid config", () => {
      const config: GitHubStorageConfig = {
        owner: "test-owner",
        repo: "test-repo",
        token: "ghp_fake_token",
      };

      expect(() => {
        new GitHubStorage(config);
      }).not.toThrow();
    });
  });

  describe("configuration", () => {
    it("should work with different owners", () => {
      const owners = ["user", "org", "test-user", "github"];

      for (const owner of owners) {
        const config: GitHubStorageConfig = {
          owner,
          repo: "test-repo",
          token: "ghp_fake_token",
        };

        const storage = new GitHubStorage(config);
        expect(storage).toBeInstanceOf(GitHubStorage);
      }
    });

    it("should work with different release tags", () => {
      const tags = ["snapshots", "v1.0.0", "custom-release", "test"];

      for (const releaseTag of tags) {
        const config: GitHubStorageConfig = {
          owner: "test-owner",
          repo: "test-repo",
          token: "ghp_fake_token",
          releaseTag,
        };

        const storage = new GitHubStorage(config);
        expect(storage).toBeInstanceOf(GitHubStorage);
      }
    });
  });
});
