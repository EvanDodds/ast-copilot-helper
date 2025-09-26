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

- **Multi-platform builds**: Windows, macOS, Linux with Node.js 18, 20, 21
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
   - Node.js version matrix (18, 20, 21)
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
