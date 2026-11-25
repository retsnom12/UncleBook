# UncleBook: product steering

## What this is
UncleBook resurrects the "Facebook uncle photo" (2008-2012): proud, stiff, expressive, awkwardly
framed snapshots with an authentic uncle vibe. Anyone can share photos and see everyone else's.
Before a photo is shared, an AI judge scores how "uncle" it is. Low score: retake it with a more classic Uncle-style pose;
passing photos can optionally be decorated with nostalgic emoji stickers before publishing.

## Hard rules
- No accounts, no login. Anonymous and public.
- The app must not crash under load. Every API route catches errors and returns a friendly JSON message.
- Never trust the client: validate image type, size and magic bytes on the server.
- Posting is only possible with a server-signed analysis token bound to the exact image bytes.
- Secrets (service role key, API keys) are server-only. Never import them in client code.
- The judge is warm and funny, never cruel. Roast the pose, never the person.

## Scope discipline
This is a 2-week hackathon build. Prefer the simplest thing that works. No extra features
unless a spec task asks for them.
