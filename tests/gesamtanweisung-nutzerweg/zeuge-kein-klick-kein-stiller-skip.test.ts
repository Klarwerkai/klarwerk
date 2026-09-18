// ================================================================================================
// JOB 4323 · DER ZEUGE — ER LÄUFT IM TOR, OHNE DATENBANK UND OHNE BROWSER.
// ================================================================================================
//
// WARUM ES IHN GIBT. Der Nachweis nebenan
// (`menueweg-tastatur-sprachen-prozess.integration.test.ts`) macht sechs Zusagen, die man ihm von
// aussen nicht ansieht:
//
//   (i)   Er überspringt NIE STILL. Fehlt PostgreSQL oder Chromium, steht der Grund auf stderr, und
//         ein übersprungener Lauf zählt nicht als bestanden (`../wiki-gesamtanweisung-abnahme/
//         laufzustand.ts`, Pedi wörtlich in `EINGANG-20260917-PRO-OFFICE-PG-0708.md:5`).
//   (ii)  Er bedient KEIN EINZIGES Element mit der Maus. Ein Mausklick — sei es über die Seite, sei
//         es aus `evaluate` heraus — nähme dem ganzen Tastaturnachweis den Boden: BEN hat an JOB
//         4223 R1 gemessen, dass ein Fall mit `tabIndex={-1}` am Produkt GRÜN blieb, weil ein Klick
//         den Weg trug (`tests/gast-nutzerweg/browserweg.ts:20-31`).
//   (iii) Sein Neustart ist ein ECHTER PROZESSWECHSEL und kein zweiter Anwendungsaufbau im selben
//         Node-Prozess. Genau das war die benannte Grenze von JOB 4309
//         (`archiv/4309/runde-1/RUECKGABE.md`, REST) und von `a5-neustart.integration.test.ts:11`.
//   (iv)  Die Sprache wird über den Schalter der App GEWECHSELT und nicht über den Browserspeicher
//         vorgesetzt — die Halbheit, die Prüfpunkt 4 des Auftrags ausdrücklich ausschliesst.
//   (v)   Die BAUSTEINE werden sichtbar geprüft und nicht gezählt. Das ist der Befund, mit dem BEN
//         Runde 1 rot gemacht hat: er hat ihnen `opacity: 0` gegeben, und die ganze Strecke blieb
//         grün, weil sie DOM-Elemente zählte und `data-baustein` las. Der alte Weg muss FORT sein,
//         nicht danebenstehen, und die neue Prüfung muss VOR und NACH dem Neustart laufen.
//   (vi)  Fehlendes Chromium ist ein benannter Übersprung — und ein fehlendes `apps/web/dist` ist
//         ein anderer Fehler und wird weitergeworfen. Runde 1 hatte das nur in der Rückgabe stehen.
//
// Alle sechs Zusagen sind genau dann nicht messbar, wenn sie gebraucht werden — auf einer Maschine
// ohne PostgreSQL und ohne Chromium. Deshalb prüft dieser Fall sie hier: (i)–(v) am QUELLTEXT und
// (vi) FUNKTIONAL an der Regel selbst, im Tor, bei jedem Lauf. Dasselbe Muster wie
// `../wiki-gesamtanweisung-abnahme/a9-skip-zaehlt-nicht.test.ts:25-26`.
//
// ER IMPORTIERT BEWUSST NICHTS AUS `./weg.ts`: dessen Importhülle berührt Playwright, und die
// Browser-Gruppe des Tors wird aus genau diesem Importgraphen berechnet
// (`tests/tor-inventar/browser-gruppe.ts`). Ein Zeuge, der deswegen in die serielle Browser-Gruppe
// rutschte, kostete Laufzeit für nichts — er liest Dateien. Aus demselben Grund wohnt die
// Chromium-Regel in `./browserbefund.ts` und nicht in `./weg.ts`: sie ist der einzige Import hier,
// und sie zieht nichts mit.
//
// ER PRÜFT DEN CODE UND NICHT DIE KOMMENTARE, und das ist keine Feinheit: dieses Haus schreibt
// ausführliche Begründungen, und in ihnen stehen die verbotenen Formen ausgeschrieben da (dieser
// Kopf nennt sie selbst). Eine rohe Textsuche träfe die Erklärung statt der Sache — dieselbe Lehre,
// die `tests/tor-inventar/browser-gruppe.ts:20-29` für die Browser-Gruppe gezogen hat.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";
import { KEIN_BROWSER, hatBrowser, starteBrowserOderBefund } from "./browserbefund";

const NACHWEIS =
  "tests/gesamtanweisung-nutzerweg/menueweg-tastatur-sprachen-prozess.integration.test.ts";
const STATIONEN = "tests/gesamtanweisung-nutzerweg/weg.ts";
const KALIBRIERUNG = "tests/gesamtanweisung-nutzerweg/menueweg-kalibrierung.integration.test.ts";

/**
 * Der Quelltext OHNE Kommentare.
 *
 * Entfernt werden Blockkommentare (`/* … *\/`, also auch jedes JSDoc) und Zeilen, die mit `//`
 * BEGINNEN. Bewusst nicht jedes `//` mitten in einer Zeile: `http://127.0.0.1` ist kein Kommentar,
 * und ein Stripper, der es dafür hielte, schnitte die halbe Datei weg. Die drei Dateien halten sich
 * deshalb an die Hausform — Kommentare stehen auf eigenen Zeilen; dass das so bleibt, misst der
 * Fall „kein nachgestellter Kommentar" unten.
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

describe("JOB 4323 · der Zeuge über den Menüweg: kein Klick, kein stiller Skip, ein echter Prozess", () => {
  it("die Kommentare stehen auf eigenen Zeilen — sonst prüfte der Zeuge die Erklärung statt der Sache", () => {
    // Ein nachgestelltes `// …` hinter Code bliebe im geprüften Text stehen und könnte eine
    // verbotene Form tragen. Die Zusicherung hält deshalb die Voraussetzung des Strippers fest.
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
    const gelaufen: Laufzustand = { gelaufen: true, quelle: "127.0.0.1:5432/klarwerk_test" };
    expect(zaehltAlsBestanden(gelaufen)).toBe(true);
    expect(
      zaehltAlsBestanden({ gelaufen: false, grund: "kein Chromium" }),
      "ein Skip gilt als bestanden — genau das verbietet Pedis Satz",
    ).toBe(false);
    expect(zaehltAlsBestanden(undefined), "ein Lauf ohne Aufbau gilt als bestanden").toBe(false);
    expect(befundsatz("JOB 4323", { gelaufen: false, grund: "kein Chromium" })).toContain(
      "NICHT belegt",
    );

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
    const zeuge = QUELLE.slice(QUELLE.indexOf('it("4323z'));
    expect(zeuge.length, "der Zeugenfall 4323z fehlt im Nachweis").toBeGreaterThan(0);
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
    for (const helfer of [
      "tabBisZu",
      "tabBisText",
      "tippeMitTastatur",
      'keyboard.press("Enter")',
    ]) {
      expect(WEG, `${STATIONEN} benutzt ${helfer} nicht`).toContain(helfer);
    }
  });

  it("der Neustart ist ein echter Prozesswechsel — spawn und SIGTERM, keine Abkürzung im Prozess", () => {
    expect(QUELLE, `${NACHWEIS} startet keinen eigenen Prozess`).toContain("spawn(");
    expect(QUELLE, `${NACHWEIS} startet nicht services/app/src/server.ts`).toContain(
      "services/app/src/server.ts",
    );
    expect(QUELLE, `${NACHWEIS} beendet den Prozess nicht mit SIGTERM`).toContain(
      'prozess.kill("SIGTERM")',
    );
    for (const abkuerzung of ["starteStrecke(", "buildApp(", "app.inject(", "mitFlaeche("]) {
      expect(
        QUELLE,
        `${NACHWEIS} nimmt mit ${abkuerzung} die prozessinterne Abkürzung — dann ist der Neustart keiner`,
      ).not.toContain(abkuerzung);
    }
    expect(WEG, `${STATIONEN} baut die Prozessumgebung nicht als Produktionslage`).toContain(
      'NODE_ENV: "production"',
    );
    expect(WEG, `${STATIONEN} reicht die Umgebung des Testprozesses durch`).not.toContain(
      "...process.env",
    );
  });

  it("die Sprache wird über den Schalter gewechselt, nicht über den Speicher vorgesetzt", () => {
    expect(WEG, `${STATIONEN} bedient den Sprachschalter nicht`).toContain("sprach-schalter-");
    expect(WEG, `${STATIONEN} setzt eine Sprachwahl in den Speicher`).not.toContain(
      "localStorage.setItem",
    );
    expect(QUELLE, `${NACHWEIS} setzt eine Sprachwahl in den Speicher`).not.toContain(
      "localStorage.setItem",
    );
    expect(QUELLE, `${NACHWEIS} holt die Sollwerte nicht aus dem Sprachbestand`).toContain(
      "sprachbestand(",
    );
  });

  it("die Kalibrierung ist abschaltbar — sie darf das Tor nicht dauerhaft rot färben", () => {
    expect(KAL, `${KALIBRIERUNG} hängt an keinem Schalter`).toContain("KLARWERK_KALIBRIERUNG");
    expect(KAL, `${KALIBRIERUNG} meldet ihren Übersprung nicht sichtbar`).toContain(
      "process.stderr.write(befundsatz(",
    );
    for (const fall of [
      "K1 —",
      "K2 —",
      "K3 —",
      "K4 —",
      "K5 —",
      "K6 —",
      "K7 —",
      "K8 —",
      "K9 —",
      "K10 —",
    ]) {
      expect(KAL, `${KALIBRIERUNG} führt ${fall} nicht`).toContain(fall);
    }
    expect(KAL, `${KALIBRIERUNG} blendet den Menüpunkt nicht aus (K1)`).toContain(
      "display:none !important",
    );
    expect(KAL, `${KALIBRIERUNG} nimmt den Menüpunkt nicht aus der Tab-Reihe (K2)`).toContain(
      '"tabindex", "-1"',
    );
    expect(KAL, `${KALIBRIERUNG} löscht den Bestand nicht (K4)`).toContain(
      "DELETE FROM gesamtanweisungen",
    );
    // K5 ist die ZWEITE Sichtbarkeitsprobe und nicht dieselbe wie K1: der Behälter bleibt sichtbar,
    // nur sein texttragendes Kind wird durchsichtig. REGELN.md 9 verlangt sie ausdrücklich, und
    // JOB 4295 ist an genau dieser Unterscheidung dreimal gescheitert.
    expect(KAL, `${KALIBRIERUNG} macht das texttragende Kind nicht durchsichtig (K5)`).toContain(
      "color: transparent !important",
    );
    // Und der Nachweis misst Sichtbarkeit wirklich je Textknoten, nicht am Behälter: Geometrie,
    // `visibility`, `opacity`, durchsichtige Schrift UND den übersprungenen Inhalt.
    for (const merkmal of [
      "getClientRects",
      "visibility",
      "opacity",
      "durchsichtig",
      "contentVisibility",
    ]) {
      expect(WEG, `${STATIONEN} misst ${merkmal} nicht`).toContain(merkmal);
    }
    // Und er geht wirklich in die Tiefe: ein `TreeWalker` über die TEXTKNOTEN. Ohne diesen Gang
    // wäre „sichtbar" wieder eine Aussage über einen Behälter statt über die Zeichen selbst.
    expect(WEG, `${STATIONEN} geht die Textknoten nicht einzeln durch`).toContain(
      "createTreeWalker",
    );
    expect(WEG, `${STATIONEN} filtert nicht auf Textknoten`).toContain("NodeFilter.SHOW_TEXT");
    // K6 bis K10 sind die fünf Verstellungen an den BAUSTEINEN — Behälter, texttragendes Kind,
    // BENs `opacity: 0` aus Runde 1, sein nicht gerenderter Herkunftsabsatz aus Runde 2 und sein
    // Name im durchsichtigen Kind aus Runde 3. Jede muss in der Datei stehen, sonst wäre die
    // Fachprüfung der Bausteine wieder unkalibriert.
    for (const [was, muster] of [
      ["K6 blendet den zweiten Baustein nicht aus", ":nth-of-type(2){display:none !important}"],
      [
        "K7 verbirgt sein texttragendes Kind nicht",
        ":nth-of-type(2) p{visibility:hidden !important}",
      ],
      [
        "K8 fährt BENs Gegenprobe aus Runde 1 nicht",
        '[data-testid="ga-lesestand-baustein"]{opacity:0 !important}',
      ],
      [
        "K9 fährt BENs Gegenprobe aus Runde 2 nicht",
        "content-visibility: hidden !important; contain-intrinsic-size: auto 24px !important",
      ],
      // K10 ist KEINE Stilregel, sondern eine DOM-Verstellung: der Textknoten wandert wirklich in
      // eine Hülle. Eine Stilregel könnte diese Lage gar nicht herstellen — der Name muss in einem
      // eigenen, durchsichtigen Kind landen, während der Absatz sichtbar bleibt.
      ["K10 legt keine durchsichtige Hülle an", 'huelle.style.opacity = "0"'],
      ["K10 verschiebt den Textknoten nicht in die Hülle", "huelle.appendChild(knoten)"],
      ["K10 nimmt die Verstellung nicht zurück", "VERSTELLUNG_ZURUECK"],
    ] as const) {
      expect(KAL, `${KALIBRIERUNG}: ${was}`).toContain(muster);
    }
    // K10 zeigt BEIDE Richtungen in EINEM Lauf: ohne Verstellung grün, mit ihr rot, nach der
    // Rücknahme wieder grün. Fehlte eine der beiden grünen Messungen, bewiese das Rot nur, dass die
    // Prüfung überhaupt rot werden kann — nicht, dass GENAU diese Verstellung sie rot macht.
    const k10 = KAL.slice(KAL.indexOf('it("K10 —'));
    expect(k10.length, "K10 fehlt in der Kalibrierung").toBeGreaterThan(0);
    for (const [was, muster] of [
      [
        "K10 prüft die Bausteine nicht unverstellt nach dem Neustart",
        '"nach dem Prozessneustart, vor der Verstellung"',
      ],
      ["K10 misst die Rücknahme nicht", '"nach der Rücknahme der Verstellung"'],
      ["K10 belegt nicht, dass die Hülle der Engine als unsichtbar gilt", "verstecktSichtbar"],
      ["K10 belegt nicht, dass der Absatz sichtbar bleibt", "absatzSichtbar"],
      [
        "K10 belegt nicht, dass der innerText des Absatzes den Namen weiterhin nennt",
        "absatzGerendert",
      ],
    ] as const) {
      expect(k10, `${KALIBRIERUNG}: ${was}`).toContain(muster);
    }
    expect(
      k10.indexOf("NAME_IN_DURCHSICHTIGES_KIND") >
        k10.indexOf('"nach dem Prozessneustart, vor der Verstellung"'),
      "K10 setzt die Verstellung vor der unverstellten Messung — dann sagt sein Rot nichts über sie",
    ).toBe(true);
    // K9 setzt die Verstellung NACH dem Neustart — so, wie BEN sie gemessen hat. Stünde sie im
    // Profil davor, wäre sie eine andere Probe und der Fall sagte nichts über die Wiederherstellung.
    const k9 = KAL.slice(KAL.indexOf('it("K9 —'));
    expect(k9.length, "K9 fehlt in der Kalibrierung").toBeGreaterThan(0);
    expect(
      k9.indexOf('bausteinePruefen(profil.seite, "vor dem Prozessneustart")'),
      "K9 prüft die Bausteine nicht schon VOR dem Neustart — dann sagt sein Rot nichts über den Neustart",
    ).toBeGreaterThan(-1);
    expect(
      k9.indexOf("HERKUNFTSABSATZ_NICHT_GERENDERT") >
        k9.indexOf('bausteinePruefen(profil.seite, "vor dem Prozessneustart")'),
      "K9 setzt die Verstellung schon vor dem Neustart — BEN hat sie danach gesetzt",
    ).toBe(true);
  });

  // ==============================================================================================
  // DIE BAUSTEINE — SICHTBAR GEPRÜFT, NICHT GEZÄHLT. (BEN, Runde 1, Korrekturpflicht 1)
  // ==============================================================================================
  it("die Bausteine werden sichtbar geprüft — nicht über `data-baustein` und nicht über die DOM-Zahl", () => {
    // Die Engine selbst wird gefragt. `checkVisibility` sieht `opacity: 0` — genau die Verstellung,
    // mit der BENs Gegenprobe in Runde 1 grün blieb.
    expect(WEG, `${STATIONEN} fragt Element.checkVisibility nicht`).toContain("checkVisibility");
    expect(
      WEG,
      `${STATIONEN} meldet nicht, OB mit checkVisibility gemessen wurde — ein stiller Rückfall bliebe unbemerkt`,
    ).toContain("geprueftMitCheckVisibility");
    expect(WEG, `${STATIONEN} scrollt die Bausteine nicht in den Blick`).toContain(
      "scrollIntoView",
    );
    // Und die Fachprüfung wird VOR und NACH dem Prozessneustart gefahren — zwei Aufrufe, nicht einer.
    const aufrufe = QUELLE.match(/bausteineMuessenSichtbarSein\(/g) ?? [];
    expect(
      aufrufe.length,
      `${NACHWEIS} prüft die Bausteine ${aufrufe.length}× sichtbar — erwartet sind zwei Stellen: vor und nach dem Prozessneustart`,
    ).toBe(2);
    expect(QUELLE, `${NACHWEIS} prüft die Bausteine nicht vor dem Prozessneustart`).toContain(
      '"vor dem Prozessneustart"',
    );
    expect(QUELLE, `${NACHWEIS} prüft die Bausteine nicht nach dem Prozessneustart`).toContain(
      '"nach dem Prozessneustart"',
    );
    // Und der alte, widerlegte Weg ist FORT: eine Liste von `data-baustein` in DOM-Reihenfolge war
    // der Grund für BENs ROT. Sie darf nicht daneben stehen bleiben (REGELN: „wenn etwas ersetzt
    // wird, wird der alte Weg entfernt, nicht daneben belassen").
    for (const [name, text] of [
      [NACHWEIS, QUELLE],
      [STATIONEN, WEG],
    ] as const) {
      expect(
        text,
        `${name} führt BAUSTEINFOLGE weiterhin — der widerlegte Weg steht neben dem neuen`,
      ).not.toContain("BAUSTEINFOLGE");
    }
  });

  // ==============================================================================================
  // DER TEXTKNOTEN ENTSCHEIDET — KEIN BEHÄLTER TRÄGT SEINEN INHALT. (BEN, Runde 3, Pflicht 1)
  // ==============================================================================================
  //
  // ZWEI BEFUNDE STECKEN IN DIESEM FALL, und der zweite ist der Ersatz des ersten:
  //   · RUNDE 2: mit `content-visibility: hidden` am Herkunftsabsatz war `innerText === ""` und
  //     `textContent` unverändert — die Strecke blieb grün, weil sie `textContent` sammelte.
  //   · RUNDE 3: der Name wanderte in ein `<span style="opacity:0">` INNERHALB des sichtbaren
  //     Absatzes — und die Strecke blieb wieder grün, weil sie `element.innerText` sammelte. Der
  //     `innerText` eines Elements enthält den Text seiner Nachkommen, auch den durchsichtiger; und
  //     der Absatz stand im Gang vor seinem Kind, wurde also als Namensträger gewählt.
  //
  // DIE EINHEIT IST DESHALB DER TEXTKNOTEN. Das ist keine Verschärfung derselben Idee, sondern eine
  // andere: gemessen wird die STELLE, an der die gesuchten Zeichen stehen, nie ein Behälter darum.
  it("die Sichtbarkeit hängt am einzelnen Textknoten — kein Elternfeld trägt den Text seiner Kinder", () => {
    // Der zusammengesetzte Text kommt AUSSCHLIESSLICH aus den Zeichen SICHTBARER Knoten. Die Zeile
    // wird ganz gepinnt und nicht nur ihr halber Ausdruck: käme hier wieder ein `innerText` eines
    // Elements herein, wäre BENs Befund aus Runde 3 nicht behoben.
    expect(
      WEG,
      `${STATIONEN} setzt den sichtbaren Text nicht aus den SICHTBAREN TEXTKNOTEN zusammen`,
    ).toContain('text: knoten.filter(knotenSichtbar).map((k) => k.text).join(" ")');
    // Und die Fachprüfung sucht den Namen im KNOTEN, nicht in einem Feld darüber.
    expect(
      WEG,
      `${STATIONEN} sucht den Namensträger nicht unter den Textknoten — dann trägt wieder ein Elternfeld den Nachweis`,
    ).toContain("b.knoten.find((k) => k.text.includes(soll))");
    expect(WEG, `${STATIONEN} prüft den gefundenen Knoten nicht mit knotenIstSichtbar`).toContain(
      "knotenIstSichtbar(traeger)",
    );
    // `innerText` eines ELEMENTS darf nur noch als AUSSCHLUSS vorkommen (leer = zeichnet nichts).
    // Es steht deshalb an genau einer Stelle, und die heisst so, wie sie wirkt.
    const innerStellen = WEG.match(/\.innerText/g) ?? [];
    expect(
      innerStellen.length,
      `${STATIONEN} nennt innerText ${innerStellen.length}× — je mehr Stellen, desto grösser die Gefahr, dass wieder eine davon einen Kindtext trägt`,
    ).toBeLessThanOrEqual(1);
    expect(
      WEG,
      `${STATIONEN} benutzt innerText nicht als reine Ausschlussbedingung (elternLeer)`,
    ).toContain('elternLeer: normal(el.innerText) === ""');
    // `textContent` steht nur noch dort, wo es die Zeichen EINES Textknotens meint — ein Textknoten
    // hat keinen anderen Text. Zwei Stellen: beim Erkennen und beim Lesen.
    const rohStellen = WEG.match(/\.textContent/g) ?? [];
    expect(
      rohStellen.length,
      `${STATIONEN} nennt textContent ${rohStellen.length}× — je mehr Stellen, desto grösser die Gefahr, dass wieder eine davon als Beleg gilt`,
    ).toBeLessThanOrEqual(2);
    // Der widerlegte feldweise Weg ist FORT und steht nicht neben dem neuen (REGELN: Ablösung).
    for (const alt of ["feldSichtbar", "felderVon", "feldIstSichtbar", "Feldbefund"]) {
      expect(
        WEG,
        `${STATIONEN} führt ${alt} weiterhin — der in Runde 3 widerlegte feldweise Weg steht neben dem neuen`,
      ).not.toContain(alt);
    }
    expect(
      WEG,
      `${STATIONEN} fragt content-visibility nicht — ein übersprungener Inhalt bliebe unbemerkt`,
    ).toContain("contentVisibility");
    // Und die Meldung nennt beim Scheitern den Baustein UND die Stelle.
    expect(WEG, `${STATIONEN} meldet einen unsichtbaren Herkunftstext nicht namentlich`).toContain(
      "Herkunftstext nicht sichtbar",
    );
  });

  // ==============================================================================================
  // FEHLENDES CHROMIUM IST EIN BEFUND — UND EIN FEHLENDES `dist` IST EIN ANDERER.
  // ==============================================================================================
  //
  // BENs Korrekturpflicht 2 zu Runde 1: der zugesagte geordnete Übersprung war nicht gebaut. Er ist
  // es jetzt — und er wird hier FUNKTIONAL gemessen, nicht am Quelltext behauptet. Dass die Regel
  // ohne Browser messbar bleiben muss, ist ihr Sinn; deshalb steht sie in einer Datei ohne
  // Playwright in der Importhülle (`browserbefund.ts`).
  it("fehlendes Chromium ergibt einen benannten Befund — und zählt nicht als bestanden", async () => {
    const start = await starteBrowserOderBefund<string>(
      () =>
        Promise.reject(new Error("Executable doesn't exist at /ms-playwright/chromium/headless")),
      () => true,
    );
    expect(hatBrowser(start), "ein gescheiterter Start liefert trotzdem einen Browser").toBe(false);
    if (hatBrowser(start)) {
      throw new Error("unerreichbar");
    }
    expect(start.zustand.gelaufen, "ein Lauf ohne Browser gilt als gelaufen").toBe(false);
    const zustand = start.zustand as { gelaufen: false; grund: string };
    expect(zustand.grund, "der Grund nennt Chromium nicht beim Namen").toContain(KEIN_BROWSER);
    expect(
      zustand.grund,
      "der Grund nennt den Wortlaut des Fehlers nicht — dann rät der Betreiber, ob Paket oder Binärdatei fehlt",
    ).toContain("Executable doesn't exist");
    expect(
      zaehltAlsBestanden(start.zustand),
      "ein Lauf ohne Browser zählt als bestanden — genau das verbietet Pedis Satz",
    ).toBe(false);
    expect(befundsatz("JOB 4323", start.zustand)).toContain("NICHT belegt");
  });

  it("ein fehlendes `apps/web/dist` wird NICHT als Chromium-Befund verschluckt", async () => {
    // Dieselbe Ausnahme, nur ohne gebaute Fläche: `starteChromium` wirft für BEIDE Lagen, und ein
    // Aufbaufehler des Prüfstands darf nicht hinter einem harmlosen Übersprung verschwinden.
    await expect(
      starteBrowserOderBefund<string>(
        () => Promise.reject(new Error("JOB 4223: …/apps/web/dist/index.html fehlt")),
        () => false,
      ),
    ).rejects.toThrow("index.html fehlt");
  });

  it("steht Chromium zur Verfügung, kommt der Browser durch — die Regel sperrt nichts", async () => {
    const start = await starteBrowserOderBefund<string>(
      () => Promise.resolve("ein-browser"),
      () => true,
    );
    expect(hatBrowser(start), "ein gelungener Start liefert keinen Browser").toBe(true);
    if (!hatBrowser(start)) {
      throw new Error("unerreichbar");
    }
    expect(start.browser).toBe("ein-browser");
  });

  it("der Nachweis ruft die Regel wirklich — sonst wäre sie gebaut, richtig und wirkungslos", () => {
    expect(QUELLE, `${NACHWEIS} ruft starteBrowserOderBefund nicht`).toContain(
      "starteBrowserOderBefund(",
    );
    expect(
      QUELLE,
      `${NACHWEIS} startet Chromium weiterhin ungeschützt — ein Wurf risse den Aufbau mit`,
    ).not.toContain("await starteChromium()");
    // Die Fläche wird VOR dem Browser hergestellt: nur so ist ein gescheiterter Browserstart
    // eindeutig ein Browserbefund und kein verdeckter dist-Mangel.
    expect(QUELLE.indexOf("stelleFlaecheBereit()")).toBeLessThan(
      QUELLE.indexOf("starteBrowserOderBefund("),
    );
  });
});
