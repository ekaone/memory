import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "../../src/utils/cosine.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 when either vector has no magnitude", () => {
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
  });

  it("handles orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });
});
