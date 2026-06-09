import { describe, expect, it } from "vitest";
import { InMemoryAdapter } from "../../src/adapters/memory-adapter.js";
import { baseTimestamp, entry } from "../fixtures/entries.js";

describe("InMemoryAdapter", () => {
  it("stores and recalls working scope entries", async () => {
    const adapter = new InMemoryAdapter();

    await adapter.write(entry({ id: "older", content: "agent working notes", createdAt: baseTimestamp }));
    await adapter.write(entry({ id: "newer", content: "agent working notes", createdAt: baseTimestamp + 1 }));

    await expect(ids(await adapter.recall("working", { limit: 1 }))).toEqual(["newer"]);
  });

  it("ignores non-working scopes", async () => {
    const adapter = new InMemoryAdapter();

    await adapter.write(entry({ id: "semantic", scope: "semantic", content: "durable knowledge" }));

    await expect(adapter.recall("durable")).resolves.toEqual([]);
  });

  it("forgets entries by id", async () => {
    const adapter = new InMemoryAdapter();

    await adapter.write(entry({ id: "keep", content: "approval accepted" }));
    await adapter.write(entry({ id: "remove", content: "approval rejected" }));
    await adapter.forget("remove");

    await expect(ids(await adapter.recall("approval"))).toEqual(["keep"]);
  });
});

function ids(entries: readonly { id: string }[]): string[] {
  return entries.map(({ id }) => id);
}
