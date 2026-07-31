/**
 * URL degli asset statici con l'impronta del contenuto in coda.
 *
 * Perché serve, e non è un vezzo. Il sito PHP che c'era prima serviva CSS e JS
 * con un .htaccess che diceva:
 *
 *     ExpiresByType text/css        "access plus 7 days"
 *     ExpiresByType application/javascript "access plus 7 days"
 *
 * Sette giorni, senza rivalidazione. Chi ha visitato dextlab.it nella settimana
 * prima della migrazione ha quindi in cache uno style.css e un main.js
 * dell'epoca PHP che il browser riusa senza nemmeno chiedere se sono cambiati,
 * mentre l'HTML — generato dal server a ogni richiesta — è quello nuovo. Il
 * risultato è una pagina metà nuova e metà vecchia: regole che mancano, prezzi
 * senza layout, il logo dell'About stirato, la barra della stima che compare
 * come testo in fondo alla pagina.
 *
 * Nessuna intestazione che mettiamo oggi può cancellare quelle voci di cache.
 * L'unico modo di renderle irraggiungibili è chiedere un URL diverso: cambiando
 * il nome della risorsa, la vecchia voce non viene più consultata da nessuno.
 * L'impronta del contenuto fa anche un secondo lavoro utile per sempre: a ogni
 * modifica del file l'URL cambia da sé, quindi non esiste più il caso "ho fatto
 * il deploy ma vedo la versione di prima".
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** L'immagine è immutabile: l'impronta si calcola una volta per processo. */
const impronte = new Map<string, string>();

/**
 * Cerca il file su disco. Due posizioni, in ordine:
 * - dist/client, dove finiscono i file di public/ dopo la build. È il caso della
 *   produzione: l'entrypoint gira come `node ./dist/server/entry.mjs` da /app.
 * - public/, il caso di `astro dev`, dove la build non esiste.
 * Si parte da process.cwd() e non da import.meta.url perché il codice di
 * src/lib finisce dentro un chunk del bundle server, e la sua posizione
 * relativa a dist/client non è garantita.
 */
function leggi(percorso: string): Buffer | null {
  for (const base of ['dist/client', 'public']) {
    try {
      return readFileSync(join(process.cwd(), base, percorso));
    } catch {
      // File non lì: si prova la posizione successiva.
    }
  }
  return null;
}

/**
 * Restituisce il percorso con `?v=<impronta>`, o il percorso nudo se il file
 * non si trova. Non solleva mai: un asset senza impronta si carica comunque,
 * una pagina che non risponde no.
 */
export function versioned(percorso: string): string {
  const memo = impronte.get(percorso);
  if (memo !== undefined) return memo;

  const contenuto = leggi(percorso);
  const url = contenuto
    ? `${percorso}?v=${createHash('sha256').update(contenuto).digest('hex').slice(0, 10)}`
    : percorso;

  impronte.set(percorso, url);
  return url;
}
