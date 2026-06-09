import { InMemoryAdapter } from "../adapters/memory-adapter.js";
import type { MemoryAdapter } from "../adapters/types.js";
import type { MemoryEntry, MemoryStore, RecallOpts } from "../types.js";
import { assertNonEmptyString, cloneEntry, normalizeLimit, validateEntry, validateRecall } from "./validate-entry.js";

const DEFAULT_LIMIT = 10;

export function createMemory(adapter: MemoryAdapter = new InMemoryAdapter()): MemoryStore {
  return {
    async write(entry: MemoryEntry): Promise<void> {
      validateEntry(entry);
      await adapter.write(cloneEntry(entry));
    },

    async recall(query: string, opts: RecallOpts = {}): Promise<MemoryEntry[]> {
      validateRecall(query, opts);

      const limit = normalizeLimit(opts.limit, DEFAULT_LIMIT);
      if (limit === 0) {
        return [];
      }

      const entries = await adapter.recall(query, { ...opts, limit });
      return entries.slice(0, limit).map((entry) => cloneEntry(entry));
    },

    async forget(id: string): Promise<void> {
      assertNonEmptyString(id, "id");
      await adapter.forget(id);
    },
  };
}
