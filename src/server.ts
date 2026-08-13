/**
 * ShadowPass API server.
 *
 * A small HTTP backend that owns the Midnight wallet and talks to the deployed
 * ShadowPass contract on the active network. The browser UI (React/Vite in
 * this same `src/` folder) never sees the wallet — all on-chain work happens
 * here, which keeps the private score inside the zero-knowledge proof.
 *
 * Endpoints:
 *   GET  /api/health    -> { ok: true }
 *   GET  /api/contract  -> public ledger state of the deployed contract
 *   POST /api/verify    -> { claimedEligible, eligibilityScore } -> tx info
 *
 * Run with: npm run server   (proxied by Vite at /api during `npm run dev:ui`)
 */
import { createServer } from 'node:http';
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

import {
  resolveNetwork,
  getOrCreateWallet,
  getDeployment,
} from '../scripts/network';
import {
  createWallet,
  persistWalletState,
  unshieldedToken,
  type WalletContext,
} from '../scripts/wallet';

// @ts-expect-error wallet sync requires WebSocket
globalThis.WebSocket = WebSocket;

const PORT = Number(process.env.PORT ?? 3000);
const PRIVATE_STATE_ID = 'shadowPassPrivateState';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'managed', 'shadow-pass');
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

// Built frontend (vite build src -> src/dist). Served by this same server so
// the whole dApp (UI + API) is available on a single origin — this is what we
// expose publicly via ngrok for the live demo.
const distDir = path.resolve(__dirname, 'dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.prover': 'application/octet-stream',
  '.verifier': 'application/octet-stream',
  '.bzkir': 'application/octet-stream',
  '.zkir': 'application/octet-stream',
};

if (!fs.existsSync(contractPath)) {
  console.error('❌ Contract not compiled. Run: npm run compile');
  process.exit(1);
}

const { network, config: networkConfig } = resolveNetwork();
const deployment = getDeployment(network);
if (!deployment) {
  console.error(`❌ No deployment recorded for network "${network}". Run: npm run setup`);
  process.exit(1);
}

const ShadowPass = await import(pathToFileURL(contractPath).href);
const compiledContract = CompiledContract.make('shadow-pass', ShadowPass.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);

// Narrow the deployment record once at module scope; closures below use the
// already-narrowed value so TS keeps it non-null inside them.
const contractAddress: string = deployment.address;

/**
 * Serve the built frontend from src/dist. Unknown paths fall back to
 * index.html (SPA routing). Returns true when the request was handled.
 */
function serveStatic(res: any, pathname: string): boolean {
  if (!fs.existsSync(distDir)) return false;

  const safePath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.normalize(path.join(distDir, safePath));
  if (!filePath.startsWith(distDir)) return false; // path traversal guard

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html'); // SPA fallback
  }
  if (!fs.existsSync(filePath)) return false;

  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] ?? 'application/octet-stream';
  const body = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': body.length,
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
  return true;
}

function createProviders(walletCtx: WalletContext) {
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

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'shadow-pass-state',
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

async function main() {
  console.log(`\n  ShadowPass API server on network: ${network}`);
  console.log(`  Contract: ${contractAddress}`);
  console.log('  Connecting wallet...');

  const seed = getOrCreateWallet(network).seed;
  const walletCtx = await createWallet({ network, networkConfig, seed });
  await walletCtx.wallet.waitForSyncedState();
  await persistWalletState(network, walletCtx);

  const providers = createProviders(walletCtx);
  const deployed: any = await findDeployedContract(providers, {
    compiledContract: compiledContract as any,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: {},
  });

  console.log(`  Wallet connected: ${walletCtx.unshieldedKeystore.getBech32Address()}`);
  console.log('  Ready.\n');

  const readContractState = async () => {
    const state = await providers.publicDataProvider.queryContractState(contractAddress);
    if (!state) throw new Error('Contract state not found on chain');
    const ledger = ShadowPass.ledger(state.data);
    return {
      network,
      address: contractAddress,
      requirement: ledger.requirement.toString(),
      verificationCount: ledger.verificationCount.toString(),
      lastResult: ledger.lastResult,
    };
  };

  const send = (res: any, code: number, body: unknown) => {
    const data = JSON.stringify(body);
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(data);
  };

  const readBody = (req: any): Promise<any> =>
    new Promise((resolve, reject) => {
      let raw = '';
      req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
      req.on('end', () => {
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });

  const server = createServer(async (req: any, res: any) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const route = url.pathname;

    if (req.method === 'OPTIONS') {
      return send(res, 204, {});
    }

    if (req.method === 'GET' && route === '/api/health') {
      return send(res, 200, { ok: true, network });
    }

    if (req.method === 'GET' && route === '/api/contract') {
      try {
        return send(res, 200, await readContractState());
      } catch (e: any) {
        return send(res, 500, { error: e.message ?? String(e) });
      }
    }

    if (req.method === 'POST' && route === '/api/verify') {
      try {
        const body = await readBody(req);
        if (typeof body.claimedEligible !== 'boolean') {
          return send(res, 400, { error: 'claimedEligible must be a boolean' });
        }
        let score: bigint;
        try {
          score = BigInt(String(body.eligibilityScore ?? ''));
        } catch {
          return send(res, 400, { error: 'eligibilityScore must be an integer' });
        }
        if (score < 0n) return send(res, 400, { error: 'eligibilityScore must be >= 0' });

        console.log(`  verify: claimed=${body.claimedEligible} score=${score.toString()}`);
        const tx = await deployed.callTx.verifyEligibility(body.claimedEligible, score);
        console.log(`    -> tx ${tx.public.txId} @ block ${tx.public.blockHeight}`);
        return send(res, 200, {
          txId: tx.public.txId,
          blockHeight: tx.public.blockHeight,
          lastResult: body.claimedEligible,
        });
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        return send(res, 500, { error: msg });
      }
    }

    // Serve the built frontend for any non-API GET request.
    if (req.method === 'GET' && serveStatic(res, route)) {
      return;
    }

    return send(res, 404, { error: `Not found: ${route}` });
  });

  server.listen(PORT, () => {
    console.log(`  Listening on http://127.0.0.1:${PORT}`);
  });

  const shutdown = async () => {
    console.log('\n  Shutting down...');
    await walletCtx.wallet.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
