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

export interface ConfluenceCredentialState {
  /** Je Variable: benannt, und ob sie steht. Niemals ihr Wert, niemals ihre Länge. */
  vars: { name: string; present: boolean }[];
  /** Käme mit diesen Variablen ein Client zustande? (Nicht: sind sie gültig — das weiß nur ein Aufruf.) */
  usable: boolean;
  /** Warum nicht, falls nicht. `null`, wenn usable. */
  blocker: "missing" | "insecure-base-url" | null;
}

export function confluenceCredentialState(
  env: Record<string, string | undefined> = process.env,
): ConfluenceCredentialState {
  const vars = CONFLUENCE_CREDENTIAL_VARS.map((name) => ({
    name,
    // Eine gesetzte, aber leere Variable ist nicht gesetzt — sonst meldete die Fläche „steht",
    // und der Import scheiterte trotzdem (confluenceClientFromEnv prüft ebenfalls auf truthy).
    present: (env[name] ?? "") !== "",
  }));
  if (vars.some((v) => !v.present)) {
    return { vars, usable: false, blocker: "missing" };
  }
  // Dieselbe Bedingung wie confluenceClientFromEnv — bewusst hier wiederholt und nicht durch einen
  // Aufruf dort ersetzt: der Resolver BAUT einen Client (und bindet den Token in eine Closure);
  // diese Funktion darf nichts bauen, was ein Geheimnis trägt.
  try {
    if (new URL(env.KLARWERK_CONFLUENCE_BASE_URL ?? "").protocol !== "https:") {
      return { vars, usable: false, blocker: "insecure-base-url" };
    }
  } catch {
    return { vars, usable: false, blocker: "insecure-base-url" };
  }
  return { vars, usable: true, blocker: null };
}
