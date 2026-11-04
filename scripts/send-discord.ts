/**
 * Post each edition's issue to its own Discord channel.
 *
 *   npm run send:discord                          # every edition with an issue dated today
 *   npm run send:discord -- --edition medical
 *   npm run send:discord -- --dry-run             # print payloads, post nothing
 *
 * An edition is skipped (no ping) when it has no issue for today — e.g. weekends,
 * when arXiv makes no announcement — or when its webhook env var is not set.
 */
import 'dotenv/config';
import { join } from 'path';
import type { Issue, Settings } from '../src/types/index.js';
import { CONFIG_DIR, DATA_DIR, readJson, todayUtc } from './lib/io.js';
import { buildPayload } from './lib/discord.js';
import { loadEditions } from './lib/editions.js';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const only = args.includes('--edition') ? args[args.indexOf('--edition') + 1] : undefined;

async function main() {
  const settings = readJson<Settings>(join(CONFIG_DIR, 'settings.json'));
  const base = (process.env.DASHBOARD_URL || settings.dashboardUrl).replace(/\/?$/, '/');
  const today = todayUtc();
  let failures = 0;

  for (const edition of loadEditions().filter((e) => !only || e.slug === only)) {
    const issue = readJson<Issue | null>(join(DATA_DIR, 'editions', edition.slug, 'latest.json'), null);
    if (!issue || issue.date !== today) {
      console.log(`⏭  ${edition.name}: no issue today`);
      continue;
    }
    const envName = edition.discordWebhookEnv.find((n) => process.env[n]);
    const webhook = envName ? process.env[envName] : undefined;
    if (!webhook && !dryRun) {
      console.log(`⏭  ${edition.name}: none of ${edition.discordWebhookEnv.join(', ')} is set`);
      continue;
    }
    const payload = buildPayload(edition, issue, `${base}#/${edition.slug}`, settings.publicationName);
    if (dryRun) {
      console.log(`\n── ${edition.name} → ${envName ?? '(no webhook set)'}\n${JSON.stringify(payload, null, 2)}`);
      continue;
    }
    const res = await fetch(webhook!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      console.log(`✅ ${edition.name}: posted No. ${issue.number}`);
    } else {
      failures++;
      console.error(`❌ ${edition.name}: Discord returned ${res.status} ${await res.text()}`);
    }
  }
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
