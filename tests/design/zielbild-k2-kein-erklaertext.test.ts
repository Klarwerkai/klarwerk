// ================================================================================================
// JOB 3057 · K2 — DER TEXTMESSER: AUSSER BESCHRIFTUNGEN STEHT KEIN SATZ DA.
// ================================================================================================
//
// PEDIS MASSSTAB (Auftrag §1, §5.7): auf der Flaeche „Erfassen“ steht ausser Kicker, Markierung,
// Feldwerten und Knoepfen kein Satz — jeder andere sichtbare Text ist eine Beschriftung von
// hoechstens 40 Zeichen. Der Erklaertext von heute (Umfangs-Satz, Bilder-Hinweisband, Pruef- und
// Seitenhinweis) ist aus dem Sichtfeld verschwunden; er wohnt im „?“-Menue (§5a).
//
// WIE GEMESSEN WIRD: das ausgelieferte taskpane.html laeuft in Chromium (tests/design/k2-buehne.ts).
// Erhoben werden ALLE Elemente in `#section-capture`, die EIGENE Textknoten tragen und sichtbar
// sind (kein `display: none` in der Ahnenreihe, ein echtes Rechteck — die 1px-Vorlese-Ueberschrift
// zaehlt nicht als sichtbar). Jedes wird einer Rolle zugeordnet: Kicker, Markierung, Knopf/Link,
// Feldwert — oder „Beschriftung/Satz“, und dort gilt die 40-Zeichen-Grenze.
//
// DIE GEGENPROBE IST TEIL DER MESSUNG (Fall K): dieselbe Seite mit einem im Speicher wieder
// eingefuegten Hinweissatz — der Messer MUSS ihn melden. Sonst misst er nichts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Buehne,
  HTML,
  KLICK,
  SICHTBAR,
  buehneBauen,
  wort,
  zielTextZeile,
  zielbildDa,
} from "./k2-buehne";

const MARKIERUNG = `${zielTextZeile(30)}\n${zielTextZeile(31)}`;
const GRENZE = 40;

interface Traeger {
  sel: string;
  rolle: "kicker" | "markierung" | "knopf" | "feldwert" | "beschriftung";
  text: string;
}

/**
 * Die sichtbaren Texttraeger der Erfassen-Flaeche mit Rolle. Im Browser ausgefuehrt; die Rolle
 * haengt am Element, nicht am Text — ein Satz, der sich als Knopf verkleidet, bleibt ein Knopf
 * (und Knoepfe werden getrennt gezaehlt).
 */
const TRAEGER = `() => {
  const wurzel = document.getElementById('section-capture');
  const sichtbar = (el) => {
    let e = el;
    while (e && e !== document.body) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      e = e.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const eigenerText = (el) => Array.from(el.childNodes).filter((k) => k.nodeType === 3).map((k) => k.textContent).join(' ').replace(/\\s+/g, ' ').trim();
  const rolle = (el) => {
    if (el.id === 'capture-kicker') return 'kicker';
    if (el.classList.contains('capture-absatz')) return 'markierung';
    if (el.closest('button, a')) return 'knopf';
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return 'feldwert';
    return 'beschriftung';
  };
  const raus = [];
  for (const el of wurzel.querySelectorAll('*')) {
    const text = eigenerText(el);
    if (text === '' || !sichtbar(el)) continue;
    raus.push({ sel: (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : '')), rolle: rolle(el), text });
  }
  for (const feld of wurzel.querySelectorAll('input, select')) {
    if (sichtbar(feld) && String(feld.value || '').trim() !== '') {
      raus.push({ sel: '#' + feld.id, rolle: 'feldwert', text: String(feld.value) });
    }
  }
  return raus;
}`;

/** Die Regel des Auftrags, auf die Erhebung angewandt: was ausserhalb der vier Rollen laenger ist als 40. */
function verstoesse(traeger: Traeger[]): string[] {
  return traeger
    .filter((t) => t.rolle === "beschriftung" && t.text.length > GRENZE)
    .map((t) => `${t.sel} (${t.text.length}): „${t.text}“`);
}
/** Saetze zaehlen: Satzschlusszeichen vor Leerraum oder Ende. Ein Gedankenstrich ist kein Satzende. */
function saetze(text: string): number {
  return (text.match(/[.!?…](?=\s|$)/g) ?? []).length;
}

let b: Buehne | null = null;
let fehler: string | null = null;
function buehne(): Buehne {
  expect(fehler, "Seite nicht geladen").toBeNull();
  return b as Buehne;
}
const lies = <T>(q: string, arg?: unknown) => buehne().lies<T>(q, arg);
async function warten(quelle: string, arg?: unknown): Promise<void> {
  await buehne().seite.waitForFunction(
    new Function("arg", `return (${quelle})(arg);`) as (arg: unknown) => unknown,
    arg,
    { timeout: 10_000 },
  );
}

describe.runIf(zielbildDa)(
  "JOB 3057 · K2 · Textmesser — ausser Beschriftungen steht auf „Erfassen“ kein Satz",
  () => {
    beforeAll(async () => {
      try {
        b = await buehneBauen({ markierung: MARKIERUNG });
        await b.oeffnen();
      } catch (e) {
        fehler = String(e).split("\n").slice(0, 3).join(" | ");
      }
    }, 120_000);
    afterAll(async () => {
      await b?.schliessen();
    }, 60_000);

    it("T1 · Ruhezustand mit Markierung: genau Kicker, zwei Absaetze, „Titel“, der Titelwert, Knopf, Textlink und „?“ — sonst nichts, und nichts ueber 40 Zeichen", async () => {
      const traeger = await lies<Traeger[]>(TRAEGER);
      console.info(`JOB 3057 K2 · Textmesser T1: ${JSON.stringify(traeger)}`);
      expect(verstoesse(traeger)).toEqual([]);
      expect(traeger.map((t) => `${t.rolle}:${t.sel}`).sort()).toEqual(
        [
          "kicker:#capture-kicker",
          "markierung:p.capture-absatz",
          "markierung:p.capture-absatz",
          "beschriftung:span",
          "feldwert:#capture-titel",
          "knopf:#send-btn",
          "knopf:#capture-dokument-link",
          "knopf:#capture-mehr-btn",
        ].sort(),
      );
      const beschriftungen = traeger.filter((t) => t.rolle === "beschriftung").map((t) => t.text);
      expect(beschriftungen).toEqual([wort("de", "captureTitleLabel")]);
      // Der Erklaertext von heute ist NICHT sichtbar (er wohnt im „?“-Menue, Fall T4).
      const sichtbarerText = traeger.map((t) => t.text).join("\n");
      for (const key of ["sendHint", "sendImagesNote", "sendReviewNote", "scopePagesHint"]) {
        expect(sichtbarerText, key).not.toContain(wort("de", key));
      }
    });

    it("T2 · Fehlerfall 413: dazu kommt GENAU EIN Satz (`#send-status`) und GENAU EIN Knopf — nicht mehr", async () => {
      const bu = buehne();
      bu.plan.drafts = { status: 413, body: {} };
      await lies<boolean>(KLICK, "#send-btn");
      await warten("() => document.getElementById('send-status').className === 'status warn'");
      const traeger = await lies<Traeger[]>(TRAEGER);
      const status = traeger.filter((t) => t.sel === "#send-status");
      expect(status).toHaveLength(1);
      expect(saetze(status[0]?.text ?? "")).toBe(1);
      expect(status[0]?.text).toBe(wort("de", "sendTooLarge"));
      const knoepfe = traeger.filter((t) => t.rolle === "knopf").map((t) => t.sel);
      expect(knoepfe.sort()).toEqual(
        ["#send-btn", "#capture-dokument-link", "#capture-mehr-btn", "#send-status-btn"].sort(),
      );
      // Der Fehlersatz ist zustandsgebunden: die 40-Zeichen-Regel gilt fuer Beschriftungen; er ist
      // als EIN Satz + EIN Knopf begrenzt (§5.6) und geht mit dem naechsten Senden wieder weg.
      const uebrige = traeger.filter((t) => t.rolle === "beschriftung" && t.sel !== "#send-status");
      expect(verstoesse(uebrige)).toEqual([]);
      for (const key of [
        "sendTooLarge",
        "sendForbidden",
        "sendRateLimited",
        "sendRateLimitedUnknown",
        "sendOffline",
        "sendError",
        "noOffice",
      ]) {
        for (const sprache of ["de", "en", "nl"] as const) {
          expect(saetze(wort(sprache, key, { n: "9", detail: "x" })), `${sprache}.${key}`).toBe(1);
        }
      }
    });

    it("T3 · Erfolg 201: die Ergebniszeile ist EINE Zeile („Entwurf gesendet“ + Link), keine Beschriftung ueber 40", async () => {
      const bu = buehne();
      bu.plan.drafts = { status: 201, body: { id: "draft-1" } };
      await lies<boolean>(KLICK, "#send-btn");
      await warten("() => document.getElementById('capture-ergebnis').className === ''");
      const traeger = await lies<Traeger[]>(TRAEGER);
      expect(verstoesse(traeger)).toEqual([]);
      // In Dokumentordnung: erst die Ergebniszeile in der Karte, dann die Beschriftung „Titel“.
      const zeile = traeger.filter((t) => t.sel.startsWith("span") && t.rolle === "beschriftung");
      expect(zeile.map((t) => t.text)).toEqual([
        wort("de", "sendOk"),
        wort("de", "captureTitleLabel"),
      ]);
      expect(traeger.some((t) => t.sel === "#open-link" && t.rolle === "knopf")).toBe(true);
      expect(traeger.some((t) => t.rolle === "kicker")).toBe(false);
    });

    it("T4 · das „?“-Menue traegt die langen Saetze — erst nach dem Klick, und nur dort", async () => {
      await lies<boolean>(KLICK, "#capture-mehr-btn");
      expect(await lies<boolean>(SICHTBAR, "#capture-mehr")).toBe(true);
      const traeger = await lies<Traeger[]>(TRAEGER);
      const lang = traeger.filter((t) => t.rolle === "beschriftung" && t.text.length > GRENZE);
      expect(lang.length).toBeGreaterThanOrEqual(4);
      // Dieselbe Zaehlung, nur INNERHALB des Menues (ohne Knoepfe/Links, die oben nicht als
      // Beschriftung zaehlen): jeder lange Satz wohnt im Menue, keiner ausserhalb.
      const imMenue = await lies<number>(
        "() => Array.from(document.querySelectorAll('#capture-mehr *')).filter((e) => !e.closest('a, button') && Array.from(e.childNodes).some((k) => k.nodeType === 3 && k.textContent.trim().length > 40)).length",
      );
      expect(imMenue).toBe(lang.length);
      await lies<boolean>(KLICK, "#capture-mehr-btn");
      expect(verstoesse(await lies<Traeger[]>(TRAEGER))).toEqual([]);
    });

    it("T5 · ohne Markierung: der EINE Satz „Markiere Text in Word.“ ist eine Beschriftung unter 40 Zeichen", async () => {
      const bu = buehne();
      bu.plan.markierung = "";
      await bu.oeffnen();
      const traeger = await lies<Traeger[]>(TRAEGER);
      expect(verstoesse(traeger)).toEqual([]);
      const leer = traeger.find((t) => t.sel === "#capture-leer");
      expect(leer?.text).toBe(wort("de", "captureEmpty"));
      expect((leer?.text ?? "").length).toBeLessThanOrEqual(GRENZE);
      for (const sprache of ["de", "en", "nl"] as const) {
        expect(wort(sprache, "captureEmpty").length).toBeLessThanOrEqual(GRENZE);
        expect(wort(sprache, "captureTitleLabel").length).toBeLessThanOrEqual(GRENZE);
      }
    });

    it("K · KALIBRIERUNG: derselbe Messer meldet einen wieder eingefuegten Hinweissatz", async () => {
      const bu = buehne();
      const anker = '<div id="capture-aktion">';
      expect(HTML.split(anker).length, "Anker im Markup nicht eindeutig").toBe(2);
      bu.plan.html = HTML.replace(
        anker,
        `<p class="muted" id="k2-sonde">${wort("de", "sendHint")}</p>${anker}`,
      );
      bu.plan.markierung = MARKIERUNG;
      try {
        await bu.oeffnen();
        const traeger = await lies<Traeger[]>(TRAEGER);
        const gefunden = verstoesse(traeger);
        expect(gefunden).toHaveLength(1);
        expect(gefunden[0]).toContain("#k2-sonde");
      } finally {
        bu.plan.html = HTML;
      }
    });
  },
);

describe.runIf(!zielbildDa)("JOB 3057 · Textmesser uebersprungen", () => {
  it("meldet das fehlende Zielbild statt eine Pruefung vorzutaeuschen", () => {
    expect(zielbildDa).toBe(false);
  });
});
