// @vitest-environment jsdom
// ================================================================================================
// R-0953 / R-1015 (Nacharbeit 7) — JEDE SPEICHERAKTION MELDET SICH, AN EINER STELLE.
// ================================================================================================
//
// Gemessen wird der `MutationCache` der Anwendung (`lib/einblendungen.ts`) an einem echten
// QueryClient, einem echten `ToastProvider` und der echten Anzeige (`ToastViewport`):
//   Z1  Fehler einer Aktion, die bisher nur am Formular meldete ⇒ Einblendung mit der Servermeldung
//   Z2  Erfolg einer Aktion ohne eigene Meldung ⇒ die einheitliche Erfolgs-Einblendung
//   Z3  meldet die Fläche selbst (eigener Satz), tritt der zentrale Weg zurück — genau EINE
//   Z4  dasselbe für die Rückrufe aus `mutate(…, { onError })`
//   Z5  ohne Provider verhallt die Meldung, statt abzustürzen
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { ApiError } from "../../apps/web/src/api/client";
import { ToastProvider, einblenden, useToast } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { einblendungsMutationCache } from "../../apps/web/src/lib/einblendungen";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

type Art = "nurFormular" | "erfolgStumm" | "eigeneMeldung" | "eigeneMeldungAmAufruf";

let ausgang: () => Promise<unknown> = async () => ({});

/** Eine Fläche mit genau einer Aktion — so, wie die vier Bauarten im Bestand vorkommen. */
function Flaeche({ art }: { art: Art }): ReturnType<typeof createElement> {
  const { push } = useToast();
  const aktion = useMutation({
    mutationFn: () => ausgang(),
    ...(art === "eigeneMeldung"
      ? {
          onSuccess: () => push("success", "EIGENER ERFOLGSSATZ"),
          onError: () => push("error", "EIGENER FEHLERSATZ"),
        }
      : {}),
  });
  const ausloesen = (): void => {
    if (art === "eigeneMeldungAmAufruf") {
      aktion.mutate(undefined, { onError: () => push("error", "FEHLERSATZ AM AUFRUF") });
      return;
    }
    aktion.mutate();
  };
  return createElement(
    "div",
    null,
    createElement("button", { type: "button", "data-testid": "ausloesen", onClick: ausloesen }),
    art === "nurFormular" && aktion.isError
      ? createElement("p", { "data-testid": "formularmeldung" }, "MELDUNG AM FORMULAR")
      : null,
  );
}

async function mount(art: Art, mitBus = true): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = new QueryClient({
    mutationCache: einblendungsMutationCache(),
    defaultOptions: { mutations: { retry: false } },
  });
  const inhalt = mitBus
    ? createElement(
        ToastProvider,
        null,
        createElement(Flaeche, { art }),
        createElement(ToastViewport),
      )
    : createElement("span", null, "ohne Bus");
  await act(async () => {
    neu.render(createElement(QueryClientProvider, { client: qc }, inhalt));
  });
}

async function ausloesen(): Promise<void> {
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="ausloesen"]')?.click();
    await flush();
  });
  await act(flush);
}

const einblendungen = (): string[] =>
  Array.from(container.querySelectorAll("output"), (o) => (o.textContent ?? "").trim());

beforeEach(async () => {
  await i18n.changeLanguage("de");
  ausgang = async () => ({});
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
});

describe("R-0953 · der zentrale Weg meldet jede Speicheraktion", () => {
  it("Z1 · Fehler einer Aktion mit Meldung nur am Formular ⇒ zusätzlich die Einblendung mit der Servermeldung", async () => {
    ausgang = async () => {
      throw new ApiError(409, "konflikt", "Der Eintrag wurde inzwischen geändert.");
    };
    await mount("nurFormular");
    await ausloesen();
    expect(container.querySelector('[data-testid="formularmeldung"]')).not.toBeNull();
    expect(einblendungen()).toEqual(["Der Eintrag wurde inzwischen geändert."]);
  });

  it("Z1b · Fehler ohne Servermeldung ⇒ der allgemeine, übersetzte Fehlersatz", async () => {
    ausgang = async () => {
      throw new Error("Netz weg");
    };
    await mount("nurFormular");
    await ausloesen();
    expect(einblendungen()).toEqual([i18n.t("state.error")]);
  });

  it("Z2 · Erfolg ohne eigene Meldung ⇒ die einheitliche Erfolgs-Einblendung", async () => {
    await mount("erfolgStumm");
    await ausloesen();
    expect(einblendungen()).toEqual([i18n.t("einblendung.erledigt")]);
    expect(i18n.t("einblendung.erledigt")).not.toBe("einblendung.erledigt");
  });

  it("Z3 · meldet die Fläche selbst, gibt es GENAU EINE Einblendung — ihre eigene", async () => {
    await mount("eigeneMeldung");
    await ausloesen();
    expect(einblendungen()).toEqual(["EIGENER ERFOLGSSATZ"]);

    ausgang = async () => {
      throw new Error("weg");
    };
    await ausloesen();
    expect(einblendungen()).toEqual(["EIGENER ERFOLGSSATZ", "EIGENER FEHLERSATZ"]);
  });

  it("Z4 · auch eine Meldung aus `mutate(…, { onError })` hat Vorrang — keine Doppelmeldung", async () => {
    ausgang = async () => {
      throw new Error("weg");
    };
    await mount("eigeneMeldungAmAufruf");
    await ausloesen();
    expect(einblendungen()).toEqual(["FEHLERSATZ AM AUFRUF"]);
  });

  it("Z5 · ohne Provider verhallt eine Einblendung, statt abzustürzen", async () => {
    await mount("erfolgStumm", false);
    expect(() => einblenden("success", "ohne Empfänger")).not.toThrow();
  });
});
