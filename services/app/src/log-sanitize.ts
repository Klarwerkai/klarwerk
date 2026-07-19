// WP-E2 (ben-Auflage 2): senkenseitige Redaction unmittelbar vor console.warn. Die QUELLEN redigieren
// bereits (z. B. redactedError im Confluence-Client) — diese Senke ist die zweite, GENERISCHE
// Verteidigungslinie und kennt bewusst keine Modul-Interna: Sie entfernt strukturell Verdächtiges
// (Bearer-/Basic-Header-Werte, userinfo-URLs, lange base64-/token-artige Wörter) sowie die WERTE
// secret-benannter Env-Variablen. Pure Funktion (env injizierbar für Tests), idempotent auf bereits
// sauberem Text; lieber ein falsch-positiv redigiertes Pfadstück als ein geleaktes Secret.

// Env-Variablen, deren NAME nach Secret aussieht — deren Werte dürfen nie in einer Log-Zeile stehen.
const SECRET_ENV_NAME = /TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY/i;

// Kürzere Werte (z. B. Flags wie "1") nie ersetzen — sonst zerlöchert die Redaction jede Meldung.
const MIN_SECRET_LENGTH = 8;

export function sanitizeLogText(
  text: string,
  env: Record<string, string | undefined> = process.env,
): string {
  let out = text;
  // (1) Werte secret-benannter Env-Variablen hart ersetzen (exakter Substring-Treffer).
  for (const [name, value] of Object.entries(env)) {
    if (value && value.length >= MIN_SECRET_LENGTH && SECRET_ENV_NAME.test(name)) {
      out = out.split(value).join("[redacted]");
    }
  }
  // (2) Authorization-Header-Werte generisch (Bearer <jwt/opaque>, Basic <base64>).
  out = out.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_=.-]{8,}/gi, "$1 [redacted]");
  // (3) Credential-tragende URLs: der userinfo-Teil (user:pass@host) fällt weg.
  out = out.replace(/(\w+:\/\/)[^/\s@]*@/g, "$1[redacted]@");
  // (4) Lange base64-/token-artige Wörter (≥24 Zeichen aus dem Base64-/URL-safe-Alphabet).
  out = out.replace(/[A-Za-z0-9+/_-]{24,}={0,2}/g, "[redacted]");
  return out;
}
