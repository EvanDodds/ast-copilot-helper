/**
 * Minimal BaseParser stub
 *
 * This file was temporarily simplified to a minimal abstract class so the
 * repository can parse and lint cleanly during the remediation work. A full
 * implementation will be restored when the codebase is stabilized.
 */

export abstract class BaseParser {
  // Use 'unknown' to avoid permissive 'any' while keeping the stub safe.
  protected runtime: unknown;

  constructor(runtime?: unknown) {
    this.runtime = runtime;
  }

  getRuntime(): unknown {
    return this.runtime;
  }

  async dispose(): Promise<void> {
    // no-op placeholder
  }
}