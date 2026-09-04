// ================================================================================================
// JOB 3050 — DER WÄCHTER ÜBER DEN DUBLETTENPORT: KEINE NENNUNG OHNE PORT.
// ================================================================================================
//
// WARUM ES IHN GIBT, und das ist der Kern dieses Auftrags.
//
// `importJson` bekam die Dublettenregel in JOB 3023 als PFLICHT-Parameter, weil der Compiler dort
// die erste Linie sein KONNTE: die Methode hatte genau EINEN Aufrufer. `createImportCandidates` hat
// DREI Produktions-Aufrufer:
//
//     services/app/src/routes/library-routes.ts            POST /api/library/import/candidates
//     services/app/src/confluence-import.ts                Space-Sammellauf (Anker/Re-Sync)
//     services/app/src/routes/confluence-import-routes.ts  Apply der Auswahl (Anker/Re-Sync)
//
// Ein Pflicht-Parameter hätte die zwei Anker-Aufrufer mitgeändert — Dateien, die der Auftrag
// ausdrücklich nicht freigibt (Runde 1 wurde genau dafür rot). Der Parameter ist deshalb ADDITIV,
// und ein Teil der Zusicherung, die der Compiler damit nicht mehr gibt, gibt dieser Wächter.
//
// ------------------------------------------------------------------------------------------------
// § REICHWEITE — WAS ER LEISTET UND WAS AUSDRÜCKLICH NICHT (bens ROT-2 aus Runde 2)
// ------------------------------------------------------------------------------------------------
//
// Runde 2 zählte nur direkte `CallExpression`-Knoten und die Rückgabe behauptete daneben, JEDER
// portlose Aufruf werde erfasst. Ben hat die Lücke gemessen: eine typgültige gebundene Referenz
//
//     const f = library.createImportCandidates.bind(library);
//     await f(items, "system");
//
// blieb in TypeScript UND im Wächter grün. Die Behauptung war also falsch, und ein Wächter, dessen
// Reichweite größer behauptet wird als sie ist, ist schlimmer als keiner.
//
// GEZÄHLT WIRD DESHALB JETZT JEDE NENNUNG DES NAMENS, nicht nur der Aufruf:
//
//     ERFASST     ein Aufruf mit weniger als drei Argumenten                 -> rot
//     ERFASST     `.bind(...)`, ein Alias, eine als Callback übergebene
//                 Methodenreferenz, ein Elementzugriff `x["createImport…"]`   -> rot
//     ERFASST     ein Aufruf MIT Port                                        -> grün
//     NICHT ERFASST  ein BERECHNETER Schlüssel (`library[schluessel]` mit
//                 einer Variablen), Reflection (`Reflect.get`), reines
//                 JavaScript oder Code außerhalb der vier Suchbäume
//
// Die letzte Zeile ist die ehrliche Grenze, und sie wird unten GEMESSEN (W6), nicht behauptet.
// Für genau diesen Restfall trägt die ZWEITE Linie: fehlt der Port, gilt jeder Eintrag, dessen
// Textfrage gestellt wird, fail-closed als `pruefung_nicht_moeglich` (`erzwingeDublettenpruefung`,
// service.ts). Ein portloser Aufrufer — auch ein dynamischer — erzeugt also NIE eine unbemerkte
// Dublette; er erzeugt gar nichts. Gemessen in `kandidatenweg.test.ts` (K9). Dieser Wächter
// verhindert, dass jemand sich in diese Notbremse HINEINBAUT, ohne es zu merken; die Notbremse
// verhindert den Schaden, wenn er es doch tut.
//
// ------------------------------------------------------------------------------------------------
// WARUM ÜBER DEN SYNTAXBAUM UND NICHT ÜBER ZEICHENKETTEN
// ------------------------------------------------------------------------------------------------
// Der Name `createImportCandidates` steht in diesem Bestand über zwanzig Mal in KOMMENTAREN
// (`service.ts`, `types.ts:44`, `confluence/src/adapter.ts:3`, `demo-corpus.ts:14`, …). Eine
// Zeichenkettensuche zählt das als Nennung und meldet Fehlalarm, wo keiner ist. Gezählt werden
// deshalb Knoten des Syntaxbaums — Kommentare kommen dort gar nicht vor. Die Erhebung selbst kommt
// aus `tools/modalgrenze` (dem Werkzeug des Tors), sie wird hier nicht nachgebaut.
//
// ZWEITE GRENZE, ausdrücklich benannt: erkannt wird der NAME, nicht die aufgelöste Modulkante. Eine
// fremde Methode gleichen Namens würde mitgezählt. Das macht den Wächter strenger, nie falsch-grün
// — die richtige Richtung für einen Wächter, der im Tor bleiben soll.
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { type Quelle, ladeQuelle, posix, quelldateien, zeileVon } from "../../tools/modalgrenze";

/** Der ganze Nicht-Test-Baum — `quelldateien` lässt `*.test.ts(x)` selbst draußen. */
const SUCHBAEUME = ["services", "apps/web/src", "tools", "scripts"] as const;

const METHODE = "createImportCandidates";

/**
 * Ab wie vielen Argumenten der Port übergeben IST.
 *
 * `(rawItems, actor, pruefeDublette)` — der Port ist das dritte. Zwei Argumente heißen „ohne Port",
 * eines ebenso. Die Zahl steht hier einmal und nicht in fünf Zusicherungen.
 */
const MIT_PORT_AB = 3;

interface Nennung {
  readonly datei: string;
  readonly zeile: number;
  /** `aufruf` = direkt gerufen. `verweis` = alles andere (bind, Alias, Callback, Elementzugriff). */
  readonly art: "aufruf" | "verweis";
  /** Nur bei `aufruf` — bei einem Verweis ist die Argumentzahl gar nicht bekannt. */
  readonly argumente: number | null;
}

/** Trägt diese Nennung den Namen NUR als Deklaration (Methode, Signatur)? Dann ist sie keine Nutzung. */
function istDeklaration(knoten: ts.Node): boolean {
  const eltern = knoten.parent as ts.Node | undefined;
  if (!eltern) {
    return false;
  }
  return (
    ((ts.isMethodDeclaration(eltern) ||
      ts.isMethodSignature(eltern) ||
      ts.isPropertySignature(eltern) ||
      ts.isPropertyDeclaration(eltern)) &&
      eltern.name === knoten) ||
    // `import { createImportCandidates }` / `export { … }` — eine Kante, keine Nutzung.
    ts.isImportSpecifier(eltern) ||
    ts.isExportSpecifier(eltern)
  );
}

/**
 * Die Nennungen einer Quelle.
 *
 * Erfasst wird der Name als Bezeichner (`library.createImportCandidates`, ein Alias, ein bloßer
 * Verweis) UND als Zeichenketten-Schlüssel (`library["createImportCandidates"]`). Zu jeder Nennung
 * wird bestimmt, ob sie ein DIREKTER Aufruf ist und mit wie vielen Argumenten.
 */
function nennungenIn(quelle: Quelle): Nennung[] {
  const raus: Nennung[] = [];
  const merke = (knoten: ts.Node): void => {
    const eltern = knoten.parent as ts.Node | undefined;
    // Der Zugang, über den der Name gelesen wird: `x.name`, `x["name"]` oder der Name selbst.
    const zugang =
      eltern && (ts.isPropertyAccessExpression(eltern) || ts.isElementAccessExpression(eltern))
        ? eltern
        : knoten;
    const ruf = zugang.parent as ts.Node | undefined;
    const istAufruf = ruf !== undefined && ts.isCallExpression(ruf) && ruf.expression === zugang;
    raus.push({
      datei: quelle.datei,
      zeile: zeileVon(quelle.ast, knoten),
      art: istAufruf ? "aufruf" : "verweis",
      argumente: istAufruf ? (ruf as ts.CallExpression).arguments.length : null,
    });
  };
  const gehe = (n: ts.Node): void => {
    if ((ts.isIdentifier(n) || ts.isStringLiteral(n)) && n.text === METHODE && !istDeklaration(n)) {
      merke(n);
    }
    ts.forEachChild(n, gehe);
  };
  gehe(quelle.ast);
  return raus;
}

/** Eine Nennung ist in Ordnung, wenn sie ein Aufruf MIT Port ist. Alles andere ist ein Fund. */
function ohnePort(nennung: Nennung): boolean {
  return nennung.art !== "aufruf" || (nennung.argumente ?? 0) < MIT_PORT_AB;
}

function alleNennungen(): { nennungen: Nennung[]; leseFehler: string[] } {
  const nennungen: Nennung[] = [];
  const leseFehler: string[] = [];
  for (const baum of SUCHBAEUME) {
    for (const datei of quelldateien(baum)) {
      const quelle = ladeQuelle(datei);
      leseFehler.push(...quelle.leseFehler);
      nennungen.push(...nennungenIn({ ...quelle, datei: posix(datei) }));
    }
  }
  return { nennungen, leseFehler };
}

/** Baut eine Quelle aus Text, ohne eine Datei anzulegen — für die Kalibrierungen. */
function erfundeneQuelle(datei: string, zeilen: readonly string[]): Quelle {
  const text = zeilen.join("\n");
  return {
    datei,
    text,
    gestrippt: text,
    leseFehler: [],
    ast: ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
  };
}

// ================================================================================================
// DAS REGISTER DER ALTFÄLLE — zwei, namentlich, mit Begründung und mit Grenze.
// ================================================================================================
//
// Beide Einträge sind ANKER-/RE-SYNC-Wege: ihre Items tragen eine `externalId`, und bei aktivem
// Upsert-Strang ist eine Bestandskollision dort per Entscheid ein Re-Sync und KEINE Dublette
// (SCRUM-510 R2b, WP-SHIP8-FIX/bens F3). Der Strang stellt die Textfrage also gar nicht — der Port
// wäre dort ein Parameter, den die Methode nie liest.
//
// UND WENN DOCH: liefe ein solcher Aufrufer je mit Items OHNE Anker (oder mit ausgeschaltetem
// Upsert-Strang), greift die Textfrage — und ohne Port fällt sie fail-closed auf
// `pruefung_nicht_moeglich`. Kein stiller Durchlass, kein doppeltes Wissensobjekt. Genau dieser
// Fall ist in `kandidatenweg.test.ts` (K9c) gemessen, nicht behauptet.
//
// DER EINTRAG IST KEINE DAUERKARTE: gibt die Steuerung die zwei Dateien frei, bekommen sie den Port
// und die Einträge müssen hier VERSCHWINDEN — der Fall W4 wird dann rot.
const ALTFAELLE: ReadonlyMap<string, string> = new Map([
  [
    "services/app/src/confluence-import.ts",
    "Anker-/Re-Sync-Sammellauf (SCRUM-510 R2b): Items tragen externalId, die Textfrage wird nicht gestellt; Datei außerhalb der Zielpfade von JOB 3050",
  ],
  [
    "services/app/src/routes/confluence-import-routes.ts",
    "Anker-/Re-Sync-Apply (SCRUM-510 R2b): dieselbe Begründung, dieselbe Zielpfad-Grenze",
  ],
]);

describe("JOB 3050 · W — keine Nennung von createImportCandidates ohne Dublettenport", () => {
  const { nennungen, leseFehler } = alleNennungen();

  it("W0 · die Erhebung trägt: sie liest den Baum ohne Fehler und findet die bekannten Nennungen", () => {
    expect(leseFehler, "Was der Sammler nicht lesen konnte, wird rot — nicht übergangen.").toEqual(
      [],
    );
    // Ohne diese Zahl wäre jede Aussage unten auch bei einer leer laufenden Erhebung grün.
    expect(
      nennungen.length,
      "Drei Produktions-Nennungen: die Bibliotheksroute und die zwei Anker-Wege.",
    ).toBe(3);
    expect(new Set(nennungen.map((n) => n.datei))).toEqual(
      new Set([
        "services/app/src/routes/library-routes.ts",
        "services/app/src/confluence-import.ts",
        "services/app/src/routes/confluence-import-routes.ts",
      ]),
    );
    expect(
      nennungen.every((n) => n.art === "aufruf"),
      "Heute gibt es im Produkt nur direkte Aufrufe — keinen Alias, kein bind.",
    ).toBe(true);
  });

  it("W1 · DER FANG: jede Nennung ohne Port steht namentlich im Register", () => {
    const funde = nennungen.filter(ohnePort).filter((n) => !ALTFAELLE.has(n.datei));
    expect(
      funde.map(
        (n) =>
          `${n.datei}:${n.zeile} — ${n.art}${n.argumente === null ? "" : `, ${n.argumente} Argumente`}, kein Port`,
      ),
      "Eine neue Nennung von createImportCandidates MUSS die Dublettenregel übergeben (services/library-analytics/src/types.ts, DublettenPruefung). Ohne sie gilt jeder Eintrag fail-closed als nicht prüfbar.",
    ).toEqual([]);
  });

  it("W2 · KALIBRIERUNG: die Bibliotheksroute übergibt den Port wirklich", () => {
    // Ohne diesen Fall wäre W1 auch dann grün, wenn der Sammler Argumente gar nicht zählt.
    const route = nennungen.filter((n) => n.datei === "services/app/src/routes/library-routes.ts");
    expect(route).toHaveLength(1);
    expect(route[0]?.art).toBe("aufruf");
    expect(
      route[0]?.argumente,
      "POST /api/library/import/candidates reicht die Regel durch (Items, Akteur, Port).",
    ).toBeGreaterThanOrEqual(MIT_PORT_AB);
  });

  it("W3 · KALIBRIERUNG: ein portloser Aufruf in einer NICHT registrierten Datei wird gefunden", () => {
    // Der Sammler wird mit einer erfundenen Quelle gefüttert — keine Datei im Baum wird angelegt.
    const gefunden = nennungenIn(
      erfundeneQuelle("services/app/src/zweiter-aufbau.ts", [
        "// createImportCandidates steht hier auch im Kommentar — der zaehlt nicht.",
        "async function zweiterAufbau(library: L, items: I[]) {",
        "  return library.createImportCandidates(items, 'system');",
        "}",
      ]),
    );
    expect(gefunden, "Genau EINE Nennung — die Kommentar-Nennung zählt nicht mit.").toHaveLength(1);
    expect(gefunden[0]?.art).toBe("aufruf");
    expect(gefunden[0]?.argumente).toBe(2);
    expect(gefunden[0]?.zeile, "Die Meldung nennt die Zeile.").toBe(3);
    expect(gefunden.filter(ohnePort)).toHaveLength(1);
  });

  // ==============================================================================================
  // W3b — GENAU BENS LÜCKE AUS RUNDE 2. Vier typgültige Wege, den Port zu umgehen, ohne dass ein
  // direkter Aufruf im Quelltext steht. Jeder muss ein Fund sein.
  // ==============================================================================================
  it.each([
    [
      "gebundene Methodenreferenz (bens Messung)",
      "  const f = library.createImportCandidates.bind(library);",
    ],
    ["Alias-Zuweisung", "  const f = library.createImportCandidates;"],
    ["als Callback weitergegeben", "  lauf(library.createImportCandidates);"],
    ["Elementzugriff mit Zeichenkette", '  const f = library["createImportCandidates"];'],
  ])("W3b · %s wird als Verweis ohne Port gefunden", (_name, zeile) => {
    const gefunden = nennungenIn(
      erfundeneQuelle("services/app/src/umweg.ts", [
        "function umweg(library: L) {",
        zeile,
        "  return f;",
        "}",
      ]),
    );
    expect(gefunden, "Der Umweg wird gesehen.").toHaveLength(1);
    expect(
      gefunden[0]?.art,
      "Er ist kein direkter Aufruf — genau daran ist Runde 2 vorbeigelaufen.",
    ).toBe("verweis");
    expect(gefunden[0]?.argumente, "Bei einem Verweis ist die Argumentzahl unbekannt.").toBeNull();
    expect(gefunden.filter(ohnePort), "Und er ist ein Fund.").toHaveLength(1);
  });

  it("W4 · KEINE LEICHEN: jeder Registereintrag hat heute noch eine portlose Nennung", () => {
    const ohnePortJeDatei = new Set(nennungen.filter(ohnePort).map((n) => n.datei));
    const ueberholt = [...ALTFAELLE.keys()].filter((datei) => !ohnePortJeDatei.has(datei));
    expect(
      ueberholt,
      "Diese Ausnahmen sind behoben — Eintrag aus ALTFAELLE entfernen, damit das Register schrumpft.",
    ).toEqual([]);
  });

  it("W5 · jede Ausnahme trägt eine Begründung, nicht bloß einen Pfad", () => {
    for (const [datei, grund] of ALTFAELLE) {
      expect(grund.trim().length, `Ausnahme ohne Begründung: ${datei}`).toBeGreaterThan(40);
    }
  });

  // ==============================================================================================
  // W6 — DIE GRENZE, GEMESSEN STATT BEHAUPTET.
  // ==============================================================================================
  //
  // Ein BERECHNETER Schlüssel steht als Name nirgends im Syntaxbaum; kein Namenssammler dieser
  // Bauart kann ihn sehen. Dieser Fall hält das FEST, damit die Reichweite des Wächters nicht
  // größer gelesen wird als sie ist (bens ROT-2: genau diese Überbehauptung war der Befund).
  // Für ihn trägt allein die zweite Linie — fail-closed, gemessen in `kandidatenweg.test.ts` K9.
  it("W6 · GRENZE: ein berechneter Schlüssel wird NICHT gefunden — dafür trägt die Fail-closed-Linie", () => {
    const gefunden = nennungenIn(
      erfundeneQuelle("services/app/src/dynamisch.ts", [
        "function dynamisch(library: L, items: I[], schluessel: string) {",
        "  return (library as never)[schluessel](items, 'system');",
        "}",
      ]),
    );
    expect(
      gefunden,
      "Ehrliche Grenze: ohne den Namen im Baum gibt es nichts zu sehen. Der Schutz liegt hier bei `erzwingeDublettenpruefung` (fail-closed), nicht beim Wächter.",
    ).toEqual([]);
  });
});
