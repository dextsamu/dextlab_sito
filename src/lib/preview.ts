/**
 * Token per il link di anteprima che bypassa la modalità manutenzione.
 * Derivato da APP_SECRET, così può comparire in un URL senza mettere a rischio
 * la firma dei cookie di sessione.
 */
import { appSecret } from './env.ts';
import { deriveToken } from './crypto.ts';

export function previewToken(): string {
  return deriveToken(appSecret(), 'maintenance-preview');
}
