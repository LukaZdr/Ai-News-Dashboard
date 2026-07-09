import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

export interface HistoricalDF {
  totalDocuments: number;
  frequencies: Record<string, number>;
}

export function loadHistoricalDF(filePath: string): HistoricalDF {
  if (!existsSync(filePath)) {
    return {
      totalDocuments: 0,
      frequencies: {},
    };
  }
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as HistoricalDF;
  } catch (error) {
    console.error(`  ⚠ Failed to read historical DF file: ${(error as Error).message}`);
    return {
      totalDocuments: 0,
      frequencies: {},
    };
  }
}

export function saveHistoricalDF(filePath: string, df: HistoricalDF): void {
  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(df, null, 2), 'utf-8');
  } catch (error) {
    console.error(`  ⚠ Failed to save historical DF file: ${(error as Error).message}`);
  }
}

/**
 * Update the historical DF with unique terms from today's documents.
 */
export function updateHistoricalDF(todayDocumentsTerms: string[][], df: HistoricalDF): void {
  df.totalDocuments += todayDocumentsTerms.length;
  for (const docTerms of todayDocumentsTerms) {
    const uniqueTerms = new Set(docTerms);
    for (const term of uniqueTerms) {
      df.frequencies[term] = (df.frequencies[term] || 0) + 1;
    }
  }
}

/**
 * Track the original casing of terms as they appear in the original text.
 */
export function trackCasing(text: string, terms: string[], casingMap: Record<string, Record<string, number>>) {
  for (const term of terms) {
    // Escape special regex characters
    const escaped = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Match word boundaries for the term case-insensitively
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      for (const match of matches) {
        const trimmed = match.trim();
        if (!casingMap[term]) {
          casingMap[term] = {};
        }
        casingMap[term][trimmed] = (casingMap[term][trimmed] || 0) + 1;
      }
    }
  }
}

/**
 * Get the best casing for a lowercase term based on tracking counts.
 */
export function getBestCasing(term: string, casingMap: Record<string, Record<string, number>>): string {
  const cases = casingMap[term];
  if (!cases) {
    // Fallback: title case
    return term.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  let bestCase = term;
  let maxCount = -1;
  for (const [casing, count] of Object.entries(cases)) {
    if (count > maxCount) {
      maxCount = count;
      bestCase = casing;
    }
  }
  return bestCase;
}

/**
 * Compute the TF-IDF scores for today's terms.
 * Sums the TF-IDF scores across all documents today to rank the topics.
 */
export function computeTFIDF(
  todayDocumentsTerms: string[][],
  df: HistoricalDF
): { term: string; score: number }[] {
  const totalDocs = df.totalDocuments;
  if (totalDocs === 0 || todayDocumentsTerms.length === 0) {
    return [];
  }

  const scores: Record<string, number> = {};

  // For each document
  for (const docTerms of todayDocumentsTerms) {
    if (docTerms.length === 0) continue;

    // Calculate Term Frequency (TF) for this document
    const docTermCounts: Record<string, number> = {};
    for (const term of docTerms) {
      docTermCounts[term] = (docTermCounts[term] || 0) + 1;
    }

    // Calculate TF-IDF for each unique term in this document
    for (const [term, count] of Object.entries(docTermCounts)) {
      const tf = count / docTerms.length;
      
      // Calculate IDF: log((N + 1) / (DF + 1)) + 1
      const docFreq = df.frequencies[term] || 0;
      const idf = Math.log((totalDocs + 1) / (docFreq + 1)) + 1;

      const tfidf = tf * idf;

      // Sum scores across today's documents
      scores[term] = (scores[term] || 0) + tfidf;
    }
  }

  // Convert to array and sort descending
  return Object.entries(scores)
    .map(([term, score]) => ({ term, score }))
    .sort((a, b) => b.score - a.score);
}
