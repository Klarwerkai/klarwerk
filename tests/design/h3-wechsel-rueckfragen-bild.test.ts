// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg:layout` (Nacharbeit 5) — DIE WECHSEL-RÜCKFRAGEN ALS BILD.
// ================================================================================================
//
// K2 verlangt „die tatsächliche Darstellung der Wechsel-Rückfragen". `h3-wechsel-rueckfragen.test.ts`
// (R0–R3) und `h3-wirkung.test.ts` (W8/W9) belegen Art, vollständigen Text und Antwortwirkung —
// kopflos und mit sofort beantworteten Dialogen, also ohne gezeichnetes Bild.
//
// HIER: Chromium läuft SICHTBAR auf einem eigenen Xvfb-Display (`h3-anzeige.ts`). Jeder native
// Dialog bleibt offen, bis das tatsächliche Display — Browserfenster samt Dialog — aufgenommen ist;
// erst dann wird er beantwortet, und die bekannte Wirkung wird noch einmal geprüft. Eingänge wie in
// den bestehenden Fällen:
//   B1 ungesicherter Text             → sichernFrage      (wie R1)
//   B2 ausschliesslich geänderte Stufe → ohneSichernFrage  (wie R3)
//   B3 Nachtrag während verzögertem Speicherrequest → nachtragFrage (wie W8a)
//   B4 offener Vorschlag des lokalen Testmodells    → vorschlagOffen (wie W9)
//
// DIE BILDER liegen unter `BILD_WURZEL` (relativ zur Werkswurzel): je Fall `<fall>-vorher.png`,
// `<fall>-dialog.png` und `<fall>-danach.png`. Der Prüfplan sichert den Ordner als Bildartefakt.
//
// AUTOMATISCH gemessen wird: der offene Dialog verändert das Display in einem Bereich von
// Dialoggrösse, und nach der Antwort ist diese Veränderung wieder weg. OB Text und Knöpfe im Bild
// vollständig lesbar sind, zeigt die Sichtung der abgelegten Bilder — eine Texterkennung gibt es
// auf dem Prüfplatz nicht, und eine DOM-Nachbildung des Dialogs wäre kein Beleg.
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import einstieg from "../../apps/web/src/texte/einstieg";
import * as appModul from "../../services/app/src/build-app";
import {
  type ModelClient,
  ModelProvider,
  Reasoner,
  cappedModelClient,
} from "../../services/reasoner";
import { type Anzeige, type Bild, anzeigeStarten, pngSchreiben, veraenderung } from "./h3-anzeige";
import { type Buehne, ORIGIN, WURZEL, buehneAufbauen, fn } from "./h3-blatt-buehne";

/** Ausgabeordner der Bilder, relativ zur Werkswurzel — so steht er im Prüfplan (`bildartefakte`). */
const BILD_WURZEL = "test-results/wechsel-rueckfragen-bild";

const T = einstieg.de;
const SATZ = "Vor dem Anfahren der Linie L4 den Druck am Ventil V2 prüfen.";
const NACHTRAG = "Nachtrag Ventil V2";
/** Sichtbare Beschriftungen — wörtlich aus `apps/web/src/i18n.ts`, DE-Block. */
const FORMULAR_WEG = "Formular (Experten)"; // erfassen.weg.formular
const VERTRAULICH = "Vertraulich"; // conf.level.vertraulich
const INTERN = "Öffentlich-intern"; // conf.level.intern

const BLATT_TEXT = '[data-testid="blatt-text"] [role="textbox"]';
const STUFE = '[data-testid="blatt-werkzeug-vertraulichkeit"]';
const VORSCHLAG = '[data-testid="blatt-ki-vorschlag"]';

interface Dialog {
  type(): string;
  message(): string;
  accept(): Promise<void>;
  dismiss(): Promise<void>;
}

interface Entwurf {
  id: string;
  payload: { bodyHtml?: string | null };
}

interface Speicherwache {
  halten: boolean;
  festgehalten: (() => void)[];
  schreibvorgaenge: number;
}

const MENUE_WAEHLEN = `async ([werkzeug, eintrag]) => {
  const warte = () => new Promise((r) => setTimeout(r, 60));
  document.querySelector('[data-testid="' + werkzeug + '"]').click();
  await warte();
  const treffer = [...document.querySelectorAll('[role=menuitem]')]
    .find((e) => (e.textContent || '').replace(/\\s+/g, ' ').trim() === eintrag);
  if (!treffer) return false;
  treffer.click();
  await new Promise((r) => setTimeout(r, 600));
  return true;
}`;

const SCHREIBEN = `async (text) => {
  const feld = document.querySelector('[data-testid="blatt-text"] [role=textbox]');
  feld.focus();
  feld.innerHTML = '<p>' + text + '</p>';
  feld.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));
  return (feld.textContent || '').trim();
}`;

const TEXT_VON = `(sel) => {
  const el = document.querySelector(sel);
  return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : null;
}`;

const SICHERN_KLICKEN = `async () => {
  document.querySelector('[data-testid="blatt-entwurf-sichern"]').click();
  await new Promise((r) => setTimeout(r, 1500));
}`;

const VORSCHLAG_ABWARTEN = `async (sel) => {
  for (let i = 0; i < 80; i++) {
    if (document.querySelector(sel)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}`;

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function bis(bedingung: () => boolean, ms = 10_000): Promise<boolean> {
  for (let i = 0; i < ms / 100 && !bedingung(); i++) {
    await warte(100);
  }
  return bedingung();
}

describe("K2 · Wechsel-Rückfragen als Bild des tatsächlichen Displays (Chromium unter Xvfb)", () => {
  let anzeige: Anzeige;

  beforeAll(async () => {
    anzeige = await anzeigeStarten();
  }, 60_000);

  afterAll(async () => {
    await anzeige?.beenden();
  }, 30_000);

  /** Baut eine sichtbare Bühne und fängt jeden Dialog OHNE ihn zu beantworten. */
  async function sichtbareBuehne(): Promise<{ b: Buehne; offen: Dialog[] }> {
    const fenster = { width: 1280, height: 800 };
    const b = await buehneAufbauen("/erfassen", undefined, {}, fenster, false, anzeige.display);
    expect(b.fehler, "sichtbare Bühne nicht aufgebaut").toBeNull();
    const offen: Dialog[] = [];
    b.seite.on("dialog", (roh: unknown) => {
      const d = roh as Dialog;
      if (d.type() === "beforeunload") {
        void d.accept();
        return;
      }
      offen.push(d);
    });
    // Das Fenster ist gezeichnet, bevor die Vergleichsaufnahme entsteht.
    await warte(1500);
    return { b, offen };
  }

  /**
   * Wartet auf den nächsten Dialog, prüft Art und VOLLSTÄNDIGEN Text, nimmt das Display auf,
   * solange er offen ist, legt die Bilder ab und beantwortet ihn erst danach.
   */
  async function dialogAufnehmen(
    fall: string,
    offen: Dialog[],
    vorher: Bild,
    erwartet: { art: string; text: string },
    antwort: "ok" | "abbrechen",
  ): Promise<{ dialog: Bild; danach: Bild }> {
    expect(await bis(() => offen.length > 0), `${fall}: kein Dialog`).toBe(true);
    const d = offen.shift() as Dialog;
    expect({ art: d.type(), text: d.message() }).toEqual(erwartet);
    // Der Dialog bleibt offen: Zeit zum Zeichnen, dann das tatsächliche Display.
    await warte(1200);
    const dialog = anzeige.aufnehmen();
    pngSchreiben(join(WURZEL, BILD_WURZEL, `${fall}-vorher.png`), vorher);
    pngSchreiben(join(WURZEL, BILD_WURZEL, `${fall}-dialog.png`), dialog);
    const v = veraenderung(vorher, dialog);
    console.info(`${fall}: der offene Dialog verändert das Display ${JSON.stringify(v)}`);
    expect(v.punkte, `${fall}: Dialog nicht auf dem Display`).toBeGreaterThan(3000);
    expect(v.breite, `${fall}: Bereich zu schmal für einen Dialog`).toBeGreaterThan(200);
    expect(v.hoehe, `${fall}: Bereich zu niedrig für einen Dialog`).toBeGreaterThan(80);
    await (antwort === "ok" ? d.accept() : d.dismiss());
    await warte(1200);
    const danach = anzeige.aufnehmen();
    pngSchreiben(join(WURZEL, BILD_WURZEL, `${fall}-danach.png`), danach);
    return { dialog, danach };
  }

  /** Nach der Antwort ist die Veränderung durch den Dialog wieder weg. */
  function dialogVerschwunden(vorher: Bild, dialog: Bild, danach: Bild): void {
    const mitDialog = veraenderung(vorher, dialog).punkte;
    expect(veraenderung(vorher, danach).punkte, "Dialog blieb gezeichnet").toBeLessThan(
      mitDialog / 3,
    );
  }

  async function speicherwache(b: Buehne): Promise<Speicherwache> {
    const w: Speicherwache = { halten: false, festgehalten: [], schreibvorgaenge: 0 };
    await b.seite.route(`${ORIGIN}/api/drafts**`, async (route) => {
      const req = route.request();
      const pfad = new URL(req.url()).pathname;
      if (["POST", "PUT"].includes(req.method()) && /^\/api\/drafts(\/[^/]+)?$/.test(pfad)) {
        w.schreibvorgaenge += 1;
        if (w.halten) {
          await new Promise<void>((weiter) => w.festgehalten.push(weiter));
        }
      }
      await route.fallback();
    });
    return w;
  }

  function zumFormular(b: Buehne): Promise<boolean> {
    return b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), ["blatt-werkzeug-datei", FORMULAR_WEG]);
  }

  it("B1 · sichernFrage: Dialog gezeichnet; Abbrechen lässt Text und Server unverändert", async () => {
    const { b, offen } = await sichtbareBuehne();
    try {
      expect(await b.seite.evaluate<string>(fn(SCHREIBEN), SATZ)).toContain("Ventil V2");
      await warte(500);
      const vorher = anzeige.aufnehmen();
      const klick = zumFormular(b);
      const erwartet = { art: "confirm", text: T["einstieg.formular.sichernFrage"] };
      const fall = "b1-sichernFrage";
      const bilder = await dialogAufnehmen(fall, offen, vorher, erwartet, "abbrechen");
      expect(await klick).toBe(true);
      dialogVerschwunden(vorher, bilder.dialog, bilder.danach);
      expect(await b.frage<Entwurf[]>("GET", "/api/drafts")).toHaveLength(0);
      expect(await b.seite.evaluate<string>(fn(TEXT_VON), BLATT_TEXT)).toContain(SATZ);
    } finally {
      await b.schliessen();
    }
  }, 180_000);

  it("B2 · ohneSichernFrage: Dialog gezeichnet; Abbrechen hält die gewählte Stufe", async () => {
    const { b, offen } = await sichtbareBuehne();
    try {
      const stufe = ["blatt-werkzeug-vertraulichkeit", VERTRAULICH];
      expect(await b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), stufe)).toBe(true);
      await warte(500);
      const vorher = anzeige.aufnehmen();
      const klick = zumFormular(b);
      const erwartet = { art: "confirm", text: T["einstieg.formular.ohneSichernFrage"] };
      const fall = "b2-ohneSichernFrage";
      const bilder = await dialogAufnehmen(fall, offen, vorher, erwartet, "abbrechen");
      expect(await klick).toBe(true);
      dialogVerschwunden(vorher, bilder.dialog, bilder.danach);
      expect(await b.seite.evaluate<string>(fn(TEXT_VON), STUFE)).toContain(VERTRAULICH);
      expect(await b.frage<Entwurf[]>("GET", "/api/drafts")).toHaveLength(0);
    } finally {
      await b.schliessen();
    }
  }, 180_000);

  it("B3 · nachtragFrage: Dialog gezeichnet; Abbrechen hält den Nachtrag ungesichert", async () => {
    const { b, offen } = await sichtbareBuehne();
    try {
      const w = await speicherwache(b);
      expect(await b.seite.evaluate<string>(fn(SCHREIBEN), SATZ)).toContain("Ventil V2");
      w.halten = true;
      const klick = zumFormular(b);
      // Die erste Rückfrage (sichernFrage) wird bestätigt — sie ist B1, hier nur der Weg dorthin.
      expect(await bis(() => offen.length > 0), "keine sichernFrage").toBe(true);
      const erste = offen.shift() as Dialog;
      expect(erste.message()).toBe(T["einstieg.formular.sichernFrage"]);
      await erste.accept();
      expect(await klick).toBe(true);
      expect(await bis(() => w.festgehalten.length === 1), "nicht festgehalten").toBe(true);
      const mitNachtrag = `${SATZ} ${NACHTRAG}`;
      expect(await b.seite.evaluate<string>(fn(SCHREIBEN), mitNachtrag)).toContain(NACHTRAG);
      await warte(500);
      const vorher = anzeige.aufnehmen();
      w.halten = false;
      for (const weiter of w.festgehalten.splice(0)) {
        weiter();
      }
      const erwartet = { art: "confirm", text: T["einstieg.formular.nachtragFrage"] };
      await dialogAufnehmen("b3-nachtragFrage", offen, vorher, erwartet, "abbrechen");
      expect(w.schreibvorgaenge, "nach dem Abbrechen wurde gesichert").toBe(1);
      expect(await b.seite.evaluate<string>(fn(TEXT_VON), BLATT_TEXT)).toContain(NACHTRAG);
      const entwuerfe = await b.frage<Entwurf[]>("GET", "/api/drafts");
      expect(entwuerfe).toHaveLength(1);
      expect(entwuerfe[0]?.payload.bodyHtml ?? "").not.toContain(NACHTRAG);
    } finally {
      await b.schliessen();
    }
  }, 180_000);

  it("B4 · vorschlagOffen: Meldung gezeichnet; kein Speichern, der Vorschlag bleibt", async () => {
    const vorschlag = "Den Druck am Ventil V2 prüfen, erst danach die Linie L4 anfahren.";
    const complete = vi.fn<ModelClient["complete"]>().mockResolvedValue(vorschlag);
    // Derselbe Aufbau wie W7/W9 in `h3-wirkung.test.ts`: nur die Modellantwort ist vorgegeben.
    const services = appModul.buildServices();
    const modell: ModelClient = {
      name: "local:bild-test",
      model: "bild-test",
      complete: (...args) => (args[1] === "ping" ? Promise.resolve("OK") : complete(...args)),
    };
    services.reasoner = new Reasoner(
      undefined,
      undefined,
      undefined,
      undefined,
      new ModelProvider(cappedModelClient(modell, { rejectsConfidential: false })),
    );
    await services.reasoner.setTaskConfig({
      global: "deterministic",
      perTask: { assist: "local" },
    });
    const aufbau = vi.spyOn(appModul, "buildServices").mockReturnValueOnce(services);
    const { b, offen } = await sichtbareBuehne();
    try {
      const w = await speicherwache(b);
      expect(await b.seite.evaluate<string>(fn(SCHREIBEN), SATZ)).toContain("Ventil V2");
      const stufe = ["blatt-werkzeug-vertraulichkeit", INTERN];
      expect(await b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), stufe)).toBe(true);
      await b.seite.evaluate(fn(SICHERN_KLICKEN));
      expect(await b.frage<Entwurf[]>("GET", "/api/drafts")).toHaveLength(1);
      const ki = ["blatt-werkzeug-ki", "Klarer"];
      expect(await b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), ki)).toBe(true);
      expect(await b.seite.evaluate<boolean>(fn(VORSCHLAG_ABWARTEN), VORSCHLAG)).toBe(true);
      const schreibenVorher = w.schreibvorgaenge;
      await warte(500);
      const vorher = anzeige.aufnehmen();
      const klick = zumFormular(b);
      const erwartet = { art: "alert", text: T["einstieg.formular.vorschlagOffen"] };
      const bilder = await dialogAufnehmen("b4-vorschlagOffen", offen, vorher, erwartet, "ok");
      expect(await klick).toBe(true);
      dialogVerschwunden(vorher, bilder.dialog, bilder.danach);
      expect(w.schreibvorgaenge, "die Meldung hat gesichert").toBe(schreibenVorher);
      expect(await b.seite.evaluate<string>(fn(TEXT_VON), VORSCHLAG)).toContain(vorschlag);
      expect(complete).toHaveBeenCalled();
    } finally {
      aufbau.mockRestore();
      await b.schliessen();
    }
  }, 180_000);
});
