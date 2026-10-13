import type { Copy } from '@site/lib/copy';
import { MAC_DOWNLOAD_URL, REPO_URL, SITE_URL } from '@site/lib/site';

// Structured data in the server HTML: the app, the site, and the visible FAQ.
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
      softwareVersion: '0.1.0',
      isAccessibleForFree: true,
      license: 'https://opensource.org/licenses/MIT',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      sameAs: [REPO_URL],
    },
    { '@type': 'WebSite', name: 'Daybook', url: SITE_URL, inLanguage: c.lang },
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
