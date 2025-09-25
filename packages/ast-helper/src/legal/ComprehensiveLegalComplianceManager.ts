/**
 * @fileoverview Main legal compliance manager implementing comprehensive license compliance
 */

import { promises as fs } from "fs";
import { join } from "path";
import type {
  LegalComplianceManager,
  ComplianceConfig,
  LicenseScanResult,
  AttributionResult,
  CompatibilityResult,
  ComplianceReport,
  DocumentationResult,
  DocumentationFile,
  MonitoringResult,
  DependencyLicense,
  LicenseScanIssue,
  CompatibilityIssue,
  ComplianceSummary,
  AttributionDocument,
  LicenseType,
} from "./types.js";
import { LicenseDatabase } from "./LicenseDatabase.js";
import { DependencyScanner } from "./DependencyScanner.js";
import { AttributionGenerator } from "./AttributionGenerator.js";

/**
 * Comprehensive legal compliance manager for the ast-copilot-helper project
 */
export class ComprehensiveLegalComplianceManager
  implements LegalComplianceManager
{
  private config!: ComplianceConfig;
  private licenseDatabase!: LicenseDatabase;
  private dependencyScanner!: DependencyScanner;
  private attributionGenerator!: AttributionGenerator;

  async initialize(config: ComplianceConfig): Promise<void> {
    this.config = config;

    console.log("Initializing legal compliance manager...");

    // Initialize license database with SPDX data
    this.licenseDatabase = new LicenseDatabase();
    await this.licenseDatabase.initialize();

    // Setup dependency scanner
    this.dependencyScanner = new DependencyScanner(config);
    await this.dependencyScanner.initialize();

    // Initialize attribution generator
    this.attributionGenerator = new AttributionGenerator(
      config.attributionRequirements,
    );
    await this.attributionGenerator.initialize();

    // Validate project license
    await this.validateProjectLicense();

    console.log("Legal compliance manager initialized successfully");
  }

  async scanDependencyLicenses(): Promise<LicenseScanResult> {
    console.log("Scanning dependency licenses...");
    const startTime = Date.now();

    try {
      // 1. Scan all package.json files in monorepo
      const packageFiles = await this.dependencyScanner.findPackageFiles();
      console.log(`Found ${packageFiles.length} package.json files`);

      const dependencyLicenses: DependencyLicense[] = [];
      const scanIssues: LicenseScanIssue[] = [];

      for (const packageFile of packageFiles) {
        console.log(`Scanning dependencies in ${packageFile}...`);

        // 2. Load package dependencies
        const packageData = JSON.parse(await fs.readFile(packageFile, "utf8"));
        const dependencies = {
          ...packageData.dependencies,
          ...packageData.devDependencies,
          ...packageData.peerDependencies,
        };

        // 3. Scan each dependency
        for (const [depName, depVersion] of Object.entries(dependencies)) {
          try {
            const licenseInfo = await this.scanDependencyLicense(
              depName,
              depVersion as string,
            );
            dependencyLicenses.push(licenseInfo);

            // 4. Check license compatibility
            const compatibilityIssue =
              await this.checkLicenseCompatibility(licenseInfo);
            if (compatibilityIssue) {
              scanIssues.push(compatibilityIssue);
            }
          } catch (error) {
            scanIssues.push({
              type: "scan_error",
              severity: "high",
              packageName: depName,
              version: depVersion as string,
              message: `Failed to scan license: ${(error as Error).message}`,
            });
          }
        }
      }

      // 5. Generate license summary
      const licenseSummary = this.generateLicenseSummary(dependencyLicenses);

      // 6. Identify attribution requirements
      const attributionRequired = dependencyLicenses.filter(
        (dep) => dep.attributionRequired,
      );

      const result: LicenseScanResult = {
        totalDependencies: dependencyLicenses.length,
        dependencies: dependencyLicenses,
        licenseSummary,
        attributionRequired: attributionRequired.length,
        issues: scanIssues,
        duration: Date.now() - startTime,
        success:
          scanIssues.filter(
            (i) => i.severity === "critical" || i.severity === "high",
          ).length === 0,
      };

      console.log(
        `License scan completed: ${result.totalDependencies} dependencies, ${result.issues.length} issues`,
      );

      return result;
    } catch (error) {
      console.error("License scanning failed:", error);

      return {
        totalDependencies: 0,
        dependencies: [],
        licenseSummary: new Map(),
        attributionRequired: 0,
        issues: [
          {
            type: "system_error",
            severity: "critical",
            packageName: "system",
            version: "unknown",
            message: `License scanning failed: ${(error as Error).message}`,
          },
        ],
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async generateAttributions(): Promise<AttributionResult> {
    console.log("Generating license attributions...");
    const startTime = Date.now();

    try {
      // 1. Scan all dependencies
      const scanResult = await this.scanDependencyLicenses();

      if (!scanResult.success) {
        throw new Error("License scan failed, cannot generate attributions");
      }

      // 2. Filter dependencies that require attribution
      const attributionDependencies = scanResult.dependencies.filter(
        (dep) => dep.attributionRequired,
      );
      console.log(
        `Found ${attributionDependencies.length} dependencies requiring attribution`,
      );

      // 3. Generate attribution documents
      const attributions: AttributionDocument[] = [];

      if (this.config.attributionRequirements.generateNotice) {
        const noticeFile = await this.attributionGenerator.generateNoticeFile(
          attributionDependencies,
        );
        attributions.push(noticeFile);
      }

      if (this.config.attributionRequirements.generateThirdPartyLicense) {
        const thirdPartyLicense =
          await this.attributionGenerator.generateThirdPartyLicenseFile(
            attributionDependencies,
          );
        attributions.push(thirdPartyLicense);
      }

      if (this.config.attributionRequirements.generateCredits) {
        const creditsFile = await this.attributionGenerator.generateCreditsFile(
          attributionDependencies,
        );
        attributions.push(creditsFile);
      }

      if (this.config.attributionRequirements.generateMetadata) {
        const metadataFile =
          await this.attributionGenerator.generateLicenseMetadata(
            attributionDependencies,
          );
        attributions.push(metadataFile);
      }

      // 4. Apply custom template if configured
      const customAttribution =
        await this.attributionGenerator.applyCustomTemplate(
          attributionDependencies,
        );
      if (customAttribution) {
        attributions.push(customAttribution);
      }

      // 5. Write attribution files
      for (const attribution of attributions) {
        const outputPath = join(
          this.config.attributionRequirements.outputDirectory,
          attribution.filename,
        );
        await fs.writeFile(outputPath, attribution.content, "utf8");
        console.log(`Generated attribution file: ${outputPath}`);
      }

      const result: AttributionResult = {
        attributions,
        dependenciesAttributed: attributionDependencies.length,
        duration: Date.now() - startTime,
        success: true,
      };

      console.log(
        `Attribution generation completed: ${result.dependenciesAttributed} dependencies attributed`,
      );

      return result;
    } catch (error) {
      console.error("Attribution generation failed:", error);

      return {
        attributions: [],
        dependenciesAttributed: 0,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async validateLicenseCompatibility(): Promise<CompatibilityResult> {
    console.log("Validating license compatibility...");
    const startTime = Date.now();

    try {
      // 1. Get project license
      const projectLicense = this.config.projectLicense;
      console.log(`Project license: ${projectLicense}`);

      // 2. Scan dependency licenses
      const scanResult = await this.scanDependencyLicenses();

      if (!scanResult.success) {
        throw new Error("Cannot validate compatibility: license scan failed");
      }

      const compatibilityIssues: CompatibilityIssue[] = [];
      const compatibleLicenses: string[] = [];

      // 3. Check each dependency license against project license
      for (const dep of scanResult.dependencies) {
        const compatibility = await this.checkLicenseCompatibilityWith(
          dep.license,
          projectLicense,
        );

        if (compatibility.compatible) {
          compatibleLicenses.push(dep.license.spdxId || dep.license.name);
        } else {
          compatibilityIssues.push({
            packageName: dep.packageName,
            version: dep.version,
            dependencyLicense: dep.license,
            projectLicense,
            issue: compatibility.issue || "License incompatibility detected",
            severity: compatibility.severity || "medium",
            recommendation:
              compatibility.recommendation ||
              "Review license compatibility manually",
          });
        }
      }

      // 4. Check for restricted licenses
      const restrictedLicenses = scanResult.dependencies.filter(
        (dep) =>
          this.config.restrictedLicenses.includes(
            dep.license.spdxId as LicenseType,
          ) ||
          this.config.restrictedLicenses.includes(
            dep.license.name as LicenseType,
          ),
      );

      for (const dep of restrictedLicenses) {
        compatibilityIssues.push({
          packageName: dep.packageName,
          version: dep.version,
          dependencyLicense: dep.license,
          projectLicense,
          issue: `License ${dep.license.name} is restricted by project policy`,
          severity: "high",
          recommendation: "Replace dependency or obtain license exception",
        });
      }

      const result: CompatibilityResult = {
        compatible: compatibilityIssues.length === 0,
        issues: compatibilityIssues,
        compatibleLicenses: Array.from(new Set(compatibleLicenses)),
        totalDependencies: scanResult.totalDependencies,
        duration: Date.now() - startTime,
        success: true,
      };

      if (result.compatible) {
        console.log(
          `License compatibility validation passed: all ${result.totalDependencies} dependencies compatible`,
        );
      } else {
        console.warn(
          `License compatibility issues found: ${result.issues.length} incompatible dependencies`,
        );
      }

      return result;
    } catch (error) {
      console.error("License compatibility validation failed:", error);

      return {
        compatible: false,
        issues: [],
        compatibleLicenses: [],
        totalDependencies: 0,
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async generateComplianceReport(): Promise<ComplianceReport> {
    console.log("Generating compliance report...");
    const startTime = Date.now();

    try {
      // 1. Perform comprehensive compliance audit
      const licenseScan = await this.scanDependencyLicenses();
      const compatibility = await this.validateLicenseCompatibility();
      const attributions = await this.generateAttributions();

      // 2. Generate compliance summary
      const summary: ComplianceSummary = {
        totalDependencies: licenseScan.totalDependencies,
        licenseIssues: licenseScan.issues.length,
        compatibilityIssues: compatibility.issues.length,
        attributionRequired: licenseScan.attributionRequired,
        attributionGenerated: attributions.dependenciesAttributed,
        overallCompliance: this.calculateComplianceScore(
          licenseScan,
          compatibility,
          attributions,
        ),
      };

      // 3. Generate recommendations
      const recommendations = await this.generateComplianceRecommendations(
        licenseScan,
        compatibility,
        attributions,
      );

      // 4. Create detailed report
      const report: ComplianceReport = {
        timestamp: new Date(),
        summary,
        licenseScan,
        compatibility,
        attributions,
        recommendations,
        duration: Date.now() - startTime,
        success:
          licenseScan.success && compatibility.success && attributions.success,
      };

      // 5. Write report to file
      const reportPath = join(
        this.config.reportingConfig.outputDirectory,
        "compliance-report.json",
      );
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
      console.log(`Compliance report generated: ${reportPath}`);

      // 6. Generate human-readable report
      const humanReadableReport =
        await this.generateHumanReadableReport(report);
      const markdownPath = join(
        this.config.reportingConfig.outputDirectory,
        "COMPLIANCE.md",
      );
      await fs.writeFile(markdownPath, humanReadableReport, "utf8");
      console.log(
        `Human-readable compliance report generated: ${markdownPath}`,
      );

      console.log(
        `Compliance report generation completed in ${report.duration}ms`,
      );

      return report;
    } catch (error) {
      console.error("Compliance report generation failed:", error);

      return {
        timestamp: new Date(),
        summary: {
          totalDependencies: 0,
          licenseIssues: 0,
          compatibilityIssues: 0,
          attributionRequired: 0,
          attributionGenerated: 0,
          overallCompliance: 0,
        },
        licenseScan: {
          totalDependencies: 0,
          dependencies: [],
          licenseSummary: new Map(),
          attributionRequired: 0,
          issues: [],
          duration: 0,
          success: false,
        },
        compatibility: {
          compatible: false,
          issues: [],
          compatibleLicenses: [],
          totalDependencies: 0,
          duration: 0,
          success: false,
        },
        attributions: {
          attributions: [],
          dependenciesAttributed: 0,
          duration: 0,
          success: false,
        },
        recommendations: [],
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async setupLegalDocumentation(
    options: any = {},
  ): Promise<DocumentationResult> {
    console.log("📋 Setting up legal documentation...");
    const startTime = Date.now();

    try {
      const documentsGenerated: DocumentationFile[] = [];

      // 1. Ensure LICENSE file exists
      const licenseFile = await this.generateLicenseFile(options);
      if (licenseFile) {
        documentsGenerated.push({
          filename: "LICENSE",
          path: join(process.cwd(), "LICENSE"),
          type: "license",
          content: licenseFile.content,
        });
      }

      // 2. Generate Code of Conduct if not exists
      const cocPath = join(process.cwd(), "CODE_OF_CONDUCT.md");
      try {
        await fs.access(cocPath);
        console.log("✅ CODE_OF_CONDUCT.md already exists");
      } catch {
        const cocFile = await this.generateCodeOfConduct(options);
        await fs.writeFile(cocPath, cocFile.content);
        documentsGenerated.push({
          filename: "CODE_OF_CONDUCT.md",
          path: cocPath,
          type: "coc",
          content: cocFile.content,
        });
        console.log("✅ Generated CODE_OF_CONDUCT.md");
      }

      // 3. Generate Contributing Guidelines if not exists
      const contributingPath = join(process.cwd(), "CONTRIBUTING.md");
      try {
        await fs.access(contributingPath);
        console.log("✅ CONTRIBUTING.md already exists");
      } catch {
        const contributingFile =
          await this.generateContributingGuidelines(options);
        await fs.writeFile(contributingPath, contributingFile.content);
        documentsGenerated.push({
          filename: "CONTRIBUTING.md",
          path: contributingPath,
          type: "disclaimer",
          content: contributingFile.content,
        });
        console.log("✅ Generated CONTRIBUTING.md");
      }

      // 4. Generate attribution files if needed
      const attributionResult = await this.generateAttributions();
      if (attributionResult.success) {
        for (const attribution of attributionResult.attributions) {
          const attributionPath = join(process.cwd(), attribution.filename);
          await fs.writeFile(attributionPath, attribution.content);
          documentsGenerated.push({
            filename: attribution.filename,
            path: attributionPath,
            type: "license",
            content: attribution.content,
          });
        }
        console.log(
          `✅ Generated ${attributionResult.attributions.length} attribution files`,
        );
      }

      const result: DocumentationResult = {
        documentsGenerated,
        duration: Date.now() - startTime,
        success: true,
      };

      console.log(
        `✅ Legal documentation setup completed: ${documentsGenerated.length} documents generated`,
      );
      return result;
    } catch (error) {
      console.error("❌ Failed to setup legal documentation:", error);
      return {
        documentsGenerated: [],
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async monitorLicenseChanges(): Promise<MonitoringResult> {
    console.log("🔍 Monitoring license changes...");
    const startTime = Date.now();

    try {
      let changesDetected = 0;
      let violationsFound = 0;
      let alertsSent = 0;

      // 1. Check for package.json changes
      const packageChanges = await this.checkPackageJsonChanges();
      changesDetected +=
        packageChanges.newDependencies.length +
        packageChanges.updatedDependencies.length;

      // 2. Check for new license violations
      if (
        packageChanges.newDependencies.length > 0 ||
        packageChanges.updatedDependencies.length > 0
      ) {
        console.log(
          `📋 Found ${changesDetected} dependency changes, checking compliance...`,
        );

        const complianceResult = await this.generateComplianceReport();
        if (!complianceResult.success) {
          violationsFound += complianceResult.compatibility.issues.length;
        }
      }

      // 3. Check for license file changes
      const licenseFileChanges = await this.checkLicenseFileChanges();
      if (licenseFileChanges.modified) {
        changesDetected++;
        console.log("📄 LICENSE file has been modified");
      }

      // 4. Check for legal documentation changes
      const documentationChanges = await this.checkLegalDocumentationChanges();
      changesDetected += documentationChanges.modifiedFiles.length;

      // 5. Send alerts if violations found
      if (violationsFound > 0) {
        alertsSent = await this.sendComplianceAlerts(violationsFound);
      }

      const duration = Date.now() - startTime;
      const nextCheck = new Date(Date.now() + 24 * 60 * 60 * 1000); // Next day

      console.log(
        `✅ License monitoring completed: ${changesDetected} changes, ${violationsFound} violations`,
      );

      return {
        changesDetected,
        violationsFound,
        alertsSent,
        lastCheck: new Date(),
        nextCheck,
        duration,
        success: true,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        changesDetected: 0,
        violationsFound: 0,
        alertsSent: 0,
        lastCheck: new Date(),
        nextCheck: new Date(Date.now() + 24 * 60 * 60 * 1000),
        duration,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Check for changes in package.json dependencies
   */
  private async checkPackageJsonChanges(): Promise<{
    newDependencies: string[];
    updatedDependencies: string[];
    removedDependencies: string[];
  }> {
    const result = {
      newDependencies: [] as string[],
      updatedDependencies: [] as string[],
      removedDependencies: [] as string[],
    };

    try {
      const packageJsonPath = join(process.cwd(), "package.json");
      const currentPackageJson = JSON.parse(
        await fs.readFile(packageJsonPath, "utf8"),
      );

      // For now, we'll assume all dependencies are "new" since we don't have a previous state
      // In a real implementation, this would compare against a stored previous state
      const allDeps = {
        ...(currentPackageJson.dependencies || {}),
        ...(currentPackageJson.devDependencies || {}),
        ...(currentPackageJson.peerDependencies || {}),
      };

      // Mark dependencies as "new" for monitoring purposes
      result.newDependencies = Object.keys(allDeps);

      console.log(
        `📦 Monitoring ${result.newDependencies.length} dependencies for license changes`,
      );
    } catch (error) {
      console.warn(
        "⚠️ Could not read package.json for change detection:",
        error,
      );
    }

    return result;
  }

  /**
   * Check for LICENSE file modifications
   */
  private async checkLicenseFileChanges(): Promise<{
    modified: boolean;
    lastModified?: Date;
  }> {
    try {
      const licensePath = join(process.cwd(), "LICENSE");
      const stats = await fs.stat(licensePath);

      // In a real implementation, this would compare against a stored hash or timestamp
      // For now, we'll assume it's not modified
      return {
        modified: false,
        lastModified: stats.mtime,
      };
    } catch (error) {
      return { modified: false };
    }
  }

  /**
   * Check for legal documentation changes
   */
  private async checkLegalDocumentationChanges(): Promise<{
    modifiedFiles: string[];
    newFiles: string[];
    removedFiles: string[];
  }> {
    const result = {
      modifiedFiles: [] as string[],
      newFiles: [] as string[],
      removedFiles: [] as string[],
    };

    const legalFiles = [
      "CODE_OF_CONDUCT.md",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "PRIVACY.md",
    ];

    for (const filename of legalFiles) {
      try {
        const filepath = join(process.cwd(), filename);
        await fs.access(filepath);
        // File exists, in a real implementation we'd check if it's modified
      } catch (error) {
        // File doesn't exist
        result.removedFiles.push(filename);
      }
    }

    return result;
  }

  /**
   * Send compliance alerts for violations
   */
  private async sendComplianceAlerts(violationCount: number): Promise<number> {
    console.log(`🚨 Sending ${violationCount} compliance alerts`);

    try {
      // In a real implementation, this would send emails, Slack messages, etc.
      // For now, we'll just log the alerts
      console.log(
        `Alert: ${violationCount} license compliance violations detected`,
      );
      console.log(
        "Please review the compliance report and take necessary action",
      );

      return 1; // One alert sent
    } catch (error) {
      console.error("Failed to send compliance alerts:", error);
      return 0;
    }
  }

  // Private helper methods
  private async validateProjectLicense(): Promise<void> {
    const projectLicense = this.licenseDatabase.getLicense(
      this.config.projectLicense,
    );
    if (!projectLicense) {
      throw new Error(
        `Project license '${this.config.projectLicense}' not found in license database`,
      );
    }
    console.log(`Project license validated: ${projectLicense.name}`);
  }

  private async scanDependencyLicense(
    packageName: string,
    version: string,
  ): Promise<DependencyLicense> {
    console.log(`Scanning license for ${packageName}@${version}...`);

    // 1. Get package information from scanner
    const packageInfo = await this.dependencyScanner.getPackageInfo(
      packageName,
      version,
    );

    // 2. Extract license information
    let licenseInfo;

    if (packageInfo.license) {
      licenseInfo = await this.dependencyScanner.parseLicenseString(
        packageInfo.license,
      );
    } else if (packageInfo.licenses) {
      const primaryLicense = Array.isArray(packageInfo.licenses)
        ? packageInfo.licenses[0]
        : packageInfo.licenses;
      const licenseString =
        typeof primaryLicense === "object" && "type" in primaryLicense
          ? primaryLicense.type || "UNKNOWN"
          : primaryLicense || "UNKNOWN";
      licenseInfo =
        await this.dependencyScanner.parseLicenseString(licenseString);
    } else {
      licenseInfo = await this.dependencyScanner.parseLicenseString("UNKNOWN");
    }

    // 3. Get copyright holders
    const copyrightHolders =
      await this.dependencyScanner.extractCopyrightHolders(
        packageInfo,
        packageName,
      );

    // 4. Determine attribution requirements
    const attributionRequired = this.licenseDatabase.requiresAttribution(
      licenseInfo.spdxId || licenseInfo.name,
    );

    return {
      packageName,
      version: version === "latest" ? packageInfo.version : version,
      license: licenseInfo,
      licenseFile: packageInfo.licenseFile,
      noticeFile: packageInfo.noticeFile,
      copyrightHolders,
      attributionRequired,
      sourceUrl: packageInfo.repository?.url,
    };
  }

  private async checkLicenseCompatibility(
    dependency: DependencyLicense,
  ): Promise<LicenseScanIssue | null> {
    const isCompatible = this.licenseDatabase.areCompatible(
      this.config.projectLicense,
      (dependency.license.spdxId as LicenseType) ||
        (dependency.license.name as LicenseType),
    );

    if (!isCompatible) {
      return {
        type: "compatibility_issue",
        severity: "medium",
        packageName: dependency.packageName,
        version: dependency.version,
        message: `License ${dependency.license.name} may not be compatible with project license ${this.config.projectLicense}`,
        recommendation:
          "Review license compatibility and consider alternatives",
      };
    }

    return null;
  }

  private async checkLicenseCompatibilityWith(
    license: any,
    projectLicense: LicenseType,
  ): Promise<{
    compatible: boolean;
    issue?: string;
    severity?: "low" | "medium" | "high" | "critical";
    recommendation?: string;
  }> {
    const compatible = this.licenseDatabase.areCompatible(
      projectLicense,
      (license.spdxId as LicenseType) || (license.name as LicenseType),
    );

    if (!compatible) {
      return {
        compatible: false,
        issue: `License ${license.name} is not compatible with project license ${projectLicense}`,
        severity: "medium",
        recommendation:
          "Consider replacing with a compatible alternative or seek legal review",
      };
    }

    return { compatible: true };
  }

  private generateLicenseSummary(
    dependencies: DependencyLicense[],
  ): Map<string, number> {
    const summary = new Map<string, number>();

    for (const dep of dependencies) {
      const licenseKey = dep.license.spdxId || dep.license.name;
      summary.set(licenseKey, (summary.get(licenseKey) || 0) + 1);
    }

    return summary;
  }

  private calculateComplianceScore(
    licenseScan: LicenseScanResult,
    compatibility: CompatibilityResult,
    attributions: AttributionResult,
  ): number {
    let score = 100;

    // Deduct points for issues
    score -= licenseScan.issues.length * 10;
    score -= compatibility.issues.length * 15;

    // Deduct points if attribution generation failed
    if (!attributions.success) {
      score -= 25;
    }

    // Bonus points for clean scan
    if (licenseScan.issues.length === 0 && compatibility.issues.length === 0) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  private async generateComplianceRecommendations(
    licenseScan: LicenseScanResult,
    compatibility: CompatibilityResult,
    attributions: AttributionResult,
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (licenseScan.issues.length > 0) {
      recommendations.push(
        `Address ${licenseScan.issues.length} license scanning issues`,
      );
    }

    if (compatibility.issues.length > 0) {
      recommendations.push(
        `Resolve ${compatibility.issues.length} license compatibility issues`,
      );
    }

    if (!attributions.success) {
      recommendations.push(
        "Fix attribution generation to ensure proper legal compliance",
      );
    }

    if (licenseScan.attributionRequired > attributions.dependenciesAttributed) {
      recommendations.push(
        `${licenseScan.attributionRequired - attributions.dependenciesAttributed} dependencies require attribution but were not included`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("All legal compliance checks passed successfully");
    }

    return recommendations;
  }

  private async generateHumanReadableReport(
    report: ComplianceReport,
  ): Promise<string> {
    let content = `# Legal Compliance Report\n\n`;
    content += `Generated: ${report.timestamp.toISOString()}\n`;
    content += `Duration: ${report.duration}ms\n\n`;

    content += `## Summary\n\n`;
    content += `- Total Dependencies: ${report.summary.totalDependencies}\n`;
    content += `- License Issues: ${report.summary.licenseIssues}\n`;
    content += `- Compatibility Issues: ${report.summary.compatibilityIssues}\n`;
    content += `- Attribution Required: ${report.summary.attributionRequired}\n`;
    content += `- Attribution Generated: ${report.summary.attributionGenerated}\n`;
    content += `- Overall Compliance Score: ${report.summary.overallCompliance}%\n\n`;

    if (report.recommendations.length > 0) {
      content += `## Recommendations\n\n`;
      for (const rec of report.recommendations) {
        content += `- ${rec}\n`;
      }
      content += `\n`;
    }

    if (report.licenseScan.issues.length > 0) {
      content += `## License Scan Issues\n\n`;
      for (const issue of report.licenseScan.issues) {
        content += `- **${issue.packageName}@${issue.version}** (${issue.severity}): ${issue.message}\n`;
      }
      content += `\n`;
    }

    if (report.compatibility.issues.length > 0) {
      content += `## Compatibility Issues\n\n`;
      for (const issue of report.compatibility.issues) {
        content += `- **${issue.packageName}@${issue.version}** (${issue.severity}): ${issue.issue}\n`;
        content += `  - Recommendation: ${issue.recommendation}\n`;
      }
      content += `\n`;
    }

    return content;
  }

  /**
   * Generate license file content based on project configuration
   */
  private async generateLicenseFile(options: any): Promise<DocumentationFile> {
    const licenseType = options.licenseType || "MIT";
    const year = new Date().getFullYear();
    const author = options.author || "AST Copilot Helper Contributors";

    let content = "";

    switch (licenseType.toUpperCase()) {
      case "MIT":
        content = `MIT License

Copyright (c) ${year} ${author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
        break;
      case "APACHE-2.0":
        content = `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

1. Definitions.

   "License" shall mean the terms and conditions for use, reproduction,
   and distribution as defined by Sections 1 through 9 of this document.

   "Licensor" shall mean the copyright owner or entity granting the License.

   "Legal Entity" shall mean the union of the acting entity and all
   other entities that control, are controlled by, or are under common
   control with that entity. For the purposes of this definition,
   "control" means (i) the power, direct or indirect, to cause the
   direction or management of such entity, whether by contract or
   otherwise, or (ii) ownership of fifty percent (50%) or more of the
   outstanding shares, or (iii) beneficial ownership of such entity.

   "You" (or "Your") shall mean an individual or Legal Entity
   exercising permissions granted by this License.

   "Source" form shall mean the preferred form for making modifications,
   including but not limited to software source code, documentation
   source, and configuration files.

   "Object" form shall mean any form resulting from mechanical
   transformation or translation of a Source form, including but
   not limited to compiled object code, generated documentation,
   and conversions to other media types.

   "Work" shall mean the work of authorship, whether in Source or
   Object form, made available under the License, as indicated by a
   copyright notice that is included in or attached to the work
   (which shall not include Communications that are conspicuously
   marked or otherwise designated in writing by the copyright owner
   as "Not a Contribution").

   "Derivative Works" shall mean any work, whether in Source or Object
   form, that is based upon (or derived from) the Work and for which the
   editorial revisions, annotations, elaborations, or other modifications
   represent, as a whole, an original work of authorship. For the purposes
   of this License, Derivative Works shall not include works that remain
   separable from, or merely link (or bind by name) to the interfaces of,
   the Work and derivative works thereof.

   "Contribution" shall mean any work of authorship, including
   the original version of the Work and any modifications or additions
   to that Work or Derivative Works thereof, that is intentionally
   submitted to Licensor for inclusion in the Work by the copyright owner
   or by an individual or Legal Entity authorized to submit on behalf of
   the copyright owner. For the purposes of this definition, "submitted"
   means any form of electronic, verbal, or written communication sent
   to the Licensor or its representatives, including but not limited to
   communication on electronic mailing lists, source code control
   systems, and issue tracking systems that are managed by, or on behalf
   of, the Licensor for the purpose of discussing and improving the Work,
   but excluding communication that is conspicuously marked or otherwise
   designated in writing by the copyright owner as "Not a Contribution".

2. Grant of Copyright License. Subject to the terms and conditions of
   this License, each Contributor hereby grants to You a perpetual,
   worldwide, non-exclusive, no-charge, royalty-free, irrevocable
   copyright license to use, reproduce, modify, display, perform,
   sublicense, and distribute the Work and such Derivative Works in
   Source or Object form.

3. Grant of Patent License. Subject to the terms and conditions of
   this License, each Contributor hereby grants to You a perpetual,
   worldwide, non-exclusive, no-charge, royalty-free, irrevocable
   (except as stated in this section) patent license to make, have made,
   use, offer to sell, sell, import, and otherwise transfer the Work,
   where such license applies only to those patent claims licensable
   by such Contributor that are necessarily infringed by their
   Contribution(s) alone or by combination of their Contribution(s)
   with the Work to which such Contribution(s) was submitted. If You
   institute patent litigation against any entity (including a
   cross-claim or counterclaim in a lawsuit) alleging that the Work
   or a Contribution incorporated within the Work constitutes direct
   or contributory patent infringement, then any patent licenses
   granted to You under this License for that Work shall terminate
   as of the date such litigation is filed.

4. Redistribution. You may reproduce and distribute copies of the
   Work or Derivative Works thereof in any medium, with or without
   modifications, and in Source or Object form, provided that You
   meet the following conditions:

   (a) You must give any other recipients of the Work or
       Derivative Works a copy of this License; and

   (b) You must cause any modified files to carry prominent notices
       stating that You changed the files; and

   (c) You must retain, in the Source form of any Derivative Works
       that You distribute, all copyright, patent, trademark, and
       attribution notices from the Source form of the Work,
       excluding those notices that do not pertain to any part of
       the Derivative Works; and

   (d) If the Work includes a "NOTICE" text file as part of its
       distribution, then any Derivative Works that You distribute must
       include a readable copy of the attribution notices contained
       within such NOTICE file, excluding those notices that do not
       pertain to any part of the Derivative Works, in at least one
       of the following places: within a NOTICE text file distributed
       as part of the Derivative Works; within the Source form or
       documentation, if provided along with the Derivative Works; or,
       within a display generated by the Derivative Works, if and
       wherever such third-party notices normally appear. The contents
       of the NOTICE file are for informational purposes only and
       do not modify the License. You may add Your own attribution
       notices within Derivative Works that You distribute, alongside
       or as an addendum to the NOTICE text from the Work, provided
       that such additional attribution notices cannot be construed
       as modifying the License.

   You may add Your own copyright notice to Your modifications and
   may provide additional or different license terms and conditions
   for use, reproduction, or distribution of Your modifications, or
   for any such Derivative Works as a whole, provided Your use,
   reproduction, and distribution of the Work otherwise complies with
   the conditions stated in this License.

5. Submission of Contributions. Unless You explicitly state otherwise,
   any Contribution intentionally submitted for inclusion in the Work
   by You to the Licensor shall be under the terms and conditions of
   this License, without any additional terms or conditions.
   Notwithstanding the above, nothing herein shall supersede or modify
   the terms of any separate license agreement you may have executed
   with Licensor regarding such Contributions.

6. Trademarks. This License does not grant permission to use the trade
   names, trademarks, service marks, or product names of the Licensor,
   except as required for reasonable and customary use in describing the
   origin of the Work and reproducing the content of the NOTICE file.

7. Disclaimer of Warranty. Unless required by applicable law or
   agreed to in writing, Licensor provides the Work (and each
   Contributor provides its Contributions) on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
   implied, including, without limitation, any warranties or conditions
   of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
   PARTICULAR PURPOSE. You are solely responsible for determining the
   appropriateness of using or redistributing the Work and assume any
   risks associated with Your exercise of permissions under this License.

8. Limitation of Liability. In no event and under no legal theory,
   whether in tort (including negligence), contract, or otherwise,
   unless required by applicable law (such as deliberate and grossly
   negligent acts) or agreed to in writing, shall any Contributor be
   liable to You for damages, including any direct, indirect, special,
   incidental, or consequential damages of any character arising as a
   result of this License or out of the use or inability to use the
   Work (including but not limited to damages for loss of goodwill,
   work stoppage, computer failure or malfunction, or any and all
   other commercial damages or losses), even if such Contributor
   has been advised of the possibility of such damages.

9. Accepting Warranty or Additional Support. You are not required to
   accept warranty or additional support for the Work from any Contributor.
   However, if You elect to accept such warranty or additional support,
   You do so solely on Your own behalf and on Your sole responsibility,
   not on behalf of any other Contributor, and only if You agree to
   indemnify, defend, and hold each Contributor harmless for any
   liability incurred by, or claims asserted against, such Contributor
   by reason of your accepting any such warranty or additional support.

END OF TERMS AND CONDITIONS

APPENDIX: How to apply the Apache License to your work.

   To apply the Apache License to your work, attach the following
   boilerplate notice, with the fields enclosed by brackets "[]"
   replaced with your own identifying information. (Don't include
   the brackets!)  The text should be enclosed in the appropriate
   comment syntax for the file format. We also recommend that a
   file or class name and description of purpose be included on the
   same "printed page" as the copyright notice for easier
   identification within third-party archives.

Copyright [yyyy] [name of copyright owner]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`;
        break;
      default:
        content = `${licenseType} License

Copyright (c) ${year} ${author}

Please refer to the official ${licenseType} license text for terms and conditions.`;
    }

    return {
      filename: "LICENSE",
      path: "LICENSE",
      content,
      type: "license",
    };
  }

  /**
   * Generate Code of Conduct based on standard templates
   */
  private async generateCodeOfConduct(
    options: any,
  ): Promise<DocumentationFile> {
    const email = options.email || "conduct@example.com";

    const content = `# Contributor Covenant Code of Conduct

## Our Pledge

We as members, contributors, and leaders pledge to make participation in our
community a harassment-free experience for everyone, regardless of age, body
size, visible or invisible disability, ethnicity, sex characteristics, gender
identity and expression, level of experience, education, socio-economic status,
nationality, personal appearance, race, religion, or sexual identity
and orientation.

We pledge to act and interact in ways that contribute to an open, welcoming,
diverse, inclusive, and healthy community.

## Our Standards

Examples of behavior that contributes to a positive environment for our
community include:

* Demonstrating empathy and kindness toward other people
* Being respectful of differing opinions, viewpoints, and experiences
* Giving and gracefully accepting constructive feedback
* Accepting responsibility and apologizing to those affected by our mistakes,
  and learning from the experience
* Focusing on what is best not just for us as individuals, but for the
  overall community

Examples of unacceptable behavior include:

* The use of sexualized language or imagery, and sexual attention or
  advances of any kind
* Trolling, insulting or derogatory comments, and personal or political attacks
* Public or private harassment
* Publishing others' private information, such as a physical or email
  address, without their explicit permission
* Other conduct which could reasonably be considered inappropriate in a
  professional setting

## Enforcement Responsibilities

Community leaders are responsible for clarifying and enforcing our standards of
acceptable behavior and will take appropriate and fair corrective action in
response to any behavior that they deem inappropriate, threatening, offensive,
or harmful.

Community leaders have the right and responsibility to remove, edit, or reject
comments, commits, code, wiki edits, issues, and other contributions that are
not aligned to this Code of Conduct, and will communicate reasons for moderation
decisions when appropriate.

## Scope

This Code of Conduct applies within all community spaces, and also applies when
an individual is officially representing the community in public spaces.
Examples of representing our community include using an official e-mail address,
posting via an official social media account, or acting as an appointed
representative at an online or offline event.

## Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the community leaders responsible for enforcement at
${email}.
All complaints will be reviewed and investigated promptly and fairly.

All community leaders are obligated to respect the privacy and security of the
reporter of any incident.

## Enforcement Guidelines

Community leaders will follow these Community Impact Guidelines in determining
the consequences for any action they deem in violation of this Code of Conduct:

### 1. Correction

**Community Impact**: Use of inappropriate language or other behavior deemed
unprofessional or unwelcome in the community.

**Consequence**: A private, written warning from community leaders, providing
clarity around the nature of the violation and an explanation of why the
behavior was inappropriate. A public apology may be requested.

### 2. Warning

**Community Impact**: A violation through a single incident or series
of actions.

**Consequence**: A warning with consequences for continued behavior. No
interaction with the people involved, including unsolicited interaction with
those enforcing the Code of Conduct, for a specified period of time. This
includes avoiding interactions in community spaces as well as external channels
like social media. Violating these terms may lead to a temporary or
permanent ban.

### 3. Temporary Ban

**Community Impact**: A serious violation of community standards, including
sustained inappropriate behavior.

**Consequence**: A temporary ban from any sort of interaction or public
communication with the community for a specified period of time. No public or
private interaction with the people involved, including unsolicited interaction
with those enforcing the Code of Conduct, is allowed during this period.
Violating these terms may lead to a permanent ban.

### 4. Permanent Ban

**Community Impact**: Demonstrating a pattern of violation of community
standards, including sustained inappropriate behavior,  harassment of an
individual, or aggression toward or disparagement of classes of individuals.

**Consequence**: A permanent ban from any sort of public interaction within
the community.

## Attribution

This Code of Conduct is adapted from the [Contributor Covenant][homepage],
version 2.0, available at
https://www.contributor-covenant.org/version/2/0/code_of_conduct.html.

Community Impact Guidelines were inspired by [Mozilla's code of conduct
enforcement ladder](https://github.com/mozilla/diversity).

[homepage]: https://www.contributor-covenant.org

For answers to common questions about this code of conduct, see the FAQ at
https://www.contributor-covenant.org/faq. Translations are available at
https://www.contributor-covenant.org/translations.`;

    return {
      filename: "CODE_OF_CONDUCT.md",
      path: "CODE_OF_CONDUCT.md",
      content,
      type: "coc",
    };
  }

  /**
   * Generate Contributing Guidelines
   */
  private async generateContributingGuidelines(
    options: any,
  ): Promise<DocumentationFile> {
    const projectName = options.projectName || "AST Copilot Helper";
    const repoUrl =
      options.repoUrl || "https://github.com/example/ast-copilot-helper";

    const content = `# Contributing to ${projectName}

First off, thanks for taking the time to contribute! ❤️

All types of contributions are encouraged and valued. See the [Table of Contents](#table-of-contents) for different ways to help and details about how this project handles them. Please make sure to read the relevant section before making your contribution. It will make it a lot easier for us maintainers and smooth out the experience for all involved. The community looks forward to your contributions. 🎉

> And if you like the project, but just don't have time to contribute, that's fine. There are other easy ways to support the project and show your appreciation, which we would also be very happy about:
> - Star the project
> - Tweet about it
> - Refer this project in your project's readme
> - Mention the project at local meetups and tell your friends/colleagues

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [I Have a Question](#i-have-a-question)
- [I Want To Contribute](#i-want-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Your First Code Contribution](#your-first-code-contribution)
  - [Improving The Documentation](#improving-the-documentation)
- [Styleguides](#styleguides)
  - [Commit Messages](#commit-messages)
- [Join The Project Team](#join-the-project-team)

## Code of Conduct

This project and everyone participating in it is governed by the
[${projectName} Code of Conduct](CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code. Please report unacceptable behavior
to [conduct@example.com](mailto:conduct@example.com).

## I Have a Question

> If you want to ask a question, we assume that you have read the available [Documentation](docs/).

Before you ask a question, it is best to search for existing [Issues](${repoUrl}/issues) that might help you. In case you have found a suitable issue and still need clarification, you can write your question in this issue. It is also advisable to search the internet for answers first.

If you then still feel the need to ask a question and need clarification, we recommend the following:

- Open an [Issue](${repoUrl}/issues/new).
- Provide as much context as you can about what you're running into.
- Provide project and platform versions (nodejs, npm, etc), depending on what seems relevant.

We will then take care of the issue as soon as possible.

## I Want To Contribute

> ### Legal Notice
> When contributing to this project, you must agree that you have authored 100% of the content, that you have the necessary rights to the content and that the content you contribute may be provided under the project license.

### Reporting Bugs

#### Before Submitting a Bug Report

A good bug report shouldn't leave others needing to chase you up for more information. Therefore, we ask you to investigate carefully, collect information and describe the issue in detail in your report. Please complete the following steps in advance to help us fix any potential bug as fast as possible.

- Make sure that you are using the latest version.
- Determine if your bug is really a bug and not an error on your side e.g. using incompatible environment components/versions (Make sure that you have read the [documentation](docs/). If you are looking for support, you might want to check [this section](#i-have-a-question)).
- To see if other users have experienced (and potentially already solved) the same issue you are having, check if there is not already a bug report existing for your bug or error in the [bug tracker](${repoUrl}/issues?q=label%3Abug).
- Also make sure to search the internet (including Stack Overflow) to see if users outside of the GitHub community have discussed the issue.
- Collect information about the bug:
  - Stack trace (Traceback)
  - OS, Platform and Version (Windows, Linux, macOS, x86, ARM)
  - Version of the interpreter, compiler, SDK, runtime environment, package manager, depending on what seems relevant.
  - Possibly your input and the output
  - Can you reliably reproduce the issue? And can you also reproduce it with older versions?

#### How Do I Submit a Good Bug Report?

> You must never report security related issues, vulnerabilities or bugs including sensitive information to the issue tracker, or elsewhere in public. Instead sensitive bugs must be sent by email to [security@example.com](mailto:security@example.com).

We use GitHub issues to track bugs and errors. If you run into an issue with the project:

- Open an [Issue](${repoUrl}/issues/new). (Since we can't be sure at this point whether it is a bug or not, we ask you not to talk about a bug yet and not to label the issue.)
- Explain the behavior you would expect and the actual behavior.
- Please provide as much context as possible and describe the *reproduction steps* that someone else can follow to recreate the issue on their own. This usually includes your code. For good bug reports you should isolate the problem and create a reduced test case.
- Provide the information you collected in the previous section.

Once it's filed:

- The project team will label the issue accordingly.
- A team member will try to reproduce the issue with your provided steps. If there are no reproduction steps or no obvious way to reproduce the issue, the team will ask you for those steps and mark the issue as \`needs-repro\`. Bugs with the \`needs-repro\` tag will not be addressed until they are reproduced.
- If the team is able to reproduce the issue, it will be marked \`needs-fix\`, as well as possibly other tags (such as \`critical\`), and the issue will be left to be [implemented by someone](#your-first-code-contribution).

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for ${projectName}, **including completely new features and minor improvements to existing functionality**. Following these guidelines will help maintainers and the community to understand your suggestion and find related suggestions.

#### Before Submitting an Enhancement

- Make sure that you are using the latest version.
- Read the [documentation](docs/) carefully and find out if the functionality is already covered, maybe by an individual configuration.
- Perform a [search](${repoUrl}/issues) to see if the enhancement has already been suggested. If it has, add a comment to the existing issue instead of opening a new one.
- Find out whether your idea fits with the scope and aims of the project. It's up to you to make a strong case to convince the project's developers of the merits of this feature. Keep in mind that we want features that will be useful to the majority of our users and not just a small subset. If you're just targeting a minority of users, consider writing an add-on/plugin library.

#### How Do I Submit a Good Enhancement Suggestion?

Enhancement suggestions are tracked as [GitHub issues](${repoUrl}/issues).

- Use a **clear and descriptive title** for the issue to identify the suggestion.
- Provide a **step-by-step description of the suggested enhancement** in as many details as possible.
- **Describe the current behavior** and **explain which behavior you expected to see instead** and why. At this point you can also tell which alternatives do not work for you.
- You may want to **include screenshots and animated GIFs** which help you demonstrate the steps or point out the part which the suggestion is related to. You can use [this tool](https://www.cockos.com/licecap/) to record GIFs on macOS and Windows, and [this tool](https://github.com/colinkeenan/silentcast) or [this tool](https://github.com/GNOME/byzanz) on Linux.
- **Explain why this enhancement would be useful** to most ${projectName} users. You may also want to point out the other projects that solved it better and which could serve as inspiration.

### Your First Code Contribution

#### Development Setup

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: \`npm install\`
4. Run tests to verify setup: \`npm test\`
5. Start development server: \`npm run dev\`

#### Pull Request Process

1. Create a new branch for your feature/fix: \`git checkout -b feature/your-feature-name\`
2. Make your changes
3. Add or update tests as needed
4. Ensure all tests pass: \`npm test\`
5. Run linting: \`npm run lint\`
6. Commit your changes with a clear commit message
7. Push to your fork and submit a pull request

### Improving The Documentation

Documentation is crucial for any project. If you find areas where the documentation could be improved:

- Check existing documentation in the \`docs/\` directory
- Look for outdated information or missing sections
- Follow the same pull request process as code contributions
- Use clear, concise language
- Include examples where helpful

## Styleguides

### Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line
- Consider starting the commit message with an applicable emoji:
  - 🎨 \`:art:\` when improving the format/structure of the code
  - 🐎 \`:racehorse:\` when improving performance
  - 📝 \`:memo:\` when writing docs
  - 🐛 \`:bug:\` when fixing a bug
  - 🔥 \`:fire:\` when removing code or files
  - ✅ \`:white_check_mark:\` when adding tests
  - 🔒 \`:lock:\` when dealing with security

## Join The Project Team

If you're interested in becoming a maintainer, please reach out to the current maintainers. We're always looking for dedicated contributors to help with:

- Code review
- Issue triage
- Documentation maintenance
- Community support

Thank you for contributing to ${projectName}! 🚀`;

    return {
      filename: "CONTRIBUTING.md",
      path: "CONTRIBUTING.md",
      content,
      type: "disclaimer",
    };
  }
}
