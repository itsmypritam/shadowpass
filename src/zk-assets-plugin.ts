/**
 * Vite plugin that exposes the compiled ZK artifacts to the browser.
 *
 * The ShadowPass circuit artifacts live at `managed/shadow-pass/`:
 *   keys/verifyEligibility.prover / .verifier
 *   zkir/verifyEligibility.bzkir
 *
 * FetchZkConfigProvider expects to find them at
 *   {baseURL}/keys/<circuitId>.prover, {baseURL}/keys/<circuitId>.verifier,
 *   {baseURL}/zkir/<circuitId>.bzkir
 *
 * This plugin serves `managed/shadow-pass` at `/zk/` during development and
 * copies `keys/` + `zkir/` into the production build (`dist/zk/`), so the
 * browser can fetch everything same-origin.
 */
import type { Connect, Plugin, ResolvedConfig } from 'vite';
import { createReadStream } from 'node:fs';
import { promises as fs, existsSync, statSync } from 'node:fs';
import * as path from 'node:path';

const ZK_BASE = '/zk/';

const MIME_BY_EXT: Record<string, string> = {
  '.prover': 'application/octet-stream',
  '.verifier': 'application/octet-stream',
  '.zkir': 'application/octet-stream',
  '.bzkir': 'application/octet-stream',
};

export function zkAssetsPlugin(): Plugin {
  let projectRoot = process.cwd();
  let outDir = path.resolve(projectRoot, 'src', 'dist');

  const managedDir = () => path.resolve(projectRoot, 'managed', 'shadow-pass');

  const sendFile: Connect.NextHandleFunction = (req, res, next) => {
    const url = (req.url ?? '').split('?')[0].split('#')[0];
    if (!url.startsWith(ZK_BASE)) return next();

    const rel = decodeURIComponent(url.slice(ZK_BASE.length));
    if (!rel || rel.includes('..')) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    const file = path.join(managedDir(), rel);
    if (!file.startsWith(managedDir()) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }

    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    createReadStream(file).pipe(res);
  };

  return {
    name: 'shadowpass:zk-assets',

    configResolved(config: ResolvedConfig) {
      projectRoot = path.dirname(config.root);
      outDir = path.resolve(config.root, config.build.outDir);
    },

    configureServer(server) {
      server.middlewares.use(sendFile);
    },

    configurePreviewServer(server) {
      server.middlewares.use(sendFile);
    },

    async closeBundle() {
      const managed = managedDir();
      await fs.mkdir(outDir, { recursive: true });
      await fs.cp(path.join(managed, 'keys'), path.join(outDir, 'zk', 'keys'), { recursive: true });
      await fs.cp(path.join(managed, 'zkir'), path.join(outDir, 'zk', 'zkir'), { recursive: true });
    },
  };
}
