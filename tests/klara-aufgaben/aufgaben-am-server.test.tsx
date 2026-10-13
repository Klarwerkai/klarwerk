// @vitest-environment jsdom
// ================================================================================================
// KLARA 07 (produkt:20261008:klara-aufgaben) — PERSÖNLICHE AUFGABEN IN KLARA UND AUF „MEINE AUFGABEN“,
// AM ECHTEN SERVER.
// ================================================================================================
//
// Die echte Hülle (`AppShell`) mit der echten Klara und der echten Seite „Meine Aufgaben“
// (`pages/MyTasks.tsx`), verbunden über den Draht aus `tests/klara-quellen-nutzerweg/kette.ts` mit
// der ECHTEN App im selben Prozess: Anmeldung, Notizen, Gespräch, Auftragsgrenze mit Ausführung am
// Server und die Aufgabenablage `/api/me/klara/aufgaben`. „Neuladen" ist: abbauen, den
// Browserzustand vergessen (`vergiss`) und neu montieren; „erneute Anmeldung" ist eine neue Sitzung.
//
// ATTRAPPEN, ausdrücklich: die Spracherkennung (`SpeechRecognition` „hört“, was der Test sagt — wie
// Klara 02/05), eine einmalige Störung des Drahts VOR dem Server (`stoerungEinmal`) und eine Antwort,
// die NACH dem echten Speichern verloren geht. Ein echtes Mikrofon, echtes Layout und eine echte
// Netzstörung misst diese Datei nicht.
//
//   U1 (K1/K4) „Als Aufgabe“ an einer Notiz: echte Aufgabe mit Bezug; zweimal = eine.
//   U2 (K1/K4) Gesprochener Auftrag über den gemeinsamen Aktionsweg: Karte zeigt den am Server
//              nachgelesenen Status, die Aufgabe steht in der Liste, Bezug „gesprochener Auftrag“.
//   U3 (K2)    Bearbeiten, Priorisieren, Erledigen — nach erneuter Anmeldung und Neuladen gleich.
//   U4 (K4)    Gescheiterte und verlorene Änderung: der angezeigte Status bleibt der des Servers,
//              „Erneut speichern“ ergibt genau eine neue Fassung.
//   U5 (K3)    „Meine Aufgaben“ zeigt die persönliche Aufgabe getrennt von den gemeinsamen, geöffnet
//              über `?persoenlich=`; eine andere Person sieht nichts davon. Bedienhilfe in Klara.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { setzeKlaraVorschauAktiv } from "../../apps/web/src/components/klara-vorschau/aktiv";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { alle, bis, klick, medienStub, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";
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
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KENNWORT = "geheim12345";
const AUFGABEN_URL = "/api/me/klara/aufgaben";

interface ServerAufgabe {
  id: string;
  titel: string;
  inhalt: string;
  prioritaet: string;
  status: string;
  fassung: number;
  weg: string;
  bereich: string;
  bezug: { art: string; notizId?: string; quelle?: string; wortlaut?: string };
}

// ------------------------------------------------------------------------------------------------
// Die Attrappe der Spracherkennung (wie Klara 02/05).
// ------------------------------------------------------------------------------------------------
type Erkannt = ArrayLike<{ transcript: string }> & { isFinal?: boolean };

class RekorderDoppel {
  static letzter: RekorderDoppel | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Erkannt> }) => void) | null = null;
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
// Vorrichtung.
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

async function vorrichtung(): Promise<{ a: Aufbau; ich: Konto }> {
  const a = await appAufbauen(true);
  aufbau = a;
  draht.setzeApp(a.app);
  const ich = await neuesKonto(a.app, "klara-aufgaben", a.admin);
  draht.setzeCookie(`kw_session=${ich.token}`);
  return { a, ich };
}

/**
 * Nacharbeit 2 (Ben): ein Ergebnislink, der bei SCHON OFFENER Seite „Meine Aufgaben“ angeklickt
 * wird — derselbe Router, dieselbe Seite, nur der Suchparameter `persoenlich` wechselt. Das Ziel wird
 * erst beim Klick gelesen (`sprungZiel`), so wie ein zweiter Ergebnislink auf ein anderes Ziel zeigt.
 */
let sprungZiel = "";
function Sprung(): JSX.Element {
  const navigiere = useNavigate();
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "test-sprung",
      onClick: () => navigiere(`/aufgaben?persoenlich=${encodeURIComponent(sprungZiel)}`),
    },
    "Sprung",
  );
}

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
    createElement(
      Routes,
      null,
      createElement(Route, {
        path: "/aufgaben",
        element: createElement("div", null, createElement(MyTasks), createElement(Sprung)),
      }),
      createElement(Route, { path: "*", element: createElement("div", null, "Seite") }),
    ),
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

/** Klara öffnen und warten, bis Gespräch, Notizen und Aufgaben vom Server gelesen sind. */
async function oeffnen(): Promise<void> {
  if (!q(document, "klara-gespraech")) {
    await klick(q(document, "klara-figur"));
  }
  await bis(() => Boolean(q(document, "klara-gespraech")));
  await bis(() => {
    const laden = q(document, "klara-echt-hinweis")?.dataset.laden;
    return laden === undefined || laden === "bereit" || laden === "fehler";
  }, 160);
  await bis(() => aufgabenGelesen(klara()), 160);
}

/** Die Klara-Fläche (nicht der Abschnitt auf „Meine Aufgaben“); ohne sie das ganze Dokument. */
function klara(): ParentNode {
  return document.querySelector('[data-testid="klara-gespraech"]') ?? document;
}

function aufgabenGelesen(wurzel: ParentNode): boolean {
  return (
    Boolean(q(wurzel, "klara-aufgaben-leer")) || alle(wurzel, "klara-aufgabe-eintrag").length > 0
  );
}

function eintraege(wurzel: ParentNode | null = klara()): HTMLElement[] {
  return wurzel ? alle(wurzel, "klara-aufgabe-eintrag") : [];
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

async function serverAufgaben(a: Aufbau, konto: Konto): Promise<ServerAufgabe[]> {
  const r = await a.app.inject({ method: "GET", url: AUFGABEN_URL, headers: konto.kopf });
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { aufgaben: ServerAufgabe[] }).aufgaben;
}

async function alsNotiz(text: string): Promise<void> {
  const eingabe = q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement;
  await tippe(eingabe, text);
  await klick(q(document, "klara-als-notiz"));
  await bis(() => Boolean(q(document, "klara-notiz-offen")), 120);
}

/** Wählt wie ein Mensch einen Eintrag in einer Auswahlliste. */
async function waehle(feld: HTMLSelectElement | null, wert: string): Promise<void> {
  if (!feld) {
    throw new Error("Auswahl fehlt");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await ruhe(3);
}

const text = (wurzel: ParentNode | null | undefined, id: string): string =>
  (wurzel ? q(wurzel, id)?.textContent : "") ?? "";

// ================================================================================================
describe("U1 · K1/K4 — „Als Aufgabe“ an einer Notiz", () => {
  it("legt eine echte Aufgabe mit Bezug an; ein zweites Drücken ergibt keine zweite", async () => {
    const { a, ich } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    expect(q(klara(), "klara-aufgaben-leer")).not.toBeNull();
    expect(text(klara(), "klara-aufgaben-privat")).toContain("Nur für dich");

    await alsNotiz("Ersatzdichtung für Presse 4 bestellen");
    await klick(q(document, "klara-notiz-als-aufgabe"));
    await bis(() => eintraege().length === 1, 120);
    const e = eintraege()[0] as HTMLElement;
    expect(e.dataset.status).toBe("offen");
    expect(e.dataset.prioritaet).toBe("mittel");
    expect(text(e, "klara-aufgabe-bezug")).toContain("Aus der Notiz");
    expect(text(e, "klara-aufgabe-zustaendig")).toContain("Zuständig: du");
    expect(text(e, "klara-aufgabe-zustaendig")).toContain("Persönlich");
    expect(text(klara(), "klara-aufgabe-meldung")).toContain("gespeichert");

    const amServer = await serverAufgaben(a, ich);
    expect(amServer).toHaveLength(1);
    expect(amServer[0]).toMatchObject({
      weg: "notiz",
      bereich: "persoenlich",
      inhalt: "Ersatzdichtung für Presse 4 bestellen",
      status: "offen",
    });

    // Zweites Drücken an derselben Notiz: derselbe Vorgang — der Server meldet die vorhandene.
    await klick(q(document, "klara-notiz-als-aufgabe"));
    await bis(() => text(klara(), "klara-aufgabe-meldung").includes("gibt es schon"), 120);
    expect(await serverAufgaben(a, ich)).toHaveLength(1);
    expect(eintraege()).toHaveLength(1);
  });
});

// ================================================================================================
describe("U2 · K1/K4 — gesprochener Auftrag über den gemeinsamen Aktionsweg", () => {
  it("die Karte zeigt den am Server nachgelesenen Status, die Aufgabe steht in der Liste", async () => {
    fenster.SpeechRecognition = RekorderDoppel;
    const { a, ich } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    const satz = "Lege mir die Aufgabe „Hydraulikfilter bestellen“ an";

    await klick(q(document, "klara-auftrag-sprechen"));
    await act(async () => {
      RekorderDoppel.letzter?.hoert(satz);
    });
    await klick(q(document, "klara-aufnahme-stoppen"));
    expect(q(document, "klara-auftrag-art")?.dataset.art).toBe("ausfuehrung");
    // Vor „Senden“ geschieht nichts.
    expect(await serverAufgaben(a, ich)).toEqual([]);
    await klick(q(document, "klara-auftrag-senden"));
    await bis(() => q(document, "klara-ausfuehrung")?.dataset.phase === "fertig", 400);

    const karte = q(document, "klara-ausfuehrung");
    expect(karte?.dataset.quelle).toBe("gesprochen");
    expect(karte?.dataset.stand).toBe("abgeschlossen");
    expect(text(karte, "klara-ausfuehrung-aktionen")).toBe("Persönliche Aufgabe anlegen");
    const schritt = karte ? alle(karte, "klara-ausfuehrung-schritt")[0] : undefined;
    expect(schritt?.dataset.stand).toBe("gespeichert");
    expect(text(schritt, "klara-ausfuehrung-schritt-stand")).toContain(
      "Aufgabe offen · Priorität mittel",
    );
    expect(text(schritt, "klara-ausfuehrung-schritt-nicht-ruecknehmbar")).toContain(
      "Meine persönlichen Aufgaben",
    );

    const amServer = await serverAufgaben(a, ich);
    expect(amServer).toHaveLength(1);
    expect(amServer[0]).toMatchObject({
      titel: "Hydraulikfilter bestellen",
      weg: "auftrag",
      bezug: { art: "auftrag", quelle: "gesprochen", wortlaut: satz },
    });
    // Der Ergebnisweg der Karte führt genau zu dieser Aufgabe auf „Meine Aufgaben“.
    const ergebnis = schritt
      ? q<HTMLAnchorElement>(schritt, "klara-ausfuehrung-schritt-ergebnis")
      : null;
    expect(ergebnis?.getAttribute("href")).toBe(`/aufgaben?persoenlich=${amServer[0]?.id}`);

    // Die Liste in Klara wurde frisch vom Server gelesen.
    await bis(() => eintraege().length === 1, 120);
    expect(text(eintraege()[0], "klara-aufgabe-bezug")).toContain("gesprochenen Auftrag");
    expect(eintraege()[0]?.dataset.aufgabe).toBe(amServer[0]?.id);
  });
});

// ================================================================================================
describe("U3 · K2 — Bearbeiten, Priorisieren, Erledigen bleiben nach Reload und Anmeldung", () => {
  it("Priorität, Titel und Erledigt stehen nach neuer Sitzung so da, wie der Server sie führt", async () => {
    const { a, ich } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    await alsNotiz("Kühlmittel nachfüllen");
    await klick(q(document, "klara-notiz-als-aufgabe"));
    await bis(() => eintraege().length === 1, 120);
    const id = eintraege()[0]?.dataset.aufgabe ?? "";

    // Priorisieren.
    await waehle(
      q<HTMLSelectElement>(eintraege()[0] as HTMLElement, "klara-aufgabe-prioritaet"),
      "hoch",
    );
    await bis(() => eintraege()[0]?.dataset.prioritaet === "hoch", 120);
    // Bearbeiten.
    await klick(q(eintraege()[0] as HTMLElement, "klara-aufgabe-oeffnen"));
    await tippe(
      q<HTMLInputElement>(eintraege()[0] as HTMLElement, "klara-aufgabe-titel") as HTMLInputElement,
      "Kühlmittel Presse 4 nachfüllen",
    );
    await klick(q(eintraege()[0] as HTMLElement, "klara-aufgabe-speichern"));
    await bis(() => eintraege()[0]?.dataset.fassung === "3", 120);
    // Erledigen.
    await klick(q(eintraege()[0] as HTMLElement, "klara-aufgabe-erledigen"));
    await bis(() => eintraege()[0]?.dataset.status === "erledigt", 120);
    expect(text(klara(), "klara-aufgabe-meldung")).toContain("ist erledigt");

    // Erneute Anmeldung und Neuladen: alles kommt so vom Server zurück.
    const wieder = await neuAnmelden(a, ich.email);
    draht.setzeCookie(`kw_session=${wieder.token}`);
    await neuLaden("/klara-vorschau");
    await bis(() => eintraege().length === 1, 120);
    const e = eintraege()[0] as HTMLElement;
    expect(e.dataset.aufgabe).toBe(id);
    expect(e.dataset.status).toBe("erledigt");
    expect(e.dataset.prioritaet).toBe("hoch");
    expect(e.dataset.fassung).toBe("4");
    expect(text(e, "klara-aufgabe-oeffnen")).toBe("Kühlmittel Presse 4 nachfüllen");
    expect(text(e, "klara-aufgabe-erledigen")).toBe("Wieder öffnen");
    expect((await serverAufgaben(a, wieder))[0]).toMatchObject({
      titel: "Kühlmittel Presse 4 nachfüllen",
      prioritaet: "hoch",
      status: "erledigt",
      fassung: 4,
    });
  });
});

// ================================================================================================
describe("U4 · K4 — gescheiterte und verlorene Änderung", () => {
  it("Störung vor dem Server: Fehler an der Aufgabe, Status bleibt „offen“, Erneut speichern erledigt", async () => {
    const { a, ich } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    await alsNotiz("Schutzgitter prüfen");
    await klick(q(document, "klara-notiz-als-aufgabe"));
    await bis(() => eintraege().length === 1, 120);
    const id = eintraege()[0]?.dataset.aufgabe ?? "";

    draht.stoerungEinmal(`${AUFGABEN_URL}/${id}`, 503);
    await klick(q(eintraege()[0] as HTMLElement, "klara-aufgabe-erledigen"));
    await bis(() => Boolean(q(eintraege()[0] as HTMLElement, "klara-aufgabe-fehler")), 120);
    // Der angezeigte Status ist der des Servers — nicht der gewünschte.
    expect(eintraege()[0]?.dataset.status).toBe("offen");
    expect(text(eintraege()[0], "klara-aufgabe-fehler")).toContain("Änderung nicht gespeichert");
    expect((await serverAufgaben(a, ich))[0]).toMatchObject({ status: "offen", fassung: 1 });

    await klick(q(eintraege()[0] as HTMLElement, "klara-aufgabe-nochmal"));
    await bis(() => eintraege()[0]?.dataset.status === "erledigt", 120);
    expect(q(eintraege()[0] as HTMLElement, "klara-aufgabe-fehler")).toBeNull();
    expect((await serverAufgaben(a, ich))[0]).toMatchObject({ status: "erledigt", fassung: 2 });
  });

  it("Antwort nach dem Speichern verloren: Erneut speichern ergibt keine zweite Fassung", async () => {
    const { a, ich } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    await alsNotiz("Lager zählen");
    await klick(q(document, "klara-notiz-als-aufgabe"));
    await bis(() => eintraege().length === 1, 120);
    const id = eintraege()[0]?.dataset.aufgabe ?? "";

    // ATTRAPPE: die erste Änderung erreicht den echten Server, die Antwort an Klara geht verloren.
    const weiter = globalThis.fetch;
    let verlieren = true;
    const verlustig = (async (eingabe: unknown, init?: RequestInit) => {
      const echt = await weiter(eingabe as RequestInfo, init);
      if (verlieren && String(eingabe) === `${AUFGABEN_URL}/${id}` && init?.method === "PUT") {
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

    await klick(q(eintraege()[0] as HTMLElement, "klara-aufgabe-erledigen"));
    await bis(() => Boolean(q(eintraege()[0] as HTMLElement, "klara-aufgabe-fehler")), 120);
    // Am Server ist sie schon erledigt — der Browser weiss es nur nicht.
    expect((await serverAufgaben(a, ich))[0]).toMatchObject({ status: "erledigt", fassung: 2 });

    await klick(q(eintraege()[0] as HTMLElement, "klara-aufgabe-nochmal"));
    await bis(() => eintraege()[0]?.dataset.status === "erledigt", 120);
    expect(eintraege()[0]?.dataset.fassung).toBe("2");
    expect((await serverAufgaben(a, ich))[0]).toMatchObject({ status: "erledigt", fassung: 2 });
  });
});

// ================================================================================================
describe("U5 · K3 — „Meine Aufgaben“: persönlich getrennt von gemeinsam, fremd unsichtbar", () => {
  it("die persönliche Aufgabe steht im eigenen Abschnitt, geöffnet; eine andere Person sieht nichts", async () => {
    const { a } = await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    expect(text(document, "klara-bedienhilfe-aufgabe")).toContain("Lege mir die Aufgabe");
    expect(text(document, "klara-bedienhilfe")).toContain(
      "Klara macht keine davon zu einer persönlichen",
    );
    await alsNotiz("Nur meine Aufgabe zu Presse 4");
    await klick(q(document, "klara-notiz-als-aufgabe"));
    await bis(() => eintraege().length === 1, 120);
    const id = eintraege()[0]?.dataset.aufgabe ?? "";

    // „Meine Aufgaben“ mit dem Ergebnisweg eines Auftrags: der eigene Abschnitt, die Aufgabe offen.
    abbauen();
    vergiss();
    await montiere(`/aufgaben?persoenlich=${id}`);
    const abschnitt = (): HTMLElement | null => q(document, "aufgaben-persoenlich");
    await bis(() => eintraege(abschnitt()).length === 1, 200);
    const e = eintraege(abschnitt())[0] as HTMLElement;
    expect(e.dataset.aufgabe).toBe(id);
    expect(q(e, "klara-aufgabe-offen")).not.toBeNull();
    expect(text(e, "klara-aufgabe-zustaendig")).toContain("Persönlich");
    // In der Liste der GEMEINSAMEN Aufgaben steht sie nicht — sie wird nicht umetikettiert.
    expect(
      alle(document, "task-zeile").some((z) => z.textContent?.includes("Nur meine Aufgabe")),
    ).toBe(false);

    // Eine andere Person: weder in Klara noch auf „Meine Aufgaben“ etwas Fremdes.
    const fremd = await neuesKonto(a.app, "klara-aufgaben-fremd", a.admin);
    draht.setzeCookie(`kw_session=${fremd.token}`);
    abbauen();
    vergiss();
    await montiere("/aufgaben");
    await bis(() => Boolean(q(abschnitt() ?? document, "klara-aufgaben-leer")), 200);
    expect(eintraege(abschnitt())).toHaveLength(0);
    expect(document.body.textContent).not.toContain("Nur meine Aufgabe zu Presse 4");
    expect(await serverAufgaben(a, fremd)).toEqual([]);
  });
});

// ================================================================================================
describe("U6 · K1/K4 — Nacharbeit 2 (Ben): Ergebnislink bei schon offener Seite öffnet sein Ziel", () => {
  it("Wechsel A → B öffnet B; ein nicht (mehr) vorhandenes Ziel wird gemeldet, nicht verschwiegen", async () => {
    await vorrichtung();
    await montiere("/klara-vorschau");
    await oeffnen();
    await alsNotiz("Erste Aufgabe A");
    await klick(q(document, "klara-notiz-als-aufgabe"));
    await bis(() => eintraege().length === 1, 120);
    const idA = eintraege()[0]?.dataset.aufgabe ?? "";
    await klick(q(document, "klara-notiz-schliessen"));
    await alsNotiz("Zweite Aufgabe B");
    await klick(q(document, "klara-notiz-als-aufgabe"));
    await bis(() => eintraege().length === 2, 120);
    const idB = eintraege().find((e) => e.dataset.aufgabe !== idA)?.dataset.aufgabe ?? "";
    expect(idB).not.toBe("");

    abbauen();
    vergiss();
    await montiere(`/aufgaben?persoenlich=${idA}`);
    const abschnitt = (): ParentNode => q(document, "aufgaben-persoenlich") ?? document;
    const zeile = (id: string): HTMLElement | undefined =>
      eintraege(abschnitt()).find((e) => e.dataset.aufgabe === id);
    await bis(() => eintraege(abschnitt()).length === 2, 200);
    expect(q(zeile(idA) as HTMLElement, "klara-aufgabe-offen")).not.toBeNull();
    expect(q(zeile(idB) as HTMLElement, "klara-aufgabe-offen")).toBeNull();

    // Zweiter Ergebnislink, DIESELBE offene Seite: jetzt soll B aufgehen.
    sprungZiel = idB;
    await klick(q(document, "test-sprung"));
    await bis(
      () => Boolean(zeile(idB) && q(zeile(idB) as HTMLElement, "klara-aufgabe-offen")),
      120,
    );
    expect(q(zeile(idB) as HTMLElement, "klara-aufgabe-offen")).not.toBeNull();

    // Ein Ziel, das es (für diese Person) nicht gibt: kein stilles Nichts, sondern eine Meldung.
    sprungZiel = "gibt-es-nicht";
    await klick(q(document, "test-sprung"));
    await bis(
      () => text(abschnitt(), "klara-aufgabe-meldung").includes("ließ sich nicht öffnen"),
      120,
    );
    expect(text(abschnitt(), "klara-aufgabe-meldung")).toContain("ließ sich nicht öffnen");
  });
});
