// ================================================================================================
// JOB 4095 R2 · DIE PIXELMESSUNG ZU LIEFERUNG 6 — der lange Dateiname bei 360 px, in Chromium.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Runde 1 belegte Lieferung 6 („die Zeile bricht bei 360 px Breite um
// statt abzuschneiden") mit den KLASSEN am Element — `break-all`, `min-w-0`, `flex-wrap`. BEN hat
// das als Rotgrund benannt (`runde-1/ben.md`, Kernbefund 1): die Rückgabe berief sich zusätzlich
// auf `tests/bibliothek-schmal`, und dort wird der Quellenabschnitt gar nicht geöffnet — jene
// Datei misst die allgemeine Berichtsbreite (`telefon-chromium.test.ts:106`, 390/320 px) und sieht
// keinen Dateinamen. Ein Klassenname ist keine Breite: ob ein Kasten überläuft, entscheidet die
// Kette aus Schriftgröße, Polstern, Nachbarn und Umbruchregel, und die rechnet nur ein Browser aus.
// jsdom kann es grundsätzlich nicht — dort hat jedes Rechteck die Breite 0 (dieselbe Lehre, die
// `h4-harness.ts:4-7` und der Befund N-0043 festhalten).
//
// WAS HIER GEMESSEN WIRD, ist deshalb nicht „steht die Marke da" (das hält der gemountete Fall
// nebenan), sondern die drei Tatsachen, die den Satz aus Lieferung 6 ausmachen:
//   1. NICHTS IST ABGESCHNITTEN — `scrollWidth` des Elements liegt nicht über seiner `clientWidth`.
//   2. ER BRICHT WIRKLICH UM — das Rechteck ist höher als eine Zeile, der Name steht also auf
//      mehreren Zeilen statt in einer über den Rand hinaus.
//   3. ER BLEIBT IM KASTEN UND AUF DER SEITE — die rechte Kante liegt innerhalb des Eintrags, und
//      das Dokument bekommt keinen waagerechten Überlauf.
//
// DER DATEINAME IST ABSICHTLICH OHNE TRENNSTELLEN gewählt (`LANGER_NAME`, 78 Zeichen, kein
// Bindestrich, kein Punkt außer der Endung). Ein Name mit Bindestrichen bräche schon durch den
// normalen Wortumbruch um und bewiese über `break-all` nichts — er liefe auch ohne die Regel grün.
// Genau dieser eine Bezeichner am Stück ist der Fall, der ohne `break-all` seitlich hinausragt.
//
// KEIN EIGENER BROWSERSTART. Diese Datei reitet auf `h4-harness` (die gebaute App aus `dist`,
// echte Fastify-Dienste, echter Bestand) und importiert Playwright NICHT selbst. Sie ist damit
// KEINE neue Startstelle im Sinne von `tests/tor-inventar/browser-gruppe.ts` — der Pin über die
// Startdateien (`tor-bestand-vollstaendig.test.ts:348`) bleibt unberührt, so wie es der Kommentar
// dort für die mitfahrenden Dateien ausdrücklich vorsieht (`:288-290`). Die Last bleibt klein:
// EIN Browser, EINE Seite, vier Fälle. Die Einordnung in die serielle Browser-Gruppe geschieht von
// selbst über den Importgraphen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type H4Stand, fn, h4Stand } from "../design/h4-harness";

/**
 * Der Anker, den Quelle und Anhang teilen. Er wird NICHT erfunden: `addAttachment` legt den Anhang
 * mit genau dieser `objectId` an, und `addSource` bestätigt sie danach gegen die Anhangsliste
 * (`confirmedSourceAnchor`, `knowledge-object/src/service.ts:2918`). Eine unbestätigte Kennung
 * würde am Objekt gar nicht erst gespeichert — der Bestand kann hier also nicht lügen.
 */
const ANKER = "obj-job4095-langer-name";

/**
 * 78 Zeichen, EIN Bezeichner ohne Trennstelle. Siehe Kopf: mit Bindestrichen wäre die Messung
 * wertlos, weil der normale Wortumbruch sie auch ohne `break-all` bestünde.
 */
const LANGER_NAME =
  "PruefberichtSchweissnahtLinie3SpritzzoneAbnahme2026Q3Revision04Freigegeben.pdf";

/** Die Breite aus Lieferung 6 — und die schmalste Lage des Hauses als härterer zweiter Fall. */
const SCHMAL = 360;
const SCHMALSTE = 320;

interface Messung {
  fenster: number;
  /** Marke vorhanden? Ohne sie misst der Rest nichts. */
  da: boolean;
  text: string;
  /** Anzahl der Datei-Marken im Abschnitt — die ankerlose Nachbarquelle darf keine erzeugen. */
  marken: number;
  breite: number;
  hoehe: number;
  /** Breite des Inhalts gegen die sichtbare Breite: darüber hinaus ist abgeschnitten. */
  scrollBreite: number;
  clientBreite: number;
  /** Die Höhe EINER Zeile, aus `line-height` gelesen — der Maßstab für „umgebrochen". */
  zeilenhoehe: number;
  /** Rechte Kante des Namens gegen die rechte Innenkante seines Eintrags. */
  rechts: number;
  eintragRechts: number;
  /** Waagerechter Überlauf des ganzen Dokuments. */
  ueberlauf: number;
  /** Der sichtbare Zustand — reist immer mit, damit ein Fehlschlag sagt, WORAN es lag. */
  lage: {
    lesenDa: boolean;
    sprungDa: boolean;
    abschnittDa: boolean;
    abschnittOffen: boolean;
    quelleneintraege: number;
    zeitmarken: number;
  };
}

const MESSEN = `() => {
  const el = document.querySelector('[data-testid="bib-quelle-datei"]');
  const marken = document.querySelectorAll('[data-testid="bib-quelle-datei"]').length;
  // DER SICHTBARE ZUSTAND REIST IMMER MIT, auch im Erfolgsfall. Runde 2 hat gemessen, warum: der
  // erste Anlauf meldete nur „da: false" und liess offen, ob die Quelle fehlt, der Abschnitt zu ist
  // oder die Lesefläche gar nicht steht. Ein Befund ohne Lage ist kein Befund (Hausregel „letzter
  // sichtbarer Zustand", vgl. die Abbruchtexte in tests/bibliothek-schmal).
  // KEINE RÜCKFALL-ZEICHEN IN DIESEM TEXT: er steht in einem Template-String, und ein Backtick
  // beendete ihn hier mitten im Satz (in Runde 2 genau so passiert, Biome-Parsefehler :94).
  const d = document.querySelector('[data-bib-abschnitt="quellen"]');
  const lage = {
    lesenDa: !!document.querySelector('[data-testid="bib-lesen"]'),
    sprungDa: !!document.querySelector('[data-testid="bib-sprung-quellen"]'),
    abschnittDa: !!d,
    abschnittOffen: !!(d && d.open),
    quelleneintraege: d ? d.querySelectorAll('li').length : 0,
    zeitmarken: document.querySelectorAll('[data-testid="bib-quelle-zeit"]').length,
  };
  if (!el) {
    return {
      fenster: window.innerWidth, da: false, text: '', marken: marken,
      breite: 0, hoehe: 0, scrollBreite: 0, clientBreite: 0, zeilenhoehe: 0,
      rechts: 0, eintragRechts: 0,
      ueberlauf: document.documentElement.scrollWidth - window.innerWidth,
      lage: lage,
    };
  }
  const r = el.getBoundingClientRect();
  const stil = getComputedStyle(el);
  const eintrag = el.closest('li');
  const er = eintrag ? eintrag.getBoundingClientRect() : r;
  const ep = eintrag ? parseFloat(getComputedStyle(eintrag).paddingRight) || 0 : 0;
  // 'normal' kommt vor, wenn keine Zeilenhöhe gesetzt ist — dann rechnet der Browser rund das
  // 1,2-fache der Schriftgröße. Geraten wird hier nichts, was messbar ist: der Wert kommt aus
  // getComputedStyle, nur der Rückfall ist eine Näherung, und er greift bei 'leading-*' nie.
  const lh = stil.lineHeight === 'normal'
    ? Math.round(parseFloat(stil.fontSize) * 1.2)
    : parseFloat(stil.lineHeight);
  return {
    fenster: window.innerWidth,
    da: true,
    text: (el.textContent || '').trim(),
    marken: marken,
    breite: Math.round(r.width),
    hoehe: Math.round(r.height),
    scrollBreite: el.scrollWidth,
    clientBreite: el.clientWidth,
    zeilenhoehe: Math.round(lh),
    rechts: Math.round(r.right),
    eintragRechts: Math.round(er.right - ep),
    ueberlauf: document.documentElement.scrollWidth - window.innerWidth,
    lage: lage,
  };
}`;

/**
 * Der Weg, den ein Mensch geht: der Sprungknopf am Kopf klappt „Mehr" auf UND öffnet den Abschnitt
 * „Quellen & Belege" (JOB 3108 · UX-03). Er wird benutzt, nicht nachgebaut — ein selbst gesetztes
 * `open` am `<details>` beliese nur den Test.
 *
 * IDEMPOTENT, und das ist hier kein Schmuck: `messen` ruft ihn nach JEDEM Breitenwechsel. Ein
 * unbedingter Klick auf einen bereits offenen Abschnitt klappte ihn wieder zu, und die nächste
 * Messung stünde ohne Marke da — derselbe stille Ausgang, den Runde 2 gerade erst behoben hat.
 */
const QUELLEN_OEFFNEN = `() => {
  const d = document.querySelector('[data-bib-abschnitt="quellen"]');
  if (d && d.open) { return true; }
  const knopf = document.querySelector('[data-testid="bib-sprung-quellen"]');
  if (!knopf) { return false; }
  knopf.click();
  return true;
}`;

const ABSCHNITT_OFFEN = `() => {
  const d = document.querySelector('[data-bib-abschnitt="quellen"]');
  return !!(d && d.open);
}`;

let stand: H4Stand | null = null;
let fehler: string | null = null;

/**
 * GEÖFFNET WIRD NACH DEM BREITENWECHSEL, nicht davor — gemessen in Runde 2, Cloud-Lauf
 * `83d46060…`: der erste Anlauf klappte den Abschnitt bei 1620 px auf und mass dann bei 360 px,
 * und dort war die Marke weg (`{"da":false,"marken":0}`). Die Lesefläche baut beim Wechsel in die
 * schmale Anordnung um, und der Abschnittszustand (`offene`, React-Zustand in `MehrAbschnitte`)
 * beginnt wieder geschlossen. Wer die Breite verstellt, muss den Abschnitt danach neu öffnen —
 * genau wie ein Mensch, der das Telefon in die Hand nimmt.
 */
async function messen(breite: number): Promise<Messung> {
  const s = stand as H4Stand;
  await s.seite.setViewportSize({ width: breite, height: 800 });
  // Auf den ZUSTAND warten, nicht auf eine Frist (Lehre JOB 3152 T1b): nach dem Breitenwechsel
  // baut die Fläche neu auf, und der Sprungknopf ist erst danach da. Eine feste Wartezeit wäre auf
  // einem leeren Rechner zu lang und auf einem vollen zu kurz.
  await s.seite.waitForFunction(
    fn(`() => !!document.querySelector('[data-testid="bib-sprung-quellen"]')`),
    undefined,
    { timeout: 30_000 },
  );
  if (!(await s.seite.evaluate<boolean>(fn(QUELLEN_OEFFNEN)))) {
    throw new Error(
      `bei ${breite}px fehlt der Sprungknopf „Quellen“ — der Abschnitt ist nicht erreichbar`,
    );
  }
  await s.seite.waitForFunction(fn(ABSCHNITT_OFFEN), undefined, { timeout: 30_000 });
  await s.seite.waitForTimeout(200);
  const m = await s.seite.evaluate<Messung>(fn(MESSEN));
  console.info(`JOB 4095 R2 · ${breite}px: ${JSON.stringify(m)}`);
  return m;
}

describe("JOB 4095 R2 · der Dateiname am Quellennachweis bricht um (Chromium, gebaute Seite)", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand(
        "/wissen/:frei",
        "pedi@job4095.test",
        async ({ services, autorId, freiId }) => {
          // ERST der Anhang, DANN die Quelle: `addSource` bestätigt den Anker gegen die
          // Anhangsliste und ließe ihn sonst weg. Beide Schritte gehen über die echten Dienste —
          // dieselbe Begründung wie bei der Quelle der Vorrichtung selbst (`h4-harness.ts:293-297`):
          // die öffentliche Route läuft gegen das Stufen-Tor, und dieses Tor wird für einen Test
          // nicht aufgeweicht.
          await services.ko.addAttachment(freiId, autorId, {
            name: LANGER_NAME,
            mime: "application/pdf",
            objectId: ANKER,
          });
          await services.ko.addSource(freiId, autorId, {
            label: "Abnahmebericht Linie 3",
            url: "https://beispiel.de/abnahme/linie-3",
            excerpt: "Kap. 4 — die Naht wird vor dem Verzinken geprüft.",
            objectId: ANKER,
          });
        },
      );
      // HIER WIRD NICHTS AUFGEKLAPPT. Der Aufbau stellt nur den Bestand her; geöffnet wird in
      // `messen`, nach dem Breitenwechsel (Begründung dort). Ein zweiter Öffnungsweg im Aufbau
      // wäre eine zweite Wahrheit über dieselbe Fläche — und genau der, der in Runde 2 bei der
      // falschen Breite zugeschlagen hat.
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  // ==============================================================================================
  // P1 — DIE MESSUNG AUS LIEFERUNG 6: 360 px.
  // ==============================================================================================
  it("P1 · 360 px: der lange Dateiname steht vollständig da, bricht um und ragt nirgends hinaus", async () => {
    expect(fehler).toBeNull();
    const m = await messen(SCHMAL);

    // Vorbedingung: ohne die Marke misst der Rest nichts (Lehre: kein stiller Grünlauf).
    expect(m.da, "die Datei-Marke fehlt — bei 360 px ist über den Umbruch nichts gesagt").toBe(
      true,
    );
    expect(m.fenster).toBe(SCHMAL);
    // Der Name steht GANZ da: kein serverseitiges Kürzen, kein „…".
    expect(m.text).toBe(LANGER_NAME);

    // 1 — nichts ist abgeschnitten. Ohne `break-all` stünde der Name in EINER Zeile, und
    //     `scrollWidth` läge deutlich über `clientWidth`.
    expect(m.scrollBreite).toBeLessThanOrEqual(m.clientBreite + 1);

    // 2 — er bricht wirklich um: mehr als eine Zeile hoch. Das ist die Aussage, die ein
    //     Klassenname nicht treffen kann.
    expect(m.zeilenhoehe).toBeGreaterThan(0);
    expect(m.hoehe).toBeGreaterThanOrEqual(m.zeilenhoehe * 2 - 2);

    // 3 — er bleibt im Kasten und auf der Seite.
    expect(m.rechts).toBeLessThanOrEqual(m.eintragRechts + 1);
    expect(m.ueberlauf).toBeLessThanOrEqual(0);
  }, 60_000);

  // ==============================================================================================
  // P2 — DIE SCHMALSTE LAGE DES HAUSES: 320 px.
  // ==============================================================================================
  it("P2 · 320 px: dasselbe an der engsten Stelle", async () => {
    expect(fehler).toBeNull();
    const m = await messen(SCHMALSTE);

    expect(m.da).toBe(true);
    expect(m.fenster).toBe(SCHMALSTE);
    expect(m.text).toBe(LANGER_NAME);
    expect(m.scrollBreite).toBeLessThanOrEqual(m.clientBreite + 1);
    expect(m.hoehe).toBeGreaterThanOrEqual(m.zeilenhoehe * 2 - 2);
    expect(m.rechts).toBeLessThanOrEqual(m.eintragRechts + 1);
    expect(m.ueberlauf).toBeLessThanOrEqual(0);
  }, 60_000);

  // ==============================================================================================
  // P3 — FEHLEN HEISST FEHLEN, am echten Bestand: die ankerlose Nachbarquelle erzeugt keine Marke.
  // ==============================================================================================
  // Das Objekt der Vorrichtung trägt seit jeher eine Quelle OHNE Anker (`h4-harness.ts:298-309`).
  // Neben ihr steht jetzt die verankerte. Genau EINE Datei-Marke ist deshalb die richtige Zahl —
  // zwei hiessen, der Name würde an eine Quelle geschrieben, zu der er nie gehört hat.
  it("P3 · die Quelle ohne Anker bekommt keinen Dateinamen — und keinen Platzhalter", async () => {
    expect(fehler).toBeNull();
    const m = await messen(SCHMAL);
    expect(m.marken).toBe(1);

    const abschnitt = await stand?.seite.evaluate<string>(
      fn(
        `() => { const d = document.querySelector('[data-bib-abschnitt="quellen"]'); return d ? (d.textContent || '').replace(/\\s+/g, ' ').trim() : ''; }`,
      ),
    );
    console.info(`JOB 4095 R2 · Abschnittstext: ${abschnitt}`);
    expect(abschnitt).toContain(LANGER_NAME);
    // Kein Ersatzzeichen, kein geratenes Datum.
    expect(abschnitt).not.toContain("unbekannt");
    expect(abschnitt).not.toContain("Invalid Date");
    expect(abschnitt).not.toContain("NaN");
  }, 60_000);

  it("P4 · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  });
});
