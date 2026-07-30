// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// SSR obbligatorio: gate manutenzione, admin e contenuti modificabili dal
// pannello senza rebuild. Le pagine legali restano prerender (vedi prerender
// nei rispettivi file).
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  site: process.env.SITE_URL || 'https://dextlab.it',
  server: { port: Number(process.env.PORT) || 4321, host: true },
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'never' },
});
