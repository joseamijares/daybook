import type { Copy } from '@site/lib/copy';
import { APP_URL, DEPLOY_URL, MAC_DOWNLOAD_URL, REPO_URL } from '@site/lib/site';
import { HowtoLink } from './Film';

// Three wall labels: the Mac app (download and install), any browser
// (install as an app), and your own cloud.
export function Install({ c }: { c: Copy }) {
  const i = c.install;
  return (
    <section className="install" id="install" aria-labelledby="install-title">
      <div className="install__head">
        <h2 id="install-title">{i.title}</h2>
        <p>{i.lede}</p>
      </div>
      <div className="install__labels">
        <article className="install__label install__label--mac" data-reveal="">
          <h3>{i.mac.title}</h3>
          <p className="install__meta">{i.mac.meta}</p>
          <ol>
            {i.mac.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <a className="pill pill--ink install__cta" href={MAC_DOWNLOAD_URL} download>
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 1v9m0 0L4.5 6.5M8 10l3.5-3.5M2 13.5h12" />
            </svg>
            {c.cta.download}
          </a>
          <p className="install__note">{i.mac.note}</p>
          <HowtoLink c={c} className="install__howto" />
        </article>

        <article className="install__label" data-reveal="">
          <h3>{i.web.title}</h3>
          <p className="install__meta">{i.web.meta}</p>
          <ol>
            {i.web.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {APP_URL ? (
            <a className="pill pill--ink install__cta" href={APP_URL}>
              {c.cta.open}
            </a>
          ) : (
            <a className="pill pill--line install__cta" href={REPO_URL}>
              {c.cta.code} <span aria-hidden="true">↗</span>
            </a>
          )}
        </article>

        <article className="install__label" data-reveal="">
          <h3>{i.cloud.title}</h3>
          <p className="install__meta">{i.cloud.meta}</p>
          <ol>
            {i.cloud.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <a className="pill pill--line install__cta" href={DEPLOY_URL}>
            <svg width="13" height="11" viewBox="0 0 76 65" aria-hidden="true" className="install__vercel">
              <path d="M37.5 0L75 65H0z" />
            </svg>
            {c.cta.deploy}
          </a>
        </article>
      </div>
    </section>
  );
}
