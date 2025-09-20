/**
 * Cross-Platform Compatibility Testing Types
 * Types and interfaces for comprehensive cross-platform testing
 */

export interface PlatformTester {
  testPlatformCompatibility(): Promise<PlatformTestResults>;
  validateBinaryDistribution(): Promise<BinaryValidation>;
  testFileSystemCompatibility(): Promise<FileSystemTestResult>;
  validatePathHandling(): Promise<PathTestResults>;
  testNodeVersionCompatibility(): Promise<NodeVersionTests>;
  runPlatformSpecificTests(): Promise<PlatformSpecificResults>;
}

export interface PlatformTestResults {
  windows: PlatformResult;
  macos: PlatformResult;
  linux: PlatformResult;
  summary: CompatibilitySummary;
}

export interface PlatformResult {
  platform: string;
  architecture: string;
  nodeVersion: string;
  testResults: TestResult[];
  binaryTests: BinaryTestResult[];
  fileSystemTests: FileSystemTestResult[];
  performanceMetrics: PlatformPerformanceMetrics;
  issues: PlatformIssue[];
}

/**
 * Test result categories for cross-platform compatibility testing
 */
export type TestCategory = 
  | 'parsing' 
  | 'indexing' 
  | 'querying' 
  | 'file_operations' 
  | 'mcp_server' 
  | 'platform_specific'
  | 'filesystem'
  | 'binary'
  | 'nodejs'
  | 'performance';

/**
 * Core test result interface
 */
export interface TestResult {
  name: string;
  category: TestCategory;
  passed: boolean;
  error?: string;
  platform: string;
  duration: number;
  details?: Record<string, any>;
}

/**
 * Binary compatibility test result
 */
export interface BinaryTestResult {
  platform: string;
  architecture: string;
  nodeVersion: string;
  testResults: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
    compatibility: number;
  };
}

export interface BinaryValidation {
  platform: string;
  architecture: string;
  nodeVersion: string;
  binaryTests: BinaryComponentResult[];
  dependencyTests: DependencyTestResult[];
  nativeModuleTests: BinaryComponentResult[];
}

export interface BinaryComponentResult {
  component: string;
  platform: string;
  architecture: string;
  success: boolean;
  version?: string;
  error?: string;
  loadTime: number;
}

export interface DependencyTestResult {
  dependency: string;
  version: string;
  available: boolean;
  compatible: boolean;
  issues: string[];
}

export interface FileSystemTests {
  pathSeparators: TestResult;
  caseSensitivity: TestResult;
  specialCharacters: TestResult;
  longPaths: TestResult;
  permissions: TestResult;
  symbolicLinks: TestResult;
  unicode: TestResult;
}

export interface FileSystemTestResult {
  platform: string;
  testResults: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  };
  caseSensitive: boolean;
  pathSeparator: string;
  maxPathLength: number;
  supportsSymlinks: boolean;
  supportsHardlinks: boolean;
}

export interface PathTestResults {
  pathNormalization: TestResult[];
  pathResolution: TestResult[];
  pathValidation: TestResult[];
  crossPlatformPaths: TestResult[];
}

export interface NodeVersionTests {
  currentVersion: string;
  supportedFeatures: FeatureTest[];
  unsupportedFeatures: string[];
  performanceMetrics: Record<string, number>;
}

export interface FeatureTest {
  feature: string;
  supported: boolean;
  version: string;
  testResult: TestResult;
}

export interface PlatformSpecificResults {
  windows?: WindowsSpecificTests;
  macos?: MacOSSpecificTests;
  linux?: LinuxSpecificTests;
}

export interface WindowsSpecificTests {
  powerShellCompatibility: TestResult;
  cmdCompatibility: TestResult;
  pathLengthLimits: TestResult;
  filePermissions: TestResult;
  driveLetters: TestResult;
}

export interface MacOSSpecificTests {
  appleSymbolicLinks: TestResult;
  bundleCompatibility: TestResult;
  securityPolicies: TestResult;
  packageManagement: TestResult;
  fileAttributes: TestResult;
}

export interface LinuxSpecificTests {
  distributionCompatibility: TestResult[];
  packageManagement: TestResult[];
  containerCompatibility: TestResult;
  filePermissions: TestResult;
  symbolicLinks: TestResult;
}

export interface PlatformPerformanceMetrics {
  parsingTime: number;
  indexingTime: number;
  queryTime: number;
  memoryUsage: number;
  diskUsage: number;
}

export interface PlatformIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  platform: string;
  workaround?: string;
  relatedTests: string[];
}

export interface CompatibilitySummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  platformIssues: PlatformIssue[];
  recommendations: string[];
}

export interface CrossPlatformTestConfig {
  platforms: string[];
  nodeVersions: string[];
  testCategories: TestCategory[];
  skipBinaryTests: boolean;
  skipPerformanceTests: boolean;
  timeout: number;
}

export interface TestExecutionContext {
  platform: NodeJS.Platform;
  architecture: string;
  nodeVersion: string;
  workingDirectory: string;
  tempDirectory: string;
  timeout: number;
}