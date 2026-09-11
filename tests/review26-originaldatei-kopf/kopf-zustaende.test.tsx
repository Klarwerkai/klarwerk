// @vitest-environment jsdom
// ================================================================================================
// JOB 3474 · REVIEW26 — DAS ZUSTANDSMODELL DER NEUEN KOPF-AUSSAGE (Auftrag §9), GEMESSEN.
// ================================================================================================
//
// WARUM DIESE DATEI ÜBER §6 HINAUS DA IST: §6 benennt vier Fälle, §9 sechs Zustände. Von den sechs
// war nur „erfolgreich leer" benannt (`kopf-schweigt-ohne-datei.test.tsx`). Die Lehre aus JOB 3220
// R1 verlangt zu JEDEM §9-Zustand einen Test — sonst steht das Zustandsmodell nur im Auftrag und
// nicht im Prüfstand. Hier stehen vier weitere:
//
//   laden                          → keine Aussage, kein Platzhalter (Z0)
//   Fehler beim Laden              → EIN Satz plus Knopf; die Datei-Aussage entsteht NICHT (Z1)
//   Cache mit gescheiterter Auffr. → Eintrag UND Knopf bleiben stehen (Z2)
//   offline                        → die Aussage trägt weiter, sie braucht keine zweite Abfrage (Z3)
//
// Z2 ist der Kern des Auftrags an dieser Stelle: verschwände der Knopf, verlöre der Leser den Weg
// zu einer Datei, die er im Text weiterhin SIEHT — genau die Regel aus `BibliothekLesen.tsx:89-92`.
//
// NICHT GEMESSEN und ehrlich benannt: „Cache mit LAUFENDER Auffrischung" ist hier nicht als eigener
// Fall geführt. Er unterscheidet sich vom geladenen Zustand nur durch `fetchStatus`, den diese
// Aussage nicht liest (sie kommt aus dem schon geladenen `bodyHtml`); Z2 misst die schärfere Lage —
// die Auffrischung ist nicht nur unterwegs, sondern GESCHEITERT — und deckt sie damit mit ab.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  lage: "ok" as "ok" | "laedt" | "fehler" | "auffrischung",
  rufe: 0,
}));

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
        get: vi.fn(async () => {
          box.rufe += 1;
          if (box.lage === "laedt") {
            // Nie erfüllt: die Fläche bleibt im Ladezustand stehen.
            return new Promise(() => {});
          }
          if (box.lage === "fehler") {
            throw new Error("Netz");
          }
          if (box.lage === "auffrischung" && box.rufe > 1) {
            throw new Error("Netz");
          }
          return globalThis.__job3474Ko;
        }),
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

import { onlineManager } from "../../apps/web/node_modules/@tanstack/react-query";
import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { fileLinkHtml } from "../../apps/web/src/lib/bodyFileLink";
import {
  LANGER_TEXT,
  abfragespeicher,
  el,
  flush,
  knopf,
  mount,
  suche,
  text,
  unmount,
} from "./lesen-harness";

const DATEI_NAME = "Vertrag-2024.docx";
const OBJEKT_ID = "5d4f2b6a-1c3e-4f8a-9b2d-77e1c0a4b915";
const BODY_MIT_DATEI = `${LANGER_TEXT}${fileLinkHtml({ objectId: OBJEKT_ID, name: DATEI_NAME })}`;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.lage = "ok";
  box.rufe = 0;
  onlineManager.setOnline(true);
});

afterEach(() => {
  unmount();
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

describe("JOB 3474 · §9 — die Datei-Aussage entsteht nur mit Daten und verschwindet nicht mit dem Netz", () => {
  it("Z0 · laden: kein Knopf, kein Platzhalter — die Fläche schweigt", async () => {
    box.lage = "laedt";
    await mount(BODY_MIT_DATEI);
    // Die Lesefläche steht, aber leer (`BibliothekLesen.tsx:478-480`).
    expect(el("bib-lesen")).not.toBeNull();
    expect(suche('[data-testid="bib-kopf-spruenge"]')).toBeNull();
    expect(suche('[data-testid="bib-sprung-originaldatei"]')).toBeNull();
    expect(text(el("bib-lesen"))).toBe("");
  });

  it("Z1 · Fehler beim Laden: EIN Satz plus Knopf — und keine Datei-Behauptung", async () => {
    box.lage = "fehler";
    await mount(BODY_MIT_DATEI);
    expect(text(el("bib-lesen"))).toContain(i18n.t("lib.lesen.fehler"));
    expect(suche('[data-testid="bib-sprung-originaldatei"]')).toBeNull();
    expect(text(el("bib-lesen"))).not.toContain(DATEI_NAME);
  });

  it("Z2 · Cache mit GESCHEITERTER Auffrischung: Eintrag und Knopf bleiben stehen", async () => {
    box.lage = "auffrischung";
    await mount(BODY_MIT_DATEI);
    // Vorbedingung: der erste Abruf gelang, der Knopf steht.
    expect(text(knopf("bib-sprung-originaldatei"))).toContain(DATEI_NAME);

    await act(async () => {
      await abfragespeicher().refetchQueries();
      await flush();
    });
    await act(flush);

    expect(box.rufe, "es gab wirklich einen zweiten Abruf").toBeGreaterThan(1);
    // Der Kern: der Weg zur Datei, die im Text weiterhin steht, geht nicht verloren.
    expect(
      suche('[data-testid="bib-sprung-originaldatei"]'),
      "der Knopf ist nach einer gescheiterten Auffrischung verschwunden",
    ).not.toBeNull();
    expect(text(knopf("bib-sprung-originaldatei"))).toContain(DATEI_NAME);
    expect(text(el("bib-titel"))).toBe("Reinigung Spritzzone Linie 3");
  });

  it("Z3 · offline: die Aussage trägt weiter — sie kommt aus dem schon geladenen Text", async () => {
    await mount(BODY_MIT_DATEI);
    expect(text(knopf("bib-sprung-originaldatei"))).toContain(DATEI_NAME);
    await act(async () => {
      onlineManager.setOnline(false);
      await flush();
    });
    await act(flush);
    // Kalibrierung: es ist wirklich offline.
    expect(onlineManager.isOnline()).toBe(false);
    expect(text(knopf("bib-sprung-originaldatei"))).toContain(DATEI_NAME);
    // Und die Fläche behauptet nichts über die Erreichbarkeit der Datei — der Download selbst
    // bleibt der bestehende Link und wird nicht neu beschriftet (§9, letzter Punkt).
    // `textContent` reiht die drei Knöpfe ohne Trennzeichen aneinander — genau so wird verglichen,
    // damit hier kein erfundenes Leerzeichen die Aussage weichspült.
    expect(text(el("bib-kopf-spruenge"))).toBe(
      i18n.t("lib.lesen.sprung.quellenLeer") +
        i18n.t("lib.lesen.sprung.originaldatei", { name: DATEI_NAME }) +
        i18n.t("lib.lesen.sprung.anhaengeLeerNebenDatei"),
    );
  });
});
