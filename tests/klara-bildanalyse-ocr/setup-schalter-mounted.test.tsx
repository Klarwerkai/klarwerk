// @vitest-environment jsdom
// ================================================================================================
// OCR-03 · K4 — DER SCHALTER IN SETUP › KLARA, BEDIENT, MIT ECHTEM SERVER.
// ================================================================================================
//
// Gemountet sind die ECHTE Gruppe „Bilder und Text in Bildern“ (`KlaraBildAutomatikGruppe`, dieselbe
// Komponente, die `pages/Profile.tsx` im Bereich „Klara“ zeigt) und daneben die ECHTE Editor-
// Automatik (`BildBefundeImRumpf`). Der Server ist echt (`buildApp(buildServices())`, In-Memory);
// ersetzt sind nur der Transport (`fetch` → `app.inject`, wie `tests/klara-setup-shortcuts/`) und die
// Texterkennung (liest die Marke aus den Bildbytes). Fiktive Konten.
//
//   W1  Ohne abweichende Präferenz ist der Schalter an und die Automatik liest.
//   W2  Ausschalten → gespeichert am Server; Neuladen → weiterhin aus und es wird NICHT gelesen;
//       wieder einschalten → gespeichert; Neuladen → an und es wird gelesen.
//   W3  Die Wahl des einen Kontos ändert nichts am anderen.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult } from "../../apps/web/src/lib/ocr";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const steuerung = vi.hoisted(() => ({
  ocr: vi.fn(async (_src: unknown): Promise<OcrResult> => ({ status: "success", text: "" })),
}));

vi.mock("../../apps/web/src/lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/files")>()),
  runImageOcr: steuerung.ocr,
}));

import type { FastifyInstance } from "fastify";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { DescribeImageResult } from "../../apps/web/src/api/types";
import { ImageDescribeValueProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { BildBefundeImRumpf } from "../../apps/web/src/components/BildBefundeImRumpf";
import { KlaraBildAutomatikGruppe } from "../../apps/web/src/components/klara-setup/KlaraSetup";
import i18n from "../../apps/web/src/i18n";
import {
  ladeAssistenzProfil,
  verwerfeAssistenzProfil,
} from "../../apps/web/src/lib/assistenzProfil";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { TEXT_JE_MARKE, bildMit, dataUrl, markeAus } from "./deck";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADA = { name: "Ada Fiktiv", email: "ada@bildschalter.test", password: "ada-geheim-1" };
const WANDA = { name: "Wanda Fiktiv", email: "wanda@bildschalter.test", password: "wanda-geh-1" };

let services: AppServices;
let app: FastifyInstance | null = null;
let cookie: string | null = null;
let ada = { id: "", cookie: "" };
let wanda = { id: "", cookie: "" };
let vorherigerFetch: typeof globalThis.fetch;
const anfragen: { methode: string; pfad: string }[] = [];

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (!app) {
      throw new Error(`Draht ohne App: ${methode} ${url}`);
    }
    anfragen.push({ methode, pfad: url.split("?")[0] ?? url });
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    if (cookie) {
      kopf.cookie = cookie;
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

async function anmelden(email: string, password: string): Promise<string> {
  const r = await (app as FastifyInstance).inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(r.statusCode, r.body).toBe(200);
  return `kw_session=${(r.json() as { token: string }).token}`;
}

async function draht(methode: "GET" | "POST", url: string, mit: string) {
  const r = await (app as FastifyInstance).inject({
    method: methode,
    url,
    headers: { cookie: mit },
  });
  return { status: r.statusCode, body: r.body === "" ? null : (r.json() as unknown) };
}

async function vorrichtung(): Promise<void> {
  services = buildServices();
  app = buildApp(services);
  await app.ready();
  const a = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADA });
  expect(a.statusCode, "Ersteinrichtung (Ada)").toBe(201);
  const w = await app.inject({ method: "POST", url: "/api/auth/register", payload: WANDA });
  expect(w.statusCode, "zweites Konto (Wanda)").toBe(201);
  const adaCookie = await anmelden(ADA.email, ADA.password);
  const adaId = (a.json() as { id: string }).id;
  const wandaId = (w.json() as { id: string }).id;
  const frei = await draht("POST", `/api/auth/users/${wandaId}/approve`, adaCookie);
  expect(frei.status, "Wanda freigegeben").toBeLessThan(300);
  const wandaCookie = await anmelden(WANDA.email, WANDA.password);
  for (const mit of [adaCookie, wandaCookie]) {
    expect((await draht("POST", "/api/auth/notice", mit)).status).toBeLessThan(300);
  }
  ada = { id: adaId, cookie: adaCookie };
  wanda = { id: wandaId, cookie: wandaCookie };
}

async function amServer(mit: string): Promise<boolean | undefined> {
  const r = await draht("GET", "/api/me/assistenz", mit);
  expect(r.status).toBe(200);
  return (r.body as { profil: { bildAutomatik?: boolean } | null }).profil?.bildAutomatik;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const RUMPF = [
  "<p>Aushang an der Anlage.</p>",
  `<figure><img data-image-id="kw-1" src="${dataUrl(bildMit("A"))}"></figure>`,
].join("");

const WEG = {
  available: true,
  describe: async (): Promise<DescribeImageResult> => ({ text: "Ein Schild", demo: false }),
};

async function abwarten(): Promise<void> {
  for (let i = 0; i < 12; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

/** „Seite laden“: Browserstand weg, Profil des Kontos neu gelesen, Setup und Editor montiert. */
async function laden(konto: { id: string; cookie: string }): Promise<void> {
  if (root) {
    const alt = root;
    act(() => alt.unmount());
  }
  verwerfeAssistenzProfil();
  cookie = konto.cookie;
  const neu = createRoot(container);
  root = neu;
  await act(async () => {
    await ladeAssistenzProfil(konto.id);
  });
  await act(async () => {
    neu.render(
      createElement(
        "div",
        null,
        createElement(KlaraBildAutomatikGruppe),
        createElement(ImageDescribeValueProvider, {
          value: WEG,
          children: createElement(BildBefundeImRumpf, { html: RUMPF }),
        }),
      ),
    );
  });
  await abwarten();
}

const q = (id: string): HTMLElement | null => container.querySelector(`[data-testid="${id}"]`);
const schalter = (): HTMLInputElement => q("klara-bildautomatik-schalter") as HTMLInputElement;

async function umschalten(): Promise<void> {
  await act(async () => {
    schalter().click();
  });
  await abwarten();
}

beforeAll(() => {
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
  steuerung.ocr.mockReset();
  steuerung.ocr.mockImplementation(async (src: unknown): Promise<OcrResult> => {
    const marke = markeAus(String(src));
    return { status: "success", text: (marke ? TEXT_JE_MARKE[marke] : "") ?? "" };
  });
  anfragen.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  await vorrichtung();
});

afterEach(async () => {
  if (root) {
    const alt = root;
    act(() => alt.unmount());
    root = null;
  }
  container.remove();
  verwerfeAssistenzProfil();
  await app?.close();
  app = null;
  cookie = null;
});

describe("W1/W2 · K4 — voreingestellt an; aus und wieder an bleiben nach Neuladen und wirken", () => {
  it("Schalter bedienen, neu laden, Wirkung an der Editor-Automatik messen", async () => {
    await laden(ada);
    // W1: ohne abweichende Präferenz an — und die Automatik liest.
    expect(schalter().checked).toBe(true);
    expect(schalter().disabled).toBe(false);
    expect(q("klara-bildautomatik-stand")?.getAttribute("data-lage")).toBe("an");
    expect(container.textContent).toContain(i18n.t("klarabildkontext.setup.schalter"));
    expect(steuerung.ocr).toHaveBeenCalledTimes(1);
    expect(await amServer(ada.cookie)).toBeUndefined();

    // W2: ausschalten — gespeichert über den vorhandenen Profilweg.
    await umschalten();
    expect(schalter().checked).toBe(false);
    expect(q("klara-bildautomatik-meldung")?.textContent).toBe(
      i18n.t("klarabildkontext.setup.gespeichertAus"),
    );
    expect(anfragen.some((a) => a.methode === "PUT" && a.pfad === "/api/me/assistenz")).toBe(true);
    expect(await amServer(ada.cookie)).toBe(false);

    // Neu laden: weiterhin aus — und die frisch montierte Automatik liest NICHT.
    steuerung.ocr.mockClear();
    await laden(ada);
    expect(schalter().checked).toBe(false);
    expect(q("klara-bildautomatik-stand")?.getAttribute("data-lage")).toBe("aus");
    expect(steuerung.ocr).not.toHaveBeenCalled();
    expect(q("bild-befunde")?.getAttribute("data-status")).toBe("aus");

    // Wieder einschalten: sofort wirksam, gespeichert, nach Neuladen weiter an und wirksam.
    await umschalten();
    expect(schalter().checked).toBe(true);
    expect(steuerung.ocr).toHaveBeenCalledTimes(1);
    expect(await amServer(ada.cookie)).toBe(true);
    steuerung.ocr.mockClear();
    await laden(ada);
    expect(schalter().checked).toBe(true);
    expect(steuerung.ocr).toHaveBeenCalledTimes(1);
  });
});

describe("W3 · die Wahl gehört dem Konto", () => {
  it("Ada schaltet aus; Wanda sieht weiter die Voreinstellung und liest automatisch", async () => {
    await laden(ada);
    await umschalten();
    expect(await amServer(ada.cookie)).toBe(false);

    steuerung.ocr.mockClear();
    await laden(wanda);
    expect(schalter().checked).toBe(true);
    expect(steuerung.ocr).toHaveBeenCalledTimes(1);
    expect(await amServer(wanda.cookie)).toBeUndefined();
  });
});
