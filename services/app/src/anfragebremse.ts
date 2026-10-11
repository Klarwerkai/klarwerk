// Aufnahme gesamt-integrations-api (R-0698 / R-0842): EINE Zählstelle für die Zugriffsbremsen der
// Dienst-Schlüssel (je Schlüssel) und der KI-Anfragen angemeldeter Nutzer (je Konto).
//
// Gleitendes Fenster je Kennung. Anders als die Fehlversuchsdrossel (`addon-auth-throttle.ts`), die
// pauschal das ganze Fenster als Wartezeit nennt, sagt diese Bremse die TATSÄCHLICHE Wartezeit: bis
// der älteste gezählte Aufruf aus dem Fenster fällt. Genau diese Zahl geht als `Retry-After` und im
// Satz an den Anfragenden — wer sie abwartet, kommt durch.
//
// Abgewiesene Aufrufe zählen NICHT mit: sonst verlängerte jeder zu frühe Neuversuch die eigene Sperre,
// und die genannte Wartezeit wäre beim nächsten Versuch schon wieder falsch.
//
// In-Memory je Prozess. Bei mehreren Instanzen hinter einem Verteiler gilt die Grenze je Instanz —
// für den heutigen Ein-Instanz-Betrieb ist das die Grenze; ein gemeinsamer Zähler wäre ein eigener
// Ausbau (s. docs/architektur/integrations-schnittstelle.md, „Grenzen").

// Die Sätze der beiden Bremsen — dreisprachig, mit der Wartezeit in Sekunden. Bewusst hier und
// nicht im Meldungskatalog von services/auth (dessen Schlüssel sind an Wurf- und Routenstellen
// unter services/auth gebunden, tests/q9-serverfehlertexte/).
const BREMS_SAETZE = {
  ki: {
    de: "Sie haben in kurzer Zeit sehr viele KI-Anfragen gestellt. Bitte warten Sie %s Sekunden und versuchen Sie es dann erneut.",
    en: "You have made a lot of AI requests in a short time. Please wait %s seconds and then try again.",
    nl: "Je hebt in korte tijd erg veel AI-verzoeken gedaan. Wacht %s seconden en probeer het dan opnieuw.",
  },
  dienst: {
    de: "Dieser Dienst-Schlüssel hat seine Anfragegrenze erreicht. Erneut möglich in %s Sekunden.",
    en: "This service key has reached its request limit. Try again in %s seconds.",
    nl: "Deze dienstsleutel heeft zijn aanvraaglimiet bereikt. Opnieuw mogelijk over %s seconden.",
  },
} as const;

export function bremsSatz(
  art: keyof typeof BREMS_SAETZE,
  sprache: "de" | "en" | "nl",
  wartenSek: number,
): string {
  return BREMS_SAETZE[art][sprache].replace("%s", String(wartenSek));
}

export interface BremsGrenze {
  /** Höchstzahl Aufrufe je Fenster. */
  readonly max: number;
  readonly fensterMs: number;
}

export type BremsUrteil =
  | { readonly erlaubt: true }
  | { readonly erlaubt: false; readonly wartenSek: number };

export class Anfragebremse {
  private readonly treffer = new Map<string, number[]>();
  private letzteAufraeumung: number | undefined;
  // Das längste je gesehene Fenster — die Aufräumung darf keine Kennung verwerfen, deren eigenes
  // (längeres) Fenster noch läuft.
  private laengstesFensterMs = 0;

  // Zählt einen Aufruf für `kennung`, sofern er unter der Grenze liegt.
  zaehle(kennung: string, grenze: BremsGrenze, jetzt: number): BremsUrteil {
    this.laengstesFensterMs = Math.max(this.laengstesFensterMs, grenze.fensterMs);
    if (
      this.letzteAufraeumung === undefined ||
      jetzt - this.letzteAufraeumung >= this.laengstesFensterMs
    ) {
      this.raeumeAuf(jetzt);
    }
    const imFenster = (this.treffer.get(kennung) ?? []).filter((t) => jetzt - t < grenze.fensterMs);
    if (imFenster.length >= grenze.max) {
      this.treffer.set(kennung, imFenster);
      const aeltester = imFenster[0] ?? jetzt;
      const wartenMs = aeltester + grenze.fensterMs - jetzt;
      return { erlaubt: false, wartenSek: Math.max(1, Math.ceil(wartenMs / 1000)) };
    }
    imFenster.push(jetzt);
    this.treffer.set(kennung, imFenster);
    return { erlaubt: true };
  }

  /** Wie viele Kennungen gerade im Speicher liegen. Nur Auskunft (Tests). */
  get size(): number {
    return this.treffer.size;
  }

  private raeumeAuf(jetzt: number): void {
    this.letzteAufraeumung = jetzt;
    for (const [kennung, zeiten] of this.treffer) {
      if (!zeiten.some((t) => jetzt - t < this.laengstesFensterMs)) {
        this.treffer.delete(kennung);
      }
    }
  }
}
