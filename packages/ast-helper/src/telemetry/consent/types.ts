/**
 * @file Consent Management Types
 * @description Type definitions for privacy-respecting consent management system
 */

import type { PrivacyLevel } from '../types.js';

/**
 * Privacy level enum for easier usage
 */
export const PRIVACY_LEVELS = {
  STRICT: 'strict' as const,
  BALANCED: 'balanced' as const,
  PERMISSIVE: 'permissive' as const
} as const;

/**
 * Detailed consent record with versioning and feature-specific permissions
 */
export interface ConsentRecord {
  /** Unique identifier for this consent record */
  id: string;
  /** Timestamp when consent was given */
  timestamp: Date;
  /** Version of the consent agreement */
  consentVersion: string;
  /** Version of the application when consent was given */
  appVersion: string;
  /** Whether telemetry is enabled */
  enabled: boolean;
  /** Privacy level setting */
  privacyLevel: PrivacyLevel;
  /** Specific features user has consented to */
  allowedFeatures: ConsentFeature[];
  /** Data retention period in days */
  dataRetentionDays: number;
  /** Whether user consented to sharing anonymous usage statistics */
  shareAnonymousStats: boolean;
  /** Whether user consented to error reporting */
  shareErrorReports: boolean;
  /** Whether user consented to performance metrics */
  sharePerformanceMetrics: boolean;
  /** IP address from where consent was given (for audit) */
  consentLocation?: string;
  /** User agent when consent was given */
  userAgent?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Features that can be individually consented to
 */
export enum ConsentFeature {
  USAGE_ANALYTICS = 'usage_analytics',
  PERFORMANCE_MONITORING = 'performance_monitoring',
  ERROR_REPORTING = 'error_reporting',
  FEATURE_USAGE = 'feature_usage',
  COMMAND_TRACKING = 'command_tracking',
  FILE_TYPE_ANALYSIS = 'file_type_analysis',
  EXTENSION_USAGE = 'extension_usage',
  CRASH_REPORTING = 'crash_reporting'
}

/**
 * Consent storage interface
 */
export interface ConsentStorage {
  /** Save consent record */
  saveConsent(record: ConsentRecord): Promise<void>;
  /** Load current consent record */
  loadConsent(): Promise<ConsentRecord | null>;
  /** Get consent history */
  getConsentHistory(): Promise<ConsentRecord[]>;
  /** Clear all consent data */
  clearConsent(): Promise<void>;
  /** Check if storage is available */
  isAvailable(): Promise<boolean>;
}

/**
 * Consent validation result
 */
export interface ConsentValidationResult {
  /** Whether consent is valid */
  isValid: boolean;
  /** Validation errors if any */
  errors: string[];
  /** Whether consent needs renewal */
  needsRenewal: boolean;
  /** Reason for renewal requirement */
  renewalReason?: string;
  /** Days until expiration */
  daysUntilExpiry?: number;
}

/**
 * Consent renewal reasons
 */
export enum ConsentRenewalReason {
  EXPIRED = 'expired',
  VERSION_CHANGE = 'version_change',
  PRIVACY_POLICY_UPDATE = 'privacy_policy_update',
  FEATURE_CHANGES = 'feature_changes',
  USER_REQUEST = 'user_request'
}

/**
 * Consent migration result for handling version changes
 */
export interface ConsentMigrationResult {
  /** Whether migration was successful */
  success: boolean;
  /** Migrated consent record */
  migratedConsent?: ConsentRecord;
  /** Migration warnings */
  warnings: string[];
  /** Whether user needs to re-consent */
  requiresReConsent: boolean;
}

/**
 * Options for consent collection
 */
export interface ConsentCollectionOptions {
  /** Whether to show detailed feature breakdown */
  showFeatureBreakdown: boolean;
  /** Whether to allow granular consent per feature */
  allowGranularConsent: boolean;
  /** Default privacy level to suggest */
  defaultPrivacyLevel: PrivacyLevel;
  /** Whether to show data retention options */
  showDataRetentionOptions: boolean;
  /** Pre-selected features */
  preSelectedFeatures?: ConsentFeature[];
  /** Required features that cannot be disabled */
  requiredFeatures?: ConsentFeature[];
}