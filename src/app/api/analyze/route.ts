import { NextResponse } from "next/server";
import { analyzeImage } from "@/lib/analyze";
import { parseJpegDataUrl } from "@/lib/image-server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { sha256, signToken } from "@/lib/sign";
import type { Analysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    if (!rateLimit(`analyze:${clientIp(req)}`, 10, 60_000)) {
      return NextResponse.json(
        { error: "Slow down! The Uncle Judge needs a tea break. Try again in a minute." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = parseJpegDataUrl(body?.image);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const result = await analyzeImage(parsed.buf);
    if (!result) {
      return NextResponse.json(
        { error: "The Uncle Judge is napping. Please try again in a moment." },
        { status: 503 }
      );
    }

    const token = signToken({
      h: sha256(parsed.buf),
      score: result.safe ? result.score : 0,
      verdict: result.verdict,
    });

    const out: Analysis = { ...result, token };
    return NextResponse.json(out);
  } catch (err) {
    console.error("[/api/analyze]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
