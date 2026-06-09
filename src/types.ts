export const MEMORY_SCOPES = ["working", "episodic", "semantic"] as const;

export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export type MemoryMetadata = Record<string, unknown>;

export type MemoryEntry = {
  id: string;
  agentId: string;
  scope: MemoryScope;
  content: string;
  metadata?: MemoryMetadata;
  createdAt: number;
};

export type RecallOpts = {
  scope?: MemoryScope;
  limit?: number;
  since?: number;
  threshold?: number;
};

export type MemoryStore = {
  write(entry: MemoryEntry): Promise<void>;
  recall(query: string, opts?: RecallOpts): Promise<MemoryEntry[]>;
  forget(id: string): Promise<void>;
};

export class MemoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MemoryValidationError";
  }
}
