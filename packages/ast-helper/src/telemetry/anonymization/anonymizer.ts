/**
 * @file Privacy-Respecting Data Anonymizer
 * @description Comprehensive data anonymization system with configurable privacy levels
 */

import { createHash, randomBytes } from 'crypto';
import { DataAnonymizer as IDataAnonymizer, PrivacyLevel } from '../types.js';
import { 
  AnonymizationConfig, 
  AnonymizationResult, 
  AnonymizationStrategy, 
  AnonymizationRule, 
  AnonymizationOptions, 
  DataCategory
} from './types.js';

/**
 * Privacy-respecting data anonymizer implementation
 */
export class PrivacyRespectingDataAnonymizer implements IDataAnonymizer {
  private config: AnonymizationConfig;
  private isInitialized = false;

  constructor(config?: Partial<AnonymizationConfig>) {
    this.config = this.mergeWithDefaults(config || {});
  }

  /**
   * Initialize the data anonymizer
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('DataAnonymizer is already initialized');
    }

    try {
      // Validate configuration
      this.validateConfig();

      // Generate salt if not provided
      if (!this.config.hashSalt) {
        this.config.hashSalt = randomBytes(32).toString('hex');
      }

      this.isInitialized = true;
      console.log('DataAnonymizer initialized successfully');
    } catch (error: any) {
      throw new Error(`Failed to initialize DataAnonymizer: ${error.message}`);
    }
  }

  /**
   * Anonymize usage metrics
   */
  async anonymizeUsageMetrics(metrics: any): Promise<AnonymizationResult> {
    if (!this.isInitialized) {
      throw new Error('DataAnonymizer not initialized');
    }

    const originalSize = this.getDataSize(metrics);
    
    try {
      const anonymized = await this.anonymizeData(metrics, {
        category: DataCategory.USAGE_DATA,
        preserveStructure: true
      });

      return {
        data: anonymized,
        success: true,
        warnings: [],
        metadata: {
          timestamp: new Date(),
          privacyLevel: this.config.privacyLevel,
          rulesApplied: this.getAppliedRules(metrics),
          originalSize,
          anonymizedSize: this.getDataSize(anonymized),
          reductionRatio: this.calculateReduction(originalSize, this.getDataSize(anonymized))
        }
      };
    } catch (error: any) {
      return {
        data: {},
        success: false,
        warnings: [`Anonymization failed: ${error.message}`],
        metadata: {
          timestamp: new Date(),
          privacyLevel: this.config.privacyLevel,
          rulesApplied: [],
          originalSize,
          anonymizedSize: 0,
          reductionRatio: 0
        }
      };
    }
  }

  /**
   * Anonymize arbitrary data
   */
  async anonymizeData(data: any, options?: AnonymizationOptions): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('DataAnonymizer not initialized');
    }

    const privacyLevel = options?.privacyLevel || this.config.privacyLevel;
    const category = options?.category || DataCategory.CUSTOM_DATA;
    const preserveStructure = options?.preserveStructure ?? this.config.preserveStructure;

    return this.anonymizeValue(data, privacyLevel, category, preserveStructure, options?.context);
  }

  /**
   * Generate machine ID (anonymized)
   */
  async generateMachineId(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('DataAnonymizer not initialized');
    }

    // Generate a consistent but anonymous machine identifier
    const machineInfo = this.getMachineInfo();
    return this.hashData(JSON.stringify(machineInfo), 'machine');
  }

  /**
   * Hash user ID (anonymized)
   */
  async hashUserId(machineId: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('DataAnonymizer not initialized');
    }

    return this.hashData(machineId, 'user');
  }

  /**
   * Update privacy level
   */
  async updatePrivacyLevel(level: PrivacyLevel): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('DataAnonymizer not initialized');
    }

    this.config.privacyLevel = level;
    console.log(`Privacy level updated to: ${level}`);
  }

  /**
   * Get anonymization statistics
   */
  async getStatistics(): Promise<{
    privacyLevel: PrivacyLevel;
    rulesCount: number;
    totalProcessed: number;
    averageReduction: number;
  }> {
    return {
      privacyLevel: this.config.privacyLevel,
      rulesCount: this.config.customRules.length,
      totalProcessed: 0, // Would track in real implementation
      averageReduction: 0.3 // Would calculate in real implementation
    };
  }

  /**
   * Anonymize a single value based on privacy level and type
   */
  private anonymizeValue(
    value: any, 
    privacyLevel: PrivacyLevel, 
    category: DataCategory,
    preserveStructure: boolean,
    context?: Record<string, any>
  ): any {
    if (value === null || value === undefined) {
      return value;
    }

    // Handle different data types
    if (typeof value === 'string') {
      return this.anonymizeString(value, privacyLevel, category);
    }

    if (typeof value === 'number') {
      return this.anonymizeNumber(value, privacyLevel, category);
    }

    if (typeof value === 'boolean') {
      return value; // Booleans are generally safe
    }

    if (Array.isArray(value)) {
      return preserveStructure ? 
        value.map(item => this.anonymizeValue(item, privacyLevel, category, preserveStructure, context)) :
        `[${value.length} items]`;
    }

    if (typeof value === 'object') {
      if (value instanceof Date) {
        return this.anonymizeDate(value, privacyLevel);
      }

      return preserveStructure ?
        this.anonymizeObject(value, privacyLevel, category, context) :
        `{${Object.keys(value).length} properties}`;
    }

    return value;
  }

  /**
   * Anonymize string values
   */
  private anonymizeString(value: string, privacyLevel: PrivacyLevel, category: DataCategory): string {
    // Apply custom rules first
    for (const rule of this.config.customRules) {
      if (this.matchesPattern(value, rule.pattern)) {
        return this.applyRule(value, rule);
      }
    }

    // Apply category-specific anonymization
    switch (category) {
      case DataCategory.PERSONAL_IDENTIFIER:
        return this.hashData(value, 'personal');
      
      case DataCategory.FILE_PATH:
        return this.anonymizeFilePath(value, privacyLevel);
      
      case DataCategory.ERROR_MESSAGE:
        return this.anonymizeErrorMessage(value, privacyLevel);
      
      default:
        return this.anonymizeGenericString(value, privacyLevel);
    }
  }

  /**
   * Anonymize numeric values
   */
  private anonymizeNumber(value: number, privacyLevel: PrivacyLevel, category: DataCategory): number {
    switch (privacyLevel) {
      case 'strict':
        // Round to reduce precision
        return category === DataCategory.PERFORMANCE_DATA ? 
          Math.round(value / 100) * 100 : // Round to hundreds
          Math.round(value);
      
      case 'balanced':
        return category === DataCategory.PERFORMANCE_DATA ?
          Math.round(value / 10) * 10 : // Round to tens
          value;
      
      case 'permissive':
        return value;
      
      default:
        return Math.round(value);
    }
  }

  /**
   * Anonymize date values
   */
  private anonymizeDate(value: Date, privacyLevel: PrivacyLevel): Date | string {
    switch (privacyLevel) {
      case 'strict':
        // Return only year-month
        return `${value.getFullYear()}-${(value.getMonth() + 1).toString().padStart(2, '0')}`;
      
      case 'balanced':
        // Return date without time
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
      
      case 'permissive':
        return value;
      
      default:
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
  }

  /**
   * Anonymize object recursively
   */
  private anonymizeObject(
    obj: Record<string, any>, 
    privacyLevel: PrivacyLevel, 
    category: DataCategory,
    context?: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip excluded patterns
      if (this.isExcluded(key)) {
        result[key] = value;
        continue;
      }

      // Anonymize the key if needed
      const anonymizedKey = this.shouldAnonymizeKey(key, privacyLevel) ?
        this.hashData(key, 'key') : key;

      // Anonymize the value
      result[anonymizedKey] = this.anonymizeValue(value, privacyLevel, category, true, context);
    }

    return result;
  }

  /**
   * Anonymize file paths
   */
  private anonymizeFilePath(path: string, privacyLevel: PrivacyLevel): string {
    switch (privacyLevel) {
      case 'strict':
        // Keep only file extension
        const ext = path.split('.').pop();
        return ext ? `[hidden].${ext}` : '[hidden]';
      
      case 'balanced':
        // Keep filename but hash directory
        const parts = path.split(/[/\\]/);
        const filename = parts.pop() || '';
        return parts.length > 0 ? `[${parts.length} dirs]/${filename}` : filename;
      
      case 'permissive':
        return path;
      
      default:
        return '[hidden]';
    }
  }

  /**
   * Anonymize error messages
   */
  private anonymizeErrorMessage(message: string, privacyLevel: PrivacyLevel): string {
    switch (privacyLevel) {
      case 'strict':
        // Keep only error type
        return message.split(':')[0] || 'Error';
      
      case 'balanced':
        // Remove file paths and personal info
        return message.replace(/\/[^\s]+/g, '[path]')
                     .replace(/\b\w+@\w+\.\w+\b/g, '[email]')
                     .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]');
      
      case 'permissive':
        return message;
      
      default:
        return 'Error';
    }
  }

  /**
   * Anonymize generic strings
   */
  private anonymizeGenericString(value: string, privacyLevel: PrivacyLevel): string {
    if (value.length === 0) return value;

    switch (privacyLevel) {
      case 'strict':
        return value.length > 10 ? `[${value.length} chars]` : '*'.repeat(value.length);
      
      case 'balanced':
        return value.length > 50 ? 
          value.substring(0, 10) + `...[${value.length - 10} more]` :
          value;
      
      case 'permissive':
        return value;
      
      default:
        return `[${value.length} chars]`;
    }
  }

  /**
   * Hash data with salt and context
   */
  private hashData(data: string, context: string): string {
    const hash = createHash('sha256');
    hash.update(this.config.hashSalt);
    hash.update(context);
    hash.update(data);
    return hash.digest('hex').substring(0, 16); // Truncate for readability
  }

  /**
   * Get machine information for ID generation
   */
  private getMachineInfo(): Record<string, any> {
    // In a real implementation, this would collect system info
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      // Exclude potentially identifying information
      timestamp: Math.floor(Date.now() / (1000 * 60 * 60 * 24)) // Day-level precision
    };
  }

  /**
   * Check if a pattern matches
   */
  private matchesPattern(value: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return value.includes(pattern);
    }
    return pattern.test(value);
  }

  /**
   * Apply anonymization rule
   */
  private applyRule(value: string, rule: AnonymizationRule): string {
    switch (rule.strategy) {
      case AnonymizationStrategy.HASH:
        return this.hashData(value, 'custom');
      
      case AnonymizationStrategy.REDACT:
        return rule.replacement || '[REDACTED]';
      
      case AnonymizationStrategy.MASK:
        const maskChar = rule.replacement || '*';
        return maskChar.repeat(Math.min(value.length, this.config.maxMaskLength));
      
      case AnonymizationStrategy.REMOVE:
        return '';
      
      case AnonymizationStrategy.ENCRYPT:
        return this.hashData(value, 'encrypted'); // Simplified encryption
      
      default:
        return value;
    }
  }

  /**
   * Check if key should be excluded from anonymization
   */
  private isExcluded(key: string): boolean {
    return this.config.excludePatterns.some(pattern => key.includes(pattern));
  }

  /**
   * Check if object key should be anonymized
   */
  private shouldAnonymizeKey(key: string, privacyLevel: PrivacyLevel): boolean {
    if (privacyLevel === 'permissive') return false;
    
    const sensitiveKeys = ['id', 'userId', 'sessionId', 'email', 'name', 'username'];
    return sensitiveKeys.includes(key.toLowerCase());
  }

  /**
   * Get applied rules for metadata
   */
  private getAppliedRules(_data: any): string[] {
    // In a real implementation, this would track which rules were applied
    return ['default_anonymization'];
  }

  /**
   * Calculate data size in bytes
   */
  private getDataSize(data: any): number {
    return JSON.stringify(data).length;
  }

  /**
   * Calculate reduction ratio
   */
  private calculateReduction(original: number, anonymized: number): number {
    if (original === 0) return 0;
    return (original - anonymized) / original;
  }

  /**
   * Merge configuration with defaults
   */
  private mergeWithDefaults(config: Partial<AnonymizationConfig>): AnonymizationConfig {
    return {
      privacyLevel: config.privacyLevel || 'balanced',
      hashSalt: config.hashSalt || '',
      preserveStructure: config.preserveStructure ?? true,
      excludePatterns: config.excludePatterns || ['version', 'timestamp', 'duration'],
      maxMaskLength: config.maxMaskLength || 20,
      customRules: config.customRules || []
    };
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (!this.config.privacyLevel) {
      throw new Error('Privacy level is required');
    }

    const validLevels: PrivacyLevel[] = ['strict', 'balanced', 'permissive'];
    if (!validLevels.includes(this.config.privacyLevel)) {
      throw new Error(`Invalid privacy level: ${this.config.privacyLevel}`);
    }

    if (this.config.maxMaskLength < 1) {
      throw new Error('Max mask length must be positive');
    }
  }

  /**
   * Shutdown the anonymizer
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      console.log('DataAnonymizer shutdown completed');
      this.isInitialized = false;
    }
  }
}