// Quick-add syntax, shared by the server and the browser (no Node imports here).

// "Draft deck 45m #client" → { title: "Draft deck", estimate: 45, tag: "client" }
export function parseQuickAdd(text: string) {
  let title = ` ${text} `;
  let estimate: number | null = null;
  let tag: string | null = null;
  const time = title.match(/\s(\d+(?:[.,]\d+)?)\s?(h|hr|hrs|hours?)\s?(\d{1,2})?\s?(m|min)?(?=\s)|\s(\d{1,3})\s?(m|min|mins|minutes?)(?=\s)/i);
  if (time) {
    if (time[1]) estimate = Math.round(parseFloat(time[1].replace(',', '.')) * 60) + (time[3] ? Number(time[3]) : 0);
    else estimate = Number(time[5]);
    title = title.replace(time[0], ' ');
  }
  const hash = title.match(/\s#([\p{L}\p{N}_-]+)(?=\s)/u);
  if (hash) {
    tag = hash[1];
    title = title.replace(hash[0], ' ');
  }
  return { title: title.trim().replace(/\s+/g, ' '), estimate, tag };
}
