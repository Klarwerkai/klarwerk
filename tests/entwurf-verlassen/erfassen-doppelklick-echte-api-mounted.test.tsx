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
  /** Der nächste `POST /api/drafts` scheitert im Netz, BEVOR er den Server erreicht (K2). */
  anlageNieAngekommen: false,
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
    if (bruecke.anlageNieAngekommen && method === "POST" && /\/api\/drafts$/.test(url)) {
      // Der Netzfehler kommt VOR dem Server: es ist nichts angelegt, der Client weiss es nicht.
      bruecke.anlageNieAngekommen = false;
      throw new TypeError("Failed to fetch");
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
  bruecke.anlageNieAngekommen = false;
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
/** entscheidung:8b909a1e: der Hinweis, der bei erkannter Wiederholung statt des Erfolgs steht. */
const bereitsSatz = (): string => String(i18n.t("capture.bereitsGespeichert"));
const fortgeschriebenSatz = (): string =>
  String(i18n.t("capture.bereitsGespeichertFortgeschrieben"));

/** Der sichtbare Hinweis „war bereits gespeichert" samt seinem Verweis — `null`, wenn keiner steht. */
function hinweis(): { text: string; href: string | null; link: HTMLAnchorElement | null } | null {
  const el = flaeche().querySelector('[data-testid="capture-bereits-gespeichert"]');
  if (!el) {
    return null;
  }
  const link = el.querySelector("a");
  return { text: el.textContent ?? "", href: link?.getAttribute("href") ?? null, link };
}

async function formularUndDatei(id: string, wechselweg = false): Promise<void> {
  await mount(`/erfassen?draft=${id}`, "formular", wechselweg);
  await tippe(feld(String(i18n.t("capture.fTitle"))), NEUER_TITEL);
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
    expect(feld(String(i18n.t("capture.fTitle"))).value).toBe(NEUER_TITEL);
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
    // entscheidung:8b909a1e: der Server hat den Eintrag erkannt — Hinweis statt Erfolg.
    expect(hinweis()?.text).toContain(bereitsSatz());
    expect(sichtbar()).not.toContain(gesichertSatz());
  });

  it("A3 · Formular ohne geöffneten Entwurf: Antwort verloren, zweiter Druck — ein Entwurf beim Server", async () => {
    await mount("/erfassen", "formular");
    await tippe(feld(String(i18n.t("capture.fTitle"))), NEUER_TITEL);
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
    // entscheidung:8b909a1e: der Server hat den Eintrag erkannt — Hinweis statt Erfolg.
    expect(hinweis()?.text).toContain(bereitsSatz());
    expect(sichtbar()).not.toContain(String(i18n.t("capture.draftSaved")));
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
    expect(hinweis()?.text).toContain(bereitsSatz());
    expect(sichtbar()).toContain(String(i18n.t("capture.originalAttachFailed", { name: DATEI })));
  });
});

// ================================================================================================
// entscheidung:14ce8681 / entscheidung:8b909a1e (Pedi, 30.09.2026, jeweils Option A) — K1 bis K4.
// ================================================================================================
//
// Gegen DIESELBE echte Anwendung wie oben. Gezählt wird beim SERVER (`GET /api/drafts`), nicht an
// den Aufrufen. „Nach Reload" heisst: Fläche abgebaut, frisch montiert, Entwurf über die Adresse
// geöffnet — der Inhalt kommt dann allein vom Server.
describe("entscheidung:14ce8681/8b909a1e · Fortschreiben und sichtbarer Hinweis (fetch → app.inject)", () => {
  it("E1 (K1, K3) · Formular: Antwort verloren, Inhalt geändert, erneut gespeichert — EIN Entwurf mit dem neuen Inhalt, Hinweis mit funktionierendem Verweis", async () => {
    await mount("/erfassen", "formular");
    await tippe(feld(String(i18n.t("capture.fTitle"))), NEUER_TITEL);
    await tippe(feld(String(i18n.t("capture.fStatement"))), ALT_AUSSAGE);

    bruecke.anlageAntwortVerlieren = true;
    await klick(speicherKnopf());
    expect(await titelzahl(), "der Server hat nicht angelegt").toEqual({ [NEUER_TITEL]: 1 });
    expect(sichtbar()).not.toContain(String(i18n.t("capture.draftSaved")));

    // Der Mensch ändert den Inhalt und speichert erneut.
    const GEAENDERT = `${ALT_AUSSAGE} Ab 1.000 € gilt Rechnung.`;
    await tippe(feld(String(i18n.t("capture.fStatement"))), GEAENDERT);
    await klick(speicherKnopf());

    const schluessel = anlageSchluessel();
    expect(schluessel[1], "der geänderte Inhalt bekam einen neuen Schlüssel").toBe(schluessel[0]);
    const bestand = await entwuerfe();
    expect(bestand, "zweiter Entwurf nach geändertem Inhalt").toHaveLength(1);
    expect(bestand[0]?.payload.statement).toBe(GEAENDERT);

    // K3: Hinweis statt Erfolg, mit Verweis auf genau diesen Eintrag.
    const h = hinweis();
    expect(h?.text).toContain(fortgeschriebenSatz());
    expect(sichtbar()).not.toContain(String(i18n.t("capture.draftSaved")));
    expect(h?.href).toContain(`draft=${encodeURIComponent(String(bestand[0]?.id))}`);

    // Der Verweis FUNKTIONIERT: eine frische Fläche unter der Kennung aus dem Verweis öffnet den
    // Eintrag mit dem neuen Inhalt vom Server (= nach Reload). Der Klick im Blatt selbst ist in
    // Chromium gemessen (Q7).
    const kennung = new URLSearchParams(String(h?.href).split("?")[1] ?? "").get("draft");
    expect(kennung).toBe(bestand[0]?.id);
    abbauen();
    await mount(`/erfassen?draft=${kennung}`, "formular");
    expect(feld(String(i18n.t("capture.fStatement"))).value).toBe(GEAENDERT);
    expect(await entwuerfe()).toHaveLength(1);
  });

  it("E2 (K1) · Datei: Antwort verloren, andere Datei eingelesen, erneut gespeichert — EIN Entwurf mit dem neuen Dateiinhalt", async () => {
    await mount("/erfassen", "datei");
    await dateiAblegen(datei());

    bruecke.anlageAntwortVerlieren = true;
    await klick(speicherKnopf());
    expect(await titelzahl()).toEqual({ [TRAEGER_TITEL]: 1 });

    const NEU = "Neu: der Filter wird wöchentlich gewechselt.";
    await dateiAblegen(new File([NEU], DATEI, { type: "text/plain" }));
    await klick(speicherKnopf());

    const schluessel = anlageSchluessel();
    expect(schluessel[1], "der geänderte Inhalt bekam einen neuen Schlüssel").toBe(schluessel[0]);
    const bestand = await entwuerfe();
    expect(bestand, "zweiter Entwurf nach geänderter Datei").toHaveLength(1);
    expect(String(bestand[0]?.payload.statement)).toContain(NEU);
    expect(String(bestand[0]?.payload.statement)).not.toContain(ABSATZ_1);
    expect(hinweis()?.text).toContain(fortgeschriebenSatz());

    abbauen();
    await mount(`/erfassen?draft=${bestand[0]?.id}`, "formular");
    expect(feld(String(i18n.t("capture.fStatement"))).value).toContain(NEU);
  });

  it("E3 (K1, K3) · Formular + Datei in einem Druck: Antwort der Formular-Anlage verloren, danach andere Datei, erneut gespeichert — je EIN Entwurf, die Datei mit dem neuen Inhalt", async () => {
    await mount("/erfassen", "formular");
    await tippe(feld(String(i18n.t("capture.fTitle"))), NEUER_TITEL);
    await tippe(feld(String(i18n.t("capture.fStatement"))), ALT_AUSSAGE);
    await ansichtWechseln("datei");
    await dateiAblegen(datei());

    // Die Antwort auf die ERSTE Anlage (Formular) geht verloren; die Datei kommt dann nicht dran.
    bruecke.anlageAntwortVerlieren = true;
    await klick(speicherKnopf());
    expect(await titelzahl()).toEqual({ [NEUER_TITEL]: 1 });

    // Der Mensch legt eine andere Datei auf und drückt erneut.
    const NEU = "Neu: der Filter wird wöchentlich gewechselt.";
    await dateiAblegen(new File([NEU], DATEI, { type: "text/plain" }));
    await klick(speicherKnopf());

    expect(await titelzahl(), "Doppelbestand nach erneutem Speichern").toEqual({
      [NEUER_TITEL]: 1,
      [TRAEGER_TITEL]: 1,
    });
    const traeger = (await entwuerfe()).find((d) => d.payload.title === TRAEGER_TITEL);
    expect(String(traeger?.payload.statement)).toContain(NEU);
    expect(String(traeger?.payload.statement)).not.toContain(ABSATZ_1);
    // Der Formular-Eintrag war schon da: sein Hinweis steht, mit Verweis auf ihn.
    const formular = (await entwuerfe()).find((d) => d.payload.title === NEUER_TITEL);
    expect(hinweis()?.text).toContain(bereitsSatz());
    expect(hinweis()?.href).toContain(`draft=${encodeURIComponent(String(formular?.id))}`);
  });

  it("E4 (K2) · der erste Versuch kam nie an, Inhalt geändert, erneut gespeichert — genau EIN Entwurf mit dem aktuellen Inhalt, normale Erfolgsmeldung", async () => {
    await mount("/erfassen", "formular");
    await tippe(feld(String(i18n.t("capture.fTitle"))), NEUER_TITEL);
    await tippe(feld(String(i18n.t("capture.fStatement"))), ALT_AUSSAGE);

    bruecke.anlageNieAngekommen = true;
    await klick(speicherKnopf());
    expect(await entwuerfe(), "angelegt, obwohl der Aufruf nie ankam").toHaveLength(0);
    // Nichts verloren: die Eingabe steht noch da.
    expect(feld(String(i18n.t("capture.fTitle"))).value).toBe(NEUER_TITEL);
    expect(feld(String(i18n.t("capture.fStatement"))).value).toBe(ALT_AUSSAGE);

    const GEAENDERT = `${ALT_AUSSAGE} Nachtrag.`;
    await tippe(feld(String(i18n.t("capture.fStatement"))), GEAENDERT);
    await klick(speicherKnopf());

    const bestand = await entwuerfe();
    expect(bestand).toHaveLength(1);
    expect(bestand[0]?.payload.title).toBe(NEUER_TITEL);
    expect(bestand[0]?.payload.statement).toBe(GEAENDERT);
    // Der Server hat ERSTMALS angelegt — also kein Hinweis, sondern die normale Meldung (K4).
    expect(hinweis()).toBeNull();
    expect(sichtbar()).toContain(String(i18n.t("capture.draftSaved")));
  });

  it("E5 (K2) · Datei: der erste Versuch kam nie an — die Datei bleibt, der erneute Druck legt genau EINEN Entwurf mit ihr an", async () => {
    await mount("/erfassen", "datei");
    await dateiAblegen(datei());

    bruecke.anlageNieAngekommen = true;
    await klick(speicherKnopf());
    expect(await entwuerfe()).toHaveLength(0);
    expect(speicherKnopf().disabled, "die Datei ist nicht mehr sicherbar").toBe(false);

    await klick(speicherKnopf());

    const bestand = await entwuerfe();
    expect(bestand).toHaveLength(1);
    expect(String(bestand[0]?.payload.statement)).toContain(ABSATZ_2);
    expect(String(bestand[0]?.payload.bodyHtml)).toContain(DATEI);
    expect(uploads(), "das Original wurde erneut hochgeladen").toBe(1);
    expect(hinweis()).toBeNull();
    expect(sichtbar()).toContain(gesichertSatz());
  });

  it("E6 (K4) · echte Erstspeicherung (Formular und Datei): kein Hinweis, die normale Erfolgsmeldung", async () => {
    await mount("/erfassen", "formular");
    await tippe(feld(String(i18n.t("capture.fTitle"))), NEUER_TITEL);
    await tippe(feld(String(i18n.t("capture.fStatement"))), ALT_AUSSAGE);
    await klick(speicherKnopf());
    expect(await titelzahl()).toEqual({ [NEUER_TITEL]: 1 });
    expect(hinweis()).toBeNull();
    expect(sichtbar()).toContain(String(i18n.t("capture.draftSaved")));
    expect(sichtbar()).not.toContain(bereitsSatz());

    abbauen();
    await mount("/erfassen", "datei");
    await dateiAblegen(datei());
    await klick(speicherKnopf());
    expect(await titelzahl()).toEqual({ [NEUER_TITEL]: 1, [TRAEGER_TITEL]: 1 });
    expect(hinweis()).toBeNull();
    expect(sichtbar()).toContain(gesichertSatz());
    expect(sichtbar()).not.toContain(bereitsSatz());
  });

  it("E7 (K3) · die Texte liegen in de, en und nl vor und unterscheiden sich", async () => {
    const saetze: string[] = [];
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      for (const key of [
        "capture.bereitsGespeichert",
        "capture.bereitsGespeichertFortgeschrieben",
        "capture.bereitsGespeichertOeffnen",
      ]) {
        expect(i18n.exists(key, { lng: sprache, fallbackLng: false }), `${sprache}: ${key}`).toBe(
          true,
        );
      }
      saetze.push(String(i18n.t("capture.bereitsGespeichert")));
    }
    expect(new Set(saetze).size).toBe(3);
    expect(saetze[0]).toBe(
      "Dieses Dokument war bereits gespeichert, es wurde kein zweiter Eintrag angelegt.",
    );
  });
});
