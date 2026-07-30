/**
 * Middleware delle richieste pubbliche.
 *
 * Raccoglie in un unico punto tre cose che in PHP erano ripetute in testa a
 * index.php e maintenance.php: caricamento delle impostazioni, decisione sulla
 * modalità manutenzione e tracciamento della visita.
 *
 * Il gate non usa context.rewrite(): quello rieseguirebbe questo middleware
 * sulla rotta di destinazione, registrando due visite per ogni vista in
 * manutenzione. La home riceve la decisione nei locals e sceglie cosa mostrare.
 */
import { defineMiddleware } from 'astro:middleware';
import { getSettings, settingOn, trackVisit, clientIp } from './lib/db.ts';
import { appSecret } from './lib/env.ts';
import { safeEqual } from './lib/crypto.ts';

/** Percorsi che non sono pagine visitabili: nessuna impostazione, nessun tracciamento. */
function isVisitablePage(pathname: string): boolean {
  if (pathname.startsWith('/api/') || pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/_')) return false;
  // Qualsiasi cosa con estensione è un asset servito da public/.
  return !/\.[a-z0-9]+$/i.test(pathname);
}

/**
 * L'anteprima usa il segreto applicativo come chiave usa-e-getta nella query.
 * Resta valida solo per la richiesta corrente: il sito è una pagina unica con
 * ancore interne, quindi la navigazione normale non perde il parametro.
 */
function isPreviewRequest(url: URL): boolean {
  const preview = url.searchParams.get('preview');
  if (!preview) return false;
  try {
    return safeEqual(preview, appSecret());
  } catch {
    // APP_SECRET non configurata: nessuna anteprima possibile.
    return false;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request } = context;

  context.locals.settings = {};
  context.locals.visitToken = null;
  context.locals.maintenanceActive = false;
  context.locals.previewActive = false;
  context.locals.clientIp = '';

  // Le rotte prerenderizzate vengono generate in fase di build: non esiste una
  // richiesta reale, quindi né clientAddress né il database sono disponibili.
  if (context.isPrerendered) return next();

  context.locals.clientIp = clientIp(request, context.clientAddress);

  if (!isVisitablePage(url.pathname)) return next();

  const settings = await getSettings();
  context.locals.settings = settings;
  context.locals.maintenanceActive = settingOn(settings, 'maintenance');
  context.locals.previewActive =
    context.locals.maintenanceActive && isPreviewRequest(url);

  const showsMaintenance = context.locals.maintenanceActive && !context.locals.previewActive;

  // Il tracciamento è best-effort e non deve mai impedire la risposta.
  context.locals.visitToken = await trackVisit(
    url.pathname,
    showsMaintenance,
    context.locals.clientIp,
    request.headers.get('user-agent') ?? '',
    request.headers.get('referer') ?? ''
  );

  return next();
});
