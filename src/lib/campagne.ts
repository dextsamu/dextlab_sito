/**
 * L'origine di una visita: chi l'ha portata, in che modo, per quale iniziativa.
 *
 * Serve a una cosa sola, e vale la pena scriverla: sapere quali soldi e quale
 * tempo hanno prodotto contatti. Senza questo dato la pubblicità si giudica a
 * sensazione, e la sensazione dice sempre che va bene.
 *
 * Le tre colonne hanno i nomi che usano tutte le piattaforme (utm_source,
 * utm_medium, utm_campaign): un link tracciato costruito qui funziona anche se
 * domani si aggiunge Google Analytics, e i link fatti per Analytics funzionano
 * qui. Non è un formato inventato in casa.
 *
 * Nessun cookie. La campagna si legge dall'indirizzo, finisce sulla riga della
 * visita — che esiste già — e il modulo porta con sé il token di quella visita.
 * Il contatto eredita l'origine da lì. Il limite di questo modello è dichiarato:
 * chi arriva dall'annuncio oggi e scrive domani risulta diretto. È il prezzo per
 * non piazzare un identificativo che sopravvive alla visita.
 */

export interface Campagna {
  /** Chi ha portato la visita: google, facebook, newsletter… */
  source: string;
  /** In che modo: cpc, organico, social, email, referral… */
  medium: string;
  /** Quale iniziativa: lancio-autunno, biglietti-da-visita… */
  name: string;
}

export const NESSUNA: Campagna = { source: '', medium: '', name: '' };

const MAX = 60;

/**
 * Normalizza un valore di campagna.
 *
 * Minuscolo, e non per gusto: «Google», «google» e «GOOGLE» sono lo stesso
 * canale, e tenerli distinti spezza in tre righe un numero che serve intero. È
 * anche quello che fa Analytics con questi campi.
 *
 * I caratteri di controllo via: arrivano da un indirizzo, cioè da fuori, e
 * finiscono in una tabella e in una pagina dell'admin.
 */
function pulisci(v: string): string {
  return v
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, MAX);
}

function primo(url: URL, ...nomi: string[]): string {
  for (const n of nomi) {
    const v = url.searchParams.get(n);
    if (v !== null && pulisci(v) !== '') return pulisci(v);
  }
  return '';
}

/**
 * Motori di ricerca: il traffico che portano è organico, non pubblicitario.
 *
 * La distinzione conta più di quanto sembri. Un clic da Google Ads costa, un
 * clic dalla ricerca no: metterli nella stessa riga significa non sapere quale
 * dei due sta funzionando. Gli annunci si riconoscono dal gclid, non dal
 * referer, ed è per questo che quel controllo viene prima.
 */
const RICERCA = [
  'google',
  'bing',
  'duckduckgo',
  'ecosia',
  'yahoo',
  'yandex',
  'baidu',
  'search.brave',
  'startpage',
  'qwant',
];

const SOCIAL = [
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'x.com',
  't.co',
  'youtube',
  'tiktok',
  'reddit',
  'pinterest',
  'whatsapp',
  'telegram',
];

/** Il nome del canale da un host: via il www e il suffisso, resta «google». */
function canaleDaHost(host: string): string {
  const pulito = host.replace(/^www\./, '').replace(/^m\./, '');
  const parti = pulito.split('.');
  // due etichette bastano a identificare il canale (google.it → google), ma i
  // domini di terzo livello dei motori vanno tenuti interi (search.brave.com).
  if (parti.length >= 3 && RICERCA.some((r) => pulito.startsWith(r))) return parti.slice(0, 2).join('.');
  return parti.length >= 2 ? parti[parti.length - 2] : pulito;
}

/**
 * La campagna dichiarata nell'indirizzo.
 *
 * I parametri utm_* vincono su tutto: sono quelli che ha scritto una persona
 * costruendo il link, e nessuna euristica li batte. Se mancano si guardano gli
 * identificativi di clic delle piattaforme, che restano attaccati al link anche
 * quando chi ha creato l'annuncio si è dimenticato gli utm.
 */
export function campagnaDaUrl(url: URL): Campagna {
  const source = primo(url, 'utm_source');
  const medium = primo(url, 'utm_medium');
  const name = primo(url, 'utm_campaign');

  if (source !== '') {
    // Un utm_source senza medium è comunque un'origine: si dichiara così com'è
    // invece di indovinare un mezzo che nessuno ha scritto.
    return { source, medium, name };
  }

  /*
    gclid e msclkid li aggiunge la piattaforma pubblicitaria al clic
    sull'annuncio: la loro presenza è la prova che quel clic è stato pagato.
    fbclid no — Facebook lo attacca anche ai link condivisi normalmente, quindi
    diventa «social» e non «cpc». Dire «cpc» per un clic gratuito gonfierebbe il
    costo per contatto di una campagna che non esiste.
  */
  if (url.searchParams.has('gclid') || url.searchParams.has('gbraid') || url.searchParams.has('wbraid')) {
    return { source: 'google', medium: 'cpc', name };
  }
  if (url.searchParams.has('msclkid')) return { source: 'bing', medium: 'cpc', name };
  if (url.searchParams.has('fbclid')) return { source: 'facebook', medium: 'social', name };
  if (url.searchParams.has('ttclid')) return { source: 'tiktok', medium: 'social', name };
  if (url.searchParams.has('li_fat_id')) return { source: 'linkedin', medium: 'social', name };

  return NESSUNA;
}

/**
 * L'origine dedotta dal referer, quando non c'è nessun utm.
 *
 * È un dato più povero — dice il sito da cui si arriva, non l'annuncio — ma è
 * l'unico disponibile per il traffico che non si compra: la ricerca organica, un
 * link su un altro sito, una condivisione. Il referer interno non è un'origine:
 * chi passa dalla home a una scheda non «arriva» da nessuna parte, e trattarlo
 * come origine farebbe comparire dextlab.it fra i canali.
 */
export function campagnaDaReferrer(referer: string, hostSito: string): Campagna {
  const testo = referer.trim();
  if (testo === '') return NESSUNA;

  let host: string;
  try {
    host = new URL(testo).hostname.toLowerCase();
  } catch {
    return NESSUNA;
  }
  /*
    Il confronto è esatto o su un sottodominio, non un «finisce con»: host
    che terminano nel nostro dominio senza esserlo — nondextlab.it — passerebbero
    per interni e il loro traffico non comparirebbe fra i canali.
  */
  const nostro = hostSito.toLowerCase().replace(/^www\./, '');
  if (nostro !== '' && (host === nostro || host.endsWith('.' + nostro))) return NESSUNA;

  const canale = canaleDaHost(host);
  if (RICERCA.some((r) => canale === r || canale.startsWith(r))) {
    return { source: pulisci(canale), medium: 'organico', name: '' };
  }
  if (SOCIAL.some((s) => canale === s || canale.startsWith(s))) {
    return { source: pulisci(canale), medium: 'social', name: '' };
  }
  return { source: pulisci(canale), medium: 'referral', name: '' };
}

export function haCampagna(c: Campagna): boolean {
  return c.source !== '';
}

/** Nome del canale come si scrive in una pagina: «google» → «Google». */
export function nomeCanale(source: string): string {
  if (source === '') return 'Diretto';
  const noti: Record<string, string> = {
    google: 'Google',
    bing: 'Bing',
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    whatsapp: 'WhatsApp',
    duckduckgo: 'DuckDuckGo',
    'search.brave': 'Brave',
  };
  return noti[source] ?? source.charAt(0).toUpperCase() + source.slice(1);
}

/** L'origine in una riga leggibile: «Google · cpc · lancio-autunno». */
export function etichettaCampagna(c: Campagna): string {
  if (!haCampagna(c)) return 'Diretto';
  return [nomeCanale(c.source), c.medium, c.name].filter((p) => p !== '').join(' · ');
}

/**
 * Chiave con cui si raggruppano le origini. Le tre parti separate da una barra
 * verticale, che non può comparire dentro un valore già normalizzato.
 */
export function chiaveCampagna(c: Campagna): string {
  return `${c.source}|${c.medium}|${c.name}`;
}

// -------------------------------------------------- costruttore dei link --

/**
 * Il link tracciato da mettere nell'annuncio.
 *
 * Esiste perché i link tracciati scritti a mano sbagliano sempre nello stesso
 * modo: una maiuscola di troppo che spacca in due il canale, un parametro con il
 * nome storto, un `?` dove serviva un `&`. Qui i valori passano dalla stessa
 * normalizzazione che usa la lettura, quindi il link che si copia produce
 * esattamente la riga che il pannello si aspetta.
 */
export function linkTracciato(base: string, percorso: string, c: Campagna): string {
  let url: URL;
  try {
    url = new URL(percorso || '/', base.endsWith('/') ? base : base + '/');
  } catch {
    return '';
  }
  const source = pulisci(c.source);
  if (source === '') return url.href;

  url.searchParams.set('utm_source', source);
  const medium = pulisci(c.medium);
  if (medium !== '') url.searchParams.set('utm_medium', medium);
  const name = pulisci(c.name);
  if (name !== '') url.searchParams.set('utm_campaign', name);
  return url.href;
}

/**
 * I canali da cui si può partire, con il mezzo giusto già impostato.
 *
 * Sono i posti in cui un link a questo sito finisce davvero, e ognuno ha il
 * mezzo che gli corrisponde: sbagliare quello è il modo più comune di rendere
 * inutili i numeri (un annuncio a pagamento marcato «social» sparisce dentro il
 * traffico gratuito).
 */
export const CANALI: { source: string; medium: string; etichetta: string; a_cosa_serve: string }[] = [
  {
    source: 'google',
    medium: 'cpc',
    etichetta: 'Google Ads',
    a_cosa_serve: 'Annunci sulla ricerca. Il link va nel campo «URL finale» dell\'annuncio.',
  },
  {
    source: 'google',
    medium: 'scheda',
    etichetta: 'Scheda Google dell\'attività',
    a_cosa_serve: 'Il pulsante «Sito web» della scheda: distingue chi arriva da lì dalla ricerca normale.',
  },
  {
    source: 'facebook',
    medium: 'paid',
    etichetta: 'Inserzioni Meta',
    a_cosa_serve: 'Facebook e Instagram a pagamento. Da incollare nel campo «URL sito web».',
  },
  {
    source: 'instagram',
    medium: 'bio',
    etichetta: 'Link in bio Instagram',
    a_cosa_serve: 'L\'unico link cliccabile del profilo: senza tracciamento è indistinguibile dal diretto.',
  },
  {
    source: 'linkedin',
    medium: 'profilo',
    etichetta: 'Profilo LinkedIn',
    a_cosa_serve: 'Il sito nella sezione contatti del profilo.',
  },
  {
    source: 'firma',
    medium: 'email',
    etichetta: 'Firma delle email',
    a_cosa_serve: 'Il link sotto il nome nelle email: piccolo, continuo, e finora invisibile.',
  },
  {
    source: 'biglietto',
    medium: 'offline',
    etichetta: 'Biglietto da visita / QR',
    a_cosa_serve: 'Il QR stampato. È il solo modo di sapere se la carta porta qualcuno.',
  },
  {
    source: 'passaparola',
    medium: 'referral',
    etichetta: 'Passaparola',
    a_cosa_serve: 'Il link da dare a un cliente che ti presenta a qualcuno.',
  },
];
