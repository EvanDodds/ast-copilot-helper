import { EventEmitter } from 'events';
import { logger } from '../../logging/logger.js';

export interface EventCoordinatorConfig {
  maxListeners?: number;
  eventTimeout?: number;
  retryEvents?: boolean;
  retryAttempts?: number;
}

export interface EventMetrics {
  eventType: string;
  emittedCount: number;
  handledCount: number;
  errorCount: number;
  averageHandleTime: number;
  lastEmitted?: Date;
  lastHandled?: Date;
}

/**
 * Event coordinator manages event flow and coordination across MCP components
 */
export class EventCoordinator extends EventEmitter {
  private config: EventCoordinatorConfig;
  private eventMetrics = new Map<string, EventMetrics>();
  private eventHandlers = new Map<string, Set<(...args: any[]) => void>>();
  private processingEvents = new Set<string>();

  constructor(config: EventCoordinatorConfig = {}) {
    super();
    this.config = {
      maxListeners: 100,
      eventTimeout: 10000, // 10 seconds
      retryEvents: true,
      retryAttempts: 3,
      ...config
    };

    this.setMaxListeners(this.config.maxListeners!);
    this.setupGlobalErrorHandling();

    logger.info('Event coordinator initialized', {
      maxListeners: this.config.maxListeners,
      eventTimeout: this.config.eventTimeout,
      retryEvents: this.config.retryEvents
    });
  }

  /**
   * Emit an event with enhanced coordination and metrics
   */
  emitEvent(eventType: string, ...args: any[]): boolean {
    const eventId = this.generateEventId(eventType);
    
    // Update metrics
    this.updateEventMetrics(eventType, 'emitted');

    logger.debug('Emitting coordinated event', {
      eventId,
      eventType,
      argsCount: args.length
    });

    try {
      // Emit with timeout and error handling
      return this.emitWithCoordination(eventType, eventId, args);
    } catch (error) {
      logger.error('Error emitting event', {
        eventId,
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      this.updateEventMetrics(eventType, 'error');
      return false;
    }
  }

  /**
   * Register a coordinated event handler
   */
  onEvent(eventType: string, handler: (...args: any[]) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    const handlers = this.eventHandlers.get(eventType)!;
    handlers.add(handler);

    // Wrap handler with coordination logic
    const coordinatedHandler = this.createCoordinatedHandler(eventType, handler);
    this.on(eventType, coordinatedHandler);

    logger.debug('Event handler registered', {
      eventType,
      handlerCount: handlers.size
    });
  }

  /**
   * Unregister an event handler
   */
  offEvent(eventType: string, handler: (...args: any[]) => void): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }

    this.off(eventType, handler);

    logger.debug('Event handler unregistered', {
      eventType,
      remainingHandlers: handlers?.size || 0
    });
  }

  /**
   * Wait for a specific event with timeout
   */
  async waitForEvent(eventType: string, timeout?: number): Promise<any[]> {
    const eventTimeout = timeout || this.config.eventTimeout!;
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(eventType, handler);
        reject(new Error(`Event timeout: ${eventType} not received within ${eventTimeout}ms`));
      }, eventTimeout);

      const handler = (...args: any[]) => {
        clearTimeout(timer);
        this.off(eventType, handler);
        resolve(args);
      };

      this.once(eventType, handler);
    });
  }

  /**
   * Emit event and wait for acknowledgment
   */
  async emitAndWait(eventType: string, ackEventType: string, ...args: any[]): Promise<any[]> {
    const ackPromise = this.waitForEvent(ackEventType);
    this.emitEvent(eventType, ...args);
    
    try {
      return await ackPromise;
    } catch (error) {
      logger.warn('Event acknowledgment timeout', {
        eventType,
        ackEventType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Broadcast event to multiple event types
   */
  broadcastEvent(eventTypes: string[], ...args: any[]): boolean {
    let success = true;
    
    for (const eventType of eventTypes) {
      try {
        const result = this.emitEvent(eventType, ...args);
        success = success && result;
      } catch (error) {
        logger.error('Error broadcasting to event type', {
          eventType,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        success = false;
      }
    }

    logger.info('Event broadcast completed', {
      eventTypes,
      success,
      argsCount: args.length
    });

    return success;
  }

  /**
   * Get event metrics
   */
  getEventMetrics(eventType?: string): EventMetrics | EventMetrics[] {
    if (eventType) {
      return this.eventMetrics.get(eventType) || this.createEmptyMetrics(eventType);
    }

    return Array.from(this.eventMetrics.values());
  }

  /**
   * Get coordination statistics
   */
  getCoordinationStats() {
    const metrics = Array.from(this.eventMetrics.values());
    
    return {
      totalEvents: metrics.reduce((sum, m) => sum + m.emittedCount, 0),
      totalHandled: metrics.reduce((sum, m) => sum + m.handledCount, 0),
      totalErrors: metrics.reduce((sum, m) => sum + m.errorCount, 0),
      eventTypes: metrics.length,
      processingEvents: this.processingEvents.size,
      registeredHandlers: this.eventHandlers.size,
      averageHandleTime: this.calculateAverageHandleTime(metrics)
    };
  }

  /**
   * Reset event metrics
   */
  resetMetrics(): void {
    this.eventMetrics.clear();
    logger.info('Event coordinator metrics reset');
  }

  /**
   * Shutdown event coordinator
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down event coordinator', {
      eventTypes: this.eventHandlers.size,
      processingEvents: this.processingEvents.size
    });

    // Wait for processing events to complete
    const shutdownTimeout = 5000; // 5 seconds
    const startTime = Date.now();

    while (this.processingEvents.size > 0 && (Date.now() - startTime) < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.processingEvents.size > 0) {
      logger.warn('Event coordinator shutdown timeout, some events still processing', {
        processingEvents: Array.from(this.processingEvents)
      });
    }

    // Remove all listeners
    this.removeAllListeners();
    this.eventHandlers.clear();
    this.processingEvents.clear();

    logger.info('Event coordinator shutdown complete');
  }

  /**
   * Private coordination methods
   */
  private emitWithCoordination(eventType: string, eventId: string, args: any[]): boolean {
    this.processingEvents.add(eventId);

    try {
      const result = super.emit(eventType, eventId, ...args);
      
      if (result) {
        this.updateEventMetrics(eventType, 'handled');
      }

      return result;
    } finally {
      this.processingEvents.delete(eventId);
    }
  }

  private createCoordinatedHandler(eventType: string, originalHandler: (...args: any[]) => void): (...args: any[]) => void {
    return async (eventId: string, ...args: any[]) => {
      const startTime = Date.now();

      try {
        logger.debug('Handling coordinated event', {
          eventId,
          eventType
        });

        // Execute original handler
        const result = await Promise.resolve(originalHandler(eventId, ...args));
        
        const handleTime = Date.now() - startTime;
        this.updateEventMetrics(eventType, 'handled', handleTime);

        return result;
      } catch (error) {
        const handleTime = Date.now() - startTime;
        this.updateEventMetrics(eventType, 'error', handleTime);

        logger.error('Error in coordinated event handler', {
          eventId,
          eventType,
          handleTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Re-emit as error event
        this.emitEvent('coordinatorError', {
          eventId,
          eventType,
          originalError: error,
          handleTime
        });

        throw error;
      }
    };
  }

  private updateEventMetrics(eventType: string, operation: 'emitted' | 'handled' | 'error', handleTime?: number): void {
    if (!this.eventMetrics.has(eventType)) {
      this.eventMetrics.set(eventType, this.createEmptyMetrics(eventType));
    }

    const metrics = this.eventMetrics.get(eventType)!;

    switch (operation) {
      case 'emitted':
        metrics.emittedCount++;
        metrics.lastEmitted = new Date();
        break;
      case 'handled':
        metrics.handledCount++;
        metrics.lastHandled = new Date();
        if (handleTime !== undefined) {
          metrics.averageHandleTime = (metrics.averageHandleTime + handleTime) / 2;
        }
        break;
      case 'error':
        metrics.errorCount++;
        if (handleTime !== undefined) {
          metrics.averageHandleTime = (metrics.averageHandleTime + handleTime) / 2;
        }
        break;
    }
  }

  private createEmptyMetrics(eventType: string): EventMetrics {
    return {
      eventType,
      emittedCount: 0,
      handledCount: 0,
      errorCount: 0,
      averageHandleTime: 0
    };
  }

  private calculateAverageHandleTime(metrics: EventMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const totalTime = metrics.reduce((sum, m) => sum + m.averageHandleTime, 0);
    return totalTime / metrics.length;
  }

  private generateEventId(eventType: string): string {
    return `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupGlobalErrorHandling(): void {
    this.on('error', (error) => {
      logger.error('Unhandled event coordinator error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    });
  }
}