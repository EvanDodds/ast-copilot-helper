/**
 * @file Privacy-Respecting Consent Manager
 * @description Comprehensive consent management system with privacy-first approach
 */

import { randomUUID } from 'crypto';
import { ConsentManager as IConsentManager, ConsentStatus, TelemetryConfig, TelemetrySettings } from '../types.js';
import { 
  ConsentRecord, 
  ConsentStorage, 
  ConsentValidationResult, 
  ConsentFeature, 
  ConsentRenewalReason, 
  ConsentMigrationResult, 
  ConsentCollectionOptions,
  PRIVACY_LEVELS
} from './types.js';
import { FileConsentStorage } from './storage.js';

/**
 * Privacy-respecting consent manager implementation
 */
export class PrivacyRespectingConsentManager implements IConsentManager {
  private isInitialized: boolean = false;
  private currentConsent: ConsentRecord | null = null;
  private readonly consentVersion: string;
  private readonly appVersion: string;

  constructor(
    _config: TelemetryConfig,
    consentVersion: string = '1.0.0',
    _minVersion: string = '1.0.0',
    private storage: ConsentStorage = new FileConsentStorage()
  ) {
    this.consentVersion = consentVersion;
    this.appVersion = consentVersion; // Use consent version as app version for now
  }

  /**
   * Initialize the consent manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('ConsentManager is already initialized');
    }

    try {
      // Check if storage is available
      const isAvailable = await this.storage.isAvailable();
      if (!isAvailable) {
        console.warn('Consent storage not available - running in privacy mode');
      }

      // Load existing consent
      this.currentConsent = await this.storage.loadConsent();

      // Validate and migrate consent if needed
      if (this.currentConsent) {
        const validation = await this.validateConsent(this.currentConsent);
        if (!validation.isValid || validation.needsRenewal) {
          console.log(`Consent needs renewal: ${validation.renewalReason}`);
          // In a real implementation, this would trigger consent re-collection
          this.currentConsent = null;
        } else {
          // Attempt migration if version differs
          const migration = await this.migrateConsent(this.currentConsent);
          if (migration.requiresReConsent) {
            console.log('Consent migration requires user re-consent');
            this.currentConsent = null;
          } else if (migration.success && migration.migratedConsent) {
            this.currentConsent = migration.migratedConsent;
            await this.storage.saveConsent(this.currentConsent);
          }
        }
      }

      this.isInitialized = true;
      console.log('ConsentManager initialized successfully');
    } catch (error: any) {
      console.error('Failed to initialize ConsentManager:', error.message);
      // Continue in privacy mode
      this.currentConsent = null;
      this.isInitialized = true;
    }
  }

  /**
   * Get current consent status
   */
  async getConsentStatus(): Promise<ConsentStatus> {
    if (!this.isInitialized) {
      throw new Error('ConsentManager not initialized');
    }

    if (!this.currentConsent) {
      return {
        hasConsent: false,
        enabled: false,
        consentVersion: this.consentVersion,
        settings: this.getDefaultSettings()
      };
    }

    return {
      hasConsent: true,
      enabled: this.currentConsent.enabled,
      consentVersion: this.currentConsent.consentVersion,
      settings: this.consentToSettings(this.currentConsent),
      consentDate: this.currentConsent.timestamp,
      privacyLevel: this.currentConsent.privacyLevel,
      allowedFeatures: this.currentConsent.allowedFeatures
    };
  }

  /**
   * Set user consent
   */
  async setConsent(enabled: boolean, version: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ConsentManager not initialized');
    }

    const consent: ConsentRecord = {
      id: randomUUID(),
      timestamp: new Date(),
      consentVersion: version,
      appVersion: this.appVersion,
      enabled,
      privacyLevel: enabled ? PRIVACY_LEVELS.BALANCED : PRIVACY_LEVELS.STRICT,
      allowedFeatures: enabled ? this.getDefaultAllowedFeatures() : [],
      dataRetentionDays: enabled ? 90 : 0,
      shareAnonymousStats: enabled,
      shareErrorReports: enabled,
      sharePerformanceMetrics: enabled
    };

    this.currentConsent = consent;
    
    try {
      await this.storage.saveConsent(consent);
      console.log(`Consent ${enabled ? 'granted' : 'revoked'} successfully`);
    } catch (error: any) {
      console.error('Failed to save consent:', error.message);
      // Continue with in-memory consent
    }
  }

  /**
   * Save telemetry settings
   */
  async saveSettings(settings: TelemetrySettings): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ConsentManager not initialized');
    }

    if (!this.currentConsent) {
      // Create new consent from settings
      const consentGiven = settings.consentGiven ?? false;
      await this.setConsent(consentGiven, this.consentVersion);
    }

    if (this.currentConsent) {
      // Update existing consent with new settings
      const updatedConsent: ConsentRecord = {
        ...this.currentConsent,
        id: randomUUID(), // New ID for updated consent
        timestamp: new Date(),
        privacyLevel: settings.privacyLevel ?? this.currentConsent.privacyLevel,
        allowedFeatures: (settings.allowedFeatures as ConsentFeature[]) ?? this.currentConsent.allowedFeatures,
        dataRetentionDays: settings.dataRetentionDays ?? this.currentConsent.dataRetentionDays,
        enabled: settings.consentGiven ?? this.currentConsent.enabled
      };

      this.currentConsent = updatedConsent;
      
      try {
        await this.storage.saveConsent(updatedConsent);
        console.log('Telemetry settings updated successfully');
      } catch (error: any) {
        console.error('Failed to save settings:', error.message);
      }
    }
  }

  /**
   * Get current telemetry settings
   */
  async getSettings(): Promise<TelemetrySettings> {
    const status = await this.getConsentStatus();
    return status.settings;
  }

  /**
   * Collect consent with options
   */
  async collectConsent(options: ConsentCollectionOptions): Promise<ConsentRecord> {
    // In a real implementation, this would show UI to collect user consent
    // For now, we'll create a consent record with the provided options
    
    const consent: ConsentRecord = {
      id: randomUUID(),
      timestamp: new Date(),
      consentVersion: this.consentVersion,
      appVersion: this.appVersion,
      enabled: true, // Default to enabled for collection
      privacyLevel: options.defaultPrivacyLevel,
      allowedFeatures: options.preSelectedFeatures || this.getDefaultAllowedFeatures(),
      dataRetentionDays: 90,
      shareAnonymousStats: true,
      shareErrorReports: true,
      sharePerformanceMetrics: true
    };

    this.currentConsent = consent;
    await this.storage.saveConsent(consent);
    
    return consent;
  }

  /**
   * Validate consent record
   */
  private async validateConsent(consent: ConsentRecord): Promise<ConsentValidationResult> {
    const errors: string[] = [];
    let needsRenewal = false;
    let renewalReason: string | undefined;
    let daysUntilExpiry: number | undefined;

    // Check consent version
    if (consent.consentVersion !== this.consentVersion) {
      needsRenewal = true;
      renewalReason = ConsentRenewalReason.VERSION_CHANGE;
    }

    // Check app version compatibility (major version changes require renewal)
    const currentMajor = this.appVersion.split('.')[0];
    const consentMajor = consent.appVersion.split('.')[0];
    if (currentMajor !== consentMajor) {
      needsRenewal = true;
      renewalReason = ConsentRenewalReason.VERSION_CHANGE;
    }

    // Check expiry (consent valid for 1 year)
    const now = new Date();
    const consentAge = now.getTime() - consent.timestamp.getTime();
    const daysSinceConsent = Math.floor(consentAge / (1000 * 60 * 60 * 24));
    const maxDays = 365; // 1 year
    
    if (daysSinceConsent > maxDays) {
      needsRenewal = true;
      renewalReason = ConsentRenewalReason.EXPIRED;
    } else {
      daysUntilExpiry = maxDays - daysSinceConsent;
    }

    // Validate required fields
    if (!consent.id) errors.push('Missing consent ID');
    if (!consent.consentVersion) errors.push('Missing consent version');
    if (!consent.appVersion) errors.push('Missing app version');

    return {
      isValid: errors.length === 0,
      errors,
      needsRenewal,
      renewalReason,
      daysUntilExpiry
    };
  }

  /**
   * Migrate consent between versions
   */
  private async migrateConsent(consent: ConsentRecord): Promise<ConsentMigrationResult> {
    const warnings: string[] = [];
    let requiresReConsent = false;

    try {
      // If same version, no migration needed
      if (consent.consentVersion === this.consentVersion) {
        return {
          success: true,
          migratedConsent: consent,
          warnings: [],
          requiresReConsent: false
        };
      }

      // Create migrated consent
      const migratedConsent: ConsentRecord = {
        ...consent,
        consentVersion: this.consentVersion,
        appVersion: this.appVersion
      };

      // Version-specific migrations would go here
      // For now, we'll just update the versions
      
      warnings.push(`Migrated consent from version ${consent.consentVersion} to ${this.consentVersion}`);

      return {
        success: true,
        migratedConsent,
        warnings,
        requiresReConsent
      };
    } catch (error: any) {
      return {
        success: false,
        warnings: [`Migration failed: ${error.message}`],
        requiresReConsent: true
      };
    }
  }

  /**
   * Get default allowed features based on privacy level
   */
  private getDefaultAllowedFeatures(): ConsentFeature[] {
    return [
      ConsentFeature.USAGE_ANALYTICS,
      ConsentFeature.ERROR_REPORTING,
      ConsentFeature.FEATURE_USAGE
    ];
  }

  /**
   * Convert consent record to telemetry settings
   */
  private consentToSettings(consent: ConsentRecord): TelemetrySettings {
    return {
      consentGiven: consent.enabled,
      privacyLevel: consent.privacyLevel,
      dataRetentionDays: consent.dataRetentionDays,
      allowedFeatures: consent.allowedFeatures
    };
  }

  /**
   * Get default settings for no consent
   */
  private getDefaultSettings(): TelemetrySettings {
    return {
      consentGiven: false,
      privacyLevel: PRIVACY_LEVELS.STRICT,
      dataRetentionDays: 0,
      allowedFeatures: []
    };
  }

  /**
   * Get consent history
   */
  async getConsentHistory(): Promise<ConsentRecord[]> {
    if (!this.isInitialized) {
      throw new Error('ConsentManager not initialized');
    }

    try {
      return await this.storage.getConsentHistory();
    } catch (error: any) {
      console.error('Failed to get consent history:', error.message);
      return [];
    }
  }

  /**
   * Clear all consent data
   */
  async clearAllData(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ConsentManager not initialized');
    }

    try {
      await this.storage.clearConsent();
      this.currentConsent = null;
      console.log('All consent data cleared');
    } catch (error: any) {
      console.error('Failed to clear consent data:', error.message);
      throw error;
    }
  }

  /**
   * Export consent data for user transparency
   */
  async exportConsentData(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('ConsentManager not initialized');
    }

    const history = await this.getConsentHistory();
    
    return {
      current: this.currentConsent,
      history,
      exportDate: new Date().toISOString(),
      version: this.consentVersion
    };
  }

  /**
   * Shutdown consent manager
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      console.log('ConsentManager shutdown completed');
      this.isInitialized = false;
    }
  }
}