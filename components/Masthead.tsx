'use client';

import type { ReactNode } from 'react';
import { useLook } from './client';

// The heading of a placard. The wall label hangs a big title with a line under
// it, the timetable puts a wide numeral beside it, the notebook writes it out.
// The date always sits under the heading, never as a label above it.
export function Masthead({ title, sub, numeral, actions }: { title: ReactNode; sub?: ReactNode; numeral?: string; actions?: ReactNode }) {
  const { style } = useLook();
  const wide = Boolean(numeral) && style === 'timetable';
  return (
    <div className={`masthead${wide ? ' with-numeral' : ''}`}>
      <div className="lead">
        {wide && (
          <div className="numeral" aria-hidden>
            {numeral}
          </div>
        )}
        <div className="titles">
          <h1 className="big">{title}</h1>
          {sub && <p className="sub">{sub}</p>}
        </div>
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
