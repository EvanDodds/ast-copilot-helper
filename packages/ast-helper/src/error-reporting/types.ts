/**
 * Error Reporting System Types and Interfaces
 * Comprehensive error reporting with diagnostics and suggestions
 */

/**
 * Main error reporting manager interface
 */
export interface ErrorReportingManager {
  initialize(config: ErrorReportingConfig): Promise<void>;
  reportError(error: ErrorReport): Promise<ReportResult>;
  reportCrash(crashReport: CrashReport): Promise<ReportResult>;
  collectDiagnostics(context: DiagnosticContext): Promise<DiagnosticData>;
  generateErrorReport(error: Error, context?: any): Promise<ErrorReport>;
  provideSuggestions(error: ErrorReport): Promise<SuggestionResult[]>;
  exportDiagnostics(format: 'json' | 'text'): Promise<string>;
  getErrorHistory(): Promise<ErrorHistoryEntry[]>;
  clearErrorHistory(): Promise<void>;
}

/**
 * Configuration for error reporting system
 */
export interface ErrorReportingConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
  enableCrashReporting: boolean;
  enableAutomaticReporting: boolean;
  collectSystemInfo: boolean;
  collectCodebaseInfo: boolean;
  maxReportSize: number; // bytes
  maxHistoryEntries: number;
  privacyMode: boolean;
  userReportingEnabled: boolean;
  diagnosticDataCollection: DiagnosticDataConfig;
}

/**
 * Configuration for diagnostic data collection
 */
export interface DiagnosticDataConfig {
  system: boolean;
  runtime: boolean;
  codebase: boolean;
  configuration: boolean;
  performance: boolean;
  dependencies: boolean;
  maxCollectionTimeMs: number;
  includeEnvironmentVars: boolean;
  includeProcessInfo: boolean;
}

/**
 * Comprehensive error report structure
 */
export interface ErrorReport {
  id: string;
  timestamp: Date;
  type: 'error' | 'crash' | 'warning' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  operation: string;
  message: string;
  originalError?: Error;
  stackTrace?: string;
  context: ErrorContext;
  environment: EnvironmentInfo;
  diagnostics: DiagnosticData;
  userProvided: boolean;
  reportedToServer: boolean;
  suggestions: SuggestionResult[];
  resolution?: ResolutionInfo;
}

/**
 * Error context information
 */
export interface ErrorContext {
  operation: string;
  component: string;
  userId?: string;
  sessionId: string;
  timestamp: Date;
  parameters?: Record<string, any>;
  files?: string[];
  environment?: Record<string, string>;
  userAgent?: string;
  platform: string;
  architecture: string;
  nodeVersion: string;
  processId: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
}

/**
 * System environment information
 */
export interface EnvironmentInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  npmVersion?: string;
  osVersion: string;
  cpuModel: string;
  cpuCores: number;
  totalMemory: number;
  freeMemory: number;
  workingDirectory: string;
  homeDirectory: string;
  tempDirectory: string;
  pathSeparator: string;
  environmentVars: Record<string, string>;
  processArgs: string[];
  processEnv: string;
}

/**
 * Comprehensive diagnostic data
 */
export interface DiagnosticData {
  system: SystemDiagnostics;
  runtime: RuntimeDiagnostics;
  codebase: CodebaseDiagnostics;
  configuration: ConfigurationDiagnostics;
  performance: PerformanceDiagnostics;
  dependencies: DependencyDiagnostics;
}

/**
 * System-level diagnostic information
 */
export interface SystemDiagnostics {
  os: {
    platform: string;
    release: string;
    arch: string;
    version: string;
    uptime: number;
    loadAverage: number[];
  };
  cpu: {
    model: string;
    cores: number;
    speed: number;
    usage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    percentage: number;
    swap?: {
      total: number;
      free: number;
      used: number;
    };
  };
  disk: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  network: {
    interfaces: NetworkInterface[];
    activeConnections: number;
  };
}

/**
 * Network interface information
 */
export interface NetworkInterface {
  name: string;
  family: 'IPv4' | 'IPv6';
  address: string;
  internal: boolean;
  mac: string;
}

/**
 * Runtime diagnostic information
 */
export interface RuntimeDiagnostics {
  node: {
    version: string;
    platform: string;
    arch: string;
    pid: number;
    ppid?: number;
    uptime: number;
    execPath: string;
    execArgv: string[];
    argv: string[];
    env: Record<string, string>;
  };
  heap: {
    used: number;
    total: number;
    limit: number;
    percentage: number;
    external: number;
    arrayBuffers: number;
  };
  gc: {
    collections: number;
    duration: number;
    frequency: number;
    lastCollection?: Date;
  };
  eventLoop: {
    lag: number;
    utilization: number;
  };
  modules: {
    loaded: string[];
    cache: number;
    nativeModules: string[];
  };
}

/**
 * Codebase diagnostic information
 */
export interface CodebaseDiagnostics {
  structure: {
    totalFiles: number;
    totalDirectories: number;
    totalSize: number;
    languages: Record<string, number>;
    fileTypes: Record<string, number>;
    largestFiles: FileInfo[];
  };
  git: {
    isRepository: boolean;
    branch?: string;
    commit?: string;
    isDirty?: boolean;
    untracked?: number;
    modified?: number;
    remote?: string;
  };
  packages: {
    packageJson: boolean;
    dependencies: number;
    devDependencies: number;
    scripts: string[];
    lockFile: boolean;
    nodeModulesSize?: number;
  };
  complexity: {
    averageLinesPerFile: number;
    maxLinesPerFile: number;
    totalLinesOfCode: number;
    commentPercentage: number;
  };
}

/**
 * File information structure
 */
export interface FileInfo {
  path: string;
  size: number;
  type: string;
  lines?: number;
}

/**
 * Configuration diagnostic information
 */
export interface ConfigurationDiagnostics {
  configFiles: {
    found: string[];
    missing: string[];
    invalid: string[];
    permissions: Record<string, string>;
  };
  settings: {
    current: Record<string, any>;
    defaults: Record<string, any>;
    overrides: Record<string, any>;
  };
  paths: {
    configPaths: string[];
    dataPaths: string[];
    tempPaths: string[];
    logPaths: string[];
    accessible: Record<string, boolean>;
  };
  permissions: {
    read: boolean;
    write: boolean;
    execute: boolean;
    issues: string[];
  };
}

/**
 * Performance diagnostic information
 */
export interface PerformanceDiagnostics {
  cpu: {
    currentUsage: number;
    averageUsage: number;
    peakUsage: number;
    loadHistory: number[];
  };
  memory: {
    currentUsage: number;
    peakUsage: number;
    leakDetected: boolean;
    gcPressure: number;
    allocations: number;
    deallocations: number;
  };
  io: {
    readOperations: number;
    writeOperations: number;
    readBytes: number;
    writtenBytes: number;
    averageLatency: number;
    errorRate: number;
  };
  operations: {
    completed: number;
    failed: number;
    averageDuration: number;
    slowestOperations: OperationInfo[];
  };
}

/**
 * Operation performance information
 */
export interface OperationInfo {
  name: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
}

/**
 * Dependency diagnostic information
 */
export interface DependencyDiagnostics {
  npm: {
    installed: DependencyInfo[];
    outdated: DependencyInfo[];
    vulnerable: VulnerabilityInfo[];
    conflicts: ConflictInfo[];
    missing: string[];
  };
  system: {
    required: string[];
    available: string[];
    versions: Record<string, string>;
  };
  runtime: {
    modules: string[];
    versions: Record<string, string>;
    conflicts: string[];
    loadErrors: string[];
  };
}

/**
 * Dependency information
 */
export interface DependencyInfo {
  name: string;
  version: string;
  required: string;
  location: string;
  size: number;
}

/**
 * Security vulnerability information
 */
export interface VulnerabilityInfo {
  package: string;
  version: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
}

/**
 * Dependency conflict information
 */
export interface ConflictInfo {
  package: string;
  requiredVersions: string[];
  resolvedVersion: string;
  source: string[];
}

/**
 * Crash report structure
 */
export interface CrashReport {
  id: string;
  timestamp: Date;
  type: 'uncaughtException' | 'unhandledRejection' | 'signal' | 'memoryLimit';
  exitCode?: number;
  signal?: string;
  error: Error;
  context: ErrorContext;
  memoryDump?: MemoryDump;
  processInfo: ProcessInfo;
  lastOperations: string[];
  stackTrace: string;
  heapSnapshot?: string; // path to heap snapshot file
  coreDump?: string; // path to core dump file
}

/**
 * Memory dump information
 */
export interface MemoryDump {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  objectCounts: Record<string, number>;
  largestObjects: ObjectInfo[];
}

/**
 * Object information in memory
 */
export interface ObjectInfo {
  type: string;
  size: number;
  count: number;
  retainers?: string[];
}

/**
 * Process information at crash time
 */
export interface ProcessInfo {
  pid: number;
  ppid?: number;
  uptime: number;
  cpuUsage: NodeJS.CpuUsage;
  memoryUsage: NodeJS.MemoryUsage;
  resourceUsage?: NodeJS.ResourceUsage;
  argv: string[];
  execArgv: string[];
  platform: string;
  arch: string;
  version: string;
  versions: Record<string, string>;
}

/**
 * Error resolution suggestion
 */
export interface SuggestionResult {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  category: 'fix' | 'workaround' | 'information';
  confidence: number; // 0-1
  commands?: string[];
  links?: string[];
  estimatedTime?: string;
  prerequisites?: string[];
  steps?: string[];
}

/**
 * Context for diagnostic collection
 */
export interface DiagnosticContext {
  error?: Error;
  operation?: string;
  context?: any;
  timestamp: Date;
  includeSystemInfo?: boolean;
  includeRuntimeInfo?: boolean;
  includeCodebaseInfo?: boolean;
}

/**
 * Result of error reporting operation
 */
export interface ReportResult {
  success: boolean;
  errorId: string;
  suggestions?: SuggestionResult[];
  serverReported?: boolean;
  message: string;
  error?: Error;
}

/**
 * Error history entry
 */
export interface ErrorHistoryEntry {
  id: string;
  timestamp: Date;
  error: ErrorReport;
  resolved: boolean;
  resolvedAt?: Date;
  resolution?: ResolutionInfo;
  userFeedback?: UserFeedback;
}

/**
 * Error resolution information
 */
export interface ResolutionInfo {
  type: 'auto' | 'manual' | 'suggestion';
  method: string;
  timestamp: Date;
  success: boolean;
  duration: number;
  steps: string[];
  feedback?: UserFeedback;
}

/**
 * User feedback on error resolution
 */
export interface UserFeedback {
  helpful: boolean;
  rating: number; // 1-5
  comment?: string;
  suggestionsUsed: string[];
  timeToResolve?: number;
}

/**
 * Error analytics data structure
 */
export interface ErrorAnalytics {
  period: {
    start: Date;
    end: Date;
    duration: number;
  };
  summary: {
    totalErrors: number;
    resolvedErrors: number;
    unresolvedErrors: number;
    criticalErrors: number;
    errorRate: number;
    resolutionRate: number;
    averageResolutionTime: number;
  };
  distribution: {
    severity: Record<string, number>;
    category: Record<string, number>;
    byTime: Array<{ timestamp: Date; count: number }>;
  };
  trends: ErrorTrend[];
  patterns: ErrorPattern[];
  correlations: any[];
  recommendations: string[];
}

/**
 * Error trend analysis
 */
export interface ErrorTrend {
  type: 'frequency' | 'severity' | 'category' | 'temporal';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
}

/**
 * Error pattern detection
 */
export interface ErrorPattern {
  signature: string;
  frequency: number;
  firstSeen: Date;
  lastSeen: Date;
  avgTimeBetweenOccurrences: number;
  associatedOperations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Error correlation analysis
 */
export interface ErrorCorrelation {
  errorType1: string;
  errorType2: string;
  correlationStrength: number; // 0-1
  occurrences: number;
  timeWindow: string;
  confidence: number;
}

/**
 * Error frequency data point
 */
export interface ErrorFrequencyPoint {
  timestamp: Date;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  errorTypes: string[];
  categories: string[];
}

/**
 * System health metrics
 */
export interface SystemHealthMetrics {
  overallHealthScore: number; // 0-100
  errorRate: number; // errors per hour
  criticalErrorRate: number;
  averageResolutionTime: number; // minutes
  mostFrequentErrors: Array<{
    type: string;
    count: number;
    lastOccurrence: Date;
  }>;
  improvementSuggestions: string[];
}

// Privacy and Security Types

/**
 * User consent data for privacy compliance
 */
export interface ConsentData {
  level: number; // ConsentLevel enum value
  categories: string[];
  timestamp: Date;
  version: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Privacy settings configuration
 */
export interface PrivacySettings {
  requireConsent: boolean;
  retentionDays: number;
  anonymizationLevel: 'none' | 'basic' | 'strict' | 'full';
  enablePiiScrubbing: boolean;
  allowedCategories: string[];
  enableEncryption: boolean;
  gdprCompliance: boolean;
  ccpaCompliance: boolean;
}

/**
 * Data retention policy configuration
 */
export interface DataRetentionPolicy {
  defaultRetentionDays: number;
  categorySpecificRetention: Record<string, number>;
  automaticCleanup: boolean;
  cleanupInterval: number; // hours
  archiveBeforeDelete: boolean;
  complianceRequirements: string[];
}

/**
 * Security configuration for error reporting
 */
export interface SecurityConfig {
  enableEncryption: boolean;
  encryptionAlgorithm: string;
  keyRotationInterval: number; // days
  enableTransmissionSecurity: boolean;
  allowedOrigins: string[];
  rateLimiting: {
    enabled: boolean;
    maxRequestsPerMinute: number;
    blacklistDuration: number; // minutes
  };
  authentication: {
    required: boolean;
    method: 'apiKey' | 'oauth' | 'jwt';
    keyValidationUrl?: string;
  };
}

/**
 * Data filter result
 */
export interface FilterResult {
  blocked: boolean;
  modified: boolean;
  data?: any;
  reason?: string;
  appliedFilters: string[];
}