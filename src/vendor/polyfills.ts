/**
 * Minimal Node-polyfill for the browser bundle.
 *
 * Parts of the midnight-js SDK (ledger serialization, the Compact runtime and
 * the address codecs) reference the Node `Buffer` global while assembling and
 * serializing transactions. Browsers have no `Buffer` global, so without this
 * the SDK throws `ReferenceError: Buffer is not defined`, which the contract
 * layer wraps as `Unexpected error executing scoped transaction '<unnamed>': ...`.
 * Provide the `buffer` package (already a transitive dependency) on
 * `globalThis` so those paths work in the page.
 */
import { Buffer } from 'buffer';

if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

export {};
