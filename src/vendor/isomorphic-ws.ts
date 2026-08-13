/**
 * Browser shim for `isomorphic-ws`.
 *
 * `isomorphic-ws` ships a CJS default export for the browser (`browser.js`),
 * but the indexer public data provider does `import { WebSocket } from
 * 'isomorphic-ws'`. Browsers have a native global `WebSocket`, so this alias
 * satisfies the named import without pulling in the Node `ws` package.
 */
export const WebSocket = globalThis.WebSocket;

export default WebSocket;
