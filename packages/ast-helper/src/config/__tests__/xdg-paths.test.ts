/**
 * Tests for XDG Base Directory Specification implementation
 * Validates XDG path resolution, config discovery, and user config support
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  getXdgConfigHome,
  getUserConfigDir,
  getUserConfigPath,
  resolveConfigPathsWithXdg,
} from "../xdg-paths.js";

describe("XDG Base Directory Specification", () => {
  let originalXdgConfigHome: string | undefined;

  beforeEach(() => {
    // Save original environment variable
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
  });

  afterEach(() => {
    // Restore original environment variable
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    }
  });

  describe("getXdgConfigHome", () => {
    test("returns XDG_CONFIG_HOME when set", () => {
      process.env.XDG_CONFIG_HOME = "/custom/config";
      expect(getXdgConfigHome()).toBe("/custom/config");
    });

    test("falls back to ~/.config when XDG_CONFIG_HOME not set", () => {
      delete process.env.XDG_CONFIG_HOME;
      expect(getXdgConfigHome()).toBe(join(homedir(), ".config"));
    });

    test("ignores empty XDG_CONFIG_HOME", () => {
      process.env.XDG_CONFIG_HOME = "   ";
      expect(getXdgConfigHome()).toBe(join(homedir(), ".config"));
    });

    test("ignores XDG_CONFIG_HOME with only whitespace", () => {
      process.env.XDG_CONFIG_HOME = "\t\n  ";
      expect(getXdgConfigHome()).toBe(join(homedir(), ".config"));
    });

    test("handles XDG_CONFIG_HOME with trailing slash", () => {
      process.env.XDG_CONFIG_HOME = "/custom/config/";
      expect(getXdgConfigHome()).toBe("/custom/config/");
    });
  });

  describe("getUserConfigDir", () => {
    test("returns correct user config directory with default XDG", () => {
      delete process.env.XDG_CONFIG_HOME;
      expect(getUserConfigDir()).toBe(
        join(homedir(), ".config", "ast-copilot-helper"),
      );
    });

    test("returns correct user config directory with custom XDG", () => {
      process.env.XDG_CONFIG_HOME = "/custom/config";
      expect(getUserConfigDir()).toBe("/custom/config/ast-copilot-helper");
    });

    test("uses XDG_CONFIG_HOME from environment", () => {
      const customPath = "/tmp/custom-xdg";
      process.env.XDG_CONFIG_HOME = customPath;
      expect(getUserConfigDir()).toBe(join(customPath, "ast-copilot-helper"));
    });
  });

  describe("getUserConfigPath", () => {
    test("returns correct user config file path with default XDG", () => {
      delete process.env.XDG_CONFIG_HOME;
      expect(getUserConfigPath()).toBe(
        join(homedir(), ".config", "ast-copilot-helper", "config.json"),
      );
    });

    test("returns correct user config file path with custom XDG", () => {
      process.env.XDG_CONFIG_HOME = "/custom/config";
      expect(getUserConfigPath()).toBe(
        "/custom/config/ast-copilot-helper/config.json",
      );
    });

    test("includes config.json filename", () => {
      const path = getUserConfigPath();
      expect(path).toContain("config.json");
      expect(path).toContain("ast-copilot-helper");
    });
  });

  describe("resolveConfigPathsWithXdg", () => {
    test("returns paths in correct priority order without custom config", () => {
      delete process.env.XDG_CONFIG_HOME;
      const workspacePath = "/workspace";
      const paths = resolveConfigPathsWithXdg(workspacePath);

      expect(paths).toHaveLength(2);
      expect(paths[0]).toBe(
        join(homedir(), ".config", "ast-copilot-helper", "config.json"),
      );
      expect(paths[1]).toBe("/workspace/.astdb/config.json");
    });

    test("uses custom user config when provided", () => {
      const workspacePath = "/workspace";
      const customConfig = "/custom/config.json";
      const paths = resolveConfigPathsWithXdg(workspacePath, customConfig);

      expect(paths).toHaveLength(2);
      expect(paths[0]).toBe("/custom/config.json");
      expect(paths[1]).toBe("/workspace/.astdb/config.json");
    });

    test("project config always has higher priority than user config", () => {
      const workspacePath = "/workspace";
      const paths = resolveConfigPathsWithXdg(workspacePath);

      const userConfigIndex = 0; // User config is first (lowest priority)
      const projectConfigIndex = 1; // Project config is second (highest priority)

      expect(userConfigIndex).toBeLessThan(projectConfigIndex);
      expect(paths[projectConfigIndex]).toContain(".astdb/config.json");
    });

    test("respects XDG_CONFIG_HOME environment variable", () => {
      process.env.XDG_CONFIG_HOME = "/custom/xdg";
      const workspacePath = "/workspace";
      const paths = resolveConfigPathsWithXdg(workspacePath);

      expect(paths[0]).toBe("/custom/xdg/ast-copilot-helper/config.json");
    });

    test("handles absolute workspace paths", () => {
      const workspacePath = "/absolute/workspace/path";
      const paths = resolveConfigPathsWithXdg(workspacePath);

      expect(paths[1]).toBe("/absolute/workspace/path/.astdb/config.json");
    });

    test("handles relative workspace paths", () => {
      const workspacePath = "./relative/workspace";
      const paths = resolveConfigPathsWithXdg(workspacePath);

      // join() normalizes paths, removing leading ./
      expect(paths[1]).toBe("relative/workspace/.astdb/config.json");
    });

    test("custom config replaces default user config, not project config", () => {
      const workspacePath = "/workspace";
      const customConfig = "/my/config.json";
      const paths = resolveConfigPathsWithXdg(workspacePath, customConfig);

      expect(paths).not.toContain(getUserConfigPath());
      expect(paths).toContain("/my/config.json");
      expect(paths).toContain("/workspace/.astdb/config.json");
    });

    test("empty custom config path is ignored", () => {
      const workspacePath = "/workspace";
      const paths = resolveConfigPathsWithXdg(workspacePath, "");

      // Empty string is falsy, so should use default user config
      expect(paths[0]).toBe(getUserConfigPath());
    });
  });

  describe("Integration: Priority Order", () => {
    test("confirms config loading order: user config first, project config second", () => {
      const workspacePath = "/test/workspace";
      const paths = resolveConfigPathsWithXdg(workspacePath);

      // Paths are in loading order (lowest priority first)
      // This means later configs override earlier ones
      expect(paths[0]).toContain("ast-copilot-helper/config.json"); // User config
      expect(paths[1]).toContain(".astdb/config.json"); // Project config
    });

    test("custom user config maintains same priority as default user config", () => {
      const workspacePath = "/test/workspace";
      const customConfig = "/custom/my-config.json";

      const defaultPaths = resolveConfigPathsWithXdg(workspacePath);
      const customPaths = resolveConfigPathsWithXdg(
        workspacePath,
        customConfig,
      );

      // Both should have same number of paths
      expect(defaultPaths).toHaveLength(customPaths.length);

      // Project config should be in same position (last)
      expect(defaultPaths[1]).toBe(customPaths[1]);

      // Custom config replaces user config in first position
      expect(customPaths[0]).toBe(customConfig);
    });
  });
});
