import { describe, expect, it } from "vitest";
import { memoryAdapter } from "../../src/adapters/memory-adapter.js";
import { baseTimestamp, fullEntry, laterTimestamp } from "../fixtures/entries.js";

describe("memoryAdapter", () => {
  it("writes and recalls entries", async () => {
    const adapter = memoryAdapter();
    await adapter.write(fullEntry({ id: "a", content: "agent working notes" }));

    const entries = await adapter.recall();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("a");
  });

  it("recall filters by scope", async () => {
    const adapter = memoryAdapter();
    await adapter.write(fullEntry({ id: "w", content: "working", scope: "working" }));
    await adapter.write(fullEntry({ id: "e", content: "episodic", scope: "episodic" }));

    const working = await adapter.recall({ scope: "working" });
    expect(working.map((e) => e.id)).toEqual(["w"]);

    const episodic = await adapter.recall({ scope: "episodic" });
    expect(episodic.map((e) => e.id)).toEqual(["e"]);
  });

  it("recall filters by since/until", async () => {
    const adapter = memoryAdapter();
    await adapter.write(fullEntry({ id: "old", content: "old", createdAt: baseTimestamp }));
    await adapter.write(fullEntry({ id: "new", content: "new", createdAt: laterTimestamp }));

    const results = await adapter.recall({ since: laterTimestamp });
    expect(results.map((e) => e.id)).toEqual(["new"]);
  });

  it("recall limits results", async () => {
    const adapter = memoryAdapter();
    await adapter.write(fullEntry({ id: "a", content: "first", createdAt: baseTimestamp }));
    await adapter.write(fullEntry({ id: "b", content: "second", createdAt: laterTimestamp }));

    const entries = await adapter.recall({ limit: 1 });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("b");
  });

  it("forget removes a specific entry", async () => {
    const adapter = memoryAdapter();
    await adapter.write(fullEntry({ id: "keep", content: "approval accepted" }));
    await adapter.write(fullEntry({ id: "remove", content: "approval rejected" }));
    await adapter.forget("remove");

    const entries = await adapter.recall();
    expect(entries.map((e) => e.id)).toEqual(["keep"]);
  });

  it("search returns lexically matched entries", async () => {
    const adapter = memoryAdapter();
    await adapter.write(fullEntry({ id: "x", content: "billing refund policy" }));
    await adapter.write(fullEntry({ id: "y", content: "weather forecast" }));

    const results = await adapter.search("billing");
    expect(results.map((e) => e.id)).toEqual(["x"]);
  });

  it("search returns empty array for empty text", async () => {
    const adapter = memoryAdapter();
    await adapter.write(fullEntry({ id: "a", content: "some content" }));

    await expect(adapter.search("")).resolves.toEqual([]);
  });

  it("recent returns entries in reverse-chronological order", async () => {
    const adapter = memoryAdapter();
    await adapter.write(fullEntry({ id: "old", content: "old", createdAt: baseTimestamp }));
    await adapter.write(fullEntry({ id: "new", content: "new", createdAt: laterTimestamp }));

    const entries = await adapter.recent({ limit: 1 });
    expect(entries[0]?.id).toBe("new");
  });

  it("clear empties the store", async () => {
    const adapter = memoryAdapter();
    await adapter.write(fullEntry({ id: "a", content: "hello" }));
    await adapter.clear();

    await expect(adapter.recall()).resolves.toEqual([]);
  });

  it("metadata is cloned on write and recall", async () => {
    const adapter = memoryAdapter();
    const original = fullEntry({ id: "m", content: "meta test", metadata: { mutable: true } });

    await adapter.write(original);
    original.metadata = { mutable: false };

    const entries = await adapter.recall();
    expect(entries[0]?.metadata).toEqual({ mutable: true });
  });
});
