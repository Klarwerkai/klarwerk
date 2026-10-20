import { expect, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import {
  arbeitsstandLesen,
  arbeitsstandSchreiben,
} from "../../apps/web/src/lib/fragenArbeitsstand";
import { rechtekontextZuruecksetzen } from "../../apps/web/src/lib/rechtekontext";
import { Ask } from "../../apps/web/src/pages/Ask";

export const FRAGE = "Wie wird der Filter geprüft?";
export const KONTEXT = { werk: "Werk Nord", schicht: "Frühschicht", rolle: "Technik" };
const wirklichWarten = globalThis.setTimeout;
export async function tick() {
  await act(async () => new Promise<void>((r) => wirklichWarten(r, 0)));
}
export async function bis(pruefen: () => void) {
  let fehler: unknown;
  for (let i = 0; i < 200; i++) {
    await tick();
    try {
      pruefen();
      return;
    } catch (e) {
      fehler = e;
    }
  }
  throw fehler;
}

export function antwort(text: string, receipt: string) {
  return {
    result: {
      answered: true,
      answer: text,
      knowledgeClass: "gesichert",
      trust: 90,
      sources: [],
      citedSources: [],
      steps: [],
      demo: false,
      captionSources: [],
    },
    gap: null,
    receipt,
    answerId: `antwort-${receipt}`,
  };
}

export interface GehaltenerAbruf {
  body: Record<string, unknown>;
  signal: AbortSignal | null | undefined;
  antworten: (text: string, receipt: string) => void;
}

export async function montiere(sprache: "de" | "en" | "nl" = "de", beachteAbort = false) {
  localStorage.clear();
  rechtekontextZuruecksetzen();
  await i18n.changeLanguage(sprache);
  arbeitsstandSchreiben(localStorage, "kiw-a", {
    entwurf: FRAGE,
    antwort: null,
    startadressen: [],
    fragekontext: KONTEXT,
  });
  const abrufe: GehaltenerAbruf[] = [];
  let stempel = "kiw-rechte-a";
  let modell = true;
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json", "x-klarwerk-rechtekontext": stempel },
    });
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url === "/api/ask" && init?.method === "POST") {
        return new Promise((resolve, reject) => {
          const r: GehaltenerAbruf = {
            body: JSON.parse(String(init.body)),
            signal: init.signal,
            // Absichtlich auch nach Abort beantwortbar: die neue Grenze muss späte Daten verwerfen.
            antworten: (text, receipt) => resolve(json(antwort(text, receipt))),
          };
          abrufe.push(r);
          if (beachteAbort)
            r.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Kontrollierter Transportabbruch", "AbortError")),
              { once: true },
            );
        });
      }
      if (url === "/api/reasoner/status")
        return Promise.resolve(
          json({
            active: modell,
            mode: modell ? "cloud" : "deterministic",
            tasks: { answer: modell },
          }),
        );
      if (["/api/kos", "/api/conflicts", "/api/directory"].includes(url))
        return Promise.resolve(json([]));
      throw new Error(`Unerwarteter kontrollierter Abruf: ${init?.method ?? "GET"} ${url}`);
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["auth", "me"], { id: "kiw-a", role: "experte" });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
  });
  const knopf = () => {
    const e = container.querySelector<HTMLButtonElement>('form button[type="submit"]');
    if (!e) throw new Error("Bestehender Sendeknopf fehlt");
    return e;
  };
  await bis(() => expect(knopf().disabled).toBe(false));
  let abgebaut = false;
  return {
    container,
    abrufe,
    client,
    knopf,
    stand: (konto = "kiw-a") => arbeitsstandLesen(localStorage, konto),
    stempel: (s: string) => {
      stempel = s;
    },
    modellAus: () => {
      modell = false;
    },
    async senden(text = FRAGE) {
      const e = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        "form input,form textarea",
      );
      if (!e) throw new Error("Bestehendes Fragefeld fehlt");
      await act(async () => {
        const proto =
          e instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(e, text);
        e.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => {
        e.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });
    },
    async abbrechen() {
      const e = container.querySelector<HTMLButtonElement>('[data-testid="ask-abbrechen"]');
      expect(e, "Neu angeschlossener bewusster Warteabbruch fehlt").not.toBeNull();
      await act(async () => e?.click());
    },
    async abbauen() {
      if (abgebaut) return;
      abgebaut = true;
      act(() => root.unmount());
      for (const r of abrufe) r.antworten("Kontrolliertes spätes Aufräumergebnis.", "cleanup");
      await tick();
      client.clear();
      container.remove();
    },
  };
}
