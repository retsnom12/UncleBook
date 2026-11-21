"use client";

import { useRef, useState } from "react";
import { canvasToJpegDataUrl, fileToCanvas, uncleify } from "@/lib/image-client";
import { UNCLE_THRESHOLD, type Analysis, type Photo } from "@/lib/types";

type Stage = "idle" | "analyzing" | "result" | "sharing";

export default function Uploader({ onShared }: { onShared: (p: Photo) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uncleified, setUncleified] = useState(false);
  const [prevScore, setPrevScore] = useState<number | null>(null);

  function reset() {
    setStage("idle");
    setCanvas(null);
    setPreview(null);
    setAnalysis(null);
    setCaption("");
    setError(null);
    setUncleified(false);
    setPrevScore(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function analyze(c: HTMLCanvasElement) {
    setStage("analyzing");
    setError(null);
    try {
      const image = await canvasToJpegDataUrl(c);
      setPreview(image);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(data?.error ?? "Could not analyze the photo.");
        setStage(analysis ? "result" : "idle");
        return;
      }
      setAnalysis(data as Analysis);
      setStage("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage(analysis ? "result" : "idle");
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    setUncleified(false);
    setPrevScore(null);
    setAnalysis(null);
    try {
      const c = await fileToCanvas(file);
      setCanvas(c);
      await analyze(c);
    } catch {
      setError("Could not open that image. Try another one.");
      setStage("idle");
    }
  }

  async function onUncleify() {
    if (!canvas || !analysis) return;
    setPrevScore(analysis.score);
    const filtered = uncleify(canvas);
    setCanvas(filtered);
    setUncleified(true);
    await analyze(filtered);
  }

  async function onShare() {
    if (!preview || !analysis) return;
    setStage("sharing");
    setError(null);
    try {
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: preview, caption, token: analysis.token }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.photo) {
        setError(data?.error ?? "Could not share the photo.");
        setStage("result");
        return;
      }
      onShared(data.photo as Photo);
      reset();
    } catch {
      setError("Network problem. Please try again.");
      setStage("result");
    }
  }

  const busy = stage === "analyzing" || stage === "sharing";
  const passed = !!analysis && analysis.safe && analysis.score >= UNCLE_THRESHOLD;
  const color = !analysis ? "#999" : analysis.score >= UNCLE_THRESHOLD ? "#4a8f2a" : analysis.score >= 35 ? "#e0a100" : "#b3261e";

  return (
    <div className="card">
      <div className="card-head">Share a photo</div>
      <div className="card-body">
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} hidden />

        {stage === "idle" && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Take or choose a photo. The Uncle Judge decides if it is uncle enough to be shared.
            </p>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              📷 Take / choose photo
            </button>
          </>
        )}

        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="preview" src={preview} alt="Your photo preview" style={{ marginBottom: 8 }} />
        )}

        {stage === "analyzing" && <p className="spinner">🧐 The Uncle Judge is squinting at your photo…</p>}

        {analysis && stage !== "analyzing" && (
          <div>
            {!analysis.safe ? (
              <p className="error">This photo can't be shared on UncleBook. Please choose another one.</p>
            ) : (
              <>
                <div>
                  <strong>Uncle score: {analysis.score}/100</strong>
                  {prevScore !== null && (
                    <span className="muted"> (was {prevScore} before the uncle filter)</span>
                  )}
                </div>
                <div className="meter">
                  <div style={{ width: `${analysis.score}%`, background: color }} />
                </div>
                {analysis.verdict && <p style={{ margin: "4px 0" }}>“{analysis.verdict}”</p>}
                <ul className="traits">
                  {analysis.traits.map((t, i) => (
                    <li key={i} className={t.hit ? "hit" : "miss"}>
                      {t.hit ? "✔" : "✘"} {t.label}
                    </li>
                  ))}
                </ul>
                {!passed && (
                  <>
                    <p className="error" style={{ marginTop: 4 }}>
                      Not uncle enough yet (need {UNCLE_THRESHOLD}+). Retake it, or let the filter help.
                    </p>
                    {analysis.tips.length > 0 && (
                      <ul className="tips">
                        {analysis.tips.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
                {passed && (
                  <input
                    type="text"
                    placeholder="Add a caption (e.g. 'My new fridge, very proud')"
                    maxLength={140}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                  />
                )}
              </>
            )}

            <div className="row">
              {passed && (
                <button className="btn" disabled={busy} onClick={onShare}>
                  {stage === "sharing" ? "Sharing…" : "Share"}
                </button>
              )}
              {analysis.safe && !passed && !uncleified && (
                <button className="btn" disabled={busy} onClick={onUncleify}>
                  🧓 Uncle-ify it
                </button>
              )}
              <button className="btn secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                Retake
              </button>
              <button className="btn secondary" disabled={busy} onClick={reset}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
