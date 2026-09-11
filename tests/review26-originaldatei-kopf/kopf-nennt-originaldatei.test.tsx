// @vitest-environment jsdom
// ================================================================================================
// JOB 3474 · REVIEW26 — DER KOPF SAGTE „ANHÄNGE · KEINE", WÄHREND DIE ORIGINAL-DOCX IM TEXT HING.
// ================================================================================================
//
// DER BEFUND IM WORTLAUT (`gespraech/advisor-freitag/NUTZERBEFUNDE-AN-CLAUDE-20260908.md:47-51`,
// Posten 4): „Am Kopf Quellen und Belege · keine / Anhänge · keine; die geöffnete Anhangsektion
// meldet ebenfalls keine Anhänge. Eine funktionierende Original-DOCX ist erst nach dem langen Text
// verlinkt."
//
// DIE GEMESSENE URSACHE (Lieferung 1): der Ganzdokument-Import lädt das Original in den
// Object-Store und hängt es als Body-Datei-Referenz an den Entwurfstext
// (`apps/web/src/pages/Capture.tsx:1336-1349`, `fileLinkHtml`). Ein `KoAttachment` entsteht dabei
// NICHT — `finalizeCaptureSubmit` bekommt sein `original` nur im Warteschlangen-Weg
// (`Capture.tsx:1810-1812`: `fileQueue && fileOriginal ? … : null`). Beide Kopfzähler hängen aber an
// `ko.attachments` / `ko.sources` (`BibliothekLesen.tsx:534-536`) — die Datei ist am Kopf unsichtbar,
// und der Knopf sagt „keine".
//
// WAS HIER GEMESSEN WIRD: die ECHTE Lesefläche, gemountet über die echte Route (s. Prüfstand in
// `lesen-harness.tsx`), mit einem `bodyHtml`, dessen Datei-Referenz aus GENAU der Schreibform
// stammt, die das Produkt erzeugt (`fileLinkHtml`) — kein nachgebautes HTML.
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

import i18n from "../../apps/web/src/i18n";
import { fileLinkHtml, objectRawHref } from "../../apps/web/src/lib/bodyFileLink";
import {
  LANGER_TEXT,
  el,
  klick,
  knopf,
  mount,
  scrollRufe,
  suche,
  text,
  unmount,
  zugaenglicherName,
} from "./lesen-harness";

const DATEI_NAME = "Vertrag-2024.docx";
const OBJEKT_ID = "5d4f2b6a-1c3e-4f8a-9b2d-77e1c0a4b915";
/** Genau die Schreibform des Produkts — die Leseseite wird gegen sie geprüft, nicht gegen HTML von Hand. */
const DATEI_LINK = fileLinkHtml({ objectId: OBJEKT_ID, name: DATEI_NAME });
const BODY_MIT_DATEI = `${LANGER_TEXT}${DATEI_LINK}`;

const ZWEITER_NAME = "Anlage-B.pdf";
const ZWEITE_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

describe("JOB 3474 · der Kopf nennt die Originaldatei, die im Bericht hängt", () => {
  it("F0 · KALIBRIERUNG: die Datei hängt wirklich im Text, hinter allem, und der Link funktioniert", async () => {
    await i18n.changeLanguage("de");
    await mount(BODY_MIT_DATEI);
    // Der Ausgangsbefund ist real: der Link steht IM Fließtext, ganz hinten.
    const anker = suche<HTMLAnchorElement>(
      `[data-testid="bib-text"] .attachment a[href="${objectRawHref(OBJEKT_ID)}"]`,
    );
    expect(anker, "die Original-DOCX ist gar nicht im Text verlinkt").not.toBeNull();
    expect(text(anker as HTMLAnchorElement)).toBe(DATEI_NAME);
    expect(text(el("bib-text")).length, "der Text ist wirklich lang").toBeGreaterThan(2000);
    // …und das Objekt trägt WEDER Anhang NOCH Quelle (die gemessene Ursache).
    expect(globalThis.__job3474Ko.attachments ?? []).toHaveLength(0);
    expect(globalThis.__job3474Ko.sources ?? []).toHaveLength(0);
  });

  it("F1 · am Kopf steht ein Knopf, der die Datei BEIM NAMEN nennt", async () => {
    await i18n.changeLanguage("de");
    await mount(BODY_MIT_DATEI);
    const kopf = el("bib-kopf-spruenge");
    const treffer = [...kopf.querySelectorAll<HTMLButtonElement>("button")].filter((b) =>
      zugaenglicherName(b).includes(DATEI_NAME),
    );
    expect(
      treffer.length,
      `kein Kopfknopf nennt „${DATEI_NAME}" — am Kopf steht: „${text(kopf)}"`,
    ).toBe(1);
    // Es ist der vorgesehene Knopf, und er nennt den Namen SICHTBAR (nicht nur im aria-label).
    expect(text(knopf("bib-sprung-originaldatei"))).toContain(DATEI_NAME);
  });

  it("F2 · der Widerspruch ist weg: neben der Datei steht keine unqualifizierte Leerfassung mehr", async () => {
    await i18n.changeLanguage("de");
    await mount(BODY_MIT_DATEI);
    const anhang = knopf("bib-sprung-anhaenge");
    expect(
      text(anhang),
      "der Kopf behauptet weiter „Anhänge · keine“, während die Datei im Text hängt",
    ).not.toBe(i18n.t("lib.lesen.sprung.anhaengeLeer"));
    expect(text(anhang)).toBe(i18n.t("lib.lesen.sprung.anhaengeLeerNebenDatei"));
    // Variante A des Auftrags (Lieferung 4): der neue Knopf steht VOR dem Anhangknopf.
    const datei = knopf("bib-sprung-originaldatei");
    expect(datei.compareDocumentPosition(anhang) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
  });

  it("F3 · ein Klick führt zur Datei: ihr Link bekommt den Fokus und kommt ins Bild", async () => {
    await i18n.changeLanguage("de");
    await mount(BODY_MIT_DATEI);
    const anker = suche<HTMLAnchorElement>(
      `[data-testid="bib-text"] .attachment a[href="${objectRawHref(OBJEKT_ID)}"]`,
    ) as HTMLAnchorElement;
    expect(scrollRufe.length, "Vorbedingung: noch kein Sprung").toBe(0);
    await klick(knopf("bib-sprung-originaldatei"));
    expect(document.activeElement, "der Fokus liegt nicht auf dem Datei-Link").toBe(anker);
    expect(scrollRufe.map((r) => r.ziel)).toEqual([anker]);
    // Und der Weg führt wirklich zur Datei, nicht nur irgendwohin.
    expect(anker.getAttribute("href")).toBe(`/api/objects/${OBJEKT_ID}/raw`);
  });

  it("F4 · zwei Dateien: der Knopf nennt die Zahl, sein zugänglicher Name unterscheidet sie", async () => {
    await i18n.changeLanguage("de");
    await mount(
      `${LANGER_TEXT}${DATEI_LINK}${fileLinkHtml({ objectId: ZWEITE_ID, name: ZWEITER_NAME })}`,
    );
    const b = knopf("bib-sprung-originaldatei");
    expect(text(b)).toBe(i18n.t("lib.lesen.sprung.originaldateien", { count: 2 }));
    expect(zugaenglicherName(b)).toContain(DATEI_NAME);
    expect(zugaenglicherName(b)).toContain(ZWEITER_NAME);
  });

  it("F5 · EN und NL sagen es in ihrer Sprache — und nicht auf Deutsch", async () => {
    for (const [sprache, erwartet] of [
      ["en", "Original file"],
      ["nl", "Origineel bestand"],
    ] as const) {
      await i18n.changeLanguage(sprache);
      await mount(BODY_MIT_DATEI);
      const b = knopf("bib-sprung-originaldatei");
      expect(text(b), `Sprache ${sprache}`).toContain(erwartet);
      expect(text(b), `Sprache ${sprache} zeigt die deutsche Fassung`).not.toContain(
        "Originaldatei",
      );
      expect(text(b)).toContain(DATEI_NAME);
      expect(text(knopf("bib-sprung-anhaenge"))).toBe(
        i18n.t("lib.lesen.sprung.anhaengeLeerNebenDatei"),
      );
    }
    await i18n.changeLanguage("de");
  });
});
