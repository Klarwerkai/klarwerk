import type { Pool } from "pg";

// ================================================================================================
// INSTANZTRENNUNG — EINE DATENBANK GEHÖRT GENAU EINER ANLAGE.
// ================================================================================================
//
// „Eine Firma je Instanz; jede Firma bekommt einen eigenen produktiven Datenraum." (R-0597)
// „Jeder Kunde bekommt sein eigenes System mit eigener Datenbank; die Datengrenze ist die Grenze
// der Anlage." (R-0790) „Zwei Anlagen desselben Anbieters teilen sich keine Zustände; die Trennung
// ist erzwungen, nicht nur vereinbart." (R-0860)
//
// WAS VORHER GALT. Das Mandantenmodell war EINE Instanz = EIN Mandant (`addon-principal.ts`,
// `KLARA_SINGLE_TENANT_ID`), und der Startvertrag sagte „EINE Instanz = EINE Datenbank". Das war
// eine Vereinbarung. Nichts hinderte eine zweite Anlage — andere `APP_BASE_URL`, also eine andere
// Firma —, mit derselben `DATABASE_URL` zu starten. Sie hätte den Bestand der ersten gelesen und
// beschrieben: Konten, Wissensobjekte, Prüfprotokoll. Genau die gemeinsame Mehrkunden-Datenbank,
// die ausdrücklich nicht vorgesehen ist (R-0564, R-0865).
//
// WAS JETZT GILT. Beim ersten Start gegen eine Datenbank schreibt die Anlage ihren Hostnamen (aus
// `APP_BASE_URL`) in die eine Zeile `instanz_bindung`. Jeder weitere Start vergleicht: derselbe
// Hostname → weiter; ein anderer → der Start bricht ab, BEVOR die Anwendung eine einzige Anfrage
// annimmt. Die Grenze steht damit in den Daten selbst und nicht in einer Betreiberanleitung.
//
// WARUM DER HOSTNAME UND NICHT DIE GANZE ADRESSE. Schema und Port sind keine Firmengrenze: der
// Wechsel von http auf https oder ein anderer Port derselben Anlage (Insel: `http://127.0.0.1:$PORT`)
// darf den Start nicht verweigern. Ein anderer Hostname ist eine andere Anlage.
//
// WAS DIESE PRÜFUNG NICHT IST. Keine Mandantenfähigkeit und kein Mandantenfeld: es gibt weiterhin
// genau einen Datenraum je Anlage und keine Filterung nach Kunde innerhalb der Anlage. Sie ersetzt
// auch nicht die Trennung der Server/VMs; geteilte Hardware mit getrennten VMs bleibt die zulässige
// Bauart (question:K17). Sie fängt den einen Fehler, den die Anwendung selbst sehen kann: zwei
// Anlagen an einem Datenbestand.
//
// OHNE `APP_BASE_URL` (Entwicklung, Restore-Drill) gibt es keine Anlagenadresse, gegen die gebunden
// werden könnte; dann wird weder gebunden noch verglichen — aber NUR außerhalb der Produktion. Im
// Produktionsstart ist eine erfolgreiche Bindungsprüfung Pflicht (`pflicht: true`): fehlt die
// Adresse, bricht der Start ab. Eine GESETZTE, aber unlesbare Adresse („kein-url", ohne Hostnamen)
// bricht immer ab — sie ist eine Fehlkonfiguration, kein „ohne Adresse". Der Startvertrag prüft nur,
// ob `APP_BASE_URL` gesetzt ist; ohne diese Regel liefe eine solche Anlage ungebunden gegen eine
// fremd gebundene Datenbank (BEN, Nacharbeit 2).
//
// VOR DEN MIGRATIONEN. `server.ts` ruft `bindeInstanzVorMigration` VOR `migrate()`: angelegt wird
// zuerst NUR die Bindungstabelle, dann wird gebunden bzw. verglichen. Eine fremde Anlage — womöglich
// mit anderem Softwarestand — führt damit keine einzige Produktmigration an der Datenbank einer
// anderen Kundenanlage aus.
//
// BEWUSSTER UMZUG. Zieht dieselbe Firma auf eine neue Adresse um, löscht der Betreiber die Zeile
// ausdrücklich (`DELETE FROM instanz_bindung;`), der nächste Start bindet neu. Ein Umgebungswert,
// der die Prüfung abschaltet, ist absichtlich NICHT vorgesehen — er wäre wieder nur eine
// Vereinbarung. Beschrieben in `docs/operations/kundeninstanz-neuinstallation.md`.

/**
 * Genau eine Zeile (`einzig` ist immer true). REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE IF NOT
 * EXISTS`, kein DROP, kein Fremdschlüssel, keine Extension, kein Seed — die Zeile schreibt erst der
 * Start (`bindeInstanz`).
 */
export const INSTANZBINDUNG_SCHEMA = `
CREATE TABLE IF NOT EXISTS instanz_bindung (
  einzig boolean PRIMARY KEY DEFAULT true CHECK (einzig),
  anlage text NOT NULL,
  gebunden_am timestamptz NOT NULL
);
`;

/** Die Anlagenkennung aus `APP_BASE_URL`: der Hostname, klein geschrieben. Unlesbar → undefined. */
export function anlageAusBasisadresse(appBaseUrl: string | undefined): string | undefined {
  const roh = appBaseUrl?.trim();
  if (!roh) {
    return undefined;
  }
  try {
    const host = new URL(roh).hostname.toLowerCase();
    return host ? host : undefined;
  } catch {
    return undefined;
  }
}

export type Instanzbefund =
  | { art: "ohne_adresse" }
  | { art: "gebunden"; anlage: string }
  | { art: "passt"; anlage: string }
  | { art: "fremd"; gebunden: string; aktuell: string };

/**
 * Die reine Entscheidung. `gespeichert` ist die Anlage aus der Datenbank NACH dem Bindungsversuch,
 * `neuGebunden` sagt, ob genau dieser Start die Zeile angelegt hat.
 */
export function beurteileInstanzbindung(
  gespeichert: string,
  aktuell: string,
  neuGebunden: boolean,
): Instanzbefund {
  if (gespeichert !== aktuell) {
    return { art: "fremd", gebunden: gespeichert, aktuell };
  }
  return neuGebunden ? { art: "gebunden", anlage: aktuell } : { art: "passt", anlage: aktuell };
}

export class InstanzbindungError extends Error {
  constructor(
    readonly gebunden: string,
    readonly aktuell: string,
  ) {
    super(
      `Diese Datenbank gehört der Anlage „${gebunden}“, gestartet wurde „${aktuell}“ (APP_BASE_URL). Eine Firma je Instanz: zwei Anlagen teilen sich keinen Datenbestand. Jede Anlage braucht ihre eigene DATABASE_URL. Zieht dieselbe Firma bewusst auf eine neue Adresse um, die Bindung ausdrücklich lösen (DELETE FROM instanz_bindung;) — siehe docs/operations/kundeninstanz-neuinstallation.md.`,
    );
    this.name = "InstanzbindungError";
  }
}

/** `APP_BASE_URL` fehlt im Produktionsstart oder ist gesetzt, aber keine Adresse mit Hostnamen. */
export class InstanzadresseError extends Error {
  constructor(readonly grund: "fehlt" | "unlesbar") {
    super(
      grund === "fehlt"
        ? "Instanzbindung nicht prüfbar: APP_BASE_URL fehlt. Im Produktionsstart muss die Datenbank an die Adresse dieser Anlage gebunden sein (Eine Firma je Instanz) — APP_BASE_URL auf die öffentliche Adresse dieser Instanz setzen."
        : "Instanzbindung nicht prüfbar: APP_BASE_URL ist gesetzt, aber keine lesbare Adresse mit Hostnamen (z. B. https://wissen.kunde.de). Ohne Anlagenadresse kann nicht geprüft werden, ob diese Datenbank einer anderen Anlage gehört — der Start bricht deshalb ab.",
    );
    this.name = "InstanzadresseError";
  }
}

export interface Bindungsoptionen {
  /** Produktionsstart: ohne Anlagenadresse kein Start (statt „ohne_adresse"). */
  pflicht?: boolean;
  jetzt?: () => Date;
}

/**
 * Die Anlagenkennung für den Start — oder ein Abbruch. Gesetzt und unlesbar wirft IMMER; fehlend
 * wirft nur bei `pflicht`. `undefined` heißt: außerhalb der Produktion ohne Adresse, nicht binden.
 */
function anlageFuerStart(appBaseUrl: string | undefined, pflicht: boolean): string | undefined {
  if (!appBaseUrl?.trim()) {
    if (pflicht) {
      throw new InstanzadresseError("fehlt");
    }
    return undefined;
  }
  const anlage = anlageAusBasisadresse(appBaseUrl);
  if (!anlage) {
    throw new InstanzadresseError("unlesbar");
  }
  return anlage;
}

/**
 * Bindet die Datenbank beim ersten Start an diese Anlage und verweigert jeden Start einer anderen.
 * Wirft `InstanzbindungError` bei fremder Anlage und `InstanzadresseError` bei fehlender (nur mit
 * `pflicht`) oder unlesbarer Adresse — beides, BEVOR eine Anweisung an die Datenbank geht.
 * Gleichzeitige Erststarts sind sicher: der Primärschlüssel lässt genau ein INSERT gewinnen,
 * danach liest jeder denselben Wert.
 */
export async function bindeInstanz(
  pool: Pick<Pool, "query">,
  appBaseUrl: string | undefined,
  optionen: Bindungsoptionen = {},
): Promise<Instanzbefund> {
  const aktuell = anlageFuerStart(appBaseUrl, optionen.pflicht ?? false);
  if (!aktuell) {
    return { art: "ohne_adresse" };
  }
  const jetzt = optionen.jetzt ?? (() => new Date());
  const eingefuegt = await pool.query(
    `INSERT INTO instanz_bindung (einzig, anlage, gebunden_am) VALUES (true, $1, $2)
     ON CONFLICT (einzig) DO NOTHING`,
    [aktuell, jetzt().toISOString()],
  );
  const res = await pool.query<{ anlage: string }>(
    "SELECT anlage FROM instanz_bindung WHERE einzig",
  );
  const gespeichert = res.rows[0]?.anlage;
  if (gespeichert === undefined) {
    // Die Zeile muss nach dem INSERT da sein. Fehlt sie, ist der Zustand nicht beurteilbar — und
    // ein nicht beurteilbarer Zustand darf nicht als „passt" durchgehen.
    throw new Error("Instanzbindung nicht lesbar: instanz_bindung ist nach dem Binden leer.");
  }
  const befund = beurteileInstanzbindung(gespeichert, aktuell, (eingefuegt.rowCount ?? 0) > 0);
  if (befund.art === "fremd") {
    throw new InstanzbindungError(befund.gebunden, befund.aktuell);
  }
  return befund;
}

/**
 * Der Startweg (`server.ts`, VOR `migrate()`): Adresse prüfen, dann NUR die Bindungstabelle anlegen,
 * dann binden bzw. vergleichen. Wirft, bevor irgendeine andere Schemastufe die Datenbank berührt.
 * `INSTANZBINDUNG_SCHEMA` steht zusätzlich in `schemas` (db.ts) — dort ist die Stufe danach ein
 * No-op, sie hält aber Migrationsbeleg und Restore-Drill vollständig.
 */
export async function bindeInstanzVorMigration(
  pool: Pick<Pool, "query">,
  appBaseUrl: string | undefined,
  optionen: Bindungsoptionen = {},
): Promise<Instanzbefund> {
  if (!anlageFuerStart(appBaseUrl, optionen.pflicht ?? false)) {
    return { art: "ohne_adresse" };
  }
  await pool.query(INSTANZBINDUNG_SCHEMA);
  return bindeInstanz(pool, appBaseUrl, optionen);
}
