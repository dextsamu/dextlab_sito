/**
 * L'imbuto, canale per canale: clic → contatti → call.
 *
 * È la pagina che serve per decidere se un annuncio va rifatto o spento, ed è
 * fatta di tre numeri per riga perché due non bastano. Le visite da sole dicono
 * quanto si è speso in attenzione; i contatti da soli non dicono da dove
 * venivano. Insieme dicono la sola cosa che conta: quanti clic ci vogliono per
 * una risposta, su quel canale.
 *
 * Tutto viene da tabelle già esistenti (visits, leads, appointments): nessun
 * servizio esterno, nessun conteggio che si possa perdere se domani un blocco
 * pubblicitario nel browser decide di bloccarlo.
 */
import { tryQuery } from './db.ts';
import { chiaveCampagna, type Campagna } from './campagne.ts';

export interface RigaCanale extends Campagna {
  /** Visite registrate, comprese quelle dei bot. */
  visite: number;
  /** Visite che hanno eseguito JavaScript: le persone. */
  umane: number;
  lead: number;
  call: number;
  /** Contatti ogni cento visite umane. Null se non ci sono visite umane. */
  tasso: number | null;
}

export interface RigaReferrer {
  host: string;
  visite: number;
}

export interface RigaPagina {
  pagina: string;
  lead: number;
  call: number;
}

export interface StatoMarketing {
  giorni: number;
  /** Visite totali del periodo (escluse quelle in manutenzione). */
  visite: number;
  visiteConOrigine: number;
  lead: number;
  leadConOrigine: number;
  call: number;
  callConOrigine: number;
  canali: RigaCanale[];
  referrer: RigaReferrer[];
  pagine: RigaPagina[];
}

interface Conteggi {
  visite: number;
  umane: number;
  lead: number;
  call: number;
}

function vuoto(): Conteggi {
  return { visite: 0, umane: 0, lead: 0, call: 0 };
}

/**
 * Le tre parti dell'origine tornano indietro dalla chiave. La chiave la
 * costruisce chiaveCampagna con la barra verticale, che i valori normalizzati
 * non possono contenere: quindi lo split è esatto e non serve indovinare.
 */
function dallaChiave(k: string): Campagna {
  const [source = '', medium = '', name = ''] = k.split('|');
  return { source, medium, name };
}

export async function statoMarketing(giorni = 30): Promise<StatoMarketing> {
  // Il periodo entra nella query come intero già validato: è un numero di
  // giorni, non testo, e non arriva mai da un modulo pubblico.
  const g = Math.min(365, Math.max(1, Math.round(giorni)));

  const visite = await tryQuery<{
    camp_source: string;
    camp_medium: string;
    camp_name: string;
    tot: string;
    umane: string;
  }>(
    `SELECT camp_source, camp_medium, camp_name,
            COUNT(*)                        AS tot,
            COUNT(*) FILTER (WHERE human)   AS umane
       FROM visits
      WHERE created_at >= now() - make_interval(days => $1::int)
        AND NOT is_maintenance
      GROUP BY camp_source, camp_medium, camp_name`,
    [g]
  );

  const lead = await tryQuery<{
    camp_source: string;
    camp_medium: string;
    camp_name: string;
    tot: string;
  }>(
    `SELECT camp_source, camp_medium, camp_name, COUNT(*) AS tot
       FROM leads
      WHERE created_at >= now() - make_interval(days => $1::int)
      GROUP BY camp_source, camp_medium, camp_name`,
    [g]
  );

  /*
    Gli appuntamenti si contano su created_at e non su starts_at: la domanda è
    «quanti se ne sono presi in questo periodo», non «quanti cadono in questo
    periodo». I disdetti restano contati — la campagna ha fatto il suo lavoro
    portando la prenotazione, e cancellarli dal conteggio farebbe sembrare peggio
    un canale che invece funziona.
  */
  const call = await tryQuery<{
    camp_source: string;
    camp_medium: string;
    camp_name: string;
    tot: string;
  }>(
    `SELECT camp_source, camp_medium, camp_name, COUNT(*) AS tot
       FROM appointments
      WHERE created_at >= now() - make_interval(days => $1::int)
      GROUP BY camp_source, camp_medium, camp_name`,
    [g]
  );

  const mappa = new Map<string, Conteggi>();
  const prendi = (c: Campagna): Conteggi => {
    const k = chiaveCampagna(c);
    const esistente = mappa.get(k);
    if (esistente) return esistente;
    const nuovo = vuoto();
    mappa.set(k, nuovo);
    return nuovo;
  };

  for (const r of visite) {
    const c = prendi({ source: r.camp_source, medium: r.camp_medium, name: r.camp_name });
    c.visite += Number(r.tot);
    c.umane += Number(r.umane);
  }
  for (const r of lead) {
    prendi({ source: r.camp_source, medium: r.camp_medium, name: r.camp_name }).lead += Number(r.tot);
  }
  for (const r of call) {
    prendi({ source: r.camp_source, medium: r.camp_medium, name: r.camp_name }).call += Number(r.tot);
  }

  const canali: RigaCanale[] = [...mappa.entries()].map(([k, c]) => ({
    ...dallaChiave(k),
    ...c,
    // Il tasso si calcola sulle visite umane, non su tutte: i bot non
    // compilano moduli, e tenerli dentro farebbe sembrare inefficace ogni
    // canale che attira anche crawler.
    tasso: c.umane > 0 ? Math.round((c.lead / c.umane) * 1000) / 10 : null,
  }));

  /*
    Ordine: prima chi ha portato contatti, poi chi ha portato call, poi chi ha
    portato visite. Il canale «Diretto» finisce dove lo mettono i suoi numeri e
    non in cima per diritto: è quasi sempre il più grosso, ed è anche l'unico su
    cui non si può fare niente.
  */
  canali.sort((a, b) => b.lead - a.lead || b.call - a.call || b.visite - a.visite);

  const referer = await tryQuery<{ referer: string | null; tot: string }>(
    `SELECT referer, COUNT(*) AS tot
       FROM visits
      WHERE created_at >= now() - make_interval(days => $1::int)
        AND referer <> ''
        AND NOT is_maintenance
      GROUP BY referer`,
    [g]
  );

  // Gli host si ricavano qui e non in SQL: l'estrazione con URL() è la stessa
  // che usa la classificazione dei canali, quindi i due elenchi non possono
  // discordare su cos'è un host.
  const perHost = new Map<string, number>();
  for (const r of referer) {
    let host = '';
    try {
      host = new URL(r.referer ?? '').hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      continue;
    }
    if (host === '') continue;
    perHost.set(host, (perHost.get(host) ?? 0) + Number(r.tot));
  }
  const referrer: RigaReferrer[] = [...perHost.entries()]
    .map(([host, visite]) => ({ host, visite }))
    .sort((a, b) => b.visite - a.visite)
    .slice(0, 12);

  const paginaLead = await tryQuery<{ pagina: string; tot: string }>(
    `SELECT pagina, COUNT(*) AS tot
       FROM leads
      WHERE created_at >= now() - make_interval(days => $1::int)
        AND pagina <> ''
      GROUP BY pagina`,
    [g]
  );
  const paginaCall = await tryQuery<{ pagina: string; tot: string }>(
    `SELECT pagina, COUNT(*) AS tot
       FROM appointments
      WHERE created_at >= now() - make_interval(days => $1::int)
        AND pagina <> ''
      GROUP BY pagina`,
    [g]
  );
  const perPagina = new Map<string, RigaPagina>();
  for (const r of paginaLead) {
    perPagina.set(r.pagina, { pagina: r.pagina, lead: Number(r.tot), call: 0 });
  }
  for (const r of paginaCall) {
    const riga = perPagina.get(r.pagina) ?? { pagina: r.pagina, lead: 0, call: 0 };
    riga.call += Number(r.tot);
    perPagina.set(r.pagina, riga);
  }
  const pagine = [...perPagina.values()].sort((a, b) => b.lead + b.call - (a.lead + a.call));

  const somma = (righe: RigaCanale[], campo: keyof Conteggi, conOrigine = false) =>
    righe.filter((r) => (conOrigine ? r.source !== '' : true)).reduce((t, r) => t + r[campo], 0);

  return {
    giorni: g,
    visite: somma(canali, 'visite'),
    visiteConOrigine: somma(canali, 'visite', true),
    lead: somma(canali, 'lead'),
    leadConOrigine: somma(canali, 'lead', true),
    call: somma(canali, 'call'),
    callConOrigine: somma(canali, 'call', true),
    canali,
    referrer,
    pagine,
  };
}

/**
 * Le pagine a cui può puntare un link tracciato.
 *
 * Elenco corto e scritto a mano: sono le destinazioni che hanno senso in un
 * annuncio. Le schede dei lavori si aggiungono a runtime dal database, perché
 * quelle cambiano.
 */
export const DESTINAZIONI: { percorso: string; etichetta: string }[] = [
  { percorso: '/', etichetta: 'Home' },
  { percorso: '/#preventivo', etichetta: 'Configuratore del preventivo' },
  { percorso: '/#contatti', etichetta: 'Modulo contatti' },
  { percorso: '/prenota', etichetta: 'Prenotazione della call' },
  { percorso: '/#portfolio', etichetta: 'Lavori' },
];
