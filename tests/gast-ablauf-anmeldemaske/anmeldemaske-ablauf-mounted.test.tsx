// @vitest-environment jsdom
// ================================================================================================
// JOB 3821 · DER ABGELAUFENE GAST LIEST SEINEN SATZ DA, WO ER STEHT
// ================================================================================================
//
// MESSREICHWEITE (was dieser Lauf belegt und was nicht):
// Gemessen wird an der GERENDERTEN Anmeldemaske (`apps/web/src/auth/AuthScreens.tsx`, gemountet in
// jsdom): E-Mail und Passwort werden in die echten Felder getippt, der echte Absendeknopf wird
// gedrückt, und gelesen wird ausschließlich der Fehlerkasten aus `AuthScreens.tsx:205-209` — in
// DE, EN und NL, in zwei Lagen (abgelaufene Befristung · noch nicht freigegeben).
// Der Server ist der echte: `buildServices()` + `buildApp()` (In-Memory-Repos, kein Postgres),
// angebunden über eine Brücke, die `globalThis.fetch` auf `app.inject` legt. Gemockt ist NUR
// `useSession` (die Sitzungshülle um die Maske, nicht die Kette). Der Weg der Anfrage ist damit
// der produktive: `authApi.login` → `api.post` → `apiFetch` (setzt `Accept-Language`,
// `client.ts:23`) → Route → `sprache()` → `sendError` → `meldung()` → `err` → Kasten.
// NICHT gemessen: die Darstellung in einem echten Browser (kein Chromium), Bildschirmleser,
// Postgres, der OIDC-Anmeldeweg — und nichts über Marke, Firmen-CI oder Demo-Kennzeichnung der
// Maske; dieser Lauf behauptet über das Aussehen der Maske nichts, nur über den Satz im Kasten.
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT: JOB 3756 hat den Ablaufsatz gebaut und dreifach am
// SERVER gemessen (`tests/demo-zugang-gaeste-meldung/ablauf-meldung.test.ts`,
// `tests/demo-zugang-gaeste/…`, `tests/q9-serverfehlertexte/…`). Der Prüfer hat dazu wörtlich
// vermerkt: „die sichtbare Ausgabe in `AuthScreens.tsx:205` ist nicht durch einen ausgeführten
// UI-Test abgesichert" (`archiv/3756/runde-1/ben.md:28`). Genau diese eine Station — die letzte
// vor dem Menschen — schließt diese Datei. Sie ersetzt nichts davon; die vier Serverdateien bleiben.
//
// DER SOLLWERT KOMMT AUS DEM KATALOG (`MELDUNGEN`), NICHT AUS EINER KOPIE: eine hier eingetippte
// Zeichenkette pinnte einen zweiten Text neben dem einen, und der Katalog ist aus genau diesem
// Grund ein BLATT (`services/auth/src/meldungen.ts:3-6`). Einmal — und nur einmal — steht der
// deutsche Satz trotzdem wörtlich da (A1-DE), damit ein Mensch die Zusage lesen kann.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MELDUNGEN, type Sprache } from "../../services/auth/src/meldungen";

// Die Sitzungshülle ist NICHT Gegenstand dieser Messung: `useSession` liefert nur `refresh` (nach
// erfolgreicher Anmeldung) und `oidcEnabled`. Alles andere — Client, Anfrage, Route, Katalog —
// bleibt das echte Produkt.
const sitzung = vi.hoisted(() => ({ aufgefrischt: 0 }));
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({
    refresh: (): void => {
      sitzung.aufgefrischt += 1;
    },
    oidcEnabled: false,
    user: null,
  }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthScreens } from "../../apps/web/src/auth/AuthScreens";
import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PASSWORT = "geheim12345";
const ADMIN = { name: "Admin", email: "admin@job3821.test", password: PASSWORT };
const ABGELAUFENER_GAST = { name: "Gast", email: "gast@job3821.test", password: PASSWORT };
const GUELTIGER_GAST = { name: "Gueltig", email: "gueltig@job3821.test", password: PASSWORT };
const OHNE_FREIGABE = { name: "Neu", email: "neu@job3821.test", password: PASSWORT };

/**
 * Ein Zeitpunkt, der an jedem Tag, an dem dieser Test läuft, vorbei ist — dieselbe Wahl wie in
 * `tests/demo-zugang-gaeste-meldung/ablauf-meldung.test.ts:36`: eine verstellte Uhr wäre ein
 * zweiter beweglicher Teil in einem Fall, der über einen sichtbaren Satz urteilt.
 */
const ABGELAUFEN = "2020-01-01T00:00:00.000Z";

const SPRACHEN: Sprache[] = ["de", "en", "nl"];

// ------------------------------------------------------------------------------------------------
// DIE BRÜCKE: der echte Client spricht mit dem echten Server (Hausform, s.
// tests/app/job2693-d2-die-meldung-kommt-bis-zur-seite.test.tsx und tests/capture/mega21-…).
// ------------------------------------------------------------------------------------------------
type Anfrage = { method: string; url: string; sprache: string; payload: string | undefined };

let app: FastifyInstance;
let services: ReturnType<typeof buildServices>;
let anfragen: Anfrage[] = [];
let fetchVorher: typeof fetch;
/** Nur für den Lade-Zustand (Z2): hält die Antwort an, bis der Fall sie freigibt. */
let bremse: Promise<void> | null = null;

function brueckeAufbauen(): void {
  globalThis.fetch = (async (eingabe: unknown, init: RequestInit = {}) => {
    const url = String(eingabe);
    const kopf: Record<string, string> = {};
    new Headers(init.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    const payload = init.body === undefined || init.body === null ? undefined : String(init.body);
    // Der Kopf wird AUFGEZEICHNET und UNVERÄNDERT weitergereicht — nur so ist die Sprachübergabe
    // beobachtet und nicht angenommen (A3).
    anfragen.push({
      method: init.method ?? "GET",
      url,
      sprache: kopf["accept-language"] ?? "",
      payload,
    });
    if (bremse) {
      await bremse;
    }
    const res = await app.inject({
      method: (init.method ?? "GET") as "GET" | "POST",
      url,
      headers: kopf,
      ...(payload !== undefined ? { payload } : {}),
    });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    } as unknown as Response;
  }) as typeof fetch;
}

// ------------------------------------------------------------------------------------------------
// DIE MASKE: mounten, tippen, absenden, lesen.
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function abbauen(): void {
  if (root) {
    const r = root;
    act(() => {
      r.unmount();
    });
    root = null;
  }
  container?.remove();
  container = null;
}

function mounten(): void {
  abbauen();
  const el = document.createElement("div");
  document.body.appendChild(el);
  container = el;
  root = createRoot(el);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const r = root;
  act(() => {
    r.render(
      createElement(
        MemoryRouter,
        null,
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(AuthScreens, { needsSetup: false } as never),
        ),
      ),
    );
  });
}

function feld(typ: string): HTMLInputElement {
  const treffer = [...(container?.querySelectorAll("input") ?? [])].find((f) => f.type === typ);
  if (!(treffer instanceof HTMLInputElement)) {
    throw new Error(`Feld vom Typ ${typ} nicht in der Maske gefunden`);
  }
  return treffer;
}

function absendeKnopf(): HTMLButtonElement {
  const knopf = container?.querySelector('form button[type="submit"]');
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error("Absendeknopf nicht gefunden");
  }
  return knopf;
}

/**
 * DER FEHLERKASTEN, und nur er: `AuthScreens.tsx:205-209` ist der einzige Träger von
 * `bg-trust-crit-bg` in dieser Maske. Der Satz wird also dort gelesen, wo der Mensch ihn liest —
 * nicht irgendwo im Seitentext (dort stünde er auch, wenn er an der falschen Stelle erschiene).
 */
function fehlerkasten(): HTMLElement | null {
  const treffer = [...(container?.querySelectorAll("form .bg-trust-crit-bg") ?? [])];
  expect(treffer.length, "mehr als ein Fehlerkasten in der Maske").toBeLessThan(2);
  const eins = treffer[0];
  return eins instanceof HTMLElement ? eins : null;
}

const fehlersatz = (): string => (fehlerkasten()?.textContent ?? "").trim();

async function tippen(el: HTMLInputElement, wert: string): Promise<void> {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

/** Der sichtbare Weg: Sprache am Umschalter der Maske wählen (`BrandPanel.tsx:154-180`). */
async function spracheWaehlen(l: Sprache): Promise<void> {
  const schalter = container?.querySelector('[data-testid="auth-lang-switch"]');
  const knopf = [...(schalter?.querySelectorAll("button") ?? [])].find(
    (b) => (b.textContent ?? "").trim().toLowerCase() === l,
  );
  if (!knopf) {
    throw new Error(`Sprachschalter ${l} nicht gefunden`);
  }
  await act(async () => {
    knopf.click();
    await flush();
  });
}

async function anmelden(konto: { email: string; password: string }): Promise<void> {
  await tippen(feld("email"), konto.email);
  await tippen(feld("password"), konto.password);
  await act(async () => {
    absendeKnopf().click();
    await flush();
  });
}

/** Eine frische Maske in der gewünschten Sprache, angemeldet mit dem gewünschten Konto. */
async function versuch(l: Sprache, konto: { email: string; password: string }): Promise<void> {
  mounten();
  await spracheWaehlen(l);
  await anmelden(konto);
}

const letzteAnfrage = (): Anfrage => {
  const a = anfragen.at(-1);
  if (!a) {
    throw new Error("keine Anfrage abgesetzt");
  }
  return a;
};

const allgemeinerNotsatz = (l: Sprache): string =>
  String(i18n.getResource(l, "translation", "state.error"));

beforeEach(async () => {
  services = buildServices();
  app = buildApp(services);
  // Der Admin zuerst: ein Gast, der zugleich der letzte Admin wäre, träfe beim Befristen den
  // Aussperrschutz (dieselbe Überlegung wie in ablauf-meldung.test.ts:46-48).
  const admin = await services.auth.register(ADMIN);
  const gast = await services.auth.register(ABGELAUFENER_GAST);
  await services.auth.approveUser(gast.id, admin.id);
  await services.auth.setAccessExpiry(gast.id, ABGELAUFEN, admin.id);
  const gueltig = await services.auth.register(GUELTIGER_GAST);
  await services.auth.approveUser(gueltig.id, admin.id);
  await services.auth.register(OHNE_FREIGABE);

  anfragen = [];
  bremse = null;
  sitzung.aufgefrischt = 0;
  fetchVorher = globalThis.fetch;
  brueckeAufbauen();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  globalThis.fetch = fetchVorher;
  await app.close();
  await i18n.changeLanguage("de");
});

// ================================================================================================
// A1 — DER SATZ KOMMT AN, IN DREI SPRACHEN
// ================================================================================================

describe("JOB 3821 A1 · der abgelaufene Gast liest seinen Satz im Fehlerkasten", () => {
  it("A1 — DE, EN und NL zeigen den Satz aus MELDUNGEN.ACCESS_EXPIRED", async () => {
    for (const l of SPRACHEN) {
      await versuch(l, ABGELAUFENER_GAST);

      // Die Anfrage ist wirklich gelaufen — sonst läse man einen Kasten von vorhin.
      expect(letzteAnfrage().url, `Sprache ${l}`).toBe("/api/auth/login");
      expect(letzteAnfrage().method, `Sprache ${l}`).toBe("POST");
      expect(fehlerkasten(), `kein Fehlerkasten in ${l}`).not.toBeNull();
      expect(fehlersatz(), `falscher Satz in ${l}`).toBe(MELDUNGEN.ACCESS_EXPIRED[l]);
      // Und NICHT der Satz des Nachbarn (die Verwechslung, die JOB 3756 beseitigt hat).
      expect(fehlersatz(), `Nachbarsatz in ${l}`).not.toBe(MELDUNGEN.NOT_APPROVED[l]);
    }
  });

  it("A1-DE — und dieser Satz lautet wörtlich „Ihr Zugang ist abgelaufen. Bitte vom Admin verlängern lassen.“", async () => {
    // Die eine Stelle mit ausgeschriebenem Wortlaut: der Katalogwert allein sagt einem Menschen
    // nicht, WAS zugesichert ist. Dreht jemand den Katalogtext, wird genau dieser Fall rot.
    //
    // JOB 4265 NACHGEFÜHRT: Der Satz nennt seit 4265 nach der Lage auch die HANDLUNG — der Gast
    // liest, an wen er sich wendet. Der Pin bleibt wörtlich und ungekürzt; gerade weil die Maske
    // den Serversatz unverändert durchreicht, ist er hier der Nachweis, dass sie nichts abschneidet.
    await versuch("de", ABGELAUFENER_GAST);

    expect(fehlersatz()).toBe("Ihr Zugang ist abgelaufen. Bitte vom Admin verlängern lassen.");
  });
});

// ================================================================================================
// A2 — DER NACHBAR BLEIBT UNTERSCHEIDBAR
// ================================================================================================

describe("JOB 3821 A2 · zwei Lagen, zwei Sätze — an der Oberfläche", () => {
  it("A2 — abgelaufen und „noch nicht freigegeben“ zeigen VERSCHIEDENE Sätze", async () => {
    // Beide Lagen über dieselbe Maske, nacheinander, und dann der Vergleich der beiden SICHTBAREN
    // Sätze. Das ist die Zusage von JOB 3756, hier erstmals am Fehlerkasten gehalten: „ein
    // gemeinsamer Satz schickte die Hälfte der Betroffenen in die falsche Richtung"
    // (`services/auth/src/meldungen.ts:18-23`).
    await versuch("de", ABGELAUFENER_GAST);
    const satzAbgelaufen = fehlersatz();

    await versuch("de", OHNE_FREIGABE);
    const satzOhneFreigabe = fehlersatz();

    expect(satzAbgelaufen).toBe(MELDUNGEN.ACCESS_EXPIRED.de);
    expect(satzOhneFreigabe).toBe(MELDUNGEN.NOT_APPROVED.de);
    expect(
      satzAbgelaufen,
      "beide Lagen lesen denselben Satz — die Unterscheidung ist weg",
    ).not.toBe(satzOhneFreigabe);
  });

  it("A2-EN/NL — die Unterscheidung hält auch in den anderen beiden Sprachen", async () => {
    for (const l of ["en", "nl"] as const) {
      await versuch(l, ABGELAUFENER_GAST);
      const satzAbgelaufen = fehlersatz();

      await versuch(l, OHNE_FREIGABE);
      const satzOhneFreigabe = fehlersatz();

      expect(satzAbgelaufen, `Sprache ${l}`).toBe(MELDUNGEN.ACCESS_EXPIRED[l]);
      expect(satzOhneFreigabe, `Sprache ${l}`).toBe(MELDUNGEN.NOT_APPROVED[l]);
      expect(satzAbgelaufen, `Sprache ${l}: beide Lagen lesen denselben Satz`).not.toBe(
        satzOhneFreigabe,
      );
    }
  });
});

// ================================================================================================
// A3 — DIE SPRACHE DES MENSCHEN ENTSCHEIDET, NICHT DIE DES SERVERS
// ================================================================================================

describe("JOB 3821 A3 · die Anfrage trägt die eingestellte Sprache mit", () => {
  it("A3 — der Umschalter der Maske bestimmt Accept-Language UND den Satz im Kasten", async () => {
    for (const l of SPRACHEN) {
      await versuch(l, ABGELAUFENER_GAST);

      // BEOBACHTET an der abgesetzten Anfrage (`client.ts:23`), nicht angenommen.
      expect(letzteAnfrage().sprache, `Accept-Language bei Wahl ${l}`).toBe(l);
      // Und der Kasten zeigt den Satz DIESER Sprache — nicht den einer anderen.
      expect(fehlersatz(), `Satz bei Wahl ${l}`).toBe(MELDUNGEN.ACCESS_EXPIRED[l]);
      for (const andere of SPRACHEN.filter((s) => s !== l)) {
        expect(fehlersatz(), `bei Wahl ${l} steht der ${andere}-Satz da`).not.toBe(
          MELDUNGEN.ACCESS_EXPIRED[andere],
        );
      }
    }
  });
});

// ================================================================================================
// A4 — DER ALLGEMEINE NOTSATZ ERSCHEINT NICHT
// ================================================================================================

describe('JOB 3821 A4 · der Zweig `t("state.error")` greift in diesen Lagen nicht', () => {
  it("A4 — in keiner der drei Sprachen steht der allgemeine Satz im Kasten", async () => {
    // Ohne diesen Fall könnte `AuthScreens.tsx:40` den Servertext still verwerfen: der Kasten wäre
    // gefüllt, die Unterscheidung aus A2 aber dahin — und ein Test, der nur „irgendein Fehler"
    // prüft, sähe grün aus.
    for (const l of SPRACHEN) {
      await versuch(l, ABGELAUFENER_GAST);

      expect(fehlersatz(), `Notsatz statt Ablaufsatz in ${l}`).not.toBe(allgemeinerNotsatz(l));
      // Auch nicht der Notsatz einer anderen Sprache.
      for (const andere of SPRACHEN) {
        expect(fehlersatz(), `Notsatz (${andere}) bei Wahl ${l}`).not.toBe(
          allgemeinerNotsatz(andere),
        );
      }
    }
  });
});

// ================================================================================================
// DAS ZUSTANDSMODELL DER EINEN AUSSAGE (§9 des Auftrags)
// ================================================================================================

describe("JOB 3821 Z · die Zustände des Fehlerkastens", () => {
  it("Z1 — laden: solange die Anmeldung läuft, steht dort NICHTS und der Knopf ist gesperrt", async () => {
    let freigeben: () => void = () => {};
    bremse = new Promise<void>((r) => {
      freigeben = r;
    });

    mounten();
    await anmelden(ABGELAUFENER_GAST);

    // Die Anfrage ist abgesetzt, die Antwort hängt: kein Kasten, kein Satz, Knopf gesperrt.
    expect(letzteAnfrage().url).toBe("/api/auth/login");
    expect(fehlerkasten(), "Fehlerkasten steht schon vor der Antwort da").toBeNull();
    expect(absendeKnopf().disabled, "Knopf ist während der Anmeldung nicht gesperrt").toBe(true);

    freigeben();
    bremse = null;
    await act(async () => {
      await flush();
    });

    expect(fehlersatz()).toBe(MELDUNGEN.ACCESS_EXPIRED.de);
    expect(absendeKnopf().disabled).toBe(false);
  });

  it("Z2 — erfolgreich: ein Konto ohne Befristung kommt herein, ohne Kasten", async () => {
    // Die Kalibrierung gegen ein Dauer-Nein: eine Sperre, die IMMER zuschlägt, erfüllte A1 bis A4.
    await versuch("de", GUELTIGER_GAST);

    expect(fehlerkasten()).toBeNull();
    expect(sitzung.aufgefrischt, "die gelungene Anmeldung hat die Sitzung nicht aufgefrischt").toBe(
      1,
    );
  });

  it("Z3 — kein Zwischenspeicher: die Anmeldung ist eine einmalige Absendung (Quelltextbeleg)", async () => {
    // §9 verlangt den BELEG statt der Behauptung, dass es hier keinen „Cache mit laufender bzw.
    // gescheiterter Auffrischung" gibt: der Satz hängt an einer Mutation, nicht an einer Abfrage.
    // Quelltextnachweis, ausdrücklich kein ausgeführter Nachweis (BEN zu 3756: beides ist zu
    // unterscheiden).
    const quelle = readFileSync(
      join(__dirname, "..", "..", "apps", "web", "src", "auth", "AuthScreens.tsx"),
      "utf8",
    );
    expect(quelle).toContain("mutationFn: () => authApi.login(email, pw)");
    expect(quelle).toContain('setErr(e instanceof ApiError ? e.message : t("state.error"))');
    expect(quelle, "die Maske hält den Anmeldezustand plötzlich in einer Abfrage").not.toContain(
      "useQuery",
    );
    expect(quelle, "ein Zwischenspeicher an der Anmeldung wäre ein neuer Zustand").not.toContain(
      "staleTime",
    );
  });
});
