/**
 * Git integration types and interfaces
 * Provides type definitions for git operations and change detection
 */

/**
 * Options for getting changed files from git
 */
export interface ChangedFilesOptions {
  /** Git reference to compare against (default: HEAD) */
  base?: string;

  /** Include staged files in the result */
  staged?: boolean;

  /** Include untracked files in the result */
  includeUntracked?: boolean;

  /** File change types to include (A=Added, C=Copied, M=Modified, R=Renamed, T=Type changed) */
  filterTypes?: Array<"A" | "C" | "M" | "R" | "T">;

  /** Working directory for git operations */
  cwd?: string;
}

/**
 * Git repository status information
 */
export interface GitStatus {
  /** Repository root directory */
  repositoryRoot: string;

  /** Current branch name */
  branch: string;

  /** Number of commits ahead of remote */
  ahead: number;

  /** Number of commits behind remote */
  behind: number;

  /** Whether there are any changes */
  hasChanges: boolean;

  /** Whether there are staged changes */
  hasStaged: boolean;

  /** Whether there are untracked files */
  hasUntracked: boolean;

  /** Number of staged files */
  stagedFiles: number;

  /** Number of modified files */
  modifiedFiles: number;

  /** Number of untracked files */
  untrackedFiles: number;

  /** Whether there are uncommitted changes (legacy) */
  isDirty: boolean;
}

/**
 * Result of git command execution
 */
export interface GitCommandResult {
  /** Command exit code */
  exitCode: number;

  /** Standard output */
  stdout: string;

  /** Standard error */
  stderr: string;

  /** Command that was executed */
  command: string;

  /** Working directory where command was executed */
  cwd: string;
}

/**
 * Git utilities interface
 * Provides methods for git repository operations and change detection
 */
export interface GitUtils {
  /**
   * Check if the given path is within a git repository
   * @param path - Directory path to check
   * @returns True if path is in a git repository
   */
  isGitRepository(path: string): Promise<boolean>;

  /**
   * Get list of changed files based on options
   * @param options - Configuration for change detection
   * @returns Array of file paths relative to repository root
   */
  getChangedFiles(options?: ChangedFilesOptions): Promise<string[]>;

  /**
   * Get list of staged files
   * @param cwd - Working directory (optional)
   * @returns Array of staged file paths
   */
  getStagedFiles(cwd?: string): Promise<string[]>;

  /**
   * Get list of files changed since a git reference
   * @param ref - Git reference (branch, tag, or commit) to compare against
   * @param cwd - Working directory (optional)
   * @returns Array of file paths changed between ref and HEAD
   */
  getChangedFilesSince(ref: string, cwd?: string): Promise<string[]>;

  /**
   * Check if repository has any commits
   * @param cwd - Working directory (optional)
   * @returns True if repository has at least one commit
   */
  hasCommits(cwd?: string): Promise<boolean>;

  /**
   * Check if repository is in detached HEAD state
   * @param cwd - Working directory (optional)
   * @returns True if in detached HEAD state
   */
  isDetachedHead(cwd?: string): Promise<boolean>;

  /**
   * Find the root directory of the git repository
   * @param path - Starting path to search from
   * @returns Path to repository root
   */
  getRepositoryRoot(path: string): Promise<string>;

  /**
   * Validate that a git reference exists
   * @param ref - Git reference (branch, tag, commit)
   * @param cwd - Working directory (optional)
   * @returns True if reference exists
   */
  validateGitReference(ref: string, cwd?: string): Promise<boolean>;

  /**
   * Get current repository status
   * @param cwd - Working directory (optional)
   * @returns Repository status information
   */
  getStatus(cwd?: string): Promise<GitStatus>;
}
