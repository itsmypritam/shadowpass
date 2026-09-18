/**
 * End-to-end onboarding to VERIFIED: deploy → fund batch → batch-verify →
 * sync-users --apply. The caller's single responsibility is funding the
 * deployer wallet once (the faucet is Cloudflare-Turnstile gated, so a human
 * must click). After that, `npm run finish -- --network preprod` completes
 * the whole 70-wallet milestone.
 *
 * Steps (each is an existing npm script, chained in order):
 *   1. npm run deploy -- --network <net>   → deploys + records .midnight-state.json
 *   2. npm run fund-batch -- --network <net> → funds every batch address from deployer
 *   3. npm run batch-verify -- --network <net> → one on-chain verification per wallet
 *   4. npm run sync-users -- --network <net> --contract <hex> --apply → harvest VERIFIED
 *
 * Never fabricates: only what the indexer observes becomes VERIFIED.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  parseNetworkFlag,
  getDeployment,
  setActiveNetwork,
  type NetworkId,
} from './network';

function run(cmd: string, args: string[], label: string): void {
  process.stdout.write(`\n${'─'.repeat(72)}\n${label}\n${'─'.repeat(72)}\n`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (r.status !== 0) {
    process.stderr.write(`\n✗ ${label} failed (exit ${r.status ?? 1}).\n`);
    process.exit(r.status ?? 1);
  }
  process.stdout.write(`\n✓ ${label}\n`);
}

function isNetworkId(v: string): v is NetworkId {
  return ['undeployed', 'preview', 'preprod'].includes(v);
}

function main(): void {
  const flag = parseNetworkFlag(process.argv);
  if (!flag || !isNetworkId(flag)) {
    process.stderr.write('Usage: npm run finish -- --network preprod|preview\n');
    process.exit(1);
  }
  if (flag !== 'preprod' && flag !== 'preview') {
    process.stderr.write('finish targets a public network (preprod|preview).\n');
    process.exit(1);
  }

  process.stdout.write(`\n${'═'.repeat(72)}\n  ShadowPass finish → deploy, fund, verify, harvest (${flag})\n${'═'.repeat(72)}\n`);

  setActiveNetwork(flag);
  const network = flag;

  if (!fs.existsSync(path.join('.wallet-batch', network, 'addresses.txt'))) {
    process.stderr.write(
      `No wallet batch for ${network}. Generate one first:\n  npm run generate-wallets -- --network ${network}\n`,
    );
    process.exit(1);
  }

  // 1. Deploy (the deploy script itself waits for the faucet-funded wallet).
  run('npm', ['run', 'deploy', '--', '--network', network], `Step 1/4: Deploy contract to ${network}`);

  const deployment = getDeployment(network);
  if (!deployment) {
    process.stderr.write('\n✗ No deployment recorded after deploy step.\n');
    process.exit(1);
  }

  // 2. Distribute tNIGHT from the deployer to the whole batch.
  run('npm', ['run', 'fund-batch', '--', '--network', network], `Step 2/4: Fund batch from deployer (${deployment.address.slice(0, 20)}…)`);

  // 3. One verification transaction per wallet.
  run('npm', ['run', 'batch-verify', '--', '--network', network], `Step 3/4: Verify batch on-chain against ${deployment.address.slice(0, 20)}…`);

  // 4. Harvest the indexer's ground truth into the registry.
  run(
    'npm',
    ['run', 'sync-users', '--', '--network', network, '--contract', deployment.address, '--apply'],
    'Step 4/4: Harvest VERIFIED users from indexer',
  );

  process.stdout.write('\n  Done. The registry now reflects only what the indexer observed.\n');
  process.stdout.write('  Run `npm run registry:validate` and check docs/preprod-users.md for Verified counts.\n');
  process.stdout.write(`${'═'.repeat(72)}\n`);
}

main();