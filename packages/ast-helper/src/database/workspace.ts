/**
 * Workspace Detection Manager
 * Handles automatic workspace root detection and Git repository integration
 */

import { stat } from "node:fs/promises";
import { dirname, join, parse, relative, resolve } from "node:path";
import {
  FileSystemErrors,
  GitErrors,
  ValidationErrors,
} from "../errors/factories.js";
import { FileSystemManager } from "../filesystem/manager.js";
import { GitManager } from "../git/manager.js";
import { createLogger } from "../logging/index.js";
import type { InitOptions } from "./types.js";

/**
 * Workspace information interface
 */
export interface WorkspaceInfo {
  /** Detected workspace root directory */
  root: string;

  /** Git repository root (if detected) */
  gitRoot?: string;

  /** Whether workspace is inside a Git repository */
  isGitRepository: boolean;

  /** Type of workspace detection used */
  detectionMethod: "git" | "package-json" | "manual" | "current-dir";

  /** Relative path from workspace root to current directory */
  relativePath: string;

  /** Whether this is a nested workspace scenario */
  isNested: boolean;

  /** Available workspace indicators found */
  indicators: string[];
}

/**
 * Workspace detector options
 */
export interface WorkspaceDetectorOptions {
  /** Starting directory for detection (defaults to process.cwd()) */
  startDir?: string;

  /** Maximum number of parent directories to traverse */
  maxTraversal?: number;

  /** Custom workspace indicators to look for */
  customIndicators?: string[];

  /** Whether to require Git repository */
  requireGit?: boolean;

  /** Whether to allow workspace creation in existing directories */
  allowExisting?: boolean;
}

/**
 * Default workspace indicators
 */
const DEFAULT_WORKSPACE_INDICATORS = [
  "package.json",
  "tsconfig.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  ".git",
  ".gitignore",
  "README.md",
  "README.rst",
  "Makefile",
  "CMakeLists.txt",
];

/**
 * Workspace Detection Manager class
 * Handles workspace root detection and Git integration
 */
export class WorkspaceDetector {
  private fs: FileSystemManager;
  private git: GitManager;
  private logger = createLogger();

  constructor() {
    this.fs = new FileSystemManager();
    this.git = new GitManager();
  }

  /**
   * Detect workspace root and gather information
   */
  async detectWorkspace(
    options: WorkspaceDetectorOptions = {},
  ): Promise<WorkspaceInfo> {
    const {
      startDir = process.cwd(),
      maxTraversal = 10,
      customIndicators = [],
      requireGit = false,
      allowExisting = true,
    } = options;

    const startDirResolved = resolve(startDir);

    this.logger.debug("Starting workspace detection", {
      startDir: startDirResolved,
      maxTraversal,
      requireGit,
      allowExisting,
    });

    // Validate starting directory
    await this.validateStartingDirectory(startDirResolved);

    // Combine default and custom indicators
    const indicators = [...DEFAULT_WORKSPACE_INDICATORS, ...customIndicators];

    // Try multiple detection methods in order of preference
    let workspaceInfo: WorkspaceInfo | null = null;

    // Method 1: Git repository root
    try {
      workspaceInfo = await this.detectByGitRepository(
        startDirResolved,
        indicators,
      );
      this.logger.debug("Detected workspace by Git repository", {
        root: workspaceInfo.root,
      });
    } catch (error) {
      this.logger.debug("Git repository detection failed", {
        error: (error as Error).message,
      });
    }

    // Method 2: Package.json or other project files
    if (!workspaceInfo) {
      try {
        workspaceInfo = await this.detectByProjectFiles(
          startDirResolved,
          indicators,
          maxTraversal,
        );
        this.logger.debug("Detected workspace by project files", {
          root: workspaceInfo.root,
        });
      } catch (error) {
        this.logger.debug("Project file detection failed", {
          error: (error as Error).message,
        });
      }
    }

    // Method 3: Current directory (fallback)
    if (!workspaceInfo) {
      if (allowExisting) {
        workspaceInfo = await this.createCurrentDirectoryWorkspace(
          startDirResolved,
          indicators,
        );
        this.logger.debug("Using current directory as workspace", {
          root: workspaceInfo.root,
        });
      } else {
        throw ValidationErrors.invalidValue(
          "workspace",
          startDirResolved,
          "No workspace indicators found in directory hierarchy",
        );
      }
    }

    // Validate requirements
    if (requireGit && !workspaceInfo.isGitRepository) {
      throw GitErrors.repositoryNotFound(workspaceInfo.root);
    }

    // Enhance workspace info with additional details
    workspaceInfo = await this.enhanceWorkspaceInfo(
      workspaceInfo,
      startDirResolved,
    );

    this.logger.info("Workspace detection complete", {
      root: workspaceInfo.root,
      method: workspaceInfo.detectionMethod,
      isGit: workspaceInfo.isGitRepository,
      isNested: workspaceInfo.isNested,
    });

    return workspaceInfo;
  }

  /**
   * Get default database path for workspace
   */
  getDefaultDatabasePath(workspaceRoot: string): string {
    return join(workspaceRoot, ".astdb");
  }

  /**
   * Validate that workspace can host a database
   */
  async validateWorkspaceForDatabase(
    workspaceInfo: WorkspaceInfo,
    options: InitOptions = {},
  ): Promise<void> {
    const { force = false } = options;
    const dbPath = this.getDefaultDatabasePath(workspaceInfo.root);

    // Check if database already exists
    if ((await this.fs.exists(dbPath)) && !force) {
      throw ValidationErrors.invalidValue(
        "database",
        dbPath,
        "Database already exists at this location. Use --force to overwrite.",
      );
    }

    // Check write permissions
    try {
      await this.fs.ensureDirectory(dirname(dbPath));

      // Test write access - use a simple approach
      const testFile = join(dirname(dbPath), ".astdb-write-test");
      const testContent = "test";
      await this.fs.atomicWriteFile(testFile, testContent, {
        encoding: "utf8",
      });

      // Clean up test file by removing it manually
      try {
        const { unlink } = await import("node:fs/promises");
        await unlink(testFile);
      } catch {
        // Ignore cleanup errors
      }
    } catch (_error) {
      throw FileSystemErrors.permissionDenied(
        dirname(dbPath),
        "write to workspace directory",
      );
    }

    // Basic disk space check (simplified)
    try {
      // Try to get file stats to ensure directory is accessible
      const stats = await this.fs.getFileStats(workspaceInfo.root);

      // If we can get stats, assume we have space (simplified check)
      if (!stats) {
        throw new Error("Cannot access workspace directory");
      }
    } catch (_error) {
      throw FileSystemErrors.diskSpaceExceeded(
        workspaceInfo.root,
        10 * 1024 * 1024, // 10MB minimum
      );
    }

    this.logger.debug("Workspace validation complete", {
      workspace: workspaceInfo.root,
      dbPath,
    });
  }

  /**
   * Find workspace root by Git repository
   */
  private async detectByGitRepository(
    startDir: string,
    indicators: string[],
  ): Promise<WorkspaceInfo> {
    const gitRoot = await this.git.getRepositoryRoot(startDir);

    if (!gitRoot) {
      throw new Error("No Git repository found");
    }

    // Check for additional indicators in git root
    const foundIndicators = await this.findIndicators(gitRoot, indicators);

    return {
      root: gitRoot,
      gitRoot,
      isGitRepository: true,
      detectionMethod: "git",
      relativePath: relative(gitRoot, startDir),
      isNested: false, // Will be determined later
      indicators: foundIndicators,
    };
  }

  /**
   * Find workspace root by project files
   */
  private async detectByProjectFiles(
    startDir: string,
    indicators: string[],
    maxTraversal: number,
  ): Promise<WorkspaceInfo> {
    let currentDir = startDir;
    const rootPath = parse(currentDir).root;
    let traversalCount = 0;

    while (currentDir !== rootPath && traversalCount < maxTraversal) {
      const foundIndicators = await this.findIndicators(currentDir, indicators);

      if (foundIndicators.length > 0) {
        // Check if this is also a git repository
        const gitRoot = await this.git
          .getRepositoryRoot(currentDir)
          .catch(() => null);

        return {
          root: currentDir,
          gitRoot: gitRoot || undefined,
          isGitRepository: !!gitRoot,
          detectionMethod: "package-json",
          relativePath: relative(currentDir, startDir),
          isNested: false, // Will be determined later
          indicators: foundIndicators,
        };
      }

      currentDir = dirname(currentDir);
      traversalCount++;
    }

    throw new Error("No project indicators found");
  }

  /**
   * Create workspace info for current directory
   */
  private async createCurrentDirectoryWorkspace(
    startDir: string,
    indicators: string[],
  ): Promise<WorkspaceInfo> {
    const foundIndicators = await this.findIndicators(startDir, indicators);
    const gitRoot = await this.git
      .getRepositoryRoot(startDir)
      .catch(() => null);

    return {
      root: startDir,
      gitRoot: gitRoot || undefined,
      isGitRepository: !!gitRoot,
      detectionMethod: "current-dir",
      relativePath: "",
      isNested: false, // Will be determined later
      indicators: foundIndicators,
    };
  }

  /**
   * Find workspace indicators in a directory
   */
  private async findIndicators(
    dir: string,
    indicators: string[],
  ): Promise<string[]> {
    const found: string[] = [];

    for (const indicator of indicators) {
      const indicatorPath = join(dir, indicator);

      try {
        await stat(indicatorPath);
        found.push(indicator);
      } catch {
        // Indicator doesn't exist
      }
    }

    return found;
  }

  /**
   * Enhance workspace info with additional details
   */
  private async enhanceWorkspaceInfo(
    workspaceInfo: WorkspaceInfo,
    _startDir: string,
  ): Promise<WorkspaceInfo> {
    // Determine if this is a nested workspace
    const isNested = await this.detectNestedWorkspace(workspaceInfo);

    // Get more detailed Git information if available
    if (workspaceInfo.isGitRepository && workspaceInfo.gitRoot) {
      try {
        // For now, just log that we have git info
        this.logger.debug("Git repository detected", {
          gitRoot: workspaceInfo.gitRoot,
        });
      } catch (error) {
        this.logger.warn("Could not get Git repository info", {
          error: (error as Error).message,
        });
      }
    }

    return {
      ...workspaceInfo,
      isNested,
    };
  }

  /**
   * Detect if workspace is nested within another workspace
   */
  private async detectNestedWorkspace(
    workspaceInfo: WorkspaceInfo,
  ): Promise<boolean> {
    const parentDir = dirname(workspaceInfo.root);

    if (parentDir === workspaceInfo.root) {
      return false; // At filesystem root
    }

    try {
      // Look for workspace indicators in parent directories
      const parentInfo = await this.detectWorkspace({
        startDir: parentDir,
        maxTraversal: 5,
        allowExisting: false,
      });

      // If we found a parent workspace, this is nested
      return parentInfo.root !== workspaceInfo.root;
    } catch {
      // No parent workspace found
      return false;
    }
  }

  /**
   * Validate starting directory
   */
  private async validateStartingDirectory(dir: string): Promise<void> {
    try {
      const stats = await stat(dir);

      if (!stats.isDirectory()) {
        throw FileSystemErrors.notFound(dir, "Expected a directory path");
      }

      // Check read access by listing directory
      try {
        const { readdir } = await import("node:fs/promises");
        await readdir(dir);
      } catch {
        throw new Error("Cannot read directory");
      }
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        if (error.code === "ENOENT") {
          throw FileSystemErrors.notFound(dir, "directory access");
        } else if (error.code === "EACCES") {
          throw FileSystemErrors.permissionDenied(dir, "read directory");
        }
      }
      throw error;
    }
  }

  /**
   * Get workspace summary for logging/display
   */
  async getWorkspaceSummary(workspaceInfo: WorkspaceInfo): Promise<{
    root: string;
    type: string;
    hasGit: boolean;
    indicators: string;
    nested: boolean;
  }> {
    return {
      root: workspaceInfo.root,
      type: workspaceInfo.detectionMethod,
      hasGit: workspaceInfo.isGitRepository,
      indicators: workspaceInfo.indicators.join(", "),
      nested: workspaceInfo.isNested,
    };
  }

  /**
   * Suggest workspace root for manual override
   */
  async suggestWorkspaceRoots(
    startDir: string = process.cwd(),
  ): Promise<string[]> {
    const suggestions: string[] = [];
    let currentDir = resolve(startDir);
    const rootPath = parse(currentDir).root;
    let traversalCount = 0;
    const maxTraversal = 10;

    // Add current directory
    suggestions.push(currentDir);

    // Traverse upward looking for likely workspace roots
    while (currentDir !== rootPath && traversalCount < maxTraversal) {
      const indicators = await this.findIndicators(
        currentDir,
        DEFAULT_WORKSPACE_INDICATORS,
      );

      if (indicators.length > 0 && !suggestions.includes(currentDir)) {
        suggestions.push(currentDir);
      }

      currentDir = dirname(currentDir);
      traversalCount++;
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }
}
