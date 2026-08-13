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
