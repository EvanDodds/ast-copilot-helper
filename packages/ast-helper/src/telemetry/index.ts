/**
 * Telemetry system public interface
 */

// Export types
export * from './types.js';

// Export configuration
export * from './config.js';

// Export main manager
export { PrivacyRespectingTelemetryManager } from './manager.js';

// Convenience factory function
import { PrivacyRespectingTelemetryManager } from './manager.js';
import { TelemetryConfig } from './types.js';

/**
 * Create a new telemetry manager instance
 */
export function createTelemetryManager(config?: Partial<TelemetryConfig>): PrivacyRespectingTelemetryManager {
  return new PrivacyRespectingTelemetryManager(config);
}

/**
 * Default telemetry manager instance (singleton)
 */
let defaultManager: PrivacyRespectingTelemetryManager | null = null;

/**
 * Get the default telemetry manager instance
 */
export function getDefaultTelemetryManager(config?: Partial<TelemetryConfig>): PrivacyRespectingTelemetryManager {
  if (!defaultManager) {
    defaultManager = new PrivacyRespectingTelemetryManager(config);
  }
  return defaultManager;
}

/**
 * Reset the default telemetry manager (for testing)
 */
export function resetDefaultTelemetryManager(): void {
  defaultManager = null;
}