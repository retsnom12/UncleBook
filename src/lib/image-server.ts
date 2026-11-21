export const MAX_IMAGE_BYTES = 1_500_000;

/** Parse and validate a JPEG data URL. Returns the raw bytes or an error string. */
export function parseJpegDataUrl(input: unknown): { buf: Buffer } | { error: string } {
  if (typeof input !== "string") return { error: "Missing image." };
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(input);
  if (!m) return { error: "Image must be a JPEG." };
  // Cheap size check before decoding.
  if (m[1].length > MAX_IMAGE_BYTES * 1.4) return { error: "Image is too large." };
  const buf = Buffer.from(m[1], "base64");
  if (buf.length > MAX_IMAGE_BYTES) return { error: "Image is too large." };
  // JPEG magic bytes
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    return { error: "Not a valid JPEG." };
  }
  return { buf };
}
