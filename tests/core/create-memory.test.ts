import { describe, expect, it } from "vitest";
import { createMemory, MemoryValidationError } from "../../src/index.js";
import { memoryAdapter } from "../../src/adapters/memory-adapter.js";

describe("createMemory", () => {
  it("auto-fills id and createdAt on remember", async () => {
    const memory = createMemory({ adapter: memoryAdapter() });
    const stored = await memory.remember({ content: "relayhouse context", scope: "working" });

    expect(stored.id).toBeTruthy();
    expect(stored.createdAt).toBeTruthy();
    expect(stored.content).toBe("relayhouse context");
  });

  it("recall returns stored entries", async () => {
    const memory = createMemory({ adapter: memoryAdapter() });
    await memory.remember({ content: "approval context", scope: "working" });

    await expect(memory.recall()).resolves.toMatchObject([{ content: "approval context" }]);
  });

  it("rejects empty content before reaching the adapter", async () => {
    const memory = createMemory({ adapter: memoryAdapter() });

    await expect(memory.remember({ content: "" })).rejects.toBeInstanceOf(MemoryValidationError);
  });

  it("forget removes a specific entry by id", async () => {
    const memory = createMemory({ adapter: memoryAdapter() });
    const a = await memory.remember({ content: "keep this", scope: "working" });
    await memory.remember({ content: "drop this", scope: "working" });
    await memory.forget(a.id);

    const entries = await memory.recall();
    expect(entries.every((e) => e.id !== a.id)).toBe(true);
  });

  it("clear empties all entries", async () => {
    const memory = createMemory({ adapter: memoryAdapter() });
    await memory.remember({ content: "one", scope: "working" });
    await memory.remember({ content: "two", scope: "working" });
    await memory.clear();

    await expect(memory.recall()).resolves.toEqual([]);
  });

  it("search returns lexically matched entries", async () => {
    const memory = createMemory({ adapter: memoryAdapter() });
    await memory.remember({ content: "billing refund policy", scope: "working" });
    await memory.remember({ content: "weather forecast preference", scope: "working" });

    const results = await memory.search("billing");
    expect(results).toHaveLength(1);
    expect(results[0]?.content).toBe("billing refund policy");
  });

  it("recent returns entries in reverse-chronological order", async () => {
    const adapter = memoryAdapter();

    await adapter.write({ id: "old", content: "first", scope: "working", createdAt: "2025-01-01T00:00:00.000Z" });
    await adapter.write({ id: "new", content: "second", scope: "working", createdAt: "2025-01-02T00:00:00.000Z" });

    const memory = createMemory({ adapter });
    const entries = await memory.recent({ limit: 1 });
    expect(entries[0]?.content).toBe("second");
  });
});
