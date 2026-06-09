import type { MemoryEntry, RecallOpts } from "../types.js";
import type { MemoryAdapter } from "./types.js";

type SQLiteStatement = {
  run(...values: unknown[]): unknown;
  all(...values: unknown[]): unknown[];
};

type SQLiteDatabase = {
  exec(sql: string): unknown;
  prepare(sql: string): SQLiteStatement;
};

type BetterSqlite3Module = {
  default: new (filename: string) => SQLiteDatabase;
};

export type SQLiteAdapterOptions = {
  database?: SQLiteDatabase;
};

export class SQLiteAdapter implements MemoryAdapter {
  readonly #entries = new Map<string, MemoryEntry>();
  readonly #database: SQLiteDatabase | undefined;

  constructor(options: SQLiteAdapterOptions = {}) {
    this.#database = options.database;
    this.#database?.exec(`
      create table if not exists memory_entries (
        id text primary key,
        agent_id text not null,
        scope text not null,
        content text not null,
        metadata text,
        created_at integer not null
      );

      create virtual table if not exists memory_entries_fts using fts5(id unindexed, content);
    `);
  }

  static async open(filename = ":memory:"): Promise<SQLiteAdapter> {
    const module = await importBetterSqlite3();
    return new SQLiteAdapter({ database: new module.default(filename) });
  }

  async write(entry: MemoryEntry): Promise<void> {
    if (entry.scope !== "episodic") {
      return;
    }

    if (this.#database !== undefined) {
      this.#database
        .prepare(
          `insert or replace into memory_entries (id, agent_id, scope, content, metadata, created_at)
           values (?, ?, ?, ?, ?, ?)`,
        )
        .run(entry.id, entry.agentId, entry.scope, entry.content, stringifyMetadata(entry), entry.createdAt);
      this.#database
        .prepare("insert or replace into memory_entries_fts (id, content) values (?, ?)")
        .run(entry.id, entry.content);
      return;
    }

    this.#entries.set(entry.id, cloneEntry(entry));
  }

  async recall(query: string, opts: RecallOpts = {}): Promise<MemoryEntry[]> {
    if (opts.scope !== undefined && opts.scope !== "episodic") {
      return [];
    }

    if (this.#database !== undefined) {
      return this.#recallFromDatabase(query, opts);
    }

    const scored: ScoredEntry[] = [];

    for (const entry of this.#entries.values()) {
      if (opts.since !== undefined && entry.createdAt < opts.since) {
        continue;
      }

      const score = lexicalScore(query, entry.content);
      if (query.trim().length === 0 || score > 0) {
        scored.push({ entry, score });
      }
    }

    return scored
      .sort(compareScoredEntries)
      .slice(0, opts.limit)
      .map(({ entry }) => cloneEntry(entry));
  }

  async forget(id: string): Promise<void> {
    if (this.#database !== undefined) {
      this.#database.prepare("delete from memory_entries where id = ?").run(id);
      this.#database.prepare("delete from memory_entries_fts where id = ?").run(id);
      return;
    }

    this.#entries.delete(id);
  }

  #recallFromDatabase(query: string, opts: RecallOpts): MemoryEntry[] {
    const rows = this.#databaseRows(query, opts.since);

    return rows
      .map(rowToEntry)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, opts.limit);
  }

  #databaseRows(query: string, since: number | undefined): unknown[] {
    if (this.#database === undefined) {
      return [];
    }

    if (query.trim().length === 0) {
      return this.#database
        .prepare(
          `select id, agent_id, scope, content, metadata, created_at
           from memory_entries
           where (? is null or created_at >= ?)
           order by created_at desc`,
        )
        .all(since ?? null, since ?? null);
    }

    return this.#database
      .prepare(
        `select e.id, e.agent_id, e.scope, e.content, e.metadata, e.created_at
         from memory_entries e
         join memory_entries_fts f on f.id = e.id
         where memory_entries_fts match ?
           and (? is null or e.created_at >= ?)
         order by rank`,
      )
      .all(query, since ?? null, since ?? null);
  }
}

type ScoredEntry = {
  entry: MemoryEntry;
  score: number;
};

function compareScoredEntries(left: ScoredEntry, right: ScoredEntry): number {
  const scoreDifference = right.score - left.score;
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  return right.entry.createdAt - left.entry.createdAt;
}

function lexicalScore(query: string, content: string): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return 0;
  }

  const contentTokens = new Set(tokenize(content));
  let matches = 0;

  for (const token of queryTokens) {
    if (contentTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / queryTokens.length;
}

function tokenize(input: string): string[] {
  return input.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function stringifyMetadata(entry: MemoryEntry): string | null {
  return entry.metadata === undefined ? null : JSON.stringify(entry.metadata);
}

function rowToEntry(row: unknown): MemoryEntry {
  const value = row as Record<string, unknown>;
  const metadataText = value["metadata"];
  const metadata =
    typeof metadataText === "string" && metadataText.length > 0
      ? (JSON.parse(metadataText) as Record<string, unknown>)
      : undefined;

  return {
    id: String(value["id"]),
    agentId: String(value["agent_id"]),
    scope: "episodic",
    content: String(value["content"]),
    ...(metadata === undefined ? {} : { metadata }),
    createdAt: Number(value["created_at"]),
  };
}

async function importBetterSqlite3(): Promise<BetterSqlite3Module> {
  const importer = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<BetterSqlite3Module>;

  return importer("better-sqlite3");
}

function cloneEntry(entry: MemoryEntry): MemoryEntry {
  if (entry.metadata === undefined) {
    return { ...entry };
  }

  return { ...entry, metadata: { ...entry.metadata } };
}
