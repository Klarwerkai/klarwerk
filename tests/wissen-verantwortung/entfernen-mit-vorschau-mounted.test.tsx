// @vitest-environment jsdom
// ================================================================================================
// R-0554 · BEN (Nacharbeit 3) — KONTO ENTFERNEN MIT NACHFOLGER: ERST DIE VORSCHAU, DANN DER ZUG.
// ================================================================================================
//
// Gemountet wird die echte Kontokarte `NutzerDetail`; gefälscht ist allein `fetch`, das jeden
// Aufruf mitschreibt. Gemessen: mit gewähltem Nachfolger ist „Ja, entfernen" gesperrt, bis die
// Vorschau GENAU dieses Paars dasteht; ein Wechsel des Nachfolgers verwirft sie; erst danach geht
// `DELETE /api/users/:id?nachfolger=…` hinaus. Ohne Nachfolger bleibt der Weg wie bisher.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { PublicUser } from "../../apps/web/src/api/types";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { NutzerDetail } from "../../apps/web/src/pages/AdminKontenDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const GEHT: PublicUser = {
  id: "u-geht",
  name: "Gerd Geht",
  email: "gerd@verantwortung.test",
  role: "experte",
  approved: true,
  createdAt: "2026-09-01T08:00:00.000Z",
};
const BERT: PublicUser = { ...GEHT, id: "u-bert", name: "Bert Nachfolger", email: "b@x.test" };
const CLARA: PublicUser = { ...GEHT, id: "u-clara", name: "Clara", email: "c@x.test" };

interface Aufruf {
  methode: string;
  pfad: string;
  rumpf: Record<string, unknown> | undefined;
}
let aufrufe: Aufruf[] = [];

function antwort(status: number, koerper: unknown): unknown {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: String(status),
    text: async () => (koerper === undefined ? "" : JSON.stringify(koerper)),
  };
}

async function serverFetch(eingabe: unknown, init?: RequestInit): Promise<unknown> {
  const pfad = String(eingabe);
  const methode = init?.method ?? "GET";
  const rumpf =
    init?.body === undefined
      ? undefined
      : (JSON.parse(String(init.body)) as Record<string, unknown>);
  aufrufe.push({ methode, pfad, rumpf });
  if (methode === "GET" && pfad === "/api/users") {
    return antwort(200, [GEHT, BERT, CLARA]);
  }
  if (methode === "POST" && pfad === "/api/lifecycle/handover/preview") {
    return antwort(200, {
      von: rumpf?.from,
      an: rumpf?.to,
      wissensobjekte: [{ id: "ko-1", title: "Kettenspanner monatlich nachstellen" }],
      eigentum: [],
      // BEN (Nacharbeit 7): die Verantwortung im Papierkorb steht in derselben Vorschau.
      papierkorb: [{ id: "ko-9", title: "Alte Schmieranweisung Linie 2" }],
      entwuerfe: [{ id: "d-1" }],
      luecken: [],
      pruefaufgaben: [],
    });
  }
  if (methode === "DELETE" && pfad.startsWith(`/api/users/${GEHT.id}`)) {
    return antwort(200, { uebergabe: { fehlgeschlagen: [] } });
  }
  if (methode === "GET") {
    return antwort(503, { error: "UPSTREAM", message: `nicht Gegenstand: ${pfad}` });
  }
  throw new Error(`unerwarteter Aufruf: ${methode} ${pfad}`);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function ruhe(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();
const t = (k: string): string => i18n.t(k);

function knopf(beschriftung: string): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (b) => text(b) === beschriftung,
    ) ?? null
  );
}

/** Der Vorschauknopf DES ENTFERNENS — nicht der gleichlautende der Übergabekarte darüber. */
const vorschauKnopf = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>("[data-entfernen-vorschau-holen]");

async function klicken(b: HTMLButtonElement | null): Promise<void> {
  expect(b).not.toBeNull();
  await act(async () => {
    (b as HTMLButtonElement).click();
  });
  await ruhe();
}

async function nachfolgerWaehlen(wert: string): Promise<void> {
  const feld = container.querySelector<HTMLSelectElement>("[data-entfernen-nachfolger]");
  expect(feld, "die Nachfolgerauswahl fehlt").not.toBeNull();
  await act(async () => {
    (feld as HTMLSelectElement).value = wert;
    (feld as HTMLSelectElement).dispatchEvent(new Event("change", { bubbles: true }));
  });
  await ruhe();
}

beforeEach(async () => {
  aufrufe = [];
  vi.stubGlobal("fetch", vi.fn(serverFetch));
  await i18n.changeLanguage("de");
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
          ToastProvider,
          null,
          createElement(NutzerDetail, { nutzerId: GEHT.id, onZurueck: () => undefined }),
        ),
      ),
    );
  });
  await ruhe();
  expect(text(container), "die Karte trägt das Konto nicht").toContain(GEHT.email);
  await klicken(knopf(t("adm.remove")));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const deletes = (): Aufruf[] => aufrufe.filter((a) => a.methode === "DELETE");

describe("R-0554 · Konto entfernen mit Nachfolger braucht die Vorschau", () => {
  it("E1 · mit Nachfolger ist „Ja, entfernen“ gesperrt, bis die Vorschau dieses Paars dasteht", async () => {
    await nachfolgerWaehlen(BERT.id);
    expect(knopf(t("adm.removeYes"))?.disabled).toBe(true);
    expect(container.querySelector("[data-entfernen-vorschau]")).toBeNull();

    await klicken(vorschauKnopf());
    expect(aufrufe).toContainEqual({
      methode: "POST",
      pfad: "/api/lifecycle/handover/preview",
      rumpf: { from: GEHT.id, to: BERT.id },
    });
    const vorschau = text(container.querySelector("[data-entfernen-vorschau]"));
    expect(vorschau).toContain("Kettenspanner monatlich nachstellen");
    expect(vorschau).toContain(`${t("verantwortung.uebergabe.art.entwurf")}: 1`);
    expect(vorschau).toContain(`${t("verantwortung.uebergabe.art.papierkorb")}: 1`);
    expect(vorschau).toContain("Alte Schmieranweisung Linie 2");
    expect(deletes()).toEqual([]);

    expect(knopf(t("adm.removeYes"))?.disabled).toBe(false);
    await klicken(knopf(t("adm.removeYes")));
    const erwartet = `/api/users/${GEHT.id}?nachfolger=${BERT.id}`;
    expect(deletes().map((a) => a.pfad)).toEqual([erwartet]);
  });

  it("E2 · ein Wechsel des Nachfolgers verwirft die Vorschau und sperrt erneut", async () => {
    await nachfolgerWaehlen(BERT.id);
    await klicken(vorschauKnopf());
    expect(container.querySelector("[data-entfernen-vorschau]")).not.toBeNull();

    await nachfolgerWaehlen(CLARA.id);
    expect(container.querySelector("[data-entfernen-vorschau]")).toBeNull();
    expect(knopf(t("adm.removeYes"))?.disabled).toBe(true);
    expect(deletes()).toEqual([]);
  });

  it("E3 · ohne Nachfolger bleibt das Entfernen wie bisher — ohne Vorschau, ohne Übergabe", async () => {
    expect(knopf(t("adm.removeYes"))?.disabled).toBe(false);
    await klicken(knopf(t("adm.removeYes")));
    expect(deletes().map((a) => a.pfad)).toEqual([`/api/users/${GEHT.id}`]);
    expect(aufrufe.some((a) => a.pfad.startsWith("/api/lifecycle/"))).toBe(false);
  });
});
