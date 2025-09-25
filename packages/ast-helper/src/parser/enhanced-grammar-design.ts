/**
 * Enhanced Grammar Management System Design
 *
 * This document outlines the design for enhanced grammar management
 * to support 15+ languages with tier-based loading and advanced features.
 */

/**
 * Language tiers for prioritized loading
 */
export enum LanguageTier {
  ENTERPRISE = 1, // High-priority enterprise languages
  DEVELOPER = 2, // Developer-focused languages
  SPECIALIZED = 3, // Emerging/specialized languages
}

/**
 * Enhanced grammar metadata structure
 */
export interface EnhancedGrammarMetadata {
  version: string;
  hash: string;
  url: string;
  tier: LanguageTier;
  downloadedAt: string;
  lastVerified: string;
  lastAccessed: string;
  size: number;
  integrity: "verified" | "pending" | "failed";
  source: "cdn" | "local" | "fallback";
  fallbackUrls?: string[];
}

/**
 * Progress reporting interface
 */
export interface DownloadProgress {
  language: string;
  loaded: number;
  total: number;
  percentage: number;
  stage: "downloading" | "verifying" | "caching" | "complete";
}

export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Enhanced grammar manager configuration
 */
export interface EnhancedGrammarConfig {
  cacheDir?: string;
  maxCacheSize?: number; // MB
  cacheExpiryDays?: number;
  maxRetries?: number;
  retryDelay?: number;
  downloadTimeout?: number; // ms
  enableProgressReporting?: boolean;
  fallbackUrls?: Record<string, string[]>;
  preferredSource?: "cdn" | "local";
}

/**
 * DESIGN OVERVIEW
 * ===============
 *
 * The Enhanced Grammar Management System provides:
 *
 * 1. TIER-BASED LOADING
 *    - Tier 1 (Enterprise): TypeScript, JavaScript, Python, Java, C#, Go
 *    - Tier 2 (Developer): Rust, C/C++, PHP, Ruby, Kotlin
 *    - Tier 3 (Specialized): Swift, Scala, Dart, Lua, Bash, R
 *
 * 2. ADVANCED CACHING
 *    - Metadata tracking with timestamps and verification status
 *    - Cache size limits with LRU eviction
 *    - Integrity validation with SHA256 hashes
 *    - Automatic cleanup and maintenance
 *
 * 3. PROGRESS REPORTING
 *    - Download progress for large grammars
 *    - Batch operation tracking
 *    - Stage-based progress updates
 *
 * 4. FALLBACK MECHANISMS
 *    - Multiple CDN sources per language
 *    - Local file support
 *    - Graceful error handling
 *
 * 5. PERFORMANCE FEATURES
 *    - Background preloading of common languages
 *    - Lazy loading for specialized languages
 *    - Efficient memory management
 *
 * IMPLEMENTATION APPROACH
 * =====================
 *
 * Rather than implementing the full enhanced system immediately, we will:
 *
 * 1. Extend the existing TreeSitterGrammarManager with tier awareness
 * 2. Add language tier mappings to the configuration system
 * 3. Implement basic progress reporting for downloads
 * 4. Add fallback URL support to language configurations
 * 5. Enhance caching with better metadata tracking
 *
 * This incremental approach ensures compatibility while adding the features
 * needed to support 15+ languages effectively.
 *
 * TIER MAPPINGS
 * =============
 */

export const LANGUAGE_TIER_MAPPINGS: Record<string, LanguageTier> = {
  // Tier 1: Enterprise Priority (preload these)
  typescript: LanguageTier.ENTERPRISE,
  javascript: LanguageTier.ENTERPRISE,
  python: LanguageTier.ENTERPRISE,
  java: LanguageTier.ENTERPRISE,
  csharp: LanguageTier.ENTERPRISE,
  go: LanguageTier.ENTERPRISE,

  // Tier 2: Developer Tools (load on demand)
  rust: LanguageTier.DEVELOPER,
  cpp: LanguageTier.DEVELOPER,
  c: LanguageTier.DEVELOPER,
  php: LanguageTier.DEVELOPER,
  ruby: LanguageTier.DEVELOPER,
  kotlin: LanguageTier.DEVELOPER,

  // Tier 3: Specialized (lazy load)
  swift: LanguageTier.SPECIALIZED,
  scala: LanguageTier.SPECIALIZED,
  dart: LanguageTier.SPECIALIZED,
  lua: LanguageTier.SPECIALIZED,
  bash: LanguageTier.SPECIALIZED,
  r: LanguageTier.SPECIALIZED,
};

/**
 * Get the tier for a language
 */
export function getLanguageTier(language: string): LanguageTier {
  return LANGUAGE_TIER_MAPPINGS[language] || LanguageTier.SPECIALIZED;
}

/**
 * Get all languages in a specific tier
 */
export function getLanguagesByTier(tier: LanguageTier): string[] {
  return Object.entries(LANGUAGE_TIER_MAPPINGS)
    .filter(([, langTier]) => langTier === tier)
    .map(([language]) => language);
}

/**
 * Enhanced grammar metadata utilities
 */
export class GrammarMetadataUtils {
  /**
   * Create default metadata for a language
   */
  static createDefaultMetadata(
    language: string,
    url: string,
  ): EnhancedGrammarMetadata {
    return {
      version: "unknown",
      hash: "",
      url,
      tier: getLanguageTier(language),
      downloadedAt: "",
      lastVerified: "",
      lastAccessed: "",
      size: 0,
      integrity: "pending",
      source: "cdn",
    };
  }

  /**
   * Check if metadata indicates a valid grammar
   */
  static isValidMetadata(metadata: EnhancedGrammarMetadata): boolean {
    return (
      metadata.integrity === "verified" &&
      metadata.hash.length > 0 &&
      metadata.size > 0
    );
  }

  /**
   * Check if metadata is expired
   */
  static isExpired(
    metadata: EnhancedGrammarMetadata,
    maxAgeDays: number,
  ): boolean {
    if (!metadata.downloadedAt) {
      return true;
    }

    const downloadDate = new Date(metadata.downloadedAt);
    const ageInDays =
      (Date.now() - downloadDate.getTime()) / (1000 * 60 * 60 * 24);
    return ageInDays > maxAgeDays;
  }
}

/**
 * ENHANCEMENT STRATEGY FOR EXISTING GRAMMAR MANAGER
 * ================================================
 *
 * Instead of creating a completely new system, we will enhance the existing
 * TreeSitterGrammarManager with the following incremental improvements:
 *
 * 1. ADD TIER AWARENESS
 *    - Extend LanguageConfig with optional tier property
 *    - Add tier-based loading priorities
 *    - Implement preloading for Tier 1 languages
 *
 * 2. ENHANCE METADATA TRACKING
 *    - Extend existing metadata.json with new fields
 *    - Add integrity verification timestamps
 *    - Track access patterns for cache management
 *
 * 3. IMPROVE CACHING STRATEGY
 *    - Add cache size limits and LRU eviction
 *    - Implement automatic cleanup of old grammars
 *    - Add cache validation on startup
 *
 * 4. ADD PROGRESS REPORTING
 *    - Extend download methods with progress callbacks
 *    - Add batch operation progress tracking
 *    - Implement stage-based progress updates
 *
 * 5. IMPLEMENT FALLBACK SUPPORT
 *    - Add fallback URL arrays to language configs
 *    - Implement retry logic with multiple sources
 *    - Add graceful degradation on failures
 *
 * These enhancements will be implemented incrementally in subsequent subtasks,
 * ensuring backward compatibility while adding the advanced features needed
 * for 15+ language support.
 */
