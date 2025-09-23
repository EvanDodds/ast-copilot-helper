/**
 * MCP Request Handler Base Classes and Utilities
 * Provides base functionality for MCP request handlers
 */

import type { JSONRPCRequest, JSONRPCResponse, MCPHandler } from './protocol';

/**
 * Abstract base handler with common functionality
 */
export abstract class BaseHandler implements MCPHandler {
  abstract handle(request: JSONRPCRequest): Promise<JSONRPCResponse>;

  /**
   * Validate required parameters
   */
  protected validateParams(params: any, required: string[]): string | null {
    if (!params || typeof params !== 'object') {
      return 'Missing or invalid params object';
    }

    for (const field of required) {
      if (!(field in params) || params[field] === undefined) {
        return `Missing required parameter: ${field}`;
      }
    }

    return null; // No validation errors
  }

  /**
   * Validate parameter types
   */
  protected validateParamTypes(params: any, types: Record<string, string>): string | null {
    for (const [field, expectedType] of Object.entries(types)) {
      if (field in params) {
        const actualType = typeof params[field];
        if (actualType !== expectedType) {
          return `Parameter '${field}' must be of type ${expectedType}, got ${actualType}`;
        }
      }
    }

    return null; // No validation errors
  }

  /**
   * Validate numeric parameter ranges
   */
  protected validateNumericRanges(
    params: any, 
    ranges: Record<string, { min?: number; max?: number }>
  ): string | null {
    for (const [field, range] of Object.entries(ranges)) {
      if (field in params && typeof params[field] === 'number') {
        const value = params[field];
        
        if (range.min !== undefined && value < range.min) {
          return `Parameter '${field}' must be >= ${range.min}, got ${value}`;
        }
        
        if (range.max !== undefined && value > range.max) {
          return `Parameter '${field}' must be <= ${range.max}, got ${value}`;
        }
      }
    }

    return null; // No validation errors
  }

  /**
   * Apply default values to parameters
   */
  protected applyDefaults(params: any, defaults: Record<string, any>): any {
    const result = { ...params };
    
    for (const [field, defaultValue] of Object.entries(defaults)) {
      if (!(field in result) || result[field] === undefined) {
        result[field] = defaultValue;
      }
    }
    
    return result;
  }
}