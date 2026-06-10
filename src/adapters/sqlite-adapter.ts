import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { MemoryEntry, MemoryScope, RecallQuery, RecentOptions, SearchOptions } from "../types.js";
import type { MemoryAdapter } from "./types.js";

const DEFAULT_PATH = ".memory/memory.db";
const DEFAULT_SCOPE: MemoryScope = "episodic";

type SqliteStatement = {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
};

type SqliteDatabase = {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  pragma(pragma: string, options?: { simple?: boolean }): unknown;
};

type BetterSqlite3Constructor = new (path: string) => SqliteDatabase;

export type SqliteAdapterOptions = {
  path?: string;
};

export function sqliteAdapter(options: SqliteAdapterOptions = {}): MemoryAdapter {
  const dbPath = options.path ?? DEFAULT_PATH;
  let db: SqliteDatabase | undefined;
  let ftsReady = false;

  function getDb(): SqliteDatabase {
    if (db === undefined) {
      throw new Error("SQLite adapter not initialized — call init() first.");
    }
    return db;
  }

  return {
    async init(): Promise<void> {
      if (dbPath !== ":memory:") {
        mkdirSync(dirname(dbPath), { recursive: true });
      }

      const Sqlite = await importBetterSqlite3();
      db = new Sqlite(dbPath);

      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");

      db.exec(`
        CREATE TABLE IF NOT EXISTS memories (
          id          TEXT PRIMARY KEY,
          agent_id    TEXT,
          scope       TEXT,
          type        TEXT,
          content     TEXT NOT NULL,
          metadata    TEXT,
          created_at  TEXT NOT NULL,
          updated_at  TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_memories_agent_id   ON memories(agent_id);
        CREATE INDEX IF NOT EXISTS idx_memories_scope       ON memories(scope);
        CREATE INDEX IF NOT EXISTS idx_memories_type        ON memories(type);
        CREATE INDEX IF NOT EXISTS idx_memories_created_at  ON memories(created_at);

        CREATE TABLE IF NOT EXISTS embeddings (
          memory_id   TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
          vector      TEXT NOT NULL
        );
      `);
    },

    async write(entry: MemoryEntry): Promise<MemoryEntry> {
      const database = getDb();
      const scope = entry.scope ?? DEFAULT_SCOPE;
      const stored: MemoryEntry = { ...entry, scope };

      database.prepare(`
        INSERT OR REPLACE INTO memories (id, agent_id, scope, type, content, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        stored.id,
        stored.agentId ?? null,
        stored.scope ?? null,
        stored.type ?? null,
        stored.content,
        stored.metadata !== undefined ? JSON.stringify(stored.metadata) : null,
        stored.createdAt,
        stored.updatedAt ?? null,
      );

      if (stored.embedding !== undefined && stored.embedding.length > 0) {
        database.prepare(
          "INSERT OR REPLACE INTO embeddings (memory_id, vector) VALUES (?, ?)",
        ).run(stored.id, JSON.stringify(stored.embedding));
      }

      if (ftsReady) {
        database.prepare(
          "INSERT OR REPLACE INTO memories_fts (id, content) VALUES (?, ?)",
        ).run(stored.id, stored.content);
      }

      return stored;
    },

    async recall(query: RecallQuery = {}): Promise<MemoryEntry[]> {
      const database = getDb();

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (query.agentId !== undefined) {
        conditions.push("agent_id = ?");
        params.push(query.agentId);
      }

      if (query.scope !== undefined) {
        conditions.push("scope = ?");
        params.push(query.scope);
      }

      if (query.type !== undefined) {
        conditions.push("type = ?");
        params.push(query.type);
      }

      if (query.since !== undefined) {
        conditions.push("created_at >= ?");
        params.push(query.since);
      }

      if (query.until !== undefined) {
        conditions.push("created_at <= ?");
        params.push(query.until);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const limit = query.limit !== undefined ? `LIMIT ${query.limit}` : "";

      const rows = database.prepare(`
        SELECT id, agent_id, scope, type, content, metadata, created_at, updated_at
        FROM memories
        ${where}
        ORDER BY created_at DESC
        ${limit}
      `).all(...params);

      return rows.map(rowToEntry);
    },

    async search(text: string, options: SearchOptions = {}): Promise<MemoryEntry[]> {
      const database = getDb();

      if (text.trim().length === 0) return [];

      if (!ftsReady) {
        database.exec(
          "CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(id UNINDEXED, content)",
        );
        database.exec("INSERT INTO memories_fts (id, content) SELECT id, content FROM memories");
        ftsReady = true;
      }

      const conditions: string[] = [];
      const params: unknown[] = [text];

      if (options.agentId !== undefined) {
        conditions.push("m.agent_id = ?");
        params.push(options.agentId);
      }

      if (options.scope !== undefined) {
        conditions.push("m.scope = ?");
        params.push(options.scope);
      }

      const and = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";
      const limit = options.limit !== undefined ? `LIMIT ${options.limit}` : "";

      const rows = database.prepare(`
        SELECT m.id, m.agent_id, m.scope, m.type, m.content, m.metadata, m.created_at, m.updated_at
        FROM memories m
        JOIN memories_fts f ON f.id = m.id
        WHERE memories_fts MATCH ?
        ${and}
        ORDER BY rank
        ${limit}
      `).all(...params);

      return rows.map(rowToEntry);
    },

    async recent(options: RecentOptions = {}): Promise<MemoryEntry[]> {
      const database = getDb();

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (options.agentId !== undefined) {
        conditions.push("agent_id = ?");
        params.push(options.agentId);
      }

      if (options.scope !== undefined) {
        conditions.push("scope = ?");
        params.push(options.scope);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const limit = options.limit !== undefined ? `LIMIT ${options.limit}` : "";

      const rows = database.prepare(`
        SELECT id, agent_id, scope, type, content, metadata, created_at, updated_at
        FROM memories
        ${where}
        ORDER BY created_at DESC
        ${limit}
      `).all(...params);

      return rows.map(rowToEntry);
    },

    async forget(id: string): Promise<void> {
      const database = getDb();
      database.prepare("DELETE FROM memories WHERE id = ?").run(id);
      if (ftsReady) {
        database.prepare("DELETE FROM memories_fts WHERE id = ?").run(id);
      }
    },

    async clear(): Promise<void> {
      const database = getDb();
      database.exec("DELETE FROM memories");
      if (ftsReady) {
        database.exec("DELETE FROM memories_fts");
      }
    },
  };
}

type DbRow = Record<string, unknown>;

function rowToEntry(row: unknown): MemoryEntry {
  const r = row as DbRow;
  const meta =
    typeof r["metadata"] === "string" && r["metadata"].length > 0
      ? (JSON.parse(r["metadata"]) as Record<string, unknown>)
      : undefined;

  return {
    id: String(r["id"]),
    ...(r["agent_id"] != null ? { agentId: String(r["agent_id"]) } : {}),
    ...(r["scope"] != null ? { scope: r["scope"] as MemoryScope } : {}),
    ...(r["type"] != null ? { type: String(r["type"]) } : {}),
    content: String(r["content"]),
    ...(meta !== undefined ? { metadata: meta } : {}),
    createdAt: String(r["created_at"]),
    ...(r["updated_at"] != null ? { updatedAt: String(r["updated_at"]) } : {}),
  };
}

async function importBetterSqlite3(): Promise<BetterSqlite3Constructor> {
  const module = await import("better-sqlite3");
  return module.default as unknown as BetterSqlite3Constructor;
}
