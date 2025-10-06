# Tree-sitter Integration Guide

This guide covers the comprehensive Tree-sitter integration implementation for AST Copilot Helper, providing high-performance AST parsing across multiple programming languages.

## Overview

AST Copilot Helper uses Tree-sitter as its primary AST parsing engine, providing:

- **Multi-language Support**: TypeScript, JavaScript, Python, Rust, Go, Java, C++
- **High Performance**: Native bindings with WASM fallback
- **Error Recovery**: Intelligent syntax error detection and reporting
- **Caching**: SHA256-based parse result caching for optimal performance

## Architecture

### Core Components

#### 1. Runtime Detection (`packages/ast-helper/src/parser/runtime-detector.ts`)

Automatically detects and initializes the best available Tree-sitter runtime:

```typescript
import { RuntimeDetector } from "@ast-copilot-helper/ast-helper";

const detector = new RuntimeDetector();
const runtime = await detector.detectRuntime();
console.log(`Using ${runtime.type} runtime`); // "native" or "wasm"
```

#### 2. Grammar Manager (`packages/ast-helper/src/parser/grammar-manager.ts`)

Manages Tree-sitter language grammars with intelligent caching:

```typescript
import { TreeSitterGrammarManager } from "@ast-copilot-helper/ast-helper";

const grammarManager = new TreeSitterGrammarManager();
await grammarManager.loadParser("typescript");
```

#### 3. Native Parser (`packages/ast-helper/src/parser/parsers/native-parser.ts`)

High-performance native Tree-sitter parser implementation:

```typescript
import { NativeTreeSitterParser } from "@ast-copilot-helper/ast-helper";

const parser = new NativeTreeSitterParser(runtime, grammarManager);
const result = await parser.parseCode(sourceCode, "typescript", "file.ts");
```

## Usage Examples

### Basic Parsing

```typescript
import { createParser } from "@ast-copilot-helper/ast-helper";

// Create parser with automatic runtime detection
const parser = await createParser();

// Parse TypeScript code
const result = await parser.parseCode(
  `
  function hello(name: string): string {
    return \`Hello, \${name}!\`;
  }
`,
  "typescript",
);

console.log(`Parsed ${result.nodes.length} AST nodes`);
console.log(`Parse time: ${result.parseTime}ms`);
```

### Advanced Configuration

```typescript
import {
  NativeTreeSitterParser,
  TreeSitterGrammarManager,
  RuntimeDetector,
} from "@ast-copilot-helper/ast-helper";

// Custom configuration
const detector = new RuntimeDetector();
const runtime = await detector.detectRuntime();

const grammarManager = new TreeSitterGrammarManager(".custom-grammars");
const parser = new NativeTreeSitterParser(runtime, grammarManager);

// Parse with custom options
const result = await parser.parseCode(sourceCode, "python", "script.py");
```

## Supported Languages

| Language   | Grammar Module         | Status  | Features                    |
| ---------- | ---------------------- | ------- | --------------------------- |
| TypeScript | tree-sitter-typescript | ✅ Full | Decorators, generics, JSX   |
| JavaScript | tree-sitter-javascript | ✅ Full | ES2022, JSX, modules        |
| Python     | tree-sitter-python     | ✅ Full | 3.8+ syntax, type hints     |
| Rust       | tree-sitter-rust       | ✅ Full | Macros, lifetimes           |
| Go         | tree-sitter-go         | ✅ Full | Generics, modules           |
| Java       | tree-sitter-java       | ✅ Full | Records, switch expressions |
| C++        | tree-sitter-cpp        | ✅ Full | C++20 features              |

## Performance Features

### Parse Caching

Results are cached using SHA256 hashes of source code:

```typescript
// First parse - hits disk/network
const result1 = await parser.parseCode(code, "typescript");

// Second parse - hits cache (much faster)
const result2 = await parser.parseCode(code, "typescript");
```

### Memory Management

- **Parser Pooling**: Reuses parser instances across requests
- **Cache Cleanup**: Automatic cleanup of expired cache entries
- **Resource Disposal**: Proper cleanup of native resources

### Performance Metrics

Typical parsing performance on modern hardware:

- **Small files (<1KB)**: 1-5ms
- **Medium files (1-50KB)**: 5-50ms
- **Large files (50KB-1MB)**: 50-500ms
- **Cache hits**: <1ms

## Error Handling

### Syntax Error Detection

Tree-sitter provides comprehensive syntax error detection:

```typescript
const result = await parser.parseCode("function incomplete(", "typescript");

result.errors.forEach((error) => {
  console.log(`${error.type}: ${error.message} at line ${error.position.line}`);
});
```

### Error Types

1. **Syntax Errors**: Malformed code detected by Tree-sitter
2. **Missing Tokens**: Expected tokens that are absent
3. **Runtime Errors**: Parser initialization or execution failures

### Error Recovery

The parser implements intelligent error recovery:

- **Partial Parsing**: Extract valid nodes from partially valid code
- **Error Context**: Provide surrounding code context for errors
- **Graceful Degradation**: Continue parsing after encountering errors

## Runtime Selection

### Native Runtime (Preferred)

Uses Node.js native Tree-sitter bindings for maximum performance:

- **Requirements**: `tree-sitter` and language grammar packages
- **Performance**: Fastest parsing with full feature support
- **Installation**: `npm install tree-sitter tree-sitter-typescript ...`

### WASM Runtime (Fallback)

Browser-compatible WASM runtime for universal deployment:

- **Requirements**: `web-tree-sitter` package
- **Performance**: Slightly slower but still fast
- **Compatibility**: Works in browsers and Node.js environments

## Configuration

### Grammar Directory

Configure custom grammar storage location:

```typescript
const grammarManager = new TreeSitterGrammarManager("/custom/path");
```

### Cache Settings

Customize caching behavior:

```typescript
// In parser constructor or via environment
process.env.AST_CACHE_TIMEOUT = "600000"; // 10 minutes
process.env.AST_MAX_CACHE_SIZE = "200"; // 200 entries
```

## Troubleshooting

### Common Issues

1. **Grammar Not Found**

   ```
   Error: No grammar found for language: typescript
   ```

   **Solution**: Install the required grammar package:

   ```bash
   npm install tree-sitter-typescript
   ```

2. **Native Runtime Unavailable**

   ```
   Warning: Falling back to WASM runtime
   ```

   **Solution**: Install native Tree-sitter:

   ```bash
   npm install tree-sitter
   ```

3. **Parse Timeout**
   ```
   Error: Parse operation timed out
   ```
   **Solution**: Increase timeout or check for infinite loops in grammar

### Debug Mode

Enable detailed logging:

```typescript
process.env.DEBUG = "ast-helper:parser";
const result = await parser.parseCode(code, "typescript");
```

## Best Practices

### Performance Optimization

1. **Reuse Parser Instances**: Create once, use many times
2. **Enable Caching**: Don't disable unless necessary
3. **Batch Operations**: Parse multiple files in sequence
4. **Monitor Memory**: Dispose of parsers when done

### Error Handling

1. **Check Error Array**: Always inspect `result.errors`
2. **Partial Results**: Use partial AST even with errors
3. **Fallback Strategies**: Have backup parsing approaches
4. **User Feedback**: Provide clear error messages

### Language Support

1. **Version Compatibility**: Keep grammar packages updated
2. **Feature Detection**: Check language feature support
3. **Syntax Validation**: Validate code before parsing
4. **Custom Grammars**: Extend support with custom grammars

## API Reference

For detailed API documentation, see:

- [Tree-sitter API Reference](../api/advanced-features.md#tree-sitter-integration)
- [Parser Interface Documentation](../api/interfaces.md)
- [Language Configuration Guide](../api/cli.md#language-support)

## Examples

Complete working examples are available in:

- [Tree-sitter Examples](../examples/advanced-features.md#tree-sitter-integration)
- [Multi-language Integration Examples](../examples/multi-language-integrations.md)

---

_This guide is part of the advanced features implementation. For the complete feature overview, see [Advanced Features Guide](./advanced-features.md)._
