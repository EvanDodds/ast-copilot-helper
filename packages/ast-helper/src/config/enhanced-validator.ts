/**
 * Enhanced configuration validation engine
 * Provides comprehensive validation with detailed error reporting
 */

import type { PartialConfig } from '../types.js';
import type { ValidationRule, ValidationSchema } from './validation-schema.js';
import { CONFIG_VALIDATION_SCHEMA } from './validation-schema.js';

/**
 * Validation error with context and suggestions
 */
export interface ValidationError {
  /** Path to the invalid configuration property */
  path: string;
  /** Error message describing what's wrong */
  message: string;
  /** Suggested fix for the error */
  suggestion?: string;
  /** Example of valid values */
  example?: any;
  /** The invalid value that caused the error */
  invalidValue?: any;
}

/**
 * Result of configuration validation
 */
export interface ValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** List of validation errors (empty if valid) */
  errors: ValidationError[];
  /** List of warnings (non-blocking issues) */
  warnings: ValidationError[];
  /** Cleaned/corrected configuration (may differ from input) */
  cleanedConfig?: PartialConfig;
}

/**
 * Enhanced configuration validator
 */
export class EnhancedConfigValidator {
  private schema: ValidationSchema;
  
  constructor(schema: ValidationSchema = CONFIG_VALIDATION_SCHEMA) {
    this.schema = schema;
  }
  
  /**
   * Validate a configuration object with detailed error reporting
   */
  validate(config: PartialConfig): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const cleanedConfig: PartialConfig = {};
    
    this.validateObject(config, this.schema, '', errors, warnings, cleanedConfig);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      cleanedConfig: errors.length === 0 ? cleanedConfig : undefined
    };
  }
  
  /**
   * Recursively validate an object against a schema
   */
  private validateObject(
    obj: any,
    schema: ValidationSchema,
    path: string,
    errors: ValidationError[],
    warnings: ValidationError[],
    cleaned: any
  ): void {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    
    // Initialize cleaned object for this level
    if (cleaned && typeof cleaned === 'object') {
      // Already initialized
    }
    
    // Validate each property in the object
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      const schemaRule = schema[key];
      
      if (!schemaRule) {
        // Unknown property - add warning but don't fail
        warnings.push({
          path: currentPath,
          message: `Unknown configuration property: ${currentPath}`,
          suggestion: 'Remove this property or check for typos in property name',
          invalidValue: value
        });
        continue;
      }
      
      if (this.isValidationRule(schemaRule)) {
        // Direct validation rule
        this.validateValue(value, schemaRule, currentPath, errors, warnings, cleaned, key);
      } else if (typeof schemaRule === 'object') {
        // Nested schema
        if (value !== null && typeof value === 'object') {
          cleaned[key] = {};
          this.validateObject(value, schemaRule, currentPath, errors, warnings, cleaned[key]);
        } else if (value !== undefined) {
          errors.push({
            path: currentPath,
            message: `${currentPath} must be an object, got: ${typeof value}`,
            suggestion: 'Provide an object with the appropriate nested properties',
            invalidValue: value
          });
        }
      }
    }
  }
  
  /**
   * Validate a single value against a validation rule
   */
  private validateValue(
    value: any,
    rule: ValidationRule,
    path: string,
    errors: ValidationError[],
    _warnings: ValidationError[],
    cleaned: any,
    key: string
  ): void {
    if (value === undefined) {
      return; // Optional properties
    }
    
    const result = rule.validate(value);
    
    if (result === true) {
      // Validation passed - store cleaned value
      cleaned[key] = this.cleanValue(value, path);
    } else {
      // Validation failed
      errors.push({
        path,
        message: result,
        suggestion: rule.suggestion,
        example: rule.example,
        invalidValue: value
      });
    }
  }
  
  /**
   * Clean and normalize a valid value
   */
  private cleanValue(value: any, path: string): any {
    // Handle specific cleaning for different types
    if (typeof value === 'string') {
      const trimmed = value.trim();
      
      // Convert string booleans to actual booleans for boolean fields
      if (this.isBooleanField(path)) {
        const lower = trimmed.toLowerCase();
        if (['true', '1', 'yes'].includes(lower)) {
return true;
}
        if (['false', '0', 'no'].includes(lower)) {
return false;
}
      }
      
      // Convert numeric strings to numbers for numeric fields
      if (this.isNumericField(path)) {
        const num = Number(trimmed);
        if (!isNaN(num)) {
return num;
}
      }
      
      return trimmed;
    }
    
    // Handle number to boolean conversion for boolean fields
    if (typeof value === 'number' && this.isBooleanField(path)) {
      return value === 1 || value > 0;
    }
    
    if (Array.isArray(value)) {
      return value
        .filter(item => typeof item === 'string' && item.trim().length > 0)
        .map(item => item.trim());
    }
    
    if (typeof value === 'number') {
      return Number(value);
    }
    
    return value;
  }
  
  /**
   * Check if a path represents a boolean field
   */
  private isBooleanField(path: string): boolean {
    const booleanFields = [
      'enableTelemetry', 'verbose', 'debug', 'jsonLogs',
      'showProgress', 'enableRecursive', 'followSymlinks',
      'enableConfidenceScoring', 'preserveCodeStructure',
      'normalizeWhitespace', 'preserveComments'
    ];
    
    const pathSegments = path.split('.');
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    return (lastSegment && booleanFields.includes(lastSegment)) || 
           pathSegments.some(segment => booleanFields.includes(segment));
  }
  
  /**
   * Check if a path represents a numeric field
   */
  private isNumericField(path: string): boolean {
    const numericFields = [
      'topK', 'snippetLines', 'concurrency', 'batchSize',
      'efConstruction', 'M', 'downloadTimeout', 'maxConcurrentDownloads',
      'maxConcurrency', 'memoryLimit', 'maxTokenLength', 'maxSnippetLength',
      'debounceMs'
    ];
    
    const pathSegments = path.split('.');
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    return (lastSegment && numericFields.includes(lastSegment)) || 
           pathSegments.some(segment => numericFields.includes(segment));
  }
  
  /**
   * Type guard to check if a value is a ValidationRule
   */
  private isValidationRule(value: any): value is ValidationRule {
    return value && typeof value === 'object' && typeof value.validate === 'function';
  }
  
  /**
   * Format validation errors into a human-readable report
   */
  static formatErrors(result: ValidationResult): string {
    if (result.valid) {
      const warningText = result.warnings.length > 0 
        ? `\n\nWarnings (${result.warnings.length}):\n${this.formatErrorList(result.warnings)}`
        : '';
      return `✅ Configuration is valid${warningText}`;
    }
    
    let report = `❌ Configuration validation failed (${result.errors.length} error${result.errors.length === 1 ? '' : 's'}):\n\n`;
    report += this.formatErrorList(result.errors);
    
    if (result.warnings.length > 0) {
      report += `\n\nWarnings (${result.warnings.length}):\n${this.formatErrorList(result.warnings)}`;
    }
    
    return report;
  }
  
  /**
   * Format a list of validation errors
   */
  private static formatErrorList(errors: ValidationError[]): string {
    return errors.map(error => {
      let msg = `• ${error.path}: ${error.message}`;
      if (error.suggestion) {
        msg += `\n  💡 ${error.suggestion}`;
      }
      if (error.example) {
        const examples = Array.isArray(error.example) ? error.example : [error.example];
        msg += `\n  📋 Examples: ${examples.map(ex => JSON.stringify(ex)).join(', ')}`;
      }
      return msg;
    }).join('\n\n');
  }
  
  /**
   * Validate and throw detailed error if invalid
   */
  validateAndThrow(config: PartialConfig): PartialConfig {
    const result = this.validate(config);
    
    if (!result.valid) {
      const errorMessage = EnhancedConfigValidator.formatErrors(result);
      throw new Error(`Configuration validation failed:\n\n${errorMessage}`);
    }
    
    // Log warnings if present
    if (result.warnings.length > 0) {
      console.warn(`Configuration warnings:\n${EnhancedConfigValidator.formatErrors(result)}`);
    }
    
    return result.cleanedConfig!;
  }
}

// Create default validator instance
export const defaultValidator = new EnhancedConfigValidator();

/**
 * Convenience function for validating configuration
 */
export function validateConfig(config: PartialConfig): ValidationResult {
  return defaultValidator.validate(config);
}

/**
 * Convenience function for validating and throwing on errors
 */
export function validateConfigStrict(config: PartialConfig): PartialConfig {
  return defaultValidator.validateAndThrow(config);
}