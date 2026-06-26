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

// Gültiger Callback = entweder ein Fehler ODER vollständiges code+state-Paar.
export function isCompleteCallback(cb: OidcCallback): boolean {
  return cb.error !== null || (cb.code !== null && cb.state !== null);
}
