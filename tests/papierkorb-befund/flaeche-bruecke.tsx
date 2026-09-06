// ================================================================================================
// JOB 3116 · DIE FLAECHEN-BRUECKE — DIE ECHTE SEITE AUF DER ECHTEN APP.
// ================================================================================================
//
// Aufbau wie `tests/library/job2703-bruecke.ts`: der ECHTE Client-Code (`fetch` gegen `/api/...`)
// spricht ueber `app.inject` mit der ECHTEN Fastify-App. Kein zweiter Wiretyp, keine erfundene
// Antwortform.
//
// EINE Erweiterung gegenueber jener Bruecke, und sie steht hier benannt: `queueErsatz`. Damit
// beantwortet die Bruecke GENAU die Abfrage `GET /api/library/import/candidates` mit einer
// vorgegebenen Liste. Sie wird NUR von R6 benutzt — fuer die zwei Formen, die der heutige Server
// gar nicht mehr erzeugen KANN bzw. nicht ueber HTTP erzeugbar sind: echter Altbestand OHNE
// `dublettenbefund` (eingereiht vor JOB 3050) und `pruefung_nicht_moeglich` (entsteht nur, wenn die
// Papierkorb-Lesung wirft). R5 laeuft OHNE Ersatz, mit den Kandidaten der echten Route.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ImportReview } from "../../apps/web/src/pages/Stufe2";
import { buildApp, buildServices } from "../../services/app/src/build-app";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const ZUGANG = { name: "Admin", email: "q2c-flaeche@x.de", password: "geheim12345" };

export interface FlaechenBruecke {
  app: ReturnType<typeof buildApp>;
  kopf: Record<string, string>;
  /** Die Antwort auf `GET /api/library/import/candidates` ersetzen (nur R6, s. Kopfkommentar). */
  setzeQueueErsatz(liste: unknown[] | null): void;
  abbauen(): void;
}

export async function flaechenBruecke(): Promise<FlaechenBruecke> {
  // Der Anker-Strang haengt am generischen Import-Enable, das NUR beim Bau der Dienste gelesen
  // wird — das Flag gilt darum genau fuer diesen einen Aufruf und wird danach wieder entfernt
  // (`Reflect.deleteProperty` statt `delete`: lint/performance/noDelete).
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  const dienste = buildServices();
  Reflect.deleteProperty(process.env, "KLARWERK_CONFLUENCE_IMPORT");
  const app = buildApp(dienste);
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  const token = (login.json() as { token?: string }).token ?? "";
  const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const kopf: Record<string, string> = { authorization: `Bearer ${token}` };
  if (cookie) {
    kopf.cookie = cookie;
  }
  let queueErsatz: unknown[] | null = null;
  const vorher = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const method = (init?.method ?? "GET").toUpperCase();
    if (queueErsatz !== null && method === "GET" && url === "/api/library/import/candidates") {
      return {
        ok: true,
        status: 200,
        statusText: "200",
        headers: { get: () => null },
        text: async () => JSON.stringify(queueErsatz),
        json: async () => queueErsatz,
      };
    }
    const headers: Record<string, string> = { ...kopf };
    new Headers(init?.headers).forEach((v, k) => {
      headers[k] = v;
    });
    const res = await app.inject({
      method: method as "GET" | "POST" | "PUT" | "DELETE",
      url,
      headers,
      ...(init?.body !== undefined ? { payload: String(init.body) } : {}),
    });
    return {
      ok: res.statusCode >= 200 && res.statusCode < 300,
      status: res.statusCode,
      statusText: String(res.statusCode),
      headers: { get: (n: string) => (res.headers[n.toLowerCase()] as string | undefined) ?? null },
      text: async () => res.body,
      json: async () => res.json(),
    };
  }) as unknown as typeof globalThis.fetch;
  return {
    app,
    kopf,
    setzeQueueErsatz(liste) {
      queueErsatz = liste;
    },
    abbauen() {
      globalThis.fetch = vorher;
    },
  };
}

/** Der Text, den ein Mensch auf der gemounteten Seite wirklich liest. */
export interface Gemountet {
  text: string;
  /**
   * Die BESCHRIFTUNGEN DER ABZEICHEN, einzeln. Warum nicht der Seitentext allein: die Zaehlzeile
   * darueber schreibt „Dubletten: 1" (`ext.queue.duplicates`, unveraendert) — eine Zusicherung
   * „das Wort Dublette steht nirgends" waere damit falsch, ohne dass am Abzeichen etwas faul waere.
   * Die ABLOESUNG ist eine Aussage ueber die Abzeichen, und genau die wird hier gelesen.
   */
  abzeichen: string[];
  /**
   * Die Abzeichen EINER Karte, gefunden ueber den sichtbaren Titel des Kandidaten. Die ABLOESUNG
   * ist eine Aussage ueber DIESEN Kandidaten: dass irgendwo auf der Seite noch „KO erzeugt" steht,
   * ist richtig und soll so bleiben (an dem Kandidaten, der wirklich eines erzeugt hat).
   */
  karte(titel: string): string[];
  abbauen(): void;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

export async function mounteImportReview(): Promise<Gemountet> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
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
                NavGuardProvider,
                null,
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    MemoryRouter,
                    { initialEntries: ["/import"] },
                    createElement(ImportReview),
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
  for (let i = 0; i < 10; i += 1) {
    await act(flush);
  }
  const beschriftungen = (wurzel: ParentNode): string[] =>
    Array.from(wurzel.querySelectorAll('span[class*="rounded-pill"]')).map((el) =>
      (el.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
  return {
    text: (container.textContent ?? "").replace(/\s+/g, " "),
    abzeichen: beschriftungen(container),
    karte(titel) {
      const karten = Array.from(container.querySelectorAll('div[class*="rounded-card"]')).filter(
        (el) => (el.textContent ?? "").includes(titel),
      );
      if (karten.length !== 1) {
        throw new Error(`Genau eine Karte mit „${titel}" erwartet, ${karten.length} gefunden.`);
      }
      return beschriftungen(karten[0] as ParentNode);
    },
    abbauen() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}
