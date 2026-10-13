// Drag and drop: put `id` on the drop line shown before position `index` of
// `ids` (index = ids.length is the end). Works for a task already in the list,
// moving up or down, and for one coming in from elsewhere.
export function placeAt(ids: string[], id: string, index: number): string[] {
  const from = ids.indexOf(id);
  const rest = ids.filter((x) => x !== id);
  const at = from >= 0 && index > from ? index - 1 : index;
  rest.splice(Math.max(0, Math.min(at, rest.length)), 0, id);
  return rest;
}
