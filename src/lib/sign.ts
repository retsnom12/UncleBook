import { createHash, createHmac, timingSafeEqual } from "crypto";

const secret = () =>
  process.env.SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only-secret";

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export type TokenPayload = { h: string; score: number; verdict: string; exp: number };

export function signToken(p: Omit<TokenPayload, "exp">, ttlMs = 15 * 60_000): string {
  const body = Buffer.from(JSON.stringify({ ...p, exp: Date.now() + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = createHmac("sha256", secret()).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
