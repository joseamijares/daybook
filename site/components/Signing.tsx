import type { Copy } from '@site/lib/copy';
import { REPO_URL } from '@site/lib/site';
import { Footer } from './Closing';
import { Mark } from './Mark';

// The code signing policy SignPath Foundation asks for: who signs, what, who
// approves, and what the app sends over the network. Linked from every footer.
export function Signing({ c }: { c: Copy }) {
  const s = c.signing;
  const home = c.lang === 'es' ? '/es' : '/';
  return (
    <>
      <main className="policy">
        <a className="policy__home" href={home}>
          <Mark size={20} />
          <span>{s.back}</span>
        </a>
        <header className="policy__head">
          <span className="eyebrow">{s.eyebrow}</span>
          <h1>{s.title}</h1>
          <p className="policy__lede">{s.lede}</p>
          <p className="policy__attribution">
            {s.attribution.before}
            <a href="https://about.signpath.io">SignPath.io</a>
            {s.attribution.between}
            <a href="https://signpath.org">SignPath Foundation</a>
            {s.attribution.after}
          </p>
        </header>
        <section aria-labelledby="signed">
          <h2 id="signed">{s.signedTitle}</h2>
          <p>{s.signed}</p>
          <p>
            <a href={`${REPO_URL}/releases`}>{`${REPO_URL.replace('https://', '')}/releases`}</a>
          </p>
        </section>
        <section aria-labelledby="roles">
          <h2 id="roles">{s.rolesTitle}</h2>
          <dl className="policy__roles">
            <div>
              <dt>{s.committers}</dt>
              <dd>
                <a href="https://github.com/joseamijares">José Antonio Mijares</a>
                <span>{s.committersNote}</span>
              </dd>
            </div>
            <div>
              <dt>{s.approvers}</dt>
              <dd>
                <a href="https://github.com/joseamijares">José Antonio Mijares</a>
                <span>{s.approversNote}</span>
              </dd>
            </div>
          </dl>
        </section>
        <section aria-labelledby="privacy">
          <h2 id="privacy">{s.privacyTitle}</h2>
          <p>{s.privacy}</p>
        </section>
      </main>
      <Footer c={c} other={c.lang === 'es' ? '/code-signing' : '/es/code-signing'} />
    </>
  );
}
