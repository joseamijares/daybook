import { SITE_URL } from '@site/lib/site';

// Search and AI crawlers are welcome (Jamak playbook: blocking one costs
// citations), and Content-Signal says so for search, AI answers and training.
// Nothing on this site is private. A route rather than robots.ts, which has no
// way to write the Content-Signal line.
const BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'Claude-SearchBot',
  'Claude-User',
  'ClaudeBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'CCBot',
  'Googlebot',
  'Bingbot',
];

const SIGNAL = 'Content-Signal: search=yes, ai-input=yes, ai-train=yes';

export function GET() {
  const body = [
    ...BOTS.map((bot) => `User-Agent: ${bot}`),
    SIGNAL,
    'Allow: /',
    '',
    'User-Agent: *',
    SIGNAL,
    'Allow: /',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
