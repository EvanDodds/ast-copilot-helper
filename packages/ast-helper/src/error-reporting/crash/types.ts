/**
 * @fileoverview Types for crash reporting system
 * @module @ast-copilot-helper/ast-helper/error-reporting/crash/types
 */

/**
 * Crash types categorization
 */
export type CrashType = 
  | 'uncaught-exception'
  | 'unhandled-rejection' 
  | 'segmentation-fault'
  | 'memory-error'
  | 'stack-overflow'
  | 'timeout-error'
  | 'resource-exhaustion'
  | 'external-signal'
  | 'assertion-failure'
  | 'unknown';

/**
 * Crash severity levels
 */
export type CrashSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Recovery action types
 */
export type RecoveryActionType = 
  | 'restart-service'
  | 'cleanup-resources'
  | 'reset-state'
  | 'graceful-shutdown'
  | 'emergency-save'
  | 'notify-user'
  | 'fallback-mode'
  | 'isolate-component';

/**
 * Recovery action definition
 */
export interface RecoveryAction {
  id: string;
  type: RecoveryActionType;
  description: string;
  priority: number;
  automated: boolean;
  timeout: number; // milliseconds
  retryCount: number;
  conditions?: {
    crashType?: CrashType[];
    severity?: CrashSeverity[];
    resourceThreshold?: number;
    timeWindow?: number;
  };
  execute: () => Promise<RecoveryResult>;
  rollback?: () => Promise<void>;
}

/**
 * Recovery execution result
 */
export interface RecoveryResult {
  success: boolean;
  actionId: string;
  duration: number;
  error?: Error;
  resourcesRecovered?: {
    memory: number;
    handles: number;
    connections: number;
  };
  stateRestored?: boolean;
  sideEffects?: string[];
}

/**
 * System state snapshot
 */
export interface SystemStateSnapshot {
  timestamp: Date;
  processInfo: {
    pid: number;
    ppid?: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    uptime: number;
    platform: string;
    arch: string;
    version: string;
  };
  heap: {
    used: number;
    total: number;
    limit: number;
    external: number;
    arrayBuffers: number;
    spaces: Array<{
      spaceName: string;
      spaceSize: number;
      spaceUsedSize: number;
      spaceAvailableSize: number;
      physicalSpaceSize: number;
    }>;
  };
  eventLoop: {
    lag: number;
    utilization: number;
  };
  handles: {
    active: number;
    refs: number;
  };
  resources: {
    openFileDescriptors: number;
    maxFileDescriptors: number;
    networkConnections: number;
  };
  environment: {
    nodeEnv: string;
    workingDirectory: string;
    environmentVariables: Record<string, string>;
  };
}

/**
 * Stack frame information
 */
export interface StackFrame {
  function?: string;
  file?: string;
  line?: number;
  column?: number;
  source?: string;
  isNative: boolean;
  isConstructor: boolean;
  isAsync: boolean;
}

/**
 * Enhanced crash report
 */
export interface CrashReport {
  // Basic crash information
  id: string;
  timestamp: Date;
  type: CrashType;
  severity: CrashSeverity;
  
  // Error details
  error: {
    name: string;
    message: string;
    stack?: string;
    stackFrames: StackFrame[];
    code?: string | number;
    signal?: string;
    errno?: number;
  };
  
  // System state at crash
  systemState: SystemStateSnapshot;
  
  // Context information
  context: {
    operation?: string;
    userAction?: string;
    requestId?: string;
    sessionId?: string;
    componentPath?: string[];
    executionContext?: string;
  };
  
  // Recovery information
  recovery: {
    attempted: boolean;
    actions: RecoveryResult[];
    finalState: 'recovered' | 'partial-recovery' | 'failed' | 'graceful-shutdown';
    recoveryDuration: number;
  };
  
  // Analytics data
  analytics: {
    timeToFailure: number; // ms since start
    similarCrashesCount: number;
    impactRadius: string[];
    correlatedEvents: string[];
    resourceLeakDetected: boolean;
  };
  
  // Metadata
  metadata: {
    version: string;
    environment: string;
    buildId?: string;
    deploymentId?: string;
    userId?: string;
    deviceId?: string;
  };
}

/**
 * Crash analytics data
 */
export interface CrashAnalytics {
  period: {
    start: Date;
    end: Date;
    duration: number;
  };
  statistics: {
    totalCrashes: number;
    crashRate: number; // crashes per hour
    severityDistribution: Record<CrashSeverity, number>;
    typeDistribution: Record<CrashType, number>;
    recoverySuccessRate: number;
    meanTimeToRecovery: number;
    meanTimeBetweenFailures: number;
  };
  trends: {
    crashFrequency: Array<{
      timestamp: Date;
      count: number;
      severity: CrashSeverity;
    }>;
    resourceConsumption: Array<{
      timestamp: Date;
      memory: number;
      cpu: number;
      handles: number;
    }>;
    recoveryEffectiveness: Array<{
      timestamp: Date;
      successRate: number;
      averageDuration: number;
    }>;
  };
  patterns: {
    commonStackTraces: Array<{
      signature: string;
      count: number;
      firstSeen: Date;
      lastSeen: Date;
      impactLevel: CrashSeverity;
    }>;
    correlations: Array<{
      events: string[];
      strength: number;
      crashProbability: number;
    }>;
    hotSpots: Array<{
      component: string;
      crashCount: number;
      reliability: number;
    }>;
  };
}

/**
 * Crash detector configuration
 */
export interface CrashDetectorConfig {
  // Detection settings
  enableUncaughtException: boolean;
  enableUnhandledRejection: boolean;
  enableMemoryThresholds: boolean;
  enableResourceMonitoring: boolean;
  
  // Thresholds
  memoryThreshold: number; // percentage
  heapThreshold: number; // bytes
  eventLoopLagThreshold: number; // milliseconds
  fileDescriptorThreshold: number; // count
  
  // Monitoring intervals
  monitoringInterval: number; // milliseconds
  analyticsInterval: number; // milliseconds
  
  // Recovery settings
  enableAutoRecovery: boolean;
  maxRecoveryAttempts: number;
  recoveryTimeout: number; // milliseconds
  gracefulShutdownTimeout: number; // milliseconds
  
  // Data retention
  maxCrashReports: number;
  retentionPeriod: number; // milliseconds
  
  // Privacy settings
  captureEnvironmentVars: boolean;
  captureStackTraces: boolean;
  captureSourceCode: boolean;
  anonymizeUserData: boolean;
}

/**
 * Core dump analysis result
 */
export interface CoreDumpAnalysis {
  dumpId: string;
  analysisTimestamp: Date;
  fileSize: number;
  
  // Memory analysis
  memoryRegions: Array<{
    address: string;
    size: number;
    permissions: string;
    mapping?: string;
    corrupted: boolean;
  }>;
  
  // Thread analysis
  threads: Array<{
    id: number;
    state: string;
    stackTrace: StackFrame[];
    registers?: Record<string, string>;
    faultingThread: boolean;
  }>;
  
  // Heap analysis
  heapAnalysis: {
    totalSize: number;
    fragmentationLevel: number;
    largestFreeBlock: number;
    allocatedObjects: Array<{
      type: string;
      count: number;
      totalSize: number;
    }>;
    suspiciousAllocations: Array<{
      address: string;
      size: number;
      type: string;
      reason: string;
    }>;
  };
  
  // Root cause analysis
  rootCause: {
    primaryCause: string;
    contributingFactors: string[];
    confidence: number;
    recommendations: string[];
  };
}

/**
 * Crash reporting manager interface
 */
export interface CrashReportingManager {
  // Configuration
  configure(config: Partial<CrashDetectorConfig>): void;
  getConfiguration(): CrashDetectorConfig;
  
  // Detection and monitoring
  startMonitoring(): void;
  stopMonitoring(): void;
  isMonitoring(): boolean;
  
  // Manual crash reporting
  reportCrash(error: Error, context?: any): Promise<CrashReport>;
  
  // Recovery management
  addRecoveryAction(action: RecoveryAction): void;
  removeRecoveryAction(actionId: string): boolean;
  listRecoveryActions(): RecoveryAction[];
  
  // Analytics and reporting
  getCrashAnalytics(options?: {
    startDate?: Date;
    endDate?: Date;
    severity?: CrashSeverity[];
    crashTypes?: CrashType[];
  }): Promise<CrashAnalytics>;
  
  getCrashHistory(): Promise<CrashReport[]>;
  exportCrashData(format: 'json' | 'csv'): Promise<string>;
  
  // Core dump analysis
  analyzeCoredumps(): Promise<CoreDumpAnalysis[]>;
  
  // Health monitoring
  getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    metrics: SystemStateSnapshot;
    alerts: string[];
  }>;
}