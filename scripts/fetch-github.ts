/**
 * Fetch GitHub repository releases and metadata.
 */
import 'dotenv/config';
import {
  generateId,
  readJsonFile,
  writeJsonFile,
  getConfigPath,
  getDataPath,
  fetchWithRetry,
} from './utils/index.js';
import type { GitHubRepo, GitHubRepoConfig } from '../src/types/index.js';

const GITHUB_API = 'https://api.github.com';

async function fetchRepoData(
  repoConfig: GitHubRepoConfig,
  headers: Record<string, string>
): Promise<GitHubRepo | null> {
  const { owner, repo } = repoConfig;
  console.log(`  📦 Fetching ${owner}/${repo}...`);
  try {
    const repoResponse = await fetchWithRetry(
      `${GITHUB_API}/repos/${owner}/${repo}`, { headers }
    );
    const repoData = await repoResponse.json() as {
      full_name: string; name: string; description: string;
      html_url: string; stargazers_count: number; language: string; pushed_at: string;
    };

    let latestRelease: GitHubRepo['latestRelease'];
    try {
      const rel = await fetchWithRetry(
        `${GITHUB_API}/repos/${owner}/${repo}/releases/latest`, { headers }
      );
      const relData = await rel.json() as { tag_name: string; published_at: string; body: string };
      if (relData.tag_name) {
        latestRelease = { tag: relData.tag_name, date: relData.published_at, notes: (relData.body || '').substring(0, 500) };
      }
    } catch { /* no release */ }

    console.log(`    ✓ ⭐ ${repoData.stargazers_count.toLocaleString()}`);
    return {
      id: generateId(`gh-${owner}/${repo}`),
      name: repoData.name, fullName: repoData.full_name,
      description: repoData.description || '', url: repoData.html_url,
      stars: repoData.stargazers_count, language: repoData.language || undefined,
      latestRelease, recentActivity: repoData.pushed_at, tags: repoConfig.tags,
    };
  } catch (error) {
    console.warn(`    ⚠ Failed: ${(error as Error).message}`);
    return null;
  }
}

export async function fetchGitHub(): Promise<GitHubRepo[]> {
  const config = readJsonFile<{ repositories: GitHubRepoConfig[] }>(getConfigPath('github.json'));
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const results = await Promise.allSettled(
    config.repositories.map((r) => fetchRepoData(r, headers))
  );
  const repos = results
    .filter((r): r is PromiseFulfilledResult<GitHubRepo | null> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((r): r is GitHubRepo => r !== null);
  repos.sort((a, b) => b.stars - a.stars);
  console.log(`\n📊 Total repos: ${repos.length}`);
  return repos;
}

async function main() {
  console.log('=== Fetching GitHub Repos ===\n');
  const repos = await fetchGitHub();
  writeJsonFile(getDataPath('github.json'), repos);
  console.log('\n✅ GitHub fetch complete!');
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
