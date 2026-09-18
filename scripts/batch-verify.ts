/**
 * Verify every generated wallet once against the deployed ShadowPass contract.
 *
 * Turns the generated identity batch (.wallet-batch/<network>/wallets.json)
 * into real on-chain verifications: each wallet connects to the network,
 * runs one verifyEligibility against the deployed contract, and submits the
 * transaction. Nothing is marked verified in the registry here — the final
 * step is the on-chain harvest:
 *
 *   npm run sync-users -- --network preprod --contract <hex> --apply
 *
 * which reads the indexer and flags only the addresses it actually saw.
 *
 * Prerequisites:
 *   - Contract deployed on the network (npm run setup / deploy; recorded in
 *     .midnight-state.json). See docs/DEPLOY_PREPROD.md.
 *   - A reachable proof server (npm run proof-server:start).
 *   - Each wallet funded (faucet / npm run fund) so the tx can be balanced.
 *
 * Usage:
 *   npx tsx scripts/batch-verify.ts --network preprod [--batch .wallet-batch/preprod]
 *     [--concurrency 1] [--eligible true] [--score 100] [--index-start 0] [--limit 70] [--json]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

import { resolveNetwork, getDeployment } from './network';
import { createWallet, type WalletContext } from './wallet';
import { BATCH_DIR_NAME, loadBatch, type GeneratedWallet } from './generate-wallets';

// @ts-expect-error wallet sync requires WebSocket
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = 'shadowPassPrivateState';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'managed', 'shadow-pass');
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

const { network, config: networkConfig } = resolveNetwork();
const deployment = getDeployment(network);

export interface BatchVerifyOptions {
  network: 'preprod' | 'preview';
  batchDir?: string;
  concurrency?: number;
  eligible?: boolean;
  score?: bigint;
  indexStart?: number;
  limit?: number;
  json?: boolean;
}

export interface VerifyOutcome {
  index: number;
  address: string;
  ok: boolean;
  txId?: string;
  blockHeight?: number;
  error?: string;
}

export function parseBatchVerifyArgs(argv: string[]): BatchVerifyOptions {
  const opts: BatchVerifyOptions = { network: 'preprod', eligible: true, score: 100n };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--network') {
      const v = argv[++i];
      if (v !== 'preprod' && v !== 'preview') throw new Error('--network must be preprod or preview');
      opts.network = v;
    } else if (arg === '--batch') {
      opts.batchDir = argv[++i];
    } else if (arg === '--concurrency') {
      opts.concurrency = Number(argv[++i]);
    } else if (arg === '--eligible') {
      opts.eligible = argv[++i] === 'true';
    } else if (arg === '--score') {
      opts.score = BigInt(argv[++i]);
    } else if (arg === '--index-start') {
      opts.indexStart = Number(argv[++i]);
    } else if (arg === '--limit') {
      opts.limit = Number(argv[++i]);
    } else if (arg === '--json') {
      opts.json = true;
    }
  }
  return opts;
}

// Lazy-build the CompiledContract once (mirrors server.ts). The zk config dir is
// only read when a wallet actually verifies, so importing this module is cheap.
let cachedCompiled: Promise<any> | null = null;
export function compiledContract(): Promise<any> {
  if (!cachedCompiled) {
    cachedCompiled = import(pathToFileURL(contractPath).href).then(
      (ms: any) =>
        CompiledContract.make('shadow-pass', ms.Contract).pipe(
          CompiledContract.withVacantWitnesses,
          CompiledContract.withCompiledFileAssets(zkConfigPath),
        ),
    );
  }
  return cachedCompiled;
}

function createProviders(walletCtx: WalletContext, index: number) {
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();
  const privateStatePassword = process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';
  const walletProvider = {
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };
  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: `shadow-pass-state-${index}`,
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

/**
 * Verify a single wallet once. Returns the tx outcome; never throws — callers
 * report failures so the operator can re-run `--index-start` for the ones that
 * failed.
 */
export async function verifyOneWallet(
  index: number,
  wallet: GeneratedWallet,
  opts: Pick<BatchVerifyOptions, 'eligible' | 'score'>,
): Promise<VerifyOutcome> {
  const base: VerifyOutcome = { index, address: wallet.address, ok: false };
  if (!deployment) {
    return { ...base, error: 'No deployment recorded. Run `npm run setup` first.' };
  }
  try {
    const walletCtx = await createWallet({ network, networkConfig, seed: wallet.seed, restore: false });
    await walletCtx.wallet.waitForSyncedState();

    const providers = createProviders(walletCtx, index);
    const deployed: any = await findDeployedContract(providers, {
      compiledContract: (await compiledContract()) as any,
      contractAddress: deployment.address,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: {},
    });

    const tx = await deployed.callTx.verifyEligibility(opts.eligible ?? true, opts.score ?? 100n);
    await walletCtx.wallet.stop();
    return {
      ...base,
      ok: true,
      txId: tx.public.txId,
      blockHeight: tx.public.blockHeight,
    };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) };
  }
}

async function run(): Promise<number> {
  const opts = parseBatchVerifyArgs(process.argv.slice(1));

  if (network === 'undeployed') {
    process.stderr.write('Active network is undeployed. Use --network preprod|preview.\n');
    return 1;
  }
  if (!deployment) {
    process.stderr.write(`No deployment recorded for ${network}. Run \`npm run setup\` first (see docs/DEPLOY_PREPROD.md).\n`);
    return 1;
  }
  if (!fs.existsSync(contractPath)) {
    process.stderr.write('Contract not compiled. Run `npm run compile`.\n');
    return 1;
  }

  const batchDir = opts.batchDir ?? path.join(BATCH_DIR_NAME, network);
  const wallets = loadBatch(batchDir);
  const start = opts.indexStart ?? 0;
  const end = Math.min(wallets.length, start + (opts.limit ?? wallets.length));
  const slice = wallets.slice(start, end);

  process.stdout.write(`\n  Verifying ${slice.length} wallet(s) against contract ${deployment.address}\n`);
  process.stdout.write(`  Network: ${network}  |  Concurrency: ${opts.concurrency ?? 1}  |  Eligible: ${opts.eligible ?? true}  Score: ${(opts.score ?? 100n).toString()}\n\n`);

  const outcomes: VerifyOutcome[] = [];
  const concurrency = Math.max(1, opts.concurrency ?? 1);
  let cursor = 0;
  const worker = async () => {
    while (cursor < slice.length) {
      const i = cursor++;
      const outcome = await verifyOneWallet(slice[i].index, slice[i], opts);
      outcomes.push(outcome);
      if (outcome.ok) {
        process.stdout.write(`  ✓ [${outcome.index}] ${outcome.address.slice(0, 46)}… -> tx ${outcome.txId} @ block ${outcome.blockHeight}\n`);
      } else {
        process.stdout.write(`  ✗ [${outcome.index}] ${outcome.address.slice(0, 46)}… ${outcome.error}\n`);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  const ok = outcomes.filter((o) => o.ok);
  const failed = outcomes.filter((o) => !o.ok);

  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ total: slice.length, ok: ok.length, failed: failed.length, outcomes }, null, 2)}\n`);
    return failed.length ? 1 : 0;
  }

  process.stdout.write(`\n  ✅ ${ok.length}/${slice.length} verification transaction(s) submitted.\n`);
  if (failed.length) {
    process.stdout.write(`  ⚠ ${failed.length} failed — re-run with --index-start for the first failing index.\n`);
  }
  process.stdout.write('\n  Next: harvest the on-chain truth into the registry:\n');
  process.stdout.write(`    npm run sync-users -- --network ${network} --contract <deployed-hex> --apply\n`);
  process.stdout.write('  Only the addresses the indexer actually saw become VERIFIED users.\n\n');
  return failed.length ? 1 : 0;
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

if (isEntrypoint()) {
  run()
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    });
}