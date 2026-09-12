// ================================================================================================
// JOB 3587 · DER WÄCHTER: DREI ZUSAGEN, DIE SICH NICHT SELBST AUFWEICHEN DÜRFEN.
// ================================================================================================
//
// WOGEGEN ER STEHT. JOB 3587 hat die schmale Kopfbandzeile zum ersten Mal in drei Sprachen
// gemessen. Alles daran ist leicht wieder zu verlieren, und zwar lautlos:
//
//   (a) Jemand braucht in einem h6-Lauf eine Sprache, findet den gemeinsamen Schritt nicht und
//       setzt sich `kw.sprache` wieder selbst. Dann gibt es zwei Wege, und der zweite ist der, der
//       beim nächsten Umbau vergessen wird — genau der Zustand, den JOB 3576 für den anderen
//       Prüfstand beseitigt hat.
//   (b) Jemand streicht eine Sprache oder eine Breite aus der Prüfmenge. Der Lauf bleibt GRÜN und
//       kürzer; niemand sieht, dass Niederländisch nicht mehr gemessen wird.
//   (c) Jemand macht eine rote Achse grün, indem er sie in einen `nurGemessen`-Fall umwidmet —
//       ohne Grund daneben. Aus einem Befund wird damit ein Achselzucken.
//
// ÜBER DEN SYNTAXBAUM, NICHT ÜBER ZEICHENKETTEN. Das ist in diesem Haus keine Vorliebe, sondern
// dreimal bezahlte Erfahrung (`tests/capture/aufrufer-waechter.test.ts`,
// `tests/tor-inventar/browser-gruppe.ts:20-29`, und zuletzt JOB 3570 R1–R3 und JOB 3579 R1, wo
// genau die Unterscheidung „ausführbarer Code gegen Kommentar/Zeichenkette/Regex" die Korrektur-
// pflicht war). Kommentare kommen im AST gar nicht vor; ein Regex-Literal ist kein Aufruf.
//
// DIE ERKENNUNG SELBST WOHNT SEIT RUNDE 2 NEBENAN (`sprachweg-ast.ts`) und wird dort mit
// erfundenen Quelltexten kalibriert (`sprachweg-ast.test.ts`) — BEN hat ihre erste Fassung mit zwei
// Quelltexten widerlegt, die es im Bestand gar nicht gibt: ein harmloser Beispielsatz in einem
// `console.log` machte sie rot, echter Browsercode über eine VARIABLE blieb grün. Beides ist jetzt
// je ein Dauerfall dort. Dieser Wächter hier hält die Erkennung gegen den echten BESTAND; wie sie
// entscheidet, entscheidet sie nachweisbar richtig.
//
// KEIN BROWSER, KEINE NEUE STARTSTELLE: diese Datei liest Quelltext und startet nichts. Sie
// importiert die gemessenen Dateien ausdrücklich NICHT, sondern liest sie als Text — ein Import
// zöge sie über die Importhülle in die serielle Browser-Gruppe
// (`tests/tor-inventar/browser-gruppe.ts`) und verschöbe den Bestandspin der Startstellen.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { WURZEL, alsPosix, sammleTestdateien, spezifizierer } from "../tor-inventar/browser-gruppe";
import {
  SPRACHE_SCHLUESSEL,
  type Setzerbefund,
  beschreibe,
  listeAus,
  sammleAufweichungen,
  untersucheQuelle,
} from "./sprachweg-ast";

/** Der Prüfstand, dessen Sprachschritt die eine Wahrheit ist. */
const PRUEFSTAND = "tests/design/h6-chromium.ts";
/** Die Messdatei, deren Prüfmenge und Zusagen bewacht werden. */
const MESSDATEI = "tests/navigation-schmal/kopfband-schmal-chromium.test.ts";

// ==================================================================================================
// DER ALTBESTAND — WAS ES SCHON GAB, BEVOR ES DEN GEMEINSAMEN SCHRITT GAB.
// ==================================================================================================
//
// Gemessen am 11.09.2026, nicht vermutet: VIER Dateien der h6-Hülle setzen `kw.sprache` selbst (die
// ersten zwei waren erwartet, die zwei aus `m6-import-erklaerweg` hat erst der erste Lauf dieses
// Wächters gefunden), und alle liegen ausserhalb der Zielpfade von JOB 3587 (§4). Sie stehen hier —
// namentlich,
// mit Grund. Das ist kein Freibrief, sondern eine Schranke in BEIDE Richtungen, dieselbe Bauart wie
// `tests/design-vorrichtung/seiten-typ-waechter.test.ts`:
//   · Eine Datei, die NICHT hier steht und sich den Weg selbst baut, macht diesen Fall rot.
//   · Eine Datei, die hier steht und ihren eigenen Weg LOSWIRD, macht ihn ebenfalls rot — dann
//     gehört die Zeile weg, sonst verwaltet das Register Gespenster (Lehre JOB 3550/3562: ein
//     Wächter, der nichts mehr sieht, ist grün und nutzlos).
// Wer eine dieser Zeilen abräumen will, führt die Datei auf `setzeSprache` zurück und löscht sie.
const ALTBESTAND: ReadonlyMap<string, string> = new Map([
  [
    "tests/einstellungen-schmal/ux12b-einstellungen-schmal-chromium.test.ts",
    "reitet auf h6, setzt die Sprache seit JOB 3122 selbst (`:431`); Zielpfad eines fremden Auftrags",
  ],
  [
    "tests/profil-schmal/schmal-buehne.ts",
    "eine EIGENE Bühne mit eigenem Konto (`:5-14`), die von h6 nur `DIST`, `ORIGIN` und `fn` leiht; ihr `setzeSprache` gehört zu ihrem eigenen Stand-Typ",
  ],
  // Diese zwei setzen die Sprache GEMEINSAM mit einem zweiten Schalter in EINEM Aufruf
  // (`kw.stufe2.v1`, die Stufe-2-Freischaltung). Ein Rückbau auf `setzeSprache` wäre kein Handgriff,
  // sondern eine zweite Entscheidung: entweder verliert der Aufruf seine Atomarität, oder die
  // Vorrichtung bekommt einen zweiten Schalter. Beides gehört einem eigenen Auftrag; JOB 3587 hat
  // diese Dateien nicht im Zielpfad und misst sie nur.
  [
    "tests/m6-import-erklaerweg/rueckweg-echte-route-chromium.test.ts",
    "setzt Sprache und Stufe-2-Schalter in einem Zug (`:99`); Zielpfad eines fremden Auftrags",
  ],
  [
    "tests/m6-import-erklaerweg/rundweg-tastatur-chromium.test.ts",
    "setzt Sprache und Stufe-2-Schalter in einem Zug (`:154`); Zielpfad eines fremden Auftrags",
  ],
]);

// ==================================================================================================
// DIE ZUGESAGTE PRÜFMENGE — die Zahl, gegen die (b) gehalten wird.
// ==================================================================================================
//
// Sie steht HIER und nicht nur in der Messdatei: ein Pin, der aus der bewachten Datei selbst käme,
// vergliche sie mit sich selbst und wäre immer grün. Grösser werden darf die Menge jederzeit —
// kleiner nicht.
//
// NACHGEFÜHRT JOB 3587 R5 (BENs Korrekturpflicht 1). Der Rebase auf JOB 3605 hat die Messliste in
// `kopfband-schmal-chromium.test.ts` um 800 px (mitten im Band) und 1000 px (breite Bauform)
// erweitert — §5 jenes Auftrags verlangt beide. In Runde 4 ist das zwar in der Rückgabe vermerkt,
// aber NICHT hier nachgezogen worden. Die Folge war eine echte Lücke: der Pin hielt nur sieben
// Breiten, die Datei fuhr neun, und BEN hat sie belegt — beide neuen Breiten aus `BREITEN` entfernt,
// „Tests 59 passed (59)", kein Wächter sagte etwas. Sechs der 27 Kombinationen waren damit gegen
// stilles Streichen ungeschützt.
//
// LEHRE, die über diesen Job hinausreicht: eine gewachsene Prüfmenge ist erst dann gesichert, wenn
// der UNABHÄNGIGE Pin mitwächst. Wer hier eine Breite ergänzt, ergänzt sie auch in `BREITEN` — und
// umgekehrt. Dass der Pin selbst greift, hält W2c fest (Kalibrierung mit erfundenen Listen), damit
// er nicht eines Tages grün ist, ohne etwas zu sehen.
const ZUGESAGTE_SPRACHEN = ["de", "en", "nl"] as const;
const ZUGESAGTE_BREITEN = [390, 600, 760, 768, 800, 899, 900, 1000, 1280] as const;

/**
 * Was aus einer gefahrenen Prüfmenge gegenüber der Zusage fehlt — als benannte Liste.
 *
 * Eine Funktion statt zweier Schleifen im Fall, weil W2c sie mit ERFUNDENEN Listen aufrufen muss:
 * die Lücke aus Runde 4 liess sich am Bestand nicht zeigen (dort war ja alles da, nur die Zusage zu
 * klein). Beide Fälle fragen jetzt dieselbe Erkennung — eine zweite Abschrift wäre am Tag ihrer
 * Entstehung gleich und beim nächsten Umbau verschieden.
 */
function fehlendeZusagen(
  sprachen: readonly (string | number)[],
  breiten: readonly (string | number)[],
): string[] {
  const fehlend: string[] = [];
  for (const sprache of ZUGESAGTE_SPRACHEN) {
    if (!sprachen.includes(sprache)) {
      fehlend.push(
        `die Sprache „${sprache}" ist aus der Prüfmenge verschwunden — damit misst der Lauf sie nicht mehr und bleibt trotzdem grün`,
      );
    }
  }
  for (const breite of ZUGESAGTE_BREITEN) {
    if (!breiten.includes(breite)) {
      fehlend.push(`die Breite ${breite} px ist aus der Prüfmenge verschwunden`);
    }
  }
  return fehlend;
}

// ---- Quelltext lesen ---------------------------------------------------------------------------

const ENDUNGEN = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"] as const;

function istDatei(pfad: string): boolean {
  return existsSync(pfad) && statSync(pfad).isFile();
}

/**
 * Auflösung eines RELATIVEN Spezifizierers (`moduleResolution: "Bundler"`).
 *
 * Sie steht hier schlank und nur für relative Wege: alles andere führt aus dem Arbeitsbaum heraus
 * und ist für die Frage „reitet diese Datei auf h6?" ohne Belang. Die vollständige Auflösung wohnt
 * in `tests/tor-inventar/browser-gruppe.ts` (dort privat); die Kantenerhebung selbst wird von dort
 * IMPORTIERT (`spezifizierer`) statt abgeschrieben.
 */
function loeseAuf(vonDatei: string, spez: string): string | undefined {
  if (!spez.startsWith(".")) {
    return undefined;
  }
  const roh = resolve(dirname(join(WURZEL, vonDatei)), spez);
  if (istDatei(roh)) {
    return roh;
  }
  const ohneJs = roh.replace(/\.(js|jsx|mjs|cjs)$/, "");
  for (const kandidat of [roh, ohneJs]) {
    for (const endung of ENDUNGEN) {
      if (istDatei(kandidat + endung)) {
        return kandidat + endung;
      }
    }
    for (const endung of ENDUNGEN) {
      const index = join(kandidat, `index${endung}`);
      if (istDatei(index)) {
        return index;
      }
    }
  }
  return undefined;
}

/**
 * Einen Quelltext AN DER STELLE einer Bestandsdatei durch die Erkennung schicken — mit EINEM Sprung
 * in ihre relativen Nachbarmodule.
 *
 * Der Quelltext ist absichtlich ein eigener Parameter: so fährt W1d unten eine eingeschleuste Zeile
 * durch GENAU denselben Weg, den W1c für den echten Bestand fährt (Nachbarauflösung eingeschlossen),
 * statt die Erkennung noch einmal getrennt aufzurufen. Eine Datei wird dabei nie geschrieben.
 */
function untersucheAlsDatei(posix: string, quelltext: string): Setzerbefund {
  return untersucheQuelle(quelltext, {
    herkunft: posix,
    nachbarText: (spez) => {
      const ziel = loeseAuf(posix, spez);
      return ziel === undefined ? undefined : readFileSync(ziel, "utf8");
    },
  });
}

/** Eine Datei durch die Erkennung schicken — mit EINEM Sprung in ihre relativen Nachbarmodule. */
function untersuche(posix: string): Setzerbefund {
  return untersucheAlsDatei(posix, readFileSync(join(WURZEL, posix), "utf8"));
}

/** Jede Datei, deren Importhülle `tests/design/h6-chromium.ts` berührt — sie selbst eingeschlossen. */
function huelleUmDenPruefstand(): string[] {
  const kanten = new Map<string, string[]>();
  const offen = [...sammleTestdateien()];
  while (offen.length > 0) {
    const posix = offen.pop() as string;
    if (kanten.has(posix) || !istDatei(join(WURZEL, posix))) {
      continue;
    }
    const nachbarn: string[] = [];
    for (const spez of spezifizierer(join(WURZEL, posix))) {
      const ziel = loeseAuf(posix, spez);
      if (ziel !== undefined && !ziel.includes("node_modules")) {
        const zielPosix = alsPosix(ziel);
        nachbarn.push(zielPosix);
        offen.push(zielPosix);
      }
    }
    kanten.set(posix, nachbarn);
  }
  const reitet = new Set<string>();
  for (const start of kanten.keys()) {
    const gesehen = new Set<string>([start]);
    const stapel = [start];
    while (stapel.length > 0) {
      const jetzt = stapel.pop() as string;
      if (jetzt === PRUEFSTAND) {
        reitet.add(start);
        break;
      }
      for (const nachbar of kanten.get(jetzt) ?? []) {
        if (!gesehen.has(nachbar)) {
          gesehen.add(nachbar);
          stapel.push(nachbar);
        }
      }
    }
  }
  return [...reitet].sort();
}

// ==================================================================================================
// DIE FÄLLE
// ==================================================================================================

describe("JOB 3587 · W1 · die Sprachwahl der h6-Läufe hat EINEN Weg", () => {
  const reiter = huelleUmDenPruefstand();

  it("W1a · der Prüfstand selbst trägt den Schritt — sonst bewacht dieser Fall ein Nichts", () => {
    const fund = untersuche(PRUEFSTAND);
    expect(
      fund.schluessel.length,
      `in ${PRUEFSTAND} steht der Schlüssel "${SPRACHE_SCHLUESSEL}" nicht mehr — der gemeinsame Sprachschritt ist fort`,
    ).toBeGreaterThan(0);
    expect(
      fund.setztSprache,
      `in ${PRUEFSTAND} schreibt nichts mehr ausführbar in den Speicher — der Sprachschritt setzt nichts (${beschreibe(fund)})`,
    ).toBe(true);
    const quelltext = readFileSync(join(WURZEL, PRUEFSTAND), "utf8");
    expect(
      quelltext.includes("export async function setzeSprache"),
      `${PRUEFSTAND} exportiert kein \`setzeSprache\` mehr`,
    ).toBe(true);
    // Und der Schritt gibt seine gemessene Lage heraus — ohne sie könnte kein Aufrufer prüfen, ob
    // wirklich auf den Zustand gewartet wurde (BENs Gegenprobe A, s. Kopf von `h6-chromium.ts`).
    expect(
      quelltext.includes("export interface SprachLage"),
      `${PRUEFSTAND} gibt keine \`SprachLage\` mehr heraus — die Zusage „auf den Zustand gewartet" wäre dann nicht mehr prüfbar`,
    ).toBe(true);
  });

  it("W1b · die Hülle des Prüfstands ist wirklich erhoben (Kalibrierung)", () => {
    // Ein leerer oder winziger Befund hiesse, dass die Kantenerhebung nicht greift — dann wäre W1c
    // grün, ohne etwas gesehen zu haben. Die zwei Dateien unten reiten nachweislich auf h6.
    expect(reiter.length, "die Importhülle des Prüfstands ist leer").toBeGreaterThan(5);
    for (const pflicht of [MESSDATEI, "tests/navigation-schmal/kopfband-messung.ts"]) {
      expect(reiter, `${pflicht} fehlt in der erhobenen Hülle`).toContain(pflicht);
    }
    console.log(`JOB 3587 · W1b · ${reiter.length} Dateien reiten auf ${PRUEFSTAND}`);
  });

  it("W1c · keine dieser Dateien setzt `kw.sprache` selbst — ausser dem benannten Altbestand", () => {
    const eigenmaechtig: string[] = [];
    const verdaechtig: string[] = [];
    const stilleAltlasten: string[] = [];
    let unlesbar = 0;
    for (const posix of reiter) {
      if (posix === PRUEFSTAND) {
        continue;
      }
      const fund = untersuche(posix);
      unlesbar += fund.unklar.length;
      const altbestand = ALTBESTAND.get(posix);
      if (fund.setztSprache && altbestand === undefined) {
        eigenmaechtig.push(`${posix} — ${beschreibe(fund)}`);
      }
      // Der Schlüssel ist da, der ausgeführte Browsercode aber nicht lesbar: das ist die Lage, in
      // der diese Erkennung nichts sagen KANN — und deshalb nichts durchlassen darf.
      if (fund.verdaechtig && altbestand === undefined) {
        verdaechtig.push(
          `${posix} — ${fund.unklar.map((u) => `Z. ${u.zeile}: ${u.was}`).join(", ")}`,
        );
      }
      if (!fund.setztSprache && !fund.verdaechtig && altbestand !== undefined) {
        stilleAltlasten.push(posix);
      }
    }
    expect(
      eigenmaechtig,
      `diese h6-Läufe setzen die Sprachwahl selbst, statt \`setzeSprache\` aus ${PRUEFSTAND} zu benutzen:\n  ${eigenmaechtig.join("\n  ")}`,
    ).toEqual([]);
    expect(
      verdaechtig,
      `diese h6-Läufe tragen den Sprachschlüssel UND führen Browsercode aus, der sich nicht lesen lässt — entweder als Quelltext hinschreiben oder \`setzeSprache\` benutzen:\n  ${verdaechtig.join("\n  ")}`,
    ).toEqual([]);
    expect(
      stilleAltlasten,
      `diese Dateien stehen im ALTBESTAND dieses Wächters, setzen die Sprache aber nicht mehr selbst — die Zeile gehört gelöscht:\n  ${stilleAltlasten.join("\n  ")}`,
    ).toEqual([]);
    console.log(
      `JOB 3587 · W1c · ${reiter.length - 1} Dateien geprüft, ${ALTBESTAND.size} benannte Altlasten, ${unlesbar} nicht auflösbare Browserquellen (ohne Sprachschlüssel, deshalb ohne Urteil)`,
    );
  });

  // ------------------------------------------------------------------------------------------------
  // W1d · DIE UMGEHUNGSPROBE AM ECHTEN WEG (BENs Korrekturpflicht 1 aus Runde 2).
  // ------------------------------------------------------------------------------------------------
  //
  // W1c ist nur so viel wert, wie er einen EINGESCHLEUSTEN zweiten Sprachweg wirklich sieht. In
  // Runde 2 war er das nicht: BEN hat in die bewachte Messdatei einen Setzer gelegt, dessen Rumpf in
  // einer Schablone eingesetzt wurde (`` `() => { ${rumpf}; }` ``), und W1c blieb grün — die
  // Erkennung hatte die Einsetzung weggeworfen und einen scheinbar vollständigen, tatsächlich
  // verkürzten Quelltext gelesen.
  //
  // Die Kalibrierung nebenan (`sprachweg-ast.test.ts`, K12–K17) prüft die ERKENNUNG an erfundenen
  // Schnipseln. Dieser Fall prüft den WÄCHTER: dieselbe Zeile, aber in den echten Text der echten
  // bewachten Datei gelegt und durch denselben Aufruf geschickt, den W1c benutzt — mitsamt
  // Nachbarauflösung. Ohne ihn könnte die Erkennung richtig entscheiden und der Wächter sie
  // trotzdem falsch herum anwenden (die Lehre aus JOB 3571 R1: ein Wächter, den der bewachte Fehler
  // abschalten kann, ist keiner).
  //
  // Geschrieben wird nichts: der Bestandstext wird im Speicher ergänzt.
  it("W1d · ein eingeschleuster zweiter Sprachweg macht W1c rot — auch in einer Schablone", () => {
    const echt = readFileSync(join(WURZEL, MESSDATEI), "utf8");
    expect(
      untersucheAlsDatei(MESSDATEI, echt).setztSprache,
      `${MESSDATEI} setzt die Sprache schon im Bestand selbst — dann prüft dieser Fall nicht mehr die Einschleusung`,
    ).toBe(false);

    const umgehungen: ReadonlyMap<string, string> = new Map([
      [
        "Schablone (BENs Umgehung aus Runde 2)",
        [
          "async function umgehung(seite: Seite) {",
          `  const rumpf = 'localStorage.setItem("${SPRACHE_SCHLUESSEL}", "nl")';`,
          "  const code = `() => { ${rumpf}; }`;",
          "  await seite.evaluate(code as never);",
          "}",
        ].join("\n"),
      ],
      [
        "gerader Weg über eine Variable",
        [
          "async function umgehung2(seite: Seite) {",
          `  const code = '() => localStorage.setItem("${SPRACHE_SCHLUESSEL}", "nl")';`,
          "  await seite.evaluate(code as never);",
          "}",
        ].join("\n"),
      ],
      [
        "Verkettung mit unbekanntem Glied",
        [
          `const SCHL = "${SPRACHE_SCHLUESSEL}";`,
          "function rumpf3() { return 'localStorage.setItem(SCHL, v)'; }",
          "async function umgehung3(seite: Seite) {",
          '  await seite.evaluate(("(v) => { " + rumpf3() + " }") as never);',
          "}",
        ].join("\n"),
      ],
    ]);

    const durchgerutscht: string[] = [];
    for (const [name, rumpf] of umgehungen) {
      const fund = untersucheAlsDatei(MESSDATEI, `${echt}\n${rumpf}\n`);
      // Gesehen ist beides: als gelesener Setzer ODER als ausdrücklich unlesbare Stelle. Was NICHT
      // gilt, ist Schweigen — genau das war die Lücke.
      if (!fund.setztSprache && !fund.verdaechtig) {
        durchgerutscht.push(`${name} — Befund: ${JSON.stringify(fund)}`);
      }
    }
    expect(
      durchgerutscht,
      `diese eingeschleusten Sprachwege liessen W1c grün — der Wächter bewacht dann nichts:\n  ${durchgerutscht.join("\n  ")}`,
    ).toEqual([]);
    console.log(
      `JOB 3587 · W1d · ${umgehungen.size} Umgehungen am echten Weg geprüft, alle gesehen: ${[...umgehungen.keys()].join(" · ")}`,
    );
  });
});

describe("JOB 3587 · W2 · die Prüfmenge und die Zusagen der Messung", () => {
  const quelltext = readFileSync(join(WURZEL, MESSDATEI), "utf8");

  it("W2a · jede zugesagte Sprache und jede zugesagte Breite steht noch in der Prüfmenge", () => {
    const sprachen = listeAus(quelltext, "SPRACHEN", MESSDATEI);
    const breiten = listeAus(quelltext, "BREITEN", MESSDATEI);
    const fehlend = fehlendeZusagen(sprachen, breiten);
    expect(
      fehlend,
      `aus der Prüfmenge von ${MESSDATEI} ist etwas verschwunden — der Lauf misst es nicht mehr und bleibt trotzdem grün:\n  ${fehlend.join("\n  ")}`,
    ).toEqual([]);
    console.log(
      `JOB 3587 · W2a · zugesagt sind ${ZUGESAGTE_SPRACHEN.length * ZUGESAGTE_BREITEN.length} Kombinationen; die Messdatei führt ${sprachen.length} × ${breiten.length} = ${sprachen.length * breiten.length}`,
    );
  });

  // ------------------------------------------------------------------------------------------------
  // W2c · DER PIN WIRD SELBST GEPRÜFT — sonst ist er grün, ohne etwas zu sehen.
  // ------------------------------------------------------------------------------------------------
  //
  // BENs Befund in Runde 4 war nicht, dass W2a falsch PRÜFT, sondern dass er zu wenig ZUSAGT: die
  // Messliste war auf neun Breiten gewachsen, der Pin hielt sieben, und das Entfernen von 800 und
  // 1000 px blieb grün. Gegen genau diese Bauart hilft kein schärferer Vergleich, sondern nur ein
  // Fall, der die Prüfung mit erfundenen Listen füttert und sie beim Wort nimmt.
  //
  // Geprüft wird deshalb die Erkennung, nicht der Bestand: jede zugesagte Breite wird EINZELN aus
  // einer künstlichen Liste genommen, und der Befund muss sie namentlich nennen. Das deckt die zwei
  // neuen Breiten mit ab und bleibt richtig, wenn morgen eine zehnte dazukommt.
  it("W2c · fehlt eine einzelne zugesagte Breite oder Sprache, nennt der Befund sie beim Namen", () => {
    expect(
      fehlendeZusagen([...ZUGESAGTE_SPRACHEN], [...ZUGESAGTE_BREITEN]),
      "die vollständige Prüfmenge wurde als lückenhaft gemeldet",
    ).toEqual([]);
    for (const breite of ZUGESAGTE_BREITEN) {
      const ohne = ZUGESAGTE_BREITEN.filter((b) => b !== breite);
      const befund = fehlendeZusagen([...ZUGESAGTE_SPRACHEN], [...ohne]);
      expect(befund.length, `${breite} px fehlt, der Wächter schweigt`).toBe(1);
      expect(
        befund[0],
        `der Befund nennt die fehlende Breite ${breite} nicht: ${befund[0]}`,
      ).toContain(`${breite} px`);
    }
    for (const sprache of ZUGESAGTE_SPRACHEN) {
      const ohne = ZUGESAGTE_SPRACHEN.filter((s) => s !== sprache);
      const befund = fehlendeZusagen([...ohne], [...ZUGESAGTE_BREITEN]);
      expect(befund.length, `„${sprache}" fehlt, der Wächter schweigt`).toBe(1);
      expect(befund[0]).toContain(`„${sprache}"`);
    }
    console.log(
      `JOB 3587 · W2c · ${ZUGESAGTE_BREITEN.length} Breiten und ${ZUGESAGTE_SPRACHEN.length} Sprachen einzeln entfernt, jede wurde namentlich gemeldet`,
    );
  });

  it("W2b · keine der drei engen Achsen wird ohne benannten Grund abgeschaltet", () => {
    const aufweichungen = sammleAufweichungen(quelltext, MESSDATEI);
    expect(
      aufweichungen.length,
      `in ${MESSDATEI} wird keine Achse mehr abgeschaltet — dann hat dieser Fall nichts zu bewachen und gehört nachgeführt`,
    ).toBeGreaterThan(0);
    // BENs Korrekturpflicht 2: verlangt wird ein WIRKLICH vorhandener, nichtleerer Grund. Die
    // Fassung aus Runde 1 nahm jeden nichtliteralen Ausdruck an — auch `grund: undefined`.
    const ohneGrund = aufweichungen
      .filter((a) => a.grund === null)
      .map((a) => `Z. ${a.zeile}: ${a.achsen.join(", ")} abgeschaltet — ${a.warum}`);
    expect(
      ohneGrund,
      `in ${MESSDATEI} wird eine zugesicherte Achse ohne tragfähigen Grund weggeschaltet:\n  ${ohneGrund.join("\n  ")}`,
    ).toEqual([]);
    console.log(
      `JOB 3587 · W2b · ${aufweichungen.length} Aufweichungen in ${MESSDATEI}, alle mit Grund: ${aufweichungen
        .map((a) => `Z. ${a.zeile} „${(a.grund ?? "").slice(0, 40)}…"`)
        .join(" · ")}`,
    );
  });
});

// ==================================================================================================
// JOB 3587 R4 · W3 — DIE PRODUKTNAMEN, AUF DENEN DIE ZUSAGE STEHT, WERDEN LAUT GENANNT.
// ==================================================================================================
//
// WAS DIESEN FALL ERZWUNGEN HAT. Der Einbau von JOB 3587 ist am 11.09. VIERMAL gescheitert (20:07,
// 20:24, 21:00, 21:18, rund 76 Minuten), und zwar so: `zusage-quelle.ts` las `SCHMAL_PUNKTE_QUERY`
// aus `shell/Kopfband.tsx`, JOB 3605 hatte die Konstante aber entfernt. Weil das Lesen beim
// EINLESEN des Moduls abbricht, meldete die Messdatei „0 test" — `Test Files 1713 passed`, kein
// einziger roter Fall, und trotzdem Tor rot. In keiner Fehlerliste stand etwas, wonach man hätte
// suchen können.
//
// WAS DIESER FALL DARAN ÄNDERT. Er lädt `zusage-quelle.ts` ABSICHTLICH dynamisch und fängt den
// Abbruch. Aus dem unsichtbaren Einlesefehler wird damit ein normaler roter Fall MIT NAMEN, und
// zwar in der schnellen Gruppe, die jede Bahn vor der Abgabe selbst fährt — nicht erst in der
// seriellen Browser-Gruppe auf der Einbaustrecke.
//
// UND IM GRÜNEN FALL NENNT ER DIE NAMEN. Genau die Liste hat beim Stranden gefehlt (Hinweis der
// Steuerung, Punkt 3: „Nenne alle Namen, die dein Wächter aus dem Produkt liest"). Sie steht jetzt
// bei JEDEM Lauf im Protokoll — wer das nächste Mal eine Konstante umbenennt, findet sie mit einer
// Textsuche im Protokoll statt in vier Quelltexten.
describe("JOB 3587 · W3 · die Zusage steht auf Produktnamen, die es wirklich gibt", () => {
  it("W3 · jeder gelesene Name ist im Produkt vorhanden (bzw. belegt abwesend) und wird benannt", async () => {
    let quelle: typeof import("./zusage-quelle");
    try {
      quelle = await import("./zusage-quelle");
    } catch (fehler) {
      // KEIN erneutes Werfen: die Meldung gehört in die Fallliste, sonst wiederholt sich „0 test".
      expect.fail(
        `\`zusage-quelle.ts\` kommt nicht hoch — die Zusage dieses Jobs hat keine Quelle mehr im Produkt. Das ist der Fehler, an dem der Einbau am 11.09. viermal gestrandet ist. Wortlaut: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
      );
    }

    const fehlen: string[] = [];
    for (const { name, datei, art } of quelle.QUELLNAMEN) {
      // Gefragt wird DIESELBE Funktion, die `zusage-quelle.ts` selbst benutzt — eine zweite
      // Abschrift des Musters wäre am Tag ihrer Entstehung gleich und beim nächsten Umbau
      // verschieden. Sie sucht in kommentarfreiem Text: `KopfbandPunkte.tsx:191` und
      // `Kopfband.tsx:203` NENNEN die entfernte Auswahl heute noch, in Kommentaren, die ihre
      // Entfernung begründen; ein Muster, das Vorkommen zählt, läse dort eine Rückkehr.
      const deklariert = quelle.deklariertIn(readFileSync(join(WURZEL, datei), "utf8"), name);
      if (art === "muss fehlen" && deklariert) {
        fehlen.push(
          `${name} steht wieder in ${datei} — die Zusage „schmal kein Punkt" ist überholt`,
        );
      }
      if (art !== "muss fehlen" && !deklariert) {
        fehlen.push(`${name} steht nicht mehr in ${datei}`);
      }
    }
    expect(
      fehlen,
      `die Zusage dieses Laufs steht auf Produktnamen, die so nicht mehr gelten:\n  ${fehlen.join("\n  ")}`,
    ).toEqual([]);

    // Kalibrierung: eine leere Liste wäre grün, ohne etwas gesehen zu haben.
    expect(quelle.QUELLNAMEN.length, "`QUELLNAMEN` ist leer").toBeGreaterThan(3);
    console.log(
      `JOB 3587 · W3 · gelesene Produktnamen: ${quelle.QUELLNAMEN.map((q) => `${q.name} (${q.art}, ${q.datei})`).join(" · ")}`,
    );
    console.log(
      `JOB 3587 · W3 · gelesene Werte: NARROW_QUERY „${quelle.NARROW_QUERY}" · SCHMAL_GEHEZU_QUERY „${quelle.SCHMAL_GEHEZU_QUERY}" · KOPFBAND_IDS [${quelle.KOPFBAND_IDS.join(", ")}] · schmal erwartet [${quelle.erwartetePunkte(true).join(", ")}]`,
    );
  });
});
