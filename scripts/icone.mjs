/**
 * Controlla le icone della pagina protezione dati.
 *
 * `IconaGdpr` non disegna niente quando il nome non esiste. È una scelta voluta —
 * meglio un buco che l'icona sbagliata accanto a una frase — ma ha un rovescio:
 * un nome scritto male non fa rumore. La pagina esce, la card ha un buco al posto
 * dell'icona, e il difetto si vede solo guardando quella card su quello schermo.
 * Questo script è il rumore che manca.
 *
 * Controlla tre cose:
 *   1. ogni nome chiesto dalle pagine esiste fra i tracciati;
 *   2. ogni tracciato è chiesto da qualcuno (un'icona che nessuno usa è peso
 *      morto: si porta dietro le modifiche e non le si vede mai rese);
 *   3. i tracciati restano decorativi e a colore ereditato — nessun `fill`
 *      diverso da currentColor, che sul tema scuro uscirebbe come una macchia,
 *      e nessun titolo dentro l'SVG, che un lettore di schermo leggerebbe
 *      raddoppiando la frase accanto.
 *
 * Come trova i nomi chiesti: le pagine passano il nome in due modi, `nome="..."`
 * scritto a mano e `nome={x.icona}` preso da un array di dati. Il secondo non si
 * può risolvere leggendo il file, quindi lo script raccoglie i valori scritti
 * come `icona: '...'` nei file che importano il componente. È una regola sulla
 * forma del codice, non un'analisi: se un domani i dati chiamassero quel campo
 * in un altro modo, lo script non li vedrebbe più — per questo il conteggio dei
 * tracciati non usati è un errore e non un avviso, così la svista si nota subito.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RADICE = new URL('..', import.meta.url).pathname;
const COMPONENTE = join(RADICE, 'src/components/IconaGdpr.astro');

const sorgente = readFileSync(COMPONENTE, 'utf8');
const inizio = sorgente.indexOf('const TRACCIATI');
if (inizio < 0) {
  console.error('::error::in IconaGdpr.astro non trovo la tabella TRACCIATI');
  process.exit(1);
}
const tabella = sorgente.slice(inizio, sorgente.indexOf('};', inizio));

/* Una voce per riga: `nome:` e poi la stringa, che può stare sulla riga dopo
   perché il formattatore va a capo quando il tracciato è lungo. */
const tracciati = new Map();
for (const m of tabella.matchAll(/^ {2}([a-z]+):\s*\n?\s*'([\s\S]*?)',\s*$/gm)) {
  tracciati.set(m[1], m[2]);
}

const files = [];
(function raccogli(dir) {
  for (const voce of readdirSync(dir)) {
    const p = join(dir, voce);
    if (statSync(p).isDirectory()) raccogli(p);
    else if (p.endsWith('.astro')) files.push(p);
  }
})(join(RADICE, 'src'));

const chiesti = new Map(); // nome -> file che lo chiede
for (const f of files) {
  if (f === COMPONENTE) continue;
  const t = readFileSync(f, 'utf8');
  if (!t.includes('IconaGdpr')) continue;
  for (const m of t.matchAll(/nome="([a-z]+)"/g)) chiesti.set(m[1], f);
  for (const m of t.matchAll(/\bicona:\s*'([a-z]+)'/g)) chiesti.set(m[1], f);
}

let errori = 0;
const breve = (f) => f.replace(RADICE, '');

if (tracciati.size === 0) {
  console.error('::error::nessun tracciato letto: la tabella ha cambiato forma');
  errori = 1;
}
if (chiesti.size === 0) {
  console.error('::error::nessun nome di icona trovato nelle pagine');
  errori = 1;
}

for (const [nome, file] of chiesti) {
  if (tracciati.has(nome)) continue;
  console.error(`::error::${breve(file)} chiede l'icona «${nome}», che non esiste: uscirebbe un buco`);
  errori = 1;
}

for (const nome of tracciati.keys()) {
  if (chiesti.has(nome)) continue;
  console.error(`::error::l'icona «${nome}» non è chiesta da nessuna pagina`);
  errori = 1;
}

for (const [nome, d] of tracciati) {
  for (const m of d.matchAll(/fill="([^"]*)"/g)) {
    if (m[1] === 'currentColor') continue;
    console.error(`::error::l'icona «${nome}» ha fill="${m[1]}": sul tema scuro non eredita il colore`);
    errori = 1;
  }
  if (/<title|aria-label/.test(d)) {
    console.error(`::error::l'icona «${nome}» ha un titolo dentro: le icone qui sono decorative`);
    errori = 1;
  }
}

/* Il componente resta decorativo e a tratto ereditato: se qualcuno gli togliesse
   aria-hidden, ogni card della pagina si farebbe annunciare l'icona prima della
   frase che dice già la stessa cosa. */
for (const atteso of ['aria-hidden="true"', 'stroke="currentColor"', 'viewBox="0 0 24 24"']) {
  if (sorgente.includes(atteso)) continue;
  console.error(`::error::IconaGdpr.astro non ha più ${atteso}`);
  errori = 1;
}

console.log(
  `[icone] ${tracciati.size} tracciati, ${chiesti.size} chiesti dalle pagine, ${errori === 0 ? 'nessun buco' : 'con errori'}.`,
);
process.exit(errori);
