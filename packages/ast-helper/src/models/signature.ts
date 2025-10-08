/**
 * Model Signature Verification System
 *
 * Provides digital signature verification for downloaded AI models
 * to ensure authenticity and prevent tampering.
 *
 * Implements Issue #158 acceptance criteria:
 * - Digital signature verification
 * - Public key management
 * - Security audit trail
 */

import { promises as fs } from "fs";
import { join } from "path";
import { createVerify } from "crypto";
import type { ModelConfig } from "./types.js";
import { createModuleLogger } from "../logging/index.js";

const logger = createModuleLogger("SignatureVerification");

/**
 * Signature verification result
 */
export interface SignatureVerificationResult {
  verified: boolean;
  errors: string[];
  signatureMethod?: string;
  publicKeyId?: string;
}

/**
 * Model signature metadata
 */
export interface ModelSignature {
  signature: string;
  algorithm: string;
  publicKeyId: string;
  signedAt: string;
}

/**
 * Public key for verification
 */
export interface PublicKey {
  id: string;
  algorithm: string;
  key: string;
  issuer: string;
  validFrom: Date;
  validUntil?: Date;
}

/**
 * Signature Verifier
 *
 * Handles digital signature verification for model files
 */
export class SignatureVerifier {
  private publicKeysDir: string;
  private publicKeys: Map<string, PublicKey> = new Map();

  constructor(baseDir = ".astdb/models/keys") {
    this.publicKeysDir = baseDir;
  }

  /**
   * Initialize the signature verifier
   */
  async initialize(): Promise<void> {
    try {
      // Ensure keys directory exists
      await fs.mkdir(this.publicKeysDir, { recursive: true });

      // Load existing public keys
      await this.loadPublicKeys();

      logger.info("Signature verifier initialized", {
        keysLoaded: this.publicKeys.size,
      });
    } catch (error) {
      logger.error("Failed to initialize signature verifier", { error });
      throw error;
    }
  }

  /**
   * Verify model file signature
   */
  async verifySignature(
    filePath: string,
    signature: ModelSignature,
  ): Promise<SignatureVerificationResult> {
    try {
      // Get public key
      const publicKey = this.publicKeys.get(signature.publicKeyId);
      if (!publicKey) {
        return {
          verified: false,
          errors: [`Public key not found: ${signature.publicKeyId}`],
        };
      }

      // Check if key is still valid
      const now = new Date();
      if (now < publicKey.validFrom) {
        return {
          verified: false,
          errors: [`Public key not yet valid: ${signature.publicKeyId}`],
        };
      }

      if (publicKey.validUntil && now > publicKey.validUntil) {
        return {
          verified: false,
          errors: [`Public key expired: ${signature.publicKeyId}`],
        };
      }

      // Read file content
      const fileContent = await fs.readFile(filePath);

      // Verify signature
      const verifier = createVerify(signature.algorithm);
      verifier.update(fileContent);
      verifier.end();

      const isValid = verifier.verify(
        publicKey.key,
        signature.signature,
        "base64",
      );

      if (isValid) {
        logger.info("Signature verification successful", {
          file: filePath,
          keyId: signature.publicKeyId,
        });

        return {
          verified: true,
          errors: [],
          signatureMethod: signature.algorithm,
          publicKeyId: signature.publicKeyId,
        };
      }

      logger.warn("Signature verification failed", {
        file: filePath,
        keyId: signature.publicKeyId,
      });

      return {
        verified: false,
        errors: ["Digital signature verification failed"],
        signatureMethod: signature.algorithm,
        publicKeyId: signature.publicKeyId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Signature verification error", { error: errorMessage });

      return {
        verified: false,
        errors: [`Verification error: ${errorMessage}`],
      };
    }
  }

  /**
   * Add a public key
   */
  async addPublicKey(key: PublicKey): Promise<void> {
    // Validate key format
    if (!key.key.includes("BEGIN PUBLIC KEY")) {
      throw new Error("Invalid public key format. Expected PEM format.");
    }

    // Store in memory
    this.publicKeys.set(key.id, key);

    // Persist to disk
    const keyPath = join(this.publicKeysDir, `${key.id}.json`);
    await fs.writeFile(
      keyPath,
      JSON.stringify(
        {
          id: key.id,
          algorithm: key.algorithm,
          key: key.key,
          issuer: key.issuer,
          validFrom: key.validFrom.toISOString(),
          validUntil: key.validUntil?.toISOString(),
        },
        null,
        2,
      ),
      "utf-8",
    );

    logger.info("Public key added", { keyId: key.id, issuer: key.issuer });
  }

  /**
   * Remove a public key
   */
  async removePublicKey(keyId: string): Promise<void> {
    this.publicKeys.delete(keyId);

    const keyPath = join(this.publicKeysDir, `${keyId}.json`);
    try {
      await fs.unlink(keyPath);
      logger.info("Public key removed", { keyId });
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  /**
   * List all public keys
   */
  getPublicKeys(): PublicKey[] {
    return Array.from(this.publicKeys.values());
  }

  /**
   * Get public key by ID
   */
  getPublicKey(keyId: string): PublicKey | undefined {
    return this.publicKeys.get(keyId);
  }

  /**
   * Load public keys from disk
   */
  private async loadPublicKeys(): Promise<void> {
    try {
      const files = await fs.readdir(this.publicKeysDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(
            join(this.publicKeysDir, file),
            "utf-8",
          );
          const keyData = JSON.parse(content);

          const key: PublicKey = {
            id: keyData.id,
            algorithm: keyData.algorithm,
            key: keyData.key,
            issuer: keyData.issuer,
            validFrom: new Date(keyData.validFrom),
            validUntil: keyData.validUntil
              ? new Date(keyData.validUntil)
              : undefined,
          };

          this.publicKeys.set(key.id, key);
        } catch (error) {
          logger.warn("Failed to load public key", { file, error });
        }
      }

      logger.info("Public keys loaded", { count: this.publicKeys.size });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Directory doesn't exist yet, that's fine
        return;
      }
      throw error;
    }
  }
}

/**
 * Default signature verifier instance
 */
export const signatureVerifier = new SignatureVerifier();

/**
 * Extended model configuration with signature
 */
export interface SignedModelConfig extends ModelConfig {
  signature?: ModelSignature;
  requireSignature?: boolean;
}
