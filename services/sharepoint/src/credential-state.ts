// ================================================================================================
// JOB 4086 — DER ZUSTAND DES SHAREPOINT-ZUGANGS, NIEMALS DAS GEHEIMNIS.
// ================================================================================================
//
// DIESELBE BAUFORM WIE `services/confluence/src/credential-state.ts`, und zwar bewusst gespiegelt
// und nicht wiederverwendet: Die Variablennamen und die Bedingung, unter der ein Client zustande
// kommt, sind Wissen DIESES Moduls. Läge die Liste in `services/app`, gäbe es zwei Wahrheiten
// darüber, was SharePoint braucht — und die zweite würde beim nächsten Umbau still falsch. Eine
// gemeinsame Funktion für beide Quellen wäre der andere Fehler: sie müsste die Variablennamen von
// aussen bekommen und könnte den HTTPS-Riegel der jeweiligen Quelle nicht mehr selbst kennen.
//
// WAS DIESE FUNKTION HERGIBT — UND WAS SIE STRUKTURELL NICHT KANN.
//
// Sie meldet je Variable NUR `present: boolean`. KEIN Wert. Und ausdrücklich KEINE MASKE MIT LÄNGE:
// eine Maske verrät die Länge, und die Länge ist eine Aussage über das Geheimnis. Der Rückgabetyp
// trägt gar kein Feld, in das ein Wert passte — man kann hier nicht versehentlich etwas
// durchreichen, weil es keinen Platz dafür gibt.
//
// KEIN AUFRUF AN MICROSOFT GRAPH. Diese Funktion liest ausschliesslich `env`. Kein Egress, keine
// Verbindungsprüfung auf Verdacht. Ob die Zugangsdaten GÜLTIG sind, weiss nur ein echter Aufruf —
// und deshalb behauptet hier auch nichts, sie wären es.
//
// WARUM DIE HTTPS-PRÜFUNG MITKOMMT (`insecure-base-url`): `sharepointClientFromEnv` gibt auch dann
// KEINEN Client zurück, wenn alle drei Variablen stehen, die Basisadresse aber nicht `https:` ist
// (graph-client.ts) — derselbe Riegel gegen Token-Egress über unverschlüsselte Wege wie bei
// Confluence. Ohne diese Auskunft wäre „alles gesetzt, geht trotzdem nicht" von einem Fehler
// ununterscheidbar.

/** Die Variablen, die ein SharePoint-/OneDrive-Zugang braucht. Reihenfolge = Anzeigereihenfolge. */
export const SHAREPOINT_CREDENTIAL_VARS = [
  "KLARWERK_SHAREPOINT_BASE_URL",
  "KLARWERK_SHAREPOINT_TOKEN",
  "KLARWERK_SHAREPOINT_DRIVE",
] as const;

export interface SharePointCredentialState {
  /** Je Variable: benannt, und ob sie steht. Niemals ihr Wert, niemals ihre Länge. */
  vars: { name: string; present: boolean }[];
  /** Käme mit diesen Variablen ein Client zustande? (Nicht: sind sie gültig — das weiss nur ein Aufruf.) */
  usable: boolean;
  /** Warum nicht, falls nicht. `null`, wenn usable. */
  blocker: "missing" | "insecure-base-url" | null;
}

export function sharepointCredentialState(
  env: Record<string, string | undefined> = process.env,
): SharePointCredentialState {
  const vars = SHAREPOINT_CREDENTIAL_VARS.map((name) => ({
    name,
    // Eine gesetzte, aber leere Variable ist nicht gesetzt — sonst meldete die Fläche „steht",
    // und der Import scheiterte trotzdem (`sharepointClientFromEnv` prüft ebenfalls auf truthy).
    present: (env[name] ?? "") !== "",
  }));
  if (vars.some((v) => !v.present)) {
    return { vars, usable: false, blocker: "missing" };
  }
  // Dieselbe Bedingung wie `sharepointClientFromEnv` — bewusst hier wiederholt und nicht durch
  // einen Aufruf dort ersetzt: der Resolver BAUT einen Client (und bindet den Token in eine
  // Closure); diese Funktion darf nichts bauen, was ein Geheimnis trägt.
  if (!istHttpsAdresse(env.KLARWERK_SHAREPOINT_BASE_URL)) {
    return { vars, usable: false, blocker: "insecure-base-url" };
  }
  return { vars, usable: true, blocker: null };
}

/**
 * Der HTTPS-Riegel als EINE Funktion — sie wird hier UND im Resolver gebraucht (graph-client.ts),
 * und zwei Abschriften derselben Bedingung wären genau die Stelle, an der beide auseinanderlaufen.
 */
export function istHttpsAdresse(adresse: string | undefined): boolean {
  try {
    return new URL(adresse ?? "").protocol === "https:";
  } catch {
    return false;
  }
}
