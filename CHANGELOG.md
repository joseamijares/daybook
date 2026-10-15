# Changelog

## Unreleased

### Getting started

- One Start. The first screen says what Daybook is and has one button: your
  days stay in this browser, free, with no account and no setup. Under it,
  "Have your own Daybook? Open it with your key" opens the key form in place
  (or, on a server with no cloud set up, "Set up your own Daybook"). Settings →
  "Use a cloud Daybook instead" comes back with the key form open. (#22)
- On this device, Today's footer says so, and once a week it offers to keep a
  copy (the same export as Settings). Start and Keep a copy ask the browser to
  keep its storage. (#22)

### The app

- Plan the day handles the backlog itself: edit a task on the day (rename,
  tag, time, move or delete), delete backlog tasks, and write straight into
  the backlog. Open the backlog from the plan and **Back to planning** returns
  to it. (#21)
- Smoother drag and drop on Today, Plan and Week: the other rows step aside to
  show where a task will land, and the new order shows at once, with no jump.
  (#21)
- Reordering on Today and Plan feels like picking up a card: the task lifts off
  the page on raised paper and follows the pointer, the other rows part with a
  little spring, and it glides into its place when let go. Escape puts it
  back, the list scrolls when you hold a task near its edge, and on a
  touchscreen you hold a task a moment to lift it.
- A small "Update" mark beside the Settings gear when a newer deploy is live
  (a click reloads) or when the Mac app has found a new version (a click
  installs it). (#24)
- The page moves to the new day by itself after the computer sleeps, and Week
  moves to the new week. (#10)
- Headings never break inside a word; a long one is set smaller to fit. (#15)
- Phones: the bottom of the placard scrolls clear of the nav pill. (#23)
- Security: a server without `DAYBOOK_KEY` fails closed (only `pnpm dev` is
  open), `POST /api/tasks` ignores `source`, and `CRON_SECRET` is compared in
  constant time. (#13)

### Daybook for Mac (0.1.1 → 0.1.6)

- Signed with a Developer ID and notarized by Apple: no more Open Anyway. A
  release workflow builds `Daybook.dmg` on `mac-v*` tags. (#11, #12, #13)
- It updates itself (Sparkle): Daybook → Check for Updates…, a check once a
  day, and Settings → Updates. The window's own Settings shows the version and
  Update. (#17, #20)
- It opens on the salon hang: the lamp warms, the paintings hang, Daybook's
  mark and today's date appear, then Today, in about 1.5 s. The key screen
  never flashes first. (#26, #27, #32)
- `Daybook.dmg` opens in a designed window: Daybook in a gilt frame and a
  brass arrow to Applications. (#29)
- In the menu bar, drag a to-do to put the day in a new order: the other rows
  part with a little spring, a Force Touch trackpad ticks as the task finds
  each place, and the order is saved as you let go (the old one comes back if
  the save fails).
- After sleep the window and the menu bar show the new day. (#10)
- A Force Touch trackpad ticks as a dragged task lifts, finds each new place
  and lands. In the menu bar, ticking a task off bounces its check (with a tick
  under your finger), the counts roll to their new numbers, and "Tomorrow"
  grows in on hover.

### The landing page

- The landing page (`site/`): the painting of the day in a salon hang among the
  collection, today as the app hangs it, the next 44 paintings, morning and
  evening, the Frame at home, the Mac app and agents. English and Spanish.
  (#6, #7)
- The landing page shows the 50-second video: a play button in today's gilt
  frame opens it in a lightbox, and it plays in a screening room under the
  hero (the 9:16 cut on phones). (#8, #9) The video now shows the one-Start
  welcome and ends on the landing page.
- Install: one Start in the browser, "Open it with your key" for your own
  cloud, and a Mac download that is notarized and updates itself. JSON-LD
  carries the Mac app's version, and robots.txt a Content-Signal. (#16, #30)

## 0.1.0 (first public release)

- Today, Plan the day (full window), Week, Backlog and Shut down, in English
  and Spanish, down to phone width.
- On this device or in the cloud: the first screen asks. On this device runs
  entirely in the browser with export, import and erase; a cloud Daybook is
  your own deployment (Vercel + Upstash) with a key.
- Three designs (wall label, timetable, notebook) and three palettes (Salon,
  Modern, Nocturne), with Nocturne after shutdown as an option.
- A built-in MCP server (13 tools, 3 ritual prompts), a REST API and a
  dependency-free CLI with a stdio relay.
- Linear (assigned issues in the backlog, closed when done) and two-way sync
  with Frame Dashboard.
- Daybook for Mac: the app in a window plus a menu bar popover.
