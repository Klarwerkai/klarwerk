// @vitest-environment jsdom
// ================================================================================================
// JOB 2613 · D5 — DIE KETTE DURCH DIE ECHTE ENTWURFSANSICHT.
// ================================================================================================
//
// BENs Rotgrund zu D4, wörtlich:
//
//   „Der D4-Test VERBINDET DEN SERVER-GET SELBST mit <SanitizedHtml> und belegt deshalb nicht den
//    produktiven Clientabruf und die Verdrahtung des gespeicherten Entwurfs in der tatsächlichen
//    Draft-Ansicht."
//
// Er hat recht, und der Fehler hat einen Namen: **Der Test hatte sich seine eigene Verkabelung
// gebaut.** Er holte den Entwurf per app.inject und reichte das bodyHtml selbst an die
// Renderkomponente. Damit prüfte er, dass MEINE Verkabelung funktioniert — nicht die des Produkts.
//
// DIESELBE REGEL WIE IN 2618 D2: Der Prüfgegenstand muss die Sache selbst sein, nicht ein Nachbau,
// den der Test im selben Atemzug herstellt.
//
// HIER HOLT DIE ANSICHT SELBST. Die Kette, Glied für Glied:
//
//     .docx-Bytes → POST /api/drafts/from-docx → capture.createDraft → gespeicherter Entwurf
//       → <CaptureFrontDoor> gemountet mit ?draft=<id>
//       → deren useEffect ruft endpoints.drafts.get(id)          (CaptureFrontDoor.tsx:318-319)
//       → api.get → fetch                                        (api/client.ts:24)
//       → setBodyHtml(frontDoorBodyFromDraft(draft.payload))     (CaptureFrontDoor.tsx:325, 332)
//       → <RichTextEditor value={bodyHtml}>                      (CaptureFrontDoor.tsx:901-902)
//       → beide Bilder EINZELN im DOM
//
// WAS DER TEST NOCH TUT: hinsehen. Er ruft endpoints.drafts.get NICHT selbst und mockt es NICHT.
//
// WAS ERSETZT IST, und warum das kein zweiter Nachbau ist: `globalThis.fetch` zeigt auf
// `app.inject` derselben echten App. Das ist der TRANSPORT, nicht die Verkabelung — die Kette
// Komponente → endpoints → api.get → fetch läuft vollständig im Produktcode. Ein echter TCP-Server
// wäre der einzige noch tiefere Aufbau, und er ist in dieser Bahn nicht herstellbar: Ein
// Horchsocket auf 127.0.0.1 wird von der Sandbox mit `listen EPERM` abgewiesen (in JOB 2487 D3
// isoliert nachgewiesen). Der Ersatz ist an EINER Stelle und ausdrücklich benannt.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import "../../apps/web/src/i18n";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom kennt <dialog>.showModal nicht — derselbe minimale Polyfill wie in
// tests/capture/mega69-bildweg-mounted.test.tsx:76-88.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};
Object.defineProperty(HTMLDialogElement.prototype, "open", {
  configurable: true,
  get(this: HTMLDialogElement) {
    return this.hasAttribute("open");
  },
});

/** 1×1-PNG, rot. */
const PNG_ROT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
/** 1×1-PNG, blau — bewusst ANDERE Bytes. */
const PNG_BLAU =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/** Echte .docx: ein Textabsatz und zwei eingebettete PNGs (rot, blau). */
const DOCX_MIT_ZWEI_BILDERN =
  "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";

/** Dieselbe Bauart, aber OHNE Bildteile — die Gegenprobe. */
const DOCX_OHNE_BILDER =
  "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";

const ZUGANG = { name: "Admin", email: "a@x.de", password: "secret123" };

type App = ReturnType<typeof buildApp>;

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

/**
 * Legt über die ECHTE Route einen Entwurf an und haengt `fetch` an dieselbe App.
 *
 * Der Rueckgabewert ist nur die Entwurfs-Id — mehr braucht der Test nicht, denn das bodyHtml holt
 * die Ansicht selbst.
 */
async function entwurfAusDocx(docx: string): Promise<{ app: App; id: string }> {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  const token = login.json().token as string;

  const angelegt = await app.inject({
    method: "POST",
    url: "/api/drafts/from-docx",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "BAADER-Sonde.docx", data: docx },
  });
  if (angelegt.statusCode !== 201) {
    throw new Error(`Route lieferte ${angelegt.statusCode}`);
  }

  // DER TRANSPORT — und nur er. Der Client baut Pfad, Methode und Kopf selbst; hier wird die
  // Anfrage an dieselbe App weitergereicht, an die auch der Entwurf ging.
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const pfad = String(eingabe);
    const antwort = await app.inject({
      method: (init?.method ?? "GET") as "GET",
      url: pfad,
      headers: { ...(init?.headers as Record<string, string>), authorization: `Bearer ${token}` },
      ...(init?.body ? { payload: JSON.parse(String(init.body)) } : {}),
    });
    return new Response(antwort.body, {
      status: antwort.statusCode,
      headers: { "content-type": antwort.headers["content-type"] as string },
    });
  }) as typeof fetch;

  return { app, id: angelegt.json().id as string };
}

let container: HTMLDivElement;

/** Mountet die ECHTE Entwurfsansicht unter der Route, die auch das Panel verlinkt. */
async function ansichtMounten(draftId: string): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const wurzel = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            ToastProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [`/capture/frontdoor?draft=${draftId}`] },
              createElement(
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/capture/frontdoor",
                      element: createElement(CaptureFrontDoor),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  // Der Abruf der Ansicht ist asynchron — auf ihn warten, statt ihn zu ersetzen.
  for (let i = 0; i < 40 && container.querySelectorAll("img").length === 0; i += 1) {
    await act(async () => {
      await new Promise((f) => setTimeout(f, 25));
    });
  }
  return container;
}

/** Die einzelnen eingebetteten Bilddaten im DOM — Base64-Rumpf je <img>. */
function bilderImDom(behaelter: HTMLElement): string[] {
  return [...behaelter.querySelectorAll("img")]
    .map((b) => /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(b.getAttribute("src") ?? "")?.[1])
    .filter((x): x is string => Boolean(x));
}

describe("JOB 2613 · A · DURCH DIE ECHTE ENTWURFSANSICHT", () => {
  it("A1 · die Ansicht holt den Entwurf selbst und zeigt beide Bilder einzeln", async () => {
    const { id } = await entwurfAusDocx(DOCX_MIT_ZWEI_BILDERN);
    const dom = await ansichtMounten(id);

    const gesehen = bilderImDom(dom);
    expect(gesehen, "Die Entwurfsansicht zeigt kein einziges Bild").toHaveLength(2);
    // BILD FÜR BILD — jedes gegen seine eigenen Bytes, wie in D4.
    expect(gesehen[0], "Das ERSTE Bild (rot) fehlt in der Ansicht").toBe(PNG_ROT);
    expect(gesehen[1], "Das ZWEITE Bild (blau) fehlt in der Ansicht").toBe(PNG_BLAU);
    expect(new Set(gesehen).size, "Beide Bilder tragen dieselben Bytes").toBe(2);
    // Und der Text der Quelle steht daneben — die Ansicht zeigt den Entwurf, nicht nur Bilder.
    expect(dom.textContent ?? "").toContain("BAADER Sonde Station 1");
  });

  it("A2 · DIE GEGENPROBE: ohne Bilder in der Quelle zeigt die Ansicht auch keines", async () => {
    // §3 des Auftrags: „ein Lauf, der zeigt, dass ein fehlendes Bild in dieser Ansicht auch
    // wirklich auffaellt." Dieselbe Ansicht, derselbe Weg — nur traegt die Quelle keine Bilder.
    const { id } = await entwurfAusDocx(DOCX_OHNE_BILDER);
    const dom = await ansichtMounten(id);

    expect(bilderImDom(dom), "Die Ansicht zeigt ein Bild, das in der Quelle fehlt").toHaveLength(0);
    expect(dom.textContent ?? "").toContain("BAADER Sonde Station 1");
  });

  it("A3 · der Test verkabelt nichts: die Ansicht ruft den Abruf selbst", async () => {
    // Die Zusicherung, die BENs Einwand beantwortet. Gezaehlt wird, wie oft der PRODUKTIVE
    // Clientabruf ueber fetch an /api/drafts/<id> geht — ausgeloest von der Ansicht, nicht
    // vom Test. Waere die Verkabelung wieder im Test, bliebe dieser Zaehler bei 0.
    const { id } = await entwurfAusDocx(DOCX_MIT_ZWEI_BILDERN);
    const echtesFetch = globalThis.fetch;
    const gerufen: string[] = [];
    globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
      gerufen.push(String(eingabe));
      return echtesFetch(eingabe as string, init);
    }) as typeof fetch;

    await ansichtMounten(id);

    expect(
      gerufen.some((p) => p.includes(`/drafts/${id}`)),
      `Die Ansicht hat den Entwurf nicht selbst geholt. Gerufen: ${gerufen.join(", ") || "(nichts)"}`,
    ).toBe(true);
  });
});
