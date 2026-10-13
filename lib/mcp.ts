// A small, stateless MCP server (Streamable HTTP, JSON responses). No SDK:
// the protocol surface Daybook needs is initialize, tools and prompts, and a
// plain JSON-RPC handler works on Vercel's serverless functions as-is.
// Spec: https://modelcontextprotocol.io/specification

import { maybeSyncFrame, patchTask } from './actions';
import {
  addTask,
  backlog,
  type Carry,
  deleteTask,
  getDay,
  getWeek,
  planDay,
  setDay,
  setWeekFocus,
  shutdown,
  type Task,
} from './daybook';
import { frameEnabled, frameEvents, syncFrame } from './frame';
import { linearEnabled, syncLinear } from './linear';
import { minutesLabel, resolveDate, today } from './time';

const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER = { name: 'daybook', title: 'Daybook', version: '0.1.0' };

const INSTRUCTIONS = `Daybook is the user's daily planner (a simple Sunsama). Each day has one focus line and a short list of tasks with time estimates in minutes; tasks without a date are the backlog. Unfinished tasks roll over to today automatically.
Good habits: call get_today before changing anything. Keep a day within its capacity (shown as capacity, in minutes) and say so when it is over. Write focus lines as outcomes ("Landing page copy done"), tasks verb-first. Ask before deleting. Use plan_day for the morning ritual and shutdown_day for the evening one. After planning a week, offer send_to_frame if it is available.`;

type Json = Record<string, unknown>;
interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  annotations?: Json;
  run: (args: Json) => Promise<unknown>;
}

const str = (description: string) => ({ type: 'string', description });
const dateArg = str('today, tomorrow, a weekday (monday…), YYYY-MM-DD, or "backlog". Defaults to today.');

const brief = (t: Task) => ({
  id: t.id,
  title: t.title,
  date: t.date ?? 'backlog',
  estimate_minutes: t.estimate,
  tag: t.tag,
  done: t.done,
  ...(t.source && { linear: t.source.key, url: t.source.url }),
  ...(t.rolledFrom && { rolled_from: t.rolledFrom }),
  ...(t.notes && { notes: t.notes }),
});

async function dayBrief(date?: string) {
  const d = await getDay(date ? resolveDate(date) || today() : undefined);
  const meetings = (await frameEvents(d.date))[d.date] || [];
  return {
    date: d.date,
    is_today: d.isToday,
    focus: d.focus,
    planned: minutesLabel(d.planned),
    capacity: minutesLabel(d.capacity),
    over_capacity: d.over ? minutesLabel(d.over) : null,
    done: `${d.doneCount} of ${d.tasks.length}`,
    tasks: d.tasks.map(brief),
    meetings: meetings.map((e) => ({ title: e.title, all_day: e.allDay, start: e.start, end: e.end, location: e.location })),
    journal: d.note,
    shut_down: Boolean(d.shutdownAt),
  };
}

const withWarnings = async <T>(result: T, warnings: string[] = [], date?: string | null) => {
  const all = [...warnings, ...(await maybeSyncFrame(date ?? undefined))];
  return all.length ? { ...result, warnings: all } : result;
};

const READ = { readOnlyHint: true, openWorldHint: false };
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };

export const tools: Tool[] = [
  {
    name: 'get_today',
    title: 'Get a day',
    description: "Today's (or any day's) focus, tasks with estimates, workload against capacity, meetings (when Frame Dashboard is connected), and whether it was shut down.",
    inputSchema: { type: 'object', properties: { date: dateArg } },
    annotations: READ,
    run: ({ date }) => dayBrief(date as string | undefined),
  },
  {
    name: 'get_week',
    title: 'Get the week',
    description: 'The week (Monday to Sunday) containing the date: week focus, each day with its focus, tasks and workload, plus the backlog.',
    inputSchema: { type: 'object', properties: { date: str('Any date in the week, YYYY-MM-DD. Defaults to this week.') } },
    annotations: READ,
    run: async ({ date }) => {
      const w = await getWeek(date as string | undefined);
      return {
        week_of: w.weekOf,
        focus: w.focus,
        days: w.days.map((d) => ({
          date: d.date,
          focus: d.focus,
          planned: minutesLabel(d.planned),
          over_capacity: d.over ? minutesLabel(d.over) : null,
          tasks: d.tasks.map(brief),
        })),
        backlog: w.backlog.map(brief),
      };
    },
  },
  {
    name: 'list_backlog',
    title: 'List the backlog',
    description: 'Unscheduled tasks, including issues synced from Linear.',
    inputSchema: { type: 'object', properties: {} },
    annotations: READ,
    run: async () => ({ backlog: (await backlog()).map(brief) }),
  },
  {
    name: 'add_task',
    title: 'Add a task',
    description: 'Add a task to a day or the backlog. The title may use quick-add syntax: "Draft deck 45m #client" sets a 45-minute estimate and the tag "client".',
    inputSchema: {
      type: 'object',
      properties: {
        title: str('What to do, verb first. May include "45m" / "1h30" and "#tag".'),
        date: dateArg,
        estimate_minutes: { type: 'integer', minimum: 0, maximum: 1440 },
        tag: str('One word: a client, project or area.'),
        notes: str('Optional details.'),
      },
      required: ['title'],
    },
    annotations: WRITE,
    run: async (a) => {
      const t = await addTask({ text: a.title as string, date: a.date as string | undefined, estimate: a.estimate_minutes as number, tag: a.tag as string, notes: a.notes as string });
      return withWarnings({ task: brief(t) }, [], t.date);
    },
  },
  {
    name: 'update_task',
    title: 'Edit or move a task',
    description: 'Change a task: title, estimate, tag, notes, or its day (use date "backlog" to unschedule).',
    inputSchema: {
      type: 'object',
      properties: {
        id: str('Task id from get_today / get_week / list_backlog.'),
        title: { type: 'string' },
        date: dateArg,
        estimate_minutes: { type: ['integer', 'null'], minimum: 0, maximum: 1440 },
        tag: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
      },
      required: ['id'],
    },
    annotations: WRITE,
    run: async (a) => {
      const { result, warnings } = await patchTask(a.id as string, {
        title: a.title as string | undefined,
        date: a.date as string | undefined,
        estimate: a.estimate_minutes as number | null | undefined,
        tag: a.tag as string | null | undefined,
        notes: a.notes as string | null | undefined,
      });
      return withWarnings({ task: brief(result) }, warnings, result.date);
    },
  },
  {
    name: 'complete_task',
    title: 'Complete a task',
    description: 'Mark a task done (or not done with done=false). Completing a task linked to Linear also completes the issue in Linear.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, done: { type: 'boolean', default: true } }, required: ['id'] },
    annotations: { ...WRITE, openWorldHint: true },
    run: async ({ id, done }) => {
      const { result, warnings } = await patchTask(id as string, { done: done !== false });
      return withWarnings({ task: brief(result) }, warnings, result.date);
    },
  },
  {
    name: 'delete_task',
    title: 'Delete a task',
    description: 'Delete a task for good. Ask the user first.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    run: async ({ id }) => {
      await deleteTask(id as string);
      return { deleted: id };
    },
  },
  {
    name: 'set_focus',
    title: 'Set the focus line',
    description: 'Set the one-line focus for a day, or for the week with scope "week". Write it as an outcome, about 60 characters.',
    inputSchema: {
      type: 'object',
      properties: { focus: { type: ['string', 'null'] }, date: dateArg, scope: { type: 'string', enum: ['day', 'week'], default: 'day' } },
      required: ['focus'],
    },
    annotations: WRITE,
    run: async ({ focus, date, scope }) => {
      const d = resolveDate((date as string) || 'today') || today();
      if (scope === 'week') return withWarnings({ week: await setWeekFocus(d, focus as string | null) }, [], d);
      return withWarnings({ day: await setDay(d, { focus: focus as string | null }) }, [], d);
    },
  },
  {
    name: 'plan_day',
    title: 'Plan a day',
    description: 'The morning ritual: put these tasks on the day in this order (pulling them from the backlog or other days), optionally set the focus. Returns the day and a warning if it is over capacity.',
    inputSchema: {
      type: 'object',
      properties: {
        date: dateArg,
        task_ids: { type: 'array', items: { type: 'string' }, description: 'In the order they should be done.' },
        focus: { type: 'string' },
      },
      required: ['task_ids'],
    },
    annotations: WRITE,
    run: async ({ date, task_ids, focus }) => {
      const { day, warning } = await planDay(date as string | undefined, task_ids as string[], focus as string | undefined);
      return withWarnings({ day: await dayBrief(day.date), ...(warning && { warning }) }, [], day.date);
    },
  },
  {
    name: 'shutdown_day',
    title: 'Shut down the day',
    description: 'The evening ritual: unfinished tasks move to tomorrow unless carry says "backlog" or "keep"; saves a one-line journal note; returns a one-line recap.',
    inputSchema: {
      type: 'object',
      properties: {
        date: dateArg,
        note: str('One line for the journal: what went well, what got in the way.'),
        carry: { type: 'object', additionalProperties: { type: 'string', enum: ['tomorrow', 'backlog', 'keep'] }, description: 'Task id → where it goes.' },
      },
    },
    annotations: WRITE,
    run: async ({ date, note, carry }) => {
      const r = await shutdown(date as string | undefined, { note: note as string | undefined, carry: carry as Record<string, Carry> });
      return withWarnings({ date: r.date, summary: r.summary, moved: r.moved }, [], r.date);
    },
  },
  {
    name: 'sync_linear',
    title: 'Sync Linear',
    description: 'Pull open Linear issues assigned to the user into the backlog and mark tasks done whose issues closed.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { ...WRITE, openWorldHint: true },
    run: async () => {
      if (!linearEnabled()) throw new Error('Linear is not connected: set LINEAR_API_KEY.');
      return syncLinear();
    },
  },
  {
    name: 'send_to_frame',
    title: 'Sync with Frame',
    description: "Two-way sync with the user's Frame Dashboard TV: first pulls what changed there (to-dos ticked, added or removed in Frame Desk, focus edits) into Daybook, then pushes the week's focus lines and tasks.",
    inputSchema: { type: 'object', properties: { date: str('Any date in the week. Defaults to this week.') } },
    annotations: { ...WRITE, openWorldHint: true },
    run: async ({ date }) => {
      if (!frameEnabled()) throw new Error('Frame Dashboard is not connected: set FRAME_DASHBOARD_URL and FRAME_DASHBOARD_WRITE_KEY.');
      return syncFrame(date as string | undefined);
    },
  },
];

const prompts = [
  {
    name: 'plan_my_day',
    title: 'Plan my day',
    description: 'Morning ritual: review what rolled over, pull from the backlog and Linear, fit the day to capacity, set a focus.',
    text: `Plan my day in Daybook.
1. Call get_today. Mention anything that rolled over from earlier days.
2. If Linear is connected, call sync_linear, then list_backlog.
3. Ask me what matters most today, then propose: one focus line (an outcome) and 3–6 tasks with estimates that fit within capacity. Show it as a short table.
4. When I say yes, call plan_day with the task ids in order and the focus. Add new tasks with add_task first if needed.
5. Tell me the planned total against capacity.`,
  },
  {
    name: 'shut_down',
    title: 'Shut down the day',
    description: 'Evening ritual: review what got done, decide where unfinished work goes, one journal line.',
    text: `Shut down my day in Daybook.
1. Call get_today and read back what got done in one sentence.
2. For each unfinished task, ask: tomorrow, backlog, or keep? (Default tomorrow.)
3. Ask for one line for the journal.
4. Call shutdown_day with the carry map and note, then tell me the recap.`,
  },
  {
    name: 'plan_my_week',
    title: 'Plan my week',
    description: 'Monday ritual: a week focus and a focus plus a few tasks per weekday, then send it to the Frame.',
    text: `Plan my week in Daybook.
1. Call get_week and list_backlog (sync_linear first if available).
2. Ask what this week is about. Propose a week focus, then for each weekday one focus and 3–5 tasks that fit capacity.
3. On my yes: set_focus (scope week), then plan_day for each day.
4. If send_to_frame is available, offer to send the week to the TV.`,
  },
];

export type RpcMessage = { jsonrpc: '2.0'; id?: string | number | null; method?: string; params?: Json };

const ok = (id: RpcMessage['id'], result: unknown) => ({ jsonrpc: '2.0', id, result });
const fail = (id: RpcMessage['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

export async function handle(msg: RpcMessage): Promise<object | null> {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fail(msg?.id, -32600, 'Invalid Request');
  const isNotification = msg.id === undefined || msg.id === null;
  if (isNotification) return null;
  const p = msg.params || {};
  switch (msg.method) {
    case 'initialize': {
      const asked = p.protocolVersion as string;
      return ok(msg.id, {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: SERVER,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok(msg.id, {});
    case 'tools/list':
      return ok(msg.id, {
        tools: tools
          .filter((t) => (t.name === 'sync_linear' ? linearEnabled() : t.name === 'send_to_frame' ? frameEnabled() : true))
          .map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations })),
      });
    case 'tools/call': {
      const tool = tools.find((t) => t.name === p.name);
      if (!tool) return fail(msg.id, -32602, `Unknown tool: ${p.name}`);
      try {
        const result = await tool.run((p.arguments as Json) || {});
        return ok(msg.id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      } catch (err) {
        return ok(msg.id, { content: [{ type: 'text', text: (err as Error).message }], isError: true });
      }
    }
    case 'prompts/list':
      return ok(msg.id, { prompts: prompts.map((x) => ({ name: x.name, title: x.title, description: x.description })) });
    case 'prompts/get': {
      const prompt = prompts.find((x) => x.name === p.name);
      if (!prompt) return fail(msg.id, -32602, `Unknown prompt: ${p.name}`);
      return ok(msg.id, { description: prompt.description, messages: [{ role: 'user', content: { type: 'text', text: prompt.text } }] });
    }
    case 'resources/list':
      return ok(msg.id, { resources: [] });
    default:
      return fail(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}
