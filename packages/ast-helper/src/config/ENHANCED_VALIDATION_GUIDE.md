# Enhanced Configuration Validation Guide

The AST Copilot Helper now includes a comprehensive configuration validation system that provides detailed error reporting, automatic value cleaning, and user-friendly error messages with suggestions.

## Features

### 🔍 **Comprehensive Schema Validation**
- **Type Safety**: Validates all configuration properties against expected types
- **Range Validation**: Ensures numeric values are within appropriate ranges
- **Format Validation**: Validates URLs, paths, and complex nested objects
- **Array Validation**: Handles string arrays with filtering and cleaning

### 🧹 **Automatic Value Cleaning**
- **String Normalization**: Trims whitespace and handles empty strings
- **Boolean Coercion**: Converts string representations to proper booleans
- **Array Filtering**: Removes invalid items and normalizes valid ones
- **Type Conversion**: Handles common type mismatches gracefully

### 💡 **User-Friendly Error Messages**
- **Detailed Descriptions**: Clear explanation of what went wrong
- **Helpful Suggestions**: Specific guidance on how to fix issues
- **Examples**: Concrete examples of valid values
- **Path Context**: Exact property path for nested configurations

### ⚠️ **Warning System**
- **Unknown Properties**: Warns about unrecognized configuration keys
- **Non-Breaking Issues**: Identifies problems that don't prevent operation
- **Backward Compatibility**: Maintains compatibility while highlighting improvements

## Usage

### Basic Validation

```typescript
import { validateConfig } from './config/defaults.js';

// Throws detailed error on validation failure
const config = validateConfig({
  parseGlob: ['*.ts', '*.js'],
  topK: 50
});
```

### Detailed Validation Results

```typescript
import { validateConfigDetailed } from './config/defaults.js';

const result = validateConfigDetailed({
  parseGlob: 'invalid', // Wrong type
  topK: -5,            // Out of range
  unknownProp: 'test'  // Unknown property
});

if (!result.valid) {
  console.error('Configuration errors:');
  result.errors.forEach(error => {
    console.error(`• ${error.path}: ${error.message}`);
    if (error.suggestion) {
      console.info(`  💡 ${error.suggestion}`);
    }
  });
}

if (result.warnings.length > 0) {
  console.warn('Configuration warnings:');
  result.warnings.forEach(warning => {
    console.warn(`• ${warning.path}: ${warning.message}`);
  });
}
```

### Using the Enhanced Validator Directly

```typescript
import { EnhancedConfigValidator } from './config/enhanced-validator.js';

const validator = new EnhancedConfigValidator();
const result = validator.validate(config);

// Format errors for user display
const report = EnhancedConfigValidator.formatErrors(result);
console.log(report);
```

## Configuration Properties

### Core Configuration

#### `parseGlob: string[]`
- **Purpose**: File patterns to parse for AST analysis
- **Required**: At least 1 valid pattern
- **Examples**: `['*.ts', 'src/**/*.js', '**/*.py']`
- **Validation**: Must be non-empty string array

#### `watchGlob: string[]`
- **Purpose**: File patterns to watch for changes
- **Required**: Optional (can be empty)
- **Examples**: `['src/**/*.ts', 'lib/**/*.js']`
- **Validation**: String array, empty strings filtered out

#### `outputDir: string`
- **Purpose**: Directory for database and output files
- **Required**: Non-empty string
- **Examples**: `'./output'`, `'/tmp/ast-helper'`, `'dist/embeddings'`
- **Validation**: Valid directory path, no unsafe traversal

### Performance Configuration

#### `topK: number`
- **Purpose**: Maximum number of search results to return
- **Range**: 1-1000
- **Default**: 10
- **Examples**: `10`, `50`, `100`

#### `snippetLines: number`
- **Purpose**: Lines of code context around matches
- **Range**: 1-200
- **Default**: 5
- **Examples**: `3`, `10`, `20`

#### `concurrency: number`
- **Purpose**: Parallel processing limit
- **Range**: 1-32
- **Default**: 4
- **Examples**: `2`, `8`, `16`

#### `batchSize: number`
- **Purpose**: Batch processing size for operations
- **Range**: 1-5000
- **Default**: 100
- **Examples**: `50`, `200`, `1000`

### Vector Database Configuration

#### `indexParams.efConstruction: number`
- **Purpose**: HNSW build quality parameter
- **Range**: 16-800
- **Default**: 200
- **Higher values**: Better accuracy, slower indexing

#### `indexParams.M: number`
- **Purpose**: HNSW connectivity parameter
- **Range**: 4-64
- **Default**: 16
- **Higher values**: Better accuracy, more memory usage

### Model Configuration

#### `modelHost: string`
- **Purpose**: Base URL for model downloads
- **Format**: Valid HTTP/HTTPS URL
- **Examples**: `'https://huggingface.co'`, `'https://models.example.com'`

#### `model.defaultModel: string`
- **Purpose**: Default embedding model to use
- **Required**: Non-empty string
- **Examples**: `'codebert-base'`, `'all-MiniLM-L6-v2'`

#### `model.downloadTimeout: number`
- **Purpose**: Model download timeout in milliseconds
- **Range**: 1000-300000 (1s-5min)
- **Default**: 30000 (30s)

### Embeddings Configuration

#### `embeddings.batchSize: number`
- **Purpose**: Embedding generation batch size
- **Range**: 1-128
- **Default**: 32
- **Optimization**: Adjust based on GPU memory

#### `embeddings.maxConcurrency: number`
- **Purpose**: Maximum concurrent embedding operations
- **Range**: 1-8
- **Default**: 2
- **Optimization**: Balance CPU/GPU utilization

#### `embeddings.memoryLimit: number`
- **Purpose**: Memory limit for embedding operations (MB)
- **Range**: 128-16384 (128MB-16GB)
- **Default**: 2048 (2GB)
- **Optimization**: Set based on available system memory

### File Watching Configuration

#### `fileWatching.watchPaths: string[]`
- **Purpose**: Directories to monitor for changes
- **Required**: At least 1 valid path when file watching is enabled
- **Examples**: `['src/', 'lib/', 'tests/']`

#### `fileWatching.debounceMs: number`
- **Purpose**: Delay before processing file changes
- **Range**: 0-10000 (0-10s)
- **Default**: 300 (300ms)
- **Optimization**: Higher values reduce duplicate processing

### Boolean Configuration

The validation system supports multiple boolean representations:

```typescript
// All of these are equivalent to `true`:
enableTelemetry: true
enableTelemetry: 'true'
enableTelemetry: 'yes'
enableTelemetry: '1'
enableTelemetry: 1

// All of these are equivalent to `false`:
enableTelemetry: false
enableTelemetry: 'false'
enableTelemetry: 'no'
enableTelemetry: '0'
enableTelemetry: 0
```

## Error Examples and Solutions

### Type Mismatch Errors

```
❌ parseGlob: parseGlob must be an array, got: string
💡 Use an array of non-empty strings
📋 Examples: ["*.ts", "*.js", "src/**"]
```

**Solution**: Wrap the string in an array: `["*.ts"]`

### Range Validation Errors

```
❌ topK: topK must be between 1 and 1000, got: -5
💡 Use an integer between 1 and 1000
📋 Examples: [1, 500, 1000]
```

**Solution**: Use a positive integer within the valid range

### URL Format Errors

```
❌ modelHost: modelHost must be a valid URL, got: "invalid-url"
💡 Use a valid URL with protocol: http, https
📋 Examples: "https://example.com/models"
```

**Solution**: Include the protocol: `"https://example.com"`

### Nested Object Errors

```
❌ embeddings.textProcessing.maxSnippetLength: maxSnippetLength must be between 50 and 10000, got: -100
💡 Use an integer between 50 and 10000
📋 Examples: [50, 5000, 10000]
```

**Solution**: Adjust the nested property value within the valid range

## Migration from Legacy Validation

### Before (Legacy)
```typescript
// Basic error messages, limited validation
try {
  const config = validateConfig(userConfig);
} catch (error) {
  console.error(error.message); // Basic error like "topK must be an integer between 1 and 100"
}
```

### After (Enhanced)
```typescript
// Detailed error reporting with suggestions
const result = validateConfigDetailed(userConfig);
if (!result.valid) {
  const report = EnhancedConfigValidator.formatErrors(result);
  console.error(report);
  // Detailed report with paths, suggestions, and examples
}

// Or use the throwing version for simple cases
try {
  const config = validateConfig(userConfig);
} catch (error) {
  console.error(error.message); // Now includes detailed validation report
}
```

## Best Practices

### 1. **Use Detailed Validation During Development**
```typescript
const result = validateConfigDetailed(config);
if (!result.valid) {
  // Show detailed errors to developers
  console.error(EnhancedConfigValidator.formatErrors(result));
}
```

### 2. **Handle Warnings Appropriately**
```typescript
const result = validateConfigDetailed(config);
if (result.warnings.length > 0) {
  // Log warnings but don't fail
  console.warn(`Configuration has ${result.warnings.length} warnings`);
  result.warnings.forEach(w => console.warn(`- ${w.path}: ${w.message}`));
}
```

### 3. **Provide User-Friendly Config Helpers**
```typescript
function createDefaultConfig(overrides = {}) {
  return validateConfig({
    parseGlob: ['**/*.ts', '**/*.js'],
    topK: 10,
    concurrency: Math.min(4, os.cpus().length),
    ...overrides
  });
}
```

### 4. **Validate Early in Application Lifecycle**
```typescript
// Validate configuration at startup
try {
  const config = validateConfig(loadUserConfig());
  console.log('✅ Configuration validated successfully');
} catch (error) {
  console.error('❌ Configuration validation failed:');
  console.error(error.message);
  process.exit(1);
}
```

## Integration Points

### CLI Integration
The enhanced validator integrates with command-line argument parsing to provide immediate feedback:

```bash
ast-helper --topK=-5
# Error: Configuration validation failed:
# ❌ topK: topK must be between 1 and 1000, got: -5
# 💡 Use an integer between 1 and 1000
# 📋 Examples: [1, 500, 1000]
```

### Config File Integration
JSON and YAML configuration files are validated with detailed path information:

```json
{
  "embeddings": {
    "memoryLimit": "not-a-number"
  }
}
```

```
❌ embeddings.memoryLimit: memoryLimit must be a valid number (MB), got: string "not-a-number"
💡 Use memory size in MB between 128 and 16384
📋 Examples: [512, 1024, 2048, 4096]
```

### Environment Variable Integration
Environment variables are validated and converted with helpful error messages:

```bash
export AST_TOP_K="invalid"
```

```
❌ topK: topK must be a valid number, got: string "invalid"
💡 Use an integer between 1 and 1000
```

## Advanced Features

### Custom Validation Rules
The system supports extending validation with custom rules:

```typescript
const customValidator = new EnhancedConfigValidator({
  ...CONFIG_VALIDATION_SCHEMA,
  customField: {
    validate: (value) => {
      if (typeof value !== 'string' || !value.startsWith('prefix_')) {
        return 'customField must start with "prefix_"';
      }
      return true;
    },
    suggestion: 'Use a string that starts with "prefix_"',
    example: 'prefix_example'
  }
});
```

### Conditional Validation
Some properties depend on others and are validated accordingly:

```typescript
// fileWatching.watchPaths is required only when fileWatching is enabled
if (config.fileWatching && !config.fileWatching.watchPaths?.length) {
  // Validation error with context about the dependency
}
```

## Performance Considerations

The enhanced validation system is designed for performance:

- **Schema Compilation**: Validation rules are pre-compiled for fast execution
- **Early Termination**: Validation stops on first critical error in production mode
- **Memory Efficient**: Uses streaming validation for large configurations
- **Caching**: Validation results are cached for repeated validations

## Testing Support

The validation system includes comprehensive test utilities:

```typescript
import { expect } from 'vitest';
import { validateConfigDetailed } from './config/defaults.js';

// Test valid configuration
expect(validateConfigDetailed(validConfig).valid).toBe(true);

// Test specific error messages
const result = validateConfigDetailed(invalidConfig);
expect(result.errors.find(e => e.path === 'topK')?.message)
  .toContain('must be between 1 and 1000');
```

This enhanced configuration validation system provides a robust foundation for ensuring configuration correctness while maintaining an excellent developer experience through clear error messages and helpful suggestions.