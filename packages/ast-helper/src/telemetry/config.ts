/**
 * Telemetry configuration management
 */

import type { 
  TelemetryConfig, 
  AnonymizationConfig, 
  RetentionConfig,
  TelemetryFeatures,
  PrivacyLevel} from './types.js';
import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_FLUSH_INTERVAL,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_DATA_RETENTION_DAYS,
  DEFAULT_TELEMETRY_FEATURES,
  PRIVACY_LEVEL_FEATURES
} from './types.js';

/**
 * Default telemetry configuration
 */
export const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  enabled: false, // Disabled by default - requires explicit opt-in
  endpoint: process.env.AST_HELPER_TELEMETRY_ENDPOINT || 'https://api.ast-copilot-helper.dev/telemetry',
  apiKey: process.env.AST_HELPER_TELEMETRY_API_KEY || '',
  batchSize: DEFAULT_BATCH_SIZE,
  flushInterval: DEFAULT_FLUSH_INTERVAL,
  retryAttempts: DEFAULT_RETRY_ATTEMPTS,
  privacyLevel: 'balanced',
  anonymization: {
    privacyLevel: 'balanced',
    hashSalt: generateDefaultHashSalt(),
    excludePatterns: [
      '*.env*',
      '*.key',
      '*.pem',
      '*secret*',
      '*password*',
      '*token*',
      '*credential*',
      '*/node_modules/*',
      '*/.git/*',
    ],
    includeSystemInfo: true,
    anonymizeIpAddress: true,
    anonymizeUserAgent: true,
    dataRetentionDays: DEFAULT_DATA_RETENTION_DAYS,
  },
  retention: {
    days: DEFAULT_DATA_RETENTION_DAYS,
    maxEvents: 10000,
    compressionEnabled: true,
    cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
  },
  consentRequired: true,
  version: '1.0.0',
};

/**
 * Default anonymization configuration based on privacy level
 */
export function getDefaultAnonymizationConfig(privacyLevel: PrivacyLevel): AnonymizationConfig {
  const baseConfig: AnonymizationConfig = {
    privacyLevel,
    hashSalt: generateDefaultHashSalt(),
    excludePatterns: [
      '*.env*',
      '*.key',
      '*.pem',
      '*secret*',
      '*password*',
      '*token*',
      '*credential*',
      '*/node_modules/*',
      '*/.git/*',
    ],
    includeSystemInfo: true,
    anonymizeIpAddress: true,
    anonymizeUserAgent: true,
    dataRetentionDays: DEFAULT_DATA_RETENTION_DAYS,
  };

  switch (privacyLevel) {
    case 'strict':
      return {
        ...baseConfig,
        includeSystemInfo: false,
        anonymizeIpAddress: true,
        anonymizeUserAgent: true,
        dataRetentionDays: 7, // Shorter retention for strict privacy
        excludePatterns: [
          ...baseConfig.excludePatterns,
          '**/src/**',
          '**/test/**',
          '**/tests/**',
          '**/*.ts',
          '**/*.js',
          '**/*.json',
        ],
      };

    case 'balanced':
      return baseConfig;

    case 'permissive':
      return {
        ...baseConfig,
        includeSystemInfo: true,
        anonymizeIpAddress: false,
        anonymizeUserAgent: false,
        dataRetentionDays: 90, // Longer retention for better analytics
      };

    default:
      return baseConfig;
  }
}

/**
 * Get retention configuration based on privacy level
 */
export function getRetentionConfig(privacyLevel: PrivacyLevel): RetentionConfig {
  const baseConfig: RetentionConfig = {
    days: DEFAULT_DATA_RETENTION_DAYS,
    maxEvents: 10000,
    compressionEnabled: true,
    cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
  };

  switch (privacyLevel) {
    case 'strict':
      return {
        ...baseConfig,
        days: 7,
        maxEvents: 1000,
        cleanupInterval: 12 * 60 * 60 * 1000, // 12 hours
      };

    case 'balanced':
      return baseConfig;

    case 'permissive':
      return {
        ...baseConfig,
        days: 90,
        maxEvents: 50000,
        cleanupInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
      };

    default:
      return baseConfig;
  }
}

/**
 * Get telemetry features configuration based on privacy level
 */
export function getTelemetryFeatures(privacyLevel: PrivacyLevel): TelemetryFeatures {
  const levelFeatures = PRIVACY_LEVEL_FEATURES[privacyLevel];
  return {
    ...DEFAULT_TELEMETRY_FEATURES,
    ...levelFeatures,
  };
}

/**
 * Validate telemetry configuration
 */
export function validateTelemetryConfig(config: Partial<TelemetryConfig>): string[] {
  const errors: string[] = [];

  if (config.batchSize !== undefined) {
    if (config.batchSize < 1 || config.batchSize > 1000) {
      errors.push('batchSize must be between 1 and 1000');
    }
  }

  if (config.flushInterval !== undefined) {
    if (config.flushInterval < 30000 || config.flushInterval > 24 * 60 * 60 * 1000) {
      errors.push('flushInterval must be between 30 seconds and 24 hours');
    }
  }

  if (config.retryAttempts !== undefined) {
    if (config.retryAttempts < 0 || config.retryAttempts > 10) {
      errors.push('retryAttempts must be between 0 and 10');
    }
  }

  if (config.endpoint !== undefined) {
    try {
      new URL(config.endpoint);
      if (!config.endpoint.startsWith('https://') && !config.endpoint.startsWith('http://localhost')) {
        errors.push('endpoint must use HTTPS or be localhost for development');
      }
    } catch (error) {
      errors.push('endpoint must be a valid URL');
    }
  }

  if (config.privacyLevel !== undefined) {
    if (!['strict', 'balanced', 'permissive'].includes(config.privacyLevel)) {
      errors.push('privacyLevel must be "strict", "balanced", or "permissive"');
    }
  }

  if (config.retention?.days !== undefined) {
    if (config.retention.days < 1 || config.retention.days > 365) {
      errors.push('retention days must be between 1 and 365');
    }
  }

  if (config.retention?.maxEvents !== undefined) {
    if (config.retention.maxEvents < 100 || config.retention.maxEvents > 100000) {
      errors.push('retention maxEvents must be between 100 and 100,000');
    }
  }

  return errors;
}

/**
 * Merge telemetry configuration with defaults
 */
export function mergeTelemetryConfig(
  userConfig: Partial<TelemetryConfig>, 
  defaults: TelemetryConfig = DEFAULT_TELEMETRY_CONFIG
): TelemetryConfig {
  return {
    ...defaults,
    ...userConfig,
    anonymization: {
      ...defaults.anonymization,
      ...userConfig.anonymization,
    },
    retention: {
      ...defaults.retention,
      ...userConfig.retention,
    },
  };
}

/**
 * Get environment-based configuration overrides
 */
export function getEnvironmentConfig(): Partial<TelemetryConfig> {
  const envConfig: Partial<TelemetryConfig> = {};

  // Endpoint configuration
  if (process.env.AST_HELPER_TELEMETRY_ENDPOINT) {
    envConfig.endpoint = process.env.AST_HELPER_TELEMETRY_ENDPOINT;
  }

  // API key configuration
  if (process.env.AST_HELPER_TELEMETRY_API_KEY) {
    envConfig.apiKey = process.env.AST_HELPER_TELEMETRY_API_KEY;
  }

  // Enable/disable via environment
  if (process.env.AST_HELPER_TELEMETRY_ENABLED !== undefined) {
    envConfig.enabled = process.env.AST_HELPER_TELEMETRY_ENABLED === 'true';
  }

  // Privacy level override
  if (process.env.AST_HELPER_TELEMETRY_PRIVACY_LEVEL) {
    const privacyLevel = process.env.AST_HELPER_TELEMETRY_PRIVACY_LEVEL as PrivacyLevel;
    if (['strict', 'balanced', 'permissive'].includes(privacyLevel)) {
      envConfig.privacyLevel = privacyLevel;
    }
  }

  // Development mode settings
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    envConfig.enabled = false; // Disable by default in development
    envConfig.endpoint = 'http://localhost:3000/telemetry'; // Use local endpoint
  }

  // Batch size override
  if (process.env.AST_HELPER_TELEMETRY_BATCH_SIZE) {
    const batchSize = parseInt(process.env.AST_HELPER_TELEMETRY_BATCH_SIZE, 10);
    if (!isNaN(batchSize) && batchSize >= 1 && batchSize <= 1000) {
      envConfig.batchSize = batchSize;
    }
  }

  // Flush interval override
  if (process.env.AST_HELPER_TELEMETRY_FLUSH_INTERVAL) {
    const flushInterval = parseInt(process.env.AST_HELPER_TELEMETRY_FLUSH_INTERVAL, 10);
    if (!isNaN(flushInterval) && flushInterval >= 30000) {
      envConfig.flushInterval = flushInterval;
    }
  }

  return envConfig;
}

/**
 * Generate default hash salt for anonymization
 */
function generateDefaultHashSalt(): string {
  // Use a consistent salt based on package version and install time
  // This ensures consistency across sessions while maintaining anonymity
  const packageVersion = process.env.npm_package_version || '1.0.0';
  const installTime = process.env.AST_HELPER_INSTALL_TIME || '2024-01-01';
  return `ast-helper-telemetry-${packageVersion}-${installTime}`;
}

/**
 * Check if telemetry is enabled based on configuration and environment
 */
export function isTelemetryEnabled(config: TelemetryConfig): boolean {
  // Check if explicitly disabled
  if (!config.enabled) {
    return false;
  }

  // Check if in CI/CD environment
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') {
    return false;
  }

  // Check if in test environment
  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  // Check if required configuration is missing
  if (!config.endpoint || !config.apiKey) {
    return false;
  }

  return true;
}

/**
 * Get telemetry status description for user display
 */
export function getTelemetryStatusDescription(config: TelemetryConfig): string {
  if (!config.enabled) {
    return 'Telemetry is disabled - data collection is not active';
  }

  if (!isTelemetryEnabled(config)) {
    return 'Telemetry is configured but not active due to environment or missing configuration';
  }

  const features = getTelemetryFeatures(config.privacyLevel);
  const enabledFeatures = Object.entries(features)
    .filter(([, enabled]) => enabled)
    .map(([feature]) => feature)
    .join(', ');

  return `Telemetry is active with ${config.privacyLevel} privacy level. Collecting: ${enabledFeatures}`;
}