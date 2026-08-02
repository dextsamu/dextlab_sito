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
import { campagnaDaUrl, campagnaDaReferrer, haCampagna } from './lib/campagne.ts';
import { previewToken } from './lib/preview.ts';
import { safeEqual } from './lib/crypto.ts';
import { isCrossSiteWrite, crossSiteResponse } from './lib/origin.ts';
import { avviaPromemoria } from './lib/promemoria.ts';

/*
  Il timer dei promemoria parte con il processo, non con la prima richiesta: questo
  modulo viene caricato all'avvio del server, ed è il solo punto del codice che
  gira una volta sola per processo. Dentro c'è una guardia, quindi un ricaricamento
  a caldo in sviluppo non fa partire un secondo timer.
*/
avviaPromemoria();

/** Percorsi che non sono pagine visitabili: nessuna impostazione, nessun tracciamento. */
function isVisitablePage(pathname: string): boolean {
  if (pathname.startsWith('/api/') || pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/_')) return false;
  // Qualsiasi cosa con estensione è un asset servito da public/.
  return !/\.[a-z0-9]+$/i.test(pathname);
}

/**
 * L'anteprima usa un token derivato da APP_SECRET, non il segreto stesso.
 * Resta valida solo per la richiesta corrente: il sito è una pagina unica con
 * ancore interne, quindi la navigazione normale non perde il parametro.
 */
function isPreviewRequest(url: URL): boolean {
  const preview = url.searchParams.get('preview');
  if (!preview) return false;
  try {
    return safeEqual(preview, previewToken());
  } catch {
    // APP_SECRET non configurata: nessuna anteprima possibile.
    return false;
  }
}

/**
 * L'HTML deve essere sempre rivalidato, e va detto esplicitamente.
 *
 * Senza nessuna intestazione di cache un browser è libero di applicare la
 * propria euristica e riusare una pagina già vista. Qui non è accettabile per un
 * motivo preciso: l'HTML è l'unico posto in cui sta la versione degli asset
 * (vedi src/lib/assets.ts). Se il browser rispolvera un HTML di ieri, quello
 * punta agli asset di ieri, e la liberazione delle cache avvelenate non arriva
 * mai a destinazione.
 *
 * no-cache non vuol dire "non conservare": vuol dire "chiedi prima di usare". La
 * pagina resta nella cache del browser e su una connessione lenta la
 * rivalidazione costa un 304, non un nuovo scaricamento.
 *
 * Si applica a ogni risposta HTML, comprese quelle dell'admin, e non sovrascrive
 * un'intestazione già impostata da una rotta.
 */
function rivalidaSempre(risposta: Response): Response {
  const tipo = risposta.headers.get('content-type') ?? '';
  if (tipo.includes('text/html') && !risposta.headers.has('cache-control')) {
    risposta.headers.set('Cache-Control', 'no-cache');
  }
  return risposta;
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

  // Prima di tutto il resto, e prima di qualsiasi rotta compresa /api: sostituisce
  // il controllo di origine di Astro, inservibile dietro un proxy che termina il
  // TLS. Vedi src/lib/origin.ts.
  if (isCrossSiteWrite(request)) return crossSiteResponse();

  context.locals.clientIp = clientIp(request, context.clientAddress);

  // Non è una pagina da tracciare (API, admin, asset), ma se è HTML l'intestazione
  // di rivalidazione serve comunque.
  if (!isVisitablePage(url.pathname)) return rivalidaSempre(await next());

  const settings = await getSettings();
  context.locals.settings = settings;
  context.locals.maintenanceActive = settingOn(settings, 'maintenance');
  context.locals.previewActive =
    context.locals.maintenanceActive && isPreviewRequest(url);

  const showsMaintenance = context.locals.maintenanceActive && !context.locals.previewActive;

  /*
    Da dove arriva questa visita. Prima i parametri dell'indirizzo — sono quelli
    che ha scritto una persona costruendo il link dell'annuncio, e battono
    qualsiasi deduzione. Se non ci sono, il referer dice almeno il sito di
    provenienza: ricerca, social o un altro sito. Se non c'è nemmeno quello la
    visita è diretta, e trackVisit prova a ereditare l'origine dalla pagina
    precedente della stessa visita.
  */
  const referer = request.headers.get('referer') ?? '';
  const daUrl = campagnaDaUrl(url);
  const campagna = haCampagna(daUrl) ? daUrl : campagnaDaReferrer(referer, url.hostname);

  // Il tracciamento è best-effort e non deve mai impedire la risposta.
  context.locals.visitToken = await trackVisit(
    url.pathname,
    showsMaintenance,
    context.locals.clientIp,
    request.headers.get('user-agent') ?? '',
    referer,
    campagna
  );

  return rivalidaSempre(await next());
});
