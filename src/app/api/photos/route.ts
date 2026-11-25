import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { BUCKET, getSupabase } from "@/lib/supabase";
import { parseJpegDataUrl } from "@/lib/image-server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { sha256, verifyToken } from "@/lib/sign";
import { UNCLE_THRESHOLD, type Photo } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  image_path: string;
  caption: string;
  score: number;
  verdict: string;
  likes: number;
  created_at: string;
};

function toPhoto(row: Row, publicUrl: (path: string) => string): Photo {
  return {
    id: row.id,
    url: publicUrl(row.image_path),
    caption: row.caption,
    score: row.score,
    verdict: row.verdict,
    likes: row.likes,
    created_at: row.created_at,
  };
}

// GET /api/photos?cursor=<iso date>&limit=12  -> newest first, paginated
export async function GET(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Server is not configured yet." }, { status: 503 });

  try {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "12", 10) || 12, 1), 24);
    const cursor = url.searchParams.get("cursor");

    let q = sb
      .from("photos")
      .select("id,image_path,caption,score,verdict,likes,created_at")
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (cursor && !Number.isNaN(Date.parse(cursor))) q = q.lt("created_at", cursor);

    const { data, error } = await q;
    if (error) throw error;

    const rows = (data ?? []) as Row[];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const publicUrl = (p: string) => sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;

    return NextResponse.json({
      photos: page.map((r) => toPhoto(r, publicUrl)),
      nextCursor: hasMore ? page[page.length - 1].created_at : null,
    });
  } catch (err) {
    console.error("[GET /api/photos]", err);
    return NextResponse.json({ error: "Could not load the feed." }, { status: 500 });
  }
}

// POST /api/photos  { image: dataURL, caption?: string, token: string }
export async function POST(req: Request) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Server is not configured yet." }, { status: 503 });

  try {
    if (!rateLimit(`post:${clientIp(req)}`, 5, 60_000)) {
      return NextResponse.json({ error: "Too many posts. Take a breath, uncle." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    const parsed = parseJpegDataUrl(body?.image);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const payload = typeof body?.token === "string" ? verifyToken(body.token) : null;
    if (!payload) {
      return NextResponse.json({ error: "Analysis expired. Please analyze the photo again." }, { status: 400 });
    }
    // The token must belong to exactly this image: no swapping photos after analysis.
    if (payload.h !== sha256(parsed.buf)) {
      return NextResponse.json({ error: "Photo does not match its analysis." }, { status: 400 });
    }
    if (payload.score < UNCLE_THRESHOLD) {
      return NextResponse.json({ error: "Not uncle enough yet. Retake with a more classic Uncle-style photo." }, { status: 400 });
    }

    const caption =
      typeof body?.caption === "string" ? body.caption.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 140) : "";

    const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.jpg`;
    const up = await sb.storage.from(BUCKET).upload(path, parsed.buf, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
    if (up.error) throw up.error;

    const { data, error } = await sb
      .from("photos")
      .insert({ image_path: path, caption, score: payload.score, verdict: payload.verdict })
      .select("id,image_path,caption,score,verdict,likes,created_at")
      .single();
    if (error) {
      // Don't leave an orphaned file behind.
      await sb.storage.from(BUCKET).remove([path]).catch(() => {});
      throw error;
    }

    const publicUrl = (p: string) => sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
    return NextResponse.json({ photo: toPhoto(data as Row, publicUrl) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not share the photo. Please try again." }, { status: 500 });
  }
}
