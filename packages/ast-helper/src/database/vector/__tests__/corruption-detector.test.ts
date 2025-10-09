/**
 * Tests for HNSW Index Corruption Detection
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, readFile, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeFileChecksum,
  getChecksumPath,
  storeChecksum,
  loadChecksum,
  verifyIndexIntegrity,
  type IndexChecksum,
} from "../corruption-detector.js";

describe("Corruption Detector", () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await mkdtemp(join(tmpdir(), "corruption-test-"));
    testFilePath = join(tempDir, "test-index.bin");

    // Create a test file
    await writeFile(testFilePath, "test data for checksumming");
  });

  afterEach(async () => {
    // Cleanup
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("computeFileChecksum", () => {
    it("should compute SHA-256 checksum for a file", async () => {
      const checksum = await computeFileChecksum(testFilePath);

      expect(checksum).toBeTruthy();
      expect(checksum).toHaveLength(64); // SHA-256 produces 64 hex characters
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should compute same checksum for same content", async () => {
      const checksum1 = await computeFileChecksum(testFilePath);
      const checksum2 = await computeFileChecksum(testFilePath);

      expect(checksum1).toBe(checksum2);
    });

    it("should compute different checksum for different content", async () => {
      const checksum1 = await computeFileChecksum(testFilePath);

      // Modify file
      await writeFile(testFilePath, "different test data");
      const checksum2 = await computeFileChecksum(testFilePath);

      expect(checksum1).not.toBe(checksum2);
    });

    it("should throw error for non-existent file", async () => {
      const nonExistentPath = join(tempDir, "non-existent.bin");

      await expect(computeFileChecksum(nonExistentPath)).rejects.toThrow(
        /Failed to compute checksum/,
      );
    });
  });

  describe("getChecksumPath", () => {
    it("should return path with .checksum extension", () => {
      const indexPath = "/path/to/hnsw.index";
      const checksumPath = getChecksumPath(indexPath);

      expect(checksumPath).toBe("/path/to/hnsw.index.checksum");
    });

    it("should handle paths without extension", () => {
      const indexPath = "/path/to/index";
      const checksumPath = getChecksumPath(indexPath);

      expect(checksumPath).toBe("/path/to/index.checksum");
    });

    it("should handle paths with multiple extensions", () => {
      const indexPath = "/path/to/file.tar.gz";
      const checksumPath = getChecksumPath(indexPath);

      expect(checksumPath).toBe("/path/to/file.tar.gz.checksum");
    });
  });

  describe("storeChecksum", () => {
    it("should store checksum metadata", async () => {
      await storeChecksum(testFilePath, 1000, 5432);

      const checksumPath = getChecksumPath(testFilePath);
      const content = await readFile(checksumPath, "utf-8");
      const metadata: IndexChecksum = JSON.parse(content);

      expect(metadata.checksum).toBeTruthy();
      expect(metadata.checksum).toHaveLength(64);
      expect(metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
      expect(metadata.fileSize).toBeGreaterThan(0);
      expect(metadata.buildTime).toBe(5432);
      expect(metadata.vectorCount).toBe(1000);
    });

    it("should include file size in metadata", async () => {
      await storeChecksum(testFilePath, 100, 1000);

      const checksumPath = getChecksumPath(testFilePath);
      const content = await readFile(checksumPath, "utf-8");
      const metadata: IndexChecksum = JSON.parse(content);

      const fileContent = await readFile(testFilePath);
      expect(metadata.fileSize).toBe(fileContent.length);
    });

    it("should format metadata as pretty JSON", async () => {
      await storeChecksum(testFilePath, 100, 1000);

      const checksumPath = getChecksumPath(testFilePath);
      const content = await readFile(checksumPath, "utf-8");

      // Pretty JSON has newlines
      expect(content).toContain("\n");
      expect(content).toMatch(/"checksum"/);
      expect(content).toMatch(/"timestamp"/);
    });

    it("should throw error if file doesn't exist", async () => {
      const nonExistentPath = join(tempDir, "non-existent.bin");

      await expect(storeChecksum(nonExistentPath, 100, 1000)).rejects.toThrow(
        /Failed to store checksum/,
      );
    });
  });

  describe("loadChecksum", () => {
    it("should load stored checksum metadata", async () => {
      await storeChecksum(testFilePath, 1000, 5432);

      const metadata = await loadChecksum(testFilePath);

      expect(metadata).toBeTruthy();
      expect(metadata?.checksum).toBeTruthy();
      expect(metadata?.vectorCount).toBe(1000);
      expect(metadata?.buildTime).toBe(5432);
    });

    it("should return null if checksum file doesn't exist", async () => {
      const metadata = await loadChecksum(testFilePath);

      expect(metadata).toBeNull();
    });

    it("should throw error for invalid JSON", async () => {
      const checksumPath = getChecksumPath(testFilePath);
      await writeFile(checksumPath, "invalid json");

      await expect(loadChecksum(testFilePath)).rejects.toThrow(
        /Failed to load checksum/,
      );
    });
  });

  describe("verifyIndexIntegrity", () => {
    it("should verify valid index", async () => {
      // Store checksum
      await storeChecksum(testFilePath, 1000, 5000);

      // Verify
      const result = await verifyIndexIntegrity(testFilePath);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.storedChecksum).toBeTruthy();
      expect(result.computedChecksum).toBeTruthy();
      expect(result.computedChecksum).toBe(result.storedChecksum?.checksum);
    });

    it("should detect corruption from file modification", async () => {
      // Store checksum
      await storeChecksum(testFilePath, 1000, 5000);

      // Corrupt file
      await appendFile(testFilePath, "corruption");

      // Verify
      const result = await verifyIndexIntegrity(testFilePath);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("checksum mismatch");
      expect(result.storedChecksum).toBeTruthy();
      expect(result.computedChecksum).toBeTruthy();
      expect(result.computedChecksum).not.toBe(result.storedChecksum?.checksum);
    });

    it("should detect missing checksum file", async () => {
      // Don't store checksum, just verify
      const result = await verifyIndexIntegrity(testFilePath);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("No checksum file found");
    });

    it("should handle verification errors gracefully", async () => {
      const nonExistentPath = join(tempDir, "non-existent.bin");

      const result = await verifyIndexIntegrity(nonExistentPath);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("No checksum file found");
    });

    it("should include stored metadata in result", async () => {
      await storeChecksum(testFilePath, 1000, 5000);

      const result = await verifyIndexIntegrity(testFilePath);

      expect(result.storedChecksum?.vectorCount).toBe(1000);
      expect(result.storedChecksum?.buildTime).toBe(5000);
      expect(result.storedChecksum?.fileSize).toBeGreaterThan(0);
      expect(result.storedChecksum?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe("Integration tests", () => {
    it("should handle full checksum lifecycle", async () => {
      // 1. Store checksum
      await storeChecksum(testFilePath, 500, 2000);

      // 2. Load and verify
      const metadata = await loadChecksum(testFilePath);
      expect(metadata).toBeTruthy();

      // 3. Verify integrity
      const verification = await verifyIndexIntegrity(testFilePath);
      expect(verification.isValid).toBe(true);

      // 4. Corrupt file
      await writeFile(testFilePath, "corrupted data");

      // 5. Verify detects corruption
      const verification2 = await verifyIndexIntegrity(testFilePath);
      expect(verification2.isValid).toBe(false);
      expect(verification2.error).toContain("checksum mismatch");
    });

    it("should handle checksum updates", async () => {
      // Store initial checksum
      await storeChecksum(testFilePath, 100, 1000);
      const checksum1 = await loadChecksum(testFilePath);

      // Update file
      await writeFile(testFilePath, "updated content");

      // Store new checksum
      await storeChecksum(testFilePath, 200, 2000);
      const checksum2 = await loadChecksum(testFilePath);

      // Checksums should be different
      expect(checksum1?.checksum).not.toBe(checksum2?.checksum);
      expect(checksum2?.vectorCount).toBe(200);
      expect(checksum2?.buildTime).toBe(2000);

      // New checksum should verify
      const verification = await verifyIndexIntegrity(testFilePath);
      expect(verification.isValid).toBe(true);
    });

    it("should handle edge case: empty file", async () => {
      const emptyFilePath = join(tempDir, "empty.bin");
      await writeFile(emptyFilePath, "");

      await storeChecksum(emptyFilePath, 0, 0);
      const metadata = await loadChecksum(emptyFilePath);

      expect(metadata?.fileSize).toBe(0);
      expect(metadata?.vectorCount).toBe(0);

      const verification = await verifyIndexIntegrity(emptyFilePath);
      expect(verification.isValid).toBe(true);
    });

    it("should handle edge case: large file", async () => {
      const largeFilePath = join(tempDir, "large.bin");
      // Create 1MB file
      const largeData = Buffer.alloc(1024 * 1024, "x");
      await writeFile(largeFilePath, largeData);

      await storeChecksum(largeFilePath, 10000, 15000);
      const metadata = await loadChecksum(largeFilePath);

      expect(metadata?.fileSize).toBe(1024 * 1024);
      expect(metadata?.vectorCount).toBe(10000);

      const verification = await verifyIndexIntegrity(largeFilePath);
      expect(verification.isValid).toBe(true);
    });
  });
});
