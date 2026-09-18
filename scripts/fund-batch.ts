/**
 * Fund every address in a generated wallet batch from the project wallet.
 *
 * Usage: npx tsx scripts/fund-batch.ts [addressesFile] [rawAmount]
 *
 * Defaults to .wallet-batch/<active-network>/addresses.txt and 1 tNIGHT
 * per recipient. Prints the current tNIGHT balance before transferring.
 * Any receipt address that reports insufficient balance is skipped and
 * reported at the end — re-run the script to retry skipped rows.
 */
import { WebSocket } from 'ws';

import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { MidnightBech32m, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk';

import { resolveNetwork, getOrCreateWallet } from './network';
import { createWallet, persistWalletState } from './wallet';
import { BATCH_DIR_NAME } from './generate-wallets';
import * as fs from 'node:fs';
import * as path from 'node:path';

globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;

const { network, config: networkConfig } = resolveNetwork();
const rawAmount = BigInt(process.argv[3] ?? '1000000000000');

const batchDir = path.join(BATCH_DIR_NAME, network);
const addressesFile = process.argv[2] ?? path.join(batchDir, 'addresses.txt');

if (!fs.existsSync(addressesFile)) {
  console.error(`No addresses file found: ${addressesFile}`);
  process.exit(1);
}

const addresses = fs
  .readFileSync(addressesFile, 'utf-8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l.length > 0);

if (addresses.length === 0) {
  console.error(`No addresses in ${addressesFile}`);
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

if (rawAmount * BigInt(addresses.length) > balance) {
  console.error(
    `Insufficient funds: need ${(rawAmount * BigInt(addresses.length)).toLocaleString()} raw for ${addresses.length} recipients, have ${balance.toLocaleString()}`,
  );
  await walletCtx.wallet.stop();
  process.exit(1);
}

await persistWalletState(network, walletCtx);

const ttl = new Date(Date.now() + 30 * 60 * 1000);
const skipped: string[] = [];

for (let i = 0; i < addresses.length; i++) {
  const to = addresses[i];
  if (!to.startsWith('mn_addr_')) {
    skipped.push(to);
    continue;
  }
  const receiver = MidnightBech32m.parse(to).decode(UnshieldedAddress, network);
  process.stdout.write(`\r  Funding ${i + 1}/${addresses.length} ${to.slice(0, 16)}...`);
  try {
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
    const signSegment = (data: Uint8Array) => walletCtx.unshieldedKeystore.signData(data);
    const signed = await walletCtx.wallet.signRecipe(recipe, signSegment);
    const finalized = await walletCtx.wallet.finalizeRecipe(signed);
    await walletCtx.wallet.submitTransaction(finalized);
  } catch (err: any) {
    skipped.push(to);
    const msg = err?.message || err?.toString() || '';
    console.warn(`\n  ✗ ${to}: ${msg.slice(0, 160)}`);
  }
}

process.stdout.write('\n');

await persistWalletState(network, walletCtx);
await walletCtx.wallet.stop();

if (skipped.length === 0) {
  console.log(`Done. Funded ${addresses.length} addresses with ${rawAmount} raw tNIGHT each.`);
} else {
  console.log(`Funded ${addresses.length - skipped.length}/${addresses.length}. Skipped ${skipped.length}:`);
  for (const s of skipped) console.log(`  - ${s}`);
  console.log(`Re-run to retry skipped rows.`);
}