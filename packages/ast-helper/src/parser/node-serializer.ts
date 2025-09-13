/**
 * AST Node Serialization and Storage
 * 
 * Handles JSON serialization/deserialization of AST nodes with schema versioning,
 * validation, and file storage capabilities.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ASTNode, Position, NodeMetadata, NodeType, SignificanceLevel } from './ast-schema';

/**
 * Serialization configuration
 */
export interface SerializationConfig {
  /** Include metadata in serialized output */
  includeMetadata: boolean;
  /** Pretty print JSON output */
  prettyPrint: boolean;
  /** Schema version to use */
  schemaVersion: string;
  /** Validate during serialization */
  validateOnSerialize: boolean;
  /** Validate during deserialization */
  validateOnDeserialize: boolean;
  /** Include source text */
  includeSourceText: boolean;
}

/**
 * Serialized AST node structure (matches ASTNode interface)
 */
export interface SerializedASTNode {
  /** Schema version */
  $schema: string;
  /** Node ID */
  id: string;
  /** Node type */
  type: NodeType;
  /** Node name */
  name?: string;
  /** File path */
  filePath: string;
  /** Start position */
  start: Position;
  /** End position */
  end: Position;
  /** Parent node ID */
  parent?: string;
  /** Child node IDs */
  children: string[];
  /** Metadata */
  metadata: NodeMetadata;
  /** Source text */
  sourceText?: string;
  /** Function signature */
  signature?: string;
  /** Significance level */
  significance: SignificanceLevel;
  /** Complexity score */
  complexity?: number;
  /** Serialization timestamp */
  serializedAt: string;
}

/**
 * Serialized file structure
 */
export interface SerializedFile {
  /** Schema version */
  $schema: string;
  /** File path */
  filePath: string;
  /** Language */
  language: string;
  /** Root nodes (serialized) */
  nodes: SerializedASTNode[];
  /** File metadata */
  metadata: {
    /** Total node count */
    nodeCount: number;
    /** Serialization timestamp */
    serializedAt: string;
    /** Original file hash */
    fileHash?: string;
    /** Processing stats */
    stats: {
      totalNodes: number;
      significanceLevels: Record<string, number>;
      nodeTypes: Record<string, number>;
    };
  };
}

/**
 * Schema validation error
 */
export class SerializationValidationError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly actualValue: any,
    public readonly expectedType: string
  ) {
    super(`Schema validation failed at ${path}: ${message}. Expected ${expectedType}, got ${JSON.stringify(actualValue)}`);
    this.name = 'SerializationValidationError';
  }
}

/**
 * Schema migration error
 */
export class SchemaMigrationError extends Error {
  constructor(
    message: string,
    public readonly fromVersion: string,
    public readonly toVersion: string
  ) {
    super(`Schema migration failed from ${fromVersion} to ${toVersion}: ${message}`);
    this.name = 'SchemaMigrationError';
  }
}

/**
 * Default serialization configuration
 */
export const DEFAULT_SERIALIZATION_CONFIG: SerializationConfig = {
  includeMetadata: true,
  prettyPrint: false,
  schemaVersion: '1.0.0',
  validateOnSerialize: true,
  validateOnDeserialize: true,
  includeSourceText: true,
};

/**
 * Current schema version
 */
export const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * AST Node Serializer
 */
export class NodeSerializer {
  private config: SerializationConfig;

  constructor(config: Partial<SerializationConfig> = {}) {
    this.config = { ...DEFAULT_SERIALIZATION_CONFIG, ...config };
  }

  /**
   * Serialize a single AST node
   */
  serializeNode(node: ASTNode): SerializedASTNode {
    if (this.config.validateOnSerialize) {
      this.validateASTNode(node);
    }

    const serialized: SerializedASTNode = {
      $schema: this.config.schemaVersion,
      id: node.id,
      type: node.type,
      filePath: node.filePath,
      start: node.start,
      end: node.end,
      children: [...node.children],
      metadata: node.metadata,
      significance: node.significance,
      serializedAt: new Date().toISOString(),
    };

    if (node.name) {
      serialized.name = node.name;
    }

    if (node.parent) {
      serialized.parent = node.parent;
    }

    if (this.config.includeSourceText && node.sourceText) {
      serialized.sourceText = node.sourceText;
    }

    if (node.signature) {
      serialized.signature = node.signature;
    }

    if (node.complexity !== undefined) {
      serialized.complexity = node.complexity;
    }

    return serialized;
  }

  /**
   * Serialize multiple nodes to a file structure
   */
  serializeFile(
    nodes: ASTNode[],
    filePath: string,
    language: string,
    fileHash?: string
  ): SerializedFile {
    if (this.config.validateOnSerialize) {
      for (const node of nodes) {
        this.validateASTNode(node);
      }
    }

    // Calculate statistics
    const stats = this.calculateStats(nodes);

    const serialized: SerializedFile = {
      $schema: this.config.schemaVersion,
      filePath,
      language,
      nodes: nodes.map(node => this.serializeNode(node)),
      metadata: {
        nodeCount: stats.totalNodes,
        serializedAt: new Date().toISOString(),
        fileHash,
        stats,
      },
    };

    return serialized;
  }

  /**
   * Deserialize a single AST node
   */
  deserializeNode(data: SerializedASTNode): ASTNode {
    if (this.config.validateOnDeserialize) {
      this.validateSerializedNode(data);
    }

    // Handle schema migration if needed
    const migratedData = this.migrateSchema(data);

    const node: ASTNode = {
      id: migratedData.id,
      type: migratedData.type,
      filePath: migratedData.filePath,
      start: migratedData.start,
      end: migratedData.end,
      children: [...migratedData.children],
      metadata: migratedData.metadata,
      significance: migratedData.significance,
    };

    if (migratedData.name) {
      node.name = migratedData.name;
    }

    if (migratedData.parent) {
      node.parent = migratedData.parent;
    }

    if (migratedData.sourceText) {
      node.sourceText = migratedData.sourceText;
    }

    if (migratedData.signature) {
      node.signature = migratedData.signature;
    }

    if (migratedData.complexity !== undefined) {
      node.complexity = migratedData.complexity;
    }

    return node;
  }

  /**
   * Deserialize a file structure
   */
  deserializeFile(data: SerializedFile): {
    nodes: ASTNode[];
    filePath: string;
    language: string;
    metadata: SerializedFile['metadata'];
  } {
    if (this.config.validateOnDeserialize) {
      this.validateSerializedFile(data);
    }

    // Handle schema migration if needed
    const migratedData = this.migrateFileSchema(data);

    return {
      nodes: migratedData.nodes.map(nodeData => this.deserializeNode(nodeData)),
      filePath: migratedData.filePath,
      language: migratedData.language,
      metadata: migratedData.metadata,
    };
  }

  /**
   * Serialize and save to file
   */
  async saveToFile(
    nodes: ASTNode[],
    filePath: string,
    outputPath: string,
    language: string,
    fileHash?: string
  ): Promise<void> {
    const serialized = this.serializeFile(nodes, filePath, language, fileHash);
    const json = this.config.prettyPrint 
      ? JSON.stringify(serialized, null, 2)
      : JSON.stringify(serialized);

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(outputPath, json, 'utf8');
  }

  /**
   * Load and deserialize from file
   */
  async loadFromFile(inputPath: string): Promise<{
    nodes: ASTNode[];
    filePath: string;
    language: string;
    metadata: SerializedFile['metadata'];
  }> {
    const json = await fs.promises.readFile(inputPath, 'utf8');
    const data = JSON.parse(json) as SerializedFile;
    
    return this.deserializeFile(data);
  }

  /**
   * Validate serialized output against original
   */
  validateRoundTrip(original: ASTNode, _serialized: SerializedASTNode, deserialized: ASTNode): boolean {
    // Check core properties
    if (original.id !== deserialized.id) return false;
    if (original.type !== deserialized.type) return false;
    if (original.filePath !== deserialized.filePath) return false;
    if (original.significance !== deserialized.significance) return false;

    // Check optional properties
    if (original.name !== deserialized.name) return false;
    if (original.parent !== deserialized.parent) return false;
    if (original.sourceText !== deserialized.sourceText) return false;
    if (original.signature !== deserialized.signature) return false;
    if (original.complexity !== deserialized.complexity) return false;

    // Check positions
    if (!this.deepEqual(original.start, deserialized.start)) return false;
    if (!this.deepEqual(original.end, deserialized.end)) return false;

    // Check metadata
    if (!this.deepEqual(original.metadata, deserialized.metadata)) return false;

    // Check children arrays
    if (original.children.length !== deserialized.children.length) return false;
    for (let i = 0; i < original.children.length; i++) {
      if (original.children[i] !== deserialized.children[i]) return false;
    }

    return true;
  }

  /**
   * Update serialization configuration
   */
  updateConfig(newConfig: Partial<SerializationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): SerializationConfig {
    return { ...this.config };
  }

  /**
   * Get serialization statistics for nodes
   */
  getSerializationStats(nodes: ASTNode[]): {
    totalNodes: number;
    totalSize: number;
    averageDepth: number;
    maxDepth: number;
    typeDistribution: Record<string, number>;
    significanceDistribution: Record<string, number>;
  } {
    let totalNodes = 0;
    let totalDepth = 0;
    let maxDepth = 0;
    const typeDistribution: Record<string, number> = {};
    const significanceDistribution: Record<string, number> = {};

    // Note: This is a mock implementation since we don't have a node lookup mechanism
    // In a real implementation, you'd need a way to resolve child IDs to actual nodes
    const collectStats = (node: ASTNode, depth: number = 0) => {
      totalNodes++;
      totalDepth += depth;
      maxDepth = Math.max(maxDepth, depth);

      // Type distribution
      typeDistribution[node.type] = (typeDistribution[node.type] || 0) + 1;

      // Significance distribution
      significanceDistribution[node.significance.toString()] = (significanceDistribution[node.significance.toString()] || 0) + 1;
    };

    for (const node of nodes) {
      collectStats(node);
    }

    const serialized = this.serializeFile(nodes, 'temp', 'temp');
    const totalSize = JSON.stringify(serialized).length;

    return {
      totalNodes,
      totalSize,
      averageDepth: totalNodes > 0 ? totalDepth / totalNodes : 0,
      maxDepth,
      typeDistribution,
      significanceDistribution,
    };
  }

  /**
   * Calculate file statistics
   */
  private calculateStats(nodes: ASTNode[]): SerializedFile['metadata']['stats'] {
    let totalNodes = 0;
    const significanceLevels: Record<string, number> = {};
    const nodeTypes: Record<string, number> = {};

    const collectStats = (node: ASTNode) => {
      totalNodes++;
      
      significanceLevels[node.significance.toString()] = (significanceLevels[node.significance.toString()] || 0) + 1;
      
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;

      // Note: We can't recurse to children here since children are just IDs
      // In a real implementation, you'd need a way to resolve child IDs
    };

    for (const node of nodes) {
      collectStats(node);
    }

    return { totalNodes, significanceLevels, nodeTypes };
  }

  /**
   * Validate ASTNode structure
   */
  private validateASTNode(node: ASTNode, path: string = 'root'): void {
    if (!node.id || typeof node.id !== 'string') {
      throw new SerializationValidationError('Missing or invalid id', path, node.id, 'string');
    }
    
    if (!node.type || typeof node.type !== 'string') {
      throw new SerializationValidationError('Missing or invalid type', path, node.type, 'NodeType');
    }
    
    if (!node.filePath || typeof node.filePath !== 'string') {
      throw new SerializationValidationError('Missing or invalid filePath', path, node.filePath, 'string');
    }

    if (!this.validatePosition(node.start)) {
      throw new SerializationValidationError('Invalid start position', `${path}.start`, node.start, 'Position');
    }

    if (!this.validatePosition(node.end)) {
      throw new SerializationValidationError('Invalid end position', `${path}.end`, node.end, 'Position');
    }

    if (!Array.isArray(node.children)) {
      throw new SerializationValidationError('Children must be an array', `${path}.children`, node.children, 'string[]');
    }

    if (!node.metadata) {
      throw new SerializationValidationError('Missing metadata', `${path}.metadata`, node.metadata, 'NodeMetadata');
    }

    if (!Object.values(SignificanceLevel).includes(node.significance)) {
      throw new SerializationValidationError('Invalid significance level', `${path}.significance`, node.significance, 'SignificanceLevel');
    }
  }

  /**
   * Validate SerializedASTNode structure
   */
  private validateSerializedNode(data: SerializedASTNode, path: string = 'root'): void {
    if (!data.$schema || typeof data.$schema !== 'string') {
      throw new SerializationValidationError('Missing or invalid $schema', path, data.$schema, 'string');
    }
    
    if (!data.id || typeof data.id !== 'string') {
      throw new SerializationValidationError('Missing or invalid id', path, data.id, 'string');
    }
    
    if (!data.type || typeof data.type !== 'string') {
      throw new SerializationValidationError('Missing or invalid type', path, data.type, 'NodeType');
    }
    
    if (!data.filePath || typeof data.filePath !== 'string') {
      throw new SerializationValidationError('Missing or invalid filePath', path, data.filePath, 'string');
    }

    if (!this.validatePosition(data.start)) {
      throw new SerializationValidationError('Invalid start position', `${path}.start`, data.start, 'Position');
    }

    if (!this.validatePosition(data.end)) {
      throw new SerializationValidationError('Invalid end position', `${path}.end`, data.end, 'Position');
    }

    if (!Array.isArray(data.children)) {
      throw new SerializationValidationError('Children must be an array', `${path}.children`, data.children, 'string[]');
    }
  }

  /**
   * Validate SerializedFile structure
   */
  private validateSerializedFile(data: SerializedFile): void {
    if (!data.$schema || typeof data.$schema !== 'string') {
      throw new SerializationValidationError('Missing or invalid $schema', 'root', data.$schema, 'string');
    }
    
    if (!data.filePath || typeof data.filePath !== 'string') {
      throw new SerializationValidationError('Missing or invalid filePath', 'root', data.filePath, 'string');
    }
    
    if (!data.language || typeof data.language !== 'string') {
      throw new SerializationValidationError('Missing or invalid language', 'root', data.language, 'string');
    }

    if (!Array.isArray(data.nodes)) {
      throw new SerializationValidationError('Missing or invalid nodes array', 'root', data.nodes, 'SerializedASTNode[]');
    }

    for (let i = 0; i < data.nodes.length; i++) {
      const node = data.nodes[i];
      if (node) {
        this.validateSerializedNode(node, `nodes[${i}]`);
      }
    }
  }

  /**
   * Validate Position structure
   */
  private validatePosition(position: Position): boolean {
    return (
      typeof position === 'object' &&
      typeof position.line === 'number' &&
      typeof position.column === 'number' &&
      position.line >= 0 &&
      position.column >= 0
    );
  }

  /**
   * Migrate schema to current version
   */
  private migrateSchema(data: SerializedASTNode): SerializedASTNode {
    if (data.$schema === CURRENT_SCHEMA_VERSION) {
      return data;
    }

    // Future schema migration logic would go here
    // For now, we only have version 1.0.0
    
    if (!this.isSupportedSchemaVersion(data.$schema)) {
      throw new SchemaMigrationError(
        `Unsupported schema version: ${data.$schema}`,
        data.$schema,
        CURRENT_SCHEMA_VERSION
      );
    }

    return { ...data, $schema: CURRENT_SCHEMA_VERSION };
  }

  /**
   * Migrate file schema to current version
   */
  private migrateFileSchema(data: SerializedFile): SerializedFile {
    if (data.$schema === CURRENT_SCHEMA_VERSION) {
      return data;
    }

    // Future file schema migration logic would go here
    
    if (!this.isSupportedSchemaVersion(data.$schema)) {
      throw new SchemaMigrationError(
        `Unsupported file schema version: ${data.$schema}`,
        data.$schema,
        CURRENT_SCHEMA_VERSION
      );
    }

    return { ...data, $schema: CURRENT_SCHEMA_VERSION };
  }

  /**
   * Check if schema version is supported
   */
  private isSupportedSchemaVersion(version: string): boolean {
    const supportedVersions = ['1.0.0'];
    return supportedVersions.includes(version);
  }

  /**
   * Deep equality check
   */
  private deepEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    
    if (obj1 == null || obj2 == null) return obj1 === obj2;
    
    if (typeof obj1 !== typeof obj2) return false;
    
    if (typeof obj1 !== 'object') return obj1 === obj2;
    
    if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
  }
}

/**
 * Default serializer instance
 */
export const defaultSerializer = new NodeSerializer();

/**
 * Utility functions for serialization
 */
export class SerializationUtils {
  /**
   * Create a serializer with preset configurations
   */
  static createMinimalSerializer(): NodeSerializer {
    return new NodeSerializer({
      includeMetadata: false,
      includeSourceText: false,
      prettyPrint: false,
      validateOnSerialize: false,
      validateOnDeserialize: false,
    });
  }

  /**
   * Create a serializer with full validation
   */
  static createValidatingSerializer(): NodeSerializer {
    return new NodeSerializer({
      includeMetadata: true,
      includeSourceText: true,
      prettyPrint: true,
      validateOnSerialize: true,
      validateOnDeserialize: true,
    });
  }

  /**
   * Create a serializer for debugging
   */
  static createDebugSerializer(): NodeSerializer {
    return new NodeSerializer({
      includeMetadata: true,
      includeSourceText: true,
      prettyPrint: true,
      validateOnSerialize: true,
      validateOnDeserialize: true,
    });
  }

  /**
   * Estimate serialized size without actually serializing
   */
  static estimateSerializedSize(nodes: ASTNode[]): number {
    let size = 0;
    
    const estimateNodeSize = (node: ASTNode): number => {
      let nodeSize = 0;
      
      // Base properties
      nodeSize += node.id.length + node.type.length + node.filePath.length;
      nodeSize += 200; // JSON overhead + positions + other fields
      
      // Optional text fields
      if (node.name) nodeSize += node.name.length;
      if (node.sourceText) nodeSize += node.sourceText.length;
      if (node.signature) nodeSize += node.signature.length;
      
      // Metadata
      nodeSize += JSON.stringify(node.metadata).length;
      
      // Children array (just IDs)
      nodeSize += node.children.length * 50; // Estimated average ID length
      
      return nodeSize;
    };
    
    for (const node of nodes) {
      size += estimateNodeSize(node);
    }
    
    return size;
  }

  /**
   * Calculate compression ratio for serialized data
   */
  static calculateCompressionRatio(original: string, compressed: string): number {
    if (original.length === 0) {
      return 0; // No compression possible for empty strings
    }
    return 1 - (compressed.length / original.length);
  }
}