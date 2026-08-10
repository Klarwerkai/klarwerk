// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega69 BLOCK A — DER WEG VOM BILD ZUR BESCHREIBUNG, AN DER STELLE, AN DER DAS BILD STEHT.
// ================================================================================================
//
// DER BEFUND (Pedis Bildschirmfotos, 30.07.): Ein über Klara importierter Entwurf zeigt seine
// Bilder mit LEERER Fußnote (WP-D10: die figcaption startet bewusst leer). Das Eingabeformular mit
// KI-Vorschlag EXISTIERT (mega9 Block F, RichTextEditor) — aber es war nur erreichbar, indem man
// das Bild IM FLIESSTEXT anklickte und dann den kleinen Knopf fand. Die Galerie, die das Bild samt
// leerer Fußnote prominent zeigt (DraftBodyGallery/BodyImageGallery), bot KEINEN Weg dorthin.
//
// GEMOUNTET WIRD DIE ECHTE ANKUNFTSFLÄCHE: /capture/frontdoor?draft=<id> — genau der Deep-Link,
// den Klara nach dem Senden baut (taskpane.html: /capture/frontdoor?draft=…). Der Test geht Pedis
// Weg: Entwurf offen → Bild in der Galerie → Großansicht → „Bildbeschreibung bearbeiten" →
// dasselbe Formular (caption-form-*) → Text eintippen → Vorschlag anfordern → speichern.
//
// KEIN zweites Formular, KEIN zweiter describe-Aufruf: der Vorschlag läuft über denselben
// ImageDescribeContext (eine Egress-Stelle), und der umgebende Text reist als context im SELBEN
// Request mit (WP-BILD-1f) — beides wird hier am Mock belegt.
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
      create: vi.fn(async () => ({ id: "d-neu", payload: {} })),
      update: vi.fn(async () => ({})),
      promote: vi.fn(async () => ({})),
    },
    reasoner: {
      structure: vi.fn(async () => ({})),
      assist: vi.fn(async () => ({})),
      // Für die Verfügbarkeit der Bildbeschreibung (useAiAvailable("describe") → publicStatus).
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { describe: true },
        billable: { describe: true },
      })),
      config: vi.fn(async () => ({})),
      // DER EINE describe-Aufruf (ImageDescribeContext) — der Test belegt, dass genau er läuft.
      describeImage: vi.fn(async () => ({ text: "Manometer am Kesselzulauf", demo: false })),
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
import { schreibeBeschreibung } from "./bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// WP-D9c: jsdom implementiert showModal()/close() des <dialog> nicht (wirft „not implemented") —
// MINIMALER Test-Polyfill (Muster aus tests/ko/body-image-gallery-mounted.test.tsx).
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

// 1×1-PNG — besteht die zentrale data-URL-Prüfung (checkCaptionImageDataUrl/isSafeImgSrc).
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// GENAU die Form, die der ECHTE Klara-Weg liefert (gemessen, _relay/messung/mega69-klara-
// bildanker-probe.ts): der Server-Sanitizer lässt ein NACKTES <img> durch — OHNE figure, OHNE
// figcaption, OHNE data-image-id. Der Anker aus docx.ts:134-146 entsteht nur auf dem
// DOCX-UPLOAD-Weg; ein Klara-Bild hatte bis mega69 weder Galerie-Eintrag noch Fußnote. Die
// Verankerung passiert jetzt beim LADEN des Entwurfs (frontDoorBodyFromDraft →
// wrapImagesInFigures) — dieser Test fährt deshalb bewusst mit dem unverankerten Original.
const DRAFT_BODY = `<p>Vor dem Bild</p><img src="${PNG}" alt=""><p>Der Kessel wird vor dem Anfahren entlüftet.</p>`;

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

// AUFTRAG-mega84 Block B: das Feld ist ein contentEditable (fett/kursiv/Umbruch) — geschrieben
// wird es über die Naht, die alle Bildbeschreibungs-Tests teilen (`schreibeBeschreibung`).

describe("mega69 A · von der Ansicht des importierten Bildes zur Bildbeschreibung", () => {
  it("Galerie-Großansicht → „Bildbeschreibung bearbeiten“ öffnet DAS Formular; Vorschlag läuft über den EINEN describe-Weg", async () => {
    getMock.mockResolvedValue({
      id: "d-word-1",
      payload: { title: "Kesselwartung", bodyHtml: DRAFT_BODY, confidentiality: "intern" },
    });
    mount("/capture/frontdoor?draft=d-word-1");
    await settle();
    // Die Galerie ist debounced (300 ms) — erst danach steht das importierte Bild dort.
    await settle(350);

    // 1. Pedis Blick: das Bild steht in der Galerie (mit leerer Fußnote im Body).
    const thumb = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Bild 1 vergrößern"]',
    );
    expect(thumb, "Galerie-Thumbnail des importierten Bildes fehlt").not.toBeNull();
    await act(async () => {
      thumb?.click();
    });

    // 2. Der Weg: die Großansicht trägt die sichtbare Aktion zur Bildbeschreibung.
    const editBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="gallery-caption-edit"]',
    );
    expect(editBtn, "die Großansicht bietet keinen Weg zur Bildbeschreibung").not.toBeNull();
    await act(async () => {
      editBtn?.click();
    });
    await settle();

    // 3. Es öffnet sich DAS bestehende Formular (mega9 Block F) — kein zweites.
    const field = container.querySelector<HTMLElement>("#caption-form-text");
    expect(field, "das Bildbeschreibungs-Formular ist nicht offen").not.toBeNull();
    if (!field) {
      return;
    }

    // 4. Die Fußnote wird BEARBEITET …
    await act(async () => {
      schreibeBeschreibung("Kesselzulauf mit Manometer");
    });

    // … und der Vorschlag angefordert — über den EINEN describe-Aufruf, mit umgebendem Text.
    const suggest = container.querySelector<HTMLButtonElement>(
      '[data-testid="caption-form-suggest"]',
    );
    expect(suggest, "der Vorschlags-Knopf fehlt im Formular").not.toBeNull();
    expect(suggest?.disabled, "der Vorschlags-Knopf ist trotz Modell ausgegraut").toBe(false);
    await act(async () => {
      suggest?.click();
    });
    await settle();

    expect(describeMock).toHaveBeenCalledTimes(1);
    // Signatur des EINEN Aufrufs: (dataUrl, locale, provenance, context) — s. ImageDescribeContext.
    const [dataUrl, , provenance, context] = describeMock.mock.calls[0] as [
      string,
      unknown,
      { source: string; confidentiality: string },
      string?,
    ];
    expect(dataUrl).toBe(PNG);
    // Die Vordertür kennt die gewählte Stufe. Sie darf deshalb nicht auf den absichtlich
    // fail-closed App-Default "vertraulich" zurückfallen, wenn der Entwurf "intern" ist.
    expect(provenance).toEqual({ source: "draft", confidentiality: "intern" });
    // WP-BILD-1f: der umgebende Text reist im SELBEN Request mit (dieselbe Egress-Stelle).
    expect(context ?? "").toContain("Kessel");

    const suggestion = container.querySelector('[data-testid="caption-form-suggestion"]');
    expect(suggestion?.textContent).toContain("Manometer am Kesselzulauf");

    // 5. Speichern schreibt über die normale Editier-Mechanik in die Fußnote des Bodys.
    const save = container.querySelector<HTMLButtonElement>('[data-testid="caption-form-save"]');
    await act(async () => {
      save?.click();
    });
    const caption = container.querySelector("[contenteditable] figcaption");
    expect(caption?.textContent).toContain("Kesselzulauf mit Manometer");
  });

  // ==============================================================================================
  // JOB 504 D2 — DER FORTGESETZTE ENTWURF OHNE VERTRAULICHKEITSFELD.
  // ==============================================================================================
  //
  // BEN-D1 (`BEN-PRUEFUNG-JOB-504-D1.md`, Mangel 1) belegt die fail-open-Luecke: die Vordertuer
  // machte beim Fortsetzen aus einem FEHLENDEN `payload.confidentiality` ein ausdrueckliches
  // "intern" — VOR `failSafeConfidentiality`. Der Server (`classifyProvenanceConfidential`,
  // reasoner-routes.ts) darf einem gueltigen "intern" glauben und laesst die Cloud-Kante stehen;
  // Bild UND umgebender Kontext gingen damit an den externen Anbieter, obwohl NIEMAND diese Stufe
  // je erklaert hat. Genau das beobachtet dieser Test AM ECHTEN describe-Aufruf.
  it("Entwurf OHNE Vertraulichkeitsfeld: der Vorschlag reist fail-closed als „vertraulich“, nie als „intern“", async () => {
    getMock.mockResolvedValue({
      id: "d-alt-1",
      // GENAU der Klara-/Altentwurf aus dem Befund: kein `confidentiality` im Payload.
      payload: { title: "Kesselwartung", bodyHtml: DRAFT_BODY },
    });
    mount("/capture/frontdoor?draft=d-alt-1");
    await settle();
    await settle(350);

    const thumb = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Bild 1 vergrößern"]',
    );
    expect(thumb, "Galerie-Thumbnail des importierten Bildes fehlt").not.toBeNull();
    await act(async () => {
      thumb?.click();
    });
    const editBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="gallery-caption-edit"]',
    );
    expect(editBtn).not.toBeNull();
    await act(async () => {
      editBtn?.click();
    });
    await settle();
    expect(container.querySelector<HTMLElement>("#caption-form-text")).not.toBeNull();

    await act(async () => {
      schreibeBeschreibung("Kesselzulauf mit Manometer");
    });
    const suggest = container.querySelector<HTMLButtonElement>(
      '[data-testid="caption-form-suggest"]',
    );
    await act(async () => {
      suggest?.click();
    });
    await settle();

    expect(describeMock).toHaveBeenCalledTimes(1);
    const [, , provenance] = describeMock.mock.calls[0] as [
      string,
      unknown,
      { source: string; confidentiality: string },
      string?,
    ];
    // Die Kernaussage: ein NIE erklaerter Wert darf nicht als Freigabe beim Egress erscheinen.
    expect(provenance).toEqual({ source: "draft", confidentiality: "vertraulich" });
    expect(provenance.confidentiality).not.toBe("intern");
  });
});
