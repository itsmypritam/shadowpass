import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const projectRoot = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const server = spawn(npmCmd, ['run', 'server'], { cwd: projectRoot, stdio: 'inherit', shell: process.platform === 'win32' });
const ui = spawn(npmCmd, ['run', 'dev:ui'], { cwd: projectRoot, stdio: 'inherit', shell: process.platform === 'win32' });

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  server.kill('SIGTERM');
  ui.kill('SIGTERM');
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
