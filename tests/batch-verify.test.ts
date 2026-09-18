import { describe, it, expect } from 'vitest';

import { parseBatchVerifyArgs } from '../scripts/batch-verify';

describe('batch-verify parseBatchVerifyArgs', () => {
  it('applies defaults', () => {
    const opts = parseBatchVerifyArgs([]);
    expect(opts.network).toBe('preprod');
    expect(opts.eligible).toBe(true);
    expect(opts.score).toBe(100n);
    expect(opts.concurrency).toBeUndefined();
  });

  it('parses overrides', () => {
    const opts = parseBatchVerifyArgs([
      '--network', 'preview',
      '--eligible', 'false',
      '--score', '55',
      '--concurrency', '2',
      '--index-start', '5',
      '--limit', '3',
      '--json',
    ]);
    expect(opts.network).toBe('preview');
    expect(opts.eligible).toBe(false);
    expect(opts.score).toBe(55n);
    expect(opts.concurrency).toBe(2);
    expect(opts.indexStart).toBe(5);
    expect(opts.limit).toBe(3);
    expect(opts.json).toBe(true);
  });

  it('rejects unknown networks', () => {
    expect(() => parseBatchVerifyArgs(['--network', 'testnet'])).toThrow();
  });
});