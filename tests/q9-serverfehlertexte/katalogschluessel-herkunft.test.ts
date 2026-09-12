// ================================================================================================
// JOB 3612 · Q9-KATALOGSPRACHE — WOHER JEDER SCHLÜSSEL KOMMT UND WELCHER DAVON GEMESSEN WIRD.
// ================================================================================================
//
// WOZU DIESE DATEI NEBEN `katalog.test.ts` STEHT. S1 dort verlangt von jedem der 27 Schlüssel drei
// verschiedene Sprachfassungen. Damit ist die Lücke GESCHLOSSEN — hier wird sie BENANNT: welcher
// Schlüssel kommt überhaupt woher, und welcher wird heute über eine echte Route gemessen? Ohne
// diese Antwort bleibt „ist übersetzt" eine Zusage ohne Umfang, und niemand sieht, dass 19 von 27
// Schlüsseln nie einen englischen oder niederländischen Satz an einem echten Draht zeigen.
//
// Codex hat die drei auffälligsten selbst genannt — `OIDC_STATE_INVALID`, `ALREADY_SETUP`,
// `UNKNOWN_ROLE` (`archiv/3449/runde-2/ben.md`, HINWEIS 2). Die Listen unten sind NACHGEMESSEN,
// nicht abgeschrieben; die drei stehen darin.
//
// FÜNF WÄCHTER, FÜNF VERSCHIEDENE FRAGEN — keiner ersetzt den anderen:
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
 *  H4 misst gegen den Katalog, und die Vereinigung aus Wurf und Route enthielt `INTERNAL` schon. */
const GEWORFEN = [
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
 * Was sich zwischen gepinnter und gemessener Liste verschoben hat — namentlich. Ohne diesen Satz
 * meldet Vitest nur `expected [ 'ACCOUNT_NOT_FOUND', …(11) ] to deeply equal [ … ]`, und der
 * Mensch, der die Liste nachführen soll, muss selbst suchen, welcher Schlüssel gewandert ist.
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

it("H3.2 Wurf, Route und der eine Sonderweg decken zusammen den ganzen Katalog", () => {
  // Zwei Aussagen in einer: kein Katalogschlüssel ist tot (niemand sendet ihn mehr), und keine
  // Quelle ist übersehen. Ohne sie könnte H2 oder H3 beliebig schrumpfen, solange nur die Pins
  // mitschrumpfen.
  const gedeckt = [...new Set([...GEWORFEN, ...AUS_DER_ROUTE, ...NUR_UEBER_EINE_VARIABLE])].sort();
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

/** Namen, deren Gliederkette nichts über die Antwort sagt: die Prüfsprache selbst und das Protokoll. */
const KEINE_BEOBACHTUNG = new Set(["expect", "console"]);
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
 * Die aktiven Prüffälle dieser Datei, die `satz` wirklich gegen eine Antwort halten — die sechs
 * Bedingungen aus K3 und K4 (Zeichenkette · aktiver Fall · mit `expect` · an einen Aufruf, nicht an
 * `it(` selbst · aus der Tabelle nur über einen im Rumpf verbrauchten Parameter · in einer
 * Anweisung, die die Antwort liest).
 */
function messstellen(stand: Stand, satz: string): string[] {
  if (satz === "") {
    return [];
  }
  const treffer: string[] = [];
  for (let p = stand.rein.indexOf(satz); p >= 0; p = stand.rein.indexOf(satz, p + 1)) {
    // (a) In einer Zeichenkette? In der Maske ist ihr Inhalt geleert, im echten Text steht er.
    const ende = p + satz.length - 1;
    if (stand.maske[p] !== " " || stand.maske[ende] !== " ") {
      continue;
    }
    for (const fall of stand.faelle) {
      // (b)+(c) im Bereich eines aktiven Falls mit `expect`.
      if (p <= fall.von || p >= fall.bis) {
        continue;
      }
      if (p < fall.offen) {
        // (e) Der Satz steht VOR der Namensklammer, also in der `each`-Tabelle. Er zählt nur über
        // den Parameter, den seine Spalte bindet — und nur, wenn der Rumpf ihn wirklich prüft.
        if (fall.tabelle < 0 || p < fall.tabelle) {
          continue;
        }
        const spalte = spalteVon(stand.maske, fall.tabelle, p);
        const name = spalte === null ? null : (fall.parameter[spalte] ?? null);
        if (name !== null && verbraucht(stand, fall, name)) {
          treffer.push(`${stand.ort} · ${fall.name}`);
        }
        continue;
      }
      // (d) einem Aufruf übergeben, und zwar nicht der `it(`-Klammer selbst — sonst zählte eine
      // tote `const t = "…"` oder der Fallname als Messung; (f) in einer Anweisung, die liest.
      const aufruf = stand.aufrufe[p] ?? -1;
      if (aufruf >= 0 && aufruf !== fall.offen && beobachtung(stand, fall, p)) {
        treffer.push(`${stand.ort} · ${fall.name}`);
      }
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
// Der volle Abtast (Kommentare schneiden, Zeichenketten leeren, Fälle lesen) lohnt nur für Dateien,
// die überhaupt einen dieser Sätze nennen — billig zuerst, teuer nur bei Verdacht.
const STAENDE = ROUTENTESTS.filter((d) => FREMDSPRACHIG.some((s) => d.roh.includes(s))).map((d) =>
  pruefstand(d.ort, d.roh),
);

function routenfall(satz: string): string[] {
  return STAENDE.flatMap((stand) => messstellen(stand, satz));
}

/**
 * DIE LISTE (Lieferung 3). 19 von 27 Schlüsseln zeigen heute nirgends einen englischen oder
 * niederländischen Satz an einem echten Draht. Gemessen, nicht abgeschrieben — Codex' drei
 * Beispiele (`OIDC_STATE_INVALID`, `ALREADY_SETUP`, `UNKNOWN_ROLE`) stehen darin.
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
  // SSO. Der ganze Anmeldeweg über einen fremden Anbieter hat keinen einzigen Sprachfall.
  "OIDC_DISABLED",
  "OIDC_LOGIN_FAILED",
  "OIDC_STATE_INVALID",
  "OIDC_UNREACHABLE",
];

/** Die Gegenliste: was heute gemessen IST, mit dem Fall, der es misst. Gepinnt, weil H4 sonst
 *  auch dann grün bliebe, wenn der Fallabtaster nichts mehr findet und alles „ungemessen" heisst
 *  — dann müsste nur die eine Liste wachsen, und niemand sähe, dass die Deckung verschwand. */
const GEMESSEN_VON = {
  INTERNAL: [
    "tests/q9-serverfehlertexte/server.test.ts · R12 Auffangfehler EN verbirgt interne Details",
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
  RESET_RATE_LIMITED: [
    "tests/q9-serverfehlertexte/server.test.ts · R5b Zurücksetzen 429 EN: eigener Zähler",
  ],
  RESET_TOKEN_INVALID: [
    "tests/q9-serverfehlertexte/server.test.ts · R4 Zurücksetzen EN: tatsächlich ausgestellter und abgelaufener Token",
  ],
  WEAK_PASSWORD: ["tests/q9-serverfehlertexte/server.test.ts · R10 kurzes Passwort %s"],
} as const satisfies Record<string, readonly string[]>;

it("H4 genau die gepinnten Schlüssel werden von keinem aktiven Routenfall in EN/NL gemessen", () => {
  const ungemessen = KATALOGSCHLUESSEL.filter((schluessel) => {
    const texte = MELDUNGEN[schluessel as keyof typeof MELDUNGEN];
    return routenfall(texte.en).length === 0 && routenfall(texte.nl).length === 0;
  });
  expect(
    ungemessen,
    `Die Liste ist die ehrliche Auskunft über den Umfang: für diese Schlüssel sagt nur der
Katalogwächter, dass sie übersetzt sind — kein aktiver Fall sieht ihren Satz je an einer echten
Antwort. Bekommt einer davon einen Routenfall, gehört er aus der Liste heraus; verliert einer
seinen — auch durch ein \`skip\` oder ein vergessenes \`only\` —, muss er hinein.
Verschoben hat sich: ${verschiebung(ungemessen, OHNE_ROUTENFALL)}
Gemessen über ${STAENDE.length} von ${ROUTENTESTS.length} Testdateien, die die App über \`${ROUTEN_MERKMAL}\` fahren.`,
  ).toEqual([...OHNE_ROUTENFALL].sort());
});

it("H4.2 jeder gemessene Schlüssel nennt den aktiven Fall, der ihn misst", () => {
  // Die Gegenrichtung zu H4. Wird ein Routenfall abgeschaltet oder sein Satzvergleich entfernt,
  // wird DIESER Fall rot und nennt Datei und Fallnamen — nicht nur „die Liste ist länger".
  const gemessen = Object.fromEntries(
    KATALOGSCHLUESSEL.map((schluessel) => {
      const texte = MELDUNGEN[schluessel as keyof typeof MELDUNGEN];
      return [schluessel, [...new Set([...routenfall(texte.en), ...routenfall(texte.nl)])].sort()];
    }).filter(([, orte]) => (orte as string[]).length > 0),
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

it("H4.9 der Fallabtaster findet die Fälle des Routentests dieses Ordners", () => {
  // Ohne diesen Pin könnte der Abtaster an einer neuen Schreibweise scheitern: er fände keine
  // Fälle mehr, H4 wüchse auf alle 27 Schlüssel — und das sähe aus wie ein Deckungsverlust im
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
