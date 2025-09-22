/**
 * @file Telemetry Module Exports
 * @description Main exports for the privacy-respecting telemetry system
 */

// Core telemetry functionality
export { PrivacyRespectingTelemetryManager } from './manager.js';
export { DEFAULT_TELEMETRY_CONFIG, validateTelemetryConfig, mergeTelemetryConfig } from './config.js';

// Privacy and Consent Management (NEW)
export { PrivacyRespectingConsentManager, FileConsentStorage } from './consent/index.js';
export type { ConsentRecord, ConsentFeature, ConsentStorage, ConsentValidationResult } from './consent/index.js';

// Data Anonymization (NEW)
export { PrivacyRespectingDataAnonymizer } from './anonymization/index.js';
export type { AnonymizationConfig, AnonymizationResult, AnonymizationStrategy, DataCategory } from './anonymization/index.js';

// Core types and interfaces
export type * from './types.js';

// Factory functions and utilities
import { PrivacyRespectingTelemetryManager } from './manager.js';

let defaultManager: PrivacyRespectingTelemetryManager | null = null;

/**
 * Create a new telemetry manager with privacy-first defaults
 */
export function createTelemetryManager(config?: any): PrivacyRespectingTelemetryManager {
  return new PrivacyRespectingTelemetryManager(config);
}

/**
 * Get or create default telemetry manager singleton
 */
export function getDefaultTelemetryManager(): PrivacyRespectingTelemetryManager {
  if (!defaultManager) {
    defaultManager = new PrivacyRespectingTelemetryManager();
  }
  return defaultManager;
}

/**
 * Reset the default telemetry manager (useful for testing)
 */
export function resetDefaultTelemetryManager(): void {
  defaultManager = null;
}