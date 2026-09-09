// @vitest-environment jsdom
// ================================================================================================
// JOB 3353 · A — DIE VORDERTÜR SCHICKT DIE ENTWURFSKENNUNG MIT (Codex-Messung 21:57 / 22:17).
// ================================================================================================
//
// DER LIVEBEFUND, gemessen und nicht vermutet: Pedi öffnet ein Erfassen-Blatt, tippt englischen
// Text und wählt „KI → Rechtschreibung". Antwort: HTTP 500 nach 86 ms, „The AI returned no answer.
// Reason: The text is classified as confidential — the cloud AI must not process it." KEIN
// Modellaufruf. Und der Fehler blieb, als Codex den Entwurf VORHER speicherte und ihn als
// „Öffentlich-intern" einstufte (?draft=618ba277…).
//
// DIE KETTE, Ende zu Ende:
//   1. `Blatt.tsx` rief `draftProvenance(confidentiality)` OHNE dritten Parameter — der Payload
//      trug `source:"draft"`, aber weder `draftId` noch `koId`.
//   2. Der Server (`reasoner-routes.ts`, `resolveProvenance`, JOB 2692 D2) behandelt „draft" ohne
//      AUFLÖSBAREN Anker fail-closed als vertraulich — bewusst, denn ein Backstop, den man durch
//      Weglassen eines Feldes umgeht, ist keiner.
//   3. Also fiel die Cloud aus der Providerkette, und seit JOB 3276 gibt es dafür keinen
//      kosmetischen Ersatzvorschlag mehr, sondern einen ehrlichen Fehler.
// Die Einstufung des Menschen war nie schuld; die Fläche hat ihren eigenen Anker verschwiegen.
//
// WAS DIESER TEST MISST — am ECHTEN Klickpfad, nicht am Quelltext:
//   K1  Gespeicherter Entwurf, über `?draft=…` geöffnet → „KI → Rechtschreibung": der Aufruf trägt
//       die `draftId`. Dasselbe für „KI → Struktur" (derselbe Fehler, zweite Stelle).
//   K2  GEGENPROBE, die Schutzregel bleibt: ein NIE gespeichertes Blatt schickt KEINE Kennung —
//       der Server entscheidet dort weiter fail-closed. JOB 2692 D2 wird nicht gelockert.
//
// Die Draft-Endpunkte laufen gegen den ECHTEN `CaptureService` mit `InMemoryDraftRepo` (wie in
// `tests/capture/draft-clear-cycle-mounted.test.tsx`): die Kennung, die der Client mitschickt,
// stammt damit aus einem wirklich gespeicherten Entwurf und nicht aus einem Handwert.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  reset: (): void => {},
  /** Was der Client WIRKLICH an die Reasoner-Endpunkte gegeben hat, je Aufruf. */
  assist: [] as Record<string, unknown>[],
  structure: [] as Record<string, unknown>[],
  /**
   * JOB 3353 B: was der Endpunkt statt eines Vorschlags WIRFT — gesetzt von den Fällen K3/K4. Der
   * Fehler wird im Test gebaut (mit dem echten `ApiError`), nicht hier: diese Fabrik läuft
   * gehoistet, vor jedem Import.
   */
  assistFehler: null as null | (() => unknown),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { InMemoryDraftRepo } = await import("../../services/capture/src/repo");
  const { CaptureService } = await import("../../services/capture/src/service");
  type P = Record<string, unknown>;
  let svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  box.reset = () => {
    svc = new CaptureService({ repo: new InMemoryDraftRepo() });
    box.assist.length = 0;
    box.structure.length = 0;
    box.assistFehler = null;
  };
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ stage: "search_on_click" }), search: ok([]) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: {
        list: vi.fn(async () => svc.listDrafts()),
        // Dieselbe Gestalt, die die echte Route liefert (capture-routes.ts:1043 —
        // `resumeDraft(...).draft`), nicht der rohe Datensatz: sonst misst der Test eine Form,
        // die es im Produkt nicht gibt.
        get: vi.fn(async (id: string) => (await svc.resumeDraft(id))?.draft),
        create: vi.fn(async (p: P) => svc.createDraft(p, "u1")),
        update: vi.fn(async (id: string, p: P) => svc.continueDraft(id, p, "u1")),
        remove: vi.fn(async (id: string) => svc.deleteDraft(id)),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        // Ein VOLLSTÄNDIGER Vorschlag, wie ihn die echte Route liefert (`StructureResult`) — ein
        // `{}` als Attrappe reicht nicht: die Seite liest `statement`/`title` und stürzte darüber.
        structure: vi.fn(async (_text: string, _locale: string, provenance: P) => {
          box.structure.push(provenance);
          return {
            title: "Routerübergabe",
            statement: "Der Router wurde übergeben.",
            conditions: [],
            measures: [],
            tags: [],
            confidence: 0.8,
            demo: false,
          };
        }),
        assist: vi.fn(
          async (_text: string, _locale: string, _instruction: string, provenance: P) => {
            box.assist.push(provenance);
            if (box.assistFehler) {
              throw box.assistFehler();
            }
            return { text: "korrigierter Text" };
          },
        ),
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
import { ApiError } from "../../apps/web/src/api/client";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
// Das Blatt ist die Fläche, die Codex live bedient hat — sie hängt an `/erfassen/neu`
// (`routes.tsx:209`), NICHT an `/erfassen` (dort steht der Arbeitsraum/das Expertenformular).
import { KnowledgeIntake } from "../../apps/web/src/pages/KnowledgeIntake";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(pfad = "/erfassen/neu"): Promise<void> {
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [pfad] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/erfassen/neu",
                      element: createElement(KnowledgeIntake),
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

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

/**
 * Schreiben ins Blatt. Die Schreibfläche ist ein UNKONTROLLIERTES `contentEditable`
 * (`RichTextEditor.tsx:3078`); der Zustand des Blattes entsteht aus dessen `onInput`. Genau diesen
 * Weg nimmt dieser Helfer — kein Setzen von React-Zustand an der Fläche vorbei.
 */
async function schreiben(text: string): Promise<void> {
  const feld = [...container.querySelectorAll<HTMLElement>("[contenteditable]")].find(
    (e) => e.getAttribute("contenteditable") === "true",
  );
  if (!feld) {
    throw new Error("Schreibfläche des Blattes nicht gefunden");
  }
  feld.innerHTML = `<p>${text}</p>`;
  await act(async () => {
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/** Der Text, den Codex live getippt hat — englisch, mit dem Tippfehler, den „Rechtschreibung" trifft. */
const TEXT = "the customer recieved the router and the instalation was completed at the adress.";

/** Öffnet das KI-Werkzeug über seine Prüfkennung (der sichtbare Wortlaut „KI" träfe zu viel). */
async function ki(eintrag: string): Promise<void> {
  const werkzeug = container.querySelector<HTMLButtonElement>('[data-testid="blatt-werkzeug-ki"]');
  if (!werkzeug) {
    throw new Error("KI-Werkzeug nicht gefunden");
  }
  await click(werkzeug);
  const flaeche = container.querySelector<HTMLElement>('[data-testid="blatt-menue-ki"]');
  if (!flaeche) {
    throw new Error("KI-Menü öffnet nicht");
  }
  const treffer = [...flaeche.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(eintrag),
  );
  if (!(treffer instanceof HTMLButtonElement)) {
    throw new Error(`KI-Eintrag „${eintrag}“ nicht gefunden`);
  }
  if (treffer.disabled) {
    throw new Error(`KI-Eintrag „${eintrag}“ ist gesperrt — die Fläche hätte gar nicht gerufen`);
  }
  await click(treffer);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.reset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 3353 A · die KI-Wege der Vordertür tragen die Kennung des gesicherten Entwurfs", () => {
  it("K1 · gesicherter, geöffneter Entwurf: assist UND structure schicken die draftId", async () => {
    // Der Entwurf entsteht über den ECHTEN `CaptureService` — die Kennung ist keine Handangabe.
    // Genau dieser Weg war Codex' zweite Messung: gespeicherter Entwurf, Stufe „intern", geöffnet
    // über `?draft=…` — und der assist-Aufruf ging TROTZDEM ohne Anker hinaus.
    const { endpoints } = await import("../../apps/web/src/api/endpoints");
    const angelegt = (await endpoints.drafts.create({
      title: "Routerübergabe",
      bodyHtml: `<p>${TEXT}</p>`,
      confidentiality: "intern",
    } as never)) as { id: string };
    const kennung = angelegt.id;
    expect(typeof kennung).toBe("string");

    await mount(`/erfassen/neu?draft=${kennung}`);
    await ki(i18n.t("capture.ai.action.spelling"));
    expect(box.assist).toHaveLength(1);
    expect(box.assist[0]?.source).toBe("draft");
    // DAS IST DIE ZEILE, die im Livebetrieb gefehlt hat.
    expect(box.assist[0]?.draftId).toBe(kennung);

    await ki(i18n.t("erfassen.ki.struktur"));
    expect(box.structure).toHaveLength(1);
    expect(box.structure[0]?.source).toBe("draft");
    expect(box.structure[0]?.draftId).toBe(kennung);
  });

  it("K2 · GEGENPROBE: ein nie gesichertes Blatt schickt KEINE Kennung — die Schutzregel bleibt", async () => {
    // JOB 2692 D2 wird durch diesen Auftrag NICHT gelockert: ohne gespeicherten Entwurf gibt es
    // keinen auflösbaren Anker, der Server bleibt fail-closed, und die Fläche behauptet keinen.
    await mount();
    await schreiben(TEXT);
    await ki(i18n.t("capture.ai.action.spelling"));
    expect(box.assist).toHaveLength(1);
    expect(box.assist[0]?.source).toBe("draft");
    expect(box.assist[0]?.draftId).toBeUndefined();
  });
});

// ================================================================================================
// JOB 3353 · B — DIE KARTE SAGT DEN GRUND, DEN DER SERVER GENANNT HAT.
// ================================================================================================
//
// Das ist die Fläche aus Codex' Messung: „KI → Rechtschreibung" scheiterte, und im Blatt stand die
// generische Karte (`fd.errAssist`, „Die KI-Hilfe ist gerade nicht möglich") — obwohl der Server
// den Grund und den Ausweg kannte. Die Route liefert ihn jetzt typisiert (409,
// `CONFIDENTIAL_CLOUD_BLOCKED`, Satz in der Sprache des Requests, Belege in
// `services/app/src/routes/reasoner-routes.test.ts`). Hier wird gemessen, dass die Fläche ihn
// AUSSPRICHT — und dass sie sonst nichts umdeutet.
// Der Satz, den der Server für `unsaved_draft` heute schickt (reasoner-routes.ts
// `cloudGesperrtMeldung`). Er steht hier als KOPIE, weil dieser Test die Fläche misst und nicht die
// Route: geprüft wird, dass die Karte den Satz des Servers AUSSPRICHT, welcher immer es ist. Dass
// der Wortlaut selbst stimmt, misst `reasoner-routes.test.ts` an der echten Route (B1/B10).
const SPERRSATZ =
  "Nicht gesicherter Entwurf: ohne gesicherten Stand gilt der Text als vertraulich eingestuft — die Cloud-KI darf ihn nicht bearbeiten. Entwurf sichern (die Einstufung wird dann geprüft) oder lokale KI wählen.";

describe("JOB 3353 B · die KI-Karte zeigt die Sperrmeldung des Servers", () => {
  it("K3 · 409 mit `CONFIDENTIAL_CLOUD_BLOCKED` → der Satz des Servers steht in der Karte, nicht `fd.errAssist`", async () => {
    box.assistFehler = () => new ApiError(409, "CONFIDENTIAL_CLOUD_BLOCKED", SPERRSATZ);
    await mount();
    await schreiben(TEXT);
    await ki(i18n.t("capture.ai.action.spelling"));

    const karte = container.querySelector<HTMLElement>('[data-testid="blatt-ki-fehler"]');
    expect(karte, "die KI-Fehlerkarte fehlt").not.toBeNull();
    const text = (karte?.textContent ?? "").replace(/\s+/g, " ");
    expect(text).toContain("Nicht gesicherter Entwurf");
    // Der generische Satz ist genau der, den Pedi gesehen hat — er darf hier NICHT mehr stehen.
    expect(text).not.toContain(i18n.t("fd.errAssist"));
    // Die Zusage des Blattes bleibt daneben stehen: am eigenen Text ist nichts passiert.
    expect(text).toContain(i18n.t("fd.originalUnchanged"));
  });

  it("K4 · GEGENPROBE: ein FREMDER Fehler behält den bisherigen Satz — die Fläche deutet nichts um", async () => {
    // Ein Zeitlimit, eine Modellstörung, ein Netzfehler: nichts davon ist die Vertraulichkeitssperre.
    // Sähe die Karte auch hier den Sperrsatz, schickte sie den Menschen zum Umstufen eines Textes,
    // an dem nichts einzustufen war.
    box.assistFehler = () => new ApiError(500, "ERROR", "Interner Fehler");
    await mount();
    await schreiben(TEXT);
    await ki(i18n.t("capture.ai.action.spelling"));

    const text = (
      container.querySelector<HTMLElement>('[data-testid="blatt-ki-fehler"]')?.textContent ?? ""
    ).replace(/\s+/g, " ");
    expect(text).toContain(i18n.t("fd.errAssist"));
    expect(text).not.toContain("Nicht gesicherter Entwurf");
  });
});
