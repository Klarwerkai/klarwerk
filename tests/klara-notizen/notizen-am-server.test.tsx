// @vitest-environment jsdom
// ================================================================================================
// KLARA 06 (produkt:20261007:klara-notizen-aufgaben) — DIE NOTIZEN IN KLARAS FLÄCHE AM ECHTEN SERVER.
// ================================================================================================
//
// Die echte Hülle (`AppShell`) mit der echten beweglichen Klara, verbunden über den Draht aus
// `tests/klara-quellen-nutzerweg/kette.ts` mit der ECHTEN App im selben Prozess: echte Anmeldung,
// echte Ablage der Notizen (`/api/me/klara/notizen`) und Gespräche. „Neuladen" ist: Klara abbauen,
// den Browserzustand vergessen (`vergiss`) und neu montieren; „erneute Anmeldung" ist eine neue
// Sitzung über `POST /api/auth/login`.
//
// ATTRAPPEN, ausdrücklich: das Browser-Diktat (`SpeechRecognition` gibt es in jsdom nicht — dieselbe
// Doppelung wie in `tests/klara-sprache/`), eine einmalige Störung des Drahts VOR dem Server
// (`stoerungEinmal`) und eine Antwort, die NACH dem echten Speichern verloren geht. Alles andere ist
// der echte Server.
//
//   U1 (K1/K2) Getippt als Notiz speichern, nach erneuter Anmeldung öffnen (gleicher Inhalt,
//              Rücklink), bearbeiten, offene Fragen als Arbeitszettel, wiederfinden über die Suche.
//   U2 (K1)    Diktiert als Notiz speichern — der Weg heisst „diktiert", gesendet wird nichts.
//   U3 (K1)    Aus einer gespeicherten Gesprächsnachricht: Wortlaut vom Server, zweimal = eine.
//   U4 (K4)    Fehlgeschlagene Speicherung sichtbar; „Erneut speichern" ohne Doppelnotiz, auch wenn
//              der erste Versuch am Server ankam.
//   U5 (K3)    Eine andere Person sieht in Klara keine fremde Notiz; Bedienhilfe nennt die Fähigkeit.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
  type Draht,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();

const KENNWORT = "geheim12345";
const NOTIZ_URL = "/api/me/klara/notizen";

interface ServerNotiz {
  id: string;
  weg: string;
  art: string;
  titel: string;
  inhalt: string;
  offeneFragen: string[];
  objektbezug: { pfad: string; seitenName: string; objekt: string };
  quelle: { gespraechId: string; nachrichtId: string } | null;
  fassung: number;
}

// ------------------------------------------------------------------------------------------------
// Die Attrappe des Browser-Diktats (wie `tests/klara-sprache/klara-sprache-am-server.test.tsx`).
// ------------------------------------------------------------------------------------------------
type Ergebnis = ArrayLike<{ transcript: string }> & { isFinal?: boolean };

class RekorderDoppel {
  static letzter: RekorderDoppel | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Ergebnis> }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e?: { error?: string }) => void) | null = null;
  constructor() {
    RekorderDoppel.letzter = this;
  }
  start(): void {}
  stop(): void {
    this.onend?.();
  }
  hoert(text: string): void {
    this.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: text }], { isFinal: true })],
    });
  }
}

const fenster = window as unknown as Record<string, unknown>;

// ------------------------------------------------------------------------------------------------
// Vorrichtung (wie Klara 01).
// ------------------------------------------------------------------------------------------------
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
  fenster.SpeechRecognition = undefined;
  fenster.webkitSpeechRecognition = undefined;
  RekorderDoppel.letzter = null;
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
  fenster.SpeechRecognition = undefined;
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.setzeCookie(null);
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

async function vorrichtung(): Promise<{ a: Aufbau; leser: Konto }> {
  const a = await appAufbauen(true);
  aufbau = a;
  draht.setzeApp(a.app);
  const leser = await neuesKonto(a.app, "klara-notizen", a.admin);
  draht.setzeCookie(`kw_session=${leser.token}`);
  return { a, leser };
}

async function montiere(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const seite = createElement("div", { "data-testid": "seite" }, "Seite");
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

/** Klara öffnen und warten, bis Gespräch UND Notizen vom Server gelesen sind. */
async function oeffnen(): Promise<void> {
  if (!q(document, "klara-gespraech")) {
    await klick(q(document, "klara-figur"));
  }
  await bis(() => Boolean(q(document, "klara-gespraech")));
  await bis(() => {
    const laden = q(document, "klara-echt-hinweis")?.dataset.laden;
    return laden === undefined || laden === "bereit" || laden === "fehler";
  }, 160);
  await bis(() => Boolean(q(document, "klara-notizen-leer")) || eintraege().length > 0, 160);
}

function eintraege(): HTMLElement[] {
  return alle(document, "klara-notiz-eintrag");
}

async function suche(wort: string): Promise<void> {
  await tippe(q<HTMLInputElement>(document, "klara-notizen-suche") as HTMLInputElement, wort);
  await klick(q(document, "klara-notizen-suchen"));
}

async function neuLaden(pfad: string): Promise<void> {
  abbauen();
  vergiss();
  await montiere(pfad);
  await oeffnen();
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

async function serverNotizen(a: Aufbau, konto: Konto): Promise<ServerNotiz[]> {
  const r = await a.app.inject({ method: "GET", url: NOTIZ_URL, headers: konto.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { notizen: ServerNotiz[] }).notizen;
}

/** Schreibt wie ein Mensch in ein kontrolliertes Textfeld (mehrzeilig). */
async function schreibe(feld: HTMLTextAreaElement | null, text: string): Promise<void> {
  if (!feld) {
    throw new Error("Textfeld fehlt");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await ruhe(3);
}

async function alsNotiz(text: string): Promise<void> {
  const eingabe = q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement;
  await tippe(eingabe, text);
  await klick(q(document, "klara-als-notiz"));
}

function ausstehend(): HTMLElement[] {
  return alle(document, "klara-notiz-ausstehend");
}

describe("U1 · K1/K2 — getippt gespeichert, nach erneuter Anmeldung geöffnet, bearbeitet, gefunden", () => {
  it("Inhalt und Rücklink bleiben gleich; Änderung und Arbeitszettel stehen am Server", async () => {
    const { a, leser } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    expect(q(document, "klara-notizen-privat")?.textContent).toContain("Nur für dich");
    expect(q(document, "klara-notizen-leer")).not.toBeNull();

    const text = "Dichtung der Presse 4 erst nach dem Abkühlen tauschen";
    await alsNotiz(text);
    await bis(() => Boolean(q(document, "klara-notiz-offen")), 120);
    // Gesendet wird nichts: kein Frageweg, keine Einwilligung nötig, das Feld ist leer.
    expect(draht.aufrufe.some((x) => x.url === "/api/ask")).toBe(false);
    expect(q<HTMLInputElement>(document, "klara-eingabe")?.value).toBe("");
    expect(ausstehend()).toHaveLength(0);
    expect(q(document, "klara-notiz-meldung")?.textContent).toContain("gespeichert");
    const amServer = await serverNotizen(a, leser);
    expect(amServer).toHaveLength(1);
    expect(amServer[0]).toMatchObject({ weg: "geschrieben", inhalt: text, fassung: 1 });
    expect(amServer[0]?.objektbezug.pfad).toBe("/klara-vorschau");

    // Erneute Anmeldung, neu geladen: die Notiz kommt vom Server zurück — Wort für Wort.
    const wieder = await neuAnmelden(a, leser.email);
    draht.setzeCookie(`kw_session=${wieder.token}`);
    await neuLaden("/klara-vorschau");
    expect(eintraege()).toHaveLength(1);
    await klick(eintraege()[0]);
    await bis(() => Boolean(q(document, "klara-notiz-offen")), 120);
    expect(q<HTMLTextAreaElement>(document, "klara-notiz-inhalt")?.value).toBe(text);
    expect(q(document, "klara-notiz-ruecklink")?.getAttribute("href")).toBe("/klara-vorschau");
    expect(q(document, "klara-notiz-herkunft")?.textContent).toContain("geschrieben");

    // Bearbeiten: Text, offene Fragen, als Arbeitszettel behalten.
    const neuerText = `${text}. Zirbel-Merkwort`;
    await schreibe(q<HTMLTextAreaElement>(document, "klara-notiz-inhalt"), neuerText);
    await schreibe(
      q<HTMLTextAreaElement>(document, "klara-notiz-fragen"),
      "Wer liefert die Dichtung?\n\nWann ist Stillstand?",
    );
    await klick(q(document, "klara-notiz-arbeitszettel"));
    await klick(q(document, "klara-notiz-speichern"));
    await bis(() => q(document, "klara-notiz-offen")?.dataset.fassung === "2", 120);
    expect(q(document, "klara-notiz-offen")?.dataset.art).toBe("arbeitszettel");
    const geaendert = (await serverNotizen(a, wieder))[0];
    expect(geaendert).toMatchObject({
      fassung: 2,
      art: "arbeitszettel",
      inhalt: neuerText,
      offeneFragen: ["Wer liefert die Dichtung?", "Wann ist Stillstand?"],
    });

    // Eine zweite Notiz, dann wiederfinden über die Suche.
    await klick(q(document, "klara-notiz-schliessen"));
    await alsNotiz("Ganz andere Notiz zum Lager");
    await bis(() => eintraege().length === 2, 120);
    await suche("zirbel");
    await bis(() => eintraege().length === 1, 120);
    expect(eintraege().map((e) => e.dataset.art)).toEqual(["arbeitszettel"]);
    await suche("Getriebe");
    await bis(() => Boolean(q(document, "klara-notizen-leer")), 120);
    expect(q(document, "klara-notizen-leer")?.textContent).toContain("Keine eigene Notiz");
  });
});

describe("U2 · K1 — diktiert als Notiz gespeichert", () => {
  it("der Weg heisst „diktiert“; das Diktat sendet nichts an den Frageweg", async () => {
    fenster.SpeechRecognition = RekorderDoppel;
    const { a, leser } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    await klick(q(document, "klara-diktieren"));
    const rec = RekorderDoppel.letzter;
    expect(rec, "das Diktat wurde nicht gestartet").not.toBeNull();
    await act(async () => {
      rec?.hoert("Ersatzfilter für Presse vier bestellen");
    });
    await klick(q(document, "klara-aufnahme-stoppen"));
    await klick(q(document, "klara-als-notiz"));
    await bis(() => Boolean(q(document, "klara-notiz-offen")), 120);
    expect(q(document, "klara-notiz-herkunft")?.textContent).toContain("diktiert");
    const amServer = await serverNotizen(a, leser);
    expect(amServer.map((n) => [n.weg, n.inhalt])).toEqual([
      ["diktiert", "Ersatzfilter für Presse vier bestellen"],
    ]);
    expect(draht.aufrufe.some((x) => x.url === "/api/ask")).toBe(false);
  });
});

describe("U3 · K1 — aus einer gespeicherten Gesprächsnachricht", () => {
  it("der Server übernimmt den Wortlaut; zweimal „Als Notiz“ ergibt eine Notiz", async () => {
    const { a, leser } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    // Klaras eingebaute Hilfe — ohne KI, im eigenen Gespräch gespeichert (wie Klara 01, E8).
    await klick(q(document, "klara-modus-erklaere"));
    await warte(500);
    await bis(() => {
      const klara = alle(document, "klara-nachricht").filter((n) => n.dataset.von === "klara");
      return klara[klara.length - 1]?.dataset.gespeichert === "ja";
    }, 120);
    const klara = alle(document, "klara-nachricht").filter((n) => n.dataset.von === "klara");
    const hilfe = klara[klara.length - 1] as HTMLElement;
    const knopf = hilfe.querySelector('[data-testid="klara-nachricht-als-notiz"]');
    expect(knopf, "an der gespeicherten Nachricht fehlt „Als Notiz“").not.toBeNull();
    await klick(knopf);
    await bis(() => Boolean(q(document, "klara-notiz-offen")), 120);
    await klick(knopf);
    await ruhe(10);
    const amServer = await serverNotizen(a, leser);
    expect(amServer).toHaveLength(1);
    expect(amServer[0]?.weg).toBe("gespraech");
    expect(amServer[0]?.quelle?.gespraechId).toBeTruthy();
    // Der Wortlaut ist der der gespeicherten Nachricht — nicht vom Browser zusammengesetzt.
    const g = await a.app.inject({
      method: "GET",
      url: "/api/me/klara/gespraech",
      headers: leser.kopf,
    });
    const gespeichert = (
      g.json() as { gespraech: { nachrichten: { id: string; text: string }[] } }
    ).gespraech.nachrichten.find((n) => n.id === amServer[0]?.quelle?.nachrichtId);
    expect(amServer[0]?.inhalt).toBe(gespeichert?.text);
  });
});

describe("U4 · K4 — fehlgeschlagene Speicherung sichtbar, Wiederholung ohne Doppelnotiz", () => {
  it("Störung vor dem Server: „Nicht gespeichert“ mit Grund; „Erneut speichern“ legt genau eine an", async () => {
    const { a, leser } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    draht.stoerungEinmal(NOTIZ_URL, 503);
    await alsNotiz("Notiz, die beim ersten Mal scheitert");
    await bis(() => ausstehend()[0]?.dataset.stand === "fehler", 120);
    const fehler = ausstehend()[0] as HTMLElement;
    expect(fehler.textContent).toContain("Nicht gespeichert");
    expect(fehler.textContent).toContain("Notiz, die beim ersten Mal scheitert");
    expect(q(document, "klara-notiz-offen")).toBeNull();
    expect(await serverNotizen(a, leser)).toHaveLength(0);

    await klick(fehler.querySelector('[data-testid="klara-notiz-nochmal"]'));
    await bis(() => ausstehend().length === 0, 120);
    expect(q(document, "klara-notiz-offen")).not.toBeNull();
    expect(await serverNotizen(a, leser)).toHaveLength(1);
  });

  it("die Antwort ging NACH dem Speichern verloren: die Wiederholung ergibt dieselbe, einzige Notiz", async () => {
    const { a, leser } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    // ATTRAPPE: das erste Anlegen erreicht den echten Server, die Antwort an Klara geht verloren.
    const weiter = globalThis.fetch;
    let verlieren = true;
    const verlustig = (async (eingabe: unknown, init?: RequestInit) => {
      const echt = await weiter(eingabe as RequestInfo, init);
      if (verlieren && String(eingabe) === NOTIZ_URL && init?.method === "POST") {
        verlieren = false;
        const rumpf = JSON.stringify({ error: "SERVER", message: "Verbindung abgerissen." });
        return {
          status: 502,
          statusText: "502",
          ok: false,
          text: async () => rumpf,
        } as unknown as Response;
      }
      return echt;
    }) as typeof globalThis.fetch;
    globalThis.fetch = verlustig;
    window.fetch = verlustig;

    await alsNotiz("Gespeichert, aber ohne Antwort");
    await bis(() => ausstehend()[0]?.dataset.stand === "fehler", 120);
    expect(ausstehend()[0]?.textContent).toContain("Nicht gespeichert");
    // Am Server liegt sie bereits — der Browser weiss es nur nicht.
    expect(await serverNotizen(a, leser)).toHaveLength(1);

    await klick(ausstehend()[0]?.querySelector('[data-testid="klara-notiz-nochmal"]'));
    await bis(() => ausstehend().length === 0, 120);
    expect(q(document, "klara-notiz-offen")).not.toBeNull();
    const amServer = await serverNotizen(a, leser);
    expect(amServer).toHaveLength(1);
    expect(amServer[0]?.inhalt).toBe("Gespeichert, aber ohne Antwort");
    expect(alle(document, "klara-notiz-eintrag")).toHaveLength(1);
  });

  it("eine gescheiterte Änderung bleibt im Feld und lässt sich erneut speichern", async () => {
    const { a, leser } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    await alsNotiz("Erste Fassung");
    await bis(() => Boolean(q(document, "klara-notiz-offen")), 120);
    const id = q(document, "klara-notiz-offen")?.dataset.notiz ?? "";
    await schreibe(q<HTMLTextAreaElement>(document, "klara-notiz-inhalt"), "Zweite Fassung");
    draht.stoerungEinmal(`${NOTIZ_URL}/${id}`, 503);
    await klick(q(document, "klara-notiz-speichern"));
    await bis(() => Boolean(q(document, "klara-notiz-aenderung-fehler")), 120);
    expect(q(document, "klara-notiz-aenderung-fehler")?.textContent).toContain(
      "Änderung nicht gespeichert",
    );
    expect(q<HTMLTextAreaElement>(document, "klara-notiz-inhalt")?.value).toBe("Zweite Fassung");
    expect((await serverNotizen(a, leser))[0]?.inhalt).toBe("Erste Fassung");
    await klick(q(document, "klara-notiz-aenderung-nochmal"));
    await bis(() => q(document, "klara-notiz-offen")?.dataset.fassung === "2", 120);
    const nachher = (await serverNotizen(a, leser))[0];
    expect(nachher).toMatchObject({ inhalt: "Zweite Fassung", fassung: 2 });
  });
});

describe("U5 · K3 — eine andere Person sieht in Klara keine fremde Notiz", () => {
  it("Kontowechsel: leere eigene Liste, kein fremder Text; die Bedienhilfe nennt die Fähigkeit", async () => {
    const { a } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    expect(q(document, "klara-bedienhilfe-notiz")?.textContent).toContain("Als Notiz speichern");
    expect(q(document, "klara-bedienhilfe")?.textContent).toContain("Erneut speichern");
    await alsNotiz("Nur meine Gedanken zu Presse 4");
    await bis(() => Boolean(q(document, "klara-notiz-offen")), 120);

    const fremd = await neuesKonto(a.app, "klara-notizen-fremd", a.admin);
    draht.setzeCookie(`kw_session=${fremd.token}`);
    await neuLaden("/klara-vorschau");
    expect(q(document, "klara-notizen-leer")).not.toBeNull();
    expect(alle(document, "klara-notiz-eintrag")).toHaveLength(0);
    expect(document.body.textContent).not.toContain("Nur meine Gedanken zu Presse 4");
    expect(await serverNotizen(a, fremd)).toEqual([]);
  });
});
