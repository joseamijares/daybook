// Linear: your open assigned issues land in the backlog; finishing one in
// Daybook moves it to the team's first "completed" state in Linear.
// Uses a personal API key (Linear → Settings → Security & access → API keys).

import { addTask, allTasks, type Task, updateTask } from './daybook';
import { store } from './store';

const API = 'https://api.linear.app/graphql';

export const linearEnabled = () => Boolean(process.env.LINEAR_API_KEY);

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const key = process.env.LINEAR_API_KEY;
  if (!key) throw new Error('LINEAR_API_KEY is not set');
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: key },
    body: JSON.stringify({ query, variables }),
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T; errors?: { message: string }[] };
  if (!res.ok || json.errors?.length) {
    throw new Error(`Linear: ${json.errors?.map((e) => e.message).join('; ') || res.statusText}`);
  }
  return json.data as T;
}

interface Issue {
  id: string;
  identifier: string;
  title: string;
  url: string;
  state: { name: string; type: string };
}

export async function assignedIssues(): Promise<Issue[]> {
  const data = await gql<{ viewer: { assignedIssues: { nodes: Issue[] } } }>(`
    query Assigned {
      viewer {
        assignedIssues(first: 100, filter: { state: { type: { nin: ["completed", "canceled"] } } }, orderBy: updatedAt) {
          nodes { id identifier title url state { name type } }
        }
      }
    }`);
  return data.viewer.assignedIssues.nodes;
}

// New issues go to the backlog; known ones get their title refreshed;
// linked tasks whose issue is no longer open are marked done.
export async function syncLinear() {
  const issues = await assignedIssues();
  const tasks = await allTasks();
  const byIssue = new Map(tasks.filter((t) => t.source?.type === 'linear').map((t) => [t.source!.id, t]));
  let added = 0;
  let updated = 0;
  let closed = 0;
  const open = new Set<string>();
  for (const issue of issues) {
    open.add(issue.id);
    const source = { type: 'linear' as const, id: issue.id, key: issue.identifier, url: issue.url, state: issue.state.name };
    const existing = byIssue.get(issue.id);
    if (!existing) {
      await addTask({ title: issue.title, date: null, source });
      added++;
    } else if (existing.title !== issue.title || existing.source?.state !== issue.state.name) {
      await store().put('tasks', existing.id, { ...existing, title: issue.title, source, updatedAt: new Date().toISOString() });
      updated++;
    }
  }
  // A linked issue that left the open list may have been closed — or just
  // reassigned. Ask Linear, and only finish tasks whose issue really ended.
  const gone = [...byIssue.values()].filter((t) => !t.done && !open.has(t.source!.id));
  if (gone.length) {
    const ended = await endedIssues(gone.map((t) => t.source!.id));
    for (const t of gone) {
      if (!ended.has(t.source!.id)) continue;
      await updateTask(t.id, { done: true });
      closed++;
    }
  }
  await store().put('meta', 'linearSyncedAt', new Date().toISOString());
  return { added, updated, closed, open: issues.length };
}

async function endedIssues(ids: string[]): Promise<Set<string>> {
  const data = await gql<{ issues: { nodes: { id: string; state: { type: string } }[] } }>(
    `query Ended($ids: [ID!]) { issues(first: 250, filter: { id: { in: $ids } }) { nodes { id state { type } } } }`,
    { ids },
  );
  return new Set(data.issues.nodes.filter((i) => ['completed', 'canceled'].includes(i.state.type)).map((i) => i.id));
}

export async function completeIssue(issueId: string) {
  const data = await gql<{ issue: { team: { states: { nodes: { id: string; position: number }[] } } } }>(
    `query States($id: String!) {
      issue(id: $id) { team { states(filter: { type: { eq: "completed" } }) { nodes { id position } } } }
    }`,
    { id: issueId },
  );
  const state = data.issue.team.states.nodes.sort((a, b) => a.position - b.position)[0];
  if (!state) throw new Error('Linear: the team has no completed state');
  await gql(`mutation Done($id: String!, $stateId: String!) { issueUpdate(id: $id, input: { stateId: $stateId }) { success } }`, {
    id: issueId,
    stateId: state.id,
  });
}

export async function linearSyncedAt() {
  return store().get<string>('meta', 'linearSyncedAt');
}

export const isLinear = (t: Task) => t.source?.type === 'linear';
