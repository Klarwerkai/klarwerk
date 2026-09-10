// @vitest-environment jsdom
// ================================================================================================
// JOB 3430 · Q1c — VERSIONEN UND BELEGE HOLEN IHREN STAND ÜBER EINEN EIGENEN WEG NACH.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (Codex am 05.09. gegen 1.0.0-beta.1.102, Befund
// `R-1613-20260905T193615162865`): im aufgeklappten Bereich „Mehr" kommt der Mensch an frische
// Fassungen und Belege NUR, indem er „Mehr" ganz zuklappt und wieder aufklappt. Die vorhandene
// `invalidate()` (`MehrAbschnitte.tsx`) hängt an den SCHREIBaktionen, wirft dabei fünf fremde
// Schlüssel zugleich weg (`ko`, `validation`, `kos`, `library`, `conflicts`) — und trifft genau
// diese beiden Abschnitte gar nicht.
//
// ------------------------------------------------------------------------------------------------
// WIE HIER GEMESSEN WIRD — und warum nicht an einem Standbild
// ------------------------------------------------------------------------------------------------
// Gemessen wird an der ECHTEN Lesefläche über die echte Route `/wissen/:id`
// (`KnowledgeDetail` → `BibliothekFlaeche` → `BibliothekLesen` → `MehrAbschnitte`) mit ECHTEN
// `useQuery`-Abrufen gegen einen echten `QueryClient`. Nur das „Netz" darunter (`api/endpoints`)
// ist ein Doppel, das die Rufe JE KANAL zählt und je Fall gelingen, scheitern oder HÄNGEN kann.
// Bauform der Fläche wörtlich übernommen aus `tests/ux25-beleg-zum-original/…`, Bauform des
// zählenden Netzes aus `tests/detail-wiederholweg/…` (JOB 3088) — nichts ist nachgebaut.
//
// Das ist der einzige Aufbau, in dem der Gegenstand überhaupt erreichbar ist: nach einem
// gescheiterten Nachschlag sind bei react-query `isError: true` UND `data` zugleich wahr, und genau
// diese Lage soll der Nachladeweg auflösen, OHNE den Bestand zu leeren. Ein Mock, der
// `useKoEvidence`/`useKoVersions` durch feste Werte ersetzte, hätte gar keinen Zwischenspeicher,
// den ein Knopf treffen könnte — er wäre grün, egal was die Fläche tut.
//
// UNABHÄNGIGE SOLLWERTE: die Marke des Nachladewegs (`data-bib-nachladen`) und die beiden
// Abschnittsschlüssel stehen hier als Literale und werden NICHT aus dem Produkt geholt.
//
// DIE FÄLLE:
//   K   Kalibrierung: die Fläche steht, beide Abschnitte sind offen, je GENAU EIN Abruf.
//   A1  Belege: Erstabruf gescheitert → der Weg holt nach, die Karten stehen da, der Fehler ist weg.
//   A2  Fassungen: dasselbe für die Schnappschüsse.
//   B1  Bestand bleibt WÄHREND des Nachladens stehen, der Ladezustand ist sichtbar.
//   B2  Bestand bleibt stehen, wenn das Nachladen SCHEITERT — samt datiertem Hinweis, ohne Fehlersatz.
//   C1  Der Weg der Belege lädt die Fassungen NICHT mit — und keinen fremden Schlüssel.
//   C2  Der Weg der Fassungen lädt die Belege NICHT mit — und keinen fremden Schlüssel.
//   D   Kein Abruf ohne Zutun: ohne Klick bleibt es bei je einem Ruf.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Die Marke des Nachladewegs — bewusst als Literal, nicht aus dem Produkt importiert (s. Kopf). */
const NACHLADEN_MARKE = "data-bib-nachladen";
const BELEGE = "belege";
const FASSUNGEN = "schnappschuesse";

const BELEG_TITEL = "Pruefprotokoll-Spritzzone-Linie-3-2026-08-31.png";
const FASSUNG_TITEL = "Reinigung Spritzzone Linie 3 — Fassung 2";

// Das „Netz": `lage` gilt für den NÄCHSTEN Ruf je Kanal, `rufe` zählt die tatsächlichen Rufe.
// Dadurch lässt sich ein erfolgreicher Erstabruf mit einem gescheiterten Nachschlag kombinieren.
// `haengt` legt das Versprechen in `loeser` ab; der Test löst es von Hand ein — ohne das ist der
// LAUFENDE Abruf (Fall B1) gar nicht messbar.
const netz = vi.hoisted(() => ({
  lage: {} as Record<string, string>,
  rufe: {} as Record<string, number>,
  loeser: {} as Record<string, (() => void) | undefined>,
  belege: [] as unknown[],
  fassungen: [] as unknown[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  // `liefere` ist ABSICHTLICH eine Funktion: bei „haengt" wird sie erst beim Einlösen ausgewertet,
  // sodass ein laufender Abruf einen NEUEREN Stand mitbringen kann als den beim Losschicken.
  const ruf = async <T,>(kanal: string, liefere: () => T): Promise<T> => {
    netz.rufe[kanal] = (netz.rufe[kanal] ?? 0) + 1;
    if (netz.lage[kanal] === "fehler") {
      throw new Error(`Netz weg (${kanal})`);
    }
    if (netz.lage[kanal] === "haengt") {
      return await new Promise<T>((erfuelle) => {
        netz.loeser[kanal] = () => erfuelle(liefere());
      });
    }
    return liefere();
  };
  const leer = async () => [];
  return {
    endpoints: {
      ko: {
        get: () => ruf("detail", () => globalThis.__job3430Ko),
        list: () => ruf("kos", () => [globalThis.__job3430Ko]),
        evidence: () => ruf("belege", () => [...netz.belege]),
        versions: () => ruf("fassungen", () => [...netz.fassungen]),
        neighbors: async () => ({ center: "ko-1", neighbors: [], excludedTags: [], limit: 8 }),
        act: async () => globalThis.__job3430Ko,
      },
      library: { search: () => ruf("suche", () => [globalThis.__job3430Ko]) },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: async () => [{ id: "u1", name: "Eva" }] },
      lifecycle: { pending: leer, linked: leer, couplingsFor: leer },
      external: { policy: async () => ({ stage: "blocked", enabled: false }) },
      uploadLimits: { get: async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 }) },
      reasoner: {
        status: async () => ({ active: false, mode: "off" }),
        config: async () => ({}),
        assist: async () => ({ text: "" }),
        assistPresets: leer,
        extract: async () => ({ points: [], note: null }),
        describeImage: async () => ({}),
      },
      aiCheck: { coverageSummary: async () => ({ total: 0 }) },
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
import type {
  EvidenceRecord,
  KnowledgeObject,
  KoVersionSnapshot,
} from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { AUFFRISCHUNG_HINWEIS_MARKE } from "../../apps/web/src/lib/confidentiality";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

declare global {
  // Der Bestand wird über den globalen Namensraum gereicht: `vi.mock` wird hochgezogen und darf
  // nichts aus dem Modulrumpf schließen.
  // eslint-disable-next-line no-var
  var __job3430Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

function ko(): KnowledgeObject {
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
    version: 2,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    history: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    comments: [],
    sources: [],
    attachments: [
      {
        id: "att-1",
        name: BELEG_TITEL,
        mime: "image/png",
        objectId: "obj-1",
        thumbnail: "data:image/png;base64,iVBORw0KGgo=",
        author: "u1",
        at: "2026-08-01T00:00:00.000Z",
      },
    ],
  } as KnowledgeObject;
}

function beleg(titel: string): EvidenceRecord {
  return {
    id: "ev-1",
    koId: "ko-1",
    koVersion: 2,
    kind: "attachment",
    attachmentId: "att-1",
    objectId: "obj-1",
    mime: "image/png",
    label: titel,
    createdBy: "u1",
    createdAt: "2026-08-31T10:00:00.000Z",
  };
}

function fassung(titel: string): KoVersionSnapshot {
  return {
    koId: "ko-1",
    version: 2,
    at: "2026-08-31T10:00:00.000Z",
    author: "u1",
    note: "Zweite Fassung",
    snapshot: { ...ko(), title: titel } as KnowledgeObject,
  };
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
  globalThis.__job3430Ko = ko();
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

const abschnitt = (schluessel: string): HTMLDetailsElement | null =>
  container.querySelector<HTMLDetailsElement>(`[data-bib-abschnitt="${schluessel}"]`);

const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();

async function klick(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
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

/** „Mehr" aufklappen und beide Abschnitte öffnen — der Ort, um den es geht. */
async function beideOeffnen(): Promise<void> {
  await klick(el("bib-mehr"));
  await vonHand(BELEGE, true);
  await vonHand(FASSUNGEN, true);
}

/** Der Nachladeweg eines Abschnitts. `null`, wenn es ihn nicht gibt — der Ausgangszustand. */
function nachladeweg(schluessel: string): HTMLButtonElement | null {
  const d = abschnitt(schluessel);
  const treffer = d?.querySelector(`[${NACHLADEN_MARKE}="${schluessel}"]`) ?? null;
  return treffer instanceof HTMLButtonElement ? treffer : null;
}

/** Derselbe Weg, aber als Pflicht: fehlt er, sagt der Fehler, was fehlt. */
function wegOderFehler(schluessel: string): HTMLButtonElement {
  const w = nachladeweg(schluessel);
  if (!w) {
    throw new Error(
      `Der Abschnitt „${schluessel}" bietet keinen eigenen Nachladeweg an (${NACHLADEN_MARKE}).`,
    );
  }
  return w;
}

/** Die datierten Sätze „Stand von … · Auffrischung fehlgeschlagen" innerhalb eines Abschnitts. */
function hinweise(schluessel: string): HTMLElement[] {
  const d = abschnitt(schluessel);
  return [
    ...(d?.querySelectorAll<HTMLElement>(`[data-testid="${AUFFRISCHUNG_HINWEIS_MARKE}"]`) ?? []),
  ];
}

/** Das offene Versprechen eines hängenden Abrufs einlösen — mit dem Stand von JETZT. */
async function loese(kanal: string): Promise<void> {
  const l = netz.loeser[kanal];
  if (!l) {
    throw new Error(`Kein offener Abruf auf dem Kanal „${kanal}"`);
  }
  netz.loeser[kanal] = undefined;
  await act(async () => {
    l();
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  netz.lage = {};
  netz.rufe = {};
  netz.loeser = {};
  netz.belege = [beleg(BELEG_TITEL)];
  netz.fassungen = [fassung(FASSUNG_TITEL)];
  qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Ohne Selbstlauf: was gezählt wird, ist wirklich ausgelöst worden. Ein `refetchInterval`
        // im Produkt bliebe davon unberührt und fiele in Fall D auf.
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
      },
    },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  vi.clearAllMocks();
});

// ------------------------------------------------------------------------------------------------
// K — KALIBRIERUNG. Ohne diesen Fall prüften alle anderen ein leeres Blatt.
// ------------------------------------------------------------------------------------------------
describe("JOB 3430 · K — die Fläche steht wirklich", () => {
  it("beide Abschnitte sind offen, tragen ihren Inhalt und wurden je GENAU EINMAL geholt", async () => {
    await mount();
    await beideOeffnen();

    expect(abschnitt(BELEGE)?.open, "der Abschnitt „Belege“ steht nicht offen").toBe(true);
    expect(abschnitt(FASSUNGEN)?.open, "der Abschnitt „Schnappschüsse“ steht nicht offen").toBe(
      true,
    );
    expect(text(abschnitt(BELEGE)), "der Beleg steht nicht da").toContain(BELEG_TITEL);
    expect(text(abschnitt(FASSUNGEN)), "die Fassung steht nicht da").toContain(FASSUNG_TITEL);
    expect(netz.rufe.belege, "der Belegabruf lief nicht genau einmal").toBe(1);
    expect(netz.rufe.fassungen, "der Fassungsabruf lief nicht genau einmal").toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------
// A1/A2 — DER KERN: nach einem gescheiterten Abruf holt der Weg die Daten nach.
// Vor der Änderung gab es diesen Weg nicht: `wegOderFehler` wirft, beide Fälle sind rot.
// ------------------------------------------------------------------------------------------------
describe("JOB 3430 · A1 — die Belege holen nach", () => {
  it("Erstabruf gescheitert, ein Klick: +1 Belegabruf, die Karte steht da, der Fehlersatz ist weg", async () => {
    netz.lage.belege = "fehler";
    await mount();
    await beideOeffnen();

    // Ehrlich: OHNE Bestand bleibt der Fehlersatz der Fehlersatz.
    expect(text(abschnitt(BELEGE)), "der gescheiterte Erstabruf steht nicht ehrlich da").toContain(
      i18n.t("state.error"),
    );
    const weg = wegOderFehler(BELEGE);
    expect(weg.type).toBe("button");
    expect(weg.disabled, "ein wartender Weg ist keiner").toBe(false);
    expect(weg.tabIndex, "der Weg liegt nicht in der Tabulator-Reihenfolge").toBe(0);
    const name = weg.getAttribute("aria-label") ?? text(weg);
    expect(name, "der zugängliche Name nennt den Abschnitt nicht").toContain(
      i18n.t("ko.mehr.belege"),
    );

    netz.lage.belege = "ok";
    const vorher = { ...netz.rufe };
    await klick(weg);

    expect(netz.rufe.belege, "Der Klick hat den Belegabruf nicht ausgelöst.").toBe(
      (vorher.belege ?? 0) + 1,
    );
    expect(text(abschnitt(BELEGE)), "der Beleg ist nicht nachgekommen").toContain(BELEG_TITEL);
    expect(text(abschnitt(BELEGE)), "der Fehlersatz ist nicht gegangen").not.toContain(
      i18n.t("state.error"),
    );
  });
});

describe("JOB 3430 · A2 — die Fassungen holen nach", () => {
  it("Erstabruf gescheitert, ein Klick: +1 Fassungsabruf, die Fassung steht da", async () => {
    netz.lage.fassungen = "fehler";
    await mount();
    await beideOeffnen();

    expect(
      text(abschnitt(FASSUNGEN)),
      "der gescheiterte Erstabruf steht nicht ehrlich da",
    ).toContain(i18n.t("state.error"));
    const weg = wegOderFehler(FASSUNGEN);
    const name = weg.getAttribute("aria-label") ?? text(weg);
    expect(name, "der zugängliche Name nennt den Abschnitt nicht").toContain(
      i18n.t("ko.mehr.schnappschuesse"),
    );

    netz.lage.fassungen = "ok";
    const vorher = { ...netz.rufe };
    await klick(weg);

    expect(netz.rufe.fassungen, "Der Klick hat den Fassungsabruf nicht ausgelöst.").toBe(
      (vorher.fassungen ?? 0) + 1,
    );
    expect(text(abschnitt(FASSUNGEN)), "die Fassung ist nicht nachgekommen").toContain(
      FASSUNG_TITEL,
    );
    expect(text(abschnitt(FASSUNGEN)), "der Fehlersatz ist nicht gegangen").not.toContain(
      i18n.t("state.error"),
    );
  });
});

// ------------------------------------------------------------------------------------------------
// B1 — DER BESTAND BLEIBT WÄHREND DES NACHLADENS STEHEN, DER LADEZUSTAND IST SICHTBAR.
// ------------------------------------------------------------------------------------------------
describe("JOB 3430 · B1 — während des Nachladens bleibt alles stehen", () => {
  it("hängender Abruf: Karten und Fassungen weiter da, der Weg zeigt sich als beschäftigt", async () => {
    await mount();
    await beideOeffnen();
    expect(text(abschnitt(BELEGE))).toContain(BELEG_TITEL);

    // Der Abruf läuft los und antwortet (noch) nicht — und bringt einen NEUEREN Stand mit.
    netz.lage.belege = "haengt";
    netz.belege = [beleg("Nachgefuehrter Beleg 2026-09-09.png")];
    await klick(wegOderFehler(BELEGE));

    const weg = wegOderFehler(BELEGE);
    expect(weg.getAttribute("aria-busy"), "der Ladezustand ist nicht sichtbar").toBe("true");
    expect(weg.disabled, "ein laufender Abruf darf nicht ein zweites Mal angestoßen werden").toBe(
      true,
    );
    expect(text(weg), "der Weg sagt nicht, dass er lädt").toContain(i18n.t("state.loading"));
    // DER KERN VON §3: der vorhandene Bestand verschwindet dabei NICHT.
    expect(
      text(abschnitt(BELEGE)),
      "der Bestand ist während des Nachladens verschwunden",
    ).toContain(BELEG_TITEL);
    expect(text(abschnitt(BELEGE)), "ein laufender Abruf ist kein Fehler").not.toContain(
      i18n.t("state.error"),
    );

    await loese("belege");
    expect(text(abschnitt(BELEGE)), "das Ergebnis des laufenden Abrufs kam nicht an").toContain(
      "Nachgefuehrter Beleg 2026-09-09.png",
    );
    expect(wegOderFehler(BELEGE).disabled, "der Weg bleibt gesperrt").toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// B2 — SCHEITERT DAS NACHLADEN, BLEIBT DER BESTAND STEHEN (Auftrag §3, Verbot 3).
// Wer `abfrageMitBestand` aus einem der beiden Abschnitte entfernt, macht genau diesen Fall rot.
// ------------------------------------------------------------------------------------------------
describe("JOB 3430 · B2 — ein gescheitertes Nachladen leert nichts", () => {
  it("Belege UND Fassungen behalten ihren Stand, mit datiertem Hinweis statt Fehlersatz", async () => {
    await mount();
    await beideOeffnen();

    netz.lage.belege = "fehler";
    netz.lage.fassungen = "fehler";
    await klick(wegOderFehler(BELEGE));
    await klick(wegOderFehler(FASSUNGEN));

    expect(text(abschnitt(BELEGE)), "die Belegkarte wurde durch einen Fehler ersetzt").toContain(
      BELEG_TITEL,
    );
    expect(text(abschnitt(BELEGE)), "aus einem Abrufscheitern wurde ein Fehlersatz").not.toContain(
      i18n.t("state.error"),
    );
    expect(hinweise(BELEGE).length, "der datierte Hinweis fehlt bei den Belegen").toBe(1);

    expect(text(abschnitt(FASSUNGEN)), "die Fassung wurde durch einen Fehler ersetzt").toContain(
      FASSUNG_TITEL,
    );
    expect(
      text(abschnitt(FASSUNGEN)),
      "aus einem Abrufscheitern wurde ein Fehlersatz",
    ).not.toContain(i18n.t("state.error"));
    expect(hinweise(FASSUNGEN).length, "der datierte Hinweis fehlt bei den Fassungen").toBe(1);
  });
});

// ------------------------------------------------------------------------------------------------
// C1/C2 — DIE REICHWEITE: der Weg betrifft GENAU seinen Abschnitt (Auftrag §3, Verbot 1).
// Wer den Weg auf `invalidateQueries({queryKey:["ko", id]})` umstellt, macht beide Fälle rot.
// ------------------------------------------------------------------------------------------------
describe("JOB 3430 · C1 — der Weg der Belege lädt nichts anderes mit", () => {
  it("+1 Belegabruf, und Fassungen, Eintrag, Bestand und Suche bleiben unberührt", async () => {
    await mount();
    await beideOeffnen();

    const vorher = { ...netz.rufe };
    await klick(wegOderFehler(BELEGE));

    expect(netz.rufe.belege).toBe((vorher.belege ?? 0) + 1);
    expect(netz.rufe.fassungen, "die Fassungen wurden mitgerufen").toBe(vorher.fassungen ?? 0);
    expect(netz.rufe.detail, "der Eintrag wurde mitgerufen").toBe(vorher.detail ?? 0);
    expect(netz.rufe.kos, "der Bestand wurde mitgerufen").toBe(vorher.kos ?? 0);
    expect(netz.rufe.suche, "die Suche wurde mitgerufen").toBe(vorher.suche ?? 0);
  });
});

describe("JOB 3430 · C2 — der Weg der Fassungen lädt nichts anderes mit", () => {
  it("+1 Fassungsabruf, und Belege, Eintrag, Bestand und Suche bleiben unberührt", async () => {
    await mount();
    await beideOeffnen();

    const vorher = { ...netz.rufe };
    await klick(wegOderFehler(FASSUNGEN));

    expect(netz.rufe.fassungen).toBe((vorher.fassungen ?? 0) + 1);
    expect(netz.rufe.belege, "die Belege wurden mitgerufen").toBe(vorher.belege ?? 0);
    expect(netz.rufe.detail, "der Eintrag wurde mitgerufen").toBe(vorher.detail ?? 0);
    expect(netz.rufe.kos, "der Bestand wurde mitgerufen").toBe(vorher.kos ?? 0);
    expect(netz.rufe.suche, "die Suche wurde mitgerufen").toBe(vorher.suche ?? 0);
  });
});

// ------------------------------------------------------------------------------------------------
// D — KEIN ABRUF OHNE ZUTUN DES MENSCHEN (Auftrag §3, Verbot 4).
// ------------------------------------------------------------------------------------------------
describe("JOB 3430 · D — ohne Klick lädt nichts nach", () => {
  it("nach dem Aufklappen und langem Zuwarten bleibt es bei je einem Abruf", async () => {
    await mount();
    await beideOeffnen();
    expect(nachladeweg(BELEGE), "der Weg muss wirklich dastehen").not.toBeNull();

    for (let i = 0; i < 4; i++) {
      await act(flush);
    }

    expect(netz.rufe.belege, "die Belege haben sich selbst nachgeladen").toBe(1);
    expect(netz.rufe.fassungen, "die Fassungen haben sich selbst nachgeladen").toBe(1);
  });
});
