// ================================================================================================
// JOB 3420 (UX-10b) — EINE ABLEITUNG VOM PRÜFERGEBNIS ZUM RAT, UND NUR EINE.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT: Sechs Stellen der KI-Karte schickten ihr Scheitern durch
// EINEN Textschlüssel (`adm.ai.testFail`), an dem fest der Satz „Tipp: Schlüssel … Account
// ANTHROPIC_API_KEY … erneuern" hing. Er stand auch da, wenn ChatGPT geprüft wurde, wenn der eigene
// lokale LLM geprüft wurde, und wenn die Anfrage an KLARWERK selbst gar nicht durchkam. Ein
// Ratschlag ohne Grundlage.
//
// WARUM HIER NICHT AUS `detail` GERATEN WIRD (Codex-Lehre JOB 3210 R1, 07.09.): `detail` ist die
// ROHMELDUNG des Anbieters bzw. der Laufzeit — unübersetzt, unstabil, in fremder Hand. Wer daraus
// per Textmuster eine Ursache liest, behauptet eine Messung, die er nicht hat: eine geänderte
// Formulierung beim Anbieter kippt die Auskunft still, ohne dass ein Test rot wird. Gelesen werden
// deshalb AUSSCHLIESSLICH die Felder, die der Server wirklich klassifiziert hat — `ok`,
// `fehlerklasse`, `status`, `anbieterGrund`, `anbieter` — und `detail` kein einziges Mal.
//
// EIN UNBENANNTER HTTP-STATUS (etwa 404, 402) fällt bewusst auf „unbestimmt" und nicht auf einen
// benachbarten Fall. Ihn zu „nicht erreichbar" zu machen wäre genau der Fehler, den
// `services/reasoner/src/model-errors.ts:130-132` für „unknown" ausdrücklich verbietet: eine
// Ursache behaupten, für die kein Beleg vorliegt. Die Rohmeldung steht im Rahmen darüber und nennt
// den Status wörtlich.
import type { ReasonerProbeResult } from "../api/types";

/** Die Lagen, die die Karte unterscheidet. Jede trägt einen eigenen Satz in de, en und nl. */
export type KiTestFall =
  | "zugang"
  | "kontingent"
  | "abgelehnt"
  | "nichtErreichbar"
  | "zeitlimit"
  | "unbrauchbar"
  | "unbestimmt"
  | "anfrage";

/** Welcher der drei Prüfwege gescheitert ist — der lokale bekommt NIE einen Cloud-Schlüsseltipp. */
export type KiTestArt = "cloud" | "local" | "selftest";

export interface KiTestBefund {
  readonly fall: KiTestFall;
  /** i18n-Schlüssel der Ursache. */
  readonly ursacheKey: string;
  readonly ursacheWerte: Readonly<Record<string, string | number>>;
  /**
   * i18n-Schlüssel des nächsten Schritts — `null`, wenn keiner belegt ist. Bewusst OHNE
   * Einsetzungswerte: der einzige Rat, der je einen trug (der Kontoname), wählt seit dem
   * Egress-Befund unten einen eigenen Schlüssel je Anbieter statt einer Einsetzung.
   */
  readonly ratKey: string | null;
  /** Die WÖRTLICHE Begründung des Anbieters; `null`, wenn er keine mitgeschickt hat. */
  readonly anbieterGrund: string | null;
  /** Kann ein erneuter, unveränderter Versuch ein anderes Ergebnis liefern? */
  readonly wiederholbar: boolean;
}

/**
 * WO DER KONTONAME STEHT — und warum NICHT hier als Zeichenkette.
 *
 * Die Zuordnung „geprüfter Anbieter → welcher Schlüsseltipp" liegt hier (unten, Fall (a)): sie ist
 * die eine Stelle, die verhindert, dass die Karte wieder fest `ANTHROPIC_API_KEY` sagt, während
 * ChatGPT geprüft wurde. Der NAME des Kontos steht dagegen im i18n-Text
 * (`adm.ai.rat.zugangKonto.openai` / `.anthropic`) und nicht als Literal in dieser Datei.
 *
 * Das ist keine Stilfrage, sondern eine Hausregel, an der ich hier gemessen wurde:
 * `tests/security/egress-chokepoint.test.ts:31-35` verbietet die CODE-FORM eines Credential-Namens
 * (quotiertes Literal oder `env`-Zugriff) in jeder `.ts`-Datei ausserhalb der beiden
 * Chokepoint-Dateien und nimmt Fliesstext ausdrücklich aus („z. B. i18n-Hilfetext"). Eine
 * Zuordnungstabelle, die den Kontonamen hier als quotiertes Literal führte, hat diesen Wächter im
 * Tor-Lauf dieses Jobs rot gemacht — gemessen, nicht vermutet
 * (`expected [ 'apps/web/src/lib/kiTestBefund.ts' ] to deeply equal []`). Der Wächter wird deshalb
 * NICHT erweitert; der Name wandert dorthin, wo das Haus ihn seit jeher führt. Verboten ist dabei
 * die QUOTIERTE Form, nicht der Name als solcher — im Fließtext oben darf er stehen, in
 * `"…"`-Anführungszeichen nicht.
 */
export function kiTestBefund(eingabe: {
  ergebnis?: ReasonerProbeResult;
  anfrageFehler: boolean;
  art: KiTestArt;
}): KiTestBefund {
  const lokal = eingabe.art === "local";
  const ursache = (name: string): string =>
    lokal ? `adm.ai.befund.lokal.${name}` : `adm.ai.befund.${name}`;
  const rat = (name: string): string => (lokal ? `adm.ai.rat.lokal.${name}` : `adm.ai.rat.${name}`);
  const einfach = (fall: KiTestFall, wiederholbar = true): KiTestBefund => ({
    fall,
    ursacheKey: ursache(fall),
    ursacheWerte: {},
    ratKey: rat(fall),
    anbieterGrund: null,
    wiederholbar,
  });

  // Fall (h): die Anfrage an KLARWERK kam nicht durch. Es liegt KEIN Prüfergebnis vor — über
  // Modell, Anbieter oder Schlüssel ist damit nichts bekannt, und die Art des Weges ändert daran
  // nichts.
  if (eingabe.anfrageFehler || eingabe.ergebnis === undefined) {
    return {
      fall: "anfrage",
      ursacheKey: "adm.ai.befund.anfrage",
      ursacheWerte: {},
      ratKey: "adm.ai.rat.anfrage",
      anbieterGrund: null,
      wiederholbar: true,
    };
  }

  const { fehlerklasse, status, anbieterGrund, anbieter } = eingabe.ergebnis;

  if (fehlerklasse === "http" && status !== undefined) {
    // (a) Zugangsdaten — der EINZIGE Fall, in dem ein Schlüsseltipp belegt ist.
    if (status === 401 || status === 403) {
      // Ohne bekannten Anbieter steht KEIN Kontoname da — geraten wird nicht.
      const mitKonto = !lokal && anbieter !== undefined;
      return {
        fall: "zugang",
        ursacheKey: ursache("zugang"),
        ursacheWerte: { status },
        ratKey: mitKonto ? `adm.ai.rat.zugangKonto.${anbieter}` : rat("zugang"),
        anbieterGrund: null,
        wiederholbar: true,
      };
    }
    // (b) Kontingent/Rate — ein anderer Schlüssel hilft hier nicht.
    if (status === 429) {
      return einfach("kontingent");
    }
    // (c) Die ANFRAGE wurde abgelehnt, nicht der Schlüssel. Ein identischer zweiter Versuch ergäbe
    // dasselbe; erst eine andere Modell-/Parameterwahl ändert etwas — deshalb kein Wiederholen.
    if (status === 400) {
      return {
        ...einfach("abgelehnt", false),
        anbieterGrund: anbieterGrund ?? null,
      };
    }
    // (d) Serverfehler beim Anbieter.
    if (status >= 500) {
      return einfach("nichtErreichbar");
    }
    // Jeder andere Status ist nicht eingeordnet — s. Kopf.
    return unbestimmt(ursache);
  }

  // (d) dieselbe Lage, belegt über die Netzklasse statt über den Status.
  if (fehlerklasse === "network") {
    return einfach("nichtErreichbar");
  }
  // (e) Zeitlimit.
  if (fehlerklasse === "timeout") {
    return einfach("zeitlimit");
  }
  // (f) Antwort kam an, war aber unbrauchbar (leer, abgeschnitten, nur Denkphase).
  if (fehlerklasse === "parse") {
    return einfach("unbrauchbar");
  }
  // (g) "unknown" oder gar kein Feld: ehrlich unbestimmt, ohne jeden Ratschlag.
  return unbestimmt(ursache);
}

/** Der ehrliche Rückfall: Ursache benannt als NICHT eingeordnet, und kein Rat, der eine behauptet. */
function unbestimmt(ursache: (name: string) => string): KiTestBefund {
  return {
    fall: "unbestimmt",
    ursacheKey: ursache("unbestimmt"),
    ursacheWerte: {},
    ratKey: null,
    anbieterGrund: null,
    wiederholbar: true,
  };
}
