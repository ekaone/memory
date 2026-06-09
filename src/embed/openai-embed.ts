import { MemoryValidationError } from "../types.js";
import type { EmbedProvider } from "./types.js";

export type OpenAIEmbedProviderOptions = {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  fetcher?: typeof fetch;
};

type OpenAIEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
  }>;
};

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_ENDPOINT = "https://api.openai.com/v1/embeddings";

export class OpenAIEmbedProvider implements EmbedProvider {
  readonly #apiKey: string | undefined;
  readonly #model: string;
  readonly #endpoint: string;
  readonly #fetcher: typeof fetch;

  constructor(options: OpenAIEmbedProviderOptions = {}) {
    this.#apiKey = options.apiKey ?? process.env["OPENAI_API_KEY"];
    this.#model = options.model ?? DEFAULT_MODEL;
    this.#endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.#fetcher = options.fetcher ?? fetch;
  }

  async embed(input: string): Promise<readonly number[]> {
    if (this.#apiKey === undefined || this.#apiKey.trim().length === 0) {
      throw new MemoryValidationError("OpenAI API key is required to embed semantic memory.");
    }

    const response = await this.#fetcher(this.#endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.#apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        input,
        model: this.#model,
      }),
    });

    if (!response.ok) {
      throw new MemoryValidationError(`OpenAI embedding request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as OpenAIEmbeddingResponse;
    const vector = payload.data?.[0]?.embedding;
    if (vector === undefined) {
      throw new MemoryValidationError("OpenAI embedding response did not include an embedding.");
    }

    return vector;
  }
}
