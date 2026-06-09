import type { MemoryEntry, RecallOpts } from "../types.js";
import type { MemoryAdapter } from "./types.js";

export class InMemoryAdapter implements MemoryAdapter {
  readonly #entries = new Map<string, MemoryEntry>();

  async write(entry: MemoryEntry): Promise<void> {
    if (entry.scope !== "working") {
      return;
    }

    this.#entries.set(entry.id, cloneEntry(entry));
  }

  async recall(query: string, opts: RecallOpts = {}): Promise<MemoryEntry[]> {
    if (opts.scope !== undefined && opts.scope !== "working") {
      return [];
    }

    const scored: ScoredEntry[] = [];

    for (const entry of this.#entries.values()) {
      if (opts.since !== undefined && entry.createdAt < opts.since) {
        continue;
      }

      const score = lexicalScore(query, entry.content);
      if (query.trim().length === 0 || score > 0) {
        scored.push({ entry, score });
      }
    }

    return scored
      .sort(compareScoredEntries)
      .slice(0, opts.limit)
      .map(({ entry }) => cloneEntry(entry));
  }

  async forget(id: string): Promise<void> {
    this.#entries.delete(id);
  }
}

type ScoredEntry = {
  entry: MemoryEntry;
  score: number;
};

function compareScoredEntries(left: ScoredEntry, right: ScoredEntry): number {
  const scoreDifference = right.score - left.score;
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return right.entry.createdAt - left.entry.createdAt;
}

function lexicalScore(query: string, content: string): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return 0;
  }

  const contentTokens = new Set(tokenize(content));
  let matches = 0;

  for (const token of queryTokens) {
    if (contentTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / queryTokens.length;
}

function tokenize(input: string): string[] {
  return input.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function cloneEntry(entry: MemoryEntry): MemoryEntry {
  if (entry.metadata === undefined) {
    return { ...entry };
  }

  return { ...entry, metadata: { ...entry.metadata } };
}
