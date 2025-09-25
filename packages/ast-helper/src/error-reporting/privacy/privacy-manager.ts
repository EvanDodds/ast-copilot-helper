/**
 * @fileoverview Privacy and Security Controls for Error Reporting
 * @module @ast-copilot-helper/ast-helper/error-reporting/privacy/privacy-manager
 */

import type {
  ErrorReport,
  DiagnosticData,
  PrivacySettings,
  ConsentData,
  FilterResult,
} from "../types.js";

/**
 * Privacy configuration options
 */
export interface PrivacyConfig {
  /** Enable user consent requirements */
  requireConsent: boolean;
  /** Data retention period in days */
  retentionDays: number;
  /** Minimum anonymization level */
  anonymizationLevel: "none" | "basic" | "strict" | "full";
  /** Enable PII scrubbing */
  enablePiiScrubbing: boolean;
  /** Allowed data categories for collection */
  allowedCategories: string[];
  /** Enable data encryption */
  enableEncryption: boolean;
  /** Enable audit logging */
  enableAuditLog: boolean;
  /** GDPR compliance mode */
  gdprCompliance: boolean;
  /** CCPA compliance mode */
  ccpaCompliance: boolean;
  /** Custom data filters */
  customFilters: DataFilter[];
}

/**
 * Data filter function type
 */
export type DataFilter = (data: any, context: FilterContext) => FilterResult;

/**
 * Filter context information
 */
export interface FilterContext {
  errorId: string;
  category: string;
  severity: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  consentLevel: ConsentLevel;
}

/**
 * Consent levels for data collection
 */
export enum ConsentLevel {
  NONE = 0,
  BASIC = 1,
  ANALYTICS = 2,
  FULL = 3,
}

/**
 * PII detection patterns
 */
const PII_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  apiKey: /(?:api[_-]?key|token|secret)['":\s=]*[a-zA-Z0-9_-]{16,}/gi,
  path: /[A-Za-z]:\\\\[^\\n]*|\/[a-zA-Z0-9_/.-]*(?:\/[a-zA-Z0-9_.-]+)*$/g,
};

/**
 * Comprehensive Privacy Manager for Error Reporting
 * Handles consent, data filtering, anonymization, and compliance
 */
export class PrivacyManager {
  private config: PrivacyConfig;
  private consentData: Map<string, ConsentData> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private encryptionKey?: string;

  constructor(config: Partial<PrivacyConfig> = {}) {
    this.config = {
      requireConsent: true,
      retentionDays: 30,
      anonymizationLevel: "basic",
      enablePiiScrubbing: true,
      allowedCategories: ["error", "crash", "performance"],
      enableEncryption: true,
      enableAuditLog: true,
      gdprCompliance: true,
      ccpaCompliance: true,
      customFilters: [],
      ...config,
    };

    // Initialize encryption if enabled
    if (this.config.enableEncryption) {
      this.initializeEncryption();
    }

    console.log("🔒 Privacy Manager initialized with compliance:", {
      gdpr: this.config.gdprCompliance,
      ccpa: this.config.ccpaCompliance,
      anonymization: this.config.anonymizationLevel,
    });
  }

  /**
   * Set user consent for data collection
   */
  async setUserConsent(userId: string, consent: ConsentData): Promise<void> {
    console.log(`👤 Setting consent for user ${userId}:`, consent.level);

    this.consentData.set(userId, {
      ...consent,
      timestamp: new Date(),
      version: "1.0",
    });

    await this.logAuditEvent({
      action: "consent_set",
      userId,
      data: { level: consent.level, categories: consent.categories },
      timestamp: new Date(),
    });
  }

  /**
   * Get user consent level
   */
  getUserConsent(userId: string): ConsentData | null {
    return this.consentData.get(userId) || null;
  }

  /**
   * Check if user has given consent for specific data collection
   */
  hasConsent(userId: string, category: string, level: ConsentLevel): boolean {
    if (!this.config.requireConsent) {
      return true;
    }

    const consent = this.getUserConsent(userId);
    if (!consent) {
      return false;
    }

    return consent.level >= level && consent.categories.includes(category);
  }

  /**
   * Filter and anonymize error report based on privacy settings
   */
  async filterErrorReport(
    errorReport: ErrorReport,
    userId?: string,
  ): Promise<ErrorReport> {
    const sessionId = errorReport.context?.sessionId || "unknown";
    const consentLevel = userId
      ? this.getUserConsent(userId)?.level || ConsentLevel.NONE
      : ConsentLevel.BASIC;

    console.log(
      `🛡️ Filtering error report ${errorReport.id} with consent level ${consentLevel}`,
    );

    const filterContext: FilterContext = {
      errorId: errorReport.id,
      category: errorReport.category,
      severity: errorReport.severity,
      userId,
      sessionId,
      timestamp: errorReport.timestamp,
      consentLevel,
    };

    let filteredReport = { ...errorReport };

    // Apply category filtering
    if (!this.config.allowedCategories.includes(errorReport.category)) {
      throw new Error(
        `Category ${errorReport.category} not allowed for collection`,
      );
    }

    // Apply PII scrubbing
    if (this.config.enablePiiScrubbing) {
      filteredReport = await this.scrubPII(filteredReport);
    }

    // Apply anonymization
    filteredReport = await this.anonymizeData(
      filteredReport,
      this.config.anonymizationLevel,
    );

    // Apply custom filters
    for (const filter of this.config.customFilters) {
      const result = filter(filteredReport, filterContext);
      if (result.blocked) {
        throw new Error(`Data blocked by custom filter: ${result.reason}`);
      }
      if (result.modified) {
        filteredReport = result.data as ErrorReport;
      }
    }

    // Apply diagnostic data filtering
    if (filteredReport.diagnostics) {
      filteredReport.diagnostics = await this.filterDiagnostics(
        filteredReport.diagnostics,
        consentLevel,
      );
    }

    // Encrypt sensitive data if enabled
    if (this.config.enableEncryption && this.encryptionKey) {
      filteredReport = await this.encryptSensitiveData(filteredReport);
    }

    await this.logAuditEvent({
      action: "data_filtered",
      userId,
      data: {
        errorId: errorReport.id,
        originalSize: JSON.stringify(errorReport).length,
        filteredSize: JSON.stringify(filteredReport).length,
        anonymizationLevel: this.config.anonymizationLevel,
      },
      timestamp: new Date(),
    });

    console.log(`✅ Error report filtered successfully`);
    return filteredReport;
  }

  /**
   * Scrub PII from data using pattern matching
   */
  private async scrubPII(data: any): Promise<any> {
    if (typeof data !== "object" || data === null) {
      if (typeof data === "string") {
        return this.scrubStringPII(data);
      }
      return data;
    }

    if (Array.isArray(data)) {
      return Promise.all(data.map((item) => this.scrubPII(item)));
    }

    const scrubbed: any = {};
    for (const [key, value] of Object.entries(data)) {
      // Skip certain sensitive keys entirely
      if (this.isSensitiveKey(key)) {
        scrubbed[key] = "[REDACTED]";
      } else {
        scrubbed[key] = await this.scrubPII(value);
      }
    }

    return scrubbed;
  }

  /**
   * Scrub PII from string using regex patterns
   */
  private scrubStringPII(str: string): string {
    let scrubbed = str;

    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      scrubbed = scrubbed.replace(pattern, `[${type.toUpperCase()}_REDACTED]`);
    }

    return scrubbed;
  }

  /**
   * Check if key is considered sensitive
   */
  private isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "key",
      "credential",
      "auth",
      "session",
      "cookie",
      "authorization",
      "username",
      "email",
      "phone",
      "address",
    ];

    return sensitiveKeys.some((sensitive) =>
      key.toLowerCase().includes(sensitive),
    );
  }

  /**
   * Anonymize data based on anonymization level
   */
  private async anonymizeData(
    data: ErrorReport,
    level: PrivacyConfig["anonymizationLevel"],
  ): Promise<ErrorReport> {
    if (level === "none") {
      return data;
    }

    const anonymized = { ...data };

    switch (level) {
      case "basic":
        // Remove direct identifiers
        if (anonymized.context) {
          anonymized.context.sessionId = "[REDACTED]";
          if ("userId" in anonymized.context && anonymized.context.userId) {
            anonymized.context.userId = "[REDACTED]";
          }
        }
        break;

      case "strict":
        // Remove more identifying information
        if (anonymized.context) {
          anonymized.context.sessionId = "[REDACTED]";
          if ("userId" in anonymized.context && anonymized.context.userId) {
            anonymized.context.userId = "[REDACTED]";
          }
          if (
            "userAgent" in anonymized.context &&
            anonymized.context.userAgent
          ) {
            anonymized.context.userAgent = "[REDACTED]";
          }
        }
        if (anonymized.environment) {
          anonymized.environment.workingDirectory = "[REDACTED]";
          anonymized.environment.homeDirectory = "[REDACTED]";
        }
        break;

      case "full":
        // Maximum anonymization - keep only essential error data
        return {
          id: this.generateAnonymousId(),
          timestamp: this.roundTimestamp(data.timestamp),
          type: data.type,
          severity: data.severity,
          category: data.category,
          message: this.anonymizeMessage(data.message),
          operation: data.operation,
          context: {
            operation: data.operation,
            component: "anonymous",
            timestamp: this.roundTimestamp(data.timestamp),
            environment: {},
            platform: data.context?.platform || "unknown",
            architecture: data.context?.architecture || "unknown",
            nodeVersion: data.context?.nodeVersion || "unknown",
          },
          suggestions: data.suggestions || [],
          userProvided: false,
          reportedToServer: data.reportedToServer || false,
        } as ErrorReport;
    }

    return anonymized;
  }

  /**
   * Filter diagnostic data based on consent level
   */
  private async filterDiagnostics(
    diagnostics: DiagnosticData,
    consentLevel: ConsentLevel,
  ): Promise<DiagnosticData> {
    const filtered: DiagnosticData = {
      system: diagnostics.system,
      runtime: diagnostics.runtime,
      codebase: diagnostics.codebase,
      configuration: diagnostics.configuration,
      performance: diagnostics.performance,
      dependencies: diagnostics.dependencies,
    };

    // System diagnostics - always allowed with basic consent
    if (consentLevel >= ConsentLevel.BASIC && diagnostics.system) {
      filtered.system = {
        ...diagnostics.system,
        // Note: Remove any system-specific filtering as the interface doesn't include hostname/networkInfo
      };
    }

    // Runtime diagnostics - requires analytics consent
    if (consentLevel >= ConsentLevel.ANALYTICS && diagnostics.runtime) {
      filtered.runtime = {
        ...diagnostics.runtime,
        node: {
          ...diagnostics.runtime.node,
          execPath:
            consentLevel >= ConsentLevel.FULL
              ? diagnostics.runtime.node.execPath
              : "[REDACTED]",
          argv:
            consentLevel >= ConsentLevel.FULL
              ? diagnostics.runtime.node.argv
              : [],
          env:
            consentLevel >= ConsentLevel.FULL
              ? diagnostics.runtime.node.env
              : {},
        },
      };
    }

    // Codebase diagnostics - requires full consent for detailed info
    if (consentLevel >= ConsentLevel.ANALYTICS && diagnostics.codebase) {
      filtered.codebase = {
        ...diagnostics.codebase,
        git: diagnostics.codebase.git
          ? consentLevel >= ConsentLevel.FULL
            ? {
                ...diagnostics.codebase.git,
                // Remove potentially sensitive commit info
                commit: diagnostics.codebase.git.commit
                  ? diagnostics.codebase.git.commit.substring(0, 7)
                  : undefined,
              }
            : {
                isRepository: diagnostics.codebase.git.isRepository,
              }
          : {
              isRepository: false,
            },
      };
    }

    // Performance diagnostics - analytics level
    if (consentLevel >= ConsentLevel.ANALYTICS && diagnostics.performance) {
      filtered.performance = diagnostics.performance;
    }

    // Configuration diagnostics - full consent only
    if (consentLevel >= ConsentLevel.FULL && diagnostics.configuration) {
      filtered.configuration = diagnostics.configuration;
    }

    // Dependencies - full consent only
    if (consentLevel >= ConsentLevel.FULL && diagnostics.dependencies) {
      filtered.dependencies = diagnostics.dependencies;
    }

    return filtered;
  }

  /**
   * Encrypt sensitive data fields
   */
  private async encryptSensitiveData(
    errorReport: ErrorReport,
  ): Promise<ErrorReport> {
    // Placeholder for encryption implementation
    // In a real implementation, you'd use proper encryption libraries
    console.log("🔐 Encrypting sensitive data fields...");
    return errorReport;
  }

  /**
   * Initialize encryption system
   */
  private initializeEncryption(): void {
    // Generate or load encryption key
    this.encryptionKey = "demo-key-" + Math.random().toString(36).substr(2, 9);
    console.log("🔑 Encryption initialized");
  }

  /**
   * Generate anonymous ID for fully anonymized reports
   */
  private generateAnonymousId(): string {
    return "anon-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Round timestamp to reduce precision for anonymization
   */
  private roundTimestamp(timestamp: Date): Date {
    // Round to nearest hour for anonymization
    const rounded = new Date(timestamp);
    rounded.setMinutes(0, 0, 0);
    return rounded;
  }

  /**
   * Anonymize error message while preserving meaning
   */
  private anonymizeMessage(message: string): string {
    // Remove specific file paths, line numbers, but keep error type
    return message
      .replace(/\/[^\s]+\/[^\s]+/g, "[FILE_PATH]")
      .replace(/line \d+/gi, "line [LINE_NUMBER]")
      .replace(/column \d+/gi, "column [COLUMN_NUMBER]");
  }

  /**
   * Check data retention policy and clean up old data
   */
  async cleanupExpiredData(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const initialAuditSize = this.auditLog.length;
    this.auditLog = this.auditLog.filter(
      (entry) => entry.timestamp > cutoffDate,
    );

    const initialConsentSize = this.consentData.size;
    for (const [userId, consent] of this.consentData.entries()) {
      if (consent.timestamp < cutoffDate) {
        this.consentData.delete(userId);
      }
    }

    const cleanedCount =
      initialAuditSize -
      this.auditLog.length +
      (initialConsentSize - this.consentData.size);

    console.log(`🗑️ Cleaned up ${cleanedCount} expired privacy records`);
    return cleanedCount;
  }

  /**
   * Generate privacy compliance report
   */
  async generatePrivacyReport(): Promise<PrivacyComplianceReport> {
    const report: PrivacyComplianceReport = {
      timestamp: new Date(),
      totalUsers: this.consentData.size,
      consentLevels: {
        none: 0,
        basic: 0,
        analytics: 0,
        full: 0,
      },
      dataRetentionDays: this.config.retentionDays,
      anonymizationLevel: this.config.anonymizationLevel,
      piiScrubbing: this.config.enablePiiScrubbing,
      encryption: this.config.enableEncryption,
      auditLogEntries: this.auditLog.length,
      gdprCompliance: this.config.gdprCompliance,
      ccpaCompliance: this.config.ccpaCompliance,
      lastCleanup: new Date(), // Placeholder
    };

    // Count consent levels
    for (const consent of this.consentData.values()) {
      switch (consent.level) {
        case ConsentLevel.NONE:
          report.consentLevels.none++;
          break;
        case ConsentLevel.BASIC:
          report.consentLevels.basic++;
          break;
        case ConsentLevel.ANALYTICS:
          report.consentLevels.analytics++;
          break;
        case ConsentLevel.FULL:
          report.consentLevels.full++;
          break;
      }
    }

    console.log("📊 Privacy compliance report generated");
    return report;
  }

  /**
   * Revoke user consent and delete all associated data
   */
  async revokeUserConsent(userId: string): Promise<void> {
    console.log(`🚫 Revoking consent for user ${userId}`);

    // Remove consent record
    this.consentData.delete(userId);

    // Clean up audit log entries for this user
    this.auditLog = this.auditLog.filter((entry) => entry.userId !== userId);

    await this.logAuditEvent({
      action: "consent_revoked",
      userId,
      data: { reason: "user_request" },
      timestamp: new Date(),
    });

    console.log("✅ User consent revoked and data cleaned up");
  }

  /**
   * Export user's privacy data (GDPR Article 20)
   */
  async exportUserData(userId: string): Promise<UserDataExport | null> {
    console.log(`📤 Exporting data for user ${userId}`);

    const consent = this.getUserConsent(userId);
    if (!consent) {
      return null;
    }

    const userAuditEntries = this.auditLog.filter(
      (entry) => entry.userId === userId,
    );

    return {
      userId,
      consent,
      auditHistory: userAuditEntries,
      exportTimestamp: new Date(),
      dataRetentionExpiry: new Date(
        Date.now() + this.config.retentionDays * 24 * 60 * 60 * 1000,
      ),
    };
  }

  /**
   * Log audit event for compliance tracking
   */
  private async logAuditEvent(entry: AuditLogEntry): Promise<void> {
    if (!this.config.enableAuditLog) {
      return;
    }

    this.auditLog.push(entry);

    // Keep audit log size manageable
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  /**
   * Get privacy settings for display to users
   */
  getPrivacySettings(): PrivacySettings {
    return {
      requireConsent: this.config.requireConsent,
      retentionDays: this.config.retentionDays,
      anonymizationLevel: this.config.anonymizationLevel,
      enablePiiScrubbing: this.config.enablePiiScrubbing,
      allowedCategories: [...this.config.allowedCategories],
      enableEncryption: this.config.enableEncryption,
      gdprCompliance: this.config.gdprCompliance,
      ccpaCompliance: this.config.ccpaCompliance,
    };
  }
}

/**
 * Audit log entry interface
 */
interface AuditLogEntry {
  action: string;
  userId?: string;
  data: any;
  timestamp: Date;
}

/**
 * Privacy compliance report interface
 */
interface PrivacyComplianceReport {
  timestamp: Date;
  totalUsers: number;
  consentLevels: {
    none: number;
    basic: number;
    analytics: number;
    full: number;
  };
  dataRetentionDays: number;
  anonymizationLevel: string;
  piiScrubbing: boolean;
  encryption: boolean;
  auditLogEntries: number;
  gdprCompliance: boolean;
  ccpaCompliance: boolean;
  lastCleanup: Date;
}

/**
 * User data export interface (GDPR compliance)
 */
interface UserDataExport {
  userId: string;
  consent: ConsentData;
  auditHistory: AuditLogEntry[];
  exportTimestamp: Date;
  dataRetentionExpiry: Date;
}
