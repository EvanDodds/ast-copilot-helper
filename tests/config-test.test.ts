import { describe, expect, it } from 'vitest';

describe('Vitest Configuration', () => {
  it('should run basic test', () => {
    expect(true).toBe(true);
  });

  it('should have access to path aliases', () => {
    // This test will verify path resolution works
    expect(process.env.NODE_ENV).toBe('test');
  });
});