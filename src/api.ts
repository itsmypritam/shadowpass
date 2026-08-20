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

export interface FeedbackResponse {
  ok: boolean;
  userCount: number;
  feedbackCount: number;
}

export async function submitFeedback(request: FeedbackRequest): Promise<FeedbackResponse> {
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

export async function trackUser(walletAddress: string): Promise<{ ok: boolean; userCount: number }> {
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
