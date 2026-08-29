// @vitest-environment jsdom
// ================================================================================================
// JOB 2685 D3 (Review R2-30) — DIE KETTE: Seite → Bildanforderung → Antwort AM ELEMENT.
// ================================================================================================
//
// BEN an D2: „jsdom ruft die gerenderten Bilder nicht selbst ab. Damit sind Renderer und
// Abrufstelle einzeln, nicht als durchgehende Kette belegt."
//
// Was hier die Kette schließt — und was nicht: jsdom lädt keine Bilder, das bleibt so. An seine
// Stelle tritt DER BEOBACHTER: ein MutationObserver am Dokument, der jede eingefügte `img` mit
// `/api/objects/…/raw` genauso behandelt wie ein Browser — er fordert die Adresse an (hier: über
// `app.inject` der ECHTEN App mit der Sitzung des Betrachters) und setzt das Ergebnis AM ELEMENT
// (`load` bei 200, `error` sonst). Der Test enumeriert keine Adressen mehr; er sieht nur, was am
// Element ankommt. Was weiter fehlt: die Pixel — ob der Browser die Bytes zeichnet, prüft kein
// jsdom. Der Vertrag „200 = Bild, 404 = kein Bild" ist derselbe wie an der Route.
//
//   A · ZEHN BILDER: die echte `KnowledgeDetail` rendert Annas Objekt; Berts Beobachter fordert
//       zehn Adressen an, alle zehn `img` bekommen `load`; die App hat ZWEI Trägersuchen gemacht.
//   B · EIN NEUES BILD WÄHREND DER FRIST, AM MENSCHEN: Bert hat ein Bild angefordert, das nur ein
//       vertrauliches Objekt trägt (404, gemerkt). Anna setzt es WÄHREND der Frist in ihr internes
//       Objekt. Bert öffnet die Seite: das `img` bekommt `load` — sofort, nicht nach Ablauf.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  ko: {} as Record<string, unknown>,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Bert", email: "b@x.de", role: "viewer" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => box.ko),
        list: leer,
        versions: leer,
        evidence: leer,
        act: vi.fn(async () => box.ko),
        appendDocument: vi.fn(async () => ({})),
      },
      objects: { upload: vi.fn(async () => ({ id: "obj-x", size: 1 })) },
      reasoner: {
        extract: vi.fn(async () => ({ points: [], note: null })),
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({})),
        describeImage: vi.fn(async () => ({})),
      },
      audit: { list: leer },
      conflicts: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Bert" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "search_on_click" })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
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
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";
import {
  type AppRepos,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { KnowledgeObject } from "../../services/knowledge-object";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// ------------------------------------------------------------------------------------------------
// DER BEOBACHTER — was der Browser täte: jede eingefügte Bildadresse anfordern, Ergebnis ans Element.
// ------------------------------------------------------------------------------------------------
interface Beobachter {
  /** Adresse → Statuscode, in der Reihenfolge der Anforderung. */
  anforderungen: { src: string; status: number }[];
  /** Wartet, bis jede bisher gesehene Anforderung beantwortet und am Element vermerkt ist. */
  fertig: () => Promise<void>;
  stopp: () => void;
}

function beobachter(app: App, sitzung: Auth): Beobachter {
  const anforderungen: { src: string; status: number }[] = [];
  const laufend: Promise<void>[] = [];
  const gesehen = new WeakSet<HTMLImageElement>();
  const anfordern = (img: HTMLImageElement): void => {
    if (gesehen.has(img)) {
      return;
    }
    gesehen.add(img);
    const src = img.getAttribute("src") ?? "";
    if (!src.startsWith("/api/objects/")) {
      return;
    }
    laufend.push(
      app.inject({ method: "GET", url: src, headers: sitzung }).then((res) => {
        anforderungen.push({ src, status: res.statusCode });
        img.dataset.klarwerkStatus = String(res.statusCode);
        img.dispatchEvent(new Event(res.statusCode === 200 ? "load" : "error"));
      }),
    );
  };
  const mo = new MutationObserver((mutationen) => {
    for (const m of mutationen) {
      for (const n of m.addedNodes) {
        if (n instanceof HTMLImageElement) {
          anfordern(n);
        } else if (n instanceof Element) {
          for (const img of n.querySelectorAll("img")) {
            anfordern(img);
          }
        }
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
  return {
    anforderungen,
    fertig: async () => {
      // Der Beobachter meldet sich als Mikrotask; erst danach stehen die Anforderungen in `laufend`.
      await new Promise((r) => setTimeout(r, 0));
      await Promise.all(laufend);
    },
    stopp: () => mo.disconnect(),
  };
}

// ------------------------------------------------------------------------------------------------
// DIE SEITE
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(koId: string): Promise<void> {
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
                { initialEntries: [`/wissen/${koId}`] },
                createElement(
                  NavGuardProvider,
                  null,
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
}

function unmount(): void {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

// ------------------------------------------------------------------------------------------------
// DIE APP
// ------------------------------------------------------------------------------------------------
async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function konten(app: App, marke: string): Promise<{ anna: Auth; bert: Auth }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: `anna@${marke}.test`, password: "geheim12345" },
  });
  const anna = await login(app, `anna@${marke}.test`, "geheim12345");
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: anna,
    payload: { name: "Bert", email: `bert@${marke}.test`, password: "geheim12345", role: "viewer" },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Konto bert nicht angelegt: ${res.statusCode} ${res.body}`);
  }
  return { anna, bert: await login(app, `bert@${marke}.test`, "geheim12345") };
}

async function upload(app: App, wer: Auth): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: wer,
    payload: {
      name: "schritt.png",
      mime: "image/png",
      data: PNG_DATA_URL,
      kind: "image",
      purpose: "attachment",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function objekt(app: App, wer: Auth, bodyHtml: string): Promise<Record<string, unknown>> {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: wer,
    payload: {
      title: "Wartung der Presse in zehn Schritten",
      statement: "Zehn Schritte, zehn Bilder.",
      type: "best_practice",
      category: "Instandhaltung",
      bodyHtml,
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  return created.json() as Record<string, unknown>;
}

function stellvertreterFuer(
  repos: AppRepos,
): (objectIds: readonly string[]) => Promise<KnowledgeObject[]> {
  return async (objectIds) =>
    (await repos.koRepo.list({})).filter((k) =>
      objectIds.some(
        (objectId) =>
          (k.attachments ?? []).some((a) => a.objectId === objectId) ||
          (typeof k.bodyHtml === "string" && k.bodyHtml.includes(objectId)),
      ),
    );
}

function statusAmElement(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const img of container.querySelectorAll("img")) {
    const src = img.getAttribute("src") ?? "";
    if (src.startsWith("/api/objects/")) {
      out[src] = img.dataset.klarwerkStatus ?? "offen";
    }
  }
  return out;
}

describe("JOB 2685 D3 · die Kette: Seite → Beobachter → echte App → Ergebnis am img", () => {
  it("A · zehn Bilder: alle zehn img bekommen `load` (200), die App hat zwei Trägersuchen gemacht", async () => {
    const repos = inMemoryRepos();
    const suche = vi.fn(stellvertreterFuer(repos));
    repos.koRepo.listAnhangTraegerFuer = suche;
    const app = buildApp(assembleServices(repos));
    const { anna, bert } = await konten(app, "kette-a");
    const bilder: string[] = [];
    for (let i = 0; i < 10; i++) {
      bilder.push(await upload(app, anna));
    }
    box.ko = await objekt(
      app,
      anna,
      bilder.map((id) => `<p>Schritt <img src="/api/objects/${id}/raw"></p>`).join(""),
    );
    suche.mockClear();

    const geladen: string[] = [];
    document.body.addEventListener(
      "load",
      (e) => {
        if (e.target instanceof HTMLImageElement) {
          geladen.push(e.target.getAttribute("src") ?? "");
        }
      },
      true,
    );
    const b = beobachter(app, bert);
    await mount(String(box.ko.id));
    await b.fertig();
    b.stopp();

    expect(b.anforderungen).toHaveLength(10);
    expect(b.anforderungen.every((a) => a.status === 200)).toBe(true);
    expect(new Set(b.anforderungen.map((a) => a.src))).toEqual(
      new Set(bilder.map((id) => `/api/objects/${id}/raw`)),
    );
    expect(Object.values(statusAmElement())).toEqual(Array(10).fill("200"));
    expect(new Set(geladen)).toEqual(new Set(bilder.map((id) => `/api/objects/${id}/raw`)));
    expect(suche).toHaveBeenCalledTimes(2);
  });

  it("B · ein neues Bild während der Frist, am Menschen: gemerkt als nur vertraulich getragen (404), nach Annas Schreiben öffnet Bert die Seite und das img bekommt `load` — sofort", async () => {
    const repos = inMemoryRepos();
    const suche = vi.fn(stellvertreterFuer(repos));
    repos.koRepo.listAnhangTraegerFuer = suche;
    const app = buildApp(assembleServices(repos));
    const { anna, bert } = await konten(app, "kette-b");
    const bild = await upload(app, anna);
    // Das Bild hängt zunächst NUR an einem vertraulichen Objekt.
    const geheim = await objekt(app, anna, `<p><img src="/api/objects/${bild}/raw"></p>`);
    const stufe = await app.inject({
      method: "PUT",
      url: `/api/kos/${String(geheim.id)}`,
      headers: anna,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);
    // Bert hat das Bild schon einmal angefordert (etwa aus einem alten Verweis): 404, und der
    // Speicher merkt sich den vertraulichen Kandidaten.
    suche.mockClear();
    const alt = await app.inject({ method: "GET", url: `/api/objects/${bild}/raw`, headers: bert });
    expect(alt.statusCode).toBe(404);
    expect(suche).toHaveBeenCalledTimes(1);

    // WÄHREND DER FRIST: Anna legt ein internes Objekt an, das das Bild im Fließtext zeigt.
    box.ko = await objekt(app, anna, `<p>Für alle: <img src="/api/objects/${bild}/raw"></p>`);

    // Bert öffnet Annas neues Objekt. Der Beobachter fordert das Bild an — und es lädt.
    const b = beobachter(app, bert);
    await mount(String(box.ko.id));
    await b.fertig();
    b.stopp();
    expect(b.anforderungen).toEqual([{ src: `/api/objects/${bild}/raw`, status: 200 }]);
    expect(statusAmElement()).toEqual({ [`/api/objects/${bild}/raw`]: "200" });
    // Der Speicher hat den alten Eintrag verworfen und neu gesucht — innerhalb der Frist.
    expect(suche).toHaveBeenCalledTimes(2);
  });
});
