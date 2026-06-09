import { describe, expect, it } from "vitest";
import { SemanticAdapter } from "../../src/adapters/semantic-adapter.js";
import type { EmbedProvider } from "../../src/embed/types.js";
import { entry } from "../fixtures/entries.js";

describe("SemanticAdapter", () => {
  it("embeds semantic memories and applies recall thresholds", async () => {
    const calls: string[] = [];
    const embedProvider: EmbedProvider = {
      async embed(input) {
        calls.push(input);
        if (input.includes("billing")) {
          return [1, 0];
        }

        if (input.includes("weather")) {
          return [0, 1];
        }

        return [0, 0];
      },
    };
    const adapter = new SemanticAdapter(embedProvider);

    await adapter.write(entry({ id: "billing", scope: "semantic", content: "billing refund policy" }));
    await adapter.write(entry({ id: "weather", scope: "semantic", content: "weather forecast preference" }));

    expect(calls).toEqual(["billing refund policy", "weather forecast preference"]);
    await expect(ids(await adapter.recall("billing question", { threshold: 0.9 }))).toEqual(["billing"]);
    expect(calls).toEqual(["billing refund policy", "weather forecast preference", "billing question"]);
  });

  it("ignores non-semantic entries", async () => {
    const adapter = new SemanticAdapter();

    await adapter.write(entry({ id: "working", scope: "working", content: "temporary context" }));

    await expect(adapter.recall("temporary")).resolves.toEqual([]);
  });
});

function ids(entries: readonly { id: string }[]): string[] {
  return entries.map(({ id }) => id);
}
