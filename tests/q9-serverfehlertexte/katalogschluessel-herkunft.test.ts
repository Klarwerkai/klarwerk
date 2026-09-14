// ================================================================================================
// JOB 3612 · Q9-KATALOGSPRACHE — WOHER JEDER SCHLÜSSEL KOMMT UND WELCHER DAVON GEMESSEN WIRD.
// ================================================================================================
//
// WOZU DIESE DATEI NEBEN `katalog.test.ts` STEHT. S1 dort verlangt von jedem der 29 Schlüssel drei
// verschiedene Sprachfassungen. Damit ist die Lücke GESCHLOSSEN — hier wird sie BENANNT: welcher
// Schlüssel kommt überhaupt woher, und welcher wird heute über eine echte Route gemessen? Ohne
// diese Antwort bleibt „ist übersetzt" eine Zusage ohne Umfang, und niemand sieht, dass 15 von 29
// Schlüsseln nie einen englischen oder niederländischen Satz an einem echten Draht zeigen.
// (JOB 3612: 19 von 28. JOB 3785 hat den SSO-Weg gemessen — drei neue Fälle in
// `sso-sprachfaelle.test.ts` — und eine falsche Auskunft berichtigt: `OIDC_UNREACHABLE` war nie
// ungemessen, der Wächter konnte die Form nur nicht lesen, siehe K5. JOB 3792 hat den 29. Schlüssel
// gebracht — `PERMISSION_MISSING`, der einzige mit einer Einsetzstelle — und ihn am Tag seiner
// Einführung gemessen, siehe `AUS_DEM_RECHTETOR` und `GEMESSEN_VON`.)
//
// Codex hat die drei auffälligsten selbst genannt — `OIDC_STATE_INVALID`, `ALREADY_SETUP`,
// `UNKNOWN_ROLE` (`archiv/3449/runde-2/ben.md`, HINWEIS 2). Die Listen unten sind NACHGEMESSEN,
// nicht abgeschrieben; die drei stehen darin.
//
// SIEBEN WÄCHTER, SIEBEN VERSCHIEDENE FRAGEN — keiner ersetzt den anderen:
//
//   H1  Taugt der Abtaster?      Findet er zu jeder Stelle ein auswertbares Argument — und hält er
//                                Zeichenketten und Kommentare heraus? (Ein Abtaster, der zu viel
//                                oder zu wenig findet, macht H2–H5 still falsch.)
//   H2  Was wird GEWORFEN?       Welche Schlüssel stehen als zweites Argument eines
//                                `new AuthError(` unter services/auth/src? Die Liste ist gepinnt:
//                                wandert ein Schlüssel in eine Wurfstelle oder aus ihr heraus,
//                                wird H2 rot und nennt ihn.
//   H3  Was kommt AUS DER ROUTE? Welche Schlüssel setzt `meldung("…")` dort wörtlich ein? Und:
//                                decken beide Listen zusammen den ganzen Katalog ab — gibt es also
//                                weder einen toten Schlüssel noch eine übersehene Quelle?
//   H4  Was ist GEMESSEN?        Welche Schlüssel prüft heute ein AKTIVER Fall, der die App
//                                wirklich fährt, in EN oder NL? Der Rest ist die Liste dieses
//                                Auftrags.
//   H5  Steht jeder im KATALOG?  Löst jeder wörtlich verwendete Schlüssel in `MELDUNGEN` auf?
//   H6  Taugt der Fallabtaster?  Zählt H4 nur aktive Prüffälle — und erkennt er `skip`, `only` und
//                                die `it.each`-Tabelle richtig?
//   H7  Taugt der zweite Zugang? Erkennt H4 auch den Fall, der den Satz aus dem KATALOG holt
//                                (`MELDUNGEN.X.en`) statt ihn abzuschreiben — und hält er dabei
//                                dieselben Bedingungen ein wie beim Literal? (K5)
//
// WARUM H5 NICHT ÜBERFLÜSSIG IST. An den Wurfstellen trägt das heute der Typzusatz
// `"…" satisfies Meldungsschluessel`. An den 19 `meldung("…", sprache)`-Aufrufen in `routes.ts`
// trägt es NICHTS: `meldung(schluessel: string, …)` nimmt jede Zeichenkette. Ein Tippfehler dort
// oder eine Umbenennung im Katalog, die den Aufruf stehen lässt, lässt die Route mit ihrem
// richtigen Status, aber dem Text „Unerwarteter Fehler." antworten (`meldungen.ts:149-151`) — still,
// bei grünem Typprüfer und grünem `services/auth`.
//
// NICHT DIE FRAGE DIESER DATEI: ob ein `new AuthError(` einen freien SATZ statt eines Schlüssels
// trägt. Das ist der Gegenstand von JOB 3580 und bleibt hier draußen; H5 prüft nur die Schlüssel,
// die wörtlich dastehen, und H2 hält fest, welche das sind.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2 — DIE DREI KORREKTURPFLICHTEN DES PRÜFERS (BEN, Runde 1)
// ------------------------------------------------------------------------------------------------
//
//   K1  „Aufrufe syntaktisch erkennen." Der Abtaster schnitt Kommentare heraus, suchte danach aber
//       auch INNERHALB von Zeichenketten. BENs Gegenprobe G1 — `void 'new AuthError("NOT_FOUND",
//       "BEN_NICHT_IM_KATALOG")';` in `service.ts` — machte H2 und H5 rot, obwohl dort nur eine
//       Zeichenkette stand: ein Wächter, der bei einem Text über Code losgeht. Jetzt wird VOR dem
//       Suchen auch der Inhalt jeder Zeichenkette geleert (`ohneZeichenketten`, längen- und
//       zeilentreu); gesucht wird in der Maske, gelesen wird im echten Text. Die Fälle H1.10–H1.13
//       halten beide Richtungen fest: der Text zählt nicht, derselbe Ausdruck als echter Aufruf
//       zählt.
//
//   K2  „Wörtliche Schlüssel unabhängig vom Anführungszeichen auswerten." `schluesselAus` erkannte
//       nur `"KEY"`. BENs G2 — `void meldung('BEN_NICHT_IM_KATALOG', 'en');` in `routes.ts` — blieb
//       deshalb grün: ein Schlüssel, den es im Katalog nicht gibt, an einem echten Aufruf, und H5
//       schwieg. Jetzt zählt jede der drei Schreibweisen (`"…"`, `'…'`, `` `…` ``); H1.14–H1.16
//       kalibrieren das.
//
//   K3  „Routendeckung an aktive Antwortprüfungen binden." H4 nahm ein bloßes Textvorkommen in
//       einer Datei mit `app.inject(` als Deckungsbeleg. BENs G3 — die Routensuite dieses Ordners
//       auf `describe.skip` gestellt — ließ 16 Fälle übersprungen und H4 grün: der Wächter zählte
//       abgeschaltete Fälle als Messung. Jetzt zählt ein Satz nur, wenn er
//         (a) in einer Zeichenkette steht (nicht in Prosa, nicht im Quelltext),
//         (b) im Bereich eines `it`/`test`-Falls liegt, der AKTIV ist — kein `skip`, `todo`,
//             `failing`, `skipIf`/`runIf` an ihm oder einem umgebenden `describe`, und bei einem
//             `only` irgendwo in der Datei nur der `only`-Zweig,
//         (c) dieser Fall mindestens eine `expect`-Prüfung enthält, und
//         (d) der Satz einem AUFRUF übergeben wird — der `it(`-Klammer selbst genügt nicht, sonst
//             zählte eine tote `const t = "…"` im Fallrumpf als Messung. Die `it.each`-Tabelle
//             zählte hier noch allein (Form R9/R10 in `server.test.ts`) — genau das verschärft K4.
//       H6 kalibriert jede dieser vier Bedingungen einzeln, G3 als Fall H6.2/H6.11.
//
//   K4  „Tabellenwerte erst bei tatsächlicher Antwortprüfung als Deckung zählen." (Runde 2, BEN.)
//       Bis hierher genügte für die Form R9/R10 der Satz IN DER `it.each`-Tabelle. BENs Gegenprobe
//       G5 — in `server.test.ts` den Vergleich `sprachvertrag(res.json().message, text, wort)`
//       durch `expect(res.json().message).toBeTruthy()` ersetzen, die Tabelle unangetastet lassen —
//       liess H4 und H4.2 grün: der Wächter zählte einen Satz, den der Fall gar nicht mehr ansieht.
//       Jetzt gilt für JEDEN gezählten Satz zusätzlich:
//         (e) Steht er in der `each`-Tabelle, wird seine SPALTE bestimmt und daraus der Parameter,
//             den der Rückruf an dieser Stelle bindet (`(sprache, text, wort)` → Spalte 1 = `text`).
//             Gezählt wird nur, wenn DIESER Parameter im Rumpf an einen Aufruf übergeben wird —
//             steht er nirgends mehr, ist der Satz nicht mehr gemessen.
//         (f) Die Anweisung, die den Satz (oder den gebundenen Parameter) trägt, muss ausserdem
//             einen BEOBACHTUNGSAUSDRUCK enthalten: eine Gliederkette auf einem Namen, der weder
//             `expect` noch ein Tabellenparameter ist — `res.json().message`, `res.headers[…]`.
//             `expect(text).toBeTruthy()` hat keinen; `expect(res.json().message).toBe(text)` hat
//             einen. Damit fällt auch die gleiche Verstellung am WÖRTLICHEN Satz auf:
//             `sprachvertrag("Email or password is incorrect.")` ohne Antwortargument zählt nicht
//             mehr. H6.14–H6.21 kalibrieren beide Richtungen einzeln.
//
//   K5  „Ein Wächter darf über sich selbst nichts Falsches behaupten." (JOB 3785.) Bis hierher
//       zählte ein Satz nur, wenn er WÖRTLICH im Fall stand. `OIDC_UNREACHABLE` stand deshalb in
//       `OHNE_ROUTENFALL`, und H4 sagte dazu „kein aktiver Fall sieht ihren Satz je an einer echten
//       Antwort" — nachweislich falsch: `tests/q9-oidc-literalquelle/…` E.1 fährt einen echten
//       Callback und hält `antwort.message` gegen `MELDUNGEN.OIDC_UNREACHABLE[sprache]`, in EN und
//       NL. Ein Wächter, der die Lücke GRÖSSER meldet als sie ist, entwertet sein eigenes Urteil.
//       Jetzt zählt neben dem Literal auch der Katalogzugriff (`MELDUNGEN.<SCHLUESSEL>.<sprache>`
//       und `…[<sprachausdruck>]`) — unter denselben Bedingungen (a)–(f), nicht unter weicheren.
//       Dazu gehört ein Eintrag mehr in `KEINE_BEOBACHTUNG`: der Zugriff bringt seine eigene
//       Gliederkette mit, und ohne `MELDUNGEN` darin wäre Bedingung (f) für ihn leer gewesen.
//       H7.1–H7.19 kalibrieren beide Richtungen einzeln.
//
// WAS H4 DAMIT BEWEIST UND WAS NICHT — ehrlich benannt. Bewiesen ist: der Satz steht in einem
// aktiven, prüfenden Fall einer Datei, die die App über `app.inject(` fährt, er wird einem Aufruf
// übergeben (aus der Tabelle über den gebundenen Parameter), und in derselben Anweisung wird etwas
// aus der Antwort GELESEN. NICHT bewiesen ist durch den Quelltext allein, dass die Prüfung den Satz
// gegen genau diesen gelesenen Wert hält — das kann nur der Fall selbst zusagen (in
// `server.test.ts` tut es `sprachvertrag()`, :8-12). H4 ist die Umfangsauskunft, nicht die Zusage
// des Routenfalls. Die Fehlerrichtung ist auch hier laut statt still: eine ungewöhnliche Form
// (Antwort in einer eigenen Zeile zwischengelagert, Rückruf als `function`, Parameter zerlegt)
// zählt NICHT als Deckung — der Schlüssel wandert dann in die Liste von H4 und wird dort rot
// gemeldet, statt unbemerkt als gemessen zu gelten.
//
// FEHLERRICHTUNG DES ABTASTERS. `ohneZeichenketten` kennt keine Regex-Literale (die Erkennung dafür
// liegt in `quelltext.ts` und ist dort nicht ausgeführt). Verwechselt es ein `"` in einem Regex mit
// einem Zeichenkettenanfang, LEERT es zu viel: Aufrufstellen verschwinden (H2/H3 werden rot, weil
// die Pins nicht mehr stimmen), Sätze verschwinden (H4 wird rot, weil die Liste wächst), und H1.9
// meldet Stellen ohne Argument. Der Abtaster kann also laut scheitern, nicht still blind werden.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import { ohneKommentare, zeichenketteEnde, zeileVon } from "../q9-oidc-literalquelle/quelltext";

const WURZEL = resolve(__dirname, "..", "..");
const AUTH_SRC = join(WURZEL, "services", "auth", "src");
const KATALOG_DATEI = join(AUTH_SRC, "meldungen.ts");
// Diese Datei nennt `app.inject(` als Suchwort und läge sonst in ihrer eigenen Trefferliste.
const DIESE_DATEI = join(__dirname, "katalogschluessel-herkunft.test.ts");
const KATALOGSCHLUESSEL = Object.keys(MELDUNGEN).sort();

function relativ(pfad: string): string {
  return relative(WURZEL, pfad).split("\\").join("/");
}

// ------------------------------------------------------------------------------------------------
// WERKZEUG · KLAMMERN UND ZEICHENKETTEN
// ------------------------------------------------------------------------------------------------

/** Index hinter der Klammer, die die bei `start` geöffnete schliesst; Zeichenketten zählen nicht. */
function paarEnde(quelle: string, start: number): number {
  let tiefe = 0;
  let i = start;
  while (i < quelle.length) {
    const c = quelle[i] ?? "";
    if (c === '"' || c === "'" || c === "`") {
      i = zeichenketteEnde(quelle, i);
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      tiefe += 1;
    } else if (c === ")" || c === "]" || c === "}") {
      tiefe -= 1;
      if (tiefe === 0) {
        return i + 1;
      }
    }
    i += 1;
  }
  return quelle.length;
}

/** Index der Klammer, die die bei `schluss` stehende öffnet — die Gegenrichtung zu `paarEnde`. */
function gruppeAnfang(maske: string, schluss: number, von: number): number {
  let tiefe = 0;
  for (let i = schluss; i >= von; i -= 1) {
    const c = maske[i] ?? "";
    if (c === ")" || c === "]" || c === "}") {
      tiefe += 1;
    } else if (c === "(" || c === "[" || c === "{") {
      tiefe -= 1;
      if (tiefe === 0) {
        return i;
      }
    }
  }
  return von;
}

/**
 * Die Bereiche der Elemente, die in der bei `klammer` geöffneten Gruppe durch Kommas der obersten
 * Ebene getrennt sind — für die Zeilen und Spalten einer `each`-Tabelle und für Parameterlisten.
 * Ein Schlusskomma hinterlässt ein leeres letztes Stück; ein leeres Stück MITTENDRIN bleibt stehen,
 * denn in JavaScript ist es ein echtes Loch und verschiebt alle folgenden Spalten.
 */
function elemente(maske: string, klammer: number): [number, number][] {
  const teile: [number, number][] = [];
  let tiefe = 0;
  let start = klammer + 1;
  for (let i = klammer + 1; i < maske.length; i += 1) {
    const c = maske[i] ?? "";
    if (c === "(" || c === "[" || c === "{") {
      tiefe += 1;
    } else if (c === ")" || c === "]" || c === "}") {
      if (tiefe === 0) {
        teile.push([start, i]);
        break;
      }
      tiefe -= 1;
    } else if (c === "," && tiefe === 0) {
      teile.push([start, i]);
      start = i + 1;
    }
  }
  const leer = (bereich: [number, number] | undefined): boolean =>
    bereich !== undefined && maske.slice(bereich[0], bereich[1]).trim() === "";
  while (leer(teile[teile.length - 1])) {
    teile.pop();
  }
  return teile;
}

/**
 * KORREKTURPFLICHT K1. Derselbe Quelltext, längen- und zeilentreu, aber mit GELEERTEM
 * Zeichenketteninhalt: aus `void 'new AuthError("X")'` wird `void '                    '`. Nur so
 * kann ein Suchmuster nicht mehr in einem Text losgehen, den niemand ausführt — und weil die Maske
 * Zeichen für Zeichen deckungsgleich bleibt, zeigt derselbe Index in der Maske und im echten Text
 * auf dieselbe Stelle: gesucht wird in der Maske, das Argument gelesen wird im echten Text.
 *
 * `${…}` in einer Vorlagenzeichenkette bleibt Code — dort kann ein echter Aufruf stehen (H1.13).
 */
function ohneZeichenketten(quelle: string): string {
  const zeichen = quelle.split("");
  const leere = (von: number, bis: number): void => {
    for (let k = Math.max(von, 0); k < Math.min(bis, zeichen.length); k += 1) {
      if (zeichen[k] !== "\n") {
        zeichen[k] = " ";
      }
    }
  };
  const gehe = (von: number, bis: number): void => {
    let i = von;
    while (i < bis) {
      const c = quelle[i] ?? "";
      if (c === '"' || c === "'") {
        const ende = Math.min(zeichenketteEnde(quelle, i), bis);
        leere(i + 1, ende - 1);
        i = Math.max(ende, i + 1);
        continue;
      }
      if (c === "`") {
        const ende = Math.min(zeichenketteEnde(quelle, i), bis);
        let k = i + 1;
        let textAb = k;
        while (k < ende - 1) {
          if (quelle[k] === "\\") {
            k += 2;
            continue;
          }
          if (quelle[k] === "$" && quelle[k + 1] === "{") {
            leere(textAb, k);
            const zu = paarEnde(quelle, k + 1);
            gehe(k + 2, Math.min(zu - 1, ende - 1));
            k = Math.max(Math.min(zu, ende - 1), k + 1);
            textAb = k;
            continue;
          }
          k += 1;
        }
        leere(textAb, ende - 1);
        i = Math.max(ende, i + 1);
        continue;
      }
      i += 1;
    }
  };
  gehe(0, quelle.length);
  return zeichen.join("");
}

// Nach diesen Wörtern ist eine runde Klammer kein Aufruf, sondern eine Bedingung oder ein Rumpf.
const KEIN_AUFRUF = new Set([
  "if",
  "for",
  "while",
  "switch",
  "catch",
  "return",
  "typeof",
  "await",
  "yield",
  "function",
  "do",
  "else",
  "in",
  "of",
  "delete",
  "void",
  "case",
  "throw",
  "new",
]);

/** Öffnet die Klammer bei `klammer` eine Argumentliste — steht also ein Aufrufziel davor? */
function aufrufKlammer(maske: string, klammer: number): boolean {
  let j = klammer - 1;
  while (j >= 0 && /\s/.test(maske[j] ?? "")) {
    j -= 1;
  }
  if (j < 0) {
    return false;
  }
  const c = maske[j] ?? "";
  if (c === ")" || c === "]") {
    return true;
  }
  if (!/[A-Za-z0-9_$]/.test(c)) {
    return false;
  }
  let k = j;
  while (k >= 0 && /[A-Za-z0-9_$]/.test(maske[k] ?? "")) {
    k -= 1;
  }
  return !KEIN_AUFRUF.has(maske.slice(k + 1, j + 1));
}

/**
 * Je Stelle: der Index der öffnenden Klammer des INNERSTEN Aufrufs, in dessen Argumentliste sie
 * liegt — oder -1. `{}` und `[]` unterbrechen die Zuordnung nicht, denn eine Tabelle in einem
 * Aufrufargument (`it.each([[…]])`) ist übergebene Fracht wie jedes andere Argument.
 */
function innersteAufrufe(maske: string): number[] {
  const zu = new Array<number>(maske.length).fill(-1);
  const offene: number[] = [];
  const istAufruf: boolean[] = [];
  for (let i = 0; i < maske.length; i += 1) {
    const c = maske[i] ?? "";
    if (c === "(") {
      const aufruf = aufrufKlammer(maske, i);
      istAufruf.push(aufruf);
      if (aufruf) {
        offene.push(i);
      }
    }
    zu[i] = offene.length > 0 ? (offene[offene.length - 1] ?? -1) : -1;
    if (c === ")") {
      if (istAufruf.pop() === true) {
        offene.pop();
      }
    }
  }
  return zu;
}

// ------------------------------------------------------------------------------------------------
// DER ABTASTER FÜR AUFRUFSTELLEN
// ------------------------------------------------------------------------------------------------
//
// Gesucht wird das n-te Argument eines Aufrufs. Ein Regex wie /new AuthError\(\s*"[^"]*",\s*"([^"]*)"/
// beantwortet das falsch, sobald ein Argument ein Komma enthält, über mehrere Zeilen geht, eine
// geschachtelte Klammer trägt oder ein `satisfies` anhängt — und alle vier Formen stehen heute im
// Produkt. Der Abtaster zählt deshalb Klammertiefe und überspringt Zeichenketten mit demselben
// Werkzeug, das schon `tests/q9-oidc-literalquelle/` benutzt (kein zweiter Kommentarschneider,
// kein zweites Zeichenketten-Ende).

/** Die Rohtexte der Argumente eines Aufrufs, dessen öffnende Klammer bei `klammer` steht. */
function argumente(quelle: string, klammer: number): string[] {
  const teile: string[] = [];
  let tiefe = 0;
  let start = klammer + 1;
  let i = start;
  while (i < quelle.length) {
    const c = quelle[i];
    if (c === '"' || c === "'" || c === "`") {
      i = zeichenketteEnde(quelle, i);
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      tiefe += 1;
    } else if (c === ")" || c === "]" || c === "}") {
      if (c === ")" && tiefe === 0) {
        teile.push(quelle.slice(start, i));
        // Ein Schlusskomma hinterlässt ein leeres letztes Stück; es ist kein Argument.
        return teile.map((t) => t.trim()).filter((t) => t !== "");
      }
      tiefe -= 1;
    } else if (c === "," && tiefe === 0) {
      teile.push(quelle.slice(start, i));
      start = i + 1;
    }
    i += 1;
  }
  // Unbalanciert: lieber nichts als eine erfundene Argumentliste — H1 wird darüber rot.
  return [];
}

// KORREKTURPFLICHT K2: alle drei Schreibweisen eines wörtlichen Schlüssels. `meldung()` nimmt jede
// Zeichenkette; welches Anführungszeichen der Aufruf benutzt, ist für die Route ohne Bedeutung —
// für einen Wächter, der nur `"…"` kennt, war es der blinde Fleck (BEN, G2).
const SCHLUESSEL_LITERAL = /^(["'`])([A-Z][A-Z0-9_]*)\1$/;

/** Der Schlüssel, den ein Argument wörtlich trägt — oder `null`, wenn dort kein Literal steht. */
function schluesselAus(argument: string): string | null {
  const ohneZusatz = argument.replace(/\s+satisfies\s+[A-Za-z0-9_.$]+$/, "").trim();
  return SCHLUESSEL_LITERAL.exec(ohneZusatz)?.[2] ?? null;
}

type Stelle = { ort: string; argument: string; schluessel: string | null };

/** Jede Fundstelle von `muster` in `quelle` samt dem `nr`-ten Argument (0-basiert). */
function stellen(quelle: string, datei: string, muster: RegExp, nr: number): Stelle[] {
  const rein = ohneKommentare(quelle);
  // K1: gesucht wird in der Maske (Zeichenketteninhalt geleert), gelesen im echten Text. Beide sind
  // zeichenweise deckungsgleich, der Index gilt in beiden.
  const maske = ohneZeichenketten(rein);
  const gefunden: Stelle[] = [];
  for (const treffer of maske.matchAll(muster)) {
    const index = treffer.index ?? 0;
    const argument = argumente(rein, index + treffer[0].length - 1)[nr] ?? "";
    gefunden.push({
      ort: `${datei}:${zeileVon(rein, index)}`,
      argument,
      schluessel: schluesselAus(argument),
    });
  }
  return gefunden;
}

// `new AuthError(<code>, <schluessel>)` — das ZWEITE Argument trägt den Meldungsschlüssel; das
// erste ist der `AuthErrorCode`, der den HTTP-Status wählt und zufällig ähnlich heisst.
const WURF_MUSTER = /\bnew\s+AuthError\s*\(/g;
// `meldung(<schluessel>, <sprache>)` — der Blick zurück schliesst `fehlermeldung(` und `x.meldung(`
// aus: gesucht ist die eine freie Funktion aus dem Katalogmodul, nicht jeder ähnliche Name.
const EINSATZ_MUSTER = /(?<![A-Za-z0-9_$.])meldung\s*\(/g;

/** Alle `.ts`-Quelldateien unter services/auth/src ohne die Testdateien und ohne den Katalog. */
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
      if (pfad === KATALOG_DATEI) {
        continue;
      }
      gefunden.push(pfad);
    }
  };
  laufe(AUTH_SRC);
  return gefunden;
}

const WURFSTELLEN: Stelle[] = [];
const EINSATZSTELLEN: Stelle[] = [];
for (const pfad of authQuellen()) {
  const quelle = readFileSync(pfad, "utf8");
  WURFSTELLEN.push(...stellen(quelle, relativ(pfad), WURF_MUSTER, 1));
  EINSATZSTELLEN.push(...stellen(quelle, relativ(pfad), EINSATZ_MUSTER, 0));
}

function schluesselVon(liste: Stelle[]): string[] {
  return [...new Set(liste.flatMap((s) => (s.schluessel === null ? [] : [s.schluessel])))].sort();
}

// ------------------------------------------------------------------------------------------------
// H1 · KALIBRIERUNG — der Abtaster an genau den Formen, die im Produkt stehen
// ------------------------------------------------------------------------------------------------
describe("H1 · der Abtaster liest das richtige Argument", () => {
  const FAELLE: { form: string; quelle: string; muster: RegExp; nr: number; erwartet: string[] }[] =
    [
      {
        form: "einzeilig mit satisfies",
        quelle:
          'throw new AuthError("NOT_FOUND", "USER_NOT_FOUND" satisfies Meldungsschluessel);\n',
        muster: WURF_MUSTER,
        nr: 1,
        erwartet: ["X.ts:1 → USER_NOT_FOUND"],
      },
      {
        form: "mehrzeilig mit Schlusskomma — die Zeile des Aufrufs, nicht die des Arguments",
        quelle:
          'throw new AuthError(\n  "INVALID_CREDENTIALS",\n  "RESET_TOKEN_INVALID" satisfies M,\n);\n',
        muster: WURF_MUSTER,
        nr: 1,
        erwartet: ["X.ts:1 → RESET_TOKEN_INVALID"],
      },
      {
        form: "ein Komma IM Text trennt kein Argument",
        quelle: 'throw new AuthError("NOT_FOUND", "Kein Konto, kein Zugang.");\n',
        muster: WURF_MUSTER,
        nr: 1,
        // Ein freier Satz ist kein Schlüssel: H5 übergeht ihn, H2 vermisst den fehlenden Schlüssel.
        erwartet: [`X.ts:1 → (kein Literal) «"Kein Konto, kein Zugang."»`],
      },
      {
        form: "geschachtelte Klammer im ersten Argument",
        quelle: 'throw new AuthError(codeVon(a, b), "INTERNAL");\n',
        muster: WURF_MUSTER,
        nr: 1,
        erwartet: ["X.ts:1 → INTERNAL"],
      },
      {
        form: "Schlüssel aus einer Variablen — nicht statisch prüfbar",
        quelle: "reply.send({ message: meldung(schluessel, sprache) });\n",
        muster: EINSATZ_MUSTER,
        nr: 0,
        erwartet: ["X.ts:1 → (kein Literal) «schluessel»"],
      },
      {
        form: "wörtlicher Schlüssel im Routenaufruf",
        quelle: 'reply.send({ message: meldung("ALREADY_SETUP", sprache(request)) });\n',
        muster: EINSATZ_MUSTER,
        nr: 0,
        erwartet: ["X.ts:1 → ALREADY_SETUP"],
      },
      {
        form: "auskommentierter Aufruf zählt nicht",
        quelle: '// meldung("ALREADY_SETUP", sprache);\nconst a = 1;\n',
        muster: EINSATZ_MUSTER,
        nr: 0,
        erwartet: [],
      },
      {
        form: "ein ähnlicher Name ist nicht dieselbe Funktion",
        quelle: 'const t = fehlermeldung("ALREADY_SETUP");\nconst u = log.meldung("INTERNAL");\n',
        muster: EINSATZ_MUSTER,
        nr: 0,
        erwartet: [],
      },
      // ------------------------------------------------------------------------------------------
      // K1 · EIN AUSGESCHRIEBENER AUFRUF IN EINER ZEICHENKETTE IST KEIN AUFRUF
      // ------------------------------------------------------------------------------------------
      {
        // Genau BENs Gegenprobe G1. Bis Runde 1 machte diese Zeile H2 und H5 rot.
        form: "K1 Wurf, ausgeschrieben in einer einfach zitierten Zeichenkette",
        quelle: 'void \'new AuthError("NOT_FOUND", "BEN_NICHT_IM_KATALOG")\';\n',
        muster: WURF_MUSTER,
        nr: 1,
        erwartet: [],
      },
      {
        form: "K1 Einsatz, ausgeschrieben in einer doppelt zitierten Zeichenkette mit Escapes",
        quelle: 'const hinweis = "meldung(\\"ALREADY_SETUP\\", sprache) ist der Weg";\n',
        muster: EINSATZ_MUSTER,
        nr: 0,
        erwartet: [],
      },
      {
        form: "K1 Wurf, ausgeschrieben in einer Vorlagenzeichenkette",
        quelle: 'const hinweis = `new AuthError("NOT_FOUND", "BEN_NICHT_IM_KATALOG")`;\n',
        muster: WURF_MUSTER,
        nr: 1,
        erwartet: [],
      },
      {
        // Die Gegenrichtung: in `${…}` steht Code, und dort zählt ein echter Aufruf.
        form: "K1 echter Aufruf in einem ${…} einer Vorlagenzeichenkette zählt",
        quelle: 'const t = `Fehler: ${meldung("ALREADY_SETUP", sprache)}`;\n',
        muster: EINSATZ_MUSTER,
        nr: 0,
        erwartet: ["X.ts:1 → ALREADY_SETUP"],
      },
      // ------------------------------------------------------------------------------------------
      // K2 · JEDE SCHREIBWEISE EINES WÖRTLICHEN SCHLÜSSELS ZÄHLT
      // ------------------------------------------------------------------------------------------
      {
        // Genau BENs Gegenprobe G2. Bis Runde 1 blieb H5 dazu stumm.
        form: "K2 einfach zitierter Schlüssel am echten Einsatz",
        quelle: "void meldung('BEN_NICHT_IM_KATALOG', 'en');\n",
        muster: EINSATZ_MUSTER,
        nr: 0,
        erwartet: ["X.ts:1 → BEN_NICHT_IM_KATALOG"],
      },
      {
        form: "K2 einfach zitierter Schlüssel mit satisfies an der Wurfstelle",
        quelle: "throw new AuthError('NOT_FOUND', 'USER_NOT_FOUND' satisfies M);\n",
        muster: WURF_MUSTER,
        nr: 1,
        erwartet: ["X.ts:1 → USER_NOT_FOUND"],
      },
      {
        form: "K2 Schlüssel in einer Vorlagenzeichenkette ohne Einsetzung",
        quelle: "void meldung(`ALREADY_SETUP`, sprache);\n",
        muster: EINSATZ_MUSTER,
        nr: 0,
        erwartet: ["X.ts:1 → ALREADY_SETUP"],
      },
    ];

  for (const { form, quelle, muster, nr, erwartet } of FAELLE) {
    it(`H1 liest: ${form}`, () => {
      // Ein Wächter, der an einer dieser Formen hängen bleibt, wird still blind statt rot — deshalb
      // läuft die Kalibrierung durch DENSELBEN Code wie die echte Messung, nicht durch eine Kopie.
      const gelesen = stellen(quelle, "X.ts", muster, nr).map((s) =>
        s.schluessel === null
          ? `${s.ort} → (kein Literal) «${s.argument}»`
          : `${s.ort} → ${s.schluessel}`,
      );
      expect(gelesen).toEqual(erwartet);
    });
  }

  it("H1.9 jede gefundene Stelle im Produkt trägt ein auswertbares Argument", () => {
    const leer = [...WURFSTELLEN, ...EINSATZSTELLEN]
      .filter((s) => s.argument === "")
      .map((s) => s.ort);
    expect(
      leer,
      `Ohne Argument hat der Abtaster die Stelle nicht verstanden (unbalancierte Klammern,
neue Aufrufform). H2 bis H5 wären dann still grün: ${leer.join(" · ")}`,
    ).toEqual([]);
    const blind = "der Abtaster ist blind geworden";
    expect(WURFSTELLEN.length, `keine einzige Wurfstelle gefunden — ${blind}`).toBeGreaterThan(0);
    expect(EINSATZSTELLEN.length, `keine einzige Einsatzstelle — ${blind}`).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------------------------------------
// H2/H3 · HERKUNFT — die namentlichen Listen
// ------------------------------------------------------------------------------------------------
//
// Beide Listen sind gepinnt und alphabetisch. Sie zu pflegen kostet eine Zeile; ohne sie sagt kein
// Test, WELCHE Schlüssel ihre Quelle gewechselt haben — nur noch, dass irgendetwas anders ist.

/** Zweites Argument eines `new AuthError(` unter services/auth/src (gemessen: 21 Stellen, alle in
 *  `service.ts`).
 *
 *  `INTERNAL` kam mit JOB 3665 hinzu: `setAccessExpiry` lehnt ein unparsbares Ablaufdatum ab
 *  (`service.ts:411`). Der Schlüssel ist kein neuer — er stand schon in `AUS_DER_ROUTE`, der Dienst
 *  wirft ihn jetzt zusätzlich selbst. Die Frage, die H2 mitstellt, ist damit beantwortet: einen
 *  eigenen Routenfall in EN/NL braucht dieser Weg nicht, denn `INTERNAL` hat ihn bereits
 *  (`GEMESSEN_VON.INTERNAL` → server.test.ts · R12). H4 und H3.2 verschieben sich dadurch nicht:
 *  H4 misst gegen den Katalog, und die Vereinigung aus Wurf und Route enthielt `INTERNAL` schon.
 *
 *  `ACCESS_EXPIRED` kam mit JOB 3756 hinzu — die Zahl der Stellen bleibt 21, zwei davon tragen nur
 *  einen anderen Schlüssel: die beiden Ablauf-Würfe in `login` und `loginWithOidc` liehen sich bis
 *  dahin `NOT_APPROVED` (der FEHLERCODE bleibt dort `NOT_APPROVED`, nur der Meldungsschlüssel
 *  wechselt — H2 liest das zweite Argument, nicht das erste). Anders als bei `INTERNAL` ist das ein
 *  NEUER Katalogschlüssel: er verschiebt H3.2 (die Vereinigung muss ihn decken, und sie tut es über
 *  diese Liste) und H4 (er hat von Anfang an einen Routenfall in EN/NL, s. `GEMESSEN_VON`, und
 *  gehört deshalb NICHT in `OHNE_ROUTENFALL`). */
const GEWORFEN = [
  "ACCESS_EXPIRED",
  "ACCOUNT_NOT_FOUND",
  "CURRENT_PASSWORD_INCORRECT",
  "EMAIL_TAKEN",
  "INTERNAL",
  "INVALID_CREDENTIALS",
  "LAST_ADMIN_DELETION",
  "LAST_ADMIN_DEMOTION",
  "NOT_APPROVED",
  "OIDC_ACCOUNT_MISSING",
  "RESET_TOKEN_INVALID",
  "SELF_DEMOTION_FORBIDDEN",
  "USER_NOT_FOUND",
  "WEAK_PASSWORD",
];

/** Wörtlich in einem `meldung("…", sprache)` der Routen (gemessen: 20 Aufrufe in `routes.ts`,
 *  davon 19 mit wörtlichem Schlüssel). */
const AUS_DER_ROUTE = [
  "ADMIN_REQUIRED",
  "ALREADY_SETUP",
  "EMAIL_REQUIRED",
  "INTERNAL",
  "LOGIN_RATE_LIMITED",
  "NAME_REQUIRED",
  "NOT_SIGNED_IN",
  "OIDC_DISABLED",
  "OIDC_LOGIN_FAILED",
  "OIDC_STATE_INVALID",
  "REGISTRATION_DISABLED",
  "REGISTRATION_RATE_LIMITED",
  "RESET_RATE_LIMITED",
  "UNKNOWN_ROLE",
  "WEAK_PASSWORD",
];

/**
 * Der eine Schlüssel, den keine der beiden Suchen sehen kann: `sendError` wählt ihn in einer
 * Variablen (`error instanceof OidcUnreachableError ? "OIDC_UNREACHABLE" : …`) und gibt die
 * Variable an `meldung()` weiter. Er steht hier namentlich, damit die Vereinigung unten den ganzen
 * Katalog deckt, ohne dass irgendwo eine stille Lücke als „geprüft" durchgeht.
 */
const NUR_UEBER_EINE_VARIABLE = ["OIDC_UNREACHABLE"];

/**
 * JOB 3792 · Die Schlüssel, die NICHT aus `services/auth/src` gesendet werden, sondern aus dem
 * App-Modul. `PERMISSION_MISSING` steht in `services/app/src/http.ts:200` — dem Rechtetor, das vor
 * jeder rechtegeschützten Route liegt. H2 und H3 sehen die Stelle nicht: beide suchen ausschliesslich
 * unter `services/auth/src` (`authQuellen`), und das bleibt so — dort liegen die Wurfstellen des
 * Dienstes, um die es H2/H3 geht.
 *
 * WAS DAS ALS PRÜFLÜCKE HEISST, benannt statt verschwiegen: H5 kann für diesen Schlüssel nicht
 * bürgen. Ein Tippfehler in `meldung("PERMISSION_MISSNG", …)` fiele diesem Wächter nicht auf,
 * sondern erst dem Draht — und dort tut er es: `tests/q9-rechtefehler/rechtetor-sprachfaelle.test.ts`
 * hält den Satz in allen drei Sprachen gegen eine echte 403-Antwort, ein Rückfall auf
 * „Unerwarteter Fehler." macht Q1 bis Q4 rot. Die Liste hier hält die Deckung von H3.2 vollständig
 * (kein toter Schlüssel), ohne so zu tun, als sei die Stelle abgetastet worden.
 */
const AUS_DEM_RECHTETOR = ["PERMISSION_MISSING"];

/**
 * Was sich zwischen gepinnter und gemessener Liste verschoben hat — namentlich. Ohne diesen Satz
 * meldet Vitest nur `expected [ 'ACCOUNT_NOT_FOUND', …(11) ] to deeply equal [ … ]`, und der
 * Mensch, der die Liste nachführen soll, muss selbst suchen, welcher Schlüssel gewandert ist.
 *
 * ZUERST DIE GEMESSENEN, DANN DIE GEPINNTEN. H4 führt eine Liste der UNGEMESSENEN und muss die
 * Reihenfolge deshalb umdrehen — vor Runde 2 tat es das nicht, und die Meldung stand auf dem Kopf:
 * BENs G3 nahm `OIDC_UNREACHABLE` die einzige Fremdsprachmessung, und H4 schrieb dazu „NEU
 * gemessen: OIDC_UNREACHABLE". Wer das liest, sucht den neuen Fall, den es nicht gibt.
 */
function verschiebung(gemessen: string[], gepinnt: string[]): string {
  const dazu = gemessen.filter((k) => !gepinnt.includes(k));
  const weg = gepinnt.filter((k) => !gemessen.includes(k));
  return (
    [
      dazu.length > 0 ? `NEU gemessen: ${dazu.join(", ")}` : "",
      weg.length > 0 ? `NICHT MEHR gemessen: ${weg.join(", ")}` : "",
    ]
      .filter((t) => t !== "")
      .join(" · ") || "keine"
  );
}

it("H2 die Wurfstellen tragen genau die gepinnten Schlüssel", () => {
  const gemessen = schluesselVon(WURFSTELLEN);
  expect(
    gemessen,
    `Diese Liste sagt, welche Meldung überhaupt aus dem Dienst kommt. Wandert ein Schlüssel hinein
oder heraus, gehört die Liste nachgeführt — und mit ihr die Frage, ob der neue Weg einen
Routenfall in EN/NL bekommt (H4). Verschoben hat sich: ${verschiebung(gemessen, GEWORFEN)}`,
  ).toEqual([...GEWORFEN].sort());
});

it("H3 die Routen setzen genau die gepinnten Schlüssel wörtlich ein", () => {
  const gemessen = schluesselVon(EINSATZSTELLEN);
  expect(
    gemessen,
    `Diese Aufrufe sind die ungeschützte Seite: \`meldung()\` nimmt jede Zeichenkette, der
Typprüfer schweigt. Was hier steht, muss im Katalog stehen (H5) und sollte gemessen sein (H4).
Verschoben hat sich: ${verschiebung(gemessen, AUS_DER_ROUTE)}`,
  ).toEqual([...AUS_DER_ROUTE].sort());
});

it("H3.2 Wurf, Route und die beiden Sonderwege decken zusammen den ganzen Katalog", () => {
  // Zwei Aussagen in einer: kein Katalogschlüssel ist tot (niemand sendet ihn mehr), und keine
  // Quelle ist übersehen. Ohne sie könnte H2 oder H3 beliebig schrumpfen, solange nur die Pins
  // mitschrumpfen.
  const gedeckt = [
    ...new Set([...GEWORFEN, ...AUS_DER_ROUTE, ...NUR_UEBER_EINE_VARIABLE, ...AUS_DEM_RECHTETOR]),
  ].sort();
  expect(
    gedeckt,
    `Jeder Schlüssel im Katalog braucht eine Stelle, die ihn sendet — sonst steht dort ein Text,
den niemand je zu sehen bekommt, und die Pflege der Übersetzung ist verschwendet.
Unterschied zum Katalog: ${verschiebung(gedeckt, KATALOGSCHLUESSEL)}`,
  ).toEqual(KATALOGSCHLUESSEL);
});

// ------------------------------------------------------------------------------------------------
// DER FALLABTASTER · WELCHER PRÜFFALL LÄUFT ÜBERHAUPT (KORREKTURPFLICHT K3)
// ------------------------------------------------------------------------------------------------
//
// `describe`/`it`/`test` samt Modifikatorkette werden von Hand abgetastet, nicht per Regex: die
// Kette kann Klammern tragen (`it.each([[…]])("…", fn)`, `it.skipIf(bedingung)("…", fn)`), und der
// Bereich des Falls reicht vom Wort bis hinter die schliessende Klammer des LETZTEN Aufrufs — die
// `each`-Tabelle gehört also dazu.

/** Modifikatoren, nach denen ein Fall nicht (oder nicht beweisbar) läuft. */
const AUS_MODIFIKATOR = new Set(["skip", "todo", "failing", "fails", "skipIf", "runIf"]);
/** Die einzigen Modifikatoren, die selbst eine Argumentklammer tragen (`it.each([…])("…", fn)`). */
const MIT_ARGUMENT = new Set(["each", "for", "skipIf", "runIf", "extend"]);
const BLOCK_WORT = /(?<![A-Za-z0-9_$.])(describe|suite|it|test)(?![A-Za-z0-9_$])/g;
const HAT_ERWARTUNG = /(?<![A-Za-z0-9_$.])expect(?![A-Za-z0-9_$])/;

type Block = {
  art: "gruppe" | "fall";
  name: string;
  von: number;
  bis: number;
  offen: number;
  /** K4: die Klammer der `each`/`for`-Tabelle, oder -1. Nur dort liegen gebundene Tabellenwerte. */
  tabelle: number;
  eigen: string[];
};

/** Der erste wörtliche Text in `text` — der Name, den Vitest anzeigt. */
function nameAus(text: string): string {
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i] ?? "";
    if (c === '"' || c === "'" || c === "`") {
      return text.slice(i + 1, Math.max(zeichenketteEnde(text, i) - 1, i + 1));
    }
  }
  return "(ohne Namen)";
}

function bloecke(maske: string, rein: string): Block[] {
  const gefunden: Block[] = [];
  for (const treffer of maske.matchAll(BLOCK_WORT)) {
    const wort = treffer[1] ?? "";
    const von = treffer.index ?? 0;
    let i = von + wort.length;
    const eigen: string[] = [];
    let offen = -1;
    let tabelle = -1;
    while (i < maske.length) {
      while (/\s/.test(maske[i] ?? "")) {
        i += 1;
      }
      if (maske[i] === ".") {
        i += 1;
        while (/\s/.test(maske[i] ?? "")) {
          i += 1;
        }
        const name = /^[A-Za-z0-9_$]+/.exec(maske.slice(i, i + 40))?.[0] ?? "";
        if (name === "") {
          break;
        }
        eigen.push(name);
        i += name.length;
        while (/\s/.test(maske[i] ?? "")) {
          i += 1;
        }
        // NUR diese Modifikatoren tragen eine eigene Klammer. Würde jede Klammer nach einem
        // Modifikator als seine gelesen, verschluckte `describe.skip("G", …)` den ganzen Block:
        // er hätte keinen Bereich mehr, die Fälle darin keinen abgeschalteten Vorfahren — und G3
        // bliebe grün. Genau daran scheiterte der erste Anlauf dieser Runde.
        if (MIT_ARGUMENT.has(name) && maske[i] === "(") {
          if (name === "each" || name === "for") {
            tabelle = i;
          }
          i = paarEnde(maske, i);
        }
        continue;
      }
      if (maske[i] === "(") {
        offen = i;
      }
      break;
    }
    if (offen < 0) {
      // Kein Aufruf (etwa `it.each\`tabelle\``, eine Zuweisung oder ein Import): kein Bereich, also
      // auch keine Deckung. Verschwindet dadurch ein heute gemessener Satz, wird H4 rot.
      continue;
    }
    const bis = paarEnde(maske, offen);
    gefunden.push({
      art: wort === "describe" || wort === "suite" ? "gruppe" : "fall",
      name: nameAus(rein.slice(offen, bis)),
      von,
      bis,
      offen,
      tabelle,
      eigen,
    });
  }
  return gefunden;
}

type Fall = {
  name: string;
  von: number;
  bis: number;
  offen: number;
  tabelle: number;
  /** K4: die Parameter des Rückrufs in ihrer Reihenfolge; `null`, wo kein Name ablesbar ist
   *  (zerlegt, Restparameter) — dann bindet keine Tabellenspalte, und nichts zählt. */
  parameter: (string | null)[];
  rumpfVon: number;
  rumpfBis: number;
};
type Stand = { ort: string; rein: string; maske: string; faelle: Fall[]; aufrufe: number[] };

/**
 * K4 · Der Rückruf eines Falls: seine Parameterliste und sein Rumpf. Gesucht wird der `=>` auf der
 * obersten Ebene der `it(`-Argumentliste — die Klammer der Parameter ist eine Gruppe darin, der
 * Pfeil steht dahinter. Ein Rückruf als `function (…)` wird bewusst NICHT gelesen: lieber keine
 * Deckung (der Schlüssel fällt in die Liste von H4) als eine behauptete.
 */
function rueckruf(
  maske: string,
  rein: string,
  offen: number,
  bis: number,
): { parameter: (string | null)[]; rumpfVon: number; rumpfBis: number } | null {
  let pfeil = -1;
  let tiefe = 0;
  for (let i = offen + 1; i < bis; i += 1) {
    const c = maske[i] ?? "";
    if (c === "(" || c === "[" || c === "{") {
      tiefe += 1;
    } else if (c === ")" || c === "]" || c === "}") {
      if (tiefe === 0) {
        break;
      }
      tiefe -= 1;
    } else if (c === "=" && maske[i + 1] === ">" && tiefe === 0) {
      pfeil = i;
      break;
    }
  }
  if (pfeil < 0) {
    return null;
  }
  let j = pfeil - 1;
  while (j > offen && /\s/.test(maske[j] ?? "")) {
    j -= 1;
  }
  const parameter: (string | null)[] = [];
  if (maske[j] === ")") {
    for (const [a, b] of elemente(maske, gruppeAnfang(maske, j, offen))) {
      const text = rein.slice(a, b).trim();
      // Zerlegte Parameter (`{ text }`) und Restparameter binden keine einzelne Spalte.
      parameter.push(/^[A-Za-z_$][A-Za-z0-9_$]*/.exec(text)?.[0] ?? null);
    }
  } else {
    let k = j;
    while (k > offen && /[A-Za-z0-9_$]/.test(maske[k - 1] ?? "")) {
      k -= 1;
    }
    parameter.push(/^[A-Za-z_$][A-Za-z0-9_$]*$/.exec(rein.slice(k, j + 1))?.[0] ?? null);
  }
  let r = pfeil + 2;
  while (r < bis && /\s/.test(maske[r] ?? "")) {
    r += 1;
  }
  const rumpfBis = maske[r] === "{" ? paarEnde(maske, r) : bis;
  return { parameter, rumpfVon: r, rumpfBis };
}

/**
 * K4 · Der Bereich der Anweisung um `pos`. Gruppen werden übersprungen, nicht betreten: aus
 * `expect(res.json().message).toBe(text)` wird die GANZE Zeile, nicht nur `text` — sonst zählte
 * genau die richtige Prüfform als ungeprüft. Grenze ist das `;` oder der Rand des Rumpfs.
 */
function anweisungsbereich(maske: string, pos: number, von: number, bis: number): [number, number] {
  let a = pos;
  while (a > von) {
    const c = maske[a - 1] ?? "";
    if (c === ";") {
      break;
    }
    if (c === ")" || c === "]" || c === "}") {
      a = gruppeAnfang(maske, a - 1, von);
      continue;
    }
    a -= 1;
  }
  let b = pos;
  while (b < bis) {
    const c = maske[b] ?? "";
    if (c === ";") {
      break;
    }
    if (c === "(" || c === "[" || c === "{") {
      b = paarEnde(maske, b);
      continue;
    }
    b += 1;
  }
  return [a, b];
}

/** Namen, deren Gliederkette nichts über die Antwort sagt: die Prüfsprache selbst und das Protokoll.
 *
 *  K5 (JOB 3785): `MELDUNGEN` gehört dazu, seit der Katalogzugriff als zweite Satzquelle zählt.
 *  Ohne diesen Eintrag wäre Bedingung (f) für jede Katalogform leer — der Zugriff bringt seine
 *  eigene Gliederkette mit, und `expect(meldung("USER_NOT_FOUND", s)).toBe(MELDUNGEN.USER_NOT_FOUND[s])`
 *  (`tests/q9-oidc-literalquelle/…:663`, ein reiner Katalogfall ohne jede Route) hätte gegolten wie
 *  eine Messung am Draht. Gemessen statt vermutet: mit `MELDUNGEN` ausserhalb dieser Liste verlässt
 *  GENAU EIN Schlüssel `OHNE_ROUTENFALL` zu Unrecht — `USER_NOT_FOUND`, gedeckt allein von F.3, das
 *  `meldung()` direkt aufruft und nie eine Antwort ansieht. H7.14 hält diese Richtung fest. */
const KEINE_BEOBACHTUNG = new Set(["expect", "console", "MELDUNGEN"]);
const GLIEDERWURZEL = /(?<![A-Za-z0-9_$.])([A-Za-z_$][A-Za-z0-9_$]*)\s*\./g;

/**
 * K4 · Liest die Anweisung um `pos` etwas aus der Umgebung — trägt sie eine Gliederkette auf einem
 * Namen, der weder `expect` noch ein Tabellenparameter ist? `sprachvertrag(res.json().message, …)`
 * und `expect(res.json().message).toBe(text)` tun es, `expect(text).toBeTruthy()` tut es nicht.
 */
function beobachtung(stand: Stand, fall: Fall, pos: number): boolean {
  const [a, b] = anweisungsbereich(stand.maske, pos, fall.rumpfVon, fall.rumpfBis);
  for (const treffer of stand.maske.slice(a, b).matchAll(GLIEDERWURZEL)) {
    const wurzel = treffer[1] ?? "";
    if (!KEINE_BEOBACHTUNG.has(wurzel) && !fall.parameter.includes(wurzel)) {
      return true;
    }
  }
  return false;
}

/**
 * K4 · Wird der an eine Tabellenspalte gebundene Parameter im Rumpf wirklich geprüft — an einen
 * Aufruf übergeben, in einer Anweisung, die die Antwort liest? Genau das entfernte BENs G5, ohne
 * dass der Wächter es merkte.
 */
function verbraucht(stand: Stand, fall: Fall, name: string): boolean {
  const muster = new RegExp(`(?<![A-Za-z0-9_$.])${name}(?![A-Za-z0-9_$])`, "g");
  for (const treffer of stand.maske.slice(fall.rumpfVon, fall.rumpfBis).matchAll(muster)) {
    const pos = fall.rumpfVon + (treffer.index ?? 0);
    const aufruf = stand.aufrufe[pos] ?? -1;
    if (aufruf >= 0 && aufruf !== fall.offen && beobachtung(stand, fall, pos)) {
      return true;
    }
  }
  return false;
}

/**
 * K4 · Die Spalte, in der `pos` in der `each`-Tabelle steht — daraus wird der Parameter, den der
 * Rückruf dort bindet. Eine flache Zeile (`it.each(["en-GB,…"])`) ist Spalte 0; ein Eintrag, der
 * keine Zeile der Tabelle ist (Objektform, Vorlagentabelle), ergibt `null` und damit keine Deckung.
 */
function spalteVon(maske: string, tabelle: number, pos: number): number | null {
  let i = tabelle + 1;
  while (/\s/.test(maske[i] ?? "")) {
    i += 1;
  }
  if (maske[i] !== "[") {
    return null;
  }
  const zeile = elemente(maske, i).find(([a, b]) => pos >= a && pos < b);
  if (!zeile) {
    return null;
  }
  let a = zeile[0];
  while (/\s/.test(maske[a] ?? "")) {
    a += 1;
  }
  if (maske[a] !== "[") {
    return 0;
  }
  const spalte = elemente(maske, a).findIndex(([x, y]) => pos >= x && pos < y);
  return spalte < 0 ? null : spalte;
}

/** Alles, was für eine Datei einmal berechnet wird: Maske, Aufrufzuordnung, aktive Prüffälle. */
function pruefstand(ort: string, roh: string): Stand {
  const rein = ohneKommentare(roh);
  const maske = ohneZeichenketten(rein);
  const alle = bloecke(maske, rein);
  // `it.only` schaltet in Vitest alle anderen Fälle der Datei ab — ein `only`, das jemand
  // vergessen hat, ist genau so ein Deckungsverlust wie ein `skip`.
  const nurModus = alle.some((b) => b.eigen.includes("only"));
  const kette = (b: Block): Block[] => [
    b,
    ...alle.filter((a) => a !== b && a.von <= b.von && a.bis >= b.bis),
  ];
  const faelle = alle
    .filter((b) => {
      if (b.art !== "fall") {
        return false;
      }
      const ahnen = kette(b);
      if (ahnen.some((k) => k.eigen.some((m) => AUS_MODIFIKATOR.has(m)))) {
        return false;
      }
      if (nurModus && !ahnen.some((k) => k.eigen.includes("only"))) {
        return false;
      }
      // Ein Fall ohne `expect` prüft nichts; er kann einen Satz nennen, aber nicht zusagen.
      return HAT_ERWARTUNG.test(maske.slice(b.von, b.bis));
    })
    .map((b) => {
      // K4: ohne lesbaren Rückruf gilt der ganze Fall als Rumpf und keine Spalte bindet — der
      // Wächter zählt dann weniger, nie mehr.
      const rk = rueckruf(maske, rein, b.offen, b.bis);
      return {
        name: b.name,
        von: b.von,
        bis: b.bis,
        offen: b.offen,
        tabelle: b.tabelle,
        parameter: rk?.parameter ?? [],
        rumpfVon: rk?.rumpfVon ?? b.offen,
        rumpfBis: rk?.rumpfBis ?? b.bis,
      };
    });
  return { ort, rein, maske, faelle, aufrufe: innersteAufrufe(maske) };
}

/**
 * Liegt `p` im Bereich eines Falls, der dort wirklich prüft? Die Bedingungen (b)–(f) aus K3 und K4
 * (aktiver Fall · mit `expect` · an einen Aufruf, nicht an `it(` selbst · aus der Tabelle nur über
 * einen im Rumpf verbrauchten Parameter · in einer Anweisung, die die Antwort liest). Die Stelle
 * selbst kann ein wörtlicher Satz oder ein Katalogzugriff sein — für (b)–(f) macht das keinen
 * Unterschied, und genau deshalb steht das hier einmal statt zweimal.
 */
function imFall(stand: Stand, fall: Fall, p: number): boolean {
  // (b)+(c) im Bereich eines aktiven Falls mit `expect`.
  if (p <= fall.von || p >= fall.bis) {
    return false;
  }
  if (p < fall.offen) {
    // (e) Die Stelle steht VOR der Namensklammer, also in der `each`-Tabelle. Sie zählt nur über
    // den Parameter, den ihre Spalte bindet — und nur, wenn der Rumpf ihn wirklich prüft.
    if (fall.tabelle < 0 || p < fall.tabelle) {
      return false;
    }
    const spalte = spalteVon(stand.maske, fall.tabelle, p);
    const name = spalte === null ? null : (fall.parameter[spalte] ?? null);
    return name !== null && verbraucht(stand, fall, name);
  }
  // (d) einem Aufruf übergeben, und zwar nicht der `it(`-Klammer selbst — sonst zählte eine
  // tote `const t = "…"` oder der Fallname als Messung; (f) in einer Anweisung, die liest.
  const aufruf = stand.aufrufe[p] ?? -1;
  return aufruf >= 0 && aufruf !== fall.offen && beobachtung(stand, fall, p);
}

/** Die beiden Sprachen, nach denen H4 fragt. Deutsch zählt nicht — es ist der Rückfall. */
type Fremdsprache = "en" | "nl";

// ------------------------------------------------------------------------------------------------
// K5 (JOB 3785) · DER ZWEITE SATZZUGANG — EIN FALL DARF DEN SATZ AUCH AUS DEM KATALOG HOLEN
// ------------------------------------------------------------------------------------------------
//
// DER BEFUND, der diese Erweiterung ausgelöst hat. `OIDC_UNREACHABLE` stand in `OHNE_ROUTENFALL`,
// und H4 sagte dazu „kein aktiver Fall sieht ihren Satz je an einer echten Antwort". Das war
// nachweislich falsch: `tests/q9-oidc-literalquelle/jeder-fehler-traegt-einen-katalogschluessel.test.ts`
// E.1 fährt einen echten Callback über `app.inject(` und hält `antwort.message` gegen
// `MELDUNGEN.OIDC_UNREACHABLE[sprache]` — in EN UND NL. Der Wächter sah es nicht, weil er den Satz
// als LITERAL im Quelltext suchte; wer ihn aus dem Katalog HOLT statt ihn abzuschreiben, war
// unsichtbar. Ein Wächter, der die Lücke grösser meldet, als sie ist, entwertet sein eigenes Urteil.
//
// ERKANNT WERDEN GENAU ZWEI SCHREIBWEISEN: `MELDUNGEN.<SCHLUESSEL>.<sprache>` und
// `MELDUNGEN.<SCHLUESSEL>[<sprachausdruck>]`. Es gelten DIESELBEN Bedingungen wie für das Literal —
// aktiver Fall, an einen Aufruf übergeben, Anweisung mit Beobachtung (`imFall`); der Zugang ist ein
// zweiter Weg zur selben Stelle, keine zweite, weichere Regel.
//
// FEHLERRICHTUNG — laut, nicht still, an beiden Enden:
//   ZU VIEL erkannt → der Schlüssel verlässt `OHNE_ROUTENFALL` und taucht in `GEMESSEN_VON` auf:
//     H4 UND H4.2 werden rot und nennen Schlüssel, Datei und Fallnamen. Niemand kann es übersehen.
//   ZU WENIG erkannt → der Schlüssel bleibt in `OHNE_ROUTENFALL` stehen, also in der Liste der
//     ungemessenen: die Lücke wird zu gross gemeldet, nie zu klein. Das ist die sichere Seite.
//   Eine dritte Schreibweise (`MELDUNGEN["X"].en`, ein Helfer, der den Satz zurückgibt) fällt
//     bewusst in den zweiten Fall. Sie zählt NICHT, und der Schlüssel gilt weiter als ungemessen.
//
// DIE SPRACHE MUSS BELEGT SEIN — SONST GILT DER ZUGRIFF ALS UNGEMESSEN (Runde 2, BEN).
// Bei `[<sprachausdruck>]` steht die Sprache nicht im Zugriff selbst. Runde 1 zählte einen solchen
// Zugriff pauschal für EN UND NL, und genau das war der stille Deckungsverlust: BENs G3 stellte die
// Tabelle von E.1 von `["en", "nl"]` auf `["de"]` um — die einzige echte Fremdsprachmessung von
// `OIDC_UNREACHABLE` war weg, und H4/H4.2 blieben grün („Tests 177 passed"). Ein variabler Index ist
// KEIN Sprachbeleg. Seit K5.2 gilt:
//   `[ "en" ]` / `.en`  → wörtlich, die Sprache steht da, sie zählt.
//   `[sprache]`         → nur, wenn die `each`-Tabelle DIESES Falls die Spalte, die `sprache` bindet,
//                         mit dem wörtlichen Sprachwert füllt (`tabellenwerte`). `["de"]` belegt
//                         weder EN noch NL; `["en"]` belegt EN und nicht NL.
//   jeder andere Ausdruck (`[sprachen[0]]`, `[k as "en"]`, Tabelle aus einer Konstanten) → NICHT
//                         belegbar, also NICHT gezählt.
//
// FEHLERRICHTUNG — laut, nicht still, an beiden Enden:
//   ZU VIEL erkannt → der Schlüssel verlässt `OHNE_ROUTENFALL` und taucht in `GEMESSEN_VON` auf:
//     H4 UND H4.2 werden rot und nennen Schlüssel, Datei und Fallnamen. Niemand kann es übersehen.
//   ZU WENIG erkannt → der Schlüssel bleibt in `OHNE_ROUTENFALL` stehen, also in der Liste der
//     ungemessenen: die Lücke wird zu gross gemeldet, nie zu klein. Das ist die sichere Seite, und
//     jeder nicht belegbare Sprachausdruck fällt bewusst dorthin.
//   Eine dritte Schreibweise (`MELDUNGEN["X"].en`, ein Helfer, der den Satz zurückgibt) fällt
//     ebenfalls in den zweiten Fall. Sie zählt NICHT, und der Schlüssel gilt weiter als ungemessen.
const KATALOG_ZUGRIFF =
  /(?<![A-Za-z0-9_$.])MELDUNGEN\s*\.\s*([A-Z][A-Z0-9_]*)\s*(?:\.\s*([A-Za-z_$][A-Za-z0-9_$]*)|\[([^\]\n]*)\])/g;
/** Ein wörtlicher Sprachindex — im ECHTEN Text gelesen, denn in der Maske ist er geleert. */
const INDEX_LITERAL = /\[\s*(["'`])([A-Za-z-]*)\1\s*\]$/;
/** Ein Index, der nur ein Name ist — der einzige nicht-wörtliche Ausdruck, der noch belegbar ist. */
const INDEX_BEZEICHNER = /^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*$/;
/** Ein wörtlicher Tabellenwert; alles andere ist kein Beleg. In der Maske stehen die Anführungs-
 *  zeichen, der Inhalt kommt aus dem echten Text. */
const TABELLENWERT = /^(["'`])([A-Za-z-]*)\1$/;

/**
 * Eine Stelle, an der der Satz aus dem Katalog geholt wird. `bezeichner === null` heisst: die
 * Sprache stand wörtlich am Zugriff und ist damit schon belegt. Sonst trägt sie den Namen, dessen
 * Tabellenspalte die Sprache erst belegen muss.
 */
type Katalogstelle = { pos: number; bezeichner: string | null };

/**
 * Die Stellen, an denen diese Datei den Satz `<schluessel>`/`<sprache>` AUS DEM KATALOG holt —
 * ohne Rücksicht darauf, ob ein Fall sie prüft; das entscheidet `imFall`.
 */
function katalogstellen(stand: Stand, schluessel: string, sprache: Fremdsprache): Katalogstelle[] {
  const gefunden: Katalogstelle[] = [];
  // Gesucht wird in der MASKE: ein `MELDUNGEN.X.en`, das nur in einer Zeichenkette oder in einem
  // Kommentar ausgeschrieben steht, ist dort geleert und damit kein Zugriff (H7.11, H7.17).
  for (const treffer of stand.maske.matchAll(KATALOG_ZUGRIFF)) {
    if (treffer[1] !== schluessel) {
      continue;
    }
    const pos = treffer.index ?? 0;
    // Das Glied `.en` steht in der Maske wie im Text; der Index `["en"]` nur im Text.
    const roh = stand.rein.slice(pos, pos + treffer[0].length);
    const gewaehlt = treffer[2] ?? INDEX_LITERAL.exec(roh)?.[2] ?? null;
    if (gewaehlt !== null) {
      // Wörtlich: die Sprache steht am Zugriff. `.de` und `["de"]` decken keine Fremdsprache.
      if (gewaehlt === sprache) {
        gefunden.push({ pos, bezeichner: null });
      }
      continue;
    }
    // K5.2: kein wörtlicher Index. Belegbar ist nur noch ein blosser NAME — über die `each`-Tabelle
    // seines Falls. Jeder zusammengesetzte Ausdruck gilt als unbelegbar und damit als ungemessen.
    const name = treffer[3] === undefined ? null : (INDEX_BEZEICHNER.exec(treffer[3])?.[1] ?? null);
    if (name !== null) {
      gefunden.push({ pos, bezeichner: name });
    }
  }
  return gefunden;
}

/**
 * K5.2 · Die wörtlichen Werte der `each`-Spalte, die `name` in diesem Fall bindet — oder `null`,
 * wenn sich das nicht lesen lässt (keine Tabelle, der Name ist kein Parameter, die Zeilen sind
 * keine wörtlichen Werte, Objekt- oder Vorlagentabelle). `null` ist die sichere Seite: kein Beleg.
 * Die Gegenrichtung zu `spalteVon`, das aus einer Stelle die Spalte macht; hier wird aus dem
 * Parameter die Spalte und daraus ihre Werte.
 */
function tabellenwerte(stand: Stand, fall: Fall, name: string): string[] | null {
  if (fall.tabelle < 0) {
    return null;
  }
  const spalte = fall.parameter.indexOf(name);
  if (spalte < 0) {
    return null;
  }
  let i = fall.tabelle + 1;
  while (/\s/.test(stand.maske[i] ?? "")) {
    i += 1;
  }
  if (stand.maske[i] !== "[") {
    return null;
  }
  const werte: string[] = [];
  for (const [von, bis] of elemente(stand.maske, i)) {
    let a = von;
    while (/\s/.test(stand.maske[a] ?? "")) {
      a += 1;
    }
    // Eine flache Zeile (`it.each(["en", "nl"])`) ist Spalte 0; eine Zeile als Feld hat Spalten.
    let bereich: [number, number] | undefined;
    if (stand.maske[a] === "[") {
      bereich = elemente(stand.maske, a)[spalte];
    } else if (spalte === 0) {
      bereich = [von, bis];
    }
    if (!bereich) {
      return null;
    }
    const wert = TABELLENWERT.exec(stand.rein.slice(bereich[0], bereich[1]).trim())?.[2];
    if (wert === undefined) {
      return null;
    }
    werte.push(wert);
  }
  return werte.length > 0 ? werte : null;
}

/** K5.2 · Belegt die `each`-Tabelle dieses Falls, dass `name` wirklich `sprache` annimmt? */
function spracheBelegt(stand: Stand, fall: Fall, name: string, sprache: Fremdsprache): boolean {
  return tabellenwerte(stand, fall, name)?.includes(sprache) === true;
}

/**
 * Die aktiven Prüffälle dieser Datei, die `satz` wirklich gegen eine Antwort halten. Zwei Zugänge
 * zum selben Satz: er steht WÖRTLICH da (dann muss er in einer Zeichenkette liegen — Bedingung (a)
 * aus K3), oder der Fall HOLT ihn über `katalog` aus `MELDUNGEN` (K5). Für alles Weitere gilt
 * beidemal `imFall`.
 */
function messstellen(
  stand: Stand,
  satz: string,
  katalog?: { schluessel: string; sprache: Fremdsprache },
): string[] {
  const treffer: string[] = [];
  /** `weiter` ist die zusätzliche Bedingung des Katalogzugangs: die Sprache muss belegt sein. */
  const melde = (p: number, weiter?: (fall: Fall) => boolean): void => {
    for (const fall of stand.faelle) {
      if (imFall(stand, fall, p) && (weiter === undefined || weiter(fall))) {
        treffer.push(`${stand.ort} · ${fall.name}`);
      }
    }
  };
  if (satz !== "") {
    for (let p = stand.rein.indexOf(satz); p >= 0; p = stand.rein.indexOf(satz, p + 1)) {
      // (a) In einer Zeichenkette? In der Maske ist ihr Inhalt geleert, im echten Text steht er.
      const ende = p + satz.length - 1;
      if (stand.maske[p] !== " " || stand.maske[ende] !== " ") {
        continue;
      }
      melde(p);
    }
  }
  if (katalog) {
    const sprache = katalog.sprache;
    for (const { pos, bezeichner } of katalogstellen(stand, katalog.schluessel, sprache)) {
      // K5.2: Der wörtliche Zugriff bringt seine Sprache mit; der Bezeichner muss sie sich von der
      // `each`-Tabelle DES FALLS belegen lassen, in dem er steht — deshalb erst hier, nicht schon
      // in `katalogstellen`: dieselbe Stelle kann in keinem, einem oder mehreren Fällen liegen.
      melde(
        pos,
        bezeichner === null ? undefined : (f) => spracheBelegt(stand, f, bezeichner, sprache),
      );
    }
  }
  return [...new Set(treffer)];
}

// ------------------------------------------------------------------------------------------------
// H4 · DIE LISTE DIESES AUFTRAGS — was heute über KEINEN aktiven Routenfall gemessen wird
// ------------------------------------------------------------------------------------------------
//
// GEMESSEN heisst hier: ein AKTIVER Prüffall in einer Datei, die die App wirklich fährt
// (`app.inject(`), übergibt die englische ODER niederländische Fassung dieses Schlüssels wörtlich an
// einen Aufruf. Die deutsche zählt bewusst nicht — sie ist der Rückfall und würde auch dann noch
// stimmen, wenn `en` und `nl` deutsche Sätze trügen. Genau das ist die Lücke, gegen die
// `katalog.test.ts` S1 steht.

const ROUTEN_MERKMAL = "app.inject(";
const NICHT_BETRETEN = new Set(["node_modules", ".git", "dist", "build", "coverage"]);

function routentests(): { ort: string; roh: string }[] {
  const gefunden: { ort: string; roh: string }[] = [];
  const laufe = (ordner: string): void => {
    for (const eintrag of readdirSync(ordner).sort()) {
      if (NICHT_BETRETEN.has(eintrag)) {
        continue;
      }
      const pfad = join(ordner, eintrag);
      if (statSync(pfad).isDirectory()) {
        laufe(pfad);
        continue;
      }
      if (!/\.test\.tsx?$/.test(pfad) || pfad === DIESE_DATEI) {
        continue;
      }
      const roh = readFileSync(pfad, "utf8");
      if (roh.includes(ROUTEN_MERKMAL)) {
        gefunden.push({ ort: relativ(pfad), roh });
      }
    }
  };
  for (const wurzel of ["tests", "services", "apps"]) {
    laufe(join(WURZEL, wurzel));
  }
  return gefunden;
}

const ROUTENTESTS = routentests();
const FREMDSPRACHIG = Object.values(MELDUNGEN).flatMap((t) => [t.en, t.nl]);
// K5 (JOB 3785): der Vorfilter muss dieselben zwei Zugänge kennen wie `messstellen`. Vorher liess
// er nur Dateien durch, die einen Satz WÖRTLICH nennen — eine Datei, die ihn aus dem Katalog holt,
// kam gar nicht erst in `STAENDE`, und die Erweiterung liefe ins Leere. Das grobe `MELDUNGEN.`
// genügt hier: es ist der billige Vorfilter, die feine Entscheidung trifft `katalogstellen`.
const KATALOG_GROB = /(?<![A-Za-z0-9_$.])MELDUNGEN\s*\./;
// Der volle Abtast (Kommentare schneiden, Zeichenketten leeren, Fälle lesen) lohnt nur für Dateien,
// die überhaupt einen dieser Sätze nennen oder den Katalog anfassen — billig zuerst, teuer nur bei
// Verdacht.
const STAENDE = ROUTENTESTS.filter(
  (d) => FREMDSPRACHIG.some((s) => d.roh.includes(s)) || KATALOG_GROB.test(d.roh),
).map((d) => pruefstand(d.ort, d.roh));

function routenfall(schluessel: string, sprache: Fremdsprache): string[] {
  const satz = MELDUNGEN[schluessel as keyof typeof MELDUNGEN][sprache];
  return STAENDE.flatMap((stand) => messstellen(stand, satz, { schluessel, sprache }));
}

/**
 * DIE LISTE. 15 von 29 Schlüsseln zeigen heute nirgends einen englischen oder niederländischen Satz
 * an einem echten Draht. Gemessen, nicht abgeschrieben.
 *
 * JOB 3792: der Katalog ist um `PERMISSION_MISSING` gewachsen, diese Liste NICHT — der neue
 * Schlüssel bringt seine Messung mit (s. `GEMESSEN_VON`). Verschoben hat sich sonst nichts; die
 * fünfzehn Namen sind dieselben wie nach JOB 3785.
 *
 * „OHNE ROUTENFALL" HEISST SEIT JOB 3785 GENAU: kein aktiver Prüffall einer Datei, die die App über
 * `app.inject(` fährt, hält den EN- oder NL-Satz dieses Schlüssels gegen eine echte Antwort —
 * WEDER wörtlich abgeschrieben NOCH über `MELDUNGEN.<SCHLUESSEL>.<sprache>` aus dem Katalog geholt
 * (K5). Bis dahin zählte nur der wörtliche Weg; `OIDC_UNREACHABLE` stand deshalb hier, obwohl
 * `tests/q9-oidc-literalquelle/…` E.1 seinen Satz in beiden Sprachen vom Draht liest.
 *
 * Der SSO-Weg ist mit JOB 3785 herausgegangen — die vier `OIDC_*`-Schlüssel, die vorher unter
 * „SSO. Der ganze Anmeldeweg über einen fremden Anbieter hat keinen einzigen Sprachfall." standen.
 * Was bleibt, ist der Verwaltungsweg: Konto- und Rollenverwaltung sowie die Eingangsprüfungen der
 * Routen. Codex' drei Beispiele waren `OIDC_STATE_INVALID` (jetzt gemessen), `ALREADY_SETUP` und
 * `UNKNOWN_ROLE` — die letzten beiden stehen weiterhin darin.
 */
const OHNE_ROUTENFALL = [
  // Konto- und Rollenverwaltung. Geworfen in `service.ts`; die Q9-Fälle fahren nur Anmeldung,
  // Zurücksetzen und den Auth-Guard, nie die Nutzerverwaltung.
  "ACCOUNT_NOT_FOUND",
  "CURRENT_PASSWORD_INCORRECT",
  "EMAIL_TAKEN",
  "LAST_ADMIN_DELETION",
  "LAST_ADMIN_DEMOTION",
  "OIDC_ACCOUNT_MISSING",
  "SELF_DEMOTION_FORBIDDEN",
  "USER_NOT_FOUND",
  // Eingangsprüfungen, Rechte und Schalter der Routen. Gesendet in `routes.ts`, aber kein Fall
  // liest ihren Text in EN oder NL.
  "ADMIN_REQUIRED",
  "ALREADY_SETUP",
  "EMAIL_REQUIRED",
  "NAME_REQUIRED",
  "REGISTRATION_DISABLED",
  "REGISTRATION_RATE_LIMITED",
  "UNKNOWN_ROLE",
];

/** Die Gegenliste: was heute gemessen IST, mit dem Fall, der es misst. Gepinnt, weil H4 sonst
 *  auch dann grün bliebe, wenn der Fallabtaster nichts mehr findet und alles „ungemessen" heisst
 *  — dann müsste nur die eine Liste wachsen, und niemand sähe, dass die Deckung verschwand. */
const GEMESSEN_VON = {
  // JOB 3756: der erste Schlüssel des Katalogs, der seinen Routenfall am Tag seiner Einführung
  // mitbringt. Beide Fremdsprachen hängen an EINEM Fall — fällt er aus, wandert der Schlüssel in
  // einem Zug nach `OHNE_ROUTENFALL`, und H4 nennt ihn.
  ACCESS_EXPIRED: [
    "tests/demo-zugang-gaeste-meldung/ablauf-meldung.test.ts · M3 dieselbe Lage auf Englisch und Niederländisch",
  ],
  /**
   * EHRLICH GELESEN: nur R12 hält den INTERNAL-Satz POSITIV gegen eine Antwort. Die vier anderen
   * Einträge sind AUSSCHLÜSSE — sie prüfen, dass eine Route NICHT still auf `INTERNAL`
   * zurückgefallen ist (`meldungen.ts:159-164`). Der Wächter unterscheidet `toBe` und `not.toBe`
   * nicht; er sagt „dieser Satz wird in einem aktiven Fall an einer echten Antwort gehalten", und
   * das stimmt auch für den Ausschluss. Für die Zusage „INTERNAL ist übersetzt" bürgt allein R12.
   * Fiele R12 weg, bliebe dieser Eintrag stehen, ohne dass der Schlüssel noch positiv gemessen
   * wäre — das ist die bekannte Grenze der Auskunft und kein Ersatz für den Fall selbst.
   */
  INTERNAL: [
    "tests/q9-oidc-literalquelle/jeder-fehler-traegt-einen-katalogschluessel.test.ts · E.1 der echte Callback liefert in %s den OIDC_UNREACHABLE-Satz, nicht INTERNAL",
    "tests/q9-serverfehlertexte/server.test.ts · R12 Auffangfehler EN verbirgt interne Details",
    "tests/q9-serverfehlertexte/sso-sprachfaelle.test.ts · S1 OIDC_DISABLED · beide SSO-Türen antworten ohne Anbieter 501 auf %s",
    "tests/q9-serverfehlertexte/sso-sprachfaelle.test.ts · S2 OIDC_STATE_INVALID · ein state, der nicht zum Plätzchen passt, antwortet 400 auf %s",
    "tests/q9-serverfehlertexte/sso-sprachfaelle.test.ts · S3 OIDC_LOGIN_FAILED · ein gescheiterter Token-Tausch antwortet 401 auf %s",
  ],
  INVALID_CREDENTIALS: [
    "tests/q9-serverfehlertexte/server.test.ts · R1 Anmeldung EN: falsches Passwort und unbekanntes Konto bleiben unspezifisch",
    "tests/q9-serverfehlertexte/server.test.ts · R2 Anmeldung NL",
    "tests/q9-serverfehlertexte/server.test.ts · R8 zusammengesetzter Kopf %s",
  ],
  LOGIN_RATE_LIMITED: [
    "tests/q9-serverfehlertexte/server.test.ts · R5 Anmeldung 429 EN: echte Fehlversuche überschreiten das Limit",
  ],
  NOT_APPROVED: ["tests/q9-serverfehlertexte/server.test.ts · R9 gesperrtes Konto %s"],
  NOT_SIGNED_IN: ["tests/q9-serverfehlertexte/server.test.ts · R11 Auth-Guard EN"],
  // JOB 3785 · der SSO-Weg. Drei neue Fälle in `sso-sprachfaelle.test.ts` lesen die drei Sätze
  // wörtlich von der Antwort; jeder deckt EN und NL über seine `each`-Tabelle.
  OIDC_DISABLED: [
    "tests/q9-serverfehlertexte/sso-sprachfaelle.test.ts · S1 OIDC_DISABLED · beide SSO-Türen antworten ohne Anbieter 501 auf %s",
  ],
  OIDC_LOGIN_FAILED: [
    "tests/q9-serverfehlertexte/sso-sprachfaelle.test.ts · S3 OIDC_LOGIN_FAILED · ein gescheiterter Token-Tausch antwortet 401 auf %s",
  ],
  OIDC_STATE_INVALID: [
    "tests/q9-serverfehlertexte/sso-sprachfaelle.test.ts · S2 OIDC_STATE_INVALID · ein state, der nicht zum Plätzchen passt, antwortet 400 auf %s",
  ],
  // JOB 3785 · kein neuer Fall, sondern eine berichtigte Auskunft: E.1 misst diesen Satz seit JOB
  // 3580 in EN und NL an einer echten Antwort — über den Katalog statt über eine Abschrift, und
  // deshalb sah der Wächter es bis K5 nicht.
  OIDC_UNREACHABLE: [
    "tests/q9-oidc-literalquelle/jeder-fehler-traegt-einen-katalogschluessel.test.ts · E.1 der echte Callback liefert in %s den OIDC_UNREACHABLE-Satz, nicht INTERNAL",
  ],
  // JOB 3792 · der 29. Schlüssel, gemessen am Tag seiner Einführung. Vier Fälle, weil zwei
  // verschiedene RECHTE an zwei verschiedenen Routen gemessen werden (`users.manage` am
  // Verwaltungstor, `ko.create` am Entwurfstor): ein einziges Recht liesse einen Katalogsatz
  // durchgehen, der den Rechtenamen fest eingebacken hat statt ihn einzusetzen. Gesehen werden die
  // vier über den KATALOGZUGANG (K5) — sie holen den Satz aus `MELDUNGEN.PERMISSION_MISSING.<en|nl>`
  // und setzen den Rechtenamen selbst ein, statt den Satz samt `%s` abzuschreiben.
  PERMISSION_MISSING: [
    "tests/q9-rechtefehler/rechtetor-sprachfaelle.test.ts · Q1 EN · 403 FORBIDDEN mit englischem Satz und dem fehlenden Recht",
    "tests/q9-rechtefehler/rechtetor-sprachfaelle.test.ts · Q2 NL · 403 FORBIDDEN mit niederländischem Satz und dem fehlenden Recht",
    "tests/q9-rechtefehler/rechtetor-sprachfaelle.test.ts · Q4 EN · dasselbe Tor an einer anderen Route nennt ko.create",
    "tests/q9-rechtefehler/rechtetor-sprachfaelle.test.ts · Q4b NL · dasselbe Tor an einer anderen Route nennt ko.create",
  ],
  RESET_RATE_LIMITED: [
    "tests/q9-serverfehlertexte/server.test.ts · R5b Zurücksetzen 429 EN: eigener Zähler",
  ],
  RESET_TOKEN_INVALID: [
    "tests/q9-serverfehlertexte/server.test.ts · R4 Zurücksetzen EN: tatsächlich ausgestellter und abgelaufener Token",
  ],
  WEAK_PASSWORD: ["tests/q9-serverfehlertexte/server.test.ts · R10 kurzes Passwort %s"],
} as const satisfies Record<string, readonly string[]>;

it("H4 genau die gepinnten Schlüssel werden von keinem aktiven Routenfall in EN/NL gemessen", () => {
  const ungemessen = KATALOGSCHLUESSEL.filter(
    (schluessel) =>
      routenfall(schluessel, "en").length === 0 && routenfall(schluessel, "nl").length === 0,
  );
  expect(
    ungemessen,
    `Die Liste ist die ehrliche Auskunft über den Umfang: für diese Schlüssel sagt nur der
Katalogwächter, dass sie übersetzt sind — kein aktiver Fall hält ihren EN- oder NL-Satz je gegen
eine echte Antwort, weder wörtlich abgeschrieben noch über \`MELDUNGEN.<SCHLUESSEL>.<sprache>\` aus
dem Katalog geholt (K5). Bei einem Zugriff über einen Namen (\`[sprache]\`) zählt die Sprache nur,
wenn die \`each\`-Tabelle des Falls sie wörtlich nennt (K5.2) — ein Fall, der auf Deutsch
umgestellt wird, gehört in die Liste, auch wenn Datei und Fallname gleich bleiben.
Bekommt einer davon einen Routenfall, gehört er aus der Liste heraus;
verliert einer seinen — auch durch ein \`skip\` oder ein vergessenes \`only\` —, muss er hinein.
Verschoben hat sich: ${verschiebung(OHNE_ROUTENFALL, ungemessen)}
Gemessen über ${STAENDE.length} von ${ROUTENTESTS.length} Testdateien, die die App über \`${ROUTEN_MERKMAL}\` fahren.`,
  ).toEqual([...OHNE_ROUTENFALL].sort());
});

it("H4.2 jeder gemessene Schlüssel nennt den aktiven Fall, der ihn misst", () => {
  // Die Gegenrichtung zu H4. Wird ein Routenfall abgeschaltet oder sein Satzvergleich entfernt,
  // wird DIESER Fall rot und nennt Datei und Fallnamen — nicht nur „die Liste ist länger".
  const gemessen = Object.fromEntries(
    KATALOGSCHLUESSEL.map((schluessel) => [
      schluessel,
      [...new Set([...routenfall(schluessel, "en"), ...routenfall(schluessel, "nl")])].sort(),
    ]).filter(([, orte]) => (orte as string[]).length > 0),
  );
  const erwartet = Object.fromEntries(
    Object.entries(GEMESSEN_VON).map(([k, v]) => [k, [...v].sort()]),
  );
  expect(
    gemessen,
    `Jede Zeile ist ein Schlüssel, dessen EN- oder NL-Satz heute an einer echten Antwort hängt,
samt dem Fall, der ihn hält. Fällt ein Fall aus (\`skip\`, \`only\` woanders, gelöschter
Satzvergleich), verschwindet er hier — und genau das soll auffallen, bevor jemand glaubt, die
Sprache sei noch gemessen.`,
  ).toEqual(erwartet);
});

it("H4.3 die Verschiebungsmeldung nennt Verlust als Verlust, nicht als Gewinn", () => {
  // Runde 2: H4 gab `verschiebung` seine Listen in der falschen Reihenfolge und meldete BENs G3 —
  // einen VERLUST der Fremdsprachdeckung — als „NEU gemessen". Der Wächter hatte recht und log in
  // der Begründung. Hier steht beide Richtungen fest, in der Form, in der H4 sie aufruft: erstes
  // Argument die gemessene Lage, zweites die gepinnte.
  const gepinnt = ["ALREADY_SETUP", "UNKNOWN_ROLE"];
  // Ein Schlüssel hat einen Fall bekommen: er fehlt in den Ungemessenen.
  expect(verschiebung(gepinnt, ["UNKNOWN_ROLE"])).toBe("NEU gemessen: ALREADY_SETUP");
  // Ein Schlüssel hat seinen Fall verloren: er steht neu in den Ungemessenen.
  expect(verschiebung(gepinnt, [...gepinnt, "OIDC_UNREACHABLE"])).toBe(
    "NICHT MEHR gemessen: OIDC_UNREACHABLE",
  );
  expect(verschiebung(gepinnt, gepinnt)).toBe("keine");
});

it("H4.9 der Fallabtaster findet die Fälle des Routentests dieses Ordners", () => {
  // Ohne diesen Pin könnte der Abtaster an einer neuen Schreibweise scheitern: er fände keine
  // Fälle mehr, H4 wüchse auf alle 28 Schlüssel — und das sähe aus wie ein Deckungsverlust im
  // Produkt, nicht wie ein kaputtes Werkzeug.
  const eigen = STAENDE.find((s) => s.ort === "tests/q9-serverfehlertexte/server.test.ts");
  expect(eigen, "der Routentest dieses Ordners nennt keinen EN/NL-Satz mehr").toBeDefined();
  const namen = (eigen?.faelle ?? []).map((f) => f.name);
  expect(namen.length, `zu wenige aktive Prüffälle gelesen: ${namen.join(" · ")}`).toBeGreaterThan(
    9,
  );
  expect(namen, `gelesen wurden: ${namen.join(" · ")}`).toContain("R11 Auth-Guard EN");
  expect(namen).toContain("R9 gesperrtes Konto %s");
});

// ------------------------------------------------------------------------------------------------
// H5 · JEDER WÖRTLICHE SCHLÜSSEL STEHT IM KATALOG
// ------------------------------------------------------------------------------------------------
it("H5 jeder wörtlich verwendete Schlüssel löst in MELDUNGEN auf", () => {
  const katalog = new Set(KATALOGSCHLUESSEL);
  const unbekannt = [...WURFSTELLEN, ...EINSATZSTELLEN]
    .filter((s) => s.schluessel !== null && !katalog.has(s.schluessel))
    .map((s) => `${s.ort} sendet ${s.schluessel} — im Katalog nicht vorhanden`);
  expect(
    unbekannt,
    `Ein Schlüssel, den es im Katalog nicht gibt, wird auf INTERNAL abgebildet
(\`meldungen.ts:149-151\`): die Route antwortet mit ihrem richtigen Status, aber dem Satz
„Unerwarteter Fehler." — still, bei grünem Typprüfer. An den \`meldung("…")\`-Aufrufen der Routen
gibt es dagegen keinen anderen Schutz: ${unbekannt.join(" · ")}`,
  ).toEqual([]);
});

// ------------------------------------------------------------------------------------------------
// H6 · KALIBRIERUNG DES FALLABTASTERS (KORREKTURPFLICHTEN K3 UND K4)
// ------------------------------------------------------------------------------------------------
//
// Dieselbe Frage wie H1, eine Ebene höher: zählt als Deckung wirklich nur ein aktiver Prüffall, der
// den Satz an einen Aufruf übergibt UND dabei die Antwort ansieht? H6.1–H6.13 kalibrieren K3 (läuft
// der Fall überhaupt?), H6.14–H6.21 kalibrieren K4 (prüft er den Satz überhaupt?). Beide Richtungen
// stehen nebeneinander: jede Form, die zählen SOLL, und dieselbe Form, der die Prüfung fehlt. Die
// Fälle laufen durch DENSELBEN Code wie H4 — `pruefstand` und `messstellen` —, nicht durch eine
// Kopie. „SATZ" steht für die EN/NL-Fassung eines Schlüssels.
describe("H6 · der Fallabtaster zählt nur aktive Prüffälle", () => {
  const PRUEFE = '    pruefe(res.json().message, "SATZ");\n';
  const ERWARTE = "    expect(res.statusCode).toBe(401);\n";
  const FAELLE: { form: string; quelle: string; erwartet: string[] }[] = [
    {
      form: "H6.1 aktiver Fall mit expect, Satz an einem Aufruf",
      quelle: `describe("G", () => {\n  it("R1", async () => {\n${ERWARTE}${PRUEFE}  });\n});\n`,
      erwartet: ["X.ts · R1"],
    },
    {
      // BENs Gegenprobe G3 in ihrer einfachsten Form.
      form: "H6.2 describe.skip um den Fall — nichts läuft, nichts ist gemessen",
      quelle: `describe.skip("G", () => {\n  it("R1", async () => {\n${ERWARTE}${PRUEFE}  });\n});\n`,
      erwartet: [],
    },
    {
      form: "H6.3 it.skip am Fall selbst",
      quelle: `it.skip("R1", async () => {\n${ERWARTE}${PRUEFE}});\n`,
      erwartet: [],
    },
    {
      form: "H6.4 die it.each-Tabelle trägt den Satz (Form R9/R10)",
      quelle: `it.each([["en", "SATZ"]])("R9 %s", async (s, t) => {\n${ERWARTE}  pruefe(res.json().message, t);\n});\n`,
      erwartet: ["X.ts · R9 %s"],
    },
    {
      form: "H6.5 it.each mit skip zählt nicht",
      quelle: `it.skip.each([["en", "SATZ"]])("R9 %s", async (s, t) => {\n${ERWARTE}  pruefe(res.json().message, t);\n});\n`,
      erwartet: [],
    },
    {
      form: "H6.6 ein Fall ohne expect prüft nichts",
      quelle: `it("R2", async () => {\n${PRUEFE}});\n`,
      erwartet: [],
    },
    {
      form: "H6.7 der Satz liegt in einer toten Zuweisung, nicht an einem Aufruf",
      quelle: `it("R3", async () => {\n${ERWARTE}    const t = "SATZ";\n});\n`,
      erwartet: [],
    },
    {
      form: "H6.8 der Satz steht nur im Kommentar",
      quelle: `it("R4", async () => {\n${ERWARTE}    // pruefe(x, "SATZ");\n});\n`,
      erwartet: [],
    },
    {
      form: "H6.9 ein only woanders schaltet diesen Fall ab",
      quelle: `it.only("R5", () => {\n  expect(1).toBe(1);\n});\nit("R6", async () => {\n${ERWARTE}${PRUEFE}});\n`,
      erwartet: [],
    },
    {
      form: "H6.10 skipIf ist nicht beweisbar aktiv",
      quelle: `it.skipIf(kaputt)("R7", async () => {\n${ERWARTE}${PRUEFE}});\n`,
      erwartet: [],
    },
    {
      form: "H6.11 geschachteltes describe.skip über einem aktiven Fall",
      quelle: `describe("A", () => {\n  describe.skip("B", () => {\n    it("R9", async () => {\n${ERWARTE}${PRUEFE}    });\n  });\n});\n`,
      erwartet: [],
    },
    {
      form: "H6.12 der Satz steht ausserhalb jedes Falls",
      quelle: 'const T = pruefe("SATZ");\nit("R8", () => {\n  expect(1).toBe(1);\n});\n',
      erwartet: [],
    },
    {
      form: "H6.13 der Satz ist nur der Name des Falls",
      quelle: `it("SATZ", async () => {\n${ERWARTE}});\n`,
      erwartet: [],
    },
    // ------------------------------------------------------------------------------------------
    // K4 · EIN TABELLENWERT ZÄHLT ERST, WENN DER RUMPF IHN GEGEN DIE ANTWORT HÄLT
    // ------------------------------------------------------------------------------------------
    {
      form: "H6.14 Tabellenwert, im Rumpf mit expect(...).toBe(t) gegen die Antwort gehalten",
      quelle: `it.each([["en", "SATZ"]])("R9 %s", async (s, t) => {\n${ERWARTE}  expect(res.json().message).toBe(t);\n});\n`,
      erwartet: ["X.ts · R9 %s"],
    },
    {
      // GENAU BENs Gegenprobe G5: die Tabelle bleibt, der Antwortvergleich fällt weg. Bis Runde 2
      // zählte der Wächter den Satz weiter — der Scheinbeleg, gegen den K4 steht.
      form: "H6.15 Tabelle unverändert, Antwortvergleich entfernt (BEN G5)",
      quelle: `it.each([["en", "SATZ"]])("R9 %s", async (s, t) => {\n${ERWARTE}  expect(res.json().message).toBeTruthy();\n});\n`,
      erwartet: [],
    },
    {
      form: "H6.16 der Parameter wird nur gegen sich selbst geprüft, nicht gegen die Antwort",
      quelle: `it.each([["en", "SATZ"]])("R9 %s", async (s, t) => {\n${ERWARTE}  expect(t).toBeTruthy();\n});\n`,
      erwartet: [],
    },
    {
      form: "H6.17 der Parameter landet nur in einer toten Zuweisung",
      quelle: `it.each([["en", "SATZ"]])("R9 %s", async (s, t) => {\n${ERWARTE}  const x = t;\n});\n`,
      erwartet: [],
    },
    {
      // Die Spalte muss stimmen: geprüft wird hier der Nachbarwert, nicht der Satz.
      form: "H6.18 der Satz steht in Spalte 0, geprüft wird der Parameter von Spalte 1",
      quelle: `it.each([["SATZ", "en"]])("R9 %s", async (t, s) => {\n${ERWARTE}  pruefe(res.json().message, s);\n});\n`,
      erwartet: [],
    },
    {
      form: "H6.19 flache Tabelle: ein Wert je Zeile ist Spalte 0",
      quelle: `it.each(["SATZ"])("R9 %s", async (t) => {\n${ERWARTE}  pruefe(res.json().message, t);\n});\n`,
      erwartet: ["X.ts · R9 %s"],
    },
    {
      form: "H6.20 zerlegte Parameter binden keine Spalte — lieber keine Deckung als eine erfundene",
      quelle: `it.each([{ text: "SATZ" }])("R9 %s", async ({ text }) => {\n${ERWARTE}  pruefe(res.json().message, text);\n});\n`,
      erwartet: [],
    },
    {
      // Dieselbe Verstellung am WÖRTLICHEN Satz: der Aufruf sieht die Antwort nicht mehr an.
      form: "H6.21 wörtlicher Satz an einem Aufruf, der nichts aus der Antwort liest",
      quelle: `it("R10", async () => {\n${ERWARTE}    pruefe("SATZ");\n});\n`,
      erwartet: [],
    },
  ];

  for (const { form, quelle, erwartet } of FAELLE) {
    it(form, () => {
      expect(messstellen(pruefstand("X.ts", quelle), "SATZ")).toEqual(erwartet);
    });
  }
});

// ------------------------------------------------------------------------------------------------
// H7 · KALIBRIERUNG DES ZWEITEN SATZZUGANGS (KORREKTURPFLICHT K5, JOB 3785)
// ------------------------------------------------------------------------------------------------
//
// Dieselbe Frage wie H6, nur für die Form, in der ein Fall den Satz AUS DEM KATALOG holt. Jede
// Form, die zählen SOLL, steht neben derselben Form, der die Prüfung fehlt — sonst wäre die
// Erweiterung ein Wächter, der nur noch findet und nicht mehr unterscheidet. Die Fälle laufen durch
// DENSELBEN Code wie H4 (`pruefstand`, `messstellen`), nicht durch eine Kopie; der Satz „SATZ"
// kommt in keiner Quelle wörtlich vor, damit ausschliesslich der Katalogzugang misst.
describe("H7 · der Katalogzugriff zählt — und nur, wenn der Fall wirklich prüft", () => {
  const ERWARTE = "    expect(res.statusCode).toBe(401);\n";
  const FAELLE: { form: string; quelle: string; sprache: Fremdsprache; erwartet: string[] }[] = [
    {
      form: "H7.1 Punktform in einem aktiven Fall, gegen die Antwort gehalten",
      quelle: `it("R1", async () => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE.en);\n});\n`,
      sprache: "en",
      erwartet: ["X.ts · R1"],
    },
    {
      // Die Sprache am Zugriff ist verbindlich: derselbe Quelltext, andere Frage, kein Treffer.
      form: "H7.2 Punktform `.en` deckt NL nicht",
      quelle: `it("R1", async () => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE.en);\n});\n`,
      sprache: "nl",
      erwartet: [],
    },
    {
      form: "H7.3 Klammerform mit wörtlichem Sprachindex",
      quelle: `it("R2", async () => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE["nl"]);\n});\n`,
      sprache: "nl",
      erwartet: ["X.ts · R2"],
    },
    {
      form: "H7.4 Klammerform mit wörtlichem `nl` deckt EN nicht",
      quelle: `it("R2", async () => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE["nl"]);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      // Genau die Form von E.1 in `tests/q9-oidc-literalquelle/`. Die Sprache steht nicht am
      // Zugriff — belegt wird sie von der Tabelle, und die nennt hier beide Fremdsprachen wörtlich.
      form: "H7.5 Klammerform mit einem Namen zählt für EN, weil die Tabelle EN nennt",
      quelle: `it.each(["en", "nl"])("R3 %s", async (sprache) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "en",
      erwartet: ["X.ts · R3 %s"],
    },
    {
      form: "H7.6 dieselbe Klammerform zählt auch für NL, weil die Tabelle NL nennt",
      quelle: `it.each(["en", "nl"])("R3 %s", async (sprache) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "nl",
      erwartet: ["X.ts · R3 %s"],
    },
    {
      // Deutsch ist der Rückfall und war nie die Frage von H4 — `.de` deckt nichts.
      form: "H7.7 der deutsche Zugriff deckt keine Fremdsprache",
      quelle: `it("R4", async () => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE.de);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      form: "H7.8 ein anderer Schlüssel wird nicht verwechselt",
      quelle: `it("R5", async () => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_DISABLED.en);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    // --------------------------------------------------------------------------------------------
    // DIE GEGENRICHTUNG · DIESELBE FORM, OHNE DASS SIE ETWAS PRÜFT
    // --------------------------------------------------------------------------------------------
    {
      form: "H7.9 in einem it.skip zählt nichts",
      quelle: `it.skip("R6", async () => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE.en);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      form: "H7.10 ein describe.skip darüber schaltet den Fall ab",
      quelle: `describe.skip("G", () => {\n  it("R6", async () => {\n${ERWARTE}    expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE.en);\n  });\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      form: "H7.11 der Zugriff steht nur im Kommentar",
      quelle: `it("R7", async () => {\n${ERWARTE}    // expect(x).toBe(MELDUNGEN.OIDC_UNREACHABLE.en);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      form: "H7.12 tote Zuweisung ohne jede Prüfung",
      quelle: `it("R8", async () => {\n${ERWARTE}    const t = MELDUNGEN.OIDC_UNREACHABLE.en;\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      form: "H7.13 blosse Erwähnung ohne Aufruf",
      quelle: `it("R9", async () => {\n${ERWARTE}    MELDUNGEN.OIDC_UNREACHABLE.en;\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      // Der Grund für `MELDUNGEN` in `KEINE_BEOBACHTUNG`: der Zugriff bringt seine eigene
      // Gliederkette mit. Ohne diesen Eintrag hätte JEDE Katalogform Bedingung (f) erfüllt, und
      // ein reiner Katalogfall ohne Route wäre als Messung am Draht durchgegangen.
      form: "H7.14 an einen Aufruf übergeben, aber die Anweisung liest nichts aus der Antwort",
      quelle: `it("R10", async () => {\n${ERWARTE}    expect(meldung("X", "en")).toBe(MELDUNGEN.OIDC_UNREACHABLE.en);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      form: "H7.15 ein Fall ohne expect prüft nichts",
      quelle: `it("R11", async () => {\n  pruefe(res.json().message, MELDUNGEN.OIDC_UNREACHABLE.en);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      form: "H7.16 der Zugriff steht ausserhalb jedes Falls",
      quelle: `const T = pruefe(res.json().message, MELDUNGEN.OIDC_UNREACHABLE.en);\nit("R12", () => {\n  expect(1).toBe(1);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      form: "H7.17 der Zugriff steht ausgeschrieben in einer Zeichenkette",
      quelle: `it("R13", async () => {\n${ERWARTE}    pruefe(res.json().message, "MELDUNGEN.OIDC_UNREACHABLE.en");\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      // Die Grenze der Erkennung, ausdrücklich festgehalten: eine dritte Schreibweise zählt NICHT,
      // der Schlüssel bleibt in `OHNE_ROUTENFALL`. Die leise Seite ist die sichere.
      form: "H7.18 die Klammerform am Katalog selbst wird nicht gelesen",
      quelle: `it("R14", async () => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN["OIDC_UNREACHABLE"].en);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    // --------------------------------------------------------------------------------------------
    // K5.2 · DER NAME ALLEIN IST KEIN SPRACHBELEG (Runde 2, Korrekturpflicht 2 des Prüfers)
    // --------------------------------------------------------------------------------------------
    // BENs G3: die Tabelle von E.1 auf `["de"]` gestellt, Datei und Fallname unverändert. Runde 1
    // zählte `[sprache]` pauschal für EN und NL — die einzige Fremdsprachmessung von
    // `OIDC_UNREACHABLE` verschwand, und H4/H4.2 blieben grün. H7.20–H7.31 halten fest, dass die
    // Sprache jetzt aus der Tabelle KOMMEN muss, sonst gilt der Zugriff als ungemessen.
    {
      form: "H7.20 die Tabelle nennt nur `de` — der Name belegt EN nicht (BENs G3)",
      quelle: `it.each(["de"])("R3 %s", async (sprache) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      form: "H7.21 dieselbe `de`-Tabelle belegt auch NL nicht",
      quelle: `it.each(["de"])("R3 %s", async (sprache) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "nl",
      erwartet: [],
    },
    {
      // Der halbe Sprachverlust, der genauso still wäre: eine der beiden Sprachen fällt weg.
      form: "H7.22 eine Tabelle nur mit `en` belegt EN — und NL gerade nicht",
      quelle: `it.each(["en"])("R3 %s", async (sprache) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "nl",
      erwartet: [],
    },
    {
      form: "H7.23 dieselbe `en`-Tabelle belegt EN sehr wohl — die Erkennung wird nicht blind",
      quelle: `it.each(["en"])("R3 %s", async (sprache) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "en",
      erwartet: ["X.ts · R3 %s"],
    },
    {
      // Mehrspaltig: die Sprache steht in Spalte 1, und nur ihre Werte belegen.
      form: "H7.24 mehrspaltige Tabelle — nur die Spalte des Namens belegt",
      quelle: `it.each([["a", "en"], ["b", "de"]])("R3 %s %s", async (weg, sprache) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "nl",
      erwartet: [],
    },
    {
      form: "H7.25 dieselbe mehrspaltige Tabelle belegt EN aus Spalte 1",
      quelle: `it.each([["a", "en"], ["b", "de"]])("R3 %s %s", async (weg, sprache) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "en",
      erwartet: ["X.ts · R3 %s %s"],
    },
    {
      form: "H7.26 eine Tabelle aus einer Konstanten ist nicht lesbar — also kein Beleg",
      quelle: `it.each(SPRACHEN)("R3 %s", async (sprache) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      form: "H7.27 ein Name ohne jede Tabelle belegt nichts",
      quelle: `it("R3", async () => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      // Der Name ist zwar da, aber er ist NICHT der Parameter dieses Falls — die Tabelle sagt über
      // ihn nichts, auch wenn sie zufällig „en" enthält.
      form: "H7.28 ein Name, den die Tabelle gar nicht bindet, belegt nichts",
      quelle: `it.each(["en", "nl"])("R3 %s", async (weg) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      form: "H7.29 eine Objekttabelle bindet keine Spalte — kein Beleg",
      quelle: `it.each([{ sprache: "en" }])("R3 %s", async ({ sprache }) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      // Ein zusammengesetzter Ausdruck ist nicht belegbar: er steht in keiner Tabellenspalte.
      form: "H7.30 ein zusammengesetzter Sprachausdruck zählt nicht",
      quelle: `it.each([["en"]])("R3 %s", async (sprachen) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprachen[0]]);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
    {
      // Und die Gegenrichtung dazu: eine Tabellenzeile, die kein wörtlicher Wert ist, belegt nicht.
      form: "H7.31 eine Tabellenzeile, die kein wörtlicher Wert ist, belegt nicht",
      quelle: `it.each(["en", waehle()])("R3 %s", async (sprache) => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE[sprache]);\n});\n`,
      sprache: "en",
      erwartet: [],
    },
  ];

  for (const { form, quelle, sprache, erwartet } of FAELLE) {
    it(form, () => {
      const stand = pruefstand("X.ts", quelle);
      expect(messstellen(stand, "SATZ", { schluessel: "OIDC_UNREACHABLE", sprache })).toEqual(
        erwartet,
      );
    });
  }

  it("H7.19 der wörtliche Weg bleibt daneben gültig — es wird ergänzt, nicht ersetzt", () => {
    // Ablösung wäre hier falsch: fast alle heutigen Messungen (R1–R12, M3) schreiben den Satz ab.
    // Beide Zugänge müssen nebeneinander tragen, und zwar in EINEM Aufruf.
    const quelle = `it("R1", async () => {\n${ERWARTE}  pruefe(res.json().message, "SATZ");\n});\nit("R2", async () => {\n${ERWARTE}  expect(res.json().message).toBe(MELDUNGEN.OIDC_UNREACHABLE.en);\n});\n`;
    const stand = pruefstand("X.ts", quelle);
    expect(messstellen(stand, "SATZ", { schluessel: "OIDC_UNREACHABLE", sprache: "en" })).toEqual([
      "X.ts · R1",
      "X.ts · R2",
    ]);
  });
});
