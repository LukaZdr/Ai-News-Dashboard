import 'dotenv/config';
import { readJsonFile, getDataPath } from './utils/index.js';
import type { DailyDigest } from '../src/types/index.js';
import { execSync } from 'child_process';

function truncate(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

async function sendDiscordNotification() {
  console.log('=== Sending Discord Webhook Notification ===\n');

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('⚠️ DISCORD_WEBHOOK_URL is not set in environment variables. Skipping Discord notification.');
    process.exit(0);
  }

  // 1. Resolve Dashboard URL
  let dashboardUrl = process.env.DASHBOARD_URL;
  if (!dashboardUrl) {
    try {
      const gitUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
      const match = gitUrl.match(/github\.com[:/]([^/]+)\/([^.]+)/);
      if (match) {
        const owner = match[1];
        const repo = match[2];
        dashboardUrl = `https://${owner}.github.io/${repo}/`;
      }
    } catch (e) {
      // ignore git resolve errors
    }
  }
  if (!dashboardUrl) {
    dashboardUrl = 'https://lukazdr.github.io/AI-News-Dashboard';
  }

  console.log(`🔗 Dashboard Link: ${dashboardUrl}`);

  // 2. Read latest digest.json
  let digest: DailyDigest;
  try {
    digest = readJsonFile<DailyDigest>(getDataPath('digest.json'));
  } catch (error) {
    console.error('❌ Failed to read data/digest.json:', (error as Error).message);
    process.exit(1);
  }

  // 3. Format Discord Embed
  const embed: any = {
    title: `📰 Daily AI Intelligence Digest — ${digest.date}`,
    url: dashboardUrl,
    color: 0x111827, // Slate/Gray-900 for premium theme
    footer: {
      text: `AI News Dashboard • Model: ${digest.model}`
    },
    timestamp: digest.generatedAt || new Date().toISOString()
  };

  // Limit description to 2000 chars to leave space for fields and prevent webhook rejection
  embed.description = truncate(digest.summary || 'No summary available.', 2000);

  const fields = [];
  let totalChars = (embed.title?.length || 0) + (embed.description?.length || 0);

  if (digest.topDevelopments && Array.isArray(digest.topDevelopments)) {
    for (const dev of digest.topDevelopments.slice(0, 4)) {
      const name = truncate(`🔥 ${dev.rank}. ${dev.title}`, 250);
      const value = truncate(
        `${dev.summary}\n\n**Why it matters:** *${dev.whyItMatters}*`,
        500
      );

      // Keep total embed characters under 5500 (Discord limit is 6000)
      if (totalChars + name.length + value.length > 5500) {
        break;
      }

      fields.push({ name, value, inline: false });
      totalChars += name.length + value.length;
    }
  }

  embed.fields = fields;

  const payload = {
    content: `📢 **Here is today's Daily AI Digest summary!**\nView the full interactive dashboard here: ${dashboardUrl}`,
    embeds: [embed]
  };

  // 4. Send Webhook Request
  try {
    console.log('Sending message payload to Discord...');
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('✅ Discord notification sent successfully!');
    } else {
      const errorText = await response.text();
      console.error(`❌ Discord API returned status ${response.status}:`, errorText);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to dispatch Discord webhook request:', (error as Error).message);
    process.exit(1);
  }
}

sendDiscordNotification().catch(err => {
  console.error(err);
  process.exit(1);
});
