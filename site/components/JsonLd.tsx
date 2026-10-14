import type { Copy } from '@site/lib/copy';
import { FILM, MAC_DOWNLOAD_URL, REPO_URL, SITE_URL } from '@site/lib/site';

// Structured data in the server HTML: the app, the site, the video and the visible FAQ.
const AUTHOR = { '@type': 'Person', name: 'José Antonio Mijares', url: 'https://github.com/joseamijares' };

export function JsonLd({ c }: { c: Copy }) {
  const url = c.lang === 'es' ? `${SITE_URL}/es` : SITE_URL;
  const graph = [
    {
      '@type': 'SoftwareApplication',
      name: 'Daybook',
      description: c.meta.description,
      url,
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'Web, macOS 14+',
      downloadUrl: MAC_DOWNLOAD_URL,
      ...(process.env.MAC_VERSION && { softwareVersion: process.env.MAC_VERSION }),
      author: AUTHOR,
      publisher: AUTHOR,
      isAccessibleForFree: true,
      license: 'https://opensource.org/licenses/MIT',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      sameAs: [REPO_URL],
    },
    { '@type': 'WebSite', name: 'Daybook', url: SITE_URL, inLanguage: c.lang },
    {
      '@type': 'VideoObject',
      name: c.film.work,
      description: c.film.body,
      thumbnailUrl: `${SITE_URL}${FILM.poster}`,
      contentUrl: `${SITE_URL}${FILM.landscape}`,
      uploadDate: FILM.published,
      duration: FILM.duration,
      inLanguage: 'en',
    },
    {
      '@type': 'FAQPage',
      inLanguage: c.lang,
      mainEntity: c.faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c') }}
    />
  );
}
