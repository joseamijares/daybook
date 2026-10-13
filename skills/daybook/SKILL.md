---
name: daybook
description: Plan the user's day or week and run their evening shutdown in Daybook, a simple Sunsama-style planner reachable over MCP (server "daybook"). Use when the user says "plan my day", "what's on today", "add X to tomorrow", "mark X done", "shut down", "plan my week", or "send my week to the Frame".
---

# Daybook

Daybook gives each day one **focus** line and a short list of **tasks** with estimates in minutes. Tasks
with no date are the **backlog**. Unfinished tasks roll over to today by themselves.

## Always

- Call `get_today` (or `get_week`) before changing anything. The server's time zone decides what "today" is.
- Keep a day within its capacity (`capacity` in the result). Say so when it's over and offer to move something.
- Write focus lines as outcomes ("Landing page copy done", about 60 characters) and tasks verb-first (about 45
  characters). Quick-add works in titles: "Draft deck 45m #client".
- Ask before `delete_task`. Prefer moving a task to the backlog.

## Morning: plan the day

1. `get_today`. Mention anything with `rolled_from`.
2. If `sync_linear` is listed, call it, then `list_backlog`.
3. Ask what matters most. Propose a focus and 3–6 tasks that fit capacity, as a short table.
4. When the user says yes, `add_task` for anything new, then `plan_day` with the task ids in order and the focus.

## Evening: shut down

1. `get_today`, then read back what got done in one sentence.
2. For each unfinished task, ask: tomorrow (the default), backlog, or keep.
3. Ask for one line for the journal, then call `shutdown_day` with `carry` and `note`. Tell the user the recap.

## Monday: plan the week

`get_week`, then agree a week focus (`set_focus` with `scope: "week"`) and a focus plus tasks per weekday
(`plan_day` per day). If `send_to_frame` is listed, offer to send the week to the TV.
