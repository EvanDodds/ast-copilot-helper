/**
 * Rust signature extractor
 * Handles Rust-specific syntax including functions, structs, traits, enums,
 * impls, generics, lifetimes, and async functions
 */

import type { ASTNode } from "../../parser/types";
import type { SignatureExtractor, Parameter } from "../types";
import { ExtractionUtils } from "./extraction-utils";

export class RustExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    switch (node.type) {
      case "function":
      case "function_item":
      case "function_declaration":
        return this.extractFunctionSignature(sourceLines);

      case "struct":
      case "struct_item":
      case "struct_declaration":
        return this.extractStructSignature(sourceLines);

      case "enum":
      case "enum_item":
      case "enum_declaration":
        return this.extractEnumSignature(sourceLines);

      case "trait":
      case "trait_item":
      case "trait_declaration":
        return this.extractTraitSignature(sourceLines);

      case "impl":
      case "impl_item":
        return this.extractImplSignature(sourceLines);

      case "type":
      case "type_item":
      case "type_alias":
        return this.extractTypeAliasSignature(sourceLines);

      case "const":
      case "const_item":
      case "static":
      case "static_item":
        return this.extractConstantSignature(sourceLines);

      default:
        return sourceLines.length > 0 ? sourceLines[0]?.trim() || "" : "";
    }
  }

  extractParameters(node: ASTNode, sourceText: string): Parameter[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    // Extract parameters from function signature
    const signatureLine = sourceLines.find(
      (line) => line.includes("fn ") || line.includes("("),
    );

    if (!signatureLine) {
      return [];
    }

    return this.parseRustParameters(signatureLine);
  }

  extractReturnType(node: ASTNode, sourceText: string): string | null {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    const signatureLine = sourceLines.find((line) => line.includes("->"));
    if (!signatureLine) {
      return null;
    }

    const returnMatch = signatureLine.match(/->\s*([^{;]+)/);
    return returnMatch ? (returnMatch[1]?.trim() ?? null) : null;
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const modifiers: string[] = [];

    for (const line of sourceLines) {
      if (line.includes("pub(crate)")) {
        modifiers.push("pub(crate)");
      } else if (line.includes("pub(super)")) {
        modifiers.push("pub(super)");
      } else if (line.includes("pub")) {
        modifiers.push("pub");
      }

      if (line.includes("async")) {
        modifiers.push("async");
      }
      if (line.includes("unsafe")) {
        modifiers.push("unsafe");
      }
      if (line.includes("extern")) {
        modifiers.push("extern");
      }
      if (line.includes("const")) {
        modifiers.push("const");
      }
      if (line.includes("static")) {
        modifiers.push("static");
      }
    }

    return modifiers;
  }

  private extractFunctionSignature(sourceLines: string[]): string {
    // Find the function declaration line
    const functionLine = sourceLines.find(
      (line) =>
        line.trim().startsWith("fn ") ||
        line.trim().startsWith("pub fn ") ||
        line.trim().startsWith("async fn ") ||
        line.trim().startsWith("pub async fn ") ||
        line.trim().startsWith("unsafe fn "),
    );

    if (!functionLine) {
      return sourceLines[0]?.trim() || "";
    }

    // Extract function signature, potentially spanning multiple lines
    let signature = functionLine.trim();

    // If the line doesn't end with { or ;, it might continue on next lines
    if (!functionLine.includes("{") && !functionLine.includes(";")) {
      const startIndex = sourceLines.indexOf(functionLine);
      for (let i = startIndex + 1; i < sourceLines.length; i++) {
        signature += " " + sourceLines[i]?.trim();
        if (sourceLines[i]?.includes("{") || sourceLines[i]?.includes(";")) {
          break;
        }
      }
    }

    // Clean up the signature
    return signature.replace(/\s*\{.*$/, "").trim();
  }

  private extractStructSignature(sourceLines: string[]): string {
    const structLine = sourceLines.find(
      (line) => line.includes("struct ") || line.includes("pub struct "),
    );

    if (!structLine) {
      return sourceLines[0]?.trim() || "";
    }

    // Extract struct name and generics
    return structLine
      .replace(/\s*\{.*$/, "")
      .replace(/\s*;.*$/, "")
      .trim();
  }

  private extractEnumSignature(sourceLines: string[]): string {
    const enumLine = sourceLines.find(
      (line) => line.includes("enum ") || line.includes("pub enum "),
    );

    if (!enumLine) {
      return sourceLines[0]?.trim() || "";
    }

    return enumLine.replace(/\s*\{.*$/, "").trim();
  }

  private extractTraitSignature(sourceLines: string[]): string {
    const traitLine = sourceLines.find(
      (line) => line.includes("trait ") || line.includes("pub trait "),
    );

    if (!traitLine) {
      return sourceLines[0]?.trim() || "";
    }

    return traitLine.replace(/\s*\{.*$/, "").trim();
  }

  private extractImplSignature(sourceLines: string[]): string {
    const implLine = sourceLines.find((line) => line.includes("impl "));

    if (!implLine) {
      return sourceLines[0]?.trim() || "";
    }

    return implLine.replace(/\s*\{.*$/, "").trim();
  }

  private extractTypeAliasSignature(sourceLines: string[]): string {
    const typeLine = sourceLines.find(
      (line) => line.includes("type ") || line.includes("pub type "),
    );

    if (!typeLine) {
      return sourceLines[0]?.trim() || "";
    }

    return typeLine.replace(/\s*;.*$/, "").trim();
  }

  private extractConstantSignature(sourceLines: string[]): string {
    const constLine = sourceLines.find(
      (line) =>
        line.includes("const ") ||
        line.includes("static ") ||
        line.includes("pub const ") ||
        line.includes("pub static "),
    );

    if (!constLine) {
      return sourceLines[0]?.trim() || "";
    }

    return constLine
      .replace(/\s*=.*$/, "")
      .replace(/\s*;.*$/, "")
      .trim();
  }

  private parseRustParameters(signatureLine: string): Parameter[] {
    const parameters: Parameter[] = [];

    // Extract parameter list from parentheses
    const paramMatch = signatureLine.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1]?.trim()) {
      return parameters;
    }

    const paramStr = paramMatch[1].trim();

    // Handle self parameter
    if (
      paramStr.startsWith("self") ||
      paramStr.startsWith("&self") ||
      paramStr.startsWith("&mut self")
    ) {
      const selfMatch = paramStr.match(
        /^(&mut\s+self|&self|self)(?:,\s*(.*))?$/,
      );
      if (selfMatch) {
        parameters.push({
          name: "self",
          type: selfMatch[1] || "self",
          optional: false,
        });

        // Process remaining parameters if any
        if (selfMatch[2]) {
          parameters.push(...this.parseParameterList(selfMatch[2]));
        }
      }
    } else {
      parameters.push(...this.parseParameterList(paramStr));
    }

    return parameters;
  }

  private parseParameterList(paramStr: string): Parameter[] {
    const parameters: Parameter[] = [];

    // Split by comma, but be careful of generics
    const parts = this.splitRustParameters(paramStr);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }

      // Match parameter pattern: name: type
      const match = trimmed.match(/^(\w+):\s*(.+)$/);
      if (match) {
        parameters.push({
          name: match[1] || "",
          type: match[2]?.trim() || "",
          optional: false,
        });
      }
    }

    return parameters;
  }

  private splitRustParameters(paramStr: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;

    for (let i = 0; i < paramStr.length; i++) {
      const char = paramStr[i];

      if (char === "<" || char === "(") {
        depth++;
      } else if (char === ">" || char === ")") {
        depth--;
      } else if (char === "," && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }

      if (char) {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current);
    }

    return parts;
  }
}
