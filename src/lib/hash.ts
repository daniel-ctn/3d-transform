import { createHash } from "crypto";

/**
 * Generate a SHA-256 hash from image content.
 * Accepts a URL (fetches the image) or a Base64 data string.
 */
export async function hashImage(input: string): Promise<string> {
  let buffer: ArrayBuffer;

  if (input.startsWith("data:")) {
    // Base64 data URL — strip the prefix and decode
    const base64 = input.split(",")[1];
    buffer = Buffer.from(base64, "base64").buffer;
  } else {
    // Remote URL — fetch raw bytes
    const res = await fetch(input);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
    buffer = await res.arrayBuffer();
  }

  return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}
