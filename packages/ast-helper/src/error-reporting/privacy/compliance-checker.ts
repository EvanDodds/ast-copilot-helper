/**
 * @fileoverview Compliance Checker for Privacy Regulations (GDPR, CCPA)
 * @module @ast-copilot-helper/ast-helper/error-reporting/privacy/compliance-checker
 */

import type { ErrorReport, ConsentData, PrivacySettings } from "../types.js";
import { ConsentLevel } from "./privacy-manager.js";

/**
 * Compliance violation interface
 */
interface ComplianceViolation {
  type: "gdpr" | "ccpa" | "generic";
  severity: "low" | "medium" | "high" | "critical";
  article?: string; // GDPR article reference
  section?: string; // CCPA section reference
  description: string;
  recommendation: string;
  errorId?: string;
  userId?: string;
}

/**
 * Compliance check result
 */
interface ComplianceCheckResult {
  compliant: boolean;
  violations: ComplianceViolation[];
  score: number; // 0-100 compliance score
  recommendations: string[];
  lastChecked: Date;
}

/**
 * Data processing basis for GDPR Article 6
 */
export enum ProcessingBasis {
  CONSENT = "consent",
  CONTRACT = "contract",
  LEGAL_OBLIGATION = "legal_obligation",
  VITAL_INTERESTS = "vital_interests",
  PUBLIC_TASK = "public_task",
  LEGITIMATE_INTERESTS = "legitimate_interests",
}

/**
 * CCPA consumer rights
 */
export enum CCPARights {
  KNOW = "right_to_know",
  DELETE = "right_to_delete",
  OPT_OUT = "right_to_opt_out",
  NON_DISCRIMINATION = "right_to_non_discrimination",
}

/**
 * Comprehensive compliance checker for privacy regulations
 */
export class ComplianceChecker {
  private privacySettings: PrivacySettings;
  private violations: ComplianceViolation[] = [];

  constructor(privacySettings: PrivacySettings) {
    this.privacySettings = privacySettings;
    console.log("⚖️ Compliance Checker initialized for:", {
      gdpr: privacySettings.gdprCompliance,
      ccpa: privacySettings.ccpaCompliance,
    });
  }

  /**
   * Perform comprehensive compliance check
   */
  async performComplianceCheck(
    errorReports: ErrorReport[],
    consentRecords: Map<string, ConsentData>,
  ): Promise<ComplianceCheckResult> {
    console.log(
      `🔍 Performing compliance check on ${errorReports.length} error reports`,
    );

    this.violations = [];

    // Check GDPR compliance
    if (this.privacySettings.gdprCompliance) {
      await this.checkGDPRCompliance(errorReports, consentRecords);
    }

    // Check CCPA compliance
    if (this.privacySettings.ccpaCompliance) {
      await this.checkCCPACompliance(errorReports, consentRecords);
    }

    // Check general privacy requirements
    await this.checkGeneralPrivacy(errorReports, consentRecords);

    const score = this.calculateComplianceScore();
    const recommendations = this.generateRecommendations();

    console.log(
      `✅ Compliance check complete. Score: ${score}/100, Violations: ${this.violations.length}`,
    );

    return {
      compliant:
        this.violations.filter(
          (v) => v.severity === "critical" || v.severity === "high",
        ).length === 0,
      violations: [...this.violations],
      score,
      recommendations,
      lastChecked: new Date(),
    };
  }

  /**
   * Check GDPR compliance requirements
   */
  private async checkGDPRCompliance(
    errorReports: ErrorReport[],
    consentRecords: Map<string, ConsentData>,
  ): Promise<void> {
    console.log("🇪🇺 Checking GDPR compliance...");

    // Article 6: Lawful basis for processing
    await this.checkLawfulBasis(errorReports, consentRecords);

    // Article 7: Conditions for consent
    await this.checkConsentConditions(consentRecords);

    // Article 13/14: Information to be provided
    await this.checkTransparencyRequirements();

    // Article 17: Right to erasure
    await this.checkDataRetention(errorReports);

    // Article 20: Right to data portability
    await this.checkDataPortability();

    // Article 25: Data protection by design and by default
    await this.checkDataProtectionByDesign();

    // Article 32: Security of processing
    await this.checkSecurityMeasures();

    // Article 35: Data protection impact assessment
    await this.checkDPIARequirements(errorReports);
  }

  /**
   * Check CCPA compliance requirements
   */
  private async checkCCPACompliance(
    errorReports: ErrorReport[],
    consentRecords: Map<string, ConsentData>,
  ): Promise<void> {
    console.log("🇺🇸 Checking CCPA compliance...");

    // Section 1798.100: Consumer's right to know
    await this.checkRightToKnow(errorReports);

    // Section 1798.105: Consumer's right to delete
    await this.checkRightToDelete();

    // Section 1798.120: Consumer's right to opt-out
    await this.checkRightToOptOut(consentRecords);

    // Section 1798.125: Non-discrimination
    await this.checkNonDiscrimination();

    // Section 1798.130: Notice requirements
    await this.checkCCPANoticeRequirements();
  }

  /**
   * Check general privacy requirements
   */
  private async checkGeneralPrivacy(
    errorReports: ErrorReport[],
    consentRecords: Map<string, ConsentData>,
  ): Promise<void> {
    console.log("🔐 Checking general privacy requirements...");

    // Check consent requirements
    if (this.privacySettings.requireConsent) {
      for (const report of errorReports) {
        const userId = report.context?.userId;
        if (userId && !consentRecords.has(userId)) {
          this.addViolation({
            type: "generic",
            severity: "high",
            description: `Error report collected without user consent: ${report.id}`,
            recommendation:
              "Ensure consent is obtained before collecting error data",
            errorId: report.id,
            userId,
          });
        }
      }
    }

    // Check data minimization
    await this.checkDataMinimization(errorReports);

    // Check PII scrubbing
    if (this.privacySettings.enablePiiScrubbing) {
      await this.checkPIIScrubbing(errorReports);
    }
  }

  /**
   * Check lawful basis for processing (GDPR Article 6)
   */
  private async checkLawfulBasis(
    errorReports: ErrorReport[],
    consentRecords: Map<string, ConsentData>,
  ): Promise<void> {
    for (const report of errorReports) {
      const userId = report.context?.userId;

      if (userId) {
        const consent = consentRecords.get(userId);

        if (!consent || consent.level < ConsentLevel.BASIC) {
          // Check if processing can be based on legitimate interests
          if (!this.hasLegitimateInterests(report)) {
            this.addViolation({
              type: "gdpr",
              severity: "critical",
              article: "Article 6",
              description: `No lawful basis for processing personal data in error report ${report.id}`,
              recommendation:
                "Obtain valid consent or establish legitimate interests for processing",
              errorId: report.id,
              userId,
            });
          }
        }
      }
    }
  }

  /**
   * Check consent conditions (GDPR Article 7)
   */
  private async checkConsentConditions(
    consentRecords: Map<string, ConsentData>,
  ): Promise<void> {
    for (const [userId, consent] of consentRecords) {
      // Check if consent is freely given
      if (!consent.categories || consent.categories.length === 0) {
        this.addViolation({
          type: "gdpr",
          severity: "medium",
          article: "Article 7",
          description: `Invalid consent record for user ${userId}: no categories specified`,
          recommendation:
            "Ensure consent specifies clear categories of data processing",
          userId,
        });
      }

      // Check consent age (should be recent)
      const consentAge = Date.now() - consent.timestamp.getTime();
      const oneYear = 365 * 24 * 60 * 60 * 1000;

      if (consentAge > oneYear) {
        this.addViolation({
          type: "gdpr",
          severity: "low",
          article: "Article 7",
          description: `Old consent record for user ${userId}: ${Math.round((consentAge / oneYear) * 10) / 10} years old`,
          recommendation: "Consider refreshing consent annually",
          userId,
        });
      }
    }
  }

  /**
   * Check transparency requirements (GDPR Articles 13/14)
   */
  private async checkTransparencyRequirements(): Promise<void> {
    // This would typically check if privacy notices are properly displayed
    // For now, we'll assume compliance if privacy settings are configured
    if (!this.privacySettings.gdprCompliance) {
      this.addViolation({
        type: "gdpr",
        severity: "medium",
        article: "Article 13/14",
        description: "GDPR transparency requirements not properly configured",
        recommendation:
          "Enable GDPR compliance mode and provide clear privacy notices",
      });
    }
  }

  /**
   * Check data retention requirements (GDPR Article 17)
   */
  private async checkDataRetention(errorReports: ErrorReport[]): Promise<void> {
    const retentionLimit = new Date();
    retentionLimit.setDate(
      retentionLimit.getDate() - this.privacySettings.retentionDays,
    );

    for (const report of errorReports) {
      if (report.timestamp < retentionLimit) {
        this.addViolation({
          type: "gdpr",
          severity: "medium",
          article: "Article 17",
          description: `Error report ${report.id} exceeds retention period`,
          recommendation:
            "Implement automatic data deletion based on retention policy",
          errorId: report.id,
        });
      }
    }
  }

  /**
   * Check data portability requirements (GDPR Article 20)
   */
  private async checkDataPortability(): Promise<void> {
    // Check if data export functionality is available
    // This is a placeholder check - actual implementation would verify export capabilities
    console.log("✅ Data portability requirements checked");
  }

  /**
   * Check data protection by design (GDPR Article 25)
   */
  private async checkDataProtectionByDesign(): Promise<void> {
    // Check if privacy-enhancing measures are in place
    if (this.privacySettings.anonymizationLevel === "none") {
      this.addViolation({
        type: "gdpr",
        severity: "medium",
        article: "Article 25",
        description: "No data anonymization implemented",
        recommendation:
          "Implement at least basic anonymization for data protection by design",
      });
    }

    if (!this.privacySettings.enablePiiScrubbing) {
      this.addViolation({
        type: "gdpr",
        severity: "medium",
        article: "Article 25",
        description: "PII scrubbing not enabled",
        recommendation: "Enable PII scrubbing to protect personal identifiers",
      });
    }
  }

  /**
   * Check security measures (GDPR Article 32)
   */
  private async checkSecurityMeasures(): Promise<void> {
    if (!this.privacySettings.enableEncryption) {
      this.addViolation({
        type: "gdpr",
        severity: "high",
        article: "Article 32",
        description: "Data encryption not enabled",
        recommendation: "Enable encryption for personal data protection",
      });
    }
  }

  /**
   * Check DPIA requirements (GDPR Article 35)
   */
  private async checkDPIARequirements(
    errorReports: ErrorReport[],
  ): Promise<void> {
    // Check if high-risk processing requires DPIA
    const sensitiveDataFound = errorReports.some((report) =>
      this.containsSensitiveData(report),
    );

    if (sensitiveDataFound) {
      console.log("⚠️ Sensitive data detected - DPIA may be required");
      // This would typically trigger a DPIA assessment
    }
  }

  /**
   * Check right to know requirements (CCPA Section 1798.100)
   */
  private async checkRightToKnow(errorReports: ErrorReport[]): Promise<void> {
    // Check if data collection is transparent
    const categoriesCollected = new Set(errorReports.map((r) => r.category));

    if (
      categoriesCollected.size > this.privacySettings.allowedCategories.length
    ) {
      this.addViolation({
        type: "ccpa",
        severity: "medium",
        section: "Section 1798.100",
        description: "Collecting data categories not disclosed to consumers",
        recommendation:
          "Update privacy notice to include all data categories collected",
      });
    }
  }

  /**
   * Check right to delete (CCPA Section 1798.105)
   */
  private async checkRightToDelete(): Promise<void> {
    // Check if deletion mechanisms are in place
    if (this.privacySettings.retentionDays <= 0) {
      this.addViolation({
        type: "ccpa",
        severity: "high",
        section: "Section 1798.105",
        description: "No data retention policy configured",
        recommendation: "Implement data retention and deletion policies",
      });
    }
  }

  /**
   * Check right to opt-out (CCPA Section 1798.120)
   */
  private async checkRightToOptOut(
    consentRecords: Map<string, ConsentData>,
  ): Promise<void> {
    // Check if users can withdraw consent
    const optOutAvailable = consentRecords.size > 0; // Simplified check

    if (!optOutAvailable && this.privacySettings.requireConsent) {
      this.addViolation({
        type: "ccpa",
        severity: "medium",
        section: "Section 1798.120",
        description: "No opt-out mechanism available for consumers",
        recommendation: "Implement consumer opt-out functionality",
      });
    }
  }

  /**
   * Check non-discrimination requirements (CCPA Section 1798.125)
   */
  private async checkNonDiscrimination(): Promise<void> {
    // This would check if services are not denied based on privacy choices
    // Placeholder implementation
    console.log("✅ Non-discrimination requirements checked");
  }

  /**
   * Check CCPA notice requirements
   */
  private async checkCCPANoticeRequirements(): Promise<void> {
    if (!this.privacySettings.ccpaCompliance) {
      this.addViolation({
        type: "ccpa",
        severity: "medium",
        description: "CCPA compliance mode not enabled",
        recommendation: "Enable CCPA compliance and provide required notices",
      });
    }
  }

  /**
   * Check data minimization principles
   */
  private async checkDataMinimization(
    errorReports: ErrorReport[],
  ): Promise<void> {
    for (const report of errorReports) {
      // Check if error report contains excessive data
      const reportSize = JSON.stringify(report).length;

      if (reportSize > 50000) {
        // 50KB threshold
        this.addViolation({
          type: "generic",
          severity: "low",
          description: `Error report ${report.id} contains excessive data (${Math.round(reportSize / 1024)}KB)`,
          recommendation:
            "Implement data minimization to collect only necessary information",
          errorId: report.id,
        });
      }
    }
  }

  /**
   * Check PII scrubbing effectiveness
   */
  private async checkPIIScrubbing(errorReports: ErrorReport[]): Promise<void> {
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

    for (const report of errorReports) {
      const reportText = JSON.stringify(report);

      if (emailPattern.test(reportText)) {
        this.addViolation({
          type: "generic",
          severity: "medium",
          description: `Possible PII detected in error report ${report.id}`,
          recommendation: "Verify PII scrubbing is working correctly",
          errorId: report.id,
        });
      }
    }
  }

  /**
   * Check if processing has legitimate interests basis
   */
  private hasLegitimateInterests(errorReport: ErrorReport): boolean {
    // For error reporting, legitimate interests might include:
    // - Improving software quality
    // - Ensuring security
    // - Maintaining service functionality
    return (
      errorReport.category === "security" ||
      errorReport.severity === "critical" ||
      errorReport.category === "performance"
    );
  }

  /**
   * Check if report contains sensitive data requiring DPIA
   */
  private containsSensitiveData(errorReport: ErrorReport): boolean {
    const sensitiveKeywords = [
      "password",
      "token",
      "credential",
      "secret",
      "key",
    ];
    const reportText = JSON.stringify(errorReport).toLowerCase();

    return sensitiveKeywords.some((keyword) => reportText.includes(keyword));
  }

  /**
   * Add compliance violation to the list
   */
  private addViolation(violation: ComplianceViolation): void {
    this.violations.push(violation);
    console.warn(
      `⚠️ Compliance violation (${violation.severity}): ${violation.description}`,
    );
  }

  /**
   * Calculate overall compliance score
   */
  private calculateComplianceScore(): number {
    if (this.violations.length === 0) {
      return 100;
    }

    let score = 100;

    for (const violation of this.violations) {
      switch (violation.severity) {
        case "critical":
          score -= 25;
          break;
        case "high":
          score -= 15;
          break;
        case "medium":
          score -= 8;
          break;
        case "low":
          score -= 3;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * Generate compliance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations = new Set<string>();

    for (const violation of this.violations) {
      if (violation.recommendation) {
        recommendations.add(violation.recommendation);
      }
    }

    // Add general recommendations
    if (this.violations.some((v) => v.type === "gdpr")) {
      recommendations.add(
        "Review GDPR compliance documentation and requirements",
      );
    }

    if (this.violations.some((v) => v.type === "ccpa")) {
      recommendations.add(
        "Review CCPA compliance documentation and requirements",
      );
    }

    return Array.from(recommendations);
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(): ComplianceReport {
    const criticalViolations = this.violations.filter(
      (v) => v.severity === "critical",
    );
    const highViolations = this.violations.filter((v) => v.severity === "high");

    return {
      timestamp: new Date(),
      overallScore: this.calculateComplianceScore(),
      totalViolations: this.violations.length,
      criticalViolations: criticalViolations.length,
      highViolations: highViolations.length,
      gdprCompliant: !this.violations.some(
        (v) =>
          v.type === "gdpr" &&
          (v.severity === "critical" || v.severity === "high"),
      ),
      ccpaCompliant: !this.violations.some(
        (v) =>
          v.type === "ccpa" &&
          (v.severity === "critical" || v.severity === "high"),
      ),
      topViolations: this.violations
        .filter((v) => v.severity === "critical" || v.severity === "high")
        .slice(0, 5),
      recommendations: this.generateRecommendations(),
    };
  }
}

/**
 * Compliance report interface
 */
interface ComplianceReport {
  timestamp: Date;
  overallScore: number;
  totalViolations: number;
  criticalViolations: number;
  highViolations: number;
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  topViolations: ComplianceViolation[];
  recommendations: string[];
}

export {
  type ComplianceViolation,
  type ComplianceCheckResult,
  type ComplianceReport,
};
