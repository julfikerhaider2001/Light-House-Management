// G4: the JS needed for the initial route (entry script + modulepreloads) must be ≤ 250 KB gzip.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 250;
const DIST = 'dist';
const BASE = '/Light-House-Management/';

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const refs = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
].map((m) => m[1]);

if (refs.length === 0) {
  console.error('No entry scripts found in dist/index.html');
  process.exit(1);
}

let total = 0;
for (const ref of new Set(refs)) {
  const file = join(DIST, ref.startsWith(BASE) ? ref.slice(BASE.length) : ref);
  const size = gzipSync(readFileSync(file), { level: 9 }).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(8)} KB  ${ref}`);
}

const totalKb = total / 1024;
console.log(`${totalKb.toFixed(1).padStart(8)} KB  total (budget ${BUDGET_KB} KB gzip)`);
if (totalKb > BUDGET_KB) {
  console.error(`Initial-route JS is over budget by ${(totalKb - BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
