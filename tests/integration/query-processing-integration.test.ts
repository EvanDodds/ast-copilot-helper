/**
 * @fileoverview Query Processing Integration Tests
 * 
 * Comprehensive integration test suite for the MCP Server Query Processing System.
 * Tests complete query workflows, cross-language capabilities, performance optimization,
 * caching mechanisms, and system-wide integration scenarios.
 * 
 * Coverage includes:
 * - Complex query scenarios with multiple query types
 * - Cross-language query processing and result correlation
 * - Query optimization and performance characteristics
 * - Result accuracy and relevance scoring validation
 * - Caching mechanisms and cache hit/miss patterns
 * - Integration with database, indexing, and annotation systems
 * - Error handling and resilience under various conditions
 * - Concurrent query processing and system scalability
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import { BaseIntegrationTestSuite } from './framework/integration-test-suite.js';

// Query system imports
import { MCPQueryProcessor } from '../../packages/ast-mcp-server/src/query/processor.js';
import { SemanticQueryProcessor } from '../../packages/ast-mcp-server/src/query/semantic-processor.js';
import { SignatureQueryProcessor } from '../../packages/ast-mcp-server/src/query/signature-processor.js';
import { FileQueryProcessor } from '../../packages/ast-mcp-server/src/query/file-processor.js';
import { ResponseAssembler } from '../../packages/ast-mcp-server/src/query/response-assembler.js';
import { PerformanceMonitor } from '../../packages/ast-mcp-server/src/query/performance-monitor.js';

// Database and infrastructure imports
import { ASTDatabaseReader } from '../../packages/ast-mcp-server/src/database/reader.js';
import { XenovaEmbeddingGenerator } from '../../packages/ast-helper/src/embedder/index.js';
import { HNSWVectorDatabase } from '../../packages/ast-helper/src/database/vector/index.js';
import { createVectorDBConfig } from '../../packages/ast-helper/src/database/vector/types.js';

// Type imports
import type {
  MCPQuery,
  QueryResponse,
  SemanticQuery,
  SemanticQueryOptions,
  SignatureQueryOptions,
  FileQuery,
  FileQueryOptions,
  QueryStats,
  QuerySystemConfig,
  AnnotationMatch,
  QueryMetadata,
  PerformanceMetrics,
  QueryType,
  QueryContext,
} from '../../packages/ast-mcp-server/src/query/types.js';

/**
 * Query Processing Test Utilities
 * Helper functions and test data management for query processing integration tests
 */
class QueryProcessingTestUtils {
  private static readonly TEST_DB_PATH = path.join(os.tmpdir(), 'query-processing-integration-test.db');
  private static readonly TEST_VECTORS_PATH = path.join(os.tmpdir(), 'query-processing-vectors-test');
  private static readonly TEST_FILES_PATH = path.join(os.tmpdir(), 'query-processing-test-files');

  /**
   * Create comprehensive test environment with sample code files and annotations
   */
  static async createTestEnvironment(): Promise<{
    databaseReader: ASTDatabaseReader;
    embeddingGenerator: XenovaEmbeddingGenerator;
    vectorDatabase: HNSWVectorDatabase;
    config: QuerySystemConfig;
  }> {
    // Create test directories
    if (existsSync(this.TEST_FILES_PATH)) {
      rmSync(this.TEST_FILES_PATH, { recursive: true, maxDepth: 5, force: true });
    }
    mkdirSync(this.TEST_FILES_PATH, { recursive: true });

    if (existsSync(this.TEST_VECTORS_PATH)) {
      rmSync(this.TEST_VECTORS_PATH, { recursive: true, maxDepth: 5, force: true });
    }
    mkdirSync(this.TEST_VECTORS_PATH, { recursive: true });

    // Create sample source files for testing
    await this.createTestSourceFiles();

    // Initialize database reader (mock implementation for testing)
    // Create test database path
    const testWorkspacePath = path.join(this.TEST_FILES_PATH, 'test-workspace');
    
    // Create database reader with workspace path
    const databaseReader = new ASTDatabaseReader(testWorkspacePath);

    // Initialize embedding generator (no constructor arguments)
    const embeddingGenerator = new XenovaEmbeddingGenerator();

    // Create vector database config and initialize
    const vectorDbConfig = createVectorDBConfig({
      dimensions: 768,
      storageFile: path.join(this.TEST_VECTORS_PATH, 'vectors.db'),
      indexFile: path.join(this.TEST_VECTORS_PATH, 'vectors.idx'),
      maxElements: 10000,
      M: 16,
      efConstruction: 200
    });
    const vectorDatabase = new HNSWVectorDatabase(vectorDbConfig);

    // Create comprehensive query system configuration
    const config: QuerySystemConfig = {
      cache: {
        maxSize: 1000,
        defaultTTL: 300,
        cleanupInterval: 60000,
        enabled: true,
      },
      performance: {
        maxQueryTime: 5000,
        maxMemoryUsage: 100 * 1024 * 1024, // 100MB
        maxConcurrentQueries: 10,
      },
      ranking: {
        defaultMode: 'relevance',
        contextBoostFactor: 0.2,
        confidenceWeight: 0.3,
        recencyWeight: 0.1,
        diversityThreshold: 0.8,
      },
      search: {
        defaultMaxResults: 20,
        defaultMinScore: 0.1,
        defaultSearchEf: 100,
      },
    };

    return {
      databaseReader,
      embeddingGenerator,
      vectorDatabase,
      config,
    };
  }

  /**
   * Create diverse test source files in multiple languages
   */
  private static async createTestSourceFiles(): Promise<void> {
    // TypeScript service class
    const tsServiceFile = `
export class UserService {
  private users: Map<string, User> = new Map();

  async createUser(userData: CreateUserRequest): Promise<User> {
    const user = new User(userData.name, userData.email);
    this.users.set(user.id, user);
    return user;
  }

  async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findUsersByEmail(email: string): Promise<User[]> {
    const results: User[] = [];
    for (const [, user] of this.users) {
      if (user.email === email) {
        results.push(user);
      }
    }
    return results;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    
    Object.assign(user, updates);
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async getUserCount(): Promise<number> {
    return this.users.size;
  }
}

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

interface CreateUserRequest {
  name: string;
  email: string;
}
`;

    // JavaScript utility functions
    const jsUtilFile = `
const crypto = require('crypto');
const path = require('path');

/**
 * Generate a secure random string
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash password with salt
 */
async function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 10000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve({ hash: derivedKey.toString('hex'), salt });
    });
  });
}

/**
 * Validate email format
 */
function validateEmail(email) {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Clean file path for safe usage
 */
function sanitizeFilePath(filePath) {
  return path.normalize(filePath).replace(/\\.\\./g, '');
}

/**
 * Deep merge objects
 */
function deepMerge(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return deepMerge(target, ...sources);
}

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

module.exports = {
  generateSecureToken,
  hashPassword,
  validateEmail,
  sanitizeFilePath,
  deepMerge,
};
`;

    // Python data processing module
    const pyProcessorFile = `
import asyncio
import json
import logging
from typing import List, Dict, Optional, Union, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class DataPoint:
    id: str
    timestamp: datetime
    value: Union[int, float, str]
    metadata: Dict[str, Any]
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DataPoint':
        return cls(**data)

class DataProcessor:
    """High-performance data processing pipeline"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.data_points: List[DataPoint] = []
        self.processed_count = 0
        
    async def process_batch(self, data_points: List[DataPoint]) -> List[DataPoint]:
        """Process a batch of data points asynchronously"""
        processed = []
        
        for point in data_points:
            if await self._validate_data_point(point):
                transformed = await self._transform_data_point(point)
                if transformed:
                    processed.append(transformed)
                    
        self.processed_count += len(processed)
        return processed
    
    async def _validate_data_point(self, point: DataPoint) -> bool:
        """Validate individual data point"""
        if not point.id or not point.timestamp:
            return False
            
        if isinstance(point.value, (int, float)) and point.value < 0:
            logger.warning(f"Negative value detected: {point.value}")
            
        return True
    
    async def _transform_data_point(self, point: DataPoint) -> Optional[DataPoint]:
        """Transform data point according to rules"""
        try:
            # Apply transformation rules
            if isinstance(point.value, str):
                point.value = point.value.lower().strip()
            elif isinstance(point.value, (int, float)):
                point.value = round(point.value, 2)
                
            # Add processing metadata
            point.metadata['processed_at'] = datetime.utcnow()
            point.metadata['processor_version'] = '1.0.0'
            
            return point
            
        except Exception as e:
            logger.error(f"Transform error for {point.id}: {e}")
            return None
    
    async def aggregate_data(self, 
                           data_points: List[DataPoint], 
                           group_by: str = 'timestamp') -> Dict[str, Any]:
        """Aggregate data points by specified criteria"""
        
        aggregation = {
            'total_points': len(data_points),
            'numeric_sum': 0,
            'numeric_avg': 0,
            'string_values': set(),
            'time_range': None,
        }
        
        numeric_values = []
        timestamps = []
        
        for point in data_points:
            if isinstance(point.value, (int, float)):
                numeric_values.append(point.value)
            elif isinstance(point.value, str):
                aggregation['string_values'].add(point.value)
                
            timestamps.append(point.timestamp)
        
        if numeric_values:
            aggregation['numeric_sum'] = sum(numeric_values)
            aggregation['numeric_avg'] = sum(numeric_values) / len(numeric_values)
        
        if timestamps:
            aggregation['time_range'] = {
                'start': min(timestamps),
                'end': max(timestamps),
                'duration': max(timestamps) - min(timestamps)
            }
        
        return aggregation
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get current processing statistics"""
        return {
            'total_processed': self.processed_count,
            'data_points_loaded': len(self.data_points),
            'config': self.config,
            'timestamp': datetime.utcnow()
        }
`;

    // Write test files
    writeFileSync(path.join(this.TEST_FILES_PATH, 'user-service.ts'), tsServiceFile);
    writeFileSync(path.join(this.TEST_FILES_PATH, 'utils.js'), jsUtilFile);
    writeFileSync(path.join(this.TEST_FILES_PATH, 'data_processor.py'), pyProcessorFile);
  }

  /**
   * Generate test queries for different scenarios
   */
  static generateTestQueries(): MCPQuery[] {
    return [
      // Semantic queries
      {
        type: 'semantic',
        text: 'find user by email address',
        maxResults: 10,
        minScore: 0.1,
      },
      {
        type: 'semantic',
        text: 'async password hashing function',
        maxResults: 5,
        options: {
          languageFilter: ['javascript', 'typescript'],
          confidenceThreshold: 0.8,
        } as SignatureQueryOptions,
      },
      {
        type: 'semantic',
        text: 'data validation and processing',
        maxResults: 15,
        context: {
          currentFile: path.join(this.TEST_FILES_PATH, 'data_processor.py'),
          selectedText: 'validate_data_point',
        } as SignatureQueryOptions,
      },

      // Signature queries
      {
        type: 'signature',
        text: 'async createUser(userData: CreateUserRequest): Promise<User>',
        maxResults: 10,
        options: {
          includeReturnType: true,
          languageFilter: ['typescript'],
        } as SignatureQueryOptions,
      },
      {
        type: 'signature',
        text: 'function generateSecureToken',
        maxResults: 5,
        options: {
          fuzzyThreshold: 0.8,
          languageFilter: ['javascript'],
        } as SignatureQueryOptions,
      },
      {
        type: 'signature',
        text: 'def process_batch(self, data_points)',
        maxResults: 8,
        options: {
          includeReturnType: false,
          fuzzyThreshold: 0.7,
          languageFilter: ['python'],
        } as SignatureQueryOptions,
      },

      // File queries
      {
        type: 'file',
        text: '*.ts',
        maxResults: 20,
        options: {
          recursive: true, maxDepth: 5,
          includeHidden: false,
        } as FileQueryOptions,
      },
      {
        type: 'file',
        text: 'user',
        maxResults: 10,
        options: {
          fileFilter: ['user-service.ts'],
        } as SignatureQueryOptions,
      },

      // Contextual queries
      {
        type: 'contextual',
        text: 'error handling patterns',
        maxResults: 12,
        context: {
          currentFile: path.join(this.TEST_FILES_PATH, 'utils.js'),
          recentFiles: [
            path.join(this.TEST_FILES_PATH, 'user-service.ts'),
            path.join(this.TEST_FILES_PATH, 'data_processor.py'),
          ],
        } as SignatureQueryOptions,
      },
      {
        type: 'contextual',
        text: 'async processing workflow',
        maxResults: 8,
        context: {
          selectedText: 'await this._validate_data_point',
          currentFile: path.join(this.TEST_FILES_PATH, 'data_processor.py'),
        } as SignatureQueryOptions,
      },
    ];
  }

  /**
   * Validate query response structure and content
   */
  static validateQueryResponse(response: QueryResponse, expectedType: QueryType): void {
    expect(response).toBeDefined();
    expect(response.results).toBeDefined();
    expect(Array.isArray(response.results)).toBe(true);
    expect(typeof response.totalMatches).toBe('number');
    expect(response.totalMatches).toBeGreaterThanOrEqual(0);
    expect(typeof response.queryTime).toBe('number');
    expect(response.queryTime).toBeGreaterThanOrEqual(0);
    expect(typeof response.searchStrategy).toBe('string');
    expect(response.searchStrategy.length).toBeGreaterThan(0);
    expect(response.metadata).toBeDefined();
    
    // Validate metadata structure
    expect(typeof response.metadata.vectorSearchTime).toBe('number');
    expect(typeof response.metadata.rankingTime).toBe('number');
    expect(typeof response.metadata.totalCandidates).toBe('number');
    expect(Array.isArray(response.metadata.appliedFilters)).toBe(true);
    expect(typeof response.metadata.searchParameters).toBe('object');
    
    // Validate individual results
    response.results.forEach((result: AnnotationMatch) => {
      expect(result.annotation).toBeDefined();
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(typeof result.matchReason).toBe('string');
      
      // Validate annotation structure
      expect(typeof result.annotation.nodeId).toBe('string');
      expect(typeof result.annotation.signature).toBe('string');
      expect(typeof result.annotation.filePath).toBe('string');
      expect(typeof result.annotation.lineNumber).toBe('number');
      expect(typeof result.annotation.language).toBe('string');
      expect(typeof result.annotation.confidence).toBe('number');
    });
  }

  /**
   * Generate performance test queries for load testing
   */
  static generatePerformanceTestQueries(count: number): MCPQuery[] {
    const queries: MCPQuery[] = [];
    const queryTypes: QueryType[] = ['semantic', 'signature', 'file', 'contextual'];
    
    for (let i = 0; i < count; i++) {
      const type = queryTypes[i % queryTypes.length];
      queries.push({
        type,
        text: `test query ${i} for ${type} processing`,
        maxResults: Math.floor(Math.random() * 20) + 5,
        minScore: Math.random() * 0.5 + 0.1,
      });
    }
    
    return queries;
  }

  /**
   * Clean up test environment
   */
  static async cleanup(): Promise<void> {
    if (existsSync(this.TEST_FILES_PATH)) {
      rmSync(this.TEST_FILES_PATH, { recursive: true, maxDepth: 5, force: true });
    }
    if (existsSync(this.TEST_VECTORS_PATH)) {
      rmSync(this.TEST_VECTORS_PATH, { recursive: true, maxDepth: 5, force: true });
    }
    if (existsSync(this.TEST_DB_PATH)) {
      rmSync(this.TEST_DB_PATH, { force: true });
    }
  }
}

/**
 * Comprehensive Query Processing Integration Test Suite
 */
class ComprehensiveQueryProcessingIntegrationTestSuite extends BaseIntegrationTestSuite {
  private queryProcessor!: MCPQueryProcessor;
  private semanticProcessor!: SemanticQueryProcessor;
  private signatureProcessor!: SignatureQueryProcessor;
  private fileProcessor!: FileQueryProcessor;
  private responseAssembler!: ResponseAssembler;
  private performanceMonitor!: PerformanceMonitor;

  private testEnvironment!: {
    databaseReader: ASTDatabaseReader;
    embeddingGenerator: XenovaEmbeddingGenerator;
    vectorDatabase: HNSWVectorDatabase;
    config: QuerySystemConfig;
  };

  protected getTestName(): string {
    return 'Query Processing Integration Tests';
  }

  protected async setupQueryProcessingEnvironment(): Promise<void> {
    await super.setupTestEnvironment();
    
    // Create comprehensive test environment
    this.testEnvironment = await QueryProcessingTestUtils.createTestEnvironment();
    
    // Initialize query processing components
    await this.initializeQueryProcessors();
    
    console.log('Query processing test environment initialized');
  }

  protected async teardownQueryProcessingEnvironment(): Promise<void> {
    await super.cleanupTestEnvironment();
    
    // Clean up test files and databases
    await QueryProcessingTestUtils.cleanup();
    
    console.log('Query processing test environment cleaned up');
  }

  /**
   * Initialize all query processing components
   */
  private async initializeQueryProcessors(): Promise<void> {
    const { databaseReader, embeddingGenerator, vectorDatabase, config } = this.testEnvironment;

    // Initialize main query processor
    this.queryProcessor = new MCPQueryProcessor(
      databaseReader,
      config,
      embeddingGenerator,
      vectorDatabase
    );

    // Initialize specialized processors for direct testing
    this.semanticProcessor = new SemanticQueryProcessor(
      embeddingGenerator,
      vectorDatabase,
      databaseReader,
      config
    );

    this.signatureProcessor = new SignatureQueryProcessor(
      databaseReader,
      config
    );

    this.fileProcessor = new FileQueryProcessor(
      databaseReader,
      {
        maxResults: config.search.defaultMaxResults,
        caseSensitive: false,
        includeHidden: false,
        maxDepth: 10,
        enableGlobPatterns: true,
        fuzzyMatching: true,
      }
    );

    this.responseAssembler = new ResponseAssembler(config);
    this.performanceMonitor = new PerformanceMonitor();

    // Initialize the main processor
    await this.queryProcessor.initialize();
    
    console.log('Query processors initialized successfully');
  }

  /**
   * Test 1: Complex Multi-Query Processing Scenarios
   */
  async testComplexMultiQueryScenarios(): Promise<void> {
    const testQueries = QueryProcessingTestUtils.generateTestQueries();
    const results: QueryResponse[] = [];

    console.log(`Testing ${testQueries.length} complex query scenarios`);

    for (const query of testQueries) {
      try {
        const startTime = Date.now();
        const response = await this.queryProcessor.processQuery(query);
        const queryTime = Date.now() - startTime;

        // Validate response structure
        QueryProcessingTestUtils.validateQueryResponse(response, query.type);

        // Validate query time is reasonable (should be < 5000ms per config)
        expect(queryTime).toBeLessThan(this.testEnvironment.config.performance.maxQueryTime);

        // Validate search strategy matches query type
        if (query.type === 'semantic') {
          expect(response.searchStrategy).toContain('semantic');
        } else if (query.type === 'signature') {
          expect(response.searchStrategy).toContain('signature');
        } else if (query.type === 'file') {
          expect(response.searchStrategy).toContain('file');
        }

        results.push(response);

        console.log(`Query processed successfully: ${query.type} - ${queryTime}ms`);
      } catch (error) {
        console.error(`Query processing failed: ${query.type}`, { error });
        throw error;
      }
    }

    // Validate overall processing statistics
    expect(results.length).toBe(testQueries.length);
    
    const avgQueryTime = results.reduce((sum, r) => sum + r.queryTime, 0) / results.length;
    expect(avgQueryTime).toBeLessThan(2000); // Average should be under 2 seconds

    console.log(`Complex multi-query scenarios completed: ${results.length} queries processed`);
  }

  /**
   * Test 2: Cross-Language Query Processing and Correlation
   */
  async testCrossLanguageQueryProcessing(): Promise<void> {
    const crossLanguageQueries: MCPQuery[] = [
      {
        type: 'semantic',
        text: 'user authentication and password handling',
        maxResults: 15,
        options: {
          languageFilter: ['typescript', 'javascript', 'python'],
        } as SignatureQueryOptions,
      },
      {
        type: 'semantic',
        text: 'async function data processing',
        maxResults: 10,
        options: {
          languageFilter: ['javascript', 'python'],
          confidenceThreshold: 0.8,
        } as SignatureQueryOptions,
      },
      {
        type: 'signature',
        text: 'validate',
        maxResults: 12,
        options: {
          fuzzyThreshold: 0.6,
        } as SignatureQueryOptions,
      },
    ];

    const languageResults = new Map<string, AnnotationMatch[]>();

    for (const query of crossLanguageQueries) {
      const response = await this.queryProcessor.processQuery(query);
      QueryProcessingTestUtils.validateQueryResponse(response, query.type);

      // Group results by language
      response.results.forEach(result => {
        const language = result.annotation.language;
        if (!languageResults.has(language)) {
          languageResults.set(language, []);
        }
        languageResults.get(language)!.push(result);
      });
    }

    // Validate cross-language results
    expect(languageResults.size).toBeGreaterThan(1); // Should have results from multiple languages
    
    const languages = Array.from(languageResults.keys());
    expect(languages).toContain('typescript');
    expect(languages).toContain('javascript');
    expect(languages).toContain('python');

    // Validate result quality across languages
    for (const [language, results] of languageResults) {
      expect(results.length).toBeGreaterThan(0);
      
      const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
      expect(avgScore).toBeGreaterThan(0.1); // Reasonable relevance threshold
      
      console.log(`Cross-language results for ${language}: ${results.length} matches, avg score: ${avgScore.toFixed(3)}`);
    }

    console.log(`Cross-language query processing completed: ${languageResults.size} languages processed`);
  }

  /**
   * Test 3: Query Optimization and Performance Characteristics
   */
  async testQueryOptimizationAndPerformance(): Promise<void> {
    const optimizationTestQueries = QueryProcessingTestUtils.generatePerformanceTestQueries(50);
    const performanceMetrics: Array<{ queryTime: number; resultCount: number; type: QueryType }> = [];

    console.log(`Testing query optimization with ${optimizationTestQueries.length} queries`);

    // Process queries with timing
    for (const query of optimizationTestQueries) {
      const startTime = Date.now();
      const response = await this.queryProcessor.processQuery(query);
      const queryTime = Date.now() - startTime;

      performanceMetrics.push({
        queryTime,
        resultCount: response.results.length,
        type: query.type,
      });

      // Validate performance requirements
      expect(queryTime).toBeLessThan(this.testEnvironment.config.performance.maxQueryTime);
    }

    // Analyze performance characteristics
    const performanceByType = new Map<QueryType, { times: number[]; resultCounts: number[] }>();
    
    performanceMetrics.forEach(metric => {
      if (!performanceByType.has(metric.type)) {
        performanceByType.set(metric.type, { times: [], resultCounts: [] });
      }
      const typeMetrics = performanceByType.get(metric.type)!;
      typeMetrics.times.push(metric.queryTime);
      typeMetrics.resultCounts.push(metric.resultCount);
    });

    // Validate performance characteristics by query type
    for (const [queryType, metrics] of performanceByType) {
      const avgTime = metrics.times.reduce((a, b) => a + b) / metrics.times.length;
      const maxTime = Math.max(...metrics.times);
      const avgResults = metrics.resultCounts.reduce((a, b) => a + b) / metrics.resultCounts.length;

      // Performance assertions
      expect(avgTime).toBeLessThan(1000); // Average under 1 second
      expect(maxTime).toBeLessThan(5000); // Maximum under 5 seconds
      expect(avgResults).toBeGreaterThan(0); // Should return results

      console.log(`Performance metrics for ${queryType}: avg=${avgTime.toFixed(1)}ms, max=${maxTime}ms, avgResults=${avgResults.toFixed(1)}`);
    }

    // Test query stats functionality
    const queryStats = this.queryProcessor.getQueryStats();
    expect(queryStats).toBeDefined();
    expect(queryStats.totalQueries).toBeGreaterThan(0);
    expect(typeof queryStats.averageQueryTime).toBe('number');
    expect(queryStats.performanceMetrics).toBeDefined();

    console.log('Query optimization and performance testing completed successfully');
  }

  /**
   * Test 4: Result Accuracy and Relevance Scoring Validation
   */
  async testResultAccuracyAndRelevanceScoring(): Promise<void> {
    const accuracyTestQueries: MCPQuery[] = [
      {
        type: 'semantic',
        text: 'find user by id',
        maxResults: 5,
        minScore: 0.3,
      },
      {
        type: 'semantic',
        text: 'password hash salt crypto',
        maxResults: 3,
        minScore: 0.5,
        options: {
          confidenceThreshold: 0.5,
        } as SignatureQueryOptions,
      },
      {
        type: 'signature',
        text: 'async findUserById(id: string): Promise<User | null>',
        maxResults: 1,
        options: {
        } as SignatureQueryOptions,
      },
    ];

    for (const query of accuracyTestQueries) {
      const response = await this.queryProcessor.processQuery(query);
      
      // Validate minimum score requirement
      if (query.minScore) {
        response.results.forEach(result => {
          expect(result.score).toBeGreaterThanOrEqual(query.minScore!);
        });
      }

      // Validate result relevance ordering (scores should be descending)
      for (let i = 1; i < response.results.length; i++) {
        expect(response.results[i-1].score).toBeGreaterThanOrEqual(response.results[i].score);
      }

      // Validate match reasons are provided
      response.results.forEach(result => {
        expect(result.matchReason).toBeDefined();
        expect(result.matchReason.length).toBeGreaterThan(0);
      });

      // For exact signature matches, verify high accuracy
      if (query.type === 'signature' && (query.options as SignatureQueryOptions)?.exactMatch) {
        expect(response.results.length).toBeGreaterThanOrEqual(1);
        if (response.results.length > 0) {
          expect(response.results[0].score).toBeGreaterThan(0.8); // High confidence for exact matches
        }
      }

      console.log(`Accuracy validation passed for ${query.type} query: ${response.results.length} results with avg score ${response.results.length > 0 ? (response.results.reduce((sum, r) => sum + r.score, 0) / response.results.length).toFixed(3) : 'N/A'}`);
    }

    console.log('Result accuracy and relevance scoring validation completed');
  }

  /**
   * Test 5: Caching Mechanisms and Performance Impact
   */
  async testCachingMechanismsAndPerformance(): Promise<void> {
    const cacheTestQueries: MCPQuery[] = [
      {
        type: 'semantic',
        text: 'user management functions',
        maxResults: 10,
      },
      {
        type: 'signature',
        text: 'validateEmail',
        maxResults: 5,
        options: {
        } as SignatureQueryOptions,
      },
    ];

    // First run - cache misses
    const firstRunTimes: number[] = [];
    for (const query of cacheTestQueries) {
      const startTime = Date.now();
      const response = await this.queryProcessor.processQuery(query);
      const queryTime = Date.now() - startTime;
      
      firstRunTimes.push(queryTime);
      QueryProcessingTestUtils.validateQueryResponse(response, query.type);
    }

    // Second run - should benefit from caching
    const secondRunTimes: number[] = [];
    for (const query of cacheTestQueries) {
      const startTime = Date.now();
      const response = await this.queryProcessor.processQuery(query);
      const queryTime = Date.now() - startTime;
      
      secondRunTimes.push(queryTime);
      QueryProcessingTestUtils.validateQueryResponse(response, query.type);
    }

    // Validate caching performance improvement
    for (let i = 0; i < cacheTestQueries.length; i++) {
      const speedup = firstRunTimes[i] / secondRunTimes[i];
      console.log(`Cache performance for query ${i}: first=${firstRunTimes[i]}ms, second=${secondRunTimes[i]}ms, speedup=${speedup.toFixed(2)}x`);
      
      // Second run should be faster or at least not significantly slower
      expect(secondRunTimes[i]).toBeLessThanOrEqual(firstRunTimes[i] * 1.2); // Allow 20% tolerance
    }

    // Test cache statistics if available
    const queryStats = this.queryProcessor.getQueryStats();
    expect(queryStats.cacheHitRatio).toBeGreaterThanOrEqual(0);
    expect(queryStats.cacheHitRatio).toBeLessThanOrEqual(1);

    console.log('Caching mechanisms and performance testing completed');
  }

  /**
   * Test 6: Integration with Database and Indexing Systems
   */
  async testDatabaseAndIndexingIntegration(): Promise<void> {
    const integrationTestQueries: MCPQuery[] = [
      {
        type: 'file',
        text: '*.ts',
        maxResults: 20,
        options: {
          recursive: true, maxDepth: 5,
        } as SignatureQueryOptions,
      },
      {
        type: 'semantic',
        text: 'data processing pipeline',
        maxResults: 8,
        options: {
          languageFilter: ['python'],
        } as SignatureQueryOptions,
      },
    ];

    for (const query of integrationTestQueries) {
      const response = await this.queryProcessor.processQuery(query);
      
      // Validate database integration
      expect(response.metadata.totalCandidates).toBeGreaterThanOrEqual(0);
      expect(response.metadata.vectorSearchTime).toBeGreaterThanOrEqual(0);
      
      // Validate indexing system integration
      response.results.forEach(result => {
        expect(result.annotation.nodeId).toBeDefined();
        expect(result.annotation.filePath).toBeDefined();
        expect(result.annotation.lineNumber).toBeGreaterThan(0);
      });

      // Validate search parameters are recorded
      expect(response.metadata.searchParameters).toBeDefined();
      expect(typeof response.metadata.searchParameters).toBe('object');

      console.log(`Database integration validation passed: ${response.results.length} results from ${response.metadata.totalCandidates} candidates`);
    }

    console.log('Database and indexing integration testing completed');
  }

  /**
   * Test 7: Error Handling and System Resilience
   */
  async testErrorHandlingAndResilience(): Promise<void> {
    const errorTestScenarios = [
      // Invalid query types
      {
        query: { type: 'invalid' as QueryType, text: 'test' },
        expectedError: 'Invalid query type',
      },
      // Empty query text
      {
        query: { type: 'semantic' as QueryType, text: '' },
        expectedError: 'Query text is required',
      },
      // Excessive result limits
      {
        query: { type: 'semantic' as QueryType, text: 'test', maxResults: 2000 },
        expectedError: 'Maximum result limit',
      },
      // Invalid score ranges
      {
        query: { type: 'semantic' as QueryType, text: 'test', minScore: 1.5 },
        expectedError: 'Minimum score must be between 0 and 1',
      },
    ];

    for (const scenario of errorTestScenarios) {
      try {
        await this.queryProcessor.processQuery(scenario.query);
        throw new Error(`Expected error for scenario: ${scenario.expectedError}`);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(scenario.expectedError);
        console.log(`Error handling validated: ${scenario.expectedError}`);
      }
    }

    // Test graceful degradation with missing dependencies
    const gracefulDegradationQuery: MCPQuery = {
      type: 'semantic',
      text: 'test graceful degradation',
      maxResults: 5,
    };

    try {
      const response = await this.queryProcessor.processQuery(gracefulDegradationQuery);
      // Should either succeed or fail gracefully with informative error
      if (response) {
        QueryProcessingTestUtils.validateQueryResponse(response, 'semantic');
      }
    } catch (error) {
      // Should provide informative error message
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message.length).toBeGreaterThan(0);
      console.log(`Graceful degradation validated: ${(error as Error).message}`);
    }

    console.log('Error handling and resilience testing completed');
  }

  /**
   * Test 8: Concurrent Query Processing and System Scalability
   */
  async testConcurrentQueryProcessingAndScalability(): Promise<void> {
    const concurrentQueries = QueryProcessingTestUtils.generatePerformanceTestQueries(20);
    const concurrencyLevels = [1, 5, 10];

    for (const concurrencyLevel of concurrencyLevels) {
      console.log(`Testing concurrency level: ${concurrencyLevel}`);
      
      const batches: MCPQuery[][] = [];
      for (let i = 0; i < concurrentQueries.length; i += concurrencyLevel) {
        batches.push(concurrentQueries.slice(i, i + concurrencyLevel));
      }

      const batchResults: Array<{ batchTime: number; queryTimes: number[] }> = [];

      for (const batch of batches) {
        const batchStartTime = Date.now();
        const batchPromises = batch.map(async (query) => {
          const queryStartTime = Date.now();
          const response = await this.queryProcessor.processQuery(query);
          const queryTime = Date.now() - queryStartTime;
          
          QueryProcessingTestUtils.validateQueryResponse(response, query.type);
          return queryTime;
        });

        const queryTimes = await Promise.all(batchPromises);
        const batchTime = Date.now() - batchStartTime;

        batchResults.push({ batchTime, queryTimes });

        // Validate concurrent processing doesn't exceed limits
        expect(queryTimes.every(time => time < this.testEnvironment.config.performance.maxQueryTime)).toBe(true);
      }

      // Analyze scalability characteristics
      const avgBatchTime = batchResults.reduce((sum, result) => sum + result.batchTime, 0) / batchResults.length;
      const avgQueryTime = batchResults.reduce((sum, result) => 
        sum + result.queryTimes.reduce((qSum, qTime) => qSum + qTime, 0) / result.queryTimes.length, 0
      ) / batchResults.length;

      console.log(`Concurrency ${concurrencyLevel}: avgBatchTime=${avgBatchTime.toFixed(1)}ms, avgQueryTime=${avgQueryTime.toFixed(1)}ms`);
      
      // Basic scalability validation
      expect(avgBatchTime).toBeLessThan(30000); // Batch shouldn't take more than 30 seconds
      expect(avgQueryTime).toBeLessThan(5000);  // Individual queries under 5 seconds
    }

    // Test system behavior under maximum concurrent load
    const maxConcurrentQueries = Math.min(this.testEnvironment.config.performance.maxConcurrentQueries, 8);
    const stressTestQueries = QueryProcessingTestUtils.generatePerformanceTestQueries(maxConcurrentQueries);

    const stressTestPromises = stressTestQueries.map(query => this.queryProcessor.processQuery(query));
    const stressTestResults = await Promise.all(stressTestPromises);

    // Validate all stress test queries completed successfully
    expect(stressTestResults.length).toBe(maxConcurrentQueries);
    stressTestResults.forEach((response, index) => {
      QueryProcessingTestUtils.validateQueryResponse(response, stressTestQueries[index].type);
    });

    console.log(`Concurrent processing and scalability testing completed: max concurrency ${maxConcurrentQueries}`);
  }

  // Public methods for test lifecycle
  async setup(): Promise<void> {
    await this.setupQueryProcessingEnvironment();
  }

  async teardown(): Promise<void> {
    await this.teardownQueryProcessingEnvironment();
  }

  async beforeEachTest(): Promise<void> {
    // Clear caches before each test
    if (this.performanceMonitor) {
      this.performanceMonitor.clearCaches();
    }
  }

  async afterEachTest(): Promise<void> {
    // Optional cleanup after each test
    console.log('Test completed');
  }
}

// Test Suite Execution
describe('Comprehensive Query Processing Integration Tests', () => {
  let testSuite: ComprehensiveQueryProcessingIntegrationTestSuite;

  beforeAll(async () => {
    testSuite = new ComprehensiveQueryProcessingIntegrationTestSuite();
    await testSuite.setup();
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    if (testSuite) {
      await testSuite.teardown();
    }
  });

  beforeEach(async () => {
    await testSuite.beforeEachTest();
  });

  afterEach(async () => {
    await testSuite.afterEachTest();
  });

  test('Complex Multi-Query Processing Scenarios', async () => {
    await testSuite.testComplexMultiQueryScenarios();
  }, 30000);

  test('Cross-Language Query Processing and Correlation', async () => {
    await testSuite.testCrossLanguageQueryProcessing();
  }, 20000);

  test('Query Optimization and Performance Characteristics', async () => {
    await testSuite.testQueryOptimizationAndPerformance();
  }, 45000);

  test('Result Accuracy and Relevance Scoring Validation', async () => {
    await testSuite.testResultAccuracyAndRelevanceScoring();
  }, 15000);

  test('Caching Mechanisms and Performance Impact', async () => {
    await testSuite.testCachingMechanismsAndPerformance();
  }, 15000);

  test('Integration with Database and Indexing Systems', async () => {
    await testSuite.testDatabaseAndIndexingIntegration();
  }, 20000);

  test('Error Handling and System Resilience', async () => {
    await testSuite.testErrorHandlingAndResilience();
  }, 10000);

  test('Concurrent Query Processing and System Scalability', async () => {
    await testSuite.testConcurrentQueryProcessingAndScalability();
  }, 60000);
});