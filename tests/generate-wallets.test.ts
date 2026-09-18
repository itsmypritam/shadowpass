import { describe, it, expect } from 'vitest';

import { deriveAddress, generateWallets, writeBatch } from '../scripts/generate-wallets';
import { GENESIS_SEED } from '../scripts/network';
import { isPlausibleAddress, addUser, summarize, emptyRegistry } from '../src/registry';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('generate-wallets', () => {
  it('derives a valid, plausible Midnight address from the genesis seed', () => {
    const addr = deriveAddress(GENESIS_SEED, 'preprod');
    expect(isPlausibleAddress(addr)).toBe(true);
    expect(/^m/.test(addr)).toBe(true);
    expect(addr.length).toBeGreaterThanOrEqual(30);
  });

  it('address derivation is deterministic per seed', () => {
    const a = deriveAddress(GENESIS_SEED, 'preprod');
    const b = deriveAddress(GENESIS_SEED, 'preprod');
    expect(a).toBe(b);
  });

  it('different seeds derive different addresses', () => {
    const a = deriveAddress(GENESIS_SEED, 'preprod');
    const b = deriveAddress('0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20', 'preprod');
    expect(a).not.toBe(b);
  });

  it('generates the requested number of real, unique wallets', () => {
    const wallets = generateWallets(5, 'preprod');
    expect(wallets.length).toBe(5);
    const addresses = new Set(wallets.map((w) => w.address));
    expect(addresses.size).toBe(5);
    for (const w of wallets) {
      expect(w.mnemonic.split(' ').length).toBe(24);
      expect(w.seed).toMatch(/^(?:[0-9a-f]{2}){64}$/);
      expect(isPlausibleAddress(w.address)).toBe(true);
    }
  });

  it('writeBatch persists files and returns a matching summary', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shadowpass-wallet-batch-'));
    const wallets = generateWallets(2, 'preprod');
    const summary = writeBatch(wallets, { outDir: tmp });

    expect(summary.count).toBe(2);
    expect(summary.addresses.length).toBe(2);
    for (const a of summary.addresses) expect(isPlausibleAddress(a)).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'wallets.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmp, 'addresses.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(tmp, 'addresses.txt'), 'utf-8').trim().split('\n').length).toBe(2);
  });

  it('generated addresses can be registered (unverified) then verified later', () => {
    const wallets = generateWallets(3, 'preprod');
    const reg = emptyRegistry();
    for (const w of wallets) addUser(reg, w.address);
    const s = summarize(reg);
    expect(s.userCount).toBe(3);
    expect(s.verifiedCount).toBe(0);

    addUser(reg, wallets[0].address);
    expect(summarize(reg).userCount).toBe(3);
  });
});