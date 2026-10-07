// WP-E2 (ben-Auflage 2): senkenseitige Redaction unmittelbar vor console.warn. Die QUELLEN redigieren
// bereits (z. B. redactedError im Confluence-Client) — diese Senke ist die zweite, GENERISCHE
// Verteidigungslinie und kennt bewusst keine Modul-Interna: Sie entfernt strukturell Verdächtiges
// (Bearer-/Basic-Header-Werte, userinfo-URLs, lange base64-/token-artige Wörter) sowie die WERTE
// secret-benannter Env-Variablen. Pure Funktion (env injizierbar für Tests), idempotent auf bereits
// sauberem Text; lieber ein falsch-positiv redigiertes Pfadstück als ein geleaktes Secret.

// Env-Variablen, deren NAME nach Secret aussieht — deren Werte dürfen nie in einer Log-Zeile stehen.
// WP-E3 (ben): segment-genauer Treffer statt blankem Substring — KEY/TOKEN/… zählen nur als eigenes,
// durch "_" oder Namensanfang/-ende begrenztes Segment. So wird KLARWERK_LOCAL_LLM_KEY erfasst,
// KEYCHAIN-artige Namen (z. B. KLARWERK_SKIP_KEYCHAIN) aber NICHT als Secret behandelt.
const SECRET_ENV_NAME = /(?:^|_)(?:TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|KEY|CREDENTIALS?)(?:_|$)/i;

// Regel (1) von `sanitizeLogText`: Werte secret-benannter Env-Variablen hart ersetzen (exakter
// Substring-Treffer). WP-E4 (ben, Abschlussoption 1): BEWUSST OHNE Mindestlänge — ein schwaches
// (auch sehr kurzes) Secret bleibt ein Secret und darf nicht geloggt werden. Mögliche
// Über-Redaction (ein Kurz-Wert trifft zufällig einen harmlosen Substring) wird dafür in Kauf
// genommen; Flag-Werte wie "1"/"on" sind bereits durch den NAMENSfilter ausgeschlossen (DEV_PERSIST
// & Co. sind keine Secret-Namen). Einzeln exportiert, weil die Trace-Ausnahme der Logsenke
// (build-app.ts, Ben R3 B8) nur Regel (4) aussetzen darf — diese Regel gilt ausnahmslos.
export function entferneGeheimeEnvWerte(
  text: string,
  env: Record<string, string | undefined> = process.env,
): string {
  let out = text;
  for (const [name, value] of Object.entries(env)) {
    if (value && SECRET_ENV_NAME.test(name)) {
      out = out.split(value).join("[redacted]");
    }
  }
  return out;
}

// R-0664 (DS20): Bis hierher erkannte diese Senke NUR Geheimnisse — eine E-Mail-Adresse oder ein
// Name in einer Meldung lief unverändert durch. Die beiden Personenregeln (P1)/(P2) ergänzen das.
// Ihre Grenze ist bewusst benannt: Ein Name OHNE Kennzeichnung („an Anna Meier abgelehnt") ist
// als Muster nicht erkennbar. Davor schützt allein die Erlaubnisliste der Serializer (build-app.ts,
// R-0594); diese Regeln sind die zweite Linie für Freitext, der an ihnen vorbeiläuft.

// (P1) E-Mail-Adressen. Läuft VOR Regel (4): Ein langer lokaler Teil würde sonst zu `[redacted]`
// und die Domäne bliebe als Rest im Text stehen.
const EMAIL_ADRESSE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

// (P2) Ausdrücklich ausgewiesene Namen: `Name: Anna Meier`, `vorname=Anna`, `Autor: "A. Meier"`.
// Das Etikett braucht eine Wortgrenze davor (`Dateiname:`/`Hostname:` bleiben stehen); der Wert ist
// ein angeführter Text oder ein Wort plus höchstens zwei grossgeschriebene Folgewörter. Ein schon
// redigierter Wert wird nicht erneut getroffen — die Regel bleibt idempotent.
const NAMENS_ANGABE =
  /\b((?:[Vv]or|[Nn]ach|[Aa]nzeige|[Bb]enutzer|[Vv]oll|[Uu]ser|[Dd]isplay|[Ff]ull|[Ff]irst|[Ll]ast)?[_-]?(?:[Nn]ame|NAME)|[Aa]utor|[Aa]uthor|[Ee]mpf(?:ä|ae)nger|[Rr]ecipient)(\s*[:=]\s*)(?!\[redacted\])("[^"]*"|'[^']*'|[^\s,;)}\]"']+(?:\s+[A-ZÄÖÜ][a-zäöüß'-]+){0,2})/g;

/**
 * R-0664 (DS20): Feldnamen, deren WERT eine Person benennt. Die Logsenke (`senkeUeberWert`,
 * build-app.ts) entfernt solche Felder ganz, in jeder Tiefe — wie `redact.remove`: ein Platzhalter
 * an dieser Stelle wäre immer noch die Auskunft, dass dort ein Name stand. Verglichen wird ohne
 * Gross-/Kleinschreibung und ohne `_`/`-`, damit `display_name` und `displayName` gleich zählen.
 */
const PERSONEN_FELDER: ReadonlySet<string> = new Set([
  "name",
  "vorname",
  "nachname",
  "vollername",
  "anzeigename",
  "benutzername",
  "username",
  "displayname",
  "fullname",
  "firstname",
  "lastname",
  "email",
  "mail",
  "emailadresse",
  "mailadresse",
  "autor",
  "author",
  "empfaenger",
  "empfänger",
  "recipient",
  "absender",
]);

export function istPersonenFeld(schluessel: string): boolean {
  return PERSONEN_FELDER.has(schluessel.toLowerCase().replace(/[_-]/g, ""));
}

export function sanitizeLogText(
  text: string,
  env: Record<string, string | undefined> = process.env,
): string {
  // (1) Werte secret-benannter Env-Variablen hart ersetzen (s. entferneGeheimeEnvWerte).
  let out = entferneGeheimeEnvWerte(text, env);
  // (2) Authorization-Header-Werte generisch (Bearer <jwt/opaque>, Basic <base64>).
  out = out.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_=.-]{8,}/gi, "$1 [redacted]");
  // (3) Credential-tragende URLs: der userinfo-Teil (user:pass@host) fällt weg.
  out = out.replace(/(\w+:\/\/)[^/\s@]*@/g, "$1[redacted]@");
  // (P1) E-Mail-Adressen, (P2) ausgewiesene Namen — s. oben.
  out = out.replace(EMAIL_ADRESSE, "[redacted]");
  out = out.replace(NAMENS_ANGABE, "$1$2[redacted]");
  // (4) Lange base64-/token-artige Wörter (≥24 Zeichen aus dem Base64-/URL-safe-Alphabet).
  out = out.replace(/[A-Za-z0-9+/_-]{24,}={0,2}/g, "[redacted]");
  return out;
}
