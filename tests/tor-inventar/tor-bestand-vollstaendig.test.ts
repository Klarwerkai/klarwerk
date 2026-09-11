// ================================================================================================
// JOB 3131 · T2 — KEIN TEST GEHT VERLOREN, wenn das Tor in zwei Laeufe zerfaellt.
// ================================================================================================
//
// WAS SICH GEAENDERT HAT. `tools/test` fuhr einen Vitest-Aufruf ueber den ganzen Bestand, ohne
// Prozessgrenze. Ab JOB 3131 sind es zwei: `browser` (die Dateien, die einen echten Chromium
// starten — ein Fork, hintereinander) und `rest` (alles uebrige, begrenzt auf sechs Forks).
//
// WAS DABEI SCHIEFGEHEN KANN, und zwar still: eine Datei faellt aus BEIDEN Laeufen heraus und wird
// nie mehr geprueft. Das Tor bliebe gruen und wuesste nichts davon — die teuerste Fehlerklasse
// dieses Projekts (vgl. `vitest.config.ts`, AUFTRAG-mega59 Block G: 19 Dateien liefen im Tor
// jahrelang gar nicht, weil eine `include`-Zeile sie nicht traf).
//
// DIESER TEST IST DIE VERSICHERUNG DAGEGEN. Er fragt nicht die Konfiguration, was sie zu tun
// gedenkt, sondern den ECHTEN COLLECTOR, was er tatsaechlich einsammelt — dreimal, auf demselben
// Stand, im selben Lauf:
//
//     A  BESTAND   `vitest list --filesOnly`                       (ohne Gruppenschalter: alles)
//     B  REST      `KLARWERK_TESTGRUPPE=rest vitest list …`        (Lauf 2 von `tools/test`)
//     C  BROWSER   `vitest list -c vitest.browser.config.ts …`     (Lauf 1 von `tools/test`)
//
// und beweist: B ∪ C = A, B ∩ C = ∅. Damit ist jede Datei genau einmal dran — keine Luecke, keine
// Doppelpruefung. Die Zahl 1458 steht bewusst NIRGENDS als Erwartung: gemessen wird gegen den
// eigenen Stand, damit neue Testdateien anderer Jobs den Test nicht faelschlich rot machen.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { WURZEL, ermittleBrowserbefund, sammleTestdateien } from "./browser-gruppe";

const arbeitsordner = mkdtempSync(join(tmpdir(), "klarwerk-tor-inventar-"));
afterAll(() => {
  rmSync(arbeitsordner, { recursive: true, force: true });
});

/**
 * Ein Collector-Lauf. `--filesOnly` sammelt nur die Dateimenge (keine Transformation, keine
 * Ausfuehrung) und kostet deshalb Bruchteile einer Sekunde — gemessen 0,6 s fuer den vollen
 * Bestand. Genau diese Menge fuehrt Vitest danach auch aus; sie ist der einzige ehrliche Massstab.
 */
function collector(zusatz: readonly string[], gruppe?: string): string[] {
  const ziel = join(arbeitsordner, `liste-${gruppe ?? "alle"}.json`);
  // `KLARWERK_TESTGRUPPE` wird AUSDRUECKLICH gesetzt oder AUSDRUECKLICH entfernt — nie geerbt.
  // Dieser Test laeuft im Tor als Kind des Aufrufs `rest`, und der traegt die Variable in seiner
  // Umgebung. Geerbt haette der Bestandslauf (A) den Rest gemessen und sich selbst bestaetigt:
  // ein Test, der seine eigene Voraussetzung mitbringt, misst nichts.
  const umgebung = { ...process.env };
  delete umgebung.KLARWERK_TESTGRUPPE;
  if (gruppe !== undefined) {
    umgebung.KLARWERK_TESTGRUPPE = gruppe;
  }
  execFileSync("npx", ["vitest", "list", "--filesOnly", `--json=${ziel}`, ...zusatz], {
    cwd: WURZEL,
    env: umgebung,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
  const roh = JSON.parse(readFileSync(ziel, "utf8")) as ReadonlyArray<{ file: string }>;
  return roh.map((e) => relative(WURZEL, e.file).split("\\").join("/")).sort();
}

/**
 * Die drei Collector-Laeufe und der Graph werden BEI BEDARF erhoben, nicht beim Laden der Datei.
 * Wer mit `-t` einen einzelnen Fall fahren will (und das tut jede Bahn beim Reparieren), soll
 * nicht drei Unterprozesse bezahlen, die sein Fall gar nicht braucht.
 */
function einmal<T>(erhebe: () => T): () => T {
  let wert: { readonly inhalt: T } | undefined;
  return () => {
    if (wert === undefined) {
      wert = { inhalt: erhebe() };
    }
    return wert.inhalt;
  };
}

const holeBestand = einmal(() => collector([]));
const holeRest = einmal(() => collector([], "rest"));
const holeBrowser = einmal(() => collector(["--config", "vitest.browser.config.ts"], "browser"));
const holeBefund = einmal(() => ermittleBrowserbefund());

/** Was in `a` steht und nicht in `b` — die Meldung nennt Dateien, nicht nur Zahlen. */
function fehlend(a: readonly string[], b: readonly string[]): string[] {
  const haben = new Set(b);
  return a.filter((d) => !haben.has(d));
}

describe("JOB 3131 T2 · der Bestand ueberlebt die Aufteilung in zwei Laeufe", () => {
  it("V1 · beide Laeufe zusammen sind genau der bisherige Bestand", () => {
    const alle = holeBestand();
    const zusammen = [...holeBrowser(), ...holeRest()].sort();
    expect(
      fehlend(alle, zusammen),
      "Diese Dateien liefen vorher und laufen in KEINEM der beiden Aufrufe mehr",
    ).toEqual([]);
    expect(
      fehlend(zusammen, alle),
      "Diese Dateien laufen jetzt, gehoerten aber nicht zum Bestand",
    ).toEqual([]);
    expect(zusammen).toEqual(alle);
  });

  it("V2 · keine Datei laeuft doppelt", () => {
    const inBrowser = holeBrowser();
    const inRest = holeRest();
    const imBrowser = new Set(inBrowser);
    expect(
      inRest.filter((d) => imBrowser.has(d)),
      "In BEIDEN Aufrufen — sie wuerde zweimal gefahren",
    ).toEqual([]);
    expect(imBrowser.size, "Der Browser-Aufruf nennt eine Datei doppelt").toBe(inBrowser.length);
    expect(new Set(inRest).size, "Der Rest-Aufruf nennt eine Datei doppelt").toBe(inRest.length);
  });

  it("V3 · der Bestand ist nicht leer und beide Gruppen sind besetzt", () => {
    // Ohne diese Kalibrierung waere V1/V2 auch dann gruen, wenn der Collector gar nichts faende.
    expect(holeBestand().length).toBeGreaterThan(1000);
    expect(holeBrowser().length).toBeGreaterThan(0);
    expect(holeRest().length).toBeGreaterThan(0);
    // JOB 3229: der neue echte Add-in-Importvertrag muss im regulären Lauf bleiben.
    expect(holeRest()).toContain("tests/m5c-b-addin-bildunterschriften/route.test.ts");
    // JOB 3267 (Q1): die Quellenwahrheit der Antwort ist ein jsdom-Lauf ohne Chromium — sie gehört
    // in den regulären Aufruf und darf nicht still aus beiden Gruppen fallen.
    expect(holeRest()).toContain("tests/q1-quellen-wahrheit/quellenwahrheit-mounted.test.tsx");
    // JOB 3243: der Quellenfund im Panel ist eine .tsx-Datei OHNE JSX (jsdom, kein Chromium). Genau
    // solche Dateien fallen still aus einem Lauf, wenn ein `include`- oder Gruppenmuster nur auf
    // `.test.ts` zielt — dieser Pin macht das sichtbar, statt es dem Zufall zu überlassen.
    expect(holeRest()).toContain("tests/m3-dokumentweg-panel/quellenfund-im-panel.test.tsx");
    // JOB 3243 R2: der Wirkungsnachweis am echten Router gehört in denselben regulären Lauf.
    expect(holeRest()).toContain("tests/m3-dokumentweg-panel/w6-anschluss-echte-route.test.ts");
    // JOB 3290: dieselbe Klasse wie der Pin darüber — der gemountete Prüfen-Filter ist eine
    // .tsx-Datei OHNE JSX (jsdom, `createElement`, kein Chromium). Sie trägt den Sollvertrag zum
    // Volltextfilter (`it.fails`) UND die Bindung der Beschriftung an das tatsächliche Verhalten;
    // fiele sie still aus beiden Gruppen, bliebe der Befund aus Codex' Beleg
    // 38-pruefen-volltext-ende.png ungedeckt und die Beschriftung ohne Wächter.
    expect(holeRest()).toContain("tests/pruefen-volltext/pruefen-brett-gemountet.test.tsx");
    // JOB 3268 (D1-R): der Versionshinweis im alten Tab ist eine gemountete jsdom-Messung ohne
    // Chromium — dieselbe Bauform (`.tsx` ohne eigenen Browser), die oben schon einmal still aus
    // einem Lauf zu fallen drohte. Der Pin hält sie im regulären Aufruf fest.
    expect(holeRest()).toContain(
      "tests/d1r-neue-version-im-alten-tab/versionshinweis-mounted.test.tsx",
    );
    // JOB 3268 R2: der Pin gegen den echten Serverwert („unbekannt“ ist keine neue Version) ist
    // ebenfalls eine `.tsx`-Datei OHNE JSX — sie trägt die Endung nur, weil die Wurzel-Typprüfung
    // Node-rein ist (`tsconfig.json:23-27`) und der geprüfte Baustein `document` benutzt. Genau
    // diese Bauform fällt still aus einem Lauf, wenn ein Muster nur auf `.test.ts` zielt.
    expect(holeRest()).toContain(
      "tests/d1r-neue-version-im-alten-tab/unbekannt-ist-keine-version.test.tsx",
    );
    // JOB 3338 (ISO-HILFE): dieselbe Bauform noch einmal — die gemountete Hilfe ist eine `.tsx`
    // OHNE JSX (jsdom, `createElement`, kein Chromium). Sie trägt den EINZIGEN Beleg dafür, dass
    // Pedis Suchbegriffe („9001", „2701") auf der echten Seite eine lesbare Erklärung zeigen;
    // fiele sie still aus beiden Gruppen, bliebe die Freitagsvorführung ungedeckt.
    expect(holeRest()).toContain("tests/iso-hilfe/iso-hilfe-flaeche.test.tsx");
    // Der DOM-freie Zwilling dazu (Lieferung, Alias, Quellen, Wortlaut) gehört in denselben Lauf.
    expect(holeRest()).toContain("tests/iso-hilfe/iso-wortlaut.test.ts");
    // JOB 3279: der Umfangs-, Bilder- und Herkunftsnachweis der Browser-Leiste fährt jsdom und
    // ein echtes Fastify, aber KEIN Chromium — er gehört in den regulären Aufruf und darf nicht
    // still aus beiden Gruppen fallen.
    expect(holeRest()).toContain("tests/klara-browser/artikel.test.tsx");
    // JOB 3279 R2: der Wiederöffnungsnachweis mountet echte React-Bauteile unter jsdom — auch er
    // startet KEIN Chromium und gehört in den regulären Aufruf.
    expect(holeRest()).toContain("tests/klara-browser/wiederoeffnen.test.tsx");
    // JOB 3281 (WORD-VERGLEICH): der Absatzvergleich wohnt in einem NEUEN Verzeichnis
    // (`tests/word-vergleich/`). Genau dabei fällt eine Datei still aus beiden Gruppen, wenn ein
    // `include`- oder Gruppenmuster den neuen Baum nicht trifft — beide Läufe sind jsdom, kein
    // Chromium, also gehören sie in den regulären Aufruf. Die Bühne daneben (`word-buehne.ts`)
    // ist bewusst KEIN Pin: sie ist ein Helfer, keine Laufeinheit, und wird vom Collector
    // richtigerweise nicht eingesammelt.
    expect(holeRest()).toContain("tests/word-vergleich/absatzvergleich-mounted.test.ts");
    expect(holeRest()).toContain("tests/word-vergleich/merkliste-und-ruecknahme.test.ts");
    expect(holeRest()).toContain("tests/app/word-addin-wortvergleich.test.ts");
    // JOB 3281 R2: zwei weitere Läufe im selben neuen Verzeichnis, aus demselben Grund gepinnt —
    // Vorkommen/Fremdfarben-Nachweis und der Nachweis zweier Läufe mit spät eintreffenden Antworten.
    expect(holeRest()).toContain("tests/word-vergleich/vorkommen-und-fremdfarben.test.ts");
    expect(holeRest()).toContain("tests/word-vergleich/zwei-laeufe-und-spaete-antworten.test.ts");
    // JOB 3280: der Zwischenablage- und Entwurfsnachweis fährt jsdom, eine echte Zwischenablage
    // im Fenster und ein echtes Fastify, aber KEIN Chromium. Er trägt den einzigen Beleg dafür,
    // dass die Leiste nur auf Klick liest und dass ein Vorgang genau einen Entwurf erzeugt —
    // fiele er still aus beiden Gruppen, wäre die Freitagsvorführung (A04/A07) ungedeckt.
    expect(holeRest()).toContain("tests/klara-browser/zwischenablage.test.ts");
    // JOB 3364: dieser Pin steht aus einem ANDEREN Grund als die Pins darüber — die Datei ist eine
    // gewöhnliche `.test.ts` in einem vorhandenen Baum, also nicht die Bauform, die still aus einem
    // Muster fällt. Gepinnt ist sie, weil ihr Verlust UNSICHTBAR wäre: sie ist die einzige
    // Frühwarnung vor Biomes Größendeckel (`files.maxSize`, 2 MiB), und ein Wächter, der nicht mehr
    // läuft, warnt nicht — er ist grün. Der Preis dafür steht fest: JOB 3326 R3 verlor ein volles
    // Tor nach Build und Tests an der Zeile „Size of ./apps/web/src/i18n.ts … exceeds configured
    // maximum". Fällt die Datei aus beiden Gruppen, zahlt das der nächste Textjob, nicht dieser.
    expect(holeRest()).toContain("tests/lesevariante/i18n-groessendeckel.test.ts");
    // JOB 3363: dieselbe Klasse wie die Pins weiter oben — eine `.tsx`-Datei in einem NEUEN
    // Verzeichnis (`tests/lesevariante-pruefkarte/`), jsdom mit echtem Fastify, kein Chromium.
    // Genau diese Bauform fällt still aus beiden Gruppen, wenn ein `include`- oder Gruppenmuster
    // den neuen Baum nicht trifft. Sie trägt den EINZIGEN Beleg dafür, dass die Prüfkarte in
    // Stufe 2 die Leseübersetzung eines noch nicht angenommenen Kandidaten zeigt — und dass der
    // Kandidat dabei unverändert bleibt.
    expect(holeRest()).toContain("tests/lesevariante-pruefkarte/pruefkarte-mounted.test.tsx");
    expect(holeRest()).toContain("tests/lesevariante-pruefkarte/kandidatenvariante-route.test.ts");
    // JOB 3363 R2: derselbe Grund wie beim Pin für JOB 3364 eine Zeile weiter oben — nicht die
    // Bauform, die aus einem Muster fällt, sondern ein Wächter, dessen Verlust UNSICHTBAR wäre.
    // Diese Datei hält die Sprachsperre fest, an der Runde 1 mit reproduzierbarem HTTP 500 zerbrach
    // (BEN: `…/lesevariante/original_language`). Läuft sie nicht mehr, ist sie grün und der Weg
    // zurück in die Serverausnahme wieder offen.
    expect(holeRest()).toContain("tests/lesevariante-pruefkarte/sprachsperre.test.ts");
    // JOB 3384 (UX-26): dieselbe Bauform wie die Pins darueber — eine `.tsx`-Datei in einem NEUEN
    // Verzeichnis (`tests/ux26-herkunft-belege/`), jsdom mit echtem i18next, kein Chromium. Sie
    // traegt den EINZIGEN Beleg dafuer, dass die Herkunftskette fachliche Namen statt
    // Programmbrocken zeigt und dass beide Leerstaende (Ereignisse, Belege) etwas sagen. Faellt sie
    // still aus beiden Gruppen, waere sie gruen und der Weg zurueck zu „ask query" offen.
    expect(holeRest()).toContain(
      "tests/ux26-herkunft-belege/herkunft-belege-verstaendlich.test.tsx",
    );
    // JOB 3335 (UX-21): wieder ein NEUES Verzeichnis (`tests/ux21-tablet-lesemodus/`) mit einer
    // `.tsx`-Datei OHNE JSX (jsdom, `createElement`, kein Chromium) — sie trägt den einzigen Beleg
    // dafür, dass der Schalter „Trefferliste" des Lese-Tablets die Liste ein- und ausklappt, ohne
    // den Bericht zu schliessen. Die Chromium-Messung daneben fährt über `h4-harness` und gehört
    // in die serielle Browser-Gruppe; fiele eine von beiden still aus beiden Läufen, bliebe der
    // Befund N-0044 ungedeckt.
    expect(holeRest()).toContain("tests/ux21-tablet-lesemodus/tablet-lesemodus-mounted.test.tsx");
    expect(holeBrowser()).toContain("tests/ux21-tablet-lesemodus/tablet-chromium.test.ts");
    // JOB 3468 (REVIEW26-HILFE-IMPORT): dieselbe Bauform wie die Pins darueber — ein NEUES
    // Verzeichnis (`tests/review26-hilfe-import/`) mit einer `.ts` und einer `.tsx` OHNE JSX
    // (jsdom, `createElement`, kein Chromium). Genau diese Bauform faellt still aus beiden Gruppen,
    // wenn ein `include`- oder Gruppenmuster den neuen Baum nicht trifft. Die beiden Dateien tragen
    // den EINZIGEN Beleg dafuer, dass die gemeldete Hilfesuche „import" den vorhandenen Dateiimport
    // findet und dass die Grenzen auf der Karte aus der Serverquelle kommen.
    expect(holeRest()).toContain("tests/review26-hilfe-import/hilfe-findet-dateiimport.test.ts");
    expect(holeRest()).toContain("tests/review26-hilfe-import/hilfe-karte-dateiimport.test.tsx");
  });

  it("V4 · der Verzeichnisgang der Konfiguration sieht denselben Bestand wie der Collector", () => {
    // `sammleTestdateien()` ist die Menge, aus der die Browser-Gruppe berechnet wird. Laeuft sie
    // vom Collector weg (neues `include`-Muster, neuer Baum), waere die Gruppe auf einer anderen
    // Grundlage gebildet als der Lauf — dieser Fall wird hier rot, bevor er Schaden anrichtet.
    const alle = holeBestand();
    const gegangen = sammleTestdateien();
    expect(
      fehlend(alle, gegangen),
      "Der Collector sieht Dateien, die der Verzeichnisgang nicht kennt",
    ).toEqual([]);
    expect(
      fehlend(gegangen, alle),
      "Der Verzeichnisgang sieht Dateien, die der Collector nicht kennt",
    ).toEqual([]);
  });
});

describe("JOB 3131 T2 · die Browser-Gruppe ist genau die Menge mit Chromium in der Importhuelle", () => {
  it("B1 · der Browser-Aufruf faehrt exakt die berechneten Chromium-Tests", () => {
    expect(holeBrowser()).toEqual([...holeBefund().browserTests].sort());
  });

  it("B2 · keine Chromium-Datei ist in den Rest-Aufruf gerutscht", () => {
    const graph = holeBefund();
    const imBrowser = new Set(holeBrowser());
    const abgerutscht = graph.browserTests.filter((d) => !imBrowser.has(d));
    const belege = abgerutscht.map((d) => `${d}  ←  ${(graph.ketten.get(d) ?? []).join(" → ")}`);
    expect(belege, "startet Chromium, laeuft aber im parallelen Rest-Aufruf mit").toEqual([]);
  });

  it("B3 · jede Datei, die Playwright SELBST importiert, ist erfasst", () => {
    // Die Startdateien sind teils Helfer (`tests/design/h4-harness.ts`) und teils selbst Tests.
    // Die Helfer sind Belege, keine Laufeinheiten; die Tests darunter muessen in der Gruppe sein.
    const imBestand = new Set(holeBestand());
    const starterTests = holeBefund().startdateien.filter((d) => imBestand.has(d));
    expect(
      starterTests.length,
      "keine einzige Startdatei gefunden — der Graph misst nichts",
    ).toBeGreaterThan(0);
    expect(fehlend(starterTests, holeBrowser())).toEqual([]);
  });

  it("B4 · der Graph findet die Startstellen, die im Bestand wirklich stehen", () => {
    // Kalibrierung gegen Codex' unabhaengige Erhebung (T2-BROWSER-INVENTAR-1.json, 06.09.):
    // 18 Dateien mit `require("playwright")`. Sie ist statisch erhoben, dieser Graph laeuft ueber
    // den Syntaxbaum — zwei Wege, ein Ergebnis. Die Zahl steht hier bewusst als PIN: eine neue
    // Startstelle ist eine Entscheidung ueber die Tor-Last und soll gesehen werden.
    // JOB 3138: dazu kommt der statische DE/EN-Erklärweg (ein Browser, vier Fälle).
    // Seine direkte Playwright-Importstelle gehört in die serielle Browser-Gruppe;
    // B1/B3 prüfen die tatsächliche Einordnung, der zusätzliche Namenspin hält den Beleg fest.
    const graph = holeBefund();
    // JOB 3199: ein zusätzlicher Start für zwei CDP-Prozessstichproben, seriell, unter 60s.
    // JOB 3194 (M6b): eine weitere eigene Startstelle — der Rückfall-Wächter der Erklärseite.
    // Er MUSS Playwright selbst starten: er serviert eine umgeformte Fassung der ausgelieferten
    // Bytes (Regeln mit `:has(` entfernt) über eine eigene Routenweiche und kann deshalb nicht auf
    // dem gemeinsamen Prüfstand `h6-chromium.ts` reiten, der die gebaute App aus `dist` bedient.
    // Die Last bleibt klein: EIN Browser, vier Fälle, im eigenen Lauf unter 0,3 s.
    // Die beiden anderen neuen M6b-Dateien (`rueckweg-echte-route-chromium.test.ts`,
    // `rundweg-tastatur-chromium.test.ts`) fahren über `h6-chromium.ts` und sind KEINE neuen
    // Startstellen — sie tauchen hier bewusst nicht auf.
    // JOB 3266 R2 (D1): eine weitere eigene Startstelle — der Schmalmesser des Entwurfszugangs
    // (`tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts`). Er MUSS Playwright selbst
    // starten: er verstellt das Fenster (390 und 1280 px), setzt die Sprachwahl im Speicher des
    // Produkts und bedient echte Tastatur und Maus. Der gemeinsame Prüfstand `h3-blatt-buehne.ts`
    // fährt fest auf 1280 px und reicht weder `setViewportSize` noch `keyboard` heraus; ihn dafür
    // umzubauen hiesse, drei fremde Messungen anzufassen. Anlass ist bens Befund an Runde 1: bei
    // 390 px lag die Entwurfsliste bei x = −237 px, also ausserhalb des Fensters — eine Klasse, die
    // kein jsdom-Fall sehen kann (dort gibt es kein Layout und keinen Zeilenumbruch).
    // Die Last bleibt klein: EIN Browser, EINE Seite, elf Fälle, im eigenen Lauf 4,2 s.
    // JOB 3272 R2 (UX-25): eine weitere eigene Startstelle — der Schmalmesser der Belegkarte
    // (`tests/ux25-beleg-zum-original/belegkarte-schmal-chromium.test.tsx`). Anlass ist BENs Befund
    // an Runde 1 (Prüflücke 6): der gemountete Fall prüfte KLASSENNAMEN (`not.toContain("truncate")`)
    // statt tatsächlicher Breiten, und jsdom kann das auch gar nicht — dort gibt es kein Layout und
    // keine Textrechtecke. Dazu kommt die Taste selbst: jsdom führt für einen `<button>` keine
    // Vorgabehandlung auf `keydown` aus, ein `Enter` bewirkt dort nichts. Er MUSS Playwright selbst
    // starten: er verstellt das Fenster (320/360/390 px) und bedient echte Tasten; kein bestehender
    // Prüfstand reicht beides für diese Fläche heraus. Die Last bleibt klein: EIN Browser, EINE
    // Seite, vierzehn Fälle, im eigenen Lauf 2,1 s, Abbau 5,89 ms.
    // JOB 3423 (NAVIGATION-CHUNK-STAND): ZWEI weitere eigene Startstellen, beide in
    // `tests/ladefehler-alter-tab/`. Sie MÜSSEN Playwright selbst starten, weil die Frage, die sie
    // beantworten, in jsdom gar nicht gestellt werden kann: jsdom führt keine Modul-Skripte aus und
    // hat keinen Netzstapel, also weiss es nicht, WELCHES Fehlerobjekt ein Browser wirft, wenn ein
    // Chunk nach einer Veröffentlichung weg ist (`error.name === "TypeError"` war bis hierher eine
    // ungemessene Annahme in `apps/web/src/lib/staleChunk.ts`).
    //   · `echter-ladefehler-chromium.test.ts` misst `name`/`message` an vier Serverantworten —
    //     EIN Browser, EINE Seite, ohne `dist`, im eigenen Lauf 0,6 s.
    //   · `pedis-fall-chromium.test.ts` fährt Pedis Klick in der gebauten App — EIN Browser, EINE
    //     Seite. Der gemeinsame Prüfstand `h1-chromium.ts` trägt ihn nicht: dessen `strecke()`
    //     verlangt das Zielbild `design/klarwerk/Main.dc.html` (h1-chromium.ts:172-174), das dem
    //     Cloud-Prüfstand nicht vorliegt, und reicht weder eine eigene Route-Regel für ein
    //     gesperrtes Stück noch `addInitScript` für den `vite:preloadError`-Mitschnitt heraus.
    // JOB 3560 (UX-28): eine weitere eigene Startstelle — die Tastaturmessung der Fassungskarten
    // (`tests/ux28-fassungen/tastatur-im-browser-chromium.test.tsx`). Anlass ist BENs Prüflücke 6 an
    // JOB 3475 R2 (`archiv/3475/runde-2/ben.md:27`) und dahinter Pedis Befund „Tab überspringt die
    // Karten": die gemounteten Fälle prüfen die BAUART des Knopfes und eine selbst berechnete
    // Kandidatenliste (`tests/ux28-fassungen/flaeche.tsx:186`), nie eine gedrückte Taste. Sie MUSS
    // Playwright selbst starten, weil jsdom an einem `<button>` KEINE Vorgabehandlung auf `keydown`
    // ausführt — ein dort abgeschicktes `Enter` bewirkt nichts — und weil jsdom die Tabulator-Taste
    // überhaupt nicht kennt; Fokusreihenfolge und Fokusverlust bei entferntem Element sind dort
    // nicht messbar. Kein bestehender Prüfstand trägt sie: `h4-harness.ts`, `h6-chromium.ts` und
    // `schmal-buehne.ts` verlangen alle `apps/web/dist`, das der Arbeitsprüfung ohne vorherigen Bau
    // nicht vorliegt. Die Last bleibt klein: EIN Browser, EINE Seite, sechs Fälle, kein `dist`, im
    // eigenen Lauf 1,444 s, Abbau 138,89 ms (gemessen 11.09.2026, Cloud-Lauf c6ea358ac0af56d6fea983a5).
    expect(graph.startdateien.length).toBe(26);
    for (const bekannt of [
      "tests/ux28-fassungen/tastatur-im-browser-chromium.test.tsx",
      "tests/ladefehler-alter-tab/echter-ladefehler-chromium.test.ts",
      "tests/ladefehler-alter-tab/pedis-fall-chromium.test.ts",
      "tests/ux25-beleg-zum-original/belegkarte-schmal-chromium.test.tsx",
      "tests/d1-meine-entwuerfe/zugang-schmal-chromium.test.ts",
      "tests/design/h4-harness.ts",
      "tests/design/h6-chromium.ts",
      "tests/design/h1-chromium.ts",
      "tests/profil-schmal/schmal-buehne.ts",
      "tests/m6-import-erklaerweg/klara-importwege-browser.test.tsx",
      "tests/m6-import-erklaerweg/rueckfall-ohne-has.test.tsx",
      "tests/tor-inventar/chromium-prozesszahl.test.ts",
    ]) {
      expect(graph.startdateien, `${bekannt} startet Chromium und fehlt im Graphen`).toContain(
        bekannt,
      );
    }
  });

  it('B5 · eine blosse NENNUNG von „playwright" macht eine Datei nicht zur Browser-Datei', () => {
    // Anti-Vakuum. `tor-ausnahme.test.ts` traegt das Wort siebenmal (Kommentare und eine
    // `execFileSync`-Argumentliste) und startet keinen Browser; `fremddoppelungen-kd-capture`
    // nennt es in einem Begruendungstext. Eine Textsuche haette beide seriell gemacht.
    for (const nennung of [
      "tests/smoke/tor-ausnahme.test.ts",
      "tests/structure/fremddoppelungen-kd-capture.test.ts",
    ]) {
      expect(
        holeBestand(),
        `${nennung} muss im Bestand sein, sonst prueft dieser Fall nichts`,
      ).toContain(nennung);
      expect(holeBrowser(), `${nennung} nennt Playwright nur, startet es nicht`).not.toContain(
        nennung,
      );
    }
  });
});
