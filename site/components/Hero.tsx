import type { Copy } from '@site/lib/copy';
import { APP_URL, DEPLOY_URL, MAC_DOWNLOAD_URL, REPO_URL } from '@site/lib/site';
import { Mark } from './Mark';
import { SalonHang } from './SalonHang';

export function Hero({ c }: { c: Copy }) {
  return (
    <header className="hero">
      <nav className="nav" aria-label="Daybook">
        <a className="nav__lockup" href={c.lang === 'es' ? '/es' : '/'}>
          <Mark size={20} />
          <span>Daybook</span>
        </a>
        <div className="nav__links">
          <a href="#collection">{c.nav.collection}</a>
          <a href="#frame">{c.nav.frame}</a>
          <a href="#mac">{c.nav.mac}</a>
          <a href="#agents">{c.nav.agents}</a>
          <a href={REPO_URL}>{c.nav.github}</a>
          <a className="pill pill--bone" href="#install">
            {c.nav.install}
          </a>
        </div>
      </nav>

      <SalonHang c={c} />

      <div className="label hero__label">
        <p className="label__head">
          <Mark size={13} tone="ink" />
          <span>Daybook</span>
          <small>{c.hero.label}</small>
        </p>
        <h1>{c.hero.title}</h1>
        <p className="label__body">{c.hero.lede}</p>
        <div className="label__actions">
          <a className="pill pill--ink" href={MAC_DOWNLOAD_URL} download>
            {c.cta.download}
          </a>
          {APP_URL ? (
            <a className="pill pill--line" href={APP_URL}>
              {c.cta.open}
            </a>
          ) : (
            <a className="pill pill--line" href={DEPLOY_URL}>
              {c.cta.deploy} <span aria-hidden="true">↗</span>
            </a>
          )}
          <a className="label__how" href="#install">
            {c.cta.how}
          </a>
        </div>
      </div>
    </header>
  );
}
