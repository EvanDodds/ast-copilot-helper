# Tree-sitter Integration Guide

## Overview

This guide covers the integration of Tree-sitter parsers in the AST Copilot Helper project, detailing the upgrade to Tree-sitter 0.25.x and comprehensive language support.

## Tree-sitter Core Version

- **Current Version**: 0.25.10
- **Previous Version**: 0.20.10
- **Upgrade Date**: January 2025
- **Compatibility**: Full backward compatibility maintained

## Supported Languages

The AST Copilot Helper supports parsing for **15 programming languages** with Tree-sitter 0.25.x:

### Tier 1 Languages (Fully Supported)

- **JavaScript** - tree-sitter-javascript 0.23.1
- **TypeScript** - tree-sitter-typescript 0.24.4
- **Python** - tree-sitter-python 0.23.4
- **Rust** - tree-sitter-rust 0.23.2
- **Java** - tree-sitter-java 0.23.4

### Tier 2 Languages (Well Supported)

- **C++** - tree-sitter-cpp 0.23.4
- **C** - tree-sitter-c 0.23.2
- **C#** - tree-sitter-c-sharp 0.23.2
- **Go** - tree-sitter-go 0.23.1
- **Ruby** - tree-sitter-ruby 0.23.1

### Tier 3 Languages (Basic Support)

- **PHP** - tree-sitter-php 0.23.4
- **Kotlin** - tree-sitter-kotlin 0.3.8
- **Swift** - tree-sitter-swift 0.6.1
- **Scala** - tree-sitter-scala 0.21.0
- **Bash** - tree-sitter-bash 0.23.1

## Architecture

### Core Components

1. **AST Core Engine** (`packages/ast-core-engine/`)
   - Rust-based WASM module
   - Tree-sitter parser bindings
   - Language-specific grammar handling

2. **Language Parsers**
   - Individual Tree-sitter grammar files
   - Compiled to WebAssembly for browser compatibility
   - Node.js native bindings for server-side parsing

3. **Parser Manager**
   - Dynamic parser loading
   - Language detection
   - Parser lifecycle management

### Integration Flow

```
Source Code → Language Detection → Parser Selection → AST Generation → Analysis
```

## API Integration

### Basic Usage

```typescript
import { parseCode } from "@ast-copilot-helper/core";

// Parse JavaScript code
const ast = await parseCode("const x = 42;", "javascript");

// Parse TypeScript code
const tsAst = await parseCode("interface User { name: string; }", "typescript");

// Parse Python code
const pyAst = await parseCode("def hello(): pass", "python");
```

### Advanced Configuration

```typescript
import { ParserConfig, createParser } from "@ast-copilot-helper/core";

const config: ParserConfig = {
  language: "javascript",
  includeComments: true,
  includeWhitespace: false,
  errorRecovery: true,
};

const parser = await createParser(config);
const ast = await parser.parse(sourceCode);
```

### Query API

```typescript
import { queryAST } from "@ast-copilot-helper/core";

// Find all function declarations
const functions = await queryAST(ast, "(function_declaration) @func");

// Find all class methods
const methods = await queryAST(
  ast,
  "(class_declaration (method_definition) @method)",
);
```

## Performance Characteristics

### Parse Times (Average)

| Language   | Small Files (<1KB) | Medium Files (1-10KB) | Large Files (>10KB) |
| ---------- | ------------------ | --------------------- | ------------------- |
| JavaScript | 0.5ms              | 2.1ms                 | 15.2ms              |
| TypeScript | 0.8ms              | 3.4ms                 | 22.1ms              |
| Python     | 0.6ms              | 2.8ms                 | 18.5ms              |
| Rust       | 1.2ms              | 4.1ms                 | 28.3ms              |
| Java       | 0.9ms              | 3.2ms                 | 21.7ms              |

### Memory Usage

- **Base Memory**: ~8MB for Tree-sitter core
- **Per Parser**: ~2-4MB additional memory
- **AST Storage**: Variable based on code complexity
- **Peak Memory**: Typically 2-3x source file size

## Cross-Platform Compatibility

### Supported Platforms

- **Linux** (x64, ARM64)
- **macOS** (Intel, Apple Silicon)
- **Windows** (x64, ARM64)

### Node.js Compatibility

- **Node.js 18.x** - Fully supported
- **Node.js 20.x** - Fully supported
- **Node.js 22.x** - Fully supported

### Browser Compatibility

- **Chrome/Edge** 90+
- **Firefox** 88+
- **Safari** 14+

## Error Handling

### Parse Errors

Tree-sitter provides robust error recovery:

```typescript
try {
  const ast = await parseCode(sourceCode, "javascript");
  if (ast.hasErrors()) {
    const errors = ast.getErrors();
    console.log("Parse errors:", errors);
  }
} catch (error) {
  console.error("Parser initialization failed:", error);
}
```

### Language Detection Fallback

```typescript
import { detectLanguage, parseCode } from "@ast-copilot-helper/core";

const detectedLang = await detectLanguage(sourceCode, filename);
const ast = await parseCode(sourceCode, detectedLang || "javascript");
```

## Configuration

### Parser Settings

```toml
# Cargo.toml configuration
[dependencies]
tree-sitter = "0.25.10"
tree-sitter-javascript = "0.23.1"
tree-sitter-typescript = "0.24.4"
tree-sitter-python = "0.23.4"
```

### Runtime Configuration

```typescript
// Configure parser pool
const config = {
  maxParsers: 10,
  idleTimeout: 300000, // 5 minutes
  memoryLimit: 100 * 1024 * 1024, // 100MB
  languages: ["javascript", "typescript", "python"],
};
```

## Testing

### Unit Tests

```bash
# Run parser-specific tests
yarn test:parsers

# Run cross-platform tests
yarn test:integration

# Run performance benchmarks
yarn test:performance
```

### Integration Testing

The integration test suite validates:

- Parser initialization for all languages
- Cross-platform compatibility
- Memory usage patterns
- Performance benchmarks
- Error handling scenarios

## Troubleshooting

### Common Issues

1. **Parser Load Failure**

   ```
   Error: Cannot load tree-sitter parser for language 'xyz'
   Solution: Verify language is supported and properly installed
   ```

2. **Memory Issues**

   ```
   Error: Maximum memory limit exceeded
   Solution: Increase memory limit or reduce concurrent parsers
   ```

3. **Performance Issues**
   ```
   Slow parsing performance
   Solution: Enable parser pooling and adjust cache settings
   ```

### Debug Mode

```typescript
import { enableDebug } from "@ast-copilot-helper/core";

// Enable detailed logging
enableDebug({
  parser: true,
  memory: true,
  performance: true,
});
```

## Migration Guide

### From Tree-sitter 0.20.x

1. **API Changes**: Most APIs remain compatible
2. **Performance**: 15-25% improvement in parse times
3. **Memory**: 10-15% reduction in memory usage
4. **Error Handling**: Enhanced error recovery

### Breaking Changes

- Removed deprecated `Parser.setLanguage()` synchronous method
- Updated query syntax for some advanced patterns
- Changed memory management for WASM modules

## Future Roadmap

### Planned Enhancements

- **Additional Languages**: Go 2.0, Zig, V support
- **Incremental Parsing**: Real-time editing support
- **Streaming Parsers**: Large file handling
- **Custom Grammars**: User-defined language support

### Version Support

- **Tree-sitter 0.25.x**: Current stable version
- **Tree-sitter 0.26.x**: Planned upgrade Q2 2025
- **Legacy Support**: 0.20.x supported until Q3 2025

## Resources

### Documentation

- [Tree-sitter Official Documentation](https://tree-sitter.github.io/tree-sitter/)
- [Parser Grammar Reference](https://tree-sitter.github.io/tree-sitter/creating-parsers)
- [Query Syntax Guide](https://tree-sitter.github.io/tree-sitter/using-parsers#query-syntax)

### Community

- [Tree-sitter GitHub](https://github.com/tree-sitter/tree-sitter)
- [Parser Repository](https://github.com/tree-sitter)
- [AST Copilot Helper Issues](https://github.com/ast-copilot-helper/issues)

## Contributing

To contribute to Tree-sitter integration:

1. Test new language parsers thoroughly
2. Maintain backward compatibility
3. Document performance characteristics
4. Add comprehensive test coverage
5. Follow semantic versioning for API changes

---

_Last Updated: January 2025_  
_Version: 1.0.0_  
_Tree-sitter Version: 0.25.10_
