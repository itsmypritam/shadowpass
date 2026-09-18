import { describe, it, expect } from 'vitest';
import {
  normalizeHex,
  isContractTx,
  matchesForContract,
  uniqueOwners,
  type BlockRow,
  type TransactionRow,
} from '../scripts/sync-users';

const CONTRACT = 'e5a0ea30513a2e1da27ff18a47865a0d7e63ccd73771320170c6e1befda51f69';

function tx(partial: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 1,
    hash: 'a'.repeat(64),
    contractActions: [],
    unshieldedCreatedOutputs: [],
    unshieldedSpentOutputs: [],
    ...partial,
  };
}

function block(transactions: TransactionRow[], height = 34500): BlockRow {
  return { height, hash: 'b'.repeat(64), timestamp: 1_700_000_000, transactions };
}

describe('normalizeHex', () => {
  it('strips 0x prefixes and lowercases', () => {
    expect(normalizeHex('0xABC123')).toBe('abc123');
    expect(normalizeHex(`0x${CONTRACT}`)).toBe(CONTRACT);
  });
});

describe('isContractTx', () => {
  it('matches a contract action on the target address (any case)', () => {
    expect(isContractTx(tx({ contractActions: [{ address: `0x${CONTRACT.toUpperCase()}` }] }), CONTRACT)).toBe(true);
  });
  it('does not match foreign contract actions', () => {
    expect(isContractTx(tx({ contractActions: [{ address: '0x' + 'f'.repeat(64) }] }), CONTRACT)).toBe(false);
  });
  it('does not match txs without contract actions', () => {
    expect(isContractTx(tx(), CONTRACT)).toBe(false);
  });
});

describe('matchesForContract', () => {
  const matching = tx({
    hash: 'c'.repeat(64),
    contractActions: [{ address: CONTRACT }],
    unshieldedCreatedOutputs: [
      { owner: 'mn1grownUpWalletAddress0123456789abcdef0123456789abcdef0123456789abcdef' },
      { owner: 'not-an-address' },
      { owner: null },
    ],
    unshieldedSpentOutputs: [
      { owner: 'mn1secondWalletAddress0123456789abcdef0123456789abcdef0123456789abcdef' },
    ],
  });
  it('extracts plausible owners from matching txs only', () => {
    const bk = block([
      matching,
      tx({ hash: 'd'.repeat(64), contractActions: [{ address: '0x' + 'e'.repeat(64) }] }),
    ]);
    const out = matchesForContract(bk, CONTRACT);
    expect(out).toHaveLength(1);
    expect(out[0].txHash).toBe('c'.repeat(64));
    expect(out[0].height).toBe(bk.height);
    expect(out[0].owners.sort()).toEqual([
      'mn1grownUpWalletAddress0123456789abcdef0123456789abcdef0123456789abcdef',
      'mn1secondWalletAddress0123456789abcdef0123456789abcdef0123456789abcdef',
    ]);
  });
  it('returns zero matches for an untouched window', () => {
    expect(matchesForContract(block([tx()]), CONTRACT)).toEqual([]);
  });
});

describe('uniqueOwners', () => {
  it('deduplicates and sorts owners across matches', () => {
    const m = [
      { txHash: 'a', height: 1, timestamp: null, owners: ['zaddr1', 'baddr2'] },
      { txHash: 'b', height: 2, timestamp: null, owners: ['baddr2', 'baddr2'] },
    ];
    expect(uniqueOwners(m)).toEqual(['baddr2', 'zaddr1']);
  });
});