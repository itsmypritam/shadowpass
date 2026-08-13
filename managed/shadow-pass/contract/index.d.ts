import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  verifyEligibility(context: __compactRuntime.CircuitContext<PS>,
                    claimedEligible_0: boolean,
                    eligibilityScore_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  verifyEligibility(context: __compactRuntime.CircuitContext<PS>,
                    claimedEligible_0: boolean,
                    eligibilityScore_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  verifyEligibility(context: __compactRuntime.CircuitContext<PS>,
                    claimedEligible_0: boolean,
                    eligibilityScore_0: bigint): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly requirement: bigint;
  readonly verificationCount: bigint;
  readonly lastResult: boolean;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
