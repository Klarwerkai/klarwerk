import type { ModelRunKosten, ModelRunRecord, ModelRunVerbrauch } from "./types";

// ================================================================================================
// Aufnahme gesamt-ki-laufprotokoll (V9, Ben R1 B3) — DIE PREISLISTE, AUS DER KOSTEN ENTSTEHEN.
// ================================================================================================
//
// WER DIE PREISE FESTLEGT: der Betreiber, über die Umgebungsvariable `KLARWERK_KI_PREISLISTE`
// (JSON, Form s. u.). Der Code liefert BEWUSST keine Preise mit — ein eingebauter
// Preis wäre eine Preisentscheidung, und die ist dem Auftrag ausdrücklich entzogen (MR-SELECT-1:
// „keine Preisentscheidung"). Ohne Preisliste trägt kein Lauf Kosten, und die Auswertung sagt das.
//
// FORM: Preise je EINE MILLION Token, getrennt nach Eingabe und Ausgabe, je Modellbezeichner (genau
// der Wert, der im Lauf als `model` steht, z. B. `claude-sonnet-4-6`). Eine Währung und ein
// Preisstand gelten für die ganze Liste; der Preisstand wird in jeden berechneten Lauf geschrieben:
//   {"waehrung":"EUR","preisstand":"2026-10-01",
//    "modelle":{"<modell>":{"eingabeJeMillion":<zahl>,"ausgabeJeMillion":<zahl>}}}
//
// FAIL-SAFE: eine unlesbare oder unvollständige Liste darf den Start nicht kosten. Sie ergibt
// „keine Preisliste" samt Grund — gerechnet wird dann nichts, statt mit einer halben Liste falsch.

export interface ModellPreis {
  eingabeJeMillion: number;
  ausgabeJeMillion: number;
}

export interface Preisliste {
  waehrung: string;
  preisstand: string;
  modelle: Readonly<Record<string, ModellPreis>>;
}

export type PreislisteLesung =
  | { preisliste: Preisliste; fehler?: undefined }
  | { preisliste: null; fehler?: string };

const MAX_TEXT = 40;

function nichtNegativ(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function kurzerText(t: unknown): t is string {
  return typeof t === "string" && t.trim().length > 0 && t.trim().length <= MAX_TEXT;
}

/** Liest die Preisliste aus dem Rohwert der Umgebung. Ohne Wert: keine Liste, kein Fehler. */
export function lesePreisliste(roh: string | undefined): PreislisteLesung {
  if (roh === undefined || roh.trim().length === 0) {
    return { preisliste: null };
  }
  let daten: unknown;
  try {
    daten = JSON.parse(roh);
  } catch {
    return { preisliste: null, fehler: "KLARWERK_KI_PREISLISTE ist kein gültiges JSON." };
  }
  const d = daten as { waehrung?: unknown; preisstand?: unknown; modelle?: unknown } | null;
  if (!d || typeof d !== "object" || !kurzerText(d.waehrung) || !kurzerText(d.preisstand)) {
    return {
      preisliste: null,
      fehler: "KLARWERK_KI_PREISLISTE braucht `waehrung` und `preisstand` (je kurzer Text).",
    };
  }
  if (!d.modelle || typeof d.modelle !== "object" || Array.isArray(d.modelle)) {
    return { preisliste: null, fehler: "KLARWERK_KI_PREISLISTE braucht `modelle` als Objekt." };
  }
  // Als Eintragsliste gesammelt und mit `Object.fromEntries` gebaut: eine Zuweisung an
  // `modelle["__proto__"]` würde den Prototyp setzen statt einen Eintrag anzulegen.
  const eintraege: [string, ModellPreis][] = [];
  for (const [modell, preis] of Object.entries(d.modelle as Record<string, unknown>)) {
    const p = preis as { eingabeJeMillion?: unknown; ausgabeJeMillion?: unknown } | null;
    if (!p || !nichtNegativ(p.eingabeJeMillion) || !nichtNegativ(p.ausgabeJeMillion)) {
      return {
        preisliste: null,
        fehler: `KLARWERK_KI_PREISLISTE: Preis für „${modell.slice(0, MAX_TEXT)}" unvollständig oder negativ.`,
      };
    }
    eintraege.push([
      modell,
      { eingabeJeMillion: p.eingabeJeMillion, ausgabeJeMillion: p.ausgabeJeMillion },
    ]);
  }
  const modelle: Record<string, ModellPreis> = Object.fromEntries(eintraege);
  return {
    preisliste: {
      waehrung: (d.waehrung as string).trim(),
      preisstand: (d.preisstand as string).trim(),
      modelle,
    },
  };
}

/** Rundet auf 6 Nachkommastellen — genug für Bruchteile eines Cents je Lauf. */
function runde(betrag: number): number {
  return Math.round(betrag * 1e6) / 1e6;
}

function preisFuer(preisliste: Preisliste, modell: string): ModellPreis | undefined {
  // Nur eigene Einträge: ein Modellname wie `constructor` darf keinen geerbten Wert treffen.
  return Object.hasOwn(preisliste.modelle, modell) ? preisliste.modelle[modell] : undefined;
}

/**
 * Die Kosten eines Laufs — oder `undefined`, wenn sie sich nicht ehrlich berechnen lassen.
 *
 * Ben R2 B3: GERECHNET WIRD JE VERSUCH, MIT DEM PREIS SEINES EIGENEN MODELLS. Bis Runde 2 wurde der
 * über alle Versuche addierte Verbrauch mit dem Preis des zuletzt antwortenden Modells bewertet —
 * eine gescheiterte teure Cloud-Anfrage vor einer billigen lokalen Antwort war damit zu billig.
 *
 * Keine Kosten (statt einer Teilsumme), wenn
 *   · keine Preisliste hinterlegt ist,
 *   · der Lauf keine Versuche führt (Altdatensatz: wem welcher Verbrauch gehört, ist unbekannt),
 *   · kein Versuch Verbrauch gemeldet hat,
 *   · ein Versuch ein Modell WIRKLICH gerufen, aber keinen Verbrauch gemeldet hat (Ben R3 B3:
 *     unbekannter Verbrauch ist kein Nachweis für null Kosten — die übrigen Versuche wären nur
 *     eine Teilsumme),
 *   · ein Versuch mehr Modellaufrufe ausgeführt hat (`aufrufe`), als Verbrauchsmeldungen
 *     eingingen (`verbrauch.gemeldeteAufrufe`) — Ben Lauf 3 R1 N1,
 *   · ein Versuch mit Verbrauch kein Modell oder kein Preis für sein Modell hat,
 *   · die Summe der Versuche nicht der Verbrauchssumme des Laufs entspricht.
 * Eine Teilsumme sähe aus wie die Kosten des Laufs und wäre zu niedrig.
 */
export function kostenEinesLaufs(
  lauf: Pick<ModelRunRecord, "versuche" | "verbrauch">,
  preisliste: Preisliste | null,
): ModelRunKosten | undefined {
  if (!preisliste || !lauf.versuche) {
    return undefined;
  }
  if (lauf.versuche.some((v) => v.model !== undefined && v.verbrauch === undefined)) {
    return undefined;
  }
  // Ben Lauf 3 R1 N1: dasselbe innerhalb eines Versuchs. Hat von mehreren wirklich ausgeführten
  // Aufrufen (z. B. `extract` je Abschnitt) einer keinen Verbrauch gemeldet, ist der Verbrauch des
  // Versuchs eine Teilsumme.
  if (
    lauf.versuche.some(
      (v) => v.aufrufe !== undefined && (v.verbrauch?.gemeldeteAufrufe ?? 0) < v.aufrufe,
    )
  ) {
    return undefined;
  }
  const mitVerbrauch = lauf.versuche.filter((v) => v.verbrauch !== undefined);
  if (mitVerbrauch.length === 0) {
    return undefined;
  }
  let betrag = 0;
  let eingabe = 0;
  let ausgabe = 0;
  for (const versuch of mitVerbrauch) {
    const verbrauch = versuch.verbrauch as ModelRunVerbrauch;
    const preis = versuch.model ? preisFuer(preisliste, versuch.model) : undefined;
    if (!preis) {
      return undefined;
    }
    eingabe += verbrauch.eingabeToken;
    ausgabe += verbrauch.ausgabeToken;
    betrag +=
      (verbrauch.eingabeToken * preis.eingabeJeMillion +
        verbrauch.ausgabeToken * preis.ausgabeJeMillion) /
      1_000_000;
  }
  if (
    !lauf.verbrauch ||
    lauf.verbrauch.eingabeToken !== eingabe ||
    lauf.verbrauch.ausgabeToken !== ausgabe
  ) {
    return undefined;
  }
  return {
    betrag: runde(betrag),
    waehrung: preisliste.waehrung,
    preisstand: preisliste.preisstand,
  };
}

/** Der Lauf mit Kosten, falls berechenbar; sonst unverändert (ein vorhandenes Feld bleibt). */
export function mitKosten(lauf: ModelRunRecord, preisliste: Preisliste | null): ModelRunRecord {
  if (lauf.kosten) {
    return lauf;
  }
  const kosten = kostenEinesLaufs(lauf, preisliste);
  return kosten ? { ...lauf, kosten } : lauf;
}
