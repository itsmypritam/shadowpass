/**
 * ShadowPass on-chain user sync.
 *
 * Discovers REAL Midnight wallet addresses from on-chain data: it scans the
 * public indexer for transactions whose contract actions target the deployed
 * ShadowPass contract, then harvests the unshielded owners as verified users.
 *
 * No fabricated data: every address in the report was read from the network.
 * The registry is only ever extended with addresses found on-chain.
 *
 * Usage:
 *
 *   npm run sync-users -- --network preprod --contract <hex> [--apply] [options]
 *
 * Options:
 *   --network preprod|preview   network + indexer to scan (default preprod)
 *   --contract <hex>            deployed ShadowPass contract address (required)
 *   --from-height <n>           scan window start (default: tip - 20_000)
 *   --concurrency <n>           parallel block fetches (default 32)
 *   --apply                     write harvested addresses into preprod-users.json
 *   --force                     allow --apply when registry network mismatches
 *   --json                      print the report as JSON
 *
 * Report rows are deduplicated wallet addresses. Run without --apply for a
 * dry-run; add --apply once the reported addresses match reality.
 */
import { loadRegistry, saveRegistry, recordVerification, summarize, isPlausibleAddress, type RegistryData } from '../src/registry';
import { pathToFileURL } from 'node:url';

const INDEXERS: Record<string, string> = {
  preprod: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  preview: 'https://indexer.preview.midnight.network/api/v4/graphql',
};

const DEFAULT_NETWORK = 'preprod';
const DEFAULT_WINDOW = 20_000;
const DEFAULT_CONCURRENCY = 16;
const RETRY_BACKOFF_MS = 750;

export interface ContractActionRow {
  address: string | null;
}

export interface UnshieldedUtxoRow {
  owner: string | null;
}

export interface TransactionRow {
  id: string | number;
  hash: string;
  contractActions: ContractActionRow[];
  unshieldedCreatedOutputs: UnshieldedUtxoRow[];
  unshieldedSpentOutputs: UnshieldedUtxoRow[];
}

export interface BlockRow {
  height: number;
  hash: string;
  timestamp: number;
  transactions: TransactionRow[];
}

export interface ContractMatch {
  txHash: string;
  height: number;
  timestamp: number | null;
  owners: string[];
}

export function normalizeHex(hex: string): string {
  return hex.trim().replace(/^0x/i, '').toLowerCase();
}

export function isContractTx(tx: TransactionRow, contractHex: string): boolean {
  const target = normalizeHex(contractHex);
  return tx.contractActions.some(
    (a) => a.address !== null && normalizeHex(a.address) === target,
  );
}

export function matchesForContract(block: BlockRow, contractHex: string): ContractMatch[] {
  const target = normalizeHex(contractHex);
  const matches: ContractMatch[] = [];
  for (const tx of block.transactions) {
    if (!isContractTx(tx, target)) continue;
    const owners = new Set<string>();
    for (const o of [...tx.unshieldedCreatedOutputs, ...tx.unshieldedSpentOutputs]) {
      if (o.owner && isPlausibleAddress(o.owner)) owners.add(o.owner);
    }
    matches.push({
      txHash: tx.hash,
      height: block.height,
      timestamp: block.timestamp ?? null,
      owners: [...owners],
    });
  }
  return matches;
}

export function uniqueOwners(matches: ContractMatch[]): string[] {
  return [...new Set(matches.flatMap((m) => m.owners).map((o) => o.trim()))].sort();
}

async function gql(url: string, query: string, attemptsLeft = 3): Promise<any> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < attemptsLeft; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * 2 ** attempt));
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const text = await res.text();
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 200)}`);
        continue;
      }
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        lastError = new Error(`Unexpected indexer response: ${text.slice(0, 200)}`);
        continue;
      }
      if (json.errors?.length) {
        lastError = new Error(json.errors.map((e: any) => e.message).join('; '));
        continue;
      }
      return json.data;
    } catch (e) {
      lastError = e as Error;
    }
  }
  throw lastError ?? new Error(`Request to ${url} failed after retries.`);
}

async function blockExists(url: string, height: number): Promise<boolean> {
  const d = await gql(url, `{ block(offset: { height: ${height} }) { height } }`);
  return d?.block != null;
}

async function latestBlockHeight(url: string): Promise<number> {
  let hi = 1;
  while (await blockExists(url, hi)) hi *= 2;
  let lo = Math.floor(hi / 2);
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (await blockExists(url, mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

async function fetchBlock(url: string, height: number): Promise<BlockRow | null> {
  const d = await gql(
    url,
    `{ block(offset: { height: ${height} }) {
        height hash timestamp
        transactions { id hash contractActions { address }
          unshieldedCreatedOutputs { owner } unshieldedSpentOutputs { owner } } } }`,
  );
  return d?.block ?? null;
}

async function scanRange(
  url: string,
  from: number,
  to: number,
  concurrency: number,
  contractHex: string,
): Promise<{ matches: ContractMatch[]; skipped: number }> {
  if (to < from) return { matches: [], skipped: 0 };
  const heights = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const matches: ContractMatch[] = [];
  let cursor = 0;
  let skipped = 0;
  const target = normalizeHex(contractHex);
  const worker = async () => {
    while (cursor < heights.length) {
      const height = heights[cursor++];
      const block = await fetchBlock(url, height).catch(() => null);
      if (!block) {
        skipped++;
        continue;
      }
      const found = matchesForContract(block, target);
      if (found.length) matches.push(...found);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { matches, skipped };
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    if (a === '--apply' || a === '--force' || a === '--json') {
      out[a.slice(2)] = 'true';
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) out[a.slice(2)] = next;
    else out[a.slice(2)] = 'true';
  }
  return out;
}

function reportSummary(network: string, contract: string, from: number, to: number, matches: ContractMatch[]): string {
  const owners = uniqueOwners(matches);
  const lines = [
    `Network:    ${network}`,
    `Contract:   0x${normalizeHex(contract)}`,
    `Scanned:    blocks ${from}..${to} (${to - from + 1})`,
    `Matched:    ${matches.length} transaction(s) against the contract`,
    `Wallets:    ${owners.length} unique real address(es)`,
    '',
  ];
  for (const o of owners) {
    const seen = matches
      .filter((m) => m.owners.includes(o))
      .map((m) => `h${m.height}#${m.txHash.slice(0, 8)}`)
      .join(', ');
    lines.push(`  ${o}  (${seen})`);
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args['help'] || !args['contract']) {
    console.log(
      'Usage: npm run sync-users -- --network preprod|preview --contract <hex> [--from-height N] [--concurrency N] [--apply] [--force] [--json]',
    );
    process.exit(args['contract'] ? 0 : 1);
  }
  const network = args['network'] ?? DEFAULT_NETWORK;
  const url = INDEXERS[network];
  if (!url) {
    console.error(`Unknown network "${network}". Expected one of: ${Object.keys(INDEXERS).join(', ')}.`);
    process.exit(1);
  }
  const contract = normalizeHex(args['contract']);
  if (!/^[0-9a-f]{64}$/.test(contract)) {
    console.error('`--contract` must be a 64-char hex address.');
    process.exit(1);
  }
  const concurrency = Math.min(64, Math.max(1, Number(args['concurrency']) || DEFAULT_CONCURRENCY));

  console.log(`Querying ${network} indexer for contract 0x${contract} ...`);
  const tip = await latestBlockHeight(url);
  const to = tip;
  const requested = Number(args['from-height']);
  const from = Number.isFinite(requested) && requested >= 1 ? Math.min(requested, to) : Math.max(1, to - DEFAULT_WINDOW);

  const { matches, skipped } = await scanRange(url, from, to, concurrency, contract);

  if (args['json']) {
    console.log(
      JSON.stringify(
        {
          network,
          contract,
          scanned: { from, to, skipped },
          transactions: matches.length,
          wallets: uniqueOwners(matches),
        },
        null,
        2,
      ),
    );
  } else {
    if (skipped > 0) console.log(`  (${skipped} block(s) could not be fetched -- retried, see indexer health)`);
    console.log(reportSummary(network, contract, from, to, matches));
  }

  if (!args['apply']) {
    console.log('\nDry run -- nothing written. Re-run with --apply to merge into the registry.');
    return;
  }

  const owners = uniqueOwners(matches);
  if (!owners.length) {
    console.log('No real addresses to merge -- registry left unchanged.');
    return;
  }

  const registry: RegistryData = loadRegistry();
  if (registry.network !== network && args['force'] !== 'true') {
    console.error(
      `Registry is for network "${registry.network}" but --apply targets "${network}". ` +
        'Refusing to mix networks. Pass --force only if you know the registry should change.',
    );
    process.exit(1);
  }
  for (const owner of owners) {
    const match = matches.find((m) => m.owners.includes(owner));
    const firstSeen = match?.timestamp
      ? new Date(match.timestamp * 1000).toISOString()
      : new Date().toISOString();
    recordVerification(registry, owner, firstSeen);
  }
  saveRegistry(registry);
  const summary = summarize(registry);
  console.log(
    `Merged ${owners.length} real address(es). Registry now ${summary.userCount} users (${summary.verifiedCount} verified).`,
  );
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main().catch((e: Error) => {
    console.error(`sync-users failed: ${e.message}`);
    process.exit(1);
  });
}