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
    try {
      const resolvedPath = resolve(path);
      await this.execGitCommand(["rev-parse", "--git-dir"], resolvedPath);
      return true;
    } catch (error) {
      // Only return false for repository-specific errors (exit code 128)
      // Re-throw other errors like permission issues
      if (error instanceof GitError) {
        if (error.context?.exitCode === 128) {
          return false;
        }
      }
      if (error instanceof Error) {
        if (
          error.message.includes("exit code 128") ||
          error.message.includes("not a git repository") ||
          error.message.includes("fatal: not a git repository")
        ) {
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
    try {
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
      if (!(await this.isGitRepository(cwd))) {
        throw GitErrors.notARepository(cwd);
      }
      throw GitErrors.commandFailed(
        "git diff --cached --name-only",
        1,
        (error as Error).message,
        cwd,
      );
    }
  }

  /**
   * Find the root directory of the git repository
   */
  async getRepositoryRoot(path: string = this.defaultCwd): Promise<string> {
    const resolvedPath = resolve(path);

    if (!(await this.isGitRepository(resolvedPath))) {
      throw GitErrors.notARepository(resolvedPath);
    }

    try {
      const result = await this.execGitCommand(
        ["rev-parse", "--show-toplevel"],
        resolvedPath,
      );
      // Normalize path to match the format used by Node.js on current platform
      return resolve(result.stdout);
    } catch (error) {
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

      return {
        repositoryRoot,
        branch: currentBranch,
        ahead: 0, // TODO: implement proper ahead/behind tracking
        behind: 0,
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
