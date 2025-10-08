# Development Guide

## Prerequisites

- **Node.js**: 20.0.0 or higher
- **Yarn**: 4.9.4 or higher (modern Yarn v4)
- **Operating Systems**: Windows, macOS, Linux (x64, arm64)

## Quick Start

1. **Install dependencies**

   ```bash
   yarn install
   ```

2. **Build all packages**

   ```bash
   yarn run build
   ```

3. **Run tests**
   ```bash
   yarn run test:all
   ```

## Package Manager

This project uses **Yarn v4** (Berry) as the package manager for several advantages:

- **Zero-Install**: Faster CI/CD with dependency caching
- **Workspace Protocol**: Improved monorepo dependency management
- **Plug'n'Play**: Better dependency resolution
- **Modern CLI**: Enhanced developer experience

Key Yarn v4 commands for this project:

```bash
# Install all dependencies
yarn install

# Run commands across all workspaces
yarn workspaces foreach -ptv run <command>

# Add dependency to specific workspace
yarn workspace <workspace-name> add <package>
```

## Development Workflow

### CI/CD Pipeline

This project implements a comprehensive CI/CD pipeline addressing 36 acceptance criteria:

#### Quick CI/CD Commands

```bash
# Quality validation
yarn run ci:quality-gate      # Coverage, security, performance checks
yarn run ci:security-scan     # Vulnerability scanning
yarn run ci:performance-score # Performance grade calculation

# Deployment
yarn run ci:deploy-staging    # Deploy to staging environment
yarn run ci:deploy-production # Blue-Green production deployment
yarn run ci:health-check      # Validate deployment health
yarn run ci:rollback         # Automated rollback if needed

# Monitoring and notifications
yarn run ci:performance-monitor # Generate performance reports
yarn run ci:monitoring-dashboard # Update real-time dashboards
yarn run ci:alerting-system     # Configure alerting rules
yarn run ci:notify-build-failure # Test notification system
```

#### CI/CD Features

- **Multi-platform builds**: Windows, macOS, Linux with Node.js 20, 22, 24
- **Quality gates**: 90%+ coverage, security scanning, performance validation
- **Blue-Green deployment** with automated rollback
- **Real-time monitoring** with performance tracking and alerting
- **Multi-channel notifications**: Slack, email, GitHub integration

For detailed CI/CD documentation: [docs/CI-CD-PIPELINE.md](docs/CI-CD-PIPELINE.md)

### Testing

Our testing strategy follows a comprehensive approach with multiple layers:

```bash
# Unit tests (fast, isolated)
yarn run test:unit

# Integration tests (component interaction)
yarn run test:integration

# Performance benchmarks (acceptance criteria validation)
yarn run test:benchmarks

# Full test suite with coverage
yarn run test:coverage

# Interactive test UI
yarn run test:ui

# Watch mode for development
yarn run test:watch

# Rust testing (core engine validation)
yarn run test:rust:all
```

### Rust Core Engine Testing

The AST core engine is written in Rust for high performance. We have comprehensive testing and validation:

#### Rust Testing Commands

```bash
# Full Rust validation suite (recommended)
yarn run test:rust:all        # Runs all Rust validations

# Individual Rust checks
yarn run test:rust:check      # Compilation check (cargo check)
yarn run test:rust            # Run Rust unit tests (cargo test)
yarn run test:rust:clippy     # Linting with Clippy
yarn run test:rust:fmt        # Code formatting check (cargo fmt --check)
```

#### Rust Validation in Development Workflow

1. **Pre-commit Hooks**
   - Automatically detects changes to `.rs` or `.toml` files
   - Runs `cargo check`, `cargo test`, and `cargo fmt --check`
   - Prevents commits with Rust compilation or formatting issues

2. **CI Pipeline**
   - Dedicated `rust-validation` job runs in parallel with other checks
   - Complete Rust toolchain setup with caching for faster builds
   - Comprehensive validation including compilation, tests, linting, and formatting

3. **Local Development**
   - Run `yarn test:rust:all` before committing Rust changes
   - Use `cargo fmt` to auto-format Rust code
   - Address Clippy warnings for code quality

#### Rust Testing Strategy

- **Compilation**: Ensures all Rust code compiles without errors
- **Unit Tests**: Validates core engine functionality and edge cases
- **Integration Tests**: Tests native bindings and Node.js integration
- **Code Quality**: Clippy linting catches common issues and suggests improvements
- **Formatting**: Consistent code style with `rustfmt`

#### Tree-sitter Language Ecosystem

The Rust core engine uses **tree-sitter 0.25.10** with a comprehensive language parser ecosystem:

**Supported Languages (15 total):**

- **Tier 1:** JavaScript (0.25.0), TypeScript (0.23.2), Python (0.25.0), Rust (0.24.0)
- **Tier 2:** Java (0.23.5), C++ (0.23.4), C (0.24.1), C# (0.23.1), Go (0.25.0), Ruby (0.23.1), PHP (0.24.2)
- **Tier 3:** Kotlin (1.1.0), Swift (0.7.1), Scala (0.24.0), Bash (0.25.0)

**API Compatibility:**

```rust
// Modern tree-sitter 0.25.x API
grammar: tree_sitter_javascript::LANGUAGE.into(),
grammar: tree_sitter_python::LANGUAGE.into(),

// Special cases
grammar: tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
grammar: tree_sitter_php::LANGUAGE_PHP.into(),
```

**Build Requirements:**

- Rust toolchain automatically handles tree-sitter dependencies
- No manual grammar downloads required - all included in Cargo.toml
- WASM target requires `wasm-pack` for comprehensive testing

**Testing tree-sitter Languages:**

```bash
# Validate all parsers work
cd packages/ast-core-engine
cargo build --bin ast-parser

# Test specific language parsing
echo 'console.log("Hello");' | ./target/debug/ast-parser parse --stdin --language javascript

# List all supported languages
./target/debug/ast-parser languages
```

#### Performance Considerations

The Rust core engine is optimized for development speed:

- Development builds skip full optimization for faster iteration
- Production builds use full optimization for maximum performance
- Testing validates both compilation correctness and runtime behavior

### Native-Only Architecture

The core engine uses a native-only approach with NAPI bindings for optimal performance and reliability.

#### Current Architecture: Native NAPI

**Production Target:**

```bash
# Native builds (currently used in production)
cd packages/ast-core-engine
cargo build --release     # Native compilation for current platform
```

**Native Performance Benefits:**

- 100% native performance for compute-intensive operations
- Direct system integration and I/O capabilities
- Full access to Rust ecosystem including networking and file system

#### Native Architecture

The codebase uses native-only architecture for optimal performance:

```rust
// Native-optimized code (production target)
use napi::bindgen_prelude::*;
use tokio::runtime::Runtime;

// Native implementation
use crate::native_impl::*;
```

**Features:**

- `default`: WASM backend with optimized dependencies
- `wasm`: WebAssembly backend (primary target)
- `native-fallback`: Rust native fallback for specific environments

#### Phase 1 Limitations

The initial WASM infrastructure has architectural constraints:

1. **Heavy Dependencies**: Complex dependencies (sqlx, ring cryptography, tokio networking) are incompatible with WASM target
2. **Feature Subset**: WASM build includes only core AST processing functionality
3. **Architecture Changes**: Full WASM support requires Phase 2 refactoring to separate core logic from platform-specific features

#### Next Steps (Phase 2+)

To achieve full WASM compatibility:

1. **Dependency Isolation**: Move heavy dependencies to platform-specific modules
2. **Core Abstraction**: Extract pure Rust core engine without platform dependencies
3. **Interface Standardization**: Unified API for WASM with native fallback support
4. **Testing Strategy**: Cross-platform validation suite

The Phase 1 infrastructure provides the foundation for these improvements.

## Tree-sitter Integration

### Overview

The ast-copilot-helper leverages Tree-sitter for high-performance, incremental parsing across multiple programming languages. Tree-sitter provides robust syntax analysis with excellent error recovery and incremental parsing capabilities.

### Supported Languages

Our Tree-sitter integration currently supports the following languages:

| Language   | Grammar Status | Features Supported             |
| ---------- | -------------- | ------------------------------ |
| JavaScript | ✅ Full        | Syntax, imports, exports, JSX  |
| TypeScript | ✅ Full        | Types, interfaces, generics    |
| Python     | ✅ Full        | Classes, functions, decorators |
| Rust       | ✅ Full        | Modules, traits, macros        |
| Go         | ✅ Full        | Packages, interfaces, structs  |
| Java       | ✅ Full        | Classes, annotations, generics |
| C++        | ✅ Full        | Classes, templates, namespaces |
| C#         | ✅ Full        | Classes, interfaces, LINQ      |

### Architecture

#### Native Parser Implementation

The core parsing functionality is implemented in `packages/ast-helper/src/parser/parsers/native-parser.ts`:

- **Tree-sitter Integration**: Direct bindings to Tree-sitter WASM parsers
- **Language Detection**: Automatic language detection based on file extensions
- **Error Handling**: Robust error recovery and reporting
- **Performance Optimization**: Caching and memory management

#### Performance Features

- **Parse Caching**: SHA256-based cache keys with 5-minute TTL
- **Memory Management**: Automatic cleanup and garbage collection
- **Parser Pooling**: Reusable parser instances for better performance
- **Incremental Parsing**: Only re-parse modified sections when possible

### Usage Examples

#### Basic Parsing

```typescript
import { createRustParserAdapter } from "@ast-copilot-helper/ast-helper";

const parser = await createRustParserAdapter();
const result = await parser.parseFile("/path/to/file.ts");
console.log(result.nodes.length); // AST node count
```

#### Batch Processing

```typescript
const files = ["file1.js", "file2.ts", "file3.py"];
const results = await Promise.all(files.map((file) => parser.parseFile(file)));
```

### WASM Limitations

While Tree-sitter has excellent WASM support, some limitations exist:

1. **Binary Size**: Each language grammar adds ~200KB to bundle size
2. **Initialization**: WASM parsers require async initialization
3. **Memory**: WASM memory model limits very large file processing
4. **Threading**: Single-threaded execution in browser environments

### Development Guidelines

#### Adding New Languages

1. Install the Tree-sitter grammar: `yarn add tree-sitter-<language>`
2. Add language detection logic in `native-parser.ts`
3. Update the supported languages table above
4. Add test cases in `tests/parser/` directory

#### Performance Considerations

- Use caching for repeated parsing operations
- Implement memory limits for large files (>10MB)
- Consider lazy loading for rarely used language grammars
- Monitor parse times and optimize bottlenecks

#### Testing Tree-sitter Integration

```bash
# Run parser-specific tests
yarn test tests/parser/

# Run performance benchmarks
yarn run test:benchmarks

# Validate all supported languages
yarn test tests/languages/
```

### Performance Requirements

Our codebase must meet strict performance criteria:

- **AST Parsing**: Handle 15,000+ nodes in under 10 minutes
- **MCP Server**: Query latency < 200ms average
- **CLI Tool**: Query latency < 500ms average
- **Memory**: Efficient memory usage for large repositories

Run benchmarks to validate: `yarn run test:benchmarks`

### Code Quality

#### Pre-commit Hooks

We use Husky for automated quality checks:

- **Type checking**: Ensures TypeScript compilation
- **Linting**: Code style and best practices
- **Unit tests**: Fast feedback on core functionality
- **Build verification**: Ensures packages compile

#### Pre-push Hooks

Before code reaches remote:

- **Full test suite**: Complete validation
- **Security audit**: Dependency vulnerability checks

### Development Commands

```bash
# Development
yarn run dev                 # Start all packages in dev mode
yarn run build:watch        # Build packages in watch mode

# Quality
yarn run lint               # Lint all packages
yarn run lint:fix          # Auto-fix linting issues
yarn run type-check        # TypeScript type checking

# Security
yarn run security:audit    # Check for vulnerabilities
yarn run security:fix      # Auto-fix security issues

# Dependencies
yarn run deps:check        # Check for outdated packages
yarn run deps:update       # Update dependencies

# Cleanup
yarn run clean             # Clean build artifacts
yarn run clean:all         # Deep clean including node_modules
```

## Package Architecture

### AST Helper (`packages/ast-copilot-helper`)

- **Purpose**: CLI tool for AST analysis and code querying
- **Key Features**: Configuration management, logging, file locking
- **Performance Target**: Query latency < 500ms

### MCP Server (`packages/ast-mcp-server`)

- **Purpose**: Model Context Protocol server for IDE integration
- **Key Features**: Database management, protocol implementation
- **Performance Target**: Query latency < 200ms

### VS Code Extension (`packages/vscode-extension`)

- **Purpose**: IDE integration for seamless development
- **Key Features**: UI components, manager classes
- **Integration**: Works with MCP server for real-time analysis

## Testing Strategy

### Test Organization

```
tests/
├── benchmarks/     # Performance validation tests
├── fixtures/       # Mock data and test utilities
├── integration/    # Cross-package interaction tests
└── unit/          # Isolated component tests
```

### Test Types

1. **Unit Tests**
   - Fast, isolated component testing
   - High coverage of core logic
   - Mock external dependencies

2. **Integration Tests**
   - Package interaction validation
   - End-to-end workflow testing
   - Real-world scenario simulation

3. **Performance Benchmarks**
   - Acceptance criteria validation
   - Regression detection
   - Load testing under various conditions

### Coverage Goals

- **Project Coverage**: > 90%
- **New Code Coverage**: > 85%
- **Critical Paths**: 100%

## Continuous Integration

### GitHub Actions Workflows

1. **CI Pipeline** (`.github/workflows/ci.yml`)
   - Multi-platform testing (Windows, macOS, Linux)
   - Node.js version matrix (20, 22, 24)
   - Performance benchmark validation
   - Coverage reporting

2. **Release Pipeline** (`.github/workflows/release-pipeline.yml`)
   - Automated semantic versioning
   - Cross-platform builds
   - NPM package publishing
   - GitHub release creation

3. **Maintenance** (`.github/workflows/maintenance.yml`)
   - Weekly dependency updates
   - Monthly security audits
   - Performance monitoring

### Quality Gates

- All tests must pass
- Coverage thresholds must be met
- Performance benchmarks must pass
- Security audit must be clean
- Type checking must succeed

## MCP Client Integration

### Architecture Overview

The VS Code extension integrates with the MCP (Model Context Protocol) server using a custom Transport implementation that preserves the extension's sophisticated process lifecycle management.

#### Key Components

**1. ManagedProcessTransport** (`packages/vscode-extension/src/mcp/ManagedProcessTransport.ts`)

Custom MCP Transport that wraps an existing managed `ChildProcess`:

- **Purpose**: Handles JSON-RPC communication over existing process stdio
- **Does NOT**: Spawn or manage process lifecycle (that's ServerProcessManager's job)
- **Message Format**: Newline-delimited JSON-RPC over stdin/stdout
- **Error Handling**: Robust parsing with buffer management

**2. MCPClientManager** (`packages/vscode-extension/src/managers/MCPClientManager.ts`)

Manages MCP SDK Client with connection lifecycle:

- **Client**: Real MCP SDK Client from `@modelcontextprotocol/sdk`
- **Connection**: Automatic initialization via `client.connect(transport)`
- **Reconnection**: Automatic reconnection attempts with exponential backoff
- **Events**: Connected, disconnected, error, serverCapabilities events

**3. ServerProcessManager** (`packages/vscode-extension/src/managers/ServerProcessManager.ts`)

Manages MCP server process lifecycle:

- **Process Control**: Spawn, restart, stop, health checks
- **State Machine**: Starting, running, stopping, stopped, error states
- **Monitoring**: Heartbeat, startup timeout, crash detection
- **Integration**: Exposes `getProcess()` for Transport creation

#### Architecture Decision

We chose **Custom Transport + Managed Process** over letting the MCP SDK spawn its own process:

**Rationale:**

- Preserves 600+ lines of mature process management code
- Maintains VS Code extension patterns (extensions manage their servers)
- Allows custom monitoring, logging, UI integration
- Enables sophisticated restart logic and health checks
- MCP SDK Transport interface designed for this flexibility

**Alternative Rejected:**

- Let `StdioClientTransport` spawn process → Would lose all custom process management

### Message Flow

```
1. VS Code Extension starts
   ↓
2. ServerProcessManager spawns MCP server process
   ↓
3. MCPClientManager creates ManagedProcessTransport
   ↓
4. Transport wraps existing process stdin/stdout
   ↓
5. MCP Client connects via Transport
   ↓
6. Client.callTool() → Transport.send() → process.stdin
   ↓
7. process.stdout → Transport.onmessage → Client receives response
```

### Usage Example

```typescript
// In extension.ts
const serverProcessManager = new ServerProcessManager(config, outputChannel);
await serverProcessManager.start();

const clientManager = new MCPClientManager(
  serverProcessManager,
  clientConfig,
  outputChannel,
);

await clientManager.connect();

// Use the client
const client = clientManager.getClient();
const result = await client.callTool({
  name: "query_ast_context",
  arguments: { query: "find all functions" },
});
```

### Testing

#### Manual Testing

Follow the comprehensive manual testing guide:

- **Full Guide**: `packages/vscode-extension/MANUAL_MCP_TESTING.md`
- **Quick Start**: `QUICK_MCP_TEST.md`

#### Test Command

The extension includes a test command utility:

```typescript
import { registerMCPTestCommand } from "./test/mcpTestCommand";

// In extension.ts activate()
const testCmd = registerMCPTestCommand(context, clientManager);
context.subscriptions.push(testCmd);

// Run via Command Palette: "AST Helper: Test MCP Client"
```

### Configuration

#### Client Configuration

```typescript
interface ClientConfig {
  autoConnect: boolean; // Auto-connect on server start
  maxReconnectAttempts: number; // Default: 5
  reconnectDelay: number; // Default: 2000ms
  connectionTimeout: number; // Default: 10000ms
  heartbeatInterval: number; // Default: 30000ms
  enableLogging: boolean; // Default: true
}
```

#### Server Configuration

```typescript
interface ServerConfig {
  serverPath: string; // Path to MCP server executable
  workingDirectory: string; // Server working directory
  args: string[]; // Command-line arguments
  env: Record<string, string>; // Environment variables
  startupTimeout: number; // Default: 10000ms
  healthCheckInterval: number; // Default: 30000ms
}
```

### Debugging

#### View Logs

- **Extension Output**: Output panel → "AST Helper Server"
- **MCP Server Stderr**: Captured in extension output
- **Transport Messages**: Enable `enableLogging` in client config

#### Common Issues

1. **"Server process not available"**

   ```bash
   # Verify server build
   cd packages/ast-mcp-server && yarn build
   ls -la dist/index.js
   ```

2. **"Failed to parse JSON-RPC message"**
   - Check server stdout for non-JSON output
   - Verify newline-delimited JSON format
   - Check stderr contamination of stdout

3. **Connection timeout**
   - Increase `connectionTimeout` in configuration
   - Check server startup logs
   - Verify server responds to initialization

## WASM Vector Database

### Architecture Overview

The vector database uses **WebAssembly (WASM)** for cross-platform vector similarity search, replacing the previous NAPI-based native implementation.

#### Key Benefits

- **Cross-Platform**: Works on any platform supporting WASM (x64, ARM64, etc.)
- **No Native Compilation**: No need for platform-specific binaries
- **Browser Compatible**: Can run in browser environments
- **Maintainable**: Single WASM binary instead of per-platform builds

### Implementation

**RustVectorDatabase** (`packages/ast-helper/src/database/vector/rust-vector-database.ts`)

Simplified to a pure WASM wrapper:

```typescript
export class RustVectorDatabase implements VectorDatabase {
  private wasmDb: ReturnType<typeof initWasmVectorDB>;

  async initialize(config: VectorDatabaseConfig): Promise<void> {
    // Load WASM module
    this.wasmDb = await initWasmVectorDB(config.databasePath);
  }

  async addVector(id: string, vector: number[]): Promise<void> {
    return this.wasmDb.add_vector(id, vector);
  }

  async search(
    query: number[],
    k: number,
  ): Promise<Array<{ id: string; score: number }>> {
    return this.wasmDb.search(query, k);
  }
}
```

### WASM Core Engine

**Rust Implementation** (`packages/ast-core-engine/src/vector_db.rs`)

High-performance vector operations in Rust:

```rust
#[wasm_bindgen]
pub struct WasmVectorDB {
    vectors: HashMap<String, Vec<f32>>,
}

#[wasm_bindgen]
impl WasmVectorDB {
    pub fn add_vector(&mut self, id: String, vector: Vec<f32>) {
        self.vectors.insert(id, vector);
    }

    pub fn search(&self, query: Vec<f32>, k: usize) -> Vec<SearchResult> {
        // Cosine similarity search
        // Returns top-k results
    }
}
```

### Building WASM

```bash
# Build WASM module
cd packages/ast-core-engine
cargo build --target wasm32-unknown-unknown --release

# Or use wasm-pack for optimized build
wasm-pack build --target nodejs --release
```

### Performance Characteristics

- **Initialization**: ~10-50ms (WASM module load)
- **Add Vector**: ~0.1ms per vector
- **Search**: ~1-10ms for 1000 vectors (depends on k)
- **Memory**: ~4 bytes per dimension per vector

### Limitations

1. **Memory Model**: WASM has 32-bit linear memory (max ~2GB)
2. **Single-Threaded**: WASM runs on single thread (for now)
3. **No SIMD (yet)**: WASM SIMD support is experimental
4. **Serialization Overhead**: JS ↔ WASM boundary has some cost

### Migration Notes

**Previous Architecture: NAPI**

- Required native compilation for each platform
- Platform-specific binaries (Windows, macOS, Linux × x64/ARM64)
- Maintenance burden for multiple targets
- Installation issues with pre-built binaries

**Current Architecture: WASM**

- ✅ Single universal binary
- ✅ No platform-specific builds
- ✅ Easier distribution
- ✅ Browser-compatible potential

**Removed:**

- `packages/ast-helper/src/database/vector/napi-wrapper.ts` (407 lines)
- Platform-specific native builds
- Pre-built binary distribution logic

### Future Enhancements

1. **WASM SIMD**: Use SIMD intrinsics when stable
2. **Web Workers**: Multi-threaded search via Workers
3. **Streaming**: Incremental vector addition
4. **Compression**: Quantization for memory efficiency

## Contributing

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Develop with Tests**
   - Write tests first (TDD approach)
   - Ensure all existing tests pass
   - Add performance tests for new features

3. **Commit Standards**
   - Use conventional commit format
   - Include performance impact notes
   - Reference issue numbers

4. **Submit Pull Request**
   - Include comprehensive description
   - Add performance benchmark results
   - Ensure CI passes

## Troubleshooting

### Common Issues

1. **Build Failures**

   ```bash
   yarn run clean:all && yarn install && yarn run build
   ```

2. **Test Failures**

   ```bash
   # Check specific test output
   yarn run test:unit -- --reporter=verbose

   # Run specific test file
   npx vitest path/to/test.test.ts
   ```

3. **Performance Issues**

   ```bash
   # Run benchmarks to identify bottlenecks
   yarn run test:benchmarks

   # Profile specific operations
   yarn run test:benchmarks -- --reporter=verbose
   ```

4. **Type Checking Issues**
   ```bash
   # Clean type cache and rebuild
   yarn run clean && yarn run type-check
   ```

### Getting Help

- Check existing issues in the repository
- Review test output for specific error details
- Run benchmarks to validate performance assumptions
- Use `yarn run test:ui` for interactive debugging
