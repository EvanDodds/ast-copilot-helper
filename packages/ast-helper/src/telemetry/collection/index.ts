/**
 * @file Telemetry Collection System
 * @description Exports for the comprehensive telemetry data collection system
 */

// Core collection components
export * from './types';
export { PrivacyRespectingEventSanitizer } from './sanitizer';
export { 
  EventBuilderFactory, 
  EventBuilderUtils,
  FeatureUsageEventBuilder,
  CommandExecutionEventBuilder,
  PerformanceEventBuilder,
  ErrorEventBuilder,
  SystemMetricsEventBuilder
} from './builder';
export { 
  TelemetryDataCollector, 
  DataCollectorFactory, 
  PerformanceCollector 
} from './collector';

// Import for internal function implementations
import { TelemetryDataCollector, DataCollectorFactory } from './collector';

/**
 * Create a development telemetry collector
 * 
 * @returns Configured TelemetryDataCollector for development
 */
export function createDevelopmentCollector(): TelemetryDataCollector {
  return DataCollectorFactory.createDevelopment();
}

/**
 * Create a production telemetry collector
 * 
 * @returns Configured TelemetryDataCollector for production
 */
export function createProductionCollector(): TelemetryDataCollector {
  return DataCollectorFactory.createStrictPrivacy();
}

/**
 * Create a custom telemetry collector
 * 
 * @param config - Partial collection configuration
 * @returns Configured TelemetryDataCollector
 */
export function createCustomCollector(config?: Partial<any>): TelemetryDataCollector {
  return DataCollectorFactory.create(config);
}