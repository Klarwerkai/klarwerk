// ================================================================================================
// JOB 3014 · LIEFERUNG 5 — WER BRICHT MIT, WENN JEMAND SCHNEIDET.
// ================================================================================================
//
// Die bestehenden Tests lesen `taskpane.html` nicht als Datei ab, sondern greifen HINEIN: sie
// schneiden Code entlang der `KW-…`-Marken heraus und führen ihn aus, sie suchen Textstellen im
// Quelltext, sie bauen den Rumpf ins jsdom-DOM. Jede dieser Griffe hängt an der EINEN Datei. Wer
// P11 baut, bricht sie — und bis heute wusste niemand, wie viele es sind und woran genau sie hängen.
//
// Dieser Fall leitet die Menge AUS DEM BAUM ab und hält sie gegen ein gepinntes Verzeichnis:
// Datei → welcher Griff (Pfadliteral / Marken / Panel-Fixture / Zerlegungswerkzeug). Wer die
// Zerlegung ändert, bekommt hier die Mitfahrerliste; wer eine neue Testdatei mit einem solchen
// Griff anlegt, bekommt hier die Nachführpflicht — dieselbe Bauform wie das
// Klara-Regressionsinventar (`tests/app/klara-regressionsinventar.test.ts`, K2).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_WURZEL } from "../support/repoPfad";
import { TASKPANE_RELATIV, tabelle } from "./zerlegung";

/** Die Flächen, in denen Tests und ihre Helfer wohnen. */
const FLAECHEN = ["tests", "services", "apps"];

/** Diese Datei selbst: sie nennt alle Suchbegriffe als Daten und würde sich sonst einsammeln. */
const SELBST = join("tests", "klara-zerlegung", "schnitt-pins.test.ts");

type Griff = "pfad" | "zusammengesetzt" | "marken" | "fixture" | "werkzeug";

/**
 * Die vier Griffe, mit denen eine Datei an `taskpane.html` hängt.
 *
 * `positiv`/`gegenprobe` sind die Kalibrierung: ohne die Positivdatei kann der Griff nicht greifen,
 * und ohne die Gegenprobe wäre „greift" auch dann wahr, wenn er ALLES fände.
 */
const GRIFFE: Array<{
  kennung: Griff;
  muster: RegExp;
  zweck: string;
  positiv: string;
  gegenprobe: string;
}> = [
  {
    kennung: "pfad",
    muster: /word-addin\/taskpane\.html/,
    zweck:
      "Die Datei wird über ihr Pfadliteral genannt — der direkteste Griff. Bewusst textbreit: " +
      "ein Treffer, der die Datei nur im Kommentar nennt, ist ein billiger Fehlalarm; eine " +
      "übersehene Datei ist teuer.",
    positiv: join("tests", "app", "w1-klara-lifecycle-taskpane.test.tsx"),
    gegenprobe: join("tests", "app", "contrast-tokens-d5.test.ts"),
  },
  {
    // BEN, Korrekturpflicht 3: Runde 1 hat NUR nach dem Literal gesucht und damit jede Datei
    // übersehen, die den Pfad aus Segmenten zusammensetzt — `join(WURZEL, "apps", "web", "public",
    // "word-addin", "taskpane.html")`. Genau so lesen `k1-word-addin-origin-panel.test.ts` und
    // `legal/mega61-ki-satz.test.ts` die Datei; beide fehlten im Verzeichnis. Der Griff sucht
    // deshalb nach den zwei benachbarten Segmenten, nicht nach dem ganzen Ausdruck: `join`,
    // `resolve` und `new URL` schreiben die Klammern verschieden, die Segmentfolge bleibt gleich.
    kennung: "zusammengesetzt",
    muster: /"word-addin"\s*,\s*"taskpane\.html"/,
    zweck: 'Der Pfad wird aus Segmenten gebaut (…, "word-addin", "taskpane.html").',
    positiv: join("tests", "legal", "mega61-ki-satz.test.ts"),
    gegenprobe: join("tests", "app", "w1-klara-lifecycle-taskpane.test.tsx"),
  },
  {
    kennung: "marken",
    muster: /KW-[A-Z0-9-]+-(?:START|END)/,
    zweck: "Code wird entlang der KW-Marken herausgeschnitten und ausgeführt.",
    positiv: join("tests", "app", "word-addin-taskpane-version-contract.test.ts"),
    gegenprobe: join("tests", "app", "w1-klara-lifecycle-taskpane.test.tsx"),
  },
  {
    kennung: "fixture",
    // Bewusst die IMPORT-Form: die blosse Erwähnung des Fixturenamens in einem Kommentar ist kein
    // Griff an die Datei, und ein Verzeichnis, das sie mitzählt, listet Mitfahrer, die keine sind.
    muster: /from "[^"]*klara-panel-fixture"/,
    zweck: "Der Zugriff läuft über `createKlaraPanel` — mittelbar, aber genauso abhängig.",
    positiv: join("tests", "design", "zielbild-wissen-erfassen-einmal.test.ts"),
    gegenprobe: join("tests", "app", "w1-klara-lifecycle-taskpane.test.tsx"),
  },
  {
    kennung: "werkzeug",
    muster: /from "\.\/zerlegung"/,
    zweck: "Die Messgeräte dieses Auftrags selbst.",
    positiv: join("tests", "klara-zerlegung", "probeschnitt.test.ts"),
    gegenprobe: join("tests", "app", "w1-klara-lifecycle-taskpane.test.tsx"),
  },
];

// ------------------------------------------------------------------------------------------------
// DAS GEPINNTE VERZEICHNIS — die Mitfahrer, gemessen am 03.09.2026 auf Basisstand 1d6a899.
// Wächst oder schrumpft die Menge, meldet A2 die Differenz im Klartext. Das ist die
// Nachführpflicht, kein Defekt: wer einen neuen Griff an `taskpane.html` anlegt, gehört hierher.
// ------------------------------------------------------------------------------------------------
const MITFAHRER: Readonly<Record<string, string>> = {
  "tests/app/csp-upgrade-insecure-requests.test.ts": "pfad",
  "tests/app/g24-ki-kennzeichnung-laufzeitpruefung.test.ts": "pfad,marken",
  "tests/app/job2551-bildverlust-satz-mounted.test.ts": "pfad",
  "tests/app/job2613-word-bilder-budget.test.ts": "pfad",
  "tests/app/job2621-panel-wahrheiten.test.ts": "pfad,fixture",
  "tests/app/job2703-ask-trefferliste-und-panel.test.tsx": "fixture",
  "tests/app/job2703-d3-addin-paritaet.test.ts": "pfad,fixture",
  "tests/app/job2923-station1-beweislauf.test.tsx": "fixture",
  // BEN, Korrekturpflicht 3: In Runde 1 fehlte diese Datei. Sie liest `taskpane.html` direkt, baut
  // den Pfad aber aus Segmenten — der Griff `pfad` sah sie deshalb nicht.
  "tests/app/k1-word-addin-origin-panel.test.ts": "zusammengesetzt",
  "tests/app/ka2-vertrag-bestandsblick.test.ts": "pfad",
  "tests/app/ka3-fokusverhalten.test.tsx": "pfad,marken",
  "tests/app/klara-ai-header.test.ts": "pfad,marken",
  "tests/app/klara-ai-session-consent.test.ts": "pfad,marken",
  // Der wichtigste Mitfahrer überhaupt: die Fixture selbst schneidet Rumpf und Skript aus der
  // Datei (`splitTaskpane`). Bricht sie, brechen alle acht Dateien mit dem Griff `fixture` mit.
  "tests/app/klara-panel-fixture.ts": "pfad",
  "tests/app/klara-session-consent-ui.test.ts": "pfad,marken",
  "tests/app/mega34-word-einstufung.test.ts": "pfad",
  "tests/app/mega35-word-ausgabe-entsteht-beim-ausgeben.test.tsx": "pfad",
  "tests/app/mega36-word-ausgaenge.test.tsx": "pfad",
  "tests/app/mega38-word-ziehweg.test.tsx": "pfad",
  "tests/app/mega43-klara-werkbank-palette.test.ts": "pfad",
  "tests/app/mega45-word-textrueckfall.test.ts": "pfad",
  "tests/app/mega52-vertrauenswert-sammler.test.ts": "pfad,zusammengesetzt",
  "tests/app/mega69-klara-auslieferung.test.ts": "pfad,zusammengesetzt",
  "tests/app/mega69-klara-merkmale.test.ts": "pfad,zusammengesetzt",
  // Der Inhalts-Pin des Aufgabenfensters — er wird bei JEDER Änderung an der Datei rot und muss
  // vom Ändernden nachgeführt werden. Ein Schnitt trifft ihn als Ersten.
  "tests/app/mega69-klara-waechter.test.ts": "pfad,zusammengesetzt,marken",
  // Legt ein Temp-`dist` mit `word-addin/taskpane.html` an. Nach einem Schnitt müsste es die
  // Geschwisterdateien mitschreiben, sonst prüft es eine Seite, die es so nicht mehr gibt.
  "tests/app/mega71-onsend-synchron.test.ts": "zusammengesetzt",
  "tests/app/mega74-klara-bilder.test.ts": "pfad,marken",
  "tests/app/mega75-klara-ki-status.test.ts": "pfad,marken",
  "tests/app/mega77-klara-wortlaut-und-frist.test.ts": "pfad,marken",
  "tests/app/mega79-klara-antwort-ohne-modell.test.ts": "pfad,marken",
  "tests/app/mega81-ki-kennzeichnung-am-verhalten.test.ts": "pfad,marken",
  "tests/app/pro375-terminologie-vertrag.test.ts": "pfad",
  "tests/app/w1-klara-lifecycle-taskpane.test.tsx": "pfad",
  "tests/app/w1-klara-vertrauenskopf.test.ts": "pfad,marken",
  "tests/app/w6-dublettenweg-checktext.test.ts": "pfad,marken",
  "tests/app/word-addin-ask.test.ts": "pfad,marken",
  "tests/app/word-addin-csp.test.ts": "pfad",
  "tests/app/word-addin-taskpane-cache.test.ts": "pfad",
  "tests/app/word-addin-taskpane-version-contract.test.ts": "zusammengesetzt,marken",
  "tests/app/word-addin.test.ts": "pfad,marken,fixture",
  // JOB 3004 (Nachzug): der Chromium-Vergleich der Antwortkarte gegen das Zielbild „Main“ liest
  // die AUSGELIEFERTE Datei aus `apps/web/dist/word-addin/taskpane.html` (Pfadliteral) und laedt
  // sie in Chromium — nach einem Schnitt muesste dist die Geschwisterdateien mitfuehren, sonst
  // misst er eine Seite, die es so nicht mehr gibt. Griff `pfad`.
  // JOB 3010 (Nachzug, 03.09.2026): die Messung der Lückenfläche „KeinWissen" am LAUFENDEN Panel.
  // Sie fährt das ausgelieferte Inline-Skript über `createKlaraPanel` (Import der Fixture) an die
  // echte App und bringt es über `/api/ask` in den Lückenzustand — Griff `fixture`, kein
  // Pfadliteral, keine Marken. Nach einem Schnitt hängt sie an der Fixture: bricht `splitTaskpane`,
  // bricht ihre Basismessung mit. A2 hat die Datei gemeldet (`+ "tests/design/zielbild-keinwissen-
  // messung.test.ts"`), das Verzeichnis hat sie nicht still aufgenommen.
  // JOB 3030 R5 (04.09.2026): DIESE ZEILE STAND KURZZEITIG ZWEIMAL. JOB 3030 D4 wurde auf `5409a62`
  // gebaut und auf `9e1e573` eingebaut; dazwischen hatte JOB 3010 denselben Eintrag hier ergänzt.
  // Beide Fassungen überlebten den Einbau, und `An object literal cannot have multiple properties
  // with the same name` (TS1117) hielt `tools/build` rot. Es bleibt genau EIN Eintrag, dieser.
  "tests/design/zielbild-keinwissen-messung.test.ts": "fixture",
  // JOB 3046 D2: der Chromium-Vergleich der Lueckenflaeche laedt die Datei ueber ihr Pfadliteral in
  // einen echten Browser (Playwright-Route, dieselbe Strecke wie JOB 3016) — Griff `pfad`; die
  // Fixture importiert er nicht. A2 hat die Datei gemeldet.
  "tests/design/zielbild-keinwissen.test.ts": "pfad",
  // JOB 3056 K1 (04.09.2026): die Messgeraete der vier Chromium-Vergleiche gegen Pedis Mockups
  // (Ruhe, Antwort, Einstellungen, kein Erklaertext) und des Funktionsinventars. Die Werkbank
  // `k1-messung.ts` laedt die AUSGELIEFERTE Datei aus `apps/web/dist/word-addin/taskpane.html`
  // (Pfadliteral) in Chromium; die fuenf Tests selbst importieren nur die Werkbank und greifen
  // die Datei nicht direkt. ERSETZT (geloescht, nicht daneben belassen): zielbild-klara-main,
  // zielbild-schlankes-panel, zielbild-schlankespanel-messung, zielbild-pruefunglaeuft und
  // zielbild-pruefunglaeuft-messung — ihre Zielbilder vom 27.08. hat Pedi am 04.09. durch die
  // Mockups ersetzt, und die Ladekarte, die sie massen, gibt es nicht mehr (§9: Laden zeigt der
  // Sendeknopf). A2 hat die Werkbank gemeldet, das Verzeichnis hat sie nicht still aufgenommen.
  // Zwei der fuenf Tests nennen die ausgelieferte Datei zusaetzlich selbst im Kopfkommentar
  // (Inventarachse `taskpane` des Regressionsinventars) — Griff `pfad`, von A2 gemeldet.
  "tests/design/k1-funktionsinventar.test.ts": "pfad",
  "tests/design/k1-messung.ts": "pfad",
  // JOB 3056 Runde 4 (Codex Pflichten 1-3): die Vorrichtung `k1-panel-lauf.tsx` liest die Datei
  // ueber ihr Pfadliteral und faehrt das VOLLSTAENDIGE Aufgabenfenster in jsdom (Bauform mega36);
  // die drei Laufzeittests (Sitzungslagen, Abmelden verwirft, Fussnoten-Zuordnung) importieren
  // die Vorrichtung und nennen die Datei im Kopfkommentar — Griff `pfad`. A2 hat alle vier
  // gemeldet, das Verzeichnis hat sie nicht still aufgenommen.
  "tests/app/k1-panel-lauf.tsx": "pfad",
  "tests/app/k1-sitzungslagen.test.tsx": "pfad",
  "tests/app/k1-abmelden-verwirft-sitzung.test.tsx": "pfad",
  "tests/app/k1-fussnoten-zuordnung.test.tsx": "pfad",
  // JOB 3056 Runde 6: das Quellen-Rennen zweier Fragen, dieselbe Vorrichtung — Griff `pfad`.
  "tests/app/k1-quellen-rennen.test.tsx": "pfad",
  // JOB 3056 Runde 8: die abgelaufene Aufloesung, dieselbe Vorrichtung — Griff `pfad`.
  "tests/app/k1-abgelaufene-aufloesung.test.tsx": "pfad",
  // JOB 3056 Nachzug-Runde 1: der abgesendete Ask-Koerper (KA5-Faelle A/C/D), dieselbe Vorrichtung;
  // liest zusaetzlich den Deckel WORD_ADDIN_ASK_MAX_CHARS aus der Datei — Griff `pfad`.
  "tests/app/k1-ask-koerper-markierung.test.tsx": "pfad",
  // JOB 3056 Runde 3: zwei der alten Namen leben als ABLOESUNGS-WAECHTER weiter — sie lesen die
  // Datei ueber Segmente (Griff `zusammengesetzt`) und pinnen, dass Fusszeile, „Neue Frage",
  // Leitsatz und Ladekarte nicht zurueckkommen; zugleich halten sie die Verweise des Werkzeugs
  // tools/design-vergleich/werte.ts (nicht Zielpfad) aufloesbar. A2 hat beide gemeldet.
  "tests/design/zielbild-klara-main.test.ts": "zusammengesetzt",
  "tests/design/zielbild-pruefunglaeuft.test.ts": "zusammengesetzt",
  "tests/design/zielbild-k1-kein-erklaertext.test.ts": "pfad",
  "tests/design/zielbild-wissen-erfassen-einmal.test.ts": "pfad,fixture",
  "tests/design/zielbild-wissen-erfassen.test.ts": "pfad",
  "tests/i18n/mega35-word-wortliste.test.ts": "pfad",
  // JOB 3033 D2 (03.09.2026): der Vertrag der KA4-Freischaltung. Sein Fall S4 liest
  // `taskpane.html` als Pfadliteral und haelt fest, dass dessen Satz „immer ohne KI-Modell" und
  // ein freigeschalteter externer Antwortweg nicht gleichzeitig bestehen koennen. Ein Schnitt
  // trifft ihn: wandert der Satz in eine Geschwisterdatei, liest S4 ins Leere. Griff `pfad`.
  "tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts": "pfad",
  // JOB 3019 D1 (KA5) hatte hier `ka5-markierung-reist-mit.test.tsx` (unter tests/klara-panel) als
  // Mitfahrer (Pfadliteral, `splitTaskpane`). JOB 3056 K1 (Rebase, 05.09.2026): DIE DATEI IST
  // GELOESCHT — sie mass die Vier-Lagen-Herkunftszeile, die mit dem Ruhe-Umbau selbst entfallen ist
  // (s. Kommentar in tests/app/klara-regressionsinventar.test.ts). Kein Mitfahrer mehr.
  "tests/klara-panel/p7-office-erkennung-am-fenster.test.tsx": "pfad,fixture",
  // Die Messgeräte dieses Auftrags. Sie hängen genauso an der Datei wie alle anderen — nur messen
  // sie ausdrücklich ihre Struktur und nicht ihr Fachverhalten.
  "tests/klara-zerlegung/marken-skelett.test.ts": "zusammengesetzt,marken,werkzeug",
  "tests/klara-zerlegung/panel-lauf.ts": "pfad",
  "tests/klara-zerlegung/probeschnitt.test.ts": "werkzeug",
  "tests/klara-zerlegung/schnittflaechen.test.ts": "pfad,werkzeug",
  "tests/klara-zerlegung/zerlegung.ts": "pfad",
  // BEN, Korrekturpflicht 3: In Runde 1 fehlte auch diese Datei. Sie liest `taskpane.html` an drei
  // Stellen über `ADDIN` — ebenfalls ein zusammengesetzter Pfad.
  "tests/legal/mega61-ki-satz.test.ts": "zusammengesetzt",
  // Kein Griff im engeren Sinn: die Testwurzel-Hilfe nennt den Pfad nur in ihrem Beispiel. Sie
  // steht hier, weil der Griff `pfad` bewusst textbreit ist — s. seine Beschreibung.
  "tests/support/repoPfad.ts": "pfad",
};

// ------------------------------------------------------------------------------------------------
// Erhebung
// ------------------------------------------------------------------------------------------------

function quelldateienUnter(dir: string): string[] {
  const raus: string[] = [];
  if (!existsSync(dir)) {
    return raus;
  }
  for (const eintrag of readdirSync(dir)) {
    if (eintrag === "node_modules" || eintrag === "dist") {
      continue;
    }
    const pfad = join(dir, eintrag);
    if (statSync(pfad).isDirectory()) {
      raus.push(...quelldateienUnter(pfad));
    } else if (/\.tsx?$/.test(eintrag)) {
      raus.push(pfad);
    }
  }
  return raus;
}

/**
 * Nur Tests und ihre Helfer — Produktdateien bleiben draußen. `services/**` und `apps/**` tragen
 * beides, deshalb die Endung als Grenze; unter `tests/**` zählt auch ein reiner Helfer
 * (`klara-panel-fixture.ts` ist der wichtigste Mitfahrer überhaupt und trägt kein `.test.`).
 */
function istTestdatei(kurz: string): boolean {
  return kurz.startsWith(`tests${sep}`) || /\.test\.tsx?$/.test(kurz);
}

const ALLE: readonly string[] = FLAECHEN.flatMap((f) => quelldateienUnter(join(REPO_WURZEL, f)))
  .map((p) => relative(REPO_WURZEL, p))
  .filter((p) => istTestdatei(p) && p !== SELBST)
  .sort();

function griffeVon(kurz: string): Griff[] {
  const inhalt = readFileSync(join(REPO_WURZEL, kurz), "utf8");
  return GRIFFE.filter((g) => g.muster.test(inhalt)).map((g) => g.kennung);
}

const GEFUNDEN = new Map<string, Griff[]>();
for (const kurz of ALLE) {
  const griffe = griffeVon(kurz);
  if (griffe.length > 0) {
    GEFUNDEN.set(kurz, griffe);
  }
}

// ------------------------------------------------------------------------------------------------

describe("JOB 3014 · A — die Mitfahrer der Zerlegung, abgeleitet statt behauptet", () => {
  it("A1 · der Sammler erreicht den Baum und greift nicht ins Leere", () => {
    expect(ALLE.length, "keine Testdateien gefunden").toBeGreaterThan(500);
    expect(GEFUNDEN.size).toBeGreaterThan(20);
    // Die Datei, um die es geht, existiert — sonst misst der Rest ein Phantom.
    expect(existsSync(join(REPO_WURZEL, TASKPANE_RELATIV))).toBe(true);
  });

  it("A2 · die abgeleitete Menge ist exakt das gepinnte Verzeichnis", () => {
    const abgeleitet: Record<string, string> = {};
    for (const [kurz, griffe] of [...GEFUNDEN.entries()].sort()) {
      abgeleitet[kurz] = griffe.join(",");
    }
    const neu = Object.keys(abgeleitet).filter((k) => MITFAHRER[k] === undefined);
    const weg = Object.keys(MITFAHRER).filter((k) => abgeleitet[k] === undefined);
    const anders = Object.keys(abgeleitet).filter(
      (k) => MITFAHRER[k] !== undefined && MITFAHRER[k] !== abgeleitet[k],
    );
    expect(neu, "neu im Baum, aber nicht gepinnt — Verzeichnis nachfuehren").toEqual([]);
    expect(weg, "gepinnt, aber im Baum nicht mehr gefunden").toEqual([]);
    expect(anders, "der Griff hat sich geaendert — Verzeichnis nachfuehren").toEqual([]);
  });

  it("A3 · jeder Griff ist kalibriert: Positivdatei greift, Gegenprobe greift NICHT", () => {
    const befunde: string[] = [];
    for (const g of GRIFFE) {
      for (const datei of [g.positiv, g.gegenprobe]) {
        if (!existsSync(join(REPO_WURZEL, datei))) {
          befunde.push(`${g.kennung}: ${datei} existiert nicht`);
        }
      }
      if (!griffeVon(g.positiv).includes(g.kennung)) {
        befunde.push(`${g.kennung}: findet seine eigene Positivdatei ${g.positiv} NICHT`);
      }
      if (griffeVon(g.gegenprobe).includes(g.kennung)) {
        befunde.push(`${g.kennung}: greift auf seine Gegenprobe ${g.gegenprobe} — er ist zu weit`);
      }
    }
    expect(befunde, "Griff ohne tragende Kalibrierung").toEqual([]);
  });

  it("A4 · das Verzeichnis, gedruckt — Datei, Griff, Zweck", () => {
    const zeilenDaten = [...GEFUNDEN.entries()]
      .sort()
      .map(([kurz, griffe]) => [kurz, griffe.join(",")]);
    console.log(
      [
        "",
        `JOB 3014 · Mitfahrer einer Zerlegung von ${TASKPANE_RELATIV} (${GEFUNDEN.size} Dateien):`,
        tabelle(["Testdatei", "Griff"], zeilenDaten),
        "",
        ...GRIFFE.map((g) => `  ${g.kennung.padEnd(16)} — ${g.zweck}`),
        "",
      ].join("\n"),
    );
    expect(zeilenDaten.length).toBe(GEFUNDEN.size);
  });
});
