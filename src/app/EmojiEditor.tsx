"use client";

import { useEffect, useRef, useState } from "react";
import EmojiPicker, { type EmojiClickData } from "emoji-picker-react";

type Sticker = { id: number; emoji: string; x: number; y: number; size: number };

const UNCLE_FAVORITES = [
  "🌹", "☕", "🍵", "🙏", "👍", "🤲", "☀️", "🌅", "🧿", "🚗", "🕶️", "📸", "💐",
  "🌺", "🕊️", "✨", "👌", "🤝", "👴", "🧔", "📺", "📻", "♟️", "🍉", "🥙",
];

export default function EmojiEditor({
  image,
  onCancel,
  onApply,
}: {
  image: HTMLCanvasElement;
  onCancel: () => void;
  onApply: (canvas: HTMLCanvasElement) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const nextId = useRef(0);
  const selected = stickers.find((sticker) => sticker.id === selectedId);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    for (const sticker of stickers) {
      context.font = `${sticker.size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(sticker.emoji, sticker.x, sticker.y);
      if (sticker.id === selectedId) {
        context.beginPath();
        context.arc(sticker.x, sticker.y, sticker.size * 0.72, 0, Math.PI * 2);
        context.setLineDash([6, 4]);
        context.strokeStyle = "#3b5998";
        context.lineWidth = Math.max(2, image.width / 400);
        context.stroke();
        context.setLineDash([]);
      }
    }
  }, [image, selectedId, stickers]);

  function addEmoji(emoji: string) {
    const id = nextId.current++;
    setStickers((current) => [
      ...current,
      { id, emoji, x: image.width / 2, y: image.height / 2, size: Math.max(36, image.width * 0.09) },
    ]);
    setSelectedId(id);
  }

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * image.width,
      y: ((event.clientY - rect.top) / rect.height) * image.height,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = canvasPoint(event);
    const hit = [...stickers].reverse().find((sticker) => {
      const radius = sticker.size * 0.72;
      return Math.hypot(sticker.x - point.x, sticker.y - point.y) <= radius;
    });
    if (!hit) {
      setSelectedId(null);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: hit.id, x: point.x - hit.x, y: point.y - hit.y };
    setSelectedId(hit.id);
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current) return;
    const point = canvasPoint(event);
    const { id, x, y } = dragRef.current;
    setStickers((current) =>
      current.map((sticker) =>
        sticker.id === id ? { ...sticker, x: point.x - x, y: point.y - y } : sticker
      )
    );
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  function onEmojiClick(data: EmojiClickData) {
    addEmoji(data.emoji);
  }

  function resizeSelected(amount: number) {
    if (selectedId === null) return;
    setStickers((current) =>
      current.map((sticker) =>
        sticker.id === selectedId
          ? { ...sticker, size: Math.max(20, Math.min(image.width * 0.4, sticker.size + amount)) }
          : sticker
      )
    );
  }

  function removeSelected() {
    if (selectedId === null) return;
    setStickers((current) => current.filter((sticker) => sticker.id !== selectedId));
    setSelectedId(null);
  }

  function applyStickers() {
    const flattened = document.createElement("canvas");
    flattened.width = image.width;
    flattened.height = image.height;
    const context = flattened.getContext("2d");
    if (!context) {
      setEditorError("Could not prepare the decorated photo. Please try again.");
      return;
    }

    context.drawImage(image, 0, 0);
    for (const sticker of stickers) {
      context.font = `${sticker.size}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(sticker.emoji, sticker.x, sticker.y);
    }
    onApply(flattened);
  }

  return (
    <div className="emoji-editor">
      <div className="emoji-editor-head">✏️ 2011 Sticker Studio</div>
      <p className="muted">Pick an emoji, then drag it around your photo. Select a sticker to resize or remove it.</p>
      <canvas
        ref={canvasRef}
        className="emoji-editor-canvas"
        width={image.width}
        height={image.height}
        aria-label="Photo with emoji decorations"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {editorError && <p className="error">{editorError}</p>}
      <div className="emoji-editor-tools">
        <strong>Dayı Favorileri · Uncle Favorites</strong>
        <div className="favorite-emojis">
          {UNCLE_FAVORITES.map((emoji, index) => (
            <button
              className="emoji-choice"
              type="button"
              key={`${emoji}-${index}`}
              onClick={() => addEmoji(emoji)}
              aria-label={`Add ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <strong>All emojis</strong>
        <EmojiPicker
          onEmojiClick={onEmojiClick}
          width="100%"
          height={300}
          lazyLoadEmojis
          previewConfig={{ showPreview: false }}
        />
        <div className="row emoji-editor-actions">
          <button className="btn secondary" type="button" disabled={!selected} onClick={() => resizeSelected(-12)}>
            A− Smaller
          </button>
          <button className="btn secondary" type="button" disabled={!selected} onClick={() => resizeSelected(12)}>
            A+ Larger
          </button>
          <button className="btn secondary" type="button" disabled={!selected} onClick={removeSelected}>
            Remove sticker
          </button>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={applyStickers}>
            Bake emojis & continue
          </button>
          <button className="btn secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
