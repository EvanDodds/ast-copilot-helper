/**
 * Core Error Reporting Manager Implementation
 * Comprehensive error reporting with automatic detection, categorization, and context collection
 */

import { randomUUID } from 'crypto';
import * as os from 'os';
import * as process from 'process';
import * as path from 'path';
import { performance } from 'perf_hooks';

import { AstError } from '../errors/types.js';
import {
  ErrorReportingManager,
  ErrorReportingConfig,
  ErrorReport,
  CrashReport,
  DiagnosticContext,
  DiagnosticData,
  SuggestionResult,
  ErrorHistoryEntry,
  ReportResult,
  ErrorContext,
  EnvironmentInfo,
  SystemDiagnostics,
  RuntimeDiagnostics,
  CodebaseDiagnostics,
  ConfigurationDiagnostics,
  PerformanceDiagnostics,
  DependencyDiagnostics,
  ProcessInfo,
  MemoryDump
} from './types.js';

// Import comprehensive suggestion system
import { SuggestionEngine } from './suggestions/suggestion-engine.js';
import type { 
  SuggestionContext, 
  ResolutionSuggestion, 
  SuggestionEngineResult,
  SuggestionType,
  SuggestionConfidence
} from './suggestions/types.js';

// Import crash reporting system
import { CrashDetector, CrashAnalyticsEngine } from './crash/index.js';
import type { CrashReport as CrashReportType } from './crash/types.js';

// Import analytics system
import { ErrorAnalyticsManager } from './analytics/error-analytics.js';

// Import privacy and security systems
import { PrivacyManager } from './privacy/privacy-manager.js';
import { SecureTransmissionManager } from './privacy/secure-transmission.js';
import { ComplianceChecker } from './privacy/compliance-checker.js';
import type { 
  ConsentData, 
  PrivacySettings, 
  SecurityConfig
} from './types.js';
import type { TransmissionResult } from './privacy/secure-transmission.js';
import type { ErrorAnalytics, SystemHealthMetrics, ErrorFrequencyPoint, ErrorCorrelation } from './types.js';

/**
 * Comprehensive Error Reporting Manager
 * Main implementation of the error reporting system
 */
export class ComprehensiveErrorReportingManager implements ErrorReportingManager {
  private config?: ErrorReportingConfig;
  private initialized: boolean = false;
  private sessionId: string;
  private currentOperation: string = 'unknown';
  private operationHistory: string[] = [];
  private errorHistory: ErrorHistoryEntry[] = [];
  private reportQueue: ErrorReport[] = [];
  private suggestionEngine: SuggestionEngine;
  
  // Advanced analytics
  private analyticsManager: ErrorAnalyticsManager;
  
  // Crash reporting components
  private crashDetector?: CrashDetector;
  private crashAnalytics?: CrashAnalyticsEngine;
  private crashReports: CrashReport[] = [];
  
  // Privacy components
  private privacyManager?: PrivacyManager;
  private telemetryManager?: TelemetryManager;
  
  // Event handler references for cleanup
  private uncaughtExceptionHandler?: (error: Error) => void;
  private unhandledRejectionHandler?: (reason: any, promise: Promise<any>) => void;
  private warningHandler?: (warning: Error) => void;
  
  constructor() {
    this.sessionId = randomUUID();
    this.suggestionEngine = new SuggestionEngine({
      maxSuggestions: 10,
      minConfidenceThreshold: 0.3,
      enableCaching: true,
      enableMLIntegration: false, // Disabled for now
      enableCommunityData: false, // Disabled for now
      parallelGeneration: true,
      adaptiveLearning: false
    });
    
    // Initialize analytics manager
    this.analyticsManager = new ErrorAnalyticsManager({
      maxHistorySize: 10000,
      analyticsPeriodDays: 30,
      trendAnalysisWindow: 24,
      patternDetectionThreshold: 3,
      enableRealTimeAnalytics: true,
      storageBackend: 'memory',
      enableMLAnalysis: false,
      retentionPolicyDays: 90
    });
  }

  /**
   * Initialize the error reporting system
   */
  async initialize(config: ErrorReportingConfig): Promise<void> {
    console.log('🔧 Initializing comprehensive error reporting system...');
    
    // Set defaults and merge with provided config
    this.config = {
      enabled: config.enabled ?? true,
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      enableCrashReporting: config.enableCrashReporting ?? true,
      enableAutomaticReporting: config.enableAutomaticReporting ?? false,
      collectSystemInfo: config.collectSystemInfo ?? true,
      collectCodebaseInfo: config.collectCodebaseInfo ?? true,
      maxReportSize: config.maxReportSize ?? 1024 * 1024, // 1MB default
      maxHistoryEntries: config.maxHistoryEntries ?? 100,
      privacyMode: config.privacyMode ?? false,
      userReportingEnabled: config.userReportingEnabled ?? true,
      diagnosticDataCollection: {
        system: config.diagnosticDataCollection?.system ?? true,
        runtime: config.diagnosticDataCollection?.runtime ?? true,
        codebase: config.diagnosticDataCollection?.codebase ?? true,
        configuration: config.diagnosticDataCollection?.configuration ?? true,
        performance: config.diagnosticDataCollection?.performance ?? true,
        dependencies: config.diagnosticDataCollection?.dependencies ?? true,
        maxCollectionTimeMs: config.diagnosticDataCollection?.maxCollectionTimeMs ?? 10000,
        includeEnvironmentVars: config.diagnosticDataCollection?.includeEnvironmentVars ?? true,
        includeProcessInfo: config.diagnosticDataCollection?.includeProcessInfo ?? true
      }
    };

    // Set up crash reporting system if enabled
    if (this.config.enableCrashReporting) {
      await this.setupCrashReporting();
      await this.setupGlobalErrorHandlers();
    }

    // Initialize privacy and security systems
    await this.initializePrivacySystems();

    // Initialize error history
    await this.loadErrorHistory();

    console.log('✅ Error reporting system initialized successfully');
    console.log(`   - Crash reporting: ${this.config.enableCrashReporting ? 'enabled' : 'disabled'}`);
    console.log(`   - Automatic reporting: ${this.config.enableAutomaticReporting ? 'enabled' : 'disabled'}`);
    console.log(`   - Privacy mode: ${this.config.privacyMode ? 'enabled' : 'disabled'}`);
    
    if (this.crashDetector) {
      console.log('   - Advanced crash detection: enabled');
    }
    
    if (this.privacyManager) {
      console.log('   - Privacy controls: enabled');
    }
  }

  /**
   * Report an error with comprehensive information
   */
  async reportError(error: ErrorReport): Promise<ReportResult> {
    console.log(`📊 Reporting error: ${error.type} - ${error.category}`);
    
    try {
      // Add error to history
      await this.addToHistory(error);
      
      // Add error to analytics manager
      await this.analyticsManager.addError(error);
      
      // Generate suggestions if not provided
      if (!error.suggestions || error.suggestions.length === 0) {
        console.log('🧠 Generating error resolution suggestions...');
        error.suggestions = await this.provideSuggestions(error);
      }
      
      // Display error to user with suggestions
      await this.displayErrorToUser(error);
      
      // Log detailed error information for debugging
      await this.logDetailedError(error);
      
      return {
        success: true,
        errorId: error.id,
        suggestions: error.suggestions,
        serverReported: error.reportedToServer,
        message: 'Error reported successfully'
      };
      
    } catch (reportingError) {
      console.error('❌ Failed to report error:', reportingError);
      
      return {
        success: false,
        errorId: error.id,
        message: `Failed to report error: ${reportingError instanceof Error ? reportingError.message : String(reportingError)}`,
        error: reportingError instanceof Error ? reportingError : new Error(String(reportingError))
      };
    }
  }

  /**
   * Report a crash with memory and process information
   */
  async reportCrash(crashReport: CrashReport): Promise<ReportResult> {
    console.log(`🚨 Reporting crash: ${crashReport.type} - ${crashReport.error.message}`);
    
    try {
      // Convert crash report to error report format
      const errorReport: ErrorReport = {
        id: crashReport.id,
        timestamp: crashReport.timestamp,
        type: 'crash',
        severity: 'critical',
        category: 'system-crash',
        operation: this.currentOperation,
        message: `System crash: ${crashReport.error.message}`,
        originalError: crashReport.error,
        stackTrace: crashReport.stackTrace,
        context: crashReport.context,
        environment: await this.collectEnvironmentInfo(),
        diagnostics: await this.collectDiagnostics({
          error: crashReport.error,
          timestamp: crashReport.timestamp,
          includeSystemInfo: true,
          includeRuntimeInfo: true,
          includeCodebaseInfo: true
        }),
        userProvided: false,
        reportedToServer: false,
        suggestions: []
      };

      // Generate crash-specific suggestions using the main suggestion system
      errorReport.suggestions = await this.provideSuggestions(errorReport);

      // Report as regular error
      return await this.reportError(errorReport);
      
    } catch (reportingError) {
      console.error('❌ Failed to report crash:', reportingError);
      
      return {
        success: false,
        errorId: crashReport.id,
        message: `Failed to report crash: ${reportingError instanceof Error ? reportingError.message : String(reportingError)}`,
        error: reportingError instanceof Error ? reportingError : new Error(String(reportingError))
      };
    }
  }

  /**
   * Collect comprehensive diagnostic data
   */
  async collectDiagnostics(context: DiagnosticContext): Promise<DiagnosticData> {
    console.log('🔍 Collecting comprehensive diagnostic data...');
    const startTime = performance.now();
    
    try {
      const diagnostics: DiagnosticData = {
        system: await this.collectSystemDiagnostics(),
        runtime: await this.collectRuntimeDiagnostics(),
        codebase: await this.collectCodebaseDiagnostics(context),
        configuration: await this.collectConfigurationDiagnostics(),
        performance: await this.collectPerformanceDiagnostics(),
        dependencies: await this.collectDependencyDiagnostics()
      };

      // Apply privacy filters if enabled
      if (this.config.privacyMode) {
        return await this.applyPrivacyFilters(diagnostics);
      }

      const duration = performance.now() - startTime;
      console.log(`✅ Diagnostic data collected successfully in ${duration.toFixed(2)}ms`);
      
      return diagnostics;
      
    } catch (error) {
      console.error('❌ Failed to collect diagnostics:', error);
      
      // Return minimal diagnostics on error
      return this.createMinimalDiagnostics(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Generate comprehensive error report from an Error object
   */
  async generateErrorReport(error: Error, context?: any): Promise<ErrorReport> {
    const errorId = this.generateErrorId();
    const timestamp = new Date();
    
    console.log(`🔨 Generating comprehensive error report: ${errorId}`);
    
    try {
      // Categorize the error
      const category = await this.categorizeError(error);
      
      // Collect environmental information
      const environment = await this.collectEnvironmentInfo();
      
      // Collect diagnostic data with error context
      const diagnosticContext: DiagnosticContext = {
        error,
        operation: this.currentOperation,
        context,
        timestamp,
        includeSystemInfo: this.config.collectSystemInfo,
        includeRuntimeInfo: true,
        includeCodebaseInfo: this.config.collectCodebaseInfo
      };
      const diagnostics = await this.collectDiagnostics(diagnosticContext);
      
      // Build error context
      const errorContext = await this.buildErrorContext(error, context);
      
      const errorReport: ErrorReport = {
        id: errorId,
        timestamp,
        type: this.determineErrorType(error),
        severity: this.determineSeverity(error),
        category,
        operation: this.currentOperation,
        message: error.message,
        originalError: error,
        stackTrace: error.stack,
        context: errorContext,
        environment,
        diagnostics,
        userProvided: false,
        reportedToServer: false,
        suggestions: []
      };
      
      console.log(`✅ Error report generated: ${errorId}`);
      return errorReport;
      
    } catch (generationError) {
      console.error('❌ Failed to generate error report:', generationError);
      
      // Return minimal error report
      return this.createMinimalErrorReport(error, errorId, timestamp);
    }
  }

  /**
   * Provide intelligent suggestions for error resolution
   */
  async provideSuggestions(error: ErrorReport): Promise<SuggestionResult[]> {
    try {
      console.log(`🧠 Generating suggestions for error: ${error.category}`);
      
      // Convert ErrorReport to SuggestionContext for the new engine
      const suggestionContext: SuggestionContext = await this.createSuggestionContext(error);
      
      // Use the comprehensive suggestion engine
      const engineResult: SuggestionEngineResult = await this.suggestionEngine.generateSuggestions(suggestionContext);
      
      // Convert ResolutionSuggestion[] to SuggestionResult[] for backward compatibility
      const suggestions: SuggestionResult[] = engineResult.suggestions.map(suggestion => 
        this.convertToSuggestionResult(suggestion)
      );
      
      console.log(`✅ Generated ${suggestions.length} suggestions using ${engineResult.generatorsUsed.length} generators`);
      console.log(`📊 Processing time: ${engineResult.totalProcessingTime}ms, Cache hit: ${engineResult.cacheHit}`);
      
      // Return results, already sorted by the engine
      return suggestions.slice(0, 5); // Return top 5 suggestions
      
    } catch (suggestionError) {
      console.error('❌ Failed to generate suggestions:', suggestionError);
      
      // Return basic fallback suggestions
      return [
        {
          id: 'fallback-1',
          title: 'Check Error Details',
          description: 'Carefully examine the error message and stack trace for specific clues',
          severity: 'low',
          category: 'information',
          confidence: 0.5,
          estimatedTime: '5 minutes'
        }
      ];
    }
  }

  /**
   * Create suggestion context from error report
   */
  private async createSuggestionContext(error: ErrorReport): Promise<SuggestionContext> {    
    // Get current file from stack trace or operation context
    let currentFile: string | undefined;
    if (error.stackTrace) {
      const fileMatch = error.stackTrace.match(/at .* \(([^:]+):\d+:\d+\)/);
      currentFile = fileMatch?.[1];
    }

    return {
      error: {
        message: error.message,
        stack: error.stackTrace,
        type: error.type.toUpperCase(),
        category: error.category,
        operation: error.operation
      },
      environment: {
        nodeVersion: error.environment.nodeVersion || process.version,
        platform: error.environment.platform || os.platform(),
        projectType: 'ast-helper', // Could be made dynamic
        dependencies: (error.diagnostics.runtime?.modules?.loaded || []).reduce(
          (deps: Record<string, string>, module: string) => {
            deps[module] = 'loaded';
            return deps;
          },
          {}
        ),
        configFiles: this.extractConfigFiles(error.diagnostics)
      },
      codebase: {
        languages: this.detectLanguagesFromContext(error.diagnostics),
        frameworks: this.detectFrameworksFromContext(error.diagnostics),
        currentFile,
        recentChanges: [], // Could be populated from git or file system monitoring
        relatedFiles: error.context.files || []
      },
      history: {
        similarErrors: this.countSimilarErrors(error),
        recentPatterns: this.extractRecentPatterns(),
        successfulResolutions: this.extractSuccessfulResolutions(error)
      },
      user: {
        experienceLevel: 'intermediate', // Could be configurable or learned
        preferences: {
          automated: true,
          detailed: false,
          conservative: false
        }
      }
    };
  }

  /**
   * Convert ResolutionSuggestion to SuggestionResult for backward compatibility
   */
  private convertToSuggestionResult(suggestion: ResolutionSuggestion): SuggestionResult {
    return {
      id: suggestion.id,
      title: suggestion.title,
      description: suggestion.description,
      severity: this.mapConfidenceToSeverity(suggestion.confidence),
      category: this.mapSuggestionTypeToCategory(suggestion.type),
      confidence: this.mapConfidenceToNumber(suggestion.confidence),
      commands: suggestion.actions
        .filter(action => action.type === 'command-run')
        .map(action => action.command)
        .filter((cmd): cmd is string => cmd !== undefined),
      links: suggestion.actions
        .filter(action => action.type === 'file-create' || action.type === 'config-update')
        .map(action => action.target)
        .filter((target): target is string => target !== undefined),
      estimatedTime: this.estimateTimeFromDifficulty(suggestion.difficulty),
      prerequisites: suggestion.prerequisites,
      steps: suggestion.actions.map(action => action.description)
    };
  }

  /**
   * Helper methods for context extraction and conversion
   */
  private extractConfigFiles(diagnostics: DiagnosticData): string[] {
    const files: string[] = [];
    
    // Add common config files that might be relevant
    if (diagnostics.codebase?.packages?.packageJson) {
      files.push('package.json');
    }
    if (diagnostics.configuration?.configFiles?.found?.includes('tsconfig.json')) {
      files.push('tsconfig.json');
    }
    
    return files;
  }

  private detectLanguagesFromContext(diagnostics: DiagnosticData): string[] {
    const languages = new Set<string>();
    
    // Default to JavaScript/TypeScript for AST helper
    languages.add('javascript');
    languages.add('typescript');
    
    // Use language data from diagnostics if available
    if (diagnostics.codebase?.structure?.languages) {
      Object.keys(diagnostics.codebase.structure.languages).forEach(lang => 
        languages.add(lang.toLowerCase())
      );
    }
    
    return Array.from(languages);
  }

  private detectFrameworksFromContext(diagnostics: DiagnosticData): string[] {
    const frameworks: string[] = [];
    
    // Check for common frameworks based on codebase structure
    const languages = diagnostics.codebase?.structure?.languages || {};
    
    if (languages['TypeScript'] || languages['JavaScript']) {
      // Check for common JS/TS frameworks (this is basic detection)
      const packageJson = diagnostics.codebase?.packages?.packageJson;
      if (packageJson) {
        const dependencies = JSON.stringify(packageJson);
        if (dependencies.includes('react')) frameworks.push('React');
        if (dependencies.includes('vue')) frameworks.push('Vue');
        if (dependencies.includes('angular')) frameworks.push('Angular');
        if (dependencies.includes('express')) frameworks.push('Express');
        if (dependencies.includes('nestjs')) frameworks.push('NestJS');
        if (dependencies.includes('next')) frameworks.push('Next.js');
      }
    }
    
    return frameworks;
  }

  private countSimilarErrors(error: ErrorReport): number {
    return this.errorHistory.filter(entry => 
      entry.error.id === error.id || 
      entry.error.category === error.category
    ).length;
  }

  private extractRecentPatterns(): string[] {
    // Extract patterns from recent errors
    return this.errorHistory
      .slice(-10) // Last 10 errors
      .map(entry => entry.error.category || 'unknown')
      .filter((category, index, arr) => arr.indexOf(category) === index); // Unique categories
  }

  private extractSuccessfulResolutions(_error: ErrorReport) {
    // This would track successful resolutions in a real implementation
    return [];
  }

  private mapSuggestionTypeToCategory(suggestionType: SuggestionType): 'fix' | 'workaround' | 'information' {
    switch (suggestionType) {
      case 'code-fix':
      case 'configuration':
      case 'dependency':
        return 'fix';
      case 'debugging':
      case 'alternative-approach':
        return 'workaround';
      case 'documentation':
      case 'environment':
      default:
        return 'information';
    }
  }

  private mapConfidenceToSeverity(confidence: SuggestionConfidence): 'low' | 'medium' | 'high' {
    switch (confidence) {
      case 'low':
        return 'low';
      case 'medium':
        return 'medium';
      case 'high':
      case 'critical':
        return 'high';
      default:
        return 'medium';
    }
  }

  private mapConfidenceToNumber(confidence: SuggestionConfidence): number {
    switch (confidence) {
      case 'low':
        return 0.25;
      case 'medium':
        return 0.5;
      case 'high':
        return 0.75;
      case 'critical':
        return 0.9;
      default:
        return 0.5;
    }
  }

  private estimateTimeFromDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'): string {
    switch (difficulty) {
      case 'beginner':
        return '5-15 minutes';
      case 'intermediate':
        return '15-30 minutes';
      case 'advanced':
        return '30-60 minutes';
      case 'expert':
        return '1+ hours';
      default:
        return 'Unknown';
    }
  }
  async exportDiagnostics(format: 'json' | 'text'): Promise<string> {
    console.log(`📄 Exporting diagnostics in ${format} format...`);
    
    try {
      const diagnostics = await this.collectDiagnostics({
        timestamp: new Date(),
        includeSystemInfo: true,
        includeRuntimeInfo: true,
        includeCodebaseInfo: true
      });
      
      if (format === 'json') {
        return JSON.stringify(diagnostics, null, 2);
      } else {
        return this.formatDiagnosticsAsText(diagnostics);
      }
    } catch (error) {
      console.error('❌ Failed to export diagnostics:', error);
      throw error;
    }
  }

  /**
   * Get error history
   */
  async getErrorHistory(): Promise<ErrorHistoryEntry[]> {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  async clearErrorHistory(): Promise<void> {
    console.log('🗑️ Clearing error history...');
    this.errorHistory = [];
    console.log('✅ Error history cleared');
  }

  /**
   * Set current operation for context tracking
   */
  setCurrentOperation(operation: string): void {
    this.currentOperation = operation;
    this.operationHistory.unshift(operation);
    
    // Keep only last 10 operations
    if (this.operationHistory.length > 10) {
      this.operationHistory = this.operationHistory.slice(0, 10);
    }
  }

  // Private helper methods

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private async setupGlobalErrorHandlers(): Promise<void> {
    // Handle uncaught exceptions
    this.uncaughtExceptionHandler = async (error) => {
      console.error('🚨 Uncaught Exception:', error);
      
      const crashReport = await this.createCrashReportFromError(error, 'uncaughtException');
      await this.reportCrash(crashReport);
      
      // Give time for report to be sent
      setTimeout(() => {
        process.exit(1);
      }, 5000);
    };
    process.on('uncaughtException', this.uncaughtExceptionHandler);
    
    // Handle unhandled promise rejections
    this.unhandledRejectionHandler = async (reason, promise) => {
      console.error('🚨 Unhandled Promise Rejection at:', promise, 'reason:', reason);
      
      const error = reason instanceof Error ? reason : new Error(String(reason));
      const errorReport = await this.generateErrorReport(error, { 
        type: 'unhandledRejection',
        promise: promise.toString()
      });
      
      await this.reportError(errorReport);
    };
    process.on('unhandledRejection', this.unhandledRejectionHandler);
    
    // Handle memory warnings
    this.warningHandler = async (warning) => {
      if (warning.name === 'MaxListenersExceededWarning' || 
          warning.name === 'DeprecationWarning' ||
          warning.message.includes('memory')) {
        
        const errorReport = await this.generateErrorReport(new Error(warning.message), {
          type: 'warning',
          warningName: warning.name,
          warningCode: (warning as any).code
        });
        
        errorReport.severity = 'medium';
        await this.reportError(errorReport);
      }
    };
    process.on('warning', this.warningHandler);
  }

  private async createCrashReportFromError(error: Error, type: CrashReport['type']): Promise<CrashReport> {
    return {
      id: this.generateErrorId(),
      timestamp: new Date(),
      type,
      error,
      context: await this.buildErrorContext(error),
      processInfo: this.collectProcessInfo(),
      lastOperations: [...this.operationHistory],
      stackTrace: error.stack || 'No stack trace available',
      memoryDump: this.collectMemoryDump()
    };
  }

  private collectProcessInfo(): ProcessInfo {
    return {
      pid: process.pid,
      ppid: process.ppid,
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
      resourceUsage: process.resourceUsage?.(),
      argv: process.argv,
      execArgv: process.execArgv,
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      versions: Object.fromEntries(
        Object.entries(process.versions).map(([key, value]) => [key, value || 'unknown'])
      )
    };
  }

  private collectMemoryDump(): MemoryDump {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
      objectCounts: {},
      largestObjects: []
    };
  }

  private async collectEnvironmentInfo(): Promise<EnvironmentInfo> {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      npmVersion: undefined, // Could be detected from package.json or npm -v
      osVersion: os.release(),
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      cpuCores: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      workingDirectory: process.cwd(),
      homeDirectory: os.homedir(),
      tempDirectory: os.tmpdir(),
      pathSeparator: path.sep,
      environmentVars: this.config.privacyMode ? {} : Object.fromEntries(
        Object.entries(process.env).map(([key, value]) => [key, value || ''])
      ),
      processArgs: process.argv,
      processEnv: process.env.NODE_ENV || 'unknown'
    };
  }

  private async buildErrorContext(_error: Error, context?: any): Promise<ErrorContext> {
    const memUsage = process.memoryUsage();
    
    return {
      operation: this.currentOperation,
      component: 'ast-copilot-helper',
      sessionId: this.sessionId,
      timestamp: new Date(),
      parameters: context,
      platform: os.platform(),
      architecture: os.arch(),
      nodeVersion: process.version,
      processId: process.pid,
      memoryUsage: memUsage,
      uptime: process.uptime()
    };
  }

  private async categorizeError(error: Error): Promise<string> {
    if (error instanceof AstError) {
      return error.code;
    }
    
    const message = error.message.toLowerCase();
    // const stack = error.stack?.toLowerCase() || '';
    
    // Network errors
    if (message.includes('network') || message.includes('fetch') || 
        message.includes('connection') || message.includes('timeout')) {
      return 'network-error';
    }
    
    // File system errors
    if (message.includes('enoent') || message.includes('file') || 
        message.includes('directory') || message.includes('path')) {
      return 'filesystem-error';
    }
    
    // Permission errors
    if (message.includes('permission') || message.includes('access') || 
        message.includes('eacces') || message.includes('eperm')) {
      return 'permission-error';
    }
    
    // Memory errors
    if (message.includes('memory') || message.includes('heap') || 
        message.includes('allocation')) {
      return 'memory-error';
    }
    
    // Parse errors (check before validation errors to avoid false positives)
    if (message.includes('parse') || message.includes('syntax') || 
        message.includes('unexpected token') || message.includes('malformed')) {
      return 'parse-error';
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || 
        message.includes('required') || message.includes('expected')) {
      return 'validation-error';
    }
    
    return 'unknown-error';
  }

  private determineErrorType(error: Error): 'error' | 'crash' | 'warning' | 'performance' {
    const message = error.message.toLowerCase();
    
    if (message.includes('crash') || message.includes('fatal') || 
        message.includes('segmentation fault')) {
      return 'crash';
    }
    
    if (message.includes('warn') || message.includes('deprecated')) {
      return 'warning';
    }
    
    if (message.includes('slow') || message.includes('performance') || 
        message.includes('timeout')) {
      return 'performance';
    }
    
    return 'error';
  }

  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message.toLowerCase();
    // const stack = error.stack?.toLowerCase() || '';
    
    // Critical errors
    if (message.includes('crash') || message.includes('fatal') || 
        message.includes('segmentation fault') || message.includes('out of memory')) {
      return 'critical';
    }
    
    // High severity errors
    if (message.includes('permission denied') || message.includes('access denied') ||
        message.includes('authentication') || message.includes('authorization') ||
        message.includes('security') || message.includes('corruption')) {
      return 'high';
    }
    
    // Medium severity errors
    if (message.includes('network') || message.includes('timeout') ||
        message.includes('validation') || message.includes('configuration')) {
      return 'medium';
    }
    
    // Low severity (warnings, deprecation, etc.)
    if (message.includes('warn') || message.includes('deprecated') ||
        message.includes('suggestion')) {
      return 'low';
    }
    
    return 'medium'; // default
  }

  // Additional helper methods would be implemented here...
  // (collectSystemDiagnostics, collectRuntimeDiagnostics, etc.)
  
  private async collectSystemDiagnostics(): Promise<SystemDiagnostics> {
    // Implementation placeholder - would collect actual system metrics
    return {} as SystemDiagnostics;
  }
  
  private async collectRuntimeDiagnostics(): Promise<RuntimeDiagnostics> {
    // Implementation placeholder - would collect runtime metrics
    return {} as RuntimeDiagnostics;
  }
  
  private async collectCodebaseDiagnostics(_context: DiagnosticContext): Promise<CodebaseDiagnostics> {
    // Implementation placeholder - would analyze codebase
    return {} as CodebaseDiagnostics;
  }
  
  private async collectConfigurationDiagnostics(): Promise<ConfigurationDiagnostics> {
    // Implementation placeholder - would analyze configuration
    return {} as ConfigurationDiagnostics;
  }
  
  private async collectPerformanceDiagnostics(): Promise<PerformanceDiagnostics> {
    // Implementation placeholder - would collect performance metrics
    return {} as PerformanceDiagnostics;
  }
  
  private async collectDependencyDiagnostics(): Promise<DependencyDiagnostics> {
    // Implementation placeholder - would analyze dependencies
    return {} as DependencyDiagnostics;
  }

  private async applyPrivacyFilters(diagnostics: DiagnosticData): Promise<DiagnosticData> {
    // Implementation placeholder - would filter sensitive data
    return diagnostics;
  }

  private createMinimalDiagnostics(_error: Error): DiagnosticData {
    // Return minimal diagnostic data on collection error
    return {} as DiagnosticData;
  }

  private createMinimalErrorReport(error: Error, errorId: string, timestamp: Date): ErrorReport {
    // Return minimal error report on generation failure
    return {
      id: errorId,
      timestamp,
      type: 'error',
      severity: 'medium',
      category: 'unknown-error',
      operation: this.currentOperation,
      message: error.message,
      originalError: error,
      stackTrace: error.stack,
      context: {} as ErrorContext,
      environment: {} as EnvironmentInfo,
      diagnostics: {} as DiagnosticData,
      userProvided: false,
      reportedToServer: false,
      suggestions: []
    };
  }

  private async addToHistory(error: ErrorReport): Promise<void> {
    const historyEntry: ErrorHistoryEntry = {
      id: error.id,
      timestamp: error.timestamp,
      error,
      resolved: false
    };

    this.errorHistory.unshift(historyEntry);

    // Keep only the configured number of entries
    if (this.errorHistory.length > this.config.maxHistoryEntries) {
      this.errorHistory = this.errorHistory.slice(0, this.config.maxHistoryEntries);
    }
  }

  private async loadErrorHistory(): Promise<void> {
    // Implementation placeholder - would load from persistent storage
    this.errorHistory = [];
  }

  private async displayErrorToUser(error: ErrorReport): Promise<void> {
    const displayMessage = this.formatUserErrorMessage(error);
    
    console.error('\n' + '='.repeat(60));
    console.error(`❌ ERROR: ${error.category.toUpperCase()}`);
    console.error('='.repeat(60));
    console.error(displayMessage);
    
    if (error.suggestions && error.suggestions.length > 0) {
      console.error('\n💡 SUGGESTED SOLUTIONS:');
      error.suggestions.forEach((suggestion, index) => {
        console.error(`${index + 1}. ${suggestion.title}`);
        console.error(`   ${suggestion.description}`);
        if (suggestion.commands && suggestion.commands.length > 0) {
          console.error(`   Try: ${suggestion.commands.join(' or ')}`);
        }
      });
    }
    
    console.error('\n' + '='.repeat(60) + '\n');
  }

  private formatUserErrorMessage(error: ErrorReport): string {
    return `Operation: ${error.operation}\nMessage: ${error.message}\nSeverity: ${error.severity}\nTimestamp: ${error.timestamp.toISOString()}`;
  }

  private async logDetailedError(error: ErrorReport): Promise<void> {
    // Implementation placeholder - would log detailed error for debugging
    console.log(`🔍 Error Details (ID: ${error.id}):`, {
      type: error.type,
      severity: error.severity,
      category: error.category,
      operation: error.operation,
      suggestionsCount: error.suggestions.length
    });
  }

  private formatDiagnosticsAsText(diagnostics: DiagnosticData): string {
    // Implementation placeholder - would format diagnostics as readable text
    return JSON.stringify(diagnostics, null, 2);
  }

  // ========================
  // Analytics Methods
  // ========================

  /**
   * Generate comprehensive error analytics
   */
  async getErrorAnalytics(options?: {
    startDate?: Date;
    endDate?: Date;
    categories?: string[];
    severities?: string[];
  }): Promise<ErrorAnalytics> {
    console.log('📈 Retrieving error analytics...');
    return await this.analyticsManager.generateAnalytics(options);
  }

  /**
   * Get system health metrics
   */
  async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    console.log('🏥 Retrieving system health metrics...');
    return await this.analyticsManager.generateSystemHealth();
  }

  /**
   * Get error frequency trends
   */
  async getErrorFrequencyTrends(
    timeWindow: 'hour' | 'day' | 'week' | 'month' = 'day',
    limit: number = 30
  ): Promise<ErrorFrequencyPoint[]> {
    console.log(`📊 Retrieving error frequency trends (${timeWindow})`);
    return await this.analyticsManager.getErrorFrequencyTrends(timeWindow, limit);
  }

  /**
   * Find error correlations
   */
  async getErrorCorrelations(): Promise<ErrorCorrelation[]> {
    console.log('🔗 Finding error correlations...');
    return await this.analyticsManager.findErrorCorrelations();
  }

  /**
   * Export analytics data
   */
  async exportErrorAnalytics(format: 'json' | 'csv' = 'json'): Promise<string> {
    console.log(`📤 Exporting error analytics as ${format}...`);
    return await this.analyticsManager.exportAnalytics(format);
  }

  /**
   * Mark error as resolved in analytics
   */
  async resolveError(errorId: string): Promise<void> {
    console.log(`✅ Marking error ${errorId} as resolved...`);
    
    // Update main error history
    const historyEntry = this.errorHistory.find(e => e.id === errorId);
    if (historyEntry) {
      historyEntry.resolved = true;
      historyEntry.resolvedAt = new Date();
    }
    
    // Update analytics
    await this.analyticsManager.resolveError(errorId);
  }

  /**
   * Set up crash reporting system
   */
  private async setupCrashReporting(): Promise<void> {
    console.log('🛡️ Setting up advanced crash reporting...');

    try {
      // Initialize crash detector
      this.crashDetector = new CrashDetector({
        enableAutoRecovery: true,
        maxRecoveryAttempts: 3,
        recoveryTimeout: 10000,
        monitoringInterval: 5000,
        memoryThreshold: 90, // 90% memory usage threshold
        eventLoopLagThreshold: 1000, // 1 second event loop lag
        fileDescriptorThreshold: 1000
      });

      // Initialize crash analytics
      this.crashAnalytics = new CrashAnalyticsEngine({
        analysisWindow: 24 * 60 * 60 * 1000, // 24 hours
        trendSamplingInterval: 15 * 60 * 1000, // 15 minutes
        patternDetectionMinOccurrences: 3,
        enableRealTimeAnalysis: true
      });

      // Set up crash handler
      this.crashDetector.setCrashHandler((crash: CrashReportType) => {
        this.handleCrash(crash);
      });

      // Start crash monitoring
      this.crashDetector.startMonitoring();

      console.log('✅ Advanced crash reporting system ready');
    } catch (error) {
      console.warn('⚠️ Failed to initialize crash reporting system:', error);
      // Continue without crash reporting
      this.crashDetector = undefined;
      this.crashAnalytics = undefined;
    }
  }

  /**
   * Handle detected crash
   */
  private async handleCrash(crash: CrashReportType): Promise<void> {
    console.log(`🚨 Crash detected: ${crash.type} - ${crash.error.message}`);

    try {
      // Add to crash history
      this.crashReports.push(crash);

      // Update analytics
      if (this.crashAnalytics) {
        this.crashAnalytics.addAnalyticsDataPoint(this.crashReports);
      }

      // Create a simplified error report for logging
      console.error('💥 CRASH REPORT:');
      console.error(`   Type: ${crash.type}`);
      console.error(`   Severity: ${crash.severity}`);
      console.error(`   Message: ${crash.error.message}`);
      console.error(`   Recovery Attempted: ${crash.recovery.attempted}`);
      console.error(`   Final State: ${crash.recovery.finalState}`);
      
      if (crash.error.stackFrames && crash.error.stackFrames.length > 0) {
        console.error('   Stack Trace:');
        crash.error.stackFrames.slice(0, 5).forEach((frame, i) => {
          console.error(`     ${i + 1}. ${frame.function || 'anonymous'} at ${frame.file}:${frame.line}:${frame.column}`);
        });
      }

    } catch (error) {
      console.error('❌ Failed to handle crash:', error);
    }
  }

  /**
   * Get crash analytics
   */
  async getCrashAnalytics(options?: {
    startDate?: Date;
    endDate?: Date;
    crashTypes?: CrashReportType['type'][];
    severities?: CrashReportType['severity'][];
  }) {
    if (!this.crashAnalytics || this.crashReports.length === 0) {
      return null;
    }

    return await this.crashAnalytics.generateAnalytics(this.crashReports, {
      startDate: options?.startDate,
      endDate: options?.endDate,
      crashTypes: options?.crashTypes,
      severity: options?.severities
    });
  }

  /**
   * Predict crash likelihood
   */
  predictCrashLikelihood() {
    if (!this.crashAnalytics || this.crashReports.length === 0) {
      return null;
    }

    // Return null for now - would need full SystemStateSnapshot implementation
    console.log('📊 Crash prediction not available - requires full system state implementation');
    return null;
  }

  /**
   * Cleanup crash reporting system
   */
  async cleanupCrashReporting(): Promise<void> {
    if (this.crashDetector) {
      this.crashDetector.stopMonitoring();
      console.log('🛑 Crash detection monitoring stopped');
    }
    
    await this.finalizeCrashCleanup();
  }

  /**
   * Initialize privacy and security systems
   */
  private async initializePrivacySystems(): Promise<void> {
    console.log('🔒 Initializing privacy and security systems...');

    // Initialize Privacy Manager
    this.privacyManager = new PrivacyManager({
      requireConsent: true,
      retentionDays: 30,
      anonymizationLevel: this.config.privacyMode ? 'strict' : 'basic',
      enablePiiScrubbing: true,
      allowedCategories: [
        'error', 'crash', 'performance', 'warning',
        // Specific error categories
        'parse-error', 'analysis-error', 'system-error', 'unknown-error',
        'syntax-error', 'memory-error', 'network-error', 'configuration-error', 'filesystem-error'
      ],
      enableEncryption: true,
      enableAuditLog: true,
      gdprCompliance: true,
      ccpaCompliance: true,
      customFilters: []
    });

    // Initialize Secure Transmission Manager
    if (this.config.endpoint) {
      const securityConfig: SecurityConfig = {
        enableEncryption: true,
        encryptionAlgorithm: 'AES-256-GCM',
        keyRotationInterval: 30,
        enableTransmissionSecurity: true,
        allowedOrigins: [],
        rateLimiting: {
          enabled: true,
          maxRequestsPerMinute: 60,
          blacklistDuration: 15
        },
        authentication: {
          required: !!this.config.apiKey,
          method: 'apiKey'
        }
      };

      this.secureTransmission = new SecureTransmissionManager(securityConfig);
    }

    // Initialize Compliance Checker
    if (this.privacyManager) {
      const privacySettings = this.privacyManager.getPrivacySettings();
      this.complianceChecker = new ComplianceChecker(privacySettings);
    }

    console.log('✅ Privacy and security systems initialized');
  }

  /**
   * Set user consent for data collection
   */
  async setUserConsent(userId: string, consentData: ConsentData): Promise<void> {
    if (!this.privacyManager) {
      throw new Error('Privacy manager not initialized');
    }

    await this.privacyManager.setUserConsent(userId, consentData);
    console.log(`✅ User consent set for ${userId}:`, consentData.level);
  }

  /**
   * Get user consent information
   */
  getUserConsent(userId: string): ConsentData | null {
    if (!this.privacyManager) {
      return null;
    }

    return this.privacyManager.getUserConsent(userId);
  }

  /**
   * Revoke user consent and clean up data
   */
  async revokeUserConsent(userId: string): Promise<void> {
    if (!this.privacyManager) {
      throw new Error('Privacy manager not initialized');
    }

    await this.privacyManager.revokeUserConsent(userId);
    console.log(`🚫 User consent revoked for ${userId}`);
  }

  /**
   * Export user's privacy data for GDPR compliance
   */
  async exportUserData(userId: string): Promise<any> {
    if (!this.privacyManager) {
      throw new Error('Privacy manager not initialized');
    }

    return this.privacyManager.exportUserData(userId);
  }

  /**
   * Get privacy settings
   */
  getPrivacySettings(): PrivacySettings | null {
    if (!this.privacyManager) {
      return null;
    }

    return this.privacyManager.getPrivacySettings();
  }

  /**
   * Perform compliance check
   */
  async performComplianceCheck(): Promise<any> {
    if (!this.complianceChecker || !this.privacyManager) {
      throw new Error('Compliance system not initialized');
    }

    const consentRecords = new Map<string, ConsentData>();
    // In a real implementation, you'd load actual consent records
    
    return this.complianceChecker.performComplianceCheck(
      this.errorHistory.map(entry => entry.error),
      consentRecords
    );
  }

  /**
   * Send error report securely if transmission is configured
   */
  async sendSecureErrorReport(errorReport: ErrorReport, userId?: string): Promise<TransmissionResult | null> {
    if (!this.secureTransmission || !this.config.endpoint) {
      return null;
    }

    // Filter report through privacy controls first
    let filteredReport = errorReport;
    if (this.privacyManager) {
      filteredReport = await this.privacyManager.filterErrorReport(errorReport, userId);
    }

    return this.secureTransmission.sendErrorReport(
      filteredReport,
      this.config.endpoint,
      {
        encrypt: true,
        compress: true,
        priority: errorReport.severity === 'critical' ? 'critical' : 'normal'
      }
    );
  }

  /**
   * Cleanup all systems including privacy controls
   */
  async cleanup(): Promise<void> {
    // Remove global event handlers
    this.cleanupGlobalErrorHandlers();
    
    await this.cleanupCrashReporting();
    
    if (this.privacyManager) {
      await this.privacyManager.cleanupExpiredData();
    }
    
    console.log('🧹 Error reporting system cleaned up');
  }

  /**
   * Remove global error handlers to prevent memory leaks
   */
  private cleanupGlobalErrorHandlers(): void {
    if (this.uncaughtExceptionHandler) {
      process.removeListener('uncaughtException', this.uncaughtExceptionHandler);
      this.uncaughtExceptionHandler = undefined;
    }
    
    if (this.unhandledRejectionHandler) {
      process.removeListener('unhandledRejection', this.unhandledRejectionHandler);
      this.unhandledRejectionHandler = undefined;
    }
    
    if (this.warningHandler) {
      process.removeListener('warning', this.warningHandler);
      this.warningHandler = undefined;
    }
  }

  private async finalizeCrashCleanup(): Promise<void> {
    if (this.crashDetector) {
      this.crashDetector = undefined;
    }
    
    this.crashAnalytics = undefined;
    console.log('🧹 Crash reporting system cleaned up');
  }
}