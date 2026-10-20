// @vitest-environment jsdom
// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 — ROUTINE AUS DER FLÄCHE AUSFÜHREN.
// ================================================================================================
//
// Die ECHTE Hülle, die ECHTE Profilseite mit „Vormachen und Routinen“ und der ECHTE Server
// (`buildApp(buildServices())`, In-Memory); ersetzt ist allein der Transport (`fetch` →
// `app.inject`) — derselbe Aufbau wie `tests/vormachen-routine/vormachen-mounted.test.tsx`.
//
//   L1  Eine in P06 bestätigte Routine zeigt „Ausführen“. Ein Klick mit den Eingaben dieses Laufs
//       legt über Lauf und Aktionskern einen Entwurf an; die Fläche zeigt ihn mit Link, der Server
//       hat ihn mit genau diesen Werten.
//   L2  „Pause“ an der Routine wirkt am Server; pausiert ist „Ausführen“ gesperrt.
//   L3  AC05 (Nacharbeit 33): „Sofort einmal“ samt Eingaben in der Fläche gespeichert; der Takt
//       der Zeitsteuerung legt den Bericht ohne weiteren Klick an; „Zeitplan entfernen“ wirkt.
//   L4  AC05: wöchentlich mit Wochentag, Uhrzeit, Zeitzone, „Erst ab“ und Nachholregel gespeichert.
// Fiktive Konten und Daten, kein Modell.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactNode, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { verwerfeAssistenzProfil } from "../../apps/web/src/lib/assistenzProfil";
import { meldeVormachen } from "../../apps/web/src/lib/vormachenAnzeige";
import { Profile } from "../../apps/web/src/pages/Profile";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import type { ZeitplanLaufErgebnis } from "../../services/app/src/assistenz-lernen-zeitsteuerung";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { bis, klick, medienStub, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ADA = { name: "Ada Fiktiv", email: "ada@routine-lauf-ui.test", password: "ada-geheim-1" };
const WEB = "http://localhost/erfassen";

let app: FastifyInstance | null = null;
let takt: (jetzt?: number) => Promise<ZeitplanLaufErgebnis[]> = async () => [];
let cookie = "";

/** Wählt in einer kontrollierten Auswahlliste wie ein Mensch. */
async function waehle(feld: HTMLSelectElement | null, wert: string): Promise<void> {
  if (!feld) {
    throw new Error("Auswahlliste fehlt");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await ruhe(3);
}
let vorherigerFetch: typeof globalThis.fetch;
let adaId = "";

function drahtAufbauen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (!app) {
      throw new Error(`Draht ohne App: ${methode} ${url}`);
    }
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    kopf.cookie = cookie;
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

async function draht(
  methode: "GET" | "POST" | "PUT",
  url: string,
  payload?: Record<string, unknown>,
  herkunft?: string,
): Promise<{ status: number; body: unknown }> {
  const r = await (app as FastifyInstance).inject({
    method: methode,
    url,
    headers: { cookie, ...(herkunft ? { referer: herkunft } : {}) },
    ...(payload ? { payload } : {}),
  });
  return { status: r.statusCode, body: r.body === "" ? null : r.json() };
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function montiere(route: string, seite: ReactNode): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: [route] },
                  createElement(AppShell, null, seite),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  }
}

/** P06 am Draht: vormachen über die vorhandenen Entwurfswege und bestätigen. */
async function routineVormachen(): Promise<{ id: string; fassung: number }> {
  const start = await draht("POST", "/api/me/vormachen", {
    host: "klarwerk_web",
    vorgaenge: ["entwurf_anlegen"],
    zweck: "Wöchentlichen Bericht vorbereiten",
  });
  expect(start.status).toBe(201);
  const sitzung = (start.body as { sitzung: { id: string } }).sitzung.id;
  const anzeige = await draht("GET", "/api/me/vormachen?anzeige=klarwerk_web");
  expect((anzeige.body as { sichtbar: boolean }).sichtbar).toBe(true);
  const entwurf = await draht(
    "POST",
    "/api/drafts",
    {
      title: "Wochenbericht KW41 Musterfirma",
      statement: "Umsatz stabil",
      type: "best_practice",
      category: "Vertrieb",
      confidentiality: "intern",
      bodyHtml: "<p>Fiktiver Bericht.</p>",
    },
    WEB,
  );
  expect(entwurf.status).toBe(201);
  const vorschau = await draht("GET", `/api/me/vormachen/${sitzung}/vorschau`);
  const stand = (vorschau.body as { vorschau: { stand: string } }).vorschau.stand;
  const bestaetigt = await draht("POST", `/api/me/vormachen/${sitzung}/bestaetigung`, { stand });
  expect(bestaetigt.status).toBe(201);
  return (bestaetigt.body as { routine: { id: string; fassung: number } }).routine;
}

/** Wie viele eigene Entwürfe diesen Titel tragen — am Server gelesen. */
async function berichte(titel: string): Promise<number> {
  const r = await draht("GET", "/api/drafts");
  const liste = r.body as { payload?: { title?: string } }[];
  return liste.filter((d) => d.payload?.title === titel).length;
}

async function oeffneFlaeche(): Promise<void> {
  await montiere("/profil", createElement(Profile));
  await bis(() => Boolean(q(document, "zeile-funktionen")));
  await klick(q(document, "zeile-funktionen"));
  await bis(() => Boolean(q(document, "routine-lauf")));
}

beforeAll(() => {
  drahtAufbauen();
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
});

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  meldeVormachen(false);
  verwerfeAssistenzProfil();
  medienStub();
  Element.prototype.scrollIntoView = () => {};
  await i18n.changeLanguage("de");
  app = buildApp(buildServices(), {
    routinenZeitsteuerung: (lauf) => {
      takt = lauf;
    },
  });
  await app.ready();
  const a = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADA });
  expect(a.statusCode).toBe(201);
  adaId = (a.json() as { id: string }).id;
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADA.email, password: ADA.password },
  });
  cookie = `kw_session=${(login.json() as { token: string }).token}`;
  expect((await draht("POST", "/api/auth/notice")).status).toBeLessThan(300);
});

afterEach(async () => {
  abbauen();
  await app?.close();
  app = null;
});

describe("BPA-06 · bestätigte Routine aus „Meine Routinen“ ausführen", () => {
  it("L1 · ein Klick mit den Eingaben dieses Laufs legt den Entwurf an und zeigt ihn", async () => {
    await routineVormachen();
    expect(adaId).not.toBe("");
    await oeffneFlaeche();
    const titel = q<HTMLInputElement>(document, "routine-lauf-titel") as HTMLInputElement;
    const inhalt = q<HTMLInputElement>(document, "routine-lauf-inhalt") as HTMLInputElement;
    await tippe(titel, "Wochenbericht KW43");
    await tippe(inhalt, "Umsatz gehalten");
    await klick(q(document, "routine-lauf-ausfuehren"));
    await bis(() => Boolean(q(document, "routine-lauf-ergebnis")));

    expect(q(document, "routine-lauf-ergebnis")?.textContent).toContain("Wochenbericht KW43");
    expect(q(document, "routine-lauf-fehler")).toBeNull();
    const link = q<HTMLAnchorElement>(document, "routine-lauf-ergebnis-link");
    const href = link?.getAttribute("href") ?? "";
    expect(href.startsWith("/erfassen?draft=")).toBe(true);
    const entwurfId = decodeURIComponent(href.slice("/erfassen?draft=".length));
    const gelesen = await draht("GET", `/api/drafts/${encodeURIComponent(entwurfId)}`);
    expect(gelesen.status).toBe(200);
    const payload = (gelesen.body as { payload: { title?: string; statement?: string } }).payload;
    expect(payload.title).toBe("Wochenbericht KW43");
    expect(payload.statement).toContain("Umsatz gehalten");
    expect(JSON.stringify(payload)).not.toContain("KW41");
  });

  it("L2 · Pause an der Routine wirkt am Server; pausiert ist „Ausführen“ gesperrt", async () => {
    const routine = await routineVormachen();
    await oeffneFlaeche();
    await klick(q(document, "routine-lauf-pause"));
    await bis(
      () => q(document, "routine-lauf-zustand")?.getAttribute("data-zustand") === "pausiert",
    );
    const ueber = await draht("GET", "/api/me/vormachen");
    const routinen = (ueber.body as { routinen: { id: string; zustand: string }[] }).routinen;
    expect(routinen.find((r) => r.id === routine.id)?.zustand).toBe("pausiert");
    const titel = q<HTMLInputElement>(document, "routine-lauf-titel") as HTMLInputElement;
    await tippe(titel, "Wochenbericht KW43");
    const knopf = q<HTMLButtonElement>(document, "routine-lauf-ausfuehren");
    expect(knopf?.disabled).toBe(true);
  });

  it("L3 · Zeitplan „Sofort einmal“ aus der Fläche: der Takt legt den Bericht ohne Klick an", async () => {
    const routine = await routineVormachen();
    await oeffneFlaeche();
    expect(q(document, "routine-zeitplan-aktuell")?.textContent).toBe(
      i18n.t("vormachen.zeitplan.keiner"),
    );
    const titel = q<HTMLInputElement>(document, "routine-lauf-titel") as HTMLInputElement;
    const inhalt = q<HTMLInputElement>(document, "routine-lauf-inhalt") as HTMLInputElement;
    await tippe(titel, "Wochenbericht aus dem Plan");
    await tippe(inhalt, "Umsatz gehalten");
    await waehle(q<HTMLSelectElement>(document, "routine-zeitplan-art"), "sofort");
    await klick(q(document, "routine-zeitplan-speichern"));
    await bis(() => Boolean(q(document, "routine-zeitplan-meldung")));
    expect(q(document, "routine-zeitplan-fehler")).toBeNull();
    await bis(
      () =>
        q(document, "routine-zeitplan-aktuell")?.textContent ===
        i18n.t("vormachen.zeitplan.aktuell.sofort"),
    );
    expect(q(document, "routine-zeitplan-aktuell")?.textContent).toBe(
      i18n.t("vormachen.zeitplan.aktuell.sofort"),
    );

    // Die Zeitsteuerung des Servers: ein Takt, kein weiterer Klick.
    const [e] = await takt(Date.now());
    expect(e).toMatchObject({ routineId: routine.id, stand: "ausgefuehrt" });
    const gelesen = await draht("GET", `/api/drafts/${encodeURIComponent(e?.ergebnisId ?? "")}`);
    expect(gelesen.status).toBe(200);
    const payload = (gelesen.body as { payload: { title?: string; statement?: string } }).payload;
    expect(payload.title).toBe("Wochenbericht aus dem Plan");
    expect(payload.statement).toContain("Umsatz gehalten");

    await klick(q(document, "routine-zeitplan-entfernen"));
    await bis(
      () =>
        q(document, "routine-zeitplan-aktuell")?.textContent ===
        i18n.t("vormachen.zeitplan.keiner"),
    );
    const ueber = await draht("GET", "/api/me/vormachen");
    const routinen = (ueber.body as { routinen: { id: string; zeitplan: unknown }[] }).routinen;
    expect(routinen.find((r) => r.id === routine.id)?.zeitplan).toBeNull();
  });

  it("L4 · wöchentlich mit Wochentag, Uhrzeit, Zeitzone, „Erst ab“ und Nachholregel", async () => {
    const routine = await routineVormachen();
    await oeffneFlaeche();
    const feld = (id: string) => q<HTMLInputElement>(document, id) as HTMLInputElement;
    await tippe(feld("routine-lauf-titel"), "Bericht");
    await waehle(q<HTMLSelectElement>(document, "routine-zeitplan-art"), "woechentlich");
    await waehle(q<HTMLSelectElement>(document, "routine-zeitplan-wochentag"), "3");
    await tippe(feld("routine-zeitplan-uhrzeit"), "09:30");
    await tippe(feld("routine-zeitplan-ab"), "2026-11-01");
    await tippe(feld("routine-zeitplan-zeitzone"), "Europe/Berlin");
    await waehle(q<HTMLSelectElement>(document, "routine-zeitplan-nachholen"), "auslassen");
    await klick(q(document, "routine-zeitplan-speichern"));
    await bis(() => Boolean(q(document, "routine-zeitplan-meldung")));
    expect(q(document, "routine-zeitplan-fehler")).toBeNull();

    const ueber = await draht("GET", "/api/me/vormachen");
    const routinen = (ueber.body as { routinen: { id: string; zeitplan: unknown }[] }).routinen;
    expect(routinen.find((r) => r.id === routine.id)?.zeitplan).toEqual({
      art: "woechentlich",
      wochentag: 3,
      uhrzeit: "09:30",
      zeitzone: "Europe/Berlin",
      nachholen: "auslassen",
      ab: "2026-11-01",
    });
    const aktuell = () => q(document, "routine-zeitplan-aktuell")?.textContent ?? "";
    await bis(() => aktuell().includes("09:30"));
    expect(aktuell()).toBe(
      i18n.t("vormachen.zeitplan.aktuell.woechentlich", {
        tag: i18n.t("vormachen.zeitplan.tag.3"),
        uhrzeit: "09:30",
        zeitzone: "Europe/Berlin",
      }),
    );
  });
});

describe("EQF-06-K08 · Einstieg „Meine Funktionen“", () => {
  it("M1 · die bestätigte Routine steht sofort unter „Meine Funktionen“ und läuft von dort", async () => {
    const routine = await routineVormachen();
    await montiere("/profil", createElement(Profile));
    await bis(() => Boolean(q(document, "zeile-funktionen")));
    expect(q(document, "zeile-funktionen")?.textContent).toContain("Meine Funktionen");
    await klick(q(document, "zeile-funktionen"));
    await bis(() => Boolean(q(document, "routine-lauf")));

    // Gemeinsamer Einstieg mit Lernstart und Privatlöschung, dieselbe Routinenablage.
    const detail = q(document, "detail-funktionen");
    expect(detail).not.toBeNull();
    expect(q(document, "vormachen-flaeche")).not.toBeNull();
    expect(q(document, "vormachen-start")).not.toBeNull();
    expect(q(document, "vormachen-privat")).not.toBeNull();
    const ueber = await draht("GET", "/api/me/vormachen");
    const routinen = (ueber.body as { routinen: { id: string; titel: string }[] }).routinen;
    expect(routinen.map((r) => r.id)).toEqual([routine.id]);
    expect(q(document, "vormachen-routine")?.textContent).toContain(routinen[0]?.titel ?? "—");

    // Aufrufbar: ein Lauf mit neuen Eingaben erzeugt ein neues Ergebnis, nicht die Vorführung.
    const titel = q<HTMLInputElement>(document, "routine-lauf-titel") as HTMLInputElement;
    const inhalt = q<HTMLInputElement>(document, "routine-lauf-inhalt") as HTMLInputElement;
    await tippe(titel, "Wochenbericht KW44");
    await tippe(inhalt, "Umsatz gestiegen");
    await klick(q(document, "routine-lauf-ausfuehren"));
    await bis(() => Boolean(q(document, "routine-lauf-ergebnis")));
    expect(q(document, "routine-lauf-fehler")).toBeNull();
    const href = q(document, "routine-lauf-ergebnis-link")?.getAttribute("href") ?? "";
    const entwurfId = decodeURIComponent(href.slice("/erfassen?draft=".length));
    const gelesen = await draht("GET", `/api/drafts/${encodeURIComponent(entwurfId)}`);
    const payload = (gelesen.body as { payload: { title?: string } }).payload;
    expect(payload.title).toBe("Wochenbericht KW44");
    expect(JSON.stringify(payload)).not.toContain("KW41");
  });

  it("M3 · „Ergebnis zur Prüfung“: Bericht angelegt, wartet auf Prüfung, Öffnen schließt ab", async () => {
    const routine = await routineVormachen();
    await oeffneFlaeche();
    const art = () => q(document, "routine-uebergabe")?.getAttribute("data-art");
    expect(art()).toBe("selbststaendig");
    await waehle(q<HTMLSelectElement>(document, "routine-uebergabe-art"), "zur_pruefung");
    await bis(() => art() === "zur_pruefung");
    expect(q(document, "routine-uebergabe-erklaerung")?.textContent).toBe(
      i18n.t("vormachen.uebergabe.erklaerung.zur_pruefung"),
    );
    const ueber = await draht("GET", "/api/me/vormachen");
    const routinen = (ueber.body as { routinen: { id: string; ausfuehrung: string }[] }).routinen;
    expect(routinen.find((r) => r.id === routine.id)?.ausfuehrung).toBe("zur_pruefung");

    await tippe(q<HTMLInputElement>(document, "routine-lauf-titel") as HTMLInputElement, "KW45");
    await tippe(q<HTMLInputElement>(document, "routine-lauf-inhalt") as HTMLInputElement, "Ruhig");
    await klick(q(document, "routine-lauf-ausfuehren"));
    await bis(() => Boolean(q(document, "routine-lauf-wartet-pruefung")));
    expect(q(document, "routine-lauf-ergebnis")?.textContent).toContain("KW45");
    expect(await berichte("KW45")).toBe(1);
    // Ein zweiter Klick auf „Ausführen“ ist gesperrt, solange die Prüfung offen ist.
    expect(q<HTMLButtonElement>(document, "routine-lauf-ausfuehren")?.disabled).toBe(true);
    await klick(q(document, "routine-lauf-pruefen"));
    await bis(() => Boolean(q(document, "routine-lauf-geprueft")));
    expect(q(document, "routine-lauf-fehler")).toBeNull();
    expect(q(document, "routine-lauf-wartet-pruefung")).toBeNull();
  });

  it("M4 · „Gemeinsam schrittweise“: jeder Schritt erst auf den Klick, ohne Zeitplan", async () => {
    await routineVormachen();
    await oeffneFlaeche();
    await waehle(q<HTMLSelectElement>(document, "routine-uebergabe-art"), "schrittweise");
    await bis(() => q(document, "routine-uebergabe")?.getAttribute("data-art") === "schrittweise");
    expect(q(document, "routine-zeitplan")).toBeNull();
    expect(q(document, "routine-lauf-ausfuehren")?.textContent).toBe(
      i18n.t("vormachen.lauf.vorbereiten"),
    );

    await tippe(q<HTMLInputElement>(document, "routine-lauf-titel") as HTMLInputElement, "KW46");
    await tippe(q<HTMLInputElement>(document, "routine-lauf-inhalt") as HTMLInputElement, "Ruhig");
    await klick(q(document, "routine-lauf-ausfuehren"));
    await bis(() => Boolean(q(document, "routine-lauf-schritte")));
    const erledigt = (nr: number) =>
      q(document, `routine-lauf-schritt-${nr}`)?.getAttribute("data-erledigt");
    expect([erledigt(1), erledigt(2)]).toEqual(["nein", "nein"]);
    // Vorbereitet ist nur der Auftrag — noch kein Bericht.
    expect(await berichte("KW46")).toBe(0);

    await klick(q(document, "routine-lauf-naechster"));
    await bis(() => erledigt(1) === "ja");
    expect(await berichte("KW46")).toBe(1);
    expect(erledigt(2)).toBe("nein");
    await klick(q(document, "routine-lauf-naechster"));
    await bis(() => Boolean(q(document, "routine-lauf-geprueft")));
    expect(q(document, "routine-lauf-fehler")).toBeNull();
  });

  it("M5 · Zeitplan „bei einem Ereignis“: unklare Worte → Rückfrage, Wahl gespeichert", async () => {
    const routine = await routineVormachen();
    await oeffneFlaeche();
    await tippe(q<HTMLInputElement>(document, "routine-lauf-titel") as HTMLInputElement, "KW47");
    await waehle(q<HTMLSelectElement>(document, "routine-zeitplan-art"), "bei_ereignis");
    const text = q<HTMLInputElement>(document, "routine-zeitplan-ereignis-text");
    await tippe(text as HTMLInputElement, "wenn ich fertig bin");
    await klick(q(document, "routine-zeitplan-speichern"));
    await bis(() => Boolean(q(document, "routine-zeitplan-ereignis-klaerung")));
    expect(q(document, "routine-zeitplan-fehler")).toBeNull();
    expect(q(document, "routine-zeitplan-ereignis-wissen_angelegt")).not.toBeNull();
    await klick(q(document, "routine-zeitplan-ereignis-wissen_ueberarbeitet"));
    await bis(() => Boolean(q(document, "routine-zeitplan-meldung")));
    const erwartet = i18n.t("vormachen.zeitplan.aktuell.bei_ereignis", {
      ereignis: i18n.t("vormachen.zeitplan.ereignis.wissen_ueberarbeitet"),
    });
    await bis(() => q(document, "routine-zeitplan-aktuell")?.textContent === erwartet);
    const ueber = await draht("GET", "/api/me/vormachen");
    const routinen = (ueber.body as { routinen: { id: string; zeitplan: unknown }[] }).routinen;
    expect(routinen.find((r) => r.id === routine.id)?.zeitplan).toEqual({
      art: "bei_ereignis",
      ereignis: "wissen_ueberarbeitet",
    });
  });

  it("M2 · `/profil?bereich=funktionen` öffnet „Meine Funktionen“ unmittelbar", async () => {
    await routineVormachen();
    await montiere("/profil?bereich=funktionen", createElement(Profile));
    await bis(() => Boolean(q(document, "detail-funktionen")));
    await bis(() => Boolean(q(document, "routine-lauf")));
    expect(q(document, "vormachen-routinen")?.textContent).toContain(
      i18n.t("vormachen.routinen.titel"),
    );
  });
});
