# Extended Language Support

## Overview

The Extended Language Support component provides comprehensive parsing and analysis capabilities for 50+ programming languages through a sophisticated plugin architecture. This is component 6 of 6 for Issue #150 implementation.

## Features

### 🌐 Extensive Language Support

Support for 50+ programming languages including:

- **Web Technologies**: JavaScript, TypeScript, HTML, CSS, SCSS, Vue, Svelte, JSX, TSX
- **Systems Languages**: C, C++, Rust, Go, Zig, Nim, D, Crystal
- **Functional Languages**: Haskell, OCaml, F#, Clojure, Elixir, Elm
- **JVM Languages**: Java, Kotlin, Scala, Groovy
- **Scripting Languages**: Python, Ruby, Perl, Lua, PHP
- **Data Languages**: SQL, JSON, YAML, TOML, XML
- \*\*And many more...

### 🔌 Plugin Architecture

- **Extensible Design**: Add support for custom languages through plugins
- **Hot Reload**: Dynamic plugin loading and reloading during development
- **Isolation**: Sandboxed plugin execution with controlled APIs
- **Performance**: Lazy loading and caching for optimal performance

### 🎯 Advanced Parsing

- **Tree-sitter Integration**: Leverages tree-sitter parsers for accurate AST generation
- **Error Recovery**: Intelligent error recovery strategies for incomplete code
- **Incremental Parsing**: Efficient re-parsing of modified code sections
- **Memory Management**: Configurable memory limits and cleanup

### 🔍 Language Detection

- **Automatic Detection**: Smart language detection from file extensions and content
- **Shebang Support**: Detection from shebang lines in scripts
- **Content Analysis**: Heuristic-based detection for ambiguous files
- **Configuration**: Customizable detection rules and priorities

### ✅ Validation & Linting

- **Built-in Validators**: Language-specific syntax and semantic validation
- **External Linters**: Integration with popular linting tools
- **Custom Rules**: Define custom validation rules through plugins
- **Auto-fixing**: Automatic code fixes for common issues

## Quick Start

### Basic Usage

```typescript
import { ExtendedLanguageManager } from "@ast-copilot-helper/ast-helper/parsers/languages";

// Create manager with default configuration
const languageManager = new ExtendedLanguageManager();

// Parse code
const result = await languageManager.parseCode("const x = 42;", "typescript");

if (result.success) {
  console.log("AST:", result.ast);
  console.log("Metrics:", result.metrics);
} else {
  console.log("Errors:", result.errors);
}
```

### Language Detection

```typescript
// Detect language from file extension
const language = languageManager.detectLanguage("app.tsx"); // 'tsx'

// Detect from content
const detected = languageManager.detectLanguageFromContent(`
#!/usr/bin/env python3
print("Hello, World!")
`); // 'python'
```

### Plugin Registration

```typescript
import type { LanguagePlugin } from "@ast-copilot-helper/ast-helper/parsers/languages";

const customPlugin: LanguagePlugin = {
  name: "custom-lang",
  version: "1.0.0",
  languages: ["custom"],

  initialize: async (context) => {
    // Plugin initialization
  },

  createParser: async (language, context) => {
    // Return parser instance
  },

  validate: async (code, language, context) => {
    // Custom validation logic
  },
};

await languageManager.registerPlugin(customPlugin);
```

## Configuration

### Basic Configuration

```typescript
import type { ExtendedLanguageConfig } from "@ast-copilot-helper/ast-helper/parsers/languages";

const config: ExtendedLanguageConfig = {
  baseConfig: {
    pluginDirectory: "./plugins",
    cacheDirectory: "./cache",
    maxConcurrentParsers: 4,
    defaultTimeout: 5000,
    memoryLimitPerParser: 128 * 1024 * 1024, // 128MB
  },

  languageConfigs: {
    typescript: {
      timeout: 10000,
      enableIncrementalParsing: true,
      memoryLimit: 256 * 1024 * 1024, // 256MB
    },
    python: {
      errorRecovery: [
        {
          pattern: /SyntaxError/,
          action: "skip-to-next-statement",
        },
      ],
    },
  },

  autoDiscovery: {
    enabled: true,
    searchPaths: ["./plugins", "./node_modules"],
    patterns: ["*-language-plugin.js"],
    autoLoad: true,
  },

  performance: {
    enableCaching: true,
    cacheLimits: {
      grammarCache: 100,
      parseCache: 1000,
      metadataCache: 50,
    },
    enableMetrics: true,
    metricsInterval: 60000,
  },
};

const manager = new ExtendedLanguageManager(config);
```

### Language-Specific Options

```typescript
// Configure TypeScript parsing options
const result = await manager.parseCode(code, "typescript", {
  timeout: 15000,
  enableIncrementalParsing: true,
  enableErrorRecovery: true,
  enableValidation: true,
  memoryLimit: 512 * 1024 * 1024,
  customOptions: {
    strictMode: true,
    allowJs: true,
  },
});
```

## Plugin Development

### Creating a Language Plugin

```typescript
import type {
  LanguagePlugin,
  LanguageGrammar,
} from "@ast-copilot-helper/ast-helper/parsers/languages";

export const myLanguagePlugin: LanguagePlugin = {
  name: "my-language-plugin",
  version: "1.0.0",
  description: "Support for My Programming Language",
  author: "Your Name",
  languages: ["mylang"],

  grammars: {
    mylang: {
      name: "mylang",
      displayName: "My Language",
      fileExtensions: [".my", ".mylang"],
      grammarPath: "./grammars/mylang.wasm",

      parsingOptions: {
        timeout: 5000,
        enableIncrementalParsing: true,
        enableErrorRecovery: true,
      },

      features: {
        syntaxHighlighting: true,
        autoCompletion: true,
        errorChecking: true,
        refactoring: false,
        debugging: false,
      },

      validation: {
        enabled: true,
        builtInValidators: ["syntax", "semantics"],
        customRules: [
          {
            name: "no-unused-vars",
            description: "Variables must be used",
            severity: "warning",
            pattern: /unused variable: (.+)/,
            message: 'Variable "$1" is declared but never used',
          },
        ],
      },
    },
  },

  async initialize(context) {
    context.logger.info("Initializing My Language Plugin");

    // Load grammar files, set up resources, etc.
    const grammarContent = await context.fs.readFile("./grammars/mylang.wasm");

    // Store in cache for future use
    await context.cache.set("mylang-grammar", grammarContent);
  },

  async createParser(language, context) {
    if (language !== "mylang") {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Create and return parser instance
    const Parser = await import("tree-sitter");
    const MyLang = await import("./grammars/mylang");

    const parser = new Parser();
    parser.setLanguage(MyLang);

    return parser;
  },

  async validate(code, language, context) {
    // Implement custom validation logic
    const errors = [];

    // Example: Check for common issues
    if (code.includes("TODO")) {
      errors.push({
        type: "warning",
        message: "TODO comment found",
        location: { line: 1, column: 1 },
        severity: "info" as const,
        code: "todo-comment",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: errors.filter((e) => e.severity === "warning"),
      metrics: {
        validationTime: Date.now(),
        rulesChecked: 1,
      },
    };
  },

  async dispose(context) {
    // Cleanup resources
    context.logger.info("Disposing My Language Plugin");
  },
};
```

### Plugin Context API

The plugin context provides access to various system services:

```typescript
interface PluginContext {
  // Logging
  logger: {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
  };

  // File system operations
  fs: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string): Promise<void>;
    readdir(path: string): Promise<string[]>;
  };

  // Caching
  cache: {
    get<T>(key: string): Promise<T | undefined>;
    set<T>(key: string, value: T, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
  };

  // Event system
  events: {
    on(event: string, listener: (...args: unknown[]) => void): void;
    emit(event: string, ...args: unknown[]): void;
    off(event: string, listener: (...args: unknown[]) => void): void;
  };
}
```

## Events

The Extended Language Manager emits various events for monitoring and extensibility:

```typescript
// Listen for parsing events
manager.on("parseStart", (language, codeLength) => {
  console.log(`Starting to parse ${codeLength} chars of ${language}`);
});

manager.on("parseComplete", (language, result) => {
  console.log(`Parsed ${language} in ${result.metrics?.parseTime}ms`);
});

manager.on("parseError", (language, error) => {
  console.error(`Parse error in ${language}:`, error);
});

// Plugin lifecycle events
manager.on("pluginLoaded", (plugin) => {
  console.log(`Loaded plugin: ${plugin.name} v${plugin.version}`);
});

manager.on("pluginError", (pluginName, error) => {
  console.error(`Plugin error in ${pluginName}:`, error);
});

// Performance monitoring
manager.on("metricsUpdate", (metrics) => {
  console.log("Performance metrics:", metrics);
});
```

## Performance Optimization

### Caching Strategies

```typescript
// Configure caching for optimal performance
const config = {
  performance: {
    enableCaching: true,
    cacheLimits: {
      grammarCache: 100, // Number of grammar files to cache
      parseCache: 1000, // Number of parse results to cache
      metadataCache: 50, // Number of metadata objects to cache
    },
  },
};

// Manual cache management
await manager.clearCache(); // Clear all caches
await manager.clearCache("parse"); // Clear specific cache
```

### Memory Management

```typescript
// Set memory limits per parser
const result = await manager.parseCode(code, "javascript", {
  memoryLimit: 64 * 1024 * 1024, // 64MB limit
});

// Monitor memory usage
manager.on("memoryWarning", (usage) => {
  console.warn(`High memory usage: ${usage.used}/${usage.limit} bytes`);
});
```

### Concurrent Processing

```typescript
// Process multiple files concurrently
const files = ["app.ts", "utils.js", "config.json"];
const results = await Promise.all(
  files.map((file) =>
    manager.parseFile(file, {
      maxConcurrency: 4,
    }),
  ),
);
```

## Troubleshooting

### Common Issues

1. **Plugin Not Found**

   ```typescript
   // Ensure plugin is properly registered
   await manager.registerPlugin(plugin);

   // Check available plugins
   const plugins = manager.getRegisteredPlugins();
   console.log(
     "Available plugins:",
     plugins.map((p) => p.name),
   );
   ```

2. **Grammar Loading Failed**

   ```typescript
   // Verify grammar file exists and is valid
   try {
     await manager.loadGrammar("mylang", "./path/to/grammar.wasm");
   } catch (error) {
     console.error("Grammar loading failed:", error);
   }
   ```

3. **Memory Limit Exceeded**
   ```typescript
   // Increase memory limit or enable streaming
   const result = await manager.parseCode(code, "language", {
     memoryLimit: 256 * 1024 * 1024, // Increase limit
     enableStreaming: true, // Process in chunks
   });
   ```

### Debug Mode

```typescript
// Enable debug logging
const manager = new ExtendedLanguageManager({
  development: {
    debugLogging: true,
    hotReload: true,
  },
});

// Access debug information
manager.on("debug", (info) => {
  console.log("Debug:", info);
});
```

## API Reference

For complete API documentation, see the [API Reference](../../docs/api/issue-150.md#extended-language-support).

## Examples

For practical examples and integration patterns, see the [Examples Guide](../../docs/examples/issue-150-examples.md#extended-language-support).

## Contributing

When contributing new language support:

1. Create a plugin following the plugin development guide
2. Include comprehensive tests
3. Add documentation and examples
4. Submit a pull request with the new language support

## License

This component is part of the AST Copilot Helper project and is licensed under the same terms as the main project.
