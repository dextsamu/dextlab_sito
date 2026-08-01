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

/**
 * Immagine di un lavoro, se esiste, altrimenti null.
 *
 * Le schede del portfolio funzionano senza figura — il titolo, una riga e il
 * link al sito vero bastano — ma con l'anteprima funzionano meglio. Invece di
 * costruire un caricamento di file nel pannello, che vorrebbe un volume
 * persistente e una validazione dei tipi per una cosa che cambia tre volte
 * l'anno, la scheda cerca il file nel repository e lo mostra se c'è.
 *
 * Convenzione: public/assets/lavori/<host-senza-punti>.<estensione>, per esempio
 * `poderelavandaro.jpg` per https://poderelavandaro.it/. Il nome si ricava
 * dall'indirizzo, quindi non c'è un secondo campo da tenere allineato: si mette
 * il file, e alla build successiva la figura compare. Se non c'è, non compare
 * niente e non si rompe nulla.
 *
 * L'impronta arriva da versioned(): se un giorno sostituisci lo screenshot con
 * uno aggiornato, l'URL cambia da sé e nessuno vede quello vecchio in cache.
 */
const ESTENSIONI = ['webp', 'jpg', 'jpeg', 'png', 'avif'] as const;

export function immagineLavoro(url: string): string | null {
  const base = nomeDaIndirizzo(url);
  if (!base) return null;
  for (const est of ESTENSIONI) {
    const percorso = `/assets/lavori/${base}.${est}`;
    if (leggi(percorso)) return versioned(percorso);
  }
  return null;
}

/**
 * Dall'indirizzo al nome del file: si tiene solo l'host, senza «www.» e senza
 * punti. Se l'indirizzo non è valido si restituisce null invece di sollevare —
 * il campo lo compila una persona a mano nel pannello, e un errore di battitura
 * non deve far cadere la home.
 */
function nomeDaIndirizzo(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    // Solo caratteri sicuri per un nome di file: quello che resta è un host, ma
    // il valore arriva da un campo di testo e non lo si usa senza filtrarlo.
    return host.replace(/\.[a-z]{2,}$/i, '').replace(/[^a-z0-9-]/gi, '') || null;
  } catch {
    return null;
  }
}
