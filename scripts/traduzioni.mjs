/**
 * Le domande del configuratore hanno tutte la loro traduzione.
 *
 * Il difetto è già capitato, in questo stesso batch: le quattro domande sul
 * contesto sono nate in src/lib/richiesta.ts e nessuno le ha aggiunte al
 * dizionario, quindi il sito in inglese mostrava dodici pillole in italiano in
 * mezzo a una pagina tradotta. Non si vede scrivendo il codice — bisogna aprire il
 * sito, premere EN e guardare quel pezzo — e non lo dice nessun errore.
 *
 * Un sito mezzo tradotto è peggio di un sito non tradotto: sembra un guasto
 * invece di una scelta.
 *
 * Il controllo copre le stringhe che arrivano dai DATI, cioè quelle di
 * richiesta.ts, perché sono quelle destinate a crescere: la prossima domanda si
 * aggiunge là, in dieci righe, e il dizionario sta in un altro file. Le stringhe
 * scritte a mano nei componenti NON sono coperte — sarebbero da estrarre dal
 * markup, e un controllo che indovina cosa è testo e cosa è markup produce falsi
 * allarmi, che è il modo più sicuro di far ignorare una guardia.
 */
import { readFileSync } from 'node:fs';

const RADICE = new URL('..', import.meta.url).pathname;
const richiesta = readFileSync(RADICE + 'src/lib/richiesta.ts', 'utf8');
const dizionario = readFileSync(RADICE + 'public/js/i18n.js', 'utf8');

/* Le stringhe che finiscono in pagina: il titolo della domanda e il testo di ogni
   scelta. `etichetta` no — quella la legge solo chi riceve la email, e la email
   è in italiano. */
/* La chiave può stare in mezzo a una riga e non solo a capo: le scelte sono
   scritte tutte su una riga, `{ v: 'parte', testo: 'In parte' },`. Con la ricerca
   ancorata a inizio riga questo script leggeva i quattro titoli e nessuna delle
   dodici scelte — cioè passava anche togliendo «In parte» dal dizionario, che è
   esattamente il caso che deve trovare. Il conteggio in fondo esiste per questo:
   un numero che cala è la spia che la lettura si è rotta. */
const daTradurre = new Set();
for (const m of richiesta.matchAll(/\b(?:titolo|testo):\s*'((?:[^'\\]|\\.)*)'/g)) {
  daTradurre.add(m[1].replace(/\\'/g, "'"));
}
/* Quante ne aspettiamo: una per domanda più una per scelta. Se il formato dei dati
   cambia e la lettura ne trova meno, lo si sa qui e non aprendo il sito in
   inglese. */
const attese =
  (richiesta.match(/^\s{4}campo:/gm) ?? []).length + (richiesta.match(/\{\s*v:\s*'/g) ?? []).length;

let errori = 0;
if (daTradurre.size !== attese) {
  console.error(
    `::error::lette ${daTradurre.size} stringhe da richiesta.ts ma le domande e le scelte sono ${attese}: il formato è cambiato e questo controllo non le vede più tutte`
  );
  errori = 1;
}

/* Una chiave del dizionario, in una delle due forme che il file usa: apice
   semplice, oppure doppio quando la stringa contiene un apostrofo. */
const haChiave = (s) => {
  const doppie = s.replace(/"/g, '\\"');
  return dizionario.includes(`'${s}':`) || dizionario.includes(`"${doppie}":`);
};

for (const s of daTradurre) {
  if (haChiave(s)) continue;
  console.error(`::error::«${s}» non ha una traduzione in public/js/i18n.js`);
  errori = 1;
}

console.log(
  `[traduzioni] ${daTradurre.size} stringhe del configuratore, ${errori === 0 ? 'tutte tradotte' : 'con buchi'}.`
);
process.exit(errori);
