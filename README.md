# UncleBook 👍

**Resurrecting the Facebook uncle photo.** A tiny, account-free social network where anyone can share photos and see everyone else's. Before a photo goes live, an AI judge scores how "uncle" it is (classic pose, facial expression, camera angle, awkward framing, authentic vibe). Not Uncle enough? Retake it with a more classic Uncle-style pose. Passing photos can be decorated with nostalgic emoji stickers before publishing.

Built with [Kiro](https://kiro.dev) for **Kiroween 2026** · Category: **Resurrection**

## Features
- Public photo feed, newest first, paginated, with likes
- No login, no tracking
- AI "Uncle Judge": 0-100 score, funny verdict, trait checklist, retake tips
- Built-in safety check on every upload
- Client-side emoji sticker editor for passing photos
- Browser-side image shrinking: fast on weak devices and cheap to host

## Tech
Next.js (App Router, TypeScript) · Supabase (Postgres + Storage) · Gemini vision model for judging

## Run it
1. Create a free [Supabase](https://supabase.com) project. In the SQL editor, run `supabase/schema.sql`.
2. Copy `.env.example` to `.env.local` and fill in the values (Supabase URL + service role key, Gemini API key, a random `SIGNING_SECRET`).
3. Install and start:
   ```bash
   npm install
   npm run dev
   ```
4. Open http://localhost:3000

### Deploy
Push to GitHub, import the repo in Vercel, add the same environment variables, deploy.

## Reliability notes
- Every API route is wrapped in try/catch and returns friendly JSON errors.
- Per-IP rate limits (best effort, in-memory) on analyze, post and like.
- Server validates JPEG magic bytes and size (max 1.5 MB); the browser shrinks photos first.
- A post requires a server-signed token bound to the exact image bytes, so nothing skips the judge.
- If the AI is down, the feed keeps working and posting pauses with a clear message.

## How Kiro was used
See the `/.kiro` directory: steering docs (`product.md`, `style.md`), the `uncle-photo` spec (requirements, design, tasks) and agent hooks (typecheck on save, secrets guard).

## License
MIT
