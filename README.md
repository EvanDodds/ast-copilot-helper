# AST Copilot Helper

A comprehensive toolkit for Abstract Syntax Tree analysis and Model Context Protocol (MCP) server implementation, enabling AI agents to understand and query codebases with semantic intelligence across **15 programming languages**.

## 🚀 AI-Powered Code Understanding

Transform your codebase into an AI-accessible knowledge base:

- **🔍 Semantic Search**: Query code using natural language
- **🤖 MCP Integration**: Enable AI agents to understand your code structure
- **⚡ Performance**: Fast parsing with intelligent caching and incremental updates
- **🌐 Multi-Language**: Support for 15 programming languages across 3 tiers

### 🏢 Tier 1: Enterprise (6 languages)

TypeScript • JavaScript • Python • Java • C++ • C#

### 👩‍💻 Tier 2: Developer (5 languages)

Go • Rust • PHP • Ruby • Swift

### 🎯 Tier 3: Specialized (4 languages)

Kotlin • Scala • Dart • Lua

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
- **`@ast-helper/core-engine`** - High-performance Rust engine for AST processing (NAPI + WASM)
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
│  │  ├─ src/                       # Rust source (NAPI + WASM)
│  │  ├─ pkg/                       # WASM package output
│  │  ├─ target/                    # Rust build artifacts
│  │  ├─ index.js                   # NAPI bindings
│  │  └─ *.node                     # Native binaries
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

| Tier               | Languages                                     | Use Cases                                       |
| ------------------ | --------------------------------------------- | ----------------------------------------------- |
| **🏢 Enterprise**  | TypeScript, JavaScript, Python, Java, C++, C# | Production applications, enterprise codebases   |
| **👩‍💻 Developer**   | Go, Rust, PHP, Ruby, Swift                    | Popular development languages, strong community |
| **🎯 Specialized** | Kotlin, Scala, Dart, Lua                      | Domain-specific, emerging technologies          |

### Quick Example

```typescript
import { ParserFactory } from "@ast-copilot-helper/ast-copilot-helper";

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

## ⚡ Performance & Deployment

AST Copilot Helper uses a **hybrid architecture** combining TypeScript flexibility with Rust performance:

### Dual Engine Architecture

| Target               | Use Case                   | Performance          | Compatibility              |
| -------------------- | -------------------------- | -------------------- | -------------------------- |
| **NAPI (Native)**    | Node.js servers, CLI tools | 🔥 100% native speed | Platform-specific binaries |
| **WASM (Universal)** | Browsers, edge computing   | ⚡ ~80% native speed | Universal compatibility    |

### Key Performance Features

- **🚀 High-Performance Core**: Rust engine for compute-intensive operations
- **⚖️ Smart Load Balancing**: Automatic selection between NAPI/WASM based on environment
- **📦 Optimized Bundles**: WASM builds optimized for size, NAPI for speed
- **🔄 Zero-Copy Operations**: Direct memory access where possible
- **💾 Intelligent Caching**: Incremental parsing with smart cache invalidation

**Performance Targets:**

- Vector search: <50ms for 100k+ vectors
- Batch processing: 5000+ files without memory throttling
- Memory usage: 50-70% reduction vs pure TypeScript
- WASM overhead: ~20% vs native, with universal compatibility

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
# Initialize configuration
yarn ast-copilot-helper init

# Parse a directory
yarn ast-copilot-helper parse src/

# Parse with natural language query
yarn ast-copilot-helper query "functions that handle authentication"
```

### 2. Start MCP Server

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
- **🧪 Testing**: Comprehensive test suite with Vitest (unit, integration, benchmarks)
- **🔄 CI/CD**: Automated testing, quality gates, and deployment pipeline
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

## License & Security

- **License**: MIT License - see [LICENSE](LICENSE) for details
- **Security**: Report vulnerabilities via [GitHub Security Advisories](https://github.com/EvanDodds/ast-copilot-helper/security/advisories)

---

**[📚 Full Documentation](docs/)** • **[🚀 Getting Started](docs/guide/getting-started.md)** • **[🤝 Contributing](CONTRIBUTING.md)**
