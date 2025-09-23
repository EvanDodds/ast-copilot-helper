import type {
  DistributionConfig,
  ValidationResult,
  VerificationResult
} from './types.js';
import { NPMPublisher } from './npm-publisher.js';
// import { VSCodeMarketplacePublisher } from './vscode-marketplace-publisher.js';
import { GitHubReleaseManager } from './github-release-manager.js';
import { BinaryDistributor } from './binary-distributor.js';
import { AutoUpdateManager } from './auto-update-manager.js';

/**
 * Publisher interface that all distribution channels must implement
 */
export interface Publisher {
  initialize(config: DistributionConfig): Promise<void>;
  validate(): Promise<ValidationResult>;
  publish(): Promise<any>;
  verify(result: any): Promise<VerificationResult>;
  cleanup(): Promise<void>;
}

/**
 * Distribution orchestration results
 */
export interface DistributionResult {
  success: boolean;
  error?: string;
  results?: Record<string, any>;
  duration?: number;
}

export interface ValidationResults {
  success: boolean;
  results?: Record<string, ValidationResult>;
}

export interface VerificationResults {
  success: boolean;
  results?: Record<string, VerificationResult>;
}

/**
 * Orchestrator for managing multiple distribution channels
 */
export class DistributionOrchestrator {
  private config!: DistributionConfig;
  private publishers: Map<string, Publisher> = new Map();

  async initialize(config: DistributionConfig): Promise<void> {
    this.config = config;
    
    // Initialize all publishers
    const npmPublisher = new NPMPublisher();
    await npmPublisher.initialize(config);
    this.publishers.set('npm', npmPublisher);
    
    // TODO: Uncomment when VS Code marketplace publisher is implemented
    // const vsCodePublisher = new VSCodeMarketplacePublisher();
    // await vsCodePublisher.initialize(config);
    // this.publishers.set('marketplace', vsCodePublisher);
    
    const githubPublisher = new GitHubReleaseManager();
    await githubPublisher.initialize(config);
    this.publishers.set('github', githubPublisher);
    
    const binaryDistributor = new BinaryDistributor();
    await binaryDistributor.initialize(config);
    this.publishers.set('binary', binaryDistributor);
    
    const autoUpdateManager = new AutoUpdateManager();
    await autoUpdateManager.initialize(config);
    this.publishers.set('auto-update', autoUpdateManager);
  }

  /**
   * Validate all publishers
   */
  async validateAll(): Promise<ValidationResults> {
    const results: Record<string, ValidationResult> = {};
    let allSuccess = true;

    for (const [name, publisher] of this.publishers) {
      try {
        const result = await publisher.validate();
        results[name] = result;
        if (!result.success) {
          allSuccess = false;
        }
      } catch (error: any) {
        results[name] = {
          success: false,
          errors: [{
            code: 'VALIDATION_ERROR',
            message: error.message,
            field: name,
            severity: 'error'
          }],
          warnings: []
        };
        allSuccess = false;
      }
    }

    return {
      success: allSuccess,
      results
    };
  }

  /**
   * Validate a specific publisher
   */
  async validate(publisherName: string): Promise<ValidationResult> {
    const publisher = this.publishers.get(publisherName);
    if (!publisher) {
      return {
        success: false,
        errors: [{
          code: 'PUBLISHER_NOT_FOUND',
          message: `Publisher '${publisherName}' not found`,
          field: 'publisher',
          severity: 'error'
        }],
        warnings: []
      };
    }

    return await publisher.validate();
  }

  /**
   * Distribute to all channels
   */
  async distributeAll(options: { parallel?: boolean; continueOnError?: boolean } = {}): Promise<DistributionResult> {
    const startTime = Date.now();
    const results: Record<string, any> = {};
    let allSuccess = true;

    if (options.parallel) {
      // Run all distributions in parallel
      const promises = Array.from(this.publishers.entries()).map(async ([name, publisher]) => {
        try {
          const result = await publisher.publish();
          results[name] = result;
          return { name, success: result.success || true };
        } catch (error: any) {
          results[name] = { success: false, error: error.message };
          return { name, success: false };
        }
      });

      const outcomes = await Promise.allSettled(promises);
      allSuccess = outcomes.every(outcome => 
        outcome.status === 'fulfilled' && outcome.value.success
      );
    } else {
      // Run distributions sequentially
      for (const [name, publisher] of this.publishers) {
        try {
          const result = await publisher.publish();
          results[name] = result;
          if (!result.success && result.success !== undefined) {
            allSuccess = false;
            if (!options.continueOnError) {
              break;
            }
          }
        } catch (error: any) {
          results[name] = { success: false, error: error.message };
          allSuccess = false;
          if (!options.continueOnError) {
            break;
          }
        }
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: allSuccess,
      results,
      duration
    };
  }

  /**
   * Distribute to a specific channel
   */
  async distribute(publisherName: string): Promise<any> {
    const publisher = this.publishers.get(publisherName);
    if (!publisher) {
      return {
        success: false,
        error: `Publisher '${publisherName}' not found`
      };
    }

    const startTime = Date.now();
    try {
      const result = await publisher.publish();
      return {
        ...result,
        duration: Date.now() - startTime
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Verify all distributions
   */
  async verifyAll(): Promise<VerificationResults> {
    const results: Record<string, VerificationResult> = {};
    let allSuccess = true;

    for (const [name, publisher] of this.publishers) {
      try {
        // We need some result to verify, for now pass empty object
        const result = await publisher.verify({});
        results[name] = result;
        if (!result.success) {
          allSuccess = false;
        }
      } catch (error: any) {
        results[name] = {
          success: false,
          checks: [{
            name: 'verification-error',
            success: false,
            message: error.message
          }],
          duration: 0
        };
        allSuccess = false;
      }
    }

    return {
      success: allSuccess,
      results
    };
  }

  /**
   * Verify a specific distribution
   */
  async verify(publisherName: string, publishResult: any): Promise<VerificationResult> {
    const publisher = this.publishers.get(publisherName);
    if (!publisher) {
      return {
        success: false,
        checks: [{
          name: 'publisher-not-found',
          success: false,
          message: `Publisher '${publisherName}' not found`
        }],
        duration: 0
      };
    }

    return await publisher.verify(publishResult);
  }

  /**
   * Cleanup all publishers
   */
  async cleanup(): Promise<void> {
    for (const [name, publisher] of this.publishers) {
      try {
        await publisher.cleanup();
      } catch (error) {
        console.error(`Cleanup failed for ${name}:`, error);
      }
    }
  }

  /**
   * Generate distribution report
   */
  async generateReport(options: {
    channel?: string;
    version?: string;
    format?: 'json' | 'html';
  } = {}): Promise<any> {
    const report = {
      timestamp: new Date().toISOString(),
      version: options.version || this.config.version,
      channels: {} as Record<string, any>
    };

    // If specific channel requested
    if (options.channel) {
      const publisher = this.publishers.get(options.channel);
      if (publisher) {
        // Generate channel-specific report
        report.channels[options.channel] = {
          status: 'available',
          lastUpdated: new Date().toISOString()
        };
      }
    } else {
      // Generate report for all channels
      for (const [name] of this.publishers) {
        report.channels[name] = {
          status: 'available',
          lastUpdated: new Date().toISOString()
        };
      }
    }

    return report;
  }

  /**
   * Generate HTML verification report
   */
  async generateVerificationReport(): Promise<string> {
    const verificationResults = await this.verifyAll();
    
    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Distribution Verification Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
    .channel { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
    .success { border-left: 5px solid #28a745; }
    .failure { border-left: 5px solid #dc3545; }
    .check { margin: 10px 0; padding: 10px; background: #f8f9fa; }
    .check.success { border-left: 3px solid #28a745; }
    .check.failure { border-left: 3px solid #dc3545; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Distribution Verification Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <p>Version: ${this.config.version}</p>
    <p>Overall Status: ${verificationResults.success ? '✅ All Verified' : '❌ Some Failed'}</p>
  </div>
`;

    if (verificationResults.results) {
      for (const [channel, result] of Object.entries(verificationResults.results)) {
        const statusClass = result.success ? 'success' : 'failure';
        const statusIcon = result.success ? '✅' : '❌';
        
        html += `
  <div class="channel ${statusClass}">
    <h2>${statusIcon} ${channel}</h2>
    <p>Status: ${result.success ? 'Verified' : 'Failed'}</p>
    <p>Duration: ${result.duration}ms</p>
`;
        
        if (result.checks) {
          html += '<h3>Checks:</h3>';
          for (const check of result.checks) {
            const checkClass = check.success ? 'success' : 'failure';
            const checkIcon = check.success ? '✅' : '❌';
            html += `
    <div class="check ${checkClass}">
      <strong>${checkIcon} ${check.name}</strong><br>
      ${check.message}
    </div>`;
          }
        }
        
        html += '</div>';
      }
    }

    html += `
</body>
</html>`;

    return html;
  }
}