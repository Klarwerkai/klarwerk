// SCRUM-367 / AG-10 / NFR-SEC-04: EXPLIZITE, testbare CSRF-/Cookie-Strategie der App.
//
// Befund (Ist-Zustand, unverändert): Authentifizierung läuft entweder über einen Bearer-Token
// (Header `Authorization: Bearer …`) ODER über das Session-Cookie `kw_session`
// (HttpOnly, Path=/, Max-Age, SameSite=Lax; Secure in Produktion erzwungen, sonst via COOKIE_SECURE=true).
//
// Diese Datei ÄNDERT das Verhalten NICHT (kein Middleware-/Auth-Umbau, kein erzwungener Token).
// Sie macht die vorhandene Schutzlage explizit und maschinell prüfbar, damit AG-10 nicht mehr nur
// implizit behauptet wird, sondern als Code-/Test-Evidence vorliegt — inklusive der ehrlichen
// Restrisiken. Reine, DOM-/server-freie Funktionen → ohne laufenden Server testbar.

export const SESSION_COOKIE = "kw_session";

// Zustandsändernde HTTP-Methoden (die für CSRF überhaupt relevant sind). GET/HEAD/OPTIONS sind im
// System nicht zustandsändernd (alle Mutationen laufen über POST/PUT/DELETE/PATCH).
export const UNSAFE_METHODS = ["POST", "PUT", "DELETE", "PATCH"] as const;
export type UnsafeMethod = (typeof UNSAFE_METHODS)[number];

// Dokumentierte Eigenschaften des Session-Cookies (Quelle der Wahrheit: services/auth/src/routes.ts).
// `secureWhenConfigured`: WP-VIP2-GATE (bens P1) — in Produktion (NODE_ENV=production) wird Secure
// ERZWUNGEN (COOKIE_SECURE kann es dort nicht mehr abschalten; explizites =false bricht den Start ab).
// Außerhalb von Produktion bleibt das Opt-in COOKIE_SECURE=true für HTTPS-Dev-Setups.
export const COOKIE_STRATEGY = {
  name: SESSION_COOKIE,
  httpOnly: true,
  path: "/",
  sameSite: "Lax",
  secureWhenConfigured: true,
} as const;

export function isUnsafeMethod(method: string): boolean {
  return (UNSAFE_METHODS as readonly string[]).includes(method.toUpperCase());
}

// Wie authentifiziert sich ein Request? Bearer-Token (nicht ambient → nicht cookie-CSRF-anfällig),
// Cookie-Session (ambient → durch SameSite begrenzt) oder gar nicht.
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
// - cookie + unsafe: durch `SameSite=Lax` begrenzt — Browser senden das Session-Cookie bei
//   cross-site POST/PUT/DELETE NICHT mit. Restrisiko: sehr alte Browser ohne SameSite-Unterstützung;
//   GET-basierte Mutationen (im System nicht vorhanden). Kein expliziter Anti-CSRF-Token (bewusst,
//   kein Auth-Umbau in der Beta).
// - none + unsafe: nicht authentifiziert → der serverseitige Guard lehnt ohnehin mit 401 ab.
export type CsrfMitigation =
  | "not-state-changing"
  | "bearer-token"
  | "samesite-lax"
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
      cookieCsrfExposed: true, // ambient Cookie — aber durch SameSite=Lax begrenzt
      mitigation: "samesite-lax",
      residualRiskKey: "csrf.residual.legacyBrowserNoSameSite",
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
