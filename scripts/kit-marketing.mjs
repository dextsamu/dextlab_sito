/**
 * Conta i caratteri dei testi del kit e ne produce la copia autonoma.
 *
 * Il kit (marketing/kit-marketing.html) contiene i testi da incollare in Google
 * Ads, su Meta e sulla scheda Google. Quelle piattaforme tagliano a un numero
 * fisso di caratteri, e un titolo di 31 lettere viene semplicemente rifiutato:
 * il conteggio scritto a mano accanto a ogni riga invecchia alla prima modifica,
 * quindi lo scrive questo script e lo verifica la CI.
 *
 * Fa due cose, separate:
 *
 *   node scripts/kit-marketing.mjs            aggiorna i conteggi nel file
 *   node scripts/kit-marketing.mjs --verifica  controlla e non scrive niente
 *   node scripts/kit-marketing.mjs --out X     scrive in X la copia autonoma
 *
 * La copia autonoma incorpora i caratteri di public/fonts come data URI. Serve
 * perché quel file viene pubblicato e stampato in PDF fuori dal sito: con un
 * riferimento a /fonts/ resterebbe senza i suoi caratteri e nessuno se ne
 * accorgerebbe, che è il modo peggiore in cui una cosa può rompersi.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const radice = join(dirname(fileURLToPath(import.meta.url)), '..');
const SORGENTE = join(radice, 'marketing', 'kit-marketing.html');

const args = process.argv.slice(2);
const soloVerifica = args.includes('--verifica');
const indiceOut = args.indexOf('--out');
const destinazione = indiceOut >= 0 ? args[indiceOut + 1] : null;

/** Il testo come lo conta la piattaforma: entità sciolte, spazi normalizzati. */
function testoVero(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

const originale = readFileSync(SORGENTE, 'utf8');

/*
  Un blocco da copiare seguito dal suo contatore. La coppia è sempre nella stessa
  forma — il contatore viene subito dopo la chiusura del blocco — quindi non
  serve un parser: serve che la forma resti quella, e se cambia questo script
  smette di trovare le coppie e la verifica lo dice.

  Due dettagli che sembrano dettagli e non lo sono. Il centro non può contenere
  una chiusura di <code>: senza quel divieto una parentesi non greedy si allarga
  comunque fino al primo contatore utile, inghiotte i blocchi che non hanno un
  conteggio (le parole escluse, la formula del budget) e attribuisce la loro
  lunghezza al blocco sbagliato — provato: il primo testo di Meta risultava di
  2512 caratteri. E il contatore si riconosce anche quando è già pieno, così lo
  script si può rieseguire e aggiorna i numeri invece di non trovarli più.
*/
const COPPIA =
  /<code class="copia">((?:(?!<\/code>)[\s\S])*)<\/code>\s*<span class="conta[^"]*"([^>]*)>[^<]*<\/span>/g;

const problemi = [];
let coppie = 0;

const aggiornato = originale.replace(COPPIA, (_intero, testo, attributi) => {
  coppie += 1;
  const contenuto = testoVero(testo);
  const lunghezza = [...contenuto].length; // per punti di codice, non per byte
  const limiteMatch = attributi.match(/data-limite="(\d+)"/);
  const limite = limiteMatch ? Number(limiteMatch[1]) : null;
  const taglio = /data-modo="taglio"/.test(attributi);

  let etichetta;
  let stretto = false;
  if (limite === null) {
    etichetta = `${lunghezza} caratteri`;
  } else if (taglio) {
    // Qui il limite non è un massimo: è il punto in cui la piattaforma taglia
    // con «Altro». Il testo può essere più lungo, ma quello che convince deve
    // stare prima.
    etichetta = `${lunghezza} caratteri · si legge fino a ${limite}`;
  } else {
    etichetta = `${lunghezza}/${limite}`;
    if (lunghezza > limite) {
      stretto = true;
      problemi.push(`${lunghezza}/${limite} — ${contenuto.slice(0, 60)}`);
    }
  }

  const classe = stretto ? 'conta stretto' : 'conta';
  const puliti = attributi.replace(/\s*class="[^"]*"/, '');
  return `<code class="copia">${testo}</code>\n      <span class="${classe}"${puliti}>${etichetta}</span>`;
});

if (coppie === 0) {
  console.error('[kit] nessun blocco da contare: la forma del file è cambiata.');
  process.exit(1);
}

for (const p of problemi) console.error(`[kit] fuori limite: ${p}`);

if (!soloVerifica && aggiornato !== originale) {
  writeFileSync(SORGENTE, aggiornato);
  console.log(`[kit] conteggi aggiornati su ${coppie} blocchi.`);
} else {
  console.log(`[kit] ${coppie} blocchi contati, ${problemi.length} fuori limite.`);
}

if (destinazione) {
  /*
    I caratteri diventano data URI. Il sottoinsieme «latin» basta per l'italiano
    — le lettere accentate stanno tutte in Latin-1 — quindi si incorpora un file
    per famiglia e non due.
  */
  let autonomo = soloVerifica ? originale : aggiornato;
  const caratteri = [
    ['/fonts/inter-latin.woff2', 'public/fonts/inter-latin.woff2'],
    ['/fonts/space-grotesk-latin.woff2', 'public/fonts/space-grotesk-latin.woff2'],
  ];
  for (const [riferimento, percorso] of caratteri) {
    const dati = readFileSync(join(radice, percorso)).toString('base64');
    if (!autonomo.includes(riferimento)) {
      console.error(`[kit] riferimento non trovato nel sorgente: ${riferimento}`);
      process.exit(1);
    }
    autonomo = autonomo.replace(riferimento, `data:font/woff2;base64,${dati}`);
  }
  writeFileSync(destinazione, autonomo);
  console.log(`[kit] copia autonoma in ${destinazione} (${Math.round(autonomo.length / 1024)} KB).`);
}

process.exit(problemi.length > 0 ? 1 : 0);
