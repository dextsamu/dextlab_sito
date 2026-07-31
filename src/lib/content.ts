/**
 * Contenuti della landing: dal database quando disponibile, altrimenti dai
 * fallback qui sotto.
 *
 * È la stessa scelta della versione PHP e va mantenuta: se il database non
 * risponde il sito pubblico resta comunque completo e navigabile, invece di
 * mostrare sezioni vuote o una pagina d'errore.
 */
import { rowsActive, getSettings, setting, type Settings, type PricingRow, type ReviewRow, type FaqRow } from './db.ts';

export type PricingItem = Pick<PricingRow, 'label' | 'price' | 'weeks'>;
export type ReviewItem = Pick<ReviewRow, 'quote' | 'author' | 'role' | 'stars'>;
export type FaqItem = Pick<FaqRow, 'question' | 'answer'>;

const FALLBACK_TYPES: PricingItem[] = [
  { label: 'Landing page', price: 490, weeks: 1 },
  { label: 'Sito vetrina', price: 990, weeks: 2 },
  { label: 'E-commerce', price: 2500, weeks: 4 },
  { label: 'Web app su misura', price: 4500, weeks: 8 },
];

const FALLBACK_ADDONS: PricingItem[] = [
  { label: 'Multilingua', price: 400, weeks: 1 },
  { label: 'SEO avanzata', price: 350, weeks: 1 },
  { label: 'Blog / CMS', price: 500, weeks: 1 },
  { label: 'Area riservata / login', price: 800, weeks: 2 },
  { label: 'Copywriting', price: 300, weeks: 0 },
];

/**
 * Le recensioni sono l'unica cosa che NON ha un ripiego, ed è deliberato.
 *
 * Qui c'erano due recensioni firmate con nome e iniziale del cognome, cinque
 * stelle entrambe (i testi esatti sono in migrations/005, che le ritira dalla
 * produzione: NON vanno riportati qui, e un controllo in CI lo impedisce —
 * altrimenti una ricerca del nome non distingue più una spiegazione da un
 * ripiego tornato in servizio). Erano contenuto d'esempio, e per un
 * listino o una FAQ un esempio plausibile è un ripiego onesto: nessuno viene
 * ingannato da un prezzo di riferimento. Una recensione no. Una recensione è
 * un'affermazione su una persona che esiste, e inventarla è l'unico modo in cui
 * questo sito poteva dire una cosa falsa senza accorgersene.
 *
 * Quindi: se il database non ha recensioni vere, la sezione non c'è. Vale anche
 * per il caso in cui il database sia giù — meglio una sezione in meno che due
 * clienti inesistenti. Vedi la 005 per la stessa pulizia in produzione.
 */

const FALLBACK_FAQS: FaqItem[] = [
  {
    question: 'Quanto costa un sito o una web app?',
    answer:
      "Dipende dall'obiettivo: una landing page parte da poche centinaia di euro, una web app su misura cresce in base alle funzioni. Ti do sempre un preventivo chiaro e fisso prima di iniziare, senza sorprese.",
  },
  {
    question: 'Quanto tempo serve?',
    answer:
      'Una landing è pronta in pochi giorni, un sito vetrina in un paio di settimane, i progetti su misura in qualche settimana in più. La data te la do prima di iniziare e la rispetto.',
  },
  {
    question: 'Posso modificare il sito dopo la consegna?',
    answer:
      'Certo. Ti consegno un prodotto pronto e, se vuoi, un modo semplice per aggiornarlo da solo. In alternativa resto io il tuo punto di riferimento per modifiche e nuove funzioni.',
  },
  {
    question: 'Offri assistenza dopo il lancio?',
    answer:
      'Sì. Monitoro che tutto funzioni e resto disponibile per supporto, aggiornamenti e miglioramenti nel tempo.',
  },
];

export interface LandingContent {
  types: PricingItem[];
  addons: PricingItem[];
  reviews: ReviewItem[];
  faqs: FaqItem[];
  contactEmail: string;
  calendly: string;
  whatsappLink: string;
}

/**
 * Chiave stabile per una voce del listino, dall'etichetta italiana.
 *
 * Serve a due cose che prima si appoggiavano al testo mostrato, ed entrambe si
 * rompevano in inglese:
 *
 *  1. L'aggancio fra i pulsanti dell'hero e quelli del configuratore. Il
 *     confronto era fra il testo del pulsante e l'etichetta italiana: con il
 *     sito in inglese il testo è tradotto, il confronto non trovava niente, e
 *     scegliere il tipo di progetto nell'hero non faceva NULLA. Il pezzo più
 *     convincente della pagina era morto per metà dei visitatori.
 *  2. Il preventivo scritto nell'indirizzo (#p=...). Con le chiavi ricavate dal
 *     testo mostrato, un link generato in italiano non si sarebbe riaperto in
 *     inglese: le funzioni aggiunte sarebbero state ignorate in silenzio.
 *
 * L'etichetta arriva dal database, cioè è sempre quella italiana, e la chiave
 * finisce in un attributo — che il dizionario non tocca, perché lavora sui nodi
 * di testo. Così client e server guardano la stessa stringa in tutte le lingue,
 * e il JavaScript non ha bisogno di ricalcolare niente: legge l'attributo.
 *
 * Gli accenti vengono sciolti e tutto ciò che non è alfanumerico cade, così
 * «Area riservata / login» diventa «areariservatalogin»: leggibile dentro un
 * link mandato in chat, e senza caratteri che un client di posta possa troncare.
 */
export function chiaveListino(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    // Intervallo di codepoint e non caratteri incollati: i diacritici combinanti
    // scritti letteralmente sono invisibili in un editor, e chi normalizza il
    // file rompe la regola senza lasciare traccia.
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Link WhatsApp precompilato. Ritorna stringa vuota se il numero non è impostato. */
export function whatsappLink(rawNumber: string, message = 'Ciao Dext Lab, vorrei informazioni su un progetto'): string {
  const digits = rawNumber.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export async function getLandingContent(settings?: Settings): Promise<LandingContent> {
  const s = settings ?? (await getSettings());
  const [types, addons, reviews, faqs] = await Promise.all([
    rowsActive<PricingRow>('pricing_types'),
    rowsActive<PricingRow>('pricing_addons'),
    rowsActive<ReviewRow>('reviews'),
    rowsActive<FaqRow>('faqs'),
  ]);

  return {
    types: types.length > 0 ? types : FALLBACK_TYPES,
    addons: addons.length > 0 ? addons : FALLBACK_ADDONS,
    // Nessun ripiego, per il motivo scritto sopra: quello che c'è nel database
    // o niente.
    reviews,
    faqs: faqs.length > 0 ? faqs : FALLBACK_FAQS,
    contactEmail: setting(s, 'contact_email', 'info@dextlab.it'),
    calendly: setting(s, 'calendly', 'https://calendly.com/dextlab/call'),
    whatsappLink: whatsappLink(setting(s, 'whatsapp', '393000000000')),
  };
}

/**
 * Migliaia separate dal punto, senza passare da toLocaleString.
 *
 * Non è pignoleria: `(4500).toLocaleString('it-IT')` dipende dai dati locale di
 * ICU, e un Node compilato con small-icu li ignora restituendo "4500" invece di
 * "4.500". Il browser ha ICU completo e scrive "4.500", quindi lo stesso numero
 * usciva formattato in due modi — dal server e dal JavaScript — sulla stessa
 * pagina. Con un raggruppamento fatto a mano il risultato è identico sempre.
 */
export function groupThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Prezzo formattato come fa main.js: '€' + migliaia separate. */
export function formatPrice(n: number): string {
  return '€' + groupThousands(n);
}

/** Testo dei tempi con la stessa soglia usata da main.js. */
export function formatWeeks(weeks: number): string {
  if (weeks <= 1) return 'circa 1 settimana';
  if (weeks <= 6) return `circa ${weeks} settimane`;
  return `${weeks}+ settimane`;
}

/**
 * Stima iniziale del configuratore, calcolata con la stessa formula di
 * main.js (0.9x - 1.3x arrotondati alla decina) sul primo tipo di progetto.
 *
 * Va tenuta allineata a compute() in public/js/main.js: nell'HTML statico
 * precedente i valori erano scritti a mano e già divergevano, mostrando
 * "€450" dove il JS calcolava "€440" al primo rendering.
 */
export function initialEstimate(types: PricingItem[]): { min: string; max: string; weeks: string } {
  const first = types[0];
  const price = first?.price ?? 0;
  const weeks = first?.weeks ?? 1;
  return {
    min: formatPrice(Math.round((price * 0.9) / 10) * 10),
    max: formatPrice(Math.round((price * 1.3) / 10) * 10),
    weeks: formatWeeks(weeks),
  };
}
