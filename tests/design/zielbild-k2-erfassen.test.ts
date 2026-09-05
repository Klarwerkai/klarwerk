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
//     Netzabbruch, Dokument-Weg, Titel von Hand, „?“-Menue, leere Markierung, kein Word.
//   · Jeder Wert, den dieser Auftrag bewusst NICHT angleicht, steht unten als OFFENER Wert mit
//     Grund und gemessenem Istwert (Bereich-Zeile ohne Serverweg, Kopf aus K1/JOB 3056,
//     Farbe #9AA2B1 ohne Werkbank-Token, `margin-top: auto` ohne Fensterhoehen-Spalte).
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

    it("G · das „?“-Menue (§5a): zu bis zum Klick, dann Umfang, Bilder, Pruefung, Seiten — die vier Saetze, die das Sichtfeld verlassen haben", async () => {
      expect(await lies<boolean>(SICHTBAR, "#capture-mehr")).toBe(false);
      expect(await lies<string | null>(ATTR, ["#capture-mehr-btn", "aria-expanded"])).toBe("false");
      await lies<boolean>(KLICK, "#capture-mehr-btn");
      expect(await lies<boolean>(SICHTBAR, "#capture-mehr")).toBe(true);
      expect(await lies<string | null>(ATTR, ["#capture-mehr-btn", "aria-expanded"])).toBe("true");
      expect(await lies<string>(TEXT, "#capture-hinweis-umfang")).toBe(wort("de", "sendHint"));
      expect(await lies<string>(TEXT, "#capture-bilder-hinweis")).toContain(
        wort("de", "sendImagesNote"),
      );
      expect(await lies<string>(TEXT, "#capture-hinweis-pruefung")).toBe(
        wort("de", "sendReviewNote"),
      );
      expect(await lies<string>(TEXT, "#capture-hinweis-seiten")).toBe(
        wort("de", "scopePagesHint"),
      );
      await lies<boolean>(KLICK, "#capture-mehr-btn");
      expect(await lies<boolean>(SICHTBAR, "#capture-mehr")).toBe(false);
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
          expect(await lies<string | null>(ATTR, ["#capture-mehr-btn", "aria-label"])).toBe(
            wort(sprache, "captureMehr"),
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

    it("I · ABLOESUNG: Radiogruppe, Seiten-Option, Seiten-Hinweis, Pruefhinweis und #open-block sind weg; der Bilder-Kasten wohnt im Menue", async () => {
      for (const sel of [
        "#scope-selection",
        "#scope-document",
        "#scope-pages",
        "#scope-pages-label",
        "#scope-pages-hint",
        "#send-review-note",
        "#open-block",
        '#section-capture [role="radiogroup"]',
      ]) {
        expect(await lies<number>(ZAEHLEN, sel), sel).toBe(0);
      }
      expect(await lies<number>(ZAEHLEN, "#capture-mehr > #capture-bilder-hinweis")).toBe(1);
      expect(await lies<number>(ZAEHLEN, "#capture-karte")).toBe(1);
    });

    // ---- OFFENE WERTE: gemessen, begruendet, nicht behauptet ---------------------------------------
    const OFFEN: [string, () => Promise<string | null>, string, string][] = [
      [
        "Z.39-45 Zeile „Bereich“ (Auswahl)",
        () =>
          lies<string | null>("() => String(document.querySelectorAll('.capture-zeile').length)"),
        "2 Zeilen (Titel, Bereich)",
        "Auftrag §5.2: Werte aus dem bestehenden Kategorien-Weg — es gibt keinen Serverweg, der eine Kategorienliste liefert (services/app/src/routes: keine Route); dann „Zeile entfaellt, kein Platzhaltertext“. Gemessen: genau eine Zeile (Titel)",
      ],
      [
        "Z.37 Wortlaut des Titels „Profile in Spritzzonen“",
        () => lies<string | null>(WERT, "#capture-titel"),
        zielTextZeile(37),
        "die Vorbelegung ist die erste Zeile der Markierung (dieselbe Ableitung wie der Sendeweg, 60 Zeichen); ein von Hand geschriebener Titel reist als Titel (Fall F)",
      ],
      [
        "Z.52 margin-top: auto (Link am Fensterboden)",
        () => messen("#capture-dokument-link", "margin-top"),
        "auto",
        "setzt eine Flex-Spalte von Fensterhoehe voraus (Kopf und Umschalter aus K1, JOB 3056 — nicht auf main); unter der Flaeche stehen heute Hilfe-Karte, Stand und Fusszeile — der Link steht mittig unter dem Knopf (Z.48/52-Abstaende gemessen)",
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
