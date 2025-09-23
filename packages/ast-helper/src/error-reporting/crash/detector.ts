/**
 * @fileoverview Crash detection and monitoring system
 * @module @ast-copilot-helper/ast-helper/error-reporting/crash/detector
 */

import * as os from 'os';
import * as process from 'process';
import { performance } from 'perf_hooks';
import { randomUUID } from 'crypto';

import type {
  CrashType,
  CrashSeverity,
  CrashDetectorConfig,
  SystemStateSnapshot,
  StackFrame,
  CrashReport,
  RecoveryAction,
  RecoveryResult
} from './types.js';

/**
 * Default crash detector configuration
 */
const DEFAULT_CONFIG: CrashDetectorConfig = {
  // Detection settings
  enableUncaughtException: true,
  enableUnhandledRejection: true,
  enableMemoryThresholds: true,
  enableResourceMonitoring: true,
  
  // Thresholds
  memoryThreshold: 90, // 90% memory usage
  heapThreshold: 1.5 * 1024 * 1024 * 1024, // 1.5GB
  eventLoopLagThreshold: 100, // 100ms
  fileDescriptorThreshold: 1000,
  
  // Monitoring intervals
  monitoringInterval: 5000, // 5 seconds
  analyticsInterval: 60000, // 1 minute
  
  // Recovery settings
  enableAutoRecovery: true,
  maxRecoveryAttempts: 3,
  recoveryTimeout: 30000, // 30 seconds
  gracefulShutdownTimeout: 10000, // 10 seconds
  
  // Data retention
  maxCrashReports: 100,
  retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Privacy settings
  captureEnvironmentVars: false,
  captureStackTraces: true,
  captureSourceCode: false,
  anonymizeUserData: true
};

/**
 * Crash detection and monitoring system
 */
export class CrashDetector {
  private config: CrashDetectorConfig;
  private monitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private analyticsInterval?: NodeJS.Timeout;
  private recoveryActions: Map<string, RecoveryAction> = new Map();
  private crashHistory: CrashReport[] = [];
  private startTime: number;
  private crashCallback?: (crash: CrashReport) => void;
  
  // Event handlers
  private uncaughtExceptionHandler?: (error: Error) => void;
  private unhandledRejectionHandler?: (reason: any, promise: Promise<any>) => void;
  private beforeExitHandler?: (code: number) => void;
  private warningHandler?: (warning: Error) => void;
  
  // Monitoring state
  
  constructor(config: Partial<CrashDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();
    
    // Add default recovery actions
    this.addDefaultRecoveryActions();
  }
  
  /**
   * Configure the crash detector
   */
  configure(config: Partial<CrashDetectorConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart monitoring with new config if currently monitoring
    if (this.monitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }
  }
  
  /**
   * Get current configuration
   */
  getConfiguration(): CrashDetectorConfig {
    return { ...this.config };
  }
  
  /**
   * Set crash callback handler
   */
  setCrashHandler(callback: (crash: CrashReport) => void): void {
    this.crashCallback = callback;
  }
  
  /**
   * Start crash monitoring
   */
  startMonitoring(): void {
    if (this.monitoring) {
      console.warn('🚨 Crash monitoring is already active');
      return;
    }
    
    console.log('🔍 Starting crash detection monitoring...');
    this.monitoring = true;
    
    // Set up crash handlers
    this.setupCrashHandlers();
    
    // Start periodic monitoring
    if (this.config.enableResourceMonitoring) {
      this.monitoringInterval = setInterval(() => {
        this.performPeriodicMonitoring();
      }, this.config.monitoringInterval);
    }
    
    // Start analytics collection
    this.analyticsInterval = setInterval(() => {
      this.performAnalyticsCollection();
    }, this.config.analyticsInterval);
    
    console.log('✅ Crash monitoring started successfully');
  }
  
  /**
   * Stop crash monitoring
   */
  stopMonitoring(): void {
    if (!this.monitoring) {
      return;
    }
    
    console.log('🛑 Stopping crash detection monitoring...');
    this.monitoring = false;
    
    // Remove crash handlers
    this.removeCrashHandlers();
    
    // Clear intervals
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
      this.analyticsInterval = undefined;
    }
    
    console.log('✅ Crash monitoring stopped');
  }
  
  /**
   * Check if monitoring is active
   */
  isMonitoring(): boolean {
    return this.monitoring;
  }
  
  /**
   * Report a crash manually
   */
  async reportCrash(error: Error, context?: any): Promise<CrashReport> {
    console.log(`💥 CRASH DETECTED: ${error.message}`);
    
    const crashType = this.determineCrashType(error);
    const severity = this.determineCrashSeverity(error, crashType);
    const systemState = await this.captureSystemState();
    
    const crashReport: CrashReport = {
      id: randomUUID(),
      timestamp: new Date(),
      type: crashType,
      severity,
      
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        stackFrames: this.parseStackTrace(error.stack),
        code: (error as any).code,
        signal: (error as any).signal,
        errno: (error as any).errno
      },
      
      systemState,
      
      context: {
        operation: context?.operation,
        userAction: context?.userAction,
        requestId: context?.requestId,
        sessionId: context?.sessionId,
        componentPath: context?.componentPath,
        executionContext: this.determineExecutionContext()
      },
      
      recovery: {
        attempted: false,
        actions: [],
        finalState: 'failed',
        recoveryDuration: 0
      },
      
      analytics: {
        timeToFailure: Date.now() - this.startTime,
        similarCrashesCount: this.countSimilarCrashes(error),
        impactRadius: this.analyzeImpactRadius(error, context),
        correlatedEvents: this.findCorrelatedEvents(),
        resourceLeakDetected: this.detectResourceLeak(systemState)
      },
      
      metadata: {
        version: process.version,
        environment: process.env.NODE_ENV || 'unknown',
        buildId: process.env.BUILD_ID,
        deploymentId: process.env.DEPLOYMENT_ID,
        userId: this.config.anonymizeUserData ? undefined : context?.userId,
        deviceId: this.generateDeviceId()
      }
    };
    
    // Attempt recovery if enabled
    if (this.config.enableAutoRecovery) {
      crashReport.recovery = await this.attemptRecovery(crashReport);
    }
    
    // Store crash report
    this.storeCrashReport(crashReport);
    
    console.log(`📋 Crash report generated: ${crashReport.id}`);
    return crashReport;
  }
  
  /**
   * Add a recovery action
   */
  addRecoveryAction(action: RecoveryAction): void {
    this.recoveryActions.set(action.id, action);
    console.log(`🔧 Added recovery action: ${action.id} (${action.type})`);
  }
  
  /**
   * Remove a recovery action
   */
  removeRecoveryAction(actionId: string): boolean {
    const removed = this.recoveryActions.delete(actionId);
    if (removed) {
      console.log(`🗑️ Removed recovery action: ${actionId}`);
    }
    return removed;
  }
  
  /**
   * List all recovery actions
   */
  listRecoveryActions(): RecoveryAction[] {
    return Array.from(this.recoveryActions.values());
  }
  
  /**
   * Get crash history
   */
  getCrashHistory(): CrashReport[] {
    // Clean up old reports based on retention policy
    const cutoffTime = Date.now() - this.config.retentionPeriod;
    this.crashHistory = this.crashHistory.filter(
      report => report.timestamp.getTime() > cutoffTime
    );
    
    return [...this.crashHistory];
  }
  
  /**
   * Set up crash detection handlers
   */
  private setupCrashHandlers(): void {
    // Uncaught exception handler
    if (this.config.enableUncaughtException) {
      this.uncaughtExceptionHandler = (error: Error) => {
        this.handleUncaughtException(error);
      };
      process.on('uncaughtException', this.uncaughtExceptionHandler);
    }
    
    // Unhandled promise rejection handler
    if (this.config.enableUnhandledRejection) {
      this.unhandledRejectionHandler = (reason: any, promise: Promise<any>) => {
        this.handleUnhandledRejection(reason, promise);
      };
      process.on('unhandledRejection', this.unhandledRejectionHandler);
    }
    
    // Process warning handler
    this.warningHandler = (warning: Error) => {
      this.handleProcessWarning(warning);
    };
    process.on('warning', this.warningHandler);
    
    // Before exit handler
    this.beforeExitHandler = (code: number) => {
      this.handleBeforeExit(code);
    };
    process.on('beforeExit', this.beforeExitHandler);
  }
  
  /**
   * Remove crash detection handlers
   */
  private removeCrashHandlers(): void {
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
    
    if (this.beforeExitHandler) {
      process.removeListener('beforeExit', this.beforeExitHandler);
      this.beforeExitHandler = undefined;
    }
  }
  
  /**
   * Handle uncaught exception
   */
  private async handleUncaughtException(error: Error): Promise<void> {
    try {
      const crashReport = await this.reportCrash(error, {
        operation: 'uncaught-exception',
        executionContext: 'global'
      });
      
      console.error('💥 UNCAUGHT EXCEPTION - CRASH REPORT:', crashReport.id);
      
      // Attempt graceful shutdown
      setTimeout(() => {
        console.error('🚨 Forced shutdown after graceful shutdown timeout');
        process.exit(1);
      }, this.config.gracefulShutdownTimeout);
      
      // If recovery was successful, don't exit
      if (crashReport.recovery.finalState === 'recovered') {
        console.log('✅ Recovery successful, continuing execution');
        return;
      }
      
      // Graceful shutdown
      process.exit(1);
      
    } catch (reportingError) {
      console.error('❌ Failed to report uncaught exception:', reportingError);
      process.exit(1);
    }
  }
  
  /**
   * Handle unhandled promise rejection
   */
  private async handleUnhandledRejection(reason: any, promise: Promise<any>): Promise<void> {
    try {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      const crashReport = await this.reportCrash(error, {
        operation: 'unhandled-rejection',
        promise: promise.toString()
      });
      
      console.error('🔥 UNHANDLED REJECTION - CRASH REPORT:', crashReport.id);
      
    } catch (reportingError) {
      console.error('❌ Failed to report unhandled rejection:', reportingError);
    }
  }
  
  /**
   * Handle process warnings
   */
  private handleProcessWarning(warning: Error): void {
    // Check if warning indicates potential crash
    const warningMessage = warning.message.toLowerCase();
    const criticalWarnings = [
      'memory leak',
      'maxlisteners',
      'deprecation',
      'experimental'
    ];
    
    const isCritical = criticalWarnings.some(pattern => 
      warningMessage.includes(pattern)
    );
    
    if (isCritical) {
      // Report as potential crash
      this.reportCrash(warning, {
        operation: 'process-warning',
        severity: 'medium'
      }).catch(error => {
        console.error('❌ Failed to report process warning:', error);
      });
    }
  }
  
  /**
   * Handle before exit
   */
  private handleBeforeExit(code: number): void {
    if (code !== 0) {
      console.log(`⚠️ Process exiting with code: ${code}`);
    }
    
    // Perform cleanup
    this.stopMonitoring();
  }
  
  /**
   * Perform periodic monitoring checks
   */
  private async performPeriodicMonitoring(): Promise<void> {
    try {
      const systemState = await this.captureSystemState();
      
      // Check memory thresholds
      if (this.config.enableMemoryThresholds) {
        this.checkMemoryThresholds(systemState);
      }
      
      // Check event loop lag
      this.checkEventLoopLag(systemState);
      
      // Check resource limits
      this.checkResourceLimits(systemState);
      
    } catch (error) {
      console.error('❌ Error during periodic monitoring:', error);
    }
  }
  
  /**
   * Perform analytics collection
   */
  private performAnalyticsCollection(): void {
    // This would collect analytics data for trend analysis
    // Implementation would depend on analytics backend
    console.log('📊 Collecting crash analytics data...');
  }
  
  /**
   * Capture current system state
   */
  private async captureSystemState(): Promise<SystemStateSnapshot> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Calculate event loop lag
    const start = performance.now();
    await new Promise(resolve => setImmediate(resolve));
    const lag = performance.now() - start;
    
    // Get heap statistics
    const v8 = await import('v8');
    const heapStats = v8.getHeapStatistics();
    const heapSpaces = v8.getHeapSpaceStatistics();
    
    return {
      timestamp: new Date(),
      processInfo: {
        pid: process.pid,
        ppid: process.ppid,
        memoryUsage,
        cpuUsage,
        uptime: process.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        version: process.version
      },
      heap: {
        used: heapStats.used_heap_size,
        total: heapStats.total_heap_size,
        limit: heapStats.heap_size_limit,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
        spaces: heapSpaces.map(space => ({
          spaceName: space.space_name,
          spaceSize: space.space_size,
          spaceUsedSize: space.space_used_size,
          spaceAvailableSize: space.space_available_size,
          physicalSpaceSize: space.physical_space_size
        }))
      },
      eventLoop: {
        lag: lag,
        utilization: 0 // Would need additional monitoring
      },
      handles: {
        active: (process as any)._getActiveHandles().length,
        refs: (process as any)._getActiveRequests().length
      },
      resources: {
        openFileDescriptors: 0, // Would need platform-specific implementation
        maxFileDescriptors: 0,
        networkConnections: 0
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        workingDirectory: process.cwd(),
        environmentVariables: this.config.captureEnvironmentVars ? 
          Object.fromEntries(
            Object.entries(process.env)
              .filter(([_, value]) => value !== undefined)
              .map(([key, value]) => [key, value as string])
          ) : {}
      }
    };
  }
  
  /**
   * Check memory usage thresholds
   */
  private checkMemoryThresholds(systemState: SystemStateSnapshot): void {
    const heapUsagePercent = (systemState.heap.used / systemState.heap.total) * 100;
    
    if (heapUsagePercent > this.config.memoryThreshold) {
      const error = new Error(`Memory usage exceeded threshold: ${heapUsagePercent.toFixed(2)}%`);
      error.name = 'MemoryThresholdExceeded';
      
      this.reportCrash(error, {
        operation: 'memory-monitoring',
        systemState,
        threshold: this.config.memoryThreshold
      }).catch(reportError => {
        console.error('❌ Failed to report memory threshold crash:', reportError);
      });
    }
  }
  
  /**
   * Check event loop lag
   */
  private checkEventLoopLag(systemState: SystemStateSnapshot): void {
    if (systemState.eventLoop.lag > this.config.eventLoopLagThreshold) {
      const error = new Error(`Event loop lag exceeded threshold: ${systemState.eventLoop.lag.toFixed(2)}ms`);
      error.name = 'EventLoopLagExceeded';
      
      this.reportCrash(error, {
        operation: 'event-loop-monitoring',
        lag: systemState.eventLoop.lag,
        threshold: this.config.eventLoopLagThreshold
      }).catch(reportError => {
        console.error('❌ Failed to report event loop lag crash:', reportError);
      });
    }
  }
  
  /**
   * Check resource limits
   */
  private checkResourceLimits(systemState: SystemStateSnapshot): void {
    const activeHandles = systemState.handles.active;
    
    if (activeHandles > this.config.fileDescriptorThreshold) {
      const error = new Error(`Active handles exceeded threshold: ${activeHandles}`);
      error.name = 'ResourceLimitExceeded';
      
      this.reportCrash(error, {
        operation: 'resource-monitoring',
        activeHandles,
        threshold: this.config.fileDescriptorThreshold
      }).catch(reportError => {
        console.error('❌ Failed to report resource limit crash:', reportError);
      });
    }
  }
  
  /**
   * Determine crash type from error
   */
  private determineCrashType(error: Error): CrashType {
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();
    
    // Specific error type mappings
    if (errorName.includes('rangeerror') || errorMessage.includes('stack overflow')) {
      return 'stack-overflow';
    }
    
    if (errorName.includes('memory') || errorMessage.includes('memory') || 
        errorMessage.includes('heap')) {
      return 'memory-error';
    }
    
    if (errorMessage.includes('timeout')) {
      return 'timeout-error';
    }
    
    if (errorMessage.includes('assert')) {
      return 'assertion-failure';
    }
    
    // Check error codes
    const errorCode = (error as any).code;
    if (errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND' || 
        errorCode === 'ETIMEDOUT') {
      return 'timeout-error';
    }
    
    // Default categorization
    if (error.stack?.includes('unhandledRejection')) {
      return 'unhandled-rejection';
    }
    
    return 'uncaught-exception';
  }
  
  /**
   * Determine crash severity
   */
  private determineCrashSeverity(_error: Error, crashType: CrashType): CrashSeverity {
    // Critical crashes that require immediate attention
    if (crashType === 'segmentation-fault' || crashType === 'stack-overflow' ||
        crashType === 'memory-error') {
      return 'critical';
    }
    
    // High severity crashes
    if (crashType === 'uncaught-exception' || crashType === 'resource-exhaustion') {
      return 'high';
    }
    
    // Medium severity
    if (crashType === 'unhandled-rejection' || crashType === 'assertion-failure') {
      return 'medium';
    }
    
    // Low severity
    return 'low';
  }
  
  /**
   * Parse stack trace into structured format
   */
  private parseStackTrace(stack?: string): StackFrame[] {
    if (!stack || !this.config.captureStackTraces) {
      return [];
    }
    
    const frames: StackFrame[] = [];
    const lines = stack.split('\n').slice(1); // Skip first line (error message)
    
    for (const line of lines) {
      const frame = this.parseStackFrame(line.trim());
      if (frame) {
        frames.push(frame);
      }
    }
    
    return frames;
  }
  
  /**
   * Parse individual stack frame
   */
  private parseStackFrame(line: string): StackFrame | null {
    // Match various stack trace formats
    const patterns = [
      // at functionName (file:line:column)
      /at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/,
      // at file:line:column
      /at\s+(.+):(\d+):(\d+)/,
      // at functionName
      /at\s+(.+)/
    ];
    
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        return {
          function: match[1] === match[2] ? undefined : match[1],
          file: match[2],
          line: match[3] ? parseInt(match[3], 10) : undefined,
          column: match[4] ? parseInt(match[4], 10) : undefined,
          source: line,
          isNative: line.includes('native'),
          isConstructor: line.includes('new '),
          isAsync: line.includes('async')
        };
      }
    }
    
    return {
      function: undefined,
      file: undefined,
      line: undefined,
      column: undefined,
      source: line,
      isNative: line.includes('native'),
      isConstructor: line.includes('new '),
      isAsync: line.includes('async')
    };
  }
  
  /**
   * Attempt recovery from crash
   */
  private async attemptRecovery(crashReport: CrashReport): Promise<CrashReport['recovery']> {
    console.log(`🔧 Attempting recovery for crash: ${crashReport.id}`);
    const startTime = Date.now();
    
    const recovery: CrashReport['recovery'] = {
      attempted: true,
      actions: [],
      finalState: 'failed',
      recoveryDuration: 0
    };
    
    // Get applicable recovery actions
    const applicableActions = this.getApplicableRecoveryActions(crashReport);
    
    if (applicableActions.length === 0) {
      console.log('❌ No applicable recovery actions found');
      recovery.recoveryDuration = Date.now() - startTime;
      return recovery;
    }
    
    // Execute recovery actions in priority order
    let recoverySuccessful = false;
    
    for (const action of applicableActions) {
      if (recovery.actions.length >= this.config.maxRecoveryAttempts) {
        console.log(`⚠️ Maximum recovery attempts (${this.config.maxRecoveryAttempts}) reached`);
        break;
      }
      
      try {
        console.log(`🔧 Executing recovery action: ${action.id} (${action.type})`);
        const result = await this.executeRecoveryAction(action);
        recovery.actions.push(result);
        
        if (result.success) {
          recoverySuccessful = true;
          console.log(`✅ Recovery action successful: ${action.id}`);
          
          // If this is an automated action, we might be able to continue
          if (action.automated) {
            recovery.finalState = 'recovered';
            break;
          } else {
            recovery.finalState = 'partial-recovery';
          }
        } else {
          console.log(`❌ Recovery action failed: ${action.id}`);
        }
        
      } catch (error) {
        console.error(`❌ Error executing recovery action ${action.id}:`, error);
        recovery.actions.push({
          success: false,
          actionId: action.id,
          duration: 0,
          error: error as Error
        });
      }
    }
    
    // Set final state if not already set
    if (recovery.finalState === 'failed' && recoverySuccessful) {
      recovery.finalState = 'partial-recovery';
    }
    
    recovery.recoveryDuration = Date.now() - startTime;
    console.log(`🏁 Recovery completed in ${recovery.recoveryDuration}ms, final state: ${recovery.finalState}`);
    
    return recovery;
  }
  
  /**
   * Get applicable recovery actions for a crash
   */
  private getApplicableRecoveryActions(crashReport: CrashReport): RecoveryAction[] {
    return Array.from(this.recoveryActions.values())
      .filter(action => this.isRecoveryActionApplicable(action, crashReport))
      .sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)
  }
  
  /**
   * Check if recovery action is applicable to crash
   */
  private isRecoveryActionApplicable(action: RecoveryAction, crashReport: CrashReport): boolean {
    const conditions = action.conditions;
    if (!conditions) {
      return true; // No conditions, always applicable
    }
    
    // Check crash type conditions
    if (conditions.crashType && !conditions.crashType.includes(crashReport.type)) {
      return false;
    }
    
    // Check severity conditions
    if (conditions.severity && !conditions.severity.includes(crashReport.severity)) {
      return false;
    }
    
    // Check resource threshold conditions
    if (conditions.resourceThreshold) {
      const memoryUsage = crashReport.systemState.heap.used / crashReport.systemState.heap.total;
      if (memoryUsage < conditions.resourceThreshold) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Execute a recovery action
   */
  private async executeRecoveryAction(action: RecoveryAction): Promise<RecoveryResult> {
    const startTime = Date.now();
    
    try {
      // Set timeout for recovery action
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Recovery action timeout: ${action.id}`));
        }, action.timeout);
      });
      
      const result = await Promise.race([
        action.execute(),
        timeoutPromise
      ]);
      
      const duration = Date.now() - startTime;
      
      return {
        ...result,
        duration
      };
      
    } catch (error) {
      return {
        success: false,
        actionId: action.id,
        duration: Date.now() - startTime,
        error: error as Error
      };
    }
  }
  
  /**
   * Add default recovery actions
   */
  private addDefaultRecoveryActions(): void {
    // Memory cleanup action
    this.addRecoveryAction({
      id: 'memory-cleanup',
      type: 'cleanup-resources',
      description: 'Perform garbage collection and memory cleanup',
      priority: 100,
      automated: true,
      timeout: 5000,
      retryCount: 2,
      conditions: {
        crashType: ['memory-error', 'resource-exhaustion'],
        severity: ['high', 'critical']
      },
      execute: async () => {
        if (global.gc) {
          global.gc();
        }
        
        // Clear any large caches or temporary data
        return {
          success: true,
          actionId: 'memory-cleanup',
          duration: 0,
          resourcesRecovered: {
            memory: 0, // Would calculate actual memory recovered
            handles: 0,
            connections: 0
          }
        };
      }
    });
    
    // Graceful shutdown action
    this.addRecoveryAction({
      id: 'graceful-shutdown',
      type: 'graceful-shutdown',
      description: 'Perform graceful application shutdown',
      priority: 10,
      automated: false,
      timeout: 10000,
      retryCount: 1,
      conditions: {
        severity: ['critical']
      },
      execute: async () => {
        console.log('🔄 Initiating graceful shutdown...');
        
        return {
          success: true,
          actionId: 'graceful-shutdown',
          duration: 0,
          stateRestored: false
        };
      }
    });
  }
  
  /**
   * Store crash report in history
   */
  private storeCrashReport(crashReport: CrashReport): void {
    this.crashHistory.unshift(crashReport);
    
    // Enforce maximum history size
    if (this.crashHistory.length > this.config.maxCrashReports) {
      this.crashHistory = this.crashHistory.slice(0, this.config.maxCrashReports);
    }
    
    // Call crash callback if set
    if (this.crashCallback) {
      try {
        this.crashCallback(crashReport);
      } catch (error) {
        console.error('Error in crash callback:', error);
      }
    }
  }
  
  /**
   * Count similar crashes in history
   */
  private countSimilarCrashes(error: Error): number {
    return this.crashHistory.filter(crash => 
      crash.error.name === error.name || 
      crash.error.message === error.message
    ).length;
  }
  
  /**
   * Analyze impact radius of crash
   */
  private analyzeImpactRadius(_error: Error, context?: any): string[] {
    const impact: string[] = [];
    
    // Add component path if available
    if (context?.componentPath) {
      impact.push(...context.componentPath);
    }
    
    // Add operation context
    if (context?.operation) {
      impact.push(context.operation);
    }
    
    return impact;
  }
  
  /**
   * Find correlated events
   */
  private findCorrelatedEvents(): string[] {
    // This would implement correlation analysis
    // For now, return empty array
    return [];
  }
  
  /**
   * Detect resource leaks
   */
  private detectResourceLeak(systemState: SystemStateSnapshot): boolean {
    // Simple heuristic: high memory usage with many active handles
    const memoryUsagePercent = (systemState.heap.used / systemState.heap.total) * 100;
    const highMemoryUsage = memoryUsagePercent > 80;
    const manyHandles = systemState.handles.active > 100;
    
    return highMemoryUsage && manyHandles;
  }
  
  /**
   * Determine execution context
   */
  private determineExecutionContext(): string {
    // Simple context determination based on call stack
    const stack = new Error().stack;
    if (stack?.includes('test')) {
      return 'test';
    }
    if (stack?.includes('cli')) {
      return 'cli';
    }
    if (stack?.includes('server')) {
      return 'server';
    }
    return 'application';
  }
  
  /**
   * Generate device ID for crash tracking
   */
  private generateDeviceId(): string {
    // Simple device ID based on hostname and platform
    return Buffer.from(`${os.hostname()}-${os.platform()}-${os.arch()}`)
      .toString('base64')
      .substring(0, 16);
  }
}