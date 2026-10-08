// @vitest-environment jsdom
// ================================================================================================
// KLARA 01 (produkt:20261008:klara-basis) — DIE BEWEGLICHE KLARA GEGEN DEN ECHTEN SERVER.
// ================================================================================================
//
// Die echte Hülle (`AppShell`) mit der echten beweglichen Klara, verbunden über den Draht aus
// `tests/klara-quellen-nutzerweg/kette.ts` mit der ECHTEN App im selben Prozess: echte Anmeldung,
// echter Frageweg `POST /api/ask` (Rechte, Sichtbarkeit, Freigaben, Abschaltung), echte Ablage der
// Gespräche (`/api/me/klara/...`). An der Stelle des Modells antwortet der KONTROLLIERTE ADAPTER der
// Kette über den lokalen Modellweg — er gibt den Wortlaut der ihm vorgelegten Quelle zurück. Damit ist
// belegt, dass eine vom Modellweg formulierte Antwort (`demo: false`) als „KI-Antwort" erscheint und
// eine ohne Modell entstandene nie so heisst; über die SEMANTISCHE Güte eines echten Anbieters sagt
// dieser Lauf nichts.
//
// „Neuladen" ist hier: Klara abbauen, den Gesprächsspeicher des Browsers vergessen (`vergiss`, das
// ist genau der Speicher, den ein Neuladen leert) und neu montieren. „Erneute Anmeldung" ist eine
// neue Sitzung über `POST /api/auth/login`. Layout, echte Tastatur, schmale Fenster und Vollbild im
// Browser misst `tests-smoke/klara-basis-browser.spec.ts`.
//
// ZWEI STELLEN SIND TRANSPORT-ATTRAPPEN, ausdrücklich: ein Frageweg, der nicht antwortet, bis die
// Person stoppt (E3), und ein Frageweg, der mit 403 abweist (E7) — beides lässt sich am echten Server
// nicht auf Kommando herstellen. Alles andere ist der echte Server.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { Link, MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import {
  alle,
  bis,
  klick,
  medienStub,
  q,
  ruhe,
  tippe,
  warte,
} from "../fe003-tutorial-fragen/huelle";
import {
  type Aufbau,
  BELEGSTELLE,
  type Draht,
  FRAGE,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();

/** Das Kennwort, mit dem `neuesKonto` jedes Konto anlegt (`kette.ts`). */
const KENNWORT = "geheim12345";

let draht: Draht;
let aufbau: Aufbau | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let echterFetch: typeof globalThis.fetch;

beforeAll(() => {
  draht = drahtAufbauen();
  echterFetch = globalThis.fetch;
});

afterAll(() => {
  draht.abbauen();
});

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  zuruecksetzenGanz();
  vergiss();
  setzeKlaraVorschauAktiv(true);
  medienStub();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  globalThis.fetch = echterFetch;
  window.fetch = echterFetch;
  vergiss();
  setzeKlaraVorschauAktiv(false);
  zuruecksetzenGanz();
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.lage.generierungen = 0;
  draht.lage.vorlagen.length = 0;
  draht.aufrufe.length = 0;
});

function abbauen(): void {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
  }
  container?.remove();
  container = null;
}

async function vorrichtung(ohneModell = false): Promise<{ a: Aufbau; leser: Konto }> {
  const a = await appAufbauen(ohneModell);
  aufbau = a;
  draht.setzeApp(a.app);
  await eintragMitOriginal(a.app, a.admin);
  const leser = await neuesKonto(a.app, "klara-basis", a.admin);
  draht.setzeCookie(`kw_session=${leser.token}`);
  return { a, leser };
}

/** Die echte Hülle mit zwei Seiten und einem Link dazwischen — für den Seitenwechsel. */
async function montiere(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const seite = createElement(
    "div",
    { "data-testid": "seite" },
    createElement(Link, { to: "/fragen", "data-testid": "zu-fragen" }, "Zu Fragen"),
  );
  await act(async () => {
    r.render(
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
                  { initialEntries: [pfad] },
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
  await bis(() => Boolean(q(document, "klara-figur")), 200);
}

async function gespraechOeffnen(): Promise<void> {
  if (!q(document, "klara-gespraech")) {
    await klick(q(document, "klara-figur"));
  }
  await bis(() => Boolean(q(document, "klara-gespraech")));
  // Das gespeicherte Gespräch kommt vom Server — warten, bis es gelesen ist (oder scheiterte).
  await bis(() => {
    const laden = q(document, "klara-echt-hinweis")?.dataset.laden;
    return laden === undefined || laden === "bereit" || laden === "fehler";
  }, 160);
}

async function einwilligen(): Promise<void> {
  await klick(q(document, "klara-einwilligung-erteilen"));
  await bis(() => Boolean(q(document, "klara-einwilligung-erteilt")), 120);
  expect(q(document, "klara-einwilligung-erteilt"), "Einwilligung nicht bestätigt").not.toBeNull();
}

async function fragen(text: string): Promise<void> {
  const eingabe = q<HTMLInputElement>(document, "klara-eingabe");
  if (!eingabe) {
    throw new Error("Klaras Eingabe fehlt");
  }
  await tippe(eingabe, text);
  await klick(q(document, "klara-senden"));
}

function nachrichten(): HTMLElement[] {
  return alle(document, "klara-nachricht");
}

function letzteKlara(): HTMLElement | undefined {
  const klara = nachrichten().filter((n) => n.dataset.von === "klara");
  return klara[klara.length - 1];
}

async function bisAntwort(): Promise<HTMLElement> {
  await bis(() => {
    const n = letzteKlara();
    return Boolean(n && n.dataset.gespeichert !== "laeuft" && !q(document, "klara-stoppen"));
  }, 200);
  const n = letzteKlara();
  if (!n) {
    throw new Error("Keine Antwort von Klara");
  }
  return n;
}

interface ServerSicht {
  id: string;
  objektbezug: { pfad: string; seitenName: string; objekt: string };
  nachrichten: { von: string; modus: string; text: string; antwortId: string | null }[];
  letzterSchritt: { stand: string; text: string; objektbezug: { pfad: string } } | null;
  einwilligungAm: string | null;
}

async function serverGespraech(a: Aufbau, konto: Konto): Promise<ServerSicht | null> {
  const r = await a.app.inject({
    method: "GET",
    url: "/api/me/klara/gespraech",
    headers: konto.kopf,
  });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { gespraech: ServerSicht | null }).gespraech;
}

async function neuAnmelden(a: Aufbau, email: string): Promise<Konto> {
  const r = await a.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(r.statusCode, r.body).toBe(200);
  const token = (r.json() as { token: string }).token;
  return { email, token, kopf: { authorization: `Bearer ${token}` } };
}

/** Neuladen: Klara abbauen, den Gesprächsspeicher des Browsers leeren, neu montieren. */
async function neuLaden(pfad: string): Promise<void> {
  abbauen();
  vergiss();
  await montiere(pfad);
  await gespraechOeffnen();
}

/** Ersetzt NUR `POST /api/ask` — alles andere bleibt der echte Server über den Draht. */
function frageweg(ersatz: (init: RequestInit | undefined) => Promise<Response>): void {
  const weiter = globalThis.fetch;
  const neu = (async (eingabe: unknown, init?: RequestInit) => {
    if (String(eingabe) === "/api/ask") {
      return ersatz(init);
    }
    return weiter(eingabe as RequestInfo, init);
  }) as typeof globalThis.fetch;
  globalThis.fetch = neu;
  window.fetch = neu;
}

describe("E1 · K1/K2/K3 — echte KI-Antwort, gespeichert, nach Seitenwechsel, Neuladen und neuer Anmeldung", () => {
  it("die Antwort des Modellwegs heisst „KI-Antwort“ und das Gespräch bleibt der eigenen Person", async () => {
    const { a, leser } = await vorrichtung();
    await montiere("/klara-vorschau");
    await gespraechOeffnen();

    // Echter Betrieb ist der Anfang, sichtbar; ohne Einwilligung geht keine Frage los.
    expect(q(document, "klara-betrieb")?.dataset.betrieb).toBe("echt");
    expect(q(document, "klara-figur")?.dataset.betrieb).toBe("echt");
    expect(q(document, "klara-demo-hinweis")).toBeNull();
    const eingabe = q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement;
    await tippe(eingabe, FRAGE);
    expect(q<HTMLButtonElement>(document, "klara-senden")?.disabled).toBe(true);
    expect(draht.aufrufe.some((x) => x.url === "/api/ask")).toBe(false);

    await einwilligen();
    await klick(q(document, "klara-senden"));
    const antwort = await bisAntwort();
    expect(antwort.dataset.modus).toBe("ki");
    expect(antwort.dataset.gespeichert).toBe("ja");
    expect(antwort.textContent).toContain(BELEGSTELLE);
    expect(antwort.querySelector('[data-testid="klara-echt-kennzeichen"]')?.textContent).toBe(
      "KI-Antwort",
    );
    expect(draht.lage.generierungen, "der Modellweg muss gerufen sein").toBeGreaterThan(0);
    expect(draht.lage.zuletzt ?? "").toContain(BELEGSTELLE);
    expect(q(document, "klara-gespraech")?.textContent).not.toContain("Demo-Antwort");
    expect(q(document, "klara-letzter-schritt")?.dataset.stand).toBe("beantwortet");

    // Am Server: unter der eigenen Person, mit geprüfter Antwortkennung und Objektbezug.
    const amServer = await serverGespraech(a, leser);
    expect(amServer?.objektbezug.pfad).toBe("/klara-vorschau");
    expect(amServer?.nachrichten.map((n) => [n.von, n.modus])).toEqual([
      ["du", "frage"],
      ["klara", "ki"],
    ]);
    expect(amServer?.nachrichten[1]?.antwortId).toBeTruthy();
    expect(amServer?.letzterSchritt).toMatchObject({ stand: "beantwortet", text: FRAGE });
    const beginn = q(document, "klara-gespraech-beginn")?.textContent ?? "";
    expect(beginn).toContain("Begonnen auf");

    // Seitenwechsel: Figur, Verlauf und Ursprung bleiben; der Rückweg zum Ursprung steht da.
    await klick(q(document, "zu-fragen"));
    await bis(() => q(document, "klara-ort-seite")?.textContent === "Fragen");
    expect(q(document, "klara-ort-seite")?.textContent).toBe("Fragen");
    expect(nachrichten()).toHaveLength(2);
    expect(q(document, "klara-gespraech-beginn")?.textContent).toContain(beginn.trim());
    expect(q(document, "klara-gespraech-beginn-link")?.getAttribute("href")).toBe(
      "/klara-vorschau",
    );

    // Neuladen: alles kommt vom Server zurück.
    await neuLaden("/fragen");
    await bis(() => nachrichten().length === 2, 120);
    expect(nachrichten().map((n) => n.dataset.modus)).toEqual(["frage", "ki"]);
    expect(letzteKlara()?.textContent).toContain(BELEGSTELLE);
    expect(q(document, "klara-gespraech-beginn")?.textContent).toContain(beginn.trim());
    expect(q(document, "klara-letzter-schritt")?.dataset.stand).toBe("beantwortet");
    expect(q(document, "klara-einwilligung-erteilt")).not.toBeNull();

    // Erneute Anmeldung: neue Sitzung, dasselbe Gespräch.
    const wieder = await neuAnmelden(a, leser.email);
    draht.setzeCookie(`kw_session=${wieder.token}`);
    await neuLaden("/klara-vorschau");
    await bis(() => nachrichten().length === 2, 120);
    expect(nachrichten().map((n) => n.dataset.modus)).toEqual(["frage", "ki"]);
    expect(q(document, "klara-gespraech-beginn")?.textContent).toContain(beginn.trim());

    // Eine fremde Person: kein Zugriff — weder in Klara noch am Server.
    const fremd = await neuesKonto(a.app, "klara-basis-fremd", a.admin);
    draht.setzeCookie(`kw_session=${fremd.token}`);
    await neuLaden("/klara-vorschau");
    await bis(() => Boolean(q(document, "klara-echt-leer")), 120);
    expect(nachrichten()).toHaveLength(0);
    expect(q(document, "klara-gespraech")?.textContent).not.toContain(FRAGE);
    expect(await serverGespraech(a, fremd)).toBeNull();
    const direkt = await a.app.inject({
      method: "GET",
      url: `/api/me/klara/gespraeche/${amServer?.id}`,
      headers: fremd.kopf,
    });
    expect(direkt.statusCode).toBe(404);
  });
});

describe("E2 · K1 — ohne Modell heisst eine Antwort nie „KI-Antwort“", () => {
  it("ohne Modell: Hinweis vorab, Antwort als „Ohne KI“ gekennzeichnet, kein Modellaufruf", async () => {
    await vorrichtung(true);
    await montiere("/klara-vorschau");
    await gespraechOeffnen();
    await bis(() => Boolean(q(document, "klara-ki-ohne-modell")), 120);
    expect(q(document, "klara-ki-ohne-modell")).not.toBeNull();
    await einwilligen();
    await fragen(FRAGE);
    const antwort = await bisAntwort();
    expect(antwort.dataset.modus).toBe("ohne_ki");
    expect(antwort.querySelector('[data-testid="klara-echt-kennzeichen"]')?.textContent).toBe(
      "Ohne KI · wörtlich aus geprüftem Wissen",
    );
    expect(q(document, "klara-gespraech")?.textContent).not.toContain("KI-Antwort");
    expect(draht.lage.generierungen).toBe(0);
  });
});

describe("E3 · K4 — eine laufende Anfrage stoppen", () => {
  it("„Anfrage stoppen“ bricht ab; Klara sagt, dass keine Antwort kam, und hält das fest", async () => {
    const { a, leser } = await vorrichtung();
    await montiere("/klara-vorschau");
    await gespraechOeffnen();
    await einwilligen();
    // ATTRAPPE: ein Frageweg, der erst auf den Abbruch reagiert.
    const haengt = (init: RequestInit | undefined): Promise<Response> =>
      new Promise<Response>((_, ablehnen) => {
        const abbruch = (): void => ablehnen(new DOMException("abgebrochen", "AbortError"));
        init?.signal?.addEventListener("abort", abbruch);
      });
    frageweg(haengt);
    await fragen("Eine Frage, die zu lange dauert");
    await bis(() => Boolean(q(document, "klara-stoppen")), 120);
    expect(q(document, "klara-laeuft-seit")?.textContent).toMatch(/Anfrage läuft seit \d+ s/);
    expect(q(document, "klara-figur")?.dataset.status).toBe("laeuft");
    await klick(q(document, "klara-stoppen"));
    const n = await bisAntwort();
    expect(n.dataset.modus).toBe("abgebrochen");
    expect(n.dataset.gespeichert).toBe("ja");
    expect(n.textContent).toContain("Anfrage gestoppt");
    await bis(() => q(document, "klara-letzter-schritt")?.dataset.stand === "abgebrochen");
    expect(q(document, "klara-letzter-schritt")?.dataset.stand).toBe("abgebrochen");
    expect(q(document, "klara-schritt-nochmal")).not.toBeNull();
    expect(q(document, "klara-senden")).not.toBeNull();
    const amServer = await serverGespraech(a, leser);
    expect(amServer?.nachrichten.map((m) => m.modus)).toEqual(["frage", "abgebrochen"]);
    expect(amServer?.letzterSchritt?.stand).toBe("abgebrochen");
  });
});

describe("E4 · K4 — abgelaufene Anmeldung und fehlgeschlagene Speicherung", () => {
  it("nichts wird als gespeichert ausgegeben, was der Server nicht bestätigt hat — erneutes Speichern geht", async () => {
    const { a, leser } = await vorrichtung();
    await montiere("/klara-vorschau");
    await gespraechOeffnen();
    await einwilligen();
    // Die Sitzung ist weg (Abmeldung in einem anderen Tab, Ablauf): der echte Server sagt 401.
    draht.setzeCookie(null);
    await fragen("Frage nach Sitzungsende");
    const fehler = await bisAntwort();
    expect(fehler.dataset.modus).toBe("fehler");
    expect(fehler.textContent).toContain("Anmeldung ist abgelaufen");
    const frage = nachrichten().find((n) => n.dataset.von === "du");
    expect(frage?.dataset.gespeichert).toBe("nein");
    expect(frage?.textContent).toContain("Nicht gespeichert");
    expect(fehler.dataset.gespeichert).toBe("nein");
    expect(q(document, "klara-schritt-nicht-gespeichert")).not.toBeNull();
    expect((await serverGespraech(a, leser))?.nachrichten).toEqual([]);

    // Wieder angemeldet: „Erneut speichern“ legt die Frage wirklich ab.
    draht.setzeCookie(`kw_session=${leser.token}`);
    await klick(frage?.querySelector('[data-testid="klara-nochmal-speichern"]'));
    await bis(
      () => nachrichten().find((n) => n.dataset.von === "du")?.dataset.gespeichert === "ja",
    );
    expect(nachrichten().find((n) => n.dataset.von === "du")?.dataset.gespeichert).toBe("ja");
    expect((await serverGespraech(a, leser))?.nachrichten.map((n) => n.text)).toEqual([
      "Frage nach Sitzungsende",
    ]);
  });

  it("ein anderswo gelöschtes Gespräch: die neue Nachricht steht als „Nicht gespeichert“ da", async () => {
    const { a, leser } = await vorrichtung();
    await montiere("/klara-vorschau");
    await gespraechOeffnen();
    await einwilligen();
    const g = await serverGespraech(a, leser);
    const geloescht = await a.app.inject({
      method: "DELETE",
      url: `/api/me/klara/gespraeche/${g?.id}`,
      headers: leser.kopf,
    });
    expect(geloescht.statusCode).toBe(200);
    await fragen(FRAGE);
    await bisAntwort();
    for (const n of nachrichten()) {
      expect(n.dataset.gespeichert, n.textContent ?? "").toBe("nein");
    }
    expect(await serverGespraech(a, leser)).toBeNull();
  });
});

describe("E5 · K5 — die KI-Abschaltung wirkt in Klara", () => {
  it("abgeschaltet während Klara offen ist: der Satz des Servers; danach ist Senden gesperrt", async () => {
    const { a } = await vorrichtung();
    await montiere("/klara-vorschau");
    await gespraechOeffnen();
    await einwilligen();
    const aus = await a.app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      headers: a.admin.kopf,
      payload: { global: "deterministic" },
    });
    expect(aus.statusCode, aus.body).toBe(200);
    await fragen(FRAGE);
    const n = await bisAntwort();
    expect(n.dataset.modus).toBe("fehler");
    expect(n.textContent).toContain("Der Administrator hat die KI abgeschaltet");
    expect(n.dataset.gespeichert).toBe("ja");
    expect(draht.lage.generierungen).toBe(0);

    await neuLaden("/klara-vorschau");
    await bis(() => Boolean(q(document, "klara-ki-aus")), 120);
    expect(q(document, "klara-ki-aus")?.textContent).toContain("abgeschaltet");
    await tippe(q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement, FRAGE);
    expect(q<HTMLButtonElement>(document, "klara-senden")?.disabled).toBe(true);
    expect(q(document, "klara-schritt-nochmal")).toBeNull();
  });
});

describe("E6 · K5 — Vertraulichkeit und Freigabe wirken in Klara", () => {
  it("ein vertrauliches Objekt erreicht weder den Modellweg noch Klaras Gespräch; die Freigabelage steht da", async () => {
    const { a, leser } = await vorrichtung();
    const GEHEIM = "Der Prüfdruck QZ9 beträgt 777 bar.";
    const angelegt = await a.app.inject({
      method: "POST",
      url: "/api/kos",
      headers: a.admin.kopf,
      payload: {
        title: "Prüfdruck QZ9",
        statement: GEHEIM,
        type: "best_practice",
        category: "Betrieb",
        confidentiality: "vertraulich",
        neededValidations: 1,
      },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const koId = (angelegt.json() as { id: string }).id;
    const frei = await a.app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: a.admin.kopf,
      payload: { action: "admin-validate" },
    });
    expect(frei.statusCode, frei.body).toBe(200);

    await montiere("/klara-vorschau");
    await gespraechOeffnen();
    await bis(() => Boolean(q(document, "klara-extern")), 120);
    expect(q(document, "klara-extern")?.dataset.extern).toBe("blockiert");
    await einwilligen();
    await fragen("Wie hoch ist der Prüfdruck QZ9?");
    await bisAntwort();
    expect(q(document, "klara-gespraech")?.textContent).not.toContain("777");
    expect(draht.lage.vorlagen.join("\n")).not.toContain("777");
    expect(JSON.stringify(await serverGespraech(a, leser))).not.toContain("777");
  });
});

describe("E7 · K4 — abgewiesene Berechtigung zeigt den tatsächlichen Zustand", () => {
  it("403 vom Frageweg: „Dir fehlt die Berechtigung“, gespeichert als Fehler, nicht als Antwort", async () => {
    const { a, leser } = await vorrichtung();
    await montiere("/klara-vorschau");
    await gespraechOeffnen();
    await einwilligen();
    // ATTRAPPE: jede Rolle trägt `ko.read`; ein 403 am Frageweg lässt sich hier nicht herstellen.
    const verweigert = async (): Promise<Response> =>
      new Response(JSON.stringify({ error: "FORBIDDEN", message: "Keine Berechtigung." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    frageweg(verweigert);
    await fragen(FRAGE);
    const n = await bisAntwort();
    expect(n.dataset.modus).toBe("fehler");
    expect(n.textContent).toContain("Dir fehlt die Berechtigung");
    expect(n.textContent).not.toContain("KI-Antwort");
    const amServer = await serverGespraech(a, leser);
    expect(amServer?.nachrichten.map((m) => m.modus)).toEqual(["frage", "fehler"]);
    expect(amServer?.letzterSchritt?.stand).toBe("fehlgeschlagen");
  });
});

describe("E8 · Demo und echter Betrieb sind unterscheidbar; Klaras Hilfe ist Teil des Gesprächs", () => {
  it("Hilfe ohne KI im echten Betrieb; Demo-Antworten nur im Demo-Betrieb und ohne Frageweg", async () => {
    const { a, leser } = await vorrichtung();
    await montiere("/klara-vorschau");
    await gespraechOeffnen();

    // Bedienhilfe zu dieser Fähigkeit — direkt in Klara.
    expect(q(document, "klara-bedienhilfe")?.textContent).toContain("Anfrage stoppen");

    await klick(q(document, "klara-modus-erklaere"));
    await warte(500);
    await bis(() => letzteKlara()?.dataset.gespeichert === "ja", 120);
    expect(letzteKlara()?.dataset.modus).toBe("hilfetext");
    const kennzeichen = letzteKlara()?.querySelector('[data-testid="klara-echt-kennzeichen"]');
    expect(kennzeichen?.textContent).toBe("Klarwerk-Hilfe · ohne KI");
    expect((await serverGespraech(a, leser))?.nachrichten.map((n) => n.modus)).toEqual([
      "hilfe",
      "hilfetext",
    ]);

    await klick(q(document, "klara-betrieb-demo"));
    expect(q(document, "klara-betrieb")?.dataset.betrieb).toBe("demo");
    expect(q(document, "klara-demo-hinweis")).not.toBeNull();
    expect(q(document, "klara-figur-demo")).not.toBeNull();
    const vorher = draht.aufrufe.length;
    await fragen("Was kann ich hier tun?");
    await warte(800);
    expect(letzteKlara()?.textContent).toContain("Demo-Antwort · vorgefertigt");
    expect(draht.aufrufe.slice(vorher).some((x) => x.url === "/api/ask")).toBe(false);

    await klick(q(document, "klara-betrieb-echt"));
    expect(q(document, "klara-betrieb")?.dataset.betrieb).toBe("echt");
    expect(nachrichten().map((n) => n.dataset.modus)).toEqual(["hilfe", "hilfetext"]);
    expect(q(document, "klara-gespraech")?.textContent).not.toContain("Demo-Antwort");
  });
});
