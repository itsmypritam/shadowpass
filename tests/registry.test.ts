/**
 * Unit tests for the ShadowPass user registry (src/registry.ts).
 *
 * The registry is the committed swap-space of the Level 5 feedback loop —
 * who signed up, how many verifications are attributable, and what they told
 * us. These tests keep the schema and the operator/CI relied-upon functions
 * honest.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  emptyRegistry,
  loadRegistry,
  saveRegistry,
  addUser,
  removeUser,
  recordVerification,
  addFeedback,
  validateRegistry,
  summarize,
  isPlausibleAddress,
  usersToMarkdown,
  normalizeRegistry,
  type RegistryData,
} from '../src/registry';

function tmpRegistry(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'shadowpass-registry-'));
}

const SAMPLE_ADDR = 'mn1qj9zefvcg3v3uu7g5p5d5e0q9kq7nprfz5uthvfiy9kzpzqv6qr0vj4lkc';

function withSampleUser(data: RegistryData): RegistryData {
  addUser(data, SAMPLE_ADDR, '2026-08-20T12:00:00.000Z');
  return data;
}

describe('registry: empty + defaults', () => {
  it('creates an empty, valid registry', () => {
    const data = emptyRegistry();
    expect(data.network).toBe('preprod');
    expect(validateRegistry(data)).toEqual([]);
    expect(summarize(data)).toMatchObject({
      userCount: 0,
      verifiedCount: 0,
      totalVerifications: 0,
      feedbackCount: 0,
      avgRating: null,
    });
  });

  it('loads a fresh registry as empty when the file is missing', () => {
    const empty = loadRegistry(tmpRegistry());
    expect(empty.users).toEqual([]);
    expect(empty.feedback).toEqual([]);
  });

  it('round-trips through save + load', () => {
    const dir = tmpRegistry();
    saveRegistry(withSampleUser(emptyRegistry()), dir);
    const loaded = loadRegistry(dir);
    expect(loaded.users).toHaveLength(1);
    expect(loaded.users[0].address).toBe(SAMPLE_ADDR);
  });
});

describe('registry: users', () => {
  it('adds a user once and dedupes repeats', () => {
    const data = emptyRegistry();
    expect(addUser(data, SAMPLE_ADDR)).toBe(true);
    expect(addUser(data, SAMPLE_ADDR)).toBe(false);
    expect(data.users).toHaveLength(1);
  });

  it('records verifications and marks the wallet verified', () => {
    const data = withSampleUser(emptyRegistry());
    recordVerification(data, SAMPLE_ADDR);
    recordVerification(data, SAMPLE_ADDR);
    const s = summarize(data);
    expect(s.totalVerifications).toBe(2);
    expect(s.verifiedCount).toBe(1);
    expect(data.users[0].verified).toBe(true);
  });

  it('records a verification even for a previously unknown wallet', () => {
    const data = emptyRegistry();
    recordVerification(data, SAMPLE_ADDR);
    expect(summarize(data).verifiedCount).toBe(1);
    expect(data.users[0].verifications).toBe(1);
  });

  it('unregisters a user', () => {
    const data = withSampleUser(emptyRegistry());
    expect(removeUser(data, SAMPLE_ADDR)).toBe(true);
    expect(removeUser(data, SAMPLE_ADDR)).toBe(false);
    expect(data.users).toHaveLength(0);
  });
});

describe('registry: feedback', () => {
  it('adds a feedback entry and registers its wallet', () => {
    const data = emptyRegistry();
    addFeedback(data, {
      walletAddress: SAMPLE_ADDR,
      rating: 5,
      useCase: 'age verification',
      comment: 'Works great!',
      submittedAt: '2026-08-20T12:00:00.000Z',
    });
    const s = summarize(data);
    expect(s.feedbackCount).toBe(1);
    expect(s.userCount).toBe(1);
    expect(s.avgRating).toBe(5);
  });

  it('keeps anonymous feedback without creating a user', () => {
    const data = emptyRegistry();
    addFeedback(data, {
      walletAddress: 'anonymous',
      rating: 3,
      useCase: '',
      comment: 'ok',
      submittedAt: '2026-08-20T12:00:00.000Z',
    });
    expect(summarize(data).userCount).toBe(0);
  });

  it('computes the average rating across entries', () => {
    const data = emptyRegistry();
    for (const rating of [5, 4, 3]) {
      addFeedback(data, {
        walletAddress: 'anonymous',
        rating,
        useCase: '',
        comment: '',
        submittedAt: '2026-08-20T12:00:00.000Z',
      });
    }
    expect(summarize(data).avgRating).toBe(4);
  });
});

describe('registry: validation', () => {
  it('accepts addresses that look like Midnight bech32 values', () => {
    expect(isPlausibleAddress(SAMPLE_ADDR)).toBe(true);
  });

  it('accepts both SDK bech32m and compact-form Midnight addresses', () => {
    expect(isPlausibleAddress('mn_addr_preprod1h3ssm5ru2t6eqy4g3she78zlxn96e36ms6pq996aduvmateh9p9sv7qz0p')).toBe(true);
    expect(isPlausibleAddress('mn1q3v75gzhkj8s6l4ky9maxcfx3j5yzy9q7jv5')).toBe(true);
  });

  it('rejects clearly invalid addresses', () => {
    expect(isPlausibleAddress('')).toBe(false);
    expect(isPlausibleAddress('hello')).toBe(false);
    expect(isPlausibleAddress('0x' + 'ab'.repeat(40))).toBe(false);
    expect(isPlausibleAddress('x' + SAMPLE_ADDR)).toBe(false);
  });

  it('flags duplicates, bad ratings, and implausible addresses', () => {
    const data = emptyRegistry();
    addUser(data, SAMPLE_ADDR);
    data.users.push({ address: SAMPLE_ADDR, firstSeenAt: null, verifications: 0, verified: false });
    data.users.push({ address: 'not-an-address', firstSeenAt: null, verifications: 0, verified: false });
    data.feedback.push({ walletAddress: 'anonymous', rating: 9, useCase: '', comment: '', submittedAt: '' });

    const errors = validateRegistry(data);
    expect(errors.some((e) => e.includes('duplicate address'))).toBe(true);
    expect(errors.some((e) => e.includes('not a plausible Midnight address'))).toBe(true);
    expect(errors.some((e) => e.includes('rating must be an integer 1-5'))).toBe(true);
    expect(errors.some((e) => e.includes('submittedAt'))).toBe(true);
  });

  it('accepts and normalizes the legacy string-list shape', () => {
    const data = normalizeRegistry(
      { network: 'preprod', description: 'legacy', users: ['mn1obsolete...'], feedback: [] },
      'preprod',
    );
    expect(data.users[0].address).toBe('mn1obsolete...');
    expect(data.users[0].verified).toBe(false);
    expect(validateRegistry(data).filter((e) => e.includes('mn1obsolete'))).toHaveLength(1);
  });
});

describe('registry: export', () => {
  it('renders a markdown table with a header', () => {
    const data = withSampleUser(emptyRegistry());
    const md = usersToMarkdown(data);
    expect(md).toContain('| Wallet address |');
    expect(md).toContain(SAMPLE_ADDR);
  });

  it('prints a friendly empty state', () => {
    expect(usersToMarkdown(emptyRegistry())).toContain('No users registered yet.');
  });
});