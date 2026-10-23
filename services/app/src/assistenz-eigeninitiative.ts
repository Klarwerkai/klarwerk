// ================================================================================================
// produkt:20261008:klara-eigeninitiative — WANN SICH DIE ASSISTENZ MELDET, PERSÖNLICH JE KONTO.
// ================================================================================================
//
// Drei Modi, im vorhandenen Assistenzprofil des eigenen Kontos gespeichert (über Anmeldung, Neuladen
// und Geräte hinweg):
//   · `nachfrage`  — „Nur auf Nachfrage": die Assistenz meldet sich nie von selbst. Vorgabe.
//   · `hinweise`   — „Passende Hinweise anbieten": die Oberfläche leitet aus dem tatsächlichen
//                    Kontext einen Hinweis ab und BIETET Hilfe an; ein Hinweis führt selbst nichts aus.
//   · `auftraege`  — „Ausdrücklich übertragene Aufgaben": keine Hinweise; sichtbar geführt werden nur
//                    die Aufträge, die die Person selbst erteilt hat (Klara 05, eigene Rechte).
//
// Geschlossene und zurückgestellte Hinweise liegen ebenfalls hier — mit Ablaufzeit, damit derselbe
// Hinweis nicht sofort wieder erscheint, aber auch nicht für immer verschwindet. Gespeichert wird nur
// ein Schlüssel aus Art und Ort des Hinweises, kein Text, kein Inhalt eines Objekts.
//
// Die Kontokennung kommt AUSSCHLIESSLICH aus der Sitzung (Route); der Modus ändert weder Rolle noch
// Rechte, und er gibt keiner Aktion eine Erlaubnis, die sie ohne ihn nicht hätte.

export const EIGENINITIATIVE_MODI = ["nachfrage", "hinweise", "auftraege"] as const;

export type EigeninitiativeModus = (typeof EIGENINITIATIVE_MODI)[number];

/** Ohne Wahl bleibt die Assistenz still — niemand bekommt ungefragt Hinweise. */
export const STANDARD_MODUS: EigeninitiativeModus = "nachfrage";

export type HinweisAblageStand = "geschlossen" | "zurueckgestellt";

/** „Später": derselbe Hinweis kommt frühestens nach vier Stunden wieder. */
export const ZURUECKGESTELLT_MS = 4 * 60 * 60 * 1000;
/** „Nicht mehr anbieten": derselbe Hinweis ruht dreissig Tage. */
export const GESCHLOSSEN_MS = 30 * 24 * 60 * 60 * 1000;
/** So viele abgelegte Hinweise hält ein Konto höchstens; die ältesten fallen heraus. */
export const HINWEIS_ABLAGE_MAX = 100;

/** Art und Ort eines Hinweises, z. B. `tutorial:fragen` oder `ungeprueft:ko-123`. */
const SCHLUESSEL = /^[a-z][a-z0-9_-]{0,31}:[A-Za-z0-9_.:/-]{1,120}$/;

export interface HinweisAblage {
  readonly schluessel: string;
  readonly stand: HinweisAblageStand;
  readonly am: string;
  /** Bis dahin wird dieser Hinweis nicht erneut angeboten. */
  readonly bis: string;
}

export interface EigeninitiativeStand {
  readonly modus: EigeninitiativeModus;
  /** `null`: nie bewusst gewählt — es gilt die Vorgabe. */
  readonly geaendertAm: string | null;
  readonly hinweise: readonly HinweisAblage[];
}

export class EigeninitiativeFehler extends Error {
  constructor(
    readonly status: 400 | 409,
    message: string,
  ) {
    super(message);
    this.name = "EigeninitiativeFehler";
  }
}

export function istEigeninitiativeModus(wert: unknown): wert is EigeninitiativeModus {
  return typeof wert === "string" && (EIGENINITIATIVE_MODI as readonly string[]).includes(wert);
}

export function istHinweisSchluessel(wert: unknown): wert is string {
  return typeof wert === "string" && SCHLUESSEL.test(wert);
}

function leer(): EigeninitiativeStand {
  return { modus: STANDARD_MODUS, geaendertAm: null, hinweise: [] };
}

/** Nur was noch ruht — abgelaufene Ablagen zählen nicht mehr und werden beim Schreiben entfernt. */
function wirksam(hinweise: readonly HinweisAblage[], jetzt: number): HinweisAblage[] {
  return hinweise.filter((h) => Date.parse(h.bis) > jetzt);
}

export interface EigeninitiativeProfilPort {
  hole(kontoId: string): Promise<{ readonly eigeninitiative?: EigeninitiativeStand } | null>;
  schreibeEigeninitiative(
    kontoId: string,
    alt: EigeninitiativeStand | null,
    neu: EigeninitiativeStand,
  ): Promise<boolean>;
}

export interface EigeninitiativeDienstDeps {
  readonly repo: EigeninitiativeProfilPort;
  readonly jetzt?: () => number;
}

export class EigeninitiativeDienst {
  private readonly repo: EigeninitiativeProfilPort;
  private readonly jetzt: () => number;

  constructor(deps: EigeninitiativeDienstDeps) {
    this.repo = deps.repo;
    this.jetzt = deps.jetzt ?? Date.now;
  }

  /** Der eigene Stand — ohne gespeicherte Wahl die Vorgabe „Nur auf Nachfrage". */
  async lies(kontoId: string): Promise<EigeninitiativeStand> {
    const p = await this.repo.hole(kontoId);
    const s = p?.eigeninitiative ?? leer();
    return { ...s, hinweise: wirksam(s.hinweise, this.jetzt()) };
  }

  private async aendere(
    kontoId: string,
    f: (alt: EigeninitiativeStand, jetzt: number) => EigeninitiativeStand,
  ): Promise<EigeninitiativeStand> {
    for (let versuch = 0; versuch < 2; versuch++) {
      const alt = (await this.repo.hole(kontoId))?.eigeninitiative ?? null;
      const jetzt = this.jetzt();
      const neu = f(alt ?? leer(), jetzt);
      if (await this.repo.schreibeEigeninitiative(kontoId, alt, neu)) {
        return { ...neu, hinweise: wirksam(neu.hinweise, jetzt) };
      }
    }
    throw new EigeninitiativeFehler(409, "Die Einstellung wurde gleichzeitig geändert.");
  }

  /** Speichert den gewählten Modus. Abgelegte Hinweise bleiben abgelegt. */
  async setzeModus(kontoId: string, modus: unknown): Promise<EigeninitiativeStand> {
    if (!istEigeninitiativeModus(modus)) {
      throw new EigeninitiativeFehler(400, "modus muss nachfrage, hinweise oder auftraege sein.");
    }
    return this.aendere(kontoId, (alt, jetzt) => ({
      modus,
      geaendertAm: new Date(jetzt).toISOString(),
      hinweise: wirksam(alt.hinweise, jetzt),
    }));
  }

  /**
   * Schliesst einen Hinweis oder stellt ihn zurück. Derselbe Schlüssel ersetzt seine frühere Ablage;
   * es wird nichts ausgeführt und nichts am Objekt geändert.
   */
  async legeHinweisAb(
    kontoId: string,
    eingabe: { schluessel?: unknown; stand?: unknown },
  ): Promise<EigeninitiativeStand> {
    const { schluessel, stand } = eingabe;
    if (!istHinweisSchluessel(schluessel)) {
      throw new EigeninitiativeFehler(400, "schluessel ist kein gültiger Hinweisschlüssel.");
    }
    if (stand !== "geschlossen" && stand !== "zurueckgestellt") {
      throw new EigeninitiativeFehler(400, "stand muss geschlossen oder zurueckgestellt sein.");
    }
    return this.aendere(kontoId, (alt, jetzt) => {
      const dauer = stand === "geschlossen" ? GESCHLOSSEN_MS : ZURUECKGESTELLT_MS;
      const eintrag: HinweisAblage = {
        schluessel,
        stand,
        am: new Date(jetzt).toISOString(),
        bis: new Date(jetzt + dauer).toISOString(),
      };
      const uebrig = wirksam(alt.hinweise, jetzt).filter((h) => h.schluessel !== schluessel);
      return {
        modus: alt.modus,
        geaendertAm: alt.geaendertAm,
        hinweise: [...uebrig, eintrag].slice(-HINWEIS_ABLAGE_MAX),
      };
    });
  }
}
