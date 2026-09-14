// ================================================================================================
// JOB 3580 · Q9-REST — JEDER DURCHGEREICHTE FEHLER TRAEGT EINEN SCHLUESSEL, DEN DER KATALOG KENNT.
// ================================================================================================
//
// DER BEFUND, gegen den diese Datei steht (Zeile fuer Zeile am Basisstand b5539ff nachgelesen):
//
//     services/auth/src/routes.ts:116    const schluessel = error instanceof OidcUnreachableError
//                                          ? "OIDC_UNREACHABLE" : error.message;
//     services/auth/src/types.ts:57      constructor(code: AuthErrorCode, message: string)
//     services/auth/src/meldungen.ts:149 Object.hasOwn(MELDUNGEN, schluessel) ? … : "INTERNAL"
//
// Der Schluessel, mit dem der Server uebersetzt, ist fuer JEDEN Fehler ausser einem der freie Text
// des `AuthError`. `message` ist im Typ eine beliebige Zeichenkette — der Typpruefer sieht den
// Fehlgriff also nicht. Und `meldung()` faellt bei einem unbekannten Schluessel STILL auf
// `INTERNAL` zurueck (richtig so: keine internen Kennungen nach aussen) — es gibt heute also
// keinen Weg, auf dem der Fehlgriff auffiele. Wer morgen
// `throw new AuthError("FORBIDDEN", "Nur Admins duerfen das.")` schreibt, bekommt in allen drei
// Sprachen „Unerwarteter Fehler." — nicht den Grund, und die Sprachwahl hilft ihm nicht.
//
// DER PRUEFER VON JOB 3562 HAT GENAU DAS OFFEN GELASSEN (archiv/3562/runde-2/RUECKGABE.md:74,
// woertlich): „Unveraendert offen und ausserhalb dieses Auftrags: `services/auth/src/routes.ts:116`
// waehlt den Katalogschluessel ueber die Klasse (`error instanceof OidcUnreachableError ?
// "OIDC_UNREACHABLE" : error.message`) — fuer alle anderen Fehler ist der Schluessel also
// `error.message`, ein Text, der zugleich als Kennung dient; solange das so ist, kann ein
// kuenftiger Fehler mit freiem Text still am Katalog vorbeilaufen, ohne dass einer der drei
// Waechter das sieht."
//
// DREI WAECHTER, DREI VERSCHIEDENE FRAGEN — keiner ersetzt den anderen, und keiner von ihnen ist
// A, B oder C aus `katalog-ist-die-einzige-quelle.test.ts` (die fragen alle drei nach dem KATALOG;
// keiner fragt, ob der Schluessel, den routes.ts:116 auswaehlt, ueberhaupt einer ist):
//
//   D  Ist jeder Schluessel ein KATALOGSCHLUESSEL?  Traegt jede Stelle unter services/auth/src, an
//                                                   der ein AuthError erzeugt wird, als Meldung ein
//                                                   LITERAL, das `MELDUNGEN` kennt? (Das ist die
//                                                   Luecke selbst — heute faellt ein freier Satz
//                                                   durch, ohne dass ein Test rot wird.)
//   E  Bleibt die eine AUSNAHME ehrlich?            `OidcUnreachableError` traegt absichtlich einen
//                                                   SATZ statt eines Schluessels; deshalb steht die
//                                                   instanceof-Abfrage in routes.ts:116. E FAEHRT
//                                                   einen echten Callback durch die echte Route und
//                                                   liest die Antwort vom Draht — kein Quelltext,
//                                                   kein Wortlaut (Korrekturpflicht 2, Runde 2).
//                                                   Ohne E waere die Ausnahme in D ein Freibrief:
//                                                   sie duerfte bleiben, auch wenn das, was sie
//                                                   rechtfertigt, weg ist.
//   F  Bleibt das SCHWEIGEN, wie es ist?            Ein unbekannter Schluessel liefert in allen drei
//                                                   Sprachen den INTERNAL-Satz und gibt weder die
//                                                   Kennung noch eine Diagnose nach aussen. F haelt
//                                                   BEIDES zugleich fest: das Sicherheitsverhalten,
//                                                   das so bleiben soll, und die Stille, gegen die
//                                                   D steht. Wer `meldung()` spaeter „hilfreicher"
//                                                   macht und die Kennung durchreicht, wird hier rot
//                                                   — und wer sie laut macht, nimmt D den Grund.
//
// D.0 kalibriert vorher das WERKZEUG, auf dem D steht — den Extraktor in `quelltext.ts`, der seit
// JOB 3846 den TypeScript-Syntaxbaum liest. D.0 misst jede Form EINZELN und in BEIDE Richtungen
// (gesehen / nicht gesehen); die Lehre aus 3562 R1, wo ein `import "./types";` ohne Bindung
// fuenfzehn Faelle gruen liess, obwohl die verbotene Abhaengigkeit dastand.
//
// WARUM D.0 AUCH UEBER DEM SYNTAXBAUM BLEIBT — und zwar in vollem Umfang: Ein Baum-Extraktor liegt
// nicht seltener falsch als ein Abtaster, er liegt an ANDEREN Stellen falsch. Er zerbricht nicht
// mehr an einer Klammer oder einem Komma in einem Text, dafuer entscheidet jetzt die AUSWAHL der
// Knotenarten, was er sieht: welcher Teilausdruck hinter `new` als Klassenname zaehlt, welche
// Deklarationsform einen Namen bindet, was in einer Vorlage ein Knoten ist und was Text. Keine
// dieser Entscheidungen faellt beim Bauen auf, keine beim Typpruefen, und `meldung()` schweigt zu
// allen. Die Kalibrierung ist die einzige Stelle, an der eine falsche Entscheidung sichtbar wird —
// und die neun `UEBERSEHEN`-Faelle sind es fuer die Gegenrichtung: ein Waechter, der bei Harmlosem
// rot wird, wird abgeschaltet, und dann ist auch die echte Zusage weg.
//
// FUENF RUNDEN, FUENF MAL DIESELBE LEHRE, jedes Mal eine Stufe tiefer — die Faelle unten tragen
// die Rundennummer, damit niemand sie fuer Spitzfindigkeit haelt:
//   R1 → der freie Satz selbst          (`new AuthError("FORBIDDEN", "Nur Admins duerfen das.")`)
//   R2 → die TYPISIERTE Deklaration     (`const Fehler: typeof AuthError = AuthError`)
//        und der GEKLAMMERTE Konstruktor (`new (AuthError)(…)`)
//   R3 → die VERWENDUNG der Deklaration (`new this.Fehler(…)` an einem Klassenfeld)
//   R4 → die DREI blinden Flecken des Abtasters, einzeln und namentlich, jeder vor dem Umbau mit
//        gemessener Ausgabe `[]`:
//          (i)   LAUFZEIT-KLASSENWAHL    `new (b ? AuthError : Error)("FORBIDDEN", "…")`
//          (ii)  VORLAGEN-EINSETZUNG     `` `${new AuthError("FORBIDDEN", "…")}` ``
//          (iii) ERBEN UEBER EINEN AUFRUF `class StummError extends mischung(AuthError) {}`
//   R5 → der WERT des Konstruktorausdrucks statt des ersten Namens darin
//        (`new (void AuthError, BenError)(…)` und `new (void AuthError, Error)(…)`)
// R3 ist die schaerfste: die Deklaration wurde bereits erkannt — nur ihr Gebrauch fiel durch. Wer
// eine Aliasform ergaenzt, ergaenzt deshalb IMMER beides: wie sie entsteht und wie sie gerufen wird.
// R4 nimmt eine frueher als unverschiebbar notierte GRENZE zurueck: (i) stand vom 11.09. bis zum
// 14.09.2026 als eigener Fall `D.0 GRENZE` da und nagelte dieselbe Quelle auf `[]` fest. Das war
// eine Grenze des Werkzeugs, nicht des Quelltexts — sie ist ersatzlos entfallen, statt neben ihrer
// Ablösung stehen zu bleiben.
// R5 IST DIE WARNUNG AN DEN NAECHSTEN, DER DIESES WERKZEUG ANFASST: der Umbau auf den Syntaxbaum in
// R4 hat einen Fall VERLOREN, den der abgeloeste Abtaster noch fing — `new (void AuthError,
// BenError)(…)` wurde von `BenError`/`abgeleitet` zu `AuthError`/`wurzel` und damit gruen. Eine
// Ablösung ist erst dann eine, wenn sie eine OBERMENGE des Abgeloesten ist; wer hier eine Regel
// ersetzt, misst beide Richtungen gegen den alten Stand und nicht nur die neu gewonnenen Faelle.
//
// R6 (JOB 3846 R3) · ZWEI ARBEITEN AN DERSELBEN DATEI, zusammengefuehrt statt nebeneinandergelegt:
// Waehrend R4/R5 liefen, kam JOB 3839 (cd9b81c) auf main und stellte drei neue Faelle daneben —
// `D.0 GRENZE G1/G2/G3`, der PREIS der Aufloesung ueber den letzten Punktteil. Sie stehen weiter im
// Lauf, jetzt ueber dem Syntaxbaum neu gemessen. Der VIERTE Fall, den JOB 3839 unberuehrt stehen
// liess — `D.0 GRENZE: eine Klasse, die erst zur Laufzeit feststeht, ist nicht ablesbar` —, ist
// dagegen die Grenze aus R4 (i) und ist mit ihr ersatzlos entfallen; ihn neben R4 (i) stehen zu
// lassen hiesse, dieselbe Form zugleich auf `[]` und auf eine Fundstelle festzunageln.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { MELDUNGEN, meldung } from "../../services/auth/src/meldungen";
import {
  type OidcConfig,
  type OidcProvider,
  OidcUnreachableError,
} from "../../services/auth/src/oidc";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { authRoutes } from "../../services/auth/src/routes";
import { AuthService } from "../../services/auth/src/service";
import { alsLiteral, erzeugungsstellen, fehlerklassen } from "./quelltext";

const WURZEL = resolve(__dirname, "..", "..");
const AUTH_SRC = join(WURZEL, "services", "auth", "src");
const SPRACHEN = ["de", "en", "nl"] as const;

/** Nur so viel Anbieterangaben, wie `/api/auth/oidc/start` braucht; nichts davon wird gerufen. */
const OIDC_CONFIG: OidcConfig = {
  issuer: "https://idp.example.test",
  audience: "klarwerk-client",
  jwksUri: "https://idp.example.test/jwks",
  authorizeUrl: "https://idp.example.test/authorize",
  tokenUrl: "https://idp.example.test/token",
  clientId: "klarwerk-client",
  redirectUri: "https://app.klarwerk.test/sso/callback",
  roles: { roleClaim: "roles", adminGroup: "kw-admin" },
};

function relativ(pfad: string): string {
  return relative(WURZEL, pfad).split("\\").join("/");
}

/** Dieselbe Dateimenge wie Waechter A/B/C: alle `.ts` unter services/auth/src ohne die Tests. */
function authQuellen(): string[] {
  const gefunden: string[] = [];
  const laufe = (ordner: string): void => {
    for (const eintrag of readdirSync(ordner).sort()) {
      const pfad = join(ordner, eintrag);
      if (statSync(pfad).isDirectory()) {
        laufe(pfad);
        continue;
      }
      if (!pfad.endsWith(".ts") || pfad.endsWith(".d.ts") || pfad.endsWith(".test.ts")) {
        continue;
      }
      gefunden.push(pfad);
    }
  };
  laufe(AUTH_SRC);
  return gefunden;
}

// ------------------------------------------------------------------------------------------------
// D.0 · KALIBRIERUNG DES EXTRAKTORS
// ------------------------------------------------------------------------------------------------

/**
 * Der Weg, den auch Waechter D geht — an erfundenen Quellen statt an den echten Dateien. Eine
 * Kalibrierung an einer KOPIE des Extraktors waere keine (Lehre JOB 3562 R1: eine eigene
 * Musterkopie neben der gemeinsamen Funktion ist die Stelle, an der der Waechter blind wird).
 */
/** Die eine Schreibweise einer Fundstelle — auch G3 unten benutzt sie, statt sie nachzubauen. */
function alsZeile(s: ReturnType<typeof erzeugungsstellen>[number]): string {
  return `${s.zeile} ${s.art} ${s.klasse}(${s.argumente.join(" | ")})`;
}

function stellenVon(quelle: string): string[] {
  const klassen = fehlerklassen([quelle]);
  return erzeugungsstellen(quelle, klassen).map(alsZeile);
}

describe("D.0 · der Extraktor sieht jede Form, in der ein AuthError entstehen kann", () => {
  const GESEHEN: { form: string; quelle: string; erwartet: string[] }[] = [
    {
      form: "einzeilig, beide Argumente als Literal",
      quelle: 'throw new AuthError("FORBIDDEN", "text");\n',
      erwartet: ['1 wurzel AuthError("FORBIDDEN" | "text")'],
    },
    {
      form: "mehrzeilig mit nachgestelltem Komma — die Zeile der Anweisung zaehlt",
      quelle: 'throw new AuthError(\n  "FORBIDDEN",\n  "text",\n);\n',
      erwartet: ['1 wurzel AuthError("FORBIDDEN" | "text")'],
    },
    {
      // Die Form, in der dieser Bestand seine 23 direkten Stellen schreibt (gemessen am 13.09.2026
      // auf 172001e, dieselbe Messung wie D.1 weiter unten). Ein Extraktor, der sie nicht
      // kennt, faende am heutigen main NICHTS und waere gruen, ohne je etwas geprueft zu haben.
      form: "Literal mit satisfies — die Schreibweise dieses Bestands",
      quelle: 'throw new AuthError("NOT_FOUND", "USER_NOT_FOUND" satisfies Meldungsschluessel);\n',
      erwartet: ['1 wurzel AuthError("NOT_FOUND" | "USER_NOT_FOUND" satisfies Meldungsschluessel)'],
    },
    {
      form: "Argument WEGGELASSEN — der Vorgabewert der Klasse",
      quelle:
        "class OidcUnreachableError extends AuthError {}\nthrow new OidcUnreachableError();\n",
      erwartet: ["2 abgeleitet OidcUnreachableError()"],
    },
    {
      form: "ein Bezeichner statt eines Literals",
      quelle: 'throw new AuthError("NOT_FOUND", MEIN_SATZ);\n',
      erwartet: ['1 wurzel AuthError("NOT_FOUND" | MEIN_SATZ)'],
    },
    {
      form: "ein Elementzugriff",
      quelle: 'throw new AuthError("NOT_FOUND", MELDUNGEN.X.de);\n',
      erwartet: ['1 wurzel AuthError("NOT_FOUND" | MELDUNGEN.X.de)'],
    },
    {
      form: "eine Vorlage OHNE Einsetzung",
      quelle: "throw new AuthError(`EMAIL_TAKEN`, `EMAIL_TAKEN`);\n",
      erwartet: ["1 wurzel AuthError(`EMAIL_TAKEN` | `EMAIL_TAKEN`)"],
    },
    {
      form: "eine Vorlage MIT Einsetzung",
      quelle: 'throw new AuthError("EMAIL_TAKEN", `${a}_TAKEN`);\n',
      erwartet: ['1 wurzel AuthError("EMAIL_TAKEN" | `${a}_TAKEN`)'],
    },
    {
      form: "eine abgeleitete Klasse aus demselben Modul",
      quelle: 'class StummError extends AuthError {}\nthrow new StummError("satz");\n',
      erwartet: ['2 abgeleitet StummError("satz")'],
    },
    {
      // Zwei Stufen: wer `extends` nur eine Ebene tief verfolgt, verliert den Enkel aus dem Blick.
      form: "eine Enkelklasse ueber zwei Stufen",
      quelle: "class A extends AuthError {}\nclass B extends A {}\nthrow new B();\n",
      erwartet: ["3 abgeleitet B()"],
    },
    {
      // Lehre JOB 3579 R1 (11.09.): „der AST-Waechter uebersieht zwei gemessene Aliasformen".
      form: "ueber einen Einfuhr-Aliasnamen",
      quelle:
        'import { AuthError as Fehler } from "./types";\nthrow new Fehler("FORBIDDEN", "x");\n',
      erwartet: ['2 wurzel Fehler("FORBIDDEN" | "x")'],
    },
    {
      form: "ueber einen lokalen Aliasnamen",
      quelle: 'const Fehler = AuthError;\nthrow new Fehler("FORBIDDEN", "x");\n',
      erwartet: ['2 wurzel Fehler("FORBIDDEN" | "x")'],
    },
    {
      // RUNDE 2, KORREKTURPFLICHT 1: GENAU DIESE Form hat BEN in Runde 1 an der Stelle der
      // Pflichtgegenprobe eingesetzt — und alle 71 Faelle blieben gruen. Eine gewoehnliche
      // Typannotation genuegte, damit der freie Fehlersatz unbemerkt blieb.
      form: "ueber einen TYPISIERTEN lokalen Aliasnamen (BEN, Runde 1)",
      quelle:
        "const Fehler: typeof AuthError = AuthError;\n" +
        'throw new Fehler("FORBIDDEN", "Nur Admins duerfen das.");\n',
      erwartet: ['2 wurzel Fehler("FORBIDDEN" | "Nur Admins duerfen das.")'],
    },
    {
      // Die Annotation allein genuegt: woher der Wert kommt, ist gleichgueltig — wer diesen Namen
      // mit `new` ruft, erzeugt einen AuthError.
      form: "ueber eine Typannotation ohne Zuweisung",
      quelle: 'let Fehler: typeof AuthError;\nthrow new Fehler("FORBIDDEN", "satz");\n',
      erwartet: ['2 wurzel Fehler("FORBIDDEN" | "satz")'],
    },
    {
      // RUNDE 3, KORREKTURPFLICHT: GENAU DIESE Form hat BEN in Runde 2 in `AuthService` gesetzt —
      // das Feld wurde als Fehlerklasse ERKANNT, seine Verwendung `new this.Fehler(…)` aber nicht
      // aufgeloest, und alle 81 Faelle blieben gruen. Eine erkannte Deklaration nuetzt nichts,
      // wenn ihr Gebrauch durchfaellt.
      form: "ueber ein TYPISIERTES KLASSENFELD und new this.Fehler (BEN, Runde 2)",
      quelle:
        "class Dienst {\n" +
        "  private readonly Fehler: typeof AuthError = AuthError;\n" +
        "  listUsers() {\n" +
        '    throw new this.Fehler("FORBIDDEN", "Nur Admins duerfen das.");\n' +
        "  }\n}\n",
      erwartet: ['4 wurzel this.Fehler("FORBIDDEN" | "Nur Admins duerfen das.")'],
    },
    {
      form: "ueber ein typisiertes Feld aus einer Konstruktor-Eigenschaft",
      quelle:
        "class Dienst {\n" +
        "  constructor(private readonly Fehler: typeof AuthError) {}\n" +
        '  f() { throw new this.Fehler("FORBIDDEN", "satz"); }\n}\n',
      erwartet: ['3 wurzel this.Fehler("FORBIDDEN" | "satz")'],
    },
    {
      form: "ein typisiertes Feld, geklammert gerufen",
      quelle:
        "class Dienst {\n" +
        "  private readonly Fehler: typeof AuthError = AuthError;\n" +
        '  f() { throw new (this.Fehler)("FORBIDDEN", "satz"); }\n}\n',
      erwartet: ['3 wurzel this.Fehler("FORBIDDEN" | "satz")'],
    },
    {
      // Derselbe Weg ohne `this`: ein Buendel, das den Konstruktor als Feld traegt.
      form: "ueber ein typisiertes Feld eines fremden Buendels",
      quelle:
        "const deps: { Fehler: typeof AuthError } = x;\n" +
        'throw new deps.Fehler("FORBIDDEN", "satz");\n',
      erwartet: ['2 wurzel deps.Fehler("FORBIDDEN" | "satz")'],
    },
    {
      // Der gewoehnlichste qualifizierte Name ueberhaupt — und bis Runde 3 unsichtbar.
      form: "ueber einen Namensraum-Import",
      quelle: 'import * as t from "./types";\nthrow new t.AuthError("FORBIDDEN", "satz");\n',
      erwartet: ['2 wurzel t.AuthError("FORBIDDEN" | "satz")'],
    },
    {
      form: "ueber einen typisierten Parameter",
      quelle:
        'function f(Fehler: typeof AuthError) {\n  throw new Fehler("FORBIDDEN", "satz");\n}\n',
      erwartet: ['2 wurzel Fehler("FORBIDDEN" | "satz")'],
    },
    {
      // RUNDE 2, KORREKTURPFLICHT 1: gemessen lieferte der Extraktor hier `[]`.
      form: "ein GEKLAMMERTER Konstruktor (BEN, Runde 1)",
      quelle: 'throw new (AuthError)("FORBIDDEN", "text");\n',
      erwartet: ['1 wurzel AuthError("FORBIDDEN" | "text")'],
    },
    {
      form: "ein doppelt geklammerter Konstruktor",
      quelle: 'throw new ((AuthError))("FORBIDDEN", "text");\n',
      erwartet: ['1 wurzel AuthError("FORBIDDEN" | "text")'],
    },
    {
      form: "ein Konstruktor hinter dem Kommaoperator",
      quelle: 'throw new (0, AuthError)("FORBIDDEN", "text");\n',
      erwartet: ['1 wurzel AuthError("FORBIDDEN" | "text")'],
    },
    {
      form: "geklammert UND ueber einen typisierten Alias",
      quelle: 'const F: typeof AuthError = AuthError;\nthrow new (F)("FORBIDDEN", "text");\n',
      erwartet: ['2 wurzel F("FORBIDDEN" | "text")'],
    },
    {
      form: "eine abgeleitete Klasse als Klassenausdruck",
      quelle: 'const StummError = class extends AuthError {};\nthrow new StummError("satz");\n',
      erwartet: ['2 abgeleitet StummError("satz")'],
    },
    {
      // Ein Komma IN der Meldung darf die Argumentliste nicht zerlegen — sonst waere die Meldung
      // ploetzlich „drittes Argument" und D saehe an der eigentlichen Aussage vorbei.
      form: "ein Komma innerhalb der Zeichenkette",
      quelle: 'throw new AuthError("FORBIDDEN", "Nur Admins, bitte.");\n',
      erwartet: ['1 wurzel AuthError("FORBIDDEN" | "Nur Admins, bitte.")'],
    },
    {
      form: "ein verschachtelter Aufruf im Argument",
      quelle: 'throw new AuthError("FORBIDDEN", uebersetze("X", 1));\n',
      erwartet: ['1 wurzel AuthError("FORBIDDEN" | uebersetze("X", 1))'],
    },
    {
      form: "ein Kommentar MITTEN in der Argumentliste",
      quelle: 'throw new AuthError("FORBIDDEN", /* warum */ "text");\n',
      erwartet: ['1 wurzel AuthError("FORBIDDEN" | "text")'],
    },
    {
      form: "zwei Stellen in derselben Zeile",
      quelle: 'f(new AuthError("A", "a"), new AuthError("B", "b"));\n',
      erwartet: ['1 wurzel AuthError("A" | "a")', '1 wurzel AuthError("B" | "b")'],
    },
    // ------------------------------------------------------------------------------------------
    // RUNDE 4 (JOB 3846) · DIE DREI GEMESSENEN BLINDEN FLECKEN DES ABTASTERS.
    // Die liefernde Bahn von JOB 3580 hat sie selbst benannt und offen gelassen
    // (archiv/3580/runde-3/RUECKGABE.md:57, woertlich: „Die drei gemessenen Grenzen des Extraktors
    // (Laufzeit-Klassenwahl, Vorlagen-Einsetzung, Erben ueber einen Aufruf) sind heute unbesetzt,
    // aber echt. Sie zu schliessen hiesse, den Syntaxbaum statt des Abtasters zu benutzen").
    // Auf jedem der drei konnte ein freier Fehlersatz am Katalog vorbeilaufen, ohne dass ein Test
    // rot wurde. Die drei Faelle stehen hier, WEIL sie vor dem Umbau rot waren — gemessen am
    // unveraenderten Abtaster: (i) `[]`, (ii) `[]`, (iii) `[]`.
    //
    // DER ERSTE FALL LOEST EINE FRUEHERE GRENZBEHAUPTUNG AB. Vom 11.09.2026 (JOB 3580 R1) bis zum
    // 14.09.2026 stand weiter unten der Fall „D.0 GRENZE: eine Klasse, die erst zur Laufzeit
    // feststeht, ist nicht ablesbar" und nagelte dasselbe Beispiel auf `[]` fest — richtig
    // gemessen, aber es war eine Grenze DES ABTASTERS und keine des Quelltexts. Mit dem Syntaxbaum
    // ist sie gefallen: im Quelltext steht, dass hier ein `AuthError` entstehen KANN, und genau das
    // meldet der Extraktor jetzt. Zwei Behauptungen ueber dieselbe Form waeren eine zu viel,
    // deshalb ist der Grenzfall ersatzlos weg und nicht neben diesen hier gestellt. Nicht betroffen
    // sind die gleichnamigen Faelle `D.0 GRENZE G1/G2/G3` (JOB 3839): die messen eine ANDERE Grenze
    // — den Preis der Aufloesung ueber den letzten Punktteil — und stehen unverändert im Lauf.
    {
      form: "ueber eine Laufzeit-Klassenwahl",
      quelle: 'throw new (b ? AuthError : Error)("FORBIDDEN", "Nur Admins duerfen das.");\n',
      erwartet: ['1 wurzel AuthError("FORBIDDEN" | "Nur Admins duerfen das.")'],
    },
    {
      form: "ueber eine Einsetzung in einer Vorlage",
      quelle: 'const s = `${new AuthError("FORBIDDEN", "Nur Admins duerfen das.")}`;\n',
      erwartet: ['1 wurzel AuthError("FORBIDDEN" | "Nur Admins duerfen das.")'],
    },
    {
      form: "eine Klasse, die ueber einen Aufruf erbt",
      quelle:
        "class StummError extends mischung(AuthError) {}\n" +
        'throw new StummError("Nur Admins duerfen das.");\n',
      erwartet: ['2 abgeleitet StummError("Nur Admins duerfen das.")'],
    },
    // ------------------------------------------------------------------------------------------
    // RUNDE 5 (JOB 3846 R2) · EIN KONSTRUKTORAUSDRUCK WIRD NACH SEINEM WERT GELESEN, NICHT NACH
    // DEM ERSTEN NAMEN, DER DARIN VORKOMMT.
    // BENs Gegenbeweis zu Runde 1, woertlich: `throw new (void AuthError, BenError)("FORBIDDEN",
    // "USER_NOT_FOUND");` — „alter Extraktor → `BenError`, `abgeleitet`; neuer Extraktor →
    // `AuthError`, `wurzel`. Die D-Urteilslogik liefert `errors: []`". Tatsaechlich entsteht
    // `BenError` mit freiem Fehlersatz. Runde 1 nahm den ERSTEN bekannten Namen im Ausdruck; beim
    // Kommaoperator ist das der VERWORFENE Operand. Damit stufte der Waechter eine unerlaubte
    // Unterklasse zur Wurzel herab und sah an ihr vorbei — ein RUECKSCHRITT gegenueber dem
    // abgeloesten Abtaster, der den letzten freien Kommateil las und BenError meldete.
    // Diese Faelle halten beide Richtungen fest: der Wert entscheidet, UND eine Laufzeitwahl
    // verdeckt ihre zweite Alternative nicht.
    {
      form: "ein Kommaoperator mit einer Unterklasse rechts (BEN, Runde 1)",
      quelle:
        "class BenError extends AuthError {}\n" +
        'throw new (void AuthError, BenError)("FORBIDDEN", "USER_NOT_FOUND");\n',
      erwartet: ['2 abgeleitet BenError("FORBIDDEN" | "USER_NOT_FOUND")'],
    },
    {
      // Beide Alternativen sind erreichbar, also stehen beide da. Nur die erste zu melden hiesse,
      // die Unterklassenregel ueber die Reihenfolge der Zweige abschaltbar zu machen.
      form: "eine Laufzeitwahl zwischen Wurzel und Unterklasse — Wurzel zuerst",
      quelle:
        "class BenError extends AuthError {}\n" +
        'throw new (b ? AuthError : BenError)("FORBIDDEN", "USER_NOT_FOUND");\n',
      erwartet: [
        '2 wurzel AuthError("FORBIDDEN" | "USER_NOT_FOUND")',
        '2 abgeleitet BenError("FORBIDDEN" | "USER_NOT_FOUND")',
      ],
    },
    {
      form: "eine Laufzeitwahl zwischen Wurzel und Unterklasse — Unterklasse zuerst",
      quelle:
        "class BenError extends AuthError {}\n" +
        'throw new (b ? BenError : AuthError)("FORBIDDEN", "USER_NOT_FOUND");\n',
      erwartet: [
        '2 abgeleitet BenError("FORBIDDEN" | "USER_NOT_FOUND")',
        '2 wurzel AuthError("FORBIDDEN" | "USER_NOT_FOUND")',
      ],
    },
    {
      // Die dritte Laufzeitwahl-Form neben `?:` — sie war schon in Runde 1 gruen und steht hier,
      // damit die Auswertung nach dem WERT sie nicht versehentlich auf den rechten Operanden
      // verkuerzt: bei `??` sind BEIDE Seiten erreichbar, beim Komma nur die rechte.
      form: "eine Laufzeitwahl ueber ??",
      quelle: 'throw new (Eigen ?? AuthError)("FORBIDDEN", "USER_NOT_FOUND");\n',
      erwartet: ['1 wurzel AuthError("FORBIDDEN" | "USER_NOT_FOUND")'],
    },
  ];

  for (const { form, quelle, erwartet } of GESEHEN) {
    it(`D.0 sieht: ${form}`, () => {
      expect(stellenVon(quelle)).toEqual(erwartet);
    });
  }

  const UEBERSEHEN: { form: string; quelle: string }[] = [
    {
      form: "in einem Zeilenkommentar",
      quelle: '// throw new AuthError("X", "y");\nconst a = 1;\n',
    },
    {
      form: "in einem Blockkommentar",
      quelle: '/* throw new AuthError("X", "y"); */\nconst a = 1;\n',
    },
    {
      form: "eine Zeichenkette, die nur wie ein Aufruf aussieht",
      quelle: 'const s = \'new AuthError("X", "y")\';\n',
    },
    {
      form: "ein Regex-Literal, das nur wie ein Aufruf aussieht",
      quelle: 'const r = /new AuthError\\("X"\\)/;\n',
    },
    {
      form: "ein new Error, das nichts mit AuthError zu tun hat",
      quelle: 'throw new Error("x");\n',
    },
    {
      // BENs ZWEITE Gegenprobe zu Runde 1, die Gegenrichtung zum Kommaoperator oben: „`throw new
      // (void AuthError, Error)("Nur Admins duerfen das.");` erzeugt den falschen Verstoss
      // `AuthError ohne Meldung erzeugt`". Erzeugt wird ein gewoehnlicher `Error`; der Name
      // `AuthError` steht nur im VERWORFENEN Operanden. Ein Waechter, der daraus einen AuthError
      // macht, meldet eine Stelle, an der nichts ist — und wird beim ersten Fehlalarm abgeschaltet.
      form: "ein Kommaoperator mit einem gewoehnlichen Error rechts (BEN, Runde 1)",
      quelle: 'throw new (void AuthError, Error)("Nur Admins duerfen das.");\n',
    },
    {
      form: "eine fremde Klasse mit Error im Namen",
      quelle: 'throw new joseErrors.JWKSTimeout("x");\n',
    },
    {
      // Die Gegengrenze zur Aufloesung qualifizierter Namen (Runde 3): der letzte Teil eines
      // Punktnamens zaehlt nur, wenn er selbst eine Fehlerklasse ist. Ein beliebiges typisiertes
      // Feld darf den Waechter nicht ausloesen — sonst wird er beim ersten Fehlalarm abgeschaltet.
      // DIESER Fall prueft den ANDEREN Namen (`Verbinder`); den GLEICHEN Namen an einem fremden
      // Traeger pruefen G1/G2 unten — er wird gemeldet, und das ist die gemessene Grenze.
      form: "ein typisiertes Feld, das mit AuthError nichts zu tun hat",
      quelle:
        "class Dienst {\n" +
        "  private readonly Verbinder: typeof Sonstwas = Sonstwas;\n" +
        '  f() { throw new this.Verbinder("x"); }\n}\n',
    },
    {
      form: "ein Bezeichner, in dem new nur steckt",
      quelle: "const renewAuthError = 1;\nconst x = renewAuthError;\n",
    },
    {
      // `extends` steht hier in einem Kommentar: die Klasse ist KEINE Fehlerklasse, und der
      // Extraktor darf sie nicht dafuer halten.
      form: "eine Klasse, die nur im Kommentar von AuthError erbt",
      quelle: 'class Stumm /* extends AuthError */ {}\nthrow new Stumm("satz");\n',
    },
  ];

  for (const { form, quelle } of UEBERSEHEN) {
    it(`D.0 schlaegt NICHT an bei: ${form}`, () => {
      // Ein Waechter, der bei Harmlosem rot wird, wird beim ersten Fehlalarm abgeschaltet — dann
      // ist auch die echte Zusage weg. Diese Faelle halten die Grenze.
      expect(stellenVon(quelle)).toEqual([]);
    });
  }

  // G1/G2/G3 · DER PREIS DER AUFLOESUNG UEBER DEN LETZTEN PUNKTTEIL — gemessen statt verschwiegen.
  // Die Grosszuegigkeit ist eine ENTSCHEIDUNG, woertlich in quelltext.ts:522-525: „Die Richtung ist
  // bewusst gewaehlt: ein Waechter, der beim qualifizierten Namen wegsieht, ist genau dort blind, wo
  // er gebraucht wird; meldet er dagegen einmal zu viel, steht die Stelle mit Datei und Zeile da und
  // ein Mensch entscheidet." Ihr Preis, bewusst dem Blindsein vorgezogen: `artFuer` kennt Namen,
  // keine Traeger — heisst IRGENDWO eine Fehlerklasse `Fehler`, meldet quelltext.ts:536-537 auch
  // `new this.Fehler(…)` eines FREMDEN Objekts, ueber das gemeinsame `fehlerklassen(quellen)` in D
  // (Zeile 704) sogar aus einer anderen Datei. WER G1-G3 ROT SIEHT, hat diese Entscheidung
  // verschoben und muss sie NEU TREFFEN, nicht die Erwartung anpassen (bestellt: ben.md:30, 3580/R3).
  //
  // JOB 3846 R3: Diese drei Faelle kamen mit JOB 3839 (cd9b81c) ueber dem ABTASTER auf main. Der
  // Syntaxbaum hat sie GEERBT, nicht bestaetigt bekommen — die Erwartungen unten sind an ihm neu
  // gemessen (Zeilen und Reihenfolge stammen aus dem Lauf, nicht aus der uebernommenen Fassung).
  // Die Aussage bleibt dieselbe, weil `artFuer` dieselbe zweite Stufe hat wie das abgeloeste
  // `artVon`: erst der ganze geschriebene Name, dann sein letzter Punktteil.

  // Ein und dieselbe fremde Stelle fuer alle drei Faelle — als Konstante, damit G1, G2 und G3
  // nachweislich dasselbe messen und nicht drei aehnliche Quellen.
  const FREMDER_TRAEGER =
    "class Pool {\n" +
    "  private readonly Fehler: typeof Verbindungsfehler = Verbindungsfehler;\n" +
    '  f() { throw new this.Fehler("Zeitueberschreitung"); }\n' +
    "}\n";
  const ECHTER_ALIAS = "const Fehler: typeof AuthError = AuthError;\n";
  const ECHTE_STELLE = 'throw new Fehler("FORBIDDEN", "satz");\n';
  const GEMESSENE_FORM =
    "Gemessen wird der fremde Traeger mit dem GLEICHEN letzten Namensteil: " +
    "class Pool { private readonly Fehler: typeof Verbindungsfehler … } mit new this.Fehler(…), " +
    "neben dem echten Alias const Fehler: typeof AuthError = AuthError.";
  const GESCHUETZTE_STELLE =
    "Geschuetzte Stelle: quelltext.ts:536-537 — dort wird der letzte Teil eines Punktnamens " +
    "nachgeschlagen, der Traeger nicht. Das ist die bewusst gewaehlte Grenze (quelltext.ts:522-525), " +
    "kein Fehler dieses Tests: wer sie verschiebt, trifft eine neue Entscheidung.";

  /** Geliefert UND erwartet — beides, damit die Diagnose nicht nur die halbe Wahrheit zeigt. */
  function befund(gefunden: readonly string[], erwartet: readonly string[]): string {
    return `Geliefert (${gefunden.length}):\n${gefunden.join("\n") || "(keine Fundstelle)"}
Erwartet (${erwartet.length}):\n${erwartet.join("\n") || "(keine Fundstelle)"}`;
  }

  it("D.0 GRENZE G1: echter und fremder Traeger mit gleichem Namen — BEIDE werden gemeldet", () => {
    const gefunden = stellenVon(ECHTER_ALIAS + FREMDER_TRAEGER + ECHTE_STELLE);
    const erwartet = [
      '4 wurzel this.Fehler("Zeitueberschreitung")',
      '6 wurzel Fehler("FORBIDDEN" | "satz")',
    ];
    expect(
      gefunden,
      `${GEMESSENE_FORM}\n${GESCHUETZTE_STELLE}
Erwartet werden ZWEI Eintraege, nicht null: Pool.Fehler hat mit AuthError nichts zu tun und wird
trotzdem gemeldet. Faellt der erste Eintrag weg, ist die zweite Stufe von artFuer abgeschaltet —
dann sind auch this.Fehler, deps.Fehler und t.AuthError wieder unsichtbar (JOB 3580 R3).
${befund(gefunden, erwartet)}`,
    ).toEqual(erwartet);
  });

  it("D.0 GRENZE G2: derselbe fremde Traeger ALLEIN — ohne den echten Namen kein Fund", () => {
    const gefunden = stellenVon(FREMDER_TRAEGER);
    expect(
      gefunden,
      `${GEMESSENE_FORM}\n${GESCHUETZTE_STELLE}
G2 ist die Gegenprobe zu G1 und erst mit ihm zusammen ein Beleg: dieselbe fremde Stelle, aber OHNE
den echten Alias in der Quelle. Der Fund in G1 haengt also an der Anwesenheit des Namens Fehler,
nicht an der Form des fremden Traegers. Wird G2 rot, meldet artFuer jeden Punktnamen — dann ist die
Gegengrenze (D.0 schlaegt NICHT an bei: ein typisiertes Feld …) nur noch zufaellig gruen.
${befund(gefunden, [])}`,
    ).toEqual([]);
  });

  it("D.0 GRENZE G3: der echte Name in Datei A macht die fremde Stelle in Datei B sichtbar", () => {
    // Kein zweiter Extraktor: genau die zwei Funktionen, die auch D benutzt (Zeile 704).
    const a = ECHTER_ALIAS + ECHTE_STELLE;
    const b = FREMDER_TRAEGER;
    const gemeinsam = erzeugungsstellen(b, fehlerklassen([a, b])).map(alsZeile);
    const alleine = erzeugungsstellen(b, fehlerklassen([b])).map(alsZeile);
    const erwartet = ['3 wurzel this.Fehler("Zeitueberschreitung")'];
    const reichweite =
      "Geschuetzte Stelle: das gemeinsame fehlerklassen(quellen) in D " +
      "(jeder-fehler-traegt-einen-katalogschluessel.test.ts:704) zusammen mit " +
      "quelltext.ts:536-537. D sammelt die Klassen EINMAL ueber ALLE Dateien.";
    expect(
      gemeinsam,
      `${GEMESSENE_FORM}\n${reichweite}
Das ist die Kehrseite des Vorteils, den D dort beansprucht: derselbe Sammelschritt, der eine in
oidc.ts geerbte Klasse in service.ts wiedererkennt, macht einen Alias Fehler in IRGENDEINER Datei
zu einem Fund in JEDER Datei. Datei A haelt hier nur den echten Alias, Datei B nur die fremde Stelle.
${befund(gemeinsam, erwartet)}`,
    ).toEqual(erwartet);
    expect(
      alleine,
      `${GEMESSENE_FORM}\n${reichweite}
Dieselbe Datei B, aber allein gesammelt: ohne Datei A gibt es den Namen Fehler nicht, und die
fremde Stelle verschwindet. Bleibt hier etwas stehen, haengt der Fund nicht an der Reichweite der
Sammlung, und die Aussage von G3 waere falsch.
${befund(alleine, [])}`,
    ).toEqual([]);
  });

  it("D.0 alsLiteral trennt Literal von Nicht-Literal", () => {
    // Ein Argument, das KEIN Literal ist, zaehlt in D als VERSTOSS und nicht als „unbekannt": ein
    // Waechter, der wegsieht, sobald es unuebersichtlich wird, ist genau dort blind, wo er
    // gebraucht wird.
    expect(alsLiteral('"USER_NOT_FOUND"')).toBe("USER_NOT_FOUND");
    expect(alsLiteral('"USER_NOT_FOUND" satisfies Meldungsschluessel')).toBe("USER_NOT_FOUND");
    expect(alsLiteral('"USER_NOT_FOUND" as string')).toBe("USER_NOT_FOUND");
    expect(alsLiteral('("USER_NOT_FOUND")')).toBe("USER_NOT_FOUND");
    expect(alsLiteral("`USER_NOT_FOUND`")).toBe("USER_NOT_FOUND");
    expect(alsLiteral('"Nur Admins, bitte."')).toBe("Nur Admins, bitte.");
    expect(alsLiteral("MEIN_SATZ")).toBeUndefined();
    expect(alsLiteral("MELDUNGEN.X.de")).toBeUndefined();
    expect(alsLiteral("`${a}_TAKEN`")).toBeUndefined();
    expect(alsLiteral("schluessel as Meldungsschluessel")).toBeUndefined();
    expect(alsLiteral("")).toBeUndefined();
  });
});

// ------------------------------------------------------------------------------------------------
// D · JEDER DURCHGEREICHTE FEHLER TRAEGT EINEN SCHLUESSEL, DEN DER KATALOG KENNT
// ------------------------------------------------------------------------------------------------
//
// DIE EINE AUSNAHME, benannt, begruendet und begrenzt: `OidcUnreachableError` (oidc.ts:37-42)
// traegt als `message` absichtlich einen deutschen SATZ (`OIDC_UNREACHABLE_MESSAGE`, oidc.ts:34)
// und keinen Schluessel — GENAU DESHALB steht die instanceof-Abfrage in `routes.ts:116` ueberhaupt
// da, die fuer diese Klasse den Schluessel "OIDC_UNREACHABLE" einsetzt. Waechter E haelt fest, dass
// es diese Abbildung noch gibt; ohne ihn waere dieser Eintrag hier ein Freibrief.
const AUSNAHMEN: ReadonlyMap<string, string> = new Map([
  [
    "OidcUnreachableError",
    "traegt absichtlich einen Satz statt eines Schluessels; routes.ts:116 bildet die Klasse per " +
      "instanceof auf OIDC_UNREACHABLE ab (gehalten von Waechter E)",
  ],
]);

/**
 * ENTSCHIEDEN UND NICHT ERFRAGT: eine ABGELEITETE Klasse, die nicht in `AUSNAHMEN` steht, ist ein
 * Verstoss — auch dann, wenn ihr Konstruktor intern brav einen Katalogschluessel an `super()`
 * reicht. Grund: `routes.ts:116` waehlt den Schluessel ueber `instanceof` und kennt GENAU EINE
 * Klasse. Eine zweite Klasse aendert damit stillschweigend, was der Mensch zu lesen bekommt, und
 * gehoert vor die Augen eines Menschen, nicht an einem Waechter vorbei. Die Meldung sagt das und
 * nennt beide Auswege.
 */
const AUSWEGE =
  "entweder wirft sie einen AuthError mit Katalogschluessel, oder sie wird hier in AUSNAHMEN " +
  "eingetragen UND in routes.ts auf einen Schluessel abgebildet (dann greift Waechter E)";

function schluesselVerstoesse(
  quelle: string,
  datei: string,
  klassen: ReturnType<typeof fehlerklassen>,
): string[] {
  const verstoesse: string[] = [];
  for (const stelle of erzeugungsstellen(quelle, klassen)) {
    const ort = `${datei}:${stelle.zeile}`;
    if (stelle.art === "abgeleitet") {
      if (AUSNAHMEN.has(stelle.klasse)) {
        continue;
      }
      verstoesse.push(
        `${ort} → ${stelle.klasse} erbt von AuthError, ist aber keine benannte Ausnahme` +
          ` — ${AUSWEGE}`,
      );
      continue;
    }
    const argument = stelle.argumente[1];
    if (argument === undefined) {
      verstoesse.push(`${ort} → ${stelle.klasse} ohne Meldung erzeugt — es gibt keinen Schluessel`);
      continue;
    }
    const wert = alsLiteral(argument);
    if (wert === undefined) {
      verstoesse.push(`${ort} → die Meldung ist kein Literal, sondern ${argument}`);
      continue;
    }
    if (!Object.hasOwn(MELDUNGEN, wert)) {
      verstoesse.push(`${ort} → "${wert}" ist kein Schluessel des Katalogs`);
    }
  }
  return verstoesse;
}

it("D · jeder AuthError unter services/auth/src traegt einen Schluessel aus MELDUNGEN", () => {
  const dateien = authQuellen();
  const quellen = dateien.map((pfad) => readFileSync(pfad, "utf8"));
  // ERST alle Klassen ueber ALLE Dateien sammeln, DANN suchen: eine Klasse, die in `oidc.ts` von
  // `AuthError` erbt, wird auch dann erkannt, wenn sie in `service.ts` geworfen wird.
  const klassen = fehlerklassen(quellen);
  const verstoesse = dateien.flatMap((pfad, i) =>
    schluesselVerstoesse(quellen[i] ?? "", relativ(pfad), klassen),
  );
  expect(
    verstoesse,
    `Der Schluessel eines AuthError IST seine Meldung (types.ts:57 — ein beliebiger Text, den der
Typpruefer nicht einschraenkt), und routes.ts:119 uebersetzt genau damit. Ein Text, den
MELDUNGEN nicht kennt, wird in meldungen.ts:149 STILL zu "Unerwarteter Fehler." — in allen drei
Sprachen, ohne dass der Mensch den Grund erfaehrt.
Gefunden:
${verstoesse.join("\n")}`,
  ).toEqual([]);
});

it("D.1 der Waechter hat ueberhaupt etwas gefunden — sonst prueft er die leere Menge", () => {
  // Ohne diesen Fall waere D dadurch stumm zu machen, dass der Extraktor an einer Umformulierung
  // vorbeisieht: keine Fundstelle, keine Verstoesse, gruen.
  //
  // GEMESSEN AM 13.09.2026, zuerst auf 172001e und nach dem Rebase erneut auf cd5de26 — beide Male
  // 25 Stellen: 23 direkte `new AuthError(...)` (service.ts und routes.ts) und 2
  // `new OidcUnreachableError()` in oidc.ts:225,317. Unabhaengig nachgezaehlt mit
  // `grep -rn "new AuthError(" services/auth/src` (23, ohne Testdateien) plus denselben zwei
  // Oidc-Stellen. Die vorige Schranke stand auf 19 und war am 11.09.2026 auf b5539ff gemessen; sie
  // waere heute stumpf — sechs Stellen koennten verschwinden, ohne dass etwas rot wird.
  // Die Zahl darf wachsen, aber nicht unter den Bestand fallen.
  const quellen = authQuellen().map((pfad) => readFileSync(pfad, "utf8"));
  const klassen = fehlerklassen(quellen);
  const stellen = quellen.flatMap((q) => erzeugungsstellen(q, klassen));
  expect(stellen.length).toBeGreaterThanOrEqual(25);
  expect(stellen.filter((s) => s.art === "abgeleitet").map((s) => s.klasse)).toEqual([
    "OidcUnreachableError",
    "OidcUnreachableError",
  ]);
});

// ------------------------------------------------------------------------------------------------
// E · DIE AUSNAHME BLEIBT EHRLICH
// ------------------------------------------------------------------------------------------------
//
// RUNDE 2, KORREKTURPFLICHT 2 DES PRÜFERS: E war ein TEXTMUSTER auf `routes.ts`. BEN entfernte den
// echten Zweig und fuegte nur `void 'error instanceof OidcUnreachableError ? "OIDC_UNREACHABLE" :
// error.message';` ein — eine Zeichenkette, die nie ausgefuehrt wird — und alle 71 Faelle blieben
// gruen (BEN, Runde 1: „→ `Tests  71 passed (71)`"). Ein Waechter, der Wortlaut misst, beglaubigt
// Wortlaut.
//
// E LIEST JETZT KEINEN QUELLTEXT MEHR. Alle Faelle FUEHREN AUS: E.1 schickt einen echten Callback
// durch die echte Route gegen einen Anbieter, der `OidcUnreachableError` wirft, und liest die
// Antwort vom Draht. Eine Zeichenkette kann das grundsaetzlich nicht leisten — sie wird nicht
// ausgefuehrt, und hier wird nichts anderes gemessen als das Ausgefuehrte.
//
// GEMESSEN IN ALLEN DREI SPRACHEN, und zwar weil die Falle feiner liegt, als sie aussieht:
// `OIDC_UNREACHABLE_MESSAGE` (oidc.ts:34) IST der deutsche Katalog-TEXT, aber er ist KEIN
// Katalog-SCHLUESSEL. Ohne die Abbildung in routes.ts:116 landet er deshalb auch auf Deutsch in
// meldungen.ts:149 auf INTERNAL. Gemessen in der Gegenprobe von Runde 2: alle drei Faelle (en, nl
// UND de) wurden rot. Die zweite und dritte Sprache bleiben trotzdem im Lauf — sie belegen
// zusaetzlich, dass die Sprachwahl aus `sprache(request)` denselben Weg mitgeht.
async function oidcCallbackAntwort(
  sprache: string,
): Promise<{ statusCode: number; error: string | undefined; message: string | undefined }> {
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
  });
  // Der kleinste Anbieter, der den Fall herstellt, um den es geht: der Token-Tausch meldet
  // „der Anmeldedienst antwortet nicht". Kein Netz, keine Uhr, keine Flockigkeit.
  const anbieter: OidcProvider = {
    autoProvision: false,
    config: OIDC_CONFIG,
    authorizeUrl: () => "https://idp.example.test/authorize",
    exchange: () => Promise.reject(new OidcUnreachableError()),
    verify: () => Promise.reject(new Error("wird nie erreicht")),
    mapRole: () => "viewer",
  };
  const app = Fastify();
  app.register(authRoutes(service, { oidc: anbieter }));
  try {
    const start = await app.inject({ method: "GET", url: "/api/auth/oidc/start" });
    const gesetzt = start.headers["set-cookie"];
    const liste = Array.isArray(gesetzt) ? gesetzt : gesetzt ? [gesetzt] : [];
    const paare = liste.map((c) => c.split(";")[0] ?? "");
    const state = paare.find((p) => p.startsWith("kw_oidc_state="))?.split("=")[1] ?? "";
    const antwort = await app.inject({
      method: "POST",
      url: "/api/auth/oidc",
      headers: { cookie: paare.join("; "), "accept-language": sprache },
      payload: { code: "code-vom-idp", state },
    });
    const rumpf = antwort.json() as { error?: string; message?: string };
    return { statusCode: antwort.statusCode, error: rumpf.error, message: rumpf.message };
  } finally {
    await app.close();
  }
}

describe("E · die eine Ausnahme in D behaelt ihren Grund", () => {
  it.each(["en", "nl"] as const)(
    "E.1 der echte Callback liefert in %s den OIDC_UNREACHABLE-Satz, nicht INTERNAL",
    async (sprache) => {
      const antwort = await oidcCallbackAntwort(sprache);
      expect(antwort.statusCode).toBe(401);
      expect(antwort.error).toBe("INVALID_CREDENTIALS");
      expect(
        antwort.message,
        `routes.ts:116 ist der einzige Grund, aus dem OidcUnreachableError in D eine Ausnahme sein
darf: die Klasse traegt einen SATZ als message (oidc.ts:34/38), und erst die instanceof-Abfrage
macht daraus den Katalogschluessel. Faellt sie weg, laeuft der deutsche Satz in meldungen.ts:149
gegen INTERNAL — und die Ausnahme in D waere ein Freibrief fuer genau den Fehler, gegen den D
steht. Gemessen wurde hier NICHT der Quelltext, sondern die Antwort vom Draht.`,
      ).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);
      expect(antwort.message).not.toBe(MELDUNGEN.INTERNAL[sprache]);
      // Auch nicht der deutsche Satz: sonst waere die Sprachwahl gar nicht gelaufen.
      expect(antwort.message).not.toBe(MELDUNGEN.OIDC_UNREACHABLE.de);
    },
  );

  it("E.1b auch auf Deutsch traegt die Abbildung — der Vorgabesatz ist Text, nicht Schluessel", async () => {
    // Der Vorgabewert der Klasse ist der deutsche Katalogtext — und genau deshalb sieht es so aus,
    // als koennte man auf Deutsch ohne die Abbildung auskommen. Man kann nicht: ein TEXT ist kein
    // SCHLUESSEL, und `meldung()` faellt bei ihm auf INTERNAL. Dieser Fall haelt beide Haelften
    // zusammen fest und wurde in der Gegenprobe von Runde 2 mit rot.
    const vorgabe = new OidcUnreachableError().message;
    expect(vorgabe).toBe(MELDUNGEN.OIDC_UNREACHABLE.de);
    expect(Object.hasOwn(MELDUNGEN, vorgabe)).toBe(false);
    const deutsch = await oidcCallbackAntwort("de");
    expect(deutsch.message).toBe(MELDUNGEN.OIDC_UNREACHABLE.de);
    expect(deutsch.message).not.toBe(MELDUNGEN.INTERNAL.de);
  });

  it("E.2 OIDC_UNREACHABLE ist ein Schluessel des Katalogs", () => {
    expect(Object.hasOwn(MELDUNGEN, "OIDC_UNREACHABLE")).toBe(true);
    for (const sprache of SPRACHEN) {
      expect(meldung("OIDC_UNREACHABLE", sprache)).not.toBe(MELDUNGEN.INTERNAL[sprache]);
    }
  });

  it("E.3 die Ausnahme ist noch noetig — die Klasse traegt weiterhin keinen Schluessel", () => {
    // Die Gegenrichtung von E.1, ebenfalls ausgefuehrt statt gelesen: wuerde OidcUnreachableError
    // eines Tages selbst einen Katalogschluessel als message tragen, waere die Ausnahme
    // ueberfluessig und muesste VERSCHWINDEN, statt als stille Luecke im Muster stehen zu bleiben.
    const vorgabe = new OidcUnreachableError().message;
    expect(
      Object.hasOwn(MELDUNGEN, vorgabe),
      `Der Vorgabewert der Klasse ist jetzt selbst ein Katalogschluessel (${vorgabe}) — dann traegt
sie einen Schluessel wie jeder andere Fehler, die Ausnahme in D ist ueberfluessig und gehoert
entfernt, nicht behalten.`,
    ).toBe(false);
    expect(AUSNAHMEN.has("OidcUnreachableError")).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// F · DAS SCHWEIGEN WIRD FESTGESCHRIEBEN
// ------------------------------------------------------------------------------------------------
describe("F · ein unbekannter Schluessel bleibt INTERNAL und verraet nichts", () => {
  // KEINE Verhaltensaenderung — F haelt den heutigen Stand von meldungen.ts:148-153 fest. Dass
  // dieser Fall eintreten KANN, ohne dass es jemand merkt, ist der Befund; D macht ihn hoerbar,
  // F sorgt dafuer, dass die Antwort dabei so wortkarg bleibt, wie sie sein muss.
  const UNBEKANNT = [
    "GIBT_ES_NICHT",
    "Nur Admins duerfen das.",
    "constructor",
    "toString",
    "",
  ] as const;

  for (const schluessel of UNBEKANNT) {
    it(`F.1 „${schluessel}" liefert in allen drei Sprachen den INTERNAL-Satz`, () => {
      for (const sprache of SPRACHEN) {
        expect(meldung(schluessel, sprache)).toBe(MELDUNGEN.INTERNAL[sprache]);
      }
    });
  }

  it("F.2 weder die Kennung noch eine Diagnose geht nach aussen", () => {
    for (const sprache of SPRACHEN) {
      const text = meldung("GEHEIME_KENNUNG_4711", sprache);
      expect(text).not.toContain("GEHEIME_KENNUNG_4711");
      expect(text).not.toContain("4711");
      expect(text).toBe(MELDUNGEN.INTERNAL[sprache]);
    }
  });

  it("F.3 ein bekannter Schluessel kommt weiterhin durch — F sperrt nicht alles", () => {
    for (const sprache of SPRACHEN) {
      expect(meldung("USER_NOT_FOUND", sprache)).toBe(MELDUNGEN.USER_NOT_FOUND[sprache]);
    }
  });

  it("F.4 eine unbekannte Sprache faellt auf Deutsch zurueck, nicht auf Leere", () => {
    expect(meldung("USER_NOT_FOUND", "fr")).toBe(MELDUNGEN.USER_NOT_FOUND.de);
    expect(meldung("USER_NOT_FOUND", undefined)).toBe(MELDUNGEN.USER_NOT_FOUND.de);
  });
});
