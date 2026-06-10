import type { MemoryAdapter } from "../adapters/types.js";
import type {
  MemoryEntry,
  MemoryStore,
  NewMemoryEntry,
  RecallQuery,
  RecentOptions,
  SearchOptions,
} from "../types.js";
import { createMemoryId } from "../utils/id.js";
import { nowIso } from "../utils/timestamp.js";
import { assertNonEmptyString, validateNewEntry } from "./validate-entry.js";

export type MemoryConfig = {
  adapter?: MemoryAdapter;
};

export function createMemory(config?: MemoryConfig): MemoryStore {
  const ready = resolveAdapter(config?.adapter);

  return {
    async remember(entry: NewMemoryEntry): Promise<MemoryEntry> {
      validateNewEntry(entry);
      const adapter = await ready;
      const now = nowIso();
      const fullEntry: MemoryEntry = { ...entry, id: createMemoryId(), createdAt: now, updatedAt: now };
      return adapter.write(fullEntry);
    },

    async recall(query?: RecallQuery): Promise<MemoryEntry[]> {
      const adapter = await ready;
      return adapter.recall(query);
    },

    async search(text: string, options?: SearchOptions): Promise<MemoryEntry[]> {
      const adapter = await ready;
      return adapter.search(text, options);
    },

    async recent(options?: RecentOptions): Promise<MemoryEntry[]> {
      const adapter = await ready;
      return adapter.recent(options);
    },

    async forget(id: string): Promise<void> {
      assertNonEmptyString(id, "id");
      const adapter = await ready;
      return adapter.forget(id);
    },

    async clear(): Promise<void> {
      const adapter = await ready;
      return adapter.clear();
    },
  };
}

async function resolveAdapter(adapter?: MemoryAdapter): Promise<MemoryAdapter> {
  if (adapter !== undefined) {
    await adapter.init?.();
    return adapter;
  }

  const { sqliteAdapter } = await import("../adapters/sqlite-adapter.js");
  const resolved = sqliteAdapter();
  await resolved.init?.();
  return resolved;
}
