import type { MemoryEntry, RecallOpts } from "../types.js";

export type MemoryAdapter = {
  write(entry: MemoryEntry): Promise<void>;
  recall(query: string, opts?: RecallOpts): Promise<MemoryEntry[]>;
  forget(id: string): Promise<void>;
};
