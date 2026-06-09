import type { MemoryEntry, MemoryScope } from "../../src/index.js";

export const baseTimestamp = 1_775_000_000_000;

export function entry(
  overrides: Partial<MemoryEntry> & Pick<MemoryEntry, "id" | "content">,
): MemoryEntry {
  return {
    agentId: "agent-a",
    scope: "working",
    createdAt: baseTimestamp,
    ...overrides,
  };
}

export function scopedEntry(scope: MemoryScope, id: string, content: string): MemoryEntry {
  return entry({ id, scope, content });
}
