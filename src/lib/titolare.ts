/**
 * Chi tratta i dati, scritto in un posto solo.
 *
 * Serve a /privacy e a /termini, che prima non lo dicevano affatto: la privacy
 * aveva tre segnaposto fra parentesi quadre e i termini nominavano solo il
 * marchio. Un'informativa che non identifica il titolare non assolve l'art. 13
 * GDPR, e dei termini che non dicono chi si obbliga non dicono niente.
 *
 * Le regole di composizione stanno qui e non nelle due pagine perché la
 * differenza fra le due pagine è il testo intorno, non il dato: se domani la
 * partita IVA va scritta in un modo diverso, va cambiata in un posto.
 *
 * Il principio è quello dei dati locali (vedi seo.ts): UN CAMPO VUOTO NON SI
 * RIEMPIE. Niente partita IVA finché non c'è, niente indirizzo finché non c'è una
 * sede pubblicabile, e nessun nome inventato se l'impostazione è vuota. Su una
 * pagina legale un dato falso o approssimativo è peggio di un dato assente: il
 * dato assente si vede e si aggiunge, quello falso viene creduto.
 */
import { setting, type Settings } from './db.ts';

export interface Titolare {
  /** Il marchio con cui il sito si presenta. Non è un'identificazione legale. */
  marchio: string;
  /**
   * Nome e cognome, o la ragione sociale quando ci sarà. Vuoto significa che
   * nessuno l'ha ancora scritto nel pannello: la pagina non lo inventa.
   */
  nome: string;
  /** Vuota finché non esiste. Vedi la 017: non si annuncia come «in arrivo». */
  partitaIva: string;
  /** Indirizzo completo, o vuoto. Mai una parte: «Sarzana» da solo non è una sede. */
  sede: string;
  /** Recapito per esercitare i diritti. È l'unico campo che non può mancare. */
  email: string;
}

export function titolare(s: Settings): Titolare {
  const via = setting(s, 'biz_street').trim();
  const cap = setting(s, 'biz_zip').trim();
  const citta = setting(s, 'biz_city').trim();
  const provincia = setting(s, 'biz_province').trim().toUpperCase();

  // La sede si dichiara solo se c'è almeno via e città: un CAP senza via, o una
  // città senza via, non sono un indirizzo postale — e per chi lavora da remoto
  // non dichiararlo è la forma corretta, non una omissione.
  const pezzi = via !== '' && citta !== '' ? [via, [cap, citta].filter(Boolean).join(' ')] : [];
  const sede = pezzi.length > 0 ? `${pezzi.join(', ')}${provincia ? ` (${provincia})` : ''}` : '';

  return {
    marchio: setting(s, 'biz_name', 'Dext Lab').trim(),
    nome: setting(s, 'legal_titolare').trim(),
    partitaIva: setting(s, 'biz_vat').trim(),
    sede,
    email: setting(s, 'contact_email', 'info@dextlab.it').trim(),
  };
}

/**
 * L'identificazione come va letta, email esclusa.
 *
 * L'email resta fuori perché nelle pagine è un link `mailto:` e qui tornerebbe
 * come testo: comparirebbe scritta e non cliccabile proprio nel punto in cui
 * serve che si possa premere.
 *
 * Senza `nome` torna il solo marchio. È voluto: dice al visitatore quello che il
 * sito sa dire, e non gli mostra una parentesi quadra. Che il campo sia da
 * compilare lo dice il pannello a chi può compilarlo — non la pagina pubblica a
 * chi non può farci niente.
 */
export function identificazione(t: Titolare): string {
  const parti = [t.nome, t.sede, t.partitaIva ? `P.IVA ${t.partitaIva}` : ''].filter(
    (p) => p !== ''
  );
  return parti.length > 0 ? `${t.marchio} — ${parti.join(', ')}` : t.marchio;
}

/** Vero quando l'informativa identifica davvero il titolare. Usata dal pannello. */
export function titolareCompleto(t: Titolare): boolean {
  return t.nome !== '' && t.email !== '';
}
