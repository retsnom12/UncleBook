# Tasks: Uncle Photo Sharing

- [x] 1. Project scaffold (Next.js, TypeScript strict, MIT license, .kiro committed)
- [x] 2. Supabase schema: photos table, RLS, atomic like function, storage bucket
- [x] 3. Server utilities: rate limiter, token signing, JPEG validation, Supabase client
- [x] 4. Vision analysis wrapper with timeout and graceful failure
- [x] 5. API: POST /api/analyze
- [x] 6. API: GET and POST /api/photos (pagination, signed-token check, orphan cleanup)
- [x] 7. API: POST /api/photos/:id/like
- [x] 8. Browser image helpers: resize and JPEG encode under budget
- [x] 9. UI: feed with pagination, likes, empty and error states
- [x] 10. UI: uploader with score meter, traits, tips, retake and share
- [x] 11. UI: canvas emoji editor with Uncle Favorites and general picker
- [ ] 12. Deploy to Vercel and run the Supabase schema
- [ ] 13. Load test the feed and upload flow with a handful of simultaneous users
- [ ] 14. Property-based tests for token signing and JPEG validation (fast-check)
- [ ] 15. Record the 3-minute demo and write the Kiro usage write-up
