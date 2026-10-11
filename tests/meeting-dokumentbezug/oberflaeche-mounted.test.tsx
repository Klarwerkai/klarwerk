// @vitest-environment jsdom
// ================================================================================================
// BPA-16 · NACHARBEIT 6 — DER NUTZERWEG AUF DEM BILDSCHIRM: AUS FOLIE UND GESPRÄCHSSTELLE ÖFFNEN.
// ================================================================================================
//
// Gemessen am DOM der echten Seite `apps/web/src/pages/Besprechungen.tsx` mit dem echten Client
// (`apps/web/src/api/besprechungen.ts` → `api/client.ts`) und der echten App dahinter
// (`buildServices`/`buildApp`, Routen `/api/objects/**` und `/api/meetings/**`). Der Transport ist
// ein `fetch` → `app.inject`-Draht — dieselbe Bauform wie `tests/ask-c02/konflikt-flaeche-mounted`.
// Jede andere absolute Adresse ist gesperrt: kein Netz, kein Modell.
//
// DER WEG (Importweg mit manueller Zuordnung, BPA-S17, synthetische Daten):
//   A · Die Vortragende verbindet auf der Seite eine präsentierte Kopie samt Original (vertraulich)
//       und eine Mitschrift (intern), ordnet an einer Gesprächsstelle die gezeigte Folie zu und
//       erfasst dort eine Rückmeldung.
//   B · Der Teilnehmer (Freigabeniveau „vertraulich") öffnet DIESELBE Rückmeldung aus der Folie und
//       aus der Gesprächsstelle; beide Wege führen zur jeweils anderen Seite und zur tatsächlichen
//       Quellfassung, deren Adresse am Server wirklich die Datei liefert.
//   C · Rechteentzug: die Verwaltung senkt das Freigabeniveau auf „intern". Ohne Neuladen der
//       Seite: aus der Folie nichts mehr, aus der Gesprächsstelle nur noch „Folie ohne Leserecht",
//       keine Quellverweise; die Datei selbst antwortet 404.
//   Dazu der Einstieg: der Dokumentweg `/fragen/dokument` verweist auf `/besprechungen`.
//
// WAS DAS NICHT IST: ein echter Browser (der Smoke-Ordner liegt ausserhalb dieses Auftrags), ein
// Live-Meetinghost oder eine Datei aus einer PowerPoint-Installation.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { PPTX_MIME, VTT_MIME } from "../../apps/web/src/api/besprechungen";
import i18n from "../../apps/web/src/i18n";
import { BesprechungAnsicht } from "../../apps/web/src/pages/Besprechungen";
import { Dokumentfragen } from "../../apps/web/src/pages/Dokumentfragen";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { NORD, VTT, pptx } from "./vorrichtung";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let app: FastifyInstance | null = null;
/** Die Sitzung, mit der die SEITE gerade spricht (wer am Bildschirm sitzt). */
let cookie: string | null = null;
let vorherigerFetch: typeof globalThis.fetch;

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      throw new Error(`IN-PROCESS-GRENZE: ${url} wird in diesem Lauf nicht gewählt.`);
    }
    if (!app) {
      throw new Error(`Draht ohne App: ${url}`);
    }
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    if (cookie) {
      kopf.cookie = cookie;
    }
    const antwort = await app.inject({
      method: (init?.method ?? "GET") as "GET",
      url,
      headers: kopf,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      headers: new Headers(),
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

interface Sitzung {
  id: string;
  token: string;
  cookie: string;
}

async function konto(name: string, admin?: Sitzung): Promise<Sitzung> {
  const a = app as FastifyInstance;
  const email = `${name}-bpa16@klarwerk.test`;
  const reg = await a.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name, email, password: "geheim12345" },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  const roh = reg.json() as { id?: string; user?: { id: string } };
  const id = roh.id ?? roh.user?.id ?? "";
  if (admin) {
    const frei = await a.inject({
      method: "POST",
      url: `/api/auth/users/${id}/approve`,
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(frei.statusCode, frei.body).toBe(200);
  }
  const login = await a.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  expect(login.statusCode, login.body).toBe(200);
  const token = (login.json() as { token: string }).token;
  return { id, token, cookie: `kw_session=${token}` };
}

async function freigabeSetzen(admin: Sitzung, nutzer: Sitzung, freigabe: string): Promise<void> {
  const res = await (app as FastifyInstance).inject({
    method: "PUT",
    url: `/api/users/${nutzer.id}`,
    headers: { authorization: `Bearer ${admin.token}` },
    payload: { freigabe },
  });
  expect(res.statusCode, res.body).toBe(200);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

async function durchlaufen(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

/** Wartet, bis die Bedingung gilt — sichtbar gescheitert statt still übersprungen. */
async function bis(bedingung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    if (bedingung()) {
      return;
    }
    await act(durchlaufen);
  }
  throw new Error(`Nicht eingetreten: ${was}\n${container.textContent ?? ""}`);
}

/** Steht das Element schon im DOM? */
function da(selektor: string): boolean {
  return container.querySelector(selektor) !== null;
}

function el<T extends Element>(selektor: string): T {
  const gefunden = container.querySelector<T>(selektor);
  if (!gefunden) {
    throw new Error(`Nicht gefunden: ${selektor}`);
  }
  return gefunden;
}

async function klick(selektor: string): Promise<void> {
  const knopf = el<HTMLButtonElement>(selektor);
  expect(knopf.disabled, `${selektor} ist gesperrt`).toBe(false);
  await act(async () => {
    knopf.click();
    await durchlaufen();
  });
}

async function waehlen(selektor: string, wert: string): Promise<void> {
  const feld = el<HTMLSelectElement>(selektor);
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
    await durchlaufen();
  });
}

async function tippen(selektor: string, text: string): Promise<void> {
  const feld = el<HTMLTextAreaElement>(selektor);
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
}

/**
 * Eine PPTX als `File`. Die Bytes werden in ein eigenes `ArrayBuffer` kopiert: `BlobPart` verlangt
 * `Uint8Array<ArrayBuffer>`, jszip liefert `Uint8Array<ArrayBufferLike>`.
 */
function pptxDatei(bytes: Uint8Array, name: string): File {
  const kopie = new Uint8Array(bytes.byteLength);
  kopie.set(bytes);
  return new File([kopie], name, { type: PPTX_MIME });
}

async function dateiSetzen(selektor: string, datei: File): Promise<void> {
  const feld = el<HTMLInputElement>(selektor);
  Object.defineProperty(feld, "files", { value: [datei], configurable: true });
  await act(async () => {
    feld.dispatchEvent(new Event("change", { bubbles: true }));
    await durchlaufen();
  });
}

async function seiteOeffnen(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: [pfad] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/besprechungen/:id",
              element: createElement(BesprechungAnsicht),
            }),
            createElement(Route, {
              path: "/fragen/dokument",
              element: createElement(Dokumentfragen),
            }),
          ),
        ),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
}

function schliessen(): void {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
}

beforeAll(async () => {
  await i18n.changeLanguage("de");
  drahtAufbauen();
});

afterAll(async () => {
  globalThis.fetch = vorherigerFetch;
  await app?.close();
});

afterEach(() => {
  schliessen();
});

describe("BPA-16 · Rückmeldungen aus Folie und Gesprächsstelle auf der Seite öffnen (K1/K6/K7/K10)", () => {
  it("Import mit manueller Zuordnung, Öffnen von beiden Seiten, Quellfassung, Rechteentzug", async () => {
    app = buildApp(buildServices());
    await app.ready();
    const vortragende = await konto("vortragende");
    const teilnehmer = await konto("teilnehmer", vortragende);
    await freigabeSetzen(vortragende, teilnehmer, "vertraulich");
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/meetings",
      headers: { authorization: `Bearer ${vortragende.token}` },
      payload: { titel: "Quartalsrunde", zeitbasis: "aufnahme", teilnehmer: [teilnehmer.id] },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const meetingId = (angelegt.json() as { meetingId: string }).meetingId;
    const pfad = `/besprechungen/${meetingId}`;

    // ---- A · die Vortragende: verbinden, zuordnen, Rückmeldung erfassen ------------------------
    cookie = vortragende.cookie;
    await seiteOeffnen(pfad);
    await bis(() => da('[data-testid="besprechung-dateien"]'), "Seite");
    await waehlen('[data-testid="besprechung-stufe"]', "vertraulich");
    await dateiSetzen(
      '[data-testid="besprechung-datei-praesentation"]',
      pptxDatei(await pptx(NORD, "vortragskopie"), "nord-vortrag.pptx"),
    );
    await dateiSetzen(
      '[data-testid="besprechung-datei-original"]',
      pptxDatei(await pptx(NORD), "nord.pptx"),
    );
    await klick('[data-testid="besprechung-praesentation-verbinden"]');
    await bis(
      () => container.querySelectorAll('[data-testid="besprechung-folie-oeffnen"]').length === 3,
      "drei Folien der verbundenen Präsentation",
    );
    await waehlen('[data-testid="besprechung-stufe"]', "intern");
    await dateiSetzen(
      '[data-testid="besprechung-datei-mitschrift"]',
      new File([VTT], "meeting.vtt", { type: VTT_MIME }),
    );
    await klick('[data-testid="besprechung-mitschrift-verbinden"]');
    await bis(() => da('[data-testid="besprechung-stelle"][data-stelle="r2"]'), "Stelle r2");
    await klick('[data-testid="besprechung-stelle-waehlen"][data-stelle="r2"]');
    const optionen = Array.from(
      el<HTMLSelectElement>('[data-testid="besprechung-zuordnung-folie"]').options,
    );
    const folie2 = optionen.find((o) => o.textContent === "Folie 2: Umsatzentwicklung");
    expect(folie2, "Folie 2 steht in der Zuordnungsauswahl").toBeDefined();
    await waehlen('[data-testid="besprechung-zuordnung-folie"]', folie2?.value ?? "");
    await klick('[data-testid="besprechung-zuordnung-speichern"]');
    const bearbeitenText = (): string =>
      el('[data-testid="besprechung-bearbeiten"]').textContent ?? "";
    await bis(() => bearbeitenText().includes("Zuordnung gespeichert"), "Zuordnung gespeichert");
    await waehlen('[data-testid="besprechung-art"]', "beschlossene_korrektur");
    await tippen('[data-testid="besprechung-text"]', "Berechnungsgrundlage unter die Grafik");
    await klick('[data-testid="besprechung-rueckmeldung-speichern"]');
    await bis(() => bearbeitenText().includes("Rückmeldung gespeichert"), "Rückmeldung");
    schliessen();

    const stand = await app.inject({
      method: "GET",
      url: `/api/meetings/${meetingId}`,
      headers: { authorization: `Bearer ${vortragende.token}` },
    });
    const besprechung = stand.json() as {
      praesentationen: {
        dateiId: string;
        quelleId: string;
        abgleich: { originalQuelleId: string };
      }[];
    };
    const kopieId = besprechung.praesentationen[0]?.quelleId ?? "";
    const originalId = besprechung.praesentationen[0]?.abgleich.originalQuelleId ?? "";
    expect(kopieId).not.toBe("");
    expect(originalId).not.toBe(kopieId);

    // ---- B · der Teilnehmer: aus der Folie und aus der Gesprächsstelle öffnen -------------------
    cookie = teilnehmer.cookie;
    await seiteOeffnen(pfad);
    await bis(
      () => container.querySelectorAll('[data-testid="besprechung-folie-oeffnen"]').length === 3,
      "Folien für den Teilnehmer",
    );
    await klick('[data-testid="besprechung-folie-oeffnen"][data-sld="257"]');
    await bis(
      () => container.querySelector('[data-testid="besprechung-rueckmeldung"]') !== null,
      "Rückmeldung aus der Folie",
    );
    expect(el('[data-testid="besprechung-treffer-titel"]').getAttribute("data-von")).toBe("folie");
    const ausFolie = el('[data-testid="besprechung-rueckmeldung"]');
    const rueckmeldungId = ausFolie.getAttribute("data-rueckmeldung");
    expect(ausFolie.textContent).toContain("Berechnungsgrundlage unter die Grafik");
    expect(ausFolie.textContent).toContain("Hier fehlt die Quelle der Zahlen.");
    const quelle = el<HTMLAnchorElement>('[data-testid="besprechung-quelle"]').getAttribute("href");
    expect(quelle).toBe(`/api/objects/${encodeURIComponent(kopieId)}/raw`);
    const ziel = el<HTMLAnchorElement>('[data-testid="besprechung-ziel-quelle"]').getAttribute(
      "href",
    );
    expect(ziel).toBe(`/api/objects/${encodeURIComponent(originalId)}/raw`);
    // Die tatsächliche Quellfassung: die Adresse liefert am Server die präsentierte PPTX.
    const datei = await app.inject({
      method: "GET",
      url: quelle ?? "",
      headers: { cookie: teilnehmer.cookie },
    });
    expect(datei.statusCode).toBe(200);
    expect(datei.rawPayload.subarray(0, 2).toString("latin1")).toBe("PK");

    // Von der Folie zur Gesprächsstelle — dieselbe Rückmeldung.
    await klick('[data-testid="besprechung-zur-stelle"]');
    await bis(
      () =>
        el('[data-testid="besprechung-treffer-titel"]').getAttribute("data-von") === "stelle" &&
        container.querySelector('[data-testid="besprechung-rueckmeldung"]') !== null,
      "Rückmeldung aus der Gesprächsstelle",
    );
    expect(el('[data-testid="besprechung-rueckmeldung"]').getAttribute("data-rueckmeldung")).toBe(
      rueckmeldungId,
    );
    // Und direkt von der Gesprächsstelle aus — wieder dieselbe, mit dem Weg zurück zur Folie.
    await klick('[data-testid="besprechung-stelle-oeffnen"][data-stelle="r2"]');
    await bis(
      () => container.querySelector('[data-testid="besprechung-zur-folie"]') !== null,
      "Weg zurück zur Folie",
    );
    expect(el('[data-testid="besprechung-rueckmeldung"]').getAttribute("data-rueckmeldung")).toBe(
      rueckmeldungId,
    );
    expect(el('[data-testid="besprechung-rueckmeldung-folie"]').textContent).toBe(
      "Folie 2: Umsatzentwicklung",
    );

    // ---- C · Rechteentzug ohne Neuladen der Seite -----------------------------------------------
    await freigabeSetzen(vortragende, teilnehmer, "intern");
    await klick('[data-testid="besprechung-folie-oeffnen"][data-sld="257"]');
    await bis(
      () => container.querySelector('[data-testid="besprechung-treffer-leer"]') !== null,
      "aus der Folie nichts mehr",
    );
    await klick('[data-testid="besprechung-stelle-oeffnen"][data-stelle="r2"]');
    await bis(
      () => container.querySelector('[data-testid="besprechung-folie-gesperrt"]') !== null,
      "Folie gesperrt an der Gesprächsstelle",
    );
    const gesperrt = el('[data-testid="besprechung-rueckmeldung"]');
    expect(gesperrt.getAttribute("data-rueckmeldung")).toBe(rueckmeldungId);
    expect(gesperrt.querySelector('[data-testid="besprechung-quelle"]')).toBeNull();
    expect(gesperrt.querySelector('[data-testid="besprechung-ziel-quelle"]')).toBeNull();
    expect(gesperrt.textContent).not.toContain("Umsatzentwicklung");
    const gesperrteDatei = await app.inject({
      method: "GET",
      url: quelle ?? "",
      headers: { cookie: teilnehmer.cookie },
    });
    expect(gesperrteDatei.statusCode).toBe(404);
  });

  it("der Dokumentweg verweist auf die Besprechungen", async () => {
    await seiteOeffnen("/fragen/dokument");
    const verweis = el<HTMLAnchorElement>('[data-testid="dokumentfragen-besprechungen"]');
    expect(verweis.getAttribute("href")).toBe("/besprechungen");
    expect(verweis.textContent).toBe("Besprechungen und Folien");
  });
});
