import { useEffect, useState } from 'react';
import { getContractInfo, submitVerification, submitFeedback, type ContractInfo } from './api';
import {
  connectMidnightWallet,
  getWalletBalances,
  isWalletInstalled,
  type MidnightWalletHandle,
  type WalletBalances,
} from './lace';
import {
  clearBrowserSession,
  readBrowserContractState,
  readPublicContractState,
  verifyViaWallet,
} from './browser-contract';
import {
  isStaticMode,
  staticConfigError,
  staticContractAddress,
  staticIndexerUri,
  staticIndexerWsUri,
  staticNetworkId,
} from './config';

type ClaimChoice = 'eligible' | 'not-eligible';
type VerifySource = 'server' | 'wallet';

const SHORT_ADDRESS = (a: string) =>
  a.length > 20 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a;

const SHORT_URL = (u?: string) => (u && u.length > 40 ? `${u.slice(0, 34)}…` : u ?? '—');

const hasDust = (dust: string | undefined) => !!dust && dust !== '0';

function loadContract(): Promise<ContractInfo> {
  if (isStaticMode) {
    if (!staticContractAddress || !staticIndexerUri || !staticIndexerWsUri || !staticNetworkId) {
      return Promise.reject(new Error(staticConfigError()));
    }
    return readPublicContractState(
      staticIndexerUri,
      staticIndexerWsUri,
      staticContractAddress,
      staticNetworkId,
    );
  }
  return getContractInfo();
}

export default function App() {
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claim, setClaim] = useState<ClaimChoice>('eligible');
  const [score, setScore] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<{ txId: string; blockHeight: string } | null>(null);

  const [verifySource, setVerifySource] = useState<VerifySource>(isStaticMode ? 'wallet' : 'server');
  const [wallet, setWallet] = useState<MidnightWalletHandle | null>(null);
  const [walletBalances, setWalletBalances] = useState<WalletBalances | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [browserState, setBrowserState] = useState<ContractInfo | null>(null);
  const [browserStateError, setBrowserStateError] = useState<string | null>(null);

  useEffect(() => {
    loadContract()
      .then(setContract)
      .catch((e: Error) => setLoadError(e.message));
  }, []);

  const refresh = () =>
    loadContract().then(setContract).catch((e: Error) => setLoadError(e.message));

  const walletInstalled = isWalletInstalled();
  const contractNetwork = contract?.network ?? staticNetworkId ?? 'undeployed';

  const onConnectWallet = async () => {
    setWalletBusy(true);
    setWalletError(null);
    try {
      const handle = await connectMidnightWallet(contractNetwork);
      setWallet(handle);
      const balances = await getWalletBalances(handle);
      setWalletBalances(balances);
      if (contract) {
        readBrowserContractState(handle, contract.address)
          .then(setBrowserState)
          .catch((e: Error) => setBrowserStateError(e.message));
      }
    } catch (e: unknown) {
      setWalletError(e instanceof Error ? e.message : String(e));
      setWallet(null);
    } finally {
      setWalletBusy(false);
    }
  };

  const onDisconnectWallet = () => {
    clearBrowserSession();
    setWallet(null);
    setWalletBalances(null);
    setBrowserState(null);
    setBrowserStateError(null);
  };

  const onVerify = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setLastTx(null);
    try {
      const parsed = BigInt(score.trim());
      if (verifySource === 'wallet') {
        if (!wallet || !contract) {
          throw new Error('Connect your Midnight wallet first, or switch to the server path.');
        }
        const tx = await verifyViaWallet(
          wallet,
          contract.address,
          claim === 'eligible',
          parsed,
        );
        setResult(
          tx.lastResult
            ? 'Eligible — proven in your browser and recorded on the ledger.'
            : 'Not eligible — proven in your browser and recorded on the ledger.',
        );
        setLastTx({ txId: tx.txId, blockHeight: String(tx.blockHeight) });
      } else {
        if (isStaticMode) {
          throw new Error('This hosted demo has no backend — use the Lace browser wallet path.');
        }
        const response = await submitVerification({
          claimedEligible: claim === 'eligible',
          eligibilityScore: parsed.toString(),
        });
        setResult(
          response.lastResult
            ? 'Eligible — result recorded on the ledger.'
            : 'Not eligible — result recorded on the ledger.',
        );
        setLastTx({ txId: response.txId, blockHeight: response.blockHeight });
      }
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const count = contract ? contract.verificationCount : '0';
  const requirement = contract?.requirement ?? '60';

  return (
    <div className="app">
      <PromoBanner address={contract?.address} />
      <TopNav />

      <Hero
        count={count}
        requirement={requirement}
        lastResult={contract?.lastResult}
        loadError={loadError}
      />

      <StatsSection count={count} requirement={requirement} />

      <FeaturesSection />

      <HowItWorksSection />

      <section className="section" id="try-it">
        <div className="container">
          <p className="section-eyebrow">
            <span className="badge badge-tag-teal">TRY IT LIVE</span>
          </p>
          <h2>Verify eligibility. In one click.</h2>
          <p className="section-sub">
            The form below is connected to the deployed ShadowPass contract. Your
            score is proven in zero knowledge — only the boolean result is published.
          </p>

          <div className="verify-wrap">
            <div className="verify-panel">
              <div>
                <span className="badge badge-success">LIVE CONTRACT</span>
                <h3>Zero-knowledge verify</h3>
                <p className="hint">
                  Pick the result you want recorded, then enter your{' '}
                  <strong>private</strong> score. The proof attests the comparison —
                  the score itself never leaves your side.
                </p>
              </div>

              <dl className="kv">
                <div>
                  <dt>Network</dt>
                  <dd>{contract?.network ?? '…'}</dd>
                </div>
                <div>
                  <dt>Eligibility rule</dt>
                  <dd>score ≥ {requirement}</dd>
                </div>
                <div>
                  <dt>Verifications</dt>
                  <dd>{count}</dd>
                </div>
                <div>
                  <dt>Last result</dt>
                  <dd>
                    {contract ? (
                      contract.lastResult ? (
                        <span className="badge badge-success">ELIGIBLE</span>
                      ) : (
                        <span className="badge badge-red">NOT ELIGIBLE</span>
                      )
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Contract</dt>
                  <dd className="mono">{SHORT_ADDRESS(contract?.address ?? '…')}</dd>
                </div>
              </dl>

              {loadError && (
                <div className="verify-result err">
                  {isStaticMode ? (
                    `Could not read the deployed contract from the indexer: ${loadError}`
                  ) : (
                    <>
                      Could not reach the backend: {loadError}. Start it with{' '}
                      <code>npm run server</code> after deploying.
                    </>
                  )}
                </div>
              )}

              <WalletPanel
                wallet={wallet}
                balances={walletBalances}
                installed={walletInstalled}
                busy={walletBusy}
                error={walletError}
                contractNetwork={contractNetwork}
                browserState={browserState}
                browserStateError={browserStateError}
                onConnect={() => void onConnectWallet()}
                onDisconnect={onDisconnectWallet}
              />

              <div className="claim-toggle" role="tablist" aria-label="Claimed result">
                <button
                  className={`pill-tab ${claim === 'eligible' ? 'active' : ''}`}
                  onClick={() => setClaim('eligible')}
                  role="tab"
                  aria-selected={claim === 'eligible'}
                >
                  Eligible
                </button>
                <button
                  className={`pill-tab ${claim === 'not-eligible' ? 'active' : ''}`}
                  onClick={() => setClaim('not-eligible')}
                  role="tab"
                  aria-selected={claim === 'not-eligible'}
                >
                  Not eligible
                </button>
              </div>

              <label className="field">
                <span>Private score (hidden inside the proof)</span>
                <input
                  type="number"
                  min="0"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="e.g. 85"
                />
              </label>

              <div className="verify-mode" role="tablist" aria-label="Verify path">
                <button
                  className={`pill-tab ${verifySource === 'server' ? 'active' : ''}`}
                  onClick={() => setVerifySource('server')}
                  role="tab"
                  aria-selected={verifySource === 'server'}
                  disabled={isStaticMode}
                  title={
                    isStaticMode
                      ? 'This hosted demo has no backend — use the Lace browser wallet.'
                      : 'The Node wallet signs and submits; score travels to the API server.'
                  }
                >
                  Server wallet
                </button>
                <button
                  className={`pill-tab ${verifySource === 'wallet' ? 'active' : ''}`}
                  onClick={() => setVerifySource('wallet')}
                  role="tab"
                  aria-selected={verifySource === 'wallet'}
                  title="Prove in your browser; your score never leaves this tab."
                >
                  Lace browser wallet
                </button>
              </div>

              {isStaticMode && (
                <div className="verify-result info">
                  Hosted demo: proving runs entirely in your browser via Lace — there is no
                  backend, so nothing but the signed boolean ever leaves your machine.
                </div>
              )}

              {verifySource === 'wallet' && !wallet && (
                <div className="verify-result info">
                  Connect Lace above to run the circuit in your browser.
                </div>
              )}

              <button
                className="btn btn-primary"
                onClick={onVerify}
                disabled={busy || !score.trim() || (verifySource === 'wallet' && !wallet)}
              >
                {busy
                  ? 'Proving… (30-60s)'
                  : verifySource === 'wallet'
                    ? 'Verify in zero knowledge (browser)'
                    : 'Verify in zero knowledge'}
              </button>

              {result && (
                <div className="verify-result ok">
                  {result}
                  {lastTx && (
                    <span className="tx">
                      tx {lastTx.txId} · block {lastTx.blockHeight}
                    </span>
                  )}
                </div>
              )}
              {error && <div className="verify-result err">{error}</div>}
            </div>

            <div className="verify-aside">
              <div className="aside-card">
                <h4>What gets published?</h4>
                <p>
                  Exactly one boolean — the result you claimed. It is stored in the
                  contract's ledger as <code>lastResult</code>, and{' '}
                  <code>verificationCount</code> increments. Nothing else.
                </p>
              </div>
              <div className="aside-card">
                <h4>What stays secret?</h4>
                <p>
                  Your <code>eligibilityScore</code>. It is a private circuit input,
                  committed inside the zero-knowledge proof, and discarded after the
                  transaction. Not even the verifier sees it.
                </p>
              </div>
              <div className="aside-card">
                <h4>Can you cheat?</h4>
                <p>
                  No. The circuit asserts{' '}
                  <code>score {'>='} requirement</code> before accepting your claim —
                  a wrong claim fails the proof and the transaction is rejected
                  on-chain.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-soft" id="why-private">
        <div className="container">
          <p className="section-eyebrow">
            <span className="badge badge-tag-yellow">PUBLIC VS PRIVATE</span>
          </p>
          <h2>One public fact. Everything else private.</h2>
          <p className="section-sub">
            The Midnight ledger is transparent — so ShadowPass keeps the ledger to a
            single boolean and hides your score inside the proof.
          </p>

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Visibility</th>
                  <th>Where it lives</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="row-label">Eligibility score</td>
                  <td className="row-private">Private</td>
                  <td>Inside the zero-knowledge proof — never stored</td>
                </tr>
                <tr>
                  <td className="row-label">Claimed result</td>
                  <td className="row-public">Public</td>
                  <td>Ledger field <code>lastResult</code></td>
                </tr>
                <tr>
                  <td className="row-label">Eligibility rule</td>
                  <td className="row-public">Public</td>
                  <td>Ledger field <code>requirement</code> — readable by anyone</td>
                </tr>
                <tr>
                  <td className="row-label">Verification count</td>
                  <td className="row-public">Public</td>
                  <td>Ledger counter <code>verificationCount</code></td>
                </tr>
                <tr>
                  <td className="row-label">Proof of claim</td>
                  <td className="row-public">Public</td>
                  <td>Verifiable on-chain — anyone can check it</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <CtaBanner />
      <FeedbackSection walletAddress={walletBalances?.unshieldedAddress} />
      <Footer address={contract?.address} />
    </div>
  );
}

/* ------------------------------------------------------------ */

function WalletPanel({
  wallet,
  balances,
  installed,
  busy,
  error,
  contractNetwork,
  browserState,
  browserStateError,
  onConnect,
  onDisconnect,
}: {
  wallet: MidnightWalletHandle | null;
  balances: WalletBalances | null;
  installed: boolean;
  busy: boolean;
  error: string | null;
  contractNetwork: string;
  browserState: ContractInfo | null;
  browserStateError: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="wallet-card">
      <div className="wallet-head">
        <div>
          <span className="badge badge-tag-teal">WALLET</span>
          <h4>{wallet ? 'Connected via Midnight' : 'Prove from your browser'}</h4>
          <p className="hint">
            {wallet
              ? 'The circuit runs locally. Your score stays in this tab — only the signed boolean is submitted.'
              : 'Connect a Midnight wallet (e.g. Lace) to run the circuit client-side. Without one, use the server wallet path.'}
          </p>
        </div>
        {wallet ? (
          <button className="btn btn-secondary" onClick={onDisconnect}>
            Disconnect
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onConnect} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect Lace'}
          </button>
        )}
      </div>

      {!installed && !wallet && (
        <div className="verify-result info">
          No Midnight wallet detected. Install{' '}
          <a href="https://lace.io" target="_blank" rel="noreferrer">
            Lace
          </a>{' '}
          to enable the browser path.
        </div>
      )}
      {error && <div className="verify-result err">{error}</div>}

      {wallet && (
        <div className="wallet-meta">
          <dl className="kv">
            <div>
              <dt>Wallet</dt>
              <dd>{wallet.name}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd className="mono">{SHORT_ADDRESS(balances?.unshieldedAddress ?? '…')}</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>{wallet.networkId}</dd>
            </div>
            <div>
              <dt>Indexer</dt>
              <dd className="mono">{SHORT_URL(wallet.configuration.indexerUri)}</dd>
            </div>
            <div>
              <dt>Proof server</dt>
              <dd className="mono">{SHORT_URL(wallet.configuration.proverServerUri)}</dd>
            </div>
            <div>
              <dt>Dust</dt>
              <dd>{balances ? (hasDust(balances.dust) ? balances.dust : '0') : '…'}</dd>
            </div>
          </dl>

          {wallet.networkId !== contractNetwork && (
            <div className="verify-result info">
              Wallet is on “{wallet.networkId}”, contract is on “{contractNetwork}”. Switch
              the wallet network and reconnect.
            </div>
          )}

          {balances && !hasDust(balances.dust) && (
            <div className="verify-result err">
              Dust balance is 0 — balancing the transaction needs DUST. Get tNIGHT from the
              Midnight faucet and convert some into DUST (Lace: receive → dust generator).
            </div>
          )}

          {browserStateError ? (
            <div className="verify-result info">
              Indexer read unavailable: {browserStateError}
            </div>
          ) : browserState ? (
            <div className="verify-result info">
              Browser read from indexer: count {browserState.verificationCount}, last result{' '}
              {browserState.lastResult ? 'eligible' : 'not eligible'}.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function PromoBanner({ address }: { address?: string }) {
  return (
    <div className="promo-banner">
      <div className="container">
        <span>ShadowPass is live on the Midnight devnet</span>
        <a href="#try-it" className="badge badge-yellow">
          VERIFY NOW
        </a>
        {address && <span className="mono">{SHORT_ADDRESS(address)}</span>}
      </div>
    </div>
  );
}

function TopNav() {
  return (
    <nav className="nav">
      <div className="container">
        <a href="#top" className="wordmark">
          <span className="wordmark-mark">✓</span>
          <span className="wordmark-text">ShadowPass</span>
        </a>

        <ul className="nav-links">
          <li>
            <a href="#features">Product</a>
          </li>
          <li>
            <a href="#how-it-works">How it works</a>
          </li>
          <li>
            <a href="#why-private">Why private</a>
          </li>
          <li>
            <a href="#try-it">Contract</a>
          </li>
        </ul>

        <div className="nav-actions">
          <a href="#why-private" className="btn btn-secondary">
            How it works
          </a>
          <a href="#try-it" className="btn btn-primary">
            Verify now
          </a>
        </div>
      </div>
    </nav>
  );
}

function Hero({
  count,
  requirement,
  lastResult,
  loadError,
}: {
  count: string;
  requirement: string;
  lastResult?: boolean;
  loadError: string | null;
}) {
  return (
    <header className="hero" id="top">
      <div className="container">
        <span className="hero-eyebrow badge badge-tag-purple">
          A zero-knowledge contract on Midnight
        </span>

        <h1>
          Prove you're eligible.
          <br />
          <span className="accent">Your score stays secret.</span>
        </h1>

        <p className="hero-sub">
          ShadowPass publishes a single boolean — eligible or not — while your private
          score lives only inside the zero-knowledge proof. Anyone can verify the
          result on-chain. Nobody can see the reason.
        </p>

        <div className="hero-actions">
          <a href="#try-it" className="btn btn-primary">
            Verify now
          </a>
          <a href="#how-it-works" className="btn btn-secondary">
            See how it works
          </a>
        </div>

        <div className="hero-mockup">
          <div className="sticky-notes">
            <div className="sticky-note note-yellow">
              <span>
                score
                <small>private witness</small>
              </span>
            </div>
            <div className="sticky-note note-rose">
              <span>
                zk proof
                <small>never reveals input</small>
              </span>
            </div>
            <div className="sticky-note note-teal">
              <span>
                result
                <small>one public boolean</small>
              </span>
            </div>
            <div className="sticky-note note-coral">
              <span>
                counter
                <small>tamper-proof ledger</small>
              </span>
            </div>
          </div>

          <div className="mockup">
            <div className="mockup-bar">
              <span className="mockup-dot red" />
              <span className="mockup-dot yellow" />
              <span className="mockup-dot green" />
              <span className="mockup-url">
                shadowpass · verify.midnight ·{' '}
                <span className="mono">contract on-chain</span>
              </span>
            </div>
            <div className="mockup-body">
              <div className="mockup-board">
                <div className="mockup-note-row">
                  <span className="mockup-note-icon" style={{ background: 'var(--brand-yellow)' }}>
                    ✓
                  </span>
                  <div className="mockup-note-text">
                    <strong>One public boolean</strong>
                    <small>lastResult on the ledger</small>
                  </div>
                </div>
                <div className="mockup-note-row">
                  <span className="mockup-note-icon" style={{ background: 'var(--teal-light)' }}>
                    🔒
                  </span>
                  <div className="mockup-note-text">
                    <strong>Score stays secret</strong>
                    <small>hidden inside the proof</small>
                  </div>
                </div>
                <div className="mockup-note-row">
                  <span className="mockup-note-icon" style={{ background: 'var(--rose-light)' }}>
                    #
                  </span>
                  <div className="mockup-note-text">
                    <strong>Tamper-proof counter</strong>
                    <small>{count} verifications recorded</small>
                  </div>
                </div>
              </div>
              <div className="mockup-panel">
                <div className="mockup-rule">
                  <span>Rule</span>
                  <strong>score ≥ {requirement}</strong>
                </div>
                <div className="mockup-rule">
                  <span>Last result</span>
                  {loadError ? (
                    <span className="mono">backend offline</span>
                  ) : lastResult === undefined ? (
                    <span className="mono">loading…</span>
                  ) : lastResult ? (
                    <span className="badge badge-success">ELIGIBLE</span>
                  ) : (
                    <span className="badge badge-red">NOT ELIGIBLE</span>
                  )}
                </div>
                <div className="mockup-input">Private score ████████</div>
                <a href="#try-it" className="btn btn-primary" style={{ width: '100%' }}>
                  Verify live ↓
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function StatsSection({ count, requirement }: { count: string; requirement: string }) {
  return (
    <div className="container">
      <div className="stats">
        <div className="stat">
          <div className="stat-value">0</div>
          <div className="stat-label">scores ever revealed on-chain</div>
        </div>
        <div className="stat">
          <div className="stat-value">1</div>
          <div className="stat-label">public fact per verification</div>
        </div>
        <div className="stat">
          <div className="stat-value">
            {requirement}
            <span className="accent">+</span>
          </div>
          <div className="stat-label">minimum score enforced by the rule</div>
        </div>
      </div>
    </div>
  );
}

function FeaturesSection() {
  return (
    <section className="section section-soft" id="features">
      <div className="container">
        <p className="section-eyebrow">
          <span className="badge badge-tag-yellow">WHY SHADOWPASS</span>
        </p>
        <h2>Privacy you can prove, not promise.</h2>
        <p className="section-sub">
          ShadowPass is built on a Midnight circuit that enforces the eligibility rule
          inside a zero-knowledge proof — so the system can't leak what it can't see.
        </p>

        <div className="feature-grid">
          <div className="feature-card feature-yellow">
            <span className="badge badge-yellow" style={{ background: 'var(--ink-deep)', color: 'var(--brand-yellow)' }}>
              PRIVATE
            </span>
            <h3>Score stays private</h3>
            <p>
              Your eligibility score is a private witness. It never appears on the
              ledger, in the transaction, or inside the proof itself.
            </p>
          </div>

          <div className="feature-card feature-rose">
            <span className="badge badge-tag-rose">MINIMAL</span>
            <h3>One public boolean</h3>
            <p>
              The contract publishes only the result you claim. No history, no
              metadata, no identity — just eligible or not.
            </p>
          </div>

          <div className="feature-card feature-teal">
            <span className="badge badge-tag-teal">TRANSPARENT</span>
            <h3>A rule anyone can read</h3>
            <p>
              The <code>requirement</code> lives on the ledger. Anyone can check the
              rule and re-verify every recorded result against it.
            </p>
          </div>

          <div className="feature-card feature-coral">
            <span className="badge badge-tag-coral">IMMUTABLE</span>
            <h3>Tamper-proof counter</h3>
            <p>
              Every verification bumps <code>verificationCount</code> on-chain.
              Nobody can forge, skip, or replay a check.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="section" id="how-it-works">
      <div className="container">
        <p className="section-eyebrow">
          <span className="badge badge-tag-purple">UNDER THE HOOD</span>
        </p>
        <h2>Three steps. Zero reveals.</h2>
        <p className="section-sub">
          The whole flow runs as a single Midnight transaction backed by a generated
          zero-knowledge circuit.
        </p>

        <div className="steps">
          <div className="step">
            <span className="step-num">1</span>
            <h3>Choose a claim</h3>
            <p>
              Pick the boolean you want recorded: eligible or not eligible. This is the
              only value that will ever touch the ledger.
            </p>
            <span className="badge badge-tag-coral step-tag">Client input</span>
          </div>

          <div className="step">
            <span className="step-num">2</span>
            <h3>Prove it in zero knowledge</h3>
            <p>
              Enter your private score. The circuit checks it against the on-chain{' '}
              <code>requirement</code> and builds a proof — the score itself stays with
              you.
            </p>
            <span className="badge badge-tag-teal step-tag">ZK circuit</span>
          </div>

          <div className="step">
            <span className="step-num">3</span>
            <h3>Record the result</h3>
            <p>
              The proof is verified on-chain. Only <code>lastResult</code> is written,
              and <code>verificationCount</code> increments. Done.
            </p>
            <span className="badge badge-tag-yellow step-tag">Ledger</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function CtaBanner() {
  return (
    <div className="container">
      <div className="cta-banner">
        <h2>Ship your own privacy check.</h2>
        <p>
          Fork the repo, compile the circuit, and deploy ShadowPass to any Midnight
          network in a few commands.
        </p>
        <a
          className="btn btn-on-dark"
          href="https://github.com/midnight-ntwrk/compact"
          target="_blank"
          rel="noreferrer"
        >
          Explore the source
        </a>
      </div>
    </div>
  );
}

function FeedbackSection({ walletAddress }: { walletAddress?: string }) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [useCase, setUseCase] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFeedback({ walletAddress, rating, comment, useCase });
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="section" id="feedback">
      <div className="container">
        <p className="section-eyebrow">
          <span className="badge badge-tag-yellow">FEEDBACK</span>
        </p>
        <h2>Help us improve ShadowPass</h2>
        <p className="section-sub">
          Your feedback shapes the product. Rate your experience and tell us
          how you use ShadowPass — every response helps us build better privacy tools.
        </p>

        {submitted ? (
          <div className="feedback-thanks">
            <span className="badge badge-success">THANK YOU</span>
            <h3>Your feedback has been recorded</h3>
            <p>
              Thank you for helping us improve ShadowPass. Your input directly
              influences what we build next.
            </p>
          </div>
        ) : (
          <div className="feedback-form">
            <div className="feedback-rating">
              <span>Rate your experience:</span>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className={`star ${(hoverRating || rating) >= n ? 'active' : ''}`}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  >
                    {(hoverRating || rating) >= n ? '\u2605' : '\u2606'}
                  </button>
                ))}
              </div>
            </div>

            <label className="field">
              <span>How are you using ShadowPass? (optional)</span>
              <input
                type="text"
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="e.g. age verification, credential check, eligibility gate"
              />
            </label>

            <label className="field">
              <span>Your feedback (optional)</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did you like? What could be better?"
                rows={4}
              />
            </label>

            {error && <div className="verify-result err">{error}</div>}

            <button
              className="btn btn-primary"
              onClick={() => void onSubmit()}
              disabled={submitting || !rating}
            >
              {submitting ? 'Submitting...' : 'Submit feedback'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Footer({ address }: { address?: string }) {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <a href="#top" className="wordmark">
            <span className="wordmark-mark">✓</span>
            <span className="wordmark-text">ShadowPass</span>
          </a>
          <p>
            A zero-knowledge eligibility verifier on Midnight. Prove the boolean, keep
            the reason private.
          </p>
        </div>

        <div className="footer-col">
          <h5>Product</h5>
          <ul>
            <li><a href="#features">Features</a></li>
            <li><a href="#how-it-works">How it works</a></li>
            <li><a href="#try-it">Verify</a></li>
            <li><a href="#why-private">Public vs private</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h5>Privacy</h5>
          <ul>
            <li><a href="#why-private">Zero-knowledge proofs</a></li>
            <li><a href="#why-private">Private inputs</a></li>
            <li><a href="#why-private">On-chain transparency</a></li>
            <li><a href="#why-private">Verifiable results</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h5>Developers</h5>
          <ul>
            <li><a href="#try-it">Contract source</a></li>
            <li><a href="#try-it">Compiled circuits</a></li>
            <li><a href="#try-it">TypeScript API</a></li>
            <li><a href="#try-it">Unit tests</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h5>Network</h5>
          <ul>
            <li><a href="#try-it">Local devnet</a></li>
            <li><a href="#try-it">Preview</a></li>
            <li><a href="#try-it">Preprod</a></li>
            <li><a href="#try-it">Faucet</a></li>
          </ul>
        </div>

        <div className="footer-col">
          <h5>Midnight</h5>
          <ul>
            <li><a href="https://docs.midnight.network/" target="_blank" rel="noreferrer">Docs</a></li>
            <li><a href="https://github.com/midnight-ntwrk/compact" target="_blank" rel="noreferrer">Compact</a></li>
            <li><a href="https://www.midnight.network/" target="_blank" rel="noreferrer">About</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-chips">
          {address && (
            <div className="footer-chip">
              Contract
              <small className="mono">{SHORT_ADDRESS(address)}</small>
            </div>
          )}
          <div className="footer-chip">
            Power
            <small>Midnight · zero-knowledge</small>
          </div>
          <div className="footer-chip">
            Rule
            <small>score ≥ 60</small>
          </div>
        </div>
        <span>© {new Date().getFullYear()} ShadowPass · Built with Midnight</span>
      </div>
    </footer>
  );
}
