/**
 * @fileoverview Security and compliance validation types
 */

// Base Security Validation Types
export interface SecurityValidationConfig {
  enabled: boolean;
  vulnerabilityScanning: {
    enabled: boolean;
    sources: string[];
    severity: SecuritySeverity[];
    autoFix: boolean;
    allowList: string[];
  };
  inputValidation: {
    enabled: boolean;
    strictMode: boolean;
    sanitization: SanitizationConfig;
    validation: ValidationConfig;
  };
  authentication: {
    enabled: boolean;
    methods: AuthMethod[];
    tokenExpiry: number;
    requirements: AuthRequirement[];
  };
  dataPrivacy: {
    enabled: boolean;
    gdprCompliant: boolean;
    dataRetention: DataRetentionPolicy;
    anonymization: AnonymizationConfig;
  };
  networkSecurity: {
    enabled: boolean;
    encryption: EncryptionConfig;
    protocols: SecurityProtocol[];
    certificates: CertificateConfig;
  };
  compliance: {
    enabled: boolean;
    standards: ComplianceStandard[];
    auditing: AuditingConfig;
    reporting: ComplianceReportConfig;
  };
}

export type SecuritySeverity = "low" | "medium" | "high" | "critical";
export type AuthMethod = "token" | "oauth" | "saml" | "api-key";
export type SecurityProtocol = "https" | "tls" | "wss" | "ssh";
export type ComplianceStandard = "gdpr" | "ccpa" | "hipaa" | "sox" | "iso27001";

export interface SanitizationConfig {
  enabled: boolean;
  methods: SanitizationMethod[];
  customRules: SanitizationRule[];
}

export interface ValidationConfig {
  enabled: boolean;
  rules: ValidationRule[];
  customValidators: CustomValidator[];
}

export interface AuthRequirement {
  type: "password-strength" | "mfa" | "session-timeout" | "lockout-policy";
  config: Record<string, unknown>;
}

export interface DataRetentionPolicy {
  enabled: boolean;
  defaultRetention: number; // days
  categories: DataCategory[];
  autoDelete: boolean;
}

export interface AnonymizationConfig {
  enabled: boolean;
  methods: AnonymizationMethod[];
  sensitiveFields: string[];
}

export interface EncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keySize: number;
  transport: boolean;
  atRest: boolean;
}

export interface CertificateConfig {
  enabled: boolean;
  validation: boolean;
  expiration: boolean;
  selfSigned: boolean;
}

export interface AuditingConfig {
  enabled: boolean;
  events: AuditEvent[];
  retention: number; // days
  encryption: boolean;
}

export interface ComplianceReportConfig {
  enabled: boolean;
  frequency: ReportFrequency;
  recipients: string[];
  format: ReportFormat[];
}

export type SanitizationMethod =
  | "html-escape"
  | "sql-escape"
  | "path-sanitize"
  | "xss-filter";
export type AnonymizationMethod = "mask" | "hash" | "tokenize" | "remove";
export type AuditEvent =
  | "login"
  | "data-access"
  | "permission-change"
  | "system-error";
export type ReportFrequency = "daily" | "weekly" | "monthly" | "quarterly";
export type ReportFormat = "pdf" | "html" | "json" | "csv";

export interface SanitizationRule {
  name: string;
  pattern: RegExp;
  replacement: string;
  enabled: boolean;
}

export interface ValidationRule {
  name: string;
  field: string;
  type: ValidationType;
  config: ValidationRuleConfig;
  required: boolean;
}

export interface CustomValidator {
  name: string;
  function: (value: unknown) => ValidationResult;
  async: boolean;
}

export interface DataCategory {
  name: string;
  retention: number; // days
  sensitive: boolean;
  encryption: boolean;
}

export type ValidationType =
  | "email"
  | "phone"
  | "url"
  | "regex"
  | "length"
  | "numeric"
  | "date";

export interface ValidationRuleConfig {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  format?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Security Test Results
export interface SecurityValidationResult {
  passed: boolean;
  score: number; // 0-100
  timestamp: string;
  environment: SecurityEnvironment;
  categories: SecurityCategoryResult[];
  summary: SecuritySummary;
  recommendations: SecurityRecommendation[];
  compliance: ComplianceResult;
}

export interface SecurityEnvironment {
  platform: string;
  nodeVersion: string;
  dependencies: DependencyInfo[];
  networkConfig: NetworkConfig;
}

export interface DependencyInfo {
  name: string;
  version: string;
  vulnerabilities: SecurityVulnerability[];
  license: string;
  deprecated: boolean;
}

export interface NetworkConfig {
  protocols: string[];
  ports: number[];
  encryption: boolean;
  certificates: CertificateInfo[];
}

export interface CertificateInfo {
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  expired: boolean;
}

export interface SecurityCategoryResult {
  category: SecurityCategory;
  passed: boolean;
  score: number;
  tests: SecurityTestResult[];
  criticalIssues: number;
  totalTests: number;
}

export interface SecurityTestResult {
  name: string;
  passed: boolean;
  severity: SecuritySeverity;
  description: string;
  details?: unknown;
  fix?: string;
  timestamp: string;
}

export interface SecuritySummary {
  overallScore: number;
  criticalIssues: number;
  highSeverityIssues: number;
  totalTests: number;
  passedTests: number;
  complianceScore: number;
}

export interface SecurityRecommendation {
  category: SecurityCategory;
  severity: SecuritySeverity;
  title: string;
  description: string;
  action: string;
  impact: ImpactLevel;
  effort: EffortLevel;
}

export interface ComplianceResult {
  standards: ComplianceStandardResult[];
  overallScore: number;
  certifications: CertificationStatus[];
  gaps: ComplianceGap[];
}

export interface ComplianceStandardResult {
  standard: ComplianceStandard;
  compliant: boolean;
  score: number;
  requirements: RequirementResult[];
}

export interface RequirementResult {
  id: string;
  name: string;
  met: boolean;
  evidence: string[];
  gaps: string[];
}

export interface CertificationStatus {
  name: string;
  status: CertificationState;
  validUntil?: string;
  lastAudit: string;
}

export interface ComplianceGap {
  standard: ComplianceStandard;
  requirement: string;
  description: string;
  severity: SecuritySeverity;
  remediation: string;
}

export interface SecurityVulnerability {
  id: string;
  severity: SecuritySeverity;
  title: string;
  description: string;
  cwe?: string;
  cve?: string;
  references: string[];
  patchAvailable: boolean;
  fixedIn?: string;
}

export type SecurityCategory =
  | "vulnerability-scanning"
  | "input-validation"
  | "authentication"
  | "data-privacy"
  | "network-security"
  | "code-security"
  | "compliance";

export type ImpactLevel = "low" | "medium" | "high" | "critical";
export type EffortLevel =
  | "trivial"
  | "minor"
  | "moderate"
  | "major"
  | "extreme";
export type CertificationState =
  | "valid"
  | "expired"
  | "pending"
  | "revoked"
  | "not-applicable";

// Security Validation Events
export interface SecurityValidationEvents {
  "test:start": { category: SecurityCategory; testName: string };
  "test:complete": { category: SecurityCategory; result: SecurityTestResult };
  "vulnerability:found": {
    vulnerability: SecurityVulnerability;
    package: string;
  };
  "compliance:gap": { gap: ComplianceGap };
  "recommendation:generated": { recommendation: SecurityRecommendation };
  "validation:complete": { result: SecurityValidationResult };
}

// Default Configuration
export const DEFAULT_SECURITY_CONFIG: SecurityValidationConfig = {
  enabled: true,
  vulnerabilityScanning: {
    enabled: true,
    sources: ["npm-audit", "snyk", "owasp"],
    severity: ["medium", "high", "critical"],
    autoFix: false,
    allowList: [],
  },
  inputValidation: {
    enabled: true,
    strictMode: true,
    sanitization: {
      enabled: true,
      methods: ["html-escape", "sql-escape", "xss-filter"],
      customRules: [],
    },
    validation: {
      enabled: true,
      rules: [],
      customValidators: [],
    },
  },
  authentication: {
    enabled: true,
    methods: ["token", "api-key"],
    tokenExpiry: 3600000, // 1 hour
    requirements: [
      {
        type: "password-strength",
        config: { minLength: 8, requireSpecialChars: true },
      },
    ],
  },
  dataPrivacy: {
    enabled: true,
    gdprCompliant: true,
    dataRetention: {
      enabled: true,
      defaultRetention: 365,
      categories: [],
      autoDelete: true,
    },
    anonymization: {
      enabled: true,
      methods: ["hash", "mask"],
      sensitiveFields: ["email", "phone", "ssn"],
    },
  },
  networkSecurity: {
    enabled: true,
    encryption: {
      enabled: true,
      algorithm: "AES-256-GCM",
      keySize: 256,
      transport: true,
      atRest: true,
    },
    protocols: ["https", "tls"],
    certificates: {
      enabled: true,
      validation: true,
      expiration: true,
      selfSigned: false,
    },
  },
  compliance: {
    enabled: true,
    standards: ["gdpr"],
    auditing: {
      enabled: true,
      events: ["login", "data-access", "permission-change"],
      retention: 2555, // 7 years
      encryption: true,
    },
    reporting: {
      enabled: true,
      frequency: "monthly",
      recipients: [],
      format: ["json", "html"],
    },
  },
};
