import { describe, expect, it } from "vitest";
import { SQLiteAdapter } from "../../src/adapters/sqlite-adapter.js";
import { baseTimestamp, entry } from "../fixtures/entries.js";

describe("SQLiteAdapter", () => {
  it("stores episodic entries and applies timestamp filters", async () => {
    const adapter = new SQLiteAdapter();

    await adapter.write(entry({ id: "old", scope: "episodic", content: "skill completed", createdAt: baseTimestamp - 1 }));
    await adapter.write(entry({ id: "new", scope: "episodic", content: "skill completed", createdAt: baseTimestamp + 1 }));

    await expect(ids(await adapter.recall("skill", { since: baseTimestamp }))).toEqual(["new"]);
  });

  it("ignores non-episodic entries", async () => {
    const adapter = new SQLiteAdapter();

    await adapter.write(entry({ id: "working", scope: "working", content: "temporary skill state" }));

    await expect(adapter.recall("temporary")).resolves.toEqual([]);
  });
});

function ids(entries: readonly { id: string }[]): string[] {
  return entries.map(({ id }) => id);
}
