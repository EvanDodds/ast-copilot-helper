/**
 * @file Telemetry Integration Test
 * @description Basic integration test for the complete telemetry system
 */

import { describe, it, expect } from "vitest";
import {
  // Core telemetry
  PrivacyRespectingTelemetryManager,
  DEFAULT_TELEMETRY_CONFIG,

  // Consent management
  PrivacyRespectingConsentManager,
  FileConsentStorage,

  // Storage system
  StorageManager,

  // Transmission system
  HttpTelemetryTransmitter,

  // Data anonymization
  PrivacyRespectingDataAnonymizer,
} from "./index";

describe("Telemetry System Integration", () => {
  describe("Module Exports", () => {
    it("should export core telemetry manager", () => {
      expect(PrivacyRespectingTelemetryManager).toBeDefined();
      expect(typeof PrivacyRespectingTelemetryManager).toBe("function");
    });

    it("should export default configuration", () => {
      expect(DEFAULT_TELEMETRY_CONFIG).toBeDefined();
      expect(typeof DEFAULT_TELEMETRY_CONFIG).toBe("object");
      expect(DEFAULT_TELEMETRY_CONFIG.enabled).toBeDefined();
      expect(DEFAULT_TELEMETRY_CONFIG.endpoint).toBeDefined();
    });

    it("should export consent management classes", () => {
      expect(PrivacyRespectingConsentManager).toBeDefined();
      expect(FileConsentStorage).toBeDefined();
      expect(typeof PrivacyRespectingConsentManager).toBe("function");
      expect(typeof FileConsentStorage).toBe("function");
    });

    it("should export collection system classes", async () => {
      const collectionModule = await import("./collection");
      expect(collectionModule.TelemetryDataCollector).toBeDefined();
      expect(typeof collectionModule.TelemetryDataCollector).toBe("function");
    });

    it("should export storage system classes", () => {
      expect(StorageManager).toBeDefined();
      expect(typeof StorageManager).toBe("function");
    });

    it("should export transmission system classes", () => {
      expect(HttpTelemetryTransmitter).toBeDefined();
      expect(typeof HttpTelemetryTransmitter).toBe("function");
    });

    it("should export data anonymization classes", () => {
      expect(PrivacyRespectingDataAnonymizer).toBeDefined();
      expect(typeof PrivacyRespectingDataAnonymizer).toBe("function");
    });
  });

  describe("Component Instantiation", () => {
    it("should create telemetry manager instance", () => {
      const manager = new PrivacyRespectingTelemetryManager(
        DEFAULT_TELEMETRY_CONFIG,
      );
      expect(manager).toBeInstanceOf(PrivacyRespectingTelemetryManager);
    });

    it("should create file consent storage instance", () => {
      const storage = new FileConsentStorage("/tmp/test-consent.json");
      expect(storage).toBeInstanceOf(FileConsentStorage);
    });

    it("should create data anonymizer instance", () => {
      const anonymizer = new PrivacyRespectingDataAnonymizer({
        enableFieldHashing: true,
        enableValueObfuscation: false,
        preservedFields: ["timestamp", "version"],
      });
      expect(anonymizer).toBeInstanceOf(PrivacyRespectingDataAnonymizer);
    });
  });

  describe("Factory Functions", () => {
    it("should have transmission factory functions available via import", async () => {
      // Import factory functions dynamically to test they exist
      const transmissionModule = await import("./transmission");

      expect(transmissionModule.createDevelopmentTransmitter).toBeDefined();
      expect(transmissionModule.createProductionTransmitter).toBeDefined();
      expect(transmissionModule.createCustomTransmitter).toBeDefined();

      expect(typeof transmissionModule.createDevelopmentTransmitter).toBe(
        "function",
      );
      expect(typeof transmissionModule.createProductionTransmitter).toBe(
        "function",
      );
      expect(typeof transmissionModule.createCustomTransmitter).toBe(
        "function",
      );
    });

    it("should have storage factory functions available via import", async () => {
      const storageModule = await import("./storage");

      expect(storageModule.createDevelopmentStorage).toBeDefined();
      expect(storageModule.createProductionStorage).toBeDefined();
      expect(storageModule.createCustomStorage).toBeDefined();

      expect(typeof storageModule.createDevelopmentStorage).toBe("function");
      expect(typeof storageModule.createProductionStorage).toBe("function");
      expect(typeof storageModule.createCustomStorage).toBe("function");
    });

    it("should have collection factory functions available via import", async () => {
      const collectionModule = await import("./collection");

      expect(collectionModule.createDevelopmentCollector).toBeDefined();
      expect(collectionModule.createProductionCollector).toBeDefined();
      expect(collectionModule.createCustomCollector).toBeDefined();

      expect(typeof collectionModule.createDevelopmentCollector).toBe(
        "function",
      );
      expect(typeof collectionModule.createProductionCollector).toBe(
        "function",
      );
      expect(typeof collectionModule.createCustomCollector).toBe("function");
    });
  });

  describe("Configuration Validation", () => {
    it("should have valid default configuration structure", () => {
      expect(DEFAULT_TELEMETRY_CONFIG.enabled).toBeDefined();
      expect(DEFAULT_TELEMETRY_CONFIG.endpoint).toBeDefined();
      expect(typeof DEFAULT_TELEMETRY_CONFIG.enabled).toBe("boolean");
      expect(typeof DEFAULT_TELEMETRY_CONFIG.endpoint).toBe("string");
    });

    it("should support configuration merging", async () => {
      const { validateTelemetryConfig } = await import("./index");

      expect(validateTelemetryConfig).toBeDefined();
      expect(typeof validateTelemetryConfig).toBe("function");

      // Should not throw for valid config
      expect(() => {
        validateTelemetryConfig({
          ...DEFAULT_TELEMETRY_CONFIG,
          enabled: false,
        });
      }).not.toThrow();
    });
  });

  describe("Type System Integrity", () => {
    it("should provide proper TypeScript types", () => {
      // This test passes if TypeScript compilation succeeds
      const manager = new PrivacyRespectingTelemetryManager(
        DEFAULT_TELEMETRY_CONFIG,
      );
      const anonymizer = new PrivacyRespectingDataAnonymizer();

      // Basic type checking - if these compile, types are working
      expect(manager).toBeDefined();
      expect(anonymizer).toBeDefined();
    });

    it("should maintain type safety across modules", async () => {
      // Import modules to ensure they compile and export correctly
      const transmissionModule = await import("./transmission");
      const storageModule = await import("./storage");
      const collectionModule = await import("./collection");

      expect(transmissionModule).toBeDefined();
      expect(storageModule).toBeDefined();
      expect(collectionModule).toBeDefined();
    });
  });
});
