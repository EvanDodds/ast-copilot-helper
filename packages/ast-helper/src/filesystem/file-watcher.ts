/**
 * File watching implementation using chokidar for file system monitoring
 * 
 * This module provides a robust file watching system that can monitor directories
 * for changes and emit events when files are added, modified, moved, or deleted.
 * It supports include/exclude patterns, recursive directory watching, and proper
 * resource cleanup.
 */

import { EventEmitter } from 'node:events';
import type { Stats } from 'node:fs';
import { resolve, relative } from 'node:path';
import * as chokidar from 'chokidar';
import { minimatch } from 'minimatch';
import { createModuleLogger } from '../logging';
import type {
  FileWatcher,
  FileWatchConfig,
  FileChangeEvent,
  WatchStats
} from './types';

const logger = createModuleLogger('file-watcher');

/**
 * Default configuration for file watching
 */
const DEFAULT_CONFIG: Partial<FileWatchConfig> = {
  includePatterns: ['**/*'],
  excludePatterns: ['**/node_modules/**', '**/.git/**', '**/.*/**'],
  enableRecursive: true,
  debounceMs: 100,
  batchSize: 50,
  followSymlinks: false
};

/**
 * Extended WatchStats with additional internal tracking
 */
interface ExtendedWatchStats extends WatchStats {
  /** Number of files being watched */
  filesWatched: number;
  
  /** Number of errors encountered */
  errors: number;
  
  /** When watching started */
  watchStartTime: number | null;
  
  /** Last time an event was processed */
  lastEventTime: number | null;
}

/**
 * Implementation of FileWatcher using chokidar for file system monitoring
 * 
 * This class provides comprehensive file watching capabilities with support for:
 * - Recursive directory monitoring
 * - Include/exclude pattern matching
 * - File change event detection and emission
 * - Proper resource cleanup and error handling
 * - Statistics tracking for monitoring performance
 */
export class ChokidarFileWatcher extends EventEmitter implements FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private config!: FileWatchConfig;
  private stats: ExtendedWatchStats;
  private watchedPaths: Set<string> = new Set();
  private isWatching = false;
  private disposed = false;
  private initialized = false;

  constructor() {
    super();
    
    // Initialize stats
    this.stats = {
      watchedFiles: 0,
      totalEvents: 0,
      processedChanges: 0,
      lastProcessedAt: new Date(0),
      averageProcessingTime: 0,
      filesWatched: 0,
      errors: 0,
      watchStartTime: null,
      lastEventTime: null
    };

    this.setupProcessHandlers();
  }

  /**
   * Initialize the file watcher and start monitoring configured paths
   */
  async initialize(config: FileWatchConfig): Promise<void> {
    if (this.disposed) {
      throw new Error('Cannot initialize a disposed file watcher');
    }

    if (this.initialized) {
      logger.warn('File watcher is already initialized');
      return;
    }

    // Merge with defaults and resolve paths
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      watchPaths: config.watchPaths.map(path => resolve(path))
    };

    this.initialized = true;

    logger.info('File watcher initialized', {
      watchPaths: this.config.watchPaths,
      includePatterns: this.config.includePatterns,
      excludePatterns: this.config.excludePatterns
    });
  }

  /**
   * Start watching for file changes
   */
  async start(): Promise<void> {
    if (!this.initialized) {
      throw new Error('File watcher must be initialized before starting');
    }

    if (this.isWatching) {
      logger.warn('File watcher is already watching');
      return;
    }

    try {
      logger.info('Starting file watcher', {
        watchPaths: this.config.watchPaths
      });

      // Create chokidar watcher with configuration
      this.watcher = chokidar.watch(this.config.watchPaths, {
        ignored: this.createIgnoreFunction(),
        persistent: true,
        ignoreInitial: true,
        followSymlinks: this.config.followSymlinks,
        depth: this.config.enableRecursive ? undefined : 0,
        awaitWriteFinish: {
          stabilityThreshold: this.config.debounceMs,
          pollInterval: 25
        }
      });

      // Set up event listeners
      this.setupWatcherEvents();

      // Wait for ready event
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('File watcher start timeout'));
        }, 10000);

        this.watcher!.once('ready', () => {
          clearTimeout(timeout);
          this.isWatching = true;
          this.stats.watchStartTime = Date.now();
          logger.info('File watcher started successfully', {
            filesWatched: this.stats.filesWatched
          });
          resolve();
        });

        this.watcher!.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

    } catch (error) {
      this.stats.errors++;
      logger.error('Failed to start file watcher', { error });
      throw error;
    }
  }

  /**
   * Stop watching and cleanup resources
   */
  async stop(): Promise<void> {
    if (!this.isWatching) {
      logger.warn('File watcher is not currently watching');
      return;
    }

    logger.info('Stopping file watcher');

    try {
      if (this.watcher) {
        await this.watcher.close();
        this.watcher = null;
      }

      this.watchedPaths.clear();
      this.isWatching = false;

      logger.info('File watcher stopped successfully');
    } catch (error) {
      this.stats.errors++;
      logger.error('Error stopping file watcher', { error });
      throw error;
    }
  }

  /**
   * Add additional paths to watch
   */
  async addWatchPath(path: string): Promise<void> {
    if (!this.isWatching) {
      throw new Error('File watcher must be started before adding paths');
    }

    const resolvedPath = resolve(path);
    
    if (this.watchedPaths.has(resolvedPath)) {
      logger.warn('Path is already being watched', { path: resolvedPath });
      return;
    }

    try {
      this.watcher!.add(resolvedPath);
      this.watchedPaths.add(resolvedPath);
      
      logger.info('Added watch path', { path: resolvedPath });
      this.emit('pathAdded', resolvedPath);
    } catch (error) {
      this.stats.errors++;
      logger.error('Failed to add watch path', { path: resolvedPath, error });
      throw error;
    }
  }

  /**
   * Remove paths from watching
   */
  async removeWatchPath(path: string): Promise<void> {
    if (!this.isWatching) {
      throw new Error('File watcher must be started before removing paths');
    }

    const resolvedPath = resolve(path);

    if (!this.watchedPaths.has(resolvedPath)) {
      logger.warn('Path is not being watched', { path: resolvedPath });
      return;
    }

    try {
      this.watcher!.unwatch(resolvedPath);
      this.watchedPaths.delete(resolvedPath);
      
      logger.info('Removed watch path', { path: resolvedPath });
      this.emit('pathRemoved', resolvedPath);
    } catch (error) {
      this.stats.errors++;
      logger.error('Failed to remove watch path', { path: resolvedPath, error });
      throw error;
    }
  }

  /**
   * Get list of currently watched paths
   */
  getWatchedPaths(): string[] {
    return Array.from(this.watchedPaths);
  }

  /**
   * Check if a specific path is being watched
   */
  isWatchingPath(path: string): boolean {
    const resolvedPath = resolve(path);
    return this.watchedPaths.has(resolvedPath);
  }

  /**
   * Get current watch statistics
   */
  getWatchStats(): WatchStats {
    return {
      watchedFiles: this.stats.watchedFiles,
      totalEvents: this.stats.totalEvents,
      processedChanges: this.stats.processedChanges,
      lastProcessedAt: this.stats.lastProcessedAt,
      averageProcessingTime: this.stats.averageProcessingTime
    };
  }

  /**
   * Dispose of the file watcher and clean up resources
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    logger.info('Disposing file watcher');

    try {
      await this.stop();
      this.disposed = true;
      this.removeAllListeners();

      logger.info('File watcher disposed successfully');
    } catch (error) {
      this.stats.errors++;
      logger.error('Error disposing file watcher', { error });
      throw error;
    }
  }

  /**
   * Setup event handlers for process termination
   */
  private setupProcessHandlers(): void {
    // Handle process termination
    process.on('SIGTERM', () => {
      this.dispose().catch(error => {
        logger.error('Error disposing file watcher on SIGTERM', { error });
      });
    });

    process.on('SIGINT', () => {
      this.dispose().catch(error => {
        logger.error('Error disposing file watcher on SIGINT', { error });
      });
    });
  }

  /**
   * Setup event listeners for the chokidar watcher
   */
  private setupWatcherEvents(): void {
    if (!this.watcher) {
      return;
    }

    // File added
    this.watcher.on('add', (filePath: string, stats?: Stats) => {
      this.handleFileChange('add', filePath, stats);
    });

    // File changed
    this.watcher.on('change', (filePath: string, stats?: Stats) => {
      this.handleFileChange('change', filePath, stats);
    });

    // File removed
    this.watcher.on('unlink', (filePath: string) => {
      this.handleFileChange('unlink', filePath);
    });

    // Directory added
    this.watcher.on('addDir', (dirPath: string, stats?: Stats) => {
      this.handleFileChange('addDir', dirPath, stats);
    });

    // Directory removed
    this.watcher.on('unlinkDir', (dirPath: string) => {
      this.handleFileChange('unlinkDir', dirPath);
    });

    // Error handling
    this.watcher.on('error', (err: unknown) => {
      this.stats.errors++;
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('File watcher error', { error });
      this.emit('error', error);
    });

    // Ready event
    this.watcher.on('ready', () => {
      const watched = this.watcher!.getWatched();
      this.stats.filesWatched = Object.values(watched)
        .reduce((total, files) => total + files.length, 0);
      
      // Update watched paths
      Object.keys(watched).forEach(dir => {
        this.watchedPaths.add(dir);
      });

      this.emit('ready');
    });
  }

  /**
   * Handle file change events and emit appropriate events
   */
  private handleFileChange(type: FileChangeEvent['type'], filePath: string, stats?: Stats): void {
    // Check if file should be included based on patterns
    if (!this.shouldIncludeFile(filePath)) {
      return;
    }

    const event: FileChangeEvent = {
      type,
      filePath: resolve(filePath),
      stats,
      timestamp: new Date()
    };

    this.stats.totalEvents++;
    this.stats.processedChanges++;
    this.stats.lastEventTime = Date.now();
    this.stats.lastProcessedAt = new Date();

    // Update watched files count
    this.stats.watchedFiles = this.stats.filesWatched;

    logger.debug('File change detected', {
      type: event.type,
      filePath: event.filePath
    });

    // Emit file change event
    this.emit('fileChange', event);
  }

  /**
   * Create ignore function for chokidar based on include/exclude patterns
   */
  private createIgnoreFunction() {
    return (path: string): boolean => {
      const relativePath = relative(process.cwd(), path);
      
      // Check exclude patterns first
      for (const pattern of this.config.excludePatterns || []) {
        if (minimatch(relativePath, pattern, { dot: true })) {
          return true;
        }
      }

      // Check include patterns
      if (this.config.includePatterns && this.config.includePatterns.length > 0) {
        for (const pattern of this.config.includePatterns) {
          if (minimatch(relativePath, pattern, { dot: true })) {
            return false;
          }
        }
        return true; // Not included by any pattern
      }

      return false; // Not ignored
    };
  }

  /**
   * Check if a file should be included based on include/exclude patterns
   */
  private shouldIncludeFile(filePath: string): boolean {
    const relativePath = relative(process.cwd(), filePath);

    // Check exclude patterns first
    if (this.config.excludePatterns) {
      for (const pattern of this.config.excludePatterns) {
        if (minimatch(relativePath, pattern, { dot: true })) {
          return false;
        }
      }
    }

    // Check include patterns
    if (this.config.includePatterns && this.config.includePatterns.length > 0) {
      for (const pattern of this.config.includePatterns) {
        if (minimatch(relativePath, pattern, { dot: true })) {
          return true;
        }
      }
      return false; // Not included by any pattern
    }

    return true; // No include patterns means include everything (except excluded)
  }
}

/**
 * Create a new file watcher instance
 */
export function createFileWatcher(): FileWatcher {
  return new ChokidarFileWatcher();
}