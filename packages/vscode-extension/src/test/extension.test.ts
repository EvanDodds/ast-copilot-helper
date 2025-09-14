import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';

// Mock VS Code API
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    })),
    createStatusBarItem: vi.fn(() => ({
      command: '',
      tooltip: '',
      text: '',
      backgroundColor: undefined,
      color: undefined,
      show: vi.fn(),
      dispose: vi.fn(),
    })),
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  commands: {
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
    executeCommand: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
  StatusBarAlignment: {
    Right: 2,
  },
  ThemeColor: vi.fn(),
}));

// Mock extension module
vi.mock('../extension', async (importOriginal) => {
  // Import the actual module to get real implementations
  const actual = await importOriginal() as any;
  return {
    ...actual,
  };
});

describe('VS Code Extension', () => {
  let mockContext: vscode.ExtensionContext;
  
  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Clear module cache to ensure fresh import
    vi.resetModules();
    
    // Create mock extension context
    mockContext = {
      subscriptions: [],
    } as any;
  });
  
  afterEach(() => {
    // Clean up any active mocks
    vi.restoreAllMocks();
  });
  
  describe('Extension Activation', () => {
    it('should activate extension successfully', async () => {
      const { activate } = await import('../extension');
      
      expect(() => activate(mockContext)).not.toThrow();
      
      // Verify output channel creation
      expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('AST MCP Helper');
      
      // Verify status bar creation  
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(vscode.StatusBarAlignment.Right, 100);
      
      // Verify configuration watcher setup
      expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
    });
    
    it('should register all expected commands', async () => {
      const { activate } = await import('../extension');
      
      activate(mockContext);
      
      // Verify all 8 commands are registered
      expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(8);
      
      const expectedCommands = [
        'astHelper.startServer',
        'astHelper.stopServer', 
        'astHelper.restartServer',
        'astHelper.serverStatus',
        'astHelper.openSettings',
        'astHelper.parseWorkspace',
        'astHelper.clearIndex',
        'astHelper.showLogs'
      ];
      
      expectedCommands.forEach(command => {
        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
          command,
          expect.any(Function)
        );
      });
    });
    
    it('should handle activation errors gracefully', async () => {
      // Mock output channel creation to throw error
      vi.mocked(vscode.window.createOutputChannel).mockImplementation(() => {
        throw new Error('Mock activation error');
      });
      
      const { activate } = await import('../extension');
      
      expect(() => activate(mockContext)).not.toThrow();
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to activate AST MCP Helper extension')
      );
    });
  });
  
  describe('Extension Deactivation', () => {
    it('should deactivate extension cleanly', async () => {
      const { activate, deactivate } = await import('../extension');
      
      // First activate the extension
      activate(mockContext);
      
      // Then deactivate it
      expect(() => deactivate()).not.toThrow();
    });
  });
  
  describe('Configuration Management', () => {
    it('should read configuration on initialization', async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue(false), // auto-start disabled
      };
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);
      
      const { activate } = await import('../extension');
      
      activate(mockContext);
      
      // Verify configuration was read
      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('astHelper');
      expect(mockConfig.get).toHaveBeenCalledWith('server.autoStart', false);
    });
    
    it('should handle auto-start configuration', async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue(true), // auto-start enabled
      };
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);
      
      const { activate } = await import('../extension');
      
      activate(mockContext);
      
      expect(mockConfig.get).toHaveBeenCalledWith('server.autoStart', false);
    });
  });
  
  describe('Command Handlers', () => {
    it('should handle showLogs command', async () => {
      const { activate } = await import('../extension');
      
      activate(mockContext);
      
      // Get the registered showLogs command handler
      const registerCommandCalls = vi.mocked(vscode.commands.registerCommand).mock.calls;
      const showLogsCall = registerCommandCalls.find(call => call[0] === 'astHelper.showLogs');
      
      expect(showLogsCall).toBeDefined();
      
      if (showLogsCall) {
        const handler = showLogsCall[1] as Function;
        expect(() => handler()).not.toThrow();
      }
    });
    
    it('should handle openSettings command', async () => {
      const { activate } = await import('../extension');
      
      activate(mockContext);
      
      // Get the registered openSettings command handler
      const registerCommandCalls = vi.mocked(vscode.commands.registerCommand).mock.calls;
      const openSettingsCall = registerCommandCalls.find(call => call[0] === 'astHelper.openSettings');
      
      expect(openSettingsCall).toBeDefined();
      
      if (openSettingsCall) {
        const handler = openSettingsCall[1] as Function;
        await handler();
        
        // Verify settings command was executed
        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
          'workbench.action.openSettings',
          '@ext:ast-copilot-helper.vscode-extension'
        );
      }
    });
    
    it('should handle server management commands gracefully', async () => {
      const { activate } = await import('../extension');
      
      activate(mockContext);
      
      const serverCommands = ['astHelper.startServer', 'astHelper.stopServer', 'astHelper.restartServer'];
      const registerCommandCalls = vi.mocked(vscode.commands.registerCommand).mock.calls;
      
      for (const commandName of serverCommands) {
        const commandCall = registerCommandCalls.find(call => call[0] === commandName);
        expect(commandCall).toBeDefined();
        
        if (commandCall) {
          const handler = commandCall[1] as Function;
          await handler();
          
          // Should show implementation pending message
          expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            expect.stringContaining('functionality will be implemented')
          );
        }
      }
    });
  });
  
  describe('Status Bar Integration', () => {
    it('should create and configure status bar item', async () => {
      const mockStatusBarItem = {
        command: '',
        tooltip: '',
        text: '',
        backgroundColor: undefined,
        color: undefined,
        show: vi.fn(),
        dispose: vi.fn(),
      };
      
      vi.mocked(vscode.window.createStatusBarItem).mockReturnValue(mockStatusBarItem as any);
      
      const { activate } = await import('../extension');
      
      activate(mockContext);
      
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
        vscode.StatusBarAlignment.Right,
        100
      );
      
      expect(mockStatusBarItem.command).toBe('astHelper.serverStatus');
      expect(mockStatusBarItem.tooltip).toBe('Click to view AST MCP server status');
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });
  });
  
  describe('Error Handling', () => {
    it('should handle command execution errors', async () => {
      const { activate } = await import('../extension');
      
      activate(mockContext);
      
      // Get a command handler and make it throw
      const registerCommandCalls = vi.mocked(vscode.commands.registerCommand).mock.calls;
      const startServerCall = registerCommandCalls.find(call => call[0] === 'astHelper.startServer');
      
      expect(startServerCall).toBeDefined();
      
      if (startServerCall) {
        const wrappedHandler = startServerCall[1] as Function;
        
        // The wrapped handler should catch errors and not throw
        expect(() => wrappedHandler()).not.toThrow();
      }
    });
  });
});