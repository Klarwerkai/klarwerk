// ================================================================================================
// AUFTRAG-mega67 BLOCK C (Pedi 30.07.) — DER ZUSTAND, NIEMALS DAS GEHEIMNIS.
// ================================================================================================
//
// DER BEFUND. Heute sieht man einer Kachel nicht an, WARUM sie nicht geht. „Nicht konfiguriert"
// sagt es für genau eine Kachel; für Confluence stand es NIRGENDS. Wer den Import einschaltete und
// eine Variable vergaß, bekam den Befund erst als 503 aus einem echten Admin-POST — also erst,
// nachdem er es versucht hatte, und nur, wenn er `users.manage` trug.
//
// PEDIS ENTSCHEIDUNG VOM 30.07. (C2): die Zugangsdaten bleiben in der UMGEBUNGSVARIABLEN — mit
// eigenem Namensraum, Origin-Pinning und der Redaction, die keinen Tokenrest in eine Fehlermeldung
// lässt. Damit gibt es in der Oberfläche NICHTS entgegenzunehmen und nichts zu verwalten; es bleibt
// genau diese eine Frage: steht es, oder steht es nicht.
//
// ================================================================================================
// WAS DIESE FUNKTION HERGIBT — UND WAS SIE STRUKTURELL NICHT KANN.
// ================================================================================================
//
// Sie meldet je Variable NUR `present: boolean`. KEIN Wert. Und ausdrücklich KEINE MASKE MIT LÄNGE:
// eine Maske verrät die Länge, und die Länge ist eine Aussage über das Geheimnis. Der Rückgabetyp
// trägt deshalb gar kein Feld, in das ein Wert passen würde — man kann hier nicht versehentlich
// etwas durchreichen, weil es keinen Platz dafür gibt.
//
// KEIN AUFRUF AN CONFLUENCE. Diese Funktion liest ausschließlich `env`. Kein neuer Egress, keine
// Verbindungsprüfung auf Verdacht. Ob die Zugangsdaten wirklich GÜLTIG sind, kann man ohne Aufruf
// nicht wissen — und deshalb behauptet hier auch nichts, dass sie es wären.
//
// WARUM DIE HTTPS-PRÜFUNG MITKOMMT (`insecure-base-url`): `confluenceClientFromEnv` gibt auch dann
// KEINEN Client zurück, wenn alle vier Variablen stehen, die Basis-URL aber nicht `https:` ist
// (rest-client.ts:245-253) — ein bewusster Riegel gegen Token-Egress über unverschlüsselte Wege.
// Ohne diese Auskunft wäre der Zustand „alle vier gesetzt, geht trotzdem nicht" ununterscheidbar von
// einem Fehler, und die Fläche hätte genau die Frage nicht beantwortet, für die sie gebaut wurde.
//
// WARUM HIER UND NICHT IN services/app: die Variablennamen und die Bedingung, unter der ein Client
// zustande kommt, sind Wissen DIESES Moduls. Läge die Liste in der App, gäbe es zwei Wahrheiten
// darüber, was Confluence braucht — und die zweite würde beim nächsten Umbau still falsch.

/** Die Variablen, die ein Confluence-Zugang braucht. Reihenfolge = Anzeigereihenfolge. */
export const CONFLUENCE_CREDENTIAL_VARS = [
  "KLARWERK_CONFLUENCE_BASE_URL",
  "KLARWERK_CONFLUENCE_USER",
  "KLARWERK_CONFLUENCE_TOKEN",
  "KLARWERK_CONFLUENCE_SPACE",
] as const;

// ================================================================================================
// R-0166 — CONFLUENCE IM EIGENEN HAUS (Data Center / Server).
// ================================================================================================
//
// Cloud meldet sich mit E-Mail + API-Token an (Basic). Ein selbst betriebenes Confluence kennt
// dafür das persönliche Zugriffstoken (Personal Access Token), das als `Bearer` geschickt wird und
// KEINE Kennung braucht. Welcher Weg gilt, sagt `KLARWERK_CONFLUENCE_AUTH`:
//   - nicht gesetzt oder `cloud` → wie bisher: BASE_URL, USER, TOKEN, SPACE; Basic-Anmeldung.
//   - `pat`                      → BASE_URL, TOKEN (= das persönliche Zugriffstoken), SPACE; Bearer.
// Jeder andere Wert ergibt KEINEN Client — still auf Cloud zurückzufallen hieße, ein Token mit
// der falschen Anmeldeart an den Server zu schicken. Das Token bleibt in derselben Variablen wie
// bisher: Namensraum, Origin-Pinning, HTTPS-Riegel und Redaction gelten für beide Wege gleich.
//
// EINE WAHRHEIT: `confluenceClientFromEnv` (rest-client.ts) liest den Weg über DIESE Funktion,
// nicht über eine eigene Kopie der Regel.
export const CONFLUENCE_AUTH_VAR = "KLARWERK_CONFLUENCE_AUTH";

export type ConfluenceAuthMode = "cloud" | "pat";

/** Der eingestellte Anmeldeweg, oder `null`, wenn der Wert keiner der bekannten ist. */
export function confluenceAuthMode(
  env: Record<string, string | undefined> = process.env,
): ConfluenceAuthMode | null {
  const roh = (env[CONFLUENCE_AUTH_VAR] ?? "").trim().toLowerCase();
  if (roh === "" || roh === "cloud") {
    return "cloud";
  }
  return roh === "pat" ? "pat" : null;
}

export interface ConfluenceCredentialState {
  /** Je Variable: benannt, und ob sie steht. Niemals ihr Wert, niemals ihre Länge. */
  vars: { name: string; present: boolean }[];
  /** Käme mit diesen Variablen ein Client zustande? (Nicht: sind sie gültig — das weiß nur ein Aufruf.) */
  usable: boolean;
  /** Warum nicht, falls nicht. `null`, wenn usable. */
  blocker: "missing" | "insecure-base-url" | null;
  /** R-0166: der eingestellte Anmeldeweg; `null` bei unbekanntem Wert in KLARWERK_CONFLUENCE_AUTH. */
  authMode: ConfluenceAuthMode | null;
}

export function confluenceCredentialState(
  env: Record<string, string | undefined> = process.env,
): ConfluenceCredentialState {
  const authMode = confluenceAuthMode(env);
  // R-0166: beim persönlichen Zugriffstoken gibt es keine Kennung — USER wird dann nicht verlangt
  // und nicht als „fehlt" gemeldet. Die Auswahlvariable selbst erscheint nur, wenn sie etwas
  // ändert: als „steht" beim Weg `pat`, als „steht nicht" bei einem unbekannten Wert (ein Wert,
  // den das Modul nicht versteht, wirkt wie keiner — wie die leere Variable unten). Beim Cloud-Weg
  // ohne Angabe bleibt die Liste genau die bisherigen vier.
  const benoetigt = CONFLUENCE_CREDENTIAL_VARS.filter(
    (name) => !(authMode === "pat" && name === "KLARWERK_CONFLUENCE_USER"),
  );
  const vars = benoetigt.map((name) => ({
    name: name as string,
    // Eine gesetzte, aber leere Variable ist nicht gesetzt — sonst meldete die Fläche „steht",
    // und der Import scheiterte trotzdem (confluenceClientFromEnv prüft ebenfalls auf truthy).
    present: (env[name] ?? "") !== "",
  }));
  if (authMode !== "cloud") {
    vars.push({ name: CONFLUENCE_AUTH_VAR, present: authMode === "pat" });
  }
  if (vars.some((v) => !v.present)) {
    return { vars, usable: false, blocker: "missing", authMode };
  }
  // Dieselbe Bedingung wie confluenceClientFromEnv — bewusst hier wiederholt und nicht durch einen
  // Aufruf dort ersetzt: der Resolver BAUT einen Client (und bindet den Token in eine Closure);
  // diese Funktion darf nichts bauen, was ein Geheimnis trägt.
  try {
    if (new URL(env.KLARWERK_CONFLUENCE_BASE_URL ?? "").protocol !== "https:") {
      return { vars, usable: false, blocker: "insecure-base-url", authMode };
    }
  } catch {
    return { vars, usable: false, blocker: "insecure-base-url", authMode };
  }
  return { vars, usable: true, blocker: null, authMode };
}
