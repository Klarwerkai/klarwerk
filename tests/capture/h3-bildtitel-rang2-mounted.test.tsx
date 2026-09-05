// @vitest-environment jsdom
// ================================================================================================
// JOB 3062 · H3 · R7 — RANG 2 IM TITEL-MENÜ: DER TITEL AUS DER BILDBESCHREIBUNG.
// ================================================================================================
//
// BENS BEFUND ZUR RUNDE 6 (Korrekturpflicht 3): „Neben den Hilfen fehlt der aus einer
// Bildbeschreibung abgeleitete Titelvorschlag Rang 2: Die Editor-Karte wird verborgen
// (`Blatt.tsx:152-154`), während das Titelmenü ausdrücklich nur Rang 1 berechnet."
//
// Er hat recht: Die gerahmte Karte über dem Schreibfeld konnte BEIDE Ränge der Rangfolge
// (JOB 2489 D1) — den Titel aus dem Objekttext UND, wenn es keinen Objekttext gab, den aus der
// Bildbeschreibung. Das Blatt nahm die Karte von der Fläche und bot im Titel-Menü nur Rang 1 an.
// Wer ein Bild und noch keinen Text hatte, verlor damit den einzigen Vorschlag, den es für ihn gab.
//
// DIESER TEST FÄHRT PEDIS WEG, an der ECHTEN Fläche `/capture/frontdoor?draft=…` (sie rendert seit
// R5 das Blatt): Entwurf mit Bild und OHNE Text öffnen → Bild in der Galerie → Großansicht →
// „Bildbeschreibung bearbeiten" → Vorschlag anfordern → Titelfeld anfassen → im Menü steht der
// Vorschlag MIT seiner Herkunft → Klick → er steht im Titel.
//
// DIE DREI ZUSICHERUNGEN, die ben genannt hat, sind die drei Erwartungen am Ende:
//   1. Die Bildbeschreibung liefert einen Titel (über den EINEN describe-Weg, ein Aufruf).
//   2. Das Menü zeigt Vorschlag UND Herkunft (`data-quelle="bild"`).
//   3. Die Übernahme setzt den Blatt-Titel.
//
// UND DIE GEGENPROBE STEHT DANEBEN: Sobald eigener Text im Blatt steht, gewinnt Rang 1 — die
// Rangfolge ist nicht umgangen, sie wird benutzt.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pedi", email: "p@x.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    drafts: {
      get: vi.fn(),
      list: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: "d-neu", payload: {} })),
      update: vi.fn(async () => ({})),
      promote: vi.fn(async () => ({})),
    },
    kos: { list: vi.fn(async () => []) },
    reasoner: {
      structure: vi.fn(async () => ({})),
      assist: vi.fn(async () => ({})),
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { describe: true },
        billable: { describe: false },
      })),
      config: vi.fn(async () => ({})),
      // DER EINE describe-Aufruf. Seine Antwort trägt den Titelvorschlag des Bildes — genau das
      // Feld, das der Server nur bei `grund: "abgeleitet"` überhaupt anhängt.
      describeImage: vi.fn(async () => ({
        text: "Ein Kegelradgetriebe. Daneben liegt ein Schluessel.",
        demo: false,
        titelVorschlag: { titel: "Ein Kegelradgetriebe", grund: "abgeleitet" },
      })),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom kennt showModal()/close() des <dialog> nicht — derselbe minimale Polyfill wie in
// `mega69-bildweg-mounted.test.tsx`, aus dem auch der Weg zur Großansicht stammt.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};
Object.defineProperty(HTMLDialogElement.prototype, "open", {
  configurable: true,
  get(this: HTMLDialogElement) {
    return this.hasAttribute("open");
  },
});

const getMock = endpoints.drafts.get as unknown as ReturnType<typeof vi.fn>;
const describeMock = endpoints.reasoner.describeImage as unknown as ReturnType<typeof vi.fn>;

/** 1×1-PNG — besteht die zentrale data-URL-Prüfung (`checkCaptionImageDataUrl`). */
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** Ein ZWEITES, anderes 1×1-PNG — Bild B im Wechselfall (andere Bildquelle als A). */
const PNG_B =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

/** NUR das Bild, kein Satz: der Fall, in dem Rang 2 der einzige Vorschlag ist. */
const NUR_BILD = `<img src="${PNG}" alt="">`;
/** Dasselbe Bild MIT eigenem Text: hier muss Rang 1 gewinnen. */
const MIT_TEXT = `<p>Das Getriebe der Pumpe P-12 faellt bei Frost aus.</p><img src="${PNG}" alt="">`;
/** ZWEI Bilder, kein Text: die Bühne für den Wechsel A → B während des laufenden Requests. */
const ZWEI_BILDER = `<img src="${PNG}" alt=""><img src="${PNG_B}" alt="">`;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(url: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            ToastProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [url] },
              createElement(
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/capture/frontdoor",
                      element: createElement(CaptureFrontDoor),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

async function settle(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

/** Galerie → Großansicht → „Bildbeschreibung bearbeiten" → Vorschlag anfordern. */
async function bildVorschlagAnfordern(): Promise<void> {
  // Die Galerie ist entprellt (300 ms) — erst danach steht das Bild dort.
  await settle(350);
  const thumb = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Bild 1 vergrößern"]',
  );
  expect(thumb, "Galerie-Thumbnail des Bildes fehlt").not.toBeNull();
  await act(async () => {
    thumb?.click();
  });
  const editBtn = container.querySelector<HTMLButtonElement>(
    '[data-testid="gallery-caption-edit"]',
  );
  expect(editBtn, "die Großansicht bietet keinen Weg zur Bildbeschreibung").not.toBeNull();
  await act(async () => {
    editBtn?.click();
  });
  await settle();
  const suggest = container.querySelector<HTMLButtonElement>(
    '[data-testid="caption-form-suggest"]',
  );
  expect(suggest, "der Vorschlags-Knopf fehlt im Formular").not.toBeNull();
  await act(async () => {
    suggest?.click();
  });
  await settle();
}

/**
 * Nur ÖFFNEN und den Vorschlag ANFORDERN — ohne auf die Antwort zu warten. Für die verspäteten
 * Fälle: der Request läuft, während der Mensch etwas anderes tut.
 *
 * `nr` ist die Nummer des Bildes in der Galerie (1-basiert, `ko.galleryOpen`).
 */
async function bildFormularOeffnenUndAnfordern(nr: number): Promise<void> {
  await settle(350);
  const thumb = container.querySelector<HTMLButtonElement>(
    `button[aria-label="Bild ${nr} vergrößern"]`,
  );
  expect(thumb, `Galerie-Thumbnail ${nr} fehlt`).not.toBeNull();
  await act(async () => {
    thumb?.click();
  });
  const editBtn = container.querySelector<HTMLButtonElement>(
    '[data-testid="gallery-caption-edit"]',
  );
  expect(editBtn, "die Großansicht bietet keinen Weg zur Bildbeschreibung").not.toBeNull();
  await act(async () => {
    editBtn?.click();
  });
  await settle();
  const suggest = container.querySelector<HTMLButtonElement>(
    '[data-testid="caption-form-suggest"]',
  );
  expect(suggest, "der Vorschlags-Knopf fehlt im Formular").not.toBeNull();
  await act(async () => {
    suggest?.click();
  });
  await settle();
}

/** Der Abbrechen-Knopf des Bildbeschreibungs-Formulars (`editor.captionForm.cancel`). */
function abbrechenKnopf(): HTMLButtonElement {
  const treffer = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === "Abbrechen",
  );
  if (!(treffer instanceof HTMLButtonElement)) {
    throw new Error("Abbrechen-Knopf des Bildformulars nicht gefunden");
  }
  return treffer;
}

/** Das Titelfeld anfassen — das Menü öffnet auf Fokus, wenn es etwas anzubieten hat. */
async function titelMenueOeffnen(): Promise<void> {
  const titel = container.querySelector<HTMLInputElement>('[data-testid="blatt-titel"]');
  expect(titel, "das Blatt hat kein Titelfeld").not.toBeNull();
  await act(async () => {
    titel?.focus();
    titel?.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
  });
  await settle();
}

describe("JOB 3062 R7 · Rang 2 — der Titel aus der Bildbeschreibung steht im Titel-Menü", () => {
  it("Bild ohne eigenen Text: der Vorschlag steht MIT Herkunft im Menü und die Übernahme setzt den Titel", async () => {
    getMock.mockResolvedValue({
      id: "d-bild-1",
      payload: { title: "", bodyHtml: NUR_BILD, confidentiality: "intern" },
    });
    mount("/capture/frontdoor?draft=d-bild-1");
    await settle();

    // Vor der Bildbeschreibung gibt es nichts anzubieten: kein Text, kein Bildtitel.
    await titelMenueOeffnen();
    expect(
      container.querySelector('[data-testid="blatt-titelvorschlag"]'),
      "ohne Bildbeschreibung darf es keinen Vorschlag geben — sonst wäre er erfunden",
    ).toBeNull();

    await bildVorschlagAnfordern();

    // 1. Die Bildbeschreibung lief über den EINEN describe-Weg, genau einmal.
    expect(describeMock).toHaveBeenCalledTimes(1);

    // 2. Das Menü zeigt Vorschlag UND Herkunft.
    await titelMenueOeffnen();
    const vorschlag = container.querySelector<HTMLElement>('[data-testid="blatt-titelvorschlag"]');
    expect(vorschlag, "der Titel aus der Bildbeschreibung fehlt im Titel-Menü").not.toBeNull();
    expect(vorschlag?.textContent ?? "").toContain("Ein Kegelradgetriebe");
    // Die Herkunft ist die eigentliche Zusage der Rangfolge: „eine Quelle je Objekt“ ist ohne sie
    // nicht zu erkennen (JOB 2489 D1).
    expect(vorschlag?.getAttribute("data-quelle")).toBe("bild");

    // 3. Die Übernahme setzt den Blatt-Titel — geprüft wird die WIRKUNG, nicht die Anzeige.
    const eintrag = vorschlag?.closest('[role="menuitem"]');
    expect(eintrag, "der Vorschlag ist kein anklickbarer Menüeintrag").not.toBeNull();
    await act(async () => {
      (eintrag as HTMLElement | null)?.click();
    });
    await settle();
    const titel = container.querySelector<HTMLInputElement>('[data-testid="blatt-titel"]');
    expect(titel?.value, "der übernommene Vorschlag steht nicht im Titel").toBe(
      "Ein Kegelradgetriebe",
    );
  });

  it("GEGENPROBE: mit eigenem Text gewinnt Rang 1 — der Bildtitel drängt sich nicht vor", async () => {
    getMock.mockResolvedValue({
      id: "d-bild-2",
      payload: { title: "", bodyHtml: MIT_TEXT, confidentiality: "intern" },
    });
    mount("/capture/frontdoor?draft=d-bild-2");
    await settle();

    await bildVorschlagAnfordern();
    expect(describeMock).toHaveBeenCalledTimes(1);

    await titelMenueOeffnen();
    const vorschlag = container.querySelector<HTMLElement>('[data-testid="blatt-titelvorschlag"]');
    expect(vorschlag, "ohne Vorschlag wäre auch die Rangfolge nicht geprüft").not.toBeNull();
    // Der Objekttext gewinnt — auch wenn das Bild einen brauchbaren Titel hergäbe.
    expect(vorschlag?.getAttribute("data-quelle")).toBe("objekttext");
    expect(vorschlag?.textContent ?? "").toContain("Das Getriebe der Pumpe P-12");
    expect(vorschlag?.textContent ?? "").not.toContain("Kegelradgetriebe");
  });
});

// ==================================================================================================
// JOB 3062 R8 (bens Korrekturpflichten 1 und 2) — DIE VERSPÄTETE ANTWORT.
// ==================================================================================================
//
// BENS BEFUND ZUR RUNDE 7, in Chromium gemessen: „Bildbeschreibung starten → Formular abbrechen →
// verspätete Antwort" zeigte `Titelvorschlag: Verspäteter falscher Titel`. Ursache war der
// Provider-Mithörer: er las die Antwort, BEVOR `stillCurrent()` sie verwarf. Das Blatt bot damit
// einen Titel aus einer Handlung an, die der Mensch zurückgenommen hatte.
//
// SEIT R8 GIBT ES DEN MITHÖRER NICHT MEHR. Das Blatt liest die geprüfte Entscheidung des Editors
// (`caption-form-title-text` / `caption-form-title-quelle`), die erst NACH `stillCurrent()`
// entsteht. Diese beiden Fälle sind der Beleg — und sie stehen dauerhaft hier, statt einmal von
// Hand gefahren zu werden.
//
// GEMESSEN WIRD BEIDES ZUSAMMEN: der Editor UND das Titel-Menü. Ein Fall, der nur das Menü prüft,
// liesse einen zweiten Kanal offen; ein Fall, der nur den Editor prüft, war schon in R7 grün.
describe("JOB 3062 R8 · die verspätete Bildantwort verändert weder Editor noch Titel-Menü", () => {
  it("ABBRUCH: Vorschlag angefordert, Formular abgebrochen, danach kommt die Antwort — nichts erscheint", async () => {
    let aufloesen: ((r: unknown) => void) | null = null;
    describeMock.mockImplementationOnce(
      () =>
        new Promise((res) => {
          aufloesen = res as (r: unknown) => void;
        }),
    );
    getMock.mockResolvedValue({
      id: "d-spaet-1",
      payload: { title: "", bodyHtml: NUR_BILD, confidentiality: "intern" },
    });
    mount("/capture/frontdoor?draft=d-spaet-1");
    await settle();

    await bildFormularOeffnenUndAnfordern(1);
    expect(describeMock, "der describe-Weg wurde gar nicht betreten").toHaveBeenCalledTimes(1);
    expect(aufloesen, "die Antwort ist nicht mehr offen — der Fall misst nichts").not.toBeNull();

    // Der Mensch nimmt seine Handlung zurück, WÄHREND die Antwort noch unterwegs ist.
    await act(async () => {
      abbrechenKnopf().click();
    });
    await settle();

    // … und erst jetzt kommt sie an.
    await act(async () => {
      (aufloesen as unknown as (r: unknown) => void)({
        text: "Verspätete Beschreibung.",
        demo: false,
        titelVorschlag: { titel: "Verspäteter falscher Titel", grund: "abgeleitet" },
      });
      await Promise.resolve();
    });
    await settle(50);

    // 1. Der EDITOR hat sie verworfen (`stillCurrent()` → false): keine Vorschlagskarte.
    expect(
      container.querySelector('[data-testid="caption-form-title-suggestion"]'),
      "der Editor zeigt einen Titel aus einer zurückgenommenen Handlung",
    ).toBeNull();
    // 2. Und das TITEL-MENÜ ebenso wenig — das ist der Punkt, an dem R7 rot war.
    await titelMenueOeffnen();
    expect(
      container.querySelector('[data-testid="blatt-titelvorschlag"]'),
      "das Titel-Menü bietet einen Titel aus einer zurückgenommenen Handlung an",
    ).toBeNull();
    expect(container.textContent ?? "").not.toContain("Verspäteter falscher Titel");
  });

  it("BILDWECHSEL A→B: As Antwort kommt zu spät und wird still verworfen; Bs Vorschlag trägt weiterhin", async () => {
    let aufloesenA: ((r: unknown) => void) | null = null;
    describeMock.mockImplementationOnce(
      () =>
        new Promise((res) => {
          aufloesenA = res as (r: unknown) => void;
        }),
    );
    getMock.mockResolvedValue({
      id: "d-spaet-2",
      payload: { title: "", bodyHtml: ZWEI_BILDER, confidentiality: "intern" },
    });
    mount("/capture/frontdoor?draft=d-spaet-2");
    await settle();

    // Bild A: Vorschlag anfordern — die Antwort bleibt offen.
    await bildFormularOeffnenUndAnfordern(1);
    expect(describeMock).toHaveBeenCalledTimes(1);
    expect(aufloesenA, "As Antwort ist nicht mehr offen — der Fall misst nichts").not.toBeNull();

    // Der Mensch wechselt zu Bild B. Das Öffnen des zweiten Formulars erhöht Formularlauf und
    // Generation (`RichTextEditor.tsx:901-902`) — genau das macht As Antwort ungültig.
    await act(async () => {
      abbrechenKnopf().click();
    });
    await settle();
    await bildFormularOeffnenUndAnfordern(2);
    // Bs Antwort ist die Vorgabe des Mocks (sofort) — der zweite Aufruf ist gelaufen.
    expect(describeMock).toHaveBeenCalledTimes(2);

    // JETZT kommt A an. Sie darf nichts mehr bewirken.
    await act(async () => {
      (aufloesenA as unknown as (r: unknown) => void)({
        text: "Beschreibung von Bild A.",
        demo: false,
        titelVorschlag: { titel: "Titel aus Bild A", grund: "abgeleitet" },
      });
      await Promise.resolve();
    });
    await settle(50);

    expect(container.textContent ?? "", "As verspäteter Titel steht auf der Fläche").not.toContain(
      "Titel aus Bild A",
    );

    // Und der unveränderte Weg trägt weiter: Bs Vorschlag steht im Menü, mit Herkunft „bild“,
    // und die Übernahme setzt den Blatt-Titel.
    await titelMenueOeffnen();
    const vorschlag = container.querySelector<HTMLElement>('[data-testid="blatt-titelvorschlag"]');
    expect(vorschlag, "nach dem Wechsel fehlt auch Bs gültiger Vorschlag").not.toBeNull();
    expect(vorschlag?.getAttribute("data-quelle")).toBe("bild");
    expect(vorschlag?.textContent ?? "").toContain("Ein Kegelradgetriebe");
    await act(async () => {
      (vorschlag?.closest('[role="menuitem"]') as HTMLElement | null)?.click();
    });
    await settle();
    expect(container.querySelector<HTMLInputElement>('[data-testid="blatt-titel"]')?.value).toBe(
      "Ein Kegelradgetriebe",
    );
  });
});
