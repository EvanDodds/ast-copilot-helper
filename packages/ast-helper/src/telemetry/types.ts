/**
 * Core telemetry types and interfaces
 */

export interface TelemetryManager {
  initialize(config: TelemetryConfig): Promise<void>;
  collectUsageMetrics(): Promise<UsageMetrics>;
  trackFeatureUsage(feature: string, data?: any): Promise<void>;
  recordPerformanceMetrics(metrics: PerformanceMetrics): Promise<void>;
  reportError(error: ErrorReport): Promise<void>;
  sendTelemetryData(): Promise<TelemetryResult>;
  getUserConsent(): Promise<ConsentStatus>;
  configureTelemetry(settings: TelemetrySettings): Promise<void>;
  shutdown(): Promise<void>;
}

export interface TelemetryConfig {
  enabled: boolean;
  endpoint: string;
  apiKey: string;
  batchSize: number;
  flushInterval: number; // milliseconds
  retryAttempts: number;
  privacyLevel: PrivacyLevel;
  anonymization: AnonymizationConfig;
  retention: RetentionConfig;
  consentRequired: boolean;
  version: string;
}

export interface UsageMetrics {
  sessionId: string;
  userId?: string; // anonymous hash
  timestamp: Date;
  version: string;
  platform: string;
  nodeVersion: string;
  commands: CommandUsage[];
  features: FeatureUsage[];
  performance: PerformanceData;
  errors: ErrorSummary[];
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  memoryUsage: number;
  cpuUsage?: number;
  fileCount?: number;
  codebaseSize?: number;
  success: boolean;
  errorType?: string;
}

export interface CommandUsage {
  command: string;
  count: number;
  lastUsed: Date;
  averageDuration: number;
  successRate: number;
  errorTypes: string[];
}

export interface FeatureUsage {
  feature: string;
  usageCount: number;
  lastUsed: Date;
  userAdoption: number; // 0-1 scale
  averageSessionUsage: number;
}

export interface PerformanceData {
  averageResponseTime: number;
  memoryUsageStats: MemoryStats;
  errorRate: number;
  throughputMetrics: ThroughputMetrics;
}

export interface MemoryStats {
  average: number;
  peak: number;
  current: number;
  unit: 'bytes' | 'kb' | 'mb' | 'gb';
}

export interface ThroughputMetrics {
  operationsPerSecond: number;
  filesProcessedPerSecond: number;
  bytesProcessedPerSecond: number;
}

export interface ErrorSummary {
  type: string;
  category: ErrorCategory;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  severity: ErrorSeverity;
  messageHash: string;
  contextHash?: string;
}

export interface ErrorReport {
  type: string;
  code?: string;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  context?: any;
  timestamp?: Date;
}

export interface ConsentStatus {
  hasConsent: boolean;
  enabled: boolean;
  consentVersion: string;
  consentDate?: Date;
  settings: TelemetrySettings;
}

export interface TelemetrySettings {
  enabled?: boolean;
  privacyLevel?: PrivacyLevel;
  collectPerformance?: boolean;
  collectErrors?: boolean;
  collectUsage?: boolean;
  dataRetentionDays?: number;
  consentVersion?: string;
  endpoint?: string;
  batchSize?: number;
  flushInterval?: number;
}

export interface TelemetryResult {
  success: boolean;
  eventsSent: number;
  duration: number;
  message: string;
  error?: string;
  retryAfter?: number;
}

export interface AnonymizationConfig {
  privacyLevel: PrivacyLevel;
  hashSalt: string;
  excludePatterns: string[];
  includeSystemInfo: boolean;
  anonymizeIpAddress: boolean;
  anonymizeUserAgent: boolean;
  dataRetentionDays: number;
}

export interface RetentionConfig {
  days: number;
  maxEvents: number;
  compressionEnabled: boolean;
  cleanupInterval: number; // milliseconds
}

export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: Date;
  sessionId: string;
  eventId: string;
  userId?: string;
  data: Record<string, any>;
}

export interface TelemetryPayload {
  timestamp: Date;
  clientVersion: string;
  events: TelemetryEvent[];
  metadata?: Record<string, any>;
}

export interface FeatureUsageEvent extends TelemetryEvent {
  type: 'feature_usage';
  feature: string;
  data: Record<string, any>;
}

export interface PerformanceEvent extends TelemetryEvent {
  type: 'performance';
  operation: string;
  duration: number;
  memoryUsage: number;
  success: boolean;
  errorType?: string;
  fileCountRange?: string;
  codebaseSizeRange?: string;
}

export interface ErrorEvent extends TelemetryEvent {
  type: 'error';
  errorType: string;
  errorCode?: string;
  errorCategory: ErrorCategory;
  severity: ErrorSeverity;
  context?: any;
  messageHash: string;
  stackHash?: string;
}

export interface UsageEvent extends TelemetryEvent {
  type: 'usage';
  command?: string;
  feature?: string;
  duration?: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface SanitizedErrorReport {
  type: string;
  code?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: any;
}

// Enums and type unions
export type PrivacyLevel = 'strict' | 'balanced' | 'permissive';
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 'parser' | 'filesystem' | 'network' | 'configuration' | 'validation' | 'internal' | 'user_error' | 'external_service';
export type TelemetryEventType = 'feature_usage' | 'performance' | 'error' | 'usage' | 'system' | 'session';

// Constants
export const DEFAULT_BATCH_SIZE = 50;
export const DEFAULT_FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_DATA_RETENTION_DAYS = 30;
export const MAX_BUFFER_SIZE = 1000;
export const MIN_FLUSH_INTERVAL = 30 * 1000; // 30 seconds
export const MAX_FLUSH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// Telemetry feature flags
export interface TelemetryFeatures {
  usageTracking: boolean;
  performanceMonitoring: boolean;
  errorReporting: boolean;
  featureAdoption: boolean;
  systemMetrics: boolean;
  customEvents: boolean;
}

// Default telemetry features configuration
export const DEFAULT_TELEMETRY_FEATURES: TelemetryFeatures = {
  usageTracking: true,
  performanceMonitoring: true,
  errorReporting: true,
  featureAdoption: true,
  systemMetrics: true,
  customEvents: false,
};

// Privacy level feature matrix
export const PRIVACY_LEVEL_FEATURES: Record<PrivacyLevel, Partial<TelemetryFeatures>> = {
  strict: {
    usageTracking: false,
    performanceMonitoring: true,
    errorReporting: true,
    featureAdoption: false,
    systemMetrics: false,
    customEvents: false,
  },
  balanced: {
    usageTracking: true,
    performanceMonitoring: true,
    errorReporting: true,
    featureAdoption: true,
    systemMetrics: true,
    customEvents: false,
  },
  permissive: {
    usageTracking: true,
    performanceMonitoring: true,
    errorReporting: true,
    featureAdoption: true,
    systemMetrics: true,
    customEvents: true,
  },
};