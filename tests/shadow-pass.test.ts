/**
 * Unit tests for the ShadowPass contract.
 *
 * These run purely against the generated contract (compact-runtime testkit):
 * no proof server and no blockchain are required.
 */
import { describe, it, expect } from 'vitest';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { ShadowPassSimulator } from './shadow-pass-simulator';

setNetworkId('undeployed');

// The public eligibility rule encoded in the contract constructor.
const REQUIREMENT = 60n;

describe('ShadowPass contract', () => {
  it('initializes the public ledger rule and empty state', () => {
    const simulator = new ShadowPassSimulator();
    const ledger = simulator.getLedger();

    expect(ledger.requirement).toBe(REQUIREMENT);
    expect(ledger.verificationCount).toBe(0n);
    expect(ledger.lastResult).toBe(false);
  });

  it('records an eligible verification when the private score is above the rule', () => {
    const simulator = new ShadowPassSimulator();
    const ledger = simulator.verify(true, 85n);

    expect(ledger.lastResult).toBe(true);
    expect(ledger.verificationCount).toBe(1n);
  });

  it('accepts a score exactly equal to the requirement as eligible', () => {
    const simulator = new ShadowPassSimulator();
    const ledger = simulator.verify(true, REQUIREMENT);

    expect(ledger.lastResult).toBe(true);
    expect(ledger.verificationCount).toBe(1n);
  });

  it('records a not-eligible verification when the private score is below the rule', () => {
    const simulator = new ShadowPassSimulator();
    const ledger = simulator.verify(false, 12n);

    expect(ledger.lastResult).toBe(false);
    expect(ledger.verificationCount).toBe(1n);
  });

  it('accepts a score one below the requirement as not eligible', () => {
    const simulator = new ShadowPassSimulator();
    const ledger = simulator.verify(false, REQUIREMENT - 1n);

    expect(ledger.lastResult).toBe(false);
    expect(ledger.verificationCount).toBe(1n);
  });

  it('rejects a claim of eligible when the private score is below the rule', () => {
    const simulator = new ShadowPassSimulator();
    const before = simulator.getLedger();

    expect(() => simulator.verify(true, 42n)).toThrow(
      'failed assert: Not eligible: private value is below the requirement',
    );

    // A failed proof must not mutate the ledger state.
    expect(simulator.getLedger()).toEqual(before);
  });

  it('rejects a claim of not eligible when the private score is at least the rule', () => {
    const simulator = new ShadowPassSimulator();
    const before = simulator.getLedger();

    expect(() => simulator.verify(false, 60n)).toThrow(
      'failed assert: Not ineligible: private value is at least the requirement',
    );

    // A failed proof must not mutate the ledger state.
    expect(simulator.getLedger()).toEqual(before);
  });

  it('accumulates the public verification count across valid proofs', () => {
    const simulator = new ShadowPassSimulator();

    simulator.verify(true, 100n);
    simulator.verify(false, 20n);
    const ledger = simulator.verify(true, 88n);

    expect(ledger.verificationCount).toBe(3n);
    expect(ledger.lastResult).toBe(true);
  });

  it('never reveals the private score — only the boolean result becomes public', () => {
    const simulator = new ShadowPassSimulator();
    const ledger = simulator.verify(true, 99n);

    // The ledger only contains the rule, the counter, and the boolean result.
    // The private score (99n) appears nowhere in the public state.
    expect(ledger.requirement).toBe(REQUIREMENT);
    expect(ledger.verificationCount).toBe(1n);
    expect(ledger.lastResult).toBe(true);
    expect(Object.keys(ledger).sort()).toEqual(
      ['lastResult', 'requirement', 'verificationCount'].sort(),
    );
  });
});
