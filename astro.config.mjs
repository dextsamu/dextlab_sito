// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// SSR obbligatorio: gate manutenzione, admin e contenuti modificabili dal
// pannello senza rebuild. Le pagine legali restano prerender (vedi prerender
// nei rispettivi file).
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),

  security: {
    // Il controllo di origine integrato è disattivato e sostituito da quello in
    // src/middleware.ts, perché dietro un reverse proxy che termina il TLS non
    // può funzionare: confronta l'header Origin con url.origin, e l'adapter Node
    // costruisce quell'URL da req.socket.encrypted, ignorando X-Forwarded-Proto.
    // Il risultato è "https://sito" contro "http://sito" e ogni invio di form
    // viene respinto con 403, anche quando è perfettamente legittimo.
    // Il nostro controllo confronta gli host, che è ciò che conta per il CSRF,
    // ed è indifferente allo schema visto dal processo.
    checkOrigin: false,
  },
  site: process.env.SITE_URL || 'https://dextlab.it',
  server: { port: Number(process.env.PORT) || 4321, host: true },
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'never' },
});
