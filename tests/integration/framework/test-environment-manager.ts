import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawn, ChildProcess } from 'child_process';

/**
 * Environment configuration for integration tests
 */
export interface TestEnvironment {
  tempDir: string;
  configPath: string;
  databasePath: string;
  serverPort?: number;
  debugMode: boolean;
  cleanup: () => Promise<void>;
}

/**
 * Service configuration for mock services
 */
export interface ServiceConfig {
  name: string;
  port: number;
  process?: ChildProcess;
  healthCheckUrl?: string;
  startCommand?: string[];
  env?: Record<string, string>;
}

/**
 * Test environment manager for setting up isolated test environments
 */
export class TestEnvironmentManager {
  private environments = new Map<string, TestEnvironment>();
  private services = new Map<string, ServiceConfig>();
  private cleanupHandlers: (() => Promise<void>)[] = [];

  /**
   * Create an isolated test environment
   */
  async createEnvironment(name: string, options?: {
    useDatabase?: boolean;
    enableDebug?: boolean;
    configOverrides?: Record<string, any>;
  }): Promise<TestEnvironment> {
    const tempDir = await fs.mkdtemp(join(tmpdir(), `integration-test-${name}-`));
    const configPath = join(tempDir, 'config.json');
    const databasePath = join(tempDir, 'test.db');

    // Create basic configuration
    const config = {
      database: {
        path: databasePath,
        type: 'sqlite',
      },
      server: {
        port: await this.findAvailablePort(),
      },
      logging: {
        level: options?.enableDebug ? 'debug' : 'warn',
        file: join(tempDir, 'test.log'),
      },
      testing: true,
      ...options?.configOverrides,
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    // Initialize database if needed
    if (options?.useDatabase) {
      await this.initializeTestDatabase(databasePath);
    }

    const environment: TestEnvironment = {
      tempDir,
      configPath,
      databasePath,
      serverPort: config.server.port,
      debugMode: options?.enableDebug || false,
      cleanup: async () => {
        await this.cleanupEnvironment(tempDir);
      },
    };

    this.environments.set(name, environment);
    return environment;
  }

  /**
   * Start a mock service for testing
   */
  async startService(config: ServiceConfig): Promise<void> {
    if (!config.startCommand) {
      throw new Error(`No start command specified for service: ${config.name}`);
    }

    return new Promise((resolve, reject) => {
      const [command, ...args] = config.startCommand!;
      const childProcess = spawn(command, args, {
        env: { ...process.env, ...config.env },
        stdio: config.name.includes('debug') ? 'inherit' : 'pipe',
      });

      config.process = childProcess;

      childProcess.on('error', (error: Error) => {
        reject(new Error(`Failed to start service ${config.name}: ${error.message}`));
      });

      // Wait for service to be ready
      const startTimeout = setTimeout(() => {
        reject(new Error(`Service ${config.name} failed to start within timeout`));
      }, 10000);

      if (config.healthCheckUrl) {
        this.waitForHealthCheck(config.healthCheckUrl, 10000)
          .then(() => {
            clearTimeout(startTimeout);
            resolve();
          })
          .catch((error) => {
            clearTimeout(startTimeout);
            reject(error);
          });
      } else {
        // Simple delay-based startup
        setTimeout(() => {
          clearTimeout(startTimeout);
          resolve();
        }, 2000);
      }

      this.services.set(config.name, config);
    });
  }

  /**
   * Stop a running service
   */
  async stopService(name: string): Promise<void> {
    const service = this.services.get(name);
    if (!service || !service.process) {
      return;
    }

    return new Promise((resolve) => {
      service.process!.on('exit', () => {
        resolve();
      });

      service.process!.kill('SIGTERM');

      // Force kill after timeout
      setTimeout(() => {
        if (service.process && !service.process.killed) {
          service.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);
    });
  }

  /**
   * Get environment by name
   */
  getEnvironment(name: string): TestEnvironment | undefined {
    return this.environments.get(name);
  }

  /**
   * Clean up all environments and services
   */
  async cleanupAll(): Promise<void> {
    // Stop all services
    const stopPromises = Array.from(this.services.keys()).map(name => 
      this.stopService(name)
    );
    await Promise.allSettled(stopPromises);

    // Clean up environments
    const cleanupPromises = Array.from(this.environments.values()).map(env => 
      env.cleanup()
    );
    await Promise.allSettled(cleanupPromises);

    // Run custom cleanup handlers
    const handlerPromises = this.cleanupHandlers.map(handler => handler());
    await Promise.allSettled(handlerPromises);

    this.environments.clear();
    this.services.clear();
    this.cleanupHandlers = [];
  }

  /**
   * Add custom cleanup handler
   */
  addCleanupHandler(handler: () => Promise<void>): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Copy test fixtures to environment
   */
  async copyTestFixtures(environmentName: string, fixturesPath: string): Promise<void> {
    const environment = this.environments.get(environmentName);
    if (!environment) {
      throw new Error(`Environment not found: ${environmentName}`);
    }

    const targetPath = join(environment.tempDir, 'fixtures');
    await this.copyDirectory(fixturesPath, targetPath);
  }

  /**
   * Set environment variables for testing
   */
  setTestEnvironmentVariables(variables: Record<string, string>): void {
    for (const [key, value] of Object.entries(variables)) {
      process.env[key] = value;
    }

    // Add cleanup to restore original values
    this.addCleanupHandler(async () => {
      for (const key of Object.keys(variables)) {
        delete process.env[key];
      }
    });
  }

  private async findAvailablePort(): Promise<number> {
    const { createServer } = await import('net');
    
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.listen(0, () => {
        const port = (server.address() as any)?.port;
        server.close(() => {
          resolve(port);
        });
      });
      
      server.on('error', reject);
    });
  }

  private async waitForHealthCheck(url: string, timeout: number): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        // Use built-in fetch if available (Node.js 18+) or fallback to http module
        const response = await this.makeHttpRequest(url);
        if (response.ok) {
          return;
        }
      } catch (error) {
        // Service not ready yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    throw new Error(`Health check failed for ${url} within ${timeout}ms`);
  }

  private async makeHttpRequest(url: string): Promise<{ ok: boolean }> {
    // Simple HTTP request implementation using Node.js built-in modules
    const { request } = await import('http');
    const urlObj = new URL(url);
    
    return new Promise((resolve, reject) => {
      const req = request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: 'GET',
      }, (res) => {
        resolve({ ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300 });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
  }

  private async initializeTestDatabase(databasePath: string): Promise<void> {
    // This would initialize a test database with schema
    // For now, just create an empty file
    await fs.writeFile(databasePath, '');
  }

  private async cleanupEnvironment(tempDir: string): Promise<void> {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to cleanup test environment ${tempDir}:`, error);
    }
  }

  private async copyDirectory(source: string, target: string): Promise<void> {
    await fs.mkdir(target, { recursive: true });
    
    const items = await fs.readdir(source, { withFileTypes: true });
    
    for (const item of items) {
      const sourcePath = join(source, item.name);
      const targetPath = join(target, item.name);
      
      if (item.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath);
      } else {
        await fs.copyFile(sourcePath, targetPath);
      }
    }
  }
}

/**
 * Test data generator for creating consistent test data
 */
export class TestDataGenerator {
  private static counter = 0;

  /**
   * Generate a unique test ID
   */
  static generateTestId(): string {
    return `test-${Date.now()}-${++this.counter}`;
  }

  /**
   * Generate sample file content for testing
   */
  static generateSampleFile(language: string, size: 'small' | 'medium' | 'large' = 'small'): string {
    const templates = {
      javascript: {
        small: `
function hello(name) {
  return \`Hello, \${name}!\`;
}

module.exports = { hello };
        `.trim(),
        medium: this.generateJavaScriptMedium(),
        large: this.generateJavaScriptLarge(),
      },
      python: {
        small: `
def hello(name):
    return f"Hello, {name}!"

if __name__ == "__main__":
    print(hello("World"))
        `.trim(),
        medium: this.generatePythonMedium(),
        large: this.generatePythonLarge(),
      },
      typescript: {
        small: `
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  return \`Hello, \${user.name}!\`;
}

export { User, greet };
        `.trim(),
        medium: this.generateTypeScriptMedium(),
        large: this.generateTypeScriptLarge(),
      },
    };

    return templates[language as keyof typeof templates]?.[size] || templates.javascript[size];
  }

  /**
   * Generate sample repository structure
   */
  static async generateSampleRepository(basePath: string, structure: {
    files: Array<{ path: string; language: string; size?: 'small' | 'medium' | 'large' }>;
    directories: string[];
  }): Promise<void> {
    // Create directories
    for (const dir of structure.directories) {
      await fs.mkdir(join(basePath, dir), { recursive: true });
    }

    // Create files
    for (const file of structure.files) {
      const content = this.generateSampleFile(file.language, file.size);
      await fs.writeFile(join(basePath, file.path), content);
    }
  }

  private static generateJavaScriptMedium(): string {
    return `
const express = require('express');
const app = express();

class UserManager {
  constructor() {
    this.users = new Map();
  }

  addUser(id, data) {
    this.users.set(id, data);
    return data;
  }

  getUser(id) {
    return this.users.get(id);
  }

  updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) throw new Error('User not found');
    
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }
}

const userManager = new UserManager();

app.get('/users/:id', (req, res) => {
  const user = userManager.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

module.exports = { app, UserManager };
    `.trim();
  }

  private static generateJavaScriptLarge(): string {
    return `
// Large JavaScript file with multiple classes and complex logic
const EventEmitter = require('events');
const crypto = require('crypto');

class DatabaseConnection extends EventEmitter {
  constructor(options = {}) {
    super();
    this.host = options.host || 'localhost';
    this.port = options.port || 5432;
    this.database = options.database || 'testdb';
    this.connected = false;
    this.queries = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        this.connected = true;
        this.emit('connected');
        resolve(true);
      }, Math.random() * 1000);
    });
  }

  async query(sql, params = []) {
    if (!this.connected) throw new Error('Not connected');
    
    const queryId = crypto.randomUUID();
    const startTime = Date.now();
    
    this.queries.set(queryId, { sql, params, startTime });
    
    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    const result = {
      queryId,
      duration: Date.now() - startTime,
      rows: this.mockQueryResult(sql)
    };
    
    this.queries.delete(queryId);
    return result;
  }

  mockQueryResult(sql) {
    if (sql.toLowerCase().includes('select')) {
      return Array.from({ length: Math.floor(Math.random() * 10) }, (_, i) => ({
        id: i + 1,
        name: \`Record \${i + 1}\`,
        created: new Date().toISOString()
      }));
    }
    return { affected: Math.floor(Math.random() * 5) };
  }
}

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };
  }

  get(key) {
    if (this.cache.has(key)) {
      this.stats.hits++;
      return this.cache.get(key);
    }
    this.stats.misses++;
    return null;
  }

  set(key, value, ttl = 300000) {
    this.cache.set(key, value);
    setTimeout(() => this.cache.delete(key), ttl);
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = { DatabaseConnection, CacheManager };
    `.trim();
  }

  private static generatePythonMedium(): string {
    return `
import json
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime

@dataclass
class User:
    id: str
    name: str
    email: str
    created_at: datetime
    
    def to_dict(self) -> Dict:
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'created_at': self.created_at.isoformat()
        }

class UserRepository:
    def __init__(self):
        self._users: Dict[str, User] = {}
    
    def create_user(self, name: str, email: str) -> User:
        user_id = f"user_{len(self._users) + 1}"
        user = User(
            id=user_id,
            name=name,
            email=email,
            created_at=datetime.now()
        )
        self._users[user_id] = user
        return user
    
    def get_user(self, user_id: str) -> Optional[User]:
        return self._users.get(user_id)
    
    def list_users(self) -> List[User]:
        return list(self._users.values())
    
    def update_user(self, user_id: str, **updates) -> Optional[User]:
        user = self._users.get(user_id)
        if not user:
            return None
        
        for field, value in updates.items():
            if hasattr(user, field):
                setattr(user, field, value)
        
        return user

if __name__ == "__main__":
    repo = UserRepository()
    user = repo.create_user("John Doe", "john@example.com")
    print(f"Created user: {user.to_dict()}")
    `.trim();
  }

  private static generatePythonLarge(): string {
    return `
# Large Python file with comprehensive class hierarchy and methods
import asyncio
import logging
import json
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import hashlib

logger = logging.getLogger(__name__)

class EventType(Enum):
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_DELETED = "user_deleted"
    DATA_PROCESSED = "data_processed"

@dataclass
class Event:
    type: EventType
    data: Dict[str, Any]
    timestamp: datetime = field(default_factory=datetime.now)
    event_id: str = field(default_factory=lambda: hashlib.md5(str(datetime.now()).encode()).hexdigest())

class EventHandler(ABC):
    @abstractmethod
    async def handle(self, event: Event) -> None:
        pass

class LoggingEventHandler(EventHandler):
    async def handle(self, event: Event) -> None:
        logger.info(f"Event {event.type.value}: {event.event_id}")

class MetricsEventHandler(EventHandler):
    def __init__(self):
        self.event_counts: Dict[EventType, int] = {}
    
    async def handle(self, event: Event) -> None:
        self.event_counts[event.type] = self.event_counts.get(event.type, 0) + 1

class EventBus:
    def __init__(self):
        self._handlers: Dict[EventType, List[EventHandler]] = {}
        self._middleware: List[Callable[[Event], Event]] = []
    
    def subscribe(self, event_type: EventType, handler: EventHandler):
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
    
    def add_middleware(self, middleware: Callable[[Event], Event]):
        self._middleware.append(middleware)
    
    async def publish(self, event: Event):
        # Apply middleware
        for middleware in self._middleware:
            event = middleware(event)
        
        # Handle event
        handlers = self._handlers.get(event.type, [])
        tasks = [handler.handle(event) for handler in handlers]
        if tasks:
            await asyncio.gather(*tasks)

class DataProcessor:
    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
        self.processing_stats = {
            'total_processed': 0,
            'errors': 0,
            'last_processed': None
        }
    
    async def process_data(self, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        start_time = datetime.now()
        processed_items = []
        errors = []
        
        for item in data:
            try:
                processed_item = await self._process_single_item(item)
                processed_items.append(processed_item)
                self.processing_stats['total_processed'] += 1
            except Exception as e:
                errors.append({'item': item, 'error': str(e)})
                self.processing_stats['errors'] += 1
        
        self.processing_stats['last_processed'] = datetime.now()
        
        # Publish event
        event = Event(
            type=EventType.DATA_PROCESSED,
            data={
                'processed_count': len(processed_items),
                'error_count': len(errors),
                'duration_ms': (datetime.now() - start_time).total_seconds() * 1000
            }
        )
        await self.event_bus.publish(event)
        
        return {
            'processed': processed_items,
            'errors': errors,
            'stats': self.processing_stats
        }
    
    async def _process_single_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        # Simulate processing time
        await asyncio.sleep(0.01)
        
        # Add processing metadata
        return {
            **item,
            'processed_at': datetime.now().isoformat(),
            'processor_id': 'data_processor_1'
        }

async def main():
    # Setup event system
    event_bus = EventBus()
    logging_handler = LoggingEventHandler()
    metrics_handler = MetricsEventHandler()
    
    event_bus.subscribe(EventType.DATA_PROCESSED, logging_handler)
    event_bus.subscribe(EventType.DATA_PROCESSED, metrics_handler)
    
    # Process some data
    processor = DataProcessor(event_bus)
    sample_data = [
        {'id': i, 'value': f'item_{i}', 'category': 'test'}
        for i in range(100)
    ]
    
    result = await processor.process_data(sample_data)
    print(f"Processed {len(result['processed'])} items with {len(result['errors'])} errors")

if __name__ == "__main__":
    asyncio.run(main())
    `.trim();
  }

  private static generateTypeScriptMedium(): string {
    return `
interface Repository<T> {
  create(item: T): Promise<T>;
  findById(id: string): Promise<T | null>;
  update(id: string, updates: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

class UserRepository implements Repository<User> {
  private users = new Map<string, User>();

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const user: User = {
      ...userData,
      id: \`user_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.users.set(user.id, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date(),
    };

    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  async findAll(): Promise<User[]> {
    return Array.from(this.users.values());
  }
}

export { Repository, User, UserRepository };
    `.trim();
  }

  private static generateTypeScriptLarge(): string {
    return `
// Large TypeScript file with complex type system and async operations
import { EventEmitter } from 'events';

type EventMap = {
  data: [data: any];
  error: [error: Error];
  complete: [];
  progress: [completed: number, total: number];
};

interface AsyncOperation<T> {
  execute(): Promise<T>;
  cancel(): void;
  onProgress(callback: (completed: number, total: number) => void): void;
}

abstract class BaseAsyncOperation<T> extends EventEmitter implements AsyncOperation<T> {
  protected cancelled = false;
  protected completed = 0;
  protected total = 100;

  abstract execute(): Promise<T>;

  cancel(): void {
    this.cancelled = true;
    this.emit('cancelled');
  }

  onProgress(callback: (completed: number, total: number) => void): void {
    this.on('progress', callback);
  }

  protected updateProgress(completed: number): void {
    this.completed = completed;
    this.emit('progress', completed, this.total);
  }

  protected checkCancellation(): void {
    if (this.cancelled) {
      throw new Error('Operation was cancelled');
    }
  }
}

class DataProcessingOperation extends BaseAsyncOperation<ProcessingResult> {
  constructor(
    private data: any[],
    private processor: DataProcessor,
    private options: ProcessingOptions = {}
  ) {
    super();
    this.total = data.length;
  }

  async execute(): Promise<ProcessingResult> {
    const startTime = Date.now();
    const results: any[] = [];
    const errors: ProcessingError[] = [];

    for (let i = 0; i < this.data.length; i++) {
      this.checkCancellation();

      try {
        const item = this.data[i];
        const processed = await this.processor.processItem(item, this.options);
        results.push(processed);
        
        this.updateProgress(i + 1);
        
        // Simulate processing delay
        if (this.options.simulateDelay) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      } catch (error) {
        errors.push({
          index: i,
          item: this.data[i],
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }

    const endTime = Date.now();
    const result: ProcessingResult = {
      results,
      errors,
      stats: {
        totalItems: this.data.length,
        successfulItems: results.length,
        failedItems: errors.length,
        duration: endTime - startTime,
        throughput: this.data.length / ((endTime - startTime) / 1000)
      }
    };

    this.emit('complete');
    return result;
  }
}

interface ProcessingOptions {
  batchSize?: number;
  concurrency?: number;
  simulateDelay?: boolean;
  validateResults?: boolean;
}

interface ProcessingError {
  index: number;
  item: any;
  error: Error;
}

interface ProcessingResult {
  results: any[];
  errors: ProcessingError[];
  stats: ProcessingStats;
}

interface ProcessingStats {
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  duration: number;
  throughput: number;
}

class DataProcessor {
  private processingCount = 0;
  private maxConcurrency: number;

  constructor(maxConcurrency = 10) {
    this.maxConcurrency = maxConcurrency;
  }

  async processItem(item: any, options: ProcessingOptions = {}): Promise<any> {
    // Throttle processing
    while (this.processingCount >= this.maxConcurrency) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    this.processingCount++;

    try {
      // Simulate complex processing
      const processed = await this.performProcessing(item, options);
      
      if (options.validateResults && !this.validateResult(processed)) {
        throw new Error('Validation failed for processed item');
      }

      return processed;
    } finally {
      this.processingCount--;
    }
  }

  private async performProcessing(item: any, options: ProcessingOptions): Promise<any> {
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

    return {
      ...item,
      processed: true,
      processedAt: new Date().toISOString(),
      hash: this.generateHash(item),
      metadata: {
        processor: 'DataProcessor',
        version: '1.0.0',
        options: JSON.stringify(options)
      }
    };
  }

  private validateResult(result: any): boolean {
    return result && typeof result === 'object' && result.processed === true;
  }

  private generateHash(item: any): string {
    const str = JSON.stringify(item);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}

class OperationManager {
  private operations = new Map<string, AsyncOperation<any>>();

  startOperation<T>(
    id: string, 
    operation: AsyncOperation<T>
  ): Promise<T> {
    this.operations.set(id, operation);

    return operation.execute().finally(() => {
      this.operations.delete(id);
    });
  }

  cancelOperation(id: string): boolean {
    const operation = this.operations.get(id);
    if (operation) {
      operation.cancel();
      return true;
    }
    return false;
  }

  getActiveOperations(): string[] {
    return Array.from(this.operations.keys());
  }
}

export {
  AsyncOperation,
  BaseAsyncOperation,
  DataProcessingOperation,
  DataProcessor,
  OperationManager,
  ProcessingOptions,
  ProcessingResult,
  ProcessingStats
};
    `.trim();
  }
}