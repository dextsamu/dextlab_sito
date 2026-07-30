/**
 * robots.txt dinamico: la riga Sitemap deve puntare all'host realmente
 * servito. Il file statico precedente indicava dextlab.it e disabilitava
 * /contact.php, un percorso che non esiste più.
 */
import type { APIRoute } from 'astro';
import { siteUrl } from '../lib/env.ts';

export const GET: APIRoute = () => {
  const base = siteUrl();
  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin

Sitemap: ${new URL('/sitemap.xml', base + '/').href}
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
