/**
 * @file File System Consent Storage
 * @description File-based storage implementation for consent records
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ConsentStorage, ConsentRecord } from './types.js';

/**
 * File-based consent storage implementation
 */
export class FileConsentStorage implements ConsentStorage {
  private readonly storageDir: string;
  private readonly consentFile: string;
  private readonly historyFile: string;

  constructor(appName: string = 'ast-copilot-helper') {
    this.storageDir = join(homedir(), `.${appName}`, 'telemetry');
    this.consentFile = join(this.storageDir, 'consent.json');
    this.historyFile = join(this.storageDir, 'consent-history.json');
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true, mode: 0o700 });
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw new Error(`Failed to create consent storage directory: ${error.message}`);
      }
    }
  }

  /**
   * Save consent record
   */
  async saveConsent(record: ConsentRecord): Promise<void> {
    await this.ensureStorageDir();
    
    try {
      // Save current consent
      const consentData = {
        ...record,
        timestamp: record.timestamp.toISOString()
      };
      await fs.writeFile(this.consentFile, JSON.stringify(consentData, null, 2), { mode: 0o600 });

      // Add to history
      const history = await this.getConsentHistory();
      history.push(record);
      
      // Keep only last 50 records
      const trimmedHistory = history.slice(-50);
      const historyData = trimmedHistory.map(r => ({
        ...r,
        timestamp: r.timestamp.toISOString()
      }));
      await fs.writeFile(this.historyFile, JSON.stringify(historyData, null, 2), { mode: 0o600 });
    } catch (error: any) {
      throw new Error(`Failed to save consent record: ${error.message}`);
    }
  }

  /**
   * Load current consent record
   */
  async loadConsent(): Promise<ConsentRecord | null> {
    try {
      const data = await fs.readFile(this.consentFile, 'utf8');
      const parsed = JSON.parse(data);
      return {
        ...parsed,
        timestamp: new Date(parsed.timestamp)
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null; // No consent record exists
      }
      throw new Error(`Failed to load consent record: ${error.message}`);
    }
  }

  /**
   * Get consent history
   */
  async getConsentHistory(): Promise<ConsentRecord[]> {
    try {
      const data = await fs.readFile(this.historyFile, 'utf8');
      const parsed = JSON.parse(data);
      return parsed.map((record: any) => ({
        ...record,
        timestamp: new Date(record.timestamp)
      }));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []; // No history exists yet
      }
      throw new Error(`Failed to load consent history: ${error.message}`);
    }
  }

  /**
   * Clear all consent data
   */
  async clearConsent(): Promise<void> {
    try {
      // Remove consent files
      try {
        await fs.unlink(this.consentFile);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      try {
        await fs.unlink(this.historyFile);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Try to remove storage directory if empty
      try {
        await fs.rmdir(this.storageDir);
      } catch {
        // Directory not empty or doesn't exist, ignore
      }
    } catch (error: any) {
      throw new Error(`Failed to clear consent data: ${error.message}`);
    }
  }

  /**
   * Check if storage is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.ensureStorageDir();
      
      // Test write access
      const testFile = join(this.storageDir, '.test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage directory path
   */
  getStoragePath(): string {
    return this.storageDir;
  }
}