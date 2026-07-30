/**
 * Endpoint del chatbot. La chiave dell'LLM resta lato server e non transita
 * mai verso il browser.
 *
 * Il rate limit protegge dal costo: senza di esso un singolo visitatore
 * potrebbe generare richieste a pagamento senza limite.
 */
import type { APIRoute } from 'astro';
import { rateLimit, getSettings, setting, settingOn, type Settings } from '../../lib/db.ts';

const MAX_MESSAGES = 20;
const MAX_CHARS = 1000;
const MAX_TOKENS = 400;
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = [
  "Sei l'assistente virtuale di Dext Lab, realtà che crea siti web, web app,",
  'soluzioni di Intelligenza Artificiale e offre consulenza informatica.',
  'Rispondi in italiano, in modo cordiale, conciso e professionale (max 4 frasi).',
  'Servizi: siti web e landing page, e-commerce, web app su misura, chatbot e',
  'automazioni AI, consulenza IT.',
  'Prezzi indicativi: landing da ~490€, sito vetrina da ~990€, e-commerce da',
  '~2500€, web app da ~4500€, soluzioni AI da ~1800€.',
  'Tempi rapidi grazie all\'uso di strumenti moderni e AI. Primo preventivo',
  'gratuito e senza impegno.',
  'Invita a usare il configuratore di preventivo o a scrivere a info@dextlab.it',
  '/ lasciare un contatto nel form.',
  'Non inventare dettagli tecnici specifici non richiesti; se non sai, proponi',
  'di contattare Dext Lab.',
].join(' ');

const UNAVAILABLE = 'Al momento non riesco a rispondere. Scrivimi a info@dextlab.it e ti ricontatto!';

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

/** Risposte di riserva quando l'AI non è configurata: il bot resta utile. */
function ruleBasedReply(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const q = (lastUser?.content ?? '').toLowerCase();

  if (q.includes('prezz') || q.includes('costo') || q.includes('quanto')) {
    return 'Dipende dal progetto: landing da ~490€, sito vetrina da ~990€, e-commerce da ~2500€, web app da ~4500€, soluzioni AI da ~1800€. Prova il configuratore qui sopra per una stima, oppure scrivimi a info@dextlab.it!';
  }
  if (q.includes('tempo') || q.includes('consegna')) {
    return "Grazie agli strumenti moderni e all'AI consegno in fretta: una landing in pochi giorni, progetti più complessi in qualche settimana.";
  }
  if (q.includes('ai') || q.includes('chatbot') || q.includes('intelligen')) {
    return 'Realizzo chatbot, automazioni e integrazioni AI sui tuoi dati aziendali. Proprio come questo assistente! Vuoi raccontarmi cosa ti serve?';
  }
  if (q.includes('contatt') || q.includes('email') || q.includes('parlare')) {
    return 'Scrivimi a info@dextlab.it o lascia i tuoi dati nel form contatti: ti rispondo entro 24 ore.';
  }
  return 'Ciao! Posso darti info su siti web, web app, soluzioni AI e consulenza. Chiedimi di prezzi, tempi o servizi, oppure scrivi a info@dextlab.it.';
}

async function askAnthropic(
  messages: ChatMessage[],
  apiKey: string,
  model: string
): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    console.warn(`[chat] Anthropic ha risposto ${res.status}`);
    return null;
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((b) => b.type === 'text')?.text;
  return text?.trim() || null;
}

async function askOpenai(
  messages: ChatMessage[],
  apiKey: string,
  model: string
): Promise<string | null> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      // I modelli recenti hanno sostituito max_tokens con max_completion_tokens.
      max_completion_tokens: MAX_TOKENS,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    console.warn(`[chat] OpenAI ha risposto ${res.status}`);
    return null;
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || null;
}

function aiConfig(s: Settings) {
  return {
    enabled: settingOn(s, 'ai_enabled'),
    provider: setting(s, 'ai_provider', 'anthropic'),
    apiKey: setting(s, 'ai_api_key'),
    model: setting(s, 'ai_model', 'claude-haiku-4-5-20251001'),
  };
}

export const POST: APIRoute = async ({ request, locals }) => {
  const ip = locals.clientIp;
  // Due finestre: una contro le raffiche, una sul costo giornaliero.
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

  const cfg = aiConfig(await getSettings());
  if (!cfg.enabled || cfg.apiKey === '') {
    return reply(ruleBasedReply(messages));
  }

  try {
    const answer =
      cfg.provider === 'openai'
        ? await askOpenai(messages, cfg.apiKey, cfg.model)
        : await askAnthropic(messages, cfg.apiKey, cfg.model);
    return reply(answer ?? UNAVAILABLE);
  } catch (err) {
    console.warn('[chat] chiamata al provider fallita:', (err as Error).message);
    return reply(UNAVAILABLE);
  }
};

export const ALL: APIRoute = () => reply('Metodo non consentito.', 405);
