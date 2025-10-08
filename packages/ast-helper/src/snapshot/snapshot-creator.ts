/**
 * Snapshot Creator
 * Part of Issue #161 - Repository Snapshot Distribution System
 *
 * Handles creation of compressed snapshot files from .astdb directories.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createReadStream, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createLogger } from "../logging/index.js";
import type {
  SnapshotCreateOptions,
  SnapshotCreateResult,
  SnapshotMetadata,
  SnapshotProgress,
} from "./types.js";
import { SnapshotPhase } from "./types.js";

const logger = createLogger({ operation: "snapshot-creator" });

/**
 * Creates compressed snapshots from .astdb directories
 *
 * @remarks
 * The SnapshotCreator handles the creation of portable, compressed snapshot files
 * from existing .astdb directories. Snapshots include metadata, checksums, and
 * configurable compression levels for optimal distribution.
 *
 * @example
 * ```typescript
 * const creator = new SnapshotCreator();
 *
 * const result = await creator.create({
 *   astdbPath: './.astdb',
 *   outputPath: './snapshot.tar.gz',
 *   version: '1.0.0',
 *   description: 'Production snapshot',
 *   tags: ['production', 'release'],
 *   compressionLevel: 6,
 *   filters: {
 *     includeModels: false,
 *     includeCache: false,
 *     includeLogs: false
 *   },
 *   onProgress: (progress) => {
 *     console.log(`${progress.phase}: ${progress.percentage}%`);
 *   }
 * });
 *
 * if (result.success) {
 *   console.log(`Created: ${result.snapshotPath}`);
 *   console.log(`Size: ${result.metadata.size.compressed} bytes`);
 *   console.log(`Compression: ${(result.metadata.size.ratio * 100).toFixed(1)}%`);
 * }
 * ```
 */
export class SnapshotCreator {
  /**
   * Create a snapshot from an .astdb directory
   *
   * @param options - Snapshot creation configuration
   * @returns Promise resolving to creation result with metadata and status
   *
   * @remarks
   * This method:
   * - Validates source directory exists and is readable
   * - Scans and filters files based on provided options
   * - Creates compressed tar.gz archive with metadata
   * - Generates SHA256 checksum for integrity verification
   * - Reports progress through optional callback
   *
   * The method returns a result object with `success: false` and detailed error
   * information if any step fails, rather than throwing exceptions. This enables
   * graceful error handling in production environments.
   *
   * @example
   * ```typescript
   * // Minimal required options
   * const result = await creator.create({
   *   astdbPath: './.astdb',
   *   outputPath: './snapshot.tar.gz'
   * });
   *
   * // Full options with progress tracking
   * const result = await creator.create({
   *   astdbPath: './.astdb',
   *   outputPath: './snapshots/snapshot-1.0.0.tar.gz',
   *   version: '1.0.0',
   *   description: 'Production snapshot for v1.0 release',
   *   tags: ['production', 'stable', 'v1.0'],
   *   compressionLevel: 9, // Maximum compression
   *   filters: {
   *     includeModels: false,  // Exclude large model files
   *     includeCache: false,   // Exclude temporary cache
   *     includeLogs: false     // Exclude log files
   *   },
   *   onProgress: (progress) => {
   *     console.log(`[${progress.phase}] ${progress.step}`);
   *     console.log(`Progress: ${progress.percentage}% (${progress.filesProcessed}/${progress.totalFiles} files)`);
   *   },
   *   onFileProcessed: (filePath) => {
   *     console.log(`Processed: ${filePath}`);
   *   }
   * });
   *
   * // Check result
   * if (result.success) {
   *   console.log(`✅ Snapshot created: ${result.snapshotPath}`);
   *   console.log(`Metadata:`, result.metadata);
   * } else {
   *   console.error(`❌ Creation failed: ${result.error}`);
   * }
   * ```
   */
  async create(options: SnapshotCreateOptions): Promise<SnapshotCreateResult> {
    const startTime = Date.now();

    try {
      // Validate inputs
      await this.validateOptions(options);

      // Initialize progress
      this.reportProgress(options, {
        phase: SnapshotPhase.INITIALIZING,
        step: "Initializing snapshot creation",
        percentage: 0,
        filesProcessed: 0,
        totalFiles: 0,
        bytesProcessed: 0,
        totalBytes: 0,
      });

      // Scan directory to determine what to include
      this.reportProgress(options, {
        phase: SnapshotPhase.SCANNING,
        step: "Scanning .astdb directory",
        percentage: 10,
        filesProcessed: 0,
        totalFiles: 0,
        bytesProcessed: 0,
        totalBytes: 0,
      });

      const filesToInclude = await this.scanDirectory(options);
      logger.info(
        `Found ${filesToInclude.length} files to include in snapshot`,
      );

      // Calculate total size
      const totalBytes = await this.calculateTotalSize(filesToInclude);
      logger.info(
        `Total uncompressed size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`,
      );

      // Create snapshot metadata
      const metadata = await this.createMetadata(
        options,
        filesToInclude,
        totalBytes,
      );

      // Create compressed archive
      this.reportProgress(options, {
        phase: SnapshotPhase.COMPRESSING,
        step: "Creating compressed archive",
        percentage: 30,
        filesProcessed: 0,
        totalFiles: filesToInclude.length,
        bytesProcessed: 0,
        totalBytes,
      });

      await this.createArchive(options, filesToInclude, metadata);

      // Validate created snapshot
      this.reportProgress(options, {
        phase: SnapshotPhase.VALIDATING,
        step: "Validating snapshot",
        percentage: 90,
        filesProcessed: filesToInclude.length,
        totalFiles: filesToInclude.length,
        bytesProcessed: totalBytes,
        totalBytes,
      });

      await this.validateSnapshot(options.outputPath, metadata);

      // Complete
      const durationMs = Date.now() - startTime;
      this.reportProgress(options, {
        phase: SnapshotPhase.COMPLETE,
        step: "Snapshot creation complete",
        percentage: 100,
        filesProcessed: filesToInclude.length,
        totalFiles: filesToInclude.length,
        bytesProcessed: totalBytes,
        totalBytes,
      });

      logger.info(
        `Snapshot created successfully in ${durationMs}ms: ${options.outputPath}`,
      );

      return {
        success: true,
        snapshotPath: options.outputPath,
        metadata,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Snapshot creation failed: ${errorMessage}`);

      return {
        success: false,
        snapshotPath: options.outputPath,
        metadata: {} as SnapshotMetadata,
        durationMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate snapshot creation options
   */
  private async validateOptions(options: SnapshotCreateOptions): Promise<void> {
    // Check source directory exists
    if (!existsSync(options.astdbPath)) {
      throw new Error(`Source directory does not exist: ${options.astdbPath}`);
    }

    // Check if it's a valid .astdb directory
    const versionFile = path.join(options.astdbPath, "version.json");
    if (!existsSync(versionFile)) {
      throw new Error(
        `.astdb directory is invalid (missing version.json): ${options.astdbPath}`,
      );
    }

    // Check output directory exists
    const outputDir = path.dirname(options.outputPath);
    if (!existsSync(outputDir)) {
      await fs.mkdir(outputDir, { recursive: true });
    }

    // Check if output file already exists
    if (existsSync(options.outputPath)) {
      throw new Error(`Output file already exists: ${options.outputPath}`);
    }
  }

  /**
   * Scan directory and determine files to include
   */
  private async scanDirectory(
    options: SnapshotCreateOptions,
  ): Promise<string[]> {
    const files: string[] = [];
    const {
      astdbPath,
      includeModels = true,
      includeCache = false,
      includeLogs = false,
    } = options;

    const scanDir = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(astdbPath, fullPath);

        // Skip based on options
        if (!includeCache && relativePath.startsWith("cache")) {
          continue;
        }
        if (!includeLogs && relativePath.startsWith("logs")) {
          continue;
        }
        if (!includeModels && relativePath.startsWith("models")) {
          continue;
        }

        // Skip temporary files
        if (entry.name.includes(".tmp")) {
          continue;
        }

        // Skip WAL and SHM files (SQLite temporary files)
        if (entry.name.endsWith(".db-wal") || entry.name.endsWith(".db-shm")) {
          continue;
        }

        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    };

    await scanDir(astdbPath);
    return files;
  }

  /**
   * Calculate total size of files
   */
  private async calculateTotalSize(files: string[]): Promise<number> {
    let totalSize = 0;
    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        totalSize += stats.size;
      } catch (_error) {
        logger.warn(`Failed to stat file: ${file}`);
      }
    }
    return totalSize;
  }

  /**
   * Create snapshot metadata
   */
  private async createMetadata(
    options: SnapshotCreateOptions,
    files: string[],
    uncompressedSize: number,
  ): Promise<SnapshotMetadata> {
    // Read version info
    const versionFile = path.join(options.astdbPath, "version.json");
    const versionData = JSON.parse(await fs.readFile(versionFile, "utf-8"));

    // Detect repository info
    const repoInfo = options.repository || (await this.detectRepositoryInfo());

    // Count file types
    const databases = files
      .filter((f) => f.endsWith(".db"))
      .map((f) => path.basename(f));
    const annotationCount = files.filter((f) => f.includes("/annots/")).length;
    const astCount = files.filter((f) => f.includes("/asts/")).length;
    const grammars = files
      .filter((f) => f.includes("/grammars/") && f.endsWith(".wasm"))
      .map((f) => path.basename(f));
    const models = files
      .filter(
        (f) =>
          f.includes("/models/") &&
          (f.endsWith(".onnx") || f.endsWith(".json")),
      )
      .map((f) => path.basename(f));

    // Generate snapshot ID
    const id = `snapshot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const metadata: SnapshotMetadata = {
      id,
      version: options.version || "1.0.0",
      createdAt: new Date().toISOString(),
      repository: {
        url: repoInfo.url,
        commitSha: repoInfo.commitSha,
        branch: repoInfo.branch,
        fileCount: files.length,
      },
      size: {
        uncompressed: uncompressedSize,
        compressed: 0, // Will be filled after compression
        ratio: 0,
      },
      toolVersion: versionData.version || "unknown",
      schemaVersion: versionData.schemaVersion || "unknown",
      contents: {
        databases,
        annotationCount,
        astCount,
        grammars,
        models,
      },
      description: options.description,
      tags: options.tags,
      creator: options.creator,
      checksum: "", // Will be calculated after archive creation
    };

    return metadata;
  }

  /**
   * Detect repository information from git
   */
  private async detectRepositoryInfo(): Promise<{
    url?: string;
    commitSha?: string;
    branch?: string;
  }> {
    try {
      const { execSync } = await import("node:child_process");

      const url = execSync("git config --get remote.origin.url", {
        encoding: "utf-8",
      }).trim();
      const commitSha = execSync("git rev-parse HEAD", {
        encoding: "utf-8",
      }).trim();
      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf-8",
      }).trim();

      return { url, commitSha, branch };
    } catch (_error) {
      logger.warn("Failed to detect git repository information");
      return {};
    }
  }

  /**
   * Create compressed archive using simple directory copy + gzip
   */
  private async createArchive(
    options: SnapshotCreateOptions,
    files: string[],
    metadata: SnapshotMetadata,
  ): Promise<void> {
    const { astdbPath, outputPath, compressionLevel = 6 } = options;

    // Create a manifest file listing all files
    const fileStats = await Promise.all(
      files.map(async (f) => ({
        path: path.relative(astdbPath, f),
        size: (await fs.stat(f)).size,
      })),
    );

    const manifest = {
      version: "1.0",
      metadata,
      files: fileStats,
    };

    // Create temporary directory for archive staging
    const tempDir = path.join(
      path.dirname(outputPath),
      `.snapshot-temp-${Date.now()}`,
    );
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Write manifest
      const manifestPath = path.join(tempDir, "manifest.json");
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      // Copy all files to temp directory maintaining structure
      for (const file of files) {
        const relativePath = path.relative(astdbPath, file);
        const targetPath = path.join(tempDir, relativePath);
        const targetDir = path.dirname(targetPath);

        await fs.mkdir(targetDir, { recursive: true });
        await fs.copyFile(file, targetPath);
      }

      // Create tar-like structure by writing a simple archive format
      // For simplicity, we'll use a directory-based approach and zip it
      await this.compressDirectory(tempDir, outputPath, compressionLevel);

      // Update metadata with compressed size and checksum
      const compressedStats = await fs.stat(outputPath);
      metadata.size.compressed = compressedStats.size;
      metadata.size.ratio =
        metadata.size.compressed / metadata.size.uncompressed;
      metadata.checksum = await this.calculateChecksum(outputPath);

      // Write metadata file alongside snapshot
      const metadataPath = outputPath.replace(
        /\.(tar\.gz|tgz)$/,
        ".metadata.json",
      );
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      logger.info(
        `Archive created: ${(compressedStats.size / 1024 / 1024).toFixed(2)} MB (compression ratio: ${(metadata.size.ratio * 100).toFixed(1)}%)`,
      );
    } finally {
      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * Compress directory using tar and gzip
   * Note: This is a simplified implementation. Production would use tar library.
   */
  private async compressDirectory(
    sourceDir: string,
    outputPath: string,
    level: number,
  ): Promise<void> {
    const { execSync } = await import("node:child_process");

    try {
      // Use system tar command for now (cross-platform solution would use tar-fs)
      execSync(`tar -czf "${outputPath}" -C "${sourceDir}" .`, {
        stdio: "pipe",
        env: { ...process.env, GZIP: `-${level}` },
      });
    } catch (error) {
      throw new Error(
        `Failed to create compressed archive: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Calculate SHA256 checksum of file
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(filePath);

      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }

  /**
   * Validate created snapshot
   */
  private async validateSnapshot(
    snapshotPath: string,
    metadata: SnapshotMetadata,
  ): Promise<void> {
    // Check file exists
    if (!existsSync(snapshotPath)) {
      throw new Error(`Snapshot file was not created: ${snapshotPath}`);
    }

    // Check file size
    const stats = await fs.stat(snapshotPath);
    if (stats.size === 0) {
      throw new Error("Snapshot file is empty");
    }

    // Verify checksum matches
    const actualChecksum = await this.calculateChecksum(snapshotPath);
    if (actualChecksum !== metadata.checksum) {
      throw new Error(
        `Checksum mismatch: expected ${metadata.checksum}, got ${actualChecksum}`,
      );
    }

    // Check metadata file exists
    const metadataPath = snapshotPath.replace(
      /\.(tar\.gz|tgz)$/,
      ".metadata.json",
    );
    if (!existsSync(metadataPath)) {
      throw new Error("Snapshot metadata file was not created");
    }

    logger.info("Snapshot validation passed");
  }

  /**
   * Report progress
   */
  private reportProgress(
    options: SnapshotCreateOptions,
    progress: SnapshotProgress,
  ): void {
    if (options.onProgress) {
      options.onProgress(progress);
    }
  }
}
