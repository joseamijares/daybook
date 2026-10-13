# Generated art

`public/img/room-night.webp` and `room-day.webp` are one AI-generated photograph of
a room at night (OpenRouter, `google/gemini-3-pro-image`; the request is in
`room-at-night.openrouter.json`) with a **real** Frame Dashboard screen composited
into the blank screen: `frame-dashboard/docs/night.jpg` and `day.jpg`, cropped to
the screen's 1.655 ratio. The page captions it that way.

Everything else on the page is either one of the 44 public-domain paintings
(copied from `../public/art` by `scripts/sync-art.mjs`) or the app itself.
`mac-popover.webp` is the Mac app's own SwiftUI view, rendered by its snapshot test
(`SNAPSHOT_DIR=… swift test --package-path mac/DaybookPackage`) with the two
text-field rows cropped out.
