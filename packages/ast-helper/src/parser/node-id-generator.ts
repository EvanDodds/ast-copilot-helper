/**
 * Node ID Generation System
 * 
 * Provides deterministic, stable node ID generation using SHA-256 hashing
 * with collision detection and performance optimizations for large-scale processing.
 */

import { createHash } from 'crypto';
import { Position, NodeType, AST_CONFIG } from './ast-schema';

/**
 * Interface for the minimal node data required for ID generation
 */
export interface NodeIdentityData {
  /** Absolute file path */
  filePath: string;
  /** Normalized node type */
  type: NodeType | string;
  /** Node name if applicable */
  name?: string;
  /** Start position in source */
  start: Position;
  /** End position in source */
  end: Position;
  /** Additional discriminator for nodes at same position (optional) */
  discriminator?: string;
}

/**
 * Collision detection and reporting interface
 */
export interface CollisionData {
  /** The colliding ID */
  id: string;
  /** All node identity data that generated this ID */
  nodes: NodeIdentityData[];
  /** Timestamp when collision was first detected */
  firstDetected: Date;
}

/**
 * Node ID generation statistics and performance metrics
 */
export interface IDGenerationStats {
  /** Total IDs generated */
  totalGenerated: number;
  /** Number of collisions detected */
  collisionsDetected: number;
  /** Average generation time per ID (ms) */
  averageGenerationTime: number;
  /** Peak generation rate (IDs/second) */
  peakGenerationRate: number;
  /** Memory usage for collision tracking (bytes) */
  memoryUsage: number;
}

/**
 * Options for ID generation behavior
 */
export interface IDGenerationOptions {
  /** Enable collision detection and tracking */
  enableCollisionDetection?: boolean;
  /** Maximum number of collision entries to track */
  maxCollisionEntries?: number;
  /** Use high-resolution timing for performance stats */
  enablePerformanceTracking?: boolean;
  /** Additional salt for ID generation */
  salt?: string;
}

/**
 * Deterministic Node ID Generator
 * 
 * Generates stable, unique identifiers for AST nodes using SHA-256 hashing
 * of normalized node data. Provides collision detection and performance monitoring.
 */
export class NodeIDGenerator {
  private static readonly DEFAULT_OPTIONS: Required<IDGenerationOptions> = {
    enableCollisionDetection: true,
    maxCollisionEntries: 1000,
    enablePerformanceTracking: false,
    salt: '',
  };

  private options: Required<IDGenerationOptions>;
  private collisionMap: Map<string, CollisionData> = new Map();
  private stats: IDGenerationStats = {
    totalGenerated: 0,
    collisionsDetected: 0,
    averageGenerationTime: 0,
    peakGenerationRate: 0,
    memoryUsage: 0,
  };
  private generationTimes: number[] = [];

  constructor(options: IDGenerationOptions = {}) {
    this.options = { ...NodeIDGenerator.DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate a deterministic ID for an AST node
   * 
   * @param node - Node identity data for ID generation
   * @returns 64-character SHA-256 hash string
   */
  generateId(node: NodeIdentityData): string {
    const startTime = this.options.enablePerformanceTracking ? performance.now() : 0;

    try {
      // Normalize and validate input data
      const normalizedNode = this.normalizeNodeData(node);
      
      // Create deterministic content for hashing
      const hashContent = this.createHashContent(normalizedNode);
      
      // Generate SHA-256 hash
      const id = createHash(AST_CONFIG.HASH_ALGORITHM)
        .update(hashContent, 'utf-8')
        .digest('hex');

      // Handle collision detection
      if (this.options.enableCollisionDetection) {
        this.trackCollisions(id, normalizedNode);
      }

      // Update statistics
      this.updateStats(startTime);

      return id;
    } catch (error) {
      throw new Error(`Failed to generate node ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate IDs for multiple nodes efficiently
   * 
   * @param nodes - Array of node identity data
   * @returns Array of generated IDs in same order
   */
  generateBatch(nodes: NodeIdentityData[]): string[] {
    const startTime = this.options.enablePerformanceTracking ? performance.now() : 0;
    const ids: string[] = [];

    for (const node of nodes) {
      ids.push(this.generateId(node));
    }

    // Calculate batch performance metrics
    if (this.options.enablePerformanceTracking && startTime > 0) {
      const duration = performance.now() - startTime;
      const rate = (nodes.length / duration) * 1000; // IDs per second
      
      if (rate > this.stats.peakGenerationRate) {
        this.stats.peakGenerationRate = rate;
      }
    }

    return ids;
  }

  /**
   * Validate that a string is a properly formatted node ID
   * 
   * @param id - String to validate
   * @returns True if valid SHA-256 hex string
   */
  static validateId(id: string): boolean {
    if (typeof id !== 'string') {
      return false;
    }

    // Must be exactly 64 characters (SHA-256 hex)
    if (id.length !== 64) {
      return false;
    }

    // Must contain only hexadecimal characters
    return /^[a-f0-9]{64}$/.test(id);
  }

  /**
   * Check if two node data objects would generate the same ID
   * 
   * @param node1 - First node data
   * @param node2 - Second node data
   * @returns True if IDs would be identical
   */
  static wouldCollide(node1: NodeIdentityData, node2: NodeIdentityData): boolean {
    const generator = new NodeIDGenerator({ enableCollisionDetection: false });
    
    const id1 = generator.generateId(node1);
    const id2 = generator.generateId(node2);
    
    return id1 === id2;
  }

  /**
   * Get collision detection results
   * 
   * @returns Array of all detected collisions
   */
  getCollisions(): CollisionData[] {
    return Array.from(this.collisionMap.values());
  }

  /**
   * Get generation statistics and performance metrics
   * 
   * @returns Current statistics object
   */
  getStats(): IDGenerationStats {
    // Update memory usage estimate
    this.stats.memoryUsage = this.estimateMemoryUsage();
    return { ...this.stats };
  }

  /**
   * Reset all collision data and statistics
   */
  reset(): void {
    this.collisionMap.clear();
    this.generationTimes = [];
    this.stats = {
      totalGenerated: 0,
      collisionsDetected: 0,
      averageGenerationTime: 0,
      peakGenerationRate: 0,
      memoryUsage: 0,
    };
  }

  /**
   * Normalize node data for consistent hashing
   */
  private normalizeNodeData(node: NodeIdentityData): NodeIdentityData {
    // Validate required fields
    if (!node.filePath || !node.type || !node.start || !node.end) {
      throw new Error('Node data missing required fields (filePath, type, start, end)');
    }

    // Validate position data
    if (node.start.line < 1 || node.start.column < 0 ||
        node.end.line < 1 || node.end.column < 0) {
      throw new Error('Invalid position data in node');
    }

    // Normalize file path (ensure consistent path separators)
    const normalizedFilePath = node.filePath.replace(/\\/g, '/');

    return {
      filePath: normalizedFilePath,
      type: node.type,
      name: node.name || '',
      start: node.start,
      end: node.end,
      discriminator: node.discriminator || '',
    };
  }

  /**
   * Create deterministic content string for hashing
   */
  private createHashContent(node: NodeIdentityData): string {
    // Create stable, ordered components for hashing
    const components = [
      node.filePath,
      node.type,
      node.name || '',
      `${node.start.line}:${node.start.column}`,
      `${node.end.line}:${node.end.column}`,
      node.discriminator || '',
      this.options.salt, // Include salt for additional uniqueness if needed
    ];

    // Join with null separator to prevent ambiguity
    return components.join('\0');
  }

  /**
   * Track potential collisions for the given ID
   */
  private trackCollisions(id: string, node: NodeIdentityData): void {
    if (this.collisionMap.has(id)) {
      // Collision detected
      const existing = this.collisionMap.get(id)!;
      
      // Check if this is genuinely different node data
      const isDuplicate = existing.nodes.some(existingNode => 
        this.nodesAreEquivalent(existingNode, node)
      );

      if (!isDuplicate) {
        existing.nodes.push(node);
        this.stats.collisionsDetected++;
      }
    } else {
      // First occurrence of this ID
      this.collisionMap.set(id, {
        id,
        nodes: [node],
        firstDetected: new Date(),
      });

      // Limit memory usage by removing oldest entries
      if (this.collisionMap.size > this.options.maxCollisionEntries) {
        const firstKey = this.collisionMap.keys().next().value;
        if (firstKey) {
          this.collisionMap.delete(firstKey);
        }
      }
    }
  }

  /**
   * Check if two node data objects are equivalent
   */
  private nodesAreEquivalent(node1: NodeIdentityData, node2: NodeIdentityData): boolean {
    return (
      node1.filePath === node2.filePath &&
      node1.type === node2.type &&
      node1.name === node2.name &&
      node1.start.line === node2.start.line &&
      node1.start.column === node2.start.column &&
      node1.end.line === node2.end.line &&
      node1.end.column === node2.end.column &&
      node1.discriminator === node2.discriminator
    );
  }

  /**
   * Update performance statistics
   */
  private updateStats(startTime: number): void {
    this.stats.totalGenerated++;

    if (this.options.enablePerformanceTracking && startTime > 0) {
      const duration = performance.now() - startTime;
      this.generationTimes.push(duration);

      // Keep only recent measurements for rolling average
      if (this.generationTimes.length > 1000) {
        this.generationTimes.shift();
      }

      // Calculate average generation time
      this.stats.averageGenerationTime = 
        this.generationTimes.reduce((sum, time) => sum + time, 0) / 
        this.generationTimes.length;
    }
  }

  /**
   * Estimate current memory usage for collision tracking
   */
  private estimateMemoryUsage(): number {
    // Rough estimate: each collision entry averages ~500 bytes
    // (ID string + node data + metadata)
    return this.collisionMap.size * 500;
  }
}

/**
 * Utility functions for working with node IDs
 */
export class NodeIDUtils {
  /**
   * Extract file path hash from a node ID (for partitioning)
   * 
   * @param id - Node ID to extract from
   * @returns First 8 characters as file path hash
   */
  static extractFilePathHash(id: string): string {
    if (!NodeIDGenerator.validateId(id)) {
      throw new Error('Invalid node ID format');
    }
    return id.substring(0, 8);
  }

  /**
   * Generate a short display ID for debugging
   * 
   * @param id - Full node ID
   * @param length - Number of characters to include (default: 8)
   * @returns Shortened ID for display
   */
  static shortId(id: string, length: number = 8): string {
    if (!NodeIDGenerator.validateId(id)) {
      throw new Error('Invalid node ID format');
    }
    return id.substring(0, Math.max(4, Math.min(length, 64)));
  }

  /**
   * Compare two node IDs lexicographically
   * 
   * @param id1 - First ID
   * @param id2 - Second ID
   * @returns -1, 0, or 1 for sorting
   */
  static compareIds(id1: string, id2: string): number {
    return id1.localeCompare(id2);
  }
}

/**
 * Default singleton instance for common usage
 */
export const defaultNodeIDGenerator = new NodeIDGenerator();