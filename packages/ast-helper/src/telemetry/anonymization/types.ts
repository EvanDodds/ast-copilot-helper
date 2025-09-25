/**
 * @file Data Anonymization Types
 * @description Type definitions for privacy-respecting data anonymization
 */

import type { PrivacyLevel } from "../types.js";

/**
 * Anonymization strategies for different data types
 */
export enum AnonymizationStrategy {
  HASH = "hash",
  REDACT = "redact",
  MASK = "mask",
  REMOVE = "remove",
  ENCRYPT = "encrypt",
}

/**
 * Configuration for data anonymization
 */
export interface AnonymizationConfig {
  /** Privacy level to apply */
  privacyLevel: PrivacyLevel;
  /** Salt for hashing operations */
  hashSalt: string;
  /** Whether to preserve data structure */
  preserveStructure: boolean;
  /** Patterns to exclude from anonymization */
  excludePatterns: string[];
  /** Maximum length for masked data */
  maxMaskLength: number;
  /** Custom anonymization rules */
  customRules: AnonymizationRule[];
}

/**
 * Custom anonymization rule
 */
export interface AnonymizationRule {
  /** Pattern to match data */
  pattern: string | RegExp;
  /** Strategy to apply */
  strategy: AnonymizationStrategy;
  /** Replacement value for redaction/masking */
  replacement?: string;
  /** Description of the rule */
  description: string;
}

/**
 * Anonymization result
 */
export interface AnonymizationResult<T = any> {
  /** Anonymized data */
  data: T;
  /** Metadata about anonymization process */
  metadata: AnonymizationMetadata;
  /** Whether anonymization was successful */
  success: boolean;
  /** Any warnings during anonymization */
  warnings: string[];
}

/**
 * Metadata about the anonymization process
 */
export interface AnonymizationMetadata {
  /** Timestamp when anonymization was performed */
  timestamp: Date;
  /** Privacy level used */
  privacyLevel: PrivacyLevel;
  /** Rules applied */
  rulesApplied: string[];
  /** Original data size in bytes */
  originalSize: number;
  /** Anonymized data size in bytes */
  anonymizedSize: number;
  /** Reduction in data size */
  reductionRatio: number;
}

/**
 * Data categories for anonymization
 */
export enum DataCategory {
  PERSONAL_IDENTIFIER = "personal_identifier",
  SYSTEM_INFO = "system_info",
  FILE_PATH = "file_path",
  ERROR_MESSAGE = "error_message",
  PERFORMANCE_DATA = "performance_data",
  USAGE_DATA = "usage_data",
  CUSTOM_DATA = "custom_data",
}

/**
 * Anonymization options for specific operations
 */
export interface AnonymizationOptions {
  /** Privacy level to use (overrides config) */
  privacyLevel?: PrivacyLevel;
  /** Preserve original data structure */
  preserveStructure?: boolean;
  /** Data category for specialized handling */
  category?: DataCategory;
  /** Additional context for anonymization */
  context?: Record<string, any>;
}
