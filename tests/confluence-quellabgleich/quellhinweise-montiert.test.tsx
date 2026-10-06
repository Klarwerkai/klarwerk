// @vitest-environment jsdom
// ================================================================================================
// R-0131 · R-0162 · R-0163 · R-0549 — WAS DIE LESEFLÄCHE ÜBER EINE IMPORTIERTE QUELLE SAGT.
// ================================================================================================
//
// Gemessen an der ECHTEN Lesefläche über die ECHTE Route `/wissen/:id` (KnowledgeDetail →
// MehrAbschnitte), Bauform unverändert aus
// `tests/sharepoint-inhalt-gesamtweg/quellstand-ohne-stand-montiert.test.tsx`. Attrappe ist allein
// das Netz. Die Sollwerte kommen aus `i18n.ts` (getFixedT), nicht aus dieser Datei.
//
//   H1  In der Quelle gelöscht: Hinweis in de/en/nl, und die Adresse ist KEIN Link mehr (R-0131).
//   H2  Eine lebende Quelle bleibt verlinkt, und zwar genau auf die Confluence-Seite.
//   H3  Anhang der Quellseite: Beschriftung, Typ, Größe; die Abruf-URL ist verlinkt.
//   H4  Quellrestriktion: Gruppennamen und die ANZAHL benannter Personen, nie ihre Kennungen.
import { describe, expect, it, vi } from "vitest";

const QUELLEN = "quellen";
const SEITE = "https://acme.atlassian.net/wiki/spaces/K/pages/P-1";
const ANHANG = "https://acme.atlassian.net/wiki/download/attachments/P-1/pumpe.png";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = async () => [];
  return {
    endpoints: {
      ko: {
        get: async () => globalThis.__r0162Ko,
        list: async () => [globalThis.__r0162Ko],
        evidence: leer,
        versions: leer,
        neighbors: async () => ({ center: "ko-1", neighbors: [], excludedTags: [], limit: 8 }),
        act: async () => globalThis.__r0162Ko,
      },
      library: { search: async () => [globalThis.__r0162Ko] },
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
import type { KnowledgeObject, KoSource } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

declare global {
  // Der Bestand reist über den globalen Namensraum: `vi.mock` wird hochgezogen und darf nichts aus
  // dem Modulrumpf schliessen (dieselbe Bauform wie JOB 3430).
  // eslint-disable-next-line no-var
  var __r0162Ko: KnowledgeObject;
}

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

/** Die drei Sprachen, die das Haus pflegt — und in denen die Beschriftung stehen muss. */
const SPRACHEN = ["de", "en", "nl"] as const;

function quelle(overrides: Partial<KoSource> = {}): KoSource {
  return {
    id: "q-1",
    label: "Wartungsplan",
    url: SEITE,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    provider: "Confluence",
    author: "u1",
    at: "2026-09-12T09:20:00.000Z",
    ...overrides,
  } as KoSource;
}

function ko(sources: KoSource[]): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Wartungsplan",
    statement: "Die Abfüllanlage wird nach jeder Schicht gewartet.",
    bodyHtml: "<p>Zeile eins aus der Datei.</p>",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Produktion",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "offen",
    version: 1,
    author: "u1",
    originalAuthor: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    confidentiality: "intern",
    history: [],
    createdAt: "2026-09-12T09:20:00.000Z",
    comments: [],
    sources,
    attachments: [],
  } as KnowledgeObject;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Die Fläche aufbauen, „Mehr" öffnen, den Quellenabschnitt aufklappen — der Weg eines Menschen. */
async function flaeche(sources: KoSource[], sprache = "de"): Promise<void> {
  await i18n.changeLanguage(sprache);
  globalThis.__r0162Ko = ko(sources);
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
      },
    },
  });
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
  const mehr = container.querySelector<HTMLElement>('[data-testid="bib-mehr"]');
  if (!mehr) {
    throw new Error("R-0162: die Lesefläche bietet kein „Mehr“ an — der Aufbau steht nicht.");
  }
  await act(async () => {
    mehr.click();
    await flush();
  });
  const abschnitt = container.querySelector<HTMLDetailsElement>(
    `[data-bib-abschnitt="${QUELLEN}"]`,
  );
  if (!abschnitt) {
    throw new Error("R-0162: der Abschnitt „Quellen und Belege“ fehlt auf der Lesefläche.");
  }
  await act(async () => {
    abschnitt.open = true;
    // jsdom stellt `toggle` in die Warteschlange, statt es sofort zu liefern; es steigt nicht auf.
    abschnitt.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

function abschnitt(): Element | null {
  return container.querySelector(`[data-bib-abschnitt="${QUELLEN}"]`);
}
const text = (e: Element | null | undefined): string =>
  (e?.textContent ?? "").replace(/\s+/g, " ").trim();
const links = (): string[] =>
  [...(abschnitt()?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])].map((a) => a.href);

describe("R-0162/R-0131 · eine in der Quelle gelöschte Seite", () => {
  for (const sprache of SPRACHEN) {
    it(`H1 [${sprache}]: Hinweis aus dem Katalog, die Adresse bleibt lesbar, aber ohne Link`, async () => {
      await flaeche([quelle({ sourceRemovedAt: "2026-09-20T08:00:00.000Z" })], sprache);
      try {
        const hinweis = abschnitt()?.querySelector('[data-testid="bib-quelle-geloescht"]');
        const soll = i18n.getFixedT(sprache)("ko.source.removedInOrigin", { zeit: "§" });
        const [vorn = ""] = soll.split("§");
        expect(text(hinweis).startsWith(vorn.trim())).toBe(true);
        expect(
          text(abschnitt()?.querySelector('[data-testid="bib-quelle-adresse-ohne-link"]')),
        ).toBe(SEITE);
        expect(links()).not.toContain(SEITE);
      } finally {
        abbauen();
      }
    });
  }

  it("H2: eine lebende Quelle bleibt verlinkt — genau auf die Confluence-Seite", async () => {
    await flaeche([quelle()]);
    try {
      expect(abschnitt()?.querySelector('[data-testid="bib-quelle-geloescht"]')).toBeNull();
      expect(links()).toContain(SEITE);
    } finally {
      abbauen();
    }
  });
});

describe("R-0163/R-0549 · Anhänge und Quellrestriktion", () => {
  for (const sprache of SPRACHEN) {
    it(`H3/H4 [${sprache}]: Anhangszeile und Leserecht aus dem Katalog`, async () => {
      await flaeche(
        [
          quelle({
            readRestriction: { groups: ["confluence-hr"], users: ["acc-1", "acc-2"] },
          }),
          quelle({
            id: "q-2",
            label: "pumpe.png",
            url: ANHANG,
            attachmentOf: "P-1",
            attachment: { externalId: "att1", mime: "image/png", size: 2048 },
          }),
        ],
        sprache,
      );
      try {
        const t = i18n.getFixedT(sprache);
        const anhang = text(abschnitt()?.querySelector('[data-testid="bib-quelle-anhang"]'));
        expect(anhang.startsWith(t("ko.source.attachment"))).toBe(true);
        expect(anhang).toContain("image/png");
        expect(anhang).toContain("KB");
        expect(links()).toContain(ANHANG);
        expect(text(abschnitt()?.querySelector('[data-testid="bib-quelle-leserecht"]'))).toBe(
          t("ko.source.readGroups", { gruppen: "confluence-hr" }),
        );
        expect(
          text(abschnitt()?.querySelector('[data-testid="bib-quelle-leserecht-personen"]')),
        ).toBe(t("ko.source.readPersons", { anzahl: 2 }));
        expect(text(abschnitt())).not.toContain("acc-1");
      } finally {
        abbauen();
      }
    });
  }
});
