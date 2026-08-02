/**
 * L'agenda degli appuntamenti: fasce, slot liberi, e il file per il calendario.
 *
 * Sostituisce il link a Calendly. La ragione non è il costo di Calendly, è che
 * quel link portava il visitatore su un altro sito nel punto esatto in cui aveva
 * deciso di scrivere: cambio di grafica, cookie di terze parti, e un modulo che
 * non è quello del sito. Qui la prenotazione resta dentro, e l'appuntamento
 * finisce nello stesso database dei lead.
 *
 * Quello che questa agenda NON fa, e va detto invece di lasciarlo scoprire: non
 * legge il calendario personale di nessuno. Sa solo quello che le è stato
 * scritto — le fasce settimanali, i giorni chiusi, gli appuntamenti già presi
 * qui. Se martedì alle 15 c'è un impegno preso altrove, l'agenda lo proporrà
 * comunque, e va chiuso quel giorno dal pannello. In cambio non c'è nessun
 * consenso OAuth da rinnovare e nessuna dipendenza che possa smettere di
 * funzionare da sola. Il feed .ics porta gli appuntamenti nel calendario
 * personale, ma in una direzione sola.
 */
import { rowsActive, tryQuery, setting, settingOn, type Settings } from './db.ts';

/** Tutto l'orario dell'agenda è ora italiana: è dove sta chi risponde. */
export const FUSO = 'Europe/Rome';

const GIORNI_ISO = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

export interface AgendaConfig {
  attiva: boolean;
  /** Durata di un appuntamento, in minuti. È anche il passo fra due slot. */
  minuti: number;
  /** Preavviso minimo: nessuno slot prima di adesso più queste ore. */
  preavviso: number;
  /** Quanti giorni avanti si può prenotare. */
  giorni: number;
  /** Minuti di respiro fra la fine di un appuntamento e l'inizio del prossimo. */
  pausa: number;
  /** Ore prima della call in cui parte il promemoria. 0 = nessun promemoria. */
  promemoria: number;
  /** Chiave del feed .ics. Vuota significa feed spento. */
  chiaveIcs: string;
}

export type FasciaRow = {
  id: number;
  /** 1 = lunedì … 7 = domenica, come ISO-8601. */
  weekday: number;
  /** 'HH:MM', ora italiana. */
  from_time: string;
  to_time: string;
  sort: number;
  active: boolean;
}

export type ChiusuraRow = {
  id: number;
  /** 'YYYY-MM-DD' — è un DATE, non un istante. */
  day: string;
  /**
   * Fascia bloccata dentro quel giorno, 'HH:MM'. Entrambi vuoti significa tutto
   * il giorno: è il caso delle ferie. Pieni significa «quel giorno, solo da qui a
   * qui» — che serve per l'impegno di mezz'ora preso altrove, e per cui prima si
   * doveva chiudere l'intera giornata.
   */
  from_time: string;
  to_time: string;
  reason: string;
  sort: number;
  active: boolean;
}

/** Un appuntamento già preso, per quello che serve al calcolo: quando e quanto. */
export interface Occupato {
  starts_at: Date;
  minutes: number;
}

export type AppuntamentoRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  note: string;
  starts_at: Date;
  minutes: number;
  status: string;
  token: string;
  ip: string;
  created_at: Date;
  /** Quando è partito il promemoria. Nullo = non ancora mandato. */
  reminded_at: Date | null;
  /**
   * Numero di revisione: cresce a ogni spostamento e finisce in SEQUENCE nel
   * .ics. È il modo in cui un calendario capisce che l'evento è cambiato invece
   * di tenersi l'orario vecchio.
   */
  version: number;
  /**
   * Da dove arriva chi ha prenotato. Vuoti per gli appuntamenti presi prima che
   * l'origine venisse registrata, e per chi arriva senza campagna: vedi
   * src/lib/campagne.ts.
   */
  camp_source: string;
  camp_medium: string;
  camp_name: string;
  pagina: string;
}

export interface Slot {
  /** L'istante, in ISO con la Z: è il valore che viaggia nel form. */
  iso: string;
  /** 'HH:MM' italiane, che è quello che si legge sul pulsante. */
  ora: string;
}

export interface GiornoLibero {
  /** 'YYYY-MM-DD' italiano. */
  data: string;
  /** 'martedì 12 agosto'. */
  etichetta: string;
  slot: Slot[];
}

// ------------------------------------------------------------------- fuso --

/**
 * Di quanto l'ora italiana è avanti rispetto a UTC in un dato istante.
 *
 * Serve perché l'ora legale esiste: la stessa fascia «09:00-13:00» è un istante
 * diverso in gennaio e in luglio, e un'agenda che ignora il cambio dell'ora
 * sbaglia di sessanta minuti per metà anno. Non c'è una libreria: si chiede a
 * Intl come si scriverebbe quell'istante a Roma e si misura la differenza. È
 * l'unico modo di ottenere i dati del fuso senza portarseli dietro a mano, e i
 * dati del fuso arrivano dal sistema, non dai dati locale — quindi funziona
 * anche su un Node compilato senza ICU completo.
 */
const formattatore = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function scartoMinuti(istante: Date): number {
  const p: Record<string, number> = {};
  for (const { type, value } of formattatore.formatToParts(istante)) {
    if (type !== 'literal') p[type] = Number(value);
  }
  const comeSeFosseUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!);
  return (comeSeFosseUtc - istante.getTime()) / 60_000;
}

/**
 * Dall'orologio italiano all'istante.
 *
 * Due passaggi e non uno: per sapere di quanto spostare l'ora locale serve lo
 * scarto del fuso, ma per sapere lo scarto serve un istante. Si parte da una
 * stima, si misura lo scarto lì, si corregge. Il secondo giro basta sempre
 * tranne che dentro l'ora che l'ora legale cancella — e a quell'ora, le due di
 * notte, questa agenda non ha slot.
 */
export function istanteDaOraItaliana(anno: number, mese: number, giorno: number, minutiDelGiorno: number): Date {
  const nudo = Date.UTC(anno, mese - 1, giorno, Math.floor(minutiDelGiorno / 60), minutiDelGiorno % 60);
  const primaStima = new Date(nudo - scartoMinuti(new Date(nudo)) * 60_000);
  return new Date(nudo - scartoMinuti(primaStima) * 60_000);
}

/** L'istante letto sull'orologio italiano. */
export function oraItaliana(istante: Date): {
  anno: number;
  mese: number;
  giorno: number;
  ore: number;
  minuti: number;
  /** 1 = lunedì … 7 = domenica. */
  weekday: number;
} {
  const p: Record<string, number> = {};
  for (const { type, value } of formattatore.formatToParts(istante)) {
    if (type !== 'literal') p[type] = Number(value);
  }
  // getUTCDay su una data costruita coi numeri locali: il giorno della settimana
  // è una proprietà del calendario, non dell'istante, quindi va letto sui numeri
  // già portati a Roma. Domenica è 0 per JS e 7 per la ISO.
  const js = new Date(Date.UTC(p.year!, p.month! - 1, p.day!)).getUTCDay();
  return {
    anno: p.year!,
    mese: p.month!,
    giorno: p.day!,
    ore: p.hour!,
    minuti: p.minute!,
    weekday: js === 0 ? 7 : js,
  };
}

/** 'YYYY-MM-DD' dall'orologio italiano. */
export function dataItaliana(istante: Date): string {
  const { anno, mese, giorno } = oraItaliana(istante);
  return `${anno}-${due(mese)}-${due(giorno)}`;
}

/** 'HH:MM' dall'orologio italiano. */
export function oraDelGiorno(istante: Date): string {
  const { ore, minuti } = oraItaliana(istante);
  return `${due(ore)}:${due(minuti)}`;
}

/** 'martedì 12 agosto', senza toLocaleDateString: vedi il commento in content.ts. */
export function etichettaGiorno(istante: Date): string {
  const { giorno, mese, weekday } = oraItaliana(istante);
  return `${GIORNI_ISO[weekday - 1]} ${giorno} ${MESI[mese - 1]}`;
}

/** 'martedì 12 agosto alle 09:30', la forma che si legge nelle email. */
export function quandoPerEsteso(istante: Date): string {
  return `${etichettaGiorno(istante)} alle ${oraDelGiorno(istante)}`;
}

function due(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'HH:MM' in minuti dalla mezzanotte, o null se non è un orario. */
export function minutiDaOrario(valore: string): number | null {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(valore);
  if (!m) return null;
  const ore = Number(m[1]);
  const minuti = Number(m[2]);
  if (ore > 23 || minuti > 59) return null;
  return ore * 60 + minuti;
}

// -------------------------------------------------------- configurazione --

/**
 * I numeri dell'agenda, con dei limiti.
 *
 * Non sono paranoia: i valori arrivano da caselle di testo del pannello, e uno
 * zero nella durata farebbe un ciclo infinito sugli slot. Ogni valore fuori
 * scala viene riportato dentro invece di far cadere la pagina.
 */
export function agendaConfig(s: Settings): AgendaConfig {
  const n = (chiave: string, def: number, min: number, max: number) => {
    const v = Number.parseInt(setting(s, chiave, String(def)), 10);
    if (!Number.isFinite(v)) return def;
    return Math.min(max, Math.max(min, v));
  };
  return {
    attiva: settingOn(s, 'agenda_attiva'),
    minuti: n('agenda_minuti', 30, 10, 240),
    preavviso: n('agenda_preavviso', 12, 0, 336),
    giorni: n('agenda_giorni', 21, 1, 90),
    pausa: n('agenda_pausa', 15, 0, 240),
    promemoria: n('agenda_promemoria', 24, 0, 336),
    chiaveIcs: setting(s, 'agenda_ics_key', '').trim(),
  };
}

// ------------------------------------------------------------------ slot --

/**
 * I giorni con almeno uno slot libero, dal preavviso in poi.
 *
 * Le fasce con orari illeggibili vengono saltate: il campo lo compila una
 * persona, e una riga sbagliata deve costare quella riga e non l'intera agenda.
 * Una fascia che finisce prima di iniziare non produce slot da sé.
 */
export function giorniLiberi(
  cfg: AgendaConfig,
  fasce: FasciaRow[],
  chiusure: ChiusuraRow[],
  occupati: Occupato[],
  adesso: Date = new Date()
): GiornoLibero[] {
  /*
    Un appuntamento non occupa solo la propria mezz'ora: si porta dietro la pausa
    da una parte e dall'altra. Si confrontano intervalli e non istanti perché la
    durata si cambia dal pannello, quindi gli appuntamenti presi ieri possono non
    essere allineati al passo di oggi — e due orari diversi possono accavallarsi.
  */
  const pieni = occupati.map((o) => ({
    da: o.starts_at.getTime() - cfg.pausa * 60_000,
    a: o.starts_at.getTime() + (o.minutes + cfg.pausa) * 60_000,
  }));
  const nonPrimaDi = adesso.getTime() + cfg.preavviso * 3_600_000;

  const risultato: GiornoLibero[] = [];
  const oggi = oraItaliana(adesso);

  for (let d = 0; d < cfg.giorni; d++) {
    // Mezzogiorno e non mezzanotte come punto d'appoggio del giorno: sommare i
    // giorni a mezzanotte inciampa nella notte in cui l'ora cambia.
    const perno = new Date(istanteDaOraItaliana(oggi.anno, oggi.mese, oggi.giorno + d, 12 * 60));
    const { anno, mese, giorno, weekday } = oraItaliana(perno);
    const data = `${anno}-${due(mese)}-${due(giorno)}`;

    // Le chiusure di questo giorno: senza orari è chiuso tutto, con gli orari
    // sono fasce da togliere.
    const diOggi = chiusure.filter((c) => c.active && giornoDaValore(c.day) === data);
    if (diOggi.some((c) => bloccoIntero(c))) continue;
    const blocchi = diOggi
      .map((c) => ({ da: minutiDaOrario(c.from_time), a: minutiDaOrario(c.to_time) }))
      .filter((b): b is { da: number; a: number } => b.da !== null && b.a !== null && b.a > b.da);

    const slot: Slot[] = [];
    const passo = cfg.minuti + cfg.pausa;
    for (const fascia of fasce) {
      if (!fascia.active || fascia.weekday !== weekday) continue;
      const inizio = minutiDaOrario(fascia.from_time);
      const fine = minutiDaOrario(fascia.to_time);
      if (inizio === null || fine === null) continue;

      // Il passo comprende la pausa, ma la fascia deve contenere solo
      // l'appuntamento: se chiudi alle 13:00 un appuntamento che finisce alle
      // 13:00 ci sta, la pausa dopo è tempo tuo.
      for (let m = inizio; m + cfg.minuti <= fine; m += passo) {
        const istante = istanteDaOraItaliana(anno, mese, giorno, m);
        if (istante.getTime() < nonPrimaDi) continue;
        if (blocchi.some((b) => m < b.a && m + cfg.minuti > b.da)) continue;
        const da = istante.getTime();
        const a = da + cfg.minuti * 60_000;
        if (pieni.some((p) => da < p.a && a > p.da)) continue;
        slot.push({ iso: istante.toISOString(), ora: oraDelGiorno(istante) });
      }
    }

    if (slot.length === 0) continue;
    slot.sort((a, b) => a.iso.localeCompare(b.iso));
    risultato.push({ data, etichetta: etichettaGiorno(perno), slot });
  }

  return risultato;
}

/**
 * Una chiusura senza orari, o con orari illeggibili, chiude il giorno intero.
 *
 * Il caso degli orari illeggibili è deliberato e va nella direzione prudente: se
 * qualcuno scrive «pomeriggio» al posto di un orario, chiudere troppo costa un
 * giorno di prenotazioni, aprire troppo costa un appuntamento sopra un impegno
 * che c'era già.
 */
function bloccoIntero(c: ChiusuraRow): boolean {
  const da = c.from_time.trim();
  const a = c.to_time.trim();
  if (da === '' && a === '') return true;
  return minutiDaOrario(da) === null || minutiDaOrario(a) === null;
}

/**
 * 'YYYY-MM-DD' da un DATE del database, che pg può consegnare come stringa o
 * come Date a seconda del tipo dichiarato.
 */
function giornoDaValore(valore: unknown): string | null {
  if (typeof valore === 'string') return /^\d{4}-\d{2}-\d{2}/.test(valore) ? valore.slice(0, 10) : null;
  if (valore instanceof Date) return dataItaliana(valore);
  return null;
}

// -------------------------------------------------------------- database --

export async function fasceAttive(): Promise<FasciaRow[]> {
  return rowsActive<FasciaRow>('agenda_windows');
}

export async function chiusureAttive(): Promise<ChiusuraRow[]> {
  return rowsActive<ChiusuraRow>('agenda_closures');
}

/**
 * Gli appuntamenti che occupano tempo da qui in avanti.
 *
 * Serve anche la durata e non solo l'istante: dal pannello si può cambiare la
 * durata degli appuntamenti, quindi quelli presi prima possono essere più lunghi
 * o più corti di quelli di adesso, e la sovrapposizione si calcola sugli
 * intervalli. Un giorno indietro nella finestra perché un appuntamento iniziato
 * ieri sera con una durata lunga può ancora coprire stamattina.
 */
export async function slotOccupati(): Promise<Occupato[]> {
  return await tryQuery<Occupato>(
    `SELECT starts_at, minutes FROM appointments
      WHERE status = 'confermato' AND starts_at > now() - interval '1 day'`
  );
}

/** L'agenda pubblica pronta da mostrare. */
export async function agendaPubblica(
  s: Settings,
  adesso: Date = new Date()
): Promise<{ cfg: AgendaConfig; giorni: GiornoLibero[] }> {
  const cfg = agendaConfig(s);
  if (!cfg.attiva) return { cfg, giorni: [] };
  const [fasce, chiusure, occupati] = await Promise.all([
    fasceAttive(),
    chiusureAttive(),
    slotOccupati(),
  ]);
  return { cfg, giorni: giorniLiberi(cfg, fasce, chiusure, occupati, adesso) };
}

/**
 * Lo slot chiesto è davvero libero e legale?
 *
 * Si ricalcola l'agenda e si cerca l'istante dentro, invece di fidarsi del
 * valore arrivato dal form: quel valore è un campo nascosto in una pagina
 * pubblica, e senza questo controllo chiunque potrebbe prenotare le tre di notte
 * di Natale scrivendo un'altra data nella richiesta. Il vincolo univoco sul
 * database resta comunque l'ultima parola sulle due prenotazioni simultanee.
 */
export function slotAmmesso(giorni: GiornoLibero[], iso: string): Date | null {
  const istante = new Date(iso);
  if (Number.isNaN(istante.getTime())) return null;
  const cercato = istante.toISOString();
  for (const g of giorni) {
    for (const s of g.slot) if (s.iso === cercato) return istante;
  }
  return null;
}

// --------------------------------------------------------------- il .ics --

/** Un istante nella forma che vuole iCalendar: 20260812T073000Z. */
function icsIstante(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Nel testo di un .ics la virgola, il punto e virgola e la barra rovescia sono
 * separatori: vanno protetti, o una nota con una virgola sposta i campi.
 */
function icsTesto(valore: string): string {
  return valore
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Le righe di un .ics non superano i 75 ottetti: si piegano con uno spazio in
 * testa alla continuazione. Il conto è sui byte e non sui caratteri, perché una
 * lettera accentata ne occupa due.
 */
function piega(riga: string): string {
  const byte = Buffer.from(riga, 'utf8');
  if (byte.length <= 75) return riga;
  const pezzi: string[] = [];
  let inizio = 0;
  let limite = 75;
  while (inizio < byte.length) {
    let fine = Math.min(inizio + limite, byte.length);
    // Non si taglia in mezzo a un carattere multi-byte.
    while (fine > inizio && fine < byte.length && (byte[fine]! & 0xc0) === 0x80) fine--;
    pezzi.push(byte.subarray(inizio, fine).toString('utf8'));
    inizio = fine;
    limite = 74;
  }
  return pezzi.join('\r\n ');
}

export interface EventoIcs {
  token: string;
  starts_at: Date;
  minutes: number;
  name: string;
  email: string;
  note: string;
  /** Revisione dell'appuntamento: diventa SEQUENCE. Vedi AppuntamentoRow. */
  version?: number;
}

/** Un calendario iCalendar con gli appuntamenti dati. */
export function calendarioIcs(eventi: EventoIcs[], base: string, nomeCalendario = 'Dext Lab'): string {
  const righe: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Dext Lab//Agenda//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsTesto(nomeCalendario)}`,
    `X-WR-TIMEZONE:${FUSO}`,
  ];

  for (const e of eventi) {
    const fine = new Date(e.starts_at.getTime() + e.minutes * 60_000);
    const dettagli = [
      `Nome: ${e.name}`,
      `Email: ${e.email}`,
      e.note ? `Note: ${e.note}` : '',
      `Gestisci: ${new URL(`/prenota/${e.token}`, base + '/').href}`,
    ]
      .filter(Boolean)
      .join('\n');

    righe.push(
      'BEGIN:VEVENT',
      `UID:${e.token}@dextlab.it`,
      // Nessun Date.now(): l'istante di creazione è quello dell'appuntamento,
      // così lo stesso evento produce sempre lo stesso testo e i calendari non
      // lo vedono cambiare a ogni lettura del feed.
      `DTSTAMP:${icsIstante(e.starts_at)}`,
      // SEQUENCE cresce a ogni spostamento: è il solo modo di dire a un
      // calendario «questo evento che hai già è cambiato». Senza, chi aveva
      // salvato l'appuntamento si terrebbe l'orario vecchio.
      `SEQUENCE:${e.version ?? 0}`,
      `DTSTART:${icsIstante(e.starts_at)}`,
      `DTEND:${icsIstante(fine)}`,
      `SUMMARY:${icsTesto(`Call con ${e.name}`)}`,
      `DESCRIPTION:${icsTesto(dettagli)}`,
      'END:VEVENT'
    );
  }

  righe.push('END:VCALENDAR');
  // CRLF: lo vuole la specifica, e i calendari meno tolleranti lo pretendono.
  return righe.map(piega).join('\r\n') + '\r\n';
}
