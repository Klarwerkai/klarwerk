// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-umsetzung (AA-03) — TASTENKÜRZEL FÜR KLARA, JE KONTO.
// ================================================================================================
//
// Die eigenen Belegungen liegen im VORHANDENEN Assistenzprofil des Kontos (`assistenz_profile.data.
// tastenkuerzel`) — kein zweiter Speicher, keine neue Tabelle. Wie die Eigeninitiative gehört das
// Feld allein `schreibeTastenkuerzel`: ein Profilschreiben übernimmt den gespeicherten Stand, und
// ein Kürzelwechsel ändert die Profilfassung nicht.
//
// Gespeichert wird die PHYSISCHE Taste (`KeyboardEvent.code`) samt Modifikatoren — so bleibt die
// Belegung bei deutschem und englischem Layout dieselbe Taste. `taste` ist nur die Beschriftung,
// die die Person bei der Aufnahme gesehen hat.
//
// Geltungsbereich (Peters Wahl „Option 1“, 12.10.2026): innerhalb des aktiven Klarwerk-Fensters.
// J ergänzt nur die bewusst belegte Aktion „suchen“ im vorhandenen Mac-Begleiter; der Server
// verwaltet weiterhin dieselbe Kontoablage und registriert selbst keine systemweiten Kürzel.
//
// STANDARD: jede Aktion ist ab Werk UNBELEGT. Control+Command+K ist nur ein ungeprüfter Kandidat und
// kollidiert in der Web-App mit der Befehlspalette (⌘K/Strg+K, `CommandPalette.tsx`); eine als frei
// garantierte Vorgabe gibt es nicht. „Zurücksetzen“ stellt deshalb „unbelegt“ wieder her.
//
// Der Server prüft Form, Modifikatorregel und Doppelbelegung. Die Liste der vom Browser, von macOS
// oder VoiceOver belegten Kombinationen kennt die Oberfläche (`apps/web/src/lib/klaraTastenkuerzel.ts`).

/** Die vorhandenen Klara-Aktionen, die ein Kürzel auslösen darf (Bestand AA-01 plus Diktat/Aufnahme). */
export const KLARA_KUERZEL_AKTIONEN = [
  "oeffnen",
  "seitenhilfe",
  "diktieren",
  "auftragSprechen",
  "aufnahmeStoppen",
  "vorlesenStoppen",
  "suchen",
] as const;

export type KlaraKuerzelAktion = (typeof KLARA_KUERZEL_AKTIONEN)[number];

export interface KuerzelKombination {
  /** `KeyboardEvent.code`: `KeyA`–`KeyZ`, `Digit0`–`Digit9`, `F1`–`F12`. */
  readonly code: string;
  /** Die Beschriftung der Taste bei der Aufnahme (z. B. „Y“ auf deutschem Layout für `KeyZ`). */
  readonly taste: string;
  readonly strg: boolean;
  readonly alt: boolean;
  readonly umschalt: boolean;
  readonly meta: boolean;
}

export interface TastenkuerzelStand {
  /** Fehlt eine Aktion, gilt ihr Standard (unbelegt); `null` heisst: bewusst entfernt. */
  readonly belegungen: Readonly<Partial<Record<KlaraKuerzelAktion, KuerzelKombination | null>>>;
  readonly geaendertAm: string | null;
}

/** Die definierten Standards — ab Werk ist keine Aktion belegt. */
export const STANDARD_BELEGUNG: Readonly<Record<KlaraKuerzelAktion, KuerzelKombination | null>> = {
  oeffnen: null,
  seitenhilfe: null,
  diktieren: null,
  auftragSprechen: null,
  aufnahmeStoppen: null,
  vorlesenStoppen: null,
  suchen: null,
};

const CODE = /^(Key[A-Z]|Digit[0-9]|F([1-9]|1[0-2]))$/;
const TASTE_MAX = 12;

export type TastenkuerzelGrund = "aktion" | "kombination" | "modifikator" | "doppelt" | "konflikt";

export class TastenkuerzelFehler extends Error {
  constructor(
    readonly status: 400 | 409,
    readonly grund: TastenkuerzelGrund,
    message: string,
    /** Bei `doppelt`: die Aktion, die diese Kombination schon trägt. */
    readonly belegtVon?: KlaraKuerzelAktion,
  ) {
    super(message);
    this.name = "TastenkuerzelFehler";
  }
}

export function istKuerzelAktion(wert: unknown): wert is KlaraKuerzelAktion {
  return typeof wert === "string" && (KLARA_KUERZEL_AKTIONEN as readonly string[]).includes(wert);
}

function istSteuerzeichen(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
}

/** Prüft Form und Modifikatorregel einer Kombination; wirft sonst 400. */
export function pruefeKombination(roh: unknown): KuerzelKombination {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    throw new TastenkuerzelFehler(400, "kombination", "kombination muss ein Objekt sein.");
  }
  const k = roh as Record<string, unknown>;
  if (typeof k.code !== "string" || !CODE.test(k.code)) {
    throw new TastenkuerzelFehler(
      400,
      "kombination",
      "Unterstützt sind Buchstaben, Ziffern und F1–F12.",
    );
  }
  const taste = typeof k.taste === "string" ? k.taste.normalize("NFC").trim() : "";
  if (
    taste.length === 0 ||
    [...taste].length > TASTE_MAX ||
    [...taste].some((z) => istSteuerzeichen(z.charCodeAt(0)))
  ) {
    throw new TastenkuerzelFehler(400, "kombination", "taste muss eine kurze Beschriftung sein.");
  }
  for (const feld of ["strg", "alt", "umschalt", "meta"] as const) {
    if (typeof k[feld] !== "boolean") {
      throw new TastenkuerzelFehler(400, "kombination", `${feld} muss true oder false sein.`);
    }
  }
  const kombi: KuerzelKombination = {
    code: k.code,
    taste,
    strg: k.strg as boolean,
    alt: k.alt as boolean,
    umschalt: k.umschalt as boolean,
    meta: k.meta as boolean,
  };
  // Ohne Befehls-/Steuerungstaste wäre jede Kombination normales Schreiben; Control+Option ist die
  // VoiceOver-Taste (macOS) bzw. AltGr (Windows, z. B. „@“) — beides nie ein Klara-Kürzel.
  if (!kombi.strg && !kombi.meta) {
    throw new TastenkuerzelFehler(
      400,
      "modifikator",
      "Ein Kürzel braucht die Befehls- oder Steuerungstaste.",
    );
  }
  if (kombi.strg && kombi.alt) {
    throw new TastenkuerzelFehler(
      400,
      "modifikator",
      "Control zusammen mit Option/Alt ist VoiceOver bzw. AltGr vorbehalten.",
    );
  }
  return kombi;
}

export function gleicheKombination(a: KuerzelKombination, b: KuerzelKombination): boolean {
  return (
    a.code === b.code &&
    a.strg === b.strg &&
    a.alt === b.alt &&
    a.umschalt === b.umschalt &&
    a.meta === b.meta
  );
}

/** Die wirksame Belegung einer Aktion: die eigene, sonst der Standard. */
export function wirksameBelegung(
  s: TastenkuerzelStand,
  aktion: KlaraKuerzelAktion,
): KuerzelKombination | null {
  const eigen = s.belegungen[aktion];
  return eigen === undefined ? STANDARD_BELEGUNG[aktion] : eigen;
}

function leer(): TastenkuerzelStand {
  return { belegungen: {}, geaendertAm: null };
}

/** Was eine Änderung tun soll: belegen, entfernen, eine Aktion oder alle auf Standard setzen. */
export type TastenkuerzelAenderung =
  | { readonly aktion: unknown; readonly belegung: unknown }
  | { readonly alleZuruecksetzen: true };

export interface TastenkuerzelProfilPort {
  hole(kontoId: string): Promise<{ readonly tastenkuerzel?: TastenkuerzelStand } | null>;
  schreibeTastenkuerzel(
    kontoId: string,
    alt: TastenkuerzelStand | null,
    neu: TastenkuerzelStand,
  ): Promise<boolean>;
}

export interface TastenkuerzelDienstDeps {
  readonly repo: TastenkuerzelProfilPort;
  readonly jetzt?: () => number;
}

export class TastenkuerzelDienst {
  private readonly repo: TastenkuerzelProfilPort;
  private readonly jetzt: () => number;

  constructor(deps: TastenkuerzelDienstDeps) {
    this.repo = deps.repo;
    this.jetzt = deps.jetzt ?? Date.now;
  }

  /** Der eigene Stand — ohne gespeicherte Änderung die Standards (alles unbelegt). */
  async lies(kontoId: string): Promise<TastenkuerzelStand> {
    const p = await this.repo.hole(kontoId);
    return p?.tastenkuerzel ?? leer();
  }

  /**
   * Ändert genau eine Belegung (`belegung`: Kombination, `null` = entfernen, `"standard"` = auf den
   * Standard zurück) oder setzt alle zurück. Eine Kombination, die eine ANDERE Aktion schon trägt,
   * wird mit 409 abgewiesen; der gespeicherte Stand bleibt dann unverändert.
   */
  async aendere(kontoId: string, eingabe: Record<string, unknown>): Promise<TastenkuerzelStand> {
    const alleZuruecksetzen = eingabe.alleZuruecksetzen === true;
    let aktion: KlaraKuerzelAktion | null = null;
    let belegung: KuerzelKombination | null | "standard" = "standard";
    if (!alleZuruecksetzen) {
      if (!istKuerzelAktion(eingabe.aktion)) {
        throw new TastenkuerzelFehler(400, "aktion", "aktion ist keine unterstützte Klara-Aktion.");
      }
      aktion = eingabe.aktion;
      if (eingabe.belegung === null || eingabe.belegung === "standard") {
        belegung = eingabe.belegung;
      } else {
        belegung = pruefeKombination(eingabe.belegung);
      }
    }
    for (let versuch = 0; versuch < 2; versuch++) {
      const alt = (await this.repo.hole(kontoId))?.tastenkuerzel ?? null;
      const stand = alt ?? leer();
      const stempel = new Date(this.jetzt()).toISOString();
      let neu: TastenkuerzelStand;
      if (alleZuruecksetzen || aktion === null) {
        neu = { belegungen: {}, geaendertAm: stempel };
      } else {
        const ziel = belegung === "standard" ? STANDARD_BELEGUNG[aktion] : belegung;
        if (ziel) {
          const belegtVon = KLARA_KUERZEL_AKTIONEN.find((a) => {
            const w = a === aktion ? null : wirksameBelegung(stand, a);
            return w !== null && gleicheKombination(w, ziel);
          });
          if (belegtVon) {
            throw new TastenkuerzelFehler(
              409,
              "doppelt",
              "Diese Kombination ist schon einer anderen Klara-Aktion zugeordnet.",
              belegtVon,
            );
          }
        }
        const belegungen: Partial<Record<KlaraKuerzelAktion, KuerzelKombination | null>> = {};
        for (const a of KLARA_KUERZEL_AKTIONEN) {
          const bisher = stand.belegungen[a];
          if (a !== aktion && bisher !== undefined) {
            belegungen[a] = bisher;
          }
        }
        if (belegung !== "standard") {
          belegungen[aktion] = belegung;
        }
        neu = { belegungen, geaendertAm: stempel };
      }
      if (await this.repo.schreibeTastenkuerzel(kontoId, alt, neu)) {
        return neu;
      }
    }
    throw new TastenkuerzelFehler(409, "konflikt", "Die Kürzel wurden gleichzeitig geändert.");
  }
}
