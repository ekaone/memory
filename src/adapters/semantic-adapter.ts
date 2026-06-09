import { StubEmbedProvider } from "../embed/stub-embed.js";
import type { EmbedProvider } from "../embed/types.js";
import { MemoryValidationError, type MemoryEntry, type RecallOpts } from "../types.js";
import { cosineSimilarity } from "../utils/cosine.js";
import type { MemoryAdapter } from "./types.js";

export class SemanticAdapter implements MemoryAdapter {
  readonly #entries = new Map<string, MemoryEntry>();
  readonly #vectors = new Map<string, readonly number[]>();
  readonly #embedProvider: EmbedProvider;

  constructor(embedProvider: EmbedProvider = new StubEmbedProvider()) {
    this.#embedProvider = embedProvider;
  }

  async write(entry: MemoryEntry): Promise<void> {
    if (entry.scope !== "semantic") {
      return;
    }

    this.#entries.set(entry.id, cloneEntry(entry));
    this.#vectors.set(entry.id, normalizeVector(await this.#embedProvider.embed(entry.content)));
  }

  async recall(query: string, opts: RecallOpts = {}): Promise<MemoryEntry[]> {
    if (opts.scope !== undefined && opts.scope !== "semantic") {
      return [];
    }

    if (query.trim().length === 0) {
      return this.#allEntries(opts);
    }

    const queryVector = normalizeVector(await this.#embedProvider.embed(query));
    const scored: ScoredEntry[] = [];

    for (const entry of this.#entries.values()) {
      if (opts.since !== undefined && entry.createdAt < opts.since) {
        continue;
      }

      const vector = this.#vectors.get(entry.id);
      const score = vector === undefined ? 0 : cosineSimilarity(queryVector, vector);
      const threshold = opts.threshold ?? 0;
      if (score > 0 && score >= threshold) {
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
    this.#vectors.delete(id);
  }

  #allEntries(opts: RecallOpts): MemoryEntry[] {
    return [...this.#entries.values()]
      .filter((entry) => opts.since === undefined || entry.createdAt >= opts.since)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, opts.limit)
      .map((entry) => cloneEntry(entry));
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

function normalizeVector(vector: readonly number[]): readonly number[] {
  if (vector.length === 0) {
    throw new MemoryValidationError("embed provider returned an empty vector.");
  }

  for (const value of vector) {
    if (!Number.isFinite(value)) {
      throw new MemoryValidationError("embed provider returned a non-finite value.");
    }
  }

  return [...vector];
}

function cloneEntry(entry: MemoryEntry): MemoryEntry {
  if (entry.metadata === undefined) {
    return { ...entry };
  }

  return { ...entry, metadata: { ...entry.metadata } };
}
