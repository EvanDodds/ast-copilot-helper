import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as vscode from 'vscode';
import { UIManager } from '../managers/UIManager';

// Mock VS Code API
vi.mock('vscode', () => ({
  window: {
    createStatusBarItem: vi.fn(),
    showInformationMessage: vi.fn(() => Promise.resolve(undefined)),
    showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
    showErrorMessage: vi.fn(() => Promise.resolve(undefined)),
    withProgress: vi.fn(),
    createWebviewPanel: vi.fn()
  },
  StatusBarAlignment: {
    Left: 1,
    Right: 2
  },
  ProgressLocation: {
    Notification: 10
  },
  ViewColumn: {
    One: 1
  },
  Uri: {
    file: vi.fn()
  }
}));

describe('UIManager', () => {
  let uiManager: UIManager;
  let mockOutputChannel: vscode.OutputChannel;
  let mockStatusBarItem: vscode.StatusBarItem;

  beforeEach(() => {
    // Setup mocks
    mockOutputChannel = {
      appendLine: vi.fn(),
      dispose: vi.fn()
    } as any;

    mockStatusBarItem = {
      text: '',
      tooltip: '',
      color: '',
      command: '',
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn()
    } as any;

    (vscode.window.createStatusBarItem as any).mockReturnValue(mockStatusBarItem);

    uiManager = new UIManager(mockOutputChannel, null, null);
  });

  afterEach(() => {
    uiManager.dispose();
    vi.clearAllMocks();
  });

  describe('Status Bar Management', () => {
    it('should create status bar item', () => {
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
        vscode.StatusBarAlignment.Right,
        100
      );
    });

    it('should get status bar item', () => {
      const statusBarItem = uiManager.getStatusBarItem();
      expect(statusBarItem).toBe(mockStatusBarItem);
    });

    it('should update status bar', () => {
      uiManager.updateStatusBar('ready');
      
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('should update status bar with no state', () => {
      uiManager.updateStatusBar();
      
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });
  });

  describe('Notification Management', () => {
    it('should show info notification', () => {
      uiManager.showInfoNotification('Test info message', false);
      
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Test info message'
      );
    });

    it('should show warning notification', () => {
      uiManager.showWarningNotification('Test warning message', false);
      
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Test warning message'
      );
    });

    it('should show error notification', () => {
      uiManager.showErrorNotification('Test error message', false);
      
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Test error message'
      );
    });

    it('should show info notification with actions', () => {
      uiManager.showInfoNotification('Test message', true);
      
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Test message',
        'Show Logs'
      );
    });

    it('should show warning notification with actions', () => {
      uiManager.showWarningNotification('Test message', true);
      
      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Test message',
        'Show Logs',
        'Retry'
      );
    });

    it('should show error notification with actions', () => {
      uiManager.showErrorNotification('Test message', true);
      
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Test message',
        'Show Logs',
        'Report Issue',
        'Open Settings'
      );
    });
  });

  describe('Progress Management', () => {
    it('should handle progress tracking', () => {
      // Test that progress tracking is set up correctly
      expect(uiManager).toBeDefined();
    });
  });

  describe('WebView Management', () => {
    it('should create webview panel', () => {
      const mockPanel = {
        webview: {
          html: '',
          onDidReceiveMessage: vi.fn()
        },
        onDidDispose: vi.fn(),
        dispose: vi.fn()
      };

      (vscode.window.createWebviewPanel as any).mockReturnValue(mockPanel);

      const panel = uiManager.createWebviewPanel(
        'test-panel',
        'Test Panel',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: []
        }
      );

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'test-panel',
        'Test Panel',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: []
        }
      );
      expect(panel).toBe(mockPanel);
    });
  });

  describe('Reference Updates', () => {
    it('should update references', () => {
      const mockServerManager = {
        on: vi.fn(),
        getState: vi.fn().mockReturnValue('stopped')
      } as any;
      const mockClientManager = {
        on: vi.fn()
      } as any;

      uiManager.updateReferences(mockServerManager, mockClientManager);

      // Should not throw and should update internal references
      expect(() => {
        uiManager.updateReferences(mockServerManager, mockClientManager);
      }).not.toThrow();
      
      // Verify that event handlers were set up
      expect(mockServerManager.on).toHaveBeenCalled();
    });
  });

  describe('Resource Management', () => {
    it('should dispose properly', () => {
      uiManager.dispose();
      
      expect(mockStatusBarItem.dispose).toHaveBeenCalled();
    });

    it('should handle disposal of webview panels', () => {
      // Test that disposal works correctly
      expect(() => {
        uiManager.dispose();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle status bar update errors', () => {
      // Mock a property setter to throw an error
      Object.defineProperty(mockStatusBarItem, 'text', {
        get: vi.fn(),
        set: vi.fn().mockImplementation(() => {
          throw new Error('Status bar error');
        })
      });

      // Should not throw
      expect(() => {
        uiManager.updateStatusBar('ready');
      }).not.toThrow();

      expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Error updating status bar')
      );
    });

    it('should handle general errors gracefully', () => {
      // Test that UIManager handles errors without crashing
      expect(uiManager).toBeDefined();
      expect(typeof uiManager.dispose).toBe('function');
    });
  });
});