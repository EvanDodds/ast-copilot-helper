/**
 * Text preprocessing for code-specific embedding generation
 */

import type { Annotation } from './types.js';

/**
 * Configuration for text processing
 */
export interface TextProcessingConfig {
  /** Maximum token length (characters) for input text */
  maxTokenLength: number;
  /** Whether to preserve code structure markers */
  preserveCodeStructure: boolean;
  /** Whether to normalize whitespace */
  normalizeWhitespace: boolean;
  /** Whether to preserve comments */
  preserveComments: boolean;
  /** Maximum snippet length to include */
  maxSnippetLength: number;
}

/**
 * Default text processing configuration optimized for code
 */
const DEFAULT_TEXT_CONFIG: TextProcessingConfig = {
  maxTokenLength: 2048,      // 512 tokens ≈ 2048 chars for CodeBERT
  preserveCodeStructure: true,
  normalizeWhitespace: true,
  preserveComments: false,    // Remove comments to focus on code logic
  maxSnippetLength: 500,     // Limit snippet size
};

/**
 * Text processor optimized for code content
 */
export class CodeTextProcessor {
  private config: TextProcessingConfig;

  constructor(config: Partial<TextProcessingConfig> = {}) {
    this.config = { ...DEFAULT_TEXT_CONFIG, ...config };
  }

  /**
   * Prepare annotation text for embedding generation
   * Combines signature, summary, and source snippet with code-specific optimizations
   */
  prepareTextForEmbedding(annotation: Annotation): string {
    const components: string[] = [];
    
    // Add signature with proper formatting
    if (annotation.signature) {
      const cleanSignature = this.cleanSignature(annotation.signature);
      if (cleanSignature) {
        components.push(`Signature: ${cleanSignature}`);
      }
    }
    
    // Add summary with validation
    if (annotation.summary) {
      const cleanSummary = this.cleanSummary(annotation.summary);
      if (cleanSummary) {
        components.push(`Summary: ${cleanSummary}`);
      }
    }
    
    // Add processed code snippet
    if (annotation.sourceSnippet) {
      const processedCode = this.processCodeSnippet(annotation.sourceSnippet);
      if (processedCode) {
        components.push(`Code: ${processedCode}`);
      }
    }
    
    // Combine components with separator
    let combinedText = components.join(' | ');
    
    // Apply final processing and validation
    combinedText = this.applyFinalProcessing(combinedText);
    
    // Ensure we have some content
    if (!combinedText.trim()) {
      combinedText = `Node: ${annotation.nodeId}`; // Fallback content
    }
    
    return combinedText;
  }

  /**
   * Clean and optimize function/method signatures
   */
  private cleanSignature(signature: string): string {
    let cleaned = signature.trim();
    
    // Remove excessive whitespace
    if (this.config.normalizeWhitespace) {
      cleaned = this.normalizeWhitespace(cleaned);
    }
    
    // Remove access modifiers that don't add semantic value for embedding
    cleaned = cleaned.replace(/^(public|private|protected|static|async|export|default)\s+/g, '');
    
    // Normalize function declaration formats
    cleaned = cleaned.replace(/\bfunction\s+/g, '');
    cleaned = cleaned.replace(/\s*=>\s*/g, ' => ');
    
    // Remove type annotations in TypeScript (keep core structure)
    cleaned = cleaned.replace(/:\s*[A-Za-z<>\[\]|&\s]+(?=\s*[,)])/g, '');
    
    return cleaned.substring(0, 200); // Limit signature length
  }

  /**
   * Clean and optimize summary text
   */
  private cleanSummary(summary: string): string {
    let cleaned = summary.trim();
    
    if (this.config.normalizeWhitespace) {
      cleaned = this.normalizeWhitespace(cleaned);
    }
    
    // Remove markdown formatting that doesn't add value
    cleaned = cleaned.replace(/[*_`]/g, '');
    
    // Normalize sentence endings
    cleaned = cleaned.replace(/\.\s*$/, '');
    
    // Remove redundant phrases common in generated summaries
    cleaned = cleaned.replace(/^(This function|This method|This class)\s+/i, '');
    
    return cleaned.substring(0, 300); // Limit summary length
  }

  /**
   * Process code snippets with code-specific optimizations
   */
  private processCodeSnippet(snippet: string): string {
    let processed = snippet;
    
    // Limit snippet length
    if (processed.length > this.config.maxSnippetLength) {
      processed = this.intelligentTruncate(processed, this.config.maxSnippetLength);
    }
    
    // Remove comments if configured
    if (!this.config.preserveComments) {
      processed = this.removeComments(processed);
    }
    
    // Normalize whitespace while preserving code structure
    if (this.config.normalizeWhitespace && this.config.preserveCodeStructure) {
      processed = this.normalizeCodeWhitespace(processed);
    } else if (this.config.normalizeWhitespace) {
      processed = this.normalizeWhitespace(processed);
    }
    
    // Remove empty lines and excessive spacing
    processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return processed.trim();
  }

  /**
   * Apply final processing to the combined text
   */
  private applyFinalProcessing(text: string): string {
    let processed = text;
    
    // Ensure text is within token limits
    if (processed.length > this.config.maxTokenLength) {
      processed = this.intelligentTruncate(processed, this.config.maxTokenLength - 3) + '...';
    }
    
    // Final whitespace normalization
    processed = this.normalizeWhitespace(processed);
    
    // Remove any control characters or invalid Unicode
    processed = this.sanitizeText(processed);
    
    return processed;
  }

  /**
   * Intelligent truncation that tries to preserve meaningful content
   */
  private intelligentTruncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Try to truncate at sentence boundaries
    const sentences = text.split(/[.!?]\s+/);
    let truncated = '';
    
    for (const sentence of sentences) {
      if ((truncated + sentence).length <= maxLength - 10) {
        truncated += (truncated ? '. ' : '') + sentence;
      } else {
        break;
      }
    }
    
    // If no sentences fit, truncate at word boundaries
    if (!truncated) {
      const words = text.split(/\s+/);
      truncated = '';
      
      for (const word of words) {
        if ((truncated + ' ' + word).length <= maxLength - 10) {
          truncated += (truncated ? ' ' : '') + word;
        } else {
          break;
        }
      }
    }
    
    // Last resort: character truncation
    if (!truncated) {
      truncated = text.substring(0, maxLength - 3);
    }
    
    return truncated;
  }

  /**
   * Remove comments from code while preserving structure
   */
  private removeComments(code: string): string {
    let processed = code;
    
    // Remove single-line comments (// and #)
    processed = processed.replace(/\/\/.*$/gm, '');
    processed = processed.replace(/#.*$/gm, '');
    
    // Remove multi-line comments (/* */, ''' ''', """ """)
    processed = processed.replace(/\/\*[\s\S]*?\*\//g, '');
    processed = processed.replace(/'''[\s\S]*?'''/g, '');
    processed = processed.replace(/"""[\s\S]*?"""/g, '');
    
    // Remove HTML-style comments
    processed = processed.replace(/<!--[\s\S]*?-->/g, '');
    
    return processed;
  }

  /**
   * Normalize whitespace while preserving code structure
   */
  private normalizeCodeWhitespace(code: string): string {
    let normalized = code;
    
    // Replace tabs with spaces (2 spaces for consistency)
    normalized = normalized.replace(/\t/g, '  ');
    
    // Remove trailing spaces from lines
    normalized = normalized.replace(/[ \t]+$/gm, '');
    
    // Normalize multiple spaces to single space (but preserve indentation)
    normalized = normalized.replace(/(?<!^)  +/gm, ' ');
    
    // Remove excessive blank lines (max 1 blank line)
    normalized = normalized.replace(/\n\n+/g, '\n\n');
    
    return normalized;
  }

  /**
   * Basic whitespace normalization
   */
  private normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * Sanitize text by removing control characters and invalid Unicode
   */
  private sanitizeText(text: string): string {
    // Remove control characters except common ones (newline, tab)
    // eslint-disable-next-line no-control-regex
    let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    // Ensure valid UTF-8 encoding
    try {
      sanitized = decodeURIComponent(encodeURIComponent(sanitized));
    } catch {
      // If encoding fails, remove non-ASCII characters as fallback
      // eslint-disable-next-line no-control-regex
      sanitized = sanitized.replace(/[^\x00-\x7F]/g, '');
    }
    
    return sanitized;
  }

  /**
   * Validate input text for common issues
   */
  validateInputText(text: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (!text || typeof text !== 'string') {
      issues.push('Text is not a valid string');
    }
    
    if (text.length === 0) {
      issues.push('Text is empty');
    }
    
    if (text.length > this.config.maxTokenLength) {
      issues.push(`Text exceeds maximum length of ${this.config.maxTokenLength} characters`);
    }
    
    // Check for potential encoding issues
    if (text !== text.trim() && text.trim().length === 0) {
      issues.push('Text contains only whitespace');
    }
    
    // Check for excessive repetition (potential data quality issue)
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length > 10 && uniqueWords.size / words.length < 0.3) {
      issues.push('Text has excessive repetition (possible data quality issue)');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Get processing statistics for monitoring
   */
  getProcessingStats(originalText: string, processedText: string): {
    originalLength: number;
    processedLength: number;
    compressionRatio: number;
    wordCount: number;
  } {
    const originalLength = originalText.length;
    const processedLength = processedText.length;
    const wordCount = processedText.split(/\s+/).length;
    const compressionRatio = originalLength > 0 ? processedLength / originalLength : 1;
    
    return {
      originalLength,
      processedLength,
      compressionRatio,
      wordCount,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TextProcessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): TextProcessingConfig {
    return { ...this.config };
  }
}