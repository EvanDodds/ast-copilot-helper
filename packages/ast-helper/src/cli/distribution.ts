#!/usr/bin/env node

import { program } from 'commander';
import { DistributionOrchestrator } from '../distribution/orchestrator.js';
import { createFromWorkspace } from '../distribution/config.js';
import { writeFile } from 'fs/promises';

/**
 * Distribution CLI for managing package distribution across multiple channels
 */

program
  .name('distribution')
  .description('AST Copilot Helper Distribution System CLI')
  .version('1.0.0');

// Validate command
program
  .command('validate')
  .description('Validate distribution configuration and credentials')
  .option('--config <path>', 'Path to distribution configuration file')
  .option('--verbose', 'Enable verbose output')
  .action(async (options) => {
    console.log('🔍 Validating distribution configuration...\n');
    
    try {
      const config = await loadConfig(options.config);
      const orchestrator = new DistributionOrchestrator();
      
      await orchestrator.initialize(config);
      const result = await orchestrator.validateAll();
      
      if (result.success) {
        console.log('✅ Distribution configuration is valid');
        console.log(`📊 Validated ${Object.keys(result.results || {}).length} publishers`);
        
        if (options.verbose && result.results) {
          Object.entries(result.results).forEach(([publisher, validation]) => {
            console.log(`\n  ${publisher}:`);
            if (validation.warnings?.length) {
              validation.warnings.forEach(warning => 
                console.log(`    ⚠️  ${warning.message}`)
              );
            }
          });
        }
      } else {
        console.error('❌ Distribution validation failed');
        if (result.results) {
          Object.entries(result.results).forEach(([publisher, validation]) => {
            if (!validation.success) {
              console.error(`\n  ${publisher}:`);
              validation.errors.forEach(error => 
                console.error(`    ❌ ${error.message}`)
              );
            }
          });
        }
        process.exit(1);
      }
    } catch (error: any) {
      console.error(`💥 Validation failed: ${error.message}`);
      process.exit(1);
    }
  });

// NPM distribution command  
program
  .command('npm')
  .description('Distribute to NPM registries')
  .option('--config <path>', 'Path to distribution configuration file')
  .option('--dry-run', 'Perform dry run without publishing')
  .option('--registry <url>', 'Override NPM registry URL')
  .action(async (options) => {
    await runDistribution('npm', options);
  });

// VS Code Marketplace command
program
  .command('marketplace')
  .description('Distribute to VS Code Marketplace')
  .option('--config <path>', 'Path to distribution configuration file') 
  .option('--dry-run', 'Perform dry run without publishing')
  .action(async (options) => {
    await runDistribution('marketplace', options);
  });

// GitHub Releases command
program
  .command('github')
  .description('Create GitHub release with assets')
  .option('--config <path>', 'Path to distribution configuration file')
  .option('--draft', 'Create as draft release')
  .option('--prerelease', 'Mark as pre-release')
  .action(async (options) => {
    await runDistribution('github', options);
  });

// Binary distribution command
program
  .command('binary')
  .description('Create binary distribution packages')
  .option('--config <path>', 'Path to distribution configuration file')
  .option('--platforms <platforms>', 'Comma-separated list of platforms', 'win32,darwin,linux')
  .option('--formats <formats>', 'Comma-separated list of formats', 'zip,tar.gz')
  .option('--sign', 'Enable code signing')
  .action(async (options) => {
    await runDistribution('binary', options);
  });

// Auto-update command
program
  .command('auto-update')
  .description('Check for and manage automatic updates')
  .option('--config <path>', 'Path to distribution configuration file')
  .option('--check-only', 'Only check for updates, do not install')
  .option('--force-update', 'Force update even if not critical')
  .action(async (options) => {
    await runDistribution('auto-update', options);
  });

// Distribute to all channels
program
  .command('all')
  .description('Distribute to all configured channels')
  .option('--config <path>', 'Path to distribution configuration file')
  .option('--channels <channels>', 'Comma-separated list of channels', 'npm,marketplace,github,binary')
  .option('--parallel', 'Run distributions in parallel', true)
  .option('--continue-on-error', 'Continue if individual distributions fail')
  .action(async (options) => {
    console.log('🚀 Starting distribution to all channels...\n');
    
    try {
      const config = await loadConfig(options.config);
      const orchestrator = new DistributionOrchestrator();
      
      await orchestrator.initialize(config);
      
      // Validate first
      console.log('🔍 Validating all publishers...');
      const validation = await orchestrator.validateAll();
      if (!validation.success) {
        console.error('❌ Validation failed, stopping distribution');
        process.exit(1);
      }
      console.log('✅ All publishers validated\n');
      
      // Distribute
      const result = await orchestrator.distributeAll({
        parallel: options.parallel,
        continueOnError: options.continueOnError
      });
      
      if (result.success) {
        console.log('🎉 Distribution completed successfully!');
        console.log(`📊 Distributed to ${Object.keys(result.results || {}).length} channels`);
        
        if (result.results) {
          Object.entries(result.results).forEach(([channel]) => {
            console.log(`  ✅ ${channel}: Success`);
          });
        }
      } else {
        console.error('❌ Distribution failed');
        if (result.results) {
          Object.entries(result.results).forEach(([channel, channelResult]: [string, any]) => {
            const status = channelResult.success ? '✅' : '❌';
            console.log(`  ${status} ${channel}: ${channelResult.success ? 'Success' : 'Failed'}`);
          });
        }
        process.exit(1);
      }
    } catch (error: any) {
      console.error(`💥 Distribution failed: ${error.message}`);
      process.exit(1);
    }
  });

// Verification command
program
  .command('verify')
  .description('Verify published packages are accessible')
  .option('--config <path>', 'Path to distribution configuration file')
  .option('--version <version>', 'Version to verify')
  .option('--channels <channels>', 'Comma-separated list of channels to verify')
  .option('--reports <path>', 'Path to distribution reports directory')
  .action(async (options) => {
    console.log('🔍 Verifying distributed packages...\n');
    
    try {
      const config = await loadConfig(options.config);
      const orchestrator = new DistributionOrchestrator();
      
      await orchestrator.initialize(config);
      const result = await orchestrator.verifyAll();
      
      if (result.success) {
        console.log('✅ All distributions verified successfully');
        if (result.results) {
          Object.entries(result.results).forEach(([channel, verification]) => {
            console.log(`  ✅ ${channel}: ${verification.checks?.length || 0} checks passed`);
          });
        }
      } else {
        console.error('❌ Verification failed');
        if (result.results) {
          Object.entries(result.results).forEach(([channel, verification]) => {
            if (!verification.success) {
              console.error(`  ❌ ${channel}: Verification failed`);
              verification.checks?.filter(c => !c.success).forEach(check => 
                console.error(`    - ${check.name}: ${check.message}`)
              );
            }
          });
        }
        process.exit(1);
      }
    } catch (error: any) {
      console.error(`💥 Verification failed: ${error.message}`);
      process.exit(1);
    }
  });

// Report generation command
program
  .command('report')
  .description('Generate distribution report')
  .option('--config <path>', 'Path to distribution configuration file')
  .option('--channel <channel>', 'Specific channel to report on')
  .option('--version <version>', 'Version to report on')
  .option('--format <format>', 'Report format (json|html)', 'json')
  .option('--output <path>', 'Output file path')
  .action(async (options) => {
    console.log('📊 Generating distribution report...\n');
    
    try {
      const config = await loadConfig(options.config);
      const orchestrator = new DistributionOrchestrator();
      
      await orchestrator.initialize(config);
      const report = await orchestrator.generateReport({
        channel: options.channel,
        version: options.version,
        format: options.format
      });
      
      const outputPath = options.output || `dist-report.${options.format}`;
      await writeFile(outputPath, JSON.stringify(report, null, 2));
      
      console.log(`✅ Report generated: ${outputPath}`);
    } catch (error: any) {
      console.error(`💥 Report generation failed: ${error.message}`);
      process.exit(1);
    }
  });

// Verification report command
program
  .command('verify-report')
  .description('Generate verification report as HTML')
  .option('--config <path>', 'Path to distribution configuration file')
  .option('--output <path>', 'Output HTML file path', 'verification-report.html')
  .action(async (options) => {
    console.log('📋 Generating verification report...\n');
    
    try {
      const config = await loadConfig(options.config);
      const orchestrator = new DistributionOrchestrator();
      
      await orchestrator.initialize(config);
      const htmlReport = await orchestrator.generateVerificationReport();
      
      await writeFile(options.output, htmlReport);
      console.log(`✅ Verification report generated: ${options.output}`);
    } catch (error: any) {
      console.error(`💥 Verification report generation failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Run distribution for a specific channel
 */
async function runDistribution(channel: string, options: any) {
  console.log(`🚀 Starting ${channel} distribution...\n`);
  
  try {
    const config = await loadConfig(options.config);
    const orchestrator = new DistributionOrchestrator();
    
    await orchestrator.initialize(config);
    
    // Validate specific publisher
    console.log(`🔍 Validating ${channel} publisher...`);
    const validation = await orchestrator.validate(channel);
    if (!validation.success) {
      console.error(`❌ ${channel} validation failed`);
      validation.errors.forEach(error => console.error(`  - ${error.message}`));
      process.exit(1);
    }
    console.log(`✅ ${channel} publisher validated\n`);
    
    // Distribute
    const result = await orchestrator.distribute(channel);
    
    if (result.success) {
      console.log(`🎉 ${channel} distribution completed successfully!`);
      if (result.duration) {
        console.log(`⏱️  Completed in ${result.duration}ms`);
      }
    } else {
      console.error(`❌ ${channel} distribution failed: ${result.error}`);
      process.exit(1);
    }
    
    // Verify
    console.log(`🔍 Verifying ${channel} distribution...`);
    const verification = await orchestrator.verify(channel, result);
    
    if (verification.success) {
      console.log(`✅ ${channel} distribution verified`);
    } else {
      console.error(`❌ ${channel} verification failed`);
      verification.checks?.filter(c => !c.success).forEach(check => 
        console.error(`  - ${check.name}: ${check.message}`)
      );
    }
    
  } catch (error: any) {
    console.error(`💥 ${channel} distribution failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Load distribution configuration
 */
async function loadConfig(configPath?: string): Promise<any> {
  if (configPath) {
    const { default: config } = await import(configPath);
    return config;
  }
  
  // Use workspace-based configuration
  return await createFromWorkspace(process.cwd());
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled rejection:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();