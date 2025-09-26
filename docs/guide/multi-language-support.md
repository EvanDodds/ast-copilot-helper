# Multi-Language Support Guide

## Overview

AST Copilot Helper now supports **15 programming languages** organized into **3 tiers** based on usage patterns and community support. This comprehensive language support enables AST analysis across diverse codebases and development environments.

## Supported Languages

### Tier 1: Enterprise Languages (6 languages)

_Full production support with comprehensive feature set_

| Language       | Grammar      | Extensions                  | Description                                               |
| -------------- | ------------ | --------------------------- | --------------------------------------------------------- |
| **TypeScript** | `typescript` | `.ts`, `.tsx`               | Primary web and enterprise development language           |
| **JavaScript** | `javascript` | `.js`, `.jsx`               | Universal web development and scripting                   |
| **Python**     | `python`     | `.py`, `.pyi`               | Data science, web development, and automation             |
| **Java**       | `java`       | `.java`                     | Enterprise applications and Android development           |
| **C++**        | `cpp`        | `.cpp`, `.hpp`, `.cc`, `.h` | Systems programming and performance-critical applications |
| **C#**         | `c_sharp`    | `.cs`                       | .NET ecosystem and enterprise development                 |

### Tier 2: Developer Languages (5 languages)

_Strong community support with comprehensive syntax coverage_

| Language  | Grammar | Extensions | Description                                   |
| --------- | ------- | ---------- | --------------------------------------------- |
| **Go**    | `go`    | `.go`      | Cloud infrastructure and microservices        |
| **Rust**  | `rust`  | `.rs`      | Systems programming with memory safety        |
| **PHP**   | `php`   | `.php`     | Web development and server-side scripting     |
| **Ruby**  | `ruby`  | `.rb`      | Web development and scripting                 |
| **Swift** | `swift` | `.swift`   | iOS/macOS development and cross-platform apps |

### Tier 3: Specialized Languages (4 languages)

_Domain-specific and emerging languages_

| Language   | Grammar  | Extensions    | Description                                    |
| ---------- | -------- | ------------- | ---------------------------------------------- |
| **Kotlin** | `kotlin` | `.kt`, `.kts` | Android development and JVM applications       |
| **Scala**  | `scala`  | `.scala`      | Big data processing and functional programming |
| **Dart**   | `dart`   | `.dart`       | Flutter mobile development                     |
| **Lua**    | `lua`    | `.lua`        | Embedded scripting and game development        |

## Language Support Features

### All Languages Support

- **AST Parsing**: Complete syntax tree generation
- **Node Classification**: Normalized node type mapping
- **Error Handling**: Comprehensive parse error reporting
- **Metadata Extraction**: File path, position, and scope information
- **Performance Optimization**: Caching and batch processing

### Enterprise Languages (Tier 1) Additional Features

- **Advanced Signature Extraction**: Complete function signatures with parameters and return types
- **Complex Type Analysis**: Generic types, interfaces, and inheritance hierarchies
- **Comprehensive Scope Detection**: Module, class, and function scope chains
- **Full Modifier Support**: Access modifiers, async, static, and language-specific attributes
- **Production Optimization**: Enhanced caching and memory management

### Developer Languages (Tier 2) Features

- **Core Signature Extraction**: Basic function and method signatures
- **Type Detection**: Fundamental type information and annotations
- **Standard Scope Chains**: Function and class scope detection
- **Common Modifiers**: Public, private, and basic language modifiers

### Specialized Languages (Tier 3) Features

- **Basic AST Structure**: Complete syntax tree with standard node types
- **Function Detection**: Core function and method identification
- **Simple Scope Tracking**: Basic scope chain construction
- **Domain-Specific Optimization**: Language-specific parsing enhancements

## Quick Start Examples

### Basic Usage

```typescript
import { ParserFactory } from "@ast-copilot-helper/ast-helper";

// Create a parser instance
const parser = await ParserFactory.createParser();

// Parse TypeScript code
const result = await parser.parseCode(
  `
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`,
  "typescript",
);

console.log(result.nodes); // AST nodes
console.log(result.errors); // Parse errors (if any)
```

### Multi-Language Processing

```typescript
import { ParserFactory } from "@ast-copilot-helper/ast-helper";

const parser = await ParserFactory.createParser();

const languages = {
  "app.js": "javascript",
  "main.py": "python",
  "service.go": "go",
  "component.tsx": "typescript",
};

// Batch process multiple languages
for (const [filePath, language] of Object.entries(languages)) {
  const result = await parser.parseFile(filePath);
  console.log(
    `Parsed ${filePath} (${language}):`,
    result.nodes.length,
    "nodes",
  );
}
```

### Language-Specific Parsing

```typescript
// Python-specific parsing
const pythonResult = await parser.parseCode(
  `
def calculate_fibonacci(n: int) -> int:
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)
`,
  "python",
);

// Java-specific parsing
const javaResult = await parser.parseCode(
  `
public class Calculator {
    public static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n-1) + fibonacci(n-2);
    }
}
`,
  "java",
);

// Rust-specific parsing
const rustResult = await parser.parseCode(
  `
fn fibonacci(n: u32) -> u32 {
    match n {
        0 | 1 => n,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}
`,
  "rust",
);
```

## Configuration

### Grammar Management

```typescript
import { TreeSitterGrammarManager } from "@ast-copilot-helper/ast-helper";

const grammarManager = new TreeSitterGrammarManager();

// Install grammar for a specific language
await grammarManager.installGrammar("typescript");

// Check available grammars
const available = await grammarManager.getAvailableGrammars();
console.log("Available grammars:", available);
```

### Runtime Configuration

```typescript
import { ParserFactory } from "@ast-copilot-helper/ast-helper";

// Get runtime information
const runtimeInfo = await ParserFactory.getRuntimeInfo();
console.log("Native runtime:", runtimeInfo.native.available);
console.log("WASM runtime:", runtimeInfo.wasm.available);
console.log("Recommended:", runtimeInfo.recommended);

// Create parser with specific runtime
const nativeParser = await ParserFactory.createNativeParser();
const wasmParser = await ParserFactory.createWASMParser();
```

### Language Detection

```typescript
// Auto-detect language from file extension
function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath);
  const languageMap = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".pyi": "python",
    ".java": "java",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cc": "cpp",
    ".h": "cpp",
    ".cs": "c_sharp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".rb": "ruby",
    ".swift": "swift",
    ".kt": "kotlin",
    ".kts": "kotlin",
    ".scala": "scala",
    ".dart": "dart",
    ".lua": "lua",
  };
  return languageMap[ext] || "unknown";
}
```

## Performance Considerations

### Language-Specific Performance

| Tier       | Parse Speed | Memory Usage | Cache Efficiency |
| ---------- | ----------- | ------------ | ---------------- |
| **Tier 1** | Fastest     | Optimized    | High (95%+)      |
| **Tier 2** | Fast        | Standard     | Good (85%+)      |
| **Tier 3** | Standard    | Minimal      | Fair (75%+)      |

### Optimization Recommendations

1. **Batch Processing**: Group files by language for better cache utilization
2. **Grammar Preloading**: Install frequently used grammars at startup
3. **Memory Management**: Use parser disposal for long-running applications
4. **Runtime Selection**: Prefer native runtime for performance-critical applications

```typescript
// Optimized batch processing
const filesByLanguage = new Map<string, string[]>();

// Group files by language
files.forEach((file) => {
  const language = detectLanguage(file);
  if (!filesByLanguage.has(language)) {
    filesByLanguage.set(language, []);
  }
  filesByLanguage.get(language)!.push(file);
});

// Process each language group
for (const [language, languageFiles] of filesByLanguage) {
  const results = await parser.batchParseFiles(languageFiles, {
    concurrency: 4,
    continueOnError: true,
  });

  console.log(`Processed ${languageFiles.length} ${language} files`);
}
```

## Migration Guide

### From 3-Language to 15-Language Support

If you're upgrading from the previous 3-language support (TypeScript, JavaScript, Python), here's what's changed:

#### New Language Support

- **Added 12 new languages** across enterprise, developer, and specialized tiers
- **Enhanced grammar management** with automatic downloading and caching
- **Improved node classification** with language-specific optimizations

#### API Changes

```typescript
// OLD: Limited language support
const supportedLanguages = ["typescript", "javascript", "python"];

// NEW: Comprehensive language support
const supportedLanguages = [
  // Tier 1: Enterprise
  "typescript",
  "javascript",
  "python",
  "java",
  "cpp",
  "csharp",
  // Tier 2: Developer
  "go",
  "rust",
  "php",
  "ruby",
  "swift",
  // Tier 3: Specialized
  "kotlin",
  "scala",
  "dart",
  "lua",
];
```

#### Configuration Updates

```typescript
// OLD: Manual parser configuration
const parser = new TreeSitterParser(runtime, languages);

// NEW: Factory-based parser creation
const parser = await ParserFactory.createParser(grammarManager);
```

#### Breaking Changes

- **TreeSitterManager** renamed to **TreeSitterGrammarManager**
- **Grammar installation** now automatic on first use
- **Node classification** enhanced with language-specific patterns
- **Error handling** improved with detailed parse error types

#### Migration Steps

1. **Update imports**:

```typescript
// OLD
import {
  TreeSitterParser,
  TreeSitterManager,
} from "@ast-copilot-helper/ast-helper";

// NEW
import {
  ParserFactory,
  TreeSitterGrammarManager,
} from "@ast-copilot-helper/ast-helper";
```

2. **Update parser creation**:

```typescript
// OLD
const manager = new TreeSitterManager();
const parser = new TreeSitterParser(runtime, manager);

// NEW
const parser = await ParserFactory.createParser();
```

3. **Update language detection**:

```typescript
// OLD: Manual language mapping
const language = filePath.endsWith(".ts") ? "typescript" : "javascript";

// NEW: Use provided detection utilities
const language = detectLanguage(filePath);
```

4. **Test with new languages**:

```typescript
// Test your existing code with new language support
const testLanguages = ["go", "rust", "java", "csharp"];
for (const lang of testLanguages) {
  const result = await parser.parseCode(sampleCode[lang], lang);
  console.log(
    `${lang} parsing:`,
    result.errors.length === 0 ? "SUCCESS" : "ERRORS",
  );
}
```

## Troubleshooting

### Common Issues

**Q: Parser fails to initialize for a specific language**

```
Error: Grammar not found for language 'kotlin'
```

**A**: Ensure the grammar is installed:

```typescript
await grammarManager.installGrammar("kotlin");
```

**Q: Poor performance with large files**

```
Parse time: 5000ms for 50KB file
```

**A**: Use appropriate runtime and batch processing:

```typescript
const nativeParser = await ParserFactory.createNativeParser();
const results = await nativeParser.batchParseFiles(files, { concurrency: 2 });
```

**Q: Memory issues with multiple languages**

```
Error: JavaScript heap out of memory
```

**A**: Implement proper parser disposal:

```typescript
try {
  const result = await parser.parseFile(file);
  // Process result
} finally {
  await parser.dispose();
}
```

### Performance Tips

1. **Use native runtime** for production environments
2. **Batch process files** by language type
3. **Implement grammar caching** for frequently used languages
4. **Monitor memory usage** in long-running applications
5. **Use appropriate concurrency limits** based on system resources

## Next Steps

- **API Reference**: See [API Documentation](../api/interfaces.md) for complete interface details
- **CLI Usage**: Check [CLI Guide](cli-usage.md) for command-line usage
- **Integration**: Review [Integration Examples](../examples/integrations.md) for real-world usage patterns
- **Performance**: Read [Performance Guide](performance.md) for optimization strategies

## Support

For issues with specific language support:

1. Check the [Troubleshooting Guide](../troubleshooting.md)
2. Review [GitHub Issues](https://github.com/EvanDodds/ast-copilot-helper/issues) for known problems
3. Create a new issue with language-specific details and code samples
