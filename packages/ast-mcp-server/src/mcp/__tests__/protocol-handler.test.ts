import { describe, it, expect } from "vitest";
import { MCPProtocolHandler } from "../protocol/handler";
import {
  MCPRequest,
  MCPResponse,
  MCPErrorCode,
  MCPError,
} from "../protocol/types";

describe("MCPProtocolHandler", () => {
  describe("parseRequest", () => {
    it("should parse valid JSON-RPC 2.0 request", () => {
      const jsonMessage = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05" },
      });

      const result = MCPProtocolHandler.parseRequest(jsonMessage);

      expect("code" in result).toBe(false); // Not an error
      const request = result as MCPRequest;
      expect(request.jsonrpc).toBe("2.0");
      expect(request.id).toBe(1);
      expect(request.method).toBe("initialize");
      expect(request.params).toEqual({ protocolVersion: "2024-11-05" });
    });

    it("should parse notification (no id)", () => {
      const jsonMessage = JSON.stringify({
        jsonrpc: "2.0",
        method: "initialized",
      });

      const result = MCPProtocolHandler.parseRequest(jsonMessage);

      expect("code" in result).toBe(false); // Not an error
      const notification = result as any;
      expect(notification.jsonrpc).toBe("2.0");
      expect(notification.id).toBeUndefined();
      expect(notification.method).toBe("initialized");
    });

    it("should return parse error on invalid JSON", () => {
      const result = MCPProtocolHandler.parseRequest("invalid json");

      expect("code" in result).toBe(true); // Is an error
      const error = result as MCPError;
      expect(error.code).toBe(MCPErrorCode.PARSE_ERROR);
      expect(error.message).toBe("Parse error");
    });

    it("should return error on missing jsonrpc field", () => {
      const jsonMessage = JSON.stringify({
        id: 1,
        method: "test",
      });

      const result = MCPProtocolHandler.parseRequest(jsonMessage);

      expect("code" in result).toBe(true); // Is an error
      const error = result as MCPError;
      expect(error.code).toBe(MCPErrorCode.INVALID_REQUEST);
      expect(error.message).toBe("Invalid Request");
    });

    it("should return error on wrong jsonrpc version", () => {
      const jsonMessage = JSON.stringify({
        jsonrpc: "1.0",
        id: 1,
        method: "test",
      });

      const result = MCPProtocolHandler.parseRequest(jsonMessage);

      expect("code" in result).toBe(true); // Is an error
      const error = result as MCPError;
      expect(error.code).toBe(MCPErrorCode.INVALID_REQUEST);
      expect(error.message).toBe("Invalid Request");
    });

    it("should return error on missing method", () => {
      const jsonMessage = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
      });

      const result = MCPProtocolHandler.parseRequest(jsonMessage);

      expect("code" in result).toBe(true); // Is an error
      const error = result as MCPError;
      expect(error.code).toBe(MCPErrorCode.INVALID_REQUEST);
      expect(error.message).toBe("Invalid Request");
    });
  });

  describe("createSuccessResponse", () => {
    it("should create valid success response", () => {
      const response = MCPProtocolHandler.createSuccessResponse(1, {
        success: true,
      });

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.result).toEqual({ success: true });
      expect(response.error).toBeUndefined();
    });

    it("should handle null id", () => {
      const response = MCPProtocolHandler.createSuccessResponse(null, {
        success: true,
      });

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBeNull();
      expect(response.result).toEqual({ success: true });
    });

    it("should handle string id", () => {
      const response = MCPProtocolHandler.createSuccessResponse("test-id", {
        success: true,
      });

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe("test-id");
      expect(response.result).toEqual({ success: true });
    });
  });

  describe("createErrorResponse", () => {
    it("should create valid error response", () => {
      const error = {
        code: MCPErrorCode.INVALID_REQUEST,
        message: "Invalid request",
      };
      const response = MCPProtocolHandler.createErrorResponse(1, error);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.error).toEqual(error);
      expect(response.result).toBeUndefined();
    });

    it("should handle null id in error response", () => {
      const error = { code: MCPErrorCode.PARSE_ERROR, message: "Parse error" };
      const response = MCPProtocolHandler.createErrorResponse(null, error);

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBeNull();
      expect(response.error).toEqual(error);
    });
  });

  describe("error factory methods", () => {
    it("should create parse error", () => {
      const error = MCPProtocolHandler.createParseError();

      expect(error.code).toBe(MCPErrorCode.PARSE_ERROR);
      expect(error.message).toBe("Parse error");
    });

    it("should create invalid request error", () => {
      const error = MCPProtocolHandler.createInvalidRequest("Missing method");

      expect(error.code).toBe(MCPErrorCode.INVALID_REQUEST);
      expect(error.message).toBe("Invalid Request");
      expect(error.data).toBe("Missing method");
    });

    it("should create method not found error", () => {
      const error = MCPProtocolHandler.createMethodNotFound("unknown_method");

      expect(error.code).toBe(MCPErrorCode.METHOD_NOT_FOUND);
      expect(error.message).toBe("Method not found: unknown_method");
    });

    it("should create internal error", () => {
      const error = MCPProtocolHandler.createInternalError("Server crashed");

      expect(error.code).toBe(MCPErrorCode.INTERNAL_ERROR);
      expect(error.message).toBe("Server crashed");
    });
  });

  describe("utility methods", () => {
    it("should validate method names", () => {
      expect(MCPProtocolHandler.isValidMethod("initialize")).toBe(true);
      expect(MCPProtocolHandler.isValidMethod("tools/list")).toBe(true);
      expect(MCPProtocolHandler.isValidMethod("resources/read")).toBe(true);
      expect(MCPProtocolHandler.isValidMethod("")).toBe(false);
      expect(MCPProtocolHandler.isValidMethod("invalid method")).toBe(false);
    });

    it("should check protocol version compatibility", () => {
      expect(MCPProtocolHandler.isCompatibleProtocolVersion("2024-11-05")).toBe(
        true,
      );
      expect(MCPProtocolHandler.isCompatibleProtocolVersion("2024-10-01")).toBe(
        false,
      );
      expect(MCPProtocolHandler.isCompatibleProtocolVersion("2025-01-01")).toBe(
        false,
      );
    });

    it("should return supported protocol version", () => {
      expect(MCPProtocolHandler.getSupportedProtocolVersion()).toBe(
        "2024-11-05",
      );
    });
  });
});
