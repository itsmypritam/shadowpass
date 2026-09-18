/**
 * Generate real Midnight wallets for the Preprod user batch.
 *
 * Each wallet is a genuine BIP-39 24-word recovery phrase whose seed derives
 * valid Midnight keys — the exact same derivation the app/wallet SDK use, so
 * every address here is a real, spendable Midnight address (restorable in
 * Lace). Nothing here is fabricated: no fake users, no pretend addresses.
 *
 * Becoming a *verified* user is a separate, later step: the wallet must be
 * funded and complete a verification against the deployed contract, then the
 * on-chain sync harvest (npm run sync-users) or the batch verifier records it.
 * This tool only creates the identities + addresses.
 *
 * Usage:
 *   npx tsx scripts/generate-wallets.ts [--count 70] [--network preprod] [--out .wallet-batch]
 *   npx tsx scripts/generate-wallets.ts --from .wallet-batch/preprod --registry
 *
 * Output (in `--out/<network>/`, gitignored):
 *   wallets.json   - full records incl. seed + recovery phrase (SECRET)
 *   wallets.tsv    - index \t address \t mnemonic (SECRET)
 *   addresses.txt  - one address per line (safe to share)
 *   summary.json   - count, network, generatedAt, address list
 *   README.txt     - what this is and how to turn these into verified users
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

import { HDWallet, Roles, createKeystore } from '@midnight-ntwrk/wallet-sdk';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import {
  parseNetworkFlag,
  resolveNetwork,
  type NetworkId,
} from './network';
import { generateMnemonicPhrase, mnemonicToSeedHex } from './network';
import {
  addUser,
  loadRegistry,
  saveRegistry,
  summarize,
} from '../src/registry';

export const BATCH_DIR_NAME = '.wallet-batch';
export const DEFAULT_WALLET_COUNT = 70;

export interface GeneratedWallet {
  index: number;
  network: NetworkId;
  address: string;
  /** 24-word BIP-39 recovery phrase (SECRET — restores this wallet in Lace). */
  mnemonic: string;
  /** 64-byte seed as 128 hex chars (SECRET). */
  seed: string;
  createdAt: string;
}

export interface BatchSummary {
  network: NetworkId;
  count: number;
  generatedAt: string;
  outputDir: string;
  addresses: string[];
}

function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  const result = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  hdWallet.hdWallet.clear();
  return result.keys;
}

/**
 * Derive the unshielded (bech32) Midnight address for a seed on a network.
 * Pure derivation — no network call. Deterministic for a given seed + network.
 */
export function deriveAddress(seed: string, networkId: NetworkId): string {
  setNetworkId(networkId);
  const keys = deriveKeys(seed);
  const keystore = createKeystore(keys[Roles.NightExternal], getNetworkId());
  return String(keystore.getBech32Address());
}

/** Create `count` real wallets for `network`. */
export function generateWallets(count: number, network: NetworkId): GeneratedWallet[] {
  setNetworkId(network);
  const wallets: GeneratedWallet[] = [];
  for (let i = 0; i < count; i++) {
    const mnemonic = generateMnemonicPhrase();
    const seed = mnemonicToSeedHex(mnemonic);
    const address = deriveAddress(seed, network);
    wallets.push({ index: i, network, address, mnemonic, seed, createdAt: new Date().toISOString() });
  }
  return wallets;
}

export interface WriteBatchOptions {
  outDir?: string;
}

/** Load a previously generated batch (wallets.json) from an output dir. */
export function loadBatch(outDir: string): GeneratedWallet[] {
  const p = path.join(outDir, 'wallets.json');
  if (!fs.existsSync(p)) throw new Error(`No wallets.json found in "${outDir}". Generate one first.`);
  const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as GeneratedWallet[];
  if (!Array.isArray(raw)) throw new Error(`Invalid batch file: ${p}`);
  return raw;
}

/**
 * Register every address in a batch with the public registry.
 *
 * Deliberately non-destructive and honest: addresses are added as
 * REGISTERED but UNVERIFIED (verified: false, verifications: 0). Nothing here
 * fabricates on-chain activity — a wallet only becomes verified through the
 * on-chain flows (batch-verify + `npm run sync-users --apply`) after the
 * contract is deployed and the wallets are funded.
 */
export function importBatchToRegistry(wallets: GeneratedWallet[], cwd = process.cwd()): number {
  const data = loadRegistry(cwd);
  let added = 0;
  for (const w of wallets) {
    if (addUser(data, w.address)) added++;
  }
  saveRegistry(data, cwd);
  return added;
}

function loadBatchSummary(outDir: string): BatchSummary {
  const p = path.join(outDir, 'summary.json');
  if (!fs.existsSync(p)) throw new Error(`No summary.json in "${outDir}".`);
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as BatchSummary;
}

export function writeBatch(wallets: GeneratedWallet[], opts: WriteBatchOptions = {}): BatchSummary {
  const network = wallets[0]?.network;
  if (!network) throw new Error('No wallets to write.');
  const outDir = opts.outDir ?? path.join(BATCH_DIR_NAME, network);
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, 'wallets.json'), `${JSON.stringify(wallets, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.writeFileSync(
    path.join(outDir, 'wallets.tsv'),
    wallets.map((w) => [w.index, w.address, w.mnemonic].join('\t')).join('\n'),
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(outDir, 'addresses.txt'),
    wallets.map((w) => w.address).join('\n'),
  );

  const summary: BatchSummary = {
    network,
    count: wallets.length,
    generatedAt: new Date().toISOString(),
    outputDir: outDir,
    addresses: wallets.map((w) => w.address),
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  fs.writeFileSync(
    path.join(outDir, 'README.txt'),
    [
      `ShadowPass generated wallets for network: ${network}`,
      `Generated: ${summary.generatedAt}  Count: ${wallets.length}`,
      '',
      'WHAT THIS IS',
      '  Real Midnight wallets generated with the app SDK (BIP-39 phrases ->',
      '  seed -> valid Midnight address). wallets.json / wallets.tsv contain',
      '  recovery phrases - KEEP THEM PRIVATE and back them up.',
      '',
      'WHAT IT IS NOT',
      '  These are NOT "users" yet. Once the contract is deployed you may',
      '  register them (UNVERIFIED) via: npm run generate-wallets -- --from',
      '  <dir> --registry. They become VERIFIED Preprod users only after each',
      '  wallet is funded and performs an on-chain verification against the',
      '  deployed contract. Never bulk-mark these as verified.',
      '',
      'NEXT STEPS (see docs/DEPLOY_PREPROD.md)',
      '  1. Deploy the ShadowPass contract to Preprod.',
      '  2. Fund each address (faucet) - addresses.txt is a paste list.',
      '  3. Run: npm run batch-verify -- --network preprod',
      '     (verifies each wallet once against the deployed contract)',
      '  4. Run: npm run sync-users -- --network preprod --contract <hex> --apply',
      '     (harvests only addresses the indexer actually saw, as verified)',
      '',
      'Only step 4 upgrades those 70 into "verified" on the chain-backed truth.',
      'The registry lists them as registered/unverified until then.',
      '',
    ].join('\n'),
  );

  return summary;
}

function isEntrypoint(): boolean {
  try {
    const here = fileURLToPath(import.meta.url);
    const invoked = process.argv[1] && fs.realpathSync(process.argv[1]);
    return invoked === fs.realpathSync(here);
  } catch {
    return false;
  }
}

export function parseArgs(argv: string[]): {
  count: number;
  network: NetworkId | null;
  outDir: string | null;
  fromDir: string | null;
  registry: boolean;
  json: boolean;
} {
  let count = DEFAULT_WALLET_COUNT;
  let outDir: string | null = null;
  let fromDir: string | null = null;
  let registry = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--count' || arg === '-c') {
      count = Number(argv[++i]);
    } else if (arg.startsWith('--count=')) {
      count = Number(arg.slice('--count='.length));
    } else if (arg === '--out') {
      outDir = argv[++i];
    } else if (arg.startsWith('--out=')) {
      outDir = arg.slice('--out='.length);
    } else if (arg === '--from') {
      fromDir = argv[++i];
    } else if (arg.startsWith('--from=')) {
      fromDir = arg.slice('--from='.length);
    } else if (arg === '--registry') {
      registry = true;
    } else if (arg === '--json') {
      json = true;
    }
  }
  return { count, network: parseNetworkFlag(argv), outDir, fromDir, registry, json };
}

function cliMain(): number {
  const { count, network, outDir, fromDir, registry, json } = parseArgs(process.argv.slice(1));
  const resolved = network ?? resolveNetwork().network;
  const target: NetworkId = resolved === 'undeployed' ? 'preprod' : resolved;
  const targetOut = outDir ?? path.join(BATCH_DIR_NAME, target);

  if (fromDir) {
    const wallets = loadBatch(fromDir);
    if (registry) {
      const added = importBatchToRegistry(wallets);
      const s = summarize(loadRegistry());
      if (json) {
        process.stdout.write(`${JSON.stringify({ registered: added, ...s }, null, 2)}\n`);
      } else {
        process.stdout.write(`\n  Registered ${added} real addresses in the registry (UNVERIFIED).\n`);
        process.stdout.write(`  Users: ${s.userCount}  |  Verified on-chain: ${s.verifiedCount}\n`);
        process.stdout.write('  They become verified only via on-chain flows after Preprod deploy:\n');
        process.stdout.write('    npm run batch-verify -- --network preprod\n');
        process.stdout.write('    npm run sync-users -- --network preprod --contract <hex> --apply\n\n');
      }
      return 0;
    }
    const summary = loadBatchSummary(fromDir);
    if (json) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    } else {
      process.stdout.write(`\n  Loaded ${wallets.length} real wallets from ${fromDir}\n`);
      for (const w of wallets) process.stdout.write(`    ${w.address}\n`);
      process.stdout.write('\n  Re-run with `--registry` to import them (unverified) or use `--count` to regenerate.\n\n');
    }
    return 0;
  }

  if (!count || !Number.isInteger(count) || count < 1 || count > 500) {
    process.stderr.write('--count must be an integer between 1 and 500.\n');
    return 2;
  }

  const wallets = generateWallets(count, target);
  const summary = writeBatch(wallets, { outDir: targetOut });
  const registered = registry ? importBatchToRegistry(wallets) : 0;

  if (json) {
    process.stdout.write(`${JSON.stringify({ ...summary, registered }, null, 2)}\n`);
    return 0;
  }

  process.stdout.write(`\n  Generated ${summary.count} real Midnight wallets on network: ${target}\n`);
  process.stdout.write(`  Output: ${path.join(process.cwd(), summary.outputDir)}\n\n`);
  for (const addr of summary.addresses) process.stdout.write(`    ${addr}\n`);
  if (registry) {
    const s = summarize(loadRegistry());
    process.stdout.write(`\n  Registered ${registered} real addresses (UNVERIFIED) in the registry.\n`);
    process.stdout.write(`  Users: ${s.userCount}  |  Verified on-chain: ${s.verifiedCount}\n`);
  }
  process.stdout.write('\n  ⚠ Save wallets.json / wallets.tsv securely (recovery phrases inside).\n');
  process.stdout.write('  ℹ These are identities, not yet users — verified only after the\n');
  process.stdout.write('    on-chain sync (npm run sync-users --apply) sees them on-chain.\n\n');
  return 0;
}

if (isEntrypoint()) {
  const code = cliMain();
  process.exit(code);
}