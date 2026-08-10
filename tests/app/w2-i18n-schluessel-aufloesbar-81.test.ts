import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ================================================================================================
// AUFTRAG-81 — JEDER SCHLUESSEL, DEN DIE W2-FLAECHE BENUTZT, MUSS AUFLOESEN.
// ================================================================================================
//
// Der Befund aus Preflight 78: `w2.value.missing` und `w2.value.none` werden in
// `importResultView.ts` erzeugt und in `SourceRecordCard.tsx` an `t()` gereicht — standen aber in
// KEINEM der drei Woerterbuecher. i18next ist ohne `parseMissingKeyHandler` initialisiert und gibt
// dann DEN SCHLUESSEL SELBST zurueck; eine fehlende Pflichtangabe am Original haette dem Nutzer
// woertlich „w2.value.missing" gezeigt.
//
// WARUM DIE VORHANDENEN TESTS DAS NICHT FINGEN — und warum dieser hier anders gebaut ist:
//   · der reine Kerntest pinnt den SCHLUESSELNAMEN (`expect(...).toBe("w2.value.missing")`),
//   · der gemountete Test prueft nur, DASS ueberhaupt Text dasteht (`textContent.length > 0`) —
//     und die rohe Schluesselzeichenkette hat Laenge > 0.
// Beide sind gruen, waehrend die Anzeige falsch ist. Ein Beleg, der weniger prueft, als er zu
// pruefen vorgibt. Dieser Waechter prueft deshalb die AUFLOESUNG, nicht den Namen.
//
// `tests/i18n/nl-completeness.test.ts` deckt das NICHT ab: es prueft DE<->NL-Paritaet, also ob die
// Woerterbuecher zueinander passen — nicht, ob der CODE etwas benutzt, das es nirgends gibt.
//
// KEINE HARTKODIERTE LISTE: Schluessel und Statuswerte werden aus den echten Dateien gelesen.
// Eine abgeschriebene Liste pruefte die eigene Annahme statt des Bestands.
// ================================================================================================

const WURZEL = join(__dirname, "..", "..");
const I18N = join(WURZEL, "apps/web/src/i18n.ts");
const VIEWLOGIK = join(WURZEL, "apps/web/src/lib/importResultView.ts");
const KOMPONENTEN = join(WURZEL, "apps/web/src/components/confluence-import");

const i18nQuelle = readFileSync(I18N, "utf8");
const viewQuelle = readFileSync(VIEWLOGIK, "utf8");
const komponentenQuelle = readdirSync(KOMPONENTEN)
  .filter((d) => d.endsWith(".tsx"))
  .map((d) => readFileSync(join(KOMPONENTEN, d), "utf8"))
  .join("\n");

const w2Quelltext = `${viewQuelle}\n${komponentenQuelle}`;

/** Die drei Sprachbloecke aus der EINEN Woerterbuchdatei — Reihenfolge und Marker wie im Quelltext. */
const BLOCKMARKER: Record<string, string> = {
  de: "const de = {",
  en: "const en: typeof de = {",
  nl: "const nl: typeof de = {",
};

function woerterbuch(sprache: string): Map<string, string> {
  // AUFTRAG-83: Die Wurzel-tsconfig laeuft mit `noUncheckedIndexedAccess`, ein Zugriff auf einen
  // Datensatz liefert also `string | undefined`. Der Buildfehler TS2345 stand genau hier.
  //
  // Bewusst eine echte LAUFZEITPRUEFUNG und keine Assertion: `as string` oder `!` haetten den
  // Compiler beruhigt und einen unbekannten Sprachschluessel trotzdem bis in `indexOf(undefined)`
  // durchgelassen — dort waere daraus ein sinnloses „Sprachblock nicht auffindbar" geworden.
  //
  // AUFTRAG-93 (BEN 86): der `undefined`-Vergleich allein REICHTE NICHT. `BLOCKMARKER` ist ein
  // normales Objektliteral und erbt von `Object.prototype`; `toString`, `constructor` und
  // `__proto__` liefern deshalb einen WERT statt `undefined`, betreten den Guard nicht und landen
  // in derselben irrefuehrenden Meldung, die er verhindern sollte.
  //
  // Zwei Riegel statt einem, und jeder faengt etwas anderes:
  //   · `Object.hasOwn` — nur EIGENE Eigenschaften zaehlen; das schliesst die gesamte
  //     Prototypenkette aus, nicht nur die drei heute bekannten Namen.
  //   · `typeof … !== "string"` — was trotzdem durchkaeme, ist kein Marker; zugleich die Verengung
  //     auf `string`, die der Compiler braucht.
  const marker = Object.hasOwn(BLOCKMARKER, sprache) ? BLOCKMARKER[sprache] : undefined;
  if (typeof marker !== "string") {
    throw new Error(
      `${I18N}: unbekannter Sprachschluessel „${sprache}" — bekannt sind ${Object.keys(BLOCKMARKER).join(", ")}`,
    );
  }
  const start = i18nQuelle.indexOf(marker);
  if (start < 0) {
    throw new Error(`${I18N}: Sprachblock „${marker}" nicht auffindbar`);
  }
  const ende = i18nQuelle.indexOf("\n};", start);
  const block = i18nQuelle.slice(start, ende);
  const treffer = new Map<string, string>();
  // Einzeiler `"key": "wert",` UND mehrzeilige Werte (`"key":\n  "wert"`) — beide kommen vor.
  for (const m of block.matchAll(/^ {2}"([^"]+)":\s*(?:\n\s*)?"((?:[^"\\]|\\.)*)"/gm)) {
    treffer.set(m[1] as string, m[2] as string);
  }
  return treffer;
}

/**
 * AUFTRAG-105 (Korrekturvertrag BEN 103 §2): erfasst die Meldung EINMAL, damit ein Fall die
 * VOLLSTAENDIGE Zeichenkette vergleichen kann statt einzelner Teilstuecke.
 *
 * Wirft der Aufruf wider Erwarten NICHT, faellt diese Hilfe selbst laut auf. Ohne diesen Zweig
 * ginge ein ausbleibender Fehler still als „nichts zu vergleichen" durch — genau die Sorte
 * Beleg, die weniger prueft, als sie zu pruefen vorgibt.
 */
function fehlermeldung(sprache: string): string {
  try {
    woerterbuch(sprache);
  } catch (fehler) {
    return fehler instanceof Error ? fehler.message : String(fehler);
  }
  throw new Error(
    `woerterbuch("${sprache}") hat KEINEN Fehler geworfen — erwartet war die Unknown-Meldung.`,
  );
}

/**
 * Die Sollmeldung, buchstabengetreu aus Korrekturvertrag BEN 103 §4.2 — bewusst NICHT aus
 * `BLOCKMARKER` abgeleitet. Eine Ableitung wuerde jeder kuenftigen Aenderung der Sprachliste
 * stillschweigend folgen und damit genau die Zusicherung aufweichen, die hier gepinnt wird:
 * Pfad, Ursache, konkreter Schluessel in typografischen Anfuehrungszeichen, Gedankenstrich und
 * die Reihenfolge de, en, nl.
 */
function unbekanntMeldung(sprache: string): string {
  return `${I18N}: unbekannter Sprachschluessel „${sprache}" — bekannt sind de, en, nl`;
}

const SPRACHEN = Object.keys(BLOCKMARKER);
const WOERTERBUECHER = new Map(SPRACHEN.map((s) => [s, woerterbuch(s)]));

/**
 * Die neun Laufzustaende — GELESEN aus `IMPORT_RUN_STATUS`, nicht abgeschrieben. Waeren sie hier
 * als Liste hinterlegt, pruefte der Test seine eigene Annahme statt des ausgelieferten Bestands.
 */
function laufzustaende(): string[] {
  const block = /IMPORT_RUN_STATUS\s*=\s*\[([\s\S]*?)\]/.exec(viewQuelle);
  if (!block) {
    throw new Error(`${VIEWLOGIK}: IMPORT_RUN_STATUS ist nicht auffindbar`);
  }
  const werte = [...(block[1] as string).matchAll(/"([A-Z_]+)"/g)].map((m) => m[1] as string);
  if (werte.length === 0) {
    throw new Error(`${VIEWLOGIK}: IMPORT_RUN_STATUS ist leer`);
  }
  return werte;
}

/**
 * Alle w2-Schluessel, die die Flaeche wirklich verwendet:
 *   · literal im Quelltext (`t("w2.…")`, `labelKey: "w2.…"`),
 *   · dynamisch gebildet (`` `w2.run.status.${status}` ``) — je Praefix mal alle neun Zustaende.
 *
 * Die dynamische Spur ist der Grund, warum eine reine Literalsuche in Preflight 78 achtzehn
 * Schluessel faelschlich als „unbenutzt" ausgewiesen hat.
 */
function verwendeteSchluessel(): string[] {
  const literal = [...w2Quelltext.matchAll(/"(w2\.[A-Za-z.]+)"/g)].map((m) => m[1] as string);
  const praefixe = [...w2Quelltext.matchAll(/`(w2\.[A-Za-z.]+)\$\{/g)].map((m) => m[1] as string);
  const zustaende = laufzustaende();
  const dynamisch = praefixe.flatMap((p) => zustaende.map((z) => `${p}${z}`));
  return [...new Set([...literal, ...dynamisch])].sort();
}

const VERWENDET = verwendeteSchluessel();

describe("AUFTRAG-81: jeder von der W2-Flaeche verwendete i18n-Schluessel loest auf", () => {
  it("die Erhebung selbst traegt: Schluessel, Praefixe und Zustaende sind gefunden", () => {
    // Ohne diese Kontrolle koennte ein leerer Auszug den ganzen Waechter still gruen faerben.
    expect(VERWENDET.length, "keine w2-Schluessel im Quelltext gefunden").toBeGreaterThan(20);
    expect(laufzustaende().length, "IMPORT_RUN_STATUS wurde nicht ausgelesen").toBeGreaterThan(5);
    expect(
      VERWENDET.some((k) => k.startsWith("w2.run.status.")),
      "die dynamisch gebildeten Statusschluessel fehlen in der Erhebung",
    ).toBe(true);
    expect(
      VERWENDET.some((k) => k.startsWith("w2.run.hint.")),
      "die dynamisch gebildeten Hinweisschluessel fehlen in der Erhebung",
    ).toBe(true);
  });

  for (const sprache of SPRACHEN) {
    it(`${sprache}: kein verwendeter Schluessel fehlt`, () => {
      const buch = WOERTERBUECHER.get(sprache) as Map<string, string>;
      const fehlend = VERWENDET.filter((k) => !buch.has(k));
      expect(
        fehlend,
        `Diese Schluessel werden von der W2-Flaeche benutzt, stehen aber nicht im ${sprache}-Woerterbuch. i18next gibt dann den Schluessel selbst aus — der Nutzer saehe rohen Text.`,
      ).toEqual([]);
    });

    it(`${sprache}: kein verwendeter Schluessel traegt einen leeren oder rohen Wert`, () => {
      const buch = WOERTERBUECHER.get(sprache) as Map<string, string>;
      const untauglich = VERWENDET.filter((k) => {
        const wert = buch.get(k);
        if (wert === undefined) {
          return false; // fehlende Schluessel meldet der Fall darueber — hier keine Doppelmeldung
        }
        return wert.trim().length === 0 || wert.trim() === k;
      });
      expect(
        untauglich,
        "Ein leerer Wert oder ein Wert, der wortgleich der Schluessel ist, ist kein Nutzertext.",
      ).toEqual([]);
    });
  }

  // ----------------------------------------------------------------------------------------------
  // AUFTRAG-93 (BEN 86, technisches ROT) — UNBEKANNT IST NICHT DASSELBE WIE `undefined`.
  //
  // Freeze 83 sicherte zu, ein unbekannter Sprachschluessel scheitere „laut und benennbar". Fuer
  // `xx` stimmte das. BEN 86 hat gezeigt, dass es fuer von `Object.prototype` GEERBTE Namen NICHT
  // stimmt: `BLOCKMARKER["toString"]` liefert die native Funktion, `constructor` den Konstruktor,
  // `__proto__` das Prototypobjekt. Keiner dieser Werte ist `undefined`, der Guard wurde also gar
  // nicht betreten — und heraus kam
  //     Sprachblock „function toString() { [native code] }" nicht auffindbar
  // also eine Meldung, die auf die FALSCHE Ursache zeigt.
  //
  // Deshalb steht hier je Schluessel ein EIGENER Fall statt einer Schleife: faellt einer, sagt der
  // Testname sofort welcher.
  //
  // AUFTRAG-105 (BEN 99: Testvertrag ROT · Korrekturvertrag BEN 103) — TEILSTRINGS REICHEN NICHT.
  //
  // Freeze 93 prueft je unbekanntem Schluessel drei Teilbedingungen: /unbekannter Sprachschluessel/,
  // /de, en, nl/ und NICHT /nicht auffindbar/. BEN 99 hat unabhaengig belegt, dass diese drei
  // zusammen eine Meldung OHNE den konkreten Eingabeschluessel NICHT stoppen. Gegen die Mutation
  //     ${I18N}: unbekannter Sprachschluessel — bekannt sind de, en, nl
  // blieben alle 15 eingefrorenen Faelle gruen, obwohl die Fallidentitaet verloren war. Das ist
  // derselbe Fehler, den dieser Waechter oben anderen Tests vorhaelt: er prueft weniger, als er
  // zu pruefen vorgibt.
  //
  // Deshalb jetzt VOLLSTAENDIGE Stringgleichheit gegen `unbekanntMeldung`. Sie ersetzt die drei
  // alten Teilbedingungen nicht aus Nachlaessigkeit, sondern weil sie echte TEILMENGEN davon ist:
  // eine Zeichenkette, die der Sollmeldung exakt gleicht, nennt die Ursache, traegt die Sprachliste
  // in der Reihenfolge de, en, nl und enthaelt „nicht auffindbar" nicht.
  // ----------------------------------------------------------------------------------------------
  for (const fremd of ["xx", "toString", "constructor", "__proto__"]) {
    it(`unbekannter Sprachschluessel „${fremd}" meldet vollstaendig und mit Fallidentitaet`, () => {
      expect(fehlermeldung(fremd)).toBe(unbekanntMeldung(fremd));
    });
  }

  // Der FUENFTE Unknown-Fall, und der einzige, den die vier oben nicht zeigen koennen: ein Marker,
  // den es zur Uebersetzungszeit gar nicht gibt, sondern der erst ZUR LAUFZEIT an
  // `Object.prototype` gehaengt wird — mit einem Wert, der ein ECHTER Sprachblockmarker ist.
  //
  // Warum das schaerfer ist als `toString` und Co.: deren Werte sind Funktionen bzw. Objekte, ein
  // unsicherer Waechter liefe damit in ein sinnloses „Sprachblock nicht auffindbar". Hier dagegen
  // faende ein Waechter ohne `Object.hasOwn` ein GUELTIGES Woerterbuch und liefe stillschweigend
  // weiter — der Fehler waere unsichtbar statt nur falsch beschriftet.
  const GEERBTER_MARKER = "ben103GeerbterMarker";
  const GEERBTER_WERT = BLOCKMARKER.de; // wirklich der DE-Blockmarker, kein erfundener Wert

  it(`unbekannter Sprachschluessel „${GEERBTER_MARKER}" wird auch als GEERBTER Marker abgewiesen`, () => {
    Object.defineProperty(Object.prototype, GEERBTER_MARKER, {
      configurable: true,
      value: GEERBTER_WERT,
    });
    try {
      // Ohne diese zwei Kontrollen waere der Fall wirkungslos, falls die Vergiftung nicht griffe:
      // er pruefte dann nur, dass ein voellig unbekannter Name scheitert — das tut „xx" bereits.
      expect(BLOCKMARKER[GEERBTER_MARKER], "die Vergiftung greift nicht").toBe(GEERBTER_WERT);
      expect(
        Object.hasOwn(BLOCKMARKER, GEERBTER_MARKER),
        "der Marker muss GEERBT sein, nicht eigen",
      ).toBe(false);

      expect(fehlermeldung(GEERBTER_MARKER)).toBe(unbekanntMeldung(GEERBTER_MARKER));
    } finally {
      Reflect.deleteProperty(Object.prototype, GEERBTER_MARKER);
    }

    // Das Aufraeumen wird SELBST geprueft: bliebe der Prototyp verschmutzt, haenge jeder Folgetest
    // an einem Zustand, den dieser Fall hinterlassen hat — und niemand saehe es.
    expect(GEERBTER_MARKER in BLOCKMARKER, "der Prototyp blieb verschmutzt").toBe(false);
    expect(BLOCKMARKER[GEERBTER_MARKER]).toBeUndefined();
  });

  for (const sprache of SPRACHEN) {
    it(`die echte Sprache „${sprache}" geht positiv durch`, () => {
      // Einzelbelege statt Schleife im selben Fall: eine gebrochene Sprache soll namentlich auffallen.
      expect(() => woerterbuch(sprache)).not.toThrow();
      expect(woerterbuch(sprache).size, `${sprache}: leeres Woerterbuch`).toBeGreaterThan(0);
    });
  }

  it("die zwei Schluessel aus Preflight 78 sind namentlich abgedeckt", () => {
    // Namentlich, weil genau sie der Anlass dieses Auftrags sind: verschwaende der Erhebungspfad
    // sie kuenftig, faellt es hier auf und nicht erst in der Oberflaeche.
    for (const schluessel of ["w2.value.missing", "w2.value.none"]) {
      expect(VERWENDET, `${schluessel} wird nicht mehr als verwendet erkannt`).toContain(
        schluessel,
      );
      for (const sprache of SPRACHEN) {
        const wert = (WOERTERBUECHER.get(sprache) as Map<string, string>).get(schluessel);
        expect(wert, `${schluessel} fehlt in ${sprache}`).toBeDefined();
        expect((wert ?? "").trim().length, `${schluessel} ist in ${sprache} leer`).toBeGreaterThan(
          0,
        );
      }
    }
  });
});
