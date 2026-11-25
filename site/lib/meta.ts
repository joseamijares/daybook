import type { Metadata } from 'next';
import { copy, type Lang } from './copy';
import { SITE_URL } from './site';

export function metadataFor(lang: Lang): Metadata {
  const c = copy[lang];
  // Absolute, so the home page is /daybook and not /daybook/ (a relative '/'
  // composed with metadataBase keeps the trailing slash).
  const home = SITE_URL;
  const path = lang === 'es' ? `${SITE_URL}/es` : home;
  return {
    metadataBase: new URL(SITE_URL),
    title: c.meta.title,
    description: c.meta.description,
    alternates: { canonical: path, languages: { en: home, es: `${SITE_URL}/es`, 'x-default': home } },
    openGraph: {
      type: 'website',
      siteName: 'Daybook',
      title: c.meta.title,
      description: c.meta.description,
      url: path,
      locale: lang === 'es' ? 'es_MX' : 'en_US',
      images: [{ url: '/og.jpg', width: 1200, height: 630, alt: c.hero.title }],
    },
    twitter: { card: 'summary_large_image', title: c.meta.title, description: c.meta.description, images: ['/og.jpg'] },
  };
}

// The code signing policy (/code-signing, /es/code-signing), which SignPath
// Foundation asks every signed project to publish.
export function signingMetadataFor(lang: Lang): Metadata {
  const c = copy[lang];
  const path = lang === 'es' ? '/es/code-signing' : '/code-signing';
  return {
    metadataBase: new URL(SITE_URL),
    title: c.signing.meta.title,
    description: c.signing.meta.description,
    alternates: { canonical: path, languages: { en: '/code-signing', es: '/es/code-signing', 'x-default': '/code-signing' } },
  };
}

// The day the page was prerendered, in UTC like the rotation.
export function builtOn(): string {
  return new Date().toISOString().slice(0, 10);
}
