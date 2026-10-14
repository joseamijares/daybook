import Script from 'next/script';
import type { Lang } from '@site/lib/copy';
import { copy } from '@site/lib/copy';
import { consentDefault } from '@site/lib/consent';
import { fontVars } from '@site/lib/fonts';
import { CLARITY_ID, GA_ID } from '@site/lib/site';
import { Analytics } from './Analytics';
import '@site/app/site.css';

// The <html> for each language's root layout. `js` on <html> before first
// paint lets the stylesheet hold things back for their entrance; without
// JavaScript everything is simply there.
export function Shell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const tracking = Boolean(GA_ID || CLARITY_ID);
  return (
    <html lang={lang} className={fontVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        {children}
        {tracking && (
          <>
            <Script id="consent-default" strategy="beforeInteractive">
              {consentDefault}
            </Script>
            <Analytics c={copy[lang]} gaId={GA_ID} clarityId={CLARITY_ID} />
          </>
        )}
      </body>
    </html>
  );
}
