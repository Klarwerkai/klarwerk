import fastifyHelmet from "@fastify/helmet";
import type { FastifyInstance } from "fastify";

// WP-KLARA-1b (bens Sicherheits-Befunde K1/K2): Security-Header als EXPORTIERTE Produktionsfunktion —
// server.ts verdrahtet exakt diese Registrierung, und der Header-Matrix-Test (tests/app/
// word-addin-csp.test.ts) prüft DIESELBE Funktion per echtem HTTP-inject (kein Quelltext-String-Pin,
// keine Test-Kopie, keine Drift). Gleiches Muster wie registerNoindexHook (WP-E2).

// K1: die CSP-Ausnahme fürs Word-Taskpane ist EXAKT an die real ausgelieferte kanonische Menge
// gebunden — keine Präfixe, keine Regex. WP-D10b (bens Hinweis): NUR das Taskpane braucht die Ausnahme —
// die beiden Manifest-Icons (icon-32/80.png) sind statische Bilder, die der Office-Host per <img>/HTTP
// lädt; weder frame-ancestors noch die Skript-/CDN-Direktiven spielen dort eine Rolle → sie behalten die
// strikte globale CSP. Jede weitere Ausnahme muss hier BEWUSST eingetragen werden.
export const WORD_ADDIN_CSP_PATHS: readonly string[] = ["/word-addin/taskpane.html"];

// K2: frame-ancestors ENG und belegt. Microsofts Add-in-Doku („Domains used by Office web add-ins" /
// CSP-Guidance für Add-ins, learn.microsoft.com) nennt als Web-Hosts der Office-Runtime office.com und
// officeapps.live.com — Word Online lädt Taskpanes aus diesen Origins. BEWUSST NICHT dabei:
// *.live.com und *.microsoft.com (ganze Plattformfamilien — jede beliebige Seite dieser Konzerne dürfte
// die App framen; genau bens ROT-Befund). Word für Mac lädt das Taskpane als NATIVER WKWebView
// top-level — frame-ancestors greift dort gar nicht (der Sideload-Smoke-Test belegt das separat);
// Word Online wird erst behauptet, wenn es real belegt ist — fehlt ein Host, wird er nach Beleg
// GEZIELT ergänzt, nicht vorsorglich breit freigegeben.
// Cookie-Hinweis (bens explizite Warnung): das Session-Cookie bleibt SameSite=Lax — NICHT auf None
// ändern, um Word-Online-iframe-Sessions zu „reparieren"; das wäre eine eigene, bewusste
// CSRF-Risiko-Entscheidung und ist NICHT Teil dieser Ausnahme.
export const WORD_ADDIN_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://appsforoffice.microsoft.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self' https://*.office.com https://*.officeapps.live.com",
].join("; ");

// K1: fällt dieser Request-Pfad in die Word-Add-in-CSP-Ausnahme? NUR Query/Fragment strippen, dann
// EXAKTER String-Vergleich gegen die kanonische Menge. Bewusst KEINE weitere Normalisierung/Dekodierung:
// alles, was nicht byte-genau einem der kanonischen Strings entspricht — /word-addin/../x,
// /word-addinX/…, //word-addin/…, %2e-Encoding-Varianten, Groß-/Kleinschreibung, Trailing-Slash —
// matcht schlicht NICHT und behält fail-closed die strikte globale CSP (frame-ancestors 'none').
export function isWordAddinCspPath(rawUrl: string | undefined): boolean {
  const path = (rawUrl ?? "").split("?")[0]?.split("#")[0] ?? "";
  return WORD_ADDIN_CSP_PATHS.includes(path);
}

// Globale Security-Header (helmet) + die exakt gebundene Word-Add-in-CSP-Ausnahme. Alle Routen außer
// dem kanonischen Taskpane-Pfad behalten die strikte globale CSP inkl. frame-ancestors 'none'
// und X-Frame-Options.
export async function registerSecurityHeaders(app: FastifyInstance): Promise<void> {
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  });

  // WP-KLARA-1: das Word-Taskpane MUSS im Office-Webview einbettbar sein (Word Online lädt es im
  // iframe → frame-ancestors 'none' würde es blockieren) und lädt office.js von der offiziellen
  // Microsoft-CDN + eigenes Inline-JS/CSS (bewusst selbstenthaltende statische Seite ohne Build).
  // connect-src bleibt 'self' (API-Aufrufe sind same-origin — kein CORS-Umbau).
  // WP-E-Regel: app-globale onSend-Hooks IMMER synchron im Callback-Stil (kein async — s.
  // sync-onsend-hooks.test.ts; ein async-Hook öffnete das Doppel-Send-Fenster ERR_HTTP_HEADERS_SENT).
  app.addHook("onSend", (request, reply, payload, done) => {
    if (isWordAddinCspPath(request.url)) {
      reply.header("Content-Security-Policy", WORD_ADDIN_CSP);
      // X-Frame-Options kennt keine Domain-Liste — für diese exakten Pfade entfernen; die
      // CSP-frame-ancestors oben ist die präzisere, von modernen Engines bevorzugte Grenze.
      // WICHTIG (Befund der Header-Matrix, WP-KLARA-1b): helmet schreibt seine Header auf die
      // RAW-Response (res.setHeader) — reply.removeHeader() räumt nur Fastifys Header-Store und ließ
      // X-Frame-Options: SAMEORIGIN real im Draht. Beide Ebenen räumen, sonst blockt der Header die
      // Office-Einbettung trotz korrekter CSP.
      reply.removeHeader("X-Frame-Options");
      reply.raw.removeHeader("X-Frame-Options");
    }
    done(null, payload);
  });
}
