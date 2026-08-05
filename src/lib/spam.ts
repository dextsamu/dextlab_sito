/**
 * Riconoscere un contatto automatico senza perdere quelli veri.
 *
 * LA REGOLA DA CUI DIPENDE TUTTO IL RESTO: qui non si RIFIUTA niente. Il lead
 * viene salvato sempre, e questo file decide soltanto se far partire la notifica.
 * Il motivo è il conto dei danni, che non è simmetrico:
 *
 *   un falso positivo  = una risposta in ritardo, il lead è nel pannello sotto «Spam»
 *   un falso negativo  = una email di spazzatura in più
 *   un contatto perso  = un cliente perso, e nessuno se ne accorge
 *
 * La terza è l'unica irreparabile, quindi non deve poter succedere: nessun
 * punteggio, nessuna soglia e nessun errore in questo file può impedire il
 * salvataggio. Chi lo modifica deve tenere questa proprietà.
 *
 * A chi manda, si risponde sempre «messaggio inviato». Dire a un bot che è stato
 * riconosciuto serve solo a farlo migliorare.
 *
 * I SEGNALI, e perché questi.
 *
 * Sono divisi in due categorie e la differenza è la certezza, non la gravità:
 *
 *   CERTI    da soli bastano. Sono cose che una persona che scrive dall'Italia a
 *            un web designer non fa MAI: riempire un campo che non vede, scrivere
 *            BBCode, scrivere in cirillico.
 *   INDIZI   valgono punti. Da due punti in su è spam. Ognuno preso da solo ha un
 *            uso legittimo — un cliente che incolla l'indirizzo del suo sito
 *            attuale è la cosa più normale del mondo — quindi nessuno decide da
 *            solo.
 *
 * Il file è puro: nessun accesso al database, nessuna lettura di richiesta. Gli
 * arriva già calcolato quello che non può sapere (il tempo di compilazione, se il
 * token della visita era valido, se lo stesso testo è già arrivato), così si può
 * provare su una tabella di esempi senza avere un server — vedi npm run spam.
 */

import { signPayload, verifyPayload } from './crypto.ts';
import { appSecret } from './env.ts';

/**
 * La marca temporale da mettere nel modulo, firmata.
 *
 * Firmata e non in chiaro perché un bot che vede un numero lo cambia. Con la
 * firma può solo togliere il campo o rovinarlo, e in entrambi i casi il risultato
 * è «marca assente», che non è un indizio (vedi Contesto.secondi).
 */
export function marcaOra(): string {
  try {
    return signPayload({ t: Date.now() }, appSecret());
  } catch {
    /* APP_SECRET assente: il modulo esce senza marca e il contatto vale come
       quelli delle pagine vecchie. Un segreto mancante è un problema di
       configurazione, non un motivo per non far scrivere la gente. */
    return '';
  }
}

/**
 * I secondi fra il rendering e l'invio, o null se non si possono sapere.
 *
 * Null in tre casi, tutti innocui: campo assente (pagina vecchia in cache o invio
 * diretto), firma non valida (qualcuno ha provato a cambiarlo), marca nel futuro
 * o più vecchia di un giorno (orologi sballati, pagina rimasta aperta una notte).
 * Un valore che non si sa non deve pesare in nessuna direzione.
 */
export function secondiDaMarca(valore: string): number | null {
  if (valore === '') return null;
  let dati: { t?: unknown } | null = null;
  try {
    dati = verifyPayload<{ t?: unknown }>(valore, appSecret());
  } catch {
    return null;
  }
  if (!dati || typeof dati.t !== 'number') return null;
  const secondi = Math.round((Date.now() - dati.t) / 1000);
  if (secondi < 0 || secondi > 86_400) return null;
  return secondi;
}

/** Quello che il chiamante ha già misurato e questo file non può sapere. */
export interface Contesto {
  /**
   * Secondi fra il rendering della pagina e l'invio, dalla marca temporale
   * firmata nel modulo. `null` quando la marca manca o non è verificabile.
   *
   * Il caso `null` NON è un indizio, ed è deliberato: una pagina rimasta nella
   * cache del browser da prima di questa modifica non ha il campo, e il
   * visitatore che la usa non ha fatto niente di male.
   */
  secondi: number | null;
  /**
   * Il modulo portava il token di una visita reale e recente.
   *
   * Vale un solo punto e non di più: quando il database non risponde la pagina
   * viene servita senza token (vedi Contatti.astro), quindi la sua assenza può
   * essere colpa nostra.
   */
  visitaValida: boolean;
  /** Lo stesso testo è già arrivato di recente: la ripetizione è la firma di un bot. */
  ripetuto: boolean;
  /** Il campo trappola era compilato. */
  trappola: boolean;
}

export interface Esito {
  spam: boolean;
  punti: number;
  /** In italiano e per esteso: finiscono nel pannello, li legge una persona. */
  motivi: string[];
}

/**
 * Da tre punti in su non si notifica.
 *
 * Era due, e due era sbagliato: «un indirizzo web nel messaggio» (1) più
 * «inviato senza passare da una pagina del sito» (1) faceva esattamente due, e
 * quella somma capita a una persona vera. Basta che il token della visita sia
 * scaduto — pagina aperta e lasciata lì una notte, sono 12 ore — e che il
 * cliente incolli l'indirizzo del suo sito attuale, che in un modulo di
 * rifacimento è la cosa più normale che possa scrivere.
 *
 * L'ho scoperto provando l'endpoint vero: il banco di prova aveva quel contatto
 * con il token valido e passava. Con tre, due indizi deboli non bastano più e
 * servono o due segnali forti o un segnale forte più uno debole.
 */
export const SOGLIA = 3;

/*
  Alfabeti che questo sito non riceve da clienti veri. Sono intervalli di
  codepoint scritti come escape e non caratteri incollati: un carattere cirillico
  in mezzo a un file di codice è invisibile a chi lo legge, e chi normalizza il
  file lo può cancellare senza accorgersene — la regola sparirebbe senza lasciare
  traccia. Le lettere accentate italiane sono latine e non entrano qui.
*/
const ALFABETI_ESTRANEI = new RegExp(
  '[' +
    '\\u0400-\\u052f' + // cirillico e supplemento
    '\\u0370-\\u03ff' + // greco
    '\\u0590-\\u05ff' + // ebraico
    '\\u0600-\\u06ff' + // arabo
    '\\u3040-\\u30ff' + // hiragana e katakana
    '\\u4e00-\\u9fff' + // ideogrammi
    '\\uac00-\\ud7af' + // hangul
    ']'
);

/* Marcatori di impaginazione in un campo di testo semplice. Un modulo di contatto
   non li interpreta: chi li scrive sta compilando un forum, cioè sta usando un
   programma che compila moduli in serie. */
const IMPAGINAZIONE = /\[url[=\]]|\[\/url\]|\[link|<a\s+href|<\/a>|\[b\]|<script/i;

/**
 * Quanti indirizzi web ci sono in un testo.
 *
 * L'alternativa consuma l'indirizzo INTERO fino allo spazio, e non è un
 * dettaglio: con `https?:\/\/|www\.` — due alternative che possono comparire
 * nello stesso indirizzo — `https://www.trattoriarossi.it` contava due link, e
 * due link fanno due punti, cioè spam. Il banco di prova ha scartato al primo
 * giro il cliente che incolla il proprio sito, che è la cosa più normale che
 * possa scrivere in un modulo di rifacimento.
 */
function contaLink(testo: string): number {
  return (testo.match(/(?:https?:\/\/|www\.)\S+/gi) ?? []).length;
}

/**
 * Il verdetto su un contatto.
 *
 * L'ordine dei controlli non conta per l'esito ma conta per i motivi: si mettono
 * prima i certi, così chi legge il pannello trova in cima la ragione vera invece
 * di tre indizi.
 */
export function valutaContatto(
  campi: { name: string; email: string; subject: string; message: string },
  ctx: Contesto
): Esito {
  const motivi: string[] = [];
  let punti = 0;
  let certo = false;

  const tutto = `${campi.name}\n${campi.subject}\n${campi.message}`;

  // ---- Certi ---------------------------------------------------------------
  if (ctx.trappola) {
    motivi.push('ha compilato il campo nascosto');
    certo = true;
  }
  if (IMPAGINAZIONE.test(tutto)) {
    motivi.push('contiene marcatori di impaginazione (BBCode o HTML)');
    certo = true;
  }
  if (ALFABETI_ESTRANEI.test(tutto)) {
    motivi.push('scritto in un alfabeto che questo sito non riceve');
    certo = true;
  }
  if (ctx.secondi !== null && ctx.secondi < 3) {
    // Tre secondi non bastano a leggere il modulo, non parliamo di compilarlo.
    // È l'unico indizio che vale da solo, perché non ha un uso legittimo: il
    // tempo è misurato da una marca firmata dal server, quindi non è falsificabile
    // senza la chiave.
    motivi.push(`inviato in ${ctx.secondi} secondi dall'apertura della pagina`);
    certo = true;
  }

  // ---- Indizi --------------------------------------------------------------
  const link = contaLink(campi.message);
  if (link >= 2) {
    punti += 2;
    motivi.push(`${link} indirizzi web nel messaggio`);
  } else if (link === 1) {
    punti += 1;
    motivi.push('un indirizzo web nel messaggio');
  }

  if (ctx.ripetuto) {
    punti += 2;
    motivi.push('lo stesso messaggio è già arrivato di recente');
  }

  if (!ctx.visitaValida) {
    punti += 1;
    motivi.push('inviato senza passare da una pagina del sito');
  }

  // Due punti e non uno: un nome vero non contiene un indirizzo web né una
  // chiocciola. È l'indizio più forte fra i deboli, e da solo non basta comunque.
  if (contaLink(campi.name) > 0 || campi.name.includes('@')) {
    punti += 2;
    motivi.push('il nome contiene un indirizzo');
  }

  // Un messaggio identico all'oggetto è quello che esce da un modulo compilato
  // da un programma con un campo solo.
  const m = campi.message.trim().toLowerCase();
  if (m !== '' && m === campi.subject.trim().toLowerCase()) {
    punti += 1;
    motivi.push('oggetto e messaggio identici');
  }

  /* `punti` resta il conto dei soli indizi, anche quando c'è una certezza: dire
     «2 punti» dove la ragione era il campo trappola confonderebbe chi legge il
     motivo nel pannello. Il verdetto lo porta `spam`, non il numero. */
  return { spam: certo || punti >= SOGLIA, punti, motivi };
}
