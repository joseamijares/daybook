import type { Metadata } from 'next';
import { copy, type Lang } from './copy';
import { SITE_URL } from './site';

export function metadataFor(lang: Lang): Metadata {
  const c = copy[lang];
  const path = lang === 'es' ? '/es' : '/';
  return {
    metadataBase: new URL(SITE_URL),
    title: c.meta.title,
    description: c.meta.description,
    alternates: { canonical: path, languages: { en: '/', es: '/es', 'x-default': '/' } },
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

// The day the page was prerendered, in UTC like the rotation.
export function builtOn(): string {
  return new Date().toISOString().slice(0, 10);
}
