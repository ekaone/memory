import {
  MEMORY_SCOPES,
  MemoryValidationError,
  type MemoryScope,
  type NewMemoryEntry,
  type RecallQuery,
} from "../types.js";

export function validateNewEntry(entry: NewMemoryEntry): void {
  if (typeof entry.content !== "string" || entry.content.length === 0) {
    throw new MemoryValidationError("content must be a non-empty string.");
  }

  if (entry.scope !== undefined && !isMemoryScope(entry.scope)) {
    throw new MemoryValidationError(`scope must be one of: ${MEMORY_SCOPES.join(", ")}.`);
  }
}

export function validateRecallQuery(query: RecallQuery): void {
  if (query.scope !== undefined && !isMemoryScope(query.scope)) {
    throw new MemoryValidationError(`scope must be one of: ${MEMORY_SCOPES.join(", ")}.`);
  }

  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 0)) {
    throw new MemoryValidationError("limit must be a non-negative integer.");
  }

  if (query.since !== undefined && Number.isNaN(Date.parse(query.since))) {
    throw new MemoryValidationError("since must be a valid ISO 8601 string.");
  }

  if (query.until !== undefined && Number.isNaN(Date.parse(query.until))) {
    throw new MemoryValidationError("until must be a valid ISO 8601 string.");
  }
}

export function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MemoryValidationError(`${label} must be a non-empty string.`);
  }
}

function isMemoryScope(scope: string): scope is MemoryScope {
  return (MEMORY_SCOPES as readonly string[]).includes(scope);
}
