/**
 * @file Event Sanitizer
 * @description Privacy-respecting event sanitization and filtering
 */

import type { PrivacyLevel } from '../types.js';
import type { 
  TelemetryEvent, 
  EventSanitizer as IEventSanitizer,
  CollectionConfig,
  ErrorEvent,
  PerformanceEvent,
  FeatureUsageEvent,
  SystemMetricsEvent
} from './types.js';

/**
 * Privacy-respecting event sanitizer
 */
export class PrivacyRespectingEventSanitizer implements IEventSanitizer {
  private readonly sensitivePatterns = [
    // Personal identifiers
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
    /\b\d{3}-?\d{2}-?\d{4}\b/g,                               // SSN-like patterns
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,              // Credit card patterns
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,                          // IP addresses
    
    // File paths (common user paths)
    /\/Users\/[^/\s]+/g,                                     // macOS user paths
    /\/home\/[^/\s]+/g,                                      // Linux user paths
    /C:\\Users\\[^\\:\s]+/g,                                  // Windows user paths
    
    // API keys and tokens
    /\b[A-Za-z0-9]{20,}\b/g,                                 // Long alphanumeric strings (potential tokens)
    /\bBEARER\s+[A-Za-z0-9\-._~+/]+=*/gi,                   // Bearer tokens
    /\bAPIKEY\s*[=:]\s*[A-Za-z0-9\-._~+/]+/gi,             // API keys
  ];

  private readonly filePathPattern = /([/\\]?)([^/\\]*[/\\])*([^/\\]+)$/;

  /**
   * Sanitize an event based on privacy settings
   */
  sanitize(event: TelemetryEvent, privacyLevel: PrivacyLevel): TelemetryEvent {
    const sanitized = JSON.parse(JSON.stringify(event)) as TelemetryEvent;

    // Apply privacy level specific sanitization
    switch (privacyLevel) {
      case 'strict':
        return this.sanitizeStrict(sanitized);
      case 'balanced':
        return this.sanitizeBalanced(sanitized);
      case 'permissive':
        return this.sanitizePermissive(sanitized);
      default:
        return this.sanitizeStrict(sanitized);
    }
  }

  /**
   * Check if an event should be collected based on filters
   */
  shouldCollect(event: TelemetryEvent, config: CollectionConfig): boolean {
    // Check if collection is enabled
    if (!config.enabled) {
      return false;
    }

    // Check event type filters
    switch (event.eventType) {
      case 'usage':
        if (!config.collectUsage) {
return false;
}
        break;
      case 'performance':
        if (!config.collectPerformance) {
return false;
}
        break;
      case 'error':
        if (!config.collectErrors) {
return false;
}
        break;
      case 'system':
        if (!config.collectSystem) {
return false;
}
        break;
      case 'custom':
        if (!config.collectCustom) {
return false;
}
        break;
    }

    // Apply sampling rate
    if (Math.random() > config.samplingRate) {
      return false;
    }

    // Check event size limit
    const eventSize = JSON.stringify(event).length;
    if (eventSize > config.maxEventSize) {
      return false;
    }

    return true;
  }

  /**
   * Anonymize sensitive data in an event
   */
  anonymize(event: TelemetryEvent): TelemetryEvent {
    const anonymized = JSON.parse(JSON.stringify(event)) as TelemetryEvent;

    // Remove or hash user identifier
    if (anonymized.userId) {
      anonymized.userId = this.hashUserId(anonymized.userId);
    }

    // Sanitize metadata
    anonymized.metadata = this.sanitizeObject(anonymized.metadata);

    // Handle specific event types
    switch (anonymized.eventType) {
      case 'error':
        return this.anonymizeErrorEvent(anonymized as ErrorEvent) as TelemetryEvent;
      case 'performance':
        return this.anonymizePerformanceEvent(anonymized as PerformanceEvent) as TelemetryEvent;
      case 'usage':
        return this.anonymizeUsageEvent(anonymized as FeatureUsageEvent) as TelemetryEvent;
      case 'system':
        return this.anonymizeSystemEvent(anonymized as SystemMetricsEvent) as TelemetryEvent;
      default:
        return anonymized;
    }
  }

  /**
   * Validate event structure and content
   */
  validate(event: TelemetryEvent): boolean {
    // Check required fields
    if (!event.id || !event.sessionId || !event.timestamp || !event.eventType || !event.category) {
      return false;
    }

    // Validate timestamp
    if (!(event.timestamp instanceof Date) || isNaN(event.timestamp.getTime())) {
      return false;
    }

    // Validate event type
    const validEventTypes = ['usage', 'performance', 'error', 'system', 'custom'];
    if (!validEventTypes.includes(event.eventType)) {
      return false;
    }

    // Validate privacy level
    const validPrivacyLevels = ['strict', 'balanced', 'permissive'];
    if (!validPrivacyLevels.includes(event.privacyLevel)) {
      return false;
    }

    // Validate metadata
    if (typeof event.metadata !== 'object' || event.metadata === null) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // Private sanitization methods
  // ============================================================================

  /**
   * Apply strict privacy sanitization
   */
  private sanitizeStrict(event: TelemetryEvent): TelemetryEvent {
    // Remove user identifier
    delete event.userId;

    // Remove sensitive metadata
    event.metadata = this.removeSensitiveData(event.metadata);

    // Sanitize based on event type
    switch (event.eventType) {
      case 'error':
        return this.sanitizeErrorEventStrict(event as ErrorEvent) as TelemetryEvent;
      case 'performance':
        return this.sanitizePerformanceEventStrict(event as PerformanceEvent) as TelemetryEvent;
      case 'usage':
        return this.sanitizeUsageEventStrict(event as FeatureUsageEvent) as TelemetryEvent;
      case 'system':
        return this.sanitizeSystemEventStrict(event as SystemMetricsEvent) as TelemetryEvent;
      default:
        return event;
    }
  }

  /**
   * Apply balanced privacy sanitization
   */
  private sanitizeBalanced(event: TelemetryEvent): TelemetryEvent {
    // Hash user identifier instead of removing
    if (event.userId) {
      event.userId = this.hashUserId(event.userId);
    }

    // Sanitize but preserve more data than strict
    event.metadata = this.sanitizeObject(event.metadata);

    // Event-specific balanced sanitization
    switch (event.eventType) {
      case 'error':
        return this.sanitizeErrorEventBalanced(event as ErrorEvent) as TelemetryEvent;
      case 'performance':
        return this.sanitizePerformanceEventBalanced(event as PerformanceEvent) as TelemetryEvent;
      case 'usage':
        return this.sanitizeUsageEventBalanced(event as FeatureUsageEvent) as TelemetryEvent;
      case 'system':
        return this.sanitizeSystemEventBalanced(event as SystemMetricsEvent) as TelemetryEvent;
      default:
        return event;
    }
  }

  /**
   * Apply permissive privacy sanitization
   */
  private sanitizePermissive(event: TelemetryEvent): TelemetryEvent {
    // Light sanitization - mostly just remove obvious PII
    event.metadata = this.lightSanitizeObject(event.metadata);

    switch (event.eventType) {
      case 'error':
        return this.sanitizeErrorEventPermissive(event as ErrorEvent) as TelemetryEvent;
      default:
        return event;
    }
  }

  // ============================================================================
  // Event-specific sanitization methods
  // ============================================================================

  /**
   * Sanitize error events (strict mode)
   */
  private sanitizeErrorEventStrict(event: ErrorEvent): ErrorEvent {
    const sanitized = { ...event };

    // Remove stack trace
    if (sanitized.data.stackTrace) {
      delete sanitized.data.stackTrace;
    }

    // Sanitize error message
    sanitized.data.message = this.sanitizeString(sanitized.data.message);

    // Remove file paths
    if (sanitized.data.context.fileName) {
      sanitized.data.context.fileName = this.sanitizeFilePath(sanitized.data.context.fileName);
    }

    return sanitized;
  }

  /**
   * Sanitize error events (balanced mode)
   */
  private sanitizeErrorEventBalanced(event: ErrorEvent): ErrorEvent {
    const sanitized = { ...event };

    // Sanitize stack trace but keep structure
    if (sanitized.data.stackTrace) {
      sanitized.data.stackTrace = this.sanitizeStackTrace(sanitized.data.stackTrace);
    }

    // Sanitize error message
    sanitized.data.message = this.sanitizeString(sanitized.data.message);

    // Sanitize file paths but preserve structure
    if (sanitized.data.context.fileName) {
      sanitized.data.context.fileName = this.sanitizeFilePath(sanitized.data.context.fileName);
    }

    return sanitized;
  }

  /**
   * Sanitize error events (permissive mode)
   */
  private sanitizeErrorEventPermissive(event: ErrorEvent): ErrorEvent {
    const sanitized = { ...event };

    // Light sanitization of error message
    sanitized.data.message = this.lightSanitizeString(sanitized.data.message);

    // Sanitize obvious PII in stack trace
    if (sanitized.data.stackTrace) {
      sanitized.data.stackTrace = this.lightSanitizeString(sanitized.data.stackTrace);
    }

    return sanitized;
  }

  /**
   * Sanitize performance events (strict mode)
   */
  private sanitizePerformanceEventStrict(event: PerformanceEvent): PerformanceEvent {
    const sanitized = { ...event };

    // Keep only aggregated metrics, remove specific values that might be identifying
    if (sanitized.data.networkMetrics) {
      // Keep counts and averages, remove specific request details
      delete (sanitized.data.networkMetrics as any).requestDetails;
    }

    return sanitized;
  }

  /**
   * Sanitize performance events (balanced mode)
   */
  private sanitizePerformanceEventBalanced(event: PerformanceEvent): PerformanceEvent {
    const sanitized = { ...event };

    // Light sanitization while preserving useful metrics
    sanitized.data.operation = this.sanitizeString(sanitized.data.operation);

    return sanitized;
  }

  /**
   * Sanitize usage events (strict mode)
   */
  private sanitizeUsageEventStrict(event: FeatureUsageEvent): FeatureUsageEvent {
    const sanitized = { ...event };

    // Remove parameters that might contain sensitive data
    if (sanitized.data.parameters) {
      sanitized.data.parameters = this.removeSensitiveData(sanitized.data.parameters);
    }

    // Remove file type information that might be identifying
    if (sanitized.data.context?.fileType) {
      delete sanitized.data.context.fileType;
    }

    return sanitized;
  }

  /**
   * Sanitize usage events (balanced mode)
   */
  private sanitizeUsageEventBalanced(event: FeatureUsageEvent): FeatureUsageEvent {
    const sanitized = { ...event };

    // Sanitize parameters but preserve structure
    if (sanitized.data.parameters) {
      sanitized.data.parameters = this.sanitizeObject(sanitized.data.parameters);
    }

    return sanitized;
  }

  /**
   * Sanitize system events (strict mode)
   */
  private sanitizeSystemEventStrict(event: SystemMetricsEvent): SystemMetricsEvent {
    const sanitized = { ...event };

    // Remove specific version information that might be identifying
    sanitized.data.nodeVersion = this.generalizeVersion(sanitized.data.nodeVersion);

    return sanitized;
  }

  /**
   * Sanitize system events (balanced mode)
   */
  private sanitizeSystemEventBalanced(event: SystemMetricsEvent): SystemMetricsEvent {
    const sanitized = { ...event };

    // Light sanitization while preserving useful system info
    return sanitized;
  }

  // ============================================================================
  // Anonymization helpers
  // ============================================================================

  /**
   * Anonymize error events
   */
  private anonymizeErrorEvent(event: ErrorEvent): ErrorEvent {
    const anonymized = { ...event };

    // Anonymize error message
    anonymized.data.message = this.sanitizeString(anonymized.data.message);

    // Anonymize stack trace
    if (anonymized.data.stackTrace) {
      anonymized.data.stackTrace = this.sanitizeStackTrace(anonymized.data.stackTrace);
    }

    // Anonymize file path
    if (anonymized.data.context.fileName) {
      anonymized.data.context.fileName = this.sanitizeFilePath(anonymized.data.context.fileName);
    }

    return anonymized;
  }

  /**
   * Anonymize performance events
   */
  private anonymizePerformanceEvent(event: PerformanceEvent): PerformanceEvent {
    const anonymized = { ...event };

    // Sanitize operation name
    anonymized.data.operation = this.sanitizeString(anonymized.data.operation);

    return anonymized;
  }

  /**
   * Anonymize usage events
   */
  private anonymizeUsageEvent(event: FeatureUsageEvent): FeatureUsageEvent {
    const anonymized = { ...event };

    // Sanitize parameters
    if (anonymized.data.parameters) {
      anonymized.data.parameters = this.sanitizeObject(anonymized.data.parameters);
    }

    return anonymized;
  }

  /**
   * Anonymize system events
   */
  private anonymizeSystemEvent(event: SystemMetricsEvent): SystemMetricsEvent {
    const anonymized = { ...event };

    // Generalize version information
    anonymized.data.nodeVersion = this.generalizeVersion(anonymized.data.nodeVersion);

    return anonymized;
  }

  // ============================================================================
  // Utility methods
  // ============================================================================

  /**
   * Hash user ID for privacy
   */
  private hashUserId(userId: string): string {
    // Simple hash for user ID (in production, use proper cryptographic hash)
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `user_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Sanitize a string by removing sensitive patterns
   */
  private sanitizeString(str: string): string {
    let sanitized = str;
    
    this.sensitivePatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });

    return sanitized;
  }

  /**
   * Light sanitization for permissive mode
   */
  private lightSanitizeString(str: string): string {
    // Only remove obvious PII like emails and credit cards
    return str
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CARD]');
  }

  /**
   * Sanitize an object recursively
   */
  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        if (Array.isArray(value)) {
          sanitized[key] = value.map(item => 
            typeof item === 'string' ? this.sanitizeString(item) :
            typeof item === 'object' && item !== null ? this.sanitizeObject(item) :
            item
          );
        } else {
          sanitized[key] = this.sanitizeObject(value);
        }
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Light sanitization for objects
   */
  private lightSanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.lightSanitizeString(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.lightSanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Remove obviously sensitive data
   */
  private removeSensitiveData(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'token', 'apikey', 'secret', 'credential', 'auth'];

    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitiveKey => keyLower.includes(sensitiveKey));

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.removeSensitiveData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize file paths while preserving useful structure
   */
  private sanitizeFilePath(filePath: string): string {
    const match = this.filePathPattern.exec(filePath);
    if (match) {
      const [, separator, , filename] = match;
      return `${separator || ''}[PATH]${separator || '/'}${filename}`;
    }
    return '[PATH]';
  }

  /**
   * Sanitize stack trace while preserving structure
   */
  private sanitizeStackTrace(stackTrace: string): string {
    return stackTrace
      .split('\n')
      .map(line => {
        // Preserve function names and line numbers, sanitize file paths
        return line.replace(/\([^)]*\)/g, '([SANITIZED])');
      })
      .join('\n');
  }

  /**
   * Generalize version information
   */
  private generalizeVersion(version: string): string {
    const parts = version.split('.');
    if (parts.length >= 2) {
      return `${parts[0]}.${parts[1]}.x`;
    }
    return version;
  }
}