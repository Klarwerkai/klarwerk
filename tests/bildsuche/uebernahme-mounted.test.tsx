// @vitest-environment jsdom
// ================================================================================================
// JOB 3095 · M5 — BILD AUS DEM BESTAND: SUCHEN, SEHEN, ÜBERNEHMEN — GEMESSEN AM GESPEICHERTEN RUMPF
// ================================================================================================
//
// Derselbe Verbraucher wie in JOB 3083 (`tests/bildzuordnung-speicherweg`): EIN Zustand `bodyHtml`,
// daran das Studio (`onApply`) UND der äußere `RichTextEditor` (`onChange`). Gemessen wird nie ein
// Editor-DOM, sondern die Fassung, die beim Verbraucher ankommt und gespeichert würde (`koerper`).
//
// Der Weg des Autors: Studio → Bild-Menü → „Bild aus dem Bestand …“ → Suchwort → Trefferkarte
// (Bild, Unterschrift, Herkunft) → „Übernehmen“ → „In den Entwurf übernehmen“. Danach steht im
// Rumpf EINE figure mit dem Bild, der ORIGINALEN Unterschrift und der Herkunftszeile; Bild und
// Unterschrift tragen dieselbe Kennung — und das überlebt das Wiederöffnen.
//
// Red-first: vor JOB 3095 gab es weder den Knopf noch die Suche (der Test scheitert am fehlenden
// Knopf).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import type { LibraryImageSearchResponse } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { D44_EDITOR_MARKE } from "../../apps/web/src/components/D44Gliederung";
import { KnowledgeInputStudio } from "../../apps/web/src/components/KnowledgeInputStudio";
import { RichTextEditor } from "../../apps/web/src/components/RichTextEditor";
import i18n from "../../apps/web/src/i18n";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CAPTION = "Schraubverbindung M12 mit Sicherungsblech";
const QUELLE = "Wartungsnotiz Pumpe P-12";
const SRC = "/api/objects/s1/raw";
const GEPRUEFT = "2026-09-05T18:30:00.000Z";

const TREFFER: LibraryImageSearchResponse = {
  treffer: [
    {
      imageId: "schraub-1",
      koId: "ko-schraub",
      koTitel: QUELLE,
      version: 3,
      pruefstand: "validiert",
      caption: CAPTION,
      name: null,
      gefundenUeber: ["beschreibung"],
      thumbnailUrl: SRC,
    },
  ],
  geprueft: GEPRUEFT,
  gedeckelt: false,
};
/** Runde 2: ein Bild OHNE Beschreibung, gefunden über seine Benennung (Dateiname). */
const NAME = "Schraubenschluessel_SW17.png";
const NUR_NAME: LibraryImageSearchResponse = {
  treffer: [
    {
      imageId: "name-1",
      koId: "ko-name",
      koTitel: QUELLE,
      version: 3,
      pruefstand: "offen",
      caption: "",
      name: NAME,
      gefundenUeber: ["name"],
      thumbnailUrl: "/api/objects/n1/raw",
    },
  ],
  geprueft: GEPRUEFT,
  gedeckelt: false,
};
const LEER: LibraryImageSearchResponse = { treffer: [], geprueft: GEPRUEFT, gedeckelt: false };

const START = "<p>Neuer Eintrag zur Wartung.</p>";

/** Antworten des Servers, in Reihenfolge der Anfragen. `null` heißt: die Suche scheitert (500). */
let antworten: (LibraryImageSearchResponse | null)[] = [];
const anfragen: string[] = [];

function fetchStub(url: string): Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
}> {
  if (!url.includes("/api/library/images")) {
    // Alles andere (Anmeldestatus, Rollen, Grenzen) verhält sich wie ohne Server: die Anfrage
    // scheitert, die Provider fangen das wie bisher ab. Nur die Bildsuche wird hier bedient.
    return Promise.reject(new TypeError(`fetch failed: ${url}`));
  }
  anfragen.push(url);
  const naechste = antworten.shift();
  if (naechste === undefined) {
    throw new Error(`Unerwartete Anfrage ohne vorbereitete Antwort: ${url}`);
  }
  if (naechste === null) {
    return Promise.resolve({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve(JSON.stringify({ error: "INTERNAL", message: "kaputt" })),
    });
  }
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: "OK",
    text: () => Promise.resolve(JSON.stringify(naechste)),
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
/** Der Zustand des Verbrauchers — DAS, was gespeichert würde. Kein Editor-DOM. */
let koerper = "";
let start = START;

function Host(): JSX.Element {
  const [body, setBody] = useState(start);
  const [offen, setOffen] = useState(false);
  koerper = body;
  return mitBildbeschreibung(
    createElement(
      "div",
      null,
      createElement(
        "button",
        { type: "button", "data-testid": "studio-auf", onClick: () => setOffen(true) },
        "Studio",
      ),
      createElement(KnowledgeInputStudio, {
        open: offen,
        onClose: () => setOffen(false),
        bodyHtml: body,
        onApply: (next: string) => setBody(next),
        runAssist: async () => "",
        documentTitle: "Neuer Eintrag",
      }),
      createElement(RichTextEditor, {
        value: body,
        documentTitle: "Neuer Eintrag",
        onChange: (html: string) => setBody(html),
      }),
    ),
    async () => ({ text: "Vorschlag", demo: false }),
  );
}

function mount(inhalt: string = START): void {
  start = inhalt;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(MemoryRouter, { initialEntries: ["/erfassen"] }, createElement(Host)),
          ),
        ),
      ),
    ),
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  antworten = [];
  anfragen.length = 0;
  vi.stubGlobal("fetch", fetchStub);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function ruhe(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
}

function studioFlaeche(): HTMLElement {
  const el = document.querySelector(`[${D44_EDITOR_MARKE}]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error("Das Studio ist nicht offen");
  }
  return el;
}

function studioOeffnen(): void {
  const knopf = document.querySelector('[data-testid="studio-auf"]');
  if (!(knopf instanceof HTMLElement)) {
    throw new Error("Der Studio-Knopf fehlt");
  }
  act(() => knopf.click());
}

function testid(id: string, wurzel: ParentNode = document): HTMLElement {
  const el = wurzel.querySelector(`[data-testid="${id}"]`);
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Element [data-testid="${id}"] fehlt`);
  }
  return el;
}

/** Der Cursor am ENDE des Editors — der Regelfall des Autors, der gerade zu Ende geschrieben hat. */
function cursorAmEnde(editor: HTMLElement): Range {
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  return range;
}

/**
 * Im Studio-Editor: Bild-Menü öffnen und „Bild aus dem Bestand …“ wählen. Der Cursor steht im
 * Studio-Editor — wie beim Autor, der gerade schreibt; wo genau, bestimmt `cursor` (Runde 3, U10:
 * auch mitten im Text).
 */
function bildsucheOeffnen(cursor: (editor: HTMLElement) => Range = cursorAmEnde): void {
  const studio = studioFlaeche();
  const editor = studio.querySelector('[contenteditable="true"].prose-kw');
  if (!(editor instanceof HTMLElement)) {
    throw new Error("Der Studio-Editor ist nicht gerendert");
  }
  act(() => {
    editor.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(cursor(editor));
  });
  const bildKnopf = Array.from(studio.querySelectorAll("button")).find(
    (b) => b.getAttribute("title") === i18n.t("editor.image"),
  );
  if (bildKnopf === undefined) {
    throw new Error("Der Bild-Knopf des Studio-Editors fehlt");
  }
  act(() => bildKnopf.click());
  act(() => testid("bild-bestand-open", studio).click());
}

async function suchen(text: string): Promise<void> {
  const feld = testid("bild-bestand-suche");
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error("Das Suchfeld ist kein Eingabefeld");
  }
  act(() => {
    // React liest den Wert über den nativen Setter — so, wie ein Tippen ihn setzt.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const form = feld.closest("form");
  if (form === null) {
    throw new Error("Das Suchfeld steht in keinem Formular");
  }
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await ruhe();
}

function dialog(): HTMLElement {
  const titel = Array.from(document.querySelectorAll("h2, h3")).find(
    (h) => (h.textContent ?? "").trim() === i18n.t("editor.imageSearch.title"),
  );
  const el = titel?.closest("[role='dialog']") ?? titel?.parentElement?.parentElement;
  if (!(el instanceof HTMLElement)) {
    throw new Error("Der Dialog „Bild aus dem Bestand“ ist nicht offen");
  }
  return el;
}

function uebernehmenInsStudio(): void {
  act(() => testid("bild-bestand-uebernehmen").click());
}

function entwurfUebernehmen(): void {
  const knopf = Array.from(document.querySelectorAll("button")).find(
    (b) => (b.textContent ?? "").trim() === i18n.t("studio.apply"),
  );
  if (knopf === undefined) {
    throw new Error("Der Übernahme-Knopf fehlt");
  }
  act(() => knopf.click());
}

/** Die übernommene Fassung als Baum — HIER wird gemessen, was gespeichert würde. */
function fassung(): HTMLDivElement {
  const pruef = document.createElement("div");
  pruef.innerHTML = koerper;
  return pruef;
}

function herkunftSatz(): string {
  return i18n.t("editor.imageSearch.herkunft", {
    quelle: QUELLE,
    version: 3,
    pruefstand: i18n.t("status.validiert"),
  });
}

// ================================================================================================
// U1–U3 — DER WEG DES AUTORS BIS IN DEN GESPEICHERTEN RUMPF
// ================================================================================================
describe("JOB 3095 · U1 — die Trefferkarte zeigt Bild, Unterschrift und Herkunft", () => {
  beforeEach(() => mount());

  it("U1 · Suche „Schraub“ → eine Karte mit Bild, originaler Unterschrift und Herkunftszeile", async () => {
    antworten = [TREFFER];
    studioOeffnen();
    bildsucheOeffnen();
    await suchen("Schraub");
    expect(anfragen[0], "die Anfrage geht an die Bildsuche des Servers").toContain(
      "/api/library/images?q=Schraub",
    );
    const karten = document.querySelectorAll('[data-testid="bild-bestand-treffer"]');
    expect(karten).toHaveLength(1);
    const karte = karten[0] as HTMLElement;
    expect(karte.querySelector("img")?.getAttribute("src")).toBe(SRC);
    expect(testid("bild-bestand-caption", karte).textContent).toBe(CAPTION);
    expect(testid("bild-bestand-herkunft", karte).textContent).toBe(herkunftSatz());
    // Die Prüfzeit steht dabei — die Aussage hängt an ihrer Datengrundlage.
    expect(dialog().textContent).toContain(
      i18n.t("editor.imageSearch.checked", { zeit: "" }).trim(),
    );
  });
});

describe("JOB 3095 · U2 — die Übernahme steht in der GESPEICHERTEN Fassung", () => {
  beforeEach(() => mount());

  it("U2 · figure mit Bild, ORIGINALER Unterschrift und Herkunftszeile; Bild und Unterschrift teilen die Kennung", async () => {
    antworten = [TREFFER];
    studioOeffnen();
    bildsucheOeffnen();
    await suchen("Schraub");
    uebernehmenInsStudio();
    // Der Dialog ist zu, das Bild steht im Studio-Entwurf …
    expect(document.querySelector('[data-testid="bild-bestand-suche"]')).toBeNull();
    expect(studioFlaeche().querySelector("figure img")?.getAttribute("src")).toBe(SRC);
    // … und NOCH nicht beim Verbraucher: kein Auto-Save.
    expect(koerper).toBe(START);

    entwurfUebernehmen();
    const baum = fassung();
    const figures = baum.querySelectorAll("figure");
    expect(figures, "genau eine figure im gespeicherten Rumpf").toHaveLength(1);
    const figure = figures[0] as HTMLElement;
    const img = figure.querySelector(":scope > img");
    const caps = figure.querySelectorAll(":scope > figcaption");
    expect(img?.getAttribute("src")).toBe(SRC);
    expect(caps).toHaveLength(1);
    expect(caps[0]?.textContent, "die Unterschrift ist die ORIGINALE, unverändert").toBe(CAPTION);
    const kennung = img?.getAttribute("data-image-id") ?? "";
    expect(kennung.length, "das Bild trägt eine Kennung").toBeGreaterThan(0);
    expect(caps[0]?.getAttribute("data-image-id"), "Bild und Unterschrift teilen die Kennung").toBe(
      kennung,
    );
    // Die Herkunftszeile steht IN der figure, aber NICHT in der Unterschrift.
    const herkunft = figure.querySelector(":scope > p");
    expect(herkunft?.textContent).toBe(herkunftSatz());
    expect(herkunft?.textContent).toContain(QUELLE);
    expect(herkunft?.textContent).toContain("3");
    expect(herkunft?.textContent).toContain(i18n.t("status.validiert"));
    // Der ursprüngliche Text ist noch da — eingefügt, nicht ersetzt.
    expect(koerper).toContain("Neuer Eintrag zur Wartung.");
  });
});

describe("JOB 3095 · U3 — die Zuordnung überlebt das Wiederöffnen", () => {
  it("U3 · gespeicherte Fassung neu geladen → Studio geöffnet → übernommen: Bild, Unterschrift, Herkunft unverändert", async () => {
    mount();
    antworten = [TREFFER];
    studioOeffnen();
    bildsucheOeffnen();
    await suchen("Schraub");
    uebernehmenInsStudio();
    entwurfUebernehmen();
    const gespeichert = koerper;
    act(() => root.unmount());
    container.remove();

    // Wiederöffnen: derselbe Verbraucher, gestartet mit der gespeicherten Fassung.
    mount(gespeichert);
    expect(koerper).toBe(gespeichert);
    studioOeffnen();
    entwurfUebernehmen();
    const baum = fassung();
    const figure = baum.querySelector("figure");
    const img = figure?.querySelector(":scope > img");
    const cap = figure?.querySelector(":scope > figcaption");
    expect(img?.getAttribute("src")).toBe(SRC);
    expect(cap?.textContent).toBe(CAPTION);
    expect(cap?.getAttribute("data-image-id")).toBe(img?.getAttribute("data-image-id"));
    expect(figure?.querySelector(":scope > p")?.textContent).toBe(herkunftSatz());
    // Keine zweite figure, keine verwaiste Fußnote: eine Fassung, eine Wahrheit.
    expect(baum.querySelectorAll("figure")).toHaveLength(1);
    for (const f of Array.from(baum.querySelectorAll("figcaption"))) {
      expect(f.closest("figure")).not.toBeNull();
    }
  });
});

// ================================================================================================
// U10 (Runde 3, Bens Prüflücke 6) — DER CURSOR MITTEN IM TEXT: das Bild landet DORT, nicht am Ende
// ================================================================================================
describe("JOB 3095 · U10 — die Übernahme trifft die Cursorposition mitten im Text", () => {
  const VORHER = "Vorher steht dieser Satz.";
  const NACHHER = "Nachher steht dieser Satz.";

  it("U10 · Cursor zwischen zwei Sätzen → figure zwischen beiden, beide Sätze bleiben", async () => {
    mount(`<p>${VORHER} ${NACHHER}</p>`);
    antworten = [TREFFER];
    studioOeffnen();
    bildsucheOeffnen((editor) => {
      // Der Cursor steht NACH dem ersten Satz (samt Leerzeichen), mitten im Textknoten.
      const text = editor.querySelector("p")?.firstChild;
      if (!(text instanceof Text)) {
        throw new Error("Der Absatz des Studio-Editors hat keinen Textknoten");
      }
      const range = document.createRange();
      range.setStart(text, VORHER.length + 1);
      range.collapse(true);
      return range;
    });
    await suchen("Schraub");
    uebernehmenInsStudio();
    entwurfUebernehmen();
    const baum = fassung();
    const figure = baum.querySelector("figure");
    expect(figure, "die figure steht in der gespeicherten Fassung").not.toBeNull();
    expect(figure?.querySelector(":scope > figcaption")?.textContent).toBe(CAPTION);
    expect(figure?.querySelector(":scope > p")?.textContent).toBe(herkunftSatz());
    // Reihenfolge im Rumpf: erster Satz → Bild → zweiter Satz. Am Ende angehängt wäre falsch.
    const reihenfolge = baum.textContent ?? "";
    const iVorher = reihenfolge.indexOf(VORHER);
    const iBild = reihenfolge.indexOf(CAPTION);
    const iNachher = reihenfolge.indexOf(NACHHER);
    expect(iVorher, "der erste Satz ist noch da").toBeGreaterThanOrEqual(0);
    expect(iNachher, "der zweite Satz ist noch da").toBeGreaterThanOrEqual(0);
    expect(iBild, "das Bild steht NACH dem ersten Satz").toBeGreaterThan(iVorher);
    expect(iNachher, "das Bild steht VOR dem zweiten Satz").toBeGreaterThan(iBild);
    expect(baum.querySelectorAll("figure")).toHaveLength(1);
  });
});

// ================================================================================================
// U11 (Runde 3, Bens Korrekturpflicht 1, Flächenseite) — „Mehr Treffer als angezeigt“ steht NUR,
// wenn der Server den Deckel nachgewiesen hat
// ================================================================================================
describe("JOB 3095 · U11 — der Deckel-Satz folgt allein der Serverauskunft", () => {
  beforeEach(() => mount());

  it("U11 · gedeckelt=false → kein „Mehr Treffer“; gedeckelt=true → der Satz steht", async () => {
    antworten = [TREFFER, { ...TREFFER, gedeckelt: true }];
    studioOeffnen();
    bildsucheOeffnen();
    await suchen("Schraub");
    expect(dialog().textContent).not.toContain(i18n.t("editor.imageSearch.capped"));
    await suchen("Schraubverbindung");
    expect(dialog().textContent).toContain(i18n.t("editor.imageSearch.capped"));
  });
});

// ================================================================================================
// U8/U9 (Runde 2) — WORÜBER GEFUNDEN WURDE, STEHT AUF DER KARTE; EIN FEHLENDES FELD WIRD GESAGT
// ================================================================================================
describe("JOB 3095 · U8/U9 — Beschreibung oder Benennung: die Karte sagt, worüber gefunden wurde", () => {
  beforeEach(() => mount());

  it("U8 · Treffer über die Beschreibung: Karte nennt „Beschreibung“ als Fundstelle, keine erfundene Benennung", async () => {
    antworten = [TREFFER];
    studioOeffnen();
    bildsucheOeffnen();
    await suchen("Schraub");
    const karte = testid("bild-bestand-treffer");
    expect(testid("bild-bestand-gefunden", karte).textContent).toContain(
      i18n.t("editor.imageSearch.via.beschreibung"),
    );
    expect(testid("bild-bestand-gefunden", karte).textContent).not.toContain(
      i18n.t("editor.imageSearch.via.name"),
    );
    // Kein Name im Bestand → kein Name auf der Karte (nicht erfunden, nicht „null“).
    expect(karte.querySelector('[data-testid="bild-bestand-name"]')).toBeNull();
    expect(karte.textContent).not.toContain("null");
  });

  it("U9 · Treffer nur über die Benennung: „ohne Beschreibung“, Name sichtbar, Übernahme mit leerer Unterschrift und Name als alt", async () => {
    antworten = [NUR_NAME];
    studioOeffnen();
    bildsucheOeffnen();
    await suchen("SW17");
    const karte = testid("bild-bestand-treffer");
    expect(testid("bild-bestand-caption", karte).textContent).toBe(
      i18n.t("editor.imageSearch.noCaption"),
    );
    expect(testid("bild-bestand-name", karte).textContent).toContain(NAME);
    expect(testid("bild-bestand-gefunden", karte).textContent).toContain(
      i18n.t("editor.imageSearch.via.name"),
    );
    uebernehmenInsStudio();
    entwurfUebernehmen();
    const figure = fassung().querySelector("figure");
    const img = figure?.querySelector(":scope > img");
    const cap = figure?.querySelector(":scope > figcaption");
    expect(img?.getAttribute("src")).toBe("/api/objects/n1/raw");
    expect(img?.getAttribute("alt")).toBe(NAME);
    // Die Unterschrift bleibt LEER — „ohne Beschreibung“ wird nicht als Text in den Rumpf geschrieben.
    expect(cap?.textContent).toBe("");
    expect(cap?.getAttribute("data-image-id")).toBe(img?.getAttribute("data-image-id"));
    expect(figure?.querySelector(":scope > p")?.textContent).toContain(QUELLE);
  });
});

// ================================================================================================
// U4–U6 — EHRLICHKEIT: LEER, FEHLER, GESCHEITERTE AUFFRISCHUNG (Zustandsmodell §9)
// ================================================================================================
describe("JOB 3095 · U4–U6 — die Fläche sagt, was sie weiß, und zeigt nie ein Platzhalterbild", () => {
  beforeEach(() => mount());

  it("U4 · kein Treffer → „Kein Bild mit dieser Beschreibung im Bestand (geprüft <Zeit>)“, kein Bild", async () => {
    antworten = [LEER];
    studioOeffnen();
    bildsucheOeffnen();
    await suchen("Gibtesnicht");
    const d = dialog();
    expect(d.textContent).toContain("Kein Bild mit dieser Beschreibung im Bestand (geprüft ");
    expect(d.querySelector("img"), "kein Platzhalterbild").toBeNull();
    expect(d.querySelectorAll('[data-testid="bild-bestand-treffer"]')).toHaveLength(0);
  });

  it("U5 · Suchfehler → „Suche nicht möglich“ — keine Negativaussage, kein Bild", async () => {
    antworten = [null];
    studioOeffnen();
    bildsucheOeffnen();
    await suchen("Schraub");
    const d = dialog();
    expect(d.textContent).toContain(i18n.t("editor.imageSearch.error"));
    expect(d.textContent).not.toContain("Kein Bild mit dieser Beschreibung");
    expect(d.querySelector("img")).toBeNull();
  });

  it("U6 · gescheiterte Auffrischung lässt die letzten Treffer stehen und sagt es", async () => {
    antworten = [TREFFER, null];
    studioOeffnen();
    bildsucheOeffnen();
    await suchen("Schraub");
    expect(document.querySelectorAll('[data-testid="bild-bestand-treffer"]')).toHaveLength(1);
    await suchen("Schraubverbindung");
    const d = dialog();
    // Die zuletzt erfolgreich geholten Treffer bleiben SICHTBAR …
    expect(d.querySelectorAll('[data-testid="bild-bestand-treffer"]')).toHaveLength(1);
    expect(testid("bild-bestand-caption", d).textContent).toBe(CAPTION);
    // … mit dem Hinweis „Stand von <Zeit> · Auffrischung fehlgeschlagen“.
    expect(d.textContent).toContain("Auffrischung fehlgeschlagen");
    expect(d.textContent).toContain("Stand von ");
  });

  it("U7 · vor der ersten Suche steht keine Aussage über den Bestand", () => {
    studioOeffnen();
    bildsucheOeffnen();
    const d = dialog();
    expect(d.textContent).not.toContain("Kein Bild mit dieser Beschreibung");
    expect(d.textContent).not.toContain(i18n.t("editor.imageSearch.error"));
    expect(d.querySelector("img")).toBeNull();
    expect(anfragen, "ohne Suchwort geht keine Anfrage ab").toHaveLength(0);
  });
});
