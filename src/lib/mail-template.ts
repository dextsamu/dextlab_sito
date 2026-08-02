/**
 * Le email del sito, vestite come il sito.
 *
 * Erano testo semplice, e per un avviso interno andava bene. Non va bene per le
 * email che riceve un cliente: la conferma di un appuntamento è la prima cosa che
 * arriva da Dext Lab dopo la pagina, e se sembra l'output di uno script il lavoro
 * fatto sul sito non conta niente.
 *
 * Una sola fonte per due rendering. La funzione riceve blocchi (un paragrafo, una
 * scheda di dati, dei pulsanti) e ne produce HTML e testo: se le due versioni
 * fossero scritte a mano finirebbero per divergere alla prima modifica, e chi
 * legge la versione testuale — perché il suo client blocca l'HTML, o perché è un
 * lettore di schermo — riceverebbe una email diversa da quella pensata.
 *
 * Regole di posta elettronica che qui sembrano arcaismi e non lo sono:
 *
 *  - Tabelle e non flexbox: Outlook usa il motore di Word, e di CSS moderno non sa
 *    nulla. Un layout a tabelle è brutto da scrivere e funziona in tutti i client.
 *  - Stili in linea: gran parte dei client butta via <style> nel <head>. Quello
 *    che deve arrivare va scritto sull'elemento.
 *  - I caratteri sono quelli di sistema: un @font-face verso il nostro dominio
 *    viene bloccato quasi sempre, e il ripiego sarebbe comunque un carattere di
 *    sistema. Meglio scegliere quale.
 *  - Nessuna immagine indispensabile: le immagini remote partono bloccate su
 *    Outlook e su Gmail per i mittenti non noti. Il logo è testo.
 *  - I pulsanti sono link dentro una cella colorata, non <button>: un bottone in
 *    una email non fa niente, e alcuni client lo rimuovono.
 *
 * Il fondo è scuro come il sito. È una scelta, non un automatismo: la modalità
 * scura di alcuni client rigira i colori dei messaggi chiari, e un messaggio già
 * scuro con i colori dichiarati su ogni cella resta quello che abbiamo disegnato.
 */

const BG = '#070b16';
const CARTA = '#0f1729';
const RIGA = '#1b2436';
const TESTO = '#eaf0f7';
const SPENTO = '#9aa7bd';
const CIANO = '#54c9c8';
const VERDE = '#8bd89e';

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

export interface Azione {
  label: string;
  url: string;
  /** Il pulsante pieno: uno solo per email, quello che si vuole far premere. */
  principale?: boolean;
}

export type Blocco =
  | { tipo: 'testo'; testo: string }
  /** Il fatto centrale dell'email: quando, in grande. */
  | { tipo: 'evidenza'; etichetta: string; valore: string; sotto?: string }
  /** Coppie etichetta/valore: i dettagli dell'appuntamento o del lead. */
  | { tipo: 'scheda'; righe: { nome: string; valore: string }[] }
  /** Testo dell'utente riportato: va distinto da quello che scriviamo noi. */
  | { tipo: 'citazione'; testo: string }
  | { tipo: 'azioni'; azioni: Azione[] }
  /** Una riga piccola, per le cose di servizio. */
  | { tipo: 'nota'; testo: string };

export interface Email {
  /** Prima riga grande dentro il messaggio. */
  titolo: string;
  /** Riga sotto il titolo, una sola. */
  sottotitolo?: string;
  blocchi: Blocco[];
  /** Riga di chiusura sotto la firma. */
  piede?: string;
}

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** I ritorni a capo del testo scritto da una persona diventano <br>. */
function aCapo(v: string): string {
  return esc(v).replace(/\r?\n/g, '<br>');
}

function bloccoHtml(b: Blocco): string {
  switch (b.tipo) {
    case 'testo':
      return `<tr><td style="padding:0 32px 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${TESTO}">${aCapo(b.testo)}</td></tr>`;

    case 'evidenza':
      return `<tr><td style="padding:4px 32px 20px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${RIGA};border-radius:12px">
    <tr><td style="padding:18px 22px;font-family:${FONT}">
      <div style="font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:${SPENTO};padding-bottom:6px">${esc(b.etichetta)}</div>
      <div style="font-size:20px;line-height:1.3;font-weight:600;color:${CIANO}">${esc(b.valore)}</div>
      ${b.sotto ? `<div style="font-size:13px;color:${SPENTO};padding-top:6px">${esc(b.sotto)}</div>` : ''}
    </td></tr>
  </table>
</td></tr>`;

    case 'scheda': {
      const righe = b.righe
        .map(
          (r) => `<tr>
      <td style="padding:7px 0;font-family:${FONT};font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:${SPENTO};white-space:nowrap;vertical-align:top">${esc(r.nome)}</td>
      <td style="padding:7px 0 7px 16px;font-family:${FONT};font-size:14px;line-height:1.5;color:${TESTO}">${aCapo(r.valore)}</td>
    </tr>`
        )
        .join('\n');
      return `<tr><td style="padding:0 32px 20px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${righe}</table>
</td></tr>`;
    }

    case 'citazione':
      return `<tr><td style="padding:0 32px 20px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${RIGA};border-radius:12px">
    <tr><td style="padding:16px 20px;font-family:${FONT};font-size:14px;line-height:1.6;color:${TESTO}">${aCapo(b.testo)}</td></tr>
  </table>
</td></tr>`;

    case 'azioni': {
      // Ogni pulsante in una cella sua: due <a> affiancati con il margine si
      // sovrappongono su Outlook.
      const celle = b.azioni
        .map((a) =>
          a.principale
            ? `<td style="padding:0 10px 10px 0">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="background:${CIANO};border-radius:999px">
            <a href="${esc(a.url)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:14px;font-weight:600;color:#04121a;text-decoration:none">${esc(a.label)}</a>
          </td>
        </tr></table>
      </td>`
            : `<td style="padding:0 10px 10px 0">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="border:1px solid ${RIGA};border-radius:999px">
            <a href="${esc(a.url)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:14px;color:${TESTO};text-decoration:none">${esc(a.label)}</a>
          </td>
        </tr></table>
      </td>`
        )
        .join('\n');
      return `<tr><td style="padding:4px 32px 12px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>${celle}</tr></table>
</td></tr>`;
    }

    case 'nota':
      return `<tr><td style="padding:0 32px 16px;font-family:${FONT};font-size:13px;line-height:1.6;color:${SPENTO}">${aCapo(b.testo)}</td></tr>`;
  }
}

function bloccoTesto(b: Blocco): string {
  switch (b.tipo) {
    case 'testo':
      return b.testo;
    case 'evidenza':
      return `${b.etichetta.toUpperCase()}\n${b.valore}${b.sotto ? `\n${b.sotto}` : ''}`;
    case 'scheda': {
      // Le etichette allineate: in un messaggio di solo testo la colonna è la
      // sola cosa che distingue una scheda da un paragrafo.
      const larghezza = Math.max(...b.righe.map((r) => r.nome.length));
      return b.righe.map((r) => `${r.nome.padEnd(larghezza)}  ${r.valore}`).join('\n');
    }
    case 'citazione':
      return b.testo
        .split(/\r?\n/)
        .map((r) => `> ${r}`)
        .join('\n');
    case 'azioni':
      return b.azioni.map((a) => `${a.label}: ${a.url}`).join('\n');
    case 'nota':
      return b.testo;
  }
}

/**
 * Il messaggio nelle due forme.
 *
 * `preheader` è la riga che i client mostrano in anteprima accanto all'oggetto:
 * senza, ci finisce il primo testo utile, che spesso è «Dext Lab». Sta nel
 * messaggio nascosta, perché non esiste un modo di dichiararla altrove.
 */
export function componiEmail(email: Email, base: string): { html: string; text: string } {
  const anno = new Date().getFullYear();
  const preheader = email.sottotitolo ?? email.titolo;

  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(email.titolo)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">

      <tr><td style="padding:0 8px 18px;font-family:${FONT};font-size:15px;letter-spacing:.14em;font-weight:700;color:${TESTO}">
        DEXT<span style="color:${CIANO}">LAB</span>
      </td></tr>

      <tr><td style="background:${CARTA};border-radius:18px;border-top:3px solid ${CIANO}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:30px 32px 6px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${TESTO}">
            ${esc(email.titolo)}
          </td></tr>
          ${
            email.sottotitolo
              ? `<tr><td style="padding:0 32px 20px;font-family:${FONT};font-size:15px;line-height:1.6;color:${SPENTO}">${esc(email.sottotitolo)}</td></tr>`
              : '<tr><td style="height:14px"></td></tr>'
          }
          ${email.blocchi.map(bloccoHtml).join('\n')}
          <tr><td style="padding:8px 32px 28px;font-family:${FONT};font-size:14px;line-height:1.6;color:${SPENTO}">
            ${email.piede ? `${esc(email.piede)}<br><br>` : ''}
            Dext Lab · <a href="mailto:info@dextlab.it" style="color:${CIANO};text-decoration:none">info@dextlab.it</a>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:18px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${SPENTO}">
        <a href="${esc(base)}" style="color:${SPENTO};text-decoration:underline">dextlab.it</a> · siti, web app ed e-commerce su misura
        <br>© ${anno} Dext Lab
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>
`;

  const text = [
    email.titolo,
    '='.repeat(Math.min(email.titolo.length, 60)),
    ...(email.sottotitolo ? ['', email.sottotitolo] : []),
    '',
    ...email.blocchi.map(bloccoTesto).filter((t) => t.trim() !== ''),
    '',
    ...(email.piede ? [email.piede, ''] : []),
    'Dext Lab · info@dextlab.it',
    base,
    '',
  ].join('\n\n');

  return { html, text };
}

/** Il verde della firma, per chi volesse un secondo accento. */
export const COLORI = { BG, CARTA, RIGA, TESTO, SPENTO, CIANO, VERDE };
