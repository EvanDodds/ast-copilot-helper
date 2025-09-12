/**
 * Glob pattern matching manager
 * Provides high-performance glob pattern matching with caching and optimization
 */

import { join, resolve, relative } from 'node:path';
import { readdir, stat } from 'node:fs/promises';
import type {
  GlobMatcher,
  GlobOptions,
  GlobResult,
  CompiledPattern,
  GlobStats
} from './types.js';

/**
 * Simple minimatch-style pattern matcher
 * Implements basic glob patterns without external dependencies
 */
class PatternMatcher {
  private pattern: string;
  private isNegated: boolean;
  private caseSensitive: boolean;
  private regex: RegExp;
  
  constructor(pattern: string, caseSensitive: boolean = process.platform !== 'win32') {
    this.isNegated = pattern.startsWith('!');
    this.pattern = this.isNegated ? pattern.slice(1) : pattern;
    this.caseSensitive = caseSensitive;
    this.regex = this.patternToRegex(this.pattern);
  }
  
  match(path: string): boolean {
    const normalizedPath = path.replace(/\\/g, '/');
    return this.regex.test(normalizedPath);
  }
  
  private patternToRegex(pattern: string): RegExp {
    // Normalize the pattern to use forward slashes
    let regexPattern = pattern.replace(/\\/g, '/');
    
    // Handle brace expansion {a,b,c} BEFORE escaping regex characters
    regexPattern = regexPattern.replace(/\{([^}]+)\}/g, (_, options) => {
      return '(' + options.split(',').join('|') + ')';
    });
    
    // Escape special regex characters except glob characters and parentheses/pipes from brace expansion
    regexPattern = regexPattern
      .replace(/[.+^${}[\]]/g, '\\$&');
    
    // Handle glob patterns
    regexPattern = regexPattern
      .replace(/\*\*/g, '<<<GLOBSTAR>>>') // Placeholder for **
      .replace(/\*/g, '[^/]*') // * matches anything except directory separator
      .replace(/\?/g, '[^/]') // ? matches single character except directory separator
      .replace(/<<<GLOBSTAR>>>/g, '.*'); // ** matches any number of directories
    
    const flags = this.caseSensitive ? '' : 'i';
    return new RegExp(`^${regexPattern}$`, flags);
  }
  
  get negated(): boolean {
    return this.isNegated;
  }
  
  get originalPattern(): string {
    return this.isNegated ? `!${this.pattern}` : this.pattern;
  }
}

/**
 * Glob manager implementation with performance optimization
 */
export class GlobManager implements GlobMatcher {
  private options: GlobOptions;
  private patternCache = new Map<string, PatternMatcher>();
  private pathCache = new Map<string, boolean>();
  private stats: GlobStats = {
    patternsProcessed: 0,
    filesMatched: 0,
    directoriesScanned: 0,
    totalDuration: 0,
    avgTimePerPattern: 0,
    cacheHitRatio: 0
  };
  
  constructor(options: GlobOptions = {}) {
    this.options = {
      caseSensitive: process.platform !== 'win32',
      followSymlinks: false,
      ignorePatterns: [],
      maxDepth: Infinity,
      includeDirs: false,
      includeHidden: false,
      ...options
    };
  }
  
  /**
   * Test if file path matches any patterns
   */
  match(patterns: string[], filePath: string): boolean {
    const cacheKey = `${patterns.join('|')}::${filePath}`;
    
    if (this.pathCache.has(cacheKey)) {
      return this.pathCache.get(cacheKey)!;
    }
    
    const compiledPatterns = patterns.map(p => this.getCompiledPattern(p));
    const normalizedPath = this.normalizePath(filePath);
    
    let hasPositiveMatch = false;
    let hasNegativeMatch = false;
    
    // First, check for positive matches
    for (const compiled of compiledPatterns) {
      if (!compiled.isNegated) {
        const matcher = this.getPatternMatcher(compiled.normalizedPattern);
        if (matcher.match(normalizedPath)) {
          hasPositiveMatch = true;
          break;
        }
      }
    }
    
    // If no positive patterns at all, default to match (like "!" patterns only)
    const hasPositivePatterns = compiledPatterns.some(p => !p.isNegated);
    if (!hasPositivePatterns) {
      hasPositiveMatch = true;
    }
    
    // Then check for negative matches (exclusions)
    if (hasPositiveMatch) {
      for (const compiled of compiledPatterns) {
        if (compiled.isNegated) {
          const matcher = this.getPatternMatcher(compiled.normalizedPattern);
          if (matcher.match(normalizedPath)) {
            hasNegativeMatch = true;
            break;
          }
        }
      }
    }
    
    const result = hasPositiveMatch && !hasNegativeMatch;
    this.pathCache.set(cacheKey, result);
    return result;
  }
  
  /**
   * Expand glob patterns to actual file paths
   */
  async expandPatterns(patterns: string[], basePath?: string): Promise<GlobResult> {
    const startTime = Date.now();
    const resolvedBasePath = resolve(basePath || this.options.baseDirectory || process.cwd());
    
    const result: GlobResult = {
      files: [],
      matchedPatterns: [],
      unmatchedPatterns: [],
      duration: 0,
      directoriesScanned: 0,
      filesExamined: 0
    };
    
    if (patterns.length === 0) {
      result.duration = Date.now() - startTime;
      return result;
    }
    
    const allFiles = await this.scanDirectory(resolvedBasePath, result);
    
    // Apply patterns to found files
    for (const filePath of allFiles) {
      const relativePath = this.normalizePath(relative(resolvedBasePath, filePath));
      result.filesExamined++;
      
      if (this.match(patterns, relativePath)) {
        result.files.push(relativePath);
        
        // Track which patterns matched
        for (const pattern of patterns) {
          if (this.match([pattern], relativePath) && !result.matchedPatterns.includes(pattern)) {
            result.matchedPatterns.push(pattern);
          }
        }
      }
    }
    
    // Find unmatched patterns
    result.unmatchedPatterns = patterns.filter(p => !result.matchedPatterns.includes(p));
    
    result.duration = Date.now() - startTime;
    this.updateStats(result);
    
    return result;
  }
  
  /**
   * Recursively scan directory for files
   */
  private async scanDirectory(dirPath: string, stats: GlobResult, depth: number = 0): Promise<string[]> {
    const files: string[] = [];
    
    if (depth > (this.options.maxDepth || Infinity)) {
      return files;
    }
    
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      stats.directoriesScanned++;
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        
        // Skip hidden files unless included
        if (!this.options.includeHidden && entry.name.startsWith('.')) {
          continue;
        }
        
        if (entry.isDirectory()) {
          if (this.options.includeDirs) {
            files.push(fullPath);
          }
          
          // Recurse into subdirectory
          const subFiles = await this.scanDirectory(fullPath, stats, depth + 1);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(fullPath);
        } else if (entry.isSymbolicLink() && this.options.followSymlinks) {
          try {
            const linkStats = await stat(fullPath);
            if (linkStats.isFile()) {
              files.push(fullPath);
            } else if (linkStats.isDirectory()) {
              if (this.options.includeDirs) {
                files.push(fullPath);
              }
              const subFiles = await this.scanDirectory(fullPath, stats, depth + 1);
              files.push(...subFiles);
            }
          } catch {
            // Broken symlink, skip
          }
        }
      }
    } catch (error: any) {
      // Skip directories we can't read (permission issues, etc.)
      if (error.code !== 'EACCES' && error.code !== 'EPERM') {
        throw error;
      }
    }
    
    return files;
  }
  
  /**
   * Check if pattern is valid
   */
  isValidPattern(pattern: string): boolean {
    try {
      this.getPatternMatcher(pattern);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Compile pattern for optimization
   */
  compilePattern(pattern: string): CompiledPattern {
    const isNegated = pattern.startsWith('!');
    const normalizedPattern = isNegated ? pattern.slice(1) : pattern;
    
    return {
      pattern,
      isNegated,
      normalizedPattern,
      isGlobStar: normalizedPattern.includes('**'),
      baseDir: this.extractBaseDir(normalizedPattern),
      parts: normalizedPattern.split('/')
    };
  }
  
  /**
   * Match against compiled pattern
   */
  matchPattern(compiledPattern: CompiledPattern, filePath: string): boolean {
    const matcher = this.getPatternMatcher(compiledPattern.normalizedPattern);
    return matcher.match(this.normalizePath(filePath));
  }
  
  /**
   * Get current options
   */
  getOptions(): GlobOptions {
    return { ...this.options };
  }
  
  /**
   * Create new matcher with different options
   */
  withOptions(options: Partial<GlobOptions>): GlobMatcher {
    return new GlobManager({ ...this.options, ...options });
  }
  
  /**
   * Get performance statistics
   */
  getStats(): GlobStats {
    return { ...this.stats };
  }
  
  /**
   * Reset performance statistics
   */
  resetStats(): void {
    this.stats = {
      patternsProcessed: 0,
      filesMatched: 0,
      directoriesScanned: 0,
      totalDuration: 0,
      avgTimePerPattern: 0,
      cacheHitRatio: 0
    };
  }
  
  /**
   * Clear internal caches
   */
  clearCache(): void {
    this.patternCache.clear();
    this.pathCache.clear();
  }
  
  // Private helper methods
  
  private getCompiledPattern(pattern: string): CompiledPattern {
    return this.compilePattern(pattern);
  }
  
  private getPatternMatcher(pattern: string): PatternMatcher {
    if (!this.patternCache.has(pattern)) {
      this.patternCache.set(pattern, new PatternMatcher(pattern, this.options.caseSensitive));
    }
    return this.patternCache.get(pattern)!;
  }
  
  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/');
  }
  
  private extractBaseDir(pattern: string): string {
    const parts = pattern.split('/');
    const baseDir = [];
    
    for (const part of parts) {
      if (part.includes('*') || part.includes('?') || part.includes('[')) {
        break;
      }
      baseDir.push(part);
    }
    
    return baseDir.join('/') || '.';
  }
  
  private updateStats(result: GlobResult): void {
    this.stats.patternsProcessed++;
    this.stats.filesMatched += result.files.length;
    this.stats.directoriesScanned += result.directoriesScanned;
    this.stats.totalDuration += result.duration;
    this.stats.avgTimePerPattern = this.stats.totalDuration / this.stats.patternsProcessed;
    
    const totalCacheAccess = this.patternCache.size + this.pathCache.size;
    const cacheHits = this.pathCache.size; // Simplified calculation
    this.stats.cacheHitRatio = totalCacheAccess > 0 ? cacheHits / totalCacheAccess : 0;
  }
}