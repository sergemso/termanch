// Gate (issue #21): the client bundle stays under 2 MB gzipped. Run after `vite build`.
import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const LIMIT = 2 * 1024 * 1024;
const dir = join(import.meta.dirname, '../dist/assets');
const total = readdirSync(dir)
  .filter((f) => /\.(js|css)$/.test(f))
  .reduce((n, f) => n + gzipSync(readFileSync(join(dir, f))).length, 0);
console.log(`client bundle: ${(total / 1024).toFixed(0)} KB gzipped (limit ${LIMIT / 1024} KB)`);
if (total > LIMIT) {
  console.error('FAIL: client bundle too large');
  process.exit(1);
}
