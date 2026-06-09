import { describe, expect, it } from "vitest";
import { createMemory, MemoryValidationError } from "../../src/index.js";
import { InMemoryAdapter } from "../../src/adapters/memory-adapter.js";
import { entry } from "../fixtures/entries.js";

describe("createMemory", () => {
  it("wraps an adapter with validation and cloning", async () => {
    const memory = createMemory(new InMemoryAdapter());
    const original = entry({
      id: "working-1",
      content: "approval context",
      metadata: { mutable: true },
    });

    await memory.write(original);
    original.metadata = { mutable: false };

    await expect(memory.recall("approval")).resolves.toMatchObject([
      {
        id: "working-1",
        metadata: { mutable: true },
      },
    ]);
  });

  it("uses the working in-memory adapter by default", async () => {
    const memory = createMemory();

    await memory.write(entry({ id: "default", content: "relayhouse working context" }));

    await expect(memory.recall("relayhouse")).resolves.toMatchObject([{ id: "default" }]);
  });

  it("rejects invalid memory entries before they reach the adapter", async () => {
    const memory = createMemory();

    await expect(memory.write(entry({ id: "", content: "invalid" }))).rejects.toBeInstanceOf(
      MemoryValidationError,
    );
  });
});
