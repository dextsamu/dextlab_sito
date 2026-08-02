/**
 * Le email, guardabili e controllabili senza spedirle.
 *
 *   npm run mail            scrive i file HTML in data/anteprima-mail/ e li elenca
 *   npm run mail -- --verifica   controlla le regole e non scrive niente
 *
 * Perché esiste: un'email si scopre sbagliata dal destinatario, ed è tardi. Qui i
 * messaggi si costruiscono con dati d'esempio, si apre il file in un browser e si
 * vede quello che vedrà lui. La stessa funzione, con --verifica, è ciò che gira in
 * CI: le regole controllate sono quelle che si rompono in silenzio — una versione
 * testuale vuota, un dato dell'utente finito nell'HTML senza essere sfuggito, un
 * link presente in una forma e non nell'altra.
 *
 * Va eseguito con --experimental-strip-types perché importa direttamente i moduli
 * TypeScript del sito: rendere i messaggi da una copia sarebbe controllare una
 * copia.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { messaggiDiEsempio, messaggioPrenotazione } from '../src/lib/mail-messaggi.ts';
import { componiEmail } from '../src/lib/mail-template.ts';

const BASE = 'https://dextlab.it';
const verifica = process.argv.includes('--verifica');
const cartella = join(process.cwd(), 'data', 'anteprima-mail');

const messaggi = messaggiDiEsempio(BASE);
let errori = 0;

function male(dove, cosa) {
  console.error(`✗ ${dove}: ${cosa}`);
  errori++;
}

for (const { nome, messaggio } of messaggi) {
  const { html, text } = componiEmail(messaggio.email, BASE);

  if (!messaggio.subject.trim()) male(nome, 'oggetto vuoto');
  if (messaggio.subject.length > 120) male(nome, `oggetto di ${messaggio.subject.length} caratteri`);
  if (text.trim().length < 80) male(nome, 'versione testuale troppo corta o vuota');
  if (!html.includes('<!doctype html>')) male(nome, 'HTML senza doctype');
  // Il titolo deve arrivare in entrambe le forme: è la riga che dice cosa è
  // successo, e chi legge il testo semplice non deve riceverne una diversa.
  if (!text.includes(messaggio.email.titolo)) male(nome, 'il titolo manca nella versione testuale');
  if (!html.includes(messaggio.email.titolo.replace(/&/g, '&amp;')))
    male(nome, 'il titolo manca nell’HTML');
  // Ogni link deve esserci in entrambe: chi legge il testo semplice non ha i
  // pulsanti, e senza l'indirizzo scritto non può fare niente.
  for (const b of messaggio.email.blocchi) {
    if (b.tipo !== 'azioni') continue;
    for (const a of b.azioni) {
      if (!html.includes(a.url)) male(nome, `link «${a.label}» assente nell’HTML`);
      if (!text.includes(a.url)) male(nome, `link «${a.label}» assente nel testo`);
    }
  }
  // Tabelle e non layout moderni: è l'unica cosa che Outlook sa disegnare.
  if (!html.includes('role="presentation"')) male(nome, 'nessuna tabella di impaginazione');
  if (/style="[^"]*display:\s*flex/.test(html)) male(nome, 'usa flexbox, che Outlook ignora');

  if (!verifica) {
    mkdirSync(cartella, { recursive: true });
    writeFileSync(join(cartella, `${nome}.html`), html);
    writeFileSync(join(cartella, `${nome}.txt`), `Oggetto: ${messaggio.subject}\n\n${text}`);
  }
  console.log(
    `${verifica ? 'ok  ' : 'scritto '} ${nome.padEnd(24)} ${messaggio.subject.slice(0, 60)}`
  );
}

// Il testo scritto da chi prenota finisce dentro l'email: se non venisse sfuggito,
// un tag nelle note diventerebbe markup nella casella di posta di chi lo riceve.
{
  const cattivo = '<script>alert(1)</script> & "virgolette"';
  const { html, text } = componiEmail(
    messaggioPrenotazione(
      {
        name: cattivo,
        email: 'x@esempio.it',
        phone: '',
        note: cattivo,
        starts_at: new Date('2026-09-15T07:30:00.000Z'),
        minutes: 30,
        token: '0'.repeat(32),
      },
      `${BASE}/prenota/${'0'.repeat(32)}`,
      'Dext Lab'
    ).email,
    BASE
  );
  if (html.includes('<script>')) male('sfuggite', 'un tag scritto da chi prenota è finito nell’HTML');
  else console.log(`${verifica ? 'ok  ' : 'provato '} sfuggite${' '.repeat(17)} un tag nelle note non diventa markup`);
  if (!text.includes('<script>')) male('sfuggite', 'la versione testuale non riporta il testo originale');
}

if (verifica && errori > 0) {
  console.error(`\n${errori} problemi nelle email.`);
  process.exit(1);
}
if (!verifica) console.log(`\nAperture: file://${cartella}/`);
