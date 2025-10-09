/**
 * @fileoverview Advanced license scanner with SPDX support and complex expression parsing
 */

import { promises as fs } from "fs";
import { join, dirname } from "path";
import type { LicenseInfo, DependencyLicense } from "./types.js";
import type { LicenseDatabase } from "./LicenseDatabase.js";

/**
 * License header pattern matching for custom license detection
 */
interface LicensePattern {
  name: string;
  spdxId: string;
  patterns: RegExp[];
  confidence: number;
}

/**
 * Custom license detection result
 */
interface CustomLicenseMatch {
  spdxId: string;
  confidence: number;
  matchedPattern: string;
  location: { file: string; line: number; column: number };
}

/**
 * Advanced license scanning with SPDX support and complex expression parsing
 */
export class AdvancedLicenseScanner {
  private database: LicenseDatabase;
  private licensePatterns: LicensePattern[] = [];
  private watchedDirectories: Set<string> = new Set();
  private changeCallbacks: ((changes: LicenseChangeEvent[]) => void)[] = [];

  constructor(database: LicenseDatabase) {
    this.database = database;
    this.initializeLicensePatterns();
  }

  /**
   * Enhanced license scanning with custom detection
   */
  async scanLicensesAdvanced(
    packagePath: string,
  ): Promise<EnhancedLicenseScanResult> {
    const packageJson = await this.readPackageJson(packagePath);
    if (!packageJson) {
      return {
        licenses: [],
        customLicenses: [],
        complexExpressions: [],
        copyrightHolders: [],
        licenseFiles: [],
        totalDependencies: 0,
        scanTimestamp: new Date(),
        errors: [`Could not read package.json at ${packagePath}`],
      };
    }

    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
      ...packageJson.optionalDependencies,
    };

    const results: DependencyLicense[] = [];
    const customLicenses: CustomLicenseMatch[] = [];
    const complexExpressions: ComplexLicenseExpression[] = [];
    const copyrightHolders: Set<string> = new Set();
    const licenseFiles: string[] = [];
    const errors: string[] = [];

    const packageDir = dirname(packagePath);
    const nodeModulesPath = join(packageDir, "node_modules");

    // Scan direct license files in project
    const projectLicenseFiles = await this.findLicenseFiles(packageDir);
    licenseFiles.push(...projectLicenseFiles);

    // Process project license files for custom licenses
    for (const file of projectLicenseFiles) {
      const customMatches = await this.detectCustomLicenses(file);
      customLicenses.push(...customMatches);

      const copyrights = await this.extractCopyrightHolders(file);
      copyrights.forEach((c) => copyrightHolders.add(c));
    }

    // Process each dependency
    for (const [name, version] of Object.entries(dependencies)) {
      try {
        const depPath = join(nodeModulesPath, name);
        const depPackageJson = await this.readPackageJson(
          join(depPath, "package.json"),
        );

        if (!depPackageJson) {
          continue;
        }

        const license = await this.processDependencyLicense(
          name,
          String(version),
          depPath,
          depPackageJson,
        );
        if (license) {
          results.push(license);

          // Check for complex expressions
          if (license.licenseFile) {
            try {
              const licenseContent = await fs.readFile(
                license.licenseFile,
                "utf-8",
              );
              if (this.isComplexExpression(licenseContent)) {
                const complexExpr = await this.parseComplexExpression(
                  licenseContent,
                  name,
                );
                if (complexExpr) {
                  complexExpressions.push(complexExpr);
                }
              }
            } catch (error) {
              // Ignore file read errors
            }
          }

          // Add copyright holders
          license.copyrightHolders.forEach((c) => copyrightHolders.add(c));
        }
      } catch (error) {
        errors.push(
          `Error processing ${name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return {
      licenses: results,
      customLicenses,
      complexExpressions,
      copyrightHolders: Array.from(copyrightHolders),
      licenseFiles,
      totalDependencies: Object.keys(dependencies).length,
      scanTimestamp: new Date(),
      errors,
    };
  }

  /**
   * Parse complex SPDX license expressions (AND, OR, WITH operators)
   */
  async parseComplexExpression(
    expression: string,
    packageName: string,
  ): Promise<ComplexLicenseExpression | null> {
    const normalized = expression.trim();

    // Detect expression type
    let operator: "AND" | "OR" | "WITH" | null = null;
    let parts: string[] = [];

    if (normalized.includes(" OR ")) {
      operator = "OR";
      parts = this.splitExpression(normalized, " OR ");
    } else if (normalized.includes(" AND ")) {
      operator = "AND";
      parts = this.splitExpression(normalized, " AND ");
    } else if (normalized.includes(" WITH ")) {
      operator = "WITH";
      parts = this.splitExpression(normalized, " WITH ");
    } else {
      // Simple expression
      const license = this.database.getLicense(normalized);
      if (license) {
        return {
          expression: normalized,
          operator: null,
          licenses: [license],
          isValid: true,
          packageName,
          interpretation: `Simple license: ${license.name}`,
        };
      }
      return null;
    }

    // Process complex expression
    const licenses: LicenseInfo[] = [];
    let isValid = true;

    for (const part of parts) {
      const cleanPart = part.trim().replace(/[()]/g, "");
      const license = this.database.getLicense(cleanPart);
      if (license) {
        licenses.push(license);
      } else {
        isValid = false;
      }
    }

    let interpretation = "";
    if (operator === "OR") {
      interpretation = "Choose any one of the listed licenses";
    } else if (operator === "AND") {
      interpretation = "Must comply with all listed licenses simultaneously";
    } else if (operator === "WITH") {
      interpretation =
        "Primary license with additional exception or modification";
    }

    return {
      expression: normalized,
      operator,
      licenses,
      isValid,
      packageName,
      interpretation,
    };
  }

  /**
   * Monitor license changes in directories
   */
  async startLicenseMonitoring(directories: string[]): Promise<void> {
    const fs = await import("fs");
    const path = await import("path");

    for (const dir of directories) {
      if (this.watchedDirectories.has(dir)) {
        continue; // Already watching
      }

      this.watchedDirectories.add(dir);

      try {
        // Watch for changes to license files
        const watcher = fs.watch(
          dir,
          { recursive: true },
          async (eventType, filename) => {
            if (!filename) return;

            const fullPath = path.join(dir, filename);
            const basename = path.basename(filename);

            // Check if it's a license-related file
            const licenseFiles = [
              "LICENSE",
              "LICENSE.md",
              "LICENSE.txt",
              "COPYING",
              "package.json",
            ];
            const isLicenseFile = licenseFiles.some((lf) =>
              basename.toUpperCase().includes(lf.toUpperCase()),
            );

            if (isLicenseFile && (eventType === "change" || eventType === "rename")) {
              const changes: LicenseChangeEvent[] = [];

              try {
                // Detect what changed
                if (eventType === "change") {
                  changes.push({
                    type: "modified",
                    path: fullPath,
                    timestamp: new Date(),
                    oldLicense: undefined,
                    newLicense: undefined,
                  });
                } else if (eventType === "rename") {
                  changes.push({
                    type: "added",
                    path: fullPath,
                    timestamp: new Date(),
                    newLicense: undefined,
                  });
                }

                // Notify all registered callbacks
                for (const callback of this.changeCallbacks) {
                  try {
                    callback(changes);
                  } catch (error) {
                    console.error("Error in license change callback:", error);
                  }
                }
              } catch (error) {
                console.error("Error processing license change:", error);
              }
            }
          },
        );

        // Store watcher for cleanup
        if (!this.watchers) {
          this.watchers = [];
        }
        this.watchers.push(watcher);

        console.log(`License monitoring started for directory: ${dir}`);
      } catch (error) {
        console.error(`Failed to watch directory ${dir}:`, error);
      }
    }

    console.log(
      `License monitoring active for ${this.watchedDirectories.size} directories`,
    );
  }

  /**
   * Stop monitoring license changes
   */
  async stopLicenseMonitoring(): Promise<void> {
    // Close all file watchers
    if ((this as any).watchers) {
      for (const watcher of (this as any).watchers) {
        try {
          watcher.close();
        } catch (_error) {
          // Ignore errors when closing watchers
        }
      }
      (this as any).watchers = [];
    }

    this.watchedDirectories.clear();
    this.changeCallbacks.length = 0;
    console.log("License monitoring stopped");
  }

  /**
   * Register callback for license changes
   */
  onLicenseChange(callback: (changes: LicenseChangeEvent[]) => void): void {
    this.changeCallbacks.push(callback);
  }

  /**
   * Detect custom or unknown licenses in files
   */
  private async detectCustomLicenses(
    filePath: string,
  ): Promise<CustomLicenseMatch[]> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");
      const matches: CustomLicenseMatch[] = [];

      for (const pattern of this.licensePatterns) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) {
            continue;
          }

          for (const regex of pattern.patterns) {
            const match = regex.exec(line);
            if (match) {
              matches.push({
                spdxId: pattern.spdxId,
                confidence: pattern.confidence,
                matchedPattern: match[0],
                location: {
                  file: filePath,
                  line: i + 1,
                  column: match.index || 0,
                },
              });
            }
          }
        }
      }

      return matches;
    } catch (error) {
      return [];
    }
  }

  /**
   * Initialize license detection patterns
   */
  private initializeLicensePatterns(): void {
    this.licensePatterns = [
      {
        name: "MIT License",
        spdxId: "MIT",
        patterns: [
          /Permission is hereby granted, free of charge/i,
          /MIT License/i,
          /THE SOFTWARE IS PROVIDED "AS IS"/i,
        ],
        confidence: 0.95,
      },
      {
        name: "Apache License 2.0",
        spdxId: "Apache-2.0",
        patterns: [
          /Licensed under the Apache License, Version 2\.0/i,
          /Apache License\s*Version 2\.0/i,
          /www\.apache\.org\/licenses\/LICENSE-2\.0/i,
        ],
        confidence: 0.95,
      },
      {
        name: "GPL-3.0",
        spdxId: "GPL-3.0",
        patterns: [
          /GNU GENERAL PUBLIC LICENSE\s*Version 3/i,
          /GPL-3\.0/i,
          /www\.gnu\.org\/licenses\/gpl-3\.0/i,
        ],
        confidence: 0.9,
      },
      {
        name: "BSD-3-Clause",
        spdxId: "BSD-3-Clause",
        patterns: [
          /BSD 3-Clause/i,
          /Redistributions of source code must retain/i,
          /Neither the name of.*nor the names/i,
        ],
        confidence: 0.9,
      },
      {
        name: "ISC License",
        spdxId: "ISC",
        patterns: [
          /ISC License/i,
          /Permission to use, copy, modify, and\/or distribute/i,
        ],
        confidence: 0.95,
      },
    ];
  }

  /**
   * Split complex expressions while respecting parentheses
   */
  private splitExpression(expression: string, delimiter: string): string[] {
    const parts: string[] = [];
    let currentPart = "";
    let parenDepth = 0;
    let i = 0;

    while (i < expression.length) {
      const char = expression[i];

      if (char === "(") {
        parenDepth++;
        currentPart += char;
      } else if (char === ")") {
        parenDepth--;
        currentPart += char;
      } else if (
        parenDepth === 0 &&
        expression.substring(i, i + delimiter.length) === delimiter
      ) {
        parts.push(currentPart.trim());
        currentPart = "";
        i += delimiter.length - 1;
      } else {
        currentPart += char;
      }

      i++;
    }

    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }

    return parts;
  }

  /**
   * Check if expression contains complex operators
   */
  private isComplexExpression(expression: string): boolean {
    return (
      expression.includes(" AND ") ||
      expression.includes(" OR ") ||
      expression.includes(" WITH ") ||
      expression.includes("(") ||
      expression.includes(")")
    );
  }

  /**
   * Extract copyright holders from file content
   */
  private async extractCopyrightHolders(filePath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const copyrightPatterns = [
        /Copyright\s*\(c\)\s*(\d{4}(?:-\d{4})?)\s*(.+?)(?:\n|$)/gi,
        /Copyright\s*(\d{4}(?:-\d{4})?)\s*(.+?)(?:\n|$)/gi,
        /©\s*(\d{4}(?:-\d{4})?)\s*(.+?)(?:\n|$)/gi,
      ];

      const holders: Set<string> = new Set();

      for (const pattern of copyrightPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const holder = match[2]?.trim();
          if (holder && holder.length > 0 && holder.length < 200) {
            holders.add(holder);
          }
        }
      }

      return Array.from(holders);
    } catch (error) {
      return [];
    }
  }

  /**
   * Find license files in directory
   */
  private async findLicenseFiles(dir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir);
      const licenseFiles: string[] = [];

      const licenseFileNames = [
        "LICENSE",
        "LICENSE.txt",
        "LICENSE.md",
        "LICENCE",
        "LICENCE.txt",
        "LICENCE.md",
        "COPYING",
        "COPYING.txt",
        "COPYRIGHT",
        "COPYRIGHT.txt",
      ];

      for (const entry of entries) {
        if (
          licenseFileNames.some(
            (name) => entry.toUpperCase() === name.toUpperCase(),
          )
        ) {
          licenseFiles.push(join(dir, entry));
        }
      }

      return licenseFiles;
    } catch (error) {
      return [];
    }
  }

  /**
   * Read and parse package.json
   */
  private async readPackageJson(path: string): Promise<any | null> {
    try {
      const content = await fs.readFile(path, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Process individual dependency license
   */
  private async processDependencyLicense(
    name: string,
    version: string,
    depPath: string,
    packageJson: any,
  ): Promise<DependencyLicense | null> {
    const licenseFiles = await this.findLicenseFiles(depPath);
    const copyrightHolders = [];

    // Extract copyrights from license files
    for (const file of licenseFiles) {
      const copyrights = await this.extractCopyrightHolders(file);
      copyrightHolders.push(...copyrights);
    }

    const license = packageJson.license || "Unknown";
    let licenseInfo: LicenseInfo | null = null;
    let licenseText = "";

    // Try to get license information from database
    if (license !== "Unknown") {
      licenseInfo = this.database.getLicense(license);
    }

    // Read license text from files
    if (licenseFiles.length > 0 && licenseFiles[0]) {
      try {
        licenseText = await fs.readFile(licenseFiles[0], "utf-8");
      } catch (error) {
        // Ignore read errors
      }
    }

    return {
      packageName: name,
      version,
      license: licenseInfo || {
        name: license,
        spdxId: license,
        url: "",
        text: licenseText,
        permissions: [],
        conditions: [],
        limitations: [],
        compatibility: {
          compatibleWith: [],
          incompatibleWith: [],
          requiresNotice: true,
          requiresSourceDisclosure: false,
          allowsLinking: true,
          isCopeyleft: false,
          copyleftScope: null,
        },
      },
      licenseFile: licenseFiles[0] || undefined,
      noticeFile: undefined,
      copyrightHolders: Array.from(new Set(copyrightHolders)),
      attributionRequired: licenseInfo?.compatibility.requiresNotice ?? true,
      sourceUrl: packageJson.repository?.url || packageJson.homepage || "",
    };
  }
}

/**
 * Enhanced scan result with advanced analysis
 */
export interface EnhancedLicenseScanResult {
  licenses: DependencyLicense[];
  customLicenses: CustomLicenseMatch[];
  complexExpressions: ComplexLicenseExpression[];
  copyrightHolders: string[];
  licenseFiles: string[];
  totalDependencies: number;
  scanTimestamp: Date;
  errors: string[];
}

/**
 * Complex license expression analysis
 */
export interface ComplexLicenseExpression {
  expression: string;
  operator: "AND" | "OR" | "WITH" | null;
  licenses: LicenseInfo[];
  isValid: boolean;
  packageName: string;
  interpretation: string;
}

/**
 * License change monitoring event
 */
export interface LicenseChangeEvent {
  type: "added" | "modified" | "removed";
  filePath: string;
  timestamp: Date;
  oldLicense?: string;
  newLicense?: string;
}
