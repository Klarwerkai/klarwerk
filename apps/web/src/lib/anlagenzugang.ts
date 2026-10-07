// ================================================================================================
// R-1631 / R-1647 / R-2174 (aufnahme:20260922:gesamt-anlagenzugang) — DIE ADRESSE EINER ANLAGE.
// ================================================================================================
//
// „Wissensobjekte können an konkrete Anlagen-IDs, Bauteil-Nummern oder Material-Codes gekoppelt
// werden. Ein Techniker scannt den QR-Code an der Maschine — KLARWERK öffnet automatisch das für
// DIESE Maschine relevante Wissen, gefiltert auf Version, Standort, Schicht-Kontext."
//
// DIE BEZÜGE: die Anlage ist seit JOB 593 `KnowledgeObject.asset` (kanonisch, normalisiert in
// `services/knowledge-object/src/asset.ts`); Bauteil-Nummern und Material-Codes stehen in
// `KnowledgeObject.anlagenkontext` (`services/knowledge-object/src/anlagenkontext.ts`). Alle drei
// sind Facetten der Bibliothek (`?anlage=`, `?bauteil=`, `?material=`): ein Objekt passt, wenn es
// die Kennung trägt.
//
// DER GELTUNGSKONTEXT (`?anlagenversion=`, `?standort=`, `?schicht=`) ist ANDERS gebaut, und das ist
// die tragende Regel: Wissen OHNE Angabe gilt unabhängig davon. Ein Objekt passt zum Standort
// „Werk Nord", wenn es diesen Standort nennt ODER gar keinen. Als Facette (nur wer den Wert trägt)
// fiele das allgemeine Wissen einer Anlage aus jeder Kontextwahl — genau das, was der Techniker an
// der Maschine nicht verlieren darf. Wissen, das ausdrücklich nur für ANDERE Standorte, Versionen
// oder Schichten gilt, fällt dagegen heraus.
//
// KEIN ZWEITER LESEWEG: die Adresse öffnet die vorhandene Bibliothek (`BibliothekFlaeche.tsx`).
// Dort gelten dieselben Rechte (Server-Trim der Suche), dieselbe Wertprüfung des Adresskeims und
// dieselben übrigen Filter. Eine Anmeldung zwischen Scan und Ansicht verliert die Adresse nicht:
// das Anmeldetor zeigt seine Maske AN der aufgerufenen Adresse (`App.tsx`, `Gate`).
import type { KnowledgeObject } from "../api/types";

export const ANLAGE_FACETTE = "anlage";
export const BAUTEIL_FACETTE = "bauteil";
export const MATERIAL_FACETTE = "material";

/** Die drei Bezugsarten, in der Reihenfolge, in der die Oberfläche sie nennt. */
export const BEZUG_ARTEN = [ANLAGE_FACETTE, BAUTEIL_FACETTE, MATERIAL_FACETTE] as const;
export type BezugArt = (typeof BEZUG_ARTEN)[number];

/** Die drei Kontextachsen: Adressparameter → Liste am Objekt. */
export const KONTEXT_ACHSEN = [
  { param: "anlagenversion", feld: "versionen" },
  { param: "standort", feld: "standorte" },
  { param: "schicht", feld: "schichten" },
] as const;
export type KontextParam = (typeof KONTEXT_ACHSEN)[number]["param"];
export type Geltungskontext = Partial<Record<KontextParam, string>>;

/** Die Kennung, wie sie am Objekt gespeichert ist — dieselbe Normalform wie `normalizeAsset`. */
export function anlagenKennung(wert: string | null | undefined): string | null {
  if (typeof wert !== "string") {
    return null;
  }
  const normalisiert = wert.normalize("NFC").replace(/\s+/g, " ").trim();
  return normalisiert.length > 0 ? normalisiert : null;
}

function kennungen(werte: readonly string[] | undefined): string[] {
  const ergebnis: string[] = [];
  for (const wert of werte ?? []) {
    const kennung = anlagenKennung(wert);
    if (kennung && !ergebnis.includes(kennung)) {
      ergebnis.push(kennung);
    }
  }
  return ergebnis;
}

/** Die Facettenwerte der Achse „Anlage": genau die eine Kennung oder keine. */
export function anlagenWerte(wert: string | null | undefined): string[] {
  const kennung = anlagenKennung(wert);
  return kennung ? [kennung] : [];
}

/** Die Kennungen eines Objekts je Bezugsart (Anlage, Bauteile, Materialien). */
export function bezuegeVon(
  ko: Pick<KnowledgeObject, "asset" | "anlagenkontext">,
): Record<BezugArt, string[]> {
  return {
    [ANLAGE_FACETTE]: anlagenWerte(ko.asset),
    [BAUTEIL_FACETTE]: kennungen(ko.anlagenkontext?.bauteile),
    [MATERIAL_FACETTE]: kennungen(ko.anlagenkontext?.materialien),
  };
}

/** Die Kontextlisten eines Objekts (Versionen, Standorte, Schichten) in Normalform. */
export function kontextVon(
  ko: Pick<KnowledgeObject, "anlagenkontext">,
): Record<KontextParam, string[]> {
  const k = ko.anlagenkontext;
  return {
    anlagenversion: kennungen(k?.versionen),
    standort: kennungen(k?.standorte),
    schicht: kennungen(k?.schichten),
  };
}

/** Der Geltungskontext aus der Adresse — nur gesetzte, nicht leere Werte. */
export function kontextAusParams(params: URLSearchParams): Geltungskontext {
  const kontext: Geltungskontext = {};
  for (const { param } of KONTEXT_ACHSEN) {
    const wert = anlagenKennung(params.get(param));
    if (wert) {
      kontext[param] = wert;
    }
  }
  return kontext;
}

/**
 * Passt dieses Objekt zum Geltungskontext? Je gesetzter Achse: das Objekt nennt keinen Wert dieser
 * Achse (gilt allgemein) ODER nennt genau diesen. Ohne gesetzte Achse passt jedes Objekt.
 */
export function passtZumKontext(
  ko: Pick<KnowledgeObject, "anlagenkontext">,
  kontext: Geltungskontext,
): boolean {
  const listen = kontextVon(ko);
  for (const { param } of KONTEXT_ACHSEN) {
    const gewaehlt = kontext[param];
    if (!gewaehlt) {
      continue;
    }
    const liste = listen[param];
    if (liste.length > 0 && !liste.includes(gewaehlt)) {
      return false;
    }
  }
  return true;
}

/** Alle im Bestand vorkommenden Kontextwerte je Achse, sortiert — die Auswahl der Kontextleiste. */
export function bekannteKontextwerte(
  kos: readonly Pick<KnowledgeObject, "anlagenkontext">[],
): Record<KontextParam, string[]> {
  const ergebnis: Record<KontextParam, string[]> = {
    anlagenversion: [],
    standort: [],
    schicht: [],
  };
  for (const ko of kos) {
    const listen = kontextVon(ko);
    for (const { param } of KONTEXT_ACHSEN) {
      for (const wert of listen[param]) {
        if (!ergebnis[param].includes(wert)) {
          ergebnis[param].push(wert);
        }
      }
    }
  }
  for (const { param } of KONTEXT_ACHSEN) {
    ergebnis[param].sort((a, b) => a.localeCompare(b));
  }
  return ergebnis;
}

/**
 * Der Pfad innerhalb der Anwendung, der das Wissen zu dieser Kennung öffnet — wahlweise mit
 * Geltungskontext (Standort und Version stehen fest an der Maschine; die Schicht kann der Mensch
 * auch nach dem Scan in der Kontextleiste wählen).
 */
export function anlagenPfad(
  kennung: string,
  art: BezugArt = ANLAGE_FACETTE,
  kontext: Geltungskontext = {},
): string {
  const p = new URLSearchParams();
  p.set(art, kennung);
  for (const { param } of KONTEXT_ACHSEN) {
    const wert = kontext[param];
    if (wert) {
      p.set(param, wert);
    }
  }
  return `/bibliothek?${p.toString()}`;
}

/** Die vollständige Adresse für den QR-Code — der Ursprung ist der, unter dem KLARWERK läuft. */
export function anlagenAdresse(
  ursprung: string,
  kennung: string,
  art: BezugArt = ANLAGE_FACETTE,
  kontext: Geltungskontext = {},
): string {
  return `${ursprung.replace(/\/+$/, "")}${anlagenPfad(kennung, art, kontext)}`;
}

/** Eine Eingabezeile „A, B, C" als Kennungsliste (Komma oder Zeilenumbruch trennen). */
export function kennungenAusEingabe(eingabe: string): string[] {
  return kennungen(eingabe.split(/[,\n]/));
}
