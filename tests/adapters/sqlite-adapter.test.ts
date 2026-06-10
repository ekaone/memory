import { describe, expect, it } from "vitest";
import { sqliteAdapter } from "../../src/adapters/sqlite-adapter.js";
import { baseTimestamp, fullEntry, laterTimestamp } from "../fixtures/entries.js";

async function makeAdapter() {
  const adapter = sqliteAdapter({ path: ":memory:" });
  await adapter.init?.();
  return adapter;
}

describe("sqliteAdapter", () => {
  it("init creates schema and write+recall works", async () => {
    const adapter = await makeAdapter();
    await adapter.write(fullEntry({ id: "a", content: "skill completed", scope: "episodic" }));

    const entries = await adapter.recall({ scope: "episodic" });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe("a");
  });

  it("recall filters by since/until", async () => {
    const adapter = await makeAdapter();
    await adapter.write(fullEntry({ id: "old", content: "old skill", scope: "episodic", createdAt: baseTimestamp }));
    await adapter.write(fullEntry({ id: "new", content: "new skill", scope: "episodic", createdAt: laterTimestamp }));

    const entries = await adapter.recall({ scope: "episodic", since: laterTimestamp });
    expect(entries.map((e) => e.id)).toEqual(["new"]);
  });

  it("recall filters by scope", async () => {
    const adapter = await makeAdapter();
    await adapter.write(fullEntry({ id: "e", content: "episodic", scope: "episodic" }));
    await adapter.write(fullEntry({ id: "w", content: "working", scope: "working" }));

    const episodic = await adapter.recall({ scope: "episodic" });
    expect(episodic.map((e) => e.id)).toEqual(["e"]);
  });

  it("recall without scope returns all entries", async () => {
    const adapter = await makeAdapter();
    await adapter.write(fullEntry({ id: "e", content: "episodic", scope: "episodic" }));
    await adapter.write(fullEntry({ id: "w", content: "working", scope: "working" }));

    const all = await adapter.recall();
    expect(all).toHaveLength(2);
  });

  it("metadata is JSON round-tripped", async () => {
    const adapter = await makeAdapter();
    await adapter.write(fullEntry({ id: "m", content: "with meta", scope: "episodic", metadata: { key: "value", num: 42 } }));

    const entries = await adapter.recall();
    expect(entries[0]?.metadata).toEqual({ key: "value", num: 42 });
  });

  it("search uses FTS5 to find entries", async () => {
    const adapter = await makeAdapter();
    await adapter.write(fullEntry({ id: "b", content: "billing refund policy", scope: "episodic" }));
    await adapter.write(fullEntry({ id: "w", content: "weather forecast", scope: "episodic" }));

    const results = await adapter.search("billing");
    expect(results.map((e) => e.id)).toEqual(["b"]);
  });

  it("search is lazy — works even after writes", async () => {
    const adapter = await makeAdapter();
    await adapter.write(fullEntry({ id: "a", content: "alpha entry", scope: "episodic" }));
    await adapter.search("alpha");
    await adapter.write(fullEntry({ id: "b", content: "beta entry", scope: "episodic" }));

    const results = await adapter.search("beta");
    expect(results.map((e) => e.id)).toContain("b");
  });

  it("recent returns entries in reverse-chronological order", async () => {
    const adapter = await makeAdapter();
    await adapter.write(fullEntry({ id: "old", content: "old", scope: "episodic", createdAt: baseTimestamp }));
    await adapter.write(fullEntry({ id: "new", content: "new", scope: "episodic", createdAt: laterTimestamp }));

    const entries = await adapter.recent({ limit: 1 });
    expect(entries[0]?.id).toBe("new");
  });

  it("forget removes entry", async () => {
    const adapter = await makeAdapter();
    await adapter.write(fullEntry({ id: "keep", content: "keep this", scope: "episodic" }));
    await adapter.write(fullEntry({ id: "drop", content: "drop this", scope: "episodic" }));
    await adapter.forget("drop");

    const entries = await adapter.recall();
    expect(entries.map((e) => e.id)).toEqual(["keep"]);
  });

  it("clear removes all entries", async () => {
    const adapter = await makeAdapter();
    await adapter.write(fullEntry({ id: "a", content: "one", scope: "episodic" }));
    await adapter.write(fullEntry({ id: "b", content: "two", scope: "episodic" }));
    await adapter.clear();

    await expect(adapter.recall()).resolves.toHaveLength(0);
  });
});
