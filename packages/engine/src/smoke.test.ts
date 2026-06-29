import { describe, it, expect } from 'vitest';
import { VERSION } from './index';

describe('engine package', () => {
  it('exports a version string', () => {
    expect(typeof VERSION).toBe('string');
  });
});
