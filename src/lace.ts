/**
 * Midnight wallet integration via the DApp Connector API.
 *
 * Midnight wallets (Lace, and others) inject a connector registry into the
 * page as `window.midnight`. Every entry implements the "InitialAPI" shape:
 *
 *   { rdns, name, icon, apiVersion, connect(networkId) }
 *
 * `connect` must be invoked synchronously inside the user-gesture handler and
 * returns the richer "ConnectedAPI" that we use to read the wallet's
 * configuration, addresses and balances, and to balance + submit transactions.
 */
import type {
  ConnectedAPI,
  Configuration,
  ConnectionStatus,
  InitialAPI,
} from '@midnight-ntwrk/dapp-connector-api';
import { setNetworkId, type NetworkId } from '@midnight-ntwrk/midnight-js-network-id';

export interface MidnightWalletHandle {
  readonly name: string;
  readonly rdns: string;
  readonly icon?: string;
  readonly connectedApi: ConnectedAPI;
  readonly configuration: Configuration;
  readonly status: ConnectionStatus;
  readonly networkId: NetworkId;
}

declare global {
  interface Window {
    midnight?: { [rdns: string]: InitialAPI };
  }
}

export function isWalletInstalled(): boolean {
  return typeof window !== 'undefined' && !!window.midnight;
}

export function listWallets(): InitialAPI[] {
  if (!isWalletInstalled()) return [];
  return Object.values(window.midnight ?? {}).filter(
    (wallet) => typeof wallet?.name === 'string' && typeof wallet?.apiVersion === 'string',
  );
}

/**
 * Connects to the Midnight wallet. Prefers Lace; falls back to the first
 * compatible wallet. Throws a descriptive error when no wallet is installed.
 */
export async function connectMidnightWallet(networkId: NetworkId): Promise<MidnightWalletHandle> {
  const wallets = listWallets();
  if (wallets.length === 0) {
    throw new Error('No Midnight wallet found — install the Lace browser extension.');
  }

  const wallet = wallets.find((w) => w.rdns?.toLowerCase().includes('lace')) ?? wallets[0];

  // NOTE: per the DApp Connector API, `connect` must run synchronously inside
  // the click handler — never from a setTimeout or an async continuation.
  const connectedApi = await wallet.connect(networkId);
  const [status, configuration] = await Promise.all([
    connectedApi.getConnectionStatus(),
    connectedApi.getConfiguration(),
  ]);

  const walletNetworkId =
    status.status === 'connected' ? (status.networkId as NetworkId) : networkId;
  // Align the global network ID used by midnight-js with the wallet's network.
  setNetworkId(walletNetworkId);

  return {
    name: wallet.name,
    rdns: wallet.rdns,
    icon: wallet.icon,
    connectedApi,
    configuration,
    status,
    networkId: walletNetworkId,
  };
}

export interface WalletBalances {
  readonly unshieldedAddress: string;
  readonly unshielded: { tokenName: string; amount: string }[];
  readonly shielded: { tokenName: string; amount: string }[];
  readonly dust: string;
}

/** Reads the wallet's balances for the diagnostic panel. */
export async function getWalletBalances(handle: MidnightWalletHandle): Promise<WalletBalances> {
  const [unshieldedAddressRes, unshieldedRes, shieldedRes, dustRes] = await Promise.all([
    handle.connectedApi.getUnshieldedAddress(),
    handle.connectedApi.getUnshieldedBalances().catch(() => null),
    handle.connectedApi.getShieldedBalances().catch(() => null),
    handle.connectedApi.getDustBalance().catch(() => null),
  ]);

  const unshielded = unshieldedRes
    ? Object.entries(unshieldedRes).map(([tokenName, amount]) => ({
        tokenName,
        amount: amount.toString(),
      }))
    : [];

  const shielded = shieldedRes
    ? Object.entries(shieldedRes).map(([tokenName, amount]) => ({
        tokenName,
        amount: amount.toString(),
      }))
    : [];

  return {
    unshieldedAddress: unshieldedAddressRes?.unshieldedAddress ?? '',
    unshielded,
    shielded,
    dust: dustRes ? dustRes.balance.toString() : '0',
  };
}
