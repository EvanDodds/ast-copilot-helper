/**
 * Extended Language Manager
 *
 * Manages extended language support beyond the core set, including plugin
 * architecture and dynamic language loading.
 */

import { EventEmitter } from "events";
import Parser from "web-tree-sitter";
import type {
  ExtendedLanguage,
  LanguageGrammar,
  LanguagePlugin,
  ExtendedLanguageConfig,
  LanguageRegistryEntry,
  ExtendedParseResult,
  LanguageDetectionResult,
  ValidationResult,
  PluginContext,
  PluginLogger,
  PluginFileSystem,
  PluginCache,
  PluginEventEmitter,
  BuiltInValidator,
  ValidationRule,
  ExternalLinter,
  ParseError,
} from "./types";

/**
 * Extended Language Manager Class
 */
export class ExtendedLanguageManager extends EventEmitter {
  private readonly config: ExtendedLanguageConfig;
  private readonly languageRegistry: Map<
    ExtendedLanguage,
    LanguageRegistryEntry
  > = new Map();
  private readonly pluginRegistry: Map<string, LanguagePlugin> = new Map();
  private readonly grammarCache: Map<string, ArrayBuffer> = new Map();
  private readonly parseCache: Map<string, ExtendedParseResult> = new Map();
  private readonly pluginContexts: Map<string, PluginContext> = new Map();

  private isInitialized = false;
  private initializationPromise?: Promise<void>;

  constructor(config: ExtendedLanguageConfig) {
    super();
    this.config = config;
    this.setupCacheCleanup();
  }

  /**
   * Initialize the extended language manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      // Initialize tree-sitter
      await Parser.init();

      // Load built-in language grammars
      await this.loadBuiltInLanguages();

      // Discover and load plugins if enabled
      if (this.config.autoDiscovery.enabled) {
        await this.discoverPlugins();
      }

      // Validate loaded languages and plugins
      if (this.config.validation.validateGrammars) {
        await this.validateGrammars();
      }

      if (this.config.validation.validatePlugins) {
        await this.validatePlugins();
      }

      this.isInitialized = true;
      this.emit("initialized");
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Register a language grammar
   */
  async registerLanguage(
    grammar: LanguageGrammar,
    plugin?: LanguagePlugin,
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Load grammar
      const grammarBuffer = await this.loadGrammar(grammar.grammarPath);

      // Create parser
      const parser = new Parser();
      const language = await Parser.Language.load(
        new Uint8Array(grammarBuffer),
      );
      parser.setLanguage(language);

      // Register in registry
      const entry: LanguageRegistryEntry = {
        grammar,
        plugin,
        parser,
        registeredAt: new Date(),
        stats: {
          parseCount: 0,
          totalParseTime: 0,
          errorCount: 0,
        },
        enabled: true,
      };

      this.languageRegistry.set(grammar.name, entry);

      // Update cache
      this.grammarCache.set(grammar.grammarPath, grammarBuffer);

      this.emit("languageRegistered", grammar.name, grammar);
    } catch (error) {
      this.emit("languageRegistrationFailed", grammar.name, error);
      throw error;
    }
  }

  /**
   * Register a language plugin
   */
  async registerPlugin(plugin: LanguagePlugin): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Create plugin context
      const context = this.createPluginContext(plugin.name);

      // Initialize plugin
      await plugin.initialize(context);

      // Register plugin
      this.pluginRegistry.set(plugin.name, plugin);
      this.pluginContexts.set(plugin.name, context);

      // Register languages from plugin
      for (const language of plugin.languages) {
        const grammar = await plugin.getGrammar(language);
        await this.registerLanguage(grammar, plugin);
      }

      this.emit("pluginRegistered", plugin.name, plugin);
    } catch (error) {
      this.emit("pluginRegistrationFailed", plugin.name, error);
      throw error;
    }
  }

  /**
   * Parse code in an extended language
   */
  async parseCode(
    code: string,
    language: ExtendedLanguage,
    options?: {
      useCache?: boolean;
      timeout?: number;
      memoryLimit?: number;
    },
  ): Promise<ExtendedParseResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const cacheKey =
      options?.useCache !== false ? this.getCacheKey(code, language) : null;

    // Check cache first
    if (cacheKey && this.parseCache.has(cacheKey)) {
      const cached = this.parseCache.get(cacheKey);
      if (cached && cached.metrics) {
        cached.metrics = { ...cached.metrics, cacheHit: true };
        return cached;
      }
    }

    const entry = this.languageRegistry.get(language);
    if (!entry || !entry.enabled) {
      return {
        success: false,
        errors: [
          {
            type: "plugin",
            message: `Language ${language} is not supported or not enabled`,
            severity: "error",
            language,
          },
        ],
        language,
      };
    }

    try {
      // Apply pre-processors
      let processedCode = code;
      if (entry.grammar.parsingOptions?.preProcessors) {
        for (const processor of entry.grammar.parsingOptions.preProcessors) {
          if (processor.required) {
            processedCode = await processor.process(
              processedCode,
              processor.options,
            );
          }
        }
      }

      // Parse with timeout
      if (!entry.parser) {
        throw new Error(`Parser not available for language: ${language}`);
      }
      const parsePromise = this.performParse(entry.parser, processedCode);
      const timeout =
        options?.timeout ||
        entry.grammar.parsingOptions?.timeout ||
        this.config.baseConfig.defaultTimeout;

      const ast = await Promise.race([
        parsePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Parse timeout")), timeout),
        ),
      ]);

      // Apply post-processors
      let processedAst = ast;
      if (entry.grammar.parsingOptions?.postProcessors) {
        for (const processor of entry.grammar.parsingOptions.postProcessors) {
          if (processor.required) {
            processedAst = await processor.process(
              processedAst,
              processor.options,
            );
          }
        }
      }

      const parseTime = Date.now() - startTime;
      const nodeCount = this.countNodes(processedAst);

      // Update statistics
      entry.stats.parseCount++;
      entry.stats.totalParseTime += parseTime;
      entry.stats.lastUsed = new Date();

      const result: ExtendedParseResult = {
        success: true,
        ast: processedAst,
        language,
        plugin: entry.plugin?.name,
        metrics: {
          parseTime,
          nodeCount,
          memoryUsage: process.memoryUsage().heapUsed,
          cacheHit: false,
        },
      };

      // Cache result
      if (cacheKey && this.config.performance.enableCaching) {
        this.parseCache.set(cacheKey, result);
      }

      this.emit("parseCompleted", language, result);
      return result;
    } catch (error) {
      const parseTime = Date.now() - startTime;
      entry.stats.errorCount++;

      const result: ExtendedParseResult = {
        success: false,
        errors: [
          {
            type:
              error instanceof Error && error.message.includes("timeout")
                ? "timeout"
                : "syntax",
            message:
              error instanceof Error ? error.message : "Unknown parsing error",
            severity: "error",
            language,
          },
        ],
        language,
        plugin: entry.plugin?.name,
        metrics: {
          parseTime,
          nodeCount: 0,
          memoryUsage: process.memoryUsage().heapUsed,
          cacheHit: false,
        },
      };

      this.emit("parseError", language, error);
      return result;
    }
  }

  /**
   * Detect language from code content
   */
  async detectLanguage(
    code: string,
    filename?: string,
    options?: {
      includeAlternatives?: boolean;
      maxAlternatives?: number;
    },
  ): Promise<LanguageDetectionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const alternatives: Array<{
      language: ExtendedLanguage;
      confidence: number;
    }> = [];

    // Try filename extension first
    if (filename) {
      const extension = this.getFileExtension(filename);
      for (const [language, entry] of this.languageRegistry) {
        if (entry.grammar.extensions.includes(extension)) {
          return {
            language,
            confidence: 0.9,
            method: "extension",
            alternatives: options?.includeAlternatives
              ? alternatives
              : undefined,
          };
        }
      }
    }

    // Try shebang detection
    const shebangMatch = code.match(/^#!\s*(.+)/);
    if (shebangMatch && shebangMatch[1]) {
      const shebang = shebangMatch[1];
      const detectedLanguage = this.detectLanguageFromShebang(shebang);
      if (detectedLanguage) {
        return {
          language: detectedLanguage,
          confidence: 0.85,
          method: "shebang",
          alternatives: options?.includeAlternatives ? alternatives : undefined,
        };
      }
    }

    // Try content-based heuristics
    const heuristicResult = await this.detectLanguageFromContent(code);
    if (heuristicResult) {
      return {
        language: heuristicResult.language,
        confidence: heuristicResult.confidence,
        method: "heuristic",
        alternatives: options?.includeAlternatives
          ? heuristicResult.alternatives
          : undefined,
      };
    }

    // Default to most common language
    const defaultLanguage = this.getMostCommonLanguage();
    return {
      language: defaultLanguage,
      confidence: 0.1,
      method: "heuristic",
      alternatives: options?.includeAlternatives ? alternatives : undefined,
    };
  }

  /**
   * Validate code in an extended language
   */
  async validateCode(
    code: string,
    language: ExtendedLanguage,
    options?: {
      useBuiltInValidators?: boolean;
      useCustomRules?: boolean;
      useExternalLinters?: boolean;
    },
  ): Promise<ValidationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const entry = this.languageRegistry.get(language);
    if (!entry || !entry.enabled) {
      return {
        valid: false,
        errors: [
          {
            type: "plugin",
            message: `Language ${language} is not supported for validation`,
            severity: "error",
            language,
          },
        ],
        warnings: [],
      };
    }

    const startTime = Date.now();
    const errors: ParseError[] = [];
    const warnings: ParseError[] = [];

    try {
      // Parse first to get AST
      const parseResult = await this.parseCode(code, language);
      if (!parseResult.success) {
        return {
          valid: false,
          errors: parseResult.errors || [],
          warnings: parseResult.warnings || [],
        };
      }

      // Run built-in validators
      if (
        options?.useBuiltInValidators !== false &&
        entry.grammar.validation?.builtIn
      ) {
        const builtInResults = await this.runBuiltInValidators(
          code,
          parseResult.ast,
          entry.grammar.validation.builtIn,
        );
        errors.push(...builtInResults.errors);
        warnings.push(...builtInResults.warnings);
      }

      // Run custom validation rules
      if (
        options?.useCustomRules !== false &&
        entry.grammar.validation?.customRules
      ) {
        const customResults = await this.runCustomValidationRules(
          code,
          parseResult.ast,
          entry.grammar.validation.customRules,
        );
        errors.push(...customResults.errors);
        warnings.push(...customResults.warnings);
      }

      // Run external linters
      if (
        options?.useExternalLinters !== false &&
        entry.grammar.validation?.externalLinters
      ) {
        const linterResults = await this.runExternalLinters(
          code,
          language,
          entry.grammar.validation.externalLinters,
        );
        errors.push(...linterResults.errors);
        warnings.push(...linterResults.warnings);
      }

      const duration = Date.now() - startTime;

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        metrics: {
          duration,
          memoryUsage: process.memoryUsage().heapUsed,
          rulesEvaluated:
            (entry.grammar.validation?.customRules?.length || 0) +
            (entry.grammar.validation?.builtIn?.length || 0) +
            (entry.grammar.validation?.externalLinters?.length || 0),
        },
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            type: "plugin",
            message:
              error instanceof Error ? error.message : "Validation failed",
            severity: "error",
            language,
          },
        ],
        warnings: [],
      };
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): ExtendedLanguage[] {
    return Array.from(this.languageRegistry.keys());
  }

  /**
   * Get language statistics
   */
  getLanguageStats(): Record<ExtendedLanguage, LanguageRegistryEntry["stats"]> {
    const stats: Record<string, LanguageRegistryEntry["stats"]> = {};
    for (const [language, entry] of this.languageRegistry) {
      stats[language] = { ...entry.stats };
    }
    return stats;
  }

  /**
   * Enable/disable a language
   */
  setLanguageEnabled(language: ExtendedLanguage, enabled: boolean): void {
    const entry = this.languageRegistry.get(language);
    if (entry) {
      entry.enabled = enabled;
      this.emit("languageToggled", language, enabled);
    }
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.grammarCache.clear();
    this.parseCache.clear();
    this.emit("cachesCleared");
  }

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    // Dispose plugins
    for (const [name, plugin] of this.pluginRegistry) {
      try {
        await plugin.dispose();
      } catch (error) {
        this.emit("pluginDisposeError", name, error);
      }
    }

    // Clear all caches and registries
    this.languageRegistry.clear();
    this.pluginRegistry.clear();
    this.pluginContexts.clear();
    this.clearCaches();

    this.isInitialized = false;
    this.emit("disposed");
  }

  // Private methods

  private async loadBuiltInLanguages(): Promise<void> {
    // Load extended language grammars that come bundled
    const builtInLanguages: LanguageGrammar[] = [
      {
        name: "html",
        displayName: "HTML",
        extensions: [".html", ".htm", ".xhtml"],
        grammarPath: "./grammars/tree-sitter-html.wasm",
        metadata: {
          category: "markup",
          paradigms: ["declarative"],
          useCases: ["web-development", "documentation"],
          status: "stable",
          supportLevel: "full",
        },
      },
      {
        name: "css",
        displayName: "CSS",
        extensions: [".css"],
        grammarPath: "./grammars/tree-sitter-css.wasm",
        metadata: {
          category: "stylesheet",
          paradigms: ["declarative"],
          useCases: ["web-development", "styling"],
          status: "stable",
          supportLevel: "full",
        },
      },
      {
        name: "dockerfile",
        displayName: "Dockerfile",
        extensions: [".dockerfile", "Dockerfile"],
        grammarPath: "./grammars/tree-sitter-dockerfile.wasm",
        metadata: {
          category: "configuration",
          paradigms: ["declarative"],
          useCases: ["containerization", "deployment"],
          status: "stable",
          supportLevel: "full",
        },
      },
    ];

    for (const grammar of builtInLanguages) {
      try {
        await this.registerLanguage(grammar);
      } catch (error) {
        // Built-in languages are optional, continue if one fails
        this.emit("builtInLanguageLoadFailed", grammar.name, error);
      }
    }
  }

  private async discoverPlugins(): Promise<void> {
    // Plugin discovery implementation would go here
    // For now, this is a placeholder for the plugin architecture
    this.emit("pluginDiscoveryCompleted", 0);
  }

  private async validateGrammars(): Promise<void> {
    for (const [language, _entry] of this.languageRegistry) {
      try {
        // Basic validation - try to parse a simple test
        await this.parseCode("// test", language);
      } catch (error) {
        this.emit("grammarValidationFailed", language, error);
        if (this.config.validation.strictMode) {
          throw error;
        }
      }
    }
  }

  private async validatePlugins(): Promise<void> {
    for (const [name, plugin] of this.pluginRegistry) {
      try {
        // Validate plugin metadata and capabilities
        if (!plugin.metadata || !plugin.version) {
          throw new Error("Invalid plugin metadata");
        }
      } catch (error) {
        this.emit("pluginValidationFailed", name, error);
        if (this.config.validation.strictMode) {
          throw error;
        }
      }
    }
  }

  private async loadGrammar(grammarPath: string): Promise<ArrayBuffer> {
    // Check cache first
    if (this.grammarCache.has(grammarPath)) {
      const cached = this.grammarCache.get(grammarPath);
      if (!cached) {
        throw new Error(`Grammar not found in cache: ${grammarPath}`);
      }
      return cached;
    }

    // Load grammar file
    // In a real implementation, this would load from file system
    // For now, return a placeholder
    const buffer = new ArrayBuffer(0);
    this.grammarCache.set(grammarPath, buffer);
    return buffer;
  }

  private createPluginContext(pluginName: string): PluginContext {
    const logger: PluginLogger = {
      debug: (message: string, ...args: unknown[]) =>
        this.emit("pluginLog", pluginName, "debug", message, args),
      info: (message: string, ...args: unknown[]) =>
        this.emit("pluginLog", pluginName, "info", message, args),
      warn: (message: string, ...args: unknown[]) =>
        this.emit("pluginLog", pluginName, "warn", message, args),
      error: (message: string, ...args: unknown[]) =>
        this.emit("pluginLog", pluginName, "error", message, args),
    };

    const fs: PluginFileSystem = {
      readFile: async (_path: string) => "",
      writeFile: async (_path: string, _content: string) => {
        // No-op implementation for default provider
      },
      exists: async (_path: string) => false,
      mkdir: async (_path: string) => {
        // No-op implementation for default provider
      },
      readdir: async (_path: string) => [],
    };

    const cache: PluginCache = {
      get: async <T>(_key: string) => undefined as T | undefined,
      set: async <T>(_key: string, _value: T, _ttl?: number) => {
        // No-op implementation for default provider
      },
      delete: async (_key: string) => {
        // No-op implementation for default provider
      },
      clear: async () => {
        // No-op implementation for default provider
      },
    };

    const events: PluginEventEmitter = {
      on: (event: string, listener: (...args: unknown[]) => void) =>
        this.on(`plugin:${pluginName}:${event}`, listener),
      emit: (event: string, ...args: unknown[]) =>
        this.emit(`plugin:${pluginName}:${event}`, ...args),
      off: (event: string, listener: (...args: unknown[]) => void) =>
        this.off(`plugin:${pluginName}:${event}`, listener),
    };

    return {
      config: this.config.pluginConfigs[pluginName] || {},
      logger,
      fs,
      cache,
      events,
    };
  }

  private async performParse(parser: Parser, code: string): Promise<unknown> {
    const tree = parser.parse(code);
    return tree.rootNode;
  }

  private countNodes(_ast: unknown): number {
    // Simple node counting implementation
    return 1; // Placeholder
  }

  private getCacheKey(code: string, language: ExtendedLanguage): string {
    // Create hash-based cache key
    return `${language}:${code.length}:${this.simpleHash(code)}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf(".");
    return lastDot >= 0 ? filename.slice(lastDot) : "";
  }

  private detectLanguageFromShebang(shebang: string): ExtendedLanguage | null {
    if (shebang.includes("python")) {
      return "python" as ExtendedLanguage;
    }
    if (shebang.includes("node")) {
      return "javascript" as ExtendedLanguage;
    }
    if (shebang.includes("bash")) {
      return "bash";
    }
    if (shebang.includes("sh")) {
      return "bash";
    }
    return null;
  }

  private async detectLanguageFromContent(code: string): Promise<{
    language: ExtendedLanguage;
    confidence: number;
    alternatives?: Array<{ language: ExtendedLanguage; confidence: number }>;
  } | null> {
    // Content-based language detection heuristics
    // This is a simplified implementation

    if (code.includes("function") && code.includes("{")) {
      return { language: "javascript" as ExtendedLanguage, confidence: 0.7 };
    }

    if (code.includes("def ") && code.includes(":")) {
      return { language: "python" as ExtendedLanguage, confidence: 0.8 };
    }

    return null;
  }

  private getMostCommonLanguage(): ExtendedLanguage {
    // Return the most commonly used language based on statistics
    let mostUsed: ExtendedLanguage = "javascript" as ExtendedLanguage;
    let maxCount = 0;

    for (const [language, entry] of this.languageRegistry) {
      if (entry.stats.parseCount > maxCount) {
        maxCount = entry.stats.parseCount;
        mostUsed = language;
      }
    }

    return mostUsed;
  }

  private async runBuiltInValidators(
    _code: string,
    _ast: unknown,
    _validators: BuiltInValidator[],
  ): Promise<{ errors: ParseError[]; warnings: ParseError[] }> {
    // Placeholder for built-in validator execution
    return { errors: [], warnings: [] };
  }

  private async runCustomValidationRules(
    _code: string,
    _ast: unknown,
    _rules: ValidationRule[],
  ): Promise<{ errors: ParseError[]; warnings: ParseError[] }> {
    // Placeholder for custom validation rule execution
    return { errors: [], warnings: [] };
  }

  private async runExternalLinters(
    _code: string,
    _language: ExtendedLanguage,
    _linters: ExternalLinter[],
  ): Promise<{ errors: ParseError[]; warnings: ParseError[] }> {
    // Placeholder for external linter execution
    return { errors: [], warnings: [] };
  }

  private setupCacheCleanup(): void {
    // Set up periodic cache cleanup
    if (this.config.performance.enableCaching) {
      setInterval(() => {
        this.cleanupCaches();
      }, 300000); // 5 minutes
    }
  }

  private cleanupCaches(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1 hour

    // Clean up parse cache
    for (const [key, result] of this.parseCache) {
      if (result.metrics && now - result.metrics.parseTime > maxAge) {
        this.parseCache.delete(key);
      }
    }

    this.emit("cachesCleaned");
  }
}
