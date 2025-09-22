/**
 * Pattern-based suggestion generator for common error patterns
 */

import {
  SuggestionGenerator,
  SuggestionSource,
  SuggestionContext,
  ResolutionSuggestion,
  ErrorPattern,
  SuggestionType
} from './types.js';

/**
 * Built-in error patterns and their suggested resolutions
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  // Module/Import Errors
  {
    id: 'module-not-found',
    pattern: /Cannot find module ['"]([^'"]+)['"]/,
    type: 'regex',
    scope: 'message',
    weight: 0.9,
    category: 'dependency-error',
    tags: ['import', 'module', 'dependency'],
    associatedSuggestions: ['install-missing-module', 'check-module-path', 'update-imports'],
    lastUpdated: new Date().toISOString(),
    matchCount: 0,
    successRate: 0.85
  },
  {
    id: 'es-module-import',
    pattern: /require\(\) of ES modules is not supported/,
    type: 'regex',
    scope: 'message',
    weight: 0.8,
    category: 'module-system-error',
    tags: ['esm', 'commonjs', 'import'],
    associatedSuggestions: ['convert-to-import', 'add-type-module', 'use-dynamic-import'],
    lastUpdated: new Date().toISOString(),
    matchCount: 0,
    successRate: 0.75
  },
  
  // TypeScript Errors
  {
    id: 'ts-property-not-exist',
    pattern: /Property ['"]([^'"]+)['"] does not exist on type/,
    type: 'regex',
    scope: 'message',
    weight: 0.8,
    category: 'typescript-error',
    tags: ['typescript', 'property', 'type'],
    associatedSuggestions: ['add-property-to-interface', 'use-optional-chaining', 'type-assertion'],
    lastUpdated: new Date().toISOString(),
    matchCount: 0,
    successRate: 0.7
  },
  {
    id: 'ts-cannot-assign',
    pattern: /Type ['"]([^'"]+)['"] is not assignable to type ['"]([^'"]+)['"]/,
    type: 'regex',
    scope: 'message',
    weight: 0.8,
    category: 'typescript-error',
    tags: ['typescript', 'assignment', 'type'],
    associatedSuggestions: ['fix-type-mismatch', 'add-type-assertion', 'update-interface'],
    lastUpdated: new Date().toISOString(),
    matchCount: 0,
    successRate: 0.8
  },
  
  // Syntax Errors
  {
    id: 'unexpected-token',
    pattern: /Unexpected token/,
    type: 'substring',
    scope: 'message',
    weight: 0.7,
    category: 'syntax-error',
    tags: ['syntax', 'parsing'],
    associatedSuggestions: ['check-syntax', 'check-brackets', 'check-semicolons'],
    lastUpdated: new Date().toISOString(),
    matchCount: 0,
    successRate: 0.6
  },
  
  // Runtime Errors
  {
    id: 'undefined-variable',
    pattern: /ReferenceError: ([^\s]+) is not defined/,
    type: 'regex',
    scope: 'message',
    weight: 0.8,
    category: 'reference-error',
    tags: ['variable', 'undefined', 'reference'],
    associatedSuggestions: ['declare-variable', 'check-imports', 'check-scope'],
    lastUpdated: new Date().toISOString(),
    matchCount: 0,
    successRate: 0.9
  },
  {
    id: 'cannot-read-property',
    pattern: /Cannot read propert(y|ies) ['"]([^'"]+)['"] of (null|undefined)/,
    type: 'regex',
    scope: 'message',
    weight: 0.9,
    category: 'null-reference-error',
    tags: ['null', 'undefined', 'property'],
    associatedSuggestions: ['add-null-check', 'use-optional-chaining', 'initialize-variable'],
    lastUpdated: new Date().toISOString(),
    matchCount: 0,
    successRate: 0.85
  },
  
  // File System Errors
  {
    id: 'enoent-file',
    pattern: /ENOENT: no such file or directory/,
    type: 'substring',
    scope: 'message',
    weight: 0.8,
    category: 'file-error',
    tags: ['file', 'path', 'filesystem'],
    associatedSuggestions: ['check-file-path', 'create-missing-file', 'check-permissions'],
    lastUpdated: new Date().toISOString(),
    matchCount: 0,
    successRate: 0.8
  },
  
  // Network Errors
  {
    id: 'econnrefused',
    pattern: /ECONNREFUSED/,
    type: 'substring',
    scope: 'message',
    weight: 0.8,
    category: 'network-error',
    tags: ['network', 'connection', 'server'],
    associatedSuggestions: ['check-server-running', 'check-port', 'check-firewall'],
    lastUpdated: new Date().toISOString(),
    matchCount: 0,
    successRate: 0.7
  },
  
  // Configuration Errors
  {
    id: 'invalid-json',
    pattern: /Unexpected token .* in JSON/,
    type: 'regex',
    scope: 'message',
    weight: 0.9,
    category: 'config-error',
    tags: ['json', 'configuration', 'parsing'],
    associatedSuggestions: ['validate-json', 'check-json-syntax', 'use-json-validator'],
    lastUpdated: new Date().toISOString(),
    matchCount: 0,
    successRate: 0.9
  }
];

/**
 * Pattern-based suggestion generator that matches errors against known patterns
 * and provides contextual resolution suggestions
 */
export class PatternBasedSuggestionGenerator implements SuggestionGenerator {
  readonly name = 'pattern-based';
  readonly source: SuggestionSource = 'pattern-matching';
  readonly priority = 10;
  readonly supportedTypes = ['*']; // Supports all error types

  private patterns: ErrorPattern[] = [...ERROR_PATTERNS];
  private suggestionTemplates: Map<string, ResolutionSuggestion> = new Map();

  constructor() {
    this.initializeSuggestionTemplates();
  }

  /**
   * Initialize built-in suggestion templates
   */
  private initializeSuggestionTemplates() {
    const templates: ResolutionSuggestion[] = [
      // Module/Import Solutions
      {
        id: 'install-missing-module',
        title: 'Install Missing Module',
        description: 'Install the missing npm package that your code is trying to import.',
        type: 'dependency',
        source: 'pattern-matching',
        confidence: 'high',
        priority: 90,
        relevanceScore: 0.9,
        matchedPatterns: ['module-not-found'],
        contextualFactors: ['package.json exists', 'npm project'],
        actions: [
          {
            type: 'command-run',
            description: 'Install the missing package using npm',
            command: 'npm install {{moduleName}}',
            automated: false,
            riskLevel: 'low'
          }
        ],
        evidence: {
          errorPatterns: ['Cannot find module'],
          contextClues: ['import statement', 'require call'],
          similarCases: 1000,
          successRate: 0.9
        },
        tags: ['dependency', 'npm', 'install'],
        difficulty: 'beginner',
        estimatedTime: '1-2 minutes',
        resources: [
          {
            type: 'documentation',
            url: 'https://docs.npmjs.com/cli/v8/commands/npm-install',
            title: 'npm install documentation'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        successCount: 0
      },
      
      {
        id: 'convert-to-import',
        title: 'Convert require() to import',
        description: 'Convert CommonJS require() statements to ES module import statements.',
        type: 'code-fix',
        source: 'pattern-matching',
        confidence: 'medium',
        priority: 70,
        relevanceScore: 0.8,
        matchedPatterns: ['es-module-import'],
        contextualFactors: ['ES modules used', 'type: module in package.json'],
        actions: [
          {
            type: 'code-change',
            description: 'Replace require() with import statement',
            automated: true,
            riskLevel: 'low'
          }
        ],
        evidence: {
          errorPatterns: ['require() of ES modules is not supported'],
          contextClues: ['type: module', 'import statements present'],
          similarCases: 500,
          successRate: 0.75
        },
        tags: ['esm', 'commonjs', 'conversion'],
        difficulty: 'intermediate',
        estimatedTime: '2-5 minutes',
        resources: [
          {
            type: 'tutorial',
            url: 'https://nodejs.org/api/esm.html',
            title: 'Node.js ES Modules'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        successCount: 0
      },

      {
        id: 'add-null-check',
        title: 'Add Null/Undefined Check',
        description: 'Add a safety check to prevent accessing properties of null or undefined values.',
        type: 'code-fix',
        source: 'pattern-matching',
        confidence: 'high',
        priority: 85,
        relevanceScore: 0.9,
        matchedPatterns: ['cannot-read-property'],
        contextualFactors: ['property access', 'null/undefined value'],
        actions: [
          {
            type: 'code-change',
            description: 'Add null/undefined check before property access',
            automated: true,
            riskLevel: 'low'
          }
        ],
        prerequisites: ['Identify the variable that could be null/undefined'],
        evidence: {
          errorPatterns: ['Cannot read property', 'of null', 'of undefined'],
          contextClues: ['property access', 'object reference'],
          similarCases: 2000,
          successRate: 0.85
        },
        tags: ['null-check', 'defensive-coding', 'safety'],
        difficulty: 'beginner',
        estimatedTime: '1-3 minutes',
        resources: [
          {
            type: 'documentation',
            url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining',
            title: 'Optional chaining (?.) - MDN'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        successCount: 0
      },

      {
        id: 'check-file-path',
        title: 'Verify File Path',
        description: 'Check if the file path is correct and the file exists at the specified location.',
        type: 'debugging',
        source: 'pattern-matching',
        confidence: 'medium',
        priority: 75,
        relevanceScore: 0.8,
        matchedPatterns: ['enoent-file'],
        contextualFactors: ['file operation', 'path reference'],
        actions: [
          {
            type: 'command-run',
            description: 'Check if file exists',
            command: 'ls -la {{filePath}}',
            automated: false,
            riskLevel: 'low'
          }
        ],
        evidence: {
          errorPatterns: ['ENOENT', 'no such file or directory'],
          contextClues: ['file system operation', 'path string'],
          similarCases: 800,
          successRate: 0.8
        },
        tags: ['filesystem', 'path', 'debugging'],
        difficulty: 'beginner',
        estimatedTime: '2-5 minutes',
        resources: [
          {
            type: 'documentation',
            url: 'https://nodejs.org/api/fs.html',
            title: 'Node.js File System'
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        successCount: 0
      }
    ];

    templates.forEach(template => {
      this.suggestionTemplates.set(template.id, template);
    });
  }

  /**
   * Check if this generator can handle the given context
   */
  async canHandle(context: SuggestionContext): Promise<boolean> {
    // Pattern-based generator can handle any error with a message
    return !!context.error.message;
  }

  /**
   * Generate suggestions for the given context
   */
  async generateSuggestions(context: SuggestionContext): Promise<ResolutionSuggestion[]> {
    const matchedPatterns = await this.findMatchingPatterns(context);
    const suggestions: ResolutionSuggestion[] = [];

    for (const patternMatch of matchedPatterns) {
      const patternSuggestions = await this.generateSuggestionsForPattern(
        patternMatch.pattern,
        patternMatch.matches,
        context
      );
      suggestions.push(...patternSuggestions);
    }

    // Sort by relevance and confidence
    return suggestions.sort((a, b) => {
      const scoreA = a.relevanceScore * this.confidenceToNumber(a.confidence);
      const scoreB = b.relevanceScore * this.confidenceToNumber(b.confidence);
      return scoreB - scoreA;
    });
  }

  /**
   * Get confidence score for the given context
   */
  async getConfidenceScore(context: SuggestionContext): Promise<number> {
    const matchedPatterns = await this.findMatchingPatterns(context);
    if (matchedPatterns.length === 0) return 0;

    const maxWeight = Math.max(...matchedPatterns.map(m => m.pattern.weight));
    return maxWeight;
  }

  /**
   * Find patterns that match the error context
   */
  private async findMatchingPatterns(context: SuggestionContext): Promise<Array<{
    pattern: ErrorPattern;
    matches: RegExpMatchArray | null;
    score: number;
  }>> {
    const matches: Array<{
      pattern: ErrorPattern;
      matches: RegExpMatchArray | null;
      score: number;
    }> = [];

    for (const pattern of this.patterns) {
      const matchResult = this.matchPattern(pattern, context);
      if (matchResult.matches) {
        matches.push({
          pattern,
          matches: matchResult.matches,
          score: matchResult.score
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Match a single pattern against the error context
   */
  private matchPattern(pattern: ErrorPattern, context: SuggestionContext): {
    matches: RegExpMatchArray | null;
    score: number;
  } {
    const targetText = this.getTargetText(pattern.scope, context);
    let matches: RegExpMatchArray | null = null;
    let score = 0;

    switch (pattern.type) {
      case 'regex':
        if (pattern.pattern instanceof RegExp) {
          matches = targetText.match(pattern.pattern);
        } else {
          matches = targetText.match(new RegExp(pattern.pattern));
        }
        break;
        
      case 'substring':
        if (targetText.includes(pattern.pattern.toString())) {
          matches = [targetText] as RegExpMatchArray;
        }
        break;
        
      case 'exact':
        if (targetText === pattern.pattern.toString()) {
          matches = [targetText] as RegExpMatchArray;
        }
        break;
        
      case 'fuzzy':
        const similarity = this.calculateSimilarity(targetText, pattern.pattern.toString());
        if (similarity > 0.7) {
          matches = [targetText] as RegExpMatchArray;
          score = similarity;
        }
        break;
    }

    if (matches) {
      score = score || pattern.weight;
      
      // Boost score based on context relevance
      score *= this.calculateContextRelevance(pattern, context);
    }

    return { matches, score };
  }

  /**
   * Get target text based on pattern scope
   */
  private getTargetText(scope: string, context: SuggestionContext): string {
    switch (scope) {
      case 'message':
        return context.error.message || '';
      case 'stack':
        return context.error.stack || '';
      case 'code':
        return context.error.code || '';
      case 'all':
        return `${context.error.message} ${context.error.stack} ${context.error.code}`;
      default:
        return context.error.message || '';
    }
  }

  /**
   * Calculate context relevance for pattern matching
   */
  private calculateContextRelevance(pattern: ErrorPattern, context: SuggestionContext): number {
    let relevance = 1.0;

    // Check if pattern tags match context
    const contextFactors = [
      ...context.codebase.languages.map(lang => lang.toLowerCase()),
      ...(context.codebase.frameworks || []).map(fw => fw.toLowerCase()),
      ...(context.environment.configFiles || []).map(file => 
        file.split('.').pop()?.toLowerCase() || ''
      )
    ];

    const matchingTags = pattern.tags.filter(tag => 
      contextFactors.includes(tag.toLowerCase())
    );

    if (matchingTags.length > 0) {
      relevance += 0.2 * matchingTags.length;
    }

    // Boost for recent similar errors
    if (context.history.similarErrors > 0) {
      relevance += Math.min(0.3, context.history.similarErrors * 0.1);
    }

    return Math.min(relevance, 2.0);
  }

  /**
   * Calculate string similarity for fuzzy matching
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1);
    
    // Initialize matrix
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
          matrix[j]![i - 1]! + 1, // deletion
          matrix[j - 1]![i]! + 1, // insertion
          matrix[j - 1]![i - 1]! + indicator // substitution
        );
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Generate suggestions for a matched pattern
   */
  private async generateSuggestionsForPattern(
    pattern: ErrorPattern,
    matches: RegExpMatchArray | null,
    context: SuggestionContext
  ): Promise<ResolutionSuggestion[]> {
    const suggestions: ResolutionSuggestion[] = [];

    for (const suggestionId of pattern.associatedSuggestions) {
      const template = this.suggestionTemplates.get(suggestionId);
      if (template) {
        const customizedSuggestion = await this.customizeSuggestion(
          template,
          pattern,
          matches,
          context
        );
        suggestions.push(customizedSuggestion);
      }
    }

    return suggestions;
  }

  /**
   * Customize a suggestion template based on the specific error context
   */
  private async customizeSuggestion(
    template: ResolutionSuggestion,
    pattern: ErrorPattern,
    matches: RegExpMatchArray | null,
    context: SuggestionContext
  ): Promise<ResolutionSuggestion> {
    const customized: ResolutionSuggestion = {
      ...template,
      id: `${template.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      relevanceScore: pattern.weight * this.calculateContextRelevance(pattern, context),
      matchedPatterns: [pattern.id],
      contextualFactors: this.extractContextualFactors(context)
    };

    // Customize actions with extracted data
    customized.actions = template.actions.map(action => ({
      ...action,
      command: this.interpolateCommand(action.command || '', matches, context),
      content: this.interpolateContent(action.content || '', matches, context)
    }));

    // Adjust confidence based on context
    customized.confidence = this.adjustConfidence(template.confidence, pattern, context);

    // Update evidence with pattern-specific information
    customized.evidence = {
      ...template.evidence,
      errorPatterns: [pattern.pattern.toString()],
      contextClues: this.extractContextClues(matches, context),
      successRate: pattern.successRate
    };

    return customized;
  }

  /**
   * Interpolate variables in command strings
   */
  private interpolateCommand(command: string, matches: RegExpMatchArray | null, context: SuggestionContext): string {
    let interpolated = command;

    // Replace common placeholders
    if (matches && matches[1]) {
      interpolated = interpolated.replace(/\{\{moduleName\}\}/g, matches[1]);
      interpolated = interpolated.replace(/\{\{variableName\}\}/g, matches[1]);
      interpolated = interpolated.replace(/\{\{fileName\}\}/g, matches[1]);
    }

    // Replace with context-specific values
    interpolated = interpolated.replace(/\{\{nodeVersion\}\}/g, context.environment.nodeVersion);
    interpolated = interpolated.replace(/\{\{platform\}\}/g, context.environment.platform);

    return interpolated;
  }

  /**
   * Interpolate variables in content strings
   */
  private interpolateContent(content: string, matches: RegExpMatchArray | null, context: SuggestionContext): string {
    return this.interpolateCommand(content, matches, context);
  }

  /**
   * Extract contextual factors from the error context
   */
  private extractContextualFactors(context: SuggestionContext): string[] {
    const factors: string[] = [];

    factors.push(`Node.js ${context.environment.nodeVersion}`);
    factors.push(`Platform: ${context.environment.platform}`);
    
    if (context.environment.projectType) {
      factors.push(`Project type: ${context.environment.projectType}`);
    }

    if (context.codebase.languages.length > 0) {
      factors.push(`Languages: ${context.codebase.languages.join(', ')}`);
    }

    if (context.codebase.frameworks && context.codebase.frameworks.length > 0) {
      factors.push(`Frameworks: ${context.codebase.frameworks.join(', ')}`);
    }

    if (context.history.similarErrors > 0) {
      factors.push(`Similar errors: ${context.history.similarErrors}`);
    }

    return factors;
  }

  /**
   * Extract context clues from matches and context
   */
  private extractContextClues(matches: RegExpMatchArray | null, context: SuggestionContext): string[] {
    const clues: string[] = [];

    if (matches) {
      clues.push(`Matched pattern: ${matches[0]}`);
      if (matches[1]) {
        clues.push(`Extracted value: ${matches[1]}`);
      }
    }

    if (context.error.operation) {
      clues.push(`Operation: ${context.error.operation}`);
    }

    if (context.codebase.recentChanges && context.codebase.recentChanges.length > 0) {
      clues.push(`Recent changes: ${context.codebase.recentChanges.length} files`);
    }

    return clues;
  }

  /**
   * Adjust confidence based on pattern and context
   */
  private adjustConfidence(
    baseConfidence: string,
    pattern: ErrorPattern,
    context: SuggestionContext
  ): SuggestionType extends 'code-fix' ? 'high' : 'medium' {
    let confidence = baseConfidence;

    // Increase confidence for patterns with high success rate
    if (pattern.successRate > 0.8 && confidence === 'medium') {
      confidence = 'high';
    }

    // Decrease confidence for patterns with low match count (less tested)
    if (pattern.matchCount < 10 && confidence === 'high') {
      confidence = 'medium';
    }

    // Adjust based on user experience
    if (context.user.experienceLevel === 'beginner' && confidence === 'critical') {
      confidence = 'high';
    }

    return confidence as SuggestionType extends 'code-fix' ? 'high' : 'medium';
  }

  /**
   * Convert confidence string to numeric value for sorting
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

  /**
   * Add new error pattern
   */
  addPattern(pattern: ErrorPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Add new suggestion template
   */
  addSuggestionTemplate(suggestion: ResolutionSuggestion): void {
    this.suggestionTemplates.set(suggestion.id, suggestion);
  }

  /**
   * Update pattern statistics
   */
  updatePatternStats(patternId: string, success: boolean): void {
    const pattern = this.patterns.find(p => p.id === patternId);
    if (pattern) {
      pattern.matchCount++;
      if (success) {
        pattern.successRate = (pattern.successRate + 1) / 2; // Simple moving average
      }
      pattern.lastUpdated = new Date().toISOString();
    }
  }

  /**
   * Get pattern statistics
   */
  getPatternStats(): Array<{ id: string; matchCount: number; successRate: number; lastUpdated: string }> {
    return this.patterns.map(p => ({
      id: p.id,
      matchCount: p.matchCount,
      successRate: p.successRate,
      lastUpdated: p.lastUpdated
    }));
  }
}