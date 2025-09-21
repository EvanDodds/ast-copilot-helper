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
 * Security audit configuration
 */
export interface SecurityConfig {
  /** Level of audit depth to perform */
  auditLevel: AuditLevel;
  
  /** Include third-party code analysis */
  includeThirdParty: boolean;
  
  /** Enable dependency vulnerability scanning */
  dependencyScanning: boolean;
  
  /** Enable static code analysis */
  codeAnalysis: boolean;
  
  /** Enable configuration security audit */
  configurationAudit: boolean;
  
  /** Enable penetration testing simulation */
  penetrationTesting: boolean;
  
  /** Compliance frameworks to validate against */
  complianceFrameworks: string[];
  
  /** Maximum time to spend on audit in milliseconds */
  maxAuditTime?: number;
  
  /** Custom security rules to apply */
  customRules?: SecurityRule[];
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
  timestamp: Date;
  totalDependencies: number;
  vulnerabilities: Vulnerability[];
  recommendations: string[];
  overallRisk: SecuritySeverity;
  error?: string;
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