/**
 * Contenuti della landing: dal database quando disponibile, altrimenti dai
 * fallback qui sotto.
 *
 * È la stessa scelta della versione PHP e va mantenuta: se il database non
 * risponde il sito pubblico resta comunque completo e navigabile, invece di
 * mostrare sezioni vuote o una pagina d'errore.
 */
import { rowsActive, getSettings, setting, settingOn, type Settings, type PricingRow, type ReviewRow, type FaqRow, type WorkRow, type CredentialRow } from './db.ts';
import { slugLavoro } from './assets.ts';

export type PricingItem = Pick<PricingRow, 'label' | 'price' | 'weeks'>;
export type ReviewItem = Pick<ReviewRow, 'quote' | 'author' | 'role' | 'stars'>;
export type FaqItem = Pick<FaqRow, 'question' | 'answer'>;
export type WorkItem = Pick<
  WorkRow,
  'title' | 'url' | 'summary' | 'tags' | 'proprio' | 'story' | 'links' | 'shots'
>;
export type CredentialItem = Pick<
  CredentialRow,
  'title' | 'issuer' | 'scheme' | 'year' | 'code' | 'url'
>;

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
  works: WorkItem[];
  faqs: FaqItem[];
  /** Formazione e certificazioni, già filtrate: vedi qualificaMostrabile. */
  credenziali: CredentialItem[];
  /**
   * La pagina /gdpr è accesa. Non dipende dalle qualifiche: quelle decidono se la
   * pagina dichiara una certificazione, non se il servizio è in vendita.
   */
  dpoAttivo: boolean;
  contactEmail: string;
  calendly: string;
  /** L'agenda del sito è accesa: la sezione contatti prenota qui, non su Calendly. */
  agendaAttiva: boolean;
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

/**
 * Un lavoro è mostrabile se ha un titolo, e un indirizzo http(s) valido.
 *
 * Il filtro sta qui e non in un controllo della CI perché i lavori arrivano dal
 * database: un valore scritto nel pannello dopo il deploy nessuna verifica
 * automatica lo vedrà mai. La regola deve valere al momento in cui la pagina si
 * costruisce, cioè adesso.
 *
 * Lo schema si controlla per due motivi. Il primo è che una scheda di portfolio
 * senza indirizzo apribile non è un portfolio, è un'affermazione — ed è la
 * sezione dove tutto deve essere verificabile. Il secondo è che il valore finisce
 * in un href: Astro sfugge il testo, ma non giudica lo schema, e un `javascript:`
 * scritto per errore o per prova diventerebbe un link eseguibile sulla home. Con
 * questo filtro l'unica cosa che può arrivare in pagina è un indirizzo web.
 */
function lavoroMostrabile(w: { title: string; url: string }): boolean {
  if (w.title.trim() === '') return false;
  try {
    const u = new URL(w.url.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    // Indirizzo non valido: un errore di battitura nel pannello non deve
    // pubblicare una scheda rotta, e non deve far cadere la home.
    return false;
  }
}

/**
 * Una qualifica si mostra solo se si può controllare.
 *
 * Servono il titolo e l'ente che l'ha rilasciata, e la seconda condizione è
 * quella che conta: «Data Protection Officer» da solo è una parola che chiunque
 * può scrivere accanto al proprio nome, mentre «rilasciata da X» è una frase che
 * X può smentire. È la differenza fra una qualifica e un'affermazione, e questo
 * sito non pubblica affermazioni su di sé che chi legge non possa verificare.
 *
 * Il filtro sta qui e non nel pannello per la stessa ragione dei lavori: i valori
 * arrivano dal database dopo il deploy, quindi la regola deve valere al momento
 * in cui la pagina si costruisce — anche per una riga spuntata come attiva prima
 * di essere compilata.
 *
 * L'indirizzo di verifica, quando c'è, passa dal filtro degli schemi: finisce in
 * un href, e Astro sfugge il testo ma non giudica lo schema.
 */
export function qualificaMostrabile(c: { title: string; issuer: string }): boolean {
  return c.title.trim() !== '' && c.issuer.trim() !== '';
}

/**
 * Indirizzo web utilizzabile, o null.
 *
 * È lo stesso controllo che lavoroMostrabile fa sull'indirizzo del lavoro, e per
 * la stessa ragione: i link della pagina di un lavoro arrivano dal pannello e
 * finiscono in un href. Astro sfugge il testo ma non giudica lo schema, quindi
 * senza questo filtro un `javascript:` scritto per prova sarebbe eseguibile.
 */
function indirizzoWeb(raw: string): string | null {
  const value = raw.trim();
  if (value === '') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

/**
 * I paragrafi del testo di un lavoro: separati da una riga vuota, come si scrive
 * in una casella di testo senza conoscere l'HTML.
 */
export function paragrafiLavoro(story: string): string[] {
  return story
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * I link di approfondimento: una riga per link, `etichetta | indirizzo`.
 *
 * Le righe senza barra, senza etichetta o con un indirizzo che non è http(s)
 * cadono in silenzio. In silenzio e non con un errore perché il campo lo compila
 * una persona: una riga sbagliata deve costare quella riga, non la pagina.
 */
export function linkLavoro(links: string): { label: string; url: string }[] {
  return links
    .split('\n')
    .map((riga) => {
      const taglio = riga.indexOf('|');
      if (taglio < 0) return null;
      const label = riga.slice(0, taglio).trim();
      const url = indirizzoWeb(riga.slice(taglio + 1));
      return label && url ? { label, url } : null;
    })
    .filter((v): v is { label: string; url: string } => v !== null);
}

/**
 * Le didascalie delle schermate, una per riga, appaiate alle immagini trovate su
 * disco. Più immagini che didascalie: le ultime restano senza, ed è meglio di una
 * didascalia sbagliata sotto la schermata di un'altra pagina.
 */
export function didascalieLavoro(shots: string): string[] {
  return shots.split('\n').map((riga) => riga.trim());
}

/**
 * Un lavoro dal suo nome nell'indirizzo, o null.
 *
 * Passa dalle stesse righe attive della home e dallo stesso filtro: un lavoro
 * che non è mostrabile in home non ha una pagina, e uno spento non ce l'ha più.
 * Così non esiste una seconda via d'accesso ai contenuti che la sezione scarta.
 */
export async function getWork(slug: string): Promise<WorkItem | null> {
  const works = (await rowsActive<WorkRow>('works')).filter(lavoroMostrabile);
  return works.find((w) => slugLavoro(w.url) === slug) ?? null;
}

/**
 * I nomi dei lavori che hanno una pagina, nell'ordine della sezione.
 *
 * Serve alla sitemap: le pagine dei lavori nascono e muoiono da un campo del
 * pannello, quindi un elenco scritto a mano nella sitemap prometterebbe ai motori
 * di ricerca indirizzi che rispondono 404. Se il database non risponde l'elenco è
 * vuoto e la sitemap resta quella delle pagine fisse, che è il comportamento
 * giusto: meglio una sitemap corta che una che mente.
 */
export async function lavoriConPagina(): Promise<string[]> {
  const works = (await rowsActive<WorkRow>('works')).filter(lavoroMostrabile);
  return works
    .filter((w) => paragrafiLavoro(w.story).length > 0)
    .map((w) => slugLavoro(w.url))
    .filter((s): s is string => s !== null);
}

/** Link WhatsApp precompilato. Ritorna stringa vuota se il numero non è impostato. */
export function whatsappLink(rawNumber: string, message = 'Ciao Dext Lab, vorrei informazioni su un progetto'): string {
  const digits = rawNumber.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export async function getLandingContent(settings?: Settings): Promise<LandingContent> {
  const s = settings ?? (await getSettings());
  const [types, addons, reviews, works, faqs, credenziali] = await Promise.all([
    rowsActive<PricingRow>('pricing_types'),
    rowsActive<PricingRow>('pricing_addons'),
    rowsActive<ReviewRow>('reviews'),
    rowsActive<WorkRow>('works'),
    rowsActive<FaqRow>('faqs'),
    rowsActive<CredentialRow>('credentials'),
  ]);

  /*
    Due cose separate, e tenerle unite era un errore mio (vedi la 015).

    L'interruttore decide se il servizio è in vendita. Le qualifiche decidono se
    il sito DICHIARA una certificazione. Legare la pagina a entrambe teneva
    invisibile un servizio che si può offrire — la competenza c'è — solo perché
    mancavano l'ente e l'anno di un attestato, cioè dati che solo una persona può
    scrivere.

    Quello che resta legato al dato verificabile è la dichiarazione: senza una
    qualifica con il suo ente, la pagina descrive il lavoro e non nomina nessun
    titolo. Offrire un servizio è una cosa, dichiarare una certificazione è
    un'altra.
  */
  const qualifiche = credenziali.filter(qualificaMostrabile);

  return {
    types: types.length > 0 ? types : FALLBACK_TYPES,
    addons: addons.length > 0 ? addons : FALLBACK_ADDONS,
    // Nessun ripiego, per il motivo scritto sopra: quello che c'è nel database
    // o niente.
    reviews,
    /* Stessa regola per i lavori, e per una ragione più forte: un lavoro
       inventato ha un indirizzo che chiunque può aprire. Si scartano anche le
       righe senza indirizzo o senza titolo — una voce di portfolio che non porta
       da nessuna parte non è un portfolio, è un'affermazione. Sono le bozze che
       la 006 inserisce disattivate: se qualcuno spuntasse «active» prima di
       compilarle, qui non passerebbero comunque. */
    works: works.filter(lavoroMostrabile),
    faqs: faqs.length > 0 ? faqs : FALLBACK_FAQS,
    // Nessun ripiego nemmeno qui, e per il motivo più stretto di tutti: un
    // attestato d'esempio è un'affermazione falsa su una persona.
    credenziali: qualifiche,
    dpoAttivo: settingOn(s, 'dpo_attiva'),
    contactEmail: setting(s, 'contact_email', 'info@dextlab.it'),
    calendly: setting(s, 'calendly', 'https://calendly.com/dextlab/call'),
    agendaAttiva: settingOn(s, 'agenda_attiva'),
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
