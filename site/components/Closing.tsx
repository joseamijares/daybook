import type { Copy } from '@site/lib/copy';
import { AGENTS_DOC_URL, FRAME_URL, REPO_URL } from '@site/lib/site';
import { Mark } from './Mark';

export function Faq({ c }: { c: Copy }) {
  return (
    <section className="faq" aria-labelledby="faq-title">
      <h2 id="faq-title">{c.faq.title}</h2>
      <dl>
        {c.faq.items.map((item) => (
          <div key={item.q} className="faq__item" data-reveal="">
            <dt>{item.q}</dt>
            <dd>{item.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function Footer({ c }: { c: Copy }) {
  return (
    <footer className="footer">
      <p className="footer__credits">{c.footer.credits}</p>
      <div className="footer__bar">
        <a className="footer__lockup" href={c.lang === 'es' ? '/es' : '/'}>
          <Mark size={20} />
          <span>Daybook</span>
        </a>
        <nav aria-label="Footer">
          <a href={REPO_URL}>GitHub</a>
          <a href={AGENTS_DOC_URL}>{c.footer.docs}</a>
          <a href={FRAME_URL}>{c.footer.frame}</a>
          <a href={c.footer.otherHref} hrefLang={c.lang === 'es' ? 'en' : 'es'}>
            {c.footer.other}
          </a>
          <a href={`${REPO_URL}/blob/main/LICENSE`}>{c.footer.license}</a>
          <a href={c.lang === 'es' ? '/es/code-signing' : '/code-signing'}>{c.footer.signing}</a>
        </nav>
      </div>
    </footer>
  );
}
