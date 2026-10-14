import Image from 'next/image';
import type { Copy } from '@site/lib/copy';
import { src, work } from '@site/lib/art';
import { MAC_URL } from '@site/lib/site';

const TOOLS = [
  'get_today',
  'get_week',
  'list_backlog',
  'add_task',
  'update_task',
  'complete_task',
  'set_focus',
  'plan_day',
  'shutdown_day',
  'sync_linear',
  'send_to_frame',
  'frame_design',
];

export function MacAgents({ c }: { c: Copy }) {
  const wallpaper = work('sisley-the-loire');
  return (
    <section className="also">
      <div className="also__col" id="mac">
        <p className="eyebrow">{c.mac.label}</p>
        <h2>{c.mac.title}</h2>
        <div className="desk" data-reveal="">
          <Image
            className="desk__wallpaper"
            src={src(wallpaper)}
            alt=""
            width={1500}
            height={Math.round(1500 / wallpaper.ratio)}
            sizes="(max-width: 899px) 100vw, 45vw"
            aria-hidden="true"
          />
          <div className="desk__bar">
            <span className="desk__chip">
              <svg width="10" height="13" viewBox="0 0 12 16" aria-hidden="true">
                <path fillRule="evenodd" d="M0 0h12v16h-12zM1.6 1.6v12.8h8.8v-12.8z" />
                <path d="M2 14.4a4 4 0 0 1 8 0z" />
              </svg>
              {c.mac.chip}
            </span>
            <span className="desk__clock">{c.mac.clock}</span>
          </div>
          <Image
            className="desk__popover"
            src="/img/mac-popover.webp"
            alt={c.mac.alt}
            width={760}
            height={1306}
            sizes="(max-width: 899px) 60vw, 24vw"
          />
        </div>
        <p className="also__body">{c.mac.body}</p>
        <a className="link-gilt" href={MAC_URL}>
          <Image src="/img/mac-icon.webp" alt="" width={28} height={28} aria-hidden="true" />
          {c.mac.link} <span aria-hidden="true">↗</span>
        </a>
      </div>

      <div className="also__col" id="agents">
        <p className="eyebrow">{c.agents.label}</p>
        <h2>{c.agents.title}</h2>
        <div className="placard placard--mcp" data-reveal="">
          <p className="placard__caps">{c.agents.command}</p>
          <pre className="placard__code">
            <code>
              {
                'claude mcp add --transport http daybook \\\n  https://your-daybook.vercel.app/api/mcp \\\n  --header "Authorization: Bearer $KEY"'
              }
            </code>
          </pre>
          <hr />
          <p className="placard__caps">{c.agents.prompts}</p>
          <p className="placard__prompts">
            {c.agents.promptList.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </p>
          <hr />
          <p className="placard__caps">{c.agents.tools}</p>
          <p className="placard__tools">
            {TOOLS.map((t) => (
              <code key={t}>{t}</code>
            ))}
          </p>
        </div>
        <p className="also__body">{c.agents.clients}</p>
      </div>
    </section>
  );
}
