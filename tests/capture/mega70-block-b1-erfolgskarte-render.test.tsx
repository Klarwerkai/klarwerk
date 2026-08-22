// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega70 BLOCK B · B1 (JOB 1973 · D5) — DIE ERFOLGSKARTE, AM GERENDERTEN ERGEBNIS
// ================================================================================================
//
// B1 ist bens `sammel66`-Kernbefund: die Erfasserin reicht ihren ersten eigenen Tipp ein, das
// System lobt sie, bietet als BETONTEN naechsten Schritt „Zur Pruefung geben" an — und wirft sie
// wortlos auf `/start`. Die Vordertuer verlangt `experte`, `/validierung` verlangt `controller`.
//
// WARUM DIESER FALL DEN UMWEG UEBER EINEN ENTWURF NIMMT: die Erfolgskarte haengt an
// `submittedKo` (`CaptureFrontDoor.tsx:743`), und das wird AUSSCHLIESSLICH im Erfolgszweig der
// Einreich-Mutation gesetzt (`:530`). Der Rumpf kommt sonst aus einem Rich-Text-Editor, den
// jsdom nicht sinnvoll befuellt. Der Tiefenlink `?draft=…` laedt Titel und Rumpf ueber
// `endpoints.drafts.get` — derselbe Weg, den `frontdoor-draft-deeplink-mounted.test.tsx` schon
// faehrt. Danach genuegt EIN Klick auf den Einreichen-Knopf.
//
// GEGEN WEN GEMESSEN WIRD: gegen das Produkt. Gemountet wird die ECHTE Seite `CaptureFrontDoor`
// im ECHTEN Providerbaum. Die Rollenfrage beantwortet `RoleLink` -> `routePathAllows` ->
// `GUARDED_ITEMS`. Gestellt sind nur zwei Datenquellen (`drafts.get`, `drafts.promote`) — sie
// treffen die Rollenentscheidung nicht.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      drafts: {
        ...original.endpoints.drafts,
        get: vi.fn(async () => ({
          id: "d-1",
          payload: {
            title: "Wartung der Presse",
            bodyHtml: "<h2>Wartung der Presse</h2><p>Anlage freischalten und sichern.</p>",
            confidentiality: "intern",
          },
        })),
        // Der Erfolgszweig: liefert das angelegte Objekt, damit `submittedKo` gesetzt wird.
        promote: vi.fn(async () => ({ id: "ko-neu", title: "Wartung der Presse" })),
        create: vi.fn(async () => ({ id: "d-1" })),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement, useEffect } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import type { Role } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function RolleStellen({ rolle }: { rolle: Role }): null {
  const { setRole } = useRole();
  useEffect(() => {
    setRole(rolle);
  }, [rolle, setRole]);
  return null;
}

/** Die echte Vordertuer, mit einem Entwurf im Tiefenlink. */
async function mount(rolle: Role): Promise<void> {
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
                { initialEntries: ["/capture/frontdoor?draft=d-1"] },
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    createElement(RolleStellen, { rolle }),
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/capture/frontdoor",
                        element: createElement(CaptureFrontDoor),
                      }),
                    ),
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

/** Den Einreichen-Knopf am SICHTBAREN Text finden — nicht an einer erfundenen Kennung. */
function einreichen(): HTMLButtonElement {
  const beschriftung = i18n.t("fd.submitReview");
  const knopf = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(beschriftung),
  );
  if (!knopf) {
    throw new Error(`Einreichen-Knopf mit "${beschriftung}" nicht gefunden`);
  }
  return knopf as HTMLButtonElement;
}

function wege(): string[] {
  return Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
}

/** Bis zur Erfolgskarte: Entwurf laden, einreichen, warten. */
async function bisZurErfolgskarte(rolle: Role): Promise<string> {
  await mount(rolle);
  await act(async () => {
    einreichen().click();
    await flush();
  });
  await act(flush);
  const text = container.textContent ?? "";
  expect(text, "die Erfolgskarte ist nicht erschienen — der Fall haette nichts zu lesen").toContain(
    i18n.t("fd.openValidation"),
  );
  return text;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

describe("mega70 Block B · B1: die Erfolgskarte bietet keinen Weg an, den die Rolle nicht darf", () => {
  it("B1-R1 · Rolle `experte`: der Pruefung-geben-Knopf ist eine Lage, kein Weg", async () => {
    const text = await bisZurErfolgskarte("experte");

    expect(
      container.querySelector('[aria-disabled="true"]'),
      "kein Element mit aria-disabled — die Sackgasse steht offen",
    ).not.toBeNull();
    expect(text, "die Kein-Zugriff-Pille fehlt im gerenderten Text").toContain(
      i18n.t("roleLink.noReach"),
    );
    expect(
      wege().filter((h) => h.startsWith("/validierung")),
      "es steht weiterhin ein begehbarer Weg auf /validierung da",
    ).toEqual([]);
  });

  it("B1-R2 · KALIBRIERUNG, Rolle `controller`: derselbe Knopf ist ein echter Weg", async () => {
    const text = await bisZurErfolgskarte("controller");

    expect(
      wege().filter((h) => h.startsWith("/validierung")),
      "als controller fehlt der Weg auf /validierung — dann misst B1-R1 nichts",
    ).not.toEqual([]);
    expect(text, "als controller steht die Kein-Zugriff-Pille da").not.toContain(
      i18n.t("roleLink.noReach"),
    );
  });
});
