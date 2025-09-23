# AST Copilot Helper

A monorepo fo## Prerequisites

- **Node.js**: 20.0.0 or higher
- **Yarn**: 4.9.4 or higher (modern Yarn v4)
- **Operating Systems**: Windows, macOS, Linux (x64, arm64)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/EvanDodds/ast-copilot-helper.git
cd ast-copilot-helper
yarn install
```

This will:

1. Install all dependencies using Yarn v4 workspaces
2. Set up inter-package linking
3. Build all packages automaticallylysis tools and Model Context Protocol (MCP) server implementation.

## Overview

This project provides a comprehensive toolkit for analyzing Abstract Syntax Trees (ASTs) of codebases and serving that data through a Model Context Protocol server. It consists of three main packages:

- **`ast-helper`** - CLI data processor that builds `.astdb/` database from source code
- **`ast-mcp-server`** - MCP protocol server that serves AST data from the database
- **`vscode-extension`** - VS Code extension for managing AST helper processes (optional)

## Architecture

```
ast-copilot-helper/
├─ packages/
│  ├─ ast-helper/            # CLI data processor
│  │  ├─ src/                # TypeScript source files
│  │  ├─ bin/                # Executable scripts
│  │  └─ dist/               # Compiled output
│  ├─ ast-mcp-server/        # MCP protocol server
│  │  ├─ src/                # TypeScript source files
│  │  ├─ bin/                # Executable scripts
│  │  └─ dist/               # Compiled output
│  └─ vscode-extension/      # VS Code extension
│     ├─ src/                # TypeScript source files
│     └─ dist/               # Compiled output
├─ tests/
│  ├─ fixtures/              # Small test repositories
│  └─ benchmarks/            # Performance test fixtures
├─ package.json              # Root workspace configuration
├─ tsconfig.json             # Root TypeScript config
├─ tsconfig.base.json        # Base TypeScript configuration
└─ README.md                 # This file
```

## Requirements

- **Node.js**: 20.0.0 or higher
- **npm**: Comes with Node.js
- **Operating Systems**: Windows, macOS, Linux (x64, arm64)

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/EvanDodds/ast-copilot-helper.git
cd ast-copilot-helper
yarn install
```

This will:

1. Install all dependencies using npm workspaces
2. Set up inter-package linking
3. Build all packages automatically

## CI/CD Pipeline

This project implements a comprehensive CI/CD pipeline with 36 acceptance criteria across 6 categories:

### 🚀 Pipeline Features
- **Multi-platform builds**: Windows, macOS, Linux with Node.js 18, 20, 21
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
# Run commands in ast-helper package
cd packages/ast-helper
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

1. **ComprehensiveSecurityAuditor** (`packages/ast-helper/src/security/auditor.ts`)
   - Performs comprehensive security audits with OWASP/CWE/NIST compliance
   - Generates detailed security reports with risk scoring and remediation guidance
   - Supports dependency vulnerability scanning and policy enforcement

2. **ComprehensiveInputValidator** (`packages/ast-helper/src/security/input-validator.ts`)
   - Advanced input validation and sanitization engine
   - Protection against XSS, SQL injection, command injection, and path traversal
   - Context-aware validation with custom rule support

3. **VulnerabilityScanner** (`packages/ast-helper/src/security/vulnerability-scanner.ts`)
   - Pattern-based vulnerability detection for common security issues
   - Supports hardcoded credential detection, insecure crypto practices, and injection vulnerabilities
   - Real-time risk scoring and finding categorization

4. **SecurityHardeningFramework** (`packages/ast-helper/src/security/security-hardening-framework.ts`)
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
yarn test packages/ast-helper/src/security/

# Integration security tests  
yarn test tests/integration/security-integration.test.ts

# Complete security test suite
yarn run test:security
```

### Security Configuration

Security settings are configured via the security config system:

```typescript
import { DEFAULT_SECURITY_CONFIG } from 'packages/ast-helper/src/security/config';

// Default security configuration includes:
// - OWASP/CWE/NIST compliance frameworks
// - Input validation rules and sanitization
// - Vulnerability detection patterns  
// - Security hardening policies
```

For detailed security information, see [SECURITY.md](SECURITY.md).

## Usage

### AST Helper CLI

Process source code and build AST database:

```bash
node packages/ast-helper/bin/ast-helper
# or after building:
# ./packages/ast-helper/bin/ast-helper
```

### MCP Server

Start the Model Context Protocol server:

```bash
node packages/ast-mcp-server/bin/ast-mcp-server
# or after building:
# ./packages/ast-mcp-server/bin/ast-mcp-server
```

## Project Structure

- **Monorepo**: Uses npm workspaces for package management
- **TypeScript**: Strict TypeScript configuration with ES2022 target
- **Build System**: TypeScript project references for fast incremental builds
- **Testing**: Vitest for unit testing with coverage reports
- **Cross-Platform**: Windows, macOS, and Linux support

## Development Status

This project is currently in the foundational setup phase. The monorepo structure and build system are complete, with basic CLI entry points created for each package. Future development will implement the actual AST processing, MCP server functionality, and VS Code extension features.

## Community & Support

We welcome contributions and feedback from the community! This project includes comprehensive community support infrastructure:

### 📋 Issue Templates
Use our structured issue templates when reporting:
- **🐛 Bug Reports** - Report issues with detailed reproduction steps
- **✨ Feature Requests** - Suggest new features with use cases
- **⚡ Performance Issues** - Report performance problems with profiling data  
- **📚 Documentation** - Improvements to documentation
- **❓ Questions** - Get help with usage or development

### 💬 GitHub Discussions
Join our community discussions:
- **💡 Ideas & Features** - Brainstorm new capabilities
- **❓ Q&A** - Get help from maintainers and community
- **📣 Show & Tell** - Share your projects using AST Copilot Helper
- **🗳️ Polls** - Participate in project decisions

### 📖 Community Guidelines
- **[Contributing Guide](CONTRIBUTING.md)** - Comprehensive development setup and workflow
- **[Code of Conduct](CODE_OF_CONDUCT.md)** - Community standards and expectations
- **[Community Guidelines](COMMUNITY.md)** - Interaction guidelines and resources
- **[Support Guide](.github/SUPPORT.md)** - Getting help and reporting issues

### 🤖 Automated Maintenance
This project includes comprehensive automation for health and maintenance:
- **Dependency Updates** - Automated security and compatibility updates
- **Repository Health Checks** - Regular codebase health monitoring  
- **Community Analytics** - Track project growth and engagement
- **Cleanup Automation** - Automated cleanup of build artifacts and stale files

### 📊 Community Analytics
We track community health and growth:
- **Contributor Metrics** - Track new and returning contributors
- **Issue & PR Analytics** - Monitor resolution times and patterns
- **Engagement Tracking** - Measure community participation
- **Automated Reports** - Daily analytics with trend analysis

All analytics are automated and help us understand project health while respecting contributor privacy.

## Contributing

We welcome contributions from the community! Please see our **[Contributing Guide](CONTRIBUTING.md)** for detailed information on:

- 🛠️ **Development Setup** - Environment configuration and tooling
- 🔄 **Development Workflow** - Git flow, branching, and PR process  
- ✅ **Testing Requirements** - Unit, integration, and performance testing
- 📋 **Code Standards** - TypeScript configuration and style guidelines
- 🚀 **Release Process** - How releases are managed and published

### Quick Start for Contributors:
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Follow the [development workflow](CONTRIBUTING.md#development-workflow)
4. Ensure all tests pass: `npm test`
5. Build and verify: `yarn run build`
6. Submit a pull request using our [PR template](.github/pull_request_template.md)

For questions about contributing, start a [discussion](https://github.com/EvanDodds/ast-copilot-helper/discussions) or check our [support guide](.github/SUPPORT.md).

## License

MIT License - see LICENSE file for details.

## Security

For security vulnerabilities, please follow responsible disclosure practices and report issues privately through GitHub's security advisories.
