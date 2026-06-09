const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const DEFAULT_LENGTH = 21;

export function createMemoryId(length = DEFAULT_LENGTH): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new RangeError("length must be a positive integer.");
  }

  const bytes = new Uint8Array(length);
  globalThis.crypto?.getRandomValues(bytes);

  if (bytes.every((byte) => byte === 0)) {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  let id = "";
  for (const byte of bytes) {
    id += ALPHABET[byte % ALPHABET.length] ?? "0";
  }

  return id;
}
