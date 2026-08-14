/**
 * Fund an unshielded (NIGHT) address from the project wallet.
 *
 * Usage: npx tsx scripts/fund.ts <mn_addr_...> [rawAmount]
 *
 * Runs against the active network (see .midnight-state.json). Prints the
 * current tNIGHT balance before transferring.
 */
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';

import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk';

import { resolveNetwork, getOrCreateWallet } from './network';
import { createWallet, persistWalletState } from './wallet';

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const { network, config: networkConfig } = resolveNetwork();
const to = process.argv[2];
const rawAmount = BigInt(process.argv[3] ?? '1000000000000');

if (!to || !to.startsWith('mn_addr_')) {
  console.error('Usage: npx tsx scripts/fund.ts <mn_addr_...> [rawAmount]');
  process.exit(1);
}

const walletCtx = await createWallet({
  network,
  networkConfig,
  seed: getOrCreateWallet(network).seed,
});

const syncStart = Date.now();
const state = await walletCtx.wallet.waitForSyncedState();
console.log(`Synced in ${Math.round((Date.now() - syncStart) / 1000)}s`);

const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
const dustBalance = state.dust.balance(new Date());
console.log(`tNIGHT balance: ${balance.toLocaleString()} raw`);
console.log(`DUST balance: ${dustBalance.toLocaleString()}`);

if (rawAmount > balance) {
  console.error(`Insufficient funds: requested ${rawAmount}, have ${balance}`);
  await walletCtx.wallet.stop();
  process.exit(1);
}

await persistWalletState(network, walletCtx);

const receiver = MidnightBech32m.parse(to).decode(UnshieldedAddress, network);
const ttl = new Date(Date.now() + 30 * 60 * 1000);

console.log(`Funding ${to} with ${rawAmount} raw tNIGHT...`);

const recipe = await walletCtx.wallet.transferTransaction(
  [
    {
      type: 'unshielded',
      outputs: [{ type: unshieldedToken().raw, receiverAddress: receiver, amount: rawAmount }],
    },
  ],
  { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
  { ttl },
);

console.log('Transfer recipe built, signing...');

const signSegment = (data: Uint8Array) => walletCtx.unshieldedKeystore.signData(data);
const signed = await walletCtx.wallet.signRecipe(recipe, signSegment);

console.log('Transfer recipe signed, finalizing...');

const finalized = await walletCtx.wallet.finalizeRecipe(signed);
const txId = await walletCtx.wallet.submitTransaction(finalized);

console.log(`Submitted: ${txId}`);

await persistWalletState(network, walletCtx);
await walletCtx.wallet.stop();
console.log('Done.');
