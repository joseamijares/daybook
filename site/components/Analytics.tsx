'use client';

import { GoogleAnalytics } from '@next/third-parties/google';
import Script from 'next/script';
import { useEffect, useState } from 'react';
import type { Copy } from '@site/lib/copy';

const KEY = 'daybook.site.consent';
type Choice = 'granted' | 'denied';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

function apply(choice: Choice) {
  window.gtag?.('consent', 'update', { analytics_storage: choice });
  window.clarity?.('consentv2', { ad_Storage: 'denied', analytics_Storage: choice });
}

// GA4 + Clarity per the Jamak playbook: the consent default runs before GA
// (see consentDefault in the layout), the visitor's choice is remembered, and
// nothing loads at all unless the IDs are set.
export function Analytics({ c, gaId, clarityId }: { c: Copy; gaId: string | null; clarityId: string | null }) {
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {}
    if (saved === 'granted' || saved === 'denied') apply(saved);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- only after mount: the banner depends on this browser's storage
    else setAsk(true);
  }, []);

  const choose = (choice: Choice) => {
    try {
      localStorage.setItem(KEY, choice);
    } catch {}
    apply(choice);
    setAsk(false);
  };

  return (
    <>
      {gaId && <GoogleAnalytics gaId={gaId} />}
      {clarityId && (
        <Script
          id="clarity"
          strategy="afterInteractive"
        >{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(clarityId)});`}</Script>
      )}
      {ask && (
        <div className="consent" role="dialog" aria-label={c.consent.text}>
          <p>{c.consent.text}</p>
          <div>
            <button type="button" className="pill pill--ink pill--small" onClick={() => choose('granted')}>
              {c.consent.accept}
            </button>
            <button type="button" className="pill pill--line pill--small" onClick={() => choose('denied')}>
              {c.consent.reject}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
