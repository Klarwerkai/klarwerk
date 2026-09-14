// ==================================================================================================
// JOB 3818 · DIE BÜHNEN UNTER `tests/design/` MESSEN IN EINEM SICHEREN KONTEXT — ODER STEHEN NAMENTLICH
// IM ALTBESTAND.
// ==================================================================================================
//
// WAS DIESER FALL VERHINDERT, und warum er nicht theoretisch ist. Chromium führt `http://` auf einem
// erfundenen Host (`http://klarwerk.test`) als NICHT SICHEREN KONTEXT. In einem unsicheren Kontext
// fehlt `crypto.randomUUID`. Genau diese Funktion ist der ERSTE Griff jeder Produktmeldung
// (`apps/web/src/app/ToastContext.tsx:36`, `ToastProvider.push`) und der Vorgangsschlüssel jedes
// Schreibwegs (`apps/web/src/lib/createOperation.ts`). Eine Bühne mit unsicherem Ursprung kann
// deshalb GAR KEINE Meldung und keinen Schreibweg messen: die Seite wirft
// `TypeError: crypto.randomUUID is not a function`, der Zweig bricht ab, und der Test bleibt grün,
// weil die Ausnahme die Zusicherung erst danach erreicht.
//
// DAS IST DREIMAL PASSIERT, jedes Mal erst nach Monaten bemerkt:
//   · JOB 3062 R6 an h3 — „Auf dieser Bühne scheiterte deshalb JEDER Schreibweg"
//     (`tests/design/h3-blatt-buehne.ts:35-49`).
//   · JOB 3065 R2 an h6 — „Der erste Lauf … stürzte in der Seite ab"
//     (`tests/design/h6-chromium.ts:29-38`).
//   · JOB 3777 an h4 — Sonde auf der laufenden Seite:
//     `{"uuid":"undefined","sicher":false,"ursprung":"http://klarwerk.test","outputs":0}`
//     (`archiv/3777/runde-1/RUECKGABE.md:54`). JOB 3818 hat h4 umgestellt.
// Dreimal derselbe Fund, dreimal von Hand. Ab hier sagt es ein Test.
//
// ER LÄUFT OHNE BROWSER. Gemessen wird am QUELLTEXT der Bühnen (dieselbe Bauart wie
// `tests/design-vorrichtung/seiten-typ-waechter.test.ts`): kein Chromium, kein `dist`, kein
// Playwright — weder als Wert- noch als Typimport. Eine zweite Browser-Startstelle wäre hier der
// teuerste denkbare Weg zur billigsten Aussage, und `tests/tor-inventar/tor-bestand-vollstaendig.test.ts`
// hält die Zahl der Startstellen ausdrücklich fest (`:348`).
//
// DIE SCHRANKE GILT IN BEIDE RICHTUNGEN (Lehre JOB 3550/3562, „ein Wächter, der nichts mehr sieht,
// ist grün und nutzlos"), nach dem Muster von `seiten-typ-waechter.test.ts:148-176`:
//   · Eine NEUE Bühne mit unsicherem Ursprung, die in keinem Register steht, macht V2 rot — egal in
//     welcher Tiefe unter `tests/design/` sie liegt. Dass der Gang wirklich hinabsteigt, ist nicht
//     zugesagt, sondern in V7 gemessen; Runde 1 dieses Jobs ist genau daran gescheitert.
//   · Eine ALTBESTAND-Zeile, die ihre Schuld LOSWIRD (sicherer Ursprung) oder verschwindet, macht
//     V3 rot — dann gehört der Eintrag weg, sonst verwaltet das Register Gespenster.
//   · Eine Zeile, deren eingetragener Ursprung nicht mehr der gemessene ist, macht V3 bzw. V4 rot.
// Kein `skip`, kein `it.fails`: jede Zeile unten ist eine Tatsachenbehauptung über den Bestand.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = resolve(process.cwd());

/**
 * Der Baum, über den dieser Fall geht — `tests/design/` MIT allen Unterordnern. Andere Bühnen
 * (z. B. `tests/profil-schmal/`) sind nicht gemeint.
 *
 * WARUM AUSDRÜCKLICH DER BAUM UND NICHT DER ORDNER: Runde 1 dieses Jobs las nur die unmittelbaren
 * Verzeichniseinträge. Der Prüfer hat die Lücke nicht behauptet, sondern gemessen — eine vollständige
 * h4-Kopie mit `http://klarwerk.test` unter `tests/design/ben3818-probe/h4-unsicher.ts` lief
 * durch: „**Tests 6 passed (6)**, Exit 0". Ein Wächter, den man durch das Anlegen eines Unterordners
 * abschüttelt, ist keine Schranke, sondern eine Verabredung. Heute hat `tests/design/` keinen
 * einzigen Unterordner (V7 hält das fest); genau deshalb wäre der erste je angelegte der blinde
 * Fleck gewesen.
 */
const BUEHNEN_ORDNER = "tests/design";

/** Verzeichnisse, die der Gang nie betritt (Vorbild: `tests/tor-inventar/browser-gruppe.ts:98`). */
const NICHT_BETRETEN = new Set(["node_modules", "dist", ".git", ".local", "coverage"]);

/**
 * Das Merkmal einer Chromium-STARTSTELLE, rein textlich gelesen.
 *
 * BEWUSST NICHT „enthält das Wort playwright": `tests/tor-inventar/browser-gruppe.ts:21-23` hat
 * genau diesen Fehlschluss ausgemessen — eine Textsuche nach „playwright" trifft im eigenen Bestand
 * nachweislich daneben (Kommentare, Argumentlisten). `chromium.launch(` steht im Bestand an KEINER
 * anderen Stelle als an einer echten Startstelle; im Baum `tests/design/**` sind es 15 Dateien.
 */
const START_MERKMAL = "chromium.launch(";

/** Die Zeile, in der eine Bühne ihren Ursprung benennt — `const ORIGIN = "…";`, mit oder ohne `export`. */
const ORIGIN_ZEILE = /^(?:export )?const ORIGIN = "([^"]+)";$/m;

/** Diese Datei selbst — für V6. */
const SELBST = "tests/vorrichtung-sicherer-kontext/sicherer-kontext-der-buehnen.test.ts";

interface Buehne {
  /** Pfad ab der Repowurzel, mit `/` als Trenner. */
  readonly pfad: string;
  /** Der gemessene Wert aus der `ORIGIN`-Zeile. */
  readonly ursprung: string;
}

/** Ein Pfad in der Schreibweise, in der `git` und die Register ihn führen (Vorbild: `browser-gruppe.ts`). */
function alsPosix(absolut: string): string {
  return relative(WURZEL, absolut).split("\\").join("/");
}

/**
 * Jede `.ts`/`.tsx`-Datei im BAUM unter `tests/design/`, rekursiv, sortiert, posix-relativ.
 *
 * Der Gang ist bewusst derselbe wie in `seiten-typ-waechter.test.ts:448-460` und
 * `browser-gruppe.ts:239-257`: Unterordner werden BETRETEN, nur `NICHT_BETRETEN` nicht. Die frühere
 * Fassung dieses Falls nahm die unmittelbaren Einträge — das ist die Lücke, die Runde 1 rot gemacht
 * hat.
 */
function quelldateien(ordner: string = BUEHNEN_ORDNER): string[] {
  const gefunden: string[] = [];
  const gehe = (verzeichnis: string): void => {
    for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
      if (eintrag.isDirectory()) {
        if (!NICHT_BETRETEN.has(eintrag.name)) gehe(join(verzeichnis, eintrag.name));
        continue;
      }
      if (!eintrag.isFile() || !/\.(ts|tsx)$/.test(eintrag.name)) continue;
      gefunden.push(alsPosix(join(verzeichnis, eintrag.name)));
    }
  };
  gehe(join(WURZEL, ordner));
  return gefunden.sort();
}

/**
 * Alle Chromium-Startstellen im Baum unter `tests/design/`, je mit ihrem selbst benannten Ursprung.
 *
 * Eine Startstelle OHNE eigene `ORIGIN`-Zeile gibt es heute nicht; gäbe es eine, wäre sie ein
 * blinder Fleck dieses Falls — deshalb wird sie in V1 ausdrücklich rot gemeldet und nicht
 * stillschweigend übersprungen.
 */
function buehnen(): { gefunden: Buehne[]; ohneUrsprung: string[] } {
  const gefunden: Buehne[] = [];
  const ohneUrsprung: string[] = [];
  for (const pfad of quelldateien()) {
    const quelle = readFileSync(join(WURZEL, pfad), "utf8");
    if (!quelle.includes(START_MERKMAL)) continue;
    const treffer = ORIGIN_ZEILE.exec(quelle);
    if (treffer?.[1] === undefined) {
      ohneUrsprung.push(pfad);
      continue;
    }
    gefunden.push({ pfad, ursprung: treffer[1] });
  }
  return { gefunden, ohneUrsprung };
}

/**
 * DIE EIGENTLICHE FRAGE — und sie lautet „sicherer Kontext", nicht „fängt mit https an".
 *
 * Das ist keine Aufweichung, sondern die Regel, nach der Chromium wirklich entscheidet
 * („potentially trustworthy origin"): `https://…` ist sicher, und `http://localhost` ist es
 * ebenfalls — genau darauf hat sich `h3-blatt-buehne.ts:50` gestützt, mit der ausgeschriebenen
 * Begründung „dieselbe Regel, unter der die App im Betrieb läuft: localhost in der Entwicklung,
 * https im Betrieb". Ein Wächter, der h3 trotz sicherem Kontext als Schuldner führte, würde eine
 * erledigte Sache offenhalten und wäre in der Sache falsch.
 */
function istSicher(ursprung: string): boolean {
  const u = new URL(ursprung);
  if (u.protocol === "https:") return true;
  return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
}

interface Zeile {
  /** Der Ursprung, der heute gemessen wird — weicht der Bestand ab, ist der Eintrag falsch. */
  readonly ursprung: string;
  /** Warum die Zeile so steht. Ein Satz, kein Freibrief. */
  readonly grund: string;
}

// ==================================================================================================
// DIE DREI BÜHNEN, DIE IN EINEM SICHEREN KONTEXT MESSEN — je eine Aussage, namentlich.
// ==================================================================================================
const SICHER: ReadonlyMap<string, Zeile> = new Map<string, Zeile>([
  [
    "tests/design/h3-blatt-buehne.ts",
    {
      ursprung: "http://localhost",
      grund:
        "JOB 3062 R6. `localhost` ist für Chromium grundsätzlich vertrauenswürdig; bis R5 stand " +
        "hier `http://klarwerk.test`, und auf jener Bühne scheiterte JEDER Schreibweg am fehlenden " +
        "`crypto.randomUUID` (`lib/createOperation.ts`). Die Begründung steht bei `:35-49`.",
    },
  ],
  [
    "tests/design/h4-harness.ts",
    {
      ursprung: "https://klarwerk.test",
      grund:
        "JOB 3818, der Anlass dieses Falls. Bis dahin `http://klarwerk.test`; die Sonde von JOB 3777 " +
        'las auf der laufenden Seite `{"uuid":"undefined","sicher":false,…}`, und in dieser ' +
        "Vorrichtung ist deshalb NIE eine Meldung erschienen. Rund zwanzig Browserprüfungen hängen " +
        "an ihr; die Begründung steht bei `ORIGIN`.",
    },
  ],
  [
    "tests/design/h6-chromium.ts",
    {
      ursprung: "https://klarwerk.test",
      grund:
        "JOB 3065 R2, der erste Fund dieser Art im Bestand: „Statt ihn zu umgehen, misst dieser " +
        "Prüfstand jetzt in derselben Art von Kontext wie der Betrieb" +
        "“ (`:29-38`).",
    },
  ],
]);

// ==================================================================================================
// DER ALTBESTAND — GEZÄHLT UND BENANNT, AUFTRAGSGEMÄSS NICHT UMGEBAUT (JOB 3818 §10).
// ==================================================================================================
//
// Zwölf Bühnen stehen heute noch auf einem unsicheren Ursprung. Sie sind NICHT kaputt: was sie
// messen (Abstände, Farben, Beschriftungen, Sichtbarkeit gegen ein Zielbild), kommt ohne
// `crypto.randomUUID` aus. Ihre GRENZE ist immer dieselbe und hier festgehalten: eine Produktmeldung
// oder ein Schreibweg ist auf ihnen nicht messbar. Wer auf einer dieser Bühnen eine Meldung messen
// will, stellt ihren Ursprung um — und löscht ihre Zeile hier.
//
// JOB 3818 §10 nennt „h1, h5, k1 und die `zielbild-*`-Eigenbauten". Nachgemessen sind es DREI mehr:
// `h2-funktionsinventar.test.ts`, `job2935-validierung-fussband.test.ts` und `k2-buehne.ts` bauen
// ebenfalls eigene Bühnen mit eigenem Ursprung. Sie stehen hier, weil ein Register, das nur die
// erwarteten Fälle führt, die unerwarteten deckt.
const ALTBESTAND: ReadonlyMap<string, Zeile> = new Map<string, Zeile>([
  [
    "tests/design/h1-chromium.ts",
    {
      ursprung: "http://klarwerk.test",
      grund:
        "JOB 3060 H1, die geteilte Messstrecke der Hülle (`:2`). Verbraucher sind die beiden " +
        "H1-Zielbildmessungen; sie messen die Hülle, keinen Schreibweg.",
    },
  ],
  [
    "tests/design/h2-funktionsinventar.test.ts",
    {
      ursprung: "http://klarwerk.test",
      grund:
        "JOB 3061 H2 (`:2`): eigene Bühne IM Test, die jede Zeile des Inventars in der gebauten " +
        "Validierungsfläche anklickt. Geklickt wird auf Sichtbarkeit, nicht auf Wirkung.",
    },
  ],
  [
    "tests/design/h5-funktionsinventar.test.ts",
    {
      ursprung: "http://klarwerk.test",
      grund:
        "JOB 3064 H5 (`:2`): eigene Bühne im Test für Start, Aufgaben und Fragen — dieselbe Bauart " +
        "und dieselbe Grenze wie H2.",
    },
  ],
  [
    "tests/design/job2935-validierung-fussband.test.ts",
    {
      ursprung: "http://klarwerk.test",
      grund:
        "JOB 2935 D1 und Nachfolger (`:2`, `:314`, `:729`, `:1017`): DREI eigene Browserstarts in " +
        "EINER Datei (`:211`, `:537`, `:1116`) am Fussband der Validierungskarte. Gemessen werden " +
        "Lage und Sichtbarkeit im Fenster.",
    },
  ],
  [
    "tests/design/k1-messung.ts",
    {
      ursprung: "http://klarwerk.test",
      grund:
        "JOB 3056 K1 (`:2`), das Messgerät der Klara-Flächen: lädt `dist/word-addin/taskpane.html` " +
        "und vergleicht `getComputedStyle` gegen Pedis Mockups. Reine Stilmessung.",
    },
  ],
  [
    "tests/design/k2-buehne.ts",
    {
      ursprung: "http://klara.test",
      grund:
        "JOB 3057 K2 (`:2`), die Klara-Erfassen-Fläche bei 360 px. Der EINZIGE Ursprung im Ordner, " +
        "der nicht `klarwerk.test` heisst — beim Umstellen ist er die Stelle, die man vergisst.",
    },
  ],
  [
    "tests/design/zielbild-h2-pruefen.test.ts",
    {
      ursprung: "http://klarwerk.test",
      grund:
        "JOB 3061 H2 (`:2`): die drei Mockups an der echten Seite gemessen, eigene Bühne im Test.",
    },
  ],
  [
    "tests/design/zielbild-h5-fragen.test.ts",
    {
      ursprung: "http://klarwerk.test",
      grund: "JOB 3064 H5 (`:2`): die Fragenfläche gegen `design/klarwerk/Fragen.dc.html`.",
    },
  ],
  [
    "tests/design/zielbild-h5-kein-erklaertext.test.ts",
    {
      ursprung: "http://klarwerk.test",
      grund: "JOB 3064 H5 (`:2`), der Textmesser: auf Start und Fragen steht kein Erklärtext mehr.",
    },
  ],
  [
    "tests/design/zielbild-h5-start.test.ts",
    {
      ursprung: "http://klarwerk.test",
      grund: "JOB 3064 H5 (`:2`): die Startseite gegen `design/klarwerk/Main.dc.html`.",
    },
  ],
  [
    "tests/design/zielbild-keinwissen.test.ts",
    {
      ursprung: "http://klarwerk.test",
      grund:
        "JOB 3046 D2 „Kein Wissen“ (`:2`): die Auskunftsfläche am echten Panel " +
        "(`/word-addin/taskpane.html`, `:67`) — dieselbe Auslieferung wie K1.",
    },
  ],
  [
    "tests/design/zielbild-wissensnetz.test.ts",
    {
      ursprung: "http://klarwerk.test",
      grund: "JOB 3052 D6 „Wissensnetz“ (`:2`): das Netz des Zielbilds, eigene Bühne im Test.",
    },
  ],
]);

describe("JOB 3818 · Sicherer Kontext der Chromium-Bühnen unter tests/design/", () => {
  it("V1 · jede Chromium-Startstelle benennt ihren Ursprung und steht in GENAU EINEM Register", () => {
    const { gefunden, ohneUrsprung } = buehnen();

    expect(
      ohneUrsprung,
      'Startstelle ohne eigene `const ORIGIN = "…";`-Zeile — dieser Fall kann sie nicht messen; ' +
        "entweder die Zeile nachtragen oder den Ursprung von einer Bühne importieren",
    ).toEqual([]);
    // Der Bestand ist nicht leer: ein leerer Gang wäre ein grüner, blinder Wächter.
    expect(gefunden.length, "keine einzige Bühne gefunden — das Merkmal trifft nicht mehr").toBe(
      15,
    );

    for (const b of gefunden) {
      const registriert = (SICHER.has(b.pfad) ? 1 : 0) + (ALTBESTAND.has(b.pfad) ? 1 : 0);
      expect(
        registriert,
        `${b.pfad} (${b.ursprung}) steht in ${registriert} Registern statt in genau einem — eine neue Bühne gehört benannt: sicherer Ursprung → SICHER, sonst ALTBESTAND mit Grund`,
      ).toBe(1);
    }
  });

  it("V2 · eine Bühne mit UNSICHEREM Ursprung steht im ALTBESTAND — sonst ist sie rot", () => {
    const { gefunden } = buehnen();
    const unsicherOhneZeile = gefunden
      .filter((b) => !istSicher(b.ursprung) && !ALTBESTAND.has(b.pfad))
      .map((b) => `${b.pfad} → ${b.ursprung}`);

    expect(
      unsicherOhneZeile,
      "Unsicherer Kontext ohne Eintrag: dort fehlt `crypto.randomUUID`, also ist auf dieser Bühne " +
        "KEINE Produktmeldung (`app/ToastContext.tsx:36`) und kein Schreibweg " +
        "(`lib/createOperation.ts`) messbar. Entweder `https://…` bzw. `http://localhost` setzen " +
        "oder die Bühne mit Grund in den ALTBESTAND eintragen.",
    ).toEqual([]);
  });

  it("V3 · jede ALTBESTAND-Zeile ist noch da, noch unsicher und mit dem gemessenen Ursprung eingetragen", () => {
    const { gefunden } = buehnen();
    const nachPfad = new Map(gefunden.map((b) => [b.pfad, b.ursprung]));

    for (const [pfad, zeile] of ALTBESTAND) {
      const gemessen = nachPfad.get(pfad);
      expect(
        gemessen,
        `${pfad} ist keine Chromium-Startstelle unter ${BUEHNEN_ORDNER} mehr (verschoben, gelöscht oder umgebaut) — die Zeile verwaltet ein Gespenst und gehört weg`,
      ).toBeDefined();
      expect(
        gemessen,
        `${pfad}: eingetragen ist „${zeile.ursprung}", gemessen „${gemessen}" — der Grund unten beschreibt eine andere Lage als die wirkliche`,
      ).toBe(zeile.ursprung);
      expect(
        istSicher(zeile.ursprung),
        `${pfad} misst inzwischen in einem sicheren Kontext (${zeile.ursprung}) — die Schuld ist weg, die Zeile gehört aus dem ALTBESTAND gelöscht und nach SICHER übertragen`,
      ).toBe(false);
      expect(
        zeile.grund.length,
        `${pfad}: ein Eintrag ohne Grund ist ein Freibrief`,
      ).toBeGreaterThan(40);
    }
    expect(
      ALTBESTAND.size,
      "die Zahl der Schuldner hat sich geändert, ohne dass jemand sie nennt",
    ).toBe(12);
  });

  it("V4 · die drei sicheren Bühnen sind namentlich da und WIRKLICH sicher", () => {
    const { gefunden } = buehnen();
    const nachPfad = new Map(gefunden.map((b) => [b.pfad, b.ursprung]));

    for (const [pfad, zeile] of SICHER) {
      const gemessen = nachPfad.get(pfad);
      // Zwei Zusicherungen und nicht eine: sonst meldet ein VERSTELLTER Ursprung „ist keine
      // Startstelle mehr", und die Meldung schickt den Lesenden in die falsche Richtung.
      expect(
        gemessen,
        `${pfad} ist keine Chromium-Startstelle unter ${BUEHNEN_ORDNER} mehr (verschoben, gelöscht oder umgebaut) — die SICHER-Zeile gehört nachgeführt`,
      ).toBeDefined();
      expect(
        gemessen,
        `${pfad}: eingetragen ist „${zeile.ursprung}", gemessen „${gemessen}" — der Ursprung dieser Bühne ist verstellt worden`,
      ).toBe(zeile.ursprung);
      expect(
        istSicher(zeile.ursprung),
        `${pfad} steht unter SICHER, misst aber in ${zeile.ursprung} — das ist kein sicherer Kontext`,
      ).toBe(true);
    }
    expect(SICHER.size).toBe(3);
  });

  it("V5 · h4-harness misst in einem sicheren Kontext — der Anlass dieses Falls, namentlich", () => {
    const { gefunden } = buehnen();
    const h4 = gefunden.find((b) => b.pfad === "tests/design/h4-harness.ts");

    expect(h4, "tests/design/h4-harness.ts startet kein Chromium mehr").toBeDefined();
    expect(
      h4?.ursprung,
      "tests/design/h4-harness.ts (`export const ORIGIN`) ist auf einen unsicheren Ursprung zurückgefallen. Dann misst " +
        "KEINE der Browserprüfungen über diese Vorrichtung je wieder eine Erfolgs- oder " +
        "Fehlermeldung: `ToastProvider.push` wirft `TypeError: crypto.randomUUID is not a " +
        "function` (`apps/web/src/app/ToastContext.tsx:36`), und der Zweig bricht still ab. " +
        "Gemessen von JOB 3777, behoben von JOB 3818.",
    ).toBe("https://klarwerk.test");
  });

  it("V6 · dieser Fall startet selbst keinen Browser — kein Playwright, auch nicht als Typ", () => {
    const quelle = readFileSync(join(WURZEL, SELBST), "utf8");
    const spezifizierer = [...quelle.matchAll(/^import[^\n]* from "([^"]+)";$/gm)].map((m) => m[1]);

    // Erschöpfend, nicht „enthält kein playwright": eine neue Abhängigkeit fällt so auf, egal wie
    // sie heisst. `tests/tor-inventar/browser-gruppe.ts:117-119` nennt den Grund, aus dem auch ein
    // reiner `import type` zählt — der Torgraph läse ihn als weitere Browser-Startstelle.
    expect(spezifizierer.sort()).toEqual(["node:fs", "node:path", "vitest"]);
  });

  it("V7 · der Gang steigt WIRKLICH in Unterordner hinab — sonst genügt ein `mkdir`, um ihn abzuschütteln", () => {
    // WARUM ES DIESEN FALL GIBT: In Runde 1 las der Gang nur die unmittelbaren Verzeichniseinträge
    // von `tests/design/`. Der Prüfer legte eine vollständige h4-Kopie mit `http://klarwerk.test`
    // unter `tests/design/ben3818-probe/h4-unsicher.ts` ab — V1–V6 blieben GRÜN („Tests 6 passed
    // (6)", Exit 0). Die Schranke aus Lieferung 3 („eine neue `http`-Bühne macht rot") galt also
    // genau so weit wie ein Ordner tief.
    //
    // Heute hat `tests/design/` keinen einzigen Unterordner. Ein Fall, der nur dort misst, könnte
    // die Rekursion deshalb nie beweisen — er wäre grün, egal ob der Gang hinabsteigt. Also wird
    // derselbe Gang über `tests/` geführt, wo es Unterordner nachweislich gibt, und auf TIEFE
    // gemessen statt auf Namen: einzelne fremde Dateien dürfen verschwinden, ohne diesen Fall rot
    // zu machen, aber ein flach gemachter Gang darf es nicht.
    const tiefe = (pfad: string): number => pfad.split("/").length - 1;
    const unterTests = quelldateien("tests");

    expect(
      unterTests.filter((p) => tiefe(p) >= 2).length,
      "der Gang findet unter `tests/` nichts EINE Ebene tiefer — er liest offenbar wieder nur die " +
        "unmittelbaren Verzeichniseinträge (`readdirSync` ohne Abstieg). Genau so ist die Lücke " +
        "von Runde 1 entstanden.",
    ).toBeGreaterThan(0);
    expect(
      unterTests.filter((p) => tiefe(p) >= 3).length,
      "der Gang findet unter `tests/` nichts ZWEI Ebenen tiefer (z. B. `tests/library/support/`) — " +
        "er steigt nur einen Schritt hinab statt beliebig tief",
    ).toBeGreaterThan(0);
    // Der Anker: dieselbe Auflistung muss die Bühne enthalten, um die es hier geht — sonst misst
    // V7 zwar Tiefe, aber an einem anderen Gang als V1–V5.
    expect(
      quelldateien("tests").includes("tests/design/h4-harness.ts"),
      "derselbe Gang findet `tests/design/h4-harness.ts` nicht mehr",
    ).toBe(true);
    // Und die Gegenrichtung: `NICHT_BETRETEN` bleibt wirksam, sonst läuft der Gang in `node_modules`.
    expect(
      unterTests.filter((p) => p.split("/").some((teil) => NICHT_BETRETEN.has(teil))),
      "der Gang hat ein ausgeschlossenes Verzeichnis betreten",
    ).toEqual([]);
  });
});
