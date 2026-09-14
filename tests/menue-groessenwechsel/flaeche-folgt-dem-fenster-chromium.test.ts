// ================================================================================================
// JOB 3811 · WER DAS TELEFON DREHT, WÄHREND EIN WERKZEUGMENÜ OFFEN STEHT — FOLGT DIE FLÄCHE?
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Die Bestellung steht wörtlich in `jobs/3769/runde-2/RUECKGABE.md:50`:
// „Ein Kasten, der schrumpft, WÄHREND das Menü offen steht, lässt die Fläche stehen, wo sie steht
// (`Menue.tsx:283-285`, aus Runde 1 unverändert)." Gemeldet, nie gemessen. Ein Mensch öffnet am
// Telefon ein gerahmtes Werkzeugmenü und dreht dann das Gerät oder klappt die Tastatur auf — die
// Breite des Fensters ändert sich, die Fläche aber wurde beim ÖFFNEN eingepasst.
//
// WAS AM QUELLTEXT GELESEN IST, UND WO DER AUFTRAG DANEBENLAG. Der Auftrag (§2.2) nahm an, es gebe
// „weder ein `window.addEventListener("resize", …)` noch einen `ResizeObserver` in dieser Datei",
// und liess ausdrücklich den Fund der Bahn gelten. GEFUNDEN WURDE DAS GEGENTEIL:
//   · `Menue.tsx:192` — der Ausgleich läuft in einem `useLayoutEffect`, dessen Abhängigkeiten
//     `[istOffen, versatz, versatzHoch]` sind (`:300`).
//   · `Menue.tsx:218` — `if (!el || versuche.current >= 3) { return; }`: drei Anläufe je Lage. Der
//     Kommentar darüber begründet den Deckel (ein endlos neu rechnender Effekt bräche React mit
//     „Maximum update depth exceeded").
//   · `Menue.tsx:262` — UND ES GIBT IHN DOCH: `window.addEventListener("resize", beiGroesse)`,
//     und `beiGroesse` setzt `versuche.current = 0` ZURÜCK (`:259`), bevor es neu einpasst. Der
//     Deckel verhindert also das Schwingen innerhalb EINER Lage, nicht das Nachrechnen bei einer
//     neuen. Eingebaut mit JOB 3266 (Commit `7027813d`, 08.09.) — also vor der Bestellung.
//
// DAS GEMESSENE ERGEBNIS, UND ES FÄLLT GEGEN DIE GEMELDETE SORGE AUS. Bei einem FENSTERwechsel bei
// offener Fläche wird nachgerechnet, und die Fläche bleibt im Fenster. Gemessen (die Zahlen stehen
// unten in der Ausgabe jedes Falls): 390→844 schiebt den Versatz von 148 px auf 50,2 px zurück,
// 390→320 von 148 px auf 130,5 px. Diese Datei PINNT das als Zusage. Das ist ein vollwertiges
// Ergebnis und kein Fehlschlag: die Bestellung war eine begründete Sorge, sie trägt für diesen Fall
// nicht.
//
// ================================================================================================
// DER BEFUND AUS RUNDE 1 — UND WARUM ER HIER STEHT STATT IN EINER EIGENEN DATEI.
// ================================================================================================
//
// Runde 1 hat den WIRKLICHEN Fall desselben Satzes gefunden: nicht das Fenster war der fehlende
// Auslöser, sondern der eigene INHALT. Wuchs die Fläche, WÄHREND sie offen stand (erste Stufe →
// Entwurfsliste, 220 px → 330 px), lief kein Effekt — `istOffen` blieb `true`, `versatz` stand
// schon, `resize` feuerte nicht, weil sich das Fenster gar nicht geändert hatte. GEMESSEN am Stand
// `dd709a1` (12./13.09., in echtem Chromium): die Entwurfsliste lag bei 390 px um 102 px und bei
// 320 px um 76 px LINKS AUSSERHALB des Fensters, der Versatz blieb auf dem Wert der ersten Stufe
// (148 px bzw. 46,5 px) stehen. Das war Bens x = −237 px aus JOB 3266 R1 (`Menue.tsx:121-128`),
// unverändert am Leben. Es stand als BEFUND in einer eigenen Datei
// (`befund-flaeche-folgt-dem-eigenen-inhalt-nicht-chromium.test.ts`), getrennt, weil eine Zusage
// und ein Mangel nicht in derselben Datei stehen dürfen.
//
// DER MANGEL IST BEHOBEN. `JOB 3769 D2` (Commit `3b27c44`) hat genau den fehlenden Auslöser
// eingebaut: einen `ResizeObserver` auf die Fläche selbst (`Menue.tsx:290-298`), der dasselbe
// `beiGroesse` ruft wie der Fensterhörer. Der Befund hat daraufhin getan, wofür er gebaut war — er
// wurde im Kandidatentor am 13.09. 23:17 ROT, mit seinem eigenen Satz im Fehlertext: „DER VERSATZ
// WURDE NACHGERECHNET (148 px → 258 px) — der fehlende Auslöser ist da. Diese Datei ist umzudrehen."
//
// RUNDE 2 HAT GENAU DAS GETAN, WAS DIE DATEI VERLANGTE. Ihr Kopf schrieb vor: „NICHT LÖSCHEN —
// UMDREHEN … aus „liegt draussen" wird die Zusicherung „liegt im Fenster", und der Fall gehört nach
// flaeche-folgt-dem-fenster-chromium.test.ts." Die drei Fälle stehen deshalb HIER, umgedreht, als
// I1/I2/I3. KEIN Fall ist verlorengegangen, und die Zahl des Mangels ist es auch nicht: I1/I2
// rechnen sie aus der HEUTIGEN Messung zurück (linke Kante minus der Nachrechnung) und verlangen,
// dass sie negativ bleibt. Wäre der Ausgleich nur Zierat, stünde dort eine Zahl ≥ 0 und der Fall
// wäre rot. So bleibt belegt, dass der Mangel bestand — ohne eine Datei, die einen behobenen
// Mangel behauptet.
//
// WAS DIESE DATEI NICHT BELEGT. Keine echten Geräte. Kein echtes `orientationchange` des
// Betriebssystems (das Produkt hat dafür keinen Hörer; `setViewportSize` löst `resize` aus, ein
// Telefon feuert beides). Keine echte Bildschirmtastatur — F4 misst, WIE WEIT sich das überhaupt
// nachstellen lässt, und benennt den Rest als Prüflücke. Kein Bildschirmleser, kein EN, kein NL,
// kein Fingertippen. NUR DIE WAAGERECHTE LAGE: die senkrechte Erreichbarkeit (die Fläche im
// rollenden Kasten, `Menue.tsx:236-243`) ist Gegenstand von `tests/ki-freie-anweisung/**` und hier
// ausdrücklich ungedeckt. Und nur DIESEN einen Inhaltswechsel: die anderen Menüs der Zeile (Datei,
// KI, Bereich, Vertraulichkeit, „?") haben keine zweite Stufe. Die Bühne wird IMPORTIERT, nicht
// abgeschrieben (`h3-blatt-buehne.ts`, Zielpfad von JOB 3809); EIN Browser, EINE Seite für den
// ganzen Lauf — seit der Zusammenführung in Runde 2 für ALLE Fälle dieses Auftrags.
//
// GEMESSEN WIRD AM „…"-MENÜ DER WERKZEUGZEILE (`Blatt.tsx:2304`, `gerahmt` → `right-0`), in seiner
// ERSTEN Stufe: sechs echte Einträge (Entwürfe · Anhänge · Status · Beispiel · Klara · Eingabe
// verwerfen) — und in I1/I2/I3 eine Stufe weiter, in der Entwurfsliste (`Blatt.tsx:2366`).
//
// ZEILENANGABEN. Jede Angabe `Menue.tsx:<n>` / `Blatt.tsx:<n>` ist am Stand von `main` gelesen (mit
// JOB 3769 D2, `3b27c44`) — dem Stand, auf den dieser Auftrag vor dem Tor gesetzt wird
// (`rebase_vor_tor: true`).
//
// FÄLLE
// F0  die Bühne steht, und die Ausgangslage bei 390 px ist eine gemessene Zahl (Rechteck, Versatz).
// F1  DREHUNG 390×844 → 844×390 bei OFFENER Fläche: sie bleibt im Fenster und bei ihrem Knopf.
// F2  SCHRUMPFEN 390×844 → 320×568 bei OFFENER Fläche: dasselbe.
// F3  DER GEGENBEWEIS: bei der NEUEN Grösse geschlossen und neu geöffnet sitzt sie ebenfalls. Dieser
//     Fall trennt „die Fläche passt nie" von „die Fläche passt nur nicht MEHR" — und er ist der
//     Fall, den Gegenprobe A (Ausgleich abgeschaltet) rot macht.
// F4  DIE TASTATUR-LAGE, ehrlich: ein reiner Höhenwechsel, und was er NICHT nachstellt.
// I1  DER EIGENE INHALT bei 390 px: erste Stufe → Entwurfsliste OHNE Schliessen, ohne Fensterwechsel.
// I2  dasselbe bei 320 px.
// I3  BEIDE AUSLÖSER HINTEREINANDER: gewachsene Fläche, dann noch ein Fensterwechsel.
// P   die Seite hat während aller Messungen nichts geworfen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type Buehne, type Seite, buehneAufbauen } from "../design/h3-blatt-buehne";
import {
  BLATT,
  HOCH,
  type Masse,
  PFAD,
  QUER,
  SCHMAL,
  blattFahren,
  entwuerfeOeffnen,
  fensterStellen,
  gemessen,
  menueOeffnen,
  menueSchliessen,
  messen,
} from "./menue-buehne";

let b: Buehne | null = null;

function buehne(): Buehne {
  const gefunden = b;
  expect(gefunden, "Prüfstand nicht aufgebaut").not.toBeNull();
  expect((gefunden as Buehne).fehler, "Prüfstand nicht aufgebaut").toBeNull();
  return gefunden as Buehne;
}

function seite(): Seite {
  return buehne().seite;
}

/**
 * DIE ZUSAGE: die Fläche und JEDES Stück darin liegen zwischen 0 und der Fensterbreite.
 *
 * Bewusst über die Stücke und nicht nur über die Fläche — ein Kind mit fester Breite kann über den
 * Rand seines Elternteils hinausstehen, und dann meldet der Elternteil eine heile Lage, während der
 * Mensch nichts lesen kann. Und bewusst mit ZAHLEN in der Meldung: „liegt draussen" ohne das Wieviel
 * wäre für den nächsten Leser wertlos.
 */
function imFenster(m: Masse, lage: string): void {
  const f = gemessen(m, lage);
  expect(
    m.schlimmstesLinks,
    `${lage}: die Fläche (oder ein Stück darin) beginnt links AUSSERHALB des Fensters ` +
      `(x=${m.schlimmstesLinks}, Fläche x=${f.links}–${f.rechts} von ${m.fenster}, Versatz ` +
      `${m.versatzMatrix} px, „${f.text}")`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    m.schlimmstesRechts,
    `${lage}: die Fläche (oder ein Stück darin) endet rechts AUSSERHALB des Fensters ` +
      `(x=${m.schlimmstesRechts} von ${m.fenster}, Fläche x=${f.links}–${f.rechts}, Versatz ` +
      `${m.versatzMatrix} px, „${f.text}")`,
  ).toBeLessThanOrEqual(m.fenster);
  // Und die Seite hat dabei kein Seitwärtsrollen bekommen: eine Fläche, die das Dokument breiter
  // macht, liegt zwar rechnerisch „im Fenster", schiebt aber das ganze Blatt.
  expect(
    m.seitenbreite,
    `${lage}: die SEITE läuft waagerecht über (scrollWidth=${m.seitenbreite} auf clientWidth=${m.fenster})`,
  ).toBeLessThanOrEqual(m.fenster + 1);
}

/**
 * UND SIE GEHÖRT WEITERHIN SICHTBAR ZU IHREM KNOPF.
 *
 * „Im Fenster" allein wäre zu wenig: eine Fläche, die nach einem Größenwechsel irgendwo am anderen
 * Ende der Zeile steht, ist im Fenster und trotzdem falsch — niemand fände sie ihrem Werkzeug zu.
 * Geprüft wird die schwächste wahre Form davon, eine waagerechte ÜBERLAPPUNG; eine engere Zusage
 * („bündig") hat das Produkt nie gegeben, und der Ausgleich nimmt sie absichtlich zurück.
 */
function beiIhremKnopf(m: Masse, lage: string): void {
  const f = gemessen(m, lage);
  expect(m.knopf, `${lage}: das Werkzeug steht nicht da`).not.toBeNull();
  const k = m.knopf as NonNullable<Masse["knopf"]>;
  const ueberlappung = Math.min(f.rechts, k.rechts) - Math.max(f.links, k.links);
  expect(
    ueberlappung,
    `${lage}: die Fläche steht nicht mehr bei ihrem Werkzeug (Fläche x=${f.links}–${f.rechts}, ` +
      `Knopf x=${k.links}–${k.rechts}, Überlappung ${ueberlappung} px)`,
  ).toBeGreaterThan(0);
}

// KEIN `describe.runIf`: fehlt `apps/web/dist` oder startet Chromium nicht, wird dieser Lauf ROT und
// nennt den Ausfall wörtlich (er steht in `Buehne.fehler`). Ein übersprungener Prüfstand ist grün
// und belegt nichts.
describe("JOB 3811 · das offene Werkzeugmenü und der Fensterwechsel, im echten Chromium", () => {
  beforeAll(async () => {
    b = await buehneAufbauen(PFAD, BLATT, {}, HOCH);
  }, 180_000);

  afterAll(async () => {
    await b?.schliessen();
  }, 60_000);

  it("F0 · die Bühne steht, und die Ausgangslage bei 390 px ist eine gemessene Zahl", async () => {
    const stand = b as Buehne;
    expect(stand.fehler, `Bühne nicht aufgebaut: ${stand.fehler}`).toBeNull();
    console.info(`JOB 3811 · Chromium ${stand.version} · Theme ${stand.theme}`);
    const s = seite();
    await blattFahren(s, HOCH);
    await menueOeffnen(s);
    const m = await messen(s, "F0 · 390×844, frisch geöffnet");
    // DAS IST DER ZUSTAND, DEN DER EINPASS-EFFEKT HERGESTELLT HAT — der Bezugspunkt aller Fälle.
    // Und er ist nicht selbstverständlich: ohne den Ausgleich läge diese Fläche links draussen
    // (Gegenprobe A belegt es). Die sechs Einträge werden mitgezählt, damit „mit Inhalt" (§9) eine
    // Zahl ist und keine Behauptung.
    expect(
      m.eintraege,
      `F0: das „…"-Menü trägt nur ${m.eintraege} Einträge — dann misst dieser Lauf ein leeres Menü`,
    ).toBeGreaterThanOrEqual(5);
    imFenster(m, "F0 · 390×844");
    beiIhremKnopf(m, "F0 · 390×844");
    console.info(
      `JOB 3811 · F0 · Fenster ${m.fenster}×${m.fensterhoehe} · Fläche x=${m.flaeche?.links}–${m.flaeche?.rechts} ` +
        `(${m.flaeche?.breite} px, Deckel ${m.deckel}, Anker right=${m.anker}) · Versatz „${m.versatzStil}" = ` +
        `${m.versatzMatrix} px · Knopf x=${m.knopf?.links}–${m.knopf?.rechts} · ${m.eintraege} Einträge`,
    );
  }, 180_000);

  // ==============================================================================================
  // F1/F2 · DER FALL, UM DEN ES GEHT — in drei Schritten, jeder mit einer Zahl.
  // ==============================================================================================
  //
  // (a) 390×844 stellen, das gerahmte Menü öffnen, das Rechteck der Fläche festhalten.
  // (b) OHNE zu schliessen das Fenster wechseln — Drehung bzw. Schrumpfen.
  // (c) Erneut messen: liegt die Fläche noch im Fenster, und WIE hat sich ihr Versatz verhalten?
  //
  // DER VERSATZ IST DER BELEG FÜR DIE URSACHE, NICHT DAS URTEIL. Ein UNVERÄNDERTER Versatz bei
  // verändertem Fenster hiesse „es wurde nicht nachgerechnet"; er steht deshalb mit Zahlen in der
  // Ausgabe. Die harte Zusage ist trotzdem die LAGE — ein stehengebliebener Versatz, der die Fläche
  // zufällig nicht hinausschiebt, wäre kein Schaden für den Menschen, und diese Datei misst den
  // Schaden, nicht die Mechanik. Gegenprobe B (der `resize`-Hörer wird entfernt) belegt, dass die
  // Lage hier wirklich beisst: der Versatz bleibt dann auf 148 px stehen und schiebt die Fläche in
  // BEIDEN Fällen hinaus.
  for (const [fall, ziel, was] of [
    ["F1", QUER, "DREHUNG"],
    ["F2", SCHMAL, "SCHRUMPFEN"],
  ] as const) {
    it(`${fall} · ${was} ${HOCH.width}×${HOCH.height} → ${ziel.width}×${ziel.height} bei OFFENER Fläche: sie bleibt im Fenster`, async () => {
      const s = seite();
      await blattFahren(s, HOCH);
      await menueOeffnen(s);
      const vorher = await messen(s, `${fall} · vorher ${HOCH.width}×${HOCH.height}`);
      const v = gemessen(vorher, `${fall} · vorher`);
      imFenster(vorher, `${fall} · vorher ${HOCH.width}`);

      // (b) OHNE zu schliessen. Dass die Fläche offen BLEIBT, ist der ganze Fall — eine Fläche, die
      // der Größenwechsel schliesst, hätte das Problem nicht, sie hätte ein anderes.
      await fensterStellen(s, ziel);
      const nachher = await messen(s, `${fall} · nachher ${ziel.width}×${ziel.height}`);
      expect(
        nachher.flaeche,
        `${fall}: die Fläche hat den Größenwechsel nicht überlebt — sie ist verschwunden`,
      ).not.toBeNull();
      const n = gemessen(nachher, `${fall} · nachher`);
      expect(
        nachher.fenster,
        `${fall}: das Fenster hat sich gar nicht geändert (${nachher.fenster} px) — dann misst dieser Fall nichts`,
      ).not.toBe(vorher.fenster);

      console.info(
        `JOB 3811 · ${fall} · ${was} · vorher Fenster ${vorher.fenster} px, Fläche x=${v.links}–${v.rechts}, ` +
          `Versatz ${vorher.versatzMatrix} px · nachher Fenster ${nachher.fenster} px, Fläche ` +
          `x=${n.links}–${n.rechts}, Versatz ${nachher.versatzMatrix} px · Versatz ` +
          `${vorher.versatzMatrix === nachher.versatzMatrix ? "UNVERÄNDERT" : "nachgerechnet"} · ` +
          `Knopf x=${nachher.knopf?.links}–${nachher.knopf?.rechts}`,
      );

      // (c) DIE HARTE ZUSAGE.
      imFenster(nachher, `${fall} · nachher ${ziel.width}`);
      beiIhremKnopf(nachher, `${fall} · nachher ${ziel.width}`);
    }, 180_000);
  }

  // ==============================================================================================
  // F3 · DER GEGENBEWEIS — „die Fläche passt nie" gegen „die Fläche passt nur nicht MEHR".
  // ==============================================================================================
  //
  // Nach dem Wechsel wird geschlossen und bei der NEUEN Grösse neu geöffnet. Dann läuft der
  // Einpass-Effekt von vorn (`Menue.tsx:192-201`: `istOffen` wechselt, `versuche` und `versatz`
  // werden zurückgesetzt). Sässe sie hier NICHT, wäre der Befund ein ganz anderer als der bestellte
  // — dann passte die Fläche bei dieser Grösse überhaupt nicht, und der Größenwechsel wäre unschuldig.
  //
  // UND DIESER FALL IST DIE PROBE AUF DEN AUSGLEICH SELBST: bei 390 px braucht die Fläche 148 px
  // Verschiebung, bei 320 px 46,5 px, sonst liegt sie links draussen. Genau deshalb wird er rot,
  // wenn man `Menue.tsx:218` auf `versuche.current >= 0` stellt (Gegenprobe A).
  //
  // Die LAGE nach dem Wechsel und die nach dem Neuöffnen sind NICHT dieselbe, und das ist kein
  // Mangel: der Ausgleich korrigiert nur den ÜBERSTAND (`Menue.tsx:228-234`) und nimmt eine einmal
  // nötige Verschiebung nicht wieder zurück, solange sie nicht stört. Gemessen bei 844 px: x=616
  // nach der Drehung gegen x=565,8 nach dem Neuöffnen (50,2 px), bei 320 px x=92 gegen x=8 (84 px).
  // Beide liegen im Fenster. Die Zahlen stehen in der Ausgabe, damit der nächste
  // Leser sie hat — behauptet wird darüber nichts.
  for (const [fall, ziel, brauchtVersatz] of [
    ["F3a · nach der Drehung", QUER, false],
    ["F3b · nach dem Schrumpfen", SCHMAL, true],
  ] as const) {
    it(`${fall}: bei ${ziel.width} px geschlossen und neu geöffnet sitzt die Fläche`, async () => {
      const s = seite();
      await blattFahren(s, HOCH);
      await menueOeffnen(s);
      await fensterStellen(s, ziel);
      const gewechselt = await messen(s, `${fall} · nach dem Wechsel`);
      const gw = gemessen(gewechselt, `${fall} · nach dem Wechsel`);

      await menueSchliessen(s);
      await menueOeffnen(s);
      const neu = await messen(s, `${fall} · neu geöffnet bei ${ziel.width}`);
      const nn = gemessen(neu, `${fall} · neu geöffnet`);

      console.info(
        `JOB 3811 · ${fall} · nach Wechsel x=${gw.links}–${gw.rechts} (Versatz ${gewechselt.versatzMatrix}) · ` +
          `neu geöffnet x=${nn.links}–${nn.rechts} (Versatz ${neu.versatzMatrix}) · Fenster ${neu.fenster} · ` +
          `Unterschied ${Math.round((gw.links - nn.links) * 10) / 10} px`,
      );

      imFenster(neu, `${fall} · neu geöffnet`);
      beiIhremKnopf(neu, `${fall} · neu geöffnet`);
      // UND SIE SITZT NICHT VON SELBST, SONDERN WEIL GERECHNET WURDE — aber nur dort, wo das auch
      // stimmt. Bei 320 px steht der Knopf mitten in der umgebrochenen Zeile, die Fläche bräuchte
      // von ihm aus 38,5 px nach links über den Rand und wird gemessen um 46,5 px zurückgeschoben.
      // Bei 844 px bricht die Zeile nicht um, die Fläche passt ohne jede Verschiebung — dort wäre
      // dieselbe Forderung eine erfundene Zahl, und sie steht deshalb nicht da.
      if (brauchtVersatz) {
        expect(
          neu.versatzMatrix,
          `${fall}: die neu geöffnete Fläche sitzt ohne jeden Ausgleich — bei ${neu.fenster} px ` +
            `braucht sie einen (gemessen ${neu.versatzMatrix} px, Fläche x=${nn.links}–${nn.rechts}, ` +
            `Knopf x=${neu.knopf?.links}–${neu.knopf?.rechts}); dann belegt dieser Fall den Ausgleich nicht`,
        ).not.toBe(0);
      }
    }, 180_000);
  }

  // ==============================================================================================
  // F4 · DIE TASTATUR-LAGE — und die ehrliche Antwort, wie weit sie sich hier nachstellen lässt.
  // ==============================================================================================
  //
  // Auf dem Telefon nimmt die eingeblendete Bildschirmtastatur HÖHE weg. Der Auftrag (§5.5) verlangt
  // zu MESSEN, ob `setViewportSize` das wirklichkeitsnah nachstellt, statt es stillschweigend
  // wegzulassen. Gemessen wird deshalb beides: was ein reiner HÖHENwechsel mit der Fläche macht, und
  // was dabei mit `window.visualViewport` geschieht.
  //
  // DER UNTERSCHIED, UM DEN ES GEHT — und er ist hier GEMESSEN, nicht behauptet: `setViewportSize`
  // verkleinert das Layout-Fenster UND das Sichtfenster im Gleichschritt (die Ausgabe zeigt beide).
  // Eine echte Bildschirmtastatur verkleinert auf den heutigen Telefonen nur das SICHTfenster; das
  // Layout-Fenster bleibt stehen, und `resize` am `window` feuert dann je nach Browser gar nicht.
  // Dieser Fall belegt also den HÖHENWECHSEL, nicht die Tastatur — das ist die schwächere Aussage,
  // und sie steht hier als solche. Die stärkere bräuchte `Page.setDeviceMetricsOverride` mit
  // getrenntem visuellem Fenster und damit einen Zugang, den die Bühne (`Seite`) nicht hat.
  it("F4 · die Tastatur-Lage: ein reiner Höhenwechsel bei offener Fläche — und was er NICHT nachstellt", async () => {
    const s = seite();
    await blattFahren(s, HOCH);
    await menueOeffnen(s);
    const vorher = await messen(s, "F4 · vorher 390×844");
    imFenster(vorher, "F4 · vorher");

    // Dieselbe Breite, deutlich weniger Höhe — die Grössenordnung einer eingeblendeten Tastatur.
    await fensterStellen(s, { width: HOCH.width, height: 400 });
    const nachher = await messen(s, "F4 · nachher 390×400");
    const n = gemessen(nachher, "F4 · nachher");
    expect(
      nachher.fenster,
      `F4: die BREITE hat sich mitgeändert (${vorher.fenster} → ${nachher.fenster}) — dann ist das kein reiner Höhenwechsel`,
    ).toBe(vorher.fenster);
    expect(
      nachher.fensterhoehe,
      `F4: die Höhe hat sich gar nicht geändert (${nachher.fensterhoehe} px)`,
    ).toBeLessThan(vorher.fensterhoehe);
    console.info(
      `JOB 3811 · F4 · Layout-Fenster ${vorher.fenster}×${vorher.fensterhoehe} → ${nachher.fenster}×${nachher.fensterhoehe} · ` +
        `Sichtfenster ${vorher.sichtfenster} → ${nachher.sichtfenster} · ` +
        `Fläche x=${n.links}–${n.rechts}, y=${n.oben}–${n.unten} · Versatz ${nachher.versatzMatrix} px`,
    );
    imFenster(nachher, "F4 · nachher");
    beiIhremKnopf(nachher, "F4 · nachher");
    // DIE PRÜFLÜCKE WIRD GEMESSEN, NICHT BEHAUPTET: dass das Sichtfenster hier MITgegangen ist, ist
    // der Beleg dafür, dass dieser Fall die stärkere Nachstellung fährt und die echte Tastaturlage
    // gerade NICHT deckt. Steht hier eines Tages ein abweichendes Sichtfenster, hat sich die Bühne
    // geändert und dieser Satz ist nachzuführen.
    expect(
      nachher.sichtfenster,
      "F4: die Bühne hat kein `visualViewport` — dann ist über die Tastatur hier gar nichts zu sagen",
    ).not.toBe("kein visualViewport");
    expect(
      nachher.sichtfenster,
      `F4: Sicht- und Layout-Fenster laufen auseinander (${nachher.sichtfenster} gegen ` +
        `${nachher.fenster}×${nachher.fensterhoehe}) — dann stellt dieser Fall etwas anderes nach, als sein Kopf sagt`,
    ).toBe(`${nachher.innen}x${nachher.innenhoehe}`);
  }, 180_000);

  // ==============================================================================================
  // I1/I2 · DER EIGENE INHALT — die umgedrehten Fälle B1/B2 aus Runde 1.
  // ==============================================================================================
  //
  // Gemessen wird ZWEIMAL an derselben offenen Fläche: erst die erste Stufe (sechs Einträge), dann
  // die Entwurfsliste. Dazwischen wird NICHT geschlossen und NICHT am Fenster gedreht — es klickt
  // nur ein Mensch auf „Entwürfe" (`entwuerfeOeffnen`). Das Fenster ist also über den ganzen Fall
  // hinweg dasselbe; der einzige Auslöser, der hier überhaupt feuern KANN, ist der
  // `ResizeObserver` auf der Fläche (`Menue.tsx:290-298`).
  //
  // DREI ZAHLEN TRAGEN DEN FALL, und die dritte ist die, die den alten Mangel am Leben hält:
  //   (a) die Fläche ist wirklich gewachsen (sonst gäbe es nichts nachzurechnen),
  //   (b) der Versatz WURDE nachgerechnet (er steht nicht mehr auf dem Wert der ersten Stufe),
  //   (c) OHNE diese Nachrechnung läge die linke Kante bei `links − (Versatz₂ − Versatz₁)`, und
  //       diese Zahl muss NEGATIV sein. Gemessen am Stand `dd709a1` war genau sie die Lage der
  //       Fläche: 8 − (258 − 148) = −102 bei 390 px, 8 − (130,5 − 46,5) = −76 bei 320 px. Wäre sie
  //       heute ≥ 0, wäre der Ausgleich an dieser Stelle Zierat — dann trüge dieser Fall nichts,
  //       und er sagt es statt still grün zu sein.
  //
  // WAS ROT WIRD, WENN JEMAND DEN AUSLÖSER WIEDER ENTFERNT: (b) mit dem gemessenen Beleg „der
  // Versatz ist auf X px stehengeblieben", und unmittelbar danach `imFenster` mit der Lage. Das ist
  // dieselbe Datei, die vorher als BEFUND das Gegenteil festhielt — nur eben von der richtigen
  // Seite her.
  for (const [fall, groesse] of [
    ["I1", HOCH],
    ["I2", SCHMAL],
  ] as const) {
    it(`${fall} · ${groesse.width} px: die Fläche wächst bei OFFENEM Menü (erste Stufe → Entwurfsliste) und bleibt im Fenster`, async () => {
      const s = seite();
      await blattFahren(s, groesse);

      await menueOeffnen(s, "erste");
      const stufe1 = await messen(s, `${fall} · ${groesse.width} · erste Stufe`);
      const e = gemessen(stufe1, `${fall} · erste Stufe`);
      expect(
        stufe1.eintraege,
        `${fall}: die erste Stufe trägt nur ${stufe1.eintraege} Einträge — dann misst dieser Fall ein leeres Menü`,
      ).toBeGreaterThanOrEqual(5);
      // Die erste Stufe SITZT — das ist der Ausgangspunkt, und er ist die Zusage von F0.
      imFenster(stufe1, `${fall} · erste Stufe ${groesse.width}`);

      // EIN KLICK. Kein Schliessen, kein Fensterwechsel.
      await entwuerfeOeffnen(s);
      const stufe2 = await messen(s, `${fall} · ${groesse.width} · Entwurfsliste`);
      const l = gemessen(stufe2, `${fall} · Entwurfsliste`);
      expect(
        stufe2.fenster,
        `${fall}: das Fenster hat sich zwischen den Stufen geändert (${stufe1.fenster} → ` +
          `${stufe2.fenster} px) — dann misst dieser Fall nicht den Inhaltswechsel, sondern F1/F2`,
      ).toBe(stufe1.fenster);

      // (a) DIE VORAUSSETZUNG.
      expect(
        l.breite,
        `${fall}: die Entwurfsliste ist nicht breiter als die erste Stufe (${l.breite} px gegen ` +
          `${e.breite} px) — dann gibt es hier nichts nachzurechnen und dieser Fall misst nichts`,
      ).toBeGreaterThan(e.breite);

      // (b) DER AUSLÖSER HAT GEFEUERT.
      expect(
        stufe2.versatzMatrix,
        `${fall}: DER VERSATZ IST AUF DEM WERT DER ERSTEN STUFE STEHENGEBLIEBEN ` +
          `(${stufe1.versatzMatrix} px, Fläche jetzt ${l.breite} px statt ${e.breite} px breit, ` +
          `x=${l.links}–${l.rechts} von ${stufe2.fenster}) — der Auslöser auf der Fläche ` +
          `(Menue.tsx:290-298) fehlt oder feuert nicht. Das ist der Befund aus Runde 1 (${fall}), zurück.`,
      ).not.toBe(stufe1.versatzMatrix);

      // (c) UND ER WAR NÖTIG — die Lage, die OHNE ihn dastünde, aus heutigen Zahlen gerechnet.
      const nachgerechnet = (stufe2.versatzMatrix ?? 0) - (stufe1.versatzMatrix ?? 0);
      const ohneNachrechnung = Math.round((l.links - nachgerechnet) * 10) / 10;
      console.info(
        `JOB 3811 · ${fall} · Fenster ${groesse.width} px · erste Stufe x=${e.links}–${e.rechts} ` +
          `(${e.breite} px, Versatz ${stufe1.versatzMatrix}) → Entwurfsliste x=${l.links}–${l.rechts} ` +
          `(${l.breite} px, Versatz ${stufe2.versatzMatrix}) · nachgerechnet um ${nachgerechnet} px · ` +
          `ohne Nachrechnung läge die linke Kante bei ${ohneNachrechnung} px · Knopf ` +
          `x=${stufe2.knopf?.links}–${stufe2.knopf?.rechts}`,
      );
      expect(
        ohneNachrechnung,
        `${fall}: die Nachrechnung war gar nicht nötig — ohne sie läge die linke Kante bei ` +
          `${ohneNachrechnung} px und damit IM Fenster. Dann belegt dieser Fall den Ausgleich nicht ` +
          `(Fläche x=${l.links}–${l.rechts}, um ${nachgerechnet} px verschoben)`,
      ).toBeLessThan(0);

      // (d) DIE ZUSAGE.
      imFenster(stufe2, `${fall} · Entwurfsliste ${groesse.width}`);
      beiIhremKnopf(stufe2, `${fall} · Entwurfsliste ${groesse.width}`);
    }, 180_000);
  }

  // ==============================================================================================
  // I3 · BEIDE AUSLÖSER HINTEREINANDER — der umgedrehte Fall B3 aus Runde 1.
  // ==============================================================================================
  //
  // Erst wächst der Inhalt (erste Stufe → Entwurfsliste), DANN wechselt zusätzlich das Fenster
  // (390 → 320), und das Menü bleibt die ganze Zeit offen. In Runde 1 belegte dieser Fall, dass es
  // am AUSLÖSER lag und nicht an der Fläche: der Fensterwechsel reparierte damals eine Fläche, die
  // 102 px draussen lag. Heute ist er die schärfere Zusage — die Fläche übersteht ZWEI
  // Größenänderungen verschiedener Art hintereinander, ohne je geschlossen zu werden.
  //
  // Er bleibt auch deshalb stehen, weil er die Halbheit ausschliesst, die I1/I2 allein liessen: dass
  // der `ResizeObserver` den Fensterhörer verdrängt haben könnte. Wäre das so, stünde die Fläche
  // nach dem Fensterwechsel noch auf dem Versatz der 390-px-Lage.
  it("I3 · die GEWACHSENE Fläche übersteht zusätzlich einen Fensterwechsel 390 → 320, ohne je zu schliessen", async () => {
    const s = seite();
    await blattFahren(s, HOCH);
    await menueOeffnen(s, "entwuerfe");
    const vorher = await messen(s, "I3 · 390 · Entwurfsliste, gewachsen");
    const v = gemessen(vorher, "I3 · vorher");
    // Der Ausgangszustand IST schon der gewachsene — sonst misst der Rest dieses Falls F2 nach.
    expect(
      v.breite,
      `I3: die Fläche ist nur ${v.breite} px breit — das ist die erste Stufe, nicht die ` +
        `Entwurfsliste; dann misst dieser Fall denselben Fall wie F2 (Fenster ${vorher.fenster} px)`,
    ).toBeGreaterThan(300);
    imFenster(vorher, "I3 · vorher 390");

    await fensterStellen(s, SCHMAL);
    const nachher = await messen(s, "I3 · nach dem Fensterwechsel auf 320");
    const n = gemessen(nachher, "I3 · nachher");
    expect(
      nachher.fenster,
      `I3: das Fenster hat sich gar nicht geändert (${nachher.fenster} px) — dann misst dieser Fall nichts`,
    ).not.toBe(vorher.fenster);

    console.info(
      `JOB 3811 · I3 · vorher Fenster ${vorher.fenster} px, Fläche x=${v.links}–${v.rechts} ` +
        `(${v.breite} px, Versatz ${vorher.versatzMatrix}) → nachher Fenster ${nachher.fenster} px, ` +
        `Fläche x=${n.links}–${n.rechts} (${n.breite} px, Versatz ${nachher.versatzMatrix}) · ` +
        `Knopf x=${nachher.knopf?.links}–${nachher.knopf?.rechts}`,
    );

    imFenster(nachher, "I3 · nachher 320");
    beiIhremKnopf(nachher, "I3 · nachher 320");
    // Und der Fensterhörer lebt neben dem Flächenbeobachter weiter — das ist der Unterschied in
    // einer Zahl.
    expect(
      nachher.versatzMatrix,
      `I3: der Versatz ist unverändert geblieben (${vorher.versatzMatrix} px → ` +
        `${nachher.versatzMatrix} px) — dann hat der Fensterwechsel an der GEWACHSENEN Fläche ` +
        `nichts ausgelöst (Fenster ${vorher.fenster} → ${nachher.fenster} px)`,
    ).not.toBe(vorher.versatzMatrix);
  }, 180_000);

  it("P · die Seite hat während aller Messungen nichts geworfen", () => {
    expect(buehne().seitenfehler).toEqual([]);
  });
});
