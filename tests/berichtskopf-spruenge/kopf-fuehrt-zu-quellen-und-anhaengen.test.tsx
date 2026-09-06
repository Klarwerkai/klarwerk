// @vitest-environment jsdom
// ================================================================================================
// JOB 3108 · UX-03 — DER KOPF DES BERICHTS FÜHRT ZU QUELLEN UND ANHÄNGEN.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (Codex N-0003/N-0021, und am Stand `e3fcff4` nachgelesen):
// am Kopf der Lesespalte steht zu Quellen und Anhängen GAR NICHTS. Der Chip-Streifen
// `bib-chips` liegt UNTER dem vollständigen Fließtext (`BibliothekLesen.tsx:976-1003`), seine
// Chips sind `<span>` ohne `onClick`, und der Weg zu den Abschnitten führt über zwei Klicks am
// Textende: erst „Mehr", dann „Quellen und Belege". Gemessen wurden 7.876,8 px Text darüber.
//
// DER STRUKTURELLE GRUND, warum es vorher keinen Sprung geben KONNTE: `Abschnitt`
// (`MehrAbschnitte.tsx:109`) hielt sein `offen` in einem EIGENEN `useState`. Von außen war kein
// Abschnitt zu öffnen. Diese Datei misst deshalb nicht die Anwesenheit zweier Knöpfe, sondern die
// WIRKUNG: der Zielabschnitt steht offen, sein `<summary>` hat den Fokus, das Bild ist
// nachgeführt. M5 (die Gegenprobe, die den alten lokalen Zustand wiederherstellt) muss A3 rot
// machen — sonst misst A3 nur einen Knopf.
//
// WAS HIER GEMESSEN WIRD: die gemountete ECHTE Lesefläche über die echte Route `/wissen/:id`
// (`KnowledgeDetail` → `BibliothekFlaeche` → `BibliothekLesen` → `MehrAbschnitte`), mit
// stillgelegter HTTP-Grenze (Bauform aus `tests/kollision-netztrennung/lesenflaeche-mounted.test.tsx`).
// Nichts an der Fläche ist nachgebaut.
//
// BENANNTE PRÜFLÜCKE (A4): jsdom führt für einen nativen `<button>` KEINE Vorgabehandlung auf
// `keydown` aus — ein hier abgeschicktes `Enter` bewirkte nichts, und ein Fall, der das dennoch
// behauptete, wäre eine Lüge über den Prüfstand. A4 misst deshalb hier zwei Dinge, die zusammen
// die Tastaturbedienbarkeit tragen: (1) das Ziel ist ein echter `<button>` in der
// Tabulator-Reihenfolge, den nichts im Pfad ausnimmt, und (2) seine AKTIVIERUNG — genau das, was
// der Browser aus `Enter` macht — öffnet und fokussiert den Abschnitt. Dass Chromium `Enter`
// wirklich in diese Aktivierung übersetzt, misst `kopf-sprung-in-chromium.test.ts` (B3) an der
// gebauten Seite; hier wird es nicht behauptet.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  mitBestand: true,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

/** Die drei Quellen. Ihre `label` dürfen am Kopf NIE erscheinen (Lieferung 6, Fall A8). */
const QUELLEN_LABEL = [
  "Prüfbericht Spritzzone 2025",
  "DIN EN 1672-2",
  "Werksanweisung W-9 Reinigung",
] as const;
/** Die zwei Anhänge — EINES ein Bild, EINES nicht. Der Unterschied ist der Kern von A2. */
const ANHANG_NAMEN = ["spritzzone.png", "pruefprotokoll.pdf"] as const;

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__job3108Ko),
        list: vi.fn(async () => [globalThis.__job3108Ko]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__job3108Ko),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

declare global {
  // Der Bestand wird über den globalen Namensraum gereicht: `vi.mock` wird hochgezogen und darf
  // nichts aus dem Modulrumpf schließen. Ein `vi.hoisted`-Kasten trüge dasselbe; hier steht ein
  // ECHTES `KnowledgeObject`, und der Typ soll sichtbar bleiben.
  // eslint-disable-next-line no-var
  var __job3108Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * `scrollIntoView` fehlt in jsdom. Statt sie stillzulegen, wird sie MITGESCHRIEBEN — nur so ist
 * Lieferung 2 („holt sein `<details>` ins Bild") überhaupt messbar (Muster:
 * `tests/app/job2626-d2-route-bis-flaeche-mounted.test.tsx:51`, `Capture.arbeitsraum.test.tsx:123`).
 * In der Bibliotheksfläche ruft sonst NICHTS `scrollIntoView` — der Zähler ist also sauber.
 */
let scrollRufe: unknown[] = [];
(Element.prototype as unknown as { scrollIntoView: (o?: unknown) => void }).scrollIntoView = (
  o,
) => {
  scrollRufe.push(o ?? null);
};

/** Sechzig Abschnitte Fließtext — der Fall aus dem Auftrag, nicht ein kurzer Absatz. */
const LANGER_TEXT = Array.from(
  { length: 60 },
  (_, i) => `<h2>Abschnitt ${i + 1}</h2><p>Reinigung und Prüfung im Abschnitt ${i + 1}.</p>`,
).join("");

function ko(mitBestand: boolean): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Reinigung Spritzzone Linie 3",
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    bodyHtml: LANGER_TEXT,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Produktion",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: mitBestand
      ? QUELLEN_LABEL.map((label, i) => ({
          id: `q-${i + 1}`,
          label,
          url: null,
          excerpt: null,
          kind: "external" as const,
          peerValidated: false,
          author: "u1",
          at: "2026-08-01T00:00:00.000Z",
        }))
      : [],
    attachments: mitBestand
      ? [
          {
            id: "a-1",
            name: ANHANG_NAMEN[0],
            mime: "image/png",
            dataUrl: "data:image/png;base64,iVBORw0KGgo=",
            author: "u1",
            at: "2026-08-01T00:00:00.000Z",
          },
          {
            id: "a-2",
            name: ANHANG_NAMEN[1],
            mime: "application/pdf",
            dataUrl: "data:application/pdf;base64,JVBERi0=",
            author: "u1",
            at: "2026-08-01T00:00:00.000Z",
          },
        ]
      : [],
  } as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  globalThis.__job3108Ko = ko(box.mitBestand);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
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
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/wissen/ko-1"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/wissen/:id",
                      element: createElement(KnowledgeDetail),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

function el(testId: string): HTMLElement {
  const treffer = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!treffer) {
    throw new Error(`„${testId}" fehlt auf der Lesefläche`);
  }
  return treffer;
}

function knopf(testId: string): HTMLButtonElement {
  const treffer = el(testId);
  if (!(treffer instanceof HTMLButtonElement)) {
    throw new Error(`„${testId}" ist kein <button>, sondern ${treffer.tagName}`);
  }
  return treffer;
}

const abschnitt = (schluessel: string): HTMLDetailsElement | null =>
  container.querySelector<HTMLDetailsElement>(`[data-bib-abschnitt="${schluessel}"]`);

const text = (e: Element): string => (e.textContent ?? "").replace(/\s+/g, " ").trim();

/** Einen echten Knopf drücken und den Baum ausrechnen lassen. */
async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

/** Einen Abschnitt VON HAND auf- oder zuklappen — der Weg, den ein Mensch am `<summary>` geht. */
async function vonHand(schluessel: string, offen: boolean): Promise<void> {
  const d = abschnitt(schluessel);
  if (!d) {
    throw new Error(`Abschnitt „${schluessel}" fehlt`);
  }
  await act(async () => {
    d.open = offen;
    // jsdom stellt `toggle` in die Warteschlange, statt es sofort zu liefern; es steigt nicht auf.
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.mitBestand = true;
  scrollRufe = [];
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  vi.clearAllMocks();
});

describe("JOB 3108 · UX-03 — die Sprungzeile steht am Kopf und führt wirklich hin", () => {
  it("A0 · KALIBRIERUNG: die echte Lesefläche steht, mit langem Text und zugeklapptem „Mehr“", async () => {
    await mount();
    expect(text(el("bib-titel"))).toBe("Reinigung Spritzzone Linie 3");
    // Ohne diese Zeile wäre der ganze Auftrag gegenstandslos: der Text IST lang.
    expect(text(el("bib-text")).length).toBeGreaterThan(2000);
    expect(knopf("bib-mehr").getAttribute("aria-expanded")).toBe("false");
    // …und die dreizehn Abschnitte sind wirklich noch nicht da.
    expect(abschnitt("quellen")).toBeNull();
  });

  it("A1 · die Sprungzeile steht im DOM VOR der Überschrift, nicht unter dem Fließtext", async () => {
    await mount();
    const spruenge = el("bib-kopf-spruenge");
    const titel = el("bib-titel");
    // DOCUMENT_POSITION_FOLLOWING (4): `titel` kommt NACH `spruenge`.
    expect(spruenge.compareDocumentPosition(titel) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
    // Und die Gegenrichtung, damit der Fall nicht an einer Verschachtelung vorbeimisst.
    expect(spruenge.contains(titel)).toBe(false);
    // Der alte Ort bleibt, wo er war — der Kopf ist ein zweiter Zugang, kein Ersatz (§8.7).
    const chips = el("bib-chips");
    expect(el("bib-text").compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      4,
    );
  });

  it("A2 · die Knöpfe nennen 3 Quellen und 2 Anhänge — während der Bilder-Chip weiter 1 nennt", async () => {
    await mount();
    expect(text(knopf("bib-sprung-quellen"))).toBe(
      i18n.t("lib.lesen.sprung.quellen", { count: 3 }),
    );
    // Der Kern von M4: die Anhangzahl kommt aus `ko.attachments` (2), nicht aus `bilder` (1).
    expect(text(knopf("bib-sprung-anhaenge"))).toBe(
      i18n.t("lib.lesen.sprung.anhaenge", { count: 2 }),
    );
    expect(text(knopf("bib-sprung-anhaenge"))).toContain("2");
    expect(text(el("bib-bilder-chip"))).toBe(i18n.t("lib.lesen.bilder", { count: 1 }));
  });

  it("A3 · Klick auf „Quellen“ → der Abschnitt ist offen, sein summary hat den Fokus, das Bild folgt", async () => {
    await mount();
    await klick(knopf("bib-sprung-quellen"));
    const ziel = abschnitt("quellen");
    expect(ziel, "der Abschnitt „quellen“ wurde nicht gemountet").not.toBeNull();
    expect((ziel as HTMLDetailsElement).open, "der Abschnitt steht nicht offen").toBe(true);
    const summary = (ziel as HTMLDetailsElement).querySelector("summary");
    expect(document.activeElement, "der Fokus liegt nicht im Zielabschnitt").toBe(summary);
    expect(scrollRufe.length, `scrollIntoView-Rufe: ${scrollRufe.length}`).toBe(1);
    expect(scrollRufe[0]).toEqual({ block: "start" });
    // Und der Inhalt ist wirklich gezeichnet, nicht nur der Titel.
    expect(text(ziel as HTMLDetailsElement)).toContain(QUELLEN_LABEL[0]);
  });

  it("A4 · derselbe Weg über die Tastatur: echter Knopf in der Reihenfolge, Aktivierung wirkt", async () => {
    await mount();
    const ziel = knopf("bib-sprung-anhaenge");
    // (1) Es ist ein echter `<button type="button">` — kein `div` mit `onClick`, kein
    //     `tabIndex`-Nachbau — und nichts im Pfad nimmt ihn aus der Tabulator-Reihenfolge.
    expect(ziel.type).toBe("button");
    expect(ziel.disabled).toBe(false);
    expect(ziel.tabIndex).toBe(0);
    expect(ziel.getAttribute("aria-hidden")).toBeNull();
    for (let e: HTMLElement | null = ziel; e && e !== document.body; e = e.parentElement) {
      expect(e.hasAttribute("hidden"), `hidden an ${e.tagName}`).toBe(false);
      expect(e.hasAttribute("inert"), `inert an ${e.tagName}`).toBe(false);
    }
    act(() => ziel.focus());
    expect(document.activeElement, "der Knopf nimmt den Fokus nicht an").toBe(ziel);
    // (2) Die Aktivierung — was der Browser aus `Enter` macht — öffnet und fokussiert das Ziel.
    //     Dass Chromium `Enter` wirklich so übersetzt, misst B3; hier steht es nicht.
    await klick(ziel);
    const anhaenge = abschnitt("anhaenge");
    expect((anhaenge as HTMLDetailsElement).open).toBe(true);
    expect(document.activeElement).toBe((anhaenge as HTMLDetailsElement).querySelector("summary"));
  });

  it("A5 · zweimal derselbe Sprung wirkt zweimal — auch nach dem Zuklappen von Hand", async () => {
    await mount();
    await klick(knopf("bib-sprung-quellen"));
    expect((abschnitt("quellen") as HTMLDetailsElement).open).toBe(true);

    await vonHand("quellen", false);
    expect((abschnitt("quellen") as HTMLDetailsElement).open, "Vorbedingung: zu").toBe(false);
    // Den Fokus wegnehmen, damit die zweite Messung nicht den ersten Sprung nachliest.
    act(() => (document.activeElement as HTMLElement | null)?.blur());

    await klick(knopf("bib-sprung-quellen"));
    expect(
      (abschnitt("quellen") as HTMLDetailsElement).open,
      "der zweite Sprung wirkte nicht",
    ).toBe(true);
    expect(document.activeElement).toBe(
      (abschnitt("quellen") as HTMLDetailsElement).querySelector("summary"),
    );
    expect(scrollRufe.length, "beide Sprünge führen ins Bild").toBe(2);
  });

  it("A6 · ein selbst geöffneter Abschnitt bleibt offen — der Sprung klappt niemandem etwas zu", async () => {
    await mount();
    // „Mehr" von Hand aufklappen und „konflikt" selbst öffnen.
    await klick(knopf("bib-mehr"));
    await vonHand("konflikt", true);
    expect((abschnitt("konflikt") as HTMLDetailsElement).open).toBe(true);

    await klick(knopf("bib-sprung-quellen"));
    expect((abschnitt("quellen") as HTMLDetailsElement).open).toBe(true);
    expect(
      (abschnitt("konflikt") as HTMLDetailsElement).open,
      "der Sprung hat einen fremden Abschnitt zugeklappt",
    ).toBe(true);
    // Und die Zusage „zugeklappt läuft keine Arbeit" gilt weiter: ein dritter Abschnitt trägt
    // wirklich nur seinen Titel.
    expect(text(abschnitt("nachbarschaft") as HTMLDetailsElement)).toBe(
      `${i18n.t("ko.mehr.nachbarschaft")}›`,
    );
  });

  it("A7 · ohne Quellen und ohne Anhänge: Leerfassung IM Knopf, aktiv, und sie führt zum Leersatz", async () => {
    box.mitBestand = false;
    await mount();
    const q = knopf("bib-sprung-quellen");
    const a = knopf("bib-sprung-anhaenge");
    expect(text(q)).toBe(i18n.t("lib.lesen.sprung.quellenLeer"));
    expect(text(a)).toBe(i18n.t("lib.lesen.sprung.anhaengeLeer"));
    expect(q.disabled, "der leere Knopf ist abgeschaltet statt ehrlich").toBe(false);
    expect(a.disabled, "der leere Knopf ist abgeschaltet statt ehrlich").toBe(false);

    await klick(q);
    expect(text(abschnitt("quellen") as HTMLDetailsElement)).toContain(i18n.t("ko.sourcesEmpty"));
    await klick(a);
    expect(text(abschnitt("anhaenge") as HTMLDetailsElement)).toContain(
      i18n.t("ko.attachmentsEmpty"),
    );
  });

  it("A8 · WÄCHTER zu Lieferung 6: am Kopf steht kein Quellentitel und kein Dateiname", async () => {
    await mount();
    const kopf = text(el("bib-kopf-spruenge"));
    for (const label of QUELLEN_LABEL) {
      expect(kopf, `Quellentitel am Kopf: ${label}`).not.toContain(label);
    }
    for (const name of ANHANG_NAMEN) {
      expect(kopf, `Dateiname am Kopf: ${name}`).not.toContain(name);
    }
    // Kalibrierung: die Titel und Namen STEHEN im Bestand — sonst prüfte A8 ein leeres Blatt.
    expect(JSON.stringify(globalThis.__job3108Ko)).toContain(QUELLEN_LABEL[0]);
    expect(JSON.stringify(globalThis.__job3108Ko)).toContain(ANHANG_NAMEN[1]);
  });

  it("A9 · die Knöpfe zeigen auf die Fläche, die sie steuern (`aria-controls`)", async () => {
    await mount();
    const kennung = knopf("bib-sprung-quellen").getAttribute("aria-controls");
    expect(kennung, "kein aria-controls").not.toBeNull();
    expect(knopf("bib-sprung-anhaenge").getAttribute("aria-controls")).toBe(kennung);
    // Attributselektor statt `#…`: `useId` liefert Kennungen mit Doppelpunkten (`:r0:`), die als
    // CSS-Kennung ungültig wären; `CSS.escape` bringt dieses jsdom nicht mit.
    const flaeche = container.querySelector(`[id="${kennung}"]`);
    expect(flaeche, "aria-controls zeigt ins Leere").not.toBeNull();
    expect((flaeche as HTMLElement).contains(knopf("bib-mehr"))).toBe(true);
  });
});
