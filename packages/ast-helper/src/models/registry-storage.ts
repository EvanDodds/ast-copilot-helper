/**
 * Model Registry Storage Implementation
 *
 * Provides persistent storage for model verification status, checksums, signatures,
 * and download metadata in SQLite database.
 *
 * Addresses Issue #158 acceptance criteria:
 * - Model integrity database
 * - Track verification status
 * - Store checksums and signatures
 * - Periodic re-verification tracking
 */

import Database from "better-sqlite3";
import { promises as fs, mkdirSync } from "fs";
import { dirname, join } from "path";
import { createModuleLogger } from "../logging/index.js";
import type { ModelConfig } from "./types.js";

const logger = createModuleLogger("ModelRegistry");

/**
 * Model registry entry in database
 */
export interface ModelRegistryEntry {
  modelName: string;
  version: string;
  downloadDate: number;
  checksum: string;
  checksumVerified: boolean;
  signatureVerified: boolean;
  lastVerification: number | null;
  fileSize: number;
  filePath: string;
  format: string;
  url: string;
}

/**
 * Verification history entry
 */
export interface VerificationHistoryEntry {
  id?: number;
  modelName: string;
  timestamp: number;
  result: "success" | "failure";
  checksumMatch: boolean;
  signatureMatch: boolean | null;
  errorMessage: string | null;
}

/**
 * SQLite table schemas for model registry
 */
const MODEL_REGISTRY_TABLES = {
  registry: `
    CREATE TABLE IF NOT EXISTS model_registry (
      model_name TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      download_date INTEGER NOT NULL,
      checksum TEXT NOT NULL,
      checksum_verified INTEGER DEFAULT 0,
      signature_verified INTEGER DEFAULT 0,
      last_verification INTEGER,
      file_size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      format TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,

  verificationHistory: `
    CREATE TABLE IF NOT EXISTS verification_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_name TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      result TEXT NOT NULL CHECK(result IN ('success', 'failure')),
      checksum_match INTEGER NOT NULL,
      signature_match INTEGER,
      error_message TEXT,
      FOREIGN KEY (model_name) REFERENCES model_registry(model_name) ON DELETE CASCADE
    )
  `,

  metadata: `
    CREATE TABLE IF NOT EXISTS registry_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `,
};

/**
 * Indexes for performance optimization
 */
const MODEL_REGISTRY_INDEXES = {
  registry_verified:
    "CREATE INDEX IF NOT EXISTS idx_registry_verified ON model_registry(checksum_verified, signature_verified)",
  registry_last_verification:
    "CREATE INDEX IF NOT EXISTS idx_registry_last_verification ON model_registry(last_verification)",
  history_model_name:
    "CREATE INDEX IF NOT EXISTS idx_history_model_name ON verification_history(model_name)",
  history_timestamp:
    "CREATE INDEX IF NOT EXISTS idx_history_timestamp ON verification_history(timestamp)",
  history_result:
    "CREATE INDEX IF NOT EXISTS idx_history_result ON verification_history(result)",
};

/**
 * Model Registry Storage Manager
 */
export class ModelRegistryStorage {
  private db: Database.Database;
  private dbPath: string;
  private isInitialized = false;

  // Prepared statements
  private insertRegistryStmt?: Database.Statement;
  private updateRegistryStmt?: Database.Statement;
  private getRegistryStmt?: Database.Statement;
  private deleteRegistryStmt?: Database.Statement;
  private insertHistoryStmt?: Database.Statement;

  constructor(baseDir = ".astdb/models") {
    this.dbPath = join(baseDir, "registry.db");

    // Ensure directory exists before opening database
    const dir = dirname(this.dbPath);
    try {
      mkdirSync(dir, { recursive: true });
    } catch (_error) {
      // Directory might already exist, that's okay
    }

    this.db = new Database(this.dbPath);

    // Enable foreign key constraints
    this.db.pragma("foreign_keys = ON");

    // Configure SQLite for performance
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("cache_size = 5000");
    this.db.pragma("temp_store = MEMORY");
  }

  /**
   * Initialize the database and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(dirname(this.dbPath));

      // Create tables
      for (const schema of Object.values(MODEL_REGISTRY_TABLES)) {
        this.db.exec(schema);
      }

      // Create indexes
      for (const index of Object.values(MODEL_REGISTRY_INDEXES)) {
        this.db.exec(index);
      }

      // Prepare statements
      this.prepareStatements();

      // Initialize metadata
      await this.initializeMetadata();

      this.isInitialized = true;
      logger.info("Model registry storage initialized", {
        dbPath: this.dbPath,
      });
    } catch (error) {
      logger.error("Failed to initialize model registry storage", {
        error: (error as Error).message,
      });
      throw new Error(
        `Failed to initialize model registry storage: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Register a model in the database
   */
  async registerModel(
    modelName: string,
    config: ModelConfig,
    filePath: string,
    fileSize: number,
  ): Promise<void> {
    this.ensureInitialized();

    if (!this.insertRegistryStmt) {
      throw new Error("Insert statement not prepared");
    }

    try {
      this.insertRegistryStmt.run({
        modelName,
        version: config.version,
        downloadDate: Date.now(),
        checksum: config.checksum,
        checksumVerified: 0,
        signatureVerified: 0,
        lastVerification: null,
        fileSize,
        filePath,
        format: config.format,
        url: config.url,
      });

      logger.info("Model registered in database", { modelName });
    } catch (error) {
      logger.error("Failed to register model", {
        modelName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Update verification status for a model
   */
  async updateVerificationStatus(
    modelName: string,
    checksumVerified: boolean,
    signatureVerified: boolean,
  ): Promise<void> {
    this.ensureInitialized();

    if (!this.updateRegistryStmt) {
      throw new Error("Update statement not prepared");
    }

    try {
      this.updateRegistryStmt.run({
        checksumVerified: checksumVerified ? 1 : 0,
        signatureVerified: signatureVerified ? 1 : 0,
        lastVerification: Date.now(),
        modelName,
      });

      logger.info("Model verification status updated", {
        modelName,
        checksumVerified,
        signatureVerified,
      });
    } catch (error) {
      logger.error("Failed to update verification status", {
        modelName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Add verification history entry
   */
  async addVerificationHistory(entry: VerificationHistoryEntry): Promise<void> {
    this.ensureInitialized();

    if (!this.insertHistoryStmt) {
      throw new Error("Insert history statement not prepared");
    }

    try {
      this.insertHistoryStmt.run({
        modelName: entry.modelName,
        timestamp: entry.timestamp,
        result: entry.result,
        checksumMatch: entry.checksumMatch ? 1 : 0,
        signatureMatch:
          entry.signatureMatch !== null ? (entry.signatureMatch ? 1 : 0) : null,
        errorMessage: entry.errorMessage,
      });

      logger.debug("Verification history entry added", {
        modelName: entry.modelName,
      });
    } catch (error) {
      logger.error("Failed to add verification history", {
        modelName: entry.modelName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get model registry entry
   */
  async getModel(modelName: string): Promise<ModelRegistryEntry | null> {
    this.ensureInitialized();

    if (!this.getRegistryStmt) {
      throw new Error("Get statement not prepared");
    }

    try {
      const row = this.getRegistryStmt.get(modelName) as
        | Record<string, unknown>
        | undefined;
      if (!row) {
        return null;
      }

      return {
        modelName: row.model_name as string,
        version: row.version as string,
        downloadDate: row.download_date as number,
        checksum: row.checksum as string,
        checksumVerified: Boolean(row.checksum_verified),
        signatureVerified: Boolean(row.signature_verified),
        lastVerification: row.last_verification as number | null,
        fileSize: row.file_size as number,
        filePath: row.file_path as string,
        format: row.format as string,
        url: row.url as string,
      };
    } catch (error) {
      logger.error("Failed to get model from registry", {
        modelName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get all registered models
   */
  async getAllModels(): Promise<ModelRegistryEntry[]> {
    this.ensureInitialized();

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM model_registry ORDER BY download_date DESC
      `);

      const rows = stmt.all() as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        modelName: row.model_name as string,
        version: row.version as string,
        downloadDate: row.download_date as number,
        checksum: row.checksum as string,
        checksumVerified: Boolean(row.checksum_verified),
        signatureVerified: Boolean(row.signature_verified),
        lastVerification: row.last_verification as number | null,
        fileSize: row.file_size as number,
        filePath: row.file_path as string,
        format: row.format as string,
        url: row.url as string,
      }));
    } catch (error) {
      logger.error("Failed to get all models from registry", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get verification history for a model
   */
  async getVerificationHistory(
    modelName: string,
    limit = 10,
  ): Promise<VerificationHistoryEntry[]> {
    this.ensureInitialized();

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM verification_history 
        WHERE model_name = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `);

      const rows = stmt.all(modelName, limit) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: row.id as number,
        modelName: row.model_name as string,
        timestamp: row.timestamp as number,
        result: row.result as "success" | "failure",
        checksumMatch: Boolean(row.checksum_match),
        signatureMatch:
          row.signature_match !== null ? Boolean(row.signature_match) : null,
        errorMessage: row.error_message as string | null,
      }));
    } catch (error) {
      logger.error("Failed to get verification history", {
        modelName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Delete a model from registry
   */
  async deleteModel(modelName: string): Promise<void> {
    this.ensureInitialized();

    if (!this.deleteRegistryStmt) {
      throw new Error("Delete statement not prepared");
    }

    try {
      this.deleteRegistryStmt.run(modelName);
      logger.info("Model deleted from registry", { modelName });
    } catch (error) {
      logger.error("Failed to delete model from registry", {
        modelName,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get models that need re-verification (older than specified days)
   */
  async getModelsNeedingVerification(maxAgeDays = 30): Promise<string[]> {
    this.ensureInitialized();

    try {
      const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
      const stmt = this.db.prepare(`
        SELECT model_name FROM model_registry 
        WHERE last_verification IS NULL OR last_verification < ?
      `);

      const rows = stmt.all(cutoffTime) as Array<Record<string, unknown>>;
      return rows.map((row) => row.model_name as string);
    } catch (error) {
      logger.error("Failed to get models needing verification", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get registry statistics
   */
  async getStatistics(): Promise<{
    totalModels: number;
    verifiedModels: number;
    unverifiedModels: number;
    totalSize: number;
  }> {
    this.ensureInitialized();

    try {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN checksum_verified = 1 THEN 1 ELSE 0 END) as verified,
          SUM(CASE WHEN checksum_verified = 0 THEN 1 ELSE 0 END) as unverified,
          SUM(file_size) as total_size
        FROM model_registry
      `);

      const row = stmt.get() as Record<string, unknown> | undefined;
      return {
        totalModels: (row?.total as number) || 0,
        verifiedModels: (row?.verified as number) || 0,
        unverifiedModels: (row?.unverified as number) || 0,
        totalSize: (row?.total_size as number) || 0,
      };
    } catch (error) {
      logger.error("Failed to get registry statistics", {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.isInitialized = false;
      logger.info("Model registry storage closed");
    }
  }

  /**
   * Prepare SQL statements for performance
   */
  private prepareStatements(): void {
    this.insertRegistryStmt = this.db.prepare(`
      INSERT OR REPLACE INTO model_registry (
        model_name, version, download_date, checksum,
        checksum_verified, signature_verified, last_verification,
        file_size, file_path, format, url
      ) VALUES (
        @modelName, @version, @downloadDate, @checksum,
        @checksumVerified, @signatureVerified, @lastVerification,
        @fileSize, @filePath, @format, @url
      )
    `);

    this.updateRegistryStmt = this.db.prepare(`
      UPDATE model_registry 
      SET checksum_verified = @checksumVerified,
          signature_verified = @signatureVerified,
          last_verification = @lastVerification,
          updated_at = CURRENT_TIMESTAMP
      WHERE model_name = @modelName
    `);

    this.getRegistryStmt = this.db.prepare(`
      SELECT * FROM model_registry WHERE model_name = ?
    `);

    this.deleteRegistryStmt = this.db.prepare(`
      DELETE FROM model_registry WHERE model_name = ?
    `);

    this.insertHistoryStmt = this.db.prepare(`
      INSERT INTO verification_history (
        model_name, timestamp, result, checksum_match, signature_match, error_message
      ) VALUES (
        @modelName, @timestamp, @result, @checksumMatch, @signatureMatch, @errorMessage
      )
    `);
  }

  /**
   * Initialize metadata table
   */
  private async initializeMetadata(): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO registry_metadata (key, value)
      VALUES ('schema_version', '1.0.0')
    `);
    stmt.run();
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (_error) {
      // Directory might already exist
    }
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        "Model registry storage not initialized. Call initialize() first.",
      );
    }
  }
}

/**
 * Singleton instance for global access
 */
let globalRegistry: ModelRegistryStorage | null = null;

/**
 * Get or create global model registry instance
 */
export function getModelRegistry(baseDir?: string): ModelRegistryStorage {
  if (!globalRegistry) {
    globalRegistry = new ModelRegistryStorage(baseDir);
  }
  return globalRegistry;
}

/**
 * Close global model registry instance
 */
export function closeModelRegistry(): void {
  if (globalRegistry) {
    globalRegistry.close();
    globalRegistry = null;
  }
}
