export type EmbedFn = (text: string) => Promise<number[]>;

export type EmbedProvider = {
  embed: EmbedFn;
};
