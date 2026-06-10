import type { MemoryEntry, RecallQuery, RecentOptions, SearchOptions } from "../types.js";

export type MemoryAdapter = {
  init?(): Promise<void>;
  write(entry: MemoryEntry): Promise<MemoryEntry>;
  recall(query?: RecallQuery): Promise<MemoryEntry[]>;
  search(text: string, options?: SearchOptions): Promise<MemoryEntry[]>;
  recent(options?: RecentOptions): Promise<MemoryEntry[]>;
  forget(id: string): Promise<void>;
  clear(): Promise<void>;
};
