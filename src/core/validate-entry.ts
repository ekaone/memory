import { MEMORY_SCOPES, MemoryValidationError, type MemoryEntry, type MemoryScope, type RecallOpts } from "../types.js";

export function validateEntry(entry: MemoryEntry): void {
  assertNonEmptyString(entry.id, "id");
  assertNonEmptyString(entry.agentId, "agentId");

  if (!isMemoryScope(entry.scope)) {
    throw new MemoryValidationError(`scope must be one of: ${MEMORY_SCOPES.join(", ")}.`);
  }

  if (typeof entry.content !== "string") {
    throw new MemoryValidationError("content must be a string.");
  }

  if (!Number.isFinite(entry.createdAt)) {
    throw new MemoryValidationError("createdAt must be a finite timestamp.");
  }
}

export function validateRecall(query: string, opts: RecallOpts): void {
  if (typeof query !== "string") {
    throw new MemoryValidationError("query must be a string.");
  }

  if (opts.scope !== undefined && !isMemoryScope(opts.scope)) {
    throw new MemoryValidationError(`scope must be one of: ${MEMORY_SCOPES.join(", ")}.`);
  }

  if (opts.since !== undefined && !Number.isFinite(opts.since)) {
    throw new MemoryValidationError("since must be a finite timestamp.");
  }

  if (opts.threshold !== undefined && !Number.isFinite(opts.threshold)) {
    throw new MemoryValidationError("threshold must be finite.");
  }

  if (opts.limit !== undefined && (!Number.isInteger(opts.limit) || opts.limit < 0)) {
    throw new MemoryValidationError("limit must be a non-negative integer.");
  }
}

export function normalizeLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined) {
    return fallback;
  }

  if (!Number.isInteger(limit) || limit < 0) {
    throw new MemoryValidationError("limit must be a non-negative integer.");
  }

  return limit;
}

export function cloneEntry(entry: MemoryEntry): MemoryEntry {
  if (entry.metadata === undefined) {
    return { ...entry };
  }

  return { ...entry, metadata: { ...entry.metadata } };
}

export function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MemoryValidationError(`${label} must be a non-empty string.`);
  }
}

function isMemoryScope(scope: string): scope is MemoryScope {
  return (MEMORY_SCOPES as readonly string[]).includes(scope);
}
