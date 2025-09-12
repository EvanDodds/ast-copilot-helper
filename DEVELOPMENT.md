# Development Guide

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Build all packages**
   ```bash
   npm run build
   ```

3. **Run tests**
   ```bash
   npm run test:all
   ```

## Development Workflow

### Testing

Our testing strategy follows a comprehensive approach with multiple layers:

```bash
# Unit tests (fast, isolated)
npm run test:unit

# Integration tests (component interaction)
npm run test:integration

# Performance benchmarks (acceptance criteria validation)
npm run test:benchmarks

# Full test suite with coverage
npm run test:coverage

# Interactive test UI
npm run test:ui

# Watch mode for development
npm run test:watch
```

### Performance Requirements

Our codebase must meet strict performance criteria:

- **AST Parsing**: Handle 15,000+ nodes in under 10 minutes
- **MCP Server**: Query latency < 200ms average
- **CLI Tool**: Query latency < 500ms average
- **Memory**: Efficient memory usage for large repositories

Run benchmarks to validate: `npm run test:benchmarks`

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
npm run dev                 # Start all packages in dev mode
npm run build:watch        # Build packages in watch mode

# Quality
npm run lint               # Lint all packages
npm run lint:fix          # Auto-fix linting issues
npm run type-check        # TypeScript type checking

# Security
npm run security:audit    # Check for vulnerabilities
npm run security:fix      # Auto-fix security issues

# Dependencies
npm run deps:check        # Check for outdated packages
npm run deps:update       # Update dependencies

# Cleanup
npm run clean             # Clean build artifacts
npm run clean:all         # Deep clean including node_modules
```

## Package Architecture

### AST Helper (`packages/ast-helper`)
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
   npm run clean:all && npm install && npm run build
   ```

2. **Test Failures**
   ```bash
   # Check specific test output
   npm run test:unit -- --reporter=verbose
   
   # Run specific test file
   npx vitest path/to/test.test.ts
   ```

3. **Performance Issues**
   ```bash
   # Run benchmarks to identify bottlenecks
   npm run test:benchmarks
   
   # Profile specific operations
   npm run test:benchmarks -- --reporter=verbose
   ```

4. **Type Checking Issues**
   ```bash
   # Clean type cache and rebuild
   npm run clean && npm run type-check
   ```

### Getting Help

- Check existing issues in the repository
- Review test output for specific error details
- Run benchmarks to validate performance assumptions
- Use `npm run test:ui` for interactive debugging