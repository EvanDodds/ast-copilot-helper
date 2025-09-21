/**
 * Security Audit and Vulnerability Assessment Types
 * Core type definitions for security auditing system
 */

/**
 * Severity levels for security findings
 */
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Audit levels determine depth and scope of security analysis
 */
export type AuditLevel = 'basic' | 'comprehensive' | 'enterprise';

/**
 * Main security auditor interface
 */
export interface SecurityAuditor {
  initialize(config: SecurityConfig): Promise<void>;
  performComprehensiveAudit(): Promise<SecurityAuditReport>;
  scanVulnerabilities(): Promise<VulnerabilityReport>;
  validateSecurityCompliance(): Promise<ComplianceReport>;
  auditDependencies(): Promise<VulnerabilityReport>;
  testSecurityControls(): Promise<SecurityTestReport>;
}

/**
 * Configuration for comprehensive security system
 */
export interface SecurityConfig {
  /** Audit level for security analysis */
  auditLevel: AuditLevel;
  /** Maximum time for audit operations (ms) */
  maxAuditTime?: number;
  /** Enable dependency scanning */
  dependencyScanning: boolean;
  /** Include third-party dependencies in scan */
  includeThirdParty: boolean;
  /** Enable penetration testing (use with caution) */
  penetrationTesting: boolean;
  /** Compliance frameworks to validate against */
  complianceFrameworks: string[];
  /** Enable code analysis scanning */
  codeAnalysis?: boolean;
  /** Enable configuration audit */
  configurationAudit?: boolean;
  /** Custom security rules */
  customRules?: any[];

  /** Audit configuration */
  audit: {
    /** Level of audit detail */
    level: AuditLevel;
    /** Maximum time for audit operations (ms) */
    maxAuditTime: number;
    /** Enable dependency scanning */
    enableDependencyScanning: boolean;
    /** Compliance frameworks to validate against */
    complianceFrameworks: string[];
  };

  /** Vulnerability detection configuration */
  vulnerability: {
    /** Enable vulnerability scanning */
    enabled: boolean;
    /** Severity levels to report */
    reportSeverities: SecuritySeverity[];
    /** Custom vulnerability patterns */
    customPatterns: string[];
  };

  /** Security hardening configuration */
  hardening: {
    /** Enable security hardening checks */
    enabled: boolean;
    /** Security rules to apply */
    rules: SecurityRule[];
  };

  /** Compliance reporting configuration */
  compliance: {
    /** Enable compliance reporting */
    enabled: boolean;
    /** Output format for reports */
    reportFormat: 'json' | 'xml' | 'html' | 'pdf';
    /** Include remediation suggestions */
    includeRemediation: boolean;
  };
}

/**
 * Input validation and sanitization types
 */

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  validate: (input: unknown, context?: ValidationContext) => Promise<{ isValid: boolean; message: string }>;
}

export interface SanitizationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  sanitize: (input: unknown, context?: SanitizationContext) => Promise<string>;
}

export interface ValidationContext {
  inputType?: 'text' | 'path' | 'command' | 'sql' | 'html' | 'url' | 'email';
  source?: string;
  userRole?: string;
  additionalRules?: string[];
}

export interface SanitizationContext {
  inputType?: 'text' | 'path' | 'command' | 'sql' | 'html' | 'url' | 'email';
  outputFormat?: 'plain' | 'html' | 'json' | 'xml';
  preserveFormatting?: boolean;
  strictMode?: boolean;
}

export interface InputValidationResult {
  isValid: boolean;
  message: string;
  violations: string[];
  timestamp: string;
  context: Record<string, any>;
}

export interface SanitizationResult {
  sanitizedInput: string;
  wasModified: boolean;
  message: string;
  timestamp: string;
  context: Record<string, any>;
}

export interface InputValidationConfig {
  sqlInjection: {
    enabled: boolean;
    strictMode: boolean;
    blockedPatterns: RegExp[];
    allowedCharacters: RegExp;
    maxLength: number;
  };
  xssProtection: {
    enabled: boolean;
    strictMode: boolean;
    blockedTags: string[];
    blockedAttributes: string[];
    blockedPatterns: RegExp[];
    allowedTags: string[];
    encodeOutput: boolean;
  };
  pathTraversal: {
    enabled: boolean;
    strictMode: boolean;
    blockedPatterns: RegExp[];
    allowedPaths: string[];
    maxPathLength: number;
    allowAbsolutePaths: boolean;
  };
  commandInjection: {
    enabled: boolean;
    strictMode: boolean;
    blockedCommands: string[];
    blockedPatterns: RegExp[];
    allowedCharacters: RegExp;
    maxLength: number;
  };
  dataTypes: {
    enabled: boolean;
    strictTypeChecking: boolean;
    allowedTypes: string[];
    maxStringLength: number;
    maxArrayLength: number;
    maxObjectDepth: number;
    numberRange: {
      min: number;
      max: number;
    };
  };
  general: {
    caseSensitive: boolean;
    trimWhitespace: boolean;
    normalizeUnicode: boolean;
    maxInputSize: number;
    enableLogging: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
  };
}

/**
 * Custom security rule definition
 */
export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  severity: SecuritySeverity;
  pattern?: RegExp;
  validator?: (context: SecurityContext) => SecurityFinding[];
}

/**
 * Security context for rule evaluation
 */
export interface SecurityContext {
  filePath?: string;
  content?: string;
  dependencies?: DependencyInfo[];
  configuration?: Record<string, unknown>;
}

/**
 * Individual security finding
 */
export interface SecurityFinding {
  title: string;
  description: string;
  severity: SecuritySeverity;
  category: string;
  file?: string;
  line?: number;
  column?: number;
  recommendation: string;
  references?: string[];
  cwe?: string;
  owasp?: string;
}

/**
 * Security audit section result
 */
export interface SecurityAuditSection {
  name: string;
  severity: SecuritySeverity;
  findings: SecurityFinding[];
  recommendations: string[];
  score?: number;
}

/**
 * Complete security audit report
 */
export interface SecurityAuditReport {
  timestamp: Date;
  duration: number;
  overallScore: number;
  overallSeverity: SecuritySeverity;
  auditSections: SecurityAuditSection[];
  summary: string;
  recommendations: string[];
  complianceStatus: ComplianceStatus;
  error?: string;
}

/**
 * Compliance framework validation status
 */
export interface ComplianceStatus {
  compliant: boolean;
  frameworks: FrameworkCompliance[];
}

/**
 * Individual framework compliance result
 */
export interface FrameworkCompliance {
  name: string;
  version: string;
  compliant: boolean;
  score: number;
  failedChecks: string[];
  recommendations: string[];
}

/**
 * Vulnerability report for dependencies
 */
export interface VulnerabilityReport {
  timestamp: string;
  scanDuration: number;
  totalFindings: number;
  findingsBySeverity: Record<SecuritySeverity, VulnerabilityFinding[]>;
  findings: VulnerabilityFinding[];
  hotspots: SecurityHotspot[];
  summary: VulnerabilityReportSummary;
  metadata: {
    scannerVersion: string;
    patternsUsed: string[];
    configLevel: string;
  };
  // Legacy compatibility
  totalDependencies?: number;
  vulnerabilities?: Vulnerability[];
  recommendations?: string[];
  overallRisk?: SecuritySeverity;
  error?: string;
}

/**
 * Summary of vulnerability report
 */
export interface VulnerabilityReportSummary {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  hotspotsCount: number;
  riskScore: number;
}

/**
 * Individual vulnerability finding
 */
export interface VulnerabilityFinding {
  id: string;
  title: string;
  description: string;
  severity: SecuritySeverity;
  category: 'injection' | 'xss' | 'cryptographic' | 'authentication' | 'authorization' | 'configuration' | 'dependency' | 'other';
  location: {
    file: string;
    line: number;
    column?: number;
    snippet?: string;
  };
  cveIds?: string[];
  owaspCategories?: string[];
  cweIds?: string[];
  remediation: string;
  references: string[];
  confidence: 'high' | 'medium' | 'low';
  firstDetected: string;
}

/**
 * Security hotspot for prioritized attention
 */
export interface SecurityHotspot {
  id: string;
  title: string;
  description: string;
  severity: SecuritySeverity;
  confidence: 'high' | 'medium' | 'low';
  location: {
    file: string;
    line: number;
    column?: number;
    snippet?: string;
  };
  category: string;
  remediation: string;
  references: string[];
}

/**
 * Individual vulnerability information
 */
export interface Vulnerability {
  package: string;
  version: string;
  vulnerability: string;
  description: string;
  severity: SecuritySeverity;
  cve?: string;
  recommendation: string;
  fixedIn?: string;
}

/**
 * Dependency information for security analysis
 */
export interface DependencyInfo {
  name: string;
  version: string;
  license?: string;
  path: string;
  dependencies?: DependencyInfo[];
}

/**
 * Compliance report for standards validation
 */
export interface ComplianceReport {
  timestamp: Date;
  frameworks: FrameworkCompliance[];
  overallScore: number;
  compliant: boolean;
  recommendations: string[];
}

/**
 * Security test report
 */
export interface SecurityTestReport {
  timestamp: Date;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  vulnerabilitiesFound: number;
  recommendations: string[];
}

/**
 * Rate limiting information
 */
export interface RateLimitInfo {
  requests: number;
  windowStart: number;
  blocked: boolean;
}

/**
 * Validation result for inputs
 */
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  sanitizedInput?: string;
}

/**
 * Individual validation issue
 */
export interface ValidationIssue {
  type: string;
  severity: SecuritySeverity;
  message: string;
  value: string;
}

/**
 * Injection threat detection result
 */
export interface InjectionThreat {
  type: 'sql_injection' | 'path_traversal' | 'command_injection' | 'xss';
  severity: SecuritySeverity;
  pattern: string;
  matchedText: string;
  description: string;
}

/**
 * Security metrics for tracking
 */
export interface SecurityMetrics {
  timestamp: Date;
  auditsPerformed: number;
  vulnerabilitiesFound: number;
  averageAuditTime: number;
  complianceScore: number;
  trendsData: SecurityTrendData[];
}

/**
 * Security trend data point
 */
export interface SecurityTrendData {
  date: Date;
  vulnerabilities: number;
  complianceScore: number;
  auditTime: number;
}