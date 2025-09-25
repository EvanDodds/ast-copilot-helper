# AST MCP Server

A comprehensive Model Context Protocol (MCP) server implementation for Abstract Syntax Tree (AST) analysis and code understanding. This server provides powerful tools and resources for analyzing codebases, extracting semantic information, and enabling AI assistants to better understand code structure.

## Features

### 🔧 Comprehensive Tool System

- **AST Parsing**: Parse files into Abstract Syntax Trees using multiple language parsers
- **Code Analysis**: Extract functions, classes, imports, and structural information
- **Search & Query**: Semantic search across codebases with embedding-based matching
- **File Operations**: Intelligent file reading, writing, and manipulation
- **Git Integration**: Repository analysis and version control operations

### 📦 Rich Resource System

- **Code Resources**: Access parsed AST data, semantic information, and code structures
- **Documentation**: Auto-generated documentation from code analysis
- **Metadata**: File statistics, complexity metrics, and code quality indicators
- **Search Results**: Persistent search results and query history

### 🚀 Multiple Transport Options

- **STDIO**: Standard input/output for direct integration
- **WebSocket**: Real-time bidirectional communication
- **HTTP**: RESTful API endpoints (coming soon)

### ⚙️ Flexible Configuration

- **Environment-specific**: Development, production, and test configurations
- **Multi-source**: File-based, environment variables, and programmatic configuration
- **Hot-reload**: Dynamic configuration updates without server restart
- **Validation**: Comprehensive configuration validation and error reporting

## Quick Start

### Installation

```bash
# Install the MCP server
npm install @ast-copilot-helper/ast-mcp-server

# Or install globally
npm install -g @ast-copilot-helper/ast-mcp-server
```

### Basic Usage

#### Command Line Interface

```bash
# Start server with STDIO transport (default)
ast-mcp-server

# Start with WebSocket transport
ast-mcp-server --transport websocket --port 3001

# Start with custom configuration
ast-mcp-server --config /path/to/config.json

# Start with specific database
ast-mcp-server --database ./my-ast.db
```

#### Configuration File

Create a `mcp-server-config.json`:

```json
{
  "name": "My AST Server",
  "version": "1.0.0",
  "transport": {
    "type": "websocket",
    "port": 3001,
    "host": "localhost"
  },
  "database": {
    "path": "./ast-analysis.db"
  },
  "logging": {
    "level": "info",
    "enableFile": true,
    "filePath": "./logs/server.log"
  },
  "features": {
    "enableTools": true,
    "enableResources": true,
    "enableHotReload": true
  }
}
```

#### Environment Variables

```bash
# Basic configuration
export MCP_SERVER_NAME="Production AST Server"
export MCP_SERVER_PORT=3001
export MCP_SERVER_LOG_LEVEL=info
export MCP_SERVER_DATABASE_PATH="./production.db"

# Security settings
export MCP_SERVER_ENABLE_CORS=true
export MCP_SERVER_ENABLE_TLS=false
export MCP_SERVER_ENABLE_AUTH=false

# Performance tuning
export MCP_SERVER_MAX_CONCURRENT_REQUESTS=50
export MCP_SERVER_CACHE_SIZE=1000
export MCP_SERVER_CACHE_ENABLED=true

# Start the server
ast-mcp-server
```

## Architecture Overview

The AST MCP Server follows a layered architecture:

```
┌─────────────────────────────────────────┐
│             Client Layer                │
│  (AI Assistants, IDEs, CLI Tools)      │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           Transport Layer               │
│  (STDIO, WebSocket, HTTP)              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│          Integration Layer              │
│  (Connection Mgmt, Message Broker)     │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│            Protocol Core               │
│     (MCP Request/Response Handling)    │
└─────────────────────────────────────────┘
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│    Tools    │ │  Resources  │ │ Configuration│
│   System    │ │   System    │ │   System    │
└─────────────┘ └─────────────┘ └─────────────┘
          │         │         │
          └─────────┼─────────┘
                    ▼
        ┌─────────────────────┐
        │   Database Layer    │
        │  (SQLite, Vectors)  │
        └─────────────────────┘
```

## Available Tools

### Core Analysis Tools

- **`parse_file`**: Parse a file into its Abstract Syntax Tree
- **`analyze_functions`**: Extract and analyze function definitions
- **`analyze_classes`**: Extract and analyze class definitions
- **`extract_imports`**: Analyze import/require statements
- **`get_file_structure`**: Get high-level file structure overview

### Search & Query Tools

- **`semantic_search`**: Search codebase using semantic similarity
- **`find_definitions`**: Locate function/class/variable definitions
- **`find_references`**: Find all references to a symbol
- **`query_ast`**: Execute custom AST queries using patterns

### File Operation Tools

- **`read_file_smart`**: Intelligently read files with AST context
- **`write_file_analyzed`**: Write files with automatic analysis
- **`list_files`**: List files in directory with filtering options
- **`get_file_stats`**: Get comprehensive file statistics

### Repository Tools

- **`analyze_repository`**: Perform full repository analysis
- **`get_git_info`**: Extract Git repository information
- **`find_similar_files`**: Find files with similar structure/content
- **`generate_documentation`**: Auto-generate documentation from code

## Available Resources

### Code Structure Resources

- **`ast://file/{path}`**: Get parsed AST for any file
- **`structure://file/{path}`**: Get structural overview of file
- **`functions://file/{path}`**: Get all functions in file
- **`classes://file/{path}`**: Get all classes in file

### Analysis Resources

- **`analysis://complexity/{path}`**: Get complexity metrics
- **`analysis://dependencies/{path}`**: Get dependency analysis
- **`analysis://coverage/{path}`**: Get code coverage information
- **`metrics://file/{path}`**: Get comprehensive code metrics

### Search Resources

- **`search://results/{query_id}`**: Get persistent search results
- **`search://history`**: Get search query history
- **`search://suggestions`**: Get search suggestions based on codebase

### Documentation Resources

- **`docs://api/{path}`**: Get API documentation for file/module
- **`docs://readme/{path}`**: Get auto-generated README content
- **`docs://examples/{path}`**: Get usage examples for code

## Configuration Reference

### Server Configuration

```typescript
interface MCPServerConfig {
  name: string; // Server display name
  version: string; // Server version
  description?: string; // Server description

  transport: TransportConfig; // Transport layer settings
  performance: PerformanceConfig; // Performance tuning
  logging: LoggingConfig; // Logging configuration
  security: SecurityConfig; // Security settings
  features: FeatureConfig; // Feature toggles
  database: DatabaseConfig; // Database settings
  environment: EnvironmentConfig; // Environment settings
}
```

### Transport Configuration

```typescript
interface TransportConfig {
  type: "stdio" | "websocket" | "http"; // Transport type
  port?: number; // Port for network transports
  host?: string; // Host binding
  maxConnections?: number; // Max concurrent connections
  timeout?: number; // Connection timeout
}
```

### Performance Configuration

```typescript
interface PerformanceConfig {
  maxConcurrentRequests: number; // Request concurrency limit
  requestTimeout: number; // Individual request timeout
  maxQueryResults: number; // Max results per query
  cacheSize: number; // Cache size in MB
  cacheEnabled: boolean; // Enable/disable caching
  gcThreshold: number; // Garbage collection threshold
}
```

### Logging Configuration

```typescript
interface LoggingConfig {
  level: "debug" | "info" | "warn" | "error"; // Log level
  enableFile: boolean; // File logging
  filePath?: string; // Log file path
  enableRequestLogging: boolean; // Request logging
  logRequestBody: boolean; // Log request bodies
  enableStructuredLogging: boolean; // JSON structured logs
}
```

### Security Configuration

```typescript
interface SecurityConfig {
  enableAuthentication: boolean; // Enable auth
  enableRateLimit: boolean; // Enable rate limiting
  rateLimitRequests: number; // Requests per window
  rateLimitWindow: number; // Rate limit window (ms)
  enableCors: boolean; // Enable CORS
  enableTls: boolean; // Enable TLS/SSL
  allowedOrigins: string[]; // CORS allowed origins
}
```

## Deployment

### Development Mode

```bash
# Start with development defaults
NODE_ENV=development ast-mcp-server

# Or use development configuration
ast-mcp-server --env development
```

### Production Mode

```bash
# Production configuration
NODE_ENV=production ast-mcp-server \
  --transport websocket \
  --port 3001 \
  --log-level warn \
  --enable-tls \
  --max-connections 100
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: "3.8"
services:
  ast-mcp-server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - MCP_SERVER_PORT=3001
      - MCP_SERVER_LOG_LEVEL=info
      - MCP_SERVER_ENABLE_TLS=false
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
```

## API Examples

### Using Tools

```javascript
// Parse a file
const parseResult = await client.callTool("parse_file", {
  filePath: "./src/index.ts",
  includeComments: true,
});

// Semantic search
const searchResult = await client.callTool("semantic_search", {
  query: "authentication logic",
  fileTypes: [".ts", ".js"],
  maxResults: 10,
});

// Analyze functions
const functions = await client.callTool("analyze_functions", {
  filePath: "./src/auth.ts",
  includePrivate: false,
});
```

### Accessing Resources

```javascript
// Get AST for a file
const ast = await client.readResource("ast://file/src/index.ts");

// Get code complexity metrics
const metrics = await client.readResource("analysis://complexity/src/auth.ts");

// Get search results
const results = await client.readResource("search://results/query_123");
```

## Troubleshooting

### Common Issues

#### Connection Issues

```bash
# Check if server is running
netstat -an | grep 3001

# Test WebSocket connection
wscat -c ws://localhost:3001

# Check logs
tail -f ./logs/server.log
```

#### Performance Issues

```bash
# Monitor resource usage
top -p $(pgrep ast-mcp-server)

# Check database size
ls -lh *.db

# Analyze slow queries
tail -f ./logs/server.log | grep "slow"
```

#### Configuration Issues

```bash
# Validate configuration
ast-mcp-server --validate-config

# Check configuration sources
ast-mcp-server --show-config

# Test with minimal config
ast-mcp-server --config /dev/null
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=ast-mcp-server:* ast-mcp-server

# Enable verbose output
ast-mcp-server --verbose

# Enable development mode
NODE_ENV=development ast-mcp-server --log-level debug
```

## Contributing

See [DEVELOPMENT.md](./docs/DEVELOPMENT.md) for development setup, architecture details, and contribution guidelines.

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Changelog

See [CHANGELOG.md](./docs/CHANGELOG.md) for version history and changes.
