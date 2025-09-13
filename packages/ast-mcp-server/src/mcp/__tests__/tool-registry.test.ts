import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MCPToolRegistry } from '../tool-registry';
import type { MCPTool, ToolExecutionContext, CallToolResult } from '../protocol/types';

describe('MCPToolRegistry', () => {
  let registry: MCPToolRegistry;

  // Mock tool for testing
  const createMockTool = (name: string, options: Partial<MCPTool> = {}): MCPTool => ({
    name,
    description: `Description for ${name}`,
    handler: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: `Result from ${name}` }],
      isError: false
    } as CallToolResult),
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    },
    capabilities: ['read-only'],
    ...options
  } as MCPTool);

  beforeEach(() => {
    registry = new MCPToolRegistry({ maxExecutionTime: 1000 });
  });

  describe('tool registration', () => {
    it('should register a valid tool successfully', async () => {
      const tool = createMockTool('test-tool');
      
      await registry.registerTool(tool);
      
      expect(registry.getTool('test-tool')).toBe(tool);
      expect(registry.getAllTools()).toContain(tool);
    });

    it('should register a tool with metadata', async () => {
      const tool = createMockTool('test-tool');
      
      await registry.registerTool(tool, {
        category: 'test',
        tags: ['search', 'testing']
      });
      
      const metadata = registry.getToolMetadata('test-tool');
      expect(metadata).toBeDefined();
      expect(metadata!.category).toBe('test');
      expect(metadata!.tags).toEqual(['search', 'testing']);
    });

    it('should prevent duplicate tool registration', async () => {
      const tool1 = createMockTool('duplicate-tool');
      const tool2 = createMockTool('duplicate-tool');
      
      await registry.registerTool(tool1);
      
      await expect(registry.registerTool(tool2)).rejects.toThrow(
        "Tool 'duplicate-tool' is already registered"
      );
    });

    it('should validate tool during registration', async () => {
      const invalidTool = {
        name: '',
        description: 'Invalid tool'
      } as MCPTool;
      
      await expect(registry.registerTool(invalidTool)).rejects.toThrow(
        'Tool validation failed'
      );
    });

    it('should skip validation when requested', async () => {
      const invalidTool = {
        name: '',
        description: 'Invalid tool'
      } as MCPTool;
      
      await expect(
        registry.registerTool(invalidTool, { skipValidation: true })
      ).resolves.not.toThrow();
    });

    it('should emit tool-registered event', async () => {
      const tool = createMockTool('event-tool');
      const eventSpy = vi.fn();
      
      registry.on('tool-registered', eventSpy);
      await registry.registerTool(tool);
      
      expect(eventSpy).toHaveBeenCalledWith('event-tool', expect.any(Object));
    });
  });

  describe('tool discovery', () => {
    beforeEach(async () => {
      await registry.registerTool(createMockTool('search-tool'), {
        category: 'search',
        tags: ['query', 'find']
      });
      
      await registry.registerTool(createMockTool('db-tool'), {
        category: 'database',
        tags: ['sql', 'query']
      });
      
      await registry.registerTool(createMockTool('file-tool'), {
        category: 'file',
        tags: ['read', 'write']
      });
    });

    it('should discover all tools by default', () => {
      const tools = registry.discoverTools();
      expect(tools).toHaveLength(3);
    });

    it('should discover tools by category', () => {
      const searchTools = registry.discoverTools({ category: 'search' });
      expect(searchTools).toHaveLength(1);
      expect(searchTools[0].name).toBe('search-tool');
    });

    it('should discover tools by tags', () => {
      const queryTools = registry.discoverTools({ tags: ['query'] });
      expect(queryTools).toHaveLength(2);
      expect(queryTools.map(t => t.name)).toContain('search-tool');
      expect(queryTools.map(t => t.name)).toContain('db-tool');
    });

    it('should discover tools by name', () => {
      const tools = registry.discoverTools({ name: 'file-tool' });
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('file-tool');
    });

    it('should discover tools by capabilities', () => {
      const tools = registry.discoverTools({ capabilities: ['read-only'] });
      expect(tools).toHaveLength(3); // All mock tools have read-only capability
    });

    it('should exclude disabled tools by default', async () => {
      registry.setToolEnabled('search-tool', false);
      
      const tools = registry.discoverTools();
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).not.toContain('search-tool');
    });

    it('should include disabled tools when requested', async () => {
      registry.setToolEnabled('search-tool', false);
      
      const tools = registry.discoverTools({ includeDisabled: true });
      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.name)).toContain('search-tool');
    });
  });

  describe('tool execution', () => {
    let mockTool: MCPTool;

    beforeEach(async () => {
      mockTool = createMockTool('exec-tool');
      await registry.registerTool(mockTool);
    });

    it('should execute a tool successfully', async () => {
      const params = { query: 'test' };
      const context: ToolExecutionContext = {
        timestamp: new Date(),
        requestId: 'req-123'
      };
      
      const result = await registry.executeTool('exec-tool', params, context);
      
      expect((mockTool as any).handler).toHaveBeenCalledWith(params, context);
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Result from exec-tool' }],
        isError: false
      });
    });

    it('should update execution statistics', async () => {
      const params = { query: 'test' };
      
      await registry.executeTool('exec-tool', params);
      
      const stats = registry.getToolStats('exec-tool');
      expect(stats).toBeDefined();
      expect(stats!.callCount).toBe(1);
      expect(stats!.successRate).toBe(1.0);
      expect(stats!.errorCount).toBe(0);
    });

    it('should validate parameters before execution', async () => {
      const invalidParams = {}; // Missing required 'query' parameter
      
      await expect(
        registry.executeTool('exec-tool', invalidParams)
      ).rejects.toThrow("Invalid parameters: Required parameter 'query' is missing");
    });

    it('should reject execution of non-existent tool', async () => {
      await expect(
        registry.executeTool('non-existent-tool', {})
      ).rejects.toThrow("Tool 'non-existent-tool' not found");
    });

    it('should reject execution of disabled tool', async () => {
      registry.setToolEnabled('exec-tool', false);
      
      await expect(
        registry.executeTool('exec-tool', { query: 'test' })
      ).rejects.toThrow("Tool 'exec-tool' is disabled");
    });

    it('should timeout long-running executions', async () => {
      const slowTool = createMockTool('slow-tool');
      (slowTool as any).handler = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 2000))
      );
      
      const fastRegistry = new MCPToolRegistry({ maxExecutionTime: 100 });
      await fastRegistry.registerTool(slowTool);
      
      await expect(
        fastRegistry.executeTool('slow-tool', { query: 'test' })
      ).rejects.toThrow('Tool execution timeout');
    });

    it('should handle execution errors gracefully', async () => {
      const errorTool = createMockTool('error-tool');
      (errorTool as any).handler = vi.fn().mockRejectedValue(new Error('Execution failed'));
      
      await registry.registerTool(errorTool);
      
      await expect(
        registry.executeTool('error-tool', { query: 'test' })
      ).rejects.toThrow('Execution failed');
      
      const stats = registry.getToolStats('error-tool');
      expect(stats!.errorCount).toBe(1);
      expect(stats!.successRate).toBe(0);
    });

    it('should emit execution events', async () => {
      const executedSpy = vi.fn();
      registry.on('tool-executed', executedSpy);
      
      await registry.executeTool('exec-tool', { query: 'test' });
      
      expect(executedSpy).toHaveBeenCalledWith(
        'exec-tool',
        expect.any(Number),
        expect.any(Object)
      );
    });
  });

  describe('tool management', () => {
    beforeEach(async () => {
      await registry.registerTool(createMockTool('test-tool'));
    });

    it('should enable and disable tools', () => {
      expect(registry.isToolEnabled('test-tool')).toBe(true);
      
      registry.setToolEnabled('test-tool', false);
      expect(registry.isToolEnabled('test-tool')).toBe(false);
      
      registry.setToolEnabled('test-tool', true);
      expect(registry.isToolEnabled('test-tool')).toBe(true);
    });

    it('should emit enable/disable events', () => {
      const enabledSpy = vi.fn();
      const disabledSpy = vi.fn();
      
      registry.on('tool-enabled', enabledSpy);
      registry.on('tool-disabled', disabledSpy);
      
      registry.setToolEnabled('test-tool', false);
      registry.setToolEnabled('test-tool', true);
      
      expect(disabledSpy).toHaveBeenCalledWith('test-tool');
      expect(enabledSpy).toHaveBeenCalledWith('test-tool');
    });

    it('should unregister tools', async () => {
      expect(registry.getTool('test-tool')).toBeDefined();
      
      const result = registry.unregisterTool('test-tool');
      
      expect(result).toBe(true);
      expect(registry.getTool('test-tool')).toBeUndefined();
    });

    it('should return false when unregistering non-existent tool', () => {
      const result = registry.unregisterTool('non-existent-tool');
      expect(result).toBe(false);
    });

    it('should emit tool-unregistered event', async () => {
      const eventSpy = vi.fn();
      registry.on('tool-unregistered', eventSpy);
      
      registry.unregisterTool('test-tool');
      
      expect(eventSpy).toHaveBeenCalledWith('test-tool');
    });
  });

  describe('categories and tags', () => {
    beforeEach(async () => {
      await registry.registerTool(createMockTool('tool1'), {
        category: 'cat1',
        tags: ['tag1', 'tag2']
      });
      
      await registry.registerTool(createMockTool('tool2'), {
        category: 'cat2',
        tags: ['tag2', 'tag3']
      });
    });

    it('should return all categories', () => {
      const categories = registry.getCategories();
      expect(categories).toContain('cat1');
      expect(categories).toContain('cat2');
    });

    it('should return all tags', () => {
      const tags = registry.getTags();
      expect(tags).toContain('tag1');
      expect(tags).toContain('tag2');
      expect(tags).toContain('tag3');
    });

    it('should get tools by category', () => {
      const tools = registry.getToolsByCategory('cat1');
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('tool1');
    });

    it('should get tools by tag', () => {
      const tools = registry.getToolsByTag('tag2');
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toContain('tool1');
      expect(tools.map(t => t.name)).toContain('tool2');
    });

    it('should clean up categories and tags when tool is unregistered', () => {
      registry.unregisterTool('tool1');
      
      const categories = registry.getCategories();
      const tags = registry.getTags();
      
      expect(categories).not.toContain('cat1');
      expect(tags).not.toContain('tag1');
    });
  });

  describe('statistics management', () => {
    beforeEach(async () => {
      await registry.registerTool(createMockTool('stats-tool'));
      await registry.executeTool('stats-tool', { query: 'test' });
    });

    it('should provide registry summary', () => {
      const summary = registry.getSummary();
      
      expect(summary.totalTools).toBe(1);
      expect(summary.enabledTools).toBe(1);
      expect(summary.disabledTools).toBe(0);
      expect(summary.totalExecutions).toBe(1);
      expect(summary.averageSuccessRate).toBe(1.0);
    });

    it('should clear statistics', () => {
      const statsBefore = registry.getToolStats('stats-tool');
      expect(statsBefore!.callCount).toBe(1);
      
      registry.clearStats();
      
      const statsAfter = registry.getToolStats('stats-tool');
      expect(statsAfter!.callCount).toBe(0);
    });

    it('should emit stats-cleared event', () => {
      const eventSpy = vi.fn();
      registry.on('stats-cleared', eventSpy);
      
      registry.clearStats();
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('parameter validation', () => {
    it('should validate required parameters', async () => {
      const tool = createMockTool('validation-tool', {
        inputSchema: {
          type: 'object',
          properties: {
            required_param: { type: 'string' },
            optional_param: { type: 'number' }
          },
          required: ['required_param']
        }
      });
      
      await registry.registerTool(tool);
      
      // Valid parameters
      await expect(
        registry.executeTool('validation-tool', { required_param: 'value' })
      ).resolves.toBeDefined();
      
      // Missing required parameter
      await expect(
        registry.executeTool('validation-tool', { optional_param: 123 })
      ).rejects.toThrow("Required parameter 'required_param' is missing");
    });

    it('should validate parameter types', async () => {
      const tool = createMockTool('type-validation-tool', {
        inputSchema: {
          type: 'object',
          properties: {
            string_param: { type: 'string' },
            number_param: { type: 'number' },
            array_param: { type: 'array' }
          }
        }
      });
      
      await registry.registerTool(tool);
      
      // Wrong type
      await expect(
        registry.executeTool('type-validation-tool', { string_param: 123 })
      ).rejects.toThrow("Parameter 'string_param' must be of type string, got number");
      
      // Wrong array type
      await expect(
        registry.executeTool('type-validation-tool', { array_param: 'not-array' })
      ).rejects.toThrow("Parameter 'array_param' must be an array");
    });

    it('should accept any parameters when no schema provided', async () => {
      const tool = createMockTool('no-schema-tool', {
        inputSchema: undefined
      });
      
      await registry.registerTool(tool);
      
      await expect(
        registry.executeTool('no-schema-tool', { any_param: 'any_value' })
      ).resolves.toBeDefined();
    });
  });
});