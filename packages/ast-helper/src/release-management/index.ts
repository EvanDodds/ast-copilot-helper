/**
 * Release Management System - Main Export
 *
 * @fileoverview Main entry point for the comprehensive release management system
 * with all core components and interfaces.
 *
 * @author GitHub Copilot
 * @version 1.0.0
 */

// Core manager
export { ComprehensiveReleaseManager } from "./manager.js";

// Interfaces
export * from "./interfaces.js";

// Types
export * from "./types.js";

// Core implementations
export { VersionManagerImpl } from "./core/version-manager.js";
export { ChangelogGeneratorImpl } from "./core/changelog-generator.js";
export { CompatibilityCheckerImpl } from "./core/compatibility-checker.js";
export { PlatformPublisherImpl } from "./core/platform-publisher.js";
export { RollbackManagerImpl } from "./core/rollback-manager.js";
