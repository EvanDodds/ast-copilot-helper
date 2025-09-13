/**
 * Tests for MCP protocol types and validation functions
 */
import { describe, it, expect } from 'vitest';
import {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  MCPErrorCode,
  createMCPError,
  createErrorResponse,
  createSuccessResponse,
  isValidMCPRequest,
  isValidMCPResponse,
  isValidMCPNotification
} from '../../../packages/ast-mcp-server/src/mcp/protocol';

describe('MCP Protocol Types', () => {
  describe('Message Validation', () => {
    it('should validate JSON-RPC requests correctly', () => {
      const validRequest: JSONRPCRequest = {
        jsonrpc: "2.0",
        id: "test-123",
        method: "tools/list"
      };
      
      expect(isValidMCPRequest(validRequest)).toBe(true);
      
      const invalidRequests = [
        { jsonrpc: "1.0", id: 1, method: "test" },  // Wrong version
        { jsonrpc: "2.0", method: "test" },         // Missing ID
        { jsonrpc: "2.0", id: 1 },                 // Missing method
        null,                                       // Null
        undefined,                                  // Undefined
        "string"                                    // Wrong type
      ];
      
      invalidRequests.forEach(req => {
        expect(isValidMCPRequest(req)).toBe(false);
      });
    });

    it('should validate JSON-RPC responses correctly', () => {
      const validResponse: JSONRPCResponse = {
        jsonrpc: "2.0",
        id: "test-123",
        result: { success: true }
      };
      
      expect(isValidMCPResponse(validResponse)).toBe(true);
      
      const validErrorResponse: JSONRPCResponse = {
        jsonrpc: "2.0",
        id: "test-123",
        error: {
          code: MCPErrorCode.INTERNAL_ERROR,
          message: "Test error"
        }
      };
      
      expect(isValidMCPResponse(validErrorResponse)).toBe(true);
      
      const invalidResponses = [
        { jsonrpc: "2.0", id: 1 },                 // Missing result and error
        { jsonrpc: "1.0", id: 1, result: {} },    // Wrong version
        { jsonrpc: "2.0", result: {} },           // Missing ID
      ];
      
      invalidResponses.forEach(res => {
        expect(isValidMCPResponse(res)).toBe(false);
      });
    });

    it('should validate JSON-RPC notifications correctly', () => {
      const validNotification: JSONRPCNotification = {
        jsonrpc: "2.0",
        method: "progress/notification"
      };
      
      expect(isValidMCPNotification(validNotification)).toBe(true);
      
      const invalidNotifications = [
        { jsonrpc: "2.0", method: "test", id: 1 }, // Should not have ID
        { jsonrpc: "2.0" },                       // Missing method
        { jsonrpc: "1.0", method: "test" },       // Wrong version
      ];
      
      invalidNotifications.forEach(notif => {
        expect(isValidMCPNotification(notif)).toBe(false);
      });
    });
  });

  describe('Error Handling', () => {
    it('should create MCP errors correctly', () => {
      const error = createMCPError(
        MCPErrorCode.INVALID_PARAMS,
        "Invalid parameter",
        { param: "test" }
      );
      
      expect(error).toEqual({
        code: MCPErrorCode.INVALID_PARAMS,
        message: "Invalid parameter",
        data: { param: "test" }
      });
    });

    it('should create error responses correctly', () => {
      const error = createMCPError(MCPErrorCode.METHOD_NOT_FOUND, "Method not found");
      const response = createErrorResponse("test-123", error);
      
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: "test-123",
        error: {
          code: MCPErrorCode.METHOD_NOT_FOUND,
          message: "Method not found"
        }
      });
    });

    it('should create success responses correctly', () => {
      const result = { tools: [] };
      const response = createSuccessResponse("test-123", result);
      
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: "test-123",
        result: { tools: [] }
      });
    });
  });

  describe('MCP Error Codes', () => {
    it('should have correct JSON-RPC standard error codes', () => {
      expect(MCPErrorCode.PARSE_ERROR).toBe(-32700);
      expect(MCPErrorCode.INVALID_REQUEST).toBe(-32600);
      expect(MCPErrorCode.METHOD_NOT_FOUND).toBe(-32601);
      expect(MCPErrorCode.INVALID_PARAMS).toBe(-32602);
      expect(MCPErrorCode.INTERNAL_ERROR).toBe(-32603);
    });

    it('should have MCP-specific error codes', () => {
      expect(MCPErrorCode.INITIALIZATION_FAILED).toBe(-32000);
      expect(MCPErrorCode.RESOURCE_NOT_FOUND).toBe(-32001);
      expect(MCPErrorCode.TOOL_EXECUTION_ERROR).toBe(-32002);
      expect(MCPErrorCode.TRANSPORT_ERROR).toBe(-32003);
      expect(MCPErrorCode.DATABASE_ERROR).toBe(-32004);
      expect(MCPErrorCode.CAPABILITY_NOT_SUPPORTED).toBe(-32005);
    });
  });
});