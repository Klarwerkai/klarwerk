// ================================================================================================
// JOB 3506 · K2b — DIE ZWEI OBERFLAECHENRESTE DER ERFASSEN-FLAECHE, IN CHROMIUM GEMESSEN.
// ================================================================================================
//
// DIE RESTSCHULD VON JOB 3057 (K2), woertlich in `archiv/3057/runde-4/RUECKGABE.md`:
//   · ABWEICHUNGEN: „das ‚?‘-Menue der Erfassen-Flaeche sitzt weiterhin in der Flaeche (nicht
//     hinter dem Zahnrad); ein Umzug waere ein Eingriff in K1s Einstellungen-Flaeche und ist nicht
//     Teil dieser Korrekturrunde."
//   · REST: „‚?‘-Menue in den Zahnrad-Ort ziehen (jetzt moeglich, eigener Auftrag, weil K1-Flaeche)".
//   · Und der OFFENE Wert `Z.52 margin-top: auto` in `tests/design/zielbild-k2-erfassen.test.ts`,
//     damals mit dem Grund „setzt eine Flex-Spalte von Fensterhoehe voraus (Kopf und Umschalter aus
//     K1, JOB 3056 — nicht auf main)". K1 ist seitdem live; die Bedingung ist erfuellt.
//
// WAS EIN MENSCH JETZT SIEHT: Panel oeffnen → „Erfassen" → in der Flaeche steht KEIN „?"-Knopf
// mehr, und der Textlink „Ganzes Dokument uebernehmen" klebt am unteren Fensterrand statt dicht
// unter dem Knopf. Zahnrad antippen → eine Gruppe „BEIM ERFASSEN" mit denselben vier Saetzen.
//
// WIE HIER GEMESSEN WIRD: auf der VORHANDENEN Buehne `tests/design/k2-buehne.ts` (keine dritte) —
// das ausgelieferte `apps/web/public/word-addin/taskpane.html` laeuft in Chromium bei 360 × 720,
// office.js ist eine Attrappe, die `/api/*`-Aufrufe beantwortet die Buehne. Gemessen wird an den
// REALEN Elementen per `getBoundingClientRect` und `getComputedStyle`; die Wortlaute kommen aus dem
// eingebauten Woerterbuch des Panels (`wort`), der Sollwert `margin-top: auto` aus Pedis Zielbild
// `design/klara/Erfassen.dc.html` Z.52 — nichts davon ist abgeschrieben.
//
// RED-FIRST (10.09.2026, Basisstand cc1d2a1): vor dem Umbau waren Fall 1, 2, 3 und 4 rot —
// `#capture-mehr-btn` stand in `#section-capture`, die vier Saetze wohnten in `#capture-mehr`, und
// der Link sass dicht unter dem Knopf (`margin: 0`, `#section-capture` war keine Flex-Spalte).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ATTR,
  type Buehne,
  KLICK,
  RECT,
  SICHTBAR,
  SPRACHEN,
  TEXT,
  ZAEHLEN,
  buehneBauen,
  wort,
  zielProp,
  zielStilZeile,
  zielbildDa,
} from "../design/k2-buehne";

type R = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

/** Die Markierung, mit der die Flaeche ihren Ruhezustand zeigt (zwei Absaetze wie im Zielbild). */
const MARKIERUNG = "Erster Absatz der Markierung.\nZweiter Absatz der Markierung.";

/** Die vier Saetze — Kennung im Panel → Woerterbuchschluessel. Ein Ort, eine Liste. */
const VIER: ReadonlyArray<readonly [string, string]> = [
  ["#capture-hinweis-umfang", "sendHint"],
  ["#capture-bilder-hinweis", "sendImagesNote"],
  ["#capture-hinweis-pruefung", "sendReviewNote"],
  ["#capture-hinweis-seiten", "scopePagesHint"],
];

let b: Buehne | null = null;
let fehler: string | null = null;

function buehne(): Buehne {
  expect(fehler, "Seite nicht geladen").toBeNull();
  expect(b).not.toBeNull();
  return b as Buehne;
}
const lies = <T>(q: string, arg?: unknown) => buehne().lies<T>(q, arg);
const messen = (sel: string, eig: string) => buehne().messen(sel, eig);
const rect = async (sel: string): Promise<R> => {
  const r = await lies<R | null>(RECT, sel);
  expect(r, `${sel} hat kein Rechteck — Element fehlt`).not.toBeNull();
  return r as R;
};
/** Der untere Rand des Rumpfs: der „Fensterboden", gegen den Z.52 gemessen wird. */
const RUMPF_UNTEN = "() => document.body.getBoundingClientRect().bottom";
const FENSTERHOEHE = "() => document.documentElement.clientHeight";

describe.runIf(zielbildDa)(
  "JOB 3506 · K2b · die zwei Oberflaechenreste — das ausgelieferte taskpane.html in Chromium bei 360 px",
  () => {
    beforeAll(async () => {
      try {
        b = await buehneBauen({ markierung: MARKIERUNG });
        await b.oeffnen();
        console.info(
          `JOB 3506 K2b · Chromium ${b.version} · Seitenfehler ${JSON.stringify(b.seitenfehler)}`,
        );
      } catch (e) {
        fehler = String(e).split("\n").slice(0, 3).join(" | ");
      }
    }, 120_000);

    afterAll(async () => {
      await b?.schliessen();
    }, 60_000);

    // ---- Fall 1: das „?" ist aus der Flaeche weg ------------------------------------------------
    it("1 · das „?“ ist aus der Erfassen-Flaeche WEG — nicht versteckt, sondern nicht mehr da", async () => {
      expect(fehler).toBeNull();
      expect(await lies<boolean>(SICHTBAR, "#section-capture")).toBe(true);
      // Die Zusicherung des Auftrags, woertlich: Anzahl 0.
      expect(await lies<number>(ZAEHLEN, "#section-capture #capture-mehr-btn")).toBe(0);
      expect(await lies<number>(ZAEHLEN, "#section-capture #capture-mehr")).toBe(0);
      // Und zwar im GANZEN Panel, nicht nur in dieser Flaeche: ein per CSS ausgeblendeter Knopf
      // waere kein Umzug, sondern eine Kulisse.
      expect(await lies<number>(ZAEHLEN, "#capture-mehr-btn")).toBe(0);
      expect(await lies<number>(ZAEHLEN, "#capture-mehr")).toBe(0);
      // Der Knopfbestand der Flaeche: Senden und der Textlink — kein dritter, aufklappbarer.
      expect(await lies<number>(ZAEHLEN, "#section-capture button[aria-expanded]")).toBe(0);
    });

    // ---- Fall 3: der Link steht am Fensterboden ------------------------------------------------
    // Vor Fall 2, weil Fall 2 auf die Einstellungen schaltet und die Erfassen-Flaeche verbirgt.
    it("3 · der Dokumentlink steht am FENSTERBODEN — Z.52 `margin-top: auto`, in der Flex-Spalte wirksam", async () => {
      // (a) Der Sollwert kommt aus Pedis Zielbild, nicht aus diesem Test.
      expect(zielProp(zielStilZeile(52), "margin-top"), "Zielbild Z.52 ohne margin-top").toBe(
        "auto",
      );
      // (b) Die Voraussetzung, ohne die die Auto-Marge eine tote Regel waere: die Flaeche IST die
      //     Spalte von Fensterhoehe (dieselbe Bauform wie #kw-einstellungen und #section-ask).
      expect(await messen("#section-capture", "display")).toBe("flex");
      expect(await messen("#section-capture", "flex-direction")).toBe("column");

      const knopf = await rect("#send-btn");
      const link = await rect("#capture-dokument-link");
      const rumpfUnten = await lies<number>(RUMPF_UNTEN);
      const fenster = await lies<number>(FENSTERHOEHE);
      console.info(
        `JOB 3506 K2b · Fall 3 · Knopf unten ${knopf.bottom} · Link oben ${link.top} · Link unten ${link.bottom} · Rumpf unten ${rumpfUnten} · Fensterhoehe ${fenster}`,
      );
      // (c) Die WIRKUNG, nicht der Stilwert: der Link schliesst mit dem Fensterboden ab. (Chromium
      //     loest `margin-top: auto` an einem Flex-Kind zu Pixeln auf — derselbe Befund steht in
      //     tests/design/zielbild-k1-einstellungen.test.ts F1 fuer #kw-stand-zeile.)
      expect(Math.abs(link.bottom - rumpfUnten), "Link nicht am Rumpfboden").toBeLessThan(1);
      expect(Math.abs(rumpfUnten - fenster), "der Rumpf fuellt das Fenster nicht").toBeLessThan(1);
      // (d) Und er klebt NICHT mehr unter dem Knopf: zwischen beiden steht der freie Raum, den die
      //     Auto-Marge aufnimmt. Ohne sie waeren es 0px (Z.48 und Z.52 tragen keine eigene Marge).
      expect(link.top - knopf.bottom, "kein freier Raum zwischen Knopf und Link").toBeGreaterThan(
        100,
      );
      // (e) Der Link bleibt, was er war: mittig, in Z.52-Polsterung, frei bedienbar.
      expect(await messen("#capture-dokument-link", "text-align")).toBe("center");
      expect(await messen("#capture-dokument-link", "padding")).toBe("12px 16px 16px");
      expect(
        await lies<string | null>(ATTR, ["#capture-dokument-link", "aria-disabled"]),
      ).toBeNull();
      expect(await lies<string>(TEXT, "#capture-dokument-link")).toBe(
        wort("de", "captureDocumentLink"),
      );
    });

    // ---- Fall 2: die vier Saetze stehen hinter dem Zahnrad ---------------------------------------
    it("2 · die vier Saetze stehen hinter dem Zahnrad — woertlich aus DENSELBEN Schluesseln, und nur dort", async () => {
      expect(await lies<boolean>(KLICK, "#kw-zahnrad")).toBe(true);
      expect(await lies<boolean>(SICHTBAR, "#kw-einstellungen")).toBe(true);
      expect(await lies<boolean>(SICHTBAR, "#section-capture")).toBe(false);
      // Die Gruppe steht in der vorhandenen Bauform: ein Kicker DIREKT davor, dann die Gruppe
      // (.einst-gruppe) mit ihren Zeilen (.einst-zeile) — wie „VOM ADMIN EINGESTELLT".
      expect(
        await lies<number>(ZAEHLEN, "#kw-einstellungen > .einst-kicker + #einst-erfassen"),
      ).toBe(1);
      expect(await lies<number>(ZAEHLEN, "#einst-erfassen.einst-gruppe")).toBe(1);
      expect(
        await lies<number>(ZAEHLEN, "#kw-einstellungen > #einst-erfassen > .einst-zeile"),
      ).toBeGreaterThanOrEqual(4);
      // Der Kicker traegt seinen Wortlaut aus dem Woerterbuch — kein Literal im Markup.
      expect(await lies<string>(TEXT, "#kw-einstellungen [data-t=einstErfassenKicker]")).toBe(
        wort("de", "einstErfassenKicker"),
      );
      for (const [sel, key] of VIER) {
        // Der Satz steht in der Gruppe hinter dem Zahnrad …
        expect(await lies<number>(ZAEHLEN, `#einst-erfassen ${sel}`), sel).toBe(1);
        expect(await lies<boolean>(SICHTBAR, sel), sel).toBe(true);
        expect(await lies<string>(TEXT, sel), sel).toContain(wort("de", key));
        // … und GENAU EINMAL im ganzen Panel: kein Parallelweg, keine Kopie.
        expect(await lies<number>(ZAEHLEN, `[data-t=${key}]`), key).toBe(1);
        expect(await lies<number>(ZAEHLEN, `#section-capture [data-t=${key}]`), key).toBe(0);
      }
      // Der Bilder-Kasten ist derselbe Kasten (JOB 2620 D5) — mit seinem Link in die Konsole.
      expect(await lies<string>(TEXT, "#capture-bilder-hinweis-link")).toBe(
        wort("de", "sendImagesNoteLink"),
      );
      expect(await lies<string | null>(ATTR, ["#capture-bilder-hinweis-link", "href"])).toContain(
        "app.klarwerk.ai/erfassen",
      );
    });

    // ---- Fall 4: drei Sprachen -------------------------------------------------------------------
    it("4 · drei Sprachen: der Kicker und die vier Saetze folgen dem Sprachwechsel de/en/nl", async () => {
      try {
        for (const sprache of SPRACHEN) {
          await lies<boolean>(KLICK, `#lang-${sprache}`);
          await buehne().seite.waitForFunction(
            new Function(
              "arg",
              "return ((t) => document.querySelector('[data-t=einstErfassenKicker]').textContent === t)(arg);",
            ) as (a: unknown) => unknown,
            wort(sprache, "einstErfassenKicker"),
            { timeout: 10_000 },
          );
          expect(await lies<string>(TEXT, "[data-t=einstErfassenKicker]"), sprache).toBe(
            wort(sprache, "einstErfassenKicker"),
          );
          for (const [sel, key] of VIER) {
            expect(await lies<string>(TEXT, sel), `${sprache}.${key}`).toContain(
              wort(sprache, key),
            );
          }
        }
        // Die drei Fassungen des Kickers sind wirklich drei — nicht dreimal dieselbe.
        expect(new Set(SPRACHEN.map((s) => wort(s, "einstErfassenKicker"))).size).toBe(3);
      } finally {
        await lies<boolean>(KLICK, "#lang-de");
      }
    }, 40_000);

    it("P · Protokoll: Seitenfehler des laufenden Panels (Chromium pageerror) — keine", () => {
      const bu = buehne();
      console.info(
        `JOB 3506 K2b · Seitenfehler: ${bu.seitenfehler.length === 0 ? "keine" : bu.seitenfehler.join(" | ")}`,
      );
      expect(bu.seitenfehler).toEqual([]);
    });

    // ---- KALIBRIERUNG: laedt eine verstellte Fassung, deshalb ZULETZT ----------------------------
    it("K · Kalibrierung: ohne die Auto-Marge faellt Fall 3 — der Link klebt wieder unter dem Knopf", async () => {
      const bu = buehne();
      const verstellt = bu.plan.html.replace(
        "#capture-dokument-link { display: block; margin: auto 0 0;",
        "#capture-dokument-link { display: block; margin: 0;",
      );
      expect(verstellt, "die Regel Z.52 steht nicht wie erwartet im Stilblock").not.toBe(
        bu.plan.html,
      );
      bu.plan.html = verstellt;
      await bu.oeffnen();
      const knopf = await rect("#send-btn");
      const link = await rect("#capture-dokument-link");
      const rumpfUnten = await lies<number>(RUMPF_UNTEN);
      console.info(
        `JOB 3506 K2b · Kalibrierung · Knopf unten ${knopf.bottom} · Link oben ${link.top} · Link unten ${link.bottom} · Rumpf unten ${rumpfUnten}`,
      );
      // Genau die zwei Aussagen aus Fall 3 kippen — und nur sie.
      expect(Math.abs(link.top - knopf.bottom), "der Link steht doch nicht am Knopf").toBeLessThan(
        1,
      );
      expect(rumpfUnten - link.bottom, "der Link liegt doch am Boden").toBeGreaterThan(100);
      // Der Umzug hinter das Zahnrad haengt NICHT an dieser Marge: er steht auch hier.
      expect(await lies<number>(ZAEHLEN, "#einst-erfassen .einst-zeile")).toBeGreaterThanOrEqual(4);
    }, 60_000);
  },
);

describe.runIf(!zielbildDa)("JOB 3506 · K2b · Zielbild-Abgleich uebersprungen", () => {
  it("meldet das fehlende Zielbild statt eine Pruefung vorzutaeuschen", () => {
    expect(zielbildDa, "Zielbild nicht lesbar: design/klara/Erfassen.dc.html").toBe(false);
  });
});
