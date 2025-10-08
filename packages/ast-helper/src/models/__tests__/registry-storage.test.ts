/**
 * Unit tests for ModelRegistryStorage
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { rm } from "fs/promises";
import { existsSync } from "fs";
import { ModelRegistryStorage } from "../registry-storage.js";
import type { ModelConfig } from "../types.js";

describe("ModelRegistryStorage", () => {
  const testDir = join(process.cwd(), ".test-registry");
  let registry: ModelRegistryStorage;

  const mockModelConfig: ModelConfig = {
    name: "test-model",
    version: "1.0.0",
    url: "https://example.com/model.onnx",
    checksum: "abc123def456",
    size: 1024000,
    format: "onnx",
    dimensions: 384,
  };

  beforeEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
    registry = new ModelRegistryStorage(testDir);
    await registry.initialize();
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe("registerModel", () => {
    it("should register a new model successfully", async () => {
      await registry.registerModel(
        mockModelConfig.name,
        mockModelConfig,
        "/path/to/model.onnx",
        mockModelConfig.size,
      );

      const model = await registry.getModel(mockModelConfig.name);
      expect(model).toBeDefined();
      expect(model?.modelName).toBe(mockModelConfig.name);
      expect(model?.version).toBe(mockModelConfig.version);
      expect(model?.checksum).toBe(mockModelConfig.checksum);
    });

    it("should update existing model on re-registration", async () => {
      // Register first time
      await registry.registerModel(
        mockModelConfig.name,
        mockModelConfig,
        "/path/to/model.onnx",
        mockModelConfig.size,
      );

      // Register again with different version
      const updatedConfig = { ...mockModelConfig, version: "2.0.0" };
      await registry.registerModel(
        mockModelConfig.name,
        updatedConfig,
        "/path/to/model-v2.onnx",
        mockModelConfig.size,
      );

      const model = await registry.getModel(mockModelConfig.name);
      expect(model?.version).toBe("2.0.0");
    });
  });

  describe("updateVerificationStatus", () => {
    it("should update verification status for a model", async () => {
      await registry.registerModel(
        mockModelConfig.name,
        mockModelConfig,
        "/path/to/model.onnx",
        mockModelConfig.size,
      );

      await registry.updateVerificationStatus(
        mockModelConfig.name,
        true,
        false,
      );

      const model = await registry.getModel(mockModelConfig.name);
      expect(model?.checksumVerified).toBe(true);
      expect(model?.signatureVerified).toBe(false);
      expect(model?.lastVerification).toBeGreaterThan(0);
    });
  });

  describe("addVerificationHistory", () => {
    it("should add verification history entry", async () => {
      await registry.registerModel(
        mockModelConfig.name,
        mockModelConfig,
        "/path/to/model.onnx",
        mockModelConfig.size,
      );

      await registry.addVerificationHistory({
        modelName: mockModelConfig.name,
        timestamp: Date.now(),
        result: "success",
        checksumMatch: true,
        signatureMatch: null,
        errorMessage: null,
      });

      const history = await registry.getVerificationHistory(
        mockModelConfig.name,
      );
      expect(history).toHaveLength(1);
      expect(history[0]?.result).toBe("success");
      expect(history[0]?.checksumMatch).toBe(true);
    });

    it("should record failed verification in history", async () => {
      await registry.registerModel(
        mockModelConfig.name,
        mockModelConfig,
        "/path/to/model.onnx",
        mockModelConfig.size,
      );

      await registry.addVerificationHistory({
        modelName: mockModelConfig.name,
        timestamp: Date.now(),
        result: "failure",
        checksumMatch: false,
        signatureMatch: null,
        errorMessage: "Checksum mismatch",
      });

      const history = await registry.getVerificationHistory(
        mockModelConfig.name,
      );
      expect(history[0]?.result).toBe("failure");
      expect(history[0]?.errorMessage).toBe("Checksum mismatch");
    });
  });

  describe("getAllModels", () => {
    it("should return empty array when no models registered", async () => {
      const models = await registry.getAllModels();
      expect(models).toEqual([]);
    });

    it("should return all registered models", async () => {
      await registry.registerModel(
        "model1",
        { ...mockModelConfig, name: "model1" },
        "/path/to/model1.onnx",
        1000,
      );
      await registry.registerModel(
        "model2",
        { ...mockModelConfig, name: "model2" },
        "/path/to/model2.onnx",
        2000,
      );

      const models = await registry.getAllModels();
      expect(models).toHaveLength(2);
      expect(models.map((m) => m.modelName)).toContain("model1");
      expect(models.map((m) => m.modelName)).toContain("model2");
    });
  });

  describe("getModelsNeedingVerification", () => {
    it("should return models never verified", async () => {
      await registry.registerModel(
        mockModelConfig.name,
        mockModelConfig,
        "/path/to/model.onnx",
        mockModelConfig.size,
      );

      const needsVerification = await registry.getModelsNeedingVerification(7);
      expect(needsVerification).toHaveLength(1);
      expect(needsVerification[0]).toBe(mockModelConfig.name);
    });

    it("should return models with old verification", async () => {
      await registry.registerModel(
        mockModelConfig.name,
        mockModelConfig,
        "/path/to/model.onnx",
        mockModelConfig.size,
      );

      // Set verification to 10 days ago
      const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
      await registry.updateVerificationStatus(
        mockModelConfig.name,
        true,
        false,
      );

      // Manually update timestamp to simulate old verification
      const db = (registry as unknown as { db: unknown }).db;
      if (db && typeof db === "object" && "prepare" in db) {
        const stmt = (
          db as {
            prepare: (sql: string) => {
              run: (params: {
                lastVerification: number;
                modelName: string;
              }) => void;
            };
          }
        ).prepare(
          "UPDATE model_registry SET last_verification = :lastVerification WHERE model_name = :modelName",
        );
        stmt.run({
          lastVerification: tenDaysAgo,
          modelName: mockModelConfig.name,
        });
      }

      const needsVerification = await registry.getModelsNeedingVerification(7);
      expect(needsVerification.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("deleteModel", () => {
    it("should delete model and its history", async () => {
      await registry.registerModel(
        mockModelConfig.name,
        mockModelConfig,
        "/path/to/model.onnx",
        mockModelConfig.size,
      );

      await registry.addVerificationHistory({
        modelName: mockModelConfig.name,
        timestamp: Date.now(),
        result: "success",
        checksumMatch: true,
        signatureMatch: null,
        errorMessage: null,
      });

      await registry.deleteModel(mockModelConfig.name);

      const model = await registry.getModel(mockModelConfig.name);
      expect(model).toBeNull();

      const history = await registry.getVerificationHistory(
        mockModelConfig.name,
      );
      expect(history).toHaveLength(0);
    });
  });

  describe("getStatistics", () => {
    it("should return statistics for empty registry", async () => {
      const stats = await registry.getStatistics();
      expect(stats.totalModels).toBe(0);
      expect(stats.verifiedModels).toBe(0);
      expect(stats.unverifiedModels).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    it("should return accurate statistics", async () => {
      // Add 3 models
      await registry.registerModel(
        "model1",
        { ...mockModelConfig, name: "model1" },
        "/path/to/model1.onnx",
        1000,
      );
      await registry.registerModel(
        "model2",
        { ...mockModelConfig, name: "model2" },
        "/path/to/model2.onnx",
        2000,
      );
      await registry.registerModel(
        "model3",
        { ...mockModelConfig, name: "model3" },
        "/path/to/model3.onnx",
        3000,
      );

      // Verify 2 models
      await registry.updateVerificationStatus("model1", true, false);
      await registry.updateVerificationStatus("model2", true, true);

      const stats = await registry.getStatistics();
      expect(stats.totalModels).toBe(3);
      expect(stats.verifiedModels).toBe(2);
      expect(stats.unverifiedModels).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });
});
