// @vitest-environment jsdom
// ================================================================================================
// UX-26 · BELEG UND ORIGINAL IN DER BIBLIOTHEK (Abschnitt 9) — an der ECHTEN Lesefläche, DE/EN/NL.
// ================================================================================================
//
// Bauform wörtlich aus `tests/ux26-herkunft-belege/herkunft-belege-verstaendlich.test.tsx` und
// `tests/ux25-beleg-zum-original/belegkarte-zum-original.test.tsx`: die echte Route `/wissen/:id`
// (`KnowledgeDetail` → … → `MehrAbschnitte`) mit stillgelegter HTTP-Grenze, echtem i18next.
//
// WAS HIER NEU GEMESSEN WIRD (Auftrag arbeit:ux26-beleg-original-20260921):
//   K1  zwei tatsächliche Anhänge, ihre Belege und ein Quellbeleg: die Karte nennt den BELEG anders
//       als das ORIGINAL, die Zahlen von Anhängen und Belegen sind verschieden und stehen so da, und
//       der vorhandene Knopf führt zum RICHTIGEN Original — bis zum Öffnen seiner Datei.
//   K2  der Beleg eines abgelösten Originals bleibt als Karte stehen, und der Satz nennt beide
//       Tatsachen in DE/EN/NL — ohne Knopf und ohne dass irgendein Original geöffnet wird.
//   K3  „Beleg fehlt" und „kein Beleganlass" über `evidenceFreshnessLabelKey` in Abschnitt 9.
//   K4  der Leerstand: vorhandene Originale ohne eigenen Beleg bleiben erklärt, ein Leser bekommt
//       keinen Weg, ein Bearbeiter den vorhandenen „Quelle anlegen".
//
// Die Texte werden nicht nur im Katalog nachgeschlagen, sondern VON DER FLÄCHE gelesen und der
// unabhängig festgehaltenen Bedeutung (`bedeutung.ts`) vorgelegt. Den gebauten Browser mit echtem
// Server misst `beleg-original-im-echten-browser.test.ts`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  belege: [] as unknown[],
  rolle: "experte" as string,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: box.rolle })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__ux26BelegKo),
        list: vi.fn(async () => [globalThis.__ux26BelegKo]),
        versions: leer,
        evidence: vi.fn(async () => box.belege),
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__ux26BelegKo),
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
import type { EvidenceRecord, KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import { type Aussage, SCHLUESSEL, SPRACHEN, type Sprache, verstoesse } from "./bedeutung";

declare global {
  // eslint-disable-next-line no-var
  var __ux26BelegKo: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => undefined;

// ------------------------------------------------------------------------------------------------
// Der Bestand
// ------------------------------------------------------------------------------------------------
const ANHANG_1 = "Pruefprotokoll-Linie-3-Seite-1.pdf";
const ANHANG_2 = "Pruefprotokoll-Linie-3-Seite-2.pdf";
const ABGELOEST = "Messblatt-Linie-3-vom-Juli.pdf";
const QUELLE = "Werknorm WN 12-4";

const anhang = (id: string, name: string, objectId: string) => ({
  id,
  name,
  mime: "application/pdf",
  objectId,
  author: "u1",
  at: "2026-09-01T00:00:00.000Z",
});

function beleg(overrides: Partial<EvidenceRecord>): EvidenceRecord {
  return {
    id: "ev-1",
    koId: "ko-1",
    koVersion: 1,
    kind: "attachment",
    label: ANHANG_1,
    createdBy: "u1",
    createdAt: "2026-09-01T10:00:00.000Z",
    ...overrides,
  };
}

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Reinigung Spritzzone Linie 3",
    statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt.",
    bodyHtml: "<p>Reinigung und Prüfung.</p>",
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
    sources: [],
    attachments: [],
    ...overrides,
  } as KnowledgeObject;
}

/** Zwei echte Anhänge, eine Quelle — und VIER Belege: je Anhang einer, der Quellbeleg, und der
 *  Beleg eines inzwischen abgelösten dritten Originals. Anhänge 2, Belege 4: nicht gleich. */
function zweiOriginaleVierBelege(): { ko: KnowledgeObject; belege: EvidenceRecord[] } {
  return {
    ko: ko({
      attachments: [anhang("att-1", ANHANG_1, "obj-1"), anhang("att-2", ANHANG_2, "obj-2")],
      sources: [
        {
          id: "src-1",
          label: QUELLE,
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          author: "u1",
          at: "2026-09-01T00:00:00.000Z",
        },
      ],
    }),
    belege: [
      beleg({ id: "ev-a1", attachmentId: "att-1", objectId: "obj-1", mime: "application/pdf" }),
      beleg({
        id: "ev-a2",
        label: ANHANG_2,
        attachmentId: "att-2",
        objectId: "obj-2",
        mime: "application/pdf",
      }),
      beleg({ id: "ev-q", kind: "source", label: QUELLE, sourceId: "src-1" }),
      beleg({
        id: "ev-weg",
        label: ABGELOEST,
        attachmentId: "att-3",
        objectId: "obj-3",
        mime: "application/pdf",
      }),
    ],
  };
}

// ------------------------------------------------------------------------------------------------
// Die Fläche
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;
let geoeffnet: string[] = [];

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(k: KnowledgeObject, belege: EvidenceRecord[]): Promise<void> {
  globalThis.__ux26BelegKo = k;
  box.belege = belege;
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

const abschnitt = (schluessel: string): HTMLDetailsElement | null =>
  container.querySelector<HTMLDetailsElement>(`[data-bib-abschnitt="${schluessel}"]`);

const text = (e: Element): string => (e.textContent ?? "").replace(/\s+/g, " ").trim();

async function klick(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

/** Einen der Abschnitte VON HAND aufklappen — der Weg, den ein Mensch am `<summary>` geht. */
async function aufklappen(schluessel: string): Promise<HTMLDetailsElement> {
  const d = abschnitt(schluessel);
  if (!d) {
    throw new Error(`Abschnitt „${schluessel}“ fehlt`);
  }
  await act(async () => {
    d.open = true;
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
  return d;
}

async function belegeOeffnen(): Promise<HTMLDetailsElement> {
  const mehr = container.querySelector<HTMLElement>('[data-testid="bib-mehr"]');
  if (!mehr) {
    throw new Error("„bib-mehr“ fehlt auf der Lesefläche");
  }
  await klick(mehr);
  return aufklappen("belege");
}

/** Die Belegkarte, deren ERSTES Kind genau den Belegnamen trägt (nicht die Befundzeilen darüber). */
function karte(belege: HTMLElement, titel: string): HTMLElement {
  const treffer = Array.from(belege.querySelectorAll<HTMLElement>("li")).filter(
    (li) => (li.firstElementChild?.textContent ?? "").trim() === titel,
  );
  expect(treffer, `Belegkarte „${titel}“`).toHaveLength(1);
  return treffer[0] as HTMLElement;
}

/** Der Wert der Zeile „Belegaktualität" in Abschnitt 9 — der Text VOR den Zählern. */
function frischeLabel(belege: HTMLElement, sprache: Sprache): string {
  const titel = i18n.getFixedT(sprache)("ko.evFresh.title");
  const dt = Array.from(belege.querySelectorAll("dt")).find((d) => text(d) === titel);
  expect(dt, "die Zeile „Belegaktualität“ fehlt in Abschnitt 9").toBeTruthy();
  const dd = (dt as HTMLElement).nextElementSibling as HTMLElement;
  return Array.from(dd.childNodes)
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent ?? "")
    .join("")
    .trim();
}

function pruefeBedeutung(sprache: Sprache, aussage: Aussage, vonDerFlaeche: string): void {
  expect(vonDerFlaeche, `${sprache}: die Fläche zeigt nicht den Katalogtext`).toBe(
    i18n.getFixedT(sprache)(SCHLUESSEL[aussage]),
  );
  expect(verstoesse(sprache, aussage, vonDerFlaeche)).toEqual([]);
}

beforeEach(() => {
  box.rolle = "experte";
  geoeffnet = [];
  // Das Öffnen des Originals wird MITGESCHRIEBEN, nicht ausgeführt: jsdom hat keinen zweiten Tab.
  vi.spyOn(window, "open").mockImplementation((url?: string | URL) => {
    geoeffnet.push(String(url));
    return null;
  });
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  vi.restoreAllMocks();
  await i18n.changeLanguage("de");
});

for (const sprache of SPRACHEN) {
  describe(`UX-26 · Beleg und Original in Abschnitt 9 — ${sprache.toUpperCase()}`, () => {
    it(`K1 · ${sprache}: zwei Originale, vier Belege — getrennt benannt, verschieden gezählt, der Knopf öffnet das richtige Original`, async () => {
      await i18n.changeLanguage(sprache);
      const t = i18n.getFixedT(sprache);
      const { ko: k, belege } = zweiOriginaleVierBelege();
      await mount(k, belege);
      const abschnitt9 = await belegeOeffnen();

      // Zahlen: Anhänge und Belege stehen VERSCHIEDEN da — so, wie sie sind.
      expect(text(abschnitt9)).toContain(
        t("ko.evCons.counts", { sources: "1", attachments: "2", evidence: "4" }),
      );
      // Alle vier Belege haben ihre Karte, auch der ohne Original.
      for (const titel of [ANHANG_1, ANHANG_2, QUELLE, ABGELOEST]) {
        karte(abschnitt9, titel);
      }

      // Sprache: die Karte benennt den BELEG, der Knopf das ORIGINAL — zwei Wörter für zwei Dinge.
      const zweite = karte(abschnitt9, ANHANG_2);
      const art = t("ko.evidenceKind.attachment");
      const knopfText = t("ko.evidenceToOriginal");
      expect(text(zweite)).toContain(art);
      expect(art).not.toBe(knopfText);
      const knoepfe = Array.from(zweite.querySelectorAll<HTMLButtonElement>("button"));
      expect(knoepfe).toHaveLength(1);
      const knopf = knoepfe[0] as HTMLButtonElement;
      expect(text(knopf)).toBe(knopfText);
      expect(knopf.getAttribute("data-bib-beleg-sprung")).toBe("ev-a2");

      // Der vorhandene Weg: Sprung auf GENAU den zweiten Anhang, dann dessen Original öffnen.
      await klick(knopf);
      const ziel = container.querySelector<HTMLElement>('[data-bib-anhang="att-2"]');
      expect(document.activeElement, "der Fokus liegt nicht auf dem zweiten Original").toBe(ziel);
      await klick(ziel as HTMLElement);
      expect(geoeffnet).toEqual(["/api/objects/obj-2/raw"]);
    });

    it(`K2 · ${sprache}: das Original ist weg, der Beleg bleibt — der Satz sagt beides, kein Knopf, kein Öffnen`, async () => {
      await i18n.changeLanguage(sprache);
      const { ko: k, belege } = zweiOriginaleVierBelege();
      await mount(k, belege);
      const abschnitt9 = await belegeOeffnen();

      const weg = karte(abschnitt9, ABGELOEST);
      expect(weg.querySelectorAll("button"), "ein Knopf führte ins Leere").toHaveLength(0);
      const saetze = Array.from(weg.querySelectorAll("p")).map(text);
      expect(saetze).toHaveLength(1);
      pruefeBedeutung(sprache, "abgeloest", saetze[0] as string);
      // Die Karten MIT Original tragen den Satz nicht — er gehört an genau den einen Fall.
      for (const titel of [ANHANG_1, ANHANG_2, QUELLE]) {
        expect(text(karte(abschnitt9, titel))).not.toContain(saetze[0] as string);
      }
      // Kein geratenes Original: niemand hat eine Datei geöffnet.
      expect(geoeffnet).toEqual([]);
    });

    it(`K3 · ${sprache}: Quellen/Anhänge ohne Belegzeile → „Beleg fehlt“, ohne Behauptung einer fehlenden Datei`, async () => {
      await i18n.changeLanguage(sprache);
      const { ko: k } = zweiOriginaleVierBelege();
      await mount(k, []);
      const abschnitt9 = await belegeOeffnen();

      pruefeBedeutung(sprache, "belegFehlt", frischeLabel(abschnitt9, sprache));
      // Die Originale SIND da — kein Satz behauptet das Gegenteil.
      expect(text(abschnitt9)).not.toContain(
        i18n.getFixedT(sprache)("ko.evidenceOriginalDetached"),
      );
      expect(text(abschnitt9)).toContain(i18n.getFixedT(sprache)("ko.evidenceEmpty"));
    });

    it(`K3/K4 · ${sprache}: ein Altoriginal ohne eigenen Beleg → „kein Beleganlass“, Leerstand und Original bleiben erklärt`, async () => {
      await i18n.changeLanguage(sprache);
      const t = i18n.getFixedT(sprache);
      await mount(
        ko({
          attachments: [
            {
              id: "alt-1",
              name: "altes-foto.png",
              mime: "image/png",
              dataUrl: "data:image/png;base64,iVBORw0KGgo=",
              author: "u1",
              at: "2026-01-01T00:00:00.000Z",
            },
          ] as NonNullable<KnowledgeObject["attachments"]>,
        }),
        [],
      );
      const abschnitt9 = await belegeOeffnen();

      pruefeBedeutung(sprache, "keinAnlass", frischeLabel(abschnitt9, sprache));
      expect(text(abschnitt9)).toContain(t("ko.evidenceEmpty"));
      expect(text(abschnitt9)).not.toContain(t("ko.evidenceOriginalDetached"));
      // Das Original selbst bleibt unter „Anhänge" erreichbar — und öffnet sich dort.
      await aufklappen("anhaenge");
      const original = container.querySelector<HTMLElement>('[data-bib-anhang="alt-1"]');
      expect(original, "das Altoriginal fehlt unter „Anhänge“").not.toBeNull();
      await klick(original as HTMLElement);
      expect(geoeffnet).toEqual(["data:image/png;base64,iVBORw0KGgo="]);
      // Der Bearbeiter bekommt den VORHANDENEN Weg, sonst keinen.
      const weg = abschnitt9.querySelector<HTMLButtonElement>("[data-bib-beleg-leer-weg]");
      expect(weg, "der vorhandene Weg „Quelle anlegen“ fehlt").not.toBeNull();
      expect(text(weg as HTMLElement)).toBe(t("ko.evidenceEmptyCta"));
    });

    it(`K4 · ${sprache}: ein Leser sieht Leerstand und Frischezustand, aber keine unzulässige Aktion`, async () => {
      await i18n.changeLanguage(sprache);
      box.rolle = "viewer";
      await mount(ko(), []);
      const abschnitt9 = await belegeOeffnen();

      pruefeBedeutung(sprache, "keinAnlass", frischeLabel(abschnitt9, sprache));
      expect(text(abschnitt9)).toContain(i18n.getFixedT(sprache)("ko.evidenceEmpty"));
      expect(abschnitt9.querySelector("[data-bib-beleg-leer-weg]")).toBeNull();
      expect(abschnitt9.querySelectorAll("button")).toHaveLength(
        // Einzig der Nachladeweg des Abschnitts (JOB 3430) — er schreibt nichts.
        abschnitt9.querySelectorAll('[data-bib-nachladen="belege"]').length,
      );
    });
  });
}
