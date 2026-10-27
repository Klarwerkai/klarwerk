// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { api } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { BibliothekLesen } from "../../apps/web/src/components/bibliothek/BibliothekLesen";
import i18n from "../../apps/web/src/i18n";
import { beendeLokaleSitzung, bestaetigeLokalesKonto } from "../../apps/web/src/lib/lokaleSitzung";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";

const konto = vi.hoisted(() => ({ id: "" }));
const ports = vi.hoisted(() => ({
  studio: 0,
  editor: 0,
  montagen: 0,
  bereit: Promise.resolve(),
  freigeben: undefined as (() => void) | undefined,
}));
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: konto.id, role: "admin" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin" }),
}));
vi.mock("../../apps/web/src/app/ToastContext", () => ({
  useToast: () => ({ push: () => {} }),
}));
// Kontrollierte Editorports; Leser, Client und Backend des zweiten Falls bleiben echt.
vi.mock("../../apps/web/src/components/KnowledgeInputStudio", async () => {
  ports.studio += 1;
  await ports.bereit;
  const { createElement: h, useState } = await import("../../apps/web/node_modules/react");
  return {
    KnowledgeInputStudio: ({
      open,
      onClose,
      bodyHtml,
      onApply,
    }: {
      open: boolean;
      onClose: () => void;
      bodyHtml: string;
      onApply: (html: string) => void;
    }) => {
      const [instanz] = useState(() => ++ports.montagen);
      const [draft, setDraft] = useState(bodyHtml);
      return open
        ? h(
            "section",
            { "data-testid": "studio-port", "data-instanz": instanz },
            h("textarea", {
              "data-testid": "studio-draft",
              value: draft,
              onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
            }),
            h("button", { "data-testid": "studio-zu", onClick: onClose }, "Schließen"),
            h(
              "button",
              {
                "data-testid": "studio-anwenden",
                onClick: () => {
                  onApply(draft);
                  onClose();
                },
              },
              "Übernehmen",
            ),
          )
        : null;
    },
  };
});
vi.mock("../../apps/web/src/components/RichTextEditor", async () => {
  ports.editor += 1;
  await ports.bereit;
  const { createElement: h } = await import("../../apps/web/node_modules/react");
  return {
    RichTextEditor: ({
      value,
      onChange,
      documentTitle,
    }: {
      value: string;
      onChange: (html: string) => void;
      documentTitle?: string;
    }) =>
      h("textarea", {
        "data-testid": "editor-port",
        "data-titel": documentTitle,
        value,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
      }),
  };
});

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
let root: ReturnType<typeof createRoot> | undefined;
let host: HTMLDivElement | undefined;
let qc: QueryClient | undefined;
let app: ReturnType<typeof buildApp> | undefined;
const netzFreigaben: (() => void)[] = [];
beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  bestaetigeLokalesKonto("autor", Date.now());
  await act(async () => {
    await i18n.changeLanguage("de");
  });
});
afterEach(async () => {
  await act(async () => {
    for (const frei of netzFreigaben.splice(0)) frei();
    ports.freigeben?.();
    await vi.dynamicImportSettled();
    root?.unmount();
    qc?.clear();
  });
  host?.remove();
  await app?.close();
  root = undefined;
  app = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  bestaetigeLokalesKonto("autor", Date.now());
});
async function datenBereit() {
  await act(async () => {
    await vi.waitFor(() => {
      if (qc?.isFetching() || qc?.isMutating()) throw new Error("Echter Datenabruf läuft noch.");
    });
  });
}
async function klick(selector: string) {
  const knopf = host?.querySelector<HTMLButtonElement>(selector);
  expect(knopf, selector).not.toBeNull();
  await act(async () => knopf?.click());
}
async function text(selector: string, value: string) {
  const feld = host?.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  expect(feld, selector).not.toBeNull();
  await act(async () => {
    const proto =
      feld instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(feld, value);
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("Bibliothekssuche erhält high; Default und Sitzungsende bleiben erhalten", async () => {
  const rufe: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown, init?: RequestInit) => {
      const url = String(input);
      rufe.push({ url, init });
      if (url.includes("gehalten") || url.endsWith("/session-default")) {
        return new Promise<Response>((resolve) => {
          netzFreigaben.push(() => resolve(new Response("[]")));
        });
      }
      return Promise.resolve(new Response("[]"));
    }),
  );
  expect(await endpoints.library.search({ q: "Ventil" })).toEqual([]);
  expect(await api.get("/default")).toEqual([]);
  expect(rufe.map((r) => r.init?.priority)).toEqual(["high", undefined]);
  expect(rufe[0]?.url).toBe("/api/library/search?q=Ventil");
  for (const ruf of rufe) {
    expect(ruf.init?.credentials).toBe("include");
    expect(new Headers(ruf.init?.headers).get("X-Klarwerk-Host")).toBe("klarwerk_web");
    expect(new Headers(ruf.init?.headers).get("Accept-Language")).toBe("de");
    expect(ruf.init?.signal?.aborted).toBe(false);
  }
  const antworten = Promise.allSettled([
    api.get("/session-default"),
    endpoints.library.search({ q: "gehalten" }),
  ]);
  await beendeLokaleSitzung("autor");
  expect(rufe.slice(-2).map((r) => r.init?.signal?.aborted)).toEqual([true, true]);
  for (const frei of netzFreigaben.splice(0)) frei();
  for (const ergebnis of await antworten) {
    expect(ergebnis.status).toBe("rejected");
    if (ergebnis.status === "rejected") {
      expect(ergebnis.reason).toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
    }
  }
});

it("Lesen ohne Editorladung; Bearbeiten erhält Daten und Studioinstanz", async () => {
  expect([ports.studio, ports.editor]).toEqual([0, 0]);
  ports.bereit = new Promise<void>((resolve) => {
    ports.freigeben = resolve;
  });
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  app = buildApp(services);
  const email = "editorbedarf@example.test";
  const password = "test-password-editorbedarf";
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Leserin", email, password },
  });
  const user = await repos.users.findByEmail(email);
  if (!user) throw new Error("Das echte Testkonto fehlt.");
  konto.id = user.id;
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  const token = login.json<{ token: string }>().token;
  const ko = await services.ko.create({
    title: "Originaltitel",
    statement: "Originalaussage",
    author: user.id,
    type: "best_practice",
    category: "Leser",
    confidentiality: "intern",
  });
  const bodyHtml = "<p>Originalinhalt</p>";
  await repos.koRepo.update({ ...ko, bodyHtml });
  const backend = app;
  vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
    const headers: Record<string, string> = { authorization: `Bearer ${token}` };
    new Headers(init?.headers).forEach((value, name) => {
      headers[name] = value;
    });
    const reply = await backend.inject({
      method: (init?.method ?? "GET") as "GET",
      url: String(input),
      headers,
      ...(init?.body ? { payload: String(init.body) } : {}),
    });
    const antwortHeaders = new Headers();
    for (const [name, value] of Object.entries(reply.headers)) {
      if (value !== undefined) antwortHeaders.set(name, String(value));
    }
    return new Response(reply.statusCode === 204 ? null : reply.body, {
      status: reply.statusCode,
      headers: antwortHeaders,
    });
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  await act(async () => {
    root?.render(
      createElement(
        QueryClientProvider,
        { client: qc as QueryClient },
        createElement(
          MemoryRouter,
          null,
          createElement(BibliothekLesen, {
            koId: ko.id,
            suchtext: "",
            treffer: [],
            onGeloescht: () => {},
            hinweisSchonGesagt: false,
          }),
        ),
      ),
    );
  });
  await datenBereit();
  expect(host.querySelector('[data-testid="bib-titel"]')?.textContent).toBe("Originaltitel");
  expect([ports.studio, ports.editor]).toEqual([0, 0]);
  await klick('[data-testid="bib-eintrag-menue"]');
  await klick('[data-testid="bib-menue-bearbeiten"]');
  await vi.waitFor(() => expect([ports.studio, ports.editor]).toEqual([1, 1]));
  await text('input[data-testid="bib-titel"]', "Titel während der Modulbereitschaft");
  const studioOeffnen = async () => {
    const knopf = [...(host?.querySelectorAll("button") ?? [])].find((b) => {
      return b.textContent?.includes(i18n.t("studio.open"));
    });
    expect(knopf).toBeDefined();
    await act(async () => knopf?.click());
  };
  await studioOeffnen();
  await act(async () => {
    ports.freigeben?.();
    await vi.dynamicImportSettled();
  });
  await datenBereit();
  const titel = host.querySelector<HTMLInputElement>('input[data-testid="bib-titel"]');
  const editor = host.querySelector<HTMLTextAreaElement>('[data-testid="editor-port"]');
  expect(titel?.value).toBe("Titel während der Modulbereitschaft");
  expect(editor?.value).toBe(bodyHtml);
  expect(editor?.getAttribute("data-titel")).toBe("Titel während der Modulbereitschaft");
  const studio = host.querySelector<HTMLElement>('[data-testid="studio-port"]');
  const instanz = studio?.dataset.instanz;
  await klick('[data-testid="studio-zu"]');
  await studioOeffnen();
  const wiederOffen = host.querySelector<HTMLElement>('[data-testid="studio-port"]');
  expect(wiederOffen?.dataset.instanz).toBe(instanz);
  expect(ports.montagen).toBe(1);
  await text('[data-testid="studio-draft"]', "<p>Bearbeiteter Inhalt</p>");
  await klick('[data-testid="studio-anwenden"]');
  expect(editor?.value).toBe("<p>Bearbeiteter Inhalt</p>");
  await klick('[data-testid="bib-speichern"]');
  await datenBereit();
  const gespeichert = await repos.koRepo.findById(ko.id);
  expect(gespeichert?.title).toBe("Titel während der Modulbereitschaft");
  expect(gespeichert?.bodyHtml).toBe("<p>Bearbeiteter Inhalt</p>");
});
