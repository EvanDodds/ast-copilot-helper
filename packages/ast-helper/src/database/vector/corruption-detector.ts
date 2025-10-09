/**
 * HNSW Index Corruption Detection
 * Implements checksum-based integrity verification using SHA-256
 *
 * This module provides corruption detection for HNSW vector indices by:
 * - Computing SHA-256 checksums of index files
 * - Storing checksum metadata alongside indices
 * - Verifying integrity on index load
 * - Providing interactive rebuild prompts
 *
 * @module corruption-detector
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";

/**
 * Checksum metadata for index verification
 */
export interface IndexChecksum {
  /** SHA-256 checksum of index file */
  checksum: string;
  /** ISO 8601 timestamp when checksum was computed */
  timestamp: string;
  /** Index file size in bytes */
  fileSize: number;
  /** Index build time in milliseconds */
  buildTime: number;
  /** Number of vectors in index */
  vectorCount: number;
}

/**
 * Corruption detection result
 */
export interface CorruptionCheckResult {
  /** Whether index is valid */
  isValid: boolean;
  /** Error message if corrupted */
  error?: string;
  /** Stored checksum metadata */
  storedChecksum?: IndexChecksum;
  /** Computed checksum from current file */
  computedChecksum?: string;
}

/**
 * Compute SHA-256 checksum of a file
 *
 * @param filePath - Path to file to checksum
 * @returns Hex-encoded SHA-256 checksum
 * @throws {Error} If file cannot be read
 *
 * @example
 * ```typescript
 * const checksum = await computeFileChecksum('/path/to/index.bin');
 * console.log(checksum); // "a3f5b2c1d4e6..."
 * ```
 */
export async function computeFileChecksum(filePath: string): Promise<string> {
  try {
    const data = await readFile(filePath);
    const hash = createHash("sha256");
    hash.update(data);
    return hash.digest("hex");
  } catch (error) {
    throw new Error(
      `Failed to compute checksum for ${filePath}: ${(error as Error).message}`,
    );
  }
}

/**
 * Get checksum file path for an index file
 *
 * @param indexPath - Path to index file
 * @returns Path to checksum metadata file
 *
 * @example
 * ```typescript
 * const checksumPath = getChecksumPath('/data/hnsw.index');
 * console.log(checksumPath); // "/data/hnsw.index.checksum"
 * ```
 */
export function getChecksumPath(indexPath: string): string {
  return `${indexPath}.checksum`;
}

/**
 * Store index checksum metadata
 *
 * Computes SHA-256 checksum of the index file and stores metadata including:
 * - Checksum hash
 * - Timestamp
 * - File size
 * - Build time
 * - Vector count
 *
 * @param indexPath - Path to index file
 * @param vectorCount - Number of vectors in index
 * @param buildTime - Time taken to build index (milliseconds)
 * @throws {Error} If checksum cannot be computed or stored
 *
 * @example
 * ```typescript
 * await storeChecksum('/data/hnsw.index', 10000, 5432);
 * // Creates /data/hnsw.index.checksum with metadata
 * ```
 */
export async function storeChecksum(
  indexPath: string,
  vectorCount: number,
  buildTime: number,
): Promise<void> {
  try {
    const checksum = await computeFileChecksum(indexPath);
    const stats = await stat(indexPath);

    const metadata: IndexChecksum = {
      checksum,
      timestamp: new Date().toISOString(),
      fileSize: stats.size,
      buildTime,
      vectorCount,
    };

    const checksumPath = getChecksumPath(indexPath);
    await mkdir(dirname(checksumPath), { recursive: true });
    await writeFile(checksumPath, JSON.stringify(metadata, null, 2));
  } catch (error) {
    throw new Error(`Failed to store checksum: ${(error as Error).message}`);
  }
}

/**
 * Load stored checksum metadata
 *
 * @param indexPath - Path to index file
 * @returns Checksum metadata, or null if file doesn't exist
 * @throws {Error} If checksum file exists but cannot be parsed
 *
 * @example
 * ```typescript
 * const metadata = await loadChecksum('/data/hnsw.index');
 * if (metadata) {
 *   console.log(`Index has ${metadata.vectorCount} vectors`);
 * }
 * ```
 */
export async function loadChecksum(
  indexPath: string,
): Promise<IndexChecksum | null> {
  try {
    const checksumPath = getChecksumPath(indexPath);
    const data = await readFile(checksumPath, "utf-8");
    return JSON.parse(data) as IndexChecksum;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null; // Checksum file doesn't exist
    }
    throw new Error(`Failed to load checksum: ${(error as Error).message}`);
  }
}

/**
 * Verify index integrity against stored checksum
 *
 * Loads the stored checksum metadata, computes the current checksum,
 * and compares them to detect corruption.
 *
 * @param indexPath - Path to index file
 * @returns Corruption check result with validity status
 *
 * @example
 * ```typescript
 * const result = await verifyIndexIntegrity('/data/hnsw.index');
 * if (!result.isValid) {
 *   console.error('Corruption:', result.error);
 *   // Initiate rebuild
 * }
 * ```
 */
export async function verifyIndexIntegrity(
  indexPath: string,
): Promise<CorruptionCheckResult> {
  try {
    // Load stored checksum
    const storedChecksum = await loadChecksum(indexPath);

    if (!storedChecksum) {
      return {
        isValid: false,
        error: "No checksum file found (index may be from older version)",
      };
    }

    // Compute current checksum
    const computedChecksum = await computeFileChecksum(indexPath);

    // Verify match
    if (computedChecksum !== storedChecksum.checksum) {
      return {
        isValid: false,
        error: "Index corruption detected: checksum mismatch",
        storedChecksum,
        computedChecksum,
      };
    }

    return {
      isValid: true,
      storedChecksum,
      computedChecksum,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Verification failed: ${(error as Error).message}`,
    };
  }
}

/**
 * Prompt user for index rebuild (CLI only)
 *
 * Displays an interactive prompt asking the user whether to rebuild
 * the corrupted index. Only works in interactive terminal contexts.
 *
 * @returns Promise resolving to true if user confirms rebuild
 *
 * @example
 * ```typescript
 * if (process.stdin.isTTY) {
 *   const shouldRebuild = await promptRebuild();
 *   if (shouldRebuild) {
 *     await rebuildIndex();
 *   }
 * }
 * ```
 */
export async function promptRebuild(): Promise<boolean> {
  // Use readline for interactive prompt
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      "Index corruption detected. Rebuild index now? (y/n): ",
    );
    return answer.toLowerCase().trim() === "y";
  } finally {
    rl.close();
  }
}
