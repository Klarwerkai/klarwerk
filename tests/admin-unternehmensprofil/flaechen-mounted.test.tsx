// @vitest-environment jsdom
// ================================================================================================
// ADMIN-15 · DIE FLÄCHEN `/unternehmen` UND `/richtlinien` — gemountet, mit echtem i18n und Router.
// ================================================================================================
//
// Der Server ist hier eine Attrappe von `fetch`; die Serverseite misst `unternehmen-api.test.ts`,
// das Zeichnen in Desktop- und 390-px-Breite die Smoke-Sonde `tests-smoke/unternehmensprofil.spec.ts`.
//
//   K1 · Die Vorschau zeigt Name und Akzent VOR dem Speichern — in breiter und in 390-px-Ansicht;
//        erst „Speichern" schickt die Fassung (mit der gesehenen Version).
//   K2 · Eine SVG-Datei wird schon beim Auswählen erklärt abgewiesen; eine Serverabweisung wird
//        verständlich angezeigt. Gestaltungsoptionen sind Radioknöpfe mit Fokusring-Klassen.
//   K3 · Veröffentlichen geht erst, wenn die Wirkung angezeigt wurde; eine Änderung der verlangten
//        Handlung verlangt eine neue Wirkungsanzeige.
//   K4 · `/richtlinien` öffnen schickt KEINE Handlung; erst der Knopf schickt sie — mit Fassung.
//   K5 · Die Rechtsseiten bleiben eigene Seiten; die Richtlinienseite verweist nur auf sie.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactElement, act, createElement } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Richtlinien } from "../../apps/web/src/pages/Richtlinien";
import { Unternehmen } from "../../apps/web/src/pages/Unternehmen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Aufruf {
  url: string;
  methode: string;
  koerper: unknown;
}

type Antwort = { status: number; koerper: unknown };

const AKZENTE = [
  { id: "neutral", flaeche: "#ffffff", schrift: "#1c1c1e", kontrast: 17.18 },
  { id: "nachtblau", flaeche: "#1f3a5f", schrift: "#ffffff", kontrast: 11.5 },
  { id: "tannengruen", flaeche: "#1e5631", schrift: "#ffffff", kontrast: 8.62 },
  { id: "aubergine", flaeche: "#5b2a5e", schrift: "#ffffff", kontrast: 10.8 },
  { id: "anthrazit", flaeche: "#33393f", schrift: "#ffffff", kontrast: 11.7 },
];

const VERWALTUNG = {
  fassungen: [],
  akzente: AKZENTE,
  grenzen: {
    logo: { bytes: 204800, minKante: 32, maxKante: 4000, maxSeitenverhaeltnis: 8 },
    name: { min: 2, max: 80 },
    minKontrast: 7,
  },
};

const aufrufe: Aufruf[] = [];
let stand: { container: HTMLDivElement; root: Root } | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function server(antworten: (a: Aufruf) => Antwort | undefined): void {
  aufrufe.length = 0;
  vi.stubGlobal("fetch", (async (url: unknown, init?: { method?: string; body?: unknown }) => {
    const aufruf: Aufruf = {
      url: String(url),
      methode: init?.method ?? "GET",
      koerper: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    aufrufe.push(aufruf);
    const a = antworten(aufruf) ?? { status: 404, koerper: { error: "NOT_FOUND" } };
    return {
      ok: a.status < 400,
      status: a.status,
      statusText: "",
      text: async () => JSON.stringify(a.koerper),
    } as unknown as Response;
  }) as unknown as typeof fetch);
}

async function montieren(seite: ReactElement, pfad: string): Promise<HTMLDivElement> {
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  stand = { container, root };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            NavGuardProvider,
            null,
            createElement(MemoryRouter, { initialEntries: [pfad] }, seite),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  return container;
}

afterEach(() => {
  if (stand) {
    const s = stand;
    act(() => s.root.unmount());
    s.container.remove();
    stand = null;
  }
  vi.unstubAllGlobals();
});

function tippe(el: Element | null, wert: string): void {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    throw new Error("kein Eingabefeld");
  }
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, wert);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

async function klick(el: Element | null): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("kein Element");
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

const $ = (c: HTMLElement, testId: string) => c.querySelector(`[data-testid="${testId}"]`);

function verwaltungsServer(put?: (a: Aufruf) => Antwort): void {
  server((a) => {
    if (a.url === "/api/admin/unternehmensprofil" && a.methode === "GET") {
      return { status: 200, koerper: VERWALTUNG };
    }
    if (a.url === "/api/admin/unternehmensprofil" && a.methode === "PUT") {
      return put ? put(a) : undefined;
    }
    if (a.url === "/api/admin/richtlinien" && a.methode === "GET") {
      return { status: 200, koerper: { richtlinien: [] } };
    }
    if (a.url === "/api/directory") {
      return { status: 200, koerper: [] };
    }
    if (a.url === "/api/admin/richtlinien/wirkung") {
      const k = a.koerper as { anforderung: string };
      return {
        status: 200,
        koerper: {
          verlangt: k.anforderung,
          erneut: false,
          betroffen: 4,
          bisherigeFassung: null,
          bisherigeHandlungen: 0,
        },
      };
    }
    return undefined;
  });
}

describe("ADMIN-15 · Verwaltungsfläche /unternehmen", () => {
  it("K1 · die Vorschau zeigt Name und Akzent vor dem Speichern — breit und 390 px", async () => {
    verwaltungsServer((a) => ({
      status: 200,
      koerper: {
        ...(a.koerper as object),
        version: 1,
        logo: null,
        geaendertVon: "a",
        geaendertAm: "2026-10-09T08:00:00.000Z",
        grund: null,
        uebernommenAus: null,
      },
    }));
    const c = await montieren(createElement(Unternehmen), "/unternehmen");
    await act(async () => {
      tippe($(c, "profil-name"), "Nordtal Werkzeugbau");
      await flush();
    });
    await klick($(c, "profil-akzent-tannengruen"));

    for (const id of ["vorschau-desktop", "vorschau-mobil"]) {
      const kopf = $(c, id) as HTMLElement | null;
      expect(kopf?.getAttribute("data-akzent"), id).toBe("tannengruen");
      expect($(c, `${id}-name`)?.textContent).toBe("Nordtal Werkzeugbau");
      expect(kopf?.style.backgroundColor).toBe("rgb(30, 86, 49)");
      expect(kopf?.style.color).toBe("rgb(255, 255, 255)");
    }
    // Die schmale Vorschau steht in einem 390-px-Rahmen.
    expect($(c, "vorschau-mobil")?.parentElement?.className).toContain("w-[390px]");
    expect($(c, "profil-vorschau")?.textContent).toContain("Noch nicht gespeichert");
    // Bis hierher hat die Fläche NICHTS gespeichert.
    expect(aufrufe.filter((a) => a.methode === "PUT")).toEqual([]);

    await klick($(c, "profil-speichern"));
    const puts = aufrufe.filter((a) => a.methode === "PUT");
    expect(puts.map((a) => a.koerper)).toEqual([
      { version: 0, name: "Nordtal Werkzeugbau", logo: null, akzent: "tannengruen" },
    ]);
    expect($(c, "profil-gespeichert")?.textContent).toBe("Gespeichert als Fassung 1.");
  });

  it("K2 · eine SVG-Datei wird beim Auswählen erklärt abgewiesen; eine Serverabweisung ebenso", async () => {
    verwaltungsServer(() => ({
      status: 400,
      koerper: { error: "LOGO_MASSE", message: "…", breite: 20, hoehe: 20 },
    }));
    const c = await montieren(createElement(Unternehmen), "/unternehmen");
    const feld = $(c, "profil-logo") as HTMLInputElement;
    expect(feld.getAttribute("accept")).toBe("image/png,image/jpeg");
    const svg = new File(["<svg><script>alert(1)</script></svg>"], "nordtal.svg", {
      type: "image/svg+xml",
    });
    Object.defineProperty(feld, "files", { value: [svg], configurable: true });
    await act(async () => {
      feld.dispatchEvent(new Event("change", { bubbles: true }));
      await flush();
    });
    const fehler = $(c, "profil-logo-fehler");
    expect(fehler?.getAttribute("role")).toBe("alert");
    expect(fehler?.textContent).toContain("Diese Datei wurde abgewiesen");
    expect(fehler?.textContent).toContain("SVG");
    expect($(c, "vorschau-desktop-logo")).toBeNull();

    await act(async () => {
      tippe($(c, "profil-name"), "Nordtal");
      await flush();
    });
    await klick($(c, "profil-speichern"));
    expect($(c, "profil-fehler")?.textContent).toContain("zwischen 32 und 4000 Pixel");

    // Die Akzentfarben sind eine feste Auswahl aus Radioknöpfen — mit Kontrastangabe und
    // sichtbarem Fokusring für die Tastatur.
    const radios = [...c.querySelectorAll<HTMLInputElement>('input[type="radio"][name="akzent"]')];
    expect(radios.map((r) => r.value)).toEqual(AKZENTE.map((a) => a.id));
    for (const r of radios) {
      expect(r.className).toContain("focus-visible:outline-2");
    }
    expect($(c, "profil-akzente")?.textContent).toContain("Kontrast 11,5 : 1");
  });

  it("K3 · Veröffentlichen erst nach angezeigter Wirkung — eine geänderte Handlung verlangt sie neu", async () => {
    verwaltungsServer();
    const c = await montieren(createElement(Unternehmen), "/unternehmen");
    await klick($(c, "richtlinie-neu"));
    const veroeffentlichen = $(c, "richtlinie-veroeffentlichen") as HTMLButtonElement;
    expect(veroeffentlichen.disabled).toBe(true);
    expect(veroeffentlichen.textContent).toBe("Fassung 1 veröffentlichen");

    await klick($(c, "richtlinie-wirkung-pruefen"));
    expect($(c, "richtlinie-wirkung")?.textContent).toBe(
      "4 Konten müssen diese Fassung zur Kenntnis nehmen.",
    );
    expect(($(c, "richtlinie-veroeffentlichen") as HTMLButtonElement).disabled).toBe(false);

    await klick($(c, "richtlinie-anforderung-zustimmung"));
    expect($(c, "richtlinie-wirkung")).toBeNull();
    expect(($(c, "richtlinie-veroeffentlichen") as HTMLButtonElement).disabled).toBe(true);
    await klick($(c, "richtlinie-wirkung-pruefen"));
    expect($(c, "richtlinie-wirkung")?.textContent).toBe(
      "4 Konten müssen dieser Fassung zustimmen.",
    );
    const veroeffentlicht = aufrufe.filter(
      (a) => a.url === "/api/admin/richtlinien" && a.methode === "POST",
    );
    expect(veroeffentlicht).toEqual([]);
  });

  it("ohne Verwaltungsrecht: ein verständlicher Hinweis mit Rückweg statt leerer Karten", async () => {
    server((a) =>
      a.url.startsWith("/api/admin/")
        ? { status: 403, koerper: { error: "FORBIDDEN", message: "Recht fehlt: users.manage" } }
        : undefined,
    );
    const c = await montieren(createElement(Unternehmen), "/unternehmen");
    expect($(c, "unternehmen-ohne-recht")?.textContent).toContain(
      "nur Administratorinnen und Administratoren",
    );
    expect($(c, "unternehmen-zurueck")?.getAttribute("href")).toBe("/admin?bereich=system");
    expect($(c, "unternehmen-profil")).toBeNull();
  });
});

describe("ADMIN-15 · Beschäftigtenfläche /richtlinien", () => {
  const RICHTLINIE = {
    id: "r1",
    fassung: 2,
    titel: "Hausordnung Nordtal",
    text: "Besucher melden sich am Empfang an.",
    verantwortlich: "Personalabteilung Nordtal",
    gueltigAb: "2026-10-12",
    rollen: [],
    anforderung: "zustimmung",
    veroeffentlichtVon: "a",
    veroeffentlichtAm: "2026-10-09T08:00:00.000Z",
    aenderungsgrund: "Fotoregel ergänzt",
    meineHandlung: null,
  };

  it("K4/K5 · Öffnen schickt keine Handlung; der Knopf schickt sie mit genau dieser Fassung", async () => {
    server((a) => {
      if (a.url === "/api/unternehmensprofil") {
        return {
          status: 200,
          koerper: {
            version: 3,
            profil: {
              name: "Nordtal Werkzeugbau",
              logo: null,
              akzent: { id: "nachtblau", flaeche: "#1f3a5f", schrift: "#ffffff" },
            },
          },
        };
      }
      if (a.url === "/api/richtlinien") {
        return { status: 200, koerper: { richtlinien: [RICHTLINIE] } };
      }
      if (a.url === "/api/richtlinien/r1/handlungen") {
        return {
          status: 201,
          koerper: {
            richtlinieId: "r1",
            fassung: 2,
            personId: "e",
            handlung: "zustimmung",
            am: "2026-10-09T09:00:00.000Z",
            bereits: false,
          },
        };
      }
      return undefined;
    });
    const c = await montieren(createElement(Richtlinien), "/richtlinien");
    expect($(c, "unternehmen-kopf-name")?.textContent).toBe("Nordtal Werkzeugbau");
    expect($(c, "richtlinie-meta")?.textContent).toContain("Fassung 2");
    expect($(c, "richtlinie-meta")?.textContent).toContain("Personalabteilung Nordtal");
    // Angezeigt — aber nichts geschickt.
    expect(aufrufe.filter((a) => a.methode !== "GET")).toEqual([]);

    const knopf = $(c, "richtlinie-handeln");
    expect(knopf?.textContent).toBe("Fassung 2 zustimmen");
    await klick(knopf);
    expect(aufrufe.filter((a) => a.methode === "POST")).toEqual([
      {
        url: "/api/richtlinien/r1/handlungen",
        methode: "POST",
        koerper: { fassung: 2, handlung: "zustimmung" },
      },
    ]);

    // Die Rechtsseiten sind eigene, unveränderte Seiten — hier steht nur der Verweis.
    const rechtlich = $(c, "richtlinien-rechtliches");
    expect(
      [...(rechtlich?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href")),
    ).toEqual(["/impressum", "/datenschutz"]);
  });
});
