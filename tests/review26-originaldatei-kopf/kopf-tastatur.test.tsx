// @vitest-environment jsdom
// ================================================================================================
// JOB 3474 · REVIEW26 — DER WEG ZUR ORIGINALDATEI GEHT MIT TABULATOR UND EINGABETASTE.
// ================================================================================================
//
// BENANNTE PRÜFLÜCKE (übernommen aus JOB 3108 · A4, und hier genauso ehrlich): jsdom führt für
// einen nativen `<button>` KEINE Vorgabehandlung auf `keydown` aus — ein hier abgeschicktes
// `Enter` bewirkt nichts, und ein Fall, der daraus „Enter wirkt" machte, wäre eine Lüge über den
// Prüfstand (Lehre JOB 3420 R2: keine Behauptung über den Fokus, die nicht gemessen ist).
//
// GEMESSEN WIRD DESHALB, WAS DIE TASTATURBEDIENBARKEIT WIRKLICH TRÄGT:
//   (1) das Ziel ist ein echter `<button type="button">` in der Tabulator-Reihenfolge, den nichts
//       im Pfad ausnimmt (kein `hidden`, kein `inert`, kein `tabIndex`-Nachbau, kein `disabled`),
//       und er nimmt den Fokus an;
//   (2) seine AKTIVIERUNG — genau das, was der Browser aus `Enter` und `Leertaste` macht — führt
//       zur Datei;
//   (3) das Ziel des Sprungs ist selbst tastaturbedienbar: ein echter `<a href>`, der den Fokus
//       trägt. Sonst endete der Weg in einer Sackgasse.
// Dass Chromium `Enter` wirklich in diese Aktivierung übersetzt, ist die bestehende Zusage des
// Elements und wird hier nicht neu behauptet.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__job3474Ko),
        list: vi.fn(async () => [globalThis.__job3474Ko]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__job3474Ko),
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

import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { fileLinkHtml, objectRawHref } from "../../apps/web/src/lib/bodyFileLink";
import { LANGER_TEXT, klick, knopf, mount, suche, unmount } from "./lesen-harness";

const DATEI_NAME = "Vertrag-2024.docx";
const OBJEKT_ID = "5d4f2b6a-1c3e-4f8a-9b2d-77e1c0a4b915";
const BODY_MIT_DATEI = `${LANGER_TEXT}${fileLinkHtml({ objectId: OBJEKT_ID, name: DATEI_NAME })}`;

const datei = (): HTMLAnchorElement =>
  suche<HTMLAnchorElement>(
    `[data-testid="bib-text"] .attachment a[href="${objectRawHref(OBJEKT_ID)}"]`,
  ) as HTMLAnchorElement;

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

describe("JOB 3474 · der Originaldatei-Knopf ist mit der Tastatur zu bedienen", () => {
  it("T1 · echter Knopf in der Tabulator-Reihenfolge, nichts im Pfad nimmt ihn aus", async () => {
    await i18n.changeLanguage("de");
    await mount(BODY_MIT_DATEI);
    const ziel = knopf("bib-sprung-originaldatei");
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
  });

  it("T2 · die Aktivierung — was der Browser aus Enter/Leertaste macht — führt zur Datei", async () => {
    await i18n.changeLanguage("de");
    await mount(BODY_MIT_DATEI);
    const ziel = knopf("bib-sprung-originaldatei");
    act(() => ziel.focus());
    // Ehrlich benannt: jsdom übersetzt dieses `keydown` NICHT in eine Aktivierung. Der Aufruf steht
    // hier, um zu belegen, dass der Knopf keinen eigenen Tastenweg braucht und keiner ihn abfängt.
    await act(async () => {
      ziel.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(document.activeElement, "ein Tastendruck hat den Fokus verschoben").toBe(ziel);
    // Und die Aktivierung selbst wirkt.
    await klick(ziel);
    expect(document.activeElement).toBe(datei());
  });

  it("T3 · das Ziel ist keine Sackgasse: der Datei-Link trägt den Fokus und ist auslösbar", async () => {
    await i18n.changeLanguage("de");
    await mount(BODY_MIT_DATEI);
    await klick(knopf("bib-sprung-originaldatei"));
    const anker = datei();
    expect(anker.tagName).toBe("A");
    expect(anker.hasAttribute("href"), "ein <a> ohne href ist nicht fokussierbar").toBe(true);
    expect(document.activeElement).toBe(anker);
    // Von dort geht der Tabulator weiter — der Link ist nicht aus der Reihenfolge genommen.
    expect(anker.tabIndex).toBe(0);
  });
});
