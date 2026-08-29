// @vitest-environment jsdom
// ================================================================================================
// JOB 2685 D2 (Review R2-30) — DIE WISSENSOBJEKT-SEITE MIT ZEHN BILDERN: der Verbraucher.
// ================================================================================================
//
// §5: „Eine Wissensobjekt-Seite mit zehn Bildern löst EINE Trägersuche aus, nicht zehn — und jedes
// Bild ist für genau dieselben Menschen sichtbar wie vorher."
//
// Zwei Hälften, ehrlich getrennt, weil jsdom keine Bilder lädt:
//   A · DIE SEITE: die echte `KnowledgeDetail` rendert ein Wissensobjekt mit zehn Bildern im
//       Fließtext — es entstehen zehn `img`-Elemente mit `/api/objects/…/raw`. Das ist, was der
//       Browser danach zehnmal anfordert.
//   B · DIE ZEHN ANFORDERUNGEN: gegen die ECHTE App (Route → Kandidaten-Speicher → Dienst), mit
//       einer zählenden Trägersuche an der Stelle der Datenquelle. Gemessen: zwei Suchen für zehn
//       Bilder (Bild 1, dann seine neun Geschwister); Hochladende und Fremder sehen, was sie vorher
//       sahen; eine Hochstufung greift beim nächsten Abruf — innerhalb der Frist.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  ko: {} as Record<string, unknown>,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
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
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Pia" }]) },
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

const BILDER = Array.from({ length: 10 }, (_, i) => `bild-${i + 1}`);
const BODY_MIT_ZEHN_BILDERN = BILDER.map(
  (id) => `<p>Schritt <img src="/api/objects/${id}/raw" alt="${id}"></p>`,
).join("");

// ------------------------------------------------------------------------------------------------
// A · DIE SEITE
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
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
                { initialEntries: ["/wissen/ko-1"] },
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

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.ko = {
    id: "ko-1",
    title: "Wartung der Presse in zehn Schritten",
    statement: "Zehn Schritte, zehn Bilder.",
    bodyHtml: BODY_MIT_ZEHN_BILDERN,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Instandhaltung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-07-01T10:00:00.000Z",
    history: [{ version: 1, at: "2026-07-01T10:00:00.000Z", author: "u1", note: "erstellt" }],
    comments: [],
    attachments: [],
    sources: [],
  };
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  vi.clearAllMocks();
});

describe("JOB 2685 D2 · A · die Wissensobjekt-Seite rendert zehn Bilder — zehn Anforderungen an /api/objects/:id/raw", () => {
  it("zehn img-Elemente, jedes mit der Roh-Adresse seines Bildes", async () => {
    await mount();
    const bilder = [...container.querySelectorAll("img")]
      .map((img) => img.getAttribute("src") ?? "")
      .filter((src) => src.startsWith("/api/objects/"));
    expect(bilder).toHaveLength(10);
    expect(new Set(bilder)).toEqual(new Set(BILDER.map((id) => `/api/objects/${id}/raw`)));
  });
});

// ------------------------------------------------------------------------------------------------
// B · DIE ZEHN ANFORDERUNGEN — gegen die echte App
// ------------------------------------------------------------------------------------------------
type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

async function konten(app: App): Promise<{ anna: Auth; bert: Auth }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: "anna@seite.test", password: "geheim12345" },
  });
  const anna = await login(app, "anna@seite.test", "geheim12345");
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: anna,
    payload: { name: "Bert", email: "bert@seite.test", password: "geheim12345", role: "viewer" },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Konto bert nicht angelegt: ${res.statusCode} ${res.body}`);
  }
  return { anna, bert: await login(app, "bert@seite.test", "geheim12345") };
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

describe("JOB 2685 D2 · B · zehn Anforderungen gegen die echte App: zwei Suchen, dieselbe Sichtbarkeit, Entzug sofort", () => {
  it("zehn Bilder → zwei Trägersuchen; Hochladende und Fremder sehen, was sie sahen; nach der Hochstufung sieht der Fremde beim nächsten Abruf nichts mehr", async () => {
    const repos = inMemoryRepos();
    const suche = vi.fn(stellvertreterFuer(repos));
    repos.koRepo.listAnhangTraegerFuer = suche;
    const app = buildApp(assembleServices(repos));
    const { anna, bert } = await konten(app);
    const bilder: string[] = [];
    for (let i = 0; i < 10; i++) {
      bilder.push(await upload(app, anna));
    }
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: anna,
      payload: {
        title: "Wartung der Presse in zehn Schritten",
        statement: "Zehn Schritte, zehn Bilder.",
        type: "best_practice",
        category: "Instandhaltung",
        bodyHtml: bilder.map((id) => `<p><img src="/api/objects/${id}/raw"></p>`).join(""),
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const koId = created.json().id as string;
    suche.mockClear();

    // Der Fremde lädt die Seite: zehn Anforderungen, zwei Suchen.
    for (const id of bilder) {
      const res = await app.inject({ method: "GET", url: `/api/objects/${id}/raw`, headers: bert });
      expect(res.statusCode, `${id}: ${res.body}`).toBe(200);
      expect(res.headers["cache-control"]).toBe("private, no-cache, must-revalidate");
    }
    expect(suche).toHaveBeenCalledTimes(2);
    // Die Hochladende ebenso — und der Speicher ist schon warm: keine Suche mehr.
    for (const id of bilder) {
      expect(
        (await app.inject({ method: "GET", url: `/api/objects/${id}/raw`, headers: anna }))
          .statusCode,
      ).toBe(200);
    }
    expect(suche).toHaveBeenCalledTimes(2);

    // Hochstufung — innerhalb der Frist, ohne neue Suche: der Fremde bekommt sofort 404.
    const stufe = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: anna,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);
    for (const id of bilder) {
      const res = await app.inject({ method: "GET", url: `/api/objects/${id}/raw`, headers: bert });
      expect(res.statusCode, `${id} nach Hochstufung`).toBe(404);
      expect(res.headers["cache-control"]).toBe("no-store");
    }
    // Die Hochladende sieht ihr vertrauliches Objekt weiter — mit `no-store`.
    for (const id of bilder) {
      const res = await app.inject({ method: "GET", url: `/api/objects/${id}/raw`, headers: anna });
      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toBe("no-store");
    }
    // D3: die Hochstufung war ein SCHREIBEN — der Speicher hat die Seite einmal neu gesucht (Bild 1,
    // Geschwister): vier Suchen für dreißig Abrufe, nicht zwei; und nicht dreißig.
    expect(suche).toHaveBeenCalledTimes(4);
  });
});
