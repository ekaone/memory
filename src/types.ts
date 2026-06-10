export const MEMORY_SCOPES = ["working", "episodic", "semantic"] as const;

export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export type MemoryEntry = {
  id: string;
  agentId?: string;
  scope?: MemoryScope;
  type?: string;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  createdAt: string;
  updatedAt?: string;
};

export type NewMemoryEntry = Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">;

export type RecallQuery = {
  agentId?: string;
  scope?: MemoryScope;
  type?: string;
  limit?: number;
  since?: string;
  until?: string;
};

export type SearchOptions = {
  agentId?: string;
  scope?: MemoryScope;
  limit?: number;
  threshold?: number;
};

export type RecentOptions = {
  agentId?: string;
  scope?: MemoryScope;
  limit?: number;
};

export type MemoryStore = {
  remember(entry: NewMemoryEntry): Promise<MemoryEntry>;
  recall(query?: RecallQuery): Promise<MemoryEntry[]>;
  search(text: string, options?: SearchOptions): Promise<MemoryEntry[]>;
  recent(options?: RecentOptions): Promise<MemoryEntry[]>;
  forget(id: string): Promise<void>;
  clear(): Promise<void>;
};

export class MemoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryValidationError";
  }
}
