import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { clientIp, rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "Server is not configured yet." }, { status: 503 });

  try {
    const { id } = await params;
    if (!UUID.test(id)) return NextResponse.json({ error: "Bad id." }, { status: 400 });

    if (!rateLimit(`like:${clientIp(req)}`, 30, 60_000)) {
      return NextResponse.json({ error: "Easy on the likes!" }, { status: 429 });
    }

    const { data, error } = await sb.rpc("increment_likes", { photo_id: id });
    if (error) throw error;
    if (data === null || data === undefined) {
      return NextResponse.json({ error: "Photo not found." }, { status: 404 });
    }
    return NextResponse.json({ likes: data as number });
  } catch {
    return NextResponse.json({ error: "Could not like the photo." }, { status: 500 });
  }
}
