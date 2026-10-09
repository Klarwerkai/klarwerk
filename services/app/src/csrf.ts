// SCRUM-367 / AG-10 / NFR-SEC-04: EXPLIZITE, testbare CSRF-/Cookie-Strategie der App.
//
// Befund: Authentifizierung läuft entweder über einen Bearer-Token
// (Header `Authorization: Bearer …`) ODER über das Session-Cookie `kw_session`
// (HttpOnly, Path=/, Max-Age, SameSite=Lax; Secure in Produktion erzwungen, sonst via COOKIE_SECURE=true).
//
// Aufnahme gesamt-csrf-schutz (R-0544, R-0797 · Befund 20 des Fremd-Reviews vom 28.08.): bis hierher
// bestand der Schutz allein aus `SameSite=Lax` und dem Umstand, dass die Schnittstelle nur JSON
// annimmt. `SameSite` trennt aber nach SITE, nicht nach Herkunft — eine fremde Seite unter einer
// Nachbar-Unteradresse derselben Site bekommt das Cookie mitgeschickt. Seitdem prüft
// `registerHerkunftspruefung` jeden zustandsändernden Aufruf mit Session-Cookie auf seine Herkunft
// (Fetch-Metadaten `Sec-Fetch-Site`, ersatzweise `Origin` gegen den eigenen Host) und lehnt fremde
// Herkunft mit 403 ab. Kein Anti-CSRF-Token: die Prüfung braucht keine Änderung am Web-Client.

import type { FastifyInstance } from "fastify";

export const SESSION_COOKIE = "kw_session";

// Zustandsändernde HTTP-Methoden (die für CSRF überhaupt relevant sind). GET/HEAD/OPTIONS sind im
// System nicht zustandsändernd (alle Mutationen laufen über POST/PUT/DELETE/PATCH).
export const UNSAFE_METHODS = ["POST", "PUT", "DELETE", "PATCH"] as const;
export type UnsafeMethod = (typeof UNSAFE_METHODS)[number];

// Die Eigenschaften des Session-Cookies setzt allein `services/auth/src/routes.ts` (HttpOnly, Path=/,
// SameSite=Lax; Secure in Produktion erzwungen, WP-VIP2-GATE). R-1349: Hier stand bis dahin eine
// Abschrift `COOKIE_STRATEGY`, die niemand las und deren Test nur die Abschrift prüfte. Sie ist
// entfernt; `csrf.test.ts` misst die Eigenschaften seitdem am echten `Set-Cookie` der Anmeldung.

export function isUnsafeMethod(method: string): boolean {
  return (UNSAFE_METHODS as readonly string[]).includes(method.toUpperCase());
}

// Wie authentifiziert sich ein Request? Bearer-Token (nicht ambient → nicht cookie-CSRF-anfällig),
// Cookie-Session (ambient → Herkunftsprüfung, s. `registerHerkunftspruefung`) oder gar nicht.
export type RequestAuthMode = "bearer" | "cookie" | "none";

function cookieHasSession(cookieHeader: string): boolean {
  for (const part of cookieHeader.split(";")) {
    const name = part.trim().split("=")[0];
    if (name === SESSION_COOKIE) {
      return true;
    }
  }
  return false;
}

export function requestAuthMode(headers: {
  authorization?: string | undefined;
  cookie?: string | undefined;
}): RequestAuthMode {
  if (headers.authorization && /^Bearer\s+\S/i.test(headers.authorization)) {
    return "bearer";
  }
  if (headers.cookie && cookieHasSession(headers.cookie)) {
    return "cookie";
  }
  return "none";
}

// Ehrliche CSRF-Einschätzung pro (Methode, Auth-Modus):
// - safe (GET/HEAD/…): nicht zustandsändernd → keine CSRF-Relevanz.
// - bearer + unsafe: NICHT cookie-CSRF-gefährdet — der Token ist KEIN ambient credential, ein
//   fremder Origin kann ihn nicht automatisch mitschicken. Restrisiko: Token-Leakage (XSS/Storage),
//   das ist KEIN CSRF.
// - cookie + unsafe: Herkunftsprüfung (`registerHerkunftspruefung`) — nur die eigene Herkunft wird
//   angenommen, auch keine Nachbar-Unteradresse derselben Site. `SameSite=Lax` bleibt die zweite
//   Ebene. Restrisiko: ein Browser, der weder `Sec-Fetch-Site` noch `Origin` sendet, ist von einem
//   Nicht-Browser-Client nicht zu unterscheiden und wird durchgelassen; für ihn bleibt nur
//   `SameSite=Lax`. GET-basierte Mutationen gibt es im System nicht.
// - none + unsafe: nicht authentifiziert → der serverseitige Guard lehnt ohnehin mit 401 ab.
export type CsrfMitigation =
  | "not-state-changing"
  | "bearer-token"
  | "origin-check"
  | "unauthenticated";

export interface CsrfAssessment {
  method: string;
  authMode: RequestAuthMode;
  stateChanging: boolean;
  // true nur, wenn der Request prinzipiell über ein ambient Cookie cross-site auslösbar wäre.
  cookieCsrfExposed: boolean;
  mitigation: CsrfMitigation;
  // Maschinenlesbarer i18n-/Doku-Schlüssel für das ehrlich benannte Restrisiko.
  residualRiskKey: string;
}

export function csrfAssessment(input: {
  method: string;
  authMode: RequestAuthMode;
}): CsrfAssessment {
  const stateChanging = isUnsafeMethod(input.method);
  if (!stateChanging) {
    return {
      method: input.method,
      authMode: input.authMode,
      stateChanging: false,
      cookieCsrfExposed: false,
      mitigation: "not-state-changing",
      residualRiskKey: "csrf.residual.none",
    };
  }
  if (input.authMode === "bearer") {
    return {
      method: input.method,
      authMode: input.authMode,
      stateChanging: true,
      cookieCsrfExposed: false,
      mitigation: "bearer-token",
      residualRiskKey: "csrf.residual.bearerTokenLeak",
    };
  }
  if (input.authMode === "cookie") {
    return {
      method: input.method,
      authMode: input.authMode,
      stateChanging: true,
      cookieCsrfExposed: true, // ambient Cookie — aber durch die Herkunftsprüfung abgewiesen
      mitigation: "origin-check",
      residualRiskKey: "csrf.residual.legacyBrowserNoOriginHeaders",
    };
  }
  return {
    method: input.method,
    authMode: input.authMode,
    stateChanging: true,
    cookieCsrfExposed: false,
    mitigation: "unauthenticated",
    residualRiskKey: "csrf.residual.none",
  };
}

// ================================================================================================
// R-0544 / R-0797 — DIE HERKUNFTSPRÜFUNG FÜR SCHREIBENDE SITZUNGSAUFRUFE
// ================================================================================================
//
// WEN SIE TRIFFT: jeden POST/PUT/DELETE/PATCH, der sich über das Session-Cookie ausweist
// (`requestAuthMode` = "cookie"). Bearer-Token und der Add-in-Schlüssel sind Header, die eine
// fremde Seite nicht ohne CORS-Freigabe setzen kann; ohne Anmeldung gibt es niemanden, in dessen
// Namen geschrieben würde. Lesende Aufrufe bleiben unberührt.
//
// WIE SIE ENTSCHEIDET (dieselbe Reihenfolge wie Gos `http.CrossOriginProtection`):
//  1. `Sec-Fetch-Site` vorhanden (jeder aktuelle Browser): nur `same-origin` und `none` (vom
//     Nutzer selbst ausgelöst, etwa Adresszeile) werden angenommen. `same-site` wird ABGELEHNT —
//     genau das ist der Fall aus R-0544, eine fremde Seite unter einer Nachbar-Unteradresse.
//  2. Sonst `Origin` vorhanden: der Host der Herkunft muss dem eigenen Host gleichen. `null` und
//     Unlesbares werden abgelehnt.
//  3. Keins von beiden: kein Browseraufruf mit Herkunftsangabe (Programmclient, Testaufruf, sehr
//     alter Browser) → angenommen. Für den alten Browser bleibt `SameSite=Lax` (Restrisiko oben).
//
// Der Vite-Entwicklungsproxy schreibt den Host um (`changeOrigin`); dort trägt Schritt 1, weil der
// Browser den Aufruf an den Proxy als `same-origin` meldet.

type HerkunftsUrteil =
  | { angenommen: true }
  | { angenommen: false; grund: "fremde-herkunft" | "herkunft-unlesbar" };

function einzelwert(wert: string | string[] | undefined): string | undefined {
  return typeof wert === "string" ? wert : undefined;
}

function herkunftsUrteil(input: {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  host: string;
}): HerkunftsUrteil {
  // R-1349: ob überhaupt geprüft wird, entscheidet die eine Einschätzung `csrfAssessment` — nur ein
  // schreibender Aufruf mit Session-Cookie (`origin-check`) braucht die Herkunftsprüfung.
  const einschaetzung = csrfAssessment({
    method: input.method,
    authMode: requestAuthMode({
      authorization: einzelwert(input.headers.authorization),
      cookie: einzelwert(input.headers.cookie),
    }),
  });
  if (einschaetzung.mitigation !== "origin-check") {
    return { angenommen: true };
  }
  const fetchSite = input.headers["sec-fetch-site"];
  if (fetchSite !== undefined) {
    if (typeof fetchSite !== "string") {
      return { angenommen: false, grund: "herkunft-unlesbar" };
    }
    const site = fetchSite.trim().toLowerCase();
    return site === "same-origin" || site === "none"
      ? { angenommen: true }
      : { angenommen: false, grund: "fremde-herkunft" };
  }
  const origin = input.headers.origin;
  if (origin === undefined) {
    return { angenommen: true };
  }
  if (typeof origin !== "string") {
    return { angenommen: false, grund: "herkunft-unlesbar" };
  }
  let herkunft: URL;
  try {
    herkunft = new URL(origin);
  } catch {
    return { angenommen: false, grund: "herkunft-unlesbar" };
  }
  // `URL.host` lässt den Standardport des Schemas weg; ein `Host: name:443` darf daran nicht
  // scheitern. `new URL("null")` wirft bereits; ein leerer Host (z. B. `file:`) zählt als fremd.
  const standardPort =
    herkunft.protocol === "https:" ? ":443" : herkunft.protocol === "http:" ? ":80" : "";
  const eigenerHost = input.host.toLowerCase();
  const eigenerHostOhneStandardport =
    standardPort !== "" && eigenerHost.endsWith(standardPort)
      ? eigenerHost.slice(0, -standardPort.length)
      : eigenerHost;
  return herkunft.host !== "" && herkunft.host === eigenerHostOhneStandardport
    ? { angenommen: true }
    : { angenommen: false, grund: "fremde-herkunft" };
}

// In `buildApp` direkt nach dem D5-Eingangshook registriert (der bleibt der erste) — vor Add-in-
// Anmeldung, Drossel und Körperlesen, damit ein fremder Aufruf nichts auslöst, auch keinen
// Fehlversuchszähler.
export function registerHerkunftspruefung(app: FastifyInstance): void {
  app.addHook("onRequest", async (request, reply) => {
    const urteil = herkunftsUrteil({
      method: request.method,
      headers: request.headers,
      host: request.host,
    });
    if (urteil.angenommen) {
      return;
    }
    request.log.warn(
      { event: "herkunftspruefung", grund: urteil.grund },
      "Schreibender Sitzungsaufruf fremder Herkunft abgelehnt",
    );
    reply.code(403).send({
      error: "FORBIDDEN",
      message: "Dieser Aufruf kam nicht aus der Klarwerk-Anwendung und wurde abgelehnt.",
    });
    return reply;
  });
}
