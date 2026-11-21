# Design: Uncle Photo Sharing

## Architecture
```
Browser (Next.js client)                 Server (Next.js API routes)            Services
-----------------------                  ---------------------------            --------
pick file -> shrink (canvas) --------->  POST /api/analyze                      Vision model
                                          rate limit, validate JPEG  --------->  (score + safety)
                                          sign token(hash, score)
<------------- analysis + token --------
[optional] Uncle-ify filter (canvas) -> re-analyze
Share --------------------------------> POST /api/photos
                                          verify token == sha256(image)
                                          upload ---------------------------->  Supabase Storage
                                          insert row ------------------------>  Supabase Postgres
GET feed ------------------------------> GET /api/photos?cursor=
Like ----------------------------------> POST /api/photos/:id/like  (RPC increment_likes)
```

## Key decisions
- **No login:** all DB access goes through API routes with the service role key; RLS is on with no public policies.
- **Signed analysis token:** prevents posting un-analyzed or swapped images without needing accounts.
- **Client-side resize + filter:** zero server image processing, works on weak devices, cheap hosting.
- **Fail soft:** AI down means posting is paused with a clear message, but the feed keeps working.
- **Cursor pagination** on `created_at` keeps the feed fast as it grows.

## Data model
`photos(id, image_path, caption, score, verdict, likes, created_at)` plus a public `photos` storage bucket.
