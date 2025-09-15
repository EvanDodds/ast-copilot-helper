# Development Guide

This guide covers the development workflow, architecture details, testing strategies, and contribution guidelines for the AST MCP Server.

## Table of Contents

- [Development Setup](#development-setup)
- [Architecture Deep Dive](#architecture-deep-dive)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Debugging Guide](#debugging-guide)
- [Performance Optimization](#performance-optimization)
- [Contributing](#contributing)
- [Release Process](#release-process)

## Development Setup

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **TypeScript** >= 5.0.0
- **Git** for version control

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/ast-copilot-helper.git
cd ast-copilot-helper

# Install dependencies
yarn install

# Build all packages
yarn run build

# Navigate to MCP server package
cd packages/ast-mcp-server

# Install package-specific dependencies
yarn install

# Build the server
yarn run build

# Run tests
npm test

# Start development server
yarn run dev
```

### Development Dependencies

The project uses several key development tools:

```json
{
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "prettier": "^3.0.0",
    "nodemon": "^3.0.0"
  }
}
```

### Project Structure

```
packages/ast-mcp-server/
├── src/
│   ├── cli.ts                 # Command-line interface
│   ├── server.ts              # Main server implementation
│   ├── types.ts               # Shared type definitions
│   ├── config/                # Configuration management
│   │   ├── types.ts           # Configuration types
│   │   ├── defaults.ts        # Default configurations
│   │   ├── validator.ts       # Configuration validation
│   │   ├── loader.ts          # Configuration loading
│   │   └── index.ts           # Configuration exports
│   ├── mcp/                   # MCP protocol implementation
│   │   ├── protocol/          # Core protocol types & handlers
│   │   ├── transport/         # Transport layer implementations
│   │   ├── tools/             # Tool system
│   │   └── resources/         # Resource system
│   ├── database/              # Database layer
│   │   ├── manager.ts         # Database manager
│   │   ├── models/            # Data models
│   │   └── migrations/        # Database migrations
│   └── query/                 # Query processing
├── docs/                      # Documentation
├── bin/                       # Executable scripts
├── test/                      # Test files (mirrors src/ structure)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Architecture Deep Dive

### Layered Architecture

The AST MCP Server follows a strict layered architecture pattern:

```
┌─────────────────────────────────────────┐
│          Presentation Layer             │
│            (CLI, Server)                │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│          Application Layer              │
│      (Request Handlers, Routing)       │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│           Service Layer                 │
│    (Tools, Resources, Configuration)   │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│          Integration Layer              │
│   (Transport, Connection Management)   │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│            Data Layer                   │
│       (Database, File System)          │
└─────────────────────────────────────────┘
```

### Core Components

#### 1. Configuration System

**Location:** `src/config/`

**Purpose:** Manages all server configuration with support for multiple sources (file, environment, programmatic) and hot-reloading.

**Key Classes:**
- `ConfigManager`: Central configuration management
- `ConfigValidator`: Configuration validation and constraint checking
- `ConfigDefaults`: Environment-specific default configurations

**Design Patterns:**
- **Strategy Pattern**: Different configuration sources
- **Observer Pattern**: Configuration change notifications
- **Factory Pattern**: Environment-specific configuration creation

```typescript
// Example usage
const configManager = new ConfigManager();
await configManager.loadConfig({
  configFile: './config.json',
  environment: 'production'
});

configManager.on('config:updated', (newConfig, oldConfig) => {
  console.log('Configuration updated');
});
```

#### 2. MCP Protocol Core

**Location:** `src/mcp/protocol/`

**Purpose:** Implements the Model Context Protocol specification for JSON-RPC 2.0 communication.

**Key Components:**
- `MCPServer`: Main protocol server implementation
- `RequestHandler`: Handles incoming requests
- `ResponseManager`: Manages response formatting
- `ErrorHandler`: Centralized error handling

**Message Flow:**
```
Client Request → Transport → Protocol Router → Handler → Response → Transport → Client
```

#### 3. Transport Layer

**Location:** `src/mcp/transport/`

**Purpose:** Abstracts different communication mechanisms (STDIO, WebSocket, HTTP).

**Key Classes:**
- `Transport`: Abstract transport interface
- `StdioTransport`: Standard input/output transport
- `WebSocketTransport`: WebSocket-based transport
- `TransportManager`: Transport lifecycle management

**Transport Interface:**
```typescript
interface Transport extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
  send(message: MCPMessage): Promise<void>;
  isConnected(): boolean;
}
```

#### 4. Tool System

**Location:** `src/mcp/tools/`

**Purpose:** Manages available tools, their registration, validation, and execution.

**Key Components:**
- `ToolRegistry`: Central tool registration and discovery
- `ToolExecutor`: Tool execution and result formatting
- `ToolValidator`: Input validation and schema checking

**Tool Registration Example:**
```typescript
toolRegistry.registerTool({
  name: 'parse_file',
  description: 'Parse a file into AST',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string' },
      includeComments: { type: 'boolean' }
    },
    required: ['filePath']
  },
  handler: async (params) => {
    // Tool implementation
  }
});
```

#### 5. Resource System

**Location:** `src/mcp/resources/`

**Purpose:** Provides URI-based access to analyzed data and computed resources.

**Key Components:**
- `ResourceManager`: Resource registration and serving
- `ResourceProvider`: Base class for resource providers
- `URIResolver`: Resolves resource URIs to providers

**Resource Provider Example:**
```typescript
class ASTResourceProvider extends ResourceProvider {
  getScheme(): string {
    return 'ast';
  }

  async readResource(uri: string): Promise<Resource> {
    // Resource implementation
  }
}
```

#### 6. Database Layer

**Location:** `src/database/`

**Purpose:** Handles persistent storage of AST data, analysis results, and search indices.

**Key Components:**
- `DatabaseManager`: Database connection and query management
- `ASTModel`: AST storage and retrieval
- `SearchIndex`: Full-text and semantic search indexing

### Design Patterns Used

#### 1. Factory Pattern
Used for creating environment-specific configurations and transport instances.

```typescript
class TransportFactory {
  static create(type: TransportType, config: TransportConfig): Transport {
    switch (type) {
      case 'stdio': return new StdioTransport(config);
      case 'websocket': return new WebSocketTransport(config);
      default: throw new Error(`Unsupported transport: ${type}`);
    }
  }
}
```

#### 2. Observer Pattern
Used for configuration changes and server events.

```typescript
class ConfigManager extends EventEmitter {
  updateConfig(changes: Partial<Config>): void {
    const oldConfig = this.config;
    this.config = { ...oldConfig, ...changes };
    this.emit('config:updated', this.config, oldConfig);
  }
}
```

#### 3. Strategy Pattern
Used for different parsing strategies and transport implementations.

```typescript
interface ParsingStrategy {
  parse(content: string, options?: ParseOptions): AST;
}

class TypeScriptParsingStrategy implements ParsingStrategy {
  parse(content: string, options?: ParseOptions): AST {
    // TypeScript-specific parsing logic
  }
}
```

#### 4. Decorator Pattern
Used for adding cross-cutting concerns like logging and validation.

```typescript
function withLogging<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: any[]) => {
    console.log(`Calling ${fn.name} with args:`, args);
    const result = fn(...args);
    console.log(`Result:`, result);
    return result;
  }) as T;
}
```

## Development Workflow

### Git Workflow

We follow the **Git Flow** branching model:

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Individual feature branches
- `release/*`: Release preparation branches
- `hotfix/*`: Emergency fixes for production

### Branch Naming Convention

```
feature/issue-123-add-semantic-search
bugfix/issue-456-fix-parser-crash
hotfix/issue-789-security-vulnerability
release/v1.2.0
```

### Commit Message Format

We use **Conventional Commits** specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(tools): add semantic search functionality

Add semantic search tool that uses embeddings to find 
relevant code snippets based on natural language queries.

Closes #123

fix(parser): handle malformed TypeScript interfaces

Previously the parser would crash when encountering 
certain malformed interface declarations.

Fixes #456
```

### Development Workflow Steps

1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/issue-123-add-feature
   ```

2. **Implement Feature**
   - Write tests first (TDD approach)
   - Implement the feature
   - Ensure all tests pass
   - Update documentation

3. **Code Quality Checks**
   ```bash
   yarn run lint          # ESLint checks
   yarn run format        # Prettier formatting
   yarn run type-check    # TypeScript type checking
   npm test              # Run all tests
   yarn run coverage      # Generate coverage report
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat(tools): add semantic search functionality"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/issue-123-add-feature
   # Create Pull Request on GitHub
   ```

6. **Code Review Process**
   - Automated checks must pass
   - At least 2 reviewers must approve
   - Address review feedback
   - Merge into develop

### Code Style Guidelines

#### TypeScript Style

```typescript
// ✅ Good: Explicit types, clear naming
interface ParseFileParams {
  readonly filePath: string;
  readonly includeComments?: boolean;
  readonly parseOptions?: ParseOptions;
}

class ASTParser {
  private readonly cache = new Map<string, AST>();
  
  public async parseFile(params: ParseFileParams): Promise<ParseResult> {
    const { filePath, includeComments = false } = params;
    
    if (this.cache.has(filePath)) {
      return this.getCachedResult(filePath);
    }
    
    const content = await this.readFile(filePath);
    const ast = this.parseContent(content, { includeComments });
    
    this.cache.set(filePath, ast);
    return { success: true, ast };
  }
}

// ❌ Avoid: Implicit types, unclear naming
class Parser {
  cache = new Map();
  
  async parse(path, opts = {}) {
    if (this.cache.has(path)) return this.cache.get(path);
    const content = await fs.readFile(path);
    const result = someParser.parse(content, opts);
    this.cache.set(path, result);
    return result;
  }
}
```

#### Error Handling

```typescript
// ✅ Good: Specific error types, proper error context
class ParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly line: number,
    public readonly column: number
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

async function parseFile(filePath: string): Promise<AST> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return parser.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ParseError(
        `Syntax error in ${filePath}`,
        filePath,
        error.line,
        error.column
      );
    }
    throw error; // Re-throw unexpected errors
  }
}
```

## Testing Strategy

### Testing Pyramid

Our testing strategy follows the testing pyramid:

```
        ┌─────────┐
        │   E2E   │ ← Few, high-value integration tests
        │  Tests  │
        └─────────┘
      ┌─────────────┐
      │ Integration │ ← Medium number of component tests
      │    Tests    │
      └─────────────┘
    ┌─────────────────┐
    │   Unit Tests    │ ← Many fast, focused tests
    └─────────────────┘
```

### Test Categories

#### 1. Unit Tests
**Purpose:** Test individual functions and classes in isolation.
**Location:** `src/**/__tests__/*.test.ts`
**Runner:** Vitest

```typescript
// Example: src/config/__tests__/validator.test.ts
import { describe, it, expect } from 'vitest';
import { validateConfig } from '../validator';

describe('ConfigValidator', () => {
  describe('validateConfig', () => {
    it('should validate complete configuration', () => {
      const config = {
        name: 'Test Server',
        version: '1.0.0',
        transport: { type: 'stdio' },
        // ... complete config
      };
      
      const result = validateConfig(config);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid port numbers', () => {
      const config = {
        transport: { type: 'websocket', port: 70000 }
      };
      
      const result = validateConfig(config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Port must be between 1 and 65535');
    });
  });
});
```

#### 2. Integration Tests
**Purpose:** Test component interactions and API endpoints.
**Location:** `test/integration/`

```typescript
// Example: test/integration/mcp-server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPServer } from '../src/server';
import { StdioTransport } from '../src/mcp/transport/stdio';

describe('MCP Server Integration', () => {
  let server: MCPServer;
  
  beforeEach(async () => {
    server = new MCPServer({
      transport: { type: 'stdio' },
      database: { path: ':memory:' }
    });
    await server.start();
  });
  
  afterEach(async () => {
    await server.stop();
  });
  
  it('should handle tool calls end-to-end', async () => {
    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'parse_file',
        arguments: { filePath: './test-file.ts' }
      }
    });
    
    expect(response.result.content).toBeDefined();
    expect(response.result.isError).toBe(false);
  });
});
```

#### 3. End-to-End Tests
**Purpose:** Test complete user workflows.
**Location:** `test/e2e/`

```typescript
// Example: test/e2e/full-workflow.test.ts
import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { MCPClient } from '@modelcontextprotocol/sdk/client';

describe('E2E: Full Workflow', () => {
  it('should perform complete analysis workflow', async () => {
    // Start server process
    const serverProcess = spawn('node', ['dist/cli.js']);
    
    // Create client and connect
    const client = new MCPClient(/* stdio transport */);
    await client.connect();
    
    // Test full workflow
    const parseResult = await client.callTool('parse_file', {
      filePath: './test-project/src/index.ts'
    });
    expect(parseResult.success).toBe(true);
    
    const searchResult = await client.callTool('semantic_search', {
      query: 'authentication logic',
      maxResults: 5
    });
    expect(searchResult.results).toHaveLength(5);
    
    // Cleanup
    await client.disconnect();
    serverProcess.kill();
  });
});
```

### Test Configuration

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        'test/',
        '**/*.test.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
yarn run test:watch

# Run specific test file
npm test -- src/config/__tests__/validator.test.ts

# Run tests with coverage
yarn run test:coverage

# Run only integration tests
yarn run test:integration

# Run only e2e tests
yarn run test:e2e
```

### Test Utilities

**test/utils/test-helpers.ts:**
```typescript
import { vi } from 'vitest';
import { MCPServer } from '../src/server';

export function createMockServer(overrides = {}) {
  return new MCPServer({
    transport: { type: 'stdio' },
    database: { path: ':memory:' },
    logging: { level: 'error' }, // Suppress logs in tests
    ...overrides
  });
}

export function mockFileSystem() {
  const fs = vi.hoisted(() => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn()
  }));
  
  vi.mock('fs/promises', () => fs);
  return fs;
}

export async function waitFor(condition: () => boolean, timeout = 5000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout waiting for condition`);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
```

## Debugging Guide

### Development Setup

```bash
# Enable debug logging
DEBUG=ast-mcp-server:* yarn run dev

# Start with Node.js debugger
node --inspect dist/cli.js

# Use VS Code debugger
# Add breakpoints and use F5 to start debugging
```

### VS Code Debug Configuration

**.vscode/launch.json:**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug MCP Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/dist/cli.js",
      "args": ["--log-level", "debug"],
      "console": "integratedTerminal",
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist/**/*.js"]
    },
    {
      "name": "Debug Tests",
      "type": "node", 
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "--reporter=verbose"],
      "console": "integratedTerminal",
      "sourceMaps": true
    }
  ]
}
```

### Logging System

The server uses a structured logging system with multiple levels:

```typescript
import { logger } from './logging';

// Different log levels
logger.debug('Detailed debug information', { context: 'parser' });
logger.info('General information', { userId: 123 });
logger.warn('Warning condition', { performance: 'slow' });
logger.error('Error occurred', { error: error.message, stack: error.stack });

// Structured logging with context
logger.child({ component: 'ast-parser' }).info('Parsing file', {
  filePath: './src/index.ts',
  duration: 156,
  nodeCount: 234
});
```

### Common Debugging Scenarios

#### 1. Parser Issues

```typescript
// Add debugging to parser
logger.debug('Starting parse', { filePath, options });

try {
  const ast = parser.parse(content, options);
  logger.debug('Parse successful', { nodeCount: ast.body.length });
  return ast;
} catch (error) {
  logger.error('Parse failed', {
    filePath,
    error: error.message,
    line: error.loc?.line,
    column: error.loc?.column,
    content: content.slice(Math.max(0, error.index - 50), error.index + 50)
  });
  throw error;
}
```

#### 2. Transport Issues

```typescript
// Debug transport layer
transport.on('message', (message) => {
  logger.debug('Received message', {
    type: message.method || 'response',
    id: message.id,
    size: JSON.stringify(message).length
  });
});

transport.on('error', (error) => {
  logger.error('Transport error', {
    transport: transport.constructor.name,
    error: error.message,
    connected: transport.isConnected()
  });
});
```

#### 3. Performance Issues

```typescript
// Add performance monitoring
function withTiming<T>(name: string, fn: () => Promise<T>): Promise<T> {
  return async () => {
    const start = process.hrtime.bigint();
    try {
      const result = await fn();
      const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
      logger.info('Operation completed', { operation: name, duration });
      return result;
    } catch (error) {
      const duration = Number(process.hrtime.bigint() - start) / 1_000_000;
      logger.error('Operation failed', { operation: name, duration, error: error.message });
      throw error;
    }
  };
}
```

### Memory Debugging

```bash
# Monitor memory usage
node --inspect --max-old-space-size=4096 dist/cli.js

# Generate heap dump
kill -USR2 <pid>

# Analyze heap dump with Chrome DevTools
# Open chrome://inspect and click "Open dedicated DevTools for Node"
```

## Performance Optimization

### Profiling

#### 1. CPU Profiling

```typescript
// Add CPU profiling to critical paths
import { performance } from 'perf_hooks';

class ASTParser {
  async parseFile(filePath: string): Promise<AST> {
    const mark = performance.mark('parse-start');
    
    try {
      const result = await this.doParse(filePath);
      performance.mark('parse-end');
      performance.measure('parse-duration', 'parse-start', 'parse-end');
      
      const measure = performance.getEntriesByName('parse-duration')[0];
      logger.info('Parse completed', { 
        filePath, 
        duration: measure.duration,
        nodeCount: result.nodeCount 
      });
      
      return result;
    } finally {
      performance.clearMarks('parse-start');
      performance.clearMarks('parse-end');
      performance.clearMeasures('parse-duration');
    }
  }
}
```

#### 2. Memory Profiling

```typescript
// Monitor memory usage
function logMemoryUsage(context: string) {
  const usage = process.memoryUsage();
  logger.info('Memory usage', {
    context,
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024),
    rss: Math.round(usage.rss / 1024 / 1024)
  });
}
```

### Optimization Strategies

#### 1. Caching

```typescript
import LRU from 'lru-cache';

class ASTCache {
  private cache = new LRU<string, AST>({
    max: 1000,
    maxSize: 100 * 1024 * 1024, // 100MB
    sizeCalculation: (ast) => JSON.stringify(ast).length,
    ttl: 5 * 60 * 1000 // 5 minutes
  });
  
  get(filePath: string): AST | undefined {
    return this.cache.get(filePath);
  }
  
  set(filePath: string, ast: AST): void {
    this.cache.set(filePath, ast);
  }
  
  delete(filePath: string): boolean {
    return this.cache.delete(filePath);
  }
  
  clear(): void {
    this.cache.clear();
  }
}
```

#### 2. Streaming for Large Files

```typescript
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

async function processLargeFile(filePath: string): Promise<void> {
  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    
    // Process line by line to avoid loading entire file into memory
    await this.processLine(line, lineNumber);
    
    // Yield control occasionally
    if (lineNumber % 1000 === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}
```

#### 3. Worker Threads for CPU-Intensive Tasks

```typescript
// main.ts
import { Worker } from 'worker_threads';

class ParserWorkerPool {
  private workers: Worker[] = [];
  private queue: Array<{ data: any; resolve: Function; reject: Function }> = [];
  
  constructor(poolSize = 4) {
    for (let i = 0; i < poolSize; i++) {
      this.createWorker();
    }
  }
  
  async parse(filePath: string, content: string): Promise<AST> {
    return new Promise((resolve, reject) => {
      this.queue.push({ data: { filePath, content }, resolve, reject });
      this.processQueue();
    });
  }
  
  private createWorker(): void {
    const worker = new Worker('./parser-worker.js');
    worker.on('message', (result) => {
      // Handle worker response
    });
    this.workers.push(worker);
  }
}

// parser-worker.js
import { parentPort } from 'worker_threads';

parentPort?.on('message', ({ filePath, content }) => {
  try {
    const ast = parser.parse(content);
    parentPort?.postMessage({ success: true, ast });
  } catch (error) {
    parentPort?.postMessage({ success: false, error: error.message });
  }
});
```

### Performance Monitoring

```typescript
class PerformanceMonitor {
  private metrics = new Map<string, number[]>();
  
  record(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const durations = this.metrics.get(operation)!;
    durations.push(duration);
    
    // Keep only last 1000 measurements
    if (durations.length > 1000) {
      durations.shift();
    }
  }
  
  getStats(operation: string) {
    const durations = this.metrics.get(operation) || [];
    if (durations.length === 0) return null;
    
    durations.sort((a, b) => a - b);
    
    return {
      count: durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)]
    };
  }
}
```

## Contributing

### Getting Started

1. **Fork the Repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/your-username/ast-copilot-helper.git
   cd ast-copilot-helper
   ```

2. **Set Up Development Environment**
   ```bash
   yarn install
   yarn run build
   cd packages/ast-mcp-server
   npm test
   ```

3. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make Changes**
   - Follow coding standards
   - Write tests for new functionality
   - Update documentation
   - Ensure all tests pass

5. **Submit Pull Request**
   - Push changes to your fork
   - Create PR with clear description
   - Address review feedback

### Code Review Process

All code changes must go through code review:

1. **Automated Checks**
   - TypeScript compilation
   - ESLint rules
   - Test coverage
   - Security scans

2. **Manual Review**
   - Code quality and style
   - Architecture and design
   - Performance implications
   - Security considerations

3. **Approval Requirements**
   - At least 2 approvals from maintainers
   - All automated checks must pass
   - Documentation must be updated

### Issue Guidelines

When creating issues:

1. **Bug Reports**
   - Clear description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Logs and error messages

2. **Feature Requests**
   - Use case description
   - Proposed solution
   - Alternative solutions considered
   - Impact on existing functionality

## Release Process

### Versioning

We follow **Semantic Versioning** (SemVer):
- `MAJOR.MINOR.PATCH`
- Major: Breaking changes
- Minor: New features (backward compatible)
- Patch: Bug fixes (backward compatible)

### Release Workflow

1. **Create Release Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v1.2.0
   ```

2. **Update Version and Changelog**
   ```bash
   npm version minor  # or major/patch
   # Update CHANGELOG.md with new features and fixes
   ```

3. **Final Testing**
   ```bash
   yarn run test:all
   yarn run build
   yarn run test:e2e
   ```

4. **Create Release PR**
   - PR from release branch to main
   - Include changelog in PR description
   - Require approval from all maintainers

5. **Merge and Tag**
   ```bash
   git checkout main
   git merge release/v1.2.0
   git tag v1.2.0
   git push origin main --tags
   ```

6. **Publish Package**
   ```bash
   npm publish
   ```

7. **Update Develop Branch**
   ```bash
   git checkout develop
   git merge main
   git push origin develop
   ```

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped appropriately
- [ ] Security vulnerabilities addressed
- [ ] Performance regression tests passed
- [ ] Breaking changes documented
- [ ] Migration guide provided (if needed)

This comprehensive development guide provides all the information needed for contributors to effectively work on the AST MCP Server project, from initial setup through the release process.