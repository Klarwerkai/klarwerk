// ================================================================================================
// R-1631 (aufnahme:20260922:gesamt-anlagenzugang) — STÜCKLISTENBEZUG UND GELTUNGSKONTEXT.
// ================================================================================================
//
// Roadmap 3.1, wörtlich: „Wissensobjekte können an konkrete Anlagen-IDs, Bauteil-Nummern oder
// Material-Codes gekoppelt werden. … KLARWERK öffnet automatisch das für DIESE Maschine relevante
// Wissen, gefiltert auf Version, Standort, Schicht-Kontext."
//
// Die Anlagen-ID ist seit JOB 593 `KnowledgeObject.asset` (Normalform `./asset.ts`) und bleibt es.
// Dieses Feld trägt das, was dort fehlte:
//   · `bauteile`    — Bauteil-Nummern, an die das Wissen gekoppelt ist,
//   · `materialien` — Material-Codes, an die das Wissen gekoppelt ist,
//   · `versionen`   — die Anlagen-/Ausführungsversionen, für die das Wissen gilt,
//   · `standorte`   — die Standorte, an denen es gilt,
//   · `schichten`   — die Schichten, in denen es gilt.
// Für die drei Geltungsangaben heisst eine LEERE Liste „gilt unabhängig davon" — sonst fiele
// allgemeines Wissen einer Anlage aus jeder Kontextauswahl (die Regel steht in der Oberfläche,
// `apps/web/src/lib/anlagenzugang.ts`, `passtZumKontext`).
//
// JEDE KENNUNG IN DERSELBEN NORMALFORM WIE DIE ANLAGE (`normalizeAsset`): NFC, Innenleerraum zu
// einem Zeichen, Ränder weg, leer fällt weg. Doppelte Einträge werden einer. Keine Kleinschreibung —
// bei Bauteil- und Materialnummern trägt sie Bedeutung, wie bei Anlagenkennungen.
//
// OPTIONAL UND OHNE MIGRATION: das Objekt liegt als Voll-JSONB (`kos.data`). Fehlt das Feld, ist
// nichts angegeben. Eine Liste ohne Einträge wird nicht gespeichert, ein Kontext ohne Liste auch nicht.
import { normalizeAsset } from "./asset";
import type { AnlagenKontext } from "./types";

export const ANLAGENKONTEXT_FELDER = [
  "bauteile",
  "materialien",
  "versionen",
  "standorte",
  "schichten",
] as const satisfies readonly (keyof AnlagenKontext)[];

/** Höchstzahl der Einträge je Liste und Höchstlänge je Kennung — geprüft an der Route (400). */
const ANLAGENKONTEXT_MAX_EINTRAEGE = 50;
const ANLAGENKONTEXT_MAX_LAENGE = 120;

/**
 * Die Normalform eines Anlagenkontexts — oder `undefined`, wenn nichts angegeben ist. Unbekannte
 * Schlüssel und Nicht-Texte fallen weg; was bleibt, ist genau eine Schreibweise je Kennung.
 */
export function normalizeAnlagenkontext(wert: unknown): AnlagenKontext | undefined {
  if (typeof wert !== "object" || wert === null || Array.isArray(wert)) {
    return undefined;
  }
  const roh = wert as Record<string, unknown>;
  const ergebnis: AnlagenKontext = {};
  for (const feld of ANLAGENKONTEXT_FELDER) {
    const liste = roh[feld];
    if (!Array.isArray(liste)) {
      continue;
    }
    const werte: string[] = [];
    for (const eintrag of liste) {
      const kennung = normalizeAsset(eintrag);
      if (kennung && !werte.includes(kennung)) {
        werte.push(kennung);
      }
    }
    if (werte.length > 0) {
      ergebnis[feld] = werte;
    }
  }
  return Object.keys(ergebnis).length > 0 ? ergebnis : undefined;
}

/**
 * Der Grund, warum ein Anlagenkontext aus dem Netz NICHT angenommen wird — oder `null`. Nichts wird
 * gekürzt oder geraten: eine zu lange Kennung oder zu viele Einträge sind ein 400 an der Route.
 */
export function anlagenkontextFehler(wert: unknown): string | null {
  if (typeof wert !== "object" || wert === null || Array.isArray(wert)) {
    return "anlagenkontext fehlt oder ist kein Objekt.";
  }
  const roh = wert as Record<string, unknown>;
  for (const feld of ANLAGENKONTEXT_FELDER) {
    const liste = roh[feld];
    if (liste === undefined) {
      continue;
    }
    if (!Array.isArray(liste) || liste.some((e) => typeof e !== "string")) {
      return `anlagenkontext.${feld} ist keine Liste aus Texten.`;
    }
    if (liste.length > ANLAGENKONTEXT_MAX_EINTRAEGE) {
      return `anlagenkontext.${feld} hat mehr als ${ANLAGENKONTEXT_MAX_EINTRAEGE} Einträge.`;
    }
    if (liste.some((e) => (e as string).trim().length > ANLAGENKONTEXT_MAX_LAENGE)) {
      return `anlagenkontext.${feld} enthält eine Kennung mit mehr als ${ANLAGENKONTEXT_MAX_LAENGE} Zeichen.`;
    }
  }
  return null;
}
