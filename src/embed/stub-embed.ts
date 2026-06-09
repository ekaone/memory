import { MemoryValidationError } from "../types.js";
import type { EmbedProvider } from "./types.js";

const DEFAULT_VECTOR_SIZE = 64;

export class StubEmbedProvider implements EmbedProvider {
  readonly #dimensions: number;

  constructor(dimensions = DEFAULT_VECTOR_SIZE) {
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new MemoryValidationError("dimensions must be a positive integer.");
    }

    this.#dimensions = dimensions;
  }

  async embed(input: string): Promise<readonly number[]> {
    const vector = Array.from({ length: this.#dimensions }, () => 0);

    for (const token of tokenize(input)) {
      const hash = hashToken(token);
      const index = Math.abs(hash) % this.#dimensions;
      vector[index] = (vector[index] ?? 0) + (hash < 0 ? -1 : 1);
    }

    return vector;
  }
}

function tokenize(input: string): string[] {
  return input.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function hashToken(token: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash | 0;
}
