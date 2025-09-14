import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'events';
import { ServerProcessManager, ServerState, ServerConfig } from '../../managers/ServerProcessManager';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs';

// Mock VS Code API
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{
      uri: { fsPath: '/test/workspace' }
    }]
  }
}));

// Mock child_process
vi.mock('child_process');

// Mock fs
vi.mock('fs');

describe('ServerProcessManager', () => {
  let serverManager: ServerProcessManager;
  let mockOutputChannel: vscode.OutputChannel;
  let mockChildProcess: EventEmitter & { 
    pid: number; 
    exitCode: number | null; 
    killed: boolean;
    kill: Mock;
    stdout: EventEmitter;
    stderr: EventEmitter;
  };

  beforeEach(() => {
    // Setup mock output channel
    mockOutputChannel = {
      appendLine: vi.fn(),
      append: vi.fn(),
      clear: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
      name: 'Test Output',
      replace: vi.fn()
    } as any;

    // Setup mock child process
    mockChildProcess = new EventEmitter() as any;
    mockChildProcess.pid = 12345;
    mockChildProcess.exitCode = null;
    mockChildProcess.killed = false;
    mockChildProcess.kill = vi.fn();
    mockChildProcess.stdout = new EventEmitter();
    mockChildProcess.stderr = new EventEmitter();

    // Setup mocks
    (child_process.spawn as Mock).mockReturnValue(mockChildProcess);
    (fs.existsSync as Mock).mockReturnValue(true);
    (fs.access as unknown as Mock).mockImplementation((path: string, mode: number, callback: (err: Error | null) => void) => {
      callback(null); // No error - file exists and is executable
    });

    // Create server manager with test config
    const config: Partial<ServerConfig> = {
      serverPath: '/test/server',
      workingDirectory: '/test/workspace',
      args: ['--test'],
      autoRestart: false, // Disable for controlled testing
      maxRestarts: 1,
      restartDelay: 100,
      healthCheckInterval: 0, // Disable for testing
      startupTimeout: 1000
    };

    serverManager = new ServerProcessManager(config, mockOutputChannel);
  });

  afterEach(() => {
    serverManager.dispose();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct default state', () => {
      expect(serverManager.getState()).toBe('stopped');
      expect(serverManager.isRunning()).toBe(false);
      
      const info = serverManager.getProcessInfo();
      expect(info.state).toBe('stopped');
      expect(info.pid).toBeUndefined();
      expect(info.restarts).toBe(0);
    });

    it('should normalize configuration correctly', () => {
      const customConfig: Partial<ServerConfig> = {
        serverPath: '/custom/server',
        maxRestarts: 5
      };
      
      const manager = new ServerProcessManager(customConfig, mockOutputChannel);
      const info = manager.getProcessInfo();
      
      expect(info.restarts).toBe(0);
      manager.dispose();
    });

    it('should detect default server path in workspace', () => {
      (fs.existsSync as Mock).mockImplementation((path) => {
        return path.includes('packages/ast-mcp-server/bin/ast-mcp-server');
      });

      const manager = new ServerProcessManager({}, mockOutputChannel);
      manager.dispose();
      
      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('packages/ast-mcp-server/bin/ast-mcp-server')
      );
    });
  });

  describe('server lifecycle', () => {
    it('should start server successfully', async () => {
      const stateChanges: ServerState[] = [];
      serverManager.on('stateChanged', (newState: ServerState) => {
        stateChanges.push(newState);
      });

      const startPromise = serverManager.start();
      
      // Simulate process starting
      setTimeout(() => {
        expect(serverManager.getState()).toBe('starting');
      }, 10);

      await startPromise;

      expect(serverManager.getState()).toBe('running');
      expect(serverManager.isRunning()).toBe(true);
      expect(stateChanges).toEqual(['starting', 'running']);
      
      expect(child_process.spawn).toHaveBeenCalledWith(
        '/test/server',
        ['--test'],
        expect.objectContaining({
          cwd: '/test/workspace',
          stdio: ['pipe', 'pipe', 'pipe']
        })
      );
    });

    it('should handle server start error', async () => {
      (fs.access as unknown as Mock).mockImplementation((path: string, mode: number, callback: (err: Error | null) => void) => {
        callback(new Error('File not found'));
      });

      await expect(serverManager.start()).rejects.toThrow('Server executable not found');
      expect(serverManager.getState()).toBe('error');
    });

    it('should prevent starting when already running', async () => {
      await serverManager.start();
      
      await expect(serverManager.start()).rejects.toThrow('Server is already running');
    });

    it('should stop server gracefully', async () => {
      await serverManager.start();
      
      const stopPromise = serverManager.stop();
      
      // Simulate process exit
      setTimeout(() => {
        mockChildProcess.emit('exit', 0, null);
      }, 10);

      await stopPromise;

      expect(serverManager.getState()).toBe('stopped');
      expect(serverManager.isRunning()).toBe(false);
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should force kill server when requested', async () => {
      await serverManager.start();
      
      const stopPromise = serverManager.stop(true);
      
      // Simulate process exit
      setTimeout(() => {
        mockChildProcess.emit('exit', 0, null);
      }, 10);

      await stopPromise;

      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });

    it('should restart server', async () => {
      await serverManager.start();
      
      const restartPromise = serverManager.restart();
      
      // Simulate stop
      setTimeout(() => {
        mockChildProcess.emit('exit', 0, null);
      }, 10);

      await restartPromise;

      expect(serverManager.getState()).toBe('running');
      expect(child_process.spawn).toHaveBeenCalledTimes(2);
    });
  });

  describe('process monitoring', () => {
    it('should handle unexpected process exit', async () => {
      const crashHandler = vi.fn();
      serverManager.on('crashed', crashHandler);

      await serverManager.start();
      
      // Simulate unexpected crash
      mockChildProcess.emit('exit', 1, null);

      expect(serverManager.getState()).toBe('crashed');
      expect(crashHandler).toHaveBeenCalledWith(1, null, expect.any(Object));
    });

    it('should handle process errors', async () => {
      const errorHandler = vi.fn();
      serverManager.on('error', errorHandler);

      await serverManager.start();
      
      const testError = new Error('Test process error');
      mockChildProcess.emit('error', testError);

      expect(serverManager.getState()).toBe('error');
      expect(errorHandler).toHaveBeenCalledWith(testError, expect.any(Object));
    });

    it('should capture process output', async () => {
      const outputHandler = vi.fn();
      serverManager.on('output', outputHandler);

      await serverManager.start();
      
      // Simulate stdout output
      mockChildProcess.stdout.emit('data', Buffer.from('Test stdout'));
      
      // Simulate stderr output
      mockChildProcess.stderr.emit('data', Buffer.from('Test stderr'));

      expect(outputHandler).toHaveBeenCalledWith('Test stdout', false);
      expect(outputHandler).toHaveBeenCalledWith('Test stderr', true);
      expect(mockOutputChannel.append).toHaveBeenCalledWith('Test stdout');
      expect(mockOutputChannel.append).toHaveBeenCalledWith('[ERROR] Test stderr');
    });

    it('should provide accurate process info', async () => {
      const startTime = Date.now();
      await serverManager.start();
      
      const info = serverManager.getProcessInfo();
      
      expect(info.pid).toBe(12345);
      expect(info.state).toBe('running');
      expect(info.startTime).toBeInstanceOf(Date);
      expect(info.restarts).toBe(0);
      expect(info.uptime).toBeGreaterThan(0);
      expect(info.lastError).toBeUndefined();
    });
  });

  describe('configuration management', () => {
    it('should update configuration', () => {
      const newConfig = {
        maxRestarts: 10,
        restartDelay: 5000
      };

      serverManager.updateConfig(newConfig);
      
      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('Server configuration updated');
    });

    it('should restart on critical config changes', async () => {
      await serverManager.start();
      
      const restartSpy = vi.spyOn(serverManager, 'restart').mockResolvedValue(undefined);
      
      serverManager.updateConfig({
        serverPath: '/new/server/path'
      });

      expect(restartSpy).toHaveBeenCalled();
      
      restartSpy.mockRestore();
    });
  });

  describe('auto-restart functionality', () => {
    beforeEach(() => {
      // Enable auto-restart for these tests
      serverManager.updateConfig({ autoRestart: true, maxRestarts: 2, restartDelay: 50 });
    });

    it('should auto-restart on crash within limits', async () => {
      const restartingHandler = vi.fn();
      serverManager.on('restarting', restartingHandler);

      await serverManager.start();
      
      // Simulate crash
      mockChildProcess.emit('exit', 1, null);

      expect(serverManager.getState()).toBe('crashed');
      expect(restartingHandler).toHaveBeenCalledWith(1, 2);

      // Wait for restart attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(child_process.spawn).toHaveBeenCalledTimes(2);
    });

    it('should not restart beyond max attempts', async () => {
      await serverManager.start();
      
      // Crash multiple times
      mockChildProcess.emit('exit', 1, null);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      mockChildProcess.emit('exit', 1, null);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      mockChildProcess.emit('exit', 1, null);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(serverManager.getState()).toBe('error');
    });
  });

  describe('startup timeout', () => {
    it('should handle startup timeout', async () => {
      const config = {
        startupTimeout: 50 // Very short timeout
      };
      
      const manager = new ServerProcessManager(config, mockOutputChannel);
      
      const errorHandler = vi.fn();
      manager.on('error', errorHandler);

      try {
        await manager.start();
        // Should not reach here
        expect.fail('Expected start to throw');
      } catch (error: any) {
        expect(error.message).toContain('Server startup timeout');
        expect(manager.getState()).toBe('error');
        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Server startup timeout' }),
          expect.any(Object)
        );
      } finally {
        manager.dispose();
      }
    });
  });

  describe('disposal', () => {
    it('should dispose cleanly', async () => {
      await serverManager.start();
      
      const stopSpy = vi.spyOn(serverManager, 'stop').mockResolvedValue(undefined);
      
      serverManager.dispose();

      expect(stopSpy).toHaveBeenCalledWith(true);
      
      stopSpy.mockRestore();
    });

    it('should prevent operations after disposal', async () => {
      serverManager.dispose();
      
      await expect(serverManager.start()).rejects.toThrow('ServerProcessManager has been disposed');
    });

    it('should handle multiple dispose calls safely', () => {
      expect(() => {
        serverManager.dispose();
        serverManager.dispose();
      }).not.toThrow();
    });
  });

  describe('event handling', () => {
    it('should emit all expected events during lifecycle', async () => {
      const events: string[] = [];
      
      serverManager.on('stateChanged', (state: ServerState) => events.push(`stateChanged:${state}`));
      serverManager.on('started', () => events.push('started'));
      serverManager.on('stopped', () => events.push('stopped'));
      serverManager.on('error', () => events.push('error'));
      serverManager.on('crashed', () => events.push('crashed'));

      // Start server
      await serverManager.start();
      
      // Stop server
      const stopPromise = serverManager.stop();
      setTimeout(() => mockChildProcess.emit('exit', 0, null), 10);
      await stopPromise;

      expect(events).toContain('stateChanged:starting');
      expect(events).toContain('stateChanged:running');
      expect(events).toContain('started');
      expect(events).toContain('stateChanged:stopping');
      expect(events).toContain('stateChanged:stopped');
      expect(events).toContain('stopped');
    });
  });
});