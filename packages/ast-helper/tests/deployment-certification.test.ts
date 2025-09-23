/**
 * @fileoverview Deployment Certification Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DeploymentCertificationManager } from '../src/deployment-certification/manager.js';
import { DeploymentCertificationConfigManager } from '../src/deployment-certification/config.js';
import type { DeploymentCertificationConfig, DeploymentEnvironment, CertificationLevel } from '../src/deployment-certification/types.js';

describe('Deployment Certification Framework', () => {
  let manager: DeploymentCertificationManager;

  beforeEach(() => {
    const config: Partial<DeploymentCertificationConfig> = {
      environment: 'staging',
      priority: 'high',
      certificationLevel: 'standard',
      timeout: 30000,
      parallel: true,
      buildVerification: {
        enabled: true,
        timeout: 10000,
        stages: {
          compile: true,
          test: true,
          lint: true,
          bundle: false,
          analyze: false
        },
        thresholds: {
          testCoverage: 80,
          bundleSize: 10485760,
          buildTime: 180000,
          errorThreshold: 0
        },
        quality: {
          codeQuality: true,
          securityScan: false,
          dependencyCheck: true,
          licenseCheck: false
        }
      },
      healthChecks: {
        enabled: true,
        timeout: 5000,
        endpoints: [
          {
            name: 'health',
            url: '/health',
            method: 'GET',
            expectedStatus: [200],
            timeout: 1000,
            retries: 1
          }
        ],
        services: {
          database: false,
          cache: false,
          messageQueue: false,
          externalApis: false
        },
        thresholds: {
          responseTime: 1000,
          errorRate: 5,
          availability: 99
        }
      },
      productionApproval: {
        enabled: false,
        timeout: 10000,
        approvers: {
          required: 1,
          roles: ['tech-lead'],
          teams: ['development']
        },
        criteria: {
          allTestsPassed: true,
          securityApproval: false,
          performanceBaseline: false,
          rollbackPlan: false
        },
        automation: {
          autoApprove: false,
          conditions: [],
          overrides: false
        }
      }
    };

    manager = new DeploymentCertificationManager(config);
  });

  afterEach(() => {
    manager.removeAllListeners();
  });

  describe('DeploymentCertificationManager', () => {
    it('should initialize with default config', () => {
      const defaultManager = new DeploymentCertificationManager();
      expect(defaultManager).toBeDefined();
    });

    it('should initialize with custom config', () => {
      expect(manager).toBeDefined();
    });

    it('should run deployment certification', async () => {
      const result = await manager.runCertification();
      
      expect(result).toBeDefined();
      expect(result.certificationId).toBeDefined();
      expect(result.environment).toBe('staging');
      expect(result.timestamp).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.scenarios).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.resources).toBeDefined();
      expect(result.environmentStatus).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.approval).toBeDefined();
      expect(result.deployment).toBeDefined();
    });

    it('should emit events during certification', async () => {
      const events: string[] = [];
      
      manager.on('certification:start', () => events.push('certification:start'));
      manager.on('scenario:start', () => events.push('scenario:start'));
      manager.on('step:start', () => events.push('step:start'));
      manager.on('step:complete', () => events.push('step:complete'));
      manager.on('scenario:complete', () => events.push('scenario:complete'));
      manager.on('certification:complete', () => events.push('certification:complete'));
      
      await manager.runCertification();
      
      expect(events).toContain('certification:start');
      expect(events).toContain('certification:complete');
    });

    it('should calculate correct summary metrics', async () => {
      const result = await manager.runCertification();
      
      expect(result.summary.totalScenarios).toBeGreaterThanOrEqual(0);
      expect(result.summary.passedScenarios).toBeGreaterThanOrEqual(0);
      expect(result.summary.failedScenarios).toBeGreaterThanOrEqual(0);
      expect(result.summary.totalSteps).toBeGreaterThanOrEqual(0);
      expect(result.summary.passedSteps).toBeGreaterThanOrEqual(0);
      expect(result.summary.averageDuration).toBeGreaterThanOrEqual(0);
      expect(result.summary.readinessScore).toBeGreaterThanOrEqual(0);
      expect(['low', 'medium', 'high', 'critical']).toContain(result.summary.deploymentRisk);
      expect(['proceed', 'fix-issues', 'rollback', 'hold']).toContain(result.summary.recommendedAction);
    });

    it('should track performance metrics', async () => {
      const result = await manager.runCertification();
      
      expect(result.performance.averageDeploymentTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.peakDeploymentTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.throughput).toBeGreaterThanOrEqual(0);
      expect(result.performance.errorRate).toBeGreaterThanOrEqual(0);
      expect(result.performance.successRate).toBeGreaterThanOrEqual(0);
      expect(result.performance.rollbackRate).toBeGreaterThanOrEqual(0);
      expect(result.performance.mttr).toBeGreaterThanOrEqual(0);
      expect(result.performance.mtbf).toBeGreaterThanOrEqual(0);
    });

    it('should track resource usage', async () => {
      const result = await manager.runCertification();
      
      expect(result.resources.totalDeploymentSize).toBeGreaterThanOrEqual(0);
      expect(result.resources.peakMemoryUsage).toBeGreaterThanOrEqual(0);
      expect(result.resources.averageMemoryUsage).toBeGreaterThanOrEqual(0);
      expect(result.resources.peakCpuUsage).toBeGreaterThanOrEqual(0);
      expect(result.resources.averageCpuUsage).toBeGreaterThanOrEqual(0);
      expect(result.resources.costs.total).toBeGreaterThanOrEqual(0);
      expect(result.resources.efficiency.resourceUtilization).toBeGreaterThanOrEqual(0);
    });

    it('should provide environment status', async () => {
      const result = await manager.runCertification();
      
      expect(result.environmentStatus.environment).toBe('staging');
      expect(result.environmentStatus.version).toBeDefined();
      expect(['pending', 'in-progress', 'validating', 'certified', 'failed', 'rolled-back', 'approved']).toContain(result.environmentStatus.status);
      expect(typeof result.environmentStatus.healthy).toBe('boolean');
      expect(Array.isArray(result.environmentStatus.services)).toBe(true);
      expect(result.environmentStatus.infrastructure).toBeDefined();
      expect(result.environmentStatus.monitoring).toBeDefined();
    });

    it('should include deployment strategy', async () => {
      const result = await manager.runCertification();
      
      expect(['blue-green', 'canary', 'rolling', 'recreate']).toContain(result.deployment.strategy);
      expect(result.deployment.rollbackPlan).toBeDefined();
      expect(typeof result.deployment.rollbackPlan.enabled).toBe('boolean');
      expect(Array.isArray(result.deployment.rollbackPlan.triggers)).toBe(true);
      expect(Array.isArray(result.deployment.rollbackPlan.steps)).toBe(true);
      expect(result.deployment.monitoring).toBeDefined();
      expect(result.deployment.documentation).toBeDefined();
    });

    it('should handle approval workflow', async () => {
      const result = await manager.runCertification();
      
      expect(result.approval).toBeDefined();
      expect(typeof result.approval.required).toBe('boolean');
      expect(typeof result.approval.obtained).toBe('boolean');
      expect(Array.isArray(result.approval.approvers)).toBe(true);
      expect(['approved', 'rejected', 'pending']).toContain(result.approval.finalDecision);
      expect(Array.isArray(result.approval.conditions)).toBe(true);
    });
  });

  describe('DeploymentCertificationConfigManager', () => {
    it('should initialize with default configuration', () => {
      const config = new DeploymentCertificationConfigManager();
      expect(config).toBeDefined();
    });

    it('should merge custom configuration', () => {
      const customConfig: Partial<DeploymentCertificationConfig> = {
        environment: 'production',
        certificationLevel: 'enterprise'
      };

      const config = new DeploymentCertificationConfigManager(customConfig);
      const result = config.getConfig();
      
      expect(result.environment).toBe('production');
      expect(result.certificationLevel).toBe('enterprise');
    });

    it('should update environment configuration', () => {
      const config = new DeploymentCertificationConfigManager();
      config.updateEnvironment('production');
      
      const result = config.getConfig();
      expect(result.environment).toBe('production');
    });

    it('should update certification level', () => {
      const config = new DeploymentCertificationConfigManager();
      config.updateCertificationLevel('premium');
      
      const result = config.getConfig();
      expect(result.certificationLevel).toBe('premium');
    });

    it('should toggle categories', () => {
      const config = new DeploymentCertificationConfigManager();
      config.toggleCategory('build-verification', false);
      
      const enabledCategories = config.getEnabledCategories();
      expect(enabledCategories).not.toContain('build-verification');
    });

    it('should get enabled categories', () => {
      const config = new DeploymentCertificationConfigManager();
      const categories = config.getEnabledCategories();
      
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should validate configuration', () => {
      const config = new DeploymentCertificationConfigManager();
      const validation = config.validateConfiguration();
      
      expect(validation).toBeDefined();
      expect(typeof validation.valid).toBe('boolean');
      expect(Array.isArray(validation.errors)).toBe(true);
    });

    it('should provide environment-specific configurations', () => {
      const environments: DeploymentEnvironment[] = ['development', 'staging', 'production'];
      
      environments.forEach(env => {
        const envConfig = DeploymentCertificationConfigManager.getEnvironmentConfig(env);
        expect(envConfig).toBeDefined();
      });
    });

    it('should adjust configuration for certification levels', () => {
      const levels: CertificationLevel[] = ['basic', 'standard', 'premium', 'enterprise', 'critical'];
      
      levels.forEach(level => {
        const config = new DeploymentCertificationConfigManager();
        config.updateCertificationLevel(level);
        const result = config.getConfig();
        expect(result.certificationLevel).toBe(level);
      });
    });

    it('should get specific configuration components', () => {
      const config = new DeploymentCertificationConfigManager();
      
      expect(config.getBuildVerificationConfig()).toBeDefined();
      expect(config.getPackageDistributionConfig()).toBeDefined();
      expect(config.getHealthCheckConfig()).toBeDefined();
      expect(config.getRollbackTestingConfig()).toBeDefined();
      expect(config.getMonitoringSetupConfig()).toBeDefined();
      expect(config.getDocumentationValidationConfig()).toBeDefined();
      expect(config.getProductionApprovalConfig()).toBeDefined();
    });
  });
});