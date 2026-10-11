// @vitest-environment jsdom
// ================================================================================================
// BETROFFENENRECHTE · DIE FLÄCHEN, GEGEN DIE ECHTE ANWENDUNG.
// ================================================================================================
//
// Die Karten aus `components/datenschutz/` werden in jsdom montiert; ihr `fetch` geht über
// `app.inject` an die echte App (In-Memory-Ablage). Jeder Aufruf wird mitgeschrieben.
//
//   F1  (R-0663) „Meine Daten" zählt je Bereich und lädt AUF KNOPFDRUCK genau die gezählte
//       Auskunft als JSON-Datei herunter — ein Abruf, kein zweiter.
//   F2  (R-0661) „Konto löschen lassen": sagt, was der Antrag bewirkt; stellt ihn mit Begründung,
//       zeigt Frist, lässt ihn zurückziehen.
//   F3  (R-0661) Die Verwaltung sieht den Antrag mit Frist und erledigt ihn mit Bestätigung — das
//       Konto ist danach gelöscht.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  LoeschantragDetail,
  MeineDatenDetail,
} from "../../apps/web/src/components/datenschutz/MeineDaten";
import { BetroffenenrechteVerwaltung } from "../../apps/web/src/components/datenschutz/Verwaltung";
import i18n from "../../apps/web/src/i18n";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type App = ReturnType<typeof buildApp>;

const START = Date.parse("2026-10-06T08:00:00.000Z");

let services: AppServices;
let app: App;
let adminToken = "";
let erik = { id: "", token: "" };
let flaechenToken = "";
let aufrufe: Array<{ methode: string; url: string }> = [];
/** Was die Fläche herunterladen wollte: Dateiname und Inhalt. */
let dateien: Array<{ name: string; inhalt: string }> = [];

function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    aufrufe.push({ methode, url });
    const kopf: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((wert, name) => {
        kopf[name] = wert;
      });
    }
    kopf.authorization = `Bearer ${flaechenToken}`;
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body === undefined || init?.body === null
        ? {}
        : { payload: String(init.body as string) }),
    });
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof fetch;
}

/** Der Download-Weg des Browsers, mitgeschrieben statt ausgeführt. */
function downloadEinhaengen(): void {
  const blobs = new Map<string, Blob>();
  let n = 0;
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = (b: Blob) => {
    n += 1;
    const url = `blob:test-${n}`;
    blobs.set(url, b);
    return url;
  };
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => undefined;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    const blob = blobs.get(this.href);
    if (blob) {
      const name = this.download;
      const leser = new FileReader();
      leser.onload = () => {
        dateien.push({ name, inhalt: String(leser.result) });
      };
      leser.readAsText(blob);
    }
  };
}

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function montieren(element: ReturnType<typeof createElement>): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const wurzel = root;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    wurzel.render(createElement(QueryClientProvider, { client: qc }, element));
  });
  await act(flush);
  return container;
}

function knopf(wurzel: HTMLElement, testId: string): HTMLButtonElement {
  const k = wurzel.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  if (!k) {
    throw new Error(`Knopf ${testId} fehlt`);
  }
  return k;
}

async function klicke(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.click();
  });
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  services = assembleServices(inMemoryRepos(), { datenschutzUhr: () => START });
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@flaeche.test", password: "secret123" },
  });
  adminToken = await anmelden("ada@flaeche.test");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      name: "Erik Experte",
      email: "erik@flaeche.test",
      password: "secret123",
      role: "experte",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  erik = {
    id: (angelegt.json() as { id: string }).id,
    token: await anmelden("erik@flaeche.test"),
  };
  aufrufe = [];
  dateien = [];
  transportEinhaengen();
  downloadEinhaengen();
});

afterEach(async () => {
  if (root) {
    const r = root;
    await act(async () => {
      r.unmount();
    });
  }
  container?.remove();
  container = null;
  root = null;
});

describe("F1 · „Meine Daten“ auf Knopfdruck", () => {
  it("zählt die Bereiche und lädt genau diese Auskunft als JSON herunter", async () => {
    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        confidentiality: "intern",
        title: "Pumpe 4 entlüften",
        statement: "Vor dem Anfahren Pumpe 4 entlüften.",
        type: "best_practice",
        category: "Anlage Beispiel",
      },
    });
    const koId = (ko.json() as { id: string }).id;
    await services.ko.addComment(koId, erik.id, "Bei Frost zweimal entlüften.");

    flaechenToken = erik.token;
    const flaeche = await montieren(
      createElement(MeineDatenDetail, { onZurueck: () => undefined }),
    );
    const zahl = (bereich: string) =>
      flaeche.querySelector(`[data-bereich="${bereich}"]`)?.textContent ?? "";
    expect(zahl("kommentare")).toBe("1");
    expect(zahl("protokoll")).not.toBe("");
    expect(flaeche.textContent).toContain(i18n.t("datenschutz.meineDaten.nichtEnthalten"));
    expect(aufrufe.filter((a) => a.url === "/api/me/daten")).toHaveLength(1);

    await klicke(knopf(flaeche, "meine-daten-herunterladen"));
    await act(flush);
    expect(dateien).toHaveLength(1);
    expect(dateien[0]?.name).toMatch(/^klarwerk-meine-daten-.*\.json$/);
    const datei = JSON.parse(dateien[0]?.inhalt ?? "{}") as {
      art: string;
      konto: { email: string };
      kommentare: Array<{ text: string }>;
    };
    expect(datei.art).toBe("klarwerk.selbstauskunft");
    expect(datei.konto.email).toBe("erik@flaeche.test");
    expect(datei.kommentare.map((k) => k.text)).toEqual(["Bei Frost zweimal entlüften."]);
    // Der Download ist kein zweiter Abruf — er speichert, was gezählt wurde.
    expect(aufrufe.filter((a) => a.url === "/api/me/daten")).toHaveLength(1);
  });
});

describe("F2 · „Konto löschen lassen“", () => {
  it("nennt die Wirkung, stellt den Antrag mit Frist und lässt ihn zurückziehen", async () => {
    flaechenToken = erik.token;
    const flaeche = await montieren(
      createElement(LoeschantragDetail, { onZurueck: () => undefined }),
    );
    expect(flaeche.textContent).toContain(i18n.t("datenschutz.antrag.wirkung"));

    const feld = flaeche.querySelector<HTMLTextAreaElement>(
      '[data-testid="loeschantrag-begruendung"]',
    );
    expect(feld).not.toBeNull();
    await act(async () => {
      if (feld) {
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
        setter?.call(feld, "Ich wechsle das Unternehmen.");
        feld.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await klicke(knopf(flaeche, "loeschantrag-stellen"));
    expect(
      aufrufe.filter((a) => a.methode === "POST" && a.url === "/api/me/loeschantrag"),
    ).toHaveLength(1);
    const offen = flaeche.querySelector('[data-testid="loeschantrag-offen"]');
    expect(offen?.textContent).toContain(new Date("2026-11-06T08:00:00.000Z").toLocaleDateString());
    const gespeichert = await services.loeschantraege.vonNutzer(erik.id);
    expect(gespeichert.map((a) => [a.status, a.begruendung])).toEqual([
      ["offen", "Ich wechsle das Unternehmen."],
    ]);

    await klicke(knopf(flaeche, "loeschantrag-zurueckziehen"));
    expect((await services.loeschantraege.vonNutzer(erik.id))[0]?.status).toBe("zurueckgezogen");
    expect(flaeche.querySelector('[data-testid="loeschantrag-verlauf"]')?.textContent).toContain(
      i18n.t("datenschutz.status.zurueckgezogen"),
    );
  });
});

describe("F3 · die Verwaltung erledigt den Antrag", () => {
  it("zeigt Antragsteller und Frist und löscht das Konto erst nach Bestätigung", async () => {
    const gestellt = await app.inject({
      method: "POST",
      url: "/api/me/loeschantrag",
      headers: { authorization: `Bearer ${erik.token}` },
      payload: {},
    });
    expect(gestellt.statusCode).toBe(201);

    flaechenToken = adminToken;
    const flaeche = await montieren(createElement(BetroffenenrechteVerwaltung));
    const zeile = flaeche.querySelector('[data-testid="loeschantrag-zeile"]');
    expect(zeile?.textContent).toContain("Erik Experte");
    expect(zeile?.textContent).toContain(new Date("2026-11-06T08:00:00.000Z").toLocaleDateString());
    expect(flaeche.querySelector('[data-testid="dateninventar"]')?.textContent).toContain(
      "Wissenslücken",
    );

    await klicke(knopf(flaeche, "loeschantrag-erledigen"));
    // Noch nichts gelöscht — erst die Bestätigung.
    expect((await services.auth.listUsers()).some((u) => u.id === erik.id)).toBe(true);
    await klicke(knopf(flaeche, "loeschantrag-erledigen-ja"));
    expect((await services.auth.listUsers()).some((u) => u.id === erik.id)).toBe(false);
    expect((await services.loeschantraege.alle())[0]?.status).toBe("erledigt");
  });
});

// Nacharbeit 5 (BEN): eine abgebrochene Erledigung bleibt `in_bearbeitung` gespeichert. Die Uhr
// dieser Datei steht auf START (08:00); eine Übernahme von 07:00 ist damit älter als die fünf
// Minuten (`UEBERNAHME_GUELTIG_MS`), eine von 08:00 nicht.
describe("F4 · eine abgebrochene Erledigung wird über die Fläche wieder aufgenommen", () => {
  async function antragInBearbeitung(am: string): Promise<string> {
    const gestellt = await app.inject({
      method: "POST",
      url: "/api/me/loeschantrag",
      headers: { authorization: `Bearer ${erik.token}` },
      payload: {},
    });
    expect(gestellt.statusCode).toBe(201);
    const id = (gestellt.json() as { id: string }).id;
    // So hinterlässt ein Prozessabbruch den Antrag: übernommen, Konto noch da, nicht abgeschlossen.
    const uebernommen = await services.loeschantraege.uebernehmen(
      id,
      { token: "abgebrochen", am, von: "admin-vorher" },
      "2026-10-06T00:00:00.000Z",
    );
    expect(uebernommen?.status).toBe("in_bearbeitung");
    return id;
  }

  it("nach erneutem Laden bietet die Karte die Wiederaufnahme an — und sie schliesst ab", async () => {
    const id = await antragInBearbeitung("2026-10-06T07:00:00.000Z");

    flaechenToken = adminToken;
    // Das erneute Laden: eine frisch montierte Karte mit frischem Abruf.
    const flaeche = await montieren(createElement(BetroffenenrechteVerwaltung));
    expect(flaeche.querySelector('[data-testid="loeschantrag-abgebrochen"]')).not.toBeNull();
    // Ablehnen und die normale Erledigung gibt es hier nicht — der Antrag ist nicht offen.
    expect(flaeche.querySelector('[data-testid="loeschantrag-erledigen"]')).toBeNull();
    expect(flaeche.querySelector('[data-testid="loeschantrag-ablehnen"]')).toBeNull();

    await klicke(knopf(flaeche, "loeschantrag-wiederaufnehmen"));
    // Erst die Bestätigung löscht.
    expect((await services.auth.listUsers()).some((u) => u.id === erik.id)).toBe(true);
    await klicke(knopf(flaeche, "loeschantrag-erledigen-ja"));

    expect((await services.auth.listUsers()).some((u) => u.id === erik.id)).toBe(false);
    const antrag = await services.loeschantraege.finde(id);
    expect(antrag?.status).toBe("erledigt");
    // Die neue Übernahme ist die der Wiederaufnahme, nicht die abgebrochene.
    expect(antrag?.uebernahme?.token).not.toBe("abgebrochen");
    expect((await services.audit.list({ action: "loeschantrag.erledigt" })).length).toBe(1);
    // Nach dem Neuladen der Liste steht der Antrag als erledigt da, ohne Aktion.
    expect(flaeche.querySelector('[data-testid="loeschantrag-wiederaufnehmen"]')).toBeNull();
  });

  it("eine noch laufende Übernahme bietet keine Wiederaufnahme an", async () => {
    await antragInBearbeitung("2026-10-06T08:00:00.000Z");
    flaechenToken = adminToken;
    const flaeche = await montieren(createElement(BetroffenenrechteVerwaltung));
    expect(flaeche.querySelector('[data-testid="loeschantrag-wiederaufnehmen"]')).toBeNull();
    expect(flaeche.querySelector('[data-testid="loeschantrag-erledigen"]')).toBeNull();
    expect((await services.auth.listUsers()).some((u) => u.id === erik.id)).toBe(true);
  });
});
