# @ekaone/memory

A pluggable, production-ready memory layer for agent runtimes.

`@ekaone/memory` gives agents one consistent API across three memory scopes while keeping their backing stores separate and swappable:

- **`working`** — in-flight context for the current run (in-memory adapter)
- **`episodic`** — session history and past decisions (SQLite + FTS5 adapter)
- **`semantic`** — durable knowledge retrieved by similarity (vector adapter)

---

## Installation

```bash
npm install @ekaone/memory
# or
pnpm add @ekaone/memory
# or
yarn add @ekaone/memory
```

The default `createMemory()` uses **SQLite** under the hood. Install `better-sqlite3` as a peer:

```bash
npm install better-sqlite3
```

If you only need the in-memory or semantic adapter in an environment without SQLite, pass an explicit adapter — no peer dependency required.

---

## Quick Start

```ts
import { createMemory } from "@ekaone/memory";

// Zero-config — SQLite at .memory/memory.db
const memory = createMemory();

// Store a memory
const entry = await memory.remember({
  content: "User prefers concise summaries.",
  agentId: "agent-a",
  scope: "working",
  type: "preference",
  metadata: { source: "onboarding" },
});

// Structured recall
const recent = await memory.recall({
  agentId: "agent-a",
  scope: "working",
  limit: 10,
});

// Full-text search
const results = await memory.search("summaries", {
  scope: "working",
  limit: 5,
});

// Time-ordered fetch
const latest = await memory.recent({ limit: 3 });

// Remove a specific entry
await memory.forget(entry.id);

// Wipe everything (useful in tests)
await memory.clear();
```

---

## Adapters

Adapters are imported from subpaths so the package root stays dependency-free.

### In-memory adapter (working scope)

Fast and ephemeral — lives only for the current process. Ideal for tests and short-lived agent runs.

```ts
import { createMemory } from "@ekaone/memory";
import { memoryAdapter } from "@ekaone/memory/memory";

const memory = createMemory({ adapter: memoryAdapter() });
```

### SQLite adapter (episodic scope) — **default**

Persistent, structured storage with full-text search via FTS5. Auto-creates the directory and schema on first use.

```ts
import { createMemory } from "@ekaone/memory";
import { sqliteAdapter } from "@ekaone/memory/sqlite";

// Custom path
const memory = createMemory({
  adapter: sqliteAdapter({ path: "./data/agents.db" }),
});

// Zero-config (same as createMemory())
const memory = createMemory({
  adapter: sqliteAdapter(), // defaults to .memory/memory.db
});
```

### Semantic adapter (semantic scope)

Vector similarity search with a caller-supplied embed function. Works with any embedding provider — OpenAI, Cohere, Ollama, local ONNX, etc.

```ts
import { createMemory } from "@ekaone/memory";
import { semanticAdapter } from "@ekaone/memory/semantic";

// OpenAI embeddings
const memory = createMemory({
  adapter: semanticAdapter({
    embed: {
      embed: (text) =>
        openai.embeddings
          .create({ model: "text-embedding-3-small", input: text })
          .then((r) => r.data[0].embedding),
    },
  }),
});

// Ollama / local model — same pattern
const memory = createMemory({
  adapter: semanticAdapter({
    embed: { embed: (text) => ollamaClient.embed(text) },
  }),
});
```

Embed types for building your own provider:

```ts
import type { EmbedFn, EmbedProvider } from "@ekaone/memory/embed";
```

---

## API Reference

### `createMemory(config?)`

Returns a `MemoryStore`. Automatically calls `adapter.init()` if the adapter defines it.

```ts
import { createMemory } from "@ekaone/memory";
import type { MemoryConfig, MemoryStore } from "@ekaone/memory";

// Default: SQLite at .memory/memory.db
const memory: MemoryStore = createMemory();

// Custom adapter
const memory = createMemory({ adapter: myAdapter });
```

---

### `MemoryStore`

```ts
type MemoryStore = {
  remember(entry: NewMemoryEntry): Promise<MemoryEntry>;
  recall(query?: RecallQuery): Promise<MemoryEntry[]>;
  search(text: string, options?: SearchOptions): Promise<MemoryEntry[]>;
  recent(options?: RecentOptions): Promise<MemoryEntry[]>;
  forget(id: string): Promise<void>;
  clear(): Promise<void>;
};
```

#### `remember(entry)`

Stores a new memory. Auto-fills `id` (nanoid-style), `createdAt`, and `updatedAt` (ISO 8601).

```ts
const stored = await memory.remember({
  content: "Approved the billing refund.",
  agentId: "agent-a",
  scope: "episodic",
  type: "decision",
  metadata: { ticketId: "BL-42" },
});

console.log(stored.id);        // "V8nQ3Tz..."
console.log(stored.createdAt); // "2025-06-10T10:16:51.234Z"
```

#### `recall(query?)`

Structured query — filters by scope, agentId, type, and time range. Returns entries in reverse-chronological order.

```ts
const entries = await memory.recall({
  agentId: "agent-a",
  scope: "episodic",
  type: "decision",
  since: "2025-06-01T00:00:00.000Z",
  until: "2025-06-30T23:59:59.999Z",
  limit: 20,
});
```

#### `search(text, options?)`

Text-driven search. SQLite adapter uses FTS5; semantic adapter uses cosine similarity. The FTS5 index is initialized lazily on first `search()` call.

```ts
const results = await memory.search("billing refund", {
  scope: "episodic",
  agentId: "agent-a",
  limit: 10,
});

// Semantic search with similarity threshold
const similar = await memory.search("payment policy", {
  scope: "semantic",
  threshold: 0.8,
  limit: 5,
});
```

#### `recent(options?)`

Fetches the most recent entries. Equivalent to `recall` without text or time-range filters, but with an explicit ergonomic name.

```ts
const latest = await memory.recent({
  scope: "working",
  agentId: "agent-a",
  limit: 5,
});
```

#### `forget(id)`

Removes a single entry by id.

```ts
await memory.forget("V8nQ3Tz...");
```

#### `clear()`

Removes all entries. Useful for test teardown and session reset.

```ts
await memory.clear();
```

---

### Types

#### `MemoryEntry`

```ts
type MemoryEntry = {
  id: string;
  agentId?: string;       // optional — Agent OS wires this; standalone callers omit
  scope?: MemoryScope;    // optional — defaults per adapter on write
  type?: string;          // free-form category: "decision" | "preference" | "incident" | …
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];   // stored by semantic adapter; ignored by others
  createdAt: string;      // ISO 8601
  updatedAt?: string;     // ISO 8601
};
```

#### `NewMemoryEntry`

The shape passed to `remember()`. The store auto-fills `id`, `createdAt`, and `updatedAt`.

```ts
type NewMemoryEntry = Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">;
```

#### `MemoryScope`

```ts
type MemoryScope = "working" | "episodic" | "semantic";
```

#### `RecallQuery`

```ts
type RecallQuery = {
  agentId?: string;
  scope?: MemoryScope;
  type?: string;
  limit?: number;
  since?: string;   // ISO 8601
  until?: string;   // ISO 8601
};
```

#### `SearchOptions`

```ts
type SearchOptions = {
  agentId?: string;
  scope?: MemoryScope;
  limit?: number;
  threshold?: number;  // similarity threshold — semantic adapter only
};
```

#### `RecentOptions`

```ts
type RecentOptions = {
  agentId?: string;
  scope?: MemoryScope;
  limit?: number;
};
```

#### `EmbedProvider`

```ts
type EmbedFn = (text: string) => Promise<number[]>;

type EmbedProvider = {
  embed: EmbedFn;
};
```

---

## SQLite Schema

The SQLite adapter creates this schema on `init()`:

```sql
CREATE TABLE IF NOT EXISTS memories (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT,
  scope       TEXT,
  type        TEXT,
  content     TEXT NOT NULL,
  metadata    TEXT,             -- JSON string
  created_at  TEXT NOT NULL,    -- ISO 8601
  updated_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_agent_id   ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_scope       ON memories(scope);
CREATE INDEX IF NOT EXISTS idx_memories_type        ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_created_at  ON memories(created_at);

CREATE TABLE IF NOT EXISTS embeddings (
  memory_id   TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
  vector      TEXT NOT NULL     -- JSON array of numbers
);

-- FTS5 virtual table — created lazily on first search() call
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(id UNINDEXED, content);
```

`metadata` is stored as a JSON string and round-tripped automatically. The FTS5 index is created the first time `search()` is called and populated from existing rows, so writes before the first search are always indexed.

---

## Memory Scopes

### Working Memory

Short-lived context for the current run. Backed by a plain `Map` — fast, zero I/O, cleared when the process ends. Use for tool call results, scratchpad notes, and intermediate state.

### Episodic Memory

Session history and past events. Backed by SQLite with FTS5 full-text search. Data persists across runs. Use for decisions, approvals, and anything that "happened" and needs to be recalled later.

### Semantic Memory

Durable knowledge retrieved by vector similarity. Backed by cosine similarity over stored embeddings. Use for policy documents, preference profiles, and reference knowledge that should be found by meaning rather than exact words.

---

## Scope Defaults per Adapter

When an entry is written without an explicit `scope`, each adapter assigns its own default:

| Adapter | Default scope |
|---|---|
| `memoryAdapter()` | `working` |
| `sqliteAdapter()` | `episodic` |
| `semanticAdapter()` | `semantic` |

---

## Migration from v0.0.x

| v0.0.x | v0.1.0 |
|---|---|
| `memory.write(entry)` | `memory.remember(entry)` — auto-fills `id` + timestamps |
| `memory.recall(query, opts)` | `memory.recall(query?)` — structured, no text arg |
| `memory.forget(id)` | unchanged |
| — | `memory.search(text, opts?)` |
| — | `memory.recent(opts?)` |
| — | `memory.clear()` |
| `createMemory()` → in-memory | `createMemory()` → SQLite at `.memory/memory.db` |
| `agentId` required | `agentId` optional |
| `scope` required | `scope` optional, defaults per adapter |
| `createdAt: number` (unix ms) | `createdAt: string` (ISO 8601) |
| `createMemory(adapter)` | `createMemory({ adapter })` |
| `InMemoryAdapter` class | `memoryAdapter()` factory function |
| `SQLiteAdapter` class | `sqliteAdapter()` factory function |
| `SemanticAdapter` class | `semanticAdapter()` factory function |
| `openai-embed.ts` bundled | removed — caller supplies `EmbedProvider` |

---

## Project Structure

```text
src/
├── index.ts                    # createMemory + all public types
├── types.ts                    # MemoryEntry, NewMemoryEntry, MemoryScope, query types
├── core/
│   ├── create-memory.ts        # createMemory() — wires adapter, calls init
│   └── validate-entry.ts       # runtime shape guards
├── adapters/
│   ├── types.ts                # MemoryAdapter interface
│   ├── memory-adapter.ts       # in-memory (working scope default)
│   ├── sqlite-adapter.ts       # SQLite + FTS5 (episodic scope default)
│   └── semantic-adapter.ts     # cosine similarity + pluggable embed
├── embed/
│   ├── types.ts                # EmbedFn + EmbedProvider (exported via ./embed)
│   └── stub-embed.ts           # hash stub — zero-dep, for internal tests only
└── utils/
    ├── cosine.ts               # cosine similarity
    ├── id.ts                   # nanoid-style id generator
    └── timestamp.ts            # ISO 8601 helpers
```

---

## Development

```bash
pnpm install
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run
pnpm build          # typecheck + clean + tsup
```

---

## Design Decisions

**Zero dependencies in core.** `src/index.ts`, `src/types.ts`, and `src/core/` have no runtime imports outside the package. Adapters are behind subpath exports.

**`better-sqlite3` is never bundled.** It is marked `external` in tsup and loaded with a dynamic `import()` at runtime so it is never included in the dist output.

**`EmbedProvider` is caller-supplied.** The package ships only the interface. This keeps OpenAI (and every other embedding SDK) out of the dependency tree. Pass whatever embedding function you already have.

**FTS5 is lazily initialized.** `search()` triggers the `CREATE VIRTUAL TABLE` and backfills existing rows on first call, keeping `init()` fast and avoiding schema complexity at startup.

**ISO 8601 timestamps.** Stored as strings so SQLite range queries (`WHERE created_at >= ?`) work without any conversion. JavaScript `Date.parse()` and lexicographic string comparison both work correctly with ISO 8601.

---

## License

MIT © [Eka Prasetia](./LICENSE)

## Links

- [npm](https://www.npmjs.com/package/@ekaone/memory)
- [GitHub](https://github.com/ekaone/memory)
- [Issues](https://github.com/ekaone/memory/issues)
