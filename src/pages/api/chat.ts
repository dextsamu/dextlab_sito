/**
 * Endpoint della chat di assistenza. Risponde con regole scritte a mano: non
 * chiama nessun modello linguistico e non è un sistema di intelligenza
 * artificiale, quindi non ricade negli obblighi di trasparenza dell'AI Act.
 *
 * La versione precedente inoltrava la conversazione ad Anthropic o OpenAI con
 * una chiave presa dalle impostazioni. È stata rimossa insieme alle
 * impostazioni ai_*: il widget resta, le risposte sono deterministiche.
 *
 * Il rate limit non serve più a contenere un costo per messaggio, che ora non
 * esiste, ma resta a difesa del database: ogni richiesta apre una transazione
 * sulla tabella rate_limits e un client insistente potrebbe saturarla.
 */
import type { APIRoute } from 'astro';
import { rateLimit, getSettings, settingOn, rowsActive, type PricingRow } from '../../lib/db.ts';
import { groupThousands } from '../../lib/content.ts';

const MAX_MESSAGES = 20;
const MAX_CHARS = 1000;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function reply(text: string, status = 200): Response {
  return new Response(JSON.stringify({ reply: text }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Normalizza la conversazione ricevuta dal client, che non è affidabile. */
function parseMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_MESSAGES) return null;

  const out: ChatMessage[] = [];
  for (const item of input) {
    if (typeof item !== 'object' || item === null) continue;
    const raw = item as Record<string, unknown>;
    const content = typeof raw.content === 'string' ? raw.content.trim().slice(0, MAX_CHARS) : '';
    if (content === '') continue;
    out.push({ role: raw.role === 'assistant' ? 'assistant' : 'user', content });
  }
  return out.length > 0 ? out : null;
}

/**
 * La risposta sul prezzo.
 *
 * Qui c'erano quattro cifre scritte a mano, con un commento che ammetteva la
 * duplicazione: «se cambiano lì, cambiarle anche qui». Due difetti in una riga.
 *
 * Il primo è che nessuno le avrebbe cambiate: un prezzo aggiornato nel pannello
 * lasciava il chatbot a recitare quello vecchio, e il visitatore avrebbe letto
 * due numeri diversi sulla stessa pagina.
 *
 * Il secondo è più serio, ed è il motivo per cui questa funzione esiste: con i
 * prezzi spenti (vedi la 016) il configuratore tace e il chatbot continuava a
 * elencare il listino. L'interruttore che serve a non pubblicare i prezzi non
 * vale niente se c'è una seconda bocca in fondo alla pagina.
 *
 * Adesso le cifre vengono dal listino, e con i prezzi spenti non ci sono cifre.
 * Se il listino non si legge — database giù — si risponde comunque, senza numeri:
 * inventarne è l'unica cosa peggiore del non averli.
 */
async function rispostaPrezzo(): Promise<string> {
  const invito =
    'Dipende da cosa serve davvero: senza aver visto il progetto un numero sarebbe inventato. ' +
    'Configura qui sopra cosa ti serve e mandami la richiesta — ti rispondo entro 24 ore con un ' +
    'preventivo scritto e fisso, gratuito. Oppure scrivimi a info@dextlab.it.';
  try {
    const settings = await getSettings();
    if (!settingOn(settings, 'prezzi_pubblici')) return invito;
    const tipi = await rowsActive<PricingRow>('pricing_types');
    if (tipi.length === 0) return invito;
    const listino = tipi.map((t) => `${t.label} da ~${groupThousands(t.price)}€`).join(', ');
    return `Dipende dal progetto: ${listino}. Prova il configuratore qui sopra per una stima, oppure scrivimi a info@dextlab.it!`;
  } catch (err) {
    console.error('[chat] listino non letto:', (err as Error).message);
    return invito;
  }
}

/** Risposte per parola chiave sull'ultimo messaggio dell'utente. */
async function ruleBasedReply(messages: ChatMessage[]): Promise<string> {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const q = (lastUser?.content ?? '').toLowerCase();

  // I tempi vanno controllati prima dei prezzi: "quanto tempo serve" contiene
  // "quanto", quindi con l'ordine opposto riceverebbe il listino al posto della
  // risposta sui tempi.
  if (q.includes('tempo') || q.includes('consegn')) {
    return 'Una landing è pronta in pochi giorni, un sito vetrina in un paio di settimane, i progetti su misura in qualche settimana in più. Ti do sempre una data prima di iniziare.';
  }
  if (q.includes('prezz') || q.includes('costo') || q.includes('quanto')) {
    return await rispostaPrezzo();
  }
  if (q.includes('contatt') || q.includes('email') || q.includes('parlare')) {
    return 'Scrivimi a info@dextlab.it o lascia i tuoi dati nel form contatti: ti rispondo entro 24 ore.';
  }
  return 'Ciao! Posso darti info su siti web, web app, e-commerce e consulenza informatica. Chiedimi di prezzi, tempi o servizi, oppure scrivi a info@dextlab.it.';
}

export const POST: APIRoute = async ({ request, locals }) => {
  const ip = locals.clientIp;
  // Due finestre: una contro le raffiche, una sul volume giornaliero.
  const withinLimits =
    (await rateLimit('chat_min', 15, 60, ip)) && (await rateLimit('chat_day', 150, 86_400, ip));
  if (!withinLimits) {
    return reply(
      'Hai scritto molti messaggi in poco tempo. Riprova tra qualche minuto o scrivimi a info@dextlab.it.',
      429
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply('Messaggio non valido.', 422);
  }

  const messages = parseMessages((body as { messages?: unknown })?.messages);
  if (!messages) return reply('Messaggio non valido.', 422);

  return reply(await ruleBasedReply(messages));
};

export const ALL: APIRoute = () => reply('Metodo non consentito.', 405);
