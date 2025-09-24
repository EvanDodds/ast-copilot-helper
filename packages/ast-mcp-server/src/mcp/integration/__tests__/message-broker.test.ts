import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageBroker, type QueuedMessage } from '../message-broker.js';

// Mock logger
vi.mock('../../../logging/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('MessageBroker - Simplified Tests', () => {
  let messageBroker: MessageBroker;

  beforeEach(() => {
    messageBroker = new MessageBroker({
      maxQueueSize: 5,
      messageTimeout: 30000,  // Long timeout
      retryAttempts: 1,       // Only try once
      retryDelay: 100
    });
  });

  afterEach(async () => {
    await messageBroker.shutdown();
  });

  describe('Message Processing Success', () => {
    it('should successfully deliver messages', async () => {
      let deliveredMessage: QueuedMessage | undefined;
      
      // Set up delivery handler
      messageBroker.on('deliverMessage', (message: QueuedMessage, callback: () => void) => {
        deliveredMessage = message;
        callback(); // Success
      });

      const messageId = messageBroker.queueMessage('conn-1', { test: 'message' });
      
      expect(messageId).toBeDefined();
      expect(messageId).toMatch(/^msg_\d+_\d+$/);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(deliveredMessage).toBeDefined();
      expect(deliveredMessage!.message).toEqual({ test: 'message' });
    });

    it('should emit messageDelivered on success', async () => {
      let deliveredEvent: QueuedMessage | undefined;
      
      messageBroker.on('messageDelivered', (message: QueuedMessage) => {
        deliveredEvent = message;
      });

      messageBroker.on('deliverMessage', (message: QueuedMessage, callback: () => void) => {
        callback(); // Success
      });

      messageBroker.queueMessage('conn-1', { test: 'delivered' });
      
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(deliveredEvent).toBeDefined();
      expect(deliveredEvent!.message).toEqual({ test: 'delivered' });
    });
  });

  describe('Message Processing Failures', () => {
    it('should handle delivery failures', async () => {
      let failedMessage: QueuedMessage | undefined;
      
      messageBroker.on('messageFailed', ({ message }: { message: QueuedMessage }) => {
        failedMessage = message;
      });

      messageBroker.on('deliverMessage', (message: QueuedMessage, callback: () => void) => {
        callback(new Error('Delivery failed'));
      });

      messageBroker.queueMessage('conn-1', { test: 'fail' });
      
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(failedMessage).toBeDefined();
      expect(failedMessage!.message).toEqual({ test: 'fail' });
    });

    it('should handle timeouts', async () => {
      let timeoutError: Error | undefined;
      
      messageBroker.on('messageFailed', ({ error }: { error: Error }) => {
        timeoutError = error;
      });

      messageBroker.on('deliverMessage', (message: QueuedMessage, callback: () => void) => {
        // Never call callback - timeout will occur
      });

      // Use very short timeout for this test
      const shortTimeoutBroker = new MessageBroker({
        messageTimeout: 100,
        retryAttempts: 1
      });

      shortTimeoutBroker.on('deliverMessage', (message: QueuedMessage, callback: () => void) => {
        // Never call callback
      });

      shortTimeoutBroker.on('messageFailed', ({ error }: { error: Error }) => {
        timeoutError = error;
      });

      shortTimeoutBroker.queueMessage('conn-1', { test: 'timeout' });
      
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(timeoutError).toBeDefined();
      expect(timeoutError!.message).toContain('timeout');
      
      await shortTimeoutBroker.shutdown();
    });
  });

  describe('Queue Management', () => {
    it('should provide basic queue statistics', () => {
      // Create messages that will start processing but not complete
      let pausedCallback: (() => void) | undefined;
      
      messageBroker.on('deliverMessage', (message: QueuedMessage, callback: () => void) => {
        pausedCallback = callback; // Don't call it yet
      });

      messageBroker.queueMessage('conn-1', { message: 'paused' });
      
      // Check stats while message is being processed
      const stats = messageBroker.getQueueStats();
      expect(stats.processingQueues).toBe(1);

      // Complete the message
      if (pausedCallback) {
        pausedCallback();
      }
    });

    it('should shutdown gracefully', async () => {
      let deliveryCompleted = false;

      messageBroker.on('deliverMessage', (message: QueuedMessage, callback: () => void) => {
        setTimeout(() => {
          deliveryCompleted = true;
          callback();
        }, 50);
      });

      messageBroker.queueMessage('conn-1', { test: 'shutdown' });
      
      await messageBroker.shutdown();
      expect(deliveryCompleted).toBe(true);
    });
  });
});