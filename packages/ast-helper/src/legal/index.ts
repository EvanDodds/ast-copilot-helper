/**
 * @fileoverview Main exports for the legal compliance module
 */

// Core exports
export * from './types.js';
export { LicenseDatabase } from './LicenseDatabase.js';
export { DependencyScanner } from './DependencyScanner.js';
export { AdvancedLicenseScanner } from './AdvancedLicenseScanner.js';
export { AttributionGenerator } from './AttributionGenerator.js';
export { AdvancedAttributionGenerator } from './AdvancedAttributionGenerator.js';
export { DependencyLicenseAnalyzer } from './DependencyLicenseAnalyzer.js';
export { LegalDocumentTemplateEngine } from './LegalDocumentTemplateEngine.js';
export { ComprehensiveLegalComplianceManager } from './ComprehensiveLegalComplianceManager.js';

// Default configuration
export const defaultComplianceConfig = {
  projectLicense: 'MIT',
  allowedLicenses: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC'],
  restrictedLicenses: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
  attributionRequirements: {
    generateNotice: true,
    generateThirdPartyLicense: true,
    generateCredits: true,
    generateMetadata: true,
    includeDevDependencies: false,
    outputDirectory: './legal',
  },
  complianceStandards: ['SPDX', 'OpenChain'],
  reportingConfig: {
    formats: ['json', 'markdown'],
    includeFullLicenseTexts: true,
    includeVulnerabilityInfo: false,
    outputDirectory: './reports',
    scheduledReports: false,
  },
  monitoring: {
    enabled: false,
    alertOnLicenseChange: true,
    alertOnNewViolations: true,
    alertOnRestrictedLicenses: true,
    emailRecipients: [],
    checkFrequency: 'daily',
  },
};