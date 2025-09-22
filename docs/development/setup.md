# Development Environment Setup

This guide will help you set up a complete development environment for ast-copilot-helper. Follow these steps to get your local development environment ready for contributing to the project.

## Prerequisites

### Required Software

Before setting up the development environment, ensure you have the following software installed:

#### Node.js and npm

- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher (comes with Node.js)

```bash
# Check versions
node --version  # Should be v18.x.x or higher
npm --version   # Should be 9.x.x or higher
```

**Installation:**

- **Windows/macOS**: Download from [nodejs.org](https://nodejs.org/)
- **Linux**: Use your package manager or Node Version Manager (recommended)

#### Git

Version control system for managing source code.

```bash
# Check version
git --version  # Should be 2.x.x or higher
```

**Installation:**

- **Windows**: Download from [git-scm.com](https://git-scm.com/)
- **macOS**: Install Xcode Command Line Tools: `xcode-select --install`
- **Linux**: `sudo apt install git` (Ubuntu/Debian) or equivalent

#### Python (Optional but Recommended)

Required for Python language parsing features.

- **Python**: Version 3.8 or higher
- **pip**: Python package manager

```bash
# Check versions
python3 --version  # Should be 3.8.x or higher
pip3 --version
```

### Recommended Software

#### Node Version Manager (nvm)

Allows easy switching between Node.js versions.

**Installation:**

```bash
# Install nvm (Linux/macOS)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or source your profile
source ~/.bashrc

# Install and use Node.js 18
nvm install 18
nvm use 18
```

#### VS Code

Recommended IDE with excellent TypeScript support.

**Required Extensions:**

- TypeScript and JavaScript Language Features (built-in)
- ESLint
- Prettier - Code formatter
- Jest Runner
- GitLens

**Optional Extensions:**

- Bracket Pair Colorizer 2
- Auto Rename Tag
- Path Intellisense
- TODO Highlight

## Project Setup

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/yourusername/ast-copilot-helper.git
cd ast-copilot-helper

# If you're contributing, fork first and clone your fork
git clone https://github.com/YOUR_USERNAME/ast-copilot-helper.git
cd ast-copilot-helper

# Add upstream remote for keeping fork updated
git remote add upstream https://github.com/original-owner/ast-copilot-helper.git
```

### 2. Install Dependencies

The project uses npm workspaces to manage multiple packages:

```bash
# Install all dependencies for all packages
npm install

# This will install dependencies for:
# - Root workspace
# - packages/ast-helper
# - packages/ast-mcp-server
# - packages/vscode-extension
```

### 3. Build the Project

```bash
# Build all packages
npm run build

# Build specific package
npm run build:ast-helper
npm run build:mcp-server
npm run build:vscode-extension

# Build in watch mode for development
npm run dev
```

### 4. Verify Installation

Run the test suite to ensure everything is working:

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration

# Check linting
npm run lint

# Check TypeScript compilation
npm run type-check
```

## Development Workflow

### Daily Development Setup

1. **Pull Latest Changes**

```bash
git pull upstream main  # If using fork
# or
git pull origin main    # If using original repo
```

2. **Install New Dependencies** (if package.json changed)

```bash
npm install
```

3. **Start Development Mode**

```bash
# Start all services in development mode
npm run dev

# Or start specific services
npm run dev:ast-helper
npm run dev:mcp-server
npm run dev:vscode-extension
```

### Branch Management

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Create bugfix branch
git checkout -b fix/issue-description

# Keep branch updated
git fetch upstream
git rebase upstream/main
```

### Development Commands

```bash
# Build commands
npm run build              # Build all packages
npm run build:watch        # Build in watch mode
npm run clean              # Clean build artifacts

# Testing commands
npm test                   # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
npm run test:debug         # Run tests with debugger

# Code quality commands
npm run lint               # Run ESLint
npm run lint:fix           # Fix auto-fixable lint issues
npm run format             # Format code with Prettier
npm run type-check         # TypeScript type checking

# Package-specific commands
npm run ast-helper:dev     # Start ast-helper in dev mode
npm run mcp-server:dev     # Start MCP server in dev mode
npm run vscode:dev         # Start VS Code extension dev
```

## Package Structure and Development

### packages/ast-helper

Core library for parsing and analyzing code.

```bash
# Development
cd packages/ast-helper
npm run dev                # Watch mode compilation
npm run test:watch         # Tests in watch mode

# Testing with real projects
npm run test:manual        # Manual testing scripts
```

**Key directories:**

- `src/parser/`: Language parsers
- `src/query/`: Query engine and embeddings
- `src/database/`: SQLite database management
- `src/ai/`: AI integration (OpenAI, etc.)
- `test/`: Test files and fixtures

### packages/ast-mcp-server

Model Context Protocol server implementation.

```bash
# Development
cd packages/ast-mcp-server
npm run dev                # Start server in dev mode
npm run test:integration   # Integration tests

# Testing MCP protocol
npm run test:mcp           # MCP-specific tests
```

**Key directories:**

- `src/server/`: MCP server implementation
- `src/tools/`: MCP tool definitions
- `src/resources/`: MCP resource handlers

### packages/vscode-extension

Visual Studio Code extension.

```bash
# Development
cd packages/vscode-extension
npm run dev                # Watch mode compilation
code .                     # Open in VS Code
# Press F5 to launch Extension Development Host
```

**Key directories:**

- `src/`: Extension source code
- `media/`: Images, icons, stylesheets
- `test/`: Extension tests

## Environment Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# AI Configuration (optional for development)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Development settings
NODE_ENV=development
LOG_LEVEL=debug

# Database settings (for testing)
TEST_DB_PATH=./test.db
```

### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.useAliasesForRenames": false,
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "eslint.workingDirectories": [
    "packages/ast-helper",
    "packages/ast-mcp-server",
    "packages/vscode-extension"
  ],
  "typescript.validate.enable": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/*.tsbuildinfo": true
  }
}
```

Create `.vscode/launch.json` for debugging:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "--reporter=verbose"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    },
    {
      "name": "Debug MCP Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/packages/ast-mcp-server/dist/bin/server.js",
      "args": ["--transport", "stdio"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    },
    {
      "name": "Extension Development Host",
      "type": "extensionHost",
      "request": "launch",
      "runtimeExecutable": "${execPath}",
      "args": [
        "--extensionDevelopmentPath=${workspaceFolder}/packages/vscode-extension"
      ]
    }
  ]
}
```

## Debugging and Troubleshooting

### Common Issues

#### 1. Node.js Version Conflicts

**Problem**: Different Node.js versions across projects.

**Solution**:

```bash
# Use nvm to manage Node versions
nvm install 18
nvm use 18
nvm alias default 18
```

#### 2. TypeScript Compilation Errors

**Problem**: TypeScript errors after pulling changes.

**Solution**:

```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

#### 3. Test Failures

**Problem**: Tests failing locally.

**Solution**:

```bash
# Update dependencies
npm install

# Clear test cache
npm run test:clear-cache

# Run tests with verbose output
npm run test:verbose
```

#### 4. Port Conflicts

**Problem**: Development server port already in use.

**Solution**:

```bash
# Kill processes using port (macOS/Linux)
lsof -ti:3000 | xargs kill

# Or use different port
PORT=3001 npm run dev
```

#### 5. Package Installation Issues

**Problem**: npm install fails with dependency conflicts.

**Solution**:

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# For workspace issues
npm install --workspaces --if-present
```

### Debugging Tips

#### 1. Using VS Code Debugger

Set breakpoints in TypeScript source files and use the launch configurations in `.vscode/launch.json`.

#### 2. Console Debugging

Add debug statements:

```typescript
import { createLogger } from "../utils/logger";
const logger = createLogger("component-name");

logger.debug("Debug information", { data });
logger.info("Information message");
logger.error("Error occurred", error);
```

#### 3. Test Debugging

```bash
# Debug specific test
npm run test:debug -- parser/typescript.test.ts

# Run single test with verbose output
npm test -- --testNamePattern="specific test name" --verbose
```

#### 4. MCP Server Debugging

```bash
# Start server with debug logging
DEBUG=ast-mcp-server* npm run mcp-server:dev

# Test server with manual requests
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | node dist/bin/server.js
```

### Performance Profiling

#### 1. Node.js Profiling

```bash
# Profile CPU usage
node --prof packages/ast-helper/dist/bin/cli.js parse large-file.ts
node --prof-process isolate-*.log > profile.txt

# Memory profiling
node --inspect packages/ast-helper/dist/bin/cli.js parse large-file.ts
# Open chrome://inspect in Chrome
```

#### 2. Benchmark Tests

```bash
# Run performance benchmarks
npm run test:benchmark

# Profile specific operations
npm run benchmark:parsing
npm run benchmark:querying
```

## IDE and Editor Setup

### VS Code Setup

1. **Install recommended extensions**:

```bash
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
code --install-extension ms-vscode.vscode-typescript-next
```

2. **Configure workspace settings** (see `.vscode/settings.json` above)

3. **Set up tasks** (`.vscode/tasks.json`):

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Build All",
      "type": "npm",
      "script": "build",
      "group": "build"
    },
    {
      "label": "Test All",
      "type": "npm",
      "script": "test",
      "group": "test"
    },
    {
      "label": "Dev Mode",
      "type": "npm",
      "script": "dev",
      "isBackground": true,
      "group": "build"
    }
  ]
}
```

### Other IDEs

#### WebStorm/IntelliJ IDEA

- Enable TypeScript service
- Configure ESLint and Prettier
- Set up run configurations for npm scripts

#### Vim/Neovim

- Use CoC (Conquer of Completion) with coc-tsserver
- Configure ALE for linting
- Set up key mappings for common tasks

## Contributing Workflow

### Before Making Changes

1. **Check existing issues and PRs**
2. **Create or comment on relevant issue**
3. **Fork repository (if external contributor)**
4. **Create feature/fix branch**

### Development Process

1. **Make changes following coding standards**
2. **Add/update tests for new functionality**
3. **Run full test suite locally**
4. **Update documentation if needed**
5. **Commit with meaningful messages**

### Before Submitting PR

```bash
# Run full validation
npm run validate

# This runs:
# - ESLint checking
# - TypeScript compilation
# - All tests
# - Coverage check
```

### Commit Message Format

Follow conventional commits:

```bash
feat: add semantic search functionality
fix: resolve database connection timeout
docs: update API documentation
test: add integration tests for parser
refactor: simplify query engine logic
```

## Continuous Integration

### Local CI Simulation

Run the same checks that CI runs:

```bash
# Full CI simulation
npm run ci

# Individual checks
npm run lint:ci
npm run type-check:ci
npm run test:ci
npm run build:ci
```

### Pre-commit Hooks

Install pre-commit hooks (optional but recommended):

```bash
# Install husky
npm install --save-dev husky

# Set up hooks
npm run prepare

# This will run linting and tests before each commit
```

## Next Steps

After setting up your development environment:

1. **Read the [Contributing Guide](./contributing.md)**
2. **Review the [Architecture Overview](./architecture.md)**
3. **Check [Testing Guide](./testing.md) for testing practices**
4. **Look at [Good First Issues](https://github.com/yourusername/ast-copilot-helper/labels/good%20first%20issue)**
5. **Join community discussions**

## Getting Help

If you encounter issues during setup:

1. **Check [Troubleshooting section](#debugging-and-troubleshooting)**
2. **Search existing [GitHub issues](https://github.com/yourusername/ast-copilot-helper/issues)**
3. **Create new issue with detailed description**
4. **Join community discussions**
5. **Contact maintainers**

Happy coding! 🚀
