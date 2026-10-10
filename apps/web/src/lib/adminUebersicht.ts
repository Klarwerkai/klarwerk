// ================================================================================================
// ADMIN-01 · DIE STARTSEITE DER VERWALTUNG — Gruppen, Zweck und Aufgaben, DOM-frei.
// ================================================================================================
//
// produkt:20261009:admin-verwaltung-uebersicht. Beobachtete Ausgangslage (09.10.2026): „Der
// Adminbereich beginnt in der Nutzerliste. Fähigkeiten und Handlungsbedarf sind hinter knappen
// Zeilen verborgen; technische und fachliche Bereiche stehen nebeneinander."
//
// WAS DIESE DATEI IST: die Zuordnung der sieben FACHLICHEN Gruppen des Auftrags (Menschen/Rechte,
// Spaces/Wissensordnung, Qualität/Freigaben, KI/Integrationen, Kommunikation, Berichte/Nachweise,
// Organisation/Betrieb) zu den VORHANDENEN Bedienorten. Sie baut keinen davon nach:
//   · die sieben Themen aus `adminSections.ts` und ihre Detailkennungen bleiben, wie sie sind —
//     jede alte Adresse `/admin?bereich=…&detail=…` gilt weiter;
//   · Ziele ausserhalb der Verwaltung sind Einträge aus `app/navigation.ts` (Rolle und Stufe 2
//     entscheidet dort `canSee`, nicht diese Datei) oder eine vorhandene Route (`/spaces`).
//
// „Funktionen ohne Umsetzung nicht als benutzbar anbieten": Eine Gruppe ohne Bedienort steht mit
// leerer Zielliste da — die Fläche sagt „noch nicht verfügbar" und bietet keinen Weg an. Die Gruppe
// Kommunikation hat seit ADMIN-12 ihren Bedienort (`/kommunikation`).
//
// DIE AUFGABEN hängen ausschliesslich an Quellen, die es schon gibt und deren Liste dieselbe Menge
// zeigt (Auftrag: „zunächst an vorhandene Prüfungen, Lücken und Verbindungszustände anschließen").
// Jede Aufgabe nennt ihren Weg in die passend gefilterte Liste; der Filter steht in der Adresse und
// übersteht damit Zurück und Neuladen.
import { ADMIN_DETAILS, ADMIN_SECTIONS, type AdminSectionId, adminHref } from "./adminSections";

/** Ein Weg aus der Übersicht. */
export type UebersichtZiel =
  /** Ein Thema oder eine Detailkarte der Verwaltung selbst. */
  | { art: "verwaltung"; section: AdminSectionId; detail?: string; labelKey?: string }
  /** Ein Bereich der App (`ALL_ITEMS`-Kennung) — Rolle und Modulschalter prüft die Fläche. */
  | { art: "bereich"; navId: string }
  /** Eine vorhandene Route ohne Menüeintrag. */
  | { art: "pfad"; pfad: string; labelKey: string };

export interface UebersichtGruppe {
  id: string;
  labelKey: string;
  /** Ein Satz: wofür diese Gruppe da ist. */
  zweckKey: string;
  /** Leer heisst: in der Verwaltung noch kein Bedienort — wird als „nicht verfügbar" gezeigt. */
  ziele: readonly UebersichtZiel[];
}

export const VERWALTUNG_GRUPPEN: readonly UebersichtGruppe[] = [
  {
    id: "menschen",
    labelKey: "verwaltung.gruppe.menschen",
    zweckKey: "verwaltung.zweck.menschen",
    ziele: [
      { art: "verwaltung", section: "konten" },
      { art: "verwaltung", section: "konten", detail: "nutzerNeu" },
      // ADMIN-06: Teams als gemeinsamer Mitgliedschaftsweg auf diesen Konten.
      { art: "verwaltung", section: "konten", detail: "teams" },
      // Die Übergabe wohnt in der Kontokarte der abgebenden Person (`VerantwortungUebergabe`):
      // der Weg führt deshalb in die Kontenliste, nicht in eine zweite Übergabefläche.
      { art: "verwaltung", section: "konten", labelKey: "verwaltung.ziel.uebergabe" },
      { art: "verwaltung", section: "konten", detail: "ansichtRolle" },
    ],
  },
  {
    id: "spaces",
    labelKey: "verwaltung.gruppe.spaces",
    zweckKey: "verwaltung.zweck.spaces",
    ziele: [
      { art: "pfad", pfad: "/spaces", labelKey: "verwaltung.ziel.spaces" },
      { art: "bereich", navId: "bibliothek" },
      { art: "bereich", navId: "wissensnetz" },
      { art: "verwaltung", section: "quellen" },
      { art: "verwaltung", section: "quellen", detail: "papierkorb" },
    ],
  },
  {
    id: "qualitaet",
    labelKey: "verwaltung.gruppe.qualitaet",
    zweckKey: "verwaltung.zweck.qualitaet",
    ziele: [
      // ADMIN-10: die gemeinsame, deduplizierte Sicht auf die Vorgänge der Zeilen darunter.
      {
        art: "pfad",
        pfad: "/qualitaetsaufgaben",
        labelKey: "verwaltung.ziel.qualitaetsaufgaben",
      },
      { art: "bereich", navId: "validierung" },
      { art: "bereich", navId: "konflikte" },
      { art: "bereich", navId: "duplikate" },
      { art: "bereich", navId: "risiko" },
      { art: "bereich", navId: "lebenszyklus" },
      { art: "verwaltung", section: "ki", detail: "kiDup" },
    ],
  },
  {
    id: "ki",
    labelKey: "verwaltung.gruppe.ki",
    zweckKey: "verwaltung.zweck.ki",
    ziele: [
      { art: "verwaltung", section: "ki" },
      { art: "verwaltung", section: "ki", detail: "ki" },
      { art: "verwaltung", section: "ki", detail: "kiZugaenge" },
      { art: "verwaltung", section: "ki", detail: "kiFunktionen" },
      { art: "verwaltung", section: "ki", detail: "kiGrenzen" },
      { art: "verwaltung", section: "ki", detail: "kiExtern" },
      { art: "bereich", navId: "import" },
    ],
  },
  {
    id: "kommunikation",
    labelKey: "verwaltung.gruppe.kommunikation",
    zweckKey: "verwaltung.zweck.kommunikation",
    // ADMIN-12: die zentrale Übersicht der Meldungen (Ereignis, Empfänger, Kanal, Häufigkeit) samt
    // Unternehmensvorgaben. Den Zustellstatus einer Veröffentlichung zeigt der Eintrag selbst.
    ziele: [{ art: "pfad", pfad: "/kommunikation", labelKey: "kommunikation.verwaltung.ziel" }],
  },
  {
    id: "berichte",
    labelKey: "verwaltung.gruppe.berichte",
    zweckKey: "verwaltung.zweck.berichte",
    ziele: [
      { art: "verwaltung", section: "berichte" },
      { art: "verwaltung", section: "sicherheit" },
      { art: "verwaltung", section: "sicherheit", detail: "protokoll" },
      { art: "verwaltung", section: "sicherheit", detail: "audit" },
      { art: "verwaltung", section: "sicherheit", detail: "datenschutz" },
    ],
  },
  {
    id: "betrieb",
    labelKey: "verwaltung.gruppe.betrieb",
    zweckKey: "verwaltung.zweck.betrieb",
    ziele: [
      { art: "verwaltung", section: "system" },
      { art: "verwaltung", section: "system", detail: "bereitschaft" },
      { art: "verwaltung", section: "system", detail: "sicherung" },
      { art: "verwaltung", section: "vorfuehrdaten" },
      { art: "verwaltung", section: "vorfuehrdaten", detail: "demo" },
      // ADMIN-16: Pakete und Testimporte gehören zum Betrieb, nicht zu Import oder Qualität.
      { art: "verwaltung", section: "vorfuehrdaten", detail: "pakete" },
      { art: "verwaltung", section: "vorfuehrdaten", detail: "testimporte" },
      { art: "verwaltung", section: "system", detail: "werk" },
    ],
  },
];

/** Der Name eines Verwaltungsziels — aus DERSELBEN Quelle wie Reiter, Pfad und Direktzugang. */
export function verwaltungsZielLabelKey(
  ziel: Extract<UebersichtZiel, { art: "verwaltung" }>,
): string {
  if (ziel.labelKey !== undefined) {
    return ziel.labelKey;
  }
  if (ziel.detail !== undefined) {
    const detail = ADMIN_DETAILS.find((d) => d.id === ziel.detail);
    if (detail) {
      return detail.labelKey;
    }
  }
  return ADMIN_SECTIONS.find((s) => s.id === ziel.section)?.labelKey ?? ziel.section;
}

export function verwaltungsZielHref(ziel: Extract<UebersichtZiel, { art: "verwaltung" }>): string {
  return adminHref(ziel.section, ziel.detail);
}

/** Eine stabile Kennung je Ziel (Testanker `ziel-…`), eindeutig über alle Gruppen. */
export function zielKennung(ziel: UebersichtZiel): string {
  switch (ziel.art) {
    case "verwaltung":
      if (ziel.labelKey !== undefined) {
        return ziel.labelKey.split(".").pop() ?? ziel.section;
      }
      return ziel.detail === undefined ? ziel.section : `${ziel.section}-${ziel.detail}`;
    case "bereich":
      return ziel.navId;
    case "pfad":
      return ziel.pfad.replace(/^\//, "");
  }
}

// ------------------------------------------------------------------------------------------------
// DIE AUFGABEN — Zähler und die Liste dahinter.
// ------------------------------------------------------------------------------------------------

/** `/risiko?luecken=offen` — die Lückenliste zeigt nur offene Lücken. */
export const LUECKEN_PARAM = "luecken";
export const LUECKEN_OFFEN = "offen";
/** `/admin?bereich=konten&filter=wartet` — die Kontenliste zeigt nur Konten ohne Freigabe. */
export const KONTEN_FILTER_PARAM = "filter";
export const KONTEN_FILTER_WARTET = "wartet";

export type AufgabeId = "pruefungen" | "luecken" | "freigaben" | "kiZugaenge";

/** Die Reihenfolge auf der Fläche: erst Fachaufgaben, dann Konten, dann Verbindungen. */
export const AUFGABEN: readonly AufgabeId[] = ["pruefungen", "luecken", "freigaben", "kiZugaenge"];

export function aufgabeHref(id: AufgabeId): string {
  switch (id) {
    // Das Prüf-Board zeigt ohne Parameter genau `GET /api/validation/board` — dieselbe Abfrage
    // (`useValidationBoard()`), deren Länge der Zähler ist.
    case "pruefungen":
      return "/validierung";
    case "luecken":
      return `/risiko?${LUECKEN_PARAM}=${LUECKEN_OFFEN}`;
    case "freigaben":
      return `${adminHref("konten")}&${KONTEN_FILTER_PARAM}=${KONTEN_FILTER_WARTET}`;
    case "kiZugaenge":
      return adminHref("ki", "kiZugaenge");
  }
}

export function nurOffeneLuecken(params: URLSearchParams): boolean {
  return params.get(LUECKEN_PARAM) === LUECKEN_OFFEN;
}

export function nurWartendeKonten(params: URLSearchParams): boolean {
  return params.get(KONTEN_FILTER_PARAM) === KONTEN_FILTER_WARTET;
}

/** Dieselbe Auswahl für Zähler und Liste — eine Regel, eine Stelle. */
export function offeneLuecken<T extends { status: string }>(gaps: readonly T[]): T[] {
  return gaps.filter((g) => g.status === "offen");
}

/**
 * ADMIN-01 Nacharbeit 3 (Bens Befund): der Zähler „KI-Zugänge aktiv" zählte den deterministischen
 * Ersatzmodus mit — `aiAccessRows` führt ihn als `active`, sobald KEIN Modell antwortet. Ohne
 * eingerichtetes Modell stand deshalb „1 von 4", obwohl keine KI angebunden ist.
 *
 * Jetzt zwei getrennte Aussagen aus DENSELBEN Zeilen, die die Karte „KI-Zugänge" zeigt:
 *   · echte Zugänge = alle Zeilen außer dem Ersatzmodus (ChatGPT, Claude, lokaler Server) —
 *     `aktiv` zählt davon die, die gerade antworten, `gesamt` alle;
 *   · `ersatzAktiv` = der Ersatzmodus antwortet (kein Modell) — eigens benannt, nie mitgezählt.
 */
export interface KiZugangsLage {
  aktiv: number;
  gesamt: number;
  ersatzAktiv: boolean;
}

export function kiZugangsLage(zeilen: readonly { id: string; state: string }[]): KiZugangsLage {
  const echte = zeilen.filter((z) => z.id !== "fallback");
  return {
    aktiv: echte.filter((z) => z.state === "active").length,
    gesamt: echte.length,
    ersatzAktiv: zeilen.some((z) => z.id === "fallback" && z.state === "active"),
  };
}

/** Dieselbe Auswahl für Zähler und Kontenliste. */
export function wartendeKonten<T extends { approved: boolean }>(users: readonly T[]): T[] {
  return users.filter((u) => !u.approved);
}
