import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AstHelperCli } from './cli';
import * as process from 'process';
import * as fs from 'fs';

// Mock the modules that CLI depends on
vi.mock('./config', () => ({
  ConfigManager: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue({
      workspace: { root: '/test/workspace' },
      ast: { parser: 'typescript' },
      ignore: { patterns: ['node_modules'] }
    })
  }))
}));

vi.mock('./logging', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }))
}));

vi.mock('./locking', () => ({
  LockManager: vi.fn().mockImplementation(() => ({
    acquire: vi.fn().mockResolvedValue(true),
    release: vi.fn()
  }))
}));

vi.mock('fs');

describe('AstHelperCli', () => {
  let cli: AstHelperCli;
  let mockExit: any;
  let mockConsoleLog: any;
  let mockConsoleError: any;

  beforeEach(() => {
    cli = new AstHelperCli();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null | undefined) => {
      throw new Error('process.exit called');
    }) as any);
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock fs.existsSync to simulate Git repository
    vi.mocked(fs.existsSync).mockReturnValue(true);
  });

  describe('help system', () => {
    it('should display general help when no command provided', async () => {
      try {
        await cli.run(['--help']);
      } catch (e) {
        // Expected to throw due to process.exit mock
      }

      expect(mockExit).toHaveBeenCalledWith(0);
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should display version information', async () => {
      try {
        await cli.run(['--version']);
      } catch (e) {
        // Expected to throw due to process.exit mock
      }

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it('should display command-specific help', async () => {
      try {
        await cli.run(['init', '--help']);
      } catch (e) {
        // Expected to throw due to process.exit mock
      }

      expect(mockExit).toHaveBeenCalledWith(0);
    });
  });

  describe('command validation', () => {
    it('should validate --top option range for query command', async () => {
      try {
        await cli.run(['query', '--top', '200']);
      } catch (e) {
        // Expected to throw due to process.exit mock
      }

      expect(mockExit).toHaveBeenCalledWith(2);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('--top must be between 1 and 100')
      );
    });

    it('should accept valid --top option for query command', async () => {
      await cli.run(['query', '--top', '50']);
      
      // Should not exit with error
      expect(mockExit).not.toHaveBeenCalledWith(2);
    });

    it('should validate mutually exclusive options for parse command', async () => {
      try {
        await cli.run(['parse', '--changed', '--glob', '*.ts']);
      } catch (e) {
        // Expected to throw due to process.exit mock
      }

      expect(mockExit).toHaveBeenCalledWith(2);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Cannot use --changed with other file selection options')
      );
    });

    it('should validate Git repository requirement for --changed option', async () => {
      // Mock fs.existsSync to return false for .git directory
      vi.mocked(fs.existsSync).mockReturnValue(false);

      try {
        await cli.run(['parse', '--changed']);
      } catch (e) {
        // Expected to throw due to process.exit mock
      }

      expect(mockExit).toHaveBeenCalledWith(2);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('--changed requires a Git repository')
      );
    });

    it('should validate required positional arguments', async () => {
      try {
        await cli.run(['annotate']);
      } catch (e) {
        // Expected to throw due to process.exit mock
      }

      expect(mockExit).toHaveBeenCalledWith(2);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Missing required argument')
      );
    });
  });

  describe('command execution', () => {
    it('should execute init command successfully', async () => {
      await cli.run(['init']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Initializing AST helper in workspace...');
    });

    it('should execute parse command with files', async () => {
      await cli.run(['parse', 'src/**/*.ts']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Parsing files: src/**/*.ts');
    });

    it('should execute annotate command with positional argument', async () => {
      await cli.run(['annotate', 'src/test.ts']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Annotating file: src/test.ts');
    });

    it('should execute embed command with files', async () => {
      await cli.run(['embed', 'src/**/*.ts']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Embedding files: src/**/*.ts');
    });

    it('should execute query command with query string', async () => {
      await cli.run(['query', 'find functions']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Querying: find functions');
    });

    it('should execute watch command with files', async () => {
      await cli.run(['watch', 'src/**/*.ts']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Watching files: src/**/*.ts');
    });
  });

  describe('global options', () => {
    it('should handle --config option', async () => {
      await cli.run(['init', '--config', 'custom-config.json']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Using config: custom-config.json');
    });

    it('should handle --workspace option', async () => {
      await cli.run(['init', '--workspace', '/custom/workspace']);
      
      expect(mockConsoleLog).toHaveBeenCalledWith('Using workspace: /custom/workspace');
    });
  });

  describe('error handling', () => {
    it('should handle unknown commands', async () => {
      try {
        await cli.run(['unknown-command']);
      } catch (e) {
        // Expected to throw due to process.exit mock
      }

      expect(mockExit).toHaveBeenCalledWith(2);
    });

    it('should handle invalid options', async () => {
      try {
        await cli.run(['init', '--invalid-option']);
      } catch (e) {
        // Expected to throw due to process.exit mock
      }

      expect(mockExit).toHaveBeenCalledWith(2);
    });
  });
});