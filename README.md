# @ekaone/memory

A small TypeScript memory interface for agents.

`@ekaone/memory` gives agents one consistent read/write API while keeping memory scopes separate:

- `working`: in-flight context for the current run
- `episodic`: what happened in previous sessions
- `semantic`: durable knowledge retrieved by similarity

## What Is It?

`@ekaone/memory` is a lightweight memory layer for agent runtimes. It defines the shared types, validation, and `MemoryStore` API and related `@ekaone/*` packages can wire into agents at spawn time.

The package does not force every kind of memory into one generic store. Working, episodic, and semantic memory have different access patterns, so they stay distinct behind a common interface.

## Main Purpose

The main purpose is to provide a stable contract for agent memory:

- Write memory entries with an explicit `agentId` and `scope`
- Recall entries with optional scope, time, limit, and similarity filters
- Forget entries by id
- Keep the core API dependency-free
- Let the runtime choose the right adapter from `AgentManifest.memoryScope`

The OS decides which adapter to wire into an agent. The package root only exposes the core API. Concrete adapters live behind their own module boundaries.

## Installation

```bash
npm install @ekaone/memory
```

```bash
yarn add @ekaone/memory
```

```bash
pnpm add @ekaone/memory
```

## Quick Start

```ts
import { createMemory } from "@ekaone/memory";

const memory = createMemory();

await memory.write({
  id: "entry_1",
  agentId: "agent_a",
  scope: "working",
  content: "User prefers concise summaries.",
  createdAt: Date.now(),
});

const results = await memory.recall("summaries", {
  scope: "working",
  limit: 5,
});

await memory.forget("entry_1");
```

By default, `createMemory()` uses the bundled in-memory adapter for the `working` scope.

## API

### `createMemory(adapter?)`

Creates a `MemoryStore`.

```ts
import { createMemory } from "@ekaone/memory";
import type { MemoryStore } from "@ekaone/memory";

const memory: MemoryStore = createMemory();
```

You can pass a custom adapter when the runtime wants to wire a different backing store:

```ts
import { createMemory } from "@ekaone/memory";
import { InMemoryAdapter } from "./src/adapters/memory-adapter.js";

const memory = createMemory(new InMemoryAdapter());
```

The package root intentionally does not export adapters. This keeps the public core small and prevents optional dependencies, such as SQLite, from being pulled in by default.

### `MemoryStore`

```ts
type MemoryStore = {
  write(entry: MemoryEntry): Promise<void>;
  recall(query: string, opts?: RecallOpts): Promise<MemoryEntry[]>;
  forget(id: string): Promise<void>;
};
```

### `MemoryEntry`

```ts
type MemoryEntry = {
  id: string;
  agentId: string;
  scope: MemoryScope;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
};
```

### `MemoryScope`

```ts
type MemoryScope = "working" | "episodic" | "semantic";
```

### `RecallOpts`

```ts
type RecallOpts = {
  scope?: MemoryScope;
  limit?: number;
  since?: number;
  threshold?: number;
};
```

Options:

- `scope`: restrict recall to one memory scope
- `limit`: maximum number of entries to return
- `since`: only return entries created at or after this timestamp
- `threshold`: similarity threshold for semantic recall

## Memory Scopes

### Working Memory

Working memory is for short-lived context during the current conversation or agent run.

The bundled default adapter is an in-memory `working` adapter. It is useful for tests, local development, and runtime-owned context.

### Episodic Memory

Episodic memory is for session history: events, decisions, approvals, and other things that happened over time.

The SQLite adapter is designed for this scope and can use SQLite FTS5 for text retrieval. It should be imported only at the adapter boundary so the core package does not require SQLite.

### Semantic Memory

Semantic memory is for durable knowledge retrieved by vector similarity.

The semantic adapter accepts a pluggable embed provider. The test/default provider is a zero-dependency hash stub. Production runtimes can provide OpenAI or another embedding provider.

## Project Structure

```text
src/
  index.ts
  types.ts
  core/
    create-memory.ts
    validate-entry.ts
  adapters/
    types.ts
    memory-adapter.ts
    sqlite-adapter.ts
    semantic-adapter.ts
  embed/
    types.ts
    stub-embed.ts
    openai-embed.ts
  utils/
    cosine.ts
    id.ts
    timestamp.ts
```

## Design Notes

- The root export is intentionally small: core types plus `createMemory()`.
- The core path has no runtime dependencies.
- `better-sqlite3` is loaded only by the SQLite adapter boundary.
- Semantic recall is embedding-provider driven.
- `stub-embed.ts` keeps tests deterministic and zero-dependency.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```

## License

MIT (c) [Eka Prasetia](./LICENSE)

## Links

- [npm Package](https://www.npmjs.com/package/@ekaone/memory)
- [GitHub Repository](https://github.com/ekaone/memory)
- [Issue Tracker](https://github.com/ekaone/memory/issues)
