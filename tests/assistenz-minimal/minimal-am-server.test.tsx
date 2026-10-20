// @vitest-environment jsdom
// ================================================================================================
// ASSISTENZ MINIMAL (produkt:20261011:assistenz-minimalistische-oberflaeche) — DIE GRUNDANSICHT,
// DAS MENÜ UND DIE SITUATIVEN HINWEISE GEGEN DEN ECHTEN SERVER.
// ================================================================================================
//
// Dieselbe Montage wie `tests/klara-produkt/produkteinstieg-am-server.test.tsx`: echte Hülle, echte
// App im selben Prozess über den Draht aus `tests/klara-quellen-nutzerweg/kette.ts`, echte
// Anmeldung, echte Gesprächsablage `/api/me/klara/...`, KEIN Vorschau-Schalter.
//
// Was hier gemessen wird (je Fall die Kriterien UI-MIN-xx):
//   M1 · Grundansicht: genau Kopf, Kontextzeile, Gespräch, Eingabe; keine Dauerblöcke; die sichtbaren
//        Bedienelemente werden gezählt (01, 02, 10, 11).
//   M2 · Menü mit fünf Einträgen, Rückweg, Escape-Stufen, Einklappen — der Entwurf bleibt; „Neues
//        Gespräch“ fragt nur, wenn etwas unerreichbar würde (03, 08, 12).
//   M3 · Einwilligung beim ersten Senden; Widerruf in drei Aktionen und am Server wirksam (07, 08, 15).
//   M4 · Laufende Anfrage: Steuerbereich über Menü und Unterseite, Stopp an der eingeklappten Figur,
//        echter Abbruch, kein Neustart nach Neuladen (06, 14).
//   M5 · Markierung: höchstens zwei Vorschläge; Seitenwechsel aktualisiert den Kontext und zeigt die
//        alte Markierung als fremd (05, 11).
//   M6 · Ein Spracheinstieg: Diktat ins Feld ohne Senden, Mikrofon abgelehnt → Text geht weiter,
//        Vorlesen sichtbar stoppbar (03, 13).
//   M7 · Ohne Modell: knapp in der Kontextzeile, ausführlich in den Details, Antwort ehrlich
//        gekennzeichnet; Quellen-Fassung auf Wunsch (07, 09).
//
// WAS DIESE DATEI NICHT ERSETZT: den Browser (Layout, 320 px, Hell/Dunkel misst
// `tests-smoke/assistenz-minimal-browser.spec.ts`), echte Mikrofone/Lautsprecher, den nativen
// Mac-Begleiter und Word sowie das Urteil eines Menschen. Alle Konten und Inhalte sind fiktiv.
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
import { leseAusfuehrungen } from "../../apps/web/src/components/klara-vorschau/auftrag";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { eingabeZuruecksetzen } from "../../apps/web/src/components/klara-vorschau/eingabe";
import { leseKiAuftraege } from "../../apps/web/src/components/klara-vorschau/kiAuftraege";
import { setzeAssistenzProfil } from "../../apps/web/src/components/klara-vorschau/profil";
import { stoppeVorlesen } from "../../apps/web/src/components/klara-vorschau/vorlesen";
import { aendere, zuruecksetzenGanz } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { verwerfeEigeninitiative } from "../../apps/web/src/lib/klaraEigeninitiative";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { buildServices } from "../../services/app/src/build-app";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import {
  alle,
  bis,
  klick,
  medienStub,
  q,
  ruhe,
  taste,
  tippe,
} from "../fe003-tutorial-fragen/huelle";
import {
  type Aufbau,
  type Dienste,
  type Draht,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();

/** Trägt nur Begriffe, die der Ketteneintrag wirklich führt (siehe klara-echt-am-server.test.tsx). */
const GEDECKTE_FRAGE = "Wie wird die Zylinderkopfdichtung XQ42 vor dem Wechsel entlastet?";
const ENTWURF = "Synthetischer Entwurf, noch nicht gesendet";
const ABSATZ = "Synthetischer Probeabsatz zur Dichtung XQ42 für die Markierung.";

let draht: Draht;
let aufbau: Aufbau | null = null;
let leser: Konto | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let echterFetch: typeof globalThis.fetch;

// ------------------------------------------------------------------------------------------------
// Attrappen der Browser-Sprachschnittstellen — wie in `tests/klara-sprache/`.
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
  hoert(text: string): void {
    this.onresult?.({
      resultIndex: 0,
      results: [Object.assign([{ transcript: text }], { isFinal: true })],
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
const fenster = window as unknown as Record<string, unknown>;

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
// Vorrichtung.
// ------------------------------------------------------------------------------------------------
beforeAll(() => {
  draht = drahtAufbauen();
  echterFetch = globalThis.fetch;
  // jsdom liefert keine Bereichsgeometrie; wie im bestehenden Vorschlagstest.
  if (typeof Range.prototype.getBoundingClientRect !== "function") {
    Range.prototype.getBoundingClientRect = () =>
      ({
        x: 40,
        y: 120,
        left: 40,
        top: 120,
        right: 240,
        bottom: 140,
        width: 200,
        height: 20,
        toJSON: () => ({}),
      }) as DOMRect;
  }
});

afterAll(() => {
  draht.abbauen();
});

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  zuruecksetzenGanz();
  eingabeZuruecksetzen();
  vergiss();
  setzeKlaraVorschauAktiv(false);
  setzeAssistenzProfil(null);
  ohneSprache();
  RekorderDoppel.letzter = null;
  ausgabe.gesprochen.length = 0;
  ausgabe.abgebrochen = 0;
  medienStub();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  globalThis.fetch = echterFetch;
  window.fetch = echterFetch;
  stoppeVorlesen();
  ohneSprache();
  vergiss();
  setzeAssistenzProfil(null);
  eingabeZuruecksetzen();
  zuruecksetzenGanz();
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  leser = null;
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

async function vorrichtung(ohneModell = false): Promise<Aufbau> {
  const a = await appAufbauen(ohneModell);
  aufbau = a;
  draht.setzeApp(a.app);
  await eintragMitOriginal(a.app, a.admin);
  leser = await neuesKonto(a.app, "assistenz-minimal", a.admin);
  draht.setzeCookie(`kw_session=${leser.token}`);
  return a;
}

/** Die echte Hülle mit einer Seite, einem markierbaren Absatz und einem Link zu Fragen. */
async function montiere(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const zuFragen: object = { "data-testid": "zu-fragen" };
  const seite = createElement(
    "div",
    { "data-testid": "seite" },
    createElement("p", { "data-testid": "probeabsatz" }, ABSATZ),
    createElement(Link, { to: "/fragen", ...zuFragen }, "Zu Fragen"),
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
    return laden === "bereit" || laden === "fehler";
  }, 160);
}

function gespraech(): HTMLElement {
  const g = q(document, "klara-gespraech");
  if (!g) {
    throw new Error("Gespräch der Assistenz fehlt");
  }
  return g;
}

function eingabe(): HTMLInputElement {
  const e = q<HTMLInputElement>(document, "klara-eingabe");
  if (!e) {
    throw new Error("Eingabe der Assistenz fehlt");
  }
  return e;
}

/** Was der Server über das eigene Gespräch meldet — nur die hier geprüften Felder. */
interface ServerGespraech {
  id: string;
  einwilligungAm: string | null;
  objektbezug: unknown;
}

const nachrichten = (): HTMLElement[] => alle(document, "klara-nachricht");
const askAufrufe = (): number =>
  draht.aufrufe.filter((x) => x.url === "/api/ask" && x.methode === "POST").length;

async function bisAntwortGespeichert(anzahl: number): Promise<void> {
  await bis(() => {
    const klara = nachrichten().filter((n) => n.dataset.von === "klara");
    return klara.length >= anzahl && klara[klara.length - 1]?.dataset.gespeichert === "ja";
  }, 240);
}

/** Erste Frage samt Einwilligung beim ersten Senden. */
async function ersteFrage(frage = GEDECKTE_FRAGE): Promise<void> {
  await tippe(eingabe(), frage);
  await klick(q(document, "klara-senden"));
  await bis(() => Boolean(q(document, "klara-einwilligung-erteilen")));
  await klick(q(document, "klara-einwilligung-erteilen"));
  await bisAntwortGespeichert(1);
}

/** Sichtbar ist ein Element, wenn es in keinem geschlossenen `<details>` liegt (ausser in dessen Kopf). */
function sichtbarImBaum(el: Element): boolean {
  let d = el.parentElement?.closest("details") ?? null;
  let kind: Element = el;
  while (d) {
    const kopf = d.querySelector(":scope > summary");
    const imKopf = kopf !== null && (kopf === kind || kopf.contains(kind));
    if (!(d as HTMLDetailsElement).open && !imKopf) {
      return false;
    }
    kind = d;
    d = d.parentElement?.closest("details") ?? null;
  }
  return !el.closest(".sr-only");
}

/** Die sichtbaren Bedienelemente einer Fläche — einzeln gezählt, keine DOM-Zusammenfassung. */
function sichtbareBedienelemente(wurzel: Element): string[] {
  return Array.from(
    wurzel.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], summary"),
  )
    .filter(sichtbarImBaum)
    .map((el) => el.dataset.testid ?? el.tagName.toLowerCase());
}

/** Hält `POST /api/ask`, bis der Test freigibt — ein Abbruch der Anfrage beendet das Warten echt. */
function frageHalten(): { freigeben: () => void } {
  const vorher = globalThis.fetch;
  let freigabe: (() => void) | null = null;
  const halten = (async (eingabe: unknown, init?: RequestInit) => {
    if (String(eingabe) === "/api/ask" && (init?.method ?? "GET").toUpperCase() === "POST") {
      await new Promise<void>((weiter, abbruch) => {
        freigabe = weiter;
        init?.signal?.addEventListener("abort", () =>
          abbruch(new DOMException("Die Anfrage wurde abgebrochen.", "AbortError")),
        );
      });
    }
    return vorher(eingabe as RequestInfo, init);
  }) as unknown as typeof globalThis.fetch;
  globalThis.fetch = halten;
  window.fetch = halten;
  return { freigeben: () => freigabe?.() };
}

/** Wählt den Text eines Elements wie ein Mensch aus. */
async function markiere(el: HTMLElement): Promise<void> {
  const knoten = el.firstChild ?? el;
  await act(async () => {
    const range = document.createRange();
    range.selectNodeContents(knoten);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
}

// ================================================================================================
// M1 · Grundansicht
// ================================================================================================
describe("M1 · UI-MIN-01/02/10/11 — vier Bereiche, keine Dauerblöcke, gezählte Bedienelemente", () => {
  it("im Ruhezustand: Kopf, Kontextzeile, Gespräch („Wie kann ich helfen?“), Eingabe — sonst nichts", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    const g = gespraech();
    expect(g.dataset.oberflaeche).toBe("minimal");
    expect(g.dataset.seite).toBe("gespraech");

    // Die vier Bereiche.
    expect(q(g, "klara-panel-titel")?.textContent).toBe("Deine Assistenz");
    expect(q(g, "klara-menue-knopf")).not.toBeNull();
    expect(q(g, "klara-schliessen")?.getAttribute("aria-label")).toBe("Einklappen");
    const kontext = q<HTMLDetailsElement>(g, "klara-kontext");
    expect(kontext?.open).toBe(false);
    expect(q(g, "klara-kontext-zeile")?.textContent ?? "").not.toBe("");
    expect(q(g, "klara-echt-leer")?.textContent).toBe("Wie kann ich helfen?");
    expect(q(g, "klara-eingabe-form")).not.toBeNull();

    // Keine Erklär-, Einwilligungs-, Betriebs- oder Debugblöcke vor dem Gespräch.
    for (const id of [
      "klara-einwilligung",
      "klara-einwilligung-erteilt",
      "klara-betrieb",
      "klara-offen",
      "klara-modi",
      "klara-bedienhilfe",
      "klara-sprachausgabe",
      "klara-diktieren",
      "klara-auftrag-sprechen",
      "klara-zur-vorschau",
      "klara-andocken",
      "klara-vollbild",
      "klara-ansicht",
      "klara-minimieren",
      "klara-gespraech-beginn",
      "klara-vorgaenge",
      "klara-menue",
      "klara-ki-aus-hinweis",
    ]) {
      expect(q(document, id), id).toBeNull();
    }
    // Datenweg, Ort und Bezug stehen nur in den (geschlossenen) Kontextdetails.
    for (const id of ["klara-datenweg", "klara-ort", "klara-bezug"]) {
      const el = q(g, id);
      expect(el, id).not.toBeNull();
      expect(sichtbarImBaum(el as Element), `${id} dauerhaft sichtbar`).toBe(false);
    }

    // UI-MIN-10: gezählt, einzeln — Menü, Einklappen, Kontextzeile, Eingabe, Senden.
    expect(sichtbareBedienelemente(g)).toEqual([
      "klara-menue-knopf",
      "klara-schliessen",
      "klara-kontext-zeile",
      "klara-eingabe",
      "klara-senden",
    ]);

    // Ein Klick auf die Kontextzeile öffnet Ort, Bezug und Datenweg.
    await act(async () => {
      if (kontext) {
        kontext.open = true;
      }
    });
    expect(sichtbarImBaum(q(g, "klara-datenweg") as Element)).toBe(true);
    expect(q(g, "klara-datenweg")?.textContent).toContain("Frageweg von Klarwerk");
  });
});

// ================================================================================================
// M2 · Menü und Entwurf
// ================================================================================================
describe("M2 · UI-MIN-03/08/12 — fünf Menüpunkte, Rückweg, Escape, Einklappen: der Entwurf bleibt", () => {
  it("jede Unterseite hat einen Rückweg; Escape geht genau eine Stufe zurück; der Entwurf überlebt alles", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    await tippe(eingabe(), ENTWURF);

    await klick(q(document, "klara-menue-knopf"));
    expect(q(document, "klara-menue-knopf")?.getAttribute("aria-expanded")).toBe("true");
    const eintraege = Array.from(q(document, "klara-menue")?.querySelectorAll("button") ?? []);
    expect(eintraege.map((b) => b.textContent)).toEqual([
      "Neues Gespräch",
      "Verlauf",
      "Meine Funktionen",
      "Einstellungen",
      "Hilfe",
    ]);
    // Der Fokus steht auf dem ersten Eintrag; Escape schliesst nur das Menü.
    expect(document.activeElement).toBe(q(document, "klara-menue-neu"));
    await taste(gespraech(), "Escape");
    expect(q(document, "klara-menue")).toBeNull();
    expect(q(document, "klara-gespraech")).not.toBeNull();
    expect(document.activeElement).toBe(q(document, "klara-menue-knopf"));

    for (const seite of ["verlauf", "funktionen", "einstellungen", "hilfe"]) {
      await klick(q(document, "klara-menue-knopf"));
      await klick(q(document, `klara-menue-${seite}`));
      expect(gespraech().dataset.seite, seite).toBe(seite);
      expect(q(document, "klara-unterseite")?.dataset.seite).toBe(seite);
      expect(document.activeElement).toBe(q(document, "klara-unterseite-zurueck"));
      // Auf der Unterseite gibt es keine Eingabe — sie ist nicht verloren, nur nicht gezeigt.
      expect(q(document, "klara-eingabe")).toBeNull();
      if (seite === "verlauf") {
        await klick(q(document, "klara-unterseite-zurueck"));
      } else {
        await taste(gespraech(), "Escape");
      }
      expect(q(document, "klara-unterseite"), seite).toBeNull();
      expect(eingabe().value, `nach ${seite}`).toBe(ENTWURF);
    }
    // Einstellungen: Daten & Freigaben, Sprache und Darstellung sind dort erreichbar.
    await klick(q(document, "klara-menue-knopf"));
    await klick(q(document, "klara-menue-einstellungen"));
    for (const id of [
      "klara-einstellung-sprache",
      "klara-einstellung-verbindungen",
      "klara-einstellung-darstellung",
      "klara-daten",
      "klara-minimieren",
    ]) {
      expect(q(document, id), id).not.toBeNull();
    }
    await taste(gespraech(), "Escape");

    // Escape im Gespräch klappt ein; erneut öffnen — der Entwurf ist da, ohne Rückfrage.
    await taste(eingabe(), "Escape");
    expect(q(document, "klara-gespraech")).toBeNull();
    await gespraechOeffnen();
    expect(eingabe().value).toBe(ENTWURF);
    expect(gespraech().dataset.seite).toBe("gespraech");

    // Neuladen: der Entwurf kommt aus der Sitzung zurück.
    abbauen();
    vergiss();
    await montiere("/");
    await gespraechOeffnen();
    expect(eingabe().value).toBe(ENTWURF);
  });

  it("„Neues Gespräch“: leer ohne Rückfrage; mit Verlauf gezielte Rückfrage — Abbrechen hält alles, Neu beginnen hält den Entwurf", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();

    // Noch nichts gespeichert: kein Verlust, keine Rückfrage, Fokus in die Eingabe.
    await klick(q(document, "klara-menue-knopf"));
    await klick(q(document, "klara-menue-neu"));
    expect(q(document, "klara-unterseite")).toBeNull();
    expect(q(document, "klara-neu-frage")).toBeNull();

    await ersteFrage();
    expect(nachrichten()).toHaveLength(2);
    await tippe(eingabe(), ENTWURF);

    await klick(q(document, "klara-menue-knopf"));
    await klick(q(document, "klara-menue-neu"));
    expect(q(document, "klara-neu-frage")?.textContent).toContain("nicht mehr aufrufbar");
    await klick(q(document, "klara-neues-gespraech-abbrechen"));
    expect(q(document, "klara-unterseite")).toBeNull();
    expect(nachrichten()).toHaveLength(2);
    expect(eingabe().value).toBe(ENTWURF);

    await klick(q(document, "klara-menue-knopf"));
    await klick(q(document, "klara-menue-neu"));
    await klick(q(document, "klara-neues-gespraech"));
    await bis(() => nachrichten().length === 0 && Boolean(q(document, "klara-eingabe")), 120);
    expect(nachrichten()).toHaveLength(0);
    expect(eingabe().value).toBe(ENTWURF);
    expect(q(document, "klara-ansage")?.textContent).toContain("angefangener Text bleibt");
  });

  it("Verlauf: Umfang des gespeicherten Gesprächs; der Inhalt bleibt vollständig im Gespräch", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    await ersteFrage();
    await tippe(eingabe(), GEDECKTE_FRAGE);
    await klick(q(document, "klara-senden"));
    await bisAntwortGespeichert(2);
    expect(nachrichten()).toHaveLength(4);

    await klick(q(document, "klara-menue-knopf"));
    await klick(q(document, "klara-menue-verlauf"));
    expect(q(document, "klara-verlauf-anzahl")?.textContent).toContain(
      "4 gespeicherte Nachrichten",
    );
    expect(q(document, "klara-gespraech-beginn")).not.toBeNull();
    await klick(q(document, "klara-verlauf-zum-gespraech"));
    // Ungekürzt: alle vier Nachrichten stehen im Gesprächsbereich.
    const bereich = q(document, "klara-gespraechsbereich") as HTMLElement;
    expect(alle(bereich, "klara-nachricht")).toHaveLength(4);
  });
});

// ================================================================================================
// M3 · Einwilligung beim ersten Senden, Widerruf
// ================================================================================================
describe("M3 · UI-MIN-07/08/15 — Einwilligung erst beim Senden; Widerruf in drei Aktionen, am Server wirksam", () => {
  it("„Nicht jetzt“ sendet nichts und behält den Text; „Einverstanden und senden“ schickt genau diese Frage", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    expect(gespraech().dataset.einwilligung).toBe("nein");

    await tippe(eingabe(), GEDECKTE_FRAGE);
    await klick(q(document, "klara-senden"));
    expect(q(document, "klara-einwilligung")).not.toBeNull();
    expect(q(document, "klara-einwilligung")?.textContent).toContain("Einwilligung");
    expect(askAufrufe()).toBe(0);
    expect(eingabe().value).toBe(GEDECKTE_FRAGE);

    await klick(q(document, "klara-einwilligung-abbrechen"));
    expect(q(document, "klara-einwilligung")).toBeNull();
    expect(askAufrufe()).toBe(0);
    expect(eingabe().value).toBe(GEDECKTE_FRAGE);

    await klick(q(document, "klara-senden"));
    await klick(q(document, "klara-einwilligung-erteilen"));
    await bisAntwortGespeichert(1);
    expect(askAufrufe()).toBe(1);
    expect(nachrichten()[0]?.textContent).toContain(GEDECKTE_FRAGE);
    expect(eingabe().value).toBe("");
    expect(gespraech().dataset.einwilligung).toBe("ja");
  });

  it("Widerruf: Menü → Einstellungen → Widerrufen; danach lehnt der Server die Ablage ab und die Fläche fragt erneut", async () => {
    const a = await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    await ersteFrage();

    let aktionen = 0;
    const aktion = async (id: string): Promise<void> => {
      aktionen += 1;
      await klick(q(document, id));
    };
    await aktion("klara-menue-knopf");
    await aktion("klara-menue-einstellungen");
    expect(q(document, "klara-einwilligung-erteilt")).not.toBeNull();
    await aktion("klara-einwilligung-widerrufen");
    await bis(() => Boolean(q(document, "klara-einwilligung-keine")), 120);
    expect(q(document, "klara-einwilligung-keine")).not.toBeNull();
    expect(aktionen).toBeLessThanOrEqual(4);

    // Am Server: keine Einwilligung mehr, eine direkte Ablage einer Frage wird abgewiesen.
    const kopf = (leser as Konto).kopf;
    const stand = await a.app.inject({
      method: "GET",
      url: "/api/me/klara/gespraech",
      headers: kopf,
    });
    expect(stand.statusCode, stand.body).toBe(200);
    const g = (stand.json() as { gespraech: ServerGespraech }).gespraech;
    expect(g.einwilligungAm).toBeNull();
    const abgewiesen = await a.app.inject({
      method: "POST",
      url: `/api/me/klara/gespraeche/${encodeURIComponent(g.id)}/nachrichten`,
      headers: kopf,
      payload: {
        von: "du",
        modus: "frage",
        text: "Synthetische Probe",
        objektbezug: g.objektbezug,
      },
    });
    expect(abgewiesen.statusCode, abgewiesen.body).toBe(409);
    expect(abgewiesen.body).toContain("einwilligung_fehlt");

    // In der Fläche: der nächste Sendeversuch fragt wieder — ohne Aufruf des Fragewegs.
    await taste(gespraech(), "Escape");
    const vorher = askAufrufe();
    await tippe(eingabe(), GEDECKTE_FRAGE);
    await klick(q(document, "klara-senden"));
    expect(q(document, "klara-einwilligung")).not.toBeNull();
    expect(askAufrufe()).toBe(vorher);
  });
});

// ================================================================================================
// M4 · Laufende Anfrage
// ================================================================================================
describe("M4 · UI-MIN-06/14 — Steuerbereich über Menü und Unterseite, Stopp an der Figur, kein Neustart", () => {
  it("die laufende Anfrage bleibt sichtbar und stoppbar — auch eingeklappt; Stopp wirkt; Neuladen startet nichts neu", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    const halt = frageHalten();

    await tippe(eingabe(), GEDECKTE_FRAGE);
    await klick(q(document, "klara-senden"));
    await klick(q(document, "klara-einwilligung-erteilen"));
    await bis(() => Boolean(q(document, "klara-stoppen")), 120);
    const leiste = (): HTMLElement | null => q(document, "klara-vorgaenge");
    expect(leiste()?.querySelector('[data-art="anfrage"]')).not.toBeNull();
    expect(q(document, "klara-laeuft-seit")?.textContent).toMatch(/Anfrage läuft seit \d+ s/);

    // Menü offen und Unterseite: der Steuerbereich bleibt.
    await klick(q(document, "klara-menue-knopf"));
    expect(q(document, "klara-stoppen")).not.toBeNull();
    await klick(q(document, "klara-menue-verlauf"));
    expect(q(document, "klara-unterseite")).not.toBeNull();
    expect(q(document, "klara-stoppen")).not.toBeNull();

    // Einklappen: an der Figur steht derselbe Stopp.
    await klick(q(document, "klara-schliessen"));
    expect(q(document, "klara-gespraech")).toBeNull();
    const anFigur = q(document, "klara-figur-vorgaenge");
    expect(anFigur).not.toBeNull();
    const stopp = anFigur?.querySelector<HTMLButtonElement>('[data-testid="klara-stoppen"]');
    expect(stopp?.dataset.vorgang).toBe("anfrage");
    await klick(stopp);
    await bis(() => !q(document, "klara-figur-vorgaenge"), 160);
    expect(q(document, "klara-figur-vorgaenge")).toBeNull();

    await gespraechOeffnen();
    await bis(() => nachrichten().some((n) => n.dataset.modus === "abgebrochen"), 160);
    const letzte = nachrichten()[nachrichten().length - 1];
    expect(letzte?.dataset.modus).toBe("abgebrochen");
    expect(q(document, "klara-vorgaenge")).toBeNull();
    halt.freigeben();

    // Neuladen setzt keine Anfrage neu in Gang.
    const anfragen = askAufrufe();
    abbauen();
    vergiss();
    await montiere("/");
    await gespraechOeffnen();
    await ruhe();
    expect(askAufrufe()).toBe(anfragen);
    expect(q(document, "klara-vorgaenge")).toBeNull();
  });
});

// ================================================================================================
// M5 · Markierung und Kontextwechsel
// ================================================================================================
describe("M5 · UI-MIN-05/11 — höchstens zwei Vorschläge; Seitenwechsel aktualisiert den Kontext", () => {
  it("eine Markierung zeigt zwei Vorschläge, der Rest ist eingeklappt; nach dem Wechsel gilt sie sichtbar als fremd", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    const zeileVorher = q(document, "klara-bezug-zeile")?.textContent ?? "";

    await markiere(q(document, "probeabsatz") as HTMLElement);
    await bis(() => Boolean(q(document, "klara-auswahl-knopf")), 80);
    await klick(q(document, "klara-auswahl-knopf"));
    await bis(() => Boolean(q(document, "klara-auswahl")));
    const auswahl = q(document, "klara-auswahl") as HTMLElement;
    expect(q(auswahl, "klara-auswahl-text")?.textContent).toContain("Dichtung XQ42");
    const vorschlaege = sichtbareBedienelemente(auswahl).filter((id) =>
      id.startsWith("klara-aktion-"),
    );
    expect(vorschlaege).toEqual(["klara-aktion-erklaeren", "klara-aktion-zusammenfassen"]);
    expect(q<HTMLDetailsElement>(auswahl, "klara-auswahl-mehr")?.open).toBe(false);
    expect(q(document, "klara-bezug")?.dataset.bezug).toBe("markierung");
    expect(q(document, "klara-bezug-zeile")?.textContent).not.toBe(zeileVorher);

    // Seitenwechsel: Ort und Kontextzeile aktualisieren sich; die alte Markierung ist als fremd benannt.
    await klick(q(document, "zu-fragen"));
    await bis(() => q(document, "klara-ort-seite")?.textContent === "Fragen", 120);
    expect(q(document, "klara-ort-seite")?.textContent).toBe("Fragen");
    expect(q(document, "klara-auswahl-andere-seite")).not.toBeNull();
    expect(q(document, "klara-bezug-zeile")?.textContent).not.toContain("Fragen ·");
  });
});

// ================================================================================================
// M6 · Ein Spracheinstieg
// ================================================================================================
describe("M6 · UI-MIN-03/13 — Mikrofon am Eingabefeld: Diktat ohne Senden, Ablehnung, Vorlesestopp", () => {
  it("Diktat füllt das Feld, sendet nichts; die Aufnahme steht im Steuerbereich; Einklappen beendet sie", async () => {
    mitSprache();
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    // Genau EIN Spracheinstieg in der Grundansicht.
    expect(q(document, "klara-diktieren")).toBeNull();
    expect(q(document, "klara-auftrag-sprechen")).toBeNull();
    const mikro = q<HTMLButtonElement>(document, "klara-mikrofon");
    expect(mikro).not.toBeNull();
    expect(mikro?.getAttribute("aria-pressed")).toBe("false");

    await klick(mikro);
    const rec = RekorderDoppel.letzter;
    expect(rec?.gestartet).toBe(1);
    expect(q(document, "klara-vorgaenge")?.querySelector('[data-art="aufnahme"]')).not.toBeNull();
    await act(async () => rec?.hoert("Erkläre die Dichtung XQ42"));
    await ruhe();
    expect(eingabe().value).toBe("Erkläre die Dichtung XQ42");
    expect(askAufrufe()).toBe(0);

    // Menü offen: die Aufnahme bleibt sichtbar und stoppbar.
    await klick(q(document, "klara-menue-knopf"));
    expect(q(document, "klara-aufnahme-stoppen")).not.toBeNull();
    await taste(gespraech(), "Escape");
    await klick(q(document, "klara-aufnahme-stoppen"));
    expect(rec?.gestoppt).toBe(1);
    expect(q(document, "klara-vorgaenge")).toBeNull();

    // Korrigieren, dann erst ausdrücklich senden.
    await tippe(eingabe(), GEDECKTE_FRAGE);
    expect(askAufrufe()).toBe(0);
    await klick(q(document, "klara-senden"));
    await klick(q(document, "klara-einwilligung-erteilen"));
    await bisAntwortGespeichert(1);
    expect(askAufrufe()).toBe(1);

    // Eine neue Aufnahme endet beim Einklappen — kein Mikrofon ohne sichtbaren Stopp.
    await klick(q(document, "klara-mikrofon"));
    const rec2 = RekorderDoppel.letzter;
    await klick(q(document, "klara-schliessen"));
    expect(rec2?.gestoppt).toBe(1);
    expect(q(document, "klara-figur-vorgaenge")).toBeNull();
  });

  it("Mikrofon abgelehnt: ehrlicher Hinweis am Feld, Tippen und Senden gehen weiter; Vorlesen ist stoppbar", async () => {
    mitSprache();
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    await klick(q(document, "klara-mikrofon"));
    const rec = RekorderDoppel.letzter;
    await act(async () => {
      rec?.onerror?.({ error: "not-allowed" });
      rec?.onend?.();
    });
    await ruhe();
    expect(q(document, "klara-sprache-hinweis")?.textContent).toContain(
      "Das Mikrofon ist nicht erlaubt",
    );
    expect(eingabe().disabled).toBe(false);
    await ersteFrage();

    // Vorlesen einer Antwort: als Vorgang sichtbar, direkt stoppbar.
    const klara = nachrichten().filter((n) => n.dataset.von === "klara");
    await klick(klara[klara.length - 1]?.querySelector('[data-testid="klara-vorlesen"]'));
    expect(ausgabe.gesprochen.length).toBe(1);
    expect(q(document, "klara-vorgaenge")?.querySelector('[data-art="vorlesen"]')).not.toBeNull();
    const vorher = ausgabe.abgebrochen;
    await klick(q(document, "klara-vorlesen-stoppen"));
    expect(ausgabe.abgebrochen).toBeGreaterThan(vorher);
    expect(q(document, "klara-vorgaenge")).toBeNull();
  });
});

// ================================================================================================
// M7 · Ohne Modell; Quellen auf Wunsch
// ================================================================================================
describe("M7 · UI-MIN-07/09 — Verfügbarkeit knapp, Erklärung in den Details, Antwort ehrlich gekennzeichnet", () => {
  it("ohne Modell: „ohne KI“ in der Kontextzeile, kein Dauerblock; die Antwort heisst nicht KI-Antwort", async () => {
    await vorrichtung(true);
    await montiere("/");
    await gespraechOeffnen();
    await bis(() => Boolean(q(document, "klara-verfuegbarkeit")), 160);
    expect(q(document, "klara-verfuegbarkeit")?.textContent).toBe("ohne KI");
    const lang = q(document, "klara-ki-ohne-modell");
    expect(lang?.textContent).toContain("Kein KI-Modell aktiv");
    expect(sichtbarImBaum(lang as Element)).toBe(false);

    await ersteFrage();
    const klara = nachrichten().filter((n) => n.dataset.von === "klara");
    const antwort = klara[klara.length - 1];
    expect(antwort?.dataset.modus).not.toBe("ki");
    expect(antwort?.textContent ?? "").not.toContain("KI-Antwort");
    // Quellen: Titel sichtbar, Fassung und Prüfstand auf Wunsch.
    const quellen = antwort?.querySelector('[data-testid="klara-quellen"]');
    if (quellen) {
      const details = quellen.querySelector<HTMLDetailsElement>(
        '[data-testid="klara-quellen-details"]',
      );
      expect(details?.open).toBe(false);
      expect(quellen.querySelectorAll('[data-testid="klara-quelle"]').length).toBeGreaterThan(0);
    }
  });
});

// ================================================================================================
// M8 · Nacharbeit 2 (Bens Befund): der Entwurf behält seinen Ursprung — kein stilles neues Ziel
// ================================================================================================
describe("M8 · UI-MIN-05/12 — ein Entwurf von einer anderen Seite wird nicht still auf das neue Ziel gesendet", () => {
  it("nach dem Seitenwechsel fragt die Fläche nach dem Ziel; „Wie begonnen“ sendet mit dem Ursprung", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    await ersteFrage();
    const ursprung = q(document, "klara-ort-seite")?.textContent ?? "";
    expect(ursprung).not.toBe("Fragen");

    await tippe(eingabe(), GEDECKTE_FRAGE);
    await klick(q(document, "zu-fragen"));
    await bis(() => q(document, "klara-ort-seite")?.textContent === "Fragen", 120);
    const vorher = askAufrufe();
    await klick(q(document, "klara-senden"));
    // Kein Versand, solange das Ziel nicht geklärt ist; der Entwurf steht noch da.
    expect(q(document, "klara-ziel-klaeren")?.textContent).toContain(ursprung);
    expect(q(document, "klara-ziel-klaeren")?.textContent).toContain("Fragen");
    expect(askAufrufe()).toBe(vorher);
    expect(eingabe().value).toBe(GEDECKTE_FRAGE);

    // Abbrechen behält den Entwurf; erneutes Senden fragt erneut.
    await klick(q(document, "klara-ziel-abbrechen"));
    expect(q(document, "klara-ziel-klaeren")).toBeNull();
    expect(eingabe().value).toBe(GEDECKTE_FRAGE);
    await klick(q(document, "klara-senden"));
    await klick(q(document, "klara-ziel-ursprung"));
    await bisAntwortGespeichert(2);
    expect(askAufrufe()).toBe(vorher + 1);
    const du = nachrichten().filter((n) => n.dataset.von === "du");
    const herkunft = du[du.length - 1]?.querySelector('[data-testid="klara-nachricht-herkunft"]');
    expect(herkunft?.textContent).toContain(ursprung);
    expect(herkunft?.textContent).not.toContain("Fragen");
  });

  it("„Hier“ sendet ausdrücklich mit dem neuen Ort; ein Entwurf am selben Ort fragt nicht", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    await ersteFrage();
    await tippe(eingabe(), GEDECKTE_FRAGE);
    await klick(q(document, "zu-fragen"));
    await bis(() => q(document, "klara-ort-seite")?.textContent === "Fragen", 120);
    await klick(q(document, "klara-senden"));
    await klick(q(document, "klara-ziel-jetzt"));
    await bisAntwortGespeichert(2);
    const du = nachrichten().filter((n) => n.dataset.von === "du");
    const letzte = du[du.length - 1];
    expect(
      letzte?.querySelector('[data-testid="klara-nachricht-herkunft"]')?.textContent,
    ).toContain("Fragen");

    // Begonnen und gesendet auf derselben Seite: keine Rückfrage.
    await tippe(eingabe(), GEDECKTE_FRAGE);
    await klick(q(document, "klara-senden"));
    expect(q(document, "klara-ziel-klaeren")).toBeNull();
    await bisAntwortGespeichert(3);
  });
});

// ================================================================================================
// M9 · Nacharbeit 2 (Bens Befund): eine abgewiesene Markierung verliert den Text nicht
// ================================================================================================
describe("M9 · UI-MIN-03/12 — nicht gesendet heisst: der Entwurf steht wieder im Feld", () => {
  it("die Markierung wird vor dem Versand abgewiesen; Text und Grund bleiben, der Frageweg wird nicht gerufen", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    await ersteFrage();
    const vorher = askAufrufe();
    // Eine Markierung aus einem Wissensobjekt, das es (für dieses Konto) nicht gibt.
    await act(async () => {
      aendere((z) => ({
        ...z,
        bezug: "markierung",
        auswahl: {
          id: "auswahl-unbekannt",
          text: "Synthetischer Ausschnitt ohne lesbare Herkunft",
          herkunft: {
            pfad: "/wissen/ko-gibt-es-nicht",
            seite: "wissen" as const,
            seitenName: "Wissen",
            objekt: "„Unbekannt“",
            koId: "ko-gibt-es-nicht",
          },
        },
      }));
    });
    await ruhe();
    await tippe(eingabe(), GEDECKTE_FRAGE);
    await klick(q(document, "klara-senden"));
    await bis(() => Boolean(q(document, "klara-auswahl-gesperrt")), 120);
    expect(q(document, "klara-auswahl-gesperrt")).not.toBeNull();
    await bis(() => eingabe().value === GEDECKTE_FRAGE, 80);
    expect(eingabe().value).toBe(GEDECKTE_FRAGE);
    expect(askAufrufe()).toBe(vorher);
  });
});

// ================================================================================================
// M11 · Nacharbeit 3 (Bens Befund): neuer Text WÄHREND der Auswahlprüfung, danach abgewiesen
// ================================================================================================
describe("M11 · UI-MIN-03/12, UI-S09 — der Entwurf bleibt bis zur Übergabe; ein später abgewiesener Entwurf geht nicht verloren", () => {
  it("während der Prüfung steht der Entwurf im Feld; danach getippter Text bleibt, der abgewiesene ist separat zurückholbar", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    await ersteFrage();
    const vorher = askAufrufe();
    await act(async () => {
      aendere((z) => ({
        ...z,
        bezug: "markierung",
        auswahl: {
          id: "auswahl-gehalten",
          text: "Synthetischer Ausschnitt ohne lesbare Herkunft",
          herkunft: {
            pfad: "/wissen/ko-gibt-es-nicht",
            seite: "wissen" as const,
            seitenName: "Wissen",
            objekt: "„Unbekannt“",
            koId: "ko-gibt-es-nicht",
          },
        },
      }));
    });
    await ruhe();

    // Die Auswahlprüfung (GET des Wissensobjekts) wird angehalten, bis der Test sie freigibt.
    const ohneHalt = globalThis.fetch;
    let freigeben: (() => void) | null = null;
    const halten = (async (eingabe: unknown, init?: RequestInit) => {
      if (String(eingabe).startsWith("/api/kos/ko-gibt-es-nicht")) {
        await new Promise<void>((weiter) => {
          freigeben = weiter;
        });
      }
      return ohneHalt(eingabe as RequestInfo, init);
    }) as unknown as typeof globalThis.fetch;
    globalThis.fetch = halten;
    window.fetch = halten;

    const ENTWURF_A = "Erster Entwurf zur Markierung";
    const NEU_B = "Zweiter Gedanke";
    await tippe(eingabe(), ENTWURF_A);
    await klick(q(document, "klara-senden"));
    await bis(() => freigeben !== null, 80);
    // Noch nicht übergeben: der Entwurf steht unverändert im Feld.
    expect(eingabe().value).toBe(ENTWURF_A);

    // Die Person schreibt währenddessen etwas Neues.
    await tippe(eingabe(), NEU_B);
    await act(async () => {
      freigeben?.();
    });
    await bis(() => Boolean(q(document, "klara-auswahl-gesperrt")), 160);
    await bis(() => Boolean(q(document, "klara-abgewiesen")), 80);

    // Der neue Text bleibt, der abgewiesene Entwurf ist separat sichtbar und zurückholbar.
    expect(eingabe().value).toBe(NEU_B);
    expect(q(document, "klara-abgewiesen")?.textContent).toContain(ENTWURF_A);
    expect(askAufrufe()).toBe(vorher);

    // Nacharbeit 5 (Bens Befund): ein weiteres Senden räumt den abgewiesenen Entwurf NICHT still ab.
    globalThis.fetch = ohneHalt;
    window.fetch = ohneHalt;
    await klick(q(document, "klara-senden"));
    await ruhe();
    await bis(() => eingabe().value === NEU_B, 80);
    expect(q(document, "klara-abgewiesen")?.textContent).toContain(ENTWURF_A);
    expect(askAufrufe()).toBe(vorher);

    // … und auch Neuladen nicht: er liegt kontogebunden in der Sitzung, samt Herkunft.
    const gesichert = Object.keys(sessionStorage)
      .map((k) => sessionStorage.getItem(k) ?? "")
      .find((v) => v.includes(ENTWURF_A));
    expect(gesichert).toBeDefined();
    const sitzung = JSON.parse(gesichert ?? "{}") as {
      kontoId: string | null;
      abgewiesen: Array<{ text: string; herkunft: { pfad: string } | null }>;
    };
    expect(sitzung.kontoId).not.toBeNull();
    expect(sitzung.abgewiesen.map((a) => [a.text, a.herkunft?.pfad])).toEqual([[ENTWURF_A, "/"]]);
    abbauen();
    vergiss();
    await montiere("/");
    await gespraechOeffnen();
    await bis(() => Boolean(q(document, "klara-abgewiesen")), 80);
    expect(q(document, "klara-abgewiesen")?.textContent).toContain(ENTWURF_A);
    expect(eingabe().value).toBe(NEU_B);
    await klick(q(document, "klara-abgewiesen-zurueckholen"));
    expect(eingabe().value).toBe(`${NEU_B} ${ENTWURF_A}`);
    expect(q(document, "klara-abgewiesen")).toBeNull();
  });

  it("wird die Frage angenommen, leert sich das Feld erst bei der Übergabe — und nur, wenn es noch den Entwurf trägt", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    await ersteFrage();
    await tippe(eingabe(), GEDECKTE_FRAGE);
    await klick(q(document, "klara-senden"));
    await bisAntwortGespeichert(2);
    expect(eingabe().value).toBe("");
    expect(q(document, "klara-abgewiesen")).toBeNull();
  });
});

// ================================================================================================
// M10 · Nacharbeit 2 (Bens Befund): KI abgeschaltet — knapp in der Grundansicht, erklärt am Auftrag
// ================================================================================================
describe("M10 · UI-MIN-01/07/11 — abgeschaltete KI: kein Dauerblock, Sperre wirksam, Erklärung beim Senden", () => {
  it("die Grundansicht bleibt bei vier Bereichen; erst der Sendeversuch zeigt die Sperre, nichts geht hinaus", async () => {
    const a = await vorrichtung();
    const aus = await a.app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      headers: a.admin.kopf,
      payload: { global: "deterministic" },
    });
    expect(aus.statusCode, aus.body).toBe(200);
    await montiere("/");
    await gespraechOeffnen();
    await bis(() => q(document, "klara-verfuegbarkeit")?.textContent === "KI aus", 160);
    expect(q(document, "klara-verfuegbarkeit")?.textContent).toBe("KI aus");
    expect(q(document, "klara-ki-aus-hinweis")).toBeNull();
    expect(sichtbareBedienelemente(gespraech())).toEqual([
      "klara-menue-knopf",
      "klara-schliessen",
      "klara-kontext-zeile",
      "klara-eingabe",
      "klara-senden",
    ]);

    await tippe(eingabe(), GEDECKTE_FRAGE);
    await klick(q(document, "klara-senden"));
    expect(q(document, "klara-ki-aus-hinweis")).not.toBeNull();
    expect(q(document, "klara-einwilligung")).toBeNull();
    expect(askAufrufe()).toBe(0);
    expect(eingabe().value).toBe(GEDECKTE_FRAGE);
  });
});

// ================================================================================================
// M12 · Integration main (produkt:20261008:klara-aktionen, Klara 05) in die minimale Grundansicht
// ================================================================================================
describe("M12 · UI-MIN-03/06/14 + Klara 05 — ein Ausführungsauftrag im minimalen Gespräch", () => {
  it("Hinweis erst bei erkanntem Auftrag, derselbe Ausführungsweg, kein Frageweg; laufend einzeln stoppbar — im Menü und eingeklappt", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    expect(gespraech().dataset.oberflaeche).toBe("minimal");
    expect(q(document, "klara-eingabe-auftrag")).toBeNull();

    // Die gebundene Ausführung am Server wird angehalten, bis der Fall sie freigibt.
    const vorher = globalThis.fetch;
    let freigabe: (() => void) | null = null;
    const halten = (async (e: unknown, init?: RequestInit) => {
      if (String(e).endsWith("/ausfuehrung") && (init?.method ?? "GET").toUpperCase() === "POST") {
        await new Promise<void>((weiter) => {
          freigabe = weiter;
        });
      }
      return vorher(e as RequestInfo, init);
    }) as unknown as typeof globalThis.fetch;
    globalThis.fetch = halten;
    window.fetch = halten;

    // Eine Frage zeigt keinen Auftragshinweis; ein klarer Auftrag zeigt seine Schritte VOR dem Senden.
    await tippe(eingabe(), GEDECKTE_FRAGE);
    expect(q(document, "klara-eingabe-auftrag")).toBeNull();
    await tippe(eingabe(), "Lege den Entwurf „Synthetische Wartung M12“ an");
    expect(q(document, "klara-eingabe-auftrag")?.textContent).toContain(
      "Entwurf anlegen: „Synthetische Wartung M12“",
    );
    await klick(q(document, "klara-senden"));
    await bis(() => freigabe !== null, 240);

    // Läuft: die Auftragskarte im Gespräch, der Auftrag einzeln im Steuerbereich, Feld geleert.
    expect(q(document, "klara-ausfuehrung")).not.toBeNull();
    expect(eingabe().value).toBe("");
    expect(q(document, "klara-einwilligung")).toBeNull();
    const leiste = (): HTMLElement | null => q(document, "klara-vorgaenge");
    await bis(() => Boolean(leiste()?.querySelector('[data-art^="ausfuehrung-"]')), 120);
    expect(leiste()?.textContent).toContain("Auftrag läuft");

    // Menü offen: der Stopp bleibt erreichbar.
    await klick(q(document, "klara-menue-knopf"));
    expect(q(document, "klara-ausfuehrung-stoppen")).not.toBeNull();
    await klick(q(document, "klara-menue-knopf"));

    // Eingeklappt: derselbe Stopp an der Figur.
    await klick(q(document, "klara-schliessen"));
    expect(q(document, "klara-gespraech")).toBeNull();
    const stopp = q(document, "klara-figur-vorgaenge")?.querySelector<HTMLButtonElement>(
      '[data-testid="klara-ausfuehrung-stoppen"]',
    );
    expect(stopp?.dataset.vorgang).toMatch(/^ausfuehrung-/);

    // Kein Frageweg: an `/api/ask` ging nichts — es war ein Auftrag, keine Frage.
    expect(askAufrufe()).toBe(0);

    // Freigabe: der Auftrag endet am Server; der Steuerbereich leert sich.
    (freigabe as (() => void) | null)?.();
    await bis(() => !q(document, "klara-figur-vorgaenge"), 240);
    expect(q(document, "klara-figur-vorgaenge")).toBeNull();
    await gespraechOeffnen();
    await bis(
      () =>
        ["fertig", "angehalten"].includes(q(document, "klara-ausfuehrung")?.dataset.phase ?? ""),
      240,
    );
    expect(["fertig", "angehalten"]).toContain(q(document, "klara-ausfuehrung")?.dataset.phase);
    expect(askAufrufe()).toBe(0);
  });

  // Nacharbeit 24 (Ben, UI-MIN-12): auch ein Ausführungsauftrag behält die Herkunft seines Entwurfs.
  it("auf Seite A begonnen, auf B gesendet: erst die Zielklärung, dann der Auftrag mit der gewählten Herkunft", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    const satz = "Lege den Entwurf „Synthetische Wartung M13“ an";
    await tippe(eingabe(), satz);
    expect(q(document, "klara-eingabe-auftrag")).not.toBeNull();

    // Ortswechsel vor dem Senden.
    await klick(q(document, "zu-fragen"));
    await bis(() => q(document, "klara-ort-seite")?.textContent === "Fragen", 120);
    expect(eingabe().value).toBe(satz);

    // Senden klärt zuerst das Ziel — vorher startet NICHTS, der Entwurf bleibt.
    await klick(q(document, "klara-senden"));
    expect(q(document, "klara-ziel-klaeren")).not.toBeNull();
    expect(q(document, "klara-ausfuehrung")).toBeNull();
    expect(leseAusfuehrungen()).toEqual([]);
    expect(eingabe().value).toBe(satz);

    // „Wie begonnen“: der Auftrag trägt die Herkunft des Entwurfs (Startseite), nicht „Fragen“.
    await klick(q(document, "klara-ziel-ursprung"));
    await bis(() => Boolean(q(document, "klara-ausfuehrung")), 240);
    expect(q(document, "klara-ziel-klaeren")).toBeNull();
    const [auftrag] = leseAusfuehrungen();
    expect(auftrag?.herkunft.pfad).toBe("/");
    expect(auftrag?.herkunft.pfad).not.toBe("/fragen");
    expect(eingabe().value).toBe("");
    expect(askAufrufe()).toBe(0);
  });

  it("„Hier“ in der Zielklärung: der Auftrag trägt ausdrücklich den neuen Ort", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    await tippe(eingabe(), "Lege den Entwurf „Synthetische Wartung M14“ an");
    await klick(q(document, "zu-fragen"));
    await bis(() => q(document, "klara-ort-seite")?.textContent === "Fragen", 120);
    await klick(q(document, "klara-senden"));
    expect(q(document, "klara-ziel-klaeren")).not.toBeNull();
    await klick(q(document, "klara-ziel-jetzt"));
    await bis(() => Boolean(q(document, "klara-ausfuehrung")), 240);
    expect(leseAusfuehrungen()[0]?.herkunft.pfad).toBe("/fragen");
    expect(askAufrufe()).toBe(0);
  });
});

// ================================================================================================
// M15 · Nacharbeit 33 (Ben, UI-MIN-08/15): Klara 12 — der persönliche Unterstützungsmodus aus main
// ================================================================================================
describe("M15 · UI-MIN-08/11/15 + Klara 12 — Unterstützungsmodus über Menü → Einstellungen", () => {
  it("nicht in der Grundansicht; in den Einstellungen wählbar, am Konto gespeichert, nach Neuladen wieder da", async () => {
    verwerfeEigeninitiative();
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    expect(gespraech().dataset.oberflaeche).toBe("minimal");
    // Die Grundansicht bleibt bei vier Bereichen — keine Modus-Wahl dort.
    expect(q(document, "klara-eigeninitiative")).toBeNull();

    await klick(q(document, "klara-menue-knopf"));
    await klick(q(document, "klara-menue-einstellungen"));
    await bis(() => q(document, "klara-eigeninitiative")?.dataset.stand === "bereit", 200);
    const wahl = q(document, "klara-eigeninitiative") as HTMLElement;
    expect(wahl.closest('[data-testid="klara-einstellung-unterstuetzung"]')).not.toBeNull();
    expect(wahl.dataset.modus).toBe("nachfrage");

    // Wählen: derselbe persönliche Speicherweg wie im bisherigen Panel.
    const hinweise = q(document, "klara-eigeninitiative-hinweise")?.querySelector("input");
    await klick(hinweise);
    await bis(
      () => (q(document, "klara-eigeninitiative-stand")?.textContent ?? "").includes("gespeichert"),
      200,
    );
    expect(q(document, "klara-eigeninitiative")?.dataset.modus).toBe("hinweise");
    if (!aufbau || !leser) {
      throw new Error("Vorrichtung fehlt");
    }
    const amServer = await aufbau.app.inject({
      method: "GET",
      url: "/api/me/assistenz/eigeninitiative",
      headers: leser.kopf,
    });
    expect(amServer.statusCode, amServer.body).toBe(200);
    expect(amServer.json()).toMatchObject({ modus: "hinweise", gewaehlt: true });

    // Neuladen: die Wahl kommt vom Konto zurück, wieder über die Einstellungen erreichbar.
    abbauen();
    vergiss();
    verwerfeEigeninitiative();
    await montiere("/");
    await gespraechOeffnen();
    expect(q(document, "klara-eigeninitiative")).toBeNull();
    await klick(q(document, "klara-menue-knopf"));
    await klick(q(document, "klara-menue-einstellungen"));
    await bis(() => q(document, "klara-eigeninitiative")?.dataset.stand === "bereit", 200);
    expect(q(document, "klara-eigeninitiative")?.dataset.modus).toBe("hinweise");
  });
});

// ================================================================================================
// M16 · Integration main (BPA-13, assistenz-ki-arbeitsbegleitung) in die minimale Oberfläche
// ================================================================================================
describe("M16 · UI-MIN-08/11/15 + BPA-13 — KI-Arbeitsweg über Menü → Meine Funktionen", () => {
  it("nicht in der Grundansicht; unter „Meine Funktionen“ am eigenen gespeicherten Gespräch erreichbar", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    // Ein gespeichertes eigenes Gespräch (mit Einwilligung) — daran hängt der Arbeitsweg.
    await ersteFrage();
    // Die Grundansicht bleibt bei vier Bereichen — kein Arbeitsweg-Block dort.
    expect(q(document, "ki-arbeitsweg")).toBeNull();
    expect(q(document, "klara-funktion-ki-arbeitsweg")).toBeNull();

    await klick(q(document, "klara-menue-knopf"));
    await klick(q(document, "klara-menue-funktionen"));
    const bereich = (): HTMLElement | null => q(document, "klara-funktion-ki-arbeitsweg");
    await bis(() => Boolean(bereich()), 80);
    expect(bereich()).not.toBeNull();
    // Die vorhandene Fläche lädt ihre Lage vom Server (bereit, oder ehrlich: Fehler / keine KI).
    const geladen = '[data-testid="ki-arbeitsweg"], [data-testid="ki-arbeitsweg-fehler"]';
    await bis(() => Boolean(bereich()?.querySelector(geladen)), 200);
    expect(bereich()?.querySelector(geladen)).not.toBeNull();

    // Zurück zum Gespräch: der Arbeitsweg verschwindet wieder aus der Ansicht.
    await taste(gespraech(), "Escape");
    await bis(() => !q(document, "klara-funktion-ki-arbeitsweg"), 40);
    expect(q(document, "ki-arbeitsweg")).toBeNull();
  });

  /** Aufbau mit derselben Adminfreigabe für öffentliche KI wie in main's BPA-13-Prüfaufbau. */
  async function kiVorrichtung(): Promise<Aufbau> {
    const halter: { dienste: Dienste | null } = { dienste: null };
    const a = await appAufbauen(false, () => {
      const d = buildServices();
      halter.dienste = d;
      return d;
    });
    aufbau = a;
    if (!halter.dienste) {
      throw new Error("Dienste fehlen");
    }
    await erteileKiFreigabe(halter.dienste.reasoner);
    draht.setzeApp(a.app);
    await eintragMitOriginal(a.app, a.admin);
    leser = await neuesKonto(a.app, "assistenz-ki", a.admin);
    draht.setzeCookie(`kw_session=${leser.token}`);
    await montiere("/");
    await gespraechOeffnen();
    await ersteFrage();
    return a;
  }

  /** Einen Auftrag in der vorhandenen Fläche unter „Meine Funktionen“ vorbereiten. */
  async function kiAuftragVorbereiten(ziel: string): Promise<void> {
    await klick(q(document, "klara-menue-knopf"));
    await klick(q(document, "klara-menue-funktionen"));
    await bis(() => Boolean(q(document, "ki-arbeitsweg-ziel")), 200);
    const feld = q<HTMLTextAreaElement>(document, "ki-arbeitsweg-ziel") as HTMLTextAreaElement;
    const setzen = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      setzen?.call(feld, ziel);
      feld.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await klick(q(document, "ki-arbeitsweg-vorbereiten"));
    await bis(() => Boolean(q(document, "ki-auftrag-uebergeben")), 200);
  }

  /** Die Stände der KI-Aufträge eines Gesprächs am Server. */
  async function kiStaendeAmServer(a: Aufbau, gid: string): Promise<string[]> {
    if (!leser) {
      throw new Error("Vorrichtung fehlt");
    }
    const r = await a.app.inject({
      method: "GET",
      url: `/api/me/klara/gespraeche/${gid}/ki-auftraege`,
      headers: leser.kopf,
    });
    expect(r.statusCode, r.body).toBe(200);
    return (r.json() as { auftraege: Array<{ job: { status: string } }> }).auftraege.map(
      (x) => x.job.status,
    );
  }

  const kiGespraeche = (): string[] => Object.keys(leseKiAuftraege().proGespraech);

  // Nacharbeit 35 (Ben, UI-MIN-06/14): ein übergebener KI-Auftrag läuft weiter, wenn die Seite
  // verlassen oder Klara eingeklappt wird — seine Steuerung bleibt einzeln sichtbar und wirksam.
  it("übergebener Auftrag: nach Verlassen der Seite und eingeklappt einzeln stoppbar, am Server wirksam", async () => {
    const a = await kiVorrichtung();
    await kiAuftragVorbereiten("Synthetische Zusammenfassung M17");
    await klick(q(document, "ki-auftrag-uebergeben"));
    await bis(() => q(document, "ki-auftrag")?.dataset.status === "gesendet", 200);
    expect(q(document, "ki-auftrag")?.dataset.status).toBe("gesendet");

    // Seite verlassen: der laufende Auftrag steht einzeln im Steuerbereich.
    await taste(gespraech(), "Escape");
    await bis(() => !q(document, "klara-funktion-ki-arbeitsweg"), 40);
    expect(q(document, "ki-arbeitsweg")).toBeNull();
    const leiste = (): HTMLElement | null => q(document, "klara-vorgaenge");
    expect(leiste()?.querySelector('[data-art^="ki-"]')).not.toBeNull();
    expect(leiste()?.textContent).toContain("KI-Auftrag läuft");
    expect(q(document, "klara-ki-unterbrechen")).not.toBeNull();
    expect(q(document, "klara-ki-stoppen")).not.toBeNull();

    // Eingeklappt: derselbe Stopp an der Figur — und er wirkt am Server.
    await klick(q(document, "klara-schliessen"));
    expect(q(document, "klara-gespraech")).toBeNull();
    const stopp = q(document, "klara-figur-vorgaenge")?.querySelector<HTMLButtonElement>(
      '[data-testid="klara-ki-stoppen"]',
    );
    expect(stopp?.dataset.vorgang).toMatch(/^ki-/);
    await klick(stopp);
    await bis(() => !q(document, "klara-figur-vorgaenge"), 200);
    expect(q(document, "klara-figur-vorgaenge")).toBeNull();

    const [gid] = kiGespraeche();
    expect(gid).toBeDefined();
    expect(await kiStaendeAmServer(a, gid as string)).toEqual(["gestoppt"]);
  });

  // Nacharbeit 38 (Ben, UI-MIN-06/14): während die Übergabe noch aussteht (wie bei einem API-Weg,
  // dessen Antwort erst nach der Ausführung kommt), ist der Auftrag bereits steuerbar. Der Server hält
  // den Sendestand VOR dem Anbieteraufruf fest; hier wird deshalb die ANTWORT der Übergabe angehalten.
  it("ausstehende Übergabe: Vorgang schon sichtbar, Stopp bedienbar und am Server wirksam", async () => {
    const a = await kiVorrichtung();
    await kiAuftragVorbereiten("Synthetische Zusammenfassung M16c");
    const vorher = globalThis.fetch;
    let freigabe: (() => void) | null = null;
    const halten = (async (e: unknown, init?: RequestInit) => {
      const antwort = await vorher(e as RequestInfo, init);
      if (String(e).endsWith("/uebergabe") && (init?.method ?? "GET").toUpperCase() === "POST") {
        await new Promise<void>((weiter) => {
          freigabe = weiter;
        });
      }
      return antwort;
    }) as unknown as typeof globalThis.fetch;
    globalThis.fetch = halten;
    window.fetch = halten;

    await klick(q(document, "ki-auftrag-uebergeben"));
    await bis(() => freigabe !== null, 200);
    // Die Übergabe steht aus — die lokalen Steuerknöpfe sind trotzdem bedienbar.
    const lokalStopp = q<HTMLButtonElement>(document, "ki-auftrag-stoppen");
    expect(lokalStopp?.disabled).toBe(false);
    expect(q<HTMLButtonElement>(document, "ki-auftrag-unterbrechen")?.disabled).toBe(false);
    // Die Vorgangsleiste liest den Serverstand nach und zeigt den Auftrag schon jetzt.
    const leiste = (): HTMLElement | null => q(document, "klara-vorgaenge");
    await bis(() => Boolean(leiste()?.querySelector('[data-art^="ki-"]')), 240);
    expect(leiste()?.querySelector('[data-art^="ki-"]')).not.toBeNull();

    // Seite verlassen, Stopp aus der Leiste — noch während die Übergabe aussteht.
    await taste(gespraech(), "Escape");
    await bis(() => !q(document, "klara-funktion-ki-arbeitsweg"), 40);
    await klick(q(document, "klara-ki-stoppen"));
    const [gid] = kiGespraeche();
    expect(await kiStaendeAmServer(a, gid as string)).toEqual(["gestoppt"]);

    // Die Übergabe antwortet spät: am Ende läuft nichts mehr.
    (freigabe as (() => void) | null)?.();
    await bis(() => !leiste()?.querySelector('[data-art^="ki-"]'), 240);
    expect(leiste()?.querySelector('[data-art^="ki-"]') ?? null).toBeNull();
    expect(await kiStaendeAmServer(a, gid as string)).toEqual(["gestoppt"]);
  });

  // Nacharbeit 38 (Ben, UI-MIN-14): ein laufender Auftrag bleibt über einen Gesprächswechsel hinweg
  // sichtbar und an SEIN Gespräch gebunden — der Stopp geht dorthin, nicht an das neue Gespräch.
  it("Gesprächswechsel: laufender Auftrag des früheren Gesprächs bleibt sichtbar und stoppt dort", async () => {
    const a = await kiVorrichtung();
    await kiAuftragVorbereiten("Synthetische Zusammenfassung M16d");
    await klick(q(document, "ki-auftrag-uebergeben"));
    await bis(() => q(document, "ki-auftrag")?.dataset.status === "gesendet", 200);
    const [gidAlt] = kiGespraeche();
    expect(gidAlt).toBeDefined();
    await taste(gespraech(), "Escape");

    // Neues Gespräch beginnen.
    await klick(q(document, "klara-menue-knopf"));
    await klick(q(document, "klara-menue-neu"));
    await klick(q(document, "klara-neues-gespraech"));
    await bis(() => nachrichten().length === 0 && Boolean(q(document, "klara-eingabe")), 120);

    // Der Auftrag des früheren Gesprächs steht weiter einzeln im Steuerbereich.
    const leiste = (): HTMLElement | null => q(document, "klara-vorgaenge");
    await bis(() => Boolean(leiste()?.querySelector('[data-art^="ki-"]')), 120);
    expect(leiste()?.textContent).toContain("KI-Auftrag läuft");
    await klick(q(document, "klara-ki-stoppen"));
    await bis(() => !leiste()?.querySelector('[data-art^="ki-"]'), 200);
    expect(leiste()?.querySelector('[data-art^="ki-"]') ?? null).toBeNull();
    // Der Stopp traf das Gespräch, aus dem der Auftrag stammt.
    expect(await kiStaendeAmServer(a, gidAlt as string)).toEqual(["gestoppt"]);
  });
});

// ================================================================================================
// M18 · Integration main (Klara 06, klara-notizen-aufgaben) in die minimale Oberfläche
// ================================================================================================
describe("M18 · UI-MIN-08/11/12 + Klara 06 — Notiz an der Nachricht anlegen, unter „Meine Funktionen“ wiederfinden", () => {
  it("keine Notizliste in der Grundansicht; „Als Notiz“ an der gespeicherten Antwort; die Notiz steht unter „Meine Funktionen“", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    await ersteFrage();
    expect(q(document, "klara-notizen")).toBeNull();

    // An der gespeicherten Antwort: als private Notiz merken (derselbe Serverweg wie im Panel).
    const antwort = nachrichten()
      .filter((n) => n.dataset.von === "klara")
      .at(-1);
    const alsNotiz = antwort?.querySelector<HTMLButtonElement>(
      '[data-testid="klara-nachricht-als-notiz"]',
    );
    expect(alsNotiz).not.toBeNull();
    await klick(alsNotiz);
    await ruhe();

    // Wiederfinden: Menü → Meine Funktionen → die eigene Notizliste mit genau dieser Notiz.
    await klick(q(document, "klara-menue-knopf"));
    await klick(q(document, "klara-menue-funktionen"));
    const bereich = (): HTMLElement | null => q(document, "klara-funktion-notizen");
    const eintraege = (): number =>
      bereich()?.querySelectorAll('[data-testid="klara-notiz-eintrag"]').length ?? 0;
    await bis(() => eintraege() > 0, 200);
    expect(bereich()?.querySelector('[data-testid="klara-notizen"]')).not.toBeNull();
    expect(eintraege()).toBe(1);

    // Zurück: die Liste verlässt die Ansicht wieder.
    await taste(gespraech(), "Escape");
    await bis(() => !q(document, "klara-notizen"), 40);
    expect(q(document, "klara-notizen")).toBeNull();
  });
});

// ================================================================================================
// M19 · Integration main (Klara 07, klara-aufgaben) in die minimale Oberfläche
// ================================================================================================
describe("M19 · UI-MIN-08/11 + Klara 07 — die eigenen Aufgaben unter „Meine Funktionen“", () => {
  it("keine Aufgabenliste in der Grundansicht; unter „Meine Funktionen“ erreichbar", async () => {
    await vorrichtung();
    await montiere("/");
    await gespraechOeffnen();
    expect(q(gespraech(), "klara-aufgaben")).toBeNull();

    await klick(q(document, "klara-menue-knopf"));
    await klick(q(document, "klara-menue-funktionen"));
    const bereich = (): HTMLElement | null => q(document, "klara-funktion-aufgaben");
    await bis(() => Boolean(bereich()?.querySelector('[data-testid="klara-aufgaben"]')), 120);
    expect(bereich()?.querySelector('[data-testid="klara-aufgaben"]')).not.toBeNull();

    await taste(gespraech(), "Escape");
    await bis(() => !q(document, "klara-funktion-aufgaben"), 40);
    expect(q(document, "klara-funktion-aufgaben")).toBeNull();
  });
});
