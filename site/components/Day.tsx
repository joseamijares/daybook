'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { localYmd } from '@site/lib/art';

// The page is prerendered with the build day's painting. Once it runs in the
// browser it switches to the visitor's own date, so the hang matches the
// painting their Daybook and Frame show today. `ready` flips at that moment,
// and the hero lights its lamp then.
const DayContext = createContext<{ ymd: string; ready: boolean }>({ ymd: '1970-01-01', ready: false });

export function DayProvider({ initial, children }: { initial: string; children: React.ReactNode }) {
  const [state, setState] = useState({ ymd: initial, ready: false });

  useEffect(() => {
    // One render after hydration, never during it: the server can't know the visitor's date.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ ymd: localYmd(), ready: true });
    // A page left open past midnight rehangs.
    const timer = window.setInterval(() => {
      const ymd = localYmd();
      setState((s) => (s.ymd === ymd ? s : { ymd, ready: true }));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return <DayContext.Provider value={state}>{children}</DayContext.Provider>;
}

export function useDay() {
  return useContext(DayContext);
}
