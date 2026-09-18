export interface ContractInfo {
  network: string;
  address: string;
  requirement: string;
  verificationCount: string;
  lastResult: boolean;
}

export interface VerifyRequest {
  claimedEligible: boolean;
  eligibilityScore: string;
}

export interface VerifyResponse {
  txId: string;
  blockHeight: string;
  lastResult: boolean;
}

// When the API is exposed through a free ngrok tunnel, the interstitial
// warning page intercepts requests unless this header is present. It is
// harmless for any other backend.
const API_HEADERS: Record<string, string> = { 'ngrok-skip-browser-warning': 'true' };

export async function getContractInfo(): Promise<ContractInfo> {
  const res = await fetch('/api/contract', { headers: API_HEADERS });
  if (!res.ok) throw new Error(`Failed to load contract state: ${await res.text()}`);
  return res.json();
}

export async function submitVerification(
  request: VerifyRequest,
): Promise<VerifyResponse> {
  const res = await fetch('/api/verify', {
    method: 'POST',
    headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error ?? `Verification failed with status ${res.status}`);
  }
  return body;
}

export interface FeedbackRequest {
  walletAddress?: string;
  rating: number;
  comment?: string;
  useCase?: string;
}

export interface RegistrySummary {
  userCount: number;
  verifiedCount: number;
  totalVerifications: number;
  feedbackCount: number;
  avgRating: number | null;
  ratingDistribution: Record<number, number>;
}

export interface RegistryUser {
  address: string;
  firstSeenAt: string | null;
  verifications: number;
  verified: boolean;
}

export interface RegistryResponse extends RegistrySummary {
  ok?: boolean;
  added?: boolean;
}

export interface UsersResponse {
  network: string;
  registry: RegistryUser[];
  summary: RegistrySummary;
  explorerBase: string;
  explorerUrl: string;
  markdown: string;
}

export async function submitFeedback(
  request: FeedbackRequest,
): Promise<RegistryResponse> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error ?? `Feedback failed with status ${res.status}`);
  }
  return body;
}

export async function trackUser(
  walletAddress: string,
): Promise<RegistryResponse> {
  const res = await fetch('/api/track-user', {
    method: 'POST',
    headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error ?? `Track failed with status ${res.status}`);
  }
  return body;
}

/** Attribute one on-chain verification to the user's wallet. */
export async function trackVerification(
  walletAddress: string,
): Promise<RegistryResponse> {
  const res = await fetch('/api/track-verification', {
    method: 'POST',
    headers: { ...API_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error ?? `Track verification failed with status ${res.status}`);
  }
  return body;
}

export async function getUsers(): Promise<UsersResponse> {
  const res = await fetch('/api/users', { headers: API_HEADERS });
  if (!res.ok) throw new Error(`Failed to load user registry: ${await res.text()}`);
  return res.json();
}
