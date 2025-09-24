import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Legal document template types
 */
export type DocumentType = 'privacy-policy' | 'terms-of-service' | 'cookie-policy' | 'license-agreement' | 'data-processing-agreement' | 'custom';

/**
 * Template function type definition
 */
export type TemplateFunction = (...args: never[]) => string | number;

/**
 * Variable substitution context for templates
 */
export interface TemplateVariables {
  [key: string]: string | string[] | boolean | number | Date | TemplateVariables;
}

/**
 * Template metadata for organization and validation
 */
export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  type: DocumentType;
  version: string;
  lastModified: Date;
  author: string;
  jurisdiction?: string; // Legal jurisdiction (e.g., "US", "EU", "US-CA")
  language: string; // ISO language code
  requiredVariables: string[]; // Variables that must be provided
  optionalVariables: string[]; // Variables that are optional
  tags: string[]; // For categorization and search
}

/**
 * Compiled template with metadata and content
 */
export interface CompiledTemplate {
  metadata: TemplateMetadata;
  content: string;
  compiledAt: Date;
  variables: TemplateVariables;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  isValid: boolean;
  missingVariables: string[];
  invalidVariables: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Document generation options
 */
export interface DocumentGenerationOptions {
  outputFormat: 'markdown' | 'html' | 'plain-text' | 'pdf';
  includeTableOfContents?: boolean;
  includeLastModified?: boolean;
  includeGeneratedBy?: boolean;
  customStyles?: string; // CSS for HTML output
  headerFooter?: {
    header?: string;
    footer?: string;
  };
}

/**
 * Generated document result
 */
export interface GeneratedDocument {
  content: string;
  format: string;
  metadata: {
    templateId: string;
    generatedAt: Date;
    wordCount: number;
    estimatedReadingTime: number; // In minutes
  };
  warnings: string[];
}

/**
 * Comprehensive legal document template engine for generating
 * privacy policies, terms of service, and other legal documents
 * with customizable templates and dynamic field substitution.
 */
export class LegalDocumentTemplateEngine {
  private templates: Map<string, TemplateMetadata> = new Map();
  private templateContent: Map<string, string> = new Map();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private customFunctions: Map<string, Function> = new Map();

  constructor() {
    this.initializeBuiltInTemplates();
    this.initializeCustomFunctions();
  }

  /**
   * Initialize built-in legal document templates
   */
  private initializeBuiltInTemplates(): void {
    // Privacy Policy Template
    this.registerTemplate({
      id: 'privacy-policy-standard',
      name: 'Standard Privacy Policy',
      description: 'GDPR and CCPA compliant privacy policy template',
      type: 'privacy-policy',
      version: '1.0.0',
      lastModified: new Date(),
      author: 'AST Legal Compliance Framework',
      jurisdiction: 'US-EU',
      language: 'en',
      requiredVariables: ['companyName', 'contactEmail', 'lastUpdated', 'dataTypes', 'purposes'],
      optionalVariables: ['companyAddress', 'dpoContact', 'cookiePolicy', 'thirdPartyServices'],
      tags: ['gdpr', 'ccpa', 'privacy', 'standard']
    }, this.getPrivacyPolicyTemplate());

    // Terms of Service Template
    this.registerTemplate({
      id: 'terms-of-service-saas',
      name: 'SaaS Terms of Service',
      description: 'Comprehensive terms of service for SaaS applications',
      type: 'terms-of-service',
      version: '1.0.0',
      lastModified: new Date(),
      author: 'AST Legal Compliance Framework',
      jurisdiction: 'US',
      language: 'en',
      requiredVariables: ['serviceName', 'companyName', 'contactEmail', 'lastUpdated'],
      optionalVariables: ['pricingUrl', 'supportUrl', 'disputeResolution'],
      tags: ['saas', 'terms', 'standard']
    }, this.getTermsOfServiceTemplate());

    // Cookie Policy Template
    this.registerTemplate({
      id: 'cookie-policy-standard',
      name: 'Standard Cookie Policy',
      description: 'GDPR compliant cookie policy template',
      type: 'cookie-policy',
      version: '1.0.0',
      lastModified: new Date(),
      author: 'AST Legal Compliance Framework',
      jurisdiction: 'EU',
      language: 'en',
      requiredVariables: ['websiteName', 'companyName', 'contactEmail', 'cookieTypes'],
      optionalVariables: ['cookieSettings', 'analyticsProvider', 'advertisingPartners'],
      tags: ['gdpr', 'cookies', 'privacy']
    }, this.getCookiePolicyTemplate());

    // console.log(`Initialized ${this.templates.size} built-in legal document templates`);
  }

  /**
   * Initialize custom template functions for advanced processing
   */
  private initializeCustomFunctions(): void {
    // Date formatting function
    this.customFunctions.set('formatDate', (date: Date | string, _format = 'MMMM dd, yyyy') => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });

    // List formatting function
    this.customFunctions.set('formatList', (items: string[], type: 'bullet' | 'numbered' = 'bullet') => {
      if (type === 'numbered') {
        return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
      } else {
        return items.map(item => `• ${item}`).join('\n');
      }
    });

    // Conditional inclusion function
    this.customFunctions.set('ifDefined', (value: unknown, trueText: string, falseText = '') => {
      return value !== undefined && value !== null && value !== '' ? trueText : falseText;
    });

    // Word count estimator
    this.customFunctions.set('estimateReadingTime', (text: string, wordsPerMinute = 200) => {
      const wordCount = text.split(/\s+/).length;
      return Math.ceil(wordCount / wordsPerMinute);
    });
  }

  /**
   * Register a new template
   */
  registerTemplate(metadata: TemplateMetadata, content: string): void {
    this.templates.set(metadata.id, metadata);
    this.templateContent.set(metadata.id, content);
    // console.log(`Registered legal document template: ${metadata.name} (${metadata.id})`);
  }

  /**
   * Get all available templates
   */
  getAvailableTemplates(): TemplateMetadata[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by type
   */
  getTemplatesByType(type: DocumentType): TemplateMetadata[] {
    return Array.from(this.templates.values()).filter(t => t.type === type);
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): TemplateMetadata | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Validate template variables
   */
  validateTemplate(templateId: string, variables: TemplateVariables): TemplateValidationResult {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const providedVars = Object.keys(variables);
    const missingVariables = template.requiredVariables.filter(v => !providedVars.includes(v));
    const invalidVariables: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for invalid variable types or formats
    for (const [key, value] of Object.entries(variables)) {
      if (key === 'lastUpdated' && !(value instanceof Date) && typeof value !== 'string') {
        invalidVariables.push(`${key}: Expected Date or string, got ${typeof value}`);
      }
      if (key === 'contactEmail' && typeof value === 'string' && !this.isValidEmail(value)) {
        invalidVariables.push(`${key}: Invalid email format`);
      }
    }

    // Generate suggestions for missing optional variables
    for (const optionalVar of template.optionalVariables) {
      if (!providedVars.includes(optionalVar)) {
        suggestions.push(`Consider providing ${optionalVar} for a more comprehensive document`);
      }
    }

    // Check jurisdiction-specific requirements
    if (template.jurisdiction?.includes('EU') && !variables.dataRetentionPeriod) {
      warnings.push('GDPR compliance: Consider specifying data retention periods');
    }

    return {
      isValid: missingVariables.length === 0 && invalidVariables.length === 0,
      missingVariables,
      invalidVariables,
      warnings,
      suggestions
    };
  }

  /**
   * Generate document from template
   */
  async generateDocument(
    templateId: string,
    variables: TemplateVariables,
    options: DocumentGenerationOptions = { outputFormat: 'markdown' }
  ): Promise<GeneratedDocument> {
    const template = this.templates.get(templateId);
    const content = this.templateContent.get(templateId);

    if (!template || !content) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // console.log(`Generating ${template.type} document from template: ${template.name}`);

    // Validate template variables
    const validation = this.validateTemplate(templateId, variables);
    if (!validation.isValid) {
      throw new Error(`Template validation failed: ${validation.missingVariables.join(', ')}`);
    }

    // Process template content
    let processedContent = this.processTemplate(content, variables);

    // Apply formatting based on output format
    processedContent = await this.formatOutput(processedContent, options, template);

    // Calculate metadata
    const wordCount = processedContent.split(/\s+/).length;
    const estimatedReadingTime = Math.ceil(wordCount / 200);

    return {
      content: processedContent,
      format: options.outputFormat,
      metadata: {
        templateId,
        generatedAt: new Date(),
        wordCount,
        estimatedReadingTime
      },
      warnings: validation.warnings
    };
  }

  /**
   * Process template content with variable substitution
   */
  private processTemplate(content: string, variables: TemplateVariables): string {
    let processed = content;

    // Simple variable substitution {{variable}}
    processed = processed.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      const value = variables[varName];
      if (value === undefined) {
return match;
}
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      return String(value);
    });

    // Advanced function calls {{function:arg1:arg2}}
    processed = processed.replace(/\{\{(\w+):([^}]+)\}\}/g, (match, funcName, args) => {
      const func = this.customFunctions.get(funcName);
      if (!func) {
return match;
}
      
      const argList = args.split(':').map((arg: string) => {
        // Try to resolve variable reference
        if (variables[arg] !== undefined) {
return variables[arg];
}
        // Parse as literal
        if (arg === 'true') {
return true;
}
        if (arg === 'false') {
return false;
}
        if (/^\d+$/.test(arg)) {
return parseInt(arg);
}
        return arg;
      });
      
      try {
        return func(...argList);
      } catch (_error) {
        // console.warn(`Error executing template function ${funcName}:`, error);
        return match;
      }
    });

    // Conditional blocks {{#if condition}}...{{/if}}
    processed = processed.replace(/\{\{#if\s+(\w+)\}\}(.*?)\{\{\/if\}\}/gs, (_match, condition, content) => {
      const value = variables[condition];
      const isTrue = value !== undefined && value !== null && value !== '' && value !== false;
      return isTrue ? content : '';
    });

    // Loop blocks {{#each array}}...{{/each}}
    processed = processed.replace(/\{\{#each\s+(\w+)\}\}(.*?)\{\{\/each\}\}/gs, (_match, arrayName, itemTemplate) => {
      const array = variables[arrayName];
      if (!Array.isArray(array)) {
return '';
}
      
      return array.map((item, index) => {
        let itemContent = itemTemplate;
        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item));
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index));
        return itemContent;
      }).join('');
    });

    return processed;
  }

  /**
   * Format output based on requested format
   */
  private async formatOutput(
    content: string,
    options: DocumentGenerationOptions,
    template: TemplateMetadata
  ): Promise<string> {
    let formatted = content;

    switch (options.outputFormat) {
      case 'html':
        formatted = this.formatAsHTML(formatted, options, template);
        break;
      case 'plain-text':
        formatted = this.formatAsPlainText(formatted);
        break;
      case 'pdf':
        // PDF generation would require additional libraries
        throw new Error('PDF output not yet implemented');
      case 'markdown':
      default:
        // Already in markdown format
        break;
    }

    // Add metadata headers if requested
    if (options.includeLastModified) {
      const header = `*Last modified: ${template.lastModified.toLocaleDateString()}*\n\n`;
      formatted = header + formatted;
    }

    if (options.includeGeneratedBy) {
      const footer = `\n\n---\n*Generated by AST Legal Compliance Framework*`;
      formatted = formatted + footer;
    }

    return formatted;
  }

  /**
   * Format content as HTML
   */
  private formatAsHTML(content: string, options: DocumentGenerationOptions, template: TemplateMetadata): string {
    // Basic markdown to HTML conversion
    let html = content
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    html = '<p>' + html + '</p>';

    // Wrap in HTML document structure
    const styles = options.customStyles || this.getDefaultStyles();
    const title = template.name;

    return `<!DOCTYPE html>
<html lang="${template.language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>${styles}</style>
</head>
<body>
    ${options.headerFooter?.header ? `<header>${options.headerFooter.header}</header>` : ''}
    <main>
        <h1>${title}</h1>
        ${html}
    </main>
    ${options.headerFooter?.footer ? `<footer>${options.headerFooter.footer}</footer>` : ''}
</body>
</html>`;
  }

  /**
   * Format content as plain text
   */
  private formatAsPlainText(content: string): string {
    return content
      .replace(/^#+ /gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  }

  /**
   * Get default CSS styles for HTML output
   */
  private getDefaultStyles(): string {
    return `
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
      h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
      h2 { color: #34495e; border-bottom: 1px solid #bdc3c7; padding-bottom: 5px; }
      h3 { color: #7f8c8d; }
      p { margin-bottom: 15px; }
      strong { color: #2c3e50; }
      em { color: #7f8c8d; }
      header, footer { text-align: center; padding: 20px; border-bottom: 1px solid #ecf0f1; }
      footer { border-bottom: none; border-top: 1px solid #ecf0f1; margin-top: 40px; }
    `;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Load template from file
   */
  async loadTemplateFromFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath, path.extname(filePath));
    
    // Try to parse metadata from file header
    const metadataMatch = content.match(/^---\n(.*?)\n---\n/s);
    let metadata: TemplateMetadata;
    let templateContent = content;
    
    if (metadataMatch) {
      try {
        const metadataStr = metadataMatch[1];
        if (metadataStr) {
          metadata = JSON.parse(metadataStr);
          templateContent = content.substring(metadataMatch[0].length);
        } else {
          metadata = this.createDefaultMetadata(fileName);
        }
      } catch (_error) {
        // console.warn(`Failed to parse metadata from ${filePath}:`, error);
        metadata = this.createDefaultMetadata(fileName);
      }
    } else {
      metadata = this.createDefaultMetadata(fileName);
    }

    this.registerTemplate(metadata, templateContent);
  }

  /**
   * Save template to file
   */
  async saveTemplateToFile(templateId: string, filePath: string): Promise<void> {
    const template = this.templates.get(templateId);
    const content = this.templateContent.get(templateId);
    
    if (!template || !content) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const fileContent = `---
${JSON.stringify(template, null, 2)}
---
${content}`;

    await fs.writeFile(filePath, fileContent, 'utf-8');
    // console.log(`Template saved to: ${filePath}`);
  }

  /**
   * Create default metadata for loaded templates
   */
  private createDefaultMetadata(fileName: string): TemplateMetadata {
    return {
      id: fileName,
      name: fileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: `Custom template: ${fileName}`,
      type: 'custom',
      version: '1.0.0',
      lastModified: new Date(),
      author: 'Custom',
      language: 'en',
      requiredVariables: [],
      optionalVariables: [],
      tags: ['custom']
    };
  }

  /**
   * Get built-in privacy policy template
   */
  private getPrivacyPolicyTemplate(): string {
    return `# Privacy Policy

**Last Updated:** {{lastUpdated}}

## Introduction

{{companyName}} ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how your personal information is collected, used, and disclosed by {{companyName}}.

## Information We Collect

We collect information you provide directly to us, such as when you:
{{#each dataTypes}}
• {{this}}
{{/each}}

## How We Use Your Information

We use the information we collect for the following purposes:
{{#each purposes}}
• {{this}}
{{/each}}

## Information Sharing

We may share your information in the following circumstances:
• With your consent
• To comply with legal obligations
• To protect our rights and safety

{{#if thirdPartyServices}}
## Third-Party Services

We work with the following third-party service providers:
{{#each thirdPartyServices}}
• {{this}}
{{/each}}
{{/if}}

## Data Retention

We retain personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law.

## Your Rights

You have the following rights regarding your personal information:
• Right to access
• Right to rectification
• Right to erasure
• Right to restrict processing
• Right to data portability

## Contact Us

If you have any questions about this Privacy Policy, please contact us at {{contactEmail}}.

{{#if companyAddress}}
**Mailing Address:**
{{companyAddress}}
{{/if}}

{{#if dpoContact}}
**Data Protection Officer:**
{{dpoContact}}
{{/if}}`;
  }

  /**
   * Get built-in terms of service template
   */
  private getTermsOfServiceTemplate(): string {
    return `# Terms of Service

**Last Updated:** {{lastUpdated}}

## 1. Acceptance of Terms

By accessing or using {{serviceName}} (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, then you may not access the Service.

## 2. Description of Service

{{serviceName}} is provided by {{companyName}} ("Company", "we", "us", or "our").

## 3. User Accounts

When you create an account with us, you must provide information that is accurate, complete, and current at all times. You are responsible for safeguarding the password and for all activities under your account.

## 4. Acceptable Use

You may not use our Service:
• For any unlawful purpose or to solicit others to perform unlawful acts
• To violate any international, federal, provincial, or state regulations, rules, or laws
• To infringe upon or violate our intellectual property rights or the intellectual property rights of others
• To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate

## 5. Content

Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, videos, or other material ("Content"). You are responsible for Content that you post to the Service.

## 6. Privacy Policy

Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the Service.

## 7. Prohibited Uses

You may not use our Service for any illegal or unauthorized purpose.

{{#if pricingUrl}}
## 8. Billing and Payments

For billing information, please see our pricing page: {{pricingUrl}}
{{/if}}

## 9. Termination

We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion.

## 10. Disclaimer

The information on this website is provided on an "as is" basis. To the fullest extent permitted by law, this Company excludes all representations, warranties, conditions and terms.

## 11. Limitation of Liability

In no event shall {{companyName}} be liable for any indirect, incidental, special, consequential, or punitive damages.

{{#if disputeResolution}}
## 12. Dispute Resolution

{{disputeResolution}}
{{/if}}

## 13. Changes to Terms

We reserve the right to update or modify these Terms at any time without prior notice.

## 14. Contact Information

If you have any questions about these Terms, please contact us at {{contactEmail}}.

{{#if supportUrl}}
**Support:** {{supportUrl}}
{{/if}}`;
  }

  /**
   * Get built-in cookie policy template
   */
  private getCookiePolicyTemplate(): string {
    return `# Cookie Policy

**Last Updated:** {{lastUpdated}}

## What Are Cookies

Cookies are small pieces of text sent by your web browser by a website you visit. A cookie file is stored in your web browser and allows {{websiteName}} or a third-party to recognize you and make your next visit easier and the service more useful to you.

## How We Use Cookies

{{companyName}} uses cookies for the following purposes:
{{#each cookieTypes}}
• {{this}}
{{/each}}

## Types of Cookies We Use

### Essential Cookies
These cookies are strictly necessary for the operation of our website.

### Analytical/Performance Cookies
These cookies allow us to recognize and count the number of visitors and see how visitors move around our website.

{{#if analyticsProvider}}
### Analytics Cookies
We use {{analyticsProvider}} to analyze website usage and improve our services.
{{/if}}

### Functionality Cookies
These cookies are used to recognize you when you return to our website.

{{#if advertisingPartners}}
### Targeting Cookies
These cookies record your visit to our website and are shared with our advertising partners:
{{#each advertisingPartners}}
• {{this}}
{{/each}}
{{/if}}

## Managing Cookies

Most web browsers allow some control of most cookies through the browser settings. However, if you use your browser settings to block all cookies you may not be able to access all or parts of our site.

{{#if cookieSettings}}
## Cookie Settings

You can manage your cookie preferences at: {{cookieSettings}}
{{/if}}

## More Information

If you have any questions about our use of cookies or other technologies, please email us at {{contactEmail}}.

## Changes to This Cookie Policy

We may update our Cookie Policy from time to time. We will notify you of any changes by posting the new Cookie Policy on this page.`;
  }
}