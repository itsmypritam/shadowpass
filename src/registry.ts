/**
 * ShadowPass user registry (preprod-users.json).
 *
 * Single source of truth for tracked Preprod users and their structured
 * feedback. Shared between:
 *
 *   - the API server  (src/server.ts)   reads + appends via HTTP endpoints
 *   - the CLI         (scripts/registry.ts) adds / lists / validates / exports
 *   - CI              validates the committed file on every push
 *
 * The registry is intentionally just committed JSON: a product lifecycle
 * artifact anyone can diff, review and re-verify. `network` records which
 * Midnight network the addresses were collected on, and every user object
 * can be traced back to an on-chain transaction (see `verified`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const REGISTRY_FILE_NAME = 'preprod-users.json';
export const REGISTRY_NETWORK = 'preprod';

export const DEFAULT_REGISTRY_DESCRIPTION =
  'Tracked Preprod user wallet addresses for the ShadowPass Level 5 submission';

export interface TrackedUser {
  /** User's unshielded Midnight address (bech32, e.g. mn1...). */
  address: string;
  /** When the wallet was first seen by the product (ISO string) or null. */
  firstSeenAt: string | null;
  /** Number of verifications attributable to this wallet. */
  verifications: number;
  /** True once at least one verification is recorded for this wallet. */
  verified: boolean;
}

export interface FeedbackEntry {
  walletAddress: string;
  /** Rating 1-5. */
  rating: number;
  /** How the user applied ShadowPass (age gate, credential check, ...). */
  useCase: string;
  comment: string;
  submittedAt: string;
}

export interface RegistryData {
  network: string;
  description: string;
  users: TrackedUser[];
  feedback: FeedbackEntry[];
}

export interface RegistrySummary {
  userCount: number;
  verifiedCount: number;
  totalVerifications: number;
  feedbackCount: number;
  avgRating: number | null;
  ratingDistribution: Record<number, number>;
}

/**
 * Structural sanity check for a Midnight address. Not a checksum.
 * Accepts both the wallet SDK's bech32m form (`mn_addr_preprod1…`)
 * and the compact-form bech32 (`mn1…`); underscores are legal in the
 * SDK's `mn_addr_<network>…` encoding.
 */
export function isPlausibleAddress(address: string): boolean {
  const a = address.trim();
  return (
    a.length >= 30 &&
    a.length <= 180 &&
    /^[a-zA-Z0-9_]+$/.test(a) &&
    /^m/.test(a)
  );
}

export function emptyRegistry(network = REGISTRY_NETWORK): RegistryData {
  return {
    network,
    description: DEFAULT_REGISTRY_DESCRIPTION,
    users: [],
    feedback: [],
  };
}

function normalizeUser(raw: unknown): TrackedUser {
  if (typeof raw === 'string') {
    // Legacy shape: the registry used to store plain address strings.
    return { address: raw.trim(), firstSeenAt: null, verifications: 0, verified: false };
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error('Registry user entries must be objects or address strings.');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.address !== 'string' || !r.address.trim()) {
    throw new Error('Registry users must have a non-empty `address`.');
  }
  return {
    address: r.address.trim(),
    firstSeenAt: typeof r.firstSeenAt === 'string' ? r.firstSeenAt : null,
    verifications: typeof r.verifications === 'number' ? r.verifications : 0,
    verified: typeof r.verified === 'boolean' ? r.verified : false,
  };
}

function normalizeFeedback(raw: unknown): FeedbackEntry {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Registry feedback entries must be objects.');
  }
  const r = raw as Record<string, unknown>;
  return {
    walletAddress: typeof r.walletAddress === 'string' ? r.walletAddress : 'anonymous',
    rating: typeof r.rating === 'number' ? r.rating : 0,
    useCase: typeof r.useCase === 'string' ? r.useCase : '',
    comment: typeof r.comment === 'string' ? r.comment : '',
    submittedAt: typeof r.submittedAt === 'string' ? r.submittedAt : '',
  };
}

/**
 * Parse + normalize any raw registry JSON. Throws descriptive errors on
 * malformed content so operators notice before CI does.
 */
export function normalizeRegistry(raw: unknown, fallbackNetwork = REGISTRY_NETWORK): RegistryData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('preprod-users.json must contain a JSON object.');
  }
  const r = raw as Record<string, unknown>;
  const usersRaw = Array.isArray(r.users) ? r.users : [];
  const feedbackRaw = Array.isArray(r.feedback) ? r.feedback : [];
  return {
    network: typeof r.network === 'string' ? r.network : fallbackNetwork,
    description: typeof r.description === 'string' ? r.description : DEFAULT_REGISTRY_DESCRIPTION,
    users: usersRaw.map(normalizeUser),
    feedback: feedbackRaw.map(normalizeFeedback),
  };
}

export function registryFilePath(cwd = process.cwd()): string {
  return path.join(cwd, REGISTRY_FILE_NAME);
}

export function registryExists(cwd = process.cwd()): boolean {
  return fs.existsSync(registryFilePath(cwd));
}

/** Load + normalize the registry. Missing file -> empty registry. */
export function loadRegistry(cwd = process.cwd()): RegistryData {
  const file = registryFilePath(cwd);
  if (!fs.existsSync(file)) return emptyRegistry();
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    throw new Error(`Failed to parse ${file}: ${(e as Error).message}`);
  }
  return normalizeRegistry(parsed);
}

export function saveRegistry(data: RegistryData, cwd = process.cwd()): void {
  const file = registryFilePath(cwd);
  // Keep the committed file stable and diffable.
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

export function findUser(data: RegistryData, address: string): TrackedUser | undefined {
  const a = address.trim();
  return data.users.find((u) => u.address === a);
}

/** Register a wallet address (dedupe). Returns true when newly added. */
export function addUser(data: RegistryData, address: string, firstSeenAt = new Date().toISOString()): boolean {
  const a = address.trim();
  if (findUser(data, a)) return false;
  data.users.push({ address: a, firstSeenAt, verifications: 0, verified: false });
  return true;
}

/**
 * Attribute one verification to a wallet: registers it if unknown and bumps
 * the counter. The transaction itself is what makes the address verifiable
 * on-chain.
 */
export function recordVerification(data: RegistryData, address: string, firstSeenAt = new Date().toISOString(), by = 1): void {
  const existing = findUser(data, address);
  if (existing) {
    existing.verifications += by;
    existing.verified = true;
    return;
  }
  data.users.push({
    address: address.trim(),
    firstSeenAt,
    verifications: Math.max(1, by),
    verified: true,
  });
}

/** Remove a wallet from the registry (feedback is kept for anonymized data). */
export function removeUser(data: RegistryData, address: string): boolean {
  const before = data.users.length;
  data.users = data.users.filter((u) => u.address !== address.trim());
  return data.users.length < before;
}

export function addFeedback(data: RegistryData, entry: FeedbackEntry): void {
  data.feedback.push(entry);
  if (entry.walletAddress && entry.walletAddress !== 'anonymous') {
    addUser(data, entry.walletAddress);
  }
}

/** Validation errors; an empty array means the registry is healthy. */
export function validateRegistry(data: RegistryData): string[] {
  const errors: string[] = [];
  if (!data.network) errors.push('`network` must not be empty.');
  if (typeof data.description !== 'string') errors.push('`description` must be a string.');

  const seen = new Set<string>();
  data.users.forEach((user, i) => {
    if (!user.address) {
      errors.push(`users[${i}]: address must not be empty.`);
      return;
    }
    if (!isPlausibleAddress(user.address)) {
      errors.push(`users[${i}]: "${user.address}" is not a plausible Midnight address.`);
    }
    if (seen.has(user.address)) {
      errors.push(`users[${i}]: duplicate address "${user.address}".`);
    }
    seen.add(user.address);
    if (user.verifications < 0) {
      errors.push(`users[${i}]: verifications must be >= 0.`);
    }
    if (user.verified && user.verifications < 1) {
      errors.push(`users[${i}]: marked verified with 0 verifications.`);
    }
  });

  data.feedback.forEach((entry, i) => {
    if (!Number.isInteger(entry.rating) || entry.rating < 1 || entry.rating > 5) {
      errors.push(`feedback[${i}]: rating must be an integer 1-5 (got ${entry.rating}).`);
    }
    if (!entry.submittedAt) {
      errors.push(`feedback[${i}]: submittedAt must not be empty.`);
    }
  });
  return errors;
}

export function summarize(data: RegistryData): RegistrySummary {
  const ratings = data.feedback.map((f) => f.rating).filter((r) => r >= 1 && r <= 5);
  const distribution: Record<number, number> = {};
  for (const r of ratings) distribution[r] = (distribution[r] ?? 0) + 1;
  const avgRating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : null;
  return {
    userCount: data.users.length,
    verifiedCount: data.users.filter((u) => u.verified).length,
    totalVerifications: data.users.reduce((acc, u) => acc + u.verifications, 0),
    feedbackCount: data.feedback.length,
    avgRating: avgRating === null ? null : Math.round(avgRating * 100) / 100,
    ratingDistribution: distribution,
  };
}

/** Build a markdown table of tracked users (used by the CLI export + docs). */
export function usersToMarkdown(data: RegistryData, explorerBase = 'https://preview.midnightexplorer.com'): string {
  const rows = data.users
    .map((u) => `| \`${u.address}\` | ${u.verified ? 'Yes' : 'No'} | ${u.verifications} |`)
    .join('\n');
  const header = `| Wallet address | Verified on-chain | Verifications |\n| --- | --- | --- |`;
  return rows ? `${header}\n${rows}` : 'No users registered yet.';
}