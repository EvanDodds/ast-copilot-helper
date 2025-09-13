/**
 * Tests for model file integrity verification system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { FileVerifier, QuarantineReason, verifyModelFile, calculateSHA256 } from './verification.js';
import { ModelConfig } from './types.js';

const TEST_DIR = '.test-verification';
const QUARANTINE_DIR = join(TEST_DIR, 'quarantine');

describe('FileVerifier', () => {
  let verifier: FileVerifier;
  let testFilePath: string;
  let mockModelConfig: ModelConfig;

  beforeEach(async () => {
    // Clean up test directory
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    verifier = new FileVerifier(TEST_DIR);
    testFilePath = join(TEST_DIR, 'test-model.onnx');
    
    mockModelConfig = {
      name: 'test-model',
      version: '1.0.0',
      url: 'https://example.com/model.onnx',
      checksum: 'abc123def456',
      size: 1000,
      format: 'onnx',
      dimensions: 384
    };
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('calculateSHA256', () => {
    it('should calculate correct SHA256 checksum', async () => {
      const testContent = 'Hello, World!';
      await fs.writeFile(testFilePath, testContent);
      
      const checksum = await verifier.calculateSHA256(testFilePath);
      
      // Known SHA256 for "Hello, World!"
      expect(checksum).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
    });

    it('should handle empty files', async () => {
      await fs.writeFile(testFilePath, '');
      
      const checksum = await verifier.calculateSHA256(testFilePath);
      
      // SHA256 of empty string
      expect(checksum).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });
  });

  describe('verifyONNXFormat', () => {
    it('should validate ONNX magic bytes', async () => {
      // Create mock ONNX header with correct magic bytes
      const onnxHeader = Buffer.concat([
        Buffer.from([0x08, 0x01, 0x12]), // ONNX magic
        Buffer.from([0x05, 0x08, 0x01, 0x12, 0x04, 0x74, 0x65, 0x73, 0x74]), // Mock protobuf data
        Buffer.alloc(20, 0) // Padding
      ]);
      
      await fs.writeFile(testFilePath, onnxHeader);
      
      const result = await verifier.verifyONNXFormat(testFilePath);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files without ONNX magic bytes', async () => {
      await fs.writeFile(testFilePath, 'Not an ONNX file');
      
      const result = await verifier.verifyONNXFormat(testFilePath);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File does not contain valid ONNX header magic bytes');
    });

    it('should reject too small files', async () => {
      await fs.writeFile(testFilePath, 'xx'); // Only 2 bytes
      
      const result = await verifier.verifyONNXFormat(testFilePath);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File too small to be valid ONNX model');
    });
  });

  describe('verifyModelFile', () => {
    it('should pass verification with correct checksum and size', async () => {
      const testContent = 'test content';
      await fs.writeFile(testFilePath, testContent);
      
      // Calculate actual checksum and size
      const actualChecksum = await verifier.calculateSHA256(testFilePath);
      const stats = await fs.stat(testFilePath);
      
      const config: ModelConfig = {
        ...mockModelConfig,
        checksum: actualChecksum,
        size: stats.size
      };
      
      const result = await verifier.verifyModelFile(testFilePath, config, {
        skipFormatCheck: true // Skip ONNX check for simple content
      });
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with incorrect checksum', async () => {
      await fs.writeFile(testFilePath, 'test content');
      
      const config: ModelConfig = {
        ...mockModelConfig,
        checksum: 'wrong-checksum'
      };
      
      const result = await verifier.verifyModelFile(testFilePath, config, {
        skipFormatCheck: true,
        skipSizeCheck: true
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Checksum mismatch');
    });

    it('should fail with incorrect size', async () => {
      await fs.writeFile(testFilePath, 'test content');
      
      const config: ModelConfig = {
        ...mockModelConfig,
        size: 999999
      };
      
      const result = await verifier.verifyModelFile(testFilePath, config, {
        skipFormatCheck: true,
        skipChecksum: true
      });
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('File size mismatch');
    });

    it('should quarantine files on verification failure', async () => {
      await fs.writeFile(testFilePath, 'test content');
      
      const config: ModelConfig = {
        ...mockModelConfig,
        checksum: 'wrong-checksum'
      };
      
      await verifier.verifyModelFile(testFilePath, config, {
        skipFormatCheck: true,
        skipSizeCheck: true
      });
      
      // Check if file was quarantined
      const quarantineFiles = await fs.readdir(QUARANTINE_DIR);
      expect(quarantineFiles.length).toBeGreaterThan(0);
      
      // Check quarantine metadata
      const entries = await verifier.listQuarantinedFiles();
      expect(entries).toHaveLength(1);
      expect(entries[0].reason).toBe(QuarantineReason.CHECKSUM_MISMATCH);
    });
  });

  describe('quarantine system', () => {
    it('should quarantine files with metadata', async () => {
      await fs.writeFile(testFilePath, 'test content');
      
      await verifier.quarantineFile(testFilePath, {
        reason: QuarantineReason.CORRUPTED_HEADER,
        errorDetails: 'Test quarantine'
      });
      
      const entries = await verifier.listQuarantinedFiles();
      expect(entries).toHaveLength(1);
      expect(entries[0].reason).toBe(QuarantineReason.CORRUPTED_HEADER);
      expect(entries[0].errorDetails).toBe('Test quarantine');
    });

    it('should clean up old quarantined files', async () => {
      await fs.writeFile(testFilePath, 'test content');
      
      // Quarantine file
      await verifier.quarantineFile(testFilePath, {
        reason: QuarantineReason.UNKNOWN_ERROR
      });
      
      // Manually modify timestamp to be old
      const entries = await verifier.listQuarantinedFiles();
      const oldTimestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      entries[0].timestamp = oldTimestamp;
      
      // Save modified metadata
      const metadataPath = join(QUARANTINE_DIR, 'quarantine.json');
      await fs.writeFile(metadataPath, JSON.stringify(entries, null, 2));
      
      // Clean up files older than 7 days
      const cleanedCount = await verifier.cleanupQuarantine(7);
      
      expect(cleanedCount).toBe(1);
      
      const remainingEntries = await verifier.listQuarantinedFiles();
      expect(remainingEntries).toHaveLength(0);
    });

    it('should restore quarantined files', async () => {
      await fs.writeFile(testFilePath, 'test content');
      
      await verifier.quarantineFile(testFilePath, {
        reason: QuarantineReason.SIZE_MISMATCH
      });
      
      const entries = await verifier.listQuarantinedFiles();
      const quarantinePath = entries[0].filePath;
      
      const restorePath = join(TEST_DIR, 'restored-file.txt');
      await verifier.restoreQuarantinedFile(quarantinePath, restorePath);
      
      // Check if file was restored
      const fileExists = await fs.access(restorePath).then(() => true, () => false);
      expect(fileExists).toBe(true);
      
      // Check if removed from quarantine
      const remainingEntries = await verifier.listQuarantinedFiles();
      expect(remainingEntries).toHaveLength(0);
    });
  });

  describe('convenience functions', () => {
    it('should export verifyModelFile convenience function', async () => {
      await fs.writeFile(testFilePath, 'test content');
      
      const result = await verifyModelFile(testFilePath, mockModelConfig, {
        skipChecksum: true,
        skipSizeCheck: true,
        skipFormatCheck: true
      });
      
      expect(result.valid).toBe(true);
    });

    it('should export calculateSHA256 convenience function', async () => {
      await fs.writeFile(testFilePath, 'Hello, World!');
      
      const checksum = await calculateSHA256(testFilePath);
      
      expect(checksum).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
    });
  });
});