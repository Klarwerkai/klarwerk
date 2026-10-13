import type { Pool } from "pg";

// ================================================================================================
// produkt:20261013:lagebild-reale-werte-eingabe — DIE REALEN EINGANGSWERTE DER WISSENSBEWERTUNG.
// ================================================================================================
//
// Peter (13.10.2026, Nr. 13): „verwende beispielwerte, wir brauchen dort eine eingabemoeglichkeit
// der echten werte durch die anwender / admin". Die Wissensbewertung der Kapital-Sicht
// (`apps/web/src/lib/knowledgeValuation.ts`) rechnet mit drei Annahmen — €/Std, gesparte Std. je
// validiertem Objekt, Wiederverwendung. Bisher standen dafür nur fest codierte Beispielwerte im
// Browser. Diese Datei ist die gepflegte Ablage der ECHTEN Werte, NICHT eine zweite Kennzahlen-
// oder Kapitalverwaltung: sie speichert nur die drei Eingänge der bestehenden Formel, je
// Arbeitsbereich, mit Zeitraum und Herkunft. Gerechnet wird weiter in der bestehenden Formel.
//
// BEREICH: `gesamt` (die ganze Instanz — eine Firma je Instanz, `instanzbindung.ts`) oder die
// Kennung eines Space. Die Rechte entscheidet die Route (`management-routes.ts`), nicht diese Datei.
//
// HERKUNFT je Wert: `eigene_eingabe` (Annahme der Person) oder `gemessen` — dann ist ein Beleg
// Pflicht (wo die Messung steht). Auch ein „gemessener" Wert ist hier nur die ANGABE einer Person;
// die Fläche sagt deshalb ausdrücklich, dass keine unabhängige Prüfung stattgefunden hat.
//
// SCHREIBEN OHNE STILLES ÜBERSCHREIBEN UND OHNE DOPPELANLAGE (LWE-06):
//   · `basisVersion` — der Stand, auf dem die Eingabe beruht. Weicht der gespeicherte Stand ab, wird
//     nichts geschrieben (409 mit dem aktuellen Stand). 0 heisst „es gab noch keinen Stand".
//   · `anfrageId` — eine Kennung je Speichervorgang. Eine Wiederholung derselben Anfrage (etwa nach
//     einem unbekannten Schreibausgang) liefert den gespeicherten Stand zurück, statt neu zu schreiben.

export const LAGEBILD_GESAMT = "gesamt";

export const LAGEBILD_FELDER = ["hourlyRate", "hoursSavedPerValidatedKo", "reuseFactor"] as const;
export type LagebildFeld = (typeof LAGEBILD_FELDER)[number];

export const LAGEBILD_HERKUENFTE = ["eigene_eingabe", "gemessen"] as const;
export type LagebildHerkunft = (typeof LAGEBILD_HERKUENFTE)[number];

/**
 * Die zulässigen Spannen. Gesparte Stunden dürfen NEGATIV sein: Zusatzaufwand ist eine negative
 * Entlastung und bleibt in der Rechnung (P13-AC07) — er wird nicht auf 0 gekappt.
 */
export const LAGEBILD_GRENZEN: Record<
  LagebildFeld,
  { min: number; max: number; nullErlaubt: boolean }
> = {
  hourlyRate: { min: 0, max: 1000, nullErlaubt: false },
  hoursSavedPerValidatedKo: { min: -100, max: 100, nullErlaubt: true },
  reuseFactor: { min: 0, max: 1000, nullErlaubt: true },
};

export const LAGEBILD_BELEG_MAX = 300;

export interface LagebildWert {
  wert: number;
  herkunft: LagebildHerkunft;
  /** Wo der Wert herkommt (Messung, Auswertung, Dokument) — Pflicht bei `gemessen`. */
  beleg: string | null;
}

export interface LagebildWerte {
  bereich: string;
  /** Für welchen Zeitraum die Werte gelten — Kalendertage `JJJJ-MM-TT`, beide eingeschlossen. */
  zeitraumVon: string;
  zeitraumBis: string;
  /** `null` = nicht erfasst. Dann rechnet die Fläche keinen Geldwert (nichts wird ergänzt). */
  werte: Record<LagebildFeld, LagebildWert | null>;
  version: number;
  anfrageId: string;
  geaendertAm: string;
  geaendertVon: string;
}

export interface LagebildFehlerEintrag {
  feld: string;
  meldung: string;
}

export class LagebildWerteFehler extends Error {
  readonly code = "INVALID_LAGEBILD_WERTE";

  constructor(readonly fehler: LagebildFehlerEintrag[]) {
    super(fehler.map((f) => f.meldung).join(" "));
    this.name = "LagebildWerteFehler";
  }
}

/** Der gespeicherte Stand weicht von `basisVersion` ab — nichts wurde geschrieben. */
export class LagebildKonflikt extends Error {
  readonly code = "LAGEBILD_KONFLIKT";

  constructor(readonly aktuell: LagebildWerte | null) {
    super(
      "Die Werte dieses Bereichs wurden inzwischen geändert. Ihre Eingabe wurde nicht gespeichert.",
    );
    this.name = "LagebildKonflikt";
  }
}

const FELD_NAME: Record<LagebildFeld, string> = {
  hourlyRate: "Stundensatz (€/Std.)",
  hoursSavedPerValidatedKo: "Gesparte Stunden je validiertem Objekt",
  reuseFactor: "Wiederverwendung (Faktor)",
};

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;
const ANFRAGE_RE = /^[\w-]{8,64}$/;

function datum(roh: unknown, feld: string, fehler: LagebildFehlerEintrag[]): string | null {
  if (typeof roh !== "string" || !DATUM_RE.test(roh)) {
    const teil = feld === "zeitraumVon" ? "Beginn" : "Ende";
    fehler.push({ feld, meldung: `${teil} des Zeitraums fehlt oder ist kein Datum (JJJJ-MM-TT).` });
    return null;
  }
  const ms = Date.parse(`${roh}T00:00:00.000Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== roh) {
    fehler.push({ feld, meldung: `${roh} ist kein gültiges Kalenderdatum.` });
    return null;
  }
  return roh;
}

function wertVon(
  feld: LagebildFeld,
  roh: unknown,
  fehler: LagebildFehlerEintrag[],
): LagebildWert | null {
  if (roh === null || roh === undefined) {
    return null;
  }
  const rec = roh as Record<string, unknown>;
  const name = FELD_NAME[feld];
  const grenze = LAGEBILD_GRENZEN[feld];
  if (typeof rec !== "object" || Array.isArray(rec)) {
    fehler.push({ feld, meldung: `${name}: ungültige Angabe.` });
    return null;
  }
  const zahl = rec.wert;
  let wert: number | null = null;
  if (typeof zahl !== "number" || !Number.isFinite(zahl)) {
    fehler.push({ feld, meldung: `${name}: bitte eine Zahl eingeben.` });
  } else if (zahl < grenze.min || zahl > grenze.max) {
    fehler.push({ feld, meldung: `${name}: erlaubt sind ${grenze.min} bis ${grenze.max}.` });
  } else if (zahl === 0 && !grenze.nullErlaubt) {
    fehler.push({
      feld,
      meldung: `${name}: 0 ist kein Stundensatz — Feld leer lassen, wenn er nicht bekannt ist.`,
    });
  } else {
    wert = zahl;
  }
  const herkunft = rec.herkunft;
  if (!(LAGEBILD_HERKUENFTE as readonly unknown[]).includes(herkunft)) {
    fehler.push({ feld, meldung: `${name}: Herkunft muss „eigene Eingabe“ oder „gemessen“ sein.` });
    return null;
  }
  const belegRoh = typeof rec.beleg === "string" ? rec.beleg.trim() : "";
  if (rec.beleg !== undefined && rec.beleg !== null && typeof rec.beleg !== "string") {
    fehler.push({ feld, meldung: `${name}: der Beleg muss ein Text sein.` });
  }
  if (belegRoh.length > LAGEBILD_BELEG_MAX) {
    fehler.push({
      feld,
      meldung: `${name}: der Beleg ist länger als ${LAGEBILD_BELEG_MAX} Zeichen.`,
    });
  }
  if (herkunft === "gemessen" && belegRoh === "") {
    fehler.push({
      feld,
      meldung: `${name}: für einen gemessenen Wert bitte den Beleg nennen (wo die Messung steht).`,
    });
  }
  if (wert === null) {
    return null;
  }
  return { wert, herkunft: herkunft as LagebildHerkunft, beleg: belegRoh === "" ? null : belegRoh };
}

export interface LagebildEingabe {
  zeitraumVon: string;
  zeitraumBis: string;
  werte: Record<LagebildFeld, LagebildWert | null>;
  basisVersion: number;
  anfrageId: string;
}

/**
 * Prüft eine Eingabe vollständig und meldet JEDEN Fehler mit Feld und verständlichem Satz (LWE-04),
 * statt beim ersten abzubrechen. Wirft `LagebildWerteFehler` (HTTP 400).
 */
export function normalizeLagebildEingabe(input: unknown, heute: string): LagebildEingabe {
  const rec = (input ?? {}) as Record<string, unknown>;
  const fehler: LagebildFehlerEintrag[] = [];
  const von = datum(rec.zeitraumVon, "zeitraumVon", fehler);
  const bis = datum(rec.zeitraumBis, "zeitraumBis", fehler);
  if (von !== null && bis !== null && von > bis) {
    fehler.push({
      feld: "zeitraumBis",
      meldung: "Das Ende des Zeitraums liegt vor seinem Beginn.",
    });
  }
  const werteRoh = (rec.werte ?? {}) as Record<string, unknown>;
  if (typeof werteRoh !== "object" || Array.isArray(werteRoh)) {
    fehler.push({ feld: "werte", meldung: "Die Werte fehlen." });
  }
  const werte = {} as Record<LagebildFeld, LagebildWert | null>;
  for (const feld of LAGEBILD_FELDER) {
    werte[feld] = wertVon(feld, werteRoh[feld], fehler);
  }
  // Ein gemessener Wert beschreibt Vergangenes — ein Messzeitraum in der Zukunft ist ein Bedienfehler.
  const gemessen = LAGEBILD_FELDER.some(
    (f) => (werteRoh[f] as { herkunft?: unknown } | null | undefined)?.herkunft === "gemessen",
  );
  if (gemessen && bis !== null && bis > heute) {
    fehler.push({
      feld: "zeitraumBis",
      meldung: "Ein gemessener Wert kann nicht für einen Zeitraum in der Zukunft gelten.",
    });
  }
  const basis = rec.basisVersion;
  if (typeof basis !== "number" || !Number.isInteger(basis) || basis < 0) {
    fehler.push({ feld: "basisVersion", meldung: "Der Stand, auf dem die Eingabe beruht, fehlt." });
  }
  const anfrageId = rec.anfrageId;
  if (typeof anfrageId !== "string" || !ANFRAGE_RE.test(anfrageId)) {
    fehler.push({ feld: "anfrageId", meldung: "Die Kennung des Speichervorgangs fehlt." });
  }
  if (fehler.length > 0) {
    throw new LagebildWerteFehler(fehler);
  }
  return {
    zeitraumVon: von as string,
    zeitraumBis: bis as string,
    werte,
    basisVersion: basis as number,
    anfrageId: anfrageId as string,
  };
}

/** Die Ablage. `setze` schreibt NUR, wenn der gespeicherte Stand `basisVersion` trägt. */
export interface LagebildWerteRepo {
  listLagebildWerte(): Promise<LagebildWerte[]>;
  /** `true` = geschrieben; `false` = der Stand war ein anderer (nichts geschrieben). */
  setLagebildWerte(eintrag: LagebildWerte, basisVersion: number): Promise<boolean>;
}

export function istGleicherStand(
  eintrag: LagebildWerte | undefined,
  basisVersion: number,
): boolean {
  return (eintrag?.version ?? 0) === basisVersion;
}

// REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE IF NOT EXISTS`, kein DROP, kein DELETE FROM.
export const LAGEBILD_WERTE_SCHEMA = `
CREATE TABLE IF NOT EXISTS management_lagebild_werte (
  bereich text PRIMARY KEY,
  zeitraum_von text NOT NULL,
  zeitraum_bis text NOT NULL,
  werte jsonb NOT NULL,
  version integer NOT NULL,
  anfrage_id text NOT NULL,
  geaendert_am text NOT NULL,
  geaendert_von text NOT NULL
);
`;

interface LagebildRow {
  bereich: string;
  zeitraum_von: string;
  zeitraum_bis: string;
  werte: Record<LagebildFeld, LagebildWert | null>;
  version: number;
  anfrage_id: string;
  geaendert_am: string;
  geaendert_von: string;
}

export function lagebildAusZeile(r: LagebildRow): LagebildWerte {
  const werte = {} as Record<LagebildFeld, LagebildWert | null>;
  for (const feld of LAGEBILD_FELDER) {
    werte[feld] = r.werte?.[feld] ?? null;
  }
  return {
    bereich: r.bereich,
    zeitraumVon: r.zeitraum_von,
    zeitraumBis: r.zeitraum_bis,
    werte,
    version: r.version,
    anfrageId: r.anfrage_id,
    geaendertAm: r.geaendert_am,
    geaendertVon: r.geaendert_von,
  };
}

export async function pgListLagebildWerte(pool: Pool): Promise<LagebildWerte[]> {
  const res = await pool.query<LagebildRow>(
    "SELECT * FROM management_lagebild_werte ORDER BY bereich",
  );
  return res.rows.map(lagebildAusZeile);
}

/**
 * Bedingtes Schreiben in EINER Anweisung — kein Lesen-dann-Schreiben, das zwei gleichzeitige
 * Speichervorgänge beide gewinnen liesse. Erstanlage: `ON CONFLICT DO NOTHING`; danach nur
 * `WHERE version = basisVersion`.
 */
export async function pgSetLagebildWerte(
  pool: Pool,
  e: LagebildWerte,
  basisVersion: number,
): Promise<boolean> {
  const werte = [
    e.bereich,
    e.zeitraumVon,
    e.zeitraumBis,
    JSON.stringify(e.werte),
    e.version,
    e.anfrageId,
    e.geaendertAm,
    e.geaendertVon,
  ];
  if (basisVersion === 0) {
    const res = await pool.query(
      "INSERT INTO management_lagebild_werte(bereich,zeitraum_von,zeitraum_bis,werte,version," +
        "anfrage_id,geaendert_am,geaendert_von) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8) " +
        "ON CONFLICT (bereich) DO NOTHING",
      werte,
    );
    return (res.rowCount ?? 0) === 1;
  }
  const res = await pool.query(
    "UPDATE management_lagebild_werte SET zeitraum_von=$2,zeitraum_bis=$3,werte=$4::jsonb," +
      "version=$5,anfrage_id=$6,geaendert_am=$7,geaendert_von=$8 WHERE bereich=$1 AND version=$9",
    [...werte, basisVersion],
  );
  return (res.rowCount ?? 0) === 1;
}
