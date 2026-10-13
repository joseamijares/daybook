// Pure helpers shared by the server and the browser.

import { minutesLabel } from './time';

interface Countable {
  done: boolean;
  estimate: number | null;
}

// "4 of 6 done, about 4h 15m of work. 2 move on."
export function wrapLine(tasks: Countable[], moved: number, locale: 'en' | 'es' = 'en') {
  const done = tasks.filter((t) => t.done);
  const worked = done.reduce((s, t) => s + (t.estimate || 0), 0);
  if (locale === 'es') {
    const head = [`${done.length} de ${tasks.length} hechas`, worked ? `cerca de ${minutesLabel(worked)} de trabajo` : ''].filter(Boolean).join(', ');
    const tail = moved ? (moved === 1 ? ' Una pasa a después.' : ` ${moved} pasan a después.`) : tasks.length ? ' No queda nada pendiente.' : '';
    return `${head.charAt(0).toUpperCase()}${head.slice(1)}.${tail}`;
  }
  const head = [`${done.length} of ${tasks.length} done`, worked ? `about ${minutesLabel(worked)} of work` : ''].filter(Boolean).join(', ');
  const tail = moved ? (moved === 1 ? ' One moves on.' : ` ${moved} move on.`) : tasks.length ? ' Nothing left over.' : '';
  return `${head.charAt(0).toUpperCase()}${head.slice(1)}.${tail}`;
}
