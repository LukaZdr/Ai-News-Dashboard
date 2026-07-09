import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const ROOT_DIR = join(__dirname, '..', '..');
export const DATA_DIR = join(ROOT_DIR, 'data');
export const CONFIG_DIR = join(ROOT_DIR, 'config');

export function generateId(input: string): string {
  return createHash('md5').update(input).digest('hex').substring(0, 12);
}

export function readJsonFile<T>(filePath: string): T {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export function writeJsonFile(filePath: string, data: unknown): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  ✓ Written: ${filePath}`);
}

export function getConfigPath(filename: string): string {
  return join(CONFIG_DIR, filename);
}

export function getDataPath(filename: string): string {
  return join(DATA_DIR, filename);
}

export function isWithinTimeframe(dateString: string, hours: number): boolean {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return diff < hours * 60 * 60 * 1000;
}

export function deduplicateByField<T>(items: T[], field: keyof T): T[] {
  const seen = new Set<unknown>();
  return items.filter((item) => {
    const value = item[field];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

/**
 * Auto-tag content based on keyword matching.
 */
export function autoTag(text: string): string[] {
  const lower = text.toLowerCase();
  const tagMap: Record<string, string[]> = {
    'Agents': ['agent', 'agentic', 'tool use', 'function calling', 'multi-agent'],
    'Reasoning': ['reasoning', 'chain of thought', 'cot', 'think', 'o1', 'o3', 'o4'],
    'LLMs': ['llm', 'language model', 'gpt', 'claude', 'gemini', 'llama', 'transformer'],
    'Computer Vision': ['vision', 'image', 'visual', 'diffusion', 'stable diffusion', 'dall-e', 'midjourney'],
    'Robotics': ['robot', 'embodied', 'manipulation', 'locomotion'],
    'AI Coding': ['coding', 'code generation', 'copilot', 'devin', 'cursor', 'programmer'],
    'Open Source': ['open source', 'open-source', 'oss', 'apache', 'mit license'],
    'Research': ['paper', 'arxiv', 'benchmark', 'evaluation', 'ablation'],
    'Business': ['funding', 'valuation', 'acquisition', 'partnership', 'revenue'],
    'MCP': ['mcp', 'model context protocol', 'tool server'],
    'RL': ['reinforcement learning', 'rl', 'reward', 'ppo', 'rlhf', 'grpo'],
    'Video Models': ['video generation', 'sora', 'video model', 'text-to-video'],
    'Inference': ['inference', 'serving', 'vllm', 'quantization', 'speculative decoding'],
    'Memory': ['memory', 'context window', 'long context', 'rag'],
    'RAG': ['retrieval', 'rag', 'retrieval augmented', 'vector database', 'embedding'],
    'Synthetic Data': ['synthetic data', 'data generation', 'distillation'],
  };

  const tags: string[] = [];
  for (const [tag, keywords] of Object.entries(tagMap)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      tags.push(tag);
    }
  }
  return tags;
}

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very',
  'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  // Domain-specific generic terms
  'ai', 'model', 'models', 'paper', 'papers', 'research', 'dataset', 'datasets', 'framework', 'library', 'system', 'systems', 'method', 'methods', 'approach', 'approaches', 'results', 'performance', 'new', 'recent', 'using', 'based', 'github', 'youtube', 'video', 'news', 'update', 'release', 'blog', 'feed', 'via', 'propose', 'proposed', 'novel', 'state', 'art', 'state-of-the-art', 'key', 'one', 'two', 'three', 'show', 'shows', 'find', 'finds', 'work', 'works', 'use', 'uses', 'used', 'developer', 'developers', 'code', 'coding', 'project', 'projects', 'built', 'build', 'tool', 'tools', 'platform', 'platforms', 'applications', 'application', 'task', 'tasks', 'data', 'information', 'processing', 'analysis', 'analyzing', 'generation', 'generate', 'generative', 'user', 'users', 'open', 'source', 'llm', 'llms'
]);

export function extractTerms(text: string): string[] {
  if (!text) return [];
  const clean = text.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = clean.split(' ').filter(w => w.length > 1 && !/^\d+$/.test(w));
  const terms: string[] = [];
  
  // Unigrams
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!STOPWORDS.has(word)) {
      terms.push(word);
    }
  }
  
  // Bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i];
    const w2 = words[i + 1];
    if (!STOPWORDS.has(w1) && !STOPWORDS.has(w2)) {
      terms.push(`${w1} ${w2}`);
    }
  }
  
  return terms;
}


export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'AI-News-Dashboard/1.0',
          ...options.headers,
        },
      });
      if (response.ok) return response;
      console.warn(`  ⚠ HTTP ${response.status} for ${url} (attempt ${i + 1})`);
    } catch (error) {
      console.warn(`  ⚠ Fetch error for ${url} (attempt ${i + 1}):`, error);
    }
    if (i < retries - 1) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}
