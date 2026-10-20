// @vitest-environment jsdom
// AW04/PV05-03: echter Gesprächsclient und Auth-Sitzung über InMemory-App/HTTP im selben Prozess.
// Nur fiktive gespeicherte Antwortbelege. Kein ask/Modell/Provider/Listener/Browser/Office.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { KlaraVorschau } from "../../apps/web/src/components/klara-vorschau/KlaraVorschau";
import {
  einwilligen,
  fadenAus,
  hilfe,
  leseEcht,
  pruefeEcht,
  vergiss,
} from "../../apps/web/src/components/klara-vorschau/echt";
import {
  fuegeAbgewiesenHinzu,
  leseEingabe,
  setzeEingabe,
} from "../../apps/web/src/components/klara-vorschau/eingabe";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { rechtekontextZuruecksetzen } from "../../apps/web/src/lib/rechtekontext";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { KlaraGespraech } from "../../services/app/src/klara-gespraech";
import { type AnswerEvidenceSnapshot, hashAnswerSnapshot } from "../../services/ask";
import { bis, klick, medienStub, q, ruhe } from "../fe003-tutorial-fragen/huelle";

const BASIS = "/api/me/klara/gespraeche";
const MARKE = "Fiktive-AW04-Clientquelle-Nord";
const MISCHTEXT = `${MARKE}: Druckwert 73; allgemeine Empfehlung: regelmäßig prüfen.`;
const EIGEN = "Meine freie eigene Arbeitsnotiz für morgen.";
const FREI = { pfad: "/fragen", seitenName: "Fragen", objekt: "Eigene Frage" };
const PASSWORT = "Aw04-fiktives-Kennwort-3";
type Konto = { id: string; token: string };
let services: ReturnType<typeof assembleServices>;
let app: ReturnType<typeof buildApp>;
let anna: Konto;
let admin: Konto;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient;
let container: HTMLDivElement;
let nachAntwort: ((pfad: string, methode: string, r: Response) => Promise<Response>) | null = null;
const abrufe: { pfad: string; status: number; rechte: string | null }[] = [];

async function auf(
  wer: Konto | null,
  method: "GET" | "POST" | "PUT",
  url: string,
  payload?: Record<string, unknown>,
) {
  return app.inject({
    method,
    url,
    headers: wer ? { authorization: `Bearer ${wer.token}` } : {},
    ...(payload ? { payload } : {}),
  });
}
async function anmelden(email: string): Promise<Konto> {
  const r = await auf(null, "POST", "/api/auth/login", { email, password: PASSWORT });
  expect(r.statusCode, r.body).toBe(200);
  const token = r.json<{ token: string }>().token;
  const me = await app.inject({
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(me.statusCode, me.body).toBe(200);
  return { id: me.json<{ id: string }>().id, token };
}

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  vergiss();
  zuruecksetzenGanz();
  rechtekontextZuruecksetzen();
  medienStub();
  await i18n.changeLanguage("de");
  abrufe.length = 0;
  nachAntwort = null;
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  expect(
    (
      await auf(null, "POST", "/api/auth/register", {
        name: "AW04 Admin",
        email: "admin-client@klarwerk.test",
        password: PASSWORT,
      })
    ).statusCode,
  ).toBe(201);
  admin = await anmelden("admin-client@klarwerk.test");
  expect(
    (
      await auf(admin, "POST", "/api/users", {
        name: "Anna fiktiv",
        email: "anna-client@klarwerk.test",
        password: PASSWORT,
        role: "experte",
      })
    ).statusCode,
  ).toBe(201);
  anna = await anmelden("anna-client@klarwerk.test");
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const pfad =
        new URL(url, "http://klarwerk.test").pathname + new URL(url, "http://klarwerk.test").search;
      if (!url.startsWith("/api/") || pfad.startsWith("/api/ask"))
        throw new Error("Kein externer, Modell- oder Ask-Aufruf in dieser Clientprobe.");
      const methode = init?.method ?? "GET";
      if (methode !== "GET" && methode !== "POST" && methode !== "PUT" && methode !== "DELETE")
        throw new Error("Nicht benötigte Methode");
      const r = await app.inject({
        method: methode,
        url: pfad,
        headers: {
          authorization: `Bearer ${anna.token}`,
          ...Object.fromEntries(new Headers(init?.headers)),
        },
        ...(typeof init?.body === "string" ? { payload: init.body } : {}),
      });
      const headers = new Headers();
      for (const [k, v] of Object.entries(r.headers))
        if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
      abrufe.push({ pfad, status: r.statusCode, rechte: headers.get("x-klarwerk-rechtekontext") });
      const antwort = new Response(r.statusCode === 204 ? null : r.body, {
        status: r.statusCode,
        headers,
      });
      return nachAntwort ? nachAntwort(pfad, methode, antwort) : antwort;
    },
  );
});
afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  qc?.clear();
  container?.remove();
  vergiss();
  zuruecksetzenGanz();
  rechtekontextZuruecksetzen();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await app.close();
});

async function bestand() {
  const kos = [];
  for (const title of [MARKE, "Freie fiktive Checkliste"]) {
    const ko = await services.ko.create({
      title,
      statement: `${title}: Prüfhinweis.`,
      type: "best_practice",
      category: "AW04 fiktiv",
      confidentiality: "intern",
      author: admin.id,
    });
    await services.ko.setQuellrechte(ko.id, { stufe: "intern", leser: [anna.id] }, admin.id);
    kos.push(ko);
  }
  const geheim = kos[0];
  if (!geheim) throw new Error("Fiktive Quelle fehlt");
  const bezug = {
    pfad: `/wissen/${geheim.id}`,
    seitenName: "Wissen",
    objekt: MARKE,
    koId: geheim.id,
    fassung: geheim.version,
  };
  const r = await auf(anna, "POST", BASIS, { objektbezug: bezug });
  expect(r.statusCode, r.body).toBe(201);
  const id = r.json<{ gespraech: KlaraGespraech }>().gespraech.id;
  expect(
    (await auf(anna, "PUT", `${BASIS}/${id}/einwilligung`, { erteilt: true })).statusCode,
  ).toBe(200);
  expect(
    (
      await auf(anna, "POST", `${BASIS}/${id}/nachrichten`, {
        von: "du",
        modus: "frage",
        text: EIGEN,
        objektbezug: FREI,
      })
    ).statusCode,
  ).toBe(201);
  const antwortId = `aw04-client-${id}`;
  expect(
    await services.answerSnapshots.createRecord({
      answerId: antwortId,
      askExecutionId: `lauf-${id}`,
      createdAt: new Date().toISOString(),
      schemaVersion: 1,
      owner: { kind: "user", userId: anna.id },
    }),
  ).toBe(true);
  const snapshot: AnswerEvidenceSnapshot = {
    answerId: antwortId,
    snapshotRevision: 1,
    supersedesSnapshotRevision: null,
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    citedSources: kos.map((k) => k.id),
    evidence: kos.map((k) => ({
      knowledgeObjectId: k.id,
      knowledgeObjectVersion: k.version,
      evidenceRole: "carrying",
      sourceRecordId: null,
      sourceRecordIdReason: "no_source_anchor",
      locator: null,
      locatorReason: "no_source_anchor",
      validationReferenceAbsenceReason: "NOT_AVAILABLE_AT_EXECUTION",
    })),
    resolutionId: null,
    resolutionIdReason: "w1_not_on_answer_path",
    validationDecisionRef: null,
    validationDecisionRefReason: "w3_23_ref_liegt_je_evidence",
    status: "INCOMPLETE",
    integrityHash: "",
    generationMode: "deterministic",
  };
  expect(
    await services.answerSnapshots.appendSnapshot({
      ...snapshot,
      integrityHash: hashAnswerSnapshot(snapshot),
    }),
  ).toBe(true);
  expect(
    (
      await auf(anna, "POST", `${BASIS}/${id}/nachrichten`, {
        von: "klara",
        modus: "ohne_ki",
        text: MISCHTEXT,
        objektbezug: bezug,
        antwortId,
        quellen: kos.map((k) => k.id),
        quellenAngaben: kos.map((k) => ({
          koId: k.id,
          titel: k.title,
          fassung: k.version,
          geprueft: false,
        })),
      })
    ).statusCode,
  ).toBe(201);
  return { id, geheim, antwortId };
}
async function montiere() {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/fragen"] },
                  createElement<NonNullable<Parameters<typeof KlaraVorschau>[0]>>(KlaraVorschau, {
                    betriebsart: "produkt",
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await bis(() => Boolean(q(document, "klara-figur")), 160);
  await klick(q(document, "klara-figur"));
  await bis(() => leseEcht().laden === "bereit", 160);
  await ruhe();
}

async function entziehen(b: Awaited<ReturnType<typeof bestand>>) {
  await services.ko.setQuellrechte(b.geheim.id, { stufe: "intern", leser: [] }, admin.id);
  expect((await auf(anna, "GET", `/api/kos/${b.geheim.id}`)).statusCode).toBe(404);
}

/** Nur die fertige lokale HTTP-Antwort anhalten, keine fremden Netze oder Dienste. */
function halteNaechsteAntwort(pfad: string, methode = "GET", transportFehler = false) {
  let inhalt = "";
  let hinein: () => void = () => {};
  let weiter: () => void = () => {};
  const eingetreten = new Promise<void>((resolve) => {
    hinein = resolve;
  });
  const freigabe = new Promise<void>((resolve) => {
    weiter = resolve;
  });
  nachAntwort = async (p, m, r) => {
    if (p !== pfad || m !== methode) return r;
    nachAntwort = null;
    inhalt = await r.clone().text();
    hinein();
    await freigabe;
    return transportFehler
      ? new Response(
          JSON.stringify({ error: "INTERNAL", message: "Fiktive verzögerte Transportgegenprobe" }),
          { status: 503 },
        )
      : r;
  };
  return { eingetreten, weiter, inhalt: () => inhalt };
}

it("CE1: älteres erlaubtes GET darf neueres bereinigtes Einwilligungsecho mit denselben Nachrichten-IDs nicht zurücksetzen", async () => {
  const b = await bestand();
  await montiere();
  expect(document.body.textContent).toContain(MISCHTEXT);
  const ids = leseEcht().nachrichten.map((n) => n.id);
  const h = halteNaechsteAntwort(`${BASIS}/${b.id}`);
  const alt = pruefeEcht(anna.id, i18n.t);
  try {
    await h.eingetreten;
    expect(h.inhalt()).toContain(MISCHTEXT); // Tatsächlich noch erlaubte fertige HTTP-Antwort.
    await entziehen(b);
    await act(async () => {
      expect(await einwilligen(false, FREI, i18n.t)).toBe(true);
    });
    expect(leseEcht().nachrichten.map((n) => n.id)).toEqual(ids);
    expect(document.body.textContent).not.toContain(MARKE);
    expect(document.body.textContent).toContain(EIGEN);
  } finally {
    h.weiter();
    await act(async () => {
      await alt;
    });
  }
  expect(document.body.textContent).not.toContain(MARKE);
  expect(document.body.textContent).not.toContain("Druckwert 73");
  expect(leseEcht().nachrichten.map((n) => n.id)).toEqual(ids);
  expect(document.body.textContent).toContain(EIGEN);
  expect(leseEcht().laden).toBe("bereit");
});

it("CE1: bereits angenommenes bereinigtes Echo bleibt bereit, auch wenn der ältere GET danach scheitert", async () => {
  const b = await bestand();
  await montiere();
  const h = halteNaechsteAntwort(`${BASIS}/${b.id}`, "GET", true);
  const alt = pruefeEcht(anna.id, i18n.t);
  try {
    await h.eingetreten;
    expect(h.inhalt()).toContain(MISCHTEXT);
    await entziehen(b);
    await act(async () => {
      expect(await einwilligen(false, FREI, i18n.t)).toBe(true);
    });
    expect(leseEcht().laden).toBe("bereit");
  } finally {
    h.weiter();
    await act(async () => {
      await alt;
    });
  }
  expect(leseEcht().laden).toBe("bereit");
  expect(leseEcht().ladeFehler).toBeNull();
  expect(document.body.textContent).not.toContain(MARKE);
});

it("CE1: altes Nachrichten-Echo nach neuerer Bereinigung stellt keine Alttexte wieder her und erhält lokale eigene Arbeit", async () => {
  const b = await bestand();
  await montiere();
  act(() => {
    setzeEingabe(anna.id, "Eigener CE1-Entwurf");
    expect(fuegeAbgewiesenHinzu(anna.id, "Eigener abgewiesener CE1-Entwurf", null)).toBe(true);
  });
  const entwurf = sessionStorage.getItem("klarwerk.assistenz.eingabe");
  const h = halteNaechsteAntwort(`${BASIS}/${b.id}/nachrichten`, "POST");
  const eigeneBitte = "Meine neue eigene CE1-Bitte";
  const alt = hilfe(eigeneBitte, "Freie CE1-Hilfe", FREI);
  let zweite: ReturnType<typeof halteNaechsteAntwort> | null = null;
  try {
    await h.eingetreten;
    expect(h.inhalt()).toContain(MISCHTEXT);
    await entziehen(b);
    await act(async () => {
      expect(await einwilligen(false, FREI, i18n.t)).toBe(true);
    });
    expect(document.body.textContent).not.toContain(MARKE);
    zweite = halteNaechsteAntwort(`${BASIS}/${b.id}/nachrichten`, "POST");
    h.weiter();
    await zweite.eingetreten;
    await ruhe();
    expect(document.body.textContent).not.toContain(MARKE);
    expect(leseEingabe()).toBe("Eigener CE1-Entwurf");
    expect(sessionStorage.getItem("klarwerk.assistenz.eingabe")).toBe(entwurf);
    expect(fadenAus(leseEcht().nachrichten)).toContain(EIGEN);
  } finally {
    h.weiter();
    zweite?.weiter();
    await act(async () => {
      await alt;
    });
  }
  expect(leseEcht().nachrichten.filter((n) => n.text === eigeneBitte)).toHaveLength(1);
  expect(document.body.textContent).not.toContain(MARKE);
  expect(leseEcht().laden).toBe("bereit");
});

it("CE1: auch ein für altes Echo begonnenes Nachlesen darf eine danach angenommene Wiedererteilung nicht zurücksetzen", async () => {
  const b = await bestand();
  await montiere();
  const echo = halteNaechsteAntwort(`${BASIS}/${b.id}/einwilligung`, "PUT");
  const alt = einwilligen(true, FREI, i18n.t);
  let nachlesen: ReturnType<typeof halteNaechsteAntwort> | null = null;
  try {
    await echo.eingetreten;
    expect(echo.inhalt()).toContain(MISCHTEXT);
    await entziehen(b);
    await act(async () => {
      expect(await einwilligen(false, FREI, i18n.t)).toBe(true);
    });
    nachlesen = halteNaechsteAntwort(`${BASIS}/${b.id}`);
    echo.weiter();
    await nachlesen.eingetreten;
    expect(nachlesen.inhalt()).not.toContain(MARKE);
    await services.ko.setQuellrechte(b.geheim.id, { stufe: "intern", leser: [anna.id] }, admin.id);
    await act(async () => {
      expect(await einwilligen(true, FREI, i18n.t)).toBe(true);
    });
    expect(document.body.textContent).toContain(MISCHTEXT);
  } finally {
    echo.weiter();
    nachlesen?.weiter();
    await act(async () => {
      await alt;
    });
  }
  expect(document.body.textContent).toContain(MISCHTEXT);
  expect(leseEcht().gespraech?.einwilligungAm).not.toBeNull();
  expect(leseEcht().laden).toBe("bereit");
});
