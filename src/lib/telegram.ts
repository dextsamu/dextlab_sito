/**
 * Notifica Telegram per i nuovi lead. Best-effort: un errore qui non deve
 * cambiare la risposta al visitatore.
 */
import { setting, settingOn, type Settings } from './db.ts';

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
