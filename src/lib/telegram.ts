/**
 * Notifiche Telegram per i nuovi lead e per gli appuntamenti presi.
 * Best-effort: un errore qui non deve cambiare la risposta al visitatore.
 */
import { setting, settingOn, type Settings } from './db.ts';
import { quandoPerEsteso } from './agenda.ts';

export interface TelegramConfig {
  enabled: boolean;
  token: string;
  chatId: string;
}

export function telegramConfig(s: Settings): TelegramConfig {
  return {
    enabled: settingOn(s, 'tg_enabled'),
    token: setting(s, 'tg_token'),
    chatId: setting(s, 'tg_chat'),
  };
}

export function isTelegramUsable(cfg: TelegramConfig): boolean {
  return cfg.enabled && cfg.token !== '' && cfg.chatId !== '';
}

/**
 * Avviso di un appuntamento preso. È la notifica che conta più delle altre: un
 * lead può aspettare mezza giornata, un appuntamento fra dodici ore no.
 */
export async function notifyAppointment(
  cfg: TelegramConfig,
  app: { name: string; email: string; phone: string; note: string; starts_at: Date; minutes: number },
  siteName = 'Dext Lab'
): Promise<boolean> {
  if (!isTelegramUsable(cfg)) return false;

  const text = [
    `📅 Call prenotata — ${siteName}`,
    '',
    `🕒 ${quandoPerEsteso(app.starts_at)} (${app.minutes} min)`,
    `👤 ${app.name}`,
    `✉️ ${app.email}`,
    app.phone ? `📞 ${app.phone}` : '',
    '',
    app.note ? app.note.slice(0, 600) : 'Nessuna nota.',
  ]
    .filter((r) => r !== '')
    .join('\n');

  return await invia(cfg, text);
}

export async function notifyLead(
  cfg: TelegramConfig,
  lead: { name: string; email: string; subject: string; message: string },
  siteName = 'Dext Lab'
): Promise<boolean> {
  if (!isTelegramUsable(cfg)) return false;

  const text = [
    `🔔 Nuovo lead — ${siteName}`,
    '',
    `👤 ${lead.name}`,
    `✉️ ${lead.email}`,
    `📋 ${lead.subject}`,
    '',
    lead.message.slice(0, 600),
  ].join('\n');

  return await invia(cfg, text);
}

/**
 * La chiamata all'API, sola. Le notifiche sono due e la parte che parla con
 * Telegram è la stessa: duplicarla vorrebbe dire scoprire un giorno che il
 * timeout è stato corretto in un posto e non nell'altro.
 */
async function invia(cfg: TelegramConfig, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        chat_id: cfg.chatId,
        text,
        disable_web_page_preview: 'true',
      }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) {
      console.warn(`[telegram] risposta ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[telegram] notifica non inviata:', (err as Error).message);
    return false;
  }
}
