export type EmbedProvider = {
  embed(input: string): Promise<readonly number[]>;
};
