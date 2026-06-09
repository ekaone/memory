/**
 * @file index.ts
 * @description Core entry point for @ekaone/memory
 * @author Eka Prasetia
 * @website https://prasetia.me
 * @license MIT
 */

export { createMemory } from "./core/create-memory.js";
export {
  MEMORY_SCOPES,
  MemoryValidationError,
  type MemoryEntry,
  type MemoryMetadata,
  type MemoryScope,
  type MemoryStore,
  type RecallOpts,
} from "./types.js";
