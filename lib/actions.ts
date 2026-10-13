// Operations that touch more than one module. API routes and MCP tools call
// these so both behave the same.

import { getTask, type Task, type TaskPatch, updateTask } from './daybook';
import { completeIssue, isLinear, linearEnabled } from './linear';
import { frameEnabled, pushToFrame } from './frame';

export interface ActionResult<T> {
  result: T;
  warnings: string[];
}

// Finishing a Linear-linked task closes the issue in Linear too.
export async function patchTask(id: string, patch: TaskPatch): Promise<ActionResult<Task>> {
  const before = await getTask(id);
  const task = await updateTask(id, patch);
  const warnings: string[] = [];
  if (patch.done === true && !before.done && isLinear(task) && linearEnabled()) {
    try {
      await completeIssue(task.source!.id);
    } catch (err) {
      warnings.push(`Couldn't close ${task.source!.key} in Linear: ${(err as Error).message}`);
    }
  }
  return { result: task, warnings };
}

// Keep the TV current after a change, when the user opted in.
export async function maybeSyncFrame(date?: string): Promise<string[]> {
  if (!frameEnabled() || process.env.FRAME_AUTO_SYNC !== 'true') return [];
  try {
    await pushToFrame(date);
    return [];
  } catch (err) {
    return [(err as Error).message];
  }
}
