"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Uploader from "./Uploader";
import type { Photo } from "@/lib/types";

const LIKED_KEY = "unclebook:liked";

function loadLiked(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveLiked(s: Set<string>) {
  try {
    localStorage.setItem(LIKED_KEY, JSON.stringify([...s].slice(-500)));
  } catch {
    /* storage unavailable: likes still work for this session */
  }
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export default function Feed() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const inflight = useRef(false);

  useEffect(() => setLiked(loadLiked()), []);

  const load = useCallback(async (after: string | null, replace: boolean) => {
    if (inflight.current) return;
    inflight.current = true;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: "12" });
      if (after) qs.set("cursor", after);
      const res = await fetch(`/api/photos?${qs}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error ?? "Could not load the feed.");
      setPhotos((prev) => {
        if (replace) return data.photos;
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.photos.filter((p: Photo) => !seen.has(p.id))];
      });
      setCursor(data.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the feed.");
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(null, true);
  }, [load]);

  async function like(p: Photo) {
    if (liked.has(p.id)) return;
    // Optimistic update, rolled back on failure.
    const next = new Set(liked).add(p.id);
    setLiked(next);
    setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, likes: x.likes + 1 } : x)));
    try {
      const res = await fetch(`/api/photos/${p.id}/like`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error();
      setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, likes: data.likes } : x)));
      saveLiked(next);
    } catch {
      const rolled = new Set(next);
      rolled.delete(p.id);
      setLiked(rolled);
      setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, likes: Math.max(0, x.likes - 1) } : x)));
    }
  }

  return (
    <>
      <Uploader onShared={(p) => setPhotos((prev) => [p, ...prev])} />

      <div className="card">
        <div className="card-head" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Everyone's uncle photos</span>
          <button className="like" onClick={() => load(null, true)} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {photos.map((p) => (
        <div className="card post" key={p.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.url} alt={p.caption || "Uncle photo"} loading="lazy" />
          <div className="card-body">
            {p.caption && <div>{p.caption}</div>}
            <div className="post-meta">
              <span className="muted">
                <span className="badge">Uncle score {p.score}</span> · {timeAgo(p.created_at)}
              </span>
              <button className={`like ${liked.has(p.id) ? "liked" : ""}`} onClick={() => like(p)}>
                👍 {liked.has(p.id) ? "Liked" : "Like"} · {p.likes}
              </button>
            </div>
          </div>
        </div>
      ))}

      {!loading && !error && photos.length === 0 && (
        <div className="card empty">
          <p>No photos yet. Be the first uncle to share one!</p>
        </div>
      )}

      {error && (
        <div className="card card-body">
          <div className="error" style={{ marginTop: 0 }}>{error}</div>
          <div className="row">
            <button className="btn secondary" onClick={() => load(null, true)}>
              Try again
            </button>
          </div>
        </div>
      )}

      {loading && <p className="muted spinner" style={{ textAlign: "center" }}>Loading…</p>}

      {cursor && !loading && (
        <div style={{ textAlign: "center" }}>
          <button className="btn secondary" onClick={() => load(cursor, false)}>
            Load more
          </button>
        </div>
      )}
    </>
  );
}
