/**
 * Tests for DatabaseConfigurationManager
 * Tests configuration file c      expect(config.modelHost).toMatch(/^https?:\/\//);eation, validation, and management
 */

import { randomBytes } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseConfigurationManager } from './config.js';
import type { InitOptions } from './types.js';

describe('DatabaseConfigurationManager', () => {
    let tempDir: string;
    let manager: DatabaseConfigurationManager;

    beforeEach(async () => {
        // Create temporary directory
        const tempName = `ast-config-test-${randomBytes(6).toString('hex')}`;
        tempDir = join(tmpdir(), tempName);
        await mkdir(tempDir, { recursive: true });

        // Initialize manager
        manager = new DatabaseConfigurationManager();
    });

    afterEach(async () => {
        // Clean up temporary directory
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    describe('default configuration creation', () => {
        it('should create valid default configuration', () => {
            const config = manager.createDefaultConfig();

            // Check all required fields exist
            expect(config.parseGlob).toBeDefined();
            expect(Array.isArray(config.parseGlob)).toBe(true);
            expect(config.parseGlob.length).toBeGreaterThan(0);

            expect(config.excludeGlob).toBeDefined();
            expect(Array.isArray(config.excludeGlob)).toBe(true);

            expect(config.watchGlob).toBeDefined();
            expect(Array.isArray(config.watchGlob)).toBe(true);

            expect(typeof config.watchDebounce).toBe('number');
            expect(config.watchDebounce).toBeGreaterThan(0);

            expect(typeof config.topK).toBe('number');
            expect(config.topK).toBeGreaterThan(0);

            expect(typeof config.snippetLines).toBe('number');
            expect(config.snippetLines).toBeGreaterThan(0);

            // Check indexParams
            expect(config.indexParams).toBeDefined();
            expect(typeof config.indexParams.efConstruction).toBe('number');
            expect(config.indexParams.efConstruction).toBeGreaterThanOrEqual(16);
            expect(config.indexParams.efConstruction).toBeLessThanOrEqual(800);

            expect(typeof config.indexParams.M).toBe('number');
            expect(config.indexParams.M).toBeGreaterThanOrEqual(4);
            expect(config.indexParams.M).toBeLessThanOrEqual(64);

            expect(typeof config.indexParams.ef).toBe('number');
            expect(config.indexParams.ef).toBeGreaterThanOrEqual(16);
            expect(config.indexParams.ef).toBeLessThanOrEqual(512);

            // Check model configuration
            expect(typeof config.modelName).toBe('string');
            expect(config.modelName.length).toBeGreaterThan(0);

            expect(typeof config.modelHost).toBe('string');
            expect(config.modelHost).toMatch(/^https?:\/\//);

            expect(typeof config.batchSize).toBe('number');
            expect(config.batchSize).toBeGreaterThan(0);

            // Check performance configuration
            expect(typeof config.concurrency).toBe('number');
            expect(config.concurrency).toBeGreaterThan(0);

            expect(typeof config.maxMemory).toBe('number');
            expect(config.maxMemory).toBeGreaterThan(0);

            // Check feature flags
            expect(typeof config.enableTelemetry).toBe('boolean');
            expect(typeof config.enableNative).toBe('boolean');

            // Check metadata
            expect(typeof config.version).toBe('string');
            expect(config.version).toMatch(/^\d+\.\d+\.\d+/);

            expect(typeof config.created).toBe('string');
            expect(new Date(config.created).getTime()).not.toBeNaN();

            expect(typeof config.lastUpdated).toBe('string');
            expect(new Date(config.lastUpdated).getTime()).not.toBeNaN();
        });

        it('should set reasonable defaults', () => {
            const config = manager.createDefaultConfig();

            // Check specific default values
            expect(config.parseGlob).toContain('**/*.ts');
            expect(config.parseGlob).toContain('**/*.js');
            expect(config.parseGlob).toContain('**/*.py');

            expect(config.excludeGlob).toContain('node_modules/**');
            expect(config.excludeGlob).toContain('.git/**');

            expect(config.modelName).toBe('codebert-base');
            expect(config.modelHost).toBe('https://huggingface.co');

            expect(config.enableTelemetry).toBe(false);
            expect(config.enableNative).toBe(true);
        });
    });

    describe('configuration file creation', () => {
        it('should create configuration file successfully', async () => {
            await manager.createConfigurationFile(tempDir);

            // Check if file was created
            const configPath = join(tempDir, 'config.json');
            const fs = (manager as any).fs;
            expect(await fs.exists(configPath)).toBe(true);

            // Check if file can be loaded
            const config = await manager.loadConfig(tempDir);
            expect(config).toBeDefined();
            expect(config.parseGlob).toBeDefined();
        });

        it('should handle verbose mode', async () => {
            let output = '';
            const originalLog = console.log;
            console.log = (message: string) => {
                output += message + '\n';
            };

            try {
                const options: InitOptions = { verbose: true };
                await manager.createConfigurationFile(tempDir, options);

                expect(output).toContain('Creating configuration file');
                expect(output).toContain('✅ Configuration file created successfully');
            } finally {
                console.log = originalLog;
            }
        });

        it('should handle dry run mode', async () => {
            const options: InitOptions = { dryRun: true };
            await manager.createConfigurationFile(tempDir, options);

            // File should not be created in dry run
            const configPath = join(tempDir, 'config.json');
            const fs = (manager as any).fs;
            expect(await fs.exists(configPath)).toBe(false);
        });

        it('should prevent overwriting without force flag', async () => {
            // Create initial config
            await manager.createConfigurationFile(tempDir);

            // Try to create again without force
            await expect(manager.createConfigurationFile(tempDir))
                .rejects
                .toThrow('Configuration file not accessible:');
        });

        it('should merge existing configuration with force flag', async () => {
            // Create initial config
            await manager.createConfigurationFile(tempDir);

            // Load and modify config
            const originalConfig = await manager.loadConfig(tempDir);
            originalConfig.topK = 99; // Test with valid value within range (1-100)
            await manager.saveConfig(tempDir, originalConfig);

            // Create again with force (should merge)
            const options: InitOptions = { force: true };
            await manager.createConfigurationFile(tempDir, options);

            // Check that custom value was preserved
            const mergedConfig = await manager.loadConfig(tempDir);
            expect(mergedConfig.topK).toBe(99);

            // Check that lastUpdated was updated
            expect(mergedConfig.lastUpdated).not.toBe(originalConfig.lastUpdated);
        });
    });

    describe('configuration validation', () => {
        it('should validate correct configuration', async () => {
            const config = manager.createDefaultConfig();

            // Should not throw
            await expect(manager.validateConfig(config)).resolves.not.toThrow();
        });

        it('should reject invalid string fields', async () => {
            const config = manager.createDefaultConfig();
            config.modelName = ''; // Empty string

            await expect(manager.validateConfig(config))
                .rejects
                .toThrow("Field 'modelName' must be a non-empty string");
        });

        it('should reject invalid array fields', async () => {
            const config = manager.createDefaultConfig();
            (config as any).parseGlob = 'not an array';

            await expect(manager.validateConfig(config))
                .rejects
                .toThrow("Field 'parseGlob' must be an array");
        });

        it('should reject invalid number ranges', async () => {
            const config = manager.createDefaultConfig();
            config.topK = 999; // Too high

            await expect(manager.validateConfig(config))
                .rejects
                .toThrow('topK must be between 1 and 100');
        });

        it('should reject invalid indexParams', async () => {
            const config = manager.createDefaultConfig();
            config.indexParams.efConstruction = 5000; // Too high

            await expect(manager.validateConfig(config))
                .rejects
                .toThrow('indexParams.efConstruction must be a number between 16 and 800');
        });

        it('should reject invalid URLs', async () => {
            const config = manager.createDefaultConfig();
            config.modelHost = 'not-a-url';

            await expect(manager.validateConfig(config))
                .rejects
                .toThrow('modelHost must be a valid URL');
        });

        it('should reject invalid timestamps', async () => {
            const config = manager.createDefaultConfig();
            config.created = 'not-a-date';

            await expect(manager.validateConfig(config))
                .rejects
                .toThrow('created must be a valid ISO timestamp');
        });

        it('should reject invalid version format', async () => {
            const config = manager.createDefaultConfig();
            config.version = 'not-semver';

            await expect(manager.validateConfig(config))
                .rejects
                .toThrow("version must be in semver format");
        });
    });

    describe('configuration persistence', () => {
        it('should save and load configuration correctly', async () => {
            const originalConfig = manager.createDefaultConfig();
            originalConfig.topK = 42;
            originalConfig.modelName = 'custom-model';

            await manager.saveConfig(tempDir, originalConfig);
            const loadedConfig = await manager.loadConfig(tempDir);

            expect(loadedConfig.topK).toBe(42);
            expect(loadedConfig.modelName).toBe('custom-model');
        });

        it('should update lastUpdated timestamp on save', async () => {
            const config = manager.createDefaultConfig();
            const originalTimestamp = config.lastUpdated;

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));

            await manager.saveConfig(tempDir, config);
            const loadedConfig = await manager.loadConfig(tempDir);

            expect(loadedConfig.lastUpdated).not.toBe(originalTimestamp);
        });

        it('should handle missing configuration file', async () => {
            // Ensure temp directory exists but config file doesn't
            const configPath = join(tempDir, 'config.json');
            await expect(manager.loadConfig(tempDir))
                .rejects
                .toThrow('Configuration file not accessible');
        });

        it('should handle invalid JSON', async () => {
            // Create invalid JSON file
            const configPath = join(tempDir, 'config.json');
            const fs = (manager as any).fs;
            await fs.atomicWriteFile(configPath, '{ invalid json }');

            await expect(manager.loadConfig(tempDir))
                .rejects
                .toThrow('Invalid JSON');
        });
    });
});