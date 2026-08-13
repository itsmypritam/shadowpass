/**
 * Build-time environment configuration (Vite `import.meta.env`).
 *
 * The project runs in two modes:
 *
 *  - Dev mode (default): the page talks to the local API server (`/api`),
 *    which holds the Node wallet and proves server-side.
 *
 *  - Static mode (`VITE_CONTRACT_ADDRESS` set, used for the hosted live demo):
 *    there is no backend. Contract state is read straight from the public
 *    indexer, and all verification runs in the browser via Lace.
 */

const VITE = import.meta.env;

/** Contract address deployed on the configured network (static mode only). */
export const staticContractAddress: string | undefined = VITE.VITE_CONTRACT_ADDRESS;

/** Network the contract lives on, e.g. `preprod` (static mode only). */
export const staticNetworkId: string | undefined = VITE.VITE_NETWORK_ID;

/** Public indexer GraphQL HTTP endpoint (static mode only). */
export const staticIndexerUri: string | undefined = VITE.VITE_INDEXER_URI;

/** Public indexer GraphQL WebSocket endpoint (static mode only). */
export const staticIndexerWsUri: string | undefined = VITE.VITE_INDEXER_WS_URI;

/** True when running the backend-less hosted build. */
export const isStaticMode = Boolean(staticContractAddress);

export function staticConfigError(): string {
  return (
    'Static demo is misconfigured: VITE_CONTRACT_ADDRESS, VITE_NETWORK_ID, ' +
    'VITE_INDEXER_URI and VITE_INDEXER_WS_URI must all be set at build time.'
  );
}
