// @vitest-environment jsdom
// ================================================================================================
// KLARA 02 (produkt:20261008:klara-sprache) — SPRECHEN, DIKTIEREN UND VORLESEN IN DER ECHTEN KLARA.
// ================================================================================================
//
// Dieselbe Vorrichtung wie Klara 01 (`tests/klara-basis/klara-echt-am-server.test.tsx`): die echte
// Hülle mit der echten beweglichen Klara, über den Draht aus `tests/klara-quellen-nutzerweg/kette.ts`
// verbunden mit der ECHTEN App im selben Prozess — echte Anmeldung, echter Frageweg `POST /api/ask`,
// echte Ablage des Gesprächs, echtes Personenverzeichnis. An der Stelle des Modells antwortet der
// kontrollierte Adapter der Kette.
//
// ATTRAPPEN SIND NUR DIE BEIDEN BROWSER-SCHNITTSTELLEN, ausdrücklich: die Spracherkennung
// (`SpeechRecognition`) „hört“, was der Test ihr sagt, und die Sprachausgabe (`speechSynthesis`) zählt,
// was gesprochen und abgebrochen wurde. Ein echtes Mikrofon, eine echte Stimme und echte Erkennung
// misst dieser Lauf NICHT — das bleibt eine Bedienprobe an einem Gerät mit Mikrofon.
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
import {
  setzeAutoVorlesen,
  setzeTempo,
  stoppeVorlesen,
} from "../../apps/web/src/components/klara-vorschau/vorlesen";
import { zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { alle, bis, klick, medienStub, q, ruhe, tippe } from "../fe003-tutorial-fragen/huelle";
import {
  type App,
  type Aufbau,
  BELEGSTELLE,
  type Draht,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  fragen as kettenFrage,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();

/** Dieselbe gedeckte Frage wie in Klara 01 (Begründung dort): nur Begriffe aus Titel und Aussage. */
const GESPROCHEN = "Wie wird die Zylinderkopfdichtung XQ42 vor dem Wechsel entlastet?";

// ------------------------------------------------------------------------------------------------
// Die Attrappen der Browser-Schnittstellen.
// ------------------------------------------------------------------------------------------------
type Ergebnis = ArrayLike<{ transcript: string }> & { isFinal?: boolean };

class RekorderDoppel {
  static letzter: RekorderDoppel | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  gestartet = 0;
  gestoppt = 0;
  onresult: ((e: { resultIndex: number; results: ArrayLike<Ergebnis> }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e?: { error?: string }) => void) | null = null;
  constructor() {
    RekorderDoppel.letzter = this;
  }
  start(): void {
    this.gestartet += 1;
  }
  stop(): void {
    this.gestoppt += 1;
    this.onend?.();
  }
  hoert(text: string, endgueltig = true): void {
    this.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: text }], { isFinal: endgueltig })],
    });
  }
}

class AeusserungDoppel {
  text: string;
  lang = "";
  rate = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}
const ausgabe = { gesprochen: [] as AeusserungDoppel[], abgebrochen: 0 };

type Fenster = Record<string, unknown>;
const fenster = window as unknown as Fenster;

function mitSprache(): void {
  fenster.SpeechRecognition = RekorderDoppel;
  fenster.SpeechSynthesisUtterance = AeusserungDoppel;
  fenster.speechSynthesis = {
    speak: (u: AeusserungDoppel) => ausgabe.gesprochen.push(u),
    cancel: () => {
      ausgabe.abgebrochen += 1;
    },
    getVoices: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function ohneSprache(): void {
  fenster.SpeechRecognition = undefined;
  fenster.webkitSpeechRecognition = undefined;
  Reflect.deleteProperty(fenster, "speechSynthesis");
  Reflect.deleteProperty(fenster, "SpeechSynthesisUtterance");
}

// ------------------------------------------------------------------------------------------------
// Vorrichtung (wie Klara 01).
// ------------------------------------------------------------------------------------------------
let draht: Draht;
let aufbau: Aufbau | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let echterFetch: typeof globalThis.fetch;
/** Jede Frage, die Klara an `POST /api/ask` geschickt hat — der Rumpf, wie er hinausging. */
let gefragt: string[] = [];

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
  ausgabe.gesprochen = [];
  ausgabe.abgebrochen = 0;
  RekorderDoppel.letzter = null;
  gefragt = [];
  await i18n.changeLanguage("de");
  // Mitschnitt, KEINE Attrappe: `POST /api/ask` geht unverändert an den echten Server.
  const weiter = echterFetch;
  const neu = (async (eingabe: unknown, init?: RequestInit) => {
    if (String(eingabe) === "/api/ask" && typeof init?.body === "string") {
      gefragt.push((JSON.parse(init.body) as { question: string }).question);
    }
    return weiter(eingabe as RequestInfo, init);
  }) as typeof globalThis.fetch;
  globalThis.fetch = neu;
  window.fetch = neu;
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  globalThis.fetch = echterFetch;
  window.fetch = echterFetch;
  stoppeVorlesen();
  setzeAutoVorlesen(false);
  setzeTempo("normal");
  ohneSprache();
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

async function vorrichtung(): Promise<{ a: Aufbau; leser: Konto }> {
  const a = await appAufbauen(false);
  aufbau = a;
  draht.setzeApp(a.app);
  const leser = await neuesKonto(a.app, "klara-sprache", a.admin);
  draht.setzeCookie(`kw_session=${leser.token}`);
  return { a, leser };
}

/** Eine weitere Person im Verzeichnis — registriert und freigegeben, wie im Betrieb. */
async function person(app: App, admin: Konto, name: string, kennung: string): Promise<void> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name, email: `klara-sprache-${kennung}@klarwerk.test`, password: "geheim12345" },
  });
  expect(res.statusCode, res.body).toBe(201);
  const roh = res.json() as { id?: string; user?: { id: string } };
  const id = roh.id ?? roh.user?.id;
  const frei = await app.inject({
    method: "POST",
    url: `/api/auth/users/${id}/approve`,
    headers: admin.kopf,
  });
  expect(frei.statusCode, frei.body).toBe(200);
}

async function montiere(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Ein Seitenwechsel wie in Klara 01 (`data-testid` als `object` gespreizt, Begründung dort).
  const testkennung: object = { "data-testid": "zu-fragen" };
  const seite = createElement(
    "div",
    { "data-testid": "seite" },
    createElement(Link, { to: "/fragen", ...testkennung }, "Zu Fragen"),
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

/**
 * `sprache`: ob der Browser Spracherkennung und Sprachausgabe hat. Klara liest das beim Zeichnen —
 * die Attrappen stehen deshalb VOR dem Montieren, wie die Schnittstellen eines echten Browsers.
 */
async function bereit(sprache = true): Promise<{ a: Aufbau; leser: Konto }> {
  if (sprache) {
    mitSprache();
  } else {
    ohneSprache();
  }
  const v = await vorrichtung();
  await montiere("/klara-vorschau");
  await gespraechOeffnen();
  await einwilligen();
  return v;
}

function nachrichten(): HTMLElement[] {
  return alle(document, "klara-nachricht");
}

function letzteKlara(): HTMLElement | undefined {
  const k = nachrichten().filter((n) => n.dataset.von === "klara");
  return k[k.length - 1];
}

async function bisAntwort(anzahlVorher: number): Promise<HTMLElement> {
  await bis(() => {
    const k = nachrichten().filter((n) => n.dataset.von === "klara");
    const n = k[k.length - 1];
    return (
      k.length > anzahlVorher &&
      Boolean(n && n.dataset.gespeichert !== "laeuft" && !q(document, "klara-stoppen"))
    );
  }, 240);
  const n = letzteKlara();
  if (!n) {
    throw new Error("Keine Antwort von Klara");
  }
  return n;
}

function klaraAnzahl(): number {
  return nachrichten().filter((n) => n.dataset.von === "klara").length;
}

/** „Auftrag sprechen“: Klara hört `text`, die Person hält an. */
async function sprichAuftrag(text: string): Promise<void> {
  await klick(q(document, "klara-auftrag-sprechen"));
  expect(q(document, "klara-aufnahme-laeuft")?.dataset.art).toBe("auftrag");
  const rec = RekorderDoppel.letzter;
  await act(async () => {
    rec?.hoert(text);
  });
  await klick(q(document, "klara-aufnahme-stoppen"));
  await bis(() => Boolean(q(document, "klara-auftrag")));
}

function zielDerSeite(): string {
  return `${q(document, "klara-ort-seite")?.textContent ?? ""} · ${
    q(document, "klara-ort-objekt")?.textContent ?? ""
  }`;
}

async function schreibeIn(feld: HTMLTextAreaElement, text: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await ruhe(3);
}

interface ServerFrage {
  text: string;
  objektbezug: { pfad: string; seitenName: string; objekt: string };
}

/** Die eigenen Fragen am Server — mit dem Gesprächsbezug, unter dem sie abgelegt wurden. */
async function serverFragenMitBezug(a: Aufbau, konto: Konto): Promise<ServerFrage[]> {
  const r = await a.app.inject({
    method: "GET",
    url: "/api/me/klara/gespraech",
    headers: konto.kopf,
  });
  expect(r.statusCode, r.body).toBe(200);
  const g = (
    r.json() as {
      gespraech: { nachrichten: (ServerFrage & { von: string; modus: string })[] } | null;
    }
  ).gespraech;
  return (g?.nachrichten ?? []).filter((n) => n.von === "du");
}

async function serverFragen(a: Aufbau, konto: Konto): Promise<string[]> {
  return (await serverFragenMitBezug(a, konto)).map((n) => n.text);
}

/**
 * Jeder verändernde Aufruf ab `ab`, der NICHT Frageweg oder eigenes Gespräch ist — nach einem
 * gesendeten Sprachauftrag muss das leer bleiben: ausgeführt wird im Grundschritt nichts.
 */
function fremdeMutationen(ab: number): string[] {
  return draht.aufrufe
    .slice(ab)
    .filter((x) => x.methode !== "GET")
    .filter((x) => x.url !== "/api/ask" && !x.url.startsWith("/api/me/klara/"))
    .map((x) => `${x.methode} ${x.url}`);
}

// ================================================================================================
// K1 · eine gesprochene Frage erreicht die bestehende KI, die Antwort wird vorgelesen.
// ================================================================================================
describe("S1 · K1/K4/K5 — gesprochene Frage über den Frageweg, Antwort vorlesen und stoppen", () => {
  it("„Auftrag sprechen“ → Senden: dieselbe KI-Antwort wie getippt, vorlesbar, stoppbar, Ergebnis bleibt", async () => {
    const { a, leser } = await bereit();
    // Bedienhilfe zu dieser Fähigkeit steht von Anfang an in Klara.
    expect(q(document, "klara-bedienhilfe-sprache")?.textContent).toContain("Diktieren");

    // Der Eintrag entsteht unmittelbar vor der Frage — Kalibrierung wie in Klara 01.
    await eintragMitOriginal(a.app, a.admin);
    const kalibrierung = await kettenFrage(a.app, leser, GESPROCHEN);
    expect(kalibrierung.answered, `Kalibrierung: ${kalibrierung.roh}`).toBe(true);
    const generierungenVorher = draht.lage.generierungen;

    await sprichAuftrag(GESPROCHEN);
    expect(q(document, "klara-auftrag-gehoert")?.textContent).toContain(GESPROCHEN);
    expect(q<HTMLTextAreaElement>(document, "klara-auftrag-text")?.value).toBe(GESPROCHEN);
    expect(q(document, "klara-auftrag-ziel")?.textContent).toBe(zielDerSeite());
    expect(q(document, "klara-auftrag-art")?.dataset.art).toBe("frage");
    // Nichts ging hinaus, bevor die Person „Senden“ drückt.
    expect(gefragt).toEqual([]);

    const vorher = klaraAnzahl();
    const aufrufeVorher = draht.aufrufe.length;
    await klick(q(document, "klara-auftrag-senden"));
    const antwort = await bisAntwort(vorher);
    expect(fremdeMutationen(aufrufeVorher)).toEqual([]);
    expect(gefragt, "die gesprochene Frage ging nicht unverändert an den Frageweg").toEqual([
      GESPROCHEN,
    ]);
    expect(antwort.dataset.modus).toBe("ki");
    expect(antwort.textContent).toContain(BELEGSTELLE);
    expect(draht.lage.generierungen, "der Modellweg wurde nicht gerufen").toBeGreaterThan(
      generierungenVorher,
    );
    expect(await serverFragen(a, leser)).toEqual([GESPROCHEN]);

    // K5: gehört, gesendet, Ziel und tatsächliches Ergebnis bleiben sichtbar.
    await bis(() => q(document, "klara-auftrag-ergebnis")?.dataset.stand === "beantwortet");
    expect(q(document, "klara-auftrag-ergebnis")?.dataset.stand).toBe("beantwortet");
    expect(q(document, "klara-ergebnis-gehoert")?.textContent).toBe(GESPROCHEN);
    expect(q(document, "klara-ergebnis-gesendet")?.textContent).toBe(GESPROCHEN);
    expect(q(document, "klara-ergebnis-ziel")?.textContent).toBe(zielDerSeite());
    expect(q(document, "klara-ergebnis-stand")?.textContent).toContain("Klara hat geantwortet");

    // Vorlesen nur auf Klick: bis hierher wurde nichts gesprochen.
    expect(ausgabe.gesprochen).toHaveLength(0);
    const knopf = antwort.querySelector<HTMLButtonElement>('[data-testid="klara-vorlesen"]');
    expect(knopf?.getAttribute("aria-pressed")).toBe("false");
    await klick(knopf);
    expect(ausgabe.gesprochen).toHaveLength(1);
    expect(ausgabe.gesprochen[0]?.text).toContain(BELEGSTELLE);
    expect(ausgabe.gesprochen[0]?.lang).toBe("de-DE");
    expect(knopf?.getAttribute("aria-pressed")).toBe("true");
    expect(q(document, "klara-vorlesen-stoppen")).not.toBeNull();

    // K4: Vorlesen stoppen.
    const abgebrochen = ausgabe.abgebrochen;
    await klick(q(document, "klara-vorlesen-stoppen"));
    expect(ausgabe.abgebrochen).toBeGreaterThan(abgebrochen);
    expect(q(document, "klara-vorlesen-stoppen")).toBeNull();
    expect(knopf?.getAttribute("aria-pressed")).toBe("false");
    expect(ausgabe.gesprochen).toHaveLength(1);

    // Einstellbar: automatisch vorlesen und Tempo — dann liest Klara die nächste Antwort selbst.
    const auto = q<HTMLInputElement>(document, "klara-vorlesen-auto");
    expect(auto?.checked).toBe(false);
    await klick(auto);
    const tempo = q<HTMLSelectElement>(document, "klara-vorlesen-tempo") as HTMLSelectElement;
    await act(async () => {
      tempo.value = "langsam";
      tempo.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await sprichAuftrag(GESPROCHEN);
    const vorher2 = klaraAnzahl();
    await klick(q(document, "klara-auftrag-senden"));
    await bisAntwort(vorher2);
    await bis(() => ausgabe.gesprochen.length === 2);
    expect(ausgabe.gesprochen, "die Antwort wurde nicht automatisch vorgelesen").toHaveLength(2);
    expect((ausgabe.gesprochen[1]?.text ?? "").length).toBeGreaterThan(0);
    expect(ausgabe.gesprochen[1]?.rate).toBeLessThan(1);
    expect(gefragt).toEqual([GESPROCHEN, GESPROCHEN]);
  });
});

// ================================================================================================
// K2 · Diktat nimmt nur Text auf; der Auftragsmodus zeigt Auftrag und Ziel.
// ================================================================================================
describe("S2 · K2 — dasselbe Gesprochene: Diktat füllt nur das Feld, „Auftrag sprechen“ zeigt Auftrag und Ziel", () => {
  it("Diktat sendet nichts und führt nichts aus; der Text bleibt editierbar", async () => {
    await bereit();
    const nachrichtenVorher = nachrichten().length;
    const feld = q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement;

    await klick(q(document, "klara-diktieren"));
    expect(q(document, "klara-aufnahme-laeuft")?.dataset.art).toBe("diktat");
    const rec = RekorderDoppel.letzter;
    expect(rec?.gestartet).toBe(1);
    expect(rec?.lang).toBe("de-DE");
    await act(async () => {
      rec?.hoert("Wie wird die Zylinderkopfdichtung", false);
    });
    expect(q(document, "klara-aufnahme-zwischen")?.textContent).toBe(
      "Wie wird die Zylinderkopfdichtung",
    );
    expect(feld.value, "Vorläufiges darf nicht ins Feld").toBe("");
    await act(async () => {
      rec?.hoert(GESPROCHEN);
    });
    expect(feld.value).toBe(GESPROCHEN);
    await klick(q(document, "klara-aufnahme-stoppen"));
    expect(rec?.gestoppt).toBe(1);
    expect(q(document, "klara-aufnahme-laeuft")).toBeNull();

    // Nichts gesendet, nichts ausgeführt, keine Auftragskarte.
    await ruhe();
    expect(gefragt).toEqual([]);
    expect(nachrichten()).toHaveLength(nachrichtenVorher);
    expect(q(document, "klara-auftrag")).toBeNull();
    expect(draht.aufrufe.filter((x) => x.methode !== "GET").map((x) => x.url)).not.toContain(
      "/api/ask",
    );

    // Editierbar: die Person korrigiert den diktierten Text selbst.
    await tippe(feld, `${GESPROCHEN} Bitte kurz.`);
    expect(feld.value).toBe(`${GESPROCHEN} Bitte kurz.`);
    expect(gefragt).toEqual([]);
  });

  it("dasselbe Gesprochene im Auftragsmodus: erkannter Auftrag und Ziel, ein Arbeitsauftrag wird als solcher benannt", async () => {
    await bereit();
    await sprichAuftrag(GESPROCHEN);
    expect(q<HTMLTextAreaElement>(document, "klara-auftrag-text")?.value).toBe(GESPROCHEN);
    expect(q(document, "klara-auftrag-ziel")?.textContent).toBe(zielDerSeite());
    expect(q(document, "klara-auftrag-art")?.textContent).toBe("Frage an Klara");
    expect(q<HTMLInputElement>(document, "klara-eingabe")?.value, "Auftrag ≠ Diktat").toBe("");
    await klick(q(document, "klara-auftrag-verwerfen"));
    expect(q(document, "klara-auftrag")).toBeNull();

    await sprichAuftrag("Lege eine Aufgabe zur Zylinderkopfdichtung an");
    expect(q(document, "klara-auftrag-art")?.dataset.art).toBe("aktion");
    expect(q(document, "klara-auftrag-art")?.textContent).toBe("Arbeitsauftrag");
    expect(q(document, "klara-auftrag-aktion-hinweis")?.textContent).toContain(
      "noch nicht selbst ausführen",
    );
    expect(gefragt).toEqual([]);
  });
});

// ================================================================================================
// K3 · unklare Namen und Zeiten werden geklärt; der korrigierte Text geht hinaus.
// ================================================================================================
describe("S3 · K3/K5 — Rückfragen zu Name, Zeit und Bezug; der korrigierte Text wird weiterverwendet", () => {
  it("erst nach allen Rückfragen und der eigenen Korrektur geht genau dieser Text an den Frageweg", async () => {
    const { a, leser } = await bereit();
    await person(a.app, a.admin, "Anna Berger", "berger");
    await person(a.app, a.admin, "Anna Kramer", "kramer");

    const gehoert = "Hat Anna morgen um drei hier Dienst";
    await sprichAuftrag(gehoert);
    // Die Namensrückfrage braucht das Personenverzeichnis vom Server.
    await bis(() => alle(document, "klara-klaerung").some((k) => k.dataset.art === "name"), 120);
    const arten = alle(document, "klara-klaerung").map((k) => k.dataset.art);
    expect(arten).toEqual(["name", "zeit", "zeit", "ziel"]);
    expect(q<HTMLButtonElement>(document, "klara-auftrag-senden")?.disabled).toBe(true);
    expect(q(document, "klara-auftrag-offen")).not.toBeNull();

    const option = (art: string, wert: string): HTMLElement | undefined =>
      alle(document, "klara-klaerung")
        .find((k) => k.dataset.art === art)
        ?.querySelector<HTMLElement>(
          `[data-testid="klara-klaerung-option"][data-wert="${wert}"]`,
        ) ?? undefined;
    const optionen = (art: string): HTMLElement[] =>
      alle(document, "klara-klaerung")
        .filter((k) => k.dataset.art === art)
        .flatMap((k) => alle(k, "klara-klaerung-option"));

    // Name: welche Anna?
    expect(optionen("name").map((o) => o.dataset.wert)).toEqual(["Anna Berger", "Anna Kramer"]);
    await klick(option("name", "Anna Kramer"));
    // Zeit: „morgen“ → Datum, „um drei“ → 15:00.
    const morgen = new Date();
    morgen.setDate(morgen.getDate() + 1);
    const datum = new Intl.DateTimeFormat("de", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(morgen);
    await klick(optionen("zeit")[0]);
    await klick(option("zeit", "15:00"));
    // Ziel: „hier“ → die Seite, auf der gesprochen wurde.
    const bezug = `(Bezug: ${zielDerSeite()})`;
    await klick(option("ziel", bezug));
    expect(alle(document, "klara-klaerung")).toHaveLength(0);
    const feld = q<HTMLTextAreaElement>(document, "klara-auftrag-text") as HTMLTextAreaElement;
    expect(feld.value).toBe(`Hat Anna Kramer am ${datum} um 15:00 hier Dienst ${bezug}`);

    // Nacharbeit 3 (Bens Befund): wer eine geklärte Stelle von Hand wieder mehrdeutig macht, wird
    // erneut gefragt — die alte Entscheidung unterdrückt die Rückfrage nicht, Senden ist gesperrt.
    const geklaert = feld.value;
    await schreibeIn(feld, geklaert.replace("um 15:00", "um drei"));
    expect(alle(document, "klara-klaerung").map((k) => k.dataset.art)).toEqual(["zeit"]);
    expect(q<HTMLButtonElement>(document, "klara-auftrag-senden")?.disabled).toBe(true);
    expect(q(document, "klara-auftrag-offen")).not.toBeNull();
    await klick(option("zeit", "15:00"));
    expect(feld.value).toBe(geklaert);
    expect(alle(document, "klara-klaerung")).toHaveLength(0);
    // „So lassen“ gilt ebenfalls nur für den Text, für den es gewählt wurde.
    await schreibeIn(feld, `${geklaert} morgen`);
    const soLassen = alle(document, "klara-klaerung")
      .find((k) => k.dataset.art === "zeit")
      ?.querySelector<HTMLElement>('[data-testid="klara-klaerung-option"][data-wert=""]');
    await klick(soLassen);
    expect(alle(document, "klara-klaerung")).toHaveLength(0);
    await schreibeIn(feld, `${geklaert} morgen bitte`);
    expect(alle(document, "klara-klaerung").map((k) => k.dataset.art)).toEqual(["zeit"]);
    expect(q<HTMLButtonElement>(document, "klara-auftrag-senden")?.disabled).toBe(true);
    await schreibeIn(feld, geklaert);
    expect(alle(document, "klara-klaerung")).toHaveLength(0);

    // Eigene Korrektur des erkannten Textes.
    const korrigiert = feld.value.replace("Dienst", "Schicht");
    await schreibeIn(feld, korrigiert);
    expect(q<HTMLButtonElement>(document, "klara-auftrag-senden")?.disabled).toBe(false);

    const vorher = klaraAnzahl();
    const aufrufeVorher = draht.aufrufe.length;
    await klick(q(document, "klara-auftrag-senden"));
    await bisAntwort(vorher);
    expect(gefragt, "nicht der korrigierte Text ging hinaus").toEqual([korrigiert]);
    expect(await serverFragen(a, leser)).toEqual([korrigiert]);
    // K5: gehört ≠ gesendet, beides sichtbar, mit Ziel und Ergebnis.
    await bis(() => q(document, "klara-auftrag-ergebnis")?.dataset.stand !== "laeuft");
    expect(q(document, "klara-ergebnis-gehoert")?.textContent).toBe(gehoert);
    expect(q(document, "klara-ergebnis-gesendet")?.textContent).toBe(korrigiert);
    expect(q(document, "klara-ergebnis-ziel")?.textContent).toBe(zielDerSeite());
    expect(q(document, "klara-auftrag-ergebnis")?.dataset.stand).toBe("beantwortet");
    expect(fremdeMutationen(aufrufeVorher)).toEqual([]);
  });
});

// ================================================================================================
// K2/K5 · Nacharbeit 3 (Bens Befund): angezeigtes Ziel = tatsächlich verwendeter Gesprächsbezug.
// ================================================================================================
describe("S5 · K2/K5 — Seitenwechsel zwischen Sprechen und Senden: Karte und Gesprächsbezug bleiben beim gesprochenen Ziel", () => {
  it("auf der Klara-Vorschau gesprochen, auf „Fragen“ gesendet: Bezug am Server ist die Klara-Vorschau", async () => {
    const { a, leser } = await bereit();
    await sprichAuftrag(GESPROCHEN);
    const zielBeimSprechen = zielDerSeite();
    const seiteBeimSprechen = q(document, "klara-ort-seite")?.textContent ?? "";
    const objektBeimSprechen = q(document, "klara-ort-objekt")?.textContent ?? "";
    expect(q(document, "klara-auftrag-ziel")?.textContent).toBe(zielBeimSprechen);

    // Seitenwechsel, die Karte bleibt offen.
    await klick(q(document, "zu-fragen"));
    await bis(() => q(document, "klara-ort-seite")?.textContent === "Fragen");
    expect(q(document, "klara-ort-seite")?.textContent).toBe("Fragen");
    expect(zielDerSeite()).not.toBe(zielBeimSprechen);
    expect(q(document, "klara-auftrag-ziel")?.textContent).toBe(zielBeimSprechen);

    const vorher = klaraAnzahl();
    await klick(q(document, "klara-auftrag-senden"));
    await bisAntwort(vorher);
    expect(gefragt).toEqual([GESPROCHEN]);
    const amServer = await serverFragenMitBezug(a, leser);
    expect(amServer.map((n) => n.text)).toEqual([GESPROCHEN]);
    expect(amServer[0]?.objektbezug).toMatchObject({
      pfad: "/klara-vorschau",
      seitenName: seiteBeimSprechen,
      objekt: objektBeimSprechen,
    });
    await bis(() => q(document, "klara-auftrag-ergebnis")?.dataset.stand !== "laeuft");
    expect(q(document, "klara-ergebnis-ziel")?.textContent).toBe(zielBeimSprechen);
    // Die Antwort trägt denselben Bezug wie die Frage.
    const herkunft = letzteKlara()?.querySelector('[data-testid="klara-nachricht-herkunft"]');
    expect(herkunft?.textContent).toContain(seiteBeimSprechen);

    // Gegenprobe: eine getippte Frage auf „Fragen“ nimmt weiter den aktuellen Ort.
    const feld = q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement;
    await tippe(feld, GESPROCHEN);
    const vorher2 = klaraAnzahl();
    await klick(q(document, "klara-senden"));
    await bisAntwort(vorher2);
    const danach = await serverFragenMitBezug(a, leser);
    expect(danach[1]?.objektbezug.pfad).toBe("/fragen");
  });
});

// ================================================================================================
// K4 · Aufnahme stoppen; Mikrofon abgelehnt und Browser ohne Sprache lassen den Textweg bedienbar.
// ================================================================================================
describe("S4 · K4 — Stopp, abgelehntes Mikrofon, Browser ohne Spracherkennung", () => {
  it("„Aufnahme stoppen“ und das Schliessen von Klara beenden das Zuhören", async () => {
    await bereit();
    await klick(q(document, "klara-auftrag-sprechen"));
    const rec = RekorderDoppel.letzter;
    await act(async () => {
      rec?.hoert("Wie wird die Dichtung");
    });
    await klick(q(document, "klara-aufnahme-stoppen"));
    expect(rec?.gestoppt).toBe(1);
    expect(q(document, "klara-aufnahme-laeuft")).toBeNull();
    expect(q<HTMLTextAreaElement>(document, "klara-auftrag-text")?.value).toBe(
      "Wie wird die Dichtung",
    );
    expect(gefragt).toEqual([]);

    await klick(q(document, "klara-diktieren"));
    const rec2 = RekorderDoppel.letzter;
    expect(rec2).not.toBe(rec);
    await klick(q(document, "klara-schliessen"));
    expect(rec2?.gestoppt, "geschlossen hört Klara weiter zu").toBe(1);
  });

  it("abgelehntes Mikrofon: ehrlicher Hinweis, die getippte Frage geht weiter", async () => {
    const { a } = await bereit();
    await klick(q(document, "klara-auftrag-sprechen"));
    const rec = RekorderDoppel.letzter;
    await act(async () => {
      rec?.onerror?.({ error: "not-allowed" });
      rec?.onend?.();
    });
    await ruhe();
    expect(q(document, "klara-sprache-hinweis")?.textContent).toContain(
      "Das Mikrofon ist nicht erlaubt",
    );
    expect(q(document, "klara-aufnahme-laeuft")).toBeNull();
    expect(q(document, "klara-auftrag")).toBeNull();

    await eintragMitOriginal(a.app, a.admin);
    const feld = q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement;
    expect(feld.disabled).toBe(false);
    await tippe(feld, GESPROCHEN);
    const vorher = klaraAnzahl();
    await klick(q(document, "klara-senden"));
    const antwort = await bisAntwort(vorher);
    expect(gefragt).toEqual([GESPROCHEN]);
    expect(["ki", "ohne_ki"]).toContain(antwort.dataset.modus);
  });

  it("Browser ohne Spracherkennung und ohne Sprachausgabe: Hinweise statt Knöpfe, Tippen geht", async () => {
    const { a } = await bereit(false);
    expect(q(document, "klara-diktieren")).toBeNull();
    expect(q(document, "klara-auftrag-sprechen")).toBeNull();
    expect(q(document, "klara-sprache-na")?.textContent).toContain(
      "Spracheingabe ist in diesem Browser nicht verfügbar",
    );
    expect(q(document, "klara-vorlesen-na")).not.toBeNull();

    await eintragMitOriginal(a.app, a.admin);
    const feld = q<HTMLInputElement>(document, "klara-eingabe") as HTMLInputElement;
    await tippe(feld, GESPROCHEN);
    const vorher = klaraAnzahl();
    await klick(q(document, "klara-senden"));
    const antwort = await bisAntwort(vorher);
    expect(gefragt).toEqual([GESPROCHEN]);
    expect(["ki", "ohne_ki"]).toContain(antwort.dataset.modus);
    expect(antwort.querySelector('[data-testid="klara-vorlesen"]')).toBeNull();
  });
});
