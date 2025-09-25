import { EventEmitter } from "events";
import { logger } from "../../logging/logger.js";

export interface MessageBrokerConfig {
  maxQueueSize?: number;
  messageTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface QueuedMessage {
  id: string;
  connectionId: string;
  message: any;
  timestamp: Date;
  attempts: number;
  maxAttempts: number;
}

/**
 * Message broker handles asynchronous message queuing and delivery
 */
export class MessageBroker extends EventEmitter {
  private config: MessageBrokerConfig;
  private messageQueues = new Map<string, QueuedMessage[]>();
  private processing = new Set<string>();
  private messageCounter = 0;

  constructor(config: MessageBrokerConfig = {}) {
    super();
    this.config = {
      maxQueueSize: 1000,
      messageTimeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      ...config,
    };

    logger.info("Message broker initialized", {
      maxQueueSize: this.config.maxQueueSize,
      messageTimeout: this.config.messageTimeout,
      retryAttempts: this.config.retryAttempts,
    });
  }

  /**
   * Queue a message for delivery
   */
  queueMessage(
    connectionId: string,
    message: any,
    options: {
      maxAttempts?: number;
      priority?: number;
    } = {},
  ): string {
    const messageId = this.generateMessageId();

    if (!this.messageQueues.has(connectionId)) {
      this.messageQueues.set(connectionId, []);
    }

    const queue = this.messageQueues.get(connectionId)!;

    // Check queue size limits
    if (queue.length >= this.config.maxQueueSize!) {
      logger.warn("Message queue full, dropping oldest message", {
        connectionId,
        queueSize: queue.length,
        maxSize: this.config.maxQueueSize,
      });
      queue.shift(); // Remove oldest message
    }

    const queuedMessage: QueuedMessage = {
      id: messageId,
      connectionId,
      message,
      timestamp: new Date(),
      attempts: 0,
      maxAttempts: options.maxAttempts || this.config.retryAttempts!,
    };

    // Insert based on priority (if specified) or append
    if (options.priority !== undefined) {
      // Higher priority = lower number, insert at front
      const insertIndex = queue.findIndex(
        (m) =>
          (m as any).priority === undefined ||
          (m as any).priority > options.priority!,
      );
      if (insertIndex >= 0) {
        queue.splice(insertIndex, 0, queuedMessage);
      } else {
        queue.push(queuedMessage);
      }
      (queuedMessage as any).priority = options.priority;
    } else {
      queue.push(queuedMessage);
    }

    logger.debug("Message queued", {
      messageId,
      connectionId,
      queueSize: queue.length,
      priority: options.priority,
    });

    // Start processing if not already running for this connection
    this.processQueue(connectionId);

    return messageId;
  }

  /**
   * Process queued messages for a connection
   */
  private async processQueue(connectionId: string): Promise<void> {
    if (this.processing.has(connectionId)) {
      return; // Already processing this queue
    }

    this.processing.add(connectionId);

    try {
      const queue = this.messageQueues.get(connectionId);
      if (!queue || queue.length === 0) {
        return;
      }

      while (queue.length > 0) {
        const message = queue.shift()!;

        try {
          await this.deliverMessage(message);

          logger.debug("Message delivered successfully", {
            messageId: message.id,
            connectionId,
            attempts: message.attempts,
          });

          this.emit("messageDelivered", message);
        } catch (error) {
          message.attempts++;

          if (message.attempts < message.maxAttempts) {
            // Retry after delay
            logger.warn("Message delivery failed, retrying", {
              messageId: message.id,
              connectionId,
              attempt: message.attempts,
              maxAttempts: message.maxAttempts,
              error: error instanceof Error ? error.message : "Unknown error",
            });

            // Re-queue with delay
            setTimeout(() => {
              queue.unshift(message);
              this.processQueue(connectionId);
            }, this.config.retryDelay! * message.attempts);

            break; // Stop processing this queue for now
          } else {
            logger.error("Message delivery failed permanently", {
              messageId: message.id,
              connectionId,
              attempts: message.attempts,
              error: error instanceof Error ? error.message : "Unknown error",
            });

            this.emit("messageFailed", { message, error });
          }
        }
      }
    } finally {
      this.processing.delete(connectionId);
    }
  }

  /**
   * Deliver a message (emits event for actual delivery)
   */
  private async deliverMessage(message: QueuedMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Message delivery timeout"));
      }, this.config.messageTimeout);

      // Emit delivery event and wait for confirmation
      this.emit("deliverMessage", message, (error?: Error) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get queue statistics
   */
  getQueueStats(connectionId?: string) {
    if (connectionId) {
      const queue = this.messageQueues.get(connectionId) || [];
      return {
        connectionId,
        queueSize: queue.length,
        processing: this.processing.has(connectionId),
        oldestMessage: queue.length > 0 ? queue[0]?.timestamp || null : null,
      };
    }

    const totalMessages = Array.from(this.messageQueues.values()).reduce(
      (sum, queue) => sum + queue.length,
      0,
    );

    const connectionStats = Array.from(this.messageQueues.entries()).map(
      ([id, queue]) => ({
        connectionId: id,
        queueSize: queue.length,
        processing: this.processing.has(id),
      }),
    );

    return {
      totalMessages,
      activeQueues: this.messageQueues.size,
      processingQueues: this.processing.size,
      connectionStats,
    };
  }

  /**
   * Clear queue for connection
   */
  clearQueue(connectionId: string): number {
    const queue = this.messageQueues.get(connectionId);
    const clearedCount = queue ? queue.length : 0;

    if (queue) {
      queue.length = 0;
      this.processing.delete(connectionId);

      logger.info("Queue cleared", {
        connectionId,
        clearedMessages: clearedCount,
      });
    }

    return clearedCount;
  }

  /**
   * Remove connection and clear its queue
   */
  removeConnection(connectionId: string): void {
    const clearedCount = this.clearQueue(connectionId);
    this.messageQueues.delete(connectionId);

    logger.info("Connection removed from message broker", {
      connectionId,
      clearedMessages: clearedCount,
    });
  }

  /**
   * Shutdown the message broker
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down message broker", {
      activeQueues: this.messageQueues.size,
      processingQueues: this.processing.size,
    });

    // Wait for current processing to complete (with timeout)
    const shutdownTimeout = 10000; // 10 seconds
    const startTime = Date.now();

    while (
      this.processing.size > 0 &&
      Date.now() - startTime < shutdownTimeout
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.processing.size > 0) {
      logger.warn(
        "Message broker shutdown timeout, some queues still processing",
        {
          processingQueues: Array.from(this.processing),
        },
      );
    }

    // Clear all queues
    for (const [connectionId] of this.messageQueues) {
      this.clearQueue(connectionId);
    }

    this.messageQueues.clear();
    this.processing.clear();

    logger.info("Message broker shutdown complete");
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageCounter}`;
  }
}
