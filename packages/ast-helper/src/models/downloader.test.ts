import { describe, it, expect, vi } from 'vitest';/**/**

import { ModelDownloader, ProgressTracker, DownloadError } from './downloader.js';

import { ModelConfig } from './types.js'; * Tests for model download infrastructure * Tests for model download infrastructure



describe('ProgressTracker', () => { */ */

  it('should initialize correctly', () => {

    const tracker = new ProgressTracker(1000, 0);

    const progress = tracker.getProgress();

    import { describe, it, expect, vi, beforeEach } from 'vitest';import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

    expect(progress.bytesDownloaded).toBe(0);

    expect(progress.totalBytes).toBe(1000);import { ModelDownloader, ProgressTracker, DownloadError } from './downloader.js';import { ModelDownloader, ProgressTracker, DownloadError } from './downloader.js';

    expect(progress.percentage).toBe(0);

    expect(progress.phase).toBe('downloading');import { ModelConfig } from './types.js';import { ModelConfig } from './types.js';

  });

import * as fs from 'fs/promises';

  it('should calculate progress correctly', () => {

    const tracker = new ProgressTracker(1000, 0);describe('ProgressTracker', () => {import { createWriteStream } from 'fs';

    const progress = tracker.updateProgress(500);

      it('should initialize with correct values', () => {

    expect(progress.percentage).toBe(50);

    expect(progress.bytesDownloaded).toBe(500);    const tracker = new ProgressTracker(1000000, 0);// Mock fetch and file system operations

  });

});    const progress = tracker.getProgress();vi.mock('fs/promises');



describe('ModelDownloader', () => {vi.mock('fs');

  it('should create instance', () => {

    const downloader = new ModelDownloader();    expect(progress.bytesDownloaded).toBe(0);

    expect(downloader).toBeInstanceOf(ModelDownloader);

  });    expect(progress.totalBytes).toBe(1000000);const mockFs = vi.mocked(fs);



  it('should handle DownloadError', () => {    expect(progress.percentage).toBe(0);const mockCreateWriteStream = vi.mocked(createWriteStream);

    const error = new DownloadError('Test', 'http://test.com', 3);

    expect(error.message).toBe('Test');    expect(progress.phase).toBe('downloading');

    expect(error.url).toBe('http://test.com');

    expect(error.attempts).toBe(3);  });describe('ProgressTracker', () => {

  });

});  it('should initialize with correct values', () => {

  it('should calculate progress percentage correctly', () => {    const tracker = new ProgressTracker(1000000, 0);

    const tracker = new ProgressTracker(1000, 0);    const progress = tracker.getProgress();

    const progress = tracker.updateProgress(500);

    expect(progress.bytesDownloaded).toBe(0);

    expect(progress.percentage).toBe(50);    expect(progress.totalBytes).toBe(1000000);

    expect(progress.bytesDownloaded).toBe(500);    expect(progress.percentage).toBe(0);

  });    expect(progress.phase).toBe('downloading');

  });

  it('should handle zero total bytes', () => {

    const tracker = new ProgressTracker(0, 0);  it('should calculate progress percentage correctly', () => {

    const progress = tracker.getProgress();    const tracker = new ProgressTracker(1000, 0);

    const progress = tracker.updateProgress(500);

    expect(progress.percentage).toBe(0);

  });    expect(progress.percentage).toBe(50);

});    expect(progress.bytesDownloaded).toBe(500);

  });

describe('ModelDownloader', () => {

  let downloader: ModelDownloader;  it('should handle zero total bytes', () => {

  let mockLogger: Console;    const tracker = new ProgressTracker(0, 0);

      const progress = tracker.getProgress();

  const testModelConfig: ModelConfig = {

    name: 'test-model',    expect(progress.percentage).toBe(0);

    version: '1.0.0',  });

    url: 'https://example.com/model.onnx',

    checksum: 'abc123',  it('should calculate speed over time', async () => {

    size: 1000000,    vi.useFakeTimers();

    format: 'onnx',    const tracker = new ProgressTracker(2000, 0);

    dimensions: 768

  };    // Initial progress

    tracker.updateProgress(100);

  beforeEach(() => {    

    mockLogger = {    // Advance time by 2 seconds

      log: vi.fn(),    vi.advanceTimersByTime(2000);

      error: vi.fn(),    

      warn: vi.fn(),    // Update progress after 2 seconds

      info: vi.fn()    const progress = tracker.updateProgress(1100);

    } as any;    

        // Speed should be 500 bytes/second (1000 bytes in 2 seconds)

    downloader = new ModelDownloader(mockLogger);    expect(progress.speed).toBeGreaterThan(0);

    vi.clearAllMocks();    

  });    vi.useRealTimers();

  });"
  it('should create downloader instance', () => {
    expect(downloader).toBeInstanceOf(ModelDownloader);
  });

  it('should throw DownloadError on invalid config', () => {
    expect(() => {
      new DownloadError('Test error', 'http://example.com', 3);
    }).not.toThrow();
  });
});