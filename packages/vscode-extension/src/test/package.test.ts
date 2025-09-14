import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Extension Package Configuration', () => {
  it('should have valid package.json with required fields', () => {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Check required VS Code extension fields
    expect(packageJson.name).toBe('ast-copilot-helper');
    expect(packageJson.displayName).toBe('AST Copilot Helper');
    expect(packageJson.main).toBe('./dist/extension.js');
    expect(packageJson.engines.vscode).toBe('^1.80.0');
    
    // Check activation events
    expect(packageJson.activationEvents).toContain('onStartupFinished');
    
    // Check commands are defined
    expect(packageJson.contributes.commands).toHaveLength(8);
    expect(packageJson.contributes.commands).toContainEqual(
      expect.objectContaining({
        command: 'astCopilotHelper.startServer',
        title: 'Start AST MCP Server'
      })
    );
    
    // Check configuration schema exists
    expect(packageJson.contributes.configuration).toBeDefined();
    expect(packageJson.contributes.configuration.properties).toBeDefined();
    expect(packageJson.contributes.configuration.properties['astCopilotHelper.serverPath']).toBeDefined();
  });

  it('should have all required commands defined', () => {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const expectedCommands = [
      'astCopilotHelper.startServer',
      'astCopilotHelper.stopServer',
      'astCopilotHelper.restartServer',
      'astCopilotHelper.showStatus',
      'astCopilotHelper.openSettings',
      'astCopilotHelper.parseWorkspace',
      'astCopilotHelper.clearIndex',
      'astCopilotHelper.showLogs'
    ];

    const actualCommands = packageJson.contributes.commands.map((cmd: any) => cmd.command);
    
    for (const expectedCommand of expectedCommands) {
      expect(actualCommands).toContain(expectedCommand);
    }
  });

  it('should have proper configuration schema', () => {
    const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const config = packageJson.contributes.configuration.properties;
    
    // Check key configuration properties
    expect(config['astCopilotHelper.serverPath']).toEqual(
      expect.objectContaining({
        type: 'string',
        description: expect.any(String)
      })
    );
    
    expect(config['astCopilotHelper.autoStart']).toEqual(
      expect.objectContaining({
        type: 'boolean',
        default: true
      })
    );
    
    expect(config['astCopilotHelper.logLevel']).toEqual(
      expect.objectContaining({
        type: 'string',
        enum: ['debug', 'info', 'warn', 'error']
      })
    );
  });
});