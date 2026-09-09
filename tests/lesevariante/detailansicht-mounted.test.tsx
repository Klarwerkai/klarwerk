// @vitest-environment jsdom
// ================================================================================================
// JOB 3326 · LESEVARIANTE — DIE GEMOUNTETE LESEANSICHT (c) UND DER SPRACHWECHSEL (f).
// ================================================================================================
//
// Gemessen wird an der ECHTEN Seite `/wissen/:id` (KnowledgeDetail) im DOM, nicht an einer
// Hilfskomponente. Die vier Aussagen dieses Auftrags, die nur hier fallen können:
//
//   c1  DE mit Variante  → deutscher Titel, sichtbarer Hinweis „Übersetzung · Original: Englisch",
//                          Umschalter „Original anzeigen"
//   c2  EN (= Originalsprache) → Original, KEIN Hinweis, KEIN Umschalter
//   c3  Umschalten       → die übersetzte Leseansicht verschwindet, der Weg zurück bleibt
//   f   Sprachwechsel am GEMOUNTETEN Baum → die Anzeige wechselt ohne Neuladen, die Auswahl
//                          (der Eintrag in der Adresse) bleibt
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  ko: {} as Record<string, unknown>,
  /** Wie oft die Übersicht geholt wurde — je Sprache. */
  uebersichtRufe: [] as string[],
  /** Wie oft der Fließtext einer Variante geholt wurde. */
  vollRufe: [] as string[],
  /** Der Abruf der Übersicht scheitert (Fehlzustand statt „keine Übersetzung"). */
  uebersichtFaellt: false,
  /** JOB 3326 R2: Der Quellabgleich der gelieferten Variante. */
  quellabgleich: "bestaetigt" as "bestaetigt" | "unbestaetigt",
  /** JOB 3326 R2: Das Original hat sich seit der Übersetzung geändert. */
  originalGeaendert: false,
  /**
   * JOB 3326 R3: Wie der Server auf den EINZELABRUF antwortet — genau die vier Lagen, die er
   * wirklich kennt. `ok` liefert die Variante; `keine` ist der 404 `NO_LESEVARIANTE` (es gibt
   * schlicht keine Übersetzung); `weg` ist der 404 `NOT_FOUND` eines gelöschten oder unsichtbaren
   * Objekts; `netz` ist ein Abbruch ohne Antwort.
   */
  einzelabruf: "ok" as "ok" | "keine" | "weg" | "netz" | "unvollstaendig",
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Der ECHTE Fehlertyp des Clients — der Unterschied „es gibt keine Übersetzung" gegen „das Objekt
// ist weg" hängt an seinem `code`, und ein nachgebauter Fehler prüfte diese Unterscheidung nicht.
import { ApiError } from "../../apps/web/src/api/client";

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  const variante = () => ({
    koId: "ko-1",
    lang: "de",
    originalLanguage: "en",
    title: "Kundenprofil: Harbor Field Services",
    statement: "Harbor Field Services ist ein fiktiver Kunde mit 25 Büronutzern.",
    herkunft: "lokale Lieferung advisor-ict-en-v1",
    status: "draft_translation_not_business_approval",
    originalGeaendert: box.originalGeaendert,
    quellabgleich: box.quellabgleich,
    updatedAt: "2026-09-08T12:00:00.000Z",
  });
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => box.ko),
        list: leer,
        versions: leer,
        evidence: leer,
        act: vi.fn(async () => box.ko),
      },
      lesevarianten: {
        uebersicht: vi.fn(async (lang: string) => {
          box.uebersichtRufe.push(lang);
          if (box.uebersichtFaellt) {
            throw new Error("offline");
          }
          // NUR Deutsch trägt eine Variante — das englische Original ist kein Zweitexemplar.
          return { lang, eintraege: lang === "de" ? [variante()] : [] };
        }),
        fuerKo: vi.fn(async (koId: string, lang: string) => {
          box.vollRufe.push(`${koId}/${lang}`);
          if (box.einzelabruf === "netz") {
            throw new TypeError("Failed to fetch");
          }
          if (box.einzelabruf === "weg") {
            throw new ApiError(404, "NOT_FOUND", "Wissensobjekt nicht gefunden.");
          }
          // Genau wie der Server: nur die Nicht-Originalsprache trägt eine Variante.
          if (box.einzelabruf === "keine" || lang !== "de") {
            throw new ApiError(404, "NO_LESEVARIANTE", "Keine Lesevariante in dieser Sprache.");
          }
          if (box.einzelabruf === "unvollstaendig") {
            // Eine 200er-Antwort, die keine Variante trägt (fremder Vertrag, Proxy, Umbau).
            return {} as never;
          }
          return {
            ...variante(),
            bodyHtml: "<p>Harbor Field Services ist ein fiktiver Kunde mit 25 Büronutzern.</p>",
            sourceBodySha256: null,
            originalSha256: "a".repeat(64),
            uebersetzungSha256: "b".repeat(64),
          };
        }),
      },
      objects: { upload: vi.fn(async () => ({ id: "obj-1", size: 1 })) },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({})),
        describeImage: vi.fn(async () => ({})),
        extract: vi.fn(async () => ({ points: [], note: null })),
      },
      audit: { list: leer },
      conflicts: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Pia" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "search_on_click" })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
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
import { KoSummaryDisclosure } from "../../apps/web/src/components/KoSummaryDisclosure";
import i18n from "../../apps/web/src/i18n";
import { lesevariantenVerwerfen } from "../../apps/web/src/lib/lesevariante";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const ORIGINAL_TITEL = "Customer brief: Harbor Field Services";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
                MemoryRouter,
                { initialEntries: ["/wissen/ko-1"] },
                createElement(
                  NavGuardProvider,
                  null,
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
}

/**
 * ================================================================================================
 * JOB 3326 R4 (Codex 7d148d03, Punkt 3) — DEN „WARMEN VORRAT" WIRKLICH WARM MACHEN.
 * ================================================================================================
 *
 * WAS AN W1–W3 NOCH FEHLTE. Die drei Fälle heissen „warmer Vorrat", aber sie füllten ihn nicht:
 * seit R3 liest `KnowledgeDetail` den Übersichts-Vorrat GAR NICHT MEHR (`useFrischeLesevariante`
 * statt `useLesevariante`, KnowledgeDetail.tsx:77). Nach dem ersten Besuch stand `uebersichtRufe`
 * also leer — die Voraussetzung, gegen die geprüft werden sollte, gab es nicht. Ein Test, der
 * seine eigene Voraussetzung nicht herstellt, misst die Lage nicht, die er benennt.
 *
 * DESHALB FÜLLT DIESE HILFE DEN VORRAT ÜBER DEN ECHTEN VERBRAUCHER: sie montiert die echte
 * `KoSummaryDisclosure` (die einzige Fläche, die `useLesevariante` noch ruft), lässt den Abruf
 * ERFOLGREICH durchlaufen und prüft an ihrer Anzeige nach, dass die deutsche Fassung wirklich im
 * Vorrat liegt. Erst danach beginnen die Detailbesuche — und der Vorrat wird zwischen ihnen
 * ausdrücklich NICHT zurückgesetzt.
 *
 * SIE HÄNGT SICH IN EINEN EIGENEN BEHÄLTER, der vor den Detailbesuchen wieder verschwindet: der
 * Vorrat ist ein Modul-Objekt und bleibt warm, aber `text()` misst danach ausschliesslich die
 * Detailfläche. Was die Vorschau selbst nach einem Löschen zeigt, ist eine andere Frage als die
 * hier gestellte.
 */
async function waermeUebersichtsvorrat(): Promise<void> {
  const behaelter = document.createElement("div");
  document.body.appendChild(behaelter);
  const wurzel = createRoot(behaelter);
  await act(async () => {
    wurzel.render(
      createElement(KoSummaryDisclosure, {
        source: { id: "ko-1", statement: "Harbor Field Services is a fictional customer." },
        defaultOpen: true,
      }),
    );
    await flush();
  });
  // Der Beleg, dass der Vorrat WIRKLICH warm ist: der Abruf lief, und die Vorschau zeigt daraus die
  // deutsche Kernaussage samt Kennzeichnung — nicht das englische Original.
  expect(box.uebersichtRufe, "der Übersichts-Vorrat wurde nicht gefüllt").toContain("de");
  expect(behaelter.querySelector('[data-testid="ko-preview-uebersetzung"]')).not.toBeNull();
  expect(behaelter.textContent).toContain("Harbor Field Services ist ein fiktiver Kunde");
  act(() => wurzel.unmount());
  behaelter.remove();
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function hinweis(): HTMLElement | null {
  return container.querySelector('[data-testid="lesevariante-hinweis"]');
}

function umschalter(): HTMLButtonElement | null {
  return container.querySelector('[data-testid="lesevariante-umschalter"]');
}

beforeEach(async () => {
  box.ko = {
    id: "ko-1",
    title: ORIGINAL_TITEL,
    statement: "Harbor Field Services is a fictional customer with 25 office users.",
    bodyHtml: "<p>Harbor Field Services is a fictional customer.</p>",
    type: "best_practice",
    category: "Onboarding",
    tags: ["advisor"],
    status: "validiert",
    version: 1,
    trust: 3,
    confidence: 3,
    author: "importer",
    originalAuthor: "importer",
    createdAt: "2026-09-01T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    conditions: [],
    measures: [],
    neededValidations: 3,
    assignments: [],
    asset: null,
  };
  box.uebersichtRufe = [];
  box.vollRufe = [];
  box.uebersichtFaellt = false;
  box.quellabgleich = "bestaetigt";
  box.originalGeaendert = false;
  box.einzelabruf = "ok";
  lesevariantenVerwerfen();
  await act(async () => {
    await i18n.changeLanguage("de");
  });
});

afterEach(async () => {
  if (container.isConnected) {
    act(() => root.unmount());
    container.remove();
  }
  await act(async () => {
    await i18n.changeLanguage("de");
  });
});

describe("JOB 3326 · c · die Detailansicht in der gewählten Sprache", () => {
  it("c1 · DE mit Variante: deutscher Titel, sichtbarer Hinweis, Umschalter — das Original steht daneben", async () => {
    await mount();
    expect(container.querySelector('[data-testid="lesevariante-titel"]')?.textContent).toBe(
      "Kundenprofil: Harbor Field Services",
    );
    expect(hinweis()).not.toBeNull();
    expect(text()).toContain("Übersetzung · Original: Englisch");
    // Die Übersetzung ist ausdrücklich KEINE Freigabe.
    expect(text()).toContain("Übersetzung, keine Freigabe");
    expect(text()).toContain("lokale Lieferung advisor-ict-en-v1");
    expect(umschalter()?.textContent).toContain("Original anzeigen");
    // Und die Fläche mit dem Original ist weiterhin da (dieselbe Kennung, derselbe Eintrag).
    expect(container.querySelector('[data-testid="page-wissen"]')).not.toBeNull();
    expect(text()).toContain(ORIGINAL_TITEL);
  });

  it("c2 · EN (= Originalsprache): Original, KEIN Hinweis, KEIN Umschalter", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    await mount();
    expect(hinweis()).toBeNull();
    expect(umschalter()).toBeNull();
    expect(container.querySelector('[data-testid="lesevariante-titel"]')).toBeNull();
    expect(text()).not.toContain("Kundenprofil: Harbor Field Services");
    expect(text()).toContain(ORIGINAL_TITEL);
  });

  it('c3 · „Original anzeigen" nimmt die übersetzte Leseansicht weg und lässt den Weg zurück stehen', async () => {
    await mount();
    const knopf = umschalter();
    if (!knopf) {
      throw new Error("Umschalter fehlt");
    }
    await act(async () => {
      knopf.click();
      await flush();
    });
    expect(container.querySelector('[data-testid="lesevariante-titel"]')).toBeNull();
    expect(text()).not.toContain("Kundenprofil: Harbor Field Services");
    expect(text()).toContain("Original (Englisch)");
    expect(umschalter()?.textContent).toContain("Übersetzung anzeigen");
    // Zurück — nichts ist verloren.
    const zurueck = umschalter();
    if (!zurueck) {
      throw new Error("Umschalter fehlt");
    }
    await act(async () => {
      zurueck.click();
      await flush();
    });
    expect(container.querySelector('[data-testid="lesevariante-titel"]')?.textContent).toBe(
      "Kundenprofil: Harbor Field Services",
    );
  });

  it("c4 · der Fließtext der Variante wird gezielt geholt — und nur, wenn es eine gibt", async () => {
    await mount();
    expect(box.vollRufe).toEqual(["ko-1/de"]);
  });
});

describe("JOB 3326 · f · Sprachwechsel am gemounteten Baum", () => {
  it("f1 · DE → EN wechselt die Anzeige ohne Neuladen, die Auswahl bleibt derselbe Eintrag", async () => {
    await mount();
    expect(text()).toContain("Kundenprofil: Harbor Field Services");
    await act(async () => {
      await i18n.changeLanguage("en");
      await flush();
    });
    expect(hinweis()).toBeNull();
    expect(text()).not.toContain("Kundenprofil: Harbor Field Services");
    expect(text()).toContain(ORIGINAL_TITEL);
    // Der Eintrag ist derselbe — die Fläche wurde nicht neu montiert und nichts wurde verworfen.
    expect(container.querySelector('[data-testid="page-wissen"]')).not.toBeNull();
    // Der Sprachwechsel fragt den Server FÜR DIE NEUE SPRACHE — er blättert nicht in einer alten
    // Antwort (JOB 3326 R3: die Leseansicht kennt keinen Vorrat).
    expect(box.vollRufe).toEqual(["ko-1/de", "ko-1/en"]);
  });

  it("f2 · EN → DE zeigt die Übersetzung wieder, ohne Neuladen", async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    await mount();
    expect(hinweis()).toBeNull();
    await act(async () => {
      await i18n.changeLanguage("de");
      await flush();
    });
    expect(hinweis()).not.toBeNull();
    expect(container.querySelector('[data-testid="lesevariante-titel"]')?.textContent).toBe(
      "Kundenprofil: Harbor Field Services",
    );
  });
});

// ================================================================================================
// JOB 3326 · RUNDE 2 — DIE ZWEI VORBEHALTE STEHEN AUF DER FLÄCHE (Codex e4b79ac9).
// ================================================================================================
describe("JOB 3326 · die Vorbehalte werden gesagt, nicht verschwiegen", () => {
  it('v1 · fehlt der Quellbeleg, steht "Zuordnung unbestätigt" da', async () => {
    box.quellabgleich = "unbestaetigt";
    await mount();
    const zeile = container.querySelector('[data-testid="lesevariante-unbestaetigt"]');
    expect(zeile).not.toBeNull();
    expect(text()).toContain("Zuordnung unbestätigt");
    // Und die Übersetzung bleibt trotzdem LESBAR — der fehlende Beleg leert nichts.
    expect(container.querySelector('[data-testid="lesevariante-titel"]')?.textContent).toBe(
      "Kundenprofil: Harbor Field Services",
    );
  });

  it("v2 · ist der Quellbeleg da, steht die Zeile NICHT da (kein Dauerhinweis)", async () => {
    box.quellabgleich = "bestaetigt";
    await mount();
    expect(container.querySelector('[data-testid="lesevariante-unbestaetigt"]')).toBeNull();
    expect(text()).not.toContain("Zuordnung unbestätigt");
  });

  it("v3 · ein geändertes Original wird als Vorbehalt gezeigt, die Übersetzung bleibt stehen", async () => {
    box.originalGeaendert = true;
    await mount();
    expect(container.querySelector('[data-testid="lesevariante-veraltet"]')).not.toBeNull();
    expect(text()).toContain("Das Original wurde seit dieser Übersetzung geändert");
    expect(container.querySelector('[data-testid="lesevariante-titel"]')?.textContent).toBe(
      "Kundenprofil: Harbor Field Services",
    );
  });

  it("v4 · ohne Änderung steht der Vorbehalt NICHT da", async () => {
    await mount();
    expect(container.querySelector('[data-testid="lesevariante-veraltet"]')).toBeNull();
  });
});

describe("JOB 3326 · der Fehlzustand ist benennbar", () => {
  it("x1 · scheitert der Einzelabruf, steht das Original DA und der Fehlschlag wird gesagt", async () => {
    box.einzelabruf = "netz";
    await mount();
    expect(hinweis()).toBeNull();
    expect(container.querySelector('[data-testid="lesevariante-fehler"]')).not.toBeNull();
    // Das Original ist nicht geleert — es steht vollständig da (Lehre 7, Zustandsmodell).
    expect(text()).toContain(ORIGINAL_TITEL);
  });

  it('x2 · „es gibt keine Übersetzung" ist KEIN Fehler — kein Hinweis, keine Fehlerzeile', async () => {
    box.einzelabruf = "keine";
    await mount();
    expect(hinweis()).toBeNull();
    expect(container.querySelector('[data-testid="lesevariante-fehler"]')).toBeNull();
    expect(text()).toContain(ORIGINAL_TITEL);
  });

  it("x3 · eine 200er-Antwort OHNE die Felder einer Variante wird nicht zur Karte", async () => {
    // Gefunden an einem fremden Bestandstest (`KnowledgeDetail.owner-chain`), der den Transport
    // fälscht: die Fläche baute daraus eine Karte „Übersetzung · Original: UNDEFINED" und riss die
    // ganze Seite mit. Eine unvollständige Auskunft ist keine Übersetzung.
    box.einzelabruf = "unvollstaendig";
    await mount();
    expect(container.querySelector('[data-testid="lesevariante-leseansicht"]')).toBeNull();
    expect(hinweis()).toBeNull();
    // Die Seite steht — sie ist nicht an der Fremdantwort zerbrochen.
    expect(container.querySelector('[data-testid="page-wissen"]')).not.toBeNull();
    expect(text()).toContain(ORIGINAL_TITEL);
  });
});

// ================================================================================================
// JOB 3326 R3 — DIE ANZEIGE IST NIE ÄLTER ALS DER BLICK, DER SIE ERZEUGT HAT.
// ================================================================================================
//
// Die drei Fälle dieser Runde. KEINER von ihnen setzt zwischen den beiden Besuchen den Vorrat
// zurück und keiner wechselt die Sprache — genau das war BENs Auflage, und genau daran ist
// Runde 2 gescheitert.
describe("JOB 3326 R3 · die Warnung erreicht den Leser auch beim ZWEITEN Öffnen", () => {
  it("W1 · Detail besuchen → Original ändern → erneut besuchen (WARMER Vorrat, keine Sprachänderung) ⇒ Warnung sichtbar", async () => {
    // Der Vorrat wird über den echten Verbraucher gefüllt — hier ist „warm" keine Behauptung.
    await waermeUebersichtsvorrat();
    // Erster Besuch: alles in Ordnung, keine Warnung.
    await mount();
    expect(container.querySelector('[data-testid="lesevariante-veraltet"]')).toBeNull();
    expect(box.vollRufe).toEqual(["ko-1/de"]);
    act(() => root.unmount());
    container.remove();

    // Zwischen den Besuchen ändert jemand das Original — der Server meldet es ab jetzt.
    box.originalGeaendert = true;

    // Zweiter Besuch. AUSDRÜCKLICH OHNE `lesevariantenVerwerfen()` und ohne Sprachwechsel.
    await mount();
    expect(
      container.querySelector('[data-testid="lesevariante-veraltet"]'),
      "die Änderungswarnung fehlt beim zweiten Öffnen",
    ).not.toBeNull();
    expect(text()).toContain("Das Original wurde seit dieser Übersetzung geändert");
    // Und die Übersetzung steht weiter lesbar da — die Warnung leert nichts.
    expect(container.querySelector('[data-testid="lesevariante-titel"]')?.textContent).toBe(
      "Kundenprofil: Harbor Field Services",
    );
  });

  it("W2 · dasselbe für den Quellabgleich: der Vorbehalt kommt beim zweiten Öffnen mit", async () => {
    await waermeUebersichtsvorrat();
    await mount();
    expect(container.querySelector('[data-testid="lesevariante-unbestaetigt"]')).toBeNull();
    act(() => root.unmount());
    container.remove();
    box.quellabgleich = "unbestaetigt";
    await mount();
    expect(container.querySelector('[data-testid="lesevariante-unbestaetigt"]')).not.toBeNull();
  });

  it("W3 · warmer Vorrat + Objekt inzwischen weg ⇒ KEINE alte Übersetzung mehr, sondern die ehrliche Auskunft", async () => {
    // Der Vorrat trägt jetzt WIRKLICH die deutsche Fassung von ko-1 (echter Abruf, echter
    // Verbraucher) — genau der Bestand, aus dem die Kurzkarte früher weiterzeigte.
    await waermeUebersichtsvorrat();

    // Erster Besuch: die Leseansicht steht.
    await mount();
    expect(container.querySelector('[data-testid="lesevariante-titel"]')?.textContent).toBe(
      "Kundenprofil: Harbor Field Services",
    );
    act(() => root.unmount());
    container.remove();

    // Das Objekt ist gelöscht bzw. nicht mehr sichtbar: der Einzelabruf antwortet 404 NOT_FOUND
    // (403 fällt im selben Catch an — der Client unterscheidet nur „NO_LESEVARIANTE" davon).
    box.einzelabruf = "weg";

    // Zweiter Besuch. Der Vorrat bleibt warm: KEIN `lesevariantenVerwerfen()`, kein Sprachwechsel.
    await mount();
    expect(box.uebersichtRufe, "der Vorrat wurde zwischendurch geleert").toContain("de");
    expect(
      container.querySelector('[data-testid="lesevariante-leseansicht"]'),
      "die Kurzkarte zeigt eine alte Übersetzung, obwohl der Zugriff abgelehnt wird",
    ).toBeNull();
    expect(container.querySelector('[data-testid="lesevariante-titel"]')).toBeNull();
    expect(text()).not.toContain("Kundenprofil: Harbor Field Services");
    // Ehrlich benannt statt still verschwiegen.
    expect(container.querySelector('[data-testid="lesevariante-fehler"]')).not.toBeNull();
  });

  it("W4 · die Anzeige stammt AUSSCHLIESSLICH aus dem frischen Einzelabruf — je Besuch genau einer", async () => {
    await mount();
    expect(box.vollRufe).toEqual(["ko-1/de"]);
    act(() => root.unmount());
    container.remove();
    await mount();
    // Zweiter Besuch → zweiter Abruf. Kein Besuch lebt von der Antwort des vorherigen.
    expect(box.vollRufe).toEqual(["ko-1/de", "ko-1/de"]);
  });
});
