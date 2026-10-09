// @vitest-environment jsdom
// ================================================================================================
// R-0017 / R-0020 / R-0156 — DIESELBEN FÄLLE GEGEN DIE ECHTE ANWENDUNG (Runde 2/3, bens B1/B3).
// ================================================================================================
//
// WAS HIER ECHT IST: die Oberfläche (`CaptureArbeitsraum` in der Hülle dieses Ordners), der echte
// Client (`api/endpoints`, `api/client`), die echte Fastify-Anwendung aus `buildApp` mit ihren
// Routen, `CaptureService.createDraftVorgang` samt Wiederholschlüssel und der Objektspeicher.
// Die Leitung ist `fetch → app.inject` — dieselbe Brücke wie `tests/capture/mega22-vorgang-mounted`.
// Ersetzt sind ausschliesslich die Modellläufe (`reasoner`), die hier nicht vorkommen.
//
// WAS DIE LEITUNG KANN, und nur sie: eine Antwort VERLIEREN, nachdem der Server ausgeführt hat;
// einen Upload ANHALTEN; einen Upload mit 500 SCHEITERN lassen. Die Oberfläche merkt davon nur, was
// ein Browser auch merken würde.
//
// WAS HIER NICHT ECHT IST: kein Browser (jsdom), kein Socket, keine PostgreSQL — die Ablage ist die
// In-Memory-Ablage der Anwendung (`InMemoryDraftRepo.insertIfOperationAbsent`). Die Kette durch
// Chromium und PostgreSQL steht in `speicherknopf-ganzdokument-pg-im-browser.integration.test.ts`
// (Q2–Q5) und läuft nur auf dem Prüfserver.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface AnyRes {
  statusCode: number;
  body: string;
}

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
  /** Die nächste Antwort auf `POST /api/drafts` geht verloren — der Server hat trotzdem angelegt. */
  anlageAntwortVerlieren: false,
  /** Hält `POST /api/objects` an, bis der Riegel aufgeht. */
  uploadTor: null as Promise<void> | null,
  /** Der nächste `POST /api/objects` wird mit 500 beantwortet, OHNE den Server zu erreichen. */
  uploadScheitern: false,
  requests: [] as { method: string; url: string; body: string | undefined }[],
}));

vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      reasoner: {
        ...original.endpoints.reasoner,
        status: vi.fn(async () => ({ active: true, mode: "cloud", reachable: "ok", tasks: {} })),
        config: vi.fn(async () => null),
      },
    },
  };
});

import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  abbauen,
  ansichtWechseln,
  dateiAblegen,
  feld,
  flaeche,
  flush,
  klick,
  mount,
  sichtbar,
  speichernKnopfDa,
  tippe,
  wechselLink,
} from "./huelle";

const DATEI = "bericht.txt";
const TRAEGER_TITEL = "bericht";
const ABSATZ_1 = "Der Dosierwert ist nach jedem Schichtwechsel zu prüfen.";
const ABSATZ_2 = "Ein Wechsel des Filters erfolgt monatlich.";
const DATEITEXT = [ABSATZ_1, ABSATZ_2].join("\n\n");
const ALT_TITEL = "Zahlungsziel";
const ALT_AUSSAGE = "Bei Neukunden gilt Vorkasse, bis die erste Rechnung beglichen ist.";
const NEUER_TITEL = "Zahlungsziel neu";

let riegel: (() => void) | null = null;

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const url = String(input);
    const method = (init.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    bruecke.requests.push({ method, url, body: init.body });
    const istUpload = method === "POST" && /\/api\/objects$/.test(url);
    if (istUpload && bruecke.uploadTor) {
      await bruecke.uploadTor;
    }
    if (istUpload && bruecke.uploadScheitern) {
      bruecke.uploadScheitern = false;
      return {
        ok: false,
        status: 500,
        statusText: "",
        text: async () =>
          JSON.stringify({ error: "INTERNAL", message: "Speicher nicht erreichbar" }),
      };
    }
    const res = await bruecke.app.inject({
      method,
      url,
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    if (bruecke.anlageAntwortVerlieren && method === "POST" && /\/api\/drafts$/.test(url)) {
      // DER ANTWORTVERLUST: der Server HAT angelegt — nur die Antwort kommt nie an.
      bruecke.anlageAntwortVerlieren = false;
      throw new TypeError("Failed to fetch");
    }
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function serverStarten(): Promise<void> {
  bruecke.app = buildApp(buildServices()) as unknown as typeof bruecke.app;
  bruecke.token = "";
  bruecke.anlageAntwortVerlieren = false;
  bruecke.uploadTor = null;
  bruecke.uploadScheitern = false;
  bruecke.requests = [];
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

/** Der Bestand, beim SERVER erfragt — nicht aus Aufrufen abgeleitet. */
async function entwuerfe(): Promise<{ id: string; payload: Record<string, unknown> }[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
}

async function titelzahl(): Promise<Record<string, number>> {
  const zaehler: Record<string, number> = {};
  for (const d of await entwuerfe()) {
    const t = String(d.payload.title ?? "");
    zaehler[t] = (zaehler[t] ?? 0) + 1;
  }
  return zaehler;
}

/** Ein vorhandener Entwurf, über die echte Route angelegt — der „bekannte Inhalt" der Fälle. */
async function altEntwurf(): Promise<string> {
  const res = await bruecke.app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${bruecke.token}` },
    payload: { title: ALT_TITEL, statement: ALT_AUSSAGE, origin: "expert" },
  });
  return (JSON.parse(res.body) as { id: string }).id;
}

function uploads(): number {
  return bruecke.requests.filter((r) => r.method === "POST" && /\/api\/objects$/.test(r.url))
    .length;
}

function anlageSchluessel(): (string | undefined)[] {
  return bruecke.requests
    .filter((r) => r.method === "POST" && /\/api\/drafts$/.test(r.url))
    .map((r) => (JSON.parse(r.body ?? "{}") as { operationId?: string }).operationId);
}

function speicherKnopf(): HTMLButtonElement {
  const gesucht = String(i18n.t("capture.saveDraft"));
  const treffer = [...flaeche().querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").replace(/\s+/g, " ").trim() === gesucht,
  );
  if (!(treffer instanceof HTMLButtonElement)) {
    throw new Error(`Der manuelle Speicherknopf „${gesucht}" steht nicht auf der Fläche.`);
  }
  return treffer;
}

function datei(): File {
  return new File([DATEITEXT], DATEI, { type: "text/plain" });
}

const gesichertSatz = (): string => String(i18n.t(CAPTURE_FILE_TEXT.wholeSaved, { name: DATEI }));

async function formularUndDatei(id: string, wechselweg = false): Promise<void> {
  await mount(`/erfassen?draft=${id}`, "formular", wechselweg);
  await tippe(feld(String(i18n.t("capture.wizard.titleLabel"))), NEUER_TITEL);
  await ansichtWechseln("datei");
  await dateiAblegen(datei());
}

async function uploadAnhalten(): Promise<void> {
  bruecke.uploadTor = new Promise<void>((r) => {
    riegel = r;
  });
}

async function uploadLoslassen(): Promise<void> {
  await act(async () => {
    riegel?.();
    riegel = null;
    bruecke.uploadTor = null;
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  brueckeAufbauen();
  await serverStarten();
});

afterEach(() => {
  abbauen();
  riegel?.();
  riegel = null;
});

describe("R-0017/R-0020/R-0156 · gegen die echte Anwendung (fetch → app.inject)", () => {
  it("A1 · Formular + Datei, ein Druck: beides beim Server, und nach dem Neuladen wieder geöffnet", async () => {
    const id = await altEntwurf();
    await formularUndDatei(id);
    await klick(speicherKnopf());

    const bestand = await entwuerfe();
    expect(bestand.map((d) => d.payload.title).sort()).toEqual([NEUER_TITEL, TRAEGER_TITEL].sort());
    const formular = bestand.find((d) => d.id === id);
    expect(formular?.payload.statement).toBe(ALT_AUSSAGE);
    const traeger = bestand.find((d) => d.payload.title === TRAEGER_TITEL);
    expect(String(traeger?.payload.statement)).toContain(ABSATZ_1);
    expect(String(traeger?.payload.bodyHtml)).toContain(DATEI);
    expect(uploads()).toBe(1);

    // ---- Neuladen: frische Fläche, beide Entwürfe über die echte Route wieder geöffnet. -------
    abbauen();
    await mount(`/erfassen?draft=${traeger?.id}`, "formular");
    expect(feld(String(i18n.t("capture.fStatement"))).value).toContain(ABSATZ_2);
    abbauen();
    await mount(`/erfassen?draft=${id}`, "formular");
    expect(feld(String(i18n.t("capture.wizard.titleLabel"))).value).toBe(NEUER_TITEL);
    expect(feld(String(i18n.t("capture.fStatement"))).value).toBe(ALT_AUSSAGE);
  });

  it("A2 · Datei: Antwort der Anlage verloren, zweiter Druck — ein Entwurf beim Server", async () => {
    await mount("/erfassen", "datei");
    await dateiAblegen(datei());

    bruecke.anlageAntwortVerlieren = true;
    await klick(speicherKnopf());
    expect(await titelzahl(), "der Server hat nicht angelegt").toEqual({ [TRAEGER_TITEL]: 1 });
    expect(sichtbar(), "Erfolg gemeldet, obwohl keine Antwort kam").not.toContain(gesichertSatz());

    await klick(speicherKnopf());

    const schluessel = anlageSchluessel();
    expect(schluessel).toHaveLength(2);
    expect(schluessel[0]).toMatch(/^create-/);
    expect(schluessel[1]).toBe(schluessel[0]);
    expect(uploads(), "das Original wurde erneut hochgeladen").toBe(1);
    expect(await titelzahl(), "Doppelbestand nach verlorener Antwort").toEqual({
      [TRAEGER_TITEL]: 1,
    });
    expect(sichtbar()).toContain(gesichertSatz());
  });

  it("A3 · Formular ohne geöffneten Entwurf: Antwort verloren, zweiter Druck — ein Entwurf beim Server", async () => {
    await mount("/erfassen", "formular");
    await tippe(feld(String(i18n.t("capture.wizard.titleLabel"))), NEUER_TITEL);
    await tippe(feld(String(i18n.t("capture.fStatement"))), ALT_AUSSAGE);

    bruecke.anlageAntwortVerlieren = true;
    await klick(speicherKnopf());
    expect(await titelzahl()).toEqual({ [NEUER_TITEL]: 1 });

    await klick(speicherKnopf());

    const schluessel = anlageSchluessel();
    expect(schluessel[1]).toBe(schluessel[0]);
    expect(await titelzahl(), "Doppelbestand nach verlorener Antwort").toEqual({
      [NEUER_TITEL]: 1,
    });
    expect(sichtbar()).toContain(String(i18n.t("capture.draftSaved")));
  });

  it("A4 · Formular + Datei, Upload angehalten, zweiter Druck über die Wache: ein Formularstand, eine Datei, kein vorzeitiger Erfolg", async () => {
    const id = await altEntwurf();
    await formularUndDatei(id, true);

    await uploadAnhalten();
    await act(async () => {
      speicherKnopf().click();
      await flush();
    });
    expect(uploads()).toBe(1);
    expect(sichtbar()).not.toContain(gesichertSatz());

    await act(async () => {
      wechselLink()?.click();
      await flush();
    });
    expect(speichernKnopfDa(), "die Wache bietet ihren Speichern-Knopf nicht an").toBe(true);
    const wacheSpeichern = [...document.querySelectorAll("[data-navguard-dialog] button")].find(
      (b) => (b.textContent ?? "").includes(String(i18n.t("nav.guard.save"))),
    );
    if (!(wacheSpeichern instanceof HTMLButtonElement)) {
      throw new Error("Speichern-Knopf der Wache nicht gefunden");
    }
    await act(async () => {
      wacheSpeichern.click();
      await flush();
    });
    expect(uploads(), "ein zweiter Upload lief an").toBe(1);

    await uploadLoslassen();

    expect(uploads()).toBe(1);
    expect(await titelzahl(), "Doppelbestand").toEqual({ [NEUER_TITEL]: 1, [TRAEGER_TITEL]: 1 });
    const traeger = (await entwuerfe()).find((d) => d.payload.title === TRAEGER_TITEL);
    expect(String(traeger?.payload.statement)).toContain(ABSATZ_1);
    expect(String(traeger?.payload.bodyHtml)).toContain(DATEI);
  });

  it("A5 · Upload scheitert (500): Volltext gesichert, Fehler benannt, Korrekturweg ausgeführt — ein Entwurf", async () => {
    await mount("/erfassen", "datei");
    await dateiAblegen(datei());

    bruecke.uploadScheitern = true;
    await klick(speicherKnopf());

    const bestand = await entwuerfe();
    expect(bestand).toHaveLength(1);
    const traeger = bestand[0];
    expect(String(traeger?.payload.statement)).toContain(ABSATZ_2);
    expect(sichtbar()).toContain(String(i18n.t("capture.originalAttachFailed", { name: DATEI })));

    // Korrektur: den gesicherten Entwurf wieder öffnen, ergänzen, speichern.
    abbauen();
    await mount(`/erfassen?draft=${traeger?.id}`, "formular");
    const aussage = feld(String(i18n.t("capture.fStatement")));
    expect(aussage.value).toContain(ABSATZ_2);
    await tippe(aussage, `${aussage.value}\n\nNachtrag: Original liegt im Laufwerk Q.`);
    await klick(speicherKnopf());

    const danach = await entwuerfe();
    expect(danach, "die Korrektur legte einen zweiten Entwurf an").toHaveLength(1);
    expect(String(danach[0]?.payload.statement)).toContain("Nachtrag");
    expect(String(danach[0]?.payload.statement)).toContain(ABSATZ_1);
  });

  // RUNDE 3 (bens B1, API-G5): dieselbe Lage gegen die echte Anwendung.
  it("A6 · Upload scheitert (500), Anlage-Antwort verloren, zweiter Druck ohne Änderung: ein Entwurf beim Server", async () => {
    await mount("/erfassen", "datei");
    await dateiAblegen(datei());

    bruecke.uploadScheitern = true;
    bruecke.anlageAntwortVerlieren = true;
    await klick(speicherKnopf());
    expect(await titelzahl(), "der Server hat nicht angelegt").toEqual({ [TRAEGER_TITEL]: 1 });
    expect(sichtbar(), "Erfolg gemeldet, obwohl keine Antwort kam").not.toContain(gesichertSatz());

    await klick(speicherKnopf());

    const schluessel = anlageSchluessel();
    expect(schluessel).toHaveLength(2);
    expect(schluessel[1], "der Wiederholversuch trägt einen anderen Schlüssel").toBe(schluessel[0]);
    expect(uploads(), "der Wiederholversuch hat erneut hochgeladen").toBe(1);
    const bestand = await entwuerfe();
    expect(
      bestand.map((d) => d.id),
      "Doppelbestand ohne Änderung des Menschen",
    ).toHaveLength(1);
    expect(String(bestand[0]?.payload.statement)).toContain(ABSATZ_2);
    expect(sichtbar()).toContain(gesichertSatz());
    expect(sichtbar()).toContain(String(i18n.t("capture.originalAttachFailed", { name: DATEI })));
  });
});
