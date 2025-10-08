/**
 * Model Download Security Hooks
 *
 * Provides pre/post download verification hooks for model security checks.
 *
 * Implements Issue #158 acceptance criteria:
 * - Pre-download verification hooks
 * - Post-download verification hooks
 * - Security event logging
 */

import { FileVerifier } from "./verification.js";
import { signatureVerifier, type SignedModelConfig } from "./signature.js";
import { createModuleLogger } from "../logging/index.js";

const logger = createModuleLogger("SecurityHooks");

/**
 * Hook execution context
 */
export interface HookContext {
  modelConfig: SignedModelConfig;
  filePath?: string;
  timestamp: Date;
  userId?: string;
}

/**
 * Hook result
 */
export interface HookResult {
  allowed: boolean;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Security hook function type
 */
export type SecurityHook = (context: HookContext) => Promise<HookResult>;

/**
 * Hook types
 */
export enum HookType {
  PRE_DOWNLOAD = "pre_download",
  POST_DOWNLOAD = "post_download",
  PRE_VERIFICATION = "pre_verification",
  POST_VERIFICATION = "post_verification",
}

/**
 * Security Hooks Manager
 *
 * Manages and executes security hooks for model downloads
 */
export class SecurityHooksManager {
  private hooks: Map<HookType, SecurityHook[]> = new Map();
  private fileVerifier: FileVerifier;

  constructor(fileVerifier?: FileVerifier) {
    this.fileVerifier = fileVerifier || new FileVerifier();

    // Register default hooks
    this.registerDefaultHooks();
  }

  /**
   * Register a security hook
   */
  registerHook(type: HookType, hook: SecurityHook): void {
    const hooks = this.hooks.get(type) || [];
    hooks.push(hook);
    this.hooks.set(type, hooks);

    logger.debug("Security hook registered", {
      type,
      totalHooks: hooks.length,
    });
  }

  /**
   * Unregister a security hook
   */
  unregisterHook(type: HookType, hook: SecurityHook): void {
    const hooks = this.hooks.get(type);
    if (hooks) {
      const index = hooks.indexOf(hook);
      if (index !== -1) {
        hooks.splice(index, 1);
        logger.debug("Security hook unregistered", { type });
      }
    }
  }

  /**
   * Execute pre-download hooks
   */
  async executePreDownloadHooks(
    modelConfig: SignedModelConfig,
    userId?: string,
  ): Promise<HookResult> {
    const context: HookContext = {
      modelConfig,
      timestamp: new Date(),
      userId,
    };

    return this.executeHooks(HookType.PRE_DOWNLOAD, context);
  }

  /**
   * Execute post-download hooks
   */
  async executePostDownloadHooks(
    modelConfig: SignedModelConfig,
    filePath: string,
    userId?: string,
  ): Promise<HookResult> {
    const context: HookContext = {
      modelConfig,
      filePath,
      timestamp: new Date(),
      userId,
    };

    return this.executeHooks(HookType.POST_DOWNLOAD, context);
  }

  /**
   * Execute hooks of a specific type
   */
  private async executeHooks(
    type: HookType,
    context: HookContext,
  ): Promise<HookResult> {
    const hooks = this.hooks.get(type) || [];

    if (hooks.length === 0) {
      return {
        allowed: true,
        errors: [],
        warnings: [],
      };
    }

    const results: HookResult[] = [];

    for (const hook of hooks) {
      try {
        const result = await hook(context);
        results.push(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Hook execution failed", { type, error: errorMessage });

        results.push({
          allowed: false,
          errors: [`Hook execution error: ${errorMessage}`],
          warnings: [],
        });
      }
    }

    // Aggregate results
    const aggregated = this.aggregateResults(results);

    logger.info("Security hooks executed", {
      type,
      hookCount: hooks.length,
      allowed: aggregated.allowed,
      errors: aggregated.errors.length,
      warnings: aggregated.warnings.length,
    });

    return aggregated;
  }

  /**
   * Aggregate multiple hook results
   */
  private aggregateResults(results: HookResult[]): HookResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let allowed = true;

    for (const result of results) {
      if (!result.allowed) {
        allowed = false;
      }
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    return {
      allowed,
      errors,
      warnings,
    };
  }

  /**
   * Register default security hooks
   */
  private registerDefaultHooks(): void {
    // Pre-download: Check HTTPS URL
    this.registerHook(HookType.PRE_DOWNLOAD, async (context) => {
      const url = context.modelConfig.url;

      if (!url.startsWith("https://")) {
        return {
          allowed: false,
          errors: ["Model URL must use HTTPS protocol"],
          warnings: [],
        };
      }

      return {
        allowed: true,
        errors: [],
        warnings: [],
      };
    });

    // Pre-download: Check model metadata
    this.registerHook(HookType.PRE_DOWNLOAD, async (context) => {
      const config = context.modelConfig;
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!config.checksum) {
        errors.push("Model configuration missing checksum");
      }

      if (config.checksum && config.checksum.length !== 64) {
        errors.push("Invalid SHA256 checksum format");
      }

      if (!config.size || config.size <= 0) {
        errors.push("Invalid model file size");
      }

      if (config.requireSignature && !config.signature) {
        errors.push("Model requires signature but none provided");
      }

      return {
        allowed: errors.length === 0,
        errors,
        warnings,
      };
    });

    // Post-download: Verify file integrity
    this.registerHook(HookType.POST_DOWNLOAD, async (context) => {
      if (!context.filePath) {
        return {
          allowed: false,
          errors: ["File path not provided"],
          warnings: [],
        };
      }

      const result = await this.fileVerifier.verifyModelFile(
        context.filePath,
        context.modelConfig,
      );

      return {
        allowed: result.valid,
        errors: result.errors,
        warnings: result.warnings,
      };
    });

    // Post-download: Verify signature if present
    this.registerHook(HookType.POST_DOWNLOAD, async (context) => {
      if (!context.filePath) {
        return {
          allowed: false,
          errors: ["File path not provided for signature verification"],
          warnings: [],
        };
      }

      const config = context.modelConfig;

      // Skip if no signature
      if (!config.signature) {
        if (config.requireSignature) {
          return {
            allowed: false,
            errors: ["Signature required but not provided"],
            warnings: [],
          };
        }

        return {
          allowed: true,
          errors: [],
          warnings: ["No digital signature provided"],
        };
      }

      // Verify signature
      const result = await signatureVerifier.verifySignature(
        context.filePath,
        config.signature,
      );

      return {
        allowed: result.verified,
        errors: result.errors,
        warnings: [],
      };
    });

    logger.info("Default security hooks registered");
  }
}

/**
 * Default security hooks manager instance
 */
export const securityHooks = new SecurityHooksManager();
