/**
 * @fileoverview Tests for data corruption detection and integrity validation
 * Validates milestone-week-3 medium-priority item: Data Corruption Detection
 *
 * @author AST Copilot Helper
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createIntegrityValidator, IntegrityValidator } from "../integrity";
import { ASTDatabaseManager } from "../manager";
import { AstLogger, LogLevel } from "../../logging";
import { join } from "path";
import { tmpdir } from "os";

// Mock modules
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  access: vi.fn(),
  readdir: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
}));

vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => "mocked-hash-value"),
  })),
}));

/**
 * @fileoverview Tests for data corruption detection and integrity validation
 * Validates milestone-week-3 medium-priority item: Data Corruption Detection
 *
 * @author AST Copilot Helper
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createIntegrityValidator, IntegrityValidator } from "../integrity";
import { ASTDatabaseManager } from "../manager";

describe("IntegrityValidator", () => {
  let validator: IntegrityValidator;
  let mockDbManager: ASTDatabaseManager;

  beforeEach(() => {
    // Mock database manager
    mockDbManager = {
      validateDatabaseStructure: vi.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      }),
      getDatabaseStructure: vi.fn().mockReturnValue({
        models: "/tmp/test/models",
        vectors: "/tmp/test/vectors",
        cache: "/tmp/test/cache",
      }),
    } as any;

    // Create validator instance
    validator = createIntegrityValidator(mockDbManager);
  });

  describe("createIntegrityValidator", () => {
    it("should create a new validator instance", () => {
      const newValidator = createIntegrityValidator(mockDbManager);
      expect(newValidator).toBeInstanceOf(IntegrityValidator);
    });
  });

  describe("validateIntegrity", () => {
    it("should perform basic integrity validation with valid database", async () => {
      // Test with valid database structure
      const report = await validator.validateIntegrity();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.duration).toBeGreaterThan(0);
      expect(report.databaseIntegrity.isValid).toBe(true);
      expect(report.performanceMetrics).toBeDefined();
      expect(report.performanceMetrics.structureCheckTime).toBeGreaterThan(0);
      expect(report.performanceMetrics.embeddingCheckTime).toBeGreaterThan(0);
      expect(report.performanceMetrics.metadataCheckTime).toBeGreaterThan(0);
      expect(report.performanceMetrics.consistencyCheckTime).toBeGreaterThan(0);
    });

    it("should detect database structure corruption", async () => {
      // Mock database validation failure
      mockDbManager.validateDatabaseStructure = vi.fn().mockResolvedValue({
        isValid: false,
        errors: ["Database structure corrupted"],
        warnings: [],
      });

      const report = await validator.validateIntegrity();

      expect(report.isValid).toBe(false);
      expect(report.databaseIntegrity.isValid).toBe(false);
      expect(report.recommendedActions).toContain(
        "Database structure corruption detected - recreate .astdb directories",
      );
      expect(report.recommendedActions).toContain(
        "Verify file system permissions and disk space",
      );
    });

    it("should provide comprehensive performance metrics", async () => {
      const report = await validator.validateIntegrity();

      expect(report.performanceMetrics).toBeDefined();
      expect(typeof report.performanceMetrics.structureCheckTime).toBe(
        "number",
      );
      expect(typeof report.performanceMetrics.embeddingCheckTime).toBe(
        "number",
      );
      expect(typeof report.performanceMetrics.metadataCheckTime).toBe("number");
      expect(typeof report.performanceMetrics.consistencyCheckTime).toBe(
        "number",
      );

      expect(
        report.performanceMetrics.structureCheckTime,
      ).toBeGreaterThanOrEqual(0);
      expect(
        report.performanceMetrics.embeddingCheckTime,
      ).toBeGreaterThanOrEqual(0);
      expect(
        report.performanceMetrics.metadataCheckTime,
      ).toBeGreaterThanOrEqual(0);
      expect(
        report.performanceMetrics.consistencyCheckTime,
      ).toBeGreaterThanOrEqual(0);
    });

    it("should handle validation errors gracefully", async () => {
      // Mock database manager throwing error
      mockDbManager.validateDatabaseStructure = vi
        .fn()
        .mockRejectedValue(new Error("Database access failed"));

      const report = await validator.validateIntegrity();

      expect(report.isValid).toBe(false);
      expect(report.recommendedActions).toContain(
        "Database structure corruption detected - recreate .astdb directories",
      );
    });
  });

  describe("recoverFromCorruption", () => {
    it("should perform corruption recovery with default options", async () => {
      const mockReport = {
        isValid: false,
        timestamp: new Date(),
        duration: 100,
        databaseIntegrity: { isValid: true },
        embeddingIntegrity: {
          isValid: false,
          totalFiles: 2,
          corruptedFiles: ["corrupted.json"],
        },
        metadataIntegrity: {
          isValid: false,
          totalMetadata: 1,
          corruptedMetadata: ["bad_metadata.json"],
          checksumMismatches: 1,
        },
        fileConsistency: {
          isValid: false,
          totalFiles: 3,
          orphanedFiles: 1,
          missingReferences: 0,
        },
        recommendedActions: ["Fix corruption"],
        performanceMetrics: {
          structureCheckTime: 10,
          embeddingCheckTime: 20,
          metadataCheckTime: 30,
          consistencyCheckTime: 40,
        },
      };

      const result = await validator.recoverFromCorruption(mockReport);

      expect(result).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.actionsPerformed).toContain("Created database backup");
      expect(result.actionsPerformed.length).toBeGreaterThan(0);
      expect(typeof result.recoveredItems).toBe("number");
      expect(typeof result.unrecoverableItems).toBe("number");
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it("should skip backup when createBackup is false", async () => {
      const mockReport = {
        isValid: false,
        timestamp: new Date(),
        duration: 100,
        databaseIntegrity: { isValid: true },
        embeddingIntegrity: {
          isValid: true,
          totalFiles: 0,
          corruptedFiles: [],
        },
        metadataIntegrity: {
          isValid: true,
          totalMetadata: 0,
          corruptedMetadata: [],
          checksumMismatches: 0,
        },
        fileConsistency: {
          isValid: true,
          totalFiles: 0,
          orphanedFiles: 0,
          missingReferences: 0,
        },
        recommendedActions: [],
        performanceMetrics: {
          structureCheckTime: 10,
          embeddingCheckTime: 20,
          metadataCheckTime: 30,
          consistencyCheckTime: 40,
        },
      };

      const result = await validator.recoverFromCorruption(mockReport, {
        autoRecover: true,
        createBackup: false,
        maxRetries: 1,
        rebuildIndices: false,
        recalculateChecksums: false,
      });

      expect(result.actionsPerformed).not.toContain("Created database backup");
    });

    it("should track recovery metrics correctly", async () => {
      const mockReport = {
        isValid: false,
        timestamp: new Date(),
        duration: 100,
        databaseIntegrity: { isValid: true },
        embeddingIntegrity: {
          isValid: false,
          totalFiles: 2,
          corruptedFiles: ["file1.json", "file2.json"],
        },
        metadataIntegrity: {
          isValid: true,
          totalMetadata: 0,
          corruptedMetadata: [],
          checksumMismatches: 0,
        },
        fileConsistency: {
          isValid: true,
          totalFiles: 0,
          orphanedFiles: 0,
          missingReferences: 0,
        },
        recommendedActions: [],
        performanceMetrics: {
          structureCheckTime: 10,
          embeddingCheckTime: 20,
          metadataCheckTime: 30,
          consistencyCheckTime: 40,
        },
      };

      const result = await validator.recoverFromCorruption(mockReport, {
        autoRecover: true,
        createBackup: true,
        maxRetries: 3,
        rebuildIndices: true,
        recalculateChecksums: true,
      });

      expect(result.recoveredItems).toBe(2); // Two corrupted files
      expect(result.duration).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });
  });

  describe("Integration scenarios", () => {
    it("should provide valid recommendations for healthy database", async () => {
      const report = await validator.validateIntegrity();

      if (report.isValid) {
        expect(report.recommendedActions).toContain(
          "Database integrity is good - no action required",
        );
      }

      // Should always have at least one recommendation
      expect(report.recommendedActions.length).toBeGreaterThan(0);
    });

    it("should handle database manager interface correctly", async () => {
      // Verify the database manager is called correctly
      await validator.validateIntegrity();

      expect(mockDbManager.validateDatabaseStructure).toHaveBeenCalled();
      expect(mockDbManager.getDatabaseStructure).toHaveBeenCalled();
    });

    it("should measure performance correctly", async () => {
      const startTime = Date.now();
      const report = await validator.validateIntegrity();
      const endTime = Date.now();

      // Duration should be reasonable
      expect(report.duration).toBeGreaterThan(0);
      expect(report.duration).toBeLessThan(endTime - startTime + 100); // Allow some margin
    });
  });

  describe("Error handling", () => {
    it("should handle database structure validation errors", async () => {
      mockDbManager.validateDatabaseStructure = vi
        .fn()
        .mockRejectedValue(new Error("Connection failed"));

      const report = await validator.validateIntegrity();

      expect(report.isValid).toBe(false);
      expect(report.databaseIntegrity.isValid).toBe(false);
      expect(report.databaseIntegrity.error).toBeDefined();
    });

    it("should handle missing database structure gracefully", async () => {
      mockDbManager.getDatabaseStructure = vi.fn().mockReturnValue({
        models: "/nonexistent/models",
        vectors: "/nonexistent/vectors",
        cache: "/nonexistent/cache",
      });

      const report = await validator.validateIntegrity();

      // Should still complete validation even with missing directories
      expect(report).toBeDefined();
      expect(report.duration).toBeGreaterThan(0);
    });
  });

  describe("Interface validation", () => {
    it("should return correctly structured IntegrityReport", async () => {
      const report = await validator.validateIntegrity();

      // Validate report structure
      expect(typeof report.isValid).toBe("boolean");
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(typeof report.duration).toBe("number");

      // Validate sub-reports
      expect(typeof report.databaseIntegrity.isValid).toBe("boolean");
      expect(typeof report.embeddingIntegrity.isValid).toBe("boolean");
      expect(typeof report.metadataIntegrity.isValid).toBe("boolean");
      expect(typeof report.fileConsistency.isValid).toBe("boolean");

      // Validate arrays
      expect(Array.isArray(report.recommendedActions)).toBe(true);

      // Validate metrics
      expect(typeof report.performanceMetrics).toBe("object");
      expect(typeof report.performanceMetrics.structureCheckTime).toBe(
        "number",
      );
      expect(typeof report.performanceMetrics.embeddingCheckTime).toBe(
        "number",
      );
      expect(typeof report.performanceMetrics.metadataCheckTime).toBe("number");
      expect(typeof report.performanceMetrics.consistencyCheckTime).toBe(
        "number",
      );
    });

    it("should return correctly structured RecoveryResult", async () => {
      const mockReport = {
        isValid: false,
        timestamp: new Date(),
        duration: 100,
        databaseIntegrity: { isValid: true },
        embeddingIntegrity: {
          isValid: true,
          totalFiles: 0,
          corruptedFiles: [],
        },
        metadataIntegrity: {
          isValid: true,
          totalMetadata: 0,
          corruptedMetadata: [],
          checksumMismatches: 0,
        },
        fileConsistency: {
          isValid: true,
          totalFiles: 0,
          orphanedFiles: 0,
          missingReferences: 0,
        },
        recommendedActions: [],
        performanceMetrics: {
          structureCheckTime: 10,
          embeddingCheckTime: 20,
          metadataCheckTime: 30,
          consistencyCheckTime: 40,
        },
      };

      const result = await validator.recoverFromCorruption(mockReport);

      // Validate result structure
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.recoveredItems).toBe("number");
      expect(typeof result.unrecoverableItems).toBe("number");
      expect(typeof result.duration).toBe("number");
      expect(Array.isArray(result.actionsPerformed)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
