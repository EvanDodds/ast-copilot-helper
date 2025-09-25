/**
 * File Handle Pool Implementation
 * Provides pooling for file system handles with path management and concurrent access control
 */

import type { BasePoolConfig } from "./base-pool.js";
import { BaseResourcePool } from "./base-pool.js";
import type { FileHandle, FileHandleFactory } from "../types.js";
import * as fs from "fs/promises";
import * as path from "path";

export interface FileHandlePoolConfig extends BasePoolConfig {
  basePath: string;
  defaultMode: string;
  maxConcurrentFiles: number;
  allowedExtensions?: string[];
  maxFileSize?: number;
  createDirectories?: boolean;
}

export class FileHandlePool extends BaseResourcePool<FileHandle> {
  private poolConfig: FileHandlePoolConfig;

  constructor(config: FileHandlePoolConfig) {
    const factory: FileHandleFactory = new FileHandleFactoryImpl(config);
    super(config, factory);
    this.poolConfig = config;
  }

  async acquireFileHandle(filePath: string, mode = "r"): Promise<FileHandle> {
    // Create a specific file handle outside of the generic pool system
    // This is a specialized method that bypasses the generic pool for specific file access
    const tempFactory = new SpecificFileHandleFactory(
      this.poolConfig,
      filePath,
      mode,
    );

    try {
      const resource = await tempFactory.create();

      // Manually track this resource in our internal system by creating an internal lease
      const leaseId = `lease_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const resourceId = resource.id;

      // Add to our internal tracking (simulating pool behavior)
      const pooledResource = {
        id: resourceId,
        resource,
        state: "active" as const,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
        useCount: 1,
        leaseId,
      };

      // Store in our private maps (we need to cast to access private members)
      (this as any).resources.set(resourceId, pooledResource);
      (this as any).inUseResources.set(leaseId, {
        lease: {
          leaseId,
          resource,
          acquiredAt: Date.now(),
          isActive: true,
        },
        resourceId,
      });

      return resource;
    } catch (error) {
      throw new Error(
        `Failed to acquire file handle for ${filePath}: ${(error as Error).message}`,
      );
    }
  }
}

class FileHandleFactoryImpl implements FileHandleFactory {
  public readonly basePath: string;
  public readonly defaultMode: string;
  public readonly maxConcurrentFiles: number;

  constructor(protected config: FileHandlePoolConfig) {
    this.basePath = config.basePath;
    this.defaultMode = config.defaultMode || "r";
    this.maxConcurrentFiles = config.maxConcurrentFiles;
  }

  async create(): Promise<FileHandle> {
    // For pool initialization, create a placeholder that doesn't require file system access
    return {
      id: `placeholder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      path: "",
      mode: "r",
      handle: null,
      isLocked: false,
      operations: 0,
      size: 0,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };
  }

  async destroy(resource: FileHandle): Promise<void> {
    try {
      if (resource.handle) {
        await resource.handle.close();
      }
    } catch (error) {
      console.warn(`Error destroying file handle ${resource.id}:`, error);
    }
  }

  async validate(resource: FileHandle): Promise<boolean> {
    try {
      if (!resource.handle) {
        return false;
      }

      // Check if file handle is still valid by checking stats
      const stats = await resource.handle.stat();
      return stats !== null;
    } catch (error) {
      return false;
    }
  }

  async reset(resource: FileHandle): Promise<void> {
    try {
      if (resource.handle && resource.mode !== "r") {
        // For writable files, sync any pending data
        await resource.handle.sync();
      }
      resource.isLocked = false;
    } catch (error) {
      console.warn(`Error resetting file handle ${resource.id}:`, error);
    }
  }

  protected async createFileHandle(
    filePath: string,
    mode: string,
  ): Promise<FileHandle> {
    // Validate file path and extension if configured
    if (this.config.allowedExtensions) {
      const ext = path.extname(filePath).toLowerCase();
      if (!this.config.allowedExtensions.includes(ext)) {
        throw new Error(`File extension ${ext} not allowed`);
      }
    }

    // Create directory if needed
    if (this.config.createDirectories) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    }

    // Open file handle
    const handle = await fs.open(filePath, mode);

    // Get file stats
    const stats = await handle.stat();

    // Check file size limits
    if (this.config.maxFileSize && stats.size > this.config.maxFileSize) {
      await handle.close();
      throw new Error(
        `File size ${stats.size} exceeds maximum ${this.config.maxFileSize}`,
      );
    }

    return {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      handle,
      path: filePath,
      mode,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      size: stats.size,
      isLocked: false,
      operations: 0,
    };
  }
}

class SpecificFileHandleFactory extends FileHandleFactoryImpl {
  constructor(
    config: FileHandlePoolConfig,
    private filePath: string,
    private fileMode: string,
  ) {
    super(config);
  }

  override async create(): Promise<FileHandle> {
    return await this.createSpecificFileHandle(this.filePath, this.fileMode);
  }

  private async createSpecificFileHandle(
    filePath: string,
    mode: string,
  ): Promise<FileHandle> {
    // Validate file path and extension if configured
    if (this.config.allowedExtensions) {
      const ext = path.extname(filePath).toLowerCase();
      if (!this.config.allowedExtensions.includes(ext)) {
        throw new Error(`File extension ${ext} not allowed`);
      }
    }

    // Ensure file path is within base path for security
    const normalizedPath = path.resolve(filePath);
    const normalizedBasePath = path.resolve(this.basePath);
    if (!normalizedPath.startsWith(normalizedBasePath)) {
      throw new Error(
        `File path ${filePath} is outside base path ${this.basePath}`,
      );
    }

    // Create directory if needed
    if (this.config.createDirectories) {
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
    }

    // Open file handle
    const handle = await fs.open(filePath, mode);

    // Get file stats (create empty file if it doesn't exist and mode allows)
    let stats;
    try {
      stats = await handle.stat();
    } catch (error) {
      if (mode.includes("w") || mode.includes("a")) {
        // File doesn't exist but we can create it
        stats = { size: 0 };
      } else {
        await handle.close();
        throw error;
      }
    }

    // Check file size limits
    if (this.config.maxFileSize && stats.size > this.config.maxFileSize) {
      await handle.close();
      throw new Error(
        `File size ${stats.size} exceeds maximum ${this.config.maxFileSize}`,
      );
    }

    return {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      handle,
      path: filePath,
      mode,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      size: stats.size,
      isLocked: false,
      operations: 0,
    };
  }
}
