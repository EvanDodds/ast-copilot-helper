# Testing Workflow Guide

This guide provides comprehensive instructions for testing in the AST Copilot Helper project.

## Quick Test Commands

```bash
# Run all tests (recommended for CI/CD)
npm run test:all

# Run specific test types
npm run test:unit         # Fast unit tests
npm run test:integration  # Cross-package integration tests
npm run test:benchmarks   # Performance validation tests

# Interactive testing
npm run test:watch        # Watch mode for development
npm run test:ui           # Visual test interface
npm run test:coverage     # Generate coverage reports
```

## Test Organization

### Directory Structure

```
tests/
├── benchmarks/            # Performance validation
│   ├── performance.test.ts   # Core performance benchmarks
│   └── memory.test.ts        # Memory usage validation
├── fixtures/              # Shared test utilities
│   ├── generators.ts         # Mock data generators
│   ├── synthetic-repo.ts     # Repository simulators  
│   └── database-mock.ts      # Database test helpers
├── integration/           # Cross-package tests
│   ├── mcp-cli.test.ts      # MCP server + CLI interaction
│   └── end-to-end.test.ts   # Complete workflow tests
└── unit/                  # Individual component tests
    ├── ast-helper/           # CLI package tests
    ├── ast-mcp-server/       # MCP server tests
    └── vscode-extension/     # Extension tests
```

### Test Types by Purpose

#### 1. Unit Tests (`tests/unit/`)
- **Purpose**: Test individual components in isolation
- **Speed**: Very fast (< 1s total)
- **Coverage Target**: > 90% for core modules
- **Mocking**: Heavy use of mocks for external dependencies

```bash
# Run only unit tests
npm run test:unit

# Run unit tests for specific package
npx vitest tests/unit/ast-helper/
```

#### 2. Integration Tests (`tests/integration/`)
- **Purpose**: Test component interactions and workflows
- **Speed**: Medium (1-5s total)
- **Coverage Target**: Critical user paths
- **Real Dependencies**: Uses actual package interactions

```bash
# Run integration tests
npm run test:integration

# Run specific integration test
npx vitest tests/integration/mcp-cli.test.ts
```

#### 3. Performance Benchmarks (`tests/benchmarks/`)
- **Purpose**: Validate acceptance criteria and performance requirements
- **Speed**: Slower (5-30s depending on test)
- **Acceptance Criteria**: 
  - Parse 15,000+ AST nodes in < 10 minutes
  - MCP query latency < 200ms average
  - CLI query latency < 500ms average
- **Real Data**: Uses synthetic repositories with realistic node counts

```bash
# Run performance benchmarks
npm run test:benchmarks

# Run specific benchmark
npx vitest tests/benchmarks/performance.test.ts --reporter=verbose
```

## Performance Testing Deep Dive

### Understanding Benchmarks

Our performance tests validate critical acceptance criteria:

1. **Large Repository Parsing**
   - Creates synthetic repository with 15,000+ AST nodes
   - Measures parsing time and memory usage
   - **Target**: Complete parsing < 10 minutes

2. **MCP Query Latency**  
   - Simulates realistic database queries
   - Tests both simple and complex query patterns
   - **Target**: Average response < 200ms

3. **CLI Query Performance**
   - Tests command-line query operations
   - Includes file system and processing overhead
   - **Target**: Average response < 500ms

4. **Concurrent Load Testing**
   - Simulates multiple simultaneous operations
   - Tests resource utilization under load
   - **Target**: Maintain performance under 10 concurrent operations

5. **Memory Usage Validation**
   - Monitors heap usage during operations
   - Detects memory leaks in long-running processes  
   - **Target**: Stable memory usage patterns

### Running Specific Benchmarks

```bash
# All performance tests
npm run test:benchmarks

# Specific benchmark categories  
npx vitest tests/benchmarks/performance.test.ts --reporter=verbose
npx vitest tests/benchmarks/memory.test.ts --reporter=verbose

# With detailed timing information
npx vitest tests/benchmarks/ --reporter=verbose --timeout=60000
```

### Interpreting Results

Performance test output includes:

```
✓ Large repository parsing performance (15000+ nodes) 2.34s
  ├─ Node count: 16,384 nodes (target: >15,000) ✓
  ├─ Parse time: 2.34s (target: <600s) ✓
  ├─ Rate: 7,006 nodes/second ✓
  └─ Memory: 45.2MB peak usage ✓

✓ MCP server query latency 0.123s  
  ├─ Average latency: 123ms (target: <200ms) ✓
  ├─ 95th percentile: 156ms ✓
  └─ Max latency: 189ms ✓
```

## Development Workflow

### Test-Driven Development (TDD)

1. **Write Test First**
   ```bash
   # Create test file
   touch tests/unit/new-feature.test.ts
   
   # Write failing test
   npm run test:watch  # Keep running to see immediate feedback
   ```

2. **Implement Feature**
   - Write minimal code to make test pass
   - Run tests continuously in watch mode
   - Refactor while maintaining green tests

3. **Add Integration Tests**
   - Test feature integration with existing components
   - Verify end-to-end workflows work correctly

4. **Add Performance Tests** (if applicable)
   - For features affecting performance criteria
   - Ensure new features don't regress performance

### Pre-Commit Testing

Our Husky hooks automatically run:

1. **Type Checking**: Ensures TypeScript compilation
2. **Unit Tests**: Fast validation of core functionality  
3. **Linting**: Code style and quality checks
4. **Build Verification**: Ensures packages compile correctly

### Pre-Push Testing

Before pushing to remote:

1. **Full Test Suite**: All unit, integration, and benchmark tests
2. **Security Audit**: Dependency vulnerability checking
3. **Coverage Validation**: Ensures coverage thresholds are met

## Continuous Integration

### GitHub Actions Integration

Our CI pipeline runs comprehensive testing:

```yaml
# Simplified workflow overview
- name: Run Tests
  run: |
    npm run test:all        # Complete test suite
    npm run test:coverage   # Generate coverage
    npm run test:benchmarks # Validate performance
```

### Multi-Platform Testing

Tests run across:
- **Operating Systems**: Windows, macOS, Linux
- **Node.js Versions**: 18, 20, 21
- **Architectures**: x64, ARM64

### Performance Monitoring

CI automatically:
- Validates all acceptance criteria are met
- Comments on PRs with benchmark results
- Fails builds if performance regresses

## Debugging Tests

### Common Issues

1. **Timeout Issues**
   ```bash
   # Increase timeout for specific test
   npx vitest path/to/test.ts --timeout=30000
   
   # For performance tests
   npx vitest tests/benchmarks/ --timeout=60000
   ```

2. **Memory Issues**
   ```bash
   # Run with memory profiling
   npx vitest --reporter=verbose --run tests/benchmarks/memory.test.ts
   ```

3. **Flaky Tests**
   ```bash
   # Run test multiple times
   npx vitest path/to/test.ts --repeat=10
   
   # Run with detailed output
   npx vitest path/to/test.ts --reporter=verbose
   ```

### Debug Mode

```bash
# Run tests with debugger
npx vitest --inspect-brk path/to/test.ts

# Use test UI for visual debugging
npm run test:ui
```

### Coverage Analysis

```bash
# Generate detailed coverage report
npm run test:coverage

# View coverage in browser
open coverage/index.html

# Check coverage for specific file
npx vitest run --coverage src/specific-file.ts
```

## Writing New Tests

### Unit Test Template

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { YourModule } from '../src/your-module';

describe('YourModule', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = 'test';
      
      // Act  
      const result = YourModule.methodName(input);
      
      // Assert
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      // Test edge cases
    });
  });
});
```

### Integration Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { McpServer } from '../../packages/ast-mcp-server/src';
import { CliHelper } from '../../packages/ast-helper/src';

describe('MCP-CLI Integration', () => {
  it('should query MCP server from CLI', async () => {
    // Arrange: Start MCP server
    const server = new McpServer();
    await server.start();

    // Act: Execute CLI query
    const cli = new CliHelper();
    const result = await cli.query('test query');

    // Assert: Verify integration
    expect(result).toBeDefined();
    
    // Cleanup
    await server.stop();
  });
});
```

### Performance Test Template

```typescript
import { describe, it, expect } from 'vitest';
import { PerformanceTimer } from '../fixtures/performance-timer';

describe('Performance: Feature Name', () => {
  it('should meet performance criteria', async () => {
    const timer = new PerformanceTimer();
    
    // Arrange: Setup test data
    const largeDataSet = generateLargeDataSet(15000);
    
    // Act: Measure operation
    timer.start();
    const result = await processLargeDataSet(largeDataSet);
    const duration = timer.end();
    
    // Assert: Verify performance  
    expect(duration).toBeLessThan(600000); // < 10 minutes
    expect(result.nodeCount).toBeGreaterThanOrEqual(15000);
  });
});
```

## Coverage Goals and Monitoring

### Coverage Thresholds

- **Global Coverage**: > 90%
- **Per-File Coverage**: > 85%  
- **Branch Coverage**: > 85%
- **Function Coverage**: > 90%

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View in browser
open coverage/index.html

# Coverage summary
npm run test:coverage -- --reporter=text-summary
```

### CI Coverage Integration

- Automated coverage reporting to CodeCov
- PR comments with coverage changes
- Build failures if coverage drops below thresholds

## Troubleshooting Guide

### Performance Test Failures

1. **Check System Resources**
   - Ensure adequate RAM (8GB+ recommended)
   - Close resource-intensive applications
   - Run on a consistent environment

2. **Review Test Expectations**
   - Performance criteria are based on reasonable hardware
   - CI environment may be slower than development machine
   - Consider adjusting timeouts for specific environments

3. **Analyze Bottlenecks**
   ```bash
   # Run with detailed timing
   npm run test:benchmarks -- --reporter=verbose
   
   # Check memory usage patterns
   npx vitest tests/benchmarks/memory.test.ts --reporter=verbose
   ```

### Test Environment Issues

1. **Clean Test Environment**
   ```bash
   npm run clean:all
   npm install
   npm run build
   npm run test:all
   ```

2. **Reset Test Database**
   ```bash
   rm -rf test-output/
   npm run test:integration
   ```

3. **Check Node.js Version**
   ```bash
   node --version  # Should be >= 20.0.0
   ```

For additional help, check the project's GitHub issues or create a new issue with your test output and environment details.