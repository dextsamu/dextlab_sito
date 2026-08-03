/**
 * La richiesta configurata: le domande, e il modo di rileggere le risposte.
 *
 * Il configuratore era un preventivo: scegli due voci, esce una cifra, e la
 * cifra era tutto. Senza la cifra (vedi la 016 — senza partita IVA un prezzo in
 * pagina è un'offerta che non si può onorare) resta da capire a cosa serve, e la
 * risposta è: a mettere insieme la richiesta che permette di scrivere un
 * preventivo. Che è un lavoro diverso e più utile.
 *
 * Le quattro domande qui sotto non sono un sondaggio. Sono le cose senza le quali
 * un preventivo non si scrive:
 *
 *   da dove parti   un sito da rifare non è un sito da fare: c'è contenuto da
 *                   portare, indirizzi da non rompere, a volte un dominio altrui
 *   quando          «entro un mese» e «nessuna fretta» sono due lavori con due
 *                   prezzi, e chiederlo dopo aver mandato il preventivo è tardi
 *   materiali       testi e foto sono la voce che fa slittare tutti i progetti
 *                   piccoli, ed è quella che nessuno mette nel conto
 *   dopo            se lo aggiorna lui serve un CMS e mezz'ora di spiegazioni;
 *                   se lo aggiorno io serve un accordo. Cambia cosa si costruisce
 *
 * Sono tutte facoltative. Chi non risponde manda comunque la sua richiesta: una
 * domanda obbligatoria in mezzo a un modulo di contatto è un modo di perdere
 * contatti, non di raccoglierne di migliori.
 *
 * Questo file NON tocca il database e non importa niente: lo leggono il
 * componente che disegna le domande, l'endpoint che riceve le risposte e la
 * guardia della CI. Le tre cose devono vedere le stesse stringhe, e l'unico modo
 * di garantirlo è che ci sia una sola copia.
 */

export interface Scelta {
  /** Valore che viaggia nel modulo. Corto e stabile: entra anche in un link. */
  v: string;
  /** Quello che legge chi sceglie, e quello che rileggi tu nella richiesta. */
  testo: string;
}

export interface Domanda {
  /** Nome del campo nel modulo. Il prefisso cfg_ li tiene riconoscibili. */
  campo: string;
  /** Come compare nella pagina. */
  titolo: string;
  /** Come compare nella richiesta che arriva: «Da dove parte: ...» */
  etichetta: string;
  scelte: Scelta[];
}

export const DOMANDE: Domanda[] = [
  {
    campo: 'cfg_partenza',
    titolo: 'Da dove parti?',
    etichetta: 'Da dove parte',
    scelte: [
      { v: 'niente', testo: 'Non ho ancora niente' },
      { v: 'rifare', testo: 'Ho un sito e va rifatto' },
      { v: 'sistemare', testo: 'Ho un sito e va sistemato' },
    ],
  },
  {
    campo: 'cfg_quando',
    titolo: 'Quando ti serve?',
    etichetta: 'Quando serve',
    scelte: [
      { v: 'senzafretta', testo: 'Nessuna fretta' },
      { v: 'unmese', testo: 'Entro un mese' },
      { v: 'data', testo: 'Ho una data fissata' },
    ],
  },
  {
    campo: 'cfg_materiali',
    titolo: 'Testi e immagini?',
    etichetta: 'Testi e immagini',
    scelte: [
      { v: 'pronti', testo: 'Li ho pronti' },
      { v: 'parte', testo: 'In parte' },
      { v: 'servono', testo: 'Servono' },
    ],
  },
  {
    campo: 'cfg_dopo',
    titolo: 'Chi lo aggiorna dopo?',
    etichetta: 'Dopo il lancio',
    scelte: [
      { v: 'io', testo: 'Voglio farlo da solo' },
      { v: 'tu', testo: 'Preferisco che te ne occupi tu' },
      { v: 'nonso', testo: 'Non lo so ancora' },
    ],
  },
];

/** I nomi dei campi delle domande, per chi deve leggerli tutti. */
export const CAMPI_DOMANDE = DOMANDE.map((d) => d.campo);

/**
 * Il testo di una risposta, o stringa vuota se il valore non è fra le scelte.
 *
 * Il valore arriva da un modulo, cioè da fuori: chiunque può mandare
 * `cfg_quando=<script>`. Non si ripulisce e non si accorcia — si cerca fra le
 * scelte, e quello che non c'è non esiste. Una risposta inventata sparisce
 * invece di finire in una email con un'aria di verità.
 */
export function rispostaLeggibile(campo: string, valore: string): string {
  const d = DOMANDE.find((x) => x.campo === campo);
  if (!d) return '';
  return d.scelte.find((s) => s.v === valore)?.testo ?? '';
}

/** Le voci di una richiesta, già in ordine di lettura. */
export interface Richiesta {
  /** Etichetta del tipo di progetto dal listino, vuota se non riconosciuto. */
  progetto: string;
  /** Etichette delle funzioni aggiuntive, nell'ordine del listino. */
  funzioni: string[];
  /** Somma delle settimane, in parole. Vuota se non c'è un progetto. */
  tempi: string;
  /** Le risposte alle domande, già leggibili: [etichetta, testo]. */
  contesto: [string, string][];
}

/**
 * La richiesta scritta come la si legge in una email.
 *
 * Righe, non prosa: chi la riceve la scorre, e una frase lunga con quattro
 * subordinate va riletta due volte. Le voci vuote non compaiono — una riga
 * «Quando serve: » dice solo che il modulo ha un campo in più.
 */
export function riepilogoTestuale(r: Richiesta): string {
  const righe: string[] = [];
  if (r.progetto !== '') righe.push(`Progetto: ${r.progetto}`);
  if (r.funzioni.length > 0) righe.push(`Funzioni: ${r.funzioni.join(', ')}`);
  if (r.tempi !== '') righe.push(`Tempi stimati: ${r.tempi}`);
  for (const [etichetta, testo] of r.contesto) righe.push(`${etichetta}: ${testo}`);
  return righe.join('\n');
}

/** Vero se la richiesta contiene almeno una cosa da leggere. */
export function richiestaVuota(r: Richiesta): boolean {
  return r.progetto === '' && r.funzioni.length === 0 && r.contesto.length === 0;
}
