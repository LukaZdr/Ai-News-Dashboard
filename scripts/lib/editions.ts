import { readdirSync } from 'fs';
import { join } from 'path';
import type { EditionConfig } from '../../src/types/index.js';
import { CONFIG_DIR, readJson } from './io.js';

/** Every config/editions/*.json, in display order. Adding a file adds an edition. */
export function loadEditions(): EditionConfig[] {
  const dir = join(CONFIG_DIR, 'editions');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson<EditionConfig>(join(dir, f)))
    .sort((a, b) => a.order - b.order);
}
