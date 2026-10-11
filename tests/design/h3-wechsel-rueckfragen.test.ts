// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg:layout` — DIE WECHSEL-RÜCKFRAGEN IM ECHTEN CHROMIUM.
// ================================================================================================
//
// WAS FEHLTE. Die Rückfragen beim Wechsel „Datei → Formular (Experten)" (`Blatt.tsx`,
// `formularOeffnen`; N-0068, BEN-1) sind bisher nur gemountet belegt
// (`tests/erfassung-einstieg/formular-und-titel-mounted.test.tsx` N1–N9c). Dort ist
// `window.confirm` durch einen Spion ersetzt — ob die GEBAUTE Seite in einem echten Browser
// überhaupt einen Dialog aufwirft, mit welchem Text, und ob Chromiums Antwort wirkt, sagt das
// nicht. `tests/erfassung-einstieg/README.md` führt das als offen: „ihre Darstellung im echten
// Browser ist nicht gesichtet".
//
// WAS HIER GEMESSEN WIRD — an `apps/web/dist` in Chromium, gegen die echte Fastify-App (Bühne aus
// `h3-blatt-buehne.ts`):
//   R0  Kalibrierung: unverändertes Blatt → KEIN Dialog, das Formular öffnet.
//   R1  geändertes, sicherbares Blatt → Chromium zeigt GENAU EINEN `confirm` mit dem vollständigen
//       deutschen Satz `einstieg.formular.sichernFrage`; „Abbrechen" → nichts gesichert, Blatt
//       und Text bleiben.
//   R2  dieselbe Lage, „OK" → genau ein Entwurf am Server, das Formular ist offen.
//   R3  nicht sicherbare Abweichung (nur Stufe gewählt) → `confirm` mit
//       `einstieg.formular.ohneSichernFrage`; „Abbrechen" → die Stufe steht weiter am Werkzeug.
//
// GRENZE, ausdrücklich: Ein `confirm` ist ein NATIVER Dialog. Er steht nicht im DOM, und das
// kopflose Chromium zeichnet ihn nicht — gemessen sind Art, vollständiger Text und Wirkung der
// Antwort, NICHT sein Pixelbild in einem sichtbaren Browserfenster. Die Nachtrag-Rückfrage
// (`nachtragFrage`, verlangt eine festgehaltene Speicheranfrage) und die Meldung bei offenem
// KI-Vorschlag (`vorschlagOffen`, verlangt ein Modell) bleiben gemountet belegt (N8–N9c, B4–B4d).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import einstieg from "../../apps/web/src/texte/einstieg";
import { type Buehne, ORIGIN, buehneAufbauen, fn } from "./h3-blatt-buehne";

const SICHERN_FRAGE = einstieg.de["einstieg.formular.sichernFrage"];
const OHNE_SICHERN_FRAGE = einstieg.de["einstieg.formular.ohneSichernFrage"];

/** Sichtbare Beschriftungen — wörtlich aus `apps/web/src/i18n.ts`, DE-Block. */
const FORMULAR_WEG = "Formular (Experten)"; // erfassen.weg.formular
// EDITOR-EINHEITLICH (K1): das Titelfeld des Expertenformulars heisst wie beim Bearbeiten „Titel".
const FORMULAR_TITEL = "Titel"; // capture.wizard.titleLabel
// Nicht „Öffentlich-intern": das ist der Ausgangswert des gesicherten Stands (`Blatt.tsx`,
// `savedStateRef`) und wäre keine Abweichung — dieselbe Wahl wie im gemounteten N6.
const VERTRAULICH = "Vertraulich"; // conf.level.vertraulich

const SATZ = "Vor dem Anfahren der Linie L4 den Druck am Ventil V2 prüfen.";

interface Dialog {
  type(): string;
  message(): string;
  accept(): Promise<void>;
  dismiss(): Promise<void>;
}

/** In der Seite: ein Menü öffnen und den Eintrag mit genau diesem Text klicken. */
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

/** In der Seite: Text in das Schreibfeld setzen — über das echte Eingabeereignis des Editors. */
const SCHREIBEN = `async (text) => {
  const feld = document.querySelector('[data-testid="blatt-text"] [role=textbox]');
  feld.focus();
  feld.innerHTML = '<p>' + text + '</p>';
  feld.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));
  return (feld.textContent || '').trim();
}`;

/** In der Seite: steht das Expertenformular (Feld „Kernaussage")? Wartet bis zu drei Sekunden. */
const FORMULAR_OFFEN = `async (beschriftung) => {
  for (let i = 0; i < 30; i++) {
    const da = [...document.querySelectorAll('label span')]
      .some((s) => (s.textContent || '').trim() === beschriftung);
    if (da) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}`;

const TEXT_VON = `(sel) => {
  const el = document.querySelector(sel);
  return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : null;
}`;

describe("H3 · Wechsel-Rückfragen „Datei → Formular“ im echten Chromium", () => {
  let b: Buehne;
  /** Jeder `confirm`/`alert`, den Chromium aufwirft: Art und vollständiger Text. */
  let dialoge: { art: string; text: string }[] = [];
  let antwort: "ok" | "abbrechen" = "abbrechen";

  beforeAll(async () => {
    b = await buehneAufbauen("/erfassen");
    if (b.fehler) {
      return;
    }
    b.seite.on("dialog", (roh: unknown) => {
      const d = roh as Dialog;
      // Ein Neuladen über ein geändertes Blatt löst die Verlassen-Wache aus. Sie ist nicht
      // Gegenstand dieser Datei und wird ohne Zählung bestätigt.
      if (d.type() === "beforeunload") {
        void d.accept();
        return;
      }
      dialoge.push({ art: d.type(), text: d.message() });
      void (antwort === "ok" ? d.accept() : d.dismiss());
    });
  }, 180_000);

  afterAll(async () => {
    await b?.schliessen();
  }, 60_000);

  async function frischesBlatt(): Promise<void> {
    await b.seite.goto(`${ORIGIN}/erfassen`, { waitUntil: "load", timeout: 60_000 });
    await b.seite.waitForFunction(
      fn("(sel) => document.querySelector(sel) !== null"),
      '[data-testid="blatt"]',
      { timeout: 30_000 },
    );
    dialoge = [];
  }

  async function zumFormular(): Promise<boolean> {
    return b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), ["blatt-werkzeug-datei", FORMULAR_WEG]);
  }

  it("R0 · Kalibrierung: unverändertes Blatt — kein Dialog, das Formular öffnet", async () => {
    expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
    await frischesBlatt();
    expect(await zumFormular(), "„Formular (Experten)“ steht nicht im Menü „Datei“").toBe(true);
    expect(dialoge).toEqual([]);
    expect(await b.seite.evaluate<boolean>(fn(FORMULAR_OFFEN), FORMULAR_TITEL)).toBe(true);
  }, 120_000);

  it("R1 · geändertes Blatt, „Abbrechen“: genau ein confirm mit dem vollständigen Satz, nichts gesichert, Text bleibt", async () => {
    expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
    await frischesBlatt();
    const vorher = (await b.frage<unknown[]>("GET", "/api/drafts")).length;
    expect(await b.seite.evaluate<string>(fn(SCHREIBEN), SATZ)).toContain("Ventil V2");
    antwort = "abbrechen";

    expect(await zumFormular()).toBe(true);

    expect(dialoge).toEqual([{ art: "confirm", text: SICHERN_FRAGE }]);
    expect((await b.frage<unknown[]>("GET", "/api/drafts")).length).toBe(vorher);
    expect(await b.seite.evaluate<boolean>(fn(FORMULAR_OFFEN), FORMULAR_TITEL)).toBe(false);
    expect(
      await b.seite.evaluate<string>(fn(TEXT_VON), '[data-testid="blatt-text"] [role="textbox"]'),
    ).toContain(SATZ);
    expect(b.seitenfehler, "pageerror").toEqual([]);
  }, 120_000);

  it("R2 · dieselbe Lage, „OK“: genau ein Entwurf entsteht am Server, das Formular ist offen", async () => {
    expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
    // Fortsetzung von R1: das Blatt trägt den ungesicherten Satz noch.
    dialoge = [];
    const vorher = (await b.frage<unknown[]>("GET", "/api/drafts")).length;
    antwort = "ok";

    expect(await zumFormular()).toBe(true);

    expect(dialoge).toEqual([{ art: "confirm", text: SICHERN_FRAGE }]);
    expect(await b.seite.evaluate<boolean>(fn(FORMULAR_OFFEN), FORMULAR_TITEL)).toBe(true);
    expect((await b.frage<unknown[]>("GET", "/api/drafts")).length).toBe(vorher + 1);
  }, 120_000);

  it("R3 · nur eine Stufe gewählt (nicht sicherbar), „Abbrechen“: confirm nennt den Wechsel, die Stufe bleibt", async () => {
    expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
    await frischesBlatt();
    expect(
      await b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), [
        "blatt-werkzeug-vertraulichkeit",
        VERTRAULICH,
      ]),
      "die Vertraulichkeitsstufe steht nicht im Menü",
    ).toBe(true);
    const vorher = (await b.frage<unknown[]>("GET", "/api/drafts")).length;
    antwort = "abbrechen";

    expect(await zumFormular()).toBe(true);

    expect(dialoge).toEqual([{ art: "confirm", text: OHNE_SICHERN_FRAGE }]);
    expect((await b.frage<unknown[]>("GET", "/api/drafts")).length).toBe(vorher);
    expect(await b.seite.evaluate<boolean>(fn(FORMULAR_OFFEN), FORMULAR_TITEL)).toBe(false);
    expect(
      await b.seite.evaluate<string>(
        fn(TEXT_VON),
        '[data-testid="blatt-werkzeug-vertraulichkeit"]',
      ),
    ).toContain(VERTRAULICH);
  }, 120_000);
});
