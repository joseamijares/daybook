import type { MetadataRoute } from 'next';
import { SITE_URL } from '@site/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const languages = { en: `${SITE_URL}/`, es: `${SITE_URL}/es` };
  return [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1, alternates: { languages } },
    { url: `${SITE_URL}/es`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9, alternates: { languages } },
    {
      url: `${SITE_URL}/code-signing`,
      changeFrequency: 'monthly',
      priority: 0.3,
      alternates: { languages: { en: `${SITE_URL}/code-signing`, es: `${SITE_URL}/es/code-signing` } },
    },
    {
      url: `${SITE_URL}/es/code-signing`,
      changeFrequency: 'monthly',
      priority: 0.3,
      alternates: { languages: { en: `${SITE_URL}/code-signing`, es: `${SITE_URL}/es/code-signing` } },
    },
  ];
}
