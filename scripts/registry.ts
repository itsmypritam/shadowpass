/**
 * ShadowPass user-registry CLI.
 *
 * Manages preprod-users.json — the tracked Preprod users + feedback loop —
 * without touching the network or the contract. Fast enough for CI.
 *
 * Usage (see `npm run registry -- <cmd> --help`):
 *
 *   status                       summary + health of the registry
 *   list                         tabular users (add --raw for JSON)
 *   add <address>                register a wallet address
 *   remove <address>             unregister a wallet address
 *   verify <address>             attribute one on-chain verification
 *   feedback add                 add a structured feedback entry
 *   feedback list [--raw]        all feedback entries
 *   analytics                    summary + rating distribution
 *   validate                     exit 1 when the registry is unhealthy
 *   export [--out FILE] [--csv]  markdown (or CSV) users table
 */
import * as fs from 'node:fs';
import { loadRegistry, saveRegistry, addUser, removeUser, recordVerification, addFeedback, summarize, validateRegistry, isPlausibleAddress, usersToMarkdown, type RegistryData } from '../src/registry';

const HELP: Record<string, string> = {
  status: 'status',
  list: 'list [--raw]',
  add: 'add <address>',
  remove: 'remove <address>',
  verify: 'verify <address>',
  'feedback add': '',
  'feedback list': 'feedback list [--raw]',
  analytics: 'analytics',
  validate: 'validate',
  export: 'export [--out FILE] [--csv]',
};

function banner(): void {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              ShadowPass User Registry CLI                ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
}

function explorerLink(address: string): string {
  return `https://preview.midnightexplorer.com/search?query=${address}`;
}

function cmdStatus(data: RegistryData): void {
  const s = summarize(data);
  const errors = validateRegistry(data);
  console.log(`  Network:            ${data.network}`);
  console.log(`  Description:        ${data.description}`);
  console.log('');
  console.log(`  Registered users:   ${s.userCount}`);
  console.log(`  Verified on-chain:  ${s.verifiedCount}`);
  console.log(`  Verifications:      ${s.totalVerifications}`);
  console.log(`  Feedback entries:   ${s.feedbackCount}`);
  if (s.avgRating !== null) {
    console.log(`  Average rating:     ${s.avgRating} / 5`);
    const dist = Object.entries(s.ratingDistribution)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([r, n]) => `${r}(x${n})`)
      .join('  ');
    console.log(`  Rating distribution: ${dist}`);
  }
  console.log('');
  if (errors.length) {
    console.log(`  ⚠  ${errors.length} validation issue(s):`);
    errors.forEach((e) => console.log(`      - ${e}`));
  } else {
    console.log('  ✅ Registry is healthy.');
  }
  console.log('');
  if (s.userCount < 50) {
    console.log(`  🎯 Target: 70 Preprod users — ${Math.max(0, 70 - s.userCount)} to go.`);
  }
}

function cmdList(data: RegistryData, raw: boolean): void {
  if (raw) {
    process.stdout.write(`${JSON.stringify(data.users, null, 2)}\n`);
    return;
  }
  if (data.users.length === 0) {
    console.log('  No users registered yet.');
    return;
  }
  for (const u of data.users) {
    const mark = u.verified ? '✓' : '·';
    console.log(`  ${mark} ${u.address}  verifications=${u.verifications}  firstSeen=${u.firstSeenAt ?? '—'}`);
  }
}

function cmdAdd(data: RegistryData, address: string): void {
  if (!isPlausibleAddress(address)) {
    console.error(`  ✗ "${address}" is not a plausible Midnight address.`);
    process.exit(1);
  }
  const added = addUser(data, address);
  saveRegistry(data);
  console.log(added
    ? `  + Registered ${address}`
    : `  = ${address} was already registered.`);
  console.log(`    Explorer: ${explorerLink(address)}`);
}

function cmdRemove(data: RegistryData, address: string): void {
  const removed = removeUser(data, address);
  saveRegistry(data);
  console.log(removed
    ? `  - Unregistered ${address}`
    : `  = ${address} was not in the registry.`);
}

function cmdVerify(data: RegistryData, address: string): void {
  if (!isPlausibleAddress(address)) {
    console.error(`  ✗ "${address}" is not a plausible Midnight address.`);
    process.exit(1);
  }
  recordVerification(data, address);
  saveRegistry(data);
  console.log(`  ✓ Recorded 1 verification for ${address}`);
  console.log(`    Explorer: ${explorerLink(address)}`);
  console.log(`    Verified users: ${summarize(data).verifiedCount}`);
}

function cmdFeedbackAdd(data: RegistryData, opts: Record<string, string>): void {
  const rating = Number(opts.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    console.error('  ✗ --rating must be an integer 1-5.');
    process.exit(1);
  }
  const walletAddress = (opts.wallet ?? 'anonymous').trim();
  const useCase = (opts.useCase ?? '').trim();
  const comment = (opts.comment ?? '').trim();
  addFeedback(data, {
    walletAddress,
    rating,
    useCase,
    comment,
    submittedAt: new Date().toISOString(),
  });
  saveRegistry(data);
  const s = summarize(data);
  console.log(`  ✓ Added feedback (rating ${rating}). Total entries: ${s.feedbackCount}; users: ${s.userCount}`);
}

function cmdFeedbackList(data: RegistryData, raw: boolean): void {
  if (raw) {
    process.stdout.write(`${JSON.stringify(data.feedback, null, 2)}\n`);
    return;
  }
  if (data.feedback.length === 0) {
    console.log('  No feedback recorded yet.');
    return;
  }
  data.feedback.forEach((f, i) => {
    console.log(`  [${i + 1}] rating=${f.rating} wallet=${f.walletAddress} useCase="${f.useCase}"`);
    if (f.comment) console.log(`        "${f.comment}"`);
  });
}

function cmdValidate(data: RegistryData): void {
  const errors = validateRegistry(data);
  if (errors.length) {
    console.error(`  ✗ ${errors.length} issue(s) in the registry:`);
    errors.forEach((e) => console.error(`    - ${e}`));
    process.exit(1);
  }
  const s = summarize(data);
  console.log(`  ✅ Registry is healthy (${s.userCount} users, ${s.feedbackCount} feedback entries).`);
}

function cmdExport(data: RegistryData, out: string | undefined, csv: boolean): void {
  let text: string;
  if (csv) {
    const rows = data.users.map((u) => [u.address, u.verified ? 'yes' : 'no', u.verifications].join(','));
    text = `walletAddress,verified,verifications\n${rows.join('\n')}\n`;
  } else {
    text = usersToMarkdown(data);
  }
  if (out) {
    fs.writeFileSync(out, text);
    console.log(`  Wrote ${out}`);
  } else {
    process.stdout.write(`${text}\n`);
  }
}

function printHelp(): void {
  banner();
  console.log('  Commands:');
  Object.values(HELP).forEach((line) => console.log(`    ${line}`));
  console.log('');
}

function main(): void {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    printHelp();
    process.exit(argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h' ? 0 : 1);
  }

  // Feedback subcommands read the registry too.
  let data: RegistryData;
  try {
    data = loadRegistry();
  } catch (e) {
    console.error(`  ✗ ${(e as Error).message}`);
    process.exit(1);
    return;
  }

  const [cmd, sub] = argv;
  const flags = argv.slice(1);
  const has = (flag: string) => flags.includes(flag);
  const val = (flag: string): string | undefined => {
    const i = flags.indexOf(flag);
    return i >= 0 && flags[i + 1] !== undefined ? flags[i + 1] : undefined;
  };
  const positional = (): string | undefined => flags.find((f) => !f.startsWith('-'));

  if (cmd === 'status') { banner(); cmdStatus(data); return; }
  if (cmd === 'list') { banner(); cmdList(data, has('--raw')); return; }
  if (cmd === 'add') {
    const addr = positional();
    if (!addr) { console.error('  usage: registry add <address>'); process.exit(1); }
    banner(); cmdAdd(data, addr); return;
  }
  if (cmd === 'remove') {
    const addr = positional();
    if (!addr) { console.error('  usage: registry remove <address>'); process.exit(1); }
    banner(); cmdRemove(data, addr); return;
  }
  if (cmd === 'verify') {
    const addr = positional();
    if (!addr) { console.error('  usage: registry verify <address>'); process.exit(1); }
    banner(); cmdVerify(data, addr); return;
  }
  if (cmd === 'feedback') {
    banner();
    if (sub === 'add') {
      cmdFeedbackAdd(data, {
        rating: val('--rating') ?? '',
        wallet: val('--wallet') ?? '',
        useCase: val('--use-case') ?? '',
        comment: val('--comment') ?? '',
      });
    } else if (sub === 'list') {
      cmdFeedbackList(data, has('--raw'));
    } else {
      console.error('  ✗ feedback subcommands: add, list');
      process.exit(1);
    }
    return;
  }
  if (cmd === 'analytics') { banner(); cmdStatus(data); return; }
  if (cmd === 'validate') { banner(); cmdValidate(data); return; }
  if (cmd === 'export') {
    banner(); cmdExport(data, val('--out'), has('--csv')); return;
  }

  console.error(`  ✗ Unknown command: ${cmd}`);
  printHelp();
  process.exit(1);
}

main();