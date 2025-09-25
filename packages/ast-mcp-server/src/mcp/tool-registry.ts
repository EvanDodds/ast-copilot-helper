import { EventEmitter } from "events";
import { logger } from "../logging/logger";
import type {
  MCPTool,
  MCPToolResult,
  ToolExecutionContext,
  ToolValidationResult,
  ToolMetadata,
  ToolCapabilities,
} from "./protocol/types";

/**
 * Tool execution statistics for performance monitoring
 */
export interface ToolExecutionStats {
  callCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  successRate: number;
  lastExecuted?: Date;
  errorCount: number;
  lastError?: Error;
}

/**
 * Tool registration options
 */
export interface ToolRegistrationOptions {
  /** Override validation during registration */
  skipValidation?: boolean;
  /** Category for organizing tools */
  category?: string;
  /** Tags for tool discovery */
  tags?: string[];
  /** Tool-specific configuration */
  config?: Record<string, any>;
}

/**
 * Tool discovery criteria
 */
export interface ToolDiscoveryOptions {
  category?: string;
  tags?: string[];
  name?: string;
  capabilities?: ToolCapabilities[];
  includeDisabled?: boolean;
}

/**
 * Comprehensive tool registry with validation, execution tracking, and discovery capabilities
 */
export class MCPToolRegistry extends EventEmitter {
  private tools = new Map<string, MCPTool>();
  private metadata = new Map<string, ToolMetadata>();
  private stats = new Map<string, ToolExecutionStats>();
  private disabledTools = new Set<string>();
  private categories = new Map<string, Set<string>>();
  private tags = new Map<string, Set<string>>();
  private readonly maxExecutionTime: number;

  constructor(options: { maxExecutionTime?: number } = {}) {
    super();
    this.maxExecutionTime = options.maxExecutionTime ?? 200; // 200ms default per performance requirements

    logger.info("MCP Tool Registry initialized", {
      maxExecutionTime: this.maxExecutionTime,
      registeredTools: 0,
    });
  }

  /**
   * Register a new tool with comprehensive validation
   */
  async registerTool(
    tool: MCPTool,
    options: ToolRegistrationOptions = {},
  ): Promise<void> {
    try {
      // Validate tool before registration
      if (!options.skipValidation) {
        const validation = await this.validateTool(tool);
        if (!validation.isValid) {
          throw new Error(
            `Tool validation failed: ${validation.errors.join(", ")}`,
          );
        }
      }

      // Check for naming conflicts
      if (this.tools.has(tool.name)) {
        throw new Error(`Tool '${tool.name}' is already registered`);
      }

      // Register the tool
      this.tools.set(tool.name, tool);

      // Initialize metadata
      const metadata: ToolMetadata = {
        name: tool.name,
        description: tool.description,
        category: options.category || "general",
        tags: options.tags || [],
        capabilities: (tool as any).capabilities || [],
        registeredAt: new Date(),
        lastModified: new Date(),
        version: "1.0.0",
        author: "AST MCP Server",
        config: options.config || {},
      };
      this.metadata.set(tool.name, metadata);

      // Initialize statistics
      this.stats.set(tool.name, {
        callCount: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        successRate: 1.0,
        errorCount: 0,
      });

      // Update category mapping
      if (options.category) {
        if (!this.categories.has(options.category)) {
          this.categories.set(options.category, new Set());
        }
        this.categories.get(options.category)!.add(tool.name);
      }

      // Update tags mapping
      if (options.tags) {
        for (const tag of options.tags) {
          if (!this.tags.has(tag)) {
            this.tags.set(tag, new Set());
          }
          this.tags.get(tag)!.add(tool.name);
        }
      }

      this.emit("tool-registered", tool.name, metadata);

      logger.info("Tool registered successfully", {
        toolName: tool.name,
        category: metadata.category,
        tags: metadata.tags,
        capabilities: metadata.capabilities,
      });
    } catch (error) {
      logger.error("Failed to register tool", {
        toolName: tool.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Unregister a tool and clean up all associated data
   */
  unregisterTool(toolName: string): boolean {
    if (!this.tools.has(toolName)) {
      return false;
    }

    const metadata = this.metadata.get(toolName);

    // Remove from all data structures
    this.tools.delete(toolName);
    this.metadata.delete(toolName);
    this.stats.delete(toolName);
    this.disabledTools.delete(toolName);

    // Clean up category mapping
    if (metadata?.category) {
      const categoryTools = this.categories.get(metadata.category);
      if (categoryTools) {
        categoryTools.delete(toolName);
        if (categoryTools.size === 0) {
          this.categories.delete(metadata.category);
        }
      }
    }

    // Clean up tags mapping
    if (metadata?.tags) {
      for (const tag of metadata.tags) {
        const tagTools = this.tags.get(tag);
        if (tagTools) {
          tagTools.delete(toolName);
          if (tagTools.size === 0) {
            this.tags.delete(tag);
          }
        }
      }
    }

    this.emit("tool-unregistered", toolName);

    logger.info("Tool unregistered successfully", { toolName });
    return true;
  }

  /**
   * Get all registered tools
   */
  getAllTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools matching discovery criteria
   */
  discoverTools(options: ToolDiscoveryOptions = {}): MCPTool[] {
    let candidateTools = new Set(this.tools.keys());

    // Filter by name (exact match)
    if (options.name) {
      candidateTools = new Set(
        [options.name].filter((name) => candidateTools.has(name)),
      );
    }

    // Filter by category
    if (options.category) {
      const categoryTools = this.categories.get(options.category) || new Set();
      candidateTools = new Set(
        Array.from(candidateTools).filter((name) => categoryTools.has(name)),
      );
    }

    // Filter by tags (intersection)
    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        const tagTools = this.tags.get(tag) || new Set();
        candidateTools = new Set(
          Array.from(candidateTools).filter((name) => tagTools.has(name)),
        );
      }
    }

    // Filter by capabilities
    if (options.capabilities && options.capabilities.length > 0) {
      candidateTools = new Set(
        Array.from(candidateTools).filter((name) => {
          const tool = this.tools.get(name);
          if (!(tool as any)?.capabilities) {
            return false;
          }
          return options.capabilities!.every((cap) =>
            (tool as any).capabilities!.includes(cap),
          );
        }),
      );
    }

    // Filter disabled tools unless explicitly included
    if (!options.includeDisabled) {
      candidateTools = new Set(
        Array.from(candidateTools).filter(
          (name) => !this.disabledTools.has(name),
        ),
      );
    }

    return Array.from(candidateTools)
      .map((name) => this.tools.get(name)!)
      .filter((tool) => tool !== undefined);
  }

  /**
   * Get tool by name
   */
  getTool(toolName: string): MCPTool | undefined {
    return this.tools.get(toolName);
  }

  /**
   * Get tool metadata
   */
  getToolMetadata(toolName: string): ToolMetadata | undefined {
    return this.metadata.get(toolName);
  }

  /**
   * Get tool execution statistics
   */
  getToolStats(toolName: string): ToolExecutionStats | undefined {
    return this.stats.get(toolName);
  }

  /**
   * Execute a tool with comprehensive error handling and performance tracking
   */
  async executeTool(
    toolName: string,
    params: Record<string, any>,
    context?: ToolExecutionContext,
  ): Promise<MCPToolResult> {
    const startTime = Date.now();
    const tool = this.tools.get(toolName);
    const stats = this.stats.get(toolName);

    if (!tool || !stats) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    if (this.disabledTools.has(toolName)) {
      throw new Error(`Tool '${toolName}' is disabled`);
    }

    try {
      // Validate parameters
      const validation = await this.validateToolParameters(tool, params);
      if (!validation.isValid) {
        throw new Error(`Invalid parameters: ${validation.errors.join(", ")}`);
      }

      // Set up execution timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Tool execution timeout")),
          this.maxExecutionTime,
        ),
      );

      const executionPromise = (tool as any).handler(params, context);

      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Update statistics on success
      const executionTime = Date.now() - startTime;
      stats.callCount++;
      stats.totalExecutionTime += executionTime;
      stats.averageExecutionTime = stats.totalExecutionTime / stats.callCount;
      stats.successRate =
        (stats.callCount - stats.errorCount) / stats.callCount;
      stats.lastExecuted = new Date();

      this.emit("tool-executed", toolName, executionTime, result);

      logger.info("Tool executed successfully", {
        toolName,
        executionTime,
        resultType: result.isError ? "error" : "success",
      });

      return result;
    } catch (error) {
      // Update error statistics
      const executionTime = Date.now() - startTime;
      stats.callCount++;
      stats.errorCount++;
      stats.totalExecutionTime += executionTime;
      stats.averageExecutionTime = stats.totalExecutionTime / stats.callCount;
      stats.successRate =
        (stats.callCount - stats.errorCount) / stats.callCount;
      stats.lastError =
        error instanceof Error ? error : new Error(String(error));
      stats.lastExecuted = new Date();

      this.emit("tool-error", toolName, error);

      logger.error("Tool execution failed", {
        toolName,
        executionTime,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Enable or disable a tool
   */
  setToolEnabled(toolName: string, enabled: boolean): boolean {
    if (!this.tools.has(toolName)) {
      return false;
    }

    if (enabled) {
      this.disabledTools.delete(toolName);
      this.emit("tool-enabled", toolName);
      logger.info("Tool enabled", { toolName });
    } else {
      this.disabledTools.add(toolName);
      this.emit("tool-disabled", toolName);
      logger.info("Tool disabled", { toolName });
    }

    return true;
  }

  /**
   * Check if a tool is enabled
   */
  isToolEnabled(toolName: string): boolean {
    return this.tools.has(toolName) && !this.disabledTools.has(toolName);
  }

  /**
   * Get all available categories
   */
  getCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Get all available tags
   */
  getTags(): string[] {
    return Array.from(this.tags.keys());
  }

  /**
   * Get tools in a specific category
   */
  getToolsByCategory(category: string): MCPTool[] {
    const toolNames = this.categories.get(category) || new Set();
    return Array.from(toolNames)
      .map((name) => this.tools.get(name)!)
      .filter((tool) => tool !== undefined);
  }

  /**
   * Get tools with a specific tag
   */
  getToolsByTag(tag: string): MCPTool[] {
    const toolNames = this.tags.get(tag) || new Set();
    return Array.from(toolNames)
      .map((name) => this.tools.get(name)!)
      .filter((tool) => tool !== undefined);
  }

  /**
   * Clear all execution statistics
   */
  clearStats(): void {
    for (const [, stats] of this.stats.entries()) {
      stats.callCount = 0;
      stats.totalExecutionTime = 0;
      stats.averageExecutionTime = 0;
      stats.successRate = 1.0;
      stats.errorCount = 0;
      delete stats.lastExecuted;
      delete stats.lastError;
    }

    this.emit("stats-cleared");
    logger.info("Tool execution statistics cleared");
  }

  /**
   * Get registry summary
   */
  getSummary(): {
    totalTools: number;
    enabledTools: number;
    disabledTools: number;
    categories: number;
    tags: number;
    totalExecutions: number;
    averageSuccessRate: number;
  } {
    const totalExecutions = Array.from(this.stats.values()).reduce(
      (sum, stats) => sum + stats.callCount,
      0,
    );

    const averageSuccessRate =
      this.stats.size > 0
        ? Array.from(this.stats.values()).reduce(
            (sum, stats) => sum + stats.successRate,
            0,
          ) / this.stats.size
        : 1.0;

    return {
      totalTools: this.tools.size,
      enabledTools: this.tools.size - this.disabledTools.size,
      disabledTools: this.disabledTools.size,
      categories: this.categories.size,
      tags: this.tags.size,
      totalExecutions,
      averageSuccessRate,
    };
  }

  /**
   * Validate a tool definition
   */
  private async validateTool(tool: MCPTool): Promise<ToolValidationResult> {
    const errors: string[] = [];

    // Basic validation
    if (!tool.name || typeof tool.name !== "string") {
      errors.push("Tool name is required and must be a string");
    }

    if (!tool.description || typeof tool.description !== "string") {
      errors.push("Tool description is required and must be a string");
    }

    if (!(tool as any).handler || typeof (tool as any).handler !== "function") {
      errors.push("Tool handler is required and must be a function");
    }

    // Validate input schema if provided
    if (tool.inputSchema) {
      try {
        // Basic JSON schema validation (simplified)
        if (typeof tool.inputSchema !== "object" || !tool.inputSchema.type) {
          errors.push("Input schema must be a valid JSON schema object");
        }
      } catch (_error) {
        errors.push("Invalid input schema format");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate tool parameters against schema
   */
  private async validateToolParameters(
    tool: MCPTool,
    params: Record<string, any>,
  ): Promise<ToolValidationResult> {
    const errors: string[] = [];

    // If no schema provided, accept any parameters
    if (!tool.inputSchema) {
      return { isValid: true, errors: [] };
    }

    // Basic parameter validation (simplified JSON schema validation)
    const schema = tool.inputSchema;

    if (schema.type === "object" && schema.properties) {
      for (const [propName, propSchema] of Object.entries(
        schema.properties as Record<string, any>,
      )) {
        const value = params[propName];

        // Check required properties
        if (
          schema.required &&
          schema.required.includes(propName) &&
          value === undefined
        ) {
          errors.push(`Required parameter '${propName}' is missing`);
        }

        // Basic type checking
        if (value !== undefined && propSchema.type) {
          const actualType = typeof value;
          const expectedType = propSchema.type;

          if (expectedType === "array" && !Array.isArray(value)) {
            errors.push(`Parameter '${propName}' must be an array`);
          } else if (expectedType !== "array" && actualType !== expectedType) {
            errors.push(
              `Parameter '${propName}' must be of type ${expectedType}, got ${actualType}`,
            );
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
