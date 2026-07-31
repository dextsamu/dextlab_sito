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

const FALLBACK_REVIEWS: ReviewItem[] = [
  {
    quote: 'Sito pronto in pochi giorni, esattamente come lo immaginavo. Comunicazione chiara e zero stress.',
    author: 'Marco R.',
    role: 'Titolare e-commerce',
    stars: 5,
  },
  {
    quote: 'Ha capito subito cosa serviva alla mia attività. Il gestionale ci fa risparmiare ore ogni settimana.',
    author: 'Laura B.',
    role: 'Studio professionale',
    stars: 5,
  },
];

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
    reviews: reviews.length > 0 ? reviews : FALLBACK_REVIEWS,
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

export interface ServicePrice {
  /** Prezzo di partenza già formattato, es. "490 €". */
  from: string;
  /** Solo la parte numerica dei tempi, es. "1–2": la parola resta traducibile. */
  weeks: string;
}

/**
 * Prezzo di partenza e tempi per una card di servizio, ricavati dal listino
 * del configuratore.
 *
 * Le card dei servizi e il configuratore vendono le stesse cose con nomi
 * diversi ("Siti Web" copre sia la landing sia il sito vetrina), quindi il
 * collegamento è una lista esplicita di etichette invece di un accostamento
 * automatico. Se nessuna combacia — perché le hai rinominate dal pannello —
 * restituisce null e la card non mostra alcun prezzo: meglio nessun numero
 * che un numero sbagliato.
 *
 * Il prezzo non va scritto a mano nel componente: verrebbe da sé a divergere
 * dal listino, come già successo con la stima iniziale del configuratore.
 */
export function servicePrice(types: PricingItem[], labels: string[]): ServicePrice | null {
  const trovati = types.filter((t) => labels.includes(t.label));
  if (trovati.length === 0) return null;

  const min = Math.min(...trovati.map((t) => t.weeks));
  const max = Math.max(...trovati.map((t) => t.weeks));
  return {
    from: `${groupThousands(Math.min(...trovati.map((t) => t.price)))} €`,
    // Il trattino è una lineetta media, non un meno: è un intervallo.
    weeks: min === max ? String(min) : `${min}–${max}`,
  };
}
