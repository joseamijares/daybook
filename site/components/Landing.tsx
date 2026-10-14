import type { Copy } from '@site/lib/copy';
import { Faq, Footer } from './Closing';
import { DayProvider } from './Day';
import { FilmProvider, FilmSection } from './Film';
import { FrameRoom } from './FrameRoom';
import { Hero } from './Hero';
import { Install } from './Install';
import { JsonLd } from './JsonLd';
import { MacAgents } from './MacAgents';
import { Motion } from './Motion';
import { Rituals } from './Rituals';
import { Rotation } from './Rotation';
import { TodayRoom } from './TodayRoom';

// The whole page, one language at a time. `built` is the day the page was
// prerendered; the browser moves it to the visitor's own date.
export function Landing({ c, built }: { c: Copy; built: string }) {
  return (
    <DayProvider initial={built}>
      <FilmProvider c={c}>
        <Hero c={c} />
        <main>
          <FilmSection c={c} />
          <TodayRoom c={c} />
          <Rotation c={c} />
          <Rituals c={c} />
          <FrameRoom c={c} />
          <MacAgents c={c} />
          <Install c={c} />
          <Faq c={c} />
        </main>
        <Footer c={c} />
      </FilmProvider>
      <Motion />
      <JsonLd c={c} />
    </DayProvider>
  );
}
