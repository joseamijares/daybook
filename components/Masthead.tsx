'use client';

import { type ReactNode, useLayoutEffect, useRef } from 'react';
import { useLook } from './client';

// The heading of a placard. The wall label hangs a big title with a line under
// it, the timetable puts a wide numeral beside it, the notebook writes it out.
// The date always sits under the heading, never as a label above it.
export function Masthead({ title, sub, numeral, actions }: { title: ReactNode; sub?: ReactNode; numeral?: string; actions?: ReactNode }) {
  const { style, palette } = useLook();
  const wide = Boolean(numeral) && style === 'timetable';
  const heading = useRef<HTMLHeadingElement>(null);

  // A heading never breaks inside a word. When its longest word is wider than
  // the room beside the actions ("Wednesday" by Plan the day), it is set
  // smaller until it fits, down to half the design's size, and grows back as
  // the window widens.
  useLayoutEffect(() => {
    const el = heading.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = '';
      el.style.lineHeight = '';
      if (el.scrollWidth <= el.clientWidth + 1) return;
      const css = getComputedStyle(el);
      const scale = Math.max(0.5, (el.clientWidth - 1) / el.scrollWidth);
      el.style.fontSize = `${(parseFloat(css.fontSize) * scale).toFixed(2)}px`;
      const line = parseFloat(css.lineHeight);
      if (line) el.style.lineHeight = `${(line * scale).toFixed(2)}px`;
    };
    fit();
    // Refit when the row the heading shares with the actions changes width (the
    // heading's own width follows the word once it is set smaller), and when a
    // font finishes loading. Not on height, which the fit itself changes.
    const row = el.closest('.masthead') ?? el;
    let width = row.clientWidth;
    // A tick later, not inside the observer, so the fit's own resize isn't a loop.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refit = () => {
      clearTimeout(timer);
      timer = setTimeout(fit, 0);
    };
    const observer = new ResizeObserver(() => {
      if (row.clientWidth === width) return;
      width = row.clientWidth;
      refit();
    });
    observer.observe(row);
    document.fonts?.addEventListener('loadingdone', refit);
    return () => {
      observer.disconnect();
      document.fonts?.removeEventListener('loadingdone', refit);
      clearTimeout(timer);
    };
  }, [title, style, palette, wide]);
  return (
    <div className={`masthead${wide ? ' with-numeral' : ''}`}>
      <div className="lead">
        {wide && (
          <div className="numeral" aria-hidden>
            {numeral}
          </div>
        )}
        <div className="titles">
          <h1 ref={heading} className="big">
            {title}
          </h1>
          {sub && <p className="sub">{sub}</p>}
        </div>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
