# Test Directory Structure

This directory contains the comprehensive testing infrastructure for the AST Copilot Helper project.

## Structure Overview

```
tests/
├─ unit/                    # Unit tests for individual modules
│  ├─ parser/              # AST parsing tests
│  ├─ annotator/           # Annotation generation tests  
│  ├─ embedder/            # Embedding generation tests
│  ├─ cli/                 # CLI command tests
│  └─ utils/               # Utility function tests
├─ integration/            # Integration tests
│  ├─ workflow/            # End-to-end workflow tests
│  ├─ mcp/                 # MCP protocol tests
│  └─ vscode/              # VS Code extension tests
├─ fixtures/               # Test data and sample repositories
│  ├─ small-repo/          # Small test repository (100 files)
│  ├─ mixed-languages/     # Multi-language test repository
│  └─ edge-cases/          # Error scenarios and edge cases
├─ benchmarks/             # Performance benchmark tests
│  ├─ parsing/             # Parsing speed benchmarks
│  ├─ querying/            # Query latency benchmarks
│  └─ indexing/            # Index building benchmarks
├─ utils/                  # Test utilities and helpers
│  └─ test-helpers.ts      # Shared test utilities
├─ setup.ts                # Global test setup
└─ config-test.test.ts     # Configuration validation tests
```

## Test Categories

### Unit Tests
- Target >90% code coverage
- Test individual modules in isolation
- Use mocking for external dependencies
- Fast execution (< 5 seconds total)

### Integration Tests  
- Test full workflow interactions
- Validate MCP protocol compliance
- Test VS Code extension integration
- Cross-platform compatibility validation

### Benchmark Tests
- Performance validation against requirements
- Parsing: 15k+ nodes in <10 minutes
- Query latency: <200ms MCP, <500ms CLI
- Memory usage: linear scaling validation
- Concurrent operations: 3+ parallel without degradation
- Index building: 100k nodes in <10 minutes

### Fixtures
- **small-repo/**: Basic multi-language repository for unit testing
- **mixed-languages/**: TypeScript, JavaScript, Python files for cross-language testing
- **edge-cases/**: Malformed files, large files, and error scenarios

## Test Utilities

The `test-helpers.ts` module provides:

- `TestRepository`: Utility for creating temporary test repositories with git support
- `ASTTestHelpers`: Mock AST nodes, annotations, and synthetic repository generation
- `PerformanceTimer`: Performance measurement and assertion utilities

## Running Tests

```bash
# All tests
npm test

# Specific test categories
npm run test:unit
npm run test:integration  
npm run test:benchmark

# With coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Coverage Requirements

- Branches: 90%
- Functions: 90% 
- Lines: 90%
- Statements: 90%

Coverage reports are generated in multiple formats (text, HTML, JSON, LCOV) for both local development and CI/CD integration.