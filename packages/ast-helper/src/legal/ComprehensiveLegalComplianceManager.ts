/**
 * @fileoverview Main legal compliance manager implementing comprehensive license compliance
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import {
  LegalComplianceManager,
  ComplianceConfig,
  LicenseScanResult,
  AttributionResult,
  CompatibilityResult,
  ComplianceReport,
  DocumentationResult,
  MonitoringResult,
  DependencyLicense,
  LicenseScanIssue,
  CompatibilityIssue,
  ComplianceSummary,
  AttributionDocument,
  LicenseType
} from './types.js';
import { LicenseDatabase } from './LicenseDatabase.js';
import { DependencyScanner } from './DependencyScanner.js';
import { AttributionGenerator } from './AttributionGenerator.js';

/**
 * Comprehensive legal compliance manager for the ast-copilot-helper project
 */
export class ComprehensiveLegalComplianceManager implements LegalComplianceManager {
  private config!: ComplianceConfig;
  private licenseDatabase!: LicenseDatabase;
  private dependencyScanner!: DependencyScanner;
  private attributionGenerator!: AttributionGenerator;

  async initialize(config: ComplianceConfig): Promise<void> {
    this.config = config;
    
    console.log('Initializing legal compliance manager...');
    
    // Initialize license database with SPDX data
    this.licenseDatabase = new LicenseDatabase();
    await this.licenseDatabase.initialize();
    
    // Setup dependency scanner
    this.dependencyScanner = new DependencyScanner(config);
    await this.dependencyScanner.initialize();
    
    // Initialize attribution generator
    this.attributionGenerator = new AttributionGenerator(config.attributionRequirements);
    await this.attributionGenerator.initialize();
    
    // Validate project license
    await this.validateProjectLicense();
    
    console.log('Legal compliance manager initialized successfully');
  }

  async scanDependencyLicenses(): Promise<LicenseScanResult> {
    console.log('Scanning dependency licenses...');
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
        const packageData = JSON.parse(await fs.readFile(packageFile, 'utf8'));
        const dependencies = {
          ...packageData.dependencies,
          ...packageData.devDependencies,
          ...packageData.peerDependencies,
        };
        
        // 3. Scan each dependency
        for (const [depName, depVersion] of Object.entries(dependencies)) {
          try {
            const licenseInfo = await this.scanDependencyLicense(depName, depVersion as string);
            dependencyLicenses.push(licenseInfo);
            
            // 4. Check license compatibility
            const compatibilityIssue = await this.checkLicenseCompatibility(licenseInfo);
            if (compatibilityIssue) {
              scanIssues.push(compatibilityIssue);
            }
            
          } catch (error) {
            scanIssues.push({
              type: 'scan_error',
              severity: 'high',
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
      const attributionRequired = dependencyLicenses.filter(dep => dep.attributionRequired);
      
      const result: LicenseScanResult = {
        totalDependencies: dependencyLicenses.length,
        dependencies: dependencyLicenses,
        licenseSummary,
        attributionRequired: attributionRequired.length,
        issues: scanIssues,
        duration: Date.now() - startTime,
        success: scanIssues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
      };
      
      console.log(`License scan completed: ${result.totalDependencies} dependencies, ${result.issues.length} issues`);
      
      return result;
      
    } catch (error) {
      console.error('License scanning failed:', error);
      
      return {
        totalDependencies: 0,
        dependencies: [],
        licenseSummary: new Map(),
        attributionRequired: 0,
        issues: [{
          type: 'system_error',
          severity: 'critical',
          packageName: 'system',
          version: 'unknown',
          message: `License scanning failed: ${(error as Error).message}`,
        }],
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async generateAttributions(): Promise<AttributionResult> {
    console.log('Generating license attributions...');
    const startTime = Date.now();
    
    try {
      // 1. Scan all dependencies
      const scanResult = await this.scanDependencyLicenses();
      
      if (!scanResult.success) {
        throw new Error('License scan failed, cannot generate attributions');
      }
      
      // 2. Filter dependencies that require attribution
      const attributionDependencies = scanResult.dependencies.filter(dep => dep.attributionRequired);
      console.log(`Found ${attributionDependencies.length} dependencies requiring attribution`);
      
      // 3. Generate attribution documents
      const attributions: AttributionDocument[] = [];
      
      if (this.config.attributionRequirements.generateNotice) {
        const noticeFile = await this.attributionGenerator.generateNoticeFile(attributionDependencies);
        attributions.push(noticeFile);
      }
      
      if (this.config.attributionRequirements.generateThirdPartyLicense) {
        const thirdPartyLicense = await this.attributionGenerator.generateThirdPartyLicenseFile(attributionDependencies);
        attributions.push(thirdPartyLicense);
      }
      
      if (this.config.attributionRequirements.generateCredits) {
        const creditsFile = await this.attributionGenerator.generateCreditsFile(attributionDependencies);
        attributions.push(creditsFile);
      }
      
      if (this.config.attributionRequirements.generateMetadata) {
        const metadataFile = await this.attributionGenerator.generateLicenseMetadata(attributionDependencies);
        attributions.push(metadataFile);
      }
      
      // 4. Apply custom template if configured
      const customAttribution = await this.attributionGenerator.applyCustomTemplate(attributionDependencies);
      if (customAttribution) {
        attributions.push(customAttribution);
      }
      
      // 5. Write attribution files
      for (const attribution of attributions) {
        const outputPath = join(this.config.attributionRequirements.outputDirectory, attribution.filename);
        await fs.writeFile(outputPath, attribution.content, 'utf8');
        console.log(`Generated attribution file: ${outputPath}`);
      }
      
      const result: AttributionResult = {
        attributions,
        dependenciesAttributed: attributionDependencies.length,
        duration: Date.now() - startTime,
        success: true,
      };
      
      console.log(`Attribution generation completed: ${result.dependenciesAttributed} dependencies attributed`);
      
      return result;
      
    } catch (error) {
      console.error('Attribution generation failed:', error);
      
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
    console.log('Validating license compatibility...');
    const startTime = Date.now();
    
    try {
      // 1. Get project license
      const projectLicense = this.config.projectLicense;
      console.log(`Project license: ${projectLicense}`);
      
      // 2. Scan dependency licenses
      const scanResult = await this.scanDependencyLicenses();
      
      if (!scanResult.success) {
        throw new Error('Cannot validate compatibility: license scan failed');
      }
      
      const compatibilityIssues: CompatibilityIssue[] = [];
      const compatibleLicenses: string[] = [];
      
      // 3. Check each dependency license against project license
      for (const dep of scanResult.dependencies) {
        const compatibility = await this.checkLicenseCompatibilityWith(
          dep.license,
          projectLicense
        );
        
        if (compatibility.compatible) {
          compatibleLicenses.push(dep.license.spdxId || dep.license.name);
        } else {
          compatibilityIssues.push({
            packageName: dep.packageName,
            version: dep.version,
            dependencyLicense: dep.license,
            projectLicense,
            issue: compatibility.issue || 'License incompatibility detected',
            severity: compatibility.severity || 'medium',
            recommendation: compatibility.recommendation || 'Review license compatibility manually',
          });
        }
      }
      
      // 4. Check for restricted licenses
      const restrictedLicenses = scanResult.dependencies.filter(dep => 
        this.config.restrictedLicenses.includes(dep.license.spdxId as LicenseType) ||
        this.config.restrictedLicenses.includes(dep.license.name as LicenseType)
      );
      
      for (const dep of restrictedLicenses) {
        compatibilityIssues.push({
          packageName: dep.packageName,
          version: dep.version,
          dependencyLicense: dep.license,
          projectLicense,
          issue: `License ${dep.license.name} is restricted by project policy`,
          severity: 'high',
          recommendation: 'Replace dependency or obtain license exception',
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
        console.log(`License compatibility validation passed: all ${result.totalDependencies} dependencies compatible`);
      } else {
        console.warn(`License compatibility issues found: ${result.issues.length} incompatible dependencies`);
      }
      
      return result;
      
    } catch (error) {
      console.error('License compatibility validation failed:', error);
      
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
    console.log('Generating compliance report...');
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
        overallCompliance: this.calculateComplianceScore(licenseScan, compatibility, attributions),
      };
      
      // 3. Generate recommendations
      const recommendations = await this.generateComplianceRecommendations(
        licenseScan,
        compatibility,
        attributions
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
        success: licenseScan.success && compatibility.success && attributions.success,
      };
      
      // 5. Write report to file
      const reportPath = join(this.config.reportingConfig.outputDirectory, 'compliance-report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
      console.log(`Compliance report generated: ${reportPath}`);
      
      // 6. Generate human-readable report
      const humanReadableReport = await this.generateHumanReadableReport(report);
      const markdownPath = join(this.config.reportingConfig.outputDirectory, 'COMPLIANCE.md');
      await fs.writeFile(markdownPath, humanReadableReport, 'utf8');
      console.log(`Human-readable compliance report generated: ${markdownPath}`);
      
      console.log(`Compliance report generation completed in ${report.duration}ms`);
      
      return report;
      
    } catch (error) {
      console.error('Compliance report generation failed:', error);
      
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
          success: false 
        },
        compatibility: { 
          compatible: false, 
          issues: [], 
          compatibleLicenses: [], 
          totalDependencies: 0, 
          duration: 0, 
          success: false 
        },
        attributions: { 
          attributions: [], 
          dependenciesAttributed: 0, 
          duration: 0, 
          success: false 
        },
        recommendations: [],
        duration: Date.now() - startTime,
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async setupLegalDocumentation(): Promise<DocumentationResult> {
    // This will be implemented in a later subtask
    console.log('setupLegalDocumentation not yet implemented');
    return {
      documentsGenerated: [],
      duration: 0,
      success: false,
      error: 'Not implemented'
    };
  }

  async monitorLicenseChanges(): Promise<MonitoringResult> {
    // This will be implemented in a later subtask
    console.log('monitorLicenseChanges not yet implemented');
    return {
      changesDetected: 0,
      violationsFound: 0,
      alertsSent: 0,
      lastCheck: new Date(),
      nextCheck: new Date(),
      duration: 0,
      success: false,
      error: 'Not implemented'
    };
  }

  // Private helper methods
  private async validateProjectLicense(): Promise<void> {
    const projectLicense = this.licenseDatabase.getLicense(this.config.projectLicense);
    if (!projectLicense) {
      throw new Error(`Project license '${this.config.projectLicense}' not found in license database`);
    }
    console.log(`Project license validated: ${projectLicense.name}`);
  }

  private async scanDependencyLicense(packageName: string, version: string): Promise<DependencyLicense> {
    console.log(`Scanning license for ${packageName}@${version}...`);
    
    // 1. Get package information from scanner
    const packageInfo = await this.dependencyScanner.getPackageInfo(packageName, version);
    
    // 2. Extract license information
    let licenseInfo;
    
    if (packageInfo.license) {
      licenseInfo = await this.dependencyScanner.parseLicenseString(packageInfo.license);
    } else if (packageInfo.licenses) {
      const primaryLicense = Array.isArray(packageInfo.licenses) 
        ? packageInfo.licenses[0] 
        : packageInfo.licenses;
      const licenseString = typeof primaryLicense === 'object' && 'type' in primaryLicense 
        ? primaryLicense.type || 'UNKNOWN'
        : primaryLicense || 'UNKNOWN';
      licenseInfo = await this.dependencyScanner.parseLicenseString(licenseString);
    } else {
      licenseInfo = await this.dependencyScanner.parseLicenseString('UNKNOWN');
    }
    
    // 3. Get copyright holders
    const copyrightHolders = await this.dependencyScanner.extractCopyrightHolders(packageInfo, packageName);
    
    // 4. Determine attribution requirements
    const attributionRequired = this.licenseDatabase.requiresAttribution(licenseInfo.spdxId || licenseInfo.name);
    
    return {
      packageName,
      version: version === 'latest' ? packageInfo.version : version,
      license: licenseInfo,
      licenseFile: packageInfo.licenseFile,
      noticeFile: packageInfo.noticeFile,
      copyrightHolders,
      attributionRequired,
      sourceUrl: packageInfo.repository?.url,
    };
  }

  private async checkLicenseCompatibility(dependency: DependencyLicense): Promise<LicenseScanIssue | null> {
    const isCompatible = this.licenseDatabase.areCompatible(
      this.config.projectLicense,
      dependency.license.spdxId as LicenseType || dependency.license.name as LicenseType
    );

    if (!isCompatible) {
      return {
        type: 'compatibility_issue',
        severity: 'medium',
        packageName: dependency.packageName,
        version: dependency.version,
        message: `License ${dependency.license.name} may not be compatible with project license ${this.config.projectLicense}`,
        recommendation: 'Review license compatibility and consider alternatives'
      };
    }

    return null;
  }

  private async checkLicenseCompatibilityWith(license: any, projectLicense: LicenseType): Promise<{
    compatible: boolean;
    issue?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    recommendation?: string;
  }> {
    const compatible = this.licenseDatabase.areCompatible(
      projectLicense,
      license.spdxId as LicenseType || license.name as LicenseType
    );

    if (!compatible) {
      return {
        compatible: false,
        issue: `License ${license.name} is not compatible with project license ${projectLicense}`,
        severity: 'medium',
        recommendation: 'Consider replacing with a compatible alternative or seek legal review'
      };
    }

    return { compatible: true };
  }

  private generateLicenseSummary(dependencies: DependencyLicense[]): Map<string, number> {
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
    attributions: AttributionResult
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
    attributions: AttributionResult
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (licenseScan.issues.length > 0) {
      recommendations.push(`Address ${licenseScan.issues.length} license scanning issues`);
    }

    if (compatibility.issues.length > 0) {
      recommendations.push(`Resolve ${compatibility.issues.length} license compatibility issues`);
    }

    if (!attributions.success) {
      recommendations.push('Fix attribution generation to ensure proper legal compliance');
    }

    if (licenseScan.attributionRequired > attributions.dependenciesAttributed) {
      recommendations.push(`${licenseScan.attributionRequired - attributions.dependenciesAttributed} dependencies require attribution but were not included`);
    }

    if (recommendations.length === 0) {
      recommendations.push('All legal compliance checks passed successfully');
    }

    return recommendations;
  }

  private async generateHumanReadableReport(report: ComplianceReport): Promise<string> {
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
}