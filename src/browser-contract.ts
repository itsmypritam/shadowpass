/**
 * Client-side ShadowPass contract interface driven by a Midnight wallet
 * (Lace via the DApp Connector API).
 *
 * This is the Level 2 browser flow: the page connects to Lace, proves the
 * eligibility comparison locally (the wallet reports a proof-server URI),
 * balances + signs with Lace, and submits. The private score never leaves
 * the browser tab.
 *
 * Providers used:
 *   - public data:   indexer (from the wallet's configuration)
 *   - ZK artifacts:  FetchZkConfigProvider over same-origin `/zk/`
 *   - proving:       httpClientProofProvider -> the wallet's proof server
 *   - private state: in-memory Map (this contract has no witnesses)
 *   - wallet:        DApp Connector adapter (serialize <-> hex)
 *   - submission:    DApp Connector submitTransaction
 */
import type { ContractAddress, FinalizedTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import * as ledger from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type {
  MidnightProvider,
  MidnightProviders,
  PrivateStateProvider,
} from '@midnight-ntwrk/midnight-js-types';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';

import { Contract, ledger as shadowPassLedger } from '../managed/shadow-pass/contract/index.js';
import type { MidnightWalletHandle } from './lace';

export const PRIVATE_STATE_ID = 'shadowPassPrivateState';

/** Same-origin base URL for the ZK artifacts (keys/ + zkir/). */
const zkAssetsBaseUrl = () => `${window.location.origin}/zk`;

const compiledContract = CompiledContract.make('shadow-pass', Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkAssetsBaseUrl()),
);

/* ---------------------------------------------------------------- */
/* In-memory private state provider                                  */
/* ---------------------------------------------------------------- */

/**
 * Minimal in-memory private state provider. The ShadowPass circuit has no
 * witnesses, so the private state is always `{}` — we keep it in memory for
 * the lifetime of the page. Signing keys are likewise kept in memory (only
 * used by the framework for maintenance transactions, which we never issue).
 */
class BrowserPrivateStateProvider implements PrivateStateProvider {
  private contractAddress: ContractAddress | null = null;
  private readonly privateStates = new Map<string, unknown>();
  private readonly signingKeys = new Map<string, string>();

  setContractAddress(address: ContractAddress): void {
    this.contractAddress = address;
  }

  async set(privateStateId: string, state: unknown): Promise<void> {
    this.privateStates.set(privateStateId, state);
  }

  async get(privateStateId: string): Promise<unknown> {
    return this.privateStates.get(privateStateId) ?? null;
  }

  async remove(privateStateId: string): Promise<void> {
    this.privateStates.delete(privateStateId);
  }

  async clear(): Promise<void> {
    this.privateStates.clear();
  }

  async setSigningKey(address: ContractAddress, signingKey: string): Promise<void> {
    this.signingKeys.set(String(address), signingKey);
  }

  async getSigningKey(address: ContractAddress): Promise<string | null> {
    return this.signingKeys.get(String(address)) ?? null;
  }

  async removeSigningKey(address: ContractAddress): Promise<void> {
    this.signingKeys.delete(String(address));
  }

  async clearSigningKeys(): Promise<void> {
    this.signingKeys.clear();
  }

  async exportPrivateStates(): Promise<never> {
    throw new Error('Private-state export is not supported in the browser build.');
  }

  async importPrivateStates(): Promise<never> {
    throw new Error('Private-state import is not supported in the browser build.');
  }

  async exportSigningKeys(): Promise<never> {
    throw new Error('Signing-key export is not supported in the browser build.');
  }

  async importSigningKeys(): Promise<never> {
    throw new Error('Signing-key import is not supported in the browser build.');
  }
}

/* ---------------------------------------------------------------- */
/* DApp Connector adapters                                            */
/* ---------------------------------------------------------------- */

function createWalletProvider(api: MidnightWalletHandle['connectedApi']) {
  const coinKeys = { coinPublicKey: '', encryptionPublicKey: '' };

  return {
    getCoinPublicKey() {
      return coinKeys.coinPublicKey;
    },
    getEncryptionPublicKey() {
      return coinKeys.encryptionPublicKey;
    },
    async balanceTx(tx: any, ttl?: Date) {
      const unsealedHex = toHex(tx.serialize());
      const sealedHex = (await api.balanceUnsealedTransaction(unsealedHex)).tx;
      // Markers: the wallet returns a `Transaction<SignatureEnabled, Proof, Binding>`.
      return ledger.Transaction.deserialize(
        'signature',
        'proof',
        'binding',
        fromHex(sealedHex),
      ) as FinalizedTransaction;
    },
  };
}

function createMidnightProvider(api: MidnightWalletHandle['connectedApi']): MidnightProvider {
  return {
    async submitTx(tx: FinalizedTransaction) {
      const hex = toHex(tx.serialize());
      await api.submitTransaction(hex);
      const [txId] = tx.identifiers();
      if (!txId) throw new Error('Balanced transaction produced no transaction ID');
      return txId;
    },
  };
}

/* ---------------------------------------------------------------- */
/* Providers + deployed contract                                     */
/* ---------------------------------------------------------------- */

export async function createBrowserProviders(wallet: MidnightWalletHandle): Promise<MidnightProviders> {
  const { indexerUri, indexerWsUri, proverServerUri } = wallet.configuration;

  if (!indexerUri) {
    throw new Error('The wallet reports no indexer URI — check the Lace network configuration.');
  }
  if (!proverServerUri) {
    throw new Error(
      'The wallet reports no proof-server URI. Configure Lace to use a local node + proof server, ' +
        'or use the server-side verify path.',
    );
  }

  const zkConfigProvider = new FetchZkConfigProvider(zkAssetsBaseUrl());
  const connectedApi = wallet.connectedApi;
  const walletProvider = createWalletProvider(connectedApi);

  // Prefetch the coin/encryption keys: WalletProvider exposes them synchronously.
  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } =
    await connectedApi.getShieldedAddresses();
  Object.assign(walletProvider, {
    getCoinPublicKey: () => shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedEncryptionPublicKey,
  });

  return {
    privateStateProvider: new BrowserPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(indexerUri, indexerWsUri),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proverServerUri, zkConfigProvider),
    walletProvider,
    midnightProvider: createMidnightProvider(connectedApi),
  };
}

interface Session {
  readonly walletRdns: string;
  readonly contractAddress: string;
  readonly providers: MidnightProviders;
  readonly deployed: any;
}

let currentSession: Session | null = null;

export function clearBrowserSession(): void {
  currentSession = null;
}

async function getDeployedContract(
  wallet: MidnightWalletHandle,
  contractAddress: string,
): Promise<{ deployed: any; providers: MidnightProviders }> {
  if (currentSession && currentSession.walletRdns === wallet.rdns && currentSession.contractAddress === contractAddress) {
    return { deployed: currentSession.deployed, providers: currentSession.providers };
  }

  const providers = await createBrowserProviders(wallet);
  const deployed: any = await findDeployedContract(providers as any, {
    compiledContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });

  currentSession = { walletRdns: wallet.rdns, contractAddress, providers, deployed };
  return { deployed, providers };
}

/* ---------------------------------------------------------------- */
/* Public API for the UI                                             */
/* ---------------------------------------------------------------- */

export interface BrowserVerifyResult {
  readonly txId: string;
  readonly blockHeight: number;
  readonly lastResult: boolean;
}

/**
 * Runs the eligibility circuit against the deployed contract using the
 * connected Lace wallet. Returns the on-chain transaction info; the claimed
 * boolean is all that is published.
 */
export async function verifyViaWallet(
  wallet: MidnightWalletHandle,
  contractAddress: string,
  claimedEligible: boolean,
  score: bigint,
): Promise<BrowserVerifyResult> {
  const { deployed } = await getDeployedContract(wallet, contractAddress);
  const tx = await deployed.callTx.verifyEligibility(claimedEligible, score);
  return {
    txId: tx.public.txId,
    blockHeight: tx.public.blockHeight,
    lastResult: claimedEligible,
  };
}

/**
 * Reads the deployed contract's public ledger state straight from the
 * indexer configured in the wallet — no server involved.
 */
export async function readBrowserContractState(wallet: MidnightWalletHandle, contractAddress: string) {
  const providers = await createBrowserProviders(wallet);
  const state = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!state) throw new Error('Contract state not found on chain');
  const ledgerState = shadowPassLedger(state.data);
  return {
    network: wallet.networkId,
    address: contractAddress,
    requirement: ledgerState.requirement.toString(),
    verificationCount: ledgerState.verificationCount.toString(),
    lastResult: ledgerState.lastResult,
  };
}

export interface PublicContractState {
  network: string;
  address: string;
  requirement: string;
  verificationCount: string;
  lastResult: boolean;
}

/**
 * Backend-less read of the deployed contract's public ledger state: needs
 * only the public indexer (the compiled contract is bundled in the page).
 * Used by the hosted live demo, where there is no API server.
 */
export async function readPublicContractState(
  indexerUri: string,
  indexerWsUri: string,
  contractAddress: string,
  network: string,
): Promise<PublicContractState> {
  const publicDataProvider = indexerPublicDataProvider(indexerUri, indexerWsUri);
  const state = await publicDataProvider.queryContractState(contractAddress);
  if (!state) throw new Error('Contract state not found on chain');
  const ledgerState = shadowPassLedger(state.data);
  return {
    network,
    address: contractAddress,
    requirement: ledgerState.requirement.toString(),
    verificationCount: ledgerState.verificationCount.toString(),
    lastResult: ledgerState.lastResult,
  };
}
