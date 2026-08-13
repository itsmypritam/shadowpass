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

export async function getContractInfo(): Promise<ContractInfo> {
  const res = await fetch('/api/contract');
  if (!res.ok) throw new Error(`Failed to load contract state: ${await res.text()}`);
  return res.json();
}

export async function submitVerification(
  request: VerifyRequest,
): Promise<VerifyResponse> {
  const res = await fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body?.error ?? `Verification failed with status ${res.status}`);
  }
  return body;
}
