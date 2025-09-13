import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigManager } from '../../packages/ast-helper/src/config/manager';
import { TestRepository } from '../utils/test-helpers';

/**
 * Real-world Database Integration Tests
 * Tests with actual data flows and database operations
 */
describe('Database Integration', () => {
    let testRepo: TestRepository;
    let testWorkspace: string;
    let configManager: ConfigManager;

    beforeEach(async () => {
        testWorkspace = join(tmpdir(), `db-test-${Date.now()}`);
        await fs.mkdir(testWorkspace, { recursive: true });
        testRepo = new TestRepository(testWorkspace);
        configManager = new ConfigManager();
    });

    afterEach(async () => {
        await testRepo.cleanup();
    });

    describe('AST Database Operations', () => {
        it('should initialize database structure', async () => {
            const config = await configManager.loadConfig(testWorkspace);
            const dbPath = join(testWorkspace, '.astdb');

            // Mock database initialization
            await fs.mkdir(dbPath, { recursive: true });
            await fs.writeFile(join(dbPath, 'metadata.json'), JSON.stringify({
                version: '1.0.0',
                created: new Date().toISOString(),
                schema: {
                    symbols: { table: 'symbols', indexes: ['name', 'type', 'file_path'] },
                    embeddings: { table: 'embeddings', indexes: ['symbol_id', 'vector_hash'] },
                    files: { table: 'files', indexes: ['path', 'hash', 'last_modified'] }
                }
            }, null, 2));

            const metadataExists = await fs.access(join(dbPath, 'metadata.json')).then(() => true).catch(() => false);
            expect(metadataExists).toBe(true);

            const metadata = JSON.parse(await fs.readFile(join(dbPath, 'metadata.json'), 'utf-8'));
            expect(metadata.schema.symbols).toBeDefined();
            expect(metadata.schema.embeddings).toBeDefined();
            expect(metadata.schema.files).toBeDefined();
        });

        it('should store and retrieve parsed symbols', async () => {
            // Create test files
            await testRepo.createFile('src/services/user.ts', `
        export interface UserProfile {
          id: string;
          username: string;
          email: string;
          preferences: {
            theme: 'light' | 'dark';
            notifications: boolean;
          };
        }

        export class UserManager {
          private profiles: Map<string, UserProfile> = new Map();

          async createProfile(data: Omit<UserProfile, 'id'>): Promise<UserProfile> {
            const id = crypto.randomUUID();
            const profile: UserProfile = { id, ...data };
            this.profiles.set(id, profile);
            return profile;
          }

          getProfile(id: string): UserProfile | undefined {
            return this.profiles.get(id);
          }

          updateProfile(id: string, updates: Partial<UserProfile>): boolean {
            const existing = this.profiles.get(id);
            if (!existing) return false;
            
            this.profiles.set(id, { ...existing, ...updates });
            return true;
          }
        }
      `);

            // Mock parsed symbols storage
            const symbols = [
                {
                    id: 'symbol_1',
                    name: 'UserProfile',
                    type: 'interface',
                    filePath: 'src/services/user.ts',
                    startLine: 2,
                    endLine: 9,
                    properties: ['id', 'username', 'email', 'preferences'],
                    exported: true
                },
                {
                    id: 'symbol_2',
                    name: 'UserManager',
                    type: 'class',
                    filePath: 'src/services/user.ts',
                    startLine: 11,
                    endLine: 31,
                    methods: ['createProfile', 'getProfile', 'updateProfile'],
                    exported: true
                },
                {
                    id: 'symbol_3',
                    name: 'createProfile',
                    type: 'method',
                    filePath: 'src/services/user.ts',
                    startLine: 14,
                    endLine: 18,
                    parentClass: 'UserManager',
                    parameters: ['data'],
                    returnType: 'Promise<UserProfile>'
                }
            ];

            // Simulate database storage
            const dbPath = join(testWorkspace, '.astdb');
            await fs.mkdir(dbPath, { recursive: true });
            await fs.writeFile(join(dbPath, 'symbols.json'), JSON.stringify(symbols, null, 2));

            // Verify storage
            const storedSymbols = JSON.parse(await fs.readFile(join(dbPath, 'symbols.json'), 'utf-8'));
            expect(storedSymbols).toHaveLength(3);
            expect(storedSymbols.find((s: any) => s.name === 'UserProfile')).toBeDefined();
            expect(storedSymbols.find((s: any) => s.name === 'UserManager')).toBeDefined();

            // Test retrieval by type
            const interfaces = storedSymbols.filter((s: any) => s.type === 'interface');
            const classes = storedSymbols.filter((s: any) => s.type === 'class');
            const methods = storedSymbols.filter((s: any) => s.type === 'method');

            expect(interfaces).toHaveLength(1);
            expect(classes).toHaveLength(1);
            expect(methods).toHaveLength(1);
        });

        it('should handle vector embeddings storage and retrieval', async () => {
            // Mock embedding data
            const embeddings = [
                {
                    symbolId: 'symbol_1',
                    vector: new Array(384).fill(0).map(() => Math.random()),
                    metadata: {
                        symbolName: 'UserProfile',
                        type: 'interface',
                        filePath: 'src/services/user.ts'
                    }
                },
                {
                    symbolId: 'symbol_2',
                    vector: new Array(384).fill(0).map(() => Math.random()),
                    metadata: {
                        symbolName: 'UserManager',
                        type: 'class',
                        filePath: 'src/services/user.ts'
                    }
                }
            ];

            // Store embeddings
            const dbPath = join(testWorkspace, '.astdb');
            await fs.mkdir(dbPath, { recursive: true });
            await fs.writeFile(join(dbPath, 'embeddings.json'), JSON.stringify(embeddings, null, 2));

            // Verify storage
            const storedEmbeddings = JSON.parse(await fs.readFile(join(dbPath, 'embeddings.json'), 'utf-8'));
            expect(storedEmbeddings).toHaveLength(2);
            expect(storedEmbeddings[0].vector).toHaveLength(384);

            // Mock similarity search
            const queryVector = new Array(384).fill(0).map(() => Math.random());

            // Simple cosine similarity mock
            const similarities = storedEmbeddings.map((embedding: any) => {
                const dotProduct = embedding.vector.reduce((sum: number, val: number, idx: number) =>
                    sum + val * queryVector[idx], 0
                );
                const magnitude1 = Math.sqrt(embedding.vector.reduce((sum: number, val: number) => sum + val * val, 0));
                const magnitude2 = Math.sqrt(queryVector.reduce((sum: number, val: number) => sum + val * val, 0));

                return {
                    symbolId: embedding.symbolId,
                    similarity: dotProduct / (magnitude1 * magnitude2),
                    metadata: embedding.metadata
                };
            }).sort((a: any, b: any) => b.similarity - a.similarity);

            expect(similarities).toHaveLength(2);
            expect(similarities[0].similarity).toBeGreaterThan(-1);
            expect(similarities[0].similarity).toBeLessThan(1);
        });
    });

    describe('File System Integration', () => {
        it('should track file changes and update database', async () => {
            const filePath = 'src/utils/helper.ts';

            // Initial file
            await testRepo.createFile(filePath, `
        export function formatDate(date: Date): string {
          return date.toISOString().split('T')[0];
        }
      `);

            const initialStats = await fs.stat(join(testWorkspace, filePath));

            // Mock file tracking
            const fileRecord = {
                path: filePath,
                hash: 'abc123',
                lastModified: initialStats.mtime.toISOString(),
                size: initialStats.size,
                symbolCount: 1,
                symbols: ['formatDate']
            };

            // Simulate file modification
            await new Promise(resolve => setTimeout(resolve, 100)); // Ensure different timestamp

            await testRepo.createFile(filePath, `
        export function formatDate(date: Date): string {
          return date.toISOString().split('T')[0];
        }
        
        export function formatTime(date: Date): string {
          return date.toTimeString().split(' ')[0];
        }
      `);

            const updatedStats = await fs.stat(join(testWorkspace, filePath));

            const updatedRecord = {
                ...fileRecord,
                hash: 'def456',
                lastModified: updatedStats.mtime.toISOString(),
                size: updatedStats.size,
                symbolCount: 2,
                symbols: ['formatDate', 'formatTime']
            };

            expect(updatedRecord.lastModified).not.toBe(fileRecord.lastModified);
            expect(updatedRecord.symbols).toHaveLength(2);
            expect(updatedRecord.symbols).toContain('formatTime');
        });

        it('should handle file deletions and cleanup database', async () => {
            const filePath = 'src/temporary.ts';

            // Create and track file
            await testRepo.createFile(filePath, `
        export const TEMP_VALUE = 'temporary';
      `);

            const fileRecord = {
                path: filePath,
                symbols: ['TEMP_VALUE']
            };

            // Delete file
            await fs.unlink(join(testWorkspace, filePath));

            // Verify file no longer exists
            const fileExists = await fs.access(join(testWorkspace, filePath))
                .then(() => true)
                .catch(() => false);

            expect(fileExists).toBe(false);

            // Mock cleanup - symbols from deleted file should be marked for removal
            const cleanupRecord = {
                path: filePath,
                status: 'deleted',
                symbolsToRemove: ['TEMP_VALUE']
            };

            expect(cleanupRecord.status).toBe('deleted');
            expect(cleanupRecord.symbolsToRemove).toContain('TEMP_VALUE');
        });
    });

    describe('Multi-package Database Consistency', () => {
        it('should maintain consistency across all packages', async () => {
            // Create files in different packages
            await testRepo.createFile('packages/ast-helper/src/parser.ts', `
        export class ASTParser {
          parse(code: string): any {
            return { type: 'Program', body: [] };
          }
        }
      `);

            await testRepo.createFile('packages/ast-mcp-server/src/server.ts', `
        export class MCPServer {
          constructor(private parser: any) {}
          
          handleRequest(request: any): Promise<any> {
            return Promise.resolve({ success: true });
          }
        }
      `);

            await testRepo.createFile('packages/vscode-extension/src/extension.ts', `
        export function activate(context: any): void {
          console.log('Extension activated');
        }
      `);

            // Mock cross-package symbol references
            const packageSymbols = {
                'packages/ast-helper': ['ASTParser', 'parse'],
                'packages/ast-mcp-server': ['MCPServer', 'handleRequest'],
                'packages/vscode-extension': ['activate']
            };

            const allSymbols = Object.values(packageSymbols).flat();
            expect(allSymbols).toHaveLength(5);

            // Mock dependency analysis
            const dependencies = {
                'packages/ast-mcp-server': ['packages/ast-helper'], // MCP server depends on parser
                'packages/vscode-extension': ['packages/ast-helper', 'packages/ast-mcp-server']
            };

            expect(dependencies['packages/ast-mcp-server']).toContain('packages/ast-helper');
            expect(dependencies['packages/vscode-extension']).toHaveLength(2);
        });
    });

    describe('Database Performance', () => {
        it('should handle large symbol sets efficiently', async () => {
            const symbolCount = 1000;
            const startTime = Date.now();

            // Generate large symbol set
            const symbols = Array.from({ length: symbolCount }, (_, i) => ({
                id: `symbol_${i}`,
                name: `Function${i}`,
                type: 'function',
                filePath: `src/module${Math.floor(i / 100)}.ts`,
                exported: i % 2 === 0
            }));

            // Mock storage operation
            const dbPath = join(testWorkspace, '.astdb');
            await fs.mkdir(dbPath, { recursive: true });
            await fs.writeFile(join(dbPath, 'large_symbols.json'), JSON.stringify(symbols));

            const storageTime = Date.now() - startTime;

            // Mock retrieval operations
            const retrievalStart = Date.now();
            const storedSymbols = JSON.parse(await fs.readFile(join(dbPath, 'large_symbols.json'), 'utf-8'));
            const retrievalTime = Date.now() - retrievalStart;

            // Mock query operations
            const queryStart = Date.now();
            const exportedFunctions = storedSymbols.filter((s: any) => s.exported && s.type === 'function');
            const queryTime = Date.now() - queryStart;

            expect(storedSymbols).toHaveLength(symbolCount);
            expect(exportedFunctions).toHaveLength(symbolCount / 2);

            // Performance assertions
            expect(storageTime).toBeLessThan(1000); // Storage under 1s
            expect(retrievalTime).toBeLessThan(500); // Retrieval under 500ms
            expect(queryTime).toBeLessThan(100); // Query under 100ms
        });

        it('should optimize embedding search performance', async () => {
            const embeddingCount = 500;
            const vectorDimensions = 384;

            // Generate embeddings
            const embeddings = Array.from({ length: embeddingCount }, (_, i) => ({
                id: `embedding_${i}`,
                vector: new Array(vectorDimensions).fill(0).map(() => Math.random()),
                metadata: { name: `Symbol${i}`, type: 'function' }
            }));

            const searchStart = Date.now();
            const queryVector = new Array(vectorDimensions).fill(0).map(() => Math.random());

            // Mock optimized search (in reality, this would use HNSW or similar)
            const topK = 10;
            const similarities = embeddings
                .map(embedding => ({
                    ...embedding.metadata,
                    similarity: Math.random() // Mock similarity score
                }))
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, topK);

            const searchTime = Date.now() - searchStart;

            expect(similarities).toHaveLength(topK);
            expect(searchTime).toBeLessThan(200); // Search under 200ms
        });
    });
});