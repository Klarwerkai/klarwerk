// Reines, DOM-freies Parsen des OIDC-Callbacks (FR-AUTH-07, Auth-Code-Flow).
// Der Provider hängt code+state als Query-Parameter an /sso/callback an; bei Fehlern
// stattdessen error(+error_description). Kein id_token im Browser (kein Implicit).
export interface OidcCallback {
  code: string | null;
  state: string | null;
  error: string | null;
}

export function parseOidcCallback(search: string): OidcCallback {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const error = params.get("error");
  const description = params.get("error_description");
  return {
    code: params.get("code"),
    state: params.get("state"),
    error: error ? (description ? `${error}: ${description}` : error) : null,
  };
}

// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier stand `isCompleteCallback` („Fehler ODER code+state
// vorhanden"). Der SSO-Rückruf prüft code und state selbst und meldet „unvollständig"
// (`auth/SsoCallback.tsx`, `if (!cb.code || !cb.state)`; R-0991 Nr. 52) — dort zählt auch ein LEERER
// Wert als fehlend, hier tat er es nicht. Die abweichende Zweitfassung rief niemand; sie ist entfernt.
