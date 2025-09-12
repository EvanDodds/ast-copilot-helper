import * as tmp from 'tmp';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class TestRepository {
  constructor(private basePath: string) {}

  async createFile(relativePath: string, content: string): Promise<void> {
    const fullPath = resolve(this.basePath, relativePath);
    const dir = resolve(fullPath, '..');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }

  async createGitRepository(): Promise<void> {
    try {
      await execFileAsync('git', ['init'], { cwd: this.basePath });
      await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: this.basePath });
      await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: this.basePath });
    } catch (error) {
      throw new Error(`Failed to create git repository: ${error}`);
    }
  }

  async commitFiles(message: string): Promise<void> {
    try {
      await execFileAsync('git', ['add', '.'], { cwd: this.basePath });
      await execFileAsync('git', ['commit', '-m', message], { cwd: this.basePath });
    } catch (error) {
      throw new Error(`Failed to commit files: ${error}`);
    }
  }

  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.basePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

export class ASTTestHelpers {
  static createMockASTNode(overrides?: Partial<any>): any {
    return {
      id: 'test-node-id',
      type: 'FunctionDeclaration',
      name: 'testFunction',
      location: {
        file: 'test.ts',
        line: 1,
        column: 1,
      },
      significance: 'high',
      children: [],
      ...overrides,
    };
  }

  static createTestAnnotation(nodeId: string): any {
    return {
      nodeId,
      content: `Test annotation for ${nodeId}`,
      metadata: {
        generated: new Date().toISOString(),
        type: 'test-annotation',
      },
    };
  }

  static async generateSyntheticRepository(nodeCount: number): Promise<string> {
    const tmpDir = await new Promise<string>((resolve, reject) => {
      tmp.dir({ unsafeCleanup: true }, (err: any, path: string) => {
        if (err) reject(err);
        else resolve(path);
      });
    });

    const repo = new TestRepository(tmpDir);
    await repo.createGitRepository();

    // Generate files with specified number of significant AST nodes
    const filesNeeded = Math.ceil(nodeCount / 150); // ~150 nodes per file for better distribution
    
    for (let i = 0; i < filesNeeded; i++) {
      const nodesInFile = Math.min(150, nodeCount - (i * 150));
      
      // Create different file types for variety
      if (i % 4 === 0) {
        const content = this.generateTypeScriptFile(nodesInFile, i);
        await repo.createFile(`src/typescript/module-${i}.ts`, content);
      } else if (i % 4 === 1) {
        const content = this.generateJavaScriptFile(nodesInFile, i);
        await repo.createFile(`src/javascript/module-${i}.js`, content);
      } else if (i % 4 === 2) {
        const content = this.generateComplexTypeScriptFile(nodesInFile, i);
        await repo.createFile(`src/complex/complex-${i}.ts`, content);
      } else {
        const content = this.generateUtilityFile(nodesInFile, i);
        await repo.createFile(`src/utils/utils-${i}.ts`, content);
      }
    }

    // Add some configuration files
    await repo.createFile('package.json', JSON.stringify({
      name: 'synthetic-test-repo',
      version: '1.0.0',
      description: `Synthetic repository with ${nodeCount} AST nodes`,
      main: 'index.js',
      scripts: { test: 'echo "test"' },
      devDependencies: { typescript: '^5.0.0' }
    }, null, 2));

    await repo.createFile('tsconfig.json', JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    }, null, 2));

    await repo.createFile('README.md', `# Synthetic Test Repository\n\nGenerated for performance testing with ${nodeCount} significant AST nodes.\n`);

    await repo.commitFiles('Initial synthetic repository with ' + nodeCount + ' nodes');
    return tmpDir;
  }

  private static generateTypeScriptFile(nodeCount: number, fileIndex: number): string {
    let content = `// Generated TypeScript file ${fileIndex} with ${nodeCount} significant nodes\n\n`;
    
    for (let i = 0; i < nodeCount; i++) {
      const functionName = `generatedFunction_${fileIndex}_${i}`;
      content += `export function ${functionName}(param: string): string {\n`;
      content += `  return \`Function ${i} result: \${param}\`;\n`;
      content += `}\n\n`;
    }
    
    return content;
  }

  private static generateJavaScriptFile(nodeCount: number, fileIndex: number): string {
    let content = `// Generated JavaScript file ${fileIndex} with ${nodeCount} significant nodes\n\n`;
    
    for (let i = 0; i < nodeCount; i++) {
      const functionName = `jsFunction_${fileIndex}_${i}`;
      content += `function ${functionName}(param) {\n`;
      content += `  return 'JS Function ${i} result: ' + param;\n`;
      content += `}\n\n`;
    }
    
    content += `module.exports = {\n`;
    for (let i = 0; i < nodeCount; i++) {
      content += `  jsFunction_${fileIndex}_${i},\n`;
    }
    content += `};\n`;
    
    return content;
  }

  private static generateComplexTypeScriptFile(nodeCount: number, fileIndex: number): string {
    let content = `// Complex TypeScript file ${fileIndex} with ${nodeCount} significant nodes\n\n`;
    
    const classesNeeded = Math.ceil(nodeCount / 20); // ~20 nodes per class
    
    for (let classIdx = 0; classIdx < classesNeeded; classIdx++) {
      const className = `ComplexClass_${fileIndex}_${classIdx}`;
      const methodsInClass = Math.min(20, nodeCount - (classIdx * 20));
      
      content += `export class ${className} {\n`;
      content += `  private data: Map<string, any> = new Map();\n\n`;
      
      for (let methodIdx = 0; methodIdx < methodsInClass; methodIdx++) {
        const methodName = `method_${methodIdx}`;
        content += `  public ${methodName}(param: string): any {\n`;
        content += `    return { method: '${methodName}', param, timestamp: Date.now() };\n`;
        content += `  }\n\n`;
      }
      
      content += `}\n\n`;
    }
    
    return content;
  }

  private static generateUtilityFile(nodeCount: number, fileIndex: number): string {
    let content = `// Utility file ${fileIndex} with ${nodeCount} significant nodes\n\n`;
    
    // Generate utility functions
    for (let i = 0; i < nodeCount; i++) {
      const utilName = `utility_${fileIndex}_${i}`;
      content += `export const ${utilName} = (input: any): any => {\n`;
      content += `  return { utility: '${utilName}', input, processed: true };\n`;
      content += `};\n\n`;
    }
    
    return content;
  }
}

export class PerformanceTimer {
  private timers: Map<string, number> = new Map();
  
  static async measure<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  start(label: string): void {
    this.timers.set(label, performance.now());
  }

  lap(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      throw new Error(`Timer '${label}' not found`);
    }
    return performance.now() - startTime;
  }

  end(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      throw new Error(`Timer '${label}' not found`);
    }
    const duration = performance.now() - startTime;
    this.timers.delete(label);
    return duration;
  }

  static assertPerformance(duration: number, threshold: number, operation: string): void {
    if (duration > threshold) {
      throw new Error(
        `Performance assertion failed for ${operation}: ` +
        `${duration}ms > ${threshold}ms threshold`
      );
    }
  }
}