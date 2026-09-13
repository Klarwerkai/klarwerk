// ================================================================================================
// JOB 3797 · DER PROZESSBELEG — nicht der Quelltext, der laufende Prozess.
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN DEM WÄCHTER STEHT. `werkzeug-startvertrag.test.ts` misst, WO der Aufruf
// im Quelltext steht. Das ist die Sicherung gegen den nächsten Umbau — es ist aber KEINE Aussage
// darüber, was der Betreiber der Vorführ-Instanz auf seinem Bildschirm liest. Die Zusage dieses
// Auftrags lautet: EINE lesbare Zeile mit ALLEN fehlenden Namen, Exit ungleich 0, keine Stapelspur.
// Solche Zusagen werden am Prozess gemessen, nicht am Text (Hausmuster:
// `tests/demo-zugang-start/echter-serverstart.test.ts`, JOB 3655 F).
//
// GEMESSEN AM BASISSTAND 56d2995, VOR DIESEM AUFTRAG — so sah es aus:
//   Produktion, `KLARWERK_DB_URL` gesetzt, `APP_BASE_URL` fehlt → Exit 1, zwölf Zeilen stderr,
//   erste Zeile `/…/services/app/src/start-vertrag.ts:927`, darin `at ModuleJob.run`.
//   Produktion, GAR NICHTS gesetzt → Exit 2 mit der eigenen Meldung; `APP_BASE_URL` kam im ganzen
//   Ausgabetext nicht vor. Der Betreiber erfuhr einen Namen und startete neu, um den nächsten zu
//   erfahren — genau das, was der Startvertrag beenden soll.
//
// DIE UMGEBUNG WIRD VOLLSTÄNDIG NEU GEBAUT und NICHT geerbt: eine lokal gesetzte `DATABASE_URL`
// brächte diese Datei sonst still zum Schweigen. Die Verbindungszeichenkette zeigt AUSDRÜCKLICH
// auf Port 1 — sie ist unerreichbar. Es wird keine Datenbank gestartet und keine berührt; das
// Werkzeug läuft im Trockenlauf (kein `--ausfuehren`) und schreibt auch dann nichts.
//
// ================================================================================================
// JOB 3842 (i) — `EPERM` UND `ECONNREFUSED` TRAGEN DIESELBE AUSSAGE.
// ================================================================================================
//
// P4 verlangte bis zu diesem Auftrag die eine Form `ECONNREFUSED` als alleinstehende Zusicherung
// auf der Fehlerausgabe (JOB 3797, dort Zeile 121 — ABGELÖST, sie steht nicht mehr daneben). Das
// war keine Aussage über das Produkt, sondern über die Umgebung, in der gemessen wird: WER den
// Verbindungsversuch abweist, entscheidet nicht das Werkzeug, sondern die Sandkiste.
//
//   · Prüfer BEN, JOB 3797 Runde 4 (`archiv/3797/runde-4/ben.md:9`), wörtlich:
//     „P4 erhält `connect EPERM 127.0.0.1:1` statt `ECONNREFUSED`" — bei ihm wies schon die
//     Rückschleife ab, der Fall war in zwei Runden rot und wurde in jeder Rückgabe entschuldigt.
//   · In der Sandkiste DIESER Runde, selbst gemessen mit `net.connect` auf sechs Adressen:
//     `127.0.0.1:1` → `connect ECONNREFUSED 127.0.0.1:1`, `localhost:1` → `ECONNREFUSED`,
//     dagegen `192.0.2.1:1`, `10.255.255.1:1`, `8.8.8.8:1` → `connect EPERM <Adresse>`.
//     Hier ist die Rückschleife frei und alles ausserhalb gesperrt. BEIDE Formen sind also in
//     dieser Sandkiste erreichbar — die geweitete Liste ist gemessen, nicht angenommen.
//
// Für die Frage, die P4 stellt, sind beide dasselbe Ereignis: DER VERTRAG HAT DURCHGELASSEN, DAS
// NETZ HAT VERWEIGERT. Der Unterschied kommt von der Sandkiste, nicht vom Produkt — deshalb steht
// die Form in `VERWEIGERUNGSFORMEN` und nicht als Literal in einer Zusicherung. Damit ein fremder
// `EPERM` (gesperrte Datei, anderer Host) den Fall nicht blind grün macht, wird die Form NUR
// unmittelbar vor der gewählten `ZIELADRESSE` anerkannt.
//
// ================================================================================================
// JOB 3842 (ii) — WARUM P5 NEBEN DEM QUELLTEXTWÄCHTER STEHT UND IHN NICHT ERSETZT.
// ================================================================================================
//
// `tools/bodytext-nachziehen.ts:206-209` führt `main()` nur bei DIREKTEM Aufruf aus; der
// Vertragsaufruf `:176` steht innerhalb von `main()`. Bräche der Vertrag schon beim blossen Import,
// stürbe jeder Testlauf, der dieses Modul anfasst, unter `NODE_ENV=production`. Diese
// NICHT-Wirkung ist die wichtigste Zusage des Vertrags an diesem Einstiegspunkt.
//
// Bewacht war sie bisher nur am QUELLTEXT: `werkzeug-startvertrag.test.ts` W1/W2 misst, WO der
// Aufruf steht und dass der CLI-Riegel ihn fängt. Das ist eine Aussage über die nächste Umbau-Runde
// und über jeden neuen Einstiegspunkt, den jemand baut — aber keine über den laufenden Prozess:
// ein Aufruf kann am richtigen Ort stehen und trotzdem beim Import wirken (Modulrumpf, statischer
// Klassenblock, ein Import mit Nebenwirkung). P5 misst umgekehrt die WIRKUNG an genau einem
// Kindprozess und sagt nichts über den nächsten Einstiegspunkt. Keiner der beiden ersetzt den
// anderen; sie stehen absichtlich nebeneinander, wie der Kopf oben es für die ganze Datei begründet.
//
// (iii) NICHT GELIEFERT und hier ausdrücklich benannt: W6 — ein Lauf gegen ein isoliertes
// Test-PostgreSQL, bei dem das Werkzeug wirklich durchläuft. In dieser Sandkiste ist keine
// Datenbank fahrbar; die Bestellung aus `archiv/3797/runde-4/ben.md` Prüfpunkt 6 bleibt offen.
//
// ================================================================================================
// JOB 3842 RUNDE 2 — WAS DER PRÜFER AN RUNDE 1 ZERLEGT HAT.
// ================================================================================================
//
// (1) DIE ADRESSBINDUNG WAR EINE TEILZEICHENKETTENSUCHE. `includes("ECONNREFUSED 127.0.0.1:1")`
// ist auch für `connect ECONNREFUSED 127.0.0.1:10` wahr. BEN verstellte nur die
// Verbindungszeichenkette auf Port 10 und bekam `Tests  5 passed (5)` — der Fall belegte also
// gerade NICHT, dass die Verweigerung zur gewählten Adresse gehört. Dasselbe galt für den
// Anti-Drift-Riegel (`toContain(ZIELADRESSE)`). Behoben an beiden Stellen und verschieden:
// auf der Fehlerausgabe ein Muster mit `\b` vorn und `(?!\d)` hinter dem Port; auf der
// Verbindungszeichenkette ein EXAKTER Vergleich der GEPARSTEN Adresse (`new URL`). Dass beides
// trennt, ist nicht behauptet, sondern in P6 an neun Zeichenketten mit bekannter Antwort gemessen.
//
// (2) DIE DIAGNOSE KAM ZU SPÄT. Sie entstand erst unmittelbar vor der Schlusszusicherung; ein
// früher Fehlschlag (Vertragsabbruch, Adressabweichung) brach vorher ab und meldete eine nackte
// Zeile ohne Exitcode, ohne Prozessausgabe, ohne die gesuchten Formen. Jetzt wird der Befund VOR
// der ersten Zusicherung gebaut und von JEDER getragen; nur die Kopfzeile unterscheidet sie.
//
// FOLGE FÜR DEN AUFTRAG: §5 Lieferung 2 verlangte, die Bestandszusicherungen „zeichengleich" zu
// erhalten. Das ist mit (2) nicht vereinbar — Korrekturpflicht 2 verlangt genau an diesen Zeilen
// die Diagnose. Erhalten bleiben Gegenstand und Schärfe jeder Zusicherung, geändert ist allein
// ihre Meldung. Das ist in der Rückgabe als Abweichung benannt.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");

/**
 * Die Adresse, die gewählt wird — und die in der Fehlerausgabe wiederzufinden ist. HOST UND PORT
 * STEHEN GETRENNT, weil beide EXAKT verglichen werden müssen und nicht als Teilzeichenkette:
 * `127.0.0.1:1` steckt auch in `127.0.0.1:10`, und genau daran war Runde 1 rot (BEN, JOB 3842 R1,
 * Korrekturpflicht 1: „Nur die Verbindungszeichenkette auf Port 10 verstellen → Tests 5 passed").
 * Sie steht ABSICHTLICH getrennt von der Verbindungszeichenkette und nicht als Einsetzung darin:
 * P4 prüft, ob die Verweigerung zu DIESER Adresse gehört, und diese Prüfung muss sich verstellen
 * lassen, ohne dass die gewählte Adresse mitwandert. Der Anti-Drift-Riegel in P4 hält beide zusammen.
 */
const ZIELHOST = "127.0.0.1";
const ZIELPORT = 1;
const ZIELADRESSE = `${ZIELHOST}:${ZIELPORT}`;

/** Port 1 nimmt niemand an. Dieselbe Bauform wie in `echter-serverstart.test.ts` (:77). */
const UNERREICHBAR = "postgresql://kennung:kennwort@127.0.0.1:1/klarwerk_demo";

/**
 * Die zwei gemessenen Formen, in denen ein Verbindungsversuch auf Port 1 abgewiesen wird — siehe
 * Kopf (i). Beide bedeuten für P4 dasselbe: der Vertrag hat durchgelassen. Eine dritte Form gehört
 * hier hinein, aber erst mit gemessenem Beleg; bis dahin nennt die Diagnose von P4 sie im Klartext.
 */
const VERWEIGERUNGSFORMEN = ["ECONNREFUSED", "EPERM"] as const;

/** Regex-Sonderzeichen entschärfen — der Host trägt Punkte, die sonst auf alles passen. */
function maskiere(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/**
 * DIE SONDE AUF DER FEHLERAUSGABE. Anerkannt wird eine Verweigerungsform NUR unmittelbar vor
 * GENAU dieser Adresse. Beide Enden sind dicht: `\b` vor der Form (kein `XECONNREFUSED`), und die
 * negative Vorschau `(?!\d)` hinter dem Port — ohne sie machte `127.0.0.1:10` den Fall grün, weil
 * `127.0.0.1:1` darin steckt. Der Host wird maskiert, sonst passte der Punkt auf jedes Zeichen.
 */
function verweigerungsMuster(form: string): RegExp {
  return new RegExp(String.raw`\b${form}\s+${maskiere(ZIELHOST)}:${ZIELPORT}(?!\d)`);
}

/**
 * Die WIRKLICH gewählte Adresse einer Verbindungszeichenkette — geparst, nicht gesucht. Damit ist
 * der Anti-Drift-Riegel ein EXAKTER Vergleich (`toBe`) statt eines `toContain`, das `…:10` für
 * `…:1` durchgehen liesse. Zweite Stelle derselben Lehre aus Runde 1.
 */
function gewaehlteAdresse(verbindung: string): string {
  const zerlegt = new URL(verbindung);
  return `${zerlegt.hostname}:${zerlegt.port}`;
}

interface Lauf {
  readonly code: number | null;
  readonly fehlerausgabe: string;
  readonly ausgabe: string;
  /** Die erste nicht-leere Zeile auf stderr — „was steht ZUERST da". */
  readonly ersteFehlerzeile: string;
}

/** Der Regelfall: das Werkzeug wird AUSGEFÜHRT — `process.argv[1]` zeigt auf das Modul. */
const AUSFUEHREN: readonly string[] = ["--import", "tsx", "tools/bodytext-nachziehen.ts"];

/**
 * P5: das Werkzeug wird IMPORTIERT, nicht ausgeführt. `-e` legt den Einstiegspunkt in eine
 * Zeichenkette, also ist `process.argv[1]` undefiniert und der Riegel `:207-209` schliesst — genau
 * die Lage eines Testlaufs, der das Modul anfasst. Der Weg braucht keine neue Datei und hält die
 * Umgebungsregel des Kopfs ein, weil er durch DIESELBE Vorrichtung läuft. Dass hier wirklich
 * importiert und nicht ausgeführt wird, ist nicht behauptet, sondern gegengeprobt: verschiebt man
 * den Vertragsaufruf auf Modulebene oder entschärft man den Riegel, wird P5 rot (JOB 3842 (a)/(b)).
 */
const NUR_IMPORTIEREN: readonly string[] = [
  "--import",
  "tsx",
  "--input-type=module",
  "-e",
  `await import(${JSON.stringify(join(WURZEL, "tools", "bodytext-nachziehen.ts"))});`,
];

function starteWerkzeug(
  env: Record<string, string>,
  argumente: readonly string[] = AUSFUEHREN,
): Lauf {
  const ergebnis = spawnSync("node", [...argumente], {
    cwd: WURZEL,
    encoding: "utf8",
    timeout: 90_000,
    env: {
      // Das Minimum, ohne das Node nicht startet — kein `...process.env`.
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TMPDIR: process.env.TMPDIR ?? "/tmp",
      KLARWERK_SKIP_KEYCHAIN: "1",
      ...env,
    },
  });
  const fehlerausgabe = ergebnis.stderr ?? "";
  return {
    code: ergebnis.status,
    fehlerausgabe,
    ausgabe: ergebnis.stdout ?? "",
    ersteFehlerzeile: fehlerausgabe.split("\n").find((z) => z.trim() !== "") ?? "",
  };
}

describe("JOB 3797 P · das Werkzeug bricht mit einem Satz ab", () => {
  it("P1 · Produktion, BEIDE Pflichtwerte fehlen → eine Zeile mit BEIDEN Namen, keine Stapelspur", () => {
    const lauf = starteWerkzeug({ NODE_ENV: "production" });
    expect(lauf.code, `Ausgabe:\n${lauf.fehlerausgabe}`).not.toBe(0);
    expect(
      lauf.ersteFehlerzeile,
      "die erste Zeile ist nicht der Vertragssatz — der Betreiber liest etwas anderes zuerst",
    ).toContain("StartvertragError");
    expect(lauf.ersteFehlerzeile).toContain("APP_BASE_URL");
    expect(lauf.ersteFehlerzeile).toContain("DATABASE_URL");
    expect(lauf.ersteFehlerzeile).toContain("Pflichtwert(e)");
    // Keine Stapelspur aus dem Modullader — der Mangel, gegen den dieser Auftrag steht.
    expect(lauf.fehlerausgabe, `Ausgabe:\n${lauf.fehlerausgabe}`).not.toContain("at ModuleJob.run");
    // EINE Zeile heisst EINE Zeile: der Fänger schreibt genau eine, nicht zwölf.
    expect(
      lauf.fehlerausgabe.split("\n").filter((z) => z.trim() !== "").length,
      `mehr als eine Zeile auf stderr:\n${lauf.fehlerausgabe}`,
    ).toBe(1);
    // Vor diesem Auftrag brach hier die EIGENE Meldung ab und nannte `APP_BASE_URL` nie.
    expect(lauf.fehlerausgabe).not.toContain("Kein Verbindungs-String");
  }, 120_000);

  it("P2 · Produktion, nur APP_BASE_URL fehlt → genau dieser eine Name", () => {
    const lauf = starteWerkzeug({ NODE_ENV: "production", DATABASE_URL: UNERREICHBAR });
    expect(lauf.code).not.toBe(0);
    expect(lauf.ersteFehlerzeile).toContain("APP_BASE_URL");
    expect(lauf.ersteFehlerzeile).toContain("1 Pflichtwert(e)");
    expect(lauf.fehlerausgabe).not.toContain("at ModuleJob.run");
    // Kein Kennwort in der Ausgabe, obwohl eines in der Verbindungszeichenkette steht.
    expect(lauf.fehlerausgabe).not.toContain("kennwort");
  }, 120_000);

  it("P3 · ausserhalb der Produktion verlangt der Vertrag nichts — die eigene Meldung gilt weiter", () => {
    // Der Vertrag prüft nur in Produktion (`start-vertrag.ts:906`). Entwicklung und Testläufe
    // dürfen sich nicht ändern; das ist gemessen und nicht behauptet.
    const lauf = starteWerkzeug({ NODE_ENV: "test" });
    expect(lauf.fehlerausgabe).not.toContain("StartvertragError");
    expect(lauf.fehlerausgabe).not.toContain("Pflichtwert(e)");
    expect(lauf.ersteFehlerzeile).toContain("Kein Verbindungs-String");
    expect(lauf.code).toBe(2);
  }, 120_000);

  it("P4 · KALIBRIERUNG: mit vollständiger Umgebung lässt der Vertrag durch", () => {
    // Ohne diese Gegenrichtung wären P1/P2 auch dann grün, wenn das Werkzeug IMMER abbräche.
    // Hier scheitert es an etwas anderem — die Datenbank antwortet nicht — und genau das ist der
    // Beleg, dass der Vertrag es hat passieren lassen.
    const lauf = starteWerkzeug({
      NODE_ENV: "production",
      DATABASE_URL: UNERREICHBAR,
      KLARWERK_DB_URL: UNERREICHBAR,
      APP_BASE_URL: "https://demo.klarwerk.ai",
    });
    // DIE DIAGNOSE STEHT VOR DER ERSTEN ZUSICHERUNG, nicht hinter der letzten. Runde 1 baute sie
    // erst unmittelbar vor der Schlusszusicherung; jeder frühere Fehlschlag — Vertragsabbruch,
    // Adressabweichung — brach vorher ab und meldete eine nackte Zeile ohne Exitcode und ohne
    // Prozessausgabe (BEN, JOB 3842 R1, Korrekturpflicht 2). Jetzt trägt JEDE Zusicherung von P4
    // denselben gemessenen Befund; nur die Kopfzeile sagt, WELCHE Erwartung gebrochen ist.
    const zeilen = lauf.fehlerausgabe.split("\n").filter((z) => z.trim() !== "");
    const befund = (kopfzeile: string): string =>
      [
        kopfzeile,
        `  GESUCHT: eine der Verweigerungsformen [${VERWEIGERUNGSFORMEN.join(", ")}]`,
        `           unmittelbar vor GENAU der gewählten Adresse ${ZIELADRESSE}`,
        `           (Muster: ${verweigerungsMuster(VERWEIGERUNGSFORMEN[0]).source}).`,
        `  GEMESSEN: Exit ${String(lauf.code)}, ${zeilen.length} Zeile(n) auf stderr:`,
        ...(zeilen.length > 0 ? zeilen.map((z) => `    ${z}`) : ["    <stderr ist leer>"]),
        `    gewählte Verbindungsadresse: ${gewaehlteAdresse(UNERREICHBAR)}`,
        `    stdout: ${lauf.ausgabe === "" ? "<leer>" : JSON.stringify(lauf.ausgabe)}`,
        "  SO IST ES ZU LESEN:",
        "    · steht dort `StartvertragError` oder `Pflichtwert(e)`, hat der VERTRAG zugeschlagen —",
        "      dann ist die Kalibrierung berechtigt rot und der Fehler steckt im Produkt.",
        "    · steht dort eine ANDERE Verweigerungsform, verweigert diese Umgebung anders als die",
        "      zwei gemessenen. Sie gehört dann in VERWEIGERUNGSFORMEN — aber erst mit gemessenem",
        "      Beleg im Dateikopf, nicht auf Verdacht.",
        "    · steht dort eine andere Adresse oder ein anderer Port, scheiterte der Prozess an",
        "      etwas anderem als der Wahl. Ein Port, der mit dem gesuchten BEGINNT (…:10 zu …:1),",
        "      zählt ausdrücklich als andere Adresse.",
      ].join("\n");

    expect(
      lauf.fehlerausgabe,
      befund("P4 · der Vertrag hat zugeschlagen, statt durchzulassen (StartvertragError)."),
    ).not.toContain("StartvertragError");
    expect(
      lauf.fehlerausgabe,
      befund("P4 · der Vertrag hat zugeschlagen, statt durchzulassen (Pflichtwert(e))."),
    ).not.toContain("Pflichtwert(e)");
    expect(
      lauf.code,
      befund("P4 · der Prozess endete mit 0 — er ist gar nicht gescheitert."),
    ).not.toBe(0);
    // Der dritte Ausschluss: auch die EIGENE Meldung darf es nicht sein. Ohne ihn wäre P4 grün,
    // wenn der Lauf am fehlenden Verbindungswert scheiterte statt an der Datenbank — dann hätte er
    // über das Durchlassen des Vertrags nichts gesagt.
    expect(
      lauf.fehlerausgabe,
      befund("P4 · der Lauf scheiterte am fehlenden Verbindungswert, nicht an der Datenbank."),
    ).not.toContain("Kein Verbindungs-String");

    // Anti-Drift: gesucht wird die Adresse, die auch gewählt wurde. Ohne diesen Riegel könnte die
    // Verbindungszeichenkette wandern, während P4 weiter eine Adresse sucht, die im Lauf gar nicht
    // mehr vorkommt — der Fall wäre dann nie wieder grün zu bekommen und niemand wüsste, warum.
    // EXAKTER Vergleich über die geparste Adresse: `toContain` liess `…:10` für `…:1` durch.
    expect(
      gewaehlteAdresse(UNERREICHBAR),
      befund("P4 · ZIELADRESSE und Verbindungszeichenkette sind auseinandergelaufen."),
    ).toBe(ZIELADRESSE);

    // Der Kern: der Abbruch kommt vom VERBINDUNGSVERSUCH. Anerkannt wird jede der gemessenen
    // Verweigerungsformen (Kopf (i)), aber nur unmittelbar vor der gewählten Adresse — ein fremder
    // `EPERM` aus einer anderen Richtung (gesperrte Datei, anderer Host, anderer Port) macht P4
    // nicht grün. Die Trennschärfe gegen ähnlich beginnende Ports ist in P6 dauerhaft kalibriert.
    const anerkannt = VERWEIGERUNGSFORMEN.filter((form) =>
      verweigerungsMuster(form).test(lauf.fehlerausgabe),
    );
    // Auf die ANZAHL und nicht auf die Liste zugesichert: `not.toEqual([])` hängt an die Diagnose
    // ein „Compared values have no visual difference" und macht die Meldung unlesbar.
    expect(
      anerkannt.length,
      befund("P4 · der Abbruch kommt nicht vom Verbindungsversuch."),
    ).toBeGreaterThan(0);
  }, 120_000);

  it("P5 · der blosse IMPORT in Produktion ohne Pflichtwerte bleibt vollständig still", () => {
    // Die WICHTIGSTE Nicht-Wirkung des Vertrags an diesem Einstiegspunkt — siehe Kopf (ii). Kein
    // Pflichtwert ist gesetzt und `NODE_ENV=production`: würde der Vertrag beim Import greifen,
    // stürbe hier jeder Testlauf, der `tools/bodytext-nachziehen.ts` anfasst.
    const lauf = starteWerkzeug({ NODE_ENV: "production" }, NUR_IMPORTIEREN);
    const gesamt = `${lauf.fehlerausgabe}${lauf.ausgabe}`;
    const gemessen = [
      `  GEMESSEN: Exit ${String(lauf.code)}`,
      `    stdout: ${lauf.ausgabe === "" ? "<leer>" : JSON.stringify(lauf.ausgabe)}`,
      `    stderr: ${lauf.fehlerausgabe === "" ? "<leer>" : JSON.stringify(lauf.fehlerausgabe)}`,
    ].join("\n");
    expect(
      lauf.fehlerausgabe,
      `P5 · der blosse Import hat auf stderr geschrieben — er ist nicht mehr still.\n${gemessen}`,
    ).toBe("");
    expect(
      lauf.ausgabe,
      `P5 · der blosse Import hat auf stdout geschrieben — er ist nicht mehr still.\n${gemessen}`,
    ).toBe("");
    expect(
      lauf.code,
      `P5 · der blosse Import endet nicht mit 0 — ein Testlauf, der dieses Modul anfasst, stürbe.\n${gemessen}`,
    ).toBe(0);
    // Namentlich, damit die Meldung sagt, WER geredet hat, wenn die Stille bricht.
    expect(
      gesamt,
      `P5 · der Vertrag hat beim blossen Import zugeschlagen.\n${gemessen}`,
    ).not.toContain("StartvertragError");
    expect(
      gesamt,
      `P5 · der Vertrag hat beim blossen Import zugeschlagen.\n${gemessen}`,
    ).not.toContain("Pflichtwert(e)");
    expect(
      gesamt,
      `P5 · die eigene Meldung des Werkzeugs lief beim blossen Import — \`main()\` wurde ausgeführt.\n${gemessen}`,
    ).not.toContain("Kein Verbindungs-String");
  }, 120_000);

  it("P6 · KALIBRIERUNG der Sonden: ähnlich beginnende Ports und fremde Formen werden abgewiesen", () => {
    // WARUM ES DIESEN FALL GIBT. P4 kann seine eigene Trennschärfe nicht messen: er sieht in einem
    // Lauf genau EINE Fehlerausgabe, und die ist die richtige. Genau so blieb die Lücke aus Runde 1
    // unsichtbar — `includes("ECONNREFUSED 127.0.0.1:1")` war auch für `127.0.0.1:10` wahr, und der
    // Prüfer verstellte den Port auf 10, ohne dass ein Fall rot wurde (`Tests 5 passed (5)`).
    // Deshalb bekommen die beiden Sonden hier einen Satz Zeichenketten MIT BEKANNTER ANTWORT. Die
    // Proben sind echte, gemessene Ausgaben des Werkzeugs bzw. ihre minimal veränderten Nachbarn —
    // kein Prozess, keine Datenbank, kein Netz: dieser Fall kostet Millisekunden.
    const proben: readonly { text: string; anerkannt: boolean; warum: string }[] = [
      {
        text: "[bodytext-nachziehen] Abbruch: Error: connect ECONNREFUSED 127.0.0.1:1",
        anerkannt: true,
        warum: "die gemessene Ausgabe dieser Sandkiste — der Regelfall",
      },
      {
        text: "[bodytext-nachziehen] Abbruch: Error: connect EPERM 127.0.0.1:1 - Local (0.0.0.0:0)",
        anerkannt: true,
        warum: "die zweite gemessene Form, mit Zusatztext dahinter (BENs Sandkiste)",
      },
      {
        text: "[bodytext-nachziehen] Abbruch: Error: connect ECONNREFUSED 127.0.0.1:10",
        anerkannt: false,
        warum:
          "DER BEFUND AUS RUNDE 1: Port 10 beginnt mit Port 1 und ist trotzdem eine andere Adresse",
      },
      {
        text: "[bodytext-nachziehen] Abbruch: Error: connect ECONNREFUSED 127.0.0.1:11",
        anerkannt: false,
        warum: "derselbe Präfixfall mit zwei gleichen Ziffern",
      },
      {
        text: "[bodytext-nachziehen] Abbruch: Error: connect EPERM 192.0.2.1:1 - Local (0.0.0.0:0)",
        anerkannt: false,
        warum: "richtige Form, FREMDER Host — der fremde EPERM, gegen den die Bindung steht",
      },
      {
        text: "[bodytext-nachziehen] Abbruch: Error: connect ECONNREFUSED 10.127.0.0.1:1",
        anerkannt: false,
        warum: "der Zielhost steckt als Teilzeichenkette im fremden Host",
      },
      {
        text: "[bodytext-nachziehen] Abbruch: Error: connect EACCES 127.0.0.1:1",
        anerkannt: false,
        warum: "richtige Adresse, NICHT gemessene Form — die Liste wächst nur mit Beleg",
      },
      {
        text: "[bodytext-nachziehen] Abbruch: Error: XECONNREFUSED 127.0.0.1:1",
        anerkannt: false,
        warum: "die Form darf nicht als Wortende einer längeren Kennung durchgehen",
      },
      {
        text: "[bodytext-nachziehen] Abbruch: StartvertragError: … 2 Pflichtwert(e) … ECONNREFUSED",
        anerkannt: false,
        warum: "die blosse Form ohne Adresse ist keine Verweigerung an DIESER Adresse",
      },
    ];
    const gemessen = proben.map((p) => ({
      text: p.text,
      anerkannt: VERWEIGERUNGSFORMEN.some((form) => verweigerungsMuster(form).test(p.text)),
    }));
    expect(
      gemessen,
      [
        "P6 · die Sonde auf der Fehlerausgabe trennt nicht wie kalibriert.",
        `  Muster je Form: ${VERWEIGERUNGSFORMEN.map((f) => verweigerungsMuster(f).source).join(" | ")}`,
        "  Erwartet:",
        ...proben.map((p) => `    ${p.anerkannt ? "ANERKANNT " : "abgewiesen"} · ${p.warum}`),
      ].join("\n"),
    ).toEqual(proben.map((p) => ({ text: p.text, anerkannt: p.anerkannt })));

    // Und die zweite Sonde: die gewählte Adresse wird GEPARST, nicht gesucht. `toContain` hier
    // wäre derselbe Fehler noch einmal — `…@127.0.0.1:10/…` enthält `127.0.0.1:1`.
    expect(gewaehlteAdresse("postgresql://k:p@127.0.0.1:1/d")).toBe("127.0.0.1:1");
    expect(
      gewaehlteAdresse("postgresql://kennung:kennwort@127.0.0.1:10/klarwerk_demo"),
      "eine Verbindung auf Port 10 gilt als Adresse 127.0.0.1:1 — der Anti-Drift-Riegel ist blind.",
    ).not.toBe(ZIELADRESSE);
    // ABSICHTLICH NICHT HIER: `gewaehlteAdresse(UNERREICHBAR) === ZIELADRESSE`. Das ist der
    // Anti-Drift-Riegel, und der steht in P4. Stünde er auch hier, röteten zwei Fälle aus EINEM
    // Grund — ein zweiter Prüfweg zur selben Sache. P6 kalibriert die Sonden, P4 wendet sie an.
  });
});
