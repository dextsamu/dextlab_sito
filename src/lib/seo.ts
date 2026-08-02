/**
 * I dati strutturati della pagina, costruiti da quello che c'è davvero.
 *
 * Erano scritti a mano in Landing.astro: nome, email, servizi e «areaServed: IT».
 * Per una ricerca locale non contano niente — chi cerca «sviluppatore siti web» più
 * il nome di una città sta chiedendo un'altra cosa, e «IT» non risponde.
 *
 * La regola di questo file è una sola, e non è tecnica: NON si dichiara un dato che
 * non è stato scritto da una persona. Un indirizzo, un telefono o una partita IVA
 * inventati non sono un'imprecisione da correggere poi: sono un'affermazione falsa
 * su chi sta dietro al sito, e Google li confronta con la scheda dell'attività. Se
 * non combaciano il segnale è perso; se combaciano ma sono falsi, il problema non è
 * più il posizionamento.
 *
 * Quindi ogni campo qui sotto è condizionale. Con le impostazioni vuote esce un
 * oggetto onesto e povero — nome, sito, email, servizi — che è esattamente quello
 * che il sito può dimostrare.
 *
 * Sul caso «nessuna sede»: un'attività che lavora da remoto o a domicilio non
 * pubblica la via. Si dichiarano la città e le zone servite, e schema.org prevede
 * questa forma (`areaServed`) proprio per queste attività: non è una scorciatoia.
 */
import { setting, type Settings } from './db.ts';

export interface DatiLocali {
  nome: string;
  telefono: string;
  citta: string;
  provincia: string;
  regione: string;
  /** Comuni o province servite, già divisi. */
  zone: string[];
  via: string;
  cap: string;
  lat: string;
  lng: string;
  /** Orari nella forma libera scritta nel pannello: finiscono in pagina, non in JSON-LD. */
  orari: string;
  partitaIva: string;
  /** Indirizzo della scheda Google dell'attività. */
  mappa: string;
  /** Profili pubblici: confermano che l'attività è la stessa. */
  profili: string[];
}

/** Solo indirizzi http(s): questi valori finiscono in `sameAs` e in un href. */
function soloWeb(v: string): string {
  const t = v.trim();
  if (t === '') return '';
  try {
    const u = new URL(t);
    return u.protocol === 'https:' || u.protocol === 'http:' ? t : '';
  } catch {
    return '';
  }
}

export function datiLocali(s: Settings): DatiLocali {
  return {
    nome: setting(s, 'biz_name', 'Dext Lab').trim(),
    telefono: setting(s, 'biz_phone').trim(),
    citta: setting(s, 'biz_city').trim(),
    provincia: setting(s, 'biz_province').trim().toUpperCase(),
    regione: setting(s, 'biz_region').trim(),
    zone: setting(s, 'biz_zone')
      .split(',')
      .map((z) => z.trim())
      .filter(Boolean),
    via: setting(s, 'biz_street').trim(),
    cap: setting(s, 'biz_zip').trim(),
    lat: setting(s, 'biz_lat').trim(),
    lng: setting(s, 'biz_lng').trim(),
    orari: setting(s, 'biz_hours').trim(),
    partitaIva: setting(s, 'biz_vat').trim(),
    mappa: soloWeb(setting(s, 'biz_maps')),
    profili: ['social_linkedin', 'social_github', 'social_instagram', 'social_facebook']
      .map((k) => soloWeb(setting(s, k)))
      .filter(Boolean),
  };
}

/** Vero se c'è abbastanza per dire qualcosa di locale senza inventare. */
export function haDatiLocali(d: DatiLocali): boolean {
  return d.citta !== '' || d.zone.length > 0;
}

interface Contenuti {
  email: string;
  descrizione: string;
  servizi: string[];
  /**
   * Formazione e certificazioni, già filtrate da qualificaMostrabile: qui dentro
   * arriva solo ciò che ha un titolo e un ente.
   */
  qualifiche?: {
    title: string;
    issuer: string;
    scheme: string;
    year: string;
    code: string;
    url: string;
  }[];
}

/**
 * Una qualifica come oggetto schema.org.
 *
 * `recognizedBy` è la parte che conta: senza l'ente che l'ha rilasciata questa
 * dichiarazione sarebbe «mi attesto da me», e infatti una qualifica senza ente
 * non arriva nemmeno fin qui (vedi qualificaMostrabile in content.ts).
 *
 * L'anno si dichiara solo se è un anno: il campo è testo libero, e «giugno 2026»
 * scritto in una data ISO produrrebbe un dato non valido invece di un dato in
 * meno. Stessa regola delle coordinate qui sopra.
 */
function qualificaJsonLd(q: NonNullable<Contenuti['qualifiche']>[number]): Record<string, unknown> {
  const o: Record<string, unknown> = {
    '@type': 'EducationalOccupationalCredential',
    name: q.title,
    recognizedBy: { '@type': 'Organization', name: q.issuer },
  };
  if (q.scheme) o.credentialCategory = q.scheme;
  if (q.code) o.identifier = q.code;
  const web = soloWeb(q.url);
  if (web) o.url = web;
  if (/^\d{4}$/.test(q.year.trim())) o.dateCreated = q.year.trim();
  return o;
}

/**
 * L'attività, come oggetto schema.org.
 *
 * Il tipo resta ProfessionalService — è un sottotipo di LocalBusiness, quindi
 * regge i campi locali, e dice cosa fa l'attività meglio di «LocalBusiness» nudo.
 * L'`@id` è l'indirizzo del sito con un frammento: serve a legare fra loro gli
 * oggetti di pagine diverse invece di lasciarne uno diverso per pagina.
 */
export function attivitaJsonLd(d: DatiLocali, c: Contenuti, base: string): Record<string, unknown> {
  const o: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${base}/#attivita`,
    name: d.nome,
    description: c.descrizione,
    url: base,
    email: c.email,
    image: new URL('/assets/og.png', base + '/').href,
    logo: new URL('/assets/logo-v.png', base + '/').href,
    knowsLanguage: ['it'],
    serviceType: c.servizi,
  };

  /*
    Le qualifiche. Non c'è nessun `knowsAbout` accanto, e l'assenza è deliberata:
    dedurre «conosce il GDPR» dal titolo di un attestato sarebbe una deduzione mia
    scritta come se fosse un dato. La qualifica dice chi l'ha rilasciata e dove si
    verifica; il resto lo giudica chi legge.
  */
  const qualifiche = (c.qualifiche ?? []).filter((q) => q.title.trim() !== '' && q.issuer.trim() !== '');
  if (qualifiche.length > 0) o.hasCredential = qualifiche.map(qualificaJsonLd);

  if (d.telefono) o.telephone = d.telefono;
  if (d.partitaIva) o.vatID = d.partitaIva;
  if (d.profili.length > 0) o.sameAs = d.profili;
  if (d.mappa) o.hasMap = d.mappa;

  /*
    L'indirizzo si dichiara in due forme diverse, e la scelta non è estetica.
    Con la via è un indirizzo postale completo: vale per un'attività che riceve.
    Senza la via, ma con la città, si dichiara solo la località — è la forma per
    chi lavora da remoto o a domicilio, e dire «Sarzana (SP), Italia» è vero anche
    senza una porta su cui bussare. Se manca anche la città non si scrive niente.
  */
  if (d.citta) {
    const indirizzo: Record<string, string> = {
      '@type': 'PostalAddress',
      addressLocality: d.citta,
      addressCountry: 'IT',
    };
    if (d.via) indirizzo.streetAddress = d.via;
    if (d.cap) indirizzo.postalCode = d.cap;
    if (d.provincia) indirizzo.addressRegion = d.provincia;
    o.address = indirizzo;
  }

  // Le coordinate solo se sono numeri: un campo di testo può contenere qualsiasi
  // cosa, e una latitudine sbagliata mette l'attività in mezzo al mare.
  const lat = Number.parseFloat(d.lat);
  const lng = Number.parseFloat(d.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    o.geo = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
  }

  /*
    Le zone servite: una voce per comune o provincia. È il campo che sostituisce
    l'indirizzo per un'attività senza sede, ed è anche quello che dice a chi legge
    fin dove ci si muove. Senza zone si ripiega sulla regione, poi sull'Italia —
    che è vero, e infatti è l'unica cosa che si poteva dire prima.
  */
  if (d.zone.length > 0) {
    o.areaServed = d.zone.map((z) => ({ '@type': 'AdministrativeArea', name: z }));
  } else if (d.regione) {
    o.areaServed = { '@type': 'AdministrativeArea', name: d.regione };
  } else {
    o.areaServed = { '@type': 'Country', name: 'Italia' };
  }

  return o;
}

/**
 * Le FAQ della pagina, come FAQPage.
 *
 * Sono già scritte, sono vere e stanno nel database: dichiararle costa niente e
 * sono l'unico dato strutturato di questo sito che Google può mostrare come
 * risultato arricchito. La regola è che le domande dichiarate siano le stesse
 * visibili in pagina — un FAQPage con domande che il visitatore non trova è una
 * dichiarazione falsa, e viene trattata come tale.
 */
export function faqJsonLd(
  faqs: { question: string; answer: string }[],
  base: string
): Record<string, unknown> | null {
  const vere = faqs.filter((f) => f.question.trim() !== '' && f.answer.trim() !== '');
  if (vere.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${base}/#faq`,
    mainEntity: vere.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

/**
 * Un servizio offerto, come oggetto schema.org.
 *
 * Serve alla pagina dedicata: dice che quello è un servizio, chi lo fornisce e
 * dove. Il prezzo NON c'è, e non per dimenticanza — un `offers` con una cifra
 * dichiarata a un motore di ricerca è un impegno che il sito deve poter
 * mantenere, e questo servizio si preventiva dopo una call.
 */
export function servizioJsonLd(
  nome: string,
  descrizione: string,
  percorso: string,
  d: DatiLocali,
  base: string
): Record<string, unknown> {
  const o: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: nome,
    description: descrizione,
    url: new URL(percorso, base + '/').href,
    provider: { '@id': `${base}/#attivita` },
  };
  if (d.zone.length > 0) {
    o.areaServed = d.zone.map((z) => ({ '@type': 'AdministrativeArea', name: z }));
  } else if (d.regione) {
    o.areaServed = { '@type': 'AdministrativeArea', name: d.regione };
  } else {
    o.areaServed = { '@type': 'Country', name: 'Italia' };
  }
  return o;
}

/** Il filo di briciole della pagina di un lavoro: Home › Lavori › nome. */
export function bricioleJsonLd(
  titolo: string,
  percorso: string,
  base: string
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: base },
      { '@type': 'ListItem', position: 2, name: 'Lavori', item: `${base}/#portfolio` },
      { '@type': 'ListItem', position: 3, name: titolo, item: new URL(percorso, base + '/').href },
    ],
  };
}

/** Più oggetti in un solo blocco: @graph è il modo previsto, e resta un solo script. */
export function graficoJsonLd(oggetti: (Record<string, unknown> | null)[]): string {
  const validi = oggetti.filter((o): o is Record<string, unknown> => o !== null);
  if (validi.length === 1) return JSON.stringify(validi[0]);
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': validi.map(({ '@context': _via, ...resto }) => resto),
  });
}
