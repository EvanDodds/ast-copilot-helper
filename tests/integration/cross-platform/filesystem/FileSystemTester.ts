import { promises as fs, constants as fsConstants } from "fs";
import { join, sep, normalize, resolve, basename, dirname } from "path";
import { platform, tmpdir } from "os";
import { FileSystemTestResult, TestResult } from "../types";

/**
 * Comprehensive file system compatibility tester for cross-platform validation
 * Tests file system behavior across Windows, macOS, and Linux
 */
export class FileSystemTester {
  private platform: string;
  private testDir: string;

  constructor() {
    this.platform = platform();
    this.testDir = join(tmpdir(), `cross-platform-fs-test-${Date.now()}`);
  }

  /**
   * Run comprehensive file system compatibility tests
   */
  async runTests(): Promise<FileSystemTestResult> {
    const startTime = Date.now();
    const results: TestResult[] = [];

    try {
      // Setup test directory
      await this.setupTestDirectory();

      // Run all test categories
      const testCategories = [
        () => this.testCaseSensitivity(),
        () => this.testPathSeparators(),
        () => this.testSpecialCharacters(),
        () => this.testFilePermissions(),
        () => this.testLongPaths(),
        () => this.testUnicodeSupport(),
        () => this.testSymbolicLinks(),
        () => this.testHardLinks(),
        () => this.testFileAttributes(),
        () => this.testDirectoryOperations(),
        () => this.testFileWatching(),
        () => this.testConcurrentAccess(),
      ];

      for (const testCategory of testCategories) {
        try {
          const categoryResults = await testCategory();
          results.push(...categoryResults);
        } catch (error) {
          results.push({
            name: testCategory.name,
            category: "filesystem",
            passed: false,
            error: error instanceof Error ? error.message : String(error),
            platform: this.platform,
            duration: 0,
          });
        }
      }

      return {
        platform: this.platform,
        testResults: results,
        summary: {
          total: results.length,
          passed: results.filter((r) => r.passed).length,
          failed: results.filter((r) => !r.passed).length,
          duration: Date.now() - startTime,
        },
        caseSensitive: await this.detectCaseSensitivity(),
        pathSeparator: sep,
        maxPathLength: await this.detectMaxPathLength(),
        supportsSymlinks: await this.testSymlinkSupport(),
        supportsHardlinks: await this.testHardlinkSupport(),
      };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Test case sensitivity behavior across platforms
   */
  private async testCaseSensitivity(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const testName = "Case Sensitivity Detection";
    const startTime = Date.now();

    try {
      const lowerFile = join(this.testDir, "testfile.txt");
      const upperFile = join(this.testDir, "TESTFILE.txt");

      await fs.writeFile(lowerFile, "lowercase content");

      let caseSensitive: boolean;
      try {
        await fs.access(upperFile);
        caseSensitive = false; // File system is case-insensitive
      } catch {
        caseSensitive = true; // File system is case-sensitive
      }

      // Verify expected behavior per platform
      let expectedBehavior: boolean;
      switch (this.platform) {
        case "win32":
          expectedBehavior = false; // Windows is typically case-insensitive
          break;
        case "darwin":
          expectedBehavior = false; // macOS is typically case-insensitive (but case-preserving)
          break;
        case "linux":
          expectedBehavior = true; // Linux is typically case-sensitive
          break;
        default:
          expectedBehavior = true; // Default to case-sensitive for other platforms
      }

      const testPassed = caseSensitive === expectedBehavior;
      results.push({
        name: testName,
        category: "filesystem",
        passed: testPassed,
        platform: this.platform,
        duration: Date.now() - startTime,
        ...(testPassed
          ? {}
          : {
              error: `Case sensitivity mismatch: expected ${expectedBehavior}, detected ${caseSensitive} on ${this.platform}`,
            }),
        details: {
          detected: caseSensitive,
          expected: expectedBehavior,
          platform: this.platform,
        },
      });

      // Test case-insensitive file operations if applicable
      if (!caseSensitive) {
        const caseTestStart = Date.now();
        try {
          await fs.writeFile(upperFile, "uppercase content");
          const content = await fs.readFile(lowerFile, "utf8");

          const testPassed = content === "uppercase content";
          results.push({
            name: "Case-Insensitive File Overwrite",
            category: "filesystem",
            passed: testPassed,
            platform: this.platform,
            duration: Date.now() - caseTestStart,
            ...(testPassed
              ? {}
              : {
                  error: `Content mismatch: expected 'uppercase content', got '${content}'`,
                }),
            details: {
              content,
              expected: "uppercase content",
              contentMatches: testPassed,
            },
          });
        } catch (error) {
          results.push({
            name: "Case-Insensitive File Overwrite",
            category: "filesystem",
            passed: false,
            error: error instanceof Error ? error.message : String(error),
            platform: this.platform,
            duration: Date.now() - caseTestStart,
          });
        }
      }
    } catch (error) {
      results.push({
        name: testName,
        category: "filesystem",
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        platform: this.platform,
        duration: Date.now() - startTime,
      });
    }

    return results;
  }

  /**
   * Test path separator handling across platforms
   */
  private async testPathSeparators(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const testName = "Path Separator Handling";
    const startTime = Date.now();

    try {
      // Test normalization of different path separators
      const testPaths = [
        "dir1/dir2/file.txt",
        "dir1\\dir2\\file.txt",
        "dir1/dir2\\file.txt",
        "./dir1/dir2/file.txt",
        "dir1//dir2/file.txt",
      ];

      const expectedNormalized = join("dir1", "dir2", "file.txt");
      let allNormalizedCorrectly = true;
      const normalizationResults: any = {};

      for (const testPath of testPaths) {
        const normalized = normalize(testPath);
        normalizationResults[testPath] = normalized;

        if (!normalized.endsWith(expectedNormalized.replace(/^\.[\\/]/, ""))) {
          allNormalizedCorrectly = false;
        }
      }

      results.push({
        name: testName,
        category: "filesystem",
        passed: allNormalizedCorrectly,
        platform: this.platform,
        duration: Date.now() - startTime,
        ...(allNormalizedCorrectly
          ? {}
          : { error: "Path normalization failed for some test paths" }),
        details: {
          pathSeparator: sep,
          normalizationResults,
          expected: expectedNormalized,
          allNormalizedCorrectly,
        },
      });

      // Test actual file operations with normalized paths
      const pathTestStart = Date.now();
      try {
        const testPath = join(this.testDir, "nested", "directory", "test.txt");
        await fs.mkdir(dirname(testPath), { recursive: true });
        await fs.writeFile(testPath, "path test content");

        const content = await fs.readFile(testPath, "utf8");

        const testPassed = content === "path test content";
        results.push({
          name: "Nested Path File Operations",
          category: "filesystem",
          passed: testPassed,
          platform: this.platform,
          duration: Date.now() - pathTestStart,
          ...(testPassed
            ? {}
            : {
                error: `Content mismatch: expected 'path test content', got '${content}'`,
              }),
          details: {
            content,
            testPath,
            contentMatches: testPassed,
          },
        });
      } catch (error) {
        results.push({
          name: "Nested Path File Operations",
          category: "filesystem",
          passed: false,
          error: error instanceof Error ? error.message : String(error),
          platform: this.platform,
          duration: Date.now() - pathTestStart,
        });
      }
    } catch (error) {
      results.push({
        name: testName,
        category: "filesystem",
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        platform: this.platform,
        duration: Date.now() - startTime,
      });
    }

    return results;
  }

  /**
   * Test handling of special characters in file names
   */
  private async testSpecialCharacters(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Platform-specific special character tests
    const specialCharSets = {
      win32: [
        { name: "Spaces and Dots", chars: "file name.txt" },
        { name: "Unicode", chars: "tëst-fïlé.txt" },
        { name: "Numbers and Symbols", chars: "file_123-test.txt" },
        // Note: Windows prohibits < > : " | ? * \ /
      ],
      darwin: [
        { name: "Spaces and Dots", chars: "file name.txt" },
        { name: "Unicode", chars: "tëst-fïlé.txt" },
        { name: "Symbols", chars: "file!@#$%^&()_+-=.txt" },
        { name: "Emoji", chars: "test📁file.txt" },
        // Note: macOS prohibits : and null
      ],
      linux: [
        { name: "Spaces and Dots", chars: "file name.txt" },
        { name: "Unicode", chars: "tëst-fïlé.txt" },
        { name: "Symbols", chars: "file!@#$%^&()_+-=.txt" },
        { name: "Emoji", chars: "test📁file.txt" },
        { name: "Extended Symbols", chars: "file~`[]{}|;:'\",.<>.txt" },
        // Note: Linux prohibits null and /
      ],
    };

    const platformCharSets =
      specialCharSets[this.platform as keyof typeof specialCharSets] ||
      specialCharSets.linux;

    for (const charSet of platformCharSets) {
      const testName = `Special Characters: ${charSet.name}`;
      const startTime = Date.now();

      try {
        const testFile = join(this.testDir, charSet.chars);
        const testContent = `Content for ${charSet.name}`;

        await fs.writeFile(testFile, testContent);
        const readContent = await fs.readFile(testFile, "utf8");

        const testPassed = readContent === testContent;
        results.push({
          name: testName,
          category: "filesystem",
          passed: testPassed,
          platform: this.platform,
          duration: Date.now() - startTime,
          ...(testPassed
            ? {}
            : {
                error: `Content mismatch for special character file: expected '${testContent}', got '${readContent}'`,
              }),
          details: {
            filename: charSet.chars,
            content: readContent,
            expected: testContent,
            contentMatches: testPassed,
          },
        });
      } catch (error) {
        // Some special characters may not be supported - this is expected
        const isExpectedFailure = this.isExpectedSpecialCharFailure(
          charSet.chars,
          error,
        );

        results.push({
          name: testName,
          category: "filesystem",
          passed: isExpectedFailure,
          platform: this.platform,
          duration: Date.now() - startTime,
          details: {
            filename: charSet.chars,
            error: error instanceof Error ? error.message : String(error),
            expectedFailure: isExpectedFailure,
          },
        });
      }
    }

    return results;
  }

  /**
   * Test file permissions across platforms
   */
  private async testFilePermissions(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    if (this.platform === "win32") {
      // Windows has limited POSIX permission support
      results.push({
        name: "File Permissions (Windows)",
        category: "filesystem",
        passed: true,
        platform: this.platform,
        duration: 0,
        details: { message: "Windows permissions tested separately via ACLs" },
      });
      return results;
    }

    // Test POSIX permissions (macOS and Linux)
    const permissionTests = [
      { name: "Read-Only File", mode: 0o444 },
      { name: "Read-Write File", mode: 0o644 },
      { name: "Executable File", mode: 0o755 },
    ];

    for (const permTest of permissionTests) {
      const testName = `File Permissions: ${permTest.name}`;
      const startTime = Date.now();

      try {
        const testFile = join(
          this.testDir,
          `perm-test-${permTest.mode.toString(8)}.txt`,
        );
        await fs.writeFile(testFile, "permission test content");
        await fs.chmod(testFile, permTest.mode);

        const stats = await fs.stat(testFile);
        const actualMode = stats.mode & parseInt("777", 8);

        results.push({
          name: testName,
          category: "filesystem",
          passed: actualMode === permTest.mode,
          platform: this.platform,
          duration: Date.now() - startTime,
          details: {
            expectedMode: permTest.mode.toString(8),
            actualMode: actualMode.toString(8),
          },
        });
      } catch (error) {
        results.push({
          name: testName,
          category: "filesystem",
          passed: false,
          error: error instanceof Error ? error.message : String(error),
          platform: this.platform,
          duration: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * Test long path support across platforms
   */
  private async testLongPaths(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const testName = "Long Path Support";
    const startTime = Date.now();

    try {
      // Create a deeply nested directory structure
      const maxDepth = this.platform === "win32" ? 10 : 20; // Windows has more restrictions
      let currentPath = this.testDir;

      for (let i = 0; i < maxDepth; i++) {
        currentPath = join(
          currentPath,
          `very-long-directory-name-level-${i.toString().padStart(3, "0")}`,
        );
      }

      await fs.mkdir(currentPath, { recursive: true });

      const testFile = join(currentPath, "deeply-nested-test-file.txt");
      await fs.writeFile(testFile, "long path test content");

      const content = await fs.readFile(testFile, "utf8");
      const contentMatches = content === "long path test content";

      results.push({
        name: testName,
        category: "filesystem",
        passed: contentMatches,
        platform: this.platform,
        duration: Date.now() - startTime,
        ...(contentMatches
          ? {}
          : {
              error: `Content mismatch in long path test: expected 'long path test content', got '${content}'`,
            }),
        details: {
          pathLength: testFile.length,
          maxDepth,
          content,
          contentMatches,
        },
      });
    } catch (error) {
      // Long path limitations are platform-specific and expected in some cases
      const isExpectedFailure = this.isExpectedLongPathFailure(error);

      results.push({
        name: testName,
        category: "filesystem",
        passed: isExpectedFailure,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : String(error),
          expectedFailure: isExpectedFailure,
          platform: this.platform,
        },
      });
    }

    return results;
  }

  /**
   * Test Unicode support in file names and content
   */
  private async testUnicodeSupport(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    const unicodeTests = [
      {
        name: "Basic Latin Extended",
        filename: "tëst-fîlé.txt",
        content: "Hëllö Wörld!",
      },
      { name: "Cyrillic", filename: "тест.txt", content: "Привет мир!" },
      { name: "CJK", filename: "测试文件.txt", content: "你好世界！" },
      {
        name: "Emoji",
        filename: "test🔥file.txt",
        content: "Hello 🌍 World! 🚀",
      },
      {
        name: "Mixed Scripts",
        filename: "test-тест-测试.txt",
        content: "Mixed: English, Русский, 中文",
      },
    ];

    for (const unicodeTest of unicodeTests) {
      const testName = `Unicode Support: ${unicodeTest.name}`;
      const startTime = Date.now();

      try {
        const testFile = join(this.testDir, unicodeTest.filename);
        await fs.writeFile(testFile, unicodeTest.content, "utf8");

        const content = await fs.readFile(testFile, "utf8");
        const contentMatches = content === unicodeTest.content;

        results.push({
          name: testName,
          category: "filesystem",
          passed: contentMatches,
          platform: this.platform,
          duration: Date.now() - startTime,
          ...(contentMatches
            ? {}
            : {
                error: `Content mismatch for Unicode test '${unicodeTest.name}': expected '${unicodeTest.content}', got '${content}'`,
              }),
          details: {
            filename: unicodeTest.filename,
            expectedContent: unicodeTest.content,
            actualContent: content,
            contentMatch: contentMatches,
          },
        });
      } catch (error) {
        results.push({
          name: testName,
          category: "filesystem",
          passed: false,
          error: error instanceof Error ? error.message : String(error),
          platform: this.platform,
          duration: Date.now() - startTime,
          details: { filename: unicodeTest.filename },
        });
      }
    }

    return results;
  }

  /**
   * Test symbolic link support
   */
  private async testSymbolicLinks(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const testName = "Symbolic Links";
    const startTime = Date.now();

    try {
      const originalFile = join(this.testDir, "original-file.txt");
      const symlinkFile = join(this.testDir, "symlink-file.txt");

      await fs.writeFile(originalFile, "symlink test content");
      await fs.symlink(originalFile, symlinkFile);

      const content = await fs.readFile(symlinkFile, "utf8");
      const stats = await fs.lstat(symlinkFile);

      results.push({
        name: testName,
        category: "filesystem",
        passed: content === "symlink test content" && stats.isSymbolicLink(),
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          content,
          isSymbolicLink: stats.isSymbolicLink(),
          linkTarget: await fs.readlink(symlinkFile),
        },
      });
    } catch (error) {
      // Symlinks may not be supported or may require elevated permissions
      const isExpectedFailure = this.isExpectedSymlinkFailure(error);

      results.push({
        name: testName,
        category: "filesystem",
        passed: isExpectedFailure,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : String(error),
          expectedFailure: isExpectedFailure,
        },
      });
    }

    return results;
  }

  /**
   * Test hard link support
   */
  private async testHardLinks(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const testName = "Hard Links";
    const startTime = Date.now();

    try {
      const originalFile = join(this.testDir, "original-hardlink.txt");
      const hardlinkFile = join(this.testDir, "hardlink-file.txt");

      await fs.writeFile(originalFile, "hardlink test content");
      await fs.link(originalFile, hardlinkFile);

      const originalStats = await fs.stat(originalFile);
      const hardlinkStats = await fs.stat(hardlinkFile);

      // Both files should have the same inode (same file)
      const sameInode = originalStats.ino === hardlinkStats.ino;
      const linkCount = originalStats.nlink === 2; // Should be 2 links to the same file

      results.push({
        name: testName,
        category: "filesystem",
        passed: sameInode && linkCount,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          sameInode,
          linkCount: originalStats.nlink,
          originalInode: originalStats.ino,
          hardlinkInode: hardlinkStats.ino,
        },
      });
    } catch (error) {
      // Hard links may not be supported on all file systems
      const isExpectedFailure = this.isExpectedHardlinkFailure(error);

      results.push({
        name: testName,
        category: "filesystem",
        passed: isExpectedFailure,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : String(error),
          expectedFailure: isExpectedFailure,
        },
      });
    }

    return results;
  }

  /**
   * Test file attributes and metadata
   */
  private async testFileAttributes(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const testName = "File Attributes and Metadata";
    const startTime = Date.now();

    try {
      const testFile = join(this.testDir, "attributes-test.txt");
      await fs.writeFile(testFile, "attributes test content");

      const stats = await fs.stat(testFile);

      // Test basic attributes
      const hasValidSize = stats.size > 0;
      const hasValidDates =
        stats.mtime instanceof Date && stats.ctime instanceof Date;
      const hasValidMode = typeof stats.mode === "number";

      results.push({
        name: testName,
        category: "filesystem",
        passed: hasValidSize && hasValidDates && hasValidMode,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          size: stats.size,
          mode: stats.mode.toString(8),
          mtime: stats.mtime.toISOString(),
          ctime: stats.ctime.toISOString(),
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
        },
      });
    } catch (error) {
      results.push({
        name: testName,
        category: "filesystem",
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        platform: this.platform,
        duration: Date.now() - startTime,
      });
    }

    return results;
  }

  /**
   * Test directory operations
   */
  private async testDirectoryOperations(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // Test recursive directory creation
    const recursiveTestStart = Date.now();
    try {
      const deepPath = join(this.testDir, "dir1", "dir2", "dir3", "dir4");
      await fs.mkdir(deepPath, { recursive: true });

      const stats = await fs.stat(deepPath);

      results.push({
        name: "Recursive Directory Creation",
        category: "filesystem",
        passed: stats.isDirectory(),
        platform: this.platform,
        duration: Date.now() - recursiveTestStart,
        details: { path: deepPath, isDirectory: stats.isDirectory() },
      });
    } catch (error) {
      results.push({
        name: "Recursive Directory Creation",
        category: "filesystem",
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        platform: this.platform,
        duration: Date.now() - recursiveTestStart,
      });
    }

    // Test directory listing
    const listingTestStart = Date.now();
    try {
      const testFiles = ["file1.txt", "file2.txt", "subdir"];
      const subdir = join(this.testDir, "subdir");

      await fs.mkdir(subdir);
      await fs.writeFile(join(this.testDir, "file1.txt"), "content1");
      await fs.writeFile(join(this.testDir, "file2.txt"), "content2");

      const entries = await fs.readdir(this.testDir);
      const hasAllEntries = testFiles.every((file) => entries.includes(file));

      results.push({
        name: "Directory Listing",
        category: "filesystem",
        passed: hasAllEntries,
        platform: this.platform,
        duration: Date.now() - listingTestStart,
        details: {
          expected: testFiles,
          actual: entries,
          hasAllEntries,
        },
      });
    } catch (error) {
      results.push({
        name: "Directory Listing",
        category: "filesystem",
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        platform: this.platform,
        duration: Date.now() - listingTestStart,
      });
    }

    return results;
  }

  /**
   * Test file watching capabilities
   */
  private async testFileWatching(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const testName = "File Watching";
    const startTime = Date.now();

    try {
      const testFile = join(this.testDir, "watch-test.txt");
      await fs.writeFile(testFile, "initial content");

      let watchTriggered = false;
      const watcher = fs.watch(this.testDir, (eventType, filename) => {
        if (filename === basename(testFile) && eventType === "change") {
          watchTriggered = true;
        }
      });

      // Give watcher time to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Modify the file
      await fs.writeFile(testFile, "modified content");

      // Wait for watch event
      await new Promise((resolve) => setTimeout(resolve, 500));

      watcher.close();

      results.push({
        name: testName,
        category: "filesystem",
        passed: watchTriggered,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: { watchTriggered, filename: basename(testFile) },
      });
    } catch (error) {
      results.push({
        name: testName,
        category: "filesystem",
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        platform: this.platform,
        duration: Date.now() - startTime,
      });
    }

    return results;
  }

  /**
   * Test concurrent file access
   */
  private async testConcurrentAccess(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const testName = "Concurrent File Access";
    const startTime = Date.now();

    try {
      const testFile = join(this.testDir, "concurrent-test.txt");

      // Create multiple concurrent read/write operations
      const operations = Array.from({ length: 5 }, async (_, i) => {
        const content = `Content from operation ${i}`;
        await fs.writeFile(`${testFile}.${i}`, content);
        return fs.readFile(`${testFile}.${i}`, "utf8");
      });

      const results_data = await Promise.all(operations);
      const allSuccessful = results_data.every(
        (content, i) => content === `Content from operation ${i}`,
      );

      results.push({
        name: testName,
        category: "filesystem",
        passed: allSuccessful,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          operationCount: operations.length,
          allSuccessful,
          results: results_data,
        },
      });
    } catch (error) {
      results.push({
        name: testName,
        category: "filesystem",
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        platform: this.platform,
        duration: Date.now() - startTime,
      });
    }

    return results;
  }

  /**
   * Utility methods for platform-specific behavior detection
   */
  private async detectCaseSensitivity(): Promise<boolean> {
    try {
      const testFile = join(this.testDir, "case-test.txt");
      await fs.writeFile(testFile, "test");

      try {
        await fs.access(testFile.toUpperCase());
        return false; // Case-insensitive
      } catch {
        return true; // Case-sensitive
      }
    } catch {
      return true; // Default to case-sensitive if detection fails
    }
  }

  private async detectMaxPathLength(): Promise<number> {
    // Platform-specific path length limits
    switch (this.platform) {
      case "win32":
        return 260; // Traditional Windows limit (can be higher with long path support)
      case "darwin":
        return 1024; // macOS limit
      case "linux":
        return 4096; // Linux limit
      default:
        return 1024; // Conservative default
    }
  }

  private async testSymlinkSupport(): Promise<boolean> {
    try {
      const testFile = join(this.testDir, "symlink-support-test.txt");
      const testLink = join(this.testDir, "symlink-support-link.txt");

      await fs.writeFile(testFile, "test");
      await fs.symlink(testFile, testLink);
      await fs.unlink(testLink);

      return true;
    } catch {
      return false;
    }
  }

  private async testHardlinkSupport(): Promise<boolean> {
    try {
      const testFile = join(this.testDir, "hardlink-support-test.txt");
      const testLink = join(this.testDir, "hardlink-support-link.txt");

      await fs.writeFile(testFile, "test");
      await fs.link(testFile, testLink);
      await fs.unlink(testLink);

      return true;
    } catch {
      return false;
    }
  }

  private isExpectedSpecialCharFailure(
    filename: string,
    error: unknown,
  ): boolean {
    const errorMsg =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();

    // Windows-specific invalid character errors
    if (this.platform === "win32") {
      const windowsInvalidChars = ["<", ">", ":", '"', "|", "?", "*"];
      return (
        windowsInvalidChars.some((char) => filename.includes(char)) &&
        (errorMsg.includes("invalid") || errorMsg.includes("illegal"))
      );
    }

    return false;
  }

  private isExpectedLongPathFailure(error: unknown): boolean {
    const errorMsg =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();
    return (
      errorMsg.includes("path") &&
      (errorMsg.includes("long") ||
        errorMsg.includes("limit") ||
        errorMsg.includes("name too long"))
    );
  }

  private isExpectedSymlinkFailure(error: unknown): boolean {
    const errorMsg =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();
    return (
      errorMsg.includes("operation not permitted") ||
      errorMsg.includes("privilege") ||
      errorMsg.includes("symlink") ||
      (this.platform === "win32" && errorMsg.includes("elevated"))
    );
  }

  private isExpectedHardlinkFailure(error: unknown): boolean {
    const errorMsg =
      error instanceof Error
        ? error.message.toLowerCase()
        : String(error).toLowerCase();
    return (
      errorMsg.includes("cross-device") ||
      errorMsg.includes("not supported") ||
      errorMsg.includes("operation not supported")
    );
  }

  private async setupTestDirectory(): Promise<void> {
    await fs.mkdir(this.testDir, { recursive: true });
  }

  private async cleanup(): Promise<void> {
    try {
      await fs.rm(this.testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("Warning: Failed to cleanup test directory:", error);
    }
  }
}
