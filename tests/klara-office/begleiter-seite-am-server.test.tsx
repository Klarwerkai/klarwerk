// @vitest-environment jsdom
// ================================================================================================
// KLARA-OFFICE-02 · DIE FLÄCHE DER BEGLEITAPP GEGEN DEN ECHTEN SERVER.
// ================================================================================================
//
// Dieselbe Montage wie `tests/klara-produkt/produkteinstieg-am-server.test.tsx`: echte Hülle (hier
// ihr hüllenloser Zweig `/begleiter`), echte App im selben Prozess über den Draht aus
// `tests/klara-quellen-nutzerweg/kette.ts`, echte Anmeldung. Die native App ist durch ihren
// Nachrichtenkanal vertreten (`window.webkit.messageHandlers.klaraBegleiter`, aufgezeichnet), das
// Word-Fenster durch denselben HTTP-Weg, den `word-addin/begleiter.js` geht (`app.inject` mit der
// Anmeldung derselben Person). Alle Konten und Inhalte sind fiktiv.
//
// WAS DIESER FALL NICHT ZEIGT: ein echtes macOS-Fenster, echtes Ziehen über Word, Vollbild,
// Mehrmonitor, Mikrofon. Das ist die lokale Bedienabnahme (docs/operations/klara-office/).
//
//   S1  KO-02-02/-03 · Figur: gewählter (bzw. gelieferter) Avatar, Zustand „bereit", Hinweis „kein
//       Word-Fenster", Lage „figur" an die App; Pfeiltasten bewegen, Umschalt weiter.
//   S2  KO-02-03 · Gespräch öffnen und schliessen (Klick, Escape, Befehl der App) — mit Lage an die App.
//   S3  KO-02-05 · Word-Kontext ausschliesslich vom angemeldeten Adapter: Host, Fassung, Dateiname,
//       Markierung; eine Frage zur Markierung geht an DIESES Word-Fenster, seine Antwort kommt zurück.
//   S4  KO-02-01 · Fassungen sichtbar: Webfläche und App, so wie die App sie selbst einträgt.
//   S5–S7  UI-MIN-01/04/05/11 · Grundansicht, Verbindungshilfe am Auftrag, zwei Vorschläge.
//   S8  UI-MIN-06/14 · Eingeklappt: laufende Word-Aktionen ALLER Fenster einzeln sichtbar; eine offene
//       wird am Kanal wirklich zurückgezogen; bei einer übergebenen geht der Stopp an das ausführende
//       Word-Fenster, der Knopf bleibt bis zu dessen Bestätigung erreichbar.
//   S9  UI-MIN-12 · Entwurf kontogebunden mit Ursprung über Schliessen/Neumontage; Zielwechsel fragt.
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
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { setzeAssistenzProfil } from "../../apps/web/src/components/klara-vorschau/profil";
import i18n from "../../apps/web/src/i18n";
import { BRUECKEN_EREIGNIS } from "../../apps/web/src/lib/begleiterBruecke";
import { begleiterEntwurfZuruecksetzen } from "../../apps/web/src/lib/begleiterEntwurf";
import { Begleiter } from "../../apps/web/src/pages/Begleiter";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { APP_VERSION } from "../../apps/web/src/version";
import { BEGLEITER_AUFTRAEGE_MERKEN_MAX } from "../../services/app/src/klara-begleiter";
import { bis, klick, medienStub, q, ruhe, taste, tippe } from "../fe003-tutorial-fragen/huelle";
import {
  type Aufbau,
  type Draht,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();

const FENSTER = `bgl-${"e".repeat(32)}`;
const MARKIERUNG = "Fiktive Klausel 7: Die Lieferung erfolgt am dritten Werktag.";
const BASIS = "/api/me/klara/begleiter";
const DOKUMENT = {
  kennung: `url-${"4".repeat(32)}`,
  titel: "Vertrag Muster.docx",
  gespeichert: true,
};
const MIT_MARKIERUNG = { text: MARKIERUNG, laenge: MARKIERUNG.length, stand: 1 };

let draht: Draht;
let aufbau: Aufbau | null = null;
let leser: Konto | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let echterFetch: typeof globalThis.fetch;
let anApp: Array<Record<string, unknown>> = [];

const w = window as unknown as Record<string, unknown>;

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
  begleiterEntwurfZuruecksetzen();
  vergiss();
  setzeAssistenzProfil(null);
  medienStub();
  anApp = [];
  // Die native App, vertreten durch ihren Nachrichtenkanal und ihre selbst eingetragene Fassung.
  w.webkit = {
    messageHandlers: {
      klaraBegleiter: {
        postMessage: (n: Record<string, unknown>) => {
          anApp.push(n);
        },
      },
    },
  };
  w.__KLARA_BEGLEITER__ = { fassung: "0.1.0", bau: "pruefbau" };
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  globalThis.fetch = echterFetch;
  window.fetch = echterFetch;
  vergiss();
  Reflect.deleteProperty(w, "webkit");
  Reflect.deleteProperty(w, "__KLARA_BEGLEITER__");
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

async function vorrichtung(): Promise<void> {
  const a = await appAufbauen(false);
  aufbau = a;
  draht.setzeApp(a.app);
  leser = await neuesKonto(a.app, "begleiter", a.admin);
  draht.setzeCookie(`kw_session=${leser.token}`);
}

async function montiere(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
                  { initialEntries: ["/begleiter"] },
                  createElement(AppShell, null, createElement(Begleiter)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
  await bis(() => Boolean(q(document, "begleiter-figur")), 200);
}

/** Das Word-Fenster: derselbe Weg wie `begleiter.js`, mit der Anmeldung derselben Person. */
async function wordFenster(methode: "POST" | "PUT", url: string, rumpf: unknown) {
  if (!aufbau || !leser) {
    throw new Error("Vorrichtung fehlt");
  }
  return aufbau.app.inject({
    method: methode,
    url,
    headers: leser.kopf,
    payload: rumpf as Record<string, unknown>,
  });
}

function figur(): HTMLButtonElement {
  const f = q<HTMLButtonElement>(document, "begleiter-figur");
  if (!f) {
    throw new Error("Figur fehlt");
  }
  return f;
}

const nachrichten = (art: string) => anApp.filter((n) => n.art === art);

describe("J · Desktop-Schnellsuche im erhaltenen Begleiter", () => {
  it("öffnet dieselbe Wissenssuche, übergibt das echte Ziel und erhält den Gesprächsentwurf", async () => {
    await vorrichtung();
    if (!aufbau) throw new Error("App fehlt");
    const ko = await eintragMitOriginal(aufbau.app, aufbau.admin, { titel: "Jotumbau Suchbeleg" });
    await montiere();
    await befehlDerApp("gespraech-oeffnen");
    const entwurf = q<HTMLInputElement>(document, "begleiter-eingabe");
    if (!entwurf) throw new Error("Eingabe fehlt");
    await tippe(entwurf, "Mein ungesendeter Entwurf");
    await befehlDerApp("suche-oeffnen");
    await bis(() => Boolean(document.querySelector('[data-cmd="suchfeld"]')), 100);
    const feld = document.querySelector<HTMLInputElement>('[data-cmd="suchfeld"]');
    if (!feld) throw new Error("Suchfeld fehlt");
    await tippe(feld, "Jotumbau");
    const ziel = `/wissen/${ko.koId}`;
    await bis(() => Boolean(document.querySelector(`[data-cmd-pfad="${ziel}"]`)), 200);
    expect(document.querySelector('[data-cmd-pfad="/admin"]')).toBeNull();
    const treffer = document.querySelector<HTMLButtonElement>(`[data-cmd-pfad="${ziel}"]`);
    if (!treffer) throw new Error("Wissenstreffer fehlt");
    await klick(treffer);
    expect(nachrichten("suchziel")).toEqual([{ art: "suchziel", pfad: ziel }]);
    expect(q<HTMLInputElement>(document, "begleiter-eingabe")?.value).toBe(
      "Mein ungesendeter Entwurf",
    );
    expect(document.querySelector('[data-cmd="suchfeld"]')).toBeNull();
  });

  it("Escape schließt nur die Palette; Einklappen schließt sie, Wiederöffnen bleibt bewusst", async () => {
    await vorrichtung();
    await montiere();
    await befehlDerApp("suche-oeffnen");
    await bis(() => Boolean(document.querySelector('[data-cmd="suchfeld"]')), 100);
    expect(q(document, "begleiter-gespraech"), JSON.stringify(nachrichten("modus"))).not.toBeNull();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    await ruhe();
    expect(document.querySelector('[data-cmd="suchfeld"]')).toBeNull();
    expect(q(document, "begleiter-gespraech")).not.toBeNull();
    await befehlDerApp("suche-oeffnen");
    await befehlDerApp("gespraech-schliessen");
    expect(document.querySelector('[data-cmd="suchfeld"]')).toBeNull();
    expect(q(document, "begleiter-gespraech")).toBeNull();
    await befehlDerApp("suche-oeffnen");
    expect(document.querySelector('[data-cmd="suchfeld"]')).not.toBeNull();
  });
});

/** Ein Befehl der App an die Webfläche — derselbe Weg wie `befehl(_:wert:)` in Steuerung.swift. */
async function befehlDerApp(befehl: string, wert?: number): Promise<void> {
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent(BRUECKEN_EREIGNIS, {
        detail: wert === undefined ? { befehl } : { befehl, wert },
      }),
    );
  });
  await ruhe();
}

describe("S1 · KO-02-02/-03 — die Figur", () => {
  it("zeigt den Avatar und den tatsächlichen Zustand; meldet der App die Lage „figur“", async () => {
    await vorrichtung();
    await montiere();
    const f = figur();
    expect(f.querySelector("img")?.getAttribute("src")).toBe("/klara/klara-avatar-v1.png");
    expect(f.getAttribute("aria-label")).toContain("Deine Assistenz");
    expect(f.dataset.zustand).toBe("ruhe");
    expect(q(document, "begleiter-figur-ohne-word")).not.toBeNull();
    expect(q(document, "begleiter-gespraech")).toBeNull();
    expect(nachrichten("bereit")).toEqual([{ art: "bereit", webFassung: APP_VERSION }]);
    expect(nachrichten("modus").at(-1)).toEqual({ art: "modus", modus: "figur" });
    expect(nachrichten("griff").length).toBeGreaterThan(0);
    // UI-MIN-15 (Nacharbeit 46): die Titelleiste der App trägt ohne Profil die neutrale Bezeichnung.
    expect(nachrichten("name").at(-1)).toEqual({ art: "name", name: "Deine Assistenz" });
  });

  it("UI-MIN-15 · der gewählte Name geht an die Titelleiste der App, ohne Profil wieder neutral", async () => {
    await vorrichtung();
    setzeAssistenzProfil({ name: "Mira", avatarUrl: null });
    await montiere();
    expect(nachrichten("name").at(-1)).toEqual({ art: "name", name: "Mira" });
    expect(anApp.some((n) => n.art === "name" && n.name === "Klara")).toBe(false);
    await act(async () => {
      setzeAssistenzProfil(null);
    });
    await ruhe();
    expect(nachrichten("name").at(-1)).toEqual({ art: "name", name: "Deine Assistenz" });
  });

  it("Pfeiltasten bewegen die Figur über die App; Umschalt nimmt den grossen Schritt", async () => {
    await vorrichtung();
    await montiere();
    await taste(figur(), "ArrowLeft");
    await act(async () => {
      figur().dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true, bubbles: true }),
      );
    });
    expect(nachrichten("bewegen")).toEqual([
      { art: "bewegen", dx: -12, dy: 0 },
      { art: "bewegen", dx: 0, dy: 60 },
    ]);
  });
});

describe("S2 · KO-02-03 — Gespräch öffnen und schliessen", () => {
  it("Klick öffnet, Escape schliesst, der Befehl der App öffnet wieder", async () => {
    await vorrichtung();
    await montiere();
    await klick(figur());
    await bis(() => Boolean(q(document, "begleiter-gespraech")));
    expect(nachrichten("modus").at(-1)).toEqual({ art: "modus", modus: "gespraech" });
    expect(figur().getAttribute("aria-expanded")).toBe("true");

    await taste(q(document, "begleiter-gespraech") as HTMLElement, "Escape");
    expect(q(document, "begleiter-gespraech")).toBeNull();
    expect(nachrichten("modus").at(-1)).toEqual({ art: "modus", modus: "figur" });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(BRUECKEN_EREIGNIS, { detail: { befehl: "gespraech-oeffnen" } }),
      );
    });
    await bis(() => Boolean(q(document, "begleiter-gespraech")));
    await klick(q(document, "begleiter-schliessen"));
    expect(q(document, "begleiter-gespraech")).toBeNull();
  });
});

describe("S3 · KO-02-05 — der Word-Kontext kommt ausschliesslich vom Adapter", () => {
  it("ohne Fenster: ehrlicher Hinweis; mit Fenster: Host, Fassung, Datei und Markierung", async () => {
    await vorrichtung();
    await montiere();
    await klick(figur());
    await bis(() => Boolean(q(document, "begleiter-kontext-leer")), 120);
    expect(q(document, "begleiter-kontext-leer")?.textContent).toContain(
      "Mit Begleitapp verbinden",
    );

    const angemeldet = await wordFenster("POST", `${BASIS}/adapter`, {
      instanz: FENSTER,
      host: "word-mac",
      hostFassung: "16.89",
      dokument: DOKUMENT,
    });
    expect(angemeldet.statusCode, angemeldet.body).toBe(201);
    const gemeldet = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 1,
      auswahl: MIT_MARKIERUNG,
    });
    expect(gemeldet.statusCode, gemeldet.body).toBe(200);

    await bis(() => q(document, "begleiter-auswahl-text")?.textContent === MARKIERUNG, 160);
    expect(q(document, "begleiter-auswahl-text")?.textContent).toBe(MARKIERUNG);
    const fenster = q(document, "begleiter-fenster");
    expect(fenster?.dataset.aktiv).toBe("ja");
    expect(fenster?.dataset.gebunden).toBe("ja");
    expect(fenster?.textContent).toContain("Vertrag Muster.docx");
    expect(fenster?.textContent).toContain("Word für Mac");
    expect(fenster?.textContent).toContain("Fassung 16.89");
    expect(q(document, "begleiter-figur-ohne-word")).toBeNull();

    // Nacharbeit 5 (UI-MIN-03/04): EIN Einstieg. Eine Frage zur Markierung aus dem gemeinsamen
    // Eingabefeld geht an DIESES Word-Fenster — nicht an den allgemeinen Frageweg; ein zweites
    // Fragefeld gibt es nicht mehr.
    expect(q(document, "begleiter-word-frage")).toBeNull();
    const feld = q<HTMLInputElement>(document, "begleiter-eingabe") as HTMLInputElement;
    await tippe(feld, "Wann gilt die Markierung?");
    await klick(q(document, "begleiter-senden"));
    await bis(() => q(document, "begleiter-aktionen") !== null, 80);
    expect(feld.value).toBe("");
    const holen = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 2,
      auswahl: MIT_MARKIERUNG,
    });
    type Auftrag = { id: string; art: string; text: string; auswahlStand: number };
    const auftraege = (holen.json() as { aktionen: Auftrag[] }).aktionen;
    expect(auftraege.map((a) => [a.art, a.text, a.auswahlStand])).toEqual([
      ["frage", "Wann gilt die Markierung?", 1],
    ]);
    expect(draht.aufrufe.some((a) => a.url === "/api/ask")).toBe(false);

    // Das Word-Fenster meldet seine Antwort; die Fläche zeigt sie als „Antwort aus Word".
    await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 3,
      auswahl: MIT_MARKIERUNG,
      erledigt: [{ id: auftraege[0]?.id, stand: "erledigt", ergebnis: "Am dritten Werktag." }],
    });
    const aktionen = (): string => q(document, "begleiter-aktionen")?.textContent ?? "";
    await bis(() => aktionen().includes("Werktag."), 160);
    expect(aktionen()).toContain("Antwort aus Word");
    expect(aktionen()).toContain("Am dritten Werktag.");
  });
});

describe("S4 · KO-02-01 — Fassungen sichtbar", () => {
  it("nennt die Fassung der Webfläche und die der App, wie die App sie einträgt", async () => {
    await vorrichtung();
    await montiere();
    await klick(figur());
    // produkt:20261011:assistenz-minimalistische-oberflaeche: die Fassungen stehen unter
    // Menü → Einstellungen → Verbindungen statt dauerhaft in der Grundansicht.
    await bis(() => Boolean(q(document, "begleiter-menue-knopf")));
    await klick(q(document, "begleiter-menue-knopf"));
    await klick(q(document, "klara-menue-einstellungen"));
    await bis(() => Boolean(q(document, "begleiter-version")));
    expect(q(document, "begleiter-version")?.textContent).toBe(
      `Webfläche ${APP_VERSION} · Begleitapp 0.1.0 (pruefbau)`,
    );
  });
});

// ================================================================================================
// produkt:20261011:assistenz-minimalistische-oberflaeche — die Grundansicht der Begleitapp.
// ================================================================================================

/** Sichtbar heisst: in keinem geschlossenen `<details>` (ausser in dessen Kopf). */
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

function sichtbareBedienelemente(wurzel: Element): string[] {
  return Array.from(
    wurzel.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], summary"),
  )
    .filter(sichtbarImBaum)
    .map((el) => el.dataset.testid ?? el.tagName.toLowerCase());
}

async function gespraechOffen(): Promise<HTMLElement> {
  await klick(figur());
  await bis(() => Boolean(q(document, "begleiter-gespraech")));
  await bis(() => {
    const laden = q(document, "klara-echt-hinweis")?.dataset.laden;
    return laden === "bereit" || laden === "fehler";
  }, 160);
  return q(document, "begleiter-gespraech") as HTMLElement;
}

describe("S5 · UI-MIN-01/11 — Gespräch der Begleitapp: vier Bereiche, Rest im Menü", () => {
  it("Kopf, Kontextzeile, Gespräch, Eingabe; Fenster, Sprache, Figur, Fassung und Rechtsfuss nicht dauerhaft", async () => {
    await vorrichtung();
    await montiere();
    const g = await gespraechOffen();
    expect(g.dataset.oberflaeche).toBe("minimal");
    expect(q<HTMLDetailsElement>(g, "begleiter-kontext")?.open).toBe(false);
    expect(q(g, "begleiter-kontext-zeile")?.textContent).toContain("kein Word-Fenster verbunden");
    expect(q(g, "klara-echt-leer")?.textContent).toBe("Wie kann ich helfen?");
    for (const id of [
      "begleiter-version",
      "begleiter-reduziert",
      "klara-sprachausgabe",
      "klara-diktieren",
      "klara-auftrag-sprechen",
      "begleiter-einwilligung",
      "begleiter-word-hilfe",
      "begleiter-auswahl",
      "begleiter-vorgaenge",
    ]) {
      expect(q(document, id), id).toBeNull();
    }
    await bis(() => Boolean(q(g, "begleiter-kontext-leer")), 120);
    expect(sichtbarImBaum(q(g, "begleiter-kontext-leer") as Element)).toBe(false);
    expect(sichtbareBedienelemente(g)).toEqual([
      "begleiter-figur",
      "begleiter-menue-knopf",
      "begleiter-schliessen",
      "begleiter-kontext-zeile",
      "begleiter-eingabe",
      "begleiter-senden",
    ]);
    // Das Menü trägt genau fünf Einträge.
    await klick(q(document, "begleiter-menue-knopf"));
    const eintraege = Array.from(q(document, "klara-menue")?.querySelectorAll("button") ?? []);
    expect(eintraege.map((b) => b.textContent)).toEqual([
      "Neues Gespräch",
      "Verlauf",
      "Meine Funktionen",
      "Einstellungen",
      "Hilfe",
    ]);
  });
});

describe("S6 · UI-MIN-04 — Word-Verbindungshilfe genau beim dokumentabhängigen Auftrag", () => {
  it("freie Frage ohne Hilfe; Frage zur Markierung ohne Word: Hilfe, kein Versand; nach echter Anmeldung ändert sich der Stand", async () => {
    await vorrichtung();
    await montiere();
    await gespraechOffen();
    const eingabe = q<HTMLInputElement>(document, "begleiter-eingabe") as HTMLInputElement;

    // Freie Frage: keine Word-Hilfe, sondern (beim ersten Senden) die Einwilligung.
    await tippe(eingabe, "Wie wird die Anlage gesichert?");
    await klick(q(document, "begleiter-senden"));
    expect(q(document, "begleiter-word-hilfe")).toBeNull();
    expect(q(document, "begleiter-einwilligung")).not.toBeNull();
    await klick(q(document, "begleiter-einwilligung-abbrechen"));

    // Dokumentabhängig ohne Word: die gezielte Hilfe, kein Aufruf des Fragewegs, Text bleibt.
    await tippe(eingabe, "Erkläre die Markierung");
    await klick(q(document, "begleiter-senden"));
    const hilfe = q(document, "begleiter-word-hilfe");
    expect(hilfe?.textContent).toContain("Für die Markierung benötige ich die Word-Verbindung.");
    expect(hilfe?.dataset.verbunden).toBe("nein");
    expect(draht.aufrufe.some((a) => a.url === "/api/ask")).toBe(false);
    expect(eingabe.value).toBe("Erkläre die Markierung");

    // Nacharbeit 5: auch ein ZWEITES Senden umgeht die Hilfe nicht — sie bleibt wirksam, bis Word
    // verbunden ist oder ausdrücklich „Ohne Dokument fragen“ gewählt wird.
    await klick(q(document, "begleiter-word-hilfe-abbrechen"));
    expect(q(document, "begleiter-word-hilfe")).toBeNull();
    await klick(q(document, "begleiter-senden"));
    expect(q(document, "begleiter-word-hilfe")).not.toBeNull();
    await klick(q(document, "begleiter-senden"));
    expect(q(document, "begleiter-word-hilfe")).not.toBeNull();
    expect(q(document, "begleiter-einwilligung")).toBeNull();
    expect(draht.aufrufe.some((a) => a.url === "/api/ask")).toBe(false);
    expect(eingabe.value).toBe("Erkläre die Markierung");

    // Erst ein tatsächlich angemeldetes Word-Fenster ändert den Stand der Hilfe.
    const angemeldet = await wordFenster("POST", `${BASIS}/adapter`, {
      instanz: FENSTER,
      host: "word-mac",
      hostFassung: "16.89",
      dokument: DOKUMENT,
    });
    expect(angemeldet.statusCode, angemeldet.body).toBe(201);
    await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, { seq: 1, auswahl: null });
    await bis(() => q(document, "begleiter-word-hilfe")?.dataset.verbunden === "ja", 160);
    expect(q(document, "begleiter-word-hilfe-verbunden")?.textContent).toContain(
      "Vertrag Muster.docx",
    );
    expect(q(document, "begleiter-kontext-zeile")?.textContent).toContain("Vertrag Muster.docx");

    // Nach der Verbindung: ausdrücklich an DIESES Word-Fenster senden — über den Hostweg.
    await klick(q(document, "begleiter-word-hilfe-senden"));
    await bis(() => eingabe.value === "", 80);
    const holen = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 2,
      auswahl: null,
    });
    const auftraege = (holen.json() as { aktionen: Array<{ art: string; text: string }> }).aktionen;
    expect(auftraege.map((a) => [a.art, a.text])).toEqual([["frage", "Erkläre die Markierung"]]);
    expect(q(document, "begleiter-word-hilfe")).toBeNull();
    expect(draht.aufrufe.some((a) => a.url === "/api/ask")).toBe(false);
  });
});

describe("S7 · UI-MIN-05/11 — Markierung aus Word: höchstens zwei Vorschläge, über DIESES Fenster", () => {
  it("„Erklären“ geht als Frage an das gebundene Word-Fenster, nicht an den allgemeinen Frageweg", async () => {
    await vorrichtung();
    await montiere();
    await gespraechOffen();
    await wordFenster("POST", `${BASIS}/adapter`, {
      instanz: FENSTER,
      host: "word-mac",
      hostFassung: "16.89",
      dokument: DOKUMENT,
    });
    await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, { seq: 1, auswahl: MIT_MARKIERUNG });
    await bis(() => Boolean(q(document, "begleiter-auswahl")), 160);
    const auswahl = q(document, "begleiter-auswahl") as HTMLElement;
    const vorschlaege = sichtbareBedienelemente(auswahl).filter((id) =>
      id.startsWith("begleiter-vorschlag-"),
    );
    expect(vorschlaege).toEqual([
      "begleiter-vorschlag-erklaeren",
      "begleiter-vorschlag-verbessern",
    ]);
    // Nacharbeit 5: kein zweites Fragefeld mehr — eigene Fragen gehen über die gemeinsame Eingabe.
    expect(q(document, "begleiter-word-frage")).toBeNull();
    expect(q(document, "begleiter-kontext-zeile")?.textContent).toContain("Markierung");

    await klick(q(document, "begleiter-vorschlag-erklaeren"));
    const holen = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 2,
      auswahl: MIT_MARKIERUNG,
    });
    const auftraege = (holen.json() as { aktionen: Array<{ art: string; text: string }> }).aktionen;
    expect(auftraege.map((a) => [a.art, a.text])).toEqual([
      ["frage", "Erkläre die markierte Stelle."],
    ]);
    expect(draht.aufrufe.some((a) => a.url === "/api/ask")).toBe(false);
  });
});

// ================================================================================================
// Nacharbeit 5 — eingeklappte Vorgänge, echter Abbruch, Entwurf mit Ursprung.
// ================================================================================================

const FENSTER_ZWEI = `bgl-${"f".repeat(32)}`;
const DOKUMENT_ZWEI = {
  kennung: `url-${"5".repeat(32)}`,
  titel: "Angebot Muster.docx",
  gespeichert: true,
};

async function fensterMitMarkierung(instanz: string, dokument: typeof DOKUMENT): Promise<void> {
  const an = await wordFenster("POST", `${BASIS}/adapter`, {
    instanz,
    host: "word-mac",
    hostFassung: "16.89",
    dokument,
  });
  expect(an.statusCode, an.body).toBe(201);
  const m = await wordFenster("PUT", `${BASIS}/adapter/${instanz}`, {
    seq: 1,
    auswahl: MIT_MARKIERUNG,
  });
  expect(m.statusCode, m.body).toBe(200);
}

async function auftragAn(instanz: string, text: string): Promise<string> {
  const r = await wordFenster("POST", `${BASIS}/adapter/${instanz}/aktionen`, {
    art: "frage",
    text,
    auswahlStand: 1,
  });
  expect(r.statusCode, r.body).toBe(202);
  return (r.json() as { aktion: { id: string } }).aktion.id;
}

const vorgangZeile = (aktionId: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-testid="klara-vorgang"][data-art="word-${aktionId}"]`);

describe("S8 · UI-MIN-06/14 — eingeklappt bleibt jede laufende Word-Aktion sichtbar und stoppbar", () => {
  it("zwei Fenster: beide einzeln an der Figur; offen wird zurückgezogen, übergeben bis Word abgebrochen", async () => {
    await vorrichtung();
    await fensterMitMarkierung(FENSTER, DOKUMENT);
    await fensterMitMarkierung(FENSTER_ZWEI, DOKUMENT_ZWEI);
    const idEins = await auftragAn(FENSTER, "Synthetische Frage eins");
    const idZwei = await auftragAn(FENSTER_ZWEI, "Synthetische Frage zwei");
    await montiere();

    // Eingeklappt (kein Gespräch offen): beide Vorgänge an der Figur, die App vergrössert das Fenster.
    await bis(() => Boolean(vorgangZeile(idEins) && vorgangZeile(idZwei)), 160);
    expect(q(document, "begleiter-gespraech")).toBeNull();
    expect(q(document, "begleiter-figur-vorgaenge")).not.toBeNull();
    expect(vorgangZeile(idEins)?.textContent).toContain("Vertrag Muster.docx");
    expect(vorgangZeile(idZwei)?.textContent).toContain("Angebot Muster.docx");
    expect(nachrichten("modus").at(-1)).toEqual({ art: "modus", modus: "figur-vorgang" });
    // Nacharbeit 47: die App fragt beim Schließen nach — die Antwort nennt beide Vorgänge und trägt
    // die Anfragenummer; die App blendet deshalb nicht aus.
    await befehlDerApp("vorgaenge-melden", 41);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 2, anfrage: 41 });

    // Fenster zwei holt seinen Auftrag ab: Word führt aus — der Stopp bleibt erreichbar (Nacharbeit 7).
    const abgeholt = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER_ZWEI}`, {
      seq: 2,
      auswahl: MIT_MARKIERUNG,
    });
    expect((abgeholt.json() as { aktionen: unknown[] }).aktionen).toHaveLength(1);
    await bis(() => (vorgangZeile(idZwei)?.textContent ?? "").includes("Word führt aus"), 160);
    expect(vorgangZeile(idZwei)?.textContent).toContain("„Rückgängig“");
    const stoppZwei = (): Element | null | undefined =>
      vorgangZeile(idZwei)?.querySelector('[data-testid="begleiter-word-stopp"]');
    expect(stoppZwei()?.textContent).toBe("Stoppen");

    // Stopp an der eingeklappten Figur: angefordert (202), an Word weitergereicht, Knopf bleibt.
    await klick(stoppZwei());
    expect(
      draht.aufrufe.some(
        (a) =>
          a.methode === "POST" &&
          a.url === `/api/me/klara/begleiter/adapter/${FENSTER_ZWEI}/aktionen/${idZwei}/stopp` &&
          a.status === 202,
      ),
    ).toBe(true);
    await bis(() => (vorgangZeile(idZwei)?.textContent ?? "").includes("Stopp angefordert"), 160);
    expect(stoppZwei()).not.toBeNull();
    // „Stopp angefordert“ ist noch kein Ende: die Webfläche meldet den Vorgang weiter als laufend.
    await befehlDerApp("vorgaenge-melden", 42);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 2, anfrage: 42 });
    const weitergereicht = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER_ZWEI}`, {
      seq: 3,
      auswahl: MIT_MARKIERUNG,
    });
    expect((weitergereicht.json() as { abbrechen?: string[] }).abbrechen).toEqual([idZwei]);

    // Fenster eins: Zurückziehen an der eingeklappten Figur wirkt am Kanal — Word erhält nichts.
    const stopp = vorgangZeile(idEins)?.querySelector('[data-testid="begleiter-word-stopp"]');
    await klick(stopp);
    expect(
      draht.aufrufe.some(
        (a) =>
          a.methode === "POST" &&
          a.url === `/api/me/klara/begleiter/adapter/${FENSTER}/aktionen/${idEins}/stopp` &&
          a.status === 200,
      ),
    ).toBe(true);
    const holenEins = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 2,
      auswahl: MIT_MARKIERUNG,
    });
    expect((holenEins.json() as { aktionen: unknown[] }).aktionen).toEqual([]);
    await bis(() => vorgangZeile(idEins) === null, 160);
    expect(vorgangZeile(idEins)).toBeNull();
    expect(vorgangZeile(idZwei)).not.toBeNull();

    // Word bestätigt den Abbruch: Ende — kein Vorgang mehr, die Figur wird wieder klein.
    await wordFenster("PUT", `${BASIS}/adapter/${FENSTER_ZWEI}`, {
      seq: 4,
      auswahl: MIT_MARKIERUNG,
      erledigt: [{ id: idZwei, stand: "gestoppt", grund: "abgebrochen" }],
    });
    await bis(() => q(document, "begleiter-figur-vorgaenge") === null, 160);
    expect(nachrichten("modus").at(-1)).toEqual({ art: "modus", modus: "figur" });
    // Erst JETZT meldet die Webfläche von sich aus „0“ — die Bestätigung, auf die die App wartet.
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 0 });
    await befehlDerApp("vorgaenge-melden", 43);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 0, anfrage: 43 });
  });

  it("auch bei geöffnetem Gespräch und Menü steht der Vorgang mit Stopp da", async () => {
    await vorrichtung();
    await fensterMitMarkierung(FENSTER, DOKUMENT);
    const id = await auftragAn(FENSTER, "Synthetische Frage");
    await montiere();
    await gespraechOffen();
    await klick(q(document, "begleiter-menue-knopf"));
    await bis(() => Boolean(vorgangZeile(id)), 160);
    expect(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]')).not.toBeNull();
  });
});

// Nacharbeit 54 (Ben, MAC5-01): ein gescheiterter Kontextabruf ist kein Ende der Word-Aktion.
describe("S10 · UI-MIN-06/14 — Abruffehler: laufende Aktion bleibt sichtbar, stoppbar, keine 0", () => {
  it("unbestätigt statt verschwunden; die App bekommt keine 0; Stopp wirkt; danach wieder bestätigt", async () => {
    await vorrichtung();
    await fensterMitMarkierung(FENSTER, DOKUMENT);
    const id = await auftragAn(FENSTER, "Synthetische Frage, läuft weiter");
    await montiere();
    await bis(() => Boolean(vorgangZeile(id)), 160);
    const kontextUrl = `${BASIS}/kontext`;
    const unbestaetigt = (): boolean =>
      (vorgangZeile(id)?.textContent ?? "").includes("lief zuletzt noch");

    // Der nächste Abruf scheitert (Server kurz weg): die Zeile bleibt, als unbestätigt, mit Stopp.
    draht.stoerungEinmal(kontextUrl, 503);
    await bis(unbestaetigt, 200);
    expect(unbestaetigt()).toBe(true);
    expect(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]')).not.toBeNull();
    // Die App fragt beim Schließen nach: unbekannter Stand ist KEINE bestätigte 0.
    await befehlDerApp("vorgaenge-melden", 51);
    const antwort = nachrichten("vorgaenge").at(-1);
    expect(antwort?.anfrage).toBe(51);
    expect(antwort?.anzahl).toBe(1);

    // Der nächste Abruf gelingt: wieder bestätigt, dieselbe Aktion, derselbe Stopp.
    await bis(() => Boolean(vorgangZeile(id)) && !unbestaetigt(), 200);
    expect(vorgangZeile(id)).not.toBeNull();
    expect(unbestaetigt()).toBe(false);

    // Noch einmal gestört — und JETZT gestoppt: der Stopp geht über den Kanal, nicht über den Abruf.
    draht.stoerungEinmal(kontextUrl, 503);
    await bis(unbestaetigt, 200);
    await klick(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]'));
    expect(
      draht.aufrufe.some(
        (a) =>
          a.methode === "POST" &&
          a.url === `${BASIS}/adapter/${FENSTER}/aktionen/${id}/stopp` &&
          a.status === 200,
      ),
    ).toBe(true);
    // Erst ein gelungener Abruf bestätigt das Ende — dann (und erst dann) meldet die Fläche 0.
    await bis(() => vorgangZeile(id) === null, 200);
    expect(vorgangZeile(id)).toBeNull();
    await befehlDerApp("vorgaenge-melden", 52);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 0, anfrage: 52 });
  });
});

// Nacharbeit 54 (Ben, MAC5-04): „Einstellungen …“ (⌘,) der App führt in den vorhandenen Bereich.
describe("S11 · MAC-04/UI-05 — der Einstellungsbefehl der App öffnet den vorhandenen Bereich", () => {
  it("auch eingeklappt: Gespräch auf, Unterseite Einstellungen, Entwurf und laufender Stopp bleiben", async () => {
    await vorrichtung();
    await fensterMitMarkierung(FENSTER, DOKUMENT);
    const id = await auftragAn(FENSTER, "Synthetische Frage während der Einstellungen");
    await montiere();
    await klick(figur());
    await bis(() => Boolean(q(document, "begleiter-gespraech")));
    const feld = q<HTMLInputElement>(document, "begleiter-eingabe") as HTMLInputElement;
    await tippe(feld, "Synthetischer Entwurf vor den Einstellungen");
    await taste(q(document, "begleiter-gespraech") as HTMLElement, "Escape");
    expect(q(document, "begleiter-gespraech")).toBeNull();

    await befehlDerApp("gespraech-oeffnen");
    await befehlDerApp("einstellungen-oeffnen");
    await bis(() => q(document, "begleiter-gespraech")?.dataset.seite === "einstellungen");
    expect(q(document, "begleiter-gespraech")?.dataset.seite).toBe("einstellungen");
    expect(q(document, "begleiter-verbindungen")).not.toBeNull();
    // Nacharbeit 56 (MAC5-04-REST): der zentrale Klara-Bereich ist von hier erreichbar — über den
    // vorhandenen Direktweg, in einem eigenen Fenster (der Begleiter mit Entwurf und Stopps bleibt).
    const zentral = q<HTMLAnchorElement>(document, "begleiter-einstellungen-zentral-link");
    expect(zentral?.getAttribute("href")).toBe("/profil?bereich=klara");
    expect(zentral?.getAttribute("target")).toBe("_blank");
    expect(zentral?.getAttribute("rel")).toContain("noopener");
    // Die laufende Word-Aktion bleibt mit ihrem Stopp über der Unterseite stehen.
    await bis(() => Boolean(vorgangZeile(id)), 160);
    expect(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]')).not.toBeNull();
    // Zurück ins Gespräch: der Entwurf ist unverändert.
    await klick(q(document, "klara-unterseite-zurueck"));
    await bis(() => Boolean(q(document, "begleiter-eingabe")));
    expect(q<HTMLInputElement>(document, "begleiter-eingabe")?.value).toBe(
      "Synthetischer Entwurf vor den Einstellungen",
    );
  });
});

/**
 * Nacharbeit 57 (Ben): die Antwortreihenfolge gezielt steuern — über dem Draht, nur in diesem Fall
 * (`afterEach` setzt `fetch` zurück).
 *   · `halte()`: jeder Kontextabruf wird zurückgehalten. Seine Antwort entsteht beim START des
 *     Abrufs (Serverstand von damals) und kommt erst bei Freigabe an — so lässt sich eine überholte
 *     leere Antwort NACH der Beauftragung zustellen.
 *   · `verliereAntwortEinmal(url)`: der nächste POST erreicht den Server (er nimmt an), die Antwort
 *     geht aber auf dem Rückweg verloren — wie ein Verbindungsabriss nach dem Senden.
 *   · Nacharbeit 58: `brichVorAnnahmeAb(url)`: der nächste POST wird VOR dem Server festgehalten
 *     (wie ein Auftrag, der noch in der Anmeldeprüfung wartet), die Begleitapp erhält sofort einen
 *     Transportfehler; `postFortsetzen()` lässt ihn danach am Server ankommen (Antwort an niemanden).
 *   · Nacharbeit 58: `halteKlaerung()`: Klärungen (`…/auftraege/:schluessel/klaeren`) erreichen den
 *     Server erst mit `klaerungFreigeben()` — so ist die Ungewissheit dazwischen beobachtbar.
 * Jeder Aufruf trägt eine laufende Nummer (`nr`, beim START vergeben).
 */
function lenkung() {
  const unten = globalThis.fetch;
  const kontextUrl = `${BASIS}/kontext`;
  const KLAEREN = /\/auftraege\/[^/]+\/klaeren$/;
  let halten = false;
  let klaerungHalten = false;
  let postVerlieren: string | null = null;
  let postFesthalten: string | null = null;
  let festgehalten: (() => Promise<{ status: number; rumpf: string }>) | null = null;
  let umschreiben: ((k: Record<string, unknown>) => Record<string, unknown>) | null = null;
  // Nacharbeit 65: eine POST-Antwort erreicht den Server, kommt aber erst später an.
  let antwortHalten: string | null = null;
  let gehalteneAntwort: { rumpf: string; freigeben: () => void } | null = null;
  let zaehler = 0;
  const gehalten: Array<{ nr: number; rumpf: string; freigeben: () => void }> = [];
  const klaerungen: Array<() => Promise<void>> = [];
  const verloren: Array<{ status: number; rumpf: string }> = [];
  const lenk = (async (eingabe: Parameters<typeof fetch>[0], init?: RequestInit) => {
    zaehler += 1;
    const nr = zaehler;
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (methode === "POST" && KLAEREN.test(url) && klaerungHalten) {
      return new Promise<Response>((fertig, fehl) => {
        klaerungen.push(async () => {
          try {
            fertig(await unten(eingabe, init));
          } catch (f) {
            fehl(f);
          }
        });
      });
    }
    if (methode === "POST" && url === antwortHalten) {
      antwortHalten = null;
      const antwort = await unten(eingabe, init);
      const rumpf = await antwort.text();
      return new Promise<Response>((fertig) => {
        gehalteneAntwort = {
          rumpf,
          freigeben: () =>
            fertig({
              status: antwort.status,
              statusText: String(antwort.status),
              ok: antwort.ok,
              text: async () => rumpf,
            } as unknown as Response),
        };
      });
    }
    if (methode === "POST" && url === postFesthalten) {
      postFesthalten = null;
      festgehalten = async () => {
        const antwort = await unten(eingabe, init);
        return { status: antwort.status, rumpf: await antwort.text() };
      };
      throw new TypeError("Load failed");
    }
    // Nacharbeit 64: Kontextantworten umschreiben — so sieht die Fläche eine neue Kanalinstanz
    // (Serverneustart) samt verlorenem bzw. neu gemeldetem Bestand.
    if (methode === "GET" && url === kontextUrl && umschreiben && !halten) {
      const antwort = await unten(eingabe, init);
      const rumpf = JSON.stringify(umschreiben(JSON.parse(await antwort.text())));
      return {
        status: antwort.status,
        statusText: String(antwort.status),
        ok: antwort.ok,
        text: async () => rumpf,
      } as unknown as Response;
    }
    if (methode === "GET" && url === kontextUrl && halten) {
      const antwort = await unten(eingabe, init);
      const rumpf = await antwort.text();
      return new Promise<Response>((fertig) => {
        gehalten.push({
          nr,
          rumpf,
          freigeben: () =>
            fertig({
              status: antwort.status,
              statusText: String(antwort.status),
              ok: antwort.ok,
              text: async () => rumpf,
            } as unknown as Response),
        });
      });
    }
    if (methode === "POST" && url === postVerlieren) {
      postVerlieren = null;
      const antwort = await unten(eingabe, init);
      verloren.push({ status: antwort.status, rumpf: await antwort.text() });
      throw new TypeError("Load failed");
    }
    return unten(eingabe, init);
  }) as typeof globalThis.fetch;
  globalThis.fetch = lenk;
  window.fetch = lenk;
  return {
    gehalten,
    verloren,
    halte: (): void => {
      halten = true;
    },
    verliereAntwortEinmal: (url: string): void => {
      postVerlieren = url;
    },
    brichVorAnnahmeAb: (url: string): void => {
      postFesthalten = url;
    },
    schreibeKontextUm: (f: ((k: Record<string, unknown>) => Record<string, unknown>) | null) => {
      umschreiben = f;
    },
    halteAntwortEinmal: (url: string): void => {
      antwortHalten = url;
    },
    gehalteneAntwort: (): string | null => gehalteneAntwort?.rumpf ?? null,
    antwortFreigeben: async (): Promise<void> => {
      const g = gehalteneAntwort;
      gehalteneAntwort = null;
      await act(async () => g?.freigeben());
      await ruhe();
    },
    /** Der festgehaltene POST erreicht jetzt den Server; seine Antwort erreicht niemanden. */
    postFortsetzen: async (): Promise<{ status: number; rumpf: string }> => {
      const weiter = festgehalten;
      if (!weiter) {
        throw new Error("kein festgehaltener POST");
      }
      festgehalten = null;
      let ergebnis = { status: 0, rumpf: "" };
      await act(async () => {
        ergebnis = await weiter();
      });
      await ruhe();
      return ergebnis;
    },
    halteKlaerung: (): void => {
      klaerungHalten = true;
    },
    klaerungen,
    klaerungFreigeben: async (): Promise<void> => {
      klaerungHalten = false;
      for (const k of klaerungen.splice(0)) {
        await act(async () => {
          await k();
        });
      }
      await ruhe();
    },
    nummer: (): number => zaehler,
    /** Gibt die zurückgehaltenen Antworten frei, auf die `wahl` zutrifft; liefert ihre Zahl. */
    freigeben: async (wahl: (g: { nr: number; rumpf: string }) => boolean): Promise<number> => {
      const frei = gehalten.filter((g) => wahl(g));
      for (const g of frei) {
        gehalten.splice(gehalten.indexOf(g), 1);
        await act(async () => g.freigeben());
      }
      await ruhe();
      return frei.length;
    },
    laufenLassen: async (): Promise<void> => {
      halten = false;
      for (const g of gehalten.splice(0)) {
        await act(async () => g.freigeben());
      }
      await ruhe();
    },
  };
}

/** Word-Fenster mit Markierung, NACHDEM die Fläche steht; danach ist der Kontext bestätigt leer. */
async function fensterNachMontage(): Promise<void> {
  await fensterMitMarkierung(FENSTER, DOKUMENT);
  await bis(() => Boolean(q(document, "begleiter-vorschlag-erklaeren")), 160);
}

/** Die Zeile einer angenommenen Aktion: Kennung im `data-art`, Stopp-Knopf darin. */
function wordZeile(): HTMLElement | null {
  const zeilen = document.querySelectorAll<HTMLElement>(
    '[data-testid="klara-vorgang"][data-art^="word-"]',
  );
  for (const z of Array.from(zeilen)) {
    if (z.querySelector('[data-testid="begleiter-word-stopp"]') !== null) {
      return z;
    }
  }
  return null;
}

const unklarZeile = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[data-testid="klara-vorgang"][data-art^="word-unklar-"]');

// Nacharbeit 56 (Ben, MAC5-01-REST): eine eben beauftragte Word-Aktion zählt SOFORT — nicht erst
// beim nächsten Kontextabruf. Nacharbeit 57: die Reihenfolge ist gesteuert — der Kontextabruf ist
// zurückgehalten, die Anzeige kann also nur aus der POST-Annahme stammen; danach kommt eine
// überholte LEERE Kontextantwort an und darf keinen Leerlauf herstellen.
describe("S12 · UI-MIN-06/14 — eigene Beauftragung sofort mit Stopp, keine 0 bis zum Endbeleg", () => {
  it("Kontext zurückgehalten: Vorgang aus der Annahme, überholte leere Antwort ohne 0, Ende erst frisch", async () => {
    await vorrichtung();
    await montiere();
    await gespraechOffen();
    await fensterNachMontage();
    // Bestätigt leer: noch keine Word-Aktion.
    await befehlDerApp("vorgaenge-melden", 60);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 0, anfrage: 60 });

    // Ab jetzt kommt keine Kontextantwort an; mindestens ein Abruf läuft schon VOR der Beauftragung.
    const l = lenkung();
    l.halte();
    await bis(() => l.gehalten.length >= 1, 120);
    expect(l.gehalten.length).toBeGreaterThanOrEqual(1);

    await klick(q(document, "begleiter-vorschlag-erklaeren"));
    await bis(() => Boolean(wordZeile()), 40);
    // Kein Kontextabruf wurde beantwortet: die Zeile stammt aus der POST-Annahme (Kennung + Stopp).
    expect(wordZeile()).not.toBeNull();
    const id = (wordZeile()?.dataset.art ?? "").replace(/^word-/, "");
    expect(id).not.toBe("");
    await befehlDerApp("vorgaenge-melden", 61);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 61 });

    // Die überholte Antwort: VOR der Beauftragung entstanden, also leer — sie kommt jetzt an.
    const ueberholt = await l.freigeben((g) => !g.rumpf.includes(id));
    expect(ueberholt).toBeGreaterThanOrEqual(1);
    expect(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]')).not.toBeNull();
    await befehlDerApp("vorgaenge-melden", 62);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 62 });

    // Stopp über den Kanal — die Zeile bleibt, bis ein danach gestarteter Abruf das Ende belegt.
    await klick(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]'));
    expect(
      draht.aufrufe.some(
        (a) =>
          a.methode === "POST" &&
          a.url === `${BASIS}/adapter/${FENSTER}/aktionen/${id}/stopp` &&
          a.status === 200,
      ),
    ).toBe(true);
    await befehlDerApp("vorgaenge-melden", 63);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 63 });

    await l.laufenLassen();
    await bis(() => vorgangZeile(id) === null, 200);
    expect(vorgangZeile(id)).toBeNull();
    await befehlDerApp("vorgaenge-melden", 64);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 0, anfrage: 64 });
  });
});

// Nacharbeit 57 (Ben): ein belegt ABGELEHNTER Auftrag ist kein Vorgang; ein Auftrag mit UNKLAREM
// Ausgang (Server hat angenommen, die Antwort ging verloren) zählt weiter. Nacharbeit 58: geklärt
// wird er über SEINEN Schlüssel (nicht über einen Kontextabruf) — dann mit Kennung und Stopp.
// Kein erneutes Senden.
describe("S13 · UI-MIN-06/07/14 — Ablehnung vs. verlorene POST-Antwort: keine falsche 0", () => {
  it("409 → nicht beauftragt, 0; Antwort verloren → „unklar“ ohne 0, Klärung → Kennung + Stopp, einmal gesendet", async () => {
    await vorrichtung();
    await montiere();
    await gespraechOffen();
    await fensterNachMontage();
    const aktionenUrl = `${BASIS}/adapter/${FENSTER}/aktionen`;
    const fehlerText = (): string => q(document, "begleiter-aktion-fehler")?.textContent ?? "";

    // 1) Belegte Ablehnung (gelesene 409-Antwort): kein Vorgang, die App darf 0 bekommen.
    draht.stoerungEinmal(aktionenUrl, 409);
    await klick(q(document, "begleiter-vorschlag-erklaeren"));
    await bis(() => fehlerText().includes("Nicht an Word gegeben"), 40);
    expect(fehlerText()).toContain("Nicht an Word gegeben");
    expect(document.querySelector('[data-testid="klara-vorgang"][data-art^="word-"]')).toBeNull();
    await befehlDerApp("vorgaenge-melden", 70);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 0, anfrage: 70 });

    // 2) Der Server nimmt an, die Antwort geht verloren; Kontextabruf und Klärung sind zurückgehalten.
    const l = lenkung();
    l.halte();
    l.halteKlaerung();
    await bis(() => l.gehalten.length >= 1, 120);
    expect(l.gehalten.length).toBeGreaterThanOrEqual(1);
    l.verliereAntwortEinmal(aktionenUrl);
    await klick(q(document, "begleiter-vorschlag-erklaeren"));
    await bis(() => Boolean(unklarZeile()), 40);
    expect(l.verloren).toHaveLength(1);
    expect(l.verloren[0]?.status).toBe(202);
    const id = (JSON.parse(l.verloren[0]?.rumpf ?? "{}") as { aktion: { id: string } }).aktion.id;
    // Sichtbar als unklar, NICHT als „nicht beauftragt“ — und die App bekommt keine 0.
    expect(unklarZeile()).not.toBeNull();
    expect(fehlerText()).toContain("Unklar, ob Word den Auftrag erhalten hat");
    expect(fehlerText()).not.toContain("Nicht an Word gegeben");
    await befehlDerApp("vorgaenge-melden", 71);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 71 });

    // Eine überholte leere Kontextantwort (vor dem Fehlschlag gestartet) klärt nichts.
    const ueberholt = await l.freigeben((g) => !g.rumpf.includes(id));
    expect(ueberholt).toBeGreaterThanOrEqual(1);
    expect(unklarZeile()).not.toBeNull();
    await befehlDerApp("vorgaenge-melden", 72);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 72 });

    // Die Klärung über den Schlüssel: „angenommen“ mit genau dieser Kennung — „unklar“ ist weg, die
    // Aktion steht mit Stopp da (der Kontextabruf ist dabei weiter zurückgehalten).
    await bis(() => l.klaerungen.length >= 1, 40);
    expect(l.klaerungen.length).toBeGreaterThanOrEqual(1);
    await l.klaerungFreigeben();
    await bis(() => Boolean(vorgangZeile(id)) && unklarZeile() === null, 40);
    expect(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]')).not.toBeNull();
    expect(unklarZeile()).toBeNull();
    await befehlDerApp("vorgaenge-melden", 73);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 73 });
    // Keine automatische erneute Beauftragung: genau EINE angenommene POST-Anfrage.
    expect(
      draht.aufrufe.filter(
        (a) => a.methode === "POST" && a.url === aktionenUrl && a.status === 202,
      ),
    ).toHaveLength(1);

    // Der Stopp wirkt; erst danach (frisch belegt) meldet die Fläche 0.
    await l.laufenLassen();
    await klick(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]'));
    await bis(() => vorgangZeile(id) === null, 200);
    expect(vorgangZeile(id)).toBeNull();
    await befehlDerApp("vorgaenge-melden", 74);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 0, anfrage: 74 });
  });
});

// Nacharbeit 58 (Ben, MACG57-POST-GET-01): der Transportfehler kommt, BEVOR der Server den Auftrag
// angelegt hat (der POST wartet noch, etwa in der Anmeldeprüfung). Ein danach gestarteter, LEERER
// Kontextabruf beweist nichts — die Ungewissheit bleibt, die App bekommt keine 0. Aufgelöst wird
// nur über den Auftragsschlüssel.
describe("S14 · UI-MIN-06/07/14, UI-04 — Fehler vor der Annahme: jüngerer leerer Abruf ist kein Ende", () => {
  const aktionenUrl = `${BASIS}/adapter/${FENSTER}/aktionen`;
  const angelegt = () =>
    draht.aufrufe.filter((a) => a.methode === "POST" && a.url === aktionenUrl && a.status === 202);

  it("POST kommt später doch an: weiter unklar ohne 0, Klärung ordnet genau diese Aktion mit Stopp zu", async () => {
    await vorrichtung();
    await montiere();
    await gespraechOffen();
    await fensterNachMontage();
    const l = lenkung();
    l.halte();
    l.halteKlaerung();
    await bis(() => l.gehalten.length >= 1, 120);
    l.brichVorAnnahmeAb(aktionenUrl);
    await klick(q(document, "begleiter-vorschlag-erklaeren"));
    await bis(() => Boolean(unklarZeile()), 40);
    expect(unklarZeile()).not.toBeNull();
    // Der Server hat (noch) nichts angelegt.
    expect(angelegt()).toHaveLength(0);

    // Ein NACH dem Fehlschlag gestarteter Kontextabruf, beantwortet mit dem LEEREN Stand.
    const nachFehler = l.nummer();
    await bis(() => l.gehalten.some((g) => g.nr > nachFehler), 120);
    expect(l.gehalten.some((g) => g.nr > nachFehler)).toBe(true);
    const leer = await l.freigeben(() => true);
    expect(leer).toBeGreaterThanOrEqual(1);
    // Weiterhin unklar, keine native 0.
    expect(unklarZeile()).not.toBeNull();
    await befehlDerApp("vorgaenge-melden", 80);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 80 });

    // Der ursprüngliche POST kommt jetzt am Server an und legt die Aktion an.
    const spaet = await l.postFortsetzen();
    expect(spaet.status).toBe(202);
    const id = (JSON.parse(spaet.rumpf) as { aktion: { id: string } }).aktion.id;
    expect(unklarZeile()).not.toBeNull();
    await befehlDerApp("vorgaenge-melden", 81);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 81 });

    // Die Klärung über den Schlüssel ordnet GENAU diese Aktion zu — mit Kennung und Stopp.
    await bis(() => l.klaerungen.length >= 1, 40);
    expect(l.klaerungen.length).toBeGreaterThanOrEqual(1);
    await l.klaerungFreigeben();
    await bis(() => Boolean(vorgangZeile(id)) && unklarZeile() === null, 40);
    expect(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]')).not.toBeNull();
    expect(unklarZeile()).toBeNull();
    await befehlDerApp("vorgaenge-melden", 82);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 82 });
    // Keine Doppelbeauftragung.
    expect(angelegt()).toHaveLength(1);

    await l.laufenLassen();
    await klick(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]'));
    await bis(() => vorgangZeile(id) === null, 200);
    expect(vorgangZeile(id)).toBeNull();
    await befehlDerApp("vorgaenge-melden", 83);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 0, anfrage: 83 });
    expect(angelegt()).toHaveLength(1);
  });

  it("Klärung kommt VOR dem POST an: „nicht angelegt“ endgültig, der späte POST legt nichts an", async () => {
    await vorrichtung();
    await montiere();
    await gespraechOffen();
    await fensterNachMontage();
    const fehlerText = (): string => q(document, "begleiter-aktion-fehler")?.textContent ?? "";
    const l = lenkung();
    l.halteKlaerung();
    l.brichVorAnnahmeAb(aktionenUrl);
    await klick(q(document, "begleiter-vorschlag-erklaeren"));
    await bis(() => Boolean(unklarZeile()), 40);
    await befehlDerApp("vorgaenge-melden", 90);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 90 });

    // Die Klärung erreicht den Server zuerst: der Schlüssel ist gesperrt.
    await bis(() => l.klaerungen.length >= 1, 40);
    expect(l.klaerungen.length).toBeGreaterThanOrEqual(1);
    await l.klaerungFreigeben();
    await bis(() => unklarZeile() === null, 40);
    expect(unklarZeile()).toBeNull();
    expect(fehlerText()).toContain("Geklärt: Der Auftrag ist nicht bei Word angekommen");
    // Nacharbeit 59 (Ben): weitere Klärungen bis zur Obergrenze verdrängen die Sperre NICHT — der
    // nächste Schlüssel wird abgewiesen statt sie zu verdrängen.
    // Nacharbeit 63/64: jede Klärung trägt Ausstellungszeitpunkt (hier: jetzt, Serveruhr) und die
    // Kanalinstanz dieses Servers (Bestandskontinuität).
    if (!aufbau || !leser) {
      throw new Error("Vorrichtung fehlt");
    }
    const gelesen = await aufbau.app.inject({
      method: "GET",
      url: `${BASIS}/kontext`,
      headers: leser.kopf,
    });
    const kanal = (gelesen.json() as { kanal: string }).kanal;
    expect(kanal).toMatch(/.+/);
    const frisch = () => ({ ausgestelltAm: new Date().toISOString(), kanal });
    for (let i = 1; i < BEGLEITER_AUFTRAEGE_MERKEN_MAX; i += 1) {
      const s = `w${i.toString().padStart(31, "0")}`;
      const r = await wordFenster("POST", `${BASIS}/auftraege/${s}/klaeren`, frisch());
      expect(r.statusCode, r.body).toBe(200);
    }
    const voll = await wordFenster(
      "POST",
      `${BASIS}/auftraege/${"x".repeat(32)}/klaeren`,
      frisch(),
    );
    expect(voll.statusCode, voll.body).toBe(409);
    // Der verspätete POST legt nichts mehr an.
    const spaet = await l.postFortsetzen();
    expect(spaet.status).toBe(409);
    expect(spaet.rumpf).toContain("geklaert_nicht_angelegt");
    expect(angelegt()).toHaveLength(0);
    await bis(() => wordZeile() === null, 80);
    expect(document.querySelector('[data-testid="klara-vorgang"][data-art^="word-"]')).toBeNull();
    await befehlDerApp("vorgaenge-melden", 91);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 0, anfrage: 91 });
  });
});

// Nacharbeit 64 (Ben): ein Serverneustart (neue Kanalinstanz, Bestand verloren) ist kein Ende — die
// vorher laufende Aktion bleibt mit Stopp und ohne native 0, bis ihr Fenster in der neuen Instanz
// seinen Bestand gemeldet hat.
describe("S15 · UI-MIN-06/07/14 — Serverneustart: Vorgang bleibt bis zur Bestandsmeldung", () => {
  it("neue Kanalinstanz ohne Bestand: „neu gestartet“ mit Stopp, keine 0; nach Bestandsmeldung 0", async () => {
    await vorrichtung();
    await fensterMitMarkierung(FENSTER, DOKUMENT);
    const id = await auftragAn(FENSTER, "Synthetische Frage vor dem Neustart");
    // Word holt sie ab: übergeben.
    const r = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 2,
      auswahl: null,
      auswahlStand: 1,
    });
    expect(r.statusCode, r.body).toBe(200);
    await montiere();
    await gespraechOffen();
    await bis(() => Boolean(vorgangZeile(id)), 160);
    await befehlDerApp("vorgaenge-melden", 100);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 100 });

    // „Neustart“: neue Kanalinstanz, der Bestand ist leer (das Fenster hat sich noch nicht gemeldet).
    const l = lenkung();
    l.schreibeKontextUm((k) => ({ ...k, kanal: "nach-neustart", adapter: [] }));
    const neustartText = (): string => vorgangZeile(id)?.textContent ?? "";
    await bis(() => neustartText().includes("neu gestartet"), 200);
    expect(neustartText()).toContain("Ende nicht bestätigt");
    expect(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]')).not.toBeNull();
    await befehlDerApp("vorgaenge-melden", 101);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 101 });

    // Das Fenster meldet sich in der neuen Instanz mit seinem Bestand — diese Aktion führt es nicht
    // (mehr) aus: erst jetzt ist belegt, dass dazu nichts läuft.
    l.schreibeKontextUm((k) => ({
      ...k,
      kanal: "nach-neustart",
      adapter: (k.adapter as Array<Record<string, unknown>>).map((a) => ({
        ...a,
        bestand: true,
        aktionen: [],
      })),
    }));
    await bis(() => vorgangZeile(id) === null, 200);
    expect(vorgangZeile(id)).toBeNull();
    await befehlDerApp("vorgaenge-melden", 102);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 0, anfrage: 102 });
  });
});

// Nacharbeit 65 (Ben): eine verspätete positive Antwort aus Kanal A, die erst ankommt, nachdem die
// Fläche schon Kanal B sieht, behält ihre Herkunft — ein leerer B-Abruf löst sie nicht auf.
describe("S16 · UI-MIN-06/14 — verspätete Annahme aus der alten Kanalinstanz", () => {
  it("Annahme aus A nach Wechsel zu B: bleibt mit Stopp, keine 0; erst die Bestandsmeldung in B löst sie", async () => {
    await vorrichtung();
    await montiere();
    await gespraechOffen();
    await fensterNachMontage();
    const aktionenUrl = `${BASIS}/adapter/${FENSTER}/aktionen`;
    const kontextAbrufe = () =>
      draht.aufrufe.filter((a) => a.methode === "GET" && a.url === `${BASIS}/kontext`).length;
    const l = lenkung();
    // Der Auftrag erreicht Kanal A und wird angenommen — die Antwort kommt aber erst später an.
    l.halteAntwortEinmal(aktionenUrl);
    await klick(q(document, "begleiter-vorschlag-erklaeren"));
    await bis(() => l.gehalteneAntwort() !== null, 40);
    const id = (JSON.parse(l.gehalteneAntwort() ?? "{}") as { aktion: { id: string } }).aktion.id;
    expect(id).toBeTruthy();

    // Inzwischen sieht die Fläche Kanal B (neue Instanz, ohne Bestand).
    l.schreibeKontextUm((k) => ({ ...k, kanal: "kanal-b", adapter: [] }));
    await bis(() => q(document, "begleiter-vorschlag-erklaeren") === null, 200);
    expect(q(document, "begleiter-vorschlag-erklaeren")).toBeNull();

    // Jetzt kommt die positive Antwort aus A an; danach folgen weitere leere B-Abrufe.
    await l.antwortFreigeben();
    const n = kontextAbrufe();
    await bis(() => kontextAbrufe() >= n + 2, 200);
    expect(kontextAbrufe()).toBeGreaterThanOrEqual(n + 2);
    expect(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]')).not.toBeNull();
    await befehlDerApp("vorgaenge-melden", 110);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 1, anfrage: 110 });

    // Erst die Bestandsmeldung des Fensters in B (ohne diese Aktion) belegt, dass nichts läuft.
    l.schreibeKontextUm((k) => ({
      ...k,
      kanal: "kanal-b",
      adapter: (k.adapter as Array<Record<string, unknown>>).map((a) => ({
        ...a,
        bestand: true,
        aktionen: [],
      })),
    }));
    await bis(() => vorgangZeile(id) === null, 200);
    expect(vorgangZeile(id)).toBeNull();
    await befehlDerApp("vorgaenge-melden", 111);
    expect(nachrichten("vorgaenge").at(-1)).toEqual({ art: "vorgaenge", anzahl: 0, anfrage: 111 });
  });
});

// Nacharbeit 66 (Ben): der Kanal startet nach der 202-Bestätigung eines Stopps neu, bevor Word den
// Abbruch erhalten hat — das Fenster meldet die Aktion ohne Abbruch neu an. Der Stoppwunsch der
// Fläche überdauert das und geht erneut hinaus, bis das Ende belegt ist.
describe("S17 · UI-MIN-14 — Stoppwunsch übersteht den Kanalverlust", () => {
  it("Stopp bestätigt, Kanal neu ohne Abbruch: Stopp erneut zugestellt; danach keine Wiederholung", async () => {
    await vorrichtung();
    await fensterMitMarkierung(FENSTER, DOKUMENT);
    const id = await auftragAn(FENSTER, "Synthetische Frage, gleich gestoppt");
    const r = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 2,
      auswahl: null,
      auswahlStand: 1,
    });
    expect(r.statusCode, r.body).toBe(200);
    await montiere();
    await gespraechOffen();
    await bis(() => Boolean(vorgangZeile(id)), 160);
    const stoppUrl = `${BASIS}/adapter/${FENSTER}/aktionen/${id}/stopp`;
    const stopps = () =>
      draht.aufrufe.filter((a) => a.methode === "POST" && a.url === stoppUrl).length;
    const kontextAbrufe = () =>
      draht.aufrufe.filter((a) => a.methode === "GET" && a.url === `${BASIS}/kontext`).length;

    // Stopp angefordert und vom Kanal bestätigt (202, Abbruch an Word angefordert).
    await klick(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]'));
    expect(draht.aufrufe.some((a) => a.url === stoppUrl && a.status === 202)).toBe(true);
    expect(stopps()).toBe(1);

    // „Neustart“: neue Kanalinstanz; das Fenster hat die Aktion neu gemeldet — OHNE Abbruch.
    const l = lenkung();
    const ohneAbbruch = (k: Record<string, unknown>) => ({
      ...k,
      kanal: "kanal-b",
      adapter: (k.adapter as Array<Record<string, unknown>>).map((a) => ({
        ...a,
        bestand: true,
        aktionen: (a.aktionen as Array<Record<string, unknown>>).map((x) => {
          const { abbruchAngefordert: _weg, ...rest } = x;
          return rest;
        }),
      })),
    });
    l.schreibeKontextUm(ohneAbbruch);
    await bis(() => stopps() >= 2, 200);
    expect(stopps()).toBeGreaterThanOrEqual(2);
    // Der Vorgang bleibt sichtbar und stoppbar.
    expect(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]')).not.toBeNull();

    // Der Kanal kennt den Abbruch wieder: keine weitere Wiederholung.
    l.schreibeKontextUm((k) => ({ ...k, kanal: "kanal-b" }));
    const n = kontextAbrufe();
    await bis(() => kontextAbrufe() >= n + 1, 200);
    const nachAnkunft = stopps();
    await bis(() => kontextAbrufe() >= n + 3, 200);
    expect(stopps()).toBe(nachAnkunft);
  });

  // Nacharbeit 67 (Ben): Stopp WÄHREND der Wiederanmeldung — der neue Kanal kennt die Aktion noch
  // nicht (404), leere Abrufe derselben neuen Instanz folgen. Der Wunsch bleibt und geht hinaus,
  // sobald Word die Aktion ohne Abbruch neu meldet.
  it("Stopp unter „neu gestartet“ (404), leere Abrufe derselben Instanz: Wunsch bleibt, erneut zugestellt", async () => {
    await vorrichtung();
    await fensterMitMarkierung(FENSTER, DOKUMENT);
    const id = await auftragAn(FENSTER, "Synthetische Frage, Stopp während der Wiederanmeldung");
    const r = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 2,
      auswahl: null,
      auswahlStand: 1,
    });
    expect(r.statusCode, r.body).toBe(200);
    await montiere();
    await gespraechOffen();
    await bis(() => Boolean(vorgangZeile(id)), 160);
    const stoppUrl = `${BASIS}/adapter/${FENSTER}/aktionen/${id}/stopp`;
    const stopps = () =>
      draht.aufrufe.filter((a) => a.methode === "POST" && a.url === stoppUrl).length;
    const kontextAbrufe = () =>
      draht.aufrufe.filter((a) => a.methode === "GET" && a.url === `${BASIS}/kontext`).length;

    // Neue Kanalinstanz, Word noch nicht neu angemeldet: die Aktion steht unter „neu gestartet“.
    const l = lenkung();
    l.schreibeKontextUm((k) => ({ ...k, kanal: "kanal-b", adapter: [] }));
    await bis(() => (vorgangZeile(id)?.textContent ?? "").includes("neu gestartet"), 200);
    // Jetzt Stopp — der neue Kanal kennt die Aktion noch nicht.
    draht.stoerungEinmal(stoppUrl, 404);
    await klick(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]'));
    expect(stopps()).toBe(1);
    // Mehrere leere Abrufe DERSELBEN neuen Instanz: der Wunsch darf nicht verfallen.
    const n = kontextAbrufe();
    await bis(() => kontextAbrufe() >= n + 3, 200);
    expect(kontextAbrufe()).toBeGreaterThanOrEqual(n + 3);
    expect(stopps()).toBe(1);

    // Word meldet sich in der neuen Instanz mit der laufenden Aktion — ohne Abbruch.
    l.schreibeKontextUm((k) => ({
      ...k,
      kanal: "kanal-b",
      adapter: (k.adapter as Array<Record<string, unknown>>).map((a) => ({
        ...a,
        bestand: true,
        aktionen: (a.aktionen as Array<Record<string, unknown>>).map((x) => {
          const { abbruchAngefordert: _weg, ...rest } = x;
          return rest;
        }),
      })),
    }));
    await bis(() => stopps() >= 2, 200);
    expect(stopps()).toBeGreaterThanOrEqual(2);
    expect(vorgangZeile(id)?.querySelector('[data-testid="begleiter-word-stopp"]')).not.toBeNull();
  });
});

describe("S9 · UI-MIN-12 — der Entwurf behält Konto und Ursprung; ein Zielwechsel wird geklärt", () => {
  it("übersteht Schliessen und Neumontage, speichert keinen Markierungstext und fragt bei neuer Markierung", async () => {
    await vorrichtung();
    await fensterMitMarkierung(FENSTER, DOKUMENT);
    await montiere();
    await gespraechOffen();
    await bis(() => q(document, "begleiter-auswahl-text")?.textContent === MARKIERUNG, 160);
    const text = "Was bedeutet die Markierung für die Frist?";
    await tippe(q<HTMLInputElement>(document, "begleiter-eingabe") as HTMLInputElement, text);

    // Gespeichert in der Sitzung: Text und Ursprung (Fenster, Auswahlstand), nie die Markierung.
    const roh = sessionStorage.getItem("klarwerk.begleiter.entwurf") ?? "";
    expect(JSON.parse(roh)).toMatchObject({
      text,
      ursprung: {
        instanz: FENSTER,
        titel: "Vertrag Muster.docx",
        host: "word-mac",
        auswahlStand: 1,
      },
    });
    expect(roh).not.toContain(MARKIERUNG);

    // Einklappen, ganz abbauen, neu montieren: der Entwurf steht wieder im Feld.
    await klick(q(document, "begleiter-schliessen"));
    abbauen();
    await montiere();
    await gespraechOffen();
    const feld = q<HTMLInputElement>(document, "begleiter-eingabe") as HTMLInputElement;
    expect(feld.value).toBe(text);

    // Word meldet eine ANDERE Markierung: Senden fragt nach dem Ziel, statt still umzulenken.
    await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 2,
      auswahl: { text: "Synthetischer neuer Absatz.", laenge: 27, stand: 2 },
    });
    await bis(
      () => q(document, "begleiter-auswahl-text")?.textContent === "Synthetischer neuer Absatz.",
      160,
    );
    await klick(q(document, "begleiter-senden"));
    expect(q(document, "begleiter-ziel-klaeren")).not.toBeNull();
    expect(feld.value).toBe(text);
    const nichts = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 3,
      auswahl: { text: "Synthetischer neuer Absatz.", laenge: 27, stand: 2 },
    });
    expect((nichts.json() as { aktionen: unknown[] }).aktionen).toEqual([]);

    // Ausdrücklich „Hierhin“: der Auftrag trägt den JETZIGEN Auswahlstand.
    await klick(q(document, "begleiter-ziel-jetzt"));
    await bis(() => feld.value === "", 80);
    const holen = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 4,
      auswahl: { text: "Synthetischer neuer Absatz.", laenge: 27, stand: 2 },
    });
    const auftraege = (
      holen.json() as { aktionen: Array<{ art: string; text: string; auswahlStand: number }> }
    ).aktionen;
    expect(auftraege.map((a) => [a.art, a.text, a.auswahlStand])).toEqual([["frage", text, 2]]);
    expect(q(document, "begleiter-ziel-klaeren")).toBeNull();
    expect(sessionStorage.getItem("klarwerk.begleiter.entwurf")).toBeNull();
  });

  it("ein anderes Konto findet den Entwurf nicht", async () => {
    await vorrichtung();
    await montiere();
    await gespraechOffen();
    await tippe(
      q<HTMLInputElement>(document, "begleiter-eingabe") as HTMLInputElement,
      "Synthetischer Entwurf",
    );
    abbauen();
    if (!aufbau) {
      throw new Error("Vorrichtung fehlt");
    }
    const anderes = await neuesKonto(aufbau.app, "begleiter-zwei", aufbau.admin);
    leser = anderes;
    draht.setzeCookie(`kw_session=${anderes.token}`);
    await montiere();
    await gespraechOffen();
    expect((q<HTMLInputElement>(document, "begleiter-eingabe") as HTMLInputElement).value).toBe("");
  });
});
