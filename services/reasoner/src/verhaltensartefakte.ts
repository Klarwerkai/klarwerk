import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { ReasonerLocale } from "./types";

// ================================================================================================
// R-0468 — DAS KI-VERHALTEN ALS DATEN NEBEN DEM MODELL (VERHALTENSARTEFAKTE).
// ================================================================================================
//
// Herkunft: Beratungsbericht Wissensschicht 2026-07-05, Abschnitt 4.2 „Schicht 2 — Verhaltens-
// artefakte" und 5.3 „Format der Artefakte". Bis hierher stand „wie antworte ich richtig" nur als
// Code in den Anweisungen je Aufgabe (`provider-model.ts`). Diese Datei macht daraus DATEN:
//
//   · Ein Artefakt gehört zu genau EINER Aufgabe und hat eine ART — Antwortvertrag, Leitplanke oder
//     Beispiel. Es ist an kein Modell gebunden: derselbe Baustein geht unverändert an den lokalen
//     Weg, an Claude und an ChatGPT (`ModelProvider`, eine Quelle für alle drei).
//   · Jede Änderung ist eine NEUE FASSUNG. Die Ablage schreibt nur an (`lege`), alte Fassungen
//     bleiben lesbar — ein Artefakt wird verworfen, nicht gelöscht (Bericht 6.3: „Deaktivieren statt
//     löschen").
//   · Wirksam wird nur die JÜNGSTE Fassung, und nur mit dem Status `freigegeben` (Bericht 6.2). Ein
//     Entwurf erreicht kein Modell.
//   · `herkunftsfall` hält fest, aus welchem Prüfstand-Fall eine Leitplanke entstand (Bericht 4.2).
//
// DIE EINBINDUNG IST EINE REINE FUNKTION: `verhaltensblock` setzt aus den wirksamen Artefakten einer
// Aufgabe einen Textblock zusammen, `mitVerhalten` hängt ihn hinter die eingebaute Anweisung. Ohne
// freigegebenes Artefakt ist die Anweisung Zeichen für Zeichen die bisherige.
//
// BEWUSST NICHT HIER (benannt statt verschwiegen): das Prüfstand-Tor vor der Freigabe (Bericht 5.1
// Schritt 6 / 9.2) und die automatische Ursachenzuordnung (5.2). Freigegeben wird von Hand durch
// einen Administrator; die Messung, die die Freigabe tragen soll, bleibt eine eigene Aufgabe.

export type VerhaltensAufgabe = "answer" | "structure" | "assist" | "conflict" | "duplicate";
export const VERHALTENS_AUFGABEN: readonly VerhaltensAufgabe[] = [
  "answer",
  "structure",
  "assist",
  "conflict",
  "duplicate",
];

export type VerhaltensArt = "kontrakt" | "leitplanke" | "beispiel";
export const VERHALTENS_ARTEN: readonly VerhaltensArt[] = ["kontrakt", "leitplanke", "beispiel"];

export type VerhaltensStatus = "entwurf" | "freigegeben" | "verworfen";
export const VERHALTENS_STATUS: readonly VerhaltensStatus[] = [
  "entwurf",
  "freigegeben",
  "verworfen",
];

export interface Verhaltensartefakt {
  /** Bleibt über alle Fassungen gleich. */
  readonly schluessel: string;
  /** 1, 2, 3 … je Schlüssel; die höchste ist die geltende. */
  readonly version: number;
  readonly aufgabe: VerhaltensAufgabe;
  readonly art: VerhaltensArt;
  readonly inhalt: string;
  readonly status: VerhaltensStatus;
  /** Prüfstand-Fall, aus dem das Artefakt entstand (z. B. „KON-5"), sonst null. */
  readonly herkunftsfall: string | null;
  readonly angelegtVon: string;
  readonly angelegtAm: string;
}

export interface VerhaltensartefaktEingabe {
  /** Ohne Schlüssel entsteht ein neues Artefakt; mit Schlüssel dessen nächste Fassung. */
  schluessel?: string;
  aufgabe?: string;
  art?: string;
  inhalt?: string;
  status?: string;
  herkunftsfall?: string | null;
}

export const VERHALTEN_INHALT_MIN = 5;
export const VERHALTEN_INHALT_MAX = 2_000;
export const VERHALTEN_HERKUNFT_MAX = 120;
/** Obergrenze wirksamer Artefakte je Aufgabe — der Block bleibt ein Zusatz, kein zweiter Prompt. */
export const VERHALTEN_MAX_WIRKSAM_JE_AUFGABE = 12;

export class VerhaltensFehler extends Error {
  constructor(
    message: string,
    readonly grund: "eingabe" | "unbekannt" | "voll",
  ) {
    super(message);
    this.name = "VerhaltensFehler";
  }
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAGE — nur anschreiben und lesen.
// ------------------------------------------------------------------------------------------------

export interface VerhaltensartefaktRepo {
  /** Alle Fassungen aller Artefakte. */
  alle(): Promise<Verhaltensartefakt[]>;
  /** Legt eine Fassung an. Eine vorhandene Fassung (Schlüssel + Version) wird nie überschrieben. */
  lege(artefakt: Verhaltensartefakt): Promise<void>;
}

export class InMemoryVerhaltensartefaktRepo implements VerhaltensartefaktRepo {
  private readonly fassungen: Verhaltensartefakt[] = [];

  async alle(): Promise<Verhaltensartefakt[]> {
    return this.fassungen.map((f) => ({ ...f }));
  }

  async lege(artefakt: Verhaltensartefakt): Promise<void> {
    const doppelt = this.fassungen.some(
      (f) => f.schluessel === artefakt.schluessel && f.version === artefakt.version,
    );
    if (doppelt) {
      throw new Error(`Fassung ${artefakt.schluessel}@${artefakt.version} besteht bereits`);
    }
    this.fassungen.push({ ...artefakt });
  }
}

/**
 * Eine Zeile je Fassung. REIN ADDITIV UND WIEDERHOLBAR: ein `CREATE TABLE IF NOT EXISTS`, kein DROP,
 * kein Fremdschlüssel, keine Extension, kein Seed.
 */
export const VERHALTENSARTEFAKTE_SCHEMA = `
CREATE TABLE IF NOT EXISTS verhaltensartefakte (
  schluessel text NOT NULL,
  version integer NOT NULL,
  aufgabe text NOT NULL,
  art text NOT NULL,
  inhalt text NOT NULL,
  status text NOT NULL,
  herkunftsfall text,
  angelegt_von text NOT NULL,
  angelegt_am timestamptz NOT NULL,
  PRIMARY KEY (schluessel, version)
);
`;

interface VerhaltensZeile {
  schluessel: string;
  version: number;
  aufgabe: VerhaltensAufgabe;
  art: VerhaltensArt;
  inhalt: string;
  status: VerhaltensStatus;
  herkunftsfall: string | null;
  angelegt_von: string;
  angelegt_am: Date;
}

export class PgVerhaltensartefaktRepo implements VerhaltensartefaktRepo {
  constructor(private readonly pool: Pool) {}

  async alle(): Promise<Verhaltensartefakt[]> {
    const res = await this.pool.query<VerhaltensZeile>(
      "SELECT * FROM verhaltensartefakte ORDER BY schluessel, version",
    );
    return res.rows.map((z) => ({
      schluessel: z.schluessel,
      version: z.version,
      aufgabe: z.aufgabe,
      art: z.art,
      inhalt: z.inhalt,
      status: z.status,
      herkunftsfall: z.herkunftsfall,
      angelegtVon: z.angelegt_von,
      angelegtAm: z.angelegt_am.toISOString(),
    }));
  }

  async lege(a: Verhaltensartefakt): Promise<void> {
    await this.pool.query(
      `INSERT INTO verhaltensartefakte
         (schluessel, version, aufgabe, art, inhalt, status, herkunftsfall, angelegt_von, angelegt_am)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        a.schluessel,
        a.version,
        a.aufgabe,
        a.art,
        a.inhalt,
        a.status,
        a.herkunftsfall,
        a.angelegtVon,
        a.angelegtAm,
      ],
    );
  }
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

/** Was ein Modellaufruf braucht: die wirksamen Artefakte einer Aufgabe. */
export interface VerhaltensQuelle {
  wirksameFuer(aufgabe: VerhaltensAufgabe): Promise<readonly Verhaltensartefakt[]>;
}

function eingabeFehler(meldung: string): VerhaltensFehler {
  return new VerhaltensFehler(meldung, "eingabe");
}

function istEineVon<T extends string>(werte: readonly T[], wert: unknown): wert is T {
  return typeof wert === "string" && (werte as readonly string[]).includes(wert);
}

/** Die jüngste Fassung je Schlüssel. */
export function geltendeFassungen(fassungen: readonly Verhaltensartefakt[]): Verhaltensartefakt[] {
  const juengste = new Map<string, Verhaltensartefakt>();
  for (const f of fassungen) {
    const bisher = juengste.get(f.schluessel);
    if (!bisher || f.version > bisher.version) {
      juengste.set(f.schluessel, f);
    }
  }
  return [...juengste.values()].sort(nachSchluessel);
}

export interface VerhaltensDienstDeps {
  repo: VerhaltensartefaktRepo;
  uhr?: () => string;
  neueId?: () => string;
}

export class VerhaltensDienst implements VerhaltensQuelle {
  private readonly repo: VerhaltensartefaktRepo;
  private readonly uhr: () => string;
  private readonly neueId: () => string;

  constructor(deps: VerhaltensDienstDeps) {
    this.repo = deps.repo;
    this.uhr = deps.uhr ?? (() => new Date().toISOString());
    this.neueId = deps.neueId ?? (() => randomUUID());
  }

  /** Alle Fassungen, je Schlüssel aufsteigend — der vollständige Verlauf. */
  async verlauf(): Promise<Verhaltensartefakt[]> {
    const alle = await this.repo.alle();
    return alle.sort((a, b) => nachSchluessel(a, b) || a.version - b.version);
  }

  /** Die geltende (jüngste) Fassung je Artefakt. */
  async geltende(): Promise<Verhaltensartefakt[]> {
    return geltendeFassungen(await this.repo.alle());
  }

  async wirksameFuer(aufgabe: VerhaltensAufgabe): Promise<readonly Verhaltensartefakt[]> {
    return (await this.geltende()).filter(
      (a) => a.aufgabe === aufgabe && a.status === "freigegeben",
    );
  }

  /**
   * Legt ein neues Artefakt an oder die nächste Fassung eines vorhandenen. Felder, die eine neue
   * Fassung nicht nennt, übernimmt sie aus der geltenden. Ohne Status ist ein NEUES Artefakt ein
   * Entwurf — freigegeben wird ausdrücklich.
   */
  async fuehreFort(
    eingabe: VerhaltensartefaktEingabe,
    akteur: string,
  ): Promise<Verhaltensartefakt> {
    const geltende = await this.geltende();
    const schluessel = eingabe.schluessel?.trim();
    const vorgaenger = schluessel ? geltende.find((a) => a.schluessel === schluessel) : undefined;
    if (schluessel && !vorgaenger) {
      throw new VerhaltensFehler(`Unbekanntes Verhaltensartefakt „${schluessel}".`, "unbekannt");
    }
    const aufgabe = eingabe.aufgabe ?? vorgaenger?.aufgabe;
    const art = eingabe.art ?? vorgaenger?.art;
    const status = eingabe.status ?? vorgaenger?.status ?? "entwurf";
    const inhalt = (eingabe.inhalt ?? vorgaenger?.inhalt ?? "").trim();
    const herkunftRoh =
      eingabe.herkunftsfall === undefined ? vorgaenger?.herkunftsfall : eingabe.herkunftsfall;
    const herkunftsfall = herkunftRoh?.trim() ? herkunftRoh.trim() : null;
    if (!istEineVon(VERHALTENS_AUFGABEN, aufgabe)) {
      throw eingabeFehler(`Aufgabe muss eine von ${VERHALTENS_AUFGABEN.join(", ")} sein.`);
    }
    if (!istEineVon(VERHALTENS_ARTEN, art)) {
      throw eingabeFehler(`Art muss eine von ${VERHALTENS_ARTEN.join(", ")} sein.`);
    }
    if (!istEineVon(VERHALTENS_STATUS, status)) {
      throw eingabeFehler(`Status muss einer von ${VERHALTENS_STATUS.join(", ")} sein.`);
    }
    if (inhalt.length < VERHALTEN_INHALT_MIN || inhalt.length > VERHALTEN_INHALT_MAX) {
      throw new VerhaltensFehler(
        `Der Inhalt braucht ${VERHALTEN_INHALT_MIN}–${VERHALTEN_INHALT_MAX} Zeichen.`,
        "eingabe",
      );
    }
    if (herkunftsfall && herkunftsfall.length > VERHALTEN_HERKUNFT_MAX) {
      throw new VerhaltensFehler(
        `Der Herkunftsfall darf höchstens ${VERHALTEN_HERKUNFT_MAX} Zeichen haben.`,
        "eingabe",
      );
    }
    if (status === "freigegeben") {
      const andere = geltende.filter(
        (a) => a.aufgabe === aufgabe && a.status === "freigegeben" && a.schluessel !== schluessel,
      );
      if (andere.length >= VERHALTEN_MAX_WIRKSAM_JE_AUFGABE) {
        throw new VerhaltensFehler(
          `Für „${aufgabe}" sind schon ${VERHALTEN_MAX_WIRKSAM_JE_AUFGABE} Artefakte freigegeben.`,
          "voll",
        );
      }
    }
    const fassung: Verhaltensartefakt = {
      schluessel: vorgaenger?.schluessel ?? this.neueId(),
      version: (vorgaenger?.version ?? 0) + 1,
      aufgabe,
      art,
      inhalt,
      status,
      herkunftsfall,
      angelegtVon: akteur,
      angelegtAm: this.uhr(),
    };
    await this.repo.lege(fassung);
    return fassung;
  }
}

// ------------------------------------------------------------------------------------------------
// DER ZUSAMMENBAU — rein, deterministisch, ohne Modellbezug.
// ------------------------------------------------------------------------------------------------

interface BlockTexte {
  kopf: string;
  arten: Record<VerhaltensArt, string>;
}

const BLOCK_TEXTE: Record<ReasonerLocale, BlockTexte> = {
  de: {
    kopf: "Zusätzliche verbindliche Vorgaben dieser Instanz:",
    arten: { kontrakt: "Antwortvertrag", leitplanke: "Leitplanke", beispiel: "Beispiel" },
  },
  en: {
    kopf: "Additional binding rules of this instance:",
    arten: { kontrakt: "Answer contract", leitplanke: "Guardrail", beispiel: "Example" },
  },
  nl: {
    kopf: "Aanvullende bindende regels van deze instantie:",
    arten: { kontrakt: "Antwoordcontract", leitplanke: "Vangrail", beispiel: "Voorbeeld" },
  },
};

function nachSchluessel(a: Verhaltensartefakt, b: Verhaltensartefakt): number {
  return a.schluessel < b.schluessel ? -1 : a.schluessel > b.schluessel ? 1 : 0;
}

function nachArtUndSchluessel(a: Verhaltensartefakt, b: Verhaltensartefakt): number {
  const nachArt = VERHALTENS_ARTEN.indexOf(a.art) - VERHALTENS_ARTEN.indexOf(b.art);
  return nachArt !== 0 ? nachArt : nachSchluessel(a, b);
}

/**
 * Der Textblock einer Aufgabe aus ihren wirksamen Artefakten — Antwortverträge, dann Leitplanken,
 * dann Beispiele, je Art nach Schlüssel. Nicht freigegebene oder fremde Artefakte zählen nie. Ohne
 * wirksames Artefakt: leerer Text.
 */
export function verhaltensblock(
  aufgabe: VerhaltensAufgabe,
  artefakte: readonly Verhaltensartefakt[],
  locale: ReasonerLocale,
): string {
  const wirksam = artefakte
    .filter((a) => a.aufgabe === aufgabe && a.status === "freigegeben")
    .sort(nachArtUndSchluessel)
    .slice(0, VERHALTEN_MAX_WIRKSAM_JE_AUFGABE);
  if (wirksam.length === 0) {
    return "";
  }
  const texte = BLOCK_TEXTE[locale];
  const zeilen = wirksam.map((a) => `- ${texte.arten[a.art]}: ${a.inhalt}`);
  return [texte.kopf, ...zeilen].join("\n");
}

/** Hängt den Block hinter die eingebaute Anweisung; ohne Block bleibt sie unverändert. */
export function mitVerhalten(system: string, block: string): string {
  return block ? `${system}\n\n${block}` : system;
}
