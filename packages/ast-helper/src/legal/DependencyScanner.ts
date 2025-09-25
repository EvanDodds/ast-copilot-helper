/**
 * @fileoverview Dependency scanner for analyzing package.json files and extracting license information
 */

import { promises as fs } from "fs";
import { join } from "path";
import type { LicenseInfo, ComplianceConfig } from "./types.js";
import { LicenseDatabase } from "./LicenseDatabase.js";

export interface PackageInfo {
  name: string;
  version: string;
  license?: string;
  licenses?: Array<{ type: string; url?: string }> | string;
  repository?: {
    type: string;
    url: string;
  };
  homepage?: string;
  author?: string | { name: string; email?: string; url?: string };
  contributors?: Array<string | { name: string; email?: string; url?: string }>;
  licenseFile?: string;
  noticeFile?: string;
}

/**
 * Scans project dependencies and extracts license information
 */
export class DependencyScanner {
  private licenseDatabase: LicenseDatabase;
  private packageCache: Map<string, PackageInfo> = new Map();

  constructor(_config: ComplianceConfig) {
    // Config available for future use
    this.licenseDatabase = new LicenseDatabase();
  }

  async initialize(): Promise<void> {
    await this.licenseDatabase.initialize();
  }

  /**
   * Find all package.json files in the project
   */
  async findPackageFiles(rootPath: string = process.cwd()): Promise<string[]> {
    const packageFiles: string[] = [];
    await this.searchPackageFiles(rootPath, packageFiles);
    return packageFiles;
  }

  /**
   * Get package information from npm registry or local cache
   */
  async getPackageInfo(
    packageName: string,
    version: string,
  ): Promise<PackageInfo> {
    const cacheKey = `${packageName}@${version}`;

    if (this.packageCache.has(cacheKey)) {
      return this.packageCache.get(cacheKey)!;
    }

    try {
      // First try to read from node_modules
      const localInfo = await this.getLocalPackageInfo(packageName);
      if (localInfo) {
        this.packageCache.set(cacheKey, localInfo);
        return localInfo;
      }

      // Fallback to npm registry
      const registryInfo = await this.getNpmPackageInfo(packageName, version);
      this.packageCache.set(cacheKey, registryInfo);
      return registryInfo;
    } catch (error) {
      console.warn(
        `Failed to get package info for ${packageName}@${version}:`,
        error,
      );

      // Return minimal info as fallback
      const fallbackInfo: PackageInfo = {
        name: packageName,
        version,
        license: "UNKNOWN",
      };

      this.packageCache.set(cacheKey, fallbackInfo);
      return fallbackInfo;
    }
  }

  /**
   * Extract license information from a license string or object
   */
  async parseLicenseString(licenseData: string | object): Promise<LicenseInfo> {
    let licenseId: string;

    if (typeof licenseData === "string") {
      licenseId = licenseData;
    } else if (typeof licenseData === "object" && licenseData !== null) {
      const licenseObj = licenseData as any;
      licenseId =
        licenseObj.type || licenseObj.name || licenseObj.license || "UNKNOWN";
    } else {
      licenseId = "UNKNOWN";
    }

    // Handle complex license expressions
    const parseResult = this.licenseDatabase.parseLicenseExpression(licenseId);

    if (parseResult.valid && parseResult.licenses.length > 0) {
      // Return the primary license (first one for OR expressions)
      const primaryLicense = parseResult.licenses[0];
      if (primaryLicense) {
        return primaryLicense;
      }
    }

    // Create unknown license info
    return this.createUnknownLicenseInfo(licenseId);
  }

  /**
   * Extract copyright holders from package metadata
   */
  async extractCopyrightHolders(
    packageInfo: PackageInfo,
    packageName: string,
  ): Promise<string[]> {
    const holders: string[] = [];

    // Extract from author
    if (packageInfo.author) {
      if (typeof packageInfo.author === "string") {
        holders.push(packageInfo.author);
      } else if (packageInfo.author.name) {
        holders.push(packageInfo.author.name);
      }
    }

    // Extract from contributors
    if (packageInfo.contributors) {
      for (const contributor of packageInfo.contributors) {
        if (typeof contributor === "string") {
          holders.push(contributor);
        } else if (contributor.name) {
          holders.push(contributor.name);
        }
      }
    }

    // Try to extract from license files
    const licenseFileHolders =
      await this.extractCopyrightFromFiles(packageName);
    holders.push(...licenseFileHolders);

    // Remove duplicates and empty entries
    return Array.from(new Set(holders.filter((h) => h && h.trim())));
  }

  /**
   * Find license file for a package
   */
  async findLicenseFile(packageName: string): Promise<string | null> {
    const possiblePaths = [
      `node_modules/${packageName}/LICENSE`,
      `node_modules/${packageName}/LICENSE.md`,
      `node_modules/${packageName}/LICENSE.txt`,
      `node_modules/${packageName}/LICENCE`,
      `node_modules/${packageName}/LICENCE.md`,
      `node_modules/${packageName}/LICENCE.txt`,
      `node_modules/${packageName}/COPYING`,
      `node_modules/${packageName}/COPYING.md`,
    ];

    for (const path of possiblePaths) {
      try {
        await fs.access(path);
        return path;
      } catch {
        // File doesn't exist, continue
      }
    }

    return null;
  }

  private async searchPackageFiles(
    dir: string,
    results: string[],
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.name === "package.json") {
          results.push(fullPath);
        } else if (
          entry.isDirectory() &&
          entry.name !== "node_modules" &&
          !entry.name.startsWith(".")
        ) {
          await this.searchPackageFiles(fullPath, results);
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Cannot read directory ${dir}:`, error);
    }
  }

  private async getLocalPackageInfo(
    packageName: string,
  ): Promise<PackageInfo | null> {
    const packageJsonPath = join(
      process.cwd(),
      "node_modules",
      packageName,
      "package.json",
    );

    try {
      const content = await fs.readFile(packageJsonPath, "utf8");
      const packageJson = JSON.parse(content);

      // Look for license files
      const licenseFile = await this.findLicenseFile(packageName);

      return {
        name: packageJson.name || packageName,
        version: packageJson.version || "unknown",
        license: packageJson.license,
        licenses: packageJson.licenses,
        repository: packageJson.repository,
        homepage: packageJson.homepage,
        author: packageJson.author,
        contributors: packageJson.contributors,
        licenseFile: licenseFile || undefined,
      };
    } catch (error) {
      return null;
    }
  }

  private async getNpmPackageInfo(
    packageName: string,
    version: string,
  ): Promise<PackageInfo> {
    // In a real implementation, this would make an HTTP request to the npm registry
    // For now, we'll return basic info
    console.warn(
      `NPM registry lookup not implemented for ${packageName}@${version}`,
    );

    return {
      name: packageName,
      version,
      license: "UNKNOWN",
    };
  }

  private createUnknownLicenseInfo(licenseId: string): LicenseInfo {
    return {
      name: licenseId || "Unknown License",
      spdxId: licenseId || "UNKNOWN",
      url: "",
      text: "License text not available",
      permissions: [],
      conditions: [],
      limitations: [],
      compatibility: {
        compatibleWith: [],
        incompatibleWith: [],
        requiresNotice: true, // err on the side of caution
        requiresSourceDisclosure: false,
        allowsLinking: true,
        isCopeyleft: false,
        copyleftScope: null,
      },
    };
  }

  private async extractCopyrightFromFiles(
    packageName: string,
  ): Promise<string[]> {
    const holders: string[] = [];
    const licenseFile = await this.findLicenseFile(packageName);

    if (!licenseFile) {
      return holders;
    }

    try {
      const content = await fs.readFile(licenseFile, "utf8");

      // Look for copyright statements
      const copyrightRegex =
        /Copyright\s*(?:\(c\))?\s*(\d{4}(?:-\d{4})?)\s+(.+?)(?:\n|$)/gi;
      let match;

      while ((match = copyrightRegex.exec(content)) !== null) {
        const holder = match[2]?.trim();
        if (
          holder &&
          !holder.includes("THE SOFTWARE") &&
          !holder.includes("AUTHORS OR COPYRIGHT HOLDERS")
        ) {
          holders.push(holder);
        }
      }
    } catch (error) {
      console.warn(`Failed to read license file ${licenseFile}:`, error);
    }

    return holders;
  }
}
