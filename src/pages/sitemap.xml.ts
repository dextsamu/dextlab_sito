/**
 * Sitemap generata da SITE_URL invece che scritta a mano: nella versione
 * precedente il file statico elencava dextlab.it mentre il sito veniva servito
 * su un altro host, e i due valori non potevano restare allineati.
 */
import type { APIRoute } from 'astro';
import { siteUrl } from '../lib/env.ts';
import { lavoriConPagina } from '../lib/content.ts';

const PAGES = [
  { path: '/', changefreq: 'monthly', priority: '1.0' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/termini', changefreq: 'yearly', priority: '0.3' },
];

export const GET: APIRoute = async () => {
  const base = siteUrl();
  /*
    Le pagine dei lavori si aggiungono da sé: nascono quando qualcuno scrive il
    testo nel pannello e spariscono quando il lavoro viene spento, quindi
    elencarle a mano qui vorrebbe dire promettere indirizzi che poi rispondono
    404. Stessa ragione per cui la sitemap non è un file statico.
  */
  const lavori = (await lavoriConPagina()).map((slug) => ({
    path: `/lavori/${slug}`,
    changefreq: 'monthly',
    priority: '0.6',
  }));

  const urls = [...PAGES, ...lavori].map((p) => {
    const loc = new URL(p.path, base + '/').href;
    return `  <url>
    <loc>${loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
