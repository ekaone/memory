import type { MemoryEntry, MemoryScope, NewMemoryEntry } from "../../src/index.js";

export const baseTimestamp = "2025-01-01T00:00:00.000Z";
export const laterTimestamp = "2025-01-01T00:01:00.000Z";

export function newEntry(
  overrides: Partial<NewMemoryEntry> & Pick<NewMemoryEntry, "content">,
): NewMemoryEntry {
  return {
    scope: "working",
    ...overrides,
  };
}

export function fullEntry(
  overrides: Partial<MemoryEntry> & Pick<MemoryEntry, "id" | "content">,
): MemoryEntry {
  return {
    scope: "working",
    createdAt: baseTimestamp,
    ...overrides,
  };
}

export function scopedFullEntry(scope: MemoryScope, id: string, content: string): MemoryEntry {
  return fullEntry({ id, scope, content });
}
