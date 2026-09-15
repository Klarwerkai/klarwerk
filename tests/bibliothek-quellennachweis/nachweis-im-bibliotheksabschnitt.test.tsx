// @vitest-environment jsdom
// ================================================================================================
// JOB 4095 — AUCH IN DER BIBLIOTHEK TRÄGT EINE QUELLE IHREN NACHWEIS: Zeitpunkt und Datei
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (Produkt-main `187cfb70`, 1.0.0-beta.1.517): dieselbe Quelle gibt
// auf zwei Flächen zwei verschiedene Antworten auf dieselbe Frage („woher stammt das?"). Auf
// `/pruefen` stehen seit JOB 4013/4077 Name, Zeitpunkt, Adresse, Belegstelle UND die Datei, aus der
// die Belegstelle stammt (`Validation.tsx:1590` ruft `quellennachweis`). In der Bibliothek —
// Wissensobjekt → „Mehr" → „Quellen & Belege" — zeichnete `MehrAbschnitte.tsx:751-798` nur Name,
// Stufe, Anbieter, Adresse und Auszug; `s.at` und `s.objectId` wurden an KEINER Stelle des
// Abschnitts gelesen. Die Angaben fehlten nicht am Draht (`KoSource` führt beide,
// `api/types.ts:88-104`) — sie wurden weggeworfen.
//
// GEMESSEN WIRD AN DER ECHTEN LESEFLÄCHE über die echte Route `/wissen/:id`
// (`KnowledgeDetail` → `BibliothekFlaeche` → `BibliothekLesen` → `MehrAbschnitte`), nicht an der
// Unterkomponente allein. Das ist die Promptverbesserung aus JOB 4075 R3 (`LEHREN.md`, 15.09.
// 07:02): „Bei Aussagen über gemeinsam angezeigte Hinweise zwischen Komponententest und
// vollständiger Aufruferintegration unterscheiden." Ein Test, der nur `MehrAbschnitte` mountet,
// belegte nicht, dass ein Mensch die Angabe je zu sehen bekommt — der Abschnitt wird erst beim
// Aufklappen von „Mehr" überhaupt gemountet. Bauform übernommen von
// `tests/berichtskopf-spruenge/kopf-fuehrt-zu-quellen-und-anhaengen.test.tsx`; ein zweiter Aufbau
// für dieselbe Fläche wäre eine zweite Wahrheit über sie.
//
// FEHLEN HEISST FEHLEN (Hausregel `koSource.ts:98-100`, `:117-119`): wo Anker oder Zeitpunkt
// fehlen, steht NICHTS — kein „—", kein „unbekannt", keine Ersatzzeile.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject, KoAttachment, KoSource } from "../../apps/web/src/api/types";

const box = vi.hoisted(() => ({
  ko: null as unknown,
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
        get: vi.fn(async () => box.ko),
        list: vi.fn(async () => [box.ko]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => box.ko),
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
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { sourceBadgeKey } from "../../apps/web/src/lib/koSource";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// `scrollIntoView` fehlt in jsdom; der Sprungweg der Lesefläche ruft sie.
(Element.prototype as unknown as { scrollIntoView: (o?: unknown) => void }).scrollIntoView =
  () => {};

const ZEIT_ISO = "2026-09-14T10:00:00Z";
const DATEINAME = "Pruefbericht-2026.pdf";
const ADRESSE = "https://beispiel.de/norm/din-1234/abschnitt-7";
const AUSZUG = "Kap. 1 — die tragende Naht wird vor dem Verzinken geprüft.";
const ANBIETER = "Wikipedia";

/** Dieselbe Zeitregel wie das Objektdatum auf derselben Fläche (`formatKoTimestamp`). */
const ERWARTETES_DATUM = new Date(ZEIT_ISO).toLocaleDateString("de", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function quelle(over: Partial<KoSource> = {}): KoSource {
  return {
    id: "q1",
    label: "DIN 1234",
    url: ADRESSE,
    excerpt: AUSZUG,
    kind: "external",
    peerValidated: false,
    provider: ANBIETER,
    author: "u1",
    at: ZEIT_ISO,
    ...over,
  };
}

function anhang(over: Partial<KoAttachment> = {}): KoAttachment {
  return {
    id: "a1",
    name: DATEINAME,
    mime: "application/pdf",
    objectId: "obj-1",
    author: "u1",
    at: ZEIT_ISO,
    ...over,
  };
}

function ko(sources: KoSource[], attachments: KoAttachment[]): KnowledgeObject {
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
    sources,
    attachments,
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

async function mount(bestand: KnowledgeObject): Promise<void> {
  box.ko = bestand;
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

function el(testId: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
}

const abschnitt = (): HTMLDetailsElement => {
  const d = container.querySelector<HTMLDetailsElement>('[data-bib-abschnitt="quellen"]');
  if (!d) {
    throw new Error("Der Abschnitt „quellen“ ist nicht gemountet");
  }
  return d;
};

const text = (e: Element): string => (e.textContent ?? "").replace(/\s+/g, " ").trim();

/**
 * Der Weg, den ein Mensch geht: „Mehr" aufklappen, dann den Abschnitt „Quellen & Belege" öffnen.
 * Der Sprungknopf am Kopf tut beides in einem Schritt und ist der echte, abgenommene Zugang
 * (JOB 3108 · UX-03) — er wird hier benutzt statt nachgebaut.
 */
async function quellenOeffnen(): Promise<void> {
  const knopf = el("bib-sprung-quellen");
  if (!knopf) {
    throw new Error("Der Sprungknopf „Quellen“ fehlt am Kopf der Lesefläche");
  }
  await act(async () => {
    knopf.click();
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
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

// ================================================================================================
// A) DIE VERANKERTE QUELLE — Dateiname und Zeitpunkt stehen in der Bibliothek
// ================================================================================================
describe("JOB 4095 · A: die Quelle in der Bibliothek trägt ihren Nachweis", () => {
  it("Dateiname und Zeitpunkt stehen im Abschnitt „Quellen & Belege“", async () => {
    await mount(ko([quelle({ objectId: "obj-1" })], [anhang()]));
    await quellenOeffnen();

    expect(abschnitt().open, "Vorbedingung: der Abschnitt steht offen").toBe(true);

    const datei = el("bib-quelle-datei");
    expect(datei, "der Dateiname fehlt an der Quelle in der Bibliothek").not.toBeNull();
    expect(text(datei as HTMLElement)).toContain(DATEINAME);

    const zeit = el("bib-quelle-zeit");
    expect(zeit, "der Zeitpunkt fehlt an der Quelle in der Bibliothek").not.toBeNull();
    expect(text(zeit as HTMLElement)).toContain(ERWARTETES_DATUM);

    // Kein geratenes Datum — dieselbe Zeitregel wie am Objektdatum.
    expect(text(abschnitt())).not.toContain("Invalid Date");
    expect(text(abschnitt())).not.toContain("NaN");
  });

  it("beide Angaben stehen an DERSELBEN Quelle wie ihr Name — nicht irgendwo im Abschnitt", async () => {
    await mount(ko([quelle({ objectId: "obj-1" })], [anhang()]));
    await quellenOeffnen();

    const eintrag = (el("bib-quelle-datei") as HTMLElement).closest("li");
    expect(eintrag, "der Dateiname steht in keinem Quelleneintrag").not.toBeNull();
    expect(text(eintrag as HTMLElement)).toContain("DIN 1234");
    expect(
      (eintrag as HTMLElement).querySelector('[data-testid="bib-quelle-zeit"]'),
      "Datei und Zeitpunkt stehen an verschiedenen Quellen",
    ).not.toBeNull();
  });

  it("der richtige Name aus mehreren Anhängen — die Auflösung trifft den Anker", async () => {
    await mount(
      ko(
        [quelle({ objectId: "obj-2" })],
        [
          anhang({ id: "a0", objectId: "obj-0", name: "Altes-Blatt.pdf" }),
          anhang({ id: "a1", objectId: "obj-1", name: "Foto.jpg", mime: "image/jpeg" }),
          anhang({ id: "a2", objectId: "obj-2", name: DATEINAME }),
        ],
      ),
    );
    await quellenOeffnen();

    expect(text(el("bib-quelle-datei") as HTMLElement)).toContain(DATEINAME);
    expect(text(el("bib-quelle-datei") as HTMLElement)).not.toContain("Altes-Blatt.pdf");
    expect(text(el("bib-quelle-datei") as HTMLElement)).not.toContain("Foto.jpg");
  });

  it("jede Quelle trägt ihren eigenen Nachweis — zwei Quellen, zwei Dateinamen", async () => {
    await mount(
      ko(
        [
          quelle({ id: "q1", label: "DIN 1234", objectId: "obj-1" }),
          quelle({ id: "q2", label: "Werksanweisung W-9", objectId: "obj-2" }),
        ],
        [
          anhang({ id: "a1", objectId: "obj-1", name: DATEINAME }),
          anhang({ id: "a2", objectId: "obj-2", name: "Werksanweisung-W9.pdf" }),
        ],
      ),
    );
    await quellenOeffnen();

    const dateien = [...abschnitt().querySelectorAll('[data-testid="bib-quelle-datei"]')].map((e) =>
      text(e),
    );
    expect(dateien).toEqual([DATEINAME, "Werksanweisung-W9.pdf"]);
  });

  it("der lange Dateiname bricht um, statt abgeschnitten zu werden (360 px)", async () => {
    const LANG = `${"Pruefbericht-Spritzzone-Linie-3-Quartal-2".repeat(3)}.pdf`;
    await mount(ko([quelle({ objectId: "obj-1" })], [anhang({ name: LANG })]));
    await quellenOeffnen();

    const datei = el("bib-quelle-datei") as HTMLElement;
    // Der VOLLE Name steht da — nichts wird stillschweigend gekürzt.
    expect(text(datei)).toBe(LANG);
    const klassen = datei.className;
    expect(
      /break-(all|words)/.test(klassen),
      `keine Umbruchregel am Dateinamen: „${klassen}“`,
    ).toBe(true);
    expect(klassen, "der Name wird abgeschnitten statt umgebrochen").not.toContain("truncate");
  });
});

// ================================================================================================
// B) OHNE ANKER KEINE DATEI — und trotzdem der Zeitpunkt
// ================================================================================================
describe("JOB 4095 · B: eine Quelle ohne Anker (Altbestand) behauptet keine Datei", () => {
  it("keine Datei-Marke, kein Platzhalter — der Zeitpunkt steht trotzdem", async () => {
    await mount(ko([quelle()], [anhang()]));
    await quellenOeffnen();

    expect(el("bib-quelle-datei"), "eine Datei ohne Anker aus dem Nichts").toBeNull();
    expect(el("bib-quelle-zeit"), "der Zeitpunkt fehlt").not.toBeNull();
    expect(text(el("bib-quelle-zeit") as HTMLElement)).toContain(ERWARTETES_DATUM);

    // Kalibrierung: der Anhang LIEGT am Objekt — sonst prüfte dieser Fall ein leeres Blatt.
    expect(JSON.stringify(box.ko)).toContain(DATEINAME);
    // …und sein Name erscheint nicht am QUELLENEINTRAG. Gemessen am `li`, nicht am ganzen
    // Abschnitt: die Anhangs-Auswahl des Formulars darunter (`MehrAbschnitte.tsx:841-845`) nennt
    // jeden ankerfähigen Dateinamen zu Recht — sie ist die Wahlliste, nicht der Nachweis.
    expect(text(abschnitt().querySelector("li") as HTMLElement)).not.toContain(DATEINAME);
  });

  it("ein leerer oder blanker Anker zählt wie ein fehlender", async () => {
    for (const leer of ["", "   "]) {
      await mount(ko([quelle({ objectId: leer })], [anhang()]));
      await quellenOeffnen();
      expect(el("bib-quelle-datei"), `Anker ${JSON.stringify(leer)}`).toBeNull();
      act(() => root.unmount());
      container.remove();
    }
    // Der letzte Durchlauf lässt einen gemounteten Baum für `afterEach` zurück.
    await mount(ko([quelle({ objectId: "   " })], [anhang()]));
  });

  it("ohne lesbaren Zeitpunkt steht keine Zeitangabe — und kein „Invalid Date“", async () => {
    for (const kaputt of ["", "irgendwann"]) {
      await mount(ko([quelle({ objectId: "obj-1", at: kaputt })], [anhang()]));
      await quellenOeffnen();
      expect(el("bib-quelle-zeit"), `at: ${JSON.stringify(kaputt)}`).toBeNull();
      expect(text(abschnitt())).not.toContain("Invalid Date");
      // Ein Fehlen steckt nicht an: die Datei steht weiterhin.
      expect(el("bib-quelle-datei")).not.toBeNull();
      act(() => root.unmount());
      container.remove();
    }
    await mount(ko([quelle({ objectId: "obj-1", at: "irgendwann" })], [anhang()]));
  });
});

// ================================================================================================
// C) EIN ANKER INS LEERE NENNT KEINE DATEI
// ================================================================================================
describe("JOB 4095 · C: der Anhang ist nicht (mehr) am Objekt", () => {
  it("Anker ohne passenden Anhang → keine Datei-Marke, kein Ersatztext", async () => {
    await mount(ko([quelle({ objectId: "obj-weg" })], [anhang()]));
    await quellenOeffnen();

    expect(el("bib-quelle-datei")).toBeNull();
    // Am Eintrag gemessen (Grund wie in Fall B): die Wahlliste des Formulars nennt den Namen zu Recht.
    expect(text(abschnitt().querySelector("li") as HTMLElement)).not.toContain(DATEINAME);
  });

  it("gar keine Anhänge am Objekt → keine Datei-Marke", async () => {
    await mount(ko([quelle({ objectId: "obj-1" })], []));
    await quellenOeffnen();

    expect(el("bib-quelle-datei")).toBeNull();
  });

  it("FEHLEN HEISST FEHLEN: kein „—“, kein „unbekannt“, kein „null“ am Quelleneintrag", async () => {
    await mount(ko([quelle({ objectId: "obj-weg", url: null, excerpt: null, at: "" })], []));
    await quellenOeffnen();

    // Gemessen am LISTENEINTRAG, nicht am ganzen Abschnitt: das Quellenformular darunter trägt
    // seine eigene „—"-Option (`MehrAbschnitte.tsx:840`, „keine Auswahl"), und ein
    // Platzhalterverbot über den ganzen Abschnitt wäre falsch-rot statt scharf.
    const eintrag = abschnitt().querySelector("li");
    expect(eintrag, "der Quelleneintrag fehlt").not.toBeNull();
    const gezeichnet = text(eintrag as HTMLElement);
    expect(gezeichnet).toContain("DIN 1234");
    expect(gezeichnet).not.toContain("—");
    expect(gezeichnet).not.toContain("unbekannt");
    expect(gezeichnet).not.toContain("null");
  });
});

// ================================================================================================
// D) GEGENRICHTUNG — alles Bestehende steht unverändert an seiner Stelle
// ================================================================================================
describe("JOB 4095 · D: der Nachweis ERGÄNZT den Abschnitt, er ersetzt nichts", () => {
  it("Name, Stufe, Anbieter, Adresse und Auszug stehen unverändert", async () => {
    await mount(ko([quelle({ objectId: "obj-1" })], [anhang()]));
    await quellenOeffnen();

    const eintrag = abschnitt().querySelector("li") as HTMLElement;
    expect(text(eintrag)).toContain("DIN 1234");
    expect(text(eintrag)).toContain(i18n.t(sourceBadgeKey({ peerValidated: false })));
    expect(text(eintrag)).toContain(ANBIETER);
    expect(text(eintrag)).toContain(AUSZUG);

    // Die Adresse bleibt die abgenommene Komponente der Bibliothek (`ExternalUrlText`): ein echter
    // Link auf die VOLLE Adresse, nicht auf die gekürzte Fassung des Nachweises.
    const link = eintrag.querySelector("a") as HTMLAnchorElement | null;
    expect(link, "der Adress-Link ist verschwunden").not.toBeNull();
    expect(link?.getAttribute("href")).toContain("beispiel.de/norm/din-1234/abschnitt-7");
  });

  it("der Löschknopf bleibt, solange bearbeitet werden darf", async () => {
    await mount(ko([quelle({ objectId: "obj-1" })], [anhang()]));
    await quellenOeffnen();

    const eintrag = abschnitt().querySelector("li") as HTMLElement;
    const knopf = eintrag.querySelector(`button[title="${i18n.t("ko.sourceRemove")}"]`);
    expect(knopf, "der Löschknopf der Quelle fehlt").not.toBeNull();
  });

  it("ohne Quellen bleibt der Leersatz allein stehen — keine leeren Marken", async () => {
    await mount(ko([], [anhang()]));
    await quellenOeffnen();

    expect(text(abschnitt())).toContain(i18n.t("ko.sourcesEmpty"));
    expect(el("bib-quelle-datei")).toBeNull();
    expect(el("bib-quelle-zeit")).toBeNull();
  });
});
