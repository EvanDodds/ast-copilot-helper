/**
 * Progress Reporter for Parse Command (Subtask 6)
 * 
 * Provides real-time progress reporting with performance metrics, ETA calculation,
 * memory usage tracking, and sophisticated display formatting.
 */

import { EventEmitter } from 'events';
import { relative } from 'path';
import type { Logger } from '../logging/index.js';

/**
 * Progress statistics for current operation
 */
export interface ProgressStats {
    // File Progress
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    currentFile: string | null;

    // Time & Performance
    startTime: number;
    elapsedTimeMs: number;
    estimatedTimeRemainingMs: number;
    filesPerSecond: number;

    // Memory & Resources
    memoryUsageMB: number;
    peakMemoryUsageMB: number;
    memoryPressure: 'low' | 'medium' | 'high';

    // AST Parsing Stats
    totalNodes: number;
    averageNodesPerFile: number;
    parseErrors: number;

    // Batch Processing
    currentBatch: number;
    totalBatches: number;
    batchSize: number;
    currentPhase: string;
}

/**
 * Progress update data from batch orchestrator
 */
export interface ParseProgressUpdate {
    completed: number;
    total: number;
    currentFile?: string;
    rate?: number;
    estimatedTimeRemaining?: number;
    memoryUsageMB?: number;
    phase?: string;
    batchInfo?: {
        current: number;
        total: number;
        size: number;
    };
    nodeStats?: {
        totalNodes: number;
        averageNodesPerFile: number;
    };
    errorCount?: number;
}

/**
 * Display configuration for progress reporting
 */
export interface ProgressDisplayOptions {
    showMemoryUsage: boolean;
    showFileDetails: boolean;
    showPerformanceStats: boolean;
    showETA: boolean;
    updateIntervalMs: number;
    maxFilePathLength: number;
    useColors: boolean;
    clearLine: boolean;
}

/**
 * Progress Reporter Events
 */
export interface ProgressReporterEvents {
    'progress': [ProgressStats];
    'completed': [ProgressStats];
    'error': [Error];
    'memory-pressure': [ProgressStats];
    'performance-warning': [ProgressStats, string];
}

/**
 * Advanced Progress Reporter with real-time display and statistics
 */
export class ProgressReporter extends EventEmitter<ProgressReporterEvents> {
    private readonly logger: Logger;
    private readonly displayOptions: ProgressDisplayOptions;

    private stats: ProgressStats;
    private displayTimer?: NodeJS.Timeout;
    private isActive = false;
    private shouldClearLine = true;

    constructor(
        logger: Logger,
        options: Partial<ProgressDisplayOptions> = {}
    ) {
        super();
        this.logger = logger;

        // Set default display options
        this.displayOptions = {
            showMemoryUsage: true,
            showFileDetails: true,
            showPerformanceStats: true,
            showETA: true,
            updateIntervalMs: 250,
            maxFilePathLength: 50,
            useColors: process.stdout.isTTY,
            clearLine: process.stdout.isTTY,
            ...options
        };

        // Initialize stats
        this.stats = this.createInitialStats();
        this.shouldClearLine = this.displayOptions.clearLine;
    }

    /**
     * Start progress reporting
     */
    start(totalFiles: number): void {
        this.isActive = true;
        this.stats = {
            ...this.createInitialStats(),
            totalFiles,
            startTime: Date.now()
        };

        // Start display timer
        if (this.displayOptions.updateIntervalMs > 0) {
            this.displayTimer = setInterval(
                () => this.updateDisplay(),
                this.displayOptions.updateIntervalMs
            );
        }

        this.logger.info('Progress reporting started', {
            totalFiles,
            displayOptions: this.displayOptions
        });
    }

    /**
     * Update progress with new data from batch orchestrator
     */
    update(update: ParseProgressUpdate): void {
        if (!this.isActive) {
return;
}

        const now = Date.now();
        const elapsedMs = now - this.stats.startTime;

        // Update core stats
        this.stats = {
            ...this.stats,
            completedFiles: update.completed,
            currentFile: update.currentFile || this.stats.currentFile,
            elapsedTimeMs: elapsedMs,
            filesPerSecond: update.rate || this.calculateRate(update.completed, elapsedMs),
            estimatedTimeRemainingMs: update.estimatedTimeRemaining || this.calculateETA(update.completed, update.total, elapsedMs),
            memoryUsageMB: update.memoryUsageMB || this.stats.memoryUsageMB,
            currentPhase: update.phase || this.stats.currentPhase
        };

        // Update memory tracking
        if (update.memoryUsageMB) {
            this.stats.peakMemoryUsageMB = Math.max(this.stats.peakMemoryUsageMB, update.memoryUsageMB);
            this.stats.memoryPressure = this.calculateMemoryPressure(update.memoryUsageMB);
        }

        // Update batch info
        if (update.batchInfo) {
            this.stats.currentBatch = update.batchInfo.current;
            this.stats.totalBatches = update.batchInfo.total;
            this.stats.batchSize = update.batchInfo.size;
        }

        // Update node statistics
        if (update.nodeStats) {
            this.stats.totalNodes = update.nodeStats.totalNodes;
            this.stats.averageNodesPerFile = update.nodeStats.averageNodesPerFile;
        }

        // Update error count
        if (update.errorCount !== undefined) {
            this.stats.parseErrors = update.errorCount;
        }

        // Check for performance warnings
        this.checkPerformanceWarnings();

        // Emit progress event
        this.emit('progress', this.stats);
    }

    /**
     * Mark a file as failed
     */
    incrementFailures(count = 1): void {
        if (!this.isActive) {
return;
}
        this.stats.failedFiles += count;
    }

    /**
     * Complete progress reporting
     */
    complete(): void {
        if (!this.isActive) {
return;
}

        this.isActive = false;

        // Clear display timer
        if (this.displayTimer) {
            clearInterval(this.displayTimer);
            this.displayTimer = undefined;
        }

        // Final update
        this.stats.elapsedTimeMs = Date.now() - this.stats.startTime;

        // Final display
        this.displayFinalSummary();

        this.emit('completed', this.stats);

        this.logger.info('Progress reporting completed', {
            stats: this.formatStatsForLogging()
        });
    }

    /**
     * Get current statistics
     */
    getStats(): ProgressStats {
        return { ...this.stats };
    }

    /**
     * Stop and cleanup progress reporting
     */
    dispose(): void {
        this.isActive = false;
        if (this.displayTimer) {
            clearInterval(this.displayTimer);
            this.displayTimer = undefined;
        }
        this.removeAllListeners();
    }

    /**
     * Create initial statistics object
     */
    private createInitialStats(): ProgressStats {
        return {
            totalFiles: 0,
            completedFiles: 0,
            failedFiles: 0,
            currentFile: null,
            startTime: Date.now(),
            elapsedTimeMs: 0,
            estimatedTimeRemainingMs: 0,
            filesPerSecond: 0,
            memoryUsageMB: 0,
            peakMemoryUsageMB: 0,
            memoryPressure: 'low',
            totalNodes: 0,
            averageNodesPerFile: 0,
            parseErrors: 0,
            currentBatch: 0,
            totalBatches: 0,
            batchSize: 0,
            currentPhase: 'starting'
        };
    }

    /**
     * Calculate processing rate
     */
    private calculateRate(completed: number, elapsedMs: number): number {
        if (elapsedMs === 0) {
return 0;
}
        return (completed / elapsedMs) * 1000; // files per second
    }

    /**
     * Calculate estimated time to completion
     */
    private calculateETA(completed: number, total: number, elapsedMs: number): number {
        if (completed === 0 || elapsedMs === 0) {
return 0;
}

        const remaining = total - completed;
        const rate = completed / elapsedMs;
        return remaining / rate;
    }

    /**
     * Determine memory pressure level
     */
    private calculateMemoryPressure(memoryMB: number): 'low' | 'medium' | 'high' {
        if (memoryMB > 1024) {
return 'high';
}   // > 1GB
        if (memoryMB > 512) {
return 'medium';
}  // > 512MB
        return 'low';
    }

    /**
     * Check for performance warnings
     */
    private checkPerformanceWarnings(): void {
        const { stats } = this;

        // Memory pressure warning
        if (stats.memoryPressure === 'high') {
            this.emit('memory-pressure', stats);
        }

        // Slow processing warning
        if (stats.filesPerSecond < 0.5 && stats.completedFiles > 10) {
            this.emit('performance-warning', stats, 'slow processing rate');
        }

        // High error rate warning
        const errorRate = stats.parseErrors / Math.max(stats.completedFiles, 1);
        if (errorRate > 0.2 && stats.completedFiles > 5) {
            this.emit('performance-warning', stats, 'high error rate');
        }
    }

    /**
     * Update the real-time display
     */
    private updateDisplay(): void {
        if (!this.isActive) {
return;
}

        // Clear previous line if needed
        if (this.shouldClearLine) {
            process.stdout.write('\r\x1b[K');
        }

        const line = this.formatProgressLine();
        process.stdout.write(line);
    }

    /**
     * Format the progress display line
     */
    private formatProgressLine(): string {
        const { stats } = this;
        const colors = this.displayOptions.useColors;

        // Progress percentage
        const progress = stats.totalFiles > 0 ? (stats.completedFiles / stats.totalFiles) * 100 : 0;
        const progressStr = `${Math.round(progress)}%`;

        // File count
        const fileCount = `${stats.completedFiles}/${stats.totalFiles}`;

        // Current file (truncated)
        let currentFileStr = '';
        if (this.displayOptions.showFileDetails && stats.currentFile) {
            const relativePath = relative(process.cwd(), stats.currentFile);
            currentFileStr = relativePath.length > this.displayOptions.maxFilePathLength
                ? '...' + relativePath.slice(-(this.displayOptions.maxFilePathLength - 3))
                : relativePath;
        }

        // Performance stats
        let perfStr = '';
        if (this.displayOptions.showPerformanceStats) {
            perfStr = ` | ${stats.filesPerSecond.toFixed(1)}/s`;
            if (stats.totalNodes > 0) {
                perfStr += ` | ${(stats.totalNodes / 1000).toFixed(1)}k nodes`;
            }
        }

        // Memory usage
        let memStr = '';
        if (this.displayOptions.showMemoryUsage && stats.memoryUsageMB > 0) {
            const memColor = colors && stats.memoryPressure === 'high' ? '\x1b[31m' : '';
            const resetColor = colors ? '\x1b[0m' : '';
            memStr = ` | ${memColor}${stats.memoryUsageMB.toFixed(0)}MB${resetColor}`;
        }

        // ETA
        let etaStr = '';
        if (this.displayOptions.showETA && stats.estimatedTimeRemainingMs > 0) {
            const etaSeconds = Math.round(stats.estimatedTimeRemainingMs / 1000);
            etaStr = ` | ETA: ${this.formatDuration(etaSeconds)}`;
        }

        // Progress bar
        const barWidth = 20;
        const filledWidth = Math.round((progress / 100) * barWidth);
        const bar = '█'.repeat(filledWidth) + '░'.repeat(barWidth - filledWidth);
        const barStr = colors ? `\x1b[36m${bar}\x1b[0m` : bar;

        // Combine all parts
        const parts = [
            `[${barStr}]`,
            progressStr,
            fileCount,
            currentFileStr,
            perfStr,
            memStr,
            etaStr
        ].filter(Boolean);

        return parts.join(' ');
    }

    /**
     * Display final summary
     */
    private displayFinalSummary(): void {
        // Clear the progress line
        if (this.shouldClearLine) {
            process.stdout.write('\r\x1b[K');
        }

        const { stats } = this;
        const colors = this.displayOptions.useColors;
        const successColor = colors ? '\x1b[32m' : '';
        const errorColor = colors ? '\x1b[31m' : '';
        const infoColor = colors ? '\x1b[36m' : '';
        const resetColor = colors ? '\x1b[0m' : '';

        const duration = this.formatDuration(Math.round(stats.elapsedTimeMs / 1000));
        const avgRate = stats.filesPerSecond.toFixed(1);
        const avgNodes = stats.averageNodesPerFile.toFixed(0);

        console.log(`\n${infoColor}━━━ Parsing Complete ━━━${resetColor}`);
        console.log(`${successColor}✓ Processed: ${stats.completedFiles}${resetColor} files in ${duration}`);
        if (stats.failedFiles > 0) {
            console.log(`${errorColor}✗ Failed: ${stats.failedFiles}${resetColor} files`);
        }
        console.log(`${infoColor}Performance:${resetColor} ${avgRate} files/sec, ${avgNodes} avg nodes/file`);
        if (stats.totalNodes > 0) {
            console.log(`${infoColor}AST Nodes:${resetColor} ${(stats.totalNodes / 1000).toFixed(1)}k total`);
        }
        if (stats.memoryUsageMB > 0) {
            console.log(`${infoColor}Memory:${resetColor} ${stats.peakMemoryUsageMB.toFixed(0)}MB peak usage`);
        }
    }

    /**
     * Format duration in human-readable format
     */
    private formatDuration(seconds: number): string {
        if (seconds < 60) {
return `${seconds}s`;
}
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }

    /**
     * Format stats for logging
     */
    private formatStatsForLogging() {
        const { stats } = this;
        return {
            totalFiles: stats.totalFiles,
            completed: stats.completedFiles,
            failed: stats.failedFiles,
            durationMs: stats.elapsedTimeMs,
            rate: stats.filesPerSecond,
            totalNodes: stats.totalNodes,
            peakMemoryMB: stats.peakMemoryUsageMB,
            errors: stats.parseErrors
        };
    }
}

/**
 * Factory function for creating progress reporter
 */
export async function createProgressReporter(
    logger: Logger,
    options?: Partial<ProgressDisplayOptions>
): Promise<ProgressReporter> {
    return new ProgressReporter(logger, options);
}