// ================================================================================================
// JOB 3057 · K2 „ERFASSEN“ — DIE FLAECHE WIE DAS MOCKUP, IN CHROMIUM GEMESSEN.
// ================================================================================================
//
// PEDIS ZIELBILD (design/klara/Erfassen.dc.html, 04.09.2026, „Gut.“): wer im Panel auf „Erfassen“
// schaltet, sieht seine Markierung aus Word als Karte („MARKIERUNG · 2 ABSAETZE“ plus die
// Absaetze), darunter die Zeile „Titel“, EINEN Knopf „Als Entwurf senden“ und unten den Textlink
// „Ganzes Dokument uebernehmen“. Sonst nichts.
//
// WIE HIER GEMESSEN WIRD — nach dem Muster von tests/design/zielbild-k1-ruhe.test.ts (K1, JOB 3056):
//   · Das AUSGELIEFERTE `apps/web/public/word-addin/taskpane.html` laeuft in Chromium bei 360 px;
//     office.js ist eine Attrappe, deren Markierung GENAU die zwei Absaetze des Zielbilds (Z.30/31)
//     liefert — gelesen aus der .dc.html, nicht abgeschrieben (Buehne: tests/design/k2-buehne.ts).
//   · Gemessen wird per `getComputedStyle` und `getBoundingClientRect` an den REALEN Elementen;
//     Sollwerte kommen ZEILENWEISE aus der .dc.html (jeder Fall nennt seine Zeile), Hex → rgb.
//   · Die Zustaende (Auftrag §9) werden AKTIV ausgeloest: senden (201), andere Markierung, 413,
//     Netzabbruch, Dokument-Weg, Titel von Hand, die Erklaersaetze hinter dem Zahnrad, leere
//     Markierung, kein Word.
//   · Jeder Wert, den dieser Auftrag bewusst NICHT angleicht, steht unten als OFFENER Wert mit
//     Grund und gemessenem Istwert (Kopf aus K1/JOB 3056, Farbe #9AA2B1 ohne Werkbank-Token).
//
// JOB 3555 K2b (10.09.2026) — DER DRITTE OFFENE POSTEN IST GESCHLOSSEN: die Bereich-Zeile (Z.39-45)
// stand hier mit dem Grund „kein Serverweg liefert eine Kategorienliste". `GET /api/categories`
// (JOB 3507) ist live, die Zeile ist gebaut — sie wird ab hier als scharfer Fall gemessen
// (Z.39/Z.40/Z.42), nicht mehr als offener Wert. Dass sie EHRLICH benennt, was sie weiss, misst
// tests/k2b-bereich-zeile/bereich-zeile.test.ts an echten Antworten (Liste, leer, 500, offline).
//
// JOB 3506 K2b (10.09.2026) — ZWEI DER OFFENEN POSTEN SIND GESCHLOSSEN, EINER WURDE SCHARF:
//   · Das „?“-Menue der Flaeche (#capture-mehr-btn / #capture-mehr) ist hinter das Zahnrad
//     gezogen (#einst-erfassen). Fall G misst den neuen Ort UND dass am alten nichts steht.
//   · `Z.52 margin-top: auto` war ein OFFENER Posten mit dem Grund „Flex-Spalte von Fensterhoehe
//     fehlt (K1 nicht auf main)". K1 ist gelandet; der Posten ist jetzt ein normaler, scharfer
//     Fall, der den Abstand am Fensterboden misst (s. u. bei Z.52).
//
// RED-FIRST (05.09.2026, Basis 665aec8): vor dem Umbau rot — keine `#capture-kicker`, keine
// `.capture-absatz`, Radiogruppe `#scope-selection` und Hinweisband `#capture-bilder-hinweis` im
// Sichtfeld, kein `#capture-dokument-link`. Nach dem Umbau gruen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ATTR,
  type Buehne,
  DOKUMENT_ABSAETZE,
  KLICK,
  MARKIEREN,
  RECT,
  SICHTBAR,
  SPRACHEN,
  TEXT,
  TIPPEN,
  WERT,
  ZAEHLEN,
  buehneBauen,
  kanon,
  schattenKanon,
  vierSeiten,
  wort,
  zielProp,
  zielStilZeile,
  zielTextZeile,
  zielbildDa,
} from "./k2-buehne";

type R = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

/** Die Markierung des Zielbilds: Z.30 und Z.31, woertlich aus der .dc.html. */
const MARKIERUNG = `${zielTextZeile(30)}\n${zielTextZeile(31)}`;
/** Die Vorbelegung der Zeile „Titel“: erste Zeile, 60 Zeichen (deriveDraftTitleFromSelection). */
const TITEL_VORBELEGT = zielTextZeile(30).slice(0, 60).trim();

let b: Buehne | null = null;
let fehler: string | null = null;

function buehne(): Buehne {
  expect(fehler, "Seite nicht geladen").toBeNull();
  expect(b).not.toBeNull();
  return b as Buehne;
}
const messen = (sel: string, eig: string) => buehne().messen(sel, eig);
const lies = <T>(q: string, arg?: unknown) => buehne().lies<T>(q, arg);
const seiten = (sel: string) => vierSeiten(zielProp(zielStilZeile(zeile(sel)), art(sel)));
/** Kleines Register: Selektor → Zielbildzeile und Eigenschaft (fuer die vier Seiten). */
const REGISTER: Record<string, [number, "margin" | "padding"]> = {
  "#capture-karte.margin": [28, "margin"],
  "#capture-karte.padding": [28, "padding"],
  "#capture-felder.margin": [34, "margin"],
  "label.capture-zeile.padding": [35, "padding"],
  // JOB 3555 K2b: die zweite Zeile („Bereich") traegt dieselbe Klasse und muss dieselbe Polsterung
  // messen — aber gegen IHRE Zielbildzeile, nicht gegen die der Titelzeile.
  "label.capture-zeile.bereich.padding": [39, "padding"],
  "#capture-aktion.margin": [48, "margin"],
  "#send-btn.padding": [49, "padding"],
  "#capture-dokument-link.padding": [52, "padding"],
};
const zeile = (k: string): number => (REGISTER[k] ?? [0, "margin"])[0];
const art = (k: string): "margin" | "padding" => (REGISTER[k] ?? [0, "margin"])[1];
async function vierSeitenGleich(schluessel: string, selektor: string): Promise<void> {
  const soll = seiten(schluessel);
  expect(soll, `Zielbild Z.${zeile(schluessel)} ohne ${art(schluessel)}`).not.toBeNull();
  const [o, r, u, l] = soll as [string, string, string, string];
  const a = art(schluessel);
  expect(await messen(selektor, `${a}-top`), `${selektor} ${a}-top`).toBe(o);
  expect(await messen(selektor, `${a}-right`), `${selektor} ${a}-right`).toBe(r);
  expect(await messen(selektor, `${a}-bottom`), `${selektor} ${a}-bottom`).toBe(u);
  expect(await messen(selektor, `${a}-left`), `${selektor} ${a}-left`).toBe(l);
}
async function warten(quelle: string, arg?: unknown): Promise<void> {
  await buehne().seite.waitForFunction(
    new Function("arg", `return (${quelle})(arg);`) as (arg: unknown) => unknown,
    arg,
    { timeout: 10_000 },
  );
}
/** Node-seitig warten, bis eine Bedingung gilt (z. B. ein weiterer POST angekommen ist). */
async function bis(bedingung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    if (bedingung()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`nie eingetreten: ${was}`);
}
const ERGEBNIS_DA = "() => document.getElementById('capture-ergebnis').className === ''";
const STATUS_WARN = "() => document.getElementById('send-status').className === 'status warn'";

describe.runIf(zielbildDa)(
  "JOB 3057 · K2 · Erfassen wie das Mockup — das ausgelieferte taskpane.html in Chromium bei 360 px",
  () => {
    beforeAll(async () => {
      try {
        b = await buehneBauen({ markierung: MARKIERUNG });
        await b.oeffnen();
        console.info(
          `JOB 3057 K2 · Chromium ${b.version} · Markierung aus Zielbild Z.30/31 · Seitenfehler ${JSON.stringify(b.seitenfehler)}`,
        );
      } catch (e) {
        fehler = String(e).split("\n").slice(0, 3).join(" | ");
      }
    }, 120_000);

    afterAll(async () => {
      await b?.schliessen();
    }, 60_000);

    it("S · die Seite steht: Erfassen sichtbar, Karte mit Kicker und zwei Absaetzen aus Word", async () => {
      expect(fehler).toBeNull();
      expect(await lies<boolean>(SICHTBAR, "#section-capture")).toBe(true);
      expect(await lies<boolean>(SICHTBAR, "#capture-kicker")).toBe(true);
      expect(await lies<number>(ZAEHLEN, "#capture-absaetze > p.capture-absatz")).toBe(2);
      expect(await lies<boolean>(SICHTBAR, "#capture-leer")).toBe(false);
      // Das Ereignis der Markierungsaenderung ist am Host angeschlossen (die Karte; daneben
      // duerfen weitere Bloecke des Panels dasselbe Ereignis hoeren — gemessen: das Dokument-
      // Begriffsbild KA1). Dass die Karte wirklich daran haengt, misst Fall B.
      expect(await lies<number>("() => window.__k2.handlerAnzahl()")).toBeGreaterThanOrEqual(1);
    });

    // ---- Z.15: die Flaeche ------------------------------------------------------------------------
    it("Z.15 · Papier #FAF8F5 — background-color am body", async () => {
      expect(await messen("body", "background-color")).toBe(
        kanon(zielProp(zielStilZeile(15), "background")),
      );
    });

    // ---- Z.28: die Markierungskarte ---------------------------------------------------------------
    it("Z.28 · Karte: margin 10px 16px 0 — und 16px zum Fensterrand gemessen", async () => {
      await vierSeitenGleich("#capture-karte.margin", "#capture-karte");
      const r = (await lies<R | null>(RECT, "#capture-karte")) as R;
      expect(r.left).toBe(16);
      expect(360 - r.right).toBe(16);
    });
    it("Z.28 · Karte: padding 16px", async () => {
      await vierSeitenGleich("#capture-karte.padding", "#capture-karte");
    });
    it("Z.28 · Karte: background #FFFFFF, border 1px solid #E9E5DE, border-radius 12px", async () => {
      const stil = zielStilZeile(28);
      expect(await messen("#capture-karte", "background-color")).toBe(
        kanon(zielProp(stil, "background")),
      );
      expect(await messen("#capture-karte", "border")).toBe(kanon(zielProp(stil, "border")));
      expect(await messen("#capture-karte", "border-radius")).toBe(zielProp(stil, "border-radius"));
    });
    it("Z.28 · Karte: box-shadow 0 1px 2px rgba(14,22,38,.05), 0 8px 24px -12px rgba(14,22,38,.12)", async () => {
      expect(schattenKanon(await messen("#capture-karte", "box-shadow"))).toBe(
        schattenKanon(zielProp(zielStilZeile(28), "box-shadow")),
      );
    });
    it("Z.28 · Karte: display flex, flex-direction column, gap 10px", async () => {
      const stil = zielStilZeile(28);
      expect(await messen("#capture-karte", "display")).toBe(zielProp(stil, "display"));
      expect(await messen("#capture-karte", "flex-direction")).toBe(
        zielProp(stil, "flex-direction"),
      );
      expect(await messen("#capture-karte", "row-gap")).toBe(zielProp(stil, "gap"));
    });

    // ---- Z.29: der Kicker -------------------------------------------------------------------------
    it("Z.29 · Kicker: font-size 11px, letter-spacing 0.4px, color #525B6B", async () => {
      const stil = zielStilZeile(29);
      expect(await messen("#capture-kicker", "font-size")).toBe(zielProp(stil, "font-size"));
      expect(await messen("#capture-kicker", "letter-spacing")).toBe(
        zielProp(stil, "letter-spacing"),
      );
      expect(await messen("#capture-kicker", "color")).toBe(kanon(zielProp(stil, "color")));
    });
    it("Z.29 · Kicker: Wortlaut „MARKIERUNG · 2 ABSÄTZE“ — aus dem Woerterbuch (captureKicker), gleich dem Zielbild", async () => {
      expect(await lies<string>(TEXT, "#capture-kicker")).toBe(zielTextZeile(29));
      expect(wort("de", "captureKicker", { n: "2" })).toBe(zielTextZeile(29));
    });

    // ---- Z.30/31: die Absaetze --------------------------------------------------------------------
    for (const [i, z] of [
      [0, 30],
      [1, 31],
    ] as const) {
      const sel = `#capture-absaetze > p.capture-absatz:nth-child(${i + 1})`;
      it(`Z.${z} · Absatz ${i + 1}: font-size 15px, line-height 1.55, color #1A2233, Wortlaut = Markierung`, async () => {
        const stil = zielStilZeile(z);
        expect(await messen(sel, "font-size")).toBe(zielProp(stil, "font-size"));
        const lh = Number.parseFloat((await messen(sel, "line-height")) ?? "");
        const fs = Number.parseFloat((await messen(sel, "font-size")) ?? "");
        expect(lh / fs).toBeCloseTo(Number.parseFloat(zielProp(stil, "line-height") ?? ""), 3);
        expect(await messen(sel, "color")).toBe(kanon(zielProp(stil, "color")));
        expect(await lies<string>(TEXT, sel)).toBe(zielTextZeile(z));
      });
    }

    // ---- Z.34-38: die Zeile „Titel“ ---------------------------------------------------------------
    it("Z.34 · Felder: margin 14px 16px 0, display flex, flex-direction column, gap 8px", async () => {
      await vierSeitenGleich("#capture-felder.margin", "#capture-felder");
      const stil = zielStilZeile(34);
      expect(await messen("#capture-felder", "display")).toBe(zielProp(stil, "display"));
      expect(await messen("#capture-felder", "flex-direction")).toBe(
        zielProp(stil, "flex-direction"),
      );
      expect(await messen("#capture-felder", "row-gap")).toBe(zielProp(stil, "gap"));
    });
    it("Z.35 · Zeile: display flex, align-items center, justify-content space-between, padding 12px 14px, #FFFFFF, 1px #E9E5DE, radius 10px", async () => {
      const sel = "label.capture-zeile";
      const stil = zielStilZeile(35);
      expect(await messen(sel, "display")).toBe(zielProp(stil, "display"));
      expect(await messen(sel, "align-items")).toBe(zielProp(stil, "align-items"));
      expect(await messen(sel, "justify-content")).toBe(zielProp(stil, "justify-content"));
      await vierSeitenGleich("label.capture-zeile.padding", sel);
      expect(await messen(sel, "background-color")).toBe(kanon(zielProp(stil, "background")));
      expect(await messen(sel, "border")).toBe(kanon(zielProp(stil, "border")));
      expect(await messen(sel, "border-radius")).toBe(zielProp(stil, "border-radius"));
    });
    it("Z.36 · Beschriftung „Titel“: font-size 14px, color #1A2233", async () => {
      const sel = "label.capture-zeile > span";
      const stil = zielStilZeile(36);
      expect(await messen(sel, "font-size")).toBe(zielProp(stil, "font-size"));
      expect(await messen(sel, "color")).toBe(kanon(zielProp(stil, "color")));
      expect(await lies<string>(TEXT, sel)).toBe(zielTextZeile(36));
    });
    it("Z.37 · Wert: font-size 14px, color #525B6B, editierbar, vorbelegt aus der ersten Zeile der Markierung", async () => {
      const stil = zielStilZeile(37);
      expect(await messen("#capture-titel", "font-size")).toBe(zielProp(stil, "font-size"));
      expect(await messen("#capture-titel", "color")).toBe(kanon(zielProp(stil, "color")));
      expect(await lies<string | null>(ATTR, ["#capture-titel", "readonly"])).toBeNull();
      expect(await lies<string | null>(ATTR, ["#capture-titel", "disabled"])).toBeNull();
      expect(await lies<string>(WERT, "#capture-titel")).toBe(TITEL_VORBELEGT);
      expect(TITEL_VORBELEGT.length).toBe(60);
    });

    // ---- Z.39-45: die Zeile „Bereich“ (JOB 3555 — vom OFFENEN Posten zum scharfen Fall) -----------
    // Bis JOB 3507 gab es keinen Serverweg, der eine Kategorienliste liefert; die Zeile stand
    // deshalb unten als OFFENER Wert mit genau diesem Grund. `GET /api/categories` ist seither LIVE,
    // die Zeile ist gebaut — und wird hier gemessen wie jede andere.
    // WAS DIESE BUEHNE ZEIGT: sie beantwortet `/api/categories` NICHT (ihre Auffangroute liefert
    // 404), die Zeile steht hier also in ihrer FEHLER-Lage. Genau richtig fuer diesen Fall: Mass,
    // Farbe und Ort haengen nicht an der Antwort, und dass die Lage ehrlich benannt ist, misst
    // tests/k2b-bereich-zeile/bereich-zeile.test.ts an einer echten Antwort.
    const BEREICH_ZEILE = "#capture-felder > label.capture-zeile:nth-child(2)";
    it("Z.39 · Bereich-Zeile: zweite Zeile im Feldblock, dieselbe Bauform wie „Titel“ — Polsterung, Papier, Rahmen, Radius", async () => {
      expect(await lies<number>(ZAEHLEN, "#capture-felder > label.capture-zeile")).toBe(2);
      expect(await lies<number>(ZAEHLEN, `${BEREICH_ZEILE} > #capture-bereich`)).toBe(1);
      const stil = zielStilZeile(39);
      expect(await messen(BEREICH_ZEILE, "display")).toBe(zielProp(stil, "display"));
      expect(await messen(BEREICH_ZEILE, "align-items")).toBe(zielProp(stil, "align-items"));
      expect(await messen(BEREICH_ZEILE, "justify-content")).toBe(
        zielProp(stil, "justify-content"),
      );
      await vierSeitenGleich("label.capture-zeile.bereich.padding", BEREICH_ZEILE);
      expect(await messen(BEREICH_ZEILE, "background-color")).toBe(
        kanon(zielProp(stil, "background")),
      );
      expect(await messen(BEREICH_ZEILE, "border")).toBe(kanon(zielProp(stil, "border")));
      expect(await messen(BEREICH_ZEILE, "border-radius")).toBe(zielProp(stil, "border-radius"));
    });
    it("Z.40 · Beschriftung „Bereich“: font-size 14px, color #1A2233, Wortlaut aus dem Woerterbuch", async () => {
      const sel = `${BEREICH_ZEILE} > span`;
      const stil = zielStilZeile(40);
      expect(await messen(sel, "font-size")).toBe(zielProp(stil, "font-size"));
      expect(await messen(sel, "color")).toBe(kanon(zielProp(stil, "color")));
      expect(await lies<string>(TEXT, sel)).toBe(zielTextZeile(40));
      expect(wort("de", "captureBereichLabel")).toBe(zielTextZeile(40));
    });
    it("Z.42 · Wert: font-size 14px, color #525B6B — und die Auswahl steht am rechten Rand der Zeile", async () => {
      const stil = zielStilZeile(42);
      expect(await messen("#capture-bereich", "font-size")).toBe(zielProp(stil, "font-size"));
      expect(await messen("#capture-bereich", "color")).toBe(kanon(zielProp(stil, "color")));
      // Z.41 setzt Wert und Chevron als eigene Gruppe rechts; die native Auswahl bringt beides mit.
      // Gemessen wird die WIRKUNG: ihr rechter Rand faellt mit dem Textrand der Zeile zusammen.
      const zeile = (await lies<R | null>(RECT, BEREICH_ZEILE)) as R;
      const feld = (await lies<R | null>(RECT, "#capture-bereich")) as R;
      const polsterRechts = Number.parseFloat(
        (await messen(BEREICH_ZEILE, "padding-right")) ?? "0",
      );
      expect(Math.abs(zeile.right - polsterRechts - 1 - feld.right)).toBeLessThan(1.5);
    });

    // ---- Z.48/49: der EINE Knopf ------------------------------------------------------------------
    it("Z.48 · Knopfzeile: margin 14px 16px 0", async () => {
      await vierSeitenGleich("#capture-aktion.margin", "#capture-aktion");
    });
    it("Z.49 · Knopf: text-align center, padding 13px 0, #C2500A auf #FFFFFF, radius 10px, 14px/600, volle Breite, frei", async () => {
      const stil = zielStilZeile(49);
      expect(await messen("#send-btn", "text-align")).toBe(zielProp(stil, "text-align"));
      await vierSeitenGleich("#send-btn.padding", "#send-btn");
      expect(await messen("#send-btn", "background-color")).toBe(
        kanon(zielProp(stil, "background")),
      );
      expect(await messen("#send-btn", "color")).toBe(kanon(zielProp(stil, "color")));
      expect(await messen("#send-btn", "border-radius")).toBe(zielProp(stil, "border-radius"));
      expect(await messen("#send-btn", "font-size")).toBe(zielProp(stil, "font-size"));
      expect(await messen("#send-btn", "font-weight")).toBe(zielProp(stil, "font-weight"));
      const r = (await lies<R | null>(RECT, "#send-btn")) as R;
      expect(r.left).toBe(16);
      expect(360 - r.right).toBe(16);
      expect(await lies<string | null>(ATTR, ["#send-btn", "disabled"])).toBeNull();
      expect(await lies<string | null>(ATTR, ["#send-btn", "title"])).toBeFalsy();
    });
    it("Z.49 · Knopf: Wortlaut „Als Entwurf senden“ (sendCta) — genau EIN primaerer Knopf in der Flaeche", async () => {
      expect(await lies<string>(TEXT, "#send-btn")).toBe(zielTextZeile(49));
      expect(wort("de", "sendCta")).toBe(zielTextZeile(49));
      expect(await lies<number>(ZAEHLEN, "#section-capture button.primary")).toBe(1);
    });

    // ---- Z.52: der Textlink -----------------------------------------------------------------------
    it("Z.52 · Textlink: padding 12px 16px 16px, text-align center, font-size 12.5px, color #525B6B", async () => {
      const sel = "#capture-dokument-link";
      const stil = zielStilZeile(52);
      await vierSeitenGleich("#capture-dokument-link.padding", sel);
      expect(await messen(sel, "text-align")).toBe(zielProp(stil, "text-align"));
      expect(await messen(sel, "font-size")).toBe(zielProp(stil, "font-size"));
      expect(await messen(sel, "color")).toBe(kanon(zielProp(stil, "color")));
    });
    it("Z.52 · Textlink: Wortlaut „Ganzes Dokument übernehmen“ (captureDocumentLink), frei, unter dem Knopf", async () => {
      expect(await lies<string>(TEXT, "#capture-dokument-link")).toBe(zielTextZeile(52));
      expect(wort("de", "captureDocumentLink")).toBe(zielTextZeile(52));
      expect(
        await lies<string | null>(ATTR, ["#capture-dokument-link", "aria-disabled"]),
      ).toBeNull();
      const k = (await lies<R | null>(RECT, "#send-btn")) as R;
      const l = (await lies<R | null>(RECT, "#capture-dokument-link")) as R;
      expect(l.top).toBeGreaterThanOrEqual(k.bottom);
    });
    // JOB 3506 K2b: bis hierher stand dieser Wert unten als OFFENER Posten, mit dem Grund „setzt
    // eine Flex-Spalte von Fensterhoehe voraus (Kopf und Umschalter aus K1, JOB 3056 — nicht auf
    // main)". K1 ist gelandet, die Bedingung ist erfuellt — der Posten wird ein scharfer Fall.
    // GEMESSEN WIRD DIE WIRKUNG, NICHT DER STILWERT: Chromium loest `margin-top: auto` an einem
    // Flex-Kind zu Pixeln auf (derselbe Befund steht in zielbild-k1-einstellungen.test.ts F1 fuer
    // #kw-stand-zeile). Ein Vergleich gegen die Zeichenkette „auto" waere deshalb entweder immer
    // rot oder — mit `margin-top` als Sollwert allein — wirkungslos: die Marge kann gesetzt und
    // trotzdem tot sein, wenn die Spalte fehlt. Der Fall misst darum beides: die Voraussetzung
    // (die Flaeche IST die Spalte) und den Abstand am Fensterboden.
    it("Z.52 · Textlink am FENSTERBODEN: `margin-top: auto` in einer Flex-Spalte von Fensterhoehe — Abstand gemessen, nicht behauptet", async () => {
      expect(zielProp(zielStilZeile(52), "margin-top"), "Zielbild Z.52 ohne margin-top").toBe(
        "auto",
      );
      expect(await messen("#section-capture", "display")).toBe("flex");
      expect(await messen("#section-capture", "flex-direction")).toBe("column");
      const k = (await lies<R | null>(RECT, "#send-btn")) as R;
      const l = (await lies<R | null>(RECT, "#capture-dokument-link")) as R;
      const rumpfUnten = await lies<number>("() => document.body.getBoundingClientRect().bottom");
      console.info(
        `JOB 3506 K2b · Z.52 · Knopf unten ${k.bottom} · Link oben ${l.top} · Link unten ${l.bottom} · Rumpf unten ${rumpfUnten}`,
      );
      // Der Link schliesst mit dem Rumpfboden ab — und der Rumpf fuellt das 720px-Fenster.
      expect(Math.abs(l.bottom - rumpfUnten), "Link nicht am Rumpfboden").toBeLessThan(1);
      expect(Math.abs(rumpfUnten - 720), "der Rumpf fuellt das Fenster nicht").toBeLessThan(1);
      // Und er klebt nicht mehr am Knopf: Z.48 und Z.52 tragen keine eigene Marge, der Abstand
      // ist ausschliesslich der freie Raum, den die Auto-Marge aufnimmt.
      expect(l.top - k.bottom, "kein freier Raum zwischen Knopf und Link").toBeGreaterThan(100);
    });

    // ---- Zustaende (Auftrag §9), AKTIV ausgeloest --------------------------------------------------
    it("A · Senden → 201: die Karte wird EINE Zeile „Entwurf gesendet“ mit Link „Öffnen“ auf den Entwurf; Titel und Herkunft im Payload", async () => {
      const bu = buehne();
      expect(await lies<boolean>(KLICK, "#send-btn")).toBe(true);
      await warten(ERGEBNIS_DA);
      expect(bu.posts).toHaveLength(1);
      expect(bu.posts[0]?.url).toBe("/api/drafts");
      expect(bu.posts[0]?.koerper.title).toBe(TITEL_VORBELEGT);
      expect(bu.posts[0]?.koerper.origin).toBe("word_addin");
      expect(String(bu.posts[0]?.koerper.statement)).toContain(zielTextZeile(31));
      expect(await lies<string>(TEXT, "#capture-ergebnis")).toBe(
        `${wort("de", "sendOk")}${wort("de", "openLink")}`,
      );
      expect(await lies<string>(TEXT, "#open-link")).toBe(wort("de", "openLink"));
      expect(await lies<string | null>(ATTR, ["#open-link", "href"])).toContain(
        "/capture/frontdoor?draft=draft-1",
      );
      // Karte = eine Zeile: Kicker und Absaetze sind weg, Statusfeld leer, kein Bilder-Satz.
      expect(await lies<boolean>(SICHTBAR, "#capture-kicker")).toBe(false);
      expect(await lies<number>(ZAEHLEN, "#capture-absaetze > p")).toBe(0);
      expect(await lies<boolean>(SICHTBAR, "#send-status")).toBe(false);
      expect(await lies<boolean>(SICHTBAR, "#capture-bilder-ergebnis")).toBe(false);
    });

    it("B · eine ANDERE Markierung loest die Ergebniszeile ab: Kicker „MARKIERUNG · 1 ABSATZ“, ein Absatz, Titel neu vorbelegt", async () => {
      await lies<number>(MARKIEREN, "Nur ein Absatz.");
      await warten("() => document.getElementById('capture-ergebnis').className === 'hidden'");
      expect(await lies<string>(TEXT, "#capture-kicker")).toBe(wort("de", "captureKickerEins"));
      expect(await lies<number>(ZAEHLEN, "#capture-absaetze > p.capture-absatz")).toBe(1);
      expect(await lies<string>(TEXT, "#capture-absaetze > p")).toBe("Nur ein Absatz.");
      expect(await lies<string>(WERT, "#capture-titel")).toBe("Nur ein Absatz.");
    });

    it("C · 413: EIN Satz (sendTooLarge) + EIN Knopf „Erneut senden“ — der Knopf sendet denselben Umfang erneut; keine Ergebniszeile", async () => {
      const bu = buehne();
      bu.plan.drafts = { status: 413, body: { error: "FST_ERR_CTP_BODY_TOO_LARGE" } };
      const vorher = bu.posts.length;
      await lies<boolean>(KLICK, "#send-btn");
      await warten(STATUS_WARN);
      expect(bu.posts).toHaveLength(vorher + 1);
      expect(await lies<string>(TEXT, "#send-status")).toBe(wort("de", "sendTooLarge"));
      expect(await lies<boolean>(SICHTBAR, "#send-status-btn")).toBe(true);
      expect(await lies<string>(TEXT, "#send-status-btn")).toBe(wort("de", "captureRetry"));
      expect(await lies<boolean>(SICHTBAR, "#capture-ergebnis")).toBe(false);
      await lies<boolean>(KLICK, "#send-status-btn");
      await bis(() => bu.posts.length >= vorher + 2, "der zweite POST nach „Erneut senden“");
      await warten(STATUS_WARN);
      expect(bu.posts).toHaveLength(vorher + 2);
      expect(bu.posts[bu.posts.length - 1]?.url).toBe("/api/drafts");
      expect(await lies<string>(TEXT, "#send-status")).toBe(wort("de", "sendTooLarge"));
    });

    it("D · Netzabbruch: EIN Satz (sendOffline) + EIN Knopf — nie „gesendet“ ohne Serverbestaetigung", async () => {
      const bu = buehne();
      bu.plan.drafts = "abbruch";
      const vorher = bu.posts.length;
      await lies<boolean>(KLICK, "#send-btn");
      await warten(
        "(t) => document.getElementById('send-status').textContent === t",
        wort("de", "sendOffline"),
      );
      expect(bu.posts).toHaveLength(vorher + 1);
      expect(await lies<string>(TEXT, "#send-status-btn")).toBe(wort("de", "captureRetry"));
      expect(await lies<boolean>(SICHTBAR, "#capture-ergebnis")).toBe(false);
    });

    it("E · „Ganzes Dokument übernehmen“ loest den Dokument-Weg aus: POST mit dem Dokumenttext, Ergebniszeile", async () => {
      const bu = buehne();
      bu.plan.drafts = { status: 201, body: { id: "draft-dok" } };
      const vorher = bu.posts.length;
      await lies<boolean>(KLICK, "#capture-dokument-link");
      await warten(ERGEBNIS_DA);
      expect(bu.posts).toHaveLength(vorher + 1);
      const post = bu.posts[bu.posts.length - 1];
      expect(post?.url).toBe("/api/drafts");
      expect(String(post?.koerper.statement)).toContain(DOKUMENT_ABSAETZE[1]);
      // Ohne Titel von Hand entscheidet die Ableitung am DOKUMENT (erste Zeile), nicht die Markierung.
      expect(post?.koerper.title).toBe(DOKUMENT_ABSAETZE[0]);
      expect(await lies<string | null>(ATTR, ["#open-link", "href"])).toContain("draft=draft-dok");
      // Die Seite hat NICHT navigiert (href="#" ohne Sprung).
      expect(await lies<string>("() => location.pathname")).toBe("/word-addin/taskpane.html");
    });

    it("F · Titel von Hand: „Profile in Spritzzonen“ (Z.37) reist als Titel des Entwurfs — fuer Markierung UND Dokument", async () => {
      const bu = buehne();
      await lies<number>(MARKIEREN, MARKIERUNG);
      await warten("() => document.getElementById('capture-kicker').className === ''");
      expect(await lies<boolean>(TIPPEN, ["#capture-titel", zielTextZeile(37)])).toBe(true);
      bu.plan.drafts = { status: 201, body: { id: "draft-titel" } };
      await lies<boolean>(KLICK, "#send-btn");
      await warten(ERGEBNIS_DA);
      expect(bu.posts[bu.posts.length - 1]?.koerper.title).toBe(zielTextZeile(37));
      const vorher = bu.posts.length;
      await lies<boolean>(KLICK, "#capture-dokument-link");
      await bis(() => bu.posts.length >= vorher + 1, "der POST des Dokument-Wegs");
      await warten(ERGEBNIS_DA);
      const post = bu.posts[bu.posts.length - 1];
      expect(post?.koerper.title).toBe(zielTextZeile(37));
      expect(String(post?.koerper.statement)).toContain(DOKUMENT_ABSAETZE[0]);
    });

    // ---- RUNDE 3 (BEN): Sendebestaetigungen gehoeren zu ihrem Sendelauf und dessen Inhalt --------
    it("R1 · A senden, Antwort halten, B markieren, Antwort A freigeben: die Karte zeigt B (nicht „gesendet“), die Bestaetigung fuer A steht als EIN Satz + Knopf „Öffnen“ im Statusfeld", async () => {
      const bu = buehne();
      await lies<number>(MARKIEREN, "Absatz A.");
      await warten("() => document.getElementById('capture-kicker').className === ''");
      await lies<boolean>(TIPPEN, ["#capture-titel", ""]); // Titel wieder aus der Markierung
      bu.plan.drafts = { status: 201, body: { id: "draft-A" }, halten: true };
      const vorher = bu.posts.length;
      await lies<boolean>(KLICK, "#send-btn");
      await bis(() => bu.gehalten() === 1, "die zurueckgehaltene Antwort fuer A");
      expect(bu.posts[bu.posts.length - 1]?.koerper.title).toBe("Absatz A.");
      // Waehrend A unterwegs ist: B markieren.
      await lies<number>(MARKIEREN, "Absatz B.");
      await warten("() => document.getElementById('capture-titel').value === 'Absatz B.'");
      expect(await lies<string>(TEXT, "#capture-absaetze > p")).toBe("Absatz B.");
      // Jetzt kommt die Bestaetigung fuer A.
      await bu.freigeben();
      await warten("() => document.getElementById('send-status').className === 'status ok'");
      expect(bu.posts).toHaveLength(vorher + 1);
      // Die Karte zeigt weiter B — ungesendet, mit freiem Knopf; keine Ergebniszeile ueber B.
      expect(await lies<boolean>(SICHTBAR, "#capture-ergebnis")).toBe(false);
      expect(await lies<boolean>(SICHTBAR, "#capture-kicker")).toBe(true);
      expect(await lies<string>(TEXT, "#capture-absaetze > p")).toBe("Absatz B.");
      expect(await lies<string>(WERT, "#capture-titel")).toBe("Absatz B.");
      expect(await lies<string | null>(ATTR, ["#send-btn", "disabled"])).toBeNull();
      // Die Bestaetigung fuer A: EIN Satz, EIN Knopf „Oeffnen“ — und der oeffnet GENAU Entwurf A.
      expect(await lies<string>(TEXT, "#send-status")).toBe(wort("de", "sendOk"));
      expect(await lies<string>(TEXT, "#send-status-btn")).toBe(wort("de", "openLink"));
      await lies<boolean>(
        "() => { window.__geoeffnet = null; window.open = (u) => { window.__geoeffnet = String(u); return null; }; return true; }",
      );
      await lies<boolean>(KLICK, "#send-status-btn");
      expect(await lies<string | null>("() => window.__geoeffnet")).toContain(
        "/capture/frontdoor?draft=draft-A",
      );
      // B laesst sich danach normal senden und wird zur Ergebniszeile — die Bestaetigung fuer A
      // raeumt das Statusfeld.
      bu.plan.drafts = { status: 201, body: { id: "draft-B" } };
      await lies<boolean>(KLICK, "#send-btn");
      await warten(ERGEBNIS_DA);
      expect(await lies<string | null>(ATTR, ["#open-link", "href"])).toContain("draft=draft-B");
      expect(await lies<boolean>(SICHTBAR, "#send-status")).toBe(false);
    }, 40_000);

    it("R2 · zwei Sendungen, vertauschte Antwortreihenfolge: A gehalten, B markiert und gesendet (201 sofort), dann A freigegeben — die Karte bleibt bei B, A veraendert nichts", async () => {
      const bu = buehne();
      await lies<number>(MARKIEREN, "Absatz A zwei.");
      await warten("() => document.getElementById('capture-titel').value === 'Absatz A zwei.'");
      bu.plan.drafts = { status: 201, body: { id: "draft-A2" }, halten: true };
      await lies<boolean>(KLICK, "#send-btn");
      await bis(() => bu.gehalten() === 1, "die zurueckgehaltene Antwort fuer A");
      await lies<number>(MARKIEREN, "Absatz B zwei.");
      await warten("() => document.getElementById('capture-titel').value === 'Absatz B zwei.'");
      bu.plan.drafts = { status: 201, body: { id: "draft-B2" } };
      await lies<boolean>(KLICK, "#send-btn");
      await warten(ERGEBNIS_DA);
      expect(await lies<string | null>(ATTR, ["#open-link", "href"])).toContain("draft=draft-B2");
      expect(await lies<boolean>(SICHTBAR, "#send-status")).toBe(false);
      // Jetzt trifft die aeltere Antwort A ein: sie ist ein Ruecklauf eines ueberholten Laufs.
      await bu.freigeben();
      await new Promise((r) => setTimeout(r, 300));
      expect(await lies<string | null>(ATTR, ["#open-link", "href"])).toContain("draft=draft-B2");
      expect(await lies<boolean>(SICHTBAR, "#capture-ergebnis")).toBe(true);
      expect(await lies<boolean>(SICHTBAR, "#send-status")).toBe(false);
      expect(await lies<boolean>(SICHTBAR, "#send-status-btn")).toBe(false);
      // Gegenrichtung: ein ueberholter FEHLER veraendert ebenfalls nichts.
      bu.plan.drafts = { status: 413, body: {}, halten: true };
      await lies<number>(MARKIEREN, "Absatz C.");
      await warten("() => document.getElementById('capture-titel').value === 'Absatz C.'");
      await lies<boolean>(KLICK, "#send-btn");
      await bis(() => bu.gehalten() === 1, "die zurueckgehaltene 413-Antwort");
      await lies<number>(MARKIEREN, "Absatz D.");
      await warten("() => document.getElementById('capture-titel').value === 'Absatz D.'");
      bu.plan.drafts = { status: 201, body: { id: "draft-D" } };
      await lies<boolean>(KLICK, "#send-btn");
      await warten(ERGEBNIS_DA);
      await bu.freigeben();
      await new Promise((r) => setTimeout(r, 300));
      expect(await lies<boolean>(SICHTBAR, "#send-status")).toBe(false);
      expect(await lies<string | null>(ATTR, ["#open-link", "href"])).toContain("draft=draft-D");
      // Wieder der Zielbild-Zustand fuer die Folgefaelle.
      await lies<number>(MARKIEREN, MARKIERUNG);
      await warten("() => document.getElementById('capture-kicker').className === ''");
    }, 40_000);

    // JOB 3506 K2b: Fall G misst denselben Gegenstand an seinem NEUEN Ort. Bis dahin stand das
    // „?“-Menue (#capture-mehr-btn / #capture-mehr) IN der Erfassen-Flaeche; Pedis Mockup zeigt
    // dort keinen Erklaerknopf. Die vier Saetze wohnen jetzt hinter dem Zahnrad — derselbe
    // Wortlaut, dieselben Kennungen, dieselben Woerterbuchschluessel, ein anderer Ort. Der Fall
    // hat deshalb ZWEI Haelften: in der Flaeche ist nichts mehr, hinter dem Zahnrad steht alles.
    it("G · die vier Erklaersaetze (§5a): in der Erfassen-Flaeche kein „?“ mehr — Umfang, Bilder, Pruefung, Seiten stehen hinter dem Zahnrad, und nur dort", async () => {
      // (1) Die Flaeche: der Knopf und sein Menue sind WEG, nicht verborgen.
      expect(await lies<number>(ZAEHLEN, "#section-capture #capture-mehr-btn")).toBe(0);
      expect(await lies<number>(ZAEHLEN, "#capture-mehr-btn")).toBe(0);
      expect(await lies<number>(ZAEHLEN, "#capture-mehr")).toBe(0);
      for (const key of ["sendHint", "sendImagesNote", "sendReviewNote", "scopePagesHint"]) {
        expect(await lies<number>(ZAEHLEN, `#section-capture [data-t=${key}]`), key).toBe(0);
      }
      // (2) Hinter dem Zahnrad: die vier Saetze, woertlich aus dem Woerterbuch — und je EINMAL im
      //     ganzen Panel (kein Parallelweg, keine Kopie an zwei Orten).
      expect(await lies<boolean>(KLICK, "#kw-zahnrad")).toBe(true);
      expect(await lies<boolean>(SICHTBAR, "#kw-einstellungen")).toBe(true);
      expect(await lies<boolean>(SICHTBAR, "#section-capture")).toBe(false);
      expect(await lies<string>(TEXT, "#einst-erfassen #capture-hinweis-umfang")).toBe(
        wort("de", "sendHint"),
      );
      expect(await lies<string>(TEXT, "#einst-erfassen #capture-bilder-hinweis")).toContain(
        wort("de", "sendImagesNote"),
      );
      expect(await lies<string>(TEXT, "#einst-erfassen #capture-hinweis-pruefung")).toBe(
        wort("de", "sendReviewNote"),
      );
      expect(await lies<string>(TEXT, "#einst-erfassen #capture-hinweis-seiten")).toBe(
        wort("de", "scopePagesHint"),
      );
      for (const key of ["sendHint", "sendImagesNote", "sendReviewNote", "scopePagesHint"]) {
        expect(await lies<number>(ZAEHLEN, `[data-t=${key}]`), key).toBe(1);
      }
      // (3) Zurueck auf „Erfassen" ueber den Chevron (der Weg, den ein Mensch nimmt: kwZurueck
      //     fuehrt aus den Einstellungen in den zuletzt benutzten Bereich) — die Folgefaelle
      //     messen wieder die Flaeche.
      await lies<boolean>(KLICK, "#kw-zurueck");
      expect(await lies<boolean>(SICHTBAR, "#section-capture")).toBe(true);
    });

    it("H · drei Sprachen: Kicker, Satz, Knopf, Link und Beschriftung folgen dem Sprachwechsel", async () => {
      // Zuerst zurueck in den Markierungszustand (Fall F liess die Ergebniszeile stehen): eine
      // ANDERE Markierung mit zwei Absaetzen.
      await lies<number>(MARKIEREN, "Sprachprobe eins.\nSprachprobe zwei.");
      await warten("() => document.getElementById('capture-kicker').className === ''");
      try {
        for (const sprache of ["en", "nl", "de"] as const) {
          await lies<boolean>(KLICK, `#lang-${sprache}`);
          await warten(
            "(t) => document.getElementById('send-btn').textContent === t",
            wort(sprache, "sendCta"),
          );
          expect(await lies<string>(TEXT, "#capture-kicker")).toBe(
            wort(sprache, "captureKicker", { n: "2" }),
          );
          expect(await lies<string>(TEXT, "#capture-dokument-link")).toBe(
            wort(sprache, "captureDocumentLink"),
          );
          expect(await lies<string>(TEXT, "label.capture-zeile > span")).toBe(
            wort(sprache, "captureTitleLabel"),
          );
        }
        for (const sprache of SPRACHEN) {
          expect(wort(sprache, "captureKicker")).toContain("{n}");
          expect(wort(sprache, "captureKickerEins")).not.toContain("{n}");
        }
      } finally {
        await lies<boolean>(KLICK, "#lang-de");
      }
    }, 40_000);

    it("I · ABLOESUNG: Radiogruppe, Seiten-Option, Seiten-Hinweis, Pruefhinweis, #open-block und das „?“-Menue sind weg; der Bilder-Kasten wohnt hinter dem Zahnrad", async () => {
      for (const sel of [
        "#scope-selection",
        "#scope-document",
        "#scope-pages",
        "#scope-pages-label",
        "#scope-pages-hint",
        "#send-review-note",
        "#open-block",
        '#section-capture [role="radiogroup"]',
        // JOB 3506 K2b: der alte Ort der vier Saetze — ersetzt, nicht daneben belassen.
        "#capture-mehr-btn",
        "#capture-mehr",
      ]) {
        expect(await lies<number>(ZAEHLEN, sel), sel).toBe(0);
      }
      expect(
        await lies<number>(ZAEHLEN, "#einst-erfassen > .einst-zeile > #capture-bilder-hinweis"),
      ).toBe(1);
      expect(await lies<number>(ZAEHLEN, "#section-capture #capture-bilder-hinweis")).toBe(0);
      expect(await lies<number>(ZAEHLEN, "#capture-karte")).toBe(1);
    });

    // ---- OFFENE WERTE: gemessen, begruendet, nicht behauptet ---------------------------------------
    // JOB 3555 K2b: „Z.39-45 Zeile „Bereich“ (Auswahl)“ STAND HIER — mit dem Grund „es gibt keinen
    // Serverweg, der eine Kategorienliste liefert (services/app/src/routes: keine Route); dann
    // ‚Zeile entfaellt, kein Platzhaltertext‘. Gemessen: genau eine Zeile (Titel)“. Der Grund ist
    // entfallen: `GET /api/categories` ist seit JOB 3507 live. Der Posten ist deshalb KEIN offener
    // Wert mehr, sondern die drei scharfen Faelle Z.39/Z.40/Z.42 weiter oben — ersetzt, nicht
    // daneben belassen.
    const OFFEN: [string, () => Promise<string | null>, string, string][] = [
      [
        "Z.37 Wortlaut des Titels „Profile in Spritzzonen“",
        () => lies<string | null>(WERT, "#capture-titel"),
        zielTextZeile(37),
        "die Vorbelegung ist die erste Zeile der Markierung (dieselbe Ableitung wie der Sendeweg, 60 Zeichen); ein von Hand geschriebener Titel reist als Titel (Fall F)",
      ],
      [
        "§5.1 Farbe des Satzes „Markiere Text in Word.“ (#9AA2B1)",
        () => messen("#capture-leer", "color"),
        kanon("#9AA2B1") ?? "",
        "#9AA2B1 ist kein Werkbank-Token (mega43 laesst kein Literal ausserhalb der Palette zu); gebaut mit --muted #525B6B (Tinte-2)",
      ],
      [
        "Z.17-26 Kopf: Marke, Umschalter „Fragen | Erfassen“, Zahnrad",
        () =>
          lies<string | null>(
            "() => ['#tab-ask', '#tab-capture', 'header'].map((s) => s + ':' + (document.querySelector(s) ? 'da' : 'fehlt')).join(' ')",
          ),
        "Umschalter-Pille und Zahnrad",
        "K1 (JOB 3056) — nicht Teil dieses Auftrags und nicht auf main; die Reiterleiste #tab-ask/#tab-capture bleibt der Umschalter",
      ],
    ];
    for (const [name, lesen, soll, grund] of OFFEN) {
      it(`OFFEN · ${name} — gemessen, begruendet`, async () => {
        const ist = await lesen();
        console.info(
          `JOB 3057 K2 · OFFEN · ${name}: Zielbild „${soll}“ · Panel „${String(ist)}“ · ${String(ist) === soll ? "GLEICH" : "abweichend"} · ${grund}`,
        );
        expect(ist, "reales Element liefert keinen Wert").not.toBeNull();
      });
    }

    it("P · Protokoll: Seitenfehler des laufenden Panels (Chromium pageerror) — keine", () => {
      const bu = buehne();
      console.info(
        `JOB 3057 K2 · Seitenfehler: ${bu.seitenfehler.length === 0 ? "keine" : bu.seitenfehler.join(" | ")}`,
      );
      expect(bu.seitenfehler).toEqual([]);
    });

    // ZULETZT, weil es die Seite neu laedt: ohne Markierung, dann ohne Word.
    it("J · ohne Markierung: die Karte zeigt den EINEN Satz „Markiere Text in Word.“ (15px), der Knopf ist grau #E9E5DE gesperrt — ohne Erklaersatz", async () => {
      const bu = buehne();
      bu.plan.markierung = "";
      bu.plan.drafts = { status: 201, body: { id: "draft-1" } };
      await bu.oeffnen();
      expect(await lies<boolean>(SICHTBAR, "#capture-leer")).toBe(true);
      expect(await lies<string>(TEXT, "#capture-leer")).toBe(wort("de", "captureEmpty"));
      expect(await messen("#capture-leer", "font-size")).toBe("15px");
      expect(await lies<boolean>(SICHTBAR, "#capture-kicker")).toBe(false);
      expect(await lies<number>(ZAEHLEN, "#capture-absaetze > p")).toBe(0);
      expect(await lies<string | null>(ATTR, ["#send-btn", "disabled"])).not.toBeNull();
      expect(await messen("#send-btn", "background-color")).toBe(kanon("#E9E5DE"));
      expect(await messen("#send-btn", "opacity")).toBe("1");
      expect(await lies<string | null>(ATTR, ["#send-btn", "title"])).toBeFalsy();
      expect(await lies<string>(WERT, "#capture-titel")).toBe("");
      // Der Dokument-Weg bleibt offen: angemeldet und Word da.
      expect(
        await lies<string | null>(ATTR, ["#capture-dokument-link", "aria-disabled"]),
      ).toBeNull();
      expect(await lies<boolean>(SICHTBAR, "#send-status")).toBe(false);
      expect(await lies<boolean>(SICHTBAR, "#office-hint")).toBe(false);
    });

    it("K · ohne Word: EIN Satz (noOffice) + EIN Knopf „Neu laden“; Knopf und Dokument-Link gesperrt", async () => {
      const bu = buehne();
      bu.plan.office = false;
      await bu.oeffnen();
      expect(await lies<string>(TEXT, "#office-hint")).toBe(wort("de", "noOffice"));
      expect(await lies<boolean>(SICHTBAR, "#office-hint")).toBe(true);
      expect(await lies<boolean>(SICHTBAR, "#office-hint-btn")).toBe(true);
      expect(await lies<string>(TEXT, "#office-hint-btn")).toBe(wort("de", "captureReload"));
      expect(await lies<string | null>(ATTR, ["#send-btn", "disabled"])).not.toBeNull();
      expect(await lies<string | null>(ATTR, ["#capture-dokument-link", "aria-disabled"])).toBe(
        "true",
      );
      expect(await lies<boolean>(SICHTBAR, "#capture-leer")).toBe(true);
      expect(bu.seitenfehler).toEqual([]);
    });
  },
);

describe.runIf(!zielbildDa)("JOB 3057 · Zielbild-Abgleich uebersprungen", () => {
  it("meldet das fehlende Zielbild statt eine Pruefung vorzutaeuschen", () => {
    expect(zielbildDa, "Zielbild nicht lesbar: design/klara/Erfassen.dc.html").toBe(false);
  });
});
