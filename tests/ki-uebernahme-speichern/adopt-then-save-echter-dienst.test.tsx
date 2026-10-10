// @vitest-environment jsdom
// ================================================================================================
// KI-UEBERNAHME-SPEICHERN — DER SERVER-/PERSISTENZBELEG ZUM FIX AUS JOB 3408.
// ================================================================================================
//
// Bens Befund (Auftrag gesamt-entwurf-datenerhalt, Runde 1): `adopt-then-save.test.tsx` belegt die
// Klickfolge, die ausgehende Nutzlast, Doppelklickschutz, Fehlerfreigabe und Wiederöffnen — aber
// gegen eine selbst gebaute Map-Attrappe. Der Weg „neuer Inhalt im Server-/Persistenzbeleg →
// normales Wiederöffnen" fehlte.
//
// HIER IST ECHT: die gemountete Vordertür (`CaptureFrontDoor` → `Blatt`), der echte Client
// (`api/client.ts`, `endpoints`), die echte Fastify-Anwendung mit echter Anmeldung, echten
// Entwurfsrouten und dem echten Entwurfsdienst (`buildServices()`, In-Memory-Ablage). Transport wie
// in `tests/capture/job2705-drei-wege-textverlust.test.tsx`: `globalThis.fetch` liegt auf
// `app.inject`.
//
// EINZIGER ERSATZ: das SPRACHMODELL. `POST /api/reasoner` und `GET /api/reasoner/status` antworten
// an der Brücke mit einem festen Vorschlag — ohne Schlüssel gibt es kein Modell, und ein Vorschlag
// `received` ist genau das, was Codex live bekommen hat. Alles, was geschrieben und gelesen wird,
// läuft durch den Server.
//
// GEMESSEN WIRD AM SERVER: nach dem zweiten Sichern liefert `GET /api/drafts/:id` die Korrektur
// und ein neueres `updatedAt` — Codex' Live-Beleg war genau das Gegenteil (updatedAt unverändert,
// `recieved` stand weiter da).
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let app: FastifyInstance;
let token = "";
let vorherigerFetch: typeof globalThis.fetch;

/** Was das Modell vorschlägt — gesetzt je Fall. */
const modell: {
  assistText: string;
  strukturTitel: string;
  strukturWissensart?: string | undefined;
} = {
  assistText: "",
  strukturTitel: "",
};
/** Jeder Schreibaufruf, der den SERVER erreicht hat (Methode + Pfad). */
let schreibaufrufe: { methode: string; url: string }[] = [];
/** Hält das Anlegen am Server fest, bis der Test es freigibt (Doppelklickfall). */
let postBarriere: { warten: Promise<void>; oeffnen: () => void } | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function json(status: number, rumpf: unknown) {
  const text = JSON.stringify(rumpf);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    text: async () => text,
  };
}

/** Die Antwort des Modells — und nur sie steht nicht auf dem Server. */
function modellAntwort(url: string, methode: string, rumpf: string | undefined) {
  const pfad = url.split("?")[0] ?? url;
  if (methode === "GET" && pfad.endsWith("/reasoner/status")) {
    return json(200, { active: true, mode: "cloud", reachable: "active" });
  }
  if (methode === "POST" && pfad.endsWith("/reasoner")) {
    const auftrag = JSON.parse(rumpf ?? "{}") as { task?: string };
    if (auftrag.task === "assist") {
      return json(200, { text: modell.assistText, demo: false });
    }
    if (auftrag.task === "structure") {
      return json(200, {
        title: modell.strukturTitel,
        statement: "Ventil vor der Wartung entlasten.",
        conditions: [],
        measures: [],
        tags: [],
        confidence: 70,
        ...(modell.strukturWissensart ? { knowledgeType: modell.strukturWissensart } : {}),
        demo: false,
      });
    }
  }
  return null;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  modell.assistText = "";
  modell.strukturTitel = "";
  modell.strukturWissensart = undefined;
  schreibaufrufe = [];
  postBarriere = null;
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    const rumpf = init?.body !== undefined && init.body !== null ? String(init.body) : undefined;
    const ersatz = modellAntwort(url, methode, rumpf);
    if (ersatz) {
      return ersatz;
    }
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      headers[name] = wert;
    });
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    if (url.includes("/drafts") && (methode === "POST" || methode === "PUT")) {
      schreibaufrufe.push({ methode, url });
      if (postBarriere && methode === "POST") {
        await postBarriere.warten;
      }
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers,
      ...(rumpf !== undefined ? { payload: rumpf } : {}),
    });
    return {
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;

  app = buildApp(buildServices());
  await app.ready();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@ki-uebernahme.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@ki-uebernahme.test", password: "geheim12345" },
  });
  token = (JSON.parse(login.body) as { token: string }).token;
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(async () => {
  globalThis.fetch = vorherigerFetch;
  if (root) {
    const wurzel = root;
    act(() => wurzel.unmount());
    container.remove();
    root = null;
  }
  await app.close();
});

async function seiteOeffnen(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const wurzel = createRoot(container);
  root = wurzel;
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
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: [pfad] },
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
                        path: "/erfassen",
                        element: createElement(CaptureFrontDoor),
                      }),
                    ),
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

function seiteSchliessen(): void {
  const wurzel = root;
  if (wurzel) {
    act(() => wurzel.unmount());
    container.remove();
    root = null;
  }
}

/** Serverstand über die öffentliche Route — derselbe Weg, den Codex lesend gegangen ist. */
async function serverEntwurf(id: string): Promise<{
  updatedAt?: string;
  payload: { title?: string; bodyHtml?: string | null; type?: string };
}> {
  const res = await app.inject({
    method: "GET",
    url: `/api/drafts/${id}`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.statusCode, res.body.slice(0, 300)).toBe(200);
  return JSON.parse(res.body);
}

async function einzigeEntwurfsId(): Promise<string> {
  const res = await app.inject({
    method: "GET",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${token}` },
  });
  const liste = JSON.parse(res.body) as { id: string }[];
  expect(liste, "genau ein Entwurf beim Server").toHaveLength(1);
  return liste[0]?.id ?? "";
}

function sichernKnopf(): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>('[data-testid="blatt-entwurf-sichern"]');
  if (!btn) {
    throw new Error("Der Knopf „Entwurf sichern“ ist nicht auf dem Blatt.");
  }
  return btn;
}

function knopfMit(teil: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}“ nicht gefunden`);
  }
  return btn;
}

async function klick(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
  await act(flush);
}

async function schreibeInsBlatt(html: string): Promise<void> {
  const editor = container.querySelector('[contenteditable="true"]');
  if (!editor) {
    throw new Error("Die Schreibfläche fehlt.");
  }
  await act(async () => {
    editor.innerHTML = html;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

function editorHtml(): string {
  return container.querySelector("[contenteditable]")?.innerHTML ?? "";
}

function titelfeld(): HTMLInputElement {
  const el = container.querySelector('[data-testid="blatt-titel"]');
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("Titelfeld nicht gefunden");
  }
  return el;
}

async function kiWeg(eintrag: string): Promise<void> {
  const werkzeug = container.querySelector<HTMLButtonElement>('[data-testid="blatt-werkzeug-ki"]');
  if (!werkzeug) {
    throw new Error("Das Menü „KI“ ist nicht auf dem Blatt.");
  }
  await klick(werkzeug);
  await klick(knopfMit(eintrag));
}

/** Codex' Weg in echter Reihenfolge; gibt die Server-Kennung und den ersten Serverstand zurück. */
async function sichernUebernehmenSichern(
  text: string,
): Promise<{ id: string; ersterStand: string | undefined }> {
  await seiteOeffnen("/erfassen");
  await schreibeInsBlatt(text);

  await klick(sichernKnopf());
  const id = await einzigeEntwurfsId();
  const erster = await serverEntwurf(id);
  expect(String(erster.payload.bodyHtml)).toContain("recieved");

  await kiWeg(i18n.t("capture.ai.action.spelling"));
  await klick(knopfMit(i18n.t("fd.accept")));
  // Voraussetzung, nicht Beleg: der Editor zeigt die Korrektur.
  expect(editorHtml()).toContain("received");

  await klick(sichernKnopf());
  return { id, ersterStand: erster.updatedAt };
}

describe("KI-UEBERNAHME-SPEICHERN · Beleg am echten Server und am Wiederöffnen", () => {
  it("S1 — sichern → Rechtschreibung übernehmen → sichern: der Server trägt die Korrektur, das Wiederöffnen zeigt sie", async () => {
    modell.assistText = "Wir haben die Lieferung received.";
    const { id, ersterStand } = await sichernUebernehmenSichern(
      "<p>Wir haben die Lieferung recieved.</p>",
    );

    expect(schreibaufrufe.map((a) => a.methode)).toEqual(["POST", "PUT"]);
    const zweiter = await serverEntwurf(id);
    expect(String(zweiter.payload.bodyHtml)).toContain("received");
    expect(String(zweiter.payload.bodyHtml)).not.toContain("recieved");
    expect(zweiter.updatedAt, "updatedAt blieb stehen — der zweite Save kam nie an").not.toBe(
      ersterStand,
    );

    // Normales Wiederöffnen: neue Fläche, Ladeweg über die Adresse.
    seiteSchliessen();
    await seiteOeffnen(`/erfassen?draft=${id}`);
    expect(editorHtml()).toContain("received");
    expect(editorHtml()).not.toContain("recieved");
  }, 30000);

  it("S2 — derselbe Weg in der englischen Oberfläche (Codex' Live-Lage)", async () => {
    await i18n.changeLanguage("en");
    modell.assistText = "We have received the delivery.";
    const { id } = await sichernUebernehmenSichern("<p>We have recieved the delivery.</p>");

    const zweiter = await serverEntwurf(id);
    expect(String(zweiter.payload.bodyHtml)).toContain("received");
    expect(String(zweiter.payload.bodyHtml)).not.toContain("recieved");
    seiteSchliessen();
    await seiteOeffnen(`/erfassen?draft=${id}`);
    expect(editorHtml()).toContain("received");
  }, 30000);

  it("S3 — Struktur-/Titelübernahme analog: der Server trägt den übernommenen Titel", async () => {
    modell.strukturTitel = "Ventil vor der Wartung entlasten";
    await seiteOeffnen("/erfassen");
    await schreibeInsBlatt("<p>ventil entlasten vor wartung</p>");
    await klick(sichernKnopf());
    const id = await einzigeEntwurfsId();
    const ersterTitel = (await serverEntwurf(id)).payload.title;
    expect(ersterTitel).not.toBe(modell.strukturTitel);

    await kiWeg(i18n.t("erfassen.ki.struktur"));
    await klick(knopfMit(i18n.t("fd.accept")));
    await klick(sichernKnopf());

    expect(schreibaufrufe.map((a) => a.methode)).toEqual(["POST", "PUT"]);
    expect((await serverEntwurf(id)).payload.title).toContain("Ventil vor der Wartung");
    seiteSchliessen();
    await seiteOeffnen(`/erfassen?draft=${id}`);
    expect(titelfeld().value).toContain("Ventil vor der Wartung");
  }, 30000);

  // FR-STR-01 / R-0315 (Bens Befund Nacharbeit 2): im Ordnen-Hauptweg ging die vorgeschlagene
  // Wissensart bei „Übernehmen" verloren. Jetzt steht sie in der Vorschlagskarte, der Mensch
  // korrigiert sie dort, und genau seine Wahl erreicht den gespeicherten Entwurf am echten Server.
  it("S4 — Ordnen: vorgeschlagene Wissensart korrigieren, übernehmen, sichern → der Server trägt die Wahl", async () => {
    modell.strukturTitel = "Ventil vor der Wartung entlasten";
    modell.strukturWissensart = "negativwissen";
    await seiteOeffnen("/erfassen");
    await schreibeInsBlatt("<p>ventil entlasten vor wartung</p>");

    await kiWeg(i18n.t("erfassen.ki.struktur"));
    const auswahl = container.querySelector<HTMLSelectElement>(
      '[data-testid="blatt-ki-vorschlag-wissensart"] select',
    );
    if (!auswahl) {
      throw new Error("Die Wissensart-Auswahl fehlt in der Vorschlagskarte.");
    }
    expect(auswahl.value, "der KI-Vorschlag steht vorbelegt").toBe("negativwissen");
    await act(async () => {
      auswahl.value = "technik";
      auswahl.dispatchEvent(new Event("change", { bubbles: true }));
      await flush();
    });
    await klick(knopfMit(i18n.t("fd.accept")));
    await klick(sichernKnopf());

    expect(schreibaufrufe.map((a) => a.methode)).toEqual(["POST"]);
    const id = await einzigeEntwurfsId();
    const gespeichert = await serverEntwurf(id);
    expect(gespeichert.payload.type, "die menschliche Korrektur gilt").toBe("technik");
  }, 30000);

  it("S5 — Ordnen über einem Entwurf mit gespeicherter Wissensart: der Vorschlag ersetzt sie nicht", async () => {
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: "ventil entlasten",
        statement: "ventil entlasten vor wartung",
        bodyHtml: "<p>ventil entlasten vor wartung</p>",
        type: "lernkurve",
        category: "Allgemein",
        origin: "frontdoor",
      },
    });
    expect(angelegt.statusCode, angelegt.body.slice(0, 300)).toBe(201);
    const id = (JSON.parse(angelegt.body) as { id: string }).id;
    schreibaufrufe = [];

    modell.strukturTitel = "Ventil vor der Wartung entlasten";
    modell.strukturWissensart = "negativwissen";
    await seiteOeffnen(`/erfassen?draft=${id}`);
    await kiWeg(i18n.t("erfassen.ki.struktur"));
    const karte = container.querySelector('[data-testid="blatt-ki-vorschlag-wissensart"]');
    expect(karte?.querySelector("select")?.value, "die geladene Entscheidung geht vor").toBe(
      "lernkurve",
    );
    const kiNennung = karte?.querySelector('[data-testid="blatt-ki-vorschlag-wissensart-ki"]');
    expect(kiNennung?.textContent ?? "", "der KI-Vorschlag wird nur genannt").toContain(
      i18n.t("ktype.negativwissen"),
    );
    await klick(knopfMit(i18n.t("fd.accept")));
    await klick(sichernKnopf());

    expect(schreibaufrufe.map((a) => a.methode)).toEqual(["PUT"]);
    expect((await serverEntwurf(id)).payload.type).toBe("lernkurve");
  }, 30000);

  it("G1 — Doppelklick während des laufenden Anlegens: der Server bekommt genau EINEN Schreibaufruf", async () => {
    let oeffnen = (): void => {};
    const warten = new Promise<void>((r) => {
      oeffnen = r;
    });
    postBarriere = { warten, oeffnen };
    await seiteOeffnen("/erfassen");
    await schreibeInsBlatt("<p>Ein Satz, der gesichert werden will.</p>");

    const knopf = sichernKnopf();
    await act(async () => {
      knopf.click();
      knopf.click();
      await flush();
    });
    expect(sichernKnopf().disabled, "der laufende Vorgang steht sichtbar am Knopf").toBe(true);
    await act(async () => {
      postBarriere?.oeffnen();
      await flush();
    });
    await act(flush);

    expect(schreibaufrufe).toHaveLength(1);
    await einzigeEntwurfsId();
    expect(sichernKnopf().disabled).toBe(false);
  }, 30000);
});
