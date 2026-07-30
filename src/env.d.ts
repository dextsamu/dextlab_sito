/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Impostazioni caricate una volta per richiesta dal middleware. */
    settings: Record<string, string>;
    /** Token della visita registrata, da passare al beacon. Null se non tracciata. */
    visitToken: string | null;
    /** True quando la modalità manutenzione è attiva nelle impostazioni. */
    maintenanceActive: boolean;
    /** True quando la richiesta ha superato il gate con il link di anteprima. */
    previewActive: boolean;
    /** IP del visitatore già risolto tenendo conto del reverse proxy. */
    clientIp: string;
  }
}
