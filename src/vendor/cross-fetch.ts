/**
 * Browser shim for `cross-fetch`.
 *
 * cross-fetch's browser build re-exports the native `window.fetch` UNBOUND
 * (`exports = ctx.fetch` at the bottom of dist/browser-ponyfill.js). The
 * midnight-js providers call it with a different receiver (FetchZkConfigProvider
 * calls `this.fetchFunc(...)`; httpClientProofProvider and the indexer provider
 * hand it to fetch-retry/Apollo, which call it as a bare function), so the
 * native fetch throws "Failed to execute 'fetch' on 'Window': Illegal
 * invocation". Binding it to `window` restores the required receiver; browsers
 * already provide native Headers/Request/Response, so the ponyfill isn't needed.
 */
type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const globalObj: {
  fetch: FetchFn;
  Headers: typeof Headers;
  Request: typeof Request;
  Response: typeof Response;
} = globalThis as any;

const fetchImpl: FetchFn = globalObj.fetch.bind(globalThis);

export default fetchImpl;
export { fetchImpl as fetch };

export const Headers = globalObj.Headers;
export const Request = globalObj.Request;
export const Response = globalObj.Response;
