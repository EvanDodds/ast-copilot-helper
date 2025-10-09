/**
 * Git operations manager
 * Provides git integration for change detection and repository operations
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { GitErrors } from "../errors/index.js";
import { GitError } from "../errors/types.js";
import type {
  GitUtils,
  ChangedFilesOptions,
  GitStatus,
  GitCommandResult,
} from "./types.js";

/**
 * Git manager implementation using child_process for git operations
 */
export class GitManager implements GitUtils {
  private defaultCwd: string;
  private repositoryCheckCache: Map<string, boolean> = new Map();
  private repositoryRootCache: Map<string, string> = new Map();

  constructor(cwd?: string) {
    const workingDir =
      cwd ||
      (typeof process !== "undefined" && process.cwd ? process.cwd() : "/");
    this.defaultCwd = resolve(workingDir);
  }

  /**
   * Execute a git command and return the result
   * @param args - Git command arguments
   * @param cwd - Working directory
   * @returns Command execution result
   */
  private async execGitCommand(
    args: string[],
    cwd: string = this.defaultCwd,
  ): Promise<GitCommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn("git", args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (exitCode) => {
        const result: GitCommandResult = {
          exitCode: exitCode ?? 1,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          command: `git ${args.join(" ")}`,
          cwd,
        };

        if (exitCode === 0) {
          resolve(result);
        } else {
          reject(
            GitErrors.commandFailed(
              result.command,
              exitCode ?? 1,
              stderr.trim(),
              cwd,
            ),
          );
        }
      });

      child.on("error", (error) => {
        reject(
          GitErrors.commandFailed(
            `git ${args.join(" ")}`,
            1,
            error.message,
            cwd,
          ),
        );
      });
    });
  }

  /**
   * Check if the given path is within a git repository
   */
  async isGitRepository(path: string = this.defaultCwd): Promise<boolean> {
    const resolvedPath = resolve(path);

    // Check cache first to avoid redundant git calls
    const cached = this.repositoryCheckCache.get(resolvedPath);
    if (cached !== undefined) {
      return cached;
    }

    try {
      await this.execGitCommand(["rev-parse", "--git-dir"], resolvedPath);
      this.repositoryCheckCache.set(resolvedPath, true);
      return true;
    } catch (error) {
      // Only return false for repository-specific errors (exit code 128)
      // Re-throw other errors like permission issues
      if (error instanceof GitError) {
        if (error.context?.exitCode === 128) {
          this.repositoryCheckCache.set(resolvedPath, false);
          return false;
        }
      }
      if (error instanceof Error) {
        if (
          error.message.includes("exit code 128") ||
          error.message.includes("not a git repository") ||
          error.message.includes("fatal: not a git repository")
        ) {
          this.repositoryCheckCache.set(resolvedPath, false);
          return false;
        }
      }
      throw error;
    }
  }

  /**
   * Get list of changed files based on options
   */
  async getChangedFiles(options: ChangedFilesOptions = {}): Promise<string[]> {
    const {
      base = "HEAD",
      staged = false,
      includeUntracked = false,
      filterTypes,
      cwd = this.defaultCwd,
    } = options;

    // Verify this is a git repository first
    const isRepo = await this.isGitRepository(cwd);
    if (!isRepo) {
      throw GitErrors.notARepository(cwd);
    }

    const files = new Set<string>();

    try {
      // Get staged files if requested
      if (staged) {
        const stagedFiles = await this.getStagedFiles(cwd);
        stagedFiles.forEach((file) => files.add(file));
      }

      // Get changed files vs base reference
      if (base) {
        // Validate git reference first
        await this.validateGitReference(base, cwd);

        const args = ["diff", "--name-only", "--relative"];

        // Add filter for change types
        if (filterTypes && filterTypes.length > 0) {
          args.push(`--diff-filter=${filterTypes.join("")}`);
        }

        args.push(base);

        const result = await this.execGitCommand(args, cwd);
        if (result.stdout) {
          result.stdout.split("\n").forEach((file) => {
            if (file.trim()) {
              files.add(file.trim());
            }
          });
        }
      }

      // Get untracked files if requested
      if (includeUntracked) {
        const result = await this.execGitCommand(
          ["ls-files", "--others", "--exclude-standard"],
          cwd,
        );
        if (result.stdout) {
          result.stdout.split("\n").forEach((file) => {
            if (file.trim()) {
              files.add(file.trim());
            }
          });
        }
      }

      return Array.from(files);
    } catch (error) {
      throw new Error(
        `Failed to get changed files: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get list of staged files
   */
  async getStagedFiles(cwd: string = this.defaultCwd): Promise<string[]> {
    // Verify this is a git repository
    if (!(await this.isGitRepository(cwd))) {
      throw GitErrors.notARepository(cwd);
    }

    try {
      // Check if this is an initial commit (no HEAD yet)
      const hasCommits = await this.hasCommits(cwd);

      if (!hasCommits) {
        // For initial commit, use ls-files to get staged files
        const result = await this.execGitCommand(["ls-files", "--cached"], cwd);

        if (!result.stdout) {
          return [];
        }

        return result.stdout
          .split("\n")
          .filter((file) => file.trim())
          .map((file) => file.trim());
      }

      // Normal case: compare staged against HEAD
      const result = await this.execGitCommand(
        ["diff", "--name-only", "--cached", "--relative"],
        cwd,
      );

      if (!result.stdout) {
        return [];
      }

      return result.stdout
        .split("\n")
        .filter((file) => file.trim())
        .map((file) => file.trim());
    } catch (error) {
      throw GitErrors.commandFailed(
        "git diff --cached --name-only",
        1,
        (error as Error).message,
        cwd,
      );
    }
  }

  /**
   * Get list of files changed since a git reference
   * @param ref - Git reference (branch, tag, or commit) to compare against
   * @param cwd - Working directory (optional)
   * @returns Array of file paths changed between ref and HEAD
   */
  async getChangedFilesSince(
    ref: string,
    cwd: string = this.defaultCwd,
  ): Promise<string[]> {
    // Verify this is a git repository
    if (!(await this.isGitRepository(cwd))) {
      throw GitErrors.notARepository(cwd);
    }

    // Check for initial commit state
    const hasCommits = await this.hasCommits(cwd);
    if (!hasCommits) {
      throw new Error(
        "Repository has no commits yet. Commit your changes first or use --staged to process staged files.",
      );
    }

    // Validate the reference exists
    const isValid = await this.validateGitReference(ref, cwd);
    if (!isValid) {
      throw new Error(
        `Invalid git reference: '${ref}'. Please provide a valid branch, tag, or commit.`,
      );
    }

    try {
      // Use three-dot syntax (ref...HEAD) to get files changed on current branch
      // since it diverged from ref. This is the most common use case for --base.
      const result = await this.execGitCommand(
        ["diff", "--name-only", "--relative", `${ref}...HEAD`],
        cwd,
      );

      if (!result.stdout) {
        return [];
      }

      return result.stdout
        .split("\n")
        .filter((file) => file.trim())
        .map((file) => file.trim());
    } catch (error) {
      // Provide helpful error messages for common issues
      const errorMsg = (error as Error).message;
      if (
        errorMsg.includes("bad revision") ||
        errorMsg.includes("unknown revision")
      ) {
        throw new Error(
          `Git reference '${ref}' could not be resolved. Check that the branch/tag exists and try again.`,
        );
      }
      if (errorMsg.includes("ambiguous argument")) {
        throw new Error(
          `Git reference '${ref}' is ambiguous. Use a full reference like 'origin/${ref}' or a commit SHA.`,
        );
      }
      throw GitErrors.commandFailed(
        `git diff --name-only ${ref}...HEAD`,
        1,
        errorMsg,
        cwd,
      );
    }
  }

  /**
   * Find the root directory of the git repository
   */
  async getRepositoryRoot(path: string = this.defaultCwd): Promise<string> {
    const resolvedPath = resolve(path);

    // Check cache first to avoid redundant git calls
    const cachedRoot = this.repositoryRootCache.get(resolvedPath);
    if (cachedRoot !== undefined) {
      return cachedRoot;
    }

    if (!(await this.isGitRepository(resolvedPath))) {
      throw GitErrors.notARepository(resolvedPath);
    }

    try {
      const result = await this.execGitCommand(
        ["rev-parse", "--show-toplevel"],
        resolvedPath,
      );
      // Normalize path to match the format used by Node.js on current platform
      const root = resolve(result.stdout);
      this.repositoryRootCache.set(resolvedPath, root);
      return root;
    } catch (_error) {
      throw GitErrors.repositoryNotFound(resolvedPath);
    }
  }

  /**
   * Validate that a git reference exists
   */
  async validateGitReference(
    ref: string,
    cwd: string = this.defaultCwd,
  ): Promise<boolean> {
    if (!(await this.isGitRepository(cwd))) {
      throw GitErrors.notARepository(cwd);
    }

    try {
      await this.execGitCommand(
        ["rev-parse", "--verify", `${ref}^{commit}`],
        cwd,
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if repository has any commits (not in initial state)
   */
  async hasCommits(cwd: string = this.defaultCwd): Promise<boolean> {
    try {
      await this.execGitCommand(["rev-parse", "HEAD"], cwd);
      return true;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Check if repository is in detached HEAD state
   */
  async isDetachedHead(cwd: string = this.defaultCwd): Promise<boolean> {
    try {
      const result = await this.execGitCommand(
        ["symbolic-ref", "-q", "HEAD"],
        cwd,
      );
      return !result.stdout; // If stdout is empty, we're not on a branch
    } catch (_error) {
      // symbolic-ref fails when in detached HEAD
      return true;
    }
  }

  /**
   * Get current repository status
   */
  async getStatus(cwd: string = this.defaultCwd): Promise<GitStatus> {
    try {
      const [repositoryRoot, branchResult, statusResult] = await Promise.all([
        this.getRepositoryRoot(cwd),
        this.execGitCommand(["branch", "--show-current"], cwd).catch(() => ({
          stdout: "HEAD",
        })),
        this.execGitCommand(["status", "--porcelain"], cwd),
      ]);

      const currentBranch = branchResult.stdout?.trim() || "HEAD";

      let stagedFiles = 0;
      let modifiedFiles = 0;
      let untrackedFiles = 0;

      if (statusResult.stdout) {
        const lines = statusResult.stdout
          .split("\n")
          .filter((line) => line.trim());

        for (const line of lines) {
          const status = line.substring(0, 2);

          if (status[0] !== " " && status[0] !== "?") {
            stagedFiles++;
          }

          if (status[1] !== " " && status[1] !== "?") {
            modifiedFiles++;
          }

          if (status === "??") {
            untrackedFiles++;
          }
        }
      }

      const hasChanges = modifiedFiles > 0;
      const hasStaged = stagedFiles > 0;
      const hasUntracked = untrackedFiles > 0;
      const isDirty = hasChanges || hasStaged || hasUntracked;

      // Get ahead/behind tracking if we have commits and are on a branch
      let ahead = 0;
      let behind = 0;

      try {
        if (currentBranch && currentBranch !== "HEAD") {
          // Get the upstream branch
          const upstreamResult = await this.execGitCommand(
            ["rev-parse", "--abbrev-ref", `${currentBranch}@{upstream}`],
            cwd,
          ).catch(() => null);

          if (upstreamResult?.stdout) {
            const upstream = upstreamResult.stdout.trim();

            // Count commits ahead (local commits not in upstream)
            const aheadResult = await this.execGitCommand(
              ["rev-list", "--count", `${upstream}..${currentBranch}`],
              cwd,
            ).catch(() => null);

            if (aheadResult?.stdout) {
              ahead = parseInt(aheadResult.stdout.trim(), 10) || 0;
            }

            // Count commits behind (upstream commits not in local)
            const behindResult = await this.execGitCommand(
              ["rev-list", "--count", `${currentBranch}..${upstream}`],
              cwd,
            ).catch(() => null);

            if (behindResult?.stdout) {
              behind = parseInt(behindResult.stdout.trim(), 10) || 0;
            }
          }
        }
      } catch (_error) {
        // If ahead/behind tracking fails, just use 0 values (no upstream configured)
        ahead = 0;
        behind = 0;
      }

      return {
        repositoryRoot,
        branch: currentBranch,
        ahead,
        behind,
        hasChanges,
        hasStaged,
        hasUntracked,
        stagedFiles,
        modifiedFiles,
        untrackedFiles,
        isDirty,
      };
    } catch (error) {
      throw new Error(
        `Failed to get repository status: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
