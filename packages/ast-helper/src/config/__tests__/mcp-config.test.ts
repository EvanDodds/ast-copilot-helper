/**
 * Tests for MCP Configuration
 * Validates MCP config schema, validation, defaults, and merging
 */

import { describe, test, expect } from "vitest";
import { validateConfig, DEFAULT_CONFIG } from "../defaults.js";
import { ConfigManager } from "../manager.js";
import type { PartialConfig } from "../../types.js";

describe("MCP Configuration", () => {
  describe("Schema Validation", () => {
    test("accepts valid MCP config with port and autoStart", () => {
      const config: PartialConfig = {
        mcp: {
          port: 3000,
          autoStart: true,
        },
      };
      const validated = validateConfig(config);
      expect(validated.mcp?.port).toBe(3000);
      expect(validated.mcp?.autoStart).toBe(true);
    });

    test("rejects port below 1024", () => {
      const config: PartialConfig = {
        mcp: {
          port: 1023,
          autoStart: false,
        },
      };
      expect(() => validateConfig(config)).toThrow();
    });

    test("rejects port above 65535", () => {
      const config: PartialConfig = {
        mcp: {
          port: 65536,
          autoStart: false,
        },
      };
      expect(() => validateConfig(config)).toThrow();
    });

    test("accepts valid port range (1024-65535)", () => {
      const config1: PartialConfig = { mcp: { port: 1024, autoStart: false } };
      const config2: PartialConfig = { mcp: { port: 8080, autoStart: true } };
      const config3: PartialConfig = { mcp: { port: 65535, autoStart: false } };

      expect(() => validateConfig(config1)).not.toThrow();
      expect(() => validateConfig(config2)).not.toThrow();
      expect(() => validateConfig(config3)).not.toThrow();
    });

    test("rejects non-number port", () => {
      const config: PartialConfig = {
        mcp: {
          port: "invalid" as any,
          autoStart: false,
        },
      };
      expect(() => validateConfig(config)).toThrow();
    });

    test("accepts string representations of booleans for autoStart", () => {
      // The validation system accepts string "true"/"false" for booleans
      const config: PartialConfig = {
        mcp: {
          port: 3000,
          autoStart: "true" as any,
        },
      };
      const validated = validateConfig(config);
      expect(validated.mcp?.port).toBe(3000);
      // Note: validateConfig may keep the original value or coerce it
      expect(["true", true]).toContain(validated.mcp?.autoStart);
    });

    test("applies defaults when MCP section omitted", () => {
      const config: PartialConfig = {};
      const validated = validateConfig(config);
      expect(validated.mcp?.port).toBe(DEFAULT_CONFIG.mcp.port);
      expect(validated.mcp?.autoStart).toBe(DEFAULT_CONFIG.mcp.autoStart);
    });

    test("applies defaults when MCP section partially specified", () => {
      const config: PartialConfig = {
        mcp: {
          port: 8080,
        },
      };
      const validated = validateConfig(config);
      expect(validated.mcp?.port).toBe(8080);
      expect(validated.mcp?.autoStart).toBe(DEFAULT_CONFIG.mcp.autoStart);
    });
  });

  describe("Default Configuration", () => {
    test("DEFAULT_CONFIG includes MCP section", () => {
      expect(DEFAULT_CONFIG.mcp).toBeDefined();
      expect(DEFAULT_CONFIG.mcp?.port).toBe(3000);
      expect(DEFAULT_CONFIG.mcp?.autoStart).toBe(false);
    });

    test("MCP defaults are sensible", () => {
      expect(DEFAULT_CONFIG.mcp?.port).toBeGreaterThanOrEqual(1024);
      expect(DEFAULT_CONFIG.mcp?.port).toBeLessThanOrEqual(65535);
      expect(typeof DEFAULT_CONFIG.mcp?.autoStart).toBe("boolean");
    });
  });

  describe("Config Merging", () => {
    test("merges MCP config from multiple sources", () => {
      const manager = new ConfigManager();
      const sources: PartialConfig[] = [
        { mcp: { port: 3000 } },
        { mcp: { autoStart: true } },
      ];
      const merged = (manager as any).mergeConfigs(sources);
      expect(merged.mcp?.port).toBe(3000);
      expect(merged.mcp?.autoStart).toBe(true);
    });

    test("later source overrides earlier source for port", () => {
      const manager = new ConfigManager();
      const sources: PartialConfig[] = [
        { mcp: { port: 3000, autoStart: false } },
        { mcp: { port: 8080 } },
      ];
      const merged = (manager as any).mergeConfigs(sources);
      expect(merged.mcp?.port).toBe(8080);
      expect(merged.mcp?.autoStart).toBe(false);
    });

    test("later source overrides earlier source for autoStart", () => {
      const manager = new ConfigManager();
      const sources: PartialConfig[] = [
        { mcp: { port: 3000, autoStart: false } },
        { mcp: { autoStart: true } },
      ];
      const merged = (manager as any).mergeConfigs(sources);
      expect(merged.mcp?.port).toBe(3000);
      expect(merged.mcp?.autoStart).toBe(true);
    });

    test("handles undefined MCP section gracefully", () => {
      const manager = new ConfigManager();
      const sources: PartialConfig[] = [
        { topK: 10 },
        { mcp: { port: 3000, autoStart: true } },
        { topK: 15 },
      ];
      const merged = (manager as any).mergeConfigs(sources);
      expect(merged.mcp?.port).toBe(3000);
      expect(merged.mcp?.autoStart).toBe(true);
      expect(merged.topK).toBe(15);
    });
  });

  describe("Port Validation Edge Cases", () => {
    test("accepts minimum valid port (1024)", () => {
      const config: PartialConfig = {
        mcp: {
          port: 1024,
          autoStart: false,
        },
      };
      const result = validateConfig(config);
      expect(result.mcp?.port).toBe(1024);
    });

    test("accepts maximum valid port (65535)", () => {
      const config: PartialConfig = {
        mcp: {
          port: 65535,
          autoStart: false,
        },
      };
      const result = validateConfig(config);
      expect(result.mcp?.port).toBe(65535);
    });

    test("rejects port 1023 (just below minimum)", () => {
      const config: PartialConfig = {
        mcp: {
          port: 1023,
          autoStart: false,
        },
      };
      expect(() => validateConfig(config)).toThrow();
    });

    test("rejects port 65536 (just above maximum)", () => {
      const config: PartialConfig = {
        mcp: {
          port: 65536,
          autoStart: false,
        },
      };
      expect(() => validateConfig(config)).toThrow();
    });

    test("rejects negative port", () => {
      const config: PartialConfig = {
        mcp: {
          port: -1,
          autoStart: false,
        },
      };
      expect(() => validateConfig(config)).toThrow();
    });

    test("rejects zero port", () => {
      const config: PartialConfig = {
        mcp: {
          port: 0,
          autoStart: false,
        },
      };
      expect(() => validateConfig(config)).toThrow();
    });
  });

  describe("AutoStart Validation", () => {
    test("accepts true", () => {
      const config: PartialConfig = {
        mcp: {
          port: 3000,
          autoStart: true,
        },
      };
      const result = validateConfig(config);
      expect(result.mcp?.autoStart).toBe(true);
    });

    test("accepts false", () => {
      const config: PartialConfig = {
        mcp: {
          port: 3000,
          autoStart: false,
        },
      };
      const result = validateConfig(config);
      expect(result.mcp?.autoStart).toBe(false);
    });

    test("accepts string 'true' (validation allows it)", () => {
      const config: PartialConfig = {
        mcp: {
          port: 3000,
          autoStart: "true" as any,
        },
      };
      // The validation system accepts string representations like "true", "false"
      const result = validateConfig(config);
      expect(result.mcp?.port).toBe(3000);
      // Value may remain as string or be coerced
      expect(["true", true]).toContain(result.mcp?.autoStart);
    });

    test("accepts number 1 (validation allows it)", () => {
      const config: PartialConfig = {
        mcp: {
          port: 3000,
          autoStart: 1 as any,
        },
      };
      // The validation system accepts 0 and 1 as boolean representations
      const result = validateConfig(config);
      expect(result.mcp?.port).toBe(3000);
      // Value may remain as number or be coerced
      expect([1, true]).toContain(result.mcp?.autoStart);
    });
  });
});
