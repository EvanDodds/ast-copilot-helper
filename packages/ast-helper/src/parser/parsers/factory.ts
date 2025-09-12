/**
 * Parser Factory - Creates appropriate parser instances based on runtime detection
 */

import { NativeTreeSitterParser } from './native-parser.js';
import { WASMTreeSitterParser } from './wasm-parser.js';
import { RuntimeDetector } from '../runtime-detector.js';
import { TreeSitterGrammarManager } from '../grammar-manager.js';
import { ASTParser, ParserRuntime } from '../types.js';

/**
 * Simple runtime implementations for factory use
 */
class SimpleNativeRuntime implements ParserRuntime {
  type: 'native' = 'native';
  available = false;

  async initialize(): Promise<void> {
    try {
      await import('tree-sitter');
      this.available = true;
    } catch (error) {
      this.available = false;
    }
  }

  async createParser(_language: string): Promise<any> {
    const TreeSitter = (await import('tree-sitter')).default;
    return new TreeSitter();
  }
}

class SimpleWasmRuntime implements ParserRuntime {
  type: 'wasm' = 'wasm';
  available = false;

  async initialize(): Promise<void> {
    try {
      const Parser = (await import('web-tree-sitter')).default;
      await Parser.init();
      this.available = true;
    } catch (error) {
      this.available = false;
    }
  }

  async createParser(_language: string): Promise<any> {
    const Parser = (await import('web-tree-sitter')).default;
    return new Parser();
  }
}

/**
 * Factory class for creating appropriate parser instances
 */
export class ParserFactory {
  private static grammarManager: TreeSitterGrammarManager;

  /**
   * Create a parser instance using automatic runtime detection
   */
  static async createParser(grammarManager?: TreeSitterGrammarManager): Promise<ASTParser> {
    // Use provided grammar manager or create a default one
    this.grammarManager = grammarManager || new TreeSitterGrammarManager();

    try {
      // Detect best available runtime
      const runtime = await RuntimeDetector.getBestRuntime();
      
      // Create parser based on runtime type
      if (runtime.type === 'native') {
        return new NativeTreeSitterParser(runtime, this.grammarManager);
      } else {
        return new WASMTreeSitterParser(runtime, this.grammarManager);
      }
    } catch (error) {
      throw new Error(`Failed to create parser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a native parser (will throw if native runtime is not available)
   */
  static async createNativeParser(grammarManager?: TreeSitterGrammarManager): Promise<NativeTreeSitterParser> {
    this.grammarManager = grammarManager || new TreeSitterGrammarManager();

    try {
      const runtime = new SimpleNativeRuntime();
      await runtime.initialize();
      
      if (!runtime.available) {
        throw new Error('Native Tree-sitter runtime is not available');
      }

      return new NativeTreeSitterParser(runtime, this.grammarManager);
    } catch (error) {
      throw new Error(`Failed to create native parser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a WASM parser (should always work as fallback)
   */
  static async createWASMParser(grammarManager?: TreeSitterGrammarManager): Promise<WASMTreeSitterParser> {
    this.grammarManager = grammarManager || new TreeSitterGrammarManager();

    try {
      const runtime = new SimpleWasmRuntime();
      await runtime.initialize();
      
      if (!runtime.available) {
        throw new Error('WASM Tree-sitter runtime is not available');
      }

      return new WASMTreeSitterParser(runtime, this.grammarManager);
    } catch (error) {
      throw new Error(`Failed to create WASM parser: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get information about available runtimes
   */
  static async getRuntimeInfo(): Promise<{
    native: { available: boolean; error?: string };
    wasm: { available: boolean; error?: string };
    recommended: 'native' | 'wasm';
  }> {
    const nativeRuntime = new SimpleNativeRuntime();
    const wasmRuntime = new SimpleWasmRuntime();

    let nativeError: string | undefined;
    let wasmError: string | undefined;

    try {
      await nativeRuntime.initialize();
    } catch (error) {
      nativeError = error instanceof Error ? error.message : 'Unknown error';
    }

    try {
      await wasmRuntime.initialize();
    } catch (error) {
      wasmError = error instanceof Error ? error.message : 'Unknown error';
    }

    return {
      native: {
        available: nativeRuntime.available,
        error: nativeError,
      },
      wasm: {
        available: wasmRuntime.available,
        error: wasmError,
      },
      recommended: nativeRuntime.available ? 'native' : 'wasm',
    };
  }
}

/**
 * Convenience function to create a parser with automatic runtime detection
 */
export async function createParser(grammarManager?: TreeSitterGrammarManager): Promise<ASTParser> {
  return ParserFactory.createParser(grammarManager);
}

/**
 * Convenience function to create a native parser
 */
export async function createNativeParser(grammarManager?: TreeSitterGrammarManager): Promise<NativeTreeSitterParser> {
  return ParserFactory.createNativeParser(grammarManager);
}

/**
 * Convenience function to create a WASM parser
 */
export async function createWASMParser(grammarManager?: TreeSitterGrammarManager): Promise<WASMTreeSitterParser> {
  return ParserFactory.createWASMParser(grammarManager);
}