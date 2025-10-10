# Contributing to ast-copilot-helper

Thank you for your interest in contributing to ast-copilot-helper! We're excited to have you contribute to making AI-powered code analysis accessible to everyone. This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Contribution Workflow](#contribution-workflow)
- [Code Standards](#code-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Documentation](#documentation)
- [Community Guidelines](#community-guidelines)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive experience for everyone, regardless of gender, sexual orientation, disability, ethnicity, religion, or similar personal characteristics.

### Standards

**Positive behavior includes:**

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**

- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Project maintainers will remove, edit, or reject contributions that violate this code of conduct. Community members who do not follow the code of conduct may be temporarily or permanently banned from the project.

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js 20.0.0 or higher** (24+ recommended)
- **npm 9+**
- **Git** with proper SSH/HTTPS setup
- **Python 3.8+** (for Python language support)
- **VS Code** (recommended for development)

### First Steps

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:

   ```bash
   git clone https://github.com/your-username/ast-copilot-helper.git
   cd ast-copilot-helper
   ```

3. **Add upstream remote:**

   ```bash
   git remote add upstream https://github.com/EvanDodds/ast-copilot-helper.git
   ```

4. **Install dependencies:**

   ```bash
   yarn install
   ```

5. **Run tests** to ensure everything works:
   ```bash
   yarn test
   ```

## Development Setup

### Project Structure

The project is organized as a monorepo with the following key packages:

```
ast-copilot-helper/
├── packages/
│   ├── ast-helper/         # Core CLI package
│   ├── ast-mcp-server/     # MCP server implementation
│   └── vscode-extension/   # VS Code extension
├── docs/                   # Documentation
├── tests/                  # Test suites
├── scripts/               # Build and utility scripts
├── .github/               # GitHub workflows and templates
└── tools/                 # Development tools
```

**Key Files:**

- [README.md](README.md) - Project overview and quick start
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Community standards
- [tsconfig.json](tsconfig.json) - TypeScript configuration

### Environment Setup

1. **Create environment file:**

   ```bash
   cp .env.example .env
   ```

2. **Configure environment variables:**

   ```bash
   # API Keys (for testing AI features)
   OPENAI_API_KEY=your-openai-key  # Optional but recommended

   # Development settings
   NODE_ENV=development
   LOG_LEVEL=debug
   ```

3. **Set up pre-commit hooks:**
   ```bash
   yarn run prepare
   ```

### Development Commands

```bash
# Build all packages
yarn run build

# Start development mode (watch mode)
yarn run dev

# Run all tests
yarn test

# Run tests in watch mode
yarn run test:watch

# Lint code
yarn run lint

# Fix linting issues
yarn run lint:fix

# Format code
yarn run format

# Type check
yarn run type-check
```

### Package-Specific Development

**Core CLI package:**

```bash
cd packages/ast-copilot-helper

# Build package
yarn run build

# Run CLI locally
yarn run dev -- parse src/

# Test package
yarn test
```

**MCP Server:**

```bash
cd packages/ast-mcp-server

# Start server in development
yarn run dev

# Test MCP protocol
yarn run test:mcp
```

**VS Code Extension:**

```bash
cd packages/vscode-extension

# Build extension
yarn run build

# Package extension
yarn run package

# Install locally for testing
code --install-extension ast-copilot-helper-*.vsix
```

## Contribution Workflow

### 1. Choose an Issue

- Browse [open issues](https://github.com/EvanDodds/ast-copilot-helper/issues)
- Look for issues labeled `good first issue` or `help wanted`
- Comment on the issue to express interest
- Wait for maintainer confirmation before starting work

### 2. Create a Branch

```bash
# Sync with upstream
git checkout main
git pull upstream main
git push origin main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-number-description
```

### Branch Naming Conventions

- `feature/feature-name` - New features
- `fix/issue-description` - Bug fixes
- `docs/section-name` - Documentation updates
- `refactor/component-name` - Code refactoring
- `test/test-description` - Test improvements
- `chore/task-description` - Maintenance tasks

### 3. Make Changes

Follow these guidelines while making changes:

#### Code Style

- **Use TypeScript** for all new code
- **Follow existing patterns** in the codebase
- **Write self-documenting code** with clear variable names
- **Add JSDoc comments** for public APIs
- **Keep functions small** and focused

#### Example Code Style

```typescript
/**
 * Invokes Rust annotation system for file analysis
 * @param filePath - Path to the source file
 * @param options - Analysis options
 * @returns Promise resolving to annotation results from Rust CLI
 */
export async function analyzeSourceFile(
  filePath: string,
  options: ParseOptions = {},
): Promise<ASTAnnotation[]> {
  const source = await readFile(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
  );

  const visitor = new TypeScriptASTVisitor(options);
  return visitor.visit(sourceFile);
}

interface ParseOptions {
  includePrivateMembers?: boolean;
  extractComments?: boolean;
  resolveTypes?: boolean;
}
```

#### Commit Message Format

Follow [Conventional Commits](https://conventionalcommits.org/) format:

```bash
# Format: type(scope): description

# Examples:
git commit -m "feat(parser): add support for Python decorators"
git commit -m "fix(cli): handle file not found errors gracefully"
git commit -m "docs(api): update MCP server documentation"
git commit -m "test(query): add integration tests for semantic search"
git commit -m "refactor(database): optimize query performance"
git commit -m "chore(deps): update TypeScript to 5.0"
```

**Commit Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Test changes
- `chore` - Build process or dependency changes

### 4. Test Your Changes

Ensure all tests pass before submitting:

```bash
# Run full test suite
yarn test

# Run specific test suites
yarn run test:unit
yarn run test:integration
yarn run test:e2e

# Run tests for specific package
yarn run test:ast-copilot-helper
yarn run test:mcp-server
yarn run test:vscode-extension

# Generate coverage report
yarn run test:coverage
```

#### Manual Testing

Test your changes manually:

```bash
# Test CLI functionality
yarn run build
./packages/ast-copilot-helper/bin/ast-copilot-helper.js init
./packages/ast-copilot-helper/bin/ast-copilot-helper.js parse examples/

# Test MCP server
yarn run build:mcp-server
cd examples/test-project
ast-copilot-helper server --transport stdio

# Test VS Code extension
cd packages/vscode-extension
yarn run package
code --install-extension *.vsix
```

### Debugging

If you encounter issues during development, use these debugging tools:

```bash
# Debug CLI commands with verbose output
yarn run debug:cli init --verbose

# Debug MCP server with logging
DEBUG=* yarn run build:mcp-server

# Run specific test file in debug mode
yarn run test:unit --reporter=verbose path/to/test.ts

# Check TypeScript compilation issues
yarn run tsc --noEmit
```

Common debugging approaches:

- **Add breakpoints** in VS Code and run tests with debugging
- **Use console.log** for quick debugging (but remove before committing)
- **Check logs** in test output for detailed error messages
- **Verify dependencies** are installed correctly with `yarn install --check-files`

### 5. Update Documentation

Keep documentation up to date:

- **Update API docs** if you changed public APIs
- **Update user guides** for new features
- **Add examples** for new functionality
- **Update CHANGELOG.md** following [Keep a Changelog](https://keepachangelog.com/)

Generate documentation with:

```bash
# Generate API documentation
yarn run docs:generate

# Preview documentation locally
yarn run docs:dev
```

## Pull Request Process

### Before Submitting

Before submitting your pull request, ensure:

- [ ] All tests pass (`yarn test`)
- [ ] Code is properly formatted (`yarn run format`)
- [ ] No linting errors (`yarn run lint`)
- [ ] Documentation is updated
- [ ] Commit messages follow conventional format
- [ ] Branch is up to date with main

### Creating a Pull Request

1. **Push your branch:**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request** on GitHub with:
   - **Clear title** describing the change
   - **Detailed description** of what changed and why
   - **Reference related issues** using `Fixes #123` or `Closes #456`
   - **Screenshots** for UI changes
   - **Breaking change notes** if applicable

#### Pull Request Template

```markdown
## Description

Brief description of changes made.

## Changes Made

- [ ] Added new feature X
- [ ] Fixed bug in component Y
- [ ] Updated documentation for Z

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Added new tests for changes

## Breaking Changes

- None / Describe any breaking changes

## Screenshots

<!-- Add screenshots for UI changes -->

## Related Issues

Fixes #123
Related to #456
```

### 7. Code Review Process

1. **Automated checks** must pass:
   - All tests
   - Code linting
   - Type checking
   - Security scans

2. **Maintainer review**:
   - Code quality and style
   - Test coverage
   - Documentation completeness
   - Breaking change assessment

3. **Address feedback**:
   - Make requested changes
   - Push updates to your branch
   - Respond to review comments

4. **Approval and merge**:
   - Maintainer approves changes
   - PR is merged to main branch

## Code Standards

### TypeScript Guidelines

- **Use strict mode**: Enable strict TypeScript compilation (`strict: true` in tsconfig.json)
- Use explicit types and interfaces
- Prefer `readonly` for immutable properties
- Use `async/await` over promise chains
- Document public APIs with JSDoc comments

**Code Quality:**

- Run `yarn run lint` to check for linting issues
- Run `yarn run format` to format code consistently

```typescript
// ✅ Good: Clear types and interfaces
interface UserConfig {
  readonly apiKey: string;
  readonly timeout: number;
  readonly retryAttempts?: number;
}

class ConfigManager {
  constructor(private readonly config: UserConfig) {}

  async validateConfig(): Promise<boolean> {
    return this.config.apiKey.length > 0;
  }
}

// ❌ Avoid: Any types and unclear interfaces
class BadConfigManager {
  private config: any;

  validate() {
    return this.config.apiKey ? true : false;
  }
}
```

### Error Handling

```typescript
// ✅ Good: Specific error types and proper handling
class ParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly line?: number,
  ) {
    super(message);
    this.name = "ParseError";
  }
}

async function parseFile(filePath: string): Promise<ASTAnnotation[]> {
  try {
    const content = await readFile(filePath, "utf8");
    return await this.parser.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ParseError(
        `Syntax error in ${filePath}: ${error.message}`,
        filePath,
      );
    }
    throw error;
  }
}

// ❌ Avoid: Generic error handling
async function badParseFile(filePath: string) {
  try {
    return await this.parser.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    console.error(error);
    return null;
  }
}
```

### Testing Standards

```typescript
// ✅ Good: Descriptive tests with proper setup/teardown
describe("TypeScriptParser", () => {
  let parser: TypeScriptParser;
  let tempDir: string;

  beforeEach(async () => {
    parser = new TypeScriptParser();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ast-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true });
  });

  describe("parseFunction", () => {
    it("should extract function name and parameters", async () => {
      // Arrange
      const source = `
        function calculateTax(income: number, rate: number): number {
          return income * rate;
        }
      `;

      // Act
      const result = await parser.parse(source);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: "function",
        name: "calculateTax",
        parameters: [
          { name: "income", type: "number" },
          { name: "rate", type: "number" },
        ],
        returnType: "number",
      });
    });

    it("should handle syntax errors gracefully", async () => {
      // Arrange
      const invalidSource = "function invalid() { return";

      // Act & Assert
      await expect(parser.parse(invalidSource)).rejects.toThrow(ParseError);
    });
  });
});
```

## Testing Requirements

### Test Coverage

Maintain high test coverage:

- **Unit tests**: >90% line coverage
- **Integration tests**: Cover critical workflows
- **End-to-end tests**: Cover user scenarios

### Test Categories

1. **Unit Tests**: Test individual functions/classes
2. **Integration Tests**: Test component interactions
3. **End-to-End Tests**: Test complete user workflows
4. **Performance Tests**: Benchmark critical operations

### Running Tests

```bash
# All tests
yarn test

# Unit tests only
yarn run test:unit

# Integration tests
yarn run test:integration

# End-to-end tests
yarn run test:e2e

# Performance tests
yarn run test:performance

# Coverage report
yarn run test:coverage
open coverage/index.html
```

### Writing Tests

**Test File Structure:**

```
src/
├── parser/
│   ├── typescript.ts
│   └── __tests__/
│       ├── typescript.test.ts
│       └── fixtures/
│           └── sample.ts
```

**Test Naming:**

- Files: `*.test.ts` for unit tests, `*.integration.test.ts` for integration
- Describe blocks: Component or function name
- Test cases: "should [expected behavior] when [condition]"

## Documentation

### Documentation Types

1. **API Documentation**: JSDoc comments for public APIs
2. **User Guides**: How to use features
3. **Developer Docs**: Architecture and contributing
4. **Examples**: Sample code and tutorials

### Writing Documentation

**JSDoc Style:**

````typescript
/**
 * Queries the codebase using natural language
 *
 * @param query - Natural language query string
 * @param options - Query configuration options
 * @returns Promise resolving to search results
 *
 * @example
 * ```typescript
 * const results = await queryEngine.query('authentication functions', {
 *   type: 'function',
 *   limit: 10
 * });
 * ```
 */
async query(query: string, options?: QueryOptions): Promise<QueryResult[]>
````

**Markdown Guidelines:**

- Use clear headings and structure
- Include code examples for features
- Add screenshots for UI components
- Link to related documentation

### Documentation Building

```bash
# Build documentation site
yarn run docs:build

# Serve documentation locally
yarn run docs:dev

# Deploy documentation
yarn run docs:deploy
```

## Community Guidelines

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community chat
- **Pull Requests**: Code review and collaboration
- **Documentation**: User guides and API reference

### Getting Help

1. **Search existing issues** and discussions first
2. **Use issue templates** when creating new issues
3. **Provide minimal reproductions** for bug reports
4. **Be patient and respectful** in all interactions

### Providing Help

- **Answer questions** in discussions
- **Review pull requests** from other contributors
- **Improve documentation** and examples
- **Mentor new contributors**

## Troubleshooting

### Common Issues

#### Build Failures

**Problem:** TypeScript compilation errors after pulling latest changes

**Solution:**

```bash
# Clean and rebuild
yarn run clean
yarn install
yarn run build
```

#### Test Failures

**Problem:** Tests failing locally but passing in CI

**Solution:**

```bash
# Clear test cache and run again
yarn run test:clean
yarn test

# Check Node.js version matches requirements
node --version  # Should be 20.0.0 or higher
```

#### WASM Binary Issues

**Problem:** `Error loading WASM binary` in Rust core tests

**Solution:**

```bash
# Rebuild WASM bindings
cd packages/ast-core-engine
yarn run build:wasm
```

#### Dependency Issues

**Problem:** Module not found errors or version conflicts

**Solution:**

```bash
# Clean install all dependencies
rm -rf node_modules
rm yarn.lock
yarn install
```

#### Performance Issues

**Problem:** Tests or CLI commands running slowly

**Solution:**

```bash
# Check if debug mode is enabled
echo $DEBUG  # Should be empty

# Run performance profiling
yarn run benchmark

# Check disk usage for cache
du -sh .cache
```

### Getting More Help

If you encounter an issue not listed here:

1. **Search GitHub Issues** for similar problems
2. **Check GitHub Discussions** for community solutions
3. **Create a new issue** with:
   - Node.js version (`node --version`)
   - Yarn version (`yarn --version`)
   - Operating system
   - Full error message
   - Steps to reproduce

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Workflow

1. **Create release branch**: `release/v1.2.0`
2. **Update version numbers** and changelog
3. **Run full test suite** and manual testing
4. **Create release PR** for final review
5. **Merge and tag** release
6. **Publish packages** to npm and marketplaces
7. **Deploy documentation** updates

### Hotfixes

For critical bugs in production:

1. Create hotfix branch from latest release tag
2. Fix issue and add tests
3. Release as patch version
4. Merge back to main branch

## Recognition

Contributors are recognized in:

- **CONTRIBUTORS.md** file
- **Release notes** for significant contributions
- **GitHub contributor graphs**
- **Project documentation** acknowledgments

Thank you for contributing to ast-copilot-helper! Your efforts help make AI-powered code analysis accessible to developers everywhere.

## Questions?

- Open a [GitHub Discussion](https://github.com/EvanDodds/ast-copilot-helper/discussions)
- Check existing [issues](https://github.com/EvanDodds/ast-copilot-helper/issues)
- Read the [documentation](https://ast-copilot-helper.dev)

Happy coding! 🚀
