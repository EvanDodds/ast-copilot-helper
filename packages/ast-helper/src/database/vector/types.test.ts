/**
 * Vector Database Types and Configuration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import { join } from "path";
import {
  VectorDBConfig,
  validateVectorDBConfig,
  createVectorDBConfig,
  DEFAULT_VECTOR_DB_CONFIG,
  VectorConfigManager,
  createVectorConfig,
  loadVectorConfig,
} from "../vector/index.js";

describe("Vector Database Types", () => {
  describe("validateVectorDBConfig", () => {
    it("should pass validation for valid config", () => {
      const config: VectorDBConfig = {
        dimensions: 768,
        maxElements: 100000,
        M: 16,
        efConstruction: 200,
        space: "cosine",
        storageFile: "test.sqlite",
        indexFile: "test.hnsw",
        autoSave: true,
        saveInterval: 300,
      };

      const errors = validateVectorDBConfig(config);
      expect(errors).toHaveLength(0);
    });

    it("should fail validation for invalid dimensions", () => {
      const config = createVectorDBConfig({
        dimensions: 0,
        storageFile: "test.sqlite",
        indexFile: "test.hnsw",
      });

      const errors = validateVectorDBConfig(config);
      expect(errors).toContain("dimensions must be greater than 0");
    });

    it("should fail validation for invalid M parameter", () => {
      const config = createVectorDBConfig({
        M: 0,
        storageFile: "test.sqlite",
        indexFile: "test.hnsw",
      });

      const errors = validateVectorDBConfig(config);
      expect(errors).toContain("M must be between 1 and 100");
    });

    it("should fail validation for efConstruction < M", () => {
      const config = createVectorDBConfig({
        M: 50,
        efConstruction: 20,
        storageFile: "test.sqlite",
        indexFile: "test.hnsw",
      });

      const errors = validateVectorDBConfig(config);
      expect(errors).toContain(
        "efConstruction should be >= M for optimal performance",
      );
    });

    it("should fail validation for invalid space metric", () => {
      const config = createVectorDBConfig({
        space: "invalid" as any,
        storageFile: "test.sqlite",
        indexFile: "test.hnsw",
      });

      const errors = validateVectorDBConfig(config);
      expect(errors).toContain("space must be one of: cosine, l2, ip");
    });
  });

  describe("createVectorDBConfig", () => {
    it("should apply defaults for missing properties", () => {
      const config = createVectorDBConfig({
        storageFile: "test.sqlite",
        indexFile: "test.hnsw",
      });

      expect(config.dimensions).toBe(DEFAULT_VECTOR_DB_CONFIG.dimensions);
      expect(config.maxElements).toBe(DEFAULT_VECTOR_DB_CONFIG.maxElements);
      expect(config.M).toBe(DEFAULT_VECTOR_DB_CONFIG.M);
      expect(config.efConstruction).toBe(
        DEFAULT_VECTOR_DB_CONFIG.efConstruction,
      );
      expect(config.space).toBe(DEFAULT_VECTOR_DB_CONFIG.space);
      expect(config.autoSave).toBe(DEFAULT_VECTOR_DB_CONFIG.autoSave);
      expect(config.saveInterval).toBe(DEFAULT_VECTOR_DB_CONFIG.saveInterval);
    });

    it("should override defaults with provided values", () => {
      const config = createVectorDBConfig({
        dimensions: 512,
        maxElements: 50000,
        M: 32,
        space: "l2",
        storageFile: "custom.sqlite",
        indexFile: "custom.hnsw",
      });

      expect(config.dimensions).toBe(512);
      expect(config.maxElements).toBe(50000);
      expect(config.M).toBe(32);
      expect(config.space).toBe("l2");
      expect(config.storageFile).toBe("custom.sqlite");
      expect(config.indexFile).toBe("custom.hnsw");
    });
  });
});

describe("VectorConfigManager", () => {
  let manager: VectorConfigManager;
  let tempDir: string;
  let testConfigPath: string;

  beforeEach(async () => {
    manager = new VectorConfigManager();
    tempDir = join(process.cwd(), "temp-test-vectors");
    testConfigPath = join(tempDir, "vector-config.json");

    // Clean up any existing test directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  describe("createConfig", () => {
    it("should create config with default options", async () => {
      const config = await manager.createConfig({
        dataDir: tempDir,
      });

      expect(config.dimensions).toBe(768);
      expect(config.storageFile).toBe(join(tempDir, "ast-copilot.sqlite"));
      expect(config.indexFile).toBe(join(tempDir, "ast-copilot.hnsw"));
    });

    it("should apply environment-specific settings for test environment", async () => {
      const config = await manager.createConfig({
        dataDir: tempDir,
        environment: "test",
      });

      expect(config.maxElements).toBe(1000);
      expect(config.saveInterval).toBe(10);
      expect(config.autoSave).toBe(false);
    });

    it("should apply environment-specific settings for production environment", async () => {
      const config = await manager.createConfig({
        dataDir: tempDir,
        environment: "production",
      });

      expect(config.maxElements).toBe(500000);
      expect(config.saveInterval).toBe(600);
      expect(config.autoSave).toBe(true);
    });

    it("should apply user overrides", async () => {
      const config = await manager.createConfig({
        dataDir: tempDir,
        overrides: {
          dimensions: 512,
          M: 32,
          space: "l2",
        },
      });

      expect(config.dimensions).toBe(512);
      expect(config.M).toBe(32);
      expect(config.space).toBe("l2");
    });

    it("should create data directory if it does not exist", async () => {
      await manager.createConfig({
        dataDir: tempDir,
      });

      const stats = await fs.stat(tempDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe("file operations", () => {
    it("should save and load configuration from file", async () => {
      const originalConfig = await manager.createConfig({
        dataDir: tempDir,
        overrides: {
          dimensions: 512,
          maxElements: 50000,
        },
      });

      await manager.saveToFile(testConfigPath);

      const newManager = new VectorConfigManager();
      const loadedConfig = await newManager.loadFromFile(testConfigPath);

      expect(loadedConfig.dimensions).toBe(originalConfig.dimensions);
      expect(loadedConfig.maxElements).toBe(originalConfig.maxElements);
      expect(loadedConfig.storageFile).toBe(originalConfig.storageFile);
      expect(loadedConfig.indexFile).toBe(originalConfig.indexFile);
    });

    it("should throw error when loading non-existent file", async () => {
      await expect(
        manager.loadFromFile("non-existent-config.json"),
      ).rejects.toThrow("Configuration file not found");
    });
  });

  describe("updateConfig", () => {
    it("should update configuration with partial changes", async () => {
      await manager.createConfig({ dataDir: tempDir });

      const updatedConfig = manager.updateConfig({
        dimensions: 512,
        M: 32,
      });

      expect(updatedConfig.dimensions).toBe(512);
      expect(updatedConfig.M).toBe(32);
      expect(updatedConfig.efConstruction).toBe(200); // Should preserve existing values
    });

    it("should validate updates and reject invalid changes", async () => {
      await manager.createConfig({ dataDir: tempDir });

      expect(() =>
        manager.updateConfig({
          dimensions: 0, // Invalid
        }),
      ).toThrow("Invalid configuration updates");
    });
  });

  describe("getConfigSummary", () => {
    it("should return not_initialized when config not set", () => {
      const summary = manager.getConfigSummary();
      expect(summary).toEqual({ status: "not_initialized" });
    });

    it("should return config summary when initialized", async () => {
      const config = await manager.createConfig({ dataDir: tempDir });
      const summary = manager.getConfigSummary();

      expect(summary).toMatchObject({
        dimensions: config.dimensions,
        maxElements: config.maxElements,
        M: config.M,
        efConstruction: config.efConstruction,
        space: config.space,
        autoSave: config.autoSave,
        saveInterval: config.saveInterval,
        storageFile: config.storageFile,
        indexFile: config.indexFile,
      });
    });
  });
});

describe("Configuration utilities", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(process.cwd(), "temp-test-config-utils");

    // Clean up any existing test directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  describe("createVectorConfig", () => {
    it("should create config with default options when no options provided", async () => {
      const config = await createVectorConfig();

      expect(config.dimensions).toBe(768);
      expect(config.maxElements).toBe(100000);
      expect(config.M).toBe(16);
      expect(config.efConstruction).toBe(200);
      expect(config.space).toBe("cosine");
      expect(config.autoSave).toBe(true);
      expect(config.saveInterval).toBe(300);
    });

    it("should override defaults with provided options", async () => {
      const config = await createVectorConfig({
        dataDir: tempDir,
        dbName: "custom-db",
        environment: "test",
        overrides: {
          dimensions: 256,
          M: 8,
        },
      });

      expect(config.dimensions).toBe(256);
      expect(config.M).toBe(8);
      expect(config.maxElements).toBe(1000); // Test environment setting
      expect(config.storageFile).toBe(join(tempDir, "custom-db.sqlite"));
      expect(config.indexFile).toBe(join(tempDir, "custom-db.hnsw"));
    });
  });

  describe("loadVectorConfig", () => {
    it("should load config with environment defaults when no config file specified", async () => {
      // Clear environment variables that might affect the test
      delete process.env.AST_VECTOR_CONFIG_FILE;
      delete process.env.AST_VECTOR_DATA_DIR;
      delete process.env.AST_VECTOR_DB_NAME;

      const config = await loadVectorConfig();

      expect(config.dimensions).toBe(768);
      expect(config.storageFile).toContain("ast-copilot.sqlite");
      expect(config.indexFile).toContain("ast-copilot.hnsw");
    });
  });
});
