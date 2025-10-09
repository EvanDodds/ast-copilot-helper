# AST Copilot Helper

A comprehensive toolkit for Abstract Syntax Tree analysis and Model Context Protocol (MCP) server implementation, enabling AI agents to understand and query codebases with semantic intelligence across **15 programming languages**.

## 🚀 AI-Powered Code Understanding

Transform your codebase into an AI-accessible knowledge base:

- **🔍 Semantic Search**: Query code using natural language
- **🤖 MCP Integration**: Enable AI agents to understand your code structure
- **⚡ Performance**: Fast parsing with intelligent caching and incremental updates
- **🌐 Multi-Language**:Extract semantic information from your codebase:

```bash
# Initialize configuration and database
# Automatically creates .gitignore to exclude .astdb/ directory
yarn ast-copilot-helper init

# Skip .gitignore creation if you have custom version control setup
yarn ast-copilot-helper init --no-gitignore

# Parse a directory
yarn ast-copilot-helper parse src/

# Parse with natural language query
yarn ast-copilot-helper query "functions that handle authentication"
```

**Note:** The `init` command automatically creates or updates `.gitignore` to exclude the `.astdb/` directory (database files, vector indexes, models, cache) from version control. This prevents accidentally committing large generated files. Use `--no-gitignore` if you prefer custom gitignore handling. 15 programming languages across 3 tiers

- **📦 Snapshot Distribution**: Share pre-built databases for instant team onboarding

### 🏢 Tier 1: Core Languages (4 languages)

JavaScript • TypeScript • Python • Rust

### 👩‍💻 Tier 2: Popular Languages (7 languages)

Java • C++ • C • C# • Go • Ruby • PHP

### 🎯 Tier 3: Specialized Languages (4 languages)

Kotlin • Swift • Scala • Bash

**Powered by tree-sitter 0.25.x ecosystem**

**[📚 Complete Language Guide →](docs/guide/multi-language-support.md)**

## Prerequisites

- **Node.js**: 20.0.0 or higher
- **Yarn**: 4.x or higher (Berry - modern Yarn)
- **Operating Systems**: Windows, macOS, Linux (x64, arm64)

## Quick Installation

Clone and set up the project:

```bash
git clone https://github.com/EvanDodds/ast-copilot-helper.git
cd ast-copilot-helper
yarn install
```

This automatically:

- Installs all dependencies using Yarn workspaces
- Links packages together
- Builds all components

## Overview

AST Copilot Helper bridges the gap between your codebase and AI agents by providing semantic understanding through Abstract Syntax Tree analysis. The toolkit consists of three integrated components:

- **`@ast-copilot-helper/ast-helper`** - Core CLI tool that parses source code and builds semantic databases
- **`@ast-helper/core-engine`** - High-performance Rust engine (WASM for vector ops, native for AST processing)
- **`@ast-copilot-helper/ast-mcp-server`** - Model Context Protocol server enabling AI agents to query code semantically
- **`@ast-copilot-helper/vscode-extension`** - VS Code extension for seamless integration (optional)

## Architecture

```
ast-copilot-helper/                 # Monorepo root
├─ packages/
│  ├─ ast-helper/                   # 🔧 Core TypeScript library
│  │  ├─ src/                       # TypeScript parsing & analysis
│  │  └─ dist/                      # Compiled output
│  ├─ ast-core-engine/              # ⚡ High-performance Rust engine
│  │  ├─ src/                       # Rust source (WASM + native bindings)
│  │  ├─ pkg/                       # Build output (WASM modules)
│  │  ├─ target/                    # Rust build artifacts
│  │  └─ Cargo.toml                 # Rust configuration
│  ├─ ast-mcp-server/               # 🤖 MCP protocol server
│  │  ├─ src/                       # TypeScript source
│  │  ├─ bin/ast-mcp-server         # Server executable
│  │  └─ dist/                      # Compiled output
│  └─ vscode-extension/             # 🎨 VS Code extension
│     ├─ src/                       # TypeScript source
│     └─ dist/                      # Compiled output
├─ docs/                            # 📚 Documentation
│  ├─ guide/                        # User guides
│  ├─ api/                          # API references
│  └─ examples/                     # Usage examples
├─ tests/                           # 🧪 Test suites
│  ├─ integration/                  # Integration tests
│  ├─ fixtures/                     # Test repositories
│  └─ benchmarks/                   # Performance tests
└─ scripts/                         # 🔧 Build & maintenance
```

## 🌐 Language Support

AST Copilot Helper supports **15 programming languages** organized into 3 tiers:

| Tier               | Languages                            | Use Cases                                  |
| ------------------ | ------------------------------------ | ------------------------------------------ |
| **🏢 Core**        | JavaScript, TypeScript, Python, Rust | Foundation languages, highest optimization |
| **👩‍💻 Popular**     | Java, C++, C, C#, Go, Ruby, PHP      | Widely-used production languages           |
| **🎯 Specialized** | Kotlin, Swift, Scala, Bash           | Domain-specific and emerging technologies  |

### Quick Example

```typescript
import { ParserFactory } from "@ast-copilot-helper/ast-helper";

// Create parser for any supported language
const parser = await ParserFactory.createParser();

// Parse TypeScript
const tsResult = await parser.parseCode(
  'function hello(): string { return "world"; }',
  "typescript",
);

// Parse Python
const pyResult = await parser.parseCode(
  'def hello() -> str:\n    return "world"',
  "python",
);

// Parse Go
const goResult = await parser.parseCode(
  'func hello() string {\n    return "world"\n}',
  "go",
);
```

**[📖 Complete Language Guide](docs/guide/multi-language-support.md)** • **[⚡ Performance Benchmarks](docs/guide/performance.md)** • **[🔧 API Reference](docs/api/interfaces.md)**

## 📦 Snapshot Distribution System

Share pre-built `.astdb` databases to reduce onboarding time from hours to minutes:

```bash
# Create and publish a snapshot
yarn ast-helper snapshot create --version 1.0.0 --description "Production snapshot"
yarn ast-helper snapshot publish snapshot-1.0.0.tar.gz

# On another machine, download and restore
yarn ast-helper snapshot download 1.0.0
yarn ast-helper snapshot restore snapshot-1.0.0.tar.gz
# Ready to work instantly!
```

### Key Features

- **⚡ Instant Setup**: Skip parsing, restore pre-built databases in seconds
- **🌐 Team Collaboration**: Share snapshots via GitHub Releases or custom backends
- **🔄 CI/CD Integration**: Automated snapshot creation and publishing
- **📝 Versioning**: Semantic versioning with tags and metadata
- **🔐 Validation**: Checksum verification and backup creation
- **📊 Compression**: Configurable compression (0-9) for optimal size/speed

### Use Cases

- **New Developer Onboarding**: Instant access to parsed codebase
- **CI/CD Pipelines**: Skip parsing in every pipeline run
- **Team Synchronization**: Ensure everyone has identical database states
- **Release Snapshots**: Reproducible database states for each version

### Automated Snapshots

The project includes GitHub Actions workflow for automated snapshot creation:

- **Push to Main**: Creates latest snapshot after code changes
- **Nightly Schedule**: Daily snapshots at 2 AM UTC
- **Release Events**: Tagged snapshots for each release
- **Manual Trigger**: On-demand snapshot creation

**[📚 Complete Snapshot Guide →](docs/SNAPSHOT_SYSTEM.md)**

## 🤖 MCP Server Integration

The AST Copilot Helper includes a full-featured Model Context Protocol (MCP) server, enabling AI agents like Claude Desktop, Cline, and other MCP-compatible tools to query your codebase semantically.

### Quick Start with MCP

```bash
# Start the MCP server
yarn ast-mcp-server start

# Or use with Claude Desktop
# Add to Claude Desktop config (~/.config/Claude/config.json):
{
  "mcpServers": {
    "ast-helper": {
      "command": "node",
      "args": ["/path/to/ast-copilot-helper/packages/ast-mcp-server/dist/index.js"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### MCP Server Configuration

Configure the MCP server port and auto-start behavior in your config file:

```json
{
  "mcp": {
    "port": 3000,
    "autoStart": false
  }
}
```

**Configuration Options:**

- **`port`** (number, default: `3000`): Server port number
  - Valid range: 1024-65535 (unprivileged ports)
  - Automatically validated during configuration loading
- **`autoStart`** (boolean, default: `false`): Auto-start server on initialization
  - When `true`, the MCP server starts automatically after initialization
  - When `false`, the server must be started manually with `yarn ast-mcp-server start`

**Example Configurations:**

```json
// Development: Manual start, custom port
{
  "mcp": {
    "port": 8080,
    "autoStart": false
  }
}

// Production: Auto-start on default port
{
  "mcp": {
    "port": 3000,
    "autoStart": true
  }
}
```

See `examples/config.json` for a complete configuration example.

### User Configuration

AST Copilot Helper supports user-level configuration following the **XDG Base Directory Specification**, allowing you to set default preferences that apply across all projects.

**Default User Config Path:**

- `$XDG_CONFIG_HOME/ast-copilot-helper/config.json` (if `XDG_CONFIG_HOME` is set)
- `~/.config/ast-copilot-helper/config.json` (fallback)

**Custom User Config Path:**

```bash
ast-helper --user-config=/path/to/config.json <command>
```

**Configuration Priority** (highest to lowest):

1. CLI arguments (`--top-k`, `--batch-size`, etc.)
2. Environment variables (`AST_COPILOT_*`)
3. **Project config** (`.astdb/config.json` in workspace)
4. **User config** (XDG or custom path)
5. Built-in defaults

**Example User Config** (`~/.config/ast-copilot-helper/config.json`):

```json
{
  "topK": 15,
  "snippetLines": 7,
  "enableTelemetry": false,
  "model": {
    "showProgress": true
  },
  "mcp": {
    "port": 3000,
    "autoStart": false
  }
}
```

**Use Cases:**

- **Personal Preferences**: Set your preferred `topK` and `snippetLines` values
- **Privacy**: Disable telemetry by default in user config
- **Development Setup**: Configure MCP server port for your local environment
- **Team Collaboration**: Project config (`.astdb/config.json`) overrides user config for team standards

**Creating User Config:**

```bash
# Create config directory
mkdir -p ~/.config/ast-copilot-helper

# Create config file
cat > ~/.config/ast-copilot-helper/config.json << 'EOF'
{
  "topK": 20,
  "enableTelemetry": false
}
EOF
```

**Cross-Platform Support:**

- **Linux/macOS**: Uses XDG Base Directory Specification
- **Windows**: Falls back to `~/.config` (works with WSL and native Windows)
- **Environment Override**: Set `XDG_CONFIG_HOME` to customize location

### Available MCP Tools

The server exposes these tools for AI agents:

| Tool                   | Description                             |
| ---------------------- | --------------------------------------- |
| `query_ast_context`    | Semantic search across your codebase    |
| `ast_file_query`       | Analyze specific files with AST parsing |
| `ast_index_status`     | Get indexing status and statistics      |
| `ast_find_references`  | Find all references to a symbol         |
| `ast_find_definitions` | Locate symbol definitions               |
| `ast_symbol_search`    | Search for symbols by name or pattern   |

### VS Code Extension Integration

The VS Code extension provides seamless MCP client integration:

- **Automatic Server Management**: Extension spawns and manages the MCP server process
- **Custom Transport**: Uses managed process with sophisticated lifecycle handling
- **Connection Monitoring**: Auto-reconnect, heartbeat, health checks
- **Status Bar Integration**: Real-time connection status indicator
- **Output Channel**: Detailed logs for debugging

#### Extension Features

```typescript
// The extension uses real MCP SDK with custom Transport
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

// Custom Transport wraps managed process
class ManagedProcessTransport implements Transport {
  // Handles JSON-RPC over stdin/stdout
  // Preserves VS Code extension's process management
}

// Client connects to server
await client.connect(transport);
const result = await client.callTool({
  name: "query_ast_context",
  arguments: { query: "find all functions" },
});
```

### Architecture Benefits

**Why Custom Transport?**

- Preserves VS Code extension patterns (extensions manage their servers)
- Enables custom monitoring, logging, and UI integration
- Allows sophisticated restart logic and health checks
- MCP server remains usable by other tools (Claude Desktop, Cline)

**Process Lifecycle**

```
ServerProcessManager → Spawns & monitors MCP server
     ↓
ManagedProcessTransport → Wraps process stdio for JSON-RPC
     ↓
MCP SDK Client → Standard protocol communication
     ↓
AI Agent → Queries codebase semantically
```

### Use Cases

- **Claude Desktop**: Chat with your codebase using Claude
- **VS Code Extension**: Integrated code understanding in your editor
- **Cline**: AI-powered code generation with context
- **Custom Integrations**: Build your own MCP-compatible tools

**[📖 MCP Testing Guide →](docs/testing/manual-mcp-testing.md)** • **[🔧 Integration Status →](docs/reports/MCP_CLIENT_INTEGRATION_STATUS.md)**

## 🔒 Security Features

AST Copilot Helper includes comprehensive security features for model verification and secure downloads:

### Model Verification & Security

- **✅ SHA256 Checksum Verification**: Automatic integrity validation for all downloaded models
- **🔐 Digital Signature Verification**: RSA/ECDSA signature validation for model authenticity
- **🛡️ Security Hooks System**: Extensible pre/post download verification framework
- **📋 Comprehensive Audit Logging**: Security event tracking with JSONL-based audit trails
- **⚠️ Automatic Quarantine**: Suspect files automatically quarantined for investigation

### Security Components

```typescript
import {
  SignatureVerifier,
  SecurityHooksManager,
  securityLogger,
  SecurityEventType,
} from "@ast-copilot-helper/ast-helper";

// Initialize signature verification
const verifier = new SignatureVerifier();
await verifier.initialize();

// Add trusted public key
await verifier.addPublicKey("model-provider-key", publicKeyPem, {
  keyId: "model-provider-key",
  algorithm: "RSA",
  issuedBy: "Model Provider Inc",
  validUntil: new Date("2026-12-31"),
});

// Security hooks automatically validate downloads
const hooksManager = new SecurityHooksManager();

// Register custom security hook
hooksManager.registerHook(HookType.PRE_DOWNLOAD, async (context) => {
  // Custom validation logic
  return {
    allowed: true,
    errors: [],
    warnings: [],
  };
});

// Query security audit log
const recentEvents = await securityLogger.getRecentEvents(100, {
  type: SecurityEventType.VERIFICATION_FAILED,
  severity: SecuritySeverity.ERROR,
});
```

**Default Security Checks:**

- HTTPS URL validation (prevents insecure downloads)
- Metadata validation (ensures required fields)
- File integrity verification (SHA256 checksums)
- Digital signature verification (when signatures provided)

**[📚 Security Guide](docs/guide/security.md)** • **[🔐 API Reference](docs/api/security.md)**

## ⚡ Performance & Architecture

AST Copilot Helper uses a **native-first architecture** combining TypeScript flexibility with Rust performance:

### Hybrid Engine Architecture

AST Copilot Helper uses a **hybrid Rust architecture** optimized for both performance and ease of distribution:

| Component           | Technology | Distribution       | Rationale                       |
| ------------------- | ---------- | ------------------ | ------------------------------- |
| **Vector Database** | Rust       | WASM (universal)   | One binary for all platforms    |
| **AST Processing**  | Rust       | Native (if needed) | Maximum performance for parsing |
| **TypeScript Core** | TypeScript | Universal          | Cross-platform business logic   |

### Key Performance Features

- **🚀 Rust-Powered Operations**: High-performance vector similarity search and AST processing
- **📦 Smart Distribution**: WASM for universal compatibility, native where performance critical
- **🌍 Zero Install Friction**: WASM eliminates platform-specific binary issues
- **🔄 Smart Language Detection**: Intelligent grammar loading and caching
- **💾 Incremental Processing**: Smart cache invalidation and differential updates

**Current Performance Characteristics:**

- AST parsing: 1-50ms depending on language tier and file size
- Vector search: High-performance Rust operations (compiled to WASM for universal deployment)
- Batch processing: 5000+ files with intelligent memory management
- Language support: 15 languages across 3 performance tiers

**Architecture Note**: Vector database uses **Rust compiled to WebAssembly** for universal compatibility. While WASM adds ~10-30% overhead vs native, it eliminates platform-specific build complexity and ensures "npm install just works" everywhere.

## CI/CD Pipeline

This project implements a comprehensive CI/CD pipeline with 36 acceptance criteria across 6 categories:

### 🚀 Pipeline Features

- **Multi-platform builds**: Windows, macOS, Linux with Node.js 20, 22, 24
- **Comprehensive testing**: Unit, integration, and performance tests
- **Quality gates**: 90%+ coverage, security scanning, performance validation
- **Blue-Green deployment**: Zero-downtime staging and production deployments
- **Real-time monitoring**: Performance tracking, alerting, and interactive dashboards
- **Multi-channel notifications**: Slack, email, and GitHub integration

### 📊 Monitoring & Alerts

- **Performance monitoring** with trend analysis and A-F grading
- **Real-time dashboards** with Chart.js visualization and auto-refresh
- **Intelligent alerting** with escalation rules and cooldown management
- **Build failure notifications** with multi-channel delivery

### 🔧 CI/CD Commands

```bash
# Quality gates
yarn run ci:quality-gate
yarn run ci:security-scan
yarn run ci:performance-score

# Deployment
yarn run ci:deploy-staging
yarn run ci:deploy-production
yarn run ci:health-check
yarn run ci:rollback

# Monitoring
yarn run ci:performance-monitor
yarn run ci:monitoring-dashboard
yarn run ci:alerting-system
```

For complete CI/CD documentation, see [docs/CI-CD-PIPELINE.md](docs/CI-CD-PIPELINE.md).

## Development

### Building

Build all packages:

```bash
yarn run build
```

Build and watch for changes:

```bash
yarn run build:watch
```

### Testing

We have a multi-tiered testing strategy optimized for both development speed and comprehensive validation:

### Testing Strategy

We use a multi-tiered testing approach optimized for different development phases:

#### Git Hook Testing (Automated)

- **Pre-commit** (~30-45 seconds): Essential unit tests + type checking + linting
  - Runs fastest subset to catch basic issues before commit
  - Prevents broken code from entering the repository
- **Pre-push** (~1-2 minutes): Comprehensive fast tests + build verification
  - All tests except performance benchmarks
  - Ensures code is ready to be shared/reviewed

#### Manual Testing Commands

```bash
# Essential unit tests only (fastest, used by pre-commit)
yarn run test:unit

# Fast comprehensive tests (used by pre-push, excludes benchmarks)
yarn run test:fast
yarn run test:precommit  # Alias for test:fast

# Integration and end-to-end tests
yarn run test:integration

# Complete test suite including performance benchmarks
yarn run test:all  # Takes 5-7 minutes, use sparingly
```

#### Performance & Benchmarks

```bash
# Performance benchmarks (slowest tests)
yarn run test:benchmarks
```

#### Comprehensive Testing

```bash
# Run ALL tests (unit + integration + benchmarks) - use for thorough validation
yarn run test:all
yarn run test:dev        # Same as above
yarn run test:comprehensive  # Same as above
```

#### With Coverage

```bash
yarn run test:coverage
```

**Git Hook Strategy:**

- **Pre-commit**: Fast tests only (type-check, lint, fast unit tests, build)
- **Pre-push**: Comprehensive tests (unit + integration, skip benchmarks)
- **Manual/CI**: All tests including performance benchmarks

### Type Checking

Check TypeScript types across all packages:

```bash
yarn run typecheck
```

### Package-Specific Commands

You can run commands in specific packages:

```bash
# Run commands in ast-copilot-helper package
cd packages/ast-copilot-helper
yarn run build
yarn run dev
yarn test

# Run commands in ast-mcp-server package
cd packages/ast-mcp-server
yarn run build
yarn run dev
yarn test

# Run commands in vscode-extension package
cd packages/vscode-extension
yarn run build
yarn run dev
yarn test
```

## Security Framework

This project includes a comprehensive security framework designed to protect against common vulnerabilities and ensure secure AST processing workflows.

### Security Features

- **🔒 Comprehensive Security Auditing**: Multi-layer security analysis with OWASP, CWE, and NIST compliance
- **🛡️ Input Validation System**: Advanced input sanitization and validation with XSS, SQL injection, and path traversal protection
- **🔍 Vulnerability Scanning**: Automated detection of security patterns, hardcoded credentials, and insecure cryptographic practices
- **🔧 Security Hardening Framework**: Policy enforcement, access control, and security configuration management
- **📊 Security Integration Testing**: End-to-end security workflow validation with performance monitoring

### Security Components

The security framework consists of four core modules:

1. **ComprehensiveSecurityAuditor** (`packages/ast-copilot-helper/src/security/auditor.ts`)
   - Performs comprehensive security audits with OWASP/CWE/NIST compliance
   - Generates detailed security reports with risk scoring and remediation guidance
   - Supports dependency vulnerability scanning and policy enforcement

2. **ComprehensiveInputValidator** (`packages/ast-copilot-helper/src/security/input-validator.ts`)
   - Advanced input validation and sanitization engine
   - Protection against XSS, SQL injection, command injection, and path traversal
   - Context-aware validation with custom rule support

3. **VulnerabilityScanner** (`packages/ast-copilot-helper/src/security/vulnerability-scanner.ts`)
   - Pattern-based vulnerability detection for common security issues
   - Supports hardcoded credential detection, insecure crypto practices, and injection vulnerabilities
   - Real-time risk scoring and finding categorization

4. **SecurityHardeningFramework** (`packages/ast-copilot-helper/src/security/security-hardening-framework.ts`)
   - Security policy enforcement and configuration management
   - Access control validation and permission management
   - Security baseline compliance checking

### Security Testing

Comprehensive test coverage ensures security framework reliability:

- **139+ Unit Tests**: Core security functionality validation (100% success rate)
- **14 Integration Tests**: End-to-end security workflow testing
- **Real-world Scenarios**: SQL injection, XSS, cryptographic vulnerability testing
- **Performance Validation**: Security operations under load testing

Run security tests:

```bash
# All security unit tests
yarn test packages/ast-copilot-helper/src/security/

# Integration security tests
yarn test tests/integration/security-integration.test.ts

# Complete security test suite
yarn run test:security
```

### Security Configuration

Security settings are configured via the security config system:

```typescript
import { DEFAULT_SECURITY_CONFIG } from "packages/ast-copilot-helper/src/security/config";

// Default security configuration includes:
// - OWASP/CWE/NIST compliance frameworks
// - Input validation rules and sanitization
// - Vulnerability detection patterns
// - Security hardening policies
```

For detailed security information, see [SECURITY.md](SECURITY.md).

## Usage

## Quick Start

### 1. Parse Your Code

Extract semantic information from your codebase:

```bash
# Initialize configuration and database
# Automatically creates .gitignore to exclude .astdb/ directory
yarn ast-copilot-helper init

# Skip .gitignore creation if you have custom version control setup
yarn ast-copilot-helper init --no-gitignore

# Parse a directory
yarn ast-copilot-helper parse src/

# Parse with natural language query
yarn ast-copilot-helper query "functions that handle authentication"
```

**Note:** The `init` command automatically creates or updates `.gitignore` to exclude the `.astdb/` directory (database files, vector indexes, models, cache) from version control. This prevents accidentally committing large generated files. Use `--no-gitignore` if you prefer custom gitignore handling.

#### Git Integration for Smart Parsing

Process only the files you care about using git-aware modes:

```bash
# Pre-commit validation - parse only staged files
yarn ast-copilot-helper parse --staged

# PR validation - parse files changed since main branch
yarn ast-copilot-helper parse --base main

# Development workflow - parse all working directory changes
yarn ast-copilot-helper parse --changed

# Feature branch comparison - parse changes since develop
yarn ast-copilot-helper parse --base origin/develop
```

**Use Cases:**

- **Pre-commit hooks**: `--staged` ensures only staged files are validated before commit
- **CI/CD pipelines**: `--base main` validates only files changed in PR
- **Local development**: `--changed` provides quick feedback on modified code
- **Branch reviews**: `--base <branch>` compares against any git reference

### 2. Watch for Changes

Monitor your codebase for changes with intelligent incremental updates:

```bash
# Basic watch mode (parse only)
yarn ast-copilot-helper watch

# Full pipeline: parse → annotate → embed
yarn ast-copilot-helper watch --full-pipeline

# Parse and annotate only (no embedding)
yarn ast-copilot-helper watch --full-pipeline --no-embed

# Watch with custom glob pattern
yarn ast-copilot-helper watch --glob "src/**/*.ts"

# Optimize for large codebases
yarn ast-copilot-helper watch --batch-size 100 --debounce 500
```

**Key Features:**

- **Intelligent Skip Detection**: Automatically skips files with unchanged content using SHA256 hashing
- **Content-Based Rename Detection**: Detects renamed/moved files using content hashes without re-parsing
- **Cross-Directory Moves**: Tracks file moves across directories (e.g., `src/old.ts` → `lib/new.ts`)
- **Two-Pass Analysis**: First detects deletions, then matches additions to prevent false positives
- **Persistent State**: Resumes from crash with `.astdb/watch-state.json`
- **Pipeline Integration**: Optional automatic annotation via Rust CLI and embedding
- **Performance Statistics**: Tracks files processed, skipped, errors, and timing

**Rename Detection Workflow:**

1. **Pass 1 - Deletions**: Identify deleted files and store their content hashes
2. **Pass 2 - Additions**: Match new files against deleted file hashes
3. **Rename Window**: 5-second window to match renames (configurable)
4. **Database Update**: Update paths in database instead of re-parsing

**Performance Impact:**

- **Without Rename Detection**: ~500ms per file (full re-parse)
- **With Rename Detection**: ~50ms per file (database path update)
- **Savings**: ~90% faster for renamed/moved files

**Use Cases:**

- **Development Workflow**: Automatic parsing as you code with instant feedback
- **Long-Running Sessions**: Stable memory usage with auto-save and crash recovery
- **CI/CD Integration**: Watch mode for continuous validation during development
- **Large Codebases**: Smart batching and skip detection for optimal performance

### 3. Model Verification & Registry

Manage and verify ONNX embedding models with built-in security:

```bash
# Register a new model in the registry
yarn ast-helper model register my-model \\
  --version 1.0.0 \\
  --url https://example.com/model.onnx \\
  --checksum sha256:abc123... \\
  --format onnx

# Verify model integrity (checksum, format, optional signature)
yarn ast-helper model verify my-model

# List all registered models
yarn ast-helper model list

# View model details and verification history
yarn ast-helper model info my-model

# Delete a model from registry
yarn ast-helper model delete my-model
```

**Key Features:**

- **🔐 SHA256 Checksum Verification**: Automatic integrity validation on download and use
- **✍️ Digital Signature Verification**: Optional RSA/ECDSA signature validation for authenticity
- **📝 Verification History**: Complete audit trail of all verification attempts
- **📊 Statistics Dashboard**: Track verification success rates and model health
- **🗄️ SQLite Registry**: Persistent model metadata storage

**Verification Workflow:**

1. Model is registered with URL, checksum, and optional signature
2. On first use, model is downloaded and verified (checksum + signature)
3. Verification status is recorded in registry with timestamp
4. Subsequent uses check if re-verification is needed (configurable interval)
5. Failed verifications are logged with detailed error messages

### 4. Query Cache Management

Optimize query performance with multi-level caching:

```bash
# Warm the cache with frequently used queries
yarn ast-helper cache warm --top 50

# Analyze cache performance and hit rates
yarn ast-helper cache analyze

# Prune old or least-used cache entries
yarn ast-helper cache prune --max-age 30 --max-entries 1000

# Clear all caches (L1 memory, L2 disk, L3 database)
yarn ast-helper cache clear

# View cache statistics
yarn ast-helper cache stats
```

**Cache Architecture:**

- **L1 (Memory)**: Hot queries, ~100ms access time, LRU eviction
- **L2 (Disk)**: Recent queries, ~500ms access time, size-based eviction
- **L3 (Database)**: Historical queries, ~2s access time, TTL-based cleanup

**Key Features:**

- **📈 Automatic Promotion**: L3 hits promoted to L2, L2 hits promoted to L1
- **🔄 Smart Invalidation**: Automatic cache invalidation on file/index changes
- **📊 Query Analytics**: Track query frequency, execution time, and cache hit rates
- **🎯 Cache Warming**: Pre-populate cache with frequently used queries
- **⚡ Performance Gains**: Up to 10x faster on cached queries

**Use Cases:**

- **Production Optimization**: Pre-warm cache with common queries before deployment
- **Development Speed**: Cache warm during dev for instant query responses
- **Resource Management**: Prune old cache entries to manage disk space
- **Performance Monitoring**: Analyze cache hit rates and query patterns

### 5. Start MCP Server

Enable AI agent integration:

```bash
# Start the MCP server
yarn ast-mcp-server --port 3000

# Or use VS Code extension for integrated experience
code --install-extension ast-copilot-helper
```

### 3. Explore Documentation

- **[Getting Started](docs/guide/getting-started.md)** - Complete setup guide
- **[CLI Usage](docs/guide/cli-usage.md)** - Command-line interface
- **[VS Code Extension](docs/guide/vscode-extension.md)** - IDE integration
- **[API Reference](docs/api/)** - Programmatic usage

## Technical Foundation

- **🏗️ Monorepo**: Yarn v4 workspaces with TypeScript project references
- **⚡ TypeScript**: Strict configuration targeting ES2022 with full type safety
- **� Rust Core**: High-performance native engine via NAPI bindings
- **�🧪 Testing**: Comprehensive test suite with Vitest (unit, integration, benchmarks)
- **🔄 CI/CD**: Automated testing, quality gates, and deployment pipeline with binary releases
- **🌐 Cross-Platform**: Full Windows, macOS, and Linux support (x64, arm64)

## Current Status

AST Copilot Helper is **production-ready** with:

- ✅ **Complete AST processing** for 15 programming languages
- ✅ **Functional MCP server** with semantic query capabilities
- ✅ **VS Code extension** with integrated workflow
- ✅ **Comprehensive security framework** with vulnerability scanning
- ✅ **Advanced CI/CD pipeline** with monitoring and automated deployments
- ✅ **188 unit tests**, **187 integration tests**, **207 benchmark tests** (all passing)

## Community & Support

### 📋 Getting Help

- **[🐛 Bug Reports](.github/ISSUE_TEMPLATE/bug_report.md)** - Issues with reproduction steps
- **[✨ Feature Requests](.github/ISSUE_TEMPLATE/feature_request.md)** - New feature suggestions
- **[� Discussions](https://github.com/EvanDodds/ast-copilot-helper/discussions)** - Community Q&A
- **[� Documentation](.github/ISSUE_TEMPLATE/documentation.md)** - Doc improvements

### 📖 Community Resources

- **[Code of Conduct](CODE_OF_CONDUCT.md)** - Community standards
- **[Security Policy](SECURITY.md)** - Responsible disclosure
- **[Support Guide](.github/SUPPORT.md)** - How to get help

## Contributing

We welcome contributions! See our **[Contributing Guide](CONTRIBUTING.md)** for comprehensive details.

### Quick Contributor Setup

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/ast-copilot-helper.git
cd ast-copilot-helper

# 2. Install and build
yarn install
yarn build

# 3. Run tests
yarn test:fast        # Quick validation
yarn test:all         # Full test suite

# 4. Create feature branch and submit PR
git checkout -b feature/your-feature
# ... make changes ...
git commit -m "feat: your feature"
git push origin feature/your-feature
```

📋 **Use our templates**: [Issues](.github/ISSUE_TEMPLATE/) • [Pull Requests](.github/pull_request_template.md)  
💬 **Join discussions**: [GitHub Discussions](https://github.com/EvanDodds/ast-copilot-helper/discussions)  
❓ **Get help**: [Support Guide](.github/SUPPORT.md)  
🚀 **For maintainers**: [Release Process Guide](docs/development/release-process.md)

## License & Security

- **License**: MIT License - see [LICENSE](LICENSE) for details
- **Security**: Report vulnerabilities via [GitHub Security Advisories](https://github.com/EvanDodds/ast-copilot-helper/security/advisories)

---

**[📚 Full Documentation](docs/)** • **[🚀 Getting Started](docs/guide/getting-started.md)** • **[🤝 Contributing](CONTRIBUTING.md)**
