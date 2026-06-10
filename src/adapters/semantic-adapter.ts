import type { EmbedProvider } from "../embed/types.js";
import { MemoryValidationError, type MemoryEntry, type RecallQuery, type RecentOptions, type SearchOptions } from "../types.js";
import { cosineSimilarity } from "../utils/cosine.js";
import type { MemoryAdapter } from "./types.js";

const DEFAULT_SCOPE = "semantic" as const;

export type SemanticAdapterOptions = {
  embed: EmbedProvider;
};

export function semanticAdapter(options: SemanticAdapterOptions): MemoryAdapter {
  const { embed: embedProvider } = options;
  const store = new Map<string, MemoryEntry>();
  const vectors = new Map<string, number[]>();

  return {
    async write(entry: MemoryEntry): Promise<MemoryEntry> {
      const vec = normalizeVector(await embedProvider.embed(entry.content));
      const stored = clone({ ...entry, scope: entry.scope ?? DEFAULT_SCOPE });
      store.set(entry.id, stored);
      vectors.set(entry.id, vec);
      return clone(stored);
    },

    async recall(query: RecallQuery = {}): Promise<MemoryEntry[]> {
      return [...store.values()]
        .filter((e) => {
          if (query.agentId !== undefined && e.agentId !== query.agentId) return false;
          if (query.scope !== undefined && e.scope !== query.scope) return false;
          if (query.type !== undefined && e.type !== query.type) return false;
          if (query.since !== undefined && e.createdAt < query.since) return false;
          if (query.until !== undefined && e.createdAt > query.until) return false;
          return true;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, query.limit)
        .map(clone);
    },

    async search(text: string, options: SearchOptions = {}): Promise<MemoryEntry[]> {
      if (text.trim().length === 0) return [];

      const queryVec = normalizeVector(await embedProvider.embed(text));
      const scored: { entry: MemoryEntry; score: number }[] = [];

      for (const entry of store.values()) {
        if (options.agentId !== undefined && entry.agentId !== options.agentId) continue;
        if (options.scope !== undefined && entry.scope !== options.scope) continue;

        const vec = vectors.get(entry.id);
        if (vec === undefined) continue;

        const score = cosineSimilarity(queryVec, vec);
        const threshold = options.threshold ?? 0;
        if (score > 0 && score >= threshold) {
          scored.push({ entry, score });
        }
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
      vectors.delete(id);
    },

    async clear(): Promise<void> {
      store.clear();
      vectors.clear();
    },
  };
}

function normalizeVector(vec: number[]): number[] {
  if (vec.length === 0) {
    throw new MemoryValidationError("embed provider returned an empty vector.");
  }
  for (const v of vec) {
    if (!Number.isFinite(v)) {
      throw new MemoryValidationError("embed provider returned a non-finite value.");
    }
  }
  return [...vec];
}

function clone(entry: MemoryEntry): MemoryEntry {
  return entry.metadata === undefined ? { ...entry } : { ...entry, metadata: { ...entry.metadata } };
}
