/**
 * Runtime detection and management for Tree-sitter parsers
 * Handles detection of native vs WASM runtime availability
 */

import { ParserRuntime } from './types.js';

export class RuntimeDetector {
  private static _nativeRuntime: NativeRuntime | null = null;
  private static _wasmRuntime: WasmRuntime | null = null;
  private static _detectionCache: Map<string, boolean> = new Map();

  /**
   * Get the best available runtime (native preferred, WASM fallback)
   */
  static async getBestRuntime(): Promise<ParserRuntime> {
    // Try native first
    if (await this.isNativeAvailable()) {
      if (!this._nativeRuntime) {
        this._nativeRuntime = new NativeRuntime();
        await this._nativeRuntime.initialize();
      }
      return this._nativeRuntime;
    }

    // Fallback to WASM
    if (await this.isWasmAvailable()) {
      if (!this._wasmRuntime) {
        this._wasmRuntime = new WasmRuntime();
        await this._wasmRuntime.initialize();
      }
      return this._wasmRuntime;
    }

    throw new Error('No Tree-sitter runtime available (neither native nor WASM)');
  }

  /**
   * Check if native Tree-sitter runtime is available
   */
  static async isNativeAvailable(): Promise<boolean> {
    const cacheKey = 'native';
    if (this._detectionCache.has(cacheKey)) {
      return this._detectionCache.get(cacheKey)!;
    }

    try {
      // Try to require tree-sitter using dynamic import with try/catch
      const treeSitterModule = await this.tryImport('tree-sitter');
      this._detectionCache.set(cacheKey, !!treeSitterModule);
      return !!treeSitterModule;
    } catch (error: any) {
      this._detectionCache.set(cacheKey, false);
      return false;
    }
  }

  /**
   * Check if WASM Tree-sitter runtime is available
   */
  static async isWasmAvailable(): Promise<boolean> {
    const cacheKey = 'wasm';
    if (this._detectionCache.has(cacheKey)) {
      return this._detectionCache.get(cacheKey)!;
    }

    try {
      // Try to require web-tree-sitter
      const wasmModule = await this.tryImport('web-tree-sitter');
      this._detectionCache.set(cacheKey, !!wasmModule);
      return !!wasmModule;
    } catch (error: any) {
      this._detectionCache.set(cacheKey, false);
      return false;
    }
  }

  /**
   * Try to import a module, returning null if it fails
   */
  private static async tryImport(moduleName: string): Promise<any> {
    try {
      return await import(moduleName);
    } catch {
      return null;
    }
  }

  /**
   * Clear detection cache (for testing)
   */
  static clearCache(): void {
    this._detectionCache.clear();
    this._nativeRuntime = null;
    this._wasmRuntime = null;
  }
}

/**
 * Native Tree-sitter runtime implementation
 */
class NativeRuntime implements ParserRuntime {
  type: 'native' = 'native';
  available: boolean = false;
  private TreeSitter: any = null;
  private parsers: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    try {
      const treeSitterModule = await RuntimeDetector['tryImport']('tree-sitter');
      if (!treeSitterModule) {
        throw new Error('tree-sitter module not available');
      }
      this.TreeSitter = treeSitterModule.default || treeSitterModule;
      this.available = true;
    } catch (error: any) {
      this.available = false;
      throw new Error(`Failed to initialize native Tree-sitter: ${error?.message || 'Unknown error'}`);
    }
  }

  async createParser(language: string): Promise<any> {
    if (!this.available) {
      throw new Error('Native Tree-sitter runtime not available');
    }

    // Check if parser already exists
    if (this.parsers.has(language)) {
      return this.parsers.get(language);
    }

    const parser = new this.TreeSitter();
    
    // Try to load the language grammar
    try {
      let languageGrammar: any;
      const grammarModuleName = this.getGrammarModuleName(language);
      const grammarModule = await RuntimeDetector['tryImport'](grammarModuleName);
      
      if (!grammarModule) {
        throw new Error(`Grammar module ${grammarModuleName} not available`);
      }

      switch (language) {
        case 'typescript':
          languageGrammar = grammarModule.typescript || grammarModule.default;
          break;
        case 'javascript':
          languageGrammar = grammarModule.default || grammarModule;
          break;
        case 'python':
          languageGrammar = grammarModule.default || grammarModule;
          break;
        default:
          throw new Error(`Unsupported language: ${language}`);
      }

      if (!languageGrammar) {
        throw new Error(`Could not extract grammar for ${language}`);
      }

      parser.setLanguage(languageGrammar);
      this.parsers.set(language, parser);
      return parser;
    } catch (error: any) {
      throw new Error(`Failed to create parser for ${language}: ${error?.message || 'Unknown error'}`);
    }
  }

  private getGrammarModuleName(language: string): string {
    switch (language) {
      case 'typescript':
        return 'tree-sitter-typescript';
      case 'javascript':
        return 'tree-sitter-javascript';
      case 'python':
        return 'tree-sitter-python';
      default:
        throw new Error(`Unknown language: ${language}`);
    }
  }
}

/**
 * WASM Tree-sitter runtime implementation
 */
class WasmRuntime implements ParserRuntime {
  type: 'wasm' = 'wasm';
  available: boolean = false;
  private TreeSitter: any = null;
  private parsers: Map<string, any> = new Map();

  async initialize(): Promise<void> {
    try {
      const wasmModule = await RuntimeDetector['tryImport']('web-tree-sitter');
      if (!wasmModule) {
        throw new Error('web-tree-sitter module not available');
      }
      this.TreeSitter = wasmModule.default || wasmModule;
      this.available = true;
    } catch (error: any) {
      this.available = false;
      throw new Error(`Failed to initialize WASM Tree-sitter: ${error?.message || 'Unknown error'}`);
    }
  }

  async createParser(language: string): Promise<any> {
    if (!this.available) {
      throw new Error('WASM Tree-sitter runtime not available');
    }

    // Check if parser already exists
    if (this.parsers.has(language)) {
      return this.parsers.get(language);
    }

    const parser = new this.TreeSitter();

    // For WASM, we'll need to load grammars from files
    // This will be implemented by the GrammarManager
    this.parsers.set(language, parser);
    return parser;
  }
}