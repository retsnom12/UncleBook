# UncleBook: visual and code style

## Look (the "resurrected" 2009 feel)
- Palette: Facebook-2009 blue (#3b5998), pale blue headers (#d8dfea), grey page (#e9ebee).
- Fonts: Tahoma / Verdana only. No web fonts (fast, nostalgic, nothing to fail loading).
- Small square-ish cards, 1px borders, tiny buttons. No rounded pill buttons, no gradients.
- Copy is short, warm, a little goofy.

## Code
- Next.js App Router, TypeScript strict.
- Server logic lives in `src/lib` and `src/app/api`; browser-only code in `src/lib/image-client.ts`.
- Keep components small. No new dependencies without a reason written in the spec.
- Weak-device friendly: shrink images in the browser before upload, paginate the feed (12 per page).
