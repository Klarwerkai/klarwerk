import type { AssistenzProfilRepo } from "./assistenz-profil";

// ================================================================================================
// produkt:20261012:klara-ocr-fundstellen-korrekturen (OCR-E02) — BERICHTIGTER BILDTEXT, JE KONTO.
// ================================================================================================
//
// Eine Berichtigung gehört zu GENAU einer Quelle und GENAU einer Bildfassung: `quelle` ist die
// Kennung der Fläche (z. B. `office:<anhang>`, `datei:<name>`), `inhaltskennung` der `sha256` der
// Bildbytes (dieselbe Form wie W16 und `apps/web/src/lib/bildAutomatik.ts`). Andere Bytes — auch
// ein verändertes Bild an derselben Stelle — tragen eine andere Kennung, und die Berichtigung gilt
// dort nicht. Ein erneutes Lesen derselben Bytes ändert die Berichtigung nicht: sie liegt hier,
// getrennt vom Rohbefund der Erkennung, der im Browser bleibt.
//
// Die Berichtigungen liegen im VORHANDENEN Assistenzprofil des Kontos (`assistenz_profile.data.
// bildKorrekturen`) — kein zweiter Speicher, keine neue Tabelle. Wie die Tastenkürzel gehört das
// Feld allein `schreibeBildKorrekturen`: ein Profilschreiben übernimmt den gespeicherten Stand und
// ändert die Profilfassung nicht.
//
// RECHTE: gelesen wird nur das eigene Konto (die Route kennt keine fremde Kennung); geschrieben wird
// nur mit `ko.create` — dieselbe Regel wie für das Bearbeiten von Entwürfen. Eine Betrachterin
// (`viewer`) kann nicht berichtigen. Bild und Datei werden hier nie gelesen oder geschrieben; ins
// Prüfprotokoll geht nur das Ereignis, nie der Text.

/** Höchstzahl gespeicherter Berichtigungen je Konto. */
export const BILD_KORREKTUR_HOECHSTZAHL = 300;
/** Höchstlänge eines berichtigten Textes (Zeichen). */
export const BILD_KORREKTUR_TEXT_MAX = 10_000;
/** So viele frühere Fassungen bleiben je Berichtigung für „Rückgängig“. */
export const BILD_KORREKTUR_SCHRITTE = 5;

const QUELLE_MAX = 300;
const KENNUNG = /^sha256:[0-9a-f]{64}$/;
const ORT = /^[a-z0-9-]{1,40}$/;

export interface BildKorrekturEintrag {
  readonly quelle: string;
  readonly inhaltskennung: string;
  /** Die Stelle des Bildes in der Quelle (nur zur Anzeige, z. B. `f2-b1`) — keine Bindung. */
  readonly ort: string | null;
  /** Der berichtigte Text. */
  readonly text: string;
  /** Frühere berichtigte Fassungen, die älteste zuerst — „Rückgängig“ nimmt die letzte. */
  readonly vorher: readonly string[];
  readonly geaendertAm: string;
}

export interface BildKorrekturStand {
  readonly eintraege: readonly BildKorrekturEintrag[];
}

export type BildKorrekturGrund =
  | "aktion"
  | "quelle"
  | "inhaltskennung"
  | "text"
  | "grenze"
  | "konflikt";

export class BildKorrekturFehler extends Error {
  constructor(
    readonly status: 400 | 409,
    readonly grund: BildKorrekturGrund,
    message: string,
  ) {
    super(message);
    this.name = "BildKorrekturFehler";
  }
}

/** Steuerzeichen außer Zeilenumbruch und Tabulator. */
function hatSteuerzeichen(text: string, zeilenErlaubt: boolean): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (zeilenErlaubt && (code === 0x0a || code === 0x0d || code === 0x09)) {
      continue;
    }
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }
  }
  return false;
}

function pruefeQuelle(roh: unknown): string {
  if (
    typeof roh !== "string" ||
    roh.length === 0 ||
    roh.length > QUELLE_MAX ||
    hatSteuerzeichen(roh, false)
  ) {
    throw new BildKorrekturFehler(400, "quelle", "quelle muss eine kurze Kennung der Quelle sein.");
  }
  return roh;
}

function pruefeKennung(roh: unknown): string {
  if (typeof roh !== "string" || !KENNUNG.test(roh)) {
    throw new BildKorrekturFehler(
      400,
      "inhaltskennung",
      "inhaltskennung muss sha256:<64 Hexzeichen> der Bildbytes sein.",
    );
  }
  return roh;
}

function pruefeText(roh: unknown): string {
  if (typeof roh !== "string") {
    throw new BildKorrekturFehler(400, "text", "text ist Pflicht.");
  }
  const text = roh.normalize("NFC");
  if (text.length > BILD_KORREKTUR_TEXT_MAX) {
    throw new BildKorrekturFehler(
      400,
      "text",
      `Der berichtigte Text ist höchstens ${BILD_KORREKTUR_TEXT_MAX} Zeichen lang.`,
    );
  }
  if (hatSteuerzeichen(text, true)) {
    throw new BildKorrekturFehler(400, "text", "Der Text enthält Steuerzeichen.");
  }
  return text;
}

function leer(): BildKorrekturStand {
  return { eintraege: [] };
}

export interface BildKorrekturDienstDeps {
  readonly repo: AssistenzProfilRepo;
  readonly jetzt?: () => number;
}

export class BildKorrekturDienst {
  private readonly repo: AssistenzProfilRepo;
  private readonly jetzt: () => number;

  constructor(deps: BildKorrekturDienstDeps) {
    this.repo = deps.repo;
    this.jetzt = deps.jetzt ?? Date.now;
  }

  /** Die eigenen Berichtigungen — ohne gespeicherte keine. */
  async lies(kontoId: string): Promise<BildKorrekturStand> {
    const p = await this.repo.hole(kontoId);
    return p?.bildKorrekturen ?? leer();
  }

  /**
   * `aktion`:
   *   · `setzen` — `text` wird die Berichtigung; eine vorhandene wandert in `vorher`.
   *   · `rueckgaengig` — die letzte frühere Fassung wird wieder wirksam; gibt es keine, gilt wieder
   *     der Rohbefund (die Berichtigung entfällt).
   *   · `zuruecksetzen` — die Berichtigung entfällt ganz; es gilt der Rohbefund der Erkennung.
   * Gleichzeitige Änderungen werden einmal neu versucht, danach 409.
   */
  async aendere(kontoId: string, eingabe: Record<string, unknown>): Promise<BildKorrekturStand> {
    const aktion = eingabe.aktion;
    if (aktion !== "setzen" && aktion !== "rueckgaengig" && aktion !== "zuruecksetzen") {
      throw new BildKorrekturFehler(
        400,
        "aktion",
        "aktion muss setzen, rueckgaengig oder zuruecksetzen sein.",
      );
    }
    const quelle = pruefeQuelle(eingabe.quelle);
    const inhaltskennung = pruefeKennung(eingabe.inhaltskennung);
    const text = aktion === "setzen" ? pruefeText(eingabe.text) : "";
    const ort =
      aktion === "setzen" && typeof eingabe.ort === "string" && ORT.test(eingabe.ort)
        ? eingabe.ort
        : null;
    for (let versuch = 0; versuch < 2; versuch++) {
      const alt = (await this.repo.hole(kontoId))?.bildKorrekturen ?? null;
      const stand = alt ?? leer();
      const index = stand.eintraege.findIndex(
        (e) => e.quelle === quelle && e.inhaltskennung === inhaltskennung,
      );
      const bisher = index >= 0 ? stand.eintraege[index] : undefined;
      const uebrige = stand.eintraege.filter((_, i) => i !== index);
      const stempel = new Date(this.jetzt()).toISOString();
      let neu: BildKorrekturStand;
      if (aktion === "setzen") {
        if (bisher && bisher.text === text) {
          return stand;
        }
        if (!bisher && uebrige.length >= BILD_KORREKTUR_HOECHSTZAHL) {
          throw new BildKorrekturFehler(
            400,
            "grenze",
            `Es sind höchstens ${BILD_KORREKTUR_HOECHSTZAHL} Berichtigungen gespeichert. Bitte nicht mehr benötigte zurücksetzen.`,
          );
        }
        const eintrag: BildKorrekturEintrag = {
          quelle,
          inhaltskennung,
          ort: ort ?? bisher?.ort ?? null,
          text,
          vorher: bisher ? [...bisher.vorher, bisher.text].slice(-BILD_KORREKTUR_SCHRITTE) : [],
          geaendertAm: stempel,
        };
        neu = { eintraege: [...uebrige, eintrag] };
      } else if (!bisher) {
        return stand;
      } else if (aktion === "rueckgaengig" && bisher.vorher.length > 0) {
        const vorher = bisher.vorher.slice(0, -1);
        const eintrag: BildKorrekturEintrag = {
          ...bisher,
          text: bisher.vorher[bisher.vorher.length - 1] ?? "",
          vorher,
          geaendertAm: stempel,
        };
        neu = { eintraege: [...uebrige, eintrag] };
      } else {
        neu = { eintraege: uebrige };
      }
      if (await this.repo.schreibeBildKorrekturen(kontoId, alt, neu)) {
        return neu;
      }
    }
    throw new BildKorrekturFehler(
      409,
      "konflikt",
      "Die Berichtigungen wurden gleichzeitig geändert.",
    );
  }
}
