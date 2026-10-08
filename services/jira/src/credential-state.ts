// ================================================================================================
// R-0170 — DER ZUSTAND DES JIRA-ZUGANGS, NIEMALS DAS GEHEIMNIS.
// ================================================================================================
//
// DIESELBE BAUFORM WIE `services/confluence/src/credential-state.ts` und
// `services/sharepoint/src/credential-state.ts`, bewusst gespiegelt und nicht wiederverwendet: die
// Variablennamen und die Bedingung, unter der ein Client zustande kommt, sind Wissen DIESES Moduls.
//
// Sie meldet je Variable NUR `present: boolean` — keinen Wert und keine Maske mit Länge. Sie liest
// ausschliesslich `env`; kein Aufruf an Jira. Ob die Zugangsdaten GÜLTIG sind, weiss nur ein Abruf.
//
// ZWEI ANMELDEWEGE, wie bei Confluence (R-0166): Jira Cloud meldet sich mit E-Mail + API-Token an
// (Basic), ein selbst betriebenes Jira (Data Center/Server) mit einem persönlichen Zugriffstoken
// (Bearer, ohne Kennung). Welcher Weg gilt, sagt `KLARWERK_JIRA_AUTH`:
//   - nicht gesetzt oder `cloud` → BASE_URL, USER, TOKEN, PROJECT; Basic-Anmeldung.
//   - `pat`                      → BASE_URL, TOKEN (= das persönliche Zugriffstoken), PROJECT; Bearer.
// Jeder andere Wert ergibt KEINEN Client — still auf Cloud zurückzufallen hiesse, ein Token mit der
// falschen Anmeldeart an den Server zu schicken.
//
// DER PROJEKTSCHLÜSSEL WIRD GEPRÜFT, nicht nur auf Anwesenheit: er steht in der JQL-Abfrage
// (`project = "KEY"`). Ein Wert ausserhalb der Jira-Schlüsselform (Buchstabe, dann Buchstaben,
// Ziffern, Unterstrich) ergibt keinen Client — so kann über die Umgebung keine zweite Abfrage in die
// JQL geraten, und die Fläche erfährt warum (`invalid-project-key`).

/** Die Variablen, die ein Jira-Zugang braucht. Reihenfolge = Anzeigereihenfolge. */
export const JIRA_CREDENTIAL_VARS = [
  "KLARWERK_JIRA_BASE_URL",
  "KLARWERK_JIRA_USER",
  "KLARWERK_JIRA_TOKEN",
  "KLARWERK_JIRA_PROJECT",
] as const;

/** Die Auswahl des Anmeldewegs. Fehlt sie, gilt `cloud`. */
export const JIRA_AUTH_VAR = "KLARWERK_JIRA_AUTH";

export type JiraAuthMode = "cloud" | "pat";

/** Der eingestellte Anmeldeweg, oder `null`, wenn der Wert keiner der bekannten ist. */
export function jiraAuthMode(
  env: Record<string, string | undefined> = process.env,
): JiraAuthMode | null {
  const roh = (env[JIRA_AUTH_VAR] ?? "").trim().toLowerCase();
  if (roh === "" || roh === "cloud") {
    return "cloud";
  }
  return roh === "pat" ? "pat" : null;
}

/** Die Form eines Jira-Projektschlüssels (z. B. `WART`, `QS_2`). */
export function istProjektschluessel(wert: string | undefined): boolean {
  return typeof wert === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(wert.trim());
}

/** Der HTTPS-Riegel — hier UND im Resolver (rest-client.ts) gebraucht, deshalb EINE Funktion. */
export function istHttpsAdresse(adresse: string | undefined): boolean {
  try {
    return new URL(adresse ?? "").protocol === "https:";
  } catch {
    return false;
  }
}

export interface JiraCredentialState {
  /** Je Variable: benannt, und ob sie steht. Niemals ihr Wert, niemals ihre Länge. */
  vars: { name: string; present: boolean }[];
  /** Käme mit diesen Variablen ein Client zustande? (Nicht: sind sie gültig — das weiss nur ein Aufruf.) */
  usable: boolean;
  /** Warum nicht, falls nicht. `null`, wenn usable. */
  blocker: "missing" | "insecure-base-url" | "invalid-auth-mode" | "invalid-project-key" | null;
}

export function jiraCredentialState(
  env: Record<string, string | undefined> = process.env,
): JiraCredentialState {
  const authMode = jiraAuthMode(env);
  // Beim persönlichen Zugriffstoken gibt es keine Kennung — USER wird dann nicht verlangt.
  const benoetigt = JIRA_CREDENTIAL_VARS.filter(
    (name) => !(authMode === "pat" && name === "KLARWERK_JIRA_USER"),
  );
  const vars = benoetigt.map((name) => ({
    name: name as string,
    // Eine gesetzte, aber leere Variable ist nicht gesetzt (der Resolver prüft ebenfalls auf truthy).
    present: (env[name] ?? "") !== "",
  }));
  if (authMode === "pat") {
    vars.push({ name: JIRA_AUTH_VAR, present: true });
  }
  if (authMode === null) {
    return { vars, usable: false, blocker: "invalid-auth-mode" };
  }
  if (vars.some((v) => !v.present)) {
    return { vars, usable: false, blocker: "missing" };
  }
  // Dieselben Bedingungen wie `jiraClientFromEnv` — hier wiederholt und nicht durch einen Aufruf
  // dort ersetzt: der Resolver BAUT einen Client (und bindet den Token in eine Closure).
  if (!istHttpsAdresse(env.KLARWERK_JIRA_BASE_URL)) {
    return { vars, usable: false, blocker: "insecure-base-url" };
  }
  if (!istProjektschluessel(env.KLARWERK_JIRA_PROJECT)) {
    return { vars, usable: false, blocker: "invalid-project-key" };
  }
  return { vars, usable: true, blocker: null };
}
