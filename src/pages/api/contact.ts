/**
 * Endpoint del form contatti.
 *
 * Sostituisce contact.php. Differenza di comportamento voluta: il visitatore
 * riceve conferma se il messaggio è stato acquisito, cioè se il lead è finito a
 * database oppure l'email è partita. Prima, senza SMTP configurato, si tentava
 * mail() e nell'immagine Docker (priva di MTA) il form rispondeva 500 pur
 * avendo già salvato il lead: il visitatore vedeva un errore per un messaggio
 * che in realtà era arrivato.
 */
import type { APIRoute } from 'astro';
import {
  query,
  rateLimit,
  getSettings,
  origineDaVisita,
  visitaRecente,
  messaggioGiaArrivato,
  rowsActive,
  type PricingRow,
} from '../../lib/db.ts';
import { valutaContatto, secondiDaMarca } from '../../lib/spam.ts';
import { mailConfig, sendLeadMails, isMailUsable, type LeadMessage } from '../../lib/mail.ts';
import { telegramConfig, notifyLead } from '../../lib/telegram.ts';
import { chiaveListino, formatWeeks } from '../../lib/content.ts';
import {
  DOMANDE,
  rispostaLeggibile,
  riepilogoTestuale,
  richiestaVuota,
  type Richiesta,
} from '../../lib/richiesta.ts';

const MAX_NAME = 120;
const MAX_EMAIL = 190;
const MAX_SUBJECT = 190;
const MAX_MESSAGE = 5000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

const ok = (message: string) => json({ ok: true, message });
const fail = (message: string, status: number) => json({ ok: false, message }, status);

/** Rimuove i caratteri di controllo: non hanno senso nei campi di un form. */
function clean(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

function isEmail(value: string): boolean {
  if (value.length > MAX_EMAIL) return false;
  // Volutamente permissiva: la validazione forte di un indirizzo è la consegna.
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}

/**
 * La richiesta configurata, ricostruita dal listino e non dal modulo.
 *
 * Il modulo manda chiavi («ecommerce», «seoavanzata»), non etichette. Le chiavi
 * si cercano nel listino e si traducono indietro: quello che arriva nella email è
 * sempre un'etichetta vera, e una chiave inventata sparisce invece di finire in
 * una riga che sembra un dato. Stessa regola delle risposte alle quattro domande
 * (vedi rispostaLeggibile in richiesta.ts).
 *
 * Le settimane si sommano qui e non si leggono dal modulo, per lo stesso motivo:
 * un tempo che arriva da fuori non è una stima, è un valore che qualcuno ha
 * scritto. Il listino è l'unica fonte.
 *
 * Se il database non risponde la richiesta esce vuota e il contatto arriva
 * comunque: un messaggio senza il riepilogo è un contatto in meno da ricontattare,
 * un errore 500 è un contatto perso.
 */
async function richiestaDalModulo(
  tipoChiave: string,
  funzioniChiavi: string[],
  risposte: [string, string][]
): Promise<Richiesta> {
  let tipi: PricingRow[] = [];
  let addons: PricingRow[] = [];
  try {
    [tipi, addons] = await Promise.all([
      rowsActive<PricingRow>('pricing_types'),
      rowsActive<PricingRow>('pricing_addons'),
    ]);
  } catch (err) {
    console.error('[contact] listino non letto:', (err as Error).message);
  }

  const tipo = tipi.find((t) => chiaveListino(t.label) === tipoChiave);
  // Nell'ordine del listino e non in quello di arrivo: il modulo li manda
  // nell'ordine del documento, ma un valore ripetuto a mano li duplicherebbe.
  const scelte = new Set(funzioniChiavi);
  const funzioni = addons.filter((a) => scelte.has(chiaveListino(a.label)));

  const settimane = (tipo?.weeks ?? 0) + funzioni.reduce((n, a) => n + a.weeks, 0);

  return {
    progetto: tipo?.label ?? '',
    funzioni: funzioni.map((a) => a.label),
    tempi: tipo ? formatWeeks(settimane) : '',
    contesto: risposte,
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('Richiesta non valida.', 400);
  }

  const field = (name: string) => {
    const v = form.get(name);
    return typeof v === 'string' ? v : '';
  };

  const ip = locals.clientIp;
  if (!(await rateLimit('contact', 5, 900, ip))) {
    return fail(
      'Hai inviato troppi messaggi. Riprova tra qualche minuto o scrivimi a info@dextlab.it.',
      429
    );
  }

  const name = clean(field('name'));
  const email = clean(field('email'));
  const subjectRaw = clean(field('subject'));
  const message = field('message').trim();

  const errors: string[] = [];
  if (name === '' || name.length > MAX_NAME) errors.push('nome');
  if (!isEmail(email)) errors.push('email');
  if (message === '' || message.length > MAX_MESSAGE) errors.push('messaggio');
  if (errors.length > 0) {
    return fail(`Controlla i campi: ${errors.join(', ')}.`, 422);
  }

  const subject = (subjectRaw || 'Nuovo contatto dal sito').slice(0, MAX_SUBJECT);

  /*
    La richiesta configurata.

    Prima l'unico modo in cui le scelte del configuratore arrivavano era una frase
    che il JavaScript scriveva nel campo del messaggio: bastava che il visitatore
    la cancellasse — o che non avesse il JavaScript — e la richiesta arrivava senza
    dire cosa chiedeva. Adesso sono campi del modulo, e questo è il punto in cui si
    rileggono.

    Il riepilogo si ATTACCA al messaggio, non lo sostituisce: le parole di chi
    scrive restano sue e in cima. Il blocco è separato da una riga che si riconosce
    a occhio, perché chi legge la email deve capire in un colpo dove finisce quello
    che gli è stato scritto e dove comincia quello che ha compilato un modulo.
  */
  const risposte: [string, string][] = [];
  for (const d of DOMANDE) {
    const testo = rispostaLeggibile(d.campo, clean(field(d.campo)));
    if (testo !== '') risposte.push([d.etichetta, testo]);
  }
  const richiesta = await richiestaDalModulo(
    clean(field('cfg_tipo')),
    form.getAll('cfg_funzioni').flatMap((v) => (typeof v === 'string' ? [clean(v)] : [])),
    risposte
  );
  const messaggioCompleto = richiestaVuota(richiesta)
    ? message
    : `${message}\n\n— Richiesta dal configuratore —\n${riepilogoTestuale(richiesta)}`;

  const lead: LeadMessage = { name, email, subject, message: messaggioCompleto, ip };

  /*
    Spam o no. La decisione riguarda SOLO la notifica: il lead viene salvato in
    ogni caso, con stato «spam» invece di «nuovo», e dal pannello si può rimettere
    a nuovo con un clic. Il conto dei danni è spiegato in src/lib/spam.ts, e si
    riassume così: un contatto perso è l'unico errore irreparabile.

    Il campo trappola era gestito qui sopra con un ritorno anticipato: il
    contatto veniva buttato e non restava traccia da nessuna parte. Adesso è un
    segnale come gli altri e la riga si conserva — se un giorno la trappola
    prendesse un cliente vero, senza la riga non lo si scoprirebbe mai.
  */
  const ripetuto = await messaggioGiaArrivato(message, email);
  const esitoSpam = valutaContatto(
    { name, email, subject, message },
    {
      secondi: secondiDaMarca(field('t').trim()),
      visitaValida: await visitaRecente(field('vt').trim()),
      ripetuto,
      trappola: field('website').trim() !== '',
    }
  );

  /*
    Da dove arriva questo contatto. Il token nel campo nascosto è quello della
    visita che ha reso il modulo, e su quella riga la campagna c'è già: qui si
    ricopia, così il lead resta collegato all'annuncio anche fra sei mesi, quando
    la riga della visita sarà stata cancellata. Se il token manca o non
    corrisponde a niente il contatto è «diretto»: si registra l'assenza del dato,
    non un'ipotesi.
  */
  const origine = await origineDaVisita(field('vt').trim());

  // 1. Persistenza: è il canale che non dipende da servizi esterni.
  let leadSaved = false;
  try {
    await query(
      `INSERT INTO leads (name, email, subject, message, source, ip, status,
                          camp_source, camp_medium, camp_name, pagina)
       VALUES ($1, $2, $3, $4, 'form', $5, $6, $7, $8, $9, $10)`,
      [
        name,
        email,
        subject,
        // Con il riepilogo attaccato: è la stessa cosa che legge chi riceve la
        // email, e nel pannello il lead non deve dire di meno. Quando è spam si
        // aggiungono i motivi: chi apre il pannello deve poter capire in due
        // secondi PERCHÉ è finito lì, e decidere che avevamo torto.
        esitoSpam.spam
          ? `${messaggioCompleto}\n\n— Riconosciuto come spam —\n${esitoSpam.motivi.join('\n')}`
          : messaggioCompleto,
        ip || null,
        esitoSpam.spam ? 'spam' : 'new',
        origine.camp_source,
        origine.camp_medium,
        origine.camp_name,
        origine.pagina,
      ]
    );
    leadSaved = true;
  } catch (err) {
    console.error('[contact] lead non salvato:', (err as Error).message);
  }

  /*
    Riconosciuto come spam: la riga è salvata, le notifiche no, e a chi ha mandato
    si risponde come sempre. Le due cose sono deliberate.

    Niente notifica è il punto di tutto il lavoro: la posta e Telegram sono la
    ragione per cui lo spam dà fastidio, il database no — lì una riga in più non
    disturba nessuno e resta consultabile.

    La risposta identica serve a non insegnare niente a chi prova: un modulo che
    risponde «sei un bot» dice al programma quale campo cambiare al giro dopo, e
    chi manda spam in serie prova finché non passa.
  */
  if (esitoSpam.spam) {
    console.warn(
      `[contact] spam da ${ip ?? '(ip ignoto)'}: ${esitoSpam.motivi.join('; ')}. Salvato: ${leadSaved}.`
    );
    return ok('Messaggio inviato! Ti rispondo entro 24 ore.');
  }

  const settings = await getSettings();

  // 2. Notifica immediata e 3. email: entrambe best-effort, in parallelo.
  const [, mail] = await Promise.all([
    notifyLead(telegramConfig(settings), lead),
    sendLeadMails(lead, mailConfig(settings)),
  ]);

  if (!mail.leadSent) {
    const cfg = mailConfig(settings);
    const detail = isMailUsable(cfg) ? mail.reason : 'SMTP non configurato in admin → Impostazioni';
    console.warn(`[contact] email non inviata (${detail}). Lead salvato: ${leadSaved}.`);
  }

  if (leadSaved || mail.leadSent) {
    return ok('Messaggio inviato! Ti rispondo entro 24 ore.');
  }

  // Nessun canale ha funzionato: qui l'errore è reale.
  return fail('Invio non riuscito. Scrivimi direttamente a info@dextlab.it.', 500);
};

/** Il form è l'unico ingresso previsto: una GET non deve restituire nulla di utile. */
export const ALL: APIRoute = () => fail('Metodo non consentito.', 405);
