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
  { label: 'Soluzione AI', price: 1800, weeks: 3 },
];

const FALLBACK_ADDONS: PricingItem[] = [
  { label: 'Multilingua', price: 400, weeks: 1 },
  { label: 'SEO avanzata', price: 350, weeks: 1 },
  { label: 'Blog / CMS', price: 500, weeks: 1 },
  { label: 'Area riservata / login', price: 800, weeks: 2 },
  { label: 'Integrazione AI', price: 1200, weeks: 2 },
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
  {
    quote: "L'assistente AI risponde ai clienti al posto mio. Soluzione che non pensavo fosse alla mia portata.",
    author: 'Stefano P.',
    role: 'PMI servizi',
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
      "Lavorando con strumenti moderni e AI consegno molto più in fretta di un'agenzia tradizionale: una landing in pochi giorni, progetti più complessi in qualche settimana.",
  },
  {
    question: "Usi l'AI: la qualità ne risente?",
    answer:
      "Al contrario. L'AI accelera le parti ripetitive, così investo più tempo su design, esperienza utente e dettagli che fanno la differenza. Ogni progetto viene testato e curato a mano prima di andare online.",
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

/** Prezzo formattato come fa main.js: '€' + toLocaleString('it-IT'). */
export function formatPrice(n: number): string {
  return '€' + n.toLocaleString('it-IT');
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
