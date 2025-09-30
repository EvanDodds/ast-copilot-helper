# Contributing to ast-copilot-helper

Thank you for your interest in contributing to ast-copilot-helper! This document provides guidelines and information for contributors.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Community Guidelines](#community-guidelines)
- [Advanced Development](#advanced-development)

## Getting Started

### Prerequisites

- Node.js 20.0.0 or higher (24.0.0+ recommended)
- Yarn 4.9.4 or higher (modern Yarn v4)
- Git 2.40.0 or higher
- VS Code (recommended for the best development experience)

### Quick Start

1. Fork and clone the repository
2. Install dependencies: `yarn install`
3. Build the project: `yarn run build`
4. Run tests: `yarn test`
5. Start development: `yarn run dev`

### Development Setup

#### 1. Fork and Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/ast-copilot-helper.git
cd ast-copilot-helper
```

#### 2. Install Dependencies

```bash
yarn install
```

This will install dependencies for all packages in the monorepo.

#### 3. Build the Project

```bash
yarn run build
```

Build all packages to ensure everything compiles correctly.

#### 4. Verify Installation

```bash
yarn test
yarn run lint
```

### Project Structure

```
ast-copilot-helper/
├── packages/
│   ├── ast-helper/                  # CLI tool and core library
│   │   ├── src/            # Source code
│   │   ├── bin/            # CLI executables
│   │   └── test/           # Package-specific tests
│   ├── ast-mcp-server/     # Model Context Protocol server
│   │   ├── src/            # Server implementation
│   │   └── test/           # MCP server tests
│   └── vscode-extension/   # VS Code extension
│       ├── src/            # Extension source
│       └── test/           # Extension tests
├── docs/                   # Documentation
├── scripts/                # Build and utility scripts
├── tests/                  # Integration and E2E tests
└── examples/               # Usage examples
```

## Contributing Guidelines

### Types of Contributions

We welcome various types of contributions:

- 🐛 **Bug fixes** - Fix existing issues or edge cases
- ✨ **New features** - Add functionality or enhancements
- 📚 **Documentation** - Improve guides, API docs, or examples
- 🎨 **Code quality** - Refactoring, style improvements
- ⚡ **Performance** - Optimizations and benchmarking
- 🧪 **Testing** - Add or improve test coverage
- 🔧 **Tooling** - Build system, CI/CD improvements
- 🌐 **Accessibility** - Make the project more inclusive

### Before You Start

1. **Check existing work**
   - Search [issues](https://github.com/EvanDodds/ast-copilot-helper/issues)
   - Review [pull requests](https://github.com/EvanDodds/ast-copilot-helper/pulls)
   - Read [discussions](https://github.com/EvanDodds/ast-copilot-helper/discussions)

2. **Create an issue first** (for significant changes)
   - Describe the problem or enhancement
   - Discuss the approach with maintainers
   - Get feedback before implementation

3. **Start small**
   - Begin with documentation fixes or minor improvements
   - Build familiarity with the codebase
   - Gradually take on larger features

### Issue Guidelines

When creating issues:

- **Use appropriate templates** - Bug report, feature request, etc.
- **Be specific and detailed** - Provide context and examples
- **Include reproduction steps** - For bugs, show how to reproduce
- **Add relevant labels** - Help with organization
- **Be respectful and constructive** - Follow our code of conduct

## Code Standards

### TypeScript Guidelines

- **Use strict mode** - Enable `strict: true` in tsconfig.json
- **Provide comprehensive types** - Avoid `any`, use proper interfaces
- **Use meaningful names** - Clear variable and function names
- **Add JSDoc comments** - Document public APIs thoroughly
- **Follow existing patterns** - Maintain consistency with the codebase

### Code Style

We use automated tools for consistent formatting:

```bash
# Check code style
yarn run lint

# Fix style issues automatically
yarn run lint:fix

# Format code with Prettier
yarn run format
```

#### Key Style Rules

- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas in multiline structures
- Max line length: 100 characters
- Use semicolons consistently

### Commit Message Format

We follow [Conventional Commits](https://conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

#### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring without functional changes
- `perf`: Performance improvements
- `test`: Test changes
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes (dependencies, etc.)

#### Examples

```bash
feat(cli): add support for Python parsing
fix(mcp): resolve memory leak in query processing
docs(readme): update installation instructions
test(parser): add edge case tests for TypeScript generics
```

### Code Organization

- **Single responsibility** - Functions and classes should have one purpose
- **Consistent naming** - Use camelCase for variables, PascalCase for classes
- **Error handling** - Use proper error types and meaningful messages
- **Async patterns** - Use async/await over Promises where possible
- **Import organization** - Group imports: external → internal → relative

## Testing

### Test Strategy

We maintain high test coverage through:

- **Unit tests** - Test individual functions and components
- **Integration tests** - Test component interactions
- **End-to-end tests** - Test complete workflows
- **Performance tests** - Benchmark critical operations

### Running Tests

```bash
# Run all tests
yarn test

# Run tests for specific packages
yarn run test:cli
yarn run test:mcp
yarn run test:vscode

# Run with coverage
yarn run test:coverage

# Run integration tests
yarn run test:integration

# Run performance benchmarks
yarn run benchmark
```

### Writing Tests

#### Test Structure

```typescript
describe("ComponentName", () => {
  describe("methodName", () => {
    it("should do something when condition is met", () => {
      // Arrange
      const input = createTestInput();

      // Act
      const result = methodName(input);

      // Assert
      expect(result).toBe(expectedValue);
    });

    it("should handle error cases properly", () => {
      // Test error scenarios
      expect(() => methodName(invalidInput)).toThrow("Expected error message");
    });
  });
});
```

#### Test Guidelines

- **Use descriptive names** - Test names should explain the scenario
- **Test edge cases** - Include boundary conditions and error paths
- **Keep tests focused** - One assertion per test when possible
- **Use proper setup/teardown** - Clean state between tests
- **Mock external dependencies** - Isolate units under test

## Documentation

### Types of Documentation

- **README files** - Project overview and quick start guides
- **API documentation** - Comprehensive function and class references
- **User guides** - Step-by-step tutorials and how-tos
- **Developer guides** - Architecture and contribution information
- **Code comments** - Inline explanations for complex logic

### Writing Guidelines

- **Use clear, concise language** - Avoid jargon when possible
- **Include practical examples** - Show real usage scenarios
- **Keep documentation current** - Update with code changes
- **Use proper markdown formatting** - Headers, lists, code blocks
- **Add diagrams when helpful** - Visual aids for complex concepts

### Generating Documentation

```bash
# Generate API documentation
yarn run docs:generate

# Serve documentation locally
yarn run docs:serve

# Build documentation for production
yarn run docs:build
```

## Pull Request Process

### Before Submitting

1. **Ensure tests pass**

   ```bash
   yarn test
   yarn run test:integration
   ```

2. **Check code quality**

   ```bash
   yarn run lint
   yarn run type-check
   ```

3. **Update documentation**
   - Update README files if needed
   - Add/update code comments
   - Update API documentation
   - Add examples for new features

4. **Test manually**
   - Verify the feature works as expected
   - Test edge cases and error scenarios
   - Check performance impact

### Creating a Pull Request

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow code standards
   - Include tests
   - Update documentation

3. **Commit with clear messages**

   ```bash
   git add .
   git commit -m "feat(scope): add new feature description"
   ```

4. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Pull Request Template

When creating a pull request, please include:

- **Description** - What changes are being made and why
- **Type of change** - Bug fix, new feature, documentation, etc.
- **Testing** - How the changes were tested
- **Screenshots** - For UI changes or new features
- **Breaking changes** - If any, with migration notes
- **Checklist** - Completed items from the PR template

### Code Review Process

1. **Automated checks must pass**
   - Tests, linting, type checking
   - Build succeeds for all packages
   - Security scans pass

2. **Peer review required**
   - At least one maintainer approval
   - Address feedback promptly
   - Be open to suggestions

3. **Final review and merge**
   - Maintainer performs final check
   - Squash and merge (usually)
   - Delete feature branch

### After Your PR is Merged

- Delete your feature branch
- Pull the latest changes to your local main branch
- Consider contributing more! 🎉

## Community Guidelines

### Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

### Communication Channels

- **GitHub Issues** - Bug reports, feature requests, questions
- **GitHub Discussions** - General discussions, ideas, help
- **Pull Request Reviews** - Code-specific discussions

### Getting Help

1. **Check documentation first**
   - [README](README.md)
   - [API documentation](docs/api/)
   - [User guides](docs/guide/)

2. **Search existing resources**
   - [Issues](https://github.com/EvanDodds/ast-copilot-helper/issues)
   - [Discussions](https://github.com/EvanDodds/ast-copilot-helper/discussions)
   - [FAQ](docs/faq.md)

3. **Ask for help**
   - Create a [discussion](https://github.com/EvanDodds/ast-copilot-helper/discussions)
   - Use the question issue template
   - Be specific about your problem

### Recognition

Contributors are recognized in:

- Project README
- Release notes
- GitHub contributors page
- Special recognition for significant contributions

## Advanced Development

### Debugging

#### CLI Tool

```bash
# Debug CLI with specific file
yarn run debug:cli -- parse --file example.ts --verbose

# Use Node.js debugging
node --inspect-brk packages/ast-copilot-helper/bin/ast-copilot-helper.js parse --file example.ts
```

#### MCP Server

```bash
# Debug MCP server
yarn run debug:mcp

# With verbose logging
DEBUG=ast-mcp:* yarn run start:mcp
```

#### VS Code Extension

- Use F5 in VS Code to launch Extension Development Host
- Use VS Code's built-in debugger
- Check extension logs in Developer Tools

### Performance Testing

```bash
# Run performance benchmarks
yarn run benchmark

# Profile memory usage
yarn run profile:memory

# Profile CPU usage
yarn run profile:cpu

# Generate performance reports
yarn run perf:report
```

### Common Development Tasks

```bash
# Clean build artifacts
yarn run clean

# Rebuild everything from scratch
yarn run rebuild

# Update dependencies
yarn run deps:update

# Check for security vulnerabilities
npm audit

# Fix security issues
npm audit fix

# Run specific test suites
yarn run test -- --grep "parser"

# Watch mode for development
yarn run test:watch
```

### Environment Setup

#### VS Code Extensions (Recommended)

- TypeScript and JavaScript Language Features
- ESLint
- Prettier - Code formatter
- GitLens — Git supercharged
- Thunder Client (for API testing)

#### Git Configuration

```bash
# Set up commit signing (recommended)
git config --global user.signingkey YOUR_GPG_KEY
git config --global commit.gpgsign true

# Set up better diff/merge tools
git config --global merge.tool vscode
git config --global diff.tool vscode
```

## Release Process

> **For Maintainers**: See the complete [Release Process Guide](docs/development/release-process.md)

**Quick Release Steps**:

1. Ensure all changes are merged to `main` and CI is passing
2. Create and push a version tag: `git tag v1.2.3 && git push origin v1.2.3`
3. GitHub Actions automatically handles the rest (build, test, publish, release)

**Release Triggers**:

- ✅ **Git tags**: `v*.*.*` format (recommended)
- ✅ **GitHub Releases**: Publishing a release in GitHub UI
- ✅ **Manual dispatch**: "Run workflow" button in Actions tab with channel selection

**New: Channel-Specific Releases** (Manual dispatch only):

- `all` - Complete release (npm + binaries + GitHub + Docker)
- `npm-only` - Only publish to npm registry
- `binaries-only` - Only build cross-platform executables
- `github-only` - Only create GitHub release
- `docker-only` - Only build and push Docker images
- `dry-run` - Validation only, no publishing

Releases are handled by maintainers following these principles:

- **Semantic Versioning** - Following semver strictly
- **Unified Pipeline** - Single workflow eliminates redundancy
- **Smart Dependencies** - Reuses CI validation, no duplicate testing
- **Multi-package Coordination** - All packages released together
- **Quality Gates** - Comprehensive testing before release
- **Cross-platform Binaries** - Real native executables (Windows, macOS, Linux)

## Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clean and rebuild
yarn run clean && yarn run build

# Check Node.js version
node --version  # Should be 20.0.0+ (24.0.0+ recommended)

# Clear npm cache
npm cache clean --force
```

#### Test Failures

```bash
# Run tests in isolation
yarn test -- --reporter=verbose

# Check for timing issues
yarn test -- --timeout=10000

# Update test snapshots
yarn test -- --updateSnapshot
```

#### VS Code Extension Issues

```bash
# Rebuild extension
cd packages/vscode-extension && yarn run compile

# Check extension logs
# View > Output > ast-copilot-helper
```

### Getting Support

If you encounter issues not covered here:

1. Check the [troubleshooting documentation](docs/troubleshooting.md)
2. Search [existing issues](https://github.com/EvanDodds/ast-copilot-helper/issues)
3. Create a new issue with the bug report template
4. Include all relevant information (OS, Node.js version, error logs)

## Questions?

If you have questions that aren't covered in this guide:

1. Check the [FAQ](docs/faq.md)
2. Browse [GitHub Discussions](https://github.com/EvanDodds/ast-copilot-helper/discussions)
3. Create a new discussion or issue
4. Be specific and provide context

Thank you for contributing to ast-copilot-helper! Your contributions help make this project better for everyone. 🚀

---

_This guide is continuously updated. If you find areas for improvement, please suggest changes!_
