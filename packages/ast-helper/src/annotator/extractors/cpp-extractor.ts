/**
 * C/C++ signature extractor
 * Handles both C and C++ syntax including functions, classes, structs,
 * namespaces, templates, and preprocessor directives
 */

import type { ASTNode } from "../../parser/types";
import type { SignatureExtractor, Parameter } from "../types";
import { ExtractionUtils } from "./extraction-utils";

export class CppExtractor implements SignatureExtractor {
  extractSignature(node: ASTNode, sourceText: string): string {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    switch (node.type) {
      case "function":
      case "function_definition":
      case "function_declaration":
        return this.extractFunctionSignature(sourceLines);

      case "class":
      case "class_specifier":
      case "class_declaration":
        return this.extractClassSignature(sourceLines);

      case "struct":
      case "struct_specifier":
      case "struct_declaration":
        return this.extractStructSignature(sourceLines);

      case "namespace":
      case "namespace_definition":
        return this.extractNamespaceSignature(sourceLines);

      case "template":
      case "template_declaration":
        return this.extractTemplateSignature(sourceLines);

      case "enum":
      case "enum_specifier":
        return this.extractEnumSignature(sourceLines);

      case "typedef":
      case "type_definition":
        return this.extractTypedefSignature(sourceLines);

      case "using":
      case "using_declaration":
        return this.extractUsingSignature(sourceLines);

      case "preproc_def":
      case "preproc_function_def":
        return this.extractMacroSignature(sourceLines);

      default:
        return sourceLines.length > 0 ? sourceLines[0]?.trim() || "" : "";
    }
  }

  extractParameters(node: ASTNode, sourceText: string): Parameter[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    // Find the line with parameter list
    const paramLine = sourceLines.find(
      (line) =>
        line.includes("(") &&
        (line.includes(")") || sourceLines.some((l) => l.includes(")"))),
    );

    if (!paramLine) {
      return [];
    }

    return this.parseCppParameters(paramLine, sourceLines);
  }

  extractReturnType(node: ASTNode, sourceText: string): string | null {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);

    // For C/C++ functions, return type comes before function name
    const functionLine = sourceLines.find(
      (line) => line.includes("(") || line.match(/\b\w+\s*\(/),
    );

    if (!functionLine) {
      return null;
    }

    return this.extractCppReturnType(functionLine);
  }

  extractAccessModifiers(node: ASTNode, sourceText: string): string[] {
    const sourceLines = ExtractionUtils.getNodeLines(node, sourceText);
    const modifiers: string[] = [];

    for (const line of sourceLines) {
      if (line.includes("public:")) {
        modifiers.push("public");
      }
      if (line.includes("private:")) {
        modifiers.push("private");
      }
      if (line.includes("protected:")) {
        modifiers.push("protected");
      }
      if (line.includes("static")) {
        modifiers.push("static");
      }
      if (line.includes("const")) {
        modifiers.push("const");
      }
      if (line.includes("virtual")) {
        modifiers.push("virtual");
      }
      if (line.includes("inline")) {
        modifiers.push("inline");
      }
      if (line.includes("extern")) {
        modifiers.push("extern");
      }
      if (line.includes("friend")) {
        modifiers.push("friend");
      }
      if (line.includes("explicit")) {
        modifiers.push("explicit");
      }
    }

    return modifiers;
  }

  private extractFunctionSignature(sourceLines: string[]): string {
    // Find function declaration/definition
    let signature = "";
    let foundStart = false;

    for (const line of sourceLines) {
      const trimmed = line.trim();

      if (
        !foundStart &&
        (trimmed.includes("(") || trimmed.match(/^\w.*\w+\s*$/))
      ) {
        signature = trimmed;
        foundStart = true;

        // If line contains complete signature
        if (trimmed.includes(")")) {
          break;
        }
      } else if (foundStart) {
        signature += " " + trimmed;
        if (trimmed.includes(")")) {
          break;
        }
      }
    }

    // Clean up signature (remove function body)
    return signature
      .replace(/\s*\{.*$/, "")
      .replace(/\s*;.*$/, "")
      .trim();
  }

  private extractClassSignature(sourceLines: string[]): string {
    const classLine = sourceLines.find(
      (line) => line.includes("class ") || line.includes("struct "),
    );

    if (!classLine) {
      return sourceLines[0]?.trim() || "";
    }

    // Extract class name and inheritance
    return classLine
      .replace(/\s*\{.*$/, "")
      .replace(/\s*;.*$/, "")
      .trim();
  }

  private extractStructSignature(sourceLines: string[]): string {
    const structLine = sourceLines.find((line) => line.includes("struct "));

    if (!structLine) {
      return sourceLines[0]?.trim() || "";
    }

    return structLine
      .replace(/\s*\{.*$/, "")
      .replace(/\s*;.*$/, "")
      .trim();
  }

  private extractNamespaceSignature(sourceLines: string[]): string {
    const namespaceLine = sourceLines.find((line) =>
      line.includes("namespace "),
    );

    if (!namespaceLine) {
      return sourceLines[0]?.trim() || "";
    }

    return namespaceLine.replace(/\s*\{.*$/, "").trim();
  }

  private extractTemplateSignature(sourceLines: string[]): string {
    const templateLine = sourceLines.find((line) => line.includes("template"));

    if (!templateLine) {
      return sourceLines[0]?.trim() || "";
    }

    // Include template parameters and following declaration
    let signature = templateLine.trim();
    const templateIndex = sourceLines.indexOf(templateLine);

    if (templateIndex < sourceLines.length - 1) {
      const nextLine = sourceLines[templateIndex + 1];
      if (nextLine && !nextLine.includes("{")) {
        signature += " " + nextLine.trim();
      }
    }

    return signature.replace(/\s*\{.*$/, "").trim();
  }

  private extractEnumSignature(sourceLines: string[]): string {
    const enumLine = sourceLines.find((line) => line.includes("enum"));

    if (!enumLine) {
      return sourceLines[0]?.trim() || "";
    }

    return enumLine
      .replace(/\s*\{.*$/, "")
      .replace(/\s*;.*$/, "")
      .trim();
  }

  private extractTypedefSignature(sourceLines: string[]): string {
    const typedefLine = sourceLines.find((line) => line.includes("typedef"));

    if (!typedefLine) {
      return sourceLines[0]?.trim() || "";
    }

    return typedefLine.replace(/\s*;.*$/, "").trim();
  }

  private extractUsingSignature(sourceLines: string[]): string {
    const usingLine = sourceLines.find((line) => line.includes("using"));

    if (!usingLine) {
      return sourceLines[0]?.trim() || "";
    }

    return usingLine.replace(/\s*;.*$/, "").trim();
  }

  private extractMacroSignature(sourceLines: string[]): string {
    const macroLine = sourceLines.find((line) =>
      line.trim().startsWith("#define"),
    );

    if (!macroLine) {
      return sourceLines[0]?.trim() || "";
    }

    return macroLine.trim();
  }

  private parseCppParameters(
    paramLine: string,
    sourceLines: string[],
  ): Parameter[] {
    const parameters: Parameter[] = [];

    // Extract full parameter list, potentially spanning multiple lines
    let fullParamString = paramLine;

    if (!paramLine.includes(")")) {
      const paramStart = sourceLines.indexOf(paramLine);
      for (let i = paramStart + 1; i < sourceLines.length; i++) {
        fullParamString += " " + sourceLines[i]?.trim();
        if (sourceLines[i]?.includes(")")) {
          break;
        }
      }
    }

    // Extract parameter list from parentheses
    const paramMatch = fullParamString.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1]?.trim()) {
      return parameters;
    }

    const paramStr = paramMatch[1].trim();

    // Handle void parameters
    if (paramStr === "void" || paramStr === "") {
      return parameters;
    }

    // Split parameters by comma (handling templates and function pointers)
    const parts = this.splitCppParameters(paramStr);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) {
        continue;
      }

      const param = this.parseCppParameter(trimmed);
      if (param) {
        parameters.push(param);
      }
    }

    return parameters;
  }

  private splitCppParameters(paramStr: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;
    let inAngles = 0;

    for (let i = 0; i < paramStr.length; i++) {
      const char = paramStr[i];

      if (char === "<") {
        inAngles++;
      } else if (char === ">") {
        inAngles--;
      } else if (char === "(" || char === "[") {
        depth++;
      } else if (char === ")" || char === "]") {
        depth--;
      } else if (char === "," && depth === 0 && inAngles === 0) {
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

  private parseCppParameter(paramStr: string): Parameter | null {
    // Handle various C++ parameter patterns
    const trimmed = paramStr.trim();

    // Match patterns like: type name, type* name, type& name, type name[size], etc.
    const patterns = [
      // const type& name = default
      /^(?:const\s+)?(.+?)\s*[&*]*\s+(\w+)(?:\s*=\s*.+)?$/,
      // type name = default
      /^(.+?)\s+(\w+)(?:\s*=\s*.+)?$/,
      // Just type (unnamed parameter)
      /^(.+?)(?:\s*[&*]+)?$/,
    ];

    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const type = match[1]?.trim();
        const name = match[2]?.trim() || "unnamed";

        if (type) {
          return {
            name,
            type,
            optional: trimmed.includes("="),
          };
        }
      }
    }

    return null;
  }

  private extractCppReturnType(functionLine: string): string | null {
    // Match return type before function name pattern
    const match = functionLine.match(
      /^(?:(?:static|virtual|inline|extern|friend|explicit)\s+)*(.+?)\s+\w+\s*\(/,
    );

    if (match) {
      const returnType = match[1]?.trim();
      if (returnType && returnType !== "void") {
        return returnType;
      }
    }

    return null;
  }
}
