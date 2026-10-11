import { createHash } from "node:crypto";
import { type OidcProvider, codeChallengeS256, randomToken } from "../../auth";

// ================================================================================================
// PETER-20261011-P08 · AC05 — DIE ZWEIMALIGE, PASSENDE SSO-WIEDERANMELDUNG FÜR DEN FIRMENRESET.
// ================================================================================================
//
// Ein Konto ohne lokales Passwort (reines SSO) kann sich nicht per Passwort bestätigen. Peters
// Entscheidung verlangt dafür eine „passende zweimalige SSO-Wiederanmeldung". Dieser Baustein trägt
// sie, und zwar AUSSCHLIESSLICH für den Firmenreset:
//
//   · ZWEI getrennte Rundreisen zum Anbieter, jede mit eigenem `state`, `nonce` und PKCE-Verifier,
//     in fester Reihenfolge (Schritt 2 erst nach bestätigtem Schritt 1). Der Anbieter wird mit
//     `prompt=login` und `max_age=0` zur erneuten Anmeldung aufgefordert.
//   · PASSEND heisst: das verifizierte ID-Token nennt GENAU die Identität (Aussteller, Subjekt), mit
//     der dieses Konto verknüpft ist. Meldet der Anbieter ein anderes Konto an, verfällt die ganze
//     Bestätigung.
//   · GEBUNDEN an Konto UND Sitzung: der Rückruf zählt nur in der Sitzung, die den Schritt begonnen
//     hat (gemerkt wird der Hash des Sitzungsmerkmals, nie das Merkmal selbst).
//   · KURZLEBIG und EINMALIG: Vorgänge und Bestätigung gelten fünf Minuten ab Schritt 1; die
//     Ausführung des Resets löst die Bestätigung ein — gelingt der Reset danach nicht, muss neu
//     bestätigt werden.
//   · KEINE neue Sitzung: anders als die Anmeldung legt der Rückruf hier kein Konto an und gibt kein
//     Sitzungsmerkmal aus. Er setzt nur die Bestätigung.
//
// Bewusst NICHT wiederverwendet: die Profil-Bestätigung (R-0582, `services/auth/src/routes.ts`).
// Sie ist eine private Ablage der Auth-Routen, gilt EINMAL für eine E-Mail-Berichtigung und läuft
// über den Anmelderückruf, der eine neue Sitzung ausgibt. Wiederverwendet sind ihre Bausteine aus
// der öffentlichen Schnittstelle des Auth-Moduls: `authorizeUrl`, `exchange`, `verify`, PKCE.

/** Erkennungsmerkmal des `state` — die Rückrufseite reicht solche Rückrufe hierher statt zur Anmeldung. */
export const FIRMENRESET_SSO_PRAEFIX = "firmenreset.";
export const FIRMENRESET_SSO_GUELTIG_MS = 5 * 60 * 1000;

export type SsoSchritt = 1 | 2;

export type FirmenresetSsoFehlerCode =
  | "SSO_NICHT_EINGERICHTET"
  | "SSO_SCHRITT_UNGUELTIG"
  | "SSO_VORGANG_UNBEKANNT"
  | "SSO_ANMELDUNG_FEHLGESCHLAGEN"
  | "SSO_KONTO_PASST_NICHT";

export class FirmenresetSsoFehler extends Error {
  constructor(
    readonly code: FirmenresetSsoFehlerCode,
    message: string,
  ) {
    super(message);
    this.name = "FirmenresetSsoFehler";
  }
}

/** Die SSO-Identität, mit der das Konto verknüpft ist. */
export interface SsoIdentitaet {
  oidcIssuer?: string | undefined;
  oidcSubject?: string | undefined;
}

interface Vorgang {
  userId: string;
  sitzung: string;
  schritt: SsoSchritt;
  nonce: string;
  verifier: string;
  bis: number;
}

interface Bestaetigung {
  userId: string;
  schritte: number;
  bis: number;
}

export function sitzungsSchluessel(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class FirmenresetSso {
  private readonly vorgaenge = new Map<string, Vorgang>();
  private readonly bestaetigungen = new Map<string, Bestaetigung>();

  constructor(
    private readonly anbieter: OidcProvider | undefined,
    private readonly jetzt: () => number = Date.now,
  ) {}

  get eingerichtet(): boolean {
    return this.anbieter !== undefined;
  }

  /** Wie viele Schritte (0–2) für dieses Konto in dieser Sitzung gültig bestätigt sind. */
  bestaetigt(userId: string, sitzung: string): number {
    const b = this.bestaetigungen.get(sitzung);
    if (!b || b.userId !== userId || b.bis <= this.jetzt()) {
      return 0;
    }
    return b.schritte;
  }

  /** Beginnt Schritt 1 oder 2 und liefert die Anmeldeadresse beim Anbieter. */
  starte(userId: string, sitzung: string, schritt: SsoSchritt): string {
    if (!this.anbieter) {
      throw new FirmenresetSsoFehler(
        "SSO_NICHT_EINGERICHTET",
        "In dieser Installation ist keine SSO-Anmeldung eingerichtet. Es wurde nichts gelöscht.",
      );
    }
    if (schritt !== this.bestaetigt(userId, sitzung) + 1) {
      throw new FirmenresetSsoFehler(
        "SSO_SCHRITT_UNGUELTIG",
        "Die SSO-Wiederanmeldungen laufen nacheinander: erst die erste, dann die zweite.",
      );
    }
    this.aufraeumen();
    const state = `${FIRMENRESET_SSO_PRAEFIX}${randomToken()}`;
    const nonce = randomToken();
    const verifier = randomToken();
    this.vorgaenge.set(state, {
      userId,
      sitzung,
      schritt,
      nonce,
      verifier,
      bis: this.jetzt() + FIRMENRESET_SSO_GUELTIG_MS,
    });
    const ziel = new URL(
      this.anbieter.authorizeUrl({ state, nonce, codeChallenge: codeChallengeS256(verifier) }),
    );
    // Eine WIEDERanmeldung, kein stilles Durchwinken über eine bestehende Anbietersitzung.
    ziel.searchParams.set("prompt", "login");
    ziel.searchParams.set("max_age", "0");
    return ziel.toString();
  }

  /**
   * Der Rückruf eines Schritts. Liefert die Zahl der jetzt bestätigten Schritte. Jeder Fehlschlag
   * wirft und setzt KEINE Bestätigung; ein fremdes Konto beim Anbieter verwirft auch Schritt 1.
   */
  async rueckruf(
    userId: string,
    sitzung: string,
    konto: SsoIdentitaet,
    code: string,
    state: string,
  ): Promise<number> {
    const vorgang = this.vorgaenge.get(state);
    // Einmalig: ein Rückruf verbraucht seinen Vorgang, ob er gelingt oder nicht.
    this.vorgaenge.delete(state);
    if (
      !vorgang ||
      vorgang.bis <= this.jetzt() ||
      vorgang.userId !== userId ||
      vorgang.sitzung !== sitzung
    ) {
      throw new FirmenresetSsoFehler(
        "SSO_VORGANG_UNBEKANNT",
        "Diese SSO-Wiederanmeldung gehört nicht zu einem offenen Firmenreset dieser Sitzung. Es wurde nichts bestätigt.",
      );
    }
    if (!this.anbieter) {
      throw new FirmenresetSsoFehler(
        "SSO_NICHT_EINGERICHTET",
        "In dieser Installation ist keine SSO-Anmeldung eingerichtet. Es wurde nichts gelöscht.",
      );
    }
    let iss: string;
    let sub: string;
    try {
      const idToken = await this.anbieter.exchange(code, vorgang.verifier);
      const claims = await this.anbieter.verify(idToken, vorgang.nonce);
      iss = claims.iss;
      sub = claims.sub;
    } catch {
      throw new FirmenresetSsoFehler(
        "SSO_ANMELDUNG_FEHLGESCHLAGEN",
        "Die SSO-Wiederanmeldung ist fehlgeschlagen. Es wurde nichts bestätigt und nichts gelöscht.",
      );
    }
    if (!konto.oidcIssuer || iss !== konto.oidcIssuer || sub !== konto.oidcSubject) {
      this.verwerfen(sitzung);
      throw new FirmenresetSsoFehler(
        "SSO_KONTO_PASST_NICHT",
        "Beim Anbieter wurde ein anderes Konto angemeldet. Die Bestätigung ist verworfen; es wurde nichts gelöscht.",
      );
    }
    const bisher = this.bestaetigt(userId, sitzung);
    if (vorgang.schritt !== bisher + 1) {
      throw new FirmenresetSsoFehler(
        "SSO_SCHRITT_UNGUELTIG",
        "Die SSO-Wiederanmeldungen laufen nacheinander: erst die erste, dann die zweite.",
      );
    }
    const vorher = this.bestaetigungen.get(sitzung);
    this.bestaetigungen.set(sitzung, {
      userId,
      schritte: bisher + 1,
      // Beide Schritte innerhalb DERSELBEN Frist ab Schritt 1.
      bis: bisher === 0 || !vorher ? this.jetzt() + FIRMENRESET_SSO_GUELTIG_MS : vorher.bis,
    });
    return bisher + 1;
  }

  /** Abbruch: offene Vorgänge und Bestätigung dieser Sitzung verfallen. */
  verwerfen(sitzung: string): void {
    this.bestaetigungen.delete(sitzung);
    for (const [state, v] of this.vorgaenge) {
      if (v.sitzung === sitzung) {
        this.vorgaenge.delete(state);
      }
    }
  }

  /** Löst die Bestätigung für die Ausführung ein: wahr nur bei zwei gültigen Schritten. Immer einmalig. */
  einloesen(userId: string, sitzung: string): boolean {
    const vollstaendig = this.bestaetigt(userId, sitzung) >= 2;
    this.verwerfen(sitzung);
    return vollstaendig;
  }

  private aufraeumen(): void {
    const jetzt = this.jetzt();
    for (const [state, v] of this.vorgaenge) {
      if (v.bis <= jetzt) {
        this.vorgaenge.delete(state);
      }
    }
    for (const [sitzung, b] of this.bestaetigungen) {
      if (b.bis <= jetzt) {
        this.bestaetigungen.delete(sitzung);
      }
    }
  }
}
