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

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and ensure tests pass: `npm test`
4. Build and verify: `yarn run build`
5. Commit your changes: `git commit -am 'Add some feature'`
6. Push to the branch: `git push origin feature/your-feature`
7. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Security

For security vulnerabilities, please follow responsible disclosure practices and report issues privately through GitHub's security advisories.
