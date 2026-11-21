// Browser-only helpers: shrink photos before upload (keeps the server and
// weak phones/laptops happy) and the "uncle-ify" filter.

const MAX_SIDE = 1024;
const TARGET_BYTES = 900_000;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read image"));
    r.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encode failed"))), "image/jpeg", quality)
  );
}

/** Draw any image source into a canvas no larger than MAX_SIDE. Respects EXIF rotation. */
export async function fileToCanvas(file: File): Promise<HTMLCanvasElement> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Fallback for browsers/formats createImageBitmap can't handle.
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unsupported image"));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h = "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  return canvas;
}

/** Encode as JPEG data URL, lowering quality until it fits the byte budget. */
export async function canvasToJpegDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  let quality = 0.85;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > 0.4) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > TARGET_BYTES) throw new Error("Image is still too large");
  return blobToDataUrl(blob);
}

/** The "Uncle-ify" filter: warm washed-out colors, blown flash, grain, vignette, orange date stamp. */
export function uncleify(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d")!;

  // 1. Low-res feel: shrink then scale back up.
  const small = document.createElement("canvas");
  small.width = Math.max(64, Math.round(w * 0.55));
  small.height = Math.max(64, Math.round(h * 0.55));
  small.getContext("2d")!.drawImage(src, 0, 0, small.width, small.height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, w, h);

  // 2. Per-pixel: lifted contrast, warm cast, oversaturation, grain.
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];
    const lum = 0.3 * r + 0.59 * g + 0.11 * b;
    r = lum + (r - lum) * 1.35;
    g = lum + (g - lum) * 1.35;
    b = lum + (b - lum) * 1.35;
    r = (r - 128) * 1.15 + 128 + 14;
    g = (g - 128) * 1.15 + 128 + 4;
    b = (b - 128) * 1.15 + 128 - 12;
    const n = (Math.random() - 0.5) * 22;
    d[i] = Math.max(0, Math.min(255, r + n));
    d[i + 1] = Math.max(0, Math.min(255, g + n));
    d[i + 2] = Math.max(0, Math.min(255, b + n));
  }
  ctx.putImageData(img, 0, 0);

  // 3. Harsh on-camera flash: bright blown center.
  const flash = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.6);
  flash.addColorStop(0, "rgba(255,255,255,0.45)");
  flash.addColorStop(0.6, "rgba(255,255,240,0.08)");
  flash.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = flash;
  ctx.fillRect(0, 0, w, h);

  // 4. Dark corners.
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // 5. Orange date stamp, bottom right.
  const size = Math.max(14, Math.round(Math.min(w, h) * 0.045));
  ctx.font = `bold ${size}px "Courier New", monospace`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.shadowColor = "rgba(255,120,0,0.8)";
  ctx.shadowBlur = size * 0.4;
  ctx.fillStyle = "#ff9a1f";
  ctx.fillText("'10  8 21", w - size, h - size);
  ctx.shadowBlur = 0;

  return out;
}
