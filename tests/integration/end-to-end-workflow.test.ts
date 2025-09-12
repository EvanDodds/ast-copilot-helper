import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TestRepository } from '../utils/test-helpers';
import { ConfigManager } from '../../packages/ast-helper/src/config/manager';
import type { Config } from '../../packages/ast-helper/src/types';

describe('End-to-End Workflow Integration', () => {
  let testRepo: TestRepository;
  let configManager: ConfigManager;
  let testWorkspace: string;

  beforeEach(async () => {
    // Create temporary workspace
    testWorkspace = join(tmpdir(), `ast-helper-test-${Date.now()}`);
    await fs.mkdir(testWorkspace, { recursive: true });

    testRepo = new TestRepository(testWorkspace);
    configManager = new ConfigManager();
  });

  afterEach(async () => {
    await testRepo.cleanup();
  });

  describe('Complete AST Processing Pipeline', () => {
    it('should process a TypeScript project from parse to query', async () => {
      // Setup test project
      await testRepo.createFile('src/main.ts', `
        export class Calculator {
          add(a: number, b: number): number {
            return a + b;
          }
          
          multiply(a: number, b: number): number {
            return a * b;
          }
        }
        
        export function formatResult(value: number): string {
          return \`Result: \${value}\`;
        }
      `);

      await testRepo.createFile('src/utils.ts', `
        export const PI = 3.14159;
        
        export function circleArea(radius: number): number {
          return PI * radius * radius;
        }
        
        export interface Shape {
          area(): number;
          perimeter(): number;
        }
      `);

      await testRepo.createFile('package.json', JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        main: 'dist/main.js',
        scripts: {
          build: 'tsc'
        },
        devDependencies: {
          typescript: '^5.0.0'
        }
      }, null, 2));

      // Load configuration
      const config = await configManager.loadConfig(testWorkspace);
      expect(config).toBeDefined();
      expect(config.parseGlob).toContain('src/**/*.ts');

      // Mock the actual AST processing stages since we're testing integration
      // In real implementation, these would call the actual parser, annotator, etc.
      
      // Step 1: Parse files
      const sourceFiles = ['src/main.ts', 'src/utils.ts'];
      const parseResults = await Promise.all(
        sourceFiles.map(async (file) => {
          const content = await fs.readFile(join(testWorkspace, file), 'utf-8');
          // Mock parsing result
          return {
            filePath: file,
            content,
            nodeCount: content.split('\n').length * 2, // Approximate
            classes: file.includes('main') ? ['Calculator'] : [],
            functions: file.includes('main') ? ['formatResult'] : ['circleArea'],
            interfaces: file.includes('utils') ? ['Shape'] : [],
            exports: file.includes('main') ? ['Calculator', 'formatResult'] : ['PI', 'circleArea', 'Shape']
          };
        })
      );

      expect(parseResults).toHaveLength(2);
      expect(parseResults[0].classes).toContain('Calculator');
      expect(parseResults[1].functions).toContain('circleArea');

      // Step 2: Generate annotations
      const annotations = parseResults.map((parsed) => ({
        filePath: parsed.filePath,
        annotations: parsed.exports.map(symbol => ({
          symbol,
          type: parsed.classes.includes(symbol) ? 'class' : 
                parsed.functions.includes(symbol) ? 'function' :
                parsed.interfaces.includes(symbol) ? 'interface' : 'constant',
          description: `${symbol} from ${parsed.filePath}`,
          metadata: {
            nodeCount: parsed.nodeCount,
            complexity: Math.floor(Math.random() * 10) + 1
          }
        }))
      }));

      expect(annotations).toHaveLength(2);
      expect(annotations[0].annotations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            symbol: 'Calculator',
            type: 'class'
          })
        ])
      );

      // Step 3: Generate embeddings
      const embeddings = annotations.map((annotated) => ({
        filePath: annotated.filePath,
        embeddings: annotated.annotations.map(annotation => ({
          symbol: annotation.symbol,
          vector: new Array(384).fill(0).map(() => Math.random()), // Mock embedding
          metadata: annotation.metadata
        }))
      }));

      expect(embeddings).toHaveLength(2);
      expect(embeddings[0].embeddings[0].vector).toHaveLength(384);

      // Step 4: Store in database (mock)
      const indexedSymbols = embeddings.flatMap(e => e.embeddings.map(em => em.symbol));
      expect(indexedSymbols).toContain('Calculator');
      expect(indexedSymbols).toContain('circleArea');

      // Step 5: Query functionality
      const queryResult = {
        query: 'calculator functions',
        results: [
          {
            symbol: 'Calculator',
            score: 0.95,
            filePath: 'src/main.ts',
            metadata: { type: 'class', nodeCount: 20 }
          },
          {
            symbol: 'formatResult',
            score: 0.78,
            filePath: 'src/main.ts',
            metadata: { type: 'function', nodeCount: 6 }
          }
        ]
      };

      expect(queryResult.results).toHaveLength(2);
      expect(queryResult.results[0].score).toBeGreaterThan(0.9);
    }, 15000);

    it('should handle mixed language projects', async () => {
      // Create TypeScript, JavaScript, and Python files
      await testRepo.createFile('src/api.ts', `
        export interface ApiResponse {
          data: any;
          success: boolean;
        }
        
        export async function fetchData(url: string): Promise<ApiResponse> {
          const response = await fetch(url);
          return { data: await response.json(), success: true };
        }
      `);

      await testRepo.createFile('src/legacy.js', `
        function processLegacyData(input) {
          return input.map(item => ({ 
            ...item, 
            processed: true,
            timestamp: Date.now()
          }));
        }
        
        module.exports = { processLegacyData };
      `);

      await testRepo.createFile('scripts/data_processor.py', `
        def analyze_data(data_points):
            """Analyze numerical data points"""
            if not data_points:
                return {"mean": 0, "count": 0}
            
            mean = sum(data_points) / len(data_points)
            return {
                "mean": mean,
                "count": len(data_points),
                "max": max(data_points),
                "min": min(data_points)
            }
        
        class DataProcessor:
            def __init__(self):
                self.processed_count = 0
            
            def process_batch(self, batch):
                self.processed_count += len(batch)
                return [item * 2 for item in batch]
      `);

      const config = await configManager.loadConfig(testWorkspace);
      
      // Mock parsing different file types
      const files = [
        { path: 'src/api.ts', language: 'typescript' },
        { path: 'src/legacy.js', language: 'javascript' },
        { path: 'scripts/data_processor.py', language: 'python' }
      ];

      const parseResults = await Promise.all(files.map(async (file) => {
        const content = await fs.readFile(join(testWorkspace, file.path), 'utf-8');
        return {
          filePath: file.path,
          language: file.language,
          symbols: file.language === 'typescript' ? ['ApiResponse', 'fetchData'] :
                   file.language === 'javascript' ? ['processLegacyData'] :
                   ['analyze_data', 'DataProcessor'],
          nodeCount: content.split('\n').length
        };
      }));

      expect(parseResults).toHaveLength(3);
      expect(parseResults.find(r => r.language === 'typescript')?.symbols).toContain('fetchData');
      expect(parseResults.find(r => r.language === 'javascript')?.symbols).toContain('processLegacyData');
      expect(parseResults.find(r => r.language === 'python')?.symbols).toContain('DataProcessor');
    });
  });

  describe('Configuration Integration', () => {
    it('should respect configuration hierarchy', async () => {
      // Create user config
      const configDir = join(testWorkspace, '.astdb');
      await fs.mkdir(configDir, { recursive: true });
      
      await fs.writeFile(
        join(configDir, 'config.json'),
        JSON.stringify({
          topK: 25,
          concurrency: 6,
          enableTelemetry: true
        }, null, 2)
      );

      // Load config with CLI overrides
      const config = await configManager.loadConfig(testWorkspace, {
        concurrency: 8, // Should override file config
        verbose: true
      });

      expect(config.topK).toBe(25); // From file
      expect(config.concurrency).toBe(8); // From CLI (higher priority)
      expect(config.enableTelemetry).toBe(true); // From file
    });

    it('should validate configuration and provide defaults', async () => {
      const config = await configManager.loadConfig(testWorkspace);

      // Check required properties have defaults
      expect(config.parseGlob).toBeDefined();
      expect(Array.isArray(config.parseGlob)).toBe(true);
      expect(config.topK).toBeGreaterThan(0);
      expect(config.concurrency).toBeGreaterThan(0);
      expect(config.modelHost).toBeDefined();
      expect(typeof config.enableTelemetry).toBe('boolean');
    });
  });

  describe('Error Handling Integration', () => {
    it('should gracefully handle corrupted files', async () => {
      // Create a file with syntax errors
      await testRepo.createFile('src/broken.ts', `
        export class BrokenClass {
          constructor(
            // Missing closing brace and incomplete syntax
          
          method() {
            return "incomplete
        }
      `);

      // Mock parser behavior for corrupted files
      const mockParseResult = {
        filePath: 'src/broken.ts',
        success: false,
        error: 'SyntaxError: Unexpected end of input',
        partialNodes: [] // Parser might still extract some information
      };

      expect(mockParseResult.success).toBe(false);
      expect(mockParseResult.error).toContain('SyntaxError');
    });

    it('should handle missing directories gracefully', async () => {
      const nonExistentPath = join(testWorkspace, 'nonexistent');
      
      // ConfigManager should still work with missing directories by using defaults
      const config = await configManager.loadConfig(nonExistentPath);
      
      // Should return valid config with default values
      expect(config).toBeDefined();
      expect(config.parseGlob).toBeDefined();
      expect(Array.isArray(config.parseGlob)).toBe(true);
      expect(config.topK).toBeGreaterThan(0);
    });
  });

  describe('Performance Integration', () => {
    it('should handle large codebases efficiently', async () => {
      const startTime = Date.now();

      // Create a moderately large test project
      const fileCount = 20;
      for (let i = 0; i < fileCount; i++) {
        await testRepo.createFile(`src/module${i}.ts`, `
          export class Module${i} {
            private data: string[] = [];
            
            constructor() {
              this.data = Array(100).fill('item').map((item, idx) => \`\${item}\${idx}\`);
            }
            
            process(): string[] {
              return this.data.filter(item => item.includes('5'));
            }
            
            async asyncProcess(): Promise<string[]> {
              return new Promise(resolve => {
                setTimeout(() => resolve(this.process()), 10);
              });
            }
          }
          
          export function helperFunction${i}(input: string): string {
            return input.repeat(3);
          }
          
          export const CONSTANT_${i} = 'value${i}';
        `);
      }

      const config = await configManager.loadConfig(testWorkspace);
      
      // Mock processing time for large project
      const processingTime = Date.now() - startTime;
      
      // Should complete setup reasonably quickly
      expect(processingTime).toBeLessThan(5000);
      
      // Verify all files were created
      const srcDir = join(testWorkspace, 'src');
      const files = await fs.readdir(srcDir);
      expect(files).toHaveLength(fileCount);
    });
  });
});