/**
 * Static analysis-based suggestion generator
 */

import {
  SuggestionGenerator,
  SuggestionSource,
  SuggestionContext,
  ResolutionSuggestion,
  SuggestionType
} from './types.js';

/**
 * Code analysis result interface
 */
interface AnalysisResult {
  issue: string;
  severity: 'error' | 'warning' | 'info';
  line?: number;
  column?: number;
  suggestion: string;
  fixable: boolean;
  confidence: number;
}

/**
 * Static analysis-based suggestion generator that analyzes code structure
 * and provides contextual recommendations
 */
export class StaticAnalysisGenerator implements SuggestionGenerator {
  readonly name = 'static-analysis';
  readonly source: SuggestionSource = 'static-analysis';
  readonly priority = 20;
  readonly supportedTypes = ['syntax-error', 'type-error', 'reference-error'];

  /**
   * Check if this generator can handle the given context
   */
  async canHandle(context: SuggestionContext): Promise<boolean> {
    // Can handle errors with stack traces and code context
    return !!(context.error.stack && context.codebase.currentFile);
  }

  /**
   * Generate suggestions based on static analysis
   */
  async generateSuggestions(context: SuggestionContext): Promise<ResolutionSuggestion[]> {
    const suggestions: ResolutionSuggestion[] = [];

    try {
      // Analyze the error and code context
      const analysisResults = await this.analyzeError(context);
      
      // Convert analysis results to suggestions
      for (const result of analysisResults) {
        const suggestion = await this.createSuggestionFromAnalysis(result, context);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }

      // Sort by confidence and severity
      return suggestions.sort((a, b) => {
        const scoreA = a.relevanceScore * this.confidenceToNumber(a.confidence);
        const scoreB = b.relevanceScore * this.confidenceToNumber(b.confidence);
        return scoreB - scoreA;
      });

    } catch (error) {
      console.warn('Static analysis failed:', error);
      return [];
    }
  }

  /**
   * Get confidence score for the given context
   */
  async getConfidenceScore(context: SuggestionContext): Promise<number> {
    if (!context.codebase.currentFile || !context.error.stack) {
      return 0.1;
    }

    // Higher confidence if we have more code context
    let confidence = 0.5;
    
    if (context.error.stack) confidence += 0.2;
    if (context.environment.dependencies) confidence += 0.1;
    if (context.codebase.recentChanges?.length) confidence += 0.1;

    return Math.min(confidence, 0.9);
  }

  /**
   * Analyze the error and code context
   */
  private async analyzeError(context: SuggestionContext): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    // Analyze different aspects
    results.push(...await this.analyzeImportErrors(context));
    results.push(...await this.analyzeTypeErrors(context));
    results.push(...await this.analyzeSyntaxErrors(context));
    results.push(...await this.analyzeVariableErrors(context));
    results.push(...await this.analyzeFunctionErrors(context));

    return results;
  }

  /**
   * Analyze import/module errors
   */
  private async analyzeImportErrors(context: SuggestionContext): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const message = context.error.message || '';

    // Check for missing module errors
    const moduleMatch = message.match(/Cannot find module ['"]([^'"]+)['"]/);
    if (moduleMatch) {
      const moduleName = moduleMatch[1];
      
      if (moduleName) {
        results.push({
          issue: 'missing-module',
          severity: 'error',
          suggestion: `Install missing module: ${moduleName}`,
          fixable: true,
          confidence: 0.9
        });

        // Check if it's a relative import issue
        if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
          results.push({
            issue: 'relative-import-path',
            severity: 'error',
            suggestion: `Check relative import path: ${moduleName}`,
            fixable: true,
            confidence: 0.8
          });
        }

        // Check if it's a Node.js built-in module
        const builtinModules = ['fs', 'path', 'http', 'https', 'crypto', 'url', 'os'];
        if (builtinModules.includes(moduleName)) {
          results.push({
            issue: 'builtin-module-import',
            severity: 'warning',
            suggestion: `Use Node.js built-in module correctly: node:${moduleName}`,
            fixable: true,
            confidence: 0.7
          });
        }
      }
    }

    // Check for ES module / CommonJS issues
    if (message.includes('require() of ES modules is not supported')) {
      results.push({
        issue: 'esm-commonjs-mismatch',
        severity: 'error',
        suggestion: 'Convert require() to import statement for ES modules',
        fixable: true,
        confidence: 0.9
      });
    }

    return results;
  }

  /**
   * Analyze TypeScript type errors
   */
  private async analyzeTypeErrors(context: SuggestionContext): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const message = context.error.message || '';

    // Property does not exist errors
    const propertyMatch = message.match(/Property ['"]([^'"]+)['"] does not exist on type ['"]([^'"]+)['"]/);
    if (propertyMatch) {
      const [, property, type] = propertyMatch;
      
      results.push({
        issue: 'property-not-exist',
        severity: 'error',
        suggestion: `Add property '${property}' to type '${type}' or use optional chaining`,
        fixable: true,
        confidence: 0.8
      });
    }

    // Type assignment errors
    const assignMatch = message.match(/Type ['"]([^'"]+)['"] is not assignable to type ['"]([^'"]+)['"]/);
    if (assignMatch) {
      const [, sourceType, targetType] = assignMatch;
      
      results.push({
        issue: 'type-assignment-error',
        severity: 'error',
        suggestion: `Convert type '${sourceType}' to '${targetType}' or update type definitions`,
        fixable: true,
        confidence: 0.7
      });
    }

    // Check for common TypeScript configuration issues
    if (message.includes('Cannot use import statement outside a module')) {
      results.push({
        issue: 'module-import-config',
        severity: 'error',
        suggestion: 'Configure TypeScript/Node.js for ES modules in package.json or tsconfig.json',
        fixable: true,
        confidence: 0.8
      });
    }

    return results;
  }

  /**
   * Analyze syntax errors
   */
  private async analyzeSyntaxErrors(context: SuggestionContext): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const message = context.error.message || '';

    // Unexpected token errors
    if (message.includes('Unexpected token')) {
      const tokenMatch = message.match(/Unexpected token (.+)/);
      if (tokenMatch) {
        const token = tokenMatch[1];
        
        results.push({
          issue: 'unexpected-token',
          severity: 'error',
          suggestion: `Fix syntax error around token: ${token}`,
          fixable: true,
          confidence: 0.6
        });

        // Specific token analysis
        if (token === '{') {
          results.push({
            issue: 'missing-closing-brace',
            severity: 'error',
            suggestion: 'Check for missing closing brace }',
            fixable: true,
            confidence: 0.7
          });
        } else if (token === ')') {
          results.push({
            issue: 'missing-opening-paren',
            severity: 'error',
            suggestion: 'Check for missing opening parenthesis (',
            fixable: true,
            confidence: 0.7
          });
        }
      }
    }

    // Missing semicolon
    if (message.includes('Unexpected end of input') || message.includes('Unexpected identifier')) {
      results.push({
        issue: 'missing-semicolon',
        severity: 'warning',
        suggestion: 'Check for missing semicolons',
        fixable: true,
        confidence: 0.5
      });
    }

    return results;
  }

  /**
   * Analyze variable-related errors
   */
  private async analyzeVariableErrors(context: SuggestionContext): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const message = context.error.message || '';

    // Reference errors
    const refMatch = message.match(/ReferenceError: ([^\s]+) is not defined/);
    if (refMatch) {
      const variable = refMatch[1];
      
      if (variable) {
        results.push({
          issue: 'undefined-variable',
          severity: 'error',
          suggestion: `Declare variable '${variable}' or check imports`,
          fixable: true,
          confidence: 0.8
        });

        // Check if it might be a typo
        if (this.isPossibleTypo(variable)) {
          results.push({
            issue: 'possible-typo',
            severity: 'warning',
            suggestion: `Check spelling of '${variable}' - might be a typo`,
            fixable: false,
            confidence: 0.6
          });
        }
      }
    }

    // Cannot read property errors
    const propMatch = message.match(/Cannot read propert(y|ies) ['"]([^'"]+)['"] of (null|undefined)/);
    if (propMatch) {
      const property = propMatch[2];
      
      results.push({
        issue: 'null-property-access',
        severity: 'error',
        suggestion: `Add null check before accessing property '${property}'`,
        fixable: true,
        confidence: 0.9
      });

      results.push({
        issue: 'optional-chaining',
        severity: 'info',
        suggestion: `Use optional chaining operator: ?.${property}`,
        fixable: true,
        confidence: 0.8
      });
    }

    return results;
  }

  /**
   * Analyze function-related errors
   */
  private async analyzeFunctionErrors(context: SuggestionContext): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const message = context.error.message || '';

    // Function not defined
    const funcMatch = message.match(/([^\s]+) is not a function/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      
      results.push({
        issue: 'not-a-function',
        severity: 'error',
        suggestion: `Check that '${funcName}' is properly defined as a function`,
        fixable: true,
        confidence: 0.8
      });

      // Check for async/await issues
      if (context.error.stack?.includes('await')) {
        results.push({
          issue: 'async-function-issue',
          severity: 'warning',
          suggestion: 'Check async/await usage and Promise handling',
          fixable: true,
          confidence: 0.6
        });
      }
    }

    // Wrong number of arguments
    if (message.includes('Expected') && message.includes('arguments')) {
      results.push({
        issue: 'wrong-argument-count',
        severity: 'error',
        suggestion: 'Check function call arguments count',
        fixable: true,
        confidence: 0.7
      });
    }

    return results;
  }

  /**
   * Create a suggestion from analysis result
   */
  private async createSuggestionFromAnalysis(
    result: AnalysisResult,
    context: SuggestionContext
  ): Promise<ResolutionSuggestion | null> {
    const suggestionId = `${result.issue}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const suggestion: ResolutionSuggestion = {
      id: suggestionId,
      title: this.getTitleForIssue(result.issue),
      description: result.suggestion,
      type: this.getTypeForIssue(result.issue),
      source: 'static-analysis',
      confidence: this.getConfidenceForResult(result),
      priority: this.getPriorityForSeverity(result.severity),
      relevanceScore: result.confidence,
      matchedPatterns: [result.issue],
      contextualFactors: this.extractContextualFactors(context, result),
      actions: this.getActionsForIssue(result.issue, context),
      evidence: {
        errorPatterns: [context.error.message || ''],
        contextClues: this.extractContextClues(context, result),
        similarCases: this.estimateSimilarCases(result.issue),
        successRate: this.getSuccessRateForIssue(result.issue)
      },
      tags: this.getTagsForIssue(result.issue),
      difficulty: this.getDifficultyForIssue(result.issue),
      estimatedTime: this.getEstimatedTimeForIssue(result.issue),
      resources: this.getResourcesForIssue(result.issue),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
      successCount: 0
    };

    return suggestion;
  }

  /**
   * Get title for issue type
   */
  private getTitleForIssue(issue: string): string {
    const titles: Record<string, string> = {
      'missing-module': 'Install Missing Module',
      'relative-import-path': 'Fix Relative Import Path',
      'builtin-module-import': 'Use Node.js Built-in Module',
      'esm-commonjs-mismatch': 'Fix ES Module Import',
      'property-not-exist': 'Add Missing Property',
      'type-assignment-error': 'Fix Type Assignment',
      'module-import-config': 'Configure Module System',
      'unexpected-token': 'Fix Syntax Error',
      'missing-closing-brace': 'Add Missing Closing Brace',
      'missing-opening-paren': 'Add Missing Opening Parenthesis',
      'missing-semicolon': 'Add Missing Semicolon',
      'undefined-variable': 'Declare Missing Variable',
      'possible-typo': 'Check Variable Spelling',
      'null-property-access': 'Add Null Check',
      'optional-chaining': 'Use Optional Chaining',
      'not-a-function': 'Fix Function Reference',
      'async-function-issue': 'Fix Async/Await Usage',
      'wrong-argument-count': 'Fix Function Arguments'
    };

    return titles[issue] || 'Fix Code Issue';
  }

  /**
   * Get suggestion type for issue
   */
  private getTypeForIssue(issue: string): SuggestionType {
    const codeFixIssues = [
      'esm-commonjs-mismatch', 'property-not-exist', 'type-assignment-error',
      'missing-closing-brace', 'missing-opening-paren', 'missing-semicolon',
      'null-property-access', 'optional-chaining'
    ];

    const dependencyIssues = ['missing-module', 'builtin-module-import'];
    const debuggingIssues = ['possible-typo', 'wrong-argument-count'];

    if (codeFixIssues.includes(issue)) return 'code-fix';
    if (dependencyIssues.includes(issue)) return 'dependency';
    if (debuggingIssues.includes(issue)) return 'debugging';
    
    return 'alternative-approach';
  }

  /**
   * Get confidence level for analysis result
   */
  private getConfidenceForResult(result: AnalysisResult): 'low' | 'medium' | 'high' | 'critical' {
    if (result.confidence >= 0.9) return 'critical';
    if (result.confidence >= 0.7) return 'high';
    if (result.confidence >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Get priority for severity level
   */
  private getPriorityForSeverity(severity: 'error' | 'warning' | 'info'): number {
    switch (severity) {
      case 'error': return 90;
      case 'warning': return 70;
      case 'info': return 50;
      default: return 50;
    }
  }

  /**
   * Extract contextual factors
   */
  private extractContextualFactors(context: SuggestionContext, result: AnalysisResult): string[] {
    const factors: string[] = [];

    factors.push(`Analysis confidence: ${(result.confidence * 100).toFixed(1)}%`);
    factors.push(`Issue type: ${result.issue}`);
    factors.push(`Severity: ${result.severity}`);

    if (result.line) factors.push(`Line: ${result.line}`);
    if (result.column) factors.push(`Column: ${result.column}`);
    if (result.fixable) factors.push('Automatically fixable');

    // Add context from error context
    if (context.codebase.currentFile) {
      factors.push(`File: ${context.codebase.currentFile}`);
    }

    return factors;
  }

  /**
   * Get actions for issue type
   */
  private getActionsForIssue(issue: string, _context: SuggestionContext) {
    // Return basic action structure - this would be expanded based on issue type
    const actions = [];

    switch (issue) {
      case 'missing-module':
        actions.push({
          type: 'command-run' as const,
          description: 'Install the missing module',
          command: 'npm install',
          automated: false,
          riskLevel: 'low' as const
        });
        break;
      case 'esm-commonjs-mismatch':
        actions.push({
          type: 'code-change' as const,
          description: 'Convert require() to import',
          automated: true,
          riskLevel: 'low' as const
        });
        break;
      default:
        actions.push({
          type: 'code-change' as const,
          description: 'Manual code fix required',
          automated: false,
          riskLevel: 'medium' as const
        });
    }

    return actions;
  }

  /**
   * Extract context clues
   */
  private extractContextClues(context: SuggestionContext, result: AnalysisResult): string[] {
    const clues: string[] = [];

    clues.push(`Static analysis detected: ${result.issue}`);
    
    if (context.error.stack) {
      clues.push(`Error stack available: ${context.error.stack.split('\n')[0]}`);
    }

    if (context.codebase.languages.length > 0) {
      clues.push(`Languages: ${context.codebase.languages.join(', ')}`);
    }

    return clues;
  }

  /**
   * Helper methods for suggestion metadata
   */
  private estimateSimilarCases(issue: string): number {
    const commonIssues: Record<string, number> = {
      'missing-module': 5000,
      'null-property-access': 3000,
      'undefined-variable': 2000,
      'esm-commonjs-mismatch': 1500,
      'property-not-exist': 1000,
      'unexpected-token': 800
    };

    return commonIssues[issue] || 100;
  }

  private getSuccessRateForIssue(issue: string): number {
    const successRates: Record<string, number> = {
      'missing-module': 0.95,
      'esm-commonjs-mismatch': 0.85,
      'null-property-access': 0.90,
      'undefined-variable': 0.80,
      'property-not-exist': 0.75
    };

    return successRates[issue] || 0.6;
  }

  private getTagsForIssue(issue: string): string[] {
    const tagMap: Record<string, string[]> = {
      'missing-module': ['dependency', 'npm', 'import'],
      'esm-commonjs-mismatch': ['modules', 'esm', 'commonjs'],
      'null-property-access': ['null-safety', 'runtime-error'],
      'undefined-variable': ['variables', 'scope', 'reference'],
      'property-not-exist': ['typescript', 'types', 'properties']
    };

    return tagMap[issue] || ['code-quality'];
  }

  private getDifficultyForIssue(issue: string): 'beginner' | 'intermediate' | 'advanced' {
    const beginnerIssues = ['missing-module', 'missing-semicolon', 'null-property-access'];
    const advancedIssues = ['type-assignment-error', 'async-function-issue'];

    if (beginnerIssues.includes(issue)) return 'beginner';
    if (advancedIssues.includes(issue)) return 'advanced';
    return 'intermediate';
  }

  private getEstimatedTimeForIssue(issue: string): string {
    const quickFixes = ['missing-semicolon', 'missing-closing-brace'];
    const mediumFixes = ['missing-module', 'null-property-access'];
    
    if (quickFixes.includes(issue)) return '1-2 minutes';
    if (mediumFixes.includes(issue)) return '2-5 minutes';
    return '5-15 minutes';
  }

  private getResourcesForIssue(_issue: string) {
    // Return relevant documentation links
    return [{
      type: 'documentation' as const,
      url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
      title: 'JavaScript Documentation'
    }];
  }

  /**
   * Check if a variable name might be a typo
   */
  private isPossibleTypo(variable: string): boolean {
    // Simple heuristics for common typos
    const commonVariables = ['console', 'window', 'document', 'process', 'Buffer', 'setTimeout'];
    
    for (const common of commonVariables) {
      if (this.calculateSimilarity(variable.toLowerCase(), common.toLowerCase()) > 0.7) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate string similarity
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1);
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = Array(str1.length + 1);
    }

    for (let i = 0; i <= str1.length; i++) {
      matrix[0]![i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j]![0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1,
          matrix[j - 1]![i]! + 1,
          matrix[j - 1]![i - 1]! + indicator
        );
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Convert confidence string to numeric value
   */
  private confidenceToNumber(confidence: string): number {
    switch (confidence) {
      case 'critical': return 1.0;
      case 'high': return 0.8;
      case 'medium': return 0.6;
      case 'low': return 0.4;
      default: return 0.5;
    }
  }
}