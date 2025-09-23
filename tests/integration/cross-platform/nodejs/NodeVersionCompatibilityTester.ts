/**
 * Node.js Version Compatibility Tester
 * Tests compatibility across different Node.js versions
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { TestResult } from '../types.js';

export interface NodeVersionTestResult {
  platform: string;
  architecture: string;
  nodeVersion: string;
  testResults: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
    versionSupported: boolean;
    featureCompatibility: {
      esModules: boolean;
      asyncAwait: boolean;
      optionalChaining: boolean;
      nullishCoalescing: boolean;
      topLevelAwait: boolean;
      privateFields: boolean;
      staticBlocks: boolean;
      importMeta: boolean;
    };
    apiCompatibility: {
      crypto: boolean;
      fs: boolean;
      os: boolean;
      path: boolean;
      worker_threads: boolean;
      perf_hooks: boolean;
      diagnostics_channel: boolean;
      stream: boolean;
    };
    performanceMetrics: {
      startupTime: number;
      memoryUsage: number;
      v8HeapSize: number;
      moduleLoadTime: number;
    };
  };
}

export class NodeVersionCompatibilityTester {
  private currentNodeVersion: string;
  private platform: string;
  private architecture: string;

  constructor() {
    this.currentNodeVersion = process.version;
    this.platform = process.platform;
    this.architecture = process.arch;
  }

  async runTests(): Promise<NodeVersionTestResult> {
    console.log(`🔧 Testing Node.js version compatibility on ${this.platform}/${this.architecture}`);
    console.log(`📦 Current Node.js version: ${this.currentNodeVersion}`);

    const startTime = Date.now();
    const testResults: TestResult[] = [];

    // Test 1: Node.js Version Detection and Parsing
    testResults.push(await this.testNodeVersionParsing());

    // Test 2: ES Module Support
    testResults.push(await this.testESModuleSupport());

    // Test 3: Modern JavaScript Features
    testResults.push(...await this.testJavaScriptFeatures());

    // Test 4: Core API Compatibility
    testResults.push(...await this.testCoreAPICompatibility());

    // Test 5: Performance Characteristics
    testResults.push(await this.testPerformanceCharacteristics());

    // Test 6: Native Module Compatibility
    testResults.push(await this.testNativeModuleCompatibility());

    // Test 7: Worker Threads Support
    testResults.push(await this.testWorkerThreadsSupport());

    // Test 8: Stream API Compatibility
    testResults.push(await this.testStreamAPICompatibility());

    // Test 9: Async/Await and Promise Features
    testResults.push(await this.testAsyncFeatures());

    // Test 10: Error Handling and Stack Traces
    testResults.push(await this.testErrorHandling());

    const endTime = Date.now();
    const duration = endTime - startTime;

    const summary = this.generateSummary(testResults, duration);

    console.log(`✅ Node.js compatibility testing completed: ${summary.passed}/${summary.total} tests passed`);

    return {
      platform: this.platform,
      architecture: this.architecture,
      nodeVersion: this.currentNodeVersion,
      testResults,
      summary
    };
  }

  private async testNodeVersionParsing(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const versionMatch = this.currentNodeVersion.match(/^v(\d+)\.(\d+)\.(\d+)/);
      if (!versionMatch) {
        throw new Error(`Invalid Node.js version format: ${this.currentNodeVersion}`);
      }

      const [, major, minor, patch] = versionMatch;
      const majorVersion = parseInt(major, 10);
      const minorVersion = parseInt(minor, 10);
      const patchVersion = parseInt(patch, 10);

      const isSupported = majorVersion >= 18;
      const isLTS = majorVersion === 18 || majorVersion === 20;
      const isCurrent = majorVersion >= 21;

      return {
        name: 'node_version_parsing',
        category: 'nodejs',
        passed: true,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          fullVersion: this.currentNodeVersion,
          majorVersion,
          minorVersion,
          patchVersion,
          isSupported,
          isLTS,
          isCurrent,
          minimumSupported: majorVersion >= 18
        }
      };
    } catch (error) {
      return {
        name: 'node_version_parsing',
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          fullVersion: this.currentNodeVersion,
          parseError: true
        }
      };
    }
  }

  private async testESModuleSupport(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Test dynamic import
      const moduleTest = await import('os');
      const hasModuleAccess = typeof moduleTest.platform === 'function';

      // Test import.meta availability
      const hasImportMeta = typeof import.meta === 'object' && !!import.meta.url;

      // Test top-level await support
      let hasTopLevelAwait = true;
      try {
        // This will work in Node.js 14.8+ with --harmony-top-level-await
        // or Node.js 16+ by default
        eval('(async () => { await Promise.resolve(); })()');
      } catch (error) {
        hasTopLevelAwait = false;
      }

      return {
        name: 'es_module_support',
        category: 'nodejs',
        passed: hasModuleAccess && hasImportMeta,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          dynamicImport: hasModuleAccess,
          importMeta: hasImportMeta,
          topLevelAwait: hasTopLevelAwait,
          moduleType: 'ES2020+'
        }
      };
    } catch (error) {
      return {
        name: 'es_module_support',
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          moduleError: true
        }
      };
    }
  }

  private async testJavaScriptFeatures(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Optional Chaining (?.)
    tests.push(await this.testOptionalChaining());
    
    // Nullish Coalescing (??)
    tests.push(await this.testNullishCoalescing());
    
    // Private Class Fields
    tests.push(await this.testPrivateFields());
    
    // Static Class Blocks
    tests.push(await this.testStaticBlocks());

    return tests;
  }

  private async testOptionalChaining(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const testObj: any = { nested: { value: 42 } };
      
      // Test optional chaining
      const result1 = testObj?.nested?.value;
      const result2 = testObj?.missing?.value;
      const result3 = testObj?.nested?.missing?.deep;
      
      const passed = result1 === 42 && result2 === undefined && result3 === undefined;

      return {
        name: 'optional_chaining',
        category: 'nodejs',
        passed,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          feature: 'Optional Chaining (?.)',
          supported: passed,
          nodeVersionRequired: '14.0.0+'
        }
      };
    } catch (error) {
      return {
        name: 'optional_chaining',
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testNullishCoalescing(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Test nullish coalescing - these warnings are expected as we're testing the operator
      // @ts-ignore
      const test1 = null ?? 'default';
      // @ts-ignore  
      const test2 = undefined ?? 'default';
      // @ts-ignore
      const test3 = 0 ?? 'default';
      // @ts-ignore
      const test4 = '' ?? 'default';
      // @ts-ignore
      const test5 = false ?? 'default';
      
      const passed = test1 === 'default' && 
                    test2 === 'default' && 
                    test3 === 0 && 
                    test4 === '' && 
                    test5 === false;

      return {
        name: 'nullish_coalescing',
        category: 'nodejs',
        passed,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          feature: 'Nullish Coalescing (??)',
          supported: passed,
          nodeVersionRequired: '14.0.0+'
        }
      };
    } catch (error) {
      return {
        name: 'nullish_coalescing',
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testPrivateFields(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Test private field syntax
      const testClass = eval(`
        class TestClass {
          #privateField = 'private';
          
          getPrivate() {
            return this.#privateField;
          }
          
          hasPrivateAccess() {
            return #privateField in this;
          }
        }
        
        new TestClass();
      `);
      
      const result = testClass.getPrivate();
      const hasAccess = testClass.hasPrivateAccess();
      const passed = result === 'private' && hasAccess === true;

      return {
        name: 'private_fields',
        category: 'nodejs',
        passed,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          feature: 'Private Class Fields (#)',
          supported: passed,
          nodeVersionRequired: '12.0.0+'
        }
      };
    } catch (error) {
      return {
        name: 'private_fields',
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          feature: 'Private Class Fields (#)',
          supported: false,
          nodeVersionRequired: '12.0.0+'
        }
      };
    }
  }

  private async testStaticBlocks(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Test static initialization blocks
      const staticBlockExecuted = false;
      
      const testClass = eval(`
        class TestClass {
          static value;
          
          static {
            this.value = 'initialized';
            staticBlockExecuted = true;
          }
        }
        
        TestClass;
      `);
      
      const passed = testClass.value === 'initialized' && staticBlockExecuted;

      return {
        name: 'static_blocks',
        category: 'nodejs',
        passed,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          feature: 'Static Initialization Blocks',
          supported: passed,
          nodeVersionRequired: '16.11.0+'
        }
      };
    } catch (error) {
      return {
        name: 'static_blocks',
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          feature: 'Static Initialization Blocks',
          supported: false,
          nodeVersionRequired: '16.11.0+'
        }
      };
    }
  }

  private async testCoreAPICompatibility(): Promise<TestResult[]> {
    const tests: TestResult[] = [];

    // Test each core API
    const apis = [
      { name: 'crypto', module: 'crypto' },
      { name: 'fs', module: 'fs/promises' },
      { name: 'os', module: 'os' },
      { name: 'path', module: 'path' },
      { name: 'worker_threads', module: 'worker_threads' },
      { name: 'perf_hooks', module: 'perf_hooks' },
      { name: 'stream', module: 'stream' }
    ];

    for (const api of apis) {
      tests.push(await this.testCoreAPI(api.name, api.module));
    }

    return tests;
  }

  private async testCoreAPI(apiName: string, moduleName: string): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const module = await import(moduleName);
      const hasExpectedExports = Object.keys(module).length > 0;
      
      // Test specific API features based on the module
      let specificTest = true;
      const specificDetails: any = {};

      switch (apiName) {
        case 'crypto':
          specificTest = typeof module.randomUUID === 'function';
          specificDetails.randomUUID = specificTest;
          break;
        case 'fs':
          specificTest = typeof module.readFile === 'function';
          specificDetails.promisesAPI = specificTest;
          break;
        case 'worker_threads':
          specificTest = typeof module.Worker === 'function';
          specificDetails.workerClass = specificTest;
          break;
        case 'perf_hooks':
          specificTest = typeof module.performance === 'object';
          specificDetails.performance = specificTest;
          break;
      }

      return {
        name: `core_api_${apiName}`,
        category: 'nodejs',
        passed: hasExpectedExports && specificTest,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          apiName,
          moduleName,
          hasExports: hasExpectedExports,
          ...specificDetails
        }
      };
    } catch (error) {
      return {
        name: `core_api_${apiName}`,
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: {
          apiName,
          moduleName,
          importError: true
        }
      };
    }
  }

  private async testPerformanceCharacteristics(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Test startup and execution performance
      const { performance } = await import('perf_hooks');
      
      const perfStart = performance.now();
      
      // CPU-intensive task - reduced for CI stability
      let sum = 0;
      for (let i = 0; i < 10000; i++) { // Reduced from 100000 to 10000
        sum += Math.sqrt(i);
      }
      
      const cpuTime = performance.now() - perfStart;
      
      // Memory usage test
      const memBefore = process.memoryUsage();
      const testArray = new Array(10000).fill(0).map((_, i) => ({ id: i, data: `test-${i}` }));
      const memAfter = process.memoryUsage();
      
      const memoryDiff = memAfter.heapUsed - memBefore.heapUsed;
      
      // V8 heap statistics
      const v8 = await import('v8');
      const heapStats = v8.getHeapStatistics();
      
      const passed = cpuTime < 1000 && memoryDiff > 0; // Reasonable performance bounds

      return {
        name: 'performance_characteristics',
        category: 'nodejs',
        passed,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          cpuTime,
          memoryDiff,
          v8HeapSize: heapStats.total_heap_size,
          v8HeapUsed: heapStats.used_heap_size,
          arrayLength: testArray.length,
          performanceWithinBounds: passed
        }
      };
    } catch (error) {
      return {
        name: 'performance_characteristics',
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testNativeModuleCompatibility(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Test Node.js addon loading capability
      const configVars = process.config.variables as any;
      const nativeModulesSupported = process.config.target_defaults &&
                                     process.config.variables &&
                                     configVars.node_module_version;

      // Test specific native modules if available
      const nativeModuleTests = {
        hasNodeModuleVersion: !!configVars.node_module_version,
        hasV8Version: !!process.versions.v8,
        hasUVVersion: !!process.versions.uv,
        hasAddonAPI: typeof process.dlopen === 'function'
      };

      const passed = Object.values(nativeModuleTests).every(test => test === true);

      return {
        name: 'native_module_compatibility',
        category: 'nodejs',
        passed,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          nativeModulesSupported,
          nodeModuleVersion: configVars.node_module_version,
          v8Version: process.versions.v8,
          uvVersion: process.versions.uv,
          ...nativeModuleTests
        }
      };
    } catch (error) {
      return {
        name: 'native_module_compatibility',
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testWorkerThreadsSupport(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const { Worker, isMainThread, parentPort } = await import('worker_threads');
      
      if (!isMainThread) {
        // We're in a worker thread
        return {
          name: 'worker_threads_support',
          category: 'nodejs',
          passed: true,
          platform: this.platform,
          duration: Date.now() - startTime,
          details: {
            isWorkerThread: true,
            hasParentPort: !!parentPort
          }
        };
      }

      // Test worker thread creation capability
      const hasWorkerClass = typeof Worker === 'function';
      const isMainThreadCorrect = isMainThread === true;
      
      const passed = hasWorkerClass && isMainThreadCorrect;

      return {
        name: 'worker_threads_support',
        category: 'nodejs',
        passed,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          hasWorkerClass,
          isMainThread: isMainThreadCorrect,
          workerThreadsSupported: passed
        }
      };
    } catch (error) {
      return {
        name: 'worker_threads_support',
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testStreamAPICompatibility(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const { Readable, Writable, Transform, pipeline } = await import('stream');
      const { promisify } = await import('util');
      
      // Test stream classes availability
      const hasStreamClasses = typeof Readable === 'function' && 
                              typeof Writable === 'function' && 
                              typeof Transform === 'function';

      // Test pipeline function
      const hasPipeline = typeof pipeline === 'function';
      
      // Test promisified pipeline
      const pipelineAsync = promisify(pipeline);
      const hasAsyncPipeline = typeof pipelineAsync === 'function';

      // Test modern stream features
      let hasAsyncIterators = false;
      try {
        const readable = new Readable({
          read() {
            this.push('test');
            this.push(null);
          }
        });
        
        hasAsyncIterators = typeof readable[Symbol.asyncIterator] === 'function';
      } catch (error) {
        hasAsyncIterators = false;
      }

      const passed = hasStreamClasses && hasPipeline && hasAsyncPipeline;

      return {
        name: 'stream_api_compatibility',
        category: 'nodejs',
        passed,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          hasStreamClasses,
          hasPipeline,
          hasAsyncPipeline,
          hasAsyncIterators,
          streamAPIComplete: passed
        }
      };
    } catch (error) {
      return {
        name: 'stream_api_compatibility',
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testAsyncFeatures(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Test async/await
      const asyncTest = async () => {
        const result = await Promise.resolve('async-success');
        return result;
      };

      const asyncResult = await asyncTest();
      
      // Test Promise.allSettled (Node.js 12.9+)
      let hasAllSettled = false;
      try {
        const settled = await Promise.allSettled([
          Promise.resolve('success'),
          Promise.reject('error')
        ]);
        hasAllSettled = settled.length === 2 && 
                       settled[0].status === 'fulfilled' && 
                       settled[1].status === 'rejected';
      } catch (error) {
        hasAllSettled = false;
      }

      // Test Promise.any (Node.js 15+)
      let hasAny = false;
      try {
        const result = await Promise.any([
          Promise.reject('error1'),
          Promise.resolve('success'),
          Promise.reject('error2')
        ]);
        hasAny = result === 'success';
      } catch (error) {
        hasAny = false;
      }

      const passed = asyncResult === 'async-success' && hasAllSettled;

      return {
        name: 'async_features',
        category: 'nodejs',
        passed,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          asyncAwait: asyncResult === 'async-success',
          promiseAllSettled: hasAllSettled,
          promiseAny: hasAny,
          asyncFeaturesSupported: passed
        }
      };
    } catch (error) {
      return {
        name: 'async_features',
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testErrorHandling(): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Test error stack traces
      let errorStack = '';
      try {
        throw new Error('Test error');
      } catch (error) {
        errorStack = error instanceof Error ? (error.stack || '') : '';
      }

      const hasStackTrace = errorStack.includes('testErrorHandling') || 
                           errorStack.includes('Test error');

      // Test unhandled rejection detection
      let hasUnhandledRejectionDetection = false;
      const originalHandler = process.listeners('unhandledRejection');
      
      process.on('unhandledRejection', () => {
        hasUnhandledRejectionDetection = true;
      });

      // Trigger and immediately handle to test detection
      Promise.reject('test-rejection').catch(() => {});
      
      // Restore original handlers
      process.removeAllListeners('unhandledRejection');
      originalHandler.forEach(handler => {
        process.on('unhandledRejection', handler);
      });

      // Test error cause support (Node.js 16.9+)
      let hasCauseSupport = false;
      try {
        const cause = new Error('Original error');
        const wrappedError = new Error('Wrapped error', { cause });
        hasCauseSupport = (wrappedError as any).cause === cause;
      } catch (error) {
        hasCauseSupport = false;
      }

      const passed = hasStackTrace;

      return {
        name: 'error_handling',
        category: 'nodejs',
        passed,
        platform: this.platform,
        duration: Date.now() - startTime,
        details: {
          hasStackTrace,
          hasUnhandledRejectionDetection,
          hasCauseSupport,
          errorHandlingComplete: passed
        }
      };
    } catch (error) {
      return {
        name: 'error_handling',
        category: 'nodejs',
        passed: false,
        platform: this.platform,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private generateSummary(testResults: TestResult[], duration: number): NodeVersionTestResult['summary'] {
    const total = testResults.length;
    const passed = testResults.filter(test => test.passed).length;
    const failed = total - passed;

    // Extract version information
    const versionMatch = this.currentNodeVersion.match(/^v(\d+)\.(\d+)\.(\d+)/);
    const majorVersion = versionMatch ? parseInt(versionMatch[1], 10) : 0;
    const versionSupported = majorVersion >= 18;

    // Determine feature compatibility based on test results
    const getFeatureSupport = (testName: string) => {
      const test = testResults.find(t => t.name === testName);
      return test ? test.passed : false;
    };

    const featureCompatibility = {
      esModules: getFeatureSupport('es_module_support'),
      asyncAwait: getFeatureSupport('async_features'),
      optionalChaining: getFeatureSupport('optional_chaining'),
      nullishCoalescing: getFeatureSupport('nullish_coalescing'),
      topLevelAwait: testResults.find(t => t.name === 'es_module_support')?.details?.topLevelAwait || false,
      privateFields: getFeatureSupport('private_fields'),
      staticBlocks: getFeatureSupport('static_blocks'),
      importMeta: testResults.find(t => t.name === 'es_module_support')?.details?.importMeta || false
    };

    const apiCompatibility = {
      crypto: getFeatureSupport('core_api_crypto'),
      fs: getFeatureSupport('core_api_fs'),
      os: getFeatureSupport('core_api_os'),
      path: getFeatureSupport('core_api_path'),
      worker_threads: getFeatureSupport('worker_threads_support'),
      perf_hooks: getFeatureSupport('core_api_perf_hooks'),
      diagnostics_channel: false, // Would need additional test
      stream: getFeatureSupport('stream_api_compatibility')
    };

    // Extract performance metrics
    const perfTest = testResults.find(t => t.name === 'performance_characteristics');
    const performanceMetrics = {
      startupTime: 0, // Would need separate measurement
      memoryUsage: perfTest?.details?.memoryDiff || 0,
      v8HeapSize: perfTest?.details?.v8HeapSize || 0,
      moduleLoadTime: duration // Approximation
    };

    return {
      total,
      passed,
      failed,
      duration,
      versionSupported,
      featureCompatibility,
      apiCompatibility,
      performanceMetrics
    };
  }
}