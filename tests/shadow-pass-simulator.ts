/**
 * In-memory simulator for the ShadowPass contract.
 *
 * Uses the compact-runtime testkit directly (no proof server, no network):
 * it builds a `Contract` instance, runs the constructor, and threads the
 * `CircuitContext` through `impureCircuits` exactly the way the deployed
 * contract would execute on-chain.
 */
import {
  CostModel,
  QueryContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  ledger,
  type Ledger,
} from '../managed/shadow-pass/contract/index.js';

export type ShadowPassPrivateState = Record<string, never>;

export class ShadowPassSimulator {
  readonly contract: Contract<ShadowPassPrivateState>;
  circuitContext: CircuitContext<ShadowPassPrivateState>;

  constructor() {
    this.contract = new Contract<ShadowPassPrivateState>({});
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext({}, '0'.repeat(64)),
      );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /** Runs verifyEligibility and returns the resulting ledger state. */
  verify(claimedEligible: boolean, eligibilityScore: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.verifyEligibility(
      this.circuitContext,
      claimedEligible,
      eligibilityScore,
    ).context;
    return this.getLedger();
  }
}
