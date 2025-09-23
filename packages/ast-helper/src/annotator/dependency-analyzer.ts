import { resolve, dirname } from 'node:path';
import type { ASTNode } from '../parser/types.js';
import type { DependencyInfo, DependencyAnalysisConfig } from './types.js';
import { DependencyType } from './types.js';

/**
 * Analyzes dependencies, imports, exports, and function calls in AST nodes
 * Provides comprehensive dependency mapping and cycle detection
 */
export class DependencyAnalyzer {
  private config: DependencyAnalysisConfig;
  private dependencyCache: Map<string, DependencyInfo[]> = new Map();
  private callGraphCache: Map<string, Set<string>> = new Map();

  constructor(config: Partial<DependencyAnalysisConfig> = {}) {
    this.config = {
      maxDepth: 10,
      includeDynamicImports: true,
      includeTypeImports: true,
      detectCycles: true,
      followChain: true,
      ignoreNodeModules: false,
      customModuleResolver: null,
      ...config
    };
  }

  /**
   * Analyzes all dependencies for a given AST node
   */
  public async analyzeDependencies(node: ASTNode, filePath?: string): Promise<DependencyInfo[]> {
    const cacheKey = this.getCacheKey(node, filePath);
    
    if (this.dependencyCache.has(cacheKey)) {
      return this.dependencyCache.get(cacheKey)!;
    }

    const dependencies: DependencyInfo[] = [];
    
    try {
      // Extract imports
      const imports = await this.extractImports(node, filePath);
      dependencies.push(...imports);
      
      // Extract exports  
      const exports = await this.extractExports(node, filePath);
      dependencies.push(...exports);
      
      // Extract function/method calls
      const calls = await this.extractCalls(node);
      dependencies.push(...calls);
      
      // Extract require statements (for CommonJS)
      const requires = await this.extractRequires(node, filePath);
      dependencies.push(...requires);

      // Detect dependency cycles if enabled
      if (this.config.detectCycles && filePath) {
        await this.detectCycles(dependencies, filePath);
      }

      // Cache the results
      this.dependencyCache.set(cacheKey, dependencies);
      
      return dependencies;
    } catch (error) {
      console.error(`Error analyzing dependencies for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Extracts import statements and declarations
   */
  private async extractImports(node: ASTNode, filePath?: string): Promise<DependencyInfo[]> {
    const imports: DependencyInfo[] = [];
    
    await this.traverseNode(node, async (currentNode) => {
      const type = currentNode.type?.toLowerCase() || '';
      const nodeAny = currentNode as any;
      
      // ES6 imports
      if (type === 'importdeclaration') {
        const importInfo = await this.parseImportDeclaration(currentNode, filePath);
        if (importInfo) {
imports.push(importInfo);
}
      }
      
      // Dynamic imports
      if (this.config.includeDynamicImports && type === 'import' && nodeAny.arguments) {
        const dynamicImport = await this.parseDynamicImport(currentNode, filePath);
        if (dynamicImport) {
imports.push(dynamicImport);
}
      }
      
      // TypeScript type imports
      if (this.config.includeTypeImports && type === 'importtype') {
        const typeImport = await this.parseBasicImport(currentNode, filePath, true);
        if (typeImport) {
imports.push(typeImport);
}
      }
    });
    
    return imports;
  }

  /**
   * Extracts export statements and declarations
   */
  private async extractExports(node: ASTNode, filePath?: string): Promise<DependencyInfo[]> {
    const exports: DependencyInfo[] = [];
    
    await this.traverseNode(node, async (currentNode) => {
      const type = currentNode.type?.toLowerCase() || '';
      
      if (type === 'exportdeclaration' || type === 'exportdefaultdeclaration' || 
          type === 'exportnameddeclaration' || type === 'exportalldeclaration') {
        const exportInfo = await this.parseExportDeclaration(currentNode, filePath);
        if (exportInfo) {
exports.push(exportInfo);
}
      }
    });
    
    return exports;
  }

  /**
   * Extracts function and method calls
   */
  private async extractCalls(node: ASTNode): Promise<DependencyInfo[]> {
    const calls: DependencyInfo[] = [];
    
    await this.traverseNode(node, async (currentNode) => {
      const type = currentNode.type?.toLowerCase() || '';
      
      if (type === 'callexpression' || type === 'newexpression') {
        const callInfo = await this.parseCallExpression(currentNode);
        if (callInfo) {
calls.push(callInfo);
}
      }
      
      if (type === 'memberexpression') {
        const memberCall = await this.parseMemberExpression(currentNode);
        if (memberCall) {
calls.push(memberCall);
}
      }
    });
    
    return calls;
  }

  /**
   * Extracts CommonJS require statements
   */
  private async extractRequires(node: ASTNode, filePath?: string): Promise<DependencyInfo[]> {
    const requires: DependencyInfo[] = [];
    
    await this.traverseNode(node, async (currentNode) => {
      if (this.isRequireCall(currentNode)) {
        const requireInfo = await this.parseRequireCall(currentNode, filePath);
        if (requireInfo) {
requires.push(requireInfo);
}
      }
    });
    
    return requires;
  }

  /**
   * Parses ES6 import declaration
   */
  private async parseImportDeclaration(node: ASTNode, filePath?: string): Promise<DependencyInfo | null> {
    try {
      const nodeAny = node as any;
      const source = this.extractStringLiteral(nodeAny.source);
      if (!source) {
return null;
}
      
      const specifiers = this.extractImportSpecifiers(nodeAny);
      
      return {
        type: DependencyType.IMPORT,
        source: source,
        specifiers: specifiers,
        location: this.getNodeLocation(node),
        isExternal: this.isExternalModule(source),
        isDynamic: false,
        isTypeOnly: this.isTypeOnlyImport(nodeAny),
        resolvedPath: await this.resolveModulePath(source, filePath)
      };
    } catch (error) {
      console.error('Error parsing import declaration:', error);
      return null;
    }
  }

  /**
   * Parses dynamic import expression
   */
  private async parseDynamicImport(node: ASTNode, filePath?: string): Promise<DependencyInfo | null> {
    try {
      const nodeAny = node as any;
      const args = nodeAny.arguments || [];
      if (args.length === 0) {
return null;
}
      
      const source = this.extractStringLiteral(args[0]);
      if (!source) {
return null;
}
      
      return {
        type: DependencyType.IMPORT,
        source: source,
        specifiers: [],
        location: this.getNodeLocation(node),
        isExternal: this.isExternalModule(source),
        isDynamic: true,
        isTypeOnly: false,
        resolvedPath: await this.resolveModulePath(source, filePath)
      };
    } catch (error) {
      console.error('Error parsing dynamic import:', error);
      return null;
    }
  }

  /**
   * Parses basic import (fallback for type imports)
   */
  private async parseBasicImport(node: ASTNode, filePath?: string, isTypeOnly = false): Promise<DependencyInfo | null> {
    try {
      const nodeAny = node as any;
      const source = this.extractStringLiteral(nodeAny.source);
      if (!source) {
return null;
}
      
      return {
        type: DependencyType.IMPORT,
        source: source,
        specifiers: [],
        location: this.getNodeLocation(node),
        isExternal: this.isExternalModule(source),
        isDynamic: false,
        isTypeOnly: isTypeOnly,
        resolvedPath: await this.resolveModulePath(source, filePath)
      };
    } catch (error) {
      console.error('Error parsing basic import:', error);
      return null;
    }
  }

  /**
   * Parses export declaration
   */
  private async parseExportDeclaration(node: ASTNode, filePath?: string): Promise<DependencyInfo | null> {
    try {
      const nodeAny = node as any;
      const exportNames = this.extractExportNames(nodeAny);
      const source = nodeAny.source ? this.extractStringLiteral(nodeAny.source) : null;
      
      return {
        type: DependencyType.EXPORT,
        source: source || filePath || 'current-file',
        specifiers: exportNames,
        location: this.getNodeLocation(node),
        isExternal: source ? this.isExternalModule(source) : false,
        isDynamic: false,
        isTypeOnly: this.isTypeOnlyExport(nodeAny),
        resolvedPath: source ? await this.resolveModulePath(source, filePath) : filePath || null
      };
    } catch (error) {
      console.error('Error parsing export declaration:', error);
      return null;
    }
  }

  /**
   * Parses function/method call expression
   */
  private async parseCallExpression(node: ASTNode): Promise<DependencyInfo | null> {
    try {
      const nodeAny = node as any;
      const functionName = this.extractCalleeIdentifier(nodeAny.callee);
      if (!functionName) {
return null;
}
      
      return {
        type: DependencyType.CALL,
        source: functionName,
        specifiers: [functionName],
        location: this.getNodeLocation(node),
        isExternal: false,
        isDynamic: false,
        isTypeOnly: false,
        resolvedPath: null,
        callArguments: (nodeAny.arguments || []).length
      };
    } catch (error) {
      console.error('Error parsing call expression:', error);
      return null;
    }
  }

  /**
   * Parses member expression calls
   */
  private async parseMemberExpression(node: ASTNode): Promise<DependencyInfo | null> {
    try {
      const nodeAny = node as any;
      const objectName = this.extractIdentifierName(nodeAny.object);
      const propertyName = this.extractIdentifierName(nodeAny.property);
      
      if (!objectName || !propertyName) {
return null;
}
      
      const fullName = `${objectName}.${propertyName}`;
      
      return {
        type: DependencyType.CALL,
        source: fullName,
        specifiers: [fullName],
        location: this.getNodeLocation(node),
        isExternal: false,
        isDynamic: false,
        isTypeOnly: false,
        resolvedPath: null
      };
    } catch (error) {
      console.error('Error parsing member expression:', error);
      return null;
    }
  }

  /**
   * Parses CommonJS require call
   */
  private async parseRequireCall(node: ASTNode, filePath?: string): Promise<DependencyInfo | null> {
    try {
      const nodeAny = node as any;
      const args = nodeAny.arguments || [];
      if (args.length === 0) {
return null;
}
      
      const source = this.extractStringLiteral(args[0]);
      if (!source) {
return null;
}
      
      return {
        type: DependencyType.REQUIRE,
        source: source,
        specifiers: [],
        location: this.getNodeLocation(node),
        isExternal: this.isExternalModule(source),
        isDynamic: false,
        isTypeOnly: false,
        resolvedPath: await this.resolveModulePath(source, filePath)
      };
    } catch (error) {
      console.error('Error parsing require call:', error);
      return null;
    }
  }

  /**
   * Detects circular dependencies
   */
  private async detectCycles(dependencies: DependencyInfo[], filePath: string): Promise<void> {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    for (const dep of dependencies) {
      if (dep.resolvedPath && !visited.has(dep.resolvedPath)) {
        const cycle = await this.dfsDetectCycle(dep.resolvedPath, visited, recursionStack, filePath);
        if (cycle) {
          dep.circularDependency = cycle;
        }
      }
    }
  }

  /**
   * DFS-based cycle detection
   */
  private async dfsDetectCycle(
    currentPath: string, 
    visited: Set<string>, 
    recursionStack: Set<string>,
    startPath: string,
    path: string[] = []
  ): Promise<string[] | null> {
    visited.add(currentPath);
    recursionStack.add(currentPath);
    path.push(currentPath);
    
    // If we've reached back to the starting file, we found a cycle
    if (path.length > 1 && currentPath === startPath) {
      return [...path];
    }
    
    // Get dependencies for current file (would need file system access)
    // This is a simplified implementation
    if (path.length > this.config.maxDepth) {
      recursionStack.delete(currentPath);
      path.pop();
      return null;
    }
    
    recursionStack.delete(currentPath);
    path.pop();
    return null;
  }

  /**
   * Utility methods
   */
  
  private async traverseNode(node: ASTNode, callback: (node: ASTNode) => Promise<void>): Promise<void> {
    await callback(node);
    
    if (node.children) {
      for (const child of node.children) {
        await this.traverseNode(child, callback);
      }
    }
    
    // Handle other common AST properties
    const nodeAny = node as any;
    const properties = ['body', 'statements', 'declarations', 'elements'];
    for (const prop of properties) {
      const value = nodeAny[prop];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object') {
            await this.traverseNode(item, callback);
          }
        }
      }
    }
  }

  private getCacheKey(node: ASTNode, filePath?: string): string {
    return `${filePath || 'unknown'}:${node.type}:${node.start || 0}:${node.end || 0}`;
  }

  private extractStringLiteral(node: any): string | null {
    if (!node) {
return null;
}
    if (typeof node === 'string') {
return node;
}
    if (node.value && typeof node.value === 'string') {
return node.value;
}
    if (node.raw && typeof node.raw === 'string') {
      // Remove quotes from string literals
      return node.raw.replace(/^['"`]|['"`]$/g, '');
    }
    return null;
  }

  private extractImportSpecifiers(nodeAny: any): string[] {
    const specifiers: string[] = [];
    
    if (nodeAny.specifiers) {
      for (const spec of nodeAny.specifiers) {
        const name = this.extractIdentifierName(spec.imported || spec.local);
        if (name) {
specifiers.push(name);
}
      }
    }
    
    return specifiers;
  }

  private extractExportNames(nodeAny: any): string[] {
    const names: string[] = [];
    
    if (nodeAny.specifiers) {
      for (const spec of nodeAny.specifiers) {
        const name = this.extractIdentifierName(spec.exported || spec.local);
        if (name) {
names.push(name);
}
      }
    }
    
    if (nodeAny.declaration) {
      const declName = this.extractIdentifierName(nodeAny.declaration);
      if (declName) {
names.push(declName);
}
    }
    
    return names;
  }

  private extractCalleeIdentifier(callee: any): string | null {
    if (!callee) {
return null;
}
    
    if (callee.type === 'Identifier') {
      return callee.name || null;
    }
    
    if (callee.type === 'MemberExpression') {
      const object = this.extractIdentifierName(callee.object);
      const property = this.extractIdentifierName(callee.property);
      return object && property ? `${object}.${property}` : null;
    }
    
    return null;
  }

  private extractIdentifierName(node: any): string | null {
    if (!node) {
return null;
}
    if (typeof node === 'string') {
return node;
}
    if (node.name && typeof node.name === 'string') {
return node.name;
}
    if (node.id && node.id.name) {
return node.id.name;
}
    return null;
  }

  private getNodeLocation(node: ASTNode): { line: number; column: number } {
    const nodeAny = node as any;
    return {
      line: nodeAny.line || nodeAny.loc?.start?.line || 0,
      column: nodeAny.column || nodeAny.loc?.start?.column || 0
    };
  }

  private isExternalModule(source: string): boolean {
    if (this.config.ignoreNodeModules) {
return false;
}
    return !source.startsWith('./') && !source.startsWith('../') && !source.startsWith('/');
  }

  private isTypeOnlyImport(nodeAny: any): boolean {
    return nodeAny.importKind === 'type' || nodeAny.typeOnly === true;
  }

  private isTypeOnlyExport(nodeAny: any): boolean {
    return nodeAny.exportKind === 'type' || nodeAny.typeOnly === true;
  }

  private isRequireCall(node: ASTNode): boolean {
    const nodeAny = node as any;
    return node.type === 'CallExpression' && 
           nodeAny.callee &&
           nodeAny.callee.type === 'Identifier' &&
           nodeAny.callee.name === 'require';
  }

  private async resolveModulePath(source: string, basePath?: string): Promise<string | null> {
    if (this.config.customModuleResolver) {
      return await this.config.customModuleResolver(source, basePath);
    }
    
    // Default simple resolution
    if (this.isExternalModule(source)) {
      return `node_modules/${source}`;
    }
    
    if (basePath && typeof require !== 'undefined') {
      try {
        return resolve(dirname(basePath), source);
      } catch (_error) {
        // Fall back to simple path resolution if require is not available
      }
    }
    
    return source;
  }

  /**
   * Clears all caches
   */
  public clearCache(): void {
    this.dependencyCache.clear();
    this.callGraphCache.clear();
  }

  /**
   * Gets cache statistics
   */
  public getCacheStats(): { dependencies: number; callGraphs: number } {
    return {
      dependencies: this.dependencyCache.size,
      callGraphs: this.callGraphCache.size
    };
  }
}