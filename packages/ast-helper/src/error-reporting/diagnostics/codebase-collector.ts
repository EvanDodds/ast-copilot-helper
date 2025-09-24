/**
 * Codebase diagnostic collector for project structure and metadata
 */

import * as fs from "fs";
import * as path from "path";
import type {
  DiagnosticCollector,
  DiagnosticScope,
  CodebaseDiagnostics,
} from "./types.js";
import type { DiagnosticData, FileInfo } from "../types.js";

/**
 * Collects codebase diagnostic data including project structure,
 * git information, package data, and file analysis
 */
export class CodebaseDiagnosticCollector implements DiagnosticCollector {
  readonly name = "codebase";
  readonly scope: DiagnosticScope = "codebase";
  readonly priority = 3;
  readonly cacheTTL = 60000; // 1 minute

  /**
   * Check if this collector can run in the current environment
   */
  async canCollect(): Promise<boolean> {
    try {
      await fs.promises.access(process.cwd());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get estimated collection time in milliseconds
   */
  estimateCollectionTime(): number {
    return 500; // Estimated 500ms for codebase analysis
  }

  /**
   * Collect codebase diagnostic data
   */
  async collect(): Promise<Partial<DiagnosticData>> {
    if (!(await this.canCollect())) {
      return {};
    }

    try {
      const codebaseData: CodebaseDiagnostics = {
        structure: await this.collectStructureInfo(),
        git: await this.collectGitInfo(),
        packages: await this.collectPackageInfo(),
        complexity: await this.collectComplexityInfo(),
      };

      return {
        codebase: codebaseData,
      };
    } catch (error) {
      return {};
    }
  }

  /**
   * Collect project structure information
   */
  private async collectStructureInfo() {
    const cwd = process.cwd();
    const structure = await this.analyzeDirectory(cwd);

    return {
      totalFiles: structure.files.length,
      totalDirectories: structure.directories,
      totalSize: structure.totalSize,
      languages: structure.languages,
      fileTypes: structure.fileTypes,
      largestFiles: structure.files
        .sort((a, b) => b.size - a.size)
        .slice(0, 10), // Top 10 largest files
    };
  }

  /**
   * Analyze directory structure recursively
   */
  private async analyzeDirectory(
    dirPath: string,
    maxDepth = 5,
    currentDepth = 0,
  ): Promise<{
    files: (FileInfo & { lines: number })[];
    directories: number;
    totalSize: number;
    languages: Record<string, number>;
    fileTypes: Record<string, number>;
  }> {
    const result = {
      files: [] as (FileInfo & { lines: number })[],
      directories: 0,
      totalSize: 0,
      languages: {} as Record<string, number>,
      fileTypes: {} as Record<string, number>,
    };

    if (currentDepth > maxDepth) {
      return result;
    }

    try {
      const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Skip common directories that should be ignored
        if (entry.isDirectory() && this.shouldSkipDirectory(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          result.directories++;
          const subResult = await this.analyzeDirectory(
            fullPath,
            maxDepth,
            currentDepth + 1,
          );
          result.files.push(...subResult.files);
          result.directories += subResult.directories;
          result.totalSize += subResult.totalSize;

          // Merge language and file type counts
          Object.entries(subResult.languages).forEach(([lang, count]) => {
            result.languages[lang] = (result.languages[lang] || 0) + count;
          });
          Object.entries(subResult.fileTypes).forEach(([type, count]) => {
            result.fileTypes[type] = (result.fileTypes[type] || 0) + count;
          });
        } else {
          try {
            const stats = await fs.promises.stat(fullPath);
            const ext = path.extname(entry.name).toLowerCase();
            const language = this.getLanguageFromExtension(ext);

            const lines = this.estimateLineCount(stats.size, language);
            const fileInfo: FileInfo & { lines: number } = {
              path: this.sanitizePath(fullPath),
              size: stats.size,
              type: ext || "no-extension",
              lines,
            };

            result.files.push(fileInfo);
            result.totalSize += stats.size;

            // Count by language
            if (language) {
              result.languages[language] =
                (result.languages[language] || 0) + 1;
            }

            // Count by file type
            const fileType = ext || "no-extension";
            result.fileTypes[fileType] = (result.fileTypes[fileType] || 0) + 1;
          } catch {
            // Skip files we can't access
          }
        }
      }
    } catch {
      // Skip directories we can't access
    }

    return result;
  }

  /**
   * Check if directory should be skipped during analysis
   */
  private shouldSkipDirectory(name: string): boolean {
    const skipDirs = [
      "node_modules",
      ".git",
      ".svn",
      ".hg",
      "dist",
      "build",
      "coverage",
      ".nyc_output",
      "tmp",
      "temp",
      ".cache",
      ".next",
      ".nuxt",
      "__pycache__",
      ".pytest_cache",
      "venv",
      "env",
      ".venv",
      ".env",
    ];

    return skipDirs.includes(name) || name.startsWith(".");
  }

  /**
   * Get programming language from file extension
   */
  private getLanguageFromExtension(ext: string): string | undefined {
    const languageMap: Record<string, string> = {
      ".js": "JavaScript",
      ".jsx": "JavaScript",
      ".ts": "TypeScript",
      ".tsx": "TypeScript",
      ".py": "Python",
      ".java": "Java",
      ".c": "C",
      ".cpp": "C++",
      ".cc": "C++",
      ".cxx": "C++",
      ".h": "C/C++",
      ".hpp": "C++",
      ".cs": "C#",
      ".php": "PHP",
      ".rb": "Ruby",
      ".go": "Go",
      ".rs": "Rust",
      ".swift": "Swift",
      ".kt": "Kotlin",
      ".scala": "Scala",
      ".clj": "Clojure",
      ".hs": "Haskell",
      ".ml": "OCaml",
      ".fs": "F#",
      ".lua": "Lua",
      ".r": "R",
      ".m": "Objective-C",
      ".pl": "Perl",
      ".sh": "Shell",
      ".bash": "Shell",
      ".zsh": "Shell",
      ".fish": "Shell",
      ".ps1": "PowerShell",
      ".html": "HTML",
      ".css": "CSS",
      ".scss": "SCSS",
      ".sass": "Sass",
      ".less": "Less",
      ".json": "JSON",
      ".xml": "XML",
      ".yaml": "YAML",
      ".yml": "YAML",
      ".toml": "TOML",
      ".md": "Markdown",
      ".sql": "SQL",
    };

    return languageMap[ext];
  }

  /**
   * Collect git repository information
   */
  private async collectGitInfo() {
    const cwd = process.cwd();
    const gitDir = path.join(cwd, ".git");

    try {
      await fs.promises.access(gitDir);
    } catch {
      return {
        isRepository: false,
      };
    }

    const gitInfo: any = {
      isRepository: true,
    };

    try {
      // Read current branch
      const headPath = path.join(gitDir, "HEAD");
      const headContent = await fs.promises.readFile(headPath, "utf8");

      if (headContent.startsWith("ref: refs/heads/")) {
        gitInfo.branch = headContent.replace("ref: refs/heads/", "").trim();
      }

      // Read current commit
      let commitPath: string;
      if (gitInfo.branch) {
        commitPath = path.join(gitDir, "refs", "heads", gitInfo.branch);
      } else {
        // Detached HEAD
        commitPath = headPath;
      }

      try {
        const commitHash = await fs.promises.readFile(commitPath, "utf8");
        gitInfo.commit = commitHash.trim().substring(0, 7); // Short hash
      } catch {
        // Could not read commit
      }

      // Check for remote
      try {
        const configPath = path.join(gitDir, "config");
        const configContent = await fs.promises.readFile(configPath, "utf8");
        const remoteMatch = configContent.match(
          /\[remote "origin"\][\s\S]*?url = (.+)/,
        );
        if (remoteMatch?.[1]) {
          gitInfo.remote = this.sanitizeRemoteUrl(remoteMatch[1].trim());
        }
      } catch {
        // Could not read config
      }

      // Check for modifications (simplified)
      try {
        const indexPath = path.join(gitDir, "index");
        await fs.promises.access(indexPath);
        // If index exists, assume there might be staged changes
        // A full implementation would parse the index file
        gitInfo.isDirty = false;
        gitInfo.modified = 0;
        gitInfo.untracked = 0;
      } catch {
        gitInfo.isDirty = false;
      }
    } catch {
      // Git directory exists but we can't read it properly
    }

    return gitInfo;
  }

  /**
   * Sanitize remote URL for privacy
   */
  private sanitizeRemoteUrl(url: string): string {
    // Remove authentication tokens and user info
    return url
      .replace(/https:\/\/[^@]+@github\.com/, "https://github.com")
      .replace(/git@github\.com:/, "github.com:")
      .replace(/https:\/\/[^@]+@gitlab\.com/, "https://gitlab.com")
      .replace(/git@gitlab\.com:/, "gitlab.com:");
  }

  /**
   * Collect package and dependency information
   */
  private async collectPackageInfo() {
    const cwd = process.cwd();
    const packageJsonPath = path.join(cwd, "package.json");

    try {
      await fs.promises.access(packageJsonPath);
    } catch {
      return {
        packageJson: false,
        dependencies: 0,
        devDependencies: 0,
        scripts: [],
        lockFile: false,
      };
    }

    try {
      const packageContent = await fs.promises.readFile(
        packageJsonPath,
        "utf8",
      );
      const packageData = JSON.parse(packageContent);

      // Check for lock files
      const lockFiles = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"];
      let hasLockFile = false;

      for (const lockFile of lockFiles) {
        try {
          await fs.promises.access(path.join(cwd, lockFile));
          hasLockFile = true;
          break;
        } catch {
          // Continue checking other lock files
        }
      }

      return {
        packageJson: true,
        dependencies: Object.keys(packageData.dependencies || {}).length,
        devDependencies: Object.keys(packageData.devDependencies || {}).length,
        scripts: Object.keys(packageData.scripts || {}),
        lockFile: hasLockFile,
      };
    } catch {
      return {
        packageJson: true,
        dependencies: 0,
        devDependencies: 0,
        scripts: [],
        lockFile: false,
      };
    }
  }

  /**
   * Sanitize file paths for privacy
   */
  private sanitizePath(fullPath: string): string {
    const cwd = process.cwd();
    if (fullPath.startsWith(cwd)) {
      return fullPath.replace(cwd, "<project>");
    }
    return "<external>";
  }

  /**
   * Estimate line count based on file size and language
   */
  private estimateLineCount(size: number, language?: string): number {
    // Rough estimation based on average characters per line for different languages
    const avgCharsPerLine: Record<string, number> = {
      JavaScript: 35,
      TypeScript: 40,
      Python: 30,
      Java: 45,
      "C++": 40,
      HTML: 25,
      CSS: 20,
      JSON: 15,
      Markdown: 50,
    };

    const avgChars = language ? avgCharsPerLine[language] || 35 : 35;
    return Math.round(size / avgChars);
  }

  /**
   * Collect code complexity information
   */
  private async collectComplexityInfo() {
    // This would be a placeholder for more sophisticated analysis
    // For now, we'll use the existing structure data
    const structure = await this.analyzeDirectory(process.cwd());

    const totalLines = structure.files.reduce((sum, file) => {
      return sum + (file.lines || this.estimateLineCount(file.size));
    }, 0);

    const avgLinesPerFile =
      structure.files.length > 0 ? totalLines / structure.files.length : 0;
    const maxLinesPerFile = Math.max(
      ...structure.files.map((f) => f.lines || this.estimateLineCount(f.size)),
    );

    return {
      averageLinesPerFile: Math.round(avgLinesPerFile),
      maxLinesPerFile,
      totalLinesOfCode: totalLines,
      commentPercentage: 15, // Rough estimate, would need actual parsing
    };
  }
}
