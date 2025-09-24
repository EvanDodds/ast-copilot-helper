/**
 * AST Helper Security - Input Validation System
 * 
 * Comprehensive input validation and sanitization framework for security compliance.
 * Implements validation rules for user input, query parameters, file paths, and data.
 * Supports customizable validation rules and sanitization policies.
 * 
 * Features:
 * - SQL injection prevention
 * - XSS attack mitigation  
 * - Path traversal protection
 * - Command injection prevention
 * - Data type validation
 * - Custom validation rules
 * - Sanitization policies
 * - Input encoding/decoding
 * 
 * @version 1.0.0
 */

import type {
  ValidationRule,
  SanitizationRule,
  SanitizationResult,
  InputValidationConfig,
  ValidationContext,
  SanitizationContext,
  InputValidationResult
} from './types.js';

/**
 * Core input validator interface
 */
export interface InputValidator {
  /**
   * Validate input against configured rules
   */
  validateInput(input: unknown, context?: ValidationContext): Promise<InputValidationResult>;

  /**
   * Sanitize input according to configured policies  
   */
  sanitizeInput(input: unknown, context?: SanitizationContext): Promise<SanitizationResult>;

  /**
   * Validate and sanitize input in one operation
   */
  validateAndSanitize(input: unknown, context?: ValidationContext & SanitizationContext): Promise<{
    validation: InputValidationResult;
    sanitization: SanitizationResult;
  }>;

  /**
   * Add custom validation rule
   */
  addValidationRule(rule: ValidationRule): void;

  /**
   * Add custom sanitization rule
   */
  addSanitizationRule(rule: SanitizationRule): void;

  /**
   * Get current validation statistics
   */
  getValidationStats(): {
    totalValidations: number;
    validInputs: number;
    invalidInputs: number;
    sanitizations: number;
    blockedInputs: number;
  };
}

/**
 * Default input validation configuration
 */
export const DEFAULT_INPUT_VALIDATION_CONFIG: InputValidationConfig = {
  // SQL Injection Prevention
  sqlInjection: {
    enabled: true,
    strictMode: true,
    blockedPatterns: [
      /(\bselect\b|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|\bunion\b|\balter\b)\s+.*?\bfrom\b/i,
      /'\s*(or|and)\s+.*?=.*?/i, // More flexible OR/AND pattern
      /(--|#|\/\*|\*\/|xp_|sp_)/i, // SQL comments (removed space requirement)
      /;\s*(drop|delete|insert|update|alter)\b/i,
      /union\s+(all\s+)?select/i
    ],
    allowedCharacters: /^[a-zA-Z0-9\s\-_.@()]+$/,
    maxLength: 1000
  },

  // XSS Prevention
  xssProtection: {
    enabled: true,
    strictMode: true,
    blockedTags: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    blockedAttributes: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
    blockedPatterns: [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi
    ],
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    encodeOutput: true
  },

  // Path Traversal Prevention  
  pathTraversal: {
    enabled: true,
    strictMode: true,
    blockedPatterns: [
      /\.\./,
      /\/\.\./,
      /\.\.\\/,
      /\.\.\//,
      /%2e%2e/i,
      /%2f/i,
      /%5c/i
    ],
    allowedPaths: [],
    maxPathLength: 260,
    allowAbsolutePaths: false
  },

  // Command Injection Prevention
  commandInjection: {
    enabled: true,
    strictMode: true,
    blockedCommands: ['rm', 'del', 'format', 'shutdown', 'reboot', 'exec', 'eval'],
    blockedPatterns: [
      /[;&|`$()]/,
      />\s*\/dev\/null/,
      /2>&1/,
      /&&|\|\|/,
      /\$\([^)]*\)/,
      /`[^`]*`/
    ],
    allowedCharacters: /^[a-zA-Z0-9\s\-_./''*]+$/,
    maxLength: 500
  },

  // Data Type Validation
  dataTypes: {
    enabled: true,
    strictTypeChecking: true,
    allowedTypes: ['string', 'number', 'boolean', 'object', 'array'],
    maxStringLength: 10000,
    maxArrayLength: 1000,
    maxObjectDepth: 10,
    numberRange: {
      min: Number.MIN_SAFE_INTEGER,
      max: Number.MAX_SAFE_INTEGER
    }
  },

  // General Settings
  general: {
    caseSensitive: false,
    trimWhitespace: true,
    normalizeUnicode: true,
    maxInputSize: 50000, // 50KB
    enableLogging: true,
    logLevel: 'warn'
  }
};

/**
 * Comprehensive input validator implementation
 */
export class ComprehensiveInputValidator implements InputValidator {
  private config: InputValidationConfig;
  private validationRules: Map<string, ValidationRule>;
  private sanitizationRules: Map<string, SanitizationRule>;
  private stats: {
    totalValidations: number;
    validInputs: number;
    invalidInputs: number;
    sanitizations: number;
    blockedInputs: number;
  };

  constructor(config?: Partial<InputValidationConfig>) {
    this.config = { ...DEFAULT_INPUT_VALIDATION_CONFIG, ...config };
    this.validationRules = new Map();
    this.sanitizationRules = new Map();
    this.stats = {
      totalValidations: 0,
      validInputs: 0,
      invalidInputs: 0,
      sanitizations: 0,
      blockedInputs: 0
    };

    this.initializeDefaultRules();
    this.log('info', 'Input validator initialized successfully', {
      sqlInjectionEnabled: this.config.sqlInjection.enabled,
      xssProtectionEnabled: this.config.xssProtection.enabled,
      pathTraversalEnabled: this.config.pathTraversal.enabled,
      commandInjectionEnabled: this.config.commandInjection.enabled
    });
  }

  /**
   * Validate input against configured rules
   */
  async validateInput(input: unknown, context?: ValidationContext): Promise<InputValidationResult> {
    this.stats.totalValidations++;

    try {
      // Basic input checks
      if (input === null || input === undefined) {
        return this.createValidationResult(true, 'Input is empty');
      }

      const inputStr = String(input);
      
      // Size validation
      if (inputStr.length > this.config.general.maxInputSize) {
        this.stats.blockedInputs++;
        return this.createValidationResult(false, `Input exceeds maximum size of ${this.config.general.maxInputSize} characters`);
      }

      // Normalize input
      const normalizedInput = this.normalizeInput(inputStr);
      
      // Apply validation rules
      const violations: string[] = [];

      // SQL Injection validation (only for SQL context)
      if (this.config.sqlInjection.enabled && 
          (context?.inputType === 'sql' || (!context?.inputType && this.containsSQLPattern(normalizedInput)))) {
        const sqlResult = await this.validateSQLInjection(normalizedInput);
        if (!sqlResult.isValid) {
          violations.push(...sqlResult.violations);
        }
      }

      // XSS validation (only for HTML context or suspicious patterns)
      if (this.config.xssProtection.enabled && 
          (context?.inputType === 'html' || (!context?.inputType && this.containsHTMLPattern(normalizedInput)))) {
        const xssResult = await this.validateXSS(normalizedInput);
        if (!xssResult.isValid) {
          violations.push(...xssResult.violations);
        }
      }

      // Path Traversal validation
      if (this.config.pathTraversal.enabled && context?.inputType === 'path') {
        const pathResult = await this.validatePathTraversal(normalizedInput);
        if (!pathResult.isValid) {
          violations.push(...pathResult.violations);
        }
      }

      // Command Injection validation
      if (this.config.commandInjection.enabled && context?.inputType === 'command') {
        const cmdResult = await this.validateCommandInjection(normalizedInput);
        if (!cmdResult.isValid) {
          violations.push(...cmdResult.violations);
        }
      }

      // Data type validation
      if (this.config.dataTypes.enabled) {
        const typeResult = await this.validateDataTypes(input);
        if (!typeResult.isValid) {
          violations.push(...typeResult.violations);
        }
      }

      // Custom validation rules
      for (const [ruleId, rule] of this.validationRules) {
        if (rule.enabled) {
          const customResult = await rule.validate(input, context);
          if (!customResult.isValid) {
            violations.push(`Rule ${ruleId}: ${customResult.message}`);
          }
        }
      }

      const isValid = violations.length === 0;
      if (isValid) {
        this.stats.validInputs++;
      } else {
        this.stats.invalidInputs++;
        this.log('warn', 'Input validation failed', { violations, input: this.truncateForLog(inputStr) });
      }

      return this.createValidationResult(isValid, violations.join('; '), violations);

    } catch (error) {
      this.stats.invalidInputs++;
      const message = error instanceof Error ? error.message : 'Unknown validation error';
      this.log('error', 'Input validation error', { error: message });
      return this.createValidationResult(false, `Validation error: ${message}`);
    }
  }

  /**
   * Sanitize input according to configured policies
   */
  async sanitizeInput(input: unknown, context?: SanitizationContext): Promise<SanitizationResult> {
    this.stats.sanitizations++;

    try {
      if (input === null || input === undefined) {
        return this.createSanitizationResult('', false, 'Empty input');
      }

      let sanitized = String(input);
      const changes: string[] = [];

      // Normalize input (but preserve case for XSS sanitization)
      if (this.config.general.normalizeUnicode) {
        // Only normalize Unicode, don't change case for sanitization
        const unicodeNormalized = sanitized.normalize('NFC');
        if (unicodeNormalized !== sanitized) {
          changes.push('Unicode normalized');
          sanitized = unicodeNormalized;
        }
      }

      // Trim whitespace
      if (this.config.general.trimWhitespace) {
        const trimmed = sanitized.trim();
        if (trimmed !== sanitized) {
          changes.push('Whitespace trimmed');
          sanitized = trimmed;
        }
      }

      // XSS sanitization
      if (this.config.xssProtection.enabled) {
        const xssSanitized = await this.sanitizeXSS(sanitized);
        if (xssSanitized !== sanitized) {
          changes.push('XSS patterns removed');
          sanitized = xssSanitized;
        }
      }

      // SQL sanitization
      if (this.config.sqlInjection.enabled) {
        const sqlSanitized = await this.sanitizeSQL(sanitized);
        if (sqlSanitized !== sanitized) {
          changes.push('SQL patterns sanitized');
          sanitized = sqlSanitized;
        }
      }

      // Path sanitization
      if (this.config.pathTraversal.enabled && context?.inputType === 'path') {
        const pathSanitized = await this.sanitizePath(sanitized);
        if (pathSanitized !== sanitized) {
          changes.push('Path traversal patterns removed');
          sanitized = pathSanitized;
        }
      }

      // Command sanitization
      if (this.config.commandInjection.enabled && context?.inputType === 'command') {
        const cmdSanitized = await this.sanitizeCommand(sanitized);
        if (cmdSanitized !== sanitized) {
          changes.push('Command injection patterns removed');
          sanitized = cmdSanitized;
        }
      }

      // Apply custom sanitization rules
      for (const [ruleId, rule] of this.sanitizationRules) {
        if (rule.enabled) {
          const customSanitized = await rule.sanitize(sanitized, context);
          if (customSanitized !== sanitized) {
            changes.push(`Rule ${ruleId} applied`);
            sanitized = customSanitized;
          }
        }
      }

      const wasModified = changes.length > 0;
      if (wasModified) {
        this.log('info', 'Input sanitized', { 
          changes, 
          originalLength: String(input).length, 
          sanitizedLength: sanitized.length 
        });
      }

      return this.createSanitizationResult(sanitized, wasModified, changes.join('; '));

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sanitization error';
      this.log('error', 'Input sanitization error', { error: message });
      return this.createSanitizationResult(String(input), false, `Sanitization error: ${message}`);
    }
  }

  /**
   * Validate and sanitize input in one operation
   */
  async validateAndSanitize(
    input: unknown, 
    context?: ValidationContext & SanitizationContext
  ): Promise<{
    validation: InputValidationResult;
    sanitization: SanitizationResult;
  }> {
    const validation = await this.validateInput(input, context);
    const sanitization = await this.sanitizeInput(input, context);

    return { validation, sanitization };
  }

  /**
   * Add custom validation rule
   */
  addValidationRule(rule: ValidationRule): void {
    this.validationRules.set(rule.id, rule);
    this.log('info', `Added custom validation rule: ${rule.id}`);
  }

  /**
   * Add custom sanitization rule  
   */
  addSanitizationRule(rule: SanitizationRule): void {
    this.sanitizationRules.set(rule.id, rule);
    this.log('info', `Added custom sanitization rule: ${rule.id}`);
  }

  /**
   * Get current validation statistics
   */
  getValidationStats(): {
    totalValidations: number;
    validInputs: number;
    invalidInputs: number;
    sanitizations: number;
    blockedInputs: number;
  } {
    return { ...this.stats };
  }

  // Private helper methods

  private initializeDefaultRules(): void {
    // Add any default custom rules here
  }

  private normalizeInput(input: string): string {
    let normalized = input;
    
    if (this.config.general.normalizeUnicode) {
      normalized = normalized.normalize('NFC');
    }
    
    if (!this.config.general.caseSensitive) {
      normalized = normalized.toLowerCase();
    }

    return normalized;
  }

  /**
   * Check if input contains patterns that suggest SQL context
   */
  private containsSQLPattern(input: string): boolean {
    const sqlKeywords = /\b(select|insert|update|delete|from|where|join|union|drop|alter|create|table|or|and)\b/i;
    const sqlOperators = /['"][^'"]*['"].*?(=|<|>|like)/i; // Quoted strings followed by comparison operators
    const sqlComments = /(--|\/\*|\*\/)/;
    const htmlPattern = /<[^>]+>/; // HTML tags
    
    // Don't treat HTML content as SQL
    if (htmlPattern.test(input) && !sqlKeywords.test(input)) {
      return false;
    }
    
    return sqlKeywords.test(input) || sqlOperators.test(input) || sqlComments.test(input);
  }

  /**
   * Check if input contains patterns that suggest HTML context
   */
  private containsHTMLPattern(input: string): boolean {
    const htmlPatterns = /<[^>]+>|&[a-zA-Z0-9#]+;|javascript:|on\w+\s*=/i;
    return htmlPatterns.test(input);
  }

  private async validateSQLInjection(input: string): Promise<{ isValid: boolean; violations: string[] }> {
    const violations: string[] = [];

    // Check blocked patterns
    for (const pattern of this.config.sqlInjection.blockedPatterns) {
      if (pattern.test(input)) {
        violations.push('SQL injection pattern detected');
        break;
      }
    }

    // Check allowed characters
    if (!this.config.sqlInjection.allowedCharacters.test(input)) {
      violations.push('Contains disallowed characters for SQL context');
    }

    // Check length
    if (input.length > this.config.sqlInjection.maxLength) {
      violations.push('Input exceeds maximum SQL length');
    }

    return { isValid: violations.length === 0, violations };
  }

  private async validateXSS(input: string): Promise<{ isValid: boolean; violations: string[] }> {
    const violations: string[] = [];

    // Check blocked patterns
    for (const pattern of this.config.xssProtection.blockedPatterns) {
      // Create a fresh regex instance to avoid issues with global flag state
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      if (freshPattern.test(input)) {
        violations.push('XSS pattern detected');
        break;
      }
    }

    // Check blocked tags
    for (const tag of this.config.xssProtection.blockedTags) {
      const tagPattern = new RegExp(`<${tag}[^>]*>`, 'gi');
      if (tagPattern.test(input)) {
        violations.push(`Blocked HTML tag detected: ${tag}`);
      }
    }

    // Check blocked attributes
    for (const attr of this.config.xssProtection.blockedAttributes) {
      const attrPattern = new RegExp(`${attr}\\s*=`, 'gi');
      if (attrPattern.test(input)) {
        violations.push(`Blocked HTML attribute detected: ${attr}`);
      }
    }

    return { isValid: violations.length === 0, violations };
  }

  private async validatePathTraversal(input: string): Promise<{ isValid: boolean; violations: string[] }> {
    const violations: string[] = [];

    // Check blocked patterns
    for (const pattern of this.config.pathTraversal.blockedPatterns) {
      if (pattern.test(input)) {
        violations.push('Path traversal pattern detected');
        break;
      }
    }

    // Check path length
    if (input.length > this.config.pathTraversal.maxPathLength) {
      violations.push('Path exceeds maximum length');
    }

    // Check absolute paths
    if (!this.config.pathTraversal.allowAbsolutePaths && (input.startsWith('/') || /^[A-Z]:/.test(input))) {
      violations.push('Absolute paths not allowed');
    }

    return { isValid: violations.length === 0, violations };
  }

  private async validateCommandInjection(input: string): Promise<{ isValid: boolean; violations: string[] }> {
    const violations: string[] = [];

    // Check blocked commands
    for (const cmd of this.config.commandInjection.blockedCommands) {
      if (input.includes(cmd)) {
        violations.push(`Blocked command detected: ${cmd}`);
      }
    }

    // Check blocked patterns
    for (const pattern of this.config.commandInjection.blockedPatterns) {
      if (pattern.test(input)) {
        violations.push('Command injection pattern detected');
        break;
      }
    }

    // Check allowed characters
    if (!this.config.commandInjection.allowedCharacters.test(input)) {
      violations.push('Contains disallowed characters for command context');
    }

    return { isValid: violations.length === 0, violations };
  }

  private async validateDataTypes(input: unknown): Promise<{ isValid: boolean; violations: string[] }> {
    const violations: string[] = [];
    const inputType = typeof input;

    // Check allowed types
    if (!this.config.dataTypes.allowedTypes.includes(inputType as any)) {
      violations.push(`Data type '${inputType}' not allowed`);
      return { isValid: false, violations };
    }

    // Type-specific validations
    if (inputType === 'string') {
      const str = input as string;
      if (str.length > this.config.dataTypes.maxStringLength) {
        violations.push('String exceeds maximum length');
      }
    } else if (inputType === 'number') {
      const num = input as number;
      if (num < this.config.dataTypes.numberRange.min || num > this.config.dataTypes.numberRange.max) {
        violations.push('Number outside allowed range');
      }
    } else if (Array.isArray(input)) {
      if (input.length > this.config.dataTypes.maxArrayLength) {
        violations.push('Array exceeds maximum length');
      }
    } else if (inputType === 'object' && input !== null) {
      const depth = this.getObjectDepth(input);
      if (depth > this.config.dataTypes.maxObjectDepth) {
        violations.push('Object exceeds maximum depth');
      }
    }

    return { isValid: violations.length === 0, violations };
  }

  private async sanitizeXSS(input: string): Promise<string> {
    let sanitized = input;

    // Remove blocked tags
    for (const tag of this.config.xssProtection.blockedTags) {
      const tagPattern = new RegExp(`<${tag}[^>]*>.*?<\\/${tag}>`, 'gi');
      sanitized = sanitized.replace(tagPattern, '');
    }

    // Remove blocked attributes
    for (const attr of this.config.xssProtection.blockedAttributes) {
      const attrPattern = new RegExp(`${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      sanitized = sanitized.replace(attrPattern, '');
    }

    // Remove blocked patterns
    for (const pattern of this.config.xssProtection.blockedPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Extract text content from allowed tags
    for (const tag of this.config.xssProtection.allowedTags) {
      const tagPattern = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'gi');
      sanitized = sanitized.replace(tagPattern, '$1');
    }

    // HTML encode if configured (only encode after processing safe tags)
    if (this.config.xssProtection.encodeOutput) {
      sanitized = this.htmlEncode(sanitized);
    }

    return sanitized;
  }

  private async sanitizeSQL(input: string): Promise<string> {
    let sanitized = input;

    // Remove blocked patterns
    for (const pattern of this.config.sqlInjection.blockedPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Escape SQL special characters
    sanitized = sanitized.replace(/'/g, "''");
    sanitized = sanitized.replace(/"/g, '""');

    return sanitized;
  }

  private async sanitizePath(input: string): Promise<string> {
    let sanitized = input;

    // Remove path traversal patterns
    for (const pattern of this.config.pathTraversal.blockedPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Normalize path separators
    sanitized = sanitized.replace(/\\/g, '/');
    
    // Remove double slashes
    sanitized = sanitized.replace(/\/+/g, '/');

    return sanitized;
  }

  private async sanitizeCommand(input: string): Promise<string> {
    let sanitized = input;

    // Remove blocked commands
    for (const cmd of this.config.commandInjection.blockedCommands) {
      const cmdPattern = new RegExp(`\\b${cmd}\\b`, 'gi');
      sanitized = sanitized.replace(cmdPattern, '');
    }

    // Remove command injection patterns
    for (const pattern of this.config.commandInjection.blockedPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    return sanitized;
  }

  private getObjectDepth(obj: any, depth = 0): number {
    if (typeof obj !== 'object' || obj === null) {
      return depth;
    }

    let maxChildDepth = depth;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const childDepth = this.getObjectDepth(obj[key], depth + 1);
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
    }

    return maxChildDepth;
  }

  private htmlEncode(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private createValidationResult(isValid: boolean, message: string, violations?: string[]): InputValidationResult {
    return {
      isValid,
      message,
      violations: violations || [],
      timestamp: new Date().toISOString(),
      context: {}
    };
  }

  private createSanitizationResult(sanitized: string, wasModified: boolean, message: string): SanitizationResult {
    return {
      sanitizedInput: sanitized,
      wasModified,
      message,
      timestamp: new Date().toISOString(),
      context: {}
    };
  }

  private truncateForLog(input: string, maxLength = 200): string {
    return input.length > maxLength ? `${input.substring(0, maxLength)}...` : input;
  }

  private log(level: string, message: string, meta?: any): void {
    if (!this.config.general.enableLogging) {
return;
}

    const logLevels = ['error', 'warn', 'info', 'debug'];
    const configLevel = this.config.general.logLevel;
    const configLevelIndex = logLevels.indexOf(configLevel);
    const messageLevel = logLevels.indexOf(level);

    if (messageLevel <= configLevelIndex) {
      console.log(`[${level.toUpperCase()}] Input Validator: ${message}`, meta ? meta : '');
    }
  }
}

/**
 * Input validation utilities
 */
export class InputValidationUtils {
  /**
   * Quick validation for common input types
   */
  static async quickValidate(input: string, type: 'email' | 'url' | 'phone' | 'ip' | 'uuid'): Promise<boolean> {
    const patterns = {
      email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      url: /^https?:\/\/[^\s/$.?#].[^\s]*$/,
      phone: /^\+?[\d\s\-()]{10,}$/,
      ip: /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    };

    return patterns[type].test(input);
  }

  /**
   * Generate validation report
   */
  static generateValidationReport(results: InputValidationResult[]): {
    totalChecks: number;
    validInputs: number;
    invalidInputs: number;
    commonViolations: string[];
    validationRate: number;
  } {
    const totalChecks = results.length;
    const validInputs = results.filter(r => r.isValid).length;
    const invalidInputs = totalChecks - validInputs;
    
    const allViolations = results.flatMap(r => r.violations || []);
    const violationCounts = new Map<string, number>();
    
    allViolations.forEach(violation => {
      violationCounts.set(violation, (violationCounts.get(violation) || 0) + 1);
    });
    
    const commonViolations = Array.from(violationCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([violation]) => violation);

    const validationRate = totalChecks > 0 ? (validInputs / totalChecks) * 100 : 0;

    return {
      totalChecks,
      validInputs,
      invalidInputs,
      commonViolations,
      validationRate
    };
  }

  /**
   * Create input validation middleware for frameworks
   */
  static createValidationMiddleware(validator: InputValidator) {
    return {
      express: (req: any, res: any, next: any) => {
        // Express.js middleware implementation
        const validateData = async () => {
          try {
            const bodyValidation = await validator.validateInput(req.body);
            const queryValidation = await validator.validateInput(req.query);
            
            if (!bodyValidation.isValid || !queryValidation.isValid) {
              return res.status(400).json({
                error: 'Input validation failed',
                details: {
                  body: bodyValidation,
                  query: queryValidation
                }
              });
            }
            
            next();
          } catch (error) {
            res.status(500).json({ error: 'Validation error' });
          }
        };
        
        validateData();
      }
    };
  }
}