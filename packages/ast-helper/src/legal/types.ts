/**
 * @fileoverview Core types and interfaces for legal compliance management
 */

// Core License Types
export type LicenseType = 
  | 'MIT' 
  | 'Apache-2.0' 
  | 'GPL-3.0' 
  | 'BSD-3-Clause' 
  | 'ISC' 
  | 'GPL-2.0'
  | 'LGPL-3.0'
  | 'LGPL-2.1'
  | 'BSD-2-Clause'
  | 'MPL-2.0'
  | 'CC0-1.0'
  | 'Unlicense'
  | string;

export type ComplianceSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ComplianceStandard = 'SPDX' | 'REUSE' | 'OpenChain' | 'ClearlyDefined';

// Permission, Condition, and Limitation Types
export type Permission = 
  | 'commercial-use'
  | 'modifications'
  | 'distribution'
  | 'private-use'
  | 'patent-use';

export type Condition = 
  | 'include-copyright'
  | 'include-copyright--source'
  | 'document-changes'
  | 'disclose-source'
  | 'network-use-disclose'
  | 'same-license'
  | 'same-license--file'
  | 'same-license--library';

export type Limitation = 
  | 'trademark-use'
  | 'patent-use'
  | 'liability'
  | 'warranty';

// Core Interfaces
export interface LicenseInfo {
  name: string;
  spdxId: string;
  url: string;
  text: string;
  permissions: Permission[];
  conditions: Condition[];
  limitations: Limitation[];
  compatibility: LicenseCompatibility;
}

export interface LicenseCompatibility {
  compatibleWith: LicenseType[];
  incompatibleWith: LicenseType[];
  requiresNotice: boolean;
  requiresSourceDisclosure: boolean;
  allowsLinking: boolean;
  isCopeyleft: boolean;
  copyleftScope: 'file' | 'library' | 'project' | 'network' | null;
}

export interface DependencyLicense {
  packageName: string;
  version: string;
  license: LicenseInfo;
  licenseFile?: string;
  noticeFile?: string;
  copyrightHolders: string[];
  attributionRequired: boolean;
  sourceUrl?: string;
}

// Configuration Interfaces
export interface ComplianceConfig {
  projectLicense: LicenseType;
  allowedLicenses: LicenseType[];
  restrictedLicenses: LicenseType[];
  attributionRequirements: AttributionConfig;
  complianceStandards: ComplianceStandard[];
  reportingConfig: ReportingConfig;
  monitoring: MonitoringConfig;
}

export interface AttributionConfig {
  generateNotice: boolean;
  generateThirdPartyLicense: boolean;
  generateCredits: boolean;
  generateMetadata: boolean;
  includeDevDependencies: boolean;
  customAttributionTemplate?: string;
  outputDirectory: string;
}

export interface ReportingConfig {
  formats: ('json' | 'html' | 'pdf' | 'markdown')[];
  includeFullLicenseTexts: boolean;
  includeVulnerabilityInfo: boolean;
  outputDirectory: string;
  scheduledReports: boolean;
  reportFrequency?: 'daily' | 'weekly' | 'monthly';
}

export interface MonitoringConfig {
  enabled: boolean;
  alertOnLicenseChange: boolean;
  alertOnNewViolations: boolean;
  alertOnRestrictedLicenses: boolean;
  webhookUrl?: string;
  emailRecipients: string[];
  checkFrequency: 'hourly' | 'daily' | 'weekly';
}

// Scan and Analysis Results
export interface LicenseScanResult {
  totalDependencies: number;
  dependencies: DependencyLicense[];
  licenseSummary: Map<string, number>;
  attributionRequired: number;
  issues: LicenseScanIssue[];
  duration: number;
  success: boolean;
  error?: string;
}

export interface LicenseScanIssue {
  type: 'scan_error' | 'license_missing' | 'license_ambiguous' | 'compatibility_issue' | 'restricted_license' | 'system_error';
  severity: ComplianceSeverity;
  packageName: string;
  version: string;
  message: string;
  recommendation?: string;
}

export interface AttributionResult {
  attributions: AttributionDocument[];
  dependenciesAttributed: number;
  duration: number;
  success: boolean;
  error?: string;
}

export interface AttributionDocument {
  filename: string;
  content: string;
  type: 'notice' | 'license' | 'credits' | 'metadata';
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: CompatibilityIssue[];
  compatibleLicenses: string[];
  totalDependencies: number;
  duration: number;
  success: boolean;
  error?: string;
}

export interface CompatibilityIssue {
  packageName: string;
  version: string;
  dependencyLicense: LicenseInfo;
  projectLicense: LicenseType;
  issue: string;
  severity: ComplianceSeverity;
  recommendation: string;
}

export interface ComplianceReport {
  timestamp: Date;
  summary: ComplianceSummary;
  licenseScan: LicenseScanResult;
  compatibility: CompatibilityResult;
  attributions: AttributionResult;
  recommendations: string[];
  duration: number;
  success: boolean;
  error?: string;
}

export interface ComplianceSummary {
  totalDependencies: number;
  licenseIssues: number;
  compatibilityIssues: number;
  attributionRequired: number;
  attributionGenerated: number;
  overallCompliance: number; // 0-100 score
}

// Main Interface
export interface LegalComplianceManager {
  initialize(config: ComplianceConfig): Promise<void>;
  scanDependencyLicenses(): Promise<LicenseScanResult>;
  generateAttributions(): Promise<AttributionResult>;
  validateLicenseCompatibility(): Promise<CompatibilityResult>;
  generateComplianceReport(): Promise<ComplianceReport>;
  setupLegalDocumentation(): Promise<DocumentationResult>;
  monitorLicenseChanges(): Promise<MonitoringResult>;
}

export interface DocumentationResult {
  documentsGenerated: DocumentationFile[];
  duration: number;
  success: boolean;
  error?: string;
}

export interface DocumentationFile {
  filename: string;
  path: string;
  type: 'license' | 'cla' | 'coc' | 'tos' | 'privacy' | 'disclaimer';
  content: string;
}

export interface MonitoringResult {
  changesDetected: number;
  violationsFound: number;
  alertsSent: number;
  lastCheck: Date;
  nextCheck: Date;
  duration: number;
  success: boolean;
  error?: string;
}