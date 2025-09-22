# Release Management Tests

This directory contains comprehensive tests for the release management system:

## Test Files

- `release-manager.test.ts` - Tests for the main ComprehensiveReleaseManager class
- `version-manager.test.ts` - Tests for semantic versioning functionality  
- `changelog-generator.test.ts` - Tests for automated changelog generation
- `compatibility-checker.test.ts` - Tests for backward compatibility checking
- `integration.test.ts` - End-to-end integration tests

## Test Coverage

The test suite covers:

- ✅ Release planning and execution
- ✅ Semantic version calculation and validation
- ✅ Conventional commit parsing and changelog generation
- ✅ API/config/CLI compatibility checking
- ✅ Multi-platform publishing coordination
- ✅ Rollback management and validation
- ✅ End-to-end release workflows
- ✅ Error handling and edge cases
- ✅ Configuration validation
- ✅ Concurrent operation handling

## Running Tests

```bash
# Run all release management tests
npm test -- packages/ast-helper/src/release-management/tests/

# Run specific test file
npm test -- packages/ast-helper/src/release-management/tests/release-manager.test.ts

# Run with coverage
npm run test:coverage
```

## Test Structure

Each test file follows the pattern:

1. **Setup** - Initialize components with mock configurations
2. **Unit Tests** - Test individual methods and functionality
3. **Integration Tests** - Test component interactions
4. **Error Handling** - Test failure scenarios and edge cases
5. **Cleanup** - Clear mocks and test artifacts

## Mocking Strategy

Tests use Vitest mocking for:

- File system operations (fs/promises)
- Git operations (child_process)
- Network requests (platform APIs)
- External dependencies

## Test Data

Mock configurations and test data are designed to:

- Cover all supported configuration options
- Test both valid and invalid inputs
- Simulate real-world usage scenarios
- Verify error handling and validation