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
    const filesNeeded = Math.ceil(nodeCount / 100); // ~100 nodes per file
    
    for (let i = 0; i < filesNeeded; i++) {
      const nodesInFile = Math.min(100, nodeCount - (i * 100));
      const content = this.generateTypeScriptFile(nodesInFile, i);
      await repo.createFile(`src/generated-${i}.ts`, content);
    }

    await repo.commitFiles('Initial synthetic repository');
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
}

export class PerformanceTimer {
  static async measure<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
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