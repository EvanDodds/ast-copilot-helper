import { promises as fs } from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AstHelperCli } from '../../../packages/ast-helper/src/cli';
import { ConfigManager } from '../../../packages/ast-helper/src/config';
import { ErrorFormatter } from '../../../packages/ast-helper/src/errors';
import { LockManager } from '../../../packages/ast-helper/src/locking';
import { createLogger } from '../../../packages/ast-helper/src/logging';

// Mock all dependencies
vi.mock('../../../packages/ast-helper/src/config');
vi.mock('../../../packages/ast-helper/src/logging', () => ({
  createLogger: vi.fn(),
  setupGlobalErrorHandling: vi.fn(),
  parseLogLevel: vi.fn(),
}));
vi.mock('../../../packages/ast-helper/src/errors');
vi.mock('../../../packages/ast-helper/src/locking');
vi.mock('fs/promises');

describe('CLI Commands', () => {
  let cli: AstHelperCli;
  let mockLogger: any;
  let mockConfigManager: any;
  let mockErrorFormatter: any;
  let mockLockManager: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    vi.mocked(createLogger).mockReturnValue(mockLogger);

    // Setup mock config manager
    mockConfigManager = {
      loadConfig: vi.fn().mockResolvedValue({
        workspace: '/test/workspace',
        logLevel: 'info',
        maxConcurrency: 4,
        maxFileSize: 10485760,
        outputFormat: 'console',
        database: {
          type: 'sqlite',
          path: '/test/ast.db',
        },
      }),
    };
    vi.mocked(ConfigManager).mockImplementation(() => mockConfigManager);

    // Setup mock error formatter
    mockErrorFormatter = {
      formatError: vi.fn().mockReturnValue('Formatted error'),
      formatValidationErrors: vi.fn().mockReturnValue('Validation errors'),
    };
    vi.mocked(ErrorFormatter).mockImplementation(() => mockErrorFormatter);

    // Setup mock lock manager
    mockLockManager = {
      createLock: vi.fn().mockResolvedValue({
        release: vi.fn().mockResolvedValue(undefined),
      }),
    };
    vi.mocked(LockManager).mockImplementation(() => mockLockManager);

    cli = new AstHelperCli();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('help system', () => {
    it('should display general help when no command provided', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      process.argv = ['node', 'cli.ts'];
      await cli.run();

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join(' ');
      expect(output).toContain('Usage:');

      consoleSpy.mockRestore();
    });

    it('should display version information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      process.argv = ['node', 'cli.ts', '--version'];
      await cli.run();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should display command-specific help', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      process.argv = ['node', 'cli.ts', 'init', '--help'];
      await cli.run();

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map(call => call[0]).join(' ');
      expect(output).toContain('init');

      consoleSpy.mockRestore();
    });
  });

  describe('command validation', () => {
    it('should validate --top option range for query command', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Not found'));

      process.argv = ['node', 'cli.ts', 'query', '--top', '0', 'test query'];
      await expect(cli.run()).rejects.toThrow();
    });

    it('should accept valid --top option for query command', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      process.argv = ['node', 'cli.ts', 'query', '--top', '10', 'test query'];
      await cli.run();

      expect(mockConfigManager.loadConfig).toHaveBeenCalled();
    });

    it('should validate mutually exclusive options for parse command', async () => {
      process.argv = ['node', 'cli.ts', 'parse', '--changed', '--staged'];
      await expect(cli.run()).rejects.toThrow();
    });

    it('should validate Git repository requirement for --changed option', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Git not found'));

      process.argv = ['node', 'cli.ts', 'parse', '--changed'];
      await expect(cli.run()).rejects.toThrow();
    });

    it('should validate required positional arguments', async () => {
      process.argv = ['node', 'cli.ts', 'annotate'];
      await expect(cli.run()).rejects.toThrow();
    });
  });

  describe('command execution', () => {
    beforeEach(() => {
      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    });

    it('should execute init command successfully', async () => {
      process.argv = ['node', 'cli.ts', 'init', '/test/workspace'];
      await cli.run();

      expect(mockConfigManager.loadConfig).toHaveBeenCalledWith('/test/workspace', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Initializing'));
    });

    it('should execute parse command with files', async () => {
      process.argv = ['node', 'cli.ts', 'parse', 'src/**/*.ts'];
      await cli.run();

      expect(mockConfigManager.loadConfig).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Parsing'));
    });

    it('should execute annotate command with positional argument', async () => {
      process.argv = ['node', 'cli.ts', 'annotate', 'test-id'];
      await cli.run();

      expect(mockConfigManager.loadConfig).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Annotating'));
    });

    it('should execute embed command with files', async () => {
      process.argv = ['node', 'cli.ts', 'embed', 'src/**/*.ts'];
      await cli.run();

      expect(mockConfigManager.loadConfig).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Embedding'));
    });

    it('should execute query command with query string', async () => {
      process.argv = ['node', 'cli.ts', 'query', 'test query'];
      await cli.run();

      expect(mockConfigManager.loadConfig).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Querying'));
    });

    it('should execute watch command with files', async () => {
      process.argv = ['node', 'cli.ts', 'watch', 'src/**/*.ts'];
      await cli.run();

      expect(mockConfigManager.loadConfig).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Watching'));
    });
  });

  describe('global options', () => {
    it('should handle --config option', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      process.argv = ['node', 'cli.ts', '--config', '/custom/config.json', 'init', '/test'];
      await cli.run();

      expect(mockConfigManager.loadConfig).toHaveBeenCalledWith('/test', expect.objectContaining({
        config: '/custom/config.json'
      }));
    });

    it('should handle --workspace option', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      process.argv = ['node', 'cli.ts', '--workspace', '/custom/workspace', 'init'];
      await cli.run();

      expect(mockConfigManager.loadConfig).toHaveBeenCalledWith('/custom/workspace', expect.any(Object));
    });
  });

  describe('error handling', () => {
    it('should handle unknown commands', async () => {
      process.argv = ['node', 'cli.ts', 'unknown-command'];

      await expect(cli.run()).rejects.toThrow();
    });

    it('should handle invalid options', async () => {
      process.argv = ['node', 'cli.ts', 'init', '--invalid-option'];

      await expect(cli.run()).rejects.toThrow();
    });
  });
});