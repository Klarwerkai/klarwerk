// ================================================================================================
// JOB 4357 · DER ZEUGE ÜBER DEN LISTENWEG — ER LÄUFT IM TOR, OHNE DATENBANK UND OHNE BROWSER.
// ================================================================================================
//
// WARUM ES IHN GIBT. Der Nachweis nebenan (`liste-nach-prozesswechsel.integration.test.ts`) macht
// fünf Zusagen, die man ihm von aussen nicht ansieht — und die genau dann nicht messbar sind, wenn
// sie gebraucht werden: auf einer Maschine ohne PostgreSQL und ohne Chromium.
//
//   (i)   Er überspringt NIE STILL. Fehlt PostgreSQL oder Chromium, steht der Grund auf stderr, und
//         ein übersprungener Lauf zählt nicht als bestanden (`../wiki-gesamtanweisung-abnahme/
//         laufzustand.ts`, Pedi wörtlich: „Erforderliche Fälle dürfen nicht durch Skip grün
//         erscheinen").
//   (ii)  Er bedient KEIN EINZIGES Element mit der Maus. Ein Mausklick nähme dem Tastaturnachweis
//         den Boden: BEN hat an JOB 4223 R1 gemessen, dass ein Fall mit `tabIndex={-1}` am Produkt
//         GRÜN blieb, weil ein Klick den Weg trug.
//   (iii) Sein Neustart ist ein ECHTER PROZESSWECHSEL — `spawn`, `server.ts`, SIGTERM — und keine
//         prozessinterne Abkürzung.
//   (iv)  Er misst `document.activeElement` VOR dem Öffnen und die Adresse DANACH. Genau das
//         verlangt Abnahmekriterium 2, und ohne beide Messungen wäre „Enter öffnet genau diese
//         Anweisung" eine Behauptung über einen Zufall.
//   (v)   Er stellt die gebaute Fläche FRISCH her. Ein vorhandenes, älteres `apps/web/dist` kennt die
//         Bestandsliste nicht — ein Nachweis darauf sagte über den heutigen Quellstand nichts.
//
// Dazu kommt die Kalibrierung: vier Verstellungen, abschaltbar, jede mit ihrer eigenen Zeile.
//
// ER IMPORTIERT BEWUSST NICHTS AUS `./weg.ts` ODER `./liste-weg.ts`: deren Importhülle berührt
// Playwright, und die Browser-Gruppe des Tors wird aus genau diesem Importgraphen berechnet
// (`tests/tor-inventar/browser-gruppe.ts`). Ein Zeuge, der deswegen in die serielle Browser-Gruppe
// rutschte, kostete Laufzeit für nichts — er liest Dateien.
//
// ER PRÜFT DEN CODE UND NICHT DIE KOMMENTARE, und das ist keine Feinheit: dieses Haus schreibt
// ausführliche Begründungen, und in ihnen stehen die verbotenen Formen ausgeschrieben da (dieser Kopf
// nennt sie selbst). Eine rohe Textsuche träfe die Erklärung statt der Sache. Dasselbe Vorgehen und
// dieselbe Begründung wie in `zeuge-kein-klick-kein-stiller-skip.test.ts`.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";

const NACHWEIS = "tests/gesamtanweisung-nutzerweg/liste-nach-prozesswechsel.integration.test.ts";
const STATIONEN = "tests/gesamtanweisung-nutzerweg/liste-weg.ts";
const KALIBRIERUNG = "tests/gesamtanweisung-nutzerweg/liste-kalibrierung.integration.test.ts";

/**
 * Der Quelltext OHNE Kommentare.
 *
 * Entfernt werden Blockkommentare (also auch jedes JSDoc) und Zeilen, die mit `//` BEGINNEN. Bewusst
 * nicht jedes `//` mitten in einer Zeile: `http://127.0.0.1` ist kein Kommentar, und ein Stripper,
 * der es dafür hielte, schnitte die halbe Datei weg. Dass die drei Dateien sich an die Hausform
 * halten (Kommentare auf eigenen Zeilen), misst der erste Fall unten.
 */
function ohneKommentare(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((zeile) => !zeile.trimStart().startsWith("//"))
    .join("\n");
}

const QUELLE = ohneKommentare(readFileSync(NACHWEIS, "utf8"));
const WEG = ohneKommentare(readFileSync(STATIONEN, "utf8"));
const KAL = ohneKommentare(readFileSync(KALIBRIERUNG, "utf8"));

describe("JOB 4357 · der Zeuge über den Listenweg: kein Klick, kein stiller Skip, ein echter Prozess", () => {
  it("die Kommentare stehen auf eigenen Zeilen — sonst prüfte der Zeuge die Erklärung statt der Sache", () => {
    for (const [name, text] of [
      [NACHWEIS, readFileSync(NACHWEIS, "utf8")],
      [STATIONEN, readFileSync(STATIONEN, "utf8")],
      [KALIBRIERUNG, readFileSync(KALIBRIERUNG, "utf8")],
    ] as const) {
      const ohneBloecke = text.replace(/\/\*[\s\S]*?\*\//g, "");
      const nachgestellt = ohneBloecke
        .split("\n")
        .filter((z) => /\S/.test(z) && !z.trimStart().startsWith("//"))
        .filter((z) => / \/\/ /.test(z) && !z.includes("://"));
      expect(
        nachgestellt,
        `${name} trägt nachgestellte Kommentare — der Zeuge könnte sie nicht von Code unterscheiden`,
      ).toEqual([]);
    }
  });

  it("der Nachweis meldet seinen Laufzustand — und ein Skip zählt nicht als bestanden", () => {
    // Die Regel selbst, funktional: sie muss auch ohne Datenbank und ohne Browser messbar sein.
    expect(zaehltAlsBestanden({ gelaufen: true, quelle: "127.0.0.1:5432/klarwerk_test" })).toBe(
      true,
    );
    expect(
      zaehltAlsBestanden({ gelaufen: false, grund: "kein Chromium" } as Laufzustand),
      "ein Skip gilt als bestanden — genau das verbietet Pedis Satz",
    ).toBe(false);
    expect(zaehltAlsBestanden(undefined), "ein Lauf ohne Aufbau gilt als bestanden").toBe(false);
    expect(befundsatz("JOB 4357", { gelaufen: false, grund: "kein Chromium" })).toContain(
      "NICHT belegt",
    );

    // Und der Nachweis ruft sie WIRKLICH — sonst wäre sie gebaut, richtig und wirkungslos.
    expect(QUELLE, `${NACHWEIS} ruft die Regel nicht`).toContain("zaehltAlsBestanden");
    expect(QUELLE, `${NACHWEIS} schreibt keinen Befundsatz`).toContain("befundsatz(MARKE");
    expect(QUELLE, `${NACHWEIS} meldet den Grund nicht auf stderr`).toContain(
      "process.stderr.write(befundsatz(",
    );
    const skips = QUELLE.match(/ctx\.skip\(\)/g) ?? [];
    expect(skips.length, "kein einziger Skip-Zweig — dann prüft dieser Fall nichts").toBe(1);
    for (const stelle of QUELLE.split("ctx.skip()").slice(0, -1)) {
      expect(
        stelle.slice(-400),
        "der Skip-Zweig hängt nicht an der gemeinsamen Verfügbarkeitsbedingung",
      ).toContain("!verfuegbar");
    }
    const zeuge = QUELLE.slice(QUELLE.indexOf('it("4357z'));
    expect(zeuge.length, "der Zeugenfall 4357z fehlt im Nachweis").toBeGreaterThan(0);
    expect(
      zeuge,
      "der Zeuge im Nachweis kann selbst übersprungen werden — dann bezeugt er nichts",
    ).not.toContain("ctx.skip()");
  });

  it("kein Mausklick — weder im Nachweis noch in den Stationen noch in der Kalibrierung", () => {
    for (const [name, text] of [
      [NACHWEIS, QUELLE],
      [STATIONEN, WEG],
      [KALIBRIERUNG, KAL],
    ] as const) {
      const treffer = text.match(/\.click\(/g) ?? [];
      expect(
        treffer.length,
        `${name} bedient ${treffer.length}× etwas mit der Maus — der Tastaturnachweis trüge dann nicht`,
      ).toBe(0);
    }
    // Und der Weg wird WIRKLICH mit der Tastatur gegangen.
    for (const helfer of ["tabBisZu", 'keyboard.press("Enter")', "fokusMussSichtbarSein"]) {
      expect(WEG, `${STATIONEN} benutzt ${helfer} nicht`).toContain(helfer);
    }
    expect(QUELLE, `${NACHWEIS} geht den Menüweg nicht über die Tastatur`).toContain(
      "menuewegOhneMaus(",
    );
  });

  it("der Neustart ist ein echter Prozesswechsel — spawn und SIGTERM, keine Abkürzung im Prozess", () => {
    expect(QUELLE, `${NACHWEIS} startet keinen eigenen Prozess`).toContain("spawn(");
    expect(QUELLE, `${NACHWEIS} startet nicht services/app/src/server.ts`).toContain(
      "services/app/src/server.ts",
    );
    expect(QUELLE, `${NACHWEIS} beendet den Prozess nicht mit SIGTERM`).toContain(
      'prozess.kill("SIGTERM")',
    );
    expect(QUELLE, `${NACHWEIS} belegt den toten Socket nicht`).toContain("/health");
    for (const abkuerzung of ["starteStrecke(", "buildApp(", "app.inject(", "mitFlaeche("]) {
      expect(
        QUELLE,
        `${NACHWEIS} nimmt mit ${abkuerzung} die prozessinterne Abkürzung — dann ist der Neustart keiner`,
      ).not.toContain(abkuerzung);
    }
  });

  // ==============================================================================================
  // DER TASTATURWEG WIRD GEMESSEN, NICHT BEHAUPTET (Abnahmekriterium 2).
  // ==============================================================================================
  it("`document.activeElement` VOR dem Öffnen und die Adresse DANACH — beide Messungen stehen da", () => {
    expect(WEG, `${STATIONEN} liest document.activeElement nicht`).toContain(
      "document.activeElement",
    );
    // Der Befund wird VOR dem Enter genommen. Stünde er danach, wäre er eine Aussage über die
    // geöffnete Seite und nicht über den Weg dorthin.
    expect(
      WEG.indexOf("const aktivVorher = await aktivbefund(seite)"),
      `${STATIONEN} nimmt den Fokusbefund nicht als eigenen Schritt`,
    ).toBeGreaterThan(-1);
    expect(
      WEG.indexOf("const aktivVorher = await aktivbefund(seite)") <
        WEG.indexOf('seite.keyboard.press("Enter")'),
      `${STATIONEN} misst den Fokus erst NACH dem Enter — dann sagt er nichts über den Weg`,
    ).toBe(true);
    // Und es wird wirklich der Eintrag DIESER Anweisung geprüft, nicht „irgendein Link".
    expect(WEG, `${STATIONEN} prüft die Kennung des fokussierten Eintrags nicht`).toContain(
      "aktivVorher.anweisung",
    );
    expect(WEG, `${STATIONEN} prüft die Adresse des fokussierten Eintrags nicht`).toContain(
      "aktivVorher.href",
    );
    // Die Adresse NACH dem Enter kommt vom Browser und nicht aus einer Zusage.
    expect(WEG, `${STATIONEN} liest die Adresse nach dem Enter nicht am Browser`).toContain(
      "adresseNachher: seite.url()",
    );
    expect(QUELLE, `${NACHWEIS} prüft die Adresse nach dem Enter nicht`).toContain(
      "adresseNachher",
    );
  });

  // ==============================================================================================
  // SICHTBAR HEISST SICHTBAR — DIE MESSUNG IST DIE DES HAUSES UND KEIN NACHBAU (REGELN.md 9).
  // ==============================================================================================
  it("die Zeile wird SICHTBAR gemessen — über `mussSichtbarTragen`, nicht über Anwesenheit", () => {
    expect(WEG, `${STATIONEN} misst die Sichtbarkeit nicht mit der Hausfunktion`).toContain(
      "mussSichtbarTragen(",
    );
    // KEIN eigener Sichtbarkeitsbegriff: ein Nachbau hier wäre die zweite Auslegung derselben Frage,
    // und genau daran ist JOB 4295 dreimal gescheitert.
    for (const nachbau of ["checkVisibility", "getClientRects", "createTreeWalker"]) {
      expect(
        WEG,
        `${STATIONEN} baut die Sichtbarkeitsmessung mit ${nachbau} selbst nach — sie wohnt in ./weg.ts`,
      ).not.toContain(nachbau);
    }
    // Titel UND Stand werden GETRENNT gemessen: ein Titel ohne Stand wäre eine halbe Zeile.
    const zeile = WEG.slice(WEG.indexOf("export async function zeileMussSichtbarSein"));
    expect(zeile.length, "zeileMussSichtbarSein fehlt").toBeGreaterThan(0);
    expect(
      (zeile.match(/mussSichtbarTragen\(/g) ?? []).length,
      "der Titel und der Stand werden nicht getrennt gemessen",
    ).toBe(2);
  });

  it("die gebaute Fläche wird FRISCH hergestellt — ein altes Bündel kennt die Liste nicht", () => {
    expect(WEG, `${STATIONEN} fragt die Frische des Bündels nicht`).toContain("bewerteFrische");
    expect(WEG, `${STATIONEN} sammelt die Zeitstempel nicht über die Hausfunktion`).toContain(
      "sammleFrische",
    );
    expect(QUELLE, `${NACHWEIS} stellt die Fläche nicht frisch her`).toContain(
      "stelleFrischeFlaecheBereit()",
    );
    // Die Fläche wird VOR dem Browser hergestellt: nur so ist ein gescheiterter Browserstart
    // eindeutig ein Browserbefund und kein verdeckter dist-Mangel.
    expect(QUELLE.indexOf("stelleFrischeFlaecheBereit()")).toBeLessThan(
      QUELLE.indexOf("starteBrowserOderBefund("),
    );
    expect(
      QUELLE,
      `${NACHWEIS} startet Chromium ungeschützt — ein Wurf risse den Aufbau mit`,
    ).not.toContain("await starteChromium()");
  });

  it("die Kalibrierung ist abschaltbar und führt ihre vier Verstellungen wirklich", () => {
    expect(KAL, `${KALIBRIERUNG} hängt an keinem Schalter`).toContain("KLARWERK_KALIBRIERUNG");
    expect(KAL, `${KALIBRIERUNG} meldet ihren Übersprung nicht sichtbar`).toContain(
      "process.stderr.write(befundsatz(",
    );
    for (const fall of ["L1 —", "L2 —", "L3 —", "L4 —"]) {
      expect(KAL, `${KALIBRIERUNG} führt ${fall} nicht`).toContain(fall);
    }
    for (const [was, muster] of [
      [
        "L1 blendet die Zeile nicht aus",
        '[data-testid="ga-liste-eintrag"]{display:none !important}',
      ],
      [
        "L2 macht die Schrift des Eintrags nicht durchsichtig",
        '[data-testid="ga-liste-oeffnen"]{color: transparent !important}',
      ],
      ["L3 nimmt den Eintrag nicht aus der Tab-Reihe", '"tabindex", "-1"'],
      ["L4 löscht den Bestand nicht", "DELETE FROM gesamtanweisungen"],
    ] as const) {
      expect(KAL, `${KALIBRIERUNG}: ${was}`).toContain(muster);
    }
    // L3 und L4 messen VOR ihrer Verstellung die unverstellte Lage — sonst sagte ihr Rot nichts über
    // die Verstellung, sondern nur über einen Aufbau, der schon vorher nicht trug.
    const l3 = KAL.slice(KAL.indexOf('it("L3 —'));
    expect(l3.length, "L3 fehlt in der Kalibrierung").toBeGreaterThan(0);
    expect(l3, "L3 misst die Sichtbarkeit der Zeile nicht vor der Tastaturprobe").toContain(
      '"L3 (vor der Tastaturprobe)"',
    );
    const l4 = KAL.slice(KAL.indexOf('it("L4 —'));
    expect(l4.length, "L4 fehlt in der Kalibrierung").toBeGreaterThan(0);
    expect(
      l4.indexOf('"L4 (vor dem Prozessneustart)"') < l4.indexOf("DELETE FROM gesamtanweisungen"),
      "L4 löscht den Bestand, bevor er die unverstellte Lage gemessen hat",
    ).toBe(true);
    // Und die Kalibrierung fährt DIESELBEN Stationen wie der Nachweis — keine Kopie davon.
    for (const station of [
      "zeileMussSichtbarSein",
      "eintragOeffnenMitTastatur",
      "menuewegOhneMaus",
    ]) {
      expect(KAL, `${KALIBRIERUNG} fährt ${station} nicht`).toContain(station);
    }
  });
});
