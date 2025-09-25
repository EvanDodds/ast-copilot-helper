/**
 * @fileoverview Tests for LicenseDatabase
 */

import { describe, it, expect, beforeEach } from "vitest";
import { LicenseDatabase } from "../LicenseDatabase.js";

describe("LicenseDatabase", () => {
  let database: LicenseDatabase;

  beforeEach(async () => {
    database = new LicenseDatabase();
    await database.initialize();
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      const db = new LicenseDatabase();
      await expect(db.initialize()).resolves.not.toThrow();
    });

    it("should handle multiple initializations gracefully", async () => {
      await database.initialize();
      await expect(database.initialize()).resolves.not.toThrow();
    });
  });

  describe("license lookup", () => {
    it("should find MIT license by SPDX ID", () => {
      const license = database.getLicense("MIT");
      expect(license).toBeDefined();
      expect(license?.spdxId).toBe("MIT");
      expect(license?.name).toBe("MIT License");
    });

    it("should find Apache-2.0 license", () => {
      const license = database.getLicense("Apache-2.0");
      expect(license).toBeDefined();
      expect(license?.spdxId).toBe("Apache-2.0");
      expect(license?.name).toBe("Apache License 2.0");
    });

    it("should return null for unknown license", () => {
      const license = database.getLicense("UnknownLicense");
      expect(license).toBeNull();
    });

    it("should handle case-insensitive lookup", () => {
      const license = database.getLicense("mit");
      expect(license).toBeDefined();
      expect(license?.spdxId).toBe("MIT");
    });
  });

  describe("license compatibility", () => {
    it("should consider MIT compatible with Apache-2.0", () => {
      expect(database.areCompatible("MIT", "Apache-2.0")).toBe(true);
    });

    it("should consider same license compatible with itself", () => {
      expect(database.areCompatible("MIT", "MIT")).toBe(true);
    });

    it("should handle unknown license compatibility", () => {
      expect(database.areCompatible("MIT", "UnknownLicense")).toBe(false);
    });
  });

  describe("attribution requirements", () => {
    it("should require attribution for MIT", () => {
      expect(database.requiresAttribution("MIT")).toBe(true);
    });

    it("should require attribution for Apache-2.0", () => {
      expect(database.requiresAttribution("Apache-2.0")).toBe(true);
    });

    it("should err on the side of caution for unknown licenses", () => {
      expect(database.requiresAttribution("UnknownLicense")).toBe(true);
    });
  });

  describe("license expression parsing", () => {
    it("should parse simple license expression", () => {
      const result = database.parseLicenseExpression("MIT");
      expect(result.valid).toBe(true);
      expect(result.operator).toBeNull();
      expect(result.licenses).toHaveLength(1);
      expect(result.licenses[0]?.spdxId).toBe("MIT");
    });

    it("should parse OR expression", () => {
      const result = database.parseLicenseExpression("MIT OR Apache-2.0");
      expect(result.valid).toBe(true);
      expect(result.operator).toBe("OR");
      expect(result.licenses).toHaveLength(2);
    });

    it("should parse AND expression", () => {
      const result = database.parseLicenseExpression("MIT AND Apache-2.0");
      expect(result.valid).toBe(true);
      expect(result.operator).toBe("AND");
      expect(result.licenses).toHaveLength(2);
    });

    it("should handle invalid license in expression", () => {
      const result = database.parseLicenseExpression("MIT OR UnknownLicense");
      expect(result.valid).toBe(false);
      expect(result.operator).toBe("OR");
      expect(result.licenses).toHaveLength(1); // Only MIT found
    });

    it("should handle WITH expression", () => {
      const result = database.parseLicenseExpression(
        "GPL-3.0 WITH Classpath-exception-2.0",
      );
      expect(result.operator).toBe("WITH");
    });
  });

  describe("getAllLicenses", () => {
    it("should return array of all licenses", () => {
      const licenses = database.getAllLicenses();
      expect(Array.isArray(licenses)).toBe(true);
      expect(licenses.length).toBeGreaterThan(0);

      const mitLicense = licenses.find((l) => l.spdxId === "MIT");
      expect(mitLicense).toBeDefined();
    });
  });
});
