// ================================================================================================
// AUFNAHME 20260922 · VORSCHAU-REICHWEITE — DER NACHWEIS ALS EINE PRÜFFUNKTION.
// ================================================================================================
//
// WARUM ALS FUNKTION (Ben, Runde 1, Befund B2): die Rücknahme „mit dem alten Verhalten schlägt der
// Nachweis fehl" ist nur dann belegt, wenn DERSELBE Nachweis gegen beide Verhalten läuft. Stünden
// die Erwartungen als `expect`-Kette im Test, bräche der erste Fehlschlag den Lauf ab, und der
// Rücknahmezweig müsste eine zweite, eigene Erwartung haben — dann prüfte er etwas anderes.
// Diese Funktion sammelt stattdessen die Verstöße: das aktuelle Verhalten muss `[]` liefern, das
// alte muss Verstöße liefern. Beide Läufe fragen dieselben Regeln.

/** Was die Seite nach der Antwort zeigt. */
export interface Lage {
  chipLage: string | null;
  chipText: string | null;
  vorschau: string | null;
  seite: string;
}

/** Was nach dem Aufklappen des Chips zu lesen ist (nur im Lauf „done"). */
export interface Aufgeklappt {
  /** Die Erklärung der leeren Vorschau (`live-vorschau-leer`), sonst `null`. */
  erklaerung: string | null;
  /** Der ganze Chip samt aufgeklappter Zone — hier stand früher „Das ist neu — …". */
  chip: string | null;
}

export interface Befund {
  lauf: "pending" | "done";
  antwort: { status: string; similar: { id: string }[]; coverage?: unknown };
  lage: Lage;
  aufgeklappt: Aufgeklappt | null;
  /** Der passende Bestandseintrag, der HINTER der Grenze liegt. */
  zielId: string;
  deckel: number;
}

export type Verstoss =
  | "UMFANG_FEHLT"
  | "ZIEL_IM_UMFANG"
  | "ANZEIGE_OHNE_UMFANG"
  | "NEUHEIT"
  | "ERKLAERUNG";

/** Dieselbe Übersetzer-Form wie `apps/web/src/lib/vorschauUmfang.ts`. */
export interface Uebersetzer {
  (key: string): string;
  (key: string, opts: Record<string, unknown>): string;
}

/** Was eine bestandweite Neuheitsbehauptung wäre — aus dem Katalog, nicht abgeschrieben. */
export function neuheitsSaetze(t: Uebersetzer): string[] {
  return [t("erfassen.live.neu"), t("intake.live.new"), "dazu gibt es noch nichts"];
}

/**
 * Die Verstöße eines Befunds „passender Eintrag hinter der Grenze". Leere Liste = Nachweis erbracht.
 */
export function verstoesse(b: Befund, t: Uebersetzer): Verstoss[] {
  const aus = new Set<Verstoss>();
  const c = b.antwort.coverage as
    | { kind?: unknown; checked?: unknown; limit?: unknown; limitReached?: unknown }
    | undefined;
  if (
    !c ||
    c.kind !== "candidates" ||
    c.checked !== b.deckel ||
    c.limit !== b.deckel ||
    c.limitReached !== true
  ) {
    aus.add("UMFANG_FEHLT");
  }
  if (b.antwort.similar.some((s) => s.id === b.zielId)) {
    aus.add("ZIEL_IM_UMFANG");
  }
  const umfang = t("vorschau.umfangGrenze", { count: b.deckel });
  if (b.lauf === "pending") {
    if (b.lage.vorschau !== t("vorschau.ohneTreffer", { umfang })) {
      aus.add("ANZEIGE_OHNE_UMFANG");
    }
  } else {
    const chip = b.lage.chipText ?? "";
    if (
      b.lage.chipLage !== "empty" ||
      !chip.includes(t("vorschau.name")) ||
      !chip.includes(umfang)
    ) {
      aus.add("ANZEIGE_OHNE_UMFANG");
    }
    const soll = t("vorschau.erklaerungGrenze", { count: b.deckel, limit: b.deckel });
    if (b.aufgeklappt?.erklaerung !== soll) {
      aus.add("ERKLAERUNG");
    }
  }
  const gelesen = [b.lage.seite, b.lage.chipText ?? "", b.aufgeklappt?.chip ?? ""];
  if (neuheitsSaetze(t).some((satz) => gelesen.some((text) => text.includes(satz)))) {
    aus.add("NEUHEIT");
  }
  return [...aus];
}
