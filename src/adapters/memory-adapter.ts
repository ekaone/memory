import type { MemoryEntry, RecallQuery, RecentOptions, SearchOptions } from "../types.js";
import type { MemoryAdapter } from "./types.js";

const DEFAULT_SCOPE = "working" as const;

export function memoryAdapter(): MemoryAdapter {
  const store = new Map<string, MemoryEntry>();

  return {
    async write(entry: MemoryEntry): Promise<MemoryEntry> {
      const stored = clone({ ...entry, scope: entry.scope ?? DEFAULT_SCOPE });
      store.set(entry.id, stored);
      return clone(stored);
    },

    async recall(query: RecallQuery = {}): Promise<MemoryEntry[]> {
      return [...store.values()]
        .filter((e) => matchesQuery(e, query))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, query.limit)
        .map(clone);
    },

    async search(text: string, options: SearchOptions = {}): Promise<MemoryEntry[]> {
      if (text.trim().length === 0) return [];

      const scored: { entry: MemoryEntry; score: number }[] = [];

      for (const entry of store.values()) {
        if (options.agentId !== undefined && entry.agentId !== options.agentId) continue;
        if (options.scope !== undefined && entry.scope !== options.scope) continue;

        const score = lexicalScore(text, entry.content);
        if (score > 0) scored.push({ entry, score });
      }

      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, options.limit)
        .map(({ entry }) => clone(entry));
    },

    async recent(options: RecentOptions = {}): Promise<MemoryEntry[]> {
      return [...store.values()]
        .filter((e) => {
          if (options.agentId !== undefined && e.agentId !== options.agentId) return false;
          if (options.scope !== undefined && e.scope !== options.scope) return false;
          return true;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, options.limit)
        .map(clone);
    },

    async forget(id: string): Promise<void> {
      store.delete(id);
    },

    async clear(): Promise<void> {
      store.clear();
    },
  };
}

function matchesQuery(entry: MemoryEntry, query: RecallQuery): boolean {
  if (query.agentId !== undefined && entry.agentId !== query.agentId) return false;
  if (query.scope !== undefined && entry.scope !== query.scope) return false;
  if (query.type !== undefined && entry.type !== query.type) return false;
  if (query.since !== undefined && entry.createdAt < query.since) return false;
  if (query.until !== undefined && entry.createdAt > query.until) return false;
  return true;
}

function clone(entry: MemoryEntry): MemoryEntry {
  return entry.metadata === undefined ? { ...entry } : { ...entry, metadata: { ...entry.metadata } };
}

function lexicalScore(query: string, content: string): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 0;
  const contentTokens = new Set(tokenize(content));
  let matches = 0;
  for (const token of tokens) {
    if (contentTokens.has(token)) matches++;
  }
  return matches / tokens.length;
}

function tokenize(input: string): string[] {
  return input.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}
