// ================================================================================================
// JOB 3057 · K2 — DER TEXTMESSER: AUSSER BESCHRIFTUNGEN STEHT KEIN SATZ DA.
// ================================================================================================
//
// PEDIS MASSSTAB (Auftrag §1, §5.7): auf der Flaeche „Erfassen“ steht ausser Kicker, Markierung,
// Feldwerten und Knoepfen kein Satz — jeder andere sichtbare Text ist eine Beschriftung von
// hoechstens 40 Zeichen. Der Erklaertext von heute (Umfangs-Satz, Bilder-Hinweisband, Pruef- und
// Seitenhinweis) ist aus dem Sichtfeld verschwunden; er wohnt im „?“-Menue (§5a).
//
// JOB 3506 K2b (10.09.2026) — DER ORT DES ERKLAERTEXTS IST WEITERGEZOGEN, DER MASSSTAB NICHT.
// Das „?“-Menue sass bis hierher IN der Erfassen-Flaeche; Pedis Mockup zeigt dort keinen
// Erklaerknopf. Die vier Saetze stehen jetzt hinter dem Zahnrad (#einst-erfassen), der lange
// KA7-Satz dazu (#ka7-mehr-hinweis) ebenfalls. Fuer diesen Textmesser heisst das: der Knopf
// `#capture-mehr-btn` faellt aus den Traegerlisten (T1/T2), und Fall T4 misst nicht mehr das
// Aufklappen, sondern DASS kein langer Satz mehr in der Flaeche steht und alle langen Saetze
// hinter dem Zahnrad zu finden sind. Die 40-Zeichen-Regel selbst ist unveraendert.
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
    if (el.closest('#capture-dubletten')) return 'dubletten';
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

    it("T1 · Ruhezustand mit Markierung: genau Kicker, zwei Absaetze, „Titel“, der Titelwert, Knopf und Textlink — sonst nichts, und nichts ueber 40 Zeichen", async () => {
      const traeger = await lies<Traeger[]>(TRAEGER);
      console.info(`JOB 3057 K2 · Textmesser T1: ${JSON.stringify(traeger)}`);
      expect(verstoesse(traeger)).toEqual([]);
      expect(traeger.map((t) => `${t.rolle}:${t.sel}`).sort()).toEqual(
        [
          "kicker:#capture-kicker",
          // JOB 3092 S6 (W6): die Dublettenauskunft VOR dem Einreichen — mit Markierung IMMER da
          // (Buehne: erfolgreicher Lauf ohne Treffer → „Nichts Vergleichbares gefunden (geprueft
          // HH:MM).", 46 Zeichen). Eigene Rolle wie der Kicker: eine Auskunft aus Daten, kein
          // Erklaertext; die 40-Zeichen-Regel gilt fuer Beschriftungen.
          "dubletten:#capture-dubletten-satz",
          "markierung:p.capture-absatz",
          "markierung:p.capture-absatz",
          // JOB 3174 M4b (KA7): der PRUEFSTAND dieses Entwurfs gegen die freigegebenen Regelungen
          // — „Keine frische Pruefung", „Pruefung laeuft …" oder „Kein Widerspruch · HH:MM". Der
          // Befund von KA7 lebt nur in der laufenden Sitzung; ohne diese Zeile stuende nach dem
          // Wiederoeffnen des Fensters gar nichts mehr da und die Leere liesse sich als „alles in
          // Ordnung" lesen. Anders als die Dublettenauskunft bekommt sie KEINE eigene Rolle: sie ist
          // eine BESCHRIFTUNG und haelt die 40-Zeichen-Regel dieses Auftrags ein (oben `verstoesse`
          // und die Laengenprobe in tests/ka7-konflikt-im-panel/konfliktkarte-mounted.test.ts P17e).
          // Der lange Erklaertext dazu wohnt seit JOB 3506 K2b hinter dem Zahnrad
          // (#ka7-mehr-hinweis in #einst-erfassen, Fall T4).
          "beschriftung:#ka7-einreich-hinweis",
          "beschriftung:span",
          "feldwert:#capture-titel",
          "knopf:#send-btn",
          "knopf:#capture-dokument-link",
          // JOB 3506 K2b: `knopf:#capture-mehr-btn` stand hier, solange das „?“ in der Flaeche
          // sass. Es ist weg — nicht verborgen; T4 misst den Nachweis.
        ].sort(),
      );
      const beschriftungen = traeger.filter((t) => t.rolle === "beschriftung").map((t) => t.text);
      // In Dokumentordnung: der KA7-Pruefstand steht an der Markierungskarte (nach
      // #capture-ergebnis), die Feldbeschriftung „Titel" darunter. Der KA7-Wortlaut steht hier
      // woertlich, nicht ueber `wort()`: `woerterbuch()` liest die ERSTE `de: {`-Tabelle der Seite
      // (STRINGS); die KA7-Saetze wohnen in der eigenen Tabelle KA7_TEXTE und sind dort nicht zu
      // finden. Derselbe Wortlaut ist in konfliktkarte-mounted.test.ts P17/P17c gepinnt.
      expect(beschriftungen).toEqual(["Keine frische Prüfung", wort("de", "captureTitleLabel")]);
      // Der Erklaertext von heute ist NICHT sichtbar (er wohnt im „?“-Menue, Fall T4).
      const sichtbarerText = traeger.map((t) => t.text).join("\n");
      for (const key of ["sendHint", "sendImagesNote", "sendReviewNote", "scopePagesHint"]) {
        expect(sichtbarerText, key).not.toContain(wort("de", key));
      }
      // JOB 3174: derselbe Massstab fuer den neuen Erklaertext — er steht im Menue, nicht hier.
      expect(sichtbarerText).not.toContain("Ein Befund gilt nur für die laufende Sitzung");
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
      // JOB 3506 K2b: ohne das „?“ sind es drei — Senden, Textlink, „Erneut senden“.
      expect(knoepfe.sort()).toEqual(
        ["#send-btn", "#capture-dokument-link", "#send-status-btn"].sort(),
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

    it("T4 · die langen Saetze wohnen hinter dem Zahnrad — in der Erfassen-Flaeche steht KEINER", async () => {
      // (1) In der Flaeche: kein einziger langer Satz. Das ist die scharfe Form dessen, was T4 bis
      //     JOB 3506 nur nach dem Zuklappen des Menues gemessen hat.
      const traeger = await lies<Traeger[]>(TRAEGER);
      const lang = traeger.filter((t) => t.rolle === "beschriftung" && t.text.length > GRENZE);
      expect(lang.map((t) => `${t.sel}: ${t.text}`)).toEqual([]);
      expect(verstoesse(traeger)).toEqual([]);
      // (2) Hinter dem Zahnrad: dieselben langen Saetze, sichtbar ohne Klapperei — die vier des
      //     Auftrags 3057 plus der KA7-Satz. Gezaehlt wird derselbe Massstab (eigene Textknoten
      //     ueber der Grenze, ohne Knoepfe/Links) an der Gruppe #einst-erfassen.
      await lies<boolean>(KLICK, "#kw-zahnrad");
      expect(await lies<boolean>(SICHTBAR, "#einst-erfassen")).toBe(true);
      const inGruppe = await lies<number>(
        "() => Array.from(document.querySelectorAll('#einst-erfassen *')).filter((e) => !e.closest('a, button') && Array.from(e.childNodes).some((k) => k.nodeType === 3 && k.textContent.trim().length > 40)).length",
      );
      expect(inGruppe).toBeGreaterThanOrEqual(4);
      // (3) Zurueck in die Flaeche — sie bleibt frei von Erklaertext.
      await lies<boolean>(KLICK, "#kw-zurueck");
      expect(await lies<boolean>(SICHTBAR, "#section-capture")).toBe(true);
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
