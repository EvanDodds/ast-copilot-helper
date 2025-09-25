import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import * as path from "path";

// Mock dependencies
vi.mock("child_process");
vi.mock("fs");
vi.mock("path");

// Mock implementation functions
const mockExecSync = vi.mocked(execSync);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockPathJoin = vi.mocked(path.join);

// Import the modules after mocking
import {
  StagingDeployment,
  DeploymentResult,
} from "../../../scripts/ci-cd/deploy-staging";
import { ProductionDeployment } from "../../../scripts/ci-cd/deploy-production";
import { RollbackAutomation } from "../../../scripts/ci-cd/rollback-automation";

describe("Deployment Automation Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default path.join mock
    mockPathJoin.mockImplementation((...paths) => paths.join("/"));

    // Mock process.cwd
    vi.spyOn(process, "cwd").mockReturnValue("/mock/workspace");

    // Mock environment variables
    process.env.CI_COMMIT_SHA = "abc123";
    process.env.CI_BUILD_ID = "build-456";
    process.env.NODE_ENV = "test"; // Indicate test environment
    process.env.SKIP_DEPLOYMENT_DELAYS = "true"; // Skip artificial delays in tests
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CI_COMMIT_SHA;
    delete process.env.CI_BUILD_ID;
    delete process.env.NODE_ENV;
    delete process.env.SKIP_DEPLOYMENT_DELAYS;
  });

  describe("StagingDeployment", () => {
    describe("successful deployment", () => {
      it("should successfully deploy to staging environment", async () => {
        // Arrange
        mockExecSync.mockReturnValue("success");
        mockExistsSync.mockReturnValue(false);
        const deployment = new StagingDeployment();

        // Act
        const result = await deployment.deploy();

        // Assert
        expect(result.success).toBe(true);
        expect(result.version).toBe("abc123");
        expect(result.deploymentId).toMatch(/staging-build-456-\d+/);
        expect(result.healthCheckPassed).toBe(true);
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining("yarn run build"),
          expect.any(Object),
        );
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining("yarn run test:unit"),
          expect.any(Object),
        );
      });

      it("should handle deployment without health check URL", async () => {
        // Arrange
        delete process.env.STAGING_HEALTH_CHECK_URL;
        mockExecSync.mockReturnValue("success");
        mockExistsSync.mockReturnValue(false);
        const deployment = new StagingDeployment();

        // Act
        const result = await deployment.deploy();

        // Assert
        expect(result.success).toBe(true);
        expect(result.healthCheckPassed).toBe(true); // Should pass when no URL configured
      });
    });

    describe("deployment failures", () => {
      it("should handle build failure", async () => {
        // Arrange
        mockExecSync.mockImplementation((command: string) => {
          if (command.includes("yarn run build")) {
            throw new Error("Build failed");
          }
          return "success";
        });
        mockExistsSync.mockReturnValue(false);
        const deployment = new StagingDeployment();

        // Act & Assert
        await expect(deployment.deploy()).rejects.toThrow("Build failed");
      });

      it("should handle test failure", async () => {
        // Arrange
        mockExecSync.mockImplementation((command: string) => {
          if (command.includes("yarn run test:unit")) {
            throw new Error("Tests failed");
          }
          return "success";
        });
        mockExistsSync.mockReturnValue(false);
        const deployment = new StagingDeployment();

        // Act & Assert
        await expect(deployment.deploy()).rejects.toThrow("Tests failed");
      });
    });

    describe("rollback functionality", () => {
      it("should successfully perform rollback", async () => {
        // Arrange
        const deployment = new StagingDeployment();

        // Act
        await deployment.rollback("v1.0.0");

        // Assert - rollback should complete without throwing
        expect(true).toBe(true);
      });

      it("should trigger rollback on deployment failure", async () => {
        // Arrange
        const mockDeploymentState = [
          { success: true, version: "v0.9.0", healthCheckPassed: true },
          { success: true, version: "v1.0.0", healthCheckPassed: true },
        ];
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(mockDeploymentState));
        mockExecSync.mockImplementation((command: string) => {
          if (command.includes("yarn run build")) {
            throw new Error("Build failed");
          }
          return "success";
        });

        const deployment = new StagingDeployment();
        const rollbackSpy = vi
          .spyOn(deployment, "rollback")
          .mockResolvedValue();

        // Act & Assert
        await expect(deployment.deploy()).rejects.toThrow("Build failed");
        expect(rollbackSpy).toHaveBeenCalledWith("v0.9.0");
      });
    });
  });

  describe("ProductionDeployment", () => {
    describe("successful deployment", () => {
      it("should successfully deploy to production with approval", async () => {
        // Arrange
        process.env.DEPLOYMENT_APPROVAL_TOKEN = "approved";
        process.env.PRODUCTION_HEALTH_CHECK_URLS =
          "https://api.example.com/health,https://app.example.com/health";
        mockExecSync.mockReturnValue("success");
        mockExistsSync.mockReturnValue(false);
        const deployment = new ProductionDeployment();

        // Act
        const result = await deployment.deploy();

        // Assert
        expect(result.success).toBe(true);
        expect(result.deploymentStrategy).toBe("rolling");
        expect(result.allHealthChecksPassed).toBe(true);
        expect(Object.keys(result.healthCheckResults)).toHaveLength(2);
      });

      it("should handle blue-green deployment strategy", async () => {
        // Arrange
        process.env.DEPLOYMENT_APPROVAL_TOKEN = "approved";
        process.env.BLUE_GREEN_DEPLOYMENT = "true";
        mockExecSync.mockReturnValue("success");
        mockExistsSync.mockReturnValue(false);
        const deployment = new ProductionDeployment();

        // Act
        const result = await deployment.deploy();

        // Assert
        expect(result.success).toBe(true);
        expect(result.deploymentStrategy).toBe("blue-green");
      });
    });

    describe("deployment security and validation", () => {
      it("should fail deployment without approval", async () => {
        // Arrange
        delete process.env.DEPLOYMENT_APPROVAL_TOKEN;
        const deployment = new ProductionDeployment();

        // Act & Assert
        await expect(deployment.deploy()).rejects.toThrow(
          "Deployment not approved",
        );
      });

      it("should run comprehensive security checks", async () => {
        // Arrange
        process.env.DEPLOYMENT_APPROVAL_TOKEN = "approved";
        mockExecSync.mockReturnValue("success");
        mockExistsSync.mockReturnValue(false);
        const deployment = new ProductionDeployment();

        // Act
        await deployment.deploy();

        // Assert
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining("yarn run security:audit"),
          expect.any(Object),
        );
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining("yarn run quality:check"),
          expect.any(Object),
        );
      });

      it("should handle health check failures", async () => {
        // Arrange
        process.env.DEPLOYMENT_APPROVAL_TOKEN = "approved";
        process.env.PRODUCTION_HEALTH_CHECK_URLS =
          "https://api.example.com/health";
        mockExecSync.mockReturnValue("success");
        mockExistsSync.mockReturnValue(false);

        // Mock health check failure
        const originalRandom = Math.random;
        Math.random = vi.fn(() => 0.05); // Force health check failure

        const deployment = new ProductionDeployment();

        try {
          // Act & Assert
          await expect(deployment.deploy()).rejects.toThrow(
            "One or more health checks failed",
          );
        } finally {
          Math.random = originalRandom;
        }
      });
    });
  });

  describe("RollbackAutomation", () => {
    describe("rollback execution", () => {
      it("should successfully execute rollback for staging", async () => {
        // Arrange
        const mockDeploymentHistory = [
          { success: true, version: "v1.0.0", healthCheckPassed: true },
          { success: true, version: "v1.1.0", healthCheckPassed: true },
          { success: false, version: "v1.2.0", healthCheckPassed: false },
        ];
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(mockDeploymentHistory));
        mockExecSync.mockReturnValue("success");

        const rollback = new RollbackAutomation(
          "staging",
          "Health check failure",
        );

        // Act
        const result = await rollback.execute();

        // Assert
        expect(result.success).toBe(true);
        expect(result.environment).toBe("staging");
        expect(result.toVersion).toBe("v1.1.0"); // Should rollback to second-to-last successful
        expect(result.validationPassed).toBe(true);
      });

      it("should successfully execute rollback for production", async () => {
        // Arrange
        const mockDeploymentHistory = [
          { success: true, version: "v1.0.0", allHealthChecksPassed: true },
          { success: true, version: "v1.1.0", allHealthChecksPassed: true },
          { success: false, version: "v1.2.0", allHealthChecksPassed: false },
        ];
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(mockDeploymentHistory));
        mockExecSync.mockReturnValue("success");

        const rollback = new RollbackAutomation(
          "production",
          "Deployment failure",
        );

        // Act
        const result = await rollback.execute();

        // Assert
        expect(result.success).toBe(true);
        expect(result.environment).toBe("production");
        expect(result.toVersion).toBe("v1.1.0");
      });

      it("should use target version when provided", async () => {
        // Arrange
        mockExistsSync.mockReturnValue(false);
        mockExecSync.mockReturnValue("success");

        const rollback = new RollbackAutomation(
          "staging",
          "Manual rollback",
          "v0.9.0",
        );

        // Act
        const result = await rollback.execute();

        // Assert
        expect(result.success).toBe(true);
        expect(result.toVersion).toBe("v0.9.0");
      });
    });

    describe("rollback validation", () => {
      it("should perform post-rollback validation", async () => {
        // Arrange
        const mockDeploymentHistory = [
          { success: true, version: "v1.0.0", healthCheckPassed: true },
          { success: true, version: "v1.1.0", healthCheckPassed: true },
        ];
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(mockDeploymentHistory));
        mockExecSync.mockReturnValue("success");

        const rollback = new RollbackAutomation("staging", "Test rollback");

        // Act
        const result = await rollback.execute();

        // Assert
        expect(result.validationPassed).toBe(true);
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining("yarn run build"),
          expect.any(Object),
        );
        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining("yarn run test:unit"),
          expect.any(Object),
        );
      });

      it("should handle validation failures", async () => {
        // Arrange
        const mockDeploymentHistory = [
          { success: true, version: "v1.0.0", healthCheckPassed: true },
          { success: true, version: "v1.1.0", healthCheckPassed: true },
        ];
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(mockDeploymentHistory));
        mockExecSync.mockImplementation((command: string) => {
          if (command.includes("yarn run test:unit")) {
            throw new Error("Tests failed after rollback");
          }
          return "success";
        });

        const rollback = new RollbackAutomation("staging", "Test rollback");

        // Act
        const result = await rollback.execute();

        // Assert
        expect(result.success).toBe(false);
        expect(result.validationPassed).toBe(false);
        expect(result.errors).toContainEqual(
          expect.stringContaining("Rollback validation failed"),
        );
      });
    });

    describe("emergency rollback", () => {
      it("should execute emergency rollback", async () => {
        // Arrange
        const mockDeploymentHistory = [
          { success: true, version: "v1.0.0", allHealthChecksPassed: true },
          { success: true, version: "v1.1.0", allHealthChecksPassed: true },
        ];
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(mockDeploymentHistory));
        mockExecSync.mockReturnValue("success");

        // Act
        const result = await RollbackAutomation.emergency(
          "production",
          "Critical security vulnerability",
        );

        // Assert
        expect(result.success).toBe(true);
        expect(result.environment).toBe("production");
        expect(result.reason).toBe(
          "EMERGENCY: Critical security vulnerability",
        );
      });
    });

    describe("retry logic", () => {
      it("should retry rollback on failure", async () => {
        // Arrange
        const mockDeploymentHistory = [
          { success: true, version: "v1.0.0", healthCheckPassed: true },
          { success: true, version: "v1.1.0", healthCheckPassed: true },
        ];
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue(JSON.stringify(mockDeploymentHistory));
        let attemptCount = 0;
        mockExecSync.mockImplementation((command: string) => {
          if (command.includes("yarn run build")) {
            attemptCount++;
            if (attemptCount === 1) {
              throw new Error("Build failed");
            }
          }
          return "success";
        });

        const rollback = new RollbackAutomation("staging", "Test retry");

        // Act
        const result = await rollback.execute();

        // Assert
        expect(result.success).toBe(true);
        expect(attemptCount).toBe(2); // Should have retried once
      });

      it("should fail after max attempts", async () => {
        // Arrange
        mockExistsSync.mockReturnValue(false);
        mockExecSync.mockImplementation(() => {
          throw new Error("Persistent failure");
        });

        const rollback = new RollbackAutomation("staging", "Test max attempts");

        // Act
        const result = await rollback.execute();

        // Assert
        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(3); // Max attempts is 3
      });
    });
  });

  describe("Integration Tests", () => {
    it("should maintain deployment state consistency", async () => {
      // Arrange
      mockExecSync.mockReturnValue("success");
      mockExistsSync.mockReturnValue(false);

      const staging = new StagingDeployment();
      const production = new ProductionDeployment();

      // Mock approval for production
      process.env.DEPLOYMENT_APPROVAL_TOKEN = "approved";

      // Act - Deploy to staging first
      const stagingResult = await staging.deploy();

      // Act - Then deploy to production
      const productionResult = await production.deploy();

      // Assert
      expect(stagingResult.success).toBe(true);
      expect(productionResult.success).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining("staging-deployment-state.json"),
        expect.any(String),
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining("production-deployment-state.json"),
        expect.any(String),
      );
    });

    it("should handle cross-environment rollback scenarios", async () => {
      // Arrange
      const stagingHistory = [
        { success: true, version: "v0.9.0", healthCheckPassed: true },
        { success: true, version: "v1.0.0", healthCheckPassed: true },
      ];
      const productionHistory = [
        { success: true, version: "v1.0.0", allHealthChecksPassed: true },
        { success: false, version: "v1.1.0", allHealthChecksPassed: false },
      ];

      mockExistsSync.mockImplementation((path: any) => {
        return path.includes("deployment-state.json");
      });

      mockReadFileSync.mockImplementation((path: any) => {
        if (path.includes("staging")) {
          return JSON.stringify(stagingHistory);
        } else if (path.includes("production")) {
          return JSON.stringify(productionHistory);
        }
        return "[]";
      });

      mockExecSync.mockReturnValue("success");

      const stagingRollback = new RollbackAutomation(
        "staging",
        "Cross-env test",
      );
      const productionRollback = new RollbackAutomation(
        "production",
        "Cross-env test",
      );

      // Act
      const stagingResult = await stagingRollback.execute();
      const productionResult = await productionRollback.execute();

      // Assert
      expect(stagingResult.success).toBe(true);
      expect(productionResult.success).toBe(true);
      expect(productionResult.toVersion).toBe("v1.0.0");
    });
  });
});
