import { describe, expect, it } from "vitest";
import { semanticAdapter } from "../../src/adapters/semantic-adapter.js";
import type { EmbedProvider } from "../../src/embed/types.js";
import { baseTimestamp, fullEntry, laterTimestamp } from "../fixtures/entries.js";

function fakeEmbedProvider(): EmbedProvider {
  return {
    async embed(input) {
      if (input.includes("billing")) return [1, 0];
      if (input.includes("weather")) return [0, 1];
      return [0, 0];
    },
  };
}

describe("semanticAdapter", () => {
  it("embeds entries on write and searches with cosine similarity", async () => {
    const calls: string[] = [];
    const embed: EmbedProvider = {
      async embed(input) {
        calls.push(input);
        if (input.includes("billing")) return [1, 0];
        if (input.includes("weather")) return [0, 1];
        return [0, 0];
      },
    };
    const adapter = semanticAdapter({ embed });

    await adapter.write(fullEntry({ id: "billing", content: "billing refund policy", scope: "semantic" }));
    await adapter.write(fullEntry({ id: "weather", content: "weather forecast preference", scope: "semantic" }));

    expect(calls).toEqual(["billing refund policy", "weather forecast preference"]);

    const results = await adapter.search("billing question", { threshold: 0.9 });
    expect(results.map((e) => e.id)).toEqual(["billing"]);
    expect(calls).toHaveLength(3);
  });

  it("recall is structured — filters by scope, agentId, since/until", async () => {
    const adapter = semanticAdapter({ embed: fakeEmbedProvider() });

    await adapter.write(fullEntry({ id: "a", content: "billing", scope: "semantic", agentId: "agent-x", createdAt: baseTimestamp }));
    await adapter.write(fullEntry({ id: "b", content: "weather", scope: "semantic", agentId: "agent-y", createdAt: laterTimestamp }));

    const byAgent = await adapter.recall({ agentId: "agent-x" });
    expect(byAgent.map((e) => e.id)).toEqual(["a"]);

    const bySince = await adapter.recall({ since: laterTimestamp });
    expect(bySince.map((e) => e.id)).toEqual(["b"]);
  });

  it("recent returns entries in reverse-chronological order", async () => {
    const adapter = semanticAdapter({ embed: fakeEmbedProvider() });

    await adapter.write(fullEntry({ id: "old", content: "billing", scope: "semantic", createdAt: baseTimestamp }));
    await adapter.write(fullEntry({ id: "new", content: "weather", scope: "semantic", createdAt: laterTimestamp }));

    const entries = await adapter.recent({ limit: 1 });
    expect(entries[0]?.id).toBe("new");
  });

  it("forget removes entry and its vector", async () => {
    const adapter = semanticAdapter({ embed: fakeEmbedProvider() });

    await adapter.write(fullEntry({ id: "keep", content: "billing", scope: "semantic" }));
    await adapter.write(fullEntry({ id: "drop", content: "weather", scope: "semantic" }));
    await adapter.forget("drop");

    const results = await adapter.search("weather", { threshold: 0.5 });
    expect(results.map((e) => e.id)).not.toContain("drop");
  });

  it("clear removes all entries and vectors", async () => {
    const adapter = semanticAdapter({ embed: fakeEmbedProvider() });

    await adapter.write(fullEntry({ id: "a", content: "billing", scope: "semantic" }));
    await adapter.clear();

    await expect(adapter.recall()).resolves.toHaveLength(0);
  });

  it("search returns empty for empty text", async () => {
    const adapter = semanticAdapter({ embed: fakeEmbedProvider() });
    await adapter.write(fullEntry({ id: "a", content: "billing", scope: "semantic" }));

    await expect(adapter.search("")).resolves.toEqual([]);
  });
});
