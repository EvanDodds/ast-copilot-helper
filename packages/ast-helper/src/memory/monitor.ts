/**
 * Memory Monitor System - Real-time memory usage tracking and alerting
 * 
 * Provides comprehensive memory monitoring capabilities including:
 * - Real-time memory usage tracking
 * - Configurable threshold-based alerting  
 * - Memory usage history and trend analysis
 * - Performance impact assessment
 */

import { EventEmitter } from 'node:events';
import { 
    MemoryMonitor, 
    MemorySnapshot, 
    MemoryAlert, 
    MemoryTrend, 
    ResourceConfig,
    AlertSeverity,
    AlertType
} from './types';

/**
 * MemoryUsageHistory - Tracks historical memory usage patterns
 */
interface MemoryUsageHistory {
    snapshots: MemorySnapshot[];
    maxHistorySize: number;
    startTime: number;
}

/**
 * MemoryThresholds - Configurable memory usage thresholds
 */
interface MemoryThresholds {
    warningPercent: number;
    criticalPercent: number;
    leakDetectionThreshold: number;
    rapidGrowthThreshold: number;
}

/**
 * MonitoringState - Current monitoring system state
 */
interface MonitoringState {
    isActive: boolean;
    intervalId?: NodeJS.Timeout;
    lastSnapshot?: MemorySnapshot;
    alertHistory: MemoryAlert[];
    trends: Map<string, MemoryTrend>;
}

/**
 * Advanced Memory Monitor Implementation
 * 
 * Provides real-time memory monitoring with alerting, trend analysis,
 * and performance impact assessment capabilities.
 */
export class AdvancedMemoryMonitor extends EventEmitter implements MemoryMonitor {
    private config: ResourceConfig;
    private thresholds: MemoryThresholds;
    private history: MemoryUsageHistory;
    private state: MonitoringState;
    private performanceBaseline?: MemorySnapshot;

    constructor(config: ResourceConfig) {
        super();
        this.config = config;
        this.thresholds = this.initializeThresholds(config);
        this.history = this.initializeHistory(config);
        this.state = this.initializeState();
    }

    /**
     * Initialize memory usage thresholds based on configuration
     */
    private initializeThresholds(config: ResourceConfig): MemoryThresholds {
        return {
            warningPercent: config.gcTriggerThreshold * 0.8, // 80% of GC threshold
            criticalPercent: config.gcTriggerThreshold * 0.95, // 95% of GC threshold  
            leakDetectionThreshold: config.maxMemoryMB * 0.1, // 10% growth per monitoring cycle
            rapidGrowthThreshold: config.maxMemoryMB * 0.05 // 5% rapid growth threshold
        };
    }

    /**
     * Initialize memory usage history tracking
     */
    private initializeHistory(config: ResourceConfig): MemoryUsageHistory {
        // Keep history for analysis - default 1000 snapshots
        const maxHistorySize = Math.max(100, config.monitoringInterval * 10);
        
        return {
            snapshots: [],
            maxHistorySize,
            startTime: Date.now()
        };
    }

    /**
     * Initialize monitoring state
     */
    private initializeState(): MonitoringState {
        return {
            isActive: false,
            alertHistory: [],
            trends: new Map()
        };
    }

    /**
     * Start real-time memory monitoring
     */
    async start(): Promise<void> {
        if (this.state.isActive) {
            throw new Error('Memory monitoring is already active');
        }

        console.log('Starting memory monitoring system...');
        
        // Take baseline snapshot for performance comparison
        this.performanceBaseline = await this.takeSnapshot();
        this.state.isActive = true;

        // Start monitoring interval
        this.state.intervalId = setInterval(async () => {
            try {
                await this.monitoringCycle();
            } catch (error) {
                this.emit('error', new Error(`Monitoring cycle failed: ${error}`));
            }
        }, this.config.monitoringInterval);

        this.emit('started', { timestamp: Date.now() });
        console.log(`Memory monitoring started with ${this.config.monitoringInterval}ms interval`);
    }

    /**
     * Stop memory monitoring
     */
    async stop(): Promise<void> {
        if (!this.state.isActive) {
            return;
        }

        console.log('Stopping memory monitoring system...');
        
        this.state.isActive = false;
        
        if (this.state.intervalId) {
            clearInterval(this.state.intervalId);
            this.state.intervalId = undefined;
        }

        this.emit('stopped', { 
            timestamp: Date.now(),
            totalSnapshots: this.history.snapshots.length,
            totalAlerts: this.state.alertHistory.length
        });
        
        console.log('Memory monitoring stopped');
    }

    /**
     * Execute a single monitoring cycle
     */
    private async monitoringCycle(): Promise<void> {
        // Take current memory snapshot
        const snapshot = await this.takeSnapshot();
        
        // Add to history
        this.addToHistory(snapshot);
        
        // Update trends
        this.updateTrends(snapshot);
        
        // Check for alerts
        await this.checkAlerts(snapshot);
        
        // Update state
        this.state.lastSnapshot = snapshot;
    }

    /**
     * Take a comprehensive memory snapshot
     */
    private async takeSnapshot(): Promise<MemorySnapshot> {
        const memUsage = process.memoryUsage();
        const timestamp = Date.now();
        
        return {
            timestamp,
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100, // MB
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100, // MB
            external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100, // MB
            rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100, // MB
            arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024 * 100) / 100, // MB
            heapUtilization: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 10000) / 100 // Percentage
        };
    }

    /**
     * Add snapshot to history with size management
     */
    private addToHistory(snapshot: MemorySnapshot): void {
        this.history.snapshots.push(snapshot);
        
        // Maintain history size limit
        if (this.history.snapshots.length > this.history.maxHistorySize) {
            // Remove oldest snapshots, keep recent ones
            const removeCount = this.history.snapshots.length - this.history.maxHistorySize;
            this.history.snapshots.splice(0, removeCount);
        }
    }

    /**
     * Update memory usage trends
     */
    private updateTrends(snapshot: MemorySnapshot): void {
        const metrics = ['heapUsed', 'heapTotal', 'rss', 'external'] as const;
        
        metrics.forEach(metric => {
            const trend = this.calculateTrend(metric, snapshot);
            if (trend) {
                this.state.trends.set(metric, trend);
            }
        });
    }

    /**
     * Calculate trend for a specific memory metric
     */
    private calculateTrend(metric: keyof MemorySnapshot, _currentSnapshot: MemorySnapshot): MemoryTrend | undefined {
        if (this.history.snapshots.length < 2) {
            return undefined;
        }

        const recentSnapshots = this.history.snapshots.slice(-10); // Last 10 snapshots
        const values = recentSnapshots.map(s => Number(s[metric])).filter(v => !isNaN(v));
        
        if (values.length < 2) {
            return undefined;
        }

        // Calculate linear trend
        const n = values.length;
        const x = Array.from({length: n}, (_, i) => i);
        const y = values;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, xi, i) => sum + xi * (y[i] || 0), 0);
        const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const average = sumY / n;
        const changeRate = Math.abs(slope / average) * 100; // Percentage change rate
        
        const firstSnapshot = recentSnapshots[0];
        const timeWindowMs = firstSnapshot ? Date.now() - firstSnapshot.timestamp : 0;
        
        return {
            metric: metric as string,
            direction: slope > 0.01 ? 'increasing' : slope < -0.01 ? 'decreasing' : 'stable',
            rate: Math.round(changeRate * 100) / 100,
            confidence: Math.min(values.length / 10, 1), // Higher confidence with more data points
            timeWindowMs
        };
    }

    /**
     * Check for memory alerts and threshold violations
     */
    private async checkAlerts(snapshot: MemorySnapshot): Promise<void> {
        const alerts: MemoryAlert[] = [];

        // Check memory usage thresholds
        const usagePercent = (snapshot.heapUsed / this.config.maxMemoryMB) * 100;
        
        if (usagePercent >= this.thresholds.criticalPercent) {
            alerts.push(this.createAlert('memory_critical', 'critical', 
                `Memory usage critical: ${usagePercent.toFixed(1)}% (${snapshot.heapUsed}MB/${this.config.maxMemoryMB}MB)`,
                snapshot));
        } else if (usagePercent >= this.thresholds.warningPercent) {
            alerts.push(this.createAlert('memory_warning', 'warning',
                `Memory usage high: ${usagePercent.toFixed(1)}% (${snapshot.heapUsed}MB/${this.config.maxMemoryMB}MB)`,
                snapshot));
        }

        // Check for rapid growth
        if (this.state.lastSnapshot) {
            const growth = snapshot.heapUsed - this.state.lastSnapshot.heapUsed;
            const timeDiff = snapshot.timestamp - this.state.lastSnapshot.timestamp;
            
            if (growth > this.thresholds.rapidGrowthThreshold && timeDiff < this.config.monitoringInterval * 2) {
                alerts.push(this.createAlert('rapid_growth', 'warning',
                    `Rapid memory growth detected: +${growth.toFixed(1)}MB in ${timeDiff}ms`,
                    snapshot));
            }
        }

        // Check for potential memory leaks based on trends
        const heapTrend = this.state.trends.get('heapUsed');
        if (heapTrend && heapTrend.direction === 'increasing' && heapTrend.rate > 5 && heapTrend.confidence > 0.7) {
            alerts.push(this.createAlert('potential_leak', 'warning',
                `Potential memory leak: consistent growth at ${heapTrend.rate.toFixed(1)}% rate`,
                snapshot));
        }

        // Process alerts
        for (const alert of alerts) {
            await this.processAlert(alert);
        }
    }

    /**
     * Create a memory alert
     */
    private createAlert(type: AlertType, severity: AlertSeverity, message: string, snapshot: MemorySnapshot): MemoryAlert {
        return {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            severity,
            message,
            timestamp: Date.now(),
            memorySnapshot: snapshot,
            resolved: false
        };
    }

    /**
     * Process and emit memory alert
     */
    private async processAlert(alert: MemoryAlert): Promise<void> {
        // Add to alert history
        this.state.alertHistory.push(alert);
        
        // Limit alert history size
        if (this.state.alertHistory.length > 1000) {
            this.state.alertHistory.splice(0, this.state.alertHistory.length - 1000);
        }

        // Emit alert event
        this.emit('alert', alert);
        
        console.log(`[${alert.severity.toUpperCase()}] ${alert.message}`);
    }

    /**
     * Get current memory usage snapshot
     */
    async getCurrentUsage(): Promise<MemorySnapshot> {
        return await this.takeSnapshot();
    }

    /**
     * Get memory usage history
     */
    getHistory(): MemorySnapshot[] {
        return [...this.history.snapshots]; // Return copy
    }

    /**
     * Get memory usage trends
     */
    getTrends(): MemoryTrend[] {
        return Array.from(this.state.trends.values());
    }

    /**
     * Get recent alerts
     */
    getAlerts(limit = 50): MemoryAlert[] {
        return this.state.alertHistory
            .slice(-limit)
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    /**
     * Get monitoring statistics
     */
    getStats(): {
        isActive: boolean;
        uptime: number;
        totalSnapshots: number;
        totalAlerts: number;
        averageMemoryUsage: number;
        peakMemoryUsage: number;
        performanceImpact: number;
    } {
        const uptime = this.state.isActive ? Date.now() - this.history.startTime : 0;
        const snapshots = this.history.snapshots;
        
        let averageMemoryUsage = 0;
        let peakMemoryUsage = 0;
        
        if (snapshots.length > 0) {
            averageMemoryUsage = snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / snapshots.length;
            peakMemoryUsage = Math.max(...snapshots.map(s => s.heapUsed));
        }

        // Calculate performance impact (simplified - based on monitoring overhead)
        const performanceImpact = this.calculatePerformanceImpact();

        return {
            isActive: this.state.isActive,
            uptime,
            totalSnapshots: snapshots.length,
            totalAlerts: this.state.alertHistory.length,
            averageMemoryUsage: Math.round(averageMemoryUsage * 100) / 100,
            peakMemoryUsage: Math.round(peakMemoryUsage * 100) / 100,
            performanceImpact: Math.round(performanceImpact * 100) / 100
        };
    }

    /**
     * Calculate performance impact of monitoring
     */
    private calculatePerformanceImpact(): number {
        if (!this.performanceBaseline || this.history.snapshots.length < 10) {
            return 0;
        }

        // Compare current memory overhead to baseline
        const recentSnapshots = this.history.snapshots.slice(-10);
        const currentAverage = recentSnapshots.reduce((sum, s) => sum + s.heapUsed, 0) / recentSnapshots.length;
        const baselineUsage = this.performanceBaseline.heapUsed;
        
        // Calculate overhead percentage (monitoring system's memory usage)
        const monitoringOverhead = Math.max(0, currentAverage - baselineUsage);
        return (monitoringOverhead / baselineUsage) * 100;
    }

    /**
     * Force garbage collection and monitor impact
     */
    async forceGC(): Promise<{ before: MemorySnapshot; after: MemorySnapshot; freed: number }> {
        const before = await this.takeSnapshot();
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        } else {
            // Fallback - create memory pressure to encourage GC
            const largeArray = new Array(1000000).fill(null);
            largeArray.length = 0;
        }
        
        // Wait a bit for GC to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const after = await this.takeSnapshot();
        const freed = before.heapUsed - after.heapUsed;
        
        return { before, after, freed: Math.round(freed * 100) / 100 };
    }

    /**
     * Clean up monitoring system
     */
    async cleanup(): Promise<void> {
        await this.stop();
        
        // Clear history
        this.history.snapshots.length = 0;
        this.state.alertHistory.length = 0;
        this.state.trends.clear();
        
        // Remove all listeners
        this.removeAllListeners();
        
        console.log('Memory monitor cleanup completed');
    }
}

export default AdvancedMemoryMonitor;