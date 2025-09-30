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
- **Integration Tests**: Tests WASM bindings and Node.js integration
- **Code Quality**: Clippy linting catches common issues and suggests improvements
- **Formatting**: Consistent code style with `rustfmt`

#### Performance Considerations

The Rust core engine is optimized for development speed:

- Development builds skip full optimization for faster iteration
- Production builds use full optimization for maximum performance
- Testing validates both compilation correctness and runtime behavior

### Native-First Architecture with WASM Development

The core engine uses a native-first approach with NAPI bindings for production deployments, with WASM builds planned for future universal deployment.

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

#### WASM Build Infrastructure (In Development)

WASM build infrastructure is implemented but currently limited by dependency compatibility.

**Prerequisites:**

```bash
# Install WASM target (configured but not production-ready)
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

**Build Commands (Development Only):**

```bash
# WASM build attempts (currently blocked by dependency issues)
cd packages/ast-core-engine
npm run build:wasm         # Will fail due to tokio/mio incompatibility
npm run build:wasm:release # Not currently functional
```

**Current WASM Limitations:**

- `tokio` with networking features requires `mio` which doesn't support WASM
- Vector database dependencies may have similar compatibility issues
- See `packages/ast-core-engine/WASM_BUILD_NOTES.md` for full technical analysis

#### Native-First Code Structure

The codebase is structured for native performance with WASM compatibility planned:

```rust
// Native-optimized code (current production target)
use napi::bindgen_prelude::*;
use tokio::runtime::Runtime;

// WASM-compatible subset (future target)
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

// Conditional compilation for different targets
#[cfg(not(target_arch = "wasm32"))]
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

2. **Release Pipeline** (`.github/workflows/release.yml`)
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
